/**
 * Real API Pricing Data Provider
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Implements IPricingDataProvider connecting to the Express REST API (/api/pricing/samsat).
 * Manages cache synchronized with the backend and handles optimistic updates with rollback.
 */

import { SamsatCostItem } from "../../domain/pricing/types";
import { IPricingDataProvider } from "../../domain/pricing/types";
import { APP_CONFIG } from "../../app/config/appConfig";

export class ApiPricingProvider implements IPricingDataProvider {
  private baseUrl: string;
  private samsatItems: SamsatCostItem[] = [];
  private serviceConfigs: any[] = [];
  private samsatOffices: any[] = [];
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
      const res = await fetch(`${this.baseUrl}/pricing/samsat`, {
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sun89_auth_unauthorized"));
        }
        throw new Error(`Gagal memuat master pricing dari server (HTTP ${res.status})`);
      }
      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        this.samsatItems = payload.data;
      }

      // Load Service Pricing configs
      try {
        const serviceRes = await fetch(`${this.baseUrl}/pricing/services`, {
          headers: { "Content-Type": "application/json", ...authHeaders },
        });
        if (serviceRes.ok) {
          const servicePayload = await serviceRes.json();
          if (servicePayload.success && Array.isArray(servicePayload.data)) {
            this.serviceConfigs = servicePayload.data;
          }
        }
      } catch (err) {
        console.warn("Could not load service pricing configs from backend:", err);
      }

      // Load Samsat offices from backend
      try {
        const officeRes = await fetch(`${this.baseUrl}/samsat/offices`, {
          headers: { "Content-Type": "application/json", ...authHeaders },
        });
        if (officeRes.ok) {
          const officePayload = await officeRes.json();
          if (officePayload.success && Array.isArray(officePayload.data)) {
            this.samsatOffices = officePayload.data;
          }
        }
      } catch (err) {
        console.warn("Could not load samsat offices from backend:", err);
      }

      this.isInitialized = true;
      this.isLoadingState = false;
      this.notify();
    } catch (err: any) {
      this.isLoadingState = false;
      this.lastError = err instanceof Error ? err : new Error(String(err));
      this.notify();
      // In API mode, do not inject mock items silently on failure
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
        console.error("ApiPricingProvider listener error:", err);
      }
    });
  }

  public isLoading(): boolean {
    return this.isLoadingState;
  }

  public getError(): Error | null {
    return this.lastError;
  }

  public getSamsatItems(): SamsatCostItem[] {
    return this.samsatItems;
  }

  public getSamsatItemById(id: string): SamsatCostItem | undefined {
    return this.samsatItems.find((item) => item.id === id);
  }

  public async updateSamsatItem(id: string, updates: Partial<SamsatCostItem>): Promise<boolean> {
    const idx = this.samsatItems.findIndex((item) => item.id === id);
    if (idx === -1) {
      throw new Error(`Item harga Samsat '${id}' tidak ditemukan di katalog data.`);
    }

    const previousItem = { ...this.samsatItems[idx] };
    this.samsatItems[idx] = { ...this.samsatItems[idx], ...updates };
    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/pricing/samsat/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.message || `Gagal menyimpan ke server (HTTP ${res.status})`);
      }

      const payload = await res.json();
      if (payload?.success && payload.data) {
        const currentIdx = this.samsatItems.findIndex((item) => item.id === id);
        if (currentIdx !== -1) {
          this.samsatItems[currentIdx] = payload.data;
          this.notify();
        }
      }
      return true;
    } catch (err: any) {
      console.error("Failed to persist pricing item, rolling back:", err);
      const currentIdx = this.samsatItems.findIndex((item) => item.id === id);
      if (currentIdx !== -1) {
        this.samsatItems[currentIdx] = previousItem;
        this.notify();
      }
      throw err;
    }
  }

  public addSamsatItem(item: Omit<SamsatCostItem, "id">): SamsatCostItem {
    const newItem: SamsatCostItem = {
      ...item,
      id: `custom-samsat-${Date.now()}`,
    };
    this.samsatItems.push(newItem);
    this.notify();

    fetch(`${this.baseUrl}/pricing/samsat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(newItem),
    }).catch((err) => {
      console.error("Failed to persist new samsat item:", err);
    });

    return newItem;
  }

  public getServiceConfigs(): any[] {
    return this.serviceConfigs;
  }

  public getSamsatOffices(): any[] {
    return this.samsatOffices;
  }

  public async updateServicePricing(id: string, config: any): Promise<boolean> {
    const idx = this.serviceConfigs.findIndex((c) => c.id === id);
    const prev = idx !== -1 ? { ...this.serviceConfigs[idx] } : null;

    if (idx !== -1) {
      this.serviceConfigs[idx] = { ...this.serviceConfigs[idx], ...config };
    } else {
      this.serviceConfigs.push({ id, ...config });
    }
    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/pricing/services/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      return true;
    } catch (err) {
      console.error("Failed to persist service pricing, rolling back:", err);
      if (prev && idx !== -1) {
        this.serviceConfigs[idx] = prev;
      }
      this.notify();
      throw err;
    }
  }

  public async batchReplicateServicePricing(params: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/pricing/services/batch-replicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || errJson.message || `Gagal mereplikasi biaya layanan (HTTP ${res.status})`);
    }
    const payload = await res.json();
    return payload?.data || payload;
  }

  public async createServicePricing(config: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/pricing/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || errJson.message || `Gagal menambahkan biaya layanan (HTTP ${res.status})`);
    }
    const payload = await res.json();
    if (payload?.success && payload.data) {
      const newConfig = payload.data;
      const existingIdx = this.serviceConfigs.findIndex((c) => c.id === newConfig.id);
      if (existingIdx !== -1) {
        this.serviceConfigs[existingIdx] = newConfig;
      } else {
        this.serviceConfigs.push(newConfig);
      }
      this.notify();
      return newConfig;
    }
    return payload.data;
  }

  public async deleteServicePricing(id: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/pricing/services/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || errJson.message || `Gagal menghapus biaya layanan (HTTP ${res.status})`);
    }
    const idx = this.serviceConfigs.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.serviceConfigs.splice(idx, 1);
      this.notify();
    }
    return true;
  }

  public async createSamsatOffice(office: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/samsat/offices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(office),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Gagal menambahkan kantor Samsat (HTTP ${res.status})`);
    }
    const payload = await res.json();
    if (payload?.success && payload.data) {
      this.samsatOffices.push(payload.data);
      this.notify();
      return payload.data;
    }
    return payload.data;
  }

  public async updateSamsatOffice(id: string, updates: any): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/samsat/offices/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Gagal memperbarui kantor Samsat (HTTP ${res.status})`);
    }
    const payload = await res.json();
    const idx = this.samsatOffices.findIndex((o) => o.id === id);
    if (idx !== -1 && payload?.data) {
      this.samsatOffices[idx] = payload.data;
      this.notify();
    }
    return true;
  }

  public async deleteSamsatOffice(id: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/samsat/offices/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { ...this.getAuthHeader() },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Gagal menghapus kantor Samsat (HTTP ${res.status})`);
    }
    const idx = this.samsatOffices.findIndex((o) => o.id === id);
    if (idx !== -1) {
      this.samsatOffices.splice(idx, 1);
      this.notify();
    }
    return true;
  }

  // ─── SAMSAT OPERATIONAL TARIFFS (PER-SAMSAT PRICING) ─────────────────────────

  public async getSamsatOperationalTariffs(samsatId?: string): Promise<any[]> {
    const query = samsatId ? `?samsatId=${encodeURIComponent(samsatId)}` : "";
    const res = await fetch(`${this.baseUrl}/pricing/samsat-tariffs${query}`, {
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Gagal memuat tarif operasional Samsat (HTTP ${res.status})`);
    }
    const payload = await res.json();
    return payload.data || [];
  }

  public async updateSamsatOperationalTariff(samsatId: string, pricingItemId: string, nominal: number): Promise<any> {
    const res = await fetch(`${this.baseUrl}/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify({ samsatId, pricingItemId, nominal }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Gagal menyimpan tarif operasional Samsat (HTTP ${res.status})`);
    }
    const payload = await res.json();
    this.notify();
    return payload.data;
  }

  public async updateSamsatOperationalTariffsBatch(
    samsatId: string,
    tariffs: Array<{ pricingItemId: string; nominal: number }>
  ): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify({ samsatId, tariffs }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Gagal menyimpan batch tarif operasional Samsat (HTTP ${res.status})`);
    }
    const payload = await res.json();
    this.notify();
    return payload.data || [];
  }

  public async deleteSamsatOperationalTariff(
    idOrParams: string | { samsatId: string; pricingItemId: string }
  ): Promise<boolean> {
    const url = typeof idOrParams === "string"
      ? `${this.baseUrl}/pricing/samsat-tariffs/${encodeURIComponent(idOrParams)}`
      : `${this.baseUrl}/pricing/samsat-tariffs?samsatId=${encodeURIComponent(idOrParams.samsatId)}&pricingItemId=${encodeURIComponent(idOrParams.pricingItemId)}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: { ...this.getAuthHeader() },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Gagal menghapus tarif operasional Samsat (HTTP ${res.status})`);
    }
    this.notify();
    return true;
  }
}
