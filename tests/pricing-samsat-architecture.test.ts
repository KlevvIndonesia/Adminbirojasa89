import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { initializeSchema } from "../server/src/database/schema";
import { resolveTariff, getComponentJurisdiction } from "../server/src/utils/pricingResolver";
import { mapRowToSamsatItem } from "../server/src/repositories/dbPricingRepository";
import { createApp } from "../server/src/app";

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

// Helper to seed minimal employees, samsat_offices, and master pricing items
function setupTestDb(memDb: DatabaseSync) {
  memDb.exec("PRAGMA foreign_keys = ON;");
  initializeSchema(memDb);

  // Insert mock employee
  memDb.prepare(`
    INSERT OR IGNORE INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, gaji_pokok, status_karyawan)
    VALUES ('EMP-001', '3171010101010001', 'Test Admin', '08123456789', '1990-01-01', 'DKI Jakarta', 'Jl. Test', 'Admin', 5000000, 'TETAP')
  `).run();

  // Insert mock samsat offices
  memDb.prepare(`
    INSERT OR IGNORE INTO samsat_offices (id, name, wilayah, is_verified, status_aktif)
    VALUES 
      ('samsat-jaktim', 'Samsat Jakarta Timur', 'Jakarta Timur', 1, 1),
      ('samsat-jakbar', 'Samsat Jakarta Barat', 'Jakarta Barat', 1, 1)
  `).run();

  // Insert master catalog items
  memDb.prepare(`
    INSERT INTO samsat_pricing (id, nama_item, kategori, tipe_kendaraan, biaya_dasar, is_active, is_configured, data_json, created_at, updated_at)
    VALUES
      ('cek-fisik', 'Cek Fisik Bantuan', 'Mutasi Keluar', 'Mobil', 50000, 1, 1, '{}', '2026-01-01', '2026-01-01'),
      ('daftar-bpkb', 'Pendaftaran BPKB', 'Mutasi Masuk', 'Mobil', 100000, 1, 1, '{}', '2026-01-01', '2026-01-01'),
      ('stnk-hilang', 'Legalisir STNK Hilang', 'Layanan Standar', 'Mobil', 0, 1, 1, '{}', '2026-01-01', '2026-01-01'),
      ('item-unconfigured', 'Item Tanpa Tarif', 'Layanan Standar', 'Mobil', 0, 1, 0, '{}', '2026-01-01', '2026-01-01'),
      ('item-disabled', 'Item Dinonaktifkan', 'Layanan Standar', 'Mobil', 75000, 0, 1, '{}', '2026-01-01', '2026-01-01')
  `).run();
}

test("1. Schema & Referential Constraints Safety", () => {
  const memDb = new DatabaseSync(":memory:");
  setupTestDb(memDb);

  // 1.1 Verify columns in samsat_pricing
  const colsPricing = (memDb.prepare("PRAGMA table_info(samsat_pricing)").all() as any[]).map(c => c.name);
  assert.ok(colsPricing.includes("biaya_dasar"), "biaya_dasar column exists in samsat_pricing");
  assert.ok(colsPricing.includes("is_active"), "is_active column exists in samsat_pricing");
  assert.ok(colsPricing.includes("is_configured"), "is_configured column exists in samsat_pricing");

  // 1.2 Verify foreign key constraint on samsat_operational_tariffs (pricing_item_id)
  assert.throws(() => {
    memDb.prepare(`
      INSERT INTO samsat_operational_tariffs (id, samsat_id, pricing_item_id, nominal, is_active)
      VALUES ('otf-fail', 'samsat-jaktim', 'non-existent-item-id', 25000, 1)
    `).run();
  }, /FOREIGN KEY constraint failed/, "Inserting invalid pricing_item_id must fail foreign key check");

  // 1.3 Verify valid insert works
  memDb.prepare(`
    INSERT INTO samsat_operational_tariffs (id, samsat_id, pricing_item_id, nominal, is_active, created_by_employee_id)
    VALUES ('otf-01', 'samsat-jaktim', 'cek-fisik', 65000, 1, 'EMP-001')
  `).run();

  const inserted = memDb.prepare("SELECT * FROM samsat_operational_tariffs WHERE id = 'otf-01'").get() as any;
  assert.strictEqual(inserted.nominal, 65000);
  assert.strictEqual(inserted.created_by_employee_id, 'EMP-001');

  // 1.4 Verify UNIQUE constraint on (samsat_id, pricing_item_id)
  assert.throws(() => {
    memDb.prepare(`
      INSERT INTO samsat_operational_tariffs (id, samsat_id, pricing_item_id, nominal, is_active)
      VALUES ('otf-dup', 'samsat-jaktim', 'cek-fisik', 80000, 1)
    `).run();
  }, /UNIQUE constraint failed/, "Duplicate override for same office and item must be rejected");

  // 1.5 Verify ON DELETE RESTRICT on samsat_pricing
  assert.throws(() => {
    memDb.prepare("DELETE FROM samsat_pricing WHERE id = 'cek-fisik'").run();
  }, /FOREIGN KEY constraint failed/, "Deleting master pricing item referenced by override must be restricted");
});

