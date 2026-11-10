/**
 * Public Customer API Controller
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides public endpoints for the Customer Website:
 * 1. Master Data (Services, Samsat Offices, Safe Pricing Estimates)
 * 2. Customer Order Creation (Idempotent, Anti-Tampering, File Upload)
 * 3. Customer Order Tracking (Nopol Search & Detail Timeline)
 */

import { Request, Response, NextFunction } from "express";
import { db, runInTransaction } from "../database/db";
import { serviceRepository } from "../repositories/dbServiceRepository";
import { dbWilayahRepository } from "../repositories/dbWilayahRepository";
import { dbPricingRepository, SERVICE_CANONICAL_BASELINES } from "../repositories/dbPricingRepository";
import { dbDocumentRepository } from "../repositories/dbDocumentRepository";
import { orderService } from "../services/orderService";
import { documentService } from "../services/documentService";
import { validateUploadedDocument } from "../utils/fileValidation";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../utils/crypto";

// ─────────────────────────────────────────────────────────────────────────────
// 1. PUBLIC MASTER DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/public/services
 * Returns list of active services available for customer ordering.
 */
export async function getPublicServices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const activeServices = serviceRepository.getActive();

    const data = activeServices.map((s) => ({
      serviceId: s.id,
      serviceName: s.nama_layanan,
      kodeLayanan: s.kode_layanan,
      kategori: s.kategori,
      memerlukanSamsatTujuan: Boolean(s.memerlukan_samsat_tujuan),
      deskripsi: s.deskripsi || "",
      persyaratan: s.requirements || [],
    }));

    res.status(200).json({
      success: true,
      message: "Daftar layanan aktif berhasil diambil.",
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/public/samsat
 * Returns canonical active Samsat offices for selection.
 */
export async function getPublicSamsatOffices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
    const provinsi = typeof req.query.provinsi === "string" ? req.query.provinsi.trim().toLowerCase() : "";

    const allOffices = dbWilayahRepository.getAllSamsatOffices();
    const activeOffices = allOffices.filter((o) => o.status_aktif === true);

    let filtered = activeOffices;
    if (provinsi) {
      filtered = filtered.filter((o) => (o.nama_provinsi || "").toLowerCase().includes(provinsi));
    }
    if (search) {
      filtered = filtered.filter(
        (o) =>
          o.name.toLowerCase().includes(search) ||
          o.wilayah.toLowerCase().includes(search) ||
          (o.nama_kabupaten_kota || "").toLowerCase().includes(search) ||
          (o.nama_provinsi || "").toLowerCase().includes(search)
      );
    }

    const data = filtered.map((o) => ({
      samsatId: o.id,
      namaSamsat: o.name,
      wilayah: o.wilayah,
      alamat: o.alamat || "",
      kabupatenKota: o.nama_kabupaten_kota || "",
      provinsi: o.nama_provinsi || "",
    }));

    res.status(200).json({
      success: true,
      message: "Daftar kantor Samsat resmi berhasil diambil.",
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/public/pricing
 * Returns safe price estimates without exposing internal margins or sensitive finance metrics.
 */
export async function getPublicPricingEstimate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const serviceIdQuery = typeof req.query.serviceId === "string" ? req.query.serviceId.trim() : "";
    const samsatIdQuery = typeof req.query.samsatId === "string" ? req.query.samsatId.trim() : "";
    const metodeLayanan = typeof req.query.metodeLayanan === "string" && req.query.metodeLayanan.trim() === "Datang Langsung"
      ? "Datang Langsung"
      : "Antar Jemput";

    // 1. If specific service requested
    if (serviceIdQuery) {
      let masterService = serviceRepository.getById(serviceIdQuery);
      if (!masterService) {
        masterService = serviceRepository.getByKode(serviceIdQuery);
      }
      if (!masterService || masterService.status_aktif !== 1) {
        throw new ApiError(404, "SERVICE_NOT_FOUND", `Layanan '${serviceIdQuery}' tidak ditemukan atau sedang tidak aktif.`);
      }

      const baseline = SERVICE_CANONICAL_BASELINES[masterService.id] ||
        SERVICE_CANONICAL_BASELINES[masterService.kode_layanan] ||
        SERVICE_CANONICAL_BASELINES[masterService.nama_layanan] ||
        { jasa: 250000, kurir: 50000 };

      let biayaJasa = baseline.jasa;
      let biayaAntarJemput = metodeLayanan === "Datang Langsung" ? 0 : baseline.kurir;
      let samsatOfficeName: string | null = null;

      if (samsatIdQuery) {
        const office = dbWilayahRepository.getSamsatOfficeById(samsatIdQuery);
        if (!office || !office.status_aktif) {
          throw new ApiError(400, "VALIDATION_ERROR", `Kantor Samsat dengan ID '${samsatIdQuery}' tidak ditemukan atau sedang tidak aktif.`);
        }
        samsatOfficeName = office.name;
        const config = dbPricingRepository.getServicePricingById(`${masterService.id}:${office.id}`);
        if (config && config.biayaJasa !== undefined && !isNaN(Number(config.biayaJasa))) {
          biayaJasa = Number(config.biayaJasa);
        }
        if (config && config.biayaAntarJemput !== undefined && !isNaN(Number(config.biayaAntarJemput)) && metodeLayanan !== "Datang Langsung") {
          biayaAntarJemput = Number(config.biayaAntarJemput);
        }
      }

      res.status(200).json({
        success: true,
        message: "Estimasi biaya layanan berhasil diambil.",
        data: {
          serviceId: masterService.id,
          serviceName: masterService.nama_layanan,
          samsatId: samsatIdQuery || null,
          namaSamsat: samsatOfficeName,
          metodeLayanan,
          estimasiBiayaJasa: biayaJasa,
          estimasiBiayaAntarJemput: biayaAntarJemput,
          totalEstimasiAwal: biayaJasa + biayaAntarJemput,
          catatan: "Estimasi biaya jasa belum termasuk Pajak Kendaraan Bermotor (PKB), SWDKLLJ, dan denda resmi Samsat yang tertera pada notice pajak.",
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 2. If no specific service requested, return baseline catalog for all active services
    const activeServices = serviceRepository.getActive();
    const catalog = activeServices.map((s) => {
      const baseline = SERVICE_CANONICAL_BASELINES[s.id] ||
        SERVICE_CANONICAL_BASELINES[s.kode_layanan] ||
        SERVICE_CANONICAL_BASELINES[s.nama_layanan] ||
        { jasa: 250000, kurir: 50000 };
      return {
        serviceId: s.id,
        serviceName: s.nama_layanan,
        kategori: s.kategori,
        estimasiBiayaJasa: baseline.jasa,
        estimasiBiayaAntarJemput: baseline.kurir,
        totalEstimasiAwal: baseline.jasa + baseline.kurir,
      };
    });

    res.status(200).json({
      success: true,
      message: "Katalog estimasi biaya standar layanan berhasil diambil.",
      data: {
        services: catalog,
        catatan: "Estimasi biaya jasa belum termasuk Pajak Kendaraan Bermotor (PKB), SWDKLLJ, dan denda resmi Samsat yang tertera pada notice pajak.",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PUBLIC ORDER CREATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/public/orders
 * Creates a new customer order from Customer Website with business logic integration,
 * server-side price enforcement, idempotency, and document upload handling.
 */
export async function createPublicOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  const uploadedDocIds: string[] = [];

  try {
    const rawBody = req.body || {};

    // 1. Validate customer name
    const customer = typeof rawBody.customer === "string" ? rawBody.customer.trim() : "";
    if (!customer || customer.length < 3 || customer.length > 100) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nama pemesan (customer) wajib diisi dengan panjang antara 3 hingga 100 karakter.");
    }

    // 2. Validate & normalize phone / WhatsApp
    const rawHP = typeof rawBody.nomorHP === "string" ? rawBody.nomorHP.trim() : (typeof rawBody.nomor_hp === "string" ? rawBody.nomor_hp.trim() : "");
    if (!rawHP) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nomor WhatsApp (nomorHP) pemesan wajib diisi.");
    }
    // Normalize phone number (strip whitespace, dashes, leading +62 to 08)
    let cleanHP = rawHP.replace(/[\s\-]/g, "");
    if (cleanHP.startsWith("+62")) {
      cleanHP = "0" + cleanHP.substring(3);
    } else if (cleanHP.startsWith("62")) {
      cleanHP = "0" + cleanHP.substring(2);
    }
    if (!/^08\d{7,13}$/.test(cleanHP)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nomor WhatsApp tidak valid. Gunakan format nomor ponsel Indonesia (contoh: 08123456789).");
    }

    // 3. Validate license plate (nopol)
    const rawNopol = typeof rawBody.nopol === "string" ? rawBody.nopol.trim() : "";
    if (!rawNopol) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nomor polisi kendaraan (nopol) wajib diisi.");
    }
    const cleanNopol = rawNopol.toUpperCase().replace(/\s+/g, " ");
    const nopolRegex = /^[A-Z]{1,2}\s?[0-9]{1,4}\s?[A-Z]{1,3}$/;
    if (!nopolRegex.test(cleanNopol)) {
      throw new ApiError(400, "VALIDATION_ERROR", `Format nomor polisi '${rawNopol}' tidak valid (contoh format: B 1234 ABC).`);
    }

    // 4. Validate Service (must be active in master data)
    const rawServiceId = typeof rawBody.serviceId === "string" ? rawBody.serviceId.trim() : (typeof rawBody.service_id === "string" ? rawBody.service_id.trim() : "");
    const rawLayanan = typeof rawBody.layanan === "string" ? rawBody.layanan.trim() : "";

    if (!rawServiceId && !rawLayanan) {
      throw new ApiError(400, "VALIDATION_ERROR", "Layanan yang dipesan wajib dipilih.");
    }

    let masterService = rawServiceId ? serviceRepository.getById(rawServiceId) : undefined;
    if (!masterService && rawServiceId) {
      masterService = serviceRepository.getByKode(rawServiceId);
    }
    if (!masterService && rawLayanan) {
      masterService = serviceRepository.getByKode(rawLayanan) ||
        serviceRepository.getAll().find((s) => s.nama_layanan.toLowerCase() === rawLayanan.toLowerCase());
    }

    if (!masterService) {
      throw new ApiError(400, "INVALID_SERVICE", `Layanan '${rawServiceId || rawLayanan}' tidak ditemukan dalam master data.`);
    }
    if (masterService.status_aktif !== 1) {
      throw new ApiError(400, "SERVICE_INACTIVE", `Layanan '${masterService.nama_layanan}' sedang nonaktif dan tidak dapat dipesan.`);
    }

    // 5. Validate Samsat Asal (must exist & be active)
    const rawSamsatAsalId = typeof rawBody.samsatAsalId === "string" ? rawBody.samsatAsalId.trim() : (typeof rawBody.samsat_asal_id === "string" ? rawBody.samsat_asal_id.trim() : "");
    const rawWilayahAsal = typeof rawBody.wilayahSamsatAsal === "string" ? rawBody.wilayahSamsatAsal.trim() : (typeof rawBody.samsat_asal === "string" ? rawBody.samsat_asal.trim() : "");

    let officeAsal = rawSamsatAsalId ? dbWilayahRepository.getSamsatOfficeById(rawSamsatAsalId) : undefined;
    if (!officeAsal && rawWilayahAsal) {
      const allOffices = dbWilayahRepository.getAllSamsatOffices();
      officeAsal = allOffices.find(
        (o) => o.wilayah.toLowerCase() === rawWilayahAsal.toLowerCase() || o.name.toLowerCase() === rawWilayahAsal.toLowerCase()
      );
    }

    if (!officeAsal) {
      throw new ApiError(400, "INVALID_SAMSAT", "Samsat Asal wajib dipilih dari daftar kantor Samsat resmi yang tersedia.");
    }
    if (!officeAsal.status_aktif) {
      throw new ApiError(400, "SAMSAT_INACTIVE", `Samsat Asal '${officeAsal.name}' saat ini sedang nonaktif.`);
    }

    // 6. Validate Samsat Tujuan if required by service
    const requiresSamsatTujuan = masterService.memerlukan_samsat_tujuan === 1 || masterService.nama_layanan.toLowerCase().includes("mutasi");
    let officeTujuan: any = null;

    if (requiresSamsatTujuan) {
      const rawSamsatTujuanId = typeof rawBody.samsatTujuanId === "string" ? rawBody.samsatTujuanId.trim() : (typeof rawBody.samsat_tujuan_id === "string" ? rawBody.samsat_tujuan_id.trim() : "");
      const rawWilayahTujuan = typeof rawBody.wilayahSamsatTujuan === "string" ? rawBody.wilayahSamsatTujuan.trim() : (typeof rawBody.samsat_tujuan === "string" ? rawBody.samsat_tujuan.trim() : "");

      if (rawSamsatTujuanId && rawSamsatTujuanId !== "-") {
        officeTujuan = dbWilayahRepository.getSamsatOfficeById(rawSamsatTujuanId);
      } else if (rawWilayahTujuan && rawWilayahTujuan !== "-") {
        const allOffices = dbWilayahRepository.getAllSamsatOffices();
        officeTujuan = allOffices.find(
          (o) => o.wilayah.toLowerCase() === rawWilayahTujuan.toLowerCase() || o.name.toLowerCase() === rawWilayahTujuan.toLowerCase()
        );
      }

      if (!officeTujuan) {
        throw new ApiError(400, "VALIDATION_ERROR", `Layanan '${masterService.nama_layanan}' memerlukan Samsat Tujuan yang valid.`);
      }
      if (!officeTujuan.status_aktif) {
        throw new ApiError(400, "SAMSAT_INACTIVE", `Samsat Tujuan '${officeTujuan.name}' saat ini sedang nonaktif.`);
      }
    }

    // 7. Vehicle Type & Service Delivery Method
    const tipeKendaraan = rawBody.tipeKendaraan === "Motor" ? "Motor" : "Mobil";
    const metodeLayanan = rawBody.metodeLayanan === "Datang Langsung" ? "Datang Langsung" : "Antar Jemput";

    // 8. Canonical Server-Side Price Resolution (Anti-Tampering)
    const baseline = SERVICE_CANONICAL_BASELINES[masterService.id] ||
      SERVICE_CANONICAL_BASELINES[masterService.kode_layanan] ||
      SERVICE_CANONICAL_BASELINES[masterService.nama_layanan] ||
      { jasa: 250000, kurir: 50000 };

    let resolvedBiayaJasa = baseline.jasa;
    let resolvedBiayaAntarJemput = metodeLayanan === "Datang Langsung" ? 0 : baseline.kurir;

    if (officeAsal) {
      const config = dbPricingRepository.getServicePricingById(`${masterService.id}:${officeAsal.id}`);
      if (config && config.biayaJasa !== undefined && !isNaN(Number(config.biayaJasa))) {
        resolvedBiayaJasa = Number(config.biayaJasa);
      }
      if (config && config.biayaAntarJemput !== undefined && !isNaN(Number(config.biayaAntarJemput)) && metodeLayanan !== "Datang Langsung") {
        resolvedBiayaAntarJemput = Number(config.biayaAntarJemput);
      }
    }

    const totalBiayaAwal = resolvedBiayaJasa + resolvedBiayaAntarJemput;

    // 9. Process and Stage Document Uploads (Controlled Finalization Pattern - PUB-03)
    const reqFiles = (req as any).files as Express.Multer.File[] | undefined;
    const validatedFiles: Array<{ buffer: Buffer; originalName: string; mimeType: string }> = [];

    if (Array.isArray(reqFiles) && reqFiles.length > 0) {
      for (const file of reqFiles) {
        const val = validateUploadedDocument(file.buffer, file.originalname, file.mimetype);
        validatedFiles.push({
          buffer: file.buffer,
          originalName: val.sanitizedOriginalName,
          mimeType: val.mimeType,
        });
      }
    }

    const publicSystemUser: TokenPayload = {
      id: "usr-public-web",
      userId: "usr-public-web",
      email: rawBody.email ? String(rawBody.email).trim() : "customer@sunbirojasa.com",
      nama: "Customer Public API",
      jabatan: "Customer",
      role: "customer" as any,
      exp: Math.floor(Date.now() / 1000) + 86400,
    };

    // Stage files to storage BEFORE creating order/invoice transactions (PUB-03)
    const stagedDocIds: string[] = [];
    if (validatedFiles.length > 0) {
      try {
        for (const f of validatedFiles) {
          const doc = await documentService.uploadDocument({
            buffer: f.buffer,
            originalName: f.originalName,
            reportedMime: f.mimeType,
            documentType: "DOKUMEN_PERSYARATAN",
            user: publicSystemUser,
          });
          stagedDocIds.push(doc.id);
        }
      } catch (uploadErr) {
        console.error("[PublicController] Storage staging error during public order document upload:", uploadErr);
        // Compensating cleanup of staged files
        for (const docId of stagedDocIds) {
          try {
            dbDocumentRepository.softDelete(docId);
          } catch {}
        }
        throw new ApiError(500, "DOCUMENT_STORAGE_FAILED", "Gagal menyimpan berkas dokumen persyaratan ke sistem penyimpanan.");
      }
    }

    // 10. Assemble Protected Order Payload
    const idempotencyKey = (
      req.headers["x-idempotency-key"] ||
      rawBody.clientRequestId ||
      rawBody.idempotencyKey ||
      ""
    ).toString().trim();

    const orderPayload = {
      customer,
      nomorHP: cleanHP,
      layanan: masterService.nama_layanan,
      serviceId: masterService.id,
      nopol: cleanNopol,
      jenisKendaraan: tipeKendaraan,
      tipeKendaraan,
      metodeLayanan,
      wilayahSamsatAsal: officeAsal.wilayah,
      samsatAsalId: officeAsal.id,
      wilayahSamsatTujuan: officeTujuan ? officeTujuan.wilayah : "-",
      samsatTujuanId: officeTujuan ? officeTujuan.id : "-",
      channel_order: "CUSTOMER_WEB",
      clientRequestId: idempotencyKey || undefined,
      biayaJasa: resolvedBiayaJasa,
      biayaAntarJemput: resolvedBiayaAntarJemput,
      totalEstimasi: totalBiayaAwal,
      alamatPenjemputan: {
        kota: officeAsal.wilayah,
        kecamatan: "",
        kelurahan: "",
        detail: typeof rawBody.alamatPenjemputan === "string" ? rawBody.alamatPenjemputan.trim() : (metodeLayanan === "Datang Langsung" ? "Datang Langsung ke Kantor" : "Menunggu konfirmasi alamat"),
        rtRw: "",
        nomor: "",
        landmark: "",
      },
      catatanOrder: typeof rawBody.catatan === "string" ? rawBody.catatan.slice(0, 500) : "Order dibuat dari Customer Website SUNBiroJasa.",
      payment: {
        tipePembayaran: "Bayar di Akhir",
        metodePembayaran: "Transfer Bank",
        totalBiaya: totalBiayaAwal,
        dibayar: 0,
        kurang: totalBiayaAwal,
        statusPembayaran: "Belum Lunas",
        isPaymentVerified: false,
      },
    };

    // 11. Create Order through Canonical Order Service (PUB-03 Atomic Finalization)
    let result: { order: any; isExisting: boolean };
    try {
      result = orderService.createOrderWithIdempotency(orderPayload, publicSystemUser, idempotencyKey);
    } catch (createErr) {
      // If order creation itself fails, clean up staged documents to prevent orphans
      for (const docId of stagedDocIds) {
        try {
          dbDocumentRepository.softDelete(docId);
        } catch {}
      }
      throw createErr;
    }

    const order = result.order;

    // 12. Finalize Document Relations (PUB-03 & PUB-04)
    if (result.isExisting) {
      // Duplicate idempotency call: clean up redundant staged documents so no orphans are created
      for (const docId of stagedDocIds) {
        try {
          dbDocumentRepository.softDelete(docId);
        } catch {}
      }
    } else if (stagedDocIds.length > 0) {
      try {
        runInTransaction(() => {
          for (const docId of stagedDocIds) {
            dbDocumentRepository.linkOrder(docId, order.orderNo);
          }
        });
      } catch (linkErr) {
        console.error(`[PublicController] Error linking staged documents to order ${order.orderNo}:`, linkErr);
      }
    }

    // Count currently attached documents for this order
    const attachedDocs = dbDocumentRepository.findByOrderNo(order.orderNo);
    const documentsAttached = attachedDocs.length;

    // 13. Return Sanitized Public Confirmation Response
    res.status(201).json({
      success: true,
      message: result.isExisting ? "Order telah terdaftar sebelumnya (Idempotent)." : "Order berhasil dibuat.",
      data: {
        orderNo: order.orderNo,
        noInvoice: order.noInvoice,
        customer: order.customer,
        nomorHP: order.nomorHP,
        layanan: order.layanan,
        nopol: order.nopol,
        tipeKendaraan: order.jenisKendaraan || tipeKendaraan,
        samsatAsal: order.wilayahSamsatAsal,
        samsatTujuan: order.wilayahSamsatTujuan,
        metodeLayanan: order.metodeLayanan,
        currentStageName: order.currentStageName,
        currentStep: order.currentStep,
        estimasiBiayaJasa: resolvedBiayaJasa,
        estimasiBiayaAntarJemput: resolvedBiayaAntarJemput,
        totalEstimasiAwal: totalBiayaAwal,
        paymentStatus: order.payment?.statusPembayaran || "Belum Lunas",
        documentsAttached,
        createdAt: order.createdAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CANONICAL STAGE TRANSLATOR (PUB-01)
// ─────────────────────────────────────────────────────────────────────────────

export interface PublicTimelineItem {
  step: number;
  stageName: string;
  label: string;
  status: "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  waktuSelesai: string | null;
}

export interface PublicWorkflowPresentation {
  statusPengerjaan: "Diproses" | "Selesai" | "Dibatalkan";
  publicStageName: string;
  isCompleted: boolean;
  isCancelled: boolean;
  timeline: PublicTimelineItem[];
}

/**
 * Canonical Semantic Stage Translator (PUB-01)
 * Maps SUNBiroJasa 8 internal stages to canonical customer public presentation.
 */
export function mapInternalStageToPublicWorkflow(
  order: {
    currentStep?: number;
    currentStageName?: string;
    isCancelled?: boolean;
    isArchived?: boolean | number;
    metodeLayanan?: string;
    createdAt?: string;
  },
  historyRows: Array<{
    step_sebelumnya: number;
    step_baru: number;
    stage_name: string;
    waktu_transisi: string;
  }> = []
): PublicWorkflowPresentation {
  const currentStep = Number(order.currentStep || 1);
  const currentStageName = order.currentStageName || "";
  const isCancelled = currentStageName === "Dibatalkan" || order.isCancelled === true;
  const isDatangLangsung = order.metodeLayanan === "Datang Langsung";

  // Check completion: strictly canonical completed conditions (Step 8 / Dokumen Telah Diterima / Selesai / Archived)
  const isCompleted =
    !isCancelled &&
    (currentStep === 8 ||
      currentStageName === "Dokumen Telah Diterima" ||
      currentStageName === "Selesai" ||
      Boolean(order.isArchived) === true);

  // Determine overall status
  let statusPengerjaan: "Diproses" | "Selesai" | "Dibatalkan" = "Diproses";
  if (isCancelled) {
    statusPengerjaan = "Dibatalkan";
  } else if (isCompleted) {
    statusPengerjaan = "Selesai";
  }

  // Determine public stage presentation description according to the required baseline
  let publicStageName = "Dalam Proses";
  if (isCancelled) {
    publicStageName = "Order Dibatalkan";
  } else if (isCompleted) {
    publicStageName = "Selesai";
  } else {
    switch (currentStep) {
      case 1:
        publicStageName = "Verifikasi";
        break;
      case 2:
        publicStageName = isDatangLangsung ? "Penyerahan Berkas di Loket" : "Penjadwalan";
        break;
      case 3:
        publicStageName = "Verifikasi Dokumen";
        break;
      case 4:
        publicStageName = "Proses Samsat";
        break;
      case 5:
        // Explicit requirement: Step 5 must NOT show as delivery or completed
        publicStageName = "Proses Samsat selesai, pemeriksaan ulang di kantor";
        break;
      case 6:
        // Explicit requirement: Step 6 must NOT show as completed or delivery
        publicStageName = "Menunggu persetujuan supervisi di kantor";
        break;
      case 7:
        // Explicit requirement: Step 7 shows delivery in progress, NOT completed
        publicStageName = "Pengantaran sedang berlangsung";
        break;
      case 8:
        publicStageName = "Selesai";
        break;
      default:
        // Fallback for legacy stage names if currentStep is not 1-8
        if (currentStageName === "Verifikasi") publicStageName = "Verifikasi";
        else if (currentStageName === "Penjadwalan") publicStageName = "Penjadwalan";
        else if (currentStageName === "Verifikasi Dokumen") publicStageName = "Verifikasi Dokumen";
        else if (currentStageName === "Proses Samsat") publicStageName = "Proses Samsat";
        else if (currentStageName === "Verifikasi Ulang") publicStageName = "Proses Samsat selesai, pemeriksaan ulang di kantor";
        else if (currentStageName === "Supervisi") publicStageName = "Menunggu persetujuan supervisi di kantor";
        else if (currentStageName === "Pengantaran") publicStageName = "Pengantaran sedang berlangsung";
        else if (currentStageName === "Dokumen Telah Diterima") publicStageName = "Selesai";
        else publicStageName = "Dalam Proses";
        break;
    }
  }

  // Standard 6 milestones for Customer Tracking Timeline
  const PUBLIC_WORKFLOW_MILESTONES = [
    { step: 1, stageName: "Verifikasi", label: "Verifikasi Order" },
    { step: 2, stageName: "Penjadwalan", label: isDatangLangsung ? "Penyerahan Berkas di Loket" : "Penjemputan Berkas" },
    { step: 3, stageName: "Verifikasi Dokumen", label: "Pemeriksaan Dokumen Fisik" },
    { step: 4, stageName: "Proses Samsat", label: "Pengurusan Loket Samsat" },
    { step: 5, stageName: "Pengantaran", label: "Pengantaran Dokumen Selesai" },
    { step: 6, stageName: "Dokumen Telah Diterima", label: "Order Selesai" },
  ];

  // Map transition timestamps from history (strictly non-synthetic)
  const h1 = historyRows.find((h) => h.step_baru === 2 || (isDatangLangsung && h.step_baru === 3) || h.step_sebelumnya === 1);
  const h2 = historyRows.find((h) => h.step_baru === 3 || h.step_sebelumnya === 2);
  const h3 = historyRows.find((h) => h.step_baru === 4 || h.step_sebelumnya === 3);
  const h4 = historyRows.find((h) => h.step_baru >= 5 || h.step_sebelumnya === 4);
  const h5 = historyRows.find((h) => h.step_baru === 8 || (h.step_sebelumnya === 7 && h.step_baru === 8));
  const h6 = historyRows.find((h) => h.step_baru === 8 || h.stage_name === "Dokumen Telah Diterima" || h.stage_name === "Selesai");

  const timeline: PublicTimelineItem[] = PUBLIC_WORKFLOW_MILESTONES.map((wf) => {
    let stageStatus: "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" = "WAITING";
    let waktuSelesai: string | null = null;

    if (isCancelled) {
      if (wf.step === 1 && currentStep > 1) {
        stageStatus = "COMPLETED";
        waktuSelesai = h1?.waktu_transisi || order.createdAt || null;
      } else if (wf.step === 2 && currentStep > 2) {
        stageStatus = "COMPLETED";
        waktuSelesai = h2?.waktu_transisi || null;
      } else if (wf.step === 3 && currentStep > 3) {
        stageStatus = "COMPLETED";
        waktuSelesai = h3?.waktu_transisi || null;
      } else if (wf.step === 4 && currentStep >= 5) {
        stageStatus = "COMPLETED";
        waktuSelesai = h4?.waktu_transisi || null;
      } else if (wf.step === 5 && currentStep === 8) {
        stageStatus = "COMPLETED";
        waktuSelesai = h5?.waktu_transisi || null;
      } else {
        stageStatus = "CANCELLED";
      }
    } else if (isCompleted) {
      stageStatus = "COMPLETED";
      if (wf.step === 1) waktuSelesai = h1?.waktu_transisi || order.createdAt || null;
      else if (wf.step === 2) waktuSelesai = h2?.waktu_transisi || null;
      else if (wf.step === 3) waktuSelesai = h3?.waktu_transisi || null;
      else if (wf.step === 4) waktuSelesai = h4?.waktu_transisi || null;
      else if (wf.step === 5) waktuSelesai = h5?.waktu_transisi || null;
      else if (wf.step === 6) waktuSelesai = h6?.waktu_transisi || null;
    } else {
      switch (wf.step) {
        case 1:
          if (currentStep === 1) {
            stageStatus = "IN_PROGRESS";
          } else if (currentStep > 1) {
            stageStatus = "COMPLETED";
            waktuSelesai = h1?.waktu_transisi || order.createdAt || null;
          }
          break;

        case 2:
          if (isDatangLangsung) {
            if (currentStep === 1) {
              stageStatus = "WAITING";
            } else if (currentStep === 2) {
              stageStatus = "IN_PROGRESS";
            } else {
              stageStatus = "COMPLETED";
              waktuSelesai = h1?.waktu_transisi || order.createdAt || null;
            }
          } else {
            if (currentStep < 2) stageStatus = "WAITING";
            else if (currentStep === 2) stageStatus = "IN_PROGRESS";
            else {
              stageStatus = "COMPLETED";
              waktuSelesai = h2?.waktu_transisi || null;
            }
          }
          break;

        case 3:
          if (currentStep < 3) stageStatus = "WAITING";
          else if (currentStep === 3) stageStatus = "IN_PROGRESS";
          else {
            stageStatus = "COMPLETED";
            waktuSelesai = h3?.waktu_transisi || null;
          }
          break;

        case 4:
          if (currentStep < 4) stageStatus = "WAITING";
          else if (currentStep === 4) stageStatus = "IN_PROGRESS";
          else {
            stageStatus = "COMPLETED";
            waktuSelesai = h4?.waktu_transisi || null;
          }
          break;

        case 5:
          // Strictly WAITING while at internal step 5 and step 6
          if (currentStep < 7) {
            stageStatus = "WAITING";
          } else if (currentStep === 7) {
            stageStatus = "IN_PROGRESS";
          } else if (currentStep === 8) {
            stageStatus = "COMPLETED";
            waktuSelesai = h5?.waktu_transisi || null;
          }
          break;

        case 6:
          if (currentStep < 8) {
            stageStatus = "WAITING";
          } else {
            stageStatus = "COMPLETED";
            waktuSelesai = h6?.waktu_transisi || null;
          }
          break;
      }
    }

    return {
      step: wf.step,
      stageName: wf.stageName,
      label: wf.label,
      status: stageStatus,
      waktuSelesai: stageStatus === "COMPLETED" ? waktuSelesai : null,
    };
  });

  return {
    statusPengerjaan,
    publicStageName,
    isCompleted,
    isCancelled,
    timeline,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PUBLIC ORDER TRACKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/public/orders/tracking?nopol={nopol}
 * Searches orders by license plate number.
 * Features:
 * - Normalizes input (spaces, dashes, case-insensitive)
 * - Safe parameterized SQL
 * - Returns all matching orders, sorted latest first
 * - Returns consistent empty array if not found (no 404, no data leak)
 * - Sanitizes all sensitive fields (no PII, no internal costs/margins, no employee data)
 */
export async function trackOrderByNopol(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawNopol = typeof req.query.nopol === "string" ? req.query.nopol : "";
    if (!rawNopol || !rawNopol.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parameter query 'nopol' wajib diisi untuk melakukan tracking.");
    }

    // Normalize: strip all spaces, dashes, dots, convert to uppercase
    const cleanNopol = rawNopol.toUpperCase().replace(/[\s\-\.]/g, "");

    // Parameterized SQL query matching normalized nopol
    const stmt = db.prepare(`
      SELECT 
        order_no, customer, layanan, nopol, current_step, current_stage_name,
        payment_status, total_biaya, is_archived, created_at, updated_at,
        service_id, samsat_asal, samsat_tujuan, data_json
      FROM orders
      WHERE REPLACE(REPLACE(REPLACE(UPPER(nopol), ' ', ''), '-', ''), '.', '') = ?
      ORDER BY created_at DESC, order_no DESC
    `);

    const rows = stmt.all(cleanNopol) as any[];

    if (!rows || rows.length === 0) {
      res.status(200).json({
        success: true,
        message: "Pencarian order selesai. Tidak ada order yang cocok dengan nomor polisi tersebut.",
        data: [],
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Map each order to strict sanitized public representation using canonical translator (PUB-01)
    const sanitizedOrders = rows.map((r) => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(r.data_json);
      } catch {}

      const translation = mapInternalStageToPublicWorkflow({
        currentStep: r.current_step,
        currentStageName: r.current_stage_name,
        isCancelled: parsed.isCancelled === true,
        isArchived: Boolean(r.is_archived),
        metodeLayanan: parsed.metodeLayanan,
        createdAt: r.created_at,
      });

      return {
        orderNo: r.order_no,
        nopol: r.nopol,
        layanan: r.layanan,
        tipeKendaraan: parsed.jenisKendaraan || parsed.tipeKendaraan || "Mobil",
        samsatAsal: r.samsat_asal || parsed.wilayahSamsatAsal || "-",
        samsatTujuan: r.samsat_tujuan || parsed.wilayahSamsatTujuan || "-",
        metodeLayanan: parsed.metodeLayanan || "Antar Jemput",
        currentStep: r.current_step,
        currentStageName: r.current_stage_name,
        publicStageName: translation.publicStageName,
        statusPengerjaan: translation.statusPengerjaan,
        paymentStatus: r.payment_status || "Belum Lunas",
        tanggalOrder: r.created_at,
        lastUpdated: r.updated_at,
        isCompleted: translation.isCompleted,
        isCancelled: translation.isCancelled,
      };
    });

    res.status(200).json({
      success: true,
      message: `Ditemukan ${sanitizedOrders.length} order untuk nomor polisi '${rawNopol.trim()}'.`,
      data: sanitizedOrders,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/public/orders/:orderNo/tracking?nopol={nopol}
 * Detailed tracking view and stage progress timeline for a specific order.
 * Strictly sanitizes internal notes, employee names, costs, margins, and document links.
 * Requires license plate verification (PUB-02 anti-enumeration).
 */
export async function getPublicOrderDetailTracking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawOrderNo = typeof req.params.orderNo === "string" ? req.params.orderNo.trim() : "";
    if (!rawOrderNo) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nomor order wajib disertakan dalam parameter URL.");
    }

    // Anti-Enumeration Protection (PUB-02): Require valid 'nopol' query parameter
    const rawNopol = typeof req.query.nopol === "string" ? req.query.nopol.trim() : "";
    if (!rawNopol) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parameter query 'nopol' wajib disertakan untuk verifikasi pelacakan order.");
    }

    const cleanQueryNopol = rawNopol.toUpperCase().replace(/[\s\-\.]/g, "");

    let order: any = null;
    try {
      order = orderService.getByOrderNo(rawOrderNo);
    } catch {
      order = null;
    }
    if (!order) {
      // Safe generic 404: Do not disclose whether order number exists (PUB-02)
      throw new ApiError(404, "ORDER_NOT_FOUND", "Order tidak ditemukan atau informasi verifikasi nomor polisi tidak sesuai.");
    }

    const cleanOrderNopol = (order.nopol || "").toUpperCase().replace(/[\s\-\.]/g, "");
    if (cleanOrderNopol !== cleanQueryNopol) {
      // Safe generic 404: Do not disclose mismatch vs non-existence (PUB-02)
      throw new ApiError(404, "ORDER_NOT_FOUND", "Order tidak ditemukan atau informasi verifikasi nomor polisi tidak sesuai.");
    }

    // Query status transition history (parameterized SQL)
    const historyRows = db.prepare(`
      SELECT step_sebelumnya, step_baru, stage_name, waktu_transisi
      FROM order_status_history
      WHERE order_no = ?
      ORDER BY waktu_transisi ASC, id ASC
    `).all(order.orderNo) as Array<{
      step_sebelumnya: number;
      step_baru: number;
      stage_name: string;
      waktu_transisi: string;
    }>;

    // Apply Canonical Semantic Stage Translator (PUB-01)
    const translation = mapInternalStageToPublicWorkflow(order, historyRows);

    res.status(200).json({
      success: true,
      message: "Detail progres order berhasil diambil.",
      data: {
        orderNo: order.orderNo,
        nopol: order.nopol,
        layanan: order.layanan,
        tipeKendaraan: order.jenisKendaraan || "Mobil",
        samsatAsal: order.wilayahSamsatAsal || "-",
        samsatTujuan: order.wilayahSamsatTujuan || "-",
        metodeLayanan: order.metodeLayanan || "Antar Jemput",
        statusPengerjaan: translation.statusPengerjaan,
        currentStep: order.currentStep,
        currentStageName: order.currentStageName,
        publicStageName: translation.publicStageName,
        paymentStatus: order.payment?.statusPembayaran || "Belum Lunas",
        tanggalOrder: order.createdAt,
        isCompleted: translation.isCompleted,
        isCancelled: translation.isCancelled,
        timeline: translation.timeline,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
