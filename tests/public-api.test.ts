/**
 * Public Customer API Integration & Security Test Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. Public Master Data APIs (services, samsat, pricing)
 * 2. Public Order Creation (validation, anti-tampering, idempotency, upload)
 * 3. Public Order Tracking (nopol search, format normalisation, privacy sanitization, detail timeline)
 * 4. Security & Isolation (SQL injection safety, anonymous boundaries, rate limit headers)
 * 5. Admin Regression (admin auth and operations remain uncompromised)
 */

import test, { before, after } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { db } from "../server/src/database/db";

let server: http.Server;
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => {
    const app = createApp();
    server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

after(() => {
  if (server) {
    server.close();
  }
});

// Minimal valid 1x1 JPEG buffer for binary file upload testing
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
  0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda,
  0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
]);

// ─────────────────────────────────────────────────────────────────────────────
// 1. PUBLIC MASTER DATA TESTS
// ─────────────────────────────────────────────────────────────────────────────

test("Public Master Data - GET /api/v1/public/services returns only active services with sanitized metadata", async () => {
  const res = await fetch(`${baseUrl}/api/v1/public/services`);
  assert.strictEqual(res.status, 200);

  const body = await res.json() as any;
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);

  // Verify properties of first service
  const first = body.data[0];
  assert.ok(first.serviceId);
  assert.ok(first.serviceName);
  assert.ok(first.kodeLayanan);
  assert.strictEqual(typeof first.memerlukanSamsatTujuan, "boolean");
  assert.ok(Array.isArray(first.persyaratan));

  // Ensure no sensitive internal fields leaked
  assert.strictEqual((first as any).commission, undefined);
  assert.strictEqual((first as any).profit_margin, undefined);
  assert.strictEqual((first as any).internal_cost, undefined);
});

test("Public Master Data - GET /api/v1/public/samsat returns active canonical Samsat offices", async () => {
  const res = await fetch(`${baseUrl}/api/v1/public/samsat`);
  assert.strictEqual(res.status, 200);

  const body = await res.json() as any;
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);

  const first = body.data[0];
  assert.ok(first.samsatId);
  assert.ok(first.namaSamsat);
  assert.ok(first.wilayah);

  // Test search filter
  const searchRes = await fetch(`${baseUrl}/api/v1/public/samsat?search=jakarta`);
  assert.strictEqual(searchRes.status, 200);
  const searchBody = await searchRes.json() as any;
  assert.ok(searchBody.data.length > 0);
  assert.ok(searchBody.data.every((o: any) =>
    o.namaSamsat.toLowerCase().includes("jakarta") ||
    o.wilayah.toLowerCase().includes("jakarta") ||
    o.provinsi.toLowerCase().includes("jakarta")
  ));
});

