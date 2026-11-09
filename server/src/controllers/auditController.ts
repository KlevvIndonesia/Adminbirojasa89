/**
 * Audit Log Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { auditService } from "../services/auditService";

export async function getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = {
      userId: req.query.userId as string,
      module: req.query.module as string,
      action: req.query.action as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };
    const logs = auditService.getLogs(filters);
    res.json({ success: true, message: "OK", data: logs, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function recordAuditLog(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const log = auditService.recordLog(req.body, req.user);
    res.status(201).json({ success: true, message: "Log berhasil dicatat.", data: log, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function clearAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const result = auditService.clearLogs(req.user, ip);
    res.json({
      success: true,
      message: `Riwayat aktivitas berhasil dibersihkan (${result.deletedCount} log dihapus).`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
