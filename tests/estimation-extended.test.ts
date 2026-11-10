/**
 * Unit & Integration Tests for Extended Estimation Templates
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. 5 Tahunan R4 (Mobil)
 * 2. 5 Tahunan R2 (Motor)
 * 3. BBN DKI (Sheet 10) & BBN Jabar (Sheet 12)
 * 4. Mutasi Antar Samsat Mobil (Sheet 8) & Motor (Sheet 9)
 * 5. Mutasi Luar Daerah Motor (Sheet 6)
 * 6. Regression on R4 Tahunan (Rp 18.363.000) & R2 Tahunan (Rp 876.000)
 * 7. Template resolution & Store integration
 */

import test from "node:test";
import assert from "node:assert";
import { calculateEstimation } from "../src/domain/estimation/estimationEngine";
import {
  DEFAULT_R4_ANNUAL_TEMPLATE,
  DEFAULT_R2_ANNUAL_TEMPLATE,
  DEFAULT_R4_5YEAR_TEMPLATE,
  DEFAULT_R2_5YEAR_TEMPLATE,
  DEFAULT_R4_BBN_TEMPLATE,
  DEFAULT_R2_BBN_TEMPLATE,
  DEFAULT_R4_MUTASI_AS_TEMPLATE,
  DEFAULT_R2_MUTASI_AS_TEMPLATE,
  DEFAULT_R4_MUTASI_LD_TEMPLATE,
  DEFAULT_R2_MUTASI_LD_TEMPLATE,
} from "../src/domain/estimation/defaultTemplates";
import { estimationStore } from "../src/app/data/estimationStore";
import { resolveEstimationTemplateId } from "../src/app/components/BuatOrder";
import { EstimationInput } from "../src/domain/estimation/types";

// ============================================================================
// 1. REGRESSION VERIFICATION (MANDATORY ZERO-REGRESSION)
// ============================================================================

test("1. REGRESSION — Perpanjangan 1 Tahun R4 evaluates to exactly Rp 18.363.000", () => {
  const input: EstimationInput = {
    pkbDasar: 3964000,
    tanggalJatuhTempo: "2023-12-23",
    tanggalEstimasi: "2026-10-17",
    programSamsat: "NORMAL",
    kondisiBerkas: "LENGKAP",
    wilayahAccId: "DKI Jakarta",
  };

  const res = calculateEstimation(input, DEFAULT_R4_ANNUAL_TEMPLATE);
  assert.strictEqual(res.tahunTunggakan, 2);
  assert.strictEqual(res.bulanTunggakan, 10);
  assert.strictEqual(res.totalEstimasi, 18363000, "R4 Annual must remain Rp 18.363.000");
});

test("2. REGRESSION — Perpanjangan 1 Tahun R2 evaluates to exactly Rp 876.000", () => {
  const input: EstimationInput = {
    pkbDasar: 51000,
    tanggalJatuhTempo: "2025-09-08",
    tanggalEstimasi: "2026-10-17",
    programSamsat: "NORMAL",
    kondisiBerkas: "TIDAK ADA KTP",
    wilayahAccId: "NON ACC ID",
  };

  const res = calculateEstimation(input, DEFAULT_R2_ANNUAL_TEMPLATE);
  assert.strictEqual(res.tahunTunggakan, 1);
  assert.strictEqual(res.bulanTunggakan, 7); // 2 + 5 formula
  assert.strictEqual(res.totalEstimasi, 876000, "R2 Annual must remain Rp 876.000");
});

// ============================================================================
// 2. 5 TAHUNAN (MOBIL & MOTOR)
// ============================================================================

