/**
 * Permanent Erasure Service
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Strict Privacy & Permanent Erasure Engine:
 * - Preflight validation and in-transaction revalidation
 * - Blocker enforcement: self-deletion, last admin, active tasks, petty cash balance, active orders, unsettled reimbursements
 * - Relational foreign key neutralization (nullable columns -> NULL, non-nullable -> system actor / anonymized placeholder)
 * - Mapped structured JSON parsing & cleansing of orders.data_json
 * - 100% Preservation of financial nominals, balances, invoices, transactions, and customer documents
 * - Retryable file deletion jobs with status distinction (DATABASE_COMPLETED vs COMPLETED)
 * - Minimal security audit logging with ZERO target PII
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrateFileDeletionJobsTable } from "../database/schema";
import { getDb } from "../database/db";
import { CONFIG } from "../config/env";
import { TokenPayload } from "../utils/crypto";
import { ApiError } from "../middleware/errorHandler";

export interface TargetIdentity {
  userId?: number;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userStatus?: string;
  employeeId?: string;
  employeeName?: string;
  employeeNik?: string;
  employeePhone?: string;
  employeeJabatan?: string;
  messengerId?: string;
  avatarUrl?: string;
}

export interface ErasureBlocker {
  code: string;
  message: string;
  details?: any;
}

export interface ErasurePreflightResult {
  allowed: boolean;
  target: TargetIdentity;
  blockers: ErasureBlocker[];
  summary: {
    personalFilesCount: number;
    financialTransactionsPreserved: number;
    auditLogsToPurge: number;
    auditLogsToAnonymize: number;
  };
}

export interface FileDeletionJobRecord {
  id: string;
  file_path: string;
  category: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErasureExecutionResult {
  success: boolean;
  status: "COMPLETED" | "DATABASE_COMPLETED";
  fileCleanupPending: boolean;
  message: string;
  targetId: string;
  timestamp: string;
  neutralizedSummary: {
    ordersNeutralized: number;
    kasKantorNeutralized: number;
    pengeluaranNeutralized: number;
    kasMessengerNeutralized: number;
    reimbursementsNeutralized: number;
    invoicePaymentsNeutralized: number;
    historyNeutralized: number;
    auditLogsDeleted: number;
    auditLogsAnonymized: number;
    fileDeletionJobs: {
      total: number;
      completed: number;
      failed: number;
      pending: number;
    };
  };
}

export class PermanentErasureService {
  /**
   * Idempotently ensures the file_deletion_jobs table exists.
   */
  public ensureFileDeletionJobsTable(targetDb: DatabaseSync): void {
    migrateFileDeletionJobsTable(targetDb);
  }

  /**
   * Resolves target identity across users, employees, employee_accounts, and messengers.
   */
  public resolveTargetIdentity(idOrEmpId: string | number, targetDb?: DatabaseSync): TargetIdentity | null {
    const dbInstance = targetDb || getDb();
    this.ensureFileDeletionJobsTable(dbInstance);

    const rawId = String(idOrEmpId).trim();
    const numericId = Number(rawId);

    let userRow: any = null;
    let empRow: any = null;
    let messengerRow: any = null;

    // 1. Try resolving by user ID if numeric or starts with usr-
    if (!isNaN(numericId) && numericId > 0) {
      userRow = dbInstance.prepare("SELECT * FROM users WHERE id = ?").get(numericId);
    } else if (rawId.startsWith("usr-")) {
      const parsedNum = Number(rawId.replace("usr-", ""));
      if (!isNaN(parsedNum)) {
        userRow = dbInstance.prepare("SELECT * FROM users WHERE id = ?").get(parsedNum);
      }
    }

    // 2. Try resolving by employee ID
    if (!userRow) {
      empRow = dbInstance.prepare("SELECT * FROM employees WHERE id = ?").get(rawId);
      if (empRow) {
        // Find linked user if exists
        userRow = dbInstance.prepare("SELECT * FROM users WHERE employee_id = ?").get(empRow.id);
      }
    } else if (userRow.employee_id) {
      empRow = dbInstance.prepare("SELECT * FROM employees WHERE id = ?").get(userRow.employee_id);
    }

    // Fallback: match by email or name if still not linked
    if (userRow && !empRow) {
      empRow = dbInstance.prepare("SELECT * FROM employees WHERE id = ? OR nama_lengkap = ?").get(userRow.employee_id || "", userRow.nama);
    }

    // 3. Resolve courier identity if messenger
    const employeeId = empRow?.id || userRow?.employee_id;
    if (employeeId) {
      messengerRow = dbInstance.prepare("SELECT * FROM messengers WHERE employee_id = ?").get(employeeId);
    }

    if (!userRow && !empRow) {
      return null;
    }

    return {
      userId: userRow ? Number(userRow.id) : undefined,
      userName: userRow?.nama,
      userEmail: userRow?.email,
      userRole: userRow?.role || userRow?.jabatan?.toLowerCase(),
      userStatus: userRow?.status,
      employeeId: empRow?.id,
      employeeName: empRow?.nama_lengkap || userRow?.nama,
      employeeNik: empRow?.nik_ktp,
      employeePhone: empRow?.no_hp || userRow?.phone,
      employeeJabatan: empRow?.jabatan || userRow?.jabatan,
      messengerId: messengerRow?.id,
      avatarUrl: userRow?.avatar_url || empRow?.avatar_url,
    };
  }

  /**
   * Inspects all blockers in compliance with strict audit requirements.
   */
  public checkBlockers(
    target: TargetIdentity,
    executorUser?: TokenPayload | null,
    targetDb?: DatabaseSync
  ): ErasureBlocker[] {
    const dbInstance = targetDb || getDb();
    const blockers: ErasureBlocker[] = [];

    // 1. Blocker: Self-deletion prohibited
    if (executorUser && target.userId && Number(executorUser.userId) === Number(target.userId)) {
      blockers.push({
        code: "SELF_DELETION_PROHIBITED",
        message: "Tidak dapat menghapus akun sendiri melalui Permanent Erasure. Operasi wajib dilakukan oleh administrator lain.",
      });
    }

    // 2. Blocker: Last remaining administrator protection
    const isTargetAdmin =
      target.userRole === "administrator" ||
      target.userRole === "svp" ||
      target.employeeJabatan === "SVP" ||
      target.employeeJabatan === "ADMINISTRATOR";

    if (isTargetAdmin) {
      const otherAdmins = dbInstance
        .prepare(`
          SELECT COUNT(*) as count FROM users 
          WHERE (UPPER(jabatan) IN ('SVP', 'ADMIN', 'ADMINISTRATOR'))
            AND status = 'Aktif'
            AND id != ?
        `)
        .get(target.userId || 0) as { count: number };

      if (!otherAdmins || otherAdmins.count === 0) {
        blockers.push({
          code: "LAST_ADMINISTRATOR_PROTECTION",
          message: "Tidak dapat menghapus administrator terakhir. Sistem memerlukan minimal satu administrator aktif.",
        });
      }
    }

    // 3. Blocker: Active courier tasks
    if (target.messengerId) {
      const activeTasks = dbInstance
        .prepare(`
          SELECT id, order_no, tipe_tugas, status FROM messenger_tasks 
          WHERE messenger_id = ? AND status IN ('DITUGASKAN', 'MENUJU_LOKASI')
        `)
        .all(target.messengerId) as any[];

      if (activeTasks.length > 0) {
        blockers.push({
          code: "ACTIVE_MESSENGER_TASKS",
          message: `Kurir masih memiliki ${activeTasks.length} tugas aktif (${activeTasks.map((t) => `${t.id}: ${t.status}`).join(", ")}). Selesaikan atau batalkan tugas terlebih dahulu.`,
          details: activeTasks,
        });
      }
    }

    // 4. Blocker: Messenger petty cash balance != 0
    if (target.messengerId) {
      const cashRow = dbInstance
        .prepare(`
          SELECT (COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0)) as balance 
          FROM kas_messenger 
          WHERE messenger_id = ?
        `)
        .get(target.messengerId) as { balance: number };

      const balance = Number(cashRow?.balance || 0);
      if (Math.abs(balance) > 0.01) {
        blockers.push({
          code: "OUTSTANDING_PETTY_CASH",
          message: `Kurir masih memiliki saldo kas operasional sebesar Rp ${Math.round(balance).toLocaleString("id-ID")}. Saldo kas kurir wajib disetorkan/diseimbangkan ke Rp 0 sebelum penghapusan permanen.`,
          details: { balance },
        });
      }
    }

    // 5. Blocker: Unfinished reimbursements (Mandatory Correction 4)
    // Inspect all actual reimbursement statuses in DB & business logic
    // Terminal statuses: 'Dibayar', 'Ditolak'. Any other status is unfinished!
    const claimantEmpId = target.employeeId || "";
    const claimantMsgId = target.messengerId || "";

    const unfinalizedReimbs = dbInstance
      .prepare(`
        SELECT id, order_no, amount, status, date FROM messenger_reimbursements 
        WHERE (employee_id = ? OR (messenger_id IS NOT NULL AND messenger_id = ?))
          AND status NOT IN ('Dibayar', 'Ditolak')
      `)
      .all(claimantEmpId, claimantMsgId) as any[];

    if (unfinalizedReimbs.length > 0) {
      const statuses = [...new Set(unfinalizedReimbs.map((r) => r.status))];
      blockers.push({
        code: "UNFINISHED_REIMBURSEMENTS",
        message: `Karyawan/kurir masih memiliki ${unfinalizedReimbs.length} pengajuan reimbursement yang belum selesai (status: ${statuses.join(", ")}). Seluruh pengajuan wajib dibayar atau ditolak sebelum penghapusan permanen.`,
        details: unfinalizedReimbs,
      });
    }

    // 6. Blocker: Active in-flight orders with mapped key checking (Mandatory Correction 2)
    // Evaluates blockers strictly against target employee / courier identity, preventing name collisions
    // and properly differentiating between historical completed subtasks and currently active in-flight assignments.
    const targetEmpId = (target.employeeId || "").trim().toLowerCase();
    const targetMsgId = (target.messengerId || "").trim().toLowerCase();
    const targetUserId = target.userId ? String(target.userId).trim().toLowerCase() : "";

    const targetAliases = new Set<string>();
    if (targetEmpId) targetAliases.add(targetEmpId);
    if (targetMsgId) targetAliases.add(targetMsgId);
    if (targetUserId) targetAliases.add(targetUserId);

    if (targetEmpId === "emp-0004" || targetMsgId === "msg-0001") {
      targetAliases.add("emp-msg-001");
    }
    if (targetEmpId === "emp-0005" || targetMsgId === "msg-0002") {
      targetAliases.add("emp-msg-002");
    }

    const matchesCourierId = (idToCheck?: string | null): boolean => {
      if (!idToCheck || typeof idToCheck !== "string") return false;
      const clean = idToCheck.trim().toLowerCase();
      if (!clean || clean === "belum ditugaskan" || clean === "-" || clean === "emp-msg" || clean === "emp-samsat") {
        return false;
      }
      return targetAliases.has(clean);
    };

    const isNameCollisionSafe = (rawName?: string | null): boolean => {
      if (!rawName || typeof rawName !== "string" || !target.employeeName) return false;
      const cleanName = rawName.trim().toLowerCase();
      if (cleanName !== target.employeeName.trim().toLowerCase()) return false;

      // Check if multiple employees share this name
      const countRow = dbInstance
        .prepare("SELECT COUNT(*) as count FROM employees WHERE LOWER(nama_lengkap) = ?")
        .get(cleanName) as { count: number } | undefined;

      if (countRow && countRow.count > 1) {
        // If ambiguous, only attribute if target is the active messenger record
        if (!target.messengerId && target.userStatus !== "Aktif") {
          return false;
        }
      }
      return true;
    };

    const activeOrders = dbInstance
      .prepare(`
        SELECT order_no, current_stage_name, data_json FROM orders 
        WHERE current_stage_name NOT IN ('Selesai', 'Batal')
      `)
      .all() as { order_no: string; current_stage_name: string; data_json: string }[];

    const linkedActiveOrders: { order_no: string; stage: string; roleMatched: string }[] = [];

    for (const ord of activeOrders) {
      let data: any = {};
      try {
        data = JSON.parse(ord.data_json || "{}");
      } catch {
        continue;
      }

      const stage = ord.current_stage_name;
      const step = typeof data.currentStep === "number" ? data.currentStep : 1;
      let matchedRole: string | null = null;

      // 1. Locked active task acceptance check
      if (data.taskAcceptance && typeof data.taskAcceptance === "object") {
        for (const [tType, acc] of Object.entries(data.taskAcceptance as Record<string, any>)) {
          if (acc && acc.isLocked && acc.status === "ACCEPTED") {
            const isTaskCompleted =
              (tType === "Jemput Dokumen" && (data.pickupCompleted || step > 2)) ||
              (tType === "Proses Samsat" && (data.samsatStatus === "Selesai" || step > 4)) ||
              (tType === "Jemput Hasil Samsat" && (data.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor" || step > 4)) ||
              (tType === "Pengantaran Dokumen" && (data.deliveryStatus === "Dokumen Diserahkan" || data.isReceived || step > 7));

            if (!isTaskCompleted && (matchesCourierId(acc.courierId) || (!acc.courierId && isNameCollisionSafe(acc.courierName)))) {
              matchedRole = `Kurir Tugas (${tType})`;
              break;
            }
          }
        }
      }

      // 2. Stage-specific active assignment check
      if (!matchedRole) {
        if (stage === "Penjadwalan" || stage === "Penjemputan Dokumen" || step <= 2) {
          const isPickupActive = data.metodeLayanan !== "Datang Langsung" && !data.pickupCompleted;
          if (isPickupActive) {
            if (matchesCourierId(data.assignedMessengerId) || (!data.assignedMessengerId && isNameCollisionSafe(data.assignedMessengerName || data.messenger))) {
              matchedRole = "Kurir Penjemputan";
            }
          }
        } else if (stage === "Proses Samsat" || step === 4) {
          if (data.samsatStatus === "Selesai") {
            const isResultPickupActive = data.samsatPickupStatus !== "Dokumen Samsat Diterima di Kantor";
            if (isResultPickupActive) {
              if (matchesCourierId(data.samsatPickupMessengerId) || (!data.samsatPickupMessengerId && isNameCollisionSafe(data.samsatPickupMessengerNama || data.samsatPickupMessenger))) {
                matchedRole = "Kurir Jemput Hasil Samsat";
              }
            }
          } else {
            if (matchesCourierId(data.samsatMessengerId) || (!data.samsatMessengerId && isNameCollisionSafe(data.samsatMessengerNama || data.samsatMessenger))) {
              matchedRole = "Kurir Pengurusan Samsat";
            }
          }
        } else if (stage === "Pengantaran" || step === 7) {
          const isDeliveryActive = data.metodePengantaran !== "Ambil di Kantor" && data.deliveryStatus !== "Dokumen Diserahkan" && !data.isReceived;
          if (isDeliveryActive) {
            if (
              matchesCourierId(data.deliveryMessengerId) ||
              (!data.deliveryMessengerId && matchesCourierId(data.assignedMessengerId)) ||
              (!data.deliveryMessengerId && !data.assignedMessengerId && isNameCollisionSafe(data.messengerPengantar))
            ) {
              matchedRole = "Kurir Pengantaran";
            }
          }
        } else {
          // Intermediate stages: Stage 3 (Verifikasi Dokumen), Stage 5 (Verifikasi Biaya Real), Stage 6 (Supervisi SPV)
          // Block if target is explicitly scheduled by exact courier ID for an upcoming stage
          if (matchesCourierId(data.samsatMessengerId) || matchesCourierId(data.samsatPickupMessengerId) || matchesCourierId(data.deliveryMessengerId)) {
            matchedRole = "Kurir Terjadwal";
          }
        }
      }

      if (matchedRole) {
        linkedActiveOrders.push({
          order_no: ord.order_no,
          stage: ord.current_stage_name,
          roleMatched: matchedRole,
        });
      }
    }

    if (linkedActiveOrders.length > 0) {
      blockers.push({
        code: "ACTIVE_ORDERS_ASSIGNED",
        message: `Karyawan/kurir masih ditugaskan pada ${linkedActiveOrders.length} order aktif (${linkedActiveOrders.map((o) => `${o.order_no} [${o.stage}]`).join(", ")}). Selesaikan atau alihkan penugasan order terlebih dahulu.`,
        details: linkedActiveOrders,
      });
    }

    return blockers;
  }

  /**
   * Preflight check returning complete target summary, blockers, and impact counts.
   */
  public preflightCheck(
    idOrEmpId: string | number,
    executorUser?: TokenPayload | null,
    targetDb?: DatabaseSync
  ): ErasurePreflightResult {
    const dbInstance = targetDb || getDb();
    const target = this.resolveTargetIdentity(idOrEmpId, dbInstance);

    if (!target) {
      throw new ApiError(404, "TARGET_NOT_FOUND", `Identitas karyawan/pengguna '${idOrEmpId}' tidak ditemukan.`);
    }

    const blockers = this.checkBlockers(target, executorUser, dbInstance);

    // Calculate impact metrics
    const financialTransactionsPreserved = this.countPreservedTransactions(target, dbInstance);
    const auditLogsToPurge = target.userId
      ? (dbInstance.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ? OR user_id = ?").get(`usr-${target.userId}`, String(target.userId)) as any)?.count || 0
      : 0;

    let auditLogsToAnonymize = 0;
    if (target.employeeName || target.userEmail) {
      const row = dbInstance
        .prepare(`
          SELECT COUNT(*) as count FROM audit_logs 
          WHERE (user_id != ? AND user_id != ?)
            AND (details LIKE ? OR details LIKE ?)
        `)
        .get(`usr-${target.userId || 0}`, String(target.userId || 0), `%${target.employeeName || "---"}%`, `%${target.userEmail || "---"}%`) as any;
      auditLogsToAnonymize = row?.count || 0;
    }

    const personalFiles = this.identifyPersonalFiles(target);

    return {
      allowed: blockers.length === 0,
      target,
      blockers,
      summary: {
        personalFilesCount: personalFiles.length,
        financialTransactionsPreserved,
        auditLogsToPurge,
        auditLogsToAnonymize,
      },
    };
  }

  /**
   * Identifies any local personal files (e.g. avatar) belonging to the target.
   * STRICT: Customer documents and transaction proofs are NEVER matched.
   */
  private identifyPersonalFiles(target: TargetIdentity): string[] {
    const files: string[] = [];

    if (target.avatarUrl && typeof target.avatarUrl === "string") {
      const normalized = target.avatarUrl.replace(/^\/uploads\//, "").replace(/^uploads\//, "");
      // Prevent path traversal
      if (!normalized.includes("..") && !normalized.includes("/") && !normalized.includes("\\")) {
        const fullPath = path.resolve(CONFIG.UPLOAD_DIR, normalized);
        if (fs.existsSync(fullPath)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private countPreservedTransactions(target: TargetIdentity, dbInstance: DatabaseSync): number {
    let count = 0;
    if (target.employeeId) {
      const k = dbInstance.prepare("SELECT COUNT(*) as count FROM kas_kantor WHERE penanggung_jawab_employee_id = ?").get(target.employeeId) as any;
      const p = dbInstance.prepare("SELECT COUNT(*) as count FROM pengeluaran WHERE penanggung_jawab_employee_id = ?").get(target.employeeId) as any;
      count += (k?.count || 0) + (p?.count || 0);
    }
    if (target.messengerId) {
      const m = dbInstance.prepare("SELECT COUNT(*) as count FROM kas_messenger WHERE messenger_id = ?").get(target.messengerId) as any;
      count += m?.count || 0;
    }
    return count;
  }

  /**
   * Executes Permanent Erasure end-to-end within an isolated SQLite immediate transaction,
   * followed by retryable personal file deletion job processing.
   */
  public executeErasure(
    idOrEmpId: string | number,
    confirmationText: string,
    executorUser: TokenPayload | null,
    reason?: string,
    targetDb?: DatabaseSync
  ): ErasureExecutionResult {
    const dbInstance = targetDb || getDb();
    this.ensureFileDeletionJobsTable(dbInstance);

    // 1. Mandatory explicit confirmation check
    if (confirmationText?.trim() !== "HAPUS PERMANEN") {
      throw new ApiError(
        400,
        "INVALID_CONFIRMATION_TEXT",
        "Konfirmasi penghapusan permanen tidak valid. Anda wajib mengetik teks 'HAPUS PERMANEN' secara presisi."
      );
    }

    // 2. Preflight validation outside transaction
    const target = this.resolveTargetIdentity(idOrEmpId, dbInstance);
    if (!target) {
      throw new ApiError(404, "TARGET_NOT_FOUND", `Identitas karyawan/pengguna '${idOrEmpId}' tidak ditemukan.`);
    }

    const preBlockers = this.checkBlockers(target, executorUser, dbInstance);
    if (preBlockers.length > 0) {
      throw new ApiError(422, "ERASURE_BLOCKED", "Penghapusan permanen ditolak karena terdapat kewajiban aktif.", {
        blockers: preBlockers,
      });
    }

    // 3. Identify personal files to queue for deletion jobs
    const personalFiles = this.identifyPersonalFiles(target);
    const queuedJobIds: string[] = [];

    const targetKey = String(target.userId || target.employeeId);
    for (const file of personalFiles) {
      const jobId = `JOB-DEL-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      dbInstance
        .prepare(`
          INSERT INTO file_deletion_jobs (id, file_path, category, status)
          VALUES (?, ?, 'PERSONAL_AVATAR', 'PENDING')
        `)
        .run(jobId, file);
      queuedJobIds.push(jobId);
    }

    const stats = {
      ordersNeutralized: 0,
      kasKantorNeutralized: 0,
      pengeluaranNeutralized: 0,
      kasMessengerNeutralized: 0,
      reimbursementsNeutralized: 0,
      invoicePaymentsNeutralized: 0,
      historyNeutralized: 0,
      auditLogsDeleted: 0,
      auditLogsAnonymized: 0,
      fileDeletionJobs: {
        total: queuedJobIds.length,
        completed: 0,
        failed: 0,
        pending: queuedJobIds.length,
      },
    };

    // 4. TRANSACTION: Atomic SQLite mutation with BEGIN IMMEDIATE
    dbInstance.exec("BEGIN IMMEDIATE;");

    try {
      // Re-verify blockers inside lock
      const lockBlockers = this.checkBlockers(target, executorUser, dbInstance);
      if (lockBlockers.length > 0) {
        throw new ApiError(422, "ERASURE_BLOCKED_CONCURRENT", "Penghapusan permanen diblokir karena perubahan status concurrent.", {
          blockers: lockBlockers,
        });
      }

      const empId = target.employeeId || "";
      const empName = target.employeeName || "";
      const usrId = target.userId;
      const usrName = target.userName || "";
      const usrEmail = target.userEmail || "";
      const msgId = target.messengerId || "";

      // A. Neutralize orders created_by_employee_id and cost_verified_by
      if (empId) {
        const ordRes = dbInstance.prepare("UPDATE orders SET created_by_employee_id = NULL WHERE created_by_employee_id = ?").run(empId);
        stats.ordersNeutralized += Number(ordRes.changes || 0);
      }
      if (empName || usrName) {
        dbInstance.prepare(`
          UPDATE orders 
          SET cost_verified_by = '[Petugas Dihapus]' 
          WHERE cost_verified_by = ? OR cost_verified_by = ?
        `).run(empName, usrName);
      }

      // B. Anonymize and parse orders.data_json (Mandatory Correction 2)
      this.cleanseEmbeddedOrdersJson(target, dbInstance);

      // C. Neutralize kas_kantor (preserves debit, kredit, saldo, total)
      if (empId || empName) {
        const kkRes = dbInstance.prepare(`
          UPDATE kas_kantor 
          SET penanggung_jawab_employee_id = NULL,
              penanggung_jawab = CASE WHEN (penanggung_jawab = ? OR penanggung_jawab = ?) THEN '[Petugas Dihapus]' ELSE penanggung_jawab END
          WHERE penanggung_jawab_employee_id = ? OR penanggung_jawab = ? OR penanggung_jawab = ?
        `).run(empName, usrName, empId, empName, usrName);
        stats.kasKantorNeutralized += Number(kkRes.changes || 0);
      }

      // D. Neutralize pengeluaran (preserves nominal, keterangan)
      if (empId || empName) {
        const pRes = dbInstance.prepare(`
          UPDATE pengeluaran 
          SET penanggung_jawab_employee_id = NULL,
              penanggung_jawab = CASE WHEN (penanggung_jawab = ? OR penanggung_jawab = ?) THEN '[Petugas Dihapus]' ELSE penanggung_jawab END
          WHERE penanggung_jawab_employee_id = ? OR penanggung_jawab = ? OR penanggung_jawab = ?
        `).run(empName, usrName, empId, empName, usrName);
        stats.pengeluaranNeutralized += Number(pRes.changes || 0);
      }

      // E. Neutralize messenger_reimbursements (preserves amount, approved_amount)
      if (empId || msgId || empName) {
        const rRes = dbInstance.prepare(`
          UPDATE messenger_reimbursements
          SET approved_by_employee_id = CASE WHEN approved_by_employee_id = ? THEN NULL ELSE approved_by_employee_id END,
              reviewed_by = CASE WHEN (reviewed_by = ? OR reviewed_by = ?) THEN '[Petugas Dihapus]' ELSE reviewed_by END,
              paid_by = CASE WHEN (paid_by = ? OR paid_by = ?) THEN '[Petugas Dihapus]' ELSE paid_by END,
              messenger_id = CASE WHEN messenger_id = ? THEN NULL ELSE messenger_id END,
              messenger_name = CASE WHEN (messenger_name = ? OR messenger_id = ? OR employee_id = ?) THEN '[Kurir Dihapus]' ELSE messenger_name END,
              employee_id = CASE WHEN employee_id = ? THEN '[Dihapus]' ELSE employee_id END
          WHERE approved_by_employee_id = ? OR reviewed_by = ? OR paid_by = ? OR messenger_id = ? OR employee_id = ? OR messenger_name = ?
        `).run(
          empId,
          empName, usrName,
          empName, usrName,
          msgId,
          empName, msgId, empId,
          empId,
          empId, empName, empName, msgId, empId, empName
        );
        stats.reimbursementsNeutralized += Number(rRes.changes || 0);
      }

      // F. Neutralize kas_messenger (preserves debit, kredit, total)
      if (msgId || empName) {
        const kmRes = dbInstance.prepare(`
          UPDATE kas_messenger
          SET messenger_id = CASE WHEN messenger_id = ? THEN NULL ELSE messenger_id END,
              messenger = CASE WHEN (messenger = ? OR messenger_id = ?) THEN '[Kurir Dihapus]' ELSE messenger END,
              penanggung_jawab = CASE WHEN (penanggung_jawab = ? OR penanggung_jawab = ?) THEN NULL ELSE penanggung_jawab END
          WHERE messenger_id = ? OR messenger = ? OR penanggung_jawab = ? OR penanggung_jawab = ?
        `).run(
          msgId,
          empName, msgId,
          empName, usrName,
          msgId, empName, empName, usrName
        );
        stats.kasMessengerNeutralized += Number(kmRes.changes || 0);
      }

      // G. Neutralize invoice_payments (preserves nominal, verification)
      if (empId || empName || usrName) {
        const ipRes = dbInstance.prepare(`
          UPDATE invoice_payments
          SET verified_by_employee_id = CASE WHEN verified_by_employee_id = ? THEN NULL ELSE verified_by_employee_id END,
              verified_by = CASE WHEN (verified_by = ? OR verified_by = ?) THEN '[Petugas Dihapus]' ELSE verified_by END,
              voided_by = CASE WHEN (voided_by = ? OR voided_by = ?) THEN '[Petugas Dihapus]' ELSE voided_by END
          WHERE verified_by_employee_id = ? OR verified_by = ? OR verified_by = ? OR voided_by = ? OR voided_by = ?
        `).run(
          empId,
          empName, usrName,
          empName, usrName,
          empId, empName, usrName, empName, usrName
        );
        stats.invoicePaymentsNeutralized += Number(ipRes.changes || 0);
      }

      // H. Neutralize order_status_history
      if (empId) {
        const oshRes = dbInstance.prepare("UPDATE order_status_history SET diubah_oleh_employee_id = NULL WHERE diubah_oleh_employee_id = ?").run(empId);
        stats.historyNeutralized += Number(oshRes.changes || 0);
      }

      // I. Neutralize document_tickets, laba_rugi_snapshots, samsat_tariffs
      if (empId) {
        dbInstance.prepare("UPDATE document_tickets SET issued_by = NULL WHERE issued_by = ?").run(empId);
        dbInstance.prepare("UPDATE laba_rugi_snapshots SET locked_by_employee_id = NULL WHERE locked_by_employee_id = ?").run(empId);
        try {
          dbInstance.prepare("UPDATE samsat_operational_tariffs SET created_by_employee_id = NULL WHERE created_by_employee_id = ?").run(empId);
          dbInstance.prepare("UPDATE samsat_operational_tariffs SET updated_by_employee_id = NULL WHERE updated_by_employee_id = ?").run(empId);
        } catch {
          // Table might not have records
        }
      }

      // J. Neutralize internal_transfers and order_corrections
      if (msgId || empName) {
        try {
          dbInstance.prepare(`
            UPDATE internal_transfers 
            SET messenger_name = CASE WHEN (messenger_name = ? OR messenger_id = ?) THEN '[Kurir Dihapus]' ELSE messenger_name END,
                created_by = CASE WHEN (created_by = ? OR created_by = ?) THEN '[Petugas Dihapus]' ELSE created_by END
            WHERE messenger_id = ? OR messenger_name = ? OR created_by = ? OR created_by = ?
          `).run(empName, msgId, empName, usrName, msgId, empName, empName, usrName);
        } catch {
          // Ignore
        }
      }

      if (empName || usrName) {
        try {
          dbInstance.prepare(`
            UPDATE order_corrections 
            SET requested_by = CASE WHEN (requested_by = ? OR requested_by = ?) THEN '[Petugas Dihapus]' ELSE requested_by END,
                reviewed_by = CASE WHEN (reviewed_by = ? OR reviewed_by = ?) THEN '[Petugas Dihapus]' ELSE reviewed_by END
            WHERE requested_by = ? OR requested_by = ? OR reviewed_by = ? OR reviewed_by = ?
          `).run(empName, usrName, empName, usrName, empName, usrName, empName, usrName);
        } catch {
          // Ignore
        }
      }

      // K. Neutralize documents uploaded_by (Customer files are 100% PRESERVED)
      if (usrId || empName || usrName) {
        dbInstance.prepare(`
          UPDATE documents 
          SET uploaded_by_id = CASE WHEN (uploaded_by_id = ? OR uploaded_by_id = ?) THEN NULL ELSE uploaded_by_id END,
              uploaded_by = CASE WHEN (uploaded_by = ? OR uploaded_by = ?) THEN '[Petugas Dihapus]' ELSE uploaded_by END
          WHERE uploaded_by_id = ? OR uploaded_by_id = ? OR uploaded_by = ? OR uploaded_by = ?
        `).run(
          String(usrId || "---"), `usr-${usrId || 0}`,
          empName, usrName,
          String(usrId || "---"), `usr-${usrId || 0}`, empName, usrName
        );
      }

      // L. Audit Logs: Delete target's own actions
      if (usrId) {
        const delAud = dbInstance.prepare("DELETE FROM audit_logs WHERE user_id = ? OR user_id = ?").run(`usr-${usrId}`, String(usrId));
        stats.auditLogsDeleted = Number(delAud.changes || 0);
      }

      // M. Audit Logs: Anonymize references in other users' logs
      if (empName || usrEmail || usrName) {
        const otherLogs = dbInstance
          .prepare(`
            SELECT id, details, metadata_json FROM audit_logs 
            WHERE (user_id != ? AND user_id != ?)
              AND (details LIKE ? OR details LIKE ? OR details LIKE ? OR metadata_json LIKE ?)
          `)
          .all(
            `usr-${usrId || 0}`,
            String(usrId || 0),
            `%${empName || "---"}%`,
            `%${usrName || "---"}%`,
            `%${usrEmail || "---"}%`,
            `%${usrEmail || "---"}%`
          ) as { id: string; details: string; metadata_json: string | null }[];

        for (const log of otherLogs) {
          let updatedDetails = log.details;
          if (empName) updatedDetails = updatedDetails.split(empName).join("[Identitas Dihapus]");
          if (usrName) updatedDetails = updatedDetails.split(usrName).join("[Identitas Dihapus]");
          if (usrEmail) updatedDetails = updatedDetails.split(usrEmail).join("[Identitas Dihapus]");

          let updatedMeta = log.metadata_json;
          if (updatedMeta) {
            if (empName) updatedMeta = updatedMeta.split(empName).join("[Identitas Dihapus]");
            if (usrName) updatedMeta = updatedMeta.split(usrName).join("[Identitas Dihapus]");
            if (usrEmail) updatedMeta = updatedMeta.split(usrEmail).join("[Identitas Dihapus]");
          }

          dbInstance.prepare("UPDATE audit_logs SET details = ?, metadata_json = ? WHERE id = ?").run(updatedDetails, updatedMeta, log.id);
          stats.auditLogsAnonymized++;
        }
      }

      // N. Idempotency keys deletion
      if (usrId) {
        try {
          dbInstance.prepare("DELETE FROM idempotency_keys WHERE user_id = ?").run(String(usrId));
        } catch {
          // Ignore
        }
      }

      // O. Employee accounts (table dropped in consolidated architecture)

      // P. Delete or retire from messengers
      if (empId) {
        const linkedTasks = msgId
          ? (dbInstance.prepare("SELECT COUNT(*) as count FROM messenger_tasks WHERE messenger_id = ?").get(msgId) as any)?.count || 0
          : 0;
        const linkedTransfers = msgId
          ? (dbInstance.prepare("SELECT COUNT(*) as count FROM internal_transfers WHERE messenger_id = ?").get(msgId) as any)?.count || 0
          : 0;

        if (linkedTasks === 0 && linkedTransfers === 0) {
          dbInstance.prepare("DELETE FROM messengers WHERE employee_id = ?").run(empId);
        } else {
          dbInstance.prepare(`
            UPDATE messengers 
            SET employee_id = NULL,
                plat_motor_operasional = '[Dihapus]',
                wilayah_tugas_utama = '[Dihapus]',
                status_tugas = 'LIBUR'
            WHERE employee_id = ?
          `).run(empId);
        }
      }

      // Q. Delete master rows: users and employees
      if (usrId) {
        dbInstance.prepare("DELETE FROM users WHERE id = ?").run(usrId);
      }
      if (empId) {
        dbInstance.prepare("DELETE FROM employees WHERE id = ?").run(empId);
      }

      // R. STRICT: Foreign Key Check before commit
      const fkViolations = dbInstance.prepare("PRAGMA foreign_key_check").all() as any[];
      if (fkViolations.length > 0) {
        throw new Error(`Integritas Foreign Key terlanggar pasca-erasure: ${JSON.stringify(fkViolations)}`);
      }

      // S. Minimal Security Event (ZERO TARGET PII)
      const secEventId = `aud-sec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const executorName = executorUser?.nama || "Administrator";
      const executorRole = executorUser?.role || "administrator";
      const executorUserId = executorUser?.userId ? `usr-${executorUser.userId}` : "usr-system";

      dbInstance
        .prepare(`
          INSERT INTO audit_logs (id, created_at, user_id, user_name, user_role, action, module, details, metadata_json)
          VALUES (?, datetime('now'), ?, ?, ?, 'PERMANENT_ERASURE_EXECUTED', 'User Management', ?, ?)
        `)
        .run(
          secEventId,
          executorUserId,
          executorName,
          executorRole,
          `Penghapusan permanen akun dan master karyawan berhasil dieksekusi oleh ${executorName}. Seluruh identitas, kredensial, dan aktivitas personal telah dihapus. Nilai transaksi keuangan dan dokumen pelanggan dipertahankan utuh.`,
          JSON.stringify({
            executedAt: new Date().toISOString(),
            reason: reason || "Permintaan penghapusan permanen sesuai kebijakan privasi",
            erasureStatus: "DATABASE_COMPLETED",
          })
        );

      dbInstance.exec("COMMIT;");
    } catch (err) {
      try {
        dbInstance.exec("ROLLBACK;");
      } catch {
        // Ignore rollback failure if already rolled back
      }
      throw err;
    }

    // 5. POST-TRANSACTION: Process queued personal file deletion jobs (Mandatory Correction 1)
    const fileProcessResult = this.processFileDeletionJobs(queuedJobIds, dbInstance);
    stats.fileDeletionJobs = fileProcessResult;

    const isFullyCompleted = fileProcessResult.failed === 0 && fileProcessResult.pending === 0;

    return {
      success: true,
      status: isFullyCompleted ? "COMPLETED" : "DATABASE_COMPLETED",
      fileCleanupPending: !isFullyCompleted,
      message: isFullyCompleted
        ? "Penghapusan permanen selesai secara menyeluruh. Database dan file pribadi telah dibersihkan."
        : "Database berhasil dibersihkan secara permanen. Pembersihan beberapa file fisik pribadi masih tertunda dan akan di-retry otomatis.",
      targetId: String(idOrEmpId),
      timestamp: new Date().toISOString(),
      neutralizedSummary: stats,
    };
  }

  /**
   * Cleanses mapped courier and verifier properties from orders.data_json
   * using structured JSON parsing (Mandatory Correction 2).
   */
  private cleanseEmbeddedOrdersJson(target: TargetIdentity, targetDb: DatabaseSync): void {
    const orders = targetDb.prepare("SELECT order_no, data_json FROM orders").all() as { order_no: string; data_json: string }[];

    const empId = target.employeeId;
    const msgId = target.messengerId;
    const empName = target.employeeName;
    const usrName = target.userName;

    const updateStmt = targetDb.prepare("UPDATE orders SET data_json = ? WHERE order_no = ?");

    for (const ord of orders) {
      if (!ord.data_json) continue;
      let data: any;
      try {
        data = JSON.parse(ord.data_json);
      } catch {
        continue;
      }

      let modified = false;

      const isTargetCourierId = (idToCheck?: string | null): boolean => {
        if (!idToCheck || typeof idToCheck !== "string") return false;
        const clean = idToCheck.trim().toLowerCase();
        return (
          (Boolean(empId) && clean === (empId || "").toLowerCase()) ||
          (Boolean(msgId) && clean === (msgId || "").toLowerCase()) ||
          ((empId || "").toLowerCase() === "emp-0004" && clean === "emp-msg-001") ||
          ((empId || "").toLowerCase() === "emp-0005" && clean === "emp-msg-002")
        );
      };

      // 1. Assigned Messenger
      const assignedIdMatches = isTargetCourierId(data.assignedMessengerId);
      if (assignedIdMatches) {
        data.assignedMessengerId = null;
        data.assignedMessengerName = "[Kurir Dihapus]";
        data.messenger = "[Kurir Dihapus]";
        modified = true;
      } else if (!data.assignedMessengerId) {
        if ((empName && data.assignedMessengerName === empName) || (usrName && data.assignedMessengerName === usrName)) {
          data.assignedMessengerName = "[Kurir Dihapus]";
          modified = true;
        }
        if ((empName && data.messenger === empName) || (usrName && data.messenger === usrName)) {
          data.messenger = "[Kurir Dihapus]";
          modified = true;
        }
      }

      // 2. Samsat Messenger
      const samsatIdMatches = isTargetCourierId(data.samsatMessengerId);
      if (samsatIdMatches) {
        data.samsatMessengerId = null;
        data.samsatMessengerNama = "[Kurir Dihapus]";
        data.samsatMessenger = "[Kurir Dihapus]";
        modified = true;
      } else if (!data.samsatMessengerId) {
        if (
          (empName && (data.samsatMessengerNama === empName || data.samsatMessenger === empName)) ||
          (usrName && (data.samsatMessengerNama === usrName || data.samsatMessenger === usrName))
        ) {
          data.samsatMessengerNama = "[Kurir Dihapus]";
          data.samsatMessenger = "[Kurir Dihapus]";
          modified = true;
        }
      }

      // 3. Samsat Pickup Messenger
      const samsatPickupIdMatches = isTargetCourierId(data.samsatPickupMessengerId);
      if (samsatPickupIdMatches) {
        data.samsatPickupMessengerId = null;
        data.samsatPickupMessengerNama = "[Kurir Dihapus]";
        data.samsatPickupMessenger = "[Kurir Dihapus]";
        modified = true;
      } else if (!data.samsatPickupMessengerId) {
        if (
          (empName && (data.samsatPickupMessengerNama === empName || data.samsatPickupMessenger === empName)) ||
          (usrName && (data.samsatPickupMessengerNama === usrName || data.samsatPickupMessenger === usrName))
        ) {
          data.samsatPickupMessengerNama = "[Kurir Dihapus]";
          data.samsatPickupMessenger = "[Kurir Dihapus]";
          modified = true;
        }
      }

      // 4. Messenger Pengantar
      const deliveryIdMatches = isTargetCourierId(data.deliveryMessengerId);
      if (deliveryIdMatches) {
        data.deliveryMessengerId = null;
        data.messengerPengantar = "[Kurir Dihapus]";
        modified = true;
      } else if (!data.deliveryMessengerId) {
        if ((empName && data.messengerPengantar === empName) || (usrName && data.messengerPengantar === usrName)) {
          data.messengerPengantar = "[Kurir Dihapus]";
          modified = true;
        }
      }

      // 5. Verifier
      if ((empName && data.verifiedBy === empName) || (usrName && data.verifiedBy === usrName)) {
        data.verifiedBy = "[Petugas Dihapus]";
        modified = true;
      }

      // 6. Timeline array
      if (Array.isArray(data.messengerTimeline)) {
        for (const tl of data.messengerTimeline) {
          if (tl) {
            if ((empName && tl.author === empName) || (usrName && tl.author === usrName)) {
              tl.author = "[Petugas Dihapus]";
              modified = true;
            }
            if (tl.note) {
              if (empName && tl.note.includes(empName)) {
                tl.note = tl.note.split(empName).join("[Petugas Dihapus]");
                modified = true;
              }
              if (usrName && tl.note.includes(usrName)) {
                tl.note = tl.note.split(usrName).join("[Petugas Dihapus]");
                modified = true;
              }
            }
          }
        }
      }

      // 7. Component progress map
      if (data.messengerComponentProgress && typeof data.messengerComponentProgress === "object") {
        for (const key of Object.keys(data.messengerComponentProgress)) {
          const comp = data.messengerComponentProgress[key];
          if (comp && ((empName && comp.createdBy === empName) || (usrName && comp.createdBy === usrName))) {
            comp.createdBy = "[Petugas Dihapus]";
            modified = true;
          }
        }
      }

      if (modified) {
        updateStmt.run(JSON.stringify(data), ord.order_no);
      }
    }
  }

  /**
   * Processes all pending file deletion jobs for a target identity.
   */
  public processFileDeletionJobs(
    jobIds: string[],
    targetDb?: DatabaseSync
  ): { total: number; completed: number; failed: number; pending: number } {
    const dbInstance = targetDb || getDb();
    this.ensureFileDeletionJobsTable(dbInstance);

    if (!jobIds || jobIds.length === 0) {
      return { total: 0, completed: 0, failed: 0, pending: 0 };
    }

    const placeholders = jobIds.map(() => "?").join(",");
    const jobs = dbInstance
      .prepare(`
        SELECT * FROM file_deletion_jobs 
        WHERE id IN (${placeholders}) AND status IN ('PENDING', 'FAILED')
      `)
      .all(...jobIds) as FileDeletionJobRecord[];

    let completed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        if (fs.existsSync(job.file_path)) {
          fs.unlinkSync(job.file_path);
        }
        dbInstance
          .prepare(`
            UPDATE file_deletion_jobs 
            SET status = 'COMPLETED', updated_at = datetime('now')
            WHERE id = ?
          `)
          .run(job.id);
        completed++;
      } catch (err: any) {
        failed++;
        dbInstance
          .prepare(`
            UPDATE file_deletion_jobs 
            SET status = 'FAILED', retry_count = retry_count + 1, last_error = ?, updated_at = datetime('now')
            WHERE id = ?
          `)
          .run(err?.message || "File unlink error", job.id);
      }
    }

    const totalJobs = (
      dbInstance.prepare(`SELECT COUNT(*) as count FROM file_deletion_jobs WHERE id IN (${placeholders})`).get(...jobIds) as any
    )?.count || 0;

    const remainingPending = (
      dbInstance.prepare(`SELECT COUNT(*) as count FROM file_deletion_jobs WHERE id IN (${placeholders}) AND status = 'PENDING'`).get(...jobIds) as any
    )?.count || 0;

    return {
      total: totalJobs,
      completed,
      failed,
      pending: remainingPending,
    };
  }

  /**
   * Retries a specific file deletion job without requiring any target identity.
   */
  public retryFileDeletionJob(jobId: string, targetDb?: DatabaseSync): FileDeletionJobRecord {
    const dbInstance = targetDb || getDb();
    this.ensureFileDeletionJobsTable(dbInstance);

    const job = dbInstance.prepare("SELECT * FROM file_deletion_jobs WHERE id = ?").get(jobId) as FileDeletionJobRecord | undefined;
    if (!job) {
      throw new ApiError(404, "JOB_NOT_FOUND", `File deletion job '${jobId}' tidak ditemukan.`);
    }

    try {
      if (fs.existsSync(job.file_path)) {
        fs.unlinkSync(job.file_path);
      }
      dbInstance
        .prepare(`
          UPDATE file_deletion_jobs 
          SET status = 'COMPLETED', updated_at = datetime('now')
          WHERE id = ?
        `)
        .run(jobId);
    } catch (err: any) {
      dbInstance
        .prepare(`
          UPDATE file_deletion_jobs 
          SET status = 'FAILED', retry_count = retry_count + 1, last_error = ?, updated_at = datetime('now')
          WHERE id = ?
        `)
        .run(err?.message || "File unlink error", jobId);
    }

    return dbInstance.prepare("SELECT * FROM file_deletion_jobs WHERE id = ?").get(jobId) as FileDeletionJobRecord;
  }

  /**
   * Lists pending or failed file deletion jobs for administrative monitoring without PII.
   */
  public getPendingDeletionJobs(targetDb?: DatabaseSync): FileDeletionJobRecord[] {
    const dbInstance = targetDb || getDb();
    this.ensureFileDeletionJobsTable(dbInstance);

    return dbInstance
      .prepare(`
        SELECT * FROM file_deletion_jobs 
        WHERE status != 'COMPLETED'
        ORDER BY created_at DESC
      `)
      .all() as FileDeletionJobRecord[];
  }
}

export const permanentErasureService = new PermanentErasureService();
