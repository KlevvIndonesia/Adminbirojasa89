import test from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import {
  initDatabase,
  closeDb,
  runInTransaction,
  isConnectionCorrupted,
} from "../server/src/database/db";
import {
  initializeSchema,
  backfillHistoricalFinanceData,
  reconcileLegacyDocuments,
  matchCandidateIdempotencyKey,
  isValidCalendarDate,
  isValidIsoTimestamp,
  migrateDocumentsTable,
  migratePaymentMethodsTable,
  consolidateEmployeesAndUsersMigration,
  migrateFileDeletionJobsTable,
  migratePricingTables,
} from "../server/src/database/schema";
import { seedDatabase } from "../server/src/database/seed";
import { normalizeToWibCalendarDate } from "../server/src/utils/dateNormalizer";

function createTempDbPath(prefix: string): string {
  return path.join(
    os.tmpdir(),
    `sun89-stepD-${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`
  );
}

function cleanupTempDb(dbPath: string): void {
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + "-wal")) fs.unlinkSync(dbPath + "-wal");
    if (fs.existsSync(dbPath + "-shm")) fs.unlinkSync(dbPath + "-shm");
  } catch {}
}

function insertTestOrder(
  db: DatabaseSync,
  orderNo: string,
  customer: string,
  totalBiaya: number,
  dataJson: string = "{}",
  createdAt: string = "2026-11-01 10:00:00"
): void {
  db.prepare(`
    INSERT INTO orders (
      order_no, customer, nomor_hp, layanan, nopol, total_biaya,
      data_json, samsat_asal_id, samsat_tujuan_id, created_at
    ) VALUES (?, ?, '08123456789', 'Perpanjangan STNK', 'B 1234 TEST', ?, ?, NULL, NULL, ?)
  `).run(orderNo, customer, totalBiaya, dataJson, createdAt);
}

function setupNullableInvoicesTable(db: DatabaseSync): void {
  db.exec(`
    DROP TABLE IF EXISTS invoice_payments;
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS finance_invoices;

    CREATE TABLE finance_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      order_no TEXT NOT NULL,
      customer TEXT NOT NULL,
      layanan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNPAID',
      total_tagihan REAL NOT NULL DEFAULT 0,
      dibayar REAL NOT NULL DEFAULT 0,
      sisa REAL NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      biaya_samsat REAL,
      pendapatan_jasa REAL,
      overpayment REAL,
      settlement_condition TEXT,
      refund_status TEXT,
      cashback_nominal REAL,
      cashback_status TEXT,
      cashback_doc_id TEXT,
      profit_final REAL,
      profit_status TEXT,
      is_explicit_zero INTEGER DEFAULT 0
    );

    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      order_no TEXT,
      invoice_id TEXT,
      document_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      storage_name TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_by_id TEXT,
      uploaded_by_role TEXT,
      metadata_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_no) REFERENCES orders(order_no) ON DELETE SET NULL,
      FOREIGN KEY (invoice_id) REFERENCES finance_invoices(invoice_no) ON DELETE SET NULL
    );

    CREATE TABLE invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id TEXT UNIQUE,
      invoice_no TEXT NOT NULL,
      order_no TEXT,
      nominal REAL NOT NULL,
      metode_pembayaran TEXT NOT NULL,
      nama_bank TEXT,
      nomor_rekening TEXT,
      tanggal_bayar TEXT NOT NULL,
      document_id TEXT REFERENCES documents(id),
      status_verifikasi TEXT NOT NULL DEFAULT 'TERVERIFIKASI',
      idempotency_key TEXT UNIQUE NOT NULL,
      verified_by TEXT,
      verified_at TEXT,
      catatan TEXT,
      kas_kantor_id INTEGER REFERENCES kas_kantor(id),
      is_void INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_no) REFERENCES finance_invoices(invoice_no) ON DELETE CASCADE
    );
  `);
}

