/**
 * SQLite Employee Repository
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Canonical repository for `employees` table:
 * Single Source of Truth for employee identity, employment, and personal demographic data.
 */

import { db } from "../database/db";

export interface EmployeeEntity {
  id: string;
  nik_ktp: string;
  nama_lengkap: string;
  no_hp: string | null;
  tgl_lahir: string | null;
  wilayah: string | null;
  alamat_domisili: string | null;
  jabatan: string | null;
  avatar_url: string | null;
  gaji_pokok: number;
  status_karyawan: string;
  tanggal_bergabung: string | null;
  jenis_kelamin: string | null;
  created_at: string;
  updated_at: string;
  // Joined account fields (optional if user exists)
  user_id?: number | null;
  user_email?: string | null;
  user_role?: string | null;
  account_status?: string | null;
  last_login_at?: string | null;
}

export interface EmployeeCreateInput {
  id?: string;
  nik_ktp: string;
  nama_lengkap: string;
  no_hp?: string | null;
  tgl_lahir?: string | null;
  wilayah?: string | null;
  alamat_domisili?: string | null;
  jabatan?: string | null;
  avatar_url?: string | null;
  gaji_pokok?: number;
  status_karyawan?: string;
  tanggal_bergabung?: string | null;
  jenis_kelamin?: string | null;
}

export interface EmployeeUpdateInput {
  nik_ktp?: string;
  nama_lengkap?: string;
  no_hp?: string | null;
  tgl_lahir?: string | null;
  wilayah?: string | null;
  alamat_domisili?: string | null;
  jabatan?: string | null;
  avatar_url?: string | null;
  gaji_pokok?: number;
  status_karyawan?: string;
  tanggal_bergabung?: string | null;
  jenis_kelamin?: string | null;
}

export class DbEmployeeRepository {
  public getAll(): EmployeeEntity[] {
    const stmt = db.prepare(`
      SELECT 
        e.id,
        e.nik_ktp,
        e.nama_lengkap,
        e.no_hp,
        e.tgl_lahir,
        e.wilayah,
        e.alamat_domisili,
        e.jabatan,
        e.avatar_url,
        e.gaji_pokok,
        e.status_karyawan,
        e.tanggal_bergabung,
        e.jenis_kelamin,
        e.created_at,
        e.updated_at,
        u.id AS user_id,
        u.email AS user_email,
        u.role AS user_role,
        u.status AS account_status,
        u.last_login_at
      FROM employees e
      LEFT JOIN users u ON u.employee_id = e.id
      ORDER BY e.id ASC
    `);
    return stmt.all() as EmployeeEntity[];
  }

  public getById(id: string): EmployeeEntity | undefined {
    const stmt = db.prepare(`
      SELECT 
        e.id,
        e.nik_ktp,
        e.nama_lengkap,
        e.no_hp,
        e.tgl_lahir,
        e.wilayah,
        e.alamat_domisili,
        e.jabatan,
        e.avatar_url,
        e.gaji_pokok,
        e.status_karyawan,
        e.tanggal_bergabung,
        e.jenis_kelamin,
        e.created_at,
        e.updated_at,
        u.id AS user_id,
        u.email AS user_email,
        u.role AS user_role,
        u.status AS account_status,
        u.last_login_at
      FROM employees e
      LEFT JOIN users u ON u.employee_id = e.id
      WHERE e.id = ?
    `);
    return stmt.get(id) as EmployeeEntity | undefined;
  }

  public getByNik(nik: string): EmployeeEntity | undefined {
    const stmt = db.prepare(`
      SELECT 
        e.id,
        e.nik_ktp,
        e.nama_lengkap,
        e.no_hp,
        e.tgl_lahir,
        e.wilayah,
        e.alamat_domisili,
        e.jabatan,
        e.avatar_url,
        e.gaji_pokok,
        e.status_karyawan,
        e.tanggal_bergabung,
        e.jenis_kelamin,
        e.created_at,
        e.updated_at,
        u.id AS user_id,
        u.email AS user_email,
        u.role AS user_role,
        u.status AS account_status,
        u.last_login_at
      FROM employees e
      LEFT JOIN users u ON u.employee_id = e.id
      WHERE e.nik_ktp = ?
    `);
    return stmt.get(nik) as EmployeeEntity | undefined;
  }

