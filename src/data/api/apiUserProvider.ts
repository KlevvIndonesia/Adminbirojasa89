/**
 * Real API User Data Provider
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Implements IUserDataProvider connecting to Express REST API (/api/users and /api/auth).
 * Manages cache synchronized with the backend and handles optimistic updates with rollback.
 */

import { SystemUser } from "../../domain/user/types";
import { IUserDataProvider } from "../mock/mockUserProvider";
import { AuthUserSession, AuthResult, AuthErrorCode, DEMO_CREDENTIALS } from "../repositories/userRepository";
import { APP_CONFIG } from "../../app/config/appConfig";

export class ApiUserProvider implements IUserDataProvider {
  private baseUrl: string;
  private users: SystemUser[] = [];
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;
  private isLoadingState = false;
  private lastError: Error | null = null;

  constructor(baseUrl = APP_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    if (typeof window === "undefined" || (typeof window !== "undefined" && window.localStorage?.getItem("auth_token"))) {
      this.initFromApi();
    }
  }

  private getAuthHeader(): Record<string, string> {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const token = window.localStorage.getItem("auth_token");
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
      }
      if (typeof process !== "undefined" && process.env?.AUTH_TOKEN) {
        return { Authorization: `Bearer ${process.env.AUTH_TOKEN}` };
      }
    } catch {
      // ignore
    }
    return {};
  }

  public async initFromApi(): Promise<void> {
    const authHeaders = this.getAuthHeader();
    if (!authHeaders.Authorization) {
      this.isLoadingState = false;
      return;
    }
    this.isLoadingState = true;
    this.lastError = null;
    try {
      const res = await fetch(`${this.baseUrl}/users`, {
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sun89_auth_unauthorized"));
        }
        throw new Error(`Gagal memuat pengguna dari server (HTTP ${res.status})`);
      }
      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        this.users = payload.data;
        this.isInitialized = true;
        this.isLoadingState = false;
        this.notify();
      }
    } catch (err: any) {
      this.isLoadingState = false;
      this.lastError = err instanceof Error ? err : new Error(String(err));
      this.notify();
      // In API mode, do not silently populate mock users on error
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error("ApiUserProvider listener error:", err);
      }
    });
  }

  public isLoading(): boolean {
    return this.isLoadingState;
  }

  public getError(): string | null {
    return this.lastError ? this.lastError.message : null;
  }

  public getAll(): SystemUser[] {
    return this.users;
  }

  public getById(id: number | string): SystemUser | undefined {
    return this.users.find((u) => String(u.id) === String(id));
  }

  public getByEmail(email: string): SystemUser | undefined {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(userData: Omit<SystemUser, "id">): SystemUser {
    const tempId = `temp-${Date.now()}`;
    const newUser: SystemUser = {
      ...userData,
      id: tempId,
    };
    this.users.push(newUser);
    this.notify();

    fetch(`${this.baseUrl}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(userData),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (payload?.success && payload.data) {
          const idx = this.users.findIndex((u) => u.id === tempId);
          if (idx !== -1) {
            this.users[idx] = payload.data;
            this.notify();
          }
        }
      })
      .catch((err) => {
        console.error("Failed to create user on server, rolling back:", err);
        const idx = this.users.findIndex((u) => u.id === tempId);
        if (idx !== -1) {
          this.users.splice(idx, 1);
          this.notify();
        }
      });

    return newUser;
  }

  public updateUser(id: number | string, updates: Partial<SystemUser>): boolean {
    const idx = this.users.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) return false;

    const previousUser = { ...this.users[idx] };
    this.users[idx] = { ...this.users[idx], ...updates };
    this.notify();

    fetch(`${this.baseUrl}/users/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(updates),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (payload?.success && payload.data) {
          const currentIdx = this.users.findIndex((u) => String(u.id) === String(id));
          if (currentIdx !== -1) {
            this.users[currentIdx] = payload.data;
            this.notify();
          }
        }
      })
      .catch((err) => {
        console.error("Failed to update user on server, rolling back:", err);
        const currentIdx = this.users.findIndex((u) => String(u.id) === String(id));
        if (currentIdx !== -1) {
          this.users[currentIdx] = previousUser;
          this.notify();
        }
      });

    return true;
  }

  public deleteUser(id: number | string): boolean {
    const idx = this.users.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) return false;

    const previousUser = this.users[idx];
    this.users.splice(idx, 1);
    this.notify();

    fetch(`${this.baseUrl}/users/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch((err) => {
        console.error("Failed to delete user on server, rolling back:", err);
        this.users.push(previousUser);
        this.notify();
      });

    return true;
  }

  public getDemoCredentials(): typeof DEMO_CREDENTIALS {
    return DEMO_CREDENTIALS;
  }

  public async resetPassword(id: number | string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${this.baseUrl}/users/${encodeURIComponent(String(id))}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Gagal mereset kata sandi (HTTP ${res.status})`);
    }
    const payload = await res.json();
    return { success: true, message: payload.message };
  }

  public async authenticateDetailed(email: string, password: string): Promise<AuthResult> {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller ? controller.signal : undefined,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (res.ok) {
        const payload = await res.json();
        if (payload.success && payload.data) {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("auth_token", payload.data.token);
            window.localStorage.setItem("auth_user", JSON.stringify(payload.data.user));
          }
          return {
            success: true,
            session: {
              role: payload.data.user.role,
              name: payload.data.user.nama,
              userId: payload.data.user.userId,
              employeeId: payload.data.user.employeeId,
            },
          };
        }
      }

      // Handle non-OK status codes
      const payload = await res.json().catch(() => ({}));
      const backendCode = payload?.error?.code || "";

      if (res.status === 401 || backendCode === "INVALID_CREDENTIALS") {
        return {
          success: false,
          statusCode: 401,
          errorCode: "INVALID_CREDENTIALS",
          errorMessage: "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.",
        };
      }

      if (
        res.status === 403 ||
        backendCode === "ACCOUNT_INACTIVE" ||
        backendCode === "EMPLOYEE_INACTIVE" ||
        backendCode === "EMPLOYEE_NOT_FOUND" ||
        backendCode === "MESSENGER_NO_EMPLOYEE_ID"
      ) {
        return {
          success: false,
          statusCode: 403,
          errorCode: "ACCOUNT_INACTIVE",
          errorMessage: "Akun Anda belum aktif atau aksesnya telah dinonaktifkan. Hubungi administrator.",
        };
      }

      if (res.status === 429 || backendCode === "TOO_MANY_REQUESTS") {
        const retryHeader = res.headers.get("Retry-After");
        const retrySec = payload?.error?.retryAfterSeconds || (retryHeader ? Number(retryHeader) : 60);
        return {
          success: false,
          statusCode: 429,
          errorCode: "TOO_MANY_REQUESTS",
          retryAfterSeconds: retrySec,
          errorMessage: "Terlalu banyak percobaan login. Silakan tunggu sebelum mencoba kembali.",
        };
      }

      if (res.status === 400 || backendCode === "VALIDATION_ERROR") {
        return {
          success: false,
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
          errorMessage: payload?.error?.message || "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.",
        };
      }

      if (res.status >= 500) {
        return {
          success: false,
          statusCode: res.status,
          errorCode: "SERVER_ERROR",
          errorMessage: "Terjadi gangguan pada layanan login. Silakan coba kembali beberapa saat lagi.",
        };
      }

      return {
        success: false,
        statusCode: res.status,
        errorCode: "UNEXPECTED_ERROR",
        errorMessage: "Terjadi kendala saat memproses permintaan login. Silakan coba kembali.",
      };
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);

      if (err?.name === "AbortError") {
        return {
          success: false,
          errorCode: "TIMEOUT_ERROR",
          errorMessage: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
        };
      }

      // Fetch failed / offline / network error
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
      };
    }
  }

  public async authenticate(email: string, password: string): Promise<AuthUserSession | null> {
    const res = await this.authenticateDetailed(email, password);
    return res.session || null;
  }
}