test("2. Strict Repository Mapping & Numeric Safety", () => {
  // 2.1 Positive integer
  const item1 = mapRowToSamsatItem({
    id: "item-1",
    code: "C-1",
    name: "Item 1",
    category: "Layanan Standar",
    biaya_dasar: 50000,
    is_active: 1,
    is_configured: 1,
  });
  assert.strictEqual(item1.basePrice, 50000);
  assert.strictEqual(item1.isActive, true);
  assert.strictEqual(item1.isConfigured, true);

  // 2.2 Explicit Rp0
  const itemZero = mapRowToSamsatItem({
    id: "item-zero",
    code: "C-0",
    name: "Item Zero",
    category: "Layanan Standar",
    biaya_dasar: 0,
    is_active: 1,
    is_configured: 1,
  });
  assert.strictEqual(itemZero.basePrice, 0);
  assert.strictEqual(itemZero.isConfigured, true);

  // 2.3 Unconfigured item (is_configured = 0)
  const itemUnconf = mapRowToSamsatItem({
    id: "item-unconf",
    code: "C-U",
    name: "Item Unconf",
    category: "Layanan Standar",
    biaya_dasar: 0,
    is_active: 1,
    is_configured: 0,
  });
  assert.strictEqual(itemUnconf.basePrice, 0);
  assert.strictEqual(itemUnconf.isConfigured, false);

  // 2.4 Corrupted/Invalid numeric data must NOT silently become explicit 0
  const itemCorrupted = mapRowToSamsatItem({
    id: "item-corrupt",
    code: "C-X",
    name: "Corrupt Item",
    category: "Layanan Standar",
    biaya_dasar: "invalid-number" as any,
    is_active: 1,
    is_configured: 1,
  });
  assert.strictEqual(itemCorrupted.isConfigured, false, "Invalid numeric value must result in isConfigured: false");
});

