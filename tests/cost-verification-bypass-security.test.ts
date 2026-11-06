import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { orderService } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";

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

test("PHASE 1 SECURITY HARDENING: COST VERIFICATION BYPASS AUDIT SUITE", async (t) => {
  const { server, baseUrl } = await createServer();

  t.after(() => {
    server.close();
  });

  // Login as admin/svp to obtain bearer token
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "svp@birojasa.com", password: "admin123" }),
  });
  const loginBody = (await loginRes.json()) as any;
  const token = loginBody?.data?.token;
  assert.ok(token, "Admin/SVP token must be acquired");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Helper to create an unverified PARTIAL_ESTIMATE order
  function createUnverifiedOrder(identifier: string) {
    return orderService.createOrder(
      {
        customer: `Customer ${identifier}`,
        nomorHP: "081234567890",
        layanan: "Mutasi Luar Daerah",
        nopol: `B ${identifier} SEC`,
        biayaJasa: 250000,
        totalBiaya: 250000,
        wilayahSamsatAsal: "Jakarta Timur",
        completenessStatus: "PARTIAL_ESTIMATE",
        costSnapshot: {
          totalEstimasi: 250000,
          biayaJasa: 250000,
          biayaSamsat: 0,
          completenessStatus: "PARTIAL_ESTIMATE",
          hasUnconfiguredTariff: true,
          breakdown: [
            { name: "Jasa", amount: 250000, status: "CONFIGURED" },
            { name: "Komponen Belum Terkonfigurasi", amount: 0, status: "UNCONFIGURED" },
          ],
        },
      } as any,
      { role: "administrator", nama: "Admin Setup", userId: "usr-admin" } as any
    );
  }

  // Helper to create a verified order
  function createVerifiedOrder(identifier: string) {
    const unverified = createUnverifiedOrder(identifier);
    const verified = orderService.verifyOrderCost(
      unverified.orderNo,
      {
        finalBiayaSamsat: 500000,
        finalTotalBiaya: 750000,
        notes: "Verified by SPV in test setup",
      },
      { role: "administrator", nama: "Supervisor Sah", userId: "spv-001" } as any
    );
    return verified;
  }

  // Test A — Manipulasi camelCase
  await t.test("Test A — Manipulasi camelCase: PUT with isCostVerified: true is rejected with 403", async () => {
    const order = createUnverifiedOrder("A");
    assert.equal(order.isCostVerified, false);
    assert.equal(order.costCompletenessStatus, "PARTIAL_ESTIMATE");

    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        isCostVerified: true,
      }),
    });

    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE A] Status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 403);
    assert.equal(body.error?.code, "PROTECTED_FIELD_VIOLATION");

    // Verify database state: order remains unverified
    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.isCostVerified, false);
    assert.equal(persisted.costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // Test B — Manipulasi snake_case
  await t.test("Test B — Manipulasi snake_case: PUT with is_cost_verified: true is rejected with 403", async () => {
    const order = createUnverifiedOrder("B");
    assert.equal(order.isCostVerified, false);

    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        is_cost_verified: true,
      }),
    });

    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE B] Status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 403);
    assert.equal(body.error?.code, "PROTECTED_FIELD_VIOLATION");

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.isCostVerified, false);
  });

  // Test C — Manipulasi status kelengkapan
  await t.test("Test C — Manipulasi status kelengkapan: PUT with costCompletenessStatus or snake_case is rejected with 403", async () => {
    const order1 = createUnverifiedOrder("C1");
    const res1 = await fetch(`${baseUrl}/api/orders/${order1.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        costCompletenessStatus: "VERIFIED",
      }),
    });
    const body1 = (await res1.json()) as any;
    assert.equal(res1.status, 403);
    assert.equal(body1.error?.code, "PROTECTED_FIELD_VIOLATION");

    const order2 = createUnverifiedOrder("C2");
    const res2 = await fetch(`${baseUrl}/api/orders/${order2.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        cost_completeness_status: "VERIFIED",
      }),
    });
    const body2 = (await res2.json()) as any;
    console.log(`[TEST EVIDENCE C] Status1: ${res1.status}, Status2: ${res2.status}`);
    assert.equal(res2.status, 403);
    assert.equal(body2.error?.code, "PROTECTED_FIELD_VIOLATION");

    assert.equal(orderService.getByOrderNo(order1.orderNo).costCompletenessStatus, "PARTIAL_ESTIMATE");
    assert.equal(orderService.getByOrderNo(order2.orderNo).costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // Test D — Manipulasi metadata verifikasi
  await t.test("Test D — Manipulasi metadata verifikasi: costVerifiedAt & costVerifiedBy rejected with 403", async () => {
    const order = createUnverifiedOrder("D");

    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        costVerifiedAt: new Date().toISOString(),
        costVerifiedBy: "Fake Verifier",
      }),
    });

    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE D] Status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 403);
    assert.equal(body.error?.code, "PROTECTED_FIELD_VIOLATION");

    // Also test snake_case variants
    const resSnake = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        cost_verified_at: new Date().toISOString(),
        cost_verified_by: "Fake Verifier Snake",
      }),
    });
    const bodySnake = (await resSnake.json()) as any;
    assert.equal(resSnake.status, 403);
    assert.equal(bodySnake.error?.code, "PROTECTED_FIELD_VIOLATION");

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.costVerifiedAt, undefined);
    assert.equal(persisted.costVerifiedBy, undefined);
  });

  // Test E — Kombinasi payload
  await t.test("Test E — Kombinasi payload: mixed sensitive and legitimate fields is blocked atomically", async () => {
    const order = createUnverifiedOrder("E");

    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        customer: "Nama Customer Sah Diubah",
        isCostVerified: true,
        costCompletenessStatus: "VERIFIED",
      }),
    });

    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE E] Status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 403);
    assert.equal(body.error?.code, "PROTECTED_FIELD_VIOLATION");

    // Ensure database remained protected and was NOT partially mutated
    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.customer, "Customer E"); // original customer preserved
    assert.equal(persisted.isCostVerified, false);
    assert.equal(persisted.costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // Test F — Proteksi status sebelumnya
  await t.test("Test F — Proteksi status sebelumnya: normal update keeps unverified order unverified", async () => {
    const order = createUnverifiedOrder("F");
    assert.equal(order.isCostVerified, false);
    assert.equal(order.costCompletenessStatus, "PARTIAL_ESTIMATE");

    // Update only normal fields (notes, phone, customer)
    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        customer: "Customer F Updated",
        nomorHP: "089999999999",
        catatanOrder: "Catatan perbaikan order biasa",
      }),
    });

    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE F] Status: ${res.status}, Success: ${body.success}`);
    assert.equal(res.status, 200);
    assert.equal(body.success, true);

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.customer, "Customer F Updated");
    assert.equal(persisted.nomorHP, "089999999999");
    assert.equal(persisted.isCostVerified, false);
    assert.equal(persisted.costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // Test G — Preservasi order yang sudah diverifikasi
  await t.test("Test G — Preservasi order yang sudah diverifikasi: normal update does not reset verification metadata", async () => {
    const verifiedOrder = createVerifiedOrder("G");
    assert.equal(verifiedOrder.isCostVerified, true);
    assert.equal(verifiedOrder.costCompletenessStatus, "VERIFIED");
    assert.equal(verifiedOrder.costVerifiedBy, "Supervisor Sah");
    const verifiedAt = verifiedOrder.costVerifiedAt;
    assert.ok(verifiedAt);

    // Normal update on verified order
    const res = await fetch(`${baseUrl}/api/orders/${verifiedOrder.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        catatanOrder: "Update catatan operasional rutin setelah verifikasi",
      }),
    });

    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE G] Status: ${res.status}, Success: ${body.success}`);
    assert.equal(res.status, 200);
    assert.equal(body.success, true);

    const persisted = orderService.getByOrderNo(verifiedOrder.orderNo);
    assert.equal(persisted.isCostVerified, true);
    assert.equal(persisted.costCompletenessStatus, "VERIFIED");
    assert.equal(persisted.costVerifiedBy, "Supervisor Sah");
    assert.equal(persisted.costVerifiedAt, verifiedAt);
  });

  // Test H — Regression normal update
  await t.test("Test H — Regression normal update: legitimate fields update smoothly across all layers", async () => {
    const order = createUnverifiedOrder("H");

    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        customer: "Budi Santoso",
        nomorHP: "081288887777",
        nopol: "B 8888 BUS",
        catatanOrder: "Berkas lengkap dititipkan ke CS",
      }),
    });

    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE H] Status: ${res.status}, Success: ${body.success}`);
    assert.equal(res.status, 200);
    assert.equal(body.success, true);

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.customer, "Budi Santoso");
    assert.equal(persisted.nomorHP, "081288887777");
    assert.equal(persisted.nopol, "B 8888 BUS");
    assert.equal(persisted.catatanOrder, "Berkas lengkap dititipkan ke CS");
  });

  // Test Extra — Advance Stage bypass prevention
  await t.test("Test Extra — Stage Transition bypass attempt: updates with isCostVerified in advance is rejected", async () => {
    const order = createUnverifiedOrder("Extra");

    const res = await fetch(`${baseUrl}/api/orders/${order.orderNo}/advance`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        targetStage: "Penjadwalan",
        updates: {
          isCostVerified: true,
        },
      }),
    });

    const body = (await res.json()) as any;
    console.log(`[TEST EVIDENCE EXTRA] Advance status: ${res.status}, Code: ${body.error?.code}`);
    assert.equal(res.status, 403);
    assert.equal(body.error?.code, "PROTECTED_FIELD_VIOLATION");

    const persisted = orderService.getByOrderNo(order.orderNo);
    assert.equal(persisted.isCostVerified, false);
  });
});
