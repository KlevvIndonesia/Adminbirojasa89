/**
 * Order Correction Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { orderCorrectionService } from "../services/orderCorrectionService";

export async function reviewOrderCorrection(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { decision, reviewNotes } = req.body || {};
    const result = orderCorrectionService.reviewCorrection(
      id,
      { decision, reviewNotes },
      req.user
    );
    res.json({
      success: true,
      message: `Pengajuan koreksi #${id} berhasil di-${decision === "approve" ? "setujui" : "tolak"}.`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrderCorrectionById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const result = orderCorrectionService.getCorrectionById(id);
    if (!result) {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Pengajuan koreksi #${id} tidak ditemukan.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      message: "OK",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function listOrderCorrections(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const orderNo = typeof req.query.orderNo === "string" ? req.query.orderNo : undefined;
    const list = orderCorrectionService.listCorrections({ status, orderNo });
    res.json({
      success: true,
      message: "OK",
      data: list,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
