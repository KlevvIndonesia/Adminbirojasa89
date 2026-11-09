/**
 * Finance Repository Interface and Implementation
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides the data access layer between state management / stores
 * and underlying data providers (Mock provider vs API provider).
 */

import {
  InvoiceBillingRecord,
  ProfitItem,
  KasKantorItem,
  KasMessengerItem,
  PengeluaranItem,
} from "../../domain/finance/types";
import { mockFinanceProvider, IFinanceDataProvider } from "../mock/mockFinanceProvider";
import { ApiFinanceProvider } from "../api/apiFinanceProvider";

export interface IFinanceRepository {
  getInvoices(): InvoiceBillingRecord[];
  getTagihanList(): InvoiceBillingRecord[];
  getCompletedTagihanList(): InvoiceBillingRecord[];
  getInvoiceById(id: number): InvoiceBillingRecord | undefined;
  getInvoiceByOrderNo(orderNo: string): InvoiceBillingRecord | undefined;
  getProfitList(): ProfitItem[];
  getKasKantorList(): KasKantorItem[];
  getKasMessengerList(): KasMessengerItem[];
  getPengeluaranList(): PengeluaranItem[];
  subscribe(listener: () => void): () => void;
  recordPayment(idOrInvoice: number | string, paymentAmount: number, details?: any): boolean | Promise<boolean>;
  resolveInvoice(id: number, details?: any): boolean;
  completeInvoice(id: number, completedBy?: string): boolean;
  payoutCashback?(id: number, payoutData: any): Promise<boolean> | boolean;
  voidInvoicePayment?(id: number, paymentId: number, reason: string): Promise<boolean> | boolean;
  voidCashbackPayout?(id: number, reason: string): Promise<boolean> | boolean;
  getVoidAuditHistory?(): Promise<{ payments: any[]; cashbacks: any[] }>;
  addKasKantor?(item: Omit<KasKantorItem, "id">): KasKantorItem | null;
  deleteKasKantor?(id: number): Promise<boolean> | boolean;
  addKasMessenger?(item: Omit<KasMessengerItem, "id" | "total"> & { total?: number }): KasMessengerItem | null;
  deleteKasMessenger?(id: number): Promise<boolean> | boolean;
  addPengeluaran?(item: Omit<PengeluaranItem, "id">): PengeluaranItem | null;
  deletePengeluaran?(id: number): Promise<boolean> | boolean;
  saveInvoice?(invoice: InvoiceBillingRecord): void;
  setProvider?(provider: IFinanceDataProvider): void;
  getProvider?(): IFinanceDataProvider;
  isLoading?(): boolean;
  getError?(): Error | null;
  initFromApi?(): Promise<void>;
}

export class FinanceRepository implements IFinanceRepository {
  private provider: IFinanceDataProvider;

