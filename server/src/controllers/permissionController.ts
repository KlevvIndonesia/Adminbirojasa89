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
  res.status(405).json({
    success: false,
    error: {
      code: "STATIC_RBAC_ENFORCED",
      message: "Kebijakan hak akses bersifat statis dan perubahan dinamis telah dinonaktifkan (BD-RBAC-06).",
    },
    timestamp: new Date().toISOString(),
  });
}

export async function resetPermissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  res.status(405).json({
    success: false,
    error: {
      code: "STATIC_RBAC_ENFORCED",
      message: "Kebijakan hak akses bersifat statis dan reset dinamis telah dinonaktifkan (BD-RBAC-06).",
    },
    timestamp: new Date().toISOString(),
  });
}
