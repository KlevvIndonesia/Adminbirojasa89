/**
 * Canonical Domain Types for Finance, Invoicing, and Accounting
 * Admin SUN89 — Biro Jasa Management System
 */

import { SettlementCondition, RefundStatus } from "../order/types";
export type { RefundStatus };

export type PaymentStatus = "Belum Bayar" | "Kurang Bayar" | "Lunas" | "Kelebihan Bayar" | "Belum Lunas" | "Kurang" | "CANCELLED" | "BATAL" | "Dibatalkan" | "PAID" | "UNPAID" | "OVERPAID" | "PARTIAL";
export type RealizationStatus = "PENDING" | "REALIZED";
export type BillingLifecycleStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "ARCHIVED" | "DRAFT" | "ISSUED" | "PAID" | "OVERPAID" | "UNPAID";

export type PaymentDueTrigger = "IMMEDIATE" | "AFTER_DOCUMENT_RECEIVED";
export type CollectionState = "BELUM_JATUH_TEMPO" | "JATUH_TEMPO" | "LUNAS";

export interface PaymentSyncPayload {
  orderNo: string;
  statusPembayaran: PaymentStatus | "Lunas" | "Belum Bayar" | "Kurang Bayar" | "Kelebihan Bayar" | "Belum Lunas" | "Kurang" | string;
  dibayar: number;
  kurang: number;
  totalBiaya: number;
  tanggalBayar?: string;
  metodePembayaran?: string;
  settlementCondition?: SettlementCondition;
  refundStatus?: RefundStatus;
  overpayment?: number;
}

export type PaymentSyncCallback = (payload: PaymentSyncPayload) => void;

export interface InvoiceBillingRecord {
  id: number;
  tanggal: string;
  customer: string;
  nopol: string;
  jenisLayanan: string;
  layanan?: string;
  totalTagihan: number;
  terbayar: number;
  dibayar?: number;
  sisa: number;
  status: PaymentStatus;
  billingStatus?: BillingLifecycleStatus; // "ACTIVE" for active tagihan, "COMPLETED" when finalized
  completedAt?: string;
  completedBy?: string;
  jatuhTempo: string;
  invoice: string;
  invoiceNo?: string;
  invoice_no?: string;
  biayaJasa?: number;
  biayaAntarJemput?: number;
  biaya_antar_jemput?: number;
  pendapatanJasa?: number;
  namaPenerimaKeluar?: string;
  bankUangKeluar?: string;
  metodePembayaranKeluar?: string;
  orderNo?: string;
  namaBerkas?: string;
  samsat?: string;
  r4r2?: "R4" | "R2";
  tandaTerima?: string;
  bpkb?: string;
  ttbBPKB?: string;

  // Customer Contact Details
  phone?: string;
  email?: string;
  alamat?: string;

  // Realization Tracking
  biayaSamsat: number;
  profit: number;
  profitStatus: RealizationStatus;
  cashback: number;
  cashbackPersen?: string | number;
  cashbackStatus: RealizationStatus;

  // Cash Realization into Kas Kantor (Guarantees no duplicate cash inflow)
  isCashRealized: boolean;
  cashRecordedAmount: number; // Cumulative amount already debited to Kas Kantor
  tanggalBayar?: string;
  metodePembayaran?: string;
  bank?: string;
  alasanPending?: string;
  alasan?: string;
  keterangan?: string;

  // Final Cost Reconciliation & Collection Status
  dueTrigger?: PaymentDueTrigger;
  collectionStatus?: CollectionState;
  settlementCondition?: SettlementCondition;
  refundStatus?: RefundStatus;
  overpayment?: number;

  // Supervision & Gating Metadata
  isPaymentGated?: boolean;
  hasFinalCost?: boolean;
  isSupervisiApproved?: boolean;
  paymentGatingReason?: string;
  kekurangan?: number;
  pengurusan?: string;
  spvApprovedAt?: string;
  spvName?: string;
  alasan_pending?: string;
  serviceId?: string;
  service_id?: string;
  total_tagihan?: number;
  biaya_jasa?: number;
  biaya_samsat?: number;
  pendapatan_jasa?: number;
  isCancelled?: boolean;
  cancellationReason?: string;
  costVerificationStatus?: "PENDING_VERIFICATION" | "VERIFIED" | string;
  isDraftEstimate?: boolean;
  isCostVerified?: boolean;

