/**
 * Order Repository Interface and Implementation
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides the data access layer between state management / stores
 * and underlying data providers (Mock provider currently, API provider in Phase 7).
 */

import { OperationalOrder, StageName, IOrderDataProvider } from "../../domain/order/types";
import { ApiOrderProvider } from "../api/apiOrderProvider";

export interface IOrderRepository {
  getActiveOrders(): Record<StageName, OperationalOrder[]>;
  getAllFlat(archived?: boolean): OperationalOrder[];
  getByOrderNo(orderNo: string): OperationalOrder | undefined;
  getByStage(stage: StageName): OperationalOrder[];
  getArchivedOrders(): OperationalOrder[];
  subscribe(listener: () => void): () => void;
  saveOrder(order: OperationalOrder): void;
  saveOrderAsync?(order: OperationalOrder): Promise<OperationalOrder>;
  updateOrder(orderNo: string, updates: Partial<OperationalOrder>): boolean;
  updateOrderAsync?(orderNo: string, updates: Partial<OperationalOrder>): Promise<boolean>;
  advanceOrder(orderNo: string, targetStage: StageName, updates?: Partial<OperationalOrder>): boolean;
  advanceOrderAsync?(orderNo: string, targetStage: StageName, updates?: Partial<OperationalOrder>): Promise<OperationalOrder | false>;
  rollbackOrder(orderNo: string, targetStage: StageName, updates?: Partial<OperationalOrder>): boolean;
  rollbackOrderAsync?(orderNo: string, targetStage: StageName, updates?: Partial<OperationalOrder>): Promise<OperationalOrder | false>;
  archiveOrder(orderNo: string): boolean;
  archiveOrderAsync?(orderNo: string): Promise<boolean>;
  deleteArchivedOrder(orderNo: string): boolean;
  deleteOrder?(orderNo: string): boolean | Promise<boolean>;
  clearArchivedOrders(): boolean;
  cancelOrder?(orderNo: string, reason?: string): boolean | Promise<boolean>;
  verifyPayment(orderNo: string, verifierName?: string, confirmedAmount?: number, notes?: string, proofPayload?: any): boolean;
  verifyPaymentAsync?(orderNo: string, verifierName?: string, confirmedAmount?: number, notes?: string, proofPayload?: any): Promise<OperationalOrder>;
  setProvider?(provider: IOrderDataProvider): void;
  getProvider?(): IOrderDataProvider;
  getIsLoading?(): boolean;
  getError?(): string | null;
  getIsInitialized?(): boolean;
  refresh?(silent?: boolean): Promise<void>;
}

export class OrderRepository implements IOrderRepository {
  private provider: IOrderDataProvider;
  private listeners: Set<() => void> = new Set();
  private unsubscribeProvider?: () => void;

  constructor(provider?: IOrderDataProvider) {
    this.provider = provider || new ApiOrderProvider();
    this.wireProvider();
  }