  constructor(provider?: IFinanceDataProvider) {
    if (provider) {
      this.provider = provider;
    } else {
      const isApi = (typeof process !== "undefined" && process.env?.APP_DATA_PROVIDER === "api") ||
                    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_APP_DATA_PROVIDER === "api");
      this.provider = isApi ? new ApiFinanceProvider() : mockFinanceProvider;
    }
  }

  public setProvider(provider: IFinanceDataProvider): void {
    this.provider = provider;
  }

  public getProvider(): IFinanceDataProvider {
    return this.provider;
  }

  public getInvoices(): InvoiceBillingRecord[] {
    return this.provider.getInvoices();
  }

  public getTagihanList(): InvoiceBillingRecord[] {
    return this.provider.getTagihanList();
  }

  public getCompletedTagihanList(): InvoiceBillingRecord[] {
    return this.provider.getCompletedTagihanList();
  }

  public getInvoiceById(id: number): InvoiceBillingRecord | undefined {
    return this.provider.getInvoiceById(id);
  }

  public getInvoiceByOrderNo(orderNo: string): InvoiceBillingRecord | undefined {
    return this.provider.getInvoiceByOrderNo(orderNo);
  }

  public getProfitList(): ProfitItem[] {
    return this.provider.getProfitList();
  }

  public getKasKantorList(): KasKantorItem[] {
    return this.provider.getKasKantorList();
  }

  public getKasMessengerList(): KasMessengerItem[] {
    return this.provider.getKasMessengerList();
  }

  public getPengeluaranList(): PengeluaranItem[] {
    return this.provider.getPengeluaranList();
  }

  public subscribe(listener: () => void): () => void {
    return this.provider.subscribe(listener);
  }

  public recordPayment(idOrInvoice: number | string, paymentAmount: number, details?: any): boolean | Promise<boolean> {
    return this.provider.recordPayment(idOrInvoice, paymentAmount, details);
  }

  public resolveInvoice(id: number, details?: any): boolean {
    return this.provider.resolveInvoice(id, details);
  }

  public completeInvoice(id: number, completedBy?: string): boolean {
    return this.provider.completeInvoice(id, completedBy);
  }

  public async payoutCashback(id: number, payoutData: any): Promise<boolean> {
    if (this.provider.payoutCashback) {
      return await this.provider.payoutCashback(id, payoutData);
    }
    return false;
  }

  public async voidInvoicePayment(id: number, paymentId: number, reason: string): Promise<boolean> {
    if (this.provider.voidInvoicePayment) {
      return await this.provider.voidInvoicePayment(id, paymentId, reason);
    }
    return false;
  }

  public async voidCashbackPayout(id: number, reason: string): Promise<boolean> {
    if (this.provider.voidCashbackPayout) {
      return await this.provider.voidCashbackPayout(id, reason);
    }
    return false;
  }

  public async getVoidAuditHistory(): Promise<{ payments: any[]; cashbacks: any[] }> {
    if (this.provider.getVoidAuditHistory) {
      return await this.provider.getVoidAuditHistory();
    }
    return { payments: [], cashbacks: [] };
  }

  public addKasKantor(item: Omit<KasKantorItem, "id">): KasKantorItem | null {
    return this.provider.addKasKantor ? this.provider.addKasKantor(item) : null;
  }

  public async deleteKasKantor(id: number): Promise<boolean> {
    if (this.provider.deleteKasKantor) {
      return await this.provider.deleteKasKantor(id);
    }
    return false;
  }

  public addKasMessenger(item: Omit<KasMessengerItem, "id" | "total"> & { total?: number }): KasMessengerItem | null {
    return this.provider.addKasMessenger ? this.provider.addKasMessenger(item) : null;
  }

  public async deleteKasMessenger(id: number): Promise<boolean> {
    if (this.provider.deleteKasMessenger) {
      return await this.provider.deleteKasMessenger(id);
    }
    return false;
  }

  public addPengeluaran(item: Omit<PengeluaranItem, "id">): PengeluaranItem | null {
    return this.provider.addPengeluaran ? this.provider.addPengeluaran(item) : null;
  }

  public async deletePengeluaran(id: number): Promise<boolean> {
    if (this.provider.deletePengeluaran) {
      return await this.provider.deletePengeluaran(id);
    }
    return false;
  }

  public saveInvoice(invoice: InvoiceBillingRecord): void {
    if (this.provider.saveInvoice) {
      this.provider.saveInvoice(invoice);
    }
  }

  public isLoading(): boolean {
    return this.provider.isLoading ? this.provider.isLoading() : false;
  }

  public getError(): Error | null {
    return this.provider.getError ? this.provider.getError() : null;
  }

  public async initFromApi(): Promise<void> {
    if (this.provider && typeof (this.provider as any).initFromApi === "function") {
      await (this.provider as any).initFromApi();
    }
  }
}

// Backward compatibility alias
export const InMemoryFinanceRepository = FinanceRepository;
export const financeRepository = new FinanceRepository();
