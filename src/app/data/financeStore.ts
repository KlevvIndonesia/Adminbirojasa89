/**
 * Single Source of Truth for Finance, Payment Realization, and Billing
 * Admin SUN89 — Biro Jasa Management System
 */

import { useState, useEffect } from "react";
import { auditLog } from "../utils/auditLog";
import { financeRepository } from "../../data/repositories/financeRepository";
import { APP_CONFIG } from "../config/appConfig";
import { parseDateSafe } from "./dashboardAdapter";
import {
  ProfitItem,
  KasMessengerItem,
  KasKantorItem,
  PengeluaranItem,
  LabaRugiMonthlyItem,
} from "../../domain/finance/types";

export type { ProfitItem, KasMessengerItem, KasKantorItem, PengeluaranItem, LabaRugiMonthlyItem };

import { orderRepository } from "../../data/repositories/orderRepository";
import { documentRepository } from "../../data/repositories/documentRepository";
import { computeCanonicalLabaRugi, computeCashFlowReconciliation, CanonicalLabaRugiSummary, CashFlowReconciliationSummary } from "../../domain/finance/labaRugiCanonical";
export type { CashFlowReconciliationSummary };
export type { CanonicalLabaRugiSummary };
import {
  resolveOrderSalesCategory,
  projectOrderToContractRow,
  deriveStatusPengerjaan,
  deriveStatusPembayaran,
  initialPerpanjangan1TahunContract,
  initialPerpanjangan5TahunContract,
  initialMutasiAsalContract,
  initialMutasiAntarDaerahContract,
  initialBalikNamaContract,
  initialTarikBerkasContract,
  initialDuplikatSTNKContract,
  initialLainnyaContract,
  initialMutasiLDContract,
  initialMutasiASContract,
  initialBBNContract,
  initialPerpanjanganPajakContract,
  initialLainLainContract,
  initialBelumKurangBayarContract,
  initialProfitTerpendingContract,
  initialCashbackTerpendingContract,
} from "./penjualanContractData";

import {
  PaymentStatus,
  RealizationStatus,
  BillingLifecycleStatus,
  PaymentSyncPayload,
  PaymentSyncCallback,
  InvoiceBillingRecord,
  PenjualanContractCategory,
  PaymentDueTrigger,
  CollectionState,
  derivePaymentStatus,
  calculateInvoiceProfitMetrics,
} from "../../domain/finance/types";
import { SettlementCondition, RefundStatus, OperationalOrder } from "../../domain/order/types";
import type { ReimbursementRequest } from "../../domain/messenger/types";

export type {
  PaymentStatus,
  RealizationStatus,
  BillingLifecycleStatus,
  PaymentSyncPayload,
  PaymentSyncCallback,
  InvoiceBillingRecord,
  PenjualanContractCategory,
  PaymentDueTrigger,
  CollectionState,
  SettlementCondition,
  RefundStatus,
  ReimbursementRequest,
};

export type OrderCreatorFn = (data: {
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
}) => OperationalOrder | false;

export type OrderAsyncCreatorFn = (data: {
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
}) => Promise<OperationalOrder | false>;

export interface ContractMutationResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
    field?: string;
    statusCode?: number;
  };
}

export {
  derivePaymentStatus,
  calculateInvoiceProfitMetrics,
  resolveOrderSalesCategory,
  projectOrderToContractRow,
  deriveStatusPengerjaan,
  deriveStatusPembayaran,
};


// Phone number dictionary for sample customers to support WhatsApp contact
const SAMPLE_CUSTOMER_PHONES: Record<string, { phone: string; email?: string; alamat?: string }> = {
  "PT. MAJU JAYA": { phone: "081289123456", email: "finance@majujaya.co.id", alamat: "Jl. Sudirman Kav 21, Jakarta" },
  "TOKO SEJAHTERA": { phone: "081987654321", email: "sejahtera.toko@gmail.com", alamat: "Jl. Pasar Anyar No. 14, Bogor" },
  "CV. MANDIRI": { phone: "082155667788", email: "admin@mandiri-cv.com", alamat: "Jl. Ir. H. Juanda No. 88, Depok" },
  "WARUNG MAKAN": { phone: "085699887766", email: "warung.berkah@gmail.com", alamat: "Jl. Raya Bogor KM 35, Cibinong" },
  "SALON CANTIK": { phone: "087711223344", email: "cantiksalon@yahoo.com", alamat: "Ruko Sukahati No. 5, Bogor" },
  "BENGKEL MOTOR": { phone: "081344556677", email: "bengkel.motor@gmail.com", alamat: "Jl. Tegar Beriman No. 12, Cibinong" },
  "TOKO BANGUNAN": { phone: "081288990011", email: "tb.sentosa@gmail.com", alamat: "Jl. Raya Sukabumi No. 45, Bogor" },
  "FOTOCOPY 24 JAM": { phone: "085733445566", email: "fc24jam@gmail.com", alamat: "Jl. Dramaga No. 18, Bogor" },
  "LAUNDRY KILOAN": { phone: "081822334455", email: "cleanlaundry@gmail.com", alamat: "Perum Gaperi 2 Blok B, Bojonggede" },
  "RUMAH MAKAN PADANG": { phone: "082211998877", email: "rmpadang@gmail.com", alamat: "Jl. Raya Pajajaran No. 7, Bogor" },
  "APOTEK SEHAT": { phone: "081199887766", email: "apotek.sehat@gmail.com", alamat: "Jl. Padjadjaran No. 102, Bogor" },
  "COUNTER HP": { phone: "089677889900", email: "countercell@gmail.com", alamat: "ITC Cibinong Lt. 1 Blok C" },
};

// Initial state builder migrating all existing dummy data seamlessly
function buildInitialInvoices(): InvoiceBillingRecord[] {
  return [];
}

class FinanceStore {
  private invoices: InvoiceBillingRecord[];
  private kasKantor: KasKantorItem[];
  private kasMessenger: KasMessengerItem[];
  private pengeluaran: PengeluaranItem[];
  private profitData: ProfitItem[];
  private labaRugiData: LabaRugiMonthlyItem[];
  private isApiMode: boolean;
  private unsubscribeRepo?: () => void;
  private unsubscribeOrderRepo?: () => void;
  private orderCreator: OrderCreatorFn | null = null;
  private orderAsyncCreator: OrderAsyncCreatorFn | null = null;
  private deletedOrderNos: Set<string> = new Set();

  public setOrderCreator(creator: OrderCreatorFn): void {
    this.orderCreator = creator;
  }

  public setOrderAsyncCreator(creator: OrderAsyncCreatorFn): void {
    this.orderAsyncCreator = creator;
  }

