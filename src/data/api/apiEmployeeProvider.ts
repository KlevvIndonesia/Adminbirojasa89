/**
 * Real API Employee Data Provider
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Implements employee data operations connecting to Express REST API (/api/employees).
 * Authoritative client provider for the canonical `employees` domain.
 */

import { Employee, EmployeeCreateInput, EmployeeUpdateInput } from "../../domain/employee/types";
import { APP_CONFIG } from "../../app/config/appConfig";

export class ApiEmployeeProvider {
  private baseUrl: string;
  private employees: Employee[] = [];
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
      const res = await fetch(`${this.baseUrl}/employees`, {
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sun89_auth_unauthorized"));
        }
        throw new Error(`Gagal memuat karyawan dari server (HTTP ${res.status})`);
      }
      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        this.employees = payload.data;
        this.isInitialized = true;
        this.isLoadingState = false;
        this.notify();
      }
    } catch (err: any) {
      this.isLoadingState = false;
      this.lastError = err instanceof Error ? err : new Error(String(err));
      this.notify();
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
        console.error("ApiEmployeeProvider listener error:", err);
      }
    });
  }

  public isLoading(): boolean {
    return this.isLoadingState;
  }

  public getError(): string | null {
    return this.lastError ? this.lastError.message : null;
  }

  public getAll(): Employee[] {
    return this.employees;
  }

  public getById(id: string): Employee | undefined {
    return this.employees.find((e) => e.id === id);
  }

  public getByNik(nik: string): Employee | undefined {
    return this.employees.find((e) => e.nik_ktp === nik);
  }

  public async getNextId(): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/employees/next-id`, {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload?.data?.nextId) return payload.data.nextId;
      }
    } catch {
      // Fallback
    }
    const nextNum = this.employees.length + 1;
    return `EMP-${String(nextNum).padStart(4, "0")}`;
  }

  public async createEmployee(data: EmployeeCreateInput): Promise<Employee> {
    const res = await fetch(`${this.baseUrl}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(data),
    });

    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error?.message || payload.message || "Gagal membuat karyawan di server.");
    }

    const created: Employee = payload.data;
    const existingIdx = this.employees.findIndex((e) => e.id === created.id);
    if (existingIdx !== -1) {
      this.employees[existingIdx] = created;
    } else {
      this.employees.push(created);
    }
    this.notify();
    return created;
  }

  public async updateEmployee(id: string, updates: EmployeeUpdateInput): Promise<Employee> {
    const res = await fetch(`${this.baseUrl}/employees/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(updates),
    });

    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error?.message || payload.message || "Gagal memperbarui karyawan di server.");
    }

    const updated: Employee = payload.data;
    const idx = this.employees.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.employees[idx] = updated;
      this.notify();
    }
    return updated;
  }

  public async deleteEmployee(id: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/employees/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
    });

    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error?.message || payload.message || "Gagal menghapus karyawan di server.");
    }

    const idx = this.employees.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.employees.splice(idx, 1);
      this.notify();
    }
    return true;
  }
}

export const apiEmployeeProvider = new ApiEmployeeProvider();
