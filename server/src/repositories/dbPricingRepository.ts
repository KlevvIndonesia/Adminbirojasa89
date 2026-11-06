/**
 * SQLite Pricing Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";
import { SamsatCostItem } from "../../../src/domain/pricing/types";

export const SERVICE_CANONICAL_BASELINES: Record<string, { jasa: number; kurir: number }> = {
  "svc-perp-1th": { jasa: 250000, kurir: 50000 },
  "svc-perp-5th": { jasa: 500000, kurir: 50000 },
  "svc-mut-asal": { jasa: 800000, kurir: 50000 },
  "svc-mut-antar": { jasa: 1500000, kurir: 50000 },
  "svc-balik-nama": { jasa: 1200000, kurir: 50000 },
  "svc-tarik-berkas": { jasa: 600000, kurir: 50000 },
  "svc-duplikat-stnk": { jasa: 350000, kurir: 50000 },
  "svc-lainnya": { jasa: 300000, kurir: 50000 },
  "perpanjangan-1-tahun": { jasa: 250000, kurir: 50000 },
  "perpanjangan-5-tahun": { jasa: 500000, kurir: 50000 },
  "mutasi-antar-samsat": { jasa: 800000, kurir: 50000 },
  "mutasi-luar-daerah": { jasa: 1500000, kurir: 50000 },
  "balik-nama": { jasa: 1200000, kurir: 50000 },
  "tarik-berkas": { jasa: 600000, kurir: 50000 },
  "duplikat-stnk": { jasa: 350000, kurir: 50000 },
  "Perpanjangan 1 Tahun": { jasa: 250000, kurir: 50000 },
  "Perpanjangan 5 Tahun": { jasa: 500000, kurir: 50000 },
  "Mutasi Antar Samsat": { jasa: 800000, kurir: 50000 },
  "Mutasi Luar Daerah": { jasa: 1500000, kurir: 50000 },
  "Balik Nama": { jasa: 1200000, kurir: 50000 },
  "Tarik Berkas": { jasa: 600000, kurir: 50000 },
  "Duplikat STNK": { jasa: 350000, kurir: 50000 },
  "Lainnya": { jasa: 300000, kurir: 50000 },
};


export function mapRowToSamsatItem(row: any): SamsatCostItem {
    let parsed: any = {};
    if (row.data_json) {
      try {
        parsed = JSON.parse(row.data_json);
      } catch (err) {
        console.warn(`[DbPricingRepository] Gagal parse data_json pada item ${row.id}:`, err);
      }
    }

    // Kolom SQL fisik adalah sumber kanonis utama (Single Source of Truth)
    const rawPrice = row.biaya_dasar !== null && row.biaya_dasar !== undefined
      ? Number(row.biaya_dasar)
      : Number(parsed.basePrice ?? parsed.biayaDasar ?? 0);
    const isValidPrice = !isNaN(rawPrice) && Number.isInteger(rawPrice) && rawPrice >= 0;
    const basePrice = isValidPrice ? rawPrice : 0;

    const name = row.nama_item !== null && row.nama_item !== undefined && row.nama_item !== ""
      ? String(row.nama_item)
      : String(parsed.name ?? parsed.namaItem ?? "");

    const category = row.kategori !== null && row.kategori !== undefined && row.kategori !== ""
      ? String(row.kategori)
      : String(parsed.category ?? parsed.kategori ?? "Layanan Standar");

    const tipeKendaraan = row.tipe_kendaraan !== null && row.tipe_kendaraan !== undefined && row.tipe_kendaraan !== ""
      ? String(row.tipe_kendaraan)
      : String(parsed.tipeKendaraan ?? parsed.tipe_kendaraan ?? "Mobil");

    // Semantik deskripsi: jika kolom SQL tidak null/undefined, gunakan kolom SQL.
    // Jika kolom SQL bernilai NULL di database, fallback ke JSON description, atau string kosong "".
    const description = row.deskripsi !== null && row.deskripsi !== undefined
      ? String(row.deskripsi)
      : (parsed.description ?? parsed.deskripsi ?? "");

    // Physical flags
    const isActive = row.is_active !== null && row.is_active !== undefined
      ? row.is_active === 1
      : (parsed.active !== undefined ? Boolean(parsed.active) : true);

    const isConfigured = isValidPrice && (
      row.is_configured !== null && row.is_configured !== undefined
        ? row.is_configured === 1
        : (basePrice > 0 || parsed.isConfigured === true)
    );

    // Field dinamis yang hanya ada di JSON dipertahankan seutuhnya
    const code = parsed.code ? String(parsed.code) : "";

    return {
      ...parsed, // 1. Pertahankan seluruh atribut dinamis tambahan yang ada di data_json
      id: row.id,
      code,
      name,
      category: category as any,
      active: isActive,
      basePrice,
      description,
      isConfigured,
      isActive,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // 2. Properti alias bahasa Indonesia untuk kompatibilitas service & audit logs
      namaItem: name,
      kategori: category,
      tipeKendaraan,
      biayaDasar: basePrice,
      deskripsi: description,
    };
  }

export class DbPricingRepository {
  private mapRowToSamsatItem(row: any): SamsatCostItem {
    return mapRowToSamsatItem(row);
  }

  public getAllSamsatItems(): SamsatCostItem[] {
    const stmt = db.prepare("SELECT * FROM samsat_pricing ORDER BY kategori ASC, nama_item ASC");
    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapRowToSamsatItem(r));
  }

  public getSamsatItemById(id: string): SamsatCostItem | undefined {
    const stmt = db.prepare("SELECT * FROM samsat_pricing WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return this.mapRowToSamsatItem(row);
  }

  public updateSamsatItem(id: string, updates: Partial<SamsatCostItem>): boolean {
    const existing = this.getSamsatItemById(id);
    if (!existing) return false;

    // Resolve nilai kanonis dari updates atau existing (SQL-derived)
    const resolvedName = updates.namaItem !== undefined
      ? String(updates.namaItem)
      : (updates.name !== undefined ? String(updates.name) : existing.name);

    const resolvedCategory = updates.kategori !== undefined
      ? String(updates.kategori)
      : (updates.category !== undefined ? String(updates.category) : existing.category);

    const resolvedTipeKendaraan = (updates as any).tipeKendaraan !== undefined
      ? String((updates as any).tipeKendaraan)
      : ((updates as any).tipe_kendaraan !== undefined
          ? String((updates as any).tipe_kendaraan)
          : ((existing as any).tipeKendaraan || "Mobil"));

    const resolvedBasePrice = updates.biayaDasar !== undefined
      ? Math.max(0, Math.round(Number(updates.biayaDasar)))
      : (updates.basePrice !== undefined ? Math.max(0, Math.round(Number(updates.basePrice))) : existing.basePrice);

    const resolvedDeskripsi = updates.deskripsi !== undefined
      ? (updates.deskripsi !== null ? String(updates.deskripsi) : "")
      : (updates.description !== undefined ? (updates.description !== null ? String(updates.description) : "") : (existing.description || ""));

    const resolvedIsActive = (updates as any).isActive !== undefined
      ? ((updates as any).isActive ? 1 : 0)
      : (updates.active !== undefined ? (updates.active ? 1 : 0) : (existing.isActive !== false && existing.active !== false ? 1 : 0));

    const resolvedIsConfigured = (updates as any).isConfigured !== undefined
      ? ((updates as any).isConfigured ? 1 : 0)
      : (resolvedBasePrice !== null && resolvedBasePrice !== undefined && Number.isFinite(resolvedBasePrice) && resolvedBasePrice >= 0 ? 1 : (existing.isConfigured ? 1 : 0));

    // Sinkronkan seluruh payload data_json agar tidak bertentangan dengan kolom SQL fisik
    const mergedJsonPayload = {
      ...existing,
      ...updates,
      id,
      name: resolvedName,
      namaItem: resolvedName,
      category: resolvedCategory,
      kategori: resolvedCategory,
      tipeKendaraan: resolvedTipeKendaraan,
      basePrice: resolvedBasePrice,
      biayaDasar: resolvedBasePrice,
      description: resolvedDeskripsi,
      deskripsi: resolvedDeskripsi,
      active: resolvedIsActive === 1,
      isActive: resolvedIsActive === 1,
      isConfigured: resolvedIsConfigured === 1,
    };

    const stmt = db.prepare(`
      UPDATE samsat_pricing SET
        nama_item = ?,
        kategori = ?,
        tipe_kendaraan = ?,
        biaya_dasar = ?,
        deskripsi = ?,
        is_active = ?,
        is_configured = ?,
        data_json = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const res = stmt.run(
      resolvedName,
      resolvedCategory,
      resolvedTipeKendaraan,
      resolvedBasePrice,
      resolvedDeskripsi,
      resolvedIsActive,
      resolvedIsConfigured,
      JSON.stringify(mergedJsonPayload),
      id
    );

    return res.changes > 0;
  }

  public addSamsatItem(item: SamsatCostItem): void {
    const resolvedName = item.namaItem !== undefined
      ? String(item.namaItem)
      : (item.name !== undefined ? String(item.name) : "Item Samsat");

    const resolvedCategory = item.kategori !== undefined
      ? String(item.kategori)
      : (item.category !== undefined ? String(item.category) : "Layanan Standar");

    const resolvedTipeKendaraan = (item as any).tipeKendaraan !== undefined
      ? String((item as any).tipeKendaraan)
      : ((item as any).tipe_kendaraan !== undefined ? String((item as any).tipe_kendaraan) : "Mobil");

    const resolvedBasePrice = item.biayaDasar !== undefined
      ? Number(item.biayaDasar)
      : (item.basePrice !== undefined ? Number(item.basePrice) : 0);

    const resolvedDeskripsi = item.deskripsi !== undefined
      ? (item.deskripsi !== null ? String(item.deskripsi) : "")
      : (item.description !== undefined ? (item.description !== null ? String(item.description) : "") : "");

    const jsonPayload = {
      ...item,
      id: item.id,
      name: resolvedName,
      namaItem: resolvedName,
      category: resolvedCategory,
      kategori: resolvedCategory,
      tipeKendaraan: resolvedTipeKendaraan,
      basePrice: resolvedBasePrice,
      biayaDasar: resolvedBasePrice,
      description: resolvedDeskripsi,
      deskripsi: resolvedDeskripsi,
    };

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO samsat_pricing (
        id, nama_item, kategori, tipe_kendaraan, biaya_dasar, deskripsi, data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      item.id,
      resolvedName,
      resolvedCategory,
      resolvedTipeKendaraan,
      resolvedBasePrice,
      resolvedDeskripsi,
      JSON.stringify(jsonPayload)
    );
  }

  // ─── SERVICE PRICING CONFIGS (BIAYA LAYANAN) ────────────────────────────────

  public getAllServicePricing(): any[] {
    const stmt = db.prepare("SELECT * FROM service_pricing_configs ORDER BY service_name ASC, wilayah ASC");
    const rows = stmt.all() as any[];
    return rows.map((r) => {
      try {
        const parsed = JSON.parse(r.data_json);
        return {
          ...parsed,
          id: r.id,
          serviceId: r.service_id,
          serviceName: r.service_name,
          samsatId: r.samsat_id,
          wilayah: r.wilayah,
          biayaJasa: r.biaya_jasa,
          biayaAntarJemput: r.biaya_antar_jemput,
        };
      } catch {
        return {
          id: r.id,
          serviceId: r.service_id,
          serviceName: r.service_name,
          samsatId: r.samsat_id,
          wilayah: r.wilayah,
          biayaJasa: r.biaya_jasa,
          biayaAntarJemput: r.biaya_antar_jemput,
        };
      }
    });
  }

  public getServicePricingById(id: string): any {
    const stmt = db.prepare("SELECT * FROM service_pricing_configs WHERE id = ?");
    const r = stmt.get(id) as any;
    if (!r) return undefined;
    try {
      const parsed = JSON.parse(r.data_json);
      return {
        ...parsed,
        id: r.id,
        serviceId: r.service_id,
        serviceName: r.service_name,
        samsatId: r.samsat_id,
        wilayah: r.wilayah,
        biayaJasa: r.biaya_jasa,
        biayaAntarJemput: r.biaya_antar_jemput,
      };
    } catch {
      return r;
    }
  }

  public upsertServicePricing(id: string, config: any): boolean {
    const serviceId = config.serviceId || id.split(":")[0];
    const samsatId = config.samsatId || id.split(":")[1];
    const serviceName = config.serviceName || serviceId;
    const wilayah = config.wilayah || samsatId;
    const biayaJasa = Number(config.biayaJasa ?? config.biayaJasaLengkap ?? 0);
    const biayaAntarJemput = Number(config.biayaAntarJemput ?? 50000);

    const stmt = db.prepare(`
      INSERT INTO service_pricing_configs (
        id, service_id, service_name, samsat_id, wilayah, biaya_jasa, biaya_antar_jemput, data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        service_id = excluded.service_id,
        service_name = excluded.service_name,
        samsat_id = excluded.samsat_id,
        wilayah = excluded.wilayah,
        biaya_jasa = excluded.biaya_jasa,
        biaya_antar_jemput = excluded.biaya_antar_jemput,
        data_json = excluded.data_json,
        updated_at = datetime('now')
    `);

    const res = stmt.run(
      id,
      serviceId,
      serviceName,
      samsatId,
      wilayah,
      biayaJasa,
      biayaAntarJemput,
      JSON.stringify(config)
    );

    return res.changes > 0;
  }

  public createServicePricing(id: string, config: any): any {
    const serviceId = config.serviceId || id.split(":")[0];
    const samsatId = config.samsatId || id.split(":")[1];
    const serviceName = config.serviceName || serviceId;
    const wilayah = config.wilayah || samsatId;
    const biayaJasa = Number(config.biayaJasa ?? config.biayaJasaLengkap ?? 0);
    const biayaAntarJemput = Number(config.biayaAntarJemput ?? 50000);

    const stmt = db.prepare(`
      INSERT INTO service_pricing_configs (
        id, service_id, service_name, samsat_id, wilayah, biaya_jasa, biaya_antar_jemput, data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      id,
      serviceId,
      serviceName,
      samsatId,
      wilayah,
      biayaJasa,
      biayaAntarJemput,
      JSON.stringify({ ...config, id, serviceId, serviceName, samsatId, wilayah, biayaJasa, biayaAntarJemput })
    );

    return this.getServicePricingById(id);
  }

  public deleteServicePricing(id: string): boolean {
    const stmt = db.prepare("DELETE FROM service_pricing_configs WHERE id = ?");
    const res = stmt.run(id);
    return res.changes > 0;
  }

  /**
   * Batch Replicate Service Pricing across all 515 Samsat offices in SQLite.
   * Executed within a single atomic database transaction (COMMIT on success, ROLLBACK on error).
   * Supports policy: "PRESERVE_EXISTING_CUSTOM" (skips custom tariffs) or "OVERWRITE_ALL".
   */
  public batchReplicateServicePricing(params: {
    serviceId: string;
    serviceName: string;
    sourceConfig: {
      biayaJasaLengkap?: number;
      jasaLengkapEnabled?: boolean;
      biayaJasaNembak?: number;
      jasaNembakEnabled?: boolean;
      biayaAntarJemput?: number;
      antarJemputEnabled?: boolean;
      antarJemputMode?: string;
      nominalSwdkllj?: number;
      swdklljEnabled?: boolean;
      biayaLainnya?: Array<{ id: string; label: string; nominal: number; enabled: boolean; includesInTotal?: boolean }>;
      components?: Record<string, boolean>;
    };
    scope: {
      applyBiayaLayanan: boolean;
      applyBiayaTambahan: boolean;
      applyBiayaLainnya: boolean;
      applyKomponenSamsat?: boolean;
    };
    overridePolicy: "PRESERVE_EXISTING_CUSTOM" | "OVERWRITE_ALL";
  }): { updatedCount: number; preservedCount: number; totalCount: number } {
    const serviceId = params.serviceId;
    const serviceName = params.serviceName || serviceId;
    const baseline = SERVICE_CANONICAL_BASELINES[serviceId] || { jasa: 250000, kurir: 50000 };

    const offices = db
      .prepare("SELECT id, name, wilayah FROM samsat_offices WHERE status_aktif = 1")
      .all() as Array<{ id: string; name: string; wilayah: string }>;

    const existingRows = db
      .prepare("SELECT id, samsat_id, wilayah, biaya_jasa, biaya_antar_jemput, data_json FROM service_pricing_configs WHERE service_id = ?")
      .all(serviceId) as Array<{ id: string; samsat_id: string; wilayah: string; biaya_jasa: number; biaya_antar_jemput: number; data_json: string }>;

    const existingMap = new Map<string, any>();
    existingRows.forEach((r) => {
      try {
        const parsed = JSON.parse(r.data_json);
        existingMap.set(r.samsat_id, { ...r, ...parsed });
      } catch {
        existingMap.set(r.samsat_id, r);
      }
    });

    const isCustomOffice = (config: any): boolean => {
      if (!config) return false;
      const jasa = Number(config.biaya_jasa ?? config.biayaJasaLengkap ?? config.biayaJasa ?? 0);
      const kurir = Number(config.biaya_antar_jemput ?? config.biayaAntarJemput ?? 50000);
      const hasCustomFees =
        Array.isArray(config.biayaLainnya) &&
        config.biayaLainnya.some((b: any) => b.enabled !== false && b.label && b.label.trim() !== "");
      const isKhususActive = config.pengurusanKhususEnabled === true || config.jasaNembakEnabled === true;
      return jasa !== baseline.jasa || kurir !== baseline.kurir || hasCustomFees || isKhususActive;
    };

    const safeMergeBiayaLainnya = (targetItems: any[] = [], sourceItems: any[] = []): any[] => {
      const merged = (targetItems || []).map((item) => ({ ...item }));
      (sourceItems || []).forEach((sourceItem) => {
        const existingIdx = merged.findIndex(
          (t) =>
            (t.id && sourceItem.id && t.id === sourceItem.id) ||
            (t.label && sourceItem.label && t.label.trim().toLowerCase() === sourceItem.label.trim().toLowerCase())
        );
        if (existingIdx !== -1) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            label: sourceItem.label || merged[existingIdx].label,
            nominal: sourceItem.nominal !== undefined ? sourceItem.nominal : merged[existingIdx].nominal,
            enabled: sourceItem.enabled !== undefined ? sourceItem.enabled : merged[existingIdx].enabled,
            includesInTotal: sourceItem.includesInTotal !== undefined ? sourceItem.includesInTotal : merged[existingIdx].includesInTotal,
          };
        } else {
          merged.push({
            ...sourceItem,
            id: sourceItem.id || ("bl-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6)),
          });
        }
      });
      return merged;
    };

    const upsertStmt = db.prepare(`
      INSERT INTO service_pricing_configs (
        id, service_id, service_name, samsat_id, wilayah, biaya_jasa, biaya_antar_jemput, data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        service_id = excluded.service_id,
        service_name = excluded.service_name,
        samsat_id = excluded.samsat_id,
        wilayah = excluded.wilayah,
        biaya_jasa = excluded.biaya_jasa,
        biaya_antar_jemput = excluded.biaya_antar_jemput,
        data_json = excluded.data_json,
        updated_at = datetime('now')
    `);

    let updatedCount = 0;
    let preservedCount = 0;

    db.exec("BEGIN;");
    try {
      for (const office of offices) {
        const existing = existingMap.get(office.id);
        const hasCustom = isCustomOffice(existing);

        if (params.overridePolicy === "PRESERVE_EXISTING_CUSTOM" && hasCustom) {
          preservedCount++;
          continue;
        }

        const id = serviceId + ":" + office.id;
        let targetConfig: any;

        if (existing) {
          targetConfig = { ...existing };
          if (params.scope.applyBiayaLayanan) {
            targetConfig.biayaJasa = params.sourceConfig.biayaJasaLengkap ?? 0;
            targetConfig.biayaJasaLengkap = params.sourceConfig.biayaJasaLengkap ?? 0;
            targetConfig.jasaLengkapEnabled = params.sourceConfig.jasaLengkapEnabled ?? true;
            targetConfig.biayaPengurusanKhusus = params.sourceConfig.biayaJasaNembak ?? 0;
            targetConfig.biayaJasaNembak = params.sourceConfig.biayaJasaNembak ?? 0;
            targetConfig.pengurusanKhususEnabled = params.sourceConfig.jasaNembakEnabled ?? false;
            targetConfig.jasaNembakEnabled = params.sourceConfig.jasaNembakEnabled ?? false;
          }
          if (params.scope.applyBiayaTambahan) {
            targetConfig.biayaAntarJemput = params.sourceConfig.biayaAntarJemput ?? 50000;
            targetConfig.antarJemputEnabled = params.sourceConfig.antarJemputEnabled ?? true;
            if (params.sourceConfig.antarJemputMode) {
              targetConfig.antarJemputMode = params.sourceConfig.antarJemputMode;
            }
            if (params.sourceConfig.nominalSwdkllj !== undefined) {
              targetConfig.swdkllj = {
                nominal: params.sourceConfig.nominalSwdkllj,
                enabled: params.sourceConfig.swdklljEnabled ?? true,
              };
              targetConfig.opsenPkb = { ...targetConfig.swdkllj };
            }
          }
          if (params.scope.applyBiayaLainnya && params.sourceConfig.biayaLainnya) {
            targetConfig.biayaLainnya = safeMergeBiayaLainnya(targetConfig.biayaLainnya, params.sourceConfig.biayaLainnya);
          }
        } else {
          const nomJasa = params.scope.applyBiayaLayanan ? (params.sourceConfig.biayaJasaLengkap ?? baseline.jasa) : baseline.jasa;
          const nomKhusus = params.scope.applyBiayaLayanan ? (params.sourceConfig.biayaJasaNembak ?? 0) : 0;
          const enKhusus = params.scope.applyBiayaLayanan ? (params.sourceConfig.jasaNembakEnabled ?? false) : false;
          const nomKurir = params.scope.applyBiayaTambahan ? (params.sourceConfig.biayaAntarJemput ?? baseline.kurir) : baseline.kurir;
          const enKurir = params.scope.applyBiayaTambahan ? (params.sourceConfig.antarJemputEnabled ?? true) : true;

          targetConfig = {
            id,
            serviceId,
            serviceName,
            samsatId: office.id,
            wilayah: office.wilayah,
            biayaJasa: nomJasa,
            biayaJasaLengkap: nomJasa,
            jasaLengkapEnabled: params.scope.applyBiayaLayanan ? (params.sourceConfig.jasaLengkapEnabled ?? true) : true,
            biayaPengurusanKhusus: nomKhusus,
            biayaJasaNembak: nomKhusus,
            pengurusanKhususEnabled: enKhusus,
            jasaNembakEnabled: enKhusus,
            biayaAntarJemput: nomKurir,
            antarJemputEnabled: enKurir,
            antarJemputMode: params.sourceConfig.antarJemputMode || "Antar & Jemput",
            swdkllj: {
              nominal: params.sourceConfig.nominalSwdkllj ?? 143000,
              enabled: params.sourceConfig.swdklljEnabled ?? true,
            },
            opsenPkb: {
              nominal: params.sourceConfig.nominalSwdkllj ?? 143000,
              enabled: params.sourceConfig.swdklljEnabled ?? true,
            },
            biayaLainnya: params.scope.applyBiayaLainnya && params.sourceConfig.biayaLainnya ? [...params.sourceConfig.biayaLainnya] : [],
            active: true,
          };
        }

        const biayaJasaNum = Number(targetConfig.biayaJasaLengkap ?? targetConfig.biayaJasa ?? 0);
        const biayaKurirNum = Number(targetConfig.biayaAntarJemput ?? 50000);

        upsertStmt.run(
          id,
          serviceId,
          serviceName,
          office.id,
          office.wilayah,
          biayaJasaNum,
          biayaKurirNum,
          JSON.stringify(targetConfig)
        );

        updatedCount++;
      }

      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }

    return {
      updatedCount,
      preservedCount,
      totalCount: offices.length,
    };
  }

}

export const dbPricingRepository = new DbPricingRepository();
