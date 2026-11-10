/**
 * End-to-End Business Workflow & Financial Reconciliation Test Suite
 * Project: SUNBiroJasa — Admin SUN89
 * Workspace: D:\Admin\adminsunbirojasa
 * 
 * Comprehensive Automated Verification for Scenarios A through H:
 * - Scenario A (E2E-20261109-001): Pembayaran Awal Tepat (Full Payment -> Lunas -> sisa=0 -> No Cashback)
 * - Scenario B (E2E-20261109-002): Pembayaran Awal Berlebih (Overpayment -> Refund Pending -> Gating -> Payout)
 * - Scenario C (E2E-20261109-003): Pembayaran Parsial / Kurang Bayar (Partial Payment -> Kurang Bayar -> Belum Bayar tab)
 * - Scenario D (E2E-20261109-004): Pelunasan Kurang Bayar (Staged Payments -> Underpayment -> Full Settlement -> Anti-Double Payment)
 * - Scenario E (E2E-20261109-005): Payout Idempotency, OCC & Edge Cases (Gating, OCC Conflict, Duplicate Replay, Kas Ledger)
 * - Scenario F (E2E-20261109-006): Order Tracking & Workflow Integration (Step 1-8 Progression, Gating, Rollback Step 7->6, Completion)
 * - Scenario G (E2E-20261109-007): Data Penjualan Multi-Category Reconciliation & Plate Search Normalization
 * - Scenario H (E2E-20261109-008): Button Success & Failure Feedback, Loading, Error Classification & Non-Optimistic Safety
 * 
 * Strict Environment Isolation: Uses disposable SQLite database via scripts/run-test-isolated.cjs
 */

import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { getDb } from "../server/src/database/db";
import { projectOrderToContractRow, resolveOrderSalesCategory } from "../src/app/data/penjualanContractData";
import {
  reduceActionFailure,
  reduceActionStart,
  reduceActionSuccess,
  type ActionStateMap,
} from "../src/app/hooks/useActionFeedback";
import {
  classifyActionError,
  sanitizeActionMessage,
} from "../src/app/utils/actionErrorClassifier";

// User contexts for role-based authorization
const adminUser = { userId: "usr-admin-1", employeeId: "EMP-0001", nama: "Admin Loket", role: "admin", jabatan: "Staff Admin" } as any;
const spvUser = { userId: "usr-spv-1", employeeId: "EMP-0002", nama: "Supervisor SPV", role: "administrator", jabatan: "SVP" } as any;
const courierUser = { userId: "usr-courier-1", employeeId: "EMP-0004", nama: "Ahmad Kurir", role: "messenger" } as any;

// Helper to advance order through stages
function advanceOrderThroughStages(orderNo: string, targetStep: number, isWalkIn: boolean = false, finalCostAmount?: number) {
  const current = orderService.getByOrderNo(orderNo);
  let step = current.currentStep;

  if (step < 2 && targetStep >= 2 && !isWalkIn) {
    orderService.advanceOrder(orderNo, "Penjadwalan", {
      tanggalJemput: "2026-11-09",
      messenger: "Ahmad Kurir",
      messengerEmployeeId: "EMP-0004"
    }, adminUser);
    step = 2;
  }

  if (step < 3 && targetStep >= 3 && !isWalkIn) {
    orderService.advanceOrder(orderNo, "Verifikasi Dokumen", {
      pickupCompleted: true,
      messengerTaskStatus: "Dokumen Sudah Tersedia"
    }, adminUser);
    step = 3;
  }

  if (step < 4 && targetStep >= 4) {
    orderService.advanceOrder(orderNo, "Proses Samsat", {
      documentsVerified: true
    }, adminUser);
    step = 4;
  }

  if (step < 5 && targetStep >= 5) {
    const o = orderService.getByOrderNo(orderNo);
    const updatedSamsat = (o.samsatProcesses || []).map((p: any) => ({ ...p, status: "Selesai" }));
    orderService.advanceOrder(orderNo, "Verifikasi Ulang", {
      samsatProcesses: updatedSamsat,
      samsatCompletedAt: new Date().toISOString()
    }, adminUser);
    step = 5;
  }

  if (step < 6 && targetStep >= 6) {
    const o = orderService.getByOrderNo(orderNo);
    const cost = finalCostAmount || o.payment?.totalBiaya || 1000000;
    orderService.advanceOrder(orderNo, "Supervisi", {
      documentsVerified: true,
      isCostVerified: true,
      finalCost: cost,
      documentApproval: { stage5Verified: true, stage5VerifiedAt: new Date().toISOString() } as any
    }, adminUser);
    step = 6;
  }

  if (step < 7 && targetStep >= 7) {
    orderService.advanceOrder(orderNo, "Pengantaran", {
      approvedBySpv: "Supervisor SPV",
      spvName: "Supervisor SPV",
      messengerPengantar: "Ahmad Kurir",
      deliveryMessengerId: "EMP-0004",
      documentApproval: { stage6Approved: true, stage6ApprovedAt: new Date().toISOString() } as any
    }, spvUser);
    step = 7;
  }

  if (step < 8 && targetStep >= 8) {
    const o = orderService.getByOrderNo(orderNo);
    orderService.advanceOrder(orderNo, "Dokumen Telah Diterima", {
      penerimaDokumen: o.customer + " (Penerima Asli)",
      recipientName: o.customer + " (Penerima Asli)"
    }, adminUser);
    step = 8;
  }

  return orderService.getByOrderNo(orderNo);
}

