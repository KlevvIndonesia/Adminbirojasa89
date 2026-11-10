/**
 * Canonical Pricing Resolver (National Default + Per-Samsat Override)
 * Admin SUN89 — Biro Jasa Management System
 *
 * Implements strict 2-stage hierarchy:
 * 1. Master Catalog Gate:
 *    - Master deactivation (is_active = 0) -> DISABLED_ITEM (overrides local override)
 * 2. Tariff Gate:
 *    - Valid active override -> CONFIGURED_OVERRIDE
 *    - Inactive override or absent -> falls back to National Default
 *    - Corrupted override (negative, NaN, non-integer) -> CORRUPTED_OVERRIDE (Fail-Closed)
 *    - Valid default -> CONFIGURED_DEFAULT
 *    - Unconfigured -> NOT_CONFIGURED
 *    - Destination unselected -> PENDING_DESTINATION
 */

import {
  SamsatCostItem,
  ResolvedTariff,
  ServiceFeeResolutionInput,
  ResolvedServiceFee,
} from "./types";

export interface ResolveTariffOptions {
  masterItem?: SamsatCostItem | null;
  override?: {
    id?: string | null;
    nominal?: number | null;
    is_active?: number | boolean | null;
    isActive?: boolean | null;
  } | null;
  samsatId: string;
  jurisdiction?: "ASAL" | "TUJUAN" | "STANDARD";
  isDestinationPending?: boolean;
}

export function resolveTariff({
  masterItem,
  override,
  samsatId,
  jurisdiction = "STANDARD",
  isDestinationPending = false,
}: ResolveTariffOptions): ResolvedTariff {
  const pricingItemId = masterItem?.id || "";
  const namaItem = masterItem?.name || masterItem?.namaItem || "";
  const category = masterItem?.category || masterItem?.kategori || "";
  const tipeKendaraan = masterItem?.tipeKendaraan || "Mobil";
  const nationalDefaultPrice =
    masterItem?.basePrice !== undefined && masterItem.basePrice !== null
      ? Number(masterItem.basePrice)
      : (masterItem?.biayaDasar !== undefined && masterItem.biayaDasar !== null ? Number(masterItem.biayaDasar) : null);
  const overridePrice =
    override?.nominal !== undefined && override.nominal !== null
      ? Number(override.nominal)
      : null;

  // 1. Destination pending check
  const destinationPending =
    isDestinationPending ||
    (jurisdiction === "TUJUAN" && (!samsatId || samsatId === "" || samsatId === "-"));

  if (destinationPending) {
    return {
      pricingItemId,
      namaItem,
      category,
      tipeKendaraan,
      samsatId: samsatId || "-",
      jurisdiction,
      effectivePrice: null,
      source: "NONE",
      status: "PENDING_DESTINATION",
      isExplicitZero: false,
      isMasterActive: masterItem ? (masterItem.active !== false && masterItem.isActive !== false) : false,
      overrideId: null,
      nationalDefaultPrice,
      overridePrice: null,
    };
  }

  // 2. Master Catalog Gate
  if (!masterItem) {
    return {
      pricingItemId,
      namaItem,
      category,
      tipeKendaraan,
      samsatId,
      jurisdiction,
      effectivePrice: null,
      source: "NONE",
      status: "NOT_CONFIGURED",
      isExplicitZero: false,
      isMasterActive: false,
      overrideId: null,
      nationalDefaultPrice: null,
      overridePrice: null,
    };
  }

  const isMasterActive = masterItem.active !== false && masterItem.isActive !== false;
  if (!isMasterActive) {
    // Master deactivation strictly overrides any local override
    return {
      pricingItemId,
      namaItem,
      category,
      tipeKendaraan,
      samsatId,
      jurisdiction,
      effectivePrice: null,
      source: "NONE",
      status: "DISABLED_ITEM",
      isExplicitZero: false,
      isMasterActive: false,
      overrideId: override?.id ?? null,
      nationalDefaultPrice,
      overridePrice,
    };
  }

  // 3. Override Validation & Tariff Gate
  const hasOverride = override !== null && override !== undefined && override.nominal !== null && override.nominal !== undefined;

  if (hasOverride) {
    const nominalNum = Number(override.nominal);
    const isCorrupted = !Number.isFinite(nominalNum) || nominalNum < 0 || !Number.isInteger(nominalNum);

    if (isCorrupted) {
      // Fail-closed on corrupted override
      return {
        pricingItemId,
        namaItem,
        category,
        tipeKendaraan,
        samsatId,
        jurisdiction,
        effectivePrice: null,
        source: "NONE",
        status: "CORRUPTED_OVERRIDE",
        isExplicitZero: false,
        isMasterActive: true,
        overrideId: override.id ?? null,
        nationalDefaultPrice,
        overridePrice: null,
      };
    }

    const rawActive = override.is_active !== undefined ? override.is_active : override.isActive;
    const isOverrideActive =
      rawActive === 1 ||
      rawActive === true ||
      (rawActive === undefined && true);

    if (isOverrideActive) {
      return {
        pricingItemId,
        namaItem,
        category,
        tipeKendaraan,
        samsatId,
        jurisdiction,
        effectivePrice: nominalNum,
        source: "OVERRIDE",
        status: "CONFIGURED_OVERRIDE",
        isExplicitZero: nominalNum === 0,
        isMasterActive: true,
        overrideId: override.id ?? null,
        nationalDefaultPrice,
        overridePrice: nominalNum,
      };
    }
    // If override is_active === 0, it is deactivated, so fallback to National Default below!
  }

  // 4. National Default Gate
  const isDefaultConfigured =
    masterItem.isConfigured !== false &&
    nationalDefaultPrice !== null &&
    Number.isFinite(nationalDefaultPrice) &&
    nationalDefaultPrice >= 0;

  if (isDefaultConfigured) {
    return {
      pricingItemId,
      namaItem,
      category,
      tipeKendaraan,
      samsatId,
      jurisdiction,
      effectivePrice: nationalDefaultPrice,
      source: "DEFAULT",
      status: "CONFIGURED_DEFAULT",
      isExplicitZero: nationalDefaultPrice === 0,
      isMasterActive: true,
      overrideId: override?.id ?? null,
      nationalDefaultPrice,
      overridePrice,
    };
  }

  return {
    pricingItemId,
    namaItem,
    category,
    tipeKendaraan,
    samsatId,
    jurisdiction,
    effectivePrice: null,
    source: "NONE",
    status: "NOT_CONFIGURED",
    isExplicitZero: false,
    isMasterActive: true,
    overrideId: override?.id ?? null,
    nationalDefaultPrice: null,
    overridePrice,
  };
}

