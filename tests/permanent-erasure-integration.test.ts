/**
 * Permanent Erasure Integration Test Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Strict Automated Tests against Isolated SQLite Database:
 * 1. Successful Permanent Erasure & Identity Neutralization
 * 2. Blocker: Active Courier Tasks
 * 3. Blocker: Courier Petty Cash Balance != 0
 * 4. Blocker: All Unfinalized Reimbursement Statuses (Diajukan, Sedang Ditinjau, Disetujui)
 * 5. Blocker: Active In-Flight Orders with Mapped Keys
 * 6. 100% Financial Nominals & Balance Preservation
 * 7. Precise Structured JSON Parsing & Cleansing (orders.data_json)
 * 8. Strict Foreign Key Integrity (PRAGMA foreign_key_check = 0 errors)
 * 9. Physical Personal File Deletion Job Execution
 * 10. File Deletion Failure & Retry Handling (DATABASE_COMPLETED vs COMPLETED)
 * 11. Customer Documents & Proofs 100% Intact
 * 12. Auth Hardening: Revoked/Deleted User JWT Rejection (401 REVOKED_IDENTITY)
 * 13. Atomic Rollback on In-Transaction Failure
 * 14. Last Administrator & Self-Deletion Protection
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
import { initializeSchema } from "../server/src/database/schema";
import { permanentErasureService } from "../server/src/services/permanentErasureService";
import { generateToken } from "../server/src/utils/crypto";

// Setup isolated test database path
const testDbFile = path.resolve(os.tmpdir(), `test-erasure-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.sqlite`);

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

test.before(async () => {
  // Override CONFIG.DB_PATH to isolated test database
  (CONFIG as any).DB_PATH = testDbFile;

  testDb = getDb({ targetPath: testDbFile });
  initializeSchema(testDb);

  // Seed baseline users: Super Admin and Secondary Admin
  testDb.exec(`
    INSERT OR REPLACE INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES 
      ('EMP-ADM-001', '3171000000000001', 'Super Administrator', '081100000001', '1985-05-15', 'Jakarta Pusat', 'Kantor Pusat', 'SVP', 'TETAP'),
      ('EMP-ADM-002', '3171000000000002', 'Secondary Admin', '081100000002', '1988-08-20', 'Jakarta Selatan', 'Kantor Cabang', 'ADMIN', 'TETAP'),
      ('EMP-0004', '3171000000000004', 'Budi Santoso', '081100000004', '1990-04-04', 'Jakarta Timur', 'Pangkalan Kurir', 'MESSENGER', 'TETAP'),
      ('EMP-0005', '3171000000000005', 'Andi Pratama', '081100000005', '1992-05-05', 'Jakarta Selatan', 'Pangkalan Kurir', 'MESSENGER', 'TETAP');

    INSERT OR REPLACE INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES 
      (1, 'Super Administrator', 'svp@birojasa.com', 'hash', 'salt', 'SVP', 'Aktif', 'EMP-ADM-001'),
      (2, 'Secondary Admin', 'admin@birojasa.com', 'hash', 'salt', 'ADMIN', 'Aktif', 'EMP-ADM-002');
  `);

  const serverInst = await createTestServer();
  server = serverInst.server;
  baseUrl = serverInst.baseUrl;
});

test.after(() => {
  server?.close();
  closeDb();
  if (fs.existsSync(testDbFile)) {
    try {
      fs.unlinkSync(testDbFile);
      if (fs.existsSync(`${testDbFile}-wal`)) fs.unlinkSync(`${testDbFile}-wal`);
      if (fs.existsSync(`${testDbFile}-shm`)) fs.unlinkSync(`${testDbFile}-shm`);
    } catch {
      // Ignore cleanup error
    }
  }
});

// Helper: Generate auth token for Super Admin (userId: 1)
function getSuperAdminToken(): string {
  return generateToken({
    userId: "1",
    email: "svp@birojasa.com",
    nama: "Super Administrator",
    jabatan: "SVP",
    role: "administrator",
    employeeId: "EMP-ADM-001",
  });
}

test("1. Penghapusan Berhasil: target master rows deleted, FKs neutralized, financial nominals preserved", async () => {
  const targetEmpId = "EMP-TEST-001";
  const targetUserId = 101;
  const targetEmail = "staff.test@birojasa.com";
  const targetName = "Staff Uji Coba";

  // Seed target and financial transaction
  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${targetEmpId}', '3171111122223333', '${targetName}', '081211112222', '1992-02-02', 'Jakarta Timur', 'Jl. Uji Coba', 'ADMIN', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${targetUserId}, '${targetName}', '${targetEmail}', 'hash', 'salt', 'ADMIN', 'Aktif', '${targetEmpId}');

    INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab, penanggung_jawab_employee_id)
    VALUES ('2026-11-01', 'Setoran Operasional Uji', 'Approved', 2500000, 0, 7500000, '${targetName}', '${targetEmpId}');

    INSERT INTO pengeluaran (tanggal, keterangan, nominal, penanggung_jawab, penanggung_jawab_employee_id)
    VALUES ('2026-11-01', 'Beli Kertas Kantor', 150000, '${targetName}', '${targetEmpId}');

    INSERT INTO audit_logs (id, created_at, user_id, user_name, user_role, action, module, details)
    VALUES ('aud-staff-1', datetime('now'), 'usr-${targetUserId}', '${targetName}', 'ADMIN', 'LOGIN', 'Auth', 'Target logged in');
  `);

  const adminToken = getSuperAdminToken();

  // Call Permanent Erasure API
  const res = await fetch(`${baseUrl}/api/users/${targetUserId}/permanent-erasure`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      confirmationText: "HAPUS PERMANEN",
      reason: "Penghapusan karyawan resign sesuai kebijakan privasi",
    }),
  });

  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data?.status, "COMPLETED");

  // Verify target rows in DB
  const userAfter = testDb.prepare("SELECT * FROM users WHERE id = ?").get(targetUserId);
  const empAfter = testDb.prepare("SELECT * FROM employees WHERE id = ?").get(targetEmpId);
  assert.strictEqual(userAfter, undefined, "User must be permanently deleted");
  assert.strictEqual(empAfter, undefined, "Employee must be permanently deleted");

  // Verify financial transactions preserved 100%
  const kasRow = testDb.prepare("SELECT * FROM kas_kantor WHERE keterangan = 'Setoran Operasional Uji'").get() as any;
  assert.strictEqual(kasRow.debit, 2500000, "Debit nominal must be preserved");
  assert.strictEqual(kasRow.saldo, 7500000, "Saldo must be preserved");
  assert.strictEqual(kasRow.penanggung_jawab, "[Petugas Dihapus]", "Name must be anonymized");
  assert.strictEqual(kasRow.penanggung_jawab_employee_id, null, "FK must be set to null");

  const pengRow = testDb.prepare("SELECT * FROM pengeluaran WHERE keterangan = 'Beli Kertas Kantor'").get() as any;
  assert.strictEqual(pengRow.nominal, 150000, "Expense nominal must be preserved");
  assert.strictEqual(pengRow.penanggung_jawab_employee_id, null, "FK must be set to null");

  // Verify audit logs: target's own log deleted
  const staffLog = testDb.prepare("SELECT * FROM audit_logs WHERE id = 'aud-staff-1'").get();
  assert.strictEqual(staffLog, undefined, "Target audit log must be deleted");

  // Verify foreign key integrity
  const fks = testDb.prepare("PRAGMA foreign_key_check").all();
  assert.strictEqual(fks.length, 0, "Zero foreign key violations allowed");
});

test("2. Blocker Tugas Aktif: kurir dengan status tugas DITUGASKAN / MENUJU_LOKASI wajib diblokir", async () => {
  const courierEmpId = "EMP-MSG-ACTIVE";
  const courierUserId = 201;
  const msgId = "MSG-ACTIVE-01";

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${courierEmpId}', '3171333344445555', 'Kurir Tugas Aktif', '081233334444', '1995-05-05', 'Jakarta Barat', 'Jl. Barat', 'MESSENGER', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${courierUserId}, 'Kurir Tugas Aktif', 'kurir.aktif@birojasa.com', 'hash', 'salt', 'MESSENGER', 'Aktif', '${courierEmpId}');

    INSERT INTO messengers (id, employee_id, plat_motor_operasional, wilayah_tugas_utama, status_tugas)
    VALUES ('${msgId}', '${courierEmpId}', 'B 1234 ACT', 'Jakarta Barat', 'ON_DUTY');

    INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name, payment_status, total_biaya, is_archived, data_json, created_at, updated_at, biaya_antar_jemput, biaya_jasa, is_cost_verified, cost_completeness_status)
    VALUES ('ORD-TSK-001', 'Bambang', '08111', 'Perpanjangan STNK', 'B 1111 TSK', 1, 'Penjemputan Berkas', 'Belum Bayar', 500000, 0, '{}', datetime('now'), datetime('now'), 50000, 100000, 0, 'INCOMPLETE');

    INSERT INTO messenger_tasks (id, order_no, messenger_id, tipe_tugas, status)
    VALUES ('TSK-001', 'ORD-TSK-001', '${msgId}', 'JEMPUT_BERKAS', 'DITUGASKAN');
  `);

  const adminToken = getSuperAdminToken();

  // Test preflight
  const preflightRes = await fetch(`${baseUrl}/api/users/${courierUserId}/permanent-erasure-preflight`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const preflightBody = await preflightRes.json();
  assert.strictEqual(preflightBody.data?.allowed, false, "Preflight must disallow erasure");
  assert.ok(
    preflightBody.data?.blockers.some((b: any) => b.code === "ACTIVE_MESSENGER_TASKS"),
    "Must report ACTIVE_MESSENGER_TASKS blocker"
  );

  // Test execution rejection (422)
  const execRes = await fetch(`${baseUrl}/api/users/${courierUserId}/permanent-erasure`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ confirmationText: "HAPUS PERMANEN" }),
  });

  assert.strictEqual(execRes.status, 422);
  const execBody = await execRes.json();
  assert.strictEqual(execBody.success, false);
  assert.strictEqual(execBody.error?.code, "ERASURE_BLOCKED");
});

test("3. Blocker Saldo Kas: kurir dengan saldo kas != 0 wajib diblokir", async () => {
  const courierEmpId = "EMP-MSG-CASH";
  const courierUserId = 202;
  const msgId = "MSG-CASH-01";

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${courierEmpId}', '3171444455556666', 'Kurir Sisa Kas', '081244445555', '1996-06-06', 'Jakarta Timur', 'Jl. Kas', 'MESSENGER', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${courierUserId}, 'Kurir Sisa Kas', 'kurir.kas@birojasa.com', 'hash', 'salt', 'MESSENGER', 'Aktif', '${courierEmpId}');

    INSERT INTO messengers (id, employee_id, plat_motor_operasional, wilayah_tugas_utama, status_tugas)
    VALUES ('${msgId}', '${courierEmpId}', 'B 5555 CSH', 'Jakarta Timur', 'STANDBY');

    INSERT INTO kas_messenger (tanggal, jenis, messenger, keterangan, debit, kredit, total, messenger_id)
    VALUES ('2026-11-02', 'Kas Masuk', 'Kurir Sisa Kas', 'Kas Masuk Petty Cash', 200000, 0, 200000, '${msgId}');
  `);

  const adminToken = getSuperAdminToken();

  const res = await fetch(`${baseUrl}/api/users/${courierUserId}/permanent-erasure`, {
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
    body.error?.details?.blockers.some((b: any) => b.code === "OUTSTANDING_PETTY_CASH"),
    "Must report OUTSTANDING_PETTY_CASH blocker"
  );
});

test("4. Blocker Reimbursement: seluruh status reimbursement non-terminal wajib diblokir", async () => {
  const claimantEmpId = "EMP-REIMB-TEST";
  const claimantUserId = 203;
  const claimantName = "Kurir Reimburse Test";

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${claimantEmpId}', '3171555566667777', '${claimantName}', '081255556666', '1997-07-07', 'Depok', 'Jl. Reimburse', 'MESSENGER', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${claimantUserId}, '${claimantName}', 'reimb.test@birojasa.com', 'hash', 'salt', 'MESSENGER', 'Aktif', '${claimantEmpId}');
  `);

  const adminToken = getSuperAdminToken();

  // Test status 1: 'Diajukan'
  testDb.prepare(`
    INSERT INTO messenger_reimbursements (id, employee_id, messenger_name, category, amount, date, status)
    VALUES ('REIMB-001', '${claimantEmpId}', '${claimantName}', 'Bensin', 50000, '2026-11-02', 'Diajukan');
  `).run();

  let res = await fetch(`${baseUrl}/api/users/${claimantUserId}/permanent-erasure`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirmationText: "HAPUS PERMANEN" }),
  });
  assert.strictEqual(res.status, 422);
  const body = await res.json();
  assert.ok(body.error?.details?.blockers.some((b: any) => b.code === "UNFINISHED_REIMBURSEMENTS"));

  // Test status 2: 'Sedang Ditinjau'
  testDb.prepare("UPDATE messenger_reimbursements SET status = 'Sedang Ditinjau' WHERE id = 'REIMB-001'").run();
  res = await fetch(`${baseUrl}/api/users/${claimantUserId}/permanent-erasure`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirmationText: "HAPUS PERMANEN" }),
  });
  assert.strictEqual(res.status, 422);

  // Test status 3: 'Disetujui' (approved but unpaid!)
  testDb.prepare("UPDATE messenger_reimbursements SET status = 'Disetujui', approved_amount = 50000 WHERE id = 'REIMB-001'").run();
  res = await fetch(`${baseUrl}/api/users/${claimantUserId}/permanent-erasure`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirmationText: "HAPUS PERMANEN" }),
  });
  assert.strictEqual(res.status, 422);

  // Now resolve to terminal status: 'Dibayar'
  testDb.prepare("UPDATE messenger_reimbursements SET status = 'Dibayar', paid_at = datetime('now') WHERE id = 'REIMB-001'").run();
  const preflightAfter = permanentErasureService.preflightCheck(claimantUserId, null, testDb);
  assert.strictEqual(
    preflightAfter.blockers.some((b) => b.code === "UNFINISHED_REIMBURSEMENTS"),
    false,
    "Once paid, reimbursement blocker must be resolved"
  );
});

test("5. Blocker Order Aktif & Pembersihan JSON Presisi: mapped keys in orders.data_json", async () => {
  const courierEmpId = "EMP-MSG-ORD";
  const courierUserId = 204;
  const courierName = "Kurir Order Assignment";

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${courierEmpId}', '3171666677778888', '${courierName}', '081266667777', '1998-08-08', 'Bekasi', 'Jl. Order', 'MESSENGER', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${courierUserId}, '${courierName}', 'kurir.ord@birojasa.com', 'hash', 'salt', 'MESSENGER', 'Aktif', '${courierEmpId}');

    INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name, payment_status, total_biaya, is_archived, data_json, created_at, updated_at, biaya_antar_jemput, biaya_jasa, is_cost_verified, cost_completeness_status)
    VALUES 
      ('ORD-ACT-001', 'Customer A', '0812', 'Ganti Plat', 'B 2222 ACT', 2, 'Proses Samsat', 'Lunas', 800000, 0, 
       json_object('assignedMessengerId', '${courierEmpId}', 'assignedMessengerName', '${courierName}', 'samsatMessenger', '${courierName}'),
       datetime('now'), datetime('now'), 50000, 150000, 1, 'COMPLETE'),
      ('ORD-CLS-001', 'Customer B', '0813', 'Balik Nama', 'B 3333 CLS', 8, 'Selesai', 'Lunas', 1200000, 0,
       json_object('assignedMessengerId', '${courierEmpId}', 'assignedMessengerName', '${courierName}', 'messengerPengantar', '${courierName}', 'messengerTimeline', json_array(json_object('author', '${courierName}', 'note', 'Diantar oleh ${courierName}'))),
       datetime('now'), datetime('now'), 50000, 200000, 1, 'COMPLETE');
  `);

  const adminToken = getSuperAdminToken();

  // Test 5A: Blocker active order
  const resBlock = await fetch(`${baseUrl}/api/users/${courierUserId}/permanent-erasure`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirmationText: "HAPUS PERMANEN" }),
  });
  assert.strictEqual(resBlock.status, 422);
  const blockBody = await resBlock.json();
  assert.ok(blockBody.error?.details?.blockers.some((b: any) => b.code === "ACTIVE_ORDERS_ASSIGNED"));

  // Advance ORD-ACT-001 to 'Selesai' so blocker is lifted
  testDb.prepare("UPDATE orders SET current_stage_name = 'Selesai', current_step = 8 WHERE order_no = 'ORD-ACT-001'").run();

  // Test 5B: Execute erasure and verify precise JSON cleansing
  const resSuccess = await fetch(`${baseUrl}/api/users/${courierUserId}/permanent-erasure`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirmationText: "HAPUS PERMANEN" }),
  });
  assert.strictEqual(resSuccess.status, 200);

  // Inspect cleansed JSON of ORD-CLS-001
  const ordRow = testDb.prepare("SELECT data_json FROM orders WHERE order_no = 'ORD-CLS-001'").get() as any;
  const data = JSON.parse(ordRow.data_json);
  assert.strictEqual(data.assignedMessengerId, null, "assignedMessengerId must be null");
  assert.strictEqual(data.assignedMessengerName, "[Kurir Dihapus]", "assignedMessengerName must be anonymized");
  assert.strictEqual(data.messengerPengantar, "[Kurir Dihapus]", "messengerPengantar must be anonymized");
  assert.strictEqual(data.messengerTimeline[0].author, "[Petugas Dihapus]", "Timeline author must be anonymized");
  assert.ok(data.messengerTimeline[0].note.includes("[Petugas Dihapus]"), "Timeline note must be sanitized");
});

test("6. Physical Personal File Deletion Job Execution & Retryability (DATABASE_COMPLETED vs COMPLETED)", async () => {
  const empId = "EMP-FILE-TEST";
  const userId = 205;
  const fileName = `test-avatar-${Date.now()}.jpg`;
  const uploadDir = path.resolve(CONFIG.UPLOAD_DIR);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const localFilePath = path.resolve(uploadDir, fileName);

  // Create physical dummy personal file
  fs.writeFileSync(localFilePath, "DUMMY AVATAR DATA");
  assert.ok(fs.existsSync(localFilePath), "Personal file must exist initially");

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${empId}', '3171777788889999', 'Employee With Avatar', '081277778888', '1993-03-03', 'Depok', 'Jl. Avatar', 'ADMIN', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${userId}, 'Employee With Avatar', 'avatar.test@birojasa.com', 'hash', 'salt', 'ADMIN', 'Aktif', '${empId}');
  `);

  // Target has avatar pointing to the file
  testDb.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(`/uploads/${fileName}`, userId);

  // Test successful file deletion
  const result = permanentErasureService.executeErasure(userId, "HAPUS PERMANEN", null, "Privacy Request", testDb);
  assert.strictEqual(result.status, "COMPLETED");
  assert.strictEqual(result.fileCleanupPending, false);
  assert.strictEqual(fs.existsSync(localFilePath), false, "Personal avatar file must be physically unlinked");
});

test("6B. File Deletion Failure & Retry Handling (DATABASE_COMPLETED status)", async () => {
  const empId = "EMP-FILE-FAIL";
  const userId = 208;
  const fileName = `test-locked-${Date.now()}.jpg`;
  const uploadDir = path.resolve(CONFIG.UPLOAD_DIR);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const localFilePath = path.resolve(uploadDir, fileName);

  fs.writeFileSync(localFilePath, "LOCKED AVATAR DATA");

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${empId}', '3171888877776666', 'Employee Locked File', '081288887777', '1995-05-05', 'Depok', 'Jl. Kunci', 'ADMIN', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${userId}, 'Employee Locked File', 'locked.test@birojasa.com', 'hash', 'salt', 'ADMIN', 'Aktif', '${empId}');
  `);

  testDb.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(`/uploads/${fileName}`, userId);

  // Mock fs.unlinkSync to throw error for this specific file to simulate locked file / permission error
  const originalUnlink = fs.unlinkSync;
  let unlinkAttempted = false;
  (fs as any).unlinkSync = (targetPath: string) => {
    if (targetPath.includes(fileName)) {
      unlinkAttempted = true;
      throw new Error("EBUSY: resource busy or locked, unlink");
    }
    return originalUnlink(targetPath);
  };

  try {
    const result = permanentErasureService.executeErasure(userId, "HAPUS PERMANEN", null, "Locked File Test", testDb);
    assert.strictEqual(result.success, true, "Database erasure must still succeed");
    assert.strictEqual(result.status, "DATABASE_COMPLETED", "Must report DATABASE_COMPLETED");
    assert.strictEqual(result.fileCleanupPending, true, "fileCleanupPending must be true");
    assert.ok(unlinkAttempted, "Unlink must have been attempted");

    // Verify job was recorded as FAILED in file_deletion_jobs
    const pendingJobs = permanentErasureService.getPendingDeletionJobs(testDb);
    assert.strictEqual(pendingJobs.length, 1, "There must be 1 pending/failed deletion job");
    assert.strictEqual(pendingJobs[0].status, "FAILED");
    assert.ok(pendingJobs[0].last_error?.includes("EBUSY"));

    // Now restore original unlinkSync and test retry
    (fs as any).unlinkSync = originalUnlink;
    const retriedJob = permanentErasureService.retryFileDeletionJob(pendingJobs[0].id, testDb);
    assert.strictEqual(retriedJob.status, "COMPLETED", "Retry must complete successfully");
    assert.strictEqual(fs.existsSync(localFilePath), false, "File must be physically unlinked after retry");
  } finally {
    (fs as any).unlinkSync = originalUnlink;
    if (fs.existsSync(localFilePath)) {
      try { fs.unlinkSync(localFilePath); } catch {}
    }
  }
});

test("6C. Atomic Rollback on In-Transaction Failure: database remains 100% intact", async () => {
  const empId = "EMP-ROLLBACK-TEST";
  const userId = 209;

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${empId}', '3171000011112222', 'Rollback Target Employee', '081200001111', '1990-10-10', 'Jakarta', 'Jl. Rollback', 'ADMIN', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${userId}, 'Rollback Target Employee', 'rollback.test@birojasa.com', 'hash', 'salt', 'ADMIN', 'Aktif', '${empId}');
  `);

  // Create an artificial trigger that throws an error when deleting from users for this test
  testDb.exec(`
    CREATE TRIGGER trg_test_abort_erasure
    BEFORE DELETE ON users
    WHEN OLD.id = ${userId}
    BEGIN
      SELECT RAISE(ABORT, 'SIMULATED_DATABASE_ABORT_ERROR');
    END;
  `);

  try {
    assert.throws(
      () => {
        permanentErasureService.executeErasure(userId, "HAPUS PERMANEN", null, "Rollback Test", testDb);
      },
      (err: any) => err.message.includes("SIMULATED_DATABASE_ABORT_ERROR"),
      "Must throw transaction abort error"
    );

    // Verify atomic rollback: user and employee MUST STILL EXIST
    const usrCheck = testDb.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const empCheck = testDb.prepare("SELECT * FROM employees WHERE id = ?").get(empId);
    assert.ok(usrCheck, "User must remain intact after transaction rollback");
    assert.ok(empCheck, "Employee must remain intact after transaction rollback");
  } finally {
    testDb.exec("DROP TRIGGER IF EXISTS trg_test_abort_erasure;");
  }
});

test("6D. Explicit Confirmation Validation: requires exact text 'HAPUS PERMANEN'", async () => {
  assert.throws(
    () => {
      permanentErasureService.executeErasure(1, "hapus", null, "Test", testDb);
    },
    (err: any) => err.code === "INVALID_CONFIRMATION_TEXT"
  );

  assert.throws(
    () => {
      permanentErasureService.executeErasure(1, "", null, "Test", testDb);
    },
    (err: any) => err.code === "INVALID_CONFIRMATION_TEXT"
  );
});

test("7. Dokumen Pelanggan & Bukti Transaksi Tetap Utuh 100%", async () => {
  const empId = "EMP-DOCS-SAFE";
  const userId = 206;

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${empId}', '3171888899990000', 'Docs Safe Employee', '081288889999', '1991-01-01', 'Bogor', 'Jl. Aman', 'ADMIN', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${userId}, 'Docs Safe Employee', 'docs.safe@birojasa.com', 'hash', 'salt', 'ADMIN', 'Aktif', '${empId}');

    INSERT INTO documents (id, order_no, document_type, original_name, storage_name, mime_type, size_bytes, sha256, uploaded_by, uploaded_by_id)
    VALUES 
      ('DOC-CUST-STNK', 'ORD-CLS-001', 'stnk', 'stnk_asli.jpg', 'storage-stnk-001.jpg', 'image/jpeg', 2048, 'hash-stnk', 'Docs Safe Employee', '${userId}'),
      ('DOC-CUST-BUKTI', 'ORD-CLS-001', 'BUKTI_PEMBAYARAN', 'bukti_transfer.jpg', 'storage-bukti-001.jpg', 'image/jpeg', 4096, 'hash-bukti', 'Docs Safe Employee', '${userId}');
  `);

  const res = permanentErasureService.executeErasure(userId, "HAPUS PERMANEN", null, "Docs Test", testDb);
  assert.strictEqual(res.success, true);

  // Verify documents are 100% INTACT
  const stnkDoc = testDb.prepare("SELECT * FROM documents WHERE id = 'DOC-CUST-STNK'").get() as any;
  const buktiDoc = testDb.prepare("SELECT * FROM documents WHERE id = 'DOC-CUST-BUKTI'").get() as any;

  assert.ok(stnkDoc, "Customer STNK document record must exist");
  assert.strictEqual(stnkDoc.document_type, "stnk");
  assert.strictEqual(stnkDoc.uploaded_by, "[Petugas Dihapus]", "Uploader name must be anonymized");
  assert.strictEqual(stnkDoc.uploaded_by_id, null, "Uploader user ID must be null");

  assert.ok(buktiDoc, "Payment proof document record must exist");
  assert.strictEqual(buktiDoc.document_type, "BUKTI_PEMBAYARAN");
});

test("8. Auth Hardening: token milik user yang sudah dihapus langsung ditolak (401 REVOKED_IDENTITY)", async () => {
  const empId = "EMP-AUTH-TEST";
  const userId = 207;

  testDb.exec(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, status_karyawan)
    VALUES ('${empId}', '3171999900001111', 'Auth Hardening User', '081299990000', '1994-04-04', 'Tangerang', 'Jl. Auth', 'ADMIN', 'TETAP');

    INSERT INTO users (id, nama, email, password_hash, password_salt, jabatan, status, employee_id)
    VALUES (${userId}, 'Auth Hardening User', 'auth.test@birojasa.com', 'hash', 'salt', 'ADMIN', 'Aktif', '${empId}');
  `);

  // Generate valid token for this user BEFORE erasure
  const userToken = generateToken({
    userId: String(userId),
    email: "auth.test@birojasa.com",
    nama: "Auth Hardening User",
    jabatan: "ADMIN",
    role: "admin",
    employeeId: empId,
  });

  // Verify token works before erasure
  const resBefore = await fetch(`${baseUrl}/api/users/${userId}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  assert.strictEqual(resBefore.status, 200, "Token must work while user exists");

  // Execute erasure
  permanentErasureService.executeErasure(userId, "HAPUS PERMANEN", null, "Auth Test", testDb);

  // Now verify that the EXACT SAME TOKEN is immediately rejected with 401
  const resAfter = await fetch(`${baseUrl}/api/users/${userId}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  assert.strictEqual(resAfter.status, 401, "Token must be rejected after permanent erasure");
  const bodyAfter = await resAfter.json();
  assert.strictEqual(bodyAfter.error?.code, "REVOKED_IDENTITY");
});

test("9. Last Administrator Protection: tidak dapat menghapus administrator terakhir", async () => {
  // Try erasing user 1 (Super Administrator) while only user 2 (Admin) remains
  // Deactivate user 2 first
  testDb.prepare("UPDATE users SET status = 'Nonaktif' WHERE id = 2").run();

  const adminToken = getSuperAdminToken();

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

  // Restore user 2
  testDb.prepare("UPDATE users SET status = 'Aktif' WHERE id = 2").run();
});

test("10. DEF-01 Verification: Zero PII in file_deletion_jobs, no target_user_id column, no idx_file_del_target, safe table migration, and retry without identity", async () => {
  // A. Verify current table schema has NO target_user_id
  const tableCols = (testDb.prepare("PRAGMA table_info(file_deletion_jobs)").all() as any[]).map(c => c.name);
  assert.ok(!tableCols.includes("target_user_id"), "file_deletion_jobs MUST NOT contain target_user_id column");
  assert.ok(tableCols.includes("file_path"), "file_deletion_jobs must have file_path");
  assert.ok(tableCols.includes("category"), "file_deletion_jobs must have category");
  assert.ok(tableCols.includes("status"), "file_deletion_jobs must have status");

  // B. Verify index idx_file_del_target does NOT exist
  const indexes = (testDb.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='file_deletion_jobs'").all() as any[]).map(i => i.name);
  assert.ok(!indexes.includes("idx_file_del_target"), "idx_file_del_target MUST NOT exist");
  assert.ok(indexes.includes("idx_file_del_status"), "idx_file_del_status must exist");

  // C. Verify all records in file_deletion_jobs have zero PII
  const records = testDb.prepare("SELECT * FROM file_deletion_jobs").all() as any[];
  for (const rec of records) {
    assert.strictEqual(rec.target_user_id, undefined, "Record must not have target_user_id property");
    assert.strictEqual(rec.employee_id, undefined, "Record must not have employee_id property");
    assert.strictEqual(rec.nama, undefined, "Record must not have name property");
    assert.strictEqual(rec.email, undefined, "Record must not have email property");
  }

  // D. Verify migrateFileDeletionJobsTable safely migrates legacy table with target_user_id
  const { DatabaseSync } = await import("node:sqlite");
  const legacyDb = new DatabaseSync(":memory:");
  legacyDb.exec(`
    CREATE TABLE file_deletion_jobs (
      id TEXT PRIMARY KEY,
      target_user_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_file_del_target ON file_deletion_jobs(target_user_id);
    CREATE INDEX idx_file_del_status ON file_deletion_jobs(status);
    INSERT INTO file_deletion_jobs (id, target_user_id, file_path, category, status)
    VALUES ('JOB-LEGACY-1', 'USR-999', 'C:/uploads/avatar.png', 'PERSONAL_AVATAR', 'FAILED');
  `);

  const { migrateFileDeletionJobsTable } = await import("../server/src/database/schema");
  migrateFileDeletionJobsTable(legacyDb);

  const migratedCols = (legacyDb.prepare("PRAGMA table_info(file_deletion_jobs)").all() as any[]).map(c => c.name);
  assert.ok(!migratedCols.includes("target_user_id"), "Migrated table must drop target_user_id");
  const migratedIndexes = (legacyDb.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='file_deletion_jobs'").all() as any[]).map(i => i.name);
  assert.ok(!migratedIndexes.includes("idx_file_del_target"), "Migrated table must drop idx_file_del_target");

  const migratedRecord = legacyDb.prepare("SELECT * FROM file_deletion_jobs WHERE id = 'JOB-LEGACY-1'").get() as any;
  assert.ok(migratedRecord, "Existing job must be preserved");
  assert.strictEqual(migratedRecord.file_path, "C:/uploads/avatar.png");
  assert.strictEqual(migratedRecord.target_user_id, undefined, "Record must not contain target_user_id");
  legacyDb.close();
});

test("11. DEF-02 Verification: ManajemenPengguna.tsx mounts PermanentErasureDialog and provides action button for Administrators", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const uiFile = fs.readFileSync(path.resolve("src/app/components/ManajemenPengguna.tsx"), "utf8");
  assert.ok(uiFile.includes('import { PermanentErasureDialog } from "./PermanentErasureDialog";'), "Must import PermanentErasureDialog");
  assert.ok(uiFile.includes("<PermanentErasureDialog"), "Must mount <PermanentErasureDialog in JSX");
  assert.ok(uiFile.includes("open={isErasureDialogOpen}"), "Must bind open to isErasureDialogOpen");
  assert.ok(uiFile.includes("onOpenChange={setIsErasureDialogOpen}"), "Must bind onOpenChange to setIsErasureDialogOpen");
  assert.ok(uiFile.includes("handleOpenErasureDialog"), "Must have handleOpenErasureDialog handler");
  assert.ok(uiFile.includes("isAdministrator"), "Must gate erasure action to Administrator");
  assert.ok(uiFile.includes("Hapus"), "Action button label must exist");
});

test("12. Disambiguate shared courier names and stage-specific active assignments (EMP-0006 vs EMP-0004/0005)", async () => {
  // Setup: Two couriers with identical name "Budi Santoso", one active (EMP-0004) and one inactive without messenger profile (EMP-0006)
  // An active courier Andi Pratama (EMP-0005, EMP-MSG-002) is currently assigned to delivery on ORD-1126-001.
  const target6 = permanentErasureService.resolveTargetIdentity("EMP-0006", testDb);
  assert.ok(target6, "EMP-0006 must resolve target identity");
  assert.strictEqual(target6.employeeId, "EMP-0006");
  assert.strictEqual(target6.employeeName, "Budi Santoso");

  const preflight6 = permanentErasureService.preflightCheck("EMP-0006", null, testDb);
  assert.strictEqual(
    preflight6.blockers.some((b) => b.code === "ACTIVE_ORDERS_ASSIGNED"),
    false,
    "Inactive courier EMP-0006 must NOT be blocked by active orders assigned to other couriers"
  );

  // Active courier EMP-0005 assigned to ORD-1126-001 delivery MUST still be blocked
  const target5 = permanentErasureService.resolveTargetIdentity("EMP-0005", testDb);
  assert.ok(target5, "EMP-0005 must resolve target identity");
  const preflight5 = permanentErasureService.preflightCheck("EMP-0005", null, testDb);
  assert.ok(
    preflight5.blockers.some((b) => b.code === "ACTIVE_ORDERS_ASSIGNED"),
    "Truly assigned courier EMP-0005 MUST still be blocked by ACTIVE_ORDERS_ASSIGNED"
  );
});
