/**
 * Canonical Domain Types for Orders
 * Admin SUN89 — Biro Jasa Management System
 */

import { OrderCostBreakdownItem, OrderCostSnapshot } from "../pricing/types";
import type {
  MessengerComponentProgress,
  TaskPriority,
  ChecklistSebelumBerangkat,
  PickupProof,
  DeliveryHandoverProof,
  MessengerTimelineEvent,
} from "../messenger/types";

export interface StructuredAddress {
  kota: string;
  kecamatan: string;
  kelurahan: string;
  detail: string;
  rtRw: string;
  nomor: string;
  landmark: string;
  mapsUrl?: string;
}

export interface OrderDocument {
  name: string;
  status: "Sudah Tersedia" | "Belum Tersedia" | "Baru Diupload" | "Diperbarui";
  updatedAt?: string;
  isOptional?: boolean;
  fileType?: "image" | "pdf" | string;
  fileUrl?: string;
  fileSize?: string;
  documentId?: string;
}

export interface SamsatProcessItem {
  id: string;
  name: string;
  category: "Mutasi Keluar" | "Mutasi Masuk" | "Layanan Standar";
  status: "Selesai" | "Sedang Diproses" | "Belum Diproses";
  completedAt?: string;
  basePrice: number;
  actualCost?: number;
}

export interface PaymentProof {
  fileName: string;
  fileType: "image" | "pdf";
  fileUrl?: string;
  uploadedAt: string;
  fileSize?: string;
  documentId?: string;
}

export type SettlementCondition =
  | "PENDING_FINALIZATION"
  | "BALANCED"
  | "UNDERPAID"
  | "OVERPAID"
  | "SETTLED";

export type RefundStatus = "NONE" | "PENDING" | "PROCESSED";

export interface DocumentApprovalMetadata {
  stage5Verified: boolean;
  stage5VerifiedBy?: string;
  stage5VerifiedAt?: string;
  stage6Approved: boolean;
  stage6ApprovedBy?: string;
  stage6ApprovedAt?: string;
  approvedDocsSnapshot?: string[];
  snapshotDocs?: any[];
}

export interface RekapDocument {
  id: string;
  orderId: string;
  phase: "BEFORE" | "AFTER";
  documentType: "STNK" | "BPKB" | "SKKP" | "OTHER";
  label: string;
  fileType: "IMAGE" | "PDF";
  fileUrl: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface PaymentCorrectionHistoryItem {
  nominalLama: number;
  nominalBaru: number;
  tanggal: string;
  admin: string;
  catatan?: string;
}

export interface PaymentRecordItem {
  id: string;
  nominal: number;
  tanggal: string;
  metodePembayaran: string;
  namaBank?: string;
  namaRekening?: string;
  noRekening?: string;
  buktiPembayaran?: PaymentProof;
  statusVerifikasi: "MENUNGGU_BUKTI" | "MENUNGGU_VERIFIKASI" | "TERVERIFIKASI" | "DITOLAK";
  verifiedAt?: string;
  verifiedBy?: string;
  alasanPenolakan?: string;
  catatan?: string;
  uploadedBy?: string;
}

export interface OrderPayment {
  tipePembayaran: "Bayar di Awal" | "Bayar di Akhir" | "Tempo";
  metodePembayaran: string;
  statusPembayaran: "Lunas" | "Belum Bayar" | "Kurang Bayar" | "Kelebihan Bayar" | "Belum Lunas" | "Kurang" | string;
  totalBiaya: number;
  totalEstimasi?: number;
  totalBayar?: number;
  statusBayar?: string;
  dibayar: number;
  kurang: number;
  overpayment?: number;
  nominalDibayarAwal?: number;
  nominalPembayaranAwalTerkonfirmasi?: number;
  riwayatKoreksiPembayaran?: PaymentCorrectionHistoryItem[];
  paymentRecords?: PaymentRecordItem[];
  settlementCondition?: SettlementCondition;
  refundStatus?: RefundStatus;
  refundAmount?: number;
  refundProcessedAt?: string;
  refundProcessedBy?: string;
  tanggalBayar?: string;
  namaBank?: string;
  namaRekening?: string;
  noRekening?: string;
  buktiPembayaran?: PaymentProof;
  isPaymentVerified?: boolean;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  invoiceNo?: string;
}

export interface AdditionalProcessItem {
  id: string;
  name: string;
  category?: string;
  note?: string;
  nominal: number;
  status: "DILAPORKAN_MENUNGGU_REVIEW" | "DISETUJUI" | "DITOLAK";
  reportedBy: string;
  reportedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface CustomCostItem {
  id: string;
  name: string;
  category: "Mutasi Keluar" | "Mutasi Masuk" | "Lainnya";
  actualCost: number;
  basePrice: number;
}

export interface OperationalOrder {
  orderNo: string;
  clientRequestId?: string;
  customer: string;
  nomorHP: string;
  layanan: string;
  currentStep: number; // 1 to 8
  currentStageName: string;
  catatanOrder?: string;
  createdAt: string;
  tanggalMasukBerkas?: string;
  tanggalPengeluaranSamsat?: string;

