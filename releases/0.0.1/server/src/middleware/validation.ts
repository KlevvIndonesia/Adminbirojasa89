/**
 * Request Validation Middleware & Sanitization DTOs
 * Admin SUN89 — Biro Jasa Management System
 */

import { Request, Response, NextFunction } from "express";
import { STAGES, StageName } from "../../../src/domain/order/types";
import {
  assertNoProtectedFieldViolations,
  normalizeOrderPayload,
  normalizeInvoicePaymentPayload,
  normalizeServicePricingPayload,
  normalizeSamsatPricingPayload,
} from "../utils/aliasNormalizer";
import { validateOrderPricingSanity } from "../utils/pricingSanityCheck";

/**
 * Validates Auth Login Payload
 */
export function validateLoginPayload(req: Request, res: Response, next: NextFunction): void {
  const { email, password } = req.body || {};

  if (!email || typeof email !== "string" || !email.trim()) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Email wajib diisi." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!password || typeof password !== "string" || !password.trim()) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Password wajib diisi." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

/**
 * Validates Order Creation Payload
 */
export function validateOrderCreatePayload(req: Request, res: Response, next: NextFunction): void {
  try {
    normalizeOrderPayload(req.body);
  } catch (err: any) {
    res.status(err.statusCode || 400).json({
      success: false,
      error: { code: err.code || "VALIDATION_ERROR", message: err.message },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const { customer, nomorHP, layanan, nopol } = req.body || {};

  if (!customer || typeof customer !== "string" || !customer.trim()) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Nama customer wajib diisi." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!nomorHP || typeof nomorHP !== "string" || !nomorHP.trim()) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Nomor HP wajib diisi." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!layanan || typeof layanan !== "string" || !layanan.trim()) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Jenis layanan wajib dipilih." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!nopol || typeof nopol !== "string" || !nopol.trim()) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Nomor polisi (nopol) wajib diisi." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Server-side Pricing Sanity & Anti-Tampering Check
  const pricingCheck = validateOrderPricingSanity(req.body);
  if (!pricingCheck.isValid) {
    res.status(400).json({
      success: false,
      error: {
        code: pricingCheck.errorCode || "VALIDATION_ERROR",
        message: pricingCheck.errorMessage || "Kalkulasi harga order tidak valid atau terindikasi manipulasi.",
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

/**
 * Validates and sanitizes Order Update Payload
 * Strips server-owned protected fields:
 * - orderNo, currentStep, currentStageName, isArchived, createdAt, updatedAt
 * - payment.isPaymentVerified, payment.statusPembayaran, payment.dibayar, payment.kurang
 * Enforces strict rejection across all camelCase, snake_case, and alias variants (P1-B/P1-C)
 */
export function validateOrderUpdatePayload(req: Request, res: Response, next: NextFunction): void {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Request body harus berupa JSON object." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 1. Check URL param orderNo vs body orderNo/order_no
  const rawParam = req.params?.orderNo;
  const paramOrderNo = typeof rawParam === "string" ? rawParam.trim() : (Array.isArray(rawParam) ? String(rawParam[0]).trim() : undefined);
  const bodyOrderNo = body.orderNo || body.order_no;
  if (paramOrderNo && bodyOrderNo && String(bodyOrderNo).trim().toUpperCase() !== paramOrderNo.toUpperCase()) {
    res.status(400).json({
      success: false,
      error: {
        code: "CONFLICTING_ALIASES",
        message: `Nomor order di URL '${paramOrderNo}' tidak cocok dengan orderNo di body '${bodyOrderNo}'.`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 2. Strict rejection of server-controlled and approval/workflow-gated root & payment fields
  // Catches all camelCase, snake_case, and alias variants with HTTP 403 PROTECTED_FIELD_VIOLATION
  try {
    assertNoProtectedFieldViolations(body, (req as any).user);
  } catch (err: any) {
    res.status(err.statusCode || 403).json({
      success: false,
      error: { code: err.code || "PROTECTED_FIELD_VIOLATION", message: err.message },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 3. Canonicalize allowed fields and detect alias conflicts
  try {
    normalizeOrderPayload(body);
  } catch (err: any) {
    res.status(err.statusCode || 400).json({
      success: false,
      error: { code: err.code || "VALIDATION_ERROR", message: err.message },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

/**
 * Validates Order Stage Advance / Rollback Payload
 * Protects server-controlled immutable lifecycle & identity fields while
 * delegating stage-specific transition rules to orderService.
 */
export function validateStageTransitionPayload(req: Request, res: Response, next: NextFunction): void {
  const { targetStage, updates } = req.body || {};

  if (!targetStage || typeof targetStage !== "string" || !STAGES.includes(targetStage as StageName)) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Tahapan tujuan '${targetStage}' tidak valid. Pilihan yang valid: ${STAGES.join(", ")}`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (updates !== undefined && updates !== null) {
    if (typeof updates !== "object" || Array.isArray(updates)) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Field 'updates' harus berupa JSON object.",
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Strictly forbid client manipulation of server-controlled lifecycle, step identity, and cost verification
    const forbiddenLifecycleKeys = [
      "orderNo", "order_no",
      "id",
      "createdAt", "created_at",
      "updatedAt", "updated_at",
      "isArchived", "is_archived",
      "isCancelled", "is_cancelled",
      "cancelledAt", "cancelled_at",
      "cancelledBy", "cancelled_by",
      "cancellationReason", "cancellation_reason",
      "currentStep", "current_step", "step", "tahap",
      "currentStageName", "current_stage_name", "stage",
      // Actor identity protection (Patch C): actor attribution is strictly server-controlled
      "actorEmployeeId", "actor_employee_id", "diubah_oleh_employee_id", "actorId", "actor_id", "employeeId", "employee_id",
      // Cost verification protection: strictly reserved for /verify-cost endpoint
      "isCostVerified", "is_cost_verified",
      "costCompletenessStatus", "cost_completeness_status",
      "costVerifiedAt", "cost_verified_at",
      "costVerifiedBy", "cost_verified_by",
      "costSnapshot", "cost_snapshot",
      // Service Requirements Snapshot protection (Patch D)
      "serviceRequirementsSnapshot", "service_requirements_snapshot",
      "requirementsSnapshot", "requirements_snapshot",
    ];

    for (const key of forbiddenLifecycleKeys) {
      if (key in updates && (updates as Record<string, any>)[key] !== undefined) {
        res.status(403).json({
          success: false,
          error: {
            code: "PROTECTED_FIELD_VIOLATION",
            message: `Properti '${key}' dilindungi sistem dan tidak boleh diatur secara langsung. Tahapan dan nomor urut dikelola server.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }
  }

  next();
}

/**
 * Validates Finance Invoice Payment Payload
 */
/**
 * Validates Order Cost Verification Payload
 * POST /api/orders/:orderNo/verify-cost
 */
export function validateOrderCostVerificationPayload(req: Request, res: Response, next: NextFunction): void {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Request body harus berupa JSON object." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Reject client-forged server metadata properties
  const forbiddenKeys = [
    "isCostVerified", "is_cost_verified",
    "costCompletenessStatus", "cost_completeness_status",
    "costVerifiedAt", "cost_verified_at",
    "costVerifiedBy", "cost_verified_by"
  ];
  for (const k of forbiddenKeys) {
    if (k in body && body[k] !== undefined) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN_PROPERTY",
          message: `Properti '${k}' tidak boleh dimanipulasi oleh client. Identitas dan waktu verifikasi ditetapkan oleh server.`
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  const { finalBiayaSamsat, finalTotalBiaya, notes } = body;

  // Validate finalBiayaSamsat if provided
  if (finalBiayaSamsat !== undefined && finalBiayaSamsat !== null) {
    const num = Number(finalBiayaSamsat);
    if (!Number.isFinite(num) || num < 0 || isNaN(num)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_COST_PAYLOAD", message: "finalBiayaSamsat harus berupa angka positif atau nol yang valid." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    body.finalBiayaSamsat = num;
  }

  // Validate finalTotalBiaya if provided
  if (finalTotalBiaya !== undefined && finalTotalBiaya !== null) {
    const num = Number(finalTotalBiaya);
    if (!Number.isFinite(num) || num < 0 || isNaN(num)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_COST_PAYLOAD", message: "finalTotalBiaya harus berupa angka positif atau nol yang valid." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    body.finalTotalBiaya = num;
  }

  // Cross-validation: If both provided, finalTotalBiaya cannot be less than finalBiayaSamsat
  if (
    body.finalBiayaSamsat !== undefined &&
    body.finalBiayaSamsat !== null &&
    body.finalTotalBiaya !== undefined &&
    body.finalTotalBiaya !== null
  ) {
    if (body.finalTotalBiaya < body.finalBiayaSamsat) {
      res.status(400).json({
        success: false,
        error: {
          code: "INCONSISTENT_COST_PAYLOAD",
          message: `finalTotalBiaya (${body.finalTotalBiaya}) tidak boleh lebih kecil dari biaya Samsat (${body.finalBiayaSamsat}).`
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  // Validate notes if provided
  if (notes !== undefined && notes !== null) {
    if (typeof notes !== "string") {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_NOTES", message: "Catatan (notes) harus berupa teks string." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (notes.length > 1000) {
      res.status(400).json({
        success: false,
        error: { code: "NOTES_TOO_LONG", message: "Catatan (notes) maksimal 1000 karakter." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    body.notes = notes.trim();
  }

  next();
}

export function validateInvoicePaymentPayload(req: Request, res: Response, next: NextFunction): void {
  try {
    normalizeInvoicePaymentPayload(req.body);
  } catch (err: any) {
    res.status(err.statusCode || 400).json({
      success: false,
      error: { code: err.code || "VALIDATION_ERROR", message: err.message },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const { amount } = req.body || {};

  if (amount === undefined || amount === null || amount === "") {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Nominal pembayaran (amount/nominal) wajib diisi." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Nominal pembayaran harus berupa angka positif yang valid (bukan 0 atau negatif).",
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.body.amount = numAmount;
  next();
}

/**
 * Validates Finance Kas Kantor Payload
 */
export function validateKasKantorPayload(req: Request, res: Response, next: NextFunction): void {
  const { keterangan, status, debit, kredit, penanggungJawab } = req.body || {};

  if (!keterangan || typeof keterangan !== "string" || !keterangan.trim()) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Keterangan kas kantor wajib diisi." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const validStatuses = ["Pemasukan", "Pengeluaran", "Debit", "Kredit"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: `Status transaksi harus salah satu dari: ${validStatuses.join(", ")}` },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const numDebit = Number(debit ?? 0);
  const numKredit = Number(kredit ?? 0);

  if (!Number.isFinite(numDebit) || numDebit < 0 || !Number.isFinite(numKredit) || numKredit < 0) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Nilai debit dan kredit harus berupa angka non-negatif yang valid." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (penanggungJawab !== undefined && typeof penanggungJawab === "string") {
    req.body.penanggungJawab = penanggungJawab.trim() || undefined;
  }

  next();
}

/**
 * Validates Finance Pengeluaran Payload
 */
export function validatePengeluaranPayload(req: Request, res: Response, next: NextFunction): void {
  const { keterangan, nominal, penanggungJawab } = req.body || {};

  if (!keterangan || typeof keterangan !== "string" || !keterangan.trim()) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Keterangan pengeluaran wajib diisi." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const numNominal = Number(nominal ?? 0);
  if (!Number.isFinite(numNominal) || numNominal <= 0) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Nominal pengeluaran harus berupa angka positif yang valid." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.body.nominal = numNominal;
  if (penanggungJawab !== undefined && typeof penanggungJawab === "string") {
    req.body.penanggungJawab = penanggungJawab.trim() || undefined;
  }

  next();
}

/**
 * Validates Pricing Samsat Update Payload
 */
export function validatePricingUpdatePayload(req: Request, res: Response, next: NextFunction): void {
  try {
    normalizeSamsatPricingPayload(req.body);
  } catch (err: any) {
    res.status(err.statusCode || 400).json({
      success: false,
      error: { code: err.code || "VALIDATION_ERROR", message: err.message },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const { basePrice, biayaDasar } = req.body || {};
  const price = basePrice !== undefined ? basePrice : biayaDasar;

  if (price !== undefined && price !== null && price !== "") {
    const numPrice = Number(price);
    if (!Number.isFinite(numPrice) || numPrice < 0) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Harga dasar (basePrice/biayaDasar) harus berupa angka non-negatif yang valid." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.body.basePrice = numPrice;
    req.body.biayaDasar = numPrice;
  }

  next();
}

/**
 * Validates User Mutation Payload
 */
export function validateUserMutationPayload(req: Request, res: Response, next: NextFunction): void {
  const { email, nama, jabatan, status } = req.body || {};

  if (email !== undefined) {
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Format email tidak valid." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  if (nama !== undefined && (typeof nama !== "string" || !nama.trim())) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Nama tidak boleh kosong." },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (jabatan !== undefined) {
    const validJabatan = ["ADMIN", "FINANCE", "SVP", "MESSENGER", "CLILEN"];
    if (!validJabatan.includes(jabatan)) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: `Jabatan harus salah satu dari: ${validJabatan.join(", ")}` },
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  if (status !== undefined) {
    const validStatus = ["Aktif", "Nonaktif"];
    if (!validStatus.includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: `Status harus salah satu dari: ${validStatus.join(", ")}` },
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  next();
}

/**
 * Validates Service Pricing (Biaya Layanan) Payload
 */
export function validateServicePricingPayload(req: Request, res: Response, next: NextFunction): void {
  try {
    normalizeServicePricingPayload(req.body);
  } catch (err: any) {
    res.status(err.statusCode || 400).json({
      success: false,
      error: { code: err.code || "VALIDATION_ERROR", message: err.message },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const isPost = req.method === "POST";
  const { serviceName, wilayah, biayaJasa, biayaAntarJemput } = req.body || {};

  if (isPost) {
    if (!serviceName || typeof serviceName !== "string" || !serviceName.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Nama layanan (serviceName) wajib diisi." },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!wilayah || typeof wilayah !== "string" || !wilayah.trim()) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Wilayah Samsat (wilayah) wajib diisi." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
  }

  if (biayaJasa !== undefined && biayaJasa !== null && biayaJasa !== "") {
    const numJasa = Number(biayaJasa);
    if (!Number.isFinite(numJasa) || numJasa < 0) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Biaya jasa harus berupa nominal angka non-negatif yang valid." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.body.biayaJasa = numJasa;
  }

  if (biayaAntarJemput !== undefined && biayaAntarJemput !== null && biayaAntarJemput !== "") {
    const numCourier = Number(biayaAntarJemput);
    if (!Number.isFinite(numCourier) || numCourier < 0) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Biaya antar jemput harus berupa nominal angka non-negatif yang valid." },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.body.biayaAntarJemput = numCourier;
  }

  next();
}
