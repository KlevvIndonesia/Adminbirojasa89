/**
 * Real API Messenger Data Provider
 * Admin SUN89 — Biro Jasa Management System
 *
 * Connects directly to Express REST API for Messenger tasks, history, and reimbursements.
 */

import { APP_CONFIG } from "../../app/config/appConfig";
import { MessengerHistoryItem } from "../../app/data/messengerTaskAdapter";

export interface MessengerHistoryFilter {
  messenger?: string;
  employeeId?: string;
  taskType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export class ApiMessengerProvider {
  private baseUrl: string;

  constructor(baseUrl = APP_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
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

  /**
   * Fetch historical completed messenger tasks directly from the backend database
   */
  public async getMessengerHistory(filters?: MessengerHistoryFilter): Promise<MessengerHistoryItem[]> {
    const params = new URLSearchParams();
    if (filters?.messenger && filters.messenger !== "all") params.append("messenger", filters.messenger);
    if (filters?.employeeId) params.append("employeeId", filters.employeeId);
    if (filters?.taskType && filters.taskType !== "all") params.append("taskType", filters.taskType);
    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.append("dateTo", filters.dateTo);
    if (filters?.search) params.append("search", filters.search);

    const qs = params.toString();
    const url = `${this.baseUrl}/messenger/history${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Gagal memuat riwayat kurir dari server (HTTP ${res.status})`);
    }

    const payload = await res.json();
    return payload?.data || [];
  }

  /**
   * Fetch active messenger list with workloads
   */
  public async getMessengers(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/messenger/messengers`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new Error(`Gagal memuat daftar kurir (HTTP ${res.status})`);
    }

    const payload = await res.json();
    return payload?.data || [];
  }
}

export const apiMessengerProvider = new ApiMessengerProvider();
