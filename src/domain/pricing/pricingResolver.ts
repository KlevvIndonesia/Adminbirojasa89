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

import { SamsatCostItem, ResolvedTariff, TariffResolutionStatus, TariffResolutionSource } from "./types";

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