test("Public Master Data - GET /api/v1/public/pricing returns safe price estimate without internal margin leaks", async () => {
  // 1. Catalog without query
  const catalogRes = await fetch(`${baseUrl}/api/v1/public/pricing`);
  assert.strictEqual(catalogRes.status, 200);
  const catalogBody = await catalogRes.json() as any;
  assert.strictEqual(catalogBody.success, true);
  assert.ok(Array.isArray(catalogBody.data.services));
  assert.ok(catalogBody.data.catatan);

  // 2. Estimate for specific service
  const estimateRes = await fetch(`${baseUrl}/api/v1/public/pricing?serviceId=svc-perp-1th&samsatId=samsat-jakarta-timur`);
  assert.strictEqual(estimateRes.status, 200);
  const estBody = await estimateRes.json() as any;
  assert.strictEqual(estBody.success, true);
  assert.strictEqual(estBody.data.serviceId, "svc-perp-1th");
  assert.ok(estBody.data.estimasiBiayaJasa > 0);
  assert.ok(estBody.data.totalEstimasiAwal > 0);
  assert.strictEqual((estBody.data as any).margin, undefined);
  assert.strictEqual((estBody.data as any).komisi, undefined);
  assert.strictEqual((estBody.data as any).internalCost, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PUBLIC ORDER CREATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

test("Public Order Creation - Successfully creates valid customer order with anti-tampering protection", async () => {
  const payload = {
    customer: "Ahmad Dahlan",
    nomorHP: "081234567890",
    serviceId: "svc-perp-1th",
    nopol: "B 1001 KZZ",
    wilayahSamsatAsal: "Jakarta Timur",
    tipeKendaraan: "Mobil",
    metodeLayanan: "Antar Jemput",
    alamatPenjemputan: "Jl. Tebet Barat Dalam No. 12",
    catatan: "Harap jemput pagi hari jam 09.00.",
    // Attempt to tamper with price and stage (client manipulation attack)
    biayaJasa: 1000,
    totalBiaya: 1000,
    paymentStatus: "Lunas",
    currentStep: 6,
    currentStageName: "Dokumen Telah Diterima",
  };

  const res = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json() as any;
  assert.strictEqual(body.success, true);
  assert.ok(body.data.orderNo);
  assert.ok(body.data.noInvoice);
  assert.strictEqual(body.data.customer, "Ahmad Dahlan");
  assert.strictEqual(body.data.nopol, "B 1001 KZZ");
  assert.strictEqual(body.data.currentStep, 1); // Anti-tampering: Step 1 enforced
  assert.strictEqual(body.data.currentStageName, "Verifikasi"); // Anti-tampering: Stage Verifikasi enforced
  assert.strictEqual(body.data.paymentStatus, "Belum Lunas"); // Anti-tampering: Belum Lunas enforced
  assert.ok(body.data.estimasiBiayaJasa > 0); // Anti-tampering: Server canonical price enforced
  assert.ok(body.data.totalEstimasiAwal > 0);

  // Verify order in database
  const dbRow = db.prepare("SELECT * FROM orders WHERE order_no = ?").get(body.data.orderNo) as any;
  assert.ok(dbRow);
  assert.strictEqual(dbRow.nopol, "B 1001 KZZ");
  assert.strictEqual(dbRow.current_step, 1);
});

test("Public Order Creation - Idempotency prevents duplicate order on repeated request", async () => {
  const idempotencyKey = `PUB-IDEM-${Date.now()}`;
  const payload = {
    customer: "Siti Rahma",
    nomorHP: "081987654321",
    serviceId: "svc-perp-1th",
    nopol: "B 2002 KZZ",
    wilayahSamsatAsal: "Jakarta Timur",
    clientRequestId: idempotencyKey,
  };

  // First request
  const res1 = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  assert.strictEqual(res1.status, 201);
  const body1 = await res1.json() as any;
  const initialOrderNo = body1.data.orderNo;

  // Second request with exact same idempotency key
  const res2 = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  assert.strictEqual(res2.status, 201);
  const body2 = await res2.json() as any;

  // Both must return the same order number without duplicating rows
  assert.strictEqual(body2.data.orderNo, initialOrderNo);

  // Count in DB
  const count = db.prepare("SELECT COUNT(*) as count FROM orders WHERE nopol = 'B 2002 KZZ'").get() as any;
  assert.strictEqual(count.count, 1);
});

test("Public Order Creation - Validation rejects missing inputs, invalid phones, and inactive services", async () => {
  // 1. Missing customer name
  const resMissingName = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nomorHP: "081234567890",
      serviceId: "svc-perp-1th",
      nopol: "B 3003 KZZ",
    }),
  });
  assert.strictEqual(resMissingName.status, 400);

  // 2. Invalid phone format
  const resInvalidPhone = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Invalid Phone Tester",
      nomorHP: "12345",
      serviceId: "svc-perp-1th",
      nopol: "B 3003 KZZ",
    }),
  });
  assert.strictEqual(resInvalidPhone.status, 400);

  // 3. Non-existent service
  const resBadService = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Bad Service Tester",
      nomorHP: "081234567890",
      serviceId: "svc-non-existent-xyz",
      nopol: "B 3003 KZZ",
      wilayahSamsatAsal: "Jakarta Timur",
    }),
  });
  assert.strictEqual(resBadService.status, 400);

  // 4. Mutasi service requiring Samsat Tujuan when omitted
  const resMutasiMissingTujuan = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Mutasi Tester",
      nomorHP: "081234567890",
      serviceId: "svc-mut-antar",
      nopol: "B 3003 KZZ",
      wilayahSamsatAsal: "Jakarta Timur",
      // samsatTujuan missing
    }),
  });
  assert.strictEqual(resMutasiMissingTujuan.status, 400);
});

test("Public Order Creation - Multipart upload saves valid document and links it to order", async () => {
  // Construct multipart form-data payload using standard boundaries
  const boundary = "----WebKitFormBoundaryPublicApiTest" + Date.now();
  const parts: Buffer[] = [];

  const addField = (name: string, val: string) => {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${val}\r\n`));
  };

  const addFile = (name: string, filename: string, mime: string, content: Buffer) => {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`));
    parts.push(content);
    parts.push(Buffer.from("\r\n"));
  };

  addField("customer", "Bambang Pamungkas");
  addField("nomorHP", "081122334455");
  addField("serviceId", "svc-perp-1th");
  addField("nopol", "B 4004 KZZ");
  addField("wilayahSamsatAsal", "Jakarta Timur");
  addFile("files", "stnk_asli.jpg", "image/jpeg", VALID_JPEG_BUFFER);

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const multipartBody = Buffer.concat(parts);

  const res = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json() as any;
  assert.strictEqual(body.success, true);
  assert.ok(body.data.orderNo);
  assert.strictEqual(body.data.documentsAttached, 1);

  // Verify document was linked in database
  const docRow = db.prepare("SELECT * FROM documents WHERE order_no = ?").get(body.data.orderNo) as any;
  assert.ok(docRow);
  assert.strictEqual(docRow.order_no, body.data.orderNo);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PUBLIC ORDER TRACKING TESTS