test("3. 5-Tahunan Mobil (R4) — Correct Admin STNK, TNKB, and Jasa", () => {
  const input: EstimationInput = {
    pkbDasar: 3964000,
    tanggalJatuhTempo: "2023-12-23",
    tanggalEstimasi: "2026-10-17",
    programSamsat: "NORMAL",
    kondisiBerkas: "LENGKAP",
  };

  const res = calculateEstimation(input, DEFAULT_R4_5YEAR_TEMPLATE);
  const stnk = res.items.find((i) => i.id === "admin-stnk")?.amount;
  const tnkb = res.items.find((i) => i.id === "admin-tnkb")?.amount;
  const skp = res.items.find((i) => i.id === "cetak-skp")?.amount;
  const jasa = res.items.find((i) => i.id === "jasa")?.amount;

  assert.strictEqual(stnk, 200000, "Admin STNK R4 must be Rp 200.000");
  assert.strictEqual(tnkb, 100000, "Admin TNKB R4 must be Rp 100.000");
  assert.strictEqual(skp, 100000, "Cetak SKP R4 overdue must be Rp 100.000");
  assert.strictEqual(jasa, 250000, "Jasa 5-Tahunan R4 must be Rp 250.000");
  assert.strictEqual(res.totalSwdkllj, 429000, "SWDKLLJ total must match 143k * 3");
  // Total must equal R4 Annual (18.363.000) + STNK (200.000) + TNKB (100.000) = 18.663.000
  assert.strictEqual(res.totalEstimasi, 18663000);
});

test("4. 5-Tahunan Motor (R2) — Correct Admin STNK, TNKB, and Proses & ACC ID", () => {
  const input: EstimationInput = {
    pkbDasar: 51000,
    tanggalJatuhTempo: "2025-09-08",
    tanggalEstimasi: "2026-10-17",
    programSamsat: "NORMAL",
    kondisiBerkas: "TIDAK ADA KTP",
    wilayahAccId: "NON ACC ID",
  };

  const res = calculateEstimation(input, DEFAULT_R2_5YEAR_TEMPLATE);
  const stnk = res.items.find((i) => i.id === "admin-stnk")?.amount;
  const tnkb = res.items.find((i) => i.id === "admin-tnkb")?.amount;
  const skp = res.items.find((i) => i.id === "cetak-skp")?.amount;
  const prosesAcc = res.items.find((i) => i.id === "proses-dan-acc-id")?.amount;
  const jasa = res.items.find((i) => i.id === "jasa")?.amount;

  assert.strictEqual(stnk, 100000, "Admin STNK R2 must be Rp 100.000");
  assert.strictEqual(tnkb, 60000, "Admin TNKB R2 must be Rp 60.000");
  assert.strictEqual(skp, 50000, "Cetak SKP R2 overdue must be Rp 50.000");
  assert.strictEqual(prosesAcc, 350000, "Proses & ACC ID R2 must be Rp 350.000");
  assert.strictEqual(jasa, 200000, "Jasa 5-Tahunan R2 must be Rp 200.000");
  // Total = R2 Annual (876.000) + STNK (100.000) + TNKB (60.000) = 1.036.000
  assert.strictEqual(res.totalEstimasi, 1036000);
});

// ============================================================================
// 3. BBN / BALIK NAMA (DKI & JABAR WORKBOOK SCENARIOS)
// ============================================================================

test("5. BBN Mobil DKI (Sheet 10) — Evaluates to exactly Rp 12.412.000", () => {
  const input: EstimationInput = {
    pkbDasar: 9041000,
    tanggalJatuhTempo: "2026-09-02",
    tanggalEstimasi: "2026-09-21",
    programSamsat: "NORMAL",
    freeBbn: true,
    wilayahAsal: "DKI Jakarta",
    wilayahTujuan: "DKI Jakarta",
  };

  const res = calculateEstimation(input, DEFAULT_R4_BBN_TEMPLATE);
  assert.strictEqual(res.tahunTunggakan, 0);
  assert.strictEqual(res.bulanTunggakan, 1);
  assert.strictEqual(res.items.find((i) => i.id === "bbn")?.amount, 0, "Free BBN Pokok must be Rp 0");
  assert.strictEqual(res.items.find((i) => i.id === "admin-stnk")?.amount, 200000);
  assert.strictEqual(res.items.find((i) => i.id === "admin-tnkb")?.amount, 100000);
  assert.strictEqual(res.items.find((i) => i.id === "biaya-proses")?.amount, 1000000);
  assert.strictEqual(res.items.find((i) => i.id === "jasa")?.amount, 750000);
  assert.strictEqual(res.totalEstimasi, 12412000, "BBN Mobil DKI Grand Total must be Rp 12.412.000");
});

