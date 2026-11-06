import test from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import { financeService } from "../server/src/services/financeService";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import {
  computeCashFlowReconciliation,
  computeCanonicalLabaRugi,
  isQuarantinedInvoice,
} from "../src/domain/finance/labaRugiCanonical";
import { menuItems } from "../src/app/config/navigationConfig";
import type { KasKantorItem, KasMessengerItem } from "../src/domain/finance/types";

// =========================================================================
// SECTION A & B: CASH FLOW RECONCILIATION & TWO-LAYER SEGREGATION TESTS
// =========================================================================

test("POST-PHASE C - Section A: Kas Kantor Cash Flow Calculation (Saldo Awal, Masuk, Keluar, Saldo Akhir)", () => {
  const mockKasKantor: KasKantorItem[] = [
    // Previous period (before 2026-10-01) -> belongs to Saldo Awal
    {
      id: 1,
      tanggal: "2026-09-15",
      status: "Masuk",
      keterangan: "Modal Awal Kantor",
      debit: 10000000,
      kredit: 0,
      total: 10000000,
    },
    {
      id: 2,
      tanggal: "2026-09-20",
      status: "Keluar",
      keterangan: "Pembelian Meja Kantor",
      debit: 0,
      kredit: 2000000,
      total: 8000000,
    },
    // Current period (October 2026) -> in-period mutasi
    {
      id: 3,
      tanggal: "2026-10-05",
      status: "Masuk",
      keterangan: "Pembayaran Invoice Pelanggan INV-001",
      debit: 3500000,
      kredit: 0,
      total: 11500000,
    },
    {
      id: 4,
      tanggal: "2026-10-10",
      status: "Keluar",
      keterangan: "Biaya Listrik & Internet",
      debit: 0,
      kredit: 1500000,
      total: 10000000,
    },
  ];

  const cashFlow = computeCashFlowReconciliation(
    mockKasKantor,
    [],
    "custom",
    "2026-10-01",
    "2026-10-31",
    new Date(2026, 9, 15)
  );

  // Saldo Awal: 10.000.000 - 2.000.000 = 8.000.000
  assert.strictEqual(cashFlow.kasKantor.saldoAwal, 8000000, "Saldo awal harus mencakup mutasi sebelum periode");
  // Total Masuk: 3.500.000
  assert.strictEqual(cashFlow.kasKantor.totalMasuk, 3500000, "Total debit dalam periode harus sesuai");
  // Total Keluar: 1.500.000
  assert.strictEqual(cashFlow.kasKantor.totalKeluar, 1500000, "Total kredit dalam periode harus sesuai");
  // Saldo Akhir: 8.000.000 + 3.500.000 - 1.500.000 = 10.000.000
  assert.strictEqual(cashFlow.kasKantor.saldoAkhir, 10000000, "Saldo akhir = saldoAwal + masuk - keluar");
  assert.strictEqual(cashFlow.kasKantor.transactionCount, 2, "Jumlah transaksi dalam periode harus 2");
});

test("POST-PHASE C - Section A: Kas Messenger Cash Flow & Per-Messenger Breakdown", () => {
  const mockKasMessenger: KasMessengerItem[] = [
    // Previous period for Budi
    {
      id: 1,
      tanggal: "2026-09-28",
      jenis: "PETTY CASH",
      messenger: "Budi Santoso",
      keterangan: "Top up petty cash",
      in: 1000000,
      out: 0,
      total: 1000000,
    },
    // In period for Budi
    {
      id: 2,
      tanggal: "2026-10-02",
      jenis: "SAMSAT",
      messenger: "Budi Santoso",
      keterangan: "Bayar di Samsat Pajak Tahunan",
      in: 0,
      out: 400000,
      total: 600000,
    },
    // In period for Ahmad
    {
      id: 3,
      tanggal: "2026-10-03",
      jenis: "PETTY CASH",
      messenger: "Ahmad Dahlan",
      keterangan: "Top up kas kurir",
      in: 500000,
      out: 0,
      total: 500000,
    },
    {
      id: 4,
      tanggal: "2026-10-04",
      jenis: "BBM",
      messenger: "Ahmad Dahlan",
      keterangan: "BBM Motor Kurir",
      in: 0,
      out: 50000,
      total: 450000,
    },
  ];

  const cashFlow = computeCashFlowReconciliation(
    [],
    mockKasMessenger,
    "custom",
    "2026-10-01",
    "2026-10-31",
    new Date(2026, 9, 15)
  );

  // Overall Kas Messenger
  assert.strictEqual(cashFlow.kasMessenger.saldoAwal, 1000000, "Saldo awal gabungan kurir harus 1.000.000");
  assert.strictEqual(cashFlow.kasMessenger.totalMasuk, 500000, "Total masuk kurir dalam periode harus 500.000");
  assert.strictEqual(cashFlow.kasMessenger.totalKeluar, 450000, "Total keluar kurir dalam periode harus 450.000");
  assert.strictEqual(cashFlow.kasMessenger.saldoAkhir, 1050000, "Saldo akhir gabungan kurir harus 1.050.000");

  // Per-Messenger Breakdown
  const budi = cashFlow.kasMessenger.perMessenger["Budi Santoso"];
  assert.ok(budi, "Budi Santoso breakdown must exist");
  assert.strictEqual(budi.saldoAwal, 1000000);
  assert.strictEqual(budi.totalMasuk, 0);
  assert.strictEqual(budi.totalKeluar, 400000);
  assert.strictEqual(budi.saldoAkhir, 600000);

  const ahmad = cashFlow.kasMessenger.perMessenger["Ahmad Dahlan"];
  assert.ok(ahmad, "Ahmad Dahlan breakdown must exist");
  assert.strictEqual(ahmad.saldoAwal, 0);
  assert.strictEqual(ahmad.totalMasuk, 500000);
  assert.strictEqual(ahmad.totalKeluar, 50000);
  assert.strictEqual(ahmad.saldoAkhir, 450000);
});

