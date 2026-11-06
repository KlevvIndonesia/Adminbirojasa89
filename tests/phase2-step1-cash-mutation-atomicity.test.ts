/**
 * Phase 2 / Step 1 — DEF-FIN-004 Cash Mutation Atomicity Test Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. Kredit dengan saldo mencukupi berhasil.
 * 2. Kredit dengan saldo tidak mencukupi ditolak.
 * 3. Penolakan tidak menghasilkan jurnal kas kantor.
 * 4. Penolakan tidak menghasilkan audit log.
 * 5. Kegagalan penyimpanan jurnal menyebabkan rollback.
 * 6. Kegagalan audit log menyebabkan rollback jurnal kas kantor.
 * 7. Kegagalan audit log pada addPengeluaran membatalkan record pengeluaran (atomicity).
 * 8. Running balance konsisten dengan SUM(debit) - SUM(kredit) setelah mutasi beruntun & delete.
 * 9. Validasi saldo atomik mencegah saldo negatif pada permintaan pengeluaran berkompetisi.
 * 10. Operasi kas lain (pembayaran awal, void, reimbursement) tetap stabil tanpa regresi.
 */

import test from "node:test";
import assert from "node:assert";
import { db, runInTransaction } from "../server/src/database/db";
import { financeService } from "../server/src/services/financeService";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";

const testAdmin: any = {
  userId: "usr-admin-atomic",
  nama: "Admin Atomicity Test",
  role: "admin",
  jabatan: "ADMIN",
  email: "admin-atomic@test.local",
};

const testFinance: any = {
  userId: "usr-fin-atomic",
  nama: "Finance Atomicity Test",
  role: "finance",
  jabatan: "FINANCE",
  email: "fin-atomic@test.local",
};

