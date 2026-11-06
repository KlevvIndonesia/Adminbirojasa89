/**
 * Canonical Alias Normalizer & Conflict Resolver
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Enforces Single Source of Truth across API boundaries:
 * - Detects conflicting aliases for sensitive/referential fields (returns HTTP 400 CONFLICTING_ALIASES)
 * - Deterministically canonicalizes properties
 * - Preserves falsy semantics for 0, false, "", and null
 * - Provides defense-in-depth security matching P1-B authorization rules
 */

import { ApiError } from "../middleware/errorHandler";

export interface AliasDefinition {
  canonicalKey: string;
  aliases: string[];
  isSensitive?: boolean;
  transform?: (val: any) => any;
  compare?: (a: any, b: any) => boolean;
}

/**
 * Universal value equality check that respects types and empty values
 */
function areValuesEquivalent(a: any, b: any, compareFn?: (x: any, y: any) => boolean): boolean {
  if (compareFn) {
    return compareFn(a, b);
  }

  if (a === b) return true;

  // Compare numbers
  if (typeof a === "number" || typeof b === "number") {
    const numA = Number(a);
    const numB = Number(b);
    return Number.isFinite(numA) && Number.isFinite(numB) && numA === numB;
  }

  // Compare booleans
  if (typeof a === "boolean" || typeof b === "boolean") {
    return Boolean(a) === Boolean(b);
  }

  // Compare strings (trimmed, case-insensitive for identifiers/codes)
  if (typeof a === "string" && typeof b === "string") {
    return a.trim() === b.trim();
  }

  return false;
}

/**
 * Resolves a group of aliases on an object.
 * If multiple aliases are present:
 * - If values match: canonicalizes cleanly.
 * - If values differ and isSensitive is true: throws ApiError(400, "CONFLICTING_ALIASES").
 * - If values differ and isSensitive is false: canonicalKey wins deterministically.
 */
export function resolveAliasGroup(
  target: Record<string, any>,
  def: AliasDefinition
): void {
  const allKeys = [def.canonicalKey, ...def.aliases.filter((k) => k !== def.canonicalKey)];
  const present: Array<{ key: string; value: any }> = [];

  for (const k of allKeys) {
    if (k in target && target[k] !== undefined) {
      present.push({ key: k, value: target[k] });
    }
  }

  if (present.length === 0) {
    return;
  }

  if (present.length === 1) {
    const single = present[0];
    const val = def.transform ? def.transform(single.value) : single.value;
    target[def.canonicalKey] = val;
    for (const k of def.aliases) {
      if (k !== def.canonicalKey && k in target) {
        delete target[k];
      }
    }
    return;
  }

  // Multiple aliases provided: check equivalence
  const firstVal = present[0].value;
  let hasConflict = false;
  let conflictingKey = "";
  let conflictingVal: any = null;

  for (let i = 1; i < present.length; i++) {
    if (!areValuesEquivalent(firstVal, present[i].value, def.compare)) {
      hasConflict = true;
      conflictingKey = present[i].key;
      conflictingVal = present[i].value;
      break;
    }
  }

  if (hasConflict) {
    if (def.isSensitive) {
      throw new ApiError(
        400,
        "CONFLICTING_ALIASES",
        `Payload berisi alias bertentangan untuk '${def.canonicalKey}': properti '${present[0].key}' ('${present[0].value}') berbeda dengan '${conflictingKey}' ('${conflictingVal}'). Harap gunakan satu nilai kanonis yang konsisten.`
      );
    }

    // Non-sensitive: prefer canonicalKey if explicitly provided, otherwise first present
    const canonicalEntry = present.find((p) => p.key === def.canonicalKey);
    const chosenVal = canonicalEntry ? canonicalEntry.value : firstVal;
    target[def.canonicalKey] = def.transform ? def.transform(chosenVal) : chosenVal;
    for (const k of def.aliases) {
      if (k !== def.canonicalKey && k in target) {
        delete target[k];
      }
    }
    return;
  }

  // All provided values are equivalent
  const val = def.transform ? def.transform(firstVal) : firstVal;
  target[def.canonicalKey] = val;
  for (const k of def.aliases) {
    if (k !== def.canonicalKey && k in target) {
      delete target[k];
    }
  }
}

// ─── PROTECTED FIELDS WITH ALL ALIAS VARIANTS (P1-B ENFORCEMENT) ────────────

