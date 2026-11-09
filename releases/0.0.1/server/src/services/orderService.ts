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
import { OperationalOrder, StageName, STAGES, getDefaultSamsatProcesses, ServiceRequirementsSnapshot } from "../../../src/domain/order/types";
import { serviceRepository, ServiceEntity } from "../repositories/dbServiceRepository";
import { dbWilayahRepository } from "../repositories/dbWilayahRepository";
import { dbPaymentMethodRepository } from "../repositories/dbPaymentMethodRepository";
import { buildServiceRequirementsSnapshot } from "../utils/serviceSnapshot";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../utils/crypto";
import { db, runInTransaction } from "../database/db";
import { assertNoProtectedFieldViolations, normalizeOrderPayload } from "../utils/aliasNormalizer";
import { validateOrderPricingSanity } from "../utils/pricingSanityCheck";
import { resolveCanonicalActorEmployeeId } from "../utils/actorResolver";

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
  if (normSvcId) {
    // 1. Check database first
    const dbSvc = serviceRepository.getById(normSvcId);
    if (dbSvc) {
      return { serviceId: dbSvc.id, namaLayanan: dbSvc.nama_layanan };
    }
    // 2. Check canonical map
    if (CANONICAL_SERVICES_MAP[normSvcId]) {
      const match = CANONICAL_SERVICES_MAP[normSvcId];
      return { serviceId: match.id, namaLayanan: match.nama };
    }
  }

  const normLayanan = (layananInput || "").trim().toLowerCase();
  if (normLayanan) {
    // Check database by name or code
    const allDb = serviceRepository.getAll();
    const dbMatch = allDb.find(
      (s) => s.nama_layanan.toLowerCase() === normLayanan || s.kode_layanan.toLowerCase() === normLayanan
    );
    if (dbMatch) {
      return { serviceId: dbMatch.id, namaLayanan: dbMatch.nama_layanan };
    }
    if (CANONICAL_SERVICES_MAP[normLayanan]) {
      const match = CANONICAL_SERVICES_MAP[normLayanan];
      return { serviceId: match.id, namaLayanan: match.nama };
    }
  }

  return {
    serviceId: serviceIdInput || null,
    namaLayanan: layananInput || "Layanan Standar",
  };
}


export interface CancelOrderOptions {
  skipRefundPending?: boolean;
}

export interface SamsatValidationResult {
  allowed: boolean;
  code?: string;
  error?: string;
  totalComponents: number;
  completedComponents: number;
  incompleteComponents: string[];
}

/**
 * Authoritative Samsat Component Completion Validation
 * Gathers components from messengerComponentProgress and samsatProcesses without fragile fallback.
 * Enforces that all required components must be COMPLETED.
 * Blocks completion if any component is WAITING, IN_PROGRESS, or NOT_STARTED.
 * Blocks completion if component collection is empty, unless explicit service exemption applies.
 */
export function validateSamsatCompletion(order: OperationalOrder): SamsatValidationResult {
  const serviceId = (order as any).service_id || (order as any).serviceId || "";
  const layanan = (order.layanan || "").toLowerCase().trim();

  // Explicit Service Exemption Rule:
  // Only explicitly non-Samsat or administrative services (e.g. 'svc-lainnya', 'LAINNYA') are exempt.
  const isExemptService =
    serviceId === "svc-lainnya" ||
    serviceId.toUpperCase() === "LAINNYA" ||
    layanan === "lainnya" ||
    (order as any).kategoriLayanan === "LAINNYA";

  const componentMap = new Map<string, { id: string; name: string; status: string }>();

  // 1. From samsatProcesses
  if (Array.isArray(order.samsatProcesses)) {
    for (const p of order.samsatProcesses) {
      if (!p || !p.name) continue;
      const id = String(p.id || p.name).trim();
      const rawStatus = (p.status || "").trim();
      let normalizedStatus = "NOT_STARTED";
      if (rawStatus === "Selesai" || rawStatus === "COMPLETED") {
        normalizedStatus = "COMPLETED";
      } else if (rawStatus === "Dalam Proses" || rawStatus === "IN_PROGRESS") {
        normalizedStatus = "IN_PROGRESS";
      } else if (rawStatus === "Menunggu" || rawStatus === "WAITING") {
        normalizedStatus = "WAITING";
      } else if (rawStatus === "NOT_REQUIRED" || rawStatus === "Tidak Diperlukan") {
        normalizedStatus = "NOT_STARTED";
      }
      componentMap.set(id, { id, name: p.name, status: normalizedStatus });
    }
  }

  // 2. From messengerComponentProgress (overlay live progress)
  if (order.messengerComponentProgress && typeof order.messengerComponentProgress === "object") {
    for (const [id, comp] of Object.entries(order.messengerComponentProgress)) {
      if (!comp || !comp.name) continue;
      const rawStatus = (comp.status || "").trim();
      let normalizedStatus = "NOT_STARTED";
      if (rawStatus === "COMPLETED" || rawStatus === "Selesai") {
        normalizedStatus = "COMPLETED";
      } else if (rawStatus === "IN_PROGRESS" || rawStatus === "Dalam Proses") {
        normalizedStatus = "IN_PROGRESS";
      } else if (rawStatus === "WAITING" || rawStatus === "Menunggu") {
        normalizedStatus = "WAITING";
      } else if (rawStatus === "NOT_REQUIRED" || rawStatus === "Tidak Diperlukan") {
        normalizedStatus = "NOT_STARTED";
      }
      const compKey = String(comp.componentId || id).trim();
      componentMap.set(compKey, {
        id: compKey,
        name: comp.name,
        status: normalizedStatus,
      });
    }
  }

  const allComponents = Array.from(componentMap.values());

  // Rule: Empty component collection check
  if (allComponents.length === 0) {
    if (isExemptService) {
      return {
        allowed: true,
        totalComponents: 0,
        completedComponents: 0,
        incompleteComponents: [],
      };
    }
    return {
      allowed: false,
      code: "SAMSAT_COMPONENTS_REQUIRED",
      error: `Layanan '${order.layanan || serviceId}' mewajibkan komponen loket Samsat. Daftar komponen tidak boleh kosong.`,
      totalComponents: 0,
      completedComponents: 0,
      incompleteComponents: ["(Semua Komponen Wajib Belum Ada)"],
    };
  }

  // Check if ALL components are COMPLETED
  const incomplete = allComponents.filter((c) => c.status !== "COMPLETED");
  if (incomplete.length > 0) {
    const incompleteNames = incomplete.map((c) => `${c.name} (${c.status})`).join(", ");
    return {
      allowed: false,
      code: "SAMSAT_COMPONENTS_INCOMPLETE",
      error: `Terdapat ${incomplete.length} komponen loket Samsat yang belum selesai: ${incompleteNames}. Seluruh komponen wajib selesai (COMPLETED) sebelum menyelesaikan Samsat.`,
      totalComponents: allComponents.length,
      completedComponents: allComponents.length - incomplete.length,
      incompleteComponents: incomplete.map((c) => c.name),
    };
  }

  return {
    allowed: true,
    totalComponents: allComponents.length,
    completedComponents: allComponents.length,
    incompleteComponents: [],
  };
}

/**
 * Validates that an order is currently eligible for Samsat lifecycle processing (Step 4, Not Cancelled).
 * DEFECT-P2-01 Remediation
 */
export function assertValidSamsatStageAndStatus(order: OperationalOrder): void {
  if ((order as any).isCancelled || order.currentStageName === "Dibatalkan" || (order as any).status === "Dibatalkan") {
    throw new ApiError(400, "ORDER_CANCELLED", `Order '${order.orderNo}' sudah dibatalkan.`);
  }

  const stageList = STAGES as readonly string[];
  const currentStep = order.currentStep !== undefined
    ? Number(order.currentStep)
    : (order.currentStageName ? stageList.indexOf(order.currentStageName as any) + 1 : 0);

  const isSamsatStage = currentStep === 4 || order.currentStageName === "Proses Samsat";
  if (!isSamsatStage) {
    throw new ApiError(
      400,
      "INVALID_STAGE",
      `Order '${order.orderNo}' berada pada tahap '${order.currentStageName || "Tidak Diketahui"}' (Step ${currentStep}), bukan pada tahap Proses Samsat.`
    );
  }
}

/**
 * Validates canonical Messenger assignment identity against the order.
 * Strictly prevents generic fallbacks (EMP-MSG) or display-name spoofing.
 * Canonical Identity Contract:
 * - employeeId is authoritative primary identifier.
 * - userId is secondary account identifier.
 * - Display names (nama, userName) are NEVER used for authorization.
 * DEFECT-P2-02, Phase 3.1 & Phase 4 Canonical Remediation
 */
