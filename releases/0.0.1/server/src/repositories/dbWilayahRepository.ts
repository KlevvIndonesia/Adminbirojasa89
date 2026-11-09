/**
 * SQLite Wilayah & Samsat Office Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";

export interface WilayahRecord {
  kode_kabupaten_kota: string;
  kode_provinsi: string;
  nama_provinsi: string;
  nama_kabupaten_kota: string;
  jenis_wilayah: "Kabupaten" | "Kota";
  status_aktif: boolean;
  sumber_referensi: string;
  tahun_referensi: number;
  samsatCount?: number;
  hasConfiguredSamsat?: boolean;
  statusKonfigurasi?: "Terkonfigurasi" | "Belum Dikonfigurasi";
  samsatOffices?: SamsatOfficeRecord[];
}

export interface ProvinceSummary {
  kode_provinsi: string;
  nama_provinsi: string;
  total_kabupaten_kota: number;
  total_kabupaten: number;
  total_kota: number;
  total_samsat: number;
}

export interface SamsatOfficeRecord {
  id: string;
  name: string;
  wilayah: string;
  alamat?: string;
  kode_kabupaten_kota?: string;
  nama_kabupaten_kota?: string;
  nama_provinsi?: string;
  is_verified: boolean;
  status_aktif: boolean;
  created_at?: string;
  updated_at?: string;
}

export class DbWilayahRepository {
  public getAllWilayah(filters?: {
    provinsi?: string;
    jenis?: string;
    search?: string;
    hasSamsat?: string;
  }): WilayahRecord[] {
    let query = `
      SELECT 
        w.kode_kabupaten_kota,
        w.kode_provinsi,
        w.nama_provinsi,
        w.nama_kabupaten_kota,
        w.jenis_wilayah,
        w.status_aktif,
        w.sumber_referensi,
        w.tahun_referensi,
        COUNT(s.id) as samsat_count
      FROM wilayah_administratif w
      LEFT JOIN samsat_offices s ON s.kode_kabupaten_kota = w.kode_kabupaten_kota AND s.status_aktif = 1
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.provinsi) {
      query += " AND (w.kode_provinsi = ? OR LOWER(w.nama_provinsi) = LOWER(?))";
      params.push(filters.provinsi, filters.provinsi);
    }

    if (filters?.jenis && (filters.jenis === "Kabupaten" || filters.jenis === "Kota")) {
      query += " AND w.jenis_wilayah = ?";
      params.push(filters.jenis);
    }

    if (filters?.search) {
      query += " AND (w.kode_kabupaten_kota LIKE ? OR LOWER(w.nama_kabupaten_kota) LIKE ? OR LOWER(w.nama_provinsi) LIKE ?)";
      const term = `%${filters.search.toLowerCase()}%`;
      params.push(term, term, term);
    }

    query += " GROUP BY w.kode_kabupaten_kota";

    if (filters?.hasSamsat === "true") {
      query += " HAVING samsat_count > 0";
    } else if (filters?.hasSamsat === "false") {
      query += " HAVING samsat_count = 0";
    }

    query += " ORDER BY w.kode_kabupaten_kota ASC";

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];

    // Fetch linked samsat offices map
    const officesStmt = db.prepare(`
      SELECT id, name, wilayah, alamat, kode_kabupaten_kota, is_verified, status_aktif
      FROM samsat_offices
      WHERE status_aktif = 1
    `);
    const allOffices = officesStmt.all() as any[];
    const officesByCode = new Map<string, SamsatOfficeRecord[]>();

    allOffices.forEach((off) => {
      if (!off.kode_kabupaten_kota) return;
      if (!officesByCode.has(off.kode_kabupaten_kota)) {
        officesByCode.set(off.kode_kabupaten_kota, []);
      }
      officesByCode.get(off.kode_kabupaten_kota)!.push({
        ...off,
        is_verified: Boolean(off.is_verified),
        status_aktif: Boolean(off.status_aktif),
      });
    });

    return rows.map((r) => {
      const count = Number(r.samsat_count || 0);
      const linked = officesByCode.get(r.kode_kabupaten_kota) || [];
      return {
        kode_kabupaten_kota: r.kode_kabupaten_kota,
        kode_provinsi: r.kode_provinsi,
        nama_provinsi: r.nama_provinsi,
        nama_kabupaten_kota: r.nama_kabupaten_kota,
        jenis_wilayah: r.jenis_wilayah as "Kabupaten" | "Kota",
        status_aktif: Boolean(r.status_aktif),
        sumber_referensi: r.sumber_referensi,
        tahun_referensi: r.tahun_referensi,
        samsatCount: count,
        hasConfiguredSamsat: count > 0,
        statusKonfigurasi: count > 0 ? "Terkonfigurasi" : "Belum Dikonfigurasi",
        samsatOffices: linked,
      };
    });
  }

  public getProvinces(): ProvinceSummary[] {
    const query = `
      SELECT 
        w.kode_provinsi,
        w.nama_provinsi,
        COUNT(DISTINCT w.kode_kabupaten_kota) as total_kabupaten_kota,
        SUM(CASE WHEN w.jenis_wilayah = 'Kabupaten' THEN 1 ELSE 0 END) as total_kabupaten,
        SUM(CASE WHEN w.jenis_wilayah = 'Kota' THEN 1 ELSE 0 END) as total_kota,
        COUNT(DISTINCT s.id) as total_samsat
      FROM wilayah_administratif w
      LEFT JOIN samsat_offices s ON s.kode_kabupaten_kota = w.kode_kabupaten_kota AND s.status_aktif = 1
      GROUP BY w.kode_provinsi, w.nama_provinsi
      ORDER BY w.kode_provinsi ASC
    `;

    const stmt = db.prepare(query);
    const rows = stmt.all() as any[];

    return rows.map((r) => ({
      kode_provinsi: r.kode_provinsi,
      nama_provinsi: r.nama_provinsi,
      total_kabupaten_kota: Number(r.total_kabupaten_kota),
      total_kabupaten: Number(r.total_kabupaten),
      total_kota: Number(r.total_kota),
      total_samsat: Number(r.total_samsat),
    }));
  }

  public getWilayahByKode(kode: string): WilayahRecord | undefined {
    const stmt = db.prepare(`
      SELECT 
        kode_kabupaten_kota,
        kode_provinsi,
        nama_provinsi,
        nama_kabupaten_kota,
        jenis_wilayah,
        status_aktif,
        sumber_referensi,
        tahun_referensi
      FROM wilayah_administratif
      WHERE kode_kabupaten_kota = ?
    `);
    const row = stmt.get(kode) as any;
    if (!row) return undefined;

    const officesStmt = db.prepare(`
      SELECT id, name, wilayah, alamat, kode_kabupaten_kota, is_verified, status_aktif
      FROM samsat_offices
      WHERE kode_kabupaten_kota = ? AND status_aktif = 1
    `);
    const offices = (officesStmt.all(kode) as any[]).map((off) => ({
      ...off,
      is_verified: Boolean(off.is_verified),
      status_aktif: Boolean(off.status_aktif),
    }));

    return {
      ...row,
      jenis_wilayah: row.jenis_wilayah as "Kabupaten" | "Kota",
      status_aktif: Boolean(row.status_aktif),
      samsatCount: offices.length,
      hasConfiguredSamsat: offices.length > 0,
      statusKonfigurasi: offices.length > 0 ? "Terkonfigurasi" : "Belum Dikonfigurasi",
      samsatOffices: offices,
    };
  }

  public getAllSamsatOffices(): SamsatOfficeRecord[] {
    const stmt = db.prepare(`
      SELECT 
        s.id,
        s.name,
        s.wilayah,
        s.alamat,
        s.kode_kabupaten_kota,
        s.is_verified,
        s.status_aktif,
        s.created_at,
        s.updated_at,
        w.nama_kabupaten_kota,
        w.nama_provinsi
      FROM samsat_offices s
      LEFT JOIN wilayah_administratif w ON w.kode_kabupaten_kota = s.kode_kabupaten_kota
      ORDER BY s.name ASC
    `);

    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      wilayah: r.wilayah,
      alamat: r.alamat || "",
      kode_kabupaten_kota: r.kode_kabupaten_kota || undefined,
      nama_kabupaten_kota: r.nama_kabupaten_kota || undefined,
      nama_provinsi: r.nama_provinsi || undefined,
      is_verified: Boolean(r.is_verified),
      status_aktif: Boolean(r.status_aktif),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  public getSamsatOfficeById(id: string): SamsatOfficeRecord | undefined {
    const stmt = db.prepare(`
      SELECT 
        s.id,
        s.name,
        s.wilayah,
        s.alamat,
        s.kode_kabupaten_kota,
        s.is_verified,
        s.status_aktif,
        s.created_at,
        s.updated_at,
        w.nama_kabupaten_kota,
        w.nama_provinsi
      FROM samsat_offices s
      LEFT JOIN wilayah_administratif w ON w.kode_kabupaten_kota = s.kode_kabupaten_kota
      WHERE s.id = ?
    `);

    const r = stmt.get(id) as any;
    if (!r) return undefined;

    return {
      id: r.id,
      name: r.name,
      wilayah: r.wilayah,
      alamat: r.alamat || "",
      kode_kabupaten_kota: r.kode_kabupaten_kota || undefined,
      nama_kabupaten_kota: r.nama_kabupaten_kota || undefined,
      nama_provinsi: r.nama_provinsi || undefined,
      is_verified: Boolean(r.is_verified),
      status_aktif: Boolean(r.status_aktif),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  public addSamsatOffice(office: {
    id?: string;
    name: string;
    wilayah: string;
    alamat?: string;
    kode_kabupaten_kota?: string;
    is_verified?: boolean;
  }): SamsatOfficeRecord {
    const id = office.id || `samsat-${office.wilayah.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
    const isVerified = office.is_verified ?? true;

    const stmt = db.prepare(`
      INSERT INTO samsat_offices (
        id, name, wilayah, alamat, kode_kabupaten_kota, is_verified, status_aktif, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      id,
      office.name,
      office.wilayah,
      office.alamat || "",
      office.kode_kabupaten_kota || null,
      isVerified ? 1 : 0,
      1
    );

    return this.getSamsatOfficeById(id)!;
  }

  public updateSamsatOffice(
    id: string,
    updates: Partial<{
      name: string;
      wilayah: string;
      alamat: string;
      kode_kabupaten_kota: string;
      is_verified: boolean;
      status_aktif: boolean;
    }>
  ): boolean {
    const existing = this.getSamsatOfficeById(id);
    if (!existing) return false;

    const merged = { ...existing, ...updates };

    const stmt = db.prepare(`
      UPDATE samsat_offices SET
        name = ?,
        wilayah = ?,
        alamat = ?,
        kode_kabupaten_kota = ?,
        is_verified = ?,
        status_aktif = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const res = stmt.run(
      merged.name,
      merged.wilayah,
      merged.alamat || "",
      merged.kode_kabupaten_kota || null,
      merged.is_verified ? 1 : 0,
      merged.status_aktif ? 1 : 0,
      id
    );

    return res.changes > 0;
  }

  public deleteSamsatOffice(id: string): boolean {
    const stmt = db.prepare("DELETE FROM samsat_offices WHERE id = ?");
    const res = stmt.run(id);
    return res.changes > 0;
  }
}

export const dbWilayahRepository = new DbWilayahRepository();
