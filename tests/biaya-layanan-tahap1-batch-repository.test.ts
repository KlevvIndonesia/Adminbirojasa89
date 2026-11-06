import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../server/src/database/db";
import {
  dbPricingRepository,
  SERVICE_CANONICAL_BASELINES,
} from "../server/src/repositories/dbPricingRepository";

test("Biaya Layanan Tahap 1: SQLite Atomic Batch Replicate Repository Verification", async (t) => {
  const db = getDb();
  const serviceId = "svc-perp-1th";
  const serviceName = "Perpanjangan 1 Tahun";

  await t.test("1. Verify Canonical Baselines & 515 Samsat Offices in SQLite", () => {
    assert.ok(SERVICE_CANONICAL_BASELINES[serviceId], "Baseline must exist for service");
    assert.equal(SERVICE_CANONICAL_BASELINES[serviceId].jasa, 250000);
    assert.equal(SERVICE_CANONICAL_BASELINES[serviceId].kurir, 50000);

    const officesCount: any = db
      .prepare("SELECT count(*) as count FROM samsat_offices WHERE status_aktif = 1")
      .get();
    assert.equal(officesCount.count, 515, "Must have exactly 515 active Samsat offices");
  });

  await t.test("2. Setup Pre-existing Custom Tariff for Samsat Jakarta Timur", () => {
    const customConfig = {
      id: `${serviceId}:samsat-jakarta-timur`,
      serviceId,
      serviceName,
      samsatId: "samsat-jakarta-timur",
      wilayah: "Jakarta Timur",
      biayaJasa: 320000,
      biayaJasaLengkap: 320000,
      jasaLengkapEnabled: true,
      biayaPengurusanKhusus: 450000,
      biayaJasaNembak: 450000,
      pengurusanKhususEnabled: true,
      jasaNembakEnabled: true,
      biayaAntarJemput: 80000,
      antarJemputEnabled: true,
      antarJemputMode: "Antar & Jemput",
      swdkllj: { nominal: 143000, enabled: true },
      opsenPkb: { nominal: 143000, enabled: true },
      biayaLainnya: [
        { id: "bl-custom-1", label: "Parkir Lapangan Khusus", nominal: 25000, enabled: true, includesInTotal: true },
      ],
      active: true,
    };

    const saved = dbPricingRepository.upsertServicePricing(customConfig.id, customConfig);
    assert.ok(saved, "Upsert custom tariff must succeed");

    const row = dbPricingRepository.getServicePricingById(customConfig.id);
    assert.equal(row.biayaJasa, 320000);
    assert.equal(row.biayaAntarJemput, 80000);
  });

  await t.test("3. Batch Replicate with PRESERVE_EXISTING_CUSTOM: Preserves Custom Tariff in SQLite", () => {
    const sourceConfig = {
      biayaJasaLengkap: 260000,
      jasaLengkapEnabled: true,
      biayaJasaNembak: 350000,
      jasaNembakEnabled: false,
      biayaAntarJemput: 55000,
      antarJemputEnabled: true,
      antarJemputMode: "Antar & Jemput",
      nominalSwdkllj: 143000,
      swdklljEnabled: true,
      biayaLainnya: [
        { id: "bl-src-1", label: "Materai Standar", nominal: 10000, enabled: true, includesInTotal: true },
      ],
    };

    const result = dbPricingRepository.batchReplicateServicePricing({
      serviceId,
      serviceName,
      sourceConfig,
      scope: {
        applyBiayaLayanan: true,
        applyBiayaTambahan: true,
        applyBiayaLainnya: false,
      },
      overridePolicy: "PRESERVE_EXISTING_CUSTOM",
    });

    assert.equal(result.totalCount, 515, "Total offices evaluated must be 515");
    assert.ok(result.preservedCount >= 1, "At least 1 custom office (Jakarta Timur) must be preserved");
    assert.equal(result.updatedCount, 515 - result.preservedCount, "Remaining non-custom offices must be updated");

    // Check Jakarta Timur (Must be preserved)
    const timurRow = dbPricingRepository.getServicePricingById(`${serviceId}:samsat-jakarta-timur`);
    assert.equal(timurRow.biayaJasa, 320000, "Custom Jasa in Jakarta Timur must NOT be overwritten");
    assert.equal(timurRow.biayaAntarJemput, 80000, "Custom Kurir in Jakarta Timur must NOT be overwritten");

    // Check a standard office (e.g. Jakarta Barat or Bandung, which had no custom tariff)
    const baratRow = dbPricingRepository.getServicePricingById(`${serviceId}:samsat-jakarta-barat`);
    assert.ok(baratRow, "Standard office must exist in table service_pricing_configs");
    assert.equal(baratRow.biayaJasa, 260000, "Standard office Jasa must be updated to 260,000");
    assert.equal(baratRow.biayaAntarJemput, 55000, "Standard office Kurir must be updated to 55,000");
  });

  await t.test("4. Batch Replicate with OVERWRITE_ALL: Overwrites All Offices in SQLite", () => {
    const sourceConfig = {
      biayaJasaLengkap: 275000,
      jasaLengkapEnabled: true,
      biayaJasaNembak: 350000,
      jasaNembakEnabled: false,
      biayaAntarJemput: 50000,
      antarJemputEnabled: true,
      antarJemputMode: "Antar & Jemput",
      nominalSwdkllj: 143000,
      swdklljEnabled: true,
    };

    const result = dbPricingRepository.batchReplicateServicePricing({
      serviceId,
      serviceName,
      sourceConfig,
      scope: {
        applyBiayaLayanan: true,
        applyBiayaTambahan: true,
        applyBiayaLainnya: false,
      },
      overridePolicy: "OVERWRITE_ALL",
    });

    assert.equal(result.totalCount, 515);
    assert.equal(result.preservedCount, 0, "No offices preserved when OVERWRITE_ALL is selected");
    assert.equal(result.updatedCount, 515, "All 515 offices must be updated");

    // Check Jakarta Timur (Now overwritten because OVERWRITE_ALL was specified)
    const timurRow = dbPricingRepository.getServicePricingById(`${serviceId}:samsat-jakarta-timur`);
    assert.equal(timurRow.biayaJasa, 275000, "Jakarta Timur Jasa must now be updated to 275,000");
  });

  await t.test("5. Physical Persistence Verification in SQLite Table service_pricing_configs", () => {
    const rowCount: any = db
      .prepare("SELECT count(*) as count FROM service_pricing_configs WHERE service_id = ?")
      .get(serviceId);

    assert.equal(rowCount.count, 515, "Exactly 515 physical rows must exist in SQLite for this service");
  });
});