export function assertMessengerOwnership(
  order: OperationalOrder,
  user: TokenPayload | null | undefined,
  taskContext: "SAMSAT" | "PICKUP" | "DELIVERY" | "SAMSAT_PICKUP" | "ANY" = "ANY"
): { messengerId: string; messengerName: string } {
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
  }
  const role = (user.role || "").toLowerCase();
  if (role === "admin" || role === "administrator" || role === "svp" || user.jabatan === "SVP") {
    const courierName = user.nama || (user as any).userName || "Petugas Operasional";
    const courierId = (user as any).employeeId || user.userId || "EMP-ADMIN";
    return { messengerId: courierId, messengerName: courierName };
  }

  if (role !== "messenger") {
    throw new ApiError(403, "FORBIDDEN", "Hanya Messenger atau Admin yang memiliki wewenang untuk tugas ini.");
  }

  const messengerId = (user as any).employeeId;
  if (!messengerId || messengerId === "EMP-MSG" || messengerId === "EMP-SAMSAT" || messengerId === "Belum Ditugaskan" || messengerId === "-") {
    throw new ApiError(403, "FORBIDDEN", "Identitas kurir tidak valid atau tidak memiliki employeeId kanonikal.");
  }
  const messengerName = user.nama || (user as any).userName || "Messenger";

  const matchesId = (idToCheck?: string) => {
    if (!idToCheck || idToCheck === "Belum Ditugaskan" || idToCheck === "-") return false;
    return idToCheck === messengerId ||
           (user.employeeId && idToCheck === user.employeeId) ||
           (user.userId && idToCheck === user.userId);
  };

  if (taskContext === "SAMSAT") {
    const assignedId = order.samsatMessengerId;
    const acceptance = order.taskAcceptance?.["Proses Samsat"];
    const isAssigned = matchesId(assignedId) || (acceptance?.isLocked && matchesId(acceptance?.courierId));
    if (!isAssigned) {
      if (!assignedId || assignedId === "Belum Ditugaskan") {
        throw new ApiError(403, "FORBIDDEN", `Tugas Samsat pada order '${order.orderNo}' masih berada di pool dan belum diambil. Ambil tugas terlebih dahulu.`);
      }
      throw new ApiError(403, "FORBIDDEN", `Akses ditolak: Tugas Samsat pada order '${order.orderNo}' ditugaskan kepada kurir lain.`);
    }
  } else if (taskContext === "PICKUP") {
    const assignedId = order.assignedMessengerId;
    const acceptance = order.taskAcceptance?.["Jemput Dokumen"];
    const isAssigned = matchesId(assignedId) || (acceptance?.isLocked && matchesId(acceptance?.courierId));
    if (!isAssigned) {
      if (!assignedId || assignedId === "Belum Ditugaskan") {
        throw new ApiError(403, "FORBIDDEN", `Tugas Penjemputan pada order '${order.orderNo}' masih berada di pool dan belum diambil. Ambil tugas terlebih dahulu.`);
      }
      throw new ApiError(403, "FORBIDDEN", `Akses ditolak: Tugas Penjemputan pada order '${order.orderNo}' bukan penugasan aktif Anda.`);
    }
  } else if (taskContext === "DELIVERY") {
    const assignedId = (order as any).deliveryMessengerId;
    const acceptance = order.taskAcceptance?.["Pengantaran Dokumen"];
    const isAssigned = matchesId(assignedId) || (acceptance?.isLocked && matchesId(acceptance?.courierId));
    if (!isAssigned) {
      if (!assignedId || assignedId === "Belum Ditugaskan") {
        throw new ApiError(403, "FORBIDDEN", `Tugas Pengantaran pada order '${order.orderNo}' masih berada di pool dan belum diambil. Ambil tugas terlebih dahulu.`);
      }
      throw new ApiError(403, "FORBIDDEN", `Akses ditolak: Tugas Pengantaran pada order '${order.orderNo}' bukan penugasan aktif Anda.`);
    }
  } else if (taskContext === "SAMSAT_PICKUP") {
    const assignedId = order.samsatPickupMessengerId;
    const acceptance = order.taskAcceptance?.["Jemput Hasil Samsat"];
    const isAssigned = matchesId(assignedId) || (acceptance?.isLocked && matchesId(acceptance?.courierId));
    if (!isAssigned) {
      if (!assignedId || assignedId === "Belum Ditugaskan") {
        throw new ApiError(403, "FORBIDDEN", `Tugas Jemput Hasil Samsat pada order '${order.orderNo}' masih berada di pool dan belum diambil. Ambil tugas terlebih dahulu.`);
      }
      throw new ApiError(403, "FORBIDDEN", `Akses ditolak: Tugas Jemput Hasil Samsat pada order '${order.orderNo}' bukan penugasan aktif Anda.`);
    }
  } else if (taskContext === "ANY") {
    const samsatAcc = order.taskAcceptance?.["Proses Samsat"];
    const pickupAcc = order.taskAcceptance?.["Jemput Dokumen"];
    const deliveryAcc = order.taskAcceptance?.["Pengantaran Dokumen"];
    const samsatPickupAcc = order.taskAcceptance?.["Jemput Hasil Samsat"];

    const isAssigned =
      matchesId(order.samsatMessengerId) ||
      matchesId(order.assignedMessengerId) ||
      matchesId((order as any).deliveryMessengerId) ||
      matchesId(order.samsatPickupMessengerId) ||
      (samsatAcc?.isLocked && matchesId(samsatAcc.courierId)) ||
      (pickupAcc?.isLocked && matchesId(pickupAcc.courierId)) ||
      (deliveryAcc?.isLocked && matchesId(deliveryAcc.courierId)) ||
      (samsatPickupAcc?.isLocked && matchesId(samsatPickupAcc.courierId));

    if (!isAssigned) {
      throw new ApiError(403, "FORBIDDEN", `Akses ditolak: Anda tidak memiliki penugasan aktif pada order '${order.orderNo}'.`);
    }
  }

  return { messengerId, messengerName };
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

  public getOrdersPaginated(options: {
    page?: number;
    pageSize?: number;
    archived?: boolean;
    stage?: string;
    search?: string;
  }) {
    return dbOrderRepository.getOrdersPaginated(options);
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

    let resolvedNoInvoice = (rawNoInvoice && String(rawNoInvoice).trim() && !String(rawNoInvoice).startsWith("INV-2026"))
      ? String(rawNoInvoice).trim()
      : matchingInvoiceNo;

    // [DEF-FIN-001 REMEDIATION] Collision prevention for newly assigned invoices
    // If resolvedNoInvoice is already claimed by a different order, prevent collision
    if (resolvedNoInvoice) {
      const existingInv = dbFinanceRepository.getInvoiceByNo(resolvedNoInvoice);
      if (existingInv && existingInv.orderNo !== orderNo) {
        const matchingInv = dbFinanceRepository.getInvoiceByNo(matchingInvoiceNo);
        if (!matchingInv || matchingInv.orderNo === orderNo) {
          resolvedNoInvoice = matchingInvoiceNo;
        } else {
          const currentOrderSeq = parseInt(seqSuffix, 10) || 1;
          let candidateSeq = currentOrderSeq;
          let candidateNo = `INV-${targetMMYY}-${String(candidateSeq).padStart(3, "0")}`;
          while (dbFinanceRepository.getInvoiceByNo(candidateNo)) {
            candidateSeq++;
            candidateNo = `INV-${targetMMYY}-${String(candidateSeq).padStart(3, "0")}`;
          }
          resolvedNoInvoice = candidateNo;
        }
      }
    }

    const resolvedMetodeLayanan = data.metodeLayanan || data.costSnapshot?.metodeLayanan || "Antar Jemput";
    const isDatangLangsung = resolvedMetodeLayanan === "Datang Langsung";
    const initialStep = isDatangLangsung ? 3 : 1;
    const initialStageName: StageName = isDatangLangsung ? "Verifikasi Dokumen" : "Verifikasi";

    const resolvedStatusPengerjaan = data.salesSnapshotStatus || data.statusPengerjaan;

    // Service Validation & Canonical Resolution (Phase B)
    const rawServiceId = (data as any).service_id || (data as any).serviceId;
    let masterService: ServiceEntity | undefined = undefined;

    if (rawServiceId && String(rawServiceId).trim()) {
      const cleanId = String(rawServiceId).trim();
      masterService = serviceRepository.getById(cleanId);
      if (!masterService) {
        throw new ApiError(400, "INVALID_SERVICE", `Layanan dengan ID '${cleanId}' tidak ditemukan di database.`);
      }
      if (Number(masterService.status_aktif) !== 1) {
        throw new ApiError(400, "SERVICE_INACTIVE", `Layanan '${masterService.nama_layanan}' sedang nonaktif dan tidak dapat digunakan untuk order baru.`);
      }
    } else {
      const resolvedSvc = resolveServiceIdentity(null, data.layanan);
      if (resolvedSvc.serviceId) {
        masterService = serviceRepository.getById(resolvedSvc.serviceId);
      }
      if (!masterService && data.layanan) {
        masterService = serviceRepository.getByKode(data.layanan) ||
          serviceRepository.getAll().find((s) => s.nama_layanan.toLowerCase() === String(data.layanan).toLowerCase());
      }
    }

    const resolvedLayanan = masterService ? masterService.nama_layanan : (data.layanan || "Layanan Standar");
    const resolvedServiceId = masterService ? masterService.id : (rawServiceId || null);

    // Samsat Asal Validation & Canonical Resolution (Phase C)
    const rawSamsatAsalId = (data as any).samsat_asal_id || (data as any).samsatAsalId;
    let resolvedSamsatAsalId: string | null = null;
    let resolvedSamsatAsal: string = (data as any).samsat_asal || (data as any).samsatAsal || data.wilayahSamsatAsal || "Jakarta Timur";

    if (rawSamsatAsalId && String(rawSamsatAsalId).trim()) {
      const cleanAsalId = String(rawSamsatAsalId).trim();
      const officeAsal = dbWilayahRepository.getSamsatOfficeById(cleanAsalId);
      if (!officeAsal) {
        throw new ApiError(400, "INVALID_SAMSAT", `Samsat Asal dengan ID '${cleanAsalId}' tidak ditemukan di database.`);
      }
      if (Number(officeAsal.status_aktif) === 0) {
        throw new ApiError(400, "SAMSAT_INACTIVE", `Samsat Asal '${officeAsal.name}' sedang nonaktif.`);
      }
      resolvedSamsatAsalId = officeAsal.id;
      resolvedSamsatAsal = officeAsal.wilayah || officeAsal.name;
    } else if (resolvedSamsatAsal) {
      const allOffices = dbWilayahRepository.getAllSamsatOffices();
      const matched = allOffices.find(
        (o) => o.wilayah.toLowerCase() === resolvedSamsatAsal.toLowerCase() || o.name.toLowerCase() === resolvedSamsatAsal.toLowerCase()
      );
      if (matched) {
        resolvedSamsatAsalId = matched.id;
      }
    }

    // Samsat Tujuan Validation & Canonical Resolution (Phase C)
    const requiresSamsatTujuan = masterService
      ? Number(masterService.memerlukan_samsat_tujuan) === 1
      : resolvedLayanan.toLowerCase().includes("mutasi");

    const rawSamsatTujuanId = (data as any).samsat_tujuan_id || (data as any).samsatTujuanId;
    let resolvedSamsatTujuanId: string = "-";
    let resolvedSamsatTujuan: string = (data as any).samsat_tujuan || (data as any).samsatTujuan || data.wilayahSamsatTujuan || "-";

    if (requiresSamsatTujuan) {
      if (rawSamsatTujuanId && rawSamsatTujuanId !== "-") {
        const cleanTujuanId = String(rawSamsatTujuanId).trim();
        const officeTujuan = dbWilayahRepository.getSamsatOfficeById(cleanTujuanId);
        if (!officeTujuan) {
          throw new ApiError(400, "INVALID_SAMSAT", `Samsat Tujuan dengan ID '${cleanTujuanId}' tidak ditemukan di database.`);
        }
        if (Number(officeTujuan.status_aktif) === 0) {
          throw new ApiError(400, "SAMSAT_INACTIVE", `Samsat Tujuan '${officeTujuan.name}' sedang nonaktif.`);
        }
        resolvedSamsatTujuanId = officeTujuan.id;
        resolvedSamsatTujuan = officeTujuan.wilayah || officeTujuan.name;
      } else if (resolvedSamsatTujuan && resolvedSamsatTujuan !== "-") {
        const allOffices = dbWilayahRepository.getAllSamsatOffices();
        const matched = allOffices.find(
          (o) => o.wilayah.toLowerCase() === resolvedSamsatTujuan.toLowerCase() || o.name.toLowerCase() === resolvedSamsatTujuan.toLowerCase()
        );
        if (matched) {
          resolvedSamsatTujuanId = matched.id;
        }
      }
    }

    // Payment Method Validation (Phase F)
    const incomingPaymentMethod = data.payment?.metodePembayaran || data.metodePembayaran;
    if (incomingPaymentMethod && typeof incomingPaymentMethod === "string") {
      const cleanPm = incomingPaymentMethod.trim();
      const isCashOrDeferred = cleanPm === "Tunai" || cleanPm === "Cash" || cleanPm.includes("Cash") || cleanPm.includes("Bayar di Akhir");
      if (!isCashOrDeferred) {
        const activePms = dbPaymentMethodRepository.getActive();
        const pmMatched = activePms.find(
          (m) => m.nama_metode.toLowerCase() === cleanPm.toLowerCase() ||
                 (m.bank && cleanPm.toLowerCase().includes(m.bank.toLowerCase()))
        );
        const allPms = dbPaymentMethodRepository.getAll();
        const inactiveMatch = allPms.find(
          (m) => (m.nama_metode.toLowerCase() === cleanPm.toLowerCase() ||
                 (m.bank && cleanPm.toLowerCase().includes(m.bank.toLowerCase()))) && m.status === "Nonaktif"
        );
        if (inactiveMatch) {
          throw new ApiError(400, "PAYMENT_METHOD_INACTIVE", `Metode pembayaran '${incomingPaymentMethod}' sedang nonaktif.`);
        }
        if (!pmMatched) {
          throw new ApiError(400, "PAYMENT_METHOD_INACTIVE", `Metode pembayaran '${incomingPaymentMethod}' tidak valid atau sedang nonaktif.`);
        }
      }
    }

    let serviceRequirementsSnapshot: ServiceRequirementsSnapshot | undefined = undefined;
    if (masterService) {
      if (typeof (masterService.requirements as any) === "string") {
        try {
          const parsed = JSON.parse(masterService.requirements as any);
          if (!Array.isArray(parsed)) {
            throw new ApiError(500, "MALFORMED_SERVICE_REQUIREMENTS", `Persyaratan dokumen master layanan '${masterService.nama_layanan}' tidak valid.`);
          }
        } catch {
          throw new ApiError(500, "MALFORMED_SERVICE_REQUIREMENTS", `Persyaratan dokumen master layanan '${masterService.nama_layanan}' tidak valid.`);
        }
      }
      serviceRequirementsSnapshot = buildServiceRequirementsSnapshot(masterService, nowStr);
    }

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
      samsatAsalId: resolvedSamsatAsalId || undefined,
      samsat_asal_id: resolvedSamsatAsalId || undefined,
      samsatTujuanId: resolvedSamsatTujuanId,
      samsat_tujuan_id: resolvedSamsatTujuanId,
      metodeLayanan: resolvedMetodeLayanan,
      serviceRequirementsSnapshot,
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

    // Protected Snapshot Immutability Guard (Patch D): Never allow overwriting existing snapshot
    delete (updates as any).serviceRequirementsSnapshot;
    delete (updates as any).service_requirements_snapshot;
    delete (updates as any).requirementsSnapshot;
    delete (updates as any).requirements_snapshot;

    // Role field scoping & Canonical Identity Enforcement (Phase 2.1, 3.1 & 4)
    if (user && user.role === "messenger") {
      const allowedMessengerFields = new Set([
        // Task timing & completion
        "startedAt", "completedAt",
        "messengerTaskStatus",

        // Pickup (Stage 2)
        "pickupChecklist", "pickupProof", "pickupCompleted", "pickupCompletedAt",
        "checklistSebelumBerangkat",
        "messenger", "assignedMessengerName", "assignedMessengerId", "isScheduled", "tanggalJemput",

        // Samsat (Stage 4)
        "samsatMessenger", "samsatMessengerId", "isSamsatScheduled", "tanggalProsesSamsat",
        "samsatJourneyStartedAt", "samsatArrivedAt", "samsatCompletedAt",
        "samsatStatus", "samsatSubstatus", "samsatProcesses", "currentSamsatProcess",
        "additionalProcesses", "samsatPickupStatus", "samsatPickupMessenger", "samsatPickupMessengerId",
        "samsatPickupStartedAt", "samsatPickupCompletedAt", "samsatResultProof",
        "messengerComponentProgress", "customCostItems",

        // Delivery (Stage 7)
        "messengerPengantar", "deliveryMessengerId", "isDeliveryScheduled", "tanggalPengantaran",
        "deliveryStartedAt", "deliveryStatus", "deliveryHandover",
        "deliveryProof", "receiverName", "tanggalDiterima", "isReceived",

        // Timeline, Acceptance & Multi-Stage Execution
        "messengerTimeline", "taskAcceptance", "samsatStageExecutions",
        "estimasiSelesaiOrder", "tanggalSelesaiAktualOrder"
      ]);

      const adminInstructionFields = new Set([
        "catatanOrder", "catatan_order",
        "catatanPenjadwalan", "catatan_penjadwalan",
        "catatanSamsat", "catatan_samsat",
        "catatanPengantaran", "catatan_pengantaran"
      ]);

      const messengerNoteFields = new Set([
        "messengerTaskNotes", "messenger_task_notes",
        "samsatPickupNotes", "samsat_pickup_notes",
        "catatanKendala", "catatan_kendala",
        "catatanPenyerahan", "catatan_penyerahan",
        "note", "notes", "reason", "catatan"
      ]);

      for (const k of Object.keys(updates)) {
        if (adminInstructionFields.has(k)) {
          throw new ApiError(403, "FORBIDDEN", `Messenger tidak memiliki wewenang untuk mengubah field instruksi Admin '${k}'.`);
        }
        if (messengerNoteFields.has(k)) {
          throw new ApiError(403, "FORBIDDEN", `Messenger tidak diizinkan mengubah catatan operasional bebas '${k}'.`);
        }
        const isMutasiBreakdown = k.startsWith("mutasiKeluar") || k.startsWith("mutasiMasuk");
        if (!allowedMessengerFields.has(k) && !isMutasiBreakdown) {
          throw new ApiError(403, "FORBIDDEN", `Messenger tidak memiliki wewenang untuk mengubah field '${k}'.`);
        }
      }

      // Defense in depth: Check nested objects against free-text notes injection
      if (updates.pickupProof && typeof updates.pickupProof === "object") {
        const pp = updates.pickupProof as any;
        if (
          (pp.notes && typeof pp.notes === "string" && pp.notes.trim()) ||
          (pp.catatanKendala && typeof pp.catatanKendala === "string" && pp.catatanKendala.trim()) ||
          (pp.note && typeof pp.note === "string" && pp.note.trim()) ||
          (pp.catatan && typeof pp.catatan === "string" && pp.catatan.trim())
        ) {
          throw new ApiError(403, "FORBIDDEN", "Messenger tidak diizinkan mengubah catatan operasional bebas pada pickupProof.");
        }
      }
      if (updates.deliveryHandover && typeof updates.deliveryHandover === "object") {
        const dh = updates.deliveryHandover as any;
        if (
          (dh.notes && typeof dh.notes === "string" && dh.notes.trim()) ||
          (dh.note && typeof dh.note === "string" && dh.note.trim()) ||
          (dh.catatan && typeof dh.catatan === "string" && dh.catatan.trim())
        ) {
          throw new ApiError(403, "FORBIDDEN", "Messenger tidak diizinkan mengubah catatan operasional bebas pada deliveryHandover.");
        }
      }
      if (updates.deliveryProof && typeof updates.deliveryProof === "object") {
        const dp = updates.deliveryProof as any;
        if (
          (dp.notes && typeof dp.notes === "string" && dp.notes.trim()) ||
          (dp.note && typeof dp.note === "string" && dp.note.trim()) ||
          (dp.catatan && typeof dp.catatan === "string" && dp.catatan.trim())
        ) {
          throw new ApiError(403, "FORBIDDEN", "Messenger tidak diizinkan mengubah catatan operasional bebas pada deliveryProof.");
        }
      }
      if (updates.messengerComponentProgress && typeof updates.messengerComponentProgress === "object") {
        for (const [compKey, compVal] of Object.entries(updates.messengerComponentProgress)) {
          if (compVal && typeof compVal === "object" && (compVal as any).note && typeof (compVal as any).note === "string" && (compVal as any).note.trim()) {
            throw new ApiError(403, "FORBIDDEN", `Messenger tidak diizinkan mengisi catatan operasional bebas pada komponen Samsat '${compKey}'.`);
          }
        }
      }
      if (Array.isArray(updates.additionalProcesses)) {
        for (const proc of updates.additionalProcesses) {
          if (proc && typeof proc === "object" && proc.note && typeof proc.note === "string" && proc.note.trim()) {
            throw new ApiError(403, "FORBIDDEN", "Messenger tidak diizinkan mengisi catatan operasional bebas pada proses tambahan.");
          }
        }
      }

      // Canonical Messenger Identity Check (DEFECT-P2-02, Phase 3.1)
      const messengerId = (user as any).employeeId;
      if (!messengerId || messengerId === "EMP-MSG" || messengerId === "EMP-SAMSAT" || messengerId === "Belum Ditugaskan" || messengerId === "-") {
        throw new ApiError(403, "FORBIDDEN", "Identitas kurir tidak valid atau tidak memiliki employeeId kanonikal.");
      }

      // Check if order is cancelled
      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }

      // Check Pickup-specific mutation authorization
      const hasPickupFields = Object.keys(updates).some(
        (k) =>
          k === "pickupChecklist" ||
          k === "pickupProof" ||
          k === "pickupCompleted" ||
          k === "pickupCompletedAt" ||
          k === "checklistSebelumBerangkat" ||
          (k === "messengerTaskStatus" && (existing.currentStep === 2 || existing.currentStageName === "Penjadwalan"))
      );

      // Check Samsat-specific mutation authorization
      const hasSamsatFields = Object.keys(updates).some(
        (k) =>
          k === "samsatProcesses" ||
          k === "messengerComponentProgress" ||
          k === "customCostItems" ||
          k === "samsatStatus" ||
          k === "samsatSubstatus" ||
          k === "currentSamsatProcess" ||
          k === "additionalProcesses" ||
          k.startsWith("mutasiKeluar") ||
          k.startsWith("mutasiMasuk")
      );

      // Check Samsat-Pickup (Jemput Hasil) mutation authorization
      const hasSamsatPickupFields = Object.keys(updates).some(
        (k) =>
          k === "samsatPickupStatus" ||
          k === "samsatPickupStartedAt" ||
          k === "samsatPickupCompletedAt" ||
          k === "samsatResultProof"
      );

      // Check Delivery-specific mutation authorization
      const hasDeliveryFields = Object.keys(updates).some(
        (k) =>
          k === "deliveryStatus" ||
          k === "deliveryHandover" ||
          k === "deliveryProof" ||
          k === "receiverName" ||
          k === "tanggalDiterima" ||
          k === "isReceived" ||
          k === "deliveryStartedAt" ||
          (k === "messengerTaskStatus" && (existing.currentStep === 7 || existing.currentStageName === "Pengantaran"))
      );

      if (hasSamsatFields) {
        assertMessengerOwnership(existing, user, "SAMSAT");
        const isSamsatStarted =
          existing.samsatStatus === "Sedang Proses Samsat" ||
          existing.samsatStatus === "Menuju Samsat" ||
          existing.samsatStatus === "Di Lokasi Samsat" ||
          existing.samsatStatus === "Selesai";
        if (!isSamsatStarted && !updates.samsatStatus && (updates.messengerComponentProgress || updates.samsatProcesses || updates.customCostItems)) {
          throw new ApiError(
            400,
            "SAMSAT_NOT_STARTED",
            `Proses Samsat pada order '${orderNo}' belum dimulai. Tekan 'Mulai Proses' sebelum memperbarui komponen atau progres Samsat.`
          );
        }
      } else if (hasPickupFields) {
        assertMessengerOwnership(existing, user, "PICKUP");
        const isPickupStarted =
          existing.messengerTaskStatus === "Sedang Dijemput" ||
          existing.messengerTaskStatus === "Dokumen Sudah Tersedia" ||
          existing.pickupCompleted;
        if (!isPickupStarted && !updates.messengerTaskStatus && (updates.pickupChecklist || updates.pickupProof || updates.checklistSebelumBerangkat)) {
          throw new ApiError(
            400,
            "PICKUP_NOT_STARTED",
            `Tugas penjemputan berkas pada order '${orderNo}' belum dimulai. Tekan 'Mulai Tugas' terlebih dahulu sebelum memperbarui checklist atau progres berkas.`
          );
        }
      } else if (hasDeliveryFields) {
        assertMessengerOwnership(existing, user, "DELIVERY");
        const isDeliveryStarted =
          existing.deliveryStatus === "Sedang Diantar" ||
          existing.deliveryStatus === "Dokumen Diserahkan" ||
          existing.isReceived;
        if (!isDeliveryStarted && !updates.deliveryStartedAt && updates.deliveryStatus !== "Sedang Diantar" && (updates.deliveryHandover || updates.deliveryProof || updates.receiverName)) {
          throw new ApiError(
            400,
            "DELIVERY_NOT_STARTED",
            `Tugas pengantaran berkas pada order '${orderNo}' belum dimulai. Tekan 'Mulai Tugas' terlebih dahulu sebelum memperbarui formulir serah terima.`
          );
        }
      } else if (hasSamsatPickupFields) {
        assertMessengerOwnership(existing, user, "SAMSAT_PICKUP");
      } else {
        assertMessengerOwnership(existing, user, "ANY");
      }
    }

    // Defense in Depth: Reject server-controlled and approval-gated fields across all alias variants
    assertNoProtectedFieldViolations(updates, user);

    // Canonicalize update payload and resolve alias conflicts
    normalizeOrderPayload(updates);

    const safeUpdates: Partial<OperationalOrder> = { ...updates };

    // Enforcement: For role messenger, preserve historical notes and strip forbidden note fields
    if (user && user.role === "messenger") {
      if (safeUpdates.pickupProof && typeof safeUpdates.pickupProof === "object") {
        safeUpdates.pickupProof = {
          ...safeUpdates.pickupProof,
          notes: existing?.pickupProof?.notes,
          catatanKendala: existing?.pickupProof?.catatanKendala,
        };
      }
      if (safeUpdates.deliveryHandover && typeof safeUpdates.deliveryHandover === "object") {
        safeUpdates.deliveryHandover = {
          ...safeUpdates.deliveryHandover,
          notes: existing?.deliveryHandover?.notes,
        };
      }
      delete (safeUpdates as any).messengerTaskNotes;
      delete (safeUpdates as any).samsatPickupNotes;
      delete (safeUpdates as any).catatanKendala;
      delete (safeUpdates as any).catatanOrder;
      delete (safeUpdates as any).catatanPenjadwalan;
      delete (safeUpdates as any).catatanSamsat;
      delete (safeUpdates as any).catatanPengantaran;
      delete (safeUpdates as any).note;
      delete (safeUpdates as any).notes;
      delete (safeUpdates as any).reason;
    }

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

    // Auto-Spawn follow-up pickup task when Samsat is marked completed (Requirement #4)
    if (safeUpdates.samsatStatus === "Selesai") {
      if (!existing.samsatPickupStatus || existing.samsatPickupStatus === "Belum Dijadwal" || existing.samsatPickupStatus === "Belum Dijadwal Jemput Samsat") {
        safeUpdates.samsatPickupStatus = "Belum Dijadwal";
        const updatedAcceptance = {
          ...(existing.taskAcceptance || {}),
          ...(safeUpdates.taskAcceptance || {}),
          ["Jemput Hasil Samsat"]: {
            status: "PENDING" as const,
            isLocked: false,
          },
        };
        safeUpdates.taskAcceptance = updatedAcceptance;
      }
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
        } as any);

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
    if (!orderNo || typeof orderNo !== "string") {
      throw new ApiError(400, "VALIDATION_ERROR", "Nomor order wajib diisi.");
    }
    if (!(STAGES as readonly string[]).includes(targetStage)) {
      throw new ApiError(400, "INVALID_STAGE", `Target stage '${targetStage}' tidak valid.`);
    }

    // Resolve canonical actor employee identity from authenticated server context
    const actorEmployeeId = resolveCanonicalActorEmployeeId(user);

    const updated = runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan dan tidak dapat diproses lebih lanjut.`);
      }
      if ((existing as any).isArchived) {
        throw new ApiError(400, "ORDER_ARCHIVED", `Order '${orderNo}' sudah diarsipkan dan tidak dapat diubah tahapan.`);
      }

      const stageList = STAGES as readonly string[];
      const currentStep = existing.currentStep !== undefined && Number(existing.currentStep) >= 1 && Number(existing.currentStep) <= 8
        ? Number(existing.currentStep)
        : (existing.currentStageName ? stageList.indexOf(existing.currentStageName as any) + 1 : 1);
      const targetStep = stageList.indexOf(targetStage) + 1;

      // Terminal step guard: order completed at Step 8 cannot advance
      if (currentStep === 8 || existing.currentStageName === "Dokumen Telah Diterima") {
        if (targetStage !== "Dokumen Telah Diterima") {
          throw new ApiError(
            400,
            "INVALID_STAGE_TRANSITION",
            `Order '${orderNo}' sudah berada pada tahap selesai (Dokumen Telah Diterima) dan tidak dapat dimajukan lagi.`
          );
        }
      }

      // Backward transition guard: advance endpoint cannot move backwards
      if (targetStep < currentStep) {
        throw new ApiError(
          400,
          "INVALID_STAGE_TRANSITION",
          `Transisi mundur dari '${existing.currentStageName}' (Step ${currentStep}) ke '${targetStage}' (Step ${targetStep}) tidak dapat dilakukan melalui endpoint /advance. Gunakan endpoint /rollback.`
        );
      }

      const isDatangLangsung =
        existing.metodeLayanan === "Datang Langsung" ||
        updates.metodeLayanan === "Datang Langsung" ||
        existing.costSnapshot?.metodeLayanan === "Datang Langsung";

      // Forward transition guard: sequential enforcement and Datang Langsung shortcut
      if (targetStep > currentStep) {
        const isNormalNextStep = targetStep === currentStep + 1;
        const isDatangLangsungShortcut = currentStep === 1 && targetStep === 3 && isDatangLangsung;

        if (!isNormalNextStep && !isDatangLangsungShortcut) {
          throw new ApiError(
            400,
            "INVALID_STAGE_TRANSITION",
            `Transisi tahapan tidak valid: Order tidak dapat melompat dari '${existing.currentStageName}' (Step ${currentStep}) ke '${targetStage}' (Step ${targetStep}). Urutan tahapan harus diproses secara sekuensial.`
          );
        }
      }

      // Role authority check: Supervisi Stage 6 requires Supervisor / SVP
      if (existing.currentStageName === "Supervisi" && targetStage !== "Supervisi") {
        if (user && user.role !== "administrator" && user.jabatan !== "SVP") {
          throw new ApiError(403, "FORBIDDEN", "Hanya Supervisor / SVP yang berwenang melakukan supervisi Stage 6.");
        }
      }

      // Gating 2 -> 3: Penjadwalan -> Verifikasi Dokumen (Pickup completed required for non-walk-in orders)
      if (currentStep === 2 && targetStep === 3) {
        const isPickupDone =
          isDatangLangsung ||
          updates.pickupCompleted ||
          existing.pickupCompleted ||
          updates.messengerTaskStatus === "Dokumen Sudah Tersedia" ||
          existing.messengerTaskStatus === "Dokumen Sudah Tersedia";
        if (!isPickupDone) {
          throw new ApiError(
            400,
            "PREREQUISITE_NOT_MET",
            "Penjemputan berkas oleh kurir belum selesai. Order belum dapat dimajukan ke Verifikasi Dokumen."
          );
        }
      }

      // Gating 3 -> 4: Verifikasi Dokumen -> Proses Samsat (Physical documents verified required)
      if (currentStep === 3 && targetStep === 4) {
        const isDocsDone =
          updates.documentsVerified ||
          existing.documentsVerified;
        if (!isDocsDone) {
          throw new ApiError(
            400,
            "PREREQUISITE_NOT_MET",
            "Verifikasi kelengkapan berkas fisik wajib disetujui terlebih dahulu sebelum order dapat diproses ke Samsat."
          );
        }
      }

      // Gating 4.5: Stage 4 -> Stage 5 Samsat Components Completion Gating
      if (currentStep === 4 && targetStep >= 5) {
        const valResult = validateSamsatCompletion(existing);
        if (!valResult.allowed && valResult.code !== "SAMSAT_COMPONENTS_REQUIRED") {
          throw new ApiError(
            400,
            valResult.code || "SAMSAT_COMPONENTS_INCOMPLETE",
            valResult.error || "Seluruh tahapan komponen loket Samsat wajib berstatus Selesai (COMPLETED) sebelum order dapat dilanjutkan."
          );
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

      // Sanitize advance updates: prevent non-supervisor callers from forging supervisor identity
      const isSpvCaller = user && (user.role === "administrator" || user.jabatan === "SVP" || user.role === "svp");
      const safeAdvanceUpdates: Partial<OperationalOrder> = { ...updates };
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

      // Persetujuan dokumen Stage 6 gating (Supervisi -> Pengantaran)
      if (existing.currentStageName === "Supervisi" && targetStage === "Pengantaran") {
        const isApproved =
          (isSpvCaller && (safeAdvanceUpdates.documentApproval?.stage6Approved || safeAdvanceUpdates.approvedBySpv)) ||
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

      const success = dbOrderRepository.advanceOrder(orderNo, targetStage, safeAdvanceUpdates, actorEmployeeId);
      if (!success) {
        throw new ApiError(500, "ADVANCE_FAILED", `Gagal memajukan order ${orderNo} ke stage ${targetStage}`);
      }

      const currentUpdated = this.getByOrderNo(orderNo);
      this.linkOrderDocuments(currentUpdated);

      // Audit Log with verified actor
      dbAuditRepository.save({
        id: `log-ord-advance-${Date.now()}`,
        userId: actorEmployeeId || user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "ADVANCE_STAGE",
        module: "Order Tracking",
        details: `Transisi order ${orderNo} dari '${existing.currentStageName}' ke '${targetStage}'`,
        metadata: { orderNo, fromStage: existing.currentStageName, toStage: targetStage, actorEmployeeId },
        createdAt: new Date().toISOString(),
      });

      return currentUpdated;
    });

    // Side effect (Notification) executed asynchronously outside the transaction boundary
    this.triggerOrderNotification(updated, "ORDER_UPDATE", targetStage);

    return updated;
  }

  public rollbackOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder> = {}, user?: TokenPayload | null): OperationalOrder {
    if (!orderNo || typeof orderNo !== "string") {
      throw new ApiError(400, "VALIDATION_ERROR", "Nomor order wajib diisi.");
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

    // Resolve canonical actor employee identity from authenticated server context
    const actorEmployeeId = resolveCanonicalActorEmployeeId(user);

    const updated = runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan dan tidak dapat di-rollback.`);
      }
      if ((existing as any).isArchived) {
        throw new ApiError(400, "ORDER_ARCHIVED", `Order '${orderNo}' sudah diarsipkan dan tidak dapat di-rollback.`);
      }

      const stageList = STAGES as readonly string[];
      const currentStep = existing.currentStep !== undefined && Number(existing.currentStep) >= 1 && Number(existing.currentStep) <= 8
        ? Number(existing.currentStep)
        : (existing.currentStageName ? stageList.indexOf(existing.currentStageName as any) + 1 : 1);
      const targetStep = stageList.indexOf(targetStage) + 1;

      if (targetStep >= currentStep) {
        throw new ApiError(
          400,
          "INVALID_ROLLBACK",
          `Tahapan tujuan rollback '${targetStage}' (Step ${targetStep}) harus mendahului tahapan saat ini '${existing.currentStageName}' (Step ${currentStep}).`
        );
      }
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

      // 4. Reset Samsat completion flags if destination <= Step 4 & increment cycle
      if (targetStep <= 4) {
        const nextCycle = ((existing as any).samsatCycle || 1) + 1;
        if (existing.samsatStatus === "Selesai") {
          rollbackUpdates.samsatStatus = "Sedang Proses Samsat";
          rollbackUpdates.samsatCycle = nextCycle;
          revokedFields.push("samsatStatus: Selesai -> Sedang Proses Samsat");
        }
        if (
          existing.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor" ||
          existing.samsatPickupStatus === "Sedang Jemput Dokumen Samsat" ||
          existing.samsatPickupStatus === "Terkendala"
        ) {
          rollbackUpdates.samsatPickupStatus = "Belum Dijadwal";
          delete (rollbackUpdates as any).samsatPickupMessengerId;
          delete (rollbackUpdates as any).samsatPickupMessenger;
          delete (rollbackUpdates as any).samsatPickupMessengerNama;
          delete (rollbackUpdates as any).samsatPickupStartedAt;
          delete (rollbackUpdates as any).samsatPickupCompletedAt;
          revokedFields.push(`samsatPickupStatus: ${existing.samsatPickupStatus} -> Belum Dijadwal (Superseded)`);
        }

        // Mark previous Jemput Hasil Samsat acceptance as SUPERSEDED for cycle isolation
        if (existing.taskAcceptance?.["Jemput Hasil Samsat"]) {
          rollbackUpdates.taskAcceptance = {
            ...(rollbackUpdates.taskAcceptance || existing.taskAcceptance || {}),
            ["Jemput Hasil Samsat"]: {
              ...(existing.taskAcceptance["Jemput Hasil Samsat"] as any),
              status: "SUPERSEDED" as any,
              isLocked: true,
              supersededAt: new Date().toISOString(),
              supersededReason: `Samsat rolled back to Step ${targetStep} (Cycle ${nextCycle})`,
            },
          };
        }
      }

      rollbackUpdates.documentApproval = revokedApproval;
      rollbackUpdates.currentStageName = targetStage;
      rollbackUpdates.currentStep = targetStep;

      const success = dbOrderRepository.updateOrder(orderNo, rollbackUpdates);
      if (!success) {
        throw new ApiError(500, "ROLLBACK_FAILED", `Gagal memproses rollback order ${orderNo} ke stage ${targetStage}`);
      }

      // Atomically record rollback in order_status_history with canonical actor
      dbOrderRepository.recordStatusHistory(
        orderNo,
        currentStep,
        targetStep,
        targetStage,
        (updates as any)?.catatanPenjadwalan || (updates as any)?.catatan || `Rollback order ${orderNo} dari '${existing.currentStageName}' (Step ${currentStep}) ke '${targetStage}' (Step ${targetStep})`,
        actorEmployeeId || null
      );

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

  public cancelOrder(
    orderNo: string,
    reason: string,
    user?: TokenPayload | null,
    options?: CancelOrderOptions
  ): OperationalOrder {
    if (!reason || !reason.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Alasan pembatalan order wajib diisi.");
    }
    const actorEmployeeId = resolveCanonicalActorEmployeeId(user);
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

      // Atomically record cancellation in order_status_history with canonical actor
      dbOrderRepository.recordStatusHistory(
        orderNo,
        existing.currentStep,
        0,
        "Dibatalkan",
        `Dibatalkan: ${reason.trim()}`,
        actorEmployeeId || null
      );

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
        if (paidAmount > 0 && !options?.skipRefundPending) {
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
        userId: actorEmployeeId || user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "CANCEL_ORDER",
        module: "Data Penjualan",
        details: `Membatalkan order ${orderNo}. Alasan: ${reason.trim()}`,
        metadata: { orderNo, reason: reason.trim(), actorEmployeeId },
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

  /**
   * Messenger Accepts Task (Tugas Baru -> Tugas Aktif & Terkunci)
   * Enforces race condition protection against double acceptance
   */
  public acceptMessengerTask(orderNo: string, taskType: string, user: TokenPayload): OperationalOrder {
    const courierName = user.nama || (user as any).userName || "Messenger Lapangan";
    const role = (user.role || "").toLowerCase();
    const courierId = role === "messenger" ? (user as any).employeeId : ((user as any).employeeId || user.userId);

    if (role === "messenger") {
      if (!courierId || courierId === "EMP-MSG" || courierId === "EMP-SAMSAT" || courierId === "Belum Ditugaskan" || courierId === "-") {
        throw new ApiError(403, "FORBIDDEN", "Identitas kurir tidak valid atau tidak memiliki employeeId kanonikal.");
      }
    } else if (!courierId) {
      throw new ApiError(403, "FORBIDDEN", "Identitas pengguna tidak valid.");
    }

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      const currentAcceptance = (existing.taskAcceptance || {})[taskType];

      // 1. Idempotency Check: Same courier retrying acceptance
      if (currentAcceptance?.isLocked && currentAcceptance.courierId && currentAcceptance.courierId === courierId) {
        // Already accepted and locked by the same courier.
        // Return existing order without creating duplicate timeline events or duplicate audit logs.
        return existing;
      }

      // 2. Concurrency Conflict: Task is already locked by a different courier
      if (currentAcceptance?.isLocked && currentAcceptance.courierId && currentAcceptance.courierId !== courierId) {
        throw new ApiError(
          409,
          "TASK_ALREADY_ACCEPTED",
          `Tugas ${taskType} pada order ${orderNo} sudah diterima dan dikunci oleh kurir lain (${currentAcceptance.courierName || "Petugas lain"}).`
        );
      }

      const nowIso = new Date().toISOString();

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        [taskType]: {
          status: "ACCEPTED" as const,
          acceptedAt: nowIso,
          courierId,
          courierName,
          isLocked: true,
        },
      };

      const taskUpdates: Partial<OperationalOrder> = {
        taskAcceptance: updatedAcceptance,
      };

      const timelineEvent: any = {
        id: `tl-acc-${Date.now()}`,
        timestamp: nowIso,
        title: `Tugas ${taskType} Diterima`,
        note: `Tugas operasional diterima dan dikunci oleh kurir ${courierName}`,
        author: courierName,
        type: "STATUS_CHANGE",
      };
      const existingTimeline = existing.messengerTimeline || [];
      taskUpdates.messengerTimeline = [timelineEvent, ...existingTimeline];

      // Canonical check: Courier must have valid non-generic identity
      if (!courierId || courierId === "EMP-MSG" || courierId === "Belum Ditugaskan" || courierId === "-") {
        throw new ApiError(403, "FORBIDDEN", "Identitas kurir tidak valid atau tidak terverifikasi.");
      }

      // Align order-level courier assignment fields
      if (taskType === "Jemput Dokumen") {
        taskUpdates.messenger = courierName;
        taskUpdates.assignedMessengerName = courierName;
        taskUpdates.assignedMessengerId = courierId;
        taskUpdates.isScheduled = true;
        if (!existing.tanggalJemput) taskUpdates.tanggalJemput = nowIso.split("T")[0];
      } else if (taskType === "Proses Samsat") {
        taskUpdates.samsatMessenger = courierName;
        taskUpdates.samsatMessengerNama = courierName;
        taskUpdates.samsatMessengerId = courierId;
        taskUpdates.isSamsatScheduled = true;
        if (!existing.tanggalProsesSamsat) taskUpdates.tanggalProsesSamsat = nowIso.split("T")[0];
      } else if (taskType === "Jemput Hasil Samsat") {
        // Validate order stage and Samsat status
        if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
          throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
        }
        if (existing.currentStep !== 4 && existing.currentStageName !== "Proses Samsat") {
          throw new ApiError(400, "INVALID_STAGE", `Tugas Jemput Hasil Samsat hanya dapat diambil pada Step 4 (Proses Samsat).`);
        }
        if (existing.samsatStatus !== "Selesai") {
          throw new ApiError(400, "SAMSAT_NOT_COMPLETED", `Proses pengurusan Samsat belum berstatus Selesai.`);
        }

        // Cycle & Superseded check
        const currentCycle = (existing as any).samsatCycle || 1;
        const existingPickupAcc = (existing.taskAcceptance || {})["Jemput Hasil Samsat"];
        if (existingPickupAcc?.status === "SUPERSEDED") {
          throw new ApiError(400, "TASK_SUPERSEDED", "Tugas Jemput Hasil Samsat ini sudah tidak berlaku (superseded) karena proses Samsat di-rollback.");
        }
        if (existingPickupAcc?.cycle && existingPickupAcc.cycle !== currentCycle) {
          throw new ApiError(400, "TASK_SUPERSEDED", `Tugas Jemput Hasil Samsat berasal dari cycle lama (Cycle ${existingPickupAcc.cycle}), cycle aktif adalah Cycle ${currentCycle}.`);
        }

        taskUpdates.samsatPickupMessenger = courierName;
        taskUpdates.samsatPickupMessengerNama = courierName;
        taskUpdates.samsatPickupMessengerId = courierId;
        // Task Acceptance begins the lifecycle immediately
        taskUpdates.samsatPickupStatus = "Sedang Jemput Dokumen Samsat";
        taskUpdates.samsatPickupStartedAt = existing.samsatPickupStartedAt || nowIso;

        // Ensure updated acceptance has cycle info
        (updatedAcceptance["Jemput Hasil Samsat"] as any).cycle = currentCycle;
        (updatedAcceptance["Jemput Hasil Samsat"] as any).startedAt = nowIso;
      } else if (taskType === "Pengantaran Dokumen") {
        taskUpdates.messengerPengantar = courierName;
        (taskUpdates as any).deliveryMessengerId = courierId;
        taskUpdates.isDeliveryScheduled = true;
        if (!existing.tanggalPengantaran) taskUpdates.tanggalPengantaran = nowIso.split("T")[0];
      }

      dbOrderRepository.updateOrder(orderNo, taskUpdates);
      const updated = this.getByOrderNo(orderNo);

      dbAuditRepository.save({
        id: `log-task-accept-${Date.now()}`,
        userId: courierId,
        userName: courierName,
        userRole: (user.role as any) || "messenger",
        action: "ACCEPT_TASK",
        module: "Messenger Task",
        details: `Kurir ${courierName} menerima dan mengunci tugas ${taskType} pada order ${orderNo}`,
        metadata: { orderNo, taskType, courierId, courierName, acceptedAt: nowIso },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Messenger Declines Task (Tolak Tugas -> Menunggu Penugasan Kembali)
   */
  public declineMessengerTask(orderNo: string, taskType: string, reason: string | undefined, user: TokenPayload): OperationalOrder {
    const courierName = user.nama || (user as any).userName || "Messenger Lapangan";
    const role = (user.role || "").toLowerCase();
    const courierId = (user as any).employeeId || user.userId;
    if (!courierId || courierId === "EMP-MSG" || courierId === "Belum Ditugaskan" || courierId === "-") {
      throw new ApiError(403, "FORBIDDEN", "Identitas kurir tidak valid atau tidak terverifikasi.");
    }

    // Zero free-text operational notes enforcement: Rejection reason must not be free-text for messengers
    if (role === "messenger" && reason && typeof reason === "string" && reason.trim().length > 0) {
      throw new ApiError(400, "MESSENGER_NOTES_NOT_ALLOWED", "Catatan/alasan operasional bebas (free-text reason) tidak diizinkan pada penolakan tugas.");
    }

    const canonicalReason = "Ditolak oleh kurir";

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      const nowIso = new Date().toISOString();

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        [taskType]: {
          status: "DECLINED" as const,
          declinedAt: nowIso,
          declineReason: canonicalReason,
          courierId,
          courierName,
          isLocked: false,
        },
      };

      const taskUpdates: Partial<OperationalOrder> = {
        taskAcceptance: updatedAcceptance,
      };

      const timelineEvent: any = {
        id: `tl-dec-${Date.now()}`,
        timestamp: nowIso,
        title: `Tugas ${taskType} Ditolak`,
        note: `Tugas ${taskType} ditolak oleh kurir ${courierName}.`,
        author: courierName,
        type: "STATUS_CHANGE",
      };
      const existingTimeline = existing.messengerTimeline || [];
      taskUpdates.messengerTimeline = [timelineEvent, ...existingTimeline];

      // Reset courier assignment so it returns to unassigned
      if (taskType === "Jemput Dokumen") {
        taskUpdates.messenger = "Belum Ditugaskan";
        taskUpdates.assignedMessengerName = "Belum Ditugaskan";
        taskUpdates.assignedMessengerId = undefined;
      } else if (taskType === "Proses Samsat") {
        taskUpdates.samsatMessenger = "Belum Ditugaskan";
        taskUpdates.samsatMessengerNama = "Belum Ditugaskan";
        taskUpdates.samsatMessengerId = undefined;
      } else if (taskType === "Jemput Hasil Samsat") {
        taskUpdates.samsatPickupMessenger = undefined;
        taskUpdates.samsatPickupMessengerNama = undefined;
        taskUpdates.samsatPickupMessengerId = undefined;
        taskUpdates.samsatPickupStatus = "Belum Dijadwal";
      } else if (taskType === "Pengantaran Dokumen") {
        taskUpdates.messengerPengantar = "Belum Ditugaskan";
        (taskUpdates as any).deliveryMessengerId = undefined;
      }

      dbOrderRepository.updateOrder(orderNo, taskUpdates);
      const updated = this.getByOrderNo(orderNo);

      dbAuditRepository.save({
        id: `log-task-decline-${Date.now()}`,
        userId: courierId,
        userName: courierName,
        userRole: (user.role as any) || "messenger",
        action: "DECLINE_TASK",
        module: "Messenger Task",
        details: `Kurir ${courierName} menolak tugas ${taskType} pada order ${orderNo}`,
        metadata: { orderNo, taskType, courierId, courierName },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Admin Reassigns Task (Alihkan Tugas Resmi dengan Catatan & Audit Log)
   */
  public reassignMessengerTask(
    orderNo: string,
    taskType: string,
    newCourierName: string,
    newCourierId: string,
    reason: string,
    adminUser: TokenPayload
  ): OperationalOrder {
    const existing = this.getByOrderNo(orderNo);
    const nowIso = new Date().toISOString();
    const adminName = adminUser.nama || "Admin Kantor";
    const cleanReason = (reason || "").trim();

    if (!cleanReason) {
      throw new ApiError(400, "REASON_REQUIRED", "Alasan pengalihan tugas wajib diisi.");
    }
    if (!newCourierName || !newCourierName.trim()) {
      throw new ApiError(400, "COURIER_REQUIRED", "Nama kurir pengganti wajib dipilih.");
    }

    const currentAcceptance = (existing.taskAcceptance || {})[taskType];
    const oldCourier = currentAcceptance?.courierName || existing.messenger || "Kurir Sebelumnya";

    const updatedAcceptance = {
      ...(existing.taskAcceptance || {}),
      [taskType]: {
        status: "PENDING" as const,
        courierId: newCourierId,
        courierName: newCourierName.trim(),
        isLocked: false,
        reassignedFrom: oldCourier,
        reassignReason: cleanReason,
        reassignedAt: nowIso,
      },
    };

    const taskUpdates: Partial<OperationalOrder> = {
      taskAcceptance: updatedAcceptance,
    };

    const timelineEvent: any = {
      id: `tl-reassign-${Date.now()}`,
      timestamp: nowIso,
      title: `Tugas ${taskType} Dialihkan`,
      note: `Tugas dialihkan dari ${oldCourier} ke ${newCourierName.trim()} oleh ${adminName}. Alasan: ${cleanReason}`,
      author: adminName,
      type: "ASSIGNMENT",
    };
    const existingTimeline = existing.messengerTimeline || [];
    taskUpdates.messengerTimeline = [timelineEvent, ...existingTimeline];

    if (taskType === "Jemput Dokumen") {
      taskUpdates.messenger = newCourierName.trim();
      taskUpdates.assignedMessengerName = newCourierName.trim();
      taskUpdates.assignedMessengerId = newCourierId;
    } else if (taskType === "Proses Samsat") {
      taskUpdates.samsatMessenger = newCourierName.trim();
      taskUpdates.samsatMessengerNama = newCourierName.trim();
      taskUpdates.samsatMessengerId = newCourierId;
    } else if (taskType === "Jemput Hasil Samsat") {
      taskUpdates.samsatPickupMessenger = newCourierName.trim();
      taskUpdates.samsatPickupMessengerNama = newCourierName.trim();
      taskUpdates.samsatPickupMessengerId = newCourierId;
    } else if (taskType === "Pengantaran Dokumen") {
      taskUpdates.messengerPengantar = newCourierName.trim();
      (taskUpdates as any).deliveryMessengerId = newCourierId;
    }

    return runInTransaction(() => {
      dbOrderRepository.updateOrder(orderNo, taskUpdates);
      const updated = this.getByOrderNo(orderNo);

      dbAuditRepository.save({
        id: `log-task-reassign-${Date.now()}`,
        userId: adminUser.userId || "usr-admin",
        userName: adminName,
        userRole: (adminUser.role as any) || "admin",
        action: "REASSIGN_TASK",
        module: "Messenger Task",
        details: `Admin ${adminName} mengalihkan tugas ${taskType} order ${orderNo} dari ${oldCourier} ke ${newCourierName}. Alasan: ${cleanReason}`,
        metadata: { orderNo, taskType, oldCourier, newCourier: newCourierName, reason: cleanReason },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Automatic Spawn: Jemput Dokumen Hasil Samsat dari Samsat ke Kantor
   * Automatically triggered when courier completes Samsat process
   */
  public autoSpawnSamsatResultPickup(orderNo: string, actorUser?: TokenPayload): OperationalOrder {
    const existing = this.getByOrderNo(orderNo);
    const nowIso = new Date().toISOString();
    const actorName = actorUser?.nama || "Sistem Otomasi";

    const updatedAcceptance = {
      ...(existing.taskAcceptance || {}),
      ["Jemput Hasil Samsat"]: {
        status: "PENDING" as const,
        isLocked: false,
      },
    };

    const timelineEvent: any = {
      id: `tl-autospawn-${Date.now()}`,
      timestamp: nowIso,
      title: "Tugas Otomatis: Jemput Hasil Samsat",
      note: "Sistem otomatis membuat tugas penjemputan berkas hasil Samsat ke kantor (tersedia bagi kurir).",
      author: actorName,
      type: "STATUS_CHANGE",
    };
    const existingTimeline = existing.messengerTimeline || [];

    const updates: Partial<OperationalOrder> = {
      samsatPickupStatus: "Belum Dijadwal",
      taskAcceptance: updatedAcceptance,
      messengerTimeline: [timelineEvent, ...existingTimeline],
    };

    return runInTransaction(() => {
      dbOrderRepository.updateOrder(orderNo, updates);
      return this.getByOrderNo(orderNo);
    });
  }

  /**
   * Messenger Starts Samsat Process (Scope 1)
   * Activates Samsat journey / process atomically with idempotency protection.
   */
  public startSamsatProcess(orderNo: string, user: TokenPayload): OperationalOrder {
    const courierName = user.nama || (user as any).userName || "Messenger Lapangan";
    const role = (user.role || "").toLowerCase();
    const courierId = role === "messenger" ? (user as any).employeeId : ((user as any).employeeId || user.userId);

    if (role === "messenger") {
      if (!courierId || courierId === "EMP-MSG" || courierId === "EMP-SAMSAT" || courierId === "Belum Ditugaskan" || courierId === "-") {
        throw new ApiError(403, "FORBIDDEN", "Identitas kurir tidak valid atau tidak memiliki employeeId kanonikal.");
      }
    } else if (!courierId) {
      throw new ApiError(403, "FORBIDDEN", "Identitas pengguna tidak valid.");
    }

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      // Check Stage and Cancellation
      assertValidSamsatStageAndStatus(existing);

      // Verify Messenger Assignment Ownership
      assertMessengerOwnership(existing, user, "SAMSAT");

      // 3. Completed Cycle Guard: Prevent restarting a completed cycle without new cycle (DEFECT-P2-01)
      const currentCycle = (existing as any).samsatCycle || 1;
      if (existing.samsatStatus === "Selesai" && (existing as any).samsatCompletedCycle === currentCycle) {
        throw new ApiError(
          400,
          "SAMSAT_ALREADY_COMPLETED",
          `Proses Samsat siklus ${currentCycle} untuk order '${orderNo}' sudah selesai. Gunakan alur rollback jika perlu pembetulan loket.`
        );
      }

      // Idempotency: If process is already started in this cycle, return existing
      if (
        existing.samsatStatus === "Sedang Proses Samsat" ||
        existing.samsatStatus === "Menuju Samsat" ||
        existing.samsatStatus === "Di Lokasi Samsat"
      ) {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const timelineEvent: any = {
        id: `tl-samsat-start-${Date.now()}`,
        timestamp: nowIso,
        title: "Mulai Proses Samsat",
        note: `Proses Samsat untuk ${existing.customer} (${existing.layanan}) dimulai oleh ${courierName}`,
        author: courierName,
        type: "STATUS_CHANGE",
      };

      const updates: Partial<OperationalOrder> = {
        samsatStatus: "Sedang Proses Samsat",
        samsatStartedAt: existing.samsatStartedAt || nowIso,
        samsatJourneyStartedAt: existing.samsatJourneyStartedAt || nowIso,
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo);

      dbAuditRepository.save({
        id: `log-samsat-start-${Date.now()}`,
        userId: courierId,
        userName: courierName,
        userRole: (user.role as any) || "messenger",
        action: "START_SAMSAT_PROCESS",
        module: "Proses Samsat",
        details: `Petugas ${courierName} memulai proses Samsat order ${orderNo}`,
        metadata: { orderNo },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Atomic Samsat Process Completion (Scope 2, Scope 4)
   * Enforces component completion validation, idempotent retry, cycle differentiation,
   * and atomic auto-spawn of Jemput Hasil Samsat task.
   */
  public completeSamsatProcess(
    orderNo: string,
    payload: { note?: string } = {},
    user: TokenPayload
  ): OperationalOrder {
    const actorName = user.nama || (user as any).userName || "Petugas Samsat";
    const role = (user.role || "").toLowerCase();
    const actorId = role === "messenger" ? (user as any).employeeId : ((user as any).employeeId || user.userId);

    if (role === "messenger") {
      if (!actorId || actorId === "EMP-MSG" || actorId === "EMP-SAMSAT" || actorId === "Belum Ditugaskan" || actorId === "-") {
        throw new ApiError(403, "FORBIDDEN", "Identitas kurir tidak valid atau tidak memiliki employeeId kanonikal.");
      }
      if (payload.note && typeof payload.note === "string" && payload.note.trim().length > 0) {
        throw new ApiError(
          400,
          "MESSENGER_NOTES_NOT_ALLOWED",
          "Catatan operasional bebas (free-text notes) tidak diizinkan pada penyelesaian Samsat."
        );
      }
    } else if (!actorId) {
      throw new ApiError(403, "FORBIDDEN", "Identitas pengguna tidak valid.");
    }
    const note = (payload.note || "").trim();

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      // Check Stage and Cancellation
      assertValidSamsatStageAndStatus(existing);

      // Verify Messenger Assignment Ownership
      assertMessengerOwnership(existing, user, "SAMSAT");

      // Track Samsat Cycle
      const currentCycle = (existing as any).samsatCycle || 1;

      // 1. Idempotency Check: Already completed in this cycle
      if (existing.samsatStatus === "Selesai" && (existing as any).samsatCompletedCycle === currentCycle) {
        return existing;
      }

      // 2. Component Completion Validation
      const valResult = validateSamsatCompletion(existing);
      if (!valResult.allowed) {
        throw new ApiError(
          400,
          valResult.code || "SAMSAT_COMPONENTS_INCOMPLETE",
          valResult.error || "Seluruh komponen loket Samsat wajib selesai sebelum menyelesaikan proses Samsat."
        );
      }

      const nowIso = new Date().toISOString();

      // Check if auto-spawn already exists for the CURRENT cycle
      const currentPickupTask = (existing.taskAcceptance || {})["Jemput Hasil Samsat"];
      const isSpawnedForCurrentCycle = Boolean(
        currentPickupTask && (currentPickupTask as any).cycle === currentCycle
      );

      const timelineEventsToPrepend: any[] = [];

      if (!isSpawnedForCurrentCycle) {
        timelineEventsToPrepend.push({
          id: `tl-spawn-pickup-c${currentCycle}-${Date.now()}`,
          timestamp: nowIso,
          title: "Tugas Otomatis: Jemput Hasil Samsat",
          note: "Sistem otomatis membuat tugas penjemputan berkas hasil Samsat ke kantor (tersedia bagi kurir).",
          author: "Sistem Otomasi",
          type: "STATUS_CHANGE",
        });
      }

      timelineEventsToPrepend.push({
        id: `tl-samsat-done-c${currentCycle}-${Date.now()}`,
        timestamp: nowIso,
        title: "Proses Samsat Selesai (Kirim Hasil)",
        note: "Seluruh tahapan komponen pengurusan di loket Samsat telah selesai diproses.",
        author: actorName,
        type: "STATUS_CHANGE",
      });

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        ["Jemput Hasil Samsat"]: {
          status: "PENDING" as const,
          isLocked: false,
          spawnedAt: nowIso,
          cycle: currentCycle,
        },
      };

      const updates: Partial<OperationalOrder> = {
        samsatStatus: "Selesai",
        samsatCompletedAt: nowIso,
        samsatCompletedCycle: currentCycle,
        samsatPickupStatus: existing.samsatPickupStatus && existing.samsatPickupStatus !== "Belum Dijadwal"
          ? existing.samsatPickupStatus
          : "Belum Dijadwal",
        taskAcceptance: updatedAcceptance,
        messengerTaskNotes: existing.messengerTaskNotes,
        messengerTimeline: [...timelineEventsToPrepend, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo);

      dbAuditRepository.save({
        id: `log-samsat-complete-${Date.now()}`,
        userId: actorId,
        userName: actorName,
        userRole: (user.role as any) || "messenger",
        action: "COMPLETE_SAMSAT",
        module: "Proses Samsat",
        details: `Pengurusan Samsat order ${orderNo} diselesaikan oleh ${actorName}`,
        metadata: { orderNo, cycle: currentCycle },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Messenger Starts Pickup Task (Scope A)
   * Activates pickup process atomically with idempotency protection.
   */
  public startPickupTask(orderNo: string, user: TokenPayload): OperationalOrder {
    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      // 1. Stage and Cancellation Guard
      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }
      if (existing.currentStep !== 2 && existing.currentStageName !== "Penjadwalan") {
        throw new ApiError(400, "INVALID_STAGE", `Tugas penjemputan berkas hanya dapat dimulai pada Step 2 (Penjadwalan), tahapan saat ini adalah Step ${existing.currentStep} (${existing.currentStageName}).`);
      }

      // 2. Ownership & Role Guard
      const { messengerId, messengerName } = assertMessengerOwnership(existing, user, "PICKUP");

      // 3. Idempotency Check
      if (existing.messengerTaskStatus === "Sedang Dijemput" || existing.pickupCompleted) {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const timelineEvent: any = {
        id: `tl-pickup-start-${Date.now()}`,
        timestamp: nowIso,
        title: "Mulai Penjemputan Dokumen",
        note: `Penjemputan berkas dari pelanggan ${existing.customer} (${existing.nomorHP || '-'}) dimulai oleh kurir ${messengerName}`,
        author: messengerName,
        type: "STATUS_CHANGE",
      };

      const updates: Partial<OperationalOrder> = {
        messengerTaskStatus: "Sedang Dijemput",
        startedAt: existing.startedAt || nowIso,
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo)!;

      dbAuditRepository.save({
        id: `log-pickup-start-${Date.now()}`,
        userId: messengerId,
        userName: messengerName,
        userRole: (user.role as any) || "messenger",
        action: "START_TASK",
        module: "Penjemputan Dokumen",
        details: `Kurir ${messengerName} memulai tugas penjemputan berkas order ${orderNo}`,
        metadata: { orderNo, taskType: "Jemput Dokumen" },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Completes Pickup Task (Scope B)
   */
  public completePickupTask(
    orderNo: string,
    payload: { checklist?: Record<string, boolean>; photoUrl?: string; notes?: string; note?: string },
    user: TokenPayload
  ): OperationalOrder {
    const role = (user.role || "").toLowerCase();
    if (role === "messenger") {
      const pNote = (payload.notes || payload.note || "").trim();
      if (pNote.length > 0) {
        throw new ApiError(
          400,
          "MESSENGER_NOTES_NOT_ALLOWED",
          "Catatan operasional bebas (free-text notes) tidak diizinkan pada penyelesaian penjemputan berkas."
        );
      }
    }

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }
      if (existing.currentStep !== 2 && existing.currentStageName !== "Penjadwalan") {
        throw new ApiError(400, "INVALID_STAGE", `Tugas penjemputan berkas hanya dapat diselesaikan pada Step 2 (Penjadwalan).`);
      }

      const { messengerId, messengerName } = assertMessengerOwnership(existing, user, "PICKUP");

      // Idempotency: If already completed, return existing
      if (existing.pickupCompleted && existing.messengerTaskStatus === "Dokumen Sudah Tersedia") {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const finalChecklist = { ...(existing.pickupChecklist || {}), ...(payload.checklist || {}) };

      const timelineEvent: any = {
        id: `tl-pickup-done-${Date.now()}`,
        timestamp: nowIso,
        title: "Penjemputan Berkas Selesai",
        note: `Berkas fisik dari pelanggan ${existing.customer} telah dijemput dan dibawa oleh kurir ${messengerName}`,
        author: messengerName,
        type: "STATUS_CHANGE",
      };

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        ["Jemput Dokumen"]: {
          status: "COMPLETED" as const,
          completedAt: nowIso,
          courierId: messengerId,
          courierName: messengerName,
          isLocked: true,
        },
      };

      const updates: Partial<OperationalOrder> = {
        pickupCompleted: true,
        pickupCompletedAt: existing.pickupCompletedAt || nowIso,
        messengerTaskStatus: "Dokumen Sudah Tersedia",
        pickupChecklist: finalChecklist,
        pickupProof: payload.photoUrl
          ? (typeof existing.pickupProof === "object" && existing.pickupProof !== null
              ? { ...existing.pickupProof, photoProofUrl: payload.photoUrl, completedAt: nowIso }
              : { photoProofUrl: payload.photoUrl, completedAt: nowIso })
          : existing.pickupProof,
        taskAcceptance: updatedAcceptance,
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo)!;

      dbAuditRepository.save({
        id: `log-pickup-done-${Date.now()}`,
        userId: messengerId,
        userName: messengerName,
        userRole: (user.role as any) || "messenger",
        action: "COMPLETE_TASK",
        module: "Penjemputan Dokumen",
        details: `Kurir ${messengerName} menyelesaikan tugas penjemputan berkas order ${orderNo}`,
        metadata: { orderNo, taskType: "Jemput Dokumen" },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Releases Pickup Task back to Team Pool (Scope C Handover)
   */
  public releasePickupTask(
    orderNo: string,
    user: TokenPayload,
    notes?: string
  ): OperationalOrder {
    const role = (user.role || "").toLowerCase();
    const cleanNotes = (notes || "").trim();
    if (role === "messenger" && cleanNotes.length > 0) {
      throw new ApiError(
        400,
        "MESSENGER_NOTES_NOT_ALLOWED",
        "Catatan operasional bebas (free-text notes) tidak diizinkan pada penyerahan tugas."
      );
    }

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }

      const { messengerId, messengerName } = assertMessengerOwnership(existing, user, "PICKUP");

      const nowIso = new Date().toISOString();

      const timelineEvent: any = {
        id: `tl-pickup-release-${Date.now()}`,
        timestamp: nowIso,
        title: "Tugas Penjemputan Diserahkan ke Tim",
        note: `Tugas penjemputan dikembalikan ke pool antrean oleh kurir ${messengerName}.`,
        author: messengerName,
        type: "ASSIGNMENT",
      };

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        ["Jemput Dokumen"]: {
          status: "PENDING" as const,
          isLocked: false,
          releasedAt: nowIso,
          releasedBy: messengerName,
        },
      };

      const updates: Partial<OperationalOrder> = {
        messenger: "Belum Ditugaskan",
        assignedMessengerName: "Belum Ditugaskan",
        assignedMessengerId: undefined,
        messengerTaskStatus: "Belum Diambil",
        taskAcceptance: updatedAcceptance,
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo)!;

      dbAuditRepository.save({
        id: `log-pickup-release-${Date.now()}`,
        userId: messengerId,
        userName: messengerName,
        userRole: (user.role as any) || "messenger",
        action: "RELEASE_TASK",
        module: "Penjemputan Dokumen",
        details: `Tugas penjemputan berkas order ${orderNo} diserahkan ke tim oleh ${messengerName}`,
        metadata: { orderNo, taskType: "Jemput Dokumen" },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Messenger Starts Delivery Task (Scope A)
   */
  public startDeliveryTask(orderNo: string, user: TokenPayload): OperationalOrder {
    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }
      if (existing.currentStep !== 7 && existing.currentStageName !== "Pengantaran") {
        throw new ApiError(400, "INVALID_STAGE", `Tugas pengantaran berkas hanya dapat dimulai pada Step 7 (Pengantaran), tahapan saat ini adalah Step ${existing.currentStep} (${existing.currentStageName}).`);
      }

      const { messengerId, messengerName } = assertMessengerOwnership(existing, user, "DELIVERY");

      // Idempotency
      if (existing.deliveryStatus === "Sedang Diantar" || existing.deliveryStatus === "Dokumen Diserahkan") {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const timelineEvent: any = {
        id: `tl-delivery-start-${Date.now()}`,
        timestamp: nowIso,
        title: "Mulai Pengantaran Dokumen",
        note: `Pengantaran berkas hasil kepada pelanggan ${existing.customer} (${existing.alamatPengantaran || '-'}) dimulai oleh kurir ${messengerName}`,
        author: messengerName,
        type: "STATUS_CHANGE",
      };

      const updates: Partial<OperationalOrder> = {
        deliveryStatus: "Sedang Diantar",
        deliveryStartedAt: existing.deliveryStartedAt || nowIso,
        messengerTaskStatus: "Dalam Proses",
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo)!;

      dbAuditRepository.save({
        id: `log-delivery-start-${Date.now()}`,
        userId: messengerId,
        userName: messengerName,
        userRole: (user.role as any) || "messenger",
        action: "START_TASK",
        module: "Pengantaran Dokumen",
        details: `Kurir ${messengerName} memulai tugas pengantaran berkas order ${orderNo}`,
        metadata: { orderNo, taskType: "Pengantaran Dokumen" },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Completes Delivery Task (Scope B)
   */
  public completeDeliveryTask(
    orderNo: string,
    payload: { receiverName: string; photoUrl?: string; notes?: string; note?: string },
    user: TokenPayload
  ): OperationalOrder {
    const role = (user.role || "").toLowerCase();
    if (role === "messenger") {
      const pNote = (payload.notes || payload.note || "").trim();
      if (pNote.length > 0) {
        throw new ApiError(
          400,
          "MESSENGER_NOTES_NOT_ALLOWED",
          "Catatan operasional bebas (free-text notes) tidak diizinkan pada penyelesaian pengantaran berkas."
        );
      }
    }

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }
      if (existing.currentStep !== 7 && existing.currentStageName !== "Pengantaran") {
        throw new ApiError(400, "INVALID_STAGE", `Tugas pengantaran berkas hanya dapat diselesaikan pada Step 7 (Pengantaran).`);
      }

      const { messengerId, messengerName } = assertMessengerOwnership(existing, user, "DELIVERY");

      const cleanReceiver = (payload.receiverName || (payload as any).recipientName || "").trim();
      if (!cleanReceiver) {
        throw new ApiError(400, "RECIPIENT_REQUIRED", "Nama penerima dokumen wajib diisi sebelum menyelesaikan pengantaran.");
      }

      // Idempotency: If already completed, return existing
      if (existing.deliveryStatus === "Dokumen Diserahkan" && existing.isReceived) {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const timelineEvent: any = {
        id: `tl-delivery-done-${Date.now()}`,
        timestamp: nowIso,
        title: "Pengantaran Berkas Selesai",
        note: `Berkas telah diserahkan dan diterima oleh ${cleanReceiver}. Pengantaran selesai oleh kurir ${messengerName}`,
        author: messengerName,
        type: "STATUS_CHANGE",
      };

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        ["Pengantaran Dokumen"]: {
          status: "COMPLETED" as const,
          completedAt: nowIso,
          courierId: messengerId,
          courierName: messengerName,
          isLocked: true,
        },
      };

      const updates: Partial<OperationalOrder> = {
        deliveryStatus: "Dokumen Diserahkan",
        deliveryCompletedAt: existing.deliveryCompletedAt || nowIso,
        receiverName: cleanReceiver,
        tanggalDiterima: existing.tanggalDiterima || nowIso.split("T")[0],
        isReceived: true,
        deliveryProof: payload.photoUrl || existing.deliveryProof,
        taskAcceptance: updatedAcceptance,
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo)!;

      dbAuditRepository.save({
        id: `log-delivery-done-${Date.now()}`,
        userId: messengerId,
        userName: messengerName,
        userRole: (user.role as any) || "messenger",
        action: "COMPLETE_TASK",
        module: "Pengantaran Dokumen",
        details: `Kurir ${messengerName} menyelesaikan pengantaran berkas order ${orderNo} kepada ${cleanReceiver}`,
        metadata: { orderNo, taskType: "Pengantaran Dokumen", receiverName: cleanReceiver },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Releases Delivery Task back to Team Pool (Scope C Handover)
   */
  public releaseDeliveryTask(
    orderNo: string,
    user: TokenPayload,
    notes?: string
  ): OperationalOrder {
    const role = (user.role || "").toLowerCase();
    const cleanNotes = (notes || "").trim();
    if (role === "messenger" && cleanNotes.length > 0) {
      throw new ApiError(
        400,
        "MESSENGER_NOTES_NOT_ALLOWED",
        "Catatan operasional bebas (free-text notes) tidak diizinkan pada penyerahan tugas."
      );
    }

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }

      const { messengerId, messengerName } = assertMessengerOwnership(existing, user, "DELIVERY");

      const nowIso = new Date().toISOString();

      const timelineEvent: any = {
        id: `tl-delivery-release-${Date.now()}`,
        timestamp: nowIso,
        title: "Tugas Pengantaran Diserahkan ke Tim",
        note: `Tugas pengantaran dikembalikan ke pool antrean oleh kurir ${messengerName}.`,
        author: messengerName,
        type: "ASSIGNMENT",
      };

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        ["Pengantaran Dokumen"]: {
          status: "PENDING" as const,
          isLocked: false,
          releasedAt: nowIso,
          releasedBy: messengerName,
        },
      };

      const updates: Partial<OperationalOrder> = {
        messengerPengantar: undefined,
        deliveryMessengerId: undefined,
        deliveryStatus: undefined,
        taskAcceptance: updatedAcceptance,
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo)!;

      dbAuditRepository.save({
        id: `log-delivery-release-${Date.now()}`,
        userId: messengerId,
        userName: messengerName,
        userRole: (user.role as any) || "messenger",
        action: "RELEASE_TASK",
        module: "Pengantaran Dokumen",
        details: `Tugas pengantaran berkas order ${orderNo} diserahkan ke tim oleh ${messengerName}`,
        metadata: { orderNo, taskType: "Pengantaran Dokumen" },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * PHASE 4: Report Kendala on Jemput Hasil Samsat
   * - Authorized for assigned Messenger or Admin
   * - Sets structured status to "Terkendala"
   * - Strictly NO free-text order.catatanKendala pollution
   * - Idempotent
   */
  public reportSamsatPickupKendala(
    orderNo: string,
    user: TokenPayload,
    payload?: { note?: string; notes?: string; catatanKendala?: string }
  ): OperationalOrder {
    const role = (user.role || "").toLowerCase();
    if (role === "messenger" && payload) {
      const pNote = (payload.notes || payload.note || payload.catatanKendala || "").trim();
      if (pNote.length > 0) {
        throw new ApiError(
          400,
          "MESSENGER_NOTES_NOT_ALLOWED",
          "Catatan operasional bebas (free-text notes) tidak diizinkan pada pelaporan kendala jemput hasil."
        );
      }
    }

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }
      if (existing.currentStep !== 4 && existing.currentStageName !== "Proses Samsat") {
        throw new ApiError(400, "INVALID_STAGE", `Kendala penjemputan hasil Samsat hanya dapat dilaporkan pada Step 4 (Proses Samsat).`);
      }
      if (existing.samsatStatus !== "Selesai") {
        throw new ApiError(400, "SAMSAT_NOT_COMPLETED", `Proses pengurusan Samsat belum selesai.`);
      }

      const currentCycle = (existing as any).samsatCycle || 1;
      const pickupTaskAcc = (existing.taskAcceptance || {})["Jemput Hasil Samsat"];
      if (pickupTaskAcc?.status === "SUPERSEDED") {
        throw new ApiError(400, "TASK_SUPERSEDED", "Tugas Jemput Hasil Samsat ini sudah tidak berlaku (superseded) karena proses Samsat di-rollback.");
      }
      if (pickupTaskAcc?.cycle && pickupTaskAcc.cycle !== currentCycle) {
        throw new ApiError(400, "TASK_SUPERSEDED", `Tugas Jemput Hasil Samsat berasal dari cycle lama (Cycle ${pickupTaskAcc.cycle}), cycle aktif adalah Cycle ${currentCycle}.`);
      }

      if (existing.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor") {
        throw new ApiError(400, "INVALID_STATE", "Tugas penjemputan hasil Samsat sudah selesai diserahkan ke kantor.");
      }

      const { messengerId, messengerName } = assertMessengerOwnership(existing, user, "SAMSAT_PICKUP");

      // Idempotency: If already Terkendala, return existing without duplicate log
      if (existing.samsatPickupStatus === "Terkendala") {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const timelineEvent: any = {
        id: `tl-kendala-pickup-${Date.now()}`,
        timestamp: nowIso,
        title: "Kendala Jemput Hasil Samsat",
        note: "Kurir melaporkan kendala pada penjemputan berkas hasil Samsat. Menunggu instruksi atau recovery dari Admin/Supervisor.",
        author: messengerName,
        type: "STATUS_CHANGE",
      };

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        ["Jemput Hasil Samsat"]: {
          ...pickupTaskAcc,
          hasKendala: true,
          kendalaAt: nowIso,
          cycle: currentCycle,
        },
      };

      const updates: Partial<OperationalOrder> = {
        samsatPickupStatus: "Terkendala",
        taskAcceptance: updatedAcceptance,
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo)!;

      dbAuditRepository.save({
        id: `log-samsat-pickup-kendala-${Date.now()}`,
        userId: messengerId,
        userName: messengerName,
        userRole: (user.role as any) || "messenger",
        action: "SAMSAT_PICKUP_KENDALA",
        module: "Jemput Hasil Samsat",
        details: `Petugas ${messengerName} melaporkan kendala pada penjemputan berkas hasil Samsat order ${orderNo}`,
        metadata: { orderNo, cycle: currentCycle },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * PHASE 4: Recover Kendala on Jemput Hasil Samsat
   * - STRICTLY authorized for Admin / SVP role
   * - Messenger calling this receives HTTP 403 FORBIDDEN
   * - Restores samsatPickupStatus to "Sedang Jemput Dokumen Samsat"
   * - Preserves messenger assignment
   */
  public recoverSamsatPickupKendala(orderNo: string, user: TokenPayload): OperationalOrder {
    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      const role = (user.role || "").toLowerCase();
      const isAdmin = role === "administrator" || role === "admin" || role === "svp" || user.jabatan === "SVP";
      if (!isAdmin) {
        throw new ApiError(403, "FORBIDDEN", "Hanya Admin atau Supervisor yang berwenang memulihkan status Kendala Jemput Hasil.");
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }
      if (existing.currentStep !== 4 && existing.currentStageName !== "Proses Samsat") {
        throw new ApiError(400, "INVALID_STAGE", `Pemulihan kendala penjemputan hasil Samsat hanya dapat dilakukan pada Step 4 (Proses Samsat).`);
      }

      const adminName = user.nama || (user as any).userName || "Admin Operasional";
      const adminId = (user as any).employeeId || user.userId || "EMP-ADMIN";

      // Idempotency: If already back to Sedang Jemput, return existing
      if (existing.samsatPickupStatus === "Sedang Jemput Dokumen Samsat") {
        return existing;
      }
      if (existing.samsatPickupStatus !== "Terkendala") {
        throw new ApiError(400, "INVALID_STATE", `Order '${orderNo}' tidak dalam status Terkendala (status saat ini: '${existing.samsatPickupStatus || "Normal"}').`);
      }

      const nowIso = new Date().toISOString();
      const pickupTaskAcc = (existing.taskAcceptance || {})["Jemput Hasil Samsat"];

      const timelineEvent: any = {
        id: `tl-recover-pickup-${Date.now()}`,
        timestamp: nowIso,
        title: "Kendala Jemput Hasil Dipulihkan",
        note: "Status kendala penjemputan berkas hasil Samsat telah diselesaikan dan dipulihkan oleh Admin/Supervisor. Penjemputan dilanjutkan.",
        author: adminName,
        type: "STATUS_CHANGE",
      };

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        ["Jemput Hasil Samsat"]: {
          ...pickupTaskAcc,
          hasKendala: false,
          recoveredAt: nowIso,
          recoveredBy: adminName,
        },
      };

      const updates: Partial<OperationalOrder> = {
        samsatPickupStatus: "Sedang Jemput Dokumen Samsat",
        taskAcceptance: updatedAcceptance,
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo)!;

      dbAuditRepository.save({
        id: `log-samsat-pickup-recover-${Date.now()}`,
        userId: adminId,
        userName: adminName,
        userRole: (user.role as any) || "admin",
        action: "SAMSAT_PICKUP_RECOVERED",
        module: "Jemput Hasil Samsat",
        details: `Admin ${adminName} memulihkan kendala penjemputan berkas hasil Samsat order ${orderNo}`,
        metadata: { orderNo },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * PHASE 4: Complete Jemput Hasil Samsat (Dokumen Diserahkan ke Kantor)
   * - Handover berkas dari Samsat ke Kantor
   * - Validates cycle isolation and blocks if Terkendala
   * - Does NOT automatically advance to Step 5 (Verifikasi Biaya remains under Admin control)
   * - Idempotent
   */
  public completeSamsatPickupTask(
    orderNo: string,
    user: TokenPayload,
    payload?: { note?: string; notes?: string }
  ): OperationalOrder {
    const role = (user.role || "").toLowerCase();
    if (role === "messenger" && payload) {
      const pNote = (payload.notes || payload.note || "").trim();
      if (pNote.length > 0) {
        throw new ApiError(
          400,
          "MESSENGER_NOTES_NOT_ALLOWED",
          "Catatan operasional bebas (free-text notes) tidak diizinkan pada penyerahan hasil Samsat."
        );
      }
    }

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      if ((existing as any).isCancelled || existing.currentStageName === "Dibatalkan" || (existing as any).status === "Dibatalkan") {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${orderNo}' sudah dibatalkan.`);
      }
      if (existing.currentStep !== 4 && existing.currentStageName !== "Proses Samsat") {
        throw new ApiError(400, "INVALID_STAGE", `Penyerahan hasil Samsat hanya dapat dilakukan pada Step 4 (Proses Samsat).`);
      }
      if (existing.samsatStatus !== "Selesai") {
        throw new ApiError(400, "SAMSAT_NOT_COMPLETED", `Proses pengurusan Samsat belum selesai.`);
      }

      const currentCycle = (existing as any).samsatCycle || 1;
      const pickupTaskAcc = (existing.taskAcceptance || {})["Jemput Hasil Samsat"];
      if (pickupTaskAcc?.status === "SUPERSEDED") {
        throw new ApiError(400, "TASK_SUPERSEDED", "Tugas Jemput Hasil Samsat ini sudah tidak berlaku (superseded) karena proses Samsat di-rollback.");
      }
      if (pickupTaskAcc?.cycle && pickupTaskAcc.cycle !== currentCycle) {
        throw new ApiError(400, "TASK_SUPERSEDED", `Tugas Jemput Hasil Samsat berasal dari cycle lama (Cycle ${pickupTaskAcc.cycle}), cycle aktif adalah Cycle ${currentCycle}.`);
      }

      if (existing.samsatPickupStatus === "Terkendala") {
        throw new ApiError(400, "TASK_TERKENDALA", "Tugas masih dalam kondisi Terkendala. Harap selesaikan kendala melalui Admin sebelum menyerahkan dokumen.");
      }

      const { messengerId, messengerName } = assertMessengerOwnership(existing, user, "SAMSAT_PICKUP");

      // Idempotency: If already completed, return existing
      if (existing.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor") {
        return existing;
      }

      const nowIso = new Date().toISOString();
      const timelineEvent: any = {
        id: `tl-pickup-done-office-${Date.now()}`,
        timestamp: nowIso,
        title: "Dokumen Hasil Samsat Diterima di Kantor",
        note: `Berkas hasil proses Samsat telah diserahkan oleh kurir ${messengerName} dan diterima di kantor.`,
        author: messengerName,
        type: "STATUS_CHANGE",
      };

      const updatedAcceptance = {
        ...(existing.taskAcceptance || {}),
        ["Jemput Hasil Samsat"]: {
          ...pickupTaskAcc,
          status: "COMPLETED" as const,
          completedAt: nowIso,
          completedBy: messengerName,
          completedById: messengerId,
          courierId: messengerId,
          courierName: messengerName,
          isLocked: true,
          cycle: currentCycle,
        },
      };

      const updates: Partial<OperationalOrder> = {
        samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
        samsatPickupCompletedAt: existing.samsatPickupCompletedAt || nowIso,
        taskAcceptance: updatedAcceptance,
        messengerTimeline: [timelineEvent, ...(existing.messengerTimeline || [])],
      };

      dbOrderRepository.updateOrder(orderNo, updates);
      const updated = this.getByOrderNo(orderNo)!;

      dbAuditRepository.save({
        id: `log-samsat-pickup-complete-${Date.now()}`,
        userId: messengerId,
        userName: messengerName,
        userRole: (user.role as any) || "messenger",
        action: "COMPLETE_TASK",
        module: "Jemput Hasil Samsat",
        details: `Petugas ${messengerName} menyerahkan berkas hasil proses Samsat order ${orderNo} ke kantor`,
        metadata: { orderNo, cycle: currentCycle },
        createdAt: nowIso,
      });

      return updated;
    });
  }

  /**
   * Dedicated Cost Verification Endpoint (Phase 2 & Phase 3)
   * Strictly authorized for Administrator / Admin / SVP.
   * Client cannot tamper with protected fields (costVerifiedBy, isCostVerified).
   * Validates consistency between component breakdown and final total.
   * Preserves costSnapshot immutability.
   * Updates order cost completeness and marks invoice verified.
   */
  public verifyOrderCost(
    orderNo: string,
    payload: { finalBiayaSamsat: number; finalTotalBiaya?: number; notes?: string; [key: string]: any },
    user?: TokenPayload | any
  ): OperationalOrder {
    if (
      payload.costVerifiedBy !== undefined ||
      payload.isCostVerified !== undefined ||
      (payload as any).costCompletenessStatus !== undefined
    ) {
      throw new ApiError(403, "FORBIDDEN_PROPERTY", "Field costVerifiedBy cannot be modified via client request.");
    }

    const role = (user?.role || "").toLowerCase();
    const isAuthorized = role === "administrator" || role === "admin" || role === "svp" || user?.jabatan === "SVP";
    if (!isAuthorized) {
      throw new ApiError(403, "FORBIDDEN", "Hanya Administrator atau Supervisor yang berwenang memverifikasi biaya order.");
    }

    if (payload.finalBiayaSamsat === undefined || typeof payload.finalBiayaSamsat !== "number" || payload.finalBiayaSamsat < 0) {
      throw new ApiError(400, "INVALID_COST_PAYLOAD", "Biaya Samsat final wajib berupa angka non-negatif.");
    }

    if (payload.notes !== undefined && typeof payload.notes !== "string") {
      throw new ApiError(400, "INVALID_NOTES", "Catatan verifikasi biaya harus berupa teks.");
    }

    return runInTransaction(() => {
      const existing = this.getByOrderNo(orderNo);
      if (!existing) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${orderNo}' tidak ditemukan.`);
      }

      const expectedTotal = (existing.biayaJasa || 0) + (existing.biayaAntarJemput || 0) + payload.finalBiayaSamsat;
      if (payload.finalTotalBiaya !== undefined && payload.finalTotalBiaya !== expectedTotal) {
        throw new ApiError(400, "INCONSISTENT_COST_PAYLOAD", `Total biaya ${payload.finalTotalBiaya} tidak konsisten dengan komponen biaya (${expectedTotal}).`);
      }

      const updatedTotalBiaya = payload.finalTotalBiaya !== undefined ? payload.finalTotalBiaya : expectedTotal;
      const existingPayment = existing.payment || {
        totalBiaya: 0,
        dibayar: 0,
        kurang: 0,
        statusPembayaran: "Belum Lunas" as const,
        tipePembayaran: "Bayar di Akhir" as const,
        metodePembayaran: "Cash",
      };
      const currentDibayar = Number(existingPayment.dibayar || 0);
      const kurang = Math.max(0, updatedTotalBiaya - currentDibayar);
      const statusPembayaran = currentDibayar >= updatedTotalBiaya && updatedTotalBiaya > 0
        ? "Lunas"
        : currentDibayar > 0
        ? "Kurang Bayar"
        : "Belum Lunas";

      const verifierName = user?.nama || (user as any)?.userName || "Admin";
      const nowIso = new Date().toISOString();

      const updates: Partial<OperationalOrder> = {
        isCostVerified: true,
        costCompletenessStatus: "VERIFIED",
        costVerifiedAt: nowIso,
        costVerifiedBy: verifierName,
        biayaSamsat: payload.finalBiayaSamsat,
        finalCost: updatedTotalBiaya,
        totalEstimasi: updatedTotalBiaya,
        payment: {
          ...existingPayment,
          totalBiaya: updatedTotalBiaya,
          kurang,
          statusPembayaran: statusPembayaran as any,
        } as any,
      };

      const isCostAnomaly = updatedTotalBiaya > 0 && payload.finalBiayaSamsat > updatedTotalBiaya;
      if (isCostAnomaly) {
        updates.isFinancialAnomaly = true;
        updates.financialAnomalyReason = "BIAYA_SAMSAT_MELEBIHI_TAGIHAN";
      } else {
        updates.isFinancialAnomaly = false;
        updates.financialAnomalyReason = undefined;
      }

      dbOrderRepository.updateOrder(orderNo, updates);

      const existingInvoice = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
      if (existingInvoice) {
        const invDibayar = Number(existingInvoice.dibayar || 0);
        const invSisa = Math.max(0, updatedTotalBiaya - invDibayar);
        const invStatus = invDibayar >= updatedTotalBiaya && updatedTotalBiaya > 0 ? "PAID" : invDibayar > 0 ? "PARTIAL" : "UNPAID";
        dbFinanceRepository.saveInvoice({
          ...existingInvoice,
          totalTagihan: updatedTotalBiaya,
          biayaSamsat: payload.finalBiayaSamsat,
          sisa: invSisa,
          status: invStatus,
          costVerificationStatus: "VERIFIED",
          isDraftEstimate: false,
          invoiceNo: existingInvoice.invoiceNo,
          orderNo: existingInvoice.orderNo,
        } as any);
      }

      dbAuditRepository.save({
        id: `log-verify-cost-${Date.now()}`,
        userId: user?.userId || "usr-admin",
        userName: verifierName,
        userRole: (user?.role as any) || "administrator",
        action: "VERIFY_ORDER_COST",
        module: "Finance",
        details: `Biaya order ${orderNo} diverifikasi oleh ${verifierName}. Total: ${updatedTotalBiaya}`,
        metadata: { orderNo, finalBiayaSamsat: payload.finalBiayaSamsat, finalTotalBiaya: updatedTotalBiaya, notes: payload.notes },
        createdAt: nowIso,
      });

      return this.getByOrderNo(orderNo)!;
    });
  }

  public getStatusHistory(orderNo: string) {
    return dbOrderRepository.getStatusHistoryByOrderNo(orderNo);
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
