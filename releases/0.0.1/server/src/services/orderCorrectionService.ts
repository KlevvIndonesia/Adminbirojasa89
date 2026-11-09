/**
 * Order Correction Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { runInTransaction } from "../database/db";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../middleware/auth";
import { OrderCorrectionRecord } from "../database/schema";
import { dbOrderCorrectionRepository } from "../repositories/dbOrderCorrectionRepository";
import { dbOrderRepository } from "../repositories/dbOrderRepository";
import { dbFinanceRepository } from "../repositories/dbFinanceRepository";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { orderService } from "./orderService";
import { financeService } from "./financeService";

export interface RequestCorrectionPayload {
  category: string;
  linkedDuplicateOrderNo?: string;
  reason: string;
}

export interface ReviewCorrectionPayload {
  decision: "approve" | "reject";
  reviewNotes?: string;
}

interface ActivePaymentRow {
  id: number;
  invoice_no: string;
  order_no: string;
  is_void?: number;
  status_verifikasi?: string;
}

export class OrderCorrectionService {
  /**
   * Request an order correction for duplicate inputs or administrative errors.
   */
  public requestCorrection(
    orderNo: string,
    payload: RequestCorrectionPayload,
    user?: TokenPayload | null
  ): OrderCorrectionRecord {
    if (!orderNo || !orderNo.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nomor order wajib diisi.");
    }
    if (!payload.category || !payload.category.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Kategori koreksi wajib diisi.");
    }
    if (!payload.reason || !payload.reason.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Alasan pengajuan koreksi wajib diisi.");
    }

    const order = dbOrderRepository.getByOrderNo(orderNo);
    if (!order) {
      throw new ApiError(404, "NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
    }

    // AC2: Cannot request correction on already cancelled order
    const isCancelled = Boolean((order as { isCancelled?: boolean }).isCancelled) || order.currentStageName === "Dibatalkan";
    if (isCancelled) {
      throw new ApiError(
        400,
        "ORDER_ALREADY_CANCELLED",
        `Order '${orderNo}' sudah dibatalkan sebelumnya, pengajuan koreksi ditolak.`
      );
    }

    // AC2: Cannot request correction if another correction is already 'Diajukan'
    const existingPending = dbOrderCorrectionRepository.getPendingByOrderNo(orderNo);
    if (existingPending) {
      throw new ApiError(
        400,
        "DUPLICATE_CORRECTION_REQUEST",
        `Masih terdapat pengajuan koreksi berstatus 'Diajukan' untuk order '${orderNo}'.`
      );
    }

    const id = `corr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowStr = new Date().toISOString();

    const record: OrderCorrectionRecord = {
      id,
      order_no: orderNo,
      category: payload.category.trim(),
      linked_duplicate_order_no: payload.linkedDuplicateOrderNo?.trim() || null,
      reason: payload.reason.trim(),
      status: "Diajukan",
      requested_by: user?.nama || user?.userId || "Admin",
      requested_at: nowStr,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      created_at: nowStr,
      updated_at: nowStr,
    };

    // AC1: Insert into order_corrections; order itself remains unchanged
    dbOrderCorrectionRepository.create(record);

    dbAuditRepository.save({
      id: `log-corr-req-${Date.now()}`,
      userId: user?.userId || "usr-system",
      userName: user?.nama || "Admin API",
      userRole: user?.role || "admin",
      action: "REQUEST_ORDER_CORRECTION",
      module: "Order Correction",
      details: `Pengajuan koreksi untuk order ${orderNo} (${payload.category.trim()}). Alasan: ${payload.reason.trim()}`,
      metadata: {
        orderNo,
        category: payload.category.trim(),
        linkedDuplicateOrderNo: payload.linkedDuplicateOrderNo?.trim() || null,
        reason: payload.reason.trim(),
      },
      createdAt: nowStr,
    });

    return record;
  }

  /**
   * Review an order correction request (Approve or Reject).
   * Restricted strictly to SPV or Administrator roles.
   */
  public reviewCorrection(
    id: string,
    payload: ReviewCorrectionPayload,
    user?: TokenPayload | null
  ): OrderCorrectionRecord {
    // AC5: Non-SPV / non-Admin role check -> 403 Forbidden
    const userRole = (user?.role || "").toLowerCase();
    const isSpvOrAdmin =
      userRole === "administrator" ||
      userRole === "admin" ||
      userRole === "supervisor" ||
      userRole === "spv" ||
      userRole === "svp" ||
      (user as { jabatan?: string } | null | undefined)?.jabatan === "SVP";

    if (!isSpvOrAdmin) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Hanya Supervisor (SPV) atau Administrator yang berwenang meninjau pengajuan koreksi order."
      );
    }

    if (!payload.decision || (payload.decision !== "approve" && payload.decision !== "reject")) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Keputusan review harus bernilai 'approve' atau 'reject'."
      );
    }

    const correction = dbOrderCorrectionRepository.getById(id);
    if (!correction) {
      throw new ApiError(404, "NOT_FOUND", `Pengajuan koreksi #${id} tidak ditemukan.`);
    }

    if (correction.status !== "Diajukan") {
      throw new ApiError(
        400,
        "CORRECTION_ALREADY_REVIEWED",
        `Pengajuan koreksi sudah diproses sebelumnya dengan status '${correction.status}'.`
      );
    }

    const nowStr = new Date().toISOString();

    // AC4: Reject correction -> status 'Ditolak', order & payments remain untouched
    if (payload.decision === "reject") {
      dbOrderCorrectionRepository.updateStatus(
        id,
        "Ditolak",
        user?.nama || "Supervisor",
        payload.reviewNotes || null
      );

      dbAuditRepository.save({
        id: `log-corr-reject-${Date.now()}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Supervisor",
        userRole: user?.role || "supervisor",
        action: "REJECT_ORDER_CORRECTION",
        module: "Order Correction",
        details: `Menolak pengajuan koreksi untuk order ${correction.order_no}. Catatan: ${payload.reviewNotes || "-"}`,
        metadata: {
          correctionId: id,
          orderNo: correction.order_no,
          reviewNotes: payload.reviewNotes,
        },
        createdAt: nowStr,
      });

      return dbOrderCorrectionRepository.getById(id)!;
    }

    // AC3: Approve correction -> run in transaction
    return runInTransaction(() => {
      const voidReason = `Koreksi Order disetujui: ${correction.reason.trim()}`;

      // 1. Cancel order with skipRefundPending: true
      orderService.cancelOrder(
        correction.order_no,
        `Koreksi Order disetujui (${correction.category}): ${correction.reason.trim()}`,
        user,
        { skipRefundPending: true }
      );

      // 2. Void all active payments for this order using voidInvoicePayment
      const inv = dbFinanceRepository.getInvoiceByOrderNo(correction.order_no);
      const rawPayments = dbFinanceRepository.getPaymentsByOrderNo(correction.order_no) as ActivePaymentRow[];
      const activePayments = rawPayments.filter(
        (p) => p.is_void !== 1 && p.status_verifikasi !== "VOID"
      );

      for (const payment of activePayments) {
        const invId = inv ? inv.id : payment.invoice_no;
        financeService.voidInvoicePayment(invId, payment.id, voidReason, user);
      }

      // 3. Ensure finance_invoices ends with CANCELLED, dibayar=0, sisa=0, refundStatus NOT 'PENDING'
      if (inv) {
        dbFinanceRepository.updateInvoice(inv.id, {
          status: "CANCELLED",
          billingStatus: "CANCELLED",
          dibayar: 0,
          sisa: 0,
          overpayment: 0,
          refundStatus: "NONE",
          settlementCondition: undefined,
        });
      }

      // 4. Ensure linked order payment fields are synchronized and clear
      const ord = dbOrderRepository.getByOrderNo(correction.order_no);
      if (ord && ord.payment) {
        dbOrderRepository.saveOrder({
          ...ord,
          currentStageName: "Dibatalkan",
          payment: {
            ...ord.payment,
            dibayar: 0,
            kurang: 0,
            overpayment: 0,
            refundStatus: "NONE",
          },
        });
      }

      // 5. Update order_corrections status -> 'Disetujui'
      dbOrderCorrectionRepository.updateStatus(
        id,
        "Disetujui",
        user?.nama || "Supervisor",
        payload.reviewNotes || null
      );

      // 6. Immutable Audit log
      dbAuditRepository.save({
        id: `log-corr-approve-${Date.now()}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Supervisor",
        userRole: user?.role || "supervisor",
        action: "APPROVE_ORDER_CORRECTION",
        module: "Order Correction",
        details: `Menyetujui koreksi order ${correction.order_no} (${correction.category}). Alasan: ${correction.reason.trim()}`,
        metadata: {
          correctionId: id,
          orderNo: correction.order_no,
          category: correction.category,
          linkedDuplicateOrderNo: correction.linked_duplicate_order_no,
          voidedPaymentsCount: activePayments.length,
          reviewNotes: payload.reviewNotes,
        },
        createdAt: nowStr,
      });

      return dbOrderCorrectionRepository.getById(id)!;
    });
  }

  public getCorrectionById(id: string): OrderCorrectionRecord | undefined {
    return dbOrderCorrectionRepository.getById(id);
  }

  public listCorrections(filters?: { status?: string; orderNo?: string }): OrderCorrectionRecord[] {
    return dbOrderCorrectionRepository.listAll(filters);
  }
}

export const orderCorrectionService = new OrderCorrectionService();
