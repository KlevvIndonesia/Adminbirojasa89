/**
 * Authentication Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { dbUserRepository, UserEntity } from "../repositories/dbUserRepository";
import { verifyPassword, hashPassword, needsRehash, generateToken, TokenPayload } from "../utils/crypto";
import { ApiError } from "../middleware/errorHandler";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { db } from "../database/db";

/**
 * Validates and resolves the canonical employee identity for a messenger account.
 * Rejects unmapped accounts, inactive employees, or accounts missing valid employee links.
 */
function resolveAndVerifyMessengerEmployee(userEntity: UserEntity): {
  ok: true;
  employeeId: string;
} | {
  ok: false;
  status: number;
  code: string;
  message: string;
} {
  const cleanEmail = (userEntity.email || "").trim().toLowerCase();
  const empId = userEntity.employee_id ? String(userEntity.employee_id).trim() : null;

  // 1. Check employee_accounts and employees table by email
  let eaRecord: { id: string; employee_id: string; status_aktif: number; status_karyawan: string; nama_lengkap: string } | undefined;
  try {
    const eaStmt = db.prepare(`
      SELECT ea.id, ea.employee_id, ea.status_aktif, e.status_karyawan, e.nama_lengkap
      FROM employee_accounts ea
      JOIN employees e ON ea.employee_id = e.id
      WHERE LOWER(ea.email) = ?
    `);
    eaRecord = eaStmt.get(cleanEmail) as any;
  } catch (err) {
    // If table doesn't exist in some isolated test mocks
  }

  if (eaRecord) {
    if (eaRecord.status_aktif !== 1) {
      return { ok: false, status: 403, code: "EMPLOYEE_INACTIVE", message: "Akun karyawan messenger berstatus nonaktif." };
    }
    if (eaRecord.status_karyawan === "NONAKTIF") {
      return { ok: false, status: 403, code: "EMPLOYEE_INACTIVE", message: "Status karyawan messenger nonaktif." };
    }
  }

  // 2. Reject if userEntity has no employee_id
  if (!empId) {
    return {
      ok: false,
      status: 403,
      code: "MESSENGER_NO_EMPLOYEE_ID",
      message: "Akun messenger tidak memiliki identitas karyawan yang terdaftar.",
    };
  }

  // 3. Verify empId against employees table if employees table exists
  let empRecord: { id: string; status_karyawan: string } | undefined;
  try {
    const empStmt = db.prepare("SELECT id, status_karyawan FROM employees WHERE id = ?");
    empRecord = empStmt.get(empId) as any;
  } catch (err) {}

  if (empRecord) {
    if (empRecord.status_karyawan === "NONAKTIF") {
      return { ok: false, status: 403, code: "EMPLOYEE_INACTIVE", message: "Status karyawan messenger nonaktif." };
    }
  } else if (!eaRecord) {
    // empId not in employees table AND email not in employee_accounts
    return {
      ok: false,
      status: 403,
      code: "EMPLOYEE_NOT_FOUND",
      message: "Identitas karyawan messenger tidak ditemukan dalam sistem.",
    };
  }

  return { ok: true, employeeId: empId };
}

export class AuthService {
  public async login(email?: string, password?: string): Promise<{ token: string; user: any }> {
    // 1. Enforce strict non-empty credentials validation (Prevents passwordless bypass)
    if (!email || typeof email !== "string" || !email.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Email wajib diisi.");
    }

    if (!password || typeof password !== "string" || !password.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Password wajib diisi.");
    }

    const cleanEmail = email.trim().toLowerCase();
    const userEntity = dbUserRepository.getByEmailWithCredentials(cleanEmail);
    if (!userEntity) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email atau password tidak valid.");
    }

    if (userEntity.status !== "Aktif") {
      throw new ApiError(403, "ACCOUNT_INACTIVE", "Akun Anda tidak aktif.");
    }

