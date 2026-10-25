/**
 * Future API Finance DTOs and Payload Contracts
 * Admin SUN89 — Biro Jasa Management System
 */

import { InvoiceBillingRecord, PaymentStatus } from "../../domain/finance/types";
import { PaginationQuery } from "./common";

export interface PayInvoiceRequest {
  invoiceId: number;
  amount: number;
  tanggalBayar?: string;
  metodePembayaran?: string;
  bank?: string;
  alasanPending?: string;
  keterangan?: string;
}

export interface CompleteInvoiceRequest {
  invoiceId: number;
  completedBy?: string;
}

export interface InvoiceListQuery extends PaginationQuery {
  status?: PaymentStatus;
  customer?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface KasKantorEntryRequest {
  tanggal: string;
  keterangan: string;
  status: "Pemasukan" | "Pengeluaran";
  debit: number;
  kredit: number;
  invoiceRef?: string;
}

export type InvoiceResponse = InvoiceBillingRecord;
