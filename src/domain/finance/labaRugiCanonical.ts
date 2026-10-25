/**
 * Canonical Laba Rugi (Profit & Loss) Domain Calculator
 * Admin SUN89 — Biro Jasa Management System
 * 
 * SOT & Accounting Rules:
 * 1. Customer Cash Inflows (Penerimaan / Uang Masuk Pelanggan):
 *    - Realized gross payments received from customers against invoices.
 * 2. Pass-Through Funds (Dana Titipan Biaya Samsat):
 *    - Official Samsat fees (PKB, SWDKLLJ, PNBP, etc.).
 *    - Structured as a pass-through cost / trust fund, NOT business service revenue.
 * 3. Business Service Revenue (Pendapatan Jasa Biro):
 *    - Net service fee earned by the biro = Customer Cash Inflow - Biaya Samsat.
 * 4. Operating Expenses (Beban Operasional Usaha):
 *    - Canonical source is the `pengeluaran` ledger (+ field expenses from `kas_messenger`).
 *    - Kas Kantor credit entries are EXCLUDED from this total to prevent double-counting
 *      (as office expenses are funded from Kas Kantor).
 * 5. Net Business Profit/Loss (Laba Rugi Bersih):
 *    - Net = Customer Cash Inflows - Total Deductions
 *          = (Customer Cash Inflows - Biaya Samsat) - Beban Operasional
 *          = Pendapatan Jasa Biro - Beban Operasional Usaha.
 * 6. Reconciliation:
 *    - Summary cards, breakdown cards, transaction table, and monthly chart all read
 *      from this exact canonical calculation result.
 */

import { InvoiceBillingRecord, PengeluaranItem, KasMessengerItem, LabaRugiMonthlyItem, ProfitItem } from "./types";
import { parseDateSafe } from "../../app/data/dashboardAdapter";

export interface LabaRugiTransactionRow {
  id: number;
  tanggal: string;
  kategori: string;
  keterangan: string;
  invoice: string;
  nominal: number;
  type: "in" | "out";
  dateObj: Date | null;
}

export interface CanonicalLabaRugiSummary {
  // Pemasukan & Pendapatan
  totalPemasukan: number;          // Total uang masuk dari konsumen (cash in)
  totalBiayaSamsat: number;        // Biaya resmi Samsat (dana titipan / pass-through)
  totalPendapatanJasa: number;     // Margin jasa biro = totalPemasukan - totalBiayaSamsat
  
  // Beban Usaha & Pengeluaran
  pengeluaranKantor: number;       // Dari pengeluaran (beban operasional kantor)
  pengeluaranMessenger: number;    // Dari kas_messenger (beban operasional lapangan messenger)
  totalBebanOperasional: number;   // pengeluaranKantor + pengeluaranMessenger
  totalPengeluaran: number;        // totalBebanOperasional + totalBiayaSamsat
  
  // Laba Rugi Bersih
  labaRugiBersih: number;          // totalPemasukan - totalPengeluaran
  
  // Hitungan Transaksi
  tablePemasukanCount: number;
  tablePengeluaranCount: number;
  
  // Data Tabel Transaksi
  combinedTableData: LabaRugiTransactionRow[];
  
  // Data Chart Bulanan (Semester / Tahunan berjalan)
  chartData: LabaRugiMonthlyItem[];
}

const INDONESIAN_MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

const INDONESIAN_MONTH_NAMES_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/**
 * Robust date parser supporting ISO, DD/MM/YYYY, and Indonesian full text dates (e.g. "21 Oktober 2026")
 */
