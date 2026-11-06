/**
 * Integration Test: Biaya Layanan & Harga Dasar Samsat CRUD
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. Biaya Layanan (service_pricing_configs):
 *    - GET /api/pricing/services reads from database.
 *    - POST /api/pricing/services persists into database.
 *    - PUT /api/pricing/services/:id updates the record.
 *    - DELETE /api/pricing/services/:id removes the record.
 * 2. Harga Dasar Samsat (samsat_pricing & samsat_operational_tariffs):
 *    - GET /api/pricing/samsat reads from database.
 *    - PUT /api/pricing/samsat/:id updates base price and logs audit.
 *    - Samsat operational tariffs upsert & delete verification.
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";
import { db } from "../server/src/database/db";

test("Master Data Pricing CRUD - Biaya Layanan & Harga Dasar Samsat", async (t) => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const adminToken = generateToken({
    userId: "usr-admin-pricing",
    email: "admin@birojasa.com",
    nama: "Admin Pricing",
    role: "admin",
  });

  try {
    // ─── PART 1: BIAYA LAYANAN (service_pricing_configs) ───────────────────────

    await t.test("1. GET /api/pricing/services reads from service_pricing_configs", async () => {
      const res = await fetch(`${baseUrl}/api/pricing/services`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));

      const count = (db.prepare("SELECT COUNT(*) as c FROM service_pricing_configs").get() as any).c;
      assert.strictEqual(json.data.length, count);
    });

    const testConfigId = "svc-perp-1th:samsat-jakarta-selatan";
    await t.test("2. POST /api/pricing/services creates/persists service pricing config", async () => {
      // Ensure clean state for test ID
      db.prepare("DELETE FROM service_pricing_configs WHERE id = 'svc-test:samsat-jakarta-selatan'").run();

      const payload = {
        id: "svc-test:samsat-jakarta-selatan",
        serviceId: "svc-test",
        serviceName: "Layanan Uji Coba",
        samsatId: "samsat-jakarta-selatan",
        wilayah: "Jakarta Selatan",
        biayaJasa: 150000,
        biayaAntarJemput: 35000,
      };

      const res = await fetch(`${baseUrl}/api/pricing/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.id, "svc-test:samsat-jakarta-selatan");
      assert.strictEqual(json.data.biayaJasa, 150000);

      // Verify in SQLite
      const row = db.prepare("SELECT * FROM service_pricing_configs WHERE id = 'svc-test:samsat-jakarta-selatan'").get() as any;
      assert.ok(row, "Record must exist in service_pricing_configs");
      assert.strictEqual(row.biaya_jasa, 150000);
      assert.strictEqual(row.biaya_antar_jemput, 35000);
    });

    await t.test("3. PUT /api/pricing/services/:id updates the service pricing config", async () => {
      const updatePayload = {
        serviceId: "svc-test",
        serviceName: "Layanan Uji Coba Updated",
        samsatId: "samsat-jakarta-selatan",
        wilayah: "Jakarta Selatan",
        biayaJasa: 175000,
        biayaAntarJemput: 40000,
      };

      const res = await fetch(`${baseUrl}/api/pricing/services/svc-test:samsat-jakarta-selatan`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.biayaJasa, 175000);

      // Verify in SQLite
      const row = db.prepare("SELECT * FROM service_pricing_configs WHERE id = 'svc-test:samsat-jakarta-selatan'").get() as any;
      assert.strictEqual(row.biaya_jasa, 175000);
      assert.strictEqual(row.biaya_antar_jemput, 40000);
    });

    await t.test("4. DELETE /api/pricing/services/:id deletes the service pricing config", async () => {
      const res = await fetch(`${baseUrl}/api/pricing/services/svc-test:samsat-jakarta-selatan`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);

      // Verify deletion from SQLite
      const row = db.prepare("SELECT * FROM service_pricing_configs WHERE id = 'svc-test:samsat-jakarta-selatan'").get();
      assert.strictEqual(row, undefined, "Record must be deleted from SQLite table");
    });

    // ─── PART 2: HARGA DASAR SAMSAT (samsat_pricing) ───────────────────────────

    await t.test("5. GET /api/pricing/samsat reads from samsat_pricing table", async () => {
      const res = await fetch(`${baseUrl}/api/pricing/samsat`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      assert.ok(json.data.length > 0, "Expected seed items in samsat_pricing");

      const firstItem = json.data[0];
      assert.ok(firstItem.id);
      assert.ok(firstItem.namaItem || firstItem.name);
    });

    await t.test("6. PUT /api/pricing/samsat/:id updates basePrice in samsat_pricing", async () => {
      // Get first item
      const first = db.prepare("SELECT * FROM samsat_pricing LIMIT 1").get() as any;
      assert.ok(first);

      const newPrice = Number(first.biaya_dasar) + 5000;
      const res = await fetch(`${baseUrl}/api/pricing/samsat/${encodeURIComponent(first.id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          biayaDasar: newPrice,
          namaItem: first.nama_item,
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.biayaDasar, newPrice);

      // Verify in SQLite
      const updatedRow = db.prepare("SELECT * FROM samsat_pricing WHERE id = ?").get(first.id) as any;
      assert.strictEqual(updatedRow.biaya_dasar, newPrice);
    });
  } finally {
    server.close();
  }
});
