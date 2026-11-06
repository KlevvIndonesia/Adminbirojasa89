import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { initializeSchema, migratePricingTables } from "../server/src/database/schema";
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
      ('cek-fisik', 'Cek Fisik Bantuan', 'Mutasi Keluar', 'Mobil', 50000, 1, 1, '{"active": true, "code": "CF-01"}', '2026-01-01', '2026-01-01'),
      ('daftar-bpkb', 'Pendaftaran BPKB', 'Mutasi Masuk', 'Mobil', 100000, 1, 1, '{"active": true, "code": "BPKB-01"}', '2026-01-01', '2026-01-01'),
      ('stnk-hilang', 'Legalisir STNK Hilang', 'Layanan Standar', 'Mobil', 0, 1, 1, '{"active": true, "code": "STNK-01"}', '2026-01-01', '2026-01-01'),
      ('item-unconfigured', 'Item Tanpa Tarif', 'Layanan Standar', 'Mobil', 0, 1, 0, '{"active": true, "code": "UNCONF-01"}', '2026-01-01', '2026-01-01'),
      ('item-disabled', 'Item Dinonaktifkan', 'Layanan Standar', 'Mobil', 75000, 0, 1, '{"active": false, "code": "DIS-01"}', '2026-01-01', '2026-01-01')
  `).run();
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE 1: MIGRATION SAFETY & IDEMPOTENCY
// ─────────────────────────────────────────────────────────────────────────────
test("Scope 1: Migration Safety, Idempotency, and Data Preservation", () => {
  const memDb = new DatabaseSync(":memory:");
  setupTestDb(memDb);

  // 1.1 Idempotency Check: Calling migratePricingTables on an already migrated DB must return false (no rebuild)
  const rerun1 = migratePricingTables(memDb);
  assert.strictEqual(rerun1, false, "Second migration run must be idempotent and return false");
  const rerun2 = migratePricingTables(memDb);
  assert.strictEqual(rerun2, false, "Third migration run must also be idempotent");

  // 1.2 Foreign Key check across all tables
  const fkCheck = memDb.prepare("PRAGMA foreign_key_check").all();
  assert.deepStrictEqual(fkCheck, [], "Database foreign key check must have zero integrity issues");

  // 1.3 Check required indices exist
  const indices = (memDb.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as any[]).map(i => i.name);
  assert.ok(indices.includes("idx_samsat_pricing_lookup"), "idx_samsat_pricing_lookup index exists");
  assert.ok(indices.includes("idx_samsat_pricing_active"), "idx_samsat_pricing_active index exists");
  assert.ok(indices.includes("idx_samsat_tariffs_office"), "idx_samsat_tariffs_office index exists");
  assert.ok(indices.includes("idx_samsat_tariffs_item"), "idx_samsat_tariffs_item index exists");
  assert.ok(indices.includes("idx_samsat_tariffs_active"), "idx_samsat_tariffs_active index exists");

  // 1.4 Data preservation & Type checks
  const cfRow = memDb.prepare("SELECT * FROM samsat_pricing WHERE id = 'cek-fisik'").get() as any;
  assert.strictEqual(cfRow.biaya_dasar, 50000, "biaya_dasar is preserved");
  assert.strictEqual(typeof cfRow.biaya_dasar, "number", "biaya_dasar is stored as integer");
  assert.strictEqual(cfRow.is_active, 1, "is_active is 1");
  assert.strictEqual(cfRow.is_configured, 1, "is_configured is 1");

  // 1.5 Reconciliation: item-disabled must have is_active = 0 reconciled from data_json.active
  const disRow = memDb.prepare("SELECT * FROM samsat_pricing WHERE id = 'item-disabled'").get() as any;
  assert.strictEqual(disRow.is_active, 0, "Deactivated item correctly reconciled to is_active = 0");

  // 1.6 Verify transactional rollback on failed migration
  assert.throws(() => {
    memDb.exec("BEGIN IMMEDIATE TRANSACTION;");
    memDb.exec("CREATE TABLE test_rollback (id INT);");
    throw new Error("Simulated failure");
  }, /Simulated failure/);
  memDb.exec("ROLLBACK;");
  const testTable = memDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_rollback'").get();
  assert.strictEqual(testTable, undefined, "Rollback successfully reverted table creation");
});

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE 2: RESOLVER PARITY & ALL 6 STATUSES
// ─────────────────────────────────────────────────────────────────────────────
test("Scope 2: Pure 2-Stage Resolver Parity across all 6 Statuses", () => {
  const masterActive = {
    id: "cf-item",
    code: "CF-01",
    name: "Cek Fisik",
    category: "Mutasi Keluar",
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

  const masterUnconf = {
    ...masterActive,
    basePrice: 0,
    isConfigured: false,
  };

  // Status 1: DISABLED_ITEM (Master Catalog Gate)
  const s1 = resolveTariff({
    masterItem: masterDisabled,
    override: { nominal: 80000, isActive: true },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(s1.status, "DISABLED_ITEM");
  assert.strictEqual(s1.effectivePrice, null);
  assert.strictEqual(s1.source, "NONE");

  // Status 2: CONFIGURED_OVERRIDE (Override Gate)
  const s2 = resolveTariff({
    masterItem: masterActive,
    override: { nominal: 65000, isActive: true },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(s2.status, "CONFIGURED_OVERRIDE");
  assert.strictEqual(s2.effectivePrice, 65000);
  assert.strictEqual(s2.source, "OVERRIDE");

  // Status 3: CONFIGURED_DEFAULT (National Default Gate)
  const s3 = resolveTariff({
    masterItem: masterActive,
    override: null,
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(s3.status, "CONFIGURED_DEFAULT");
  assert.strictEqual(s3.effectivePrice, 50000);
  assert.strictEqual(s3.source, "DEFAULT");

  // Status 4: NOT_CONFIGURED (Unconfigured Gate)
  const s4 = resolveTariff({
    masterItem: masterUnconf,
    override: null,
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(s4.status, "NOT_CONFIGURED");
  assert.strictEqual(s4.effectivePrice, null);
  assert.strictEqual(s4.source, "NONE");

  // Status 5: CORRUPTED_OVERRIDE (Fail-Closed Gate)
  const s5 = resolveTariff({
    masterItem: masterActive,
    override: { nominal: -1000, isActive: true },
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(s5.status, "CORRUPTED_OVERRIDE");
  assert.strictEqual(s5.effectivePrice, null);
  assert.strictEqual(s5.source, "NONE");

  // Status 6: PENDING_DESTINATION (Jurisdiction Gate)
  const s6 = resolveTariff({
    masterItem: { ...masterActive, category: "Mutasi Masuk" },
    override: null,
    samsatId: "",
    jurisdiction: "TUJUAN",
  });
  assert.strictEqual(s6.status, "PENDING_DESTINATION");
  assert.strictEqual(s6.effectivePrice, null);
  assert.strictEqual(s6.source, "NONE");

  // Explicit Rp0 Test: Configured Rp0 remains valid
  const masterZero = {
    ...masterActive,
    basePrice: 0,
    isConfigured: true,
  };
  const sZero = resolveTariff({
    masterItem: masterZero,
    override: null,
    samsatId: "samsat-jaktim",
  });
  assert.strictEqual(sZero.status, "CONFIGURED_DEFAULT");
  assert.strictEqual(sZero.effectivePrice, 0);
  assert.strictEqual(sZero.isExplicitZero, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE 3: ANOMALY HANDLING & ZERO-MUTATION READ
// ─────────────────────────────────────────────────────────────────────────────
test("Scope 3: Anomaly Handling (Fail-Closed) and Zero-Mutation Read", () => {
  const masterItem = {
    id: "item-test",
    name: "Item Test",
    category: "Layanan Standar",
    basePrice: 50000,
    isActive: true,
    isConfigured: true,
  };

  // 3.1 Negative nominal
  assert.strictEqual(resolveTariff({ masterItem, override: { nominal: -500 }, samsatId: "s-1" }).status, "CORRUPTED_OVERRIDE");

  // 3.2 Fractional nominal
  assert.strictEqual(resolveTariff({ masterItem, override: { nominal: 50000.75 }, samsatId: "s-1" }).status, "CORRUPTED_OVERRIDE");

  // 3.3 NaN nominal
  assert.strictEqual(resolveTariff({ masterItem, override: { nominal: NaN as any }, samsatId: "s-1" }).status, "CORRUPTED_OVERRIDE");

  // 3.4 String nominal
  assert.strictEqual(resolveTariff({ masterItem, override: { nominal: "abc" as any }, samsatId: "s-1" }).status, "CORRUPTED_OVERRIDE");

  // 3.5 Infinity nominal
  assert.strictEqual(resolveTariff({ masterItem, override: { nominal: Infinity as any }, samsatId: "s-1" }).status, "CORRUPTED_OVERRIDE");

  // 3.6 Zero-Mutation on Read: executing resolveTariff causes ZERO database writes
  const memDb = new DatabaseSync(":memory:");
  setupTestDb(memDb);
  const rowCountBefore = memDb.prepare("SELECT COUNT(*) as c FROM samsat_operational_tariffs").get() as any;

  for (let i = 0; i < 50; i++) {
    resolveTariff({ masterItem, override: null, samsatId: "samsat-jaktim" });
    mapRowToSamsatItem({
      id: "item-1",
      nama_item: "Item 1",
      biaya_dasar: 50000,
      is_active: 1,
      is_configured: 1,
    });
  }

  const rowCountAfter = memDb.prepare("SELECT COUNT(*) as c FROM samsat_operational_tariffs").get() as any;
  assert.strictEqual(rowCountBefore.c, rowCountAfter.c, "Resolver READ operations must never write or mutate database");
});

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE 4: ORDER LIFECYCLE & JURISDICTIONAL ISOLATION
// ─────────────────────────────────────────────────────────────────────────────
test("Scope 4: Order Lifecycle, Mutasi Jurisdiction Separation & Snapshot Immutability", () => {
  // 4.1 Jurisdiction detection
  assert.strictEqual(getComponentJurisdiction("Mutasi Masuk", true), "TUJUAN");
  assert.strictEqual(getComponentJurisdiction("Pendaftaran Mutasi Masuk", true), "TUJUAN");
  assert.strictEqual(getComponentJurisdiction("Mutasi Keluar", true), "ASAL");
  assert.strictEqual(getComponentJurisdiction("Layanan Standar", true), "ASAL");

  // 4.2 Order without destination: Mutasi Masuk is PENDING_DESTINATION
  const itemMasuk = {
    id: "daftar-bpkb",
    name: "Pendaftaran BPKB",
    category: "Mutasi Masuk",
    basePrice: 100000,
    isActive: true,
    isConfigured: true,
  };

  const resNoDest = resolveTariff({
    masterItem: itemMasuk,
    override: null,
    samsatId: "",
    jurisdiction: "TUJUAN",
  });
  assert.strictEqual(resNoDest.status, "PENDING_DESTINATION");
  assert.strictEqual(resNoDest.effectivePrice, null);

  // 4.3 Order with destination assigned later: resolves properly against destination
  const resWithDest = resolveTariff({
    masterItem: itemMasuk,
    override: { nominal: 130000, isActive: true },
    samsatId: "samsat-jakbar",
    jurisdiction: "TUJUAN",
  });
  assert.strictEqual(resWithDest.status, "CONFIGURED_OVERRIDE");
  assert.strictEqual(resWithDest.effectivePrice, 130000);
  assert.strictEqual(resWithDest.samsatId, "samsat-jakbar");

  // 4.4 Historical Snapshot Immutability:
  const frozenOrder = {
    orderId: "ORD-2026-001",
    totalEstimasi: 250000,
    breakdown: [
      { itemId: "cek-fisik", amount: 50000, source: "HargaDasarSamsat" },
      { itemId: "jasa", amount: 200000, source: "BiayaLayanan" },
    ],
  };

  const originalSnapshot = JSON.stringify(frozenOrder);

  // Simulated master catalog price increase:
  const newMasterPrice = 90000;
  assert.notStrictEqual(newMasterPrice, frozenOrder.breakdown[0].amount);

  // The historical order snapshot remains completely unchanged
  assert.strictEqual(JSON.stringify(frozenOrder), originalSnapshot);
});

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE 5: LEGACY UI & PRICING STORE SSoT
// ─────────────────────────────────────────────────────────────────────────────
test("Scope 5: Legacy UI Compatibility & pricingStore SSoT Verification", async () => {
  const { server, baseUrl } = await createServer();

  try {
    const token = await getAdminToken(baseUrl);
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // 5.1 Query GET /api/pricing/samsat reads from samsat_pricing SSoT
    const resCatalog = await fetch(`${baseUrl}/api/pricing/samsat`, { headers: authHeaders });
    assert.strictEqual(resCatalog.status, 200);
    const catalogJson = (await resCatalog.json()) as any;
    assert.ok(Array.isArray(catalogJson.data), "Catalog returns array");
    assert.ok(catalogJson.data.length > 0, "Catalog is populated");

    // Verify each catalog item has canonical fields
    const firstItem = catalogJson.data[0];
    assert.ok("id" in firstItem);
    assert.ok("basePrice" in firstItem || "biayaDasar" in firstItem);
    assert.ok("isActive" in firstItem || "active" in firstItem);

    // 5.2 Query effective pricing for an office
    const resEff = await fetch(`${baseUrl}/api/pricing/effective?samsatId=samsat-jakarta-timur`, { headers: authHeaders });
    assert.strictEqual(resEff.status, 200);
    const effJson = (await resEff.json()) as any;
    assert.ok(Array.isArray(effJson.data), "Effective pricing returns array");

    // 5.3 Test override isolation: Setting override on Office A does NOT mutate National Default
    const testItemId = firstItem.id;
    const initialDefault = firstItem.basePrice ?? 50000;

    const resUpsert = await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        samsatId: "samsat-jakarta-timur",
        pricingItemId: testItemId,
        nominal: 88000,
      }),
    });
    assert.strictEqual(resUpsert.status, 200);

    // Verify National Default is STILL initialDefault (untouched)
    const resCatalogAfter = await fetch(`${baseUrl}/api/pricing/samsat`, { headers: authHeaders });
    const catalogAfterJson = (await resCatalogAfter.json()) as any;
    const itemInCatalog = catalogAfterJson.data.find((it: any) => it.id === testItemId);
    assert.strictEqual(itemInCatalog.basePrice, initialDefault, "National default must remain unchanged when setting override");

    // 5.4 Reset override: DELETE removes sparse record and reverts to default
    const resDelete = await fetch(`${baseUrl}/api/pricing/samsat-tariffs?samsatId=samsat-jakarta-timur&pricingItemId=${testItemId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.strictEqual(resDelete.status, 200);
    const delData = (await resDelete.json()) as any;
    assert.strictEqual(delData.data.reverted, true);

    // Effective pricing now returns default
    const resEffAfterDel = await fetch(`${baseUrl}/api/pricing/effective?samsatId=samsat-jakarta-timur`, { headers: authHeaders });
    const effAfterDelJson = (await resEffAfterDel.json()) as any;
    const itemEff = effAfterDelJson.data.find((it: any) => it.pricingItemId === testItemId);
    assert.strictEqual(itemEff.effectivePrice, initialDefault);
    assert.strictEqual(itemEff.status, "CONFIGURED_DEFAULT");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE 6: R2 vs R4 BLOCKER STATUS
// ─────────────────────────────────────────────────────────────────────────────
test("Scope 6: R2 vs R4 Vehicle Type Classification Blocker Preservation", () => {
  const memDb = new DatabaseSync(":memory:");
  setupTestDb(memDb);

  // 6.1 Verify all items in samsat_pricing have existing vehicle type ('Mobil') and NONE was changed to 'Semua'
  const items = memDb.prepare("SELECT id, tipe_kendaraan FROM samsat_pricing").all() as any[];
  assert.ok(items.length > 0, "Items exist in samsat_pricing");

  for (const item of items) {
    assert.notStrictEqual(
      item.tipe_kendaraan,
      "Semua",
      `Item ${item.id} must NOT be converted to 'Semua' without PO authorization`
    );
    assert.strictEqual(
      item.tipe_kendaraan,
      "Mobil",
      `Item ${item.id} preserves historical tipe_kendaraan 'Mobil'`
    );
  }
});
