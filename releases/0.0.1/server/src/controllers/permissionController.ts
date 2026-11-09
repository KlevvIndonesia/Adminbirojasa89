/**
 * Permission Management Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { dbPermissionRepository } from "../repositories/dbPermissionRepository";
import { dbAuditRepository } from "../repositories/dbAuditRepository";

export async function getPermissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const matrix = dbPermissionRepository.getAll();
    res.json({
      success: true,
      data: matrix,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateRolePermissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const role = (req.params.role || "").toLowerCase().trim();

    if (role === "svp" || role === "administrator") {
      res.status(400).json({
        success: false,
        error: {
          code: "IMMUTABLE_ROLE",
          message: "Hak akses role SVP bersifat absolut dan tidak dapat diubah.",
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!["admin", "finance", "messenger"].includes(role)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ROLE",
          message: `Role '${role}' tidak valid untuk pengelolaan hak akses.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const permissions = req.body?.permissions || req.body;
    if (!permissions || typeof permissions !== "object" || !permissions.modules || !permissions.stages) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "Payload permission harus menyertakan konfigurasi 'modules' dan 'stages'.",
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updatedBy = req.user
      ? `${req.user.nama || req.user.email} (${req.user.role})`
      : "Admin Sistem";

    dbPermissionRepository.saveRole(role, permissions, updatedBy);

    // Audit log entry
    dbAuditRepository.save({
      id: `log-perm-${Date.now()}`,
      userId: req.user?.userId || "usr-admin",
      userName: req.user?.nama || "Administrator",
      userRole: req.user?.role || "administrator",
      action: "UPDATE_PERMISSIONS",
      module: "Hak Akses",
      details: `Memperbarui matriks hak akses untuk role ${role.toUpperCase()}`,
      metadata: { role, permissions },
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Hak akses untuk role ${role.toUpperCase()} berhasil disimpan.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    next(err);
  }
}

export async function resetPermissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updatedBy = req.user
      ? `${req.user.nama || req.user.email} (${req.user.role})`
      : "Admin Sistem";

    dbPermissionRepository.resetToDefaults(updatedBy);

    dbAuditRepository.save({
      id: `log-perm-reset-${Date.now()}`,
      userId: req.user?.userId || "usr-admin",
      userName: req.user?.nama || "Administrator",
      userRole: req.user?.role || "administrator",
      action: "RESET_PERMISSIONS",
      module: "Hak Akses",
      details: "Mengembalikan seluruh matriks hak akses ke standar sistem",
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Seluruh hak akses berhasil dikembalikan ke standar sistem.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
