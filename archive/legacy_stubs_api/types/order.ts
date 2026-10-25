/**
 * Future API Order DTOs and Payload Contracts
 * Admin SUN89 — Biro Jasa Management System
 */

import { OperationalOrder, StageName } from "../../domain/order/types";
import { PaginationQuery } from "./common";

export interface CreateOrderRequest {
  customer: string;
  nomorHP: string;
  layanan: string;
  nopol: string;
  jenisKendaraan: string;
  tahunKendaraan: number | string;
  wilayahSamsatAsal: string;
  wilayahSamsatTujuan?: string;
  tipePembayaran: "Bayar di Awal" | "Bayar di Akhir" | "Tempo";
  metodePembayaran: string;
  catatanOrder?: string;
  biayaJasa?: number;
}

export interface UpdateOrderRequest {
  catatanOrder?: string;
  tanggalJemput?: string;
  messenger?: string;
  tanggalPengantaran?: string;
  messengerPengantar?: string;
  customCostItems?: any[];
  [key: string]: any;
}

export interface AdvanceOrderRequest {
  currentStage: StageName;
  nextStage: StageName;
  notes?: string;
}

export interface OrderListQuery extends PaginationQuery {
  stage?: StageName;
  paymentStatus?: "Lunas" | "Belum Bayar" | "Kurang Bayar" | "Kelebihan Bayar" | "Belum Lunas" | "Kurang";
  search?: string;
}

export type OrderResponse = OperationalOrder;