  // Payout and Refund Tracking (Phase B2.2)
  payoutHistory?: PayoutTransactionRecord[];
  payoutVersion?: number;
  riwayatPembayaran?: any[];
  refundLiability?: number;
  refundedAmount?: number;
  remainingRefund?: number;
  cashbackPaidAmount?: number;
  costClassification?: CostClassificationType;
  isExplicitZero?: boolean;
}

export type CanonicalSalesCategory =
  | "perpanjangan-1-tahun"
  | "perpanjangan-5-tahun"
  | "mutasi-asal"
  | "mutasi-antar-daerah"
  | "balik-nama"
  | "tarik-berkas"
  | "duplikat-stnk"
  | "lainnya";

export type PenjualanContractCategory =
  | CanonicalSalesCategory
  | "mutasi-ld"
  | "mutasi-as"
  | "bbn"
  | "perpanjangan-pajak"
  | "lain-lain"
  | "belum-kurang-bayar"
  | "profit-terpending"
  | "cashback-terpending";

export interface ProfitItem {
  id: number;
  tanggal: string;
  nopol: string;
  customer: string;
  namaBerkas: string;
  pengurusan: string;
  uangMasuk: number;
  biayaSamsat: number;
  profit: number;
  rekening: string;
  invoice: string;
  tanggalTTB: string;
  ttb: string;
  jemputDokumen?: string;
  prosesSamsat?: string;
  pengantaranKembali?: string;
  metodePembayaran?: string;
  // 4 Structured disbursement fields (Decision 4)
  metodePencairan?: "Cash" | "Transfer Bank" | string;
  namaBank?: string;
  nomorRekening?: string;
  namaPemilikRekening?: string;
  bank?: string;
  namaRekening?: string;
  noRekening?: string;
  tanggalBayar?: string;
  tanggalUangMasuk?: string;
  status?: string;
  eligiblePayment?: number;
  overpayment?: number;
  grossProfit?: number;
  pendapatanJasa?: number;
  labaKotor?: number;
  matchedCOGS?: number;
  isExplicitZero?: boolean;
  costClassification?: string;
  isFinancialAnomaly?: boolean;
  anomalyReason?: string;
  holdStatus?: string;
  grossServiceMargin?: number;
  netTransactionMargin?: number;
  isGrossDeficit?: boolean;
  isNetDeficit?: boolean;
  biayaAntarJemput?: number;
  cashback?: number;
}

export interface KasMessengerItem {
  id: number;
  tanggal: string;
  jenis: string;
  messenger: string;
  keterangan: string;
  in: number;
  out: number;
  total: number;
  penanggungJawab?: string;
  orderNo?: string;
  reimbursementId?: string;
  receiptUrl?: string;
  kategori?: string;
  classification?: FinancialTransactionClassification;
}

export interface KasKantorItem {
  id: number;
  tanggal: string;
  status: string;
  keterangan: string;
  debit: number;
  kredit: number;
  total: number;
  tipe?: string;
  saldo?: number;
  masuk?: number;
  keluar?: number;
  metode?: string;
  bank?: string;
  kategori?: string;
  classification?: FinancialTransactionClassification;
  invoiceRef?: string;
  penanggungJawab?: string;
}

export interface PengeluaranItem {
  id: number;
  tanggal: string;
  keterangan: string;
  nominal: number;
  penanggungJawab?: string;
  kategori?: string;
  orderNo?: string;
  invoiceNo?: string;
}

export interface LabaRugiMonthlyItem {
  bulan: string;
  pendapatan: number;
  pengeluaran: number;
  laba: number;
}

