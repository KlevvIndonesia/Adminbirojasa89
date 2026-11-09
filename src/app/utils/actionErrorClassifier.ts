/**
 * Unified Action Error Classification, Sanitization, Timeout Fetch & API Error Parser
 * Admin SUN89 — Biro Jasa Management System
 */

export type ActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE_RECORD"
  | "IDEMPOTENCY_CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BUSINESS_RULE_VIOLATION"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "INTERNAL_SERVER_ERROR"
  | "UNKNOWN_ERROR";

export interface ClassifiedActionError {
  code: ActionErrorCode;
  rawCode?: string;
  title: string;
  message: string;
  field?: string;
  statusCode?: number;
  retryAfterSeconds?: number;
  isRetryable: boolean;
}

export class ActionApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly field?: string;
  public readonly retryAfterSeconds?: number;
  public readonly detail?: string;
  public readonly details?: unknown;
  public readonly isActionApiError = true;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options?: {
      field?: string;
      retryAfterSeconds?: number;
      detail?: string;
      details?: unknown;
    }
  ) {
    super(message);
    this.name = "ActionApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.field = options?.field;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.detail = options?.detail;
    this.details = options?.details;
    Object.setPrototypeOf(this, ActionApiError.prototype);
  }
}

const SENSITIVE_SQL_OR_INTERNAL_PATTERNS = [
  /SQLITE_[A-Z_]+/i,
  /SQL\s+logic\s+error/i,
  /UNIQUE\s+constraint\s+failed/i,
  /CHECK\s+constraint\s+failed/i,
  /FOREIGN\s+KEY\s+constraint\s+failed/i,
  /syntax\s+error\s+near/i,
  /no\s+such\s+(?:column|table)/i,
  /table\s+[^\s]+\s+has\s+no\s+column/i,
  /\bSELECT\b.+\bFROM\b/is,
  /\bINSERT\b\s+\bINTO\b/is,
  /\bUPDATE\b.+\bSET\b/is,
  /\bDELETE\b\s+\bFROM\b/is,
];

/**
 * Sanitizes backend or thrown error messages so raw SQL/SQLite messages,
 * stack traces, filesystem paths, and tokens are never shown to users.
 */