/**
 * Helper to determine jurisdiction category for mutasi services.
 */
export function getComponentJurisdiction(
  category: string,
  serviceRequiresDestination: boolean
): "ASAL" | "TUJUAN" | "STANDARD" {
  if (!serviceRequiresDestination) {
    return "STANDARD";
  }
  const normCat = (category || "").toLowerCase();
  if (normCat.includes("mutasi masuk") || normCat.includes("masuk")) {
    return "TUJUAN";
  }
  if (normCat.includes("mutasi keluar") || normCat.includes("keluar")) {
    return "ASAL";
  }
  return "ASAL";
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Standard Baselines & Canonical SSoT Resolver
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICE_STANDARD_BASELINES: Record<
  string,
  { jasa: number; jasaR4?: number; jasaR2?: number; kurir: number }
> = {
  "Perpanjangan 1 Tahun": { jasa: 250000, jasaR4: 250000, jasaR2: 150000, kurir: 50000 },
  "Perpanjangan 5 Tahun": { jasa: 500000, jasaR4: 500000, jasaR2: 300000, kurir: 50000 },
  "Mutasi Antar Samsat": { jasa: 800000, jasaR4: 800000, jasaR2: 500000, kurir: 50000 },
  "Mutasi Luar Daerah": { jasa: 1500000, jasaR4: 1500000, jasaR2: 500000, kurir: 50000 },
  "Balik Nama": { jasa: 1200000, jasaR4: 1200000, jasaR2: 750000, kurir: 50000 },
  "Tarik Berkas": { jasa: 600000, jasaR4: 600000, jasaR2: 400000, kurir: 50000 },
  "Duplikat STNK": { jasa: 350000, jasaR4: 350000, jasaR2: 200000, kurir: 50000 },
  "Lainnya": { jasa: 300000, jasaR4: 300000, jasaR2: 200000, kurir: 50000 },
};

export const getStandardJasa = (serviceName: string, vehicle: "Mobil" | "Motor" = "Mobil"): number => {
  const base = SERVICE_STANDARD_BASELINES[serviceName];
  if (!base) return vehicle === "Mobil" ? 1500000 : 500000;
  if (vehicle === "Mobil") {
    return base.jasaR4 ?? base.jasa;
  }
  return base.jasaR2 ?? Math.round(base.jasa * 0.5);
};

/**
 * Resolves authoritative service fee using strict SSoT priority:
 * 1. Fail-closed error if override is corrupted
 * 2. Special service override (e.g. TIDAK ADA KTP / pengurusan khusus) if active and eligible
 * 3. Deactivated state if jasaLengkap.enabled === false
 * 4. Explicit per-Samsat override (different from standard baseline or explicitly marked custom)
 * 5. Deterministic default from estimation template based on service & vehicle type
 */
export function resolveServiceFee(input: ServiceFeeResolutionInput): ResolvedServiceFee {
  const {
    serviceName,
    vehicleType,
    feeConfig,
    kondisiBerkas,
    templateBiayaJasa,
    standardBaselineJasa,
  } = input;

  const isR2 = vehicleType === "Motor";
  const standardBaseline = serviceName
    ? getStandardJasa(serviceName, vehicleType)
    : (standardBaselineJasa !== undefined ? (isR2 && standardBaselineJasa > 1000000 ? Math.round(standardBaselineJasa * 0.5) : standardBaselineJasa) : undefined);

  const vehicleJasa = isR2
    ? (feeConfig?.biayaJasaR2 ?? (feeConfig?.isCustom ? (feeConfig?.biayaJasa ? Math.round(Number(feeConfig.biayaJasa) * 0.5) : standardBaseline) : standardBaseline))
    : (feeConfig?.biayaJasaR4 ?? feeConfig?.biayaJasa ?? standardBaseline);

  const vehicleJasaEnabled = isR2
    ? (feeConfig?.jasaR2Enabled ?? feeConfig?.jasaLengkap?.enabled)
    : (feeConfig?.jasaR4Enabled ?? feeConfig?.jasaLengkap?.enabled);

  // 1. Validation check for corrupted values (Fail-Closed)
  if (vehicleJasa !== undefined && vehicleJasa !== null) {
    const num = Number(vehicleJasa);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error(`CORRUPTED_SERVICE_FEE_CONFIG: Nominal biaya jasa Samsat tidak valid (${vehicleJasa}).`);
    }
  }

  // 2. Special service check (e.g. TIDAK ADA KTP / Pengurusan Khusus)
  const isKhususCondition = kondisiBerkas === "TIDAK ADA KTP" || input.isKhusus === true;
  const khususNominal = isR2
    ? (feeConfig?.biayaKhususR2 ?? feeConfig?.biayaPengurusanKhusus?.nominal ?? (feeConfig as any)?.biayaJasaNembak)
    : (feeConfig?.biayaKhususR4 ?? feeConfig?.biayaPengurusanKhusus?.nominal ?? (feeConfig as any)?.biayaJasaNembak);
  const isKhususActive = isR2
    ? (feeConfig?.khususR2Enabled ?? feeConfig?.biayaPengurusanKhusus?.enabled ?? (feeConfig as any)?.jasaNembakEnabled ?? false)
    : (feeConfig?.khususR4Enabled ?? feeConfig?.biayaPengurusanKhusus?.enabled ?? (feeConfig as any)?.jasaNembakEnabled ?? false);

  if (isKhususCondition && isKhususActive && typeof khususNominal === "number" && khususNominal > 0) {
    return {
      effectiveJasa: khususNominal,
      source: "SPECIAL_SERVICE",
      isActive: true,
    };
  }

  // 3. Jasa toggle check (Component deactivated)
  if (vehicleJasaEnabled === false) {
    return {
      effectiveJasa: 0,
      source: "INACTIVE",
      isActive: false,
    };
  }

  // 4. Per-Samsat Custom Override check
  const cfgJasa = vehicleJasa;
  const baseline = (serviceName ? getStandardJasa(serviceName, vehicleType) : undefined) ?? standardBaselineJasa;

  const hasExplicitOverride =
    feeConfig?.isCustom === true ||
    (typeof cfgJasa === "number" && baseline !== undefined && cfgJasa !== baseline);

  if (hasExplicitOverride && typeof cfgJasa === "number" && cfgJasa >= 0) {
    return {
      effectiveJasa: cfgJasa,
      source: "OVERRIDE",
      isActive: true,
    };
  }

  // 5. Default by Service & Vehicle (prioritizing configured Samsat price and standard baseline)
  let safeDefault = 0;
  if (typeof cfgJasa === "number" && cfgJasa >= 0) {
    safeDefault = cfgJasa;
  } else if (typeof baseline === "number" && baseline >= 0) {
    safeDefault = baseline;
  } else if (typeof templateBiayaJasa === "number" && templateBiayaJasa >= 0) {
    safeDefault = templateBiayaJasa;
  }

  return {
    effectiveJasa: safeDefault,
    source: "TEMPLATE_DEFAULT",
    isActive: true,
  };
}
