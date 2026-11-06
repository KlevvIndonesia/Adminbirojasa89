import test from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { GENERAL_SECTIONS } from "../src/app/components/BiayaLayanan";
import { pricingStore, MASTER_PRICING_ITEMS } from "../src/app/data/pricingStore";
import { estimationStore } from "../src/app/data/estimationStore";
import { calculateEstimation } from "../src/domain/estimation/estimationEngine";
import { DEFAULT_R4_ANNUAL_TEMPLATE, DEFAULT_R2_ANNUAL_TEMPLATE } from "../src/domain/estimation/defaultTemplates";

test("Biaya Layanan - Aturan Estimasi & Komponen General Verification", async (t) => {
  const dbPath = process.env.DB_PATH || "server/data/database.sqlite";
  const db = new DatabaseSync(dbPath, { readOnly: true });

  t.after(() => {
    db.close();
  });

  await t.test("1. Verifikasi 4 Bagian Aturan General (Parameter, Mutasi Masuk, Mutasi Keluar, Ringkasan)", () => {
    assert.strictEqual(GENERAL_SECTIONS.length, 4, "General sections must have exactly 4 sections");
    const sectionIds = GENERAL_SECTIONS.map((s) => s.id);
    assert.deepStrictEqual(
      sectionIds,
      ["parameter", "mutasi-masuk", "mutasi-keluar", "ringkasan"],
      "General sections must be: parameter, mutasi-masuk, mutasi-keluar, ringkasan"
    );

    const labels = GENERAL_SECTIONS.map((s) => s.shortLabel);
    assert.deepStrictEqual(
      labels,
      ["Parameter Rumus", "Mutasi Masuk", "Mutasi Keluar", "Ringkasan"],
      "Section short labels must be Parameter Rumus, Mutasi Masuk, Mutasi Keluar, Ringkasan"
    );
  });

  await t.test("2. Parameter Rumus: Formula Parameters & Calculation Engine Verification", () => {
    // 2.1 Cek template Mobil (R4)
    const tplR4 = estimationStore.getTemplate("template-pajak-tahunan-r4");
    assert.ok(tplR4, "Template R4 Tahunan harus tersedia");
    assert.strictEqual(tplR4.koefisienDenda, 0.48, "Koefisien Denda Mobil standar adalah 48% (0.48)");
    assert.strictEqual(tplR4.pembagiBulan ?? 12, 12, "Pembagi bulan standar adalah 12");
    assert.strictEqual(tplR4.kelipatanPembulatan ?? 1000, 1000, "Kelipatan pembulatan standar adalah Rp 1.000");
    assert.strictEqual(tplR4.swdklljPokok, 143000, "SWDKLLJ Pokok Mobil adalah Rp 143.000");
    assert.strictEqual(tplR4.dendaSwdklljPokok, 100000, "Denda SWDKLLJ Pokok Mobil adalah Rp 100.000");
    assert.strictEqual(tplR4.biayaCetakSkp, 100000, "Biaya Cetak SKP Mobil adalah Rp 100.000");

    // 2.2 Cek template Motor (R2)
    const tplR2 = estimationStore.getTemplate("template-pajak-tahunan-r2");
    assert.ok(tplR2, "Template R2 Tahunan harus tersedia");
    assert.strictEqual(tplR2.swdklljPokok, 35000, "SWDKLLJ Pokok Motor adalah Rp 35.000");
    assert.strictEqual(tplR2.dendaSwdklljPokok, 32000, "Denda SWDKLLJ Pokok Motor adalah Rp 32.000");
    assert.strictEqual(tplR2.biayaCetakSkp, 50000, "Biaya Cetak SKP Motor adalah Rp 50.000");

    // 2.3 Simulasi Hitungan Estimasi Engine (Pure Deterministic Calculation)
    const calcResult = calculateEstimation(
      {
        pkbDasar: 2000000,
        tanggalJatuhTempo: "2024-01-01",
        tanggalEstimasi: "2025-01-01", // 1 tahun terlambat
        programSamsat: "Standar",
      },
      tplR4
    );

    assert.ok(calcResult.totalEstimasi > 0, "Total estimasi harus terhitung dan > 0");
    const pkbTertunggakItem = calcResult.items.find((i) => i.id === "pkb-tertunggak");
    assert.ok(pkbTertunggakItem, "Komponen PKB Tertunggak harus ada");
    assert.strictEqual(pkbTertunggakItem.amount, 2000000, "PKB Tertunggak = 2.000.000 × 1 tahun = 2.000.000");

    const dendaPkbItem = calcResult.items.find((i) => i.id === "denda-pkb-tertunggak");
    assert.ok(dendaPkbItem, "Komponen Denda PKB Tertunggak harus ada");
    // 2.000.000 × 0.48 = 960.000
    assert.strictEqual(dendaPkbItem.amount, 960000, "Denda PKB Tertunggak = 2.000.000 × 0.48 = 960.000");
  });

  await t.test("3. Komponen Mutasi Masuk & Mutasi Keluar: Wajib Mengikuti Harga Standar Nasional", async () => {
    // 3.1 Cek katalog master komponen Mutasi Masuk dan Keluar
    const mutasiMasukComps = pricingStore.getMasterPricingItems().filter((i) => i.category === "Mutasi Masuk");
    const mutasiKeluarComps = pricingStore.getMasterPricingItems().filter((i) => i.category === "Mutasi Keluar");

    assert.strictEqual(mutasiMasukComps.length, 11, "Harus ada 11 komponen Mutasi Masuk");
    assert.strictEqual(mutasiKeluarComps.length, 18, "Harus ada 18 komponen Mutasi Keluar");

    // 3.2 Pastikan getNationalDefaultPrice() mengembalikan tarif dasar katalog nasional
    for (const comp of mutasiMasukComps) {
      const nationalPrice = pricingStore.getNationalDefaultPrice(comp.id);
      assert.strictEqual(typeof nationalPrice, "number", `Harga standar ${comp.id} harus berupa number`);
      assert.ok(nationalPrice >= 0, `Harga standar ${comp.id} harus >= 0 (nilai: ${nationalPrice})`);
    }

    for (const comp of mutasiKeluarComps) {
      const nationalPrice = pricingStore.getNationalDefaultPrice(comp.id);
      assert.strictEqual(typeof nationalPrice, "number", `Harga standar ${comp.id} harus berupa number`);
      assert.ok(nationalPrice >= 0, `Harga standar ${comp.id} harus >= 0 (nilai: ${nationalPrice})`);
    }

    // 3.3 Uji Isolasi Harga Standar vs Override Lokal Samsat
    // Buat override khusus pada samsat-jakarta-timur
    const testItemId = "mutasi-legalisir";
    const originalNationalPrice = pricingStore.getNationalDefaultPrice(testItemId);
    const customOverridePrice = originalNationalPrice + 55000;

    await pricingStore.setSamsatOverride("samsat-jakarta-timur", testItemId, customOverridePrice);

    // Samsat Jakarta Timur harus membaca override tarif khusus
    const jaktimPrice = pricingStore.getSamsatPrice("samsat-jakarta-timur", testItemId);
    assert.strictEqual(jaktimPrice, customOverridePrice, "Tarif khusus Samsat Jaktim harus mencerminkan override");

    // TAPI getNationalDefaultPrice HARUS TETAP harga standar nasional (tidak terpengaruh override!)
    const persistentNationalPrice = pricingStore.getNationalDefaultPrice(testItemId);
    assert.strictEqual(
      persistentNationalPrice,
      originalNationalPrice,
      "Komponen mutasi pada General Rules harus tetap mengikuti Harga Standar Nasional"
    );

    // Reset override
    await pricingStore.resetAllSamsatOverrides("samsat-jakarta-timur");
  });

  await t.test("4. Ringkasan: Live Simulation Grand Total & Akumulasi Komponen Aktif", () => {
    // 4.1 Simulasi kerangka hitungan Ringkasan di BiayaLayanan
    const mockSelectedComponents: Record<string, boolean> = {
      "mutasi-cf": true,         // Mutasi Keluar: Cek Fisik
      "mutasi-lok-arsip": true,  // Mutasi Keluar: Lok Arsip
      "mutasi-legalisir": true,  // Mutasi Keluar: Legalisir
      "mutasi-acak": true,       // Mutasi Masuk: Nopol Acak
    };

    const mutasiKeluarItems = pricingStore.getMasterPricingItems().filter((i) => i.category === "Mutasi Keluar");
    const mutasiMasukItems = pricingStore.getMasterPricingItems().filter((i) => i.category === "Mutasi Masuk");

    const summaryItems: Array<{
      id: string;
      category: string;
      nominal: number;
      isActive: boolean;
      includesInTotal: boolean;
    }> = [];

    // Jasa Standar
    summaryItems.push({
      id: "jasa-standar",
      category: "JASA",
      nominal: 500000,
      isActive: true,
      includesInTotal: true,
    });

    // Mutasi Masuk (Wajib Ikut Harga Standar)
    mutasiMasukItems.forEach((comp) => {
      const isAct = !!mockSelectedComponents[comp.id];
      const price = pricingStore.getNationalDefaultPrice(comp.id);
      summaryItems.push({
        id: comp.id,
        category: "Mutasi Masuk",
        nominal: price,
        isActive: isAct,
        includesInTotal: isAct,
      });
    });

    // Mutasi Keluar (Wajib Ikut Harga Standar)
    mutasiKeluarItems.forEach((comp) => {
      const isAct = !!mockSelectedComponents[comp.id];
      const price = pricingStore.getNationalDefaultPrice(comp.id);
      summaryItems.push({
        id: comp.id,
        category: "Mutasi Keluar",
        nominal: price,
        isActive: isAct,
        includesInTotal: isAct,
      });
    });

    const activeItems = summaryItems.filter((i) => i.isActive);
    const includedItems = activeItems.filter((i) => i.includesInTotal);
    const grandTotal = includedItems.reduce((acc, curr) => acc + curr.nominal, 0);

    // 1 Jasa Standar + 4 Komponen Mutasi terpilih = 5 item aktif
    assert.strictEqual(activeItems.length, 5, "Total komponen aktif dalam simulasi ringkasan harus 5");
    assert.strictEqual(includedItems.length, 5, "Semua komponen aktif masuk ke grand total");

    // Perhitungan grand total harus mencakup 500.000 + harga standar masing-masing komponen mutasi
    let expectedTotal = 500000;
    expectedTotal += pricingStore.getNationalDefaultPrice("mutasi-cf");
    expectedTotal += pricingStore.getNationalDefaultPrice("mutasi-lok-arsip");
    expectedTotal += pricingStore.getNationalDefaultPrice("mutasi-legalisir");
    expectedTotal += pricingStore.getNationalDefaultPrice("mutasi-acak");

    assert.strictEqual(grandTotal, expectedTotal, `Grand total ringkasan (${grandTotal}) harus sama dengan ekspektasi (${expectedTotal})`);
  });

  await t.test("5. Replikasi Seragam Komponen Mutasi ke Seluruh Samsat via applyConfigToAllSamsats", () => {
    const serviceName = "Mutasi Antar Samsat";
    const testComponents = {
      "mutasi-cf": true,
      "mutasi-lok-arsip": true,
      "mutasi-acak": true,
    };

    pricingStore.applyConfigToAllSamsats(
      serviceName,
      {
        biayaJasaLengkap: 800000,
        jasaLengkapEnabled: true,
        biayaJasaNembak: 400000,
        jasaNembakEnabled: false,
        biayaAntarJemput: 50000,
        antarJemputEnabled: true,
        nominalSwdkllj: 143000,
        swdklljEnabled: true,
        components: testComponents,
      },
      {
        applyBiayaLayanan: false,
        applyBiayaTambahan: false,
        applyKomponenSamsat: true,
        applyBiayaLainnya: false,
        applyAturanEstimasi: true,
      }
    );

    // Cek konfigurasi service untuk Jakarta Timur dan Bandung
    const configJaktim = pricingStore.getServiceFeeConfig(serviceName, "samsat-jakarta-timur");
    const configBandung = pricingStore.getServiceFeeConfig(serviceName, "samsat-bandung");

    assert.ok(configJaktim, "Config Jakarta Timur harus ada");
    assert.ok(configBandung, "Config Bandung harus ada");

    const cfJaktim = configJaktim?.components.find((c) => c.pricingItemId === "mutasi-cf");
    const cfBandung = configBandung?.components.find((c) => c.pricingItemId === "mutasi-cf");

    assert.strictEqual(cfJaktim?.enabled, true, "Komponen mutasi-cf harus aktif seragam di Jaktim");
    assert.strictEqual(cfBandung?.enabled, true, "Komponen mutasi-cf harus aktif seragam di Bandung");
  });
});
