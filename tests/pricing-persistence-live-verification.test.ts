import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/src/app";
import { pricingStore, MASTER_PRICING_ITEMS } from "../src/app/data/pricingStore";

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

test("Live Physical Persistence & Strict Filter Verification", async (t) => {
  const { server, baseUrl } = await createServer();
  const token = await getAdminToken(baseUrl);
  const dbPath = process.env.DB_PATH || "server/data/database.sqlite";
  const directDb = new DatabaseSync(dbPath, { readOnly: false });

  t.after(() => {
    directDb.close();
    server.close();
  });

  await t.test("1. Atur Standar Nasional via HTTP PUT physically mutates SQLite database", async () => {
    const targetItemId = "mutasi-legalisir";
    const testNewPrice = 77000;

    // 1.1 Kirim HTTP PUT ke endpoint master pricing
    const putRes = await fetch(`${baseUrl}/api/pricing/samsat/${targetItemId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        basePrice: testNewPrice,
        active: true,
      }),
    });
    assert.strictEqual(putRes.status, 200, "Update national pricing via API should return 200 OK");
    const putData = (await putRes.json()) as any;
    assert.strictEqual(putData.success, true);

    // 1.2 Verifikasi fisik di database SQLite langsung (Direct SQL Query)
    const sqlRow = directDb.prepare(`
      SELECT id, nama_item, biaya_dasar, is_active, is_configured, updated_at 
      FROM samsat_pricing 
      WHERE id = ?
    `).get(targetItemId) as any;

    assert.ok(sqlRow, "Row must exist in samsat_pricing table");
    assert.strictEqual(sqlRow.biaya_dasar, testNewPrice, "biaya_dasar in SQLite file must physically match 77000");
    assert.strictEqual(typeof sqlRow.biaya_dasar, "number", "biaya_dasar must be stored as INTEGER");
    assert.strictEqual(sqlRow.is_configured, 1, "is_configured must be 1");
    assert.strictEqual(sqlRow.is_active, 1, "is_active must be 1");

    // 1.3 Verifikasi audit log di SQLite fisik
    const auditRow = directDb.prepare(`
      SELECT action, module, details 
      FROM audit_logs 
      WHERE action = 'UPDATE_PRICING' AND (details LIKE ? OR metadata_json LIKE ?) 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(`%${sqlRow.nama_item}%`, `%"itemId":"${targetItemId}"%`) as any;

    assert.ok(auditRow, "Audit log must be created for national default update");
    assert.strictEqual(auditRow.action, "UPDATE_PRICING");
  });

  await t.test("2. Edit per-Samsat via HTTP PUT batch tariffs physically mutates SQLite without touching master", async () => {
    const testSamsatId = "samsat-jakarta-timur";
    const targetItemId = "mutasi-cf";
    const customTariff = 95000;

    // Catat harga default nasional sebelum override
    const masterBefore = directDb.prepare("SELECT biaya_dasar FROM samsat_pricing WHERE id = ?").get(targetItemId) as any;
    const masterBasePrice = masterBefore.biaya_dasar;

    // 2.1 Kirim HTTP PUT batch override
    const putRes = await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        samsatId: testSamsatId,
        tariffs: [
          { pricingItemId: targetItemId, nominal: customTariff },
        ],
      }),
    });
    assert.strictEqual(putRes.status, 200, "Update samsat tariffs via API should return 200 OK");

    // 2.2 Verifikasi fisik di tabel samsat_operational_tariffs (Direct SQL Query)
    const tariffRow = directDb.prepare(`
      SELECT id, samsat_id, pricing_item_id, nominal, is_active 
      FROM samsat_operational_tariffs 
      WHERE samsat_id = ? AND pricing_item_id = ?
    `).get(testSamsatId, targetItemId) as any;

    assert.ok(tariffRow, "Override row must physically exist in samsat_operational_tariffs in SQLite");
    assert.strictEqual(tariffRow.nominal, customTariff, "nominal must physically equal 95000 in SQLite");
    assert.strictEqual(tariffRow.is_active, 1, "is_active must be 1");

    // 2.3 Verifikasi tabel samsat_pricing TIDAK terpengaruh sama sekali
    const masterAfter = directDb.prepare("SELECT biaya_dasar FROM samsat_pricing WHERE id = ?").get(targetItemId) as any;
    assert.strictEqual(masterAfter.biaya_dasar, masterBasePrice, "samsat_pricing master base price must NOT be mutated by per-samsat override");
  });

  await t.test("3. Reset / Delete Override via HTTP DELETE physically removes row from SQLite", async () => {
    const testSamsatId = "samsat-jakarta-timur";
    const targetItemId = "mutasi-cf";

    // 3.1 Kirim HTTP DELETE
    const delRes = await fetch(
      `${baseUrl}/api/pricing/samsat-tariffs?samsatId=${testSamsatId}&pricingItemId=${targetItemId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    assert.strictEqual(delRes.status, 200, "Delete samsat tariff via API should return 200 OK");

    // 3.2 Verifikasi fisik di database SQLite: baris harus terhapus
    const checkRow = directDb.prepare(`
      SELECT COUNT(*) as count 
      FROM samsat_operational_tariffs 
      WHERE samsat_id = ? AND pricing_item_id = ?
    `).get(testSamsatId, targetItemId) as any;

    assert.strictEqual(checkRow.count, 0, "Record must be physically deleted from SQLite database (count = 0)");
  });

  await t.test("4. Strict Discrepancy Matching Filter only includes offices with differing effective prices", async () => {
    // Siapkan state di pricingStore
    await pricingStore.updateNationalDefault("mutasi-hadir", { basePrice: 75000 });
    await pricingStore.updateNationalDefault("mutasi-bantuan", { basePrice: 60000 });

    // Kantor A: override berbeda (80.000 vs 75.000) -> HARUS MASUK FILTER
    await pricingStore.setSamsatOverride("samsat-jakbar", "mutasi-hadir", 80000);

    // Kantor B: override bernilai SAMA dengan default nasional (60.000 vs 60.000) -> TIDAK BOLEH MASUK FILTER
    // (diuji jika ada record yang nominalnya sama)
    let mapJaksel = (pricingStore as any).samsatOverrides.get("samsat-jaksel");
    if (!mapJaksel) {
      mapJaksel = new Map();
      (pricingStore as any).samsatOverrides.set("samsat-jaksel", mapJaksel);
    }
    mapJaksel.set("mutasi-bantuan", { nominal: 60000, isActive: true });

    // Kantor C: override tidak aktif (isActive = false) -> TIDAK BOLEH MASUK FILTER
    let mapBekasi = (pricingStore as any).samsatOverrides.get("samsat-bekasi");
    if (!mapBekasi) {
      mapBekasi = new Map();
      (pricingStore as any).samsatOverrides.set("samsat-bekasi", mapBekasi);
    }
    mapBekasi.set("mutasi-bantuan", { nominal: 90000, isActive: false });

    // Uji fungsi Strict Discrepancy Matching
    const customOffices = pricingStore.getOfficesWithCustomPricing();

    assert.ok(customOffices.has("samsat-jakbar"), "Kantor A (harga berbeda) wajib lolos filter");
    assert.strictEqual(customOffices.has("samsat-jaksel"), false, "Kantor B (harga sama dengan nasional) TIDAK boleh lolos filter");
    assert.strictEqual(customOffices.has("samsat-bekasi"), false, "Kantor C (override nonaktif) TIDAK boleh lolos filter");
    assert.strictEqual(customOffices.has("samsat-bandung"), false, "Kantor tanpa override TIDAK boleh lolos filter");
  });
});