export interface BelumKurangBayarItem {
  id: number;
  tanggal: string;
  nopol: string;
  customer: string;
  namaBerkas: string;
  pengurusan: string;
  uangMasuk: number;
  biayaSamsat: number;
  profit: number;
  status: string;
  invoice: string;
  sisaPembayaran: number;
  jatuhTempo: string;
}

export function derivePaymentStatus(totalTagihan: number, terbayar: number): PaymentStatus {
  if (terbayar <= 0) return "Belum Bayar";
  if (terbayar < totalTagihan) return "Kurang Bayar";
  if (terbayar > totalTagihan) return "Kelebihan Bayar";
  return "Lunas";
}

export type CostClassificationType = "ACTUAL_COST" | "ESTIMATED_COST" | "UNCONFIGURED" | "EXPLICIT_ZERO" | "DEFINITIVE" | "ESTIMATED";

export function classifyCost(
  value: number | undefined | null,
  status?: {
    isVerified?: boolean;
    isUnconfigured?: boolean;
    isExplicitZero?: boolean;
    classification?: CostClassificationType;
  }
): CostClassificationType {
  if (status?.classification) return status.classification;
  if (status?.isExplicitZero) return "EXPLICIT_ZERO";
  if (status?.isUnconfigured || value === undefined || value === null) return "UNCONFIGURED";
  if (value === 0 && !status?.isExplicitZero && !status?.isVerified) {
    return "UNCONFIGURED";
  }
  if (status?.isVerified) return "ACTUAL_COST";
  return "ESTIMATED_COST";
}

export type PayoutType = "KELEBIHAN" | "KOMISI" | "ALL";
export type PayoutTransactionStatus = "PROCESSED" | "VOIDED";

export interface PayoutTransactionRecord {
  id: string; // Unique payout identifier, e.g. "payout-1698712345-abcde"
  invoiceId: number;
  invoiceNo: string;
  orderNo?: string;
  payoutType: "KELEBIHAN" | "KOMISI";
  nominal: number;
  tanggal: string;
  metode: string; // "Tunai" | "Transfer Bank"
  penerima: string;
  status: PayoutTransactionStatus;
  kasKantorId?: number;
  voidKasKantorId?: number;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  processedAt: string;
  processedBy: string;
  proofUrl?: string | any;
  bank?: string;
  noRekening?: string;
  namaRekening?: string;
  idempotencyKey?: string;
}

export type FinancialTransactionClassification =
  | "SAMSAT_PASS_THROUGH"
  | "MESSENGER_OPERATIONAL"
  | "OFFICE_OPERATIONAL"
  | "PARTNER_COMMISSION"
  | "INTERNAL_TRANSFER";

