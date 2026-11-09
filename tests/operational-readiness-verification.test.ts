/**
 * Operational Readiness Verification Test Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies all 4 Operational Readiness Pillars:
 * 1. Schema Migration & Idempotency (Clean file_deletion_jobs, zero target PII)
 * 2. SQLite Backup Snapshot & Cold Archive Immutability
 * 3. Controlled UI Contracts (Master Data Karyawan & Manajemen Pengguna)
 * 4. API Security Hardening (Admin RBAC, Self-Deletion, Last Admin, JWT Revocation, Retry)
 */

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/src/app";
import { CONFIG } from "../server/src/config/env";
import { getDb, closeDb } from "../server/src/database/db";
import { initializeSchema, migrateFileDeletionJobsTable } from "../server/src/database/schema";
import { permanentErasureService } from "../server/src/services/permanentErasureService";
import { backupDatabase } from "../server/src/utils/backupRestore";
import { generateToken } from "../server/src/utils/crypto";

const testDbFile = path.resolve(os.tmpdir(), `test-readiness-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`);

let testDb: DatabaseSync;
let server: http.Server;
let baseUrl: string;

function createTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = createApp();
    const s = http.createServer(app);
    s.listen(0, () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server: s, baseUrl: `http://localhost:${port}` });
    });
  });
}

function getAdminToken(id = "1", name = "Super Admin"): string {
  return generateToken({
    userId: id,
    email: "admin@birojasa.com",
    nama: name,
    jabatan: "SVP",
    role: "administrator",
    employeeId: "EMP-0001",
  });
}

function getNonAdminToken(role = "messenger"): string {
  return generateToken({
    userId: "4",
    email: "budi.santoso@sunbirojasa.com",
    nama: "Budi Santoso",
    jabatan: "MESSENGER",
    role: role,
    employeeId: "EMP-0004",
  });
}

