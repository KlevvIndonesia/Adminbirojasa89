/**
 * Messenger Task Adapter
 * Single Source of Truth: Derives real operational tasks from OrderStore
 * Enforces strict per-employee data isolation and role-gated mutations
 */

import { orderStore, OperationalOrder, StageName, STAGES } from "./orderStore";
import { AdditionalProcessItem, CustomCostItem } from "../../domain/order/types";
import { pricingStore, resolveSamsatId } from "./pricingStore";
import { auditLog } from "../utils/auditLog";

import {
  MessengerTaskType,
  MessengerTaskStatus,
  MessengerTaskStatusCode,
  MessengerTaskItem,
  MessengerHistoryItem,
  MessengerComponentProgress,
  ComponentEvidence,
  ChecklistSebelumBerangkat,
  PickupProof,
  DeliveryHandoverProof,
  MessengerTimelineEvent,
  TaskPriority,
  DeadlineStatus,
  ReimbursementCategory,
  ReimbursementStatus,
  ReimbursementRequest,
  KNOWN_MESSENGERS,
  WAITING_REASONS,
  SAMSAT_WAITING_REASONS,
  SamsatWaitingReason,
  getStatusDisplayLabel,
  formatMobileDeadline,
} from "../../domain/messenger/types";

export type {
  MessengerTaskType,
  MessengerTaskStatus,
  MessengerTaskStatusCode,
  MessengerTaskItem,
  MessengerHistoryItem,
  MessengerComponentProgress,
  ComponentEvidence,
  ChecklistSebelumBerangkat,
  PickupProof,
  DeliveryHandoverProof,
  MessengerTimelineEvent,
  TaskPriority,
  DeadlineStatus,
  ReimbursementCategory,
  ReimbursementStatus,
  ReimbursementRequest,
  SamsatWaitingReason,
  AdditionalProcessItem,
};

export {
  KNOWN_MESSENGERS,
  WAITING_REASONS,
  SAMSAT_WAITING_REASONS,
  getStatusDisplayLabel,
  formatMobileDeadline,
};

// ==========================================
// Date & Deadline Helpers
// ==========================================

export function calculateDeadlineStatus(deadlineAt?: string): DeadlineStatus {
  if (!deadlineAt) return "SAFE";
  const deadlineTime = new Date(deadlineAt).getTime();
  if (isNaN(deadlineTime)) return "SAFE";
  const now = Date.now();
  const diffHours = (deadlineTime - now) / (1000 * 60 * 60);

  if (diffHours < 0) return "OVERDUE";
  if (diffHours <= 6) return "APPROACHING";
  return "SAFE";
}

export function calculateEstimatedCompletion(startedAt: string, durationMinutes: number): string {
  const start = new Date(startedAt).getTime();
  if (isNaN(start)) {
    return new Date(Date.now() + durationMinutes * 60000).toISOString();
  }
  return new Date(start + durationMinutes * 60000).toISOString();
}

export function mapStageToTaskType(step: number): MessengerTaskType {
  if (step <= 3) return "Jemput Dokumen";
  if (step <= 6) return "Proses Samsat";
  return "Pengantaran Dokumen";
}

export function mapToStatusCode(status: MessengerTaskStatus, step: number): MessengerTaskStatusCode {
  switch (status) {
    case "Selesai":
      return "COMPLETED";
    case "Dalam Proses":
      return "IN_PROGRESS";
    case "Pending":
      return "WAITING";
    case "Belum Diambil":
      return step === 2 ? "READY" : "NOT_STARTED";
    default:
      return "NOT_STARTED";
  }
}

// ==========================================
// Task Derivation from Orders (Single Source of Truth)
// ==========================================

function deriveSingleTaskFromOrder(order: OperationalOrder): MessengerTaskItem {
  const step = order.currentStep;
  let keteranganTugas: MessengerTaskType = mapStageToTaskType(step);

  let messenger: string;
  let assignedMessengerId: string | undefined;
  let defaultStatus: MessengerTaskStatus;
  let lokasi: string;
  let tanggalTerima: string;
  let tanggalSelesai: string = "-";
  let keterangan: string;

  if (step <= 3) {
    keteranganTugas = "Jemput Dokumen";
    const isDatangLangsung = order.metodeLayanan === "Datang Langsung";
    if (isDatangLangsung) {
      messenger = "Datang Langsung (Loket)";
      assignedMessengerId = undefined;
      tanggalTerima = order.tanggalJemput || order.createdAt;
      lokasi = "Loket Kantor Biro Jasa SUN89";
      defaultStatus = "Selesai";
      keterangan = "Klien datang langsung ke loket kantor (Tanpa penjemputan kurir)";
    } else {
      messenger = order.messenger?.trim() || order.assignedMessengerName || "Belum Ditugaskan";
      assignedMessengerId = order.assignedMessengerId;
      tanggalTerima = order.tanggalJemput || order.createdAt;
      lokasi = order.alamatPenjemputan?.detail
        ? `${order.alamatPenjemputan.detail}, ${order.alamatPenjemputan.kota || order.wilayahSamsatAsal}`
        : (order.alamatPenjemputan?.kota || order.wilayahSamsatAsal || "Alamat Klien");

      if (step === 1) {
        defaultStatus = order.isScheduled && messenger !== "Belum Ditugaskan" && order.messengerTaskStatus ? order.messengerTaskStatus : "Belum Diambil";
        keterangan = order.catatanPenjadwalan || order.catatanOrder || "Menunggu verifikasi order & penjemputan";
      } else if (step === 2) {
        if (order.pickupCompleted || order.messengerTaskStatus === "Dokumen Sudah Tersedia") {
          defaultStatus = "Selesai";
        } else if (order.messengerTaskStatus === "Sedang Dijemput" || order.messengerTaskStatus === "Dalam Proses") {
          defaultStatus = "Dalam Proses";
        } else {
          defaultStatus = "Belum Diambil";
        }
        keterangan = order.catatanPenjadwalan || "Penjadwalan penjemputan berkas dari klien";
      } else {
        defaultStatus = "Selesai";
        keterangan = order.documentNotes || "Dokumen fisik diterima messenger, verifikasi kelengkapan berkas";
      }
    }
  } else if (step <= 6) {
    const samsatName = order.wilayahSamsatAsal || "Jakarta";
    lokasi = samsatName.toLowerCase().includes("samsat") ? samsatName : `Samsat ${samsatName}`;
    tanggalTerima = order.tanggalProsesSamsat || order.createdAt;

    if (step === 4) {
      if (order.samsatStatus === "Selesai") {
        // Distinct task for fetching Samsat results to office
        keteranganTugas = "Jemput Hasil Samsat";
        messenger = order.samsatPickupMessenger?.trim() || order.samsatPickupMessengerNama?.trim() || "Belum Ditugaskan";
        assignedMessengerId = order.samsatPickupMessengerId;
        if (order.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor") {
          defaultStatus = "Selesai";
        } else if (order.samsatPickupStatus === "Sedang Jemput Dokumen Samsat") {
          defaultStatus = "Dalam Proses";
        } else {
          defaultStatus = "Belum Diambil";
        }
        keterangan = order.samsatPickupNotes || "Ambil dokumen hasil pengurusan dari Samsat dan serahkan ke kantor";
      } else {
        keteranganTugas = "Proses Samsat";
        messenger = order.samsatMessenger?.trim() || order.samsatMessengerNama?.trim() || "Belum Ditugaskan";
        assignedMessengerId = order.samsatMessengerId;
        if (
          order.samsatStatus === "Menuju Samsat" ||
          order.samsatStatus === "Sedang Proses Samsat" ||
          (order.samsatSubstatus && order.samsatSubstatus.startsWith("Sedang")) ||
          order.messengerTaskStatus === "Dalam Proses"
        ) {
          defaultStatus = "Dalam Proses";
        } else {
          defaultStatus = "Belum Diambil";
        }
        keterangan = order.catatanSamsat || (order.samsatSubstatus ? `Status: ${order.samsatSubstatus}` : (order.currentSamsatProcess ? `Proses: ${order.currentSamsatProcess}` : "Berkas dalam pengurusan di loket Samsat"));
      }
    } else if (step === 5) {
      keteranganTugas = "Proses Samsat";
      messenger = order.samsatMessenger?.trim() || order.samsatMessengerNama?.trim() || "Belum Ditugaskan";
      assignedMessengerId = order.samsatMessengerId;
      defaultStatus = "Selesai";
      keterangan = order.isVerified ? "Penetapan pajak & biaya Samsat diverifikasi" : "Menunggu verifikasi ulang biaya Samsat";
    } else {
      keteranganTugas = "Proses Samsat";
      messenger = order.samsatMessenger?.trim() || order.samsatMessengerNama?.trim() || "Belum Ditugaskan";
      assignedMessengerId = order.samsatMessengerId;
      defaultStatus = "Selesai";
      keterangan = order.approvedBySpv ? `Disetujui SPV (${order.spvName || "Supervisor"})` : "Menunggu supervisi & kontrol SPV";
    }
  } else {
    keteranganTugas = "Pengantaran Dokumen";
    const deliveryMessenger = order.messengerPengantar?.trim();
    messenger = deliveryMessenger ? deliveryMessenger : "Belum Ditugaskan";
    assignedMessengerId = (order as any).deliveryMessengerId;
    tanggalTerima = order.tanggalPengantaran || order.createdAt;
    lokasi = order.alamatPengantaran?.detail
      ? `${order.alamatPengantaran.detail}, ${order.alamatPengantaran.kota || order.wilayahSamsatAsal}`
      : (order.alamatPengantaran?.kota || order.wilayahSamsatAsal || "Alamat Pengantaran Klien");

    if (step === 7) {
      if (order.deliveryStatus === "Dokumen Diserahkan" || order.isReceived) {
        defaultStatus = "Selesai";
      } else if (order.deliveryStatus === "Sedang Diantar" || order.messengerTaskStatus === "Dalam Proses") {
        defaultStatus = "Dalam Proses";
      } else {
        defaultStatus = "Belum Diambil";
      }
      keterangan = order.catatanPengantaran || "Dokumen siap/dalam pengantaran ke klien";
    } else {
      defaultStatus = "Selesai";
      tanggalSelesai = order.tanggalDiterima || order.completedAt || order.createdAt;
      keterangan = order.receiverName
        ? `Dokumen telah diserahkan dan diterima oleh ${order.receiverName}`
        : "Dokumen telah diserahkan dan diterima klien";
    }
  }

  const status: MessengerTaskStatus = defaultStatus;
  let statusCode: MessengerTaskStatusCode;
  if (status === "Selesai") {
    statusCode = "COMPLETED";
  } else if (status === "Dalam Proses") {
    statusCode = "IN_PROGRESS";
  } else if (status === "Pending") {
    statusCode = "WAITING";
  } else {
    // Belum Diambil: READY if scheduled / actionable
    if (step === 2) {
      statusCode = order.isScheduled ? "READY" : "NOT_STARTED";
    } else if (step === 4) {
      if (keteranganTugas === "Jemput Hasil Samsat") {
        statusCode = "READY";
      } else {
        statusCode = (order.isSamsatScheduled || order.samsatStatus === "Terjadwal Samsat") ? "READY" : "NOT_STARTED";
      }
    } else if (step === 7) {
      statusCode = (order.isDeliveryScheduled || order.deliveryStatus === "Terjadwal Antar") ? "READY" : "NOT_STARTED";
    } else {
      statusCode = "NOT_STARTED";
    }
  }

  const deadlineStatus = calculateDeadlineStatus(order.deadlineAt);

  // Convert component progress record to array if available
  const componentProgress: MessengerComponentProgress[] = order.messengerComponentProgress
    ? Object.values(order.messengerComponentProgress)
    : [];

  return {
    id: order.orderNo,
    orderNo: order.orderNo,
    noBerkas: order.orderNo,
    customer: order.customer,
    phone: order.nomorHP || "-",
    nopol: order.nopol || "-",
    jenisTugas: order.layanan,
    keteranganTugas,
    lokasi,
    messenger,
    assignedMessengerId,
    status,
    statusCode,
    priority: order.messengerTaskPriority || "NORMAL",
    deadlineAt: order.deadlineAt,
    deadlineStatus,
    startedAt: order.startedAt,
    completedAt: order.completedAt || tanggalSelesai,
    tanggalTerima,
    tanggalSelesai,
    keterangan: order.messengerTaskNotes || keterangan,
    currentStep: step,
    currentStageName: order.currentStageName,
    rawOrder: order,
    checklist: order.checklistSebelumBerangkat,
    pickupProof: order.pickupProof,
    componentProgress,
  };
}

