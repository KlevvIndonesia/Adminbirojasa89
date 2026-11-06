/**
 * Mock Order Data Provider
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Serves as the single mock data provider for order fixtures and in-memory persistence.
 * Can be swapped with ApiOrderProvider when Express backend is connected in Phase 7.
 */

import { OperationalOrder, StageName, STAGES } from "../../domain/order/types";
import { createInitialOrders } from "./orderMockData";

export interface IOrderDataProvider {
  getActiveOrders(): Record<StageName, OperationalOrder[]>;
  getArchivedOrders(): OperationalOrder[];
  getAllFlat(): OperationalOrder[];
  getOrderByNo(orderNo: string): OperationalOrder | undefined;
  getOrdersByStage(stage: StageName): OperationalOrder[];
  addOrder(order: OperationalOrder): void;
  addOrderAsync?(order: OperationalOrder): Promise<OperationalOrder>;
  updateOrder(orderNo: string, updates: Partial<OperationalOrder>): boolean;
  advanceOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder>): boolean;
  advanceOrderAsync?(orderNo: string, targetStage: StageName, updates?: Partial<OperationalOrder>): Promise<OperationalOrder | false>;
  rollbackOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder>): boolean;
  rollbackOrderAsync?(orderNo: string, targetStage: StageName, updates?: Partial<OperationalOrder>): Promise<OperationalOrder | false>;
  archiveOrder(orderNo: string): boolean;
  archiveOrderAsync?(orderNo: string): Promise<boolean>;
  deleteArchivedOrder?(orderNo: string): boolean;
  deleteOrder?(orderNo: string): boolean | Promise<boolean>;
  clearArchivedOrders?(): boolean;
  cancelOrder?(orderNo: string, reason?: string): boolean | Promise<boolean>;
  verifyPayment?(orderNo: string, verifierName?: string, confirmedAmount?: number, notes?: string): boolean;
  subscribe(listener: () => void): () => void;
  getIsLoading?(): boolean;
  getError?(): string | null;
  getIsInitialized?(): boolean;
  refresh?(): Promise<void>;
}

export class MockOrderProvider implements IOrderDataProvider {
  private activeOrders: Record<StageName, OperationalOrder[]> = createInitialOrders();
  private archivedOrders: OperationalOrder[] = [];
  private listeners: Set<() => void> = new Set();

  public getIsLoading(): boolean {
    return false;
  }

  public getError(): string | null {
    return null;
  }

  public getIsInitialized(): boolean {
    return true;
  }

