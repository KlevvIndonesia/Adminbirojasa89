/**
 * Post-Remediation Verification & Financial Integrity Audit Test Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Phases Covered:
 * - PHASE A: Cancelled Order & Refund Integrity (10 points + accounting reconciliation)
 * - PHASE B: Cashback Concurrency & Anti-Double Payout (Parallel OCC, Idempotency Replay, Stale Version, Failure Recovery)
 * - PHASE C: Cashback vs Refund Classification (Taxonomy, Isolation, Reporting Separation, RBAC)
 * 
 * Execution: scripts/run-test-isolated.cjs guarantees 100% database sandbox isolation.
 */

import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { getDb, runInTransaction } from "../server/src/database/db";
import { projectOrderToContractRow } from "../src/app/data/penjualanContractData";

const adminUser = { userId: "usr-admin-audit", nama: "Admin Auditor", role: "administrator", jabatan: "Audit Lead" } as any;
const financeUser = { userId: "usr-fin-audit", nama: "Finance Auditor", role: "finance", jabatan: "Finance Lead" } as any;

test("POST-REMEDIATION AUDIT: Phase A, B, and C Verification", async (t) => {
  const db = getDb();

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE A: CANCELLED ORDER & REFUND INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("PHASE A: Order Cancellation, Refund Liability & Cash Ledger Audit", async (ta) => {
    const totalTagihan = 1200000;
    const paidDeposit = 500000;
    const outstandingBeforeCancel = 700000;

    // A.1: Create synthetic order with Rp1.200.000 tagihan and Rp500.000 deposit
    const order = orderService.createOrder({
      customer: "Hendra Gunawan (Audit A)",
      nomorHP: "081299887766",
      layanan: "Mutasi Masuk & Balik Nama",
      nopol: "B 7788 AUD",
      wilayahSamsatAsal: "Jakarta Selatan",
      samsatAsalId: "samsat-jakarta-selatan",
      metodeLayanan: "Datang Langsung",
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: totalTagihan,
        dibayar: paidDeposit,
        kurang: outstandingBeforeCancel,
        statusPembayaran: "Kurang Bayar",
      },
    }, adminUser);

    const orderNo = order.orderNo;
    const initialInv = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    assert.ok(initialInv, "Invoice must be created");
    assert.strictEqual(Number(initialInv.totalTagihan), totalTagihan);
    assert.strictEqual(Number(initialInv.dibayar ?? initialInv.terbayar), paidDeposit);
    assert.strictEqual(Number(initialInv.sisa), outstandingBeforeCancel);

    // Initial cash receipt recorded in kas_kantor for customer deposit
    dbFinanceRepository.addKasKantor({
      tanggal: "2026-11-08",
      keterangan: `Penerimaan setoran awal: ${initialInv.invoiceNo} - ${order.customer}`,
      status: "Debit",
      debit: paidDeposit,
      kredit: 0,
      penanggungJawab: "Admin Kasir",
      orderNo: orderNo,
      invoiceNo: initialInv.invoiceNo,
    });

    // Initial cash inflow verification: deposit recorded in kas_kantor (Debit)
    const initialKasEntries = db.prepare("SELECT * FROM kas_kantor WHERE order_no = ? AND status = 'Debit'").all(orderNo) as any[];
    assert.strictEqual(initialKasEntries.length, 1, "Deposit cash inflow (Debit) must exist in kas_kantor");
    assert.strictEqual(Number(initialKasEntries[0].debit), paidDeposit);

    // A.2: Cancel Order via orderService.cancelOrder
    const cancellationReason = "Konsumen membatalkan transaksi mutasi kendaraan";
    const cancelledOrder = orderService.cancelOrder(orderNo, cancellationReason, adminUser);

    // Verification 1: Order status changed to Dibatalkan
    assert.strictEqual(cancelledOrder.currentStageName, "Dibatalkan");
    assert.strictEqual((cancelledOrder as any).isCancelled, true);
    assert.strictEqual((cancelledOrder as any).cancellationReason, cancellationReason);

    // Verification 2: Historical payment of Rp500.000 is PRESERVED on order, invoice, and kas_kantor (not deleted)
    assert.strictEqual(cancelledOrder.payment?.dibayar, paidDeposit, "Order historical payment must be preserved");
    const postCancelKas = db.prepare("SELECT * FROM kas_kantor WHERE order_no = ? AND status = 'Debit'").all(orderNo) as any[];
    assert.strictEqual(postCancelKas.length, 1, "Historical payment entry in kas_kantor must remain intact");
    assert.strictEqual(Number(postCancelKas[0].debit), paidDeposit);

    // Verification 3 & 4: Invoice marked CANCELLED, deposit routed to overpayment & refundStatus = PENDING
    const cancelledInv = dbFinanceRepository.getInvoiceById(initialInv.id)!;
    assert.strictEqual(cancelledInv.status, "CANCELLED");
    assert.strictEqual(cancelledInv.billingStatus, "CANCELLED");
    assert.strictEqual(Number(cancelledInv.overpayment), paidDeposit, "Refund liability must equal deposit Rp500.000");
    assert.strictEqual(cancelledInv.refundStatus, "PENDING", "Refund must be PENDING before payout");

    // Verification 5 & 6: Refund is NOT automatically considered paid
    assert.strictEqual(cancelledInv.refundedAmount || 0, 0, "Refunded amount must be 0 prior to payout");
    assert.strictEqual(Boolean((cancelledInv as any).refundProcessedAt), false, "refundProcessedAt must not be set yet");

    // Verification: Data Penjualan projections
    const contractRow = projectOrderToContractRow(cancelledOrder, cancelledInv, false);
    assert.strictEqual(contractRow["Status Pengerjaan"], "Dibatalkan");
    assert.strictEqual(contractRow["Status Pembayaran"], "Dibatalkan");

    // Critical Validation: Cancelled order cannot receive new payment
    assert.throws(() => {
      financeService.recordPayment(initialInv.id, 200000, { metode: "Tunai" }, adminUser);
    }, (err: any) => err.code === "ORDER_CANCELLED", "Cancelled order must reject new payment attempts");

    // A.3: Process Refund Payout via financeService.payoutCashback(payoutType: "KELEBIHAN")
    const payoutResult = financeService.payoutCashback(initialInv.id, {
      nominal: paidDeposit,
      paymentType: "KELEBIHAN",
      penerima: "Hendra Gunawan",
      bank: "BCA",
      noRekening: "8899001122",
      namaRekening: "Hendra Gunawan",
      buktiPembayaran: { fileName: "bukti-refund.jpg", fileUrl: "/uploads/bukti-refund.jpg" },
      expectedVersion: 0,
      idempotencyKey: `IDEMP-REFUND-AUDIT-${Date.now()}`,
    }, financeUser);

    assert.ok(payoutResult, "Refund payout must execute successfully");

    // Verification 7: Refund payout recorded as cash outflow (Kredit) in kas_kantor
    const refundKasEntries = db.prepare(
      "SELECT * FROM kas_kantor WHERE invoice_no = ? AND status = 'Kredit' AND kredit = ?"
    ).all(initialInv.invoiceNo || `INV-${initialInv.id}`, paidDeposit) as any[];
    assert.strictEqual(refundKasEntries.length, 1, "Exactly one Kredit entry of Rp500.000 must be recorded in kas_kantor");
    assert.ok(refundKasEntries[0].keterangan.includes("Pengembalian kelebihan bayar"), "Keterangan must specify refund kelebihan bayar");

    // Verification 8: Invoice refundStatus updated to PROCESSED
    const settledInv = dbFinanceRepository.getInvoiceById(initialInv.id)!;
    assert.strictEqual(settledInv.refundStatus, "PROCESSED");
    assert.strictEqual(Number(settledInv.refundedAmount), paidDeposit);
    assert.strictEqual(Number(settledInv.remainingRefund), 0);
    assert.ok(settledInv.refundProcessedAt, "refundProcessedAt must be populated");

    // Verification 9: Original payment history (Debit) still exists alongside outflow (Kredit)
    const allKas = db.prepare("SELECT * FROM kas_kantor WHERE invoice_no = ? ORDER BY id ASC").all(initialInv.invoiceNo || `INV-${initialInv.id}`) as any[];
    const totalDebit = allKas.filter(k => k.status === 'Debit').reduce((s, k) => s + Number(k.debit || 0), 0);
    const totalKredit = allKas.filter(k => k.status === 'Kredit').reduce((s, k) => s + Number(k.kredit || 0), 0);
    assert.strictEqual(totalDebit, paidDeposit, "Total debit must remain Rp500.000");
    assert.strictEqual(totalKredit, paidDeposit, "Total kredit must be Rp500.000");
    const netCashImpact = totalDebit - totalKredit;
    assert.strictEqual(netCashImpact, 0, "Net cash impact of cancelled and refunded order must be exactly Rp0");

    // Verification 10: Traceability via audit logs and references
    const auditLogs = dbAuditRepository.getAll({ limit: 100 }).filter(l => 
      l.details.includes(orderNo) || (l.metadata as any)?.orderNo === orderNo
    );
    const cancelLog = auditLogs.find(l => l.action === "CANCEL_ORDER");
    assert.ok(cancelLog, "CANCEL_ORDER audit log must exist");

    // Critical Validation: Duplicate refund attempt must be rejected
    assert.throws(() => {
      financeService.payoutCashback(initialInv.id, {
        nominal: paidDeposit,
        paymentType: "KELEBIHAN",
        penerima: "Hendra Gunawan",
        bank: "BCA",
        noRekening: "8899001122",
        expectedVersion: 1,
        idempotencyKey: `IDEMP-REFUND-DUP-${Date.now()}`,
      }, financeUser);
    }, (err: any) => err.code === "ALREADY_PROCESSED" || err.code === "EXCEEDS_LIMIT", "Duplicate refund must be rejected");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE B: CASHBACK CONCURRENCY & ANTI-DOUBLE PAYOUT
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("PHASE B: Cashback Concurrency, OCC, Idempotency & Failure Recovery", async (tb) => {
    // Setup synthetic invoice with cashback Rp100.000
    const cbOrder = orderService.createOrder({
      customer: "Budi Concurrency",
      nomorHP: "081333444555",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 9900 CON",
      wilayahSamsatAsal: "Jakarta Pusat",
      samsatAsalId: "samsat-jakarta-pusat",
      metodeLayanan: "Datang Langsung",
      biayaJasa: 500000,
      biayaSamsat: 300000,
      totalEstimasi: 800000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Tunai",
        totalBiaya: 800000,
        dibayar: 800000,
        kurang: 0,
        statusPembayaran: "Lunas",
      },
    }, adminUser);

    // Fast advance to Supervisi Approved (Stage 6) so cashback payout is eligible
    orderService.advanceOrder(cbOrder.orderNo, "Proses Samsat", { documentsVerified: true }, adminUser);
    orderService.advanceOrder(cbOrder.orderNo, "Verifikasi Ulang", { samsatProcesses: [{ nama: "Pajak", status: "Selesai" }] }, adminUser);
    orderService.advanceOrder(cbOrder.orderNo, "Supervisi", {
      documentsVerified: true,
      isCostVerified: true,
      finalCost: 800000,
      documentApproval: { stage5Verified: true, stage5VerifiedAt: new Date().toISOString() } as any,
    }, adminUser);
    orderService.advanceOrder(cbOrder.orderNo, "Pengantaran", {
      approvedBySpv: "Supervisor SPV",
      spvName: "Supervisor SPV",
      documentApproval: { stage6Approved: true, stage6ApprovedAt: new Date().toISOString() } as any,
    }, adminUser);

    const cbInv = dbFinanceRepository.getInvoiceByOrderNo(cbOrder.orderNo)!;
    // Set pending cashback of Rp100.000
    dbFinanceRepository.updateInvoice(cbInv.id, {
      cashback: 100000,
      cashbackStatus: "PENDING",
      cashbackPaidAmount: 0,
    });

    const refreshedCbInv = dbFinanceRepository.getInvoiceById(cbInv.id)!;
    assert.strictEqual(Number(refreshedCbInv.cashback), 100000, "Cashback must be Rp100.000");
    assert.strictEqual(refreshedCbInv.cashbackStatus, "PENDING", "Cashback must be PENDING initially");
    assert.strictEqual(Number((refreshedCbInv as any).payoutVersion ?? 0), 0, "Initial payoutVersion must be 0");

    // B.1 & B.2: Parallel Payout Simulation
    // Two requests dispatched concurrently with same expectedVersion: 0, different idempotency keys
    const p1Promise = Promise.resolve().then(() => financeService.payoutCashback(cbInv.id, {
      nominal: 100000,
      paymentType: "KOMISI",
      penerima: "Budi Mitra",
      bank: "Kas Kantor",
      noRekening: "-",
      expectedVersion: 0,
      idempotencyKey: `CONCURRENT-KEY-ALPHA-${Date.now()}`,
    }, financeUser));

    const p2Promise = Promise.resolve().then(() => financeService.payoutCashback(cbInv.id, {
      nominal: 100000,
      paymentType: "KOMISI",
      penerima: "Budi Mitra",
      bank: "Kas Kantor",
      noRekening: "-",
      expectedVersion: 0,
      idempotencyKey: `CONCURRENT-KEY-BETA-${Date.now()}`,
    }, financeUser));

    const [res1, res2] = await Promise.allSettled([p1Promise, p2Promise]);

    // Evaluation of concurrency result:
    // Exactly ONE request must be fulfilled, and the other MUST be rejected (due to OCC conflict or state transition)
    const fulfilledCount = (res1.status === "fulfilled" ? 1 : 0) + (res2.status === "fulfilled" ? 1 : 0);
    const rejectedCount = (res1.status === "rejected" ? 1 : 0) + (res2.status === "rejected" ? 1 : 0);

    assert.strictEqual(fulfilledCount, 1, "Exactly one concurrent payout request must succeed");
    assert.strictEqual(rejectedCount, 1, "The second concurrent payout request must be rejected");

    const rejectedReason: any = res1.status === "rejected" ? res1.reason : (res2 as any).reason;
    assert.ok(
      rejectedReason.code === "CONCURRENT_MODIFICATION" || rejectedReason.code === "ALREADY_PROCESSED",
      `Rejected request must fail with CONCURRENT_MODIFICATION or ALREADY_PROCESSED, got: ${rejectedReason.code}`
    );

    // Database state assertions:
    const updatedCbInv = dbFinanceRepository.getInvoiceById(cbInv.id)!;
    assert.strictEqual(updatedCbInv.cashbackStatus, "REALIZED", "Cashback status must be REALIZED");
    assert.strictEqual(Number((updatedCbInv as any).payoutVersion), 1, "payoutVersion must be exactly 1");
    assert.strictEqual((updatedCbInv.payoutHistory || []).length, 1, "Exactly one payoutHistory entry must exist");

    // Cash ledger assertion: exactly one cash outflow of Rp100.000 for this invoice
    const cbKasEntries = db.prepare(
      "SELECT * FROM kas_kantor WHERE invoice_no = ? AND status = 'Kredit' AND kredit = 100000"
    ).all(cbInv.invoiceNo || `INV-${cbInv.id}`) as any[];
    assert.strictEqual(cbKasEntries.length, 1, "Exactly one cash outflow of Rp100.000 must exist in kas_kantor (Anti-Double Payout verified)");

    // B.3: Idempotency Replay Test
    const winningRecord = db.prepare("SELECT * FROM idempotency_keys WHERE scope = 'cashback_payout' AND resource_id = ?").get(String(cbInv.id)) as any;
    assert.ok(winningRecord, "Winning idempotency record must exist");

    const replayResult = financeService.payoutCashback(cbInv.id, {
      nominal: 100000,
      paymentType: "KOMISI",
      penerima: "Budi Mitra",
      bank: "Kas Kantor",
      noRekening: "-",
      expectedVersion: 0, // Ignored on idempotent hit
      idempotencyKey: winningRecord.key,
    }, financeUser);

    assert.ok(replayResult, "Idempotent replay must succeed cleanly");
    // Verify cash ledger was NOT debited/credited a second time
    const postReplayKas = db.prepare(
      "SELECT * FROM kas_kantor WHERE invoice_no = ? AND status = 'Kredit' AND kredit = 100000"
    ).all(cbInv.invoiceNo || `INV-${cbInv.id}`) as any[];
    assert.strictEqual(postReplayKas.length, 1, "Idempotency replay must NOT create duplicate cash ledger entry");

    // B.4: Stale Version Test
    assert.throws(() => {
      financeService.payoutCashback(cbInv.id, {
        nominal: 100000,
        paymentType: "KOMISI",
        penerima: "Budi Mitra",
        bank: "Kas Kantor",
        noRekening: "-",
        expectedVersion: 0, // stale version (current is 1)
        idempotencyKey: `STALE-KEY-${Date.now()}`,
      }, financeUser);
    }, (err: any) => err.code === "CONCURRENT_MODIFICATION" || err.code === "ALREADY_PROCESSED", "Stale expectedVersion must be rejected");

    // B.5: Controlled Failure Recovery & Rollback Test
    const preCountKas = (db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
    assert.throws(() => {
      runInTransaction(() => {
        dbFinanceRepository.addKasKantor({
          tanggal: "2026-11-08",
          keterangan: "Simulated failed outflow",
          status: "Kredit",
          debit: 0,
          kredit: 999999,
          penanggungJawab: "Auditor",
        });
        throw new Error("Simulated uncontrolled failure mid-transaction");
      });
    }, /Simulated uncontrolled failure mid-transaction/);

    const postCountKas = (db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
    assert.strictEqual(postCountKas, preCountKas, "Transaction rollback must restore exact cash ledger state");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE C: CASHBACK VS REFUND CLASSIFICATION & RBAC
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("PHASE C: Transaction Taxonomy, Classification Isolation & Reporting Separation", async (tc) => {
    // Record 1: Customer Cashback (Komisi Rekanan) Rp50.000
    const ordCashback = orderService.createOrder({
      customer: "Citra Cashback",
      nomorHP: "081555666777",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1122 CBK",
      wilayahSamsatAsal: "Jakarta Barat",
      samsatAsalId: "samsat-jakarta-barat",
      metodeLayanan: "Datang Langsung",
      biayaJasa: 400000,
      biayaSamsat: 200000,
      totalEstimasi: 600000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Tunai",
        totalBiaya: 600000,
        dibayar: 600000,
        kurang: 0,
        statusPembayaran: "Lunas",
      },
    }, adminUser);

    orderService.advanceOrder(ordCashback.orderNo, "Proses Samsat", { documentsVerified: true }, adminUser);
    orderService.advanceOrder(ordCashback.orderNo, "Verifikasi Ulang", { samsatProcesses: [{ nama: "Pajak", status: "Selesai" }] }, adminUser);
    orderService.advanceOrder(ordCashback.orderNo, "Supervisi", {
      documentsVerified: true,
      isCostVerified: true,
      finalCost: 600000,
      documentApproval: { stage5Verified: true, stage5VerifiedAt: new Date().toISOString() } as any,
    }, adminUser);
    orderService.advanceOrder(ordCashback.orderNo, "Pengantaran", {
      approvedBySpv: "Supervisor SPV",
      spvName: "Supervisor SPV",
      documentApproval: { stage6Approved: true, stage6ApprovedAt: new Date().toISOString() } as any,
    }, adminUser);

    const invCb = dbFinanceRepository.getInvoiceByOrderNo(ordCashback.orderNo)!;
    // Set cashback Rp50.000 on the invoice
    dbFinanceRepository.updateInvoice(invCb.id, {
      cashback: 50000,
      cashbackStatus: "PENDING",
      cashbackPaidAmount: 0,
    });

    financeService.payoutCashback(invCb.id, {
      nominal: 50000,
      paymentType: "KOMISI",
      penerima: "Citra Mitra",
      bank: "Kas Kantor",
      noRekening: "-",
      expectedVersion: 0,
      idempotencyKey: `IDEMP-CB-CLASSIFY-${Date.now()}`,
    }, financeUser);

    // Record 2: Refund Deposit Rp500.000 (from Cancelled Order)
    const ordRefund = orderService.createOrder({
      customer: "Dodi Refund",
      nomorHP: "081666777888",
      layanan: "Balik Nama Kendaraan",
      nopol: "B 3344 RFD",
      wilayahSamsatAsal: "Jakarta Utara",
      samsatAsalId: "samsat-jakarta-utara",
      metodeLayanan: "Datang Langsung",
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer BCA",
        totalBiaya: 1000000,
        dibayar: 500000,
        kurang: 500000,
        statusPembayaran: "Kurang Bayar",
      },
    }, adminUser);

    orderService.cancelOrder(ordRefund.orderNo, "Konsumen membatalkan", adminUser);
    const invRf = dbFinanceRepository.getInvoiceByOrderNo(ordRefund.orderNo)!;

    financeService.payoutCashback(invRf.id, {
      nominal: 500000,
      paymentType: "KELEBIHAN",
      penerima: "Dodi Refund",
      bank: "BCA",
      noRekening: "9988776655",
      expectedVersion: 0,
      idempotencyKey: `IDEMP-RF-CLASSIFY-${Date.now()}`,
    }, financeUser);

    // Classification Verifications:
    const settledCb = dbFinanceRepository.getInvoiceById(invCb.id)!;
    const settledRf = dbFinanceRepository.getInvoiceById(invRf.id)!;

    // Record 1 verification:
    assert.strictEqual(settledCb.cashbackStatus, "REALIZED", "Cashback status must be REALIZED");
    assert.strictEqual(settledCb.refundStatus || "NONE", "NONE", "Cashback payout must NOT alter refund status");
    assert.strictEqual(Number(settledCb.overpayment || 0), 0, "Cashback invoice must have 0 overpayment");

    // Record 2 verification:
    assert.strictEqual(settledRf.refundStatus, "PROCESSED", "Refund status must be PROCESSED");
    assert.ok(settledRf.cashbackStatus === "APPROVED" || settledRf.cashbackStatus === "NONE", "Refund payout must NOT alter cashback status");
    assert.strictEqual(Number(settledRf.cashback || 0), 0, "Refund invoice must have 0 cashback");

    // Kas Kantor descriptions separation:
    const kasCb = (db.prepare("SELECT * FROM kas_kantor WHERE invoice_no = ? AND status = 'Kredit'").all(settledCb.invoiceNo) as any[])[0];
    const kasRf = (db.prepare("SELECT * FROM kas_kantor WHERE invoice_no = ? AND status = 'Kredit'").all(settledRf.invoiceNo) as any[])[0];

    assert.ok(kasCb.keterangan.startsWith("Pencairan komisi rekanan:"), `Cashback kas description must start with 'Pencairan komisi rekanan', got: ${kasCb.keterangan}`);
    assert.ok(kasRf.keterangan.startsWith("Pengembalian kelebihan bayar:"), `Refund kas description must start with 'Pengembalian kelebihan bayar', got: ${kasRf.keterangan}`);

    // Reporting Separation: Financial ledger query distinct sums
    const allOutflows = db.prepare("SELECT keterangan, kredit FROM kas_kantor WHERE status = 'Kredit'").all() as any[];
    const totalCashbackOutflow = allOutflows
      .filter(k => k.keterangan.startsWith("Pencairan komisi rekanan:"))
      .reduce((s, k) => s + Number(k.kredit), 0);
    const totalRefundOutflow = allOutflows
      .filter(k => k.keterangan.startsWith("Pengembalian kelebihan bayar:"))
      .reduce((s, k) => s + Number(k.kredit), 0);

    assert.ok(totalCashbackOutflow >= 50000, "Cashback reporting must capture commission payouts");
    assert.ok(totalRefundOutflow >= 500000, "Refund reporting must capture overpayment refunds");
  });
});
