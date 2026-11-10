/**
 * Canonical Request Hashing & Identity Helpers
 * Phase 4B Batch 2B Step B — Payment Identity & Idempotency Architecture
 * 
 * Guarantees:
 * 1. Deterministic SHA-256 request hashing across all 4 operational scopes:
 *    CREATE_ORDER, PAYMENT_SUBMISSION, PAYMENT_VERIFICATION, PAYMENT_VOID.
 * 2. Strict input validation prior to hashing (positive integer invoiceId, finite positive amounts).
 * 3. Exact regex discrimination for polymorphic payment identifiers (numeric row ID vs canonical UUID).
 * 4. Backend-generated canonical payment UUIDs (pay-${crypto.randomUUID()}).
 */

import crypto from "node:crypto";
import { ApiError } from "../middleware/errorHandler";

export const CANONICAL_PAYMENT_ID_REGEX =
  /^pay-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const SCOPE_DELIMITER = "::";

export type AllowedIdempotencyScope =
  | "CREATE_ORDER"
  | "PAYMENT_SUBMISSION"
  | "PAYMENT_VERIFICATION"
  | "PAYMENT_VOID";

export const ALLOWED_SCOPES: ReadonlySet<string> = new Set<AllowedIdempotencyScope>([
  "CREATE_ORDER",
  "PAYMENT_SUBMISSION",
  "PAYMENT_VERIFICATION",
  "PAYMENT_VOID",
]);

/**
 * Generates a collision-safe canonical payment UUID.
 * Format: pay-[uuid-v4]
 */
export function generateCanonicalPaymentId(): string {
  return `pay-${crypto.randomUUID()}`;
}

/**
 * Validates whether a given string is a canonical payment UUID.
 */
export function isValidCanonicalPaymentId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  return CANONICAL_PAYMENT_ID_REGEX.test(id.trim());
}

/**
 * Formats a scoped idempotency key with strict double-colon delimiter.
 */
export function formatScopedIdempotencyKey(scope: AllowedIdempotencyScope | string, clientKey: string): string {
  const cleanScope = String(scope || "").trim();
  const cleanKey = String(clientKey || "").trim();
  return `${cleanScope}${SCOPE_DELIMITER}${cleanKey}`;
}

/**
 * Parses a scoped idempotency key into its scope and raw client key components.
 */
export function parseScopedIdempotencyKey(
  scopedKey: string
): { scope: string; clientKey: string } | null {
  if (typeof scopedKey !== "string") return null;
  const idx = scopedKey.indexOf(SCOPE_DELIMITER);
  if (idx === -1) return null;
  const scope = scopedKey.substring(0, idx).trim();
  const clientKey = scopedKey.substring(idx + SCOPE_DELIMITER.length).trim();
  return { scope, clientKey };
}

/**
 * Validates that an input is a strictly valid positive integer.
 * Rejects partial parsing like "12abc", floats ("1.5"), negatives ("-5"), zero ("0"), and non-integers.
 */
