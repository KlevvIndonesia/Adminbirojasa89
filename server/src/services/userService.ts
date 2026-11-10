/**
 * User Management Domain Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { dbUserRepository } from "../repositories/dbUserRepository";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { SystemUser } from "../../../src/domain/user/types";
import { hashPassword } from "../utils/crypto";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../utils/crypto";

export class UserService {
  public getAll(): SystemUser[] {
    return dbUserRepository.getAll();
  }

  public getById(id: number | string): SystemUser {
    const user = dbUserRepository.getById(id);
    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", `User ID '${id}' tidak ditemukan.`);
    }
    return user;
  }

  public createUser(payload: {
    nama: string;
    jabatan: string;
    email: string;
    password?: string;
    status?: "Aktif" | "Nonaktif";
    employee_id?: string;
    employeeId?: string;
    phone?: string;
    noHp?: string;
    wilayah?: string;
    alamat?: string;
    tanggal_lahir?: string;
    tanggalLahir?: string;
    gaji_pokok?: number;
    gajiPokok?: number;
    tanggal_bergabung?: string;
    tanggalBergabung?: string;
    jenis_kelamin?: string;
    jenisKelamin?: string;
  }, user?: TokenPayload | null): SystemUser {
    if (!payload.nama || !payload.email || !payload.jabatan) {
      throw new ApiError(400, "VALIDATION_ERROR", "Field nama, email, dan jabatan wajib diisi.");
    }

    const isCallerSvp = user?.role === "administrator" || user?.jabatan === "SVP";
    const targetJabatan = (payload.jabatan || "").toUpperCase().trim();
    const targetRole = ((payload as any).role || "").toLowerCase().trim();
    if ((targetJabatan === "SVP" || targetRole === "administrator" || targetRole === "svp") && !isCallerSvp) {
      throw new ApiError(403, "FORBIDDEN", "Hanya Administrator / SVP yang berwenang membuat akun dengan jabatan/role SVP.");
    }

    const existing = dbUserRepository.getByEmailWithCredentials(payload.email);
    if (existing) {
      throw new ApiError(409, "EMAIL_EXISTS", `User dengan email '${payload.email}' sudah terdaftar.`);
    }

    const rawPassword = payload.password || "admin123";
    const { hash, salt } = hashPassword(rawPassword);

    const created = dbUserRepository.createUser({
      email: payload.email,
      password_hash: hash,
      password_salt: salt,
      nama: payload.nama,
      jabatan: payload.jabatan.toUpperCase(),
      status: payload.status || "Aktif",
      employee_id: payload.employee_id || payload.employeeId,
      phone: payload.phone || payload.noHp,
      wilayah: payload.wilayah,
      alamat: payload.alamat,
      tanggal_lahir: payload.tanggal_lahir || payload.tanggalLahir,
      gaji_pokok: payload.gaji_pokok ?? payload.gajiPokok,
      tanggal_bergabung: payload.tanggal_bergabung || payload.tanggalBergabung,
      jenis_kelamin: payload.jenis_kelamin || payload.jenisKelamin,
    });

    dbAuditRepository.save({
      id: `log-usr-create-${Date.now()}`,
      userId: user?.userId || "usr-admin",
      userName: user?.nama || "Admin",
      userRole: user?.role || "admin",
      action: "CREATE_USER",
      module: "Manajemen Pengguna",
      details: `Menambahkan pengguna baru ${created.nama} (${created.jabatan})`,
      metadata: { createdUser: created },
      createdAt: new Date().toISOString(),
    });

    return created;
  }

  public updateUser(id: number | string, updates: Partial<{ nama: string; jabatan: string; email: string; status: "Aktif" | "Nonaktif" }>, user?: TokenPayload | null): SystemUser {
    const existing = this.getById(id);
    const isCallerSvp = user?.role === "administrator" || user?.jabatan === "SVP";

    // Protect existing SVP accounts from being tampered with by non-SVP
    if ((existing.jabatan === "SVP" || (existing as any).role === "administrator" || (existing as any).role === "svp") && !isCallerSvp) {
      throw new ApiError(403, "FORBIDDEN", "Akun SVP dilindungi oleh sistem dan tidak dapat dimodifikasi oleh role lain.");
    }

    // Prevent non-SVP from promoting anyone or themselves to SVP
    const targetJabatan = (updates.jabatan || "").toUpperCase().trim();
    const targetRole = ((updates as any).role || "").toLowerCase().trim();
    if ((targetJabatan === "SVP" || targetRole === "administrator" || targetRole === "svp") && !isCallerSvp) {
      throw new ApiError(403, "FORBIDDEN", "Hanya Administrator / SVP yang berwenang menetapkan jabatan/role SVP.");
    }

    const normalizedUpdates = {
      ...updates,
      ...(updates.jabatan ? { jabatan: updates.jabatan.toUpperCase() } : {}),
    };

    const success = dbUserRepository.updateUser(id, normalizedUpdates);
    if (!success) {
      throw new ApiError(500, "UPDATE_FAILED", `Gagal memperbarui user ID ${id}`);
    }

    const updated = this.getById(id);

    dbAuditRepository.save({
      id: `log-usr-upd-${Date.now()}`,
      userId: user?.userId || "usr-admin",
      userName: user?.nama || "Admin",
      userRole: user?.role || "admin",
      action: "UPDATE_USER",
      module: "Manajemen Pengguna",
      details: `Memperbarui data pengguna ${updated.nama}`,
      metadata: { id, updates: normalizedUpdates },
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  public deleteUser(id: number | string, user?: TokenPayload | null): boolean {
    const existing = this.getById(id);
    const isCallerSvp = user?.role === "administrator" || user?.jabatan === "SVP";

    // Strictly protect SVP accounts from deletion
    if (existing.jabatan === "SVP" || (existing as any).role === "administrator" || (existing as any).role === "svp") {
      throw new ApiError(403, "FORBIDDEN", "Akun SVP dilindungi oleh sistem dan tidak dapat dihapus.");
    }

    // Prevent users from deleting their own active account
    const targetUserId = `usr-${id}`;
    if (user?.userId === targetUserId || user?.userId === String(id)) {
      throw new ApiError(400, "FORBIDDEN", "Anda tidak dapat menghapus akun Anda sendiri.");
    }

    // Check if user has historical records or assignments in the system
    const hasHistory = dbUserRepository.hasUserHistory(id, (existing as any).employeeId, existing.nama);

    let success = false;
    let actionDetail = "";
    if (hasHistory) {
      // Soft-delete / deactivate to preserve historical integrity, audit trail & task attribution
      success = dbUserRepository.updateUser(id, { status: "Nonaktif" });
      actionDetail = `Menonaktifkan pengguna ${existing.nama} (karena memiliki riwayat transaksi/tugas)`;
    } else {
      // Fresh user without any linked transactions or tasks can be safely deleted
      success = dbUserRepository.deleteUser(id);
      actionDetail = `Menghapus pengguna ${existing.nama}`;
    }

    if (success) {
      dbAuditRepository.save({
        id: `log-usr-del-${Date.now()}`,
        userId: user?.userId || "usr-admin",
        userName: user?.nama || "Admin",
        userRole: user?.role || "admin",
        action: hasHistory ? "DEACTIVATE_USER" : "DELETE_USER",
        module: "Manajemen Pengguna",
        details: actionDetail,
        metadata: { id, name: existing.nama, hasHistory },
        createdAt: new Date().toISOString(),
      });
    }
    return success;
  }

  public resetPassword(id: number | string, callerUser?: TokenPayload | null): { userId: number; nama: string; email: string } {
    const rawId = typeof id === "string" ? id.replace(/^usr-/i, "") : id;
    const targetUser = dbUserRepository.getByIdWithCredentials(rawId);
    if (!targetUser) {
      throw new ApiError(404, "USER_NOT_FOUND", `User ID '${id}' tidak ditemukan.`);
    }

    const isCallerSvp = callerUser?.role === "administrator" || callerUser?.jabatan === "SVP";
    if ((targetUser.jabatan === "SVP" || targetUser.role === "administrator" || targetUser.role === "svp") && !isCallerSvp) {
      throw new ApiError(403, "FORBIDDEN", "Akun SVP dilindungi oleh sistem dan tidak dapat direset oleh role lain.");
    }

    const fullUser = this.getById(rawId);
    const dob = fullUser.tanggalLahir;
    const newPassword = formatDobToPassword(dob);

    const { hash, salt } = hashPassword(newPassword);
    const success = dbUserRepository.updateCredentials(targetUser.id, hash, salt);
    if (!success) {
      throw new ApiError(500, "DATABASE_ERROR", "Gagal memperbarui kata sandi di database.");
    }

    // Security audit log (NEVER log plaintext password or hash!)
    dbAuditRepository.save({
      id: `log-usr-reset-${Date.now()}`,
      userId: callerUser?.userId || "usr-admin",
      userName: callerUser?.nama || "Admin",
      userRole: callerUser?.role || "admin",
      action: "RESET_PASSWORD",
      module: "Manajemen Pengguna",
      details: `Reset kata sandi akun ${targetUser.nama} (${targetUser.email})`,
      metadata: { targetUserId: targetUser.id, targetEmail: targetUser.email },
      createdAt: new Date().toISOString(),
    });

    return {
      userId: targetUser.id,
      nama: targetUser.nama,
      email: targetUser.email,
    };
  }
}

function formatDobToPassword(dobInput?: string | null): string {
  if (!dobInput) return "01011990";
  const str = String(dobInput).trim();

  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-/]/);
    const y = parts[0];
    const m = parts[1].padStart(2, "0");
    const d = parts[2].padStart(2, "0");
    return `${d}${m}${y}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(str)) {
    const parts = str.split(/[-/]/);
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    const y = parts[2];
    return `${d}${m}${y}`;
  }

  return "01011990";
}

export const userService = new UserService();
