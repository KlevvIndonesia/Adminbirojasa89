/**
 * Audit Log Routes (Secured & Validated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import { getAuditLogs, recordAuditLog } from "../controllers/auditController";
import { requireAuth, requireRoles } from "../middleware/auth";

export const auditRouter = Router();

// Read audit logs (Administrator & SVP only to protect operational audit trail)
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