export function parseDateFlexible(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  const str = String(val).trim();
  if (!str || str === "-") return null;

  // Try standard parseDateSafe first
  const parsed = parseDateSafe(str);
  if (parsed && !isNaN(parsed.getTime())) return parsed;

  // Handle Indonesian text format: "21 Oktober 2026" or "21 Okt 2026"
  for (let i = 0; i < INDONESIAN_MONTH_NAMES_FULL.length; i++) {
    const full = INDONESIAN_MONTH_NAMES_FULL[i].toLowerCase();
    const short = INDONESIAN_MONTH_NAMES_SHORT[i].toLowerCase();
    const lower = str.toLowerCase();
    if (lower.includes(full) || lower.includes(short)) {
      const match = lower.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
      if (match) {
        const day = parseInt(match[1], 10);
        const year = parseInt(match[3], 10);
        const d = new Date(year, i, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  return null;
}

/**
 * Evaluates whether a date matches the chosen period filter.
 */
function matchesPeriod(d: Date | null, period: string, referenceDate: Date = new Date()): boolean {
  if (!d) return true; // Keep undated items visible in general list
  if (!period || period === "all") return true;

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  if (period === "daily") {
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  }

  if (period === "weekly") {
    const oneWeekAgo = new Date(year, month, day - 7);
    return d >= oneWeekAgo && d <= referenceDate;
  }

  if (period === "monthly") {
    return d.getFullYear() === year && d.getMonth() === month;
  }

  if (period === "yearly") {
    return d.getFullYear() === year;
  }

  return true;
}

/**
 * Computes the authoritative canonical Laba Rugi metrics from the Single Source of Truth.
 */
export function computeCanonicalLabaRugi(
  invoices: InvoiceBillingRecord[],
  pengeluaranList: PengeluaranItem[],
  kasMessengerList: KasMessengerItem[],
  periodFilter: string = "monthly",
  fallbackProfitData?: ProfitItem[]
): CanonicalLabaRugiSummary {
  // 1. Prepare inflow items from Invoices (or fallback to Profit items if invoices empty)
  interface NormalizedInflow {
    tanggal: string;
    customer: string;
    nopol: string;
    pengurusan: string;
    invoice: string;
    uangMasuk: number;
    biayaSamsat: number;
    profit: number;
    dateObj: Date | null;
  }

  const normalizedInflows: NormalizedInflow[] = [];

  if (Array.isArray(invoices) && invoices.length > 0) {
    invoices.forEach((inv) => {
      // QC-01 & QC-04 Fix: Exclude cancelled invoices from business revenue
      if (
        inv.status === "CANCELLED" ||
        inv.billingStatus === "CANCELLED" ||
        Boolean((inv as any).isCancelled)
      ) {
        return;
      }

      const uangMasuk = Number(inv.terbayar ?? inv.dibayar ?? 0);
      const biayaSamsat = Number(inv.biayaSamsat ?? (inv as any).biaya_samsat ?? 0);
      const profit = Number(inv.profit ?? (inv as any).profit_final ?? Math.max(0, uangMasuk - biayaSamsat));
      const dateStr = inv.tanggalBayar || inv.tanggal || (inv as any).tanggalInvoice || (inv as any).createdAt || "";
      const dateObj = parseDateFlexible(dateStr);

      if (uangMasuk > 0 || biayaSamsat > 0) {
        normalizedInflows.push({
          tanggal: inv.tanggal || (inv as any).tanggalInvoice || (dateObj ? dateObj.toLocaleDateString("id-ID") : "-"),
          customer: inv.customer || "Customer",
          nopol: inv.nopol || "-",
          pengurusan: inv.jenisLayanan || inv.layanan || "Layanan Samsat",
          invoice: inv.invoice || inv.invoiceNo || `INV-${inv.id}`,
          uangMasuk,
          biayaSamsat,
          profit,
          dateObj,
        });
      }
    });
  } else if (Array.isArray(fallbackProfitData) && fallbackProfitData.length > 0) {
    fallbackProfitData.forEach((p) => {
      const dateStr = p.tanggalBayar || p.tanggalUangMasuk || p.tanggal || "";
      const dateObj = parseDateFlexible(dateStr);
      normalizedInflows.push({
        tanggal: p.tanggal,
        customer: p.customer,
        nopol: p.nopol,
        pengurusan: p.pengurusan,
        invoice: p.invoice,
        uangMasuk: p.uangMasuk || 0,
        biayaSamsat: p.biayaSamsat || 0,
        profit: p.profit || 0,
        dateObj,
      });
    });
  }

  // 2. Prepare office expense items
  const normalizedKantor = (pengeluaranList || []).map((item) => ({
    tanggal: item.tanggal,
    keterangan: item.keterangan || "Pengeluaran Kantor",
    invoice: (item as any).invoiceNo || "-",
    nominal: Number(item.nominal || 0),
    dateObj: parseDateFlexible(item.tanggal),
  }));

  // 3. Prepare messenger expense items
  const normalizedMessenger = (kasMessengerList || [])
    .filter((item) => Number(item.out || (item as any).kredit || 0) > 0)
    .map((item) => ({
      tanggal: item.tanggal,
      jenis: item.jenis || "Operasional",
      messenger: item.messenger || "Messenger",
      keterangan: item.keterangan || "Operasional Messenger",
      nominal: Number(item.out || (item as any).kredit || 0),
      dateObj: parseDateFlexible(item.tanggal),
    }));

  // 4. Build transaction items for Table
  let rowId = 1;
  const tablePemasukan: LabaRugiTransactionRow[] = [];
  const tableBiayaSamsat: LabaRugiTransactionRow[] = [];

  normalizedInflows.forEach((item) => {
    if (item.uangMasuk > 0) {
      tablePemasukan.push({
        id: rowId++,
        tanggal: item.tanggal,
        kategori: "Pemasukan",
        keterangan: `${item.pengurusan} - ${item.nopol} (${item.customer})`,
        invoice: item.invoice,
        nominal: item.uangMasuk,
        type: "in",
        dateObj: item.dateObj,
      });
    }
    if (item.biayaSamsat > 0) {
      tableBiayaSamsat.push({
        id: rowId++,
        tanggal: item.tanggal,
        kategori: "Biaya samsat",
        keterangan: `${item.pengurusan} - ${item.nopol} (Biaya Resmi Samsat)`,
        invoice: item.invoice,
        nominal: item.biayaSamsat,
        type: "out",
        dateObj: item.dateObj,
      });
    }
  });

  const tablePengeluaranKantor: LabaRugiTransactionRow[] = normalizedKantor.map((item) => ({
    id: rowId++,
    tanggal: item.tanggal,
    kategori: "Pengeluaran kantor",
    keterangan: item.keterangan,
    invoice: item.invoice,
    nominal: item.nominal,
    type: "out",
    dateObj: item.dateObj,
  }));

  const tablePengeluaranMessenger: LabaRugiTransactionRow[] = normalizedMessenger.map((item) => ({
    id: rowId++,
    tanggal: item.tanggal,
    kategori: `Pengeluaran messenger - ${item.jenis}`,
    keterangan: `${item.keterangan} (${item.messenger})`,
    invoice: "-",
    nominal: item.nominal,
    type: "out",
    dateObj: item.dateObj,
  }));

  // All transactions combined
  const allTableRows: LabaRugiTransactionRow[] = [
    ...tablePemasukan,
    ...tablePengeluaranKantor,
    ...tablePengeluaranMessenger,
    ...tableBiayaSamsat,
  ];

  // 5. Apply Period Filtering to Table & Summary Cards
  // Determine if period filter matches any items; if none match (e.g. historical data outside current month),
  // we check whether any items match; if items exist in data but 0 in filtered, we strictly respect the filter.
  const filteredRows = allTableRows.filter((r) => matchesPeriod(r.dateObj, periodFilter));
  
  // Aggregate summary totals strictly from filtered table items (guaranteeing 100% parity)
  let totalPemasukan = 0;
  let totalBiayaSamsat = 0;
  let pengeluaranKantor = 0;
  let pengeluaranMessenger = 0;

  filteredRows.forEach((r) => {
    if (r.type === "in") {
      totalPemasukan += r.nominal;
    } else {
      if (r.kategori === "Biaya samsat") {
        totalBiayaSamsat += r.nominal;
      } else if (r.kategori === "Pengeluaran kantor") {
        pengeluaranKantor += r.nominal;
      } else if (r.kategori.startsWith("Pengeluaran messenger")) {
        pengeluaranMessenger += r.nominal;
      }
    }
  });

  const totalBebanOperasional = pengeluaranKantor + pengeluaranMessenger;
  const totalPengeluaran = totalBebanOperasional + totalBiayaSamsat;
  const totalPendapatanJasa = Math.max(0, totalPemasukan - totalBiayaSamsat);
  const labaRugiBersih = totalPemasukan - totalPengeluaran;

  const tablePemasukanCount = filteredRows.filter((r) => r.type === "in").length;
  const tablePengeluaranCount = filteredRows.filter((r) => r.type === "out").length;

  // 6. Build Monthly Chart Data
  // Standard 6-month or 12-month chart visualization
  const monthlyBuckets: { [monthIdx: number]: { pendapatan: number; pengeluaran: number } } = {};
  for (let m = 0; m < 12; m++) {
    monthlyBuckets[m] = { pendapatan: 0, pengeluaran: 0 };
  }

  // Populate chart from all rows of the current year (or all rows if undated)
  const currentYear = new Date().getFullYear();
  allTableRows.forEach((r) => {
    const d = r.dateObj;
    const mIdx = d ? d.getMonth() : 0;
    // Include if same year or if undated
    if (!d || d.getFullYear() === currentYear) {
      if (r.type === "in") {
        monthlyBuckets[mIdx].pendapatan += r.nominal;
      } else {
        monthlyBuckets[mIdx].pengeluaran += r.nominal;
      }
    }
  });

  // Default to semester or full year based on whether later months have data
  const hasDataSecondHalf = Object.keys(monthlyBuckets)
    .slice(6)
    .some((idx) => monthlyBuckets[Number(idx)].pendapatan > 0 || monthlyBuckets[Number(idx)].pengeluaran > 0);

  const monthCount = hasDataSecondHalf ? 12 : 6;
  const chartData: LabaRugiMonthlyItem[] = [];

  for (let m = 0; m < monthCount; m++) {
    const p = monthlyBuckets[m].pendapatan;
    const q = monthlyBuckets[m].pengeluaran;
    chartData.push({
      bulan: INDONESIAN_MONTH_NAMES_SHORT[m],
      pendapatan: p,
      pengeluaran: q,
      laba: p - q,
    });
  }

  return {
    totalPemasukan,
    totalBiayaSamsat,
    totalPendapatanJasa,
    pengeluaranKantor,
    pengeluaranMessenger,
    totalBebanOperasional,
    totalPengeluaran,
    labaRugiBersih,
    tablePemasukanCount,
    tablePengeluaranCount,
    combinedTableData: filteredRows,
    chartData,
  };
}
