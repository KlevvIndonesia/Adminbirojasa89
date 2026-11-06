import test from "node:test";
import assert from "node:assert/strict";
import { pricingStore } from "../src/app/data/pricingStore";
import { pricingRepository } from "../src/data/repositories/pricingRepository";
import { MockPricingProvider } from "../src/data/mock/mockPricingProvider";

test("Biaya Layanan Tahap 3: Frontend Data Layer & SSoT Synchronization Verification", async (t) => {
  const serviceId = "svc-perp-1th";
  const serviceName = "Perpanjangan 1 Tahun";

  await t.test("1. pricingRepository delegation to provider", async () => {
    let calledParams: any = null;
    const mockProvider = new MockPricingProvider();
    mockProvider.batchReplicateServicePricing = async (params: any) => {
      calledParams = params;
      return { success: true, updatedCount: 500, preservedCount: 15, totalCount: 515 };
    };

    pricingRepository.setProvider(mockProvider);

    const testPayload = {
      serviceId,
      serviceName,
      sourceConfig: { biayaJasaLengkap: 260000, jasaLengkapEnabled: true },
      scope: { applyBiayaLayanan: true, applyBiayaTambahan: false, applyBiayaLainnya: false },
      overridePolicy: "PRESERVE_EXISTING_CUSTOM" as const,
    };

    const res = await pricingRepository.batchReplicateServicePricing(testPayload);
    assert.equal(res.success, true);
    assert.equal(res.updatedCount, 500);
    assert.equal(res.preservedCount, 15);
    assert.deepEqual(calledParams, testPayload);
  });

  await t.test("2. pricingStore.applyConfigToAllSamsats with PRESERVE_EXISTING_CUSTOM", async () => {
    const rows = pricingStore.getBiayaLayananRows().filter((r) => r.layanan === serviceName);
    assert.ok(rows.length > 5, "Rows should exist for " + serviceName);

    // Set one row to have custom tariff
    const targetCustomRow = rows[0];
    const targetWilayah = targetCustomRow.wilayah;
    await pricingStore.updateBiayaLayananRow(targetCustomRow.id, {
      ...targetCustomRow,
      biayaJasa: 380000,
      biayaJasaLengkap: 380000,
      pengurusanKhususEnabled: true,
      biayaPengurusanKhusus: 450000,
      biayaJasaNembak: 450000,
      jasaNembakEnabled: true,
    });

    const sourceConfig = {
      biayaJasaLengkap: 275000,
      jasaLengkapEnabled: true,
      biayaJasaNembak: 350000,
      jasaNembakEnabled: false,
      biayaAntarJemput: 55000,
      antarJemputEnabled: true,
      nominalSwdkllj: 35000,
      swdklljEnabled: true,
      biayaLainnya: [],
    };

    const result = await pricingStore.applyConfigToAllSamsats(
      serviceId,
      sourceConfig,
      {
        applyBiayaLayanan: true,
        applyBiayaTambahan: true,
        applyKomponenSamsat: true,
        applyBiayaLainnya: false,
      },
      "PRESERVE_EXISTING_CUSTOM"
    );

    assert.ok(result.totalCount > 0);
    assert.ok(result.preservedCount >= 1, "At least 1 row should be preserved as custom");
    assert.equal(result.totalCount, result.updatedCount + result.preservedCount);

    // Verify custom row was preserved
    const updatedRows = pricingStore.getBiayaLayananRows().filter((r) => r.layanan === serviceName);
    const customRowAfter = updatedRows.find((r) => r.wilayah === targetWilayah);
    assert.ok(customRowAfter, "Custom row must exist after update");
    assert.equal(customRowAfter.biayaJasa, 380000, "Custom row biayaJasa must remain 380000");
    assert.equal(customRowAfter.biayaPengurusanKhusus, 450000, "Custom row biayaPengurusanKhusus must remain 450000");

    // Verify non-custom row was updated
    const nonCustomRow = updatedRows.find((r) => r.wilayah !== targetWilayah && r.biayaJasa === 275000);
    assert.ok(nonCustomRow, "A non-custom row must have been updated to 275000");
    assert.equal(nonCustomRow.biayaAntarJemput, 55000);
  });

  await t.test("3. pricingStore.applyConfigToAllSamsats with OVERWRITE_ALL", async () => {
    const rows = pricingStore.getBiayaLayananRows().filter((r) => r.layanan === serviceName);
    const targetCustomRow = rows[0];
    const targetWilayah = targetCustomRow.wilayah;

    const sourceConfig = {
      biayaJasaLengkap: 290000,
      jasaLengkapEnabled: true,
      biayaJasaNembak: 300000,
      jasaNembakEnabled: false,
      biayaAntarJemput: 60000,
      antarJemputEnabled: true,
      nominalSwdkllj: 35000,
      swdklljEnabled: true,
      biayaLainnya: [],
    };

    const result = await pricingStore.applyConfigToAllSamsats(
      serviceId,
      sourceConfig,
      {
        applyBiayaLayanan: true,
        applyBiayaTambahan: true,
        applyKomponenSamsat: true,
        applyBiayaLainnya: false,
      },
      "OVERWRITE_ALL"
    );

    assert.equal(result.preservedCount, 0, "No rows should be preserved under OVERWRITE_ALL");
    assert.equal(result.updatedCount, result.totalCount);

    // Verify previously custom row is now overwritten
    const updatedRows = pricingStore.getBiayaLayananRows().filter((r) => r.layanan === serviceName);
    const customRowAfter = updatedRows.find((r) => r.wilayah === targetWilayah);
    assert.ok(customRowAfter, "Custom row must exist after overwrite");
    assert.equal(customRowAfter.biayaJasa, 290000, "Overwritten row biayaJasa must now be 290000");
    assert.equal(customRowAfter.biayaAntarJemput, 60000);
  });
});
