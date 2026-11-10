/**
 * Mock User Data Provider
 * Admin SUN89 — Biro Jasa Management System
 */

import { SystemUser } from "../../../src/domain/user/types";
import { InMemoryStorage } from "../../../src/data/storage/memoryStorage";
import { AuthUserSession, AuthResult } from "../../../src/domain/user/types";

export const DEMO_CREDENTIALS = {
  administrator: {
    email: "svp@birojasa.com",
    password: "admin123",
    name: "Admin Super (SVP)",
    userId: "usr-001",
    employeeId: "EMP-0001",
    role: "administrator" as const,
  },
  finance: {
    email: "finance@birojasa.com",
    password: "finance123",
    name: "Finance User",
    userId: "usr-002",
    employeeId: "EMP-0003",
    role: "finance" as const,
  },
  admin: {
    email: "admin@birojasa.com",
    password: "admin123",
    name: "Admin User",
    userId: "usr-003",
    employeeId: "EMP-0002",
    role: "admin" as const,
  },
  messenger1: {
    email: "budi.messenger@birojasa.com",
    password: "messenger123",
    name: "Budi Santoso",
    userId: "usr-msg-001",
    employeeId: "EMP-0004",
    role: "messenger" as const,
  },
  messenger2: {
    email: "andi.messenger@birojasa.com",
    password: "messenger123",
    name: "Andi Pratama",
    userId: "usr-msg-002",
    employeeId: "EMP-0005",
    role: "messenger" as const,
  },
  messenger: {
    email: "messenger@birojasa.com",
    password: "messenger123",
    name: "Budi Santoso",
    userId: "usr-msg-001",
    employeeId: "EMP-0004",
    role: "messenger" as const,
  },
};

export const initialUsers: SystemUser[] = [
  { id: 1, nama: "Admin Utama", jabatan: "ADMIN", email: "admin@birojasa.com", status: "Aktif" },
  { id: 2, nama: "Budi Santoso", jabatan: "SVP", email: "budi.santoso@birojasa.com", status: "Aktif" },
  { id: 3, nama: "Siti Nurhaliza", jabatan: "ADMIN", email: "siti.nur@birojasa.com", status: "Aktif" },
  { id: 4, nama: "Andi Wijaya", jabatan: "FINANCE", email: "andi.wijaya@birojasa.com", status: "Aktif" },
  { id: 5, nama: "Dewi Lestari", jabatan: "CLILEN", email: "dewi.lestari@birojasa.com", status: "Aktif" },
  { id: 6, nama: "Rudi Hartono", jabatan: "MESSENGER", email: "rudi.hartono@birojasa.com", status: "Aktif" },
  { id: 7, nama: "Maya Safitri", jabatan: "ADMIN", email: "maya.safitri@birojasa.com", status: "Aktif" },
  { id: 8, nama: "Joko Widodo", jabatan: "MESSENGER", email: "joko.widodo@birojasa.com", status: "Aktif" },
  { id: 9, nama: "Nina Rahayu", jabatan: "CLILEN", email: "nina.rahayu@birojasa.com", status: "Nonaktif" },
  { id: 10, nama: "Eko Prasetyo", jabatan: "FINANCE", email: "eko.prasetyo@birojasa.com", status: "Aktif" },
  { id: 11, nama: "Linda Permata", jabatan: "ADMIN", email: "linda.permata@birojasa.com", status: "Aktif" },
  { id: 12, nama: "Agus Salim", jabatan: "MESSENGER", email: "agus.salim@birojasa.com", status: "Aktif" },
  { id: 13, nama: "Rina Susanti", jabatan: "CLILEN", email: "rina.susanti@birojasa.com", status: "Nonaktif" },
  { id: 14, nama: "Dedi Cahyadi", jabatan: "SVP", email: "dedi.cahyadi@birojasa.com", status: "Aktif" },
  { id: 15, nama: "Fitri Handayani", jabatan: "ADMIN", email: "fitri.handayani@birojasa.com", status: "Aktif" },
  { id: 16, nama: "Yanto Prakarsa", jabatan: "MESSENGER", email: "yanto.prakarsa@birojasa.com", status: "Aktif" },
  { id: 17, nama: "Wati Kurniasih", jabatan: "FINANCE", email: "wati.kurniasih@birojasa.com", status: "Aktif" },
  { id: 18, nama: "Hendro Utomo", jabatan: "MESSENGER", email: "hendro.utomo@birojasa.com", status: "Nonaktif" },
  { id: 19, nama: "Sri Mulyani", jabatan: "ADMIN", email: "sri.mulyani@birojasa.com", status: "Aktif" },
  { id: 20, nama: "Bambang Suryanto", jabatan: "CLILEN", email: "bambang.suryanto@birojasa.com", status: "Aktif" },
  { id: 21, nama: "Tina Marlina", jabatan: "FINANCE", email: "tina.marlina@birojasa.com", status: "Aktif" },
  { id: 22, nama: "Aris Budiman", jabatan: "MESSENGER", email: "aris.budiman@birojasa.com", status: "Aktif" },
  { id: 23, nama: "Lilis Suryani", jabatan: "ADMIN", email: "lilis.suryani@birojasa.com", status: "Aktif" },
  { id: 24, nama: "Hadi Gunawan", jabatan: "SVP", email: "hadi.gunawan@birojasa.com", status: "Aktif" },
  { id: 25, nama: "Novi Andriani", jabatan: "CLILEN", email: "novi.andriani@birojasa.com", status: "Nonaktif" },
];

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
  getDemoCredentials(): typeof DEMO_CREDENTIALS;
  resetPassword?(id: number | string): Promise<{ success: boolean; message?: string }>;
  isLoading?(): boolean;
  getError?(): string | null;
}