export const PROTECTED_ROOT_FIELD_DESCRIPTIONS: Record<string, string> = {
  // Cost verification
  isCostVerified: "Verifikasi biaya order hanya dapat dilakukan melalui endpoint POST /api/orders/:orderNo/verify-cost.",
  costCompletenessStatus: "Status kelengkapan biaya order dikelola secara otomatis oleh sistem.",
  costVerifiedAt: "Waktu verifikasi biaya dikelola secara otomatis oleh sistem.",
  costVerifiedBy: "Petugas pemverifikasi biaya dikelola secara otomatis oleh sistem.",
  costSnapshot: "Snapshot biaya order dikelola secara otomatis oleh sistem.",
  costBreakdown: "Rincian biaya order dikelola secara otomatis oleh sistem.",
  // Supervisor & Document Approval Gating
  approvedBySpv: "Persetujuan Supervisor (approvedBySpv) hanya dapat ditetapkan melalui alur persetujuan resmi Stage 6.",
  spvApprovedAt: "Timestamp persetujuan Supervisor dilindungi oleh sistem.",
  spvName: "Nama Supervisor penyetujui dilindungi oleh sistem.",
  spvNotes: "Catatan persetujuan Supervisor dilindungi oleh sistem.",
  stage6Approved: "Status persetujuan dokumen Stage 6 hanya dapat diubah melalui endpoint persetujuan resmi.",
  stage6ApprovedBy: "Identitas penyetujui Stage 6 dilindungi oleh sistem.",
  stage6ApprovedAt: "Timestamp persetujuan Stage 6 dilindungi oleh sistem.",
  stage5Verified: "Status verifikasi dokumen Stage 5 hanya dapat diubah melalui endpoint verifikasi resmi.",
  stage5VerifiedBy: "Identitas verifikator Stage 5 dilindungi oleh sistem.",
  stage5VerifiedAt: "Timestamp verifikasi Stage 5 dilindungi oleh sistem.",
  approvedDocsSnapshot: "Snapshot dokumen yang disetujui hanya dapat ditetapkan melalui alur approval resmi.",
  documentApproval: "Struktur documentApproval dilindungi dan hanya dapat dimodifikasi melalui endpoint /approve-documents.",
  documentsVerified: "Status verifikasi dokumen (documentsVerified) hanya dapat diubah melalui alur resmi.",
  isVerified: "Status verifikasi biaya/dokumen (isVerified) hanya dapat diubah melalui alur verifikasi resmi.",

  // Stage & Workflow Position
  currentStep: "Posisi tahapan order (currentStep) hanya dapat dimajukan atau dimundurkan melalui endpoint /advance atau /rollback.",
  currentStageName: "Nama tahapan order (currentStageName) hanya dapat diubah melalui endpoint /advance atau /rollback.",
  stageBeforeCancel: "Status tahapan sebelum pembatalan dilindungi oleh sistem.",

  // Order Identity & Lifecycle
  orderNo: "Nomor order bersifat immutable dan tidak dapat diubah.",
  isArchived: "Status arsip order hanya dapat diubah melalui endpoint /archive.",
  isCancelled: "Pembatalan order hanya dapat dilakukan melalui endpoint /cancel.",
  cancelledAt: "Timestamp pembatalan dilindungi oleh sistem.",
  cancelledBy: "Identitas pembatal order dilindungi oleh sistem.",
  cancellationReason: "Alasan pembatalan hanya dapat diisi melalui endpoint /cancel.",
  createdAt: "Timestamp pembuatan order bersifat immutable.",
  updatedAt: "Timestamp pembaruan dikelola secara otomatis oleh server.",

  // Financial Reconciliation & Settlements
  finalCost: "Biaya final hanya dapat ditetapkan melalui alur rekonsiliasi dan supervisi resmi.",
  finalCostBreakdown: "Rincian biaya final hanya dapat diubah melalui alur rekonsiliasi resmi.",
  finalBiayaJasa: "Biaya jasa final hanya dapat ditetapkan melalui alur rekonsiliasi resmi.",
  finalPkb: "PKB final hanya dapat ditetapkan melalui alur rekonsiliasi resmi.",
  finalSwdkllj: "SWDKLLJ final hanya dapat ditetapkan melalui alur rekonsiliasi resmi.",
  finalDendaSwdkllj: "Denda SWDKLLJ final hanya dapat ditetapkan melalui alur rekonsiliasi resmi.",
  finalMutasiKeluar: "Mutasi keluar final hanya dapat ditetapkan melalui alur rekonsiliasi resmi.",
  finalMutasiMasuk: "Mutasi masuk final hanya dapat ditetapkan melalui alur rekonsiliasi resmi.",
  finalBiayaLainnya: "Biaya lainnya final hanya dapat ditetapkan melalui alur rekonsiliasi resmi.",
  settlementCondition: "Kondisi settlement keuangan dikelola otomatis oleh sistem.",
  refundStatus: "Status pengembalian/cashback dikelola otomatis oleh sistem keuangan.",
  refundAmount: "Nominal refund dilindungi oleh sistem keuangan.",
  refundProcessedAt: "Timestamp proses refund dilindungi oleh sistem.",
  refundProcessedBy: "Petugas proses refund dilindungi oleh sistem.",
  totalBiaya: "Total biaya order tidak dapat diubah sepihak melalui endpoint generik.",
  biayaSamsat: "Biaya Samsat dikelola melalui modul pricing dan rekonsiliasi resmi.",
  uangKeluar: "Uang keluar dikelola melalui transaksi pengeluaran dan kas.",
  profit: "Profit margin dikelola otomatis oleh sistem keuangan.",

  // Root-level payment columns that map directly to physical SQLite columns
  paymentStatus: "Status pembayaran order hanya dapat dimutasi melalui transaksi pembayaran kas/invoice resmi.",
};

