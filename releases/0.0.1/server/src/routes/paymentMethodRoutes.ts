/**
 * Payment Method Routes
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import {
  getPaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from "../controllers/paymentMethodController";
import { requireAuth, requireRoles } from "../middleware/auth";

export const paymentMethodRouter = Router();

// Read operations
paymentMethodRouter.get("/", requireAuth, getPaymentMethods);
paymentMethodRouter.get("/:id", requireAuth, getPaymentMethodById);

// Create, Update, Delete (Administrator, Admin, and Finance)
paymentMethodRouter.post("/", requireAuth, requireRoles("administrator", "admin", "finance"), createPaymentMethod);
paymentMethodRouter.put("/:id", requireAuth, requireRoles("administrator", "admin", "finance"), updatePaymentMethod);
paymentMethodRouter.delete("/:id", requireAuth, requireRoles("administrator", "admin", "finance"), deletePaymentMethod);
