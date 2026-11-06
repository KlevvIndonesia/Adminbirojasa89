/**
 * SQLite User Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";
import { SystemUser } from "../../../src/domain/user/types";

export interface UserEntity {
  id: number;
  email: string;
  password_hash: string;
  password_salt: string;
  nama: string;
  jabatan: string;
  status: "Aktif" | "Nonaktif";
  employee_id?: string;
  created_at: string;
  updated_at: string;
}

export class DbUserRepository {
  public getAll(): SystemUser[] {
    const stmt = db.prepare("SELECT * FROM users ORDER BY id ASC");
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      nama: r.nama,
      jabatan: r.jabatan,
      email: r.email,
      status: r.status,
      employeeId: r.employee_id || `EMP-${String(r.id).padStart(3, "0")}`,
      phone: r.phone || r.telepon,
      telepon: r.phone || r.telepon,
      wilayah: r.wilayah || "Jakarta",
      alamat: r.alamat,
      tanggalLahir: r.tanggal_lahir,
      gajiPokok: r.gaji_pokok ? Number(r.gaji_pokok) : undefined,
      tanggalBergabung: r.tanggal_bergabung,
      jenisKelamin: r.jenis_kelamin,
    }));
  }

  public getById(id: number | string): SystemUser | undefined {
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    const row = stmt.get(Number(id)) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      nama: row.nama,
      jabatan: row.jabatan,
      email: row.email,
      status: row.status,
      employeeId: row.employee_id || `EMP-${String(row.id).padStart(3, "0")}`,
      phone: row.phone || row.telepon,
      telepon: row.phone || row.telepon,
      wilayah: row.wilayah || "Jakarta",
      alamat: row.alamat,
      tanggalLahir: row.tanggal_lahir,
      gajiPokok: row.gaji_pokok ? Number(row.gaji_pokok) : undefined,
      tanggalBergabung: row.tanggal_bergabung,
      jenisKelamin: row.jenis_kelamin,
    };
  }

  public getByEmailWithCredentials(email: string): UserEntity | undefined {
    const stmt = db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
    return stmt.get(email.trim()) as UserEntity | undefined;
  }

  public getByIdWithCredentials(id: number | string): UserEntity | undefined {
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(Number(id)) as UserEntity | undefined;
  }

  public createUser(userData: {
    email: string;
    password_hash: string;
    password_salt: string;
    nama: string;
    jabatan: string;
    status: "Aktif" | "Nonaktif";
    employee_id?: string;
    phone?: string;
    wilayah?: string;
    alamat?: string;
    tanggal_lahir?: string;
    gaji_pokok?: number;
    tanggal_bergabung?: string;
    jenis_kelamin?: string;
  }): SystemUser {
    const stmt = db.prepare(`
      INSERT INTO users (
        email, password_hash, password_salt, nama, jabatan, status,
        employee_id, phone, wilayah, alamat, tanggal_lahir, gaji_pokok, tanggal_bergabung, jenis_kelamin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userData.email,
      userData.password_hash,
      userData.password_salt,
      userData.nama,
      userData.jabatan,
      userData.status,
      userData.employee_id || null,
      userData.phone || null,
      userData.wilayah || null,
      userData.alamat || null,
      userData.tanggal_lahir || null,
      userData.gaji_pokok || null,
      userData.tanggal_bergabung || null,
      userData.jenis_kelamin || null
    );
    const newId = Number(result.lastInsertRowid);
    return {
      id: newId,
      nama: userData.nama,
      jabatan: userData.jabatan,
      email: userData.email,
      status: userData.status,
      employeeId: userData.employee_id || `EMP-${String(newId).padStart(3, "0")}`,
      phone: userData.phone,
      wilayah: userData.wilayah,
    };
  }

  public updateUser(id: number | string, updates: any): boolean {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.nama !== undefined) { fields.push("nama = ?"); values.push(updates.nama); }
    if (updates.jabatan !== undefined) { fields.push("jabatan = ?"); values.push(updates.jabatan); }
    if (updates.email !== undefined) { fields.push("email = ?"); values.push(updates.email); }
    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
    if (updates.employeeId !== undefined || updates.employee_id !== undefined) {
      fields.push("employee_id = ?"); values.push(updates.employeeId ?? updates.employee_id);
    }
    if (updates.phone !== undefined || updates.noHp !== undefined || updates.telepon !== undefined) {
      fields.push("phone = ?"); values.push(updates.phone ?? updates.noHp ?? updates.telepon);
    }
    if (updates.wilayah !== undefined) { fields.push("wilayah = ?"); values.push(updates.wilayah); }
    if (updates.alamat !== undefined) { fields.push("alamat = ?"); values.push(updates.alamat); }
    if (updates.tanggalLahir !== undefined || updates.tanggal_lahir !== undefined) {
      fields.push("tanggal_lahir = ?"); values.push(updates.tanggalLahir ?? updates.tanggal_lahir);
    }
    if (updates.gajiPokok !== undefined || updates.gaji_pokok !== undefined) {
      fields.push("gaji_pokok = ?"); values.push(updates.gajiPokok ?? updates.gaji_pokok);
    }
    if (updates.tanggalBergabung !== undefined || updates.tanggal_bergabung !== undefined) {
      fields.push("tanggal_bergabung = ?"); values.push(updates.tanggalBergabung ?? updates.tanggal_bergabung);
    }
    if (updates.jenisKelamin !== undefined || updates.jenis_kelamin !== undefined) {
      fields.push("jenis_kelamin = ?"); values.push(updates.jenisKelamin ?? updates.jenis_kelamin);
    }

    if (fields.length === 0) return true;
    fields.push("updated_at = datetime('now')");
    values.push(Number(id));

    const stmt = db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`);
    const res = stmt.run(...values);
    return res.changes > 0;
  }

  public updateCredentials(id: number | string, password_hash: string, password_salt: string): boolean {
    const stmt = db.prepare(`
      UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?
    `);
    const res = stmt.run(password_hash, password_salt, Number(id));
    return res.changes > 0;
  }

  public deleteUser(id: number | string): boolean {
    const stmt = db.prepare("DELETE FROM users WHERE id = ?");
    const res = stmt.run(Number(id));
    return res.changes > 0;
  }

  public hasUserHistory(id: number | string, employeeId?: string, nama?: string): boolean {
    const numericId = Number(id);
    const empId = employeeId || `EMP-${String(numericId).padStart(3, "0")}`;

    try {
      const reimbStmt = db.prepare("SELECT COUNT(*) as count FROM messenger_reimbursements WHERE employee_id = ? OR employee_id = ?");
      const reimbRow = reimbStmt.get(empId, String(numericId)) as any;
      if (reimbRow && reimbRow.count > 0) return true;
    } catch {
      // ignore
    }

    try {
      if (nama) {
        const kasMsgStmt = db.prepare("SELECT COUNT(*) as count FROM kas_messenger WHERE messenger = ? OR penanggung_jawab = ?");
        const kasMsgRow = kasMsgStmt.get(nama, nama) as any;
        if (kasMsgRow && kasMsgRow.count > 0) return true;
      }
    } catch {
      // ignore
    }

    try {
      const auditStmt = db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ? OR user_id = ?");
      const auditRow = auditStmt.get(`usr-${numericId}`, String(numericId)) as any;
      if (auditRow && auditRow.count > 0) return true;
    } catch {
      // ignore
    }

    try {
      const orderStmt = db.prepare("SELECT COUNT(*) as count FROM orders WHERE data_json LIKE ? OR data_json LIKE ?");
      const orderRow = orderStmt.get(`%${empId}%`, nama ? `%${nama}%` : `%${empId}%`) as any;
      if (orderRow && orderRow.count > 0) return true;
    } catch {
      // ignore
    }

    return false;
  }
}

export const dbUserRepository = new DbUserRepository();
