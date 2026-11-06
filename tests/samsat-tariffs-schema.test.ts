import test from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { initializeSchema } from "../server/src/database/schema";

test("Phase 1: Database Schema - samsat_operational_tariffs creation and constraints", () => {
  const memDb = new DatabaseSync(":memory:");
  memDb.exec("PRAGMA foreign_keys = ON;");
  initializeSchema(memDb);

  // Check table existence
  const tableCheck = memDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='samsat_operational_tariffs'").get() as any;
  assert.ok(tableCheck, "Table samsat_operational_tariffs should exist");

  // Insert a test office and pricing item first
  memDb.prepare(`
    INSERT INTO samsat_offices (id, name, wilayah, is_verified, status_aktif)
    VALUES ('samsat-jakbar', 'Samsat Jakarta Barat', 'Jakarta Barat', 1, 1)
  `).run();

  memDb.prepare(`
    INSERT INTO samsat_pricing (id, nama_item, kategori, tipe_kendaraan, biaya_dasar, data_json, is_active, is_configured)
    VALUES ('cek-fisik', 'Cek Fisik Standar', 'Layanan Standar', 'Mobil', 30000, '{}', 1, 1)
  `).run();

  memDb.prepare(`
    INSERT INTO samsat_pricing (id, nama_item, kategori, tipe_kendaraan, biaya_dasar, data_json, is_active, is_configured)
    VALUES ('legalisir', 'Legalisir Berkas', 'Layanan Standar', 'Mobil', 50000, '{}', 1, 1)
  `).run();

  // Insert tariff
  memDb.prepare(`
    INSERT INTO samsat_operational_tariffs (id, samsat_id, pricing_item_id, nominal, is_active)
    VALUES ('tar-1', 'samsat-jakbar', 'cek-fisik', 30000, 1)
  `).run();

  const inserted = memDb.prepare("SELECT * FROM samsat_operational_tariffs WHERE id = 'tar-1'").get() as any;
  assert.strictEqual(inserted.samsat_id, "samsat-jakbar");
  assert.strictEqual(inserted.pricing_item_id, "cek-fisik");
  assert.strictEqual(inserted.nominal, 30000);
  assert.strictEqual(inserted.is_active, 1);

  // Test duplicate unique constraint (samsat_id, pricing_item_id)
  assert.throws(() => {
    memDb.prepare(`
      INSERT INTO samsat_operational_tariffs (id, samsat_id, pricing_item_id, nominal, is_active)
      VALUES ('tar-dup', 'samsat-jakbar', 'cek-fisik', 50000, 1)
    `).run();
  }, /UNIQUE constraint failed/i);

  // Test check constraint (nominal >= 0)
  assert.throws(() => {
    memDb.prepare(`
      INSERT INTO samsat_operational_tariffs (id, samsat_id, pricing_item_id, nominal, is_active)
      VALUES ('tar-neg', 'samsat-jakbar', 'legalisir', -500, 1)
    `).run();
  }, /CHECK constraint failed/i);

  // Test FK constraint to samsat_offices
  assert.throws(() => {
    memDb.prepare(`
      INSERT INTO samsat_operational_tariffs (id, samsat_id, pricing_item_id, nominal, is_active)
      VALUES ('tar-fk-office', 'samsat-non-existent', 'legalisir', 50000, 1)
    `).run();
  }, /FOREIGN KEY constraint failed/i);

  // Test FK constraint to samsat_pricing (pricing_item_id)
  assert.throws(() => {
    memDb.prepare(`
      INSERT INTO samsat_operational_tariffs (id, samsat_id, pricing_item_id, nominal, is_active)
      VALUES ('tar-fk-item', 'samsat-jakbar', 'non-existent-item', 50000, 1)
    `).run();
  }, /FOREIGN KEY constraint failed/i);

  memDb.close();
});