// ─────────────────────────────────────────────────────────────────────────────

test("Public Order Tracking - Nopol search normalizes format variations and returns matching order", async () => {
  // 1. Create test order with canonical plate B 5005 ABC
  await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Tracking User",
      nomorHP: "081334455667",
      serviceId: "svc-perp-1th",
      nopol: "B 5005 ABC",
      wilayahSamsatAsal: "Jakarta Timur",
    }),
  });

  // 2. Query variations:
  // a. Standard format "B 5005 ABC"
  const res1 = await fetch(`${baseUrl}/api/v1/public/orders/tracking?nopol=B%205005%20ABC`);
  assert.strictEqual(res1.status, 200);
  const body1 = await res1.json() as any;
  assert.ok(body1.data.length >= 1);
  assert.strictEqual(body1.data[0].nopol, "B 5005 ABC");

  // b. Lowercase without spaces "b5005abc"
  const res2 = await fetch(`${baseUrl}/api/v1/public/orders/tracking?nopol=b5005abc`);
  assert.strictEqual(res2.status, 200);
  const body2 = await res2.json() as any;
  assert.ok(body2.data.length >= 1);
  assert.strictEqual(body2.data[0].nopol, "B 5005 ABC");

  // c. Dashed format "B-5005-ABC"
  const res3 = await fetch(`${baseUrl}/api/v1/public/orders/tracking?nopol=B-5005-ABC`);
  assert.strictEqual(res3.status, 200);
  const body3 = await res3.json() as any;
  assert.ok(body3.data.length >= 1);
  assert.strictEqual(body3.data[0].nopol, "B 5005 ABC");
});

test("Public Order Tracking - Multiple orders for same nopol returned sorted latest first", async () => {
  const targetNopol = "B 6006 XYZ";

  // Create Order 1
  const res1 = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Client Repeat 1",
      nomorHP: "081334455667",
      serviceId: "svc-perp-1th",
      nopol: targetNopol,
      wilayahSamsatAsal: "Jakarta Timur",
    }),
  });
  const order1 = (await res1.json() as any).data.orderNo;

  // Create Order 2
  const res2 = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Client Repeat 2",
      nomorHP: "081334455667",
      serviceId: "svc-balik-nama",
      nopol: targetNopol,
      wilayahSamsatAsal: "Jakarta Timur",
    }),
  });
  const order2 = (await res2.json() as any).data.orderNo;

  // Query tracking
  const trackRes = await fetch(`${baseUrl}/api/v1/public/orders/tracking?nopol=${encodeURIComponent(targetNopol)}`);
  assert.strictEqual(trackRes.status, 200);
  const trackBody = await trackRes.json() as any;

  assert.ok(trackBody.data.length >= 2);
  // Latest order should appear first
  assert.strictEqual(trackBody.data[0].orderNo, order2);
  assert.strictEqual(trackBody.data[1].orderNo, order1);
});

test("Public Order Tracking - Non-existent nopol returns consistent empty array without leaking info", async () => {
  const res = await fetch(`${baseUrl}/api/v1/public/orders/tracking?nopol=B9999UNKNOWN`);
  assert.strictEqual(res.status, 200);

  const body = await res.json() as any;
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.strictEqual(body.data.length, 0);
});

test("Public Order Tracking - Strict privacy verification: No PII, employee, or internal data leakage", async () => {
  const nopol = "B 7007 PRV";
  const createRes = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Rahasia Negara",
      nomorHP: "081299887766",
      serviceId: "svc-perp-1th",
      nopol,
      wilayahSamsatAsal: "Jakarta Timur",
    }),
  });
  const created = (await createRes.json() as any).data;

  const trackRes = await fetch(`${baseUrl}/api/v1/public/orders/tracking?nopol=${encodeURIComponent(nopol)}`);
  const trackBody = await trackRes.json() as any;
  const item = trackBody.data[0];

  // Assert absence of private data
  assert.strictEqual(item.customer, undefined, "Customer full name must be stripped");
  assert.strictEqual(item.nomorHP, undefined, "Phone number must be stripped");
  assert.strictEqual(item.nik, undefined, "NIK must not be present");
  assert.strictEqual(item.catatanInternal, undefined, "Internal notes must not be present");
  assert.strictEqual(item.employee, undefined, "Employee info must not be present");
  assert.strictEqual(item.messenger, undefined, "Messenger info must not be present");
  assert.strictEqual(item.profit, undefined, "Profit margin must not be present");
  assert.strictEqual(item.biayaSamsat, undefined, "Samsat cost details must not be present");

  // Detail Tracking privacy verification with mandatory nopol
  const detailRes = await fetch(`${baseUrl}/api/v1/public/orders/${created.orderNo}/tracking?nopol=${encodeURIComponent(nopol)}`);
  assert.strictEqual(detailRes.status, 200);
  const detailBody = await detailRes.json() as any;
  const detail = detailBody.data;

  assert.strictEqual(detail.customer, undefined);
  assert.strictEqual(detail.nomorHP, undefined);
  assert.strictEqual(detail.nik, undefined);
  assert.ok(Array.isArray(detail.timeline));
  assert.strictEqual(detail.timeline.length, 6);
});