test("6. BBN Mobil Jabar (Sheet 12) — Evaluates to exactly Rp 18.241.000", () => {
  const input: EstimationInput = {
    pkbDasar: 2875000,
    tanggalJatuhTempo: "2023-12-06",
    tanggalEstimasi: "2026-09-21",
    programSamsat: "NORMAL",
    freeBbn: true,
    wilayahAsal: "Bogor",
    wilayahTujuan: "Bogor",
    manualValues: {
      jasa: 500000, // Sheet 12 cell C35 is 500.000
    },
  };

  const res = calculateEstimation(input, DEFAULT_R4_BBN_TEMPLATE);
  assert.strictEqual(res.tahunTunggakan, 2);
  assert.strictEqual(res.items.find((i) => i.id === "admin-stnk")?.amount, 200000);
  assert.strictEqual(res.items.find((i) => i.id === "admin-tnkb")?.amount, 100000);
  assert.strictEqual(res.items.find((i) => i.id === "biaya-proses")?.amount, 1000000);
  assert.strictEqual(res.items.find((i) => i.id === "jasa")?.amount, 500000);
  assert.strictEqual(res.totalEstimasi, 18241000, "BBN Mobil Jabar Grand Total must be Rp 18.241.000");
});

// ============================================================================
// 4. MUTASI ANTAR SAMSAT & MUTASI LUAR DAERAH
// ============================================================================

test("7. Mutasi Antar Samsat Mobil (Sheet 8) — Evaluates to exactly Rp 3.255.000", () => {
  const input: EstimationInput = {
    pkbDasar: 0,
    tanggalJatuhTempo: "2026-09-10",
    tanggalEstimasi: "2026-09-21",
    programSamsat: "NORMAL",
    freeBbn: true,
  };

  const res = calculateEstimation(input, DEFAULT_R4_MUTASI_AS_TEMPLATE);
  assert.strictEqual(res.items.find((i) => i.id === "tarik-berkas")?.amount, 1000000);
  assert.strictEqual(res.items.find((i) => i.id === "mutasi-masuk-bpkb")?.amount, 1000000);
  assert.strictEqual(res.items.find((i) => i.id === "admin-stnk")?.amount, 200000);
  assert.strictEqual(res.items.find((i) => i.id === "admin-tnkb")?.amount, 100000);
  assert.strictEqual(res.items.find((i) => i.id === "proses-dan-jasa")?.amount, 750000);
  assert.strictEqual(res.totalEstimasi, 3255000, "Mutasi AS Mobil Grand Total must be Rp 3.255.000");
});

test("8. Mutasi Antar Samsat Motor (Sheet 9) — Evaluates to exactly Rp 3.323.000", () => {
  const input: EstimationInput = {
    pkbDasar: 400000,
    tanggalJatuhTempo: "2026-09-14",
    tanggalEstimasi: "2026-09-21",
    programSamsat: "NORMAL",
    freeBbn: true,
  };

  const res = calculateEstimation(input, DEFAULT_R2_MUTASI_AS_TEMPLATE);
  assert.strictEqual(res.items.find((i) => i.id === "tarik-berkas")?.amount, 1000000);
  assert.strictEqual(res.items.find((i) => i.id === "mutasi-masuk-bpkb")?.amount, 1000000);
  assert.strictEqual(res.items.find((i) => i.id === "admin-stnk")?.amount, 100000);
  assert.strictEqual(res.items.find((i) => i.id === "admin-tnkb")?.amount, 60000);
  assert.strictEqual(res.items.find((i) => i.id === "proses-dan-jasa")?.amount, 500000);
  assert.strictEqual(res.totalEstimasi, 3323000, "Mutasi AS Motor Grand Total must be Rp 3.323.000");
});

