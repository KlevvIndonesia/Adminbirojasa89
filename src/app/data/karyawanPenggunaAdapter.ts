/**
 * Karyawan -> Pengguna Authoritative Data Adapter
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Rules (Phase 3 Canonical Integration):
 * 1. `employees` (/api/employees) is the authoritative Single Source of Truth for employee identity and employment.
 * 2. `users` (/api/users) is the authoritative Single Source of Truth for login credentials, roles, and account status.
 * 3. Relationship is maintained via canonical foreign key `users.employee_id REFERENCES employees(id)`.
 * 4. Separation of Concerns: Account status (`statusAkun`) is distinct from employment status (`status_karyawan`).
 * 5. Password reset format is derived from employee date of birth (`tanggalLahir`) in DDMMYYYY format.
 */

import { useState, useEffect } from "react";
import { auditLog } from "../utils/auditLog";
import { userRepository } from "../../data/repositories/userRepository";
import { apiEmployeeProvider } from "../../data/api/apiEmployeeProvider";
import { APP_CONFIG } from "../config/appConfig";

export interface KaryawanRecord {
  id: string; // e.g. "EMP-0001"
  nama: string;
  jabatan: "ADMIN" | "FINANCE" | "SVP" | "MESSENGER" | "CLILEN" | string;
  wilayah: string;
  status: "Aktif" | "Nonaktif" | string;
  noHp: string;
  email: string;
  jenisKelamin: "Laki-laki" | "Perempuan" | string;
  alamat: string;
  gajiPokok: number;
  tanggalBergabung: string;
  tanggalLahir: string; // Format: "YYYY-MM-DD" or "DD/MM/YYYY"
  nikKtp?: string;
  nik_ktp?: string;
  userId?: number | string | null;
  hasAccount?: boolean;
}

export interface PenggunaRecord {
  id: string; // e.g. "1" or "USR-001"
  employeeId: string; // FK -> KaryawanRecord.id (empty string if unlinked)
  nama: string; // Account holder name
  jabatan: string; // Title
  email: string; // Username / email
  role: "admin" | "finance" | "svp" | "messenger" | "clilen" | string;
  statusAkun: "Aktif" | "Nonaktif" | "Belum Aktif";
  terakhirLogin: string;
  passwordHash?: string; // Masked / In-memory storage
  lastResetAt?: string;
  employeeInfo?: KaryawanRecord | null;
}

// Initial Employees with exact test-case DOBs (for mock mode)
export const INITIAL_KARYAWAN: KaryawanRecord[] = [
  {
    id: "EMP-0001",
    nama: "Budi Santoso",
    jabatan: "SVP",
    wilayah: "Jakarta Barat",
    status: "Aktif",
    noHp: "081234567896",
    email: "svp@birojasa.com",
    jenisKelamin: "Laki-laki",
    alamat: "Jl. Kenanga No. 12, Jakarta Barat",
    gajiPokok: 8500000,
    tanggalBergabung: "2021-09-05",
    tanggalLahir: "2001-10-10", // 10 Oktober 2001 -> Reset Password: 10102001
    nikKtp: "3175081010010001",
  },
  {
    id: "EMP-0002",
    nama: "Siti Nurhaliza",
    jabatan: "ADMIN",
    wilayah: "Jakarta Timur",
    status: "Aktif",
    noHp: "081234567893",
    email: "admin@birojasa.com",
    jenisKelamin: "Perempuan",
    alamat: "Jl. Melati No. 123, Jakarta Timur",
    gajiPokok: 5000000,
    tanggalBergabung: "2023-01-15",
    tanggalLahir: "2000-01-05", // 05 Januari 2000 -> Reset Password: 05012000
    nikKtp: "3175080501000002",
  },
  {
    id: "EMP-0003",
    nama: "Andi Wijaya",
    jabatan: "FINANCE",
    wilayah: "Jakarta Selatan",
    status: "Aktif",
    noHp: "081234567894",
    email: "finance@birojasa.com",
    jenisKelamin: "Laki-laki",
    alamat: "Jl. Mawar No. 45, Jakarta Selatan",
    gajiPokok: 7000000,
    tanggalBergabung: "2022-06-10",
    tanggalLahir: "1998-07-15",
    nikKtp: "3175081507980003",
  },
  {
    id: "EMP-0004",
    nama: "Budi Santoso",
    jabatan: "MESSENGER",
    wilayah: "Jakarta Pusat",
    status: "Aktif",
    noHp: "081299887766",
    email: "budi.messenger@birojasa.com",
    jenisKelamin: "Laki-laki",
    alamat: "Jl. Lapangan Banteng Barat No. 10, Jakarta Pusat",
    gajiPokok: 4800000,
    tanggalBergabung: "2023-01-10",
    tanggalLahir: "1998-05-15",
    nikKtp: "3175081505980004",
  },
  {
    id: "EMP-0005",
    nama: "Andi Pratama",
    jabatan: "MESSENGER",
    wilayah: "Jakarta Selatan",
    status: "Aktif",
    noHp: "081299887755",
    email: "andi.messenger@birojasa.com",
    jenisKelamin: "Laki-laki",
    alamat: "Jl. Panglima Polim No. 25, Jakarta Selatan",
    gajiPokok: 4800000,
    tanggalBergabung: "2023-02-15",
    tanggalLahir: "1999-08-20",
    nikKtp: "3175082008990005",
  },
  {
    id: "EMP-0006",
    nama: "Messenger Cadangan",
    jabatan: "MESSENGER",
    wilayah: "Jakarta Utara",
    status: "Aktif",
    noHp: "081234567888",
    email: "messenger@birojasa.com",
    jenisKelamin: "Laki-laki",
    alamat: "Jl. Pluit Raya No. 88, Jakarta Utara",
    gajiPokok: 4500000,
    tanggalBergabung: "2023-04-01",
    tanggalLahir: "1997-11-10",
    nikKtp: "3175081011970006",
  },
];

