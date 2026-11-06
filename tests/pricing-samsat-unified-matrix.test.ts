import test from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { initializeSchema, cleanupLegacyStandardPricingItems } from "../server/src/database/schema";
import { pricingStore, MASTER_PRICING_ITEMS } from "../src/app/data/pricingStore";

test("Unified Matrix & Standard Cleanup Test Suite", async (t) => {
  const memDb = new DatabaseSync(":memory:");
  memDb.exec("PRAGMA foreign_keys = ON;");

  await t.test("1. Schema Initialization & Cleanup of 5 Legacy Standard Items", () => {
    initializeSchema(memDb);

    const insertPricing = memDb.prepare(`
      INSERT OR REPLACE INTO samsat_pricing (id, nama_item, kategori, tipe_kendaraan, biaya_dasar, is_active, is_configured, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert 5 legacy std items
    insertPricing.run("std-cek-fisik", "Cek Fisik Standard", "Layanan Standar", "Mobil", 30000, 1, 1, "{}");
    insertPricing.run("std-pendaftaran", "Pendaftaran", "Layanan Standar", "Mobil", 20000, 1, 1, "{}");
    insertPricing.run("std-cetak-stnk", "Cetak STNK", "Layanan Standar", "Mobil", 25000, 1, 1, "{}");
    insertPricing.run("std-cetak-plat", "Cetak Plat", "Layanan Standar", "Mobil", 35000, 1, 1, "{}");
    insertPricing.run("std-validasi-bpkb", "Validasi BPKB", "Layanan Standar", "Mobil", 50000, 1, 1, "{}");

    // Insert the 29 canonical Mutasi components
    MASTER_PRICING_ITEMS.forEach((item) => {
      insertPricing.run(item.id, item.name, item.category, "Mobil", 50000, 1, 1, "{}");
    });

    // Run cleanup
    const cleaned = cleanupLegacyStandardPricingItems(memDb);
    assert.strictEqual(cleaned, true, "First run should clean up 5 items and return true");

    // Verify 5 legacy standard items do NOT exist in samsat_pricing
    const stdItems = memDb.prepare(`
      SELECT COUNT(*) as count FROM samsat_pricing 
      WHERE id IN ('std-cek-fisik', 'std-pendaftaran', 'std-cetak-stnk', 'std-cetak-plat', 'std-validasi-bpkb')
    `).get() as { count: number };
    assert.strictEqual(stdItems.count, 0, "All 5 legacy standard items must be removed from samsat_pricing");

    // Verify exactly 29 mutasi components exist
    const mutasiItems = memDb.prepare(`
      SELECT COUNT(*) as count, kategori FROM samsat_pricing 
      GROUP BY kategori
    `).all() as Array<{ count: number; kategori: string }>;

    const keluarCount = mutasiItems.find((m) => m.kategori === "Mutasi Keluar")?.count ?? 0;
    const masukCount = mutasiItems.find((m) => m.kategori === "Mutasi Masuk")?.count ?? 0;
    assert.strictEqual(keluarCount, 18, "Must have exactly 18 Mutasi Keluar items in samsat_pricing");
    assert.strictEqual(masukCount, 11, "Must have exactly 11 Mutasi Masuk items in samsat_pricing");

    // Verify cleanupLegacyStandardPricingItems is idempotent
    const secondRun = cleanupLegacyStandardPricingItems(memDb);
    assert.strictEqual(secondRun, false, "Second run of cleanup should be a no-op (return false)");

    // Verify MASTER_PRICING_ITEMS has exactly 29 items
    assert.strictEqual(MASTER_PRICING_ITEMS.length, 29, "MASTER_PRICING_ITEMS must have exactly 29 items");
    const categories = new Set(MASTER_PRICING_ITEMS.map((i) => i.category));
    assert.deepStrictEqual(Array.from(categories).sort(), ["Mutasi Keluar", "Mutasi Masuk"].sort());
  });

  await t.test("2. Setting Override on Single Samsat Fixes Legacy Bug (No Master Mutation)", async () => {
    // Insert mock samsat offices
    memDb.prepare(`
      INSERT OR IGNORE INTO samsat_offices (id, name, wilayah, is_verified, status_aktif)
      VALUES 
        ('samsat-jaktim', 'Samsat Jakarta Timur', 'Jakarta Timur', 1, 1),
        ('samsat-jakbar', 'Samsat Jakarta Barat', 'Jakarta Barat', 1, 1)
    `).run();

    // Get national default price for mutasi-legalisir
    const defaultItem = memDb.prepare("SELECT biaya_dasar FROM samsat_pricing WHERE id = 'mutasi-legalisir'").get() as { biaya_dasar: number };
    const defaultPrice = defaultItem.biaya_dasar;
    assert.ok(defaultPrice > 0, "Default price should be > 0");

    // Set override for Samsat Jakarta Timur only
    const customPrice = 85000;
    assert.notStrictEqual(customPrice, defaultPrice);

    await pricingStore.setSamsatOverride("samsat-jaktim", "mutasi-legalisir", customPrice);

    // Verify Jakarta Timur has custom price
    const jaktimPrice = pricingStore.getSamsatPrice("samsat-jaktim", "mutasi-legalisir");
    assert.strictEqual(jaktimPrice, customPrice, "Jakarta Timur should have custom price");

    // Verify Jakarta Barat STILL has default price (NO cross-contamination)
    const jakbarPrice = pricingStore.getSamsatPrice("samsat-jakbar", "mutasi-legalisir");
    assert.strictEqual(jakbarPrice, defaultPrice, "Jakarta Barat must retain national default price");

    // Verify national default was NOT mutated
    const currentDefault = pricingStore.getNationalPricingItems().find((i) => i.id === "mutasi-legalisir")?.basePrice;
    assert.strictEqual(currentDefault, defaultPrice, "National default basePrice must remain untouched");
  });

  await t.test("3. Decision #2: Setting Price Equal to Default Reverts to Standard", async () => {
    const defaultPrice = pricingStore.getNationalPricingItems().find((i) => i.id === "mutasi-hadir")?.basePrice ?? 75000;

    // Set custom override first
    await pricingStore.setSamsatOverride("samsat-jaktim", "mutasi-hadir", 99000);
    assert.strictEqual(pricingStore.getSamsatPrice("samsat-jaktim", "mutasi-hadir"), 99000);

    // Now save batch where mutasi-hadir is set to defaultPrice
    await pricingStore.saveSamsatRowOverrides("samsat-jaktim", {
      "mutasi-hadir": defaultPrice,
    });

    // Should no longer be an override
    const tariffStatus = pricingStore.resolveEffectiveTariff("samsat-jaktim", "mutasi-hadir");
    assert.strictEqual(tariffStatus.source, "DEFAULT", "Setting equal to default price must revert to DEFAULT source");
    assert.strictEqual(tariffStatus.effectivePrice, defaultPrice);
  });

  await t.test("4. Reset All Overrides for Samsat Office", async () => {
    // Set 2 overrides on Jakarta Timur
    await pricingStore.setSamsatOverride("samsat-jaktim", "mutasi-cf", 120000);
    await pricingStore.setSamsatOverride("samsat-jaktim", "mutasi-bantuan", 95000);

    assert.ok(pricingStore.hasSamsatOverrides("samsat-jaktim"), "Must detect active overrides");

    // Reset all
    await pricingStore.resetAllSamsatOverrides("samsat-jaktim");

    assert.strictEqual(pricingStore.hasSamsatOverrides("samsat-jaktim"), false, "Must have zero overrides after resetAll");
    const cfStatus = pricingStore.resolveEffectiveTariff("samsat-jaktim", "mutasi-cf");
    assert.strictEqual(cfStatus.source, "DEFAULT", "CF must revert to DEFAULT source");
  });

  await t.test("5. Updating National Standard Propagates to Default-Following Offices", async () => {
    const newStandard = 60000;
    await pricingStore.updateNationalDefault("mutasi-bantuan", { basePrice: newStandard });

    // Jakarta Barat (no override) must immediately reflect new standard
    const jakbarPrice = pricingStore.getSamsatPrice("samsat-jakbar", "mutasi-bantuan");
    assert.strictEqual(jakbarPrice, newStandard, "Jakarta Barat should immediately reflect new national standard");

    // Now set override on Jakarta Timur
    await pricingStore.setSamsatOverride("samsat-jaktim", "mutasi-bantuan", 110000);

    // Update national standard again
    await pricingStore.updateNationalDefault("mutasi-bantuan", { basePrice: 65000 });

    // Jakarta Timur (with override) retains custom price
    assert.strictEqual(pricingStore.getSamsatPrice("samsat-jaktim", "mutasi-bantuan"), 110000, "Override office retains custom price");

    // Jakarta Barat updates to 65000
    assert.strictEqual(pricingStore.getSamsatPrice("samsat-jakbar", "mutasi-bantuan"), 65000, "Default office updates to 65000");
  });
});