test("Public Order Tracking - Detail tracking returns 404 for non-existent order number", async () => {
  const res = await fetch(`${baseUrl}/api/v1/public/orders/ORD-9999-999/tracking?nopol=B1234XYZ`);
  assert.strictEqual(res.status, 404);

  const body = await res.json() as any;
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, "ORDER_NOT_FOUND");
  assert.strictEqual(body.error.message, "Order tidak ditemukan atau informasi verifikasi nomor polisi tidak sesuai.");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SECURITY & ISOLATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

test("Security - Parameterized SQL prevents SQL injection attacks in nopol tracking", async () => {
  const sqlInjectionQuery = "' OR '1'='1";
  const res = await fetch(`${baseUrl}/api/v1/public/orders/tracking?nopol=${encodeURIComponent(sqlInjectionQuery)}`);
  assert.strictEqual(res.status, 200);

  const body = await res.json() as any;
  assert.strictEqual(body.success, true);
  // Must return empty array, NOT all orders from the database
  assert.strictEqual(body.data.length, 0);
});

test("Security - Rate limiting headers are present and valid", async () => {
  const res = await fetch(`${baseUrl}/api/v1/public/services`);
  assert.strictEqual(res.status, 200);

  // Assert sliding-window rate limit headers
  assert.ok(res.headers.has("x-ratelimit-limit"), "X-RateLimit-Limit header must be present");
  assert.ok(res.headers.has("x-ratelimit-remaining"), "X-RateLimit-Remaining header must be present");
  assert.ok(res.headers.has("x-ratelimit-reset"), "X-RateLimit-Reset header must be present");
});

test("Security - Unauthenticated access to internal Admin API remains strictly protected", async () => {
  const res = await fetch(`${baseUrl}/api/orders`);
  assert.strictEqual(res.status, 401);

  const body = await res.json() as any;
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, "UNAUTHENTICATED");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ADMIN REGRESSION TESTS
// ─────────────────────────────────────────────────────────────────────────────

async function getAdminToken(): Promise<string> {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "svp@birojasa.com",
      password: "admin123",
    }),
  });
  const loginBody = await loginRes.json() as any;
  return loginBody.data.token;
}

