/**
 * Canonical Laba Rugi (Profit & Loss) Domain Calculator
 * Admin SUN89 — Biro Jasa Management System
 * 
 * SOT & Accounting Rules (Phase C Locked Baseline):
 * 1. Customer Cash Inflows (Penerimaan / Uang Masuk Pelanggan):
 *    - Realized gross payments received from customers against invoices (NetCustomerReceipts).
 * 2. Pass-Through Funds (Dana Titipan Biaya Samsat):
 *    - Official Samsat fees (PKB, SWDKLLJ, PNBP, etc.).
 *    - Proportional Cost Matching: Matched COGS = min(S, (S/T) * eligiblePayment).
 * 3. Business Service Revenue (Pendapatan Jasa Biro):
 *    - Net service fee earned by the biro = Customer Cash Inflow - Biaya Samsat.
 * 4. Operating Expenses (Beban Operasional Usaha):
 *    - Canonical source is unified office expense + courier field operational.
 *    - Internal transfers (setoran sisa kas kurir) and pass-through Samsat disbursements are EXCLUDED (Rp 0 impact).
 *    - Realized cashback is included in total operating expenses.
 * 5. Net Business Profit/Loss (Laba Rugi Bersih):
 *    - labaRugiBersih = totalPendapatanJasa - totalBebanOperasional.
 * 6. Explicit Quarantine:
 *    - INV-1026-080 / ORD-1026-080 excluded from normal P&L and routed to Anomaly Drawer.
 */

import {
  InvoiceBillingRecord,
  PengeluaranItem,
  KasKantorItem,
  KasMessengerItem,
  LabaRugiMonthlyItem,
  ProfitItem,
  classifyFinancialTransaction,
} from "./types";
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


export interface CashFlowLedgerSummary {
  saldoAwal: number;
  totalMasuk: number;   // Debit (uang masuk)
  totalKeluar: number;  // Kredit (uang keluar)
  saldoAkhir: number;
  transactionCount: number;
}

export interface MessengerCashFlowItem extends CashFlowLedgerSummary {
  messenger: string;
  messengerId?: string;
}

export interface CashFlowReconciliationSummary {
  kasKantor: CashFlowLedgerSummary;
  kasMessenger: CashFlowLedgerSummary & {
    perMessenger: Record<string, MessengerCashFlowItem>;
  };
  rekapitulasiGabungan: {
    totalPenerimaanEksternal: number;
    totalPengeluaranEksternal: number;
    perubahanKasBersih: number;
    rincianPenerimaan: {
      tagihanPelanggan: number;
      tunaiLapangan: number;
      lainnya: number;
    };
    rincianPengeluaran: {
      setoranSamsat: number;
      operasionalKantor: number;
      operasionalMessenger: number;
      reimbursement: number;
      lainnya: number;
    };
    internalTransferEliminated: {
      messengerToOffice: number;
      officeToMessenger: number;
      total: number;
    };
  };
  periodLabel: string;
  hasTransactions: boolean;
}

export interface CanonicalLabaRugiSummary {
  // Pemasukan & Pendapatan
  totalPemasukan: number;          // Total uang masuk sah (recognized revenue)
  totalBiayaSamsat: number;        // Biaya resmi Samsat yang diakui secara proporsional
  totalPendapatanJasa: number;     // Margin jasa biro = totalPemasukan - totalBiayaSamsat
  grossRevenue: number;            // Total penerimaan kas pelanggan yang sah terverifikasi (eligible + overpayment)
  totalOverpayment: number;        // Total kelebihan bayar pelanggan (Customer Advance / Refund Liability)
  grossProfit: number;             // Laba kotor = totalPendapatanJasa
  netProfit: number;               // Laba bersih = labaRugiBersih
  
  // Beban Usaha & Pengeluaran
  pengeluaranKantor: number;       // Beban operasional kantor (non-void, non-transfer)
  pengeluaranMessenger: number;    // Beban operasional kurir (non-samsat, non-transfer)
  realizedCashback: number;        // Cashback yang telah dicairkan ke konsumen/mitra
  totalBebanOperasional: number;   // pengeluaranKantor + pengeluaranMessenger + realizedCashback
  totalPengeluaran: number;        // totalBebanOperasional + totalBiayaSamsat
  
  // Laba Rugi Bersih
  labaRugiBersih: number;          // totalPendapatanJasa - totalBebanOperasional
  
  // Hitungan Transaksi
  tablePemasukanCount: number;
  tablePengeluaranCount: number;
  
  // Data Tabel Transaksi (untuk fallback/kompatibilitas)
  combinedTableData: LabaRugiTransactionRow[];
  
  // Data Chart Bulanan
  chartData: LabaRugiMonthlyItem[];

