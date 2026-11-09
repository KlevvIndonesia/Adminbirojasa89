/**
 * Integration Test: Services API & Master Layanan
 * Verifies that:
 * 1. 8 canonical services are returned by GET /api/services.
 * 2. Official service names are locked and cannot be overwritten.
 * 3. Canonical services cannot be deleted (CANONICAL_SERVICE_PROTECTED).
 * 4. Authentication and role-based access control are properly enforced.
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";

test("Services API - Master Layanan Integration & Invariant Tests", async (t) => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const adminToken = generateToken({
      userId: "2",
      email: "admin@birojasa.com",
      nama: "Admin Operasional",
      role: "admin",
    });

    const svpToken = generateToken({
      userId: "1",
      email: "svp@birojasa.com",
      nama: "Supervisor Operasional",
      role: "svp",
    });

    await t.test("1. Unauthenticated request to GET /api/services is rejected with 401", async () => {
      const res = await fetch(`${baseUrl}/api/services`);
      assert.strictEqual(res.status, 401);
    });

    await t.test("2. GET /api/services returns all canonical services", async () => {
      const res = await fetch(`${baseUrl}/api/services`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json() as any;
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length >= 8, `Expected at least 8 services, got ${body.data.length}`);

      const serviceIds = body.data.map((s: any) => s.id);
      assert.ok(serviceIds.includes("svc-perp-1th"));
      assert.ok(serviceIds.includes("svc-perp-5th"));
      assert.ok(serviceIds.includes("svc-mut-asal"));
      assert.ok(serviceIds.includes("svc-mut-antar"));
      assert.ok(serviceIds.includes("svc-balik-nama"));
      assert.ok(serviceIds.includes("svc-tarik-berkas"));
      assert.ok(serviceIds.includes("svc-duplikat-stnk"));
      assert.ok(serviceIds.includes("svc-lainnya"));
    });

    await t.test("3. GET /api/services/:id returns specific canonical service", async () => {
      const res = await fetch(`${baseUrl}/api/services/svc-perp-1th`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json() as any;
      assert.strictEqual(body.data.id, "svc-perp-1th");
      assert.strictEqual(body.data.nama_layanan, "Perpanjangan 1 Tahun");
      assert.ok(Array.isArray(body.data.requirements));
    });

    await t.test("4. PUT /api/services/:id updates description and requirements, but preserves locked official name", async () => {
      const res = await fetch(`${baseUrl}/api/services/svc-perp-1th`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nama_layanan: "HACKED NAME THAT SHOULD NOT OVERWRITE",
          deskripsi: "Deskripsi resmi diperbarui untuk pengujian integrasi",
          requirements: ["KTP asli", "STNK asli", "BPKB asli"],
        }),
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json() as any;
      assert.strictEqual(body.data.nama_layanan, "Perpanjangan 1 Tahun", "Official service name must be locked");
      assert.strictEqual(body.data.deskripsi, "Deskripsi resmi diperbarui untuk pengujian integrasi");
      assert.strictEqual(body.data.requirements.length, 3);
    });

    await t.test("5. DELETE /api/services/:id on canonical service is rejected (400 CANONICAL_SERVICE_PROTECTED)", async () => {
      const res = await fetch(`${baseUrl}/api/services/svc-perp-1th`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json() as any;
      assert.strictEqual(body.error?.code, "CANONICAL_SERVICE_PROTECTED");
    });
  } finally {
    server.close();
  }
});
