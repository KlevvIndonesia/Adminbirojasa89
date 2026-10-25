/**
 * Server-Side Order Pricing Sanity & Anti-Tampering Validator
 * Admin SUN89 — Biro Jasa Management System
 */

export interface OrderPricingPayload {
  totalBiaya?: number | null;
  totalEstimasi?: number | null;
  biayaJasa?: number | null;
  biayaSamsat?: number | null;
  nominalPkbTerakhir?: number | null;
  nominalSwdkllj?: number | null;
  biayaAntarJemput?: number | null;
  profit?: number | null;
  uangKeluar?: number | null;
  pkb?: number | null;
  swdkllj?: number | null;
  jenisKendaraan?: string | null;
  layanan?: string | null;
  payment?: {
    totalBiaya?: number | null;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

export interface PricingValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
  resolvedTotalBiaya: number;
  resolvedBiayaJasa: number;
  resolvedBiayaSamsat: number;
  taxFloor: number;
}

/** Minimum threshold for standard office handling fee when no vehicle tax applies (e.g. blokir, mutasi berkas, etc.) */
export const MIN_OFFICE_FEE = 20_000;

/** Tolerance ratio (10%) allowing for rounding differences and verified pro-rated adjustments */
export const TAX_FLOOR_TOLERANCE_RATIO = 0.9;

/**
 * Validates the pricing sanity and anti-tampering bounds of an incoming order payload.
 *
 * Rules:
 * 1. Basic Numerical Integrity:
 *    - totalBiaya must be a finite positive number (> 0).
 *    - biayaJasa must be finite and non-negative (>= 0).
 *    - biayaSamsat must be finite and non-negative (>= 0).
 *    - biayaAntarJemput (if present) must be non-negative (>= 0).
 * 2. Tax Pass-Through Threshold (Samsat Pass-Through Protection):
 *    - PKB + SWDKLLJ are pass-through taxes paid directly to the government/Samsat.
 *    - If nominalPkbTerakhir > 0, totalBiaya must be >= nominalPkbTerakhir * 0.9.
 *    - If totalBiaya is lower than this floor, the order is rejected as PRICING_MANIPULATION_DETECTED.
 * 3. Services Without PKB (e.g. Blokir Plat, STNK Hilang, etc.):
 *    - If nominalPkbTerakhir === 0 or omitted, totalBiaya must be >= 20.000 to prevent trivial/zero-price exploitation.
 */
export function validateOrderPricingSanity(payload: OrderPricingPayload): PricingValidationResult {
  if (!payload || typeof payload !== "object") {
    return {
      isValid: false,
      errorCode: "INVALID_PRICING",
      errorMessage: "Payload order pricing tidak valid.",
      resolvedTotalBiaya: 0,
      resolvedBiayaJasa: 0,
      resolvedBiayaSamsat: 0,
      taxFloor: 0,
    };
  }

  // 1. Resolve raw totalBiaya from canonical or alias fields
  const rawTotal =
    payload.payment?.totalBiaya ??
    payload.totalBiaya ??
    payload.totalEstimasi ??
    payload.biayaJasa;

  if (rawTotal === undefined || rawTotal === null || (rawTotal as any) === "") {
    return {
      isValid: false,
      errorCode: "INVALID_PRICING",
      errorMessage: "Total biaya / total estimasi wajib diisi dan harus berupa angka positif.",
      resolvedTotalBiaya: 0,
      resolvedBiayaJasa: 0,
      resolvedBiayaSamsat: 0,
      taxFloor: 0,
    };
  }

  const totalBiaya = Number(rawTotal);
  if (!Number.isFinite(totalBiaya) || totalBiaya <= 0) {
    return {
      isValid: false,
      errorCode: "INVALID_PRICING",
      errorMessage: "Total biaya order harus berupa bilangan positif lebih dari 0.",
      resolvedTotalBiaya: 0,
      resolvedBiayaJasa: 0,
      resolvedBiayaSamsat: 0,
      taxFloor: 0,
    };
  }

  // 2. Resolve and validate biayaJasa and biayaSamsat
  const rawJasa = payload.biayaJasa ?? payload.profit ?? 0;
  const biayaJasa = Number(rawJasa);
  if (!Number.isFinite(biayaJasa) || biayaJasa < 0) {
    return {
      isValid: false,
      errorCode: "INVALID_PRICING",
      errorMessage: "Biaya jasa tidak boleh bernilai negatif.",
      resolvedTotalBiaya: totalBiaya,
      resolvedBiayaJasa: 0,
      resolvedBiayaSamsat: 0,
      taxFloor: 0,
    };
  }

  const rawSamsat = payload.biayaSamsat ?? payload.uangKeluar ?? 0;
  const biayaSamsat = Number(rawSamsat);
  if (!Number.isFinite(biayaSamsat) || biayaSamsat < 0) {
    return {
      isValid: false,
      errorCode: "INVALID_PRICING",
      errorMessage: "Biaya Samsat tidak boleh bernilai negatif.",
      resolvedTotalBiaya: totalBiaya,
      resolvedBiayaJasa: biayaJasa,
      resolvedBiayaSamsat: 0,
      taxFloor: 0,
    };
  }

  const rawAntarJemput = payload.biayaAntarJemput ?? 0;
  const biayaAntarJemput = Number(rawAntarJemput);
  if (!Number.isFinite(biayaAntarJemput) || biayaAntarJemput < 0) {
    return {
      isValid: false,
      errorCode: "INVALID_PRICING",
      errorMessage: "Biaya antar jemput tidak boleh bernilai negatif.",
      resolvedTotalBiaya: totalBiaya,
      resolvedBiayaJasa: biayaJasa,
      resolvedBiayaSamsat: biayaSamsat,
      taxFloor: 0,
    };
  }

  // 3. Tax Pass-Through Threshold (Samsat Pass-Through Protection)
  const rawPkb = payload.nominalPkbTerakhir ?? payload.pkb ?? 0;
  const pkb = Number(rawPkb);

  if (Number.isFinite(pkb) && pkb > 0) {
    const taxFloor = pkb;
    const minimumAllowedTotal = pkb * TAX_FLOOR_TOLERANCE_RATIO;

    if (totalBiaya < minimumAllowedTotal) {
      return {
        isValid: false,
        errorCode: "PRICING_MANIPULATION_DETECTED",
        errorMessage: `Total biaya (Rp ${Math.round(totalBiaya).toLocaleString("id-ID")}) terdeteksi manipulasi harga; berada di bawah batas minimum komponen pajak PKB Samsat (Rp ${Math.round(pkb).toLocaleString("id-ID")}).`,
        resolvedTotalBiaya: totalBiaya,
        resolvedBiayaJasa: biayaJasa,
        resolvedBiayaSamsat: biayaSamsat,
        taxFloor,
      };
    }

    return {
      isValid: true,
      resolvedTotalBiaya: totalBiaya,
      resolvedBiayaJasa: biayaJasa,
      resolvedBiayaSamsat: biayaSamsat,
      taxFloor,
    };
  }

  // 4. Services Without PKB (Lain-Lain, Blokir Plat, STNK Hilang)
  if (totalBiaya < MIN_OFFICE_FEE) {
    return {
      isValid: false,
      errorCode: "PRICING_MANIPULATION_DETECTED",
      errorMessage: `Total biaya (Rp ${Math.round(totalBiaya).toLocaleString("id-ID")}) tidak memenuhi batas minimum biaya operasional loket kantor (Rp ${MIN_OFFICE_FEE.toLocaleString("id-ID")}).`,
      resolvedTotalBiaya: totalBiaya,
      resolvedBiayaJasa: biayaJasa,
      resolvedBiayaSamsat: biayaSamsat,
      taxFloor: MIN_OFFICE_FEE,
    };
  }

  return {
    isValid: true,
    resolvedTotalBiaya: totalBiaya,
    resolvedBiayaJasa: biayaJasa,
    resolvedBiayaSamsat: biayaSamsat,
    taxFloor: MIN_OFFICE_FEE,
  };
}