  // 3 Indikator Terpending & Karantina (Workstream 4)
  pendingUnpaidBalance: number;    // Belum & Kurang Bayar
  pendingProfit: number;           // Profit Terpending
  pendingCashback: number;         // Cashback Terpending
  quarantinedCount: number;        // Jumlah invoice terkarantina
  quarantinedAmount: number;       // Total tagihan terkarantina
  quarantinedInvoices: any[];      // List objek terkarantina
  anomalyInvoices: any[];          // List transaksi dengan peringatan (e.g. S > T)
  cashFlowReconciliation?: CashFlowReconciliationSummary;
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
 * Checks whether an invoice is quarantined (e.g. INV-1026-080 Rp 5 Miliar anomaly).
 */
export function isQuarantinedInvoice(inv: any): boolean {
  if (!inv) return false;
  const invNo = String(inv.invoice || inv.invoiceNo || inv.invoice_no || "").trim().toUpperCase();
  const ordNo = String(inv.orderNo || inv.order_no || "").trim().toUpperCase();
  const total = Number(inv.totalTagihan ?? inv.total_tagihan ?? 0);
  return invNo === "INV-1026-080" || ordNo === "ORD-1026-080" || total >= 5_000_000_000;
}

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
      const match = lower.match(/(d{1,2})s+([a-z]+)s+(d{4})/);
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
function matchesPeriod(
  d: Date | null,
  period: string,
  referenceDate: Date = new Date(),
  customStart?: string,
  customEnd?: string
): boolean {
  if (!d) return true; // Keep undated items visible in general list
  if (!period || period === "all") return true;

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  if (period === "daily") {
    // Shows transactions in the active month
    return d.getFullYear() === year && d.getMonth() === month;
  }

  if (period === "weekly") {
    // Shows transactions in the active month
    return d.getFullYear() === year && d.getMonth() === month;
  }

  if (period === "monthly") {
    // Shows transactions in the active year
    return d.getFullYear() === year;
  }

  if (period === "yearly") {
    // Shows all years
    return true;
  }

  if (period === "custom" && customStart && customEnd) {
    const s = parseDateFlexible(customStart);
    const e = parseDateFlexible(customEnd);
    if (e) e.setHours(23, 59, 59, 999);
    if (s && d < s) return false;
    if (e && d > e) return false;
    return true;
  }

  return true;
}

/**
 * Authoritative Internal Transfer Detection (Cash Basis & Elimination)
 * Identifies transfers between Kas Kantor and Kas Messenger using structured metadata first,
 * falling back to canonical transaction descriptions and reference IDs.
 */
export function isInternalTransferTransaction(item: any): boolean {
  if (!item) return false;

  // 1. Explicit domain classification if present
  const explicit = item.classification || item.kategoriKlasifikasi || item.transactionClassification;
  if (explicit === "INTERNAL_TRANSFER") return true;

  // 2. Structured category / jenis check (e.g. kategori: "Transfer", jenis: "Transfer")
  const kategori = String(item.kategori || "").trim().toLowerCase();
  const jenis = String(item.jenis || "").trim().toLowerCase();
  if (
    kategori === "transfer" ||
    kategori.includes("transfer") ||
    jenis === "transfer" ||
    jenis.includes("transfer") ||
    jenis.includes("petty cash") ||
    jenis.includes("setoran")
  ) {
    return true;
  }

  // 3. Fallback to canonical and legacy transaction descriptions
  const l = String(item.keterangan || "").toLowerCase();
  return (
    l.includes("[setoran kurir]") ||
    l.includes("[panjar kurir]") ||
    l.includes("[panjar diterima]") ||
    l.includes("[setoran]") ||
    l.includes("trf-m2o") ||
    l.includes("trf-o2m") ||
    l.includes("setoran sisa") ||
    l.includes("setor sisa") ||
    l.includes("sisa kas messenger") ||
    l.includes("setoran kas messenger") ||
    l.includes("transfer ke kantor") ||
    l.includes("setoran ke kantor") ||
    l.includes("top up kas messenger") ||
    l.includes("petty cash kurir") ||
    l.includes("transfer internal") ||
    l.includes("internal_transfer") ||
    l.includes("setoran_messenger") ||
    l.includes("uang jalan") ||
    l.includes("kas operasional / uang jalan") ||
    l.includes("penyerahan kas operasional") ||
    l.includes("penerimaan kas operasional")
  );
}

/**
 * Computes the authoritative canonical Laba Rugi metrics from the Single Source of Truth.
 */
export function computeCanonicalLabaRugi(
  invoices: InvoiceBillingRecord[],
  pengeluaranList: PengeluaranItem[],
  kasMessengerList: KasMessengerItem[],
  periodFilter: string = "monthly",
  fallbackProfitData?: ProfitItem[],
  customStartDate?: string,
  customEndDate?: string,
  kasKantorList?: KasKantorItem[]
): CanonicalLabaRugiSummary {
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
  const quarantinedInvoices: any[] = [];
  let quarantinedCount = 0;
  let quarantinedAmount = 0;
  const anomalyInvoices: any[] = [];

  let pendingUnpaidBalance = 0;
  let pendingProfit = 0;
  let pendingCashback = 0;
  let realizedCashback = 0;
  let totalGrossReceipts = 0;
  let totalOverpayment = 0;

  // 1. Process Inflows & Invoices
  if (Array.isArray(invoices) && invoices.length > 0) {
    invoices.forEach((inv) => {
      // Guard 2: Explicit Quarantine (INV-1026-080 / ORD-1026-080 / >= 5 Miliar)
      if (isQuarantinedInvoice(inv)) {
        quarantinedInvoices.push(inv);
        quarantinedCount++;
        quarantinedAmount += Number(inv.totalTagihan ?? (inv as any).total_tagihan ?? 0);
        return; // strictly excluded from P&L calculations
      }

      // Guard 1: Non-Cancelled & Non-Void
      if (
        inv.status === "CANCELLED" ||
        inv.billingStatus === "CANCELLED" ||
        Boolean((inv as any).isCancelled) ||
        (inv as any).is_void === 1
      ) {
        return;
      }

      const totalTagihan = Number(inv.totalTagihan ?? (inv as any).total_tagihan ?? 0);

      // Calculate NetCustomerReceipts (Canonical Contract A: Only status_verifikasi = TERVERIFIKASI & is_void = 0)
      let grossReceipts = 0;
      if (Array.isArray((inv as any).payoutHistory) && (inv as any).payoutHistory.length > 0) {
        grossReceipts = (inv as any).payoutHistory
          .filter((p: any) => !p.is_void && (p.statusVerifikasi === "TERVERIFIKASI" || p.status_verifikasi === "TERVERIFIKASI"))
          .reduce((sum: number, p: any) => sum + Number(p.nominal || p.amount || 0), 0);
      } else {
        grossReceipts = Number(inv.terbayar ?? inv.dibayar ?? 0);
      }

      const refundedAmount = Number(
        (inv as any).refundedAmount ??
        (inv.refundStatus === "PROCESSED" ? ((inv as any).overpayment || 0) : 0)
      );
      const netCustomerReceipts = Math.max(0, grossReceipts - refundedAmount);
      const eligiblePayment = Math.min(netCustomerReceipts, totalTagihan);
      const overpayment = Math.max(0, netCustomerReceipts - totalTagihan);

      totalGrossReceipts += netCustomerReceipts;
      totalOverpayment += overpayment;

      // Pending unpaid balance
      const sisa = Math.max(0, totalTagihan - eligiblePayment);
      if (sisa > 0) {
        pendingUnpaidBalance += sisa;
      }

      // Track Cashback
      const cashbackNominal = Number(inv.cashback ?? (inv as any).cashback_nominal ?? 0);
      if (cashbackNominal > 0) {
        const cbStatus = String(inv.cashbackStatus ?? (inv as any).cashback_status ?? "PENDING").toUpperCase();
        if (cbStatus === "PENDING") {
          pendingCashback += cashbackNominal;
        } else if (cbStatus === "PAID" || cbStatus === "PROCESSED") {
          realizedCashback += cashbackNominal;
        }
      }

      const rawBiayaSamsat = Number(inv.biayaSamsat ?? (inv as any).biaya_samsat ?? 0);
      const isExplicitZero = Boolean(
        inv.isExplicitZero ||
        (inv as any).is_explicit_zero ||
        (inv as any).isZeroCostPromotion ||
        (rawBiayaSamsat === 0 && inv.costClassification === "EXPLICIT_ZERO")
      );

      const costVerificationStatus = String(
        inv.costVerificationStatus || (inv as any).cost_verification_status || "VERIFIED"
      );
      const costClassification = inv.costClassification || (
        costVerificationStatus === "VERIFIED"
          ? (rawBiayaSamsat === 0 && isExplicitZero ? "EXPLICIT_ZERO" : "ACTUAL_COST")
          : (rawBiayaSamsat === 0 && !isExplicitZero
              ? "UNCONFIGURED"
              : (rawBiayaSamsat === 0 && isExplicitZero ? "EXPLICIT_ZERO" : "ESTIMATED_COST"))
      );

      const dateStr = inv.tanggalBayar || inv.tanggal || (inv as any).tanggalInvoice || (inv as any).createdAt || "";
      const dateObj = parseDateFlexible(dateStr);

      // Guard 5: S > T (Discrepancy Warning)
      if (rawBiayaSamsat > totalTagihan && totalTagihan > 0) {
        anomalyInvoices.push({
          invoiceNo: inv.invoice || inv.invoiceNo || `INV-${inv.id}`,
          orderNo: inv.orderNo || "-",
          customer: inv.customer || "Customer",
          totalTagihan,
          biayaSamsat: rawBiayaSamsat,
          anomalyReason: `Biaya Samsat (Rp ${rawBiayaSamsat.toLocaleString("id-ID")}) melebihi Total Tagihan (Rp ${totalTagihan.toLocaleString("id-ID")})`,
        });
        pendingProfit += Math.max(0, totalTagihan - rawBiayaSamsat);
        return; // Guard 5 holds transaction in Customer Advance / Anomaly
      }

      // Guard 6: Unconfigured or Estimated Samsat cost (Holding in Customer Advance)
      if (
        costClassification === "UNCONFIGURED" ||
        costClassification === "ESTIMATED_COST" ||
        costVerificationStatus === "PENDING_VERIFICATION"
      ) {
        pendingProfit += Math.max(0, totalTagihan - rawBiayaSamsat);
        return; // Hold in Customer Advance; recognizedRevenue = 0, Matched COGS = 0
      }

      // Guard 8: Explicit Zero (Pure Service without Samsat fee)
      if (isExplicitZero) {
        const recognizedRevenue = eligiblePayment;
        const matchedCOGS = 0;
        const profit = recognizedRevenue;

        if (recognizedRevenue > 0) {
          normalizedInflows.push({
            tanggal: inv.tanggal || (inv as any).tanggalInvoice || (dateObj ? dateObj.toLocaleDateString("id-ID") : "-"),
            customer: inv.customer || "Customer",
            nopol: inv.nopol || "-",
            pengurusan: inv.jenisLayanan || inv.layanan || "Layanan Jasa Murni",
            invoice: inv.invoice || inv.invoiceNo || `INV-${inv.id}`,
            uangMasuk: recognizedRevenue,
            biayaSamsat: matchedCOGS,
            profit,
            dateObj,
          });
        }
        return;
      }

      // Guard 9: Verified Samsat Service with Proportional Cost Matching
      if (totalTagihan > 0 && rawBiayaSamsat <= totalTagihan) {
        const alpha = rawBiayaSamsat / totalTagihan;
        const matchedCOGS = Math.min(rawBiayaSamsat, Math.round(alpha * eligiblePayment));
        const recognizedRevenue = eligiblePayment;
        const profit = Math.max(0, recognizedRevenue - matchedCOGS);

        if (recognizedRevenue > 0 || matchedCOGS > 0) {
          normalizedInflows.push({
            tanggal: inv.tanggal || (inv as any).tanggalInvoice || (dateObj ? dateObj.toLocaleDateString("id-ID") : "-"),
            customer: inv.customer || "Customer",
            nopol: inv.nopol || "-",
            pengurusan: inv.jenisLayanan || inv.layanan || "Layanan Samsat",
            invoice: inv.invoice || inv.invoiceNo || `INV-${inv.id}`,
            uangMasuk: recognizedRevenue,
            biayaSamsat: matchedCOGS,
            profit,
            dateObj,
          });
        }
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

  // 2. Helper to filter out Pass-Through and Internal Transfers
  const isExcludedFromOperationalExpense = (item: any): boolean => {
    if (isInternalTransferTransaction(item)) return true;
    const classification = classifyFinancialTransaction(item);
    return classification === "SAMSAT_PASS_THROUGH" || classification === "INTERNAL_TRANSFER";
  };

  // 3. Prepare office expense items (excluding voided, non-operational, internal transfers, and Samsat pass-through)
  // When kasKantorList is provided, it serves as the authoritative office cash ledger (including paid courier reimbursements)
  const normalizedKantor: { tanggal: string; keterangan: string; invoice: string; nominal: number; dateObj: Date | null }[] = [];

  // Track voided transaction references (e.g. "[VOID/BATAL] Reversal ... [Ref: REIMB-001]")
  const voidedRefIds = new Set<string>();
  if (Array.isArray(kasKantorList) && kasKantorList.length > 0) {
    kasKantorList.forEach((item) => {
      const ket = String(item.keterangan || "");
      if (ket.includes("[VOID") || ket.includes("[BATAL")) {
        const match = ket.match(/\[Ref:\s*([^\]]+)\]/);
        if (match) voidedRefIds.add(match[1].trim());
      }
    });
  }

  if (Array.isArray(kasKantorList) && kasKantorList.some((k) => (k.status === "Kredit" || Number(k.kredit || 0) > 0))) {
    kasKantorList.forEach((item) => {
      const isKredit = item.status === "Kredit" || Number(item.kredit || 0) > 0;
      if (!isKredit) return;
      const nominal = Number(item.kredit || 0);
      if (nominal <= 0) return;

      // Filter voided entries
      if (
        (item as any).is_void ||
        item.status === "VOIDED" ||
        String(item.keterangan || "").startsWith("[VOID]") ||
        String(item.keterangan || "").startsWith("[BATAL/VOID]")
      ) {
        return;
      }

      // Filter if matching a voided reference
      const refMatch = String(item.keterangan || "").match(/\[Ref:\s*([^\]]+)\]/);
      if (refMatch && voidedRefIds.has(refMatch[1].trim())) {
        return;
      }

      // Filter non-operational expenses (Internal Transfer & Samsat Pass-Through)
      if (isExcludedFromOperationalExpense(item)) {
        return;
      }

      normalizedKantor.push({
        tanggal: item.tanggal,
        keterangan: item.keterangan || "Pengeluaran Kantor (Kas Kantor)",
        invoice: (item as any).invoiceNo || (item as any).orderNo || "-",
        nominal,
        dateObj: parseDateFlexible(item.tanggal),
      });
    });

    // Also include any standalone pengeluaranList items that are not already present in kasKantorList
    if (Array.isArray(pengeluaranList) && pengeluaranList.length > 0) {
      pengeluaranList.forEach((p) => {
        if ((p as any).is_void || (p as any).status === "VOIDED" || String(p.keterangan || "").startsWith("[VOID]")) {
          return;
        }
        if (isExcludedFromOperationalExpense(p)) {
          return;
        }
        const alreadyInKas = kasKantorList.some(
          (k) =>
            Number(k.kredit || 0) === Number(p.nominal || 0) &&
            ((k as any).invoiceNo && (k as any).invoiceNo === (p as any).invoiceNo)
        );
        if (!alreadyInKas) {
          normalizedKantor.push({
            tanggal: p.tanggal,
            keterangan: p.keterangan || "Pengeluaran Kantor",
            invoice: (p as any).invoiceNo || "-",
            nominal: Number(p.nominal || 0),
            dateObj: parseDateFlexible(p.tanggal),
          });
        }
      });
    }
  } else {
    // Fallback to pengeluaranList when kasKantorList is not provided or empty (preserves full backward compatibility)
    (pengeluaranList || []).forEach((item) => {
      if ((item as any).is_void || (item as any).status === "VOIDED" || String(item.keterangan || "").startsWith("[VOID]")) {
        return;
      }
      if (isExcludedFromOperationalExpense(item)) {
        return;
      }
      normalizedKantor.push({
        tanggal: item.tanggal,
        keterangan: item.keterangan || "Pengeluaran Kantor",
        invoice: (item as any).invoiceNo || "-",
        nominal: Number(item.nominal || 0),
        dateObj: parseDateFlexible(item.tanggal),
      });
    });
  }

  // 4. Prepare messenger expense items (excluding voided, pass-through Samsat, and internal transfers)
  const normalizedMessenger = (kasMessengerList || [])
    .filter((item) => {
      const outVal = Number(item.out || (item as any).kredit || 0);
      if (outVal <= 0) return false;
      if (String(item.keterangan || "").startsWith("[VOID]")) return false;
      return !isExcludedFromOperationalExpense(item);
    })
    .map((item) => ({
      tanggal: item.tanggal,
      jenis: item.jenis || "Operasional",
      messenger: item.messenger || "Messenger",
      keterangan: item.keterangan || "Operasional Messenger",
      nominal: Number(item.out || (item as any).kredit || 0),
      dateObj: parseDateFlexible(item.tanggal),
    }));

  // 5. Build transaction items for Table fallback / parity
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
        keterangan: `${item.pengurusan} - ${item.nopol} (Biaya Resmi Samsat Proporsional)`,
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

  const allTableRows: LabaRugiTransactionRow[] = [
    ...tablePemasukan,
    ...tablePengeluaranKantor,
    ...tablePengeluaranMessenger,
    ...tableBiayaSamsat,
  ];

  // 6. Apply Period Filtering
  const filteredRows = allTableRows.filter((r) => matchesPeriod(r.dateObj, periodFilter, new Date(), customStartDate, customEndDate));

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

  const totalBebanOperasional = pengeluaranKantor + pengeluaranMessenger + realizedCashback;
  const totalPengeluaran = totalBebanOperasional + totalBiayaSamsat;
  const totalPendapatanJasa = Math.max(0, totalPemasukan - totalBiayaSamsat);
  const labaRugiBersih = totalPendapatanJasa - totalBebanOperasional;

  const tablePemasukanCount = filteredRows.filter((r) => r.type === "in").length;
  const tablePengeluaranCount = filteredRows.filter((r) => r.type === "out").length;

  // 7. Dynamic Granular Period Chart Aggregation (Harian, Mingguan, Bulanan, Tahunan, Custom)
  const chartData: LabaRugiMonthlyItem[] = [];

  if (periodFilter === "daily" || (periodFilter === "custom" && customStartDate && customEndDate)) {
    // Harian / Custom: Group by Date (DD/MM)
    const dailyMap = new Map<string, { label: string; pendapatan: number; pengeluaran: number; date: Date }>();
    
    // Aggregate strictly from filteredRows (within active period)
    filteredRows.forEach((r) => {
      const d = r.dateObj || new Date();
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${d.getFullYear()}-${month}-${day}`;
      const label = `${day}/${month}`;

      if (!dailyMap.has(key)) {
        dailyMap.set(key, { label, pendapatan: 0, pengeluaran: 0, date: d });
      }
      const b = dailyMap.get(key)!;
      if (r.type === "in") b.pendapatan += r.nominal;
      else b.pengeluaran += r.nominal;
    });

    // Sort chronologically
    const sortedDaily = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (sortedDaily.length > 0) {
      sortedDaily.forEach(([_, b]) => {
        chartData.push({
          bulan: b.label,
          pendapatan: b.pendapatan,
          pengeluaran: b.pengeluaran,
          laba: b.pendapatan - b.pengeluaran,
        });
      });
    } else {
      // Empty placeholder for selected month
      const now = new Date();
      chartData.push({
        bulan: `01/${String(now.getMonth() + 1).padStart(2, "0")}`,
        pendapatan: 0,
        pengeluaran: 0,
        laba: 0,
      });
    }
  } else if (periodFilter === "weekly") {
    // Mingguan: Group by Week of Month (Mgg 1 .. Mgg 5)
    const weeklyBuckets: { [w: string]: { label: string; pendapatan: number; pengeluaran: number } } = {
      w1: { label: "Mgg 1", pendapatan: 0, pengeluaran: 0 },
      w2: { label: "Mgg 2", pendapatan: 0, pengeluaran: 0 },
      w3: { label: "Mgg 3", pendapatan: 0, pengeluaran: 0 },
      w4: { label: "Mgg 4", pendapatan: 0, pengeluaran: 0 },
      w5: { label: "Mgg 5", pendapatan: 0, pengeluaran: 0 },
    };

    filteredRows.forEach((r) => {
      const d = r.dateObj || new Date();
      const dateNum = d.getDate();
      let wKey = "w1";
      if (dateNum > 28) wKey = "w5";
      else if (dateNum > 21) wKey = "w4";
      else if (dateNum > 14) wKey = "w3";
      else if (dateNum > 7) wKey = "w2";

      if (r.type === "in") weeklyBuckets[wKey].pendapatan += r.nominal;
      else weeklyBuckets[wKey].pengeluaran += r.nominal;
    });

    Object.values(weeklyBuckets).forEach((b) => {
      chartData.push({
        bulan: b.label,
        pendapatan: b.pendapatan,
        pengeluaran: b.pengeluaran,
        laba: b.pendapatan - b.pengeluaran,
      });
    });
  } else if (periodFilter === "yearly") {
    // Tahunan: Group by Year (e.g. 2024, 2025, 2026)
    const yearlyMap = new Map<number, { pendapatan: number; pengeluaran: number }>();
    allTableRows.forEach((r) => {
      const yr = r.dateObj ? r.dateObj.getFullYear() : new Date().getFullYear();
      if (!yearlyMap.has(yr)) {
        yearlyMap.set(yr, { pendapatan: 0, pengeluaran: 0 });
      }
      const b = yearlyMap.get(yr)!;
      if (r.type === "in") b.pendapatan += r.nominal;
      else b.pengeluaran += r.nominal;
    });

    const sortedYears = Array.from(yearlyMap.keys()).sort((a, b) => a - b);
    if (sortedYears.length > 0) {
      sortedYears.forEach((yr) => {
        const b = yearlyMap.get(yr)!;
        chartData.push({
          bulan: String(yr),
          pendapatan: b.pendapatan,
          pengeluaran: b.pengeluaran,
          laba: b.pendapatan - b.pengeluaran,
        });
      });
    } else {
      chartData.push({
        bulan: String(new Date().getFullYear()),
        pendapatan: 0,
        pengeluaran: 0,
        laba: 0,
      });
    }
  } else {
    // Bulanan / All: Group by Month (Jan .. Des)
    const monthlyBuckets: { [monthIdx: number]: { pendapatan: number; pengeluaran: number } } = {};
    for (let m = 0; m < 12; m++) {
      monthlyBuckets[m] = { pendapatan: 0, pengeluaran: 0 };
    }

    filteredRows.forEach((r) => {
      const d = r.dateObj;
      const mIdx = d ? d.getMonth() : 0;
      if (r.type === "in") {
        monthlyBuckets[mIdx].pendapatan += r.nominal;
      } else {
        monthlyBuckets[mIdx].pengeluaran += r.nominal;
      }
    });

    const hasDataSecondHalf = Object.keys(monthlyBuckets)
      .slice(6)
      .some((idx) => monthlyBuckets[Number(idx)].pendapatan > 0 || monthlyBuckets[Number(idx)].pengeluaran > 0);

    const monthCount = hasDataSecondHalf ? 12 : 6;
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
  }

  return {
    totalPemasukan,
    totalBiayaSamsat,
    totalPendapatanJasa,
    grossRevenue: totalGrossReceipts,
    totalOverpayment,
    grossProfit: totalPendapatanJasa,
    netProfit: labaRugiBersih,
    pengeluaranKantor,
    pengeluaranMessenger,
    realizedCashback,
    totalBebanOperasional,
    totalPengeluaran,
    labaRugiBersih,
    tablePemasukanCount,
    tablePengeluaranCount,
    combinedTableData: filteredRows,
    chartData,
    pendingUnpaidBalance,
    pendingProfit,
    pendingCashback,
    quarantinedCount,
    quarantinedAmount,
    quarantinedInvoices,
    anomalyInvoices,
    cashFlowReconciliation: computeCashFlowReconciliation(kasKantorList, kasMessengerList, periodFilter, customStartDate, customEndDate),
  };
}


/**
 * Authoritative Cash Flow Reconciliation Engine (Cash Basis)
 * Integrates Kas Kantor and Kas Messenger ledgers with strict elimination of internal transfers.
 */
export function computeCashFlowReconciliation(
  kasKantorList: KasKantorItem[] = [],
  kasMessengerList: KasMessengerItem[] = [],
  periodFilter: string = "monthly",
  customStartDate?: string,
  customEndDate?: string,
  referenceDate: Date = new Date()
): CashFlowReconciliationSummary {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let periodLabel = "Semua Periode";

  if (periodFilter === "daily") {
    // Current month days or today
    startDate = new Date(refYear, refMonth, 1, 0, 0, 0, 0);
    endDate = new Date(refYear, refMonth + 1, 0, 23, 59, 59, 999);
    periodLabel = `Harian (${INDONESIAN_MONTH_NAMES_FULL[refMonth]} ${refYear})`;
  } else if (periodFilter === "weekly") {
    startDate = new Date(refYear, refMonth, 1, 0, 0, 0, 0);
    endDate = new Date(refYear, refMonth + 1, 0, 23, 59, 59, 999);
    periodLabel = `Mingguan (${INDONESIAN_MONTH_NAMES_FULL[refMonth]} ${refYear})`;
  } else if (periodFilter === "monthly") {
    startDate = new Date(refYear, 0, 1, 0, 0, 0, 0);
    endDate = new Date(refYear, 11, 31, 23, 59, 59, 999);
    periodLabel = `Bulanan (Tahun ${refYear})`;
  } else if (periodFilter === "yearly") {
    startDate = null;
    endDate = null;
    periodLabel = "Tahunan (Semua Tahun)";
  } else if (periodFilter === "custom" && customStartDate && customEndDate) {
    startDate = parseDateFlexible(customStartDate);
    endDate = parseDateFlexible(customEndDate);
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }
    periodLabel = `${customStartDate} s/d ${customEndDate}`;
  }

  // Helper to check if date falls in period
  const isInPeriod = (d: Date | null): boolean => {
    if (!d) return true;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  const isBeforePeriod = (d: Date | null): boolean => {
    if (!d || !startDate) return false;
    return d < startDate;
  };

  // Backward compatibility helper pointing to canonical detection
  const isTransferDesc = (desc: string): boolean => isInternalTransferTransaction({ keterangan: desc });

  const isSamsatDesc = (desc: string, jenis?: string): boolean => {
    const l = `${desc || ""} ${jenis || ""}`.toLowerCase();
    return (
      l.includes("samsat") ||
      l.includes("biaya samsat") ||
      l.includes("bayar di samsat") ||
      l.includes("pajak tahunan") ||
      l.includes("pajak 5 tahunan") ||
      l.includes("mutasi ld") ||
      l.includes("mutasi as") ||
      l.includes("balik nama") ||
      l.includes("bbn")
    );
  };

  const isReimbDesc = (desc: string): boolean => {
    const l = (desc || "").toLowerCase();
    return l.includes("reimburse") || l.includes("reimbursement");
  };

  // 1. Kas Kantor
  let kantorSaldoAwal = 0;
  let kantorTotalDebit = 0;
  let kantorTotalKredit = 0;
  let kantorTxCount = 0;

  let extInflowKantor = 0;
  let internalMessengerToOffice = 0;
  let internalOfficeToMessenger = 0;
  let samsatOutflowKantor = 0;
  let reimbOutflowKantor = 0;
  let opexOutflowKantor = 0;

  for (const item of kasKantorList) {
    const d = parseDateFlexible(item.tanggal);
    const debit = Number(item.debit || 0);
    const kredit = Number(item.kredit || 0);

    if (isBeforePeriod(d)) {
      kantorSaldoAwal += (debit - kredit);
    } else if (isInPeriod(d)) {
      kantorTotalDebit += debit;
      kantorTotalKredit += kredit;
      kantorTxCount++;

      // Check external vs internal
      if (debit > 0) {
        if (isInternalTransferTransaction(item)) {
          internalMessengerToOffice += debit;
        } else {
          extInflowKantor += debit;
        }
      }

      if (kredit > 0) {
        if (isInternalTransferTransaction(item)) {
          internalOfficeToMessenger += kredit;
        } else if (isSamsatDesc(item.keterangan, (item as any).jenis || (item as any).kategori)) {
          samsatOutflowKantor += kredit;
        } else if (isReimbDesc(item.keterangan)) {
          reimbOutflowKantor += kredit;
        } else {
          opexOutflowKantor += kredit;
        }
      }
    }
  }

  const kantorSaldoAkhir = kantorSaldoAwal + kantorTotalDebit - kantorTotalKredit;

  // 2. Kas Messenger
  let msgrSaldoAwal = 0;
  let msgrTotalMasuk = 0;
  let msgrTotalKeluar = 0;
  let msgrTxCount = 0;

  const perMessenger: Record<string, MessengerCashFlowItem> = {};
  let extInflowMessenger = 0;
  let samsatOutflowMessenger = 0;
  let opexOutflowMessenger = 0;

  for (const item of kasMessengerList) {
    const d = parseDateFlexible(item.tanggal);
    const masuk = Number(item.in ?? (item as any).masuk ?? (item as any).debit ?? 0);
    const keluar = Number(item.out ?? (item as any).keluar ?? (item as any).kredit ?? 0);
    const mName = item.messenger || (item as any).messenger_id || "Kurir Lapangan";
    const mId = (item as any).messenger_id || item.messenger;

    if (!perMessenger[mName]) {
      perMessenger[mName] = {
        messenger: mName,
        messengerId: mId,
        saldoAwal: 0,
        totalMasuk: 0,
        totalKeluar: 0,
        saldoAkhir: 0,
        transactionCount: 0,
      };
    }

    if (isBeforePeriod(d)) {
      msgrSaldoAwal += (masuk - keluar);
      perMessenger[mName].saldoAwal += (masuk - keluar);
    } else if (isInPeriod(d)) {
      msgrTotalMasuk += masuk;
      msgrTotalKeluar += keluar;
      msgrTxCount++;

      perMessenger[mName].totalMasuk += masuk;
      perMessenger[mName].totalKeluar += keluar;
      perMessenger[mName].transactionCount++;

      if (masuk > 0) {
        if (isInternalTransferTransaction(item) || (item.jenis && item.jenis.toUpperCase().includes("PETTY CASH"))) {
          // Top up from office - already counted in internal transfers
        } else {
          extInflowMessenger += masuk;
        }
      }

      if (keluar > 0) {
        if (isInternalTransferTransaction(item) || (item.jenis && item.jenis.toUpperCase().includes("SETORAN"))) {
          // Setoran to office - already counted in internal transfers
        } else if (isSamsatDesc(item.keterangan, item.jenis)) {
          samsatOutflowMessenger += keluar;
        } else {
          opexOutflowMessenger += keluar;
        }
      }
    }
  }

  const msgrSaldoAkhir = msgrSaldoAwal + msgrTotalMasuk - msgrTotalKeluar;
  for (const k in perMessenger) {
    perMessenger[k].saldoAkhir = perMessenger[k].saldoAwal + perMessenger[k].totalMasuk - perMessenger[k].totalKeluar;
  }

  // 3. Rekapitulasi Gabungan Eksternal (Strict Internal Elimination)
  const totalPenerimaanEksternal = extInflowKantor + extInflowMessenger;
  const totalSamsat = samsatOutflowKantor + samsatOutflowMessenger;
  const totalPengeluaranEksternal = totalSamsat + opexOutflowKantor + opexOutflowMessenger + reimbOutflowKantor;
  const perubahanKasBersih = totalPenerimaanEksternal - totalPengeluaranEksternal;

  const totalInternalEliminated = internalMessengerToOffice + internalOfficeToMessenger;

  return {
    kasKantor: {
      saldoAwal: kantorSaldoAwal,
      totalMasuk: kantorTotalDebit,
      totalKeluar: kantorTotalKredit,
      saldoAkhir: kantorSaldoAkhir,
      transactionCount: kantorTxCount,
    },
    kasMessenger: {
      saldoAwal: msgrSaldoAwal,
      totalMasuk: msgrTotalMasuk,
      totalKeluar: msgrTotalKeluar,
      saldoAkhir: msgrSaldoAkhir,
      transactionCount: msgrTxCount,
      perMessenger,
    },
    rekapitulasiGabungan: {
      totalPenerimaanEksternal,
      totalPengeluaranEksternal,
      perubahanKasBersih,
      rincianPenerimaan: {
        tagihanPelanggan: extInflowKantor,
        tunaiLapangan: extInflowMessenger,
        lainnya: 0,
      },
      rincianPengeluaran: {
        setoranSamsat: totalSamsat,
        operasionalKantor: opexOutflowKantor,
        operasionalMessenger: opexOutflowMessenger,
        reimbursement: reimbOutflowKantor,
        lainnya: 0,
      },
      internalTransferEliminated: {
        messengerToOffice: internalMessengerToOffice,
        officeToMessenger: internalOfficeToMessenger,
        total: totalInternalEliminated,
      },
    },
    periodLabel,
    hasTransactions: (kantorTxCount + msgrTxCount) > 0,
  };
}
