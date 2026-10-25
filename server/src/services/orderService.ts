/**
 * Order Domain Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { dbOrderRepository } from "../repositories/dbOrderRepository";
import { dbFinanceRepository } from "../repositories/dbFinanceRepository";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { dbDocumentRepository } from "../repositories/dbDocumentRepository";
import { dbNotificationSettingsRepository } from "../repositories/dbNotificationSettingsRepository";
import { notificationConfigService } from "./notificationConfigService";
import { OperationalOrder, StageName, STAGES, getDefaultSamsatProcesses } from "../../../src/domain/order/types";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../utils/crypto";
import { db, runInTransaction } from "../database/db";
import { assertNoProtectedFieldViolations, normalizeOrderPayload } from "../utils/aliasNormalizer";
import { validateOrderPricingSanity } from "../utils/pricingSanityCheck";

export const CANONICAL_SERVICES_MAP: Record<string, { id: string; nama: string }> = {
  // 1. Perpanjangan 1 Tahun
  "svc-perp-1th": { id: "svc-perp-1th", nama: "Perpanjangan 1 Tahun" },
  "perp_1thn": { id: "svc-perp-1th", nama: "Perpanjangan 1 Tahun" },
  "perpanjangan 1 tahun": { id: "svc-perp-1th", nama: "Perpanjangan 1 Tahun" },
  "tahunan": { id: "svc-perp-1th", nama: "Perpanjangan 1 Tahun" },
  "perpanjangan stnk tahunan": { id: "svc-perp-1th", nama: "Perpanjangan 1 Tahun" },
  "perpanjangan stnk": { id: "svc-perp-1th", nama: "Perpanjangan 1 Tahun" },

  // 2. Perpanjangan 5 Tahun
  "svc-perp-5th": { id: "svc-perp-5th", nama: "Perpanjangan 5 Tahun" },
  "perp_5thn": { id: "svc-perp-5th", nama: "Perpanjangan 5 Tahun" },
  "perpanjangan 5 tahun": { id: "svc-perp-5th", nama: "Perpanjangan 5 Tahun" },
  "5 tahunan": { id: "svc-perp-5th", nama: "Perpanjangan 5 Tahun" },
  "perpanjangan plat 5 tahun": { id: "svc-perp-5th", nama: "Perpanjangan 5 Tahun" },
  "ganti plat 5 tahun": { id: "svc-perp-5th", nama: "Perpanjangan 5 Tahun" },

  // 3. Mutasi Asal Samsat
  "svc-mut-asal": { id: "svc-mut-asal", nama: "Mutasi Asal Samsat" },
  "mut_asal": { id: "svc-mut-asal", nama: "Mutasi Asal Samsat" },
  "mutasi asal samsat": { id: "svc-mut-asal", nama: "Mutasi Asal Samsat" },
  "mutasi antar samsat": { id: "svc-mut-asal", nama: "Mutasi Asal Samsat" },
  "mutasi as": { id: "svc-mut-asal", nama: "Mutasi Asal Samsat" },
  "mutasi satu daerah": { id: "svc-mut-asal", nama: "Mutasi Asal Samsat" },
  "mutasi lokal": { id: "svc-mut-asal", nama: "Mutasi Asal Samsat" },

  // 4. Mutasi Antar Daerah
  "svc-mut-antar": { id: "svc-mut-antar", nama: "Mutasi Antar Daerah" },
  "mut_antar": { id: "svc-mut-antar", nama: "Mutasi Antar Daerah" },
  "mutasi antar daerah": { id: "svc-mut-antar", nama: "Mutasi Antar Daerah" },
  "mutasi luar daerah": { id: "svc-mut-antar", nama: "Mutasi Antar Daerah" },
  "mutasi ld": { id: "svc-mut-antar", nama: "Mutasi Antar Daerah" },
  "mutasi keluar daerah": { id: "svc-mut-antar", nama: "Mutasi Antar Daerah" },

  // 5. Balik Nama
  "svc-balik-nama": { id: "svc-balik-nama", nama: "Balik Nama" },
  "balik_nama": { id: "svc-balik-nama", nama: "Balik Nama" },
  "balik nama": { id: "svc-balik-nama", nama: "Balik Nama" },
  "bbn": { id: "svc-balik-nama", nama: "Balik Nama" },
  "bbn-kb": { id: "svc-balik-nama", nama: "Balik Nama" },

  // 6. Tarik Berkas
  "svc-tarik-berkas": { id: "svc-tarik-berkas", nama: "Tarik Berkas" },
  "tarik_berkas": { id: "svc-tarik-berkas", nama: "Tarik Berkas" },
  "tarik berkas": { id: "svc-tarik-berkas", nama: "Tarik Berkas" },
  "cabut berkas": { id: "svc-tarik-berkas", nama: "Tarik Berkas" },

  // 7. Duplikat STNK
  "svc-duplikat-stnk": { id: "svc-duplikat-stnk", nama: "Duplikat STNK" },
  "duplikat_stnk": { id: "svc-duplikat-stnk", nama: "Duplikat STNK" },
  "duplikat stnk": { id: "svc-duplikat-stnk", nama: "Duplikat STNK" },
  "stnk hilang": { id: "svc-duplikat-stnk", nama: "Duplikat STNK" },
};

export function resolveServiceIdentity(
  serviceIdInput?: string | null,
  layananInput?: string | null
): { serviceId: string | null; namaLayanan: string } {
  const normSvcId = (serviceIdInput || "").trim().toLowerCase();
  if (normSvcId && CANONICAL_SERVICES_MAP[normSvcId]) {
    const match = CANONICAL_SERVICES_MAP[normSvcId];
    return { serviceId: match.id, namaLayanan: match.nama };
  }

  const normLayanan = (layananInput || "").trim().toLowerCase();
  if (normLayanan && CANONICAL_SERVICES_MAP[normLayanan]) {
    const match = CANONICAL_SERVICES_MAP[normLayanan];
    return { serviceId: match.id, namaLayanan: match.nama };
  }

  return {
    serviceId: serviceIdInput || null,
    namaLayanan: layananInput || "Layanan Standar",
  };
}

export class OrderService {
  private orderCounter = 0;
  private idempotencyCache = new Map<string, { order: OperationalOrder; timestamp: number }>();

  constructor() {
    try {
      // 1. Scan ALL orders (including archived) to prevent counter reset
      const activeOrders = dbOrderRepository.getAllFlat(false);
      const archivedOrders = dbOrderRepository.getAllFlat(true);
      const allOrders = [...activeOrders, ...archivedOrders];
      if (allOrders.length > 0) {
        const nums = allOrders
          .map((o) => parseInt(o.orderNo.replace(/\D/g, ""), 10))
          .filter((n) => !isNaN(n));
        if (nums.length > 0) {
          this.orderCounter = Math.max(0, ...nums);
        }
      }

      // 2. Direct atomic SQLite query across all historical rows to guarantee highest sequence
      const row = db
        .prepare("SELECT COALESCE(MAX(CAST(SUBSTR(order_no, 5) AS INTEGER)), 0) AS maxSeq FROM orders")
        .get() as { maxSeq: number } | undefined;
      if (row && typeof row.maxSeq === "number" && row.maxSeq > this.orderCounter) {
        this.orderCounter = row.maxSeq;
      }
    } catch {
      // safe fallback if schema not yet initialized
    }
  }

  public getActiveOrders(): Record<StageName, OperationalOrder[]> {
    return dbOrderRepository.getActiveOrders();
  }

  public getAllFlat(archived = false): OperationalOrder[] {
    return dbOrderRepository.getAllFlat(archived);
  }

  public getByOrderNo(orderNo: string): OperationalOrder {
    const order = dbOrderRepository.getByOrderNo(orderNo);
    if (!order) {
      throw new ApiError(404, "ORDER_NOT_FOUND", `Order dengan nomor '${orderNo}' tidak ditemukan.`);
    }
    return order;
  }

  public createOrder(data: any, user?: TokenPayload | null, idempotencyKey?: string): OperationalOrder {
    return this.createOrderWithIdempotency(data, user, idempotencyKey).order;
  }

  public createOrderWithIdempotency(
    data: any,
    user?: TokenPayload | null,
    idempotencyKey?: string
  ): { order: OperationalOrder; isExisting: boolean } {
    const resolvedKey = (idempotencyKey || data.clientRequestId || data.idempotencyKey)?.trim();
    if (resolvedKey) {
      if (this.idempotencyCache.has(resolvedKey)) {
        const cached = this.idempotencyCache.get(resolvedKey)!;
        const existing = dbOrderRepository.getByOrderNo(cached.order.orderNo);
        if (existing) {
          return { order: existing, isExisting: true };
        }
      }
      const allRecent = dbOrderRepository.getAllFlat(false);
      const existing = allRecent.find((o) => (o as any).clientRequestId === resolvedKey);
      if (existing) {
        this.idempotencyCache.set(resolvedKey, { order: existing, timestamp: Date.now() });
        return { order: existing, isExisting: true };
      }
    }

    // Canonicalize incoming fields and resolve alias conflicts
    normalizeOrderPayload(data);

    if (!data.customer || !data.nomorHP || !data.layanan || !data.nopol) {
      throw new ApiError(400, "VALIDATION_ERROR", "Data wajib belum lengkap (customer, nomorHP, layanan, nopol).");
    }

    // Server-side Pricing Sanity & Anti-Tampering Guard
    const pricingSanity = validateOrderPricingSanity(data);
    if (!pricingSanity.isValid) {
      throw new ApiError(
        400,
        pricingSanity.errorCode || "VALIDATION_ERROR",
        pricingSanity.errorMessage || "Kalkulasi harga order tidak valid atau terindikasi manipulasi."
      );
    }

    const resolvedTanggalBerkas = (data as any).tanggalMasukBerkas || (data as any).tanggal_masuk_berkas || undefined;
    const nowStr = new Date().toISOString();

    const parsePeriodMMYY = (dateVal?: string): string => {
      if (!dateVal) {
        const d = new Date();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = String(d.getFullYear()).slice(-2);
        return `${mm}${yy}`;
      }
      const iso = dateVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (iso) {
        const yy = iso[1].slice(-2);
        const mm = iso[2].padStart(2, "0");
        return `${mm}${yy}`;
      }
      const slash = dateVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (slash) {
        const mm = slash[2].padStart(2, "0");
        const yy = slash[3].slice(-2);
        return `${mm}${yy}`;
      }
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = String(d.getFullYear()).slice(-2);
        return `${mm}${yy}`;
      }
      const dNow = new Date();
      return `${String(dNow.getMonth() + 1).padStart(2, "0")}${String(dNow.getFullYear()).slice(-2)}`;
    };

    const targetMMYY = parsePeriodMMYY(resolvedTanggalBerkas || nowStr);

    let orderNo = (data.orderNo || "").trim();
    const orderPattern = new RegExp(`^ORD-${targetMMYY}-\\d+$`);
    let isTaken = false;
    if (orderNo && orderPattern.test(orderNo)) {
      try {
        const existing = db.prepare("SELECT 1 FROM orders WHERE order_no = ?").get(orderNo);
        if (existing) isTaken = true;
      } catch {
        // safe fallback
      }
    }
    if (!orderNo || !orderPattern.test(orderNo) || isTaken) {
      let maxSeq = 0;
      try {
        const rows = db.prepare("SELECT order_no FROM orders WHERE order_no LIKE ?").all(`ORD-${targetMMYY}-%`) as { order_no: string }[];
        for (const r of rows) {
          const parts = r.order_no.split("-");
          if (parts.length >= 3) {
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        }
      } catch {
        // safe fallback
      }
      const nextSeq = maxSeq + 1;
      orderNo = `ORD-${targetMMYY}-${String(nextSeq).padStart(3, "0")}`;
    }

    const orderParts = orderNo.split("-");
    const seqSuffix = orderParts.length >= 3 ? orderParts[2] : "001";
    const matchingInvoiceNo = `INV-${targetMMYY}-${seqSuffix}`;

    const rawNoInvoice = data.noInvoice !== undefined
      ? data.noInvoice
      : (data.payment?.invoiceNo !== undefined ? data.payment.invoiceNo : undefined);

    const resolvedNoInvoice = (rawNoInvoice && String(rawNoInvoice).trim() && !String(rawNoInvoice).startsWith("INV-2026"))
      ? String(rawNoInvoice).trim()
      : matchingInvoiceNo;

    const resolvedMetodeLayanan = data.metodeLayanan || data.costSnapshot?.metodeLayanan || "Antar Jemput";
    const isDatangLangsung = resolvedMetodeLayanan === "Datang Langsung";
    const initialStep = isDatangLangsung ? 3 : 1;
    const initialStageName: StageName = isDatangLangsung ? "Verifikasi Dokumen" : "Verifikasi";

    const resolvedStatusPengerjaan = data.salesSnapshotStatus || data.statusPengerjaan;

    const resolvedSvc = resolveServiceIdentity((data as any).service_id || (data as any).serviceId, data.layanan);
    const resolvedLayanan = resolvedSvc.namaLayanan;
    const resolvedServiceId = resolvedSvc.serviceId;
    const resolvedSamsatAsal = (data as any).samsat_asal || (data as any).samsatAsal || data.wilayahSamsatAsal || "Jakarta Timur";
    const resolvedSamsatTujuan = (data as any).samsat_tujuan || (data as any).samsatTujuan || data.wilayahSamsatTujuan || "-";

    const newOrder: OperationalOrder = {
      orderNo,
      ...(resolvedKey ? { clientRequestId: resolvedKey } : {}),
      customer: data.customer,
      nomorHP: data.nomorHP,
      layanan: resolvedLayanan,
      serviceId: resolvedServiceId || undefined,
      service_id: resolvedServiceId || undefined,
      tanggalMasukBerkas: resolvedTanggalBerkas,
      tanggal_masuk_berkas: resolvedTanggalBerkas,
      wilayahSamsatAsal: resolvedSamsatAsal,
      samsat_asal: resolvedSamsatAsal,
      wilayahSamsatTujuan: resolvedSamsatTujuan,
      samsat_tujuan: resolvedSamsatTujuan,
      metodeLayanan: resolvedMetodeLayanan,
      currentStep: data.currentStep !== undefined ? data.currentStep : initialStep,
      currentStageName: data.currentStageName || initialStageName,
      pickupCompleted: isDatangLangsung ? true : (data.pickupCompleted ?? false),
      isScheduled: isDatangLangsung ? true : (data.isScheduled ?? false),
      messenger: isDatangLangsung ? "Datang Langsung (Loket)" : (data.messenger || "Belum Ditugaskan"),
      messengerTaskStatus: isDatangLangsung ? "Dokumen Sudah Tersedia" : data.messengerTaskStatus,
      catatanPenjadwalan: isDatangLangsung ? "Klien datang langsung ke loket kantor (Tanpa penjemputan kurir)" : data.catatanPenjadwalan,
      tanggalJemput: isDatangLangsung ? nowStr.split("T")[0] : data.tanggalJemput,
      catatanOrder: data.catatanOrder || (isDatangLangsung ? "Order Datang Langsung ke Loket (Verifikasi Dokumen Fisik)." : "Order baru dibuat dari API Buat Order."),
      createdAt: nowStr.split("T")[0],

      namaPemilik: data.namaPemilik ? String(data.namaPemilik).trim() : "",
      kepemilikanKendaraan: data.statusKepemilikan || data.kepemilikanKendaraan || "Pribadi",
      jenisKendaraan: data.jenisKendaraan || "Mobil",
      tahunKendaraan: data.tahunKendaraan || new Date().getFullYear(),
      nopol: data.nopol,
      pkbBerlakuSd: data.pkbBerlakuSd || "",
      tahunPajak: data.tahunPajak || String(new Date().getFullYear()),
      bulanPajak: data.bulanPajak || "Januari",
      nominalPkbTerakhir: data.nominalPkbTerakhir ?? 0,
      nominalSwdkllj: data.nominalSwdkllj ?? 143000,
      kodePromo: data.kodePromo || "",

      biayaJasa: pricingSanity.resolvedBiayaJasa,
      biayaAntarJemput: Number(data.biayaAntarJemput ?? 0),
      namaPenerimaKeluar: (data.namaPenerimaKeluar || data.namaPemilikRekeningKeluar || "").trim(),
      bankUangKeluar: data.bankUangKeluar || "",
      metodePembayaranKeluar: data.metodePembayaranKeluar || "",
      tanggalPengeluaranSamsat: data.tanggalPengeluaranSamsat || data.tanggalUangKeluar || "",
      tanggalUangMasuk: (data as any).tanggalUangMasuk || "",

      ...(resolvedStatusPengerjaan ? { salesSnapshotStatus: resolvedStatusPengerjaan, statusPengerjaan: resolvedStatusPengerjaan } : {}),
      ...(resolvedNoInvoice !== undefined ? { noInvoice: resolvedNoInvoice } : {}),
      ...(data.tandaTerima !== undefined ? { tandaTerima: data.tandaTerima } : {}),
      ...(data.ttbBPKB !== undefined ? { ttbBPKB: data.ttbBPKB } : {}),
      ...(data.statusBPKB !== undefined ? { statusBPKB: data.statusBPKB } : {}),
      ...(data.bpkb !== undefined ? { bpkb: data.bpkb } : {}),
      ...(data.isArchived !== undefined ? { isArchived: data.isArchived } : {}),

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
        stnkAsli: false,
        bpkbAsli: false,
        ktpAsli: false,
        suratKuasa: false,
        faktur: false,
      },

      samsatProcesses: data.samsatProcesses && data.samsatProcesses.length > 0
        ? data.samsatProcesses
        : (data.costBreakdown || data.costSnapshot?.breakdown || [])
            .filter((item: any) => item.category === "Komponen Samsat" || item.source === "KomponenSamsat")
            .map((item: any, idx: number) => ({
              id: item.itemId || `comp-${idx}`,
              name: item.name,
              category: "Komponen Samsat",
              status: "Belum Diproses",
              basePrice: item.amount || 0,
              actualCost: item.amount || 0,
            })),

      payment: {
        ...(data.payment || {}),
        tipePembayaran: data.payment?.tipePembayaran || data.tipePembayaran || "Bayar di Akhir",
        metodePembayaran: data.payment?.metodePembayaran || data.metodePembayaran || "Transfer Bank",
        totalBiaya: pricingSanity.resolvedTotalBiaya,
        dibayar: data.payment?.dibayar ?? 0,
        kurang: Math.max(0, pricingSanity.resolvedTotalBiaya - Number(data.payment?.dibayar ?? 0)),
        statusPembayaran: data.payment?.statusPembayaran || "Belum Lunas",
        isPaymentVerified: data.payment?.isPaymentVerified ?? false,
        invoiceNo: resolvedNoInvoice !== undefined ? resolvedNoInvoice : `INV-${orderNo}`,
      },

      rekapDocuments: [],
      costSnapshot: data.costSnapshot,
      costBreakdown: data.costBreakdown,
      estimationResult: data.estimationResult,
    };

    const result = runInTransaction(() => {
      dbOrderRepository.saveOrder(newOrder);

      // Save initial invoice to finance
      const initialPaid = newOrder.payment.dibayar || 0;
      const totalTagihan = newOrder.payment.totalBiaya;
      const isLunas = initialPaid >= totalTagihan && totalTagihan > 0;
      dbFinanceRepository.saveInvoice({
        invoiceNo: (resolvedNoInvoice && resolvedNoInvoice.trim()) ? resolvedNoInvoice : matchingInvoiceNo,
        orderNo: orderNo,
        service_id: resolvedServiceId || undefined,
        serviceId: resolvedServiceId || undefined,
        customer: newOrder.customer,
        layanan: newOrder.layanan,
        nopol: newOrder.nopol,
        status: isLunas ? "PAID" : initialPaid > 0 ? "PARTIAL" : "UNPAID",
        totalTagihan,
        dibayar: initialPaid,
        sisa: Math.max(0, totalTagihan - initialPaid),
        biayaSamsat: pricingSanity.resolvedBiayaSamsat,
        pendapatanJasa: Number(pricingSanity.resolvedBiayaJasa || Math.max(0, totalTagihan - pricingSanity.resolvedBiayaSamsat)),
        biayaJasa: pricingSanity.resolvedBiayaJasa,
        biayaAntarJemput: Number(data.biayaAntarJemput ?? 0),
        namaPenerimaKeluar: (data.namaPenerimaKeluar || data.namaPemilikRekeningKeluar || "").trim(),
        jatuhTempo: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        tanggalInvoice: resolvedTanggalBerkas || nowStr.split("T")[0],
        profit: Math.max(0, initialPaid - pricingSanity.resolvedBiayaSamsat - Number((data as any).biayaLainnya || 0)),
      } as any);

      // Audit Log
      dbAuditRepository.save({
        id: `log-ord-create-${Date.now()}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "CREATE",
        module: "Order",
        details: `Membuat order baru ${orderNo} (${newOrder.customer} - ${newOrder.layanan})`,
        metadata: { orderNo, customer: newOrder.customer, nopol: newOrder.nopol },
        createdAt: nowStr,
      });

      if (resolvedKey) {
        this.idempotencyCache.set(resolvedKey, { order: newOrder, timestamp: Date.now() });
      }

      this.linkOrderDocuments(newOrder);

      return { order: newOrder, isExisting: false };
    });

    if (!result.isExisting) {
      this.linkOrderDocuments(result.order);
      this.triggerOrderNotification(result.order, "ORDER_CREATE");
    }

    return result;
  }

  private triggerOrderNotification(order: OperationalOrder, eventType: "ORDER_CREATE" | "ORDER_UPDATE", extraDetail?: string): void {
    try {
      const settings = dbNotificationSettingsRepository.getSettings();
      if (!settings.notifyOrderUpdate) return;

      const smtp = notificationConfigService.getSmtpStatus();
      const recipients = settings.recipientEmails && settings.recipientEmails.length > 0
        ? settings.recipientEmails
        : ["admin@sunbirojasa.com"];

      for (const recipient of recipients) {
        if (!smtp.isConfigured) {
          dbNotificationSettingsRepository.addLog({
            type: eventType,
            recipient,
            title: eventType === "ORDER_CREATE"
              ? `Notifikasi Order Baru: ${order.orderNo} (${order.customer} - ${order.nopol})`
              : `Update Status Order: ${order.orderNo} (${extraDetail || order.currentStageName || 'Diproses'})`,
            referenceNo: order.orderNo,
            status: "GAGAL",
            errorMessage: "Layanan SMTP pengirim belum dikonfigurasi di server backend (.env). Pengiriman notifikasi email order ditangguhkan.",
          });
        } else {
          dbNotificationSettingsRepository.addLog({
            type: eventType,
            recipient,
            title: eventType === "ORDER_CREATE"
              ? `Notifikasi Order Baru: ${order.orderNo} (${order.customer} - ${order.nopol})`
              : `Update Status Order: ${order.orderNo} (${extraDetail || order.currentStageName || 'Diproses'})`,
            referenceNo: order.orderNo,
            status: "BERHASIL",
            errorMessage: null,
          });
        }
      }
    } catch (notifErr) {
      console.warn("[OrderService] Warning triggering order notification:", notifErr);
    }
  }

  public updateOrder(orderNo: string, updates: Partial<OperationalOrder>, user?: TokenPayload | null): OperationalOrder {
    const existing = this.getByOrderNo(orderNo);

    // Milestone 6 IDOR Protection: If messenger, verify order assignment or available unassigned status
    if (user && user.role === "messenger") {
      const uName = (user.nama || "").toLowerCase().trim();
      const uId = user.userId || "";
      const empId = (user as any).employeeId || "";

      const checkMatch = (id?: string, name?: string) => {
        const normId = (id || "").trim();
        const normName = (name || "").toLowerCase().trim();
        const idMatches = Boolean(normId && (normId === empId || normId === uId));
        const nameMatches = Boolean(normName && normName !== "belum ditugaskan" && normName !== "-" && (normName === uName || normName.includes(uName) || uName.includes(normName)));
        return idMatches || nameMatches;
      };

      const isAssigned =
        checkMatch((existing as any).assignedMessengerId, existing.messenger || existing.assignedMessengerName || (existing as any).assignedMessenger) ||
        checkMatch((existing as any).samsatMessengerId, existing.samsatMessenger) ||
        checkMatch((existing as any).samsatPickupMessengerId, existing.samsatPickupMessenger) ||
        checkMatch((existing as any).deliveryMessengerId, (existing as any).messengerPengantar);

      const ordMessenger = (existing.messenger || existing.assignedMessengerName || (existing as any).assignedMessenger || "").toLowerCase().trim();
      const isUnassigned = !ordMessenger || ordMessenger === "belum ditugaskan" || ordMessenger === "-";

      if (!isAssigned && !isUnassigned) {
        throw new ApiError(403, "FORBIDDEN", `Anda tidak memiliki izin mengedit order ${orderNo} yang ditugaskan kepada messenger lain.`);
      }
    }

    // Role field scoping: Messenger may only update task execution and delivery fields
    if (user && user.role === "messenger") {
      const allowedMessengerFields = new Set([
        "messengerTaskStatus", "messengerTaskNotes", "catatanKendala",
        "pickupChecklist", "pickupProof", "pickupCompleted", "pickupCompletedAt",
        "samsatJourneyStartedAt", "samsatArrivedAt", "samsatCompletedAt",
        "samsatStatus", "samsatSubstatus", "samsatProcesses", "currentSamsatProcess",
        "additionalProcesses", "samsatPickupStartedAt", "samsatPickupCompletedAt",
        "samsatPickupNotes", "deliveryStartedAt", "deliveryStatus", "deliveryHandover",
        "deliveryProof", "receiverName", "tanggalDiterima", "isReceived",
        "messengerComponentProgress", "messengerTimeline"
      ]);
      for (const k of Object.keys(updates)) {
        if (!allowedMessengerFields.has(k)) {
          throw new ApiError(403, "FORBIDDEN", `Messenger tidak memiliki wewenang untuk mengubah field '${k}'.`);
        }
      }
    }

    // Defense in Depth: Reject server-controlled and approval-gated fields across all alias variants
    assertNoProtectedFieldViolations(updates, user);

    // Canonicalize update payload and resolve alias conflicts
    normalizeOrderPayload(updates);

    const safeUpdates: Partial<OperationalOrder> = { ...updates };

    // Resolve service identity if service_id or layanan is updated
    if (safeUpdates.layanan || (safeUpdates as any).service_id || (safeUpdates as any).serviceId) {
      const resolvedSvc = resolveServiceIdentity(
        (safeUpdates as any).service_id || (safeUpdates as any).serviceId,
        safeUpdates.layanan
      );
      if (resolvedSvc.serviceId) {
        (safeUpdates as any).service_id = resolvedSvc.serviceId;
        (safeUpdates as any).serviceId = resolvedSvc.serviceId;
      }
      if (safeUpdates.layanan) {
        safeUpdates.layanan = resolvedSvc.namaLayanan;
      }
    }

    if (safeUpdates.tanggalMasukBerkas) (safeUpdates as any).tanggal_masuk_berkas = safeUpdates.tanggalMasukBerkas;
    if ((safeUpdates as any).tanggal_masuk_berkas) safeUpdates.tanggalMasukBerkas = (safeUpdates as any).tanggal_masuk_berkas;

    if (safeUpdates.wilayahSamsatAsal) (safeUpdates as any).samsat_asal = safeUpdates.wilayahSamsatAsal;
    if ((safeUpdates as any).samsat_asal) safeUpdates.wilayahSamsatAsal = (safeUpdates as any).samsat_asal;

    if (safeUpdates.wilayahSamsatTujuan) (safeUpdates as any).samsat_tujuan = safeUpdates.wilayahSamsatTujuan;
    if ((safeUpdates as any).samsat_tujuan) safeUpdates.wilayahSamsatTujuan = (safeUpdates as any).samsat_tujuan;

    const incomingTotal = Number(
      safeUpdates.payment?.totalBiaya ??
      (safeUpdates as any).total_biaya ??
      (safeUpdates as any).totalBiaya ??
      (safeUpdates as any).totalEstimasi ??
      0
    );
    if (incomingTotal > 0) {
      (safeUpdates as any).total_biaya = incomingTotal;
      if (!safeUpdates.payment) safeUpdates.payment = { ...(existing.payment || {}) } as any;
      if (safeUpdates.payment) safeUpdates.payment.totalBiaya = incomingTotal;
    }

    if ((safeUpdates as any).biayaLainnya !== undefined) {
      (safeUpdates as any).biaya_lainnya = Number((safeUpdates as any).biayaLainnya);
    }

    return runInTransaction(() => {
      // Invalidate existing Supervisor approval if fundamental order data changes after approval
      if (existing.approvedBySpv && (safeUpdates.customer || safeUpdates.nopol || safeUpdates.layanan)) {
        this.invalidateDocumentApproval(
          orderNo,
          `Perubahan data dasar order (${[safeUpdates.customer ? 'customer' : '', safeUpdates.nopol ? 'nopol' : '', safeUpdates.layanan ? 'layanan' : ''].filter(Boolean).join(', ')}) setelah supervisi disetujui`
        );
      }

      const success = dbOrderRepository.updateOrder(orderNo, safeUpdates);
      if (!success) {
        throw new ApiError(500, "UPDATE_FAILED", `Gagal memperbarui order ${orderNo}`);
      }

      const updated = this.getByOrderNo(orderNo);
      this.linkOrderDocuments(updated);

      // Financial and Invoice atomic sync across orders and finance_invoices
      const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
      if (inv) {
        const resolvedSvcId = (safeUpdates as any).service_id || (safeUpdates as any).serviceId || inv.service_id || (inv as any).serviceId;
        const newTotal = incomingTotal > 0
          ? incomingTotal
          : Number(inv.totalTagihan ?? inv.total_tagihan ?? 0);
        const newSamsat = (safeUpdates as any).biayaSamsat !== undefined
          ? Number((safeUpdates as any).biayaSamsat)
          : ((safeUpdates as any).uangKeluar !== undefined
              ? Number((safeUpdates as any).uangKeluar)
              : Number(inv.biayaSamsat ?? inv.biaya_samsat ?? 0));
        const newJasa = (safeUpdates as any).biayaJasa !== undefined
          ? Number((safeUpdates as any).biayaJasa)
          : ((safeUpdates as any).profit !== undefined
              ? Number((safeUpdates as any).profit)
              : Number(inv.biayaJasa ?? inv.biaya_jasa ?? 0));
        const newAntarJemput = (safeUpdates as any).biayaAntarJemput !== undefined
          ? Number((safeUpdates as any).biayaAntarJemput)
          : Number(inv.biayaAntarJemput ?? inv.biaya_antar_jemput ?? 0);
        const currentDibayar = Number(inv.dibayar ?? 0);
        const newSisa = Math.max(0, newTotal - currentDibayar);
        const newStatus = currentDibayar >= newTotal && newTotal > 0 ? "PAID" : currentDibayar > 0 ? "PARTIAL" : "UNPAID";

        dbFinanceRepository.saveInvoice({
          ...inv,
          customer: safeUpdates.customer || inv.customer,
          layanan: safeUpdates.layanan || inv.layanan,
          service_id: resolvedSvcId || undefined,
          serviceId: resolvedSvcId || undefined,
          nopol: safeUpdates.nopol || inv.nopol,
          totalTagihan: newTotal,
          biayaSamsat: newSamsat,
          pendapatanJasa: newJasa,
          biayaJasa: newJasa,
          biayaAntarJemput: newAntarJemput,
          sisa: newSisa,
          status: newStatus as any,
          namaPenerimaKeluar: (safeUpdates as any).namaPenerimaKeluar || (safeUpdates as any).namaPemilikRekeningKeluar || (inv as any).namaPenerimaKeluar || undefined,
          tandaTerima: (safeUpdates as any).tandaTerima || (inv as any).tandaTerima || undefined,
          ttbBPKB: (safeUpdates as any).ttbBPKB || (inv as any).ttbBPKB || undefined,
        });

        // Direct SQL update to ensure immediate persistence in SQLite table
        db.prepare(`
          UPDATE finance_invoices
          SET total_tagihan = ?, biaya_samsat = ?, pendapatan_jasa = ?, biaya_jasa = ?, biaya_antar_jemput = ?, sisa = ?, status = ?, updated_at = datetime('now')
          WHERE order_no = ?
        `).run(newTotal, newSamsat, newJasa, newJasa, newAntarJemput, newSisa, newStatus, orderNo);
      }

      // Audit Log with verified actor
      dbAuditRepository.save({
        id: `log-ord-update-${Date.now()}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "UPDATE",
        module: "Order Tracking",
        details: `Memperbarui data order ${orderNo}`,
        metadata: { orderNo, updates: safeUpdates },
        createdAt: new Date().toISOString(),
      });

      return updated;
    });
  }

  public advanceOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}, user?: TokenPayload | null): OperationalOrder {
    const existing = this.getByOrderNo(orderNo);
    if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
      throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan dan tidak dapat diproses lebih lanjut.`);
    }
    if (!(STAGES as readonly string[]).includes(targetStage)) {
      throw new ApiError(400, "INVALID_STAGE", `Target stage '${targetStage}' tidak valid.`);
    }

    if (existing.currentStageName === "Supervisi") {
      if (user && user.role !== "administrator" && user.jabatan !== "SVP") {
        throw new ApiError(403, "FORBIDDEN", "Hanya Supervisor / SVP yang berwenang melakukan supervisi Stage 6.");
      }
    }

    // Persetujuan dokumen Stage 5 gating (Verifikasi Ulang -> Supervisi)
    if (existing.currentStageName === "Verifikasi Ulang" && targetStage === "Supervisi") {
      const isApproved =
        updates.documentApproval?.stage5Verified ||
        existing.documentApproval?.stage5Verified ||
        updates.documentsVerified ||
        existing.documentsVerified;
      if (!isApproved) {
        throw new ApiError(
          400,
          "DOCUMENTS_NOT_VERIFIED",
          "Dokumen berkas Samsat wajib diperiksa dan disetujui terlebih dahulu sebelum order diajukan ke Supervisi."
        );
      }
    }

    // Persetujuan dokumen Stage 6 gating (Supervisi -> Pengantaran)
    if (existing.currentStageName === "Supervisi" && targetStage === "Pengantaran") {
      const isApproved =
        existing.documentApproval?.stage6Approved ||
        existing.approvedBySpv;
      if (!isApproved) {
        throw new ApiError(
          400,
          "DOCUMENTS_NOT_APPROVED",
          "Dokumen hasil Samsat wajib disetujui oleh Supervisor / SVP terlebih dahulu melalui persetujuan dokumen resmi sebelum order dilanjutkan ke Pengantaran."
        );
      }
    }

    // Sanitize advance updates: prevent non-supervisor callers from forging supervisor identity
    const safeAdvanceUpdates: Partial<OperationalOrder> = { ...updates };
    const isSpvCaller = user && (user.role === "administrator" || user.jabatan === "SVP" || user.role === "svp");
    if (!isSpvCaller) {
      delete (safeAdvanceUpdates as any).approvedBySpv;
      delete (safeAdvanceUpdates as any).spvName;
      delete (safeAdvanceUpdates as any).spvApprovedAt;
      delete (safeAdvanceUpdates as any).spvNotes;
      if (safeAdvanceUpdates.documentApproval) {
        delete (safeAdvanceUpdates.documentApproval as any).stage6Approved;
        delete (safeAdvanceUpdates.documentApproval as any).stage6ApprovedBy;
        delete (safeAdvanceUpdates.documentApproval as any).stage6ApprovedAt;
      }
    } else if (safeAdvanceUpdates.approvedBySpv) {
      safeAdvanceUpdates.spvName = user.nama;
      safeAdvanceUpdates.spvApprovedAt = new Date().toISOString();
    }

    const updated = runInTransaction(() => {
      const success = dbOrderRepository.advanceOrder(orderNo, targetStage, safeAdvanceUpdates);
      if (!success) {
        throw new ApiError(500, "ADVANCE_FAILED", `Gagal memajukan order ${orderNo} ke stage ${targetStage}`);
      }

      const currentUpdated = this.getByOrderNo(orderNo);
      this.linkOrderDocuments(currentUpdated);

      // Audit Log with verified actor
      dbAuditRepository.save({
        id: `log-ord-advance-${Date.now()}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "ADVANCE_STAGE",
        module: "Order Tracking",
        details: `Transisi order ${orderNo} dari '${existing.currentStageName}' ke '${targetStage}'`,
        metadata: { orderNo, fromStage: existing.currentStageName, toStage: targetStage },
        createdAt: new Date().toISOString(),
      });

      return currentUpdated;
    });

    // Side effect (Notification) executed asynchronously outside the transaction boundary
    this.triggerOrderNotification(updated, "ORDER_UPDATE", targetStage);

    return updated;
  }

  public rollbackOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}, user?: TokenPayload | null): OperationalOrder {
    const existing = this.getByOrderNo(orderNo);
    if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
      throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan dan tidak dapat di-rollback.`);
    }
    if (!(STAGES as readonly string[]).includes(targetStage)) {
      throw new ApiError(400, "INVALID_STAGE", `Target stage rollback '${targetStage}' tidak valid.`);
    }

    // Role authority check
    if (user && user.role === "messenger") {
      throw new ApiError(403, "FORBIDDEN", "Messenger tidak memiliki akses untuk rollback tahapan order.");
    }
    if (user && user.role === "finance") {
      throw new ApiError(403, "FORBIDDEN", "Finance tidak berwenang mengubah tahapan operasional order.");
    }

    const stageList = STAGES as readonly string[];
    const currentStep = stageList.indexOf(existing.currentStageName) + 1;
    const targetStep = stageList.indexOf(targetStage) + 1;

    if (targetStep >= currentStep) {
      throw new ApiError(
        400,
        "INVALID_ROLLBACK",
        `Tahapan tujuan rollback '${targetStage}' (Step ${targetStep}) harus mendahului tahapan saat ini '${existing.currentStageName}' (Step ${currentStep}).`
      );
    }

    const updated = runInTransaction(() => {
      const revokedApproval = { ...((existing as any).documentApproval || {}) };
      const revokedFields: string[] = [];
      const rollbackUpdates: Partial<OperationalOrder> = { ...updates };

      // 1. Audit & Revoke Stage 6 approval if destination <= Step 6
      if (targetStep <= 6) {
        if (revokedApproval.stage6Approved) {
          revokedApproval.stage6Approved = false;
          delete revokedApproval.stage6ApprovedBy;
          delete revokedApproval.stage6ApprovedAt;
          delete revokedApproval.approvedDocsSnapshot;
          revokedFields.push("stage6Approved (Supervisor)");
        }
        rollbackUpdates.approvedBySpv = false;
        (rollbackUpdates as any).spvApprovedAt = null;
        (rollbackUpdates as any).spvName = null;

        // Reset delivery scheduling if rolled back to or before Stage 6
        rollbackUpdates.isDeliveryScheduled = false;
        (rollbackUpdates as any).deliveryStartedAt = null;
        (rollbackUpdates as any).deliveryStatus = null;
        (rollbackUpdates as any).tanggalPengantaran = null;
      }

      // 2. Audit & Revoke Stage 5 approval if destination <= Step 5
      if (targetStep <= 5) {
        if (revokedApproval.stage5Verified) {
          revokedApproval.stage5Verified = false;
          delete revokedApproval.stage5VerifiedBy;
          delete revokedApproval.stage5VerifiedAt;
          revokedFields.push("stage5Verified (Verifikasi Ulang)");
        }
        rollbackUpdates.documentsVerified = false;
        rollbackUpdates.isVerified = false;
      }

      // 3. Reset Stage 8 reception completion if destination <= Step 7
      if (targetStep <= 7) {
        rollbackUpdates.isReceived = false;
        (rollbackUpdates as any).tanggalDiterima = null;
        (rollbackUpdates as any).receiverName = null;
      }

      // 4. Reset Samsat completion flags if destination <= Step 4
      if (targetStep <= 4) {
        if (existing.samsatStatus === "Selesai") {
          rollbackUpdates.samsatStatus = "Sedang Proses Samsat";
          revokedFields.push("samsatStatus: Selesai -> Sedang Proses Samsat");
        }
        if (existing.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor") {
          rollbackUpdates.samsatPickupStatus = "Terjadwal";
          revokedFields.push("samsatPickupStatus: Diterima di Kantor -> Terjadwal");
        }
      }

      rollbackUpdates.documentApproval = revokedApproval;
      rollbackUpdates.currentStageName = targetStage;
      rollbackUpdates.currentStep = targetStep;

      const success = dbOrderRepository.updateOrder(orderNo, rollbackUpdates);
      if (!success) {
        throw new ApiError(500, "ROLLBACK_FAILED", `Gagal memproses rollback order ${orderNo} ke stage ${targetStage}`);
      }

      const currentUpdated = this.getByOrderNo(orderNo);
      this.linkOrderDocuments(currentUpdated);

      // 5. Audit invoice and financial ledger: NEVER wipe recorded payments
      const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
      if (inv) {
        const recordedPaid = Number(inv.dibayar ?? inv.terbayar ?? 0);
        const hasRecordedPayment = recordedPaid > 0 || inv.status === "PAID" || inv.status === "PARTIAL";
        const wasCompleted = inv.billingStatus === "COMPLETED";

        if (hasRecordedPayment) {
          // Preserve all financial numbers & payment status!
          const invUpdates: Partial<any> = {};
          if (wasCompleted) {
            invUpdates.billingStatus = "ACTIVE";
          }
          invUpdates.keterangan = `Order di-rollback ke '${targetStage}'. Pembayaran riil Rp ${recordedPaid.toLocaleString("id-ID")} (${inv.status}) tetap aman dipertahankan.`;
          dbFinanceRepository.updateInvoice(inv.id, invUpdates);
        } else {
          // No payments recorded yet
          const invUpdates: Partial<any> = {};
          if (wasCompleted) {
            invUpdates.billingStatus = "ACTIVE";
          }
          invUpdates.keterangan = `Order di-rollback dari '${existing.currentStageName}' ke '${targetStage}'.`;
          dbFinanceRepository.updateInvoice(inv.id, invUpdates);
        }
      }

      // 6. Audit Log
      const revocationNote = revokedFields.length > 0 ? ` [Izin/Approval dicabut: ${revokedFields.join(", ")}]` : "";
      dbAuditRepository.save({
        id: `log-ord-rollback-${Date.now()}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "ROLLBACK_STAGE",
        module: "Order Tracking",
        details: `Rollback order ${orderNo} dari '${existing.currentStageName}' (Step ${currentStep}) ke '${targetStage}' (Step ${targetStep})${revocationNote}`,
        metadata: {
          orderNo,
          fromStage: existing.currentStageName,
          fromStep: currentStep,
          toStage: targetStage,
          toStep: targetStep,
          revokedFields,
        },
        createdAt: new Date().toISOString(),
      });

      return currentUpdated;
    });

    // Side effect (Notification) executed asynchronously outside the transaction boundary
    this.triggerOrderNotification(updated, "ORDER_UPDATE", `Rollback ke ${targetStage}`);

    return updated;
  }

  public approveOrderDocuments(
    orderNo: string,
    stage: 5 | 6,
    user: TokenPayload,
    snapshotDocs: string[] = []
  ): OperationalOrder {
    const existing = this.getByOrderNo(orderNo);
    if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
      throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan dan persetujuan dokumen tidak dapat diproses.`);
    }

    const nowIso = new Date().toISOString();

    if (stage === 6) {
      const isSpv = user.role === "administrator" || user.jabatan === "SVP" || user.role === "svp";
      if (!isSpv) {
        throw new ApiError(403, "FORBIDDEN", "Hanya Supervisor / SVP yang berwenang menyetujui dokumen Stage 6.");
      }
    }

    if (stage === 5) {
      const canVerifyStage5 = user.role === "administrator" || user.role === "admin" || user.jabatan === "SVP" || user.role === "svp";
      if (!canVerifyStage5) {
        throw new ApiError(403, "FORBIDDEN", "Hanya Admin dan Supervisor / SVP yang berwenang memverifikasi dokumen Stage 5.");
      }
    }

    const currentApproval = (existing as any).documentApproval || {
      stage5Verified: false,
      stage6Approved: false,
    };

    const updatedApproval = {
      ...currentApproval,
      ...(stage === 5
        ? {
            stage5Verified: true,
            stage5VerifiedBy: user.nama,
            stage5VerifiedAt: nowIso,
            approvedDocsSnapshot: snapshotDocs,
          }
        : {
            stage6Approved: true,
            stage6ApprovedBy: user.nama,
            stage6ApprovedAt: nowIso,
            approvedDocsSnapshot: snapshotDocs,
          }),
    };

    const updates: Partial<OperationalOrder> = {
      ...({ documentApproval: updatedApproval } as any),
      ...(stage === 5 ? { documentsVerified: true } : {}),
      ...(stage === 6 ? { approvedBySpv: true, spvApprovedAt: nowIso, spvName: user.nama } : {}),
    };

    return runInTransaction(() => {
      dbOrderRepository.updateOrder(orderNo, updates);

      dbAuditRepository.save({
        id: `log-doc-approve-${Date.now()}`,
        userId: user.userId || "usr-system",
        userName: user.nama || "Staff",
        userRole: user.role || "admin",
        action: stage === 5 ? "STAGE5_DOCS_VERIFIED" : "STAGE6_DOCS_APPROVED",
        module: "Order Tracking",
        details: `${stage === 5 ? 'Verifikasi' : 'Persetujuan'} dokumen untuk order ${orderNo} oleh ${user.nama} (${user.role})`,
        metadata: { orderNo, stage, snapshotDocs },
        createdAt: nowIso,
      });

      const updated = this.getByOrderNo(orderNo);
      this.linkOrderDocuments(updated);
      return updated;
    });
  }

  public invalidateDocumentApproval(orderNo: string, reason?: string): void {
    const existing = this.getByOrderNo(orderNo);
    if (!existing) return;

    runInTransaction(() => {
      dbOrderRepository.updateOrder(orderNo, {
        ...({
          documentApproval: {
            stage5Verified: false,
            stage6Approved: false,
            approvedDocsSnapshot: [],
          },
        } as any),
        documentsVerified: false,
        approvedBySpv: false,
      });

      dbAuditRepository.save({
        id: `log-doc-inval-${Date.now()}`,
        userId: "usr-system",
        userName: "System Audit",
        userRole: "system",
        action: "DOCUMENT_APPROVAL_INVALIDATED",
        module: "Order Tracking",
        details: `Persetujuan dokumen dibatalkan untuk order ${orderNo}. Alasan: ${reason || 'Perubahan dokumen'}`,
        metadata: { orderNo, reason },
        createdAt: new Date().toISOString(),
      });
    });
  }

  public archiveOrder(orderNo: string, user?: TokenPayload | null): boolean {
    const existing = this.getByOrderNo(orderNo);
    return runInTransaction(() => {
      const success = dbOrderRepository.archiveOrder(orderNo);
      if (success) {
        dbAuditRepository.save({
          id: `log-ord-arch-${Date.now()}`,
          userId: user?.userId || "usr-system",
          userName: user?.nama || "Admin API",
          userRole: user?.role || "admin",
          action: "ARCHIVE",
          module: "Order Tracking",
          details: `Mengarsipkan order ${orderNo}`,
          metadata: { orderNo },
          createdAt: new Date().toISOString(),
        });
      }
      return success;
    });
  }

  public deleteArchivedOrder(orderNo: string, user?: TokenPayload | null): boolean {
    return runInTransaction(() => {
      const success = dbOrderRepository.deleteArchivedOrder(orderNo);
      if (success) {
        dbAuditRepository.save({
          id: `log-ord-del-arch-${Date.now()}`,
          userId: user?.userId || "usr-admin",
          userName: user?.nama || "Admin API",
          userRole: user?.role || "admin",
          action: "DELETE",
          module: "Order History",
          details: `Menghapus rekap order sementara ${orderNo}`,
          metadata: { orderNo },
          createdAt: new Date().toISOString(),
        });
      }
      return success;
    });
  }

  public hardDeleteOrder(orderNo: string, user?: TokenPayload | null): boolean {
    return runInTransaction(() => {
      const success = dbOrderRepository.hardDeleteOrder(orderNo);
      if (success) {
        dbAuditRepository.save({
          id: `log-ord-hard-del-${Date.now()}`,
          userId: user?.userId || "usr-admin",
          userName: user?.nama || "Admin API",
          userRole: user?.role || "admin",
          action: "DELETE",
          module: "Data Penjualan",
          details: `Menghapus data order secara permanen (Hard Delete): ${orderNo}`,
          metadata: { orderNo },
          createdAt: new Date().toISOString(),
        });
      }
      return success;
    });
  }

  public cancelOrder(orderNo: string, reason: string, user?: TokenPayload | null): OperationalOrder {
    if (!reason || !reason.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Alasan pembatalan order wajib diisi.");
    }
    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan") {
        // Idempotent safe return: order already cancelled, return cleanly without duplicating mutations
        return existing;
      }

      const nowStr = new Date().toISOString();
      const stageBeforeCancel = (existing.currentStageName !== "Dibatalkan" ? existing.currentStageName : (existing as any).stageBeforeCancel) || "Verifikasi";
      const updatedOrder: OperationalOrder = {
        ...existing,
        stageBeforeCancel,
        currentStageName: "Dibatalkan" as any,
        catatanOrder: `${existing.catatanOrder ? existing.catatanOrder + " | " : ""}Dibatalkan: ${reason.trim()} (oleh ${user?.nama || "Admin"})`,
      };
      (updatedOrder as any).isCancelled = true;
      (updatedOrder as any).status = "Dibatalkan";
      (updatedOrder as any).cancelledAt = nowStr;
      (updatedOrder as any).cancelledBy = user?.nama || "Admin";
      (updatedOrder as any).cancellationReason = reason.trim();

      dbOrderRepository.updateOrder(orderNo, updatedOrder);

      // Also update matching invoice
      const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
      if (inv) {
        const paidAmount = Number(inv.dibayar ?? inv.terbayar ?? 0);
        const invoiceUpdates: any = {
          status: "CANCELLED" as any,
          billingStatus: "CANCELLED" as any,
          keterangan: `Order dibatalkan: ${reason.trim()}`,
          alasan_pending: reason.trim(),
        };

        // QC-01 Fix: If customer already paid deposit/full amount, route funds to Cashback Terpending (Refund Liability)
        if (paidAmount > 0) {
          invoiceUpdates.overpayment = paidAmount;
          invoiceUpdates.refundStatus = "PENDING";
          invoiceUpdates.settlementCondition = "OVERPAID";
          invoiceUpdates.keterangan = `Order dibatalkan: ${reason.trim()} (Dana setoran Rp ${paidAmount.toLocaleString("id-ID")} dialihkan ke Refund/Cashback Terpending)`;
        }

        dbFinanceRepository.updateInvoice(inv.id, invoiceUpdates);
      }

      // Save audit log
      dbAuditRepository.save({
        id: `log-ord-cancel-${Date.now()}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "CANCEL_ORDER",
        module: "Data Penjualan",
        details: `Membatalkan order ${orderNo}. Alasan: ${reason.trim()}`,
        metadata: { orderNo, reason: reason.trim() },
        createdAt: nowStr,
      });

      return updatedOrder;
    });
  }

  public clearArchivedOrders(user?: TokenPayload | null): number {
    const count = dbOrderRepository.clearArchivedOrders();
    if (count > 0) {
      dbAuditRepository.save({
        id: `log-ord-clear-all-${Date.now()}`,
        userId: user?.userId || "usr-admin",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "DELETE",
        module: "Order History",
        details: `Membersihkan seluruh data Rekap Order (${count} berkas)`,
        metadata: { clearedCount: count },
        createdAt: new Date().toISOString(),
      });
    }
    return count;
  }

  public verifyPayment(
    orderNo: string,
    verifierName: string = "Admin",
    user?: TokenPayload | null,
    confirmedAmount?: number,
    notes?: string,
    proofPayload?: any
  ): OperationalOrder {
    return runInTransaction(() => {
      const targetOrder = this.getByOrderNo(orderNo);
      if ((targetOrder as any).isCancelled || targetOrder.currentStageName === "Dibatalkan" || (targetOrder as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan dan pembayarannya tidak dapat diverifikasi.`);
      }
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

      const effectiveProof = proofPayload || targetOrder.payment?.buktiPembayaran;
      if (paid > 0 && !effectiveProof?.fileUrl) {
        throw new ApiError(400, "PAYMENT_PROOF_REQUIRED", "Bukti pembayaran (file bukti transfer/kas loket) wajib dilampirkan sebelum pembayaran dapat diverifikasi.");
      }

      const effectiveVerifier = user?.nama || verifierName;
      const prev = targetOrder.payment?.nominalPembayaranAwalTerkonfirmasi ?? targetOrder.payment?.nominalDibayarAwal ?? targetOrder.payment?.dibayar ?? 0;
      const riwayat = [...(targetOrder.payment?.riwayatKoreksiPembayaran || [])];
      if (prev !== paid || notes) {
        riwayat.push({
          nominalLama: prev,
          nominalBaru: paid,
          tanggal: nowStr,
          admin: effectiveVerifier,
          catatan: notes,
        });
      }

      const existingRecords = targetOrder.payment?.paymentRecords || [];
      const newRecord = {
        id: `pay-verif-${Date.now()}`,
        nominal: paid,
        tanggal: nowStr,
        metodePembayaran: targetOrder.payment?.metodePembayaran || "Transfer Bank",
        namaBank: targetOrder.payment?.namaBank,
        namaRekening: targetOrder.payment?.namaRekening,
        noRekening: targetOrder.payment?.noRekening,
        buktiPembayaran: effectiveProof,
        statusVerifikasi: "TERVERIFIKASI" as const,
        verifiedAt: nowStr,
        verifiedBy: effectiveVerifier,
        catatan: notes || "Verifikasi Pembayaran Awal",
      };

      const updatedPayment = {
        ...targetOrder.payment,
        isPaymentVerified: true,
        paymentVerifiedAt: nowStr,
        paymentVerifiedBy: effectiveVerifier,
        nominalPembayaranAwalTerkonfirmasi: paid,
        statusPembayaran: statusPembayaran as any,
        dibayar: paid,
        kurang: sisa,
        overpayment,
        tanggalBayar: targetOrder.payment?.tanggalBayar || nowStr.split("T")[0],
        buktiPembayaran: effectiveProof,
        riwayatKoreksiPembayaran: riwayat,
        paymentRecords: [...existingRecords, newRecord],
      };

      // Directly update repository with verified payment
      dbOrderRepository.updateOrder(orderNo, { payment: updatedPayment });
      const updated = this.getByOrderNo(orderNo);

      // Sync to finance invoice
      const inv = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
      if (inv) {
        dbFinanceRepository.updateInvoice(inv.id, {
          status: statusPembayaran === "Lunas" ? "PAID" : "UNPAID",
          dibayar: paid,
          sisa: sisa,
        });
      }

      // Record verified audit
      dbAuditRepository.save({
        id: `log-ord-verif-pay-${Date.now()}`,
        userId: user?.userId || "usr-finance",
        userName: user?.nama || verifierName,
        userRole: user?.role || "finance",
        action: "VERIFY_PAYMENT",
        module: "Order Tracking",
        details: `Verifikasi pembayaran order ${orderNo} oleh ${verifierName} - Terkonfirmasi: Rp ${paid.toLocaleString('id-ID')} (${statusPembayaran})`,
        metadata: { orderNo, totalBiaya, confirmedAmount: paid, statusPembayaran, notes },
        createdAt: nowStr,
      });

      return updated;
    });
  }

  private linkOrderDocuments(order: OperationalOrder): void {
    if (!order || !order.orderNo) return;
    try {
      const orderJson = JSON.stringify(order);
      const matches = orderJson.match(/DOC-[A-Za-z0-9_-]+/g);
      if (matches && matches.length > 0) {
        const uniqueDocIds = [...new Set(matches)];
        for (const docId of uniqueDocIds) {
          try {
            dbDocumentRepository.linkOrder(docId, order.orderNo);
          } catch {
            // Ignore single doc linking warning
          }
        }
      }
    } catch (err) {
      console.warn(`[OrderService] Document linking warning for order ${order.orderNo}:`, err);
    }
  }
}

export const orderService = new OrderService();
