import test from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import {
  getDb,
  getReadOnlyDb,
  initDatabase,
  closeDb,
  isDbConnected,
  getOperationalDbPath,
  setOperationalWriteGranted,
} from "../server/src/database/db";
import { initializeSchema, backfillHistoricalFinanceData } from "../server/src/database/schema";
import { verifyDisasterRecovery, restoreDatabase } from "../server/src/utils/backupRestore";

test("Database Safety & Backfill Idempotency Suite", async (t) => {
  // Ensure connection is closed before starting
  closeDb();

  await t.test("1. Import db.ts without opening connection", () => {
    // Assert that lazy initialization ensures connection is not opened merely by importing
    assert.strictEqual(
      isDbConnected(),
      false,
      "Expected isDbConnected() to be false immediately after module import"
    );
  });

  await t.test("2. Import repository without running initializeSchema or opening DB", async () => {
    closeDb();
    // Dynamically import repository to verify import behavior
    const { dbFinanceRepository } = await import("../server/src/repositories/dbFinanceRepository");
    assert.ok(dbFinanceRepository, "Expected dbFinanceRepository to be exported");
    assert.strictEqual(
      isDbConnected(),
      false,
      "Expected isDbConnected() to remain false after repository import"
    );
  });

  await t.test("3. Explicit startup initializes schema correctly on isolated database", () => {
    const tempDbPath = path.join(
      os.tmpdir(),
      `sun89-test-startup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`
    );

    try {
      const explicitDb = initDatabase({
        runSchema: true,
        targetPath: tempDbPath,
      });

      assert.ok(explicitDb, "Expected initDatabase to return a valid DatabaseSync instance");

      // Verify PRAGMA database_list to prove database isolation
      const dbList = explicitDb.prepare("PRAGMA database_list").all() as { file: string }[];
      assert.ok(dbList.length > 0);
      assert.strictEqual(
        path.resolve(dbList[0].file),
        path.resolve(tempDbPath),
        "Database connection must strictly point to the isolated temp database"
      );

      // Verify that tables exist
      const tables = explicitDb
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as { name: string }[];
      const tableNames = new Set(tables.map((t) => t.name));

      assert.ok(tableNames.has("orders"), "orders table must exist");
      assert.ok(tableNames.has("finance_invoices"), "finance_invoices table must exist");
      assert.ok(tableNames.has("invoice_payments"), "invoice_payments table must exist");
      assert.ok(tableNames.has("kas_kantor"), "kas_kantor table must exist");
      assert.ok(tableNames.has("users"), "users table must exist");

      closeDb();
    } finally {
      closeDb();
      try {
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        if (fs.existsSync(tempDbPath + "-wal")) fs.unlinkSync(tempDbPath + "-wal");
        if (fs.existsSync(tempDbPath + "-shm")) fs.unlinkSync(tempDbPath + "-shm");
      } catch {}
    }
  });

  await t.test("4. Read-only connection strictly forbids SQL write operations", () => {
    const tempDbPath = path.join(
      os.tmpdir(),
      `sun89-test-ro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`
    );

    // Bootstrap isolated test DB first
    const initDb = new DatabaseSync(tempDbPath);
    initDb.exec("CREATE TABLE test_items (id INTEGER PRIMARY KEY, name TEXT);");
    initDb.exec("INSERT INTO test_items (name) VALUES ('Initial Item');");
    initDb.close();

    // Now open via getReadOnlyDb
    const roDb = getReadOnlyDb(tempDbPath);

    // Verify reads succeed
    const rows = roDb.prepare("SELECT * FROM test_items").all() as { id: number; name: string }[];
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].name, "Initial Item");

    // Verify writes throw attempt to write a readonly database
    assert.throws(
      () => {
        roDb.exec("INSERT INTO test_items (name) VALUES ('Unauthorized Write');");
      },
      /readonly database|attempt to write a readonly database/i,
      "Expected SQL write on read-only connection to throw error"
    );

    assert.throws(
      () => {
        roDb.exec("CREATE TABLE unauthorized_table (id INT);");
      },
      /readonly database|attempt to write a readonly database/i,
      "Expected DDL on read-only connection to throw error"
    );

    roDb.close();

    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      if (fs.existsSync(tempDbPath + "-wal")) fs.unlinkSync(tempDbPath + "-wal");
      if (fs.existsSync(tempDbPath + "-shm")) fs.unlinkSync(tempDbPath + "-shm");
    } catch {}
  });

  await t.test("5. Invoice with valid payment does NOT get extra synthetic payment (Anti-Duplication)", () => {
    const tempDbPath = path.join(
      os.tmpdir(),
      `sun89-test-backfill-5-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`
    );

    try {
      const testDb = initDatabase({ runSchema: true, targetPath: tempDbPath });

      // Insert order first to satisfy foreign key
      testDb.prepare(`
        INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, total_biaya, data_json, samsat_tujuan_id, created_at)
        VALUES ('ORD-TEST-PAID', 'Bambang Test', '0812345678', 'Perpanjangan 1 Tahun', 'B 1234 CD', 10000000, '{}', NULL, '2026-11-03 10:00:00')
      `).run();

      // Insert an invoice that already has an active verified payment (like INV-1126-002)
      testDb.prepare(`
        INSERT INTO finance_invoices (
          id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at
        ) VALUES (
          101, 'INV-TEST-PAID', 'ORD-TEST-PAID', 'Bambang Test', 'Perpanjangan 1 Tahun', 10000000, 100000000000, 0, 'OVERPAID',
          '{"invoiceNo":"INV-TEST-PAID","totalTagihan":10000000,"dibayar":100000000000}', '2026-11-03 10:00:00'
        )
      `).run();

      // Insert the existing valid payment from runtime order creation
      testDb.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, status_verifikasi, kas_kantor_id, idempotency_key, catatan, tanggal_bayar, created_at
        ) VALUES (
          991, 'INV-TEST-PAID', 'ORD-TEST-PAID', 100000000000, 'Transfer Bank', 'TERVERIFIKASI', NULL, 'REQ-RUNTIME-INITIAL', 'Pembayaran awal order', '2026-11-03 10:00:00', '2026-11-03 10:00:00'
        )
      `).run();

      // Verify before backfill: exactly 1 payment
      const beforeCount = (testDb.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-TEST-PAID'").get() as any).c;
      assert.strictEqual(beforeCount, 1);

      // Run backfill
      const result = backfillHistoricalFinanceData(testDb);

      // Verify after backfill: STILL exactly 1 payment! NO duplicate synthetic payment created!
      const afterPayments = testDb.prepare("SELECT * FROM invoice_payments WHERE invoice_no = 'INV-TEST-PAID'").all() as any[];
      assert.strictEqual(
        afterPayments.length,
        1,
        "Invoice with existing valid payment must NOT receive a duplicate synthetic payment!"
      );
      assert.strictEqual(afterPayments[0].id, 991);
      assert.strictEqual(afterPayments[0].idempotency_key, "REQ-RUNTIME-INITIAL");

      closeDb();
    } finally {
      closeDb();
      try {
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        if (fs.existsSync(tempDbPath + "-wal")) fs.unlinkSync(tempDbPath + "-wal");
        if (fs.existsSync(tempDbPath + "-shm")) fs.unlinkSync(tempDbPath + "-shm");
      } catch {}
    }
  });

  await t.test("6. Invoice without payment record gets historical payment according to backfill rules", () => {
    const tempDbPath = path.join(
      os.tmpdir(),
      `sun89-test-backfill-6-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`
    );

    try {
      const testDb = initDatabase({ runSchema: true, targetPath: tempDbPath });

      // Insert order first to satisfy foreign key
      testDb.prepare(`
        INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, total_biaya, data_json, samsat_tujuan_id, created_at)
        VALUES ('ORD-TEST-LEGACY', 'Legacy Customer', '0812345678', 'Perpanjangan 1 Tahun', 'B 5678 EF', 1500000, '{}', NULL, '2026-10-20 10:00:00')
      `).run();

      // Insert a genuine historical invoice that has paid balance but zero payment records
      testDb.prepare(`
        INSERT INTO finance_invoices (
          id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at
        ) VALUES (
          102, 'INV-TEST-LEGACY', 'ORD-TEST-LEGACY', 'Legacy Customer', 'Perpanjangan 1 Tahun', 1500000, 1500000, 0, 'Lunas',
          '{"invoiceNo":"INV-TEST-LEGACY","totalTagihan":1500000,"dibayar":1500000}', '2026-10-20 10:00:00'
        )
      `).run();

      // Verify before backfill: 0 payments
      const beforeCount = (testDb.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-TEST-LEGACY'").get() as any).c;
      assert.strictEqual(beforeCount, 0);

      // Run backfill
      const result = backfillHistoricalFinanceData(testDb);
      assert.ok(result.backfilledPayments >= 1, "Should backfill legacy invoice without payments");

      // Verify after backfill: exactly 1 payment synthesized
      const afterPayments = testDb.prepare("SELECT * FROM invoice_payments WHERE invoice_no = 'INV-TEST-LEGACY'").all() as any[];
      assert.strictEqual(afterPayments.length, 1);
      assert.strictEqual(afterPayments[0].nominal, 1500000);
      assert.strictEqual(afterPayments[0].status_verifikasi, "TERVERIFIKASI");
      assert.strictEqual(afterPayments[0].idempotency_key, "BACKFILL-INV-TEST-LEGACY-INIT");

      closeDb();
    } finally {
      closeDb();
      try {
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        if (fs.existsSync(tempDbPath + "-wal")) fs.unlinkSync(tempDbPath + "-wal");
        if (fs.existsSync(tempDbPath + "-shm")) fs.unlinkSync(tempDbPath + "-shm");
      } catch {}
    }
  });

  await t.test("7. Repeated backfill is completely idempotent and produces NO duplicate payments", () => {
    const tempDbPath = path.join(
      os.tmpdir(),
      `sun89-test-backfill-7-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`
    );

    try {
      const testDb = initDatabase({ runSchema: true, targetPath: tempDbPath });

      // Insert orders first to satisfy foreign keys
      testDb.prepare(`
        INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, total_biaya, data_json, samsat_tujuan_id, created_at)
        VALUES 
        ('ORD-IDEM-1', 'Cust 1', '0812345678', 'Perpanjangan 1 Tahun', 'B 1111 AA', 2000000, '{}', NULL, '2026-10-21'),
        ('ORD-IDEM-2', 'Cust 2', '0812345678', 'Perpanjangan 1 Tahun', 'B 2222 BB', 5000000, '{}', NULL, '2026-10-22')
      `).run();

      // Insert one paid invoice and one legacy invoice
      testDb.prepare(`
        INSERT INTO finance_invoices (
          id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at
        ) VALUES 
        (201, 'INV-IDEM-1', 'ORD-IDEM-1', 'Cust 1', 'Perpanjangan 1 Tahun', 2000000, 2000000, 0, 'Lunas', '{"totalTagihan":2000000,"dibayar":2000000}', '2026-10-21'),
        (202, 'INV-IDEM-2', 'ORD-IDEM-2', 'Cust 2', 'Perpanjangan 1 Tahun', 5000000, 5000000, 0, 'Lunas', '{"totalTagihan":5000000,"dibayar":5000000}', '2026-10-22')
      `).run();

      // First run: should backfill 2 payments
      const result1 = backfillHistoricalFinanceData(testDb);
      assert.strictEqual(result1.backfilledPayments, 2);

      const count1 = (testDb.prepare("SELECT COUNT(*) as c FROM invoice_payments").get() as any).c;
      assert.strictEqual(count1, 2);

      // Second run: must be 100% idempotent and NOT insert any new payments!
      const result2 = backfillHistoricalFinanceData(testDb);
      assert.strictEqual(
        result2.backfilledPayments,
        0,
        "Second backfill run must synthesize 0 additional payments!"
      );

      const count2 = (testDb.prepare("SELECT COUNT(*) as c FROM invoice_payments").get() as any).c;
      assert.strictEqual(count2, 2, "Total payment count must remain strictly identical");

      // Third run: still 0 new payments
      const result3 = backfillHistoricalFinanceData(testDb);
      assert.strictEqual(result3.backfilledPayments, 0);

      const count3 = (testDb.prepare("SELECT COUNT(*) as c FROM invoice_payments").get() as any).c;
      assert.strictEqual(count3, 2);

      closeDb();
    } finally {
      closeDb();
      try {
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        if (fs.existsSync(tempDbPath + "-wal")) fs.unlinkSync(tempDbPath + "-wal");
        if (fs.existsSync(tempDbPath + "-shm")) fs.unlinkSync(tempDbPath + "-shm");
      } catch {}
    }
  });

  await t.test("8. Operational write safety guard blocks unauthorized write access", () => {
    closeDb();
    setOperationalWriteGranted(false);

    const operationalPath = getOperationalDbPath();

    // In non-server context, calling getDb on operational DB must throw safety error
    assert.throws(
      () => {
        getDb({ targetPath: operationalPath });
      },
      /FATAL.*SAFETY GUARD/i,
      "Expected access to operational database without authorization to throw FATAL SAFETY GUARD"
    );
  });

  await t.test("9. Payment Validity Semantics & Void Safety Suite (Scenarios 1-8)", () => {
    const tempDbPath = path.join(
      os.tmpdir(),
      `sun89-test-void-safety-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`
    );

    try {
      const testDb = initDatabase({ runSchema: true, targetPath: tempDbPath });

      // 1. Setup sample orders to satisfy foreign key constraints
      const insertOrder = testDb.prepare(`
        INSERT INTO orders (
          order_no, customer, nomor_hp, layanan, nopol, current_step,
          current_stage_name, payment_status, total_biaya, samsat_tujuan_id, data_json
        ) VALUES (?, 'Customer Test', '08123456789', 'Perpanjangan STNK', 'B 1234 ABC', 1, 'Verifikasi', 'Lunas', 1000000, null, '{}')
      `);
      insertOrder.run("ORD-VERIFIED");
      insertOrder.run("ORD-PENDING");
      insertOrder.run("ORD-REJECTED");
      insertOrder.run("ORD-LEGACY-VALID");
      insertOrder.run("ORD-VOID");
      insertOrder.run("ORD-EMPTY");

      // 2. Setup invoices (all have total_tagihan = 1.000.000 and dibayar = 1.000.000)
      const insertInv = testDb.prepare(`
        INSERT INTO finance_invoices (
          id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at
        ) VALUES (?, ?, ?, 'Customer Test', 'Perpanjangan STNK', 1000000, 1000000, 0, 'PAID', '{}', datetime('now'))
      `);
      insertInv.run(301, "INV-VERIFIED", "ORD-VERIFIED");
      insertInv.run(302, "INV-PENDING", "ORD-PENDING");
      insertInv.run(303, "INV-REJECTED", "ORD-REJECTED");
      insertInv.run(304, "INV-LEGACY-VALID", "ORD-LEGACY-VALID");
      insertInv.run(305, "INV-VOID", "ORD-VOID");
      insertInv.run(306, "INV-EMPTY", "ORD-EMPTY");

      // 3. Setup payment records
      const insertPay = testDb.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, nama_bank,
          tanggal_bayar, status_verifikasi, idempotency_key, is_void
        ) VALUES (?, ?, ?, 1000000, 'Transfer BCA', 'BCA', '2026-11-04', ?, ?, ?)
      `);
      // Scenario 1: TERVERIFIKASI
      insertPay.run(401, "INV-VERIFIED", "ORD-VERIFIED", "TERVERIFIKASI", "KEY-VERIFIED", 0);
      // Scenario 2: MENUNGGU_VERIFIKASI (Pending)
      insertPay.run(402, "INV-PENDING", "ORD-PENDING", "MENUNGGU_VERIFIKASI", "KEY-PENDING", 0);
      // Scenario 3: DITOLAK (Rejected)
      insertPay.run(403, "INV-REJECTED", "ORD-REJECTED", "DITOLAK", "KEY-REJECTED", 0);
      // Scenario 4: VALID (Legacy)
      insertPay.run(404, "INV-LEGACY-VALID", "ORD-LEGACY-VALID", "VALID", "KEY-LEGACY-VALID", 0);
      // Scenario 5: VOID (is_void = 1)
      insertPay.run(405, "INV-VOID", "ORD-VOID", "VOID", "KEY-VOID", 1);
      // Scenario 6: EMPTY (no payments inserted for INV-EMPTY)

      // Baseline checks before backfill
      const kasBeforeCount = (testDb.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
      const voidInvBefore = testDb.prepare("SELECT dibayar, sisa, status FROM finance_invoices WHERE invoice_no = 'INV-VOID'").get() as any;
      assert.strictEqual(voidInvBefore.dibayar, 1000000);

      // Run backfill execution
      const backfillResult = backfillHistoricalFinanceData(testDb);

      const getPayments = (invNo: string) => {
        return testDb.prepare("SELECT id, nominal, status_verifikasi, is_void, idempotency_key FROM invoice_payments WHERE invoice_no = ?").all(invNo) as any[];
      };

      // Scenario 1: Verified payment -> does NOT create duplicate
      const p1 = getPayments("INV-VERIFIED");
      assert.strictEqual(p1.length, 1, "Scenario 1: Verified payment must not receive duplicate");
      assert.strictEqual(p1[0].idempotency_key, "KEY-VERIFIED");

      // Scenario 2: Pending payment -> does NOT create duplicate
      const p2 = getPayments("INV-PENDING");
      assert.strictEqual(p2.length, 1, "Scenario 2: Pending payment must not receive duplicate");
      assert.strictEqual(p2[0].idempotency_key, "KEY-PENDING");
      assert.strictEqual(p2[0].status_verifikasi, "MENUNGGU_VERIFIKASI");

      // Scenario 3: Rejected payment -> does NOT create duplicate
      const p3 = getPayments("INV-REJECTED");
      assert.strictEqual(p3.length, 1, "Scenario 3: Rejected payment must not receive duplicate");
      assert.strictEqual(p3[0].idempotency_key, "KEY-REJECTED");
      assert.strictEqual(p3[0].status_verifikasi, "DITOLAK");

      // Scenario 4: Legacy VALID payment -> does NOT create duplicate
      const p4 = getPayments("INV-LEGACY-VALID");
      assert.strictEqual(p4.length, 1, "Scenario 4: Legacy VALID payment must not receive duplicate");
      assert.strictEqual(p4[0].idempotency_key, "KEY-LEGACY-VALID");

      // Scenario 5: Void payment with dibayar > 0 -> must NOT create synthetic payment!
      const p5 = getPayments("INV-VOID");
      assert.strictEqual(p5.length, 1, "Scenario 5: Void payment must NOT trigger synthetic payment creation!");
      assert.strictEqual(p5[0].idempotency_key, "KEY-VOID");
      assert.strictEqual(p5[0].is_void, 1);

      // Scenario 6: Invoice without payment record -> still creates single synthetic payment
      const p6 = getPayments("INV-EMPTY");
      assert.strictEqual(p6.length, 1, "Scenario 6: Empty legacy invoice must receive exactly 1 synthetic payment");
      assert.strictEqual(p6[0].idempotency_key, "BACKFILL-INV-EMPTY-INIT");
      assert.strictEqual(p6[0].status_verifikasi, "TERVERIFIKASI");
      assert.strictEqual(p6[0].nominal, 1000000);

      // Scenario 7: Invoice void with dibayar > 0 -> does not mutate dibayar or create new cash receipt
      const voidInvAfter = testDb.prepare("SELECT dibayar, sisa, status FROM finance_invoices WHERE invoice_no = 'INV-VOID'").get() as any;
      assert.strictEqual(voidInvAfter.dibayar, voidInvBefore.dibayar, "Scenario 7: dibayar must NOT be mutated by backfill");
      const kasAfterCount = (testDb.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
      assert.strictEqual(kasAfterCount, kasBeforeCount, "Scenario 7: Zero new cash receipts created in kas_kantor");

      // Scenario 8: Repeated backfill -> remains strictly idempotent
      for (let retry = 1; retry <= 3; retry++) {
        const retryStats = backfillHistoricalFinanceData(testDb);
        assert.strictEqual(retryStats.backfilledPayments, 0, `Scenario 8: Retry ${retry} must synthesize 0 payments`);
      }
      assert.strictEqual(getPayments("INV-VOID").length, 1, "Scenario 8: Total payments for void invoice remains 1");
      assert.strictEqual(getPayments("INV-EMPTY").length, 1, "Scenario 8: Total payments for empty invoice remains 1");

      closeDb();
    } finally {
      closeDb();
      try {
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        if (fs.existsSync(tempDbPath + "-wal")) fs.unlinkSync(tempDbPath + "-wal");
        if (fs.existsSync(tempDbPath + "-shm")) fs.unlinkSync(tempDbPath + "-shm");
      } catch {}
    }
  });

  await t.test("10. Read-only disaster recovery verification functions without write permissions", () => {
    const tempDbPath = path.join(
      os.tmpdir(),
      `sun89-test-dr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`
    );
    const tempUploadsDir = path.join(
      os.tmpdir(),
      `sun89-test-uploads-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    );

    try {
      if (!fs.existsSync(tempUploadsDir)) {
        fs.mkdirSync(tempUploadsDir, { recursive: true });
      }

      // Bootstrap schema on temp db
      const initDb = initDatabase({ runSchema: true, targetPath: tempDbPath });
      closeDb();

      // Verify DR on the isolated db and uploads directory
      const drResult = verifyDisasterRecovery(tempDbPath, tempUploadsDir);
      assert.strictEqual(drResult.valid, true, "DR verification must be valid for pristine db");
      assert.strictEqual(drResult.dbIntegrity, "ok", "SQLite PRAGMA integrity_check must return ok");
      assert.strictEqual(drResult.checkedDocuments, 0, "Checked documents count must be 0 for empty db");

      // Verify that opening with readOnly: true rejects write operations
      const roConn = new DatabaseSync(tempDbPath, { readOnly: true });
      assert.throws(
        () => {
          roConn.exec("CREATE TABLE should_fail (id INT);");
        },
        /readonly database/i,
        "Read-only connection must strictly forbid table creation"
      );
      roConn.close();
    } finally {
      closeDb();
      try {
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        if (fs.existsSync(tempDbPath + "-wal")) fs.unlinkSync(tempDbPath + "-wal");
        if (fs.existsSync(tempDbPath + "-shm")) fs.unlinkSync(tempDbPath + "-shm");
        if (fs.existsSync(tempUploadsDir)) fs.rmSync(tempUploadsDir, { recursive: true, force: true });
      } catch {}
    }
  });
});
