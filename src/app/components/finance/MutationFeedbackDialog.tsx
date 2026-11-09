import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { CheckCircle2, AlertCircle, ShieldAlert, WifiOff, ServerCrash, Clock } from "lucide-react";
import { Badge } from "../ui/badge";
import { sanitizeActionMessage } from "../../utils/actionErrorClassifier";

export type MutationFeedbackType = "success" | "error";

export interface FormattedMutationError {
  title: string;
  message: string;
  code: string;
  field?: string;
  statusCode?: number;
}

/**
 * Sanitizes backend error messages to prevent leakage of raw SQL errors,
 * stack traces, internal filesystem paths, or tokens.
 */
export function sanitizeBackendMessage(raw: any): string {
  return sanitizeActionMessage(raw);
}

/**
 * Classifies mutation errors into safe, human-readable feedback.
 */
export function classifyMutationError(err: any): FormattedMutationError {
  if (!err) {
    return {
      title: "Gagal Menyimpan Data",
      message: "Gagal menyimpan data. Terjadi kendala saat memproses transaksi.",
      code: "UNKNOWN_ERROR",
    };
  }

  const statusCode = typeof err.statusCode === "number" ? err.statusCode : undefined;
  const rawCode = String(err.code || "").toUpperCase();
  const rawMessage = sanitizeBackendMessage(err.detail || err.message || err.error?.message || err.error || "");
  const field = err.field || err.error?.field;

  const retryAfterSeconds =
    typeof err.retryAfterSeconds === "number"
      ? err.retryAfterSeconds
      : typeof err.error?.retryAfterSeconds === "number"
      ? err.error.retryAfterSeconds
      : undefined;

  // 1a. Explicit Server/HTTP Timeout (408 / code TIMEOUT)
  if (rawCode === "TIMEOUT" || statusCode === 408) {
    return {
      title: "Waktu Permintaan Habis",
      message:
        rawMessage && !rawMessage.startsWith("HTTP")
          ? rawMessage
          : "Permintaan ke server melebihi batas waktu. Periksa koneksi Anda dan coba kembali.",
      code: "TIMEOUT",
      statusCode: 408,
    };
  }

  // 1b. Network / Connection Error (including TIMEOUT_ERROR w/ statusCode 0 contract)
  if (
    rawCode === "NETWORK_ERROR" ||
    rawCode === "TIMEOUT_ERROR" ||
    statusCode === 0 ||
    /failed to fetch/i.test(rawMessage) ||
    /network/i.test(rawMessage) ||
    /koneksi/i.test(rawMessage)
  ) {
    return {
      title: "Koneksi Terputus",
      message: "Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba kembali.",
      code: "NETWORK_ERROR",
      statusCode: 0,
    };
  }

  // 1c. Rate Limiting (429)
  if (statusCode === 429 || rawCode === "RATE_LIMITED" || rawCode === "TOO_MANY_REQUESTS") {
    return {
      title: "Terlalu Banyak Permintaan",
      message: retryAfterSeconds
        ? `Terlalu banyak percobaan dalam waktu singkat. Coba lagi dalam ${retryAfterSeconds} detik.`
        : rawMessage && !rawMessage.startsWith("HTTP")
        ? rawMessage
        : "Terlalu banyak permintaan ke server. Silakan tunggu beberapa saat lalu coba kembali.",
      code: "RATE_LIMITED",
      statusCode: 429,
    };
  }

  // 2. Authentication / Authorization Error (401 / 403)
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    rawCode === "UNAUTHENTICATED" ||
    rawCode === "FORBIDDEN" ||
    rawCode === "UNAUTHORIZED"
  ) {
    return {
      title: "Akses Ditolak",
      message: "Anda tidak memiliki izin untuk melakukan perubahan ini.",
      code: rawCode || "FORBIDDEN",
      statusCode: statusCode || 403,
    };
  }

  // 3. Record Not Found (404)
  if (
    statusCode === 404 ||
    rawCode === "NOT_FOUND" ||
    rawCode === "ORDER_NOT_FOUND" ||
    /tidak ditemukan/i.test(rawMessage)
  ) {
    return {
      title: "Data Tidak Ditemukan",
      message: "Data penjualan tidak ditemukan. Data mungkin sudah dihapus atau berubah.",
      code: "NOT_FOUND",
      statusCode: 404,
    };
  }

  // 3b. Business Rule Violation
  if (
    rawCode === "BUSINESS_RULE_VIOLATION" ||
    rawCode === "SERVICE_INACTIVE" ||
    rawCode === "SAMSAT_INACTIVE" ||
    rawCode === "PAYMENT_METHOD_INACTIVE" ||
    rawCode === "PAYMENT_PROOF_REQUIRED" ||
    rawCode === "PREREQUISITE_NOT_MET" ||
    rawCode === "DOCUMENTS_NOT_VERIFIED" ||
    rawCode === "DOCUMENTS_NOT_APPROVED"
  ) {
    const cleanRuleMsg = rawMessage && !rawMessage.startsWith("HTTP")
      ? rawMessage
      : "Perubahan tidak dapat diproses karena melanggar aturan bisnis atau status data terkait.";
    return {
      title: "Gagal Menyimpan Data",
      message: cleanRuleMsg,
      code: "BUSINESS_RULE_VIOLATION",
      field,
      statusCode: statusCode || 422,
    };
  }

  // 4. Duplicate Record / Conflict (409 / 422)
  if (
    statusCode === 409 ||
    statusCode === 422 ||
    rawCode === "DUPLICATE_RECORD" ||
    rawCode === "CONFLICT" ||
    rawCode === "IDEMPOTENCY_CONFLICT" ||
    /sudah digunakan/i.test(rawMessage) ||
    /sudah terdaftar/i.test(rawMessage) ||
    /duplikat/i.test(rawMessage)
  ) {
    let detail = rawMessage;
    const isDuplicate =
      rawCode === "DUPLICATE_RECORD" ||
      /sudah digunakan/i.test(rawMessage) ||
      /sudah terdaftar/i.test(rawMessage) ||
      /duplikat/i.test(rawMessage) ||
      statusCode === 409;
    if (!detail || detail.startsWith("HTTP")) {
      detail = isDuplicate
        ? "Nomor invoice atau order sudah terdaftar dalam sistem."
        : "Data di server telah berubah. Muat ulang halaman sebelum mencoba kembali.";
    }
    const cleanMessage = detail.toLowerCase().startsWith("gagal menyimpan data")
      ? detail
      : `Gagal menyimpan data. ${detail}`;
    return {
      title: "Gagal Menyimpan Data",
      message: cleanMessage,
      code: rawCode === "CONFLICT" && !isDuplicate ? "CONFLICT" : "DUPLICATE_RECORD",
      statusCode: statusCode || 409,
    };
  }

  // 5. Validation Error (400)
  if (statusCode === 400 || rawCode === "VALIDATION_ERROR" || field) {
    let detail = rawMessage;
    if (!detail || detail.startsWith("HTTP") || detail === "VALIDATION_ERROR") {
      if (field === "customer") detail = "Nama Customer wajib diisi.";
      else if (field === "nopol") detail = "Nomor Polisi wajib diisi lengkap.";
      else if (field === "layanan") detail = "Jenis Pengurusan wajib dipilih.";
      else if (field === "nomorHP" || field === "phone") detail = "Nomor HP / WhatsApp wajib diisi (minimal 9 digit angka).";
      else detail = "Harap lengkapi semua kolom wajib dengan format yang benar.";
    }
    const cleanMessage = detail.toLowerCase().startsWith("gagal menyimpan data")
      ? detail
      : `Gagal menyimpan data. ${detail}`;
    return {
      title: "Gagal Menyimpan Data",
      message: cleanMessage,
      code: "VALIDATION_ERROR",
      field,
      statusCode: 400,
    };
  }

  // 6. Server Error (500, 502, 503, etc.)
  if ((statusCode && statusCode >= 500) || rawCode === "SERVER_ERROR" || rawCode === "INTERNAL_SERVER_ERROR") {
    return {
      title: "Gangguan Server",
      message: "Server gagal memproses permintaan. Silakan coba kembali beberapa saat lagi.",
      code: "SERVER_ERROR",
      statusCode: statusCode || 500,
    };
  }

  // Fallback generic failure
  const safeFallbackDetail = rawMessage && !rawMessage.startsWith("HTTP")
    ? rawMessage
    : "Terjadi kendala saat memproses transaksi.";
  const cleanFallback = safeFallbackDetail.toLowerCase().startsWith("gagal menyimpan data")
    ? safeFallbackDetail
    : `Gagal menyimpan data. ${safeFallbackDetail}`;

  return {
    title: "Gagal Menyimpan Data",
    message: cleanFallback,
    code: rawCode || "MUTATION_FAILED",
    field,
    statusCode,
  };
}