export const PROTECTED_ROOT_ALIASES_MAP: Record<string, string> = {
  // Service Requirements Snapshot protection (Patch D)
  serviceRequirementsSnapshot: "serviceRequirementsSnapshot",
  service_requirements_snapshot: "serviceRequirementsSnapshot",
  requirementsSnapshot: "serviceRequirementsSnapshot",
  requirements_snapshot: "serviceRequirementsSnapshot",

  // Cost verification & pricing completeness
  isCostVerified: "isCostVerified",
  is_cost_verified: "isCostVerified",
  costCompletenessStatus: "costCompletenessStatus",
  cost_completeness_status: "costCompletenessStatus",
  costVerifiedAt: "costVerifiedAt",
  cost_verified_at: "costVerifiedAt",
  costVerifiedBy: "costVerifiedBy",
  cost_verified_by: "costVerifiedBy",
  costSnapshot: "costSnapshot",
  cost_snapshot: "costSnapshot",
  costBreakdown: "costBreakdown",
  cost_breakdown: "costBreakdown",
  // Supervisor
  approvedBySpv: "approvedBySpv",
  approved_by_spv: "approvedBySpv",
  spvApprovedAt: "spvApprovedAt",
  spv_approved_at: "spvApprovedAt",
  spvName: "spvName",
  spv_name: "spvName",
  spvNotes: "spvNotes",
  spv_notes: "spvNotes",
  stage6Approved: "stage6Approved",
  stage_6_approved: "stage6Approved",
  stage6ApprovedBy: "stage6ApprovedBy",
  stage_6_approved_by: "stage6ApprovedBy",
  stage6ApprovedAt: "stage6ApprovedAt",
  stage_6_approved_at: "stage6ApprovedAt",
  stage5Verified: "stage5Verified",
  stage_5_verified: "stage5Verified",
  stage5VerifiedBy: "stage5VerifiedBy",
  stage_5_verified_by: "stage5VerifiedBy",
  stage5VerifiedAt: "stage5VerifiedAt",
  stage_5_verified_at: "stage5VerifiedAt",
  approvedDocsSnapshot: "approvedDocsSnapshot",
  approved_docs_snapshot: "approvedDocsSnapshot",
  documentApproval: "documentApproval",
  document_approval: "documentApproval",
  documentsVerified: "documentsVerified",
  documents_verified: "documentsVerified",
  isVerified: "isVerified",
  is_verified: "isVerified",

  // Workflow & stages
  currentStep: "currentStep",
  current_step: "currentStep",
  step: "currentStep",
  tahap: "currentStep",
  currentStageName: "currentStageName",
  current_stage_name: "currentStageName",
  stage: "currentStageName",
  stage_name: "currentStageName",
  stageBeforeCancel: "stageBeforeCancel",
  stage_before_cancel: "stageBeforeCancel",

  // Identity & lifecycle
  orderNo: "orderNo",
  order_no: "orderNo",
  isArchived: "isArchived",
  is_archived: "isArchived",
  isCancelled: "isCancelled",
  is_cancelled: "isCancelled",
  cancelledAt: "cancelledAt",
  cancelled_at: "cancelledAt",
  cancelledBy: "cancelledBy",
  cancelled_by: "cancelledBy",
  cancellationReason: "cancellationReason",
  cancellation_reason: "cancellationReason",
  createdAt: "createdAt",
  created_at: "createdAt",
  updatedAt: "updatedAt",
  updated_at: "updatedAt",

  // Financial reconciliation
  finalCost: "finalCost",
  final_cost: "finalCost",
  finalCostBreakdown: "finalCostBreakdown",
  final_cost_breakdown: "finalCostBreakdown",
  finalBiayaJasa: "finalBiayaJasa",
  final_biaya_jasa: "finalBiayaJasa",
  finalPkb: "finalPkb",
  final_pkb: "finalPkb",
  finalSwdkllj: "finalSwdkllj",
  final_swdkllj: "finalSwdkllj",
  finalDendaSwdkllj: "finalDendaSwdkllj",
  final_denda_swdkllj: "finalDendaSwdkllj",
  finalMutasiKeluar: "finalMutasiKeluar",
  final_mutasi_keluar: "finalMutasiKeluar",
  finalMutasiMasuk: "finalMutasiMasuk",
  final_mutasi_masuk: "finalMutasiMasuk",
  finalBiayaLainnya: "finalBiayaLainnya",
  final_biaya_lainnya: "finalBiayaLainnya",
  settlementCondition: "settlementCondition",
  settlement_condition: "settlementCondition",
  refundStatus: "refundStatus",
  refund_status: "refundStatus",
  refundAmount: "refundAmount",
  refund_amount: "refundAmount",
  refundProcessedAt: "refundProcessedAt",
  refund_processed_at: "refundProcessedAt",
  refundProcessedBy: "refundProcessedBy",
  refund_processed_by: "refundProcessedBy",
  totalBiaya: "totalBiaya",
  total_biaya: "totalBiaya",
  biayaSamsat: "biayaSamsat",
  biaya_samsat: "biayaSamsat",
  uangKeluar: "uangKeluar",
  uang_keluar: "uangKeluar",
  profit: "profit",
  profit_final: "profit",

  // Direct root payment tampers
  paymentStatus: "paymentStatus",
  payment_status: "paymentStatus",
  statusPembayaran: "paymentStatus",
  status_pembayaran: "paymentStatus",
  dibayar: "paymentStatus",
  terbayar: "paymentStatus",
  kurang: "paymentStatus",
};