  // Data Pemilik & Kendaraan
  namaPemilik: string;
  kepemilikanKendaraan: string;
  jenisKendaraan: string;
  tahunKendaraan: number | string;
  nopol: string;
  pkbBerlakuSd: string;
  tahunPajak: string;
  bulanPajak: string;
  nominalPkbTerakhir: number;
  nominalSwdkllj: number;
  kodePromo?: string;
  wilayahSamsatAsal: string;
  wilayahSamsatTujuan?: string;

  // Alamat Terstruktur
  alamatPenjemputan: StructuredAddress;
  alamatPengantaran: StructuredAddress;

  // Dokumen
  clientDocuments: Record<string, OrderDocument>;
  updatedDocuments: string[]; // Hasil Samsat
  documentNotes?: string;
  documentsVerified?: boolean;
  documentApproval?: DocumentApprovalMetadata;

  // Estimasi Biaya
  biayaJasa: number;
  biayaAntarJemput?: number;
  biayaLainnya?: number;
  pkb: number;
  swdkllj: number;
  dendaSwdkllj: number;
  totalEstimasi: number;

  // Metadata Pengeluaran Samsat
  namaPenerimaKeluar?: string;
  bankUangKeluar?: string;
  metodePembayaranKeluar?: string;
  tanggalUangMasuk?: string;

  // Biaya Final Aktual (Stage 5 & 6)
  finalBiayaJasa?: number;
  finalPkb?: number;
  finalSwdkllj?: number;
  finalDendaSwdkllj?: number;
  finalMutasiKeluar?: number;
  finalMutasiMasuk?: number;
  finalBiayaLainnya?: number;
  customCostItems?: CustomCostItem[];
  keteranganMutasiKeluar?: string;
  keteranganMutasiMasuk?: string;
  keteranganBiayaLainnya?: string;
  isVerified?: boolean;

  // Penjadwalan Jemput (Stage 2)
  tanggalJemput?: string;
  messenger?: string;
  assignedMessengerId?: string;
  assignedMessengerName?: string;
  catatanPenjadwalan?: string;
  isScheduled?: boolean;
  pickupCompleted?: boolean;
  pickupCompletedAt?: string;

  // Samsat Tracking & Field Operation (Stage 4)
  samsatProcesses: SamsatProcessItem[];
  currentSamsatProcess?: string;
  isSamsatScheduled?: boolean;
  tanggalProsesSamsat?: string;
  samsatMessenger?: string;
  samsatMessengerId?: string;
  catatanSamsat?: string;
  samsatStatus?: "Terjadwal Samsat" | "Menuju Samsat" | "Sedang Proses Samsat" | "Selesai" | string;
  samsatSubstatus?: string;
  samsatJourneyStartedAt?: string;
  samsatArrivedAt?: string;
  samsatCompletedAt?: string;
  additionalProcesses?: AdditionalProcessItem[];

  // Penjemputan Dokumen Hasil Samsat (Bagian E)
  samsatPickupMessenger?: string;
  samsatPickupMessengerId?: string;
  samsatPickupStatus?: "Belum Dijadwal" | "Terjadwal" | "Sedang Jemput Dokumen Samsat" | "Dokumen Samsat Diterima di Kantor" | string;
  samsatPickupStartedAt?: string;
  samsatPickupCompletedAt?: string;
  samsatPickupNotes?: string;

  // Supervisi SPV
  approvedBySpv?: boolean;
  spvNotes?: string;
  spvName?: string;
  spvApprovedAt?: string;

  // Pengantaran Dokumen (Stage 7)
  tanggalPengantaran?: string;
  messengerPengantar?: string;
  catatanPengantaran?: string;
  isDeliveryScheduled?: boolean;
  deliveryStartedAt?: string;
  deliveryStatus?: string;

  // Dokumen Telah Diterima (Stage 8)
  tanggalDiterima?: string;
  isReceived?: boolean;
  receiverName?: string;

  // Pembayaran
  payment: OrderPayment;

  // Back-office Order Source & Creator
  orderSource?: "Offline / Loket" | "Walk-in" | "Telepon / WA" | string;
  createdBy?: string;
  createdById?: string;
  createdByRole?: string;

  // Stage 1 Verification Metadata
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;

  // Messenger Task Overrides / Status
  messengerTaskStatus?: "Belum Diambil" | "Dalam Proses" | "Selesai" | "Pending" | "Dibatalkan" | "Dokumen Sudah Tersedia" | "Sedang Dijemput" | "Terjadwal Jemput";
  messengerTaskNotes?: string;
  catatanKendala?: string;
  pickupChecklist?: Record<string, boolean>;
  messengerTaskPriority?: TaskPriority;
  messengerComponentProgress?: Record<string, MessengerComponentProgress>;
  messengerTimeline?: MessengerTimelineEvent[];
  checklistSebelumBerangkat?: ChecklistSebelumBerangkat;
  pickupProof?: PickupProof;
  deliveryHandover?: DeliveryHandoverProof;
  deliveryProof?: any;
  metodePengantaran?: string;
  samsatMessengerNama?: string;
  samsatPickupMessengerNama?: string;
  samsatPickupDate?: string;
  deadlineAt?: string;
  startedAt?: string;

