/**
 * Messengers API Contract Signatures
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: Future contract interface only. Not called at runtime during Phase 1.
 */

import { ApiResponse, PaginatedResponse } from "../types/common";
import {
  MessengerTaskDto,
  UpdateMessengerTaskStatusRequest,
  MessengerTaskListQuery,
} from "../types/messenger";

export interface MessengersApiContract {
  getTasks(query?: MessengerTaskListQuery): Promise<ApiResponse<PaginatedResponse<MessengerTaskDto>>>;
  getTaskById(id: string | number): Promise<ApiResponse<MessengerTaskDto>>;
  updateTaskStatus(payload: UpdateMessengerTaskStatusRequest): Promise<ApiResponse<MessengerTaskDto>>;
  getAvailableMessengers(): Promise<ApiResponse<string[]>>;
}
