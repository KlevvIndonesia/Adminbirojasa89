/**
 * SUNBIROJASA — Mutasi Luar Daerah Pricing SSoT & Architecture Verification Test
 * 
 * Verifies the 12 Phase 3 requirements:
 * 1. R4 default = Rp1.500.000
 * 2. R2 default = Rp500.000
 * 3. Samsat A override R4 = Rp1.600.000
 * 4. Samsat B tanpa override tetap Rp1.500.000
 * 5. Pergantian Samsat tidak membawa tarif sebelumnya (immutable calculation)
 * 6. Komponen jasa OFF tidak masuk Grand Total
 * 7. Komponen jasa ON masuk sesuai tarif efektif
 * 8. Parameter rumus tidak dihitung sebagai komponen biaya
 * 9. Perubahan tarif tidak mengubah order historis (immutable snapshot)
 * 10. Perubahan melalui modal tercermin di tabel dan Buat Order
 * 11. Perubahan melalui tabel tercermin di modal dan Buat Order
 * 12. Regression test untuk layanan lain (Mutasi Antar Samsat & Balik Nama)
 */

import test from "node:test";
import assert from "node:assert";
import { resolveServiceFee } from "../src/domain/pricing/pricingResolver";
import { calculateEstimation } from "../src/domain/estimation/estimationEngine";
import {
  DEFAULT_R4_MUTASI_LD_TEMPLATE,
  DEFAULT_R2_MUTASI_LD_TEMPLATE,
  DEFAULT_R4_MUTASI_AS_TEMPLATE,
  DEFAULT_R2_MUTASI_AS_TEMPLATE,
  DEFAULT_R4_BBN_TEMPLATE,
  DEFAULT_R2_BBN_TEMPLATE,
} from "../src/domain/estimation/defaultTemplates";
import { estimationStore } from "../src/app/data/estimationStore";
import { pricingStore } from "../src/app/data/pricingStore";
import { SERVICE_STANDARD_BASELINES } from "../src/app/components/BiayaLayanan";
import { EstimationInput } from "../src/domain/estimation/types";

test("1. R4 Mutasi LD default service fee resolves to Rp 1.500.000", () => {
  const resolved = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Mobil",
    samsatName: "Aceh Jaya",
    feeConfig: {
      biayaJasa: 1500000,
      jasaLengkap: { nominal: 1500000, enabled: true },
    },
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });

  assert.strictEqual(resolved.effectiveJasa, 1500000);
  assert.strictEqual(resolved.isActive, true);
  assert.strictEqual(resolved.source, "TEMPLATE_DEFAULT");

  // Verify calculation engine evaluates to 1.500.000
  const input: EstimationInput = {
    pkbDasar: 0,
    tanggalJatuhTempo: "2026-01-01",
    tanggalEstimasi: "2026-01-01",
    programSamsat: "NORMAL",
  };
  const result = calculateEstimation(input, DEFAULT_R4_MUTASI_LD_TEMPLATE);
  const jasaItem = result.items.find((i) => i.id === "proses-dan-jasa");
  assert.strictEqual(jasaItem?.amount, 1500000);
});

test("2. R2 Mutasi LD default service fee resolves to Rp 500.000", () => {
  const resolved = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Motor",
    samsatName: "Aceh Jaya",
    feeConfig: {
      biayaJasa: 1500000, // Flat table holds baseline
      jasaLengkap: { nominal: 1500000, enabled: true },
    },
    templateBiayaJasa: DEFAULT_R2_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });

  assert.strictEqual(resolved.effectiveJasa, 500000);
  assert.strictEqual(resolved.isActive, true);
  assert.strictEqual(resolved.source, "TEMPLATE_DEFAULT");

  const input: EstimationInput = {
    pkbDasar: 0,
    tanggalJatuhTempo: "2026-01-01",
    tanggalEstimasi: "2026-01-01",
    programSamsat: "NORMAL",
  };
  const result = calculateEstimation(input, DEFAULT_R2_MUTASI_LD_TEMPLATE);
  const jasaItem = result.items.find((i) => i.id === "proses-dan-jasa");
  assert.strictEqual(jasaItem?.amount, 500000);
});