export const PROTECTED_PAYMENT_FIELD_DESCRIPTIONS: Record<string, string> = {
  isCostVerified: "Status verifikasi biaya order dilindungi oleh sistem.",
  costCompletenessStatus: "Status kelengkapan biaya order dilindungi oleh sistem.",
  costVerifiedAt: "Waktu verifikasi biaya order dilindungi oleh sistem.",
  costVerifiedBy: "Petugas verifikator biaya order dilindungi oleh sistem.",
  isPaymentVerified: "Status verifikasi pembayaran hanya dapat diubah melalui endpoint /verify-payment.",
  paymentVerifiedAt: "Timestamp verifikasi pembayaran dilindungi oleh sistem.",
  paymentVerifiedBy: "Identitas verifikator pembayaran dilindungi oleh sistem.",
  statusPembayaran: "Status pembayaran order hanya dapat dimutasi melalui transaksi pembayaran kas/invoice resmi.",
  dibayar: "Saldo terbayar hanya dapat diperbarui melalui pencatatan pembayaran resmi.",
  kurang: "Sisa tagihan dikalkulasi otomatis oleh sistem keuangan.",
  totalBiaya: "Total tagihan pembayaran tidak dapat diubah melalui endpoint generik.",
  totalEstimasi: "Total estimasi pembayaran dilindungi oleh sistem.",
  nominalDibayarAwal: "Nominal pembayaran awal hanya dapat diverifikasi melalui /verify-payment.",
  nominalPembayaranAwalTerkonfirmasi: "Nominal terkonfirmasi dilindungi dan diverifikasi melalui /verify-payment.",
  paymentRecords: "Riwayat rekaman pembayaran hanya dapat ditambah melalui transaksi pembayaran resmi.",
  riwayatKoreksiPembayaran: "Riwayat koreksi pembayaran dikelola otomatis oleh sistem verifikasi.",
  settlementCondition: "Kondisi settlement keuangan dikelola otomatis oleh sistem.",
  refundStatus: "Status refund pembayaran dikelola otomatis oleh sistem keuangan.",
  refundAmount: "Nominal refund dilindungi oleh sistem keuangan.",
  refundProcessedAt: "Timestamp refund dilindungi oleh sistem.",
  refundProcessedBy: "Petugas refund dilindungi oleh sistem.",
  overpayment: "Kelebihan pembayaran dikalkulasi otomatis oleh sistem keuangan.",
};