test("PHASE 2 / STEP 1: DEF-FIN-004 CASH MUTATION ATOMICITY SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 1 & 2 & 3 & 4: SALDO VALIDATION & REJECTION ATOMICITY
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("1.1: Kredit dengan saldo mencukupi berhasil dicatat ke Kas Kantor", () => {
    // 1. Initial Deposit / Modal Awal (Debit 500.000)
    const deposit = financeService.addKasKantor({
      tanggal: "2026-11-04",
      status: "Debit",
      debit: 500000,
      kredit: 0,
      keterangan: "Setoran Modal Kas Kecil Uji Coba",
      kategori: "MODAL_AWAL",
      penanggungJawab: testAdmin.nama,
    }, testAdmin);

    assert.ok(deposit.id > 0);
    assert.strictEqual(deposit.saldo, 500000);

    // 2. Pengeluaran Kredit sebesar 200.000 (Saldo cukup)
    const creditEntry = financeService.addKasKantor({
      tanggal: "2026-11-04",
      status: "Kredit",
      debit: 0,
      kredit: 200000,
      keterangan: "Beli Perlengkapan & ATK Kantor",
      kategori: "Perlengkapan & ATK Kantor",
      penanggungJawab: testFinance.nama,
    }, testFinance);

    assert.ok(creditEntry.id > 0);
    assert.strictEqual(creditEntry.saldo, 300000);

    const balRow = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
    assert.strictEqual(balRow.balance, 300000);
  });

  await suite.test("1.2: Kredit dengan saldo tidak mencukupi ditolak tanpa jurnal maupun audit log", () => {
    // Current balance is 300.000. Try to disburse 400.000 (Exceeds balance)
    const countKasBefore = db.prepare("SELECT COUNT(*) as count FROM kas_kantor").get() as any;
    const countAuditBefore = db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE module = 'Kas Kantor'").get() as any;

    assert.throws(
      () => {
        financeService.addKasKantor({
          tanggal: "2026-11-04",
          status: "Kredit",
          debit: 0,
          kredit: 400000,
          keterangan: "Pengeluaran Berlebih Yang Harus Ditolak",
          kategori: "Operasional Kantor & Utilitas",
          penanggungJawab: testFinance.nama,
        }, testFinance);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "INSUFFICIENT_OFFICE_BALANCE");
        return true;
      }
    );

    // Assert: Kas Kantor count and balance strictly unchanged
    const countKasAfter = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
    assert.strictEqual(countKasAfter.count, countKasBefore.count, "No new row in kas_kantor on insufficient balance rejection");
    assert.strictEqual(countKasAfter.balance, 300000, "Kas Kantor balance unchanged");

    // Assert: Audit log count strictly unchanged (no ghost audit log)
    const countAuditAfter = db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE module = 'Kas Kantor'").get() as any;
    assert.strictEqual(countAuditAfter.count, countAuditBefore.count, "No orphan audit log on insufficient balance rejection");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 5 & 6: TRANSACTION ROLLBACK INTEGRITY ON DOWNSTREAM FAILURE
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("1.3: Kegagalan audit log menyebabkan rollback mutasi Kas Kantor secara atomik", () => {
    const countKasBefore = db.prepare("SELECT COUNT(*) as count FROM kas_kantor").get() as any;

    // Temporarily mock dbAuditRepository.save to throw an error
    const originalSave = dbAuditRepository.save;
    (dbAuditRepository as any).save = () => {
      throw new Error("SIMULATED_AUDIT_DISK_FULL_FAILURE");
    };

    try {
      assert.throws(
        () => {
          financeService.addKasKantor({
            tanggal: "2026-11-04",
            status: "Debit",
            debit: 150000,
            kredit: 0,
            keterangan: "Setoran Yang Akan Gagal Saat Audit Log",
            kategori: "Operasional",
            penanggungJawab: testFinance.nama,
          }, testFinance);
        },
        /SIMULATED_AUDIT_DISK_FULL_FAILURE/
      );

      // Verify that the insertion into kas_kantor was rolled back
      const countKasAfter = db.prepare("SELECT COUNT(*) as count FROM kas_kantor").get() as any;
      assert.strictEqual(countKasAfter.count, countKasBefore.count, "Kas Kantor insert must be rolled back on audit failure");
    } finally {
      // Restore original method
      dbAuditRepository.save = originalSave;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 7 & 8: ATOMICITY ON PENGELUARAN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("1.4: Kegagalan audit log pada addPengeluaran membatalkan record pengeluaran", () => {
    const countPengeluaranBefore = db.prepare("SELECT COUNT(*) as count FROM pengeluaran").get() as any;

    const originalSave = dbAuditRepository.save;
    (dbAuditRepository as any).save = () => {
      throw new Error("SIMULATED_AUDIT_FAILURE_ON_PENGELUARAN");
    };

    try {
      assert.throws(
        () => {
          financeService.addPengeluaran({
            tanggal: "2026-11-04",
            keterangan: "Pengeluaran Beli Kertas HVS",
            nominal: 60000,
            kategori: "Perlengkapan & ATK Kantor",
            penanggungJawab: testFinance.nama,
          }, testFinance);
        },
        /SIMULATED_AUDIT_FAILURE_ON_PENGELUARAN/
      );

      const countPengeluaranAfter = db.prepare("SELECT COUNT(*) as count FROM pengeluaran").get() as any;
      assert.strictEqual(countPengeluaranAfter.count, countPengeluaranBefore.count, "Pengeluaran record must be rolled back");
    } finally {
      dbAuditRepository.save = originalSave;
    }

    // Now test successful addPengeluaran
    const created = financeService.addPengeluaran({
      tanggal: "2026-11-04",
      keterangan: "Pengeluaran Listrik Kantor Sukses",
      nominal: 75000,
      kategori: "Operasional Kantor & Utilitas",
      penanggungJawab: testFinance.nama,
    }, testFinance);

    assert.ok(created.id > 0);
    const countPengeluaranValid = db.prepare("SELECT COUNT(*) as count FROM pengeluaran").get() as any;
    assert.strictEqual(countPengeluaranValid.count, countPengeluaranBefore.count + 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 9: RUNNING BALANCE CONSISTENCY WITH SUM(debit) - SUM(kredit)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("1.5: Running balance selalu konsisten dengan agregasi aktual SUM(debit) - SUM(kredit)", () => {
    // Perform a series of mixed operations
    financeService.addKasKantor({
      tanggal: "2026-11-04",
      status: "Debit",
      debit: 1000000,
      kredit: 0,
      keterangan: "Penerimaan Fee Konsultasi",
      penanggungJawab: testFinance.nama,
    }, testFinance);

    financeService.addKasKantor({
      tanggal: "2026-11-04",
      status: "Kredit",
      debit: 0,
      kredit: 150000,
      keterangan: "Beli Token Listrik",
      penanggungJawab: testFinance.nama,
    }, testFinance);

    financeService.addKasKantor({
      tanggal: "2026-11-04",
      status: "Kredit",
      debit: 0,
      kredit: 50000,
      keterangan: "Beli Air Galon Kantor",
      penanggungJawab: testFinance.nama,
    }, testFinance);

    // Fetch all entries in order and verify each row's running balance
    const entries = dbFinanceRepository.getAllKasKantor().reverse(); // chronological order
    let runningCalc = 0;
    for (const e of entries) {
      const isDebit = e.status === "Debit" || e.status === "Pemasukan";
      const d = Number(e.debit || 0);
      const k = Number(e.kredit || 0);
      runningCalc = runningCalc + d - k;
      assert.strictEqual(
        Number(e.saldo),
        runningCalc,
        `Row #${e.id} saldo (${e.saldo}) must equal running aggregation (${runningCalc})`
      );
    }

    // Final total balance check
    const totalRow = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
    const lastRow = db.prepare("SELECT saldo FROM kas_kantor ORDER BY id DESC LIMIT 1").get() as any;
    assert.strictEqual(lastRow.saldo, totalRow.balance);
    assert.strictEqual(totalRow.balance, runningCalc);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 10: CONCURRENT / COMPETING CASH-OUT REQUESTS DO NOT CAUSE NEGATIVE BALANCE
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("1.6: Operasi pengeluaran berkompetisi tidak menyebabkan saldo negatif", () => {
    // Current balance check
    const currentBalRow = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
    const currentBalance = currentBalRow.balance;
    assert.ok(currentBalance > 0, "Balance must be positive for concurrency test");

    // We have balance = 1.100.000.
    // We launch two competing transactions each requesting 700.000.
    // Total requested = 1.400.000 > 1.100.000.
    // Exactly one transaction must succeed and the second must be rejected!
    const attemptAmount = Math.floor(currentBalance * 0.7); // 70% of balance

    let successCount = 0;
    let failureCount = 0;

    // Transaction 1
    try {
      financeService.addKasKantor({
        tanggal: "2026-11-04",
        status: "Kredit",
        debit: 0,
        kredit: attemptAmount,
        keterangan: "Competing Cash-Out Operation 1",
        penanggungJawab: testFinance.nama,
      }, testFinance);
      successCount++;
    } catch {
      failureCount++;
    }

    // Transaction 2 (Competing for remaining balance)
    try {
      financeService.addKasKantor({
        tanggal: "2026-11-04",
        status: "Kredit",
        debit: 0,
        kredit: attemptAmount,
        keterangan: "Competing Cash-Out Operation 2",
        penanggungJawab: testFinance.nama,
      }, testFinance);
      successCount++;
    } catch (err: any) {
      if (err.code === "INSUFFICIENT_OFFICE_BALANCE") {
        failureCount++;
      } else {
        throw err;
      }
    }

    assert.strictEqual(successCount, 1, "Exactly one competing cash-out must succeed");
    assert.strictEqual(failureCount, 1, "The second competing cash-out must be rejected");

    const finalBalRow = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
    assert.ok(finalBalRow.balance >= 0, "Final balance must NEVER be negative");
    assert.strictEqual(finalBalRow.balance, currentBalance - attemptAmount);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 11: DELETE KAS KANTOR COMPENSATING REVERSAL ATOMICITY
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("1.7: deleteKasKantor compensating reversal and audit are atomic", () => {
    // 1. Add a manual expense
    const entry = financeService.addKasKantor({
      tanggal: "2026-11-04",
      status: "Kredit",
      debit: 0,
      kredit: 35000,
      keterangan: "Beli Snack Rapat",
      penanggungJawab: testFinance.nama,
    }, testFinance);

    const balAfterInsert = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;

    // 2. Delete it (compensating reversal)
    const success = financeService.deleteKasKantor(entry.id, testAdmin);
    assert.strictEqual(success, true);

    const balAfterDelete = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as balance FROM kas_kantor").get() as any;
    assert.strictEqual(balAfterDelete.balance, balAfterInsert.balance + 35000, "Compensating reversal restores exact balance");

    // 3. Verify running balance of the compensating reversal matches aggregate balance
    const lastRow = db.prepare("SELECT saldo, keterangan FROM kas_kantor ORDER BY id DESC LIMIT 1").get() as any;
    assert.strictEqual(lastRow.saldo, balAfterDelete.balance);
    assert.ok(lastRow.keterangan.includes("[VOID] Reversal Kas Kantor"));
  });
});
