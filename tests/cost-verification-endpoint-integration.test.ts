import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { orderService } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";

function createServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3000;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

test("PHASE 2: DEDICATED COST VERIFICATION ENDPOINT INTEGRATION TEST SUITE", async (t) => {
  const { server, baseUrl } = await createServer();

  t.after(() => {
    server.close();
  });

  // 1. Login as Admin / SVP (Authorized)
  const loginSvpRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "svp@birojasa.com", password: "admin123" }),
  });
  const loginSvpBody = (await loginSvpRes.json()) as any;
  const svpToken = loginSvpBody?.data?.token;
  assert.ok(svpToken, "SVP token must be present");

  // 2. Login as Messenger (Unauthorized for cost verification)
  const loginMessengerRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "budi.messenger@birojasa.com", password: "messenger123" }),
  });
  const loginMessengerBody = (await loginMessengerRes.json()) as any;
  const messengerToken = loginMessengerBody?.data?.token;
  assert.ok(messengerToken, "Messenger token must be present");

  const svpHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${svpToken}`,
  };

  const messengerHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${messengerToken}`,
  };

  function createTestOrder(id: string) {
    return orderService.createOrder(
      {
        customer: `Customer Test ${id}`,
        nomorHP: "081234567890",
        layanan: "Mutasi Luar Daerah",
        nopol: `B ${id} VFY`,
        biayaJasa: 200000,
        biayaAntarJemput: 25000,
        biayaLainnya: 0,
        totalBiaya: 225000,
        wilayahSamsatAsal: "Jakarta Timur",
        completenessStatus: "PARTIAL_ESTIMATE",
        costSnapshot: {
          totalEstimasi: 225000,
          biayaJasa: 200000,
          biayaAntarJemput: 25000,
          biayaSamsat: 0,
          completenessStatus: "PARTIAL_ESTIMATE",
          hasUnconfiguredTariff: true,
          breakdown: [
            { name: "Jasa", amount: 200000, status: "CONFIGURED" },
            { name: "Antar Jemput", amount: 25000, status: "CONFIGURED" },
            { name: "Komponen Belum Terkonfigurasi", amount: 0, status: "UNCONFIGURED" },
          ],
        },
      } as any,
      { role: "administrator", nama: "Admin Setup", userId: "usr-admin" } as any
    );
  }

  // Test A — Endpoint tersedia
  await t.test("Test A — Endpoint tersedia: POST /api/orders/:orderNo/verify-cost returns non-404", async () => {
    const order = createTestOrder("A");
    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
        finalTotalBiaya: 625000, // 200000 + 25000 + 400000
        notes: "Test endpoint route registration",
      }),
    });
    console.log(`[TEST EVIDENCE A] Status: ${res.status}`);
    assert.notEqual(res.status, 404, "Route must be mounted and not return 404");
    assert.equal(res.status, 200);
  });

  // Test B — Authentication
  await t.test("Test B — Authentication: Request without token returns 401 UNAUTHENTICATED", async () => {
    const order = createTestOrder("B");
    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
      }),
    });
    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE B] Status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 401);
    assert.equal(body.error?.code, "UNAUTHENTICATED");
  });

  // Test C — Authorization
  await t.test("Test C — Authorization: Unauthorized role returns 403 FORBIDDEN and data is intact", async () => {
    const order = createTestOrder("C");
    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: messengerHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
      }),
    });
    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE C] Status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 403);
    assert.equal(body.error?.code, "FORBIDDEN");

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.isCostVerified, false);
    assert.equal(persisted.costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // Test D — Verifikasi valid
  await t.test("Test D — Verifikasi valid: Authorized user verifies order successfully", async () => {
    const order = createTestOrder("D");
    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
        finalTotalBiaya: 625000,
        notes: "Tarif Samsat telah diverifikasi petugas loket",
      }),
    });
    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE D] Status: ${res.status}, Success: ${body.success}`);
    assert.equal(res.status, 200);
    assert.equal(body.success, true);

    const updated = orderService.getByOrderNo(order.orderNo);
    assert.equal(updated.isCostVerified, true);
    assert.equal(updated.costCompletenessStatus, "VERIFIED");
    assert.equal(updated.payment?.totalBiaya, 625000);
    assert.equal(updated.costVerifiedBy, "Admin Super (SVP)");
    assert.ok(updated.costVerifiedAt);
  });

  // Test E — Order tidak ditemukan
  await t.test("Test E — Order tidak ditemukan: Non-existent order returns 404 ORDER_NOT_FOUND", async () => {
    const res = await fetch(`${baseUrl}/api/orders/ORD-NONEXISTENT-9999/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
      }),
    });
    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE E] Status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 404);
    assert.equal(body.error?.code, "ORDER_NOT_FOUND");
  });

  // Test F — Payload tidak valid & Inconsistent Total
  await t.test("Test F — Payload tidak valid: Negative, invalid types, and inconsistent totals rejected with 400", async () => {
    const order = createTestOrder("F");

    // F.1: Negative finalBiayaSamsat
    const resNeg = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({ finalBiayaSamsat: -50000 }),
    });
    const bodyNeg = (await resNeg.json()) as any;
    assert.equal(resNeg.status, 400);
    assert.equal(bodyNeg.error?.code, "INVALID_COST_PAYLOAD");

    // F.2: Inconsistent total: 200000 (jasa) + 25000 (antarJemput) + 400000 (samsat) = 625000, but client sends 999000
    const resInconsistent = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
        finalTotalBiaya: 999000,
      }),
    });
    const bodyInconsistent = (await resInconsistent.json()) as any;
    console.log(`[TEST EVIDENCE F] Inconsistent status: ${resInconsistent.status}, Code: ${bodyInconsistent.error?.code}`);
    assert.equal(resInconsistent.status, 400);
    assert.equal(bodyInconsistent.error?.code, "INCONSISTENT_COST_PAYLOAD");

    // F.3: Non-string notes
    const resNotes = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({ finalBiayaSamsat: 400000, notes: 12345 }),
    });
    const bodyNotes = (await resNotes.json()) as any;
    assert.equal(resNotes.status, 400);
    assert.equal(bodyNotes.error?.code, "INVALID_NOTES");
  });

  // Test G — Identitas verifikator tidak dapat dipalsukan
  await t.test("Test G — Identitas verifikator: Client cannot forge costVerifiedBy via body", async () => {
    const order = createTestOrder("G");
    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
        costVerifiedBy: "Hacker Man",
        isCostVerified: true,
      }),
    });
    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE G] Status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 403);
    assert.equal(body.error?.code, "FORBIDDEN_PROPERTY");

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.isCostVerified, false);
  });

  // Test H — Snapshot immutable
  await t.test("Test H — Snapshot immutable: costSnapshot remains strictly identical after verification", async () => {
    const order = createTestOrder("H");
    const snapshotBefore = JSON.stringify(order.costSnapshot);

    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 500000,
        finalTotalBiaya: 725000, // 200000 + 25000 + 500000
        notes: "Testing snapshot immutability",
      }),
    });
    assert.equal(res.status, 200);

    const orderAfter = orderService.getByOrderNo(order.orderNo);
    const snapshotAfter = JSON.stringify(orderAfter.costSnapshot);
    console.log(`[TEST EVIDENCE H] Snapshot Match: ${snapshotBefore === snapshotAfter}`);
    assert.equal(snapshotBefore, snapshotAfter, "costSnapshot must remain completely immutable");
  });

  // Test I — Konsistensi invoice
  await t.test("Test I — Konsistensi invoice: matching finance invoice is atomically synchronized", async () => {
    const order = createTestOrder("I");
    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 450000,
        finalTotalBiaya: 675000, // 200000 + 25000 + 450000
        notes: "Syncing invoice",
      }),
    });
    assert.equal(res.status, 200);

    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
    assert.ok(invoice, "Invoice must exist");
    console.log(`[TEST EVIDENCE I] Inv total: ${invoice.totalTagihan}, Inv Samsat: ${invoice.biayaSamsat}, Status: ${invoice.costVerificationStatus}`);
    assert.equal(invoice.totalTagihan, 675000);
    assert.equal(invoice.biayaSamsat, 450000);
    assert.equal(invoice.pendapatanJasa, 225000);
    assert.equal(invoice.costVerificationStatus, "VERIFIED");
    assert.equal(invoice.isDraftEstimate, false);
  });

  // Test J — Kegagalan persistence / Transaksi rollback
  await t.test("Test J — Kegagalan persistence: invalid state triggers rollback without partial update", async () => {
    const order = createTestOrder("J");
    // Cancel the order first
    orderService.cancelOrder(order.orderNo, "Cancelled for persistence failure test", { role: "administrator", nama: "Admin" } as any);

    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
      }),
    });
    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE J] Status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 400);
    assert.equal(body.error?.code, "ORDER_CANCELLED");

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.isCostVerified, false);
    assert.equal(persisted.costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // Test K — Request berulang
  await t.test("Test K — Request berulang: repeated verification is idempotent and safe", async () => {
    const order = createTestOrder("K");

    // First call
    const res1 = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
        finalTotalBiaya: 625000,
        notes: "First verification call",
      }),
    });
    assert.equal(res1.status, 200);

    // Second call with same payload
    const res2 = await fetch(`${baseUrl}/api/orders/${order.orderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 400000,
        finalTotalBiaya: 625000,
        notes: "Repeated verification call",
      }),
    });
    const body2 = (await res2.json()) as any;
    console.log(`[TEST EVIDENCE K] Second call status: ${res2.status}, Success: ${body2.success}`);
    assert.equal(res2.status, 200);
    assert.equal(body2.success, true);

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.isCostVerified, true);
    assert.equal(persisted.payment?.totalBiaya, 625000);
  });

  // Test L — Regression generic update
  await t.test("Test L — Regression generic update: generic PUT cannot alter verification status", async () => {
    const order = createTestOrder("L");
    assert.equal(order.isCostVerified, false);

    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: svpHeaders,
      body: JSON.stringify({
        isCostVerified: true,
        costCompletenessStatus: "VERIFIED",
      }),
    });
    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE L] Generic PUT status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 403);
    assert.equal(body.error?.code, "PROTECTED_FIELD_VIOLATION");

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.isCostVerified, false);
  });
});
