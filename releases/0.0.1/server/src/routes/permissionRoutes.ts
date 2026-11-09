/**
 * Permission Routes (Secured & Gated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import {
  getPermissions,
  updateRolePermissions,
  resetPermissions,
} from "../controllers/permissionController";
import { requireAuth, requireRoles } from "../middleware/auth";

export const permissionRouter = Router();

// Retrieve full permissions matrix (Any authenticated user can read permissions for their session)
permissionRouter.get("/", requireAuth, getPermissions);

// Update permissions for a specific role (Only Administrator / SVP)
permissionRouter.put("/:role", requireAuth, requireRoles("administrator"), updateRolePermissions);

// Reset all permissions to canonical defaults (Only Administrator / SVP)
permissionRouter.post("/reset", requireAuth, requireRoles("administrator"), resetPermissions);
