/**
 * PHASE 6: MASTER SECURITY HARDENING & VULNERABILITY VERIFICATION SUITE
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Comprehensive verification covering the complete Section 15 Test Matrix:
 * SEC-001 | Authentication       | Invalid credentials rejected (401)
 * SEC-002 | Authentication       | Expired token rejected (401)
 * SEC-003 | Authentication       | Invalid token signature rejected (401)
 * SEC-004 | Session Lifecycle    | Inactive / Revoked user session rejected (401/403)
 * SEC-005 | Authorization & RBAC | Messenger accesses admin endpoint denied (403)
 * SEC-006 | IDOR & User Privacy  | Non-admin accessing another user profile denied (403)
 * SEC-007 | SQL Injection        | Malicious SQL in search/order filter safely parameterized
 * SEC-008 | Mass Assignment      | Modifying protected stage/payment fields rejected (403/400)
 * SEC-009 | File Access Control  | Unauthorized download without ticket/assignment denied (401/403)
 * SEC-010 | File Upload Security | Executable / script extension upload rejected (400)
 * SEC-011 | Path Traversal       | Directory traversal payloads in document ID/path rejected (404/400)
 * SEC-012 | XSS & Sanitization   | Untrusted script payload neutralized with nosniff & CSP
 * SEC-013 | CSRF Resistance      | State-changing requests enforce Bearer authentication
 * SEC-014 | Rate Limiting        | Brute-force login attempts limited with 429 Retry-After
 * SEC-015 | Financial Security   | Tampered / negative amounts rejected by authoritative backend
 * SEC-016 | Audit Logging        | Sensitive mutations logged safely with immutable verified actor
 */

import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken, verifyPassword, hashPassword } from "../server/src/utils/crypto";
import { db } from "../server/src/database/db";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { dbUserRepository } from "../server/src/repositories/dbUserRepository";
import { loginRateLimiter } from "../server/src/middleware/rateLimiter";

function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