/**
 * Evaluates whether an operational order is strictly an active field messenger duty:
 * - Stage 2 (Penjadwalan): Penjemputan Berkas (Active unless walk-in or already picked up)
 * - Stage 4 (Proses Samsat): Pengurusan Loket Samsat & Jemput Hasil Samsat
 * - Stage 7 (Pengantaran): Pengantaran Dokumen ke Klien (Active unless office collection or already delivered)
 * Office verification stages (Stage 1 Verifikasi, Stage 3 Verifikasi Dokumen di Kantor,
 * Stage 5 Verifikasi Ulang Biaya, Stage 6 Supervisi SPV, Stage 8 Selesai) are strictly excluded.
 */
export function isOperationalOrderMessengerTask(order: OperationalOrder): boolean {
  if (!order) return false;

  // 1. Penjemputan Berkas (Stage 2)
  if (order.currentStep === 2 || order.currentStageName === "Penjadwalan") {
    // If walk-in (customer datang langsung ke loket kantor), no courier pickup
    if (order.metodeLayanan === "Datang Langsung") return false;
    // If pickup is already completed or documents are already marked available at office
    if (order.pickupCompleted || order.messengerTaskStatus === "Dokumen Sudah Tersedia") return false;
    return true;
  }

  // 2. Proses Samsat & Jemput Hasil Samsat (Stage 4)
  if (order.currentStep === 4 || order.currentStageName === "Proses Samsat") {
    // If Samsat process is completed AND result documents are already received at office
    if (order.samsatStatus === "Selesai" && order.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor") {
      return false;
    }
    return true;
  }

  // 3. Pengantaran Dokumen ke Klien (Stage 7)
  if (order.currentStep === 7 || order.currentStageName === "Pengantaran") {
    // If client requested office collection (ambil di kantor), no courier delivery
    if (order.metodePengantaran === "Ambil di Kantor") return false;
    // If already delivered or received by client
    if (order.deliveryStatus === "Dokumen Diserahkan" || order.isReceived) return false;
    return true;
  }

  // All office verification and internal review stages must NOT appear in messenger active tasks
  return false;
}

/**
 * Derives active operational field tasks (used by Admin/SVP views)
 * Strictly includes orders currently requiring messenger field action:
 * Penjadwalan (Jemput Dokumen), Proses Samsat, and Pengantaran Dokumen.
 */
export function deriveMessengerTasksFromOrders(
  activeOrders: Record<StageName, OperationalOrder[]>
): MessengerTaskItem[] {
  const taskItems: MessengerTaskItem[] = [];
  const messengerStages: StageName[] = ["Penjadwalan", "Proses Samsat", "Pengantaran"];

  for (const stage of messengerStages) {
    const orders = activeOrders[stage] || [];
    for (const order of orders) {
      if (isOperationalOrderMessengerTask(order)) {
        taskItems.push(deriveSingleTaskFromOrder(order));
      }
    }
  }

  return taskItems;
}

/**
 * Checks whether an operational task has a valid assigned messenger.
 * Returns false if messenger is unassigned (empty, null, undefined, "Belum Ditugaskan", "-", or walk-in).
 */
export function isTaskAssignedMessenger(task: MessengerTaskItem | null | undefined): boolean {
  if (!task) return false;

  const rawMsg = task.messenger || task.rawOrder?.assignedMessengerName || task.rawOrder?.messenger || "";
  const cleanMsg = rawMsg.trim().toLowerCase();

  const rawEmpId = task.assignedMessengerId || task.rawOrder?.assignedMessengerId || "";
  const cleanEmpId = rawEmpId.trim().toLowerCase();

  const isMsgUnassigned =
    !cleanMsg ||
    cleanMsg === "belum ditugaskan" ||
    cleanMsg === "-" ||
    cleanMsg.includes("datang langsung");

  const isEmpIdUnassigned =
    !cleanEmpId ||
    cleanEmpId === "belum ditugaskan" ||
    cleanEmpId === "-";

  // Task is assigned if it has either a valid messenger name or a valid employee ID
  return !(isMsgUnassigned && isEmpIdUnassigned);
}

/**
 * Derives active operational field tasks that strictly have a valid assigned messenger.
 * Unassigned tasks ("Belum Ditugaskan") are excluded from operational display and KPI calculations,
 * while remaining fully intact in OrderStore and SQLite database.
 */
export function deriveAssignedMessengerTasks(
  activeOrders: Record<StageName, OperationalOrder[]>
): MessengerTaskItem[] {
  const allTasks = deriveMessengerTasksFromOrders(activeOrders);
  return allTasks.filter(isTaskAssignedMessenger);
}

/**
 * Calculates authoritative total bill / tagihan for an order
 */
export function calculateOrderTagihan(order: OperationalOrder): number {
  if (order.payment?.totalBiaya && order.payment.totalBiaya > 0) {
    return order.payment.totalBiaya;
  }
  if (order.totalEstimasi && order.totalEstimasi > 0) {
    return order.totalEstimasi;
  }
  const finalCost =
    (order.finalBiayaJasa || 0) +
    (order.finalPkb || 0) +
    (order.finalSwdkllj || 0) +
    (order.finalDendaSwdkllj || 0) +
    (order.finalMutasiKeluar || 0) +
    (order.finalMutasiMasuk || 0) +
    (order.finalBiayaLainnya || 0);
  if (finalCost > 0) return finalCost;
  const initialCost = (order.biayaJasa || 0) + (order.pkb || 0) + (order.swdkllj || 0);
  if (initialCost > 0) return initialCost;
  return order.nominalPkbTerakhir || 0;
}

/**
 * Derives comprehensive Messenger Task History across all completed field tasks:
 * - Pickup tasks (Jemput Dokumen) that were completed
 * - Samsat tasks (Proses Samsat / Jemput Hasil) that were completed
 * - Delivery tasks (Pengantaran Dokumen) that were completed
 * Extracts messenger name, customer, nopol, vehicle, completed date/time, total tagihan,
 * recipient information, notes, and photo proofs.
 */
