/**
 * Messenger REST API Routes
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import { requireAuth, requireRoles } from "../middleware/auth";
import {
  getMessengersWithStats,
  getMessengerHistory,
  getTaskDetail,
  getReimbursements,
  createReimbursement,
  reviewReimbursement,
  payReimbursement,
  voidReimbursement,
} from "../controllers/messengerController";

export const messengerRouter = Router();

// 1. Messenger Selection & Statistics
messengerRouter.get(
  "/messengers",
  requireAuth,
  requireRoles("administrator", "admin", "finance", "messenger"),
  getMessengersWithStats
);

// 2. Task History List
messengerRouter.get(
  "/history",
  requireAuth,
  requireRoles("administrator", "admin", "finance", "messenger"),
  getMessengerHistory
);

// 3. Task Detail (Chronology, Attachments, Reimbursements)
messengerRouter.get(
  "/tasks/:orderNo",
  requireAuth,
  requireRoles("administrator", "admin", "finance", "messenger"),
  getTaskDetail
);

// 4. Reimbursement List
messengerRouter.get(
  "/reimbursements",
  requireAuth,
  requireRoles("administrator", "admin", "finance", "messenger"),
  getReimbursements
);

// 5. Submit Reimbursement
messengerRouter.post(
  "/reimbursements",
  requireAuth,
  requireRoles("administrator", "admin", "messenger"),
  createReimbursement
);

// 6. Review Reimbursement (Approve / Reject)
messengerRouter.patch(
  "/reimbursements/:id/review",
  requireAuth,
  requireRoles("administrator", "admin", "finance"),
  reviewReimbursement
);

// 7. Pay / Realize Reimbursement
messengerRouter.post(
  "/reimbursements/:id/pay",
  requireAuth,
  requireRoles("administrator", "finance"),
  payReimbursement
);

// 8. Void / Reversal Reimbursement (Supervisor / Admin only)
messengerRouter.post(
  "/reimbursements/:id/void",
  requireAuth,
  requireRoles("administrator", "supervisor", "svp"),
  voidReimbursement
);
