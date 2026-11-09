/**
 * Real API Order Data Provider
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Implements IOrderDataProvider connecting to the Express REST API.
 * Keeps an in-memory cache synchronized with the backend and handles
 * optimistic updates and background persistence.
 */

import { OperationalOrder, StageName, STAGES } from "../../domain/order/types";
import { IOrderDataProvider } from "../mock/mockOrderProvider";
// createInitialOrders removed from api provider to prevent mock data leakage in production/API mode
import { APP_CONFIG } from "../../app/config/appConfig";
import { toast } from "sonner";
import {
  ActionApiError,
  fetchWithTimeout,
  parseApiErrorResponse,
} from "../../app/utils/actionErrorClassifier";

function createEmptyActiveOrders(): Record<StageName, OperationalOrder[]> {
  const result = {} as Record<StageName, OperationalOrder[]>;
  for (const stage of STAGES) {
    result[stage] = [];
  }
  return result;
}

export class ApiOrderProvider implements IOrderDataProvider {
  private baseUrl: string;
  private activeOrders: Record<StageName, OperationalOrder[]> = createEmptyActiveOrders();
  private archivedOrders: OperationalOrder[] = [];
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;
  private isLoading = false;
  private error: string | null = null;
  private inFlightMutationCount = 0;
  private currentDataVersion = 0;
  private latestAppliedGetId = 0;
  private nextGetRequestId = 0;

  constructor(baseUrl = APP_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    if (typeof window === "undefined" || (typeof window !== "undefined" && window.localStorage?.getItem("auth_token"))) {
      this.initFromApi();
    }
  }

  public getInFlightMutationCount(): number {
    return this.inFlightMutationCount;
  }

  public getCurrentDataVersion(): number {
    return this.currentDataVersion;
  }

  public getLatestAppliedGetId(): number {
    return this.latestAppliedGetId;
  }

  public bumpDataVersion(): number {
    this.currentDataVersion++;
    return this.currentDataVersion;
  }

  public getIsLoading(): boolean {
    return this.isLoading;
  }

