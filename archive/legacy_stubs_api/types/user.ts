/**
 * Future API User and Auth DTOs
 * Admin SUN89 — Biro Jasa Management System
 */

import { SystemUser, UserRole } from "../../domain/user/types";

export interface LoginRequest {
  email: string;
  password?: string;
  role?: UserRole;
}

export interface LoginResponse {
  token: string;
  user: SystemUser;
  expiresIn: number;
}

export interface CreateUserRequest {
  nama: string;
  jabatan: string;
  email: string;
  status: "Aktif" | "Nonaktif";
}

export interface UpdateUserRequest {
  nama?: string;
  jabatan?: string;
  email?: string;
  status?: "Aktif" | "Nonaktif";
}

export type UserDto = SystemUser;
