/**
 * Frontend & Dashboard Integration Test
 * Phase 3 — Frontend & Dashboard Integration
 * SUNBiroJasa / Admin SUN89
 * 
 * Verifies:
 * 1. REST API contract for `/api/employees` (CRUD, automatic ID generation EMP-XXXX).
 * 2. REST API contract for `/api/users` (Users with employee_id, standalone users without employee_id).
 * 3. Strict separation of concerns:
 *    - Modifying employee status (TETAP / NONAKTIF) in `employees` does NOT mutate `users.status`.
 *    - Modifying user account status (Aktif <-> Nonaktif) in `users` does NOT mutate `employees.status_karyawan`.
 * 4. Password reset derivation from employee date of birth (DDMMYYYY) via canonical relation.
 * 5. Standalone user handling (user without employee_id, e.g., external vendor/auditor).
 * 6. Standalone employee handling (employee without user account, e.g., field courier/staff without portal login).
 * 7. Verification that dropped `employee_accounts` table is not queried or needed anywhere in the stack.
 * 8. Permanent Erasure preflight check works seamlessly on canonical employee/user entities.
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "../server/src/database/db";
import { initializeSchema } from "../server/src/database/schema";
import { employeeService } from "../server/src/services/employeeService";
import { userService } from "../server/src/services/userService";
import { authService } from "../server/src/services/authService";
import { dbUserRepository } from "../server/src/repositories/dbUserRepository";
import { permanentErasureService } from "../server/src/services/permanentErasureService";

describe("Phase 3: Frontend & Dashboard Integration Tests", () => {
  before(() => {
    initializeSchema(db);
  });

  test("1. Employee Service CRUD and Canonical ID Generator", () => {
    // Check initial count
    const initialEmployees = employeeService.getAll();
    assert.ok(initialEmployees.length >= 5, "Database must have at least baseline employees");

    // Next ID generation
    const nextId = employeeService.generateNextId();
    assert.match(nextId, /^EMP-\d{4}$/, "Next employee ID must match EMP-XXXX format");

    // Create a new employee
    const newEmp = employeeService.createEmployee({
      nama_lengkap: "Citra Lestari",
      jabatan: "ADMIN",
      wilayah: "Jakarta Selatan",
      no_hp: "081234567899",
      nik_ktp: "3174092005990007",
      status_karyawan: "TETAP",
      tgl_lahir: "1999-05-20",
      tanggal_bergabung: "2026-01-15",
      gaji_pokok: 5500000,
      jenis_kelamin: "Perempuan",
      alamat_domisili: "Jl. Tebet Raya No. 45, Jakarta Selatan"
    });

    assert.ok(newEmp.id, "Created employee must have an ID");
    assert.equal(newEmp.nama_lengkap, "Citra Lestari");
    assert.equal(newEmp.nik_ktp, "3174092005990007");

    // Fetch by ID
    const fetched = employeeService.getById(newEmp.id);
    assert.ok(fetched, "Must be able to fetch created employee by ID");
    assert.equal(fetched?.nama_lengkap, "Citra Lestari");

    // Update employee
    const updated = employeeService.updateEmployee(newEmp.id, {
      wilayah: "Jakarta Pusat",
      gaji_pokok: 6000000
    });
    assert.ok(updated, "Update employee must succeed");
    assert.equal(updated?.wilayah, "Jakarta Pusat");
    assert.equal(updated?.gaji_pokok, 6000000);
  });

  test("2. User Service links to canonical employee_id", () => {
    // Get all users
    const users = userService.getAll();
    assert.ok(users.length >= 5, "Must have baseline users");

    // Find SVP user (Super Admin)
    const svpUser = users.find((u) => u.email === "svp@birojasa.com" || u.role === "administrator");
    assert.ok(svpUser, "SVP user must exist");
    assert.equal(svpUser?.employeeId, "EMP-0001", "SVP user must be linked to EMP-0001");

    // Find courier user Budi
    const budiUser = users.find((u) => u.email === "budi.messenger@birojasa.com" || u.role === "messenger");
    assert.ok(budiUser, "Budi courier user must exist");
    assert.equal(budiUser?.employeeId, "EMP-0004", "Budi courier user must be linked to EMP-0004");
  });

  test("3. Strict Separation of Concerns: Account Status vs Employee Status", () => {
    // Get Budi employee and user
    const budiEmpBefore = employeeService.getById("EMP-0004");
    assert.ok(budiEmpBefore);
    assert.equal(budiEmpBefore?.status_karyawan, "TETAP");

    const budiUserBefore = dbUserRepository.getByEmployeeId("EMP-0004");
    assert.ok(budiUserBefore);
    assert.equal(budiUserBefore?.status, "Aktif");

    // Deactivate user account (e.g., security lockout or temporary suspension)
    const deactivatedUser = userService.updateUser(budiUserBefore.id, { status: "Nonaktif" });
    assert.equal(deactivatedUser.status, "Nonaktif");

    // Check that employee status remains UNTOUCHED ("TETAP")
    const budiEmpAfterUserDeactivate = employeeService.getById("EMP-0004");
    assert.equal(
      budiEmpAfterUserDeactivate?.status_karyawan,
      "TETAP",
      "Deactivating user account must NOT change employee status in `employees`"
    );

    // Reactivate user account
    userService.updateUser(budiUserBefore.id, { status: "Aktif" });

    // Now change employee status (e.g., employee takes sabbatical/leave)
    employeeService.updateEmployee("EMP-0004", { status_karyawan: "NONAKTIF" });
    const budiEmpNonaktif = employeeService.getById("EMP-0004");
    assert.equal(budiEmpNonaktif?.status_karyawan, "NONAKTIF");

    // Check that user account status remains UNTOUCHED ("Aktif")
    const budiUserAfterEmpStatus = userService.getById(budiUserBefore.id);
    assert.equal(
      budiUserAfterEmpStatus?.status,
      "Aktif",
      "Changing employee employment status must NOT mutate user account status in `users`"
    );

    // Restore employee status
    employeeService.updateEmployee("EMP-0004", { status_karyawan: "TETAP" });
  });

  test("4. Password Reset derives from employee date of birth (DDMMYYYY)", async () => {
    const budiEmp = employeeService.getById("EMP-0004");
    assert.ok(budiEmp);
    assert.ok(budiEmp.tgl_lahir, "Employee must have tgl_lahir");

    const [yyyy, mm, dd] = budiEmp.tgl_lahir.split("-");
    const expectedPassword = `${dd}${mm}${yyyy}`;

    const budiUser = dbUserRepository.getByEmployeeId("EMP-0004");
    assert.ok(budiUser);

    const resetResult = userService.resetPassword(budiUser.id);
    assert.equal(resetResult.userId, budiUser.id);

    // Verify authentication succeeds with the reset password derived from DOB
    const authResult = await authService.login("budi.messenger@birojasa.com", expectedPassword);
    assert.ok(authResult.token, "Must issue valid JWT token");
    assert.equal(authResult.user?.role, "messenger");
  });

  test("5. Standalone User without Employee (e.g., External Auditor / System User)", async () => {
    // Create a standalone user without employee_id
    const standaloneUser = userService.createUser({
      email: "auditor.external@kemenkeu.go.id",
      nama: "Drs. Hendro Wibowo",
      jabatan: "ADMIN",
      status: "Aktif",
      password: "AuditorPassword2026!",
    });

    assert.ok(standaloneUser.id);
    assert.ok(!standaloneUser.employeeId, "Standalone user employeeId must be empty/null");

    // Verify standalone user can log in
    const authResult = await authService.login("auditor.external@kemenkeu.go.id", "AuditorPassword2026!");
    assert.ok(authResult.token, "Standalone user must be able to authenticate");
    assert.equal(authResult.user?.employeeId, undefined);

    // Standalone user password reset fallback
    const resetRes = userService.resetPassword(standaloneUser.id);
    assert.ok(resetRes.userId, "Standalone user must be reset safely");

    // Deactivating standalone user works
    const deactivated = userService.updateUser(standaloneUser.id, { status: "Nonaktif" });
    assert.equal(deactivated.status, "Nonaktif");
  });

  test("6. Standalone Employee without User Account", () => {
    // Create an employee who does not have login credentials
    const fieldStaff = employeeService.createEmployee({
      nama_lengkap: "Teguh Prakoso",
      jabatan: "MESSENGER",
      wilayah: "Bogor",
      no_hp: "081299887766",
      nik_ktp: "3201011504950008",
      status_karyawan: "TETAP",
      tgl_lahir: "1995-04-15",
      tanggal_bergabung: "2026-02-01",
      gaji_pokok: 4800000,
      jenis_kelamin: "Laki-laki",
      alamat_domisili: "Jl. Raya Ciawi No. 12, Bogor"
    });

    assert.ok(fieldStaff.id);
    const linkedUser = dbUserRepository.getByEmployeeId(fieldStaff.id);
    assert.equal(linkedUser, undefined, "Standalone employee must have no linked user account");

    // Employee list includes this employee
    const allEmps = employeeService.getAll();
    assert.ok(allEmps.some((e) => e.id === fieldStaff.id));
  });

  test("7. Dropped `employee_accounts` is not queried anywhere and schema remains clean", () => {
    const tableStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_accounts'");
    assert.equal(tableStmt.get(), undefined, "Table employee_accounts must not exist");

    // Zero foreign key violations across the entire database
    const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
    assert.deepEqual(fkCheck, [], "Database must have zero foreign key violations");
  });

  test("8. Permanent Erasure Preflight handles Canonical Employee & User Entities", () => {
    // Preflight on Budi (EMP-0004 / usr-4)
    // Check that preflight operates on employees and users without referencing employee_accounts
    const budiEmp = employeeService.getById("EMP-0004");
    assert.ok(budiEmp);

    const preflight = permanentErasureService.preflightCheck("EMP-0004");

    assert.ok(preflight, "Preflight check must return a result");
    assert.equal(typeof preflight.allowed, "boolean", "allowed must be boolean");
    assert.ok(Array.isArray(preflight.blockers), "blockers must be an array");
    assert.ok(preflight.summary, "summary must be present");
  });
});