export function sanitizeActionMessage(raw: unknown): string {
  if (!raw) return "";
  const rawRec = typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const rawErrRec =
    rawRec && typeof rawRec.error === "object" && rawRec.error !== null
      ? (rawRec.error as Record<string, unknown>)
      : null;
  let msg =
    typeof raw === "string"
      ? raw
      : typeof rawRec?.message === "string"
      ? rawRec.message
      : typeof rawErrRec?.message === "string"
      ? rawErrRec.message
      : "";

  if (!msg || typeof msg !== "string") return "";

  if (SENSITIVE_SQL_OR_INTERNAL_PATTERNS.some((pattern) => pattern.test(msg))) {
    if (/UNIQUE\s+constraint\s+failed/i.test(msg)) {
      if (/invoice/i.test(msg)) {
        return "Nomor invoice sudah digunakan oleh transaksi lain.";
      }
      if (/order_no/i.test(msg)) {
        return "Nomor order sudah terdaftar dalam sistem.";
      }
      return "Data yang dimasukkan duplikat atau sudah terdaftar.";
    }
    return "Terjadi kendala saat memproses data di server.";
  }

  // Strip multiline stack traces (keep first summary line only)
  if (msg.includes("\n") || /\s{2,}at\s+/.test(msg)) {
    msg = msg.split("\n")[0].replace(/^Error:\s*/i, "").trim();
  }

  // Redact Bearer tokens or JWT-like secrets
  msg = msg
    .replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, "[token]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token]");

  // Strip Windows paths (e.g., D:\Admin\...) and Unix filesystem paths (/home/..., /var/..., /usr/...)
  msg = msg
    .replace(/[a-zA-Z]:\\[^\s:;,)'"]+(?::\d+(?::\d+)?)?/g, "")
    .replace(/\/(?:home|var|usr|etc|opt|srv|app|Users|tmp)\/[^\s:;,)'"]+(?::\d+(?::\d+)?)?/g, "")
    .replace(/\bat\s+[A-Za-z0-9_.<>]+\s+\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (/^Error:\s*$/i.test(msg)) return "";
  return msg;
}

/**
 * Wrapper around fetch with hard request timeout using AbortController.
 * Maps timeouts to ActionApiError(408, "TIMEOUT") and network failures to ActionApiError(0, "NETWORK_ERROR").
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const externalSignal = init.signal;
  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort("REQUEST_TIMEOUT");
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    const errObj =
      typeof err === "object" && err !== null ? (err as Record<string, unknown>) : null;
    if (timedOut || err === "REQUEST_TIMEOUT" || errObj?.name === "TimeoutError") {
      throw new ActionApiError(
        408,
        "TIMEOUT",
        "Permintaan ke server melebihi batas waktu. Periksa koneksi Anda dan coba kembali."
      );
    }
    if (errObj?.name === "AbortError" && externalSignal?.aborted) {
      throw new ActionApiError(
        408,
        "TIMEOUT",
        "Permintaan dibatalkan sebelum selesai diproses."
      );
    }
    if (errObj?.isActionApiError) {
      throw err;
    }
    throw new ActionApiError(
      0,
      "NETWORK_ERROR",
      "Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda dan coba kembali."
    );
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

function parseRetryAfterHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  }
  const targetMs = Date.parse(trimmed);
  if (!Number.isNaN(targetMs)) {
    const diffSec = Math.ceil((targetMs - Date.now()) / 1000);
    return diffSec > 0 ? diffSec : undefined;
  }
  return undefined;
}

/**
 * Parses a non-OK Response object into a structured ActionApiError,
 * dispatching session expiration events for HTTP 401.
 */
export async function parseApiErrorResponse(
  res: Response,
  fallbackMessage = "Permintaan tidak dapat diproses."
): Promise<ActionApiError> {
  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function" &&
    typeof CustomEvent === "function"
  ) {
    window.dispatchEvent(new CustomEvent("sun89_auth_unauthorized"));
  }

  const headerRetryAfter = parseRetryAfterHeader(res.headers?.get?.("Retry-After") ?? null);

  let defaultCode = "INTERNAL_SERVER_ERROR";
  if (res.status === 400) defaultCode = "VALIDATION_ERROR";
  else if (res.status === 401) defaultCode = "UNAUTHORIZED";
  else if (res.status === 403) defaultCode = "FORBIDDEN";
  else if (res.status === 404) defaultCode = "NOT_FOUND";
  else if (res.status === 408) defaultCode = "TIMEOUT";
  else if (res.status === 409) defaultCode = "CONFLICT";
  else if (res.status === 422) defaultCode = "VALIDATION_ERROR";
  else if (res.status === 429) defaultCode = "RATE_LIMITED";

  let code = defaultCode;
  let message = fallbackMessage;
  let field: string | undefined;
  let retryAfterSeconds = headerRetryAfter;
  let details: unknown;

  try {
    const payload = await res.json();
    const errNode = payload?.error && typeof payload.error === "object" ? payload.error : null;

    if (errNode?.code || payload?.code) {
      code = String(errNode?.code || payload.code).toUpperCase();
    }
    const rawMsg =
      errNode?.message ||
      (typeof payload?.error === "string" ? payload.error : "") ||
      payload?.message ||
      "";
    const sanitized = sanitizeActionMessage(rawMsg);
    if (sanitized) {
      message = sanitized;
    }
    if (errNode?.field || payload?.field) {
      field = String(errNode?.field || payload.field);
    }
    if (typeof errNode?.retryAfterSeconds === "number") {
      retryAfterSeconds = errNode.retryAfterSeconds;
    } else if (typeof payload?.retryAfterSeconds === "number") {
      retryAfterSeconds = payload.retryAfterSeconds;
    }
    details = errNode?.details ?? payload?.details;
  } catch {
    // Non-JSON error response; keep status-based defaults
  }

  if (res.status >= 500) {
    message = "Terjadi gangguan pada server saat memproses permintaan. Silakan coba lagi.";
    if (!code || code === defaultCode) {
      code = "INTERNAL_SERVER_ERROR";
    }
  } else if (res.status === 429 && (!message || message === fallbackMessage)) {
    message = retryAfterSeconds
      ? `Terlalu banyak permintaan. Coba kembali dalam ${retryAfterSeconds} detik.`
      : "Terlalu banyak permintaan ke server. Silakan tunggu sebentar dan coba kembali.";
  }

  return new ActionApiError(res.status, code, message, {
    field,
    retryAfterSeconds,
    detail: message,
    details,
  });
}

const BUSINESS_RULE_CODES = new Set([
  "BUSINESS_RULE_VIOLATION",
  "SERVICE_INACTIVE",
  "SAMSAT_INACTIVE",
  "PAYMENT_METHOD_INACTIVE",
  "PAYMENT_PROOF_REQUIRED",
  "PREREQUISITE_NOT_MET",
  "DOCUMENTS_NOT_VERIFIED",
  "DOCUMENTS_NOT_APPROVED",
  "COST_ITEMS_INCOMPLETE",
  "SAMSAT_COMPONENTS_INCOMPLETE",
  "KENDALA_ACTIVE",
  "STAGE_PREREQUISITE_FAILED",
  "PAYMENT_REQUIRED",
  "ORDER_CANCELLED",
  "ORDER_ARCHIVED",
  "INVOICE_ALREADY_PAID",
  "INVOICE_NOT_PAID",
  "FINAL_COST_NOT_SET",
  "SUPERVISI_NOT_APPROVED",
  "COST_VERIFICATION_REQUIRED",
  "ALREADY_PROCESSED",
  "CASHBACK_NOT_PROCESSED",
  "AMBIGUOUS_PAYOUT_TYPE",
  "INVALID_NOMINAL",
  "EXCEEDS_LIMIT",
  "ALREADY_VOIDED",
  "PAYMENT_ALREADY_VOIDED",
  "INSUFFICIENT_OFFICE_BALANCE",
  "INSUFFICIENT_MESSENGER_BALANCE",
]);

function resolveFieldFallbackMessage(field?: string): string | undefined {
  if (!field) return undefined;
  const f = field.toLowerCase();
  if (f === "customer" || f === "namacustomer") return "Nama Customer wajib diisi.";
  if (f === "nopol" || f === "platno") return "Nomor Polisi wajib diisi lengkap.";
  if (f === "layanan" || f === "jenispengurusan") return "Jenis Pengurusan wajib dipilih.";
  if (f === "nomorhp" || f === "phone" || f === "hp") {
    return "Nomor HP / WhatsApp wajib diisi minimal 9 digit angka.";
  }
  if (f === "metodepembayaran") return "Metode pembayaran wajib dipilih.";
  if (f === "nominaldibayarawal") return "Nominal pembayaran awal tidak valid.";
  if (f === "targetstage") return "Tahap tujuan order tidak valid.";
  return undefined;
}

/**
 * Classifies any thrown error or structured API payload into a safe, clear,
 * user-actionable notification descriptor.
 */
export function classifyActionError(
  err: unknown,
  context?: { actionLabel?: string; entityLabel?: string }
): ClassifiedActionError {
  const entityLabel = context?.entityLabel || "Data";

  if (!err) {
    return {
      code: "UNKNOWN_ERROR",
      title: "Gagal Memproses Aksi",
      message: "Terjadi kendala saat memproses permintaan. Silakan coba kembali.",
      isRetryable: true,
    };
  }

  interface ErrShape {
    name?: string;
    statusCode?: unknown;
    code?: unknown;
    errorCode?: unknown;
    detail?: unknown;
    message?: unknown;
    field?: unknown;
    retryAfterSeconds?: unknown;
    error?:
      | string
      | {
          code?: unknown;
          message?: unknown;
          field?: unknown;
          retryAfterSeconds?: unknown;
        };
  }
  const anyErr = (typeof err === "object" && err !== null ? err : {}) as ErrShape;
  const nestedErr = typeof anyErr.error === "object" && anyErr.error !== null ? anyErr.error : null;
  const statusCode = typeof anyErr.statusCode === "number" ? anyErr.statusCode : undefined;
  const rawCode = String(anyErr.code || anyErr.errorCode || nestedErr?.code || "").toUpperCase();
  const rawMessage = sanitizeActionMessage(
    anyErr.detail || anyErr.message || nestedErr?.message || (typeof anyErr.error === "string" ? anyErr.error : "")
  );
  const field =
    typeof anyErr.field === "string"
      ? anyErr.field
      : typeof nestedErr?.field === "string"
      ? nestedErr.field
      : undefined;
  const retryAfterSeconds =
    typeof anyErr.retryAfterSeconds === "number"
      ? anyErr.retryAfterSeconds
      : typeof nestedErr?.retryAfterSeconds === "number"
      ? nestedErr.retryAfterSeconds
      : undefined;

  // 1. Timeout
  if (
    rawCode === "TIMEOUT" ||
    rawCode === "TIMEOUT_ERROR" ||
    statusCode === 408 ||
    anyErr.name === "TimeoutError" ||
    /melebihi batas waktu|timed?\s*out/i.test(rawMessage)
  ) {
    return {
      code: "TIMEOUT",
      rawCode: rawCode || "TIMEOUT",
      title: "Waktu Permintaan Habis",
      message:
        rawMessage && !/operation timed out/i.test(rawMessage)
          ? rawMessage
          : "Permintaan melebihi batas waktu respons server. Silakan coba kirim ulang.",
      statusCode: statusCode ?? 408,
      isRetryable: true,
    };
  }

  // 2. Network / Offline / ECONNREFUSED
  if (
    rawCode === "NETWORK_ERROR" ||
    statusCode === 0 ||
    anyErr.name === "TypeError" && /fetch|network/i.test(String(anyErr.message || "")) ||
    /failed to fetch|networkerror|econnrefused|err_connection|tidak dapat terhubung ke server/i.test(rawMessage)
  ) {
    return {
      code: "NETWORK_ERROR",
      rawCode: rawCode || "NETWORK_ERROR",
      title: "Koneksi Terputus",
      message: "Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda dan coba kembali.",
      statusCode: 0,
      isRetryable: true,
    };
  }

  // 3. Rate Limit (429)
  if (statusCode === 429 || rawCode === "RATE_LIMITED" || rawCode === "TOO_MANY_REQUESTS") {
    return {
      code: "RATE_LIMITED",
      rawCode: rawCode || "RATE_LIMITED",
      title: "Terlalu Banyak Permintaan",
      message:
        rawMessage && !rawMessage.startsWith("HTTP")
          ? rawMessage
          : retryAfterSeconds
          ? `Terlalu banyak percobaan dalam waktu singkat. Coba lagi dalam ${retryAfterSeconds} detik.`
          : "Terlalu banyak permintaan ke server. Silakan tunggu beberapa saat lalu coba kembali.",
      statusCode: 429,
      retryAfterSeconds,
      isRetryable: true,
    };
  }

  // 4. Authentication & Authorization (401 / 403)
  if (statusCode === 401 || rawCode === "UNAUTHENTICATED" || rawCode === "UNAUTHORIZED") {
    return {
      code: "UNAUTHORIZED",
      rawCode: rawCode || "UNAUTHORIZED",
      title: "Sesi Berakhir",
      message:
        rawMessage && !rawMessage.startsWith("HTTP")
          ? rawMessage
          : "Sesi login Anda telah berakhir atau tidak valid. Silakan login kembali.",
      statusCode: 401,
      isRetryable: false,
    };
  }

  if (statusCode === 403 || rawCode === "FORBIDDEN") {
    return {
      code: "FORBIDDEN",
      rawCode: "FORBIDDEN",
      title: "Akses Ditolak",
      message:
        rawMessage && !rawMessage.startsWith("HTTP")
          ? rawMessage
          : "Anda tidak memiliki izin untuk menjalankan aksi ini.",
      statusCode: 403,
      isRetryable: false,
    };
  }

  // 5. Idempotency Conflict
  if (rawCode === "IDEMPOTENCY_CONFLICT") {
    return {
      code: "IDEMPOTENCY_CONFLICT",
      rawCode,
      title: "Konflik Pengiriman Data",
      message:
        rawMessage ||
        "Isian form berubah dari percobaan sebelumnya. Periksa data Anda lalu kirim ulang.",
      statusCode: statusCode ?? 422,
      isRetryable: true,
    };
  }

  // 6. Duplicate Record
  if (
    rawCode === "DUPLICATE_RECORD" ||
    /sudah digunakan|sudah terdaftar|duplikat/i.test(rawMessage)
  ) {
    return {
      code: "DUPLICATE_RECORD",
      rawCode: rawCode || "DUPLICATE_RECORD",
      title: "Data Duplikat",
      message:
        rawMessage && !rawMessage.startsWith("HTTP")
          ? rawMessage
          : "Data yang dimasukkan sudah terdaftar dalam sistem.",
      field,
      statusCode: statusCode ?? 409,
      isRetryable: false,
    };
  }

  // 7. Not Found (404)
  if (
    statusCode === 404 ||
    rawCode === "NOT_FOUND" ||
    rawCode === "ORDER_NOT_FOUND" ||
    rawCode === "INVOICE_NOT_FOUND" ||
    rawCode === "PAYMENT_NOT_FOUND" ||
    rawCode === "MESSENGER_NOT_FOUND" ||
    rawCode === "REIMBURSEMENT_NOT_FOUND" ||
    /tidak ditemukan/i.test(rawMessage)
  ) {
    return {
      code: "NOT_FOUND",
      rawCode: rawCode || "NOT_FOUND",
      title: "Data Tidak Ditemukan",
      message:
        rawMessage && !rawMessage.startsWith("HTTP")
          ? rawMessage
          : `${entityLabel} tidak ditemukan atau mungkin sudah dihapus.`,
      statusCode: 404,
      isRetryable: false,
    };
  }

  // 8. Explicit Business Rule Code (400 / 409 / 422 domain constraints)
  if (BUSINESS_RULE_CODES.has(rawCode)) {
    return {
      code: "BUSINESS_RULE_VIOLATION",
      rawCode: rawCode || "BUSINESS_RULE_VIOLATION",
      title: "Aksi Tidak Dapat Diproses",
      message:
        rawMessage ||
        "Persyaratan alur kerja atau kelengkapan dokumen/biaya belum terpenuhi.",
      field,
      statusCode: statusCode ?? 422,
      isRetryable: false,
    };
  }

  // 9. State / Optimistic Concurrency Conflict (409)
  if (
    statusCode === 409 ||
    rawCode === "CONFLICT" ||
    rawCode === "INVALID_TRANSITION" ||
    rawCode === "STAGE_CONFLICT" ||
    rawCode === "CONCURRENT_MODIFICATION"
  ) {
    return {
      code: "CONFLICT",
      rawCode: rawCode || "CONFLICT",
      title: "Status Data Berubah",
      message:
        rawMessage && !rawMessage.startsWith("HTTP")
          ? rawMessage
          : `${entityLabel} sedang dalam kondisi berbeda di server. Muat ulang data sebelum mencoba lagi.`,
      field,
      statusCode: 409,
      isRetryable: false,
    };
  }

  // 10. Heuristic Business Rule Violation (for domain rejections without dedicated rawCode)
  if (
    /bukti pembayaran.*wajib|belum diverifikasi|belum disetujui|syarat.*belum|bukan pada tahap|tidak berada pada tahap|harus berada (?:di|pada) tahap|tidak aktif|kendala aktif|masih.*kendala|sudah lunas|sudah diproses|sudah pernah dibatalkan|melebihi sisa|belum ditetapkan/i.test(
      rawMessage
    )
  ) {
    return {
      code: "BUSINESS_RULE_VIOLATION",
      rawCode: rawCode || "BUSINESS_RULE_VIOLATION",
      title: "Aksi Tidak Dapat Diproses",
      message:
        rawMessage ||
        "Persyaratan alur kerja atau kelengkapan dokumen/biaya belum terpenuhi.",
      field,
      statusCode: statusCode ?? 422,
      isRetryable: false,
    };
  }

  // 10. Validation Error (400 / 422 / field error)
  if (
    statusCode === 400 ||
    statusCode === 422 ||
    rawCode === "VALIDATION_ERROR" ||
    Boolean(field)
  ) {
    const fieldMsg = resolveFieldFallbackMessage(field);
    return {
      code: "VALIDATION_ERROR",
      rawCode: rawCode || "VALIDATION_ERROR",
      title: "Data Belum Valid",
      message:
        rawMessage && !rawMessage.startsWith("HTTP") && rawMessage !== "VALIDATION_ERROR"
          ? rawMessage
          : fieldMsg || "Harap periksa kembali kolom wajib dengan format yang benar.",
      field,
      statusCode: statusCode ?? 400,
      isRetryable: false,
    };
  }

  // 11. Internal Server Error (500+)
  if (
    (statusCode !== undefined && statusCode >= 500) ||
    rawCode === "INTERNAL_SERVER_ERROR" ||
    rawCode === "SERVER_ERROR"
  ) {
    return {
      code: "INTERNAL_SERVER_ERROR",
      rawCode: rawCode || "INTERNAL_SERVER_ERROR",
      title: "Gangguan Server",
      message:
        "Server mengalami gangguan saat memproses permintaan. Silakan coba kembali beberapa saat lagi.",
      statusCode: statusCode ?? 500,
      isRetryable: true,
    };
  }

  // 12. Safe Fallback
  const safeDetail =
    rawMessage && !/^HTTP\s*\d+$/i.test(rawMessage)
      ? rawMessage
      : "Terjadi kendala saat memproses permintaan. Silakan coba kembali.";

  return {
    code: "UNKNOWN_ERROR",
    rawCode: rawCode || "UNKNOWN_ERROR",
    title: "Gagal Memproses Aksi",
    message: safeDetail,
    field,
    statusCode,
    isRetryable: true,
  };
}
