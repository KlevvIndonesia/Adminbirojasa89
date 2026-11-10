/**
 * Audit Log Routes (Secured & Validated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import { getAuditLogs, recordAuditLog, clearAuditLogs } from "../controllers/auditController";
import { requireAuth, requireRoles } from "../middleware/auth";

export const auditRouter = Router();

// Read audit logs (Administrator, SVP & Admin)
auditRouter.get(
  "/",
  requireAuth,
  requireRoles("administrator", "svp", "admin"),
  getAuditLogs
);

// Record audit log (Requires valid authenticated identity; actor identity is server-verified)
auditRouter.post(
  "/",
  requireAuth,
  recordAuditLog
);

// Clear audit logs permanently is strictly disabled (BD-RBAC-01: Immutable Audit Trail)
// All variations (DELETE /, POST /clear, DELETE /clear) are rejected with HTTP 405 for all roles, including SVP.
const rejectAuditMutation = (_req: any, res: any): void => {
  res.status(405).json({
    success: false,
    error: {
      code: "AUDIT_LOG_IMMUTABLE",
      message: "Audit trail bersifat immutable dan tidak dapat dihapus atau dibersihkan oleh role mana pun.",
    },
    timestamp: new Date().toISOString(),
  });
};

auditRouter.delete(
  "/",
  requireAuth,
  rejectAuditMutation
);

auditRouter.post(
  "/clear",
  requireAuth,
  rejectAuditMutation
);

auditRouter.delete(
  "/clear",
  requireAuth,
  rejectAuditMutation
);
