/**
 * Order Correction Routes
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import { requireAuth, requireRoles } from "../middleware/auth";
import {
  reviewOrderCorrection,
  getOrderCorrectionById,
  listOrderCorrections,
} from "../controllers/orderCorrectionController";

export const orderCorrectionRouter = Router();

orderCorrectionRouter.get("/", requireAuth, listOrderCorrections);
orderCorrectionRouter.get("/:id", requireAuth, getOrderCorrectionById);
orderCorrectionRouter.post(
  "/:id/review",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  reviewOrderCorrection
);
