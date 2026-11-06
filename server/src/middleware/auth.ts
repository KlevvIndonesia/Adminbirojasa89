/**
 * Authentication and Authorization Middleware
 * Admin SUN89 — Biro Jasa Management System
 */

import { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "../utils/crypto";
import { dbOrderRepository } from "../repositories/dbOrderRepository";

export type { TokenPayload };

export interface AuthenticatedRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: TokenPayload | null;
}

/**
 * Optional authentication: decodes token if provided, but does not block anonymous requests.
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim()) : "";
  if (!token) {
    req.user = null;
    return next();
  }

  const payload = verifyToken(token);
  req.user = payload;
  next();
}

/**
 * Mandatory authentication: rejects any request lacking a valid, verified JWT.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    const authHeader = req.headers["authorization"];
    const token = authHeader ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim()) : "";
    if (token) {
      req.user = verifyToken(token);
    }
  }

  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Autentikasi diperlukan untuk mengakses resource ini.",
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next();
}

/**
 * Role-based authorization: checks if authenticated user possesses one of the allowed roles.
 * Administrator / SVP retains universal access.
 */
export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const authHeader = req.headers["authorization"];
      const token = authHeader ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim()) : "";
      if (token) {
        req.user = verifyToken(token);
      }
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Autentikasi diperlukan untuk mengakses resource ini.",
        },
        timestamp: new Date().toISOString(),
      });
      return;
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
    const authHeader = req.headers["authorization"];
    if (authHeader) {
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
      req.user = verifyToken(token);
    }
  }

  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Autentikasi diperlukan." },
      timestamp: new Date().toISOString(),
    });
    return;
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
  let currentStageName = "";
  if (orderNo) {
    const existingOrder = dbOrderRepository.getByOrderNo(orderNo);
    currentStageName = existingOrder?.currentStageName || "";
  }

  if (userRole === "admin") {
    // Admin is view-only in Stage 6 and cannot approve/advance from Stage 6
    if (currentStageName === "Supervisi" || req.params?.stage === "Supervisi") {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Hanya Supervisor / SVP yang berwenang melakukan supervisi Stage 6." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  next();
}

/**
 * IDOR protection: User may only read/edit their own profile unless they are Administrator or Admin.
 */
export function requireUserSelfOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    const authHeader = req.headers["authorization"];
    if (authHeader) {
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
      req.user = verifyToken(token);
    }
  }

  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Autentikasi diperlukan." },
      timestamp: new Date().toISOString(),
    });
    return;
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