test("POST-PHASE C - Section A & B: Strict Elimination of Internal Transfers in Consolidated Cash Flow", () => {
  const mockKasKantor: KasKantorItem[] = [
    // 1. External customer inflow
    {
      id: 1,
      tanggal: "2026-10-05",
      status: "Masuk",
      keterangan: "Pembayaran Invoice Pelanggan",
      debit: 5000000,
      kredit: 0,
      total: 5000000,
    },
    // 2. Internal transfer: Office tops up messenger petty cash
    {
      id: 2,
      tanggal: "2026-10-06",
      status: "Keluar",
      keterangan: "Top up kas messenger Budi",
      debit: 0,
      kredit: 1000000,
      total: 4000000,
    },
    // 3. Internal transfer: Messenger deposits remaining cash back to office
    {
      id: 3,
      tanggal: "2026-10-08",
      status: "Masuk",
      keterangan: "Setoran sisa kas messenger Budi ke kantor",
      debit: 300000,
      kredit: 0,
      total: 4300000,
    },
    // 4. External OPEX outflow
    {
      id: 4,
      tanggal: "2026-10-09",
      status: "Keluar",
      keterangan: "Biaya Sewa Kantor Bulanan",
      debit: 0,
      kredit: 2000000,
      total: 2300000,
    },
  ];

  const mockKasMessenger: KasMessengerItem[] = [
    // 5. Internal transfer: Messenger receives top up from office
    {
      id: 5,
      tanggal: "2026-10-06",
      jenis: "PETTY CASH",
      messenger: "Budi Santoso",
      keterangan: "Top up kas messenger Budi",
      in: 1000000,
      out: 0,
      total: 1000000,
    },
    // 6. External Samsat pass-through disbursement
    {
      id: 6,
      tanggal: "2026-10-07",
      jenis: "SAMSAT",
      messenger: "Budi Santoso",
      keterangan: "Bayar di Samsat Pajak Tahunan",
      in: 0,
      out: 700000,
      total: 300000,
    },
    // 7. Internal transfer: Messenger returns remaining cash to office
    {
      id: 7,
      tanggal: "2026-10-08",
      jenis: "SETORAN",
      messenger: "Budi Santoso",
      keterangan: "Setoran sisa kas messenger Budi ke kantor",
      in: 0,
      out: 300000,
      total: 0,
    },
  ];

  const cashFlow = computeCashFlowReconciliation(
    mockKasKantor,
    mockKasMessenger,
    "custom",
    "2026-10-01",
    "2026-10-31",
    new Date(2026, 9, 15)
  );

  const rekap = cashFlow.rekapitulasiGabungan;

  // External Inflows: Only Item 1 (5.000.000). Item 3 (300.000) and Item 5 (1.000.000) are internal.
  assert.strictEqual(rekap.totalPenerimaanEksternal, 5000000, "External inflow must exclude internal transfers");

  // External Outflows: Item 4 (2.000.000 OPEX) + Item 6 (700.000 Samsat) = 2.700.000.
  // Item 2 (1.000.000) and Item 7 (300.000) are internal transfers and must be eliminated.
  assert.strictEqual(rekap.totalPengeluaranEksternal, 2700000, "External outflow must exclude internal transfers");

  // Perubahan Kas Bersih: 5.000.000 - 2.700.000 = 2.300.000
  assert.strictEqual(rekap.perubahanKasBersih, 2300000, "Perubahan kas bersih = Penerimaan Eksternal - Pengeluaran Eksternal");

  // Total internal transfers eliminated: 300.000 (messenger to office) + 1.000.000 (office to messenger) = 1.300.000
  assert.strictEqual(rekap.internalTransferEliminated.total, 1300000, "Internal transfers eliminated must equal 1.300.000");
  assert.strictEqual(rekap.internalTransferEliminated.messengerToOffice, 300000);
  assert.strictEqual(rekap.internalTransferEliminated.officeToMessenger, 1000000);

  // Setoran Samsat isolated in rincian
  assert.strictEqual(rekap.rincianPengeluaran.setoranSamsat, 700000, "Samsat cash disbursement isolated as pass-through");
});

