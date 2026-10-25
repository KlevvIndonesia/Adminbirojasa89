/**
 * Canonical Domain Types for Finance, Invoicing, and Accounting
 * Admin SUN89 — Biro Jasa Management System
 */

import { SettlementCondition, RefundStatus } from "../order/types";

export type PaymentStatus = "Belum Bayar" | "Kurang Bayar" | "Lunas" | "Kelebihan Bayar" | "Belum Lunas" | "Kurang" | "CANCELLED" | "BATAL" | "Dibatalkan";
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
  invoiceRef?: string;
  penanggungJawab?: string;
}

export interface PengeluaranItem {
  id: number;
  tanggal: string;
  keterangan: string;
  nominal: number;
  penanggungJawab?: string;
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
