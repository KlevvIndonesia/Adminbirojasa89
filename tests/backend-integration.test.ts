/**
 * Backend Integration Tests
 * Admin SUN89 — Biro Jasa Management System
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";

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

test("Backend API - Health check responds with 200 and ok status", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.database, "sqlite-connected");
  } finally {
    server.close();
  }
});

test("Backend API - Authentication: Login with valid credentials returns JWT token and user info", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@birojasa.com",
        password: "admin123",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token);
    assert.strictEqual(body.data.user.role, "admin");
    assert.strictEqual(body.data.user.email, "admin@birojasa.com");

    // Verify /api/auth/me with Bearer token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${body.data.token}` },
    });
    assert.strictEqual(meRes.status, 200);
    const meBody = await meRes.json() as any;
    assert.strictEqual(meBody.success, true);
    assert.strictEqual(meBody.data.email, "admin@birojasa.com");
  } finally {
    server.close();
  }
});

test("Backend API - Authentication: Invalid credentials return 401", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@birojasa.com",
        password: "wrongpassword",
      }),
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json() as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "INVALID_CREDENTIALS");
  } finally {
    server.close();
  }
});

test("Backend API - Orders: Retrieve active orders and query single order", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Anonymous access is blocked with 401
    const unauthRes = await fetch(`${baseUrl}/api/orders`);
    assert.strictEqual(unauthRes.status, 401);

    // 2. Login to get token
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@birojasa.com", password: "admin123" }),
    });
    const { data: { token } } = await loginRes.json() as any;

    // 3. Authenticated access succeeds with 200
    const res = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.success, true);
    assert.ok(body.data["Verifikasi"]);
    assert.ok(body.data["Dokumen Telah Diterima"]);

    const firstOrder = body.data["Verifikasi"][0];
    assert.ok(firstOrder);

    // Query single order by orderNo with authentication
    const singleRes = await fetch(`${baseUrl}/api/orders/${firstOrder.orderNo}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(singleRes.status, 200);
    const singleBody = await singleRes.json() as any;
    assert.strictEqual(singleBody.success, true);
    assert.strictEqual(singleBody.data.orderNo, firstOrder.orderNo);
  } finally {
    server.close();
  }
});

test("Backend API - Order Lifecycle: Create, advance, verify-payment, archive", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Login as Admin
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@birojasa.com", password: "admin123" }),
    });
    const { data: { token } } = await loginRes.json() as any;

    // 2. Create Order
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        customer: "PT Test Integrasi Express",
        nomorHP: "081299998888",
        layanan: "Mutasi Antar Samsat",
        nopol: "B 9999 EXP",
        totalEstimasi: 1850000,
        biayaJasa: 500000,
      }),
    });

    assert.strictEqual(createRes.status, 201);
    const createdBody = await createRes.json() as any;
    const newOrderNo = createdBody.data.orderNo;
    assert.strictEqual(createdBody.data.customer, "PT Test Integrasi Express");
    assert.strictEqual(createdBody.data.currentStageName, "Verifikasi");

    // 3. Verify Payment at Stage 1 (Penerimaan Berkas / Verifikasi Dokumen & Pembayaran)
    const verifyRes = await fetch(`${baseUrl}/api/orders/${newOrderNo}/verify-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        verifierName: "Kasir Test",
        buktiPembayaran: { fileUrl: "https://proof.example.com/transfer.jpg" },
      }),
    });
    assert.strictEqual(verifyRes.status, 200);
    const verBody = await verifyRes.json() as any;
    assert.strictEqual(verBody.data.payment.statusPembayaran, "Lunas");

    // 4. Advance to Stage 2: Penjadwalan
    const advanceRes = await fetch(`${baseUrl}/api/orders/${newOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetStage: "Penjadwalan",
        updates: { catatanOrder: "Berkas diverifikasi, siap dijadwalkan." },
      }),
    });
    assert.strictEqual(advanceRes.status, 200);
    const advBody = await advanceRes.json() as any;
    assert.strictEqual(advBody.data.currentStageName, "Penjadwalan");
    assert.strictEqual(advBody.data.currentStep, 2);

    // 5. Archive Order
    const archRes = await fetch(`${baseUrl}/api/orders/${newOrderNo}/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    assert.strictEqual(archRes.status, 200);
    const archBody = await archRes.json() as any;
    assert.strictEqual(archBody.success, true);
  } finally {
    server.close();
  }
});

test("Backend API - Pricing & Finance & Audit Logs endpoints operate properly", async (t) => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Anonymous access is blocked
    const unauthPricing = await fetch(`${baseUrl}/api/pricing/samsat`);
    assert.strictEqual(unauthPricing.status, 401);

    const unauthFin = await fetch(`${baseUrl}/api/finance/invoices`);
    assert.strictEqual(unauthFin.status, 401);

    // 2. Login as Administrator (SVP)
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "svp@birojasa.com", password: "admin123" }),
    });
    const { data: { token } } = await loginRes.json() as any;

    // 3. Pricing with auth succeeds
    const pricingRes = await fetch(`${baseUrl}/api/pricing/samsat`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(pricingRes.status, 200);
    const pricingBody = await pricingRes.json() as any;
    assert.strictEqual(pricingBody.success, true);
    assert.ok(pricingBody.data.length > 0);

    // 4. Finance Invoices with auth succeeds
    const finRes = await fetch(`${baseUrl}/api/finance/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(finRes.status, 200);
    const finBody = await finRes.json() as any;
    assert.strictEqual(finBody.success, true);
    assert.ok(finBody.data.length > 0);

    // 5. Audit Logs with auth succeeds
    const auditRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(auditRes.status, 200);
    const auditBody = await auditRes.json() as any;
    assert.strictEqual(auditBody.success, true);
    assert.ok(Array.isArray(auditBody.data));
  } finally {
    server.close();
  }
});
