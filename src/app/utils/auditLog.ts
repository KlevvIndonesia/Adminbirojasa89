// Audit Log Utility for tracking real user & system actions with Persistent API Sync
import { useState, useEffect } from "react";
import { APP_CONFIG } from "../config/appConfig";

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userRole: 'administrator' | 'finance' | 'admin' | 'messenger';
  action: string;
  module: string;
  details: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

class AuditLogService {
  private logs: AuditLogEntry[] = [];
  private counter = 0;
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;
  private isLoadingState = false;
  private lastError: string | null = null;
  private isDataStale = false;
  private hasSuccessfullyLoaded = false;

  constructor() {
    this.logs = [];
    if (typeof window !== "undefined" && window.localStorage?.getItem("auth_token")) {
      this.initFromApi().catch(() => {});
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
    } catch {
      // ignore
    }
    return {};
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public async initFromApi(): Promise<void> {
    const authHeaders = this.getAuthHeader();
    if (!authHeaders.Authorization) {
      return;
    }

    // Role Guard: Only administrator and svp have authority to read all system audit logs
    let isAllowedRole = false;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem("auth_user");
        if (raw) {
          const u = JSON.parse(raw);
          if (u.role === "administrator" || u.role === "svp") {
            isAllowedRole = true;
          }
        }
      }
    } catch {}

    if (!isAllowedRole) {
      this.isLoadingState = false;
      return;
    }

    this.isLoadingState = true;
    try {
      const baseUrl = APP_CONFIG.apiBaseUrl.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/audit-logs?limit=200`, {
        headers: { "Content-Type": "application/json", ...authHeaders },
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload.success && Array.isArray(payload.data)) {
          this.logs = payload.data.map((r: any) => ({
            id: r.id,
            timestamp: new Date(r.createdAt || r.created_at || Date.now()),
            userId: r.userId || r.user_id || "usr-system",
            userName: r.userName || r.user_name || "User",
            userRole: (r.userRole || r.user_role || "admin") as any,
            action: r.action,
            module: r.module,
            details: r.details,
            metadata: r.metadata,
          }));
          this.isInitialized = true;
          this.hasSuccessfullyLoaded = true;
          this.lastError = null;
          this.isDataStale = false;
          this.isLoadingState = false;
          this.notify();
        }
      } else if (res.status === 401) {
        this.isLoadingState = false;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sun89_auth_unauthorized"));
        }
      } else if (res.status === 403) {
        this.isLoadingState = false;
        return;
      } else {
        throw new Error(`Gagal memuat riwayat aktivitas (HTTP ${res.status})`);
      }
    } catch (err: any) {
      this.isLoadingState = false;
      this.lastError = err?.message || "Gagal memuat riwayat aktivitas dari server";
      if (this.logs.length > 0 || this.hasSuccessfullyLoaded) {
        this.isDataStale = true;
      }
      this.notify();
    }
  }

  public isLoading(): boolean {
    return this.isLoadingState && !this.hasSuccessfullyLoaded;
  }

  public getError(): string | null {
    return this.lastError;
  }

  public isStale(): boolean {
    return this.isDataStale;
  }

  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${++this.counter}`,
      timestamp: new Date(),
    };
    this.logs.unshift(newEntry);
    this.notify();

    // Asynchronously synchronize with backend
    try {
      const baseUrl = APP_CONFIG.apiBaseUrl.replace(/\/$/, "");
      fetch(`${baseUrl}/audit-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify({
          action: entry.action,
          module: entry.module,
          details: entry.details,
          metadata: entry.metadata,
        }),
      }).catch(() => {
        // Non-fatal if offline
      });
    } catch {
      // ignore
    }
  }

  getLogs(filters?: {
    userId?: string;
    userRole?: string;
    module?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): AuditLogEntry[] {
    let filteredLogs = [...this.logs];

    if (filters) {
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
      }
      if (filters.userRole && filters.userRole !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.userRole === filters.userRole);
      }
      if (filters.module && filters.module !== 'all') {
        filteredLogs = filteredLogs.filter(log => 
          log.module.toLowerCase().includes(filters.module!.toLowerCase())
        );
      }
      if (filters.action && filters.action !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.action === filters.action);
      }
      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAllLogs(): AuditLogEntry[] {
    return [...this.logs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getLogById(id: string): AuditLogEntry | undefined {
    return this.logs.find(log => log.id === id);
  }

  clearLogs(): void {
    this.logs = [];
    this.notify();
  }
}

export const auditLog = new AuditLogService();

export function useAuditLog() {
  const [, setTick] = useState(0);
  useEffect(() => {
    auditLog.initFromApi().catch(() => {});
    return auditLog.subscribe(() => setTick((t) => t + 1));
  }, []);
  return auditLog.getAllLogs();
}