export function deriveAllMessengerHistory(
  activeOrders: Record<StageName, OperationalOrder[]>,
  archivedOrders: OperationalOrder[] = []
): MessengerHistoryItem[] {
  const history: MessengerHistoryItem[] = [];
  const seenIds = new Set<string>();

  // Gather all unique orders from both active stages and archived list
  const allOrdersMap = new Map<string, OperationalOrder>();
  for (const stage of STAGES) {
    for (const order of activeOrders[stage] || []) {
      if (order?.orderNo) allOrdersMap.set(order.orderNo, order);
    }
  }
  for (const order of archivedOrders) {
    if (order?.orderNo) allOrdersMap.set(order.orderNo, order);
  }

  const allOrders = Array.from(allOrdersMap.values());

  const isValidMessengerName = (name?: string): boolean => {
    if (!name) return false;
    const clean = name.trim().toLowerCase();
    return clean !== "" && clean !== "belum ditugaskan" && clean !== "-" && !clean.includes("datang langsung");
  };

  for (const order of allOrders) {
    const tagihan = calculateOrderTagihan(order);
    const terbayar = order.payment?.totalBayar || tagihan;
    const statusBayar = order.payment?.statusBayar || (terbayar >= tagihan ? "Lunas" : "Belum Lunas");

    // 1. Jemput Dokumen History
    const pickupMessengerName = isValidMessengerName(order.assignedMessengerName)
      ? order.assignedMessengerName!.trim()
      : (isValidMessengerName(order.messenger) ? order.messenger!.trim() : undefined);
    const hasMessengerForPickup = Boolean(pickupMessengerName);
    const isPickupDone =
      order.metodeLayanan !== "Datang Langsung" &&
      hasMessengerForPickup &&
      (order.pickupCompleted ||
        order.messengerTaskStatus === "Dokumen Sudah Tersedia" ||
        order.currentStep >= 3 ||
        Boolean(order.pickupCompletedAt) ||
        Boolean(order.pickupProof?.photoProofUrl));

    if (isPickupDone) {
      const histId = `HIST-${order.orderNo}-PICKUP`;
      if (!seenIds.has(histId)) {
        seenIds.add(histId);
        const mName = pickupMessengerName || "Kurir Penjemput";
        history.push({
          id: histId,
          orderNo: order.orderNo,
          taskType: "Jemput Dokumen",
          messenger: mName,
          messengerEmployeeId: order.assignedMessengerId || resolveMessengerEmployeeId(mName),
          customer: order.customer,
          phone: order.nomorHP || "-",
          nopol: order.nopol || "-",
          jenisKendaraan: order.jenisKendaraan || "-",
          layanan: order.layanan,
          wilayah: order.alamatPenjemputan?.kota || order.wilayahSamsatAsal || "Wilayah Klien",
          completedAt: order.pickupCompletedAt || order.pickupProof?.completedAt || order.tanggalJemput || order.createdAt,
          totalTagihan: tagihan,
          terbayar,
          statusBayar,
          status: "Selesai",
          keterangan: order.pickupProof?.notes || order.catatanPenjadwalan || order.messengerTaskNotes || "Dokumen berkas berhasil dijemput dari klien",
          photoProofUrl: order.pickupProof?.photoProofUrl,
          rawOrder: order,
        });
      }
    }

    // 2. Samsat Process History
    const samsatMessengerName = isValidMessengerName(order.samsatMessenger)
      ? order.samsatMessenger!.trim()
      : (isValidMessengerName(order.samsatMessengerNama)
        ? order.samsatMessengerNama!.trim()
        : (isValidMessengerName(order.assignedMessengerName)
          ? order.assignedMessengerName!.trim()
          : (isValidMessengerName(order.messenger) ? order.messenger!.trim() : undefined)));
    const hasMessengerForSamsat = Boolean(samsatMessengerName);
    const isSamsatDone =
      hasMessengerForSamsat &&
      (order.samsatStatus === "Selesai" ||
        Boolean(order.samsatCompletedAt) ||
        order.currentStep >= 5 ||
        Boolean(order.samsatPickupProof?.photoProofUrl) ||
        Boolean(order.samsatPickupCompletedAt));

    if (isSamsatDone) {
      const histId = `HIST-${order.orderNo}-SAMSAT`;
      if (!seenIds.has(histId)) {
        seenIds.add(histId);
        const mName = samsatMessengerName || "Kurir Samsat";
        history.push({
          id: histId,
          orderNo: order.orderNo,
          taskType: "Proses Samsat",
          messenger: mName,
          messengerEmployeeId: order.samsatMessengerId || resolveMessengerEmployeeId(mName),
          customer: order.customer,
          phone: order.nomorHP || "-",
          nopol: order.nopol || "-",
          jenisKendaraan: order.jenisKendaraan || "-",
          layanan: order.layanan,
          wilayah: order.wilayahSamsatAsal ? (order.wilayahSamsatAsal.toLowerCase().includes("samsat") ? order.wilayahSamsatAsal : `Samsat ${order.wilayahSamsatAsal}`) : "Samsat",
          completedAt: order.samsatCompletedAt || order.tanggalProsesSamsat || order.createdAt,
          totalTagihan: tagihan,
          terbayar,
          statusBayar,
          status: "Selesai",
          keterangan: order.catatanSamsat || order.samsatPickupNotes || "Pengurusan berkas loket Samsat telah diselesaikan",
          photoProofUrl: order.samsatPickupProof?.photoProofUrl,
          rawOrder: order,
        });
      }
    }

    // 3. Pengantaran Dokumen History
    const deliveryMessengerName = isValidMessengerName(order.messengerPengantar)
      ? order.messengerPengantar!.trim()
      : (isValidMessengerName(order.assignedMessengerName)
        ? order.assignedMessengerName!.trim()
        : (isValidMessengerName(order.messenger) ? order.messenger!.trim() : undefined));
    const hasMessengerForDelivery = Boolean(deliveryMessengerName);
    const isDeliveryDone =
      order.metodePengantaran !== "Ambil di Kantor" &&
      hasMessengerForDelivery &&
      (order.deliveryStatus === "Dokumen Diserahkan" ||
        order.isReceived ||
        order.currentStep >= 8 ||
        Boolean(order.deliveryHandover?.completedAt) ||
        Boolean(order.deliveryHandover?.photoProofUrl) ||
        Boolean(order.tanggalDiterima));

    if (isDeliveryDone) {
      const histId = `HIST-${order.orderNo}-DELIVERY`;
      if (!seenIds.has(histId)) {
        seenIds.add(histId);
        const mName = deliveryMessengerName || "Kurir Pengantar";
        history.push({
          id: histId,
          orderNo: order.orderNo,
          taskType: "Pengantaran Dokumen",
          messenger: mName,
          messengerEmployeeId: (order as any).deliveryMessengerId || resolveMessengerEmployeeId(mName),
          customer: order.customer,
          phone: order.nomorHP || "-",
          nopol: order.nopol || "-",
          jenisKendaraan: order.jenisKendaraan || "-",
          layanan: order.layanan,
          wilayah: order.alamatPengantaran?.kota || order.wilayahSamsatAsal || "Alamat Klien",
          completedAt: order.tanggalDiterima || order.deliveryHandover?.completedAt || order.completedAt || order.tanggalPengantaran || order.createdAt,
          totalTagihan: tagihan,
          terbayar,
          statusBayar,
          status: "Selesai",
          receiverName: order.deliveryHandover?.recipientName || order.receiverName || order.customer,
          relationship: order.deliveryHandover?.relationship || "Pemilik Langsung",
          keterangan: order.deliveryHandover?.notes || order.catatanPengantaran || order.messengerTaskNotes || "Dokumen hasil berhasil diserahkan ke klien",
          photoProofUrl: order.deliveryHandover?.photoProofUrl,
          rawOrder: order,
        });
      }
    }
  }

  // Sort by completedAt descending (newest completed first)
  return history.sort((a, b) => {
    const timeA = new Date(a.completedAt).getTime() || 0;
    const timeB = new Date(b.completedAt).getTime() || 0;
    return timeB - timeA;
  });
}

// ==========================================
// ==========================================
// Strict Per-Messenger Isolation Selectors & SSoT Matching
// ==========================================

export function resolveMessengerEmployeeId(messengerName?: string): string | undefined {
  if (!messengerName || messengerName === "Belum Ditugaskan" || messengerName === "-") {
    return undefined;
  }
  const cleanName = messengerName.toLowerCase().trim();
  if (cleanName.includes("budi")) {
    return "EMP-MSG-001";
  }
  if (cleanName.includes("andi")) {
    return "EMP-MSG-002";
  }
  if (cleanName.includes("ahmad")) {
    return "EMP-MSG-003";
  }
  if (cleanName.includes("citra")) {
    return "EMP-MSG-004";
  }
  if (cleanName.includes("dedi")) {
    return "EMP-MSG-005";
  }
  if (cleanName.includes("eko")) {
    return "EMP-MSG-006";
  }
  return undefined;
}

/**
 * Checks whether a task is strictly assigned to the given messenger credentials
 */
