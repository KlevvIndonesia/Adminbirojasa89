/**
 * SQLite User Repository
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Canonical repository for `users` table:
 * Single Source of Truth for authentication, credentials, roles, and system access.
 * Personal/demographic data is joined from canonical `employees` table via `employee_id`.
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
  role: string;
  status: "Aktif" | "Nonaktif";
  employee_id?: string | null;
  avatar_url?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

function parseUserId(id: number | string): number | null {
  if (typeof id === "number") return isNaN(id) ? null : id;
  const str = String(id).trim();
  if (str.startsWith("usr-")) {
    const num = Number(str.replace(/^usr-/, ""));
    return isNaN(num) ? null : num;
  }
  const num = Number(str);
  return isNaN(num) ? null : num;
}

export class DbUserRepository {
  public getAll(): SystemUser[] {
    const stmt = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.nama,
        u.jabatan,
        u.role,
        u.status,
        u.employee_id,
        u.avatar_url,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        e.nik_ktp,
        e.no_hp as phone,
        e.wilayah,
        e.alamat_domisili as alamat,
        e.tgl_lahir as tanggal_lahir,
        e.gaji_pokok,
        e.tanggal_bergabung,
        e.jenis_kelamin
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      ORDER BY u.id ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      nama: r.nama,
      jabatan: r.jabatan,
      role: r.role || "admin",
      email: r.email,
      status: r.status,
      employeeId: r.employee_id || undefined,
      employee_id: r.employee_id || null,
      avatarUrl: r.avatar_url || undefined,
      avatar: r.avatar_url || undefined,
      phone: r.phone || undefined,
      telepon: r.phone || undefined,
      wilayah: r.wilayah || undefined,
      alamat: r.alamat || undefined,
      tanggalLahir: r.tanggal_lahir || undefined,
      gajiPokok: r.gaji_pokok !== null && r.gaji_pokok !== undefined ? Number(r.gaji_pokok) : undefined,
      tanggalBergabung: r.tanggal_bergabung || undefined,
      jenisKelamin: r.jenis_kelamin || undefined,
      lastLogin: r.last_login_at || undefined,
      last_login_at: r.last_login_at || undefined,
      createdAt: r.created_at,
    }));
  }

  public getById(id: number | string): SystemUser | undefined {
    const numericId = parseUserId(id);
    if (numericId === null) return undefined;
    const stmt = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.nama,
        u.jabatan,
        u.role,
        u.status,
        u.employee_id,
        u.avatar_url,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        e.nik_ktp,
        e.no_hp as phone,
        e.wilayah,
        e.alamat_domisili as alamat,
        e.tgl_lahir as tanggal_lahir,
        e.gaji_pokok,
        e.tanggal_bergabung,
        e.jenis_kelamin
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.id = ?
    `);
    const row = stmt.get(numericId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      nama: row.nama,
      jabatan: row.jabatan,
      role: row.role || "admin",
      email: row.email,
      status: row.status,
      employeeId: row.employee_id || undefined,
      employee_id: row.employee_id || null,
      avatarUrl: row.avatar_url || undefined,
      avatar: row.avatar_url || undefined,
      phone: row.phone || undefined,
      telepon: row.phone || undefined,
      wilayah: row.wilayah || undefined,
      alamat: row.alamat || undefined,
      tanggalLahir: row.tanggal_lahir || undefined,
      gajiPokok: row.gaji_pokok !== null && row.gaji_pokok !== undefined ? Number(row.gaji_pokok) : undefined,
      tanggalBergabung: row.tanggal_bergabung || undefined,
      jenisKelamin: row.jenis_kelamin || undefined,
      lastLogin: row.last_login_at || undefined,
      last_login_at: row.last_login_at || undefined,
      createdAt: row.created_at,
    };
  }

  public getByEmployeeId(employeeId: string): SystemUser | undefined {
    if (!employeeId) return undefined;
    const stmt = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.nama,
        u.jabatan,
        u.role,
        u.status,
        u.employee_id,
        u.avatar_url,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        e.nik_ktp,
        e.no_hp as phone,
        e.wilayah,
        e.alamat_domisili as alamat,
        e.tgl_lahir as tanggal_lahir,
        e.gaji_pokok,
        e.tanggal_bergabung,
        e.jenis_kelamin
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.employee_id = ?
    `);
    const row = stmt.get(employeeId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      nama: row.nama,
      jabatan: row.jabatan,
      role: row.role || "admin",
      email: row.email,
      status: row.status,
      employeeId: row.employee_id || undefined,
      employee_id: row.employee_id || null,
      avatarUrl: row.avatar_url || undefined,
      avatar: row.avatar_url || undefined,
      phone: row.phone || undefined,
      telepon: row.phone || undefined,
      wilayah: row.wilayah || undefined,
      alamat: row.alamat || undefined,
      tanggalLahir: row.tanggal_lahir || undefined,
      gajiPokok: row.gaji_pokok !== null && row.gaji_pokok !== undefined ? Number(row.gaji_pokok) : undefined,
      tanggalBergabung: row.tanggal_bergabung || undefined,
      jenisKelamin: row.jenis_kelamin || undefined,
      lastLogin: row.last_login_at || undefined,
      last_login_at: row.last_login_at || undefined,
      createdAt: row.created_at,
    };
  }

  public getByEmailWithCredentials(email: string): UserEntity | undefined {
    const stmt = db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
    return stmt.get(email.trim()) as UserEntity | undefined;
  }

  public getByIdWithCredentials(id: number | string): UserEntity | undefined {
    const numericId = parseUserId(id);
    if (numericId === null) return undefined;
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(numericId) as UserEntity | undefined;
  }

  public createUser(userData: {
    email: string;
    password_hash: string;
    password_salt: string;
    nama: string;
    jabatan: string;
    role?: string;
    status: "Aktif" | "Nonaktif";
    employee_id?: string | null;
    avatar_url?: string | null;
    avatarUrl?: string | null;
    phone?: string;
    wilayah?: string;
    alamat?: string;
    tanggal_lahir?: string;
    gaji_pokok?: number;
    tanggal_bergabung?: string;
    jenis_kelamin?: string;
  }): SystemUser {
    const canonicalRoleMap: Record<string, string> = {
      SVP: "administrator",
      ADMIN: "admin",
      FINANCE: "finance",
      MESSENGER: "messenger",
      KURIR: "messenger",
    };
    const role = userData.role || canonicalRoleMap[(userData.jabatan || "").toUpperCase().trim()] || "admin";
    const avatarUrl = userData.avatar_url || userData.avatarUrl || null;
    const employeeId = userData.employee_id || null;

    const stmt = db.prepare(`
      INSERT INTO users (
        email, password_hash, password_salt, nama, jabatan, role, status,
        employee_id, avatar_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userData.email.trim(),
      userData.password_hash,
      userData.password_salt,
      userData.nama.trim(),
      userData.jabatan.trim(),
      role,
      userData.status,
      employeeId,
      avatarUrl
    );
    const newId = Number(result.lastInsertRowid);

    // If an employee_id is linked and personal attributes were passed in, sync them to employees
    if (employeeId) {
      const empUpdates: string[] = [];
      const empValues: any[] = [];
      if (userData.phone) { empUpdates.push("no_hp = ?"); empValues.push(userData.phone); }
      if (userData.wilayah) { empUpdates.push("wilayah = ?"); empValues.push(userData.wilayah); }
      if (userData.alamat) { empUpdates.push("alamat_domisili = ?"); empValues.push(userData.alamat); }
      if (userData.tanggal_lahir) { empUpdates.push("tgl_lahir = ?"); empValues.push(userData.tanggal_lahir); }
      if (userData.gaji_pokok !== undefined) { empUpdates.push("gaji_pokok = ?"); empValues.push(userData.gaji_pokok); }
      if (userData.tanggal_bergabung) { empUpdates.push("tanggal_bergabung = ?"); empValues.push(userData.tanggal_bergabung); }
      if (userData.jenis_kelamin) { empUpdates.push("jenis_kelamin = ?"); empValues.push(userData.jenis_kelamin); }
      if (avatarUrl) { empUpdates.push("avatar_url = ?"); empValues.push(avatarUrl); }

      if (empUpdates.length > 0) {
        empUpdates.push("updated_at = datetime('now')");
        empValues.push(employeeId);
        try {
          db.prepare(`UPDATE employees SET ${empUpdates.join(", ")} WHERE id = ?`).run(...empValues);
        } catch {
          // Ignore if employee does not exist
        }
      }
    }

    return {
      id: newId,
      nama: userData.nama,
      jabatan: userData.jabatan,
      role,
      email: userData.email,
      status: userData.status,
      employeeId: employeeId || undefined,
      employee_id: employeeId,
      avatarUrl: avatarUrl || undefined,
      phone: userData.phone,
      wilayah: userData.wilayah,
    };
  }

  public updateUser(id: number | string, updates: any): boolean {
    const userFields: string[] = [];
    const userValues: any[] = [];

    if (updates.nama !== undefined) { userFields.push("nama = ?"); userValues.push(updates.nama.trim()); }
    if (updates.jabatan !== undefined) {
      userFields.push("jabatan = ?");
      userValues.push(updates.jabatan.trim());
      if (updates.role === undefined) {
        const canonicalRoleMap: Record<string, string> = {
          SVP: "administrator",
          ADMIN: "admin",
          FINANCE: "finance",
          MESSENGER: "messenger",
          KURIR: "messenger",
        };
        const mapped = canonicalRoleMap[updates.jabatan.trim().toUpperCase()];
        if (mapped) {
          userFields.push("role = ?");
          userValues.push(mapped);
        }
      }
    }
    if (updates.email !== undefined) { userFields.push("email = ?"); userValues.push(updates.email.trim()); }
    if (updates.role !== undefined) { userFields.push("role = ?"); userValues.push(updates.role); }
    if (updates.status !== undefined) { userFields.push("status = ?"); userValues.push(updates.status); }
    if (updates.avatar_url !== undefined || updates.avatarUrl !== undefined || updates.avatar !== undefined) {
      userFields.push("avatar_url = ?"); userValues.push(updates.avatar_url ?? updates.avatarUrl ?? updates.avatar ?? null);
    }
    if (updates.employeeId !== undefined || updates.employee_id !== undefined) {
      userFields.push("employee_id = ?"); userValues.push(updates.employeeId ?? updates.employee_id ?? null);
    }
    if (updates.last_login_at !== undefined || updates.lastLogin !== undefined) {
      userFields.push("last_login_at = ?"); userValues.push(updates.last_login_at ?? updates.lastLogin);
    }

    const numericId = parseUserId(id);
    if (numericId === null) return false;

    let userChanged = false;
    if (userFields.length > 0) {
      userFields.push("updated_at = datetime('now')");
      userValues.push(numericId);
      const stmt = db.prepare(`UPDATE users SET ${userFields.join(", ")} WHERE id = ?`);
      const res = stmt.run(...userValues);
      userChanged = res.changes > 0;
    }

    // Handle personal/employee demographic fields if provided
    const empFields: string[] = [];
    const empValues: any[] = [];
    if (updates.phone !== undefined || updates.noHp !== undefined || updates.telepon !== undefined) {
      empFields.push("no_hp = ?"); empValues.push(updates.phone ?? updates.noHp ?? updates.telepon);
    }
    if (updates.wilayah !== undefined) { empFields.push("wilayah = ?"); empValues.push(updates.wilayah); }
    if (updates.alamat !== undefined) { empFields.push("alamat_domisili = ?"); empValues.push(updates.alamat); }
    if (updates.tanggalLahir !== undefined || updates.tanggal_lahir !== undefined) {
      empFields.push("tgl_lahir = ?"); empValues.push(updates.tanggalLahir ?? updates.tanggal_lahir);
    }
    if (updates.gajiPokok !== undefined || updates.gaji_pokok !== undefined) {
      empFields.push("gaji_pokok = ?"); empValues.push(updates.gajiPokok ?? updates.gaji_pokok);
    }
    if (updates.tanggalBergabung !== undefined || updates.tanggal_bergabung !== undefined) {
      empFields.push("tanggal_bergabung = ?"); empValues.push(updates.tanggalBergabung ?? updates.tanggal_bergabung);
    }
    if (updates.jenisKelamin !== undefined || updates.jenis_kelamin !== undefined) {
      empFields.push("jenis_kelamin = ?"); empValues.push(updates.jenisKelamin ?? updates.jenis_kelamin);
    }
    if (updates.avatar_url !== undefined || updates.avatarUrl !== undefined || updates.avatar !== undefined) {
      empFields.push("avatar_url = ?"); empValues.push(updates.avatar_url ?? updates.avatarUrl ?? updates.avatar ?? null);
    }

    if (empFields.length > 0) {
      const currentUser = db.prepare("SELECT employee_id FROM users WHERE id = ?").get(numericId) as { employee_id?: string } | undefined;
      const targetEmpId = updates.employeeId ?? updates.employee_id ?? currentUser?.employee_id;
      if (targetEmpId) {
        empFields.push("updated_at = datetime('now')");
        empValues.push(targetEmpId);
        try {
          const empStmt = db.prepare(`UPDATE employees SET ${empFields.join(", ")} WHERE id = ?`);
          empStmt.run(...empValues);
        } catch {
          // Ignore if employee update fails
        }
      }
    }

    return userChanged || userFields.length === 0;
  }

  public updateCredentials(id: number | string, password_hash: string, password_salt: string): boolean {
    const numericId = parseUserId(id);
    if (numericId === null) return false;
    const stmt = db.prepare(`
      UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?
    `);
    const res = stmt.run(password_hash, password_salt, numericId);
    return res.changes > 0;
  }

  public deleteUser(id: number | string): boolean {
    const numericId = parseUserId(id);
    if (numericId === null) return false;
    const stmt = db.prepare("DELETE FROM users WHERE id = ?");
    const res = stmt.run(numericId);
    return res.changes > 0;
  }

  public hasUserHistory(id: number | string, employeeId?: string, nama?: string): boolean {
    const numericId = parseUserId(id);
    if (numericId === null) return false;
    let empId = employeeId;
    if (!empId) {
      const u = db.prepare("SELECT employee_id FROM users WHERE id = ?").get(numericId) as any;
      empId = u?.employee_id || undefined;
    }

    try {
      if (empId) {
        const reimbStmt = db.prepare("SELECT COUNT(*) as count FROM messenger_reimbursements WHERE employee_id = ?");
        const reimbRow = reimbStmt.get(empId) as any;
        if (reimbRow && reimbRow.count > 0) return true;
      }
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
      const orderRow = orderStmt.get(empId ? `%${empId}%` : `%usr-${numericId}%`, nama ? `%${nama}%` : `%usr-${numericId}%`) as any;
      if (orderRow && orderRow.count > 0) return true;
    } catch {
      // ignore
    }

    return false;
  }
}

export const dbUserRepository = new DbUserRepository();