// Initial Accounts linked to Employees (for mock mode)
const INITIAL_PENGGUNA: PenggunaRecord[] = INITIAL_KARYAWAN.map((emp, index) => {
  const roleMap: Record<string, "admin" | "finance" | "svp" | "messenger" | "clilen"> = {
    ADMIN: "admin",
    FINANCE: "finance",
    SVP: "svp",
    MESSENGER: "messenger",
    CLILEN: "clilen",
  };

  return {
    id: String(index + 1),
    employeeId: emp.id,
    nama: emp.nama,
    jabatan: emp.jabatan,
    email: emp.email,
    role: roleMap[emp.jabatan] || "admin",
    statusAkun: "Aktif",
    terakhirLogin: "2026-09-24 14:32",
    passwordHash: formatDobToPassword(emp.tanggalLahir),
  };
});

/**
 * Convert any date of birth format into strict DDMMYYYY format
 */
export function formatDobToPassword(dobInput: string): string {
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

  // Fallback with standard Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = String(parsed.getFullYear());
    return `${d}${m}${y}`;
  }

  return "01011990";
}

// In-Memory Authoritative Data Store
let isApiMode = APP_CONFIG.dataProvider === "api";
let karyawanList: KaryawanRecord[] = isApiMode ? [] : [...INITIAL_KARYAWAN];
let penggunaList: PenggunaRecord[] = isApiMode ? [] : [...INITIAL_PENGGUNA];
let lastApiError: string | null = null;
let isDataStale = false;
let hasSuccessfullyLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function syncFromSources() {
  const repoError = userRepository.getError ? userRepository.getError() : null;
  const empError = apiEmployeeProvider.getError ? apiEmployeeProvider.getError() : null;
  const repoLoading = userRepository.isLoading ? userRepository.isLoading() : false;
  const empLoading = apiEmployeeProvider.isLoading ? apiEmployeeProvider.isLoading() : false;

  const currentError = empError || repoError;
  if (currentError) {
    lastApiError = currentError;
    if (karyawanList.length > 0 || hasSuccessfullyLoaded) {
      isDataStale = true;
    }
    notify();
    return;
  }

  if ((repoLoading || empLoading) && !hasSuccessfullyLoaded) {
    notify();
    return;
  }

  const users = userRepository.getAll() || [];
  const rawEmployees = isApiMode ? apiEmployeeProvider.getAll() : INITIAL_KARYAWAN;

  lastApiError = null;
  isDataStale = false;
  hasSuccessfullyLoaded = true;

  const roleMap: Record<string, "admin" | "finance" | "svp" | "messenger" | "clilen"> = {
    ADMIN: "admin",
    FINANCE: "finance",
    SVP: "svp",
    MESSENGER: "messenger",
    CLILEN: "clilen",
  };

  // 1. Map Employees as single source of truth for employment data
  const sourceEmployees = rawEmployees.length > 0 ? rawEmployees : (isApiMode ? [] : INITIAL_KARYAWAN);
  const mappedKaryawan: KaryawanRecord[] = sourceEmployees.map((e: any) => {
    // Find linked user if exists
    const linkedUser = users.find((u: any) => {
      const uEmpId = String(u.employee_id || u.employeeId || "").trim().toLowerCase();
      const targetEmpId = String(e.id).trim().toLowerCase();
      return (uEmpId && uEmpId === targetEmpId) || (e.user_id && String(u.id) === String(e.user_id));
    });

    const rawJabatan = (e.jabatan || linkedUser?.jabatan || "ADMIN").toUpperCase();
    const statusEmp = (e.status_karyawan === "Aktif" || e.status_karyawan === "TETAP" || e.status === "Aktif") ? "Aktif" : "Nonaktif";

    return {
      id: e.id,
      nama: e.nama_lengkap || e.nama || linkedUser?.nama || "",
      jabatan: rawJabatan,
      wilayah: e.wilayah || "Jakarta",
      status: statusEmp,
      noHp: e.no_hp || e.noHp || linkedUser?.phone || "",
      email: e.user_email || linkedUser?.email || e.email || "",
      jenisKelamin: e.jenis_kelamin || e.jenisKelamin || "Laki-laki",
      alamat: e.alamat_domisili || e.alamat || "Kantor SUN89",
      gajiPokok: Number(e.gaji_pokok ?? e.gajiPokok ?? 0),
      tanggalBergabung: e.tanggal_bergabung || e.tanggalBergabung || "2023-01-01",
      tanggalLahir: e.tgl_lahir || e.tanggalLahir || "2000-01-01",
      nikKtp: e.nik_ktp || e.nikKtp,
      userId: linkedUser?.id || e.user_id || null,
      hasAccount: Boolean(linkedUser || e.user_id),
    };
  });

  // 2. Map Users as single source of truth for authentication and account data
  const sourceUsers = users.length > 0 ? users : (isApiMode ? [] : INITIAL_PENGGUNA);
  const mappedPengguna: PenggunaRecord[] = sourceUsers.map((u: any) => {
    const rawJabatan = (u.jabatan || "ADMIN").toUpperCase();
    const role = (u.role || roleMap[rawJabatan] || "admin").toLowerCase();
    const statusAkun = u.status === "Aktif" ? "Aktif" : (u.status === "Nonaktif" ? "Nonaktif" : "Belum Aktif");
    const empId = u.employee_id || u.employeeId || "";

    const linkedEmployee = mappedKaryawan.find((k) => k.id.toLowerCase() === empId.toLowerCase());

    return {
      id: String(u.id),
      employeeId: empId,
      nama: u.nama,
      jabatan: rawJabatan,
      email: u.email,
      role,
      statusAkun,
      terakhirLogin: u.last_login_at || u.lastLogin || (statusAkun === "Aktif" ? "2026-09-24 14:32" : "-"),
      passwordHash: "********",
      employeeInfo: linkedEmployee || null,
    };
  });

  karyawanList = mappedKaryawan;
  penggunaList = mappedPengguna;
  notify();
}

