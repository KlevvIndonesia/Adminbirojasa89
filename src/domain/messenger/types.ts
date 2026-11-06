/**
 * Canonical Domain Types for Messengers and Field Tasks
 * Admin SUN89 — Biro Jasa Management System
 */

import type { OperationalOrder } from "../order/types";

export type MessengerTaskType = "Jemput Dokumen" | "Proses Samsat" | "Jemput Hasil Samsat" | "Pengantaran Dokumen";

// Canonical Task Acceptance Status (Tugas Baru -> Diterima / Ditolak)
export type MessengerAcceptanceStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "SUPERSEDED";

// Canonical Task Lifecycle Status
export type TaskLifecycleStatus =
  | "MENUNGGU_PENUGASAN"
  | "MENUNGGU_DITERIMA"
  | "DITERIMA"
  | "SEDANG_DIKERJAKAN"
  | "MENUNGGU_TAHAPAN_BERIKUTNYA"
  | "SELESAI"
  | "DIBATALKAN";

// Canonical Task Status Codes
export type MessengerTaskStatusCode =
  | "NOT_STARTED"
  | "READY"
  | "IN_PROGRESS"
  | "WAITING"
  | "COMPLETED";

// Legacy Display Status (for backwards compatibility with existing views)
export type MessengerTaskStatus = "Belum Diambil" | "Dalam Proses" | "Selesai" | "Pending" | "Dibatalkan" | "Dokumen Sudah Tersedia" | "Sedang Dijemput" | "Terjadwal Jemput";

// Task Priority
export type TaskPriority = "NORMAL" | "IMPORTANT" | "URGENT";

// Deadline Status
export type DeadlineStatus = "SAFE" | "APPROACHING" | "OVERDUE";

// Component Status in Samsat
export type MessengerComponentStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "WAITING"
  | "COMPLETED"
  | "NOT_REQUIRED";

// General Waiting Reasons
export const WAITING_REASONS = [
  "Dokumen belum lengkap",
  "Menunggu approval",
  "Samsat tutup",
  "Kendaraan belum tersedia",
  "Proses tertunda",
  "Menunggu dokumen tambahan",
] as const;

export type WaitingReason = typeof WAITING_REASONS[number];

// Samsat Specific Waiting Reasons (Requirement #14)
export const SAMSAT_WAITING_REASONS = [
  "Samsat tutup",
  "Menunggu dokumen",
  "Menunggu approval",
  "Proses tertunda",
  "Lainnya",
] as const;

export type SamsatWaitingReason = typeof SAMSAT_WAITING_REASONS[number];

// Component Evidence (Upload Foto/PDF)
export interface ComponentEvidence {
  id: string;
  fileUrl: string;
  fileType: "IMAGE" | "PDF";
  uploadedAt: string;
  uploadedBy: string;
  fileName?: string;
  fileSize?: string;
}

// Progress item for each Samsat process component
export interface MessengerComponentProgress {
  componentId: string;
  name: string;
  category?: string;
  nominal?: number;
  masterPrice?: number; // Referensi dari Harga Dasar Samsat (pricingStore)
  actualOrderPrice?: number; // Harga aktual lapangan pada order tertentu (dapat diedit)
  status: MessengerComponentStatus;
  startedAt?: string;
  completedAt?: string;
  estimatedDurationMinutes?: number;
  isCustomDuration?: boolean;
  customDurationDays?: number;
  estimatedCompletedAt?: string;
  deadlineAt?: string;
  waitingReason?: string;
  note?: string;
  evidence?: ComponentEvidence[];
  isCustom?: boolean; // Tambahan Lapangan (bukan dari Master Data)
  addedManually?: boolean; // Ditambahkan secara manual oleh messenger / admin
  createdBy?: string;
  createdAt?: string;
}

// Checklist Sebelum Berangkat (for Jemput Dokumen)
export interface ChecklistSebelumBerangkat {
  alamatBenar: boolean;
  nomorTersedia: boolean;
  dokumenDiketahui: boolean;
  customerDihubungi: boolean;
}

// Proof of Pickup for Jemput Dokumen
export interface PickupProof {
  photoProofUrl?: string;
  notes?: string;
  catatanKendala?: string;
  pickupChecklist?: Record<string, boolean>;
  completedAt: string;
}

// Proof of Handover for Delivery (Stage 7 -> 8)
export interface DeliveryHandoverProof {
  recipientName: string;
  relationship: string;
  photoProofUrl?: string;
  fileName?: string;
  fileType?: "image" | "pdf";
  fileSize?: number;
  notes?: string;
  completedAt?: string;
}

// Timeline audit events for messenger tasks
export interface MessengerTimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  note?: string;
  author: string;
  type?: "STATUS_CHANGE" | "COMPONENT_UPDATE" | "EVIDENCE_UPLOAD" | "DELIVERY" | "ASSIGNMENT" | "REIMBURSEMENT" | "PROGRESS_UPDATE";
}

// ==========================================
// REIMBURSEMENT (PENGAJUAN BIAYA)
// ==========================================

export type ReimbursementCategory =
  | "Bensin"
  | "Parkir"
  | "Tol"
  | "Transportasi"
  | "Biaya Operasional Lainnya";

export type ReimbursementStatus =
  | "Diajukan"
  | "Sedang Ditinjau"
  | "Disetujui"
  | "Ditolak"
  | "Dibayar";

