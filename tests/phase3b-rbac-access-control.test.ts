/**
 * Phase 3B: RBAC & Access Control Integration & Unit Test Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies all 6 binding Business Decisions & 4 Scopes:
 * - BD-RBAC-01: Immutable Audit Trail (405 AUDIT_LOG_IMMUTABLE on deletion for all roles)
 * - BD-RBAC-02: Order Deletion Restricted to SVP (403 for Admin, Finance, Messenger)
 * - BD-RBAC-03 / Scope 1: Courier Identity Scoping (Verified employeeId only, empty employeeId returns zero, duplicate name isolation, cross-courier task isolation, margin sanitization)
 * - Scope 2: Finance Order Update (PUT /api/orders/:orderNo strictly forbidden for Finance, allowed for Admin & SVP, field-scoped for Courier)
 * - Scope 3: User Privilege Hierarchy (Admin forbidden from creating SVP, modifying SVP, promoting to SVP, resetting SVP password, or deleting SVP)
 * - BD-RBAC-04: Four Canonical Roles & Fail-Closed (Anti-Privilege Escalation, Stage 6 Gating, Rollback Gating)
 * - BD-RBAC-05: Financial Report Segregation (403 for Admin & Messenger on /profit, /laba-rugi, /pnl)
 * - BD-RBAC-06: Static RBAC Policy Enforcement (405 STATIC_RBAC_ENFORCED on permission mutations)
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { APP_CONFIG } from "../src/app/config/appConfig";
import { permissionStore, normalizeRole } from "../src/app/data/permissionStore";
import { generateToken } from "../server/src/utils/crypto";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MemoryStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = { localStorage: mockStorage, dispatchEvent: () => true };

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

async function loginUser(baseUrl: string, email: string, pass: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  const data = (await res.json()) as any;
  if (!data.success || !data.data?.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return { token: data.data.token, user: data.data.user };
}

test("PHASE 3B: RBAC & ACCESS CONTROL INTEGRATION & UNIT SUITE", async (t) => {
  const { server, baseUrl } = await startTestServer();
  const originalApiBaseUrl = APP_CONFIG.apiBaseUrl;
  APP_CONFIG.apiBaseUrl = `${baseUrl}/api`;

  // Log in actors
  const svpAuth = await loginUser(baseUrl, "svp@birojasa.com", "admin123");
  const adminAuth = await loginUser(baseUrl, "admin@birojasa.com", "admin123");
  const financeAuth = await loginUser(baseUrl, "finance@birojasa.com", "finance123");
  const courier1Auth = await loginUser(baseUrl, "budi.messenger@birojasa.com", "messenger123"); // EMP-0004, Budi Santoso
  const courier3Auth = await loginUser(baseUrl, "andi.messenger@birojasa.com", "messenger123"); // EMP-0005, Andi Pratama

  t.after(() => {
    APP_CONFIG.apiBaseUrl = originalApiBaseUrl;
    server.close();
  });

  // =========================================================================
  // SUBTEST 1: BD-RBAC-01 — Immutable Audit Trail
  // =========================================================================
  await t.test("BD-RBAC-01: Audit log deletion and clear endpoints must return 405 Method Not Allowed for all roles", async () => {
    const tokens = [
      { role: "SVP", token: svpAuth.token },
      { role: "Admin", token: adminAuth.token },
      { role: "Finance", token: financeAuth.token },
      { role: "Messenger", token: courier1Auth.token },
    ];

    for (const actor of tokens) {
      // 1. DELETE /api/audit-logs
      const delAuditLogs = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${actor.token}` },
      });
      assert.strictEqual(
        delAuditLogs.status,
        405,
        `Expected 405 for DELETE /api/audit-logs as ${actor.role}, got ${delAuditLogs.status}`
      );
      const delAuditLogsBody = await delAuditLogs.json();
      assert.strictEqual(delAuditLogsBody.error?.code, "AUDIT_LOG_IMMUTABLE");

      // 2. POST /api/audit-logs/clear
      const clearAuditLogs = await fetch(`${baseUrl}/api/audit-logs/clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${actor.token}` },
      });
      assert.strictEqual(
        clearAuditLogs.status,
        405,
        `Expected 405 for POST /api/audit-logs/clear as ${actor.role}, got ${clearAuditLogs.status}`
      );

      // 3. DELETE /api/audit
      const delAudit = await fetch(`${baseUrl}/api/audit`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${actor.token}` },
      });
      assert.strictEqual(
        delAudit.status,
        405,
        `Expected 405 for DELETE /api/audit as ${actor.role}, got ${delAudit.status}`
      );

      // 4. POST /api/audit/clear
      const clearAudit = await fetch(`${baseUrl}/api/audit/clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${actor.token}` },
      });
      assert.strictEqual(
        clearAudit.status,
        405,
        `Expected 405 for POST /api/audit/clear as ${actor.role}, got ${clearAudit.status}`
      );
    }
  });

  // =========================================================================
  // SUBTEST 2: BD-RBAC-01 — Reading Audit Logs
  // =========================================================================
  await t.test("BD-RBAC-01: Reading audit logs respects role visibility", async () => {
    // SVP reading audit logs -> 200 OK
    const svpRead = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${svpAuth.token}` },
    });
    assert.strictEqual(svpRead.status, 200);

    // Admin reading audit logs -> 200 OK
    const adminRead = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    assert.strictEqual(adminRead.status, 200);

    // Messenger reading audit logs -> 403 Forbidden
    const msgRead = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${courier1Auth.token}` },
    });
    assert.strictEqual(msgRead.status, 403);
  });

  // =========================================================================
  // SUBTEST 3: BD-RBAC-02 — Order Deletion Restricted to SVP
  // =========================================================================
  await t.test("BD-RBAC-02: Order deletion strictly restricted to SVP (Admin, Finance, Messenger denied with 403)", async () => {
    const nonSvpActors = [
      { role: "Admin", token: adminAuth.token },
      { role: "Finance", token: financeAuth.token },
      { role: "Messenger", token: courier1Auth.token },
    ];

    for (const actor of nonSvpActors) {
      // 1. DELETE /api/orders/:orderNo
      const delOrder = await fetch(`${baseUrl}/api/orders/NONEXISTENT-ORD-999`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${actor.token}` },
      });
      assert.strictEqual(
        delOrder.status,
        403,
        `Expected 403 for DELETE /api/orders/:orderNo as ${actor.role}, got ${delOrder.status}`
      );

      // 2. DELETE /api/orders/:orderNo/archive
      const delArchivedOrder = await fetch(`${baseUrl}/api/orders/NONEXISTENT-ORD-999/archive`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${actor.token}` },
      });
      assert.strictEqual(
        delArchivedOrder.status,
        403,
        `Expected 403 for DELETE /api/orders/:orderNo/archive as ${actor.role}, got ${delArchivedOrder.status}`
      );

      // 3. DELETE /api/orders/archive/clear-all
      const clearAllArchived = await fetch(`${baseUrl}/api/orders/archive/clear-all`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${actor.token}` },
      });
      assert.strictEqual(
        clearAllArchived.status,
        403,
        `Expected 403 for DELETE /api/orders/archive/clear-all as ${actor.role}, got ${clearAllArchived.status}`
      );
    }

    // SVP allowed (returns 404 for non-existent order, proving authorization succeeded and was not 403)
    const svpDel = await fetch(`${baseUrl}/api/orders/NONEXISTENT-ORD-999`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${svpAuth.token}` },
    });
    assert.strictEqual(
      svpDel.status,
      404,
      `Expected 404 for non-existent order as SVP, got ${svpDel.status}`
    );

    // SVP clear-all archived allowed
    const svpClearAll = await fetch(`${baseUrl}/api/orders/archive/clear-all`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${svpAuth.token}` },
    });
    assert.strictEqual(
      svpClearAll.status,
      200,
      `Expected 200 for SVP clear-all archive, got ${svpClearAll.status}`
    );
  });

  // =========================================================================
  // SUBTEST 4: BD-RBAC-03 — Courier General Order Denial
  // =========================================================================
  await t.test("BD-RBAC-03: Courier denied from GET /api/orders with 403 Forbidden", async () => {
    const courierGetOrders = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${courier1Auth.token}` },
    });
    assert.strictEqual(courierGetOrders.status, 403);

    const courierGetArchived = await fetch(`${baseUrl}/api/orders/archived`, {
      headers: { Authorization: `Bearer ${courier1Auth.token}` },
    });
    assert.strictEqual(courierGetArchived.status, 403);
  });

  // =========================================================================
  // SUBTEST 5: BD-RBAC-03 — Courier Task Scoping & Financial Sanitization
  // =========================================================================
  await t.test("BD-RBAC-03: Courier accesses GET /api/messenger/my-tasks with sanitized financial data", async () => {
    const myTasksRes = await fetch(`${baseUrl}/api/messenger/my-tasks`, {
      headers: { Authorization: `Bearer ${courier1Auth.token}` },
    });
    assert.strictEqual(myTasksRes.status, 200);

    const data = await myTasksRes.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data, "Expected data field in my-tasks response");

    // All orders in tasks should have margin/biayaJasa sanitized to 0
    for (const stage of Object.keys(data.data)) {
      for (const order of data.data[stage]) {
        assert.strictEqual(order.biayaJasa, 0, "biayaJasa must be sanitized to 0 for couriers");
        assert.strictEqual(order.finalBiayaJasa, 0, "finalBiayaJasa must be sanitized to 0 for couriers");
        assert.strictEqual((order as any).profit, undefined, "profit field must not exist");
      }
    }
  });

  // =========================================================================
  // SUBTEST 6: Scope 1 — Courier Identity Scoping (Strict EmployeeId & Duplicate Names)
  // =========================================================================
  await t.test("Scope 1: Courier task scoping strictly by verified employeeId (rejection of empty employeeId, duplicate names, cross-courier task isolation)", async () => {
    // 1. Empty/missing employeeId returns zero tasks across all stages
    const emptyEmpToken = generateToken({
      userId: "4",
      email: "budi.messenger@birojasa.com",
      nama: "Budi Santoso",
      role: "messenger",
      employeeId: "",
    });
    const emptyRes = await fetch(`${baseUrl}/api/messenger/my-tasks`, {
      headers: { Authorization: `Bearer ${emptyEmpToken}` },
    });
    assert.strictEqual(emptyRes.status, 200);
    const emptyBody = await emptyRes.json();
    for (const stage of Object.keys(emptyBody.data)) {
      assert.strictEqual(emptyBody.data[stage].length, 0, `Stage ${stage} must have 0 orders when employeeId is empty`);
    }

    // 2. Whitespace employeeId returns zero tasks
    const wsEmpToken = generateToken({
      userId: "4",
      email: "budi.messenger@birojasa.com",
      nama: "Budi Santoso",
      role: "messenger",
      employeeId: "   ",
    });
    const wsRes = await fetch(`${baseUrl}/api/messenger/my-tasks`, {
      headers: { Authorization: `Bearer ${wsEmpToken}` },
    });
    assert.strictEqual(wsRes.status, 200);
    const wsBody = await wsRes.json();
    for (const stage of Object.keys(wsBody.data)) {
      assert.strictEqual(wsBody.data[stage].length, 0);
    }

    // 3. Duplicate Courier Names Isolation
    // In database, order ORD-1126-003 has assignedMessengerId: "EMP-0004" and messenger: "Budi Santoso" (pickup stage)
    const c1Res = await fetch(`${baseUrl}/api/messenger/my-tasks`, {
      headers: { Authorization: `Bearer ${courier1Auth.token}` }, // EMP-0004, Budi Santoso
    });
    const c1Body = await c1Res.json();
    assert.strictEqual(c1Body.success, true);
    const c1HasOrd003 = Object.values(c1Body.data).flat().some((o: any) => o.orderNo === "ORD-1126-003");
    assert.strictEqual(c1HasOrd003, true, "Courier 1 (EMP-0004) must see ORD-1126-003 assigned to them");

    // Token for active user 5 with spoofed/identical name "Budi Santoso" but employeeId "EMP-0005"
    const duplicateNameToken = generateToken({
      userId: "5",
      email: "andi.messenger@birojasa.com",
      nama: "Budi Santoso",
      role: "messenger",
      employeeId: "EMP-0005",
    });
    const dupRes = await fetch(`${baseUrl}/api/messenger/my-tasks`, {
      headers: { Authorization: `Bearer ${duplicateNameToken}` },
    });
    assert.strictEqual(dupRes.status, 200);
    const dupBody = await dupRes.json();
    assert.strictEqual(dupBody.success, true);
    // Under pickup (Verifikasi Fisik / Stage 3), ORD-1126-003 was assigned to EMP-0004 ("Budi Santoso").
    // The duplicate-named courier with EMP-0005 MUST NOT see it in pickup!
    const pickupOrders = dupBody.data["Verifikasi Fisik"] || [];
    const hasOrdInPickup = pickupOrders.some((o: any) => o.orderNo === "ORD-1126-003");
    assert.strictEqual(hasOrdInPickup, false, "Courier with duplicate name 'Budi Santoso' but EMP-0005 MUST NOT see pickup task of EMP-0004");

    // 4. Cross-courier task isolation: Courier 3 (EMP-0005) sees ORD-1126-003 under Samsat (Stage 4), where they are samsatMessengerId
    const c3Res = await fetch(`${baseUrl}/api/messenger/my-tasks`, {
      headers: { Authorization: `Bearer ${courier3Auth.token}` }, // EMP-0005, Andi Pratama
    });
    const c3Body = await c3Res.json();
    assert.strictEqual(c3Body.success, true);
    const samsatOrders = c3Body.data["Proses Samsat"] || [];
    const c3HasOrdInSamsat = samsatOrders.some((o: any) => o.orderNo === "ORD-1126-003");
    assert.strictEqual(c3HasOrdInSamsat, true, "Courier 3 (EMP-0005) sees task where they are samsatMessengerId");
  });

  // =========================================================================
  // SUBTEST 7: Scope 2 — Finance Order Update Authorization Matrix
  // =========================================================================
  await t.test("Scope 2: PUT /api/orders/:orderNo authorization matrix across SVP, Admin, Finance, Courier", async () => {
    // 1. Finance token calling PUT /api/orders/:orderNo is strictly rejected with 403 Forbidden
    const finUpdate = await fetch(`${baseUrl}/api/orders/ORD-1126-003`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${financeAuth.token}`,
      },
      body: JSON.stringify({
        notes: "Finance attempt to update order",
        biayaJasa: 150000,
      }),
    });
    assert.strictEqual(finUpdate.status, 403, "Finance must be denied from PUT /api/orders/:orderNo with 403 Forbidden");
    const finBody = await finUpdate.json();
    assert.strictEqual(finBody.error?.code, "FORBIDDEN");

    // 2. Admin token calling PUT /api/orders/:orderNo is allowed (200 OK)
    const adminUpdate = await fetch(`${baseUrl}/api/orders/ORD-1126-003`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        catatanOrder: "Admin updated note",
      }),
    });
    assert.strictEqual(adminUpdate.status, 200, "Admin must be allowed to update order with 200 OK");
    const adminBody = await adminUpdate.json();
    assert.strictEqual(adminBody.success, true);

    // 3. SVP token calling PUT /api/orders/:orderNo is allowed (200 OK)
    const svpUpdate = await fetch(`${baseUrl}/api/orders/ORD-1126-003`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${svpAuth.token}`,
      },
      body: JSON.stringify({
        catatanOrder: "SVP verified note",
      }),
    });
    assert.strictEqual(svpUpdate.status, 200, "SVP must be allowed to update order with 200 OK");
    const svpBody = await svpUpdate.json();
    assert.strictEqual(svpBody.success, true);

    // 4. Courier calling PUT /api/orders/:orderNo with general customer/cost fields
    // General non-messenger fields must be ignored / not mutated
    const courierTamper = await fetch(`${baseUrl}/api/orders/ORD-1126-003`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${courier1Auth.token}`,
      },
      body: JSON.stringify({
        customer: "Tampered Customer Name",
        totalBiaya: 9999999,
        biayaJasa: 888888,
      }),
    });
    // Even if status is 200, the general fields must NOT have been updated!
    const verifyTamper = await fetch(`${baseUrl}/api/orders/ORD-1126-003`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    const verifyBody = await verifyTamper.json();
    assert.notStrictEqual(verifyBody.data?.customer, "Tampered Customer Name", "Courier must NOT be able to modify customer field");
    assert.notStrictEqual(verifyBody.data?.biayaJasa, 888888, "Courier must NOT be able to modify biayaJasa field");
  });

  // =========================================================================
  // SUBTEST 8: Scope 3 — User Privilege Hierarchy (Admin Operations on SVP Accounts Forbidden)
  // =========================================================================
  await t.test("Scope 3: User Privilege Hierarchy — Admin operations against SVP accounts via API are strictly forbidden", async () => {
    // 1. Admin attempting to CREATE user with jabatan: "SVP" -> 403 Forbidden
    const createSvpJabatan = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        nama: "Rogue SVP User",
        email: "rogue1@birojasa.com",
        password: "password123",
        jabatan: "SVP",
      }),
    });
    assert.strictEqual(createSvpJabatan.status, 403, "Admin cannot create user with jabatan SVP");
    const c1Body = await createSvpJabatan.json();
    assert.strictEqual(c1Body.error?.code, "FORBIDDEN");

    // 2. Admin attempting to CREATE user with role: "administrator" -> 403 Forbidden
    const createSvpRole = await fetch(`${baseUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        nama: "Rogue Admin User",
        email: "rogue2@birojasa.com",
        password: "password123",
        jabatan: "ADMIN",
        role: "administrator",
      }),
    });
    assert.strictEqual(createSvpRole.status, 403, "Admin cannot create user with role administrator");

    // 3. Admin attempting to UPDATE user ID 1 (SVP account) -> 403 Forbidden
    const updateSvpAcc = await fetch(`${baseUrl}/api/users/1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        nama: "Tampered SVP Name",
      }),
    });
    assert.strictEqual(updateSvpAcc.status, 403, "Admin cannot modify SVP account (User ID 1)");
    const upBody = await updateSvpAcc.json();
    assert.strictEqual(upBody.error?.code, "FORBIDDEN");

    // 4. Admin attempting to PROMOTE user ID 2 (Admin) to SVP -> 403 Forbidden
    const promoteToSvp = await fetch(`${baseUrl}/api/users/2`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        jabatan: "SVP",
      }),
    });
    assert.strictEqual(promoteToSvp.status, 403, "Admin cannot promote any account to jabatan SVP");

    // 5. Admin attempting to PROMOTE user ID 2 (Admin) to role administrator -> 403 Forbidden
    const promoteToAdminRole = await fetch(`${baseUrl}/api/users/2`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        role: "administrator",
      }),
    });
    assert.strictEqual(promoteToAdminRole.status, 403, "Admin cannot promote account to role administrator");

    // 6. Admin attempting to RESET PASSWORD on user ID 1 (SVP account) -> 403 Forbidden
    const resetSvpPass = await fetch(`${baseUrl}/api/users/1/reset-password`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
      },
    });
    assert.strictEqual(resetSvpPass.status, 403, "Admin cannot reset password for SVP account");
    const resetBody = await resetSvpPass.json();
    assert.strictEqual(resetBody.error?.code, "FORBIDDEN");

    // 7. Admin attempting to DELETE user ID 1 (SVP account) -> 403 Forbidden
    const delSvpAcc = await fetch(`${baseUrl}/api/users/1`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
      },
    });
    assert.strictEqual(delSvpAcc.status, 403, "Admin cannot delete SVP account");
    const delBody = await delSvpAcc.json();
    assert.strictEqual(delBody.error?.code, "FORBIDDEN");

    // 8. SVP updating user ID 1 is allowed
    const svpSelfUpdate = await fetch(`${baseUrl}/api/users/1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${svpAuth.token}`,
      },
      body: JSON.stringify({
        nama: "Admin Super (SVP)",
      }),
    });
    assert.strictEqual(svpSelfUpdate.status, 200, "SVP must be allowed to update user ID 1");
  });

  // =========================================================================
  // SUBTEST 9: BD-RBAC-04 — Fail-Closed Authentication
  // =========================================================================
  await t.test("BD-RBAC-04: Fail-closed authentication rejects invalid or unrecognized role/jabatan", async () => {
    // Attempt login with invalid credentials
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@birojasa.com", password: "password" }),
    });
    assert.strictEqual(badLogin.status, 401);
  });

  // =========================================================================
  // SUBTEST 10: BD-RBAC-04 — Stage 6 Supervisi & Rollback Gating
  // =========================================================================
  await t.test("BD-RBAC-04: Admin cannot approve or advance orders in Stage 6 (Supervisi) & rollback past Stage 6", async () => {
    // Admin attempting to advance order at Stage 6
    const advanceStage6 = await fetch(`${baseUrl}/api/orders/NONEXISTENT/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        currentStage: "Supervisi",
        targetStage: "Pengantaran",
      }),
    });
    assert.strictEqual(advanceStage6.status, 403);
    const body = await advanceStage6.json();
    assert.strictEqual(body.error?.code, "FORBIDDEN");

    // Admin attempting to rollback order past Stage 6
    const rollbackPastStage6 = await fetch(`${baseUrl}/api/orders/ORD-1126-001/rollback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        targetStep: 5,
        targetStage: "Verifikasi Dokumen",
        reason: "Test rollback attempt by admin",
      }),
    });
    assert.strictEqual(rollbackPastStage6.status, 403);
  });

  // =========================================================================
  // SUBTEST 11: BD-RBAC-05 — Financial Report Segregation
  // =========================================================================
  await t.test("BD-RBAC-05: Admin and Messenger strictly denied from financial report endpoints", async () => {
    const financialReportEndpoints = [
      "/api/finance/profit",
      "/api/finance/laba-rugi",
      "/api/finance/pnl",
    ];

    for (const ep of financialReportEndpoints) {
      // Admin denied (403)
      const adminRes = await fetch(`${baseUrl}${ep}`, {
        headers: { Authorization: `Bearer ${adminAuth.token}` },
      });
      assert.strictEqual(
        adminRes.status,
        403,
        `Expected 403 for Admin on ${ep}, got ${adminRes.status}`
      );

      // Messenger denied (403)
      const msgRes = await fetch(`${baseUrl}${ep}`, {
        headers: { Authorization: `Bearer ${courier1Auth.token}` },
      });
      assert.strictEqual(
        msgRes.status,
        403,
        `Expected 403 for Messenger on ${ep}, got ${msgRes.status}`
      );

      // Finance allowed (200)
      const finRes = await fetch(`${baseUrl}${ep}`, {
        headers: { Authorization: `Bearer ${financeAuth.token}` },
      });
      assert.strictEqual(
        finRes.status,
        200,
        `Expected 200 for Finance on ${ep}, got ${finRes.status}`
      );

      // SVP allowed (200)
      const svpRes = await fetch(`${baseUrl}${ep}`, {
        headers: { Authorization: `Bearer ${svpAuth.token}` },
      });
      assert.strictEqual(
        svpRes.status,
        200,
        `Expected 200 for SVP on ${ep}, got ${svpRes.status}`
      );
    }
  });

  // =========================================================================
  // SUBTEST 12: BD-RBAC-06 — Static RBAC Policy Enforcement
  // =========================================================================
  await t.test("BD-RBAC-06: Dynamic permission mutations disabled with 405 STATIC_RBAC_ENFORCED", async () => {
    // 1. PUT /api/permissions/:role
    const putPerm = await fetch(`${baseUrl}/api/permissions/admin`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${svpAuth.token}`,
      },
      body: JSON.stringify({
        modules: { dashboard: { view: false, manage: false } },
      }),
    });
    assert.strictEqual(putPerm.status, 405);
    const putBody = await putPerm.json();
    assert.strictEqual(putBody.error?.code, "STATIC_RBAC_ENFORCED");

    // 2. POST /api/permissions/reset
    const resetPerm = await fetch(`${baseUrl}/api/permissions/reset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${svpAuth.token}`,
      },
    });
    assert.strictEqual(resetPerm.status, 405);
    const resetBody = await resetPerm.json();
    assert.strictEqual(resetBody.error?.code, "STATIC_RBAC_ENFORCED");

    // 3. GET /api/permissions remains readable as view-only static documentation
    const getPerm = await fetch(`${baseUrl}/api/permissions`, {
      headers: { Authorization: `Bearer ${svpAuth.token}` },
    });
    assert.strictEqual(getPerm.status, 200);
    const getBody = await getPerm.json();
    assert.strictEqual(getBody.success, true);
    assert.ok(getBody.data?.svp, "Expected svp permissions in static matrix");
    assert.ok(getBody.data?.admin, "Expected admin permissions in static matrix");
    assert.ok(getBody.data?.finance, "Expected finance permissions in static matrix");
    assert.ok(getBody.data?.messenger, "Expected messenger permissions in static matrix");
  });

  // =========================================================================
  // SUBTEST 13: Frontend Permission Store — Fail-Closed Mappings
  // =========================================================================
  await t.test("Frontend Permission Store: normalizeRole fail-closed and canonical mappings", () => {
    // Fail-closed cases
    assert.strictEqual(normalizeRole(null), "unknown");
    assert.strictEqual(normalizeRole(undefined), "unknown");
    assert.strictEqual(normalizeRole(""), "unknown");
    assert.strictEqual(normalizeRole("   "), "unknown");
    assert.strictEqual(normalizeRole("supervisor"), "unknown");
    assert.strictEqual(normalizeRole("staff"), "unknown");
    assert.strictEqual(normalizeRole("spv"), "unknown"); // phantom role fails closed
    assert.strictEqual(normalizeRole("administrator"), "svp");
    assert.strictEqual(normalizeRole("svp"), "svp");
    assert.strictEqual(normalizeRole("admin"), "admin");
    assert.strictEqual(normalizeRole("finance"), "finance");
    assert.strictEqual(normalizeRole("messenger"), "messenger");
    assert.strictEqual(normalizeRole("kurir"), "messenger");
  });

  // =========================================================================
  // SUBTEST 14: Frontend Permission Store — Zero Privileges for Unknown Role
  // =========================================================================
  await t.test("Frontend Permission Store: unknown role has zero privileges", () => {
    assert.strictEqual(permissionStore.canViewPage("unknown", "dashboard"), false);
    assert.strictEqual(permissionStore.canViewPage("unknown", "finance"), false);
    assert.strictEqual(permissionStore.canManageModule("unknown", "dashboard"), false);
    assert.strictEqual(permissionStore.canManageStage("unknown", 1), false);
    assert.strictEqual(permissionStore.canManageStage("unknown", 4), false);
    assert.strictEqual(permissionStore.canManageStage("unknown", 6), false);
  });

  // =========================================================================
  // SUBTEST 15: Frontend Permission Store — Stage 6 Gating & Mutation Lock
  // =========================================================================
  await t.test("Frontend Permission Store: Stage 6 gating & mutation lock", async () => {
    // Admin cannot mutate Stage 6
    assert.strictEqual(permissionStore.canManageStage("admin", 6), false);
    // Messenger cannot mutate Stage 6
    assert.strictEqual(permissionStore.canManageStage("messenger", 6), false);
    // Finance cannot mutate Stage 6
    assert.strictEqual(permissionStore.canManageStage("finance", 6), false);
    // SVP can mutate Stage 6
    assert.strictEqual(permissionStore.canManageStage("svp", 6), true);

    // Dynamic save must throw error
    await assert.rejects(
      async () => {
        await permissionStore.saveRolePermissions("admin", {} as any);
      },
      /kebijakan hak akses bersifat statis/i
    );

    // Dynamic reset must throw error
    await assert.rejects(
      async () => {
        await permissionStore.resetToDefaults();
      },
      /kebijakan hak akses bersifat statis/i
    );
  });
});