export function isTaskAssignedToMessenger(
  task: MessengerTaskItem,
  employeeId?: string,
  userName?: string,
  userId?: string
): boolean {
  const taskMsg = (task.messenger || task.rawOrder?.assignedMessengerName || "").toLowerCase().trim();
  const empId = task.assignedMessengerId;

  // Never match unassigned tasks or walk-in orders
  if (!taskMsg || taskMsg === "belum ditugaskan" || taskMsg === "-" || taskMsg.includes("datang langsung")) {
    if (!empId || empId === "belum ditugaskan" || empId === "-") {
      return false;
    }
  }

  // 1. Direct employeeId match
  if (employeeId && empId && empId === employeeId) {
    return true;
  }
  // 2. Direct userId match
  if (userId && empId && empId === userId) {
    return true;
  }
  // 3. Messenger name match (case-insensitive substring/equality)
  if (userName && taskMsg && taskMsg !== "belum ditugaskan" && taskMsg !== "-") {
    const uName = userName.toLowerCase().trim();
    if (taskMsg === uName || taskMsg.includes(uName) || uName.includes(taskMsg)) {
      return true;
    }
    // Also check resolved ID from name
    const resolvedEmpId = resolveMessengerEmployeeId(taskMsg);
    if (resolvedEmpId && (resolvedEmpId === employeeId || resolvedEmpId === userId)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a task is unassigned and open for any messenger to take
 */
export function isTaskAvailableUnassigned(task: MessengerTaskItem): boolean {
  const taskMsg = (task.messenger || task.rawOrder?.assignedMessengerName || "").toLowerCase().trim();
  const empId = task.assignedMessengerId;
  const isMsgEmpty = !taskMsg || taskMsg === "belum ditugaskan" || taskMsg === "-";
  const isEmpEmpty = !empId || empId === "belum ditugaskan" || empId === "-";

  // Task is unassigned and available if it is active (step < 8 and not completed)
  return isMsgEmpty && isEmpEmpty && task.currentStep < 8 && task.status !== "Selesai" && task.statusCode !== "COMPLETED";
}

/**
 * Checks whether a task is assigned to another messenger (preventing leakage)
 */
export function isTaskAssignedToOther(
  task: MessengerTaskItem,
  employeeId?: string,
  userName?: string,
  userId?: string
): boolean {
  if (isTaskAvailableUnassigned(task)) return false;
  return !isTaskAssignedToMessenger(task, employeeId, userName, userId);
}

/**
 * Returns tasks strictly assigned to the given messenger and scheduled by Admin:
 * - Unassigned tasks ("Belum Ditugaskan") and unscheduled orders are strictly EXCLUDED.
 * - Other messengers' tasks are strictly EXCLUDED.
 * - Only active tasks assigned to this messenger appear in their dashboard.
 */
export function getMessengerTasksForEmployee(
  activeOrders: Record<StageName, OperationalOrder[]>,
  userOrEmployeeId: string | UserContext,
  optionalUserName?: string
): MessengerTaskItem[] {
  let employeeId: string | undefined;
  let userName: string | undefined;
  let userId: string | undefined;

  if (typeof userOrEmployeeId === "object" && userOrEmployeeId !== null) {
    employeeId = userOrEmployeeId.employeeId;
    userName = userOrEmployeeId.userName;
    userId = userOrEmployeeId.userId;
  } else {
    employeeId = userOrEmployeeId;
    userName = optionalUserName;
  }

  // Fallback resolution from userName if employeeId is missing
  if (!employeeId && userName) {
    employeeId = resolveMessengerEmployeeId(userName);
  }

  if (!employeeId && !userName && !userId) return [];

  const allTasks = deriveMessengerTasksFromOrders(activeOrders);
  return allTasks.filter((task) => {
    // 1. Task MUST be strictly assigned to this messenger
    if (!isTaskAssignedToMessenger(task, employeeId, userName, userId)) {
      return false;
    }

    // 2. Task MUST be scheduled by admin and in an active courier stage
    const order = task.rawOrder;
    if (!order) return false;

    // A. Jemput Dokumen (Pickup)
    if (task.keteranganTugas === "Jemput Dokumen") {
      if (order.metodeLayanan === "Datang Langsung") return false;
      // In Stage 1, order is not yet scheduled by admin
      if (!order.isScheduled) return false;
      // Active pickup is in Step 1 (scheduled) or Step 2 (in progress/scheduled)
      return task.currentStep <= 2;
    }

    // B. Proses Samsat
    if (task.keteranganTugas === "Proses Samsat") {
      const isSamsatScheduled =
        !!order.isSamsatScheduled ||
        order.samsatStatus === "Terjadwal Samsat" ||
        order.samsatStatus === "Menuju Samsat" ||
        order.samsatStatus === "Sedang Proses Samsat" ||
        order.samsatStatus === "Selesai";
      if (!isSamsatScheduled) return false;
      return task.currentStep === 4;
    }

    // C. Jemput Hasil Samsat
    if (task.keteranganTugas === "Jemput Hasil Samsat") {
      return task.currentStep === 4 && order.samsatStatus === "Selesai";
    }

    // D. Pengantaran Dokumen
    if (task.keteranganTugas === "Pengantaran Dokumen") {
      if (order.metodePengantaran === "Ambil di Kantor") return false;
      const isDeliveryScheduled =
        !!order.isDeliveryScheduled ||
        order.deliveryStatus === "Terjadwal Antar" ||
        order.deliveryStatus === "Sedang Diantar" ||
        order.deliveryStatus === "Dokumen Diserahkan";
      if (!isDeliveryScheduled) return false;
      return task.currentStep === 7;
    }

    return false;
  });
}

/**
 * Returns task history for the given employeeId (Stage 8 or archived orders).
 */
export function getMessengerTaskHistoryForEmployee(
  activeOrders: Record<StageName, OperationalOrder[]>,
  userOrEmployeeId: string | UserContext,
  archivedOrders: OperationalOrder[] = []
): MessengerTaskItem[] {
  let employeeId: string | undefined;
  let userName: string | undefined;
  let userId: string | undefined;

  if (typeof userOrEmployeeId === "object" && userOrEmployeeId !== null) {
    employeeId = userOrEmployeeId.employeeId;
    userName = userOrEmployeeId.userName;
    userId = userOrEmployeeId.userId;
  } else {
    employeeId = userOrEmployeeId;
  }

  if (!employeeId && userName) {
    employeeId = resolveMessengerEmployeeId(userName);
  }

  if (!employeeId && !userName && !userId) return [];

  const historyItems: MessengerTaskItem[] = [];

  // Check stage 8 in active orders
  const stage8Orders = activeOrders["Dokumen Telah Diterima"] || [];
  for (const order of stage8Orders) {
    const task = deriveSingleTaskFromOrder(order);
    if (isTaskAssignedToMessenger(task, employeeId, userName, userId)) {
      historyItems.push(task);
    }
  }

  // Check archived orders
  for (const order of archivedOrders) {
    const task = deriveSingleTaskFromOrder(order);
    if (isTaskAssignedToMessenger(task, employeeId, userName, userId)) {
      historyItems.push(task);
    }
  }

  return historyItems;
}

/**
 * Calculates operational KPIs strictly for the current messenger
 */
export function getMessengerStatsForEmployee(
  activeOrders: Record<StageName, OperationalOrder[]>,
  userOrEmployeeId: string | UserContext
) {
  const tasks = getMessengerTasksForEmployee(activeOrders, userOrEmployeeId);

  let perluDiambil = 0;
  let sedangDiproses = 0;
  let mendekatiDeadline = 0;
  let terlambat = 0;

  for (const t of tasks) {
    // Deadline urgency check
    if (t.deadlineStatus === "APPROACHING") {
      mendekatiDeadline++;
    } else if (t.deadlineStatus === "OVERDUE") {
      terlambat++;
    }

    // Status breakdown
    if (t.status === "Belum Diambil" || t.statusCode === "NOT_STARTED" || t.statusCode === "READY") {
      perluDiambil++;
    } else if (t.status === "Dalam Proses" || t.statusCode === "IN_PROGRESS") {
      // If deadline is not approaching, count in standard in-progress
      if (t.deadlineStatus !== "APPROACHING") {
        sedangDiproses++;
      }
    }
  }

  return {
    tugasHariIni: tasks.length,
    perluDiambil,
    sedangDiproses,
    mendekatiDeadline,
    terlambat,
  };
}

// ==========================================
// Operational Mutation Handlers with Security
// ==========================================

export interface UserContext {
  userId?: string;
  employeeId?: string;
  role: string;
  userName: string;
}

function toAuditRole(role: string): "administrator" | "finance" | "admin" | "messenger" {
  if (role === "administrator" || role === "svp") return "administrator";
  if (role === "finance") return "finance";
  if (role === "messenger") return "messenger";
  return "admin";
}

function checkTaskOwnership(order: OperationalOrder, user: UserContext): { allowed: boolean; error?: string } {
  // Admin and SVP have global operational supervision
  if (user.role === "admin" || user.role === "administrator" || user.role === "svp") {
    return { allowed: true };
  }

  const task = deriveSingleTaskFromOrder(order);

  // If already assigned to this user, allow
  if (isTaskAssignedToMessenger(task, user.employeeId, user.userName, user.userId)) {
    return { allowed: true };
  }

  // Also check if user matches any stage messenger on the rawOrder
  const uName = (user.userName || "").toLowerCase().trim();
  const empId = user.employeeId;
  const uId = user.userId;
  const matches = (id?: string, name?: string) => {
    if (id && (id === empId || id === uId)) return true;
    if (name && name !== "Belum Ditugaskan" && name !== "-") {
      const n = name.toLowerCase().trim();
      if (n === uName || n.includes(uName) || uName.includes(n)) return true;
    }
    return false;
  };

  if (
    matches(order.assignedMessengerId, order.messenger) ||
    matches(order.samsatMessengerId, order.samsatMessenger) ||
    matches(order.samsatPickupMessengerId, order.samsatPickupMessenger) ||
    matches((order as any).deliveryMessengerId, order.messengerPengantar)
  ) {
    return { allowed: true };
  }

  // If unassigned and open to be taken, allow
  if (isTaskAvailableUnassigned(task)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    error: `Akses ditolak: Tugas ini ditugaskan kepada messenger lain (${task.messenger || "Petugas lain"}). Anda tidak memiliki izin untuk memodifikasi tugas ini.`,
  };
}

/**
 * Start task (Action: Mulai Tugas)
 * Transitions status to IN_PROGRESS, assigns to messenger if unassigned, and records startedAt timestamp
 */
export function startMessengerTask(orderNo: string, user: UserContext): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  const task = deriveSingleTaskFromOrder(order);
  const wasUnassigned = isTaskAvailableUnassigned(task);

  const nowIso = new Date().toISOString();
  const dateStr = nowIso.split("T")[0];
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: wasUnassigned ? `Ambil & Mulai ${task.keteranganTugas}` : `Mulai ${task.keteranganTugas}`,
    note: wasUnassigned
      ? `Tugas ${task.keteranganTugas} (${order.layanan}) diambil dan dimulai oleh ${user.userName}`
      : `Tugas ${task.keteranganTugas} (${order.layanan}) dimulai oleh ${user.userName}`,
    author: user.userName,
    type: "STATUS_CHANGE",
  };

  const existingTimeline = order.messengerTimeline || [];
  const resolvedEmpId = user.employeeId || resolveMessengerEmployeeId(user.userName) || user.userId || "EMP-MSG-001";

  const updates: Partial<OperationalOrder> = {
    startedAt: order.startedAt || nowIso,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  };

  if (order.currentStep <= 3) {
    updates.messengerTaskStatus = "Sedang Dijemput";
    if (wasUnassigned) {
      updates.messenger = user.userName;
      updates.assignedMessengerName = user.userName;
      updates.assignedMessengerId = resolvedEmpId;
      updates.isScheduled = true;
      if (!order.tanggalJemput) updates.tanggalJemput = dateStr;
    }
  } else if (order.currentStep === 4) {
    if (order.samsatStatus === "Selesai") {
      // Jemput hasil Samsat
      updates.samsatPickupStatus = "Sedang Jemput Dokumen Samsat";
      updates.samsatPickupStartedAt = nowIso;
      if (wasUnassigned) {
        updates.samsatPickupMessenger = user.userName;
        updates.samsatPickupMessengerId = resolvedEmpId;
      }
    } else {
      // Kerjakan Tugas Samsat -> Menuju Samsat
      updates.samsatStatus = "Menuju Samsat";
      updates.samsatJourneyStartedAt = nowIso;
      if (wasUnassigned) {
        updates.samsatMessenger = user.userName;
        updates.samsatMessengerId = resolvedEmpId;
        updates.isSamsatScheduled = true;
        if (!order.tanggalProsesSamsat) updates.tanggalProsesSamsat = dateStr;
      }
    }
  } else if (order.currentStep === 7) {
    updates.deliveryStatus = "Sedang Diantar";
    updates.deliveryStartedAt = nowIso;
    if (wasUnassigned) {
      updates.messengerPengantar = user.userName;
      (updates as any).deliveryMessengerId = resolvedEmpId;
      updates.isDeliveryScheduled = true;
      if (!order.tanggalPengantaran) updates.tanggalPengantaran = dateStr;
    }
  } else {
    updates.messengerTaskStatus = "Dalam Proses";
    if (wasUnassigned) {
      updates.messenger = user.userName;
      updates.assignedMessengerName = user.userName;
      updates.assignedMessengerId = resolvedEmpId;
    }
  }

  const success = orderStore.updateOrder(orderNo, updates);
  return { success, error: success ? undefined : "Gagal memperbarui order di store" };
}

/**
 * Messenger departs to Samsat (Menuju Samsat)
 */
export function startSamsatJourney(orderNo: string, user: UserContext): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) return { success: false, error: authCheck.error };

  const nowIso = new Date().toISOString();
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: "Menuju Samsat",
    note: `Messenger ${user.userName} berangkat menuju kantor Samsat.`,
    author: user.userName,
    type: "STATUS_CHANGE",
  };
  const existingTimeline = order.messengerTimeline || [];

  const success = orderStore.updateOrder(orderNo, {
    samsatStatus: "Menuju Samsat",
    samsatJourneyStartedAt: nowIso,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });
  return { success, error: success ? undefined : "Gagal memperbarui status ke Menuju Samsat" };
}

