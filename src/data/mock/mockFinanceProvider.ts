/**
 * Mock Finance Data Provider
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides in-memory finance fixtures and synchronization.
 */

import {
  InvoiceBillingRecord,
  ProfitItem,
  KasKantorItem,
  KasMessengerItem,
  PengeluaranItem,
} from "../../domain/finance/types";
import { isFullyPaid } from "../../domain/finance/paymentMapping";
import {
  buildInitialInvoices,
  initialProfitData,
  initialKasMessengerData,
  initialKasKantorData,
  initialPengeluaranData,
} from "./financeMockFixtures";

export interface IFinanceDataProvider {
  getInvoices(): InvoiceBillingRecord[];
  getTagihanList(): InvoiceBillingRecord[];
  getCompletedTagihanList(): InvoiceBillingRecord[];
  getInvoiceById(id: number): InvoiceBillingRecord | undefined;
  getInvoiceByOrderNo(orderNo: string): InvoiceBillingRecord | undefined;
  getProfitList(): ProfitItem[];
  getKasKantorList(): KasKantorItem[];
  getKasMessengerList(): KasMessengerItem[];
  getPengeluaranList(): PengeluaranItem[];
  recordPayment(idOrInvoice: number | string, paymentAmount: number, details?: any): boolean | Promise<boolean>;
  resolveInvoice(id: number, details?: any): boolean;
  completeInvoice(id: number, completedBy?: string): boolean;
  payoutCashback?(id: number, payoutData: any): Promise<boolean> | boolean;
  voidInvoicePayment?(id: number, paymentId: number, reason: string): Promise<boolean> | boolean;
  voidCashbackPayout?(id: number, reason: string): Promise<boolean> | boolean;
  getVoidAuditHistory?(): Promise<{ payments: any[]; cashbacks: any[] }>;
  addKasKantor?(item: Omit<KasKantorItem, "id">): KasKantorItem | null;
  addKasMessenger?(item: Omit<KasMessengerItem, "id" | "total"> & { total?: number }): KasMessengerItem | null;
  deleteKasKantor?(id: number): Promise<boolean> | boolean;
  deleteKasMessenger?(id: number): Promise<boolean> | boolean;
  addPengeluaran?(item: Omit<PengeluaranItem, "id">): PengeluaranItem | null;
  deletePengeluaran?(id: number): Promise<boolean> | boolean;
  saveInvoice?(invoice: InvoiceBillingRecord): void;
  subscribe(listener: () => void): () => void;
  isLoading?(): boolean;
  getError?(): Error | null;
}

