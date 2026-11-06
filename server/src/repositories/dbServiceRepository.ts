/**
 * SQLite Service Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";

export interface ServiceEntity {
  id: string;
  kode_layanan: string;
  nama_layanan: string;
  kategori: string;
  memerlukan_samsat_tujuan: number;
  deskripsi: string;
  requirements: string[];
  requirements_version?: number;
  status_aktif: number;
  urutan: number;
  created_at?: string;
  updated_at?: string;
}

interface RawServiceRow {
  id: string;
  kode_layanan: string;
  nama_layanan: string;
  kategori: string;
  memerlukan_samsat_tujuan: number;
  deskripsi: string | null;
  requirements: string | null;
  requirements_version?: number | null;
  status_aktif: number;
  urutan: number;
  created_at: string;
  updated_at: string;
}

function parseServiceRow(row: RawServiceRow): ServiceEntity {
  let reqs: string[] = [];
  if (row.requirements) {
    try {
      const parsed = JSON.parse(row.requirements);
      if (Array.isArray(parsed)) {
        reqs = parsed.map((item) => (typeof item === "string" ? item.trim() : String(item?.nama || item?.name || ""))).filter(Boolean);
      }
    } catch {
      reqs = [];
    }
  }

  return {
    id: row.id,
    kode_layanan: row.kode_layanan,
    nama_layanan: row.nama_layanan,
    kategori: row.kategori,
    memerlukan_samsat_tujuan: Number(row.memerlukan_samsat_tujuan || 0),
    deskripsi: row.deskripsi || "",
    requirements: reqs,
    requirements_version: Number((row as any).requirements_version || 1),
    status_aktif: Number(row.status_aktif ?? 1),
    urutan: Number(row.urutan ?? 1),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class DbServiceRepository {
  private _hasVersionCol?: boolean;
  public hasRequirementsVersionColumn(): boolean {
    try {
      const cols = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
      this._hasVersionCol = cols.some((c) => c.name === "requirements_version");
    } catch {
      this._hasVersionCol = false;
    }
    return Boolean(this._hasVersionCol);
  }

  public getAll(): ServiceEntity[] {
    const stmt = db.prepare("SELECT * FROM services ORDER BY urutan ASC, created_at ASC");
    const rows = stmt.all() as RawServiceRow[];
    return rows.map(parseServiceRow);
  }

  public getActive(): ServiceEntity[] {
    const stmt = db.prepare("SELECT * FROM services WHERE status_aktif = 1 ORDER BY urutan ASC, created_at ASC");
    const rows = stmt.all() as RawServiceRow[];
    return rows.map(parseServiceRow);
  }

  public getById(id: string): ServiceEntity | undefined {
    const stmt = db.prepare("SELECT * FROM services WHERE id = ?");
    const row = stmt.get(id) as RawServiceRow | undefined;
    return row ? parseServiceRow(row) : undefined;
  }

  public getByKode(kode: string): ServiceEntity | undefined {
    const stmt = db.prepare("SELECT * FROM services WHERE UPPER(kode_layanan) = UPPER(?)");
    const row = stmt.get(kode) as RawServiceRow | undefined;
    return row ? parseServiceRow(row) : undefined;
  }

  public update(
    id: string,
    updates: Partial<{
      nama_layanan: string;
      deskripsi: string;
      requirements: string[];
      status_aktif: number;
      urutan: number;
      kategori: string;
    }>
  ): ServiceEntity | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const newNama = updates.nama_layanan !== undefined ? updates.nama_layanan.trim() : existing.nama_layanan;
    const newDeskripsi = updates.deskripsi !== undefined ? updates.deskripsi.trim() : existing.deskripsi;
    const newRequirements = updates.requirements !== undefined ? updates.requirements.filter((r) => typeof r === "string" && r.trim().length > 0) : existing.requirements;
    const newStatusAktif = updates.status_aktif !== undefined ? updates.status_aktif : existing.status_aktif;
    const newUrutan = updates.urutan !== undefined ? updates.urutan : existing.urutan;
    const newKategori = updates.kategori !== undefined ? updates.kategori.trim() : existing.kategori;

    const reqsChanged = updates.requirements !== undefined && (
      newRequirements.length !== existing.requirements.length ||
      newRequirements.some((r, i) => r !== existing.requirements[i])
    );
    const existingVersion = Number(existing.requirements_version || 1);
    const newRequirementsVersion = reqsChanged ? existingVersion + 1 : existingVersion;

    if (this.hasRequirementsVersionColumn()) {
      const stmt = db.prepare(`
        UPDATE services
        SET nama_layanan = ?,
            deskripsi = ?,
            requirements = ?,
            requirements_version = ?,
            status_aktif = ?,
            urutan = ?,
            kategori = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(
        newNama,
        newDeskripsi,
        JSON.stringify(newRequirements),
        newRequirementsVersion,
        newStatusAktif,
        newUrutan,
        newKategori,
        id
      );
    } else {
      const stmt = db.prepare(`
        UPDATE services
        SET nama_layanan = ?,
            deskripsi = ?,
            requirements = ?,
            status_aktif = ?,
            urutan = ?,
            kategori = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(
        newNama,
        newDeskripsi,
        JSON.stringify(newRequirements),
        newStatusAktif,
        newUrutan,
        newKategori,
        id
      );
    }

    // Synchronize service_name across dependent tables if nama_layanan changed
    if (newNama !== existing.nama_layanan) {
      try {
        // 1. Sync service_pricing_configs (both canonical ID and legacy code)
        db.prepare(`
          UPDATE service_pricing_configs
          SET service_name = ?, updated_at = datetime('now')
          WHERE service_id = ? OR service_id = ?
        `).run(newNama, id, existing.kode_layanan);

        // 2. Sync active orders (only non-archived orders to preserve historical records)
        db.prepare(`
          UPDATE orders
          SET layanan = ?, updated_at = datetime('now')
          WHERE service_id = ? AND is_archived = 0
        `).run(newNama, id);

        // 3. Sync unpaid invoices
        db.prepare(`
          UPDATE finance_invoices
          SET layanan = ?, updated_at = datetime('now')
          WHERE service_id = ? AND status != 'PAID'
        `).run(newNama, id);
      } catch (err) {
        console.warn("[DbServiceRepository] Warning syncing service_name to dependent tables:", err);
      }
    }

    return this.getById(id);
  }

  public delete(id: string): { success: boolean; softDeactivated?: boolean; message?: string } {
    // 1. Check if referenced by orders or invoices
    const orderUsage = db.prepare("SELECT COUNT(*) as count FROM orders WHERE service_id = ?").get(id) as { count: number };
    const invoiceUsage = db.prepare("SELECT COUNT(*) as count FROM finance_invoices WHERE service_id = ?").get(id) as { count: number };
    const pricingUsage = db.prepare("SELECT COUNT(*) as count FROM service_pricing_configs WHERE service_id = ?").get(id) as { count: number };

    const totalUsage = (orderUsage?.count || 0) + (invoiceUsage?.count || 0) + (pricingUsage?.count || 0);
    if (totalUsage > 0) {
      // Soft-deactivate to prevent breaking foreign keys or losing transaction history
      db.prepare("UPDATE services SET status_aktif = 0, updated_at = datetime('now') WHERE id = ?").run(id);
      return {
        success: true,
        softDeactivated: true,
        message: `Layanan memiliki riwayat ${totalUsage} data transaksi/konfigurasi, sehingga statusnya dinonaktifkan (bukan dihapus permanen) demi menjaga integritas data.`
      };
    }

    db.prepare("DELETE FROM services WHERE id = ?").run(id);
    return { success: true, softDeactivated: false, message: "Layanan berhasil dihapus permanen." };
  }
}

export const serviceRepository = new DbServiceRepository();
