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

export interface AuthUserSession {
  role: 'administrator' | 'finance' | 'admin' | 'messenger';
  name: string;
  userId: string;
  employeeId?: string;
}

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_INACTIVE"
  | "TOO_MANY_REQUESTS"
  | "NETWORK_ERROR"
  | "TIMEOUT_ERROR"
  | "SERVER_ERROR"
  | "VALIDATION_ERROR"
  | "UNEXPECTED_ERROR";

export interface AuthResult {
  success: boolean;
  session?: AuthUserSession;
  errorCode?: AuthErrorCode;
  errorMessage?: string;
  statusCode?: number;
  retryAfterSeconds?: number;
}

export interface IUserDataProvider {
  getAll(): SystemUser[];
  getById(id: number | string): SystemUser | undefined;
  getByEmail(email: string): SystemUser | undefined;
  createUser(user: Omit<SystemUser, "id">): SystemUser;
  updateUser(id: number | string, updates: Partial<SystemUser>): boolean;
  deleteUser(id: number | string): boolean;
  subscribe(listener: () => void): () => void;
  authenticate(email: string, password: string): Promise<AuthUserSession | null>;
  authenticateDetailed?(email: string, password: string): Promise<AuthResult>;
  getDemoCredentials?(): any;
  resetPassword?(id: number | string): Promise<{ success: boolean; message?: string }>;
  isLoading?(): boolean;
  getError?(): string | null;
}
