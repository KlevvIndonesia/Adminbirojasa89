import { serviceStore } from "./serviceStore";
/**
 * Single Source of Truth for Operational Orders & Order History
 * Admin SUN89 — Biro Jasa Management System
 */

import { useState, useEffect } from "react";
import { financeStore, PaymentSyncPayload } from "./financeStore";
import { pricingStore } from "./pricingStore";
import { auditLog } from "../utils/auditLog";

import {
  StructuredAddress,
  OrderDocument,
  SamsatProcessItem,
  PaymentProof,
  OrderPayment,
  CustomCostItem,
  OperationalOrder,
  StageName,
  STAGES,
  getDefaultSamsatProcesses,
  SettlementCondition,
  RefundStatus,
  RekapDocument,
} from "../../domain/order/types";
import { createInitialOrders } from "../../data/mock/orderMockData";
import { orderRepository, IOrderRepository } from "../../data/repositories/orderRepository";
import { APP_CONFIG } from "../config/appConfig";

export type {
  StructuredAddress,
  OrderDocument,
  SamsatProcessItem,
  PaymentProof,
  OrderPayment,
  CustomCostItem,
  OperationalOrder,
  StageName,
  SettlementCondition,
  RefundStatus,
  RekapDocument,
};
export { STAGES, getDefaultSamsatProcesses, createInitialOrders };

