/**
 * Authentication and Authorization Middleware
 * Admin SUN89 — Biro Jasa Management System
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "../utils/crypto";
import { dbOrderRepository } from "../repositories/dbOrderRepository";
import { dbUserRepository } from "../repositories/dbUserRepository";

export type { TokenPayload };

export interface AuthenticatedRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: TokenPayload | null;
}

export interface TokenValidationResult {
  valid: boolean;
  userPayload: TokenPayload | null;
  errorCode?: "UNAUTHENTICATED" | "REVOKED_IDENTITY" | "ACCOUNT_INACTIVE";
  errorMessage?: string;
}

/**
 * Validates JWT cryptographic signature and strictly enforces real-time database
 * user existence and active status. Immediately rejects revoked/deleted/inactive identities.
 */
export function validateTokenAndUser(token: string): TokenValidationResult {
  if (!token || typeof token !== "string") {
    return { valid: false, userPayload: null, errorCode: "UNAUTHENTICATED", errorMessage: "Token autentikasi tidak disediakan." };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return { valid: false, userPayload: null, errorCode: "UNAUTHENTICATED", errorMessage: "Token autentikasi tidak valid atau telah kedaluwarsa." };
  }

  // Real-time database verification: user MUST exist and MUST be 'Aktif'
  const dbUser = dbUserRepository.getByIdWithCredentials(payload.userId);
  if (!dbUser) {
    return {
      valid: false,
      userPayload: null,
      errorCode: "REVOKED_IDENTITY",
      errorMessage: "Akun pengguna tidak ditemukan atau telah dihapus secara permanen.",
    };
  }

  if (dbUser.status !== "Aktif") {
    return {
      valid: false,
      userPayload: null,
      errorCode: "ACCOUNT_INACTIVE",
      errorMessage: "Akun pengguna telah dinonaktifkan.",
    };
  }

  return { valid: true, userPayload: payload };
}

function extractToken(req: Request): string {
  const authHeader = req.headers["authorization"];
  return authHeader ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim()) : "";
}

/**
 * Optional authentication: decodes token if provided, but does not block anonymous requests.
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  const result = validateTokenAndUser(token);
  req.user = result.valid ? result.userPayload : null;
  next();
}

/**
 * Mandatory authentication: rejects any request lacking a valid, verified JWT
 * or belonging to a deleted / non-active user.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const result = validateTokenAndUser(token);

  if (!result.valid || !result.userPayload) {
    res.status(401).json({
      success: false,
      error: {
        code: result.errorCode || "UNAUTHENTICATED",
        message: result.errorMessage || "Autentikasi diperlukan untuk mengakses resource ini.",
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.user = result.userPayload;
  next();
}

/**
 * Role-based authorization: checks if authenticated user possesses one of the allowed roles.
 * Administrator / SVP retains universal access.
 */
export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const token = extractToken(req);
      const result = validateTokenAndUser(token);
      if (!result.valid || !result.userPayload) {
        res.status(401).json({
          success: false,
          error: {
            code: result.errorCode || "UNAUTHENTICATED",
            message: result.errorMessage || "Autentikasi diperlukan untuk mengakses resource ini.",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      req.user = result.userPayload;
    }

    const userRole = req.user.role;
    const isSvpOrAdministrator = userRole === "administrator" || req.user.jabatan === "SVP";

    if (!allowedRoles.includes(userRole) && !isSvpOrAdministrator) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Role '${userRole}' tidak memiliki izin untuk aksi ini. Role yang diizinkan: ${allowedRoles.join(", ")}`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Stage-level authorization matrix based on application workflow rules.
 */
export function requireStageAuthority(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    const token = extractToken(req);
    const result = validateTokenAndUser(token);
    if (!result.valid || !result.userPayload) {
      res.status(401).json({
        success: false,
        error: { code: result.errorCode || "UNAUTHENTICATED", message: result.errorMessage || "Autentikasi diperlukan." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.user = result.userPayload;
  }

  const userRole = req.user.role;
  const targetStage = req.body?.targetStage || req.body?.nextStage;

  // Administrator / SVP has authority over all 8 stages
  if (userRole === "administrator" || req.user.jabatan === "SVP") {
    return next();
  }

  // Messenger cannot advance order tracking
  if (userRole === "messenger") {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Messenger tidak memiliki akses mutasi Order Tracking." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Finance cannot mutate operational stages
  if (userRole === "finance") {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Finance tidak berwenang mengubah tahapan operasional order." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Admin cannot supervise Stage 6 (advancing FROM Stage 6 to Stage 7)
  const orderNo = req.params?.orderNo;
  const existingOrder = orderNo ? dbOrderRepository.getByOrderNo(orderNo) : null;
  const currentStageName = existingOrder?.currentStageName || "";

  if (userRole === "admin") {
    // Admin is view-only in Stage 6 and cannot approve/advance from Stage 6
    if (currentStageName === "Supervisi" || req.params?.stage === "Supervisi" || req.body?.stage === "Supervisi" || req.body?.currentStage === "Supervisi") {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Hanya SVP yang berwenang melakukan supervisi Stage 6." },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Rollback protection (BD-RBAC-04 / Security Req 4): Admin cannot overturn Stage 6 SVP approvals via rollback
    const isRollback = (req.originalUrl || req.url || "").includes("rollback") || req.path.includes("rollback");
    if (isRollback && existingOrder) {
      const stepMap: Record<string, number> = {
        "Verifikasi": 1,
        "Penjadwalan": 2,
        "Verifikasi Fisik": 3,
        "Proses Samsat": 4,
        "Verifikasi Dokumen": 5,
        "Supervisi": 6,
        "Pengantaran": 7,
        "Dokumen Telah Diterima": 8,
      };
      const targetStageStr = req.body?.targetStage || req.body?.nextStage || "";
      const targetStep = typeof req.body?.targetStep === "number" ? req.body.targetStep : (stepMap[targetStageStr] || 0);
      const currentStep = existingOrder.currentStep || stepMap[existingOrder.currentStageName] || 0;

      if ((currentStep > 6 || existingOrder.documentApproval?.stage6Approved) && targetStep <= 6) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Hanya SVP yang berwenang melakukan rollback order yang telah melewati persetujuan Supervisi (Stage 6).",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }
  }

  next();
}

/**
 * IDOR protection: User may only read/edit their own profile unless they are Administrator or Admin.
 */
export function requireUserSelfOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    const token = extractToken(req);
    const result = validateTokenAndUser(token);
    if (!result.valid || !result.userPayload) {
      res.status(401).json({
        success: false,
        error: { code: result.errorCode || "UNAUTHENTICATED", message: result.errorMessage || "Autentikasi diperlukan." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.user = result.userPayload;
  }

  const targetId = req.params.id;
  const isPrivileged = req.user.role === "administrator" || req.user.role === "admin" || req.user.jabatan === "SVP";
  const isSelf = req.user.userId === `usr-${targetId}` || req.user.userId === String(targetId);

  if (!isPrivileged && !isSelf) {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Anda hanya berwenang mengakses data akun Anda sendiri." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}
