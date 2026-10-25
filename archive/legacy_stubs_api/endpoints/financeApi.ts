/**
 * Finance API Contract Signatures
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: Future contract interface only. Not called at runtime during Phase 1.
 */

import { ApiResponse, PaginatedResponse } from "../types/common";
import {
  PayInvoiceRequest,
  CompleteInvoiceRequest,
  InvoiceResponse,
  InvoiceListQuery,
  KasKantorEntryRequest,
} from "../types/finance";
import { ProfitItem, KasKantorItem, KasMessengerItem, PengeluaranItem } from "../../domain/finance/types";

export interface FinanceApiContract {
  getInvoices(query?: InvoiceListQuery): Promise<ApiResponse<PaginatedResponse<InvoiceResponse>>>;
  getInvoice(invoiceId: number): Promise<ApiResponse<InvoiceResponse>>;
  payInvoice(payload: PayInvoiceRequest): Promise<ApiResponse<InvoiceResponse>>;
  completeInvoice(payload: CompleteInvoiceRequest): Promise<ApiResponse<InvoiceResponse>>;
  getProfitList(): Promise<ApiResponse<ProfitItem[]>>;
  getKasKantorList(): Promise<ApiResponse<KasKantorItem[]>>;
  addKasKantorEntry(payload: KasKantorEntryRequest): Promise<ApiResponse<KasKantorItem>>;
  getKasMessengerList(): Promise<ApiResponse<KasMessengerItem[]>>;
  getPengeluaranList(): Promise<ApiResponse<PengeluaranItem[]>>;
}