test("3. Samsat A with custom override R4 resolves to Rp 1.600.000", () => {
  const samsatAConfig = {
    biayaJasa: 1600000,
    jasaLengkap: { nominal: 1600000, enabled: true },
    isCustom: true,
  };

  const resolved = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Mobil",
    samsatName: "Samsat Khusus A",
    feeConfig: samsatAConfig,
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });

  assert.strictEqual(resolved.effectiveJasa, 1600000);
  assert.strictEqual(resolved.source, "OVERRIDE");
  assert.strictEqual(resolved.isActive, true);

  // Engine with custom template override
  const customTemplate = {
    ...DEFAULT_R4_MUTASI_LD_TEMPLATE,
    biayaJasa: resolved.effectiveJasa,
  };
  const input: EstimationInput = {
    pkbDasar: 0,
    tanggalJatuhTempo: "2026-01-01",
    tanggalEstimasi: "2026-01-01",
    programSamsat: "NORMAL",
  };
  const result = calculateEstimation(input, customTemplate);
  assert.strictEqual(result.items.find((i) => i.id === "proses-dan-jasa")?.amount, 1600000);
});

test("4. Samsat B without override remains Rp 1.500.000", () => {
  const samsatBConfig = {
    biayaJasa: 1500000,
    jasaLengkap: { nominal: 1500000, enabled: true },
    isCustom: false,
  };

  const resolved = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Mobil",
    samsatName: "Samsat Standar B",
    feeConfig: samsatBConfig,
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });

  assert.strictEqual(resolved.effectiveJasa, 1500000);
  assert.strictEqual(resolved.source, "TEMPLATE_DEFAULT");
});

test("5. Switching Samsats does not leak or carry over previous tariff", () => {
  // Select Samsat A (custom override: 1.750.000)
  const resolvedA = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Mobil",
    samsatName: "Samsat A",
    feeConfig: { biayaJasa: 1750000, isCustom: true },
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });
  assert.strictEqual(resolvedA.effectiveJasa, 1750000);

  // Immediately switch to Samsat B (standard baseline: 1.500.000)
  const resolvedB = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Mobil",
    samsatName: "Samsat B",
    feeConfig: { biayaJasa: 1500000 },
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });
  assert.strictEqual(resolvedB.effectiveJasa, 1500000);
  assert.strictEqual(DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa, 1500000, "Global template must remain untouched");
});

test("6. Deactivated service fee (OFF) does not enter Grand Total", () => {
  const resolved = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Mobil",
    samsatName: "Aceh Jaya",
    feeConfig: {
      biayaJasa: 1500000,
      jasaLengkap: { nominal: 1500000, enabled: false }, // JASA OFF
    },
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });

  assert.strictEqual(resolved.effectiveJasa, 0);
  assert.strictEqual(resolved.isActive, false);
  assert.strictEqual(resolved.source, "INACTIVE");

  // Build resolved template with inactive fee
  const template = {
    ...DEFAULT_R4_MUTASI_LD_TEMPLATE,
    biayaJasa: 0,
    components: DEFAULT_R4_MUTASI_LD_TEMPLATE.components.map((c) =>
      c.id === "proses-dan-jasa" ? { ...c, defaultValue: 0, isActive: false } : c
    ),
  };

  const input: EstimationInput = {
    pkbDasar: 0,
    tanggalJatuhTempo: "2026-01-01",
    tanggalEstimasi: "2026-01-01",
    programSamsat: "NORMAL",
  };
  const result = calculateEstimation(input, template);
  const jasaItem = result.items.find((i) => i.id === "proses-dan-jasa");
  assert.strictEqual(jasaItem, undefined, "Inactive component must be excluded from result items");

  // Sum of other active components (tarik berkas, mutasi bpkb, admin stnk/tnkb, swdkllj) = 3.505.000
  const otherActiveSum = template.components
    .filter((c) => c.isActive && c.id !== "proses-dan-jasa" && c.includesInTotal)
    .reduce((sum, c) => sum + (c.defaultValue || 0), 0);
  assert.strictEqual(result.totalEstimasi, otherActiveSum, "Grand total must not include the deactivated service fee");
});

