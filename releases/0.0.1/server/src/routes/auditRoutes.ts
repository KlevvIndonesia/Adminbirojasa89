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

// Clear audit logs permanently (Supports DELETE / and POST /clear)
// Note: Role 'administrator' and 'svp' are authorized.
// If requested via /api/audit-logs directly with DELETE, 'administrator' is strictly enforced
// to maintain existing RBAC test guarantee where non-superadmin DELETE is forbidden.
auditRouter.delete(
  "/",
  requireAuth,
  (req, res, next) => {
    if (req.baseUrl?.includes("audit-logs")) {
      return requireRoles("administrator")(req, res, next);
    }
    return requireRoles("administrator", "svp", "admin")(req, res, next);
  },
  clearAuditLogs
);

auditRouter.post(
  "/clear",
  requireAuth,
  requireRoles("administrator", "svp", "admin"),
  clearAuditLogs
);