export function classifyFinancialTransaction(item: any): FinancialTransactionClassification {
  if (!item) return "MESSENGER_OPERATIONAL";

  // 1. Explicit metadata priority
  const explicit = item.classification || item.kategoriKlasifikasi || item.transactionClassification;
  if (
    explicit === "SAMSAT_PASS_THROUGH" ||
    explicit === "MESSENGER_OPERATIONAL" ||
    explicit === "OFFICE_OPERATIONAL" ||
    explicit === "PARTNER_COMMISSION"
  ) {
    return explicit;
  }

  const kategori = String(item.kategori || "").trim();
  const jenis = String(item.jenis || "").trim();
  const lowerKategori = kategori.toLowerCase();
  const lowerJenis = jenis.toLowerCase();
  const lowerKet = String(item.keterangan || "").toLowerCase();
  // 1.5 Internal Transfers (Zero P&L impact)
  if (
    explicit === "INTERNAL_TRANSFER" ||
    lowerKategori === "transfer" ||
    lowerKategori.includes("transfer") ||
    lowerJenis === "transfer" ||
    lowerJenis.includes("transfer") ||
    lowerKet.includes("setor sisa") ||
    lowerKet.includes("setoran ke kantor") ||
    lowerKet.includes("setoran_ke_kantor") ||
    lowerKet.includes("setoran_messenger") ||
    lowerKet.includes("setoran kas messenger")
  ) {
    return "INTERNAL_TRANSFER";
  }

  // 2. Courier operational category or reimbursement
  const courierOperationalCategories = [
    "bensin",
    "parkir",
    "tol",
    "tambal ban",
    "tambal_ban",
    "transportasi",
    "transport",
    "biaya operasional lainnya",
    "operasional kurir",
    "operasional messenger",
  ];
  if (courierOperationalCategories.some((c) => lowerKategori === c || lowerKategori.includes(c))) {
    return "MESSENGER_OPERATIONAL";
  }

  // 3. Partner commission
  if (
    lowerKategori === "komisi" ||
    lowerKategori === "cashback" ||
    lowerKategori.includes("komisi") ||
    lowerKategori.includes("cashback") ||
    lowerJenis === "komisi" ||
    lowerJenis === "cashback"
  ) {
    return "PARTNER_COMMISSION";
  }

  // 4. Office operational
  const officeCategories = [
    "operasional kantor",
    "listrik",
    "air",
    "internet",
    "wifi",
    "atk",
    "sewa",
    "gaji",
    "pengeluaran kantor",
  ];
  if (officeCategories.some((c) => lowerKategori === c || lowerKategori.includes(c)) || lowerJenis.includes("kantor")) {
    return "OFFICE_OPERATIONAL";
  }

  // 5. Samsat pass-through
  const samsatPassThroughCategories = [
    "talangan samsat",
    "titipan samsat",
    "samsat pass through",
    "pass through samsat",
    "biaya resmi samsat",
    "biaya samsat",
    "bayar samsat",
    "setoran samsat",
    "titip samsat",
  ];
  if (
    samsatPassThroughCategories.some((c) => lowerKategori === c || lowerJenis === c) ||
    lowerJenis === "talangan samsat"
  ) {
    return "SAMSAT_PASS_THROUGH";
  }

  // 6. If jenis is explicitly "Operasional", it is courier/messenger operational expense by definition
  // Even if description mentions 'pajak' or 'samsat' (e.g. 'Bensin antar berkas pajak')
  if (lowerJenis === "operasional" || lowerJenis === "operasional messenger") {
    if (
      lowerKet.includes("talangan pokok pkb") ||
      lowerKet.includes("modal titipan samsat") ||
      lowerKet.includes("dana talangan pkb")
    ) {
      return "SAMSAT_PASS_THROUGH";
    }
    return "MESSENGER_OPERATIONAL";
  }

  // 7. If linked to messenger reimbursement record, default to courier operational
  if (item.reimbursementId) {
    return "MESSENGER_OPERATIONAL";
  }

  // 8. Unstructured fallback inspection
  if (
    lowerKet.includes("bensin") ||
    lowerKet.includes("parkir") ||
    lowerKet.includes("tambal ban") ||
    lowerKet.includes("tol") ||
    lowerKet.includes("transport") ||
    lowerKet.includes("spbu")
  ) {
    return "MESSENGER_OPERATIONAL";
  }

  if (
    lowerKet.includes("talangan samsat") ||
    lowerKet.includes("titipan pkb") ||
    lowerKet.includes("bayar pkb") ||
    lowerKet.includes("reimbursement pkb") ||
    lowerKet.includes("reimbursement samsat") ||
    (lowerKet.includes("pkb") && lowerKet.includes("samsat")) ||
    lowerKet.includes("bayar swdkllj") ||
    lowerKet.includes("dana titipan samsat") ||
    lowerKet.includes("biaya samsat") ||
    lowerKet.includes("bayar samsat") ||
    lowerKet.includes("setoran samsat") ||
    lowerKet.includes("titip samsat")
  ) {
    return "SAMSAT_PASS_THROUGH";
  }

  return "MESSENGER_OPERATIONAL";
}

export interface InvoiceProfitMetrics {
  recognizedRevenue: number;
  biayaSamsat: number;
  grossServiceMargin: number; // recognizedRevenue - biayaSamsat (preserves negative margin on deficit)
  biayaAntarJemput: number;
  cashback: number;
  netTransactionMargin: number; // grossServiceMargin - biayaAntarJemput - cashback (preserves negative margin)
  isGrossDeficit: boolean;
  isNetDeficit: boolean;
  costClassification?: CostClassificationType | string;
  isConfigured?: boolean;
}