  public getError(): string | null {
    return this.error;
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public async refresh(silent = false): Promise<void> {
    if (silent) {
      if (this.inFlightMutationCount > 0) {
        // Prevent background heartbeat from overwriting ongoing mutation with potentially stale snapshot
        return;
      }
      const authHeaders = this.getAuthHeader();
      if (!authHeaders.Authorization) return;

      const capturedVersion = this.currentDataVersion;
      const requestId = ++this.nextGetRequestId;

      try {
        const res = await fetch(`${this.baseUrl}/orders`, {
          headers: { "Content-Type": "application/json", ...authHeaders },
        });

        // Discard stale GET response if a mutation completed or newer GET arrived while request was in-flight
        if (capturedVersion < this.currentDataVersion || requestId < this.latestAppliedGetId) {
          return;
        }

        let fetchedActive: Record<StageName, OperationalOrder[]> | null = null;
        if (res.ok) {
          const payload = await res.json();
          if (payload.success && payload.data) {
            fetchedActive = payload.data;
          }
        }

        const archRes = await fetch(`${this.baseUrl}/orders/archived`, {
          headers: { "Content-Type": "application/json", ...authHeaders },
        });

        if (capturedVersion < this.currentDataVersion || requestId < this.latestAppliedGetId) {
          return;
        }

        if (archRes.ok) {
          const archPayload = await archRes.json();
          if (archPayload.success && Array.isArray(archPayload.data)) {
            this.archivedOrders = archPayload.data;
          }
        }

        if (fetchedActive) {
          this.activeOrders = fetchedActive;
        }

        this.latestAppliedGetId = requestId;
        this.notify();
      } catch {
        // Silent background sync error safe fallback
      }
    } else {
      await this.initFromApi();
    }
  }

  private getAuthHeader(): Record<string, string> {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const token = window.localStorage.getItem("auth_token") || window.localStorage.getItem("sun89_auth_token");
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
      }
      if (typeof process !== "undefined" && process.env?.AUTH_TOKEN) {
        return { Authorization: `Bearer ${process.env.AUTH_TOKEN}` };
      }
    } catch {
      // ignore in non-browser env
    }
    return {};
  }

  public async initFromApi(): Promise<void> {
    if (this.inFlightMutationCount > 0) {
      // In-flight mutation taking place; do not overwrite local state with stale API snapshot
      return;
    }
    const authHeaders = this.getAuthHeader();
    if (!authHeaders.Authorization) {
      this.isInitialized = true;
      this.activeOrders = createEmptyActiveOrders();
      this.notify();
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.notify();

    const capturedVersion = this.currentDataVersion;
    const requestId = ++this.nextGetRequestId;

    try {
      const res = await fetch(`${this.baseUrl}/orders`, {
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (res.status === 401 && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sun89_auth_unauthorized"));
        this.isLoading = false;
        this.error = "Sesi telah berakhir. Silakan login kembali.";
        this.notify();
        return;
      }
      if (!res.ok) {
        throw new Error(`Gagal memuat data order (HTTP ${res.status})`);
      }

      if (capturedVersion < this.currentDataVersion || requestId < this.latestAppliedGetId) {
        this.isLoading = false;
        this.notify();
        return;
      }

      const payload = await res.json();
      let fetchedActive: Record<StageName, OperationalOrder[]> | null = null;
      if (payload.success && payload.data) {
        fetchedActive = payload.data;
      }

      const archRes = await fetch(`${this.baseUrl}/orders/archived`, {
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (archRes.status === 401 && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sun89_auth_unauthorized"));
        this.isLoading = false;
        this.error = "Sesi telah berakhir. Silakan login kembali.";
        this.notify();
        return;
      }

      if (capturedVersion < this.currentDataVersion || requestId < this.latestAppliedGetId) {
        this.isLoading = false;
        this.notify();
        return;
      }

      if (archRes.ok) {
        const archPayload = await archRes.json();
        if (archPayload.success && Array.isArray(archPayload.data)) {
          this.archivedOrders = archPayload.data;
        }
      }

      if (fetchedActive) {
        this.activeOrders = fetchedActive;
        this.isInitialized = true;
      }

      this.latestAppliedGetId = requestId;
      this.isLoading = false;
      this.error = null;
      this.notify();
    } catch (err: any) {
      this.isLoading = false;
      this.error = err?.message || "Gagal terhubung ke server backend.";
      this.notify();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public getActiveOrders(): Record<StageName, OperationalOrder[]> {
    return this.activeOrders;
  }

  public getArchivedOrders(): OperationalOrder[] {
    return this.archivedOrders;
  }

  public getAllFlat(): OperationalOrder[] {
    const list: OperationalOrder[] = [];
    for (const stage of STAGES) {
      list.push(...(this.activeOrders[stage] || []));
    }
    list.push(...this.archivedOrders);
    return list;
  }

  public getOrderByNo(orderNo: string): OperationalOrder | undefined {
    for (const stage of STAGES) {
      const found = this.activeOrders[stage]?.find((o) => o.orderNo === orderNo);
      if (found) return found;
    }
    return this.archivedOrders.find((o) => o.orderNo === orderNo);
  }

  public getOrdersByStage(stage: StageName): OperationalOrder[] {
    return this.activeOrders[stage] || [];
  }

  /**
   * Phase 9.4: Synchronizes an order with the backend, reconciling temporary client identity
   * with authoritative backend identity and protecting against ghost rows on failure.
   */
  private async syncOrderToBackend(
    tempOrder: OperationalOrder,
    targetStage: StageName
  ): Promise<OperationalOrder> {
    const tempOrderNo = tempOrder.orderNo;
    const idempotencyKey = (tempOrder as any).clientRequestId || tempOrderNo;
    try {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotencyKey,
            ...this.getAuthHeader(),
          },
          body: JSON.stringify({
            ...tempOrder,
            clientRequestId: idempotencyKey,
          }),
        },
        15000
      );

      if (!res.ok) {
        throw await parseApiErrorResponse(
          res,
          `Gagal membuat order pada server (HTTP ${res.status}).`
        );
      }

      const payload = await res.json();
      if (!payload.success || !payload.data) {
        throw new ActionApiError(
          res.status || 500,
          payload?.error?.code || "INTERNAL_SERVER_ERROR",
          payload?.error?.message || payload?.message || "Gagal membuat order di server."
        );
      }

      const canonicalOrder: OperationalOrder = payload.data;
      const canonicalOrderNo = canonicalOrder.orderNo;

      // Reconcile in-memory active orders: remove any instance of tempOrderNo and canonicalOrderNo, then add canonicalOrder
      for (const stage of STAGES) {
        if (!this.activeOrders[stage]) continue;
        this.activeOrders[stage] = this.activeOrders[stage].filter(
          (o) => o.orderNo !== tempOrderNo && o.orderNo !== canonicalOrderNo
        );
      }
      if (!this.activeOrders[targetStage]) {
        this.activeOrders[targetStage] = [];
      }
      this.activeOrders[targetStage].unshift(canonicalOrder);

      // Reconcile linked invoice in financeStore if temporary ID differs from canonical
      if (tempOrderNo !== canonicalOrderNo) {
        try {
          const { financeStore } = await import("../../app/data/financeStore");
          financeStore.reconcileOrderNo(
            tempOrderNo,
            canonicalOrderNo,
            canonicalOrder.payment?.invoiceNo
          );
        } catch {
          // safe fallback
        }
      }

      this.bumpDataVersion();
      this.notify();
      return canonicalOrder;
    } catch (err) {
      // Phase 9.4 Finding 1: Anti-ghost row cleanup on failure
      for (const stage of STAGES) {
        if (!this.activeOrders[stage]) continue;
        const idx = this.activeOrders[stage].findIndex((o) => o.orderNo === tempOrderNo);
        if (idx !== -1) {
          this.activeOrders[stage].splice(idx, 1);
          break;
        }
      }
      try {
        const { financeStore } = await import("../../app/data/financeStore");
        financeStore.removeInvoiceByOrderNo(tempOrderNo);
      } catch {
        // safe fallback
      }
      this.bumpDataVersion();
      this.notify();
      if (err && typeof err === "object" && !(err as any).statusCode && !(err as any).code) {
        const netErr: any = new Error("Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba kembali.");
        netErr.statusCode = 0;
        netErr.code = "NETWORK_ERROR";
        throw netErr;
      }
      throw err;
    }
  }

  public addOrder(order: OperationalOrder): void {
    const targetStage: StageName = (STAGES as readonly string[]).includes(order.currentStageName as StageName)
      ? (order.currentStageName as StageName)
      : "Verifikasi";

    if (!this.activeOrders[targetStage]) {
      this.activeOrders[targetStage] = [];
    }
    this.activeOrders[targetStage].unshift(order);
    this.bumpDataVersion();
    this.notify();

    // Persist and reconcile in background, rolling back on failure
    this.syncOrderToBackend(order, targetStage).catch((err) => {
      console.error("Background sync for new order failed:", err);
    });
  }

  public async addOrderAsync(order: OperationalOrder): Promise<OperationalOrder> {
    const targetStage: StageName = (STAGES as readonly string[]).includes(order.currentStageName as StageName)
      ? (order.currentStageName as StageName)
      : "Verifikasi";

    if (!this.activeOrders[targetStage]) {
      this.activeOrders[targetStage] = [];
    }
    this.activeOrders[targetStage].unshift(order);
    this.bumpDataVersion();
    this.notify();

    return await this.syncOrderToBackend(order, targetStage);
  }

  private sanitizeUpdatesForPut(updates: Partial<OperationalOrder>): Record<string, unknown> {
    const protectedFields = new Set([
      "orderNo", "id", "createdAt", "updatedAt", "currentStep", "currentStageName",
      "stageBeforeCancel", "isArchived", "isCancelled", "cancelledAt", "cancelledBy",
      "cancellationReason", "approvedBySpv", "spvApprovedAt", "spvName", "spvNotes",
      "stage6Approved", "stage6ApprovedBy", "stage6ApprovedAt", "stage5Verified",
      "stage5VerifiedBy", "stage5VerifiedAt", "approvedDocsSnapshot", "documentApproval",
      "documentsVerified", "isVerified", "finalCost", "finalCostBreakdown", "finalBiayaJasa",
      "finalPkb", "finalSwdkllj", "finalDendaSwdkllj", "finalMutasiKeluar", "finalMutasiMasuk",
      "finalBiayaLainnya", "settlementCondition", "refundStatus", "refundAmount",
      "refundProcessedAt", "refundProcessedBy", "totalBiaya", "paymentStatus",
      // Cost verification protection
      "isCostVerified", "is_cost_verified", "costCompletenessStatus", "cost_completeness_status",
      "costVerifiedAt", "cost_verified_at", "costVerifiedBy", "cost_verified_by",
      "costSnapshot", "cost_snapshot", "costBreakdown", "cost_breakdown",
    ]);
    const sanitizedUpdates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (!protectedFields.has(key)) {
        sanitizedUpdates[key] = val;
      }
    }
    if (sanitizedUpdates.payment && typeof sanitizedUpdates.payment === "object" && !Array.isArray(sanitizedUpdates.payment)) {
      const protectedPaymentFields = new Set([
        "isPaymentVerified", "is_payment_verified", "isVerified", "is_verified",
        "paymentVerifiedAt", "payment_verified_at", "paymentVerifiedBy", "payment_verified_by",
        "isCostVerified", "is_cost_verified", "costCompletenessStatus", "cost_completeness_status",
        "costVerifiedAt", "cost_verified_at", "costVerifiedBy", "cost_verified_by",
        "nominalDibayarAwal", "nominal_dibayar_awal",
        "nominalPembayaranAwalTerkonfirmasi", "nominal_pembayaran_awal_terkonfirmasi",
        "paymentRecords", "payment_records", "riwayatKoreksiPembayaran", "riwayat_koreksi_pembayaran",
        "settlementCondition", "settlement_condition", "refundStatus", "refund_status",
        "refundAmount", "refund_amount", "refundProcessedAt", "refund_processed_at",
        "refundProcessedBy", "refund_processed_by",
      ]);
      const cleanPayment: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(sanitizedUpdates.payment)) {
        if (!protectedPaymentFields.has(pk) && pv !== undefined) {
          cleanPayment[pk] = pv;
        }
      }
      if (Object.keys(cleanPayment).length > 0) {
        sanitizedUpdates.payment = cleanPayment;
      } else {
        delete sanitizedUpdates.payment;
      }
    }
    return sanitizedUpdates;
  }

  public updateOrder(orderNo: string, updates: Partial<OperationalOrder>): boolean {
    let updated = false;

    for (const stage of STAGES) {
      const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo === orderNo) ?? -1;
      if (idx !== -1) {
        this.activeOrders[stage][idx] = {
          ...this.activeOrders[stage][idx],
          ...updates,
        };
        updated = true;
        break;
      }
    }

    if (!updated) {
      const archIdx = this.archivedOrders.findIndex((o) => o.orderNo === orderNo);
      if (archIdx !== -1) {
        this.archivedOrders[archIdx] = {
          ...this.archivedOrders[archIdx],
          ...updates,
        };
        updated = true;
      }
    }

    if (updated) {
      this.bumpDataVersion();
      this.notify();

      // Sanitize protected root and payment fields before sending PUT to backend
      const sanitizedUpdates = this.sanitizeUpdatesForPut(updates);
      if (Object.keys(sanitizedUpdates).length === 0) {
        return updated;
      }

      fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderNo)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify(sanitizedUpdates),
      })
        .then(async (res) => {
          if (!res.ok) {
            let errMsg = `HTTP ${res.status}`;
            try {
              const errPayload = await res.json();
              if (errPayload.message || errPayload.error?.message) {
                errMsg = errPayload.message || errPayload.error?.message;
              }
            } catch {
              // ignore json parse error
            }
            console.error(`[ApiOrderProvider] Gagal memperbarui order ${orderNo} di server:`, errMsg);
            toast.error(`Gagal sinkronisasi ke server: ${errMsg}`);
          }
        })
        .catch((err) => {
          console.error(`[ApiOrderProvider] Network error saat memperbarui order ${orderNo}:`, err);
          toast.error(`Koneksi server terputus saat memperbarui order: ${err?.message || "Gagal"}`);
        });
    }

    return updated;
  }

  public async updateOrderAsync(orderNo: string, updates: Partial<OperationalOrder>): Promise<boolean> {
    const sanitizedUpdates = this.sanitizeUpdatesForPut(updates);
    try {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/orders/${encodeURIComponent(orderNo)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
          body: JSON.stringify(sanitizedUpdates),
        },
        15000
      );
      if (!res.ok) {
        throw await parseApiErrorResponse(
          res,
          `Gagal memperbarui data order ${orderNo} di server.`
        );
      }

      let serverOrder: Partial<OperationalOrder> | null = null;
      try {
        const resPayload = await res.json();
        if (resPayload?.data && typeof resPayload.data === "object") {
          serverOrder = resPayload.data;
        }
      } catch {}

      // Backend confirmed success: apply updates to in-memory cache
      let updated = false;
      for (const stage of STAGES) {
        const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo === orderNo) ?? -1;
        if (idx !== -1) {
          this.activeOrders[stage][idx] = {
            ...this.activeOrders[stage][idx],
            ...updates,
            ...(serverOrder || {}),
          };
          updated = true;
          break;
        }
      }

      if (!updated) {
        const archIdx = this.archivedOrders.findIndex((o) => o.orderNo === orderNo);
        if (archIdx !== -1) {
          this.archivedOrders[archIdx] = {
            ...this.archivedOrders[archIdx],
            ...updates,
            ...(serverOrder || {}),
          };
          updated = true;
        }
      }

      this.bumpDataVersion();
      this.notify();
      return true;
    } catch (err: any) {
      if (err && typeof err === "object" && !(err as any).statusCode && !(err as any).code) {
        const netErr: any = new Error("Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba kembali.");
        netErr.statusCode = 0;
        netErr.code = "NETWORK_ERROR";
        throw netErr;
      }
      throw err;
    }
  }

  public async advanceOrderAsync(
    orderNo: string,
    targetStage: StageName,
    updates: Partial<OperationalOrder> = {}
  ): Promise<OperationalOrder> {
    this.inFlightMutationCount++;
    try {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/orders/${encodeURIComponent(orderNo)}/advance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
          body: JSON.stringify({ targetStage, updates }),
        },
        15000
      );

      if (!res.ok) {
        throw await parseApiErrorResponse(
          res,
          `Gagal memajukan order ${orderNo} ke tahap ${targetStage}.`
        );
      }

      const payload = await res.json();
      if (!payload.success || !payload.data) {
        throw new ActionApiError(
          res.status || 500,
          payload?.error?.code || "INTERNAL_SERVER_ERROR",
          payload?.error?.message || payload?.message || `Gagal memajukan order ${orderNo} ke ${targetStage}`
        );
      }

      const serverOrder: OperationalOrder = payload.data;

      // Authoritative state update: remove order from all stages, place into destination stage
      for (const stage of STAGES) {
        if (!this.activeOrders[stage]) continue;
        this.activeOrders[stage] = this.activeOrders[stage].filter(
          (o) => o.orderNo !== orderNo
        );
      }

      const destStage = (STAGES as readonly string[]).includes(serverOrder.currentStageName as StageName)
        ? (serverOrder.currentStageName as StageName)
        : targetStage;

      if (!this.activeOrders[destStage]) {
        this.activeOrders[destStage] = [];
      }
      this.activeOrders[destStage].unshift(serverOrder);

      this.bumpDataVersion();
      this.notify();
      return serverOrder;
    } finally {
      this.inFlightMutationCount = Math.max(0, this.inFlightMutationCount - 1);
    }
  }

  public advanceOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): boolean {
    this.advanceOrderAsync(orderNo, targetStage, updates).catch((err) => {
      console.error(`[ApiOrderProvider] advanceOrder error:`, err);
      toast.error(`Gagal memajukan order ${orderNo}: ${err?.message || "Kesalahan server"}`);
    });
    return true;
  }

  public async rollbackOrderAsync(
    orderNo: string,
    targetStage: StageName,
    updates: Partial<OperationalOrder> = {}
  ): Promise<OperationalOrder> {
    this.inFlightMutationCount++;
    try {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/orders/${encodeURIComponent(orderNo)}/rollback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
          body: JSON.stringify({ targetStage, updates }),
        },
        15000
      );

      if (!res.ok) {
        throw await parseApiErrorResponse(
          res,
          `Gagal mengembalikan order ${orderNo} ke tahap ${targetStage}.`
        );
      }

      const payload = await res.json();
      if (!payload.success || !payload.data) {
        throw new ActionApiError(
          res.status || 500,
          payload?.error?.code || "INTERNAL_SERVER_ERROR",
          payload?.error?.message || payload?.message || `Gagal me-rollback order ${orderNo} ke ${targetStage}`
        );
      }

      const serverOrder: OperationalOrder = payload.data;

      for (const stage of STAGES) {
        if (!this.activeOrders[stage]) continue;
        this.activeOrders[stage] = this.activeOrders[stage].filter(
          (o) => o.orderNo !== orderNo
        );
      }

      const destStage = (STAGES as readonly string[]).includes(serverOrder.currentStageName as StageName)
        ? (serverOrder.currentStageName as StageName)
        : targetStage;

      if (!this.activeOrders[destStage]) {
        this.activeOrders[destStage] = [];
      }
      this.activeOrders[destStage].unshift(serverOrder);

      this.bumpDataVersion();
      this.notify();
      return serverOrder;
    } finally {
      this.inFlightMutationCount = Math.max(0, this.inFlightMutationCount - 1);
    }
  }

  public rollbackOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): boolean {
    this.rollbackOrderAsync(orderNo, targetStage, updates).catch((err) => {
      console.error(`[ApiOrderProvider] rollbackOrder error:`, err);
      toast.error(`Gagal me-rollback order ${orderNo}: ${err?.message || "Kesalahan server"}`);
    });
    return true;
  }

  public async archiveOrderAsync(orderNo: string): Promise<boolean> {
    this.inFlightMutationCount++;
    try {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/orders/${encodeURIComponent(orderNo)}/archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        },
        15000
      );

      if (!res.ok) {
        throw await parseApiErrorResponse(res, `Gagal mengarsipkan order ${orderNo}.`);
      }

      let archivedOrder: OperationalOrder | undefined;
      for (const stage of STAGES) {
        const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo === orderNo) ?? -1;
        if (idx !== -1) {
          archivedOrder = this.activeOrders[stage][idx];
          this.activeOrders[stage].splice(idx, 1);
          break;
        }
      }

      if (archivedOrder) {
        this.archivedOrders.unshift({
          ...archivedOrder,
          isArchived: true,
          currentStageName: "Dokumen Telah Diterima",
          currentStep: 8,
        });
      }

      this.bumpDataVersion();
      this.notify();
      return true;
    } finally {
      this.inFlightMutationCount = Math.max(0, this.inFlightMutationCount - 1);
    }
  }

  public archiveOrder(orderNo: string): boolean {
    this.archiveOrderAsync(orderNo).catch((err) => {
      console.error(`[ApiOrderProvider] archiveOrder error:`, err);
      toast.error(`Gagal mengarsipkan order ${orderNo}: ${err?.message || "Kesalahan server"}`);
    });
    return true;
  }

  public deleteArchivedOrder(orderNo: string): boolean {
    const idx = this.archivedOrders.findIndex((o) => o.orderNo === orderNo);
    if (idx !== -1) {
      this.archivedOrders.splice(idx, 1);
      this.bumpDataVersion();
      this.notify();

      fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderNo)}/archive`, {
        method: "DELETE",
        headers: { ...this.getAuthHeader() },
      }).catch(() => {
        // background sync fallback
      });

      return true;
    }
    return false;
  }

  public async deleteOrder(orderNo: string): Promise<boolean> {
    const cleanNo = (orderNo || "").trim().toUpperCase();
    if (!cleanNo) return false;

    const res = await fetchWithTimeout(
      `${this.baseUrl}/orders/${encodeURIComponent(cleanNo)}`,
      {
        method: "DELETE",
        headers: { ...this.getAuthHeader() },
      },
      15000
    );

    if (!res.ok) {
      throw await parseApiErrorResponse(
        res,
        `Gagal menghapus data order ${cleanNo} di server.`
      );
    }

    // Remove from in-memory caches strictly after backend confirms deletion
    for (const stage of Object.keys(this.activeOrders) as StageName[]) {
      this.activeOrders[stage] = (this.activeOrders[stage] || []).filter(
        (o) => (o.orderNo || "").toUpperCase() !== cleanNo
      );
    }

    const archIdx = this.archivedOrders.findIndex((o) => (o.orderNo || "").toUpperCase() === cleanNo);
    if (archIdx !== -1) {
      this.archivedOrders.splice(archIdx, 1);
    }

    this.bumpDataVersion();
    this.notify();
    return true;
  }

  public clearArchivedOrders(): boolean {
    this.archivedOrders = [];
    this.bumpDataVersion();
    this.notify();

    fetch(`${this.baseUrl}/orders/archive/clear-all`, {
      method: "DELETE",
      headers: { ...this.getAuthHeader() },
    }).catch(() => {
      // background sync fallback
    });

    return true;
  }

  public async cancelOrder(orderNo: string, reason?: string): Promise<boolean> {
    const cleanNo = (orderNo || "").trim().toUpperCase();
    const reasonText = (reason || "").trim() || "Pembatalan melalui Admin";

    const res = await fetchWithTimeout(
      `${this.baseUrl}/orders/${encodeURIComponent(cleanNo)}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify({ reason: reasonText }),
      },
      15000
    );

    if (!res.ok) {
      throw await parseApiErrorResponse(
        res,
        `Gagal membatalkan order ${cleanNo}.`
      );
    }

    const resJson = await res.json().catch(() => ({}));
    const updatedOrder: OperationalOrder | undefined = resJson.data;

    let placed = false;
    for (const stage of STAGES) {
      const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo.toUpperCase() === cleanNo) ?? -1;
      if (idx !== -1) {
        const ord = this.activeOrders[stage][idx];
        this.activeOrders[stage][idx] = {
          ...ord,
          ...(updatedOrder || {}),
          currentStageName: "Dibatalkan" as any,
          stageBeforeCancel: (ord as any).stageBeforeCancel || stage,
          catatanOrder:
            (updatedOrder as any)?.catatanOrder ||
            `${ord.catatanOrder ? ord.catatanOrder + " | " : ""}Dibatalkan: ${reasonText}`,
        };
        (this.activeOrders[stage][idx] as any).isCancelled = true;
        (this.activeOrders[stage][idx] as any).status = "Dibatalkan";
        (this.activeOrders[stage][idx] as any).cancellationReason = reasonText;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const archIdx = this.archivedOrders.findIndex((o) => o.orderNo.toUpperCase() === cleanNo);
      if (archIdx !== -1) {
        const ord = this.archivedOrders[archIdx];
        this.archivedOrders[archIdx] = {
          ...ord,
          ...(updatedOrder || {}),
          currentStageName: "Dibatalkan" as any,
          catatanOrder:
            (updatedOrder as any)?.catatanOrder ||
            `${ord.catatanOrder ? ord.catatanOrder + " | " : ""}Dibatalkan: ${reasonText}`,
        };
        (this.archivedOrders[archIdx] as any).isCancelled = true;
        (this.archivedOrders[archIdx] as any).status = "Dibatalkan";
        (this.archivedOrders[archIdx] as any).cancellationReason = reasonText;
        placed = true;
      }
    }

    if (!placed && updatedOrder) {
      this.archivedOrders.unshift({
        ...updatedOrder,
        currentStageName: "Dibatalkan" as any,
        isCancelled: true,
        status: "Dibatalkan",
        cancellationReason: reasonText,
      });
    }

    this.bumpDataVersion();
    this.notify();
    return true;
  }

  /**
   * Updates local in-memory cache from an already-confirmed backend order response
   * without triggering an extra PUT request.
   */
  public applyServerOrderSnapshot(orderNo: string, updates: Partial<OperationalOrder>): boolean {
    let applied = false;
    for (const stage of STAGES) {
      const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo === orderNo) ?? -1;
      if (idx !== -1) {
        this.activeOrders[stage][idx] = {
          ...this.activeOrders[stage][idx],
          ...updates,
        };
        applied = true;
        break;
      }
    }
    if (!applied) {
      const archIdx = this.archivedOrders.findIndex((o) => o.orderNo === orderNo);
      if (archIdx !== -1) {
        this.archivedOrders[archIdx] = {
          ...this.archivedOrders[archIdx],
          ...updates,
        };
        applied = true;
      }
    }
    if (applied) {
      this.bumpDataVersion();
      this.notify();
    }
    return applied;
  }

  public async verifyPaymentAsync(
    orderNo: string,
    verifierName: string = "Admin",
    confirmedAmount?: number,
    notes?: string,
    proofPayload?: any
  ): Promise<OperationalOrder> {
    const targetOrder = this.getOrderByNo(orderNo);
    const totalBiaya = targetOrder?.payment?.totalBiaya || targetOrder?.totalEstimasi || 0;
    const paid =
      confirmedAmount !== undefined
        ? Math.max(0, confirmedAmount)
        : targetOrder?.payment?.nominalDibayarAwal !== undefined
        ? targetOrder.payment.nominalDibayarAwal
        : targetOrder?.payment?.dibayar && targetOrder.payment.dibayar > 0
        ? targetOrder.payment.dibayar
        : totalBiaya;
    const effectiveProof = proofPayload || targetOrder?.payment?.buktiPembayaran;

    const res = await fetchWithTimeout(
      `${this.baseUrl}/orders/${encodeURIComponent(orderNo)}/verify-payment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify({
          verifierName,
          confirmedAmount: paid,
          notes,
          buktiPembayaran: effectiveProof,
        }),
      },
      15000
    );

    if (!res.ok) {
      throw await parseApiErrorResponse(
        res,
        `Gagal memverifikasi pembayaran untuk order ${orderNo}.`
      );
    }

    const payload = await res.json().catch(() => ({}));
    const serverOrder: OperationalOrder | undefined = payload?.data;

    if (serverOrder && typeof serverOrder === "object") {
      this.applyServerOrderSnapshot(orderNo, serverOrder);
      return this.getOrderByNo(orderNo) || serverOrder;
    }

    const nowStr = new Date().toISOString();
    const sisa = Math.max(0, totalBiaya - paid);
    const overpayment = Math.max(0, paid - totalBiaya);
    const statusPembayaran = paid >= totalBiaya ? "Lunas" : paid > 0 ? "Kurang Bayar" : "Belum Bayar";
    const fallbackPayment = {
      ...(targetOrder?.payment || {}),
      isPaymentVerified: true,
      paymentVerifiedAt: nowStr,
      paymentVerifiedBy: verifierName,
      nominalPembayaranAwalTerkonfirmasi: paid,
      statusPembayaran: statusPembayaran as any,
      dibayar: paid,
      kurang: sisa,
      overpayment,
      buktiPembayaran: effectiveProof,
      tanggalBayar: nowStr.split("T")[0],
    };
    this.applyServerOrderSnapshot(orderNo, { payment: fallbackPayment as any });
    return this.getOrderByNo(orderNo) || ({ ...(targetOrder || { orderNo }), payment: fallbackPayment } as OperationalOrder);
  }

  public verifyPayment(orderNo: string, verifierName: string = "Admin", confirmedAmount?: number, notes?: string, proofPayload?: any): boolean {
    this.verifyPaymentAsync(orderNo, verifierName, confirmedAmount, notes, proofPayload).catch((err) => {
      console.error("[ApiOrderProvider] verifyPayment error:", err);
      toast.error(err?.message || "Gagal memverifikasi pembayaran order.");
    });
    return true;
  }
}