test("Admin Regression - Admin login and internal order management remain operational", async () => {
  const adminToken = await getAdminToken();
  assert.ok(adminToken);

  // 2. Query orders through Admin API with Bearer token
  const ordersRes = await fetch(`${baseUrl}/api/orders`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(ordersRes.status, 200);
  const ordersBody = await ordersRes.json() as any;
  assert.strictEqual(ordersBody.success, true);
  assert.ok(ordersBody.data);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUB-01: SEMANTIC WORKFLOW STAGE MAPPING TESTS
// ─────────────────────────────────────────────────────────────────────────────

test("PUB-01: Stage mapping correctly separates internal steps 5, 6, 7, and 8", async () => {
  const adminToken = await getAdminToken();
  const nopol = "B 5566 STG";

  // 1. Create order
  const createRes = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Workflow Tester",
      nomorHP: "081234567890",
      serviceId: "svc-perp-1th",
      nopol,
      wilayahSamsatAsal: "Jakarta Timur",
      metodeLayanan: "Antar Jemput",
    }),
  });
  assert.strictEqual(createRes.status, 201);
  const order = (await createRes.json() as any).data;
  const orderNo = order.orderNo;

  // Initial Step 1 (Verifikasi)
  let trackRes = await fetch(`${baseUrl}/api/v1/public/orders/${orderNo}/tracking?nopol=${nopol}`);
  let trackData = (await trackRes.json() as any).data;
  assert.strictEqual(trackData.currentStep, 1);
  assert.strictEqual(trackData.publicStageName, "Verifikasi");
  assert.strictEqual(trackData.statusPengerjaan, "Diproses");
  assert.strictEqual(trackData.isCompleted, false);
  assert.strictEqual(trackData.timeline[0].status, "IN_PROGRESS");
  assert.strictEqual(trackData.timeline[4].status, "WAITING"); // Step 5 (Pengantaran)

  // Advance to Step 2 (Penjadwalan)
  await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ targetStage: "Penjadwalan" }),
  });
  trackRes = await fetch(`${baseUrl}/api/v1/public/orders/${orderNo}/tracking?nopol=${nopol}`);
  trackData = (await trackRes.json() as any).data;
  assert.strictEqual(trackData.publicStageName, "Penjadwalan");
  assert.strictEqual(trackData.timeline[0].status, "COMPLETED");
  assert.strictEqual(trackData.timeline[1].status, "IN_PROGRESS");

  // Advance to Step 3 (Verifikasi Dokumen)
  await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ targetStage: "Verifikasi Dokumen", updates: { pickupCompleted: true } }),
  });
  trackRes = await fetch(`${baseUrl}/api/v1/public/orders/${orderNo}/tracking?nopol=${nopol}`);
  trackData = (await trackRes.json() as any).data;
  assert.strictEqual(trackData.publicStageName, "Verifikasi Dokumen");
  assert.strictEqual(trackData.timeline[2].status, "IN_PROGRESS");

  // Advance to Step 4 (Proses Samsat)
  await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ targetStage: "Proses Samsat", updates: { documentsVerified: true } }),
  });
  trackRes = await fetch(`${baseUrl}/api/v1/public/orders/${orderNo}/tracking?nopol=${nopol}`);
  trackData = (await trackRes.json() as any).data;
  assert.strictEqual(trackData.publicStageName, "Proses Samsat");
  assert.strictEqual(trackData.timeline[3].status, "IN_PROGRESS");
  assert.strictEqual(trackData.timeline[4].status, "WAITING");

  // Advance to Step 5 (Verifikasi Ulang)
  // CRITICAL REQUIREMENT: Step 5 must NOT show as Pengantaran or Completed!
  await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetStage: "Verifikasi Ulang",
      updates: {
        samsatProcesses: [{ id: "p1", name: "Cek Fisik", status: "COMPLETED" }],
      },
    }),
  });
  trackRes = await fetch(`${baseUrl}/api/v1/public/orders/${orderNo}/tracking?nopol=${nopol}`);
  trackData = (await trackRes.json() as any).data;
  assert.strictEqual(trackData.publicStageName, "Proses Samsat selesai, pemeriksaan ulang di kantor");
  assert.strictEqual(trackData.statusPengerjaan, "Diproses");
  assert.strictEqual(trackData.isCompleted, false);
  assert.strictEqual(trackData.timeline[3].status, "COMPLETED"); // Samsat completed
  assert.strictEqual(trackData.timeline[4].status, "WAITING", "Step 5 (Pengantaran) MUST remain WAITING during internal Verifikasi Ulang");
  assert.strictEqual(trackData.timeline[5].status, "WAITING", "Step 6 (Selesai) MUST remain WAITING");

  // Advance to Step 6 (Supervisi)
  // CRITICAL REQUIREMENT: Step 6 must NOT show as Selesai or Pengantaran!
  await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetStage: "Supervisi",
      updates: { documentsVerified: true },
    }),
  });
  trackRes = await fetch(`${baseUrl}/api/v1/public/orders/${orderNo}/tracking?nopol=${nopol}`);
  trackData = (await trackRes.json() as any).data;
  assert.strictEqual(trackData.publicStageName, "Menunggu persetujuan supervisi di kantor");
  assert.strictEqual(trackData.statusPengerjaan, "Diproses");
  assert.strictEqual(trackData.isCompleted, false, "Step 6 (Supervisi) MUST NOT be marked isCompleted=true");
  assert.strictEqual(trackData.timeline[4].status, "WAITING");
  assert.strictEqual(trackData.timeline[5].status, "WAITING");

  // Advance to Step 7 (Pengantaran)
  // CRITICAL REQUIREMENT: Step 7 shows Pengantaran IN_PROGRESS, but NOT Dokumen Telah Diterima!
  await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetStage: "Pengantaran",
      updates: { approvedBySpv: true },
    }),
  });
  trackRes = await fetch(`${baseUrl}/api/v1/public/orders/${orderNo}/tracking?nopol=${nopol}`);
  trackData = (await trackRes.json() as any).data;
  assert.strictEqual(trackData.publicStageName, "Pengantaran sedang berlangsung");
  assert.strictEqual(trackData.statusPengerjaan, "Diproses");
  assert.strictEqual(trackData.isCompleted, false, "Step 7 (Pengantaran) MUST NOT be marked isCompleted=true");
  assert.strictEqual(trackData.timeline[4].status, "IN_PROGRESS", "Step 5 (Pengantaran) is now IN_PROGRESS");
  assert.strictEqual(trackData.timeline[5].status, "WAITING", "Step 6 (Selesai) MUST remain WAITING during delivery");

  // Rollback from Step 7 to Step 6
  // CRITICAL REQUIREMENT: Rollback properly reverts Pengantaran to WAITING and clears waktuSelesai
  await fetch(`${baseUrl}/api/orders/${orderNo}/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ targetStage: "Supervisi", alasan: "Pemeriksaan ulang berkas fisik" }),
  });
  trackRes = await fetch(`${baseUrl}/api/v1/public/orders/${orderNo}/tracking?nopol=${nopol}`);
  trackData = (await trackRes.json() as any).data;
  assert.strictEqual(trackData.publicStageName, "Menunggu persetujuan supervisi di kantor");
  assert.strictEqual(trackData.timeline[4].status, "WAITING", "Step 5 (Pengantaran) MUST revert to WAITING after rollback");
  assert.strictEqual(trackData.timeline[4].waktuSelesai, null);
  assert.strictEqual(trackData.isCompleted, false);

  // Re-advance to Step 7 and advance to Step 8 (Dokumen Telah Diterima)
  await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetStage: "Pengantaran",
      updates: { approvedBySpv: true },
    }),
  });
  await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ targetStage: "Dokumen Telah Diterima", updates: { deliveryCompleted: true } }),
  });
  trackRes = await fetch(`${baseUrl}/api/v1/public/orders/${orderNo}/tracking?nopol=${nopol}`);
  trackData = (await trackRes.json() as any).data;
  assert.strictEqual(trackData.publicStageName, "Selesai");
  assert.strictEqual(trackData.statusPengerjaan, "Selesai");
  assert.strictEqual(trackData.isCompleted, true, "Step 8 must mark isCompleted=true");
  assert.ok(trackData.timeline.every((t: any) => t.status === "COMPLETED"));
});

test("PUB-01: Support Datang Langsung, cancellation, and historical order representation", async () => {
  const adminToken = await getAdminToken();

  // 1. Datang Langsung order
  const createDLRes = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Pelanggan Loket",
      nomorHP: "081299998888",
      serviceId: "svc-perp-1th",
      nopol: "B 8899 DLK",
      wilayahSamsatAsal: "Jakarta Timur",
      metodeLayanan: "Datang Langsung",
    }),
  });
  assert.strictEqual(createDLRes.status, 201);
  const dlOrder = (await createDLRes.json() as any).data;

  // Advance Datang Langsung directly from 1 to 3
  await fetch(`${baseUrl}/api/orders/${dlOrder.orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ targetStage: "Verifikasi Dokumen" }),
  });
  const dlTrackRes = await fetch(`${baseUrl}/api/v1/public/orders/${dlOrder.orderNo}/tracking?nopol=B8899DLK`);
  const dlTrack = (await dlTrackRes.json() as any).data;
  assert.strictEqual(dlTrack.publicStageName, "Verifikasi Dokumen");
  assert.strictEqual(dlTrack.timeline[1].status, "COMPLETED", "Penjadwalan completed automatically for Datang Langsung");

  // 2. Cancellation
  await fetch(`${baseUrl}/api/orders/${dlOrder.orderNo}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ alasan: "Permintaan pembatalan dari pelanggan" }),
  });
  const cancelTrackRes = await fetch(`${baseUrl}/api/v1/public/orders/${dlOrder.orderNo}/tracking?nopol=B8899DLK`);
  const cancelTrack = (await cancelTrackRes.json() as any).data;
  assert.strictEqual(cancelTrack.statusPengerjaan, "Dibatalkan");
  assert.strictEqual(cancelTrack.isCancelled, true);
  assert.strictEqual(cancelTrack.isCompleted, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. PUB-02: ANTI-ENUMERATION PROTECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

test("PUB-02: Detail tracking enforces license plate verification & prevents order enumeration", async () => {
  const nopol = "B 9900 ENU";
  const createRes = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Target Enumerasi",
      nomorHP: "081233334444",
      serviceId: "svc-perp-1th",
      nopol,
      wilayahSamsatAsal: "Jakarta Timur",
    }),
  });
  const order = (await createRes.json() as any).data;

  // 1. Missing nopol query parameter -> 400
  const noNopolRes = await fetch(`${baseUrl}/api/v1/public/orders/${order.orderNo}/tracking`);
  assert.strictEqual(noNopolRes.status, 400);
  const noNopolBody = await noNopolRes.json() as any;
  assert.strictEqual(noNopolBody.error.code, "VALIDATION_ERROR");

  // 2. Order number exists, but nopol is WRONG -> 404 (safe generic)
  const wrongNopolRes = await fetch(`${baseUrl}/api/v1/public/orders/${order.orderNo}/tracking?nopol=B1111WRG`);
  assert.strictEqual(wrongNopolRes.status, 404);
  const wrongNopolBody = await wrongNopolRes.json() as any;
  assert.strictEqual(wrongNopolBody.error.code, "ORDER_NOT_FOUND");
  assert.strictEqual(wrongNopolBody.error.message, "Order tidak ditemukan atau informasi verifikasi nomor polisi tidak sesuai.");

  // 3. Order number does NOT exist, with any nopol -> 404 (Identical error code & message)
  const notFoundRes = await fetch(`${baseUrl}/api/v1/public/orders/ORD-9999-999/tracking?nopol=B1111WRG`);
  assert.strictEqual(notFoundRes.status, 404);
  const notFoundBody = await notFoundRes.json() as any;
  assert.strictEqual(notFoundBody.error.code, "ORDER_NOT_FOUND");
  assert.strictEqual(notFoundBody.error.message, wrongNopolBody.error.message, "Must return identical error to prevent enumeration timing/message leakage");

  // 4. Order number exists AND nopol matches with format variations -> 200 OK
  const variations = [
    nopol, // "B 9900 ENU"
    "b 9900 enu",
    "B-9900-ENU",
    "B9900ENU",
    "b-9900-enu",
  ];
  for (const v of variations) {
    const res = await fetch(`${baseUrl}/api/v1/public/orders/${order.orderNo}/tracking?nopol=${encodeURIComponent(v)}`);
    assert.strictEqual(res.status, 200, `Nopol variation '${v}' should succeed`);
  }

  // 5. Automated enumeration attempt (crawling 5 sequential order IDs with arbitrary nopol)
  const guessedIds = ["ORD-1126-001", "ORD-1126-002", "ORD-1126-003", "ORD-1126-004", "ORD-1126-005"];
  for (const guessId of guessedIds) {
    const probeRes = await fetch(`${baseUrl}/api/v1/public/orders/${guessId}/tracking?nopol=B9999XYZ`);
    assert.strictEqual(probeRes.status, 404);
    const probeBody = await probeRes.json() as any;
    assert.strictEqual(probeBody.data, undefined, "No vehicle or customer data should be leaked on probed order");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PUB-03 & PUB-04: ATOMIC UPLOAD, COMPENSATION & IDOR REMOVAL
// ─────────────────────────────────────────────────────────────────────────────

test("PUB-03 & PUB-04: Staged upload integrity, storage failure safety, and document IDOR rejection", async () => {
  // 1. Storage failure simulation / invalid magic bytes rejected before order creation
  const boundary = "----WebKitFormBoundaryCorruptTest";
  const multipartCorruptBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="customer"\r\n\r\nCorrupt User\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="nomorHP"\r\n\r\n081244445555\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="serviceId"\r\n\r\nsvc-perp-1th\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="nopol"\r\n\r\nB 3344 CRP\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="wilayahSamsatAsal"\r\n\r\nJakarta Timur\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="fake.pdf"\r\nContent-Type: application/pdf\r\n\r\nCORRUPT_BYTES_NOT_A_REAL_PDF\r\n`),
    Buffer.from(`--${boundary}--\r\n`),
  ]);

  const corruptRes = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: multipartCorruptBody,
  });
  // Must reject invalid magic bytes
  assert.strictEqual(corruptRes.status, 400);

  // Assert NO order was created for this nopol in database
  const checkOrderStmt = db.prepare("SELECT * FROM orders WHERE nopol = 'B 3344 CRP'");
  const checkOrder = checkOrderStmt.all();
  assert.strictEqual(checkOrder.length, 0, "No order should be created when document validation or storage fails");

  // 2. PUB-04: Public request with arbitrary documentIds should NOT adopt existing documents
  // Create a victim order first to satisfy FK
  const victimRes = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Victim Customer",
      nomorHP: "081299990000",
      serviceId: "svc-perp-1th",
      nopol: "B 5555 VIC",
      wilayahSamsatAsal: "Jakarta Timur",
    }),
  });
  const victimOrder = (await victimRes.json() as any).data;
  const victimOrderNo = victimOrder.orderNo;

  // Seed a private document linked to victim order in database
  const docId = `DOC-PRIV-${Date.now()}`;
  db.prepare(`
    INSERT INTO documents (id, order_no, invoice_id, document_type, original_name, storage_name, mime_type, size_bytes, sha256, uploaded_by, uploaded_by_id, uploaded_by_role, is_active, created_at, updated_at)
    VALUES (?, ?, NULL, 'KTP', 'ktp_private.jpg', 'ktp_private.jpg', 'image/jpeg', 100, 'sha256', 'Admin', 'usr-1', 'admin', 1, datetime('now'), datetime('now'))
  `).run(docId, victimOrderNo);

  // Attacker tries to steal/link DOC-PRIV to their new order
  const idorRes = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer: "Attacker Trying IDOR",
      nomorHP: "081288887777",
      serviceId: "svc-perp-1th",
      nopol: "B 7777 ATK",
      wilayahSamsatAsal: "Jakarta Timur",
      documentIds: [docId], // Attacker tries to adopt victim's document
    }),
  });
  assert.strictEqual(idorRes.status, 201);
  const attackerOrder = (await idorRes.json() as any).data;

  // Verify that the private document was NOT adopted by attacker's order
  const checkDoc = db.prepare("SELECT order_no FROM documents WHERE id = ?").get(docId) as any;
  assert.strictEqual(checkDoc.order_no, victimOrderNo, "Private document must remain bound to victim order");
  assert.strictEqual(attackerOrder.documentsAttached, 0, "Public API must not link arbitrary documentIds");
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. PUB-05: ATOMIC CONCURRENCY & PERSISTENT IDEMPOTENCY
// ─────────────────────────────────────────────────────────────────────────────

