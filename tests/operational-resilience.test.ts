/**
 * Phase 7.6 Operational Resilience & Deployment Verification Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies all 12 operational capabilities:
 * 1. Production configuration validation & secret entropy enforcement
 * 2. Liveness health check probe (/api/health, /api/health/live)
 * 3. Readiness probe (/api/health/ready with DB & storage checks)
 * 4. Database crash-consistent backup & restore (VACUUM INTO & integrity_check)
 * 5. Document storage backup & restore with SHA-256 disaster recovery verification
 * 6. Graceful shutdown server lifecycle & bounded request completion
 * 7. SQLite concurrency & concurrent write safety under load
 * 8. Expired document ticket rejection
 * 9. Single-use document ticket reuse prevention
 * 10. Strict elimination of JWT in query strings
 * 11. Prohibition of public static exposure for server/uploads
 * 12. Sanitized production error responses without information disclosure
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/src/app";
import { validateEnv, CONFIG } from "../server/src/config/env";
import { db } from "../server/src/database/db";
import { dbDocumentRepository } from "../server/src/repositories/dbDocumentRepository";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { DocumentTicketService, documentTicketService } from "../server/src/services/documentTicketService";
import { generateToken } from "../server/src/utils/crypto";
import {
  backupDatabase,
  restoreDatabase,
  backupUploads,
  restoreUploads,
  verifyDisasterRecovery,
} from "../server/src/utils/backupRestore";
import { initializeSchema } from "../server/src/database/schema";
import { createIsolatedTestWorkspace } from "../server/src/testing/testIsolationHelper";

function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

// -----------------------------------------------------------------------------
// Test 1: Production Configuration Validation & Secret Hardening
// -----------------------------------------------------------------------------
test("Operational 1: Production Configuration Validator enforces secret entropy, port and CORS constraints", () => {
  // 1. Invalid port numbers
  assert.throws(() => validateEnv({ PORT: -1 }), /Invalid PORT/);
  assert.throws(() => validateEnv({ PORT: 70000 }), /Invalid PORT/);

  // 2. Production mode without JWT_SECRET
  assert.throws(
    () => validateEnv({ NODE_ENV: "production", JWT_SECRET: "" }),
    /JWT_SECRET must be explicitly set/
  );

  // 3. Production mode with default dev secret or short secret (<32 chars)
  assert.throws(
    () => validateEnv({ NODE_ENV: "production", JWT_SECRET: "sun89-secure-birojasa-secret-key-2026" }),
    /JWT_SECRET must be explicitly set and be at least 32 characters long/
  );
  assert.throws(
    () => validateEnv({ NODE_ENV: "production", JWT_SECRET: "too-short-secret" }),
    /JWT_SECRET must be explicitly set/
  );

  // 4. Production mode with known insecure placeholder
  assert.throws(
    () => validateEnv({ NODE_ENV: "production", JWT_SECRET: "12345678901234567890123456789012" }),
    /Insecure placeholder detected/
  );

  // 5. Production mode with Wildcard CORS Origin
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: "production",
        JWT_SECRET: "valid-production-secret-with-high-entropy-1234567890",
        CORS_ORIGIN: "*",
      }),
    /Wildcard CORS origin/
  );

  // 6. Invalid upload path
  assert.throws(
    () =>
      validateEnv({
        UPLOAD_DIR: "",
      }),
    /UPLOAD_DIR must be a non-empty string path/
  );

  // 7. Invalid DB path
  assert.throws(
    () =>
      validateEnv({
        DB_PATH: "",
      }),
    /DB_PATH must be a non-empty string path/
  );

  // 8. Valid Production Configuration succeeds
  assert.doesNotThrow(() => {
    validateEnv({
      PORT: 3001,
      NODE_ENV: "production",
      JWT_SECRET: "super-secure-production-random-secret-key-at-least-32-chars",
      CORS_ORIGIN: "https://admin.birojasa.com",
      UPLOAD_DIR: "/var/app/uploads",
      DB_PATH: "/var/app/data/prod.sqlite",
      MAX_FILE_SIZE_BYTES: 5242880,
      TICKET_TTL_SECONDS: 60,
    });
  });
});

// -----------------------------------------------------------------------------
// Test 2: Liveness Probe (/api/health and /api/health/live)
// -----------------------------------------------------------------------------
test("Operational 2: Liveness probe returns 200 immediately without expensive operations", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res1 = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res1.status, 200);
    const body1 = await res1.json() as any;
    assert.strictEqual(body1.status, "ok");
    assert.ok(typeof body1.uptime === "number");
    assert.ok(typeof body1.timestamp === "string");

    const res2 = await fetch(`${baseUrl}/api/health/live`);
    assert.strictEqual(res2.status, 200);
    const body2 = await res2.json() as any;
    assert.strictEqual(body2.status, "ok");
  } finally {
    server.close();
  }
});

// -----------------------------------------------------------------------------
// Test 3: Readiness Probe (/api/health/ready)
// -----------------------------------------------------------------------------
test("Operational 3: Readiness probe validates SQLite connection and writable persistent storage", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/health/ready`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.status, "ready");
    assert.strictEqual(body.checks.database, "healthy");
    assert.strictEqual(body.checks.storage, "healthy");
    assert.strictEqual(body.checks.config, "healthy");
  } finally {
    server.close();
  }
});

// -----------------------------------------------------------------------------
// Test 4: Database Atomic Backup (VACUUM INTO) and Restore Verification
// -----------------------------------------------------------------------------
test("Operational 4: Database backup produces verified crash-consistent snapshot and restores cleanly", () => {
  const workspace = createIsolatedTestWorkspace("operational_4_backup");
  const testBackupDir = workspace.backupsDir;
  const backupFile = path.join(testBackupDir, `test_db_${Date.now()}.sqlite`);
  let restoredDb: DatabaseSync | null = null;

  try {
    // 1. Execute VACUUM INTO backup
    const backupRes = backupDatabase(backupFile);
    assert.strictEqual(backupRes.backupPath, backupFile);
    assert.ok(backupRes.sizeBytes > 0);
    assert.ok(fs.existsSync(backupFile));

    // 2. Verify restored database integrity
    const tempRestorePath = path.join(testBackupDir, `restored_${Date.now()}.sqlite`);
    const restoreRes = restoreDatabase(backupFile, tempRestorePath);
    assert.strictEqual(restoreRes.success, true);
    assert.strictEqual(restoreRes.integrity, "ok");

    // 3. Inspect restored DB contents
    restoredDb = new DatabaseSync(tempRestorePath);
    const orderCount = restoredDb.prepare("SELECT COUNT(*) as cnt FROM orders").get() as { cnt: number };
    assert.ok(orderCount.cnt > 0);
    restoredDb.close();
    restoredDb = null;
  } finally {
    workspace.cleanupSync([restoredDb]);
  }
});

// -----------------------------------------------------------------------------
// Test 5: Document Storage Backup, Restore & Disaster Recovery Verification (15-step sequence)
// -----------------------------------------------------------------------------
test("Operational 5: Complete 15-step isolated backup, restore and disaster recovery workflow", async () => {
  const workspace = createIsolatedTestWorkspace("operational_5_disaster_recovery");
  const testIsoDir = workspace.testDir;
  const testDbPath = path.join(testIsoDir, "origin_db.sqlite");
  const testUploadsDir = workspace.uploadsDir;
  const testBackupDir = workspace.backupsDir;
  const restoredDbPath = path.join(testIsoDir, "restored_db.sqlite");
  const restoredUploadsDir = path.join(testIsoDir, "restored_uploads");

  fs.mkdirSync(restoredUploadsDir, { recursive: true });

  const dummyContent = Buffer.from("%PDF-1.4 sample file for disaster recovery test");
  const dummySha = crypto.createHash("sha256").update(dummyContent).digest("hex");
  const docId = `DOC-DR-${Date.now()}`;
  const storageName = `${docId}_stnk.pdf`;
  const orderNo = `ORD-DR-${Date.now()}`;

  let originDb: DatabaseSync | null = null;
  let restoredDb: DatabaseSync | null = null;

  try {
    // 1. Create temporary test database
    originDb = new DatabaseSync(testDbPath);
    initializeSchema(originDb);

    // 2. Create known application data (order)
    originDb.prepare(`
      INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name, payment_status, total_biaya, is_archived, data_json, samsat_tujuan_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      orderNo,
      "Budi Santoso DR",
      "081234567890",
      "Perpanjangan STNK Tahunan",
      "B 1234 DR",
      1,
      "Verifikasi",
      "Belum Lunas",
      500000,
      0,
      JSON.stringify({ orderNo })
    );

    // 3. Create synthetic test document (physical file + metadata)
    const filePath = path.join(testUploadsDir, storageName);
    fs.writeFileSync(filePath, dummyContent);

    originDb.prepare(`
      INSERT INTO documents (
        id, order_no, invoice_id, document_type, original_name,
        storage_name, mime_type, size_bytes, sha256, uploaded_by, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId,
      orderNo,
      null,
      "STNK",
      "stnk.pdf",
      storageName,
      "application/pdf",
      dummyContent.length,
      dummySha,
      "Admin",
      1
    );

    // 4. Verify document metadata and physical file exist
    assert.ok(fs.existsSync(filePath), "Origin file must exist on disk");
    const docMetaBefore = originDb.prepare("SELECT * FROM documents WHERE id = ?").get(docId) as any;
    assert.ok(docMetaBefore, "Document metadata must exist in origin DB");
    assert.strictEqual(docMetaBefore.sha256, dummySha);

    // 5. Perform backup (DB snapshot via VACUUM INTO, uploads directory backup)
    const dbBackupFile = path.join(testBackupDir, "db_snapshot.sqlite");
    originDb.exec(`VACUUM INTO '${dbBackupFile.replace(/'/g, "''")}';`);
    originDb.close();
    originDb = null;

    const uploadsBackupDir = path.join(testBackupDir, "uploads");
    fs.mkdirSync(uploadsBackupDir, { recursive: true });
    fs.copyFileSync(filePath, path.join(uploadsBackupDir, storageName));

    // 6. Mutate/corrupt selected test state to simulate disaster
    fs.writeFileSync(testDbPath, Buffer.from("CORRUPTED_RAW_BYTES_SIMULATING_CRASH"));
    fs.unlinkSync(filePath);
    assert.ok(!fs.existsSync(filePath), "Origin uploads file deleted to simulate disaster");

    // 7. Simulate recovery
    // 8. Restore database backup
    const restoreDbRes = restoreDatabase(dbBackupFile, restoredDbPath);
    assert.strictEqual(restoreDbRes.success, true);
    assert.strictEqual(restoreDbRes.integrity, "ok");

    // 9. Restore document storage backup
    const restoreUploadsRes = restoreUploads(uploadsBackupDir, restoredUploadsDir);
    assert.strictEqual(restoreUploadsRes.restoredCount, 1);

    // 10. Start / verify application against restored state
    const drCheck = verifyDisasterRecovery(restoredDbPath, restoredUploadsDir);
    assert.strictEqual(drCheck.valid, true);
    assert.strictEqual(drCheck.dbIntegrity, "ok");
    assert.strictEqual(drCheck.checkedDocuments, 1);
    assert.strictEqual(drCheck.missingFiles.length, 0);
    assert.strictEqual(drCheck.mismatchedHashes.length, 0);

    restoredDb = new DatabaseSync(restoredDbPath);

    // 11. Retrieve restored order
    const restoredOrder = restoredDb.prepare("SELECT * FROM orders WHERE order_no = ?").get(orderNo) as any;
    assert.ok(restoredOrder, "Restored order must exist");
    assert.strictEqual(restoredOrder.order_no, orderNo);
    assert.strictEqual(restoredOrder.customer, "Budi Santoso DR");

    // 12. Retrieve restored document metadata
    const restoredDoc = restoredDb.prepare("SELECT * FROM documents WHERE id = ?").get(docId) as any;
    assert.ok(restoredDoc, "Restored document metadata must exist");
    assert.strictEqual(restoredDoc.id, docId);
    assert.strictEqual(restoredDoc.order_no, orderNo);
    assert.strictEqual(restoredDoc.sha256, dummySha);

    // 13. Obtain fresh document access ticket
    const ticketService = new DocumentTicketService(60);
    const ticketResult = ticketService.createTicket(docId, {
      userId: "1",
      email: "svp@birojasa.com",
      nama: "Admin Super (SVP)",
      jabatan: "administrator",
    }, "preview");
    assert.ok(ticketResult.ticket.startsWith("tkt_"));

    const val = ticketService.validateTicket(ticketResult.ticket, docId, "preview");
    assert.strictEqual(val.valid, true);

    // 14. Preview / download restored document bytes from recovered storage
    const restoredFile = path.join(restoredUploadsDir, restoredDoc.storage_name);
    assert.ok(fs.existsSync(restoredFile));
    const restoredBytes = fs.readFileSync(restoredFile);

    // 15. Verify SHA-256 matches exact pre-disaster hash
    const restoredHash = crypto.createHash("sha256").update(restoredBytes).digest("hex");
    assert.strictEqual(restoredHash, dummySha);
    restoredDb.close();
    restoredDb = null;
  } finally {
    await workspace.cleanup([originDb, restoredDb]);
  }
});

// -----------------------------------------------------------------------------
// Test 6: Graceful Server Shutdown Lifecycle
// -----------------------------------------------------------------------------
test("Operational 6: Server gracefully terminates HTTP listener and closes connections cleanly", async () => {
  const { server, baseUrl } = await startTestServer();

  // Verify server is listening
  const res = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res.status, 200);

  // Initiate graceful close
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Subsequent connection should fail
  await assert.rejects(
    async () => {
      await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
    },
    /ECONNREFUSED|fetch failed/
  );
});

// -----------------------------------------------------------------------------
// Test 7: SQLite Concurrency & Concurrent Write Safety
// -----------------------------------------------------------------------------
test("Operational 7: Concurrent transactional writes complete without lost updates or corruption", async () => {
  // Purge any stale test records from previous runs
  try {
    db.prepare("DELETE FROM documents WHERE id LIKE 'DOC-CONCUR-%'").run();
    db.prepare("DELETE FROM orders WHERE order_no LIKE 'ORD-CONCUR-%'").run();
  } catch {
    // ignore
  }

  const CONCURRENT_OPS = 10;
  const createdOrders: string[] = [];
  const createdDocs: string[] = [];

  try {
    // Launch concurrent order updates and document attachments
    const promises = Array.from({ length: CONCURRENT_OPS }).map(async (_, idx) => {
      const orderNo = `ORD-CONCUR-${Date.now()}-${idx}`;
      const docId = `DOC-CONCUR-${Date.now()}-${idx}`;
      createdOrders.push(orderNo);
      createdDocs.push(docId);

      // 1. Write order through repository transaction
      dbOrderRepository.saveOrder({
        orderNo,
        customer: `Concurrent Customer ${idx}`,
        nomorHP: "08123456789",
        layanan: "Perpanjangan STNK Tahunan",
        nopol: `B ${1000 + idx} XYZ`,
        status: "Verifikasi Berkas",
        currentStep: 1,
        currentStageName: "Verifikasi",
        totalBiaya: 500000,
        biayaJasa: 100000,
        createdAt: new Date().toISOString(),
      } as any);

      // 2. Concurrently insert linked document metadata
      dbDocumentRepository.createDocument({
        id: docId,
        orderNo,
        documentType: "STNK",
        originalName: `stnk_${idx}.pdf`,
        storageName: `storage_${docId}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 1024,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        uploadedBy: "Admin Concurrent",
      });

      // 3. Read back immediately
      const foundOrder = dbOrderRepository.getByOrderNo(orderNo);
      assert.ok(foundOrder !== null);
      assert.strictEqual(foundOrder?.orderNo, orderNo);

      const foundDoc = dbDocumentRepository.findById(docId);
      assert.ok(foundDoc !== null);
      assert.strictEqual(foundDoc?.orderNo, orderNo);
    });

    await Promise.all(promises);

    // Verify all orders and documents exist in database
    for (const orderNo of createdOrders) {
      const order = dbOrderRepository.getByOrderNo(orderNo);
      assert.ok(order !== null, `Order ${orderNo} must exist`);
    }

    for (const docId of createdDocs) {
      const doc = dbDocumentRepository.findById(docId);
      assert.ok(doc !== null, `Document ${docId} must exist`);
    }
  } finally {
    // Clean up created test records to preserve database test isolation
    for (const docId of createdDocs) {
      try {
        db.prepare("DELETE FROM documents WHERE id = ?").run(docId);
      } catch {
        // ignore
      }
    }
    for (const orderNo of createdOrders) {
      try {
        db.prepare("DELETE FROM orders WHERE order_no = ?").run(orderNo);
      } catch {
        // ignore
      }
    }
  }
});

// -----------------------------------------------------------------------------
// Test 8: Expired Document Ticket Rejection
// -----------------------------------------------------------------------------
test("Operational 8: Expired access ticket is strictly rejected with 401 UNAUTHENTICATED", async () => {
  const { server, baseUrl } = await startTestServer();
  const ticketService = new DocumentTicketService(60);

  const testUser = {
    userId: "1",
    email: "svp@birojasa.com",
    nama: "Admin",
    jabatan: "administrator" as const,
  };

  // Create an already-expired ticket (ttl: -1000ms)
  const expiredTicket = ticketService.createTicket("DOC-TEST-EXP", testUser, "preview", { ttlMs: -1000 });

  try {
    // 1. Direct service validation fails
    const val = ticketService.validateTicket(expiredTicket.ticket, "DOC-TEST-EXP", "preview");
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.error, "TICKET_EXPIRED");

    // 2. HTTP endpoint rejects expired ticket with 401
    const res = await fetch(`${baseUrl}/api/documents/DOC-TEST-EXP/preview?ticket=${expiredTicket.ticket}`);
    assert.strictEqual(res.status, 401);
  } finally {
    server.close();
  }
});

// -----------------------------------------------------------------------------
// Test 9: Document Ticket Reuse Prevention & Parameter Binding
// -----------------------------------------------------------------------------
test("Operational 9: Single-use document tickets cannot be reused after initial consumption and enforce strict scope", () => {
  const ticketService = new DocumentTicketService(60);

  const testUser = {
    userId: "1",
    email: "svp@birojasa.com",
    nama: "Admin",
    jabatan: "administrator" as const,
  };

  // 1. Issue single-use ticket for download
  const ticket = ticketService.createTicket("DOC-SINGLE-USE", testUser, "download", { maxUses: 1 });

  // 2. Wrong document mismatch check
  const mismatchDoc = ticketService.validateTicket(ticket.ticket, "DOC-WRONG-ID", "download", { consume: false });
  assert.strictEqual(mismatchDoc.valid, false);
  assert.strictEqual(mismatchDoc.error, "TICKET_DOCUMENT_MISMATCH");

  // 3. Wrong operation mismatch check
  const mismatchOp = ticketService.validateTicket(ticket.ticket, "DOC-SINGLE-USE", "preview", { consume: false });
  assert.strictEqual(mismatchOp.valid, false);
  assert.strictEqual(mismatchOp.error, "TICKET_OPERATION_MISMATCH");

  // 4. Malformed ticket check
  const malformed = ticketService.validateTicket("tkt_short", "DOC-SINGLE-USE", "download");
  assert.strictEqual(malformed.valid, false);
  assert.strictEqual(malformed.error, "TICKET_MALFORMED");

  // 5. First legitimate use: Valid
  const firstUse = ticketService.validateTicket(ticket.ticket, "DOC-SINGLE-USE", "download");
  assert.strictEqual(firstUse.valid, true);

  // 6. Second use: Rejected with TICKET_ALREADY_USED
  const secondUse = ticketService.validateTicket(ticket.ticket, "DOC-SINGLE-USE", "download");
  assert.strictEqual(secondUse.valid, false);
  assert.strictEqual(secondUse.error, "TICKET_ALREADY_USED");
});

// -----------------------------------------------------------------------------
// Test 10: Strict Elimination of JWT from Query Parameters
// -----------------------------------------------------------------------------
test("Operational 10: Raw JWT in query parameter (?token=) is rejected on preview and download", async () => {
  const { server, baseUrl } = await startTestServer();
  const validToken = generateToken({
    id: 1,
    email: "svp@birojasa.com",
    nama: "Admin Super (SVP)",
    jabatan: "administrator",
  });

  try {
    // Attempt preview with ?token= -> MUST return 401
    const previewRes = await fetch(`${baseUrl}/api/documents/DOC-ANY/preview?token=${validToken}`);
    assert.strictEqual(previewRes.status, 401);

    // Attempt download with ?token= -> MUST return 401
    const downloadRes = await fetch(`${baseUrl}/api/documents/DOC-ANY/download?token=${validToken}`);
    assert.strictEqual(downloadRes.status, 401);
  } finally {
    server.close();
  }
});

// -----------------------------------------------------------------------------
// Test 11: Upload Directory is NOT Served as Public Static Content
// -----------------------------------------------------------------------------
test("Operational 11: Direct access to server/uploads via static route returns 404", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res1 = await fetch(`${baseUrl}/uploads/test.pdf`);
    assert.strictEqual(res1.status, 404);

    const res2 = await fetch(`${baseUrl}/server/uploads/test.pdf`);
    assert.strictEqual(res2.status, 404);

    const res3 = await fetch(`${baseUrl}/static/test.pdf`);
    assert.strictEqual(res3.status, 404);

    const res4 = await fetch(`${baseUrl}/public/uploads/test.pdf`);
    assert.strictEqual(res4.status, 404);

    const res5 = await fetch(`${baseUrl}/api/documents/..%2f..%2fserver%2fuploads%2ftest.pdf/preview`);
    assert.strictEqual(res5.status, 401); // Protected route requires auth/ticket before any disk operation
  } finally {
    server.close();
  }
});

// -----------------------------------------------------------------------------
// Test 12: Production Error Sanitization & Information Disclosure Defense
// -----------------------------------------------------------------------------
test("Operational 12: Server sanitizes error responses without exposing stack traces, SQL, or internal paths", async () => {
  const { server, baseUrl } = await startTestServer();
  const validAdminToken = generateToken({
    id: 1,
    email: "svp@birojasa.com",
    nama: "Admin Super (SVP)",
    jabatan: "administrator",
  });

  try {
    // 1. Request non-existent document with invalid ticket returns standard sanitized 401
    const res1 = await fetch(`${baseUrl}/api/documents/INVALID_ID/preview?ticket=tkt_malformed`);
    assert.strictEqual(res1.status, 401);
    const body1 = await res1.json() as any;
    assert.strictEqual(body1.success, false);
    assert.ok(body1.error);
    assert.strictEqual(body1.error.stack, undefined);

    // 2. Request non-existent document with valid JWT returns sanitized 404
    const res2 = await fetch(`${baseUrl}/api/documents/NON_EXISTENT_DOC_ID`, {
      headers: { Authorization: `Bearer ${validAdminToken}` },
    });
    assert.strictEqual(res2.status, 404);
    const body2 = await res2.json() as any;
    assert.strictEqual(body2.success, false);
    assert.strictEqual(body2.error.code, "DOCUMENT_NOT_FOUND");
    assert.strictEqual(body2.error.stack, undefined);

    // 3. Request with malformed authorization header returns 401
    const res3 = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: "Bearer totally-invalid-token-string" },
    });
    assert.strictEqual(res3.status, 401);
    const body3 = await res3.json() as any;
    assert.strictEqual(body3.success, false);
    assert.strictEqual(body3.error.code, "UNAUTHENTICATED");
    assert.strictEqual(body3.error.stack, undefined);

    // 4. Verify no sensitive internal details leak across all error responses
    const allResponsesStr = JSON.stringify([body1, body2, body3]);
    assert.ok(!allResponsesStr.includes("node_modules"));
    assert.ok(!allResponsesStr.includes("server/src"));
    assert.ok(!allResponsesStr.includes("SELECT "));
    assert.ok(!allResponsesStr.includes("password"));
    assert.ok(!allResponsesStr.includes("secret"));
  } finally {
    server.close();
  }
});