  private wireProvider(): void {
    if (this.unsubscribeProvider) {
      this.unsubscribeProvider();
      this.unsubscribeProvider = undefined;
    }
    if (this.provider && typeof this.provider.subscribe === "function") {
      this.unsubscribeProvider = this.provider.subscribe(() => {
        this.notifyListeners();
      });
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("OrderRepository listener error:", err);
      }
    });
  }

  public setProvider(provider: IOrderDataProvider): void {
    this.provider = provider;
    this.wireProvider();
    this.notifyListeners();
  }

  public getProvider(): IOrderDataProvider {
    return this.provider;
  }

  public getActiveOrders(): Record<StageName, OperationalOrder[]> {
    return this.provider.getActiveOrders();
  }

  public getAllFlat(): OperationalOrder[] {
    return this.provider.getAllFlat();
  }

  public getByOrderNo(orderNo: string): OperationalOrder | undefined {
    return this.provider.getOrderByNo(orderNo);
  }

  public getOrdersByStage(stage: StageName): OperationalOrder[] {
    return this.provider.getOrdersByStage(stage);
  }

  public getByStage(stage: StageName): OperationalOrder[] {
    return this.provider.getOrdersByStage(stage);
  }

  public getArchivedOrders(): OperationalOrder[] {
    return this.provider.getArchivedOrders();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public saveOrder(order: OperationalOrder): void {
    this.provider.addOrder(order);
  }

  public async saveOrderAsync(order: OperationalOrder): Promise<OperationalOrder> {
    if (typeof (this.provider as any).addOrderAsync === "function") {
      return await (this.provider as any).addOrderAsync(order);
    }
    this.provider.addOrder(order);
    return order;
  }

  public updateOrder(orderNo: string, updates: Partial<OperationalOrder>): boolean {
    return this.provider.updateOrder(orderNo, updates);
  }

  public async updateOrderAsync(orderNo: string, updates: Partial<OperationalOrder>): Promise<boolean> {
    if (typeof (this.provider as any).updateOrderAsync === "function") {
      return (this.provider as any).updateOrderAsync(orderNo, updates);
    }
    return this.provider.updateOrder(orderNo, updates);
  }

  public advanceOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): boolean {
    return this.provider.advanceOrder(orderNo, targetStage, updates);
  }

  public async advanceOrderAsync(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): Promise<OperationalOrder | false> {
    if (typeof (this.provider as any).advanceOrderAsync === "function") {
      return (this.provider as any).advanceOrderAsync(orderNo, targetStage, updates);
    }
    const ok = this.provider.advanceOrder(orderNo, targetStage, updates);
    return ok ? (this.getByOrderNo(orderNo) || false) : false;
  }

  public rollbackOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): boolean {
    return this.provider.rollbackOrder(orderNo, targetStage, updates);
  }

  public async rollbackOrderAsync(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}): Promise<OperationalOrder | false> {
    if (typeof (this.provider as any).rollbackOrderAsync === "function") {
      return (this.provider as any).rollbackOrderAsync(orderNo, targetStage, updates);
    }
    const ok = this.provider.rollbackOrder(orderNo, targetStage, updates);
    return ok ? (this.getByOrderNo(orderNo) || false) : false;
  }

  public archiveOrder(orderNo: string): boolean {
    return this.provider.archiveOrder(orderNo);
  }

  public async archiveOrderAsync(orderNo: string): Promise<boolean> {
    if (typeof (this.provider as any).archiveOrderAsync === "function") {
      return (this.provider as any).archiveOrderAsync(orderNo);
    }
    return this.provider.archiveOrder(orderNo);
  }

  public deleteArchivedOrder(orderNo: string): boolean {
    if (typeof (this.provider as any).deleteArchivedOrder === "function") {
      return (this.provider as any).deleteArchivedOrder(orderNo);
    }
    return false;
  }

  public deleteOrder(orderNo: string): boolean | Promise<boolean> {
    if (typeof (this.provider as any).deleteOrder === "function") {
      return (this.provider as any).deleteOrder(orderNo);
    }
    return false;
  }

  public clearArchivedOrders(): boolean {
    if (typeof (this.provider as any).clearArchivedOrders === "function") {
      return (this.provider as any).clearArchivedOrders();
    }
    return false;
  }

  public cancelOrder(orderNo: string, reason?: string): boolean | Promise<boolean> {
    if (typeof (this.provider as any).cancelOrder === "function") {
      return (this.provider as any).cancelOrder(orderNo, reason);
    }
    return false;
  }

  public verifyPayment(orderNo: string, verifierName: string = "Admin", confirmedAmount?: number, notes?: string, proofPayload?: any): boolean {
    if (typeof this.provider.verifyPayment === "function") {
      return (this.provider as any).verifyPayment(orderNo, verifierName, confirmedAmount, notes, proofPayload);
    }
    const target = this.getByOrderNo(orderNo);
    if (!target) return false;
    const nowStr = new Date().toISOString();
    const totalBiaya = target.payment?.totalBiaya || target.totalEstimasi || 0;
    const paid = confirmedAmount !== undefined
      ? Math.max(0, confirmedAmount)
      : (target.payment?.nominalDibayarAwal !== undefined
          ? target.payment.nominalDibayarAwal
          : (target.payment?.dibayar && target.payment.dibayar > 0 ? target.payment.dibayar : totalBiaya));
    const sisa = Math.max(0, totalBiaya - paid);
    const overpayment = Math.max(0, paid - totalBiaya);
    const statusPembayaran = paid >= totalBiaya ? "Lunas" : paid > 0 ? "Kurang Bayar" : "Belum Bayar";

    const prev = target.payment?.nominalPembayaranAwalTerkonfirmasi ?? target.payment?.nominalDibayarAwal ?? target.payment?.dibayar ?? 0;
    const riwayat = [...(target.payment?.riwayatKoreksiPembayaran || [])];
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
        ...target.payment,
        isPaymentVerified: true,
        paymentVerifiedAt: nowStr,
        paymentVerifiedBy: verifierName,
        nominalPembayaranAwalTerkonfirmasi: paid,
        statusPembayaran,
        dibayar: paid,
        kurang: sisa,
        overpayment,
        tanggalBayar: target.payment?.tanggalBayar || nowStr.split("T")[0],
        riwayatKoreksiPembayaran: riwayat,
      },
    });
  }

  public async verifyPaymentAsync(
    orderNo: string,
    verifierName: string = "Admin",
    confirmedAmount?: number,
    notes?: string,
    proofPayload?: any
  ): Promise<OperationalOrder> {
    if (typeof (this.provider as any).verifyPaymentAsync === "function") {
      return await (this.provider as any).verifyPaymentAsync(orderNo, verifierName, confirmedAmount, notes, proofPayload);
    }
    const ok = this.verifyPayment(orderNo, verifierName, confirmedAmount, notes, proofPayload);
    if (!ok) {
      const err: any = new Error(`Order '${orderNo}' tidak ditemukan.`);
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    return this.getByOrderNo(orderNo)!;
  }

  public async initFromApi(): Promise<void> {
    if (typeof (this.provider as any).initFromApi === "function") {
      await (this.provider as any).initFromApi();
    }
  }

  public getIsLoading(): boolean {
    return typeof (this.provider as any).getIsLoading === "function"
      ? (this.provider as any).getIsLoading()
      : false;
  }

  public getError(): string | null {
    return typeof (this.provider as any).getError === "function"
      ? (this.provider as any).getError()
      : null;
  }

  public getIsInitialized(): boolean {
    return typeof (this.provider as any).getIsInitialized === "function"
      ? (this.provider as any).getIsInitialized()
      : true;
  }

  public async refresh(silent = false): Promise<void> {
    if (typeof (this.provider as any).refresh === "function") {
      await (this.provider as any).refresh(silent);
    } else if (typeof (this.provider as any).initFromApi === "function") {
      await (this.provider as any).initFromApi();
    }
  }
}

export const orderRepository = new OrderRepository();