export function calculateInvoiceProfitMetrics(inv: {
  dibayar?: number;
  terbayar?: number;
  totalTagihan?: number;
  totalBiaya?: number;
  biayaSamsat?: number;
  biayaPokokSamsat?: number;
  biayaAntarJemput?: number;
  cashback?: number;
  isExplicitZero?: boolean;
  is_explicit_zero?: boolean;
  isZeroCostPromotion?: boolean;
  costClassification?: CostClassificationType | string;
  isCostVerified?: boolean;
}): InvoiceProfitMetrics {
  const isExplicitZero = Boolean(
    inv.isExplicitZero ||
    inv.is_explicit_zero ||
    inv.isZeroCostPromotion ||
    inv.costClassification === "EXPLICIT_ZERO"
  );

  const rawTotal = inv.totalTagihan !== undefined ? inv.totalTagihan : inv.totalBiaya;
  const isTotalConfigured = rawTotal !== undefined && !isNaN(Number(rawTotal)) && Number(rawTotal) > 0;
  const dibayar = Math.max(0, Number(inv.dibayar ?? inv.terbayar ?? 0));

  // Revenue recognition rules:
  // 1. Configured invoice: recognized strictly up to totalTagihan; overpayment is custodial liability, not company revenue
  // 2. Explicit zero promotion: revenue recognized is 0
  // 3. Unconfigured / invalid: revenue is strictly 0 (payments are custodial deposits / liabilities, never company revenue)
  const recognizedRevenue = isTotalConfigured ? Math.min(dibayar, Number(rawTotal)) : 0;

  const rawSamsat = inv.biayaSamsat !== undefined ? inv.biayaSamsat : inv.biayaPokokSamsat;
  const hasSamsatCost = rawSamsat !== undefined && !isNaN(Number(rawSamsat)) && Number(rawSamsat) > 0;
  const biayaSamsat = hasSamsatCost ? Number(rawSamsat) : 0;

  // Gross Service Margin: Revenue minus pass-through Samsat costs (preserves negative margin on deficit)
  // Unconfigured orders MUST NEVER produce positive gross service margin!
  // If pass-through Samsat cost was incurred, margin is negative (operating deficit: 0 - biayaSamsat).
  const grossServiceMargin = (isTotalConfigured || isExplicitZero)
    ? recognizedRevenue - biayaSamsat
    : (hasSamsatCost ? 0 - biayaSamsat : 0);

  const biayaAntarJemput = Number(inv.biayaAntarJemput || 0);
  const cashback = Number(inv.cashback || 0);

  // Net Transaction Margin: Gross Margin minus direct fulfillment costs and partner commissions
  const netTransactionMargin = grossServiceMargin - biayaAntarJemput - cashback;

  const costClassification: CostClassificationType | string = isExplicitZero
    ? "EXPLICIT_ZERO"
    : isTotalConfigured
    ? (inv.costClassification || (inv.isCostVerified ? "ACTUAL_COST" : "ESTIMATED_COST"))
    : "UNCONFIGURED";

  return {
    recognizedRevenue,
    biayaSamsat,
    grossServiceMargin,
    biayaAntarJemput,
    cashback,
    netTransactionMargin,
    isGrossDeficit: grossServiceMargin < 0,
    isNetDeficit: netTransactionMargin < 0,
    costClassification,
    isConfigured: isTotalConfigured || isExplicitZero,
  };
}

export interface DocumentFinancialValidationResult {
  isUnloaded: boolean;
  isInvalidData: boolean;
  isNoSnapshot: boolean;
  isValidZero: boolean;
  isLunas: boolean;
  isValidToPrint: boolean;
  total: number;
  dibayar: number;
  sisa: number;
  validationErrorMessage?: string;
}

