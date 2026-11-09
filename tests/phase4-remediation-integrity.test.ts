/**
 * Phase 4: Engineering Remediation & System Stabilization Integrity Test Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies fixes for:
 * 1. [DEF-FIN-001] Silent Invoice Overwrite / Hijacking Prevention
 * 2. [DEF-SEC-005] Document Authorization IDOR & Substring Matching Prevention
 * 3. [DEF-PERF-006] Order Pagination API & Sizing Bounds
 * 4. [DEF-CONF-008] Strict TypeScript Configuration
 */

import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { orderService } from "../server/src/services/orderService";
import { documentService } from "../server/src/services/documentService";
import { documentTicketService } from "../server/src/services/documentTicketService";

test("PHASE 4: ENGINEERING REMEDIATION & SYSTEM STABILIZATION INTEGRITY", async (t) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM A: [DEF-FIN-001] INVOICE COLLISION & HIJACKING PREVENTION
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("DEF-FIN-001: saveInvoice strictly blocks cross-order invoice hijacking", () => {
    const orderNo1 = `ORD-TEST-${Date.now()}-001`;
    const orderNo2 = `ORD-TEST-${Date.now()}-002`;
    const invoiceNo = `INV-COLLISION-${Date.now()}`;

    // 1. Create Invoice for Order 1
    const id1 = dbFinanceRepository.saveInvoice({
      invoiceNo,
      orderNo: orderNo1,
      customer: "Pelanggan Pertama",
      layanan: "Perpanjangan STNK",
      totalTagihan: 500000,
      dibayar: 250000,
      sisa: 250000,
      status: "PARTIAL"
    });

    assert.ok(id1 > 0, "Initial invoice created for Order 1");

    // 2. Order 2 attempts to save using Order 1's invoiceNo
    assert.throws(
      () => {
        dbFinanceRepository.saveInvoice({
          invoiceNo, // SAME invoice number!
          orderNo: orderNo2, // DIFFERENT order!
          customer: "Pelanggan Kedua",
          layanan: "Balik Nama",
          totalTagihan: 1000000,
          dibayar: 1000000,
          sisa: 0,
          status: "PAID"
        });
      },
      (err: any) => {
        return err.message.includes("[FINANCE_INVOICE_COLLISION]") &&
               err.message.includes(invoiceNo) &&
               err.message.includes(orderNo1);
      },
      "Must throw FINANCE_INVOICE_COLLISION error when another order attempts to hijack invoice number"
    );

    // 3. Verify Order 1's invoice remains 100% UNTOUCHED
    const verifiedInv1 = dbFinanceRepository.getInvoiceById(id1);
    assert.ok(verifiedInv1, "Order 1 invoice exists");
    assert.strictEqual(verifiedInv1.orderNo, orderNo1, "Order 1 invoice still belongs to Order 1");
    assert.strictEqual(verifiedInv1.customer, "Pelanggan Pertama", "Customer name not overwritten");
    assert.strictEqual(verifiedInv1.totalTagihan, 500000, "Total tagihan not overwritten");
    assert.strictEqual(verifiedInv1.dibayar, 250000, "Dibayar not overwritten");

    // 4. Legitimate update to Order 1 using the same invoiceNo must succeed
    const id1Updated = dbFinanceRepository.saveInvoice({
      invoiceNo,
      orderNo: orderNo1,
      customer: "Pelanggan Pertama (Updated)",
      totalTagihan: 500000,
      dibayar: 500000,
      sisa: 0,
      status: "PAID"
    });

    assert.strictEqual(id1Updated, id1, "Legitimate update preserves invoice ID");
    const reVerified = dbFinanceRepository.getInvoiceById(id1);
    assert.strictEqual(reVerified?.customer, "Pelanggan Pertama (Updated)");
    assert.strictEqual(reVerified?.status, "PAID");
  });

  await t.test("DEF-FIN-001: orderService.createOrder auto-resolves duplicate client invoiceNo to prevent collision", () => {
    const uniqueSuffix = Date.now().toString().slice(-4);
    const takenInvoiceNo = `INV-TAKEN-${uniqueSuffix}`;
    const primeOrderNo = `ORD-PRIME-${uniqueSuffix}`;

    // Seed existing invoice
    dbFinanceRepository.saveInvoice({
      invoiceNo: takenInvoiceNo,
      orderNo: primeOrderNo,
      customer: "Owner Asli",
      layanan: "Ganti Plat 5 Tahunan",
      totalTagihan: 800000,
      dibayar: 800000,
      sisa: 0,
      status: "PAID"
    });

    // Create a new order with duplicate invoiceNo provided by client
    const newOrder = orderService.createOrder({
      customer: "Pelanggan Baru",
      nomorHp: "081234567890",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1234 XYZ",
      noInvoice: takenInvoiceNo, // Client sends duplicate!
      payment: {
        totalBiaya: 500000,
        dibayar: 0,
        metodePembayaran: "Cash"
      }
    });

    assert.ok(newOrder, "New order created");
    assert.notStrictEqual(newOrder.orderNo, primeOrderNo, "Distinct order number generated");

    // Verify invoice for new order was assigned a distinct number (did not hijack takenInvoiceNo)
    const newOrderInvoice = dbFinanceRepository.getInvoiceByOrderNo(newOrder.orderNo);
    assert.ok(newOrderInvoice, "New invoice created for new order");
    assert.notStrictEqual(newOrderInvoice.invoiceNo, takenInvoiceNo, "Invoice number must not collide with existing invoice");
    assert.strictEqual(newOrderInvoice.orderNo, newOrder.orderNo);

    // Verify original invoice is still intact
    const originalInvoice = dbFinanceRepository.getInvoiceByNo(takenInvoiceNo);
    assert.strictEqual(originalInvoice?.orderNo, primeOrderNo);
    assert.strictEqual(originalInvoice?.customer, "Owner Asli");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM B: [DEF-SEC-005] DOCUMENT AUTHORIZATION IDOR PREVENTION
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("DEF-SEC-005: Courier with substring name cannot access documents of another courier", () => {
    const targetOrderNo = `ORD-DOC-SEC-${Date.now()}`;
    const assignedCourierName = "Budi Santoso";
    const assignedCourierEmpId = "EMP-BUDI-001";

    // 1. Create order assigned to "Budi Santoso"
    dbOrderRepository.saveOrder({
      orderNo: targetOrderNo,
      customer: "Nasabah Uji",
      nomorHp: "08111111111",
      layanan: "Mutasi Masuk",
      nopol: "D 4567 ABC",
      currentStep: 2,
      currentStageName: "Penjadwalan",
      paymentStatus: "Belum Bayar",
      totalBiaya: 1000000,
      isArchived: false,
      messenger: assignedCourierName,
      assignedMessengerId: assignedCourierEmpId,
      assignedMessengerName: assignedCourierName,
      payment: { totalBiaya: 1000000, dibayar: 0 }
    } as any);

    // 2. Courier "Budi" (substring of "Budi Santoso") attempts to read order documents
    const attackerUser = {
      userId: "usr-attacker",
      employeeId: "EMP-BUDI-999", // Different employee ID!
      nama: "Budi", // Substring of "Budi Santoso"!
      role: "messenger",
      jabatan: "Kurir"
    };

    assert.throws(
      () => {
        documentService.getDocumentsByOrder(targetOrderNo, attackerUser as any);
      },
      (err: any) => {
        return err.statusCode === 403 || err.message.includes("tidak berwenang");
      },
      "Courier 'Budi' must be rejected from viewing documents assigned to 'Budi Santoso'"
    );

    // 3. Legitimate courier "Budi Santoso" with matching employeeId must be allowed
    const legitimateUser = {
      userId: "usr-legit",
      employeeId: assignedCourierEmpId,
      nama: assignedCourierName,
      role: "messenger",
      jabatan: "Kurir"
    };

    const docs = documentService.getDocumentsByOrder(targetOrderNo, legitimateUser as any);
    assert.ok(Array.isArray(docs), "Legitimate assigned courier can access documents");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM C: [DEF-PERF-006] ORDER PAGINATION API
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("DEF-PERF-006: getOrdersPaginated returns bounded page and accurate metadata", () => {
    const result = dbOrderRepository.getOrdersPaginated({
      page: 1,
      pageSize: 2,
      archived: false
    });

    assert.ok(result.data, "Result has data array");
    assert.ok(Array.isArray(result.data), "Data is an array");
    assert.ok(result.data.length <= 2, "Page size is capped at 2");

    assert.ok(result.pagination, "Result has pagination envelope");
    assert.strictEqual(result.pagination.page, 1, "Page equals requested page");
    assert.strictEqual(result.pagination.pageSize, 2, "PageSize equals requested pageSize");
    assert.ok(typeof result.pagination.total === "number", "Total is a number");
    assert.ok(result.pagination.total >= 0, "Total is non-negative");
    assert.ok(result.pagination.totalPages >= 1, "TotalPages is at least 1");
  });

  await t.test("DEF-PERF-006: Unpaginated queries remain 100% backward compatible", () => {
    const activeOrders = dbOrderRepository.getActiveOrders();
    assert.ok(activeOrders["Verifikasi"], "Stage 'Verifikasi' bucket exists");
    assert.ok(activeOrders["Supervisi"], "Stage 'Supervisi' bucket exists");
    assert.ok(activeOrders["Dokumen Telah Diterima"], "Stage 'Dokumen Telah Diterima' bucket exists");

    const flatOrders = dbOrderRepository.getAllFlat(false);
    assert.ok(Array.isArray(flatOrders), "getAllFlat returns flat array");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM D: [DEF-CONF-008] STRICT TYPESCRIPT CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("DEF-CONF-008: server/tsconfig.json enforces strict mode", () => {
    const tsconfigPath = path.resolve(process.cwd(), "server/tsconfig.json");
    const raw = fs.readFileSync(tsconfigPath, "utf-8");
    const parsed = JSON.parse(raw);

    assert.strictEqual(
      parsed.compilerOptions.strict,
      true,
      "server/tsconfig.json compilerOptions.strict must be true"
    );
  });

});