test("Phase 4B Batch 2B Step D — Startup Backfill Safety & Integrity Suite", async (t) => {
  closeDb();

  /* =========================================================================
   * BATCH D1: Payment Identity & Deduplication (AC-D-01)
   * ========================================================================= */

  await t.test("D1-1: Exact idempotency key match (including stable source ID in key) deduplicates cleanly", () => {
    const dbPath = createTempDbPath("d1-1");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      const orderJson = {
        payment: {
          paymentRecords: [
            {
              id: "pay-1793803600982",
              nominal: 350000,
              tanggal: "2026-11-04T14:46:40.982Z",
              metodePembayaran: "Transfer Bank",
              namaBank: "BCA",
              statusVerifikasi: "TERVERIFIKASI",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-1126-001", "Test Customer", 350000, JSON.stringify(orderJson), "2026-11-04 14:46:40");

      db.prepare(`
        INSERT INTO finance_invoices (
          id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at,
          biaya_samsat, pendapatan_jasa, profit_final
        ) VALUES (
          1, 'INV-1126-001', 'ORD-1126-001', 'Test Customer', 'Perpanjangan STNK', 350000, 350000, 0, 'Lunas',
          ?, '2026-11-04 14:46:40', 300000, 50000, 50000
        )
      `).run(JSON.stringify(orderJson));

      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, nama_bank,
          nomor_rekening, tanggal_bayar, status_verifikasi, idempotency_key, verified_by, verified_at, catatan
        ) VALUES (
          1, 'INV-1126-001', 'ORD-1126-001', 350000, 'Transfer Bank', 'BCA',
          '1234567890', '2026-11-04', 'TERVERIFIKASI', 'BACKFILL-INV-1126-001-pay-1793803600982', 'Admin', '2026-11-04 15:00:00', 'Historical'
        )
      `).run();

      const beforeCount = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-1126-001'").get() as any).c;
      assert.strictEqual(beforeCount, 1);

      const result = backfillHistoricalFinanceData(db);
      assert.strictEqual(result.backfilledPayments, 0, "Must deduplicate via stable source ID key");

      const afterCount = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-1126-001'").get() as any).c;
      assert.strictEqual(afterCount, 1, "Payment count must strictly remain 1");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-2: Canonical payment_id match deduplicates cleanly when nominal and date match", () => {
    const dbPath = createTempDbPath("d1-2");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      const orderJson = {
        payment: {
          paymentRecords: [
            {
              paymentId: "PAY-CANONICAL-001",
              nominal: 500000,
              tanggal: "2026-11-05T10:00:00.000Z",
              metodePembayaran: "Transfer BCA",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-CANON", "Cust Canon", 500000, JSON.stringify(orderJson), "2026-11-05 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (10, 'INV-CANON', 'ORD-CANON', 'Cust Canon', 'Perpanjangan', 500000, 500000, 0, 'Lunas', ?, '2026-11-05 10:00:00')
      `).run(JSON.stringify(orderJson));

      db.prepare(`
        INSERT INTO invoice_payments (
          id, payment_id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key
        ) VALUES (
          10, 'PAY-CANONICAL-001', 'INV-CANON', 'ORD-CANON', 500000, 'Transfer BCA', '2026-11-05', 'TERVERIFIKASI', 'CUSTOM-KEY-10'
        )
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledPayments, 0, "Must deduplicate via canonical payment_id");
      assert.strictEqual(res.ambiguousPayments.length, 0);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-3: Canonical payment_id match fails closed into ambiguousPayments when attributes conflict", () => {
    const dbPath = createTempDbPath("d1-3");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      const orderJson = {
        payment: {
          paymentRecords: [
            {
              paymentId: "PAY-CANONICAL-CONFLICT",
              nominal: 750000, // Conflict: 750k vs 500k in DB
              tanggal: "2026-11-05T10:00:00.000Z",
              metodePembayaran: "Transfer BCA",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-CANON-C", "Cust Canon C", 750000, JSON.stringify(orderJson), "2026-11-05 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (11, 'INV-CANON-C', 'ORD-CANON-C', 'Cust Canon C', 'Perpanjangan', 750000, 750000, 0, 'Lunas', ?, '2026-11-05 10:00:00')
      `).run(JSON.stringify(orderJson));

      db.prepare(`
        INSERT INTO invoice_payments (
          id, payment_id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key
        ) VALUES (
          11, 'PAY-CANONICAL-CONFLICT', 'INV-CANON-C', 'ORD-CANON-C', 500000, 'Transfer BCA', '2026-11-05', 'TERVERIFIKASI', 'CUSTOM-KEY-11'
        )
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledPayments, 0, "Must NOT insert conflicting payment");
      assert.strictEqual(res.ambiguousPayments.length, 1, "Must fail closed into ambiguousPayments");
      assert.ok(res.ambiguousPayments[0].reason.includes("Canonical payment_id"));

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-4: Receipt candidateDocId matches existing payment with consistent nominal & date: deduplicates cleanly", () => {
    const dbPath = createTempDbPath("d1-4");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      // Insert document fixture to satisfy FK
      db.prepare(`
        INSERT INTO documents (id, order_no, document_type, original_name, storage_name, mime_type, size_bytes, sha256, uploaded_by)
        VALUES ('DOC-RECEIPT-01', NULL, 'RECEIPT', 'receipt.jpg', 'storage-receipt-01.jpg', 'image/jpeg', 1024, 'sha1', 'Admin')
      `).run();

      const orderJson = {
        payment: {
          paymentRecords: [
            {
              nominal: 450000,
              tanggal: "2026-11-06T08:00:00.000Z",
              metodePembayaran: "Transfer BCA",
              buktiPembayaran: { documentId: "DOC-RECEIPT-01" },
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-RCPT", "Cust Rcpt", 450000, JSON.stringify(orderJson), "2026-11-06 08:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (12, 'INV-RCPT', 'ORD-RCPT', 'Cust Rcpt', 'Perpanjangan', 450000, 450000, 0, 'Lunas', ?, '2026-11-06 08:00:00')
      `).run(JSON.stringify(orderJson));

      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, document_id, status_verifikasi, idempotency_key
        ) VALUES (
          12, 'INV-RCPT', 'ORD-RCPT', 450000, 'Transfer BCA', '2026-11-06', 'DOC-RECEIPT-01', 'TERVERIFIKASI', 'OTHER-KEY-12'
        )
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledPayments, 0, "Must deduplicate via matching receipt document ID");
      assert.strictEqual(res.ambiguousPayments.length, 0);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-5: Receipt candidateDocId matches existing payment but nominal or date conflicts: fails closed", () => {
    const dbPath = createTempDbPath("d1-5");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      // Insert document fixture to satisfy FK
      db.prepare(`
        INSERT INTO documents (id, order_no, document_type, original_name, storage_name, mime_type, size_bytes, sha256, uploaded_by)
        VALUES ('DOC-RECEIPT-CONFLICT', NULL, 'RECEIPT', 'receipt.jpg', 'storage-receipt-c.jpg', 'image/jpeg', 1024, 'sha2', 'Admin')
      `).run();

      const orderJson = {
        payment: {
          paymentRecords: [
            {
              nominal: 900000, // Conflict: 900k vs 450k in DB
              tanggal: "2026-11-06T08:00:00.000Z",
              metodePembayaran: "Transfer BCA",
              buktiPembayaran: { documentId: "DOC-RECEIPT-CONFLICT" },
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-RCPT-C", "Cust Rcpt C", 900000, JSON.stringify(orderJson), "2026-11-06 08:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (13, 'INV-RCPT-C', 'ORD-RCPT-C', 'Cust Rcpt C', 'Perpanjangan', 900000, 900000, 0, 'Lunas', ?, '2026-11-06 08:00:00')
      `).run(JSON.stringify(orderJson));

      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, document_id, status_verifikasi, idempotency_key
        ) VALUES (
          13, 'INV-RCPT-C', 'ORD-RCPT-C', 450000, 'Transfer BCA', '2026-11-06', 'DOC-RECEIPT-CONFLICT', 'TERVERIFIKASI', 'OTHER-KEY-13'
        )
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledPayments, 0, "Must NOT insert conflicting receipt payment");
      assert.strictEqual(res.ambiguousPayments.length, 1, "Must fail closed into ambiguousPayments");
      assert.ok(res.ambiguousPayments[0].reason.includes("Document ID 'DOC-RECEIPT-CONFLICT' matches existing record"));

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-6: Distinct source IDs with same nominal and date remain separate (no deduplication between distinct partials)", () => {
    const dbPath = createTempDbPath("d1-6");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      const orderJson = {
        payment: {
          paymentRecords: [
            {
              id: "pay-term-1",
              nominal: 500000,
              tanggal: "2026-11-07T08:00:00.000Z",
              metodePembayaran: "Transfer BCA",
            },
            {
              id: "pay-term-2",
              nominal: 500000,
              tanggal: "2026-11-07T12:00:00.000Z",
              metodePembayaran: "Transfer BCA",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-DISTINCT", "Cust Distinct", 1000000, JSON.stringify(orderJson), "2026-11-07 08:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (14, 'INV-DISTINCT', 'ORD-DISTINCT', 'Cust Distinct', 'Perpanjangan', 1000000, 1000000, 0, 'Lunas', ?, '2026-11-07 08:00:00')
      `).run(JSON.stringify(orderJson));

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledPayments, 2, "Both distinct partial payments must be inserted separately");
      assert.strictEqual(res.ambiguousPayments.length, 0);

      const rows = db.prepare("SELECT nominal, idempotency_key FROM invoice_payments WHERE invoice_no = 'INV-DISTINCT' ORDER BY id ASC").all() as any[];
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].idempotency_key, "BACKFILL-INV-DISTINCT-pay-term-1");
      assert.strictEqual(rows[1].idempotency_key, "BACKFILL-INV-DISTINCT-pay-term-2");

      const res2 = backfillHistoricalFinanceData(db);
      assert.strictEqual(res2.backfilledPayments, 0);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-7: Candidate lacking canonical payment_id, stable source ID, and receipt ID, sharing nominal & date with existing payment fails closed", () => {
    const dbPath = createTempDbPath("d1-7");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      const orderJson = {
        payment: {
          paymentRecords: [
            {
              nominal: 350000,
              tanggal: "2026-11-04T14:46:40.982Z",
              metodePembayaran: "Transfer Bank",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-UNIDENT", "Cust Unident", 350000, JSON.stringify(orderJson), "2026-11-04 14:46:40");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (15, 'INV-UNIDENT', 'ORD-UNIDENT', 'Cust Unident', 'Perpanjangan', 350000, 350000, 0, 'Lunas', ?, '2026-11-04 14:46:40')
      `).run(JSON.stringify(orderJson));

      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key
        ) VALUES (
          15, 'INV-UNIDENT', 'ORD-UNIDENT', 350000, 'Transfer Bank', '2026-11-04', 'TERVERIFIKASI', 'UNIDENT-EXISTING-KEY'
        )
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledPayments, 0, "Must NOT insert duplicate");
      assert.strictEqual(res.ambiguousPayments.length, 1, "Must fail closed into ambiguousPayments");
      assert.ok(res.ambiguousPayments[0].reason.includes("Unidentifiable payment match"));

      const payCount = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-UNIDENT'").get() as any).c;
      assert.strictEqual(payCount, 1, "Payment count must remain 1");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-8: Candidate without stable identity fails closed on Run 1 and Replay (never inserted)", () => {
    const dbPath = createTempDbPath("d1-8");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      const orderJson = {
        payment: {
          paymentRecords: [
            {
              nominal: 275000,
              tanggal: "2026-11-06T10:00:00.000Z",
              metodePembayaran: "Tunai",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-FP-NEW", "Cust FP New", 275000, JSON.stringify(orderJson), "2026-11-06 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (16, 'INV-FP-NEW', 'ORD-FP-NEW', 'Cust FP New', 'Cek Fisik', 275000, 275000, 0, 'Lunas', ?, '2026-11-06 10:00:00')
      `).run(JSON.stringify(orderJson));

      // Run 1: Must fail closed into ambiguousPayments immediately on first run (0 inserted)
      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledPayments, 0, "Unidentifiable candidate must NOT be inserted on Run 1");
      assert.strictEqual(res.ambiguousPayments.length, 1, "Must be recorded in ambiguousPayments on Run 1");
      assert.ok(res.ambiguousPayments[0].reason.includes("Unidentifiable payment match"));

      const payCount1 = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-FP-NEW'").get() as any).c;
      assert.strictEqual(payCount1, 0, "No payments may be inserted in database");

      // Run 2 (Replay): Must remain 100% deterministic (0 inserted, 1 ambiguous)
      const res2 = backfillHistoricalFinanceData(db);
      assert.strictEqual(res2.backfilledPayments, 0, "Replay must NOT insert candidate");
      assert.strictEqual(res2.ambiguousPayments.length, 1, "Replay must remain deterministic with 1 ambiguous payment");
      assert.ok(res2.ambiguousPayments[0].reason.includes("Unidentifiable payment match"));

      const payCount2 = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-FP-NEW'").get() as any).c;
      assert.strictEqual(payCount2, 0, "Database must remain completely empty for unidentifiable candidate");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-9: Midnight WIB boundary handling (16:59:59Z vs 17:00:00Z)", () => {
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-04T16:59:59.000Z"), "2026-11-04");
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-04T17:00:00.000Z"), "2026-11-05");
  });

  await t.test("D1-10: Repeated backfill is completely idempotent (0 additions across 3 runs)", () => {
    const dbPath = createTempDbPath("d1-10");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      insertTestOrder(db, "ORD-RPT", "Cust RPT", 1000000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (70, 'INV-RPT', 'ORD-RPT', 'Cust RPT', 'Layanan', 1000000, 1000000, 0, 'Lunas', '{}', '2026-11-01 10:00:00')
      `).run();

      const r1 = backfillHistoricalFinanceData(db);
      assert.strictEqual(r1.backfilledPayments, 1);

      const r2 = backfillHistoricalFinanceData(db);
      assert.strictEqual(r2.backfilledPayments, 0);

      const r3 = backfillHistoricalFinanceData(db);
      assert.strictEqual(r3.backfilledPayments, 0);

      const count = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-RPT'").get() as any).c;
      assert.strictEqual(count, 1);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-11: Substring collision safety: PAY-12 does NOT match PAY-123 and PAY-123 does NOT match PAY-12", () => {
    const dbPath = createTempDbPath("d1-11");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      // Invoice 1: Existing payment is PAY-123, candidate is PAY-12
      const orderJson1 = {
        payment: {
          paymentRecords: [
            {
              id: "PAY-12",
              nominal: 500000,
              tanggal: "2026-11-05T10:00:00.000Z",
              metodePembayaran: "Transfer BCA",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-COL-1", "Cust Col 1", 1000000, JSON.stringify(orderJson1), "2026-11-05 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (81, 'INV-COL-1', 'ORD-COL-1', 'Cust Col 1', 'Layanan', 1000000, 1000000, 0, 'Lunas', ?, '2026-11-05 10:00:00')
      `).run(JSON.stringify(orderJson1));

      // Pre-existing payment with PAY-123
      db.prepare(`
        INSERT INTO invoice_payments (
          invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key
        ) VALUES (
          'INV-COL-1', 'ORD-COL-1', 500000, 'Transfer BCA', '2026-11-05', 'TERVERIFIKASI', 'BACKFILL-INV-COL-1-PAY-123'
        )
      `).run();

      const res1 = backfillHistoricalFinanceData(db);
      assert.strictEqual(res1.backfilledPayments, 1, "PAY-12 must NOT collide with PAY-123 and must be backfilled");
      assert.strictEqual(res1.ambiguousPayments.length, 0);

      const rows1 = db.prepare("SELECT idempotency_key FROM invoice_payments WHERE invoice_no = 'INV-COL-1' ORDER BY id ASC").all() as any[];
      assert.strictEqual(rows1.length, 2);
      assert.strictEqual(rows1[0].idempotency_key, "BACKFILL-INV-COL-1-PAY-123");
      assert.strictEqual(rows1[1].idempotency_key, "BACKFILL-INV-COL-1-PAY-12");

      // Invoice 2: Reverse scenario: Existing payment is PAY-12, candidate is PAY-123
      const orderJson2 = {
        payment: {
          paymentRecords: [
            {
              id: "PAY-123",
              nominal: 600000,
              tanggal: "2026-11-05T11:00:00.000Z",
              metodePembayaran: "Transfer BCA",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-COL-2", "Cust Col 2", 1200000, JSON.stringify(orderJson2), "2026-11-05 11:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (82, 'INV-COL-2', 'ORD-COL-2', 'Cust Col 2', 'Layanan', 1200000, 1200000, 0, 'Lunas', ?, '2026-11-05 11:00:00')
      `).run(JSON.stringify(orderJson2));

      // Pre-existing payment with PAY-12
      db.prepare(`
        INSERT INTO invoice_payments (
          invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key
        ) VALUES (
          'INV-COL-2', 'ORD-COL-2', 600000, 'Transfer BCA', '2026-11-05', 'TERVERIFIKASI', 'BACKFILL-INV-COL-2-PAY-12'
        )
      `).run();

      const res2 = backfillHistoricalFinanceData(db);
      assert.strictEqual(res2.backfilledPayments, 1, "PAY-123 must NOT collide with PAY-12 and must be backfilled");
      assert.strictEqual(res2.ambiguousPayments.length, 0);

      const rows2 = db.prepare("SELECT idempotency_key FROM invoice_payments WHERE invoice_no = 'INV-COL-2' ORDER BY id ASC").all() as any[];
      assert.strictEqual(rows2.length, 2);
      assert.strictEqual(rows2[0].idempotency_key, "BACKFILL-INV-COL-2-PAY-12");
      assert.strictEqual(rows2[1].idempotency_key, "BACKFILL-INV-COL-2-PAY-123");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-12: Valid legacy backfill key formats (with ISO timestamp or date suffix) are recognized and deduplicated", () => {
    const dbPath = createTempDbPath("d1-12");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      const orderJson = {
        payment: {
          paymentRecords: [
            {
              id: "pay-1793803600982",
              nominal: 563000,
              tanggal: "2026-11-04T14:46:40.982Z",
              metodePembayaran: "Transfer Bank",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-LEGACY-EXACT", "Cust Leg", 563000, JSON.stringify(orderJson), "2026-11-04 14:46:40");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (83, 'INV-LEGACY-EXACT', 'ORD-LEGACY-EXACT', 'Cust Leg', 'Layanan', 563000, 563000, 0, 'Lunas', ?, '2026-11-04 14:46:40')
      `).run(JSON.stringify(orderJson));

      // Matches historical row 2 format in operational database!
      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key
        ) VALUES (
          83, 'INV-LEGACY-EXACT', 'ORD-LEGACY-EXACT', 563000, 'Transfer Bank', '2026-11-04', 'TERVERIFIKASI',
          'BACKFILL-INV-LEGACY-EXACT-pay-1793803600982-2026-11-04T14:46:40.982Z'
        )
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledPayments, 0, "Must deduplicate via exact legacy backfill key");
      assert.strictEqual(res.ambiguousPayments.length, 0);

      const count = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-LEGACY-EXACT'").get() as any).c;
      assert.strictEqual(count, 1, "Count must remain strictly 1");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-13: Ambiguous identity (nominal conflict or unparseable suffix) fails closed: no duplicate insertion and no silent skip", () => {
    const dbPath = createTempDbPath("d1-13");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      // Scenario A: Unparseable suffix trailing candidate source ID
      const orderJsonA = {
        payment: {
          paymentRecords: [
            {
              id: "PAY-TOKEN",
              nominal: 300000,
              tanggal: "2026-11-05T10:00:00.000Z",
              metodePembayaran: "Transfer BCA",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-AMB-A", "Cust Amb A", 300000, JSON.stringify(orderJsonA), "2026-11-05 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (84, 'INV-AMB-A', 'ORD-AMB-A', 'Cust Amb A', 'Layanan', 300000, 300000, 0, 'Lunas', ?, '2026-11-05 10:00:00')
      `).run(JSON.stringify(orderJsonA));

      // Key has unrecognized non-date suffix -PART2
      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key
        ) VALUES (
          84, 'INV-AMB-A', 'ORD-AMB-A', 300000, 'Transfer BCA', '2026-11-05', 'TERVERIFIKASI', 'BACKFILL-INV-AMB-A-PAY-TOKEN-PART2'
        )
      `).run();

      const resA = backfillHistoricalFinanceData(db);
      assert.strictEqual(resA.backfilledPayments, 0, "Must NOT insert duplicate");
      assert.strictEqual(resA.ambiguousPayments.length, 1, "Must fail closed into ambiguousPayments");
      assert.ok(resA.ambiguousPayments[0].reason.includes("Possible identity ambiguity"));

      const countA = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-AMB-A'").get() as any).c;
      assert.strictEqual(countA, 1, "Payment count must remain 1");

      // Scenario B: Exact key matches but nominal conflicts
      const orderJsonB = {
        payment: {
          paymentRecords: [
            {
              id: "PAY-NOM-CONFLICT",
              nominal: 700000, // Conflict: 700k candidate vs 500k in DB
              tanggal: "2026-11-05T10:00:00.000Z",
              metodePembayaran: "Transfer BCA",
            },
          ],
        },
      };

      insertTestOrder(db, "ORD-AMB-B", "Cust Amb B", 700000, JSON.stringify(orderJsonB), "2026-11-05 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (85, 'INV-AMB-B', 'ORD-AMB-B', 'Cust Amb B', 'Layanan', 700000, 700000, 0, 'Lunas', ?, '2026-11-05 10:00:00')
      `).run(JSON.stringify(orderJsonB));

      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key
        ) VALUES (
          85, 'INV-AMB-B', 'ORD-AMB-B', 500000, 'Transfer BCA', '2026-11-05', 'TERVERIFIKASI', 'BACKFILL-INV-AMB-B-PAY-NOM-CONFLICT'
        )
      `).run();

      const resB = backfillHistoricalFinanceData(db);
      assert.strictEqual(resB.backfilledPayments, 0, "Must NOT insert conflicting payment");
      const ambB = resB.ambiguousPayments.find(a => a.invoice_no === "INV-AMB-B");
      assert.ok(ambB, "Must report nominal conflict ambiguity for INV-AMB-B");
      assert.ok(ambB.reason.includes("nominal conflicts"));

      const countB = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-AMB-B'").get() as any).c;
      assert.strictEqual(countB, 1, "Payment count must remain 1");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-14: matchCandidateIdempotencyKey unit matrix validation", () => {
    const invNo = "INV-TEST";
    const canonicalKey = "BACKFILL-INV-TEST-PAY-12";
    const legacyKeys = [
      "BACKFILL-INV-TEST-PAY-12-2026-11-04T10:00:00.000Z",
      "BACKFILL-INV-TEST-PAY-12-init",
    ];

    // 1. Exact canonical match
    const r1 = matchCandidateIdempotencyKey("BACKFILL-INV-TEST-PAY-12", invNo, "PAY-12", canonicalKey, legacyKeys);
    assert.strictEqual(r1.isMatch, true);

    // 2. Exact legacy match
    const r2 = matchCandidateIdempotencyKey("BACKFILL-INV-TEST-PAY-12-init", invNo, "PAY-12", canonicalKey, legacyKeys);
    assert.strictEqual(r2.isMatch, true);

    // 3. Direct source ID
    const r3 = matchCandidateIdempotencyKey("PAY-12", invNo, "PAY-12", canonicalKey, legacyKeys);
    assert.strictEqual(r3.isMatch, true);

    // 4. Simple BACKFILL prefix
    const r4 = matchCandidateIdempotencyKey("BACKFILL-PAY-12", invNo, "PAY-12", canonicalKey, legacyKeys);
    assert.strictEqual(r4.isMatch, true);

    // 5. Token-delimited legacy with timestamp
    const r5 = matchCandidateIdempotencyKey("BACKFILL-INV-TEST-PAY-12-1793803600982", invNo, "PAY-12", canonicalKey, legacyKeys);
    assert.strictEqual(r5.isMatch, true);

    // 6. Substring collision (PAY-12 vs PAY-123): MUST NOT MATCH
    const r6 = matchCandidateIdempotencyKey("BACKFILL-INV-TEST-PAY-123", invNo, "PAY-12", canonicalKey, legacyKeys);
    assert.strictEqual(r6.isMatch, false);
    assert.strictEqual(r6.isAmbiguous, undefined);

    // 7. Substring collision reverse (PAY-123 vs PAY-12): MUST NOT MATCH
    const r7 = matchCandidateIdempotencyKey("BACKFILL-INV-TEST-PAY-12", invNo, "PAY-123", "BACKFILL-INV-TEST-PAY-123", []);
    assert.strictEqual(r7.isMatch, false);

    // 8. Ambiguous trailing token (e.g. -EXTRA)
    const r8 = matchCandidateIdempotencyKey("BACKFILL-INV-TEST-PAY-12-EXTRA", invNo, "PAY-12", canonicalKey, legacyKeys);
    assert.strictEqual(r8.isMatch, false);
    assert.strictEqual(r8.isAmbiguous, true);
  });

  await t.test("D1-15: D1-A Stable payment identity enforcement (nominal/date-only legacy key safety)", () => {
    const dbPath = createTempDbPath("d1-15");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      // Case A: Existing nominal-only legacy key vs multiple incoming candidates without source IDs
      const orderJsonA = {
        payment: {
          paymentRecords: [
            { nominal: 500000, tanggal: "2026-11-10", catatan: "Partial payment 1" },
            { nominal: 500000, tanggal: "2026-11-10", catatan: "Partial payment 2" },
          ],
        },
      };

      insertTestOrder(db, "ORD-D1A-1", "Cust D1A 1", 1000000, JSON.stringify(orderJsonA), "2026-11-10 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES ('INV-D1A-1', 'ORD-D1A-1', 'Cust D1A 1', 'Perpanjangan STNK', 1000000, 1000000, 0, 'Lunas', ?, '2026-11-10 10:00:00')
      `).run(JSON.stringify(orderJsonA));

      // Pre-existing nominal-only legacy key
      db.prepare(`
        INSERT INTO invoice_payments (
          invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key
        ) VALUES (
          'INV-D1A-1', 'ORD-D1A-1', 500000, 'Transfer BCA', '2026-11-10', 'TERVERIFIKASI', 'BACKFILL-INV-D1A-1-500000-2026-11-10'
        )
      `).run();

      const resA = backfillHistoricalFinanceData(db);
      assert.strictEqual(resA.backfilledPayments, 0, "Must NOT insert duplicate payments");
      assert.strictEqual(resA.ambiguousPayments.length, 2, "Both candidates without source ID must fail closed into ambiguity");
      assert.ok(resA.ambiguousPayments[0].reason.includes("Unidentifiable payment match"));
      assert.ok(resA.ambiguousPayments[1].reason.includes("Unidentifiable payment match"));

      const countA = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-D1A-1'").get() as any).c;
      assert.strictEqual(countA, 1, "Only pre-existing payment row remains");

      // Case B: Stable source IDs with identical nominal/date remain distinct
      const orderJsonB = {
        payment: {
          paymentRecords: [
            { id: "PAY-STABLE-1", nominal: 400000, tanggal: "2026-11-10", metodePembayaran: "Transfer BCA" },
            { id: "PAY-STABLE-2", nominal: 400000, tanggal: "2026-11-10", metodePembayaran: "Transfer Mandiri" },
          ],
        },
      };

      insertTestOrder(db, "ORD-D1A-2", "Cust D1A 2", 800000, JSON.stringify(orderJsonB), "2026-11-10 11:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES ('INV-D1A-2', 'ORD-D1A-2', 'Cust D1A 2', 'Perpanjangan STNK', 800000, 800000, 0, 'Lunas', ?, '2026-11-10 11:00:00')
      `).run(JSON.stringify(orderJsonB));

      const resB = backfillHistoricalFinanceData(db);
      assert.strictEqual(resB.backfilledPayments, 2, "Both distinct stable payments must be backfilled");
      const ambB = resB.ambiguousPayments.filter((a) => a.invoice_no === "INV-D1A-2");
      assert.strictEqual(ambB.length, 0, "No ambiguous payments for INV-D1A-2");

      const rowsB = db.prepare("SELECT idempotency_key, nominal FROM invoice_payments WHERE invoice_no = 'INV-D1A-2' ORDER BY id ASC").all() as any[];
      assert.strictEqual(rowsB.length, 2);
      assert.strictEqual(rowsB[0].idempotency_key, "BACKFILL-INV-D1A-2-PAY-STABLE-1");
      assert.strictEqual(rowsB[1].idempotency_key, "BACKFILL-INV-D1A-2-PAY-STABLE-2");

      // Case C: Replay of stable source IDs remains 100% idempotent
      const resBReplay = backfillHistoricalFinanceData(db);
      assert.strictEqual(resBReplay.backfilledPayments, 0, "Replay must be 100% idempotent");
      const ambBReplay = resBReplay.ambiguousPayments.filter((a) => a.invoice_no === "INV-D1A-2");
      assert.strictEqual(ambBReplay.length, 0, "Replay has 0 ambiguous payments for INV-D1A-2");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D1-16: D1-B Strict suffix validation and cross-candidate collision prevention", () => {
    // 1. isValidCalendarDate tests
    assert.strictEqual(isValidCalendarDate("2026-11-04"), true, "Valid calendar date");
    assert.strictEqual(isValidCalendarDate("2024-02-29"), true, "Valid leap year date");
    assert.strictEqual(isValidCalendarDate("2026-02-31"), false, "Invalid Feb 31 must be rejected");
    assert.strictEqual(isValidCalendarDate("2025-02-29"), false, "Non-leap year Feb 29 must be rejected");
    assert.strictEqual(isValidCalendarDate("9999-99-99"), false, "Invalid month/day must be rejected");
    assert.strictEqual(isValidCalendarDate("2026-11-04-EXTRA"), false, "Trailing characters must be rejected");
    assert.strictEqual(isValidCalendarDate("2026-13-01"), false, "Month 13 must be rejected");

    // 2. isValidIsoTimestamp tests
    assert.strictEqual(isValidIsoTimestamp("2026-11-04T14:46:40.982Z"), true, "Valid ISO timestamp");
    assert.strictEqual(isValidIsoTimestamp("2026-11-04T14:46:40Z"), true, "Valid ISO timestamp without millis");
    assert.strictEqual(isValidIsoTimestamp("2026-02-31T14:46:40.982Z"), false, "Invalid date in ISO timestamp must be rejected");
    assert.strictEqual(isValidIsoTimestamp("2026-11-04T25:00:00Z"), false, "Invalid hour must be rejected");
    assert.strictEqual(isValidIsoTimestamp("2026-11-04T14:46:40.982Z-EXTRA"), false, "Trailing token on ISO timestamp must be rejected");

    // 3. matchCandidateIdempotencyKey cross-token tests
    const invNo = "INV-SUFFIX-TEST";
    const canonicalKey = "BACKFILL-INV-SUFFIX-TEST-PAY-12";
    const legacyKeys = ["BACKFILL-INV-SUFFIX-TEST-PAY-12-2026-11-10", "BACKFILL-INV-SUFFIX-TEST-PAY-12-init"];
    const candidateDates = ["2026-11-10"];

    // PAY-12 vs PAY-123: MUST NOT MATCH
    const r1 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-123", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r1.isMatch, false);

    // PAY-12 vs PAY-12-PART1: MUST FAIL CLOSED INTO AMBIGUITY
    const r2 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-PART1", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r2.isMatch, false);
    assert.strictEqual(r2.isAmbiguous, true);

    // PAY-12 vs PAY-12-2026-11-04: Date conflicts with candidateDate (2026-11-10): MUST FAIL CLOSED INTO AMBIGUITY
    const r3 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-2026-11-04", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r3.isMatch, false);
    assert.strictEqual(r3.isAmbiguous, true);

    // Valid candidate date: MUST MATCH
    const r4 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-2026-11-10", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r4.isMatch, true);

    // Invalid calendar date in suffix (2026-02-31): MUST FAIL CLOSED INTO AMBIGUITY
    const r5 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-2026-02-31", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r5.isMatch, false);
    assert.strictEqual(r5.isAmbiguous, true);

    // Valid date + foreign suffix (2026-11-10-EXTRA): MUST FAIL CLOSED INTO AMBIGUITY
    const r6 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-2026-11-10-EXTRA", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r6.isMatch, false);
    assert.strictEqual(r6.isAmbiguous, true);

    // Supported epoch timestamp (10 digits): MUST MATCH
    const r7 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-1793803600", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r7.isMatch, true);

    // Supported epoch timestamp (13 digits): MUST MATCH
    const r8 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-1793803600982", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r8.isMatch, true);

    // Malformed timestamp with trailing letters: MUST FAIL CLOSED INTO AMBIGUITY
    const r9 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-1793803600982EXTRA", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r9.isMatch, false);
    assert.strictEqual(r9.isAmbiguous, true);

    // Malformed timestamp too short: MUST FAIL CLOSED INTO AMBIGUITY
    const r10 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-12345", invNo, "PAY-12", canonicalKey, legacyKeys, candidateDates);
    assert.strictEqual(r10.isMatch, false);
    assert.strictEqual(r10.isAmbiguous, true);

    // Empty candidateDates with calendar date suffix: MUST FAIL CLOSED INTO AMBIGUITY (no evidence)
    const rEmptyDate = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-2026-11-10", invNo, "PAY-12", canonicalKey, legacyKeys, []);
    assert.strictEqual(rEmptyDate.isMatch, false, "Date suffix without candidate date evidence must NOT match");
    assert.strictEqual(rEmptyDate.isAmbiguous, true, "Date suffix without candidate date evidence must fail closed into ambiguity");

    // Empty candidateDates with ISO timestamp suffix: MUST FAIL CLOSED INTO AMBIGUITY (no evidence)
    const rEmptyTs = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-PAY-12-2026-11-04T14:46:40.982Z", invNo, "PAY-12", canonicalKey, legacyKeys, []);
    assert.strictEqual(rEmptyTs.isMatch, false, "Timestamp suffix without candidate date evidence must NOT match");
    assert.strictEqual(rEmptyTs.isAmbiguous, true, "Timestamp suffix without candidate date evidence must fail closed into ambiguity");

    // Candidate lacking source ID (null): MUST RETURN FALSE (NEVER MATCH IDEMPOTENCY KEY)
    const r11 = matchCandidateIdempotencyKey("BACKFILL-INV-SUFFIX-TEST-500000-2026-11-10", invNo, null, "BACKFILL-INV-SUFFIX-TEST-FP-abc", ["BACKFILL-INV-SUFFIX-TEST-500000-2026-11-10"]);
    assert.strictEqual(r11.isMatch, false, "Candidate without source ID must never match via idempotency key");

    // Historical row 2 format compatibility:
    const r12 = matchCandidateIdempotencyKey(
      "BACKFILL-INV-1126-001-pay-1793803600982-2026-11-04T14:46:40.982Z",
      "INV-1126-001",
      "pay-1793803600982",
      "BACKFILL-INV-1126-001-pay-1793803600982",
      ["BACKFILL-INV-1126-001-pay-1793803600982-2026-11-04T14:46:40.982Z"],
      ["2026-11-04T14:46:40.982Z"]
    );
    assert.strictEqual(r12.isMatch, true, "Historical row 2 key must match cleanly");
  });

  /* =========================================================================
   * BATCH D2: Financial Metric Preservation (AC-D-02)
   * ========================================================================= */

  await t.test("D2-1: Existing non-zero relational financial metrics are preserved (never overwritten by JSON)", () => {
    const dbPath = createTempDbPath("d2-1");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      insertTestOrder(db, "ORD-VERIF", "Cust Verif", 1000000, "{}", "2026-11-01 10:00:00");

      const staleJson = JSON.stringify({
        totalTagihan: 1000000,
        biayaSamsat: 999999, // Stale!
        profit: 1,           // Stale!
        settlementCondition: "UNDERPAID", // Stale!
      });

      db.prepare(`
        INSERT INTO finance_invoices (
          id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at,
          biaya_samsat, pendapatan_jasa, profit_final, settlement_condition, profit_status
        ) VALUES (
          90, 'INV-VERIF', 'ORD-VERIF', 'Cust Verif', 'Layanan', 1000000, 1000000, 0, 'Lunas',
          ?, '2026-11-01 10:00:00', 800000, 200000, 200000, 'BALANCED', 'REALIZED'
        )
      `).run(staleJson);

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledInvoices, 0, "No invoice metrics should be overwritten");

      const invAfter = db.prepare("SELECT biaya_samsat, pendapatan_jasa, profit_final, settlement_condition FROM finance_invoices WHERE id = 90").get() as any;
      assert.strictEqual(invAfter.biaya_samsat, 800000, "biaya_samsat must remain 800000");
      assert.strictEqual(invAfter.pendapatan_jasa, 200000, "pendapatan_jasa must remain 200000");
      assert.strictEqual(invAfter.profit_final, 200000, "profit_final must remain 200000");
      assert.strictEqual(invAfter.settlement_condition, "BALANCED");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D2-2: Existing numeric 0 relational financial metrics are preserved (numeric 0 is never overwritten)", () => {
    const dbPath = createTempDbPath("d2-2");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      insertTestOrder(db, "ORD-ZERO", "Cust Zero", 500000, "{}", "2026-11-01 10:00:00");

      const staleJson = JSON.stringify({
        totalTagihan: 500000,
        biayaSamsat: 400000,
        profit: 100000,
      });

      db.prepare(`
        INSERT INTO finance_invoices (
          id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at,
          biaya_samsat, pendapatan_jasa, profit_final, is_explicit_zero
        ) VALUES (
          91, 'INV-ZERO', 'ORD-ZERO', 'Cust Zero', 'Konsultasi', 500000, 500000, 0, 'Lunas',
          ?, '2026-11-01 10:00:00', 0, 500000, 500000, 0
        )
      `).run(staleJson);

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledInvoices, 0, "Invoice with numeric 0 must NOT be overwritten");

      const invAfter = db.prepare("SELECT biaya_samsat, pendapatan_jasa FROM finance_invoices WHERE id = 91").get() as any;
      assert.strictEqual(invAfter.biaya_samsat, 0, "biaya_samsat must remain 0");
      assert.strictEqual(invAfter.pendapatan_jasa, 500000, "pendapatan_jasa must remain 500000");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D2-3: Missing/NULL relational metrics are populated from JSON", () => {
    const dbPath = createTempDbPath("d2-3");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });
      setupNullableInvoicesTable(db);

      insertTestOrder(db, "ORD-NULL-INIT", "Cust Null", 500000, "{}", "2026-11-01 10:00:00");

      const freshJson = JSON.stringify({
        totalTagihan: 500000,
        biayaSamsat: 400000,
        profit: 100000,
        settlementCondition: "BALANCED",
      });

      db.prepare(`
        INSERT INTO finance_invoices (
          id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at,
          biaya_samsat, pendapatan_jasa, profit_final
        ) VALUES (
          92, 'INV-NULL-INIT', 'ORD-NULL-INIT', 'Cust Null', 'Layanan', 500000, 500000, 0, 'Lunas',
          ?, '2026-11-01 10:00:00', NULL, NULL, NULL
        )
      `).run(freshJson);

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledInvoices, 1, "NULL invoice columns must be populated");

      const invAfter = db.prepare("SELECT biaya_samsat, pendapatan_jasa, profit_final FROM finance_invoices WHERE id = 92").get() as any;
      assert.strictEqual(invAfter.biaya_samsat, 400000);
      assert.strictEqual(invAfter.pendapatan_jasa, 100000);
      assert.strictEqual(invAfter.profit_final, 100000);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D2-4: When source JSON has no data, default calculations apply safely to NULL fields", () => {
    const dbPath = createTempDbPath("d2-4");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });
      setupNullableInvoicesTable(db);

      insertTestOrder(db, "ORD-EMPTY-JSON", "Cust Empty", 300000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (
          id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at,
          biaya_samsat, pendapatan_jasa, profit_final
        ) VALUES (
          93, 'INV-EMPTY-JSON', 'ORD-EMPTY-JSON', 'Cust Empty', 'Layanan', 300000, 300000, 0, 'Lunas',
          '{}', '2026-11-01 10:00:00', NULL, NULL, NULL
        )
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.backfilledInvoices, 1);

      const invAfter = db.prepare("SELECT biaya_samsat, pendapatan_jasa, profit_final FROM finance_invoices WHERE id = 93").get() as any;
      assert.strictEqual(invAfter.biaya_samsat, 0);
      assert.strictEqual(invAfter.pendapatan_jasa, 300000);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  /* =========================================================================
   * BATCH D3: Complete Destructive Migration Coverage (AC-D-03)
   * 5 Migrations × 4 Lifecycle Failure Points (CREATE, COPY, DROP, RENAME)
   * Plus FK Check In-Transaction Rollback Validation (D3-FK-1)
   * ========================================================================= */

  // Setup helpers for pre-migration states
  function setupPreMigDocs(db: DatabaseSync): void {
    db.exec(`
      DROP TABLE IF EXISTS documents;
      DROP TABLE IF EXISTS finance_invoices;
      DROP TABLE IF EXISTS orders;

      CREATE TABLE orders (order_no TEXT PRIMARY KEY);
      CREATE TABLE finance_invoices (invoice_no TEXT PRIMARY KEY);

      INSERT INTO orders (order_no) VALUES ('ORD-DOC-1');
      INSERT INTO finance_invoices (invoice_no) VALUES ('INV-DOC-1');

      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        order_no TEXT,
        invoice_id TEXT,
        document_type TEXT NOT NULL,
        original_name TEXT NOT NULL,
        storage_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        uploaded_by_id TEXT,
        uploaded_by_role TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO documents (
        id, order_no, invoice_id, document_type, original_name, storage_name,
        mime_type, size_bytes, sha256, uploaded_by, created_at
      ) VALUES (
        'doc-pre-1', 'ORD-DOC-1', 'INV-DOC-1', 'KTP', 'ktp.jpg', 'storage-ktp.jpg',
        'image/jpeg', 1024, 'sha256ktp', 'Admin', '2026-11-01 10:00:00'
      );
    `);
  }

  function setupPreMigPM(db: DatabaseSync): void {
    db.exec(`
      DROP TABLE IF EXISTS payment_methods;

      CREATE TABLE payment_methods (
        id TEXT PRIMARY KEY,
        nama_metode TEXT UNIQUE NOT NULL,
        bank TEXT,
        nama_rekening TEXT,
        nomor_rekening TEXT,
        status TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO payment_methods (id, nama_metode, bank, nama_rekening, nomor_rekening, status)
      VALUES ('pm-pre-1', 'cash', 'BCA', 'PT Test', '12345678', 'Aktif');
    `);
  }

  function setupPreMigUsers(db: DatabaseSync): void {
    db.exec(`
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS employee_accounts;
      DROP TABLE IF EXISTS employees;

      CREATE TABLE employees (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        jabatan TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT,
        email TEXT NOT NULL,
        phone TEXT,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        nama TEXT NOT NULL,
        jabatan TEXT NOT NULL DEFAULT 'ADMIN',
        status TEXT NOT NULL DEFAULT 'Aktif',
        avatar_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO employees (id, nama, jabatan) VALUES ('EMP-0001', 'Admin User', 'ADMIN');
      INSERT INTO users (id, employee_id, email, phone, password_hash, password_salt, nama, jabatan, status)
      VALUES (1, 'EMP-0001', 'admin@birojasa.com', '08123', 'hash', 'salt', 'Admin User', 'ADMIN', 'Aktif');
    `);
  }

  function setupPreMigFileJobs(db: DatabaseSync): void {
    db.exec(`
      DROP TABLE IF EXISTS file_deletion_jobs;

      CREATE TABLE file_deletion_jobs (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        category TEXT NOT NULL,
        target_user_id TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO file_deletion_jobs (id, file_path, category, target_user_id, status)
      VALUES ('job-pre-1', '/uploads/test.jpg', 'temp', 'u-1', 'PENDING');
    `);
  }

  function setupPreMigPricing(db: DatabaseSync): void {
    db.exec(`
      DROP TABLE IF EXISTS samsat_operational_tariffs;
      DROP TABLE IF EXISTS samsat_pricing;
      DROP TABLE IF EXISTS samsat_offices;

      CREATE TABLE samsat_offices (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        kode TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE samsat_pricing (
        id TEXT PRIMARY KEY,
        nama_item TEXT NOT NULL,
        kategori TEXT NOT NULL,
        tipe_kendaraan TEXT NOT NULL,
        biaya_dasar REAL NOT NULL DEFAULT 0,
        deskripsi TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_configured INTEGER NOT NULL DEFAULT 0,
        data_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE samsat_operational_tariffs (
        id TEXT PRIMARY KEY,
        samsat_id TEXT NOT NULL,
        pricing_item_id TEXT NOT NULL,
        nominal REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO samsat_offices (id, nama, kode) VALUES ('samsat-1', 'Samsat Pusat', 'PST');
      INSERT INTO samsat_pricing (id, nama_item, kategori, tipe_kendaraan, biaya_dasar)
      VALUES ('prc-pre-1', 'Biaya Admin', 'ADMIN', 'RODA_2', 50000);
      INSERT INTO samsat_operational_tariffs (id, samsat_id, pricing_item_id, nominal)
      VALUES ('trf-pre-1', 'samsat-1', 'prc-pre-1', 60000);
    `);
  }

  // --- Migration 1: documents table ---

  await t.test("D3-DOC-1: migrateDocumentsTable failure at CREATE phase (temp table collision) triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-doc-1");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigDocs(db);

      // Pre-create conflicting table to trigger CREATE failure
      db.exec("CREATE TABLE documents_migrated (dummy TEXT);");

      assert.throws(() => migrateDocumentsTable(db), /already exists/);

      // Verify rollback: original table intact, original row intact
      const rows = db.prepare("SELECT * FROM documents WHERE id = 'doc-pre-1'").all() as any[];
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].storage_name, "storage-ktp.jpg");

      // Verify FK state restored to ON and depth = 0
      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      // Verify retry after removing obstacle succeeds
      db.exec("DROP TABLE documents_migrated;");
      migrateDocumentsTable(db);
      const migratedCols = new Set((db.prepare("PRAGMA table_info(documents)").all() as any[]).map(c => c.name));
      assert.ok(migratedCols.has("is_active"));
      assert.ok(migratedCols.has("updated_at"));

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-DOC-2: migrateDocumentsTable failure at COPY phase (UNIQUE constraint violation) triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-doc-2");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigDocs(db);

      // Pre-migration documents table does not enforce unique storage_name; insert duplicate to fail COPY
      db.exec(`
        INSERT INTO documents (id, document_type, original_name, storage_name, mime_type, size_bytes, sha256, uploaded_by)
        VALUES ('doc-pre-2', 'KTP', 'ktp2.jpg', 'storage-ktp.jpg', 'image/jpeg', 2048, 'sha2', 'Admin');
      `);

      assert.throws(() => migrateDocumentsTable(db), /UNIQUE constraint failed: documents_migrated\.storage_name/);

      // Verify rollback: documents still has both rows intact
      const count = (db.prepare("SELECT COUNT(*) as c FROM documents").get() as any).c;
      assert.strictEqual(count, 2);

      // Verify no temporary table remains
      const tempTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents_migrated'").get();
      assert.strictEqual(tempTable, undefined);

      // Verify FK state restored
      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-DOC-3: migrateDocumentsTable failure at DROP phase (locked cursor) triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-doc-3");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigDocs(db);

      // Hold cursor on documents table to trigger DROP failure
      const cursor = db.prepare("SELECT * FROM documents").iterate();
      cursor.next();

      assert.throws(() => migrateDocumentsTable(db), /database table is locked/);

      cursor.return();

      // Verify rollback: documents table intact
      const row = db.prepare("SELECT * FROM documents WHERE id = 'doc-pre-1'").get() as any;
      assert.ok(row);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      // Retry succeeds
      migrateDocumentsTable(db);
      const migratedCols = new Set((db.prepare("PRAGMA table_info(documents)").all() as any[]).map(c => c.name));
      assert.ok(migratedCols.has("is_active"));

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-DOC-4: migrateDocumentsTable failure at RENAME phase (dependent view) triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-doc-4");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigDocs(db);

      // View referencing documents causes RENAME schema rewrite error in SQLite
      db.exec("CREATE VIEW v_block_doc AS SELECT * FROM documents;");

      assert.throws(() => migrateDocumentsTable(db), /error in view v_block_doc/);

      // Verify rollback: documents table intact
      const row = db.prepare("SELECT * FROM documents WHERE id = 'doc-pre-1'").get() as any;
      assert.ok(row);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      db.exec("DROP VIEW v_block_doc;");
      migrateDocumentsTable(db);
      const migratedCols = new Set((db.prepare("PRAGMA table_info(documents)").all() as any[]).map(c => c.name));
      assert.ok(migratedCols.has("is_active"));

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  // --- Migration 2: payment_methods table ---

  await t.test("D3-PM-1: migratePaymentMethodsTable failure at CREATE phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-pm-1");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigPM(db);

      db.exec("CREATE TABLE payment_methods_migrated (dummy TEXT);");

      assert.throws(() => migratePaymentMethodsTable(db), /already exists/);

      const row = db.prepare("SELECT * FROM payment_methods WHERE id = 'pm-pre-1'").get() as any;
      assert.strictEqual(row.nama_metode, "cash");

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      db.exec("DROP TABLE payment_methods_migrated;");
      const ok = migratePaymentMethodsTable(db);
      assert.strictEqual(ok, true);

      const rowAfter = db.prepare("SELECT * FROM payment_methods WHERE id = 'pm-pre-1'").get() as any;
      assert.strictEqual(rowAfter.nama_metode, "Tunai");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-PM-2: migratePaymentMethodsTable failure at COPY phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-pm-2");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      db.exec(`
        DROP TABLE IF EXISTS payment_methods;
        CREATE TABLE payment_methods (
          id TEXT,
          nama_metode TEXT UNIQUE NOT NULL,
          bank TEXT,
          nama_rekening TEXT,
          nomor_rekening TEXT,
          status TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO payment_methods VALUES ('pm-dup', 'cash', 'BCA', 'A', '123', 'Aktif', '2026-11-01', '2026-11-01');
        INSERT INTO payment_methods VALUES ('pm-dup', 'transfer', 'BCA', 'B', '456', 'Aktif', '2026-11-01', '2026-11-01');
      `);

      // Duplicate PK 'pm-dup' will fail during INSERT into payment_methods_migrated (id TEXT PRIMARY KEY)
      assert.throws(() => migratePaymentMethodsTable(db), /PRIMARY KEY|UNIQUE constraint failed/);

      const count = (db.prepare("SELECT COUNT(*) as c FROM payment_methods").get() as any).c;
      assert.strictEqual(count, 2);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-PM-3: migratePaymentMethodsTable failure at DROP phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-pm-3");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigPM(db);

      const cursor = db.prepare("SELECT * FROM payment_methods").iterate();
      cursor.next();

      assert.throws(() => migratePaymentMethodsTable(db), /database table is locked/);

      cursor.return();

      const row = db.prepare("SELECT * FROM payment_methods WHERE id = 'pm-pre-1'").get() as any;
      assert.strictEqual(row.nama_metode, "cash");

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      migratePaymentMethodsTable(db);
      const rowAfter = db.prepare("SELECT * FROM payment_methods WHERE id = 'pm-pre-1'").get() as any;
      assert.strictEqual(rowAfter.nama_metode, "Tunai");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-PM-4: migratePaymentMethodsTable failure at RENAME phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-pm-4");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigPM(db);

      db.exec("CREATE VIEW v_block_pm AS SELECT * FROM payment_methods;");

      assert.throws(() => migratePaymentMethodsTable(db), /error in view v_block_pm/);

      db.exec("DROP VIEW v_block_pm;");

      const row = db.prepare("SELECT * FROM payment_methods WHERE id = 'pm-pre-1'").get() as any;
      assert.strictEqual(row.nama_metode, "cash");

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      migratePaymentMethodsTable(db);
      const rowAfter = db.prepare("SELECT * FROM payment_methods WHERE id = 'pm-pre-1'").get() as any;
      assert.strictEqual(rowAfter.nama_metode, "Tunai");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  // --- Migration 3: consolidateEmployeesAndUsersMigration ---

  await t.test("D3-USR-1: consolidateEmployeesAndUsersMigration failure at CREATE phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-usr-1");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigUsers(db);

      db.exec("CREATE TABLE users_consolidated (dummy TEXT);");

      assert.throws(() => consolidateEmployeesAndUsersMigration(db), /already exists/);

      const count = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
      assert.strictEqual(count, 1);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      db.exec("DROP TABLE users_consolidated;");
      consolidateEmployeesAndUsersMigration(db);

      const userCols = new Set((db.prepare("PRAGMA table_info(users)").all() as any[]).map(c => c.name));
      assert.ok(userCols.has("role"));
      assert.ok(userCols.has("last_login_at"));

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-USR-2: consolidateEmployeesAndUsersMigration failure at COPY phase (duplicate email) triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-usr-2");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigUsers(db);

      // Insert duplicate email into users (pre-migration lacked unique index on email)
      db.exec(`
        INSERT INTO users (id, employee_id, email, phone, password_hash, password_salt, nama, jabatan, status)
        VALUES (2, 'EMP-0002', 'admin@birojasa.com', '08124', 'hash2', 'salt2', 'Admin 2', 'ADMIN', 'Aktif');
      `);

      assert.throws(() => consolidateEmployeesAndUsersMigration(db), /UNIQUE constraint failed: users_consolidated\.email/);

      const count = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
      assert.strictEqual(count, 2);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-USR-3: consolidateEmployeesAndUsersMigration failure at DROP phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-usr-3");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigUsers(db);

      const cursor = db.prepare("SELECT * FROM users").iterate();
      cursor.next();

      assert.throws(() => consolidateEmployeesAndUsersMigration(db), /database table is locked/);

      cursor.return();

      const count = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
      assert.strictEqual(count, 1);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      consolidateEmployeesAndUsersMigration(db);
      const userCols = new Set((db.prepare("PRAGMA table_info(users)").all() as any[]).map(c => c.name));
      assert.ok(userCols.has("role"));

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-USR-4: consolidateEmployeesAndUsersMigration failure at RENAME phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-usr-4");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigUsers(db);

      db.exec("CREATE VIEW v_block_usr AS SELECT * FROM users;");

      assert.throws(() => consolidateEmployeesAndUsersMigration(db), /error in view v_block_usr/);

      db.exec("DROP VIEW v_block_usr;");

      const count = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
      assert.strictEqual(count, 1);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      consolidateEmployeesAndUsersMigration(db);
      const userCols = new Set((db.prepare("PRAGMA table_info(users)").all() as any[]).map(c => c.name));
      assert.ok(userCols.has("role"));

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  // --- Migration 4: migrateFileDeletionJobsTable ---

  await t.test("D3-JOB-1: migrateFileDeletionJobsTable failure at CREATE phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-job-1");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigFileJobs(db);

      db.exec("CREATE TABLE file_deletion_jobs_new (dummy TEXT);");

      assert.throws(() => migrateFileDeletionJobsTable(db), /already exists/);

      const count = (db.prepare("SELECT COUNT(*) as c FROM file_deletion_jobs").get() as any).c;
      assert.strictEqual(count, 1);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      db.exec("DROP TABLE file_deletion_jobs_new;");
      migrateFileDeletionJobsTable(db);

      const cols = new Set((db.prepare("PRAGMA table_info(file_deletion_jobs)").all() as any[]).map(c => c.name));
      assert.strictEqual(cols.has("target_user_id"), false);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-JOB-2: migrateFileDeletionJobsTable failure at COPY phase (CHECK constraint violation) triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-job-2");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigFileJobs(db);

      // Insert invalid status to violate CHECK constraint in file_deletion_jobs_new
      db.exec(`
        INSERT INTO file_deletion_jobs (id, file_path, category, target_user_id, status)
        VALUES ('job-pre-bad', '/uploads/bad.jpg', 'temp', 'u-1', 'CORRUPT_STATUS');
      `);

      assert.throws(() => migrateFileDeletionJobsTable(db), /CHECK constraint failed/);

      const count = (db.prepare("SELECT COUNT(*) as c FROM file_deletion_jobs").get() as any).c;
      assert.strictEqual(count, 2);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-JOB-3: migrateFileDeletionJobsTable failure at DROP phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-job-3");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigFileJobs(db);

      const cursor = db.prepare("SELECT * FROM file_deletion_jobs").iterate();
      cursor.next();

      assert.throws(() => migrateFileDeletionJobsTable(db), /database table is locked/);

      cursor.return();

      const count = (db.prepare("SELECT COUNT(*) as c FROM file_deletion_jobs").get() as any).c;
      assert.strictEqual(count, 1);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      migrateFileDeletionJobsTable(db);
      const cols = new Set((db.prepare("PRAGMA table_info(file_deletion_jobs)").all() as any[]).map(c => c.name));
      assert.strictEqual(cols.has("target_user_id"), false);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-JOB-4: migrateFileDeletionJobsTable failure at RENAME phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-job-4");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigFileJobs(db);

      db.exec("CREATE VIEW v_block_jobs AS SELECT * FROM file_deletion_jobs;");

      assert.throws(() => migrateFileDeletionJobsTable(db), /error in view v_block_jobs/);

      db.exec("DROP VIEW v_block_jobs;");

      const count = (db.prepare("SELECT COUNT(*) as c FROM file_deletion_jobs").get() as any).c;
      assert.strictEqual(count, 1);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      migrateFileDeletionJobsTable(db);
      const cols = new Set((db.prepare("PRAGMA table_info(file_deletion_jobs)").all() as any[]).map(c => c.name));
      assert.strictEqual(cols.has("target_user_id"), false);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  // --- Migration 5: migratePricingTables ---

  await t.test("D3-PRC-1: migratePricingTables failure at CREATE phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-prc-1");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigPricing(db);

      db.exec("CREATE TABLE samsat_pricing_migrated (dummy TEXT);");

      assert.throws(() => migratePricingTables(db), /already exists/);

      const count = (db.prepare("SELECT COUNT(*) as c FROM samsat_pricing").get() as any).c;
      assert.strictEqual(count, 1);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      db.exec("DROP TABLE samsat_pricing_migrated;");
      const ok = migratePricingTables(db);
      assert.strictEqual(ok, true);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-PRC-2: migratePricingTables failure at COPY phase (CHECK constraint violation) triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-prc-2");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigPricing(db);

      // Insert negative biaya_dasar to violate CHECK(biaya_dasar >= 0) in samsat_pricing_migrated
      db.exec(`
        INSERT INTO samsat_pricing (id, nama_item, kategori, tipe_kendaraan, biaya_dasar)
        VALUES ('prc-neg', 'Negative Item', 'ADMIN', 'RODA_2', -15000);
      `);

      assert.throws(() => migratePricingTables(db), /CHECK constraint failed: biaya_dasar >= 0/);

      const count = (db.prepare("SELECT COUNT(*) as c FROM samsat_pricing").get() as any).c;
      assert.strictEqual(count, 2);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-PRC-3: migratePricingTables failure at DROP phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-prc-3");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigPricing(db);

      const cursor = db.prepare("SELECT * FROM samsat_pricing").iterate();
      cursor.next();

      assert.throws(() => migratePricingTables(db), /database table is locked/);

      cursor.return();

      const count = (db.prepare("SELECT COUNT(*) as c FROM samsat_pricing").get() as any).c;
      assert.strictEqual(count, 1);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      const ok = migratePricingTables(db);
      assert.strictEqual(ok, true);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D3-PRC-4: migratePricingTables failure at RENAME phase triggers atomic rollback", () => {
    const dbPath = createTempDbPath("d3-prc-4");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigPricing(db);

      db.exec("CREATE VIEW v_block_prc AS SELECT * FROM samsat_pricing;");

      assert.throws(() => migratePricingTables(db), /error in view v_block_prc/);

      db.exec("DROP VIEW v_block_prc;");

      const count = (db.prepare("SELECT COUNT(*) as c FROM samsat_pricing").get() as any).c;
      assert.strictEqual(count, 1);

      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1);

      const ok = migratePricingTables(db);
      assert.strictEqual(ok, true);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  // --- Foreign Key In-Transaction Verification ---

  await t.test("D3-FK-1: PRAGMA foreign_key_check inside transaction detects constraint violation and triggers complete atomic rollback", () => {
    const dbPath = createTempDbPath("d3-fk-1");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });
      setupPreMigDocs(db);

      // Create child table referencing documents with an orphan row
      db.exec(`
        CREATE TABLE document_audit_trail (
          id TEXT PRIMARY KEY,
          doc_id TEXT REFERENCES documents(id)
        );
        PRAGMA foreign_keys = OFF;
        INSERT INTO document_audit_trail (id, doc_id) VALUES ('aud-ghost', 'DOC-NONEXISTENT');
        PRAGMA foreign_keys = ON;
      `);

      // Migration must fail on foreign_key_check inside transaction callback
      assert.throws(() => migrateDocumentsTable(db), /\[MIGRATION_FK_CHECK_FAILED\]/);

      // Verify that documents was rolled back to pre-migration state (still lacks is_active)
      const cols = new Set((db.prepare("PRAGMA table_info(documents)").all() as any[]).map(c => c.name));
      assert.strictEqual(cols.has("is_active"), false, "Schema alteration must be rolled back");

      // Verify no temporary migrated table was left behind
      const tempTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents_migrated'").get();
      assert.strictEqual(tempTable, undefined);

      // Verify foreign key pragma restored to ON
      const fk = (db.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys;
      assert.strictEqual(fk, 1, "Foreign keys must be ON");

      // Verify connection remains completely healthy and reusable
      db.exec("DELETE FROM document_audit_trail WHERE doc_id = 'DOC-NONEXISTENT';");
      migrateDocumentsTable(db);
      const colsAfter = new Set((db.prepare("PRAGMA table_info(documents)").all() as any[]).map(c => c.name));
      assert.ok(colsAfter.has("is_active"), "Retry after clearing FK violation must succeed");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  /* =========================================================================
   * BATCH D4: Backfill Atomicity Across All 4 Phases (AC-D-04)
   * ========================================================================= */

  await t.test("D4-1: Phase 1 failure injection (Trigger BEFORE UPDATE ON finance_invoices) triggers full rollback", () => {
    const dbPath = createTempDbPath("d4-1");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });
      setupNullableInvoicesTable(db);

      insertTestOrder(db, "ORD-ATOMIC-1", "Cust A1", 500000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at, biaya_samsat)
        VALUES (81, 'INV-ATOMIC-1', 'ORD-ATOMIC-1', 'Cust A1', 'Layanan', 500000, 500000, 0, 'Lunas', '{"totalTagihan":500000,"biayaSamsat":400000}', '2026-11-01 10:00:00', NULL)
      `).run();

      db.exec(`
        CREATE TRIGGER fail_phase1
        BEFORE UPDATE ON finance_invoices
        BEGIN
          SELECT RAISE(FAIL, 'SIMULATED_PHASE1_FAILURE');
        END;
      `);

      assert.throws(() => backfillHistoricalFinanceData(db), /SIMULATED_PHASE1_FAILURE/);

      const invRow = db.prepare("SELECT biaya_samsat FROM finance_invoices WHERE id = 81").get() as any;
      assert.strictEqual(invRow.biaya_samsat, null, "biaya_samsat must remain NULL after Phase 1 rollback");

      assert.strictEqual(isConnectionCorrupted(db), false);
      const okQuery = db.prepare("SELECT 1 as val").get() as any;
      assert.strictEqual(okQuery.val, 1);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D4-2: Phase 2 failure injection (Trigger BEFORE INSERT ON invoice_payments) triggers full rollback", () => {
    const dbPath = createTempDbPath("d4-2");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });
      setupNullableInvoicesTable(db);

      insertTestOrder(db, "ORD-ATOMIC-2", "Cust A2", 500000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at, biaya_samsat)
        VALUES (82, 'INV-ATOMIC-2', 'ORD-ATOMIC-2', 'Cust A2', 'Layanan', 500000, 500000, 0, 'Lunas', '{"totalTagihan":500000,"biayaSamsat":400000}', '2026-11-01 10:00:00', NULL)
      `).run();

      db.exec(`
        CREATE TRIGGER fail_phase2
        BEFORE INSERT ON invoice_payments
        BEGIN
          SELECT RAISE(FAIL, 'SIMULATED_PHASE2_FAILURE');
        END;
      `);

      assert.throws(() => backfillHistoricalFinanceData(db), /SIMULATED_PHASE2_FAILURE/);

      const invRow = db.prepare("SELECT biaya_samsat FROM finance_invoices WHERE id = 82").get() as any;
      assert.strictEqual(invRow.biaya_samsat, null, "Invoice update must be rolled back");

      const payCount = (db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE invoice_no = 'INV-ATOMIC-2'").get() as any).c;
      assert.strictEqual(payCount, 0, "Zero payments inserted");

      assert.strictEqual(isConnectionCorrupted(db), false);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D4-3: Phase 3 failure injection (Trigger BEFORE UPDATE ON kas_kantor) triggers full rollback", () => {
    const dbPath = createTempDbPath("d4-3");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });
      setupNullableInvoicesTable(db);

      insertTestOrder(db, "ORD-ATOMIC-3", "Cust A3", 500000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at, biaya_samsat)
        VALUES (83, 'INV-ATOMIC-3', 'ORD-ATOMIC-3', 'Cust A3', 'Layanan', 500000, 500000, 0, 'Lunas', '{"totalTagihan":500000,"biayaSamsat":400000}', '2026-11-01 10:00:00', NULL)
      `).run();

      db.prepare(`
        INSERT INTO kas_kantor (id, tanggal, keterangan, status, debit, kredit, saldo, order_no, invoice_no)
        VALUES (831, '2026-11-01', 'Setoran kantor', 'VALID', 500000, 0, 500000, NULL, NULL)
      `).run();

      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key, kas_kantor_id
        ) VALUES (
          83, 'INV-ATOMIC-3', 'ORD-ATOMIC-3', 500000, 'Tunai', '2026-11-01', 'TERVERIFIKASI', 'PAY-A3', 831
        )
      `).run();

      db.exec(`
        CREATE TRIGGER fail_phase3
        BEFORE UPDATE ON kas_kantor
        BEGIN
          SELECT RAISE(FAIL, 'SIMULATED_PHASE3_FAILURE');
        END;
      `);

      assert.throws(() => backfillHistoricalFinanceData(db), /SIMULATED_PHASE3_FAILURE/);

      const invRow = db.prepare("SELECT biaya_samsat FROM finance_invoices WHERE id = 83").get() as any;
      assert.strictEqual(invRow.biaya_samsat, null, "Invoice update must be rolled back on Phase 3 failure");

      const kasRow = db.prepare("SELECT order_no, invoice_no FROM kas_kantor WHERE id = 831").get() as any;
      assert.strictEqual(kasRow.order_no, null);
      assert.strictEqual(kasRow.invoice_no, null);

      assert.strictEqual(isConnectionCorrupted(db), false);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D4-4: Phase 4 failure injection (Trigger BEFORE UPDATE ON pengeluaran) triggers full rollback", () => {
    const dbPath = createTempDbPath("d4-4");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });
      setupNullableInvoicesTable(db);

      db.prepare(`
        INSERT OR IGNORE INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili)
        VALUES ('emp-d4', '1234567890123456', 'Kurir D4', '0812345678', '1990-01-01', 'Jakarta', 'Jl. Test')
      `).run();

      insertTestOrder(db, "ORD-ATOMIC-4", "Cust A4", 500000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at, biaya_samsat)
        VALUES (84, 'INV-ATOMIC-4', 'ORD-ATOMIC-4', 'Cust A4', 'Layanan', 500000, 500000, 0, 'Lunas', '{"totalTagihan":500000,"biayaSamsat":400000}', '2026-11-01 10:00:00', NULL)
      `).run();

      db.prepare(`
        INSERT INTO messenger_reimbursements (id, employee_id, messenger_name, order_no, category, amount, date, status)
        VALUES ('reimb-d4', 'emp-d4', 'Kurir D4', 'ORD-ATOMIC-4', 'Bensin', 50000, '2026-11-01', 'Disetujui')
      `).run();

      db.prepare(`
        INSERT INTO pengeluaran (id, tanggal, keterangan, nominal, reimbursement_id, order_no, invoice_no)
        VALUES (841, '2026-11-01', 'Pengeluaran kurir', 50000, 'reimb-d4', NULL, NULL)
      `).run();

      db.exec(`
        CREATE TRIGGER fail_phase4
        BEFORE UPDATE ON pengeluaran
        BEGIN
          SELECT RAISE(FAIL, 'SIMULATED_PHASE4_FAILURE');
        END;
      `);

      assert.throws(() => backfillHistoricalFinanceData(db), /SIMULATED_PHASE4_FAILURE/);

      const invRow = db.prepare("SELECT biaya_samsat FROM finance_invoices WHERE id = 84").get() as any;
      assert.strictEqual(invRow.biaya_samsat, null, "Invoice update must be rolled back on Phase 4 failure");

      const pengRow = db.prepare("SELECT order_no, invoice_no FROM pengeluaran WHERE id = 841").get() as any;
      assert.strictEqual(pengRow.order_no, null);
      assert.strictEqual(pengRow.invoice_no, null);

      assert.strictEqual(isConnectionCorrupted(db), false);

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  /* =========================================================================
   * BATCH D5: Structured Financial Linking (AC-D-05)
   * ========================================================================= */

  await t.test("D5-1: Structured linking of kas_kantor via invoice_payments.kas_kantor_id", () => {
    const dbPath = createTempDbPath("d5-1");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      insertTestOrder(db, "ORD-KAS-1", "Cust Kas", 500000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (101, 'INV-KAS-1', 'ORD-KAS-1', 'Cust Kas', 'Layanan', 500000, 500000, 0, 'Lunas', '{}', '2026-11-01 10:00:00')
      `).run();

      db.prepare(`
        INSERT INTO kas_kantor (id, tanggal, keterangan, status, debit, kredit, saldo, order_no, invoice_no)
        VALUES (501, '2026-11-01', 'Setoran kantor tanpa regex', 'VALID', 500000, 0, 500000, NULL, NULL)
      `).run();

      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key, kas_kantor_id
        ) VALUES (
          501, 'INV-KAS-1', 'ORD-KAS-1', 500000, 'Tunai', '2026-11-01', 'TERVERIFIKASI', 'PAY-KAS-501', 501
        )
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.kasKantorStats.mapped, 1, "kas_kantor must be linked via structured kas_kantor_id");

      const kasRow = db.prepare("SELECT order_no, invoice_no FROM kas_kantor WHERE id = 501").get() as any;
      assert.strictEqual(kasRow.order_no, "ORD-KAS-1");
      assert.strictEqual(kasRow.invoice_no, "INV-KAS-1");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D5-2: Structured linking of pengeluaran via messenger_reimbursements.reimbursement_id", () => {
    const dbPath = createTempDbPath("d5-2");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      db.prepare(`
        INSERT OR IGNORE INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili)
        VALUES ('emp-1', '1234567890123456', 'Kurir A', '0812345678', '1990-01-01', 'Jakarta', 'Jl. Test')
      `).run();

      insertTestOrder(db, "ORD-REIMB-1", "Cust Reimb", 300000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (105, 'INV-REIMB-1', 'ORD-REIMB-1', 'Cust Reimb', 'Layanan', 300000, 300000, 0, 'Lunas', '{}', '2026-11-01 10:00:00')
      `).run();

      db.prepare(`
        INSERT INTO messenger_reimbursements (id, employee_id, messenger_name, order_no, category, amount, date, status)
        VALUES ('reimb-uuid-1', 'emp-1', 'Kurir A', 'ORD-REIMB-1', 'Bensin', 50000, '2026-11-01', 'Disetujui')
      `).run();

      db.prepare(`
        INSERT INTO pengeluaran (id, tanggal, keterangan, nominal, reimbursement_id, order_no, invoice_no)
        VALUES (601, '2026-11-01', 'Pengeluaran bensin kurir', 50000, 'reimb-uuid-1', NULL, NULL)
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.pengeluaranStats.mapped, 1, "pengeluaran must be linked via structured reimbursement_id");

      const pengRow = db.prepare("SELECT order_no, invoice_no FROM pengeluaran WHERE id = 601").get() as any;
      assert.strictEqual(pengRow.order_no, "ORD-REIMB-1");
      assert.strictEqual(pengRow.invoice_no, "INV-REIMB-1");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D5-3: Description/regex-only text in kas_kantor does NOT create link (remains unlinked)", () => {
    const dbPath = createTempDbPath("d5-3");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      insertTestOrder(db, "ORD-1006", "Cust No Regex", 250000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (106, 'INV-1006', 'ORD-1006', 'Cust No Regex', 'Layanan', 250000, 250000, 0, 'Lunas', '{}', '2026-11-01 10:00:00')
      `).run();

      // Kas kantor row has description containing INV-1006, but NO structured link
      db.prepare(`
        INSERT INTO kas_kantor (id, tanggal, keterangan, status, debit, kredit, saldo, order_no, invoice_no)
        VALUES (502, '2026-11-01', 'Setoran manual INV-1006 dari teller', 'VALID', 250000, 0, 250000, NULL, NULL)
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.kasKantorStats.mapped, 0, "Description regex alone must NOT map kas_kantor");
      assert.strictEqual(res.kasKantorStats.unmatched, 1, "Must be recorded as unmatched in telemetry");

      const kasRow = db.prepare("SELECT order_no, invoice_no FROM kas_kantor WHERE id = 502").get() as any;
      assert.strictEqual(kasRow.order_no, null, "order_no must remain NULL");
      assert.strictEqual(kasRow.invoice_no, null, "invoice_no must remain NULL");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D5-4: Description/regex-only text in pengeluaran does NOT create link (remains unlinked)", () => {
    const dbPath = createTempDbPath("d5-4");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      insertTestOrder(db, "ORD-9999", "Cust No Peng", 250000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES (107, 'INV-9999', 'ORD-9999', 'Cust No Peng', 'Layanan', 250000, 250000, 0, 'Lunas', '{}', '2026-11-01 10:00:00')
      `).run();

      // Pengeluaran row has description containing ORD-9999, but NO structured link (reimbursement_id is NULL)
      db.prepare(`
        INSERT INTO pengeluaran (id, tanggal, keterangan, nominal, reimbursement_id, order_no, invoice_no)
        VALUES (602, '2026-11-01', 'Biaya fotokopi berkas ORD-9999', 15000, NULL, NULL, NULL)
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.pengeluaranStats.mapped, 0, "Description regex alone must NOT map pengeluaran");
      assert.strictEqual(res.pengeluaranStats.unmatched, 1, "Must be recorded as unmatched in telemetry");

      const pengRow = db.prepare("SELECT order_no, invoice_no FROM pengeluaran WHERE id = 602").get() as any;
      assert.strictEqual(pengRow.order_no, null, "order_no must remain NULL");
      assert.strictEqual(pengRow.invoice_no, null, "invoice_no must remain NULL");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D5-5: Conflicting structured references fail closed (left unlinked, recorded as ambiguous)", () => {
    const dbPath = createTempDbPath("d5-5");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      insertTestOrder(db, "ORD-CONF-A", "Cust A", 200000, "{}", "2026-11-01 10:00:00");
      insertTestOrder(db, "ORD-CONF-B", "Cust B", 300000, "{}", "2026-11-01 10:00:00");

      db.prepare(`
        INSERT INTO finance_invoices (id, invoice_no, order_no, customer, layanan, total_tagihan, dibayar, sisa, status, data_json, created_at)
        VALUES 
        (108, 'INV-CONF-A', 'ORD-CONF-A', 'Cust A', 'Layanan', 200000, 200000, 0, 'Lunas', '{}', '2026-11-01 10:00:00'),
        (109, 'INV-CONF-B', 'ORD-CONF-B', 'Cust B', 'Layanan', 300000, 300000, 0, 'Lunas', '{}', '2026-11-01 10:00:00')
      `).run();

      db.prepare(`
        INSERT INTO kas_kantor (id, tanggal, keterangan, status, debit, kredit, saldo, order_no, invoice_no)
        VALUES (503, '2026-11-01', 'Setoran kantor konflik', 'VALID', 500000, 0, 500000, NULL, NULL)
      `).run();

      // Two different payments for two DIFFERENT invoices both point to kas_kantor_id 503!
      db.prepare(`
        INSERT INTO invoice_payments (
          id, invoice_no, order_no, nominal, metode_pembayaran, tanggal_bayar, status_verifikasi, idempotency_key, kas_kantor_id
        ) VALUES 
        (5031, 'INV-CONF-A', 'ORD-CONF-A', 200000, 'Tunai', '2026-11-01', 'TERVERIFIKASI', 'PAY-CONF-1', 503),
        (5032, 'INV-CONF-B', 'ORD-CONF-B', 300000, 'Tunai', '2026-11-01', 'TERVERIFIKASI', 'PAY-CONF-2', 503)
      `).run();

      const res = backfillHistoricalFinanceData(db);
      assert.strictEqual(res.kasKantorStats.ambiguous, 1, "Conflicting references must increment ambiguous count");

      const kasRow = db.prepare("SELECT order_no, invoice_no FROM kas_kantor WHERE id = 503").get() as any;
      assert.strictEqual(kasRow.order_no, null, "Must remain unlinked on conflict");
      assert.strictEqual(kasRow.invoice_no, null, "Must remain unlinked on conflict");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  /* =========================================================================
   * BATCH D6: Document Reconciliation & Seed Idempotency (AC-D-06)
   * ========================================================================= */

  await t.test("D6-1: Conflicting document ownership across orders remains unlinked and reports conflict", () => {
    const dbPath = createTempDbPath("d6-1");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      const json1 = JSON.stringify({ documentId: "DOC-SHARED-X" });
      const json2 = JSON.stringify({ documentId: "DOC-SHARED-X" });

      insertTestOrder(db, "ORD-SHARED-1", "Cust 1", 100000, json1, "2026-11-01 10:00:00");
      insertTestOrder(db, "ORD-SHARED-2", "Cust 2", 200000, json2, "2026-11-01 11:00:00");

      db.prepare(`
        INSERT INTO documents (id, order_no, document_type, original_name, storage_name, mime_type, size_bytes, sha256, uploaded_by)
        VALUES ('DOC-SHARED-X', NULL, 'KTP', 'ktp.jpg', 'ktp-uuid-shared.jpg', 'image/jpeg', 1024, 'abcsha', 'Admin')
      `).run();

      const res = reconcileLegacyDocuments(db);
      assert.strictEqual(res.conflictsCount, 1, "Conflicting document must be tracked in conflictsCount");

      const docRow = db.prepare("SELECT order_no FROM documents WHERE id = 'DOC-SHARED-X'").get() as any;
      assert.strictEqual(docRow.order_no, null, "Conflicted document must REMAIN UNLINKED");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D6-2: Document reconciliation is independent of order iteration order", () => {
    const dbPath = createTempDbPath("d6-2");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      insertTestOrder(db, "ORD-Z", "Cust Z", 100000, JSON.stringify({ doc: "DOC-SHARED-Z" }), "2026-11-01 10:00:00");
      insertTestOrder(db, "ORD-A", "Cust A", 200000, JSON.stringify({ doc: "DOC-SHARED-Z" }), "2026-11-01 11:00:00");

      db.prepare(`
        INSERT INTO documents (id, order_no, document_type, original_name, storage_name, mime_type, size_bytes, sha256, uploaded_by)
        VALUES ('DOC-SHARED-Z', NULL, 'KTP', 'ktp.jpg', 'ktp-uuid-z.jpg', 'image/jpeg', 1024, 'abcsha', 'Admin')
      `).run();

      const res = reconcileLegacyDocuments(db);
      assert.strictEqual(res.conflictsCount, 1);

      const docRow = db.prepare("SELECT order_no FROM documents WHERE id = 'DOC-SHARED-Z'").get() as any;
      assert.strictEqual(docRow.order_no, null, "Document must not be assigned to whichever order is scanned first");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D6-3: Timestamp preservation: already linked documents do NOT update updated_at", () => {
    const dbPath = createTempDbPath("d6-3");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      const fixedTime = "2026-10-01 12:00:00";
      insertTestOrder(db, "ORD-TIMESTAMP", "Cust TS", 100000, JSON.stringify({ doc: "DOC-TIMESTAMP" }), "2026-10-01 12:00:00");

      db.prepare(`
        INSERT INTO documents (id, order_no, document_type, original_name, storage_name, mime_type, size_bytes, sha256, uploaded_by, updated_at)
        VALUES ('DOC-TIMESTAMP', 'ORD-TIMESTAMP', 'KTP', 'ktp.jpg', 'ktp-uuid-ts.jpg', 'image/jpeg', 1024, 'abcsha', 'Admin', ?)
      `).run(fixedTime);

      const res = reconcileLegacyDocuments(db);
      assert.strictEqual(res.conflictsCount, 0);

      const docRow = db.prepare("SELECT updated_at FROM documents WHERE id = 'DOC-TIMESTAMP'").get() as any;
      assert.strictEqual(docRow.updated_at, fixedTime, "updated_at must NOT be modified when document is already linked");

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D6-4: Repeated seedDatabase execution does not mutate templates or timestamps", () => {
    const dbPath = createTempDbPath("d6-4");
    try {
      const db = initDatabase({ runSchema: true, targetPath: dbPath });

      seedDatabase();

      const templatesBefore = db.prepare("SELECT id, name, updated_at, data_json FROM estimation_templates ORDER BY id ASC").all() as any[];
      assert.ok(templatesBefore.length > 0, "Estimation templates must be seeded");

      seedDatabase();

      const templatesAfter = db.prepare("SELECT id, name, updated_at, data_json FROM estimation_templates ORDER BY id ASC").all() as any[];
      assert.strictEqual(templatesAfter.length, templatesBefore.length);

      for (let i = 0; i < templatesBefore.length; i++) {
        assert.strictEqual(templatesAfter[i].id, templatesBefore[i].id);
        assert.strictEqual(templatesAfter[i].data_json, templatesBefore[i].data_json, `Template ${templatesBefore[i].id} data_json mutated`);
        assert.strictEqual(templatesAfter[i].updated_at, templatesBefore[i].updated_at, `Template ${templatesBefore[i].id} updated_at mutated`);
      }

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  /* =========================================================================
   * BATCH D7: Startup Redundancy & Redundant Schema Execution Guard
   * ========================================================================= */

  await t.test("D7-1: initializeSchema skips redundant execution on same connection", () => {
    const dbPath = createTempDbPath("d7-1");
    try {
      const db = initDatabase({ runSchema: false, targetPath: dbPath });

      initializeSchema(db);
      initializeSchema(db);
      initializeSchema(db, { force: true });

      closeDb();
    } finally {
      closeDb();
      cleanupTempDb(dbPath);
    }
  });

  await t.test("D7-2: Multiple independent database connections initialize safely without cross-talk", () => {
    const dbPathA = createTempDbPath("d7-2a");
    const dbPathB = createTempDbPath("d7-2b");
    try {
      const dbA = new DatabaseSync(dbPathA);
      const dbB = new DatabaseSync(dbPathB);

      initializeSchema(dbA);
      initializeSchema(dbB);

      const tablesA = (dbA.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").get() as any).c;
      const tablesB = (dbB.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").get() as any).c;

      assert.ok(tablesA > 20, "dbA must have initialized all tables");
      assert.strictEqual(tablesA, tablesB, "Both connections must have identical table count");

      dbA.close();
      dbB.close();
    } finally {
      cleanupTempDb(dbPathA);
      cleanupTempDb(dbPathB);
    }
  });
});
