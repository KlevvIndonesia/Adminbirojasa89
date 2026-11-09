/**
 * Canonical Domain Types for Employees
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Single source of truth for employment and personal demographic records.
 */

export interface Employee {
  id: string; // e.g. "EMP-0001"
  nik_ktp: string;
  nama_lengkap: string;
  no_hp: string;
  tgl_lahir: string;
  wilayah: string;
  alamat_domisili: string;
  jabatan: string;
  avatar_url?: string | null;
  gaji_pokok: number;
  status_karyawan: "Aktif" | "Nonaktif" | "TETAP" | "KONTRAK" | "NONAKTIF" | string;
  tanggal_bergabung?: string | null;
  jenis_kelamin: "Laki-laki" | "Perempuan" | string;
  created_at?: string;
  updated_at?: string;

  // Joined user account metadata (if linked)
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
  no_hp?: string;
  tgl_lahir?: string;
  wilayah?: string;
  alamat_domisili?: string;
  jabatan?: string;
  avatar_url?: string | null;
  gaji_pokok?: number;
  status_karyawan?: string;
  tanggal_bergabung?: string;
  jenis_kelamin?: string;
  email?: string;
  createAccount?: boolean;
  role?: string;
}

export interface EmployeeUpdateInput {
  nik_ktp?: string;
  nama_lengkap?: string;
  no_hp?: string;
  tgl_lahir?: string;
  wilayah?: string;
  alamat_domisili?: string;
  jabatan?: string;
  avatar_url?: string | null;
  gaji_pokok?: number;
  status_karyawan?: string;
  tanggal_bergabung?: string;
  jenis_kelamin?: string;
}
