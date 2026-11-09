/**
 * SUNBiroJasa End-to-End Business Scenario Testing Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies the complete operational and financial journey:
 * BUAT ORDER -> ORDER TRACKING -> DATA PENJUALAN -> FINANCIAL RECONCILIATION
 * 
 * Master Test Matrix: ORD-001 through ORD-012
 * Workstreams: A through H
 * Strict Environment Isolation: Uses disposable SQLite database via scripts/run-test-isolated.cjs
 */

import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { dbPaymentMethodRepository } from "../server/src/repositories/dbPaymentMethodRepository";
import { dbWilayahRepository } from "../server/src/repositories/dbWilayahRepository";
import { serviceRepository } from "../server/src/repositories/dbServiceRepository";
import { getDb } from "../server/src/database/db";
import { projectOrderToContractRow, resolveOrderSalesCategory, deriveStatusPengerjaan, deriveStatusPembayaran } from "../src/app/data/penjualanContractData";
import { STAGES, StageName } from "../src/domain/order/types";

// User contexts for role-based authorization
const adminUser = { userId: "usr-admin-1", nama: "Admin Loket", role: "admin", jabatan: "Staff Admin" } as any;
const spvUser = { userId: "usr-spv-1", nama: "Supervisor SPV", role: "administrator", jabatan: "SVP" } as any;
const courierUser = { userId: "usr-courier-1", employeeId: "EMP-0004", nama: "Ahmad Kurir", role: "messenger" } as any;

// Helper function to advance an order smoothly through all standard lifecycle stages
function advanceOrderToCompletion(orderNo: string, isWalkIn: boolean = false, finalCostAmount?: number) {
  // Step 1 -> Step 2: Penjadwalan (if not Datang Langsung)
  if (!isWalkIn) {
    orderService.advanceOrder(orderNo, "Penjadwalan", {
      tanggalJemput: "2026-11-08",
      messenger: "Ahmad Kurir"
    }, adminUser);

    // Step 2 -> Step 3: Verifikasi Dokumen (requires pickup completed)
    orderService.advanceOrder(orderNo, "Verifikasi Dokumen", {
      pickupCompleted: true,
      messengerTaskStatus: "Dokumen Sudah Tersedia"
    }, adminUser);
  }

  // Step 3 -> Step 4: Proses Samsat (requires physical documents verified)
  orderService.advanceOrder(orderNo, "Proses Samsat", {
    documentsVerified: true
  }, adminUser);

  // Step 4 -> Step 5: Verifikasi Ulang (requires Samsat processes completed)
  const current = orderService.getByOrderNo(orderNo);
  const updatedSamsat = (current.samsatProcesses || []).map((p: any) => ({ ...p, status: "Selesai" }));
  orderService.advanceOrder(orderNo, "Verifikasi Ulang", {
    samsatProcesses: updatedSamsat,
    samsatCompletedAt: new Date().toISOString()
  }, adminUser);

  // Step 5 -> Step 6: Supervisi (requires cost verified)
  const costToVerify = finalCostAmount || current.payment?.totalBiaya || 750000;
  orderService.advanceOrder(orderNo, "Supervisi", {
    documentsVerified: true,
    isCostVerified: true,
    finalCost: costToVerify,
    documentApproval: { stage5Verified: true, stage5VerifiedAt: new Date().toISOString() } as any
  }, adminUser);

  // Step 6 -> Step 7: Pengantaran (requires SPV approval)
  orderService.advanceOrder(orderNo, "Pengantaran", {
    approvedBySpv: "Supervisor SPV",
    spvName: "Supervisor SPV",
    messengerPengantar: "Ahmad Kurir",
    deliveryMessengerId: "EMP-0004",
    documentApproval: { stage6Approved: true, stage6ApprovedAt: new Date().toISOString() } as any
  }, spvUser);

  // Step 7 -> Step 8: Dokumen Telah Diterima (Terminal Completion)
  const completedOrder = orderService.advanceOrder(orderNo, "Dokumen Telah Diterima", {
    penerimaDokumen: current.customer + " (Penerima Asli)",
    recipientName: current.customer + " (Penerima Asli)"
  }, adminUser);

  return completedOrder;
}

