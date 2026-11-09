/**
 * Notification Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationConfigService } from "../services/notificationConfigService";

export async function getNotificationSettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = notificationConfigService.getSettings();
    const smtpStatus = notificationConfigService.getSmtpStatus();

    res.json({
      success: true,
      message: "Pengaturan notifikasi berhasil diambil.",
      data: {
        settings,
        smtpStatus,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationSettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updatedBy = req.user ? `${req.user.nama || req.user.email || "Admin"} (${req.user.role})` : "Admin Sistem";
    const updated = notificationConfigService.updateSettings(req.body, updatedBy);
    const smtpStatus = notificationConfigService.getSmtpStatus();

    res.json({
      success: true,
      message: "Pengaturan notifikasi berhasil disimpan.",
      data: {
        settings: updated,
        smtpStatus,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err.message || "Gagal memperbarui pengaturan notifikasi.",
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export async function sendTestEmail(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body || {};
    const requestedBy = req.user ? `${req.user.nama || req.user.email || "Admin"} (${req.user.role})` : "Admin Sistem";

    const result = await notificationConfigService.sendTestEmail(email, requestedBy);

    // If SMTP is not configured, send HTTP 200 with success: false (or 400),
    // but with the explicit status and log so UI can cleanly display honest feedback.
    res.json({
      success: result.success,
      message: result.message,
      data: {
        log: result.log,
        smtpStatus: notificationConfigService.getSmtpStatus(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || "Gagal melakukan pengujian email.",
      timestamp: new Date().toISOString(),
    });
  }
}

export async function getNotificationLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = notificationConfigService.getLogs(isNaN(limit) ? 50 : limit);

    res.json({
      success: true,
      message: "Riwayat log notifikasi berhasil diambil.",
      data: logs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
