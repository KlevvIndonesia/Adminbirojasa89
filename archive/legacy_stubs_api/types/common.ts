/**
 * Common Future API Contract Types
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: This is a contract specification for future backend integration.
 * No runtime network requests are executed.
 */

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