test.before(async () => {
  (CONFIG as any).DB_PATH = testDbFile;

  testDb = getDb({ targetPath: testDbFile });

  // Add dummy messenger employees so seedDatabase doesn't fail on FK
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      nik_ktp TEXT UNIQUE NOT NULL,
      nama_lengkap TEXT NOT NULL,
      no_hp TEXT NOT NULL,
      tgl_lahir TEXT NOT NULL,
      wilayah TEXT NOT NULL,
      alamat_domisili TEXT NOT NULL,
      jabatan TEXT NOT NULL,
      avatar_url TEXT,
      gaji_pokok REAL NOT NULL DEFAULT 0,
      status_karyawan TEXT NOT NULL DEFAULT 'TETAP',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan)
    VALUES ('EMP-0004', '3171000000000004', 'Messenger One', '081234567894', '1995-01-01', 'Jakarta Selatan', 'Jl. Selatan', 'MESSENGER'),
           ('EMP-0005', '3171000000000005', 'Messenger Two', '081234567895', '1995-02-02', 'Jakarta Timur', 'Jl. Timur', 'MESSENGER');
  `);

  initializeSchema(testDb);

  const serverInfo = await createTestServer();
  server = serverInfo.server;
  baseUrl = serverInfo.baseUrl;
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  closeDb();
  if (fs.existsSync(testDbFile)) {
    try { fs.unlinkSync(testDbFile); } catch {}
  }
});

// ============================================================================
// PILLAR 1: DEPLOYMENT & SCHEMA MIGRATION INTEGRITY
// ============================================================================

test("Readiness 1A: Schema Definition for file_deletion_jobs contains ZERO target identifiers", async () => {
  const tableCols = (testDb.prepare("PRAGMA table_info(file_deletion_jobs)").all() as any[]).map(c => c.name);
  assert.ok(!tableCols.includes("target_user_id"), "Must NOT contain target_user_id");
  assert.ok(!tableCols.includes("target_employee_id"), "Must NOT contain target_employee_id");
  assert.ok(tableCols.includes("id"), "Must contain id");
  assert.ok(tableCols.includes("file_path"), "Must contain file_path");
  assert.ok(tableCols.includes("category"), "Must contain category");
  assert.ok(tableCols.includes("status"), "Must contain status");
  assert.ok(tableCols.includes("retry_count"), "Must contain retry_count");
  assert.ok(tableCols.includes("max_retries"), "Must contain max_retries");
  assert.ok(tableCols.includes("last_error"), "Must contain last_error");

  const indexes = (testDb.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='file_deletion_jobs'").all() as any[]).map(i => i.name);
  assert.ok(!indexes.includes("idx_file_del_target"), "Index idx_file_del_target MUST NOT exist");
  assert.ok(indexes.includes("idx_file_del_status"), "Index idx_file_del_status MUST exist");
});

test("Readiness 1B: Migration Idempotency on repeated server startup", async () => {
  // Execute migration twice more
  migrateFileDeletionJobsTable(testDb);
  migrateFileDeletionJobsTable(testDb);

  const fkCheck = testDb.prepare("PRAGMA foreign_key_check").all() as any[];
  assert.strictEqual(fkCheck.length, 0, "Repeated migration must have 0 FK violations");

  const tableCols = (testDb.prepare("PRAGMA table_info(file_deletion_jobs)").all() as any[]).map(c => c.name);
  assert.ok(!tableCols.includes("target_user_id"));
});

// ============================================================================
// PILLAR 2: BACKUP, SNAPSHOT & RETENTION POLICIES
// ============================================================================

test("Readiness 2A: Atomic SQLite Backup Snapshot via VACUUM INTO", async () => {
  const backupTempFile = path.resolve(os.tmpdir(), `test-backup-${Date.now()}.sqlite`);
  
  try {
    const backupResult = backupDatabase(backupTempFile);
    assert.strictEqual(fs.existsSync(backupTempFile), true, "Backup file must exist on disk");
    assert.ok(backupResult.sizeBytes > 0, "Backup file size must be > 0 bytes");

    // Verify backup integrity with independent read-only SQLite connection
    const backupDb = new DatabaseSync(backupTempFile, { readOnly: true });
    const check = backupDb.prepare("PRAGMA integrity_check").get() as any;
    assert.strictEqual(check.integrity_check, "ok", "Backup snapshot must pass PRAGMA integrity_check");
    backupDb.close();
  } finally {
    if (fs.existsSync(backupTempFile)) {
      try { fs.unlinkSync(backupTempFile); } catch {}
    }
  }
});

test("Readiness 2B: Cold Backup Archive Immutability (Active erasure does not alter historical backups)", async () => {
  // 1. Create a user
  const empId = "EMP-SNAP-TEST";
  const userId = 301;
  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${empId}', '3171000099991111', 'Snapshot User', '081299991111', '1992-05-05', 'Jakarta', 'Jl. Snapshot', 'STAFF', 'TETAP');
    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${userId}, 'Snapshot User', 'snapshot.user@birojasa.com', 'h', 's', 'STAFF', 'Aktif', '${empId}');
  `);

  // 2. Take a cold backup
  const snapshotFile = path.resolve(os.tmpdir(), `test-snapshot-immutable-${Date.now()}.sqlite`);
  try {
    backupDatabase(snapshotFile);

    // 3. Perform permanent erasure on active database
    const erasureResult = permanentErasureService.executeErasure(userId, "HAPUS PERMANEN", null, "Snapshot test", testDb);
    assert.strictEqual(erasureResult.success, true);

    // Active DB: user is gone
    const activeRow = testDb.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    assert.strictEqual(activeRow, undefined, "Target must be deleted in active DB");

    // Cold backup snapshot: user is still present (proving backup immutability)
    const snapDb = new DatabaseSync(snapshotFile, { readOnly: true });
    const snapRow = snapDb.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    assert.ok(snapRow, "User still exists in historical cold backup snapshot");
    assert.strictEqual(snapRow.email, "snapshot.user@birojasa.com");
    snapDb.close();
  } finally {
    if (fs.existsSync(snapshotFile)) {
      try { fs.unlinkSync(snapshotFile); } catch {}
    }
  }
});

// ============================================================================
// PILLAR 3: CONTROLLED UI CONTRACTS
// ============================================================================

