/**
 * Canonical Domain Types for Users, Roles, and Access Management
 * Admin SUN89 — Biro Jasa Management System
 */

export type UserRole = "administrator" | "finance" | "admin" | "messenger" | "SVP" | "CLILEN" | string;

export interface SystemUser {
  id: number | string;
  nama: string;
  jabatan: string;
  email: string;
  status: "Aktif" | "Nonaktif" | string;
  telepon?: string;
  phone?: string;
  avatar?: string;
  wilayah?: string;
  alamat?: string;
  employeeId?: string;
  employee_id?: string | null;
  role?: string;
  avatarUrl?: string;
  tanggalLahir?: string;
  gajiPokok?: number;
  tanggalBergabung?: string;
  jenisKelamin?: string;
  lastLogin?: string;
  last_login_at?: string;
  createdAt?: string;
}

export interface UserPermission {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove?: boolean;
}

export interface UserAccess {
  userId: number | string;
  role: UserRole;
  permissions: UserPermission[];
}