export function validatePositiveInteger(val: unknown, fieldName = "ID"): number {
  if (val === undefined || val === null || val === "") {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} wajib diisi berupa bilangan bulat positif.`);
  }

  const str = String(val).trim();
  if (!/^\d+$/.test(str)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} harus berupa bilangan bulat positif yang valid.`);
  }

  const num = Number(str);
  if (!Number.isSafeInteger(num) || num <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} harus berupa bilangan bulat positif yang lebih besar dari 0.`);
  }

  return num;
}

/**
 * Validates that a monetary amount is finite, positive, and within safe integer bounds.
 * Normalizes to integer Rupiah using Math.round.
 */
export function validatePositiveFiniteAmount(val: unknown, fieldName = "Nominal"): number {
  if (val === undefined || val === null || val === "") {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} pembayaran wajib diisi.`);
  }

  let num: number;
  if (typeof val === "number") {
    num = val;
  } else if (typeof val === "string") {
    const trimmed = val.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} pembayaran harus berupa angka positif yang valid.`);
    }
    num = Number(trimmed);
  } else {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} pembayaran harus berupa angka.`);
  }

  if (!Number.isFinite(num) || Number.isNaN(num) || num <= 0 || num > Number.MAX_SAFE_INTEGER) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} pembayaran harus berupa angka positif yang valid.`);
  }

  return Math.round(num);
}

/**
 * Discriminate polymorphic payment identifier (numeric row ID vs canonical string UUID)
 * without ambiguous coercion or silent NaN conversion.
 */
export function discriminatePaymentIdentifier(
  param: unknown
): { type: "numeric"; value: number } | { type: "uuid"; value: string } {
  if (param === undefined || param === null || param === "") {
    throw new ApiError(400, "VALIDATION_ERROR", "ID pembayaran wajib diisi.");
  }

  const str = String(param).trim();

  // Strict integer check
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (Number.isSafeInteger(num) && num > 0) {
      return { type: "numeric", value: num };
    }
  }

  // Canonical UUID format check
  if (CANONICAL_PAYMENT_ID_REGEX.test(str)) {
    return { type: "uuid", value: str };
  }

  throw new ApiError(
    400,
    "VALIDATION_ERROR",
    "Format ID pembayaran tidak valid. Harus berupa integer ID baris atau UUID kanonis dengan prefix 'pay-'."
  );
}

// ─── CANONICAL REQUEST HASH BUILDERS ──────────────────────────────────────────

/**
 * Builds canonical SHA-256 hash for CREATE_ORDER scope.
 */
export function hashCreateOrderPayload(data: Record<string, any>): string {
  const canonicalObj = {
    customer: String(data.customer || data.namaPelanggan || "").trim().replace(/\s+/g, " "),
    nomorHP: String(data.nomorHP || data.telepon || data.no_hp || "").trim().replace(/[\s\-\.]/g, ""),
    layanan: String(data.layanan || data.serviceId || "").trim().toLowerCase().replace(/\s+/g, " "),
    nopol: String(data.nopol || data.platNomor || "").trim().toUpperCase().replace(/[\s\-]/g, ""),
    wilayahSamsatAsal: String(data.wilayahSamsatAsal || data.samsatAsalId || "").trim().toLowerCase(),
    wilayahSamsatTujuan: String(data.wilayahSamsatTujuan || "-").trim().toLowerCase(),
    totalBiaya: typeof data.totalBiaya === "number" ? Math.round(data.totalBiaya) : Number(data.totalBiaya || 0),
    nominalAwal: typeof data.payment?.nominalDibayarAwal === "number"
      ? Math.round(data.payment.nominalDibayarAwal)
      : typeof data.payment?.nominal === "number"
      ? Math.round(data.payment.nominal)
      : typeof data.payment?.dibayar === "number"
      ? Math.round(data.payment.dibayar)
      : 0,
    metode: String(data.payment?.metodePembayaran || data.payment?.metode || data.metodePembayaran || "").trim(),
    bank: String(data.payment?.namaBank || data.payment?.bank || "").trim(),
    documentId: String(data.payment?.buktiPembayaran?.documentId || data.payment?.documentId || "").trim(),
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonicalObj)).digest("hex");
}

/**
 * Builds canonical SHA-256 hash for PAYMENT_SUBMISSION scope.
 */
export function hashPaymentSubmissionPayload(
  invoiceId: number,
  amount: number,
  details: Record<string, any>
): string {
  const validInvoiceId = validatePositiveInteger(invoiceId, "Invoice ID");
  const validAmount = validatePositiveFiniteAmount(amount, "Nominal");

  const rawDate = details.tanggalBayar || details.tanggal;
  const normalizedDate = rawDate ? String(rawDate).split("T")[0].trim() : "";

  const canonicalObj = {
    invoiceId: validInvoiceId,
    amount: validAmount,
    tanggalBayar: normalizedDate,
    metodePembayaran: String(details.metodePembayaran || details.metode || "").trim().replace(/\s+/g, " "),
    namaBank: String(details.namaBank || details.bank || "").trim().replace(/\s+/g, " "),
    nomorRekening: String(details.nomorRekening || details.noRek || "").trim().replace(/[\s\-]/g, ""),
    documentId: String(details.documentId || details.bukti?.documentId || details.bukti?.docId || "").trim(),
    catatan: String(details.catatan || details.notes || "").trim().replace(/\s+/g, " "),
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonicalObj)).digest("hex");
}

/**
 * Builds canonical SHA-256 hash for PAYMENT_VERIFICATION scope.
 * Binds the pre-resolved target payment UUID and permanent authenticated actor userId.
 */
export function hashPaymentVerificationPayload(
  orderNo: string,
  resolvedPaymentId: string,
  confirmedAmount: number,
  verifierId: string,
  notes?: string,
  documentId?: string
): string {
  const cleanOrderNo = String(orderNo || "").trim().toUpperCase();
  if (!cleanOrderNo) {
    throw new ApiError(400, "VALIDATION_ERROR", "Order No wajib diisi untuk verifikasi pembayaran.");
  }

  const cleanPaymentId = String(resolvedPaymentId || "").trim();
  if (!cleanPaymentId) {
    throw new ApiError(400, "VALIDATION_ERROR", "Payment ID target wajib di-resolve sebelum membuat hash verifikasi.");
  }

  const validAmount = validatePositiveFiniteAmount(confirmedAmount, "Confirmed Amount");
  const cleanVerifierId = String(verifierId || "").trim();
  if (!cleanVerifierId) {
    throw new ApiError(403, "FORBIDDEN", "Identitas aktor verifikator (userId) wajib tersedia untuk binding audit.");
  }

  const canonicalObj = {
    orderNo: cleanOrderNo,
    paymentId: cleanPaymentId,
    confirmedAmount: validAmount,
    verifierId: cleanVerifierId,
    notes: String(notes || "").trim().replace(/\s+/g, " "),
    documentId: String(documentId || "").trim(),
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonicalObj)).digest("hex");
}

/**
 * Builds canonical SHA-256 hash for PAYMENT_VOID scope.
 */
export function hashPaymentVoidPayload(
  invoiceId: number | string,
  paymentId: number | string,
  voidReason: string,
  voidedBy: string
): string {
  const cleanInvoiceId = String(invoiceId || "").trim();
  if (!cleanInvoiceId) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invoice ID wajib diisi untuk void pembayaran.");
  }

  const cleanPaymentId = String(paymentId || "").trim();
  if (!cleanPaymentId) {
    throw new ApiError(400, "VALIDATION_ERROR", "Payment ID wajib diisi untuk void pembayaran.");
  }

  const cleanReason = String(voidReason || "").trim().replace(/\s+/g, " ");
  if (cleanReason.length < 10) {
    throw new ApiError(400, "VALIDATION_ERROR", "Alasan void pembayaran minimal 10 karakter.");
  }

  const cleanVoidedBy = String(voidedBy || "").trim();
  if (!cleanVoidedBy) {
    throw new ApiError(403, "FORBIDDEN", "Identitas aktor pembatal (voidedBy) wajib tersedia.");
  }

  const canonicalObj = {
    invoiceId: cleanInvoiceId,
    paymentId: cleanPaymentId,
    voidReason: cleanReason,
    voidedBy: cleanVoidedBy,
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonicalObj)).digest("hex");
}