test("Readiness 3A: MasterDataContent.tsx integrates PermanentErasureDialog with live preflight & confirmation", async () => {
  const fileContent = fs.readFileSync(path.resolve("src/app/components/MasterDataContent.tsx"), "utf8");
  assert.ok(fileContent.includes("import { PermanentErasureDialog } from \"./PermanentErasureDialog\";"));
  assert.ok(fileContent.includes("<PermanentErasureDialog"));
  assert.ok(fileContent.includes("open={isDeleteKaryawanOpen}"));
  assert.ok(fileContent.includes("onErasureSuccess="));
});

test("Readiness 3B: ManajemenPengguna.tsx integrates PermanentErasureDialog with Admin authorization gating", async () => {
  const fileContent = fs.readFileSync(path.resolve("src/app/components/ManajemenPengguna.tsx"), "utf8");
  assert.ok(fileContent.includes("import { PermanentErasureDialog } from \"./PermanentErasureDialog\";"));
  assert.ok(fileContent.includes("isAdministrator"));
  assert.ok(fileContent.includes("handleOpenErasureDialog"));
  assert.ok(fileContent.includes("<PermanentErasureDialog"));
  assert.ok(fileContent.includes("open={isErasureDialogOpen}"));
  assert.ok(fileContent.includes("onErasureSuccess="));
});

test("Readiness 3C: PermanentErasureDialog requires exact 'HAPUS PERMANEN' and displays COMPLETED vs DATABASE_COMPLETED", async () => {
  const fileContent = fs.readFileSync(path.resolve("src/app/components/PermanentErasureDialog.tsx"), "utf8");
  assert.ok(fileContent.includes("confirmationInput.trim() !== \"HAPUS PERMANEN\""));
  assert.ok(fileContent.includes("COMPLETED"));
  assert.ok(fileContent.includes("DATABASE_COMPLETED"));
  assert.ok(fileContent.includes("fileCleanupPending"));
  assert.ok(fileContent.includes("financialTransactionsPreserved"));
});

// ============================================================================
// PILLAR 4: API & SECURITY HARDENING
// ============================================================================

test("Readiness 4A: RBAC Protection: Non-admin roles and unauthenticated callers are rejected", async () => {
  // 1. Unauthenticated request -> 401
  const resUnauth = await fetch(`${baseUrl}/api/users/2/permanent-erasure-preflight`);
  assert.strictEqual(resUnauth.status, 401, "Unauthenticated request must return 401");

  // 2. Messenger / Non-admin role -> 403 Forbidden
  const courierToken = getNonAdminToken("messenger");
  const resCourier = await fetch(`${baseUrl}/api/users/2/permanent-erasure-preflight`, {
    headers: { Authorization: `Bearer ${courierToken}` },
  });
  assert.strictEqual(resCourier.status, 403, "Non-admin role must return 403 Forbidden");

  const resCourierPost = await fetch(`${baseUrl}/api/users/2/permanent-erasure`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierToken}`,
    },
    body: JSON.stringify({ confirmationText: "HAPUS PERMANEN" }),
  });
  assert.strictEqual(resCourierPost.status, 403, "Execution by non-admin must return 403 Forbidden");
});

test("Readiness 4B: Self-Deletion Protection blocks Administrator from erasing own account", async () => {
  const adminToken = getAdminToken("1", "Super Admin");
  const res = await fetch(`${baseUrl}/api/users/1/permanent-erasure`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ confirmationText: "HAPUS PERMANEN" }),
  });

  assert.strictEqual(res.status, 422);
  const body = await res.json();
  assert.ok(body.error?.details?.blockers.some((b: any) => b.code === "SELF_DELETION_PROHIBITED"));
});

test("Readiness 4C: Last Administrator Protection blocks erasure when only 1 active admin remains", async () => {
  // Ensure only user 1 is active admin
  testDb.prepare("UPDATE users SET status = 'Nonaktif' WHERE id = 2").run();

  const adminToken = getAdminToken("1", "Super Admin");
  const res = await fetch(`${baseUrl}/api/users/1/permanent-erasure`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ confirmationText: "HAPUS PERMANEN" }),
  });

  assert.strictEqual(res.status, 422);
  const body = await res.json();
  assert.ok(
    body.error?.details?.blockers.some(
      (b: any) => b.code === "SELF_DELETION_PROHIBITED" || b.code === "LAST_ADMINISTRATOR_PROTECTION"
    )
  );

  // Also test direct service call with null executor (not self-deletion)
  const directCheck = permanentErasureService.preflightCheck(1, null, testDb);
  assert.strictEqual(directCheck.allowed, false);
  assert.ok(directCheck.blockers.some(b => b.code === "LAST_ADMINISTRATOR_PROTECTION"));

  // Restore user 2
  testDb.prepare("UPDATE users SET status = 'Aktif' WHERE id = 2").run();
});

test("Readiness 4D: Real-time Revocation: Deleted User's JWT is immediately rejected with 401 REVOKED_IDENTITY", async () => {
  const empId = "EMP-JWT-READY";
  const userId = 302;
  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${empId}', '3171000088882222', 'JWT User', '081288882222', '1993-03-03', 'Jakarta', 'Jl. JWT', 'ADMIN', 'TETAP');
    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${userId}, 'JWT User', 'jwt.ready@birojasa.com', 'h', 's', 'ADMIN', 'Aktif', '${empId}');
  `);

  const userToken = generateToken({
    userId: String(userId),
    email: "jwt.ready@birojasa.com",
    nama: "JWT User",
    jabatan: "ADMIN",
    role: "admin",
    employeeId: empId,
  });

  // Verify token works initially
  const resBefore = await fetch(`${baseUrl}/api/users/${userId}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  assert.strictEqual(resBefore.status, 200, "Token valid prior to erasure");

  // Perform permanent erasure
  permanentErasureService.executeErasure(userId, "HAPUS PERMANEN", null, "Revocation test", testDb);

  // Immediately query with exact same token
  const resAfter = await fetch(`${baseUrl}/api/users/${userId}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  assert.strictEqual(resAfter.status, 401, "Token must be rejected immediately after erasure");
  const bodyAfter = await resAfter.json();
  assert.strictEqual(bodyAfter.error?.code, "REVOKED_IDENTITY");
});