export function extractPeriodMMYY(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    return `${mm}${yy}`;
  }
  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const yy = isoMatch[1].slice(-2);
    const mm = isoMatch[2].padStart(2, "0");
    return `${mm}${yy}`;
  }
  const slashMatch = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const mm = slashMatch[2].padStart(2, "0");
    const yy = slashMatch[3].slice(-2);
    return `${mm}${yy}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}${yy}`;
  }
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getFullYear()).slice(-2)}`;
}

export function generateNextOrderAndInvoiceNo(
  dateStr?: string,
  existingOrders: OperationalOrder[] = []
): { orderNo: string; invoiceNo: string } {
  const mmyy = extractPeriodMMYY(dateStr);
  const prefix = `ORD-${mmyy}-`;
  let maxSeq = 0;
  for (const ord of existingOrders) {
    if (ord && ord.orderNo && ord.orderNo.startsWith(prefix)) {
      const parts = ord.orderNo.split("-");
      if (parts.length >= 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }
  const nextSeq = maxSeq + 1;
  const seqStr = String(nextSeq).padStart(3, "0");
  return {
    orderNo: `ORD-${mmyy}-${seqStr}`,
    invoiceNo: `INV-${mmyy}-${seqStr}`,
  };
}


// Global application state boundary for Orders
class OrderStore {
  private repository: IOrderRepository = orderRepository;
  private listeners: Set<() => void> = new Set();
  private orderCounter = 100;

  constructor() {
    // Listen to repository data provider updates
    this.repository.subscribe(() => {
      this.notify();
    });

    // Bi-directional synchronization: Listen to payment updates originating in FinanceStore
    const registerFinanceSync = () => {
      try {
        if (typeof financeStore !== "undefined" && financeStore && typeof financeStore.onPaymentSync === "function") {
          financeStore.onPaymentSync((payload) => {
            this.syncPaymentFromFinance(payload);
          });
          return true;
        }
      } catch {
        // Defer if not yet initialized
      }
      return false;
    };

    if (!registerFinanceSync()) {
      queueMicrotask(() => {
        registerFinanceSync();
      });
    }

    // Phase 9.2: Register canonical order creator with FinanceStore
    const registerFinanceCreator = () => {
      try {
        if (typeof financeStore !== "undefined" && financeStore && typeof financeStore.setOrderCreator === "function") {
          financeStore.setOrderCreator((data) => this.addOrderFromContract(data));
          return true;
        }
      } catch {
        // Defer if not yet initialized
      }
      return false;
    };

    if (!registerFinanceCreator()) {
      queueMicrotask(() => {
        registerFinanceCreator();
      });
    }
  }

  // Subscribe to changes
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public getActiveOrders(): Record<StageName, OperationalOrder[]> {
    return this.repository.getActiveOrders();
  }

  public getOrdersByStage(stage: StageName): OperationalOrder[] {
    return this.repository.getByStage(stage);
  }

  public getArchivedOrders(): OperationalOrder[] {
    return this.repository.getArchivedOrders();
  }

  public getAllOrders(): OperationalOrder[] {
    return this.repository.getAllFlat();
  }

  public getOrderByNo(orderNo: string): OperationalOrder | undefined {
    return this.repository.getByOrderNo(orderNo);
  }

  // Phase 9.2: Conditional canonical order creation from Data Penjualan contract data
  public addOrderFromContract(data: {
    customer: string;
    nopol: string;
    layanan: string;
    namaPemilik?: string;
    nomorHP?: string;
    wilayahSamsatAsal?: string;
    jenisKendaraan?: string;
    biayaJasa?: number;
    totalEstimasi?: number;
    uangMasuk?: number;
    uangKeluar?: number;
    r4r2?: string;
    bpkb?: string;
    [key: string]: any;
  }): OperationalOrder | false {
    if (!data.customer?.trim() || !data.nopol?.trim() || !data.layanan?.trim()) {
      return false;
    }

    const totalEst = data.totalEstimasi || data.uangMasuk || 0;
    const initialPaid = data.uangMasuk || 0;
    const explicitInvoice = data.noInvoice !== undefined ? data.noInvoice : (data.invoiceNo || data["No Invoice"]);
    const explicitOrderNo = data.orderNo || data["Nomor Order"];

    return this.addOrder({
      orderNo: explicitOrderNo || undefined,
      customer: data.customer.trim(),
      nopol: data.nopol.trim(),
      layanan: data.layanan.trim(),
      namaPemilik: data.namaPemilik?.trim() || "-",
      nomorHP: data.nomorHP?.trim() || "081200000000",
      wilayahSamsatAsal: data.wilayahSamsatAsal || "Jakarta Timur",
      wilayahSamsatTujuan: data.wilayahSamsatTujuan || "-",
      jenisKendaraan: data.jenisKendaraan || (data.r4r2 === "R2" ? "Motor" : "Mobil"),
      biayaJasa: data.biayaJasa || 0,
      biayaAntarJemput: data.biayaAntarJemput || 0,
      biayaLainnya: data.biayaLainnya || data["Biaya Lainnya"] || 0,
      namaPenerimaKeluar: data.namaPenerimaKeluar || data.namaPemilikRekeningKeluar || "",
      bankUangKeluar: data.bankUangKeluar || "",
      metodePembayaranKeluar: data.metodePembayaranKeluar || "",
      tanggalMasukBerkas: data.tanggalMasukBerkas || data["Tanggal Masuk Berkas"],
      tanggalUangMasuk: data.tanggalUangMasuk || data["Tanggal Uang Masuk"],
      tanggalPengeluaranSamsat: data.tanggalPengeluaranSamsat || data.tanggalUangKeluar || data["Tanggal Uang Keluar"] || "",
      totalEstimasi: totalEst,
      currentStep: data.currentStep || 1,
      currentStageName: data.currentStageName || "Verifikasi",
      isArchived: data.isArchived || false,
      catatanOrder: data.catatanOrder || data.catatan || data.keterangan || data["Keterangan"] || "Order dibuat dari Data Penjualan (+ Tambah Data)",
      statusPengerjaan: data.statusPengerjaan,
      salesSnapshotStatus: data.salesSnapshotStatus || data.statusPengerjaan,
      noInvoice: explicitInvoice,
      tandaTerima: data.tandaTerima,
      ttbBPKB: data.ttbBPKB,
      statusBPKB: data.statusBPKB,
      bpkb: data.bpkb,
      statusKepemilikan: data.statusKepemilikan || "Pribadi",
      clientDocuments: data.clientDocuments || {
        stnk: { name: "", status: "Belum Tersedia", isOptional: false },
        bpkb: { name: "", status: data.bpkb === "Ada" ? "Sudah Tersedia" : "Belum Tersedia", isOptional: false },
        ktp: { name: "", status: "Belum Tersedia", isOptional: false },
        skkp: { name: "", status: "Belum Tersedia", isOptional: true },
        lainnya: { name: "", status: "Belum Tersedia", isOptional: true },
      },
      payment: {
        tipePembayaran: initialPaid >= totalEst && totalEst > 0 ? "Bayar di Awal" : "Bayar di Akhir",
        metodePembayaran: "Transfer",
        statusPembayaran: data.statusPembayaran || (initialPaid >= totalEst && totalEst > 0 ? "Lunas" : initialPaid > 0 ? "Kurang" : "Belum Bayar"),
        totalBiaya: totalEst,
        totalEstimasi: totalEst,
        dibayar: initialPaid,
        kurang: Math.max(0, totalEst - initialPaid),
        overpayment: 0,
        settlementCondition: "PENDING_FINALIZATION",
        refundStatus: "NONE",
        isPaymentVerified: initialPaid >= totalEst && totalEst > 0,
        invoiceNo: explicitInvoice,
      },
      rekapDocuments: data.rekapDocuments || [],
    });
  }

  // Phase 9.4: Asynchronous order creation from Data Penjualan contract data
  public async addOrderFromContractAsync(data: {
    customer: string;
    nopol: string;
    layanan: string;
    namaPemilik?: string;
    nomorHP?: string;
    wilayahSamsatAsal?: string;
    jenisKendaraan?: string;
    biayaJasa?: number;
    totalEstimasi?: number;
    uangMasuk?: number;
    uangKeluar?: number;
    r4r2?: string;
    bpkb?: string;
    [key: string]: any;
  }): Promise<OperationalOrder | false> {
    if (!data.customer?.trim() || !data.nopol?.trim() || !data.layanan?.trim()) {
      return false;
    }

    const totalEst = data.totalEstimasi || data.uangMasuk || 0;
    const initialPaid = data.uangMasuk || 0;
    const explicitInvoice = data.noInvoice !== undefined ? data.noInvoice : (data.invoiceNo || data["No Invoice"]);
    const explicitOrderNo = data.orderNo || data["Nomor Order"];

    return await this.addOrderAsync({
      orderNo: explicitOrderNo || undefined,
      customer: data.customer.trim(),
      nopol: data.nopol.trim(),
      layanan: data.layanan.trim(),
      namaPemilik: data.namaPemilik?.trim() || "-",
      nomorHP: data.nomorHP?.trim() || "081200000000",
      wilayahSamsatAsal: data.wilayahSamsatAsal || "Jakarta Timur",
      wilayahSamsatTujuan: data.wilayahSamsatTujuan || "-",
      jenisKendaraan: data.jenisKendaraan || (data.r4r2 === "R2" ? "Motor" : "Mobil"),
      biayaJasa: data.biayaJasa || 0,
      biayaAntarJemput: data.biayaAntarJemput || 0,
      biayaLainnya: data.biayaLainnya || data["Biaya Lainnya"] || 0,
      namaPenerimaKeluar: data.namaPenerimaKeluar || data.namaPemilikRekeningKeluar || "",
      bankUangKeluar: data.bankUangKeluar || "",
      metodePembayaranKeluar: data.metodePembayaranKeluar || "",
      tanggalMasukBerkas: data.tanggalMasukBerkas || data["Tanggal Masuk Berkas"],
      tanggalUangMasuk: data.tanggalUangMasuk || data["Tanggal Uang Masuk"],
      tanggalPengeluaranSamsat: data.tanggalPengeluaranSamsat || data.tanggalUangKeluar || data["Tanggal Uang Keluar"] || "",
      totalEstimasi: totalEst,
      currentStep: data.currentStep || 1,
      currentStageName: data.currentStageName || "Verifikasi",
      isArchived: data.isArchived || false,
      catatanOrder: data.catatanOrder || data.catatan || data.keterangan || data["Keterangan"] || "Order dibuat dari Data Penjualan (+ Tambah Data)",
      statusPengerjaan: data.statusPengerjaan,
      salesSnapshotStatus: data.salesSnapshotStatus || data.statusPengerjaan,
      noInvoice: explicitInvoice,
      tandaTerima: data.tandaTerima,
      ttbBPKB: data.ttbBPKB,
      statusBPKB: data.statusBPKB,
      bpkb: data.bpkb,
      statusKepemilikan: data.statusKepemilikan || "Pribadi",
      clientDocuments: data.clientDocuments || {
        stnk: { name: "", status: "Belum Tersedia", isOptional: false },
        bpkb: { name: "", status: data.bpkb === "Ada" ? "Sudah Tersedia" : "Belum Tersedia", isOptional: false },
        ktp: { name: "", status: "Belum Tersedia", isOptional: false },
        skkp: { name: "", status: "Belum Tersedia", isOptional: true },
        lainnya: { name: "", status: "Belum Tersedia", isOptional: true },
      },
      payment: {
        tipePembayaran: initialPaid >= totalEst && totalEst > 0 ? "Bayar di Awal" : "Bayar di Akhir",
        metodePembayaran: "Transfer",
        statusPembayaran: data.statusPembayaran || (initialPaid >= totalEst && totalEst > 0 ? "Lunas" : initialPaid > 0 ? "Kurang" : "Belum Bayar"),
        totalBiaya: totalEst,
        totalEstimasi: totalEst,
        dibayar: initialPaid,
        kurang: Math.max(0, totalEst - initialPaid),
        overpayment: 0,
        settlementCondition: "PENDING_FINALIZATION",
        refundStatus: "NONE",
        isPaymentVerified: initialPaid >= totalEst && totalEst > 0,
        invoiceNo: explicitInvoice,
      },
      rekapDocuments: data.rekapDocuments || [],
    });
  }

  private buildOrderPayload(data: Partial<OperationalOrder> & {
    customer: string;
    layanan: string;
    namaPemilik: string;
    nomorHP: string;
    nopol: string;
  }): OperationalOrder {
    const targetDate = data.tanggalMasukBerkas || (data as any).tanggal_masuk_berkas || (data as any).createdAt;
    let orderNo = (data.orderNo || "").trim();
    if (!orderNo || !orderNo.startsWith("ORD-")) {
      const allOrders = this.repository.getAllFlat();
      const generated = generateNextOrderAndInvoiceNo(targetDate, allOrders);
      orderNo = generated.orderNo;
    }
    const processes = getDefaultSamsatProcesses(data.layanan);

    const masterServiceFee = (data.layanan && data.wilayahSamsatAsal)
      ? pricingStore.getServiceFeeConfig(data.layanan, data.wilayahSamsatAsal)?.biayaJasa
      : undefined;
    const resolvedBiayaJasa = data.biayaJasa ?? data.costSnapshot?.biayaJasa ?? masterServiceFee ?? 0;

    const totalEstimasi = data.totalEstimasi ?? data.costSnapshot?.totalEstimasi ?? data.payment?.totalBiaya ?? (
      resolvedBiayaJasa +
      (data.pkb || 0) +
      (data.swdkllj ?? 143000) +
      (data.dendaSwdkllj || 0)
    );

    return {
      orderNo,
      clientRequestId: (data as any).clientRequestId,
      customer: data.customer,
      nomorHP: data.nomorHP,
      layanan: data.layanan,
      currentStep: (data as any).currentStep || 1,
      currentStageName: (data as any).currentStageName || "Verifikasi",
      catatanOrder: data.catatanOrder || "Order baru dibuat dari formulir Buat Order.",
      createdAt: (data as any).createdAt || new Date().toISOString().split("T")[0],
      isArchived: (data as any).isArchived || false,

      namaPemilik: data.namaPemilik,
      kepemilikanKendaraan: (data as any).statusKepemilikan || data.kepemilikanKendaraan || "Pribadi",
      jenisKendaraan: data.jenisKendaraan || "Mobil",
      tahunKendaraan: data.tahunKendaraan || new Date().getFullYear(),
      nopol: data.nopol,
      pkbBerlakuSd: data.pkbBerlakuSd || "",
      tahunPajak: data.tahunPajak || String(new Date().getFullYear()),
      bulanPajak: data.bulanPajak || "Januari",
      nominalPkbTerakhir: data.nominalPkbTerakhir ?? 0,
      nominalSwdkllj: data.nominalSwdkllj ?? data.costSnapshot?.swdkllj ?? 143000,
      kodePromo: data.kodePromo || "",
      wilayahSamsatAsal: data.wilayahSamsatAsal || "Jakarta Timur",
      wilayahSamsatTujuan: data.wilayahSamsatTujuan || "-",

      alamatPenjemputan: data.alamatPenjemputan || {
        kota: data.wilayahSamsatAsal || "Jakarta Timur",
        kecamatan: "",
        kelurahan: "",
        detail: "Alamat penjemputan belum diisi",
        rtRw: "",
        nomor: "",
        landmark: "",
      },
      alamatPengantaran: data.alamatPengantaran || {
        kota: data.wilayahSamsatAsal || "Jakarta Timur",
        kecamatan: "",
        kelurahan: "",
        detail: "Alamat pengantaran belum diisi",
        rtRw: "",
        nomor: "",
        landmark: "",
      },

      clientDocuments: data.clientDocuments || {
        stnk: { name: "", status: "Belum Tersedia", isOptional: false },
        bpkb: { name: "", status: "Belum Tersedia", isOptional: false },
        ktp: { name: "", status: "Belum Tersedia", isOptional: false },
        skkp: { name: "", status: "Belum Tersedia", isOptional: true },
        lainnya: { name: "", status: "Belum Tersedia", isOptional: true },
      },
      updatedDocuments: [],

      biayaJasa: resolvedBiayaJasa,
      pkb: data.pkb || 0,
      swdkllj: data.swdkllj ?? data.costSnapshot?.swdkllj ?? 143000,
      dendaSwdkllj: data.dendaSwdkllj || 0,
      totalEstimasi,

      // Master Pricing Snapshot & Service Method (Batch 5)
      metodeLayanan: data.metodeLayanan || data.costSnapshot?.metodeLayanan || "Antar Jemput",
      costBreakdown: data.costBreakdown || data.costSnapshot?.breakdown || [],
      costSnapshot: data.costSnapshot,
      estimationResult: data.estimationResult,
      // Service Requirements Snapshot (Patch D)
      serviceRequirementsSnapshot: (() => {
        if ((data as any).serviceRequirementsSnapshot) return (data as any).serviceRequirementsSnapshot;
        const svcId = (data as any).service_id || (data as any).serviceId || data.layanan;
        if (svcId) {
          const detail = serviceStore.getServiceRequirementsDetail(String(svcId));
          if (detail.status === "OK" || detail.status === "CUSTOM_SERVICE") {
            return {
              schemaVersion: 1,
              sourceServiceId: detail.serviceId || String(svcId),
              sourceServiceName: detail.serviceName || data.layanan,
              sourceRequirementsVersion: 1,
              capturedAt: new Date().toISOString(),
              requirements: detail.requirements.map((r: string, idx: number) => ({
                id: r.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `req-${idx}`,
                label: r,
                required: true,
              })),
            };
          }
        }
        return undefined;
      })(),

      samsatProcesses: processes,
      currentSamsatProcess: processes[0]?.name || "Antrean Samsat",

      payment: data.payment ? {
        ...data.payment,
        totalEstimasi,
        totalBiaya: data.payment.totalBiaya || totalEstimasi,
        dibayar: data.payment.dibayar || 0,
        kurang: data.payment.kurang !== undefined ? data.payment.kurang : Math.max(0, totalEstimasi - (data.payment.dibayar || 0)),
        overpayment: data.payment.overpayment !== undefined ? data.payment.overpayment : Math.max(0, (data.payment.dibayar || 0) - totalEstimasi),
        nominalDibayarAwal: data.payment.nominalDibayarAwal,
        nominalPembayaranAwalTerkonfirmasi: data.payment.nominalPembayaranAwalTerkonfirmasi,
        riwayatKoreksiPembayaran: data.payment.riwayatKoreksiPembayaran || [],
        settlementCondition: data.payment.settlementCondition || "PENDING_FINALIZATION",
        refundStatus: data.payment.refundStatus || "NONE",
        isPaymentVerified: data.payment.isPaymentVerified ?? false,
      } : {
        tipePembayaran: "Bayar di Akhir",
        metodePembayaran: "Cash",
        statusPembayaran: "Belum Lunas",
        totalBiaya: totalEstimasi,
        totalEstimasi,
        dibayar: 0,
        kurang: totalEstimasi,
        overpayment: 0,
        settlementCondition: "PENDING_FINALIZATION",
        refundStatus: "NONE",
        isPaymentVerified: false,
      },
      orderSource: data.orderSource || "Offline / Loket",
      createdBy: data.createdBy || "Admin Loket",
      createdById: data.createdById,
      createdByRole: data.createdByRole,
      settlementCondition: "PENDING_FINALIZATION",
      refundStatus: "NONE",
      rekapDocuments: data.rekapDocuments || [],
      salesSnapshotStatus: (data as any).salesSnapshotStatus,
      statusPengerjaan: (data as any).statusPengerjaan,
      noInvoice: (data as any).noInvoice,
      tandaTerima: (data as any).tandaTerima,
      ttbBPKB: (data as any).ttbBPKB,
      statusBPKB: (data as any).statusBPKB,
      bpkb: (data as any).bpkb,
      biayaAntarJemput: (data as any).biayaAntarJemput || 0,
      biayaLainnya: (data as any).biayaLainnya || 0,
      namaPenerimaKeluar: (data as any).namaPenerimaKeluar || (data as any).namaPemilikRekeningKeluar || "",
      bankUangKeluar: (data as any).bankUangKeluar || "",
      metodePembayaranKeluar: (data as any).metodePembayaranKeluar || "",
      tanggalMasukBerkas: (data as any).tanggalMasukBerkas || "",
      tanggalUangMasuk: (data as any).tanggalUangMasuk || "",
      tanggalPengeluaranSamsat: (data as any).tanggalPengeluaranSamsat || "",
    };
  }

  // 1. BUAT ORDER: Tambah Order baru langsung ke Stage 1: VERIFIKASI
  public addOrder(data: Partial<OperationalOrder> & {
    customer: string;
    layanan: string;
    namaPemilik: string;
    nomorHP: string;
    nopol: string;
  }): OperationalOrder {
    const clientRequestId = (data as any).clientRequestId || `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newOrder = this.buildOrderPayload({ ...data, clientRequestId });
    const orderNo = newOrder.orderNo;

    // Register invoice in Finance Store as Single Source of Truth
    try {
      const isLunasInitial = newOrder.payment.statusPembayaran === "Lunas" && newOrder.payment.isPaymentVerified;
      const initialPaid = newOrder.payment.tipePembayaran === "Bayar di Awal" ? (newOrder.payment.dibayar || 0) : 0;
      const initialOverpayment = newOrder.payment.tipePembayaran === "Bayar di Awal" ? (newOrder.payment.overpayment || 0) : 0;
      const matchingInv = orderNo.replace(/^ORD-/, "INV-");
      const explicitInv = (data as any).noInvoice !== undefined ? (data as any).noInvoice : (newOrder.payment?.invoiceNo || matchingInv);
      const invRecord = financeStore.addInvoice({
        orderNo,
        customer: data.customer,
        nopol: data.nopol,
        jenisLayanan: data.layanan,
        totalTagihan: newOrder.totalEstimasi,
        terbayar: initialPaid,
        metodePembayaran: newOrder.payment.metodePembayaran,
        phone: data.nomorHP,
        alamat: data.alamatPenjemputan?.detail || data.alamatPenjemputan?.kota,
        dueTrigger: "AFTER_DOCUMENT_RECEIVED",
        collectionStatus: isLunasInitial ? "LUNAS" : "BELUM_JATUH_TEMPO",
        settlementCondition: "PENDING_FINALIZATION",
        refundStatus: "NONE",
        overpayment: initialOverpayment,
        invoice: explicitInv !== undefined ? explicitInv : undefined,
      });
      newOrder.payment.invoiceNo = explicitInv !== undefined ? explicitInv : invRecord.invoice;
      (newOrder as any).noInvoice = explicitInv !== undefined ? explicitInv : invRecord.invoice;
    } catch {
      // safe fallback
    }

    // Save to repository (Mock provider or API provider)
    this.repository.saveOrder(newOrder);
    this.notify();

    try {
      auditLog.log({
        userId: data.createdById || "usr-admin",
        userName: data.createdBy || "Admin Loket",
        userRole: (data.createdByRole as any) || "admin",
        action: "CREATE",
        module: "Order",
        details: `Membuat order baru ${orderNo} (${data.customer} - ${data.layanan})`,
        metadata: { orderNo, customer: data.customer, nopol: data.nopol, layanan: data.layanan },
      });
    } catch {
      // safe fallback
    }

    return newOrder;
  }

  // Phase 9.4: Asynchronous order creation waiting for backend confirmation & identity reconciliation
  public async addOrderAsync(data: Partial<OperationalOrder> & {
    customer: string;
    layanan: string;
    namaPemilik: string;
    nomorHP: string;
    nopol: string;
  }): Promise<OperationalOrder> {
    const clientRequestId = (data as any).clientRequestId || `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newOrder = this.buildOrderPayload({ ...data, clientRequestId });
    const tempOrderNo = newOrder.orderNo;

    // Register invoice in Finance Store optimistically
    let invRecord: any = null;
    try {
      const isLunasInitial = newOrder.payment.statusPembayaran === "Lunas" && newOrder.payment.isPaymentVerified;
      const initialPaid = newOrder.payment.tipePembayaran === "Bayar di Awal" ? (newOrder.payment.dibayar || 0) : 0;
      const initialOverpayment = newOrder.payment.tipePembayaran === "Bayar di Awal" ? (newOrder.payment.overpayment || 0) : 0;
      const matchingInv = tempOrderNo.replace(/^ORD-/, "INV-");
      const explicitInv = (data as any).noInvoice !== undefined ? (data as any).noInvoice : (newOrder.payment?.invoiceNo || matchingInv);
      invRecord = financeStore.addInvoice({
        orderNo: tempOrderNo,
        customer: data.customer,
        nopol: data.nopol,
        jenisLayanan: data.layanan,
        totalTagihan: newOrder.totalEstimasi,
        terbayar: initialPaid,
        metodePembayaran: newOrder.payment.metodePembayaran,
        phone: data.nomorHP,
        alamat: data.alamatPenjemputan?.detail || data.alamatPenjemputan?.kota,
        dueTrigger: "AFTER_DOCUMENT_RECEIVED",
        collectionStatus: isLunasInitial ? "LUNAS" : "BELUM_JATUH_TEMPO",
        settlementCondition: "PENDING_FINALIZATION",
        refundStatus: "NONE",
        overpayment: initialOverpayment,
        invoice: explicitInv !== undefined ? explicitInv : undefined,
      });
      newOrder.payment.invoiceNo = explicitInv !== undefined ? explicitInv : invRecord.invoice;
      (newOrder as any).noInvoice = explicitInv !== undefined ? explicitInv : invRecord.invoice;
    } catch {
      // safe fallback
    }

    try {
      const confirmedOrder = typeof this.repository.saveOrderAsync === "function"
        ? await this.repository.saveOrderAsync(newOrder)
        : (this.repository.saveOrder(newOrder), newOrder);

      // Reconcile invoice if backend assigned a different canonical orderNo
      if (confirmedOrder.orderNo !== tempOrderNo) {
        financeStore.reconcileOrderNo(tempOrderNo, confirmedOrder.orderNo, confirmedOrder.payment?.invoiceNo);
      }

      this.notify();

      try {
        auditLog.log({
          userId: data.createdById || "usr-admin",
          userName: data.createdBy || "Admin Loket",
          userRole: (data.createdByRole as any) || "admin",
          action: "CREATE",
          module: "Order",
          details: `Membuat order baru ${confirmedOrder.orderNo} (${data.customer} - ${data.layanan})`,
          metadata: { orderNo: confirmedOrder.orderNo, customer: data.customer, nopol: data.nopol, layanan: data.layanan },
        });
      } catch {
        // safe fallback
      }

      return confirmedOrder;
    } catch (err) {
      // Phase 9.4: Clean up optimistic invoice on failure
      financeStore.removeInvoiceByOrderNo(tempOrderNo);
      this.notify();
      throw err;
    }
  }

  // Verifikasi Pembayaran (Khususnya untuk Bayar di Awal di Stage 1)
  public verifyPayment(orderNo: string, verifierName: string = "Admin", confirmedAmount?: number, notes?: string, proofPayload?: any): boolean {
    const targetOrder = this.repository.getByOrderNo(orderNo);
    if (!targetOrder) return false;

    const success = typeof this.repository.verifyPayment === "function"
      ? (this.repository as any).verifyPayment(orderNo, verifierName, confirmedAmount, notes, proofPayload)
      : false;
    if (!success) return false;

    const updatedOrder = this.repository.getByOrderNo(orderNo);

    // Synchronize to financeStore without recording duplicate cash bank entries
    if (updatedOrder) {
      try {
        financeStore.updateInvoiceFromOrder(updatedOrder.orderNo, {
          totalTagihan: updatedOrder.payment.totalBiaya,
          terbayar: updatedOrder.payment.dibayar,
          sisa: updatedOrder.payment.kurang,
          overpayment: updatedOrder.payment.overpayment,
          status: updatedOrder.payment.statusPembayaran as any,
        });
      } catch {
        // safe fallback
      }
    }

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: verifierName || "Admin",
        userRole: "admin",
        action: "UPDATE",
        module: "Order Tracking",
        details: `Verifikasi pembayaran order ${targetOrder.orderNo} (${targetOrder.customer}) - Terkonfirmasi Rp ${(updatedOrder?.payment.dibayar || 0).toLocaleString('id-ID')} (${updatedOrder?.payment.statusPembayaran})`,
        metadata: {
          orderNo: targetOrder.orderNo,
          totalBiaya: targetOrder.payment.totalBiaya,
          confirmedAmount: updatedOrder?.payment.dibayar,
          statusPembayaran: updatedOrder?.payment.statusPembayaran,
          catatan: notes,
        },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  // 2. Transisi stage (Misal 1->2, 2->3, dst.)
  public advanceOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder>): boolean {
    const currentOrder = this.repository.getByOrderNo(orderNo);
    if (!currentOrder) return false;
    const currentStageFound = currentOrder.currentStageName;

    const nowIso = new Date().toISOString();
    const effectiveUpdates: Partial<OperationalOrder> = { ...updates };
    if ((targetStage === "Verifikasi Dokumen" || targetStage === "Proses Samsat") && !currentOrder.tanggalMasukBerkas && !updates.tanggalMasukBerkas) {
      effectiveUpdates.tanggalMasukBerkas = nowIso;
    }
    if ((targetStage === "Proses Samsat" || targetStage === "Verifikasi Ulang" || targetStage === "Supervisi" || targetStage === "Pengantaran" || targetStage === "Dokumen Telah Diterima") && !currentOrder.tanggalProsesSamsat && !updates.tanggalProsesSamsat) {
      effectiveUpdates.tanggalProsesSamsat = nowIso;
    }
    if (updates.tanggalPengeluaranSamsat) {
      effectiveUpdates.tanggalPengeluaranSamsat = updates.tanggalPengeluaranSamsat;
    }

    const success = this.repository.advanceOrder(orderNo, targetStage, effectiveUpdates);
    if (!success) return false;

    const updatedOrder = this.repository.getByOrderNo(orderNo);

    // If transitioning into Dokumen Telah Diterima (Stage 8), update collection timing to JATUH_TEMPO
    if (targetStage === "Dokumen Telah Diterima" && updatedOrder?.payment.invoiceNo) {
      try {
        financeStore.updateInvoiceFromOrder(orderNo, {
          totalTagihan: updatedOrder.payment.totalBiaya,
          collectionStatus: updatedOrder.payment.kurang > 0 ? "JATUH_TEMPO" : "LUNAS",
        });
      } catch {
        // safe fallback
      }
    }

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: updates.verifiedBy || "Admin",
        userRole: "admin",
        action: "UPDATE",
        module: "Order Tracking",
        details: `Order ${orderNo} berpindah dari tahapan ${currentStageFound} ke ${targetStage}`,
        metadata: { orderNo, fromStage: currentStageFound, toStage: targetStage },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  // 2b. Asynchronous Transisi stage with authoritative backend response
  public async advanceOrderAsync(
    orderNo: string,
    targetStage: StageName,
    updates: Partial<OperationalOrder> = {}
  ): Promise<OperationalOrder | false> {
    const currentOrder = this.repository.getByOrderNo(orderNo);
    const currentStageFound = currentOrder?.currentStageName || "";

    const nowIso = new Date().toISOString();
    const effectiveUpdates: Partial<OperationalOrder> = { ...updates };
    if ((targetStage === "Verifikasi Dokumen" || targetStage === "Proses Samsat") && !currentOrder?.tanggalMasukBerkas && !updates.tanggalMasukBerkas) {
      effectiveUpdates.tanggalMasukBerkas = nowIso;
    }
    if ((targetStage === "Proses Samsat" || targetStage === "Verifikasi Ulang" || targetStage === "Supervisi" || targetStage === "Pengantaran" || targetStage === "Dokumen Telah Diterima") && !currentOrder?.tanggalProsesSamsat && !updates.tanggalProsesSamsat) {
      effectiveUpdates.tanggalProsesSamsat = nowIso;
    }
    if (updates.tanggalPengeluaranSamsat) {
      effectiveUpdates.tanggalPengeluaranSamsat = updates.tanggalPengeluaranSamsat;
    }

    const updatedOrder = await (this.repository as any).advanceOrderAsync(orderNo, targetStage, effectiveUpdates);
    if (!updatedOrder) return false;

    // If transitioning into Dokumen Telah Diterima (Stage 8), update collection timing to JATUH_TEMPO
    if (targetStage === "Dokumen Telah Diterima" && updatedOrder?.payment?.invoiceNo) {
      try {
        financeStore.updateInvoiceFromOrder(orderNo, {
          totalTagihan: updatedOrder.payment.totalBiaya,
          collectionStatus: updatedOrder.payment.kurang > 0 ? "JATUH_TEMPO" : "LUNAS",
        });
      } catch {
        // safe fallback
      }
    }

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: updates.verifiedBy || "Admin",
        userRole: "admin",
        action: "UPDATE",
        module: "Order Tracking",
        details: `Order ${orderNo} berpindah dari tahapan ${currentStageFound} ke ${targetStage}`,
        metadata: { orderNo, fromStage: currentStageFound, toStage: targetStage },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return updatedOrder;
  }

  public async rollbackOrderAsync(
    orderNo: string,
    targetStage: StageName,
    updates: Partial<OperationalOrder> = {}
  ): Promise<OperationalOrder | false> {
    const updated = await (this.repository as any).rollbackOrderAsync(orderNo, targetStage, updates);
    if (updated) {
      this.notify();
    }
    return updated;
  }

  public async archiveOrderAsync(orderNo: string): Promise<boolean> {
    const ok = await (this.repository as any).archiveOrderAsync(orderNo);
    if (ok) {
      this.notify();
    }
    return ok;
  }

  // 3. Update order in-place (tanpa pindah stage)
  public updateOrder(orderNo: string, updates: Partial<OperationalOrder>): boolean {
    const success = this.repository.updateOrder(orderNo, updates);
    if (!success) return false;

    try {
      const msgName = updates.messenger || updates.messengerPengantar;
      if (msgName) {
        auditLog.log({
          userId: "usr-admin",
          userName: "Admin",
          userRole: "admin",
          action: "UPDATE",
          module: "Messenger Task",
          details: `Penugasan messenger ${msgName} pada order ${orderNo}`,
          metadata: { orderNo, messenger: msgName },
        });
      } else {
        auditLog.log({
          userId: "usr-admin",
          userName: "Admin",
          userRole: "admin",
          action: "UPDATE",
          module: "Order Tracking",
          details: `Pembaruan data order ${orderNo}`,
          metadata: { orderNo },
        });
      }
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  public async updateOrderAsync(orderNo: string, updates: Partial<OperationalOrder>): Promise<boolean> {
    const success = await (this.repository as any).updateOrderAsync(orderNo, updates);
    if (success) {
      try {
        const msgName = updates.messenger || updates.messengerPengantar;
        if (msgName) {
          auditLog.log({
            userId: "usr-admin",
            userName: "Admin",
            userRole: "admin",
            action: "UPDATE",
            module: "Messenger Task",
            details: `Penugasan messenger ${msgName} pada order ${orderNo}`,
            metadata: { orderNo, messenger: msgName },
          });
        }
      } catch {}
      this.notify();
    }
    return success;
  }

  // 4. Sinkronisasi status & pembayaran dari FinanceStore (Arah Balik: Finance -> Order)
  public syncPaymentFromFinance(payload: PaymentSyncPayload): boolean {
    const order = this.repository.getByOrderNo(payload.orderNo);
    if (!order) return false;

    const updatedPayment = {
      ...order.payment,
      statusPembayaran: payload.statusPembayaran,
      dibayar: payload.dibayar,
      kurang: payload.kurang,
      totalBiaya: payload.totalBiaya,
      isPaymentVerified: payload.statusPembayaran === "Lunas" ? true : order.payment.isPaymentVerified,
      tanggalBayar: payload.tanggalBayar || order.payment.tanggalBayar,
      metodePembayaran: payload.metodePembayaran || order.payment.metodePembayaran,
      settlementCondition: payload.settlementCondition || order.payment.settlementCondition,
      refundStatus: payload.refundStatus || order.payment.refundStatus,
      overpayment: payload.overpayment !== undefined ? payload.overpayment : order.payment.overpayment,
    };

    const updates: Partial<OperationalOrder> = {
      payment: updatedPayment,
      ...(payload.settlementCondition ? { settlementCondition: payload.settlementCondition } : {}),
      ...(payload.refundStatus ? { refundStatus: payload.refundStatus } : {}),
    };

    const orderUpdated = this.repository.updateOrder(payload.orderNo, updates);
    if (orderUpdated) {
      this.notify();
    }
    return orderUpdated;
  }

  // 5. Sinkronisasi biaya final aktual dari Stage 5 ke FinanceStore (Arah: Order -> Finance)
  public syncFinalCostToFinance(
    orderNo: string,
    newTotal: number,
    biayaSamsat: number,
    profit: number,
    costItems?: any[],
    alasanPending?: string
  ): boolean {
    const targetOrder = this.repository.getByOrderNo(orderNo);

    let settlementCondition: SettlementCondition = "BALANCED";
    let refundStatus: RefundStatus = "NONE";
    let newKurang = 0;
    let newOverpayment = 0;

    if (targetOrder) {
      let newStatus: "Lunas" | "Belum Bayar" | "Kurang Bayar" = "Lunas";
      const paid = targetOrder.payment.dibayar || 0;
      const difference = newTotal - paid;

      if (difference === 0) {
        settlementCondition = "BALANCED";
        refundStatus = "NONE";
        newKurang = 0;
        newOverpayment = 0;
        newStatus = "Lunas";
      } else if (difference > 0) {
        settlementCondition = "UNDERPAID";
        refundStatus = "NONE";
        newKurang = difference;
        newOverpayment = 0;
        newStatus = paid > 0 ? "Kurang Bayar" : "Belum Bayar";
      } else {
        settlementCondition = "OVERPAID";
        refundStatus = "PENDING";
        newKurang = 0;
        newOverpayment = Math.abs(difference);
        newStatus = "Lunas";
      }

      this.repository.updateOrder(orderNo, {
        finalCost: newTotal,
        settlementCondition,
        refundStatus,
        alasanPending: alasanPending || (targetOrder as any).alasanPending || undefined,
        alasan_pending: alasanPending || (targetOrder as any).alasan_pending || undefined,
        payment: {
          ...targetOrder.payment,
          totalBiaya: newTotal,
          kurang: newKurang,
          overpayment: newOverpayment,
          settlementCondition,
          refundStatus,
          statusPembayaran: newStatus,
        },
        totalEstimasi: newTotal,
      });
      this.notify();
    }

    const collectionStatus = newKurang > 0
      ? (targetOrder && targetOrder.currentStep >= 8 ? "JATUH_TEMPO" : "BELUM_JATUH_TEMPO")
      : "LUNAS";

    const res = financeStore.updateInvoiceFromOrder(orderNo, {
      totalTagihan: newTotal,
      biayaSamsat,
      profit,
      costItems,
      settlementCondition,
      refundStatus,
      overpayment: newOverpayment,
      dueTrigger: "AFTER_DOCUMENT_RECEIVED",
      collectionStatus,
      alasan_pending: alasanPending || undefined,
      alasan: alasanPending || undefined,
    });
    return res !== null;
  }

  // 6. DOKUMEN TELAH DITERIMA -> SIMPAN KE RIWAYAT ORDER (Archiving)
  public archiveOrder(orderNo: string): boolean {
    const orderToArchive = this.repository.getByOrderNo(orderNo);
    if (!orderToArchive) return false;

    const success = this.repository.archiveOrder(orderNo);
    if (!success) return false;

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin",
        userRole: "admin",
        action: "UPDATE",
        module: "Order History",
        details: `Order ${orderNo} (${orderToArchive.customer}) selesai alur operasional dan diarsipkan`,
        metadata: { orderNo, customer: orderToArchive.customer },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  // 6c. BATALKAN ORDER (Soft cancellation)
  public async cancelOrder(orderNo: string, reason?: string): Promise<boolean> {
    const success = await Promise.resolve(this.repository.cancelOrder?.(orderNo, reason));
    if (success) {
      this.notify();
    }
    return Boolean(success);
  }

  // 6b. HAPUS REKAP ORDER SEMENTARA (Membersihkan baris arsip sementara, data penjualan master tetap utuh)
  public deleteArchivedOrder(orderNo: string): boolean {
    const targetOrder = this.repository.getByOrderNo(orderNo);
    if (targetOrder) {
      try {
        financeStore.preserveOrderInContractDataset(targetOrder);
      } catch {
        // safe fallback
      }
    }

    const success = this.repository.deleteArchivedOrder(orderNo);
    if (!success) return false;

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin",
        userRole: "admin",
        action: "DELETE",
        module: "Order History",
        details: `Rekap order sementara ${orderNo} dibersihkan oleh admin`,
        metadata: { orderNo },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  // 6c. HARD DELETE ORDER (Menghapus order secara fisik dan permanen dari database & stores)
  public async deleteOrder(orderNo: string): Promise<boolean> {
    const cleanNo = (orderNo || "").trim().toUpperCase();
    if (!cleanNo) return false;

    let success = false;
    if (typeof this.repository.deleteOrder === "function") {
      success = await this.repository.deleteOrder(cleanNo);
    } else if (typeof (this.repository as any).provider?.deleteOrder === "function") {
      success = await (this.repository as any).provider.deleteOrder(cleanNo);
    }

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin",
        userRole: "admin",
        action: "DELETE",
        module: "Data Penjualan",
        details: `Order ${cleanNo} dihapus permanen oleh admin`,
        metadata: { orderNo: cleanNo },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return Boolean(success);
  }

  // 6c. CLEAR SELURUH REKAP ORDER (Membersihkan tampilan rekap order saja, Data Penjualan & Finance 100% utuh)
  public clearArchivedOrders(): boolean {
    const currentArchived = this.repository.getArchivedOrders();
    for (const ord of currentArchived) {
      try {
        financeStore.preserveOrderInContractDataset(ord);
      } catch {
        // safe fallback
      }
    }

    const success = this.repository.clearArchivedOrders();
    if (!success) return false;

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin",
        userRole: "admin",
        action: "DELETE",
        module: "Order History",
        details: `Seluruh data Rekap Order (${currentArchived.length} berkas) dibersihkan oleh admin`,
        metadata: { count: currentArchived.length },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  // 7. Proses Refund Kelebihan Bayar (Section 10)
  public processRefund(orderNo: string, processedBy: string = "Admin"): boolean {
    const targetOrder = this.repository.getByOrderNo(orderNo);
    if (!targetOrder) return false;

    const refundAmount = targetOrder.payment.overpayment || 0;
    if (refundAmount <= 0 || targetOrder.refundStatus === "PROCESSED") return false;

    if (targetOrder.payment.invoiceNo) {
      financeStore.processRefund(targetOrder.payment.invoiceNo, processedBy);
    }

    const nowStr = new Date().toISOString();
    const updatedPayment = {
      ...targetOrder.payment,
      settlementCondition: "SETTLED" as const,
      refundStatus: "PROCESSED" as const,
      refundAmount,
      refundProcessedAt: nowStr,
      refundProcessedBy: processedBy,
    };

    this.repository.updateOrder(orderNo, {
      payment: updatedPayment,
      settlementCondition: "SETTLED",
      refundStatus: "PROCESSED",
    });

    this.notify();
    return true;
  }

  // 8. Tambah Dokumen Rekap Order (BEFORE / AFTER)
  public addRekapDocument(
    orderNo: string,
    doc: Omit<RekapDocument, "id" | "orderId" | "uploadedAt">
  ): boolean {
    const targetOrder = this.repository.getByOrderNo(orderNo);
    if (!targetOrder) return false;

    const currentDocs = targetOrder.rekapDocuments || [];
    const newDoc: RekapDocument = {
      ...doc,
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orderId: orderNo,
      uploadedAt: new Date().toISOString(),
    };

    this.repository.updateOrder(orderNo, {
      rekapDocuments: [...currentDocs, newDoc],
    });

    this.notify();
    return true;
  }

  public async approveDocumentsAsync(
    orderNo: string,
    stage: 5 | 6,
    user: { name?: string; role?: string } = {},
    notes?: string,
    snapshotDocs?: string[]
  ): Promise<boolean> {
    const existing = this.repository.getByOrderNo(orderNo);
    if (!existing) return false;

    const nowIso = new Date().toISOString();
    const currentApproval = existing.documentApproval || {
      stage5Verified: false,
      stage6Approved: false,
    };

    const userName = user.name || (stage === 6 ? "Supervisor" : "Admin Loket");
    const userRole = user.role || (stage === 6 ? "supervisor" : "admin");

    const updatedApproval = {
      ...currentApproval,
      ...(stage === 5
        ? {
            stage5Verified: true,
            stage5VerifiedAt: nowIso,
            stage5VerifiedBy: userName,
            stage5VerifiedByRole: userRole,
            stage5Notes: notes || "",
            snapshotDocs: snapshotDocs || currentApproval.snapshotDocs || [],
          }
        : {
            stage6Approved: true,
            stage6ApprovedAt: nowIso,
            stage6ApprovedBy: userName,
            stage6ApprovedByRole: userRole,
            stage6Notes: notes || "",
            snapshotDocs: snapshotDocs || currentApproval.snapshotDocs || [],
          }),
    };

    this.repository.updateOrder(orderNo, {
      documentApproval: updatedApproval,
      ...(stage === 5 ? { documentsVerified: true } : { approvedBySpv: true, supervisorApprovedBy: userName }),
    });

    try {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`${APP_CONFIG.apiBaseUrl}/orders/${encodeURIComponent(orderNo)}/approve-documents`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          stage,
          approvedBy: userName,
          approvedByRole: userRole,
          notes,
          snapshotDocs,
        }),
      });
    } catch {
      // Safe fallback if offline / mock mode
    }

    try {
      auditLog.log({
        userId: userRole === "supervisor" ? "usr-spv" : "usr-admin",
        userName,
        userRole: userRole as any,
        action: "UPDATE",
        module: "Order Tracking",
        details: `Persetujuan dokumen Stage ${stage} disetujui untuk order ${orderNo}`,
        metadata: { orderNo, stage, approvedBy: userName, role: userRole },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  public async initFromApi(): Promise<void> {
    if (typeof (this.repository as any).initFromApi === "function") {
      await (this.repository as any).initFromApi();
      this.notify();
    }
  }

  public async refresh(silent?: boolean): Promise<void> {
    return this.initFromApi();
  }
}

export const orderStore = new OrderStore();

export function useOrderStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    return orderStore.subscribe(() => setTick(t => t + 1));
  }, []);

  return {
    activeOrders: orderStore.getActiveOrders(),
    archivedOrders: orderStore.getArchivedOrders(),
    isLoading: false,
    error: null as string | null,
    refresh: async () => {},
    getAllOrders: orderStore.getAllOrders.bind(orderStore),
    addOrder: orderStore.addOrder.bind(orderStore),
    addOrderAsync: orderStore.addOrderAsync.bind(orderStore),
    addOrderFromContract: orderStore.addOrderFromContract.bind(orderStore),
    addOrderFromContractAsync: orderStore.addOrderFromContractAsync.bind(orderStore),
    advanceOrder: orderStore.advanceOrder.bind(orderStore),
    advanceOrderAsync: orderStore.advanceOrderAsync.bind(orderStore),
    rollbackOrderAsync: orderStore.rollbackOrderAsync.bind(orderStore),
    archiveOrderAsync: orderStore.archiveOrderAsync.bind(orderStore),
    updateOrder: orderStore.updateOrder.bind(orderStore),
    updateOrderAsync: orderStore.updateOrderAsync.bind(orderStore),
    verifyPayment: orderStore.verifyPayment.bind(orderStore),
    archiveOrder: orderStore.archiveOrder.bind(orderStore),
    deleteArchivedOrder: orderStore.deleteArchivedOrder.bind(orderStore),
    deleteOrder: orderStore.deleteOrder.bind(orderStore),
    clearArchivedOrders: orderStore.clearArchivedOrders.bind(orderStore),
    getOrderByNo: orderStore.getOrderByNo.bind(orderStore),
    getOrdersByStage: orderStore.getOrdersByStage.bind(orderStore),
    syncFinalCostToFinance: orderStore.syncFinalCostToFinance.bind(orderStore),
    processRefund: orderStore.processRefund.bind(orderStore),
    addRekapDocument: orderStore.addRekapDocument.bind(orderStore),
    approveDocumentsAsync: orderStore.approveDocumentsAsync.bind(orderStore),
    cancelOrder: orderStore.cancelOrder.bind(orderStore),
  };
}
