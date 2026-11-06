import test from "node:test";
import assert from "node:assert";
import { getFinancialKPIs } from "../src/app/data/dashboardAdapter";
import { computeOrderStats } from "../src/app/components/Order";
import type { InvoiceBillingRecord, KasKantorItem, ProfitItem } from "../src/domain/finance/types";

test("AC1: Order dibatalkan dengan payment belum di-void -> revenueTotal Dashboard TIDAK termasuk order ini", () => {
  const mockInvoices: InvoiceBillingRecord[] = [
    {
      id: 1,
      tanggal: "2026-10-29",
      customer: "Active Customer",
      nopol: "B 1234 ACT",
      jenisLayanan: "Perpanjangan 1 Tahun",
      totalTagihan: 500000,
      terbayar: 500000,
      sisa: 0,
      status: "Lunas",
      billingStatus: "ACTIVE",
      jatuhTempo: "2026-10-30",
      invoice: "INV-001",
    },
    {
      id: 2,
      tanggal: "2026-10-29",
      customer: "Cancelled Customer with Active Payment",
      nopol: "B 5678 CAN",
      jenisLayanan: "Mutasi Luar Daerah",
      totalTagihan: 1500000,
      terbayar: 1500000, // payment unvoided / still on invoice
      sisa: 0,
      status: "CANCELLED",
      billingStatus: "CANCELLED",
      jatuhTempo: "2026-10-30",
      invoice: "INV-002",
      orderNo: "ORD-CAN-002",
    },
    {
      id: 3,
      tanggal: "2026-10-29",
      customer: "Cancelled Customer by Flag",
      nopol: "B 9999 FLG",
      jenisLayanan: "Balik Nama",
      totalTagihan: 750000,
      terbayar: 750000,
      sisa: 0,
      status: "Belum Lunas",
      billingStatus: "ACTIVE",
      jatuhTempo: "2026-10-30",
      invoice: "INV-003",
    },
  ];
  (mockInvoices[2] as unknown as Record<string, unknown>).isCancelled = true;

  const mockKas: KasKantorItem[] = [{ id: 1, tanggal: "2026-10-29", keterangan: "Kas", status: "Debit", debit: 500000, kredit: 0, total: 500000, penanggungJawab: "Admin" }];
  const mockProfit: ProfitItem[] = [];

  const kpis = getFinancialKPIs(mockInvoices, mockKas, mockProfit);

  // revenueTotal must ONLY include Active Customer (500,000), strictly excluding the 1,500,000 and 750,000
  assert.strictEqual(kpis.revenueTotal, 500000, "Dashboard revenueTotal must exclude cancelled invoices even if terbayar > 0");
  assert.strictEqual(kpis.outstandingTotal, 0, "Dashboard outstandingTotal must not count cancelled invoices");
});

test("AC2: Skenario sama -> totalRevenue Order History TIDAK termasuk order ini", () => {
  const mockOrders = [
    {
      orderNo: "ORD-ACT-001",
      customer: "Customer A",
      nopol: "B 1111 AAA",
      layanan: "Perpanjangan 1 Tahun",
      currentStageName: "Dokumen Telah Diterima",
      isCancelled: false,
      totalBiaya: 450000,
    },
    {
      orderNo: "ORD-CAN-002",
      customer: "Customer B",
      nopol: "B 2222 BBB",
      layanan: "Mutasi Luar Daerah",
      currentStageName: "Dibatalkan",
      isCancelled: true,
      totalBiaya: 1200000, // payment unvoided / deposited
    },
    {
      orderNo: "ORD-CAN-003",
      customer: "Customer C",
      nopol: "B 3333 CCC",
      layanan: "Balik Nama",
      currentStageName: "Verifikasi",
      status: "Dibatalkan",
      isCancelled: true,
      totalBiaya: 800000,
    },
  ];

  const stats = computeOrderStats(mockOrders);

  // totalRevenue must only count ORD-ACT-001 (450,000)
  assert.strictEqual(stats.totalRevenue, 450000, "Order History totalRevenue must exclude cancelled orders");
  assert.strictEqual(stats.totalOrders, 1, "Order History totalOrders must exclude cancelled orders");
  assert.strictEqual(stats.activeOrders.length, 1);
});

