/**
 * Real API Finance Data Provider
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Implements IFinanceDataProvider connecting to the Express REST API.
 * Keeps an in-memory cache synchronized with the backend (/api/finance)
 * and handles optimistic updates with deterministic rollback on failure.
 */

import {
  InvoiceBillingRecord,
  ProfitItem,
  KasKantorItem,
  KasMessengerItem,
  PengeluaranItem,
} from "../../domain/finance/types";
import { IFinanceDataProvider } from "../mock/mockFinanceProvider";
import { isFullyPaid, toFinancePaymentStatus, toCanonicalPaymentStatus } from "../../domain/finance/paymentMapping";
import { APP_CONFIG } from "../../app/config/appConfig";

export class ApiFinanceProvider implements IFinanceDataProvider {
  private baseUrl: string;
  private invoices: InvoiceBillingRecord[] = [];
  private kasKantor: KasKantorItem[] = [];
  private kasMessenger: KasMessengerItem[] = [];
  private pengeluaran: PengeluaranItem[] = [];
  private profitData: ProfitItem[] = [];
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;
  private isLoadingState = false;
  private lastError: Error | null = null;

  constructor(baseUrl = APP_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    if (typeof window === "undefined" || (typeof window !== "undefined" && window.localStorage?.getItem("auth_token"))) {
      this.initFromApi();
    }
  }

  private getAuthHeader(): Record<string, string> {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const token = window.localStorage.getItem("auth_token");
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

  private normalizeInvoice(inv: any): InvoiceBillingRecord {
    const totalTagihan = Number(inv.totalTagihan ?? inv.total_tagihan ?? 0);
    const dibayar = Number(inv.dibayar ?? inv.terbayar ?? 0);
    const sisa = inv.sisa !== undefined ? Number(inv.sisa) : Math.max(0, totalTagihan - dibayar);
    const canonicalStatus = toCanonicalPaymentStatus(inv.status, totalTagihan, dibayar);
    const financeStatus = toFinancePaymentStatus(canonicalStatus);

    return {
      id: Number(inv.id),
      invoiceNo: inv.invoiceNo || inv.invoice_no || inv.invoice || `INV-${inv.id}`,
      orderNo: inv.orderNo || inv.order_no,
      customer: inv.customer || "Pelanggan",
      layanan: inv.layanan || inv.jenisLayanan || "Layanan Samsat",
      jenisLayanan: inv.jenisLayanan || inv.layanan || "Layanan Samsat",
      nopol: inv.nopol || "-",
      totalTagihan,
      terbayar: dibayar,
      dibayar,
      sisa,
      status: financeStatus,
      tanggal: inv.tanggal || inv.tanggalInvoice || inv.createdAt || new Date().toLocaleDateString("id-ID"),
      jatuhTempo: inv.jatuhTempo || "2026-10-15",
      invoice: inv.invoice || inv.invoiceNo || `INV-${inv.id}`,
      phone: inv.phone || inv.nomorHp,
      email: inv.email,
      alamat: inv.alamat,
      biayaSamsat: inv.biayaSamsat !== undefined ? Number(inv.biayaSamsat) : (inv.biaya_samsat !== undefined ? Number(inv.biaya_samsat) : 0),
      profit: inv.profit !== undefined ? Number(inv.profit) : (inv.profit_final !== undefined ? Number(inv.profit_final) : 0),
      profitStatus: inv.profitStatus || inv.profit_status || (isFullyPaid(financeStatus) && (inv.isCompleted || inv.billingStatus === "COMPLETED") ? "REALIZED" : "PENDING"),
      cashback: inv.cashback !== undefined ? Number(inv.cashback) : (inv.cashback_nominal !== undefined ? Number(inv.cashback_nominal) : 0),
      cashbackStatus: inv.cashbackStatus || inv.cashback_status || (isFullyPaid(financeStatus) && (inv.isCompleted || inv.refundStatus === "PROCESSED") ? "REALIZED" : "PENDING"),
      isCashRealized: dibayar > 0,
      cashRecordedAmount: dibayar,
      metodePembayaran: inv.metodePembayaran || (dibayar > 0 ? "Transfer Bank" : "Tempo"),
      bank: inv.bank || (dibayar > 0 ? "BCA" : "Kas Kantor"),
      billingStatus: inv.billingStatus || (isFullyPaid(financeStatus) && inv.isCompleted ? "COMPLETED" : "ACTIVE"),
      settlementCondition: inv.settlementCondition || inv.settlement_condition || (isFullyPaid(financeStatus) ? "BALANCED" : "UNDERPAID"),
      refundStatus: inv.refundStatus || inv.refund_status || "NONE",
      overpayment: inv.overpayment !== undefined ? Number(inv.overpayment) : 0,
    };
  }

  public async initFromApi(): Promise<void> {
    const authHeaders = this.getAuthHeader();
    if (!authHeaders.Authorization) {
      this.isLoadingState = false;
      return;
    }

    // Role Guard: Messengers only deal with operational field tasks and reimbursements, never office finance
    let isMessengerUser = false;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem("auth_user");
        if (raw) {
          const u = JSON.parse(raw);
          if (u.role === "messenger") isMessengerUser = true;
        }
      }
    } catch {}

