/**
 * Future API Messenger DTOs
 * Admin SUN89 — Biro Jasa Management System
 */

import { MessengerTaskItem, MessengerTaskStatus } from "../../domain/messenger/types";
import { PaginationQuery } from "./common";

export interface UpdateMessengerTaskStatusRequest {
  orderNo: string;
  status: MessengerTaskStatus;
  notes?: string;
}

export interface MessengerTaskListQuery extends PaginationQuery {
  messenger?: string;
  status?: MessengerTaskStatus;
}

export type MessengerTaskDto = MessengerTaskItem;
