/**
 * Backend & ERD Consolidation Integration Test
 * Phase 2 — Database Migration & Backend Refactoring
 * SUNBiroJasa / Admin SUN89
 * 
 * Verifies:
 * 1. Database schema migration & idempotency (zero FK violations).
 * 2. Elimination of `employee_accounts` table.
 * 3. `employees` table as single source of truth for employment and personal data.
 * 4. `users` table as single source of truth for credentials and roles.
 * 5. Full reconciliation and preservation of operational data (Messengers, Orders, Kas, Audit).
 * 6. Employee CRUD and ID generator.
 * 7. User CRUD and seamless JOIN behavior.
 * 8. Authentication and canonical TokenPayload generation.
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "../server/src/database/db";
import { initializeSchema } from "../server/src/database/schema";
import { employeeService } from "../server/src/services/employeeService";
import { userService } from "../server/src/services/userService";
import { authService } from "../server/src/services/authService";
import { dbEmployeeRepository } from "../server/src/repositories/dbEmployeeRepository";
import { dbUserRepository } from "../server/src/repositories/dbUserRepository";

describe("Phase 2: Database Migration & Backend Refactoring Integration Tests", () => {
  before(() => {
    // Run schema initialization and migration
    initializeSchema(db);
  });

  test("1. Migration Idempotency & Zero Foreign Key Violations", () => {
    // Run migration again to prove idempotency
    initializeSchema(db);

    const fkCheckStmt = db.prepare("PRAGMA foreign_key_check");
    const violations = fkCheckStmt.all();
    assert.deepEqual(violations, [], "PRAGMA foreign_key_check must return 0 violations after migration");
  });

  test("2. Table `employee_accounts` is completely eliminated", () => {
    const tableStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_accounts'");
    const row = tableStmt.get();
    assert.equal(row, undefined, "Table `employee_accounts` must NOT exist in database");
  });

  test("3. Table `users` schema is normalized and has canonical columns", () => {
    const columnsStmt = db.prepare("PRAGMA table_info(users)");
    const cols = (columnsStmt.all() as { name: string }[]).map((c) => c.name);

    // Must have canonical columns
    assert.ok(cols.includes("id"), "users must have id");
    assert.ok(cols.includes("employee_id"), "users must have employee_id");
    assert.ok(cols.includes("email"), "users must have email");
    assert.ok(cols.includes("password_hash"), "users must have password_hash");
    assert.ok(cols.includes("password_salt"), "users must have password_salt");
    assert.ok(cols.includes("nama"), "users must have nama");
    assert.ok(cols.includes("jabatan"), "users must have jabatan");
    assert.ok(cols.includes("role"), "users must have role");
    assert.ok(cols.includes("status"), "users must have status");
    assert.ok(cols.includes("avatar_url"), "users must have avatar_url");
    assert.ok(cols.includes("last_login_at"), "users must have last_login_at");

    // Must NOT have redundant personal columns
    assert.ok(!cols.includes("phone"), "users must NOT have redundant column phone");
    assert.ok(!cols.includes("wilayah"), "users must NOT have redundant column wilayah");
    assert.ok(!cols.includes("alamat"), "users must NOT have redundant column alamat");
    assert.ok(!cols.includes("tanggal_lahir"), "users must NOT have redundant column tanggal_lahir");
    assert.ok(!cols.includes("gaji_pokok"), "users must NOT have redundant column gaji_pokok");
    assert.ok(!cols.includes("tanggal_bergabung"), "users must NOT have redundant column tanggal_bergabung");
    assert.ok(!cols.includes("jenis_kelamin"), "users must NOT have redundant column jenis_kelamin");
  });

  test("4. Table `employees` schema is canonical and holds employment attributes", () => {
    const columnsStmt = db.prepare("PRAGMA table_info(employees)");
    const cols = (columnsStmt.all() as { name: string }[]).map((c) => c.name);

    assert.ok(cols.includes("id"), "employees must have id");
    assert.ok(cols.includes("nik_ktp"), "employees must have nik_ktp");
    assert.ok(cols.includes("nama_lengkap"), "employees must have nama_lengkap");
    assert.ok(cols.includes("no_hp"), "employees must have no_hp");
    assert.ok(cols.includes("tgl_lahir"), "employees must have tgl_lahir");
    assert.ok(cols.includes("wilayah"), "employees must have wilayah");
    assert.ok(cols.includes("alamat_domisili"), "employees must have alamat_domisili");
    assert.ok(cols.includes("jabatan"), "employees must have jabatan");
    assert.ok(cols.includes("avatar_url"), "employees must have avatar_url");
    assert.ok(cols.includes("gaji_pokok"), "employees must have gaji_pokok");
    assert.ok(cols.includes("status_karyawan"), "employees must have status_karyawan");
    assert.ok(cols.includes("tanggal_bergabung"), "employees must have tanggal_bergabung");
    assert.ok(cols.includes("jenis_kelamin"), "employees must have jenis_kelamin");
  });

  test("5. Baseline Data Reconciliation & Preservation", () => {
    const users = dbUserRepository.getAll();
    assert.ok(users.length >= 6, `Expected at least 6 users in baseline DB, found ${users.length}`);

    // Check user 1 (SVP)
    const svp = users.find((u) => u.email === "svp@birojasa.com");
    assert.ok(svp, "SVP user must exist");
    assert.equal(svp.employeeId, "EMP-0001", "SVP employeeId must be EMP-0001");
    assert.ok(svp.role === "administrator" || svp.role === "svp", "SVP role must be administrator or svp");

    // Check user 2 (Admin) - verify typo EMP-002 was corrected to EMP-0002
    const admin = users.find((u) => u.email === "admin@birojasa.com");
    assert.ok(admin, "Admin user must exist");
    assert.equal(admin.employeeId, "EMP-0002", "Admin employeeId must be canonical EMP-0002");

    // Check user 3 (Finance)
    const finance = users.find((u) => u.email === "finance@birojasa.com");
    assert.ok(finance, "Finance user must exist");
    assert.equal(finance.employeeId, "EMP-0003");

    // Check courier users (budi & andi)
    const budi = users.find((u) => u.email === "budi.messenger@birojasa.com");
    assert.ok(budi, "Budi messenger user must exist");
    assert.equal(budi.employeeId, "EMP-0004", "Budi employeeId must be canonical EMP-0004");

    const andi = users.find((u) => u.email === "andi.messenger@birojasa.com");
    assert.ok(andi, "Andi messenger user must exist");
    assert.equal(andi.employeeId, "EMP-0005", "Andi employeeId must be canonical EMP-0005");
  });

  test("6. Employee ID Generator", () => {
    const nextId = employeeService.generateNextId();
    assert.match(nextId, /^EMP-\d{4}$/, "Generated employee ID must match EMP-XXXX format");
    const num = parseInt(nextId.replace("EMP-", ""), 10);
    assert.ok(num >= 7, "Next ID must be at least EMP-0007 given baseline 6 employees");
  });

  test("7. Employee CRUD & Validation", () => {
    const testNik = "3175089999990001";
    // Clean up if left from previous run
    try {
      const existing = dbEmployeeRepository.getByNik(testNik);
      if (existing) dbEmployeeRepository.delete(existing.id);
    } catch {}

    // Validation 1: 16-digit NIK
    assert.throws(
      () => {
        employeeService.createEmployee({
          nik_ktp: "12345", // Invalid length
          nama_lengkap: "Test Karyawan",
        });
      },
      (err: any) => err.code === "INVALID_NIK",
      "Must reject invalid NIK"
    );

    // Validation 2: Negative salary
    assert.throws(
      () => {
        employeeService.createEmployee({
          nik_ktp: testNik,
          nama_lengkap: "Test Karyawan",
          gaji_pokok: -1000,
        });
      },
      (err: any) => err.code === "INVALID_SALARY",
      "Must reject negative salary"
    );

    // Successful Creation with Account Provisioning
    const created = employeeService.createEmployee({
      nik_ktp: testNik,
      nama_lengkap: "Karyawan Baru Teruji",
      jabatan: "Staff Administrasi",
      no_hp: "081299998888",
      tgl_lahir: "1995-12-25",
      wilayah: "Jakarta Selatan",
      alamat_domisili: "Jl. Tebet Raya No. 45",
      gaji_pokok: 5500000,
      jenis_kelamin: "Laki-laki",
      tanggal_bergabung: "2024-01-10",
      email: "karyawan.baru@birojasa.com",
      createAccount: true,
      role: "admin",
    });

    assert.ok(created.id.startsWith("EMP-"), "Created employee must have EMP- ID");
    assert.equal(created.nama_lengkap, "Karyawan Baru Teruji");
    assert.equal(created.gaji_pokok, 5500000);
    assert.equal(created.user_email, "karyawan.baru@birojasa.com");
    assert.equal(created.user_role, "admin");

    // Duplicate NIK Rejection
    assert.throws(
      () => {
        employeeService.createEmployee({
          nik_ktp: testNik,
          nama_lengkap: "Duplicate NIK Person",
        });
      },
      (err: any) => err.code === "NIK_ALREADY_EXISTS",
      "Must reject duplicate NIK"
    );

    // Update Employee
    const updated = employeeService.updateEmployee(created.id, {
      nama_lengkap: "Karyawan Baru Updated",
      gaji_pokok: 6000000,
    });
    assert.equal(updated.nama_lengkap, "Karyawan Baru Updated");
    assert.equal(updated.gaji_pokok, 6000000);

    // Verify linked user was updated as well
    const linkedUser = dbUserRepository.getById(created.user_id!);
    assert.ok(linkedUser);
    assert.equal(linkedUser.nama, "Karyawan Baru Updated");
  });

  test("8. User CRUD & Demographic JOIN Behavior", () => {
    // Verify that querying users joins employee demographic data seamlessly
    const svpUser = dbUserRepository.getByEmailWithCredentials("svp@birojasa.com");
    assert.ok(svpUser);
    const fullSvp = dbUserRepository.getById(svpUser.id);
    assert.ok(fullSvp);
    assert.equal(fullSvp.employeeId, "EMP-0001");
    assert.ok(fullSvp.phone, "Phone must be joined from employees");
    assert.ok(fullSvp.alamat, "Alamat must be joined from employees");
    assert.ok(fullSvp.tanggalLahir, "Tanggal lahir must be joined from employees");
    assert.ok(fullSvp.gajiPokok, "Gaji pokok must be joined from employees");

    // User without linked employee (employee_id is null) is allowed
    const standaloneEmail = "contractor@external.com";
    try {
      const existing = dbUserRepository.getByEmailWithCredentials(standaloneEmail);
      if (existing) dbUserRepository.deleteUser(existing.id);
    } catch {}

    const standaloneUser = dbUserRepository.createUser({
      email: standaloneEmail,
      password_hash: "hash",
      password_salt: "salt",
      nama: "External Contractor",
      jabatan: "External Consultant",
      role: "admin",
      status: "Aktif",
      employee_id: null,
    });

    assert.ok(standaloneUser.id);
    assert.equal(standaloneUser.employeeId, undefined);
    assert.equal(standaloneUser.employee_id, null);

    const fetchedStandalone = dbUserRepository.getById(standaloneUser.id);
    assert.ok(fetchedStandalone);
    assert.equal(fetchedStandalone.employeeId, undefined);
    assert.equal(fetchedStandalone.phone, undefined);
  });

  test("9. Authentication & TokenPayload Resolution", async () => {
    // Login as admin
    const adminLogin = await authService.login("admin@birojasa.com", "admin123");
    assert.ok(adminLogin.token);
    assert.equal(adminLogin.user.email, "admin@birojasa.com");
    assert.equal(adminLogin.user.employeeId, "EMP-0002");

    // Login as messenger (Budi)
    const budiLogin = await authService.login("budi.messenger@birojasa.com", "messenger123");
    assert.ok(budiLogin.token);
    assert.equal(budiLogin.user.role, "messenger");
    assert.equal(budiLogin.user.employeeId, "EMP-0004");

    // Verify last_login_at was updated on user
    const budiUser = dbUserRepository.getById(String(budiLogin.user.id).replace("usr-", ""));
    assert.ok(budiUser?.last_login_at || budiUser?.lastLogin, "last_login_at must be populated after login");
  });

  test("10. Courier Profile & Operational Link Preservation", () => {
    // Messengers must still reference employees directly
    const messengersStmt = db.prepare("SELECT * FROM messengers");
    const messengers = messengersStmt.all() as any[];
    assert.ok(messengers.length >= 2, "Expected at least 2 couriers in baseline DB");

    for (const msg of messengers) {
      assert.ok(msg.employee_id, "Messenger must have employee_id");
      const emp = db.prepare("SELECT id FROM employees WHERE id = ?").get(msg.employee_id) as any;
      assert.ok(emp, `Messenger employee_id '${msg.employee_id}' must exist in employees table`);
    }

    // Kas messenger must remain intact
    const kasRows = db.prepare("SELECT COUNT(*) as c FROM kas_messenger").get() as { c: number };
    assert.ok(kasRows.c >= 0, "kas_messenger queryable");

    // Orders must remain intact
    const orderRows = db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number };
    assert.ok(orderRows.c > 0, "Orders queryable and preserved");
  });

  test("11. Operational Blocker Checks & Foreign Key Safety", () => {
    // Attempting to delete an employee with active operational history throws blocker
    assert.throws(
      () => {
        // EMP-0004 is Budi who is courier
        employeeService.deleteEmployee("EMP-0004");
      },
      (err: any) => err.code === "ACTIVE_OPERATIONAL_BLOCKER",
      "Must prevent deletion of employee with active operational history"
    );

    // Test FK ON DELETE SET NULL on a disposable unblocked employee and user
    const dispNik = "3175089999990099";
    const dispEmp = dbEmployeeRepository.create({
      id: "EMP-9999",
      nik_ktp: dispNik,
      nama_lengkap: "Disposable Employee",
    });

    const dispUser = dbUserRepository.createUser({
      email: "disposable@birojasa.com",
      password_hash: "hash",
      password_salt: "salt",
      nama: "Disposable User",
      jabatan: "Staff",
      role: "admin",
      status: "Aktif",
      employee_id: dispEmp.id,
    });

    assert.equal(dispUser.employee_id, "EMP-9999");

    // Delete the disposable employee
    const delRes = dbEmployeeRepository.delete(dispEmp.id);
    assert.ok(delRes, "Employee deleted");

    // Verify linked user now has employee_id = NULL without foreign key error
    const updatedUser = db.prepare("SELECT id, employee_id FROM users WHERE id = ?").get(dispUser.id) as any;
    assert.ok(updatedUser);
    assert.equal(updatedUser.employee_id, null, "users.employee_id must become NULL via ON DELETE SET NULL");

    // Final PRAGMA foreign_key_check to verify zero FK violations across the entire DB
    const finalFkCheck = db.prepare("PRAGMA foreign_key_check").all();
    assert.deepEqual(finalFkCheck, [], "PRAGMA foreign_key_check must remain 0 after all operations");
  });
});
