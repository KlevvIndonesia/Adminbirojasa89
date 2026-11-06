import test from "node:test";
import assert from "node:assert/strict";
import {
  SERVICE_STANDARD_BASELINES,
  isRowCustomOrOverridden,
} from "../src/app/components/BiayaLayanan";

test("Biaya Layanan - Option A UI, Formula Display & Custom Tariff Filter", async (t) => {
  await t.test("1. Baselines defined for all canonical services", () => {
    const services = [
      "Perpanjangan 1 Tahun",
      "Perpanjangan 5 Tahun",
      "Mutasi Antar Samsat",
      "Mutasi Luar Daerah",
      "Balik Nama",
      "Tarik Berkas",
      "Duplikat STNK",
      "Lainnya",
    ];

    for (const s of services) {
      assert.ok(SERVICE_STANDARD_BASELINES[s], `Baseline should exist for ${s}`);
      assert.ok(typeof SERVICE_STANDARD_BASELINES[s].jasa === "number", `jasa should be number for ${s}`);
      assert.ok(typeof SERVICE_STANDARD_BASELINES[s].kurir === "number", `kurir should be number for ${s}`);
    }
  });

  await t.test("2. isRowCustomOrOverridden accurately detects default baseline rows", () => {
    const standardRow = {
      id: "row-1",
      layanan: "Perpanjangan 1 Tahun",
      wilayah: "Samsat Jakarta Pusat",
      biayaJasaLengkap: 250000,
      biayaAntarJemput: 50000,
      pengurusanKhususEnabled: false,
      biayaLainnya: [],
    };

    assert.equal(isRowCustomOrOverridden(standardRow), false, "Standard baseline row should return false");
  });

  await t.test("3. isRowCustomOrOverridden detects custom Jasa or Kurir rates", () => {
    const customJasaRow = {
      id: "row-2",
      layanan: "Perpanjangan 1 Tahun",
      wilayah: "Samsat Jakarta Timur",
      biayaJasaLengkap: 350000, // custom Jasa
      biayaAntarJemput: 50000,
      pengurusanKhususEnabled: false,
      biayaLainnya: [],
    };
    assert.equal(isRowCustomOrOverridden(customJasaRow), true, "Custom jasa should return true");

    const customKurirRow = {
      id: "row-3",
      layanan: "Perpanjangan 1 Tahun",
      wilayah: "Samsat Kepulauan Seribu",
      biayaJasaLengkap: 250000,
      biayaAntarJemput: 100000, // custom Kurir
      pengurusanKhususEnabled: false,
      biayaLainnya: [],
    };
    assert.equal(isRowCustomOrOverridden(customKurirRow), true, "Custom kurir should return true");
  });

  await t.test("4. isRowCustomOrOverridden detects active Pengurusan Khusus or Biaya Lainnya", () => {
    const khususRow = {
      id: "row-4",
      layanan: "Perpanjangan 1 Tahun",
      wilayah: "Samsat Bekasi",
      biayaJasaLengkap: 250000,
      biayaAntarJemput: 50000,
      pengurusanKhususEnabled: true, // Khusus active
      biayaLainnya: [],
    };
    assert.equal(isRowCustomOrOverridden(khususRow), true, "Active pengurusan khusus should return true");

    const extraFeesRow = {
      id: "row-5",
      layanan: "Perpanjangan 1 Tahun",
      wilayah: "Samsat Depok",
      biayaJasaLengkap: 250000,
      biayaAntarJemput: 50000,
      pengurusanKhususEnabled: false,
      biayaLainnya: [
        { id: "bl-1", label: "Parkir Khusus Gedung", nominal: 10000, enabled: true },
      ],
    };
    assert.equal(isRowCustomOrOverridden(extraFeesRow), true, "Active extra custom fees should return true");
  });

  await t.test("5. Filtering logic correctly isolates only custom rows", () => {
    const dataset = [
      { id: "1", layanan: "Perpanjangan 1 Tahun", wilayah: "A", biayaJasaLengkap: 250000, biayaAntarJemput: 50000 },
      { id: "2", layanan: "Perpanjangan 1 Tahun", wilayah: "B", biayaJasaLengkap: 300000, biayaAntarJemput: 50000 },
      { id: "3", layanan: "Perpanjangan 1 Tahun", wilayah: "C", biayaJasaLengkap: 250000, biayaAntarJemput: 50000 },
      { id: "4", layanan: "Perpanjangan 1 Tahun", wilayah: "D", biayaJasaLengkap: 250000, biayaAntarJemput: 75000 },
    ];

    const customRows = dataset.filter((row) => isRowCustomOrOverridden(row));
    assert.equal(customRows.length, 2);
    assert.deepEqual(customRows.map((r) => r.id), ["2", "4"]);
  });
});