  // Customer Target Delivery Estimate & Actual Finish (Layer 1)
  estimasiSelesaiOrder?: string; // Overall Customer Target Completion Date (YYYY-MM-DD or ISO)
  tanggalSelesaiAktualOrder?: string; // Actual overall completion timestamp

  // Multi-day & Multi-messenger Samsat Stages (Layer 2)
  samsatStageExecutions?: any[];

  // Task Acceptance & Locking Metadata (Layer 3)
  taskAcceptance?: Record<string, {
    status: "PENDING" | "ACCEPTED" | "DECLINED";
    acceptedAt?: string;
    courierId?: string;
    courierName?: string;
    isLocked?: boolean;
    declinedAt?: string;
    declineReason?: string;
    reassignedFrom?: string;
    reassignReason?: string;
    reassignedAt?: string;
  }>;

  // Master Pricing Snapshot & Service Method (Batch 5)
  metodeLayanan?: "Antar Jemput" | "Datang Langsung";
  costBreakdown?: OrderCostBreakdownItem[];
  costSnapshot?: OrderCostSnapshot;
  estimationResult?: any;

  // Final Cost Reconciliation & Rekap Order
  finalCost?: number;
  settlementCondition?: SettlementCondition;
  refundStatus?: RefundStatus;
  rekapDocuments?: RekapDocument[];
  completedAt?: string;

  // Operational State & Status Lifecycle
  isArchived?: boolean | number;
  stageBeforeCancel?: string;
  isCancelled?: boolean;
  status?: string;
  alasanPending?: string;
  alasan_pending?: string;
  uploadedDocs?: any[];
  samsatPickupProof?: any;
  detailAlamatPengembalian?: string;
  componentProgress?: any;
  noInvoice?: string;
  tandaTerima?: string;
  ttbBPKB?: string;
  statusBPKB?: string;
  bpkb?: string;
  statusPengerjaan?: string;
  salesSnapshotStatus?: string;
  statusKepemilikan?: string;
  cancellationReason?: string;
}

export const STAGES = [
  "Verifikasi",
  "Penjadwalan",
  "Verifikasi Dokumen",
  "Proses Samsat",
  "Verifikasi Ulang",
  "Supervisi",
  "Pengantaran",
  "Dokumen Telah Diterima",
] as const;

export type StageName = typeof STAGES[number];

export function getDefaultSamsatProcesses(layanan: string, isFinished: boolean = false): SamsatProcessItem[] {
  // If not finished and no active processes configured, start empty so new orders don't show phantom processes
  if (!isFinished) {
    return [];
  }

  if (layanan.includes("Mutasi Keluar")) {
    return [
      { id: "mk-1", name: "Cek Blokir Kendaraan", category: "Mutasi Keluar", status: "Selesai", completedAt: "09:30", basePrice: 30000, actualCost: 30000 },
      { id: "mk-2", name: "Cek Fisik Bantuan & Hadir", category: "Mutasi Keluar", status: "Selesai", completedAt: "10:15", basePrice: 80000, actualCost: 80000 },
      { id: "mk-3", name: "Legalisir Hadir & CF", category: "Mutasi Keluar", status: "Selesai", completedAt: "11:00", basePrice: 60000, actualCost: 60000 },
      { id: "mk-4", name: "Loket Pembukuan & TU", category: "Mutasi Keluar", status: "Selesai", completedAt: "13:00", basePrice: 45000, actualCost: 45000 },
      { id: "mk-5", name: "Cetak SKP & Fiskal Antar Daerah", category: "Mutasi Keluar", status: "Selesai", completedAt: "14:20", basePrice: 70000, actualCost: 75000 },
      { id: "mk-6", name: "Loket Arsip & Pengeluaran Berkas", category: "Mutasi Keluar", status: "Selesai", completedAt: "15:00", basePrice: 40000, actualCost: 40000 },
    ];
  }

  if (layanan.includes("Mutasi Masuk")) {
    return [
      { id: "mm-1", name: "Pendaftaran Berkas Mutasi Masuk", category: "Mutasi Masuk", status: "Selesai", completedAt: "08:45", basePrice: 50000, actualCost: 50000 },
      { id: "mm-2", name: "Cek Fisik Ulang & Pengesahan", category: "Mutasi Masuk", status: "Selesai", completedAt: "10:00", basePrice: 80000, actualCost: 80000 },
      { id: "mm-3", name: "Penetapan Pajak Baru (Bapenda)", category: "Mutasi Masuk", status: "Selesai", completedAt: "11:30", basePrice: 0, actualCost: 0 },
      { id: "mm-4", name: "Penerbitan BPKB Baru (Polda)", category: "Mutasi Masuk", status: "Selesai", completedAt: "13:30", basePrice: 225000, actualCost: 225000 },
      { id: "mm-5", name: "Penerbitan STNK & TNKB Plat Baru", category: "Mutasi Masuk", status: "Selesai", completedAt: "15:00", basePrice: 100000, actualCost: 100000 },
    ];
  }

  return [];
}
