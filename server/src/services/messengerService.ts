/**
 * Messenger Domain Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { dbMessengerRepository } from "../repositories/dbMessengerRepository";
import { dbOrderRepository } from "../repositories/dbOrderRepository";
import { dbFinanceRepository } from "../repositories/dbFinanceRepository";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { dbUserRepository } from "../repositories/dbUserRepository";
import { db, runInTransaction } from "../database/db";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../utils/crypto";
import {
  ReimbursementRequest,
  MessengerHistoryItem,
  MessengerTaskType,
  ReimbursementCategory,
} from "../../../src/domain/messenger/types";
import { OperationalOrder } from "../../../src/domain/order/types";
import { INITIAL_KARYAWAN } from "../../../src/app/data/karyawanPenggunaAdapter";
import { normalizeReimbursementPayload } from "../utils/aliasNormalizer";

export interface MessengerSummaryStats {
  employeeId: string;
  name: string;
  phone: string;
  wilayah: string;
  status: string;
  completedTasksCount: number;
  lastCompletedDate?: string;
  totalDiajukan: number;
  totalDisetujui: number;
  totalDibayar: number;
  totalMenunggu: number;
  totalDisetujuiBelumDibayar: number;
  totalDitolak: number;
}

export interface TaskDetailResponse {
  task: {
    id: string;
    orderNo: string;
    taskType: MessengerTaskType;
    messenger: string;
    messengerEmployeeId?: string;
    customer: string;
    phone: string;
    nopol: string;
    jenisKendaraan: string;
    layanan: string;
    wilayah: string;
    status: string;
    assignedAt?: string;
    startedAt?: string;
    completedAt: string;
    totalTagihan: number;
    terbayar: number;
    statusBayar: string;
    receiverName?: string;
    relationship?: string;
    notes?: string;
    photoProofUrl?: string;
    rawOrder: OperationalOrder;
  };
  timeline: Array<{
    id: string;
    timestamp: string;
    title: string;
    author: string;
    role?: string;
    type: "ASSIGNMENT" | "PROCESS" | "EVIDENCE" | "REIMBURSEMENT" | "COMPLETION" | "SYSTEM";
    details?: string;
    amount?: number;
    statusBadge?: string;
  }>;
  attachments: Array<{
    id: string;
    name: string;
    type: "PICKUP_PROOF" | "SAMSAT_EVIDENCE" | "DELIVERY_HANDOVER" | "REIMBURSEMENT_RECEIPT" | "OTHER";
    url: string;
    uploadedAt: string;
    uploadedBy: string;
    category?: string;
  }>;
  reimbursements: {
    summary: {
      totalDiajukan: number;
      totalDisetujui: number;
      totalDitolak: number;
      totalDibayar: number;
      totalMenunggu: number;
      totalDisetujuiBelumDibayar: number;
    };
    items: ReimbursementRequest[];
  };
}

export class MessengerService {
  /**
   * Get all messengers with complete stats and expense aggregates
   */
  public getMessengersWithStats(dateFrom?: string, dateTo?: string): MessengerSummaryStats[] {
    // 1. Gather all unique messenger identities from INITIAL_KARYAWAN and users table
    const allUsers = dbUserRepository.getAll();
    const messengerUsers = allUsers.filter(
      (u) => u.jabatan.toUpperCase() === "MESSENGER" || (u as any).role === "messenger"
    );

    const messengerMap = new Map<string, MessengerSummaryStats>();

    // From INITIAL_KARYAWAN
    const messengerEmployees = INITIAL_KARYAWAN.filter((k) => k.jabatan === "MESSENGER");
    for (const emp of messengerEmployees) {
      messengerMap.set(emp.nama.toLowerCase(), {
        employeeId: emp.id,
        name: emp.nama,
        phone: emp.noHp,
        wilayah: emp.wilayah,
        status: emp.status,
        completedTasksCount: 0,
        totalDiajukan: 0,
        totalDisetujui: 0,
        totalDibayar: 0,
        totalMenunggu: 0,
        totalDisetujuiBelumDibayar: 0,
        totalDitolak: 0,
      });
    }

    // Merge from users
    for (const u of messengerUsers) {
      const key = u.nama.toLowerCase();
      if (!messengerMap.has(key)) {
        messengerMap.set(key, {
          employeeId: `USR-${u.id}`,
          name: u.nama,
          phone: "081299887766",
          wilayah: "Jakarta",
          status: u.status,
          completedTasksCount: 0,
          totalDiajukan: 0,
          totalDisetujui: 0,
          totalDibayar: 0,
          totalMenunggu: 0,
          totalDisetujuiBelumDibayar: 0,
          totalDitolak: 0,
        });
      }
    }

    // 2. Fetch all completed tasks from orders
    const history = this.getAllCompletedTasksInternal();

    // 3. Filter tasks by date range if specified
    const filteredHistory = history.filter((item) => {
      if (!item.completedAt) return true;
      const compDate = item.completedAt.split("T")[0];
      if (dateFrom && compDate < dateFrom) return false;
      if (dateTo && compDate > dateTo) return false;
      return true;
    });

    // Populate completed tasks counts
    for (const item of filteredHistory) {
      const key = item.messenger.toLowerCase();
      const existing = messengerMap.get(key);
      if (existing) {
        existing.completedTasksCount++;
        if (!existing.lastCompletedDate || item.completedAt > existing.lastCompletedDate) {
          existing.lastCompletedDate = item.completedAt;
        }
      }
    }

    // 4. Fetch all reimbursements and calculate non-overlapping aggregates
    const allReimbs = dbMessengerRepository.getAllReimbursements();
    for (const r of allReimbs) {
      if (r.date) {
        if (dateFrom && r.date < dateFrom) continue;
        if (dateTo && r.date > dateTo) continue;
      }

      const key = r.messengerName.toLowerCase();
      let stat = messengerMap.get(key);
      if (!stat) {
        for (const s of messengerMap.values()) {
          if (s.employeeId === r.employeeId) {
            stat = s;
            break;
          }
        }
      }

      if (stat) {
        stat.totalDiajukan += r.amount;
        const approved = r.approvedAmount !== undefined ? r.approvedAmount : (r.status === "Disetujui" || r.status === "Dibayar" ? r.amount : 0);
        const rejected = r.status === "Ditolak" ? r.amount : (r.rejectedAmount || 0);

        stat.totalDisetujui += approved;
        stat.totalDitolak += rejected;

        if (r.status === "Dibayar") {
          stat.totalDibayar += approved;
        } else if (r.status === "Disetujui") {
          stat.totalDisetujuiBelumDibayar += approved;
        } else if (r.status === "Diajukan" || r.status === "Sedang Ditinjau") {
          stat.totalMenunggu += r.amount;
        }
      }
    }

    return Array.from(messengerMap.values());
  }

  /**
   * Get filtered messenger task history
   */
  public getMessengerTaskHistory(filters?: {
    messenger?: string;
    employeeId?: string;
    taskType?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Array<MessengerHistoryItem & {
    reimbursementSummary: {
      totalDiajukan: number;
      totalDisetujui: number;
      totalDibayar: number;
      totalMenunggu: number;
    };
  }> {
    let tasks = this.getAllCompletedTasksInternal();

    // Filter by messenger name or employeeId
    if (filters?.employeeId && filters?.messenger && filters.messenger !== "all") {
      const target = filters.messenger.toLowerCase();
      const empId = filters.employeeId.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          (t.messengerEmployeeId && t.messengerEmployeeId.toLowerCase() === empId) ||
          (t.messenger && t.messenger.toLowerCase().includes(target))
      );
    } else {
      if (filters?.messenger && filters.messenger !== "all") {
        const target = filters.messenger.toLowerCase();
        tasks = tasks.filter((t) => t.messenger.toLowerCase().includes(target));
      }
      if (filters?.employeeId) {
        const empId = filters.employeeId.toLowerCase();
        tasks = tasks.filter((t) => t.messengerEmployeeId?.toLowerCase() === empId);
      }
    }
    if (filters?.taskType && filters.taskType !== "all") {
      tasks = tasks.filter((t) => t.taskType === filters.taskType);
    }
    if (filters?.dateFrom) {
      tasks = tasks.filter((t) => (t.completedAt ? t.completedAt.split("T")[0] >= filters.dateFrom! : true));
    }
    if (filters?.dateTo) {
      tasks = tasks.filter((t) => (t.completedAt ? t.completedAt.split("T")[0] <= filters.dateTo! : true));
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.orderNo.toLowerCase().includes(q) ||
          t.customer.toLowerCase().includes(q) ||
          t.nopol.toLowerCase().includes(q) ||
          t.layanan.toLowerCase().includes(q) ||
          t.messenger.toLowerCase().includes(q)
      );
    }

    // Attach reimbursement summaries per task
    const allReimbs = dbMessengerRepository.getAllReimbursements();

    return tasks.map((task) => {
      const taskReimbs = allReimbs.filter((r) => r.orderNo === task.orderNo);
      let totalDiajukan = 0;
      let totalDisetujui = 0;
      let totalDibayar = 0;
      let totalMenunggu = 0;

      for (const r of taskReimbs) {
        totalDiajukan += r.amount;
        const approved = r.approvedAmount !== undefined ? r.approvedAmount : (r.status === "Disetujui" || r.status === "Dibayar" ? r.amount : 0);
        totalDisetujui += approved;
        if (r.status === "Dibayar") {
          totalDibayar += approved;
        } else if (r.status === "Diajukan" || r.status === "Sedang Ditinjau") {
          totalMenunggu += r.amount;
        }
      }

      return {
        ...task,
        reimbursementSummary: {
          totalDiajukan,
          totalDisetujui,
          totalDibayar,
          totalMenunggu,
        },
      };
    });
  }

  /**
   * Get complete detail of a specific task including chronology, attachments, and expense submissions
   */
  public getTaskDetail(orderNo: string, taskType?: string): TaskDetailResponse {
    const allTasks = this.getAllCompletedTasksInternal();
    const task = allTasks.find(
      (t) => t.orderNo === orderNo && (!taskType || t.taskType === taskType)
    ) || allTasks.find((t) => t.orderNo === orderNo);

    if (!task) {
      // Look up raw order
      const rawOrder = dbOrderRepository.getByOrderNo(orderNo);
      if (!rawOrder) {
        throw new ApiError(404, "TASK_NOT_FOUND", `Tugas atau order '${orderNo}' tidak ditemukan.`);
      }
      return this.buildTaskDetailFromOrder(rawOrder, (taskType as MessengerTaskType) || "Proses Samsat");
    }

    return this.buildTaskDetailFromItem(task);
  }

  /**
   * Get all reimbursements with optional filters
   */
  public getAllReimbursements(filters?: {
    employeeId?: string;
    messengerName?: string;
    orderNo?: string;
    status?: string;
  }): ReimbursementRequest[] {
    if (filters?.employeeId || filters?.messengerName) {
      const all = dbMessengerRepository.getAllReimbursements({
        orderNo: filters.orderNo,
        status: filters.status,
      });

      const targetEmpId = filters.employeeId?.toLowerCase();
      const targetName = filters.messengerName?.toLowerCase();
      const resolvedEmpId = filters.messengerName ? this.resolveMessengerEmpId(filters.messengerName).toLowerCase() : undefined;

      return all.filter((r) => {
        const rEmpId = r.employeeId?.toLowerCase();
        const rName = r.messengerName?.toLowerCase();
        return (
          (targetEmpId && rEmpId === targetEmpId) ||
          (resolvedEmpId && rEmpId === resolvedEmpId) ||
          (targetName && rName === targetName)
        );
      });
    }

    return dbMessengerRepository.getAllReimbursements(filters);
  }

  /**
   * Submit new reimbursement
   */
  public createReimbursement(
    data: Omit<ReimbursementRequest, "id" | "status" | "submittedAt">,
    user?: TokenPayload | null
  ): ReimbursementRequest {
    normalizeReimbursementPayload(data as any);
    if (!data.employeeId || !data.messengerName || !data.category || !data.amount || !data.date) {
      throw new ApiError(400, "VALIDATION_ERROR", "Data pengajuan biaya belum lengkap (kategori, nominal, tanggal wajib diisi).");
    }
    if (data.amount <= 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nominal pengajuan harus lebih besar dari 0.");
    }

    // Referential integrity check: order_no if provided must exist
    const rawOrderNo = data.orderNo?.trim();
    if (rawOrderNo && rawOrderNo !== "-") {
      const existingOrder = dbOrderRepository.getByOrderNo(rawOrderNo);
      if (!existingOrder) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${rawOrderNo}' tidak ditemukan.`);
      }
    }

    // Referential integrity check: employee/messenger must exist in users or system adapter
    const rawEmpId = data.employeeId.trim();
    const userStmt = db.prepare("SELECT id, nama FROM users WHERE id = ? OR employee_id = ? OR nama = ?");
    const numericId = Number(rawEmpId.replace(/^usr-/i, ""));
    const matchedUser = userStmt.get(
      isNaN(numericId) ? -1 : numericId,
      rawEmpId,
      data.messengerName.trim()
    ) as any;

    const matchedAdapter = !matchedUser ? INITIAL_KARYAWAN.find(
      (k) => k.id === rawEmpId || (k as any).employeeId === rawEmpId || k.nama.toLowerCase() === data.messengerName.toLowerCase()
    ) : null;

    if (!matchedUser && !matchedAdapter) {
      throw new ApiError(404, "USER_NOT_FOUND", `Pegawai/Kurir '${data.messengerName}' (ID: ${data.employeeId}) tidak terdaftar dalam sistem.`);
    }

    return runInTransaction(() => {
      const id = dbMessengerRepository.getNextReimbursementId();
      const newReimb: ReimbursementRequest = {
        ...data,
        orderNo: rawOrderNo && rawOrderNo !== "-" ? rawOrderNo : undefined,
        id,
        status: "Diajukan",
        submittedAt: new Date().toISOString(),
      };

      dbMessengerRepository.createReimbursement(newReimb);

      // Record audit log
      dbAuditRepository.save({
        id: `audit-reimb-create-${Date.now()}`,
        userId: user?.userId || data.employeeId,
        userName: user?.nama || data.messengerName,
        userRole: (user?.role as any) || "messenger",
        action: "CREATE",
        module: "Reimbursement",
        details: `Pengajuan biaya ${newReimb.category} sebesar Rp ${newReimb.amount.toLocaleString("id-ID")}${newReimb.orderNo ? ` (Order ${newReimb.orderNo})` : ""}`,
        metadata: { reimbursementId: id, amount: newReimb.amount, orderNo: newReimb.orderNo },
        createdAt: new Date().toISOString(),
      });

      return newReimb;
    });
  }

  /**
   * Review reimbursement (Approve / Reject)
   */
  public reviewReimbursement(
    id: string,
    decision: "Disetujui" | "Ditolak" | "Sedang Ditinjau",
    user: TokenPayload,
    reviewNotes?: string,
    approvedAmount?: number,
    rejectedAmount?: number
  ): ReimbursementRequest {
    if (user.role === "messenger") {
      throw new ApiError(403, "FORBIDDEN", "Messenger tidak memiliki hak untuk menyetujui pengajuan biaya.");
    }

    const existing = dbMessengerRepository.getReimbursementById(id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Pengajuan biaya '${id}' tidak ditemukan.`);
    }

    if (existing.status === "Dibayar") {
      throw new ApiError(400, "INVALID_STATE", "Pengajuan biaya sudah dicairkan/dibayar dan tidak dapat diubah lagi.");
    }

    if (existing.status === "Disetujui" && decision === "Disetujui") {
      throw new ApiError(400, "ALREADY_APPROVED", "Pengajuan biaya ini sudah disetujui sebelumnya.");
    }

    if (existing.status === "Ditolak" && decision === "Ditolak") {
      throw new ApiError(400, "ALREADY_REJECTED", "Pengajuan biaya ini sudah ditolak sebelumnya.");
    }

    const finalApproved = approvedAmount !== undefined ? approvedAmount : (decision === "Disetujui" ? existing.amount : 0);
    const finalRejected = rejectedAmount !== undefined ? rejectedAmount : (decision === "Ditolak" ? existing.amount : (existing.amount - finalApproved));

    const updates: Partial<ReimbursementRequest> = {
      status: decision,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user.nama,
      reviewNotes: reviewNotes || undefined,
      approvedAmount: finalApproved,
      rejectedAmount: finalRejected,
    };

    dbMessengerRepository.updateReimbursement(id, updates);

    dbAuditRepository.save({
      id: `audit-reimb-review-${Date.now()}`,
      userId: user.userId,
      userName: user.nama,
      userRole: user.role as any,
      action: "UPDATE",
      module: "Reimbursement Review",
      details: `Pengajuan biaya ${id} (${existing.messengerName}) diubah status menjadi ${decision}${finalApproved > 0 ? ` (Disetujui Rp ${finalApproved.toLocaleString("id-ID")})` : ""}`,
      metadata: { id, decision, approvedAmount: finalApproved, rejectedAmount: finalRejected },
      createdAt: new Date().toISOString(),
    });

    return { ...existing, ...updates };
  }

  /**
   * Pay / Realize reimbursement (disburses operational cash outflow into Kas Messenger)
   */
  public payReimbursement(
    id: string,
    user: TokenPayload,
    paymentDetails?: { paymentMethod?: string; transactionRef?: string; channel?: string }
  ): ReimbursementRequest {
    if (user.role === "messenger") {
      throw new ApiError(403, "FORBIDDEN", "Messenger tidak memiliki hak untuk merealisasikan pembayaran.");
    }

    const existing = dbMessengerRepository.getReimbursementById(id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Pengajuan biaya '${id}' tidak ditemukan.`);
    }

    if (existing.status === "Dibayar") {
      throw new ApiError(400, "ALREADY_PAID", `Pengajuan biaya '${id}' sudah dibayarkan sebelumnya.`);
    }

    return runInTransaction(() => {
      const nowStr = new Date().toISOString().split("T")[0];
      const nowIso = new Date().toISOString();
      const amountToPay = existing.approvedAmount !== undefined && existing.approvedAmount > 0
        ? existing.approvedAmount
        : existing.amount;

      // Idempotency check: verify this reimbursement has not already been disbursed into kas_messenger
      const existingKasCheck = db.prepare("SELECT id FROM kas_messenger WHERE reimbursement_id = ?").get(id) as any;
      if (existingKasCheck) {
        throw new ApiError(400, "ALREADY_DISBURSED", `Pengajuan reimbursement '${id}' sudah dicairkan pada transaksi Kas Messenger #${existingKasCheck.id}.`);
      }

      // 1. Create real cash outflow in Kas Messenger
      const kasMessengerItem = dbFinanceRepository.addKasMessenger({
        tanggal: nowStr,
        jenis: "Operasional",
        messenger: existing.messengerName,
        keterangan: `Reimbursement ${existing.category}: ${existing.note || existing.category}${existing.orderNo ? ` (${existing.orderNo})` : ""} [Ref: ${id}]`,
        in: 0,
        out: amountToPay,
        penanggungJawab: user.nama,
        orderNo: existing.orderNo || undefined,
        reimbursementId: id,
        receiptUrl: existing.receiptUrl || undefined,
        kategori: existing.category,
      });

      // QC-02 Fix: Double-entry balanced bookkeeping. Deduct cash from Kas Kantor (Kredit)
      const isOfficeCash = !paymentDetails?.channel || paymentDetails?.channel.toLowerCase().includes("kantor") || paymentDetails?.paymentMethod?.toLowerCase().includes("tunai") || paymentDetails?.paymentMethod?.toLowerCase().includes("kas");
      if (isOfficeCash) {
        dbFinanceRepository.addKasKantor({
          tanggal: nowStr,
          keterangan: `[KAS KELUAR] Pencairan Reimbursement Kurir: ${existing.messengerName} (${existing.category}) [Ref: ${id}]`,
          status: "Kredit",
          debit: 0,
          kredit: amountToPay,
          penanggungJawab: user.nama,
          orderNo: existing.orderNo || undefined,
        });
      }

      // 2. Update reimbursement record
      const updates: Partial<ReimbursementRequest> = {
        status: "Dibayar",
        paidAt: nowIso,
        paidBy: user.nama,
        paymentMethod: paymentDetails?.paymentMethod || "Kas Messenger (Tunai)",
        transactionRef: paymentDetails?.transactionRef || `TRX-REIMB-${id}`,
        kasMessengerId: kasMessengerItem.id,
        channel: paymentDetails?.channel || "Kas Messenger",
      };

      dbMessengerRepository.updateReimbursement(id, updates);

      // 3. Record audit log
      dbAuditRepository.save({
        id: `audit-reimb-pay-${Date.now()}`,
        userId: user.userId,
        userName: user.nama,
        userRole: user.role as any,
        action: "UPDATE",
        module: "Reimbursement Payout",
        details: `Pencairan reimbursement ${id} sebesar Rp ${amountToPay.toLocaleString("id-ID")} kepada ${existing.messengerName} dicatat pada Kas Messenger #${kasMessengerItem.id}`,
        metadata: { id, amount: amountToPay, kasMessengerId: kasMessengerItem.id, channel: updates.channel },
        createdAt: nowIso,
      });

      return { ...existing, ...updates };
    });
  }

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================

  private getAllCompletedTasksInternal(): MessengerHistoryItem[] {
    const active = dbOrderRepository.getAllFlat(false);
    const archived = dbOrderRepository.getAllFlat(true);

    const allOrdersMap = new Map<string, OperationalOrder>();
    for (const ord of [...active, ...archived]) {
      if (ord?.orderNo) allOrdersMap.set(ord.orderNo, ord);
    }

    const allOrders = Array.from(allOrdersMap.values());
    const history: MessengerHistoryItem[] = [];
    const seenIds = new Set<string>();

    for (const order of allOrders) {
      const tagihan = order.payment?.totalBiaya || order.costSnapshot?.totalBiayaJasa || 1500000;
      const terbayar = order.payment?.dibayar || (order.payment?.statusPembayaran === "Lunas" ? tagihan : 0);
      const statusBayar = order.payment?.statusPembayaran || (terbayar >= tagihan ? "Lunas" : "Belum Lunas");

      // 1. Jemput Dokumen
      const hasMessengerForPickup = Boolean(order.messenger || (order as any).assignedMessengerName);
      const isPickupDone =
        order.metodeLayanan !== "Datang Langsung" &&
        hasMessengerForPickup &&
        ((order as any).pickupCompleted ||
          order.messengerTaskStatus === "Dokumen Sudah Tersedia" ||
          order.currentStep >= 3 ||
          Boolean((order as any).pickupCompletedAt) ||
          Boolean(order.pickupProof?.photoProofUrl));

      if (isPickupDone) {
        const histId = `HIST-${order.orderNo}-PICKUP`;
        if (!seenIds.has(histId)) {
          seenIds.add(histId);
          const mName = (order as any).assignedMessengerName || order.messenger || "Kurir Penjemput";
          history.push({
            id: histId,
            orderNo: order.orderNo,
            taskType: "Jemput Dokumen",
            messenger: mName,
            messengerEmployeeId: (order as any).assignedMessengerId || this.resolveMessengerEmpId(mName),
            customer: order.customer,
            phone: order.nomorHP || "-",
            nopol: order.nopol || "-",
            jenisKendaraan: order.jenisKendaraan || "-",
            layanan: order.layanan,
            wilayah: (order as any).alamatPenjemputan?.kota || order.wilayahSamsatAsal || "Wilayah Klien",
            completedAt: (order as any).pickupCompletedAt || order.pickupProof?.completedAt || (order as any).tanggalJemput || order.createdAt,
            totalTagihan: tagihan,
            terbayar,
            statusBayar,
            status: "Selesai",
            keterangan: order.pickupProof?.notes || (order as any).catatanPenjadwalan || order.messengerTaskNotes || "Dokumen berkas berhasil dijemput dari klien",
            photoProofUrl: order.pickupProof?.photoProofUrl,
            rawOrder: order,
          });
        }
      }

      // 2. Samsat Process
      const hasMessengerForSamsat = Boolean((order as any).samsatMessenger || (order as any).samsatMessengerNama || order.messenger);
      const isSamsatDone =
        hasMessengerForSamsat &&
        ((order as any).samsatStatus === "Selesai" ||
          Boolean((order as any).samsatCompletedAt) ||
          order.currentStep >= 5 ||
          Boolean((order as any).samsatPickupProof?.photoProofUrl) ||
          Boolean((order as any).samsatPickupCompletedAt));

      if (isSamsatDone) {
        const histId = `HIST-${order.orderNo}-SAMSAT`;
        if (!seenIds.has(histId)) {
          seenIds.add(histId);
          const mName = (order as any).samsatMessenger || (order as any).samsatMessengerNama || (order as any).assignedMessengerName || order.messenger || "Kurir Samsat";
          history.push({
            id: histId,
            orderNo: order.orderNo,
            taskType: "Proses Samsat",
            messenger: mName,
            messengerEmployeeId: (order as any).samsatMessengerId || this.resolveMessengerEmpId(mName),
            customer: order.customer,
            phone: order.nomorHP || "-",
            nopol: order.nopol || "-",
            jenisKendaraan: order.jenisKendaraan || "-",
            layanan: order.layanan,
            wilayah: order.wilayahSamsatAsal ? (order.wilayahSamsatAsal.toLowerCase().includes("samsat") ? order.wilayahSamsatAsal : `Samsat ${order.wilayahSamsatAsal}`) : "Samsat",
            completedAt: (order as any).samsatCompletedAt || (order as any).tanggalProsesSamsat || order.createdAt,
            totalTagihan: tagihan,
            terbayar,
            statusBayar,
            status: "Selesai",
            keterangan: (order as any).catatanSamsat || (order as any).samsatPickupNotes || "Pengurusan berkas loket Samsat telah diselesaikan",
            photoProofUrl: (order as any).samsatPickupProof?.photoProofUrl,
            rawOrder: order,
          });
        }
      }

      // 3. Pengantaran Dokumen
      const hasMessengerForDelivery = Boolean((order as any).messengerPengantar || (order as any).assignedMessengerName || order.messenger);
      const isDeliveryDone =
        (order as any).metodePengantaran !== "Ambil di Kantor" &&
        hasMessengerForDelivery &&
        ((order as any).deliveryStatus === "Dokumen Diserahkan" ||
          (order as any).isReceived ||
          order.currentStep >= 8 ||
          Boolean(order.deliveryHandover?.completedAt) ||
          Boolean(order.deliveryHandover?.photoProofUrl) ||
          Boolean((order as any).tanggalDiterima));

      if (isDeliveryDone) {
        const histId = `HIST-${order.orderNo}-DELIVERY`;
        if (!seenIds.has(histId)) {
          seenIds.add(histId);
          const mName = (order as any).messengerPengantar || (order as any).assignedMessengerName || order.messenger || "Kurir Pengantar";
          history.push({
            id: histId,
            orderNo: order.orderNo,
            taskType: "Pengantaran Dokumen",
            messenger: mName,
            messengerEmployeeId: (order as any).deliveryMessengerId || this.resolveMessengerEmpId(mName),
            customer: order.customer,
            phone: order.nomorHP || "-",
            nopol: order.nopol || "-",
            jenisKendaraan: order.jenisKendaraan || "-",
            layanan: order.layanan,
            wilayah: (order as any).alamatPengantaran?.kota || order.wilayahSamsatAsal || "Alamat Klien",
            completedAt: (order as any).tanggalDiterima || order.deliveryHandover?.completedAt || (order as any).completedAt || (order as any).tanggalPengantaran || order.createdAt,
            totalTagihan: tagihan,
            terbayar,
            statusBayar,
            status: "Selesai",
            receiverName: order.deliveryHandover?.recipientName || (order as any).receiverName || order.customer,
            relationship: order.deliveryHandover?.relationship || "Pemilik Langsung",
            keterangan: order.deliveryHandover?.notes || (order as any).catatanPengantaran || order.messengerTaskNotes || "Dokumen hasil berhasil diserahkan ke klien",
            photoProofUrl: order.deliveryHandover?.photoProofUrl,
            rawOrder: order,
          });
        }
      }
    }

    return history.sort((a, b) => {
      const timeA = new Date(a.completedAt).getTime() || 0;
      const timeB = new Date(b.completedAt).getTime() || 0;
      return timeB - timeA;
    });
  }

  public resolveMessengerEmpId(name: string): string {
    const found = INITIAL_KARYAWAN.find((k) => k.nama.toLowerCase() === name.toLowerCase());
    return found ? found.id : "EMP-MSG-001";
  }

  private buildTaskDetailFromItem(item: MessengerHistoryItem): TaskDetailResponse {
    const rawOrder = item.rawOrder;
    const orderNo = item.orderNo;

    // 1. Compile chronological timeline events based on actual recorded events
    const timeline: TaskDetailResponse["timeline"] = [];

    if (rawOrder.createdAt) {
      timeline.push({
        id: `tl-${orderNo}-created`,
        timestamp: rawOrder.createdAt,
        title: "Tugas & Order Dibuat",
        author: "Admin Kantor",
        role: "admin",
        type: "SYSTEM",
        details: `Pendaftaran order ${orderNo} (${item.layanan}) berhasil dicatat ke sistem.`,
      });
    }

    if ((rawOrder as any).tanggalPenjadwalan || (rawOrder as any).scheduledDate) {
      timeline.push({
        id: `tl-${orderNo}-assigned`,
        timestamp: (rawOrder as any).tanggalPenjadwalan || (rawOrder as any).scheduledDate || rawOrder.createdAt,
        title: "Tugas Diberikan kepada Messenger",
        author: "Admin Operasional",
        role: "admin",
        type: "ASSIGNMENT",
        details: `Penugasan pekerjaan ${item.taskType} kepada kurir ${item.messenger} (${item.messengerEmployeeId || "Kurir"}).`,
      });
    }

    if ((rawOrder as any).startedAt || (rawOrder as any).tanggalJemput) {
      timeline.push({
        id: `tl-${orderNo}-started`,
        timestamp: (rawOrder as any).startedAt || (rawOrder as any).tanggalJemput || rawOrder.createdAt,
        title: "Messenger Mulai Menangani Tugas",
        author: item.messenger,
        role: "messenger",
        type: "PROCESS",
        details: `Kurir memulai perjalanan menuju lokasi (${item.wilayah}).`,
      });
    }

    // Component updates if available
    if (rawOrder.componentProgress && Array.isArray(rawOrder.componentProgress)) {
      rawOrder.componentProgress.forEach((cp, idx) => {
        if (cp.completedAt) {
          timeline.push({
            id: `tl-${orderNo}-comp-${idx}`,
            timestamp: cp.completedAt,
            title: `Tahapan: ${cp.name} Selesai`,
            author: item.messenger,
            role: "messenger",
            type: "PROCESS",
            details: `Penyelesaian loket Samsat: ${cp.name}${cp.nominal ? ` (Biaya Rp ${cp.nominal.toLocaleString("id-ID")})` : ""}`,
            amount: cp.nominal,
          });
        }
      });
    }

    // Reimbursements linked to this order
    const reimbursements = dbMessengerRepository.getAllReimbursements({ orderNo });
    for (const r of reimbursements) {
      timeline.push({
        id: `tl-reimb-${r.id}-submit`,
        timestamp: r.submittedAt,
        title: `Pengajuan Biaya Operasional: ${r.category}`,
        author: r.messengerName,
        role: "messenger",
        type: "REIMBURSEMENT",
        details: `Pengajuan biaya ${r.category} sebesar Rp ${r.amount.toLocaleString("id-ID")}${r.note ? ` - Catatan: ${r.note}` : ""}`,
        amount: r.amount,
        statusBadge: r.status,
      });

      if (r.reviewedAt && r.reviewedBy) {
        timeline.push({
          id: `tl-reimb-${r.id}-review`,
          timestamp: r.reviewedAt,
          title: `Pengajuan Biaya ${r.id} Ditinjau (${r.status})`,
          author: r.reviewedBy,
          role: "finance",
          type: "REIMBURSEMENT",
          details: `Keputusan: ${r.status}. Disetujui Rp ${(r.approvedAmount || 0).toLocaleString("id-ID")}${r.reviewNotes ? ` (${r.reviewNotes})` : ""}`,
          amount: r.approvedAmount,
          statusBadge: r.status,
        });
      }

      if (r.paidAt && r.paidBy) {
        timeline.push({
          id: `tl-reimb-${r.id}-paid`,
          timestamp: r.paidAt,
          title: `Pencairan Biaya ${r.id} Selesai`,
          author: r.paidBy,
          role: "finance",
          type: "REIMBURSEMENT",
          details: `Realisasi pencairan dana Rp ${(r.approvedAmount || r.amount).toLocaleString("id-ID")} via ${r.paymentMethod || "Kas Kantor"}`,
          amount: r.approvedAmount || r.amount,
          statusBadge: "Dibayar",
        });
      }
    }

    // Attachments / Evidence upload timeline
    if (item.photoProofUrl) {
      timeline.push({
        id: `tl-${orderNo}-proof-upload`,
        timestamp: item.completedAt,
        title: `Bukti Hasil Pekerjaan Diunggah`,
        author: item.messenger,
        role: "messenger",
        type: "EVIDENCE",
        details: `Foto dokumentasi bukti serah terima berkas diunggah oleh ${item.messenger}.`,
      });
    }

    // Completion timeline event
    if (item.completedAt) {
      timeline.push({
        id: `tl-${orderNo}-completed`,
        timestamp: item.completedAt,
        title: `Tugas ${item.taskType} Dinyatakan Selesai`,
        author: item.messenger,
        role: "messenger",
        type: "COMPLETION",
        details: item.keterangan || `Pekerjaan ${item.taskType} berhasil dituntaskan secara resmi.`,
      });
    }

    // Sort timeline chronologically (ascending)
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 2. Attachments / Evidence compilation
    const attachments: TaskDetailResponse["attachments"] = [];

    if (rawOrder.pickupProof?.photoProofUrl) {
      attachments.push({
        id: `att-${orderNo}-pickup`,
        name: "Foto Bukti Penjemputan Berkas",
        type: "PICKUP_PROOF",
        url: rawOrder.pickupProof.photoProofUrl,
        uploadedAt: rawOrder.pickupProof.completedAt || rawOrder.createdAt,
        uploadedBy: item.messenger,
        category: "Jemput Dokumen",
      });
    }

    if (rawOrder.deliveryHandover?.photoProofUrl) {
      attachments.push({
        id: `att-${orderNo}-delivery`,
        name: `Foto Serah Terima (${rawOrder.deliveryHandover.recipientName || "Klien"})`,
        type: "DELIVERY_HANDOVER",
        url: rawOrder.deliveryHandover.photoProofUrl,
        uploadedAt: rawOrder.deliveryHandover.completedAt || item.completedAt,
        uploadedBy: item.messenger,
        category: "Pengantaran Dokumen",
      });
    }

    if (rawOrder.componentProgress && Array.isArray(rawOrder.componentProgress)) {
      rawOrder.componentProgress.forEach((cp, idx) => {
        if (cp.evidence && Array.isArray(cp.evidence)) {
          cp.evidence.forEach((ev, evIdx) => {
            attachments.push({
              id: `att-${orderNo}-comp-${idx}-${evIdx}`,
              name: `Bukti Loket: ${cp.name}`,
              type: "SAMSAT_EVIDENCE",
              url: ev.fileUrl,
              uploadedAt: ev.uploadedAt || item.completedAt,
              uploadedBy: ev.uploadedBy || item.messenger,
              category: "Proses Samsat",
            });
          });
        }
      });
    }

    for (const r of reimbursements) {
      if (r.receiptUrl) {
        attachments.push({
          id: `att-reimb-${r.id}`,
          name: `Kuitansi/Struk Pengajuan ${r.id} (${r.category})`,
          type: "REIMBURSEMENT_RECEIPT",
          url: r.receiptUrl,
          uploadedAt: r.submittedAt,
          uploadedBy: r.messengerName,
          category: `Pengajuan Biaya: ${r.category}`,
        });
      }
    }

    // 3. Reimbursements summary
    let totalDiajukan = 0;
    let totalDisetujui = 0;
    let totalDitolak = 0;
    let totalDibayar = 0;
    let totalMenunggu = 0;
    let totalDisetujuiBelumDibayar = 0;

    for (const r of reimbursements) {
      totalDiajukan += r.amount;
      const approved = r.approvedAmount !== undefined ? r.approvedAmount : (r.status === "Disetujui" || r.status === "Dibayar" ? r.amount : 0);
      const rejected = r.status === "Ditolak" ? r.amount : (r.rejectedAmount || 0);

      totalDisetujui += approved;
      totalDitolak += rejected;

      if (r.status === "Dibayar") {
        totalDibayar += approved;
      } else if (r.status === "Disetujui") {
        totalDisetujuiBelumDibayar += approved;
      } else if (r.status === "Diajukan" || r.status === "Sedang Ditinjau") {
        totalMenunggu += r.amount;
      }
    }

    return {
      task: {
        id: item.id,
        orderNo: item.orderNo,
        taskType: item.taskType,
        messenger: item.messenger,
        messengerEmployeeId: item.messengerEmployeeId,
        customer: item.customer,
        phone: item.phone || "-",
        nopol: item.nopol,
        jenisKendaraan: item.jenisKendaraan || "-",
        layanan: item.layanan,
        wilayah: item.wilayah,
        status: item.status,
        assignedAt: (rawOrder as any).tanggalPenjadwalan || rawOrder.createdAt,
        startedAt: (rawOrder as any).startedAt || (rawOrder as any).tanggalJemput,
        completedAt: item.completedAt,
        totalTagihan: item.totalTagihan,
        terbayar: item.terbayar || 0,
        statusBayar: item.statusBayar || "Lunas",
        receiverName: item.receiverName,
        relationship: item.relationship,
        notes: item.keterangan,
        photoProofUrl: item.photoProofUrl,
        rawOrder,
      },
      timeline,
      attachments,
      reimbursements: {
        summary: {
          totalDiajukan,
          totalDisetujui,
          totalDitolak,
          totalDibayar,
          totalMenunggu,
          totalDisetujuiBelumDibayar,
        },
        items: reimbursements,
      },
    };
  }

  private buildTaskDetailFromOrder(rawOrder: OperationalOrder, taskType: MessengerTaskType): TaskDetailResponse {
    const item: MessengerHistoryItem = {
      id: `HIST-${rawOrder.orderNo}-CUSTOM`,
      orderNo: rawOrder.orderNo,
      taskType,
      messenger: rawOrder.messenger || (rawOrder as any).assignedMessengerName || "Budi Santoso",
      messengerEmployeeId: (rawOrder as any).assignedMessengerId || "EMP-MSG-001",
      customer: rawOrder.customer,
      phone: rawOrder.nomorHP || "-",
      nopol: rawOrder.nopol || "-",
      jenisKendaraan: rawOrder.jenisKendaraan || "-",
      layanan: rawOrder.layanan,
      wilayah: rawOrder.wilayahSamsatAsal || "Kantor Samsat",
      completedAt: (rawOrder as any).completedAt || rawOrder.createdAt,
      totalTagihan: rawOrder.payment?.totalBiaya || 1500000,
      terbayar: rawOrder.payment?.dibayar || 0,
      statusBayar: rawOrder.payment?.statusPembayaran || "Lunas",
      status: "Selesai",
      rawOrder,
    };

    return this.buildTaskDetailFromItem(item);
  }
}

export const messengerService = new MessengerService();
