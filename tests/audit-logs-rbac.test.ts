/**
 * Integration Test: Audit Log RBAC Access Control
 * Verifies that role 'admin' can read operational audit logs for Dashboard,
 * while non-authorized roles (finance, messenger) are rejected (403),
 * unauthenticated requests are rejected (401),
 * and modification/deletion of audit logs remains strictly forbidden.
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";

test("Audit Log RBAC - Verification of Access Control", async (t) => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Generate valid tokens for each role
    const adminToken = generateToken({
      userId: "usr-admin-01",
      email: "admin@birojasa.com",
      nama: "Admin Operasional",
      role: "admin",
    });

    const svpToken = generateToken({
      userId: "usr-svp-01",
      email: "svp@birojasa.com",
      nama: "Supervisor Operasional",
      role: "svp",
    });

    const administratorToken = generateToken({
      userId: "usr-super-01",
      email: "super@birojasa.com",
      nama: "Super Admin",
      role: "administrator",
    });

    const financeToken = generateToken({
      userId: "usr-fin-01",
      email: "finance@birojasa.com",
      nama: "Staf Finance",
      role: "finance",
    });

    const messengerToken = generateToken({
      userId: "usr-msg-01",
      email: "kurir@birojasa.com",
      nama: "Kurir Lapangan",
      role: "messenger",
    });

    await t.test("1. Unauthenticated request to GET /api/audit-logs is rejected with 401", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`);
      assert.strictEqual(res.status, 401);
      const body = await res.json() as any;
      assert.strictEqual(body.error?.code, "UNAUTHENTICATED");
    });

    await t.test("2. Role 'finance' is rejected with 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${financeToken}` },
      });
      assert.strictEqual(res.status, 403);
      const body = await res.json() as any;
      assert.strictEqual(body.error?.code, "FORBIDDEN");
    });

    await t.test("3. Role 'messenger' is rejected with 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${messengerToken}` },
      });
      assert.strictEqual(res.status, 403);
      const body = await res.json() as any;
      assert.strictEqual(body.error?.code, "FORBIDDEN");
    });

    await t.test("4. Role 'admin' is authorized to read operational audit logs (200 OK)", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json() as any;
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data));
    });

    await t.test("5. Role 'svp' is authorized to read audit logs (200 OK)", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${svpToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json() as any;
      assert.strictEqual(body.success, true);
    });

    await t.test("6. Role 'administrator' is authorized to read audit logs (200 OK)", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${administratorToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json() as any;
      assert.strictEqual(body.success, true);
    });

    await t.test("7. DELETE /api/audit-logs is not permitted for role 'admin'", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.ok([403, 404, 405].includes(res.status), `Must not be 200 OK, got ${res.status}`);
    });
  } finally {
    server.close();
  }
});