test("9. Mutasi Luar Daerah Motor (Sheet 6) — Evaluates to exactly Rp 4.125.000", () => {
  const input: EstimationInput = {
    pkbDasar: 201000,
    tanggalJatuhTempo: "2026-07-24",
    tanggalEstimasi: "2026-09-21",
    programSamsat: "NORMAL",
    freeBbn: true,
  };

  const res = calculateEstimation(input, DEFAULT_R2_MUTASI_LD_TEMPLATE);
  assert.strictEqual(res.items.find((i) => i.id === "tarik-berkas")?.amount, 1500000, "Tarik berkas LD must be Rp 1.500.000");
  assert.strictEqual(res.items.find((i) => i.id === "mutasi-masuk-bpkb")?.amount, 1500000, "Mutasi BPKB LD must be Rp 1.500.000");
  assert.strictEqual(res.items.find((i) => i.id === "admin-stnk")?.amount, 100000);
  assert.strictEqual(res.items.find((i) => i.id === "admin-tnkb")?.amount, 60000);
  assert.strictEqual(res.items.find((i) => i.id === "proses-dan-jasa")?.amount, 500000);
  assert.strictEqual(res.totalEstimasi, 4125000, "Mutasi LD Motor Grand Total must be Rp 4.125.000");
});

test("9b. Mutasi Luar Daerah Mobil (R4) — Default Jasa evaluates to exactly Rp 1.500.000", () => {
  const input: EstimationInput = {
    pkbDasar: 0,
    tanggalJatuhTempo: "2026-07-24",
    tanggalEstimasi: "2026-09-21",
    programSamsat: "NORMAL",
    freeBbn: true,
  };

  const res = calculateEstimation(input, DEFAULT_R4_MUTASI_LD_TEMPLATE);
  assert.strictEqual(res.items.find((i) => i.id === "proses-dan-jasa")?.amount, 1500000, "Mutasi LD Mobil service fee must be Rp 1.500.000");
  assert.strictEqual(DEFAULT_R4_MUTASI_LD_TEMPLATE.biayaJasa, 1500000, "Template baseline must be Rp 1.500.000");
});

// ============================================================================
// 5. TEMPLATE RESOLUTION & STORE INTEGRATION
// ============================================================================

test("10. Template Resolution & Store Registry", () => {
  // Store registry has all 10 templates
  const allTemplates = estimationStore.getAllTemplates();
  assert.strictEqual(allTemplates.length, 10, "Store must contain all 10 templates");

  // Template ID resolution for all services and vehicle types
  assert.strictEqual(resolveEstimationTemplateId("Perpanjangan 1 Tahun", "Mobil"), "template-pajak-tahunan-r4");
  assert.strictEqual(resolveEstimationTemplateId("Perpanjangan 1 Tahun", "Motor"), "template-pajak-tahunan-r2");
  assert.strictEqual(resolveEstimationTemplateId("Perpanjangan 5 Tahun", "Mobil"), "template-pajak-5-tahun-r4");
  assert.strictEqual(resolveEstimationTemplateId("Perpanjangan 5 Tahun", "Motor"), "template-pajak-5-tahun-r2");
  assert.strictEqual(resolveEstimationTemplateId("Balik Nama (BBN-KB)", "Mobil"), "template-bbn-r4");
  assert.strictEqual(resolveEstimationTemplateId("Balik Nama (BBN-KB)", "Motor"), "template-bbn-r2");
  assert.strictEqual(resolveEstimationTemplateId("Mutasi Antar Samsat", "Mobil"), "template-mutasi-as-r4");
  assert.strictEqual(resolveEstimationTemplateId("Mutasi Antar Samsat", "Motor"), "template-mutasi-as-r2");
  assert.strictEqual(resolveEstimationTemplateId("Mutasi Luar Daerah", "Mobil"), "template-mutasi-ld-r4");
  assert.strictEqual(resolveEstimationTemplateId("Mutasi Luar Daerah", "Motor"), "template-mutasi-ld-r2");
});
