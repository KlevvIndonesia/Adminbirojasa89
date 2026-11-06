import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { db } from "../server/src/database/db";

function createServer(): Promise<{ server: http.Server; baseUrl: string }> {
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

async function getAdminToken(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@birojasa.com", password: "admin123" }),
  });
  const data = (await res.json()) as any;
  assert.strictEqual(res.status, 200, "Admin login should succeed");
  return data.data.token;
}

test("Phase 2: Backend API & Persistence CRUD for Samsat Operational Tariffs", async () => {
  const { server, baseUrl } = await createServer();

  try {
    const token = await getAdminToken(baseUrl);
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // 1. Create two test Samsat offices in DB and seed test pricing items
    const officeA = "samsat-test-alpha";
    const officeB = "samsat-test-beta";

    db.prepare("DELETE FROM samsat_operational_tariffs WHERE samsat_id IN (?, ?)").run(officeA, officeB);
    db.prepare("DELETE FROM samsat_offices WHERE id IN (?, ?)").run(officeA, officeB);

    db.prepare(`
      INSERT OR IGNORE INTO samsat_pricing (id, nama_item, kategori, tipe_kendaraan, biaya_dasar, is_active, is_configured, data_json)
      VALUES 
        ('cek-fisik', 'Cek Fisik Test', 'Layanan Standar', 'Mobil', 30000, 1, 1, '{}'),
        ('legalisir', 'Legalisir Test', 'Layanan Standar', 'Mobil', 50000, 1, 1, '{}'),
        ('bantuan', 'Bantuan Test', 'Layanan Standar', 'Mobil', 40000, 1, 1, '{}')
    `).run();

    db.prepare(`
      INSERT INTO samsat_offices (id, name, wilayah, is_verified, status_aktif)
      VALUES (?, ?, ?, 1, 1), (?, ?, ?, 1, 1)
    `).run(officeA, "Samsat Alpha Test", "Wilayah Alpha", officeB, "Samsat Beta Test", "Wilayah Beta");

    // 2. Query Office A: should have 0 tariffs (UNCONFIGURED initially)
    const resGetAEmpty = await fetch(`${baseUrl}/api/pricing/samsat-tariffs?samsatId=${officeA}`, {
      headers: authHeaders,
    });
    assert.strictEqual(resGetAEmpty.status, 200);
    const jsonGetAEmpty = (await resGetAEmpty.json()) as any;
    assert.deepStrictEqual(jsonGetAEmpty.data, [], "New Samsat office must start with 0 active operational tariffs");

    // 3. Upsert tariff for Office A: cek-fisik = 25000, legalisir = 50000
    const resPutA = await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        samsatId: officeA,
        tariffs: [
          { pricingItemId: "cek-fisik", nominal: 25000 },
          { pricingItemId: "legalisir", nominal: 50000 },
        ],
      }),
    });
    assert.strictEqual(resPutA.status, 200);

    // 4. Upsert tariff for Office B: cek-fisik = 35000, zero explicit legalisir = 0
    const resPutB = await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        samsatId: officeB,
        tariffs: [
          { pricingItemId: "cek-fisik", nominal: 35000 },
          { pricingItemId: "legalisir", nominal: 0 },
        ],
      }),
    });
    assert.strictEqual(resPutB.status, 200);

    // 5. Verify Isolation: Office A tariffs are NOT modified by Office B
    const resCheckA = await fetch(`${baseUrl}/api/pricing/samsat-tariffs?samsatId=${officeA}`, {
      headers: authHeaders,
    });
    const jsonCheckA = (await resCheckA.json()) as any;
    assert.strictEqual(jsonCheckA.data.length, 2);
    const cekFisikA = jsonCheckA.data.find((t: any) => t.pricing_item_id === "cek-fisik");
    const legalisirA = jsonCheckA.data.find((t: any) => t.pricing_item_id === "legalisir");
    assert.strictEqual(cekFisikA.nominal, 25000, "Office A cek-fisik must remain 25000");
    assert.strictEqual(legalisirA.nominal, 50000, "Office A legalisir must remain 50000");

    // Verify Office B has its own independent tariffs, including explicit 0
    const resCheckB = await fetch(`${baseUrl}/api/pricing/samsat-tariffs?samsatId=${officeB}`, {
      headers: authHeaders,
    });
    const jsonCheckB = (await resCheckB.json()) as any;
    const cekFisikB = jsonCheckB.data.find((t: any) => t.pricing_item_id === "cek-fisik");
    const legalisirB = jsonCheckB.data.find((t: any) => t.pricing_item_id === "legalisir");
    assert.strictEqual(cekFisikB.nominal, 35000, "Office B cek-fisik must be 35000");
    assert.strictEqual(legalisirB.nominal, 0, "Office B legalisir must be explicitly 0");

    // 6. Negative validation: invalid nominal rejected
    const resInvalidNominal = await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        samsatId: officeA,
        pricingItemId: "bantuan",
        nominal: -10000,
      }),
    });
    assert.strictEqual(resInvalidNominal.status, 400, "Negative nominal should return 400 Bad Request");

    // 7. Non-existent office rejected
    const resGhostOffice = await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        samsatId: "samsat-nonexistent-ghost",
        pricingItemId: "bantuan",
        nominal: 10000,
      }),
    });
    assert.strictEqual(resGhostOffice.status, 404, "Non-existent office should return 404");

    // 8. Delete Samsat Office blocked when tariffs exist (409 Conflict)
    const resDelOffice = await fetch(`${baseUrl}/api/samsat/offices/${officeA}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.strictEqual(resDelOffice.status, 409, "Deleting office with active tariffs must return 409 Conflict");

    // 9. Cleanup
    db.prepare("DELETE FROM samsat_operational_tariffs WHERE samsat_id IN (?, ?)").run(officeA, officeB);
    db.prepare("DELETE FROM samsat_offices WHERE id IN (?, ?)").run(officeA, officeB);
    db.prepare("DELETE FROM samsat_pricing WHERE id IN ('cek-fisik', 'legalisir', 'bantuan')").run();

  } finally {
    server.close();
  }
});