// Initial subscription in API mode
if (isApiMode) {
  syncFromSources();
  userRepository.subscribe(() => {
    syncFromSources();
  });
  apiEmployeeProvider.subscribe(() => {
    syncFromSources();
  });
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined" && window.localStorage) {
    const token = window.localStorage.getItem("auth_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export const karyawanPenggunaAdapter = {
  // ─── KARYAWAN OPERATIONS ──────────────────────────────────────────────
  getKaryawan(): KaryawanRecord[] {
    return [...karyawanList];
  },

  getKaryawanById(id: string): KaryawanRecord | undefined {
    return karyawanList.find((k) => k.id === id);
  },

  addKaryawan(data: Omit<KaryawanRecord, "id">): KaryawanRecord {
    const nextNum = karyawanList.length + 1;
    const newId = `EMP-${String(nextNum).padStart(4, "0")}`;
    const cleanNik = data.nikKtp || `317508${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 9000 + 1000))}`;

    const newKaryawan: KaryawanRecord = {
      ...data,
      id: newId,
      nikKtp: cleanNik,
    };
    karyawanList = [...karyawanList, newKaryawan];

    // Optional user account stub in mock mode
    if (!isApiMode && data.email) {
      const nextUsrNum = penggunaList.length + 1;
      const roleMap: Record<string, "admin" | "finance" | "svp" | "messenger" | "clilen"> = {
        ADMIN: "admin",
        FINANCE: "finance",
        SVP: "svp",
        MESSENGER: "messenger",
        CLILEN: "clilen",
      };

      const newPengguna: PenggunaRecord = {
        id: String(nextUsrNum),
        employeeId: newId,
        nama: newKaryawan.nama,
        jabatan: newKaryawan.jabatan,
        email: newKaryawan.email,
        role: roleMap[newKaryawan.jabatan] || "admin",
        statusAkun: "Aktif",
        terakhirLogin: "-",
        passwordHash: formatDobToPassword(newKaryawan.tanggalLahir),
      };
      penggunaList = [...penggunaList, newPengguna];
    }

    auditLog.log({
      userId: "usr-admin-system",
      userName: "Administrator",
      action: "CREATE",
      module: "Karyawan",
      details: `Menambahkan karyawan baru: ${newKaryawan.nama} (${newId})`,
      userRole: "admin",
    });

    if (isApiMode) {
      apiEmployeeProvider.createEmployee({
        id: newId,
        nik_ktp: cleanNik,
        nama_lengkap: data.nama,
        no_hp: data.noHp,
        tgl_lahir: data.tanggalLahir,
        wilayah: data.wilayah,
        alamat_domisili: data.alamat,
        jabatan: data.jabatan,
        gaji_pokok: data.gajiPokok,
        status_karyawan: data.status,
        tanggal_bergabung: data.tanggalBergabung,
        jenis_kelamin: data.jenisKelamin,
        email: data.email,
        createAccount: Boolean(data.email),
      }).then(() => {
        syncFromSources();
      }).catch((err) => {
        console.error("Failed to create employee on server:", err);
      });
    }

    notify();
    return newKaryawan;
  },

  updateKaryawan(id: string, data: Partial<KaryawanRecord>): boolean {
    const idx = karyawanList.findIndex((k) => k.id === id);
    if (idx === -1) return false;

    const updated = { ...karyawanList[idx], ...data };
    karyawanList[idx] = updated;

    // Sync mirrored name/title in Pengguna list if linked
    penggunaList = penggunaList.map((p) => {
      if (p.employeeId === id) {
        return {
          ...p,
          nama: updated.nama,
          jabatan: updated.jabatan,
          email: updated.email,
        };
      }
      return p;
    });

    auditLog.log({
      userId: "usr-admin-system",
      userName: "Administrator",
      action: "UPDATE",
      module: "Karyawan",
      details: `Mengubah data karyawan: ${updated.nama} (${id})`,
      userRole: "admin",
    });

    if (isApiMode) {
      apiEmployeeProvider.updateEmployee(id, {
        nama_lengkap: updated.nama,
        no_hp: updated.noHp,
        tgl_lahir: updated.tanggalLahir,
        wilayah: updated.wilayah,
        alamat_domisili: updated.alamat,
        jabatan: updated.jabatan,
        gaji_pokok: updated.gajiPokok,
        status_karyawan: updated.status,
        tanggal_bergabung: updated.tanggalBergabung,
        jenis_kelamin: updated.jenisKelamin,
      }).then(() => {
        syncFromSources();
      }).catch((err) => {
        console.error("Failed to update employee on server:", err);
      });
    }

    notify();
    return true;
  },

  deleteKaryawan(id: string): boolean {
    const target = karyawanList.find((k) => k.id === id);
    if (!target) return false;

    karyawanList = karyawanList.filter((k) => k.id !== id);
    // Unlink associated user account
    penggunaList = penggunaList.map((p) => p.employeeId === id ? { ...p, employeeId: "", employeeInfo: null } : p);

    auditLog.log({
      userId: "usr-admin-system",
      userName: "Administrator",
      action: "DELETE",
      module: "Karyawan",
      details: `Menghapus karyawan: ${target.nama} (${id})`,
      userRole: "admin",
    });

    if (isApiMode) {
      apiEmployeeProvider.deleteEmployee(id).then(() => {
        syncFromSources();
      }).catch((err) => {
        console.error("Failed to delete employee on server:", err);
      });
    }

    notify();
    return true;
  },

  // ─── PERMANENT ERASURE ────────────────────────────────────────────────
  async preflightPermanentErasure(id: string): Promise<{
    allowed: boolean;
    blockers: { code: string; message: string; details?: any }[];
    target?: any;
    summary?: any;
    error?: string;
  }> {
    if (isApiMode) {
      try {
        const res = await fetch(`${APP_CONFIG.apiBaseUrl}/users/${encodeURIComponent(id)}/permanent-erasure-preflight`, {
          method: "GET",
          headers: getAuthHeaders(),
        });
        const json = await res.json();
        if (!res.ok) {
          return {
            allowed: false,
            blockers: json.error?.blockers || (json.error?.details?.blockers || [
              { code: json.error?.code || "PREFLIGHT_ERROR", message: json.error?.message || "Gagal memeriksa status penghapusan." }
            ]),
            error: json.error?.message,
          };
        }
        return {
          allowed: json.data?.allowed ?? false,
          blockers: json.data?.blockers || [],
          target: json.data?.target,
          summary: json.data?.summary,
        };
      } catch (err: any) {
        return {
          allowed: false,
          blockers: [{ code: "NETWORK_ERROR", message: err.message || "Gagal terhubung ke backend." }],
          error: err.message,
        };
      }
    }

    // Mock Mode fallback
    const targetKaryawan = karyawanList.find((k) => k.id === id);
    const targetPengguna = penggunaList.find((p) => p.employeeId === id || p.id === id);
    const blockers: { code: string; message: string }[] = [];

    const roleStr = String(targetPengguna?.role || "");
    if (targetPengguna && (roleStr === "admin" || roleStr === "svp" || roleStr === "administrator")) {
      const activeAdmins = penggunaList.filter(
        (p) => (p.role === "admin" || p.role === "svp" || (p.role as string) === "administrator") && p.statusAkun === "Aktif" && p.id !== targetPengguna.id
      );
      if (activeAdmins.length === 0) {
        blockers.push({ code: "LAST_ADMIN", message: "Tidak dapat menghapus administrator terakhir." });
      }
    }

    return {
      allowed: blockers.length === 0,
      blockers,
      target: {
        employeeId: targetKaryawan?.id,
        employeeName: targetKaryawan?.nama,
        employeeNik: targetKaryawan?.nikKtp || "3171000000000000",
        userRole: targetPengguna?.role,
        userStatus: targetPengguna?.statusAkun,
      },
      summary: {
        personalFilesCount: 0,
        financialTransactionsPreserved: 0,
        auditLogsToPurge: 1,
        auditLogsToAnonymize: 0,
      },
    };
  },

  async permanentErasure(
    id: string,
    confirmationText: string,
    reason?: string
  ): Promise<{
    success: boolean;
    status?: "COMPLETED" | "DATABASE_COMPLETED";
    fileCleanupPending?: boolean;
    message?: string;
    error?: string;
    blockers?: any[];
  }> {
    if (confirmationText?.trim() !== "HAPUS PERMANEN") {
      return {
        success: false,
        error: "Konfirmasi tidak valid. Anda wajib mengetik teks 'HAPUS PERMANEN'.",
      };
    }

    if (isApiMode) {
      try {
        const res = await fetch(`${APP_CONFIG.apiBaseUrl}/users/${encodeURIComponent(id)}/permanent-erasure`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ confirmationText: "HAPUS PERMANEN", reason }),
        });
        const json = await res.json();
        if (!res.ok) {
          return {
            success: false,
            error: json.error?.message || "Penghapusan permanen gagal dieksekusi.",
            blockers: json.error?.blockers || (json.error?.details?.blockers || []),
          };
        }

        karyawanList = karyawanList.filter((k) => k.id !== id);
        penggunaList = penggunaList.filter((p) => p.employeeId !== id && p.id !== id);
        karyawanPenggunaAdapter.refresh();
        notify();

        return {
          success: true,
          status: json.data?.status || "COMPLETED",
          fileCleanupPending: json.data?.fileCleanupPending || false,
          message: json.message || "Penghapusan permanen berhasil dilakukan.",
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message || "Gagal menghubungi server untuk penghapusan permanen.",
        };
      }
    }

    karyawanList = karyawanList.filter((k) => k.id !== id);
    penggunaList = penggunaList.filter((p) => p.employeeId !== id && p.id !== id);

    auditLog.log({
      userId: "usr-admin-system",
      userName: "Administrator",
      action: "PERMANENT_ERASURE_EXECUTED",
      module: "Karyawan",
      details: "Penghapusan permanen data karyawan dan akun pengguna berhasil.",
      userRole: "admin",
    });

    notify();
    return {
      success: true,
      status: "COMPLETED",
      fileCleanupPending: false,
      message: "Data karyawan dan akun pengguna berhasil dihapus permanen.",
    };
  },

  // ─── PENGGUNA OPERATIONS ──────────────────────────────────────────────
  getPengguna(): PenggunaRecord[] {
    return [...penggunaList];
  },

  getPenggunaById(id: string): PenggunaRecord | undefined {
    return penggunaList.find((p) => p.id === id);
  },

  getPenggunaByEmployeeId(empId: string): PenggunaRecord | undefined {
    return penggunaList.find((p) => p.employeeId === empId);
  },

  activateAccount(userId: string): boolean {
    const idx = penggunaList.findIndex((p) => p.id === userId);
    if (idx === -1) return false;

    penggunaList[idx] = {
      ...penggunaList[idx],
      statusAkun: "Aktif",
    };

    if (isApiMode) {
      userRepository.updateUser(userId, { status: "Aktif" });
    }

    auditLog.log({
      userId: "usr-admin-system",
      userName: "Administrator",
      action: "UPDATE",
      module: "Manajemen Pengguna",
      details: `Mengaktifkan akun pengguna: ${penggunaList[idx].nama} (${userId})`,
      userRole: "admin",
    });

    notify();
    return true;
  },

  deactivateAccount(userId: string): boolean {
    const idx = penggunaList.findIndex((p) => p.id === userId);
    if (idx === -1) return false;

    penggunaList[idx] = {
      ...penggunaList[idx],
      statusAkun: "Nonaktif",
    };

    if (isApiMode) {
      userRepository.updateUser(userId, { status: "Nonaktif" });
    }

    auditLog.log({
      userId: "usr-admin-system",
      userName: "Administrator",
      action: "UPDATE",
      module: "Manajemen Pengguna",
      details: `Menonaktifkan akun pengguna: ${penggunaList[idx].nama} (${userId})`,
      userRole: "admin",
    });

    notify();
    return true;
  },

  updateRole(userId: string, role: PenggunaRecord["role"]): boolean {
    const idx = penggunaList.findIndex((p) => p.id === userId);
    if (idx === -1) return false;

    const savedUserStr = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
    let currentUserRole = "admin";
    if (savedUserStr) {
      try { currentUserRole = JSON.parse(savedUserStr).role || "admin"; } catch {}
    }
    const isCallerSvp = currentUserRole === "administrator" || currentUserRole === "svp";

    // Protect SVP account from role change by non-SVP
    if (penggunaList[idx].role === "svp" && !isCallerSvp) {
      return false;
    }

    if (role === "svp" && !isCallerSvp) {
      return false;
    }

    penggunaList[idx] = {
      ...penggunaList[idx],
      role,
      jabatan: role.toUpperCase(),
    };

    if (isApiMode) {
      userRepository.updateUser(userId, { role, jabatan: role.toUpperCase() });
    }

    auditLog.log({
      userId: "usr-admin-system",
      userName: "Administrator",
      action: "UPDATE",
      module: "Manajemen Pengguna",
      details: `Mengubah role pengguna ${penggunaList[idx].nama} menjadi ${role}`,
      userRole: "admin",
    });

    notify();
    return true;
  },

  async resetPassword(userId: string): Promise<{ success: boolean; newPassword?: string; error?: string }> {
    const user = penggunaList.find((p) => p.id === userId);
    if (!user) return { success: false, error: "Pengguna tidak ditemukan." };

    const savedUserStr = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
    let currentUserRole = "admin";
    if (savedUserStr) {
      try { currentUserRole = JSON.parse(savedUserStr).role || "admin"; } catch {}
    }
    const isCallerSvp = currentUserRole === "administrator" || currentUserRole === "svp";

    if (user.role === "svp" && !isCallerSvp) {
      return { success: false, error: "Akun SVP dilindungi oleh sistem dan tidak dapat direset oleh role lain." };
    }

    const employee = karyawanList.find((k) => k.id === user.employeeId);
    const dob = employee?.tanggalLahir || "1990-01-01";
    const newPassword = formatDobToPassword(dob);

    if (isApiMode && userRepository.resetPassword) {
      try {
        await userRepository.resetPassword(userId);
      } catch (err: any) {
        return {
          success: false,
          error: err.message || "Gagal mereset kata sandi pada server.",
        };
      }
    }

    penggunaList = penggunaList.map((p) => {
      if (p.id === userId) {
        return {
          ...p,
          passwordHash: newPassword,
          lastResetAt: new Date().toISOString(),
        };
      }
      return p;
    });

    auditLog.log({
      userId: "usr-admin-system",
      userName: "Administrator",
      action: "RESET_PASSWORD",
      module: "Manajemen Pengguna",
      details: `Reset kata sandi akun ${user.nama} (${userId}) menggunakan tanggal lahir karyawan`,
      userRole: "admin",
    });

    notify();
    return { success: true, newPassword };
  },

  _resetToInitial() {
    if (isApiMode) {
      syncFromSources();
    } else {
      karyawanList = [...INITIAL_KARYAWAN];
      penggunaList = [...INITIAL_PENGGUNA];
      notify();
    }
  },

  _setApiMode(enabled: boolean) {
    isApiMode = enabled;
    if (enabled) {
      syncFromSources();
    } else {
      karyawanList = [...INITIAL_KARYAWAN];
      penggunaList = [...INITIAL_PENGGUNA];
      notify();
    }
  },

  isLoading(): boolean {
    if (!isApiMode) return false;
    const repoLoading = Boolean(userRepository.isLoading && userRepository.isLoading());
    const empLoading = Boolean(apiEmployeeProvider.isLoading && apiEmployeeProvider.isLoading());
    return (repoLoading || empLoading) && !hasSuccessfullyLoaded;
  },

  getError(): string | null {
    if (!isApiMode) return null;
    return lastApiError || (userRepository.getError ? userRepository.getError() : null) || (apiEmployeeProvider.getError ? apiEmployeeProvider.getError() : null);
  },

  isStale(): boolean {
    return isDataStale;
  },

  async refresh(): Promise<void> {
    if (isApiMode) {
      await Promise.allSettled([
        apiEmployeeProvider.initFromApi(),
        (userRepository as any).getProvider && typeof (userRepository as any).getProvider().initFromApi === "function"
          ? (userRepository as any).getProvider().initFromApi()
          : Promise.resolve(),
      ]);
    }
    syncFromSources();
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useKaryawanPengguna() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return karyawanPenggunaAdapter.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return {
    karyawan: karyawanPenggunaAdapter.getKaryawan(),
    karyawanList: karyawanPenggunaAdapter.getKaryawan(),
    pengguna: karyawanPenggunaAdapter.getPengguna(),
    penggunaList: karyawanPenggunaAdapter.getPengguna(),
    isLoading: karyawanPenggunaAdapter.isLoading(),
    error: karyawanPenggunaAdapter.getError(),
    isStale: karyawanPenggunaAdapter.isStale(),
    refresh: () => karyawanPenggunaAdapter.refresh(),
    activateAccount: karyawanPenggunaAdapter.activateAccount,
    deactivateAccount: karyawanPenggunaAdapter.deactivateAccount,
    resetPassword: karyawanPenggunaAdapter.resetPassword,
    updateRole: karyawanPenggunaAdapter.updateRole,
    addKaryawan: karyawanPenggunaAdapter.addKaryawan,
    updateKaryawan: karyawanPenggunaAdapter.updateKaryawan,
    deleteKaryawan: karyawanPenggunaAdapter.deleteKaryawan,
    preflightPermanentErasure: karyawanPenggunaAdapter.preflightPermanentErasure,
    permanentErasure: karyawanPenggunaAdapter.permanentErasure,
  };
}
