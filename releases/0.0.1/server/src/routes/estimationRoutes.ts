/**
 * Estimation Routes (Secured & Validated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import {
  getTemplates,
  getTemplateById,
  updateTemplate,
  resetTemplate,
  resetAllTemplates,
} from "../controllers/estimationController";
import { requireAuth, requireRoles, authenticateToken } from "../middleware/auth";

export const estimationRouter = Router();

// Read operations (allow authenticated users or fallback)
estimationRouter.get("/templates", authenticateToken, getTemplates);
estimationRouter.get("/templates/:id", authenticateToken, getTemplateById);

// Write operations (Administrator & Admin only)
estimationRouter.put(
  "/templates/:id",
  requireAuth,
  requireRoles("administrator", "admin"),
  updateTemplate
);

estimationRouter.post(
  "/templates/:id/reset",
  requireAuth,
  requireRoles("administrator", "admin"),
  resetTemplate
);

estimationRouter.post(
  "/reset-all",
  requireAuth,
  requireRoles("administrator", "admin"),
  resetAllTemplates
);