export interface MutationFeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  type: MutationFeedbackType;
  title: string;
  message: string;
  field?: string;
  code?: string;
}

export function MutationFeedbackDialog({
  open,
  onClose,
  type,
  title,
  message,
  field,
  code,
}: MutationFeedbackDialogProps) {
  const isSuccess = type === "success";

  const renderIcon = () => {
    if (isSuccess) {
      return (
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      );
    }

    if (code === "TIMEOUT" || code === "RATE_LIMITED") {
      return (
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Clock className="w-6 h-6" />
        </div>
      );
    }

    if (code === "NETWORK_ERROR") {
      return (
        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <WifiOff className="w-6 h-6" />
        </div>
      );
    }

    if (code === "FORBIDDEN" || code === "UNAUTHENTICATED") {
      return (
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
      );
    }

    if (code === "SERVER_ERROR") {
      return (
        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
          <ServerCrash className="w-6 h-6" />
        </div>
      );
    }

    return (
      <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
        <AlertCircle className="w-6 h-6" />
      </div>
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={(val) => !val && onClose()}>
      <AlertDialogContent className="border-border sm:max-w-md bg-card">
        <AlertDialogHeader className="sm:flex-row sm:items-start gap-3.5 text-left">
          {renderIcon()}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertDialogTitle
                className={`text-base font-semibold leading-snug ${
                  isSuccess
                    ? "text-foreground"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {title}
              </AlertDialogTitle>
              {field && (
                <Badge variant="outline" className="text-[10px] font-mono uppercase px-1.5 py-0">
                  Kolom: {field}
                </Badge>
              )}
            </div>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed pt-0.5 whitespace-pre-line">
              {message}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-4 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className={`h-8.5 px-4 text-xs font-semibold ${
              isSuccess
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {isSuccess ? "Selesai" : "Mengerti"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