export function validateDocumentFinancialData(data: any): DocumentFinancialValidationResult {
  if (!data || Object.keys(data).length === 0) {
    return {
      isUnloaded: true,
      isInvalidData: false,
      isNoSnapshot: false,
      isValidZero: false,
      isLunas: false,
      isValidToPrint: false,
      total: 0,
      dibayar: 0,
      sisa: 0,
      validationErrorMessage: "Data dokumen belum dimuat atau kosong.",
    };
  }

  const isExplicitZero = Boolean(
    data.isExplicitZero ||
    data.is_explicit_zero ||
    data.isZeroCostPromotion ||
    data.costClassification === "EXPLICIT_ZERO"
  );

  const hasSnapshot = Boolean(
    data.costSnapshot ||
    data.costBreakdown ||
    data.estimationResult ||
    data.biayaJasa !== undefined ||
    data.biaya_jasa !== undefined ||
    data.biayaSamsat !== undefined ||
    data.biaya_samsat !== undefined ||
    data.serviceId ||
    data.service_id
  );

  const rawTotal = (typeof data["Total Tagihan Konsumen"] === "number")
    ? data["Total Tagihan Konsumen"]
    : (typeof data.totalBiaya === "number")
    ? data.totalBiaya
    : (typeof data.totalTagihan === "number")
    ? data.totalTagihan
    : (typeof data.total_tagihan === "number")
    ? data.total_tagihan
    : (typeof data.total === "number")
    ? data.total
    : undefined;

  const rawDibayar = Number(
    data["Uang Masuk dari Konsumen"] ??
    data.totalDibayar ??
    data.dibayar ??
    data.terbayar ??
    data.sudahBayar ??
    data.nominal ??
    data.amount ??
    0
  );

  const rawSisa = (typeof data["Sisa Tagihan"] === "number")
    ? data["Sisa Tagihan"]
    : (typeof data.Kekurangan === "number")
    ? data.Kekurangan
    : (typeof data.sisaTagihan === "number")
    ? data.sisaTagihan
    : (typeof data.sisa === "number")
    ? data.sisa
    : (typeof data.kurang === "number")
    ? data.kurang
    : undefined;

  const hasIdentifier = Boolean(
    data.nopol ||
    data.customer ||
    data.orderNo ||
    data.invoiceNo ||
    data.invoice ||
    data["Plat No"] ||
    data["Nama Customer"] ||
    data["Nomor Order"]
  );

  const isInvalidData =
    rawTotal === undefined ||
    isNaN(Number(rawTotal)) ||
    Number(rawTotal) < 0 ||
    !hasIdentifier;

  const isNoSnapshot = !hasSnapshot && (rawTotal === 0 || rawTotal === undefined);
  const isValidZero = !isInvalidData && rawTotal === 0 && isExplicitZero;

  const total = rawTotal !== undefined && !isNaN(Number(rawTotal)) && Number(rawTotal) >= 0 ? Number(rawTotal) : 0;
  const dibayar = Math.max(0, rawDibayar);
  const sisa = rawSisa !== undefined ? Math.max(0, Number(rawSisa)) : Math.max(0, total - dibayar);

  // Status Lunas strictly requires:
  // 1. Either explicit zero (promotional / zero cost official service)
  // 2. Or total > 0 AND sisa <= 0 AND data is valid AND snapshot is available
  const isLunas = isValidZero || (total > 0 && sisa <= 0 && !isInvalidData && !isNoSnapshot);

  // Document can be printed only if data is valid, has snapshot, and is either positive total or valid explicit zero
  const isValidToPrint = !isInvalidData && !isNoSnapshot && (total > 0 || isValidZero);

  let validationErrorMessage: string | undefined = undefined;
  if (isInvalidData) {
    validationErrorMessage = "Data tagihan tidak lengkap atau tidak valid (total tagihan atau identitas transaksi tidak ditemukan).";
  } else if (isNoSnapshot) {
    validationErrorMessage = "Rincian biaya (snapshot estimasi) belum tersedia untuk dokumen ini.";
  }

  return {
    isUnloaded: false,
    isInvalidData,
    isNoSnapshot,
    isValidZero,
    isLunas,
    isValidToPrint,
    total,
    dibayar,
    sisa,
    validationErrorMessage,
  };
}
