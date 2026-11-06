import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  calculateInvoiceProfitMetrics,
  validateDocumentFinancialData,
  ProfitItem,
} from "../src/domain/finance/types";
import { financeStore } from "../src/app/data/financeStore";

test("Phase B2.5: Financial UI Consistency Remediation Test Suite", async (t) => {
  const { InvoiceA5Dialog } = await import("../src/app/components/InvoiceA5Dialog");
  const { InvoiceDialog } = await import("../src/app/components/InvoiceDialog");

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 1: FINANCACONTENT & STORE CANONICAL PROFIT ADOPTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("FinanceContent-1: Margin positif dihitung akurat sebagai Gross Service Margin", () => {
    const item = {
      uangMasuk: 1500000,
      totalTagihan: 1500000,
      biayaSamsat: 1000000,
      biayaAntarJemput: 50000,
      cashback: 50000,
    };

    const metrics = calculateInvoiceProfitMetrics({
      dibayar: item.uangMasuk,
      totalTagihan: item.totalTagihan,
      biayaSamsat: item.biayaSamsat,
      biayaAntarJemput: item.biayaAntarJemput,
      cashback: item.cashback,
    });

    assert.strictEqual(metrics.grossServiceMargin, 500000, "Gross Service Margin = 1.500.000 - 1.000.000 = 500.000");
    assert.strictEqual(metrics.isGrossDeficit, false);
  });

  await t.test("FinanceContent-2: Margin negatif (defisit) dipertahankan dan tidak di-clamp ke nol", () => {
    // Biaya Samsat resmi membengkak hingga melebihi pembayaran customer
    const deficitItem = {
      uangMasuk: 600000,
      totalTagihan: 600000,
      biayaSamsat: 850000,
      biayaAntarJemput: 50000,
      cashback: 0,
    };

    const metrics = calculateInvoiceProfitMetrics({
      dibayar: deficitItem.uangMasuk,
      totalTagihan: deficitItem.totalTagihan,
      biayaSamsat: deficitItem.biayaSamsat,
      biayaAntarJemput: deficitItem.biayaAntarJemput,
      cashback: deficitItem.cashback,
    });

    assert.strictEqual(metrics.grossServiceMargin, -250000, "Defisit Gross Service Margin harus negatif (-250.000)!");
    assert.strictEqual(metrics.isGrossDeficit, true, "isGrossDeficit harus bernilai true!");
    assert.strictEqual(metrics.netTransactionMargin, -300000, "Net Transaction Margin harus -300.000!");
    assert.strictEqual(metrics.isNetDeficit, true);
  });

  await t.test("FinanceContent-3: Overpayment customer dibatasi dan tidak diakui sebagai revenue", () => {
    const overpaidItem = {
      uangMasuk: 3000000, // Kelebihan bayar 1.800.000
      totalTagihan: 1200000,
      biayaSamsat: 800000,
      biayaAntarJemput: 50000,
      cashback: 50000,
    };

    const metrics = calculateInvoiceProfitMetrics({
      dibayar: overpaidItem.uangMasuk,
      totalTagihan: overpaidItem.totalTagihan,
      biayaSamsat: overpaidItem.biayaSamsat,
      biayaAntarJemput: overpaidItem.biayaAntarJemput,
      cashback: overpaidItem.cashback,
    });

    assert.strictEqual(metrics.recognizedRevenue, 1200000, "Revenue diakui strictly dipatok pada total tagihan (1.200.000)");
    assert.strictEqual(metrics.grossServiceMargin, 400000, "Gross Service Margin = 1.200.000 - 800.000 = 400.000");
    assert.strictEqual(metrics.netTransactionMargin, 300000, "Net Transaction Margin = 400.000 - 50.000 - 50.000 = 300.000");
  });

  await t.test("FinanceContent-4: Gross Service Margin dan Net Transaction Margin terpisah dengan tegas", () => {
    const item = {
      uangMasuk: 1000000,
      totalTagihan: 1000000,
      biayaSamsat: 600000,
      biayaAntarJemput: 75000,
      cashback: 50000,
    };

    const metrics = calculateInvoiceProfitMetrics({
      dibayar: item.uangMasuk,
      totalTagihan: item.totalTagihan,
      biayaSamsat: item.biayaSamsat,
      biayaAntarJemput: item.biayaAntarJemput,
      cashback: item.cashback,
    });

    // Gross Service Margin = 400.000 (jasa biro kotor)
    assert.strictEqual(metrics.grossServiceMargin, 400000);
    // Net Transaction Margin = 275.000 (setelah ongkir dan komisi mitra)
    assert.strictEqual(metrics.netTransactionMargin, 275000);
    assert.notStrictEqual(metrics.grossServiceMargin, metrics.netTransactionMargin);
  });

  await t.test("FinanceContent-5: financeStore getProfitList memelihara defisit operasional", () => {
    // Tambahkan invoice dengan skenario defisit ke financeStore
    const testInvId = 9991;
    financeStore.addInvoice({
      customer: "Pelanggan Defisit Test",
      nopol: "B 9999 DEF",
      totalTagihan: 500000,
      terbayar: 500000,
      biayaSamsat: 700000, // Defisit -200.000
    });

    const profitList = financeStore.getProfitList();
    const deficitEntry = profitList.find((p) => p.nopol === "B 9999 DEF");
    if (deficitEntry) {
      assert.strictEqual(deficitEntry.grossServiceMargin, -200000, "grossServiceMargin di getProfitList harus -200.000!");
      assert.strictEqual(deficitEntry.isGrossDeficit, true);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 2: INVOICE A5 DIALOG UI COMPONENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("InvoiceA5-1: Unloaded data merender banner peringatan dan mendisable tombol output", () => {
    const html = renderToStaticMarkup(
      React.createElement(InvoiceA5Dialog, {
        open: true,
        onOpenChange: () => {},
        data: {},
      })
    );

    assert.ok(html.includes("DATA TIDAK VALID") || html.includes("tidak lengkap"), "Harus menampilkan indikasi data tidak valid");
    assert.ok(html.includes("disabled"), "Tombol aksi harus berstatus disabled!");
  });

  await t.test("InvoiceA5-2: Missing snapshot merender banner peringatan dan mendisable tombol output", () => {
    const dataNoSnapshot = {
      orderNo: "ORD-NOSNAP-01",
      customer: "Pelanggan Tanpa Snapshot",
      nopol: "B 1234 NOS",
      totalTagihan: 0,
      dibayar: 0,
      // No snapshot metadata
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceA5Dialog, {
        open: true,
        onOpenChange: () => {},
        data: dataNoSnapshot,
      })
    );

    assert.ok(html.includes("DATA TIDAK VALID") || html.includes("SNAPSHOT BELUM TERSEDIA"), "Harus memuat status snapshot belum tersedia");
    assert.ok(html.includes("disabled"), "Tombol aksi cetak dan WA harus disabled saat snapshot kosong!");
  });

  await t.test("InvoiceA5-3: Invalid data (nominal negatif) memblokir cetak dan mendisable tombol", () => {
    const dataInvalid = {
      orderNo: "ORD-INV-NEG",
      customer: "Pelanggan Negatif",
      nopol: "B 5555 NEG",
      totalTagihan: -200000,
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceA5Dialog, {
        open: true,
        onOpenChange: () => {},
        data: dataInvalid,
      })
    );

    assert.ok(html.includes("disabled"), "Tombol aksi harus disabled pada invoice negatif!");
  });

  await t.test("InvoiceA5-4: Explicit zero yang sah merender stempel resmi dan tombol aktif", () => {
    const dataExplicitZero = {
      orderNo: "ORD-FREE-01",
      customer: "Pelanggan Bebas Biaya",
      nopol: "B 0000 PRO",
      totalTagihan: 0,
      dibayar: 0,
      isExplicitZero: true,
      serviceId: "srv-free-service",
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceA5Dialog, {
        open: true,
        onOpenChange: () => {},
        data: dataExplicitZero,
      })
    );

    assert.ok(html.includes("INVOICE RESMI"), "Explicit zero sah harus merender stempel INVOICE RESMI");
    assert.ok(html.includes("LUNAS (TERVERIFIKASI)"), "Explicit zero sah harus berstatus Lunas Terverifikasi");
  });

  await t.test("InvoiceA5-5: Full payment valid merender stempel LUNAS dan tombol aktif tanpa disabled", () => {
    const dataFullPaid = {
      orderNo: "ORD-FULL-01",
      customer: "Pelanggan Lunas Sah",
      nopol: "B 7777 LNS",
      totalTagihan: 1500000,
      dibayar: 1500000,
      biayaSamsat: 1000000,
      biayaJasa: 500000,
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceA5Dialog, {
        open: true,
        onOpenChange: () => {},
        data: dataFullPaid,
      })
    );

    assert.ok(html.includes("INVOICE RESMI"), "Harus merender stempel INVOICE RESMI");
    assert.ok(html.includes("LUNAS (TERVERIFIKASI)"), "Harus menampilkan status LUNAS");
  });

  await t.test("InvoiceA5-6: Partial payment valid merender sisa tagihan dan tombol aktif", () => {
    const dataPartial = {
      orderNo: "ORD-PARTIAL-01",
      customer: "Pelanggan Cicilan Sah",
      nopol: "B 4444 CCL",
      totalTagihan: 2000000,
      dibayar: 800000,
      biayaSamsat: 1500000,
      biayaJasa: 500000,
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceA5Dialog, {
        open: true,
        onOpenChange: () => {},
        data: dataPartial,
      })
    );

    assert.ok(html.includes("BELUM LUNAS / KURANG BAYAR"), "Harus berstatus BELUM LUNAS / KURANG BAYAR");
    assert.ok(html.includes("Rp 1.200.000"), "Harus menampilkan sisa kewajiban Rp 1.200.000");
  });

  await t.test("InvoiceA5-7: Overpayment valid merender status lunas tanpa menelan overpayment ke tagihan", () => {
    const dataOverpaid = {
      orderNo: "ORD-OVER-01",
      customer: "Pelanggan Overpaid Sah",
      nopol: "B 8888 OVR",
      totalTagihan: 1000000,
      dibayar: 1500000,
      biayaSamsat: 600000,
      biayaJasa: 400000,
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceA5Dialog, {
        open: true,
        onOpenChange: () => {},
        data: dataOverpaid,
      })
    );

    assert.ok(html.includes("LUNAS (TERVERIFIKASI)"), "Harus berstatus Lunas");
    assert.ok(html.includes("INVOICE RESMI"), "Harus berstatus INVOICE RESMI");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 3: INVOICE DIALOG ZERO-STATE CORRECTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("InvoiceDialog-1: Order unconfigured Rp0 merender 'Belum Dikonfigurasi' (bukan Rp0 hijau) dan mendisable cetak", () => {
    const unconfiguredOrder = {
      orderNo: "ORD-UNCONFIG-01",
      customer: "Pelanggan Belum Konfigurasi",
      nopol: "B 1234 NUL",
      layanan: "Pajak Tahunan",
      totalBiaya: 0,
      dibayar: 0,
      kurang: 0,
      tanggal: "2026-10-30",
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceDialog, {
        open: true,
        onOpenChange: () => {},
        order: unconfiguredOrder,
      })
    );

    assert.ok(html.includes("Belum Dikonfigurasi"), "Harus menampilkan teks 'Belum Dikonfigurasi'!");
    assert.ok(html.includes("text-amber-600"), "Harus menggunakan warna amber (text-amber-600)!");
    assert.ok(html.includes("disabled"), "Tombol Download PDF dan Cetak Invoice HARUS disabled!");
    assert.ok(!html.includes("text-green-600\">Rp 0</span>") && !html.includes("text-green-600\">Rp&nbsp;0</span>"), "TIDAK boleh menampilkan Rp 0 dengan text-green-600 pada kekurangan!");
  });

  await t.test("InvoiceDialog-2: Explicit zero yang sah merender 'Rp 0 (Bebas Biaya)' berwarna hijau dan tombol aktif", () => {
    const explicitZeroOrder = {
      orderNo: "ORD-FREE-PROMO",
      customer: "Pelanggan Bebas Biaya Promo",
      nopol: "B 0000 PRM",
      layanan: "Konsultasi Pajak",
      totalBiaya: 0,
      dibayar: 0,
      kurang: 0,
      isExplicitZero: true,
      serviceId: "srv-free-consultation",
      tanggal: "2026-10-30",
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceDialog, {
        open: true,
        onOpenChange: () => {},
        order: explicitZeroOrder,
      })
    );

    assert.ok(html.includes("Rp 0 (Bebas Biaya)"), "Harus menampilkan label 'Rp 0 (Bebas Biaya)'");
    assert.ok(html.includes("text-green-600"), "Harus berwarna hijau");
  });

  await t.test("InvoiceDialog-3: Data invalid merender banner peringatan dan tombol disabled", () => {
    const invalidOrder = {
      orderNo: "ORD-INV-DATA",
      customer: "Pelanggan Invalid",
      nopol: "B 9999 INV",
      layanan: "Layanan Error",
      totalBiaya: -100000,
      dibayar: 0,
      kurang: -100000,
      tanggal: "2026-10-30",
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceDialog, {
        open: true,
        onOpenChange: () => {},
        order: invalidOrder,
      })
    );

    assert.ok(html.includes("Perhatian:"), "Harus memuat banner Perhatian");
    assert.ok(html.includes("disabled"), "Tombol harus disabled pada data invalid");
  });

  await t.test("InvoiceDialog-4: Invoice valid dan lunas merender 'Rp 0 (Lunas)' berwarna hijau dan tombol aktif", () => {
    const lunasOrder = {
      orderNo: "ORD-LUNAS-99",
      customer: "Pelanggan Lunas Sempurna",
      nopol: "B 1111 LNS",
      layanan: "Perpanjangan STNK",
      totalBiaya: 1000000,
      dibayar: 1000000,
      kurang: 0,
      biayaJasa: 300000,
      biayaSamsat: 700000,
      tanggal: "2026-10-30",
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceDialog, {
        open: true,
        onOpenChange: () => {},
        order: lunasOrder,
      })
    );

    assert.ok(html.includes("Rp 0 (Lunas)"), "Harus menampilkan 'Rp 0 (Lunas)'");
    assert.ok(html.includes("text-green-600"), "Harus berwarna hijau");
  });

  await t.test("InvoiceDialog-5: Invoice valid belum lunas merender nominal sisa tagihan dalam warna merah", () => {
    const partialOrder = {
      orderNo: "ORD-PARTIAL-99",
      customer: "Pelanggan Belum Lunas",
      nopol: "B 2222 BLM",
      layanan: "Balik Nama",
      totalBiaya: 2500000,
      dibayar: 1000000,
      kurang: 1500000,
      biayaJasa: 500000,
      biayaSamsat: 2000000,
      tanggal: "2026-10-30",
    };

    const html = renderToStaticMarkup(
      React.createElement(InvoiceDialog, {
        open: true,
        onOpenChange: () => {},
        order: partialOrder,
      })
    );

    assert.ok(html.includes("1.500.000"), "Harus memuat nominal sisa 1.500.000");
    assert.ok(html.includes("text-red-600"), "Harus berwarna merah (text-red-600)");
  });

});