  public generateNextId(): string {
    const rows = db.prepare("SELECT id FROM employees WHERE id LIKE 'EMP-%'").all() as { id: string }[];
    let maxNum = 0;
    for (const r of rows) {
      const match = r.id.match(/^EMP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextNum = maxNum + 1;
    return `EMP-${String(nextNum).padStart(4, "0")}`;
  }

  public create(data: EmployeeCreateInput): EmployeeEntity {
    const id = data.id || this.generateNextId();
    const stmt = db.prepare(`
      INSERT INTO employees (
        id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili,
        jabatan, avatar_url, gaji_pokok, status_karyawan, tanggal_bergabung, jenis_kelamin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.nik_ktp.trim(),
      data.nama_lengkap.trim(),
      data.no_hp ? data.no_hp.trim() : "",
      data.tgl_lahir || "",
      data.wilayah || "",
      data.alamat_domisili || "",
      data.jabatan || "",
      data.avatar_url || null,
      data.gaji_pokok !== undefined ? Number(data.gaji_pokok) : 0,
      data.status_karyawan || "Aktif",
      data.tanggal_bergabung || null,
      data.jenis_kelamin || "Laki-laki"
    );

    const created = this.getById(id);
    if (!created) {
      throw new Error(`Failed to retrieve newly created employee: ${id}`);
    }
    return created;
  }

  public update(id: string, updates: EmployeeUpdateInput): boolean {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.nik_ktp !== undefined) { fields.push("nik_ktp = ?"); values.push(updates.nik_ktp.trim()); }
    if (updates.nama_lengkap !== undefined) { fields.push("nama_lengkap = ?"); values.push(updates.nama_lengkap.trim()); }
    if (updates.no_hp !== undefined) { fields.push("no_hp = ?"); values.push(updates.no_hp ? updates.no_hp.trim() : null); }
    if (updates.tgl_lahir !== undefined) { fields.push("tgl_lahir = ?"); values.push(updates.tgl_lahir); }
    if (updates.wilayah !== undefined) { fields.push("wilayah = ?"); values.push(updates.wilayah); }
    if (updates.alamat_domisili !== undefined) { fields.push("alamat_domisili = ?"); values.push(updates.alamat_domisili); }
    if (updates.jabatan !== undefined) { fields.push("jabatan = ?"); values.push(updates.jabatan); }
    if (updates.avatar_url !== undefined) { fields.push("avatar_url = ?"); values.push(updates.avatar_url); }
    if (updates.gaji_pokok !== undefined) { fields.push("gaji_pokok = ?"); values.push(Number(updates.gaji_pokok)); }
    if (updates.status_karyawan !== undefined) { fields.push("status_karyawan = ?"); values.push(updates.status_karyawan); }
    if (updates.tanggal_bergabung !== undefined) { fields.push("tanggal_bergabung = ?"); values.push(updates.tanggal_bergabung); }
    if (updates.jenis_kelamin !== undefined) { fields.push("jenis_kelamin = ?"); values.push(updates.jenis_kelamin); }

    if (fields.length === 0) return true;

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const stmt = db.prepare(`UPDATE employees SET ${fields.join(", ")} WHERE id = ?`);
    const res = stmt.run(...values);

    // Sync mirrored fields to users table if linked
    const userUpdates: string[] = [];
    const userValues: any[] = [];
    if (updates.nama_lengkap !== undefined) { userUpdates.push("nama = ?"); userValues.push(updates.nama_lengkap.trim()); }
    if (updates.jabatan !== undefined) { userUpdates.push("jabatan = ?"); userValues.push(updates.jabatan); }
    if (updates.avatar_url !== undefined) { userUpdates.push("avatar_url = ?"); userValues.push(updates.avatar_url); }

    if (userUpdates.length > 0) {
      userUpdates.push("updated_at = datetime('now')");
      userValues.push(id);
      try {
        db.prepare(`UPDATE users SET ${userUpdates.join(", ")} WHERE employee_id = ?`).run(...userValues);
      } catch {
        // Ignore if no user is linked
      }
    }

    return res.changes > 0;
  }

  public delete(id: string): boolean {
    const stmt = db.prepare("DELETE FROM employees WHERE id = ?");
    const res = stmt.run(id);
    return res.changes > 0;
  }

  public hasActiveOperationalHistory(id: string): boolean {
    try {
      const reimb = db.prepare("SELECT COUNT(*) as c FROM messenger_reimbursements WHERE employee_id = ?").get(id) as any;
      if (reimb && reimb.c > 0) return true;
    } catch {}

    try {
      const payroll = db.prepare("SELECT COUNT(*) as c FROM payroll_history WHERE employee_id = ?").get(id) as any;
      if (payroll && payroll.c > 0) return true;
    } catch {}

    try {
      const msg = db.prepare("SELECT COUNT(*) as c FROM messengers WHERE employee_id = ?").get(id) as any;
      if (msg && msg.c > 0) return true;
    } catch {}

    return false;
  }
}

export const dbEmployeeRepository = new DbEmployeeRepository();