test("Readiness 4E: Security Event Audit Log and Deletion Jobs contain ZERO target PII", async () => {
  const empId = "EMP-PII-ZERO";
  const userId = 303;
  const userEmail = "pii.zero@birojasa.com";
  const userName = "PII Zero Target";

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${empId}', '3171000077773333', '${userName}', '081277773333', '1994-04-04', 'Jakarta', 'Jl. PII', 'ADMIN', 'TETAP');
    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${userId}, '${userName}', '${userEmail}', 'h', 's', 'ADMIN', 'Aktif', '${empId}');
  `);

  const executor = { userId: "1", nama: "Admin Exec", role: "administrator" };
  const result = permanentErasureService.executeErasure(userId, "HAPUS PERMANEN", executor, "Zero PII Audit Verification", testDb);
  assert.strictEqual(result.success, true);

  // Inspect security audit log
  const auditLogs = testDb.prepare("SELECT * FROM audit_logs WHERE action = 'PERMANENT_ERASURE_EXECUTED' ORDER BY created_at DESC").all() as any[];
  assert.ok(auditLogs.length > 0, "Must record security event");
  const latestLog = auditLogs[0];

  assert.ok(!latestLog.details.includes(empId), "Details must NOT contain employee ID");
  assert.ok(!latestLog.details.includes(userEmail), "Details must NOT contain user email");
  assert.ok(!latestLog.details.includes(userName), "Details must NOT contain user name");
  assert.ok(!latestLog.details.includes(String(userId)), "Details must NOT contain user numeric ID");

  const meta = JSON.parse(latestLog.metadata_json);
  assert.strictEqual(meta.targetUserId, undefined);
  assert.strictEqual(meta.targetEmployeeId, undefined);
  assert.strictEqual(meta.targetName, undefined);
  assert.strictEqual(meta.targetEmail, undefined);

  // Inspect file_deletion_jobs
  const jobs = testDb.prepare("SELECT * FROM file_deletion_jobs").all() as any[];
  for (const j of jobs) {
    assert.strictEqual(j.target_user_id, undefined, "Job must not have target_user_id");
    assert.strictEqual(j.employee_id, undefined, "Job must not have employee_id");
    assert.strictEqual(j.email, undefined, "Job must not have email");
    assert.strictEqual(j.name, undefined, "Job must not have name");
  }
});