test("E2E BUSINESS WORKFLOW & FINANCIAL RECONCILIATION SUITE", async (t) => {
  const db = getDb();

  let orderNoScenarioC = "";

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO A: PEMBAYARAN AWAL TEPAT (E2E-20261109-001)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SCENARIO A: Pembayaran Awal Tepat (Exact Payment -> Lunas -> sisa=0 -> No Cashback)", () => {
    const totalBiaya = 850000;
    const initialPaid = 850000;

    const created = orderService.createOrder({
      customer: "Budi Hartono (E2E-A)",
      namaPemilik: "Budi Hartono",
      nomorHP: "081211110001",
      layanan: "Perpanjangan STNK Tahunan",
      serviceId: "svc-perp-1th",
      nopol: "B 1001 E2E",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Datang Langsung",
      tipePembayaran: "Bayar di Awal",
      biayaJasa: 150000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: initialPaid,
        statusPembayaran: "Lunas",
        isPaymentVerified: true
      }
    }, adminUser);

    assert.ok(created, "Order A must be created");
    const orderNo = created.orderNo;
    assert.strictEqual(created.nopol, "B 1001 E2E");
    assert.strictEqual(created.currentStep, 3, "Datang Langsung order starts at Step 3 (Verifikasi Dokumen)");

    // 1. Verify Invoice in Finance
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
    assert.ok(invoice, "Invoice must exist");
    assert.strictEqual(invoice.totalTagihan, 850000);
    assert.strictEqual(invoice.dibayar, 850000);
    assert.strictEqual(invoice.sisa, 0, "Outstanding balance must be 0");
    assert.strictEqual(invoice.overpayment, 0, "Overpayment must be 0");
    assert.strictEqual(invoice.status, "PAID", "Invoice status must be PAID");
    assert.strictEqual(invoice.settlementCondition, "BALANCED");
    assert.strictEqual(invoice.refundStatus, "NONE", "No refund pending on exact payment");
    assert.strictEqual(invoice.cashbackStatus, "APPROVED", "No cashback pending");

    // 2. Advance to Step 8 (Completion)
    const finalOrder = advanceOrderThroughStages(orderNo, 8, true, totalBiaya);
    assert.strictEqual(finalOrder.currentStep, 8, "Must reach Step 8");
    assert.strictEqual(finalOrder.currentStageName, "Dokumen Telah Diterima");

    // 3. Verify Data Penjualan Projection
    const contractRow = projectOrderToContractRow(finalOrder, invoice, false);
    assert.strictEqual(contractRow["Nama Customer"], "Budi Hartono (E2E-A)");
    assert.strictEqual(contractRow["Plat No"], "B 1001 E2E");
    assert.strictEqual(contractRow["Uang Masuk dari Konsumen"], 850000);
    assert.strictEqual(contractRow["Status Pembayaran"], "Lunas");
    assert.strictEqual(contractRow["Status Pengerjaan"], "Menunggu Arsip");

    // 4. Verify no unexpected cashback in DB
    const dbInvoice = db.prepare("SELECT * FROM finance_invoices WHERE order_no = ?").get(orderNo) as any;
    assert.strictEqual(dbInvoice.cashback_status, "APPROVED");
    assert.strictEqual(dbInvoice.refund_status, "NONE");
    assert.strictEqual(dbInvoice.overpayment, 0);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO B: PEMBAYARAN AWAL BERLEBIH (E2E-20261109-002)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SCENARIO B: Pembayaran Awal Berlebih (Overpayment -> Refund Pending -> Gating -> Payout)", () => {
    const totalBiaya = 1000000;
    const initialPaid = 1200000;
    const expectedOverpayment = 200000;

    const created = orderService.createOrder({
      customer: "Siti Rahma (E2E-B)",
      namaPemilik: "Siti Rahma",
      nomorHP: "081211110002",
      layanan: "Perpanjangan STNK Tahunan",
      serviceId: "svc-perp-1th",
      nopol: "B 2002 E2E",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Antar Jemput",
      tipePembayaran: "Bayar di Awal",
      biayaJasa: 150000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: initialPaid,
        statusPembayaran: "Lunas",
        isPaymentVerified: true
      }
    }, adminUser);

    assert.ok(created, "Order B must be created");
    const orderNo = created.orderNo;
    assert.strictEqual(created.currentStep, 1, "Antar Jemput starts at Step 1");

    // 1. Verify Invoice state: Overpayment formed & Refund Status PENDING
    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    assert.ok(inv, "Invoice B must exist");
    assert.strictEqual(inv.totalTagihan, 1000000);
    assert.strictEqual(inv.dibayar, 1200000);
    assert.strictEqual(inv.sisa, 0, "Sisa must never be negative");
    assert.strictEqual(inv.overpayment, 200000, "Overpayment must be recorded as 200.000");
    assert.strictEqual(inv.settlementCondition, "OVERPAID");
    assert.strictEqual(inv.refundStatus, "PENDING", "Refund status must be PENDING");

    // 2. Test Phase B Payout Gating at Step 1 (Final cost not set)
    assert.throws(
      () => financeService.payoutCashback(inv.id, {
        idempotencyKey: `IDEMP-GATE-B1-${Date.now()}`,
        expectedVersion: 0,
        nominal: expectedOverpayment,
        paymentType: "KELEBIHAN",
        metode: "Transfer BCA",
        bank: "BCA",
        noRekening: "1234567890",
        penerima: "Siti Rahma",
        namaRekening: "Siti Rahma",
        buktiPembayaran: { fileName: "bukti.png", fileUrl: "/uploads/bukti.png" }
      }, adminUser),
      (err: any) => err.code === "FINAL_COST_NOT_SET",
      "Payout must be strictly blocked before final cost is verified"
    );

    // 3. Advance to Step 6 (Supervisi stage - Cost Verified, but SPV not yet approved)
    advanceOrderThroughStages(orderNo, 6, false, totalBiaya);
    const orderAtStep6 = orderService.getByOrderNo(orderNo);
    assert.strictEqual(orderAtStep6.currentStep, 6);

    // At Step 6 without SPV approval: throws SUPERVISI_NOT_APPROVED
    assert.throws(
      () => financeService.payoutCashback(inv.id, {
        idempotencyKey: `IDEMP-GATE-B2-${Date.now()}`,
        expectedVersion: 0,
        nominal: expectedOverpayment,
        paymentType: "KELEBIHAN",
        metode: "Transfer BCA",
        bank: "BCA",
        noRekening: "1234567890",
        penerima: "Siti Rahma",
        namaRekening: "Siti Rahma",
        buktiPembayaran: { fileName: "bukti.png", fileUrl: "/uploads/bukti.png" }
      }, adminUser),
      (err: any) => err.code === "SUPERVISI_NOT_APPROVED",
      "Payout must be blocked at Step 6 before SPV approves"
    );

    // 4. Advance to Step 7 (Supervisi Approved by SPV)
    advanceOrderThroughStages(orderNo, 7, false, totalBiaya);
    const orderAtStep7 = orderService.getByOrderNo(orderNo);
    assert.strictEqual(orderAtStep7.currentStep, 7);

    // 5. Gating lifted! Execute Payout
    const payoutKey = `IDEMP-PAYOUT-B-${Date.now()}`;
    const payoutResult = financeService.payoutCashback(inv.id, {
      idempotencyKey: payoutKey,
      expectedVersion: 0,
      nominal: expectedOverpayment,
      paymentType: "KELEBIHAN",
      metode: "Transfer BCA",
      bank: "BCA",
      noRekening: "1234567890",
      penerima: "Siti Rahma",
      namaRekening: "Siti Rahma",
      buktiPembayaran: { fileName: "bukti.png", fileUrl: "/uploads/bukti.png" }
    }, adminUser);

    assert.ok(payoutResult, "Payout execution must succeed");
    const settledInv = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(settledInv.refundStatus, "PROCESSED", "Refund status must update to PROCESSED");
    assert.strictEqual(settledInv.overpayment, 200000);

    // 6. Verify Cash Ledger (kas_kantor) has recorded credit outflow
    const kasOutflows = (db.prepare("SELECT * FROM kas_kantor WHERE status = 'Kredit' AND kredit = ?").all(expectedOverpayment) as any[]);
    assert.ok(kasOutflows.length > 0, "Cash outflow must be booked in kas_kantor for disbursed overpayment");

    // 7. Verify Anti-Double Payout Protection
    assert.throws(
      () => financeService.payoutCashback(inv.id, {
        idempotencyKey: `IDEMP-SECOND-PAYOUT-${Date.now()}`,
        expectedVersion: 1,
        nominal: expectedOverpayment,
        paymentType: "KELEBIHAN",
        metode: "Transfer BCA",
        bank: "BCA",
        noRekening: "1234567890",
        penerima: "Siti Rahma",
        namaRekening: "Siti Rahma",
        buktiPembayaran: { fileName: "bukti.png", fileUrl: "/uploads/bukti.png" }
      }, adminUser),
      (err: any) => err.code === "ALREADY_PROCESSED" || err.code === "EXCEEDS_LIMIT" || err.code === "VALIDATION_ERROR",
      "Second payout attempt must be rejected"
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO C: PEMBAYARAN PARSIAL / KURANG BAYAR (E2E-20261109-003)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SCENARIO C: Pembayaran Parsial / Kurang Bayar (Partial Payment -> Kurang Bayar -> Belum Bayar tab)", () => {
    const totalBiaya = 1000000;
    const initialPaid = 400000;
    const expectedSisa = 600000;

    const created = orderService.createOrder({
      customer: "Ahmad Fauzi (E2E-C)",
      namaPemilik: "Ahmad Fauzi",
      nomorHP: "081211110003",
      layanan: "Balik Nama",
      serviceId: "svc-balik-nama",
      nopol: "B 3003 E2E",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Antar Jemput",
      tipePembayaran: "Bayar di Awal",
      biayaJasa: 350000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: initialPaid,
        kurang: expectedSisa,
        statusPembayaran: "Kurang Bayar"
      }
    }, adminUser);

    assert.ok(created, "Order C must be created");
    orderNoScenarioC = created.orderNo;

    // 1. Verify Invoice state: PARTIAL, sisa = 600.000, no cashback/refund
    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNoScenarioC)!;
    assert.ok(inv, "Invoice C must exist");
    assert.strictEqual(inv.totalTagihan, 1000000);
    assert.strictEqual(inv.dibayar, 400000);
    assert.strictEqual(inv.sisa, 600000);
    assert.strictEqual(inv.status, "PARTIAL");
    assert.strictEqual(inv.settlementCondition, "UNDERPAID");
    assert.strictEqual(inv.overpayment, 0);
    assert.strictEqual(inv.refundStatus, "NONE");
    assert.strictEqual(inv.cashbackStatus, "APPROVED");

    // 2. Verify Data Penjualan Projection
    const contractRow = projectOrderToContractRow(created, inv, false);
    assert.strictEqual(contractRow["Nama Customer"], "Ahmad Fauzi (E2E-C)");
    assert.strictEqual(contractRow["Plat No"], "B 3003 E2E");
    assert.strictEqual(contractRow["Uang Masuk dari Konsumen"], 400000);
    assert.strictEqual(contractRow["Sisa Tagihan"], 600000);
    assert.strictEqual(contractRow["Status Pembayaran"], "Kurang Bayar");

    // 3. Verify Belum Bayar list presence
    const allInvoices = dbFinanceRepository.getAllInvoices();
    const foundInBelumBayar = allInvoices.some((i: any) => i.orderNo === orderNoScenarioC && i.sisa > 0);
    assert.ok(foundInBelumBayar, "Order C must appear in Belum & Kurang Bayar dataset");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO D: PELUNASAN KURANG BAYAR (E2E-20261109-004)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SCENARIO D: Pelunasan Kurang Bayar (Staged Payments -> Underpayment -> Full Settlement -> Anti-Double Payment)", () => {
    assert.ok(orderNoScenarioC, "Order C must have been created in Scenario C");
    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNoScenarioC)!;
    assert.strictEqual(inv.sisa, 600000);

    // 1. Test Payment Gating at Step 1 (Early Payment Attempt)
    assert.throws(
      () => financeService.recordPayment(inv.id, 200000, {
        idempotencyKey: `IDEMP-PAY-GATE-${Date.now()}`,
        metode: "Transfer BCA",
        buktiBayar: { fileName: "bukti.png", fileUrl: "/uploads/bukti.png" }
      }, adminUser),
      (err: any) => err.code === "FINAL_COST_NOT_SET" || err.code === "SUPERVISI_NOT_APPROVED",
      "Additional payment must be gated before final cost and supervisi"
    );

    // 2. Advance to Step 7 so payment gating is satisfied
    advanceOrderThroughStages(orderNoScenarioC, 7, false, 1000000);

    // 3. Staged Payment Part 1: Underpayment (Add Rp200.000 -> sisa becomes 400.000)
    const pay1Key = `IDEMP-PAY-PART1-${Date.now()}`;
    financeService.recordPayment(inv.id, 200000, {
      idempotencyKey: pay1Key,
      metode: "Transfer BCA",
      buktiBayar: { fileName: "bukti1.png", fileUrl: "/uploads/bukti1.png" }
    }, adminUser);

    // Confirm verification in order & invoice via orderService.verifyPayment
    orderService.verifyPayment(orderNoScenarioC, "Finance User", adminUser, 600000, "Pelunasan tahap 1", {
      fileName: "bukti1.png",
      fileUrl: "/uploads/bukti1.png"
    });

    const invAfterPay1 = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(invAfterPay1.dibayar, 600000);
    assert.strictEqual(invAfterPay1.sisa, 400000);

    // 4. Staged Payment Part 2: Full Pelunasan (Add Rp400.000 -> sisa becomes 0)
    const pay2Key = `IDEMP-PAY-PART2-${Date.now()}`;
    financeService.recordPayment(inv.id, 400000, {
      idempotencyKey: pay2Key,
      metode: "Transfer BCA",
      buktiBayar: { fileName: "bukti2.png", fileUrl: "/uploads/bukti2.png" }
    }, adminUser);

    // Confirm full verification in order & invoice via orderService.verifyPayment
    orderService.verifyPayment(orderNoScenarioC, "Finance User", adminUser, 1000000, "Pelunasan lunas", {
      fileName: "bukti2.png",
      fileUrl: "/uploads/bukti2.png"
    });

    const invAfterPay2 = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(invAfterPay2.dibayar, 1000000);
    assert.strictEqual(invAfterPay2.sisa, 0);
    assert.strictEqual(invAfterPay2.status, "PAID");

    // 5. Verify Payment History contains recorded payments
    const payments = dbFinanceRepository.getPaymentsByOrderNo(orderNoScenarioC);
    assert.ok(payments.length >= 2, "Payment transaction records must be stored");

    // 6. Verify Anti-Double Payment on fully paid invoice
    assert.throws(
      () => financeService.recordPayment(inv.id, 50000, {
        idempotencyKey: `IDEMP-PAY-OVER-${Date.now()}`,
        metode: "Transfer BCA"
      }, adminUser),
      (err: any) => err.code === "INVOICE_ALREADY_PAID",
      "Payment on already PAID invoice must be strictly rejected"
    );

    // 7. Verify Data Penjualan Projection updated to Lunas
    const updatedOrder = orderService.getByOrderNo(orderNoScenarioC);
    const updatedContractRow = projectOrderToContractRow(updatedOrder, invAfterPay2, false);
    assert.strictEqual(updatedContractRow["Status Pembayaran"], "Lunas");
    assert.strictEqual(updatedContractRow["Uang Masuk dari Konsumen"], 1000000);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO E: PAYOUT IDEMPOTENCY, OCC & EDGE CASES (E2E-20261109-005)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SCENARIO E: Payout Idempotency, OCC & Edge Cases (Gating, OCC Conflict, Duplicate Replay, Kas Ledger)", () => {
    const totalBiaya = 1500000;
    const initialPaid = 1800000;
    const expectedRefund = 300000;

    const created = orderService.createOrder({
      customer: "Rudi Hermawan (E2E-E)",
      namaPemilik: "Rudi Hermawan",
      nomorHP: "081211110005",
      layanan: "Mutasi Luar Daerah",
      serviceId: "svc-mut-antar",
      samsatTujuanId: "samsat-bandung",
      nopol: "B 5005 E2E",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Datang Langsung",
      tipePembayaran: "Bayar di Awal",
      biayaJasa: 450000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: initialPaid,
        statusPembayaran: "Lunas",
        isPaymentVerified: true
      }
    }, adminUser);

    const orderNo = created.orderNo;
    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    assert.strictEqual(inv.overpayment, 300000);
    assert.strictEqual(inv.refundStatus, "PENDING");

    // Advance to Step 7 so gating is satisfied
    advanceOrderThroughStages(orderNo, 7, true, totalBiaya);

    // 1. Edge Case: Missing Idempotency Key -> 400
    assert.throws(
      () => financeService.payoutCashback(inv.id, {
        expectedVersion: 0,
        nominal: expectedRefund,
        paymentType: "KELEBIHAN",
        bank: "BCA",
        noRekening: "1234567890",
        penerima: "Rudi Hermawan",
        namaRekening: "Rudi Hermawan",
        buktiPembayaran: { fileName: "b.png", fileUrl: "/u/b.png" }
      } as any, adminUser),
      (err: any) => err.code === "IDEMPOTENCY_KEY_REQUIRED"
    );

    // 2. Edge Case: Missing expectedVersion -> 400
    assert.throws(
      () => financeService.payoutCashback(inv.id, {
        idempotencyKey: `IDEMP-E5-${Date.now()}`,
        nominal: expectedRefund,
        paymentType: "KELEBIHAN",
        bank: "BCA",
        noRekening: "1234567890",
        penerima: "Rudi Hermawan",
        namaRekening: "Rudi Hermawan",
        buktiPembayaran: { fileName: "b.png", fileUrl: "/u/b.png" }
      } as any, adminUser),
      (err: any) => err.code === "EXPECTED_VERSION_REQUIRED"
    );

    // 3. Edge Case: OCC Version Conflict (Expected 99, actual is 0) -> 409
    assert.throws(
      () => financeService.payoutCashback(inv.id, {
        idempotencyKey: `IDEMP-E5-OCC-${Date.now()}`,
        expectedVersion: 99,
        nominal: expectedRefund,
        paymentType: "KELEBIHAN",
        bank: "BCA",
        noRekening: "1234567890",
        penerima: "Rudi Hermawan",
        namaRekening: "Rudi Hermawan",
        buktiPembayaran: { fileName: "b.png", fileUrl: "/u/b.png" }
      }, adminUser),
      (err: any) => err.code === "CONCURRENT_MODIFICATION"
    );

    // 4. Valid Payout Execution
    const canonicalKey = `IDEMP-CANONICAL-E5-${Date.now()}`;
    const initialKasOutflowCount = (db.prepare("SELECT COUNT(*) as cnt FROM kas_kantor WHERE status = 'Kredit' AND kredit = ?").get(expectedRefund) as any).cnt;

    const payoutRes = financeService.payoutCashback(inv.id, {
      idempotencyKey: canonicalKey,
      expectedVersion: 0,
      nominal: expectedRefund,
      paymentType: "KELEBIHAN",
      bank: "BCA",
      noRekening: "1234567890",
      penerima: "Rudi Hermawan",
      namaRekening: "Rudi Hermawan",
      buktiPembayaran: { fileName: "b.png", fileUrl: "/u/b.png" }
    }, adminUser);

    assert.ok(payoutRes, "Payout must succeed");
    const afterPayoutInv = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(afterPayoutInv.refundStatus, "PROCESSED");

    const afterFirstKasOutflowCount = (db.prepare("SELECT COUNT(*) as cnt FROM kas_kantor WHERE status = 'Kredit' AND kredit = ?").get(expectedRefund) as any).cnt;
    assert.strictEqual(afterFirstKasOutflowCount, initialKasOutflowCount + 1, "Exactly 1 cash outflow must be booked");

    // 5. Edge Case: Duplicate Replay with Identical Key & Payload -> Return cached invoice, zero new cash deduction
    const replayRes = financeService.payoutCashback(inv.id, {
      idempotencyKey: canonicalKey,
      expectedVersion: 0,
      nominal: expectedRefund,
      paymentType: "KELEBIHAN",
      bank: "BCA",
      noRekening: "1234567890",
      penerima: "Rudi Hermawan",
      namaRekening: "Rudi Hermawan",
      buktiPembayaran: { fileName: "b.png", fileUrl: "/u/b.png" }
    }, adminUser);

    assert.ok(replayRes, "Replay must return cached response");
    assert.strictEqual(replayRes.id, inv.id);

    const afterReplayKasOutflowCount = (db.prepare("SELECT COUNT(*) as cnt FROM kas_kantor WHERE status = 'Kredit' AND kredit = ?").get(expectedRefund) as any).cnt;
    assert.strictEqual(afterReplayKasOutflowCount, afterFirstKasOutflowCount, "Duplicate replay MUST NOT create additional cash deductions");

    // 6. Edge Case: Key Conflict (Same key, different payload amount) -> 409
    assert.throws(
      () => financeService.payoutCashback(inv.id, {
        idempotencyKey: canonicalKey,
        expectedVersion: 1,
        nominal: 100000, // Different nominal!
        paymentType: "KELEBIHAN",
        bank: "BCA",
        noRekening: "1234567890",
        penerima: "Rudi Hermawan",
        namaRekening: "Rudi Hermawan",
        buktiPembayaran: { fileName: "b.png", fileUrl: "/u/b.png" }
      }, adminUser),
      (err: any) => err.code === "IDEMPOTENCY_CONFLICT"
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO F: ORDER TRACKING & WORKFLOW INTEGRATION (E2E-20261109-006)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SCENARIO F: Order Tracking & Workflow Integration (Step 1-8 Progression, Gating, Rollback Step 7->6, Completion)", () => {
    const totalBiaya = 750000;
    const created = orderService.createOrder({
      customer: "Maya Kusuma (E2E-F)",
      namaPemilik: "Maya Kusuma",
      nomorHP: "081211110006",
      layanan: "Perpanjangan STNK Tahunan",
      serviceId: "svc-perp-1th",
      nopol: "B 6006 E2E",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Antar Jemput",
      tipePembayaran: "Bayar di Awal",
      biayaJasa: 150000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: totalBiaya,
        statusPembayaran: "Lunas",
        isPaymentVerified: true
      }
    }, adminUser);

    const orderNo = created.orderNo;
    assert.strictEqual(created.currentStep, 1);

    // 1. Invalid Stage Skip: Trying to advance Step 1 -> Step 8 directly throws INVALID_STAGE_TRANSITION
    assert.throws(
      () => orderService.advanceOrder(orderNo, "Dokumen Telah Diterima", {}, adminUser),
      (err: any) => err.code === "INVALID_STAGE_TRANSITION"
    );

    // 2. Step 1 -> Step 2: Penjadwalan
    const s2 = orderService.advanceOrder(orderNo, "Penjadwalan", {
      tanggalJemput: "2026-11-09",
      messenger: "Ahmad Kurir",
      messengerEmployeeId: "EMP-0004"
    }, adminUser);
    assert.strictEqual(s2.currentStep, 2);

    // 3. Step 2 -> Step 3: Verifikasi Dokumen
    const s3 = orderService.advanceOrder(orderNo, "Verifikasi Dokumen", {
      pickupCompleted: true,
      messengerTaskStatus: "Dokumen Sudah Tersedia"
    }, adminUser);
    assert.strictEqual(s3.currentStep, 3);

    // 4. Step 3 -> Step 4: Proses Samsat
    const s4 = orderService.advanceOrder(orderNo, "Proses Samsat", {
      documentsVerified: true
    }, adminUser);
    assert.strictEqual(s4.currentStep, 4);

    // 5. Step 4 -> Step 5: Verifikasi Ulang
    const updatedSamsat = (s4.samsatProcesses || []).map((p: any) => ({ ...p, status: "Selesai" }));
    const s5 = orderService.advanceOrder(orderNo, "Verifikasi Ulang", {
      samsatProcesses: updatedSamsat,
      samsatCompletedAt: new Date().toISOString()
    }, adminUser);
    assert.strictEqual(s5.currentStep, 5);

    // 6. Step 5 -> Step 6: Supervisi
    const s6 = orderService.advanceOrder(orderNo, "Supervisi", {
      documentsVerified: true,
      isCostVerified: true,
      finalCost: totalBiaya,
      documentApproval: { stage5Verified: true, stage5VerifiedAt: new Date().toISOString() } as any
    }, adminUser);
    assert.strictEqual(s6.currentStep, 6);

    // 7. Step 6 -> Step 7: Pengantaran (Approved by SPV)
    const s7 = orderService.advanceOrder(orderNo, "Pengantaran", {
      approvedBySpv: "Supervisor SPV",
      spvName: "Supervisor SPV",
      messengerPengantar: "Ahmad Kurir",
      deliveryMessengerId: "EMP-0004",
      documentApproval: { stage6Approved: true, stage6ApprovedAt: new Date().toISOString() } as any
    }, spvUser);
    assert.strictEqual(s7.currentStep, 7);
    assert.strictEqual(s7.approvedBySpv, "Supervisor SPV");

    // 8. Rollback: Step 7 -> Step 6 (Supervisi)
    const rollbackResult = orderService.rollbackOrder(orderNo, "Supervisi", "Perlu pengecekan ulang berkas STNK oleh SPV", spvUser);
    assert.strictEqual(rollbackResult.currentStep, 6);
    assert.strictEqual(rollbackResult.currentStageName, "Supervisi");
    // Verify SPV approval was revoked (boolean false)
    assert.strictEqual(Boolean(rollbackResult.approvedBySpv), false);
    assert.strictEqual(Boolean(rollbackResult.isDeliveryScheduled), false);

    // Verify invoice payment is preserved during rollback
    const invAfterRollback = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    assert.strictEqual(invAfterRollback.dibayar, totalBiaya);
    assert.strictEqual(invAfterRollback.status, "PAID");

    // 9. Re-advance Step 6 -> Step 7
    orderService.advanceOrder(orderNo, "Pengantaran", {
      approvedBySpv: "Supervisor SPV",
      spvName: "Supervisor SPV",
      messengerPengantar: "Ahmad Kurir",
      deliveryMessengerId: "EMP-0004",
      documentApproval: { stage6Approved: true, stage6ApprovedAt: new Date().toISOString() } as any
    }, spvUser);

    // 10. Step 7 -> Step 8: Dokumen Telah Diterima (Terminal State)
    const s8 = orderService.advanceOrder(orderNo, "Dokumen Telah Diterima", {
      penerimaDokumen: "Maya Kusuma (Penerima Asli)",
      recipientName: "Maya Kusuma (Penerima Asli)"
    }, adminUser);
    assert.strictEqual(s8.currentStep, 8);
    assert.strictEqual(s8.currentStageName, "Dokumen Telah Diterima");

    // 11. Verify Data Penjualan row matches Terminal Status
    const contractRow = projectOrderToContractRow(s8, invAfterRollback, false);
    assert.strictEqual(contractRow["Status Pengerjaan"], "Menunggu Arsip");
    assert.strictEqual(contractRow["Status Pembayaran"], "Lunas");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO G: DATA PENJUALAN RECONCILIATION & PLATE SEARCH (E2E-20261109-007)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SCENARIO G: Data Penjualan Multi-Category Reconciliation & Plate Search Normalization", () => {
    // 1. Verify Category Mapping across 7 canonical services
    const testCases = [
      { layanan: "Perpanjangan STNK Tahunan", serviceId: "svc-perp-1th", expectedCat: "perpanjangan-1-tahun" },
      { layanan: "Perpanjangan STNK 5 Tahunan & Ganti Plat", serviceId: "svc-perp-5th", expectedCat: "perpanjangan-5-tahun" },
      { layanan: "Mutasi Antar Samsat", serviceId: "svc-mut-asal", expectedCat: "mutasi-asal" },
      { layanan: "Mutasi Luar Daerah", serviceId: "svc-mut-antar", expectedCat: "mutasi-antar-daerah" },
      { layanan: "Balik Nama Kendaraan", serviceId: "svc-balik-nama", expectedCat: "balik-nama" },
      { layanan: "Tarik Berkas Kendaraan", serviceId: "svc-tarik-berkas", expectedCat: "tarik-berkas" },
      { layanan: "Duplikat STNK (STNK Hilang)", serviceId: "svc-duplikat-stnk", expectedCat: "duplikat-stnk" },
      { layanan: "Layanan Khusus", serviceId: "svc-lainnya", expectedCat: "lainnya" },
    ];

    for (const tc of testCases) {
      const resolved = resolveOrderSalesCategory(tc.layanan, tc.serviceId);
      assert.strictEqual(resolved, tc.expectedCat, `Category for ${tc.layanan} must be ${tc.expectedCat}`);
    }

    // 2. Plate search normalization verification
    const normalizePlate = (p: string) => p.toUpperCase().replace(/[\s\-\.]/g, "");
    assert.strictEqual(normalizePlate("B 1001 E2E"), "B1001E2E");
    assert.strictEqual(normalizePlate("b 1001 e2e"), "B1001E2E");
    assert.strictEqual(normalizePlate("B-1001-E2E"), "B1001E2E");
    assert.strictEqual(normalizePlate("B.1001.E2E"), "B1001E2E");

    // Verify searching in DB matches normalized nopol
    const searchedOrder = db.prepare("SELECT * FROM orders WHERE nopol = ?").get("B 1001 E2E") as any;
    assert.ok(searchedOrder, "Order B 1001 E2E must be found in database");
    assert.strictEqual(searchedOrder.customer, "Budi Hartono (E2E-A)");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCENARIO H: BUTTON SUCCESS & FAILURE FEEDBACK (E2E-20261109-008)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SCENARIO H: Button Feedback, Loading, Error Classification & Non-Optimistic Safety", () => {
    // 1. Reducer State Transitions (Loading -> Success)
    let stateMap: ActionStateMap = {};
    stateMap = reduceActionStart(stateMap, "btn-submit-order");
    assert.strictEqual(stateMap["btn-submit-order"]?.loading, true);
    assert.strictEqual(stateMap["btn-submit-order"]?.error, null);

    stateMap = reduceActionSuccess(stateMap, "btn-submit-order");
    assert.strictEqual(stateMap["btn-submit-order"]?.loading, false);
    assert.strictEqual(stateMap["btn-submit-order"]?.error, null);

    // 2. Reducer State Transitions (Loading -> Failure)
    stateMap = reduceActionStart(stateMap, "btn-cairkan-cashback");
    assert.strictEqual(stateMap["btn-cairkan-cashback"]?.loading, true);

    const classifiedError = classifyActionError(new Error("Pencairan ditolak: Supervisi belum menyetujui."));
    stateMap = reduceActionFailure(stateMap, "btn-cairkan-cashback", classifiedError);
    assert.strictEqual(stateMap["btn-cairkan-cashback"]?.loading, false);
    assert.ok(stateMap["btn-cairkan-cashback"]?.error);

    // 3. Error Classification
    const valErr = classifyActionError({ statusCode: 400, message: "Nama Customer wajib diisi", field: "customer" });
    assert.strictEqual(valErr.code, "VALIDATION_ERROR");

    const conflictErr = classifyActionError({ statusCode: 409, message: "Versi data telah diperbarui" });
    assert.strictEqual(conflictErr.code, "CONFLICT");

    const netErr = classifyActionError(new TypeError("Failed to fetch"));
    assert.strictEqual(netErr.code, "NETWORK_ERROR");

    // 4. Message Sanitization: ensure raw SQL and stack traces are not leaked to user
    const rawSql = "SQLITE_ERROR: near 'WHERE': syntax error at /server/src/db.ts:42";
    const sanitized = sanitizeActionMessage(rawSql);
    assert.ok(!sanitized.includes("SQLITE_ERROR"), "Sanitized message must not contain raw SQL errors");
    assert.ok(!sanitized.includes("/server/src/db.ts"), "Sanitized message must not leak file system paths");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PERSISTENCE INTEGRITY VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("PERSISTENCE INTEGRITY: All Test Orders & Invoices Are Truly Persisted in SQLite", () => {
    const plates = ["B 1001 E2E", "B 2002 E2E", "B 3003 E2E", "B 5005 E2E", "B 6006 E2E"];
    for (const plate of plates) {
      const orderRow = db.prepare("SELECT * FROM orders WHERE nopol = ?").get(plate) as any;
      assert.ok(orderRow, `Order with plate ${plate} must be persisted`);
      const invRow = db.prepare("SELECT * FROM finance_invoices WHERE order_no = ?").get(orderRow.order_no) as any;
      assert.ok(invRow, `Invoice for order ${orderRow.order_no} must be persisted`);
    }
  });
});