test("SUNBiroJasa End-to-End Business Scenarios Suite", async (t) => {
  const db = getDb();

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM B & MATRIX: ORD-001 (Standard Order -> Full Payment -> Complete -> Lunas)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-001: Standard Order, Full Payment, Complete -> Lunas", () => {
    // 1. Create Order with Full Payment at start (Bayar di Awal)
    const totalBiaya = 850000;
    const created = orderService.createOrder({
      customer: "Budi Santoso",
      namaPemilik: "Budi Santoso",
      nomorHP: "081234567890",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1001 BDS",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Datang Langsung",
      tipePembayaran: "Bayar di Awal",
      nominalPkbTerakhir: 550000,
      nominalSwdkllj: 143000,
      biayaJasa: 157000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: totalBiaya,
        statusPembayaran: "Lunas",
        isPaymentVerified: true
      }
    }, adminUser);

    assert.ok(created, "Order must be created successfully");
    const orderNo = created.orderNo;
    assert.strictEqual(created.customer, "Budi Santoso");
    assert.strictEqual(created.nopol, "B 1001 BDS");
    assert.strictEqual(created.currentStep, 3, "Datang Langsung starts at Step 3 (Verifikasi Dokumen)");

    // 2. Advance through lifecycle to Step 8
    const finalOrder = advanceOrderToCompletion(orderNo, true, totalBiaya);
    assert.strictEqual(finalOrder.currentStep, 8, "Order must reach Step 8");
    assert.strictEqual(finalOrder.currentStageName, "Dokumen Telah Diterima");

    // 3. Verify Financial Records
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
    assert.ok(invoice, "Invoice must exist in dbFinanceRepository");
    assert.strictEqual(invoice.totalTagihan, totalBiaya);
    assert.strictEqual(invoice.dibayar, totalBiaya);
    assert.strictEqual(invoice.sisa, 0);
    assert.strictEqual(invoice.status, "PAID");

    // 4. Verify Data Penjualan Projection before and after archive
    const contractRowUnarchived = projectOrderToContractRow(finalOrder, invoice, false);
    assert.strictEqual(contractRowUnarchived["Nama Customer"], "Budi Santoso");
    assert.strictEqual(contractRowUnarchived["Plat No"], "B 1001 BDS");
    assert.strictEqual(contractRowUnarchived["Uang Masuk dari Konsumen"], totalBiaya);
    assert.strictEqual(contractRowUnarchived["Status Pembayaran"], "Lunas");
    assert.strictEqual(contractRowUnarchived["Status Pengerjaan"], "Menunggu Arsip", "At Step 8 before archiving, status pengerjaan is Menunggu Arsip");

    // After archiving, status pengerjaan becomes Selesai
    const contractRowArchived = projectOrderToContractRow(finalOrder, invoice, true);
    assert.strictEqual(contractRowArchived["Status Pengerjaan"], "Selesai", "Once archived, status pengerjaan becomes Selesai");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM B & MATRIX: ORD-002 (Standard Order -> No Payment -> Complete -> Belum Bayar)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-002: Standard Order, No Payment, Complete -> Belum Bayar", () => {
    const totalBiaya = 750000;
    const created = orderService.createOrder({
      customer: "Dewi Lestari",
      namaPemilik: "Dewi Lestari",
      nomorHP: "081298765431",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 2002 DWL",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Antar Jemput",
      tipePembayaran: "Bayar di Akhir",
      biayaJasa: 150000,
      payment: {
        tipePembayaran: "Bayar di Akhir",
        metodePembayaran: "Tunai",
        totalBiaya: totalBiaya,
        dibayar: 0,
        statusPembayaran: "Belum Lunas"
      }
    }, adminUser);

    const orderNo = created.orderNo;
    assert.strictEqual(created.currentStep, 1, "Antar Jemput starts at Step 1");

    // Advance to completion
    const finalOrder = advanceOrderToCompletion(orderNo, false, totalBiaya);
    assert.strictEqual(finalOrder.currentStep, 8);

    // Verify Financial Records
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
    assert.ok(invoice, "Invoice must exist");
    assert.strictEqual(invoice.totalTagihan, totalBiaya);
    assert.strictEqual(invoice.dibayar, 0);
    assert.strictEqual(invoice.sisa, totalBiaya);
    assert.strictEqual(invoice.status, "UNPAID");

    // Verify Data Penjualan Projection
    const contractRow = projectOrderToContractRow(finalOrder, invoice, false);
    assert.strictEqual(contractRow["Nama Customer"], "Dewi Lestari");
    assert.strictEqual(contractRow["Uang Masuk dari Konsumen"], 0);
    assert.strictEqual(contractRow["Status Pembayaran"], "Belum Bayar");
    assert.strictEqual(contractRow["Status Pengerjaan"], "Menunggu Arsip");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM B & MATRIX: ORD-003 (Standard Order -> Partial Payment -> Complete -> Kurang Bayar)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-003: Standard Order, Partial Payment, Complete -> Kurang Bayar", () => {
    const totalBiaya = 1200000;
    const partialPaid = 500000;
    const sisa = 700000;

    const created = orderService.createOrder({
      customer: "Eko Prasetyo",
      namaPemilik: "Eko Prasetyo",
      nomorHP: "081333444555",
      layanan: "Balik Nama Kendaraan",
      nopol: "B 3003 EKP",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Antar Jemput",
      tipePembayaran: "Bayar di Awal",
      biayaJasa: 350000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: partialPaid,
        kurang: sisa,
        statusPembayaran: "Kurang Bayar"
      }
    }, adminUser);

    const orderNo = created.orderNo;
    const finalOrder = advanceOrderToCompletion(orderNo, false, totalBiaya);

    // Verify Financial Records
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
    assert.ok(invoice);
    assert.strictEqual(invoice.totalTagihan, totalBiaya);
    assert.strictEqual(invoice.dibayar, partialPaid);
    assert.strictEqual(invoice.sisa, sisa);
    assert.strictEqual(invoice.status, "PARTIAL");

    // Verify Data Penjualan Projection
    const contractRow = projectOrderToContractRow(finalOrder, invoice, false);
    assert.strictEqual(contractRow["Uang Masuk dari Konsumen"], partialPaid);
    assert.strictEqual(contractRow["Status Pembayaran"], "Kurang Bayar");
    assert.strictEqual(contractRow["Status Pengerjaan"], "Menunggu Arsip");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM E & MATRIX: ORD-004 (Full Payment -> Cashback Pending -> Complete)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-004: Standard Order, Full Payment, Cashback Pending -> Complete", () => {
    const totalBiaya = 900000;
    const cashbackNominal = 50000;

    const created = orderService.createOrder({
      customer: "Fajar Nugraha",
      namaPemilik: "Fajar Nugraha",
      nomorHP: "081555666777",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 4004 FJR",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Datang Langsung",
      biayaJasa: 150000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: totalBiaya,
        statusPembayaran: "Lunas"
      }
    }, adminUser);

    const orderNo = created.orderNo;
    advanceOrderToCompletion(orderNo, true, totalBiaya);

    // Set cashback on the invoice
    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    dbFinanceRepository.updateInvoice(inv.id, {
      cashback: cashbackNominal,
      cashbackStatus: "PENDING",
      cashbackPaidAmount: 0
    });

    // Verify invoice cashback status
    const updatedInv = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(updatedInv.cashback, cashbackNominal);
    assert.strictEqual(updatedInv.cashbackStatus, "PENDING");
    assert.strictEqual(updatedInv.cashbackPaidAmount, 0);

    // Verify in database that it is recorded as PENDING
    const dbRow = db.prepare("SELECT cashback_nominal, cashback_status FROM finance_invoices WHERE id = ?").get(inv.id) as any;
    assert.strictEqual(dbRow.cashback_nominal, cashbackNominal);
    assert.strictEqual(dbRow.cashback_status, "PENDING");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM E & MATRIX: ORD-005 (Full Payment -> Cashback Disbursed / Paid)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-005: Standard Order, Full Payment, Cashback Disbursed / Paid", () => {
    const totalBiaya = 950000;
    const cashbackNominal = 60000;

    const created = orderService.createOrder({
      customer: "Gilang Ramadhan",
      namaPemilik: "Gilang Ramadhan",
      nomorHP: "081666777888",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 5005 GLG",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Datang Langsung",
      biayaJasa: 150000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: totalBiaya,
        statusPembayaran: "Lunas"
      }
    }, adminUser);

    const orderNo = created.orderNo;
    advanceOrderToCompletion(orderNo, true, totalBiaya);

    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    dbFinanceRepository.updateInvoice(inv.id, {
      cashback: cashbackNominal,
      cashbackStatus: "PENDING"
    });

    // Disburse cashback via financeService.payoutCashback with required idempotencyKey and expectedVersion
    const payoutResult = financeService.payoutCashback(inv.id, {
      idempotencyKey: `IDEMP-CB-${Date.now()}-5005`,
      expectedVersion: 0,
      nominal: cashbackNominal,
      payoutType: "KOMISI",
      metode: "Transfer BCA",
      penerima: "Gilang Ramadhan",
      noRekening: "1234567890",
      bank: "BCA"
    }, adminUser);

    assert.ok(payoutResult, "Payout cashback must succeed");
    const settledInv = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(settledInv.cashbackStatus, "REALIZED", "Cashback status must be REALIZED");
    assert.strictEqual(settledInv.cashbackPaidAmount, cashbackNominal);

    // Verify cash ledger (kas_kantor) has recorded the outflow
    const kasOutflows = (db.prepare("SELECT * FROM kas_kantor WHERE status = 'Kredit' AND kredit = ?").all(cashbackNominal) as any[]);
    assert.ok(kasOutflows.length > 0, "Cash outflow must be booked in kas_kantor for disbursed cashback");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM E & MATRIX: ORD-006 (Partial Payment -> Cashback Pending)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-006: Partial Payment + Cashback Pending -> Kurang Bayar + Pending", () => {
    const totalBiaya = 1500000;
    const partialPaid = 700000;
    const cashbackNominal = 45000;

    const created = orderService.createOrder({
      customer: "Hani Handayani",
      namaPemilik: "Hani Handayani",
      nomorHP: "081777888999",
      layanan: "Balik Nama Kendaraan",
      nopol: "B 6006 HNI",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Datang Langsung",
      biayaJasa: 350000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: partialPaid,
        kurang: 800000,
        statusPembayaran: "Kurang Bayar"
      }
    }, adminUser);

    const orderNo = created.orderNo;
    advanceOrderToCompletion(orderNo, true, totalBiaya);

    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    dbFinanceRepository.updateInvoice(inv.id, {
      cashback: cashbackNominal,
      cashbackStatus: "PENDING"
    });

    const checkedInv = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(checkedInv.status, "PARTIAL", "Invoice status must be PARTIAL");
    assert.strictEqual(checkedInv.sisa, 800000);
    assert.strictEqual(checkedInv.cashbackStatus, "PENDING", "Cashback must remain PENDING");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM E & G: ORD-007 (Financial Separation: Cashback Payout vs Customer Payment)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-007: Financial Separation: Cashback Paid Does NOT Reduce Outstanding Customer Debt", () => {
    const totalBiaya = 1000000;
    const customerPaid = 400000;
    const expectedDebt = 600000;
    const cashbackMitra = 50000;

    const created = orderService.createOrder({
      customer: "Indra Kusuma",
      namaPemilik: "Indra Kusuma",
      nomorHP: "081888999000",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 7007 IND",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Datang Langsung",
      biayaJasa: 150000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: customerPaid,
        kurang: expectedDebt,
        statusPembayaran: "Kurang Bayar"
      }
    }, adminUser);

    const orderNo = created.orderNo;
    advanceOrderToCompletion(orderNo, true, totalBiaya);

    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    dbFinanceRepository.updateInvoice(inv.id, {
      cashback: cashbackMitra,
      cashbackStatus: "PENDING"
    });

    // Payout the cashback with required idempotencyKey and expectedVersion
    financeService.payoutCashback(inv.id, {
      idempotencyKey: `IDEMP-CB-${Date.now()}-7007`,
      expectedVersion: 0,
      nominal: cashbackMitra,
      payoutType: "KOMISI",
      metode: "Transfer BCA",
      penerima: "Mitra Indra",
      noRekening: "9876543210",
      bank: "BCA"
    }, adminUser);

    // CRITICAL ASSERTION: The customer's debt must REMAIN 600.000!
    // Cashback paid is an operational expense/cash outflow, NOT a credit against customer invoice receivables.
    const reloadedInv = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(reloadedInv.dibayar, customerPaid, "Customer paid amount must NOT be altered by cashback payout");
    assert.strictEqual(reloadedInv.sisa, expectedDebt, "Customer debt must remain exactly 600.000");
    assert.strictEqual(reloadedInv.cashbackPaidAmount, cashbackMitra);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM B & MATRIX: ORD-008 (Multiple Service Variations)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-008: Multiple Service Variations & Canonical Sales Category Mapping", () => {
    // 1. Perpanjangan 1 Tahun (Mobil)
    const o1 = orderService.createOrder({
      customer: "Svc Client 1",
      nomorHP: "081100000001",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 8001 SVC",
      jenisKendaraan: "Mobil",
      metodeLayanan: "Datang Langsung",
      payment: { totalBiaya: 600000, dibayar: 600000, statusPembayaran: "Lunas" }
    }, adminUser);
    assert.strictEqual(resolveOrderSalesCategory(o1.layanan, (o1 as any).serviceId), "perpanjangan-1-tahun");

    // 2. Balik Nama (BBN-KB)
    const o2 = orderService.createOrder({
      customer: "Svc Client 2",
      nomorHP: "081100000002",
      layanan: "Balik Nama Kendaraan",
      nopol: "B 8002 SVC",
      jenisKendaraan: "Mobil",
      metodeLayanan: "Datang Langsung",
      payment: { totalBiaya: 1800000, dibayar: 1800000, statusPembayaran: "Lunas" }
    }, adminUser);
    assert.strictEqual(resolveOrderSalesCategory(o2.layanan, (o2 as any).serviceId), "balik-nama");

    // 3. Mutasi Keluar
    const o3 = orderService.createOrder({
      customer: "Svc Client 3",
      nomorHP: "081100000003",
      layanan: "Mutasi Keluar",
      nopol: "B 8003 SVC",
      samsatAsalId: "samsat-jakarta-timur",
      samsatTujuanId: "samsat-bandung",
      metodeLayanan: "Datang Langsung",
      payment: { totalBiaya: 2200000, dibayar: 2200000, statusPembayaran: "Lunas" }
    }, adminUser);
    assert.strictEqual(resolveOrderSalesCategory(o3.layanan, (o3 as any).serviceId), "mutasi-antar-daerah");

    // 4. Duplikat STNK (STNK Hilang)
    const o4 = orderService.createOrder({
      customer: "Svc Client 4",
      nomorHP: "081100000004",
      layanan: "Duplikat STNK",
      nopol: "B 8004 SVC",
      metodeLayanan: "Datang Langsung",
      payment: { totalBiaya: 500000, dibayar: 500000, statusPembayaran: "Lunas" }
    }, adminUser);
    assert.strictEqual(resolveOrderSalesCategory(o4.layanan, (o4 as any).serviceId), "duplikat-stnk");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM B & MATRIX: ORD-009 (Optional Fields Handling)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-009: Optional Fields Omitted -> Order Successfully Created without Corrupting State", () => {
    // Only required fields supplied; all optional fields omitted
    const created = orderService.createOrder({
      customer: "Minimalist Client",
      nomorHP: "081999999999",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 9999 MIN",
      payment: {
        totalBiaya: 700000,
        dibayar: 0
      }
    }, adminUser);

    assert.ok(created, "Order must be created successfully");
    assert.strictEqual(created.customer, "Minimalist Client");
    assert.strictEqual(created.namaPemilik, "");
    assert.strictEqual(created.alamatPenjemputan.detail, "Alamat penjemputan belum diisi");
    assert.strictEqual(created.alamatPengantaran.detail, "Alamat pengantaran belum diisi");
    assert.ok(created.clientDocuments, "Client documents structure must exist");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM F & MATRIX: ORD-010 (Multiple Staged Payments & Balance Reconciliation)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-010: Staged Payments Reconciliation (1.000.000 -> 300.000 -> 200.000 -> 500.000 -> Lunas)", () => {
    const totalTagihan = 1000000;
    const created = orderService.createOrder({
      customer: "Joko Widodo",
      nomorHP: "081233221100",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1010 JKW",
      metodeLayanan: "Datang Langsung",
      payment: {
        totalBiaya: totalTagihan,
        dibayar: 0
      }
    }, adminUser);

    const orderNo = created.orderNo;
    advanceOrderToCompletion(orderNo, true, totalTagihan);

    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    assert.strictEqual(inv.totalTagihan, totalTagihan);

    // Stage 1: First Payment 300.000
    dbFinanceRepository.recordInvoicePayment({
      invoiceNo: inv.invoiceNo,
      orderNo,
      nominal: 300000,
      metodePembayaran: "Transfer BCA",
      tanggalBayar: "2026-11-08",
      statusVerifikasi: "TERVERIFIKASI"
    });
    dbFinanceRepository.updateInvoice(inv.id, {
      dibayar: 300000,
      sisa: 700000,
      status: "PARTIAL"
    });
    let invCheck = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(invCheck.dibayar, 300000);
    assert.strictEqual(invCheck.sisa, 700000);
    assert.strictEqual(invCheck.status, "PARTIAL");

    // Stage 2: Second Payment 200.000
    dbFinanceRepository.recordInvoicePayment({
      invoiceNo: inv.invoiceNo,
      orderNo,
      nominal: 200000,
      metodePembayaran: "Transfer BCA",
      tanggalBayar: "2026-11-08",
      statusVerifikasi: "TERVERIFIKASI"
    });
    dbFinanceRepository.updateInvoice(inv.id, {
      dibayar: 500000,
      sisa: 500000,
      status: "PARTIAL"
    });
    invCheck = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(invCheck.dibayar, 500000);
    assert.strictEqual(invCheck.sisa, 500000);
    assert.strictEqual(invCheck.status, "PARTIAL");

    // Stage 3: Third Payment 500.000 (Settlement)
    dbFinanceRepository.recordInvoicePayment({
      invoiceNo: inv.invoiceNo,
      orderNo,
      nominal: 500000,
      metodePembayaran: "Tunai",
      tanggalBayar: "2026-11-08",
      statusVerifikasi: "TERVERIFIKASI"
    });
    dbFinanceRepository.updateInvoice(inv.id, {
      dibayar: 1000000,
      sisa: 0,
      status: "PAID"
    });
    invCheck = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(invCheck.dibayar, 1000000);
    assert.strictEqual(invCheck.sisa, 0);
    assert.strictEqual(invCheck.status, "PAID");

    // Verify all 3 payment records are persisted
    const payments = dbFinanceRepository.getPaymentsByOrderNo(orderNo);
    assert.strictEqual(payments.length, 3, "Exactly 3 payment transaction records must be stored");
    const sumPayments = payments.reduce((acc, p) => acc + p.nominal, 0);
    assert.strictEqual(sumPayments, 1000000, "Sum of all payment records must match invoice total");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM B & MATRIX: ORD-011 (Invalid Input & Boundary Rejection)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-011: Invalid Input Rejection (Missing Required Fields, Inactive Services)", () => {
    // 1. Missing customer
    assert.throws(
      () => orderService.createOrder({ nomorHP: "081200000000", layanan: "Perpanjangan STNK Tahunan", nopol: "B 1111 ERR" }, adminUser),
      (err: any) => err.code === "VALIDATION_ERROR"
    );

    // 2. Missing nopol
    assert.throws(
      () => orderService.createOrder({ customer: "Err Client", nomorHP: "081200000000", layanan: "Perpanjangan STNK Tahunan" }, adminUser),
      (err: any) => err.code === "VALIDATION_ERROR"
    );

    // 3. Invalid inactive service ID
    assert.throws(
      () => orderService.createOrder({
        customer: "Err Client",
        nomorHP: "081200000000",
        layanan: "Invalid Service Name",
        serviceId: "svc-invalid-999",
        nopol: "B 1111 ERR",
        payment: { totalBiaya: 750000, dibayar: 0 }
      }, adminUser),
      (err: any) => err.code === "INVALID_SERVICE"
    );

    // 4. Illegal stage skip (Step 1 -> Step 8 directly)
    const o = orderService.createOrder({
      customer: "Skip Client",
      nomorHP: "081200000000",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 2222 SKP",
      payment: { totalBiaya: 750000, dibayar: 0 }
    }, adminUser);
    assert.throws(
      () => orderService.advanceOrder(o.orderNo, "Dokumen Telah Diterima", {}, adminUser),
      (err: any) => err.code === "INVALID_STAGE_TRANSITION"
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM B & MATRIX: ORD-012 (Duplicate Submission & Anti-Double Payment Prevention)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-012: Duplicate Submission & Anti-Double Payment Prevention", () => {
    const clientRequestId = `REQ-DUP-${Date.now()}`;
    const payload = {
      clientRequestId,
      customer: "Kiki Amalia",
      nomorHP: "081288887777",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1212 DUP",
      payment: { totalBiaya: 750000, dibayar: 0 }
    };

    // First submission
    const res1 = orderService.createOrderWithIdempotency(payload, adminUser, clientRequestId);
    assert.strictEqual(res1.isExisting, false);
    const orderNo = res1.order.orderNo;

    // Duplicate submission with identical clientRequestId
    const res2 = orderService.createOrderWithIdempotency(payload, adminUser, clientRequestId);
    assert.strictEqual(res2.isExisting, true, "Second submission must be flagged as existing");
    assert.strictEqual(res2.order.orderNo, orderNo, "Must return the identical order without duplication");

    // Count in DB to prove zero duplicates
    const dbCount = (db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE nopol = 'B 1212 DUP'").get() as any).cnt;
    assert.strictEqual(dbCount, 1, "Only 1 order record must exist in the database");

    // Anti-Double Payment: Attempting payment on already paid invoice
    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    dbFinanceRepository.updateInvoice(inv.id, { status: "PAID", dibayar: 750000, sisa: 0 });
    assert.throws(
      () => financeService.recordPayment(inv.id, 50000, { metode: "Cash" }, adminUser),
      (err: any) => err.code === "INVOICE_ALREADY_PAID"
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM E & F: ORD-013 (Order Cancellation with Deposit -> Refund Disbursed)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("ORD-013: Cancelled Order with Deposit -> Refund Liability Routed to Cashback Terpending -> Disbursed", () => {
    const depositAmount = 500000;
    const totalBiaya = 1200000;

    // 1. Create Order with partial deposit
    const created = orderService.createOrder({
      customer: "Lina Marlina",
      nomorHP: "081912345678",
      layanan: "Balik Nama Kendaraan",
      nopol: "B 1313 CAN",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      metodeLayanan: "Datang Langsung",
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalBiaya,
        dibayar: depositAmount,
        kurang: 700000,
        statusPembayaran: "Kurang Bayar"
      }
    }, adminUser);

    const orderNo = created.orderNo;
    const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    assert.strictEqual(inv.dibayar, depositAmount);

    // 2. Cancel Order
    const cancelled = orderService.cancelOrder(orderNo, "Kendaraan batal dibeli oleh konsumen", adminUser);
    assert.strictEqual(cancelled.currentStageName, "Dibatalkan");
    assert.strictEqual((cancelled as any).isCancelled, true);

    // 3. Verify Invoice state: marked CANCELLED with overpayment refund liability
    const cancelledInv = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(cancelledInv.status, "CANCELLED");
    assert.strictEqual(cancelledInv.overpayment, depositAmount);
    assert.strictEqual(cancelledInv.refundStatus, "PENDING");

    // 4. Verify Data Penjualan row
    const contractRow = projectOrderToContractRow(cancelled, cancelledInv, false);
    assert.strictEqual(contractRow["Status Pengerjaan"], "Dibatalkan");
    assert.strictEqual(contractRow["Status Pembayaran"], "Dibatalkan");

    // 5. Verify Refund Payout via financeService.payoutCashback
    const refundPayout = financeService.payoutCashback(inv.id, {
      idempotencyKey: `IDEMP-REFUND-${Date.now()}-1313`,
      expectedVersion: 0,
      nominal: depositAmount,
      payoutType: "KELEBIHAN",
      metode: "Transfer BCA",
      penerima: "Lina Marlina",
      noRekening: "1122334455",
      bank: "BCA"
    }, adminUser);

    assert.ok(refundPayout, "Refund payout must succeed");
    const settledRefundInv = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(settledRefundInv.refundStatus, "PROCESSED");

    // 6. Verify cash outflow booked in kas_kantor
    const kasOutflows = (db.prepare("SELECT * FROM kas_kantor WHERE status = 'Kredit' AND kredit = ?").all(depositAmount) as any[]);
    assert.ok(kasOutflows.length > 0, "Cash outflow must be booked in kas_kantor for refunded deposit");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM H: DATA PERSISTENCE & RELOAD REVERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("WORKSTREAM H: Complete Persistence Re-verification Across Entire Test Suite", () => {
    // Assert all created orders and invoices are truly persisted in SQLite
    const orderNos = ["B 1001 BDS", "B 2002 DWL", "B 3003 EKP", "B 4004 FJR", "B 5005 GLG", "B 6006 HNI", "B 7007 IND", "B 1010 JKW", "B 1212 DUP", "B 1313 CAN"];
    for (const nopol of orderNos) {
      const row = db.prepare("SELECT * FROM orders WHERE nopol = ?").get(nopol) as any;
      assert.ok(row, `Order for nopol ${nopol} must be durably persisted in SQLite`);
      assert.ok(row.order_no, "Order must possess canonical order_no");

      const invRow = db.prepare("SELECT * FROM finance_invoices WHERE order_no = ?").get(row.order_no) as any;
      assert.ok(invRow, `Finance invoice for ${row.order_no} must be durably persisted in SQLite`);
    }
  });
});