/**
 * Messenger arrives at Samsat (Tiba di Samsat / Mulai Proses Samsat)
 */
export function arriveAtSamsat(orderNo: string, user: UserContext): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) return { success: false, error: authCheck.error };

  const nowIso = new Date().toISOString();
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: "Tiba di Samsat",
    note: `Messenger ${user.userName} telah tiba di Samsat dan memulai pengurusan berkas.`,
    author: user.userName,
    type: "STATUS_CHANGE",
  };
  const existingTimeline = order.messengerTimeline || [];

  const success = orderStore.updateOrder(orderNo, {
    samsatStatus: "Sedang Proses Samsat",
    samsatArrivedAt: nowIso,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });
  return { success, error: success ? undefined : "Gagal memperbarui status ke Sedang Proses Samsat" };
}

/**
 * Messenger updates active subprogress (e.g. Sedang Cek Plat, Sedang Mutasi Masuk — Legalisir)
 */
export function updateSamsatSubprogress(
  orderNo: string,
  subprogress: string,
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) return { success: false, error: authCheck.error };

  const formattedSubstatus = subprogress.startsWith("Sedang ") ? subprogress : `Sedang ${subprogress}`;
  const nowIso = new Date().toISOString();
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: `Progres Samsat: ${formattedSubstatus}`,
    note: `Tahapan pengurusan diperbarui oleh ${user.userName}`,
    author: user.userName,
    type: "STATUS_CHANGE",
  };
  const existingTimeline = order.messengerTimeline || [];

  const success = orderStore.updateOrder(orderNo, {
    samsatStatus: "Sedang Proses Samsat",
    samsatSubstatus: formattedSubstatus,
    currentSamsatProcess: formattedSubstatus,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });
  return { success, error: success ? undefined : "Gagal memperbarui subprogress Samsat" };
}

/**
 * Messenger adds additional process & extra cost
 * Validation: Nominal must be valid non-negative number
 * Status: DILAPORKAN_MENUNGGU_REVIEW
 */
export function addAdditionalProcess(
  orderNo: string,
  data: { name: string; category?: string; nominal: number; note?: string },
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) return { success: false, error: authCheck.error };

  if (!data.name || !data.name.trim()) {
    return { success: false, error: "Nama proses tambahan wajib diisi." };
  }
  const cleanNominal = Number(data.nominal);
  if (isNaN(cleanNominal) || cleanNominal < 0) {
    return { success: false, error: "Nominal biaya harus berupa angka non-negatif (>= 0)." };
  }

  const nowIso = new Date().toISOString();
  const newItem: AdditionalProcessItem = {
    id: `add-proc-${Date.now()}`,
    name: data.name.trim(),
    category: data.category || "Proses Tambahan Lapangan",
    nominal: cleanNominal,
    status: "DILAPORKAN_MENUNGGU_REVIEW",
    note: data.note?.trim(),
    reportedBy: user.userName,
    reportedAt: nowIso,
  };

  const existingProcs = order.additionalProcesses || [];
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: `Lapor Proses Tambahan: ${newItem.name}`,
    note: `Biaya dilaporkan: Rp ${cleanNominal.toLocaleString("id-ID")} (Menunggu review Admin). ${data.note ? `Catatan: ${data.note}` : ""}`,
    author: user.userName,
    type: "COMPONENT_UPDATE",
  };
  const existingTimeline = order.messengerTimeline || [];

  const success = orderStore.updateOrder(orderNo, {
    additionalProcesses: [...existingProcs, newItem],
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });

  return { success, error: success ? undefined : "Gagal menyimpan proses tambahan" };
}

/**
 * Start Samsat Result Pickup (Sedang Jemput Dokumen Samsat)
 */
export function startSamsatResultPickup(
  orderNo: string,
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) return { success: false, error: authCheck.error };

  const nowIso = new Date().toISOString();
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: "Mulai Jemput Hasil Samsat",
    note: `Messenger ${user.userName} mulai menjemput dokumen hasil dari Samsat.`,
    author: user.userName,
    type: "STATUS_CHANGE",
  };
  const existingTimeline = order.messengerTimeline || [];

  const success = orderStore.updateOrder(orderNo, {
    samsatPickupStatus: "Sedang Jemput Dokumen Samsat",
    samsatPickupStartedAt: nowIso,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });

  return { success, error: success ? undefined : "Gagal memperbarui status penjemputan hasil Samsat" };
}

/**
 * Complete Samsat Result Pickup (Dokumen Samsat Diterima di Kantor)
 */
export function completeSamsatResultPickup(
  orderNo: string,
  notes: string | { photoProofUrl?: string; notes?: string } | undefined,
  user: UserContext
): { success: boolean; error?: string } {
  const notesStr = typeof notes === "object" ? notes?.notes : notes;
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) return { success: false, error: authCheck.error };

  const nowIso = new Date().toISOString();
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: "Dokumen Samsat Diserahkan ke Kantor",
    note: notesStr ? `Catatan: ${notesStr}` : `Dokumen hasil pengurusan Samsat telah diserahkan oleh ${user.userName} ke kantor.`,
    author: user.userName,
    type: "STATUS_CHANGE",
  };
  const existingTimeline = order.messengerTimeline || [];

  const success = orderStore.updateOrder(orderNo, {
    samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
    samsatPickupCompletedAt: nowIso,
    samsatPickupNotes: notesStr?.trim() || undefined,
    messengerTaskNotes: notesStr?.trim() || order.messengerTaskNotes,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });

  return { success, error: success ? undefined : "Gagal memperbarui status penjemputan hasil Samsat" };
}

/**
 * Update task status
 * Validates mandatory waiting reason when selecting WAITING / Pending
 */
export function updateMessengerTaskStatus(
  orderNo: string,
  newStatus: MessengerTaskStatusCode | MessengerTaskStatus,
  options: { waitingReason?: string; note?: string },
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  // Validation: WAITING status requires reason
  const isWaiting = newStatus === "WAITING" || newStatus === "Pending";
  if (isWaiting && (!options.waitingReason || !options.waitingReason.trim())) {
    return {
      success: false,
      error: "Alasan menunggu wajib diisi saat memilih status Menunggu (WAITING).",
    };
  }

  // Map to legacy display status for order store
  let mappedDisplayStatus: MessengerTaskStatus;
  switch (newStatus) {
    case "WAITING":
    case "Pending":
      mappedDisplayStatus = "Pending";
      break;
    case "IN_PROGRESS":
    case "Dalam Proses":
      mappedDisplayStatus = "Dalam Proses";
      break;
    case "COMPLETED":
    case "Selesai":
      mappedDisplayStatus = "Selesai";
      break;
    default:
      mappedDisplayStatus = "Belum Diambil";
  }

  const task = deriveSingleTaskFromOrder(order);
  const wasUnassigned = isTaskAvailableUnassigned(task);
  const resolvedEmpId = user.employeeId || resolveMessengerEmployeeId(user.userName) || user.userId || "EMP-MSG-001";

  const nowIso = new Date().toISOString();
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: `Ubah Status: ${getStatusDisplayLabel(newStatus)}`,
    note: options.waitingReason ? `Alasan: ${options.waitingReason}. Catatan: ${options.note || "-"}` : (options.note || ""),
    author: user.userName,
    type: "STATUS_CHANGE",
  };

  const existingTimeline = order.messengerTimeline || [];

  const updates: Partial<OperationalOrder> = {
    messengerTaskStatus: mappedDisplayStatus,
    messengerTaskNotes: options.note || options.waitingReason || order.messengerTaskNotes,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  };

  if (wasUnassigned) {
    updates.messenger = user.userName;
    updates.assignedMessengerName = user.userName;
    updates.assignedMessengerId = resolvedEmpId;
  }

  const success = orderStore.updateOrder(orderNo, updates);

  return { success, error: success ? undefined : "Gagal memperbarui status tugas di store" };
}

