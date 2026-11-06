import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseNominalSafe,
  isCancelledTransaction,
  extractRowUangMasuk,
  extractRowUangKeluar,
  extractRowTotalTagihan,
  extractRowCashbackTerpending,
  computeDataPenjualanTotals,
} from "../src/domain/finance/dataPenjualanTotals";

describe("Data Penjualan Totals — Calculation & Isolation Contract", () => {
  it("TC-DPT-01: Empty or null dataset returns Rp 0 safely across all 4 metrics", () => {
    const res1 = computeDataPenjualanTotals([]);
    assert.equal(res1.totalUangMasuk, 0);
    assert.equal(res1.totalUangKeluar, 0);
    assert.equal(res1.totalTagihan, 0);
    assert.equal(res1.totalCashbackTerpending, 0);
    assert.equal(res1.transactionCount, 0);
    assert.equal(res1.validPaymentCount, 0);
    assert.equal(res1.validExpenseCount, 0);
    assert.equal(res1.validTagihanCount, 0);
    assert.equal(res1.validCashbackCount, 0);

    const res2 = computeDataPenjualanTotals(null as any);
    assert.equal(res2.totalUangMasuk, 0);
    assert.equal(res2.totalUangKeluar, 0);
    assert.equal(res2.totalTagihan, 0);
    assert.equal(res2.totalCashbackTerpending, 0);
    assert.equal(res2.transactionCount, 0);
  });

  it("TC-DPT-02: Uang Masuk reflects actual paid amount, NOT estimated tagihan", () => {
    const row = {
      "Nomor Order": "ORD-001",
      "Total Tagihan Konsumen": 1500000,
      "Uang Masuk dari Konsumen": 500000, // Partial payment
      "Biaya Pokok Samsat": 300000,
      "Biaya Lainnya": 50000,
      "Biaya Jasa": 200000,
      "Biaya Antar Jemput": 50000,
      "Status Pembayaran": "Belum Lunas",
    };

    const uangMasuk = extractRowUangMasuk(row);
    assert.equal(uangMasuk, 500000, "Must be actual partial payment, not total tagihan of 1,500,000");

    const totals = computeDataPenjualanTotals([row]);
    assert.equal(totals.totalUangMasuk, 500000);
    assert.equal(totals.totalTagihan, 1500000);
    assert.equal(totals.totalCashbackTerpending, 0);
    assert.equal(totals.validPaymentCount, 1);
    assert.equal(totals.validTagihanCount, 1);
  });

  it("TC-DPT-03: Unpaid orders yield Rp 0 Uang Masuk & Rp 0 Cashback, but full Total Tagihan", () => {
    const row = {
      "Nomor Order": "ORD-002",
      "Total Tagihan Konsumen": 2000000,
      "Uang Masuk dari Konsumen": 0,
      "Biaya Pokok Samsat": 1200000,
      "Status Pembayaran": "Belum Bayar",
    };

    const uangMasuk = extractRowUangMasuk(row);
    assert.equal(uangMasuk, 0);

    const tagihan = extractRowTotalTagihan(row);
    assert.equal(tagihan, 2000000);

    const cashback = extractRowCashbackTerpending(row);
    assert.equal(cashback, 0);

    const totals = computeDataPenjualanTotals([row]);
    assert.equal(totals.totalUangMasuk, 0);
    assert.equal(totals.totalTagihan, 2000000);
    assert.equal(totals.totalCashbackTerpending, 0);
    assert.equal(totals.validPaymentCount, 0);
    assert.equal(totals.validTagihanCount, 1);
  });

  it("TC-DPT-04: Uang Keluar includes Biaya Pokok Samsat and Biaya Lainnya, EXCLUDES service margin", () => {
    const row = {
      "Nomor Order": "ORD-003",
      "Total Tagihan Konsumen": 650000,
      "Biaya Pokok Samsat": 450000,
      "Biaya Lainnya": 25000,
      "Biaya Jasa": 150000, // Service fee (Biro margin) - MUST NOT be uang keluar
      "Biaya Antar Jemput": 30000, // Service fee - MUST NOT be uang keluar
    };

    const uangKeluar = extractRowUangKeluar(row);
    assert.equal(uangKeluar, 475000, "Biaya Pokok Samsat (450k) + Biaya Lainnya (25k) = 475k");

    const totals = computeDataPenjualanTotals([row]);
    assert.equal(totals.totalUangKeluar, 475000);
    assert.equal(totals.validExpenseCount, 1);
  });

  it("TC-DPT-05: Cancelled, void, and batal transactions yield Rp 0 for Uang Masuk, Keluar, and Tagihan", () => {
    const cancelledRow1 = {
      "Nomor Order": "ORD-004",
      "Total Tagihan Konsumen": 600000,
      "Uang Masuk dari Konsumen": 0,
      "Biaya Pokok Samsat": 400000,
      "Status Pembayaran": "Batal",
      "Status Pengerjaan": "Dibatalkan",
    };

    const cancelledRow2 = {
      "Nomor Order": "ORD-005",
      "Total Tagihan Konsumen": 1000000,
      "Uang Masuk dari Konsumen": 0,
      "Biaya Pokok Samsat": 600000,
      isCancelled: true,
    };

    const cancelledRow3 = {
      "Nomor Order": "ORD-006",
      "Total Tagihan Konsumen": 500000,
      "Uang Masuk dari Konsumen": 0,
      "Biaya Pokok Samsat": 200000,
      isVoid: true,
    };

    assert.equal(isCancelledTransaction(cancelledRow1), true);
    assert.equal(isCancelledTransaction(cancelledRow2), true);
    assert.equal(isCancelledTransaction(cancelledRow3), true);

    assert.equal(extractRowUangMasuk(cancelledRow1), 0);
    assert.equal(extractRowUangKeluar(cancelledRow1), 0);
    assert.equal(extractRowTotalTagihan(cancelledRow1), 0);
    assert.equal(extractRowCashbackTerpending(cancelledRow1), 0);

    const totals = computeDataPenjualanTotals([cancelledRow1, cancelledRow2, cancelledRow3]);
    assert.equal(totals.totalUangMasuk, 0);
    assert.equal(totals.totalUangKeluar, 0);
    assert.equal(totals.totalTagihan, 0);
    assert.equal(totals.totalCashbackTerpending, 0);
  });

  it("TC-DPT-06: Strict Tab Isolation — Perpanjangan STNK vs Balik Nama vs Mutasi compute independently across all 4 metrics", () => {
    const perpanjanganRows = [
      {
        "Nomor Order": "ORD-P1",
        "Jenis Pengurusan": "Perpanjangan STNK 1 Tahun",
        "Total Tagihan Konsumen": 800000,
        "Uang Masuk dari Konsumen": 600000,
        "Biaya Pokok Samsat": 450000,
        "Biaya Lainnya": 0,
      },
      {
        "Nomor Order": "ORD-P2",
        "Jenis Pengurusan": "Perpanjangan STNK 1 Tahun",
        "Total Tagihan Konsumen": 1000000,
        "Uang Masuk dari Konsumen": 1200000, // 200k overpayment (cashback)
        "Biaya Pokok Samsat": 550000,
        "Biaya Lainnya": 10000,
        "Jumlah Cashback": 200000,
      },
    ];

    const balikNamaRows = [
      {
        "Nomor Order": "ORD-BN1",
        "Jenis Pengurusan": "Balik Nama (BBN)",
        "Total Tagihan Konsumen": 3000000,
        "Uang Masuk dari Konsumen": 2500000,
        "Biaya Pokok Samsat": 1800000,
        "Biaya Lainnya": 50000,
      },
    ];

    const totalsPerpanjangan = computeDataPenjualanTotals(perpanjanganRows, "perpanjangan-1-tahun");
    const totalsBalikNama = computeDataPenjualanTotals(balikNamaRows, "balik-nama");

    // Perpanjangan totals
    assert.equal(totalsPerpanjangan.totalUangMasuk, 1800000);
    assert.equal(totalsPerpanjangan.totalUangKeluar, 1010000);
    assert.equal(totalsPerpanjangan.totalTagihan, 1800000);
    assert.equal(totalsPerpanjangan.totalCashbackTerpending, 200000);
    assert.equal(totalsPerpanjangan.transactionCount, 2);

    // Balik Nama totals
    assert.equal(totalsBalikNama.totalUangMasuk, 2500000);
    assert.equal(totalsBalikNama.totalUangKeluar, 1850000);
    assert.equal(totalsBalikNama.totalTagihan, 3000000);
    assert.equal(totalsBalikNama.totalCashbackTerpending, 0);
    assert.equal(totalsBalikNama.transactionCount, 1);
  });

  it("TC-DPT-07: Pagination Invariance — Totals calculate across entire filtered set, not just current page", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      "Nomor Order": `ORD-${i + 1}`,
      "Total Tagihan Konsumen": 120000,
      "Uang Masuk dari Konsumen": 100000,
      "Biaya Pokok Samsat": 70000,
      "Biaya Lainnya": 5000,
    }));

    const fullTotals = computeDataPenjualanTotals(rows);

    assert.equal(fullTotals.transactionCount, 25);
    assert.equal(fullTotals.totalUangMasuk, 25 * 100000); // 2,500,000
    assert.equal(fullTotals.totalUangKeluar, 25 * 75000); // 1,875,000
    assert.equal(fullTotals.totalTagihan, 25 * 120000); // 3,000,000
    assert.equal(fullTotals.totalCashbackTerpending, 0);
  });

  it("TC-DPT-08: Format parsing resilience (currency strings, number types, commas, dots)", () => {
    assert.equal(parseNominalSafe(150000), 150000);
    assert.equal(parseNominalSafe("150000"), 150000);
    assert.equal(parseNominalSafe("Rp 150.000"), 150000);
    assert.equal(parseNominalSafe("Rp 1.250.500,00"), 1250500);
    assert.equal(parseNominalSafe(null), 0);
    assert.equal(parseNominalSafe(undefined), 0);
    assert.equal(parseNominalSafe(""), 0);
    assert.equal(parseNominalSafe("INVALID"), 0);
  });

  it("TC-DPT-09: Total Tagihan extraction supports multiple fallback keys", () => {
    const row1 = { "Total Tagihan Konsumen": 750000 };
    const row2 = { totalTagihan: 800000 };
    const row3 = { totalBiaya: 900000 };
    const row4 = { totalEstimasi: 650000 };

    assert.equal(extractRowTotalTagihan(row1), 750000);
    assert.equal(extractRowTotalTagihan(row2), 800000);
    assert.equal(extractRowTotalTagihan(row3), 900000);
    assert.equal(extractRowTotalTagihan(row4), 650000);
  });

  it("TC-DPT-10: Cashback Terpending correctly detects pending vs realized cashback", () => {
    const pendingRow = {
      "Nomor Order": "ORD-CB1",
      "Total Tagihan Konsumen": 500000,
      "Uang Masuk dari Konsumen": 750000,
      "Jumlah Cashback": 250000,
      cashbackStatus: "PENDING",
    };

    const realizedRow = {
      "Nomor Order": "ORD-CB2",
      "Total Tagihan Konsumen": 500000,
      "Uang Masuk dari Konsumen": 750000,
      "Jumlah Cashback": 250000,
      cashbackStatus: "REALIZED", // Already paid
    };

    const paidRow = {
      "Nomor Order": "ORD-CB3",
      "Total Tagihan Konsumen": 500000,
      "Uang Masuk dari Konsumen": 750000,
      "Jumlah Cashback": 250000,
      "Status Cashback": "Dibayar", // Already paid
    };

    assert.equal(extractRowCashbackTerpending(pendingRow), 250000, "Pending cashback must be counted");
    assert.equal(extractRowCashbackTerpending(realizedRow), 0, "Realized cashback must be 0");
    assert.equal(extractRowCashbackTerpending(paidRow), 0, "Paid cashback must be 0");
  });
});
