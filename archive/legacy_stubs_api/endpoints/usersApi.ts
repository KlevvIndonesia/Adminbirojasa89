/**
 * Users and Authentication API Contract Signatures
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: Future contract interface only. Not called at runtime during Phase 1.
 */

import { ApiResponse, PaginatedResponse, PaginationQuery } from "../types/common";
import {
  UserDto,
  LoginRequest,
  LoginResponse,
  CreateUserRequest,
  UpdateUserRequest,
} from "../types/user";

export interface UsersApiContract {
  login(payload: LoginRequest): Promise<ApiResponse<LoginResponse>>;
  getUsers(query?: PaginationQuery): Promise<ApiResponse<PaginatedResponse<UserDto>>>;
  getUserById(id: number | string): Promise<ApiResponse<UserDto>>;
  createUser(payload: CreateUserRequest): Promise<ApiResponse<UserDto>>;
  updateUser(id: number | string, payload: UpdateUserRequest): Promise<ApiResponse<UserDto>>;
  deleteUser(id: number | string): Promise<ApiResponse<void>>;
}