/**
 * Update checklist sebelum berangkat (for Jemput Dokumen)
 */
export function updateMessengerChecklist(
  orderNo: string,
  checklist: ChecklistSebelumBerangkat,
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  const allChecked = checklist.alamatBenar && checklist.nomorTersedia && checklist.dokumenDiketahui && checklist.customerDihubungi;
  const existingTimeline = order.messengerTimeline || [];
  let updatedTimeline = existingTimeline;

  if (allChecked) {
    const timelineEvent: MessengerTimelineEvent = {
      id: `tl-${Date.now()}`,
      timestamp: new Date().toISOString(),
      title: "Checklist Sebelum Berangkat Lengkap",
      note: "Semua 4 poin verifikasi pra-penjemputan telah diverifikasi",
      author: user.userName,
      type: "STATUS_CHANGE",
    };
    updatedTimeline = [timelineEvent, ...existingTimeline];
  }

  const success = orderStore.updateOrder(orderNo, {
    checklistSebelumBerangkat: checklist,
    messengerTimeline: updatedTimeline,
  });

  return { success, error: success ? undefined : "Gagal menyimpan checklist" };
}

/**
 * Helper to sync component prices from messengerComponentProgress to order's Mutasi breakdown and totals
 */
export function calculateComponentSyncUpdates(
  currentMap: Record<string, MessengerComponentProgress>
): {
  finalMutasiKeluar: number;
  finalMutasiMasuk: number;
  customCostItems: CustomCostItem[];
  [key: string]: any;
} {
  let mutasiKeluarTotal = 0;
  let mutasiMasukTotal = 0;
  const breakdown: Record<string, number> = {};
  const customCostItems: CustomCostItem[] = [];

  // Mutasi Keluar patterns to order field names
  const mkMapping: Record<string, string> = {
    "legalisir cf": "mutasiKeluarLegalisirCf",
    "legalisir": "mutasiKeluarLegalisir",
    "hadir 2": "mutasiKeluarHadir",
    "hadir": "mutasiKeluarHadir",
    "cek fisik": "mutasiKeluarCf",
    "bantuan": "mutasiKeluarBantuanHadir",
    "cek blokir": "mutasiKeluarCekBlokir",
    "lok. pembukuan": "mutasiKeluarLokPembukuan",
    "pembukuan": "mutasiKeluarLokPembukuan",
    "lok. tu nopil": "mutasiKeluarLokTuNopil",
    "tu nopil": "mutasiKeluarLokTuNopil",
    "lok. tu": "mutasiKeluarLokTu",
    "loksus": "mutasiKeluarLoksus",
    "cetak skp": "mutasiKeluarCetakSkp",
    "skp": "mutasiKeluarCetakSkp",
    "cetak fiskal": "mutasiKeluarCetakFiskal",
    "fiskal": "mutasiKeluarCetakFiskal",
    "lok. arsip": "mutasiKeluarLokArsip",
    "arsip": "mutasiKeluarLokArsip",
    "cek progresif": "mutasiKeluarCekProgresif",
    "progresif": "mutasiKeluarCekProgresif",
    "matiin nopil": "mutasiKeluarMatiinNopil",
    "daftar mutmas kilat": "mutasiKeluarDaftarMutmasKilat",
    "mutmas kilat": "mutasiKeluarDaftarMutmasKilat",
    "daftar mutmas normal": "mutasiKeluarDaftarMutmasNormal",
    "mutmas normal": "mutasiKeluarDaftarMutmasNormal",
  };

  // Mutasi Masuk patterns to order field names
  const mmMapping: Record<string, string> = {
    "legalisir mutmas": "mutasiMasukLegalisir",
    "legalisir": "mutasiMasukLegalisir",
    "mutmas by pendaftaran": "mutasiMasukPendaftaran",
    "pendaftaran": "mutasiMasukPendaftaran",
    "req ganjil genap": "mutasiMasukReqGanjilGenap",
    "ganjil genap": "mutasiMasukReqGanjilGenap",
    "nopol acak": "mutasiMasukAcak",
    "acak": "mutasiMasukAcak",
    "lok. tu masuk": "mutasiMasukLokTu",
    "lok. tu": "mutasiMasukLokTu",
    "lok. pembukuan masuk": "mutasiMasukLokPembukuan",
    "pembukuan": "mutasiMasukLokPembukuan",
    "daftar bpkb": "mutasiMasukDaftarBpkb",
    "penulisan bpkb": "mutasiMasukPenulisanBpkb",
    "cetak notice": "mutasiMasukCetakNotice",
    "notice": "mutasiMasukCetakNotice",
    "cetak stnk": "mutasiMasukCetakStnk",
    "cetak plat": "mutasiMasukCetakPlat",
  };

  Object.values(currentMap).forEach((comp) => {
    // Skip empty dummy placeholder
    if (comp.name === "Komponen Samsat" && (comp.nominal || 0) === 0 && (comp.actualOrderPrice || 0) === 0) {
      return;
    }

    const price = comp.actualOrderPrice !== undefined ? comp.actualOrderPrice : (comp.nominal || comp.masterPrice || 0);
    const cat = (comp.category || "").toLowerCase();
    const nameLower = comp.name.toLowerCase().trim();

    if (comp.isCustom) {
      customCostItems.push({
        id: comp.componentId,
        name: comp.name,
        category: comp.category === "Mutasi Keluar" ? "Mutasi Keluar" : comp.category === "Mutasi Masuk" ? "Mutasi Masuk" : "Lainnya",
        actualCost: price,
        basePrice: comp.masterPrice || 0,
      });
      return;
    }

    if (cat.includes("keluar") || cat === "mutasi keluar") {
      mutasiKeluarTotal += price;
      for (const [pattern, key] of Object.entries(mkMapping)) {
        if (nameLower.includes(pattern) || pattern.includes(nameLower)) {
          breakdown[key] = price;
          break;
        }
      }
    } else if (cat.includes("masuk") || cat === "mutasi masuk") {
      mutasiMasukTotal += price;
      for (const [pattern, key] of Object.entries(mmMapping)) {
        if (nameLower.includes(pattern) || pattern.includes(nameLower)) {
          breakdown[key] = price;
          break;
        }
      }
    } else {
      customCostItems.push({
        id: comp.componentId,
        name: comp.name,
        category: "Lainnya",
        actualCost: price,
        basePrice: comp.masterPrice || 0,
      });
    }
  });

  return {
    finalMutasiKeluar: mutasiKeluarTotal,
    finalMutasiMasuk: mutasiMasukTotal,
    customCostItems,
    ...breakdown,
  };
}

/**
 * Update component progress in Samsat
 */
export function updateMessengerComponent(
  orderNo: string,
  componentId: string,
  updates: Partial<MessengerComponentProgress>,
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  // Validate waiting reason on component
  if (updates.status === "WAITING" && (!updates.waitingReason || !updates.waitingReason.trim())) {
    return {
      success: false,
      error: "Alasan menunggu wajib diisi saat mengubah status komponen ke Menunggu.",
    };
  }

  const currentMap = { ...(order.messengerComponentProgress || {}) };
  
  let resolvedName = updates.name;
  let resolvedCategory = updates.category;
  let resolvedMasterPrice = updates.masterPrice;
  if (!resolvedName) {
    const fromSamsat = order.samsatProcesses?.find((p) => p.id === componentId);
    if (fromSamsat) {
      resolvedName = fromSamsat.name;
      resolvedCategory = fromSamsat.category;
      resolvedMasterPrice = fromSamsat.basePrice;
    } else {
      const fromMaster = pricingStore.getMasterPricingItems().find((p) => p.id === componentId);
      if (fromMaster) {
        resolvedName = fromMaster.name;
        resolvedCategory = fromMaster.category;
      }
    }
  }

  const existingComp = currentMap[componentId] || {
    componentId,
    name: resolvedName || "Komponen Samsat",
    category: resolvedCategory,
    masterPrice: resolvedMasterPrice,
    nominal: resolvedMasterPrice || 0,
    actualOrderPrice: resolvedMasterPrice || 0,
    status: "NOT_STARTED",
  };

  const nowIso = new Date().toISOString();
  let estimatedCompletedAt = updates.estimatedCompletedAt || existingComp.estimatedCompletedAt;
  let startedAt = updates.startedAt || existingComp.startedAt;
  let completedAt = updates.completedAt || existingComp.completedAt;

  if (updates.status === "IN_PROGRESS" && !startedAt) {
    startedAt = nowIso;
  }

  if (updates.isCustomDuration && updates.customDurationDays && updates.customDurationDays > 0) {
    const customMinutes = updates.customDurationDays * 1440;
    updates.estimatedDurationMinutes = customMinutes;
    estimatedCompletedAt = calculateEstimatedCompletion(startedAt || nowIso, customMinutes);
  } else if (updates.estimatedDurationMinutes) {
    estimatedCompletedAt = calculateEstimatedCompletion(startedAt || nowIso, updates.estimatedDurationMinutes);
  }

  if (updates.status === "COMPLETED") {
    completedAt = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  currentMap[componentId] = {
    ...existingComp,
    ...updates,
    startedAt,
    completedAt,
    estimatedCompletedAt,
  };

  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: `Update Komponen: ${currentMap[componentId].name}`,
    note: `Status: ${currentMap[componentId].status}. ${updates.note || ""}`,
    author: user.userName,
    type: "COMPONENT_UPDATE",
  };

  const existingTimeline = order.messengerTimeline || [];
  const syncUpdates = calculateComponentSyncUpdates(currentMap);

  const success = orderStore.updateOrder(orderNo, {
    messengerComponentProgress: currentMap,
    messengerTimeline: [timelineEvent, ...existingTimeline],
    ...syncUpdates,
  });

  return { success, error: success ? undefined : "Gagal memperbarui progres komponen Samsat" };
}