// =========================================================================
// SECTION C: DYNAMIC GRANULAR CHART AGGREGATION TESTS
// =========================================================================

test("POST-PHASE C - Section C: Dynamic Chart Bucketing (Daily DD/MM, Weekly Mgg, Bulanan, Tahunan)", () => {
  const mockInvoices: any[] = [
    {
      id: 1,
      invoiceNo: "INV-001",
      tanggal: "2026-10-05",
      customer: "Cust A",
      nopol: "B 1234 AA",
      layanan: "Pajak",
      totalTagihan: 1000000,
      dibayar: 1000000,
      biayaSamsat: 600000,
      status: "PAID",
      costClassification: "CONFIRMED",
    },
    {
      id: 2,
      invoiceNo: "INV-002",
      tanggal: "2026-10-18",
      customer: "Cust B",
      nopol: "B 5678 BB",
      layanan: "Pajak",
      totalTagihan: 2000000,
      dibayar: 2000000,
      biayaSamsat: 1200000,
      status: "PAID",
      costClassification: "CONFIRMED",
    },
  ];

  const mockPengeluaran: any[] = [
    {
      id: 1,
      tanggal: "2026-10-05",
      kategori: "Operasional Kantor & Utilitas",
      keterangan: "Beban Operasional 1",
      nominal: 100000,
      metode: "Cash",
      isInternalTransfer: false,
    },
  ];

  // 1. Daily Test: Should group by date DD/MM
  const dailyLabaRugi = computeCanonicalLabaRugi(
    mockInvoices,
    mockPengeluaran,
    [],
    "daily",
    undefined,
    undefined,
    undefined,
    []
  );

  assert.ok(dailyLabaRugi.chartData && dailyLabaRugi.chartData.length > 0, "Daily chart data must exist");
  // Check label format DD/MM
  const dailyLabels = dailyLabaRugi.chartData.map((d) => d.bulan);
  dailyLabels.forEach((label) => {
    assert.match(label, /^\d{2}\/\d{2}$/, `Daily label "${label}" must match DD/MM format`);
  });

  // 2. Weekly Test: Should group by Mgg 1..Mgg 5
  const weeklyLabaRugi = computeCanonicalLabaRugi(
    mockInvoices,
    mockPengeluaran,
    [],
    "weekly",
    undefined,
    undefined,
    undefined,
    []
  );

  assert.ok(weeklyLabaRugi.chartData && weeklyLabaRugi.chartData.length === 5, "Weekly chart must have 5 weeks");
  assert.strictEqual(weeklyLabaRugi.chartData[0].bulan, "Mgg 1");
  assert.strictEqual(weeklyLabaRugi.chartData[4].bulan, "Mgg 5");

  // 3. Bulanan Test: Should group by month (Jan .. Des)
  const monthlyLabaRugi = computeCanonicalLabaRugi(
    mockInvoices,
    mockPengeluaran,
    [],
    "monthly",
    undefined,
    undefined,
    undefined,
    []
  );

  assert.ok(monthlyLabaRugi.chartData.length >= 6, "Monthly chart must contain months");
  assert.strictEqual(monthlyLabaRugi.chartData[0].bulan, "Jan");

  // 4. Custom Range Test: Should filter rows within range and label with DD/MM
  const customLabaRugi = computeCanonicalLabaRugi(
    mockInvoices,
    mockPengeluaran,
    [],
    "custom",
    undefined,
    "2026-10-01",
    "2026-10-10",
    []
  );

  // Only INV-001 (2026-10-05) falls within 2026-10-01 to 2026-10-10. INV-002 (2026-10-18) is excluded.
  assert.strictEqual(customLabaRugi.totalPemasukan, 1000000, "Custom range must include only transactions in range");
  assert.strictEqual(customLabaRugi.totalBiayaSamsat, 600000);
});

