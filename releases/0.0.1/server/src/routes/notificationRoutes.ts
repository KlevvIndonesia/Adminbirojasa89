/**
 * Notification Routes
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestEmail,
  getNotificationLogs,
} from "../controllers/notificationController";
import { requireAuth, requireRoles } from "../middleware/auth";

export const notificationRouter = Router();

// Retrieve global notification settings & SMTP engine status
notificationRouter.get(
  "/settings",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  getNotificationSettings
);

// Update global notification settings
notificationRouter.put(
  "/settings",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  updateNotificationSettings
);

// Trigger a diagnostic test email
notificationRouter.post(
  "/test-email",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  sendTestEmail
);

// Get historical notification delivery logs
notificationRouter.get(
  "/logs",
  requireAuth,
  requireRoles("administrator", "admin", "svp"),
  getNotificationLogs
);
