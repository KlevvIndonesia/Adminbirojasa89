/**
 * Service Routes (Secured & Validated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import { getServices, getServiceById, updateService, deleteService } from "../controllers/serviceController";
import { requireAuth, requireRoles } from "../middleware/auth";

export const serviceRouter = Router();

// Read operations (Protected with authentication)
serviceRouter.get("/", requireAuth, getServices);
serviceRouter.get("/:id", requireAuth, getServiceById);

// Update operation (Administrator & Admin & SVP only)
serviceRouter.put(
  "/:id",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  updateService
);

// Delete / Deactivate operation (Administrator & Admin only)
serviceRouter.delete(
  "/:id",
  requireAuth,
  requireRoles("administrator", "admin"),
  deleteService
);
