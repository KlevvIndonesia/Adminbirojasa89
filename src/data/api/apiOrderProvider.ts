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
import { createInitialOrders } from "../mock/orderMockData";
import { APP_CONFIG } from "../../app/config/appConfig";
import { toast } from "sonner";

export class ApiOrderProvider implements IOrderDataProvider {
  private baseUrl: string;
  private activeOrders: Record<StageName, OperationalOrder[]> = createInitialOrders();
  private archivedOrders: OperationalOrder[] = [];
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;
  private isLoading = false;
  private error: string | null = null;

  constructor(baseUrl = APP_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    if (typeof window === "undefined" || (typeof window !== "undefined" && window.localStorage?.getItem("auth_token"))) {
      this.initFromApi();
    }
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
      const authHeaders = this.getAuthHeader();
      if (!authHeaders.Authorization) return;
      try {
        const res = await fetch(`${this.baseUrl}/orders`, {
          headers: { "Content-Type": "application/json", ...authHeaders },
        });
        if (res.ok) {
          const payload = await res.json();
          if (payload.success && payload.data) {
            this.activeOrders = payload.data;
          }
        }
        const archRes = await fetch(`${this.baseUrl}/orders/archived`, {
          headers: { "Content-Type": "application/json", ...authHeaders },
        });
        if (archRes.ok) {
          const archPayload = await archRes.json();
          if (archPayload.success && Array.isArray(archPayload.data)) {
            this.archivedOrders = archPayload.data;
          }
        }
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
    const authHeaders = this.getAuthHeader();
    if (!authHeaders.Authorization) {
      this.isInitialized = true;
      this.notify();
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.notify();

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

      const payload = await res.json();
      if (payload.success && payload.data) {
        this.activeOrders = payload.data;
        this.isInitialized = true;
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
      if (archRes.ok) {
        const archPayload = await archRes.json();
        if (archPayload.success && Array.isArray(archPayload.data)) {
          this.archivedOrders = archPayload.data;
        }
      }

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
      const res = await fetch(`${this.baseUrl}/orders`, {
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
      });

      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sun89_auth_unauthorized"));
        }
        let errMessage = `HTTP ${res.status}`;
        try {
          const errPayload = await res.json();
          if (errPayload.message) errMessage = errPayload.message;
        } catch {
          // ignore json parse error
        }
        throw new Error(`Order creation failed on backend: ${errMessage}`);
      }

      const payload = await res.json();
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || "Failed to create order on backend.");
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
      this.notify();
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
    this.notify();

    return await this.syncOrderToBackend(order, targetStage);
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
      this.notify();

      // Sanitize protected fields before sending PUT to backend (enforces P1-B protection compatibility)
      const protectedFields = new Set([
        "orderNo", "id", "createdAt", "updatedAt", "currentStep", "currentStageName",
        "stageBeforeCancel", "isArchived", "isCancelled", "cancelledAt", "cancelledBy",
        "cancellationReason", "approvedBySpv", "spvApprovedAt", "spvName", "spvNotes",
        "stage6Approved", "stage6ApprovedBy", "stage6ApprovedAt", "stage5Verified",
        "stage5VerifiedBy", "stage5VerifiedAt", "approvedDocsSnapshot", "documentApproval",
        "documentsVerified", "isVerified", "finalCost", "finalCostBreakdown", "finalBiayaJasa",
        "finalPkb", "finalSwdkllj", "finalDendaSwdkllj", "finalMutasiKeluar", "finalMutasiMasuk",
        "finalBiayaLainnya", "settlementCondition", "refundStatus", "refundAmount",
        "refundProcessedAt", "refundProcessedBy", "totalBiaya", "paymentStatus"
      ]);
      const sanitizedUpdates: Record<string, any> = {};
      for (const [key, val] of Object.entries(updates)) {
        if (!protectedFields.has(key)) {
          sanitizedUpdates[key] = val;
        }
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
    const updated = this.updateOrder(orderNo, updates);
    const protectedFields = new Set([
      "orderNo", "id", "createdAt", "updatedAt", "currentStep", "currentStageName",
      "stageBeforeCancel", "isArchived", "isCancelled", "cancelledAt", "cancelledBy",
      "cancellationReason", "approvedBySpv", "spvApprovedAt", "spvName", "spvNotes",
      "stage6Approved", "stage6ApprovedBy", "stage6ApprovedAt", "stage5Verified",
      "stage5VerifiedBy", "stage5VerifiedAt", "approvedDocsSnapshot", "documentApproval",
      "documentsVerified", "isVerified", "finalCost", "finalCostBreakdown", "finalBiayaJasa",
      "finalPkb", "finalSwdkllj", "finalDendaSwdkllj", "finalMutasiKeluar", "finalMutasiMasuk",
      "finalBiayaLainnya", "settlementCondition", "refundStatus", "refundAmount",
      "refundProcessedAt", "refundProcessedBy", "totalBiaya", "paymentStatus"
    ]);
    const sanitizedUpdates: Record<string, any> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (!protectedFields.has(key)) {
        sanitizedUpdates[key] = val;
      }
    }
    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderNo)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(sanitizedUpdates),
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errPayload = await res.json();
        if (errPayload.message || errPayload.error?.message) {
          errMsg = errPayload.message || errPayload.error?.message;
        }
      } catch {}
      throw new Error(errMsg);
    }
    return updated;
  }

  public advanceOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): boolean {
    let foundOrder: OperationalOrder | undefined;
    let originStage: StageName | undefined;

    for (const stage of STAGES) {
      const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo === orderNo) ?? -1;
      if (idx !== -1) {
        foundOrder = this.activeOrders[stage][idx];
        originStage = stage;
        this.activeOrders[stage].splice(idx, 1);
        break;
      }
    }

    if (!foundOrder) return false;

    const stageIndex = (STAGES as readonly string[]).indexOf(targetStage);
    const updatedOrder: OperationalOrder = {
      ...foundOrder,
      ...updates,
      currentStageName: targetStage,
      currentStep: stageIndex >= 0 ? stageIndex + 1 : foundOrder.currentStep,
    };

    if (!this.activeOrders[targetStage]) {
      this.activeOrders[targetStage] = [];
    }
    this.activeOrders[targetStage].unshift(updatedOrder);
    this.notify();

    fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderNo)}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify({ targetStage, updates }),
    }).catch(() => {
      // background sync fallback
    });

    return true;
  }

  public rollbackOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): boolean {
    return this.advanceOrder(orderNo, targetStage, updates);
  }

  public archiveOrder(orderNo: string): boolean {
    let foundOrder: OperationalOrder | undefined;

    for (const stage of STAGES) {
      const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo === orderNo) ?? -1;
      if (idx !== -1) {
        foundOrder = this.activeOrders[stage][idx];
        this.activeOrders[stage].splice(idx, 1);
        break;
      }
    }

    if (!foundOrder) return false;

    this.archivedOrders.unshift({
      ...foundOrder,
      currentStageName: "Dokumen Telah Diterima",
      currentStep: 8,
    });
    this.notify();

    fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderNo)}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
    }).catch(() => {
      // background sync fallback
    });

    return true;
  }

  public deleteArchivedOrder(orderNo: string): boolean {
    const idx = this.archivedOrders.findIndex((o) => o.orderNo === orderNo);
    if (idx !== -1) {
      this.archivedOrders.splice(idx, 1);
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

    // Remove from in-memory active orders
    let found = false;
    for (const stage of Object.keys(this.activeOrders) as StageName[]) {
      const initialLen = this.activeOrders[stage]?.length ?? 0;
      this.activeOrders[stage] = (this.activeOrders[stage] || []).filter(
        (o) => (o.orderNo || "").toUpperCase() !== cleanNo
      );
      if (this.activeOrders[stage].length < initialLen) {
        found = true;
      }
    }

    // Remove from in-memory archived orders
    const archIdx = this.archivedOrders.findIndex((o) => (o.orderNo || "").toUpperCase() === cleanNo);
    if (archIdx !== -1) {
      this.archivedOrders.splice(archIdx, 1);
      found = true;
    }

    if (found) {
      this.notify();
    }

    // Call backend DELETE /orders/:orderNo
    try {
      const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(cleanNo)}`, {
        method: "DELETE",
        headers: { ...this.getAuthHeader() },
      });
      return res.ok;
    } catch (err) {
      console.warn("[ApiOrderProvider] Error during hard delete order request:", err);
      return false;
    }
  }

  public clearArchivedOrders(): boolean {
    this.archivedOrders = [];
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

    // Optimistic update
    for (const stage of STAGES) {
      const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo.toUpperCase() === cleanNo) ?? -1;
      if (idx !== -1) {
        const ord = this.activeOrders[stage][idx];
        this.activeOrders[stage][idx] = {
          ...ord,
          currentStageName: "Dibatalkan" as any,
          stageBeforeCancel: (ord as any).stageBeforeCancel || stage,
          catatanOrder: `${ord.catatanOrder ? ord.catatanOrder + " | " : ""}Dibatalkan: ${reasonText}`,
        };
        (this.activeOrders[stage][idx] as any).isCancelled = true;
        (this.activeOrders[stage][idx] as any).status = "Dibatalkan";
        (this.activeOrders[stage][idx] as any).cancellationReason = reasonText;
        break;
      }
    }

    const archIdx = this.archivedOrders.findIndex((o) => o.orderNo.toUpperCase() === cleanNo);
    if (archIdx !== -1) {
      const ord = this.archivedOrders[archIdx];
      this.archivedOrders[archIdx] = {
        ...ord,
        currentStageName: "Dibatalkan" as any,
        catatanOrder: `${ord.catatanOrder ? ord.catatanOrder + " | " : ""}Dibatalkan: ${reasonText}`,
      };
      (this.archivedOrders[archIdx] as any).isCancelled = true;
      (this.archivedOrders[archIdx] as any).status = "Dibatalkan";
      (this.archivedOrders[archIdx] as any).cancellationReason = reasonText;
    }

    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(cleanNo)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify({ reason: reasonText }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errorMsg = errData.error?.message || errData.message || `Gagal membatalkan order (HTTP ${res.status})`;
        throw new Error(errorMsg);
      }

      const resJson = await res.json().catch(() => ({}));
      const updatedOrder: OperationalOrder | undefined = resJson.data;

      if (updatedOrder) {
        let placed = false;
        for (const stage of STAGES) {
          const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo.toUpperCase() === cleanNo) ?? -1;
          if (idx !== -1) {
            this.activeOrders[stage][idx] = {
              ...this.activeOrders[stage][idx],
              ...updatedOrder,
              currentStageName: "Dibatalkan" as any,
              stageBeforeCancel: (this.activeOrders[stage][idx] as any).stageBeforeCancel || stage,
            };
            (this.activeOrders[stage][idx] as any).isCancelled = true;
            (this.activeOrders[stage][idx] as any).status = "Dibatalkan";
            (this.activeOrders[stage][idx] as any).cancellationReason = reasonText;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const aIdx = this.archivedOrders.findIndex((o) => o.orderNo.toUpperCase() === cleanNo);
          if (aIdx !== -1) {
            this.archivedOrders[aIdx] = {
              ...this.archivedOrders[aIdx],
              ...updatedOrder,
              currentStageName: "Dibatalkan" as any,
            };
            (this.archivedOrders[aIdx] as any).isCancelled = true;
            (this.archivedOrders[aIdx] as any).status = "Dibatalkan";
            (this.archivedOrders[aIdx] as any).cancellationReason = reasonText;
            placed = true;
          }
        }
        if (!placed) {
          this.archivedOrders.unshift({
            ...updatedOrder,
            currentStageName: "Dibatalkan" as any,
            isCancelled: true,
            status: "Dibatalkan",
            cancellationReason: reasonText,
          });
        }
      }

      this.notify();
      return true;
    } catch (err) {
      console.error("Failed to cancel order on backend:", err);
      throw err;
    }
  }

  public verifyPayment(orderNo: string, verifierName: string = "Admin", confirmedAmount?: number, notes?: string, proofPayload?: any): boolean {
    const targetOrder = this.getOrderByNo(orderNo);
    if (!targetOrder) return false;

    const nowStr = new Date().toISOString();
    const totalBiaya = targetOrder.payment?.totalBiaya || targetOrder.totalEstimasi || 0;
    const paid = confirmedAmount !== undefined
      ? Math.max(0, confirmedAmount)
      : (targetOrder.payment?.nominalDibayarAwal !== undefined
          ? targetOrder.payment.nominalDibayarAwal
          : (targetOrder.payment?.dibayar && targetOrder.payment.dibayar > 0 ? targetOrder.payment.dibayar : totalBiaya));
    const sisa = Math.max(0, totalBiaya - paid);
    const overpayment = Math.max(0, paid - totalBiaya);
    const statusPembayaran = paid >= totalBiaya ? "Lunas" : paid > 0 ? "Kurang Bayar" : "Belum Bayar";

    const prev = targetOrder.payment?.nominalPembayaranAwalTerkonfirmasi ?? targetOrder.payment?.nominalDibayarAwal ?? targetOrder.payment?.dibayar ?? 0;
    const riwayat = [...(targetOrder.payment?.riwayatKoreksiPembayaran || [])];
    if (prev !== paid || notes) {
      riwayat.push({
        nominalLama: prev,
        nominalBaru: paid,
        tanggal: nowStr,
        admin: verifierName,
        catatan: notes,
      });
    }

    const updatedPayment = {
      ...targetOrder.payment,
      isPaymentVerified: true,
      paymentVerifiedAt: nowStr,
      paymentVerifiedBy: verifierName,
      nominalPembayaranAwalTerkonfirmasi: paid,
      statusPembayaran: statusPembayaran as any,
      dibayar: paid,
      kurang: sisa,
      overpayment,
      tanggalBayar: nowStr.split("T")[0],
      riwayatKoreksiPembayaran: riwayat,
    };

    // Update in-memory state
    this.updateOrder(orderNo, { payment: updatedPayment });

    // Persist to dedicated Express endpoint /api/orders/:orderNo/verify-payment
    const effectiveProof = proofPayload || targetOrder.payment?.buktiPembayaran;
    const existingRecords = targetOrder.payment?.paymentRecords || [];
    const newRecord: any = {
      id: `pay-verif-${Date.now()}`,
      nominal: paid,
      tanggal: nowStr,
      metodePembayaran: targetOrder.payment?.metodePembayaran || "Transfer Bank",
      namaBank: targetOrder.payment?.namaBank,
      namaRekening: targetOrder.payment?.namaRekening,
      noRekening: targetOrder.payment?.noRekening,
      buktiPembayaran: effectiveProof,
      statusVerifikasi: "TERVERIFIKASI",
      verifiedAt: nowStr,
      verifiedBy: verifierName,
      catatan: notes,
    };
    updatedPayment.buktiPembayaran = effectiveProof;
    updatedPayment.paymentRecords = [...existingRecords, newRecord];

    fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderNo)}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify({ verifierName, confirmedAmount: paid, notes, buktiPembayaran: effectiveProof }),
    }).catch(() => {
      // background sync fallback
    });

    return true;
  }
}