export const PROTECTED_PAYMENT_ALIASES_MAP: Record<string, string> = {
  // Cost verification in payment
  isCostVerified: "isCostVerified",
  is_cost_verified: "isCostVerified",
  costCompletenessStatus: "costCompletenessStatus",
  cost_completeness_status: "costCompletenessStatus",
  costVerifiedAt: "costVerifiedAt",
  cost_verified_at: "costVerifiedAt",
  costVerifiedBy: "costVerifiedBy",
  cost_verified_by: "costVerifiedBy",
  isPaymentVerified: "isPaymentVerified",
  is_payment_verified: "isPaymentVerified",
  isVerified: "isPaymentVerified",
  is_verified: "isPaymentVerified",
  paymentVerifiedAt: "paymentVerifiedAt",
  payment_verified_at: "paymentVerifiedAt",
  paymentVerifiedBy: "paymentVerifiedBy",
  payment_verified_by: "paymentVerifiedBy",
  statusPembayaran: "statusPembayaran",
  status_pembayaran: "statusPembayaran",
  paymentStatus: "statusPembayaran",
  payment_status: "statusPembayaran",
  status: "statusPembayaran",
  dibayar: "dibayar",
  terbayar: "dibayar",
  paid: "dibayar",
  kurang: "kurang",
  sisa: "kurang",
  remaining: "kurang",
  totalBiaya: "totalBiaya",
  total_biaya: "totalBiaya",
  totalEstimasi: "totalEstimasi",
  total_estimasi: "totalEstimasi",
  nominalDibayarAwal: "nominalDibayarAwal",
  nominal_dibayar_awal: "nominalDibayarAwal",
  nominalPembayaranAwalTerkonfirmasi: "nominalPembayaranAwalTerkonfirmasi",
  nominal_pembayaran_awal_terkonfirmasi: "nominalPembayaranAwalTerkonfirmasi",
  paymentRecords: "paymentRecords",
  payment_records: "paymentRecords",
  riwayatKoreksiPembayaran: "riwayatKoreksiPembayaran",
  riwayat_koreksi_pembayaran: "riwayatKoreksiPembayaran",
  settlementCondition: "settlementCondition",
  settlement_condition: "settlementCondition",
  refundStatus: "refundStatus",
  refund_status: "refundStatus",
  refundAmount: "refundAmount",
  refund_amount: "refundAmount",
  refundProcessedAt: "refundProcessedAt",
  refund_processed_at: "refundProcessedAt",
  refundProcessedBy: "refundProcessedBy",
  refund_processed_by: "refundProcessedBy",
  overpayment: "overpayment",
};

/**
 * Checks for any protected root or payment field violations in the payload,
 * checking all camelCase, snake_case, and alias variants.
 * Throws ApiError(403, "PROTECTED_FIELD_VIOLATION") if found.
 */
export function assertNoProtectedFieldViolations(body: Record<string, any>, user?: { role?: string } | null): void {
  const userRole = (user?.role || "").toLowerCase().trim();
  const isMessenger = userRole === "messenger";

  // PATCH B: Strict Zero Free-Text Notes Enforcement for Messenger
  if (isMessenger) {
    const forbiddenMessengerFields = [
      "messengerTaskNotes", "messenger_task_notes",
      "samsatPickupNotes", "samsat_pickup_notes",
      "catatanKendala", "catatan_kendala",
      "catatanOrder", "catatan_order",
      "catatanPenjadwalan", "catatan_penjadwalan",
      "catatanSamsat", "catatan_samsat",
      "catatanPengantaran", "catatan_pengantaran",
    ];
    for (const field of forbiddenMessengerFields) {
      if (body[field] !== undefined) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `Field '${field}' tidak diizinkan diubah oleh Messenger. Free-text operational notes dilarang dan instruksi admin dikelola khusus oleh Admin.`
        );
      }
    }
    if (body.pickupProof && typeof body.pickupProof === "object") {
      if (body.pickupProof.notes || body.pickupProof.catatanKendala) {
        throw new ApiError(403, "FORBIDDEN", "Catatan bebas pada pickupProof tidak diizinkan bagi Messenger.");
      }
    }
    if (body.deliveryHandover && typeof body.deliveryHandover === "object") {
      if (body.deliveryHandover.notes) {
        throw new ApiError(403, "FORBIDDEN", "Catatan bebas pada deliveryHandover tidak diizinkan bagi Messenger.");
      }
    }
    if (body.deliveryProof && typeof body.deliveryProof === "object") {
      if (body.deliveryProof.notes) {
        throw new ApiError(403, "FORBIDDEN", "Catatan bebas pada deliveryProof tidak diizinkan bagi Messenger.");
      }
    }
    if (Array.isArray(body.messengerComponentProgress)) {
      for (const comp of body.messengerComponentProgress) {
        if (comp && typeof comp === "object" && comp.note) {
          throw new ApiError(403, "FORBIDDEN", "Catatan bebas pada messengerComponentProgress tidak diizinkan bagi Messenger.");
        }
      }
    }
    if (Array.isArray(body.additionalProcesses)) {
      for (const proc of body.additionalProcesses) {
        if (proc && typeof proc === "object" && proc.note) {
          throw new ApiError(403, "FORBIDDEN", "Catatan bebas pada additionalProcesses tidak diizinkan bagi Messenger.");
        }
      }
    }
  }

  const isAuthorizedRole = Boolean(
    user?.role && ["administrator", "admin", "finance", "svp"].includes(user.role.toLowerCase().trim())
  );

  // 1. Root fields check
  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined && key in PROTECTED_ROOT_ALIASES_MAP) {
      const canonical = PROTECTED_ROOT_ALIASES_MAP[key];

      // If authorized staff (admin/finance/svp) updates operational & financial parameters via authorized edit form, permit financial fields
      if (isAuthorizedRole) {
        const allowedFinancialFields = new Set([
          "totalBiaya",
          "biayaSamsat",
          "uangKeluar",
          "profit",
          "biayaJasa",
          "biayaAntarJemput",
          "biayaLainnya",
          "namaPenerimaKeluar",
          "bankUangKeluar",
          "metodePembayaranKeluar",
          "paymentStatus",
          "statusPembayaran",
          "dibayar",
          "kurang",
          "overpayment",
        ]);
        if (allowedFinancialFields.has(canonical) || allowedFinancialFields.has(key)) {
          continue;
        }
      }

      const desc = PROTECTED_ROOT_FIELD_DESCRIPTIONS[canonical] || "Field ini dilindungi oleh sistem.";
      throw new ApiError(
        403,
        "PROTECTED_FIELD_VIOLATION",
        `Pelanggaran Otorisasi: Field '${key}' (alias kanonis: '${canonical}') dilindungi. ${desc}`
      );
    }
  }

  // 2. Payment sub-object check
  if (body.payment && typeof body.payment === "object" && !Array.isArray(body.payment)) {
    for (const [payKey, payVal] of Object.entries(body.payment)) {
      if (payVal !== undefined && payKey in PROTECTED_PAYMENT_ALIASES_MAP) {
        const canonical = PROTECTED_PAYMENT_ALIASES_MAP[payKey];

        if (isAuthorizedRole) {
          const allowedPaymentFields = new Set([
            "totalBiaya",
            "totalEstimasi",
            "statusPembayaran",
            "dibayar",
            "kurang",
            "overpayment",
            "metodePembayaran",
            "namaBank",
            "noRekening",
            "namaRekening",
            "tipePembayaran",
          ]);
          if (allowedPaymentFields.has(canonical) || allowedPaymentFields.has(payKey)) {
            continue;
          }
        }

        const desc = PROTECTED_PAYMENT_FIELD_DESCRIPTIONS[canonical] || "Field payment ini dilindungi oleh sistem.";
        throw new ApiError(
          403,
          "PROTECTED_FIELD_VIOLATION",
          `Pelanggaran Otorisasi: Properti 'payment.${payKey}' (alias kanonis: 'payment.${canonical}') dilindungi. ${desc}`
        );
      }
    }
  }
}

