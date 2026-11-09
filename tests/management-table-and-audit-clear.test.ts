/**
 * Automated Verification Test Suite
 * Management Table Standardization, Permanent Audit Clear & CSV/PDF Export Integrity
 * Admin SUN89 — Biro Jasa Management System
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { sanitizeCSVFormula, escapeCSVCell } from "../src/app/utils/exportUtils";

test("Management Module — Permanent Audit History Clear & Security Paradox Prevention", async (t) => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const { getDb } = await import("../server/src/database/db");
    const testDb = getDb();

    // Query active seeded users
    const rows = testDb.prepare("SELECT id, email, jabatan FROM users").all() as any[];
    const adminUser = rows.find((r: any) => r.jabatan === "ADMIN") || rows[0];
    const svpUser = rows.find((r: any) => r.jabatan === "SVP") || rows[0];
    const finUser = rows.find((r: any) => r.jabatan === "FINANCE") || rows[0];
    const msgUser = rows.find((r: any) => r.jabatan === "MESSENGER") || rows[0];

    const administratorToken = generateToken({
      userId: String(svpUser.id),
      email: svpUser.email,
      nama: "Super Administrator",
      role: "administrator",
    });

    const svpToken = generateToken({
      userId: String(svpUser.id),
      email: svpUser.email,
      nama: "Supervisor Operasional",
      role: "svp",
    });

    const adminToken = generateToken({
      userId: String(adminUser.id),
      email: adminUser.email,
      nama: "Admin Operasional",
      role: "admin",
    });

    const financeToken = generateToken({
      userId: String(finUser.id),
      email: finUser.email,
      nama: "Staf Finance",
      role: "finance",
    });

    const messengerToken = generateToken({
      userId: String(msgUser.id),
      email: msgUser.email,
      nama: "Kurir Lapangan",
      role: "messenger",
    });

    // Seed test audit entries
    testDb.exec(`
      INSERT OR REPLACE INTO audit_logs (id, user_id, user_name, user_role, action, module, details, metadata_json, created_at)
      VALUES 
        ('test-log-1', '${adminUser.id}', 'Admin Operasional', 'admin', 'CREATE', 'Order', 'Order BJ-001 dibuat', null, datetime('now', '-2 hours')),
        ('test-log-2', '${finUser.id}', 'Staf Finance', 'finance', 'UPDATE', 'Finance', 'Invoice INV-001 diverifikasi', null, datetime('now', '-1 hours')),
        ('test-log-3', '${adminUser.id}', 'Admin Operasional', 'admin', 'DELETE', 'Pricing', 'Hapus tarif test', null, datetime('now'));
    `);

    await t.test("1. Unauthorized roles (finance, messenger) are rejected with 403 Forbidden on clear endpoint", async () => {
      const resFin = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${financeToken}` },
      });
      assert.strictEqual(resFin.status, 403, "Finance must not be allowed to clear audit logs");

      const resMsg = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${messengerToken}` },
      });
      assert.strictEqual(resMsg.status, 403, "Messenger must not be allowed to clear audit logs");

      const resFinClear = await fetch(`${baseUrl}/api/audit/clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${financeToken}` },
      });
      assert.strictEqual(resFinClear.status, 403, "Finance must not access /api/audit/clear");
    });

    await t.test("2. Unauthenticated request to clear endpoint is rejected with 401", async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
      });
      assert.strictEqual(res.status, 401);
    });

    await t.test("3. Administrator executes DELETE /api/audit-logs: Operational audit logs become exactly 0 records", async () => {
      // Pre-check count
      const beforeCount = (testDb.prepare("SELECT COUNT(*) as count FROM audit_logs").get() as any).count;
      assert.ok(beforeCount >= 3, `Must have seeded logs before clear, found ${beforeCount}`);

      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${administratorToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = (await res.json()) as any;
      assert.strictEqual(body.success, true);
      assert.ok(body.data.deletedCount >= 3);

      // Verify operational audit_logs is at EXACTLY 0 rows
      const afterCount = (testDb.prepare("SELECT COUNT(*) as count FROM audit_logs").get() as any).count;
      assert.strictEqual(afterCount, 0, "audit_logs table must be completely empty after permanent clear");

      // Verify GET /api/audit-logs returns 0 logs (no self-referencing paradox row)
      const getRes = await fetch(`${baseUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${administratorToken}` },
      });
      assert.strictEqual(getRes.status, 200);
      const getBody = (await getRes.json()) as any;
      assert.strictEqual(getBody.data.length, 0, "GET /api/audit-logs must return 0 records");
    });

    await t.test("4. Audit Paradox Prevention: Clear action is recorded in security_audit_logs, NOT audit_logs", async () => {
      const secRows = testDb.prepare("SELECT * FROM security_audit_logs WHERE action = 'ACTIVITY_HISTORY_CLEARED' ORDER BY created_at DESC").all() as any[];
      assert.ok(secRows.length > 0, "Security audit log must contain the ACTIVITY_HISTORY_CLEARED record");
      assert.strictEqual(secRows[0].module, "Riwayat Aktivitas");
      assert.strictEqual(secRows[0].user_role, "administrator");
      assert.ok(secRows[0].details.includes("Pembersihan permanen"));
    });

    await t.test("5. Clearing an already empty audit_logs table handles safely without error (0 changes)", async () => {
      const res = await fetch(`${baseUrl}/api/audit/clear`, {
        method: "POST",
        headers: { Authorization: `Bearer ${administratorToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = (await res.json()) as any;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.deletedCount, 0, "Should report 0 deleted count when already empty");
    });
  } finally {
    server.close();
  }
});

test("Export Utilities — CSV Sanitization, Formula Injection Neutralization & RFC 4180 Escaping", () => {
  // Test formula injection neutralization
  assert.strictEqual(sanitizeCSVFormula("=SUM(A1:A10)"), "'=SUM(A1:A10)", "Formula starting with = must be prepended with apostrophe");
  assert.strictEqual(sanitizeCSVFormula("+12345"), "'+12345", "Formula starting with + must be prepended with apostrophe");
  assert.strictEqual(sanitizeCSVFormula("-cmd|' /C calc'!A0"), "'-cmd|' /C calc'!A0", "Formula starting with - must be prepended with apostrophe");
  assert.strictEqual(sanitizeCSVFormula("@SUM(1+1)"), "'@SUM(1+1)", "Formula starting with @ must be prepended with apostrophe");
  assert.strictEqual(sanitizeCSVFormula("   =SUM(1,2)"), "'   =SUM(1,2)", "Formula with leading spaces must be prepended with apostrophe");
  assert.strictEqual(sanitizeCSVFormula("Normal User Name"), "Normal User Name", "Normal string must not be modified");

  // Test RFC 4180 escaping
  assert.strictEqual(escapeCSVCell("Normal text"), "Normal text");
  assert.strictEqual(escapeCSVCell("Jakarta, Indonesia"), '"Jakarta, Indonesia"', "Commas must be enclosed in quotes");
  assert.strictEqual(escapeCSVCell('He said "Hello"'), '"He said ""Hello"""', 'Quotes must be doubled and enclosed in quotes');
  assert.strictEqual(escapeCSVCell("Line 1\nLine 2"), '"Line 1\nLine 2"', "Newlines must be enclosed in quotes");
  assert.strictEqual(escapeCSVCell("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0", "Injected formula is neutralized with apostrophe");
  assert.strictEqual(escapeCSVCell('="cmd,calc"'), `"'=\""cmd,calc\"""`, "Injected formula with commas and quotes is neutralized and quoted");
  assert.strictEqual(escapeCSVCell(null), "");
  assert.strictEqual(escapeCSVCell(undefined), "");
});
