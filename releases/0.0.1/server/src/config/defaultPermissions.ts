/**
 * Canonical Default Role Permissions
 * Admin SUN89 — Biro Jasa Management System
 */

export interface ModulePermission {
  view: boolean;
  manage: boolean;
}

export interface StageActionPermissions {
  stage1_verifikasi: boolean;
  stage2_penjadwalan: boolean;
  stage3_verifikasiFisik: boolean;
  stage4_prosesSamsat: boolean;
  stage5_verifikasiUlang: boolean;
  stage6_supervisi: boolean;
  stage7_pengantaran: boolean;
  stage8_diterima: boolean;
}

export interface RolePermissions {
  modules: Record<string, ModulePermission>;
  stages: StageActionPermissions;
}

export const CANONICAL_PERMISSIONS: Record<string, RolePermissions> = {
  // 1. SVP (Super User / Administrator) — PERMANENT FULL PRIVILEGE (NON-EDITABLE)
  svp: {
    modules: {
      dashboard: { view: true, manage: true },
      finance: { view: true, manage: true },
      "finance-profit": { view: true, manage: true },
      "finance-kas-messenger": { view: true, manage: true },
      "finance-kas-kantor": { view: true, manage: true },
      "finance-pengeluaran": { view: true, manage: true },
      "finance-penjualan": { view: true, manage: true },
      "finance-tagihan": { view: true, manage: true },
      "finance-laba-rugi": { view: true, manage: true },
      "master-data": { view: true, manage: true },
      "master-layanan": { view: true, manage: true },
      "master-samsat": { view: true, manage: true },
      "master-biaya-layanan": { view: true, manage: true },
      "master-harga-dasar-samsat": { view: true, manage: true },
      "master-metode-pembayaran": { view: true, manage: true },
      manajemen: { view: true, manage: true },
      "manajemen-karyawan": { view: true, manage: true },
      "master-karyawan": { view: true, manage: true },
      "manajemen-pengguna": { view: true, manage: true },
      "master-pengguna": { view: true, manage: true },
      "access-management": { view: true, manage: true },
      "audit-log": { view: true, manage: true },
      "messenger-menu": { view: true, manage: true },
      "messenger-task": { view: true, manage: true },
      "messenger-history": { view: true, manage: true },
      "order-menu": { view: true, manage: true },
      "buat-order": { view: true, manage: true },
      "order-tracking": { view: true, manage: true },
      "order-history": { view: true, manage: true },
      settings: { view: true, manage: true },
      profile: { view: true, manage: true },
    },
    stages: {
      stage1_verifikasi: true,
      stage2_penjadwalan: true,
      stage3_verifikasiFisik: true,
      stage4_prosesSamsat: true,
      stage5_verifikasiUlang: true,
      stage6_supervisi: true,
      stage7_pengantaran: true,
      stage8_diterima: true,
    },
  },

  // 2. ADMIN OPERASIONAL
  admin: {
    modules: {
      dashboard: { view: true, manage: true },
      finance: { view: false, manage: false },
      "finance-profit": { view: false, manage: false },
      "finance-kas-messenger": { view: false, manage: false },
      "finance-kas-kantor": { view: false, manage: false },
      "finance-pengeluaran": { view: false, manage: false },
      "finance-penjualan": { view: false, manage: false },
      "finance-tagihan": { view: false, manage: false },
      "finance-laba-rugi": { view: false, manage: false },
      "master-data": { view: true, manage: true },
      "master-layanan": { view: true, manage: true },
      "master-samsat": { view: true, manage: true },
      "master-biaya-layanan": { view: true, manage: true },
      "master-harga-dasar-samsat": { view: true, manage: true },
      "master-metode-pembayaran": { view: true, manage: true },
      manajemen: { view: true, manage: true },
      "manajemen-karyawan": { view: true, manage: true },
      "master-karyawan": { view: true, manage: true },
      "manajemen-pengguna": { view: false, manage: false },
      "master-pengguna": { view: false, manage: false },
      "access-management": { view: false, manage: false },
      "audit-log": { view: false, manage: false },
      "messenger-menu": { view: true, manage: true },
      "messenger-task": { view: true, manage: true },
      "messenger-history": { view: true, manage: true },
      "order-menu": { view: true, manage: true },
      "buat-order": { view: true, manage: true },
      "order-tracking": { view: true, manage: true },
      "order-history": { view: true, manage: true },
      settings: { view: true, manage: true },
      profile: { view: true, manage: true },
    },
    stages: {
      stage1_verifikasi: true,
      stage2_penjadwalan: true,
      stage3_verifikasiFisik: true,
      stage4_prosesSamsat: false, // Admin view-only
      stage5_verifikasiUlang: true,
      stage6_supervisi: false,    // Admin view-only
      stage7_pengantaran: true,
      stage8_diterima: true,
    },
  },

  // 3. FINANCE & KASIR
  finance: {
    modules: {
      dashboard: { view: true, manage: false },
      finance: { view: true, manage: true },
      "finance-profit": { view: true, manage: true },
      "finance-kas-messenger": { view: true, manage: true },
      "finance-kas-kantor": { view: true, manage: true },
      "finance-pengeluaran": { view: true, manage: true },
      "finance-penjualan": { view: true, manage: true },
      "finance-tagihan": { view: true, manage: true },
      "finance-laba-rugi": { view: true, manage: true },
      "master-data": { view: false, manage: false },
      "master-layanan": { view: false, manage: false },
      "master-samsat": { view: false, manage: false },
      "master-biaya-layanan": { view: false, manage: false },
      "master-harga-dasar-samsat": { view: false, manage: false },
      "master-metode-pembayaran": { view: true, manage: true },
      manajemen: { view: false, manage: false },
      "manajemen-karyawan": { view: false, manage: false },
      "master-karyawan": { view: false, manage: false },
      "manajemen-pengguna": { view: false, manage: false },
      "master-pengguna": { view: false, manage: false },
      "access-management": { view: false, manage: false },
      "audit-log": { view: false, manage: false },
      "messenger-menu": { view: true, manage: false },
      "messenger-task": { view: false, manage: false },
      "messenger-history": { view: true, manage: false },
      "order-menu": { view: true, manage: false },
      "buat-order": { view: false, manage: false },
      "order-tracking": { view: true, manage: false },
      "order-history": { view: true, manage: false },
      settings: { view: false, manage: false },
      profile: { view: true, manage: false },
    },
    stages: {
      stage1_verifikasi: true,
      stage2_penjadwalan: false,
      stage3_verifikasiFisik: false,
      stage4_prosesSamsat: false,
      stage5_verifikasiUlang: false,
      stage6_supervisi: false,
      stage7_pengantaran: false,
      stage8_diterima: false,
    },
  },

  // 4. MESSENGER
  messenger: {
    modules: {
      dashboard: { view: true, manage: false },
      finance: { view: false, manage: false },
      "finance-profit": { view: false, manage: false },
      "finance-kas-messenger": { view: false, manage: false },
      "finance-kas-kantor": { view: false, manage: false },
      "finance-pengeluaran": { view: false, manage: false },
      "finance-penjualan": { view: false, manage: false },
      "finance-tagihan": { view: false, manage: false },
      "finance-laba-rugi": { view: false, manage: false },
      "master-data": { view: false, manage: false },
      "master-layanan": { view: false, manage: false },
      "master-samsat": { view: false, manage: false },
      "master-biaya-layanan": { view: false, manage: false },
      "master-harga-dasar-samsat": { view: false, manage: false },
      "master-metode-pembayaran": { view: false, manage: false },
      manajemen: { view: false, manage: false },
      "manajemen-karyawan": { view: false, manage: false },
      "master-karyawan": { view: false, manage: false },
      "manajemen-pengguna": { view: false, manage: false },
      "master-pengguna": { view: false, manage: false },
      "access-management": { view: false, manage: false },
      "audit-log": { view: false, manage: false },
      "messenger-menu": { view: true, manage: true },
      "messenger-task": { view: true, manage: true },
      "messenger-history": { view: true, manage: true },
      "order-menu": { view: false, manage: false },
      "buat-order": { view: false, manage: false },
      "order-tracking": { view: false, manage: false },
      "order-history": { view: false, manage: false },
      settings: { view: false, manage: false },
      profile: { view: true, manage: false },
    },
    stages: {
      stage1_verifikasi: false,
      stage2_penjadwalan: false,
      stage3_verifikasiFisik: false,
      stage4_prosesSamsat: false,
      stage5_verifikasiUlang: false,
      stage6_supervisi: false,
      stage7_pengantaran: false,
      stage8_diterima: false,
    },
  },
};