// ─── DOMAIN NORMALIZATION SPECIFICATIONS ────────────────────────────────────

/**
 * Order input aliases specification
 */
export const ORDER_ALIAS_DEFS: AliasDefinition[] = [
  { canonicalKey: "customer", aliases: ["customer", "customerName", "customer_name"], isSensitive: true },
  { canonicalKey: "nomorHP", aliases: ["nomorHP", "nomorHp", "nomor_hp", "phone", "noHp"], isSensitive: true },
  { canonicalKey: "layanan", aliases: ["layanan", "serviceType", "service_type", "tipe_layanan"], isSensitive: true },
  { canonicalKey: "nopol", aliases: ["nopol", "platNomor", "plat_nomor"], isSensitive: true },
  {
    canonicalKey: "biayaJasa",
    aliases: ["biayaJasa", "biaya_jasa"],
    isSensitive: true,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
  },
  {
    canonicalKey: "biayaAntarJemput",
    aliases: ["biayaAntarJemput", "biaya_antar_jemput"],
    isSensitive: true,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
  },
  {
    canonicalKey: "biayaLainnya",
    aliases: ["biayaLainnya", "biaya_lainnya"],
    isSensitive: false,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : 0),
  },
  {
    canonicalKey: "biayaSamsat",
    aliases: ["biayaSamsat", "biaya_samsat", "uangKeluar", "uang_keluar"],
    isSensitive: false,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
  },
  {
    canonicalKey: "totalBiaya",
    aliases: ["totalBiaya", "total_biaya", "totalEstimasi", "total_estimasi"],
    isSensitive: false,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
  },
  { canonicalKey: "namaPemilik", aliases: ["namaPemilik", "nama_pemilik"], isSensitive: false },
  { canonicalKey: "jenisKendaraan", aliases: ["jenisKendaraan", "jenis_kendaraan", "tipeKendaraan", "tipe_kendaraan"], isSensitive: false },
  { canonicalKey: "tahunKendaraan", aliases: ["tahunKendaraan", "tahun_kendaraan"], isSensitive: false },
  { canonicalKey: "wilayahSamsatAsal", aliases: ["wilayahSamsatAsal", "wilayah_samsat_asal", "samsatAsal", "samsat_asal", "samsat"], isSensitive: false },
  { canonicalKey: "wilayahSamsatTujuan", aliases: ["wilayahSamsatTujuan", "wilayah_samsat_tujuan", "samsatTujuan", "samsat_tujuan"], isSensitive: false },
  { canonicalKey: "tanggalMasukBerkas", aliases: ["tanggalMasukBerkas", "tanggal_masuk_berkas", "tglMasukBerkas", "tgl_masuk_berkas"], isSensitive: false },
  { canonicalKey: "alamatPenjemputan", aliases: ["alamatPenjemputan", "alamat_penjemputan"], isSensitive: false },
  { canonicalKey: "alamatPengantaran", aliases: ["alamatPengantaran", "alamat_pengantaran"], isSensitive: false },
  { canonicalKey: "alamat", aliases: ["alamat", "address"], isSensitive: false },
  { canonicalKey: "metodeLayanan", aliases: ["metodeLayanan", "metode_layanan"], isSensitive: false },
  { canonicalKey: "catatanOrder", aliases: ["catatanOrder", "catatan_order", "catatan", "keterangan"], isSensitive: false },
  { canonicalKey: "alasanPending", aliases: ["alasanPending", "alasan_pending", "alasan"], isSensitive: false },
  { canonicalKey: "namaPenerimaKeluar", aliases: ["namaPenerimaKeluar", "namaPemilikRekeningKeluar", "nama_penerima_keluar", "namaPenerima", "nama_penerima"], isSensitive: false },
  { canonicalKey: "bankUangKeluar", aliases: ["bankUangKeluar", "bank_uang_keluar"], isSensitive: false },
  { canonicalKey: "metodePembayaranKeluar", aliases: ["metodePembayaranKeluar", "metode_pembayaran_keluar"], isSensitive: false },
  { canonicalKey: "noRekeningPengirim", aliases: ["noRekeningPengirim", "nomorRekeningPengirim"], isSensitive: false },
  { canonicalKey: "noRekeningPenerima", aliases: ["noRekeningPenerima", "nomorRekeningPenerima"], isSensitive: false },
  { canonicalKey: "stafPengirim", aliases: ["stafPengirim", "staf_pengirim"], isSensitive: false },
  { canonicalKey: "noInvoice", aliases: ["noInvoice", "no_invoice", "invoiceNo", "invoice"], isSensitive: false },
  { canonicalKey: "tanggalInvoice", aliases: ["tanggalInvoice", "tanggal_invoice"], isSensitive: false },
  { canonicalKey: "bpkb", aliases: ["bpkb", "dokumenBPKB", "dokumen_bpkb"], isSensitive: false },
  { canonicalKey: "ttbBPKB", aliases: ["ttbBPKB", "ttb_bpkb", "nomorTTBBPKB", "nomor_ttb_bpkb"], isSensitive: false },
  { canonicalKey: "statusBPKB", aliases: ["statusBPKB", "status_bpkb"], isSensitive: false },
  { canonicalKey: "statusPengerjaan", aliases: ["statusPengerjaan", "status_pengerjaan", "salesSnapshotStatus"], isSensitive: false },
  { canonicalKey: "kepemilikanKendaraan", aliases: ["kepemilikanKendaraan", "statusKepemilikan"], isSensitive: false },
  { canonicalKey: "tanggalPengeluaranSamsat", aliases: ["tanggalPengeluaranSamsat", "tanggalPengeluaran", "tanggalUangKeluar"], isSensitive: false },
  { canonicalKey: "tanggalUangMasuk", aliases: ["tanggalUangMasuk", "tanggal_uang_masuk", "tanggalBayar"], isSensitive: false },
];

