/**
 * Order Routes (Secured & Validated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import {
  getOrders,
  getArchivedOrders,
  getOrderByNo,
  createOrder,
  updateOrder,
  advanceOrder,
  rollbackOrder,
  archiveOrder,
  deleteArchivedOrder,
  hardDeleteOrder,
  clearArchivedOrders,
  verifyPayment,
  cancelOrder,
  approveOrderDocuments,
} from "../controllers/orderController";
import { requireAuth, requireRoles, requireStageAuthority } from "../middleware/auth";
import {
  validateOrderCreatePayload,
  validateOrderUpdatePayload,
  validateStageTransitionPayload,
} from "../middleware/validation";

export const orderRouter = Router();

// Read operations (Protected against anonymous access)
orderRouter.get("/", requireAuth, getOrders);
orderRouter.get("/archived", requireAuth, getArchivedOrders);
orderRouter.get("/archive", requireAuth, getArchivedOrders);
orderRouter.get("/:orderNo", requireAuth, getOrderByNo);

// Write operations (Protected with role and stage authority)
orderRouter.post(
  "/",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  validateOrderCreatePayload,
  createOrder
);

orderRouter.put(
  "/:orderNo",
  requireAuth,
  requireRoles("administrator", "admin", "finance", "svp"),
  validateOrderUpdatePayload,
  updateOrder
);

orderRouter.post(
  "/:orderNo/advance",
  requireAuth,
  requireStageAuthority,
  validateStageTransitionPayload,
  advanceOrder
);

orderRouter.post(
  "/:orderNo/rollback",
  requireAuth,
  requireStageAuthority,
  validateStageTransitionPayload,
  rollbackOrder
);

// Canonical endpoint for clearing all archived orders
orderRouter.delete(
  "/archive/clear-all",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  clearArchivedOrders
);
// Backward-compatibility route alias for legacy callers
orderRouter.delete(
  "/archived/clear-all",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  clearArchivedOrders
);

orderRouter.post(
  "/:orderNo/archive",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  archiveOrder
);

orderRouter.delete(
  "/:orderNo/archive",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  deleteArchivedOrder
);

orderRouter.delete(
  "/:orderNo",
  requireAuth,
  requireRoles("administrator", "admin", "finance", "svp"),
  hardDeleteOrder
);

orderRouter.post(
  "/:orderNo/verify-payment",
  requireAuth,
  requireRoles("administrator", "admin", "finance", "svp"),
  verifyPayment
);

orderRouter.post(
  "/:orderNo/cancel",
  requireAuth,
  requireRoles("administrator", "admin", "svp", "finance"),
  cancelOrder
);

orderRouter.post(
  "/:orderNo/approve-documents",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  approveOrderDocuments
);