/**
 * Upload component evidence
 */
export function uploadMessengerEvidence(
  orderNo: string,
  componentId: string,
  evidence: ComponentEvidence,
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  const currentMap = { ...(order.messengerComponentProgress || {}) };
  const existingComp = currentMap[componentId];
  if (!existingComp) {
    return { success: false, error: `Komponen ${componentId} tidak ditemukan` };
  }

  const existingEvidence = existingComp.evidence || [];
  currentMap[componentId] = {
    ...existingComp,
    evidence: [...existingEvidence, evidence],
  };

  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: new Date().toISOString(),
    title: `Upload Bukti: ${existingComp.name}`,
    note: `Bukti ${evidence.fileType} diunggah oleh ${user.userName}`,
    author: user.userName,
    type: "EVIDENCE_UPLOAD",
  };

  const existingTimeline = order.messengerTimeline || [];

  const success = orderStore.updateOrder(orderNo, {
    messengerComponentProgress: currentMap,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });

  return { success, error: success ? undefined : "Gagal menyimpan bukti komponen" };
}

/**
 * Complete delivery task (Stage 7 -> Stage 8)
 * Enforces mandatory handover proof
 */
export function completeMessengerDelivery(
  orderNo: string,
  handoverProof: DeliveryHandoverProof,
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  if (!handoverProof.recipientName || !handoverProof.recipientName.trim()) {
    return { success: false, error: "Nama penerima dokumen wajib diisi pada Bukti Serah Terima." };
  }

  if (!handoverProof.relationship || !handoverProof.relationship.trim()) {
    return { success: false, error: "Hubungan penerima dengan customer wajib diisi." };
  }

  const nowIso = new Date().toISOString();
  const dateStr = nowIso.split("T")[0];

  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: "Serah Terima Dokumen Selesai",
    note: `Dokumen diserahkan kepada ${handoverProof.recipientName} (${handoverProof.relationship}). Catatan: ${handoverProof.notes || "-"}`,
    author: user.userName,
    type: "DELIVERY",
  };

  const existingTimeline = order.messengerTimeline || [];

  // Complete delivery without premature advanceOrder (Admin confirms & advances to Stage 8)
  const success = orderStore.updateOrder(orderNo, {
    deliveryStatus: "Dokumen Diserahkan",
    isReceived: true,
    receiverName: handoverProof.recipientName,
    tanggalDiterima: dateStr,
    completedAt: nowIso,
    deliveryHandover: {
      ...handoverProof,
      completedAt: nowIso,
    },
    messengerTaskNotes: handoverProof.notes?.trim() || order.messengerTaskNotes,
    messengerTaskStatus: "Selesai",
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });

  if (success) {
    try {
      auditLog.log({
        userId: user.employeeId || "emp-messenger",
        userName: user.userName,
        userRole: toAuditRole(user.role),
        action: "UPDATE",
        module: "Messenger Workspace",
        details: `Serah terima dokumen order ${orderNo} diselesaikan oleh ${user.userName}. Penerima: ${handoverProof.recipientName}`,
        metadata: { orderNo, recipient: handoverProof.recipientName },
      });
    } catch {
      // safe fallback
    }
  }

  return { success, error: success ? undefined : "Gagal menyelesaikan pengantaran di store" };
}

/**
 * Reassign Task (Strictly gated to ADMIN and SVP)
 * Messengers CANNOT reassign tasks
 */
export function reassignMessengerTask(
  orderNo: string,
  newMessengerId: string,
  newMessengerName: string,
  reassigner: UserContext
): { success: boolean; error?: string } {
  // Gating: Only Admin / SVP can reassign
  if (reassigner.role === "messenger") {
    return {
      success: false,
      error: "Messenger tidak memiliki izin untuk mengalihkan (reassign) tugas. Silakan hubungi Administrator atau Supervisor.",
    };
  }

  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const oldMessenger = order.assignedMessengerName || order.messenger || "Belum Ditugaskan";
  const nowIso = new Date().toISOString();

  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: "Pengalihan Tugas (Reassign)",
    note: `Tugas dialihkan dari ${oldMessenger} ke ${newMessengerName} oleh ${reassigner.userName}`,
    author: reassigner.userName,
    type: "ASSIGNMENT",
  };

  const existingTimeline = order.messengerTimeline || [];

  const success = orderStore.updateOrder(orderNo, {
    assignedMessengerId: newMessengerId,
    assignedMessengerName: newMessengerName,
    messenger: newMessengerName,
    messengerPengantar: newMessengerName,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });

  if (success) {
    try {
      auditLog.log({
        userId: reassigner.employeeId || "admin",
        userName: reassigner.userName,
        userRole: toAuditRole(reassigner.role),
        action: "UPDATE",
        module: "Messenger Task Assignment",
        details: `Reassign tugas order ${orderNo} dari ${oldMessenger} ke ${newMessengerName}`,
        metadata: { orderNo, from: oldMessenger, to: newMessengerName },
      });
    } catch {
      // safe fallback
    }
  }

  return { success, error: success ? undefined : "Gagal memperbarui pengalihan tugas" };
}

// ==========================================
// Available Samsat Components (SSoT: Harga Dasar Samsat / pricingStore)
// ==========================================

export interface AvailableSamsatComponent {
  id: string;
  name: string;
  category: string;
  basePrice?: number;
  defaultNominal?: number;
}

/**
 * Returns master Samsat components directly from pricingStore (Harga Dasar Samsat)
 * Grouped into Mutasi Masuk, Mutasi Keluar, and Layanan Standar.
 */
export function getMasterSamsatComponents(samsatIdOrWilayah?: string): AvailableSamsatComponent[] {
  const samsatId = resolveSamsatId(samsatIdOrWilayah);
  const masterItems = pricingStore.getMasterPricingItems();
  return masterItems.map((item) => {
    const price = pricingStore.getSamsatPrice(samsatId, item.id);
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      basePrice: price,
      defaultNominal: price,
    };
  });
}

// Backwards-compatible export dynamic proxy from pricingStore
export const AVAILABLE_SAMSAT_COMPONENTS: AvailableSamsatComponent[] = pricingStore
  .getMasterPricingItems()
  .map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    basePrice: pricingStore.getSamsatPrice("samsat-cibinong", item.id),
    defaultNominal: pricingStore.getSamsatPrice("samsat-cibinong", item.id),
  }));

/**
 * Add a Samsat Component to an Order (Master Data or Custom)
 * Rule: Master components take reference price from Harga Dasar Samsat (masterPrice).
 * Custom components DO NOT alter master pricing, finance invoice, or client billing.
 */
