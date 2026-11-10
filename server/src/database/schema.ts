/**
 * Database Schema Definitions and Initializer
 * Admin SUN89 — Biro Jasa Management System
 */

import type { DatabaseSync } from "node:sqlite";
import { runInTransaction } from "./db";
import { normalizeToWibCalendarDate } from "../utils/dateNormalizer";

export interface CanonicalServiceConfig {
  id: string;
  kode_layanan: string;
  nama_layanan: string;
  kategori: string;
  memerlukan_samsat_tujuan: number;
  deskripsi: string;
  status_aktif: number;
  urutan: number;
}


export interface OrderCorrectionRecord {
  id: string;
  order_no: string;
  category: string;
  linked_duplicate_order_no: string | null;
  reason: string;
  status: "Diajukan" | "Disetujui" | "Ditolak";
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SamsatOperationalTariffRecord {
  id: string;
  samsat_id: string;
  pricing_item_id: string;
  nominal: number;
  is_active: number;
  created_by_employee_id?: string | null;
  updated_by_employee_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const CANONICAL_SERVICES: CanonicalServiceConfig[] = [
  {
    id: "svc-perp-1th",
    kode_layanan: "PERP_1THN",
    nama_layanan: "Perpanjangan 1 Tahun",
    kategori: "PAJAK_STNK",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Pengesahan STNK dan pembayaran PKB tahunan",
    status_aktif: 1,
    urutan: 1,
  },
  {
    id: "svc-perp-5th",
    kode_layanan: "PERP_5THN",
    nama_layanan: "Perpanjangan 5 Tahun",
    kategori: "PAJAK_STNK",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Perpanjangan STNK 5 tahunan dan pergantian plat nomor TNKB",
    status_aktif: 1,
    urutan: 2,
  },
  {
    id: "svc-mut-asal",
    kode_layanan: "MUT_ASAL",
    nama_layanan: "Mutasi Asal Samsat",
    kategori: "MUTASI",
    memerlukan_samsat_tujuan: 1,
    deskripsi: "Pencabutan berkas dari Samsat asal menuju Samsat satu wilayah/daerah",
    status_aktif: 1,
    urutan: 3,
  },
  {
    id: "svc-mut-antar",
    kode_layanan: "MUT_ANTAR",
    nama_layanan: "Mutasi Antar Daerah",
    kategori: "MUTASI",
    memerlukan_samsat_tujuan: 1,
    deskripsi: "Pencabutan dan pendaftaran berkas kendaraan antar provinsi / luar daerah",
    status_aktif: 1,
    urutan: 4,
  },
  {
    id: "svc-balik-nama",
    kode_layanan: "BALIK_NAMA",
    nama_layanan: "Balik Nama",
    kategori: "KEPEMILIKAN",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Bea Balik Nama Kendaraan Bermotor (BBN-KB) perubahan identitas kepemilikan",
    status_aktif: 1,
    urutan: 5,
  },
  {
    id: "svc-tarik-berkas",
    kode_layanan: "TARIK_BERKAS",
    nama_layanan: "Tarik Berkas",
    kategori: "DOKUMEN",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Pengambilan dan penarikan berkas arsip kendaraan dari loket Samsat",
    status_aktif: 1,
    urutan: 6,
  },
  {
    id: "svc-duplikat-stnk",
    kode_layanan: "DUPLIKAT_STNK",
    nama_layanan: "Duplikat STNK",
    kategori: "DOKUMEN",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Penerbitan duplikat dokumen STNK karena hilang atau rusak",
    status_aktif: 1,
    urutan: 7,
  },
  {
    id: "svc-lainnya",
    kode_layanan: "LAINNYA",
    nama_layanan: "Lainnya",
    kategori: "LAINNYA",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Pengurusan layanan samsat khusus dan lainnya",
    status_aktif: 1,
    urutan: 8,
  },
];

export function seedCanonicalServices(targetDb: DatabaseSync): void {
  try {
    const insertStmt = targetDb.prepare(`
      INSERT OR IGNORE INTO services (
        id, kode_layanan, nama_layanan, kategori, memerlukan_samsat_tujuan, deskripsi, status_aktif, urutan, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    for (const s of CANONICAL_SERVICES) {
      insertStmt.run(
        s.id,
        s.kode_layanan,
        s.nama_layanan,
        s.kategori,
        s.memerlukan_samsat_tujuan,
        s.deskripsi,
        s.status_aktif,
        s.urutan
      );
    }
  } catch (err) {
    console.warn("[SUN89 Migration] Warning seeding canonical services:", err);
  }
}

const _initializedConnections = new WeakSet<DatabaseSync>();

export function isSchemaInitialized(targetDb: DatabaseSync): boolean {
  return _initializedConnections.has(targetDb);
}

export function initializeSchema(targetDb: DatabaseSync, options?: { force?: boolean }): void {
  if (!options?.force && _initializedConnections.has(targetDb)) {
    return;
  }
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      kode_layanan TEXT UNIQUE NOT NULL,
      nama_layanan TEXT UNIQUE NOT NULL,
      kategori TEXT NOT NULL,
      memerlukan_samsat_tujuan INTEGER NOT NULL DEFAULT 0,
      deskripsi TEXT,
      status_aktif INTEGER NOT NULL DEFAULT 1,
      urutan INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      requirements TEXT NOT NULL DEFAULT '[]',
      requirements_version INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_services_kode ON services(kode_layanan);
    CREATE INDEX IF NOT EXISTS idx_services_status_urutan ON services(status_aktif, urutan);

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      nik_ktp TEXT UNIQUE NOT NULL,
      nama_lengkap TEXT NOT NULL,
      no_hp TEXT NOT NULL,
      tgl_lahir TEXT NOT NULL,
      wilayah TEXT NOT NULL,
      alamat_domisili TEXT NOT NULL,
      jabatan TEXT NOT NULL,
      avatar_url TEXT,
      gaji_pokok REAL NOT NULL DEFAULT 0,
      status_karyawan TEXT NOT NULL DEFAULT 'TETAP',
      tanggal_bergabung TEXT,
      jenis_kelamin TEXT DEFAULT 'Laki-laki',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_employees_nik ON employees(nik_ktp);
    CREATE INDEX IF NOT EXISTS idx_employees_wilayah ON employees(wilayah);
    CREATE INDEX IF NOT EXISTS idx_employees_jabatan ON employees(jabatan);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      nama TEXT NOT NULL,
      jabatan TEXT NOT NULL DEFAULT 'ADMIN',
      role TEXT NOT NULL DEFAULT 'admin',
      status TEXT NOT NULL DEFAULT 'Aktif',
      avatar_url TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

    DROP TABLE IF EXISTS employee_accounts;

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      tipe_pelanggan TEXT NOT NULL DEFAULT 'PERORANGAN',
      nama_lengkap TEXT NOT NULL,
      nomor_wa TEXT NOT NULL,
      email TEXT,
      provinsi TEXT,
      kota_kabupaten TEXT,
      kecamatan TEXT,
      desa_kelurahan TEXT,
      rt_rw TEXT,
      no_rumah TEXT,
      patokan TEXT,
      detail_alamat TEXT,
      link_google_maps TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_customers_wa ON customers(nomor_wa);
    CREATE INDEX IF NOT EXISTS idx_customers_nama ON customers(nama_lengkap);
    CREATE INDEX IF NOT EXISTS idx_customers_tipe ON customers(tipe_pelanggan);

    CREATE TABLE IF NOT EXISTS customer_accounts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT,
      status_akun TEXT NOT NULL DEFAULT 'AKTIF',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cust_accounts_email ON customer_accounts(email);
    CREATE INDEX IF NOT EXISTS idx_cust_accounts_cust ON customer_accounts(customer_id);

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      nopol TEXT UNIQUE NOT NULL,
      r4_r2 TEXT NOT NULL CHECK(r4_r2 IN ('R4', 'R2')),
      merk TEXT,
      model TEXT,
      tahun_pembuatan INTEGER,
      warna TEXT,
      nomor_rangka TEXT,
      nomor_mesin TEXT,
      nama_pemilik_stnk TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_nopol ON vehicles(nopol);

    CREATE TABLE IF NOT EXISTS orders (
      order_no TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      nomor_hp TEXT NOT NULL,
      layanan TEXT NOT NULL,
      nopol TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 1,
      current_stage_name TEXT NOT NULL DEFAULT 'Verifikasi',
      payment_status TEXT NOT NULL DEFAULT 'Belum Lunas',
      total_biaya REAL NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      service_id TEXT,
      tanggal_masuk_berkas TEXT,
      samsat_asal TEXT,
      samsat_tujuan TEXT DEFAULT '-',
      customer_id TEXT,
      vehicle_id TEXT,
      samsat_asal_id TEXT,
      samsat_tujuan_id TEXT DEFAULT '-',
      cashback_mitra REAL DEFAULT 0,
      channel_order TEXT DEFAULT 'LOKET_ADMIN',
      created_by_employee_id TEXT,
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (samsat_asal_id) REFERENCES samsat_offices(id),
      FOREIGN KEY (samsat_tujuan_id) REFERENCES samsat_offices(id),
      FOREIGN KEY (created_by_employee_id) REFERENCES employees(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_stage ON orders(current_stage_name);
    CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(is_archived);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer);

    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL REFERENCES orders(order_no) ON DELETE CASCADE,
      step_sebelumnya INTEGER NOT NULL,
      step_baru INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      catatan TEXT,
      diubah_oleh_employee_id TEXT REFERENCES employees(id),
      waktu_transisi TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_no);
    CREATE INDEX IF NOT EXISTS idx_order_status_history_employee ON order_status_history(diubah_oleh_employee_id);

    CREATE TABLE IF NOT EXISTS order_timeline_processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL REFERENCES orders(order_no) ON DELETE CASCADE,
      nama_proses TEXT NOT NULL,
      urutan INTEGER NOT NULL,
      status TEXT DEFAULT 'MENUNGGU' CHECK(status IN ('MENUNGGU', 'SEDANG_DIPROSES', 'SELESAI', 'TERKENDALA')),
      estimasi_durasi_menit INTEGER NOT NULL DEFAULT 30,
      waktu_mulai TEXT,
      estimasi_selesai TEXT,
      waktu_selesai TEXT,
      catatan_kendala TEXT,
      updated_by_messenger_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_order_timeline_order ON order_timeline_processes(order_no);
    CREATE INDEX IF NOT EXISTS idx_order_timeline_status ON order_timeline_processes(status);

    CREATE TABLE IF NOT EXISTS samsat_pricing (
      id TEXT PRIMARY KEY,
      nama_item TEXT NOT NULL,
      kategori TEXT NOT NULL,
      tipe_kendaraan TEXT NOT NULL,
      biaya_dasar INTEGER NOT NULL DEFAULT 0 CHECK(biaya_dasar >= 0),
      deskripsi TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      is_configured INTEGER NOT NULL DEFAULT 0 CHECK(is_configured IN (0, 1)),
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_samsat_pricing_lookup ON samsat_pricing(kategori, tipe_kendaraan);

    CREATE TABLE IF NOT EXISTS wilayah_administratif (
      kode_kabupaten_kota TEXT PRIMARY KEY,
      kode_provinsi TEXT NOT NULL,
      nama_provinsi TEXT NOT NULL,
      nama_kabupaten_kota TEXT NOT NULL,
      jenis_wilayah TEXT NOT NULL CHECK(jenis_wilayah IN ('Kabupaten', 'Kota')),
      status_aktif INTEGER NOT NULL DEFAULT 1,
      sumber_referensi TEXT NOT NULL DEFAULT 'Kepmendagri No. 300.2.2-2138 Tahun 2025',
      tahun_referensi INTEGER NOT NULL DEFAULT 2025,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_wilayah_provinsi ON wilayah_administratif(kode_provinsi);
    CREATE INDEX IF NOT EXISTS idx_wilayah_nama ON wilayah_administratif(nama_kabupaten_kota);

    CREATE TABLE IF NOT EXISTS samsat_offices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wilayah TEXT NOT NULL,
      alamat TEXT,
      kode_kabupaten_kota TEXT,
      is_verified INTEGER NOT NULL DEFAULT 1,
      status_aktif INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (kode_kabupaten_kota) REFERENCES wilayah_administratif(kode_kabupaten_kota)
    );

    CREATE INDEX IF NOT EXISTS idx_samsat_wilayah ON samsat_offices(kode_kabupaten_kota);

    CREATE TABLE IF NOT EXISTS samsat_operational_tariffs (
      id TEXT PRIMARY KEY,
      samsat_id TEXT NOT NULL,
      pricing_item_id TEXT NOT NULL,
      nominal INTEGER NOT NULL CHECK(nominal >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      created_by_employee_id TEXT,
      updated_by_employee_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (samsat_id) REFERENCES samsat_offices(id) ON DELETE RESTRICT,
      FOREIGN KEY (pricing_item_id) REFERENCES samsat_pricing(id) ON DELETE RESTRICT,
      FOREIGN KEY (created_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
      UNIQUE(samsat_id, pricing_item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_samsat_tariffs_office ON samsat_operational_tariffs(samsat_id);
    CREATE INDEX IF NOT EXISTS idx_samsat_tariffs_item ON samsat_operational_tariffs(pricing_item_id);
    CREATE INDEX IF NOT EXISTS idx_samsat_tariffs_active ON samsat_operational_tariffs(is_active);

    /* =========================================================================
     * DEPRECATED / LEGACY TABLE: biaya_layanan
     * DO NOT USE FOR NEW OPERATIONS. Canonical active table is service_pricing_configs.
     * Retained for backward compatibility and seed scripts. Do NOT run DROP TABLE.
     * Active modules (Biaya Layanan & Order pricing engine) read/write from service_pricing_configs.
     * ========================================================================= */
    CREATE TABLE IF NOT EXISTS biaya_layanan (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      nama_skema TEXT NOT NULL,
      biaya_jasa_reguler REAL NOT NULL DEFAULT 0,
      biaya_pengurusan_khusus REAL NOT NULL DEFAULT 0,
      biaya_antar_jemput REAL NOT NULL DEFAULT 50000,
      biaya_antar_saja REAL NOT NULL DEFAULT 25000,
      biaya_jemput_saja REAL NOT NULL DEFAULT 25000,
      opsen_pkb_daerah REAL NOT NULL DEFAULT 0,
      biaya_lainnya_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE INDEX IF NOT EXISTS idx_biaya_layanan_svc ON biaya_layanan(service_id);

    /* =========================================================================
     * DEPRECATED / LEGACY TABLE: harga_dasar_samsat
     * DO NOT USE FOR NEW OPERATIONS. Canonical active table is samsat_pricing.
     * Retained for backward compatibility and seed scripts. Do NOT run DROP TABLE.
     * Active modules (Katalog Nasional Samsat & Per-Samsat Overrides) read/write
     * from samsat_pricing and samsat_operational_tariffs.
     * ========================================================================= */
    CREATE TABLE IF NOT EXISTS harga_dasar_samsat (
      id TEXT PRIMARY KEY,
      nama_item TEXT NOT NULL,
      kategori TEXT NOT NULL,
      tipe_kendaraan TEXT NOT NULL,
      biaya_dasar REAL NOT NULL DEFAULT 0,
      deskripsi TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_harga_dasar_kat ON harga_dasar_samsat(kategori);
    CREATE INDEX IF NOT EXISTS idx_harga_dasar_tipe ON harga_dasar_samsat(tipe_kendaraan);

    CREATE TABLE IF NOT EXISTS aturan_estimasi (
      id TEXT PRIMARY KEY,
      nama_formula TEXT NOT NULL,
      service_id TEXT NOT NULL,
      koefisien_denda REAL NOT NULL DEFAULT 0.48,
      denda_swdkllj_formula TEXT,
      aturan_pemutihan_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE INDEX IF NOT EXISTS idx_aturan_estimasi_svc ON aturan_estimasi(service_id);

    CREATE TABLE IF NOT EXISTS master_proses_samsat (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      nama_proses TEXT NOT NULL,
      urutan INTEGER NOT NULL DEFAULT 1,
      estimasi_durasi_menit INTEGER NOT NULL DEFAULT 30,
      deskripsi_klien TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE INDEX IF NOT EXISTS idx_master_proses_svc ON master_proses_samsat(service_id, urutan);

    CREATE TABLE IF NOT EXISTS estimation_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      tipe_kendaraan TEXT NOT NULL,
      koefisien_denda REAL NOT NULL DEFAULT 0.48,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_estimation_service ON estimation_templates(service_type);
    CREATE INDEX IF NOT EXISTS idx_estimation_vehicle ON estimation_templates(tipe_kendaraan);

    CREATE TABLE IF NOT EXISTS finance_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      order_no TEXT NOT NULL,
      customer TEXT NOT NULL,
      layanan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNPAID',
      total_tagihan REAL NOT NULL DEFAULT 0,
      dibayar REAL NOT NULL DEFAULT 0,
      sisa REAL NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      service_id TEXT,
      is_explicit_zero INTEGER NOT NULL DEFAULT 0 CHECK(is_explicit_zero IN (0, 1)),
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_order ON finance_invoices(order_no);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON finance_invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_composite ON finance_invoices(invoice_no, order_no);

    CREATE TABLE IF NOT EXISTS kas_kantor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      keterangan TEXT NOT NULL,
      status TEXT NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      kredit REAL NOT NULL DEFAULT 0,
      saldo REAL NOT NULL DEFAULT 0,
      penanggung_jawab TEXT,
      kategori TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pengeluaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      keterangan TEXT NOT NULL,
      nominal REAL NOT NULL DEFAULT 0,
      penanggung_jawab TEXT,
      kategori TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      nama_metode TEXT NOT NULL,
      bank TEXT NOT NULL DEFAULT '',
      nama_rekening TEXT DEFAULT '',
      nomor_rekening TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Aktif',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_account 
      ON payment_methods(nama_metode, LOWER(bank), nomor_rekening) 
      WHERE nama_metode = 'Transfer Bank' AND nomor_rekening != '';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_tunai_active 
      ON payment_methods(nama_metode) 
      WHERE nama_metode = 'Tunai' AND status = 'Aktif';

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      details TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      details TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      order_no TEXT,
      invoice_id TEXT,
      document_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      storage_name TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_by_id TEXT,
      uploaded_by_role TEXT,
      metadata_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_no) REFERENCES orders(order_no) ON DELETE SET NULL,
      FOREIGN KEY (invoice_id) REFERENCES finance_invoices(invoice_no) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_order ON documents(order_no);
    CREATE INDEX IF NOT EXISTS idx_documents_invoice ON documents(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_documents_storage_name ON documents(storage_name);

    CREATE TABLE IF NOT EXISTS order_documents (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL REFERENCES orders(order_no) ON DELETE CASCADE,
      arah_dokumen TEXT NOT NULL CHECK(arah_dokumen IN ('MASUK', 'KELUAR')),
      kategori_dokumen TEXT NOT NULL,
      nama_file_asli TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      sha256_hash TEXT NOT NULL,
      status_verifikasi TEXT DEFAULT 'PENDING' CHECK(status_verifikasi IN ('PENDING', 'VALID', 'DITOLAK')),
      keterangan TEXT,
      uploaded_by_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_order_documents_order ON order_documents(order_no);
    CREATE INDEX IF NOT EXISTS idx_order_documents_arah ON order_documents(arah_dokumen);

    CREATE TABLE IF NOT EXISTS document_tickets (
      ticket_code TEXT PRIMARY KEY,
      order_no TEXT NOT NULL REFERENCES orders(order_no) ON DELETE CASCADE,
      ticket_type TEXT NOT NULL,
      purpose TEXT NOT NULL,
      issued_by TEXT REFERENCES employees(id),
      recipient_name TEXT NOT NULL,
      is_redeemed INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_doc_tickets_order ON document_tickets(order_no);
    CREATE INDEX IF NOT EXISTS idx_doc_tickets_redeemed ON document_tickets(is_redeemed);

    CREATE TABLE IF NOT EXISTS notification_settings (
      id TEXT PRIMARY KEY DEFAULT 'global',
      recipient_emails TEXT NOT NULL DEFAULT '[]',
      notify_tagihan_reminder INTEGER NOT NULL DEFAULT 1,
      notify_tagihan_perubahan INTEGER NOT NULL DEFAULT 1,
      notify_order_update INTEGER NOT NULL DEFAULT 1,
      notify_proses_gagal INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      title TEXT NOT NULL,
      reference_no TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notif_logs_created ON notification_logs(created_at);

    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT PRIMARY KEY,
      permissions_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS messengers (
      id TEXT PRIMARY KEY,
      employee_id TEXT UNIQUE REFERENCES employees(id),
      plat_motor_operasional TEXT NOT NULL,
      wilayah_tugas_utama TEXT NOT NULL,
      status_tugas TEXT DEFAULT 'STANDBY' CHECK(status_tugas IN ('STANDBY', 'ON_DUTY', 'LIBUR')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messengers_employee ON messengers(employee_id);
    CREATE INDEX IF NOT EXISTS idx_messengers_status ON messengers(status_tugas);

    CREATE TABLE IF NOT EXISTS messenger_tasks (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL REFERENCES orders(order_no) ON DELETE CASCADE,
      messenger_id TEXT NOT NULL REFERENCES messengers(id),
      tipe_tugas TEXT NOT NULL CHECK(tipe_tugas IN ('JEMPUT_BERKAS', 'PROSES_SAMSAT', 'ANTAR_HASIL')),
      status TEXT DEFAULT 'DITUGASKAN' CHECK(status IN ('DITUGASKAN', 'MENUJU_LOKASI', 'SELESAI', 'BATAL')),
      waktu_penugasan TEXT DEFAULT (datetime('now')),
      waktu_selesai TEXT,
      foto_bukti_url TEXT,
      catatan TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messenger_tasks_order ON messenger_tasks(order_no);
    CREATE INDEX IF NOT EXISTS idx_messenger_tasks_messenger ON messenger_tasks(messenger_id);
    CREATE INDEX IF NOT EXISTS idx_messenger_tasks_status ON messenger_tasks(status);

    CREATE TABLE IF NOT EXISTS messenger_reimbursements (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      messenger_name TEXT NOT NULL,
      order_no TEXT,
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      approved_amount REAL DEFAULT 0,
      rejected_amount REAL DEFAULT 0,
      date TEXT NOT NULL,
      note TEXT,
      receipt_url TEXT,
      receipt_name TEXT,
      status TEXT NOT NULL DEFAULT 'Diajukan',
      items_json TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      reviewed_by TEXT,
      review_notes TEXT,
      paid_at TEXT,
      paid_by TEXT,
      payment_method TEXT,
      transaction_ref TEXT,
      pengeluaran_id INTEGER,
      kas_messenger_id INTEGER,
      channel TEXT,
      messenger_id TEXT REFERENCES messengers(id),
      approved_by_employee_id TEXT REFERENCES employees(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reimb_employee ON messenger_reimbursements(employee_id);
    CREATE INDEX IF NOT EXISTS idx_reimb_order ON messenger_reimbursements(order_no);
    CREATE INDEX IF NOT EXISTS idx_reimb_status ON messenger_reimbursements(status);

    CREATE TABLE IF NOT EXISTS kas_messenger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      jenis TEXT NOT NULL,
      messenger TEXT NOT NULL,
      keterangan TEXT NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      kredit REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      penanggung_jawab TEXT,
      order_no TEXT,
      reimbursement_id TEXT,
      receipt_url TEXT,
      kategori TEXT,
      messenger_id TEXT REFERENCES messengers(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_kas_messenger_messenger ON kas_messenger(messenger);
    CREATE INDEX IF NOT EXISTS idx_kas_messenger_tanggal ON kas_messenger(tanggal);

    CREATE TABLE IF NOT EXISTS service_pricing_configs (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      samsat_id TEXT NOT NULL,
      wilayah TEXT NOT NULL,
      biaya_jasa REAL NOT NULL DEFAULT 0,
      biaya_antar_jemput REAL NOT NULL DEFAULT 50000,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_service_pricing_service ON service_pricing_configs(service_id);
    CREATE INDEX IF NOT EXISTS idx_service_pricing_samsat ON service_pricing_configs(samsat_id);

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      user_id TEXT,
      request_hash TEXT NOT NULL,
      resource_id TEXT,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_idempotency_scope ON idempotency_keys(scope, key);

    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id TEXT,
      invoice_no TEXT NOT NULL,
      order_no TEXT NOT NULL,
      nominal REAL NOT NULL CHECK(nominal > 0),
      metode_pembayaran TEXT NOT NULL,
      nama_bank TEXT,
      nomor_rekening TEXT,
      tanggal_bayar TEXT NOT NULL,
      document_id TEXT,
      kas_kantor_id INTEGER,
      status_verifikasi TEXT NOT NULL DEFAULT 'TERVERIFIKASI',
      idempotency_key TEXT UNIQUE,
      verified_by TEXT,
      verified_at TEXT,
      catatan TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_no) REFERENCES finance_invoices(invoice_no) ON DELETE CASCADE,
      FOREIGN KEY (order_no) REFERENCES orders(order_no) ON DELETE RESTRICT,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
      FOREIGN KEY (kas_kantor_id) REFERENCES kas_kantor(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inv_payments_invoice ON invoice_payments(invoice_no);
    CREATE INDEX IF NOT EXISTS idx_inv_payments_order ON invoice_payments(order_no);
    CREATE INDEX IF NOT EXISTS idx_inv_payments_composite ON invoice_payments(invoice_no, order_no);
    CREATE INDEX IF NOT EXISTS idx_inv_payments_idempotency ON invoice_payments(idempotency_key);

    CREATE TABLE IF NOT EXISTS laba_rugi_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL REFERENCES orders(order_no) ON DELETE CASCADE,
      tanggal_pembukuan TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      omzet_tagihan REAL NOT NULL,
      modal_samsat_riil REAL NOT NULL,
      biaya_taktis_lapangan REAL DEFAULT 0,
      cashback_mitra REAL DEFAULT 0,
      laba_kotor REAL NOT NULL,
      laba_bersih REAL NOT NULL,
      is_locked INTEGER DEFAULT 1,
      locked_by_employee_id TEXT REFERENCES employees(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pnl_order ON laba_rugi_snapshots(order_no);
    CREATE INDEX IF NOT EXISTS idx_pnl_customer ON laba_rugi_snapshots(customer_id);
    CREATE INDEX IF NOT EXISTS idx_pnl_service ON laba_rugi_snapshots(service_id);
    CREATE INDEX IF NOT EXISTS idx_pnl_locked_by ON laba_rugi_snapshots(locked_by_employee_id);

        CREATE TABLE IF NOT EXISTS internal_transfers (
      id TEXT PRIMARY KEY,
      transfer_date TEXT NOT NULL,
      transfer_type TEXT NOT NULL,
      from_account TEXT NOT NULL,
      to_account TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0 AND amount <= 9007199254740991),
      messenger_id TEXT NOT NULL REFERENCES messengers(id),
      messenger_name TEXT NOT NULL,
      kas_messenger_id INTEGER NOT NULL REFERENCES kas_messenger(id),
      kas_kantor_id INTEGER NOT NULL REFERENCES kas_kantor(id),
      status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('COMPLETED', 'REVERSED')),
      idempotency_key TEXT UNIQUE NOT NULL,
      reversal_ref_id TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transfers_type_date ON internal_transfers(transfer_type, transfer_date);
    CREATE INDEX IF NOT EXISTS idx_transfers_messenger ON internal_transfers(messenger_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_idemp ON internal_transfers(idempotency_key);

    CREATE TABLE IF NOT EXISTS order_corrections (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL REFERENCES orders(order_no) ON DELETE CASCADE,
      category TEXT NOT NULL,
      linked_duplicate_order_no TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Diajukan' CHECK(status IN ('Diajukan', 'Disetujui', 'Ditolak')),
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      review_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_order_corrections_order ON order_corrections(order_no);
    CREATE INDEX IF NOT EXISTS idx_order_corrections_status ON order_corrections(status);

    CREATE TABLE IF NOT EXISTS file_deletion_jobs (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_file_del_status ON file_deletion_jobs(status);

  `);

  migrateDocumentsTable(targetDb);
  migrateOrdersTable(targetDb);
  migratePaymentMethodsTable(targetDb);
  applySchemaMigrations(targetDb);
  migrateFinanceInvoicesTable(targetDb);
  migrateKasKantorTable(targetDb);
  migratePengeluaranTable(targetDb);
  migrateUsersTable(targetDb);
  migrateKasMessengerTable(targetDb);
  migrateMessengerReimbursementsTable(targetDb);
  migrateIdempotencyKeysTable(targetDb);
  migrateSamsatOfficesTable(targetDb);
  migrateFileDeletionJobsTable(targetDb);
  migrateSecurityAuditLogsTable(targetDb);
  migratePricingTables(targetDb);
  cleanupLegacyStandardPricingItems(targetDb);
  migrateInternalTransfersTable(targetDb);
  seedCanonicalServices(targetDb);
  reconcileLegacyDocuments(targetDb);
  backfillHistoricalFinanceData(targetDb);

  targetDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(is_active);
  `);
  _initializedConnections.add(targetDb);
}

export function reconcileLegacyDocuments(targetDb: DatabaseSync): { matchedCount: number; unidentifiedCount: number; conflictsCount: number } {
  return runInTransaction(() => {
    const ordersStmt = targetDb.prepare("SELECT order_no, data_json FROM orders ORDER BY order_no ASC");
    const orderRows = ordersStmt.all() as { order_no: string; data_json: string }[];
    const linkStmt = targetDb.prepare(
      "UPDATE documents SET order_no = ?, updated_at = datetime('now') WHERE id = ? AND order_no IS NULL"
    );
    const existingDocStmt = targetDb.prepare("SELECT id, order_no FROM documents WHERE id = ?");

    // Phase 1: Map all document claimants across all orders to ensure iteration-order independence
    const docClaimants = new Map<string, Set<string>>();
    for (const orderRow of orderRows) {
      if (!orderRow.data_json || !orderRow.order_no) continue;
      const docIds = orderRow.data_json.match(/DOC-[A-Za-z0-9_-]+/g);
      if (docIds && docIds.length > 0) {
        for (const docId of new Set(docIds)) {
          if (!docClaimants.has(docId)) {
            docClaimants.set(docId, new Set());
          }
          docClaimants.get(docId)!.add(orderRow.order_no);
        }
      }
    }

    let linkedCount = 0;
    let conflictsCount = 0;

    // Phase 2: Process each referenced document deterministically
    for (const [docId, claimants] of docClaimants.entries()) {
      const existingDoc = existingDocStmt.get(docId) as { id: string; order_no: string | null } | undefined;
      if (!existingDoc) continue;

      // If multiple orders claim the document, it is in conflict and must remain unlinked
      if (claimants.size > 1) {
        conflictsCount++;
        continue;
      }

      const singleClaimantOrderNo = Array.from(claimants)[0];

      if (existingDoc.order_no) {
        if (existingDoc.order_no !== singleClaimantOrderNo) {
          // Already linked to a different order -> conflict!
          conflictsCount++;
        }
        // If already linked to the same order, do nothing (preserve updated_at)
        continue;
      }

      // Safe to link to single claimant order
      try {
        const info: any = linkStmt.run(singleClaimantOrderNo, docId);
        if (info?.changes > 0) {
          linkedCount += info.changes;
        }
      } catch {
        // Ignore single doc linking collision
      }
    }

    const unlinkedStmt = targetDb.prepare("SELECT COUNT(*) as count FROM documents WHERE order_no IS NULL");
    const unlinkedRow = unlinkedStmt.get() as { count: number };
    const linkedTotalStmt = targetDb.prepare("SELECT COUNT(*) as count FROM documents WHERE order_no IS NOT NULL");
    const linkedTotalRow = linkedTotalStmt.get() as { count: number };

    if (linkedCount > 0 || conflictsCount > 0) {
      console.log(
        `[SUN89 Reconciliation] Documents linked to orders: ${linkedTotalRow?.count || 0} total (newly reconciled: ${linkedCount}, conflicts: ${conflictsCount}), unidentified: ${unlinkedRow?.count || 0}`
      );
    }

    return {
      matchedCount: linkedTotalRow?.count || 0,
      unidentifiedCount: unlinkedRow?.count || 0,
      conflictsCount,
    };
  }, targetDb);
}

export function migrateDocumentsTable(targetDb: DatabaseSync): void {
  const tableInfo = targetDb.prepare("PRAGMA table_info(documents)").all() as { name: string }[];
  if (!tableInfo || tableInfo.length === 0) return;

  const columnNames = new Set(tableInfo.map((c) => c.name));

  // Check if foreign keys are already applied
  const foreignKeys = targetDb.prepare("PRAGMA foreign_key_list(documents)").all() as { table: string }[];
  const hasOrderFk = foreignKeys.some((fk) => fk.table === "orders");
  const hasInvoiceFk = foreignKeys.some((fk) => fk.table === "finance_invoices");

  if (!hasOrderFk || !hasInvoiceFk || !columnNames.has("is_active") || !columnNames.has("updated_at")) {
    const fkInitiallyOn = (targetDb.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys === 1;
    if (fkInitiallyOn) {
      targetDb.exec("PRAGMA foreign_keys = OFF;");
    }

    try {
      runInTransaction(() => {
        // Validate & clean existing references safely before applying foreign keys
        targetDb.exec(`
          UPDATE documents SET order_no = NULL 
          WHERE order_no IS NOT NULL AND order_no NOT IN (SELECT order_no FROM orders);

          UPDATE documents SET invoice_id = NULL 
          WHERE invoice_id IS NOT NULL AND invoice_id NOT IN (SELECT invoice_no FROM finance_invoices);
        `);

        const isActiveExpr = columnNames.has("is_active") ? "COALESCE(is_active, 1)" : "1";
        const updatedAtExpr = columnNames.has("updated_at") ? "COALESCE(updated_at, created_at)" : "created_at";

        // Recreate table with foreign key constraints
        targetDb.exec(`
          CREATE TABLE documents_migrated (
            id TEXT PRIMARY KEY,
            order_no TEXT,
            invoice_id TEXT,
            document_type TEXT NOT NULL,
            original_name TEXT NOT NULL,
            storage_name TEXT NOT NULL UNIQUE,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_by_id TEXT,
            uploaded_by_role TEXT,
            metadata_json TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (order_no) REFERENCES orders(order_no) ON DELETE SET NULL,
            FOREIGN KEY (invoice_id) REFERENCES finance_invoices(invoice_no) ON DELETE SET NULL
          );

          INSERT INTO documents_migrated (
            id, order_no, invoice_id, document_type, original_name,
            storage_name, mime_type, size_bytes, sha256,
            uploaded_by, uploaded_by_id, uploaded_by_role, metadata_json,
            is_active, created_at, updated_at
          )
          SELECT
            id, order_no, invoice_id, document_type, original_name,
            storage_name, mime_type, size_bytes, sha256,
            uploaded_by, uploaded_by_id, uploaded_by_role, metadata_json,
            ${isActiveExpr}, created_at, ${updatedAtExpr}
          FROM documents;

          DROP TABLE documents;
          ALTER TABLE documents_migrated RENAME TO documents;

          CREATE INDEX IF NOT EXISTS idx_documents_order ON documents(order_no);
          CREATE INDEX IF NOT EXISTS idx_documents_invoice ON documents(invoice_id);
          CREATE INDEX IF NOT EXISTS idx_documents_storage_name ON documents(storage_name);
          CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(is_active);
        `);

        if (fkInitiallyOn) {
          const fkIssues = targetDb.prepare("PRAGMA foreign_key_check;").all();
          if (fkIssues.length > 0) {
            throw new Error(`[MIGRATION_FK_CHECK_FAILED] Foreign key check failed after documents migration: ${JSON.stringify(fkIssues)}`);
          }
        }
      }, targetDb);
    } finally {
      if (fkInitiallyOn) {
        targetDb.exec("PRAGMA foreign_keys = ON;");
      }
    }
  }
}

export function addColumnIfNotExists(
  targetDb: DatabaseSync,
  tableName: string,
  columnName: string,
  columnDef: string
): boolean {
  try {
    const tableInfo = targetDb.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has(columnName)) {
      targetDb.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`[SUN89 Migration] Failed to add column ${columnName} to ${tableName}:`, err);
    return false;
  }
}

export function applySchemaMigrations(targetDb: DatabaseSync): void {
  // Patch D: Master service requirements and versioning
  addColumnIfNotExists(targetDb, "services", "requirements", "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfNotExists(targetDb, "services", "requirements_version", "INTEGER NOT NULL DEFAULT 1");

  // Phase 2 Columns for orders table
  addColumnIfNotExists(targetDb, "orders", "customer_id", "TEXT REFERENCES customers(id)");
  addColumnIfNotExists(targetDb, "orders", "vehicle_id", "TEXT REFERENCES vehicles(id)");
  addColumnIfNotExists(targetDb, "orders", "service_id", "TEXT REFERENCES services(id)");
  addColumnIfNotExists(targetDb, "orders", "tanggal_masuk_berkas", "TEXT");
  addColumnIfNotExists(targetDb, "orders", "samsat_asal_id", "TEXT REFERENCES samsat_offices(id)");
  addColumnIfNotExists(targetDb, "orders", "samsat_tujuan_id", "TEXT DEFAULT '-' REFERENCES samsat_offices(id)");
  addColumnIfNotExists(targetDb, "orders", "cashback_mitra", "REAL DEFAULT 0");
  addColumnIfNotExists(targetDb, "orders", "channel_order", "TEXT DEFAULT 'LOKET_ADMIN'");
  addColumnIfNotExists(targetDb, "orders", "created_by_employee_id", "TEXT REFERENCES employees(id)");

  // Phase 4 Financial & Governance Columns
  addColumnIfNotExists(targetDb, "finance_invoices", "customer_id", "TEXT REFERENCES customers(id)");
  addColumnIfNotExists(targetDb, "kas_kantor", "penanggung_jawab_employee_id", "TEXT REFERENCES employees(id)");
  addColumnIfNotExists(targetDb, "pengeluaran", "reimbursement_id", "TEXT REFERENCES messenger_reimbursements(id)");
  addColumnIfNotExists(targetDb, "pengeluaran", "penanggung_jawab_employee_id", "TEXT REFERENCES employees(id)");
  addColumnIfNotExists(targetDb, "invoice_payments", "metode_pembayaran_id", "TEXT REFERENCES payment_methods(id)");
  addColumnIfNotExists(targetDb, "invoice_payments", "verified_by_employee_id", "TEXT REFERENCES employees(id)");
  addColumnIfNotExists(targetDb, "invoice_payments", "is_void", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfNotExists(targetDb, "invoice_payments", "void_reason", "TEXT");
  addColumnIfNotExists(targetDb, "invoice_payments", "voided_by", "TEXT");
  addColumnIfNotExists(targetDb, "invoice_payments", "voided_at", "TEXT");
  addColumnIfNotExists(targetDb, "invoice_payments", "reversal_kas_id", "INTEGER REFERENCES kas_kantor(id)");
  // Phase 4B Batch 2B Step B: Canonical Payment Identity
  addColumnIfNotExists(targetDb, "invoice_payments", "payment_id", "TEXT");

  try {
    targetDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_vehicle_id ON orders(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_orders_service_id ON orders(service_id);
      CREATE INDEX IF NOT EXISTS idx_orders_samsat_asal_id ON orders(samsat_asal_id);
      CREATE INDEX IF NOT EXISTS idx_orders_samsat_tujuan_id ON orders(samsat_tujuan_id);
      CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by_employee_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON finance_invoices(customer_id);
      CREATE INDEX IF NOT EXISTS idx_kas_kantor_penanggung_jawab ON kas_kantor(penanggung_jawab_employee_id);
      CREATE INDEX IF NOT EXISTS idx_pengeluaran_reimbursement ON pengeluaran(reimbursement_id);
      CREATE INDEX IF NOT EXISTS idx_pengeluaran_penanggung_jawab ON pengeluaran(penanggung_jawab_employee_id);
      CREATE INDEX IF NOT EXISTS idx_inv_payments_method ON invoice_payments(metode_pembayaran_id);
      CREATE INDEX IF NOT EXISTS idx_inv_payments_verified_by ON invoice_payments(verified_by_employee_id);
      CREATE INDEX IF NOT EXISTS idx_inv_payments_void ON invoice_payments(is_void);
      CREATE INDEX IF NOT EXISTS idx_invoices_composite ON finance_invoices(invoice_no, order_no);
      CREATE INDEX IF NOT EXISTS idx_inv_payments_composite ON invoice_payments(invoice_no, order_no);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_payments_payment_id ON invoice_payments(payment_id);
    `);
    migratePaymentMethodsTable(targetDb);
  } catch (err) {
    console.warn("[SUN89 Migration] Warning creating orders indexes:", err);
  }
}

function migrateOrdersTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("biaya_antar_jemput")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN biaya_antar_jemput REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("biaya_jasa")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN biaya_jasa REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("nama_penerima_keluar")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN nama_penerima_keluar TEXT;");
    }
    if (!columnNames.has("bank_uang_keluar")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN bank_uang_keluar TEXT;");
    }
    if (!columnNames.has("metode_pembayaran_keluar")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN metode_pembayaran_keluar TEXT;");
    }
    if (!columnNames.has("alasan_pending")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN alasan_pending TEXT;");
    }
    if (!columnNames.has("service_id")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN service_id TEXT REFERENCES services(id);");
    }
    if (!columnNames.has("tanggal_masuk_berkas")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN tanggal_masuk_berkas TEXT;");
    }
    if (!columnNames.has("samsat_asal")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN samsat_asal TEXT;");
    }
    if (!columnNames.has("samsat_tujuan")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN samsat_tujuan TEXT DEFAULT '-';");
    }
    if (!columnNames.has("is_cost_verified")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN is_cost_verified INTEGER NOT NULL DEFAULT 1;");
    }
    if (!columnNames.has("cost_completeness_status")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN cost_completeness_status TEXT NOT NULL DEFAULT 'COMPLETE';");
    }
    if (!columnNames.has("cost_verified_at")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN cost_verified_at TEXT;");
    }
    if (!columnNames.has("cost_verified_by")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN cost_verified_by TEXT;");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_orders_service_id ON orders(service_id);");

    applySchemaMigrations(targetDb);
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during orders table migration:", err);
  }
}

function migrateFinanceInvoicesTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(finance_invoices)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("service_id")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN service_id TEXT REFERENCES services(id);");
    }
    if (!columnNames.has("biaya_antar_jemput")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN biaya_antar_jemput REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("biaya_jasa")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN biaya_jasa REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("nama_penerima_keluar")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN nama_penerima_keluar TEXT;");
    }
    if (!columnNames.has("biaya_samsat")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN biaya_samsat REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("pendapatan_jasa")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN pendapatan_jasa REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("overpayment")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN overpayment REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("settlement_condition")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN settlement_condition TEXT NOT NULL DEFAULT 'BALANCED';");
    }
    if (!columnNames.has("refund_status")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN refund_status TEXT NOT NULL DEFAULT 'NONE';");
    }
    if (!columnNames.has("cashback_nominal")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN cashback_nominal REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("cashback_status")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN cashback_status TEXT NOT NULL DEFAULT 'PENDING';");
    }
    if (!columnNames.has("cashback_doc_id")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN cashback_doc_id TEXT;");
    }
    if (!columnNames.has("profit_final")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN profit_final REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("profit_status")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN profit_status TEXT NOT NULL DEFAULT 'PENDING';");
    }
    if (!columnNames.has("alasan_pending")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN alasan_pending TEXT;");
    }
    if (!columnNames.has("cost_verification_status")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN cost_verification_status TEXT NOT NULL DEFAULT 'VERIFIED';");
    }
    if (!columnNames.has("is_draft_estimate")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN is_draft_estimate INTEGER NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("is_explicit_zero")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN is_explicit_zero INTEGER NOT NULL DEFAULT 0;");
    }
    targetDb.exec(`
      UPDATE finance_invoices SET is_explicit_zero = 1 
      WHERE (
        json_extract(data_json, '$.isExplicitZero') = 1 OR
        json_extract(data_json, '$.isExplicitZero') = 'true' OR
        json_extract(data_json, '$.is_explicit_zero') = 1 OR
        json_extract(data_json, '$.isZeroCostPromotion') = 1
      ) AND is_explicit_zero = 0;
    `);


    targetDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_invoices_service_id ON finance_invoices(service_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_settlement ON finance_invoices(settlement_condition);
      CREATE INDEX IF NOT EXISTS idx_invoices_profit_status ON finance_invoices(profit_status);
      CREATE INDEX IF NOT EXISTS idx_invoices_cashback_status ON finance_invoices(cashback_status);
    `);
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during finance_invoices table migration:", err);
  }
}

function migrateKasKantorTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(kas_kantor)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("penanggung_jawab")) {
      targetDb.exec("ALTER TABLE kas_kantor ADD COLUMN penanggung_jawab TEXT;");
    }
    if (!columnNames.has("order_no")) {
      targetDb.exec("ALTER TABLE kas_kantor ADD COLUMN order_no TEXT;");
    }
    if (!columnNames.has("invoice_no")) {
      targetDb.exec("ALTER TABLE kas_kantor ADD COLUMN invoice_no TEXT;");
    }
    if (!columnNames.has("kategori")) {
      targetDb.exec("ALTER TABLE kas_kantor ADD COLUMN kategori TEXT;");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_kas_kantor_order ON kas_kantor(order_no);");
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during kas_kantor table migration:", err);
  }
}

function migratePengeluaranTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(pengeluaran)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("penanggung_jawab")) {
      targetDb.exec("ALTER TABLE pengeluaran ADD COLUMN penanggung_jawab TEXT;");
    }
    if (!columnNames.has("order_no")) {
      targetDb.exec("ALTER TABLE pengeluaran ADD COLUMN order_no TEXT;");
    }
    if (!columnNames.has("invoice_no")) {
      targetDb.exec("ALTER TABLE pengeluaran ADD COLUMN invoice_no TEXT;");
    }
    if (!columnNames.has("kategori")) {
      targetDb.exec("ALTER TABLE pengeluaran ADD COLUMN kategori TEXT;");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_pengeluaran_order ON pengeluaran(order_no);");
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during pengeluaran table migration:", err);
  }
}

export function consolidateEmployeesAndUsersMigration(targetDb: DatabaseSync): void {
  try {
    // 1. Ensure employees table has canonical columns
    addColumnIfNotExists(targetDb, "employees", "tanggal_bergabung", "TEXT");
    addColumnIfNotExists(targetDb, "employees", "jenis_kelamin", "TEXT DEFAULT 'Laki-laki'");
    addColumnIfNotExists(targetDb, "employees", "avatar_url", "TEXT");

    const userTableInfo = targetDb.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    if (!userTableInfo || userTableInfo.length === 0) return;

    const userCols = new Set(userTableInfo.map((c) => c.name));

    // If users table has legacy duplicate columns (phone, wilayah, alamat, etc.) or lacks role/last_login_at
    if (userCols.has("phone") || !userCols.has("role") || !userCols.has("last_login_at")) {
      const employees = targetDb.prepare("SELECT * FROM employees").all() as any[];
      const empIdSet = new Set(employees.map((e) => e.id));

      const eaTableExists = targetDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_accounts'")
        .get();
      const eaMap = new Map<string, any>();
      if (eaTableExists) {
        try {
          const eaRows = targetDb.prepare("SELECT * FROM employee_accounts").all() as any[];
          for (const ea of eaRows) {
            if (ea.email) eaMap.set(ea.email.toLowerCase(), ea);
          }
        } catch (_) {}
      }

      const users = targetDb.prepare("SELECT * FROM users").all() as any[];

      const fkInitiallyOn = (targetDb.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys === 1;
      if (fkInitiallyOn) {
        targetDb.exec("PRAGMA foreign_keys = OFF;");
      }

      try {
        runInTransaction(() => {
          targetDb.exec(`
            CREATE TABLE users_consolidated (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              employee_id TEXT UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              password_salt TEXT NOT NULL,
              nama TEXT NOT NULL,
              jabatan TEXT NOT NULL DEFAULT 'ADMIN',
              role TEXT NOT NULL DEFAULT 'admin',
              status TEXT NOT NULL DEFAULT 'Aktif',
              avatar_url TEXT,
              last_login_at TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
          `);

          const insertStmt = targetDb.prepare(`
            INSERT INTO users_consolidated (
              id, employee_id, email, password_hash, password_salt, nama, jabatan, role, status, avatar_url, last_login_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const u of users) {
            let mappedEmpId: string | null = u.employee_id ? String(u.employee_id).trim() : null;

            const cleanEmail = (u.email || "").trim().toLowerCase();
            if (u.id === 1 || cleanEmail === "svp@birojasa.com") mappedEmpId = "EMP-0001";
            else if (u.id === 2 || cleanEmail === "admin@birojasa.com") mappedEmpId = "EMP-0002";
            else if (u.id === 3 || cleanEmail === "finance@birojasa.com") mappedEmpId = "EMP-0003";
            else if (u.id === 4 || cleanEmail === "budi.messenger@birojasa.com") mappedEmpId = "EMP-0004";
            else if (u.id === 5 || cleanEmail === "andi.messenger@birojasa.com") mappedEmpId = "EMP-0005";
            else if (u.id === 6 || cleanEmail === "messenger@birojasa.com") mappedEmpId = "EMP-0006";
            else if (!mappedEmpId && eaMap.has(cleanEmail)) {
              mappedEmpId = eaMap.get(cleanEmail).employee_id;
            }

            if (mappedEmpId && !empIdSet.has(mappedEmpId)) {
              const numMatch = mappedEmpId.match(/^EMP-(\d+)$/i);
              if (numMatch) {
                const padded = `EMP-${numMatch[1].padStart(4, "0")}`;
                if (empIdSet.has(padded)) {
                  mappedEmpId = padded;
                } else {
                  mappedEmpId = null;
                }
              } else {
                mappedEmpId = null;
              }
            }

            const rawJabatan = (u.jabatan || "ADMIN").toUpperCase();
            const role = (
              u.role ||
              (rawJabatan === "SVP"
                ? "svp"
                : rawJabatan === "FINANCE"
                ? "finance"
                : rawJabatan === "MESSENGER"
                ? "messenger"
                : "admin")
            ).toLowerCase();

            const ea = eaMap.get(cleanEmail);
            const lastLogin = u.last_login_at || (ea ? ea.last_login_at : null);
            const avatarUrl = u.avatar_url || null;

            insertStmt.run(
              u.id,
              mappedEmpId,
              u.email,
              u.password_hash,
              u.password_salt,
              u.nama,
              u.jabatan || "ADMIN",
              role,
              u.status || "Aktif",
              avatarUrl,
              lastLogin,
              u.created_at || new Date().toISOString(),
              u.updated_at || new Date().toISOString()
            );

            if (mappedEmpId && empIdSet.has(mappedEmpId)) {
              try {
                targetDb
                  .prepare(
                    `
                    UPDATE employees
                    SET 
                      tanggal_bergabung = COALESCE(tanggal_bergabung, ?),
                      jenis_kelamin = COALESCE(jenis_kelamin, ?),
                      avatar_url = COALESCE(avatar_url, ?)
                    WHERE id = ?
                  `
                  )
                  .run(u.tanggal_bergabung || null, u.jenis_kelamin || null, avatarUrl, mappedEmpId);
              } catch (_) {}
            }
          }

          targetDb.exec("DROP TABLE users;");
          targetDb.exec("ALTER TABLE users_consolidated RENAME TO users;");
          targetDb.exec("DROP TABLE IF EXISTS employee_accounts;");

          targetDb.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
            CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
          `);

          if (fkInitiallyOn) {
            const fkIssues = targetDb.prepare("PRAGMA foreign_key_check;").all();
            if (fkIssues.length > 0) {
              throw new Error(`[MIGRATION_FK_CHECK_FAILED] Foreign key check failed after users consolidation: ${JSON.stringify(fkIssues)}`);
            }
          }
        }, targetDb);
      } finally {
        if (fkInitiallyOn) {
          targetDb.exec("PRAGMA foreign_keys = ON;");
        }
      }
    } else {
      // Idempotent pass: ensure employee_accounts is dropped
      targetDb.exec("DROP TABLE IF EXISTS employee_accounts;");
    }
  } catch (err) {
    console.error("[SUN89 Migration] Error during consolidateEmployeesAndUsersMigration:", err);
    throw err;
  }
}

function migrateUsersTable(targetDb: DatabaseSync): void {
  consolidateEmployeesAndUsersMigration(targetDb);
}

function migrateKasMessengerTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(kas_messenger)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("reimbursement_id")) {
      targetDb.exec("ALTER TABLE kas_messenger ADD COLUMN reimbursement_id TEXT;");
    }
    if (!columnNames.has("receipt_url")) {
      targetDb.exec("ALTER TABLE kas_messenger ADD COLUMN receipt_url TEXT;");
    }
    if (!columnNames.has("kategori")) {
      targetDb.exec("ALTER TABLE kas_messenger ADD COLUMN kategori TEXT;");
    }
    if (!columnNames.has("messenger_id")) {
      targetDb.exec("ALTER TABLE kas_messenger ADD COLUMN messenger_id TEXT REFERENCES messengers(id);");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_kas_messenger_reimb ON kas_messenger(reimbursement_id);");
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_kas_messenger_messenger_id ON kas_messenger(messenger_id);");
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during kas_messenger table migration:", err);
  }
}

function migrateMessengerReimbursementsTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(messenger_reimbursements)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("kas_messenger_id")) {
      targetDb.exec("ALTER TABLE messenger_reimbursements ADD COLUMN kas_messenger_id INTEGER;");
    }
    if (!columnNames.has("channel")) {
      targetDb.exec("ALTER TABLE messenger_reimbursements ADD COLUMN channel TEXT;");
    }
    if (!columnNames.has("messenger_id")) {
      targetDb.exec("ALTER TABLE messenger_reimbursements ADD COLUMN messenger_id TEXT REFERENCES messengers(id);");
    }
    if (!columnNames.has("approved_by_employee_id")) {
      targetDb.exec("ALTER TABLE messenger_reimbursements ADD COLUMN approved_by_employee_id TEXT REFERENCES employees(id);");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_reimb_kas_msg ON messenger_reimbursements(kas_messenger_id);");
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_reimb_messenger_id ON messenger_reimbursements(messenger_id);");
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_reimb_approved_by ON messenger_reimbursements(approved_by_employee_id);");
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during messenger_reimbursements table migration:", err);
  }
}

function migrateIdempotencyKeysTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(idempotency_keys)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("user_id")) {
      targetDb.exec("ALTER TABLE idempotency_keys ADD COLUMN user_id TEXT;");
    }
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during idempotency_keys table migration:", err);
  }
}


function migrateInternalTransfersTable(targetDb: DatabaseSync): void {
  try {
    targetDb.exec(`
      CREATE TABLE IF NOT EXISTS internal_transfers (
        id TEXT PRIMARY KEY,
        transfer_date TEXT NOT NULL,
        transfer_type TEXT NOT NULL,
        from_account TEXT NOT NULL,
        to_account TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK(amount > 0 AND amount <= 9007199254740991),
        messenger_id TEXT NOT NULL REFERENCES messengers(id),
        messenger_name TEXT NOT NULL,
        kas_messenger_id INTEGER NOT NULL REFERENCES kas_messenger(id),
        kas_kantor_id INTEGER NOT NULL REFERENCES kas_kantor(id),
        status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('COMPLETED', 'REVERSED')),
        idempotency_key TEXT UNIQUE NOT NULL,
        reversal_ref_id TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_transfers_type_date ON internal_transfers(transfer_type, transfer_date);
      CREATE INDEX IF NOT EXISTS idx_transfers_messenger ON internal_transfers(messenger_id);
      CREATE INDEX IF NOT EXISTS idx_transfers_idemp ON internal_transfers(idempotency_key);
    `);
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during internal_transfers table migration:", err);
  }
}


export function migrateFileDeletionJobsTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(file_deletion_jobs)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) {
      targetDb.exec(`
        CREATE TABLE IF NOT EXISTS file_deletion_jobs (
          id TEXT PRIMARY KEY,
          file_path TEXT NOT NULL,
          category TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 3,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_file_del_status ON file_deletion_jobs(status);
      `);
      return;
    }

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (columnNames.has("target_user_id")) {
      const fkInitiallyOn = (targetDb.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys === 1;
      if (fkInitiallyOn) {
        targetDb.exec("PRAGMA foreign_keys = OFF;");
      }

      try {
        runInTransaction(() => {
          targetDb.exec(`
            DROP INDEX IF EXISTS idx_file_del_target;

            CREATE TABLE file_deletion_jobs_new (
              id TEXT PRIMARY KEY,
              file_path TEXT NOT NULL,
              category TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
              retry_count INTEGER NOT NULL DEFAULT 0,
              max_retries INTEGER NOT NULL DEFAULT 3,
              last_error TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            INSERT INTO file_deletion_jobs_new (id, file_path, category, status, retry_count, max_retries, last_error, created_at, updated_at)
            SELECT id, file_path, category, status, retry_count, max_retries, last_error, created_at, updated_at
            FROM file_deletion_jobs;

            DROP TABLE file_deletion_jobs;
            ALTER TABLE file_deletion_jobs_new RENAME TO file_deletion_jobs;
            CREATE INDEX IF NOT EXISTS idx_file_del_status ON file_deletion_jobs(status);
          `);

          if (fkInitiallyOn) {
            const fkIssues = targetDb.prepare("PRAGMA foreign_key_check;").all();
            if (fkIssues.length > 0) {
              throw new Error(`[MIGRATION_FK_CHECK_FAILED] Foreign key check failed after file_deletion_jobs migration: ${JSON.stringify(fkIssues)}`);
            }
          }
        }, targetDb);
      } finally {
        if (fkInitiallyOn) {
          targetDb.exec("PRAGMA foreign_keys = ON;");
        }
      }
    } else {
      targetDb.exec(`
        DROP INDEX IF EXISTS idx_file_del_target;
        CREATE INDEX IF NOT EXISTS idx_file_del_status ON file_deletion_jobs(status);
      `);
    }
  } catch (err) {
    console.error("[SUN89 Migration] Error during file_deletion_jobs table migration:", err);
    throw err;
  }
}

export function migrateSecurityAuditLogsTable(targetDb: DatabaseSync): void {
  try {
    targetDb.exec(`
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        action TEXT NOT NULL,
        module TEXT NOT NULL,
        details TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_logs(created_at);
    `);
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during security_audit_logs table migration:", err);
  }
}

export function migratePaymentMethodsTable(targetDb: DatabaseSync): boolean {
  try {
    const tableExists = targetDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='payment_methods'").get();
    if (!tableExists) return false;

    // Check if single-column UNIQUE index on nama_metode exists (from legacy schema)
    const indexList = targetDb.prepare("PRAGMA index_list(payment_methods)").all() as Array<{ name: string; unique: number; origin: string }>;
    let hasOldUniqueNamaMetode = false;
    for (const idx of indexList) {
      if (idx.origin === "u") {
        const info = targetDb.prepare(`PRAGMA index_info('${idx.name}')`).all() as Array<{ name: string }>;
        if (info.length === 1 && info[0].name === "nama_metode") {
          hasOldUniqueNamaMetode = true;
          break;
        }
      }
    }

    if (!hasOldUniqueNamaMetode) {
      // Ensure the new partial unique indexes exist
      targetDb.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_account 
          ON payment_methods(nama_metode, LOWER(bank), nomor_rekening) 
          WHERE nama_metode = 'Transfer Bank' AND nomor_rekening != '';

        CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_tunai_active 
          ON payment_methods(nama_metode) 
          WHERE nama_metode = 'Tunai' AND status = 'Aktif';
      `);
      return false;
    }

    const fkInitiallyOn = (targetDb.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys === 1;
    if (fkInitiallyOn) {
      targetDb.exec("PRAGMA foreign_keys = OFF;");
    }

    try {
      runInTransaction(() => {
        targetDb.exec(`
          CREATE TABLE payment_methods_migrated (
            id TEXT PRIMARY KEY,
            nama_metode TEXT NOT NULL,
            bank TEXT NOT NULL DEFAULT '',
            nama_rekening TEXT DEFAULT '',
            nomor_rekening TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'Aktif',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          INSERT INTO payment_methods_migrated (
            id, nama_metode, bank, nama_rekening, nomor_rekening, status, created_at, updated_at
          )
          SELECT
            id,
            CASE 
              WHEN LOWER(nama_metode) = 'cash' THEN 'Tunai'
              ELSE nama_metode
            END,
            COALESCE(bank, ''),
            COALESCE(nama_rekening, ''),
            COALESCE(nomor_rekening, ''),
            COALESCE(status, 'Aktif'),
            created_at,
            updated_at
          FROM payment_methods;

          DROP TABLE payment_methods;
          ALTER TABLE payment_methods_migrated RENAME TO payment_methods;

          CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_account 
            ON payment_methods(nama_metode, LOWER(bank), nomor_rekening) 
            WHERE nama_metode = 'Transfer Bank' AND nomor_rekening != '';

          CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_tunai_active 
            ON payment_methods(nama_metode) 
            WHERE nama_metode = 'Tunai' AND status = 'Aktif';
        `);

        if (fkInitiallyOn) {
          const fkIssues = targetDb.prepare("PRAGMA foreign_key_check;").all();
          if (fkIssues.length > 0) {
            throw new Error(`[MIGRATION_FK_CHECK_FAILED] Foreign key check failed after payment_methods migration: ${JSON.stringify(fkIssues)}`);
          }
        }
      }, targetDb);
    } finally {
      if (fkInitiallyOn) {
        targetDb.exec("PRAGMA foreign_keys = ON;");
      }
    }

    console.log("[SUN89 Migration] Successfully migrated payment_methods constraint to multi-account schema.");
    return true;
  } catch (err) {
    console.error("[SUN89 Migration] Error migrating payment_methods constraint:", err);
    throw err;
  }
}

function migrateSamsatOfficesTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(samsat_offices)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("id_biaya_layanan")) {
      targetDb.exec("ALTER TABLE samsat_offices ADD COLUMN id_biaya_layanan TEXT;");
    }
    if (!columnNames.has("nama_kantor")) {
      targetDb.exec("ALTER TABLE samsat_offices ADD COLUMN nama_kantor TEXT;");
      targetDb.exec("UPDATE samsat_offices SET nama_kantor = name WHERE nama_kantor IS NULL;");
    }
    if (!columnNames.has("provinsi")) {
      targetDb.exec("ALTER TABLE samsat_offices ADD COLUMN provinsi TEXT;");
    }
    if (!columnNames.has("alamat_lengkap")) {
      targetDb.exec("ALTER TABLE samsat_offices ADD COLUMN alamat_lengkap TEXT;");
      targetDb.exec("UPDATE samsat_offices SET alamat_lengkap = alamat WHERE alamat_lengkap IS NULL;");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_samsat_biaya ON samsat_offices(id_biaya_layanan);");
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during samsat_offices table migration:", err);
  }
}

