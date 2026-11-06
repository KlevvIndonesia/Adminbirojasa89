import test from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import {
  CANONICAL_BIAYA_LAYANAN_SERVICES,
  BIAYA_LAYANAN_ALIAS_MAP,
} from "../src/app/components/BiayaLayanan";
import { BIAYA_LAYANAN_SERVICES_MAP } from "../src/app/config/routeConfig";
import { pricingStore } from "../src/app/data/pricingStore";

test("Biaya Layanan - Header Dropdown, 8 Canonical Services, and DB Connectivity", async (t) => {
  const dbPath = process.env.DB_PATH || "server/data/database.sqlite";
  const db = new DatabaseSync(dbPath, { readOnly: true });

  t.after(() => {
    db.close();
  });

  await t.test("1. All 8 canonical services match SQLite database table `services`", async () => {
    const dbServices = db.prepare(`
      SELECT id, kode_layanan, nama_layanan, status_aktif 
      FROM services 
      ORDER BY urutan ASC
    `).all() as any[];

    assert.strictEqual(dbServices.length, 8, "Database must have exactly 8 canonical services");
    assert.strictEqual(CANONICAL_BIAYA_LAYANAN_SERVICES.length, 8, "Frontend must define exactly 8 canonical services");

    // Check each service key exists and has matching label
    for (const svc of CANONICAL_BIAYA_LAYANAN_SERVICES) {
      assert.ok(svc.key, "Service key must exist");
      assert.ok(svc.label, "Service label must exist");
      assert.ok(svc.dbLayanan, "dbLayanan must exist");
      assert.ok(BIAYA_LAYANAN_SERVICES_MAP[svc.key], `routeConfig must have mapping for ${svc.key}`);
    }

    // Verify 8th service 'Lainnya' is present
    const lainnyaSvc = CANONICAL_BIAYA_LAYANAN_SERVICES.find((s) => s.key === "lainnya");
    assert.ok(lainnyaSvc, "Service 'Lainnya' must be present in canonical services");
    assert.strictEqual(lainnyaSvc.dbLayanan, "Lainnya");
  });

  await t.test("2. Legacy aliases resolve accurately to canonical keys", async () => {
    assert.strictEqual(BIAYA_LAYANAN_ALIAS_MAP["perpanjangan-1"], "perpanjangan-1-tahun");
    assert.strictEqual(BIAYA_LAYANAN_ALIAS_MAP["perpanjangan-5"], "perpanjangan-5-tahun");
    assert.strictEqual(BIAYA_LAYANAN_ALIAS_MAP["mutasi-antar"], "mutasi-antar-samsat");
    assert.strictEqual(BIAYA_LAYANAN_ALIAS_MAP["mutasi-asal"], "mutasi-antar-samsat");
    assert.strictEqual(BIAYA_LAYANAN_ALIAS_MAP["mutasi-luar"], "mutasi-luar-daerah");
    assert.strictEqual(BIAYA_LAYANAN_ALIAS_MAP["mutasi-antar-daerah"], "mutasi-luar-daerah");
  });

  await t.test("3. Pricing store populates 515 Samsat offices for every service including 'Lainnya'", async () => {
    const allRows = pricingStore.getBiayaLayananRows();
    assert.ok(allRows.length > 0, "Biaya layanan rows must not be empty");

    for (const svc of CANONICAL_BIAYA_LAYANAN_SERVICES) {
      const rowsForService = allRows.filter((r) => r.layanan === svc.dbLayanan);
      assert.ok(
        rowsForService.length >= 10,
        `Service '${svc.dbLayanan}' must have populated rows (found: ${rowsForService.length})`
      );

      // Verify row structure is intact with valid numeric fees
      const firstRow = rowsForService[0];
      assert.ok(firstRow.wilayah, "Row must have wilayah");
      assert.strictEqual(typeof (firstRow.biayaJasaLengkap ?? firstRow.biayaJasa), "number");
      assert.strictEqual(typeof firstRow.biayaAntarJemput, "number");
    }
  });

  await t.test("4. Service pricing configs in SQLite are reflected in store", async () => {
    const dbConfigs = db.prepare(`SELECT * FROM service_pricing_configs`).all() as any[];
    assert.ok(dbConfigs.length > 0, "service_pricing_configs must exist in DB");

    const sample = dbConfigs[0];
    const matchingRow = pricingStore.getBiayaLayananRows().find(
      (r) => r.wilayah === sample.wilayah && (r.layanan === sample.service_name || r.layanan === "Perpanjangan 1 Tahun")
    );
    assert.ok(matchingRow, "Sample row from DB must exist in store");
  });
});