    // 2. Validate password hash
    const isValid = verifyPassword(password, userEntity.password_hash, userEntity.password_salt);
    if (!isValid) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email atau password tidak valid.");
    }

    // 3. Transparent password hash upgrade if account was stored with legacy PBKDF2 iterations
    if (needsRehash(userEntity.password_hash)) {
      try {
        const { hash: newHash, salt: newSalt } = hashPassword(password);
        dbUserRepository.updateCredentials(userEntity.id, newHash, newSalt);
      } catch (rehashErr) {
        console.warn("[AuthService] Warning: Failed to upgrade legacy password hash:", rehashErr);
      }
    }

    // Map jabatan to application role
    const roleMap: Record<string, 'administrator' | 'finance' | 'admin' | 'messenger'> = {
      SVP: "administrator",
      ADMIN: "admin",
      FINANCE: "finance",
      MESSENGER: "messenger",
    };
    const role = roleMap[userEntity.jabatan] || "admin";

    let resolvedEmployeeId: string | undefined = userEntity.employee_id || undefined;
    if (role === "messenger") {
      const empRes = resolveAndVerifyMessengerEmployee(userEntity);
      if (empRes.ok === true) {
        resolvedEmployeeId = empRes.employeeId;
      } else {
        throw new ApiError(empRes.status, empRes.code, empRes.message);
      }
    } else if (!resolvedEmployeeId) {
      try {
        const eaStmt = db.prepare(`
          SELECT ea.employee_id 
          FROM employee_accounts ea 
          JOIN employees e ON ea.employee_id = e.id 
          WHERE LOWER(ea.email) = ? AND ea.status_aktif = 1
        `);
        const eaRecord = eaStmt.get(cleanEmail) as { employee_id: string } | undefined;
        if (eaRecord && eaRecord.employee_id) {
          resolvedEmployeeId = eaRecord.employee_id;
        }
      } catch (err) {}
    }

    const token = generateToken({
      userId: `usr-${userEntity.id}`,
      email: userEntity.email,
      nama: userEntity.nama,
      jabatan: userEntity.jabatan,
      role,
      employeeId: resolvedEmployeeId,
    });

    // Record login audit log
    dbAuditRepository.save({
      id: `log-auth-${Date.now()}`,
      userId: `usr-${userEntity.id}`,
      userName: userEntity.nama,
      userRole: role,
      action: "LOGIN",
      module: "Authentication",
      details: `User ${userEntity.nama} (${role}) berhasil login.`,
      createdAt: new Date().toISOString(),
    });

    return {
      token,
      user: {
        id: userEntity.id,
        userId: `usr-${userEntity.id}`,
        email: userEntity.email,
        nama: userEntity.nama,
        jabatan: userEntity.jabatan,
        role,
        employeeId: resolvedEmployeeId,
        status: userEntity.status,
      },
    };
  }

  public getMe(userPayload: TokenPayload) {
    const user = dbUserRepository.getById(userPayload.userId.replace("usr-", ""));
    return {
      ...userPayload,
      ...(user || {}),
    };
  }

  /**
   * Secure self-service password change
   * Verifies current password, enforces minimum complexity, and stores modern hash.
   */
  public async changePassword(
    payload: { oldPassword?: string; newPassword?: string; confirmPassword?: string },
    userPayload: TokenPayload
  ): Promise<{ success: boolean; message: string; token: string }> {
    const { oldPassword, newPassword, confirmPassword } = payload || {};

    // 1. Strict validation of payload
    if (!oldPassword || typeof oldPassword !== "string" || !oldPassword.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Kata sandi saat ini wajib diisi.");
    }

    if (!newPassword || typeof newPassword !== "string" || !newPassword.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Kata sandi baru wajib diisi.");
    }

    if (!confirmPassword || typeof confirmPassword !== "string" || !confirmPassword.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Konfirmasi kata sandi baru wajib diisi.");
    }

    const trimmedNew = newPassword.trim();
    if (trimmedNew.length < 8) {
      throw new ApiError(400, "VALIDATION_ERROR", "Kata sandi baru minimal 8 karakter.");
    }

    if (newPassword !== confirmPassword) {
      throw new ApiError(400, "VALIDATION_ERROR", "Konfirmasi kata sandi baru tidak cocok.");
    }

    if (oldPassword === newPassword) {
      throw new ApiError(400, "VALIDATION_ERROR", "Kata sandi baru tidak boleh sama dengan kata sandi saat ini.");
    }

    // 2. Fetch user strictly by authenticated token identity (Prevents IDOR)
    const rawId = userPayload.userId.replace("usr-", "");
    const user = dbUserRepository.getByIdWithCredentials(rawId) || dbUserRepository.getByEmailWithCredentials(userPayload.email);
    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "Data akun pengguna tidak ditemukan.");
    }

    if (user.status !== "Aktif") {
      throw new ApiError(403, "ACCOUNT_INACTIVE", "Akun Anda tidak aktif.");
    }

    // 3. Verify current password
    const isOldValid = verifyPassword(oldPassword, user.password_hash, user.password_salt);
    if (!isOldValid) {
      throw new ApiError(400, "INVALID_CURRENT_PASSWORD", "Kata sandi saat ini salah.");
    }

    // 4. Hash new password with modern PBKDF2 SHA-512 (600,000 iterations)
    const { hash: newHash, salt: newSalt } = hashPassword(newPassword);
    const updated = dbUserRepository.updateCredentials(user.id, newHash, newSalt);
    if (!updated) {
      throw new ApiError(500, "DATABASE_ERROR", "Gagal memperbarui kata sandi di database.");
    }

    // 5. Generate fresh token
    const roleMap: Record<string, 'administrator' | 'finance' | 'admin' | 'messenger'> = {
      SVP: "administrator",
      ADMIN: "admin",
      FINANCE: "finance",
      MESSENGER: "messenger",
    };
    const role = roleMap[user.jabatan] || "admin";

    let resolvedEmployeeId: string | undefined = user.employee_id || undefined;
    if (role === "messenger") {
      const empRes = resolveAndVerifyMessengerEmployee(user);
      if (empRes.ok === true) {
        resolvedEmployeeId = empRes.employeeId;
      } else {
        throw new ApiError(empRes.status, empRes.code, empRes.message);
      }
    } else if (!resolvedEmployeeId) {
      try {
        const eaStmt = db.prepare(`
          SELECT ea.employee_id 
          FROM employee_accounts ea 
          JOIN employees e ON ea.employee_id = e.id 
          WHERE LOWER(ea.email) = ? AND ea.status_aktif = 1
        `);
        const eaRecord = eaStmt.get((user.email || "").trim().toLowerCase()) as { employee_id: string } | undefined;
        if (eaRecord && eaRecord.employee_id) {
          resolvedEmployeeId = eaRecord.employee_id;
        }
      } catch (err) {}
    }

    const freshToken = generateToken({
      userId: `usr-${user.id}`,
      email: user.email,
      nama: user.nama,
      jabatan: user.jabatan,
      role,
      employeeId: resolvedEmployeeId,
    });

    // 6. Record security audit log (WITHOUT revealing any password)
    dbAuditRepository.save({
      id: `log-pwd-${Date.now()}`,
      userId: `usr-${user.id}`,
      userName: user.nama,
      userRole: role,
      action: "CHANGE_PASSWORD",
      module: "Authentication",
      details: `Pengguna ${user.nama} (${role}) berhasil mengubah kata sandi akunnya.`,
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Kata sandi berhasil diperbarui. Perubahan berlaku pada sesi berikutnya.",
      token: freshToken,
    };
  }
}

export const authService = new AuthService();
