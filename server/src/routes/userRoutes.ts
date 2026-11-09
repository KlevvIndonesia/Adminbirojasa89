/**
 * User Routes (Secured & Validated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  preflightPermanentErasure,
  permanentErasureUser,
  retryFileDeletionJob,
} from "../controllers/userController";
import { requireAuth, requireRoles, requireUserSelfOrAdmin } from "../middleware/auth";
import { validateUserMutationPayload } from "../middleware/validation";

export const userRouter = Router();

// List all users (Administrator & Admin only to protect employee PII)
userRouter.get(
  "/",
  requireAuth,
  requireRoles("administrator", "admin"),
  getUsers
);

// Get user profile (Protected: Administrator, Admin, or self)
userRouter.get(
  "/:id",
  requireAuth,
  requireUserSelfOrAdmin,
  getUserById
);

// User mutations (Administrator & Admin only)
userRouter.post(
  "/",
  requireAuth,
  requireRoles("administrator", "admin"),
  validateUserMutationPayload,
  createUser
);

userRouter.put(
  "/:id",
  requireAuth,
  requireRoles("administrator", "admin"),
  validateUserMutationPayload,
  updateUser
);

userRouter.delete(
  "/:id",
  requireAuth,
  requireRoles("administrator", "admin"),
  deleteUser
);

// Reset password to date-of-birth (Administrator & Admin only)
userRouter.post(
  "/:id/reset-password",
  requireAuth,
  requireRoles("administrator", "admin"),
  resetUserPassword
);

// Permanent Erasure Preflight Check (Administrator only)
userRouter.get(
  "/:id/permanent-erasure-preflight",
  requireAuth,
  requireRoles("administrator"),
  preflightPermanentErasure
);

// Permanent Erasure Execution (Administrator only, requires 'HAPUS PERMANEN')
userRouter.post(
  "/:id/permanent-erasure",
  requireAuth,
  requireRoles("administrator"),
  permanentErasureUser
);

// File Deletion Job Retry (Administrator only)
userRouter.post(
  "/file-deletion-jobs/:jobId/retry",
  requireAuth,
  requireRoles("administrator"),
  retryFileDeletionJob
);
