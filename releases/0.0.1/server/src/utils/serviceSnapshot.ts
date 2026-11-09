/**
 * Service Requirements Snapshot & Resolver Utility (Patch D)
 * Admin SUN89 — Biro Jasa Management System
 */

import { ServiceRequirementsSnapshot, ServiceRequirementItem } from "../../../src/domain/order/types";
import { ServiceEntity } from "../repositories/dbServiceRepository";

export function slugifyRequirement(text: string, fallbackIdx: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `req-${fallbackIdx}`;
}

export function buildServiceRequirementsSnapshot(
  service: ServiceEntity,
  capturedAt?: string
): ServiceRequirementsSnapshot {
  const seenSlugs = new Set<string>();
  const items: ServiceRequirementItem[] = [];

  const rawReqs = service.requirements || [];
  for (let i = 0; i < rawReqs.length; i++) {
    const raw = rawReqs[i];
    const label = typeof raw === "string" ? raw.trim() : String((raw as any)?.nama || (raw as any)?.name || (raw as any)?.label || "").trim();
    if (!label) continue;

    const baseSlug = slugifyRequirement(label, i);
    let finalSlug = baseSlug;
    let counter = 1;
    while (seenSlugs.has(finalSlug)) {
      counter++;
      finalSlug = `${baseSlug}-${counter}`;
    }
    seenSlugs.add(finalSlug);

    items.push({
      id: finalSlug,
      label,
      required: true,
    });
  }

  return {
    schemaVersion: 1,
    sourceServiceId: service.id,
    sourceServiceName: service.nama_layanan,
    sourceRequirementsVersion: Number(service.requirements_version || 1),
    capturedAt: capturedAt || new Date().toISOString(),
    requirements: items,
  };
}

export interface ResolvedOrderRequirements {
  requirements: string[];
  items: ServiceRequirementItem[];
  status: "SNAPSHOT_VERIFIED" | "LEGACY_DERIVED" | "GENERIC_FALLBACK" | "SERVICE_NOT_FOUND" | "MALFORMED_SNAPSHOT";
  warningNotice?: string;
  sourceServiceId?: string;
  sourceServiceName?: string;
  sourceRequirementsVersion?: number;
  isSnapshot: boolean;
  isLegacyDerived?: boolean;
}

export function resolveOrderRequirements(
  order: any,
  masterServiceLookup?: (idOrName: string) => ServiceEntity | undefined
): ResolvedOrderRequirements {
  // 1. Check if order has a snapshot
  if (order && order.serviceRequirementsSnapshot !== undefined && order.serviceRequirementsSnapshot !== null) {
    const snap = order.serviceRequirementsSnapshot;
    // Validate snapshot structure
    if (
      snap &&
      typeof snap === "object" &&
      Array.isArray(snap.requirements)
    ) {
      const items: ServiceRequirementItem[] = snap.requirements.map((r: any, idx: number) => ({
        id: String(r?.id || slugifyRequirement(String(r?.label || r?.name || `req-${idx}`), idx)),
        label: String(r?.label || r?.name || `Persyaratan ${idx + 1}`),
        required: r?.required !== false,
      }));
      return {
        requirements: items.map((i) => i.label),
        items,
        status: "SNAPSHOT_VERIFIED",
        sourceServiceId: snap.sourceServiceId,
        sourceServiceName: snap.sourceServiceName,
        sourceRequirementsVersion: snap.sourceRequirementsVersion,
        isSnapshot: true,
      };
    } else {
      // Malformed snapshot: do not silently fallback to latest master!
      return {
        requirements: [],
        items: [],
        status: "MALFORMED_SNAPSHOT",
        warningNotice: "Format snapshot persyaratan order tidak valid. Hubungi admin untuk verifikasi berkas.",
        isSnapshot: true,
      };
    }
  }

  // 2. Legacy order without snapshot: explicit fallback
  const svcId = order?.serviceId || order?.service_id || order?.layanan;
  let master: ServiceEntity | undefined;
  if (masterServiceLookup && svcId) {
    master = masterServiceLookup(svcId);
  }

  if (master) {
    const rawReqs = master.requirements || [];
    const items = rawReqs.map((r: string, idx: number) => ({
      id: slugifyRequirement(r, idx),
      label: r,
      required: true,
    }));
    return {
      requirements: rawReqs,
      items,
      status: "LEGACY_DERIVED",
      sourceServiceId: master.id,
      sourceServiceName: master.nama_layanan,
      sourceRequirementsVersion: master.requirements_version || 1,
      isSnapshot: false,
      isLegacyDerived: true,
      warningNotice: "Persyaratan dokumen berasal dari konfigurasi layanan saat ini (legacy fallback).",
    };
  }

  // Check generic STNK fallback for standard phrases
  const lowerLayanan = String(order?.layanan || "").toLowerCase();
  if (
    lowerLayanan === "perp_1thn" ||
    lowerLayanan === "perp_5thn" ||
    lowerLayanan.includes("perpanjangan 1 tahun") ||
    lowerLayanan.includes("perpanjangan 5 tahun") ||
    lowerLayanan.includes("pajak tahunan")
  ) {
    const generic = [
      "KTP asli + fotokopi (2 rangkap)",
      "STNK asli + fotokopi (2 rangkap)",
      "BPKB asli / Surat Keterangan Leasing + fotokopi (2 rangkap)",
    ];
    return {
      requirements: generic,
      items: generic.map((g, idx) => ({ id: slugifyRequirement(g, idx), label: g, required: true })),
      status: "GENERIC_FALLBACK",
      isSnapshot: false,
      isLegacyDerived: true,
      warningNotice: "Menampilkan persyaratan standar perpanjangan STNK.",
    };
  }

  return {
    requirements: [],
    items: [],
    status: "SERVICE_NOT_FOUND",
    isSnapshot: false,
    warningNotice: `Layanan "${order?.layanan || '-'}" tidak terdaftar dalam katalog master. Silakan konfirmasi berkas fisik kepada Admin.`,
  };
}
