/**
 * PRE-RESET HARDENING TEST SUITE
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. Empty cash tables & zero-fallback behavior (never assumes Rp 15.000.000).
 * 2. Server startup & seedDatabase idempotency (does not inject phantom 15m).
 * 3. Opening balance Rp0 & authorization guards (role check).
 * 4. Opening balance with new capital & mathematical progression.
 * 5. Transfer kas kantor ke messenger & bilateral balance guards.
 * 6. Verified invoice payment lifecycle on reset database.
 * 7. Reset failure safety & transactional rollback.
 * 8. Backup archive, manifest verification & restore test.
 */

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import {
  createPreResetArchive,
  executeTransactionalReset,
  restoreFromArchive,
  computeFileSha256,
  MASTER_DATA_TABLES,
  TRANSACTIONAL_TABLES,
  classifyAuditLog,
  TRANSACTIONAL_AUDIT_RULES,
} from "../server/src/utils/transactionResetService";

test("PRE-RESET HARDENING & CASH SAFETY TEST SUITE", async (t) => {
  const operationalDbPath = path.resolve("server/data/database.sqlite");
  const tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), "sun89-hardening-test-"));
  const tempDbPath = path.join(tempTestDir, "test-database.sqlite");
  const tempUploadsDir = path.join(tempTestDir, "uploads");
  const tempArchiveDir = path.join(tempTestDir, "archive");

  // Setup isolated copies
  fs.copyFileSync(operationalDbPath, tempDbPath);
  fs.mkdirSync(tempUploadsDir, { recursive: true });
  fs.writeFileSync(path.join(tempUploadsDir, "sample-doc.pdf"), "DUMMY_PDF_CONTENT");
  fs.writeFileSync(path.join(tempUploadsDir, ".gitkeep"), "");

  process.env.APP_ENV = "test";
  process.env.NODE_ENV = "test";
  process.env.DB_PATH = tempDbPath;
  process.env.UPLOAD_DIR = tempUploadsDir;
  process.env.ALLOW_OPERATIONAL_WRITES = "true";

  const { initDatabase, getDb } = await import("../server/src/database/db");
  initDatabase({ targetPath: tempDbPath });
  const isolatedDb = getDb();

  const { dbFinanceRepository } = await import("../server/src/repositories/dbFinanceRepository");
  const { financeService } = await import("../server/src/services/financeService");
  const { orderService } = await import("../server/src/services/orderService");
  const { seedDatabase } = await import("../server/src/database/seed");
  const { computeCanonicalLabaRugi } = await import("../src/domain/finance/labaRugiCanonical");

  await t.test("1. Empty cash tables & zero-fallback behavior", async () => {
    // Clear kas_kantor and kas_messenger completely
    isolatedDb.exec("DELETE FROM kas_kantor;");
    isolatedDb.exec("DELETE FROM kas_messenger;");

    const kasRows = dbFinanceRepository.getAllKasKantor();
    assert.strictEqual(kasRows.length, 0, "Empty kas_kantor must return empty array");

    // Test addKasKantor on empty table: must start from 0, NEVER 15.000.000
    const entry = dbFinanceRepository.addKasKantor({
      tanggal: "2026-11-04",
      keterangan: "Penerimaan Pertama Pasca Reset",
      status: "Debit",
      debit: 100000,
      kredit: 0,
      penanggungJawab: "Admin Test",
    });

    assert.strictEqual(entry.saldo, 100000, "First debit on empty ledger must yield exactly 100.000 (0 + 100.000), NEVER 15.100.000!");

    // Clean up test entry
    isolatedDb.exec("DELETE FROM kas_kantor;");
  });

  await t.test("2. Server startup & seedDatabase does not inject phantom 15m", async () => {
    // Ensure kas_kantor is empty
    isolatedDb.exec("DELETE FROM kas_kantor;");
    const countBefore = (isolatedDb.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
    assert.strictEqual(countBefore, 0);

    // Call seedDatabase()
    seedDatabase();

    const countAfter = (isolatedDb.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
    assert.strictEqual(countAfter, 0, "seedDatabase must NEVER inject implicit Rp 15.000.000 into empty kas_kantor!");
  });

  await t.test("3. Opening balance Rp0 & authorization guards", async () => {
    // Reset sqlite_sequence for kas_kantor to simulate post-reset sequence
    isolatedDb.exec("DELETE FROM sqlite_sequence WHERE name = 'kas_kantor';");

    // Unauthorized user (role: 'finance') attempting to set MODAL_AWAL must be REJECTED (403)
    assert.throws(
      () => {
        financeService.addKasKantor(
          {
            tanggal: "2026-11-04",
            keterangan: "Percobaan Setor Modal Ilegal",
            status: "Debit",
            debit: 5000000,
            kredit: 0,
            kategori: "MODAL_AWAL",
          },
          { userId: "usr-finance", nama: "Staf Finance", role: "finance" } as any
        );
      },
      (err: any) => err.statusCode === 403,
      "Finance role must not be permitted to set MODAL_AWAL"
    );

    // Authorized supervisor setting opening balance Rp0
    const open0 = financeService.addKasKantor(
      {
        tanggal: "2026-11-04",
        keterangan: "Saldo Awal Kas Kantor Operasional Siklus Baru",
        status: "Debit",
        debit: 0,
        kredit: 0,
        kategori: "MODAL_AWAL",
      },
      { userId: "usr-spv", nama: "Supervisor", role: "supervisor" } as any
    );

    assert.strictEqual(open0.saldo, 0, "Opening balance must be 0");
    assert.strictEqual(open0.id, 1, "First entry must have ID = 1");
  });

  await t.test("4. Opening balance with new capital & office cash balance guard", async () => {
    // Authorized admin injecting fresh capital Rp 10.000.000
    const capital = financeService.addKasKantor(
      {
        tanggal: "2026-11-04",
        keterangan: "Penyetoran Modal Awal Baru",
        status: "Debit",
        debit: 10000000,
        kredit: 0,
        kategori: "MODAL_AWAL",
      },
      { userId: "usr-admin", nama: "Admin", role: "admin" } as any
    );

    assert.strictEqual(capital.saldo, 10000000, "Saldo after 10m capital must be exactly 10.000.000");

    // Attempting withdrawal (Kredit) exceeding available balance must be REJECTED (INSUFFICIENT_OFFICE_BALANCE)
    assert.throws(
      () => {
        financeService.addKasKantor(
          {
            tanggal: "2026-11-04",
            keterangan: "Penarikan Melebihi Saldo",
            status: "Kredit",
            debit: 0,
            kredit: 15000000,
          },
          { userId: "usr-admin", nama: "Admin", role: "admin" } as any
        );
      },
      (err: any) => err.statusCode === 400 && err.code === "INSUFFICIENT_OFFICE_BALANCE",
      "Withdrawal exceeding office cash balance must be rejected"
    );
  });

  await t.test("5. Transfer kas kantor ke messenger & bilateral balance guards", async () => {
    // Current office balance is 10.000.000. Messenger MSG-0001 balance is 0.
    // 5.1 Transfer 2.000.000 from office to messenger
    const trfOut = financeService.transferOfficeToMessenger(
      {
        messengerId: "MSG-0001",
        amount: 2000000,
        notes: "Uang jalan operasional samsat",
        idempotencyKey: `IDEMP-O2M-${Date.now()}-1`,
      },
      { userId: "usr-admin", nama: "Admin", role: "admin" } as any
    );

    assert.strictEqual(trfOut.status, "COMPLETED");

    // Check office balance: 10m - 2m = 8m
    const officeBalRow = isolatedDb.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as bal FROM kas_kantor").get() as any;
    assert.strictEqual(officeBalRow.bal, 8000000);

    // Check messenger balance: 0 + 2m = 2m
    const msgrBalRow = isolatedDb.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as bal FROM kas_messenger WHERE messenger_id = 'MSG-0001'").get() as any;
    assert.strictEqual(msgrBalRow.bal, 2000000);

    // 5.2 Attempt transfer from office exceeding balance (e.g. 15.000.000 when only 8.000.000 available)
    assert.throws(
      () => {
        financeService.transferOfficeToMessenger(
          {
            messengerId: "MSG-0001",
            amount: 15000000,
            idempotencyKey: `IDEMP-O2M-${Date.now()}-2`,
          },
          { userId: "usr-admin", nama: "Admin", role: "admin" } as any
        );
      },
      (err: any) => err.statusCode === 400 && err.code === "INSUFFICIENT_OFFICE_BALANCE"
    );

    // 5.3 Transfer back from messenger to office (return unused 500.000)
    const trfIn = financeService.transferMessengerToOffice(
      {
        messengerId: "MSG-0001",
        amount: 500000,
        notes: "Sisa uang jalan",
        idempotencyKey: `IDEMP-M2O-${Date.now()}-1`,
      },
      { userId: "usr-admin", nama: "Admin", role: "admin" } as any
    );
    assert.strictEqual(trfIn.status, "COMPLETED");

    // Messenger balance: 2m - 500k = 1.500.000
    const msgrBalAfter = isolatedDb.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as bal FROM kas_messenger WHERE messenger_id = 'MSG-0001'").get() as any;
    assert.strictEqual(msgrBalAfter.bal, 1500000);

    // Office balance: 8m + 500k = 8.500.000
    const officeBalAfter = isolatedDb.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as bal FROM kas_kantor").get() as any;
    assert.strictEqual(officeBalAfter.bal, 8500000);

    // 5.4 Messenger direct expenditure exceeding balance must be REJECTED
    assert.throws(
      () => {
        financeService.addKasMessenger(
          {
            tanggal: "2026-11-04",
            jenis: "Operasional",
            messenger: "Budi Santoso",
            messenger_id: "MSG-0001",
            keterangan: "Pengeluaran Melebihi Saldo Kurir",
            in: 0,
            out: 3000000, // available 1.5m
          } as any,
          { userId: "usr-admin", nama: "Admin", role: "admin" } as any
        );
      },
      (err: any) => err.statusCode === 400 && err.code === "INSUFFICIENT_MESSENGER_BALANCE",
      "Messenger out exceeding balance must be rejected"
    );
  });

  await t.test("6. Verified invoice payment lifecycle & canonical financial summary", async () => {
    // Clear orders and finance_invoices to simulate clean post-reset state
    isolatedDb.exec("DELETE FROM invoice_payments; DELETE FROM finance_invoices; DELETE FROM orders;");
    isolatedDb.exec("DELETE FROM sqlite_sequence WHERE name IN ('finance_invoices', 'invoice_payments');");

    // Create new order
    const orderRes = orderService.createOrder(
      {
        customer: "PT Sinergi Mandiri Abadi",
        noHp: "081299887766",
        nopol: "B 1234 SM",
        tipeKendaraan: "Mobil",
        tahun: 2024,
        service: "Perpanjangan STNK Tahunan",
        layanan: "Perpanjangan STNK",
        wilayah: "Jakarta Selatan",
        samsat: "Samsat Jakarta Selatan",
        metodeLayanan: "Antar Jemput",
        status: "Pendaftaran Order",
        biayaJasa: 150000,
        biayaSamsat: 475000,
        totalBiaya: 625000,
        isInitialPaymentVerified: true,
        payment: {
          isPaymentVerified: true,
          nominalDibayarAwal: 200000,
          metodePembayaran: "Transfer BCA",
          statusPembayaran: "Menunggu Pelunasan",
          bank: "BCA",
        },
      } as any,
      { userId: "usr-admin", nama: "Admin", role: "admin" } as any
    );

    assert.strictEqual(orderRes.orderNo, "ORD-1126-001");
    const inv = financeService.getInvoiceById(orderRes.orderNo);
    assert.strictEqual(inv.invoiceNo, "INV-1126-001");

    const allInvs = financeService.getAllInvoices();
    const allKas = dbFinanceRepository.getAllKasKantor();
    const summary = computeCanonicalLabaRugi(allInvs as any, [], [], "all", undefined, undefined, undefined, allKas as any);

    assert.strictEqual(summary.grossRevenue, 200000);
    assert.strictEqual(summary.grossProfit, 48000);
    // Cash flow final balance: 8.500.000 + 200.000 = 8.700.000
    assert.strictEqual(summary.cashFlowReconciliation.kasKantor.saldoAkhir, 8700000);
  });

  await t.test("7. Reset failure safety & transactional rollback", async () => {
    // Operational reset without explicit confirmation MUST be rejected
    assert.throws(
      () => {
        executeTransactionalReset({
          dbPath: operationalDbPath,
          confirmOperationalReset: "NO_CONFIRMATION",
        });
      },
      (err: any) => err.message.includes("FATAL OPERATIONAL RESET GUARD"),
      "Operational reset without confirmation must be blocked"
    );
  });

  await t.test("8. Backup archive, manifest verification & restore test", async () => {
    // Create pre-reset archive of our test database & uploads
    const archiveResult = createPreResetArchive({
      dbPath: tempDbPath,
      uploadsDir: tempUploadsDir,
      archiveDir: tempArchiveDir,
    });

    assert.strictEqual(archiveResult.verified, true);
    assert.ok(fs.existsSync(archiveResult.dbBackupPath));
    assert.ok(fs.existsSync(archiveResult.manifestPath));

    // Verify manifest contents
    const manifest = JSON.parse(fs.readFileSync(archiveResult.manifestPath, "utf8"));
    assert.ok(manifest.length >= 2, "Manifest must contain DB and upload files");
    const dbEntry = manifest.find((m: any) => m.relativePath === "database.sqlite");
    assert.ok(dbEntry && dbEntry.sha256 === archiveResult.dbSha256);

    // Restore to another isolated location
    const restoreDir = path.join(tempTestDir, "restored");
    const restoreDbPath = path.join(restoreDir, "restored.sqlite");
    const restoreUploadsDir = path.join(restoreDir, "uploads");

    const restoreRes = restoreFromArchive(tempArchiveDir, restoreDbPath, restoreUploadsDir);
    assert.strictEqual(restoreRes.dbRestored, true);
    assert.strictEqual(restoreRes.integrity, "ok");

    // Compare table counts on restored database
    const restoredDb = new DatabaseSync(restoreDbPath, { readOnly: true });
    try {
      const restoredUsers = (restoredDb.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
      assert.strictEqual(restoredUsers, 6, "Restored database must contain exactly 6 users");
      const restoredSamsat = (restoredDb.prepare("SELECT COUNT(*) as c FROM samsat_offices").get() as any).c;
      assert.strictEqual(restoredSamsat, 515, "Restored database must contain 515 samsat offices");
    } finally {
      restoredDb.close();
    }
  });

  await t.test("9. End-to-end executeTransactionalReset with granular audit logs & opening balance", async () => {
    // Run executeTransactionalReset on isolated tempDbPath
    const resetResult = executeTransactionalReset({
      dbPath: tempDbPath,
      uploadsDir: tempUploadsDir,
      archiveDir: path.join(tempTestDir, "reset-archive"),
      openingBalance: 15000000,
      openingBalanceDesc: "Modal Awal Kas Kantor Operasional Siklus Baru Disetujui Owner",
    });

    assert.strictEqual(resetResult.success, true);
    assert.strictEqual(resetResult.kasKantorOpeningId, 1);
    assert.strictEqual(resetResult.kasKantorOpeningSaldo, 15000000);

    const checkDb = new DatabaseSync(tempDbPath, { readOnly: true });
    try {
      // 1. Master data must be 100% intact
      for (const tbl of MASTER_DATA_TABLES) {
        const count = (checkDb.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get() as any).c;
        assert.strictEqual(count, resetResult.preservedMasterCounts[tbl], `Master table ${tbl} count must match!`);
      }

      // 2. Transaction tables must be exactly 0
      for (const tbl of TRANSACTIONAL_TABLES) {
        const count = (checkDb.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get() as any).c;
        assert.strictEqual(count, 0, `Transaction table ${tbl} must be 0 rows`);
      }

      // 3. kas_kantor must have exactly 1 row (opening record)
      const kasCount = (checkDb.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
      assert.strictEqual(kasCount, 1, "kas_kantor must have exactly 1 opening row");
      const kasRow = checkDb.prepare("SELECT * FROM kas_kantor WHERE id = 1").get() as any;
      assert.strictEqual(kasRow.saldo, 15000000);
      assert.strictEqual(kasRow.kategori, "MODAL_AWAL");

      // 4. sqlite_sequence: users must be preserved at 6, kas_kantor at 1
      const seqRows = checkDb.prepare("SELECT * FROM sqlite_sequence").all() as any[];
      const userSeq = seqRows.find((r) => r.name === "users");
      assert.ok(userSeq && userSeq.seq === 6, "users autoincrement sequence must be preserved at 6");
      const kasSeq = seqRows.find((r) => r.name === "kas_kantor");
      assert.ok(kasSeq && kasSeq.seq === 1, "kas_kantor sequence must be set to 1 for the opening record");
      const otherSeq = seqRows.filter((r) => r.name !== "users" && r.name !== "kas_kantor");
      assert.strictEqual(otherSeq.length, 0, "All other transactional autoincrements must be cleared");

      // 5. Audit logs: Auth/Security preserved, transactional cleared
      assert.ok(resetResult.auditLogsPreservedCount >= 462, "Authentication and security logs must be preserved");
      assert.ok(resetResult.auditLogsClearedCount > 0, "Transactional logs must be cleared");
    } finally {
      checkDb.close();
    }
  });

  await t.test("10. Blocker 1: Audit log explicit classification & immunity against ORD/INV substrings", async () => {
    // 1. Direct unit verification of classifyAuditLog
    const authClass = classifyAuditLog({ module: "Authentication", action: "LOGIN" });
    assert.strictEqual(authClass.decision, "KEEP");
    assert.strictEqual(authClass.category, "AUTHENTICATION");

    const userClass = classifyAuditLog({ module: "Manajemen Pengguna", action: "UPDATE_USER" });
    assert.strictEqual(userClass.decision, "KEEP");
    assert.strictEqual(userClass.category, "USER_MANAGEMENT");

    const permClass = classifyAuditLog({ module: "Hak Akses", action: "UPDATE_PERMISSIONS" });
    assert.strictEqual(permClass.decision, "KEEP");
    assert.strictEqual(permClass.category, "ACCESS_CONTROL");

    const templateClass = classifyAuditLog({ module: "Master Data Biaya Layanan", action: "UPDATE_ESTIMATION_TEMPLATE" });
    assert.strictEqual(templateClass.decision, "KEEP");
    assert.strictEqual(templateClass.category, "MASTER_CONFIGURATION");

    const unknownClass = classifyAuditLog({ module: "UnknownSecurityScanner", action: "CUSTOM_INSPECT" });
    assert.strictEqual(unknownClass.decision, "KEEP");
    assert.strictEqual(unknownClass.category, "UNKNOWN");

    const orderClass = classifyAuditLog({ module: "Order", action: "CREATE" });
    assert.strictEqual(orderClass.decision, "CLEAR");
    assert.strictEqual(orderClass.category, "TRANSACTIONAL_ORDER");

    const finClass = classifyAuditLog({ module: "Finance Tagihan", action: "VOID_INVOICE_PAYMENT" });
    assert.strictEqual(finClass.decision, "CLEAR");
    assert.strictEqual(finClass.category, "TRANSACTIONAL_FINANCE");

    // 2. Integration verification on isolated database:
    // Insert audit logs containing 'ORD-' and 'INV-' inside details for non-transactional modules
    const auditDbPath = path.join(tempTestDir, "audit-immunity.sqlite");
    fs.copyFileSync(operationalDbPath, auditDbPath);
    const auditDb = new DatabaseSync(auditDbPath);

    auditDb.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, module, details, created_at)
      VALUES 
        ('test-log-auth-ord', 'usr-1', 'Admin', 'admin', 'LOGIN', 'Authentication', 'User login during investigation of ORD-1126-002', datetime('now')),
        ('test-log-user-inv', 'usr-1', 'Admin', 'admin', 'UPDATE_USER', 'Manajemen Pengguna', 'Assigned supervisor to handle dispute INV-1126-002', datetime('now')),
        ('test-log-perm-ord', 'usr-1', 'Admin', 'admin', 'UPDATE_PERMISSIONS', 'Hak Akses', 'Updated role permissions for order processors ORD-1126-005', datetime('now')),
        ('test-log-unknown-ord', 'usr-1', 'Admin', 'admin', 'SECURITY_SCAN', 'ExternalAuditor', 'Audit report on ORD-1126-001 integrity', datetime('now')),
        ('test-log-trans-ord', 'usr-1', 'Admin', 'admin', 'CREATE', 'Order', 'Created order ORD-9999-001', datetime('now')),
        ('test-log-trans-inv', 'usr-1', 'Admin', 'admin', 'VOID_INVOICE_PAYMENT', 'Finance Tagihan', 'Void payment for INV-9999-001', datetime('now'));
    `).run();
    auditDb.close();

    const resetAuditRes = executeTransactionalReset({
      dbPath: auditDbPath,
      uploadsDir: tempUploadsDir,
      archiveDir: path.join(tempTestDir, "archive-audit-test"),
    });

    assert.strictEqual(resetAuditRes.success, true);

    const verifyDb = new DatabaseSync(auditDbPath, { readOnly: true });
    try {
      // Must KEEP non-transactional logs even if details have 'ORD-' or 'INV-'
      const keptAuth = verifyDb.prepare("SELECT * FROM audit_logs WHERE id = 'test-log-auth-ord'").get();
      assert.ok(keptAuth, "Authentication log with ORD- in details must be strictly KEPT!");

      const keptUser = verifyDb.prepare("SELECT * FROM audit_logs WHERE id = 'test-log-user-inv'").get();
      assert.ok(keptUser, "Manajemen Pengguna log with INV- in details must be strictly KEPT!");

      const keptPerm = verifyDb.prepare("SELECT * FROM audit_logs WHERE id = 'test-log-perm-ord'").get();
      assert.ok(keptPerm, "Hak Akses log with ORD- in details must be strictly KEPT!");

      const keptUnknown = verifyDb.prepare("SELECT * FROM audit_logs WHERE id = 'test-log-unknown-ord'").get();
      assert.ok(keptUnknown, "Unknown module log with ORD- in details must be strictly KEPT by default!");

      // Must CLEAR explicit transactional order and finance logs
      const clearedOrder = verifyDb.prepare("SELECT * FROM audit_logs WHERE id = 'test-log-trans-ord'").get();
      assert.strictEqual(clearedOrder, undefined, "Order CREATE log must be CLEARED!");

      const clearedFin = verifyDb.prepare("SELECT * FROM audit_logs WHERE id = 'test-log-trans-inv'").get();
      assert.strictEqual(clearedFin, undefined, "Finance VOID log must be CLEARED!");
    } finally {
      verifyDb.close();
    }
  });

  await t.test("11. Blocker 2: SQLite WAL backup safety with active uncheckpointed frames", async () => {
    const walTestDbPath = path.join(tempTestDir, "wal-source.sqlite");
    const walArchiveDir = path.join(tempTestDir, "wal-archive");
    const walRestoreDbPath = path.join(tempTestDir, "wal-restored.sqlite");

    // 1. Create a WAL mode database with uncheckpointed commits
    fs.copyFileSync(operationalDbPath, walTestDbPath);
    const walWriter = new DatabaseSync(walTestDbPath);
    walWriter.exec("PRAGMA journal_mode = WAL;");
    walWriter.exec("CREATE TABLE IF NOT EXISTS wal_safety_verification (id INTEGER PRIMARY KEY, note TEXT);");

    // Insert 50 rows in active WAL
    walWriter.exec("BEGIN TRANSACTION;");
    for (let i = 1; i <= 50; i++) {
      walWriter.prepare("INSERT INTO wal_safety_verification (id, note) VALUES (?, ?)").run(i, `wal_row_${i}`);
    }
    walWriter.exec("COMMIT;");

    // Check WAL file exists and is populated
    const walFile = `${walTestDbPath}-wal`;
    assert.ok(fs.existsSync(walFile), "WAL file must exist");
    assert.ok(fs.statSync(walFile).size > 0, "WAL file must contain active frames");

    // 2. Create archive (Using VACUUM INTO) while writer is active
    const archiveRes = createPreResetArchive({
      dbPath: walTestDbPath,
      uploadsDir: tempUploadsDir,
      archiveDir: walArchiveDir,
    });
    assert.strictEqual(archiveRes.verified, true);

    // Close source
    walWriter.close();

    // 3. Restore to new location
    const restoreRes = restoreFromArchive(walArchiveDir, walRestoreDbPath, path.join(tempTestDir, "wal-restored-uploads"));
    assert.strictEqual(restoreRes.dbRestored, true);
    assert.strictEqual(restoreRes.integrity, "ok");

    // 4. Verify that 100% of uncheckpointed WAL rows are recovered
    const checkRestored = new DatabaseSync(walRestoreDbPath, { readOnly: true });
    try {
      const rowCount = (checkRestored.prepare("SELECT COUNT(*) as c FROM wal_safety_verification").get() as any).c;
      assert.strictEqual(rowCount, 50, "100% of committed WAL transactions must be restored!");

      const integrity = (checkRestored.prepare("PRAGMA integrity_check;").get() as any).integrity_check;
      assert.strictEqual(integrity, "ok", "Restored database must pass SQLite integrity_check");
    } finally {
      checkRestored.close();
    }
  });

  await t.test("12. Blocker 2: Backup failure abort guard (zero deletion on failure)", async () => {
    const failSafeDbPath = path.join(tempTestDir, "fail-safe.sqlite");
    fs.copyFileSync(operationalDbPath, failSafeDbPath);

    // Record initial counts
    const preCheckDb = new DatabaseSync(failSafeDbPath, { readOnly: true });
    const ordersCountBefore = (preCheckDb.prepare("SELECT COUNT(*) as c FROM orders").get() as any).c;
    const invCountBefore = (preCheckDb.prepare("SELECT COUNT(*) as c FROM finance_invoices").get() as any).c;
    const auditCountBefore = (preCheckDb.prepare("SELECT COUNT(*) as c FROM audit_logs").get() as any).c;
    preCheckDb.close();

    assert.ok(ordersCountBefore > 0);
    assert.ok(invCountBefore > 0);

    // Create a dummy file where archiveDir would be created to induce mkdirSync/write failure
    const badArchiveFile = path.join(tempTestDir, "bad-archive-file");
    fs.writeFileSync(badArchiveFile, "CANNOT_MAKE_DIR_HERE");

    // Attempt executeTransactionalReset with invalid archive target
    assert.throws(
      () => {
        executeTransactionalReset({
          dbPath: failSafeDbPath,
          archiveDir: path.join(badArchiveFile, "subfolder"), // Path under a regular file fails on all OS
        });
      },
      /ENOTDIR|EEXIST|Error/i,
      "executeTransactionalReset must throw if pre-reset archive cannot be created"
    );

    // Verify ZERO deletion: Database must remain 100% untouched
    const postCheckDb = new DatabaseSync(failSafeDbPath, { readOnly: true });
    try {
      const ordersCountAfter = (postCheckDb.prepare("SELECT COUNT(*) as c FROM orders").get() as any).c;
      const invCountAfter = (postCheckDb.prepare("SELECT COUNT(*) as c FROM finance_invoices").get() as any).c;
      const auditCountAfter = (postCheckDb.prepare("SELECT COUNT(*) as c FROM audit_logs").get() as any).c;

      assert.strictEqual(ordersCountAfter, ordersCountBefore, "Orders must NOT be deleted if backup fails!");
      assert.strictEqual(invCountAfter, invCountBefore, "Invoices must NOT be deleted if backup fails!");
      assert.strictEqual(auditCountAfter, auditCountBefore, "Audit logs must NOT be deleted if backup fails!");
    } finally {
      postCheckDb.close();
    }
  });

  // Teardown
  isolatedDb.close();
  try {
    fs.rmSync(tempTestDir, { recursive: true, force: true });
  } catch {}
});
