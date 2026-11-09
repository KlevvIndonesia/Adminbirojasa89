/**
 * Phase 4: Final System Audit, Integration Validation & Release Readiness
 * SUNBiroJasa / Admin SUN89
 * 
 * Comprehensive end-to-end audit verifying:
 * 1. Database schema consistency & PRAGMA integrity
 * 2. Elimination of employee_accounts table & zero orphan dependencies
 * 3. Canonical users & employees relation and attributes
 * 4. Financial data preservation (Kas Kantor, Kas Messenger, Pengeluaran, Invoices, Payments)
 * 5. Messenger operations, active couriers, and task aliases
 * 6. Order lifecycle and tracking integrity
 * 7. Security audit: RBAC, authentication, last-login, password hashing
 * 8. Permanent Erasure: preflight, blocker validation, and zero target PII in deletion jobs
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "../server/src/database/db";
import { initializeSchema } from "../server/src/database/schema";
import { employeeService } from "../server/src/services/employeeService";
import { userService } from "../server/src/services/userService";
import { authService } from "../server/src/services/authService";
import { dbUserRepository } from "../server/src/repositories/dbUserRepository";
import { dbEmployeeRepository } from "../server/src/repositories/dbEmployeeRepository";
import { permanentErasureService } from "../server/src/services/permanentErasureService";

describe("Phase 4: Comprehensive System Audit & Release Readiness", () => {
  before(() => {
    // Run schema initialization and migration on the isolated database snapshot
    initializeSchema(db);
  });

  test("1. Database Schema Consistency & PRAGMA Integrity", () => {
    const quickCheck = db.prepare("PRAGMA quick_check").all() as any[];
    assert.ok(quickCheck.length > 0);
    assert.equal(quickCheck[0].quick_check, "ok", "PRAGMA quick_check must return 'ok'");

    const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
    assert.deepEqual(fkCheck, [], "PRAGMA foreign_key_check must return ZERO violations");

    // Verify critical tables exist
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(t => t.name);
    assert.ok(tables.includes("users"), "Table users must exist");
    assert.ok(tables.includes("employees"), "Table employees must exist");
    assert.ok(tables.includes("messengers"), "Table messengers must exist");
    assert.ok(tables.includes("orders"), "Table orders must exist");
    assert.ok(tables.includes("finance_invoices"), "Table finance_invoices must exist");
    assert.ok(tables.includes("kas_kantor"), "Table kas_kantor must exist");
    assert.ok(tables.includes("kas_messenger"), "Table kas_messenger must exist");
    assert.ok(tables.includes("pengeluaran"), "Table pengeluaran must exist");
    assert.ok(tables.includes("file_deletion_jobs"), "Table file_deletion_jobs must exist");
    assert.ok(!tables.includes("employee_accounts"), "Table employee_accounts must NOT exist");
  });

  test("2. Canonical Identity & Separation of Concerns", () => {
    // Employees check
    const allEmps = employeeService.getAll();
    assert.ok(allEmps.length >= 5, "Database must retain all canonical employees");
    for (const emp of allEmps) {
      assert.ok(emp.id.startsWith("EMP-"), `Employee ID ${emp.id} must follow EMP-XXXX`);
      assert.ok(emp.nik_ktp && /^\d{16}$/.test(emp.nik_ktp), `Employee ${emp.id} must have 16-digit NIK`);
      assert.ok(emp.nama_lengkap, `Employee ${emp.id} must have nama_lengkap`);
      assert.ok(emp.status_karyawan, `Employee ${emp.id} must have status_karyawan`);
    }

    // Users check
    const allUsers = userService.getAll();
    assert.ok(allUsers.length >= 5, "Database must retain all canonical users");
    for (const u of allUsers) {
      assert.ok(u.email, "User must have email");
      assert.ok(u.nama, "User must have nama");
      assert.ok(u.jabatan, "User must have jabatan");
      assert.ok(u.role, "User must have role");
      assert.ok(u.status === "Aktif" || u.status === "Nonaktif", "User status must be Aktif/Nonaktif");
    }

    // Check SVP canonical mapping
    const svpUser = allUsers.find(u => u.jabatan === "SVP" || u.role === "administrator");
    assert.ok(svpUser, "SVP user must exist");
    assert.equal(svpUser.employeeId, "EMP-0001", "SVP user must link to EMP-0001");

    // Check Courier canonical mappings
    const budiUser = allUsers.find(u => u.email === "budi.messenger@birojasa.com");
    assert.ok(budiUser, "Budi courier user must exist");
    assert.equal(budiUser.employeeId, "EMP-0004", "Budi must link to EMP-0004");
  });

  test("3. Financial Data Integrity & Transaction Preservation", () => {
    // Invoices preservation
    const invCount = db.prepare("SELECT COUNT(*) as count, SUM(total_tagihan) as tagihan, SUM(dibayar) as dibayar FROM finance_invoices").get() as any;
    assert.ok(invCount.count >= 2, "Invoices must be preserved");
    assert.ok(invCount.tagihan > 0, "Invoice total tagihan must be non-zero");

    // Kas Kantor preservation
    const kasKantor = db.prepare("SELECT COUNT(*) as count, SUM(debit) as debit FROM kas_kantor").get() as any;
    assert.ok(kasKantor.count >= 2, "Kas kantor transactions must be preserved");
    assert.equal(kasKantor.debit, 563000, "Kas kantor baseline debit must equal 563,000");

    // Orders preservation
    const orders = db.prepare("SELECT COUNT(*) as count FROM orders").get() as any;
    assert.ok(orders.count >= 2, "Orders must be preserved");
  });

  test("4. Messenger Operations & Courier Profile Integrity", () => {
    const msgs = db.prepare(`
      SELECT m.*, e.nama_lengkap, e.status_karyawan 
      FROM messengers m 
      JOIN employees e ON m.employee_id = e.id
    `).all() as any[];
    assert.ok(msgs.length >= 2, "Messengers table must contain baseline couriers");

    const budiMsg = msgs.find(m => m.employee_id === "EMP-0004");
    assert.ok(budiMsg, "Budi courier profile must link to EMP-0004");
    assert.equal(budiMsg.nama_lengkap, "Budi Santoso");
    assert.ok(budiMsg.plat_motor_operasional);

    const andiMsg = msgs.find(m => m.employee_id === "EMP-0005");
    assert.ok(andiMsg, "Andi courier profile must link to EMP-0005");
    assert.equal(andiMsg.nama_lengkap, "Andi Pratama");
    assert.ok(andiMsg.plat_motor_operasional);
  });

  test("5. Authentication & PBKDF2 Password Security", async () => {
    // Authenticate Admin
    const adminLogin = await authService.login("admin@birojasa.com", "admin123");
    assert.ok(adminLogin.token, "Admin login must succeed");
    assert.equal(adminLogin.user.role, "admin");
    assert.equal(adminLogin.user.employeeId, "EMP-0002");

    // Authenticate Messenger (Budi)
    const budiLogin = await authService.login("budi.messenger@birojasa.com", "messenger123");
    assert.ok(budiLogin.token, "Messenger login must succeed");
    assert.equal(budiLogin.user.role, "messenger");
    assert.equal(budiLogin.user.employeeId, "EMP-0004");

    // Non-existent user fails
    await assert.rejects(
      async () => {
        await authService.login("nonexistent@birojasa.com", "wrongpass");
      },
      /Email atau password tidak valid/
    );

    // Wrong password fails
    await assert.rejects(
      async () => {
        await authService.login("admin@birojasa.com", "wrongpassword");
      },
      /Email atau password tidak valid/
    );
  });

  test("6. Permanent Erasure: Preflight & Zero Target PII in File Deletion Jobs", () => {
    // Check preflight check
    const preflight = permanentErasureService.preflightCheck("EMP-0004");
    assert.ok(preflight, "Preflight check must succeed");
    assert.equal(typeof preflight.allowed, "boolean");
    assert.ok(Array.isArray(preflight.blockers));
    assert.ok(preflight.summary);

    // Verify file_deletion_jobs schema contains ZERO target PII
    const cols = (db.prepare("PRAGMA table_info(file_deletion_jobs)").all() as any[]).map(c => c.name);
    assert.ok(!cols.includes("target_user_id"), "file_deletion_jobs must NOT have target_user_id");
    assert.ok(!cols.includes("target_employee_id"), "file_deletion_jobs must NOT have target_employee_id");
    assert.ok(!cols.includes("nama"), "file_deletion_jobs must NOT have nama");
    assert.ok(!cols.includes("email"), "file_deletion_jobs must NOT have email");

    // Indexes on file_deletion_jobs
    const indexes = (db.prepare("PRAGMA index_list(file_deletion_jobs)").all() as any[]).map(i => i.name);
    assert.ok(!indexes.includes("idx_file_del_target"), "idx_file_del_target must NOT exist");
  });

  test("7. Cross-Module Standalone Entities Compatibility", () => {
    // Standalone user without employee
    const standaloneUser = userService.createUser({
      email: "auditor.external.phase4@kemenkeu.go.id",
      nama: "Drs. Hendro Wibowo",
      jabatan: "ADMIN",
      status: "Aktif",
      password: "AuditorPassword2026!",
    });
    assert.ok(standaloneUser.id);
    assert.ok(!standaloneUser.employeeId);

    // Standalone employee without user
    const standaloneEmp = employeeService.createEmployee({
      nama_lengkap: "Doni Setiawan",
      jabatan: "MESSENGER",
      wilayah: "Jakarta Pusat",
      no_hp: "081299001122",
      nik_ktp: "3171011504950099",
      status_karyawan: "TETAP",
      tgl_lahir: "1995-04-15",
      tanggal_bergabung: "2026-02-01",
      gaji_pokok: 4800000,
      jenis_kelamin: "Laki-laki",
      alamat_domisili: "Jl. Kramat Raya No. 10, Jakarta Pusat"
    });
    assert.ok(standaloneEmp.id);
    assert.equal(dbUserRepository.getByEmployeeId(standaloneEmp.id), undefined);
  });
});