  public async refresh(): Promise<void> {
    this.notify();
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
      const found = this.activeOrders[stage].find((o) => o.orderNo === orderNo);
      if (found) return found;
    }
    return this.archivedOrders.find((o) => o.orderNo === orderNo);
  }

  public getOrdersByStage(stage: StageName): OperationalOrder[] {
    return this.activeOrders[stage] || [];
  }

  public addOrder(order: OperationalOrder): void {
    const stageCandidate = order.currentStageName as StageName;
    const targetStage: StageName = (STAGES as readonly string[]).includes(stageCandidate)
      ? stageCandidate
      : "Verifikasi";
    if (!this.activeOrders[targetStage]) {
      this.activeOrders[targetStage] = [];
    }
    this.activeOrders[targetStage].unshift(order);
    this.notify();
  }

  public async addOrderAsync(order: OperationalOrder): Promise<OperationalOrder> {
    this.addOrder(order);
    return order;
  }

  public updateOrder(orderNo: string, updates: Partial<OperationalOrder>): boolean {
    for (const stage of STAGES) {
      const idx = this.activeOrders[stage].findIndex((o) => o.orderNo === orderNo);
      if (idx !== -1) {
        this.activeOrders[stage][idx] = {
          ...this.activeOrders[stage][idx],
          ...updates,
        };
        this.notify();
        return true;
      }
    }

    const archIdx = this.archivedOrders.findIndex((o) => o.orderNo === orderNo);
    if (archIdx !== -1) {
      this.archivedOrders[archIdx] = {
        ...this.archivedOrders[archIdx],
        ...updates,
      };
      this.notify();
      return true;
    }

    return false;
  }

  public advanceOrder(
    orderNo: string,
    targetStage: StageName,
    updates: Partial<OperationalOrder>
  ): boolean {
    let currentOrder: OperationalOrder | undefined;
    let fromStage: StageName | undefined;

    for (const stage of STAGES) {
      const idx = this.activeOrders[stage].findIndex((o) => o.orderNo === orderNo);
      if (idx !== -1) {
        fromStage = stage;
        currentOrder = this.activeOrders[stage][idx];
        this.activeOrders[stage].splice(idx, 1);
        break;
      }
    }

    if (!currentOrder || !fromStage) return false;

    const updatedOrder: OperationalOrder = {
      ...currentOrder,
      ...updates,
      currentStageName: targetStage,
      currentStep: STAGES.indexOf(targetStage) + 1,
    };

    if (!this.activeOrders[targetStage]) {
      this.activeOrders[targetStage] = [];
    }
    this.activeOrders[targetStage].unshift(updatedOrder);
    this.notify();
    return true;
  }

  public async advanceOrderAsync(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): Promise<OperationalOrder | false> {
    const ok = this.advanceOrder(orderNo, targetStage, updates);
    return ok ? (this.getOrderByNo(orderNo) || false) : false;
  }

  public rollbackOrder(
    orderNo: string,
    targetStage: StageName,
    updates: Partial<OperationalOrder>
  ): boolean {
    return this.advanceOrder(orderNo, targetStage, updates);
  }

  public async rollbackOrderAsync(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): Promise<OperationalOrder | false> {
    const ok = this.rollbackOrder(orderNo, targetStage, updates);
    return ok ? (this.getOrderByNo(orderNo) || false) : false;
  }

  public archiveOrder(orderNo: string): boolean {
    let orderToArchive: OperationalOrder | undefined;

    for (const stage of STAGES) {
      const idx = this.activeOrders[stage].findIndex((o) => o.orderNo === orderNo);
      if (idx !== -1) {
        orderToArchive = this.activeOrders[stage][idx];
        this.activeOrders[stage].splice(idx, 1);
        break;
      }
    }

    if (!orderToArchive) return false;

    this.archivedOrders.unshift({
      ...orderToArchive,
      currentStageName: "Dokumen Telah Diterima",
      currentStep: 8,
    });
    this.notify();
    return true;
  }

  public async archiveOrderAsync(orderNo: string): Promise<boolean> {
    return this.archiveOrder(orderNo);
  }

  public deleteArchivedOrder(orderNo: string): boolean {
    const idx = this.archivedOrders.findIndex((o) => o.orderNo === orderNo);
    if (idx !== -1) {
      this.archivedOrders.splice(idx, 1);
      this.notify();
      return true;
    }
    return false;
  }

  public deleteOrder(orderNo: string): boolean {
    const cleanNo = (orderNo || "").trim().toUpperCase();
    let deleted = false;
    for (const stage of STAGES) {
      const initialLen = this.activeOrders[stage]?.length ?? 0;
      this.activeOrders[stage] = (this.activeOrders[stage] || []).filter(
        (o) => (o.orderNo || "").toUpperCase() !== cleanNo
      );
      if (this.activeOrders[stage].length < initialLen) {
        deleted = true;
      }
    }
    const archIdx = this.archivedOrders.findIndex((o) => (o.orderNo || "").toUpperCase() === cleanNo);
    if (archIdx !== -1) {
      this.archivedOrders.splice(archIdx, 1);
      deleted = true;
    }
    if (deleted) {
      this.notify();
    }
    return deleted;
  }

  public clearArchivedOrders(): boolean {
    this.archivedOrders = [];
    this.notify();
    return true;
  }

  public cancelOrder(orderNo: string, reason?: string): boolean {
    for (const stage of STAGES) {
      const idx = this.activeOrders[stage]?.findIndex((o) => o.orderNo === orderNo) ?? -1;
      if (idx !== -1) {
        const orderToCancel = this.activeOrders[stage][idx];
        this.activeOrders[stage][idx] = {
          ...orderToCancel,
          currentStageName: "Dibatalkan" as any,
          stageBeforeCancel: (orderToCancel as any).stageBeforeCancel || stage,
          catatanOrder: `${orderToCancel.catatanOrder ? orderToCancel.catatanOrder + " | " : ""}Dibatalkan: ${reason || "-"}`,
        };
        (this.activeOrders[stage][idx] as any).isCancelled = true;
        (this.activeOrders[stage][idx] as any).status = "Dibatalkan";
        (this.activeOrders[stage][idx] as any).cancellationReason = reason;
        this.notify();
        return true;
      }
    }
    const archIdx = this.archivedOrders.findIndex((o) => o.orderNo === orderNo);
    if (archIdx !== -1) {
      const orderToCancel = this.archivedOrders[archIdx];
      this.archivedOrders[archIdx] = {
        ...orderToCancel,
        currentStageName: "Dibatalkan" as any,
        catatanOrder: `${orderToCancel.catatanOrder ? orderToCancel.catatanOrder + " | " : ""}Dibatalkan: ${reason || "-"}`,
      };
      (this.archivedOrders[archIdx] as any).isCancelled = true;
      (this.archivedOrders[archIdx] as any).status = "Dibatalkan";
      (this.archivedOrders[archIdx] as any).cancellationReason = reason;
      this.notify();
      return true;
    }
    return false;
  }

  public verifyPayment(orderNo: string, verifierName: string = "Admin", confirmedAmount?: number, notes?: string): boolean {
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

    return this.updateOrder(orderNo, {
      payment: {
        ...targetOrder.payment,
        isPaymentVerified: true,
        paymentVerifiedAt: nowStr,
        paymentVerifiedBy: verifierName,
        nominalPembayaranAwalTerkonfirmasi: paid,
        statusPembayaran,
        dibayar: paid,
        kurang: sisa,
        overpayment,
        tanggalBayar: nowStr.split("T")[0],
        riwayatKoreksiPembayaran: riwayat,
      },
    });
  }
}

export const mockOrderProvider = new MockOrderProvider();