test("PHASE 6: MASTER SECURITY HARDENING & APPLICATION SECURITY SUITE", async (t) => {
  const { server, baseUrl } = await startTestServer();

  // Standard Seed Users:
  // User 1: Administrator (SVP)
  // User 2: Admin
  // User 3: Finance
  // User 4: Messenger 1 (Ahmad Rizki / EMP-0004)
  // User 5: Messenger 2 (Budi Pratama / EMP-0005)
  const svpToken = generateToken({
    userId: "usr-1",
    id: "1",
    email: "svp@birojasa.com",
    nama: "Supervisor SPV",
    jabatan: "SVP",
    role: "administrator",
  });

  const adminToken = generateToken({
    userId: "usr-2",
    id: "2",
    email: "admin@birojasa.com",
    nama: "Admin Utama",
    jabatan: "ADMIN",
    role: "admin",
  });

  const financeToken = generateToken({
    userId: "usr-3",
    id: "3",
    email: "finance@birojasa.com",
    nama: "Finance Staff",
    jabatan: "FINANCE",
    role: "finance",
  });

  const messengerToken = generateToken({
    userId: "usr-4",
    id: "4",
    employeeId: "EMP-0004",
    email: "kurir1@birojasa.com",
    nama: "Ahmad Rizki",
    jabatan: "MESSENGER",
    role: "messenger",
  });

  const otherMessengerToken = generateToken({
    userId: "usr-5",
    id: "5",
    employeeId: "EMP-0005",
    email: "kurir2@birojasa.com",
    nama: "Budi Pratama",
    jabatan: "MESSENGER",
    role: "messenger",
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-001: AUTHENTICATION — INVALID CREDENTIALS REJECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-001: Invalid credentials rejected with generic message", async () => {
    loginRateLimiter.reset();

    // 1. Non-existent email
    const nonExistentRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doesnotexist@birojasa.com", password: "Password123" }),
    });
    assert.strictEqual(nonExistentRes.status, 401);
    const nonExistentBody = await nonExistentRes.json() as any;
    assert.strictEqual(nonExistentBody.error.code, "INVALID_CREDENTIALS");
    // Ensure email enumeration is prevented
    assert.strictEqual(nonExistentBody.error.message, "Email atau password tidak valid.");

    // 2. Existing email with incorrect password
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@birojasa.com", password: "WrongPassword999!" }),
    });
    assert.strictEqual(wrongPassRes.status, 401);
    const wrongPassBody = await wrongPassRes.json() as any;
    assert.strictEqual(wrongPassBody.error.code, "INVALID_CREDENTIALS");
    assert.strictEqual(wrongPassBody.error.message, "Email atau password tidak valid.");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-002: AUTHENTICATION — EXPIRED TOKEN REJECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-002: Expired JWT token is immediately rejected", async () => {
    const expiredToken = generateToken(
      { userId: "usr-2", email: "admin@birojasa.com", nama: "Admin", jabatan: "ADMIN", role: "admin" },
      -60 // expired 60 seconds ago
    );

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json() as any;
    assert.strictEqual(body.error.code, "UNAUTHENTICATED");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-003: AUTHENTICATION — INVALID TOKEN SIGNATURE REJECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-003: Tampered token signature is rejected", async () => {
    const parts = adminToken.split(".");
    // Forged payload claiming to be SVP with administrator role
    const forgedPayload = Buffer.from(JSON.stringify({
      userId: "usr-2",
      email: "admin@birojasa.com",
      nama: "Admin Utama",
      jabatan: "SVP",
      role: "administrator",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const tamperedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json() as any;
    assert.strictEqual(body.error.code, "UNAUTHENTICATED");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-004: SESSION LIFECYCLE — INACTIVE / REVOKED USER SESSION REJECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-004: Inactive and deleted accounts are immediately rejected by real-time DB check", async () => {
    // Create synthetic user, generate token, then deactivate user in SQLite
    const syntheticEmail = `deactivated-${Date.now()}@birojasa.com`;
    const { hash, salt } = hashPassword("TempPassword123!");
    const createRes = dbUserRepository.createUser({
      email: syntheticEmail,
      password_hash: hash,
      password_salt: salt,
      nama: "Inactive Test User",
      jabatan: "ADMIN",
      role: "admin",
      status: "Aktif",
    });

    const activeToken = generateToken({
      userId: `usr-${createRes.id}`,
      id: String(createRes.id),
      email: syntheticEmail,
      nama: "Inactive Test User",
      jabatan: "ADMIN",
      role: "admin",
    });

    // 1. Active state succeeds
    const check1 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual(check1.status, 200);

    // 2. Deactivate user in SQLite database
    db.prepare("UPDATE users SET status = 'Nonaktif' WHERE id = ?").run(createRes.id);

    // 3. Subsequent request with same validly-signed token is immediately rejected!
    const check2 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual(check2.status, 401);
    const body2 = await check2.json() as any;
    assert.strictEqual(body2.error.code, "ACCOUNT_INACTIVE");

    // 4. Delete user entirely from SQLite database -> REVOKED_IDENTITY
    db.prepare("DELETE FROM users WHERE id = ?").run(createRes.id);
    const check3 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual(check3.status, 401);
    const body3 = await check3.json() as any;
    assert.strictEqual(body3.error.code, "REVOKED_IDENTITY");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-005: AUTHORIZATION & RBAC — MESSENGER ACCESSES ADMIN ENDPOINTS DENIED
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-005: Messenger attempting admin mutations is denied with 403 Forbidden", async () => {
    // 1. Messenger attempts to create order -> 403
    const orderCreateRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${messengerToken}` },
      body: JSON.stringify({
        customer: "Illegal Order by Courier",
        nomorHP: "081200000000",
        layanan: "Perpanjangan STNK",
        nopol: "B 7777 MSG",
        payment: { totalBiaya: 500000, dibayar: 0 },
      }),
    });
    assert.strictEqual(orderCreateRes.status, 403);
    const createBody = await orderCreateRes.json() as any;
    assert.strictEqual(createBody.error.code, "FORBIDDEN");

    // 2. Messenger attempts to delete an employee -> 403
    const deleteEmpRes = await fetch(`${baseUrl}/api/employees/EMP-0001`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${messengerToken}` },
    });
    assert.strictEqual(deleteEmpRes.status, 403);

    // 3. Messenger attempts to access administrative audit logs -> 403
    const auditRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${messengerToken}` },
    });
    assert.strictEqual(auditRes.status, 403);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-006: IDOR & USER PRIVACY — CROSS-USER PROFILE ACCESS RESTRICTION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-006: Non-admin user cannot access another user's profile (IDOR protection)", async () => {
    // Messenger 1 (usr-4) attempts to read User 3 (Finance) profile
    const idorRes = await fetch(`${baseUrl}/api/users/3`, {
      headers: { Authorization: `Bearer ${messengerToken}` },
    });
    assert.strictEqual(idorRes.status, 403);
    const idorBody = await idorRes.json() as any;
    assert.strictEqual(idorBody.error.code, "FORBIDDEN");

    // Messenger 1 reading own profile (usr-4) -> Allowed
    const selfRes = await fetch(`${baseUrl}/api/users/4`, {
      headers: { Authorization: `Bearer ${messengerToken}` },
    });
    assert.strictEqual(selfRes.status, 200);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-007: SQL INJECTION — USER INPUT SAFELY PARAMETERIZED
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-007: Malicious SQL injection payloads in parameters do not compromise database", async () => {
    const sqliPayload = "ORD-001' OR '1'='1' -- ";

    // Search order by orderNo with SQL injection string
    const res = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(sqliPayload)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    // Parameterized query treats it as literal string -> Not Found (404)
    assert.strictEqual(res.status, 404);

    // Search with union injection
    const unionPayload = "1 UNION SELECT * FROM users --";
    const res2 = await fetch(`${baseUrl}/api/pricing/samsat/${encodeURIComponent(unionPayload)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    // Parameterized query parses integer or fails safely
    assert.ok(res2.status === 400 || res2.status === 404);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-008: MASS ASSIGNMENT — FORGED PAYMENT AND STAGE TAMPERING REJECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-008: Client attempting to inject protected fields via update is rejected", async () => {
    // Create an order
    const orderNo = `ORD-SEC08-${Date.now()}`;
    dbOrderRepository.saveOrder({
      orderNo,
      customer: "Mass Assignment Test",
      nomorHp: "081299991111",
      layanan: "Perpanjangan STNK",
      nopol: "B 1234 MAS",
      currentStep: 1,
      currentStageName: "Verifikasi",
      paymentStatus: "Belum Bayar",
      totalBiaya: 500000,
      isArchived: false,
      payment: { totalBiaya: 500000, dibayar: 0, statusPembayaran: "Belum Lunas" },
    } as any);

    // Attempt to inject payment status "Lunas" and currentStep "8" via PUT /orders/:orderNo
    const updateRes = await fetch(`${baseUrl}/api/orders/${orderNo}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        customer: "Updated Name",
        currentStep: 8,
        isArchived: true,
        payment: {
          statusPembayaran: "Lunas",
          isPaymentVerified: true,
        },
      }),
    });
    assert.strictEqual(updateRes.status, 403, "Tampering with protected fields must be rejected with 403");

    // Verify order in database was not mutated
    const current = dbOrderRepository.getByOrderNo(orderNo);
    assert.strictEqual(current?.currentStep, 1);
    assert.strictEqual(current?.payment?.statusPembayaran, "Belum Lunas");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-009: FILE ACCESS CONTROL — UNAUTHORIZED DOCUMENT DOWNLOAD REJECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-009: Document preview and download strictly require authorization ticket or Bearer token", async () => {
    // 1. Anonymous request without ticket or token -> 401
    const anonRes = await fetch(`${baseUrl}/api/documents/fake-doc-id/download`);
    assert.strictEqual(anonRes.status, 401);

    // 2. Unassigned messenger attempting to issue ticket for order assigned to another courier -> 403
    // Create order assigned to Messenger 1 (EMP-0004)
    const orderNo = `ORD-DOC-ASSIGN-${Date.now()}`;
    dbOrderRepository.saveOrder({
      orderNo,
      customer: "Courier Doc Test",
      nomorHp: "081299992222",
      layanan: "Mutasi Masuk",
      nopol: "B 9999 CUR",
      assignedMessengerId: "EMP-0004",
      messenger: "Ahmad Rizki",
      currentStep: 2,
      currentStageName: "Penjadwalan",
      paymentStatus: "Belum Bayar",
      totalBiaya: 600000,
      isArchived: false,
    } as any);

    // Create a document linked to this order
    const docId = `DOC-TEST-${Date.now()}`;
    db.prepare(`
      INSERT INTO documents (id, original_name, storage_name, mime_type, size_bytes, sha256, document_type, order_no, uploaded_by_id, uploaded_by, is_active, created_at, updated_at)
      VALUES (?, 'ktp.jpg', 'fake-uuid.jpg', 'image/jpeg', 1024, 'dummy-hash', 'KTP', ?, 'usr-2', 'Admin', 1, datetime('now'), datetime('now'))
    `).run(docId, orderNo);

    // Messenger 2 (EMP-0005) tries to issue a ticket for Messenger 1's document -> 403
    const issueRes = await fetch(`${baseUrl}/api/documents/${docId}/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${otherMessengerToken}` },
      body: JSON.stringify({ operation: "preview" }),
    });
    assert.strictEqual(issueRes.status, 403);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-010: FILE UPLOAD SECURITY — DANGEROUS EXECUTABLE UPLOAD REJECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-010: Dangerous executable and script file uploads are rejected by file filter", async () => {
    const boundary = "----WebKitFormBoundarySecurityTest";
    const dangerousFiles = [
      { name: "exploit.exe", mime: "application/x-msdownload" },
      { name: "script.bat", mime: "application/x-bat" },
      { name: "webshell.php", mime: "application/x-httpd-php" },
      { name: "payload.sh", mime: "application/x-sh" },
    ];

    for (const f of dangerousFiles) {
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${f.name}"\r\nContent-Type: ${f.mime}\r\n\r\nMALICIOUS_CONTENT\r\n--${boundary}--\r\n`;

      const uploadRes = await fetch(`${baseUrl}/api/documents/upload`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${adminToken}`,
        },
        body,
      });
      assert.strictEqual(uploadRes.status, 400, `Upload of ${f.name} must be rejected`);
      const bodyJson = await uploadRes.json() as any;
      assert.strictEqual(bodyJson.error.code, "DISALLOWED_FILE_EXTENSION");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-011: PATH TRAVERSAL — DIRECTORY TRAVERSAL PROTECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-011: Directory traversal payloads in document ID parameter are safely rejected", async () => {
    const traversalPayloads = [
      "../../../../Windows/System32/drivers/etc/hosts",
      "..%2f..%2f..%2fserver%2fdata%2fdatabase.sqlite",
      "..\\..\\server\\data\\database.sqlite",
    ];

    for (const p of traversalPayloads) {
      const res = await fetch(`${baseUrl}/api/documents/${encodeURIComponent(p)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 404, "Traversal attempt must return 404 Not Found");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-012: XSS & SANITIZATION — UNTRUSTED SCRIPTS MITIGATED WITH HEADERS
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-012: Security headers (nosniff, sameorigin) protect against cross-site scripting", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    // nosniff prevents browser from interpreting non-script as script
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
    // clickjacking defense
    assert.strictEqual(res.headers.get("x-frame-options"), "SAMEORIGIN");
    // referrer leak prevention
    assert.strictEqual(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    // server banner removal
    assert.strictEqual(res.headers.get("x-powered-by"), null);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-013: CSRF RESISTANCE — STATE-CHANGING ENDPOINTS REQUIRE BEARER AUTH
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-013: State-changing mutation without Bearer authorization header is blocked", async () => {
    // Attempting state change without Authorization header (ambient cookies do not grant access)
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: "CSRF Attacker", nopol: "B 0000 CSR" }),
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json() as any;
    assert.strictEqual(body.error.code, "UNAUTHENTICATED");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-014: RATE LIMITING — EXCESSIVE LOGIN ATTEMPTS LIMITED (429)
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-014: Excessive consecutive login attempts trigger rate limiting (429)", async () => {
    loginRateLimiter.reset();

    let hit429 = false;
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@birojasa.com", password: `WrongAttempt${i}` }),
      });
      if (res.status === 429) {
        hit429 = true;
        const body = await res.json() as any;
        assert.strictEqual(body.error.code, "TOO_MANY_REQUESTS");
        assert.ok(res.headers.get("retry-after"));
        break;
      }
    }
    assert.ok(hit429, "Rate limiter must trigger HTTP 429 after excessive attempts");
    loginRateLimiter.reset();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-015: FINANCIAL SECURITY — AUTHORITATIVE BACKEND REJECTS TAMPERED PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-015: Backend rejects negative or non-numeric payment amounts", async () => {
    // Negative payment attempt -> 400
    const negRes = await fetch(`${baseUrl}/api/finance/invoices/1/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${financeToken}` },
      body: JSON.stringify({ amount: -150000 }),
    });
    assert.strictEqual(negRes.status, 400);
    const negBody = await negRes.json() as any;
    assert.strictEqual(negBody.error.code, "VALIDATION_ERROR");

    // Zero payment attempt -> 400
    const zeroRes = await fetch(`${baseUrl}/api/finance/invoices/1/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${financeToken}` },
      body: JSON.stringify({ amount: 0 }),
    });
    assert.strictEqual(zeroRes.status, 400);

    // Non-numeric string payment attempt -> 400
    const strRes = await fetch(`${baseUrl}/api/finance/invoices/1/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${financeToken}` },
      body: JSON.stringify({ amount: "seratus_ribu" }),
    });
    assert.strictEqual(strRes.status, 400);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEC-016: AUDIT LOGGING — SENSITIVE MUTATIONS RECORD UNFORGEABLE ACTOR CONTEXT
  // ═══════════════════════════════════════════════════════════════════════════════
  await t.test("SEC-016: Sensitive mutations record audit trail with unforgeable server-verified identity", async () => {
    // Create an order via Admin
    const orderNo = `ORD-AUDIT-${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        customer: "Audit Trail Integrity User",
        nomorHP: "081288887777",
        layanan: "Perpanjangan STNK",
        nopol: "B 1234 AUD",
        payment: { totalBiaya: 450000, dibayar: 0 },
        // Attacker attempts to forge actor context in request body
        actor: {
          userId: "usr-1",
          userName: "Impersonated SVP",
          userRole: "administrator",
        },
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const orderData = (await createRes.json() as any).data;
    const resolvedOrderNo = orderData.orderNo;

    // Verify audit logs in repository: Actor context MUST be derived from verified JWT (Admin / usr-2)
    const logs = dbAuditRepository.getAll({ module: "Order" });
    const orderLog = logs.find((l) => (l.details && l.details.includes(resolvedOrderNo)) || (l.metadata && l.metadata.orderNo === resolvedOrderNo));
    assert.ok(orderLog, "Audit log must be created for order");
    assert.strictEqual(orderLog.userId, "usr-2", "Actor userId must be usr-2 (verified from JWT)");
    assert.strictEqual(orderLog.userName, "Admin Utama", "Actor userName must be Admin Utama (verified from JWT)");
    assert.strictEqual(orderLog.userRole, "admin", "Actor userRole must be admin (verified from JWT)");
  });

  server.close();
});
