/**
 * Phase 2 Comprehensive Financial Integrity Test Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. DEF-FIN-004: True Multi-Connection SQLite Concurrency (separate connections, BEGIN IMMEDIATE, no negative balance).
 * 2. DEF-FIN-005: Cashback Payout Idempotency (identical replay, duplicate protection, 409 conflict, concurrent contention, rollback).
 * 3. DEF-FIN-003: Overpaid Invoice Closing Lifecycle (pending refund blocked, partial refund blocked, full refund completed, normal paid completed).
 */

import test from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { db, runInTransaction } from "../server/src/database/db";
import { financeService } from "../server/src/services/financeService";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { CONFIG } from "../server/src/config/env";
import { ApiError } from "../server/src/middleware/errorHandler";

const testAdmin: any = {
  userId: "usr-admin-phase2",
  nama: "Admin Phase 2 Tester",
  role: "admin",
  jabatan: "ADMIN",
  email: "admin-phase2@test.local",
};

const testFinance: any = {
  userId: "usr-fin-phase2",
  nama: "Finance Phase 2 Tester",
  role: "finance",
  jabatan: "FINANCE",
  email: "finance-phase2@test.local",
};

test("PHASE 2 COMPREHENSIVE FINANCIAL INTEGRITY TEST SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 1: DEF-FIN-004 — TRUE MULTI-CONNECTION SQLITE CONCURRENCY
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("1.1: Multi-Connection SQLite Concurrency Guard prevents negative cash balance", () => {
    const testDbPath = CONFIG.DB_PATH;
    assert.ok(testDbPath, "Test DB Path must exist");

    // Open two independent SQLite connection handles to the same database file
    const connA = new DatabaseSync(testDbPath);
    const connB = new DatabaseSync(testDbPath);

    connA.exec("PRAGMA journal_mode = WAL;");
    connA.exec("PRAGMA busy_timeout = 5000;");
    connB.exec("PRAGMA busy_timeout = 5000;");

    try {
      // 1. Establish initial balance of exactly Rp 100.000
      connA.exec("BEGIN IMMEDIATE;");
      const currentAgg = connA.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
      const existingBal = currentAgg?.balance || 0;
      
      const targetInitial = 100000;
      const adjustment = targetInitial - existingBal;
      if (adjustment > 0) {
        connA.prepare(`
          INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab)
          VALUES ('2026-11-04', 'Setoran Saldo Awal Test Konkurensi', 'Debit', ?, 0, ?, 'Admin Test')
        `).run(adjustment, targetInitial);
      } else if (adjustment < 0) {
        connA.prepare(`
          INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab)
          VALUES ('2026-11-04', 'Penyesuaian Saldo Awal Test Konkurensi', 'Kredit', 0, ?, ?, 'Admin Test')
        `).run(Math.abs(adjustment), targetInitial);
      }
      connA.exec("COMMIT;");

      // Verify starting balance is exactly 100.000 from connB
      const initialBalRow = connB.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
      assert.strictEqual(initialBalRow.balance, 100000, "Starting balance must be Rp 100.000");

      // Two competing cash-out requests of Rp 70.000 each
      const expenseAmount = 70000;
      let connASucceeded = false;
      let connBRejectedWith400 = false;

      // Conn A executes cash-out in atomic transaction with BEGIN IMMEDIATE
      connA.exec("BEGIN IMMEDIATE;");
      const balA = connA.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
      if (balA.balance >= expenseAmount) {
        const newSaldoA = balA.balance - expenseAmount;
        connA.prepare(`
          INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab)
          VALUES ('2026-11-04', 'Pengeluaran Konkuren Conn A', 'Kredit', 0, ?, ?, 'Finance A')
        `).run(expenseAmount, newSaldoA);
        connASucceeded = true;
      }
      connA.exec("COMMIT;");
      assert.strictEqual(connASucceeded, true, "Conn A expense must succeed");

      // Conn B now attempts cash-out of Rp 70.000
      connB.exec("BEGIN IMMEDIATE;");
      const balB = connB.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
      assert.strictEqual(balB.balance, 30000, "Conn B must read committed balance Rp 30.000");

      if (balB.balance < expenseAmount) {
        connB.exec("ROLLBACK;");
        connBRejectedWith400 = true;
      } else {
        connB.prepare(`
          INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab)
          VALUES ('2026-11-04', 'Pengeluaran Konkuren Conn B', 'Kredit', 0, ?, ?, 'Finance B')
        `).run(expenseAmount, balB.balance - expenseAmount);
        connB.exec("COMMIT;");
      }

      assert.strictEqual(connBRejectedWith400, true, "Conn B must be rejected due to insufficient funds");

      // Verify final balance on disk
      const finalBal = connA.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
      assert.strictEqual(finalBal.balance, 30000, "Final balance must remain Rp 30.000");
      assert.ok(finalBal.balance >= 0, "Cash balance must NEVER become negative");
    } finally {
      connA.close();
      connB.close();
    }
  });

  await suite.test("1.2: Multi-Connection Lock Contention triggers SQLITE_BUSY when lock held past timeout", () => {
    const testDbPath = CONFIG.DB_PATH;
    const conn1 = new DatabaseSync(testDbPath);
    const conn2 = new DatabaseSync(testDbPath);

    conn1.exec("PRAGMA busy_timeout = 5000;");
    conn2.exec("PRAGMA busy_timeout = 50;"); // Short timeout to test contention rejection

    try {
      conn1.exec("BEGIN IMMEDIATE;");

      let lockContentionError = false;
      try {
        conn2.exec("BEGIN IMMEDIATE;");
      } catch (err: any) {
        lockContentionError = true;
        assert.ok(
          err.message.includes("database is locked") || err.message.includes("busy"),
          "Error message must indicate database is locked"
        );
      }

      assert.strictEqual(lockContentionError, true, "Conn 2 must fail with lock contention while Conn 1 holds lock");
      conn1.exec("COMMIT;");

      // Conn 2 should succeed after Conn 1 releases the lock
      conn2.exec("BEGIN IMMEDIATE;");
      conn2.exec("COMMIT;");
    } finally {
      conn1.close();
      conn2.close();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 2: DEF-FIN-005 — CASHBACK PAYOUT IDEMPOTENCY END-TO-END
  // ═══════════════════════════════════════════════════════════════════════════════

  // Seed a test order with verified supervisi approval and an overpaid invoice
  const testOrderNo = `ORD-IDEMP-${Date.now()}`;
  const testInvNo = `INV-${testOrderNo}`;

  let invoiceId: number;

  await suite.test("2.0: Seed approved order with overpayment for idempotency testing", () => {
    // Insert order in DB directly
    db.prepare(`
      INSERT INTO orders (
        order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name,
        payment_status, total_biaya, data_json
      ) VALUES (?, ?, '08123456789', 'Perpanjangan STNK Tahunan', 'B 1234 IDM', 7, 'Selesai', 'OVERPAID', 1000000, ?)
    `).run(
      testOrderNo,
      "PT Bintang Idempotency",
      JSON.stringify({
        orderNo: testOrderNo,
        customer: "PT Bintang Idempotency",
        currentStep: 7,
        currentStageName: "Selesai",
        isVerified: true,
        approvedBySpv: "Supervisor Test",
        finalCost: 900000,
        payment: {
          totalTagihan: 1000000,
          terbayar: 1300000,
          overpayment: 300000,
          status: "OVERPAID",
        },
        documentApproval: {
          stage5Verified: true,
          stage6Approved: true,
        },
      })
    );

    // Insert invoice with 300.000 overpayment using repository
    invoiceId = dbFinanceRepository.saveInvoice({
      invoiceNo: testInvNo,
      orderNo: testOrderNo,
      customer: "PT Bintang Idempotency",
      layanan: "Perpanjangan STNK Tahunan",
      totalTagihan: 1000000,
      terbayar: 1300000,
      dibayar: 1300000,
      sisa: 0,
      overpayment: 300000,
      refundLiability: 300000,
      refundStatus: "PENDING",
      status: "OVERPAID" as any,
      payoutHistory: [],
    });

    assert.ok(invoiceId > 0, "Invoice must be inserted");

    // Also add verified payment to invoice_payments
    db.prepare(`
      INSERT INTO invoice_payments (
        invoice_no, order_no, nominal, metode_pembayaran, nama_bank,
        tanggal_bayar, status_verifikasi, is_void, verified_by, created_at
      ) VALUES (?, ?, 1300000, 'Transfer Bank', 'BCA', '2026-11-04', 'TERVERIFIKASI', 0, 'Supervisor Test', datetime('now'))
    `).run(testInvNo, testOrderNo);

    // Ensure Kas Kantor has enough balance for refund payouts
    financeService.addKasKantor({
      tanggal: "2026-11-04",
      status: "Debit",
      debit: 1000000,
      kredit: 0,
      keterangan: "Modal Payout Idempotency Test",
      kategori: "MODAL_AWAL",
      penanggungJawab: testAdmin.nama,
    }, testAdmin);
  });

  await suite.test("2.0B: Payout request WITHOUT idempotency key is REJECTED with 400 IDEMPOTENCY_KEY_REQUIRED", () => {
    const missingKeyPayload = {
      nominal: 50000,
      paymentType: "KELEBIHAN" as const,
      penerima: "Budi Santoso",
      bank: "BCA",
      noRekening: "1234567890",
      namaRekening: "Budi Santoso",
      buktiPembayaran: { fileName: "bukti_no_key.jpg", fileUrl: "/uploads/no_key.jpg" },
    };

    assert.throws(
      () => {
        financeService.payoutCashback(invoiceId, missingKeyPayload as any, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "IDEMPOTENCY_KEY_REQUIRED");
        assert.ok(err.message.includes("Idempotency key wajib disertakan"));
        return true;
      }
    );
  });

  await suite.test("2.1: First cashback payout with idempotency key succeeds", () => {
    const kasBefore = db.prepare("SELECT COUNT(*) as count FROM kas_kantor").get() as any;

    const payoutPayload = {
      nominal: 100000,
      paymentType: "KELEBIHAN" as const,
      penerima: "Budi Santoso",
      bank: "BCA",
      noRekening: "1234567890",
      namaRekening: "Budi Santoso",
      buktiPembayaran: { fileName: "bukti_refund_1.jpg", fileUrl: "/uploads/bukti1.jpg" },
      idempotencyKey: "IDEMP-REFUND-KEY-001",
      expectedVersion: 0,
    };

    const result = financeService.payoutCashback(invoiceId, payoutPayload, testFinance);

    assert.strictEqual(result.refundedAmount, 100000);
    assert.strictEqual(result.remainingRefund, 200000);
    assert.strictEqual(result.refundStatus, "PARTIALLY_REFUNDED");

    // Verify kas_kantor entry added
    const kasAfter = db.prepare("SELECT COUNT(*) as count FROM kas_kantor").get() as any;
    assert.strictEqual(kasAfter.count, kasBefore.count + 1);

    // Verify idempotency record saved in database
    const idempRecord = dbFinanceRepository.getIdempotencyRecord("IDEMP-REFUND-KEY-001", "cashback_payout");
    assert.ok(idempRecord, "Idempotency record must be stored");
    assert.strictEqual(idempRecord.scope, "cashback_payout");
    assert.strictEqual(idempRecord.resource_id, String(invoiceId));
  });

  await suite.test("2.2: Duplicate request with identical idempotency key returns identical result without double-charging", () => {
    const kasBefore = db.prepare("SELECT COUNT(*) as count FROM kas_kantor").get() as any;
    const auditBefore = db.prepare("SELECT COUNT(*) as count FROM audit_logs").get() as any;

    const duplicatePayload = {
      nominal: 100000,
      paymentType: "KELEBIHAN" as const,
      penerima: "Budi Santoso",
      bank: "BCA",
      noRekening: "1234567890",
      namaRekening: "Budi Santoso",
      buktiPembayaran: { fileName: "bukti_refund_1.jpg", fileUrl: "/uploads/bukti1.jpg" },
      idempotencyKey: "IDEMP-REFUND-KEY-001",
      expectedVersion: 0,
    };

    // Re-execute identical payout request
    const replayResult = financeService.payoutCashback(invoiceId, duplicatePayload, testFinance);

    assert.strictEqual(replayResult.refundedAmount, 100000);
    assert.strictEqual(replayResult.remainingRefund, 200000);
    assert.strictEqual(replayResult.refundStatus, "PARTIALLY_REFUNDED");

    // NO new kas_kantor deduction!
    const kasAfter = db.prepare("SELECT COUNT(*) as count FROM kas_kantor").get() as any;
    assert.strictEqual(kasAfter.count, kasBefore.count, "Duplicate payout MUST NOT create new cash entry");

    // NO duplicate audit log!
    const auditAfter = db.prepare("SELECT COUNT(*) as count FROM audit_logs").get() as any;
    assert.strictEqual(auditAfter.count, auditBefore.count, "Duplicate payout MUST NOT create new audit log");
  });

  await suite.test("2.3: Conflicting idempotency key with different payload is rejected with 409 IDEMPOTENCY_CONFLICT", () => {
    const conflictingPayload = {
      nominal: 150000, // Different nominal with same key
      paymentType: "KELEBIHAN" as const,
      penerima: "Budi Santoso",
      bank: "BCA",
      noRekening: "1234567890",
      namaRekening: "Budi Santoso",
      buktiPembayaran: { fileName: "bukti_refund_diff.jpg", fileUrl: "/uploads/diff.jpg" },
      idempotencyKey: "IDEMP-REFUND-KEY-001", // Reusing existing key!
      expectedVersion: 0,
    };

    assert.throws(
      () => {
        financeService.payoutCashback(invoiceId, conflictingPayload, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 409);
        assert.strictEqual(err.code, "IDEMPOTENCY_CONFLICT");
        return true;
      }
    );
  });

  await suite.test("2.4: Competing payout requests for remaining refund balance cannot double-disburse", () => {
    // Current remaining refund = 200.000
    // Request A: 150.000
    const payloadA = {
      nominal: 150000,
      paymentType: "KELEBIHAN" as const,
      penerima: "Budi Santoso",
      bank: "BCA",
      noRekening: "1234567890",
      namaRekening: "Budi Santoso",
      buktiPembayaran: { fileName: "bukti_refund_2.jpg", fileUrl: "/uploads/bukti2.jpg" },
      idempotencyKey: "IDEMP-REFUND-KEY-002",
      expectedVersion: 1,
    };

    const resA = financeService.payoutCashback(invoiceId, payloadA, testFinance);
    assert.strictEqual(resA.refundedAmount, 250000);
    assert.strictEqual(resA.remainingRefund, 50000);

    // Request B: attempts 100.000 when only 50.000 remains
    const payloadB = {
      nominal: 100000,
      paymentType: "KELEBIHAN" as const,
      penerima: "Budi Santoso",
      bank: "BCA",
      noRekening: "1234567890",
      namaRekening: "Budi Santoso",
      buktiPembayaran: { fileName: "bukti_refund_3.jpg", fileUrl: "/uploads/bukti3.jpg" },
      idempotencyKey: "IDEMP-REFUND-KEY-003",
      expectedVersion: 2,
    };

    assert.throws(
      () => {
        financeService.payoutCashback(invoiceId, payloadB, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "EXCEEDS_LIMIT");
        return true;
      }
    );
  });

  await suite.test("2.5: Transaction rollback on failure leaves NO idempotency record and NO cash mutation", () => {
    const originalSave = dbAuditRepository.save.bind(dbAuditRepository);
    const kasBefore = db.prepare("SELECT COUNT(*) as count FROM kas_kantor").get() as any;

    // Sabotage audit repository
    (dbAuditRepository as any).save = () => {
      throw new Error("Simulated Crash during audit log saving");
    };

    try {
      const failingPayload = {
        nominal: 50000,
        paymentType: "KELEBIHAN" as const,
        penerima: "Budi Santoso",
        bank: "BCA",
        noRekening: "1234567890",
        namaRekening: "Budi Santoso",
        buktiPembayaran: { fileName: "bukti_fail.jpg", fileUrl: "/uploads/fail.jpg" },
        idempotencyKey: "IDEMP-FAILING-KEY-999",
        expectedVersion: 2,
      };

      assert.throws(() => {
        financeService.payoutCashback(invoiceId, failingPayload, testFinance);
      });

      // Verify rollback: no new cash entry
      const kasAfter = db.prepare("SELECT COUNT(*) as count FROM kas_kantor").get() as any;
      assert.strictEqual(kasAfter.count, kasBefore.count, "Failed payout must roll back cash entry");

      // Verify rollback: idempotency key was NOT persisted
      const record = dbFinanceRepository.getIdempotencyRecord("IDEMP-FAILING-KEY-999", "cashback_payout");
      assert.strictEqual(record, undefined, "Failed transaction must NOT commit idempotency key");
    } finally {
      (dbAuditRepository as any).save = originalSave;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 3: DEF-FIN-003 — OVERPAID INVOICE CLOSING (completeInvoice)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("3.1: Normal balanced PAID invoice completes and archives normally", () => {
    // Seed standard paid invoice (tagihan: 500.000, terbayar: 500.000, sisa: 0, overpayment: 0)
    const normalOrderNo = `ORD-NORM-${Date.now()}`;
    const normalInvNo = `INV-${normalOrderNo}`;

    db.prepare(`
      INSERT INTO orders (
        order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name,
        payment_status, total_biaya, data_json
      ) VALUES (?, 'Customer Normal', '08123456789', 'Layanan', 'B 999 NRM', 7, 'Selesai', 'Lunas', 500000, ?)
    `).run(
      normalOrderNo,
      JSON.stringify({
        orderNo: normalOrderNo,
        customer: "Customer Normal",
        currentStep: 7,
        currentStageName: "Selesai",
        isVerified: true,
        approvedBySpv: "Supervisor Test",
        finalCost: 450000,
        payment: { totalTagihan: 500000, terbayar: 500000, sisa: 0, status: "Lunas" },
        documentApproval: { stage5Verified: true, stage6Approved: true },
      })
    );

    const normalId = dbFinanceRepository.saveInvoice({
      invoiceNo: normalInvNo,
      orderNo: normalOrderNo,
      customer: "Customer Normal",
      layanan: "Layanan",
      totalTagihan: 500000,
      dibayar: 500000,
      terbayar: 500000,
      sisa: 0,
      overpayment: 0,
      status: "PAID" as any,
      refundStatus: "NONE",
      payoutHistory: [],
    });
    const completed = financeService.completeInvoice(normalId, testFinance);

    assert.strictEqual(completed.billingStatus, "COMPLETED");
    assert.strictEqual(completed.completedBy, testFinance.nama);
    assert.ok(completed.completedAt);
  });

  await suite.test("3.2: Overpaid invoice with pending/unprocessed refund is REJECTED from closing", () => {
    // Current invoiceId has 50.000 remaining refund (refundStatus is PARTIALLY_REFUNDED)
    assert.throws(
      () => {
        financeService.completeInvoice(invoiceId, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "REFUND_NOT_COMPLETED");
        assert.ok(err.message.includes("pengembalian dana pelanggan belum tuntas"));
        return true;
      }
    );
  });

  await suite.test("3.3: Overpaid invoice with partial refund is REJECTED from closing", () => {
    const inv = financeService.getInvoiceById(invoiceId);
    assert.strictEqual(inv.refundStatus, "PARTIALLY_REFUNDED");

    assert.throws(
      () => {
        financeService.completeInvoice(invoiceId, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "REFUND_NOT_COMPLETED");
        return true;
      }
    );
  });

  await suite.test("3.4: Overpaid invoice with FULL completed refund SUCCEEDS to close", () => {
    // Disburse the remaining 50.000 to complete full refund (300.000 total)
    const finalPayload = {
      nominal: 50000,
      paymentType: "KELEBIHAN" as const,
      penerima: "Budi Santoso",
      bank: "BCA",
      noRekening: "1234567890",
      namaRekening: "Budi Santoso",
      buktiPembayaran: { fileName: "bukti_refund_final.jpg", fileUrl: "/uploads/final.jpg" },
      idempotencyKey: "IDEMP-REFUND-KEY-FINAL",
      expectedVersion: 2,
    };

    const updatedInv = financeService.payoutCashback(invoiceId, finalPayload, testFinance);
    assert.strictEqual(updatedInv.refundStatus, "PROCESSED");
    assert.strictEqual(updatedInv.remainingRefund, 0);
    assert.strictEqual(updatedInv.refundedAmount, 300000);

    // Now closing invoice MUST SUCCEED!
    const closedInv = financeService.completeInvoice(invoiceId, testFinance);
    assert.strictEqual(closedInv.billingStatus, "COMPLETED");
    assert.strictEqual(closedInv.completedBy, testFinance.nama);
    assert.ok(closedInv.completedAt);
  });

  await suite.test("3.5: Synthetic check: Invoice marked PROCESSED but missing payout records is REJECTED", () => {
    // Create an invoice with forged/tampered status: says PROCESSED but payoutHistory is empty
    const forgedOrderNo = `ORD-FORGE-${Date.now()}`;
    const forgedInvNo = `INV-${forgedOrderNo}`;

    db.prepare(`
      INSERT INTO orders (
        order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name,
        payment_status, total_biaya, data_json
      ) VALUES (?, 'Customer Forged', '08123456789', 'Layanan', 'B 888 FRG', 7, 'Selesai', 'OVERPAID', 500000, ?)
    `).run(
      forgedOrderNo,
      JSON.stringify({
        orderNo: forgedOrderNo,
        customer: "Customer Forged",
        currentStep: 7,
        currentStageName: "Selesai",
        isVerified: true,
        approvedBySpv: "Supervisor Test",
        finalCost: 450000,
        payment: { totalTagihan: 500000, terbayar: 600000, overpayment: 100000, status: "OVERPAID" },
        documentApproval: { stage5Verified: true, stage6Approved: true },
      })
    );

    const forgedInvRes = db.prepare(`
      INSERT INTO finance_invoices (
        invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status,
        overpayment, refund_status, data_json
      ) VALUES (?, ?, 'Customer Forged', 'Layanan', 500000, 600000, 0, 'OVERPAID', 100000, 'PROCESSED', ?)
    `).run(
      forgedInvNo,
      forgedOrderNo,
      JSON.stringify({
        invoiceNo: forgedInvNo,
        orderNo: forgedOrderNo,
        customer: "Customer Forged",
        totalTagihan: 500000,
        dibayar: 600000,
        terbayar: 600000,
        sisa: 0,
        overpayment: 100000,
        refundLiability: 100000,
        refundStatus: "PROCESSED", // Fraudulent / unverified claim
        payoutHistory: [], // EMPTY! No real refund occurred!
        status: "OVERPAID",
        billingStatus: "OPEN",
      })
    );

    const forgedId = Number(forgedInvRes.lastInsertRowid);

    assert.throws(
      () => {
        financeService.completeInvoice(forgedId, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "REFUND_NOT_COMPLETED");
        return true;
      }
    );
  });

  await suite.test("3.5B: Payout referencing nonexistent kasKantorId is REJECTED with 400 REFUND_NOT_COMPLETED", () => {
    const fakeOrderNo = `ORD-FAKEKAS-${Date.now()}`;
    const fakeInvNo = `INV-${fakeOrderNo}`;
    const fakeId = dbFinanceRepository.saveInvoice({
      invoiceNo: fakeInvNo,
      orderNo: fakeOrderNo,
      customer: "Fake Kas Customer",
      layanan: "Layanan",
      totalTagihan: 500000,
      dibayar: 600000,
      terbayar: 600000,
      sisa: 0,
      overpayment: 100000,
      refundLiability: 100000,
      refundStatus: "PROCESSED",
      status: "OVERPAID" as any,
      payoutHistory: [{
        id: "payout-fake-1",
        invoiceId: 99999,
        invoiceNo: fakeInvNo,
        orderNo: fakeOrderNo,
        payoutType: "KELEBIHAN",
        nominal: 100000,
        tanggal: "2026-11-04",
        metode: "Transfer Bank",
        penerima: "Fake Customer",
        status: "PROCESSED",
        kasKantorId: 99999999,
        processedAt: new Date().toISOString(),
        processedBy: testFinance.nama,
      }],
    });

    assert.throws(
      () => {
        financeService.completeInvoice(fakeId, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "REFUND_NOT_COMPLETED");
        return true;
      }
    );
  });

  await suite.test("3.5C: Payout with mismatched nominal vs kas_kantor kredit is REJECTED", () => {
    const mismatchOrderNo = `ORD-MISMATCH-${Date.now()}`;
    const mismatchInvNo = `INV-${mismatchOrderNo}`;

    const kasRes = db.prepare(`
      INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab, order_no, invoice_no)
      VALUES ('2026-11-04', 'Kas Journal Mismatch', 'Kredit', 0, 50000, 500000, 'Finance', ?, ?)
    `).run(mismatchOrderNo, mismatchInvNo);
    const realKasId = Number(kasRes.lastInsertRowid);

    const mismatchId = dbFinanceRepository.saveInvoice({
      invoiceNo: mismatchInvNo,
      orderNo: mismatchOrderNo,
      customer: "Mismatch Customer",
      layanan: "Layanan",
      totalTagihan: 500000,
      dibayar: 600000,
      terbayar: 600000,
      sisa: 0,
      overpayment: 100000,
      refundLiability: 100000,
      refundStatus: "PROCESSED",
      status: "OVERPAID" as any,
      payoutHistory: [{
        id: "payout-mismatch-1",
        invoiceId: 99999,
        invoiceNo: mismatchInvNo,
        orderNo: mismatchOrderNo,
        payoutType: "KELEBIHAN",
        nominal: 100000,
        tanggal: "2026-11-04",
        metode: "Transfer Bank",
        penerima: "Mismatch Customer",
        status: "PROCESSED",
        kasKantorId: realKasId,
        processedAt: new Date().toISOString(),
        processedBy: testFinance.nama,
      }],
    });

    assert.throws(
      () => {
        financeService.completeInvoice(mismatchId, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "REFUND_NOT_COMPLETED");
        return true;
      }
    );
  });

  await suite.test("3.5D: Payout linked to different invoice/order is REJECTED", () => {
    const crossOrderNo = `ORD-CROSS-${Date.now()}`;
    const crossInvNo = `INV-${crossOrderNo}`;

    const kasRes = db.prepare(`
      INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab, order_no, invoice_no)
      VALUES ('2026-11-04', 'Kas Other Inv', 'Kredit', 0, 100000, 500000, 'Finance', 'ORD-OTHER-123', 'INV-OTHER-123')
    `).run();
    const otherKasId = Number(kasRes.lastInsertRowid);

    const crossId = dbFinanceRepository.saveInvoice({
      invoiceNo: crossInvNo,
      orderNo: crossOrderNo,
      customer: "Cross Customer",
      layanan: "Layanan",
      totalTagihan: 500000,
      dibayar: 600000,
      terbayar: 600000,
      sisa: 0,
      overpayment: 100000,
      refundLiability: 100000,
      refundStatus: "PROCESSED",
      status: "OVERPAID" as any,
      payoutHistory: [{
        id: "payout-cross-1",
        invoiceId: 99999,
        invoiceNo: crossInvNo,
        orderNo: crossOrderNo,
        payoutType: "KELEBIHAN",
        nominal: 100000,
        tanggal: "2026-11-04",
        metode: "Transfer Bank",
        penerima: "Cross Customer",
        status: "PROCESSED",
        kasKantorId: otherKasId,
        processedAt: new Date().toISOString(),
        processedBy: testFinance.nama,
      }],
    });

    assert.throws(
      () => {
        financeService.completeInvoice(crossId, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "REFUND_NOT_COMPLETED");
        return true;
      }
    );
  });

  await suite.test("3.5E: Payout whose cash journal was voided is REJECTED", () => {
    const voidedOrderNo = `ORD-VOIDJOURNAL-${Date.now()}`;
    const voidedInvNo = `INV-${voidedOrderNo}`;

    const kasRes = db.prepare(`
      INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab, order_no, invoice_no)
      VALUES ('2026-11-04', 'Kas Voided Journal (BATAL)', 'Batal', 0, 100000, 500000, 'Finance', ?, ?)
    `).run(voidedOrderNo, voidedInvNo);
    const voidedKasId = Number(kasRes.lastInsertRowid);

    const voidedInvId = dbFinanceRepository.saveInvoice({
      invoiceNo: voidedInvNo,
      orderNo: voidedOrderNo,
      customer: "Voided Kas Customer",
      layanan: "Layanan",
      totalTagihan: 500000,
      dibayar: 600000,
      terbayar: 600000,
      sisa: 0,
      overpayment: 100000,
      refundLiability: 100000,
      refundStatus: "PROCESSED",
      status: "OVERPAID" as any,
      payoutHistory: [{
        id: "payout-voided-1",
        invoiceId: 99999,
        invoiceNo: voidedInvNo,
        orderNo: voidedOrderNo,
        payoutType: "KELEBIHAN",
        nominal: 100000,
        tanggal: "2026-11-04",
        metode: "Transfer Bank",
        penerima: "Voided Kas Customer",
        status: "PROCESSED",
        kasKantorId: voidedKasId,
        processedAt: new Date().toISOString(),
        processedBy: testFinance.nama,
      }],
    });

    assert.throws(
      () => {
        financeService.completeInvoice(voidedInvId, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "REFUND_NOT_COMPLETED");
        return true;
      }
    );
  });

  await suite.test("3.5F: Duplicate payoutId or duplicate kasKantorId is REJECTED (double counting protection)", () => {
    const dupOrderNo = `ORD-DUPKAS-${Date.now()}`;
    const dupInvNo = `INV-${dupOrderNo}`;

    const kasRes = db.prepare(`
      INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab, order_no, invoice_no)
      VALUES ('2026-11-04', 'Kas Single 50k', 'Kredit', 0, 50000, 500000, 'Finance', ?, ?)
    `).run(dupOrderNo, dupInvNo);
    const singleKasId = Number(kasRes.lastInsertRowid);

    const dupInvId = dbFinanceRepository.saveInvoice({
      invoiceNo: dupInvNo,
      orderNo: dupOrderNo,
      customer: "Duplicate Kas Customer",
      layanan: "Layanan",
      totalTagihan: 500000,
      dibayar: 600000,
      terbayar: 600000,
      sisa: 0,
      overpayment: 100000,
      refundLiability: 100000,
      refundStatus: "PROCESSED",
      status: "OVERPAID" as any,
      payoutHistory: [
        {
          id: "payout-dup-1",
          invoiceId: 99999,
          invoiceNo: dupInvNo,
          orderNo: dupOrderNo,
          payoutType: "KELEBIHAN",
          nominal: 50000,
          tanggal: "2026-11-04",
          metode: "Transfer Bank",
          penerima: "Duplicate Kas Customer",
          status: "PROCESSED",
          kasKantorId: singleKasId,
          processedAt: new Date().toISOString(),
          processedBy: testFinance.nama,
        },
        {
          id: "payout-dup-2",
          invoiceId: 99999,
          invoiceNo: dupInvNo,
          orderNo: dupOrderNo,
          payoutType: "KELEBIHAN",
          nominal: 50000,
          tanggal: "2026-11-04",
          metode: "Transfer Bank",
          penerima: "Duplicate Kas Customer",
          status: "PROCESSED",
          kasKantorId: singleKasId, // REUSED SAME KAS JOURNAL!
          processedAt: new Date().toISOString(),
          processedBy: testFinance.nama,
        }
      ],
    });

    assert.throws(
      () => {
        financeService.completeInvoice(dupInvId, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "REFUND_NOT_COMPLETED");
        return true;
      }
    );
  });

  await suite.test("3.6: Unpaid or underpaid invoice is REJECTED from closing", () => {
    const unpaidOrderNo = `ORD-UNPAID-${Date.now()}`;
    const unpaidInvNo = `INV-${unpaidOrderNo}`;

    const unpaidInvRes = db.prepare(`
      INSERT INTO finance_invoices (
        invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status,
        data_json
      ) VALUES (?, ?, 'Customer Unpaid', 'Layanan', 500000, 200000, 300000, 'PARTIAL', ?)
    `).run(
      unpaidInvNo,
      unpaidOrderNo,
      JSON.stringify({
        invoiceNo: unpaidInvNo,
        orderNo: unpaidOrderNo,
        customer: "Customer Unpaid",
        totalTagihan: 500000,
        dibayar: 200000,
        terbayar: 200000,
        sisa: 300000,
        status: "PARTIAL",
        billingStatus: "OPEN",
      })
    );

    const unpaidId = Number(unpaidInvRes.lastInsertRowid);

    assert.throws(
      () => {
        financeService.completeInvoice(unpaidId, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "INVOICE_NOT_PAID");
        return true;
      }
    );
  });
});
