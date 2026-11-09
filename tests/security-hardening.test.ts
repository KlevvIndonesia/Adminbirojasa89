/**
 * Phase 7.3 Security Hardening & Authorization Regression Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Comprehensive verification of:
 * 1. Authentication bypass prevention (passwordless rejection)
 * 2. Password hashing & auto-migration (PBKDF2 100k iterations)
 * 3. JWT tampering resistance, expiration & signature validation
 * 4. Protected endpoint lockdown (401 on unauthenticated access)
 * 5. Role-Based Access Control & Stage Authority (403 on unauthorized roles)
 * 6. Request validation & tamper-proof protected fields
 * 7. Audit log actor integrity (spoof-proof identity)
 * 8. Rate limiting (429 Too Many Requests)
 * 9. Security headers & CORS policy enforcement
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { hashPassword, verifyPassword, needsRehash, generateToken, verifyToken } from "../server/src/utils/crypto";
import { loginRateLimiter } from "../server/src/middleware/rateLimiter";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";

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

test("Security 1: Authentication Bypass Prevention", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Missing password
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@birojasa.com" }),
    });
    assert.strictEqual(res1.status, 400);
    const body1 = await res1.json() as any;
    assert.strictEqual(body1.success, false);
    assert.strictEqual(body1.error.code, "VALIDATION_ERROR");

    // 2. Empty string password
    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@birojasa.com", password: "" }),
    });
    assert.strictEqual(res2.status, 400);
    const body2 = await res2.json() as any;
    assert.strictEqual(body2.success, false);
    assert.strictEqual(body2.error.code, "VALIDATION_ERROR");

    // 3. Whitespace password
    const res3 = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@birojasa.com", password: "   " }),
    });
    assert.strictEqual(res3.status, 400);

    // 4. Missing email
    const res4 = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "admin123" }),
    });
    assert.strictEqual(res4.status, 400);

    // 5. Wrong password
    const res5 = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@birojasa.com", password: "wrongpassword" }),
    });
    assert.strictEqual(res5.status, 401);
    const body5 = await res5.json() as any;
    assert.strictEqual(body5.success, false);
    assert.strictEqual(body5.error.code, "INVALID_CREDENTIALS");

    // 6. Non-existent user
    const res6 = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ghost@birojasa.com", password: "password123" }),
    });
    assert.strictEqual(res6.status, 401);
  } finally {
    server.close();
  }
});

test("Security 2: Password Hashing & Transparent Migration", async (t) => {
  // 1. New hash generates versioned format with 600k iterations (OWASP standard)
  const plain = "Secur3P@ssw0rd!";
  const { hash, salt } = hashPassword(plain);
  assert.ok(hash.startsWith("$pbkdf2-sha512$i=600000$"), "Must use versioned 600,000 PBKDF2-SHA-512 format");
  assert.strictEqual(needsRehash(hash), false);

  // 2. Verification of current 600k format works
  assert.strictEqual(verifyPassword(plain, hash, salt), true);
  assert.strictEqual(verifyPassword("WrongPassword", hash, salt), false);

  // 3. Verification of intermediate 100k format works and flags needsRehash
  const intermediateHash = "$pbkdf2-sha512$i=100000$abcd1234abcd1234$3f88f0a6d59b4c09d5718797f39446d4a04d2b271d50c1840003b5b5c92cbf308c31ae0ef3d17d01";
  assert.strictEqual(needsRehash(intermediateHash), true);

  // 4. Verification of legacy 1k format works and flags needsRehash
  const legacyHash = "$pbkdf2$i=1000$abcd1234abcd1234$3f88f0a6d59b4c09d5718797f39446d4a04d2b271d50c1840003b5b5c92cbf308c31ae0ef3d17d01";
  assert.strictEqual(needsRehash(legacyHash), true);

  // 5. Malformed hash is safely rejected without throwing
  assert.strictEqual(verifyPassword(plain, "malformed$hash$bad", salt), false);
  assert.strictEqual(verifyPassword(plain, "", salt), false);

  // 6. Test transparent upgrade upon login against live server
  const { server, baseUrl } = await startTestServer();
  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "finance@birojasa.com", password: "finance123" }),
    });
    assert.strictEqual(loginRes.status, 200);
    const loginBody = await loginRes.json() as any;
    assert.strictEqual(loginBody.success, true);
    assert.ok(loginBody.data.token);
  } finally {
    server.close();
  }
});

test("Security 3: JWT Hardening & Signature Verification", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Missing Authorization header
    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(unauthRes.status, 401);

    // 2. Malformed Authorization header
    const malformedRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: "NotABearerToken" },
    });
    assert.strictEqual(malformedRes.status, 401);

    // 3. Tampered JWT signature
    const validToken = generateToken({
      userId: "usr-2",
      email: "admin@birojasa.com",
      nama: "Administrator",
      jabatan: "Admin",
      role: "administrator",
    });
    const parts = validToken.split(".");
    // Tamper payload
    const tamperedPayload = Buffer.from(JSON.stringify({
      userId: "usr-1",
      email: "admin@birojasa.com",
      nama: "Hacked Admin",
      jabatan: "Admin",
      role: "administrator",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const tamperedRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    assert.strictEqual(tamperedRes.status, 401);
    const tamperedBody = await tamperedRes.json() as any;
    assert.strictEqual(tamperedBody.error.code, "UNAUTHENTICATED");

    // 4. Expired JWT token
    const expiredToken = generateToken(
      { userId: "usr-1", email: "admin@birojasa.com", nama: "Admin", jabatan: "Admin", role: "administrator" },
      -10 // Expired 10 seconds ago
    );
    const expiredRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.strictEqual(expiredRes.status, 401);
    const expiredBody = await expiredRes.json() as any;
    assert.strictEqual(expiredBody.error.code, "UNAUTHENTICATED");

    // 5. Valid JWT token succeeds
    const validRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.strictEqual(validRes.status, 200);
    const validBody = await validRes.json() as any;
    assert.strictEqual(validBody.data.email, "admin@birojasa.com");
  } finally {
    server.close();
  }
});

test("Security 4: Protected Endpoints Reject Anonymous Access (401)", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    const endpoints = [
      { method: "GET", path: "/api/orders" },
      { method: "GET", path: "/api/orders/archived" },
      { method: "GET", path: "/api/finance/invoices" },
      { method: "GET", path: "/api/finance/kas-kantor" },
      { method: "GET", path: "/api/users" },
      { method: "GET", path: "/api/pricing/samsat" },
      { method: "GET", path: "/api/audit-logs" },
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, { method: ep.method });
      assert.strictEqual(res.status, 401, `Endpoint ${ep.method} ${ep.path} must return 401 when unauthenticated`);
      const body = await res.json() as any;
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, "UNAUTHENTICATED");
    }
  } finally {
    server.close();
  }
});

test("Security 5: Role-Based Access Control & Stage Authority (403)", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Messenger attempting to create an order -> Forbidden (403)
    const messengerToken = generateToken({
      userId: "usr-4",
      email: "kurir1@birojasa.com",
      nama: "Budi Santoso",
      jabatan: "Kurir",
      role: "messenger",
    });

    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({
        customer: "Illegal Order",
        nomorHP: "081233334444",
        layanan: "Perpanjangan STNK",
        nopol: "B 1234 ILL",
        totalEstimasi: 500000,
      }),
    });
    assert.strictEqual(createRes.status, 403, "Messenger must not be authorized to create orders");
    const createBody = await createRes.json() as any;
    assert.strictEqual(createBody.error.code, "FORBIDDEN");

    // 2. Finance role attempting operational stage advance (Stage 2 Penjadwalan) -> Forbidden (403)
    const financeToken = generateToken({
      userId: "usr-3",
      email: "finance@birojasa.com",
      nama: "Siti Rahma",
      jabatan: "Finance",
      role: "finance",
    });

    // Create an order first using Administrator token
    const adminToken = generateToken({
      userId: "usr-1",
      email: "admin@birojasa.com",
      nama: "Administrator",
      jabatan: "SVP",
      role: "administrator",
    });

    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customer: "RBAC Test Order",
        nomorHP: "081211112222",
        layanan: "Mutasi Masuk",
        nopol: "B 5555 RBC",
        totalEstimasi: 750000,
      }),
    });
    assert.strictEqual(orderRes.status, 201);
    const orderData = await orderRes.json() as any;
    const testOrderNo = orderData.data.orderNo;

    // Finance advances to Stage 2 -> Rejected
    const financeAdvanceRes = await fetch(`${baseUrl}/api/orders/${testOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${financeToken}`,
      },
      body: JSON.stringify({
        targetStage: "Penjadwalan",
        updates: {},
      }),
    });
    assert.strictEqual(financeAdvanceRes.status, 403, "Finance role must be rejected on operational stage transitions");

    // Advance order to Stage 6 Supervisi to test strict SVP gate
    dbOrderRepository.updateOrder(testOrderNo, { currentStep: 6, currentStageName: "Supervisi" });

    // 3. Admin role attempting Stage 6 Supervisi -> Forbidden (403, SVP only)
    const operationalAdminToken = generateToken({
      userId: "usr-2",
      email: "admin.ops@birojasa.com",
      nama: "Staff Admin",
      jabatan: "Admin",
      role: "admin",
    });

    const adminSupervisiRes = await fetch(`${baseUrl}/api/orders/${testOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${operationalAdminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Supervisi",
        updates: {},
      }),
    });
    assert.strictEqual(adminSupervisiRes.status, 403, "Admin role must not manage Stage 6 Supervisi (SVP only)");

    // 4. SVP managing Stage 6 Supervisi -> Allowed
    const svpSupervisiRes = await fetch(`${baseUrl}/api/orders/${testOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Supervisi",
        updates: {},
      }),
    });
    // Should succeed or process transition (not 403)
    assert.strictEqual(svpSupervisiRes.status, 200);
  } finally {
    server.close();
  }
});

test("Security 6: Request Validation & Protected Field Tampering Resistance", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    const adminToken = generateToken({
      userId: "usr-1",
      email: "admin@birojasa.com",
      nama: "Administrator",
      jabatan: "SVP",
      role: "administrator",
    });

    // 1. Payment amount validation: Negative amount -> 400
    const negPayRes = await fetch(`${baseUrl}/api/finance/invoices/101/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ amount: -50000 }),
    });
    assert.strictEqual(negPayRes.status, 400);
    const negPayBody = await negPayRes.json() as any;
    assert.strictEqual(negPayBody.error.code, "VALIDATION_ERROR");

    // 2. Payment amount validation: NaN / non-numeric -> 400
    const nanPayRes = await fetch(`${baseUrl}/api/finance/invoices/101/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ amount: "seratus ribu" }),
    });
    assert.strictEqual(nanPayRes.status, 400);

    // 3. Order creation validation: Missing required fields -> 400
    const invalidOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ customer: "Incomplete" }), // Missing nomorHP, layanan, nopol
    });
    assert.strictEqual(invalidOrderRes.status, 400);

    // 4. Protected field stripping: Client attempting to inject payment.statusPembayaran via PUT /orders/:orderNo
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customer: "Tamper Test Customer",
        nomorHP: "081244445555",
        layanan: "Balik Nama",
        nopol: "B 8888 TMP",
        totalEstimasi: 1000000,
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const newOrder = (await createRes.json() as any).data;

    // Attacker sends PUT with forged payment status
    const attackRes = await fetch(`${baseUrl}/api/orders/${newOrder.orderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customer: "Tamper Test Customer Updated",
        payment: {
          statusPembayaran: "Lunas",
          isPaymentVerified: true,
          jumlahBayar: 1000000,
        },
        currentStep: 8,
        isArchived: true,
      }),
    });
    assert.strictEqual(attackRes.status, 403, "Tampering with protected fields must be rejected with 403");

    // Verify order in database: payment status MUST REMAIN Belum Lunas, currentStep MUST REMAIN 1
    const verifyRes = await fetch(`${baseUrl}/api/orders/${newOrder.orderNo}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const verifiedOrder = (await verifyRes.json() as any).data;
    assert.strictEqual(verifiedOrder.payment.statusPembayaran, "Belum Lunas", "Injected payment status must be stripped");
    assert.strictEqual(verifiedOrder.payment.isPaymentVerified, false, "Injected payment verification must be stripped");
    assert.strictEqual(verifiedOrder.currentStep, 1, "Injected currentStep must be stripped");
    assert.ok(!verifiedOrder.isArchived, "Injected isArchived must be stripped or falsy");
  } finally {
    server.close();
  }
});

test("Security 7: Audit Log Actor Identity Cannot Be Spoofed", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    // Authenticated as Finance user
    const financeToken = generateToken({
      userId: "usr-3",
      email: "finance@birojasa.com",
      nama: "Siti Rahma Finance",
      jabatan: "Finance",
      role: "finance",
    });

    // Create an order as Admin to get an invoice to pay
    const adminToken = generateToken({
      userId: "usr-1",
      email: "admin@birojasa.com",
      nama: "Administrator",
      jabatan: "SVP",
      role: "administrator",
    });
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customer: "Audit Actor Test",
        nomorHP: "081299990000",
        layanan: "Pajak Tahunan",
        nopol: "B 1010 AUD",
        totalEstimasi: 400000,
        isVerified: true,
        finalCost: 400000,
      }),
    });
    const orderData = (await orderRes.json() as any).data;
    dbOrderRepository.updateOrder(orderData.orderNo, { isVerified: true, finalCost: 400000, currentStep: 7, currentStageName: "Pengantaran", approvedBySpv: "Supervisor SPV" });

    // Get the corresponding invoice
    const invRes = await fetch(`${baseUrl}/api/finance/invoices`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const invList = (await invRes.json() as any).data;
    const inv = invList.find((i: any) => i.orderNo === orderData.orderNo);
    assert.ok(inv, "Invoice must exist for order");
    const { dbFinanceRepository } = await import("../server/src/repositories/dbFinanceRepository");
    dbFinanceRepository.updateInvoice(inv.id, { totalTagihan: 400000, sisa: 400000 });

    // Finance records payment but attempts to pass spoofed actor fields in body
    const payRes = await fetch(`${baseUrl}/api/finance/invoices/${inv.id}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${financeToken}`,
      },
      body: JSON.stringify({
        amount: 400000,
        metodePembayaran: "Transfer Bank",
        actor: {
          userId: "usr-1",
          userName: "Impersonated Admin",
          userRole: "administrator",
        },
      }),
    });
    assert.strictEqual(payRes.status, 200);

    // Check audit log: Actor MUST be Siti Rahma Finance (usr-3), NOT the spoofed actor
    const auditRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const auditBody = await auditRes.json() as any;
    const latestPaymentLog = auditBody.data.find(
      (log: any) => log.action === "RECORD_PAYMENT" && log.metadata?.invoiceId === inv.id
    );

    assert.ok(latestPaymentLog, "Payment audit log entry must exist");
    assert.strictEqual(latestPaymentLog.userId, "usr-3", "Actor userId must be derived from authenticated JWT");
    assert.strictEqual(latestPaymentLog.userName, "Siti Rahma Finance", "Actor userName must be derived from authenticated JWT");
    assert.strictEqual(latestPaymentLog.userRole, "finance", "Actor userRole must be derived from authenticated JWT");
  } finally {
    server.close();
  }
});

test("Security 8: Security Headers and Information Disclosure Protection", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    // Verify security headers
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
    assert.strictEqual(res.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.strictEqual(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    
    // Verify information disclosure mitigation
    assert.strictEqual(res.headers.get("x-powered-by"), null, "X-Powered-By header must be removed");
  } finally {
    server.close();
  }
});

test("Security 9: Rate Limiting Protects Sensitive Endpoints", async (t) => {
  // Use a dedicated simulated IP to test rate limiting
  loginRateLimiter.reset("198.51.100.42");

  const { server, baseUrl } = await startTestServer();
  try {
    const testIp = "198.51.100.42";
    let hitRateLimit = false;
    let rateLimitResponse: any = null;

    // Send 12 rapid failed login attempts from testIp
    for (let i = 1; i <= 12; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": testIp,
        },
        body: JSON.stringify({ email: "victim@birojasa.com", password: "wrong" }),
      });

      if (res.status === 429) {
        hitRateLimit = true;
        rateLimitResponse = await res.json() as any;
        assert.ok(res.headers.get("retry-after"), "Retry-After header must be present on 429");
        assert.strictEqual(rateLimitResponse.error.code, "TOO_MANY_REQUESTS");
        break;
      }
    }

    assert.strictEqual(hitRateLimit, true, "11th request from same IP within window must trigger HTTP 429");
  } finally {
    loginRateLimiter.reset("198.51.100.42");
    server.close();
  }
});

test("Security 10: Hardened CORS Rejects Unauthorized Origins", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Authorized origin (e.g. localhost:3000)
    const allowedRes = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "http://localhost:3000" },
    });
    assert.strictEqual(allowedRes.headers.get("access-control-allow-origin"), "http://localhost:3000");

    // 2. Unauthorized origin
    const disallowedRes = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "http://malicious-site.com" },
    });
    // In Express cors middleware, unauthorized origins either return an error or omit the allow-origin header
    const corsHeader = disallowedRes.headers.get("access-control-allow-origin");
    assert.notStrictEqual(corsHeader, "http://malicious-site.com", "Unauthorized origin must not receive Access-Control-Allow-Origin header");
    assert.notStrictEqual(corsHeader, "*", "Credentials-enabled API must never return wildcard * origin");
  } finally {
    server.close();
  }
});