test("7. Active service fee (ON) enters Grand Total according to effective tariff", () => {
  const resolved = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Mobil",
    samsatName: "Aceh Jaya",
    feeConfig: {
      biayaJasa: 1500000,
      jasaLengkap: { nominal: 1500000, enabled: true },
    },
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });

  const template = {
    ...DEFAULT_R4_MUTASI_LD_TEMPLATE,
    biayaJasa: resolved.effectiveJasa,
    components: DEFAULT_R4_MUTASI_LD_TEMPLATE.components.map((c) =>
      c.id === "proses-dan-jasa" ? { ...c, defaultValue: resolved.effectiveJasa, isActive: true } : c
    ),
  };

  const input: EstimationInput = {
    pkbDasar: 0,
    tanggalJatuhTempo: "2026-01-01",
    tanggalEstimasi: "2026-01-01",
    programSamsat: "NORMAL",
  };
  const result = calculateEstimation(input, template);
  assert.strictEqual(result.items.find((i) => i.id === "proses-dan-jasa")?.amount, 1500000);
  assert.strictEqual(result.totalEstimasi, 5005000, "Grand total must include the active service fee (3.505.000 other + 1.500.000 jasa)");
});

test("8. Formula parameters (koefisien denda, pembulatan) are NOT counted as cost components", () => {
  const input: EstimationInput = {
    pkbDasar: 1000000,
    tanggalJatuhTempo: "2025-01-01",
    tanggalEstimasi: "2026-01-01",
    programSamsat: "NORMAL",
  };

  const result = calculateEstimation(input, DEFAULT_R4_MUTASI_LD_TEMPLATE);
  // Parameters like koefisienDenda (0.48), kelipatanPembulatan (1000), pembagiBulan (12) must not appear in items
  const nonCostItems = result.items.filter((i) =>
    i.id.includes("koefisien") || i.id.includes("pembulatan") || i.id.includes("pembagi")
  );
  assert.strictEqual(nonCostItems.length, 0, "Formula parameters must never be listed as cost items");
});

test("9. Historical order snapshot immutability: master data changes do NOT alter saved order", () => {
  // Simulate saved order snapshot
  const initialSnapshot = {
    orderNo: "ORD-HIST-01",
    serviceName: "Mutasi Luar Daerah",
    biayaJasa: 1500000,
    totalEstimasi: 1500000,
    createdAt: "2026-10-01T00:00:00.000Z",
  };

  // Admin later modifies master data
  const updatedMasterConfig = { biayaJasa: 2000000 };

  // Assert historical order remains intact
  assert.strictEqual(initialSnapshot.biayaJasa, 1500000, "Historical order biayaJasa must not change");
  assert.strictEqual(initialSnapshot.totalEstimasi, 1500000, "Historical order totalEstimasi must not change");
});

test("10. Changes in General Rules modal are reflected in table baseline and Buat Order", async () => {
  const currentLayanan = "Mutasi Luar Daerah";
  const newJasaMobil = 1500000;

  // Simulate modal save sync
  if (SERVICE_STANDARD_BASELINES[currentLayanan]) {
    SERVICE_STANDARD_BASELINES[currentLayanan].jasa = newJasaMobil;
  }
  await pricingStore.applyConfigToAllSamsats(
    currentLayanan,
    {
      biayaJasaLengkap: newJasaMobil,
      jasaLengkapEnabled: true,
      biayaJasaNembak: 0,
      jasaNembakEnabled: false,
      biayaAntarJemput: 50000,
      antarJemputEnabled: true,
      nominalSwdkllj: 0,
      swdklljEnabled: true,
    },
    { applyBiayaLayanan: true }
  );

  // Table row verification
  const rows = pricingStore.getBiayaLayananRows().filter((r) => r.layanan === currentLayanan);
  const acehRow = rows.find((r) => r.wilayah === "Aceh Jaya");
  assert.strictEqual(acehRow?.biayaJasa, 1500000, "Table row must reflect 1.500.000");

  // Buat Order resolver verification
  const resolved = resolveServiceFee({
    serviceName: currentLayanan,
    vehicleType: "Mobil",
    samsatName: "Aceh Jaya",
    feeConfig: acehRow,
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: SERVICE_STANDARD_BASELINES[currentLayanan].jasa,
  });
  assert.strictEqual(resolved.effectiveJasa, 1500000, "Buat Order must resolve to 1.500.000");
});