test("PUB-05: Concurrent requests with identical key produce exactly 1 order; differing payload throws 422", async () => {
  const idempotencyKey = `IDEMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload1 = {
    customer: "Concurrent Customer",
    nomorHP: "081299991111",
    serviceId: "svc-perp-1th",
    nopol: "B 1111 CON",
    wilayahSamsatAsal: "Jakarta Timur",
  };

  // 1. Two concurrent requests in parallel
  const [res1, res2] = await Promise.all([
    fetch(`${baseUrl}/api/v1/public/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload1),
    }),
    fetch(`${baseUrl}/api/v1/public/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload1),
    }),
  ]);

  assert.strictEqual(res1.status, 201);
  assert.strictEqual(res2.status, 201);

  const body1 = await res1.json() as any;
  const body2 = await res2.json() as any;

  // Both must return the identical order number
  assert.strictEqual(body1.data.orderNo, body2.data.orderNo);

  // Assert EXACTLY 1 order exists in database
  const orderCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE order_no = ?").get(body1.data.orderNo) as any;
  assert.strictEqual(orderCount.count, 1, "Exactly 1 order must be created in DB");

  // Assert EXACTLY 1 invoice exists in database
  const invoiceCount = db.prepare("SELECT COUNT(*) as count FROM finance_invoices WHERE order_no = ?").get(body1.data.orderNo) as any;
  assert.strictEqual(invoiceCount.count, 1, "Exactly 1 invoice must be created in DB");

  // Assert idempotency record is persisted in SQLite table
  const idempRow = db.prepare("SELECT * FROM idempotency_keys WHERE key = ? AND scope = 'CREATE_ORDER'").get(idempotencyKey) as any;
  assert.ok(idempRow, "Idempotency record must be stored in idempotency_keys SQLite table");
  assert.strictEqual(idempRow.resource_id, body1.data.orderNo);

  // 2. Request with identical key but DIFFERENT payload -> 422 IDEMPOTENCY_CONFLICT
  const conflictRes = await fetch(`${baseUrl}/api/v1/public/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      customer: "Different Customer Name",
      nomorHP: "081200000000",
      serviceId: "svc-perp-1th",
      nopol: "B 2222 DIF",
      wilayahSamsatAsal: "Jakarta Timur",
    }),
  });
  assert.strictEqual(conflictRes.status, 422);
  const conflictBody = await conflictRes.json() as any;
  assert.strictEqual(conflictBody.error.code, "IDEMPOTENCY_CONFLICT");
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. PUB-06 & PUB-07: PRICING VALIDATION & QUERY PLAN EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

test("PUB-07: Master data pricing endpoint returns HTTP 400 for invalid Samsat ID", async () => {
  const res = await fetch(`${baseUrl}/api/v1/public/pricing?serviceId=svc-perp-1th&samsatId=non-existent-samsat`);
  assert.strictEqual(res.status, 400);
  const body = await res.json() as any;
  assert.strictEqual(body.error.code, "VALIDATION_ERROR");
});

test("PUB-06: Query plan evaluation on clean nopol expression", async () => {
  // Check SQLite EXPLAIN QUERY PLAN for normalized nopol search
  const plan = db.prepare(`
    EXPLAIN QUERY PLAN
    SELECT order_no FROM orders
    WHERE REPLACE(REPLACE(REPLACE(UPPER(nopol), ' ', ''), '-', ''), '.', '') = 'B1234ABC'
  `).all() as any[];

  assert.ok(Array.isArray(plan));
  assert.ok(plan.length > 0);
  // Verify execution completes safely and deterministically
});