/**
 * Normalizes Order payload in-place or returns a copy.
 */
export function normalizeOrderPayload<T extends Record<string, any>>(body: T): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  // Strip client-forged service requirements snapshot (Patch D)
  delete (body as any).serviceRequirementsSnapshot;
  delete (body as any).service_requirements_snapshot;
  delete (body as any).requirementsSnapshot;
  delete (body as any).requirements_snapshot;

  for (const def of ORDER_ALIAS_DEFS) {
    resolveAliasGroup(body, def);
  }

  return body;
}

/**
 * Invoice Payment input aliases specification
 */
export const INVOICE_PAYMENT_ALIAS_DEFS: AliasDefinition[] = [
  {
    canonicalKey: "amount",
    aliases: ["amount", "nominal", "jumlah"],
    isSensitive: true,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
  },
  { canonicalKey: "metodePembayaran", aliases: ["metodePembayaran", "metode_pembayaran", "paymentMethod"], isSensitive: false },
  { canonicalKey: "nomorRekening", aliases: ["nomorRekening", "noRekening", "nomor_rekening"], isSensitive: false },
  { canonicalKey: "namaBank", aliases: ["namaBank", "bank"], isSensitive: false },
  { canonicalKey: "documentId", aliases: ["documentId", "document_id"], isSensitive: true },
  { canonicalKey: "catatan", aliases: ["catatan", "notes", "keterangan"], isSensitive: false },
  { canonicalKey: "idempotencyKey", aliases: ["idempotencyKey", "clientRequestId", "transactionRef"], isSensitive: false },
];

