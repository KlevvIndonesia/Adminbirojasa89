/**
 * Notifications API Contract Signatures
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: Future contract interface only. Not called at runtime during Phase 1.
 */

import { ApiResponse } from "../types/common";

export interface SystemNotificationDto {
  id: string;
  type: "warning" | "info" | "success" | "critical";
  title: string;
  message: string;
  source: "finance" | "order" | "system";
  linkPage?: string;
  timestamp: string;
  isRead: boolean;
}

export interface NotificationsApiContract {
  getNotifications(): Promise<ApiResponse<SystemNotificationDto[]>>;
  markAsRead(id: string): Promise<ApiResponse<void>>;
  markAllAsRead(): Promise<ApiResponse<void>>;
}