export function migratePricingTables(targetDb: DatabaseSync): boolean {
  try {
    const pricingInfo = targetDb.prepare("PRAGMA table_info(samsat_pricing)").all() as { name: string; type: string }[];
    if (!pricingInfo || pricingInfo.length === 0) return false;

    const pricingCols = new Map(pricingInfo.map((c) => [c.name, c.type.toUpperCase()]));
    const needsPricingRebuild =
      !pricingCols.has("is_configured") ||
      !pricingCols.has("is_active") ||
      pricingCols.get("biaya_dasar") !== "INTEGER";

    const tariffInfo = targetDb.prepare("PRAGMA table_info(samsat_operational_tariffs)").all() as { name: string; type: string }[];
    const tariffCols = new Set(tariffInfo.map((c) => c.name));
    const tariffFks = targetDb.prepare("PRAGMA foreign_key_list(samsat_operational_tariffs)").all() as { table: string }[];
    const hasPricingFk = tariffFks.some((fk) => fk.table === "samsat_pricing");
    const hasEmployeeFk = tariffCols.has("created_by_employee_id") && tariffCols.has("updated_by_employee_id");

    const needsTariffRebuild = !hasPricingFk || !hasEmployeeFk;

    if (!needsPricingRebuild && !needsTariffRebuild) {
      targetDb.exec(`
        CREATE INDEX IF NOT EXISTS idx_samsat_pricing_lookup ON samsat_pricing(kategori, tipe_kendaraan);
        CREATE INDEX IF NOT EXISTS idx_samsat_pricing_active ON samsat_pricing(is_active);
        CREATE INDEX IF NOT EXISTS idx_samsat_tariffs_office ON samsat_operational_tariffs(samsat_id);
        CREATE INDEX IF NOT EXISTS idx_samsat_tariffs_item ON samsat_operational_tariffs(pricing_item_id);
        CREATE INDEX IF NOT EXISTS idx_samsat_tariffs_active ON samsat_operational_tariffs(is_active);
      `);
      return false;
    }

    const fkInitiallyOn = (targetDb.prepare("PRAGMA foreign_keys").get() as any)?.foreign_keys === 1;
    if (fkInitiallyOn) {
      targetDb.exec("PRAGMA foreign_keys = OFF;");
    }

    try {
      runInTransaction(() => {
        if (needsPricingRebuild) {
          targetDb.exec(`
            CREATE TABLE samsat_pricing_migrated (
              id TEXT PRIMARY KEY,
              nama_item TEXT NOT NULL,
              kategori TEXT NOT NULL,
              tipe_kendaraan TEXT NOT NULL,
              biaya_dasar INTEGER NOT NULL DEFAULT 0 CHECK(biaya_dasar >= 0),
              deskripsi TEXT,
              is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
              is_configured INTEGER NOT NULL DEFAULT 0 CHECK(is_configured IN (0, 1)),
              data_json TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            INSERT INTO samsat_pricing_migrated (
              id, nama_item, kategori, tipe_kendaraan, biaya_dasar, deskripsi, is_active, is_configured, data_json, created_at, updated_at
            )
            SELECT
              id,
              nama_item,
              kategori,
              tipe_kendaraan,
              CAST(ROUND(biaya_dasar) AS INTEGER),
              deskripsi,
              CASE
                WHEN json_extract(data_json, '$.active') = 0 OR json_extract(data_json, '$.active') = false THEN 0
                ELSE 1
              END,
              CASE
                WHEN biaya_dasar > 0 THEN 1
                WHEN json_extract(data_json, '$.isConfigured') = 1 OR json_extract(data_json, '$.isConfigured') = true THEN 1
                ELSE 0
              END,
              data_json,
              datetime('now'),
              COALESCE(updated_at, datetime('now'))
            FROM samsat_pricing;

            DROP TABLE samsat_pricing;
            ALTER TABLE samsat_pricing_migrated RENAME TO samsat_pricing;

            CREATE INDEX IF NOT EXISTS idx_samsat_pricing_lookup ON samsat_pricing(kategori, tipe_kendaraan);
            CREATE INDEX IF NOT EXISTS idx_samsat_pricing_active ON samsat_pricing(is_active);
          `);
        }

        if (needsTariffRebuild) {
          targetDb.exec(`
            CREATE TABLE samsat_operational_tariffs_migrated (
              id TEXT PRIMARY KEY,
              samsat_id TEXT NOT NULL,
              pricing_item_id TEXT NOT NULL,
              nominal INTEGER NOT NULL CHECK(nominal >= 0),
              is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
              created_by_employee_id TEXT,
              updated_by_employee_id TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (samsat_id) REFERENCES samsat_offices(id) ON DELETE RESTRICT,
              FOREIGN KEY (pricing_item_id) REFERENCES samsat_pricing(id) ON DELETE RESTRICT,
              FOREIGN KEY (created_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
              FOREIGN KEY (updated_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
              UNIQUE(samsat_id, pricing_item_id)
            );

            DELETE FROM samsat_operational_tariffs
            WHERE samsat_id NOT IN (SELECT id FROM samsat_offices)
               OR pricing_item_id NOT IN (SELECT id FROM samsat_pricing);

            INSERT INTO samsat_operational_tariffs_migrated (
              id, samsat_id, pricing_item_id, nominal, is_active, created_by_employee_id, updated_by_employee_id, created_at, updated_at
            )
            SELECT
              id,
              samsat_id,
              pricing_item_id,
              CAST(ROUND(nominal) AS INTEGER),
              COALESCE(is_active, 1),
              NULL,
              NULL,
              created_at,
              updated_at
            FROM samsat_operational_tariffs;

            DROP TABLE samsat_operational_tariffs;
            ALTER TABLE samsat_operational_tariffs_migrated RENAME TO samsat_operational_tariffs;

            CREATE INDEX IF NOT EXISTS idx_samsat_tariffs_office ON samsat_operational_tariffs(samsat_id);
            CREATE INDEX IF NOT EXISTS idx_samsat_tariffs_item ON samsat_operational_tariffs(pricing_item_id);
            CREATE INDEX IF NOT EXISTS idx_samsat_tariffs_active ON samsat_operational_tariffs(is_active);
          `);
        }

        if (fkInitiallyOn) {
          const fkIssues = targetDb.prepare("PRAGMA foreign_key_check;").all();
          if (fkIssues.length > 0) {
            throw new Error(`[MIGRATION_FK_CHECK_FAILED] Foreign key check failed after pricing migration: ${JSON.stringify(fkIssues)}`);
          }
        }
      }, targetDb);

      console.log("[SUN89 Migration] Pricing tables successfully migrated to National Default + Per-Samsat Override schema.");
      return true;
    } finally {
      if (fkInitiallyOn) {
        targetDb.exec("PRAGMA foreign_keys = ON;");
      }
    }
  } catch (err) {
    console.error("[SUN89 Migration] Error during pricing tables migration:", err);
    throw err;
  }
}