test("AC3: Order aktif normal -> tetap terhitung seperti sebelum perubahan (regresi harus nol)", () => {
  const mockInvoices: InvoiceBillingRecord[] = [
    {
      id: 10,
      tanggal: "2026-10-29",
      customer: "Active 1",
      nopol: "B 1010 NRM",
      jenisLayanan: "Perpanjangan 1 Tahun",
      totalTagihan: 600000,
      terbayar: 600000,
      sisa: 0,
      status: "Lunas",
      billingStatus: "ACTIVE",
      jatuhTempo: "2026-10-30",
      invoice: "INV-010",
    },
    {
      id: 11,
      tanggal: "2026-10-29",
      customer: "Active 2 (Partial)",
      nopol: "B 2020 NRM",
      jenisLayanan: "Balik Nama",
      totalTagihan: 1000000,
      terbayar: 400000,
      sisa: 600000,
      status: "Kurang Bayar",
      billingStatus: "ACTIVE",
      jatuhTempo: "2026-10-30",
      invoice: "INV-011",
    },
  ];

  const kpis = getFinancialKPIs(mockInvoices, [], []);
  assert.strictEqual(kpis.revenueTotal, 1000000, "Normal active invoices must accumulate full terbayar (600k + 400k = 1M)");
  assert.strictEqual(kpis.outstandingTotal, 600000, "Normal active invoice outstanding remains 600k");

  const mockOrders = [
    {
      orderNo: "ORD-NRM-001",
      customer: "Normal 1",
      nopol: "B 1010 NRM",
      layanan: "Perpanjangan 1 Tahun",
      currentStageName: "Proses Samsat",
      isCancelled: false,
      totalBiaya: 600000,
    },
    {
      orderNo: "ORD-NRM-002",
      customer: "Normal 2",
      nopol: "B 2020 NRM",
      layanan: "Balik Nama",
      currentStageName: "Verifikasi Ulang",
      isCancelled: false,
      totalBiaya: 1000000,
    },
  ];

  const stats = computeOrderStats(mockOrders);
  assert.strictEqual(stats.totalRevenue, 1600000, "Normal active orders total revenue must be preserved without regression");
  assert.strictEqual(stats.totalOrders, 2, "Normal active orders count must be preserved without regression");
});

test("AC4: Order dibatalkan dengan payment sudah di-void -> tetap benar, tidak ada efek samping aneh", () => {
  const mockInvoices: InvoiceBillingRecord[] = [
    {
      id: 20,
      tanggal: "2026-10-29",
      customer: "Voided & Cancelled Customer",
      nopol: "B 8888 VOI",
      jenisLayanan: "Mutasi Luar Daerah",
      totalTagihan: 1200000,
      terbayar: 0, // payment voided back to 0
      sisa: 1200000,
      status: "CANCELLED",
      billingStatus: "CANCELLED",
      jatuhTempo: "2026-10-30",
      invoice: "INV-020",
      orderNo: "ORD-VOI-020",
    },
  ];

  const kpis = getFinancialKPIs(mockInvoices, [], []);
  assert.strictEqual(kpis.revenueTotal, 0, "Voided and cancelled invoice adds 0 to revenueTotal");
  assert.strictEqual(kpis.outstandingTotal, 0, "Cancelled invoice adds 0 to outstandingTotal even if sisa field has residual");

  const mockOrders = [
    {
      orderNo: "ORD-VOI-020",
      customer: "Voided & Cancelled Customer",
      nopol: "B 8888 VOI",
      layanan: "Mutasi Luar Daerah",
      currentStageName: "Dibatalkan",
      isCancelled: true,
      totalBiaya: 1200000,
    },
  ];

  const stats = computeOrderStats(mockOrders);
  assert.strictEqual(stats.totalRevenue, 0, "Cancelled order with voided payment contributes 0 to revenue");
  assert.strictEqual(stats.totalOrders, 0, "Cancelled order contributes 0 to active completed count");
  assert.strictEqual(isNaN(stats.totalRevenue), false, "Must not be NaN");
  assert.strictEqual(isNaN(stats.totalOrders), false, "Must not be NaN");
});