    if (isMessengerUser) {
      this.isLoadingState = false;
      return;
    }

    this.isLoadingState = true;
    this.lastError = null;
    try {
      const invRes = await fetch(`${this.baseUrl}/finance/invoices`, {
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!invRes.ok) {
        if (invRes.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sun89_auth_unauthorized"));
        }
        throw new Error(`Gagal memuat invoice dari server (HTTP ${invRes.status})`);
      }
      const payload = await invRes.json();
      if (payload.success && Array.isArray(payload.data)) {
        this.invoices = payload.data.map((inv: any) => this.normalizeInvoice(inv));
        this.deriveProfitFromInvoices();
      }

      const kasRes = await fetch(`${this.baseUrl}/finance/kas-kantor`, {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (kasRes.ok) {
        const kasPayload = await kasRes.json();
        if (kasPayload.success && Array.isArray(kasPayload.data)) {
          this.kasKantor = kasPayload.data.map((k: any) => ({
            id: Number(k.id),
            tanggal: k.tanggal,
            keterangan: k.keterangan,
            status: k.status,
            debit: Number(k.debit || 0),
            kredit: Number(k.kredit || 0),
            total: Number(k.total ?? k.saldo ?? 0),
            saldo: Number(k.saldo ?? k.total ?? 0),
            penanggungJawab: k.penanggungJawab || k.penanggung_jawab || undefined,
          }));
        }
      }

      const pengeluaranRes = await fetch(`${this.baseUrl}/finance/pengeluaran`, {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (pengeluaranRes.ok) {
        const pengeluaranPayload = await pengeluaranRes.json();
        if (pengeluaranPayload.success && Array.isArray(pengeluaranPayload.data)) {
          this.pengeluaran = pengeluaranPayload.data.map((p: any) => ({
            id: Number(p.id),
            tanggal: p.tanggal,
            keterangan: p.keterangan,
            nominal: Number(p.nominal || 0),
            penanggungJawab: p.penanggungJawab || p.penanggung_jawab || undefined,
          }));
        }
      }

      const messengerRes = await fetch(`${this.baseUrl}/finance/kas-messenger`, {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (messengerRes.ok) {
        const messengerPayload = await messengerRes.json();
        if (messengerPayload.success && Array.isArray(messengerPayload.data)) {
          this.kasMessenger = messengerPayload.data.map((m: any) => ({
            id: Number(m.id),
            tanggal: m.tanggal,
            jenis: m.jenis,
            messenger: m.messenger,
            keterangan: m.keterangan,
            in: Number(m.in || m.debit || 0),
            out: Number(m.out || m.kredit || 0),
            total: Number(m.total || 0),
            penanggungJawab: m.penanggungJawab || m.penanggung_jawab || undefined,
            orderNo: m.orderNo || m.order_no || undefined,
            reimbursementId: m.reimbursementId || m.reimbursement_id || undefined,
            receiptUrl: m.receiptUrl || m.receipt_url || undefined,
            kategori: m.kategori || undefined,
          }));
        }
      }

      this.isInitialized = true;
      this.isLoadingState = false;
      this.notify();
    } catch (err: any) {
      this.isLoadingState = false;
      this.lastError = err instanceof Error ? err : new Error(String(err));
      this.notify();
      // In API mode, do NOT silently inject mock fixtures on error!
    }
  }

  private deriveProfitFromInvoices(): void {
    this.profitData = this.invoices
      .filter((inv) => isFullyPaid(inv.status))
      .map((inv, idx) => ({
        id: idx + 1,
        tanggal: inv.tanggal,
        customer: inv.customer,
        nopol: inv.nopol,
        pengurusan: inv.jenisLayanan,
        uangMasuk: inv.totalTagihan,
        biayaSamsat: inv.biayaSamsat || Math.round(inv.totalTagihan * 0.75),
        profit: inv.profit || Math.round(inv.totalTagihan * 0.25),
        namaBerkas: (inv as any).namaBerkas || inv.customer,
        rekening: inv.bank || "BCA",
        tanggalTTB: inv.tanggal,
        ttb: "-",
        status: "Selesai",
        invoice: inv.invoice || inv.invoiceNo || "-",
      }));
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error("ApiFinanceProvider listener error:", err);
      }
    });
  }

  public isLoading(): boolean {
    return this.isLoadingState;
  }

  public getError(): Error | null {
    return this.lastError;
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

  public async recordPayment(idOrInvoice: number | string, paymentAmount: number, details?: any): Promise<boolean> {
    if (paymentAmount <= 0) return false;

    const idx = this.invoices.findIndex(
      (inv) => inv.id === idOrInvoice || inv.invoiceNo === String(idOrInvoice) || (inv as any).invoice === String(idOrInvoice)
    );
    if (idx === -1) return false;

    const previousRecord = { ...this.invoices[idx] };
    const record = this.invoices[idx];

    const currentPaid = record.dibayar ?? (record as any).terbayar ?? 0;
    const newDibayar = Math.min(record.totalTagihan, currentPaid + paymentAmount);
    const newSisa = Math.max(0, record.totalTagihan - newDibayar);
    const newStatus = newSisa === 0 ? "Lunas" : "Kurang Bayar";

    // Stable idempotency key: reuse existing key if provided (e.g. on client retry) or generate once
    const idempotencyKey = details?.idempotencyKey || `idem-${record.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const effectiveDetails = {
      ...details,
      idempotencyKey,
    };

    record.dibayar = newDibayar;
    (record as any).terbayar = newDibayar;
    record.sisa = newSisa;
    record.status = newStatus;

    if (newSisa === 0) {
      record.billingStatus = "COMPLETED";
      record.profitStatus = "REALIZED";
    }

    this.deriveProfitFromInvoices();
    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/finance/invoices/${encodeURIComponent(record.id)}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          ...this.getAuthHeader(),
        },
        body: JSON.stringify({ amount: paymentAmount, details: effectiveDetails }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || errorData?.message || `Gagal mencatat pembayaran (HTTP ${res.status})`);
      }

      const payload = await res.json();
      if (payload?.success && payload.data) {
        const currentIdx = this.invoices.findIndex((inv) => inv.id === record.id);
        if (currentIdx !== -1) {
          this.invoices[currentIdx] = this.normalizeInvoice(payload.data);
          this.deriveProfitFromInvoices();
          this.notify();
        }
      }
      return true;
    } catch (err) {
      console.error("Failed to persist payment to server, rolling back:", err);
      // Rollback optimistic update
      const currentIdx = this.invoices.findIndex((inv) => inv.id === record.id);
      if (currentIdx !== -1) {
        this.invoices[currentIdx] = previousRecord;
        this.deriveProfitFromInvoices();
        this.notify();
      }
      throw err;
    }
  }

  public resolveInvoice(id: number, details?: any): boolean {
    const record = this.getInvoiceById(id);
    if (!record) return false;
    void this.recordPayment(id, record.sisa, details);
    return true;
  }

  public completeInvoice(id: number, completedBy?: string): boolean {
    const record = this.getInvoiceById(id);
    if (!record) return false;
    record.billingStatus = "COMPLETED";
    if (completedBy) record.completedBy = completedBy;
    this.notify();

    fetch(`${this.baseUrl}/finance/invoices/${encodeURIComponent(id)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify({ completedBy }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (payload?.success && payload.data) {
          const currentIdx = this.invoices.findIndex((inv) => inv.id === id);
          if (currentIdx !== -1) {
            this.invoices[currentIdx] = this.normalizeInvoice(payload.data);
            this.deriveProfitFromInvoices();
            this.notify();
          }
        }
      })
      .catch((err) => {
        console.error("Failed to persist completeInvoice to server:", err);
      });

    return true;
  }

  public async payoutCashback(id: number, payoutData: any): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/finance/invoices/${encodeURIComponent(id)}/cashback-payout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(payoutData),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.error?.message || errorData.message || `Gagal mencairkan cashback (HTTP ${res.status})`;
      throw new Error(msg);
    }

    const payload = await res.json();
    if (payload?.success && payload.data) {
      const currentIdx = this.invoices.findIndex((inv) => inv.id === id);
      if (currentIdx !== -1) {
        this.invoices[currentIdx] = this.normalizeInvoice(payload.data);
      }

      const kasRes = await fetch(`${this.baseUrl}/finance/kas-kantor`, {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (kasRes.ok) {
        const kasPayload = await kasRes.json();
        if (kasPayload?.success && Array.isArray(kasPayload.data)) {
          this.kasKantor = kasPayload.data.map((k: any) => ({
            id: Number(k.id),
            tanggal: k.tanggal,
            keterangan: k.keterangan,
            status: k.status,
            debit: Number(k.debit || 0),
            kredit: Number(k.kredit || 0),
            total: Number(k.total ?? k.saldo ?? 0),
            saldo: Number(k.saldo ?? k.total ?? 0),
            penanggungJawab: k.penanggungJawab || k.penanggung_jawab || undefined,
          }));
        }
      }
      this.deriveProfitFromInvoices();
      this.notify();
    }
    return true;
  }

  public async voidInvoicePayment(id: number, paymentId: number, reason: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/finance/invoices/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.error?.message || errorData.message || `Gagal membatalkan pembayaran (HTTP ${res.status})`;
      throw new Error(msg);
    }

    const payload = await res.json();
    if (payload?.success && payload.data) {
      const currentIdx = this.invoices.findIndex((inv) => inv.id === id);
      if (currentIdx !== -1) {
        this.invoices[currentIdx] = this.normalizeInvoice(payload.data);
      }

      const kasRes = await fetch(`${this.baseUrl}/finance/kas-kantor`, {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (kasRes.ok) {
        const kasPayload = await kasRes.json();
        if (kasPayload?.success && Array.isArray(kasPayload.data)) {
          this.kasKantor = kasPayload.data.map((k: any) => ({
            id: Number(k.id),
            tanggal: k.tanggal,
            keterangan: k.keterangan,
            status: k.status,
            debit: Number(k.debit || 0),
            kredit: Number(k.kredit || 0),
            total: Number(k.total ?? k.saldo ?? 0),
            saldo: Number(k.saldo ?? k.total ?? 0),
            penanggungJawab: k.penanggungJawab || k.penanggung_jawab || undefined,
          }));
        }
      }
      this.deriveProfitFromInvoices();
      this.notify();
    }
    return true;
  }

  public async voidCashbackPayout(id: number, reason: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/finance/invoices/${encodeURIComponent(id)}/cashback-payout/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.error?.message || errorData.message || `Gagal membatalkan pencairan cashback (HTTP ${res.status})`;
      throw new Error(msg);
    }

    const payload = await res.json();
    if (payload?.success && payload.data) {
      const currentIdx = this.invoices.findIndex((inv) => inv.id === id);
      if (currentIdx !== -1) {
        this.invoices[currentIdx] = this.normalizeInvoice(payload.data);
      }

      const kasRes = await fetch(`${this.baseUrl}/finance/kas-kantor`, {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (kasRes.ok) {
        const kasPayload = await kasRes.json();
        if (kasPayload?.success && Array.isArray(kasPayload.data)) {
          this.kasKantor = kasPayload.data.map((k: any) => ({
            id: Number(k.id),
            tanggal: k.tanggal,
            keterangan: k.keterangan,
            status: k.status,
            debit: Number(k.debit || 0),
            kredit: Number(k.kredit || 0),
            total: Number(k.total ?? k.saldo ?? 0),
            saldo: Number(k.saldo ?? k.total ?? 0),
            penanggungJawab: k.penanggungJawab || k.penanggung_jawab || undefined,
          }));
        }
      }
      this.deriveProfitFromInvoices();
      this.notify();
    }
    return true;
  }

  public addKasKantor(item: Omit<KasKantorItem, "id">): KasKantorItem | null {
    const lastTotal = this.kasKantor.length > 0
      ? (this.kasKantor[this.kasKantor.length - 1].total ?? (this.kasKantor[this.kasKantor.length - 1] as any).saldo ?? 0)
      : 0;

    const newEntry: KasKantorItem = {
      id: Date.now(),
      tanggal: item.tanggal,
      status: item.status,
      keterangan: item.keterangan,
      debit: item.debit || 0,
      kredit: item.kredit || 0,
      penanggungJawab: item.penanggungJawab,
      total: (item.status === "Debit" || item.status === "Pemasukan") ? lastTotal + (item.debit || 0) : lastTotal - (item.kredit || 0),
    };

    this.kasKantor.unshift(newEntry);
    this.notify();

    fetch(`${this.baseUrl}/finance/kas-kantor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(item),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (payload?.success && payload.data) {
          const idx = this.kasKantor.findIndex((k) => k.id === newEntry.id);
          if (idx !== -1) {
            this.kasKantor[idx] = {
              ...payload.data,
              total: Number(payload.data.total ?? payload.data.saldo ?? 0),
              saldo: Number(payload.data.saldo ?? payload.data.total ?? 0),
            };
            this.notify();
          }
        }
      })
      .catch((err) => {
        console.error("Failed to persist kas entry, rolling back:", err);
        const idx = this.kasKantor.findIndex((k) => k.id === newEntry.id);
        if (idx !== -1) {
          this.kasKantor.splice(idx, 1);
          this.notify();
        }
      });

    return newEntry;
  }

  public addPengeluaran(item: Omit<PengeluaranItem, "id">): PengeluaranItem | null {
    const nextId = Date.now();
    const newEntry: PengeluaranItem = {
      id: nextId,
      tanggal: item.tanggal,
      keterangan: item.keterangan,
      nominal: item.nominal,
      penanggungJawab: item.penanggungJawab,
    };

    this.pengeluaran.unshift(newEntry);
    this.notify();

    fetch(`${this.baseUrl}/finance/pengeluaran`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(item),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (payload?.success && payload.data) {
          const idx = this.pengeluaran.findIndex((p) => p.id === newEntry.id);
          if (idx !== -1) {
            this.pengeluaran[idx] = {
              id: Number(payload.data.id),
              tanggal: payload.data.tanggal,
              keterangan: payload.data.keterangan,
              nominal: Number(payload.data.nominal || 0),
              penanggungJawab: payload.data.penanggungJawab || payload.data.penanggung_jawab || undefined,
            };
            this.notify();
          }
        }
      })
      .catch((err) => {
        console.error("Failed to persist pengeluaran entry, rolling back:", err);
        const idx = this.pengeluaran.findIndex((p) => p.id === newEntry.id);
        if (idx !== -1) {
          this.pengeluaran.splice(idx, 1);
          this.notify();
        }
      });

    return newEntry;
  }

  public async deleteKasKantor(id: number): Promise<boolean> {
    const idx = this.kasKantor.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    const previous = this.kasKantor[idx];

    this.kasKantor.splice(idx, 1);
    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/finance/kas-kantor/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Gagal menghapus kas kantor (HTTP ${res.status})`);
      }
      return true;
    } catch (err) {
      console.error("Failed to delete kas kantor, rolling back:", err);
      this.kasKantor.splice(idx, 0, previous);
      this.notify();
      throw err;
    }
  }

  public addKasMessenger(item: Omit<KasMessengerItem, "id" | "total"> & { total?: number }): KasMessengerItem | null {
    const lastTotal = this.kasMessenger.length > 0
      ? this.kasMessenger[this.kasMessenger.length - 1].total
      : 0;
    const runningTotal = item.total !== undefined ? item.total : lastTotal + item.in - item.out;

    const newEntry: KasMessengerItem = {
      id: Date.now(),
      tanggal: item.tanggal,
      jenis: item.jenis,
      messenger: item.messenger,
      keterangan: item.keterangan,
      in: item.in,
      out: item.out,
      total: runningTotal,
      orderNo: (item as any).orderNo,
      penanggungJawab: (item as any).penanggungJawab,
      reimbursementId: (item as any).reimbursementId,
      receiptUrl: (item as any).receiptUrl,
      kategori: (item as any).kategori,
    };

    this.kasMessenger.push(newEntry);
    this.notify();

    fetch(`${this.baseUrl}/finance/kas-messenger`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(item),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (payload?.success && payload.data) {
          const idx = this.kasMessenger.findIndex((k) => k.id === newEntry.id);
          if (idx !== -1) {
            this.kasMessenger[idx] = {
              id: Number(payload.data.id),
              tanggal: payload.data.tanggal,
              jenis: payload.data.jenis,
              messenger: payload.data.messenger,
              keterangan: payload.data.keterangan,
              in: Number(payload.data.in ?? payload.data.debit ?? 0),
              out: Number(payload.data.out ?? payload.data.kredit ?? 0),
              total: Number(payload.data.total ?? 0),
              orderNo: payload.data.orderNo || payload.data.order_no || (item as any).orderNo,
              penanggungJawab: payload.data.penanggungJawab || payload.data.penanggung_jawab || (item as any).penanggungJawab,
              reimbursementId: payload.data.reimbursementId || payload.data.reimbursement_id || (item as any).reimbursementId,
              receiptUrl: payload.data.receiptUrl || payload.data.receipt_url || (item as any).receiptUrl,
              kategori: payload.data.kategori || (item as any).kategori,
            };
            this.notify();
          }
        }
      })
      .catch((err) => {
        console.error("Failed to persist kas messenger, rolling back:", err);
        const idx = this.kasMessenger.findIndex((k) => k.id === newEntry.id);
        if (idx !== -1) {
          this.kasMessenger.splice(idx, 1);
          this.notify();
        }
      });

    return newEntry;
  }

  public async deleteKasMessenger(id: number): Promise<boolean> {
    const idx = this.kasMessenger.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    const previous = this.kasMessenger[idx];

    this.kasMessenger.splice(idx, 1);
    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/finance/kas-messenger/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Gagal menghapus kas messenger (HTTP ${res.status})`);
      }
      return true;
    } catch (err) {
      console.error("Failed to delete kas messenger, rolling back:", err);
      this.kasMessenger.splice(idx, 0, previous);
      this.notify();
      throw err;
    }
  }

  public async deletePengeluaran(id: number): Promise<boolean> {
    const idx = this.pengeluaran.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    const previous = this.pengeluaran[idx];

    this.pengeluaran.splice(idx, 1);
    this.notify();

    try {
      const res = await fetch(`${this.baseUrl}/finance/pengeluaran/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Gagal menghapus pengeluaran (HTTP ${res.status})`);
      }
      return true;
    } catch (err) {
      console.error("Failed to delete pengeluaran, rolling back:", err);
      this.pengeluaran.splice(idx, 0, previous);
      this.notify();
      throw err;
    }
  }

  public saveInvoice(invoice: InvoiceBillingRecord): void {
    const normalized = this.normalizeInvoice(invoice);
    const idx = this.invoices.findIndex((inv) => inv.id === normalized.id || inv.invoiceNo === normalized.invoiceNo);
    if (idx !== -1) {
      this.invoices[idx] = normalized;
    } else {
      this.invoices.unshift(normalized);
    }
    this.deriveProfitFromInvoices();
    this.notify();
  }

  public async getVoidAuditHistory(): Promise<{ payments: any[]; cashbacks: any[] }> {
    const res = await fetch(`${this.baseUrl}/finance/audit/void-history`, {
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Gagal mengambil riwayat audit void (HTTP ${res.status})`);
    }
    const payload = await res.json();
    return payload.data || { payments: [], cashbacks: [] };
  }
}