export interface ReimbursementItemDetail {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ReimbursementRequest {
  id: string;
  employeeId: string;
  messengerId?: string;
  messengerName: string;
  orderNo?: string;
  category: ReimbursementCategory;
  amount: number;
  approvedAmount?: number;
  rejectedAmount?: number;
  items?: ReimbursementItemDetail[];
  date: string; // "YYYY-MM-DD"
  note?: string;
  receiptUrl?: string;
  receiptName?: string;
  status: ReimbursementStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  paidAt?: string;
  paidBy?: string;
  paymentMethod?: string;
  transactionRef?: string;
  pengeluaranId?: number;
  kasMessengerId?: number;
  channel?: string;
}

// Multi-Day & Multi-Messenger Samsat Stage Execution
export interface SamsatStageExecution {
  stageId: string; // e.g. "samsat-cabut-berkas" or "samsat-daftar-masuk"
  stageName: string; // "Cabut Berkas Samsat Asal" / "Pendaftaran Samsat Tujuan"
  lokasiSamsat?: string;
  assignedMessengerName?: string;
  assignedMessengerId?: string;
  acceptanceStatus: MessengerAcceptanceStatus;
  status: "BELUM_MULAI" | "SEDANG_DIPROSES" | "MENUNGGU" | "SELESAI";
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  proofPhotos?: string[];
}

// Full Operational Task Item
export interface MessengerTaskItem {
  id: string | number;
  orderNo: string;
  noBerkas: string;
  customer: string;
  phone: string;
  nopol: string;
  jenisTugas: string;
  keteranganTugas: MessengerTaskType;
  lokasi: string;
  messenger: string;
  assignedMessengerId?: string;
  status: MessengerTaskStatus; // Legacy display string
  statusCode?: MessengerTaskStatusCode; // Canonical status code
  lifecycleStatus?: TaskLifecycleStatus; // Canonical 7-state lifecycle
  acceptanceStatus?: MessengerAcceptanceStatus; // PENDING | ACCEPTED | DECLINED
  acceptedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  isLocked?: boolean;
  reassignedFrom?: string;
  reassignReason?: string;
  reassignedAt?: string;
  targetCompletionDate?: string; // Overall customer estimated completion
  priority?: TaskPriority;
  deadlineAt?: string;
  estimatedCompletedAt?: string;
  deadlineStatus?: DeadlineStatus;
  startedAt?: string;
  completedAt?: string;
  tanggalTerima: string;
  tanggalSelesai: string;
  keterangan: string;
  waitingReason?: string;
  currentStep: number;
  currentStageName: string;
  rawOrder: OperationalOrder;
  checklist?: ChecklistSebelumBerangkat;
  pickupProof?: PickupProof;
  componentProgress?: MessengerComponentProgress[];
}

// Completed Messenger Task History Record for Admin Dashboard & Messenger Auditing
export interface MessengerHistoryItem {
  id: string;
  orderNo: string;
  taskType: MessengerTaskType;
  messenger: string;
  messengerEmployeeId?: string;
  customer: string;
  phone?: string;
  nopol: string;
  jenisKendaraan?: string;
  layanan: string;
  wilayah: string;
  completedAt: string;
  totalTagihan: number;
  terbayar?: number;
  statusBayar?: string;
  status: "Selesai";
  keterangan?: string;
  receiverName?: string;
  relationship?: string;
  photoProofUrl?: string;
  rawOrder: OperationalOrder;
}

export const KNOWN_MESSENGERS = [
  "Ahmad Rizki",
  "Budi Santoso",
  "Citra Dewi",
  "Dedi Cahyadi",
  "Eko Prasetyo",
  "Fandi Kurniawan",
  "Gilang Ramadhan",
  "Hendra Wijaya",
  "Andi Pratama",
] as const;

// Helper to map code to display label
export function getStatusDisplayLabel(status: MessengerTaskStatusCode | MessengerTaskStatus): string {
  switch (status) {
    case "NOT_STARTED":
      return "Belum Dikerjakan";
    case "READY":
      return "Siap Dikerjakan";
    case "IN_PROGRESS":
      return "Sedang Dikerjakan";
    case "WAITING":
      return "Menunggu";
    case "COMPLETED":
      return "Selesai";
    default:
      return status;
  }
}

// Helper to format deadline concisely for mobile
export function formatMobileDeadline(deadlineAt?: string): string {
  if (!deadlineAt) return "Tanpa batas waktu";
  const deadlineDate = new Date(deadlineAt);
  if (isNaN(deadlineDate.getTime())) return deadlineAt;

  const now = new Date();
  const diffHours = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) {
    const overdueHours = Math.abs(Math.round(diffHours));
    if (overdueHours < 24) {
      return `Terlambat ${overdueHours} jam`;
    }
    const overdueDays = Math.round(overdueHours / 24);
    return `Terlambat ${overdueDays} hari`;
  }

  const timeStr = deadlineDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const isToday =
    deadlineDate.getDate() === now.getDate() &&
    deadlineDate.getMonth() === now.getMonth() &&
    deadlineDate.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now.getTime() + 24 * 3600000);
  const isTomorrow =
    deadlineDate.getDate() === tomorrow.getDate() &&
    deadlineDate.getMonth() === tomorrow.getMonth() &&
    deadlineDate.getFullYear() === tomorrow.getFullYear();

  if (isToday) {
    return `Hari ini • ${timeStr}`;
  }
  if (isTomorrow) {
    return `Besok • ${timeStr}`;
  }

  const dateStr = deadlineDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return `${dateStr} • ${timeStr}`;
}
