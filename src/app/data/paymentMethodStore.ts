/**
 * Payment Method Store
 * Admin SUN89 — Biro Jasa Management System
 */

import { useState, useEffect } from "react";
import { APP_CONFIG } from "../config/appConfig";

export interface PaymentMethod {
  id: string;
  nama_metode: string;
  bank: string;
  nama_rekening?: string;
  nomor_rekening?: string;
  status: "Aktif" | "Nonaktif";
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "pm-bca",
    nama_metode: "Transfer BCA",
    bank: "BCA",
    nama_rekening: "PT Biro Jasa SUN89 Abadi",
    nomor_rekening: "772-019-2831",
    status: "Aktif",
  },
  {
    id: "pm-bri",
    nama_metode: "Transfer BRI",
    bank: "BRI",
    nama_rekening: "PT Biro Jasa SUN89 Abadi",
    nomor_rekening: "0123-01-001234-56-7",
    status: "Aktif",
  },
  {
    id: "pm-mandiri",
    nama_metode: "Transfer Mandiri",
    bank: "Mandiri",
    nama_rekening: "PT Biro Jasa SUN89 Abadi",
    nomor_rekening: "133-00-1928374-1",
    status: "Aktif",
  },
  {
    id: "pm-cash",
    nama_metode: "Cash",
    bank: "Tunai",
    nama_rekening: "",
    nomor_rekening: "",
    status: "Aktif",
  },
  {
    id: "pm-qris",
    nama_metode: "QRIS",
    bank: "QRIS",
    nama_rekening: "Biro Jasa SUN89",
    nomor_rekening: "ID936005230001889",
    status: "Aktif",
  },
];

class PaymentMethodStore {
  private methods: PaymentMethod[] = APP_CONFIG.dataProvider === "api" ? [] : [...DEFAULT_PAYMENT_METHODS];
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;
  private isLoadingState = false;
  private lastError: string | null = null;
  private isDataStale = false;
  private hasSuccessfullyLoaded = false;

  constructor() {
    if (typeof window === "undefined" || (typeof window !== "undefined" && window.localStorage?.getItem("auth_token"))) {
      this.initFromApi();
    }
  }

  private getAuthHeader(): Record<string, string> {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const token = window.localStorage.getItem("auth_token");
        if (token) return { Authorization: `Bearer ${token}` };
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
    try {
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/payment-methods`, {
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!res.ok) {
        throw new Error(`Gagal memuat metode pembayaran dari server (HTTP ${res.status})`);
      }
      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        this.methods = payload.data;
        this.isInitialized = true;
        this.hasSuccessfullyLoaded = true;
        this.lastError = null;
        this.isDataStale = false;
        this.isLoadingState = false;
        this.notify();
      } else {
        throw new Error(payload.message || "Format data metode pembayaran tidak valid");
      }
    } catch (err: any) {
      this.isLoadingState = false;
      this.lastError = err?.message || "Gagal menghubungkan ke backend metode pembayaran";
      if (this.methods.length > 0 || this.hasSuccessfullyLoaded) {
        this.isDataStale = true;
      }
      this.notify();
      // In API mode, do not keep silent defaults on failure
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

  public getAll(): PaymentMethod[] {
    return this.methods;
  }

  public getActive(): PaymentMethod[] {
    return this.methods.filter((m) => m.status === "Aktif");
  }

  public getById(id: string): PaymentMethod | undefined {
    return this.methods.find((m) => m.id === id);
  }

  public getByNama(nama: string): PaymentMethod | undefined {
    return this.methods.find((m) => m.nama_metode.toLowerCase() === nama.toLowerCase());
  }

  public async addPaymentMethod(data: {
    nama_metode: string;
    bank: string;
    nama_rekening?: string;
    nomor_rekening?: string;
    status?: "Aktif" | "Nonaktif";
  }): Promise<PaymentMethod> {
    try {
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/payment-methods`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify(data),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menambahkan metode pembayaran");
      }
      const newMethod: PaymentMethod = payload.data;
      this.methods.push(newMethod);
      this.notify();
      return newMethod;
    } catch (err: any) {
      console.error("PaymentMethodStore.addPaymentMethod error:", err);
      throw err;
    }
  }

  public async updatePaymentMethod(id: string, updates: Partial<PaymentMethod>): Promise<PaymentMethod> {
    try {
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/payment-methods/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify(updates),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.message || "Gagal memperbarui metode pembayaran");
      }
      const updated: PaymentMethod = payload.data;
      const idx = this.methods.findIndex((m) => m.id === id);
      if (idx !== -1) {
        this.methods[idx] = updated;
        this.notify();
      }
      return updated;
    } catch (err: any) {
      console.error("PaymentMethodStore.updatePaymentMethod error:", err);
      throw err;
    }
  }

  public async deletePaymentMethod(id: string): Promise<{ success: boolean; deactivated?: boolean; message?: string }> {
    const res = await fetch(`${APP_CONFIG.apiBaseUrl}/payment-methods/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.success) {
      throw new Error(payload.message || `Gagal menghapus metode pembayaran (HTTP ${res.status})`);
    }
    if (payload.deactivated) {
      const idx = this.methods.findIndex((m) => m.id === id);
      if (idx !== -1) {
        this.methods[idx].status = "Nonaktif";
        this.notify();
      }
    } else {
      this.methods = this.methods.filter((m) => m.id !== id);
      this.notify();
    }
    return payload;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const paymentMethodStore = new PaymentMethodStore();

export function usePaymentMethods() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return paymentMethodStore.subscribe(() => setTick((t) => t + 1));
  }, []);

  return {
    methods: paymentMethodStore.getAll(),
    paymentMethods: paymentMethodStore.getAll(),
    activeMethods: paymentMethodStore.getActive(),
    activePaymentMethods: paymentMethodStore.getActive(),
    isLoading: paymentMethodStore.isLoading(),
    error: paymentMethodStore.getError(),
    isStale: paymentMethodStore.isStale(),
    addMethod: paymentMethodStore.addPaymentMethod.bind(paymentMethodStore),
    updateMethod: paymentMethodStore.updatePaymentMethod.bind(paymentMethodStore),
    deleteMethod: paymentMethodStore.deletePaymentMethod.bind(paymentMethodStore),
    refresh: paymentMethodStore.initFromApi.bind(paymentMethodStore),
  };
}