export class MockFinanceProvider implements IFinanceDataProvider {
  private invoices: InvoiceBillingRecord[] = buildInitialInvoices();
  private kasKantor: KasKantorItem[] = [...initialKasKantorData];
  private kasMessenger: KasMessengerItem[] = [...initialKasMessengerData];
  private pengeluaran: PengeluaranItem[] = [...initialPengeluaranData];
  private profitData: ProfitItem[] = [...initialProfitData];
  private listeners: Set<() => void> = new Set();
  private kasCounter = 100;

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error("MockFinanceProvider listener error:", err);
      }
    });
  }

  public getInvoices(): InvoiceBillingRecord[] {
    return this.invoices;
  }

  public getTagihanList(): InvoiceBillingRecord[] {
    return this.invoices.filter((inv) => !isFullyPaid(inv.status) && inv.billingStatus !== "COMPLETED");
  }

  public getCompletedTagihanList(): InvoiceBillingRecord[] {
    return this.invoices.filter((inv) => isFullyPaid(inv.status) || inv.billingStatus === "COMPLETED");
  }

  public getInvoiceById(id: number): InvoiceBillingRecord | undefined {
    return this.invoices.find((inv) => inv.id === id);
  }

  public getInvoiceByOrderNo(orderNo: string): InvoiceBillingRecord | undefined {
    return this.invoices.find((inv) => inv.orderNo === orderNo);
  }

  public getProfitList(): ProfitItem[] {
    return this.profitData;
  }

  public getKasKantorList(): KasKantorItem[] {
    return this.kasKantor;
  }

  public getKasMessengerList(): KasMessengerItem[] {
    return this.kasMessenger;
  }

  public getPengeluaranList(): PengeluaranItem[] {
    return this.pengeluaran;
  }

  public recordPayment(idOrInvoice: number | string, paymentAmount: number, details?: any): boolean {
    if (paymentAmount <= 0) return false;
    const record = this.invoices.find(
      (inv) => inv.id === idOrInvoice || inv.invoice === String(idOrInvoice) || inv.invoiceNo === String(idOrInvoice)
    );
    if (!record) return false;

    const currentPaid = record.dibayar ?? (record as any).terbayar ?? 0;
    const newPaid = Math.min(record.totalTagihan, currentPaid + paymentAmount);
    const newSisa = Math.max(0, record.totalTagihan - newPaid);
    const newStatus = newSisa === 0 ? "Lunas" : "Kurang Bayar";

    const cashDelta = newPaid - (record.cashRecordedAmount || 0);
    if (cashDelta > 0) {
      const lastTotal = this.kasKantor.length > 0 ? this.kasKantor[this.kasKantor.length - 1].total : 0;
      this.kasKantor.push({
        id: this.kasCounter++,
        tanggal: details?.tanggal || new Date().toLocaleDateString("id-ID"),
        status: "Debit",
        keterangan: `Pelunasan: ${record.invoice || record.invoiceNo} - ${record.customer}`,
        debit: cashDelta,
        kredit: 0,
        total: lastTotal + cashDelta,
        invoiceRef: record.invoice || record.invoiceNo,
      });
      record.cashRecordedAmount = newPaid;
      record.isCashRealized = true;
    }

    record.dibayar = newPaid;
    (record as any).terbayar = newPaid;
    record.sisa = newSisa;
    record.status = newStatus;

    if (newSisa === 0) {
      record.billingStatus = "COMPLETED";
      record.profitStatus = "REALIZED";
    }

    this.notify();
    return true;
  }

  public resolveInvoice(id: number, details?: any): boolean {
    const record = this.getInvoiceById(id);
    if (!record) return false;
    record.status = "Lunas";
    record.sisa = 0;
    record.dibayar = record.totalTagihan;
    (record as any).terbayar = record.totalTagihan;
    record.billingStatus = "COMPLETED";
    this.notify();
    return true;
  }

  public completeInvoice(id: number, completedBy?: string): boolean {
    const record = this.getInvoiceById(id);
    if (!record) return false;
    record.billingStatus = "COMPLETED";
    if (completedBy) record.completedBy = completedBy;
    this.notify();
    return true;
  }

  public addKasKantor(item: Omit<KasKantorItem, "id">): KasKantorItem | null {
    const lastTotal = this.kasKantor.length > 0 ? this.kasKantor[this.kasKantor.length - 1].total : 0;
    const newEntry: KasKantorItem = {
      id: this.kasCounter++,
      tanggal: item.tanggal,
      status: item.status,
      keterangan: item.keterangan,
      debit: item.debit || 0,
      kredit: item.kredit || 0,
      total: (item.status === "Debit" || item.status === "Pemasukan")
        ? lastTotal + (item.debit || 0)
        : lastTotal - (item.kredit || 0),
    };
    this.kasKantor.push(newEntry);
    this.notify();
    return newEntry;
  }

  public deleteKasKantor(id: number): boolean {
    const idx = this.kasKantor.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    this.kasKantor.splice(idx, 1);
    this.notify();
    return true;
  }

  public addKasMessenger(item: Omit<KasMessengerItem, "id" | "total"> & { total?: number }): KasMessengerItem {
    const lastTotal = this.kasMessenger.length > 0 ? this.kasMessenger[this.kasMessenger.length - 1].total : 0;
    const runningTotal = item.total !== undefined ? item.total : lastTotal + item.in - item.out;
    const newItem: KasMessengerItem = {
      id: this.kasCounter++,
      tanggal: item.tanggal,
      jenis: item.jenis,
      messenger: item.messenger,
      keterangan: item.keterangan,
      in: item.in,
      out: item.out,
      total: runningTotal,
    };
    this.kasMessenger.push(newItem);
    this.notify();
    return newItem;
  }

  public deleteKasMessenger(id: number): boolean {
    const idx = this.kasMessenger.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    this.kasMessenger.splice(idx, 1);
    this.notify();
    return true;
  }

  public addPengeluaran(item: Omit<PengeluaranItem, "id">): PengeluaranItem {
    const nextId = Math.max(0, ...this.pengeluaran.map((p) => p.id)) + 1;
    const newEntry: PengeluaranItem = {
      id: nextId,
      tanggal: item.tanggal,
      keterangan: item.keterangan,
      nominal: item.nominal,
      penanggungJawab: item.penanggungJawab,
    };
    this.pengeluaran.unshift(newEntry);
    this.notify();
    return newEntry;
  }

  public deletePengeluaran(id: number): boolean {
    const idx = this.pengeluaran.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.pengeluaran.splice(idx, 1);
    this.notify();
    return true;
  }

  public saveInvoice(invoice: InvoiceBillingRecord): void {
    const idx = this.invoices.findIndex(
      (inv) => inv.id === invoice.id || inv.invoice === invoice.invoiceNo || inv.invoiceNo === invoice.invoiceNo
    );
    if (idx !== -1) {
      this.invoices[idx] = { ...this.invoices[idx], ...invoice };
    } else {
      this.invoices.unshift(invoice);
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public isLoading(): boolean {
    return false;
  }

  public getError(): Error | null {
    return null;
  }
}

export const mockFinanceProvider = new MockFinanceProvider();