export function normalizeInvoicePaymentPayload<T extends Record<string, any>>(body: T): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  for (const def of INVOICE_PAYMENT_ALIAS_DEFS) {
    resolveAliasGroup(body, def);
  }

  return body;
}

/**
 * Document Upload input aliases specification
 */
export const DOCUMENT_UPLOAD_ALIAS_DEFS: AliasDefinition[] = [
  { canonicalKey: "orderNo", aliases: ["orderNo", "order_no"], isSensitive: true },
  { canonicalKey: "invoiceId", aliases: ["invoiceId", "invoice_id"], isSensitive: true },
  { canonicalKey: "documentType", aliases: ["documentType", "type", "tipe_dokumen"], isSensitive: true },
];

export function normalizeDocumentUploadPayload<T extends Record<string, any>>(body: T): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  for (const def of DOCUMENT_UPLOAD_ALIAS_DEFS) {
    resolveAliasGroup(body, def);
  }

  return body;
}

/**
 * Reimbursement input aliases specification
 */
export const REIMBURSEMENT_ALIAS_DEFS: AliasDefinition[] = [
  { canonicalKey: "employeeId", aliases: ["employeeId", "employee_id", "id_pegawai"], isSensitive: true },
  { canonicalKey: "messengerName", aliases: ["messengerName", "messenger_name", "messenger", "nama"], isSensitive: true },
  { canonicalKey: "orderNo", aliases: ["orderNo", "order_no"], isSensitive: true },
  {
    canonicalKey: "amount",
    aliases: ["amount", "nominal"],
    isSensitive: true,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
  },
  { canonicalKey: "date", aliases: ["date", "tanggal"], isSensitive: true },
  { canonicalKey: "category", aliases: ["category", "kategori"], isSensitive: false },
  { canonicalKey: "note", aliases: ["note", "catatan", "keterangan"], isSensitive: false },
  { canonicalKey: "receiptUrl", aliases: ["receiptUrl", "receipt_url"], isSensitive: false },
  { canonicalKey: "receiptName", aliases: ["receiptName", "receipt_name"], isSensitive: false },
];

export function normalizeReimbursementPayload<T extends Record<string, any>>(body: T): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  for (const def of REIMBURSEMENT_ALIAS_DEFS) {
    resolveAliasGroup(body, def);
  }

  return body;
}

/**
 * Service Pricing (Biaya Layanan) aliases specification
 */
export const SERVICE_PRICING_ALIAS_DEFS: AliasDefinition[] = [
  { canonicalKey: "serviceName", aliases: ["serviceName", "layanan", "service_name"], isSensitive: true },
  { canonicalKey: "wilayah", aliases: ["wilayah", "namaSamsat"], isSensitive: true },
  { canonicalKey: "serviceId", aliases: ["serviceId", "service_id"], isSensitive: true },
  { canonicalKey: "samsatId", aliases: ["samsatId", "samsat_id"], isSensitive: true },
  {
    canonicalKey: "biayaJasa",
    aliases: ["biayaJasa", "biaya_jasa", "biayaJasaLengkap"],
    isSensitive: true,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
  },
  {
    canonicalKey: "biayaAntarJemput",
    aliases: ["biayaAntarJemput", "biaya_antar_jemput"],
    isSensitive: true,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
  },
];

export function normalizeServicePricingPayload<T extends Record<string, any>>(body: T): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  for (const def of SERVICE_PRICING_ALIAS_DEFS) {
    resolveAliasGroup(body, def);
  }

  return body;
}

/**
 * Samsat Cost Item aliases specification
 */
export const SAMSAT_PRICING_ALIAS_DEFS: AliasDefinition[] = [
  { canonicalKey: "namaItem", aliases: ["namaItem", "name", "nama_item"], isSensitive: true },
  { canonicalKey: "kategori", aliases: ["kategori", "category"], isSensitive: false },
  { canonicalKey: "tipeKendaraan", aliases: ["tipeKendaraan", "tipe_kendaraan", "vehicleType"], isSensitive: false },
  {
    canonicalKey: "biayaDasar",
    aliases: ["biayaDasar", "basePrice", "biaya_dasar"],
    isSensitive: true,
    transform: (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
  },
  { canonicalKey: "deskripsi", aliases: ["deskripsi", "description"], isSensitive: false },
];

export function normalizeSamsatPricingPayload<T extends Record<string, any>>(body: T): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  for (const def of SAMSAT_PRICING_ALIAS_DEFS) {
    resolveAliasGroup(body, def);
  }

  return body;
}