export function cleanupLegacyStandardPricingItems(targetDb: DatabaseSync): boolean {
  try {
    return runInTransaction(() => {
      const stdIds = ["std-cek-fisik", "std-pendaftaran", "std-cetak-stnk", "std-cetak-plat", "std-validasi-bpkb"];
      const placeholders = stdIds.map(() => "?").join(",");

      const tableExists = targetDb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='samsat_pricing'").get();
      if (!tableExists) return false;

      const existing = targetDb.prepare(`
        SELECT * FROM samsat_pricing WHERE id IN (${placeholders})
      `).all(...stdIds) as any[];

      if (!existing || existing.length === 0) {
        return false;
      }

      const tariffTableExists = targetDb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='samsat_operational_tariffs'").get();
      if (tariffTableExists) {
        const tariffCount = (targetDb.prepare(`
          SELECT COUNT(*) as n FROM samsat_operational_tariffs WHERE pricing_item_id IN (${placeholders})
        `).get(...stdIds) as { n: number }).n;
        if (tariffCount > 0) {
          console.warn(`[SUN89 Cleanup] Aborted: ${tariffCount} operational tariff overrides reference legacy std items.`);
          return false;
        }
      }

      const auditTableExists = targetDb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_logs'").get();
      if (auditTableExists) {
        try {
          targetDb.prepare(`
            INSERT INTO audit_logs (id, user_id, user_name, user_role, action, module, details, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            `audit-cleanup-std-${Date.now()}`,
            "SYSTEM_MIGRATION",
            "System Migration",
            "system",
            "DELETE",
            "Master Data",
            `Pembersihan 5 item legacy Layanan Standar dari samsat_pricing (${existing.map((r: any) => r.id).join(", ")})`,
            JSON.stringify({ deletedRows: existing })
          );
        } catch (auditErr) {
          console.warn("[SUN89 Cleanup] Could not log audit entry, continuing deletion:", auditErr);
        }
      }

      targetDb.prepare(`
        DELETE FROM samsat_pricing WHERE id IN (${placeholders})
      `).run(...stdIds);

      console.log(`[SUN89 Cleanup] Successfully cleaned up ${existing.length} legacy standard pricing items from samsat_pricing.`);
      return true;
    }, targetDb);
  } catch (err) {
    console.error("[SUN89 Cleanup] Error cleaning up legacy standard pricing items:", err);
    return false;
  }
}

export interface AmbiguousPaymentCandidate {
  invoice_no: string;
  order_no?: string | null;
  candidateId?: string | null;
  nominal: number;
  tanggal?: string;
  reason: string;
}

export interface BackfillHistoricalFinanceResult {
  backfilledInvoices: number;
  backfilledPayments: number;
  ambiguousPayments: AmbiguousPaymentCandidate[];
  kasKantorStats: {
    mapped: number;
    unmatched: number;
    ambiguous: number;
    remainingEmpty: number;
  };
  pengeluaranStats: {
    mapped: number;
    unmatched: number;
    ambiguous: number;
    remainingEmpty: number;
  };
}

/**
 * Strict calendar date validation (YYYY-MM-DD).
 * Validates syntax, month 1-12, day 1-31, and actual calendar validity (e.g. leap years, Feb 28/29).
 */
export function isValidCalendarDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [yearStr, monthStr, dayStr] = str.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Strict complete ISO 8601 timestamp validation.
 * Supports complete UTC timestamps: YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.sssZ.
 */
export function isValidIsoTimestamp(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(str)) {
    return false;
  }
  const datePart = str.slice(0, 10);
  if (!isValidCalendarDate(datePart)) return false;
  const timePart = str.slice(11, 19);
  const [hStr, mStr, sStr] = timePart.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const s = parseInt(sStr, 10);
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

/**
 * Exact token-bounded idempotency key matching for historical payment backfill.
 * Strictly prevents substring collisions (e.g. PAY-12 vs PAY-123) and enforces
 * verifiable stable payment identity.
 */
export function matchCandidateIdempotencyKey(
  epKey: string | null,
  invNo: string,
  candidateSourceId: string | null,
  canonicalKey: string,
  legacyKeys: string[],
  candidateDates: string[] = []
): { isMatch: boolean; isAmbiguous?: boolean; reason?: string } {
  if (!epKey) return { isMatch: false };

  // D1-A Mandate: Confirmed deduplication requires verifiable stable payment identity.
  // Candidates lacking a stable source ID cannot establish identity via idempotency keys.
  // Non-unique attribute fingerprints or nominal-only keys must NEVER establish identity.
  if (!candidateSourceId) {
    return { isMatch: false };
  }

  // 1. Exact match with canonical key
  if (epKey === canonicalKey) {
    return { isMatch: true };
  }

  // 2. Exact match with source ID or simple BACKFILL prefix
  if (epKey === candidateSourceId || epKey === `BACKFILL-${candidateSourceId}`) {
    return { isMatch: true };
  }

  // 3. Strict token-bounded matching within invoice scope:
  // Key format: BACKFILL-${invNo}-${candidateSourceId} or BACKFILL-${invNo}-${candidateSourceId}-${suffix}
  // The prefix must match EXACTLY followed by either end-of-string or '-' delimiter.
  const prefix = `BACKFILL-${invNo}-${candidateSourceId}`;
  if (epKey === prefix) {
    return { isMatch: true };
  }

  if (epKey.startsWith(`${prefix}-`)) {
    const suffix = epKey.slice(`${prefix}-`.length);

    // Format 1: 'init' suffix
    if (suffix === "init") {
      return { isMatch: true };
    }

    // Format 2: Recognized epoch timestamp (10 to 14 numeric digits)
    if (/^\d{10,14}$/.test(suffix)) {
      return { isMatch: true };
    }

    // Format 3: Complete calendar date (YYYY-MM-DD)
    if (isValidCalendarDate(suffix)) {
      if (!Array.isArray(candidateDates) || candidateDates.length === 0) {
        return {
          isMatch: false,
          isAmbiguous: true,
          reason: `Key '${epKey}' starts with '${prefix}-' and has calendar date suffix '${suffix}' but candidateDates is empty or unavailable. Date relationship with candidate source ID '${candidateSourceId}' cannot be confirmed.`,
        };
      }
      if (!candidateDates.includes(suffix)) {
        return {
          isMatch: false,
          isAmbiguous: true,
          reason: `Key '${epKey}' starts with '${prefix}-' but calendar date suffix '${suffix}' does not match candidate payment date(s) [${candidateDates.join(", ")}]. Possible identity conflict with candidate source ID '${candidateSourceId}'.`,
        };
      }
      return { isMatch: true };
    }

    // Format 4: Complete ISO 8601 timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)
    if (isValidIsoTimestamp(suffix)) {
      if (!Array.isArray(candidateDates) || candidateDates.length === 0) {
        return {
          isMatch: false,
          isAmbiguous: true,
          reason: `Key '${epKey}' starts with '${prefix}-' and has ISO timestamp suffix '${suffix}' but candidateDates is empty or unavailable. Date relationship with candidate source ID '${candidateSourceId}' cannot be confirmed.`,
        };
      }
      const suffixDate = suffix.slice(0, 10);
      if (!candidateDates.includes(suffix) && !candidateDates.includes(suffixDate)) {
        return {
          isMatch: false,
          isAmbiguous: true,
          reason: `Key '${epKey}' starts with '${prefix}-' but ISO timestamp suffix '${suffix}' does not match candidate payment date(s) [${candidateDates.join(", ")}]. Possible identity conflict with candidate source ID '${candidateSourceId}'.`,
        };
      }
      return { isMatch: true };
    }

    // Trailing token is unrecognized or invalid (e.g. -PART2, -EXTRA, invalid Feb 31, malformed timestamp)
    return {
      isMatch: false,
      isAmbiguous: true,
      reason: `Key '${epKey}' starts with '${prefix}-' but trailing token '${suffix}' is not a recognized timestamp/date. Possible identity ambiguity with candidate source ID '${candidateSourceId}'.`,
    };
  }

  // 4. Exact match with known verified legacy keys (non-date or verified external keys)
  if (legacyKeys.includes(epKey)) {
    return { isMatch: true };
  }

  return { isMatch: false };
}

export function backfillHistoricalFinanceData(targetDb: DatabaseSync): BackfillHistoricalFinanceResult {
  return runInTransaction(() => {
    const result: BackfillHistoricalFinanceResult = {
      backfilledInvoices: 0,
      backfilledPayments: 0,
      ambiguousPayments: [],
      kasKantorStats: { mapped: 0, unmatched: 0, ambiguous: 0, remainingEmpty: 0 },
      pengeluaranStats: { mapped: 0, unmatched: 0, ambiguous: 0, remainingEmpty: 0 },
    };

    // 1. Gather all known valid orders and invoices for strict relational verification
    const knownOrders = new Set<string>();
    const ordRows = targetDb.prepare("SELECT order_no FROM orders").all() as { order_no: string }[];
    for (const r of ordRows) {
      if (r.order_no) knownOrders.add(r.order_no);
    }

    const knownInvoices = new Map<string, string | null>();
    const invRows = targetDb.prepare("SELECT invoice_no, order_no FROM finance_invoices").all() as { invoice_no: string; order_no: string | null }[];
    for (const r of invRows) {
      if (r.invoice_no) knownInvoices.set(r.invoice_no, r.order_no || null);
    }

    // 2. Backfill finance_invoices & invoice_payments
    // Phase 1: Populate missing/NULL fields only — NEVER overwrite existing verified financial metrics
    const invStmt = targetDb.prepare(`
      SELECT id, invoice_no, order_no, total_tagihan, dibayar, sisa, status, data_json, created_at,
             biaya_samsat, pendapatan_jasa, overpayment, settlement_condition, refund_status,
             cashback_nominal, cashback_status, profit_final, profit_status, is_explicit_zero
      FROM finance_invoices
    `);
    const invoices = invStmt.all() as any[];

    const updateInvStmt = targetDb.prepare(`
      UPDATE finance_invoices SET
        biaya_samsat = ?,
        pendapatan_jasa = ?,
        overpayment = ?,
        settlement_condition = ?,
        refund_status = ?,
        cashback_nominal = ?,
        cashback_status = ?,
        profit_final = ?,
        profit_status = ?
      WHERE id = ?
    `);

    const insertPaymentStmt = targetDb.prepare(`
      INSERT OR IGNORE INTO invoice_payments (
        invoice_no, order_no, nominal, metode_pembayaran, nama_bank,
        nomor_rekening, tanggal_bayar, document_id, status_verifikasi,
        idempotency_key, verified_by, verified_at, catatan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const inv of invoices) {
      let parsedJson: any = {};
      try {
        parsedJson = JSON.parse(inv.data_json || "{}");
      } catch {}

      const rawBiayaSamsat = Number(parsedJson.biayaSamsat || parsedJson.biaya_samsat || 0);
      const totalTagihan = Number(inv.total_tagihan || parsedJson.totalTagihan || 0);
      const rawPendapatanJasa = Math.max(0, totalTagihan - rawBiayaSamsat);
      const rawOverpayment = Number(parsedJson.overpayment || 0);
      const rawSettlementCondition = parsedJson.settlementCondition || (inv.status === "Lunas" ? "BALANCED" : "UNDERPAID");
      const rawRefundStatus = parsedJson.refundStatus || "NONE";
      const rawCashbackNominal = Number(parsedJson.cashback || parsedJson.jumlahCashback || 0);
      const rawCashbackStatus = parsedJson.cashbackStatus || (rawCashbackNominal > 0 ? "PENDING" : "APPROVED");
      const rawProfitFinal = Number(parsedJson.profit || 0);
      const rawProfitStatus = parsedJson.profitStatus || (inv.status === "Lunas" ? "REALIZED" : "PENDING");

      // Check whether target columns are currently missing or uninitialized.
      // Strict rule: Automatic backfill populates fields ONLY when existing value is NULL or undefined.
      // Numeric 0 is a legitimate stored value and must NEVER be overwritten.
      const hasStoredBiayaSamsat = inv.biaya_samsat !== null && inv.biaya_samsat !== undefined;
      const hasStoredPendapatanJasa = inv.pendapatan_jasa !== null && inv.pendapatan_jasa !== undefined;
      const hasStoredProfitFinal = inv.profit_final !== null && inv.profit_final !== undefined;
      const hasStoredOverpayment = inv.overpayment !== null && inv.overpayment !== undefined;
      const hasStoredCashbackNominal = inv.cashback_nominal !== null && inv.cashback_nominal !== undefined;

      const targetBiayaSamsat = hasStoredBiayaSamsat ? inv.biaya_samsat : rawBiayaSamsat;
      const targetPendapatanJasa = hasStoredPendapatanJasa ? inv.pendapatan_jasa : rawPendapatanJasa;
      const targetProfitFinal = hasStoredProfitFinal ? inv.profit_final : rawProfitFinal;
      const targetOverpayment = hasStoredOverpayment ? inv.overpayment : rawOverpayment;
      const targetCashbackNominal = hasStoredCashbackNominal ? inv.cashback_nominal : rawCashbackNominal;
      const targetSettlementCondition = (inv.settlement_condition !== null && inv.settlement_condition !== undefined) ? inv.settlement_condition : rawSettlementCondition;
      const targetRefundStatus = (inv.refund_status !== null && inv.refund_status !== undefined) ? inv.refund_status : rawRefundStatus;
      const targetCashbackStatus = (inv.cashback_status !== null && inv.cashback_status !== undefined) ? inv.cashback_status : rawCashbackStatus;
      const targetProfitStatus = (inv.profit_status !== null && inv.profit_status !== undefined) ? inv.profit_status : rawProfitStatus;

      // Only execute UPDATE if missing fields need population
      const needsUpdate =
        inv.biaya_samsat !== targetBiayaSamsat ||
        inv.pendapatan_jasa !== targetPendapatanJasa ||
        inv.overpayment !== targetOverpayment ||
        inv.settlement_condition !== targetSettlementCondition ||
        inv.refund_status !== targetRefundStatus ||
        inv.cashback_nominal !== targetCashbackNominal ||
        inv.cashback_status !== targetCashbackStatus ||
        inv.profit_final !== targetProfitFinal ||
        inv.profit_status !== targetProfitStatus;

      if (needsUpdate) {
        updateInvStmt.run(
          targetBiayaSamsat,
          targetPendapatanJasa,
          targetOverpayment,
          targetSettlementCondition,
          targetRefundStatus,
          targetCashbackNominal,
          targetCashbackStatus,
          targetProfitFinal,
          targetProfitStatus,
          inv.id
        );
        result.backfilledInvoices++;
      }

      // Check ALL existing payment records in invoice_payments for this invoice
      const existingPayments = targetDb.prepare(`
        SELECT id, payment_id, invoice_no, order_no, nominal, status_verifikasi,
               idempotency_key, kas_kantor_id, tanggal_bayar, document_id, is_void
        FROM invoice_payments
        WHERE invoice_no = ?
      `).all(inv.invoice_no) as any[];

      // Check if order has paymentRecords
      let orderJson: any = {};
      if (inv.order_no) {
        try {
          const ordRow = targetDb.prepare("SELECT data_json FROM orders WHERE order_no = ?").get(inv.order_no) as any;
          if (ordRow?.data_json) orderJson = JSON.parse(ordRow.data_json);
        } catch {}
      }

      const pRecords = orderJson?.payment?.paymentRecords || parsedJson?.paymentRecords || [];
      if (Array.isArray(pRecords) && pRecords.length > 0) {
        for (const pr of pRecords) {
          const nominal = Number(pr.nominal || 0);
          if (nominal <= 0) continue;

          const candidateRawDate = pr.tanggal || inv.created_at || new Date().toISOString();
          const candidateWibDate = normalizeToWibCalendarDate(candidateRawDate);
          const candidateSourceId = pr.id ? String(pr.id) : null;
          const candidatePaymentId = pr.paymentId || pr.payment_id || null;
          const candidateDocId = pr.buktiPembayaran?.documentId || pr.document_id || null;
          const candidateMethod = pr.metodePembayaran || pr.metode || "Transfer BCA";
          const candidateBank = pr.namaBank || null;

          // D1-A Mandate: Confirmed backfill requires at least one verifiable stable payment identity:
          // 1) Canonical payment_id, 2) Stable source ID / idempotency identity, or 3) Verified receipt document_id.
          // Candidates lacking all three identities MUST fail closed into ambiguousPayments immediately on first run.
          // Fingerprints of nominal + date must NEVER substitute for verifiable transaction identity.
          if (!candidatePaymentId && !candidateSourceId && !candidateDocId) {
            result.ambiguousPayments.push({
              invoice_no: inv.invoice_no,
              order_no: inv.order_no,
              candidateId: null,
              nominal,
              tanggal: candidateRawDate,
              reason: `Unidentifiable payment match: Candidate lacks canonical payment_id, stable source ID, and receipt document_id. Insertion halted fail-closed to prevent ambiguous financial state.`,
            });
            continue;
          }

          // Stable key generation bound directly to verifiable identity (no nominal/date fingerprint key):
          const key = candidateSourceId
            ? `BACKFILL-${inv.invoice_no}-${candidateSourceId}`
            : candidatePaymentId
            ? `BACKFILL-${inv.invoice_no}-PID-${candidatePaymentId}`
            : `BACKFILL-${inv.invoice_no}-DOC-${candidateDocId}`;

          // Deduplication Rule 1: Canonical payment_id
          if (candidatePaymentId) {
            const paymentIdMatch = existingPayments.find(
              (ep) => ep.payment_id && ep.payment_id === candidatePaymentId
            );
            if (paymentIdMatch) {
              if (
                Number(paymentIdMatch.nominal) === nominal &&
                normalizeToWibCalendarDate(paymentIdMatch.tanggal_bayar) === candidateWibDate
              ) {
                continue;
              } else {
                result.ambiguousPayments.push({
                  invoice_no: inv.invoice_no,
                  order_no: inv.order_no,
                  candidateId: candidateSourceId,
                  nominal,
                  tanggal: candidateRawDate,
                  reason: `Canonical payment_id '${candidatePaymentId}' matches existing record ${paymentIdMatch.id} but attributes conflict: nominal (${nominal} vs ${paymentIdMatch.nominal}) or date (${candidateWibDate} vs ${normalizeToWibCalendarDate(paymentIdMatch.tanggal_bayar)}).`,
                });
                continue;
              }
            }
          }

          // Deduplication Rule 2: Exact idempotency key match or strict token-delimited source ID
          // D1-A Mandate: Confirmed deduplication requires verifiable stable payment identity.
          // Legacy keys must ONLY be constructed when candidateSourceId is present (never with fallback nominal).
          const legacyKeys: string[] = [];
          const candidateDates: string[] = [];
          if (candidateRawDate) candidateDates.push(candidateRawDate);
          if (candidateWibDate && !candidateDates.includes(candidateWibDate)) candidateDates.push(candidateWibDate);
          if (pr.tanggal && !candidateDates.includes(pr.tanggal)) candidateDates.push(pr.tanggal);

          if (candidateSourceId) {
            legacyKeys.push(`BACKFILL-${inv.invoice_no}-${candidateSourceId}-${pr.tanggal || "init"}`);
            if (candidateRawDate) {
              legacyKeys.push(`BACKFILL-${inv.invoice_no}-${candidateSourceId}-${candidateRawDate}`);
            }
            if (candidateWibDate) {
              legacyKeys.push(`BACKFILL-${inv.invoice_no}-${candidateSourceId}-${candidateWibDate}`);
            }
            legacyKeys.push(`BACKFILL-${inv.invoice_no}-${candidateSourceId}-init`);
          }

          let hasAmbiguity = false;
          const matchedExisting: any[] = [];
          for (const ep of existingPayments) {
            const matchRes = matchCandidateIdempotencyKey(
              ep.idempotency_key,
              inv.invoice_no,
              candidateSourceId,
              key,
              legacyKeys,
              candidateDates
            );
            if (matchRes.isAmbiguous) {
              hasAmbiguity = true;
              result.ambiguousPayments.push({
                invoice_no: inv.invoice_no,
                order_no: inv.order_no,
                candidateId: candidateSourceId,
                nominal,
                tanggal: candidateRawDate,
                reason: matchRes.reason || `Ambiguous key matching for candidate '${candidateSourceId}'.`,
              });
            } else if (matchRes.isMatch) {
              matchedExisting.push(ep);
            }
          }

          if (hasAmbiguity) {
            continue; // Fail-closed: ambiguity prevents safe deduplication and safe insertion
          }

          if (matchedExisting.length > 1) {
            result.ambiguousPayments.push({
              invoice_no: inv.invoice_no,
              order_no: inv.order_no,
              candidateId: candidateSourceId,
              nominal,
              tanggal: candidateRawDate,
              reason: `Candidate key/source ID '${candidateSourceId || key}' matched multiple existing payment records (${matchedExisting.length}). Ambiguous identity prevents deduplication.`,
            });
            continue;
          } else if (matchedExisting.length === 1) {
            const matched = matchedExisting[0];
            if (Number(matched.nominal) !== nominal) {
              result.ambiguousPayments.push({
                invoice_no: inv.invoice_no,
                order_no: inv.order_no,
                candidateId: candidateSourceId,
                nominal,
                tanggal: candidateRawDate,
                reason: `Idempotency key matched existing record ${matched.id} but nominal conflicts (${nominal} vs ${matched.nominal}).`,
              });
              continue;
            }
            // Consistent deduplication match!
            continue;
          }

          // Deduplication Rule 3: Receipt / Document ID matching
          if (candidateDocId) {
            const docMatches = existingPayments.filter(
              (ep) => ep.document_id === candidateDocId
            );
            if (docMatches.length > 1) {
              result.ambiguousPayments.push({
                invoice_no: inv.invoice_no,
                order_no: inv.order_no,
                candidateId: candidateSourceId,
                nominal,
                tanggal: candidateRawDate,
                reason: `Document ID '${candidateDocId}' matches multiple existing payment records (${docMatches.length}).`,
              });
              continue;
            } else if (docMatches.length === 1) {
              const matchedEp = docMatches[0];
              if (
                Number(matchedEp.nominal) === nominal &&
                normalizeToWibCalendarDate(matchedEp.tanggal_bayar) === candidateWibDate
              ) {
                continue;
              } else {
                result.ambiguousPayments.push({
                  invoice_no: inv.invoice_no,
                  order_no: inv.order_no,
                  candidateId: candidateSourceId,
                  nominal,
                  tanggal: candidateRawDate,
                  reason: `Document ID '${candidateDocId}' matches existing record ${matchedEp.id} but attributes conflict: nominal (${nominal} vs ${matchedEp.nominal}) or date (${candidateWibDate} vs ${normalizeToWibCalendarDate(matchedEp.tanggal_bayar)}).`,
                });
                continue;
              }
            }
          }

          // Deduplication Rule 4: Ambiguity & Unidentifiable Match Detection
          // Nominal + normalized date alone must NEVER establish identity.
          const sameTupleCandidates = pRecords.filter(
            (otherPr: any) =>
              Number(otherPr.nominal || 0) === nominal &&
              normalizeToWibCalendarDate(otherPr.tanggal || inv.created_at) === candidateWibDate
          );

          // If multiple candidates share identical source attributes without distinct IDs:
          if (sameTupleCandidates.length > 1 && !candidateSourceId) {
            result.ambiguousPayments.push({
              invoice_no: inv.invoice_no,
              order_no: inv.order_no,
              candidateId: candidateSourceId,
              nominal,
              tanggal: candidateRawDate,
              reason: `Ambiguous payment candidate: Multiple candidates (${sameTupleCandidates.length}) share identical nominal Rp ${nominal} on date ${candidateWibDate} without distinct source IDs.`,
            });
            continue;
          }

          // Safe to insert
          insertPaymentStmt.run(
            inv.invoice_no,
            inv.order_no,
            nominal,
            candidateMethod,
            candidateBank,
            pr.noRekening || null,
            candidateRawDate,
            candidateDocId,
            pr.statusVerifikasi || "TERVERIFIKASI",
            key,
            pr.verifiedBy || "System Migration",
            pr.verifiedAt || new Date().toISOString(),
            pr.catatan || "Migrasi historis payment record"
          );
          result.backfilledPayments++;
          existingPayments.push({
            id: null,
            payment_id: candidatePaymentId,
            invoice_no: inv.invoice_no,
            order_no: inv.order_no,
            nominal,
            status_verifikasi: pr.statusVerifikasi || "TERVERIFIKASI",
            idempotency_key: key,
            kas_kantor_id: null,
            tanggal_bayar: candidateRawDate,
            document_id: candidateDocId,
            is_void: 0,
          });
        }
      } else if (Number(inv.dibayar || 0) > 0) {
        // Synthesize single historical payment for existing balance ONLY IF:
        // Invoice genuinely has NO payment records whatsoever in invoice_payments.
        const hasExistingPaymentRecords = existingPayments.length > 0;

        if (!hasExistingPaymentRecords) {
          const nominal = Number(inv.dibayar);
          const key = `BACKFILL-${inv.invoice_no}-INIT`;
          insertPaymentStmt.run(
            inv.invoice_no,
            inv.order_no,
            nominal,
            parsedJson.metodePembayaran || "Transfer Bank",
            parsedJson.bank || null,
            null,
            parsedJson.tanggalBayar || inv.created_at || new Date().toISOString(),
            null,
            "TERVERIFIKASI",
            key,
            "System Migration",
            new Date().toISOString(),
            "Saldo terbayar historis awal"
          );
          result.backfilledPayments++;
        }
      }
    }

    // 3. Backfill kas_kantor relations (order_no, invoice_no)
    const updateKasStmt = targetDb.prepare(`
      UPDATE kas_kantor SET
        order_no = COALESCE(order_no, ?),
        invoice_no = COALESCE(invoice_no, ?)
      WHERE id = ? AND (order_no IS NULL OR invoice_no IS NULL)
    `);

    // 3A: Authoritative structured linking ONLY via invoice_payments.kas_kantor_id
    const paymentKasRows = targetDb.prepare(`
      SELECT id, kas_kantor_id, invoice_no, order_no
      FROM invoice_payments
      WHERE kas_kantor_id IS NOT NULL
    `).all() as { id: number; kas_kantor_id: number; invoice_no: string; order_no: string | null }[];

    // Group payment links by kas_kantor_id to detect conflicting references
    const kasToPayments = new Map<number, Array<{ invoice_no: string; order_no: string | null }>>();
    for (const p of paymentKasRows) {
      if (!p.kas_kantor_id) continue;
      if (!kasToPayments.has(p.kas_kantor_id)) {
        kasToPayments.set(p.kas_kantor_id, []);
      }
      kasToPayments.get(p.kas_kantor_id)!.push({ invoice_no: p.invoice_no, order_no: p.order_no });
    }

    const linkedKasIds = new Set<number>();
    for (const [kasId, payments] of kasToPayments.entries()) {
      const uniqueInvoices = new Set(payments.map((p) => p.invoice_no));
      const uniqueOrders = new Set(payments.map((p) => p.order_no).filter(Boolean));
      if (uniqueInvoices.size > 1 || uniqueOrders.size > 1) {
        result.kasKantorStats.ambiguous++;
        continue;
      }
      const p = payments[0];
      const res = updateKasStmt.run(p.order_no, p.invoice_no, kasId);
      if (res.changes > 0) {
        result.kasKantorStats.mapped++;
      }
      linkedKasIds.add(kasId);
    }

    // 3B: Unlinked kas_kantor records: Description/regex-only linking is strictly removed.
    // Records without structured link remain unlinked and are reported in telemetry stats.
    const remainingKasRows = targetDb.prepare("SELECT id, keterangan, order_no, invoice_no FROM kas_kantor WHERE order_no IS NULL OR invoice_no IS NULL").all() as any[];
    for (const row of remainingKasRows) {
      if (linkedKasIds.has(row.id)) continue;

      const text = row.keterangan || "";
      const invMatches: string[] = Array.from(new Set(text.match(/\bINV-[A-Za-z0-9_-]+\b/g) || []));
      const rawOrdMatches: string[] = Array.from(new Set(text.match(/\bORD-[0-9]+\b/g) || []));
      const ordMatches: string[] = rawOrdMatches.filter((ord: string) => !invMatches.some((inv: string) => inv.includes(ord)));

      if (invMatches.length > 1 || ordMatches.length > 1 || (invMatches.length === 1 && ordMatches.length === 1 && knownInvoices.get(invMatches[0]) !== ordMatches[0])) {
        result.kasKantorStats.ambiguous++;
      } else if (invMatches.length > 0 || ordMatches.length > 0) {
        result.kasKantorStats.unmatched++;
      } else {
        result.kasKantorStats.remainingEmpty++;
      }
    }

    // 4. Backfill pengeluaran relations (order_no, invoice_no)
    const updatePengeluaranStmt = targetDb.prepare(`
      UPDATE pengeluaran SET
        order_no = COALESCE(order_no, ?),
        invoice_no = COALESCE(invoice_no, ?)
      WHERE id = ? AND (order_no IS NULL OR invoice_no IS NULL)
    `);

    // 4A: Authoritative structured linking ONLY through messenger_reimbursements FK
    const reimbRows = targetDb.prepare(`
      SELECT p.id as pengeluaran_id, r.order_no
      FROM pengeluaran p
      JOIN messenger_reimbursements r ON p.reimbursement_id = r.id
      WHERE (p.order_no IS NULL OR p.invoice_no IS NULL) AND r.order_no IS NOT NULL
    `).all() as { pengeluaran_id: number; order_no: string }[];

    const linkedPengeluaranIds = new Set<number>();
    for (const r of reimbRows) {
      if (!r.order_no || !knownOrders.has(r.order_no)) continue;
      let matchingInv: string | null = null;
      for (const [invNo, ordNo] of knownInvoices.entries()) {
        if (ordNo === r.order_no) {
          matchingInv = invNo;
          break;
        }
      }
      const res = updatePengeluaranStmt.run(r.order_no, matchingInv, r.pengeluaran_id);
      if (res.changes > 0) {
        result.pengeluaranStats.mapped++;
      }
      linkedPengeluaranIds.add(r.pengeluaran_id);
    }

    // 4B: Unlinked pengeluaran records: Description/regex-only linking is strictly removed.
    // Records without structured link remain unlinked and are reported in telemetry stats.
    const remainingPengeluaranRows = targetDb.prepare("SELECT id, keterangan, order_no, invoice_no FROM pengeluaran WHERE order_no IS NULL OR invoice_no IS NULL").all() as any[];
    for (const row of remainingPengeluaranRows) {
      if (linkedPengeluaranIds.has(row.id)) continue;

      const text = row.keterangan || "";
      const invMatches: string[] = Array.from(new Set(text.match(/\bINV-[A-Za-z0-9_-]+\b/g) || []));
      const rawOrdMatches: string[] = Array.from(new Set(text.match(/\bORD-[0-9]+\b/g) || []));
      const ordMatches: string[] = rawOrdMatches.filter((ord: string) => !invMatches.some((inv: string) => inv.includes(ord)));

      if (invMatches.length > 1 || ordMatches.length > 1 || (invMatches.length === 1 && ordMatches.length === 1 && knownInvoices.get(invMatches[0]) !== ordMatches[0])) {
        result.pengeluaranStats.ambiguous++;
      } else if (invMatches.length > 0 || ordMatches.length > 0) {
        result.pengeluaranStats.unmatched++;
      } else {
        result.pengeluaranStats.remainingEmpty++;
      }
    }

    if (
      result.backfilledInvoices > 0 ||
      result.backfilledPayments > 0 ||
      result.ambiguousPayments.length > 0 ||
      result.kasKantorStats.mapped > 0 ||
      result.pengeluaranStats.mapped > 0
    ) {
      console.log(
        `[SUN89 Migration] Backfill completed: ` +
        `${result.backfilledInvoices} invoices, ${result.backfilledPayments} payments, ` +
        `ambiguousPayments=${result.ambiguousPayments.length}, ` +
        `KasKantor[mapped=${result.kasKantorStats.mapped}, unmatched=${result.kasKantorStats.unmatched}, ambig=${result.kasKantorStats.ambiguous}, empty=${result.kasKantorStats.remainingEmpty}], ` +
        `Pengeluaran[mapped=${result.pengeluaranStats.mapped}, unmatched=${result.pengeluaranStats.unmatched}, ambig=${result.pengeluaranStats.ambiguous}, empty=${result.pengeluaranStats.remainingEmpty}]`
      );
    }
    return result;
  }, targetDb);
}
