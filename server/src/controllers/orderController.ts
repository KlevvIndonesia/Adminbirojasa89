/**
 * Order Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { orderService } from "../services/orderService";
import { orderCorrectionService } from "../services/orderCorrectionService";

export async function getOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const flat = req.query.flat === "true";
    if (flat) {
      const orders = orderService.getAllFlat(false);
      res.json({ success: true, message: "OK", data: orders, timestamp: new Date().toISOString() });
    } else {
      const orders = orderService.getActiveOrders();
      res.json({ success: true, message: "OK", data: orders, timestamp: new Date().toISOString() });
    }
  } catch (err) {
    next(err);
  }
}

export async function getArchivedOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const archived = orderService.getAllFlat(true);
    res.json({ success: true, message: "OK", data: archived, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getOrderByNo(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo } = req.params;
    const order = orderService.getByOrderNo(orderNo);
    res.json({ success: true, message: "OK", data: order, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const idempotencyKey = (req.headers["x-idempotency-key"] as string) || req.body?.clientRequestId;
    const { order, isExisting } = orderService.createOrderWithIdempotency(req.body, req.user, idempotencyKey);
    res.status(isExisting ? 200 : 201).json({
      success: true,
      message: isExisting ? "Order sudah ada (idempotent)." : "Order berhasil dibuat.",
      data: order,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo } = req.params;
    const order = orderService.updateOrder(orderNo, req.body, req.user);
    res.json({ success: true, message: "Order berhasil diperbarui.", data: order, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function advanceOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo } = req.params;
    const { targetStage, updates } = req.body;
    const order = orderService.advanceOrder(orderNo, targetStage, updates, req.user);
    res.json({ success: true, message: `Order berhasil dimajukan ke ${targetStage}.`, data: order, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function rollbackOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo } = req.params;
    const { targetStage, updates } = req.body;
    const order = orderService.rollbackOrder(orderNo, targetStage, updates, req.user);
    res.json({ success: true, message: `Order dikembalikan ke ${targetStage}.`, data: order, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function archiveOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo } = req.params;
    const success = orderService.archiveOrder(orderNo, req.user);
    res.json({ success, message: "Order berhasil diarsipkan.", timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function approveOrderDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
    }
    const { orderNo } = req.params;
    const { stage, snapshotDocs } = req.body;
    if (stage !== 5 && stage !== 6) {
      throw new ApiError(400, "VALIDATION_ERROR", "Field 'stage' harus bernilai 5 atau 6.");
    }
    if (stage === 6) {
      const isSpv = req.user.role === "administrator" || req.user.jabatan === "SVP" || req.user.role === "svp";
      if (!isSpv) {
        throw new ApiError(403, "FORBIDDEN", "Hanya Supervisor / SVP yang berwenang menyetujui dokumen Stage 6.");
      }
    }
    const order = orderService.approveOrderDocuments(orderNo, stage, req.user, snapshotDocs || []);
    res.json({
      success: true,
      message: `Dokumen untuk order ${orderNo} berhasil disetujui (Stage ${stage}).`,
      data: order,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteArchivedOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo } = req.params;
    const success = orderService.deleteArchivedOrder(orderNo, req.user);
    if (!success) {
      res.status(404).json({ success: false, message: "Rekap order arsip tidak ditemukan" });
      return;
    }
    res.json({ success: true, message: "Rekap order berhasil dihapus", timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function hardDeleteOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo } = req.params;
    const success = orderService.hardDeleteOrder(orderNo, req.user);
    if (!success) {
      res.status(404).json({ success: false, message: `Data order ${orderNo} tidak ditemukan atau sudah dihapus` });
      return;
    }
    res.json({ success: true, message: `Data order ${orderNo} berhasil dihapus permanen`, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function clearArchivedOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const clearedCount = orderService.clearArchivedOrders(req.user);
    res.json({
      success: true,
      message: "Rekap Order berhasil dibersihkan.",
      data: { clearedCount },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo } = req.params;
    const verifierName = req.user?.nama || req.body.verifierName || "Admin";
    const confirmedAmount = req.body.confirmedAmount !== undefined ? Number(req.body.confirmedAmount) : undefined;
    const notes = req.body.notes;
    const proofPayload = req.body.buktiPembayaran || req.body.proofPayload || req.body.proof;
    const order = orderService.verifyPayment(orderNo, verifierName, req.user, confirmedAmount, notes, proofPayload);
    res.json({ success: true, message: "Pembayaran berhasil diverifikasi.", data: order, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo } = req.params;
    const reason = req.body.reason || req.body.alasan || "";
    const order = orderService.cancelOrder(orderNo, reason, req.user);
    res.json({
      success: true,
      message: `Order ${orderNo} berhasil dibatalkan.`,
      data: order,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function acceptMessengerTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo, taskType } = req.params;
    const order = orderService.acceptMessengerTask(orderNo, decodeURIComponent(taskType), req.user!);
    res.json({
      success: true,
      message: `Tugas ${decodeURIComponent(taskType)} berhasil diterima.`,
      data: order,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function declineMessengerTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo, taskType } = req.params;
    const { reason } = req.body || {};
    const order = orderService.declineMessengerTask(orderNo, decodeURIComponent(taskType), reason, req.user!);
    res.json({
      success: true,
      message: `Tugas ${decodeURIComponent(taskType)} berhasil ditolak.`,
      data: order,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function reassignMessengerTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderNo, taskType } = req.params;
    const { newCourierName, newCourierId, reason } = req.body || {};
    const order = orderService.reassignMessengerTask(
      orderNo,
      decodeURIComponent(taskType),
      newCourierName,
      newCourierId,
      reason,
      req.user!
    );
    res.json({
      success: true,
      message: `Tugas ${decodeURIComponent(taskType)} berhasil dialihkan ke ${newCourierName}.`,
      data: order,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function requestOrderCorrection(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { orderNo } = req.params;
    const { category, linkedDuplicateOrderNo, reason } = req.body || {};
    const result = orderCorrectionService.requestCorrection(
      orderNo,
      { category, linkedDuplicateOrderNo, reason },
      req.user
    );
    res.status(201).json({
      success: true,
      message: `Pengajuan koreksi untuk order ${orderNo} berhasil dicatat.`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