// =========================================================================
// SECTION D: PROFIT BACKEND JOIN & FULL INVOICE DATASET TESTS
// =========================================================================

test("POST-PHASE C - Section D: Backend dbFinanceRepository.getProfitList Join & Pagination Support", () => {
  const profitList = dbFinanceRepository.getProfitList();
  
  // Must return all non-quarantined transactions (not just 1 invoice)
  assert.ok(Array.isArray(profitList), "Profit list must be an array");
  assert.ok(profitList.length > 50, `Profit list must contain complete transactions (found ${profitList.length}, expected > 50)`);

  // Quarantined invoice INV-1026-080 (5 Miliar) MUST BE EXCLUDED
  const quarantined = profitList.find(
    (p) => p.invoice === "INV-1026-080" || p.customer === "PT Karantina Uji Coba Fiskal"
  );
  assert.strictEqual(quarantined, undefined, "Quarantined invoice must not be present in profit list");

  // Verify fields returned by database join:
  const firstItem = profitList[0];
  assert.ok(firstItem.id, "Item must have id");
  assert.ok(firstItem.tanggal, "Item must have tanggal");
  assert.ok(firstItem.invoice, "Item must have invoice");
  assert.ok(firstItem.customer, "Item must have customer");
  assert.ok(typeof firstItem.uangMasuk === "number", "uangMasuk must be numeric");
  assert.ok(typeof firstItem.biayaSamsat === "number", "biayaSamsat must be numeric");
  assert.ok(typeof firstItem.profit === "number", "profit must be numeric");
  assert.ok(firstItem.namaBank !== undefined, "namaBank metadata must be attached");
  assert.ok(firstItem.nomorRekening !== undefined, "nomorRekening metadata must be attached");
  assert.ok(firstItem.metodePembayaran !== undefined, "metodePembayaran must be attached");

  // Verify partially paid invoices are preserved (not discarded by isFullyPaid)
  const partialItems = profitList.filter(
    (p) => p.uangMasuk > 0 && p.totalTagihan && p.uangMasuk < p.totalTagihan
  );
  assert.ok(partialItems.length > 0, "Partially paid invoices must be included in profit list");
});

test("POST-PHASE C - Section D: Quarantined Invariant Check (INV-1026-080 / >= 5 Miliar)", () => {
  const q1 = isQuarantinedInvoice({ invoiceNo: "INV-1026-080", totalTagihan: 5000000000 });
  const q2 = isQuarantinedInvoice({ orderNo: "ORD-1026-080", totalTagihan: 100000 });
  const q3 = isQuarantinedInvoice({ invoiceNo: "INV-NORMAL-001", totalTagihan: 6000000000 });
  const normal = isQuarantinedInvoice({ invoiceNo: "INV-1026-001", totalTagihan: 500000 });

  assert.strictEqual(q1, true, "INV-1026-080 must be quarantined");
  assert.strictEqual(q2, true, "ORD-1026-080 must be quarantined");
  assert.strictEqual(q3, true, ">= 5 Miliar must be quarantined");
  assert.strictEqual(normal, false, "Normal invoice must not be quarantined");
});

// =========================================================================
// SYSTEM INTEGRITY & REPOSITORY INVARIANTS
// =========================================================================

test("POST-PHASE C - System Invariant: Pengeluaran Tab Remains Removed from Navigation", () => {
  const financeMenu = menuItems.find((item) => item.id === "finance");
  assert.ok(financeMenu, "Finance menu group must exist");
  const pengeluaranItem = financeMenu.subItems?.find(
    (c) => c.id === "finance-pengeluaran" || c.label.toLowerCase() === "pengeluaran"
  );
  assert.strictEqual(pengeluaranItem, undefined, "Pengeluaran tab must remain removed");
});

test("POST-PHASE C - Safety Invariant: Operational Database Integrity Intact", () => {
  const operationalDbPath = "server/data/database.sqlite";
  assert.ok(fs.existsSync(operationalDbPath), "Operational database must exist");
  const dbBytes = fs.readFileSync(operationalDbPath);
  assert.ok(dbBytes.length > 0, "Operational database must not be empty");
  // Check valid SQLite format 3 header
  const header = dbBytes.subarray(0, 16).toString("utf-8");
  assert.strictEqual(header, "SQLite format 3\0", "Database must be a valid SQLite database");
});