  constructor() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = JSON.parse(localStorage.getItem("sun89_deleted_order_nos") || "[]");
        if (Array.isArray(stored)) {
          stored.forEach((no) => this.deletedOrderNos.add(String(no).trim().toUpperCase()));
        }
      }
    } catch {}
    this.isApiMode = APP_CONFIG.dataProvider === "api";
    if (this.isApiMode) {
      this.invoices = [];
      this.kasKantor = [];
      this.kasMessenger = [];
      this.pengeluaran = [];
      this.profitData = [];
      this.labaRugiData = [];
      this.contractDatasets = {
        "perpanjangan-1-tahun": [],
        "perpanjangan-5-tahun": [],
        "mutasi-asal": [],
        "mutasi-antar-daerah": [],
        "balik-nama": [],
        "tarik-berkas": [],
        "duplikat-stnk": [],
        "lainnya": [],
        "mutasi-ld": [],
        "mutasi-as": [],
        bbn: [],
        "perpanjangan-pajak": [],
        "lain-lain": [],
        "belum-kurang-bayar": [],
        "profit-terpending": [],
        "cashback-terpending": [],
      };
      this.syncFromRepository();
      this.unsubscribeRepo = financeRepository.subscribe(() => {
        this.syncFromRepository();
      });
    } else {
      this.invoices = buildInitialInvoices();
      this.kasKantor = [];
      this.kasMessenger = [];
      this.pengeluaran = [];
      this.profitData = [];
      this.labaRugiData = [];
    }

    // Subscribe to order repository updates to project orders into Data Penjualan reactively
    this.unsubscribeOrderRepo = orderRepository.subscribe(() => {
      this.notify();
    });
  }

  public setApiMode(isApi: boolean): void {
    this.isApiMode = isApi;
    if (this.unsubscribeRepo) {
      this.unsubscribeRepo();
      this.unsubscribeRepo = undefined;
    }
    if (isApi) {
      this.invoices = [];
      this.kasKantor = [];
      this.kasMessenger = [];
      this.pengeluaran = [];
      this.profitData = [];
      this.labaRugiData = [];
      this.contractDatasets = {
        "perpanjangan-1-tahun": [],
        "perpanjangan-5-tahun": [],
        "mutasi-asal": [],
        "mutasi-antar-daerah": [],
        "balik-nama": [],
        "tarik-berkas": [],
        "duplikat-stnk": [],
        "lainnya": [],
        "mutasi-ld": [],
        "mutasi-as": [],
        bbn: [],
        "perpanjangan-pajak": [],
        "lain-lain": [],
        "belum-kurang-bayar": [],
        "profit-terpending": [],
        "cashback-terpending": [],
      };
      this.syncFromRepository();
      this.unsubscribeRepo = financeRepository.subscribe(() => {
        this.syncFromRepository();
      });
    } else {
      this.invoices = buildInitialInvoices();
      this.kasKantor = [];
      this.kasMessenger = [];
      this.pengeluaran = [];
      this.profitData = [];
      this.labaRugiData = [];
      this.contractDatasets = {
        "perpanjangan-1-tahun": [...initialPerpanjangan1TahunContract],
        "perpanjangan-5-tahun": [...initialPerpanjangan5TahunContract],
        "mutasi-asal": [...initialMutasiAsalContract],
        "mutasi-antar-daerah": [...initialMutasiAntarDaerahContract],
        "balik-nama": [...initialBalikNamaContract],
        "tarik-berkas": [...initialTarikBerkasContract],
        "duplikat-stnk": [...initialDuplikatSTNKContract],
        "lainnya": [...initialLainnyaContract],
        "mutasi-ld": [...initialMutasiLDContract],
        "mutasi-as": [...initialMutasiASContract],
        bbn: [...initialBBNContract],
        "perpanjangan-pajak": [...initialPerpanjanganPajakContract],
        "lain-lain": [...initialLainLainContract],
        "belum-kurang-bayar": [...initialBelumKurangBayarContract],
        "profit-terpending": [...initialProfitTerpendingContract],
        "cashback-terpending": [...initialCashbackTerpendingContract],
      };
      this.notify();
    }
  }

  public async initFromApi(): Promise<void> {
    if (financeRepository && typeof (financeRepository as any).initFromApi === "function") {
      await (financeRepository as any).initFromApi();
    }
    this.syncFromRepository();
  }

  public syncFromRepository(): void {
    const repoInvoices = financeRepository.getInvoices();
    if (Array.isArray(repoInvoices)) {
      this.invoices = repoInvoices;
    }
    const repoKas = financeRepository.getKasKantorList();
    if (Array.isArray(repoKas)) {
      this.kasKantor = repoKas;
    }
    const repoProfit = financeRepository.getProfitList();
    if (Array.isArray(repoProfit)) {
      this.profitData = repoProfit;
    }
    const repoPengeluaran = financeRepository.getPengeluaranList();
    if (Array.isArray(repoPengeluaran)) {
      this.pengeluaran = repoPengeluaran;
    }
    const repoMessenger = financeRepository.getKasMessengerList();
    if (Array.isArray(repoMessenger)) {
      this.kasMessenger = repoMessenger;
    }
    if (this.isApiMode) {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        if (token) {
          fetch(`${APP_CONFIG.apiBaseUrl}/messenger/reimbursements`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .then((payload) => {
              if (payload.success && Array.isArray(payload.data)) {
                this.reimbursementRequests = payload.data;
                this.notify();
              }
            })
            .catch(() => {});
        }
      } catch {}
    }
    this.recomputeLabaRugi();
    this.notify();
  }

  public recomputeLabaRugi(): void {
    const canonical = computeCanonicalLabaRugi(
      this.invoices,
      this.pengeluaran,
      this.kasMessenger,
      "all",
      this.profitData
    );
    this.labaRugiData = canonical.chartData;
  }
  private reimbursementRequests: ReimbursementRequest[] = [];

  // Contract Datasets for DataPenjualan
  private contractDatasets: Record<PenjualanContractCategory, any[]> = {
    "perpanjangan-1-tahun": [...initialPerpanjangan1TahunContract],
    "perpanjangan-5-tahun": [...initialPerpanjangan5TahunContract],
    "mutasi-asal": [...initialMutasiAsalContract],
    "mutasi-antar-daerah": [...initialMutasiAntarDaerahContract],
    "balik-nama": [...initialBalikNamaContract],
    "tarik-berkas": [...initialTarikBerkasContract],
    "duplikat-stnk": [...initialDuplikatSTNKContract],
    "lainnya": [...initialLainnyaContract],
    "mutasi-ld": [...initialMutasiLDContract],
    "mutasi-as": [...initialMutasiASContract],
    bbn: [...initialBBNContract],
    "perpanjangan-pajak": [...initialPerpanjanganPajakContract],
    "lain-lain": [...initialLainLainContract],
    "belum-kurang-bayar": [...initialBelumKurangBayarContract],
    "profit-terpending": [...initialProfitTerpendingContract],
    "cashback-terpending": [...initialCashbackTerpendingContract],
  };

  private listeners: Set<() => void> = new Set();
  private paymentSyncListeners: Set<PaymentSyncCallback> = new Set();
  private kasCounter = 100;
  private invoiceCounter = 200;

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onPaymentSync(callback: PaymentSyncCallback): () => void {
    this.paymentSyncListeners.add(callback);
    return () => this.paymentSyncListeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("FinanceStore listener error:", err);
      }
    });
  }

  private notifyPaymentSync(record: InvoiceBillingRecord): void {
    if (!record.orderNo) return;
    const statusPembayaran = record.status;
    const payload: PaymentSyncPayload = {
      orderNo: record.orderNo,
      statusPembayaran,
      dibayar: record.terbayar,
      kurang: record.sisa,
      totalBiaya: record.totalTagihan,
      tanggalBayar: record.tanggalBayar || record.tanggal,
      metodePembayaran: record.metodePembayaran,
      settlementCondition: record.settlementCondition,
      refundStatus: record.refundStatus,
      overpayment: record.overpayment,
    };
    this.paymentSyncListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error("FinanceStore paymentSync listener error:", err);
      }
    });
  }

  // ==========================================
  // GETTERS (SINGLE SOURCE OF TRUTH)
  // ==========================================

  public getInvoices(): InvoiceBillingRecord[] {
    return this.invoices;
  }

  public getTagihanList(): InvoiceBillingRecord[] {
    return this.invoices.filter((inv) => inv.billingStatus !== "COMPLETED");
  }

  public getCompletedTagihanList(): InvoiceBillingRecord[] {
    return this.invoices.filter((inv) => inv.billingStatus === "COMPLETED");
  }

  public getProfitList(): ProfitItem[] {
    const defaultAccountNumbers: Record<string, string> = {
      BCA: "772-019-2831",
      BRI: "0123-01-001234-56-7",
      Mandiri: "133-00-1928374-1",
      CIMB: "800-12-98765-400",
      BNI: "089-234-5678",
    };
    return this.profitData.map((item) => {
      const rek = item.rekening || "BCA";
      const isCash = rek.toLowerCase().includes("cash") || (item.metodePembayaran && item.metodePembayaran.toLowerCase().includes("cash"));
      const metodePencairan = isCash ? "Cash" : "Transfer Bank";
      const namaBank = isCash ? "" : ((item as any).namaBank || (item as any).bank || rek);
      const noRekening = isCash ? "" : ((item as any).nomorRekening || (item as any).noRekening || defaultAccountNumbers[rek] || "772-019-2831");
      const namaRekening = isCash ? "" : ((item as any).namaPemilikRekening || (item as any).namaRekening || "PT Biro Jasa SUN89 Abadi");

      const metrics = calculateInvoiceProfitMetrics({
        dibayar: item.uangMasuk,
        totalTagihan: (item as any).totalTagihan !== undefined ? (item as any).totalTagihan : item.uangMasuk,
        biayaSamsat: item.biayaSamsat,
        biayaAntarJemput: (item as any).biayaAntarJemput,
        cashback: (item as any).cashback,
        isExplicitZero: Boolean((item as any).isExplicitZero || (item as any).costClassification === "EXPLICIT_ZERO"),
      });

      const canonicalProfit = metrics.isGrossDeficit && item.profit === 0
        ? metrics.grossServiceMargin
        : (item.profit !== undefined ? item.profit : metrics.grossServiceMargin);

      return {
        ...item,
        profit: canonicalProfit,
        grossServiceMargin: metrics.grossServiceMargin,
        netTransactionMargin: metrics.netTransactionMargin,
        isGrossDeficit: metrics.isGrossDeficit,
        isNetDeficit: metrics.isNetDeficit,
        metodePencairan,
        metodePembayaran: item.metodePembayaran || (isCash ? "Cash" : `Transfer ${rek}`),
        namaBank: isCash ? "" : namaBank,
        bank: isCash ? "Tunai" : rek,
        nomorRekening: noRekening,
        noRekening: noRekening,
        namaPemilikRekening: namaRekening,
        namaRekening: namaRekening,
        tanggalUangMasuk: item.uangMasuk > 0 ? (item.tanggalBayar || (item as any).tanggalUangMasuk || item.tanggal) : "",
      };
    });
  }

  public getRefundPendingList(): any[] {
    return this.invoices
      .filter((inv) => {
        const overpayment = Number(inv.overpayment || 0);
        return overpayment > 0 && inv.refundStatus !== "PROCESSED";
      })
      .map((inv) => ({
        ...inv,
        overpayment: Number(inv.overpayment || 0),
        statusRefund: inv.refundStatus || "PENDING",
      }));
  }

  public getProfitPendingList(): any[] {
    return this.invoices
      .filter((inv) => {
        // Exclude cancelled invoices/orders
        if (
          inv.status === "CANCELLED" ||
          inv.billingStatus === "CANCELLED" ||
          Boolean((inv as any).isCancelled)
        ) {
          return false;
        }
        if (inv.orderNo) {
          const ord = orderRepository.getByOrderNo(inv.orderNo);
          if (ord && (ord.currentStageName === "Dibatalkan" || Boolean((ord as any).isCancelled))) {
            return false;
          }
        }

        const total = Number(inv.totalTagihan) || 0;
        const paid = Number(inv.terbayar ?? inv.dibayar) || 0;
        const isPaidInFull = (total > 0 && paid >= total) || inv.status === "Lunas";

        // Condition 1: Must be paid in full (verified payment >= total tagihan)
        if (!isPaidInFull) return false;

        // Condition 2: Profit stays pending until Samsat/work completion

        // Condition 3: Operational work or Samsat document processing is NOT YET COMPLETED
        let isOrderCompleted = false;
        if (inv.orderNo) {
          const ord = orderRepository.getByOrderNo(inv.orderNo);
          if (ord) {
            isOrderCompleted =
              ord.currentStep >= 8 ||
              Boolean((ord as any).isArchived) ||
              ord.currentStageName === "Selesai" ||
              ord.currentStageName === "Selesai (Arsip)" ||
              Boolean(ord.settlementCondition && ord.settlementCondition !== "PENDING_FINALIZATION");
          }
        } else {
          isOrderCompleted = inv.status === "Lunas" && inv.billingStatus === "COMPLETED";
        }

        // If order is already completed, it leaves Profit Terpending (moves to profit realisasi / laba rugi)
        if (isOrderCompleted) return false;

        return true;
      })
      .map((inv) => {
        const total = Number(inv.totalTagihan) || 0;
        const paid = Number(inv.terbayar ?? inv.dibayar) || 0;
        const ord = inv.orderNo ? orderRepository.getByOrderNo(inv.orderNo) : null;

        // Financial Detail: Uang Masuk
        const totalTagihan = total;
        const totalUangMasuk = paid > 0 ? paid : total;
        const riwayatPembayaran = ord?.payment?.riwayatKoreksiPembayaran || [];

        // Financial Detail: Pass-Through Dana Titipan (Pajak Samsat / Kas Negara)
        const pkb = ord?.finalPkb ?? ord?.pkb ?? (inv.biayaSamsat ? Math.round(inv.biayaSamsat * 0.7) : 0);
        const swdkllj = ord?.finalSwdkllj ?? ord?.swdkllj ?? (inv.biayaSamsat ? Math.round(inv.biayaSamsat * 0.15) : 0);
        const dendaSwdkllj = ord?.finalDendaSwdkllj ?? ord?.dendaSwdkllj ?? 0;
        const pnbpSamsat = ord?.finalMutasiKeluar ?? ord?.finalMutasiMasuk ?? 0;
        const danaTitipanPajak = pkb + swdkllj + dendaSwdkllj + pnbpSamsat > 0
          ? (pkb + swdkllj + dendaSwdkllj + pnbpSamsat)
          : (inv.biayaSamsat || Math.round(totalTagihan * 0.75));

        // Pendapatan Jasa Biro (Fee Biro Jasa SUN89)
        const biayaJasaBiro = ord?.finalBiayaJasa ?? ord?.biayaJasa ?? (Number(inv.profit) || Math.max(0, totalTagihan - danaTitipanPajak));

        // Pengeluaran Aktual Biro
        const actualExpenses = this.pengeluaran.filter(
          (p) => p.keterangan && (p.keterangan.includes(inv.invoice) || (inv.orderNo && p.keterangan.includes(inv.orderNo)))
        );
        const totalPengeluaranAktualTercatat = actualExpenses.reduce((sum, p) => sum + (p.nominal || 0), 0);

        const komponenPengeluaran: Array<{ nama: string; nominal: number; status: string }> = [];
        if (pkb > 0) komponenPengeluaran.push({ nama: "PKB (Pajak Kendaraan Bermotor)", nominal: pkb, status: "Dana Titipan Samsat" });
        if (swdkllj > 0) komponenPengeluaran.push({ nama: "SWDKLLJ", nominal: swdkllj, status: "Dana Titipan Samsat" });
        if (dendaSwdkllj > 0) komponenPengeluaran.push({ nama: "Denda SWDKLLJ", nominal: dendaSwdkllj, status: "Dana Titipan Samsat" });
        if (pnbpSamsat > 0) komponenPengeluaran.push({ nama: "PNBP / Proses Samsat", nominal: pnbpSamsat, status: "Dana Titipan Samsat" });
        actualExpenses.forEach((exp) => {
          komponenPengeluaran.push({ nama: exp.keterangan, nominal: exp.nominal, status: "Pengeluaran Aktual" });
        });
        if (komponenPengeluaran.length === 0 && inv.biayaSamsat > 0) {
          komponenPengeluaran.push({ nama: "Beban Samsat & Proses", nominal: inv.biayaSamsat, status: "Estimasi Biaya Samsat" });
        }

        const totalUangKeluarAktual = totalPengeluaranAktualTercatat > 0 ? totalPengeluaranAktualTercatat : danaTitipanPajak;
        const selisihKasSementara = totalUangMasuk - totalUangKeluarAktual;
        const estimasiProfit = biayaJasaBiro;

        const dynamicAlasan = inv.alasanPending || (ord ? `Tahap ${ord.currentStep} (${ord.currentStageName}) — menunggu proses dokumen tuntas` : "Menunggu penyelesaian proses Samsat & biaya final");

        return {
          ...inv,
          pengurusan: inv.jenisLayanan || inv.layanan || "Layanan Samsat",
          totalTagihan,
          totalUangMasuk,
          totalUangKeluarAktual,
          selisihKasSementara,
          estimasiProfit,
          profit: estimasiProfit,
          danaTitipanPajak,
          biayaJasaBiro,
          biayaSamsat: danaTitipanPajak,
          uangMasuk: totalUangMasuk,
          komponenPengeluaran,
          riwayatPembayaran,
          alasan: dynamicAlasan,
          statusPengerjaan: ord ? ord.currentStageName : "Proses Samsat",
          currentStep: ord?.currentStep ?? 4,
          metodePencairan: (ord?.payment?.metodePembayaran || inv.metodePembayaran || "").toLowerCase().includes("cash") ? "Cash" : "Transfer Bank",
          namaBank: (ord?.payment?.metodePembayaran || inv.metodePembayaran || "").toLowerCase().includes("cash") ? "" : (ord?.payment?.namaBank || inv.bank || (inv.metodePembayaran?.includes("BRI") ? "BRI" : inv.metodePembayaran?.includes("Mandiri") ? "Mandiri" : "BCA")),
          nomorRekening: (ord?.payment?.metodePembayaran || inv.metodePembayaran || "").toLowerCase().includes("cash") ? "" : (ord?.payment?.noRekening || (inv as any).noRekening || "772-019-2831"),
          namaPemilikRekening: (ord?.payment?.metodePembayaran || inv.metodePembayaran || "").toLowerCase().includes("cash") ? "" : (ord?.payment?.namaRekening || (inv as any).namaRekening || "PT Biro Jasa SUN89 Abadi"),
          metodePembayaran: ord?.payment?.metodePembayaran || inv.metodePembayaran || (inv.bank ? `Transfer ${inv.bank}` : "Transfer BCA"),
          bank: ord?.payment?.namaBank || inv.bank || (inv.metodePembayaran?.includes("BRI") ? "BRI" : inv.metodePembayaran?.includes("Mandiri") ? "Mandiri" : inv.metodePembayaran?.includes("Cash") ? "Tunai" : "BCA"),
          rekening: (ord?.payment?.metodePembayaran || inv.metodePembayaran || "").toLowerCase().includes("cash") ? "Cash" : (ord?.payment?.namaBank || inv.bank || "BCA"),
          namaRekening: (ord?.payment?.metodePembayaran || inv.metodePembayaran || "").toLowerCase().includes("cash") ? "" : (ord?.payment?.namaRekening || (inv as any).namaRekening || "PT Biro Jasa SUN89 Abadi"),
          noRekening: (ord?.payment?.metodePembayaran || inv.metodePembayaran || "").toLowerCase().includes("cash") ? "" : (ord?.payment?.noRekening || (inv as any).noRekening || "772-019-2831"),
          tanggalUangMasuk: (ord?.payment?.tanggalBayar && ord?.payment?.tanggalBayar !== "-") ? ord.payment.tanggalBayar : (inv.tanggalBayar && inv.tanggalBayar !== "-" ? inv.tanggalBayar : inv.tanggal),
        };
      });
  }

  private dismissedCashbackIds = new Set<string | number>();

  public dismissCashback(id: number | string): void {
    this.dismissedCashbackIds.add(id);
    this.notify();
  }

  public getCashbackPendingList(): any[] {
    const seenOrders = new Set<string>();
    return this.invoices
      .filter((inv) => {
        if (this.dismissedCashbackIds.has(inv.id) || (inv.orderNo && this.dismissedCashbackIds.has(inv.orderNo))) {
          return false;
        }

        const ord = inv.orderNo ? orderRepository.getByOrderNo(inv.orderNo) : null;
        const isCancelled =
          inv.status === "CANCELLED" ||
          inv.billingStatus === "CANCELLED" ||
          Boolean((inv as any).isCancelled) ||
          Boolean(ord && (ord.currentStageName === "Dibatalkan" || (ord as any).isCancelled));

        const paid = Number(ord?.payment?.dibayar ?? inv.terbayar ?? inv.dibayar ?? 0);
        const overpaymentFromInv = Number(inv.overpayment || 0);

        // QC-01 Fix: If order is cancelled and customer has deposited funds, it MUST appear in Cashback Terpending for refund!
        if (isCancelled) {
          const refundable = overpaymentFromInv > 0 ? overpaymentFromInv : paid;
          if (refundable <= 0 || inv.refundStatus === "PROCESSED") {
            return false;
          }
          const key = inv.orderNo || `inv:${inv.id}`;
          if (seenOrders.has(key)) return false;
          seenOrders.add(key);
          return true;
        }

        const biayaPokok = (inv.biayaSamsat !== undefined && inv.biayaSamsat !== null)
          ? Number(inv.biayaSamsat)
          : (Number(ord?.pkb || 0) + Number(ord?.swdkllj || 0) + Number(ord?.dendaSwdkllj || 0));
        const biayaJasa = (ord?.biayaJasa !== undefined && ord?.biayaJasa !== null)
          ? Number(ord.biayaJasa)
          : (Number((inv as any)?.biayaJasa) || Number(inv.profit) || 0);
        const biayaAntarJemput = Number(ord?.biayaAntarJemput ?? (inv as any)?.biayaAntarJemput ?? 0);

        const total = Number(inv.totalTagihan || ord?.payment?.totalBiaya) ||
          (biayaPokok + biayaJasa + biayaAntarJemput);

        const overpayment = Math.max(0, paid - total);
        const legacyCashback = Number(inv.cashback) || 0;

        const hasCashbackPending = legacyCashback > 0 && (inv.cashbackStatus === "PENDING" || inv.cashbackStatus !== "REALIZED");

        // Overpayment belongs in refund list, NOT cashback list (Scenario 12/13 requirement)
        if (!hasCashbackPending) return false;

        // Dedup by orderNo if exists
        const key = inv.orderNo || `inv:${inv.id}`;
        if (seenOrders.has(key)) return false;
        seenOrders.add(key);

        return true;
      })
      .map((inv) => {
        const ord = inv.orderNo ? orderRepository.getByOrderNo(inv.orderNo) : null;
        const isCancelled =
          inv.status === "CANCELLED" ||
          inv.billingStatus === "CANCELLED" ||
          Boolean((inv as any).isCancelled) ||
          Boolean(ord && (ord.currentStageName === "Dibatalkan" || (ord as any).isCancelled));

        const paid = Number(ord?.payment?.dibayar ?? inv.terbayar ?? inv.dibayar ?? 0);
        const biayaPokok = isCancelled ? 0 : ((inv.biayaSamsat !== undefined && inv.biayaSamsat !== null)
          ? Number(inv.biayaSamsat)
          : (Number(ord?.pkb || 0) + Number(ord?.swdkllj || 0) + Number(ord?.dendaSwdkllj || 0)));
        const biayaJasa = isCancelled ? 0 : ((ord?.biayaJasa !== undefined && ord?.biayaJasa !== null)
          ? Number(ord.biayaJasa)
          : (Number((inv as any)?.biayaJasa) || Number(inv.profit) || 0));
        const biayaAntarJemput = isCancelled ? 0 : Number(ord?.biayaAntarJemput ?? (inv as any)?.biayaAntarJemput ?? 0);

        const total = isCancelled ? 0 : (Number(inv.totalTagihan || ord?.payment?.totalBiaya) ||
          (biayaPokok + biayaJasa + biayaAntarJemput));

        const overpayment = isCancelled ? (Number(inv.overpayment) || paid) : Math.max(0, paid - total);
        const komisi = isCancelled ? 0 : ((Number(inv.cashback) > 0 && inv.cashbackStatus !== "REALIZED") ? Number(inv.cashback) : 0);

        const orderNo = inv.orderNo || ord?.orderNo || "-";
        const nopol = ord?.nopol || inv.nopol || "-";
        const customer = ord?.customer || inv.customer || "-";
        const phone = ord?.nomorHP || (inv as any)?.phone || (inv as any)?.noHP || "-";
        const tanggalMasukBerkas = ord?.tanggalMasukBerkas || (inv as any)?.tanggalMasukBerkas || inv.tanggal || "-";
        const pengurusan = isCancelled
          ? `${ord?.layanan || inv.jenisLayanan || inv.layanan || "Layanan Samsat"} (Dibatalkan - Refund)`
          : (ord?.layanan || inv.jenisLayanan || inv.layanan || "Layanan Samsat");

        const totalKewajiban = overpayment > 0 ? overpayment : komisi;
        const statusCashback = (inv as any).statusCashback || ((inv.refundStatus === "PROCESSED" || inv.cashbackStatus === "REALIZED") ? "Dibayar" : "Pending");

        const currentStep = Number(ord?.currentStep ?? (inv as any)?.currentStep ?? 1);
        const currentStageName = ord?.currentStageName || (inv as any)?.currentStageName || "Verifikasi";
        const hasFinalCost = isCancelled ? true : (ord ? Boolean(
          ord.isVerified ||
          (typeof (ord as any).finalCost === "number" && (ord as any).finalCost > 0) ||
          ord.documentApproval?.stage5Verified ||
          (ord.currentStep !== undefined && ord.currentStep >= 6)
        ) : true);

        const isSupervisiApproved = isCancelled ? true : (ord ? Boolean(
          ord.approvedBySpv ||
          ord.documentApproval?.stage6Approved ||
          (ord.currentStep !== undefined && ord.currentStep >= 7)
        ) : true);

        const isPayoutGated = isCancelled ? false : (!hasFinalCost || !isSupervisiApproved);
        let payoutGatingReason = isCancelled ? "Pengembalian dana titipan pembatalan order (Refund)" : "";
        if (!isCancelled) {
          if (!hasFinalCost && !isSupervisiApproved) {
            payoutGatingReason = "Biaya final belum ditetapkan & belum disetujui Supervisi";
          } else if (!hasFinalCost) {
            payoutGatingReason = "Biaya final belum ditetapkan (Stage 5)";
          } else if (!isSupervisiApproved) {
            payoutGatingReason = "Menunggu persetujuan Supervisi (Stage 6)";
          }
        }

        return {
          ...inv,
          orderNo,
          nopol,
          customer,
          phone,
          tanggalMasukBerkas,
          tanggal: tanggalMasukBerkas,
          pengurusan,
          biayaPokokSamsat: biayaPokok,
          biayaJasa,
          biayaAntarJemput,
          totalTagihan: total,
          uangMasuk: paid > 0 ? paid : total,
          nominalKelebihan: overpayment,
          nominalKomisi: komisi,
          jumlahCashback: totalKewajiban,
          cashback: totalKewajiban,
          status: statusCashback,
          statusCashback,
          currentStep,
          currentStageName,
          hasFinalCost,
          isSupervisiApproved,
          isPayoutGated,
          payoutGatingReason,
          alasanPending: (inv as any)?.alasan_pending || (inv as any)?.alasan || (ord as any)?.alasanPending || (overpayment > 0 ? "Kelebihan pembayaran konsumen yang perlu dikembalikan" : "Komisi rekanan"),
          riwayatPembayaran: ord?.payment?.riwayatKoreksiPembayaran || [],
        };
      });
  }

  public getBelumBayarList(): any[] {
    const seenOrders = new Set<string>();
    return this.invoices
      .filter((inv) => {
        // Exclude cancelled invoices/orders
        if (
          inv.status === "CANCELLED" ||
          inv.billingStatus === "CANCELLED" ||
          Boolean((inv as any).isCancelled)
        ) {
          return false;
        }

        const ord = inv.orderNo ? orderRepository.getByOrderNo(inv.orderNo) : null;
        if (ord && (ord.currentStageName === "Dibatalkan" || Boolean((ord as any).isCancelled))) {
          return false;
        }

        const biayaPokok = (inv.biayaSamsat !== undefined && inv.biayaSamsat !== null)
          ? Number(inv.biayaSamsat)
          : (Number(ord?.pkb || 0) + Number(ord?.swdkllj || 0) + Number(ord?.dendaSwdkllj || 0));
        const biayaJasa = (ord?.biayaJasa !== undefined && ord?.biayaJasa !== null)
          ? Number(ord.biayaJasa)
          : (Number((inv as any)?.biayaJasa) || Number(inv.profit) || 0);
        const biayaAntarJemput = Number(ord?.biayaAntarJemput ?? (inv as any)?.biayaAntarJemput ?? 0);

        const total = Number(inv.totalTagihan || ord?.payment?.totalBiaya) ||
          (biayaPokok + biayaJasa + biayaAntarJemput);

        const paid = Number(ord?.payment?.dibayar ?? inv.terbayar ?? inv.dibayar ?? 0);
        const remaining = Math.max(0, total - paid);

        // Filter out zero or lunas
        if (remaining <= 0 || total <= 0) return false;

        // Dedup by orderNo if exists
        const key = inv.orderNo || `inv:${inv.id}`;
        if (seenOrders.has(key)) return false;
        seenOrders.add(key);

        return true;
      })
      .map((inv) => {
        const ord = inv.orderNo ? orderRepository.getByOrderNo(inv.orderNo) : null;

        const biayaPokok = (inv.biayaSamsat !== undefined && inv.biayaSamsat !== null)
          ? Number(inv.biayaSamsat)
          : (Number(ord?.pkb || 0) + Number(ord?.swdkllj || 0) + Number(ord?.dendaSwdkllj || 0));
        const biayaJasa = (ord?.biayaJasa !== undefined && ord?.biayaJasa !== null)
          ? Number(ord.biayaJasa)
          : (Number((inv as any)?.biayaJasa) || Number(inv.profit) || 0);
        const biayaAntarJemput = Number(ord?.biayaAntarJemput ?? (inv as any)?.biayaAntarJemput ?? 0);

        const total = Number(inv.totalTagihan || ord?.payment?.totalBiaya) ||
          (biayaPokok + biayaJasa + biayaAntarJemput);

        const paid = Number(ord?.payment?.dibayar ?? inv.terbayar ?? inv.dibayar ?? 0);
        const remaining = Math.max(0, total - paid);
        const actualStatus: PaymentStatus = paid > 0 ? "Kurang Bayar" : "Belum Bayar";

        const orderNo = inv.orderNo || ord?.orderNo || "-";
        const nopol = ord?.nopol || inv.nopol || "-";
        const customer = ord?.customer || inv.customer || "-";
        const phone = ord?.nomorHP || (inv as any)?.phone || (inv as any)?.noHP || "-";
        const tanggalMasukBerkas = ord?.tanggalMasukBerkas || (inv as any)?.tanggalMasukBerkas || inv.tanggal || "-";
        const pengurusan = ord?.layanan || inv.jenisLayanan || inv.layanan || "Layanan Samsat";
        const statusPengerjaan = (ord as any)?.statusPengerjaan || ord?.currentStageName || "-";
        const alasanPending = (inv as any)?.alasan_pending || (inv as any)?.alasan || (ord as any)?.alasanPending || (ord as any)?.alasan || "Masih terdapat sisa tagihan yang belum dibayar";

        // Phase B Gating: Verify whether final cost is established and Supervisi is approved
        const hasFinalCost = ord ? Boolean(
          ord.isVerified ||
          (typeof (ord as any).finalCost === "number" && (ord as any).finalCost > 0) ||
          ord.documentApproval?.stage5Verified ||
          (ord.currentStep !== undefined && ord.currentStep >= 6)
        ) : true;

        const isSupervisiApproved = ord ? Boolean(
          ord.approvedBySpv ||
          ord.documentApproval?.stage6Approved ||
          (ord.currentStep !== undefined && ord.currentStep >= 7)
        ) : true;

        const isPaymentGated = !hasFinalCost || !isSupervisiApproved;
        let paymentGatingReason = "";
        if (!hasFinalCost && !isSupervisiApproved) {
          paymentGatingReason = "Biaya final belum ditetapkan & belum disetujui Supervisi";
        } else if (!hasFinalCost) {
          paymentGatingReason = "Biaya final belum ditetapkan (Stage 5)";
        } else if (!isSupervisiApproved) {
          paymentGatingReason = "Menunggu persetujuan Supervisi (Stage 6)";
        }

        return {
          ...inv,
          orderNo,
          nopol,
          customer,
          phone,
          tanggalMasukBerkas,
          tanggal: tanggalMasukBerkas,
          pengurusan,
          totalTagihan: total,
          uangMasuk: paid,
          terbayar: paid,
          dibayar: paid,
          sisa: remaining,
          kekurangan: remaining,
          sisaTagihan: remaining,
          status: actualStatus,
          statusPengerjaan,
          alasanPending,
          alasan: alasanPending,
          riwayatPembayaran: ord?.payment?.riwayatKoreksiPembayaran || [],
          hasFinalCost,
          isSupervisiApproved,
          isPaymentGated,
          paymentGatingReason,
          spvApprovedAt: ord?.spvApprovedAt || ord?.documentApproval?.stage6ApprovedAt || null,
          spvName: ord?.spvName || ord?.documentApproval?.stage6ApprovedBy || null,
        };
      });
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

  public getLabaRugiData(): LabaRugiMonthlyItem[] {
    return this.labaRugiData;
  }

  public getCanonicalLabaRugi(
    periodFilter: string = "monthly",
    customStartDate?: string,
    customEndDate?: string
  ): CanonicalLabaRugiSummary {
    return computeCanonicalLabaRugi(
      this.invoices,
      this.pengeluaran,
      this.kasMessenger,
      periodFilter,
      this.profitData,
      customStartDate,
      customEndDate,
      this.kasKantor
    );
  }

  public getCashFlowReconciliation(
    periodFilter: string = "monthly",
    customStartDate?: string,
    customEndDate?: string
  ): CashFlowReconciliationSummary {
    return computeCashFlowReconciliation(
      this.kasKantor,
      this.kasMessenger,
      periodFilter,
      customStartDate,
      customEndDate
    );
  }

  public syncInvoicesFromExternal(externalInvoices: InvoiceBillingRecord[]): void {
    if (!Array.isArray(externalInvoices) || externalInvoices.length === 0) return;
    externalInvoices.forEach((extInv) => {
      const idx = this.invoices.findIndex(
        (inv) => inv.id === extInv.id || inv.invoice === (extInv.invoiceNo || (extInv as any).invoice)
      );
      if (idx !== -1) {
        this.invoices[idx] = { ...this.invoices[idx], ...extInv };
      } else {
        this.invoices.unshift(extInv);
      }
    });
    this.notify();
  }

  // Synchronized contract data for DataPenjualan
  public getContractData(category: PenjualanContractCategory): any[] {
    if (category === "belum-kurang-bayar") {
      return this.getBelumBayarList().map((inv) => ({
        id: inv.id,
        "Tanggal Masuk Berkas": inv.tanggal,
        "R4 / R2": inv.r4r2 || "R4",
        "Plat No": inv.nopol,
        "Nama Customer": inv.customer,
        "Nama Pemilik (STNK/BPKB)": inv.namaBerkas || "-",
        Nama: inv.namaBerkas || "-",
        "Jenis Pengurusan": inv.pengurusan || inv.jenisLayanan,
        Samsat: inv.samsat || "Samsat",
        "Skema Pembayaran": inv.metodePembayaran || "Tempo",
        "Jenis Bayar": inv.metodePembayaran || "Tempo",
        "Tanggal Uang Masuk": inv.terbayar > 0 ? inv.tanggal : "-",
        "Uang Masuk dari Konsumen": inv.terbayar,
        "Bank Uang Keluar": inv.bank || "Kas Kantor",
        "Tanggal Uang Keluar": inv.tanggal,
        "Biaya Pokok Samsat": inv.biayaSamsat || 0,
        "Uang Keluar dari Biro Jasa": inv.biayaSamsat || 0,
        Profit: inv.profit || 0,
        Status: inv.status,
        "Status Pembayaran": inv.status,
        "No Invoice": inv.invoice,
        "Tanda Terima": inv.tandaTerima || "-",
        BPKB: inv.bpkb || "Ada",
        "TTB BPKB": inv.ttbBPKB || "-",
        Kekurangan: inv.kekurangan,
      }));
    }

    if (category === "profit-terpending") {
      return this.getProfitPendingList().map((inv) => ({
        id: inv.id,
        "Tanggal Masuk Berkas": inv.tanggal,
        "R4 / R2": inv.r4r2 || "R4",
        "Plat No": inv.nopol,
        "Nama Customer": inv.customer,
        "Nama Pemilik (STNK/BPKB)": inv.namaBerkas || "-",
        Nama: inv.namaBerkas || "-",
        "Jenis Pengurusan": inv.pengurusan || inv.jenisLayanan,
        Samsat: inv.samsat || "Samsat",
        "Skema Pembayaran": inv.metodePembayaran || "Transfer",
        "Jenis Bayar": inv.metodePembayaran || "Transfer",
        "Tanggal Uang Masuk": inv.tanggal,
        "Uang Masuk dari Konsumen": inv.totalUangMasuk,
        "Bank Uang Keluar": inv.bank || "BCA",
        "Tanggal Uang Keluar": inv.tanggal,
        "Biaya Pokok Samsat": inv.totalUangKeluarAktual,
        "Uang Keluar dari Biro Jasa": inv.totalUangKeluarAktual,
        Profit: inv.estimasiProfit,
        Status: "Pending",
        "Status Pembayaran": "Lunas",
        "No Invoice": inv.invoice,
        "Tanda Terima": inv.tandaTerima || "-",
        Alasan: inv.alasan || "Menunggu proses Samsat & biaya final",
      }));
    }

    if (category === "cashback-terpending") {
      return this.getCashbackPendingList().map((inv) => ({
        id: inv.id,
        "Tanggal Masuk Berkas": inv.tanggal,
        "R4 / R2": inv.r4r2 || "R4",
        "Plat No": inv.nopol,
        "Nama Customer": inv.customer,
        "Nama Pemilik (STNK/BPKB)": inv.namaBerkas || "-",
        Nama: inv.namaBerkas || "-",
        "Jenis Pengurusan": inv.pengurusan || inv.jenisLayanan,
        Samsat: inv.samsat || "Samsat",
        "Skema Pembayaran": inv.metodePembayaran || "Transfer",
        "Jenis Bayar": inv.metodePembayaran || "Transfer",
        "Tanggal Uang Masuk": inv.tanggal,
        "Uang Masuk dari Konsumen": inv.uangMasuk,
        "Bank Uang Keluar": inv.bank || "BCA",
        "Tanggal Uang Keluar": inv.tanggal,
        "Biaya Pokok Samsat": inv.biayaSamsat || 0,
        "Uang Keluar dari Biro Jasa": inv.biayaSamsat || 0,
        Profit: inv.profit || 0,
        Status: "Pending",
        "Status Pembayaran": "Lunas",
        "No Invoice": inv.invoice,
        "Tanda Terima": inv.tandaTerima || "-",
        "Jumlah Cashback": inv.jumlahCashback,
        "Cashback Persen": inv.cashbackPersen || "3.5%",
      }));
    }

    // Operational categories: 7 Canonical Services (with legacy fallback)
    const legacyRedirectMap: Record<string, string> = {
      "mutasi-ld": "mutasi-antar-daerah",
      "mutasi-as": "mutasi-asal",
      bbn: "balik-nama",
      "perpanjangan-pajak": "perpanjangan-1-tahun",
      "lain-lain": "tarik-berkas",
    };
    const targetCategory = legacyRedirectMap[category] || category;

    const rawAllOrders = orderRepository.getAllFlat();
    const seenOrderNos = new Set<string>();
    const allOrders = rawAllOrders.filter((o) => {
      if (!o.orderNo) return true;
      const cleanUpper = o.orderNo.toUpperCase();
      if (this.deletedOrderNos.has(cleanUpper)) return false;
      if (seenOrderNos.has(o.orderNo)) return false;
      seenOrderNos.add(o.orderNo);
      return true;
    });
    const matchingOrders = allOrders.filter(
      (order) => resolveOrderSalesCategory(order.layanan, (order as any).serviceId) === targetCategory
    );

    const archivedOrders = typeof orderRepository.getArchivedOrders === "function" ? orderRepository.getArchivedOrders() : [];
    const archivedOrderNos = new Set(archivedOrders.map((o) => o.orderNo));

    const projectedRows = matchingOrders.map((order) => {
      // Strict linking: Invoices must only be linked via orderNo or invoice identifier (never by nopol or customer name)
      const linkedInvoice = this.invoices.find(
        (inv) =>
          (inv.orderNo && inv.orderNo === order.orderNo) ||
          (order.payment?.invoiceNo &&
            (inv.invoice === order.payment.invoiceNo || inv.invoiceNo === order.payment.invoiceNo))
      );
      const isArchived = archivedOrderNos.has(order.orderNo) || Boolean((order as any).isArchived);
      return projectOrderToContractRow(order, linkedInvoice, isArchived);
    });

    const manualOrFixtureData = [
      ...(this.contractDatasets[targetCategory as PenjualanContractCategory] || []),
      ...(targetCategory !== category ? (this.contractDatasets[category] || []) : []),
    ];

    if (this.isApiMode) {
      // In API Mode: ONLY show live projected orders and any runtime additions (no mock fixtures)
      const mappedManual = manualOrFixtureData.map((row: any) => ({
        ...row,
        "Status Pengerjaan": row["Status Pengerjaan"] || "-",
        "Status Pembayaran": row["Status Pembayaran"] || "Tagihan Tidak Tersedia",
        Status: row["Status"] || row["Status Pengerjaan"] || "-",
      }));
      return [...projectedRows, ...mappedManual];
    }

    // In Mock Mode: Show live projected orders deduplicated against legacy fixtures
    const projectedOrderNos = new Set(projectedRows.map((r) => r.orderNo));
    const filteredFixtures = manualOrFixtureData.filter(
      (row: any) => !row.orderNo || !projectedOrderNos.has(row.orderNo)
    );

    // Apply neutral fallback for legacy mock fixtures (never fabricated progress)
    const mappedFixtures = filteredFixtures.map((row: any) => {
      const statusPengerjaan = row["Status Pengerjaan"] || "-";
      let statusPembayaran = row["Status Pembayaran"];
      if (!statusPembayaran) {
        const inv = this.invoices.find(
          (i) => row["No Invoice"] && (i.invoice === row["No Invoice"] || i.invoiceNo === row["No Invoice"])
        );
        statusPembayaran = inv ? deriveStatusPembayaran(inv) : "Tagihan Tidak Tersedia";
      }
      return {
        ...row,
        "Status Pengerjaan": statusPengerjaan,
        "Status Pembayaran": statusPembayaran,
        Status: row["Status"] || statusPengerjaan,
      };
    });

    return [...projectedRows, ...mappedFixtures];
  }

  // =========================================================================
  // CORE OPERATIONS (PAYMENT REALIZATION & PREVENTING DUPLICATE CASH INFLOW)
  // =========================================================================

  /**
   * Record a payment (full or partial) on an invoice.
   * Authoritatively updates invoice, realizes cash in Kas Kantor, and marks profit realized if fully paid.
   */
  public async recordPayment(
    invoiceId: number | string,
    amount: number,
    options?: { paymentMethod?: string; bank?: string; tanggal?: string; skipAudit?: boolean; buktiPembayaran?: any; catatan?: string; idempotencyKey?: string }
  ): Promise<boolean> {
    if (amount <= 0) return false;

    if (this.isApiMode) {
      const ok = await Promise.resolve(financeRepository.recordPayment(invoiceId, amount, options));
      if (ok) {
        this.syncFromRepository();
        const matched = this.invoices.find(
          (inv) => inv.id === invoiceId || inv.invoice === String(invoiceId) || inv.invoiceNo === String(invoiceId)
        );
        if (matched) {
          this.notifyPaymentSync(matched);
        }
      }
      return !!ok;
    }

    const idx = this.invoices.findIndex((inv) => inv.id === invoiceId || inv.invoice === String(invoiceId));
    if (idx === -1) return false;

    const record = this.invoices[idx];
    const newTerbayar = Math.min(record.totalTagihan, record.terbayar + amount);
    const newSisa = Math.max(0, record.totalTagihan - newTerbayar);
    const newStatus = derivePaymentStatus(record.totalTagihan, newTerbayar);

    // REALIZATION RULE: Calculate cash newly received into company cash
    const cashDelta = newTerbayar - record.cashRecordedAmount;

    // PREVENT DUPLICATE CASH INFLOW: Only debit Kas Kantor if cash was NOT already recorded
    if (cashDelta > 0) {
      const lastTotal = this.kasKantor.length > 0 ? this.kasKantor[this.kasKantor.length - 1].total : 0;
      const paymentDate = options?.tanggal || new Date().toLocaleDateString("id-ID");
      const bankName = options?.bank || record.bank || "Kas Kantor";

      const kasEntry: KasKantorItem = {
        id: this.kasCounter++,
        tanggal: paymentDate,
        status: "Debit",
        keterangan: `Pelunasan: ${record.invoice} - ${record.customer} (${record.nopol} / ${bankName})`,
        debit: cashDelta,
        kredit: 0,
        total: lastTotal + cashDelta,
        invoiceRef: record.invoice,
      };

      this.kasKantor.push(kasEntry);
      record.cashRecordedAmount = newTerbayar;
      record.isCashRealized = true;
    }

    record.terbayar = newTerbayar;
    record.sisa = newSisa;
    record.status = newStatus;
    if (options?.paymentMethod) record.metodePembayaran = options.paymentMethod;
    if (options?.bank) record.bank = options.bank;

    // If fully paid, mark billing lifecycle completed so active tagihan clears
    if (newStatus === "Lunas" && newSisa === 0) {
      record.billingStatus = "COMPLETED";
      record.completedAt = new Date().toISOString();
      record.completedBy = options?.bank || "Finance Admin";
    }

    // Profit realization rule: Bayar di Awal must NOT finalize profit before Stage 5!
    // Profit and cashback can only be marked REALIZED once finalCost is determined at Stage 5.
    const isFinalized = record.settlementCondition && record.settlementCondition !== "PENDING_FINALIZATION";
    if (newStatus === "Lunas" && isFinalized) {
      record.profitStatus = "REALIZED";
      record.cashbackStatus = "REALIZED";

      // Also append or synchronize with profitData if not already present
      const alreadyInProfit = this.profitData.some((p) => p.invoice === record.invoice || p.nopol === record.nopol);
      if (!alreadyInProfit) {
        this.profitData.unshift({
          id: this.profitData.length + 1,
          tanggal: record.tanggal,
          nopol: record.nopol,
          customer: record.customer,
          namaBerkas: record.namaBerkas || "-",
          pengurusan: record.jenisLayanan,
          uangMasuk: record.totalTagihan,
          biayaSamsat: record.biayaSamsat,
          profit: record.profit,
          rekening: record.bank || "BCA",
          invoice: record.invoice,
          tanggalTTB: record.tanggal,
          ttb: `TTB_${record.invoice.replace(/[^0-9]/g, "") || "001"}`,
        });
      }
    } else {
      record.profitStatus = "PENDING";
      record.cashbackStatus = "PENDING";
      record.alasanPending = !isFinalized
        ? "Menunggu verifikasi biaya final di Stage 5"
        : "Menunggu pelunasan pembayaran";
    }

    // Synchronize corresponding Penjualan contract row if it exists
    this.syncContractRowFromInvoice(record);

    if (!options?.skipAudit) {
      try {
        auditLog.log({
          userId: "usr-finance",
          userName: "Finance User",
          userRole: "finance",
          action: "UPDATE",
          module: "Finance - Kas Kantor",
          details: `Pencatatan pembayaran ${record.invoice} (${record.customer}): Rp ${amount.toLocaleString('id-ID')} (${newStatus})`,
          metadata: { invoice: record.invoice, amount, status: newStatus },
        });
      } catch {
        // safe fallback
      }
    }

    this.notifyPaymentSync(record);
    this.notify();
    return true;
  }

  /**
   * Action "Selesaikan" for a paid or completing invoice.
   * Settles any remaining balance, debits only the actual remaining cash delta to Kas Kantor,
   * and transitions profit & cashback to REALIZED.
   */
  public resolveInvoice(
    invoiceId: number | string,
    options?: { paymentMethod?: string; bank?: string; skipAudit?: boolean }
  ): boolean {
    const idx = this.invoices.findIndex((inv) => inv.id === invoiceId || inv.invoice === String(invoiceId));
    if (idx === -1) return false;

    const record = this.invoices[idx];
    const remainingBalance = record.sisa;

    // If there is still unpaid balance, record it as cash received
    if (remainingBalance > 0) {
      void this.recordPayment(invoiceId, remainingBalance, options);
      return true;
    }

    // If already fully paid financially, ensure profit and cashback are marked REALIZED
    record.status = "Lunas";
    record.profitStatus = "REALIZED";
    record.cashbackStatus = "REALIZED";
    this.syncContractRowFromInvoice(record);

    if (!options?.skipAudit) {
      try {
        auditLog.log({
          userId: "usr-finance",
          userName: "Finance User",
          userRole: "finance",
          action: "UPDATE",
          module: "Finance - Tagihan",
          details: `Pelunasan tagihan invoice ${record.invoice} (${record.customer})`,
          metadata: { invoice: record.invoice, customer: record.customer },
        });
      } catch {
        // safe fallback
      }
    }

    this.notifyPaymentSync(record);
    this.notify();
    return true;
  }

  /**
   * Action "Selesai" for Tagihan lifecycle (Requirement 3).
   * Transitions an invoice to COMPLETED lifecycle status so it is archived from active billing.
   * This is NOT a delete; historical financial record and ledger entries are completely preserved.
   */
  public completeInvoice(
    invoiceId: number | string,
    completedBy?: string
  ): boolean {
    const idx = this.invoices.findIndex((inv) => inv.id === invoiceId || inv.invoice === String(invoiceId) || inv.invoiceNo === String(invoiceId));
    if (idx === -1) return false;

    const record = this.invoices[idx];
    if (record.billingStatus === "COMPLETED") return true;

    // If not already Lunas, resolve payment first to ensure financial integrity
    if (record.status !== "Lunas") {
      this.resolveInvoice(invoiceId, { skipAudit: true });
    }

    record.billingStatus = "COMPLETED";
    record.completedAt = new Date().toISOString();
    record.completedBy = completedBy || "Admin";

    if (this.isApiMode && typeof (financeRepository as any).completeInvoice === "function") {
      financeRepository.completeInvoice(Number(record.id), completedBy);
    }

    try {
      auditLog.log({
        userId: "usr-finance",
        userName: completedBy || "Finance User",
        userRole: "finance",
        action: "UPDATE",
        module: "Finance - Tagihan",
        details: `Tagihan invoice ${record.invoice} (${record.customer}) diselesaikan`,
        metadata: { invoice: record.invoice, customer: record.customer },
      });
    } catch {
      // safe fallback
    }

    this.notifyPaymentSync(record);
    this.notify();
    return true;
  }

  /**
   * Process refund for overpaid order (Section 10).
   * Deducts refund from Kas Kantor as Kredit, marks refundStatus = "PROCESSED".
   * Never creates negative tagihan or decreases revenue erroneously.
   */
  public processRefund(invoiceId: number | string, processedBy: string = "Finance"): boolean {
    const idx = this.invoices.findIndex((inv) => inv.id === invoiceId || inv.invoice === String(invoiceId));
    if (idx === -1) return false;
    const record = this.invoices[idx];
    const refundAmount = record.overpayment || 0;
    if (refundAmount <= 0 || record.refundStatus === "PROCESSED") return false;

    record.refundStatus = "PROCESSED";
    record.settlementCondition = "SETTLED";

    const lastTotal = this.kasKantor.length > 0 ? this.kasKantor[this.kasKantor.length - 1].total : 0;
    this.kasKantor.push({
      id: this.kasCounter++,
      tanggal: new Date().toLocaleDateString("id-ID"),
      status: "Kredit",
      keterangan: `Refund kelebihan bayar: ${record.invoice} - ${record.customer} (${record.nopol})`,
      debit: 0,
      kredit: refundAmount,
      total: lastTotal - refundAmount,
      invoiceRef: record.invoice,
    });

    try {
      auditLog.log({
        userId: "usr-finance",
        userName: processedBy,
        userRole: "finance",
        action: "UPDATE",
        module: "Finance - Kas Kantor",
        details: `Proses refund kelebihan bayar ${record.invoice} (${record.customer}): Rp ${refundAmount.toLocaleString("id-ID")}`,
        metadata: { invoice: record.invoice, refundAmount },
      });
    } catch {
      // safe fallback
    }

    this.notifyPaymentSync(record);
    this.notify();
    return true;
  }

  /**
   * Settle / Pay cashback or refund overpayment.
   * Debits single Kredit to Kas Kantor, marks cashbackStatus = "REALIZED" (or refundStatus = "PROCESSED"),
   * logs to audit log, and notifies listeners without creating duplicate cash outflow.
   */
  public async processCashbackPayment(
    invoiceId: number | string,
    options?: {
      processedBy?: string;
      nominal?: number;
      tanggal?: string;
      catatan?: string;
      bukti?: string;
      buktiPembayaran?: any;
      penerima?: string;
      nomorHP?: string;
      bank?: string;
      noRekening?: string;
      namaRekening?: string;
      paymentType?: "ALL" | "KOMISI" | "KELEBIHAN";
      paymentMethod?: string;
      idempotencyKey?: string;
      expectedVersion?: number;
    }
  ): Promise<boolean> {
    const idx = this.invoices.findIndex((inv) => inv.id === invoiceId || inv.invoice === String(invoiceId) || inv.invoiceNo === String(invoiceId));
    if (idx === -1) {
      // Graceful fallback for mock/preview items
      const isCashFallback = options?.paymentMethod?.toLowerCase().includes("tunai") ||
                             options?.paymentMethod?.toLowerCase().includes("cash") ||
                             options?.bank?.toLowerCase().includes("tunai") ||
                             options?.bank?.toLowerCase().includes("cash");
      const payoutNominal = (options?.nominal !== undefined && Number(options.nominal) > 0)
        ? Number(options.nominal)
        : 250000;
      const lastTotal = this.kasKantor.length > 0 ? this.kasKantor[this.kasKantor.length - 1].total : 0;
      this.kasKantor.push({
        id: this.kasCounter++,
        tanggal: options?.tanggal || new Date().toISOString().split("T")[0],
        kategori: "PENGELUARAN",
        tipe: "OPERASIONAL",
        keterangan: `Pencairan cashback / refund: ${options?.penerima || "Konsumen"} (${isCashFallback ? "Tunai - Kas Kantor" : options?.bank || "Transfer"})`,
        debit: 0,
        kredit: payoutNominal,
        masuk: 0,
        keluar: payoutNominal,
        total: Math.max(0, lastTotal - payoutNominal),
        status: "Tercatat",
        metode: isCashFallback ? "Tunai" : (options?.paymentMethod || "Transfer Bank"),
        bank: isCashFallback ? "Tunai" : (options?.bank || "BCA"),
      });
      this.notify();
      return true;
    }
    const record = this.invoices[idx];

    const proof = options?.buktiPembayaran || (options?.bukti ? {
      fileUrl: options.bukti,
      fileName: "Bukti_Pencairan",
      fileType: "image",
    } : null);

    const total = Number(record.totalTagihan) || 0;
    const paid = Number(record.terbayar ?? record.dibayar) || 0;
    const overpayment = Number(record.overpayment) > 0 ? Number(record.overpayment) : Math.max(0, paid - total);
    const komisi = Number(record.cashback) || 0;

    const pType = options?.paymentType || (overpayment > 0 && komisi === 0 ? "KELEBIHAN" : (komisi > 0 && overpayment === 0 ? "KOMISI" : "ALL"));
    const calculatedAmount = pType === "KELEBIHAN" ? overpayment : (pType === "KOMISI" ? komisi : (overpayment + komisi));
    const amountToPay = (options?.nominal !== undefined && Number(options.nominal) > 0)
      ? Number(options.nominal)
      : calculatedAmount;

    if (amountToPay <= 0) return false;

    const isCash = options?.paymentMethod?.toLowerCase().includes("tunai") ||
                   options?.paymentMethod?.toLowerCase().includes("cash") ||
                   options?.bank?.toLowerCase().includes("tunai") ||
                   options?.bank?.toLowerCase().includes("cash") ||
                   options?.bank === "Kas Kantor" ||
                   options?.bank === "—" ||
                   options?.bank === "-";

    if (this.isApiMode && typeof (financeRepository as any).payoutCashback === "function") {
      try {
        await (financeRepository as any).payoutCashback(Number(record.id), {
          nominal: amountToPay,
          paymentType: pType,
          penerima: options?.penerima || record.customer,
          nomorHP: options?.nomorHP || record.phone || "-",
          bank: isCash ? "Tunai" : (options?.bank || "BCA"),
          noRekening: isCash ? "" : (options?.noRekening || ""),
          namaRekening: isCash ? "" : (options?.namaRekening || options?.penerima || record.customer),
          paymentMethod: options?.paymentMethod || (isCash ? "Cash" : "Transfer Bank"),
          buktiPembayaran: proof,
          catatan: options?.catatan,
          tanggal: options?.tanggal || new Date().toISOString().split("T")[0],
          idempotencyKey: options?.idempotencyKey,
          expectedVersion: options?.expectedVersion,
        });
        this.syncFromRepository();
        return true;
      } catch (err) {
        console.error("payoutCashback in financeStore failed:", err);
        throw err;
      }
    }

    if (pType === "KELEBIHAN" || pType === "ALL") {
      record.refundStatus = "PROCESSED";
    }
    if (pType === "KOMISI" || pType === "ALL") {
      record.cashbackStatus = "REALIZED";
    }

    const lastTotal = this.kasKantor.length > 0 ? this.kasKantor[this.kasKantor.length - 1].total : 0;
    const desc = pType === "KELEBIHAN"
      ? `Pengembalian kelebihan bayar: ${record.invoice || record.invoiceNo} - ${record.customer} (${record.nopol})`
      : (pType === "KOMISI"
          ? `Pencairan komisi rekanan: ${record.invoice || record.invoiceNo} - ${record.customer} (${record.nopol})`
          : `Pencairan cashback & refund: ${record.invoice || record.invoiceNo} - ${record.customer} (${record.nopol})`);

    this.kasKantor.push({
      id: this.kasCounter++,
      tanggal: options?.tanggal || new Date().toLocaleDateString("id-ID"),
      status: "Kredit",
      keterangan: desc,
      debit: 0,
      kredit: amountToPay,
      total: lastTotal - amountToPay,
      invoiceRef: record.invoice || record.invoiceNo,
    });

    try {
      auditLog.log({
        userId: "usr-finance",
        userName: options?.processedBy || "Finance Admin",
        userRole: "finance",
        action: "UPDATE",
        module: "Finance - Cashback",
        details: `${desc}: Rp ${amountToPay.toLocaleString("id-ID")}`,
        metadata: { invoice: record.invoice, amount: amountToPay, type: pType },
      });
    } catch {}

    this.notifyPaymentSync(record);
    this.notify();
    return true;
  }

  public async voidInvoicePayment(invoiceId: number | string, paymentId: number, reason: string): Promise<boolean> {
    if (this.isApiMode) {
      try {
        const ok = await financeRepository.voidInvoicePayment(Number(invoiceId), paymentId, reason);
        if (!ok) {
          throw new Error("Provider keuangan aktif tidak mendukung pembatalan (Void) pembayaran.");
        }
        this.syncFromRepository();
        return true;
      } catch (err) {
        console.error("voidInvoicePayment in financeStore failed:", err);
        throw err;
      }
    }
    const idx = this.invoices.findIndex((inv) => inv.id === invoiceId || inv.invoice === String(invoiceId) || inv.invoiceNo === String(invoiceId));
    if (idx !== -1) {
      this.invoices[idx].status = "Belum Lunas";
      this.notify();
    }
    return true;
  }

  public async voidCashbackPayout(invoiceId: number | string, reason: string): Promise<boolean> {
    if (this.isApiMode) {
      try {
        const ok = await financeRepository.voidCashbackPayout(Number(invoiceId), reason);
        if (!ok) {
          throw new Error("Provider keuangan aktif tidak mendukung pembatalan (Void) cashback.");
        }
        this.syncFromRepository();
        return true;
      } catch (err) {
        console.error("voidCashbackPayout in financeStore failed:", err);
        throw err;
      }
    }
    const idx = this.invoices.findIndex((inv) => inv.id === invoiceId || inv.invoice === String(invoiceId) || inv.invoiceNo === String(invoiceId));
    if (idx !== -1) {
      this.invoices[idx].refundStatus = "PENDING";
      this.invoices[idx].cashbackStatus = "PENDING";
      this.notify();
    }
    return true;
  }

  public async getVoidAuditHistory(): Promise<{ payments: any[]; cashbacks: any[] }> {
    if (this.isApiMode) {
      try {
        return await financeRepository.getVoidAuditHistory();
      } catch (err) {
        console.error("getVoidAuditHistory failed:", err);
        throw err;
      }
    }
    return { payments: [], cashbacks: [] };
  }

  /**
   * Update an invoice when costs are recalculated from operational Order (e.g. Stage 5 Verifikasi Ulang)
   * Prevents revenue leakage and synchronizes remaining balance deterministically.
   */
  public updateInvoiceFromOrder(
    orderNo: string,
    updates: Partial<InvoiceBillingRecord> & {
      totalTagihan?: number;
      biayaSamsat?: number;
      profit?: number;
      costItems?: any[];
      settlementCondition?: SettlementCondition;
      refundStatus?: RefundStatus;
      overpayment?: number;
      dueTrigger?: PaymentDueTrigger;
      collectionStatus?: CollectionState;
      terbayar?: number;
      dibayar?: number;
      sisa?: number;
      status?: PaymentStatus;
      alasan_pending?: string;
      alasanPending?: string;
      alasan?: string;
    }
  ): InvoiceBillingRecord | null {
    const idx = this.invoices.findIndex((inv) => inv.orderNo === orderNo);
    if (idx === -1) return null;

    const record = this.invoices[idx];
    const newTotal = updates.totalTagihan !== undefined ? updates.totalTagihan : record.totalTagihan;
    const currentPaid = (updates as any).terbayar !== undefined ? (updates as any).terbayar : record.terbayar;
    const newSisa = (updates as any).sisa !== undefined ? (updates as any).sisa : Math.max(0, newTotal - currentPaid);
    const newOverpayment = (updates as any).overpayment !== undefined ? (updates as any).overpayment : Math.max(0, currentPaid - newTotal);
    const newStatus = (updates as any).status || derivePaymentStatus(newTotal, currentPaid);

    record.totalTagihan = newTotal;
    record.terbayar = currentPaid;
    record.dibayar = currentPaid;
    record.sisa = newSisa;
    record.overpayment = newOverpayment;
    record.status = newStatus;
    if (updates.biayaSamsat !== undefined) record.biayaSamsat = updates.biayaSamsat;
    if (updates.profit !== undefined) record.profit = updates.profit;

    if (updates.settlementCondition !== undefined) record.settlementCondition = updates.settlementCondition;
    if (updates.refundStatus !== undefined) record.refundStatus = updates.refundStatus;
    if (updates.overpayment !== undefined) record.overpayment = updates.overpayment;
    if (updates.dueTrigger !== undefined) record.dueTrigger = updates.dueTrigger;
    if (updates.collectionStatus !== undefined) record.collectionStatus = updates.collectionStatus;

    const settlementCond = updates.settlementCondition || record.settlementCondition;
    const isFinalized = settlementCond && settlementCond !== "PENDING_FINALIZATION";
    const isProfitRealized = newStatus === "Lunas" && isFinalized;

    if (isProfitRealized) {
      record.profitStatus = "REALIZED";
      record.cashbackStatus = "REALIZED";
      if (!record.collectionStatus) record.collectionStatus = "LUNAS";

      const existingProfitIdx = this.profitData.findIndex(
        (p) => p.invoice === record.invoice || (record.nopol && p.nopol === record.nopol)
      );
      if (existingProfitIdx >= 0) {
        this.profitData[existingProfitIdx] = {
          ...this.profitData[existingProfitIdx],
          uangMasuk: newTotal, // Final cost (strictly excludes overpayment)
          biayaSamsat: record.biayaSamsat,
          profit: record.profit,
        };
      } else {
        this.profitData.unshift({
          id: this.profitData.length + 1,
          tanggal: record.tanggal,
          nopol: record.nopol,
          customer: record.customer,
          namaBerkas: record.namaBerkas || "-",
          pengurusan: record.jenisLayanan,
          uangMasuk: newTotal, // Final cost (strictly excludes overpayment)
          biayaSamsat: record.biayaSamsat,
          profit: record.profit,
          rekening: record.bank || "BCA",
          invoice: record.invoice,
          tanggalTTB: record.tanggal,
          ttb: `TTB_${record.invoice.replace(/[^0-9]/g, "") || "001"}`,
        });
      }
    } else {
      record.profitStatus = "PENDING";
      record.cashbackStatus = "PENDING";
    }

    this.syncContractRowFromInvoice(record);
    // Downstream Order -> Finance sync must not echo back via notifyPaymentSync(),
    // otherwise orderStore.syncPaymentFromFinance fires a duplicate PUT after /verify-payment or /advance.
    this.notify();
    return record;
  }

  /**
   * Synchronize an Invoice update into the matching Penjualan contract datasets
   */
  private syncContractRowFromInvoice(record: InvoiceBillingRecord): void {
    const categories: PenjualanContractCategory[] = [
      "perpanjangan-1-tahun",
      "perpanjangan-5-tahun",
      "mutasi-asal",
      "mutasi-antar-daerah",
      "balik-nama",
      "tarik-berkas",
      "duplikat-stnk",
      "mutasi-ld",
      "mutasi-as",
      "bbn",
      "perpanjangan-pajak",
      "lain-lain",
    ];
    categories.forEach((cat) => {
      const dataset = this.contractDatasets[cat];
      const foundIdx = dataset.findIndex(
        (row) => row["No Invoice"] === record.invoice || (row.orderNo && row.orderNo === record.orderNo)
      );
      if (foundIdx !== -1) {
        const statusPembayaran = deriveStatusPembayaran(record);
        dataset[foundIdx]["Status Pembayaran"] = statusPembayaran;
        dataset[foundIdx]["Status"] = dataset[foundIdx]["Status Pengerjaan"] || statusPembayaran;
        dataset[foundIdx]["Uang Masuk dari Konsumen"] = record.terbayar;
      }
    });
  }

  // ==========================================
  // INVOICE CRUD
  // ==========================================

  public addInvoice(data: Partial<InvoiceBillingRecord>): InvoiceBillingRecord {
    // Decision 1: Jangan buat invoice ganda untuk Order yang sama.
    if (data.orderNo) {
      const existing = this.invoices.find(
        (inv) => inv.orderNo === data.orderNo && inv.billingStatus !== "ARCHIVED" && inv.billingStatus !== "CANCELLED"
      );
      if (existing) {
        // Return existing authoritative invoice to prevent duplicates
        return existing;
      }
    }

    const total = data.totalTagihan || 0;
    const paid = data.terbayar || 0;
    const status = derivePaymentStatus(total, paid);
    const isLunas = status === "Lunas";

    const newRecord: InvoiceBillingRecord = {
      id: this.invoiceCounter++,
      tanggal: data.tanggal || new Date().toLocaleDateString("id-ID"),
      customer: data.customer || "Pelanggan Baru",
      nopol: (data.nopol || "B 0000 XXX").toUpperCase(),
      jenisLayanan: data.jenisLayanan || "Pajak Tahunan",
      totalTagihan: total,
      terbayar: paid,
      sisa: Math.max(0, total - paid),
      status,
      billingStatus: data.billingStatus || "ACTIVE",
      jatuhTempo: data.jatuhTempo || new Date().toLocaleDateString("id-ID"),
      invoice: data.invoice !== undefined ? data.invoice : `INV-${new Date().getFullYear()}-${String(this.invoiceCounter).padStart(4, "0")}`,
      orderNo: data.orderNo,
      phone: data.phone?.trim() ? data.phone.trim() : undefined,
      email: data.email,
      alamat: data.alamat,
      biayaSamsat: data.biayaSamsat !== undefined ? Number(data.biayaSamsat) : 0,
      profit: data.profit !== undefined
        ? Number(data.profit)
        : calculateInvoiceProfitMetrics({
            dibayar: paid,
            totalTagihan: total,
            biayaSamsat: data.biayaSamsat !== undefined ? Number(data.biayaSamsat) : 0,
            biayaAntarJemput: (data as any).biayaAntarJemput,
            cashback: data.cashback,
          }).grossServiceMargin,
      profitStatus: isLunas && data.settlementCondition !== "PENDING_FINALIZATION" ? "REALIZED" : "PENDING",
      cashback: data.cashback || 0,
      cashbackStatus: data.cashbackStatus || (isLunas && data.settlementCondition !== "PENDING_FINALIZATION" ? "REALIZED" : "PENDING"),
      isCashRealized: paid > 0,
      cashRecordedAmount: paid, // Set recorded amount to prevent double inflow
      metodePembayaran: data.metodePembayaran || (paid > 0 ? "Transfer Bank" : "Tempo"),
      bank: data.bank || "Kas Kantor",
      settlementCondition: data.settlementCondition || "PENDING_FINALIZATION",
      refundStatus: data.refundStatus || "NONE",
      overpayment: data.overpayment || 0,
      dueTrigger: data.dueTrigger || "AFTER_DOCUMENT_RECEIVED",
      collectionStatus: data.collectionStatus || (isLunas ? "LUNAS" : "BELUM_JATUH_TEMPO"),
    };

    // If paid at creation ("Bayar di Awal"), record single initial debit to Kas Kantor
    if (paid > 0) {
      const lastTotal = this.kasKantor.length > 0 ? this.kasKantor[this.kasKantor.length - 1].total : 0;
      this.kasKantor.push({
        id: this.kasCounter++,
        tanggal: newRecord.tanggal,
        status: "Debit",
        keterangan: `Penerimaan awal: ${newRecord.invoice} - ${newRecord.customer} (${newRecord.nopol})`,
        debit: paid,
        kredit: 0,
        total: lastTotal + paid,
        invoiceRef: newRecord.invoice,
      });
    }

    this.invoices.unshift(newRecord);
    this.notify();
    return newRecord;
  }

  public updateInvoice(id: number | string, updates: Partial<InvoiceBillingRecord>): boolean {
    const idx = this.invoices.findIndex((inv) => inv.id === id);
    if (idx === -1) return false;

    const current = this.invoices[idx];
    const total = updates.totalTagihan !== undefined ? updates.totalTagihan : current.totalTagihan;
    const paid = updates.terbayar !== undefined ? Math.min(total, updates.terbayar) : current.terbayar;
    const status = derivePaymentStatus(total, paid);
    const isLunas = status === "Lunas";

    // REALIZATION RULE: Calculate cash newly received
    const cashDelta = paid - current.cashRecordedAmount;
    if (cashDelta > 0) {
      const lastTotal = this.kasKantor.length > 0 ? this.kasKantor[this.kasKantor.length - 1].total : 0;
      const paymentDate = new Date().toLocaleDateString("id-ID");
      this.kasKantor.push({
        id: this.kasCounter++,
        tanggal: paymentDate,
        status: "Debit",
        keterangan: `Pelunasan: ${current.invoice} - ${current.customer} (${current.nopol})`,
        debit: cashDelta,
        kredit: 0,
        total: lastTotal + cashDelta,
        invoiceRef: current.invoice,
      });
      current.cashRecordedAmount = paid;
      current.isCashRealized = true;
    }

    const settlementCond = updates.settlementCondition || current.settlementCondition;
    const isFinalized = settlementCond && settlementCond !== "PENDING_FINALIZATION";
    const isProfitRealized = (isLunas || status === "Kelebihan Bayar") && isFinalized;

    const profitMetrics = calculateInvoiceProfitMetrics({
      dibayar: paid,
      totalTagihan: total,
      biayaSamsat: updates.biayaSamsat !== undefined ? updates.biayaSamsat : current.biayaSamsat,
      biayaAntarJemput: (updates as any).biayaAntarJemput ?? (current as any).biayaAntarJemput,
      cashback: updates.cashback !== undefined ? updates.cashback : current.cashback,
    });
    const calculatedProfit = profitMetrics.grossServiceMargin;

    this.invoices[idx] = {
      ...current,
      ...updates,
      totalTagihan: total,
      terbayar: paid,
      sisa: Math.max(0, total - paid),
      status,
      profit: updates.profit !== undefined ? updates.profit : calculatedProfit,
      profitStatus: isProfitRealized ? "REALIZED" : "PENDING",
      cashbackStatus: isProfitRealized ? "REALIZED" : "PENDING",
    };

    if (isProfitRealized) {
      const existingProfitIdx = this.profitData.findIndex(
        (p) => p.invoice === current.invoice || (current.nopol && p.nopol === current.nopol)
      );
      if (existingProfitIdx >= 0) {
        this.profitData[existingProfitIdx] = {
          ...this.profitData[existingProfitIdx],
          uangMasuk: profitMetrics.recognizedRevenue, // Recognized revenue strictly excludes overpayment
          biayaSamsat: this.invoices[idx].biayaSamsat,
          profit: this.invoices[idx].profit,
        };
      } else {
        this.profitData.unshift({
          id: this.profitData.length + 1,
          tanggal: current.tanggal,
          nopol: current.nopol,
          customer: current.customer,
          namaBerkas: current.namaBerkas || "-",
          pengurusan: current.jenisLayanan,
          uangMasuk: profitMetrics.recognizedRevenue, // Recognized revenue strictly excludes overpayment
          biayaSamsat: this.invoices[idx].biayaSamsat,
          profit: this.invoices[idx].profit,
          rekening: current.bank || "BCA",
          invoice: current.invoice,
          tanggalTTB: current.tanggal,
          ttb: `TTB_${current.invoice.replace(/[^0-9]/g, "") || "001"}`,
        });
      }
    }

    this.syncContractRowFromInvoice(this.invoices[idx]);
    this.notifyPaymentSync(this.invoices[idx]);
    this.notify();
    return true;
  }

  public deleteInvoice(id: number | string): boolean {
    const idx = this.invoices.findIndex((inv) => inv.id === id);
    if (idx === -1) return false;
    this.invoices.splice(idx, 1);
    this.notify();
    return true;
  }

  // Phase 9.4: Reconcile temporary optimistic orderNo with backend-confirmed canonical orderNo
  public reconcileOrderNo(oldOrderNo: string, newOrderNo: string, newInvoiceNo?: string): boolean {
    const existingIdx = this.invoices.findIndex((inv) => inv.orderNo === newOrderNo);
    const tempIdx = this.invoices.findIndex((inv) => inv.orderNo === oldOrderNo);

    // If an invoice for newOrderNo already exists (e.g. idempotent retry), remove the temp duplicate
    if (existingIdx !== -1 && tempIdx !== -1 && existingIdx !== tempIdx) {
      this.invoices.splice(tempIdx, 1);
      this.notify();
      return true;
    }

    if (tempIdx === -1) return false;
    this.invoices[tempIdx].orderNo = newOrderNo;
    if (newInvoiceNo) {
      this.invoices[tempIdx].invoice = newInvoiceNo;
    }
    this.syncContractRowFromInvoice(this.invoices[tempIdx]);
    this.notify();
    return true;
  }

  // Phase 9.4: Clean up optimistic invoice if order creation fails (anti-ghost row)
  public removeInvoiceByOrderNo(orderNo: string): boolean {
    const idx = this.invoices.findIndex((inv) => inv.orderNo === orderNo);
    if (idx === -1) return false;
    this.invoices.splice(idx, 1);
    this.notify();
    return true;
  }

  // ==========================================
  // KAS KANTOR CRUD
  // ==========================================

  public addKasKantor(item: Omit<KasKantorItem, "id" | "total"> & { total?: number }): KasKantorItem {
    if (this.isApiMode) {
      const added = financeRepository.addKasKantor ? financeRepository.addKasKantor(item as any) : null;
      if (added) {
        this.syncFromRepository();
        return added;
      }
    }

    const lastTotal = this.kasKantor.length > 0 ? this.kasKantor[this.kasKantor.length - 1].total : 0;
    const runningTotal = item.total !== undefined ? item.total : lastTotal + item.debit - item.kredit;

    const newItem: KasKantorItem = {
      id: this.kasCounter++,
      tanggal: item.tanggal,
      status: item.status,
      keterangan: item.keterangan,
      debit: item.debit,
      kredit: item.kredit,
      penanggungJawab: item.penanggungJawab,
      kategori: item.kategori,
      orderNo: (item as any).orderNo,
      invoiceNo: (item as any).invoiceNo,
      total: runningTotal,
      invoiceRef: item.invoiceRef,
    };

    this.kasKantor.unshift(newItem);
    this.notify();
    return newItem;
  }

  public updateKasKantor(id: number, updates: Partial<KasKantorItem>): boolean {
    const idx = this.kasKantor.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    this.kasKantor[idx] = { ...this.kasKantor[idx], ...updates };
    this.notify();
    return true;
  }

  public async deleteKasKantor(id: number): Promise<boolean> {
    const idx = this.kasKantor.findIndex((k) => k.id === id);
    if (idx === -1) return false;

    if (this.isApiMode) {
      if (financeRepository.deleteKasKantor) {
        await financeRepository.deleteKasKantor(id);
        this.syncFromRepository();
        return true;
      }
    }

    this.kasKantor.splice(idx, 1);
    this.notify();
    return true;
  }

  // ==========================================
  // KAS MESSENGER CRUD
  // ==========================================

  public addKasMessenger(item: Omit<KasMessengerItem, "id" | "total"> & { total?: number }): KasMessengerItem {
    if (this.isApiMode) {
      const added = financeRepository.addKasMessenger ? financeRepository.addKasMessenger(item) : null;
      if (added) {
        this.syncFromRepository();
        return added;
      }
    }

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
      orderNo: (item as any).orderNo,
    };

    this.kasMessenger.push(newItem);
    this.notify();
    return newItem;
  }

  public updateKasMessenger(id: number, updates: Partial<KasMessengerItem>): boolean {
    const idx = this.kasMessenger.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    this.kasMessenger[idx] = { ...this.kasMessenger[idx], ...updates };
    this.notify();
    return true;
  }

  public async deleteKasMessenger(id: number): Promise<boolean> {
    const idx = this.kasMessenger.findIndex((k) => k.id === id);
    if (idx === -1) return false;

    if (this.isApiMode) {
      if (financeRepository.deleteKasMessenger) {
        await financeRepository.deleteKasMessenger(id);
        this.syncFromRepository();
        return true;
      }
    }

    this.kasMessenger.splice(idx, 1);
    this.notify();
    return true;
  }

  // ==========================================
  // PENGELUARAN CRUD
  // ==========================================

  public addPengeluaran(item: Omit<PengeluaranItem, "id">): PengeluaranItem {
    if (this.isApiMode) {
      const added = financeRepository.addPengeluaran ? financeRepository.addPengeluaran(item) : null;
      if (added) {
        this.syncFromRepository();
        return added;
      }
    }

    const nextId = Math.max(0, ...this.pengeluaran.map((p) => p.id)) + 1;
    const newItem: PengeluaranItem = {
      id: nextId,
      tanggal: item.tanggal,
      keterangan: item.keterangan,
      nominal: item.nominal,
      penanggungJawab: item.penanggungJawab,
      kategori: (item as any).kategori,
      orderNo: (item as any).orderNo,
      invoiceNo: (item as any).invoiceNo,
    };
    this.pengeluaran.unshift(newItem);
    this.notify();
    return newItem;
  }

  public updatePengeluaran(id: number, updates: Partial<PengeluaranItem>): boolean {
    const idx = this.pengeluaran.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.pengeluaran[idx] = { ...this.pengeluaran[idx], ...updates };
    this.notify();
    return true;
  }

  public async deletePengeluaran(id: number): Promise<boolean> {
    const idx = this.pengeluaran.findIndex((p) => p.id === id);
    if (idx === -1) return false;

    if (this.isApiMode) {
      if (financeRepository.deletePengeluaran) {
        await financeRepository.deletePengeluaran(id);
        this.syncFromRepository();
        return true;
      }
    }

    this.pengeluaran.splice(idx, 1);
    this.notify();
    return true;
  }

  // ==========================================
  // DATA PENJUALAN CONTRACT SYNC
  // ==========================================

  private buildOrderUpdatesFromContractFields(
    order: OperationalOrder | undefined,
    orderNo: string,
    updatedFields: Record<string, any>
  ): Partial<OperationalOrder> {
    const orderUpdates: Partial<OperationalOrder> = {};
    const nextPayment: any = order?.payment ? { ...order.payment } : {};
    let paymentTouched = false;

    // 1. Informasi Berkas
    const tglBerkasVal = updatedFields["Tanggal Masuk Berkas"] ?? updatedFields.tanggalMasukBerkas ?? updatedFields.tanggal_masuk_berkas;
    if (tglBerkasVal !== undefined) {
      orderUpdates.tanggalMasukBerkas = tglBerkasVal;
      (orderUpdates as any).tanggal_masuk_berkas = tglBerkasVal;
    }

    const custVal = updatedFields["Nama Customer"] ?? updatedFields["Customer"];
    if (custVal !== undefined) {
      orderUpdates.customer = String(custVal).trim();
    }
    const ownerVal = updatedFields["Nama Pemilik (STNK/BPKB)"] ?? updatedFields["Nama"];
    if (ownerVal !== undefined) {
      orderUpdates.namaPemilik = String(ownerVal).trim() || "-";
    }
    const plateVal = updatedFields["Plat No"] ?? updatedFields["Nomor Polisi"];
    if (plateVal !== undefined) {
      orderUpdates.nopol = String(plateVal).trim();
    }
    const serviceVal = updatedFields["Jenis Pengurusan"] ?? updatedFields["Layanan"];
    if (serviceVal !== undefined) {
      orderUpdates.layanan = String(serviceVal).trim();
    }
    const samsatVal = updatedFields["Samsat Asal"] ?? updatedFields["Samsat"] ?? updatedFields["Wilayah Samsat Asal"] ?? updatedFields.samsatAsal;
    if (samsatVal !== undefined) {
      orderUpdates.wilayahSamsatAsal = String(samsatVal).trim();
      (orderUpdates as any).samsat_asal = String(samsatVal).trim();
    }
    const samsatTujuanVal = updatedFields["Samsat Tujuan"] ?? updatedFields.wilayahSamsatTujuan ?? updatedFields.samsatTujuan;
    if (samsatTujuanVal !== undefined) {
      orderUpdates.wilayahSamsatTujuan = String(samsatTujuanVal).trim();
      (orderUpdates as any).samsat_tujuan = String(samsatTujuanVal).trim();
    }
    if (updatedFields["R4 / R2"]) {
      orderUpdates.jenisKendaraan = updatedFields["R4 / R2"] === "R2" ? "Motor" : "Mobil";
    }
    if (updatedFields["Status Kepemilikan"]) {
      orderUpdates.kepemilikanKendaraan = updatedFields["Status Kepemilikan"];
      (orderUpdates as any).statusKepemilikan = updatedFields["Status Kepemilikan"];
    }
    const phoneVal = updatedFields["Nomor HP"] ?? updatedFields["No HP"] ?? updatedFields.phone;
    if (phoneVal !== undefined) {
      orderUpdates.nomorHP = String(phoneVal).trim();
    }

    // 2. Structured 9-Part Address
    const hasAnyAddr = Boolean(
      updatedFields.detailAlamat || updatedFields["Detail Alamat"] ||
      updatedFields.kota || updatedFields["Kota/Kabupaten"] ||
      updatedFields.kecamatan || updatedFields["Kecamatan"] ||
      updatedFields.kelurahan || updatedFields["Kelurahan/Desa"] ||
      updatedFields.rtRw || updatedFields["RT/RW"] ||
      updatedFields.nomorRumah || updatedFields["Nomor Rumah"] ||
      updatedFields.patokan || updatedFields["Patokan"] ||
      updatedFields.linkLokasi || updatedFields["Link Lokasi"] ||
      updatedFields.provinsi || updatedFields["Provinsi"] ||
      updatedFields["Alamat"] || updatedFields.alamat
    );
    if (hasAnyAddr) {
      const detail = (updatedFields.detailAlamat ?? updatedFields["Detail Alamat"] ?? order?.alamatPenjemputan?.detail ?? "").trim();
      const kota = (updatedFields.kota ?? updatedFields["Kota/Kabupaten"] ?? order?.alamatPenjemputan?.kota ?? "").trim();
      const kecamatan = (updatedFields.kecamatan ?? updatedFields["Kecamatan"] ?? order?.alamatPenjemputan?.kecamatan ?? "").trim();
      const kelurahan = (updatedFields.kelurahan ?? updatedFields["Kelurahan/Desa"] ?? order?.alamatPenjemputan?.kelurahan ?? "").trim();
      const rtRw = (updatedFields.rtRw ?? updatedFields["RT/RW"] ?? order?.alamatPenjemputan?.rtRw ?? "").trim();
      const nomor = (updatedFields.nomorRumah ?? updatedFields["Nomor Rumah"] ?? order?.alamatPenjemputan?.nomor ?? "").trim();
      const landmark = (updatedFields.patokan ?? updatedFields["Patokan"] ?? order?.alamatPenjemputan?.landmark ?? "").trim();
      const mapsUrl = (updatedFields.linkLokasi ?? updatedFields["Link Lokasi"] ?? order?.alamatPenjemputan?.mapsUrl ?? "").trim();
      const provinsi = (updatedFields.provinsi ?? updatedFields["Provinsi"] ?? (order?.alamatPenjemputan as any)?.provinsi ?? "").trim();

      orderUpdates.alamatPenjemputan = {
        detail: detail || "",
        kota: kota || "",
        kecamatan: kecamatan || "",
        kelurahan: kelurahan || "",
        rtRw: rtRw || "",
        nomor: nomor || "",
        landmark: landmark || "",
        mapsUrl: mapsUrl || "",
        ...(provinsi ? { provinsi } : {}),
      } as any;
      orderUpdates.alamatPengantaran = { ...orderUpdates.alamatPenjemputan } as any;
      (orderUpdates as any).alamat = updatedFields["Alamat"] || [
        detail,
        nomor ? `No. ${nomor}` : "",
        rtRw ? `RT/RW ${rtRw}` : "",
        kelurahan ? `Kel. ${kelurahan}` : "",
        kecamatan ? `Kec. ${kecamatan}` : "",
        kota,
        provinsi,
      ].filter(Boolean).join(", ");
    }

    // 3. Rincian Keuangan & Komponen Biaya
    if (updatedFields["Biaya Jasa"] !== undefined || updatedFields.biayaJasa !== undefined) {
      const jasaVal = Number(updatedFields["Biaya Jasa"] ?? updatedFields.biayaJasa) || 0;
      orderUpdates.biayaJasa = jasaVal;
      (orderUpdates as any).biaya_jasa = jasaVal;
    }
    if (updatedFields["Biaya Antar Jemput"] !== undefined || updatedFields.biayaAntarJemput !== undefined) {
      const antarVal = Number(updatedFields["Biaya Antar Jemput"] ?? updatedFields.biayaAntarJemput) || 0;
      (orderUpdates as any).biayaAntarJemput = antarVal;
      (orderUpdates as any).biaya_antar_jemput = antarVal;
    }
    if (updatedFields["Biaya Lainnya"] !== undefined || updatedFields.biayaLainnya !== undefined) {
      const lainnyaVal = Number(updatedFields["Biaya Lainnya"] ?? updatedFields.biayaLainnya) || 0;
      (orderUpdates as any).biayaLainnya = lainnyaVal;
      (orderUpdates as any).biaya_lainnya = lainnyaVal;
    }
    if (updatedFields["Biaya Pokok Samsat"] !== undefined || updatedFields.biayaSamsat !== undefined || updatedFields.uangKeluar !== undefined) {
      const samsatVal = Number(updatedFields["Biaya Pokok Samsat"] ?? updatedFields.biayaSamsat ?? updatedFields.uangKeluar) || 0;
      (orderUpdates as any).biayaSamsat = samsatVal;
      (orderUpdates as any).biaya_samsat = samsatVal;
      (orderUpdates as any).uangKeluar = samsatVal;
      orderUpdates.pkb = samsatVal;
    }
    if (updatedFields["Total Tagihan Konsumen"] !== undefined || updatedFields.totalTagihan !== undefined || updatedFields.totalBiaya !== undefined) {
      const totalVal = Number(updatedFields["Total Tagihan Konsumen"] ?? updatedFields.totalTagihan ?? updatedFields.totalBiaya) || 0;
      orderUpdates.totalEstimasi = totalVal;
      (orderUpdates as any).totalBiaya = totalVal;
      (orderUpdates as any).total_biaya = totalVal;
      nextPayment.totalBiaya = totalVal;
      nextPayment.totalEstimasi = totalVal;
      paymentTouched = true;
    }
    if (updatedFields["Uang Masuk dari Konsumen"] !== undefined || updatedFields.uangMasuk !== undefined) {
      const masukVal = Number(updatedFields["Uang Masuk dari Konsumen"] ?? updatedFields.uangMasuk) || 0;
      (orderUpdates as any).uangMasuk = masukVal;
      nextPayment.dibayar = masukVal;
      const curTot = nextPayment.totalBiaya || Number(updatedFields["Total Tagihan Konsumen"]) || 0;
      nextPayment.kurang = Math.max(0, curTot - masukVal);
      paymentTouched = true;
    }

    if (updatedFields["Tanggal Uang Masuk"] !== undefined || updatedFields.tanggalUangMasuk !== undefined) {
      const tglMasukVal = updatedFields["Tanggal Uang Masuk"] || updatedFields.tanggalUangMasuk;
      (orderUpdates as any).tanggalUangMasuk = tglMasukVal;
    }
    if (updatedFields["Tanggal Uang Keluar"] !== undefined || updatedFields.tanggalPengeluaranSamsat !== undefined || updatedFields.tanggalUangKeluar !== undefined) {
      const tglKeluarVal = updatedFields["Tanggal Uang Keluar"] || updatedFields.tanggalPengeluaranSamsat || updatedFields.tanggalUangKeluar;
      (orderUpdates as any).tanggalPengeluaranSamsat = tglKeluarVal;
      (orderUpdates as any).tanggalUangKeluar = tglKeluarVal;
    }

    // 4. Faktur, BPKB & Dokumen Fisik
    if (updatedFields["No Invoice"] !== undefined || updatedFields.noInvoice !== undefined) {
      const invVal = (updatedFields["No Invoice"] || updatedFields.noInvoice || "").trim();
      (orderUpdates as any).noInvoice = invVal;
      nextPayment.invoiceNo = invVal;
      paymentTouched = true;
    }
    if (updatedFields["BPKB"] !== undefined || updatedFields["Dokumen BPKB"] !== undefined || updatedFields.bpkb !== undefined) {
      const bpkbVal = updatedFields["BPKB"] || updatedFields["Dokumen BPKB"] || updatedFields.bpkb;
      (orderUpdates as any).bpkb = bpkbVal;
      (orderUpdates as any).dokumenBPKB = bpkbVal;
      if (order?.clientDocuments) {
        const isAda = bpkbVal === "Ada" ? "Sudah Tersedia" : "Belum Tersedia";
        orderUpdates.clientDocuments = {
          ...order.clientDocuments,
          BPKB: {
            ...(order.clientDocuments.BPKB || { name: "BPKB Asli" }),
            status: isAda,
          },
        };
      }
    }
    if (updatedFields["Status Pengerjaan"]) {
      (orderUpdates as any).statusPengerjaan = updatedFields["Status Pengerjaan"];
      (orderUpdates as any).salesSnapshotStatus = updatedFields["Status Pengerjaan"];
    }
    if (updatedFields["Tanda Terima"] !== undefined || updatedFields["Nomor Tanda Terima"] !== undefined) {
      const ttVal = updatedFields["Tanda Terima"] || updatedFields["Nomor Tanda Terima"];
      (orderUpdates as any).tandaTerima = ttVal;
      (orderUpdates as any).nomorTandaTerima = ttVal;
    }
    if (updatedFields["TTB BPKB"] !== undefined || updatedFields["Nomor TTB BPKB"] !== undefined || updatedFields.ttbBPKB !== undefined) {
      const ttbVal = updatedFields["TTB BPKB"] || updatedFields["Nomor TTB BPKB"] || updatedFields.ttbBPKB;
      (orderUpdates as any).ttbBPKB = ttbVal;
      (orderUpdates as any).nomorTTBBPKB = ttbVal;
    }
    if (updatedFields["Staf Pengirim"] !== undefined || updatedFields.stafPengirim !== undefined) {
      (orderUpdates as any).stafPengirim = updatedFields["Staf Pengirim"] || updatedFields.stafPengirim;
    }
    if (updatedFields["Nama Penerima"] !== undefined || updatedFields.namaPenerima !== undefined) {
      (orderUpdates as any).namaPenerima = updatedFields["Nama Penerima"] || updatedFields.namaPenerima;
      (orderUpdates as any).namaPenerimaKeluar = updatedFields["Nama Penerima"] || updatedFields.namaPenerima;
    }
    if (updatedFields["Nomor Rekening Pengirim"] !== undefined || updatedFields.noRekeningPengirim !== undefined) {
      const rekVal = updatedFields["Nomor Rekening Pengirim"] || updatedFields.noRekeningPengirim;
      (orderUpdates as any).noRekeningPengirim = rekVal;
      nextPayment.noRekening = rekVal;
      paymentTouched = true;
    }
    if (updatedFields["Nomor Rekening Penerima"] !== undefined || updatedFields.noRekeningPenerima !== undefined) {
      (orderUpdates as any).noRekeningPenerima = updatedFields["Nomor Rekening Penerima"] || updatedFields.noRekeningPenerima;
    }
    if (updatedFields["Keterangan"] !== undefined || updatedFields.catatanOrder !== undefined) {
      const catVal = updatedFields["Keterangan"] || updatedFields.catatanOrder;
      orderUpdates.catatanOrder = catVal;
      (orderUpdates as any).catatan = catVal;
    }
    if (updatedFields["Keterangan Dokumen BPKB"] !== undefined) {
      (orderUpdates as any).keteranganDokumenBPKB = updatedFields["Keterangan Dokumen BPKB"];
    }

    // 5. Lampiran Dokumen Sync
    if (Array.isArray(updatedFields.dokumenAwal) || Array.isArray(updatedFields.dokumenAkhir)) {
      const docsAwal = Array.isArray(updatedFields.dokumenAwal) ? updatedFields.dokumenAwal : [];
      const docsAkhir = Array.isArray(updatedFields.dokumenAkhir) ? updatedFields.dokumenAkhir : [];
      const rekapDocs: any[] = [
        ...docsAwal.map((d: any) => ({
          id: d.id,
          orderId: orderNo,
          phase: "BEFORE" as const,
          documentType: "OTHER" as const,
          label: d.customName || d.name || "Dokumen Masuk",
          fileType: (d.mimeType?.includes("pdf") || (d.name || "").toLowerCase().endsWith(".pdf")) ? "PDF" as const : "IMAGE" as const,
          fileUrl: d.fileUrl || "",
          uploadedAt: d.createdAt || new Date().toISOString(),
          uploadedBy: "Admin",
        })),
        ...docsAkhir.map((d: any) => ({
          id: d.id,
          orderId: orderNo,
          phase: "AFTER" as const,
          documentType: "OTHER" as const,
          label: d.customName || d.name || "Dokumen Keluar",
          fileType: (d.mimeType?.includes("pdf") || (d.name || "").toLowerCase().endsWith(".pdf")) ? "PDF" as const : "IMAGE" as const,
          fileUrl: d.fileUrl || "",
          uploadedAt: d.createdAt || new Date().toISOString(),
          uploadedBy: "Admin",
        })),
      ];
      (orderUpdates as any).rekapDocuments = rekapDocs;
      orderUpdates.rekapDocuments = rekapDocs;
    }

    if (paymentTouched) {
      orderUpdates.payment = nextPayment;
    }

    return orderUpdates;
  }

  private applyLinkedInvoiceAndDatasetUpdate(
    category: PenjualanContractCategory,
    id: number | string,
    orderNo: string,
    order: OperationalOrder | undefined,
    updatedFields: Record<string, any>
  ): void {
    const linkedInv = this.invoices.find(
      (i) => i.orderNo === orderNo || (order?.payment?.invoiceNo && (i.invoice === order.payment.invoiceNo || i.invoiceNo === order.payment.invoiceNo))
    );
    if (linkedInv) {
      if (updatedFields["Nama Customer"]) linkedInv.customer = updatedFields["Nama Customer"];
      if (updatedFields["Plat No"]) linkedInv.nopol = updatedFields["Plat No"];
      if (updatedFields["Jenis Pengurusan"]) linkedInv.jenisLayanan = updatedFields["Jenis Pengurusan"];
      if (updatedFields["No Invoice"] || updatedFields.noInvoice) {
        const newInvNo = updatedFields["No Invoice"] || updatedFields.noInvoice;
        linkedInv.invoice = newInvNo;
        linkedInv.invoiceNo = newInvNo;
      }
      if (updatedFields["Tanggal Masuk Berkas"]) linkedInv.tanggal = updatedFields["Tanggal Masuk Berkas"];
      if (updatedFields["Total Tagihan Konsumen"] !== undefined) linkedInv.totalTagihan = Number(updatedFields["Total Tagihan Konsumen"]) || 0;
      if (updatedFields["Biaya Pokok Samsat"] !== undefined) linkedInv.biayaSamsat = Number(updatedFields["Biaya Pokok Samsat"]) || 0;
      if (updatedFields["Biaya Lainnya"] !== undefined) (linkedInv as any).biayaLainnya = Number(updatedFields["Biaya Lainnya"]) || 0;
      if (updatedFields["Biaya Antar Jemput"] !== undefined) (linkedInv as any).biayaAntarJemput = Number(updatedFields["Biaya Antar Jemput"]) || 0;
      if (updatedFields["Uang Masuk dari Konsumen"] !== undefined) {
        linkedInv.terbayar = Number(updatedFields["Uang Masuk dari Konsumen"]) || 0;
        linkedInv.sisa = Math.max(0, linkedInv.totalTagihan - linkedInv.terbayar);
        linkedInv.status = derivePaymentStatus(linkedInv.totalTagihan, linkedInv.terbayar);
      }
      const curUangMasuk = linkedInv.terbayar || 0;
      const curSamsat = linkedInv.biayaSamsat || 0;
      const curLainnya = Number((linkedInv as any).biayaLainnya || 0);
      linkedInv.profit = Math.max(0, curUangMasuk - curSamsat - curLainnya);
      if (updatedFields["Tanda Terima"]) linkedInv.tandaTerima = updatedFields["Tanda Terima"];
      if (updatedFields["TTB BPKB"]) linkedInv.ttbBPKB = updatedFields["TTB BPKB"];
    }

    const dataset = this.contractDatasets[category];
    if (dataset) {
      const idx = dataset.findIndex((d: any) => d.id === id || d.orderNo === orderNo || d["Nomor Order"] === orderNo);
      if (idx !== -1) {
        dataset[idx] = {
          ...dataset[idx],
          ...updatedFields,
        };
      }
    }
  }

  public updateContractData(
    category: PenjualanContractCategory,
    id: number | string,
    updatedFields: Record<string, any>
  ): boolean {
    if (category === "belum-kurang-bayar" || category === "profit-terpending" || category === "cashback-terpending") {
      const inv = this.invoices.find((i) => i.id === id || String(i.id) === String(id));
      if (inv) {
        if (updatedFields["Uang Masuk dari Konsumen"] !== undefined) {
          const newPaid = Number(updatedFields["Uang Masuk dari Konsumen"]) || 0;
          this.recordPayment(inv.id, newPaid - inv.terbayar);
        } else {
          if (updatedFields["Alasan"]) inv.alasanPending = updatedFields["Alasan"];
          if (updatedFields["Jumlah Cashback"]) inv.cashback = Number(updatedFields["Jumlah Cashback"]) || 0;
          this.notify();
        }
        return true;
      }
    }

    // Check if updating a projected order (id starts with "ord:")
    if (typeof id === "string" && id.startsWith("ord:")) {
      const orderNo = id.slice(4);
      const order = orderRepository.getByOrderNo(orderNo);
      if (order) {
        const orderUpdates = this.buildOrderUpdatesFromContractFields(order, orderNo, updatedFields);
        if (orderUpdates.payment && order.payment) {
          Object.assign(order.payment, orderUpdates.payment);
        }
        this.applyLinkedInvoiceAndDatasetUpdate(category, id, orderNo, order, updatedFields);
        orderRepository.updateOrder(orderNo, orderUpdates);
        this.notify();
        return true;
      }
    }

    const dataset = this.contractDatasets[category];
    if (!dataset) return false;
    const idx = dataset.findIndex((r) => r.id === id || String(r.id) === String(id));
    if (idx === -1) return false;

    dataset[idx] = { ...dataset[idx], ...updatedFields };

    // Synchronize to matching invoice if present
    const invoiceNo = dataset[idx]["No Invoice"];
    const nopol = dataset[idx]["Plat No"];
    const matchedInvoice = this.invoices.find((inv) => inv.invoice === invoiceNo || inv.nopol === nopol);

    if (matchedInvoice && updatedFields["Uang Masuk dari Konsumen"] !== undefined) {
      const newPaid = Number(updatedFields["Uang Masuk dari Konsumen"]) || 0;
      this.recordPayment(matchedInvoice.id, newPaid - matchedInvoice.terbayar);
    } else {
      this.notify();
    }

    return true;
  }

  public async updateContractDataAsync(
    category: PenjualanContractCategory,
    id: number | string,
    updatedFields: Record<string, any>
  ): Promise<ContractMutationResult> {
    if (category === "belum-kurang-bayar" || category === "profit-terpending" || category === "cashback-terpending") {
      const ok = this.updateContractData(category, id, updatedFields);
      return ok
        ? { success: true }
        : {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Data penjualan tidak ditemukan. Data mungkin sudah dihapus atau berubah.",
              statusCode: 404,
            },
          };
    }

    // Client-side validation for edited mandatory fields when provided
    const custVal = updatedFields["Nama Customer"] ?? updatedFields["Customer"];
    if (custVal !== undefined && !String(custVal).trim()) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Gagal menyimpan data. Nama Customer wajib diisi.",
          field: "customer",
          statusCode: 400,
        },
      };
    }
    const plateVal = updatedFields["Plat No"] ?? updatedFields["Nomor Polisi"];
    if (plateVal !== undefined && !String(plateVal).trim()) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Gagal menyimpan data. Nomor Polisi wajib diisi lengkap.",
          field: "nopol",
          statusCode: 400,
        },
      };
    }
    const serviceVal = updatedFields["Jenis Pengurusan"] ?? updatedFields["Layanan"];
    if (serviceVal !== undefined && !String(serviceVal).trim()) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Gagal menyimpan data. Jenis Pengurusan wajib diisi.",
          field: "layanan",
          statusCode: 400,
        },
      };
    }
    const phoneVal = updatedFields["Nomor HP"] ?? updatedFields["No HP"] ?? updatedFields.phone;
    if (phoneVal !== undefined) {
      const phoneDigits = String(phoneVal).replace(/[^0-9]/g, "");
      if (!String(phoneVal).trim() || phoneDigits.length < 9) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Gagal menyimpan data. Nomor HP / WhatsApp wajib diisi (minimal 9 digit angka).",
            field: "nomorHP",
            statusCode: 400,
          },
        };
      }
    }

    const isOrderRow = typeof id === "string" && (id.startsWith("ord:") || id.toUpperCase().startsWith("ORD-"));
    if (isOrderRow) {
      const orderNo = String(id).startsWith("ord:") ? String(id).slice(4) : String(id);
      const order = orderRepository.getByOrderNo(orderNo);
      const orderUpdates = this.buildOrderUpdatesFromContractFields(order, orderNo, updatedFields);

      try {
        const ok =
          typeof orderRepository.updateOrderAsync === "function"
            ? await orderRepository.updateOrderAsync(orderNo, orderUpdates)
            : orderRepository.updateOrder(orderNo, orderUpdates);

        if (!ok) {
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Data penjualan tidak ditemukan. Data mungkin sudah dihapus atau berubah.",
              statusCode: 404,
            },
          };
        }

        // Only update local linked invoice & contract datasets after server confirmation
        const confirmedOrder = orderRepository.getByOrderNo(orderNo) || order;
        this.applyLinkedInvoiceAndDatasetUpdate(category, id, orderNo, confirmedOrder, updatedFields);
        this.notify();
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code:
              err?.code ||
              (err?.statusCode === 404
                ? "NOT_FOUND"
                : err?.statusCode === 403
                ? "FORBIDDEN"
                : err?.statusCode === 401
                ? "UNAUTHENTICATED"
                : err?.statusCode === 409
                ? "DUPLICATE_RECORD"
                : err?.statusCode === 422
                ? "CONFLICT"
                : err?.statusCode === 400
                ? "VALIDATION_ERROR"
                : err?.statusCode === 0
                ? "NETWORK_ERROR"
                : "SERVER_ERROR"),
            message: err?.detail || err?.message || "Gagal memperbarui data penjualan di server.",
            field: err?.field,
            statusCode: err?.statusCode,
          },
        };
      }
    }

    const dataset = this.contractDatasets[category];
    if (!dataset) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Data penjualan tidak ditemukan. Data mungkin sudah dihapus atau berubah.",
          statusCode: 404,
        },
      };
    }
    const idx = dataset.findIndex((r) => r.id === id || String(r.id) === String(id));
    if (idx === -1) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Data penjualan tidak ditemukan. Data mungkin sudah dihapus atau berubah.",
          statusCode: 404,
        },
      };
    }

    const ok = this.updateContractData(category, id, updatedFields);
    return ok
      ? { success: true }
      : {
          success: false,
          error: {
            code: "SERVER_ERROR",
            message: "Gagal memperbarui data penjualan.",
            statusCode: 500,
          },
        };
  }

  public preserveOrderInContractDataset(order: any): void {
    if (!order) return;
    try {
      const cat = resolveOrderSalesCategory(order.layanan);
      const row = projectOrderToContractRow(order, this.invoices.find((i) => i.orderNo === order.orderNo));
      if (this.contractDatasets[cat]) {
        const idx = this.contractDatasets[cat].findIndex(
          (r: any) => r["Nomor Order"] === order.orderNo || r.orderNo === order.orderNo || r.id === `ord:${order.orderNo}`
        );
        if (idx !== -1) {
          this.contractDatasets[cat][idx] = { ...this.contractDatasets[cat][idx], ...row };
        } else {
          this.contractDatasets[cat].push(row);
        }
        this.notify();
      }
    } catch {
      // safe fallback
    }
  }

  public addContractData(category: PenjualanContractCategory, rows: any[]): boolean {
    const isOperational = [
      "perpanjangan-1-tahun",
      "perpanjangan-5-tahun",
      "mutasi-asal",
      "mutasi-antar-daerah",
      "balik-nama",
      "tarik-berkas",
      "duplikat-stnk",
      "mutasi-ld",
      "mutasi-as",
      "bbn",
      "perpanjangan-pajak",
      "lain-lain",
    ].includes(category);

    if (isOperational) {
      if (!rows || rows.length === 0) return false;

      // 1. Strict validation: Customer, Nopol, Layanan, Nomor HP, and Alamat are required for every row
      for (const row of rows) {
        const customer = (row["Nama Customer"] || row.customer || "").trim();
        const nopol = (row["Plat No"] || row.nopol || "").trim();
        const defaultLayanan =
          category === "perpanjangan-1-tahun" || category === "perpanjangan-pajak"
            ? "Perpanjangan 1 Tahun"
            : category === "perpanjangan-5-tahun"
            ? "Perpanjangan 5 Tahun"
            : category === "mutasi-asal" || category === "mutasi-as"
            ? "Mutasi Asal Samsat"
            : category === "mutasi-antar-daerah" || category === "mutasi-ld"
            ? "Mutasi Antar Daerah"
            : category === "balik-nama" || category === "bbn"
            ? "Balik Nama"
            : category === "tarik-berkas" || category === "lain-lain"
            ? "Tarik Berkas"
            : category === "duplikat-stnk"
            ? "Duplikat STNK"
            : "Perpanjangan 1 Tahun";
        const layanan = (row["Jenis Pengurusan"] || row.layanan || defaultLayanan).trim();
        const phone = (row["Nomor HP"] || row["No HP"] || row.nomorHP || row.phone || "").trim();
        const alamat = (row["Alamat"] || row.alamat || "").trim();

        if (!customer || !nopol || !layanan) {
          console.warn("[FinanceStore] addContractData validation failed: missing customer, nopol, or layanan", row);
          return false;
        }

        const phoneDigits = phone.replace(/[^0-9]/g, "");
        if (!phone || phoneDigits.length < 9 || phone === "081200000000") {
          console.warn("[FinanceStore] addContractData validation failed: valid customer phone required (no dummy defaults)", row);
          return false;
        }
      }

      // 2. Create canonical orders
      for (const row of rows) {
        const customer = (row["Nama Customer"] || row.customer || "").trim();
        const nopol = (row["Plat No"] || row.nopol || "").trim();
        const defaultLayanan =
          category === "perpanjangan-1-tahun" || category === "perpanjangan-pajak"
            ? "Perpanjangan 1 Tahun"
            : category === "perpanjangan-5-tahun"
            ? "Perpanjangan 5 Tahun"
            : category === "mutasi-asal" || category === "mutasi-as"
            ? "Mutasi Asal Samsat"
            : category === "mutasi-antar-daerah" || category === "mutasi-ld"
            ? "Mutasi Antar Daerah"
            : category === "balik-nama" || category === "bbn"
            ? "Balik Nama"
            : category === "tarik-berkas" || category === "lain-lain"
            ? "Tarik Berkas"
            : category === "duplikat-stnk"
            ? "Duplikat STNK"
            : "Perpanjangan 1 Tahun";
        const layanan = (row["Jenis Pengurusan"] || row.layanan || defaultLayanan).trim();
        const phone = (row["Nomor HP"] || row["No HP"] || row.nomorHP || row.phone || "").trim();
        const alamat = (row["Alamat"] || row.alamat || "").trim();
        const namaPemilik = (row["Nama Pemilik (STNK/BPKB)"] || row["Nama"] || row.namaPemilik || "").trim();
        const samsat = (row["Samsat"] || row.samsat || "Jakarta Timur").trim();
        const r4r2 = row["R4 / R2"] || row.r4r2;
        const jenisKendaraan = r4r2 === "R2" ? "Motor" : "Mobil";
        const uangMasuk = Number(row["Uang Masuk dari Konsumen"] || row.uangMasuk) || 0;
        const uangKeluar = Number(row["Biaya Pokok Samsat"] || row["Uang Keluar dari Biro Jasa"] || row.uangKeluar) || 0;
        const biayaJasa = Number(row["Biaya Jasa"] || row.biayaJasa) || 0;
        const biayaAntarJemput = Number(row["Biaya Antar Jemput"] || row.biayaAntarJemput) || 0;
        const biayaLainnya = Number(row["Biaya Lainnya"] || row.biayaLainnya) || 0;
        const totalTagihan = Number(row["Total Tagihan Konsumen"] || row.totalTagihan) || (biayaJasa > 0 || uangKeluar > 0 || biayaLainnya > 0 ? (uangKeluar + biayaJasa + biayaAntarJemput + biayaLainnya) : (uangMasuk > 0 ? uangMasuk : 1500000));
        const profit = Number(row["Profit"] !== undefined ? row["Profit"] : (row.profit !== undefined ? row.profit : (uangMasuk - uangKeluar - biayaLainnya)));
        const cashback = Math.max(0, uangMasuk - totalTagihan);
        const bpkb = row["BPKB"] || row.bpkb || "Ada";
        const isMutasiLD = category === "mutasi-ld" || category === "mutasi-antar-daerah";
        const namaPenerimaKeluar = (row["Nama Rekening/Penerima"] || row["Nama Pemilik Rekening Keluar"] || row.namaPenerimaKeluar || row["Nama Penerima"] || row.namaPenerima || "").trim();
        const stafPengirim = (row["Staf Pengirim"] || row.stafPengirim || "").trim();
        const namaPenerima = (row["Nama Penerima"] || row.namaPenerima || namaPenerimaKeluar || "").trim();
        const noRekeningPengirim = (row["Nomor Rekening Pengirim"] || row.noRekeningPengirim || row["Nomor Rekening Masuk"] || row.noRekeningMasuk || "").trim();
        const noRekeningPenerima = (row["Nomor Rekening Penerima"] || row.noRekeningPenerima || "").trim();
        const bankUangKeluar = row["Bank Uang Keluar"] || "";
        const metodePembayaranKeluar = row["Metode Pembayaran Keluar"] || "";
        const metodePembayaranMasuk = row["Metode Pembayaran Masuk"] || "Transfer Bank";
        const bankUangMasuk = row["Bank Uang Masuk"] || "BCA";
        const noRekeningMasuk = noRekeningPengirim || row["Nomor Rekening Masuk"] || "";
        const namaRekeningMasuk = row["Nama Pemilik Rekening Masuk"] || "";

        // Structured Address with backward-compatible single string
        const structuredAddr = row.alamatTerstruktur || {
          detail: (row.detailAlamat || row["Detail Alamat"] || alamat || "").trim(),
          kota: (row.kota || row["Kota/Kabupaten"] || samsat || "").trim(),
          kecamatan: (row.kecamatan || row["Kecamatan"] || "").trim(),
          kelurahan: (row.kelurahan || row["Kelurahan/Desa"] || "").trim(),
          rtRw: (row.rtRw || row["RT/RW"] || "").trim(),
          nomor: (row.nomorRumah || row["Nomor Rumah"] || "").trim(),
          landmark: (row.patokan || row["Patokan"] || "").trim(),
          mapsUrl: (row.linkLokasi || row["Link Lokasi"] || "").trim(),
        };

        const fullAlamat = (row["Alamat"] || row.alamat || [
          structuredAddr.detail,
          structuredAddr.nomor ? `No. ${structuredAddr.nomor}` : "",
          structuredAddr.rtRw ? `RT/RW ${structuredAddr.rtRw}` : "",
          structuredAddr.kelurahan ? `Kel. ${structuredAddr.kelurahan}` : "",
          structuredAddr.kecamatan ? `Kec. ${structuredAddr.kecamatan}` : "",
          structuredAddr.kota,
        ].filter(Boolean).join(", ")).trim();

        // Extract and map Dokumen Awal & Dokumen Akhir to canonical RekapDocument
        const dokumenAwal = Array.isArray(row.dokumenAwal) ? row.dokumenAwal : [];
        const dokumenAkhir = Array.isArray(row.dokumenAkhir) ? row.dokumenAkhir : [];
        const rekapDocs: any[] = [
          ...dokumenAwal.map((d: any) => ({
            id: d.id || `doc-awal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderId: "",
            phase: "BEFORE" as const,
            documentType: "OTHER" as const,
            label: d.originalName || d.name || "Dokumen Awal",
            fileType: (d.mimeType?.includes("pdf") || (d.originalName || d.name || "").toLowerCase().endsWith(".pdf")) ? "PDF" as const : "IMAGE" as const,
            fileUrl: d.fileUrl || (d.id ? `/api/documents/${d.id}/preview` : ""),
            uploadedAt: d.createdAt || new Date().toISOString(),
            uploadedBy: "Admin",
            documentId: d.id,
          })),
          ...dokumenAkhir.map((d: any) => ({
            id: d.id || `doc-akhir-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderId: "",
            phase: "AFTER" as const,
            documentType: "OTHER" as const,
            label: d.originalName || d.name || "Dokumen Akhir",
            fileType: (d.mimeType?.includes("pdf") || (d.originalName || d.name || "").toLowerCase().endsWith(".pdf")) ? "PDF" as const : "IMAGE" as const,
            fileUrl: d.fileUrl || (d.id ? `/api/documents/${d.id}/preview` : ""),
            uploadedAt: d.createdAt || new Date().toISOString(),
            uploadedBy: "Admin",
            documentId: d.id,
          })),
        ];

        const statusPengerjaan = row["Status Pengerjaan"] || row.statusPengerjaan || (isMutasiLD ? "Pending" : "Dalam Proses");
        const isSelesai = statusPengerjaan === "Selesai";
        const kepemilikanKendaraan = row["Status Kepemilikan"] || row.kepemilikanKendaraan || "Pribadi";
        const noInvoice = row["No Invoice"] !== undefined ? row["No Invoice"] : (isMutasiLD ? "" : (row.invoiceNo || ""));
        const tandaTerima = row["Tanda Terima"] !== undefined ? row["Tanda Terima"] : (isMutasiLD ? "" : "-");
        const ttbBPKB = row["TTB BPKB"] !== undefined ? row["TTB BPKB"] : (isMutasiLD ? "" : (bpkb === "Ada" ? "-" : "-"));
        const bpkbVal = row["BPKB"] !== undefined ? row["BPKB"] : (isMutasiLD ? "" : bpkb);
        const statusBPKBVal = row["Status BPKB"] !== undefined ? row["Status BPKB"] : (isMutasiLD ? "" : "-");
        const statusPembayaranVal = uangMasuk >= totalTagihan && totalTagihan > 0
          ? (uangMasuk > totalTagihan ? "Kelebihan Bayar" : "Lunas")
          : uangMasuk > 0 ? "Kurang Bayar" : "Belum Bayar";

        if (this.orderCreator) {
          const res = this.orderCreator({
            orderNo: row["Nomor Order"] || row.orderNo,
            tanggalMasukBerkas: row["Tanggal Masuk Berkas"] || row.tanggalMasukBerkas,
            tanggalUangMasuk: row["Tanggal Uang Masuk"] || row.tanggalUangMasuk,
            catatanOrder: row["Keterangan"] || row.catatan || row.catatanOrder,
            customer,
            nopol,
            layanan,
            namaPemilik,
            nomorHP: phone,
            alamat: fullAlamat,
            wilayahSamsatAsal: samsat,
            wilayahSamsatTujuan: row["Samsat Tujuan"] || "-",
            jenisKendaraan,
            biayaJasa: biayaJasa || profit,
            biayaAntarJemput,
            biayaLainnya,
            totalEstimasi: totalTagihan,
            uangMasuk,
            uangKeluar,
            r4r2,
            bpkb: bpkbVal,
            statusBPKB: statusBPKBVal,
            noInvoice,
            invoiceNo: noInvoice,
            tandaTerima,
            ttbBPKB,
            statusPengerjaan,
            salesSnapshotStatus: statusPengerjaan,
            statusKepemilikan: kepemilikanKendaraan,
            statusPembayaran: statusPembayaranVal,
            currentStep: isSelesai ? 8 : 1,
            currentStageName: isSelesai ? "Dokumen Telah Diterima" : "Verifikasi",
            isArchived: isMutasiLD && isSelesai,
            rekapDocuments: rekapDocs,
            namaPenerimaKeluar,
            namaPemilikRekeningKeluar: namaPenerimaKeluar,
            bankUangKeluar,
            metodePembayaranKeluar,
            tanggalPengeluaranSamsat: row["Tanggal Uang Keluar"] || "",
            metodePembayaranMasuk,
            bankUangMasuk,
            noRekeningMasuk,
            namaRekeningMasuk,
            stafPengirim,
            namaPenerima,
            noRekeningPengirim,
            noRekeningPenerima,
          });
          if (res === false) return false;
          if (res && typeof res === "object" && res.orderNo) {
            const finalOrderNo = res.orderNo;
            [...dokumenAwal, ...dokumenAkhir].forEach((doc: any) => {
              if (doc.id) {
                documentRepository.linkOrder?.(doc.id, finalOrderNo).catch(() => {});
              }
            });

            (res as any).salesSnapshotStatus = statusPengerjaan;
            (res as any).statusPengerjaan = statusPengerjaan;
            (res as any).statusPembayaran = statusPembayaranVal;
            (res as any).tandaTerima = tandaTerima;
            (res as any).ttbBPKB = ttbBPKB;
            (res as any).noInvoice = noInvoice;
            (res as any).bpkb = bpkbVal;
            (res as any).statusBPKB = statusBPKBVal;
            (res as any).kepemilikanKendaraan = kepemilikanKendaraan;
            (res as any).alamat = fullAlamat;
            (res as any).uangMasuk = uangMasuk;
            (res as any).uangKeluar = uangKeluar;
            (res as any).biayaSamsat = uangKeluar;
            (res as any).biayaJasa = biayaJasa || profit;
            (res as any).biayaAntarJemput = biayaAntarJemput;
            (res as any).biayaLainnya = biayaLainnya;
            (res as any).namaPenerimaKeluar = namaPenerimaKeluar;
            (res as any).namaPemilikRekeningKeluar = namaPenerimaKeluar;
            (res as any).stafPengirim = stafPengirim;
            (res as any).namaPenerima = namaPenerima;
            (res as any).noRekeningPengirim = noRekeningPengirim;
            (res as any).noRekeningPenerima = noRekeningPenerima;
            (res as any).bankUangKeluar = bankUangKeluar;
            (res as any).metodePembayaranKeluar = metodePembayaranKeluar;
            (res as any).tanggalPengeluaranSamsat = row["Tanggal Uang Keluar"] || "";

            if (isMutasiLD) {
              if (isSelesai) {
                res.currentStep = 8;
                res.currentStageName = "Dokumen Telah Diterima";
                res.isArchived = true;
                orderRepository.archiveOrder?.(finalOrderNo);
              } else {
                res.currentStep = 1;
                res.currentStageName = "Verifikasi";
                res.isArchived = false;
              }
            }

            if (res.alamatPenjemputan) {
              res.alamatPenjemputan = {
                kota: structuredAddr.kota,
                kecamatan: structuredAddr.kecamatan,
                kelurahan: structuredAddr.kelurahan,
                detail: structuredAddr.detail,
                rtRw: structuredAddr.rtRw,
                nomor: structuredAddr.nomor,
                landmark: structuredAddr.landmark,
                mapsUrl: structuredAddr.mapsUrl,
              };
            }
            if (res.alamatPengantaran) {
              res.alamatPengantaran = { ...res.alamatPenjemputan };
            }

            const mutableUpdates: any = {
              alamatPenjemputan: res.alamatPenjemputan,
              alamatPengantaran: res.alamatPengantaran,
              salesSnapshotStatus: statusPengerjaan,
              catatanOrder: res.catatanOrder,
            };
            orderRepository.updateOrder?.(finalOrderNo, mutableUpdates);
          }
        } else {
          // Direct canonical creation fallback if orderCreator not yet wired
          const allOrders = [
            ...orderRepository.getAllFlat(),
            ...(typeof orderRepository.getArchivedOrders === "function" ? orderRepository.getArchivedOrders() : [])
          ];
          const existingNums = allOrders
            .map((o) => parseInt((o.orderNo || "").replace(/\D/g, ""), 10))
            .filter((n) => !isNaN(n));
          const nextOrderNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 101;
          const orderNo = `ORD-${String(nextOrderNum).padStart(4, "0")}`;
          const clientRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const totalEst = totalTagihan;
          const tandaTerima = row["Tanda Terima"] !== undefined ? row["Tanda Terima"] : (isMutasiLD ? "" : `TT-${orderNo}`);
          const ttbBPKB = row["TTB BPKB"] !== undefined ? row["TTB BPKB"] : (isMutasiLD ? "" : (bpkb === "Ada" ? `TTB-${orderNo}` : "-"));
          const noInvoice = row["No Invoice"] !== undefined ? row["No Invoice"] : (isMutasiLD ? "" : (row.invoiceNo || ""));
          const bpkbVal = row["BPKB"] !== undefined ? row["BPKB"] : (isMutasiLD ? "" : bpkb);
          const statusBPKBVal = row["Status BPKB"] !== undefined ? row["Status BPKB"] : (isMutasiLD ? "" : "-");
          const statusPengerjaan = row["Status Pengerjaan"] || row.statusPengerjaan || (isMutasiLD ? "Pending" : "Dalam Proses");
          const isSelesai = statusPengerjaan === "Selesai";
          const kepemilikanKendaraan = row["Status Kepemilikan"] || row.kepemilikanKendaraan || "Pribadi";
          const statusPembayaranVal = uangMasuk >= totalTagihan && totalTagihan > 0
            ? (uangMasuk > totalTagihan ? "Kelebihan Bayar" : "Lunas")
            : uangMasuk > 0 ? "Kurang Bayar" : "Belum Bayar";

          // Link documents to created orderNo
          [...dokumenAwal, ...dokumenAkhir].forEach((doc: any) => {
            if (doc.id) {
              documentRepository.linkOrder?.(doc.id, orderNo).catch(() => {});
            }
          });
          rekapDocs.forEach((rd) => { rd.orderId = orderNo; });

          const newOrder: OperationalOrder = {
            orderNo,
            clientRequestId,
            customer,
            nomorHP: phone,
            layanan,
            currentStep: isSelesai ? 8 : 1,
            currentStageName: isSelesai ? "Dokumen Telah Diterima" : "Verifikasi",
            catatanOrder: isMutasiLD
              ? `Order Mutasi LD dibuat langsung dari Data Penjualan (Status ${statusPengerjaan}).`
              : "Order dibuat dari Data Penjualan (+ Tambah Data).",
            createdAt: row["Tanggal Masuk Berkas"] || new Date().toISOString().split("T")[0],
            isArchived: isMutasiLD && isSelesai,
            namaPemilik,
            kepemilikanKendaraan,
            jenisKendaraan,
            tahunKendaraan: new Date().getFullYear(),
            nopol,
            pkbBerlakuSd: "",
            tahunPajak: String(new Date().getFullYear()),
            bulanPajak: "Januari",
            nominalPkbTerakhir: 0,
            nominalSwdkllj: 143000,
            wilayahSamsatAsal: samsat,
            wilayahSamsatTujuan: row["Samsat Tujuan"] || "-",
            alamatPenjemputan: {
              kota: structuredAddr.kota,
              kecamatan: structuredAddr.kecamatan,
              kelurahan: structuredAddr.kelurahan,
              detail: structuredAddr.detail,
              rtRw: structuredAddr.rtRw,
              nomor: structuredAddr.nomor,
              landmark: structuredAddr.landmark,
              mapsUrl: structuredAddr.mapsUrl,
            },
            alamatPengantaran: {
              kota: structuredAddr.kota,
              kecamatan: structuredAddr.kecamatan,
              kelurahan: structuredAddr.kelurahan,
              detail: structuredAddr.detail,
              rtRw: structuredAddr.rtRw,
              nomor: structuredAddr.nomor,
              landmark: structuredAddr.landmark,
              mapsUrl: structuredAddr.mapsUrl,
            },
            clientDocuments: {
              stnk: { name: "STNK.pdf", status: "Sudah Tersedia", isOptional: false },
              bpkb: { name: "BPKB.pdf", status: bpkb === "Ada" ? "Sudah Tersedia" : "Belum Tersedia", isOptional: false },
              ktp: { name: "KTP.pdf", status: "Sudah Tersedia", isOptional: false },
            },
            updatedDocuments: [],
            biayaJasa: biayaJasa || profit,
            biayaAntarJemput,
            namaPenerimaKeluar,
            bankUangKeluar,
            metodePembayaranKeluar,
            tanggalPengeluaranSamsat: row["Tanggal Uang Keluar"] || "",
            pkb: 0,
            swdkllj: 143000,
            dendaSwdkllj: 0,
            totalEstimasi: totalEst,
            samsatProcesses: [],
            payment: {
              tipePembayaran: uangMasuk >= totalEst && totalEst > 0 ? "Bayar di Awal" : "Bayar di Akhir",
              metodePembayaran: /cash|tunai/i.test(metodePembayaranMasuk)
                ? "Cash"
                : /^qris$/i.test(metodePembayaranMasuk)
                ? "QRIS"
                : bankUangMasuk && bankUangMasuk !== "-" && bankUangMasuk !== "Lainnya" && !/^kas\b/i.test(bankUangMasuk)
                ? (metodePembayaranMasuk.toLowerCase().includes(bankUangMasuk.toLowerCase()) ? metodePembayaranMasuk : `Transfer ${bankUangMasuk}`)
                : metodePembayaranMasuk,
              namaBank: bankUangMasuk,
              noRekening: noRekeningMasuk,
              namaRekening: namaRekeningMasuk,
              statusPembayaran: statusPembayaranVal as any,
              totalBiaya: totalEst,
              totalEstimasi: totalEst,
              dibayar: uangMasuk,
              kurang: Math.max(0, totalEst - uangMasuk),
              overpayment: cashback,
              settlementCondition: cashback > 0 ? "OVERPAID" : "PENDING_FINALIZATION",
              refundStatus: "NONE",
              isPaymentVerified: uangMasuk >= totalEst && totalEst > 0,
              paymentRecords: [
                {
                  id: `PAY-${Date.now()}`,
                  nominal: uangMasuk,
                  tanggal: row["Tanggal Uang Masuk"] || new Date().toISOString().split("T")[0],
                  metodePembayaran: metodePembayaranMasuk,
                  namaBank: bankUangMasuk,
                  noRekening: noRekeningMasuk,
                  namaRekening: namaRekeningMasuk,
                  statusVerifikasi: uangMasuk > 0 ? "MENUNGGU_VERIFIKASI" : "MENUNGGU_BUKTI",
                },
              ],
            },
            rekapDocuments: rekapDocs,
          };

          (newOrder as any).statusPengerjaan = statusPengerjaan;
          (newOrder as any).salesSnapshotStatus = statusPengerjaan;
          (newOrder as any).statusPembayaran = statusPembayaranVal;
          (newOrder as any).tandaTerima = tandaTerima;
          (newOrder as any).ttbBPKB = ttbBPKB;
          (newOrder as any).noInvoice = noInvoice;
          (newOrder as any).bpkb = bpkbVal;
          (newOrder as any).statusBPKB = statusBPKBVal;
          (newOrder as any).kepemilikanKendaraan = kepemilikanKendaraan;
          (newOrder as any).alamat = fullAlamat;
          (newOrder as any).uangMasuk = uangMasuk;
          (newOrder as any).uangKeluar = uangKeluar;
          (newOrder as any).biayaSamsat = uangKeluar;
          (newOrder as any).biayaJasa = biayaJasa || profit;
          (newOrder as any).biayaAntarJemput = biayaAntarJemput;
          (newOrder as any).biayaLainnya = biayaLainnya;
          (newOrder as any).namaPenerimaKeluar = namaPenerimaKeluar;
          (newOrder as any).namaPemilikRekeningKeluar = namaPenerimaKeluar;
          (newOrder as any).stafPengirim = stafPengirim;
          (newOrder as any).namaPenerima = namaPenerima;
          (newOrder as any).noRekeningPengirim = noRekeningPengirim;
          (newOrder as any).noRekeningPenerima = noRekeningPenerima;
          (newOrder as any).bankUangKeluar = bankUangKeluar;
          (newOrder as any).metodePembayaranKeluar = metodePembayaranKeluar;
          (newOrder as any).tanggalPengeluaranSamsat = row["Tanggal Uang Keluar"] || "";

          const invRecord = this.addInvoice({
            orderNo,
            customer,
            phone,
            nopol,
            jenisLayanan: layanan,
            totalTagihan: totalEst,
            terbayar: uangMasuk,
            metodePembayaran: metodePembayaranMasuk,
            dueTrigger: "AFTER_DOCUMENT_RECEIVED",
            collectionStatus: uangMasuk >= totalEst && totalEst > 0 ? "LUNAS" : "BELUM_JATUH_TEMPO",
            settlementCondition: cashback > 0 ? "OVERPAID" : "PENDING_FINALIZATION",
            refundStatus: "NONE",
            overpayment: cashback,
            invoice: row["No Invoice"] || row.invoiceNo || undefined,
          });
          newOrder.payment.invoiceNo = invRecord.invoice;
          invRecord.tandaTerima = tandaTerima;
          invRecord.ttbBPKB = ttbBPKB;
          invRecord.biayaSamsat = uangKeluar;
          (invRecord as any).biayaLainnya = biayaLainnya;
          invRecord.profit = profit;
          invRecord.cashback = cashback;
          invRecord.status = statusPembayaranVal as any;
          (invRecord as any).biayaJasa = biayaJasa || profit;
          (invRecord as any).biayaAntarJemput = biayaAntarJemput;
          (invRecord as any).namaPenerimaKeluar = namaPenerimaKeluar;
          (invRecord as any).stafPengirim = stafPengirim;
          (invRecord as any).namaPenerima = namaPenerima;
          (invRecord as any).noRekeningPengirim = noRekeningPengirim;
          (invRecord as any).noRekeningPenerima = noRekeningPenerima;
          (invRecord as any).bankUangKeluar = bankUangKeluar;
          (invRecord as any).metodePembayaranKeluar = metodePembayaranKeluar;

          orderRepository.saveOrder(newOrder);
        }
      }

      this.notify();
      return true;
    }

    // For non-operational categories (financial tabs 6-8)
    const dataset = this.contractDatasets[category];
    if (!dataset) return false;
    const numericIds = dataset
      .map((d: any) => (typeof d.id === "number" ? d.id : 0))
      .filter((n: number) => !isNaN(n));
    const nextId = (numericIds.length > 0 ? Math.max(...numericIds) : 0) + 1;
    const newItems = rows.map((row, i) => ({
      id: nextId + i,
      ...row,
    }));
    this.contractDatasets[category] = [...dataset, ...newItems];
    this.notify();
    return true;
  }

  public async addContractDataAsync(
    category: PenjualanContractCategory,
    rows: any[]
  ): Promise<ContractMutationResult> {
    const operationalCategories = new Set([
      "perpanjangan-1-tahun",
      "perpanjangan-5-tahun",
      "mutasi-asal",
      "mutasi-antar-daerah",
      "balik-nama",
      "tarik-berkas",
      "duplikat-stnk",
      "lainnya",
      "mutasi-ld",
      "mutasi-as",
      "bbn",
      "perpanjangan-pajak",
      "lain-lain",
    ]);

    if (!operationalCategories.has(category)) {
      const ok = this.addContractData(category, rows);
      return ok
        ? { success: true }
        : {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Gagal menyimpan data. Pastikan seluruh data transaksi valid.",
              statusCode: 400,
            },
          };
    }

    if (!rows || rows.length === 0) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Gagal menyimpan data. Minimal harus ada satu data transaksi.",
          statusCode: 400,
        },
      };
    }

    const resolveDefaultLayanan = (cat: PenjualanContractCategory) => {
      switch (cat) {
        case "perpanjangan-1-tahun":
        case "perpanjangan-pajak":
          return "Perpanjangan 1 Tahun";
        case "perpanjangan-5-tahun":
          return "Perpanjangan 5 Tahun";
        case "mutasi-asal":
        case "mutasi-as":
          return "Mutasi Asal Samsat";
        case "mutasi-antar-daerah":
        case "mutasi-ld":
          return "Mutasi Antar Daerah";
        case "balik-nama":
        case "bbn":
          return "Balik Nama";
        case "tarik-berkas":
        case "lain-lain":
          return "Tarik Berkas";
        case "duplikat-stnk":
          return "Duplikat STNK";
        case "lainnya":
          return "Lainnya";
        default:
          return "Perpanjangan 1 Tahun";
      }
    };

    const defaultLayanan = resolveDefaultLayanan(category);

    // 1. Strict client validation before network calls
    for (const row of rows) {
      const customer = (row["Nama Customer"] || row.customer || "").trim();
      const nopol = (row["Plat No"] || row.nopol || "").trim();
      const layanan = (row["Jenis Pengurusan"] || row.layanan || defaultLayanan).trim();
      const phone = (row["Nomor HP"] || row["No HP"] || row.nomorHP || row.phone || "").trim();
      const phoneDigits = phone.replace(/[^0-9]/g, "");

      if (!customer) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Gagal menyimpan data. Nama Customer wajib diisi.",
            field: "customer",
            statusCode: 400,
          },
        };
      }
      if (!nopol) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Gagal menyimpan data. Nomor Polisi wajib diisi lengkap.",
            field: "nopol",
            statusCode: 400,
          },
        };
      }
      if (!layanan) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Gagal menyimpan data. Jenis Pengurusan wajib diisi.",
            field: "layanan",
            statusCode: 400,
          },
        };
      }
      if (!phone || phoneDigits.length < 9 || phone === "081200000000") {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Gagal menyimpan data. Nomor HP / WhatsApp wajib diisi (minimal 9 digit angka).",
            field: "nomorHP",
            statusCode: 400,
          },
        };
      }
    }

    // 2. Async creation awaiting backend confirmation for each row
    try {
      for (const row of rows) {
        const customer = (row["Nama Customer"] || row.customer || "").trim();
        const nopol = (row["Plat No"] || row.nopol || "").trim();
        const layanan = (row["Jenis Pengurusan"] || row.layanan || defaultLayanan).trim();
        const phone = (row["Nomor HP"] || row["No HP"] || row.nomorHP || row.phone || "").trim();
        const alamat = (row["Alamat"] || row.alamat || "").trim();
        const namaPemilik = (row["Nama Pemilik (STNK/BPKB)"] || row["Nama"] || row.namaPemilik || "").trim();
        const samsat = (row["Samsat Asal"] || row["Samsat"] || row.samsat || "Jakarta Timur").trim();
        const r4r2 = row["R4 / R2"] || row.r4r2;
        const jenisKendaraan = r4r2 === "R2" ? "Motor" : "Mobil";
        const uangMasuk = Number(row["Uang Masuk dari Konsumen"] || row.uangMasuk) || 0;
        const uangKeluar = Number(row["Biaya Pokok Samsat"] || row["Uang Keluar dari Biro Jasa"] || row.uangKeluar) || 0;
        const biayaJasa = Number(row["Biaya Jasa"] || row.biayaJasa) || 0;
        const biayaAntarJemput = Number(row["Biaya Antar Jemput"] || row.biayaAntarJemput) || 0;
        const biayaLainnya = Number(row["Biaya Lainnya"] || row.biayaLainnya) || 0;
        const totalTagihan =
          Number(row["Total Tagihan Konsumen"] || row.totalTagihan) ||
          (biayaJasa > 0 || uangKeluar > 0 || biayaLainnya > 0
            ? uangKeluar + biayaJasa + biayaAntarJemput + biayaLainnya
            : uangMasuk > 0
            ? uangMasuk
            : 1500000);
        const profit = Number(
          row["Profit"] !== undefined
            ? row["Profit"]
            : row.profit !== undefined
            ? row.profit
            : uangMasuk - uangKeluar - biayaLainnya
        );
        const cashback = Math.max(0, uangMasuk - totalTagihan);
        const bpkb = row["BPKB"] || row.bpkb || "Ada";
        const isMutasiLD = category === "mutasi-ld" || category === "mutasi-antar-daerah";
        const namaPenerimaKeluar = (
          row["Nama Rekening/Penerima"] ||
          row["Nama Pemilik Rekening Keluar"] ||
          row.namaPenerimaKeluar ||
          row["Nama Penerima"] ||
          row.namaPenerima ||
          ""
        ).trim();
        const stafPengirim = (row["Staf Pengirim"] || row.stafPengirim || "").trim();
        const namaPenerima = (row["Nama Penerima"] || row.namaPenerima || namaPenerimaKeluar || "").trim();
        const noRekeningPengirim = (
          row["Nomor Rekening Pengirim"] ||
          row.noRekeningPengirim ||
          row["Nomor Rekening Masuk"] ||
          row.noRekeningMasuk ||
          ""
        ).trim();
        const noRekeningPenerima = (row["Nomor Rekening Penerima"] || row.noRekeningPenerima || "").trim();
        const bankUangKeluar = row["Bank Uang Keluar"] || "";
        const metodePembayaranKeluar = row["Metode Pembayaran Keluar"] || "";
        const metodePembayaranMasuk = row["Metode Pembayaran Masuk"] || "Transfer Bank";
        const bankUangMasuk = row["Bank Uang Masuk"] || "BCA";
        const noRekeningMasuk = noRekeningPengirim || row["Nomor Rekening Masuk"] || "";
        const namaRekeningMasuk = row["Nama Pemilik Rekening Masuk"] || "";

        const structuredAddr = row.alamatTerstruktur || row.alamatPenjemputan || {
          detail: (row.detailAlamat || row["Detail Alamat"] || alamat || "").trim(),
          kota: (row.kota || row["Kota/Kabupaten"] || samsat || "").trim(),
          kecamatan: (row.kecamatan || row["Kecamatan"] || "").trim(),
          kelurahan: (row.kelurahan || row["Kelurahan/Desa"] || "").trim(),
          rtRw: (row.rtRw || row["RT/RW"] || "").trim(),
          nomor: (row.nomorRumah || row["Nomor Rumah"] || "").trim(),
          landmark: (row.patokan || row["Patokan"] || "").trim(),
          mapsUrl: (row.linkLokasi || row["Link Lokasi"] || "").trim(),
        };

        const fullAlamat = (
          row["Alamat"] ||
          row.alamat ||
          [
            structuredAddr.detail,
            structuredAddr.nomor ? `No. ${structuredAddr.nomor}` : "",
            structuredAddr.rtRw ? `RT/RW ${structuredAddr.rtRw}` : "",
            structuredAddr.kelurahan ? `Kel. ${structuredAddr.kelurahan}` : "",
            structuredAddr.kecamatan ? `Kec. ${structuredAddr.kecamatan}` : "",
            structuredAddr.kota,
          ]
            .filter(Boolean)
            .join(", ")
        ).trim();

        const dokumenAwal = Array.isArray(row.dokumenAwal) ? row.dokumenAwal : [];
        const dokumenAkhir = Array.isArray(row.dokumenAkhir) ? row.dokumenAkhir : [];
        const rekapDocs: any[] = [
          ...dokumenAwal.map((d: any) => ({
            id: d.id || `doc-awal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderId: "",
            phase: "BEFORE" as const,
            documentType: "OTHER" as const,
            label: d.customName || d.originalName || d.name || "Dokumen Awal",
            fileType:
              d.mimeType?.includes("pdf") || (d.originalName || d.name || "").toLowerCase().endsWith(".pdf")
                ? ("PDF" as const)
                : ("IMAGE" as const),
            fileUrl: d.fileUrl || (d.id ? `/api/documents/${d.id}/preview` : ""),
            uploadedAt: d.createdAt || new Date().toISOString(),
            uploadedBy: "Admin",
            documentId: d.id,
          })),
          ...dokumenAkhir.map((d: any) => ({
            id: d.id || `doc-akhir-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderId: "",
            phase: "AFTER" as const,
            documentType: "OTHER" as const,
            label: d.customName || d.originalName || d.name || "Dokumen Akhir",
            fileType:
              d.mimeType?.includes("pdf") || (d.originalName || d.name || "").toLowerCase().endsWith(".pdf")
                ? ("PDF" as const)
                : ("IMAGE" as const),
            fileUrl: d.fileUrl || (d.id ? `/api/documents/${d.id}/preview` : ""),
            uploadedAt: d.createdAt || new Date().toISOString(),
            uploadedBy: "Admin",
            documentId: d.id,
          })),
        ];

        const statusPengerjaan = row["Status Pengerjaan"] || row.statusPengerjaan || (isMutasiLD ? "Pending" : "Dalam Proses");
        const isSelesai = statusPengerjaan === "Selesai";
        const kepemilikanKendaraan = row["Status Kepemilikan"] || row.kepemilikanKendaraan || "Pribadi";
        const noInvoice = row["No Invoice"] !== undefined ? row["No Invoice"] : isMutasiLD ? "" : row.invoiceNo || "";
        const tandaTerima = row["Tanda Terima"] !== undefined ? row["Tanda Terima"] : isMutasiLD ? "" : "-";
        const ttbBPKB = row["TTB BPKB"] !== undefined ? row["TTB BPKB"] : isMutasiLD ? "" : bpkb === "Ada" ? "-" : "-";
        const bpkbVal = row["BPKB"] !== undefined ? row["BPKB"] : isMutasiLD ? "" : bpkb;
        const statusBPKBVal = row["Status BPKB"] !== undefined ? row["Status BPKB"] : isMutasiLD ? "" : "-";
        const statusPembayaranVal =
          uangMasuk >= totalTagihan && totalTagihan > 0
            ? uangMasuk > totalTagihan
              ? "Kelebihan Bayar"
              : "Lunas"
            : uangMasuk > 0
            ? "Kurang Bayar"
            : "Belum Bayar";

        const alamatPenjemputanObj = {
          kota: structuredAddr.kota || "",
          kecamatan: structuredAddr.kecamatan || "",
          kelurahan: structuredAddr.kelurahan || "",
          detail: structuredAddr.detail || "",
          rtRw: structuredAddr.rtRw || "",
          nomor: structuredAddr.nomor || "",
          landmark: structuredAddr.landmark || "",
          mapsUrl: structuredAddr.mapsUrl || "",
        };

        if (this.orderAsyncCreator) {
          const res = await this.orderAsyncCreator({
            orderNo: row["Nomor Order"] || row.orderNo,
            tanggalMasukBerkas: row["Tanggal Masuk Berkas"] || row.tanggalMasukBerkas,
            tanggalUangMasuk: row["Tanggal Uang Masuk"] || row.tanggalUangMasuk,
            catatanOrder:
              row["Keterangan"] ||
              row.catatan ||
              row.catatanOrder ||
              (isMutasiLD
                ? `Order Mutasi LD dibuat langsung dari Data Penjualan (Status ${statusPengerjaan}).`
                : "Order dibuat dari Data Penjualan (+ Tambah Data)"),
            customer,
            nopol,
            layanan,
            namaPemilik,
            nomorHP: phone,
            alamat: fullAlamat,
            alamatPenjemputan: alamatPenjemputanObj,
            alamatPengantaran: { ...alamatPenjemputanObj },
            wilayahSamsatAsal: samsat,
            wilayahSamsatTujuan: row["Samsat Tujuan"] || "-",
            jenisKendaraan,
            biayaJasa: biayaJasa || profit,
            biayaAntarJemput,
            biayaLainnya,
            biayaSamsat: uangKeluar,
            totalEstimasi: totalTagihan,
            uangMasuk,
            uangKeluar,
            r4r2,
            bpkb: bpkbVal,
            statusBPKB: statusBPKBVal,
            noInvoice,
            invoiceNo: noInvoice,
            tandaTerima,
            ttbBPKB,
            statusPengerjaan,
            salesSnapshotStatus: statusPengerjaan,
            statusKepemilikan: kepemilikanKendaraan,
            statusPembayaran: statusPembayaranVal,
            currentStep: isSelesai ? 8 : 1,
            currentStageName: isSelesai ? "Dokumen Telah Diterima" : "Verifikasi",
            isArchived: isMutasiLD && isSelesai,
            rekapDocuments: rekapDocs,
            namaPenerimaKeluar,
            namaPemilikRekeningKeluar: namaPenerimaKeluar,
            bankUangKeluar,
            metodePembayaranKeluar,
            tanggalPengeluaranSamsat: row["Tanggal Uang Keluar"] || "",
            metodePembayaranMasuk,
            bankUangMasuk,
            noRekeningMasuk,
            namaRekeningMasuk,
            stafPengirim,
            namaPenerima,
            noRekeningPengirim,
            noRekeningPenerima,
            rejectDuplicateOrder: row.rejectDuplicateOrder,
            rejectDuplicateInvoice: row.rejectDuplicateInvoice,
          });

          if (res === false) {
            return {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "Gagal menyimpan data. Pastikan data transaksi lengkap dan valid.",
                statusCode: 400,
              },
            };
          }

          if (res && typeof res === "object" && res.orderNo) {
            const finalOrderNo = res.orderNo;
            for (const doc of [...dokumenAwal, ...dokumenAkhir]) {
              if (doc?.id) {
                await documentRepository.linkOrder?.(doc.id, finalOrderNo).catch(() => {});
              }
            }

            (res as any).salesSnapshotStatus = statusPengerjaan;
            (res as any).statusPengerjaan = statusPengerjaan;
            (res as any).statusPembayaran = statusPembayaranVal;
            (res as any).tandaTerima = tandaTerima;
            (res as any).ttbBPKB = ttbBPKB;
            (res as any).noInvoice = res.noInvoice || res.payment?.invoiceNo || noInvoice;
            (res as any).bpkb = bpkbVal;
            (res as any).statusBPKB = statusBPKBVal;
            (res as any).kepemilikanKendaraan = kepemilikanKendaraan;
            (res as any).alamat = fullAlamat;
            (res as any).uangMasuk = uangMasuk;
            (res as any).uangKeluar = uangKeluar;
            (res as any).biayaSamsat = uangKeluar;
            (res as any).biayaJasa = biayaJasa || profit;
            (res as any).biayaAntarJemput = biayaAntarJemput;
            (res as any).biayaLainnya = biayaLainnya;
            (res as any).namaPenerimaKeluar = namaPenerimaKeluar;
            (res as any).namaPemilikRekeningKeluar = namaPenerimaKeluar;
            (res as any).stafPengirim = stafPengirim;
            (res as any).namaPenerima = namaPenerima;
            (res as any).noRekeningPengirim = noRekeningPengirim;
            (res as any).noRekeningPenerima = noRekeningPenerima;
            (res as any).bankUangKeluar = bankUangKeluar;
            (res as any).metodePembayaranKeluar = metodePembayaranKeluar;
            (res as any).tanggalPengeluaranSamsat = row["Tanggal Uang Keluar"] || "";

            if (isMutasiLD && isSelesai) {
              res.currentStep = 8;
              res.currentStageName = "Dokumen Telah Diterima";
              res.isArchived = true;
              await orderRepository.archiveOrderAsync?.(finalOrderNo).catch(() => {});
            }
          }
        } else {
          // Direct async repository creation fallback when orderAsyncCreator is not wired
          const allOrders = [
            ...orderRepository.getAllFlat(),
            ...(typeof orderRepository.getArchivedOrders === "function" ? orderRepository.getArchivedOrders() : []),
          ];
          const existingNums = allOrders
            .map((o) => parseInt((o.orderNo || "").replace(/\D/g, ""), 10))
            .filter((n) => !isNaN(n));
          const nextOrderNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 101;
          const orderNo = row["Nomor Order"] || row.orderNo || `ORD-${String(nextOrderNum).padStart(4, "0")}`;
          const clientRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const totalEst = totalTagihan;

          const newOrder: OperationalOrder = {
            orderNo,
            clientRequestId,
            customer,
            nomorHP: phone,
            layanan,
            currentStep: isSelesai ? 8 : 1,
            currentStageName: isSelesai ? "Dokumen Telah Diterima" : "Verifikasi",
            catatanOrder:
              row["Keterangan"] ||
              row.catatan ||
              (isMutasiLD
                ? `Order Mutasi LD dibuat langsung dari Data Penjualan (Status ${statusPengerjaan}).`
                : "Order dibuat dari Data Penjualan (+ Tambah Data)."),
            createdAt: row["Tanggal Masuk Berkas"] || new Date().toISOString().split("T")[0],
            isArchived: isMutasiLD && isSelesai,
            namaPemilik: namaPemilik || "-",
            kepemilikanKendaraan,
            jenisKendaraan,
            tahunKendaraan: new Date().getFullYear(),
            nopol,
            pkbBerlakuSd: "",
            tahunPajak: String(new Date().getFullYear()),
            bulanPajak: "Januari",
            nominalPkbTerakhir: 0,
            nominalSwdkllj: 143000,
            wilayahSamsatAsal: samsat,
            wilayahSamsatTujuan: row["Samsat Tujuan"] || "-",
            alamatPenjemputan: alamatPenjemputanObj,
            alamatPengantaran: { ...alamatPenjemputanObj },
            clientDocuments: {
              stnk: { name: "STNK.pdf", status: "Sudah Tersedia", isOptional: false },
              bpkb: { name: "BPKB.pdf", status: bpkb === "Ada" ? "Sudah Tersedia" : "Belum Tersedia", isOptional: false },
              ktp: { name: "KTP.pdf", status: "Sudah Tersedia", isOptional: false },
            },
            updatedDocuments: [],
            biayaJasa: biayaJasa || profit,
            biayaAntarJemput,
            namaPenerimaKeluar,
            bankUangKeluar,
            metodePembayaranKeluar,
            tanggalPengeluaranSamsat: row["Tanggal Uang Keluar"] || "",
            pkb: 0,
            swdkllj: 143000,
            dendaSwdkllj: 0,
            totalEstimasi: totalEst,
            samsatProcesses: [],
            payment: {
              tipePembayaran: uangMasuk >= totalEst && totalEst > 0 ? "Bayar di Awal" : "Bayar di Akhir",
              metodePembayaran: /cash|tunai/i.test(metodePembayaranMasuk)
                ? "Cash"
                : /^qris$/i.test(metodePembayaranMasuk)
                ? "QRIS"
                : bankUangMasuk && bankUangMasuk !== "-" && bankUangMasuk !== "Lainnya" && !/^kas\b/i.test(bankUangMasuk)
                ? (metodePembayaranMasuk.toLowerCase().includes(bankUangMasuk.toLowerCase()) ? metodePembayaranMasuk : `Transfer ${bankUangMasuk}`)
                : metodePembayaranMasuk,
              namaBank: bankUangMasuk,
              noRekening: noRekeningMasuk,
              namaRekening: namaRekeningMasuk,
              statusPembayaran: statusPembayaranVal as any,
              totalBiaya: totalEst,
              totalEstimasi: totalEst,
              dibayar: uangMasuk,
              kurang: Math.max(0, totalEst - uangMasuk),
              overpayment: cashback,
              settlementCondition: cashback > 0 ? "OVERPAID" : "PENDING_FINALIZATION",
              refundStatus: "NONE",
              isPaymentVerified: uangMasuk >= totalEst && totalEst > 0,
              invoiceNo: noInvoice || undefined,
              paymentRecords: [
                {
                  id: `PAY-${Date.now()}`,
                  nominal: uangMasuk,
                  tanggal: row["Tanggal Uang Masuk"] || new Date().toISOString().split("T")[0],
                  metodePembayaran: metodePembayaranMasuk,
                  namaBank: bankUangMasuk,
                  noRekening: noRekeningMasuk,
                  namaRekening: namaRekeningMasuk,
                  statusVerifikasi: uangMasuk > 0 ? "MENUNGGU_VERIFIKASI" : "MENUNGGU_BUKTI",
                },
              ],
            },
            rekapDocuments: rekapDocs,
          };

          (newOrder as any).statusPengerjaan = statusPengerjaan;
          (newOrder as any).salesSnapshotStatus = statusPengerjaan;
          (newOrder as any).statusPembayaran = statusPembayaranVal;
          (newOrder as any).tandaTerima = tandaTerima;
          (newOrder as any).ttbBPKB = ttbBPKB;
          (newOrder as any).noInvoice = noInvoice;
          (newOrder as any).bpkb = bpkbVal;
          (newOrder as any).statusBPKB = statusBPKBVal;
          (newOrder as any).kepemilikanKendaraan = kepemilikanKendaraan;
          (newOrder as any).alamat = fullAlamat;
          (newOrder as any).uangMasuk = uangMasuk;
          (newOrder as any).uangKeluar = uangKeluar;
          (newOrder as any).biayaSamsat = uangKeluar;
          (newOrder as any).biayaJasa = biayaJasa || profit;
          (newOrder as any).biayaAntarJemput = biayaAntarJemput;
          (newOrder as any).biayaLainnya = biayaLainnya;
          (newOrder as any).namaPenerimaKeluar = namaPenerimaKeluar;
          (newOrder as any).namaPemilikRekeningKeluar = namaPenerimaKeluar;
          (newOrder as any).stafPengirim = stafPengirim;
          (newOrder as any).namaPenerima = namaPenerima;
          (newOrder as any).noRekeningPengirim = noRekeningPengirim;
          (newOrder as any).noRekeningPenerima = noRekeningPenerima;
          (newOrder as any).bankUangKeluar = bankUangKeluar;
          (newOrder as any).metodePembayaranKeluar = metodePembayaranKeluar;
          (newOrder as any).tanggalPengeluaranSamsat = row["Tanggal Uang Keluar"] || "";
          (newOrder as any).rejectDuplicateOrder = row.rejectDuplicateOrder;
          (newOrder as any).rejectDuplicateInvoice = row.rejectDuplicateInvoice;

          const savedOrder = typeof orderRepository.saveOrderAsync === "function"
            ? await orderRepository.saveOrderAsync(newOrder)
            : (orderRepository.saveOrder(newOrder), newOrder);

          const confirmedOrderNo = savedOrder?.orderNo || orderNo;
          const invRecord = this.addInvoice({
            orderNo: confirmedOrderNo,
            customer,
            phone,
            nopol,
            jenisLayanan: layanan,
            totalTagihan: totalEst,
            terbayar: uangMasuk,
            metodePembayaran: metodePembayaranMasuk,
            dueTrigger: "AFTER_DOCUMENT_RECEIVED",
            collectionStatus: uangMasuk >= totalEst && totalEst > 0 ? "LUNAS" : "BELUM_JATUH_TEMPO",
            settlementCondition: cashback > 0 ? "OVERPAID" : "PENDING_FINALIZATION",
            refundStatus: "NONE",
            overpayment: cashback,
            invoice: savedOrder?.payment?.invoiceNo || noInvoice || undefined,
          });
          if (savedOrder?.payment) savedOrder.payment.invoiceNo = invRecord.invoice;
          invRecord.tandaTerima = tandaTerima;
          invRecord.ttbBPKB = ttbBPKB;
          invRecord.biayaSamsat = uangKeluar;
          (invRecord as any).biayaLainnya = biayaLainnya;
          invRecord.profit = profit;
          invRecord.cashback = cashback;
          invRecord.status = statusPembayaranVal as any;

          for (const doc of [...dokumenAwal, ...dokumenAkhir]) {
            if (doc?.id) {
              await documentRepository.linkOrder?.(doc.id, confirmedOrderNo).catch(() => {});
            }
          }
        }
      }

      this.notify();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code:
            err?.code ||
            (err?.statusCode === 404
              ? "NOT_FOUND"
              : err?.statusCode === 403
              ? "FORBIDDEN"
              : err?.statusCode === 401
              ? "UNAUTHENTICATED"
              : err?.statusCode === 409
              ? "DUPLICATE_RECORD"
              : err?.statusCode === 422
              ? "CONFLICT"
              : err?.statusCode === 400
              ? "VALIDATION_ERROR"
              : err?.statusCode === 0
              ? "NETWORK_ERROR"
              : "SERVER_ERROR"),
          message: err?.detail || err?.message || "Gagal menyimpan data order baru ke server.",
          field: err?.field,
          statusCode: err?.statusCode,
        },
      };
    }
  }

  public deleteContractData(category: PenjualanContractCategory, id: number | string): boolean {
    if (category === "belum-kurang-bayar" || category === "profit-terpending" || category === "cashback-terpending") {
      console.warn(`[FinanceStore] Penghapusan dilarang pada submenu ${category}. Gunakan alur operasional resmi.`);
      return false;
    }

    let cleanOrderNo: string | null = null;
    if (typeof id === "string" && id.startsWith("ord:")) {
      cleanOrderNo = id.slice(4).trim().toUpperCase();
    } else if (typeof id === "string" && id.toUpperCase().startsWith("ORD-")) {
      cleanOrderNo = id.trim().toUpperCase();
    }

    if (cleanOrderNo) {
      this.deletedOrderNos.add(cleanOrderNo);
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const stored = JSON.parse(localStorage.getItem("sun89_deleted_order_nos") || "[]");
          if (!stored.includes(cleanOrderNo)) {
            stored.push(cleanOrderNo);
            localStorage.setItem("sun89_deleted_order_nos", JSON.stringify(stored));
          }
        }
      } catch {}
    }

    // Filter out from contract datasets across all categories
    for (const cat of Object.keys(this.contractDatasets) as PenjualanContractCategory[]) {
      const dataset = this.contractDatasets[cat];
      if (Array.isArray(dataset)) {
        this.contractDatasets[cat] = dataset.filter((d: any) => {
          if (d.id === id || String(d.id) === String(id)) return false;
          if (cleanOrderNo) {
            const rowOrderNo = (d.orderNo || d["Nomor Order"] || d["No Order"] || "").toUpperCase();
            if (rowOrderNo === cleanOrderNo) return false;
          }
          return true;
        });
      }
    }

    // Filter out from invoices
    if (cleanOrderNo) {
      this.invoices = this.invoices.filter((inv) => {
        if (inv.id === id || String(inv.id) === String(id)) return false;
        if ((inv.orderNo || "").toUpperCase() === cleanOrderNo) return false;
        if ((inv.invoiceNo || "").toUpperCase() === cleanOrderNo) return false;
        return true;
      });
    } else {
      this.invoices = this.invoices.filter((inv) => inv.id !== id && String(inv.id) !== String(id));
    }

    // Attempt removal from underlying orderRepository provider
    if (cleanOrderNo) {
      try {
        const provider: any = (orderRepository as any).provider || (orderRepository as any).getProvider?.();
        if (provider) {
          if (provider.activeOrders) {
            for (const stage of Object.keys(provider.activeOrders)) {
              if (Array.isArray(provider.activeOrders[stage])) {
                provider.activeOrders[stage] = provider.activeOrders[stage].filter(
                  (o: any) => (o.orderNo || "").toUpperCase() !== cleanOrderNo
                );
              }
            }
          }
          if (Array.isArray(provider.archivedOrders)) {
            provider.archivedOrders = provider.archivedOrders.filter(
              (o: any) => (o.orderNo || "").toUpperCase() !== cleanOrderNo
            );
          }
          if (typeof provider.notify === "function") {
            provider.notify();
          }
        }
        if (typeof (orderRepository as any).deleteOrder === "function") {
          Promise.resolve((orderRepository as any).deleteOrder(cleanOrderNo)).catch(() => {});
        } else if (typeof (orderRepository as any).deleteArchivedOrder === "function") {
          (orderRepository as any).deleteArchivedOrder(cleanOrderNo);
        }
      } catch (err) {
        console.warn("[FinanceStore] Error removing order from provider during hard delete:", err);
      }
    }

    this.notify();
    return true;
  }

  public async deleteContractDataAsync(
    category: PenjualanContractCategory,
    id: number | string,
    explicitOrderNo?: string
  ): Promise<boolean> {
    let cleanOrderNo: string | null = explicitOrderNo
      ? explicitOrderNo.trim().toUpperCase()
      : null;
    if (!cleanOrderNo) {
      if (typeof id === "string" && id.startsWith("ord:")) {
        cleanOrderNo = id.slice(4).trim().toUpperCase();
      } else if (typeof id === "string" && id.toUpperCase().startsWith("ORD-")) {
        cleanOrderNo = id.trim().toUpperCase();
      }
    }

    // In API mode or when deleting a persisted order row, confirm backend DELETE FIRST before purging local state
    if (cleanOrderNo && typeof (orderRepository as any).deleteOrder === "function") {
      await (orderRepository as any).deleteOrder(cleanOrderNo);
    }

    // Apply local cache cleanup without issuing a second/redundant backend DELETE request
    if (cleanOrderNo) {
      this.deletedOrderNos.add(cleanOrderNo);
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const stored = JSON.parse(localStorage.getItem("sun89_deleted_order_nos") || "[]");
          if (!stored.includes(cleanOrderNo)) {
            stored.push(cleanOrderNo);
            localStorage.setItem("sun89_deleted_order_nos", JSON.stringify(stored));
          }
        }
      } catch {}
    }

    for (const cat of Object.keys(this.contractDatasets) as PenjualanContractCategory[]) {
      const dataset = this.contractDatasets[cat];
      if (Array.isArray(dataset)) {
        this.contractDatasets[cat] = dataset.filter((d: any) => {
          if (d.id === id || String(d.id) === String(id)) return false;
          if (cleanOrderNo) {
            const rowOrderNo = (d.orderNo || d["Nomor Order"] || d["No Order"] || "").toUpperCase();
            if (rowOrderNo === cleanOrderNo) return false;
          }
          return true;
        });
      }
    }

    if (cleanOrderNo) {
      this.invoices = this.invoices.filter((inv) => {
        if (inv.id === id || String(inv.id) === String(id)) return false;
        if ((inv.orderNo || "").toUpperCase() === cleanOrderNo) return false;
        if ((inv.invoiceNo || "").toUpperCase() === cleanOrderNo) return false;
        return true;
      });
    } else {
      this.invoices = this.invoices.filter((inv) => inv.id !== id && String(inv.id) !== String(id));
    }

    this.notify();
    return true;
  }

  public async cancelSalesOrder(orderNo: string, reason?: string): Promise<boolean> {
    const cleanNo = (orderNo || "").trim().toUpperCase();
    try {
      if (typeof orderRepository.cancelOrder === "function") {
        await orderRepository.cancelOrder(cleanNo, reason);
      }
      // Update matching invoice in invoices
      const inv = this.invoices.find((i) => (i.orderNo && i.orderNo.toUpperCase() === cleanNo) || (i.invoiceNo && i.invoiceNo.toUpperCase() === cleanNo));
      if (inv) {
        inv.status = "CANCELLED" as any;
        inv.billingStatus = "CANCELLED" as any;
        (inv as any).isCancelled = true;
        (inv as any).cancellationReason = reason;
        const paid = Number(inv.dibayar ?? inv.terbayar ?? 0);
        if (paid > 0) {
          inv.overpayment = paid;
          inv.refundStatus = "PENDING" as any;
          inv.settlementCondition = "OVERPAID" as any;
        }
      }
      // Update matching rows across contract datasets
      for (const cat of Object.keys(this.contractDatasets) as PenjualanContractCategory[]) {
        const dataset = this.contractDatasets[cat];
        if (Array.isArray(dataset)) {
          this.contractDatasets[cat] = dataset.map((item: any) => {
            const itemOrderNo = (item.orderNo || item["Nomor Order"] || item["No Order"] || (typeof item.id === "string" && item.id.startsWith("ord:") ? item.id.slice(4) : "")).toUpperCase();
            if (itemOrderNo === cleanNo) {
              return {
                ...item,
                Status: "Dibatalkan",
                "Status Pengerjaan": "Dibatalkan",
                "Status Pembayaran": "Dibatalkan",
                isCancelled: true,
                cancellationReason: reason,
              };
            }
            return item;
          });
        }
      }
      this.notify();
      return true;
    } catch (err) {
      console.error("Failed to cancel sales order in financeStore:", err);
      throw err;
    }
  }

  // ==========================================
  // REIMBURSEMENT (PENGAJUAN BIAYA)
  // ==========================================

  public getReimbursements(employeeId?: string): ReimbursementRequest[] {
    if (employeeId) {
      return this.reimbursementRequests.filter((r) => r.employeeId === employeeId);
    }
    return this.reimbursementRequests;
  }

  public async refreshReimbursements(): Promise<void> {
    if (!this.isApiMode) return;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (token) {
        const res = await fetch(`${APP_CONFIG.apiBaseUrl}/messenger/reimbursements`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json();
        if (payload.success && Array.isArray(payload.data)) {
          this.reimbursementRequests = payload.data;
          this.notify();
        }
      }
    } catch {}
  }

  public async submitReimbursement(
    data: Omit<ReimbursementRequest, "id" | "status" | "submittedAt">
  ): Promise<{ success: boolean; data?: ReimbursementRequest; error?: string }> {
    if (this.isApiMode) {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        if (!token) {
          return { success: false, error: "Sesi login tidak valid. Silakan login kembali." };
        }

        const res = await fetch(`${APP_CONFIG.apiBaseUrl}/messenger/reimbursements`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        });

        const payload = await res.json();
        if (!res.ok || !payload.success) {
          const errMsg = payload.error?.message || payload.message || "Gagal menyimpan pengajuan biaya di server.";
          return { success: false, error: errMsg };
        }

        const savedReq: ReimbursementRequest = payload.data;
        this.reimbursementRequests = [
          savedReq,
          ...this.reimbursementRequests.filter((r) => r.id !== savedReq.id),
        ];
        this.notify();

        try {
          auditLog.log({
            userId: data.employeeId,
            userName: data.messengerName,
            userRole: "messenger",
            action: "CREATE",
            module: "Reimbursement",
            details: `Pengajuan biaya operasional ${data.category} sebesar Rp ${data.amount.toLocaleString("id-ID")}${data.orderNo ? ` (Order ${data.orderNo})` : ""}`,
            metadata: { reimbursementId: savedReq.id, amount: data.amount, category: data.category, orderNo: data.orderNo },
          });
        } catch {}

        return { success: true, data: savedReq };
      } catch (err: any) {
        return { success: false, error: err?.message || "Terjadi kesalahan jaringan saat mengirim pengajuan biaya." };
      }
    }

    const nextNum = this.reimbursementRequests.length + 1;
    const newReq: ReimbursementRequest = {
      ...data,
      id: `REIMB-${String(nextNum).padStart(3, "0")}`,
      status: "Diajukan",
      submittedAt: new Date().toISOString(),
    };
    this.reimbursementRequests.unshift(newReq);
    this.notify();
    return { success: true, data: newReq };
  }

  public async reviewReimbursement(
    id: string,
    decision: "Disetujui" | "Ditolak" | "Sedang Ditinjau",
    reviewer: { role: string; userName: string },
    reviewNotes?: string,
    approvedAmount?: number,
    rejectedAmount?: number
  ): Promise<{ success: boolean; data?: ReimbursementRequest; error?: string }> {
    if (reviewer.role === "messenger") {
      return { success: false, error: "Messenger tidak memiliki hak untuk mereview pengajuan biaya." };
    }

    const req = this.reimbursementRequests.find((r) => r.id === id);
    if (!req && !this.isApiMode) {
      return { success: false, error: `Pengajuan biaya '${id}' tidak ditemukan.` };
    }

    const finalApproved = approvedAmount !== undefined ? approvedAmount : (decision === "Disetujui" ? (req?.amount || 0) : 0);
    const finalRejected = rejectedAmount !== undefined ? rejectedAmount : (decision === "Ditolak" ? (req?.amount || 0) : ((req?.amount || 0) - finalApproved));

    if (this.isApiMode) {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        if (!token) {
          return { success: false, error: "Sesi login tidak valid. Silakan login kembali." };
        }

        const res = await fetch(`${APP_CONFIG.apiBaseUrl}/messenger/reimbursements/${id}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            decision,
            reviewNotes,
            approvedAmount: finalApproved,
            rejectedAmount: finalRejected,
          }),
        });

        const payload = await res.json();
        if (!res.ok || !payload.success) {
          const errMsg = payload.message || payload.error?.message || `Gagal mereview pengajuan (HTTP ${res.status})`;
          return { success: false, error: errMsg };
        }

        const updatedData: ReimbursementRequest = payload.data;
        const idx = this.reimbursementRequests.findIndex((r) => r.id === id);
        if (idx !== -1) {
          this.reimbursementRequests[idx] = updatedData;
        } else {
          this.reimbursementRequests.unshift(updatedData);
        }

        try {
          auditLog.log({
            userId: "usr-finance",
            userName: reviewer.userName,
            userRole: reviewer.role as any,
            action: "UPDATE",
            module: "Reimbursement Review",
            details: `Pengajuan biaya ${id} (${updatedData.messengerName}) diubah status menjadi ${decision}${finalApproved > 0 ? ` (Disetujui Rp ${finalApproved.toLocaleString("id-ID")})` : ""}`,
            metadata: { id, status: decision, approvedAmount: finalApproved, rejectedAmount: finalRejected },
          });
        } catch {}

        this.notify();
        return { success: true, data: updatedData };
      } catch (err: any) {
        return { success: false, error: err?.message || "Terjadi kesalahan jaringan saat memproses review." };
      }
    }

    if (!req) return { success: false, error: "Pengajuan tidak ditemukan." };
    if (req.status === "Dibayar") {
      return { success: false, error: "Pengajuan biaya sudah dicairkan/dibayar dan tidak dapat diubah lagi." };
    }
    if (req.status === "Disetujui" && decision === "Disetujui") {
      return { success: false, error: "Pengajuan biaya ini sudah disetujui sebelumnya." };
    }

    req.status = decision;
    req.reviewedAt = new Date().toISOString();
    req.reviewedBy = reviewer.userName;
    req.approvedAmount = finalApproved;
    req.rejectedAmount = finalRejected;
    if (reviewNotes !== undefined) req.reviewNotes = reviewNotes;

    try {
      auditLog.log({
        userId: "usr-finance",
        userName: reviewer.userName,
        userRole: reviewer.role as any,
        action: "UPDATE",
        module: "Reimbursement Review",
        details: `Pengajuan biaya ${id} (${req.messengerName}) diubah status menjadi ${decision}${finalApproved > 0 ? ` (Disetujui Rp ${finalApproved.toLocaleString("id-ID")})` : ""}`,
        metadata: { id, status: decision, approvedAmount: finalApproved, rejectedAmount: finalRejected },
      });
    } catch {}

    this.notify();
    return { success: true, data: req };
  }

  public payReimbursement(
    id: string,
    payer: { role: string; userName: string },
    options?: { paymentMethod?: string; channel?: string }
  ): boolean {
    if (payer.role === "messenger") {
      return false; // Messengers cannot disburse payments!
    }

    const req = this.reimbursementRequests.find((r) => r.id === id);
    if (!req) return false;

    if (req.status === "Dibayar") {
      console.warn(`[FinanceStore] Reimbursement ${id} sudah dibayarkan.`);
      return false; // Idempotency protection against double payout
    }

    const nowStr = new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();
    const amountToPay = req.approvedAmount !== undefined && req.approvedAmount > 0
      ? req.approvedAmount
      : req.amount;

    // Create real cash outflow in Kas Messenger
    const kasMessengerItem = this.addKasMessenger({
      tanggal: nowStr,
      jenis: "Operasional",
      messenger: req.messengerName,
      keterangan: `Reimbursement ${req.category}: ${req.note || req.category}${req.orderNo ? ` (${req.orderNo})` : ""} [Ref: ${id}]`,
      in: 0,
      out: amountToPay,
      orderNo: req.orderNo,
      penanggungJawab: payer.userName,
      reimbursementId: req.id,
      receiptUrl: req.receiptUrl,
      kategori: req.category,
    } as any);

    req.status = "Dibayar";
    req.paidAt = nowIso;
    req.paidBy = payer.userName;
    req.kasMessengerId = kasMessengerItem?.id;
    req.channel = options?.channel || "Kas Messenger";
    req.paymentMethod = options?.paymentMethod || "Kas Messenger (Tunai)";

    try {
      auditLog.log({
        userId: "usr-finance",
        userName: payer.userName,
        userRole: payer.role as any,
        action: "UPDATE",
        module: "Reimbursement Payout",
        details: `Pencairan reimbursement ${id} sebesar Rp ${amountToPay.toLocaleString("id-ID")} kepada ${req.messengerName} dibukukan ke Kas Messenger`,
        metadata: { id, amount: amountToPay, kasMessengerId: kasMessengerItem?.id },
      });
    } catch {}

    if (this.isApiMode) {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        if (token) {
          fetch(`${APP_CONFIG.apiBaseUrl}/messenger/reimbursements/${id}/pay`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              paymentMethod: req.paymentMethod || "Kas Messenger (Tunai)",
              transactionRef: req.transactionRef || `TRX-REIMB-${id}`,
              channel: req.channel || "Kas Messenger",
            }),
          }).catch(() => {});
        }
      } catch {}
    }

    this.notify();
    return true;
  }
}

// Global Singleton Instance
export const financeStore = new FinanceStore();

// React Hook
export function useFinanceStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return financeStore.subscribe(() => setTick((t) => t + 1));
  }, []);

  return {
    invoices: financeStore.getInvoices(),
    tagihanList: financeStore.getTagihanList(),
    completedTagihanList: financeStore.getCompletedTagihanList(),
    profitList: financeStore.getProfitList(),
    refundPendingList: financeStore.getRefundPendingList(),
    profitPendingList: financeStore.getProfitPendingList(),
    cashbackPendingList: financeStore.getCashbackPendingList(),
    belumBayarList: financeStore.getBelumBayarList(),
    kasKantorList: financeStore.getKasKantorList(),
    kasMessengerList: financeStore.getKasMessengerList(),
    pengeluaranList: financeStore.getPengeluaranList(),
    labaRugiData: financeStore.getLabaRugiData(),
    getLabaRugiData: financeStore.getLabaRugiData.bind(financeStore),
    getCanonicalLabaRugi: financeStore.getCanonicalLabaRugi.bind(financeStore),
    getCashFlowReconciliation: financeStore.getCashFlowReconciliation.bind(financeStore),

    // Contract Data for DataPenjualan
    getContractData: financeStore.getContractData.bind(financeStore),
    updateContractData: financeStore.updateContractData.bind(financeStore),
    updateContractDataAsync: financeStore.updateContractDataAsync.bind(financeStore),
    addContractData: financeStore.addContractData.bind(financeStore),
    addContractDataAsync: financeStore.addContractDataAsync.bind(financeStore),
    deleteContractData: financeStore.deleteContractData.bind(financeStore),
    cancelSalesOrder: financeStore.cancelSalesOrder.bind(financeStore),

    // Operations
    recordPayment: financeStore.recordPayment.bind(financeStore),
    resolveInvoice: financeStore.resolveInvoice.bind(financeStore),
    completeInvoice: financeStore.completeInvoice.bind(financeStore),
    addInvoice: financeStore.addInvoice.bind(financeStore),
    updateInvoice: financeStore.updateInvoice.bind(financeStore),
    deleteInvoice: financeStore.deleteInvoice.bind(financeStore),
    reconcileOrderNo: financeStore.reconcileOrderNo.bind(financeStore),
    removeInvoiceByOrderNo: financeStore.removeInvoiceByOrderNo.bind(financeStore),
    addKasKantor: financeStore.addKasKantor.bind(financeStore),
    updateKasKantor: financeStore.updateKasKantor.bind(financeStore),
    deleteKasKantor: financeStore.deleteKasKantor.bind(financeStore),
    addKasMessenger: financeStore.addKasMessenger.bind(financeStore),
    updateKasMessenger: financeStore.updateKasMessenger.bind(financeStore),
    deleteKasMessenger: financeStore.deleteKasMessenger.bind(financeStore),
    addPengeluaran: financeStore.addPengeluaran.bind(financeStore),
    updatePengeluaran: financeStore.updatePengeluaran.bind(financeStore),
    deletePengeluaran: financeStore.deletePengeluaran.bind(financeStore),
    updateInvoiceFromOrder: financeStore.updateInvoiceFromOrder.bind(financeStore),
    processRefund: financeStore.processRefund.bind(financeStore),
    processCashbackPayment: financeStore.processCashbackPayment.bind(financeStore),
    voidInvoicePayment: financeStore.voidInvoicePayment.bind(financeStore),
    voidCashbackPayout: financeStore.voidCashbackPayout.bind(financeStore),
    getVoidAuditHistory: financeStore.getVoidAuditHistory.bind(financeStore),
    dismissCashback: financeStore.dismissCashback.bind(financeStore),
    onPaymentSync: financeStore.onPaymentSync.bind(financeStore),

    // Reimbursement (Pengajuan Biaya)
    reimbursements: financeStore.getReimbursements(),
    getReimbursements: financeStore.getReimbursements.bind(financeStore),
    refreshReimbursements: financeStore.refreshReimbursements.bind(financeStore),
    submitReimbursement: financeStore.submitReimbursement.bind(financeStore),
    reviewReimbursement: financeStore.reviewReimbursement.bind(financeStore),
    payReimbursement: financeStore.payReimbursement.bind(financeStore),
  };
}
