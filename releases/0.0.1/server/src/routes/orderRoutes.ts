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
  requestOrderCorrection,
  approveOrderDocuments,
  verifyOrderCost,
  acceptMessengerTask,
  declineMessengerTask,
  reassignMessengerTask,
  startSamsatProcess,
  completeSamsatProcess,
  startPickupTask,
  completePickupTask,
  releasePickupTask,
  startDeliveryTask,
  completeDeliveryTask,
  releaseDeliveryTask,
  reportSamsatPickupKendala,
  recoverSamsatPickupKendala,
  completeSamsatPickupTask,
  getOrderStatusHistory,
} from "../controllers/orderController";
import { requireAuth, requireRoles, requireStageAuthority } from "../middleware/auth";
import {
  validateOrderCreatePayload,
  validateOrderUpdatePayload,
  validateStageTransitionPayload,
  validateOrderCostVerificationPayload,
} from "../middleware/validation";

export const orderRouter = Router();

// Read operations (Protected against anonymous access)
orderRouter.get("/", requireAuth, getOrders);
orderRouter.get("/archived", requireAuth, getArchivedOrders);
orderRouter.get("/archive", requireAuth, getArchivedOrders);
orderRouter.get("/:orderNo", requireAuth, getOrderByNo);
orderRouter.get("/:orderNo/status-history", requireAuth, getOrderStatusHistory);

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
  requireRoles("administrator", "admin", "finance", "svp", "messenger"),
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
  "/:orderNo/request-correction",
  requireAuth,
  requireRoles("administrator", "admin", "svp", "finance", "staff"),
  requestOrderCorrection
);

orderRouter.post(
  "/:orderNo/verify-cost",
  requireAuth,
  requireRoles("administrator", "admin", "svp", "supervisor", "spv"),
  validateOrderCostVerificationPayload,
  verifyOrderCost
);

orderRouter.post(
  "/:orderNo/approve-documents",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  approveOrderDocuments
);

// Task Lifecycle Operations: Accept, Decline, Reassign
orderRouter.post(
  "/:orderNo/tasks/:taskType/accept",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  acceptMessengerTask
);

orderRouter.post(
  "/:orderNo/tasks/:taskType/decline",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  declineMessengerTask
);

orderRouter.post(
  "/:orderNo/tasks/:taskType/reassign",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  reassignMessengerTask
);

// Samsat Lifecycle Operations: Start & Complete
orderRouter.post(
  "/:orderNo/samsat/start",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  startSamsatProcess
);

orderRouter.post(
  "/:orderNo/samsat/complete",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  completeSamsatProcess
);

// Pickup Lifecycle Operations: Start, Complete & Release (Scope A, B, C)
orderRouter.post(
  "/:orderNo/pickup/start",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  startPickupTask
);

orderRouter.post(
  "/:orderNo/pickup/complete",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  completePickupTask
);

orderRouter.post(
  "/:orderNo/pickup/release",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  releasePickupTask
);

// Delivery Lifecycle Operations: Start, Complete & Release (Scope A, B, C)
orderRouter.post(
  "/:orderNo/delivery/start",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  startDeliveryTask
);

orderRouter.post(
  "/:orderNo/delivery/complete",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  completeDeliveryTask
);

orderRouter.post(
  "/:orderNo/delivery/release",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  releaseDeliveryTask
);

// Phase 4: Jemput Hasil Samsat & Kendala Workflow Operations
orderRouter.post(
  "/:orderNo/samsat-pickup/kendala",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  reportSamsatPickupKendala
);

orderRouter.post(
  "/:orderNo/samsat-pickup/recover",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  recoverSamsatPickupKendala
);

orderRouter.post(
  "/:orderNo/samsat-pickup/complete",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  completeSamsatPickupTask
);