export class MockUserProvider implements IUserDataProvider {
  private storage: InMemoryStorage<SystemUser>;
  private nextId = 26;

  public isLoading(): boolean {
    return false;
  }

  public getError(): string | null {
    return null;
  }

  constructor() {
    const map = new Map<string, SystemUser>();
    initialUsers.forEach((u) => map.set(String(u.id), u));
    this.storage = new InMemoryStorage<SystemUser>(Array.from(map.entries()));
  }

  public getAll(): SystemUser[] {
    return this.storage.getAllValues();
  }

  public getById(id: number | string): SystemUser | undefined {
    return this.storage.get(String(id));
  }

  public getByEmail(email: string): SystemUser | undefined {
    return this.getAll().find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(userData: Omit<SystemUser, "id">): SystemUser {
    const newUser: SystemUser = {
      ...userData,
      id: this.nextId++,
    };
    this.storage.set(String(newUser.id), newUser);
    return newUser;
  }

  public updateUser(id: number | string, updates: Partial<SystemUser>): boolean {
    const existing = this.storage.get(String(id));
    if (!existing) return false;
    this.storage.set(String(id), { ...existing, ...updates });
    return true;
  }

  public deleteUser(id: number | string): boolean {
    const existing = this.storage.get(String(id));
    if (!existing) return false;
    this.storage.remove(String(id));
    return true;
  }

  public subscribe(listener: () => void): () => void {
    return this.storage.subscribe(listener);
  }

  public getDemoCredentials(): typeof DEMO_CREDENTIALS {
    return DEMO_CREDENTIALS;
  }

  public async resetPassword(id: number | string): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: "Kata sandi berhasil direset." };
  }

  public async authenticateDetailed(email: string, password: string): Promise<AuthResult> {
    if (!email || !email.trim() || !password || !password.trim()) {
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        errorMessage: "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.",
      };
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if the user exists in initialUsers and is inactive
    const existingUser = this.getAll().find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingUser && existingUser.status === "Nonaktif") {
      return {
        success: false,
        errorCode: "ACCOUNT_INACTIVE",
        errorMessage: "Akun Anda belum aktif atau aksesnya telah dinonaktifkan. Hubungi administrator.",
      };
    }

    const creds = Object.values(DEMO_CREDENTIALS).find(
      (c) => c.email.toLowerCase() === cleanEmail && c.password === password
    );

    if (!creds) {
      return {
        success: false,
        errorCode: "INVALID_CREDENTIALS",
        errorMessage: "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.",
      };
    }

    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("auth_user", JSON.stringify({
        role: creds.role,
        nama: creds.name,
        userId: creds.userId,
        employeeId: creds.employeeId,
      }));
      window.localStorage.setItem("auth_token", `mock-token-${creds.role}-${Date.now()}`);
    }

    return {
      success: true,
      session: {
        role: creds.role,
        name: creds.name,
        userId: creds.userId,
        employeeId: creds.employeeId,
      },
    };
  }

  public async authenticate(email: string, password: string): Promise<AuthUserSession | null> {
    const res = await this.authenticateDetailed(email, password);
    return res.session || null;
  }
}

export const mockUserProvider = new MockUserProvider();