export function addSamsatComponentToOrder(
  orderNo: string,
  component: {
    name: string;
    category?: string;
    isCustom?: boolean;
    note?: string;
    nominal?: number;
    addedManually?: boolean;
  },
  user: UserContext
): { success: boolean; error?: string; component?: MessengerComponentProgress } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  const cleanName = component.name.trim();
  if (!cleanName) {
    return { success: false, error: "Nama komponen wajib diisi." };
  }

  const currentMap = { ...(order.messengerComponentProgress || {}) };

  // Duplicate Check (Requirement #43 - Case Insensitive)
  const isDuplicate = Object.values(currentMap).some(
    (c) => c.name.toLowerCase().trim() === cleanName.toLowerCase()
  );
  if (isDuplicate) {
    return {
      success: false,
      error: `Komponen "${cleanName}" sudah ada pada proses Samsat order ini.`,
    };
  }

  const compId = component.isCustom
    ? `cust-${Date.now()}`
    : `comp-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;

  const nowIso = new Date().toISOString();
  const samsatId = resolveSamsatId(order.wilayahSamsatAsal);

  let masterPrice = 0;
  let category = component.category || (component.isCustom ? "Custom" : "Samsat");
  let resolvedName = cleanName;

  if (!component.isCustom) {
    const matchedMaster = pricingStore
      .getMasterPricingItems()
      .find((p) => p.name.toLowerCase() === cleanName.toLowerCase() || p.id === cleanName);

    if (matchedMaster) {
      resolvedName = matchedMaster.name;
      category = matchedMaster.category;
      masterPrice = pricingStore.getSamsatPrice(samsatId, matchedMaster.id);
    }
  }

  const actualOrderPrice = masterPrice; // initially equal to masterPrice

  const newComponent: MessengerComponentProgress = {
    componentId: compId,
    name: resolvedName,
    category,
    status: "NOT_STARTED",
    nominal: actualOrderPrice,
    masterPrice,
    actualOrderPrice,
    isCustom: !!component.isCustom,
    addedManually: true,
    createdBy: user.userName,
    createdAt: nowIso,
    note: component.note?.trim(),
  };

  currentMap[compId] = newComponent;

  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: component.isCustom ? `Tambah Tambahan Lapangan: ${resolvedName}` : `Tambah Komponen: ${resolvedName}`,
    note: component.note ? `Catatan: ${component.note}` : undefined,
    author: user.userName,
    type: "COMPONENT_UPDATE",
  };

  const existingTimeline = order.messengerTimeline || [];
  const syncUpdates = calculateComponentSyncUpdates(currentMap);

  const success = orderStore.updateOrder(orderNo, {
    messengerComponentProgress: currentMap,
    messengerTimeline: [timelineEvent, ...existingTimeline],
    ...syncUpdates,
  });

  if (success && component.isCustom) {
    try {
      auditLog.log({
        userId: user.employeeId || "emp-messenger",
        userName: user.userName,
        userRole: toAuditRole(user.role),
        action: "CREATE",
        module: "Samsat Component",
        details: `Custom component "${resolvedName}" ditambahkan oleh ${user.userName} pada order ${orderNo}`,
        metadata: { orderNo, componentId: compId, componentName: resolvedName },
      });
    } catch {}
  }

  return { success, error: success ? undefined : "Gagal menambahkan komponen ke order", component: newComponent };
}

/**
 * Update actual component price for a specific order in field (Edit Harga)
 * Only affects this specific order. Does NOT alter pricingStore or other orders.
 */
export function updateMessengerComponentPrice(
  orderNo: string,
  componentId: string,
  newActualPrice: number,
  user: UserContext,
  note?: string
): { success: boolean; error?: string; component?: MessengerComponentProgress } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  if (newActualPrice < 0 || isNaN(newActualPrice)) {
    return { success: false, error: "Harga aktual harus berupa nominal positif atau 0." };
  }

  const currentMap = { ...(order.messengerComponentProgress || {}) };
  const existingComp = currentMap[componentId];
  if (!existingComp) {
    return { success: false, error: `Komponen ${componentId} tidak ditemukan pada order ini.` };
  }

  const masterPrice = existingComp.masterPrice !== undefined ? existingComp.masterPrice : (existingComp.nominal || 0);
  const oldActualPrice = existingComp.actualOrderPrice !== undefined ? existingComp.actualOrderPrice : masterPrice;

  const nowIso = new Date().toISOString();
  const updatedComp: MessengerComponentProgress = {
    ...existingComp,
    masterPrice,
    actualOrderPrice: newActualPrice,
    nominal: newActualPrice,
    note: note ? (existingComp.note ? `${existingComp.note} | ${note}` : note) : existingComp.note,
  };

  currentMap[componentId] = updatedComp;

  const diff = newActualPrice - masterPrice;
  const diffStr = diff > 0
    ? `(+Rp ${diff.toLocaleString("id-ID")})`
    : diff < 0
    ? `(-Rp ${Math.abs(diff).toLocaleString("id-ID")})`
    : `(Sesuai Harga Dasar)`;

  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: `Edit Harga Aktual: ${existingComp.name}`,
    note: `Harga aktual diubah dari Rp ${oldActualPrice.toLocaleString("id-ID")} ke Rp ${newActualPrice.toLocaleString("id-ID")} ${diffStr}. ${note ? `Catatan: ${note}` : ""}`,
    author: user.userName,
    type: "COMPONENT_UPDATE",
  };

  const existingTimeline = order.messengerTimeline || [];
  const syncUpdates = calculateComponentSyncUpdates(currentMap);

  const success = orderStore.updateOrder(orderNo, {
    messengerComponentProgress: currentMap,
    messengerTimeline: [timelineEvent, ...existingTimeline],
    ...syncUpdates,
  });

  if (success) {
    try {
      auditLog.log({
        userId: user.employeeId || "emp-messenger",
        userName: user.userName,
        userRole: toAuditRole(user.role),
        action: "UPDATE",
        module: "Samsat Component Price",
        details: `Harga aktual komponen "${existingComp.name}" pada order ${orderNo} diubah menjadi Rp ${newActualPrice.toLocaleString("id-ID")} oleh ${user.userName}`,
        metadata: {
          orderNo,
          componentId,
          componentName: existingComp.name,
          masterPrice,
          oldActualPrice,
          newActualPrice,
        },
      });
    } catch {}
  }

  return { success, error: success ? undefined : "Gagal mengupdate harga komponen", component: updatedComp };
}

/**
 * Delete a Samsat Component from an Order
 */
export function deleteSamsatComponentFromOrder(
  orderNo: string,
  componentId: string,
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  const currentMap = { ...(order.messengerComponentProgress || {}) };
  const targetComp = currentMap[componentId];
  if (!targetComp) {
    return { success: false, error: `Komponen ${componentId} tidak ditemukan pada order ini.` };
  }

  const removedName = targetComp.name;
  delete currentMap[componentId];

  // Also remove from samsatProcesses if present
  let updatedSamsatProcesses = order.samsatProcesses;
  if (updatedSamsatProcesses && updatedSamsatProcesses.some((p) => p.id === componentId)) {
    updatedSamsatProcesses = updatedSamsatProcesses.filter((p) => p.id !== componentId);
  }

  const nowIso = new Date().toISOString();
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: `Hapus Komponen: ${removedName}`,
    note: `Komponen dihapus dari proses Samsat oleh ${user.userName}`,
    author: user.userName,
    type: "COMPONENT_UPDATE",
  };

  const existingTimeline = order.messengerTimeline || [];
  const syncUpdates = calculateComponentSyncUpdates(currentMap);

  const success = orderStore.updateOrder(orderNo, {
    messengerComponentProgress: currentMap,
    samsatProcesses: updatedSamsatProcesses,
    messengerTimeline: [timelineEvent, ...existingTimeline],
    ...syncUpdates,
  });

  if (success) {
    try {
      auditLog.log({
        userId: user.employeeId || "emp-messenger",
        userName: user.userName,
        userRole: toAuditRole(user.role),
        action: "DELETE",
        module: "Samsat Component",
        details: `Komponen "${removedName}" dihapus oleh ${user.userName} pada order ${orderNo}`,
        metadata: { orderNo, componentId, componentName: removedName },
      });
    } catch {}
  }

  return { success, error: success ? undefined : "Gagal menghapus komponen dari order" };
}

/**
 * Complete document pickup (Jemput Dokumen)
 * Allows optional photo proof and notes
 */
export function completeMessengerPickup(
  orderNo: string,
  evidence: {
    photoProofUrl?: string;
    notes?: string;
    catatanKendala?: string;
    pickupChecklist?: Record<string, boolean>;
    documentChecklist?: any;
  },
  user: UserContext
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  const nowIso = new Date().toISOString();
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: "Penjemputan Dokumen Selesai",
    note: evidence.notes ? `Catatan: ${evidence.notes}` : "Dokumen fisik berhasil diambil dari klien",
    author: user.userName,
    type: "STATUS_CHANGE",
  };

  const existingTimeline = order.messengerTimeline || [];

  // Update order status to "Dokumen Sudah Tersedia" without premature advanceOrder
  const success = orderStore.updateOrder(orderNo, {
    pickupCompleted: true,
    pickupCompletedAt: nowIso,
    messengerTaskStatus: "Dokumen Sudah Tersedia",
    completedAt: nowIso,
    pickupChecklist: evidence.pickupChecklist || order.pickupChecklist,
    catatanKendala: evidence.catatanKendala || order.catatanKendala,
    pickupProof: {
      photoProofUrl: evidence.photoProofUrl,
      notes: evidence.notes,
      catatanKendala: evidence.catatanKendala || order.catatanKendala,
      pickupChecklist: evidence.pickupChecklist || order.pickupChecklist,
      completedAt: nowIso,
    },
    messengerTaskNotes: evidence.catatanKendala || evidence.notes?.trim() || order.messengerTaskNotes,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });

  if (success) {
    try {
      auditLog.log({
        userId: user.employeeId || "emp-messenger",
        userName: user.userName,
        userRole: toAuditRole(user.role),
        action: "UPDATE",
        module: "Messenger Workspace",
        details: `Penjemputan berkas fisik order ${orderNo} diselesaikan oleh ${user.userName}`,
        metadata: { orderNo },
      });
    } catch {
      // safe fallback
    }
  }

  return { success, error: success ? undefined : "Gagal memperbarui status penjemputan" };
}

/**
 * Complete Samsat Process (Kirim Hasil)
 * Transitions Samsat stage when all components are completed
 */
export function completeSamsatProcess(
  orderNo: string,
  user: UserContext,
  note?: string
): { success: boolean; error?: string } {
  const order = orderStore.getOrderByNo(orderNo);
  if (!order) {
    return { success: false, error: `Order ${orderNo} tidak ditemukan` };
  }

  const authCheck = checkTaskOwnership(order, user);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  const nowIso = new Date().toISOString();
  const timelineEvent: MessengerTimelineEvent = {
    id: `tl-${Date.now()}`,
    timestamp: nowIso,
    title: "Proses Samsat Selesai (Kirim Hasil)",
    note: note || "Seluruh tahapan komponen pengurusan di loket Samsat telah selesai diproses.",
    author: user.userName,
    type: "STATUS_CHANGE",
  };

  const existingTimeline = order.messengerTimeline || [];

  // Update samsat status to "Selesai" and setup samsatPickupStatus without premature advanceOrder
  const success = orderStore.updateOrder(orderNo, {
    samsatStatus: "Selesai",
    samsatCompletedAt: nowIso,
    samsatPickupStatus: order.samsatPickupStatus || "Belum Dijadwal Jemput Samsat",
    messengerTaskNotes: note?.trim() || order.messengerTaskNotes,
    messengerTimeline: [timelineEvent, ...existingTimeline],
  });

  if (success) {
    try {
      auditLog.log({
        userId: user.employeeId || "emp-messenger",
        userName: user.userName,
        userRole: toAuditRole(user.role),
        action: "UPDATE",
        module: "Proses Samsat",
        details: `Pengurusan Samsat untuk order ${orderNo} dinyatakan selesai oleh ${user.userName}`,
        metadata: { orderNo },
      });
    } catch {}
  }

  return { success, error: success ? undefined : "Gagal menyelesaikan pengurusan Samsat" };
}

