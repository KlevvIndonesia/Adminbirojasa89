/**
 * Pricing Domain Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { dbPricingRepository } from "../repositories/dbPricingRepository";
import { dbSamsatTariffRepository } from "../repositories/dbSamsatTariffRepository";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { dbWilayahRepository } from "../repositories/dbWilayahRepository";
import { SamsatCostItem, ResolvedTariff } from "../../../src/domain/pricing/types";
import { resolveTariff, getComponentJurisdiction } from "../utils/pricingResolver";
import { resolveCanonicalActorEmployeeId } from "../utils/actorResolver";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../utils/crypto";
import { normalizeSamsatPricingPayload, normalizeServicePricingPayload } from "../utils/aliasNormalizer";

export class PricingService {
  public getAllSamsatItems(): SamsatCostItem[] {
    return dbPricingRepository.getAllSamsatItems();
  }

  public getSamsatItemById(id: string): SamsatCostItem {
    const item = dbPricingRepository.getSamsatItemById(id);
    if (!item) {
      throw new ApiError(404, "ITEM_NOT_FOUND", `Item harga Samsat '${id}' tidak ditemukan.`);
    }
    return item;
  }

  public updateSamsatItem(id: string, updates: Partial<SamsatCostItem>, user?: TokenPayload | null): SamsatCostItem {
    const existing = this.getSamsatItemById(id);
    normalizeSamsatPricingPayload(updates);
    const success = dbPricingRepository.updateSamsatItem(id, updates);
    if (!success) {
      throw new ApiError(500, "UPDATE_FAILED", `Gagal memperbarui item Samsat ${id}`);
    }

    const updated = this.getSamsatItemById(id);
    if (!updated) {
      throw new ApiError(404, "NOT_FOUND", `Item Samsat ${id} tidak ditemukan setelah pembaruan.`);
    }

    try {
      dbAuditRepository.save({
        id: `log-pricing-upd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "UPDATE",
        module: "Master Data - Harga Dasar Samsat",
        details: `Memperbarui harga dasar ${updated.namaItem}: Rp ${(updated.biayaDasar ?? 0).toLocaleString("id-ID")}`,
        metadata: {
          recordId: id,
          itemId: id,
          oldData: existing,
          newData: updated,
        },
        createdAt: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("[PricingService] Failed to record audit log:", auditErr);
    }

    return updated;
  }

  // ─── SERVICE PRICING (BIAYA LAYANAN) ────────────────────────────────────────

  public getAllServicePricing(): any[] {
    return dbPricingRepository.getAllServicePricing();
  }

  public getServicePricingById(id: string): any {
    const item = dbPricingRepository.getServicePricingById(id);
    if (!item) {
      throw new ApiError(404, "NOT_FOUND", `Konfigurasi biaya layanan '${id}' tidak ditemukan.`);
    }
    return item;
  }

  public createServicePricing(payload: any, user?: TokenPayload | null): any {
    normalizeServicePricingPayload(payload);
    const serviceName = String(payload.serviceName || payload.layanan || payload.service_name || "").trim();
    const wilayah = String(payload.wilayah || payload.namaSamsat || "").trim();

    if (!serviceName || !wilayah) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nama layanan dan wilayah Samsat wajib diisi.");
    }

    const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const serviceId = payload.serviceId || payload.service_id || slugify(serviceName);
    const samsatId = payload.samsatId || payload.samsat_id || (wilayah.startsWith("samsat-") ? wilayah : `samsat-${slugify(wilayah)}`);
    const id = payload.id || `${serviceId}:${samsatId}`;

    // Referential integrity check: Samsat office must exist in samsat_offices master
    const samsatOffice = dbWilayahRepository.getSamsatOfficeById(samsatId);
    if (!samsatOffice) {
      const allOffices = dbWilayahRepository.getAllSamsatOffices();
      const matched = allOffices.find(
        (o) => o.name.toLowerCase().includes(wilayah.toLowerCase()) || o.wilayah.toLowerCase().includes(wilayah.toLowerCase())
      );
      if (!matched) {
        throw new ApiError(404, "SAMSAT_NOT_FOUND", `Kantor Samsat untuk wilayah '${wilayah}' (${samsatId}) tidak ditemukan dalam master data Samsat.`);
      }
    }

    const existing = dbPricingRepository.getServicePricingById(id);
    if (existing) {
      throw new ApiError(409, "DUPLICATE_CONFIG", `Konfigurasi biaya layanan '${serviceName}' untuk wilayah '${wilayah}' sudah terdaftar.`);
    }

    const biayaJasa = Number(payload.biayaJasa ?? payload.biayaJasaLengkap ?? 0);
    const biayaAntarJemput = Number(payload.biayaAntarJemput ?? 50000);

    if (!Number.isFinite(biayaJasa) || biayaJasa < 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Biaya jasa harus berupa nominal angka non-negatif yang valid.");
    }
    if (!Number.isFinite(biayaAntarJemput) || biayaAntarJemput < 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Biaya antar jemput harus berupa nominal angka non-negatif yang valid.");
    }

    const created = dbPricingRepository.createServicePricing(id, {
      ...payload,
      id,
      serviceId,
      serviceName,
      samsatId,
      wilayah,
      biayaJasa,
      biayaAntarJemput,
    });

    try {
      dbAuditRepository.save({
        id: `log-service-pricing-crt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "CREATE",
        module: "Master Data - Biaya Layanan",
        details: `Menambahkan konfigurasi biaya layanan ${serviceName} (${wilayah}): Jasa Rp ${biayaJasa.toLocaleString("id-ID")}`,
        metadata: {
          recordId: id,
          id,
          serviceId,
          samsatId,
          wilayah,
          oldData: null,
          newData: created,
        },
        createdAt: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("[PricingService] Failed to record audit log:", auditErr);
    }

    return created;
  }

  public updateServicePricing(id: string, config: any, user?: TokenPayload | null): any {
    const existing = dbPricingRepository.getServicePricingById(id);
    const success = dbPricingRepository.upsertServicePricing(id, config);
    if (!success) {
      throw new ApiError(500, "UPDATE_FAILED", `Gagal memperbarui konfigurasi biaya layanan '${id}'`);
    }

    const updated = dbPricingRepository.getServicePricingById(id);

    try {
      dbAuditRepository.save({
        id: `log-service-pricing-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "UPDATE",
        module: "Master Data - Biaya Layanan",
        details: `Memperbarui biaya layanan ${id}: Jasa Rp ${Number(config.biayaJasa || 0).toLocaleString("id-ID")}`,
        metadata: {
          recordId: id,
          id,
          oldData: existing || null,
          newData: updated || config,
        },
        createdAt: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("[PricingService] Failed to record audit log:", auditErr);
    }

    return updated;
  }

  public deleteServicePricing(id: string, user?: TokenPayload | null): boolean {
    const existing = dbPricingRepository.getServicePricingById(id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Konfigurasi biaya layanan '${id}' tidak ditemukan.`);
    }

    const success = dbPricingRepository.deleteServicePricing(id);
    if (!success) {
      throw new ApiError(500, "DELETE_FAILED", `Gagal menghapus konfigurasi biaya layanan '${id}'.`);
    }

    try {
      dbAuditRepository.save({
        id: `log-service-pricing-del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "DELETE",
        module: "Master Data - Biaya Layanan",
        details: `Menghapus konfigurasi biaya layanan ${existing.serviceName || id} (${existing.wilayah || ""})`,
        metadata: {
          recordId: id,
          id,
          oldData: existing,
          newData: null,
        },
        createdAt: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("[PricingService] Failed to record audit log:", auditErr);
    }

    return true;
  }

  public batchReplicateServicePricing(
    payload: {
      serviceId: string;
      serviceName?: string;
      sourceConfig: any;
      scope: {
        applyBiayaLayanan: boolean;
        applyBiayaTambahan: boolean;
        applyBiayaLainnya: boolean;
        applyKomponenSamsat?: boolean;
      };
      overridePolicy: "PRESERVE_EXISTING_CUSTOM" | "OVERWRITE_ALL";
    },
    user?: TokenPayload | null
  ): { updatedCount: number; preservedCount: number; totalCount: number } {
    if (!payload.serviceId) {
      throw new ApiError(400, "VALIDATION_ERROR", "serviceId wajib diisi.");
    }
    if (!payload.sourceConfig || typeof payload.sourceConfig !== "object") {
      throw new ApiError(400, "VALIDATION_ERROR", "sourceConfig wajib berupa objek konfigurasi valid.");
    }
    if (!payload.scope || typeof payload.scope !== "object") {
      throw new ApiError(400, "VALIDATION_ERROR", "scope wajib diisi.");
    }
    const policy = payload.overridePolicy || "PRESERVE_EXISTING_CUSTOM";
    if (policy !== "PRESERVE_EXISTING_CUSTOM" && policy !== "OVERWRITE_ALL") {
      throw new ApiError(400, "VALIDATION_ERROR", "overridePolicy tidak valid.");
    }

    const result = dbPricingRepository.batchReplicateServicePricing({
      serviceId: payload.serviceId,
      serviceName: payload.serviceName || payload.serviceId,
      sourceConfig: payload.sourceConfig,
      scope: payload.scope,
      overridePolicy: policy,
    });

    dbAuditRepository.save({
      id: `log-batch-replicate-${Date.now()}`,
      userId: user?.userId || "usr-system",
      userName: user?.nama || "Admin API",
      userRole: user?.role || "admin",
      action: "BATCH_REPLICATE_SERVICE_PRICING",
      module: "Biaya Layanan",
      details: `Replikasi massal biaya layanan ${payload.serviceName || payload.serviceId} ke seluruh Samsat: ${result.updatedCount} kantor diperbarui, ${result.preservedCount} kantor khusus dipertahankan (Kebijakan: ${policy}).`,
      metadata: { ...payload, result },
      createdAt: new Date().toISOString(),
    });

    return result;
  }

  // ─── SAMSAT OPERATIONAL TARIFFS (PER-SAMSAT PRICING) ─────────────────────────

  public getSamsatOperationalTariffs(samsatId?: string): any[] {
    if (samsatId) {
      return dbSamsatTariffRepository.getBySamsatId(samsatId);
    }
    return dbSamsatTariffRepository.getAll();
  }

  // ─── CANONICAL PRICING RESOLVER (NATIONAL DEFAULT + PER-SAMSAT OVERRIDE) ───

  public resolveEffectiveTariff(
    samsatId: string,
    pricingItemId: string,
    jurisdiction: "ASAL" | "TUJUAN" | "STANDARD" = "STANDARD"
  ): ResolvedTariff {
    const masterItem = dbPricingRepository.getSamsatItemById(pricingItemId) || null;
    const override = samsatId ? dbSamsatTariffRepository.getByOfficeAndItem(samsatId, pricingItemId, false) : null;
    return resolveTariff({ masterItem, override, samsatId, jurisdiction });
  }

  public getEffectivePricing(
    samsatId: string,
    jurisdiction: "ASAL" | "TUJUAN" | "STANDARD" = "STANDARD"
  ): ResolvedTariff[] {
    const masterItems = dbPricingRepository.getAllSamsatItems();
    const overrides = samsatId ? dbSamsatTariffRepository.getBySamsatId(samsatId, false) : [];
    const overrideMap = new Map<string, any>();
    for (const ov of overrides) {
      overrideMap.set(ov.pricing_item_id, ov);
    }

    return masterItems.map((masterItem) => {
      const override = overrideMap.get(masterItem.id) || null;
      return resolveTariff({ masterItem, override, samsatId, jurisdiction });
    });
  }

  public upsertSamsatOperationalTariff(
    payload: { samsatId: string; pricingItemId: string; nominal: number },
    user?: TokenPayload | null
  ): any {
    const { samsatId, pricingItemId, nominal } = payload;
    if (!samsatId || typeof samsatId !== "string" || !samsatId.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "ID kantor Samsat wajib diisi.");
    }
    if (!pricingItemId || typeof pricingItemId !== "string" || !pricingItemId.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Item komponen tarif wajib diisi.");
    }
    const num = Number(nominal);
    if (!Number.isFinite(num) || num < 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nominal tarif harus berupa angka non-negatif (>= 0).");
    }

    // Referential integrity check: Samsat office must exist
    const office = dbWilayahRepository.getSamsatOfficeById(samsatId.trim());
    if (!office) {
      throw new ApiError(404, "SAMSAT_NOT_FOUND", `Kantor Samsat '${samsatId}' tidak ditemukan.`);
    }

    // Referential integrity check: pricingItemId must exist in samsat_pricing master
    const masterItem = dbPricingRepository.getSamsatItemById(pricingItemId.trim());
    if (!masterItem) {
      throw new ApiError(404, "PRICING_ITEM_NOT_FOUND", `Komponen tarif '${pricingItemId}' tidak terdaftar dalam Katalog Nasional Samsat.`);
    }

    const previous = dbSamsatTariffRepository.getByOfficeAndItem(samsatId.trim(), pricingItemId.trim(), false);
    const actorEmployeeId = resolveCanonicalActorEmployeeId(user);
    const saved = dbSamsatTariffRepository.upsert(samsatId.trim(), pricingItemId.trim(), num, actorEmployeeId);

    try {
      dbAuditRepository.save({
        id: `log-samsat-tariff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: previous ? "UPDATE" : "CREATE",
        module: "Master Data - Harga Dasar Samsat",
        details: `Mengatur tarif override ${masterItem.namaItem || pricingItemId} untuk ${office.name}: Rp ${Math.round(num).toLocaleString("id-ID")}`,
        metadata: {
          recordId: saved?.id || `${samsatId}:${pricingItemId}`,
          samsatId,
          pricingItemId,
          nominal: Math.round(num),
          oldData: previous || null,
          newData: saved,
        },
        createdAt: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("[PricingService] Failed to record audit log:", auditErr);
    }

    return saved;
  }

  public upsertBatchSamsatOperationalTariffs(
    samsatId: string,
    tariffs: Array<{ pricingItemId: string; nominal: number }>,
    user?: TokenPayload | null
  ): any[] {
    if (!samsatId || typeof samsatId !== "string" || !samsatId.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "ID kantor Samsat wajib diisi.");
    }
    if (!Array.isArray(tariffs) || tariffs.length === 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Daftar komponen tarif operasional wajib diisi.");
    }

    const office = dbWilayahRepository.getSamsatOfficeById(samsatId.trim());
    if (!office) {
      throw new ApiError(404, "SAMSAT_NOT_FOUND", `Kantor Samsat '${samsatId}' tidak ditemukan.`);
    }

    for (const t of tariffs) {
      if (!t.pricingItemId || typeof t.pricingItemId !== "string" || !t.pricingItemId.trim()) {
        throw new ApiError(400, "VALIDATION_ERROR", "Setiap komponen tarif wajib memiliki pricingItemId.");
      }
      const num = Number(t.nominal);
      if (!Number.isFinite(num) || num < 0) {
        throw new ApiError(400, "VALIDATION_ERROR", `Nominal untuk '${t.pricingItemId}' harus berupa angka non-negatif.`);
      }
      const masterItem = dbPricingRepository.getSamsatItemById(t.pricingItemId.trim());
      if (!masterItem) {
        throw new ApiError(404, "PRICING_ITEM_NOT_FOUND", `Komponen tarif '${t.pricingItemId}' tidak terdaftar dalam Katalog Nasional Samsat.`);
      }
    }

    const actorEmployeeId = resolveCanonicalActorEmployeeId(user);
    const saved = dbSamsatTariffRepository.upsertBatch(samsatId.trim(), tariffs, actorEmployeeId);

    dbAuditRepository.save({
      id: `log-samsat-tariffs-batch-${Date.now()}`,
      userId: user?.userId || "usr-system",
      userName: user?.nama || "Admin API",
      userRole: user?.role || "admin",
      action: "UPDATE_SAMSAT_TARIFFS_BATCH",
      module: "Harga Dasar Samsat",
      details: `Memperbarui ${tariffs.length} tarif override untuk ${office.name}`,
      metadata: { samsatId, count: tariffs.length },
      createdAt: new Date().toISOString(),
    });

    return saved;
  }

  public deleteSamsatOperationalTariff(
    idOrOptions: string | { id?: string; samsatId?: string; pricingItemId?: string },
    user?: TokenPayload | null
  ): { success: boolean; reverted: boolean; alreadyDefault?: boolean; fallbackDefault: number | null } {
    let targetId: string | undefined;
    let samsatId: string | undefined;
    let pricingItemId: string | undefined;

    if (typeof idOrOptions === "string") {
      targetId = idOrOptions;
      const existing = dbSamsatTariffRepository.getById(targetId);
      if (existing) {
        samsatId = existing.samsat_id;
        pricingItemId = existing.pricing_item_id;
      }
    } else if (idOrOptions && typeof idOrOptions === "object") {
      targetId = idOrOptions.id;
      samsatId = idOrOptions.samsatId;
      pricingItemId = idOrOptions.pricingItemId;
      if (targetId && (!samsatId || !pricingItemId)) {
        const existing = dbSamsatTariffRepository.getById(targetId);
        if (existing) {
          samsatId = existing.samsat_id;
          pricingItemId = existing.pricing_item_id;
        }
      }
    }

    let existingRecord: any = null;
    if (targetId) {
      existingRecord = dbSamsatTariffRepository.getById(targetId);
    } else if (samsatId && pricingItemId) {
      existingRecord = dbSamsatTariffRepository.getByOfficeAndItem(samsatId, pricingItemId, false);
    }

    const masterItem = pricingItemId ? dbPricingRepository.getSamsatItemById(pricingItemId) : null;
    const fallbackDefault = masterItem?.basePrice ?? masterItem?.biayaDasar ?? null;

    if (!existingRecord) {
      // Idempotent delete: already in national default state
      return {
        success: true,
        reverted: false,
        alreadyDefault: true,
        fallbackDefault,
      };
    }

    const deleteSuccess = targetId
      ? dbSamsatTariffRepository.delete(targetId)
      : dbSamsatTariffRepository.deleteByOfficeAndItem(samsatId!, pricingItemId!);

    if (!deleteSuccess) {
      throw new ApiError(500, "DELETE_FAILED", "Gagal mereset tarif override ke default nasional.");
    }

    try {
      dbAuditRepository.save({
        id: `log-samsat-tariff-del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: user?.userId || "usr-system",
        userName: user?.nama || "Admin API",
        userRole: user?.role || "admin",
        action: "DELETE",
        module: "Master Data - Harga Dasar Samsat",
        details: `Mereset tarif override ${existingRecord.pricing_item_id} pada ${existingRecord.samsat_id} ke default nasional (Rp ${fallbackDefault?.toLocaleString("id-ID") ?? "0"})`,
        metadata: {
          recordId: existingRecord.id,
          samsatId: existingRecord.samsat_id,
          pricingItemId: existingRecord.pricing_item_id,
          oldData: existingRecord,
          newData: null,
          fallbackDefault,
        },
        createdAt: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("[PricingService] Failed to record audit log:", auditErr);
    }

    return {
      success: true,
      reverted: true,
      alreadyDefault: false,
      fallbackDefault,
    };
  }
}

export const pricingService = new PricingService();