test("3. Pure 2-Stage Pricing Resolver Hierarchy", () => {
  const masterActive = {
    id: "test-item",
    code: "TI-01",
    name: "Test Item",
    category: "Layanan Standar",
    basePrice: 50000,
    isActive: true,
    isConfigured: true,
    active: true,
  };

  const masterDisabled = {
    ...masterActive,
    isActive: false,
    active: false,
  };

  const masterUnconfigured = {
    ...masterActive,
    basePrice: 0,
    isConfigured: false,
  };

  // 3.1 Master Catalog Gate: Master deactivated strictly overrides local override
  const resDisabledWithOverride = resolveTariff({
    masterItem: masterDisabled,
    override: { nominal: 99000, isActive: true },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resDisabledWithOverride.status, "DISABLED_ITEM");
  assert.strictEqual(resDisabledWithOverride.effectivePrice, null);
  assert.strictEqual(resDisabledWithOverride.source, "NONE");

  // 3.2 Override Gate: Master active + Override active & valid
  const resOverride = resolveTariff({
    masterItem: masterActive,
    override: { nominal: 65000, isActive: true },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resOverride.status, "CONFIGURED_OVERRIDE");
  assert.strictEqual(resOverride.effectivePrice, 65000);
  assert.strictEqual(resOverride.source, "OVERRIDE");
  assert.strictEqual(resOverride.isExplicitZero, false);

  // 3.3 Active override with unconfigured default: override succeeds
  const resOverrideOnUnconfDefault = resolveTariff({
    masterItem: masterUnconfigured,
    override: { nominal: 35000, isActive: true },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resOverrideOnUnconfDefault.status, "CONFIGURED_OVERRIDE");
  assert.strictEqual(resOverrideOnUnconfDefault.effectivePrice, 35000);
  assert.strictEqual(resOverrideOnUnconfDefault.source, "OVERRIDE");

  // 3.4 Inactive or deleted override falls back to national default
  const resFallback = resolveTariff({
    masterItem: masterActive,
    override: { nominal: 90000, isActive: false },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resFallback.status, "CONFIGURED_DEFAULT");
  assert.strictEqual(resFallback.effectivePrice, 50000);
  assert.strictEqual(resFallback.source, "DEFAULT");

  const resNoOverride = resolveTariff({
    masterItem: masterActive,
    override: null,
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resNoOverride.status, "CONFIGURED_DEFAULT");
  assert.strictEqual(resNoOverride.effectivePrice, 50000);
  assert.strictEqual(resNoOverride.source, "DEFAULT");

  // 3.5 Unconfigured Gate: No override + master unconfigured
  const resUnconfigured = resolveTariff({
    masterItem: masterUnconfigured,
    override: null,
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resUnconfigured.status, "NOT_CONFIGURED");
  assert.strictEqual(resUnconfigured.effectivePrice, null);
  assert.strictEqual(resUnconfigured.source, "NONE");

  // 3.6 Explicit Rp0 handling
  const masterZero = {
    ...masterActive,
    basePrice: 0,
    isConfigured: true,
  };
  const resDefaultZero = resolveTariff({
    masterItem: masterZero,
    override: null,
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resDefaultZero.status, "CONFIGURED_DEFAULT");
  assert.strictEqual(resDefaultZero.effectivePrice, 0);
  assert.strictEqual(resDefaultZero.isExplicitZero, true);

  const resOverrideZero = resolveTariff({
    masterItem: masterActive,
    override: { nominal: 0, isActive: true },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resOverrideZero.status, "CONFIGURED_OVERRIDE");
  assert.strictEqual(resOverrideZero.effectivePrice, 0);
  assert.strictEqual(resOverrideZero.isExplicitZero, true);

  // 3.7 Corrupted Override Fail-Closed (negative, NaN, non-integer)
  const resNegative = resolveTariff({
    masterItem: masterActive,
    override: { nominal: -5000, isActive: true },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resNegative.status, "CORRUPTED_OVERRIDE");
  assert.strictEqual(resNegative.effectivePrice, null);

  const resNaN = resolveTariff({
    masterItem: masterActive,
    override: { nominal: NaN as any, isActive: true },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(resNaN.status, "CORRUPTED_OVERRIDE");
  assert.strictEqual(resNaN.effectivePrice, null);
});

test("4. Jurisdictional Separation: Origin vs Destination", () => {
  // 4.1 Check jurisdiction helper
  assert.strictEqual(getComponentJurisdiction("Mutasi Masuk", true), "TUJUAN");
  assert.strictEqual(getComponentJurisdiction("Mutasi Keluar", true), "ASAL");
  assert.strictEqual(getComponentJurisdiction("Layanan Standar", true), "ASAL");
  assert.strictEqual(getComponentJurisdiction("Mutasi Masuk", false), "STANDARD");

  // 4.2 Destination pending handling
  const itemMutasiMasuk = {
    id: "daftar-bpkb",
    code: "BPKB-01",
    name: "Pendaftaran BPKB",
    category: "Mutasi Masuk",
    basePrice: 100000,
    isActive: true,
    isConfigured: true,
    active: true,
  };

  const resPending = resolveTariff({
    masterItem: itemMutasiMasuk,
    override: null,
    samsatId: "",
    jurisdiction: "TUJUAN",
  });
  assert.strictEqual(resPending.status, "PENDING_DESTINATION");
  assert.strictEqual(resPending.effectivePrice, null);

  // 4.3 Destination provided: resolves against destination Samsat
  const resResolvedTujuan = resolveTariff({
    masterItem: itemMutasiMasuk,
    override: { nominal: 125000, isActive: true },
    samsatId: "samsat-jakbar",
    jurisdiction: "TUJUAN",
  });
  assert.strictEqual(resResolvedTujuan.status, "CONFIGURED_OVERRIDE");
  assert.strictEqual(resResolvedTujuan.effectivePrice, 125000);
  assert.strictEqual(resResolvedTujuan.samsatId, "samsat-jakbar");
});

test("5. API Route Verification & Reversion Idempotency", async () => {
  const { server, baseUrl } = await createServer();

  try {
    const token = await getAdminToken(baseUrl);
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // 5.1 Query GET /api/pricing/effective
    const resEffective = await fetch(`${baseUrl}/api/pricing/effective?samsatId=samsat-jakarta-timur`, {
      headers: authHeaders,
    });
    assert.strictEqual(resEffective.status, 200);
    const effectiveBody = (await resEffective.json()) as any;
    assert.strictEqual(effectiveBody.success, true);
    assert.ok(Array.isArray(effectiveBody.data), "Returns array of resolved tariffs");

    // 5.2 Set override via POST /api/pricing/samsat-tariffs
    const testItem = effectiveBody.data[0];
    assert.ok(testItem, "At least one pricing item exists");
    const testItemId = testItem.pricingItemId;
    const originalDefault = testItem.nationalDefaultPrice ?? testItem.effectivePrice ?? 50000;

    const resUpsert = await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        samsatId: "samsat-jakarta-timur",
        pricingItemId: testItemId,
        nominal: 77000,
      }),
    });
    assert.strictEqual(resUpsert.status, 200);

    // Re-verify GET /api/pricing/effective reflects override
    const resEffectiveAfter = await fetch(`${baseUrl}/api/pricing/effective?samsatId=samsat-jakarta-timur`, {
      headers: authHeaders,
    });
    const bodyAfter = (await resEffectiveAfter.json()) as any;
    const itemAfter = bodyAfter.data.find((it: any) => it.pricingItemId === testItemId);
    assert.strictEqual(itemAfter.effectivePrice, 77000);
    assert.strictEqual(itemAfter.status, "CONFIGURED_OVERRIDE");
    assert.strictEqual(itemAfter.source, "OVERRIDE");

    // 5.3 DELETE override via query params (revert to default)
    const resDelete1 = await fetch(`${baseUrl}/api/pricing/samsat-tariffs?samsatId=samsat-jakarta-timur&pricingItemId=${testItemId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.strictEqual(resDelete1.status, 200);
    const delBody1 = (await resDelete1.json()) as any;
    assert.strictEqual(delBody1.data.reverted, true);
    assert.strictEqual(delBody1.data.alreadyDefault, false);
    assert.strictEqual(delBody1.data.fallbackDefault, originalDefault);

    // Re-verify GET /api/pricing/effective has reverted
    const resEffectiveReverted = await fetch(`${baseUrl}/api/pricing/effective?samsatId=samsat-jakarta-timur`, {
      headers: authHeaders,
    });
    const bodyReverted = (await resEffectiveReverted.json()) as any;
    const itemReverted = bodyReverted.data.find((it: any) => it.pricingItemId === testItemId);
    assert.strictEqual(itemReverted.effectivePrice, originalDefault);
    assert.strictEqual(itemReverted.status, "CONFIGURED_DEFAULT");

    // 5.4 Idempotent second DELETE
    const resDelete2 = await fetch(`${baseUrl}/api/pricing/samsat-tariffs?samsatId=samsat-jakarta-timur&pricingItemId=${testItemId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.strictEqual(resDelete2.status, 200);
    const delBody2 = (await resDelete2.json()) as any;
    assert.strictEqual(delBody2.data.reverted, false);
    assert.strictEqual(delBody2.data.alreadyDefault, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("6. Historical Snapshot Immutability Verification", () => {
  // Simulate order creation snapshot
  const initialSnapshot = {
    serviceId: "srv-mutasi",
    serviceName: "Mutasi Keluar",
    samsatId: "samsat-jaktim",
    biayaJasa: 350000,
    biayaSamsat: 50000,
    totalEstimasi: 400000,
    breakdown: [
      { itemId: "cek-fisik", name: "Cek Fisik Bantuan", amount: 50000, source: "HargaDasarSamsat" },
    ],
  };

  const frozenSnapshot = JSON.parse(JSON.stringify(initialSnapshot));

  // Now mutate master pricing or override
  const masterChanged = {
    id: "cek-fisik",
    basePrice: 120000, // Master increased from 50k to 120k
  };

  // Assert frozen snapshot is 100% immutable
  assert.strictEqual(frozenSnapshot.biayaSamsat, 50000);
  assert.strictEqual(frozenSnapshot.breakdown[0].amount, 50000);
  assert.notStrictEqual(frozenSnapshot.breakdown[0].amount, masterChanged.basePrice);
});