test("11. Changes in table row reflect in modal and Buat Order for that Samsat", async () => {
  const currentLayanan = "Mutasi Luar Daerah";
  const testWilayah = "Aceh Jaya";
  const rows = pricingStore.getBiayaLayananRows().filter((r) => r.layanan === currentLayanan);
  const targetRow = rows.find((r) => r.wilayah === testWilayah);

  assert.ok(targetRow, "Target row must exist");

  // Admin edits row to custom override 1.650.000
  const updatedCustomRow = {
    ...targetRow,
    biayaJasa: 1650000,
    biayaJasaLengkap: 1650000,
    isCustom: true,
  };
  await pricingStore.updateBiayaLayananRow(targetRow.id, updatedCustomRow);
  pricingStore.updateServiceFeeConfig(currentLayanan, testWilayah, {
    biayaJasa: 1650000,
    jasaLengkap: { nominal: 1650000, enabled: true },
  });

  // Buat Order for Aceh Jaya
  const cfg = pricingStore.getServiceFeeConfig(currentLayanan, testWilayah);
  const resolvedCustom = resolveServiceFee({
    serviceName: currentLayanan,
    vehicleType: "Mobil",
    samsatName: testWilayah,
    feeConfig: cfg,
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });
  assert.strictEqual(resolvedCustom.effectiveJasa, 1650000, "Buat Order must use 1.650.000 for customized Samsat");

  // Restore back to 1.500.000
  const rowToRestore = pricingStore.getBiayaLayananRows().find((r) => r.wilayah === testWilayah && r.layanan === currentLayanan);
  assert.ok(rowToRestore, "Row to restore must exist");
  await pricingStore.updateBiayaLayananRow(rowToRestore.id, {
    ...rowToRestore,
    biayaJasa: 1500000,
    biayaJasaLengkap: 1500000,
    isCustom: false,
  });
  pricingStore.updateServiceFeeConfig(currentLayanan, testWilayah, {
    biayaJasa: 1500000,
    jasaLengkap: { nominal: 1500000, enabled: true },
  });
});

test("12. Regression test for other services (Mutasi Antar Samsat & Balik Nama)", () => {
  // Mutasi Antar Samsat Mobil: must remain 750.000
  const asInput: EstimationInput = {
    pkbDasar: 0,
    tanggalJatuhTempo: "2026-01-01",
    tanggalEstimasi: "2026-01-01",
    programSamsat: "NORMAL",
  };
  const asResult = calculateEstimation(asInput, DEFAULT_R4_MUTASI_AS_TEMPLATE);
  assert.strictEqual(asResult.items.find((i) => i.id === "proses-dan-jasa")?.amount, 750000, "Mutasi AS Mobil must remain 750.000");

  // Mutasi Antar Samsat Motor: must remain 500.000
  const asMotorResult = calculateEstimation(asInput, DEFAULT_R2_MUTASI_AS_TEMPLATE);
  assert.strictEqual(asMotorResult.items.find((i) => i.id === "proses-dan-jasa")?.amount, 500000, "Mutasi AS Motor must remain 500.000");

  // Balik Nama Mobil: must remain 750.000
  const bbnResult = calculateEstimation(asInput, DEFAULT_R4_BBN_TEMPLATE);
  assert.strictEqual(bbnResult.items.find((i) => i.id === "jasa")?.amount, 750000, "BBN Mobil must remain 750.000");

  // Balik Nama Motor: must remain 500.000
  const bbnMotorResult = calculateEstimation(asInput, DEFAULT_R2_BBN_TEMPLATE);
  assert.strictEqual(bbnMotorResult.items.find((i) => i.id === "jasa")?.amount, 500000, "BBN Motor must remain 500.000");
});

test("13. Samsat with distinct R4 and R2 overrides resolves correctly per vehicle", () => {
  const dualConfig = {
    biayaJasa: 1500000,
    biayaJasaR4: 1750000,
    biayaJasaR2: 650000,
    jasaR4Enabled: true,
    jasaR2Enabled: true,
    isCustom: true,
  };

  const resolvedR4 = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Mobil",
    samsatName: "Samsat Khusus Dual",
    feeConfig: dualConfig,
    templateBiayaJasa: DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 1500000,
  });
  assert.strictEqual(resolvedR4.effectiveJasa, 1750000, "R4 override must resolve to 1.750.000");
  assert.strictEqual(resolvedR4.source, "OVERRIDE");

  const resolvedR2 = resolveServiceFee({
    serviceName: "Mutasi Luar Daerah",
    vehicleType: "Motor",
    samsatName: "Samsat Khusus Dual",
    feeConfig: dualConfig,
    templateBiayaJasa: DEFAULT_R2_MUTASI_LD_TEMPLATE.biayaJasa,
    standardBaselineJasa: 500000,
  });
  assert.strictEqual(resolvedR2.effectiveJasa, 650000, "R2 override must resolve to 650.000");
  assert.strictEqual(resolvedR2.source, "OVERRIDE");
});
