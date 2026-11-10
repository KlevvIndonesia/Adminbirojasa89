/**
 * Database Seeder
 * Admin SUN89 — Biro Jasa Management System
 */

import { db, runInTransaction } from "./db";
import { hashPassword } from "../utils/crypto";
import crypto from "crypto";

/**
 * Resolves a bootstrap credential from environment variables.
 * In production mode, if the environment variable is not supplied,
 * a cryptographically secure random password is generated and logged once.
 * In non-production (dev/test), falls back to default test credentials.
 */
function resolveBootstrapCredential(envVar: string, devFallback: string): string {
  if (process.env[envVar]) {
    return process.env[envVar]!;
  }
  if (process.env.NODE_ENV === "production") {
    const generated = crypto.randomBytes(16).toString("base64url");
    console.warn(`[SECURITY WARNING] Initial bootstrap credential generated for ${envVar}: ${generated}`);
    console.warn(`[SECURITY WARNING] Record this initial credential immediately. It will only be shown once during bootstrap.`);
    return generated;
  }
  return devFallback;
}
import { pricingStore } from "../../../src/app/data/pricingStore";
import {
  DEFAULT_R4_ANNUAL_TEMPLATE,
  DEFAULT_R2_ANNUAL_TEMPLATE,
  DEFAULT_R4_5YEAR_TEMPLATE,
  DEFAULT_R2_5YEAR_TEMPLATE,
  DEFAULT_R4_BBN_TEMPLATE,
  DEFAULT_R2_BBN_TEMPLATE,
  DEFAULT_R4_MUTASI_AS_TEMPLATE,
  DEFAULT_R2_MUTASI_AS_TEMPLATE,
  DEFAULT_R4_MUTASI_LD_TEMPLATE,
  DEFAULT_R2_MUTASI_LD_TEMPLATE,
} from "../../../src/domain/estimation/defaultTemplates";
import { sanitizeEstimationTemplate } from "../../../src/app/data/estimationStore";
import { WILAYAH_ADMINISTRATIF_LIST, SAMSAT_OFFICES_514 } from "./wilayahData";
import { CANONICAL_PERMISSIONS } from "../config/defaultPermissions";
import { CANONICAL_SERVICES } from "./schema";

export function seedDatabase(): void {
  // 1. Seed Users if table is empty
  const userCountStmt = db.prepare("SELECT COUNT(*) as count FROM users");
  const userCount = (userCountStmt.get() as { count: number }).count;

  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, password_salt, nama, jabatan, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const defaultAdminPass = resolveBootstrapCredential("INITIAL_ADMIN_PASSWORD", "admin123");
    const defaultFinancePass = resolveBootstrapCredential("INITIAL_FINANCE_PASSWORD", "finance123");
    const defaultMessengerPass = resolveBootstrapCredential("INITIAL_MESSENGER_PASSWORD", "messenger123");

    const usersToSeed = [
      {
        email: process.env.INITIAL_SVP_EMAIL || "svp@birojasa.com",
        password: defaultAdminPass,
        nama: "Admin Super (SVP)",
        jabatan: "SVP",
        status: "Aktif",
      },
      {
        email: process.env.INITIAL_ADMIN_EMAIL || "admin@birojasa.com",
        password: defaultAdminPass,
        nama: "Adrian Adhari",
        jabatan: "ADMIN",
        status: "Aktif",
      },
      {
        email: process.env.INITIAL_FINANCE_EMAIL || "finance@birojasa.com",
        password: defaultFinancePass,
        nama: "Finance User",
        jabatan: "FINANCE",
        status: "Aktif",
      },
      {
        email: process.env.INITIAL_MESSENGER1_EMAIL || "budi.messenger@birojasa.com",
        password: defaultMessengerPass,
        nama: "Budi Santoso",
        jabatan: "MESSENGER",
        status: "Aktif",
      },
      {
        email: process.env.INITIAL_MESSENGER2_EMAIL || "andi.messenger@birojasa.com",
        password: defaultMessengerPass,
        nama: "Andi Pratama",
        jabatan: "MESSENGER",
        status: "Aktif",
      },
      {
        email: process.env.INITIAL_MESSENGER_EMAIL || "messenger@birojasa.com",
        password: defaultMessengerPass,
        nama: "Budi Santoso",
        jabatan: "MESSENGER",
        status: "Aktif",
      },
    ];

    for (const u of usersToSeed) {
      const { hash, salt } = hashPassword(u.password);
      insertUser.run(u.email, hash, salt, u.nama, u.jabatan, u.status);
    }
  }

  // 2. Orders: Start completely clean with 0 dummy orders
  // The system initiates with an empty operational order book as requested.

  // 3. Seed Samsat Pricing if table is empty
  const pricingCountStmt = db.prepare("SELECT COUNT(*) as count FROM samsat_pricing");
  const pricingCount = (pricingCountStmt.get() as { count: number }).count;

  if (pricingCount === 0) {
    const samsatItems = pricingStore.getSamsatItems();
    if (Array.isArray(samsatItems) && samsatItems.length > 0) {
      const insertPricing = db.prepare(`
        INSERT INTO samsat_pricing (id, nama_item, kategori, tipe_kendaraan, biaya_dasar, deskripsi, is_active, is_configured, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of samsatItems) {
        const basePrice = Math.max(0, Math.round(Number(item.basePrice ?? item.biayaDasar ?? 0)));
        const isActive = item.active !== false ? 1 : 0;
        const isConfigured = (item.basePrice !== undefined && item.basePrice !== null) || item.biayaDasar !== undefined ? 1 : 0;
        insertPricing.run(
          item.id,
          item.name || item.namaItem || "Item Samsat",
          item.category || item.kategori || "Layanan Standar",
          "Mobil",
          basePrice,
          item.description || item.deskripsi || "",
          isActive,
          isConfigured,
          JSON.stringify(item)
        );
      }
    }
  }

  // 4. Seed Estimation Templates if table is empty, or migrate existing templates
  const estimationCountStmt = db.prepare("SELECT COUNT(*) as count FROM estimation_templates");
  const estimationCount = (estimationCountStmt.get() as { count: number }).count;

  if (estimationCount === 0) {
    const templatesToSeed = [
      DEFAULT_R4_ANNUAL_TEMPLATE,
      DEFAULT_R2_ANNUAL_TEMPLATE,
      DEFAULT_R4_5YEAR_TEMPLATE,
      DEFAULT_R2_5YEAR_TEMPLATE,
      DEFAULT_R4_BBN_TEMPLATE,
      DEFAULT_R2_BBN_TEMPLATE,
      DEFAULT_R4_MUTASI_AS_TEMPLATE,
      DEFAULT_R2_MUTASI_AS_TEMPLATE,
      DEFAULT_R4_MUTASI_LD_TEMPLATE,
      DEFAULT_R2_MUTASI_LD_TEMPLATE,
    ].map(sanitizeEstimationTemplate);

    const insertTemplate = db.prepare(`
      INSERT INTO estimation_templates (id, name, service_type, tipe_kendaraan, koefisien_denda, data_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    for (const tpl of templatesToSeed) {
      insertTemplate.run(
        tpl.id,
        tpl.name,
        tpl.serviceType,
        tpl.vehicleType,
        tpl.koefisienDenda,
        JSON.stringify(tpl)
      );
    }
  } else {
    // Auto-migrate existing templates in SQLite to remove any legacy Excel cell references safely
    try {
      const selectStmt = db.prepare("SELECT id, data_json FROM estimation_templates");
      const rows = selectStmt.all() as { id: string; data_json: string }[];
      const updateStmt = db.prepare("UPDATE estimation_templates SET data_json = ?, updated_at = datetime('now') WHERE id = ?");

      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.data_json);
          const sanitized = sanitizeEstimationTemplate(parsed);
          const cleanJson = JSON.stringify(sanitized);
          if (cleanJson !== row.data_json) {
            updateStmt.run(cleanJson, row.id);
          }
        } catch {
          // ignore individual parse errors
        }
      }
    } catch {
      // non-fatal
    }
  }

  // 5. Seed Finance Invoices linked directly to Orders
  const invoiceCountStmt = db.prepare("SELECT COUNT(*) as count FROM finance_invoices");
  const invoiceCount = (invoiceCountStmt.get() as { count: number }).count;

  if (invoiceCount === 0) {
    const ordersStmt = db.prepare("SELECT data_json FROM orders");
    const orderRows = ordersStmt.all() as { data_json: string }[];
    const insertInvoice = db.prepare(`
      INSERT INTO finance_invoices (invoice_no, order_no, customer, layanan, status, total_tagihan, dibayar, sisa, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let invIdx = 1;
    for (const row of orderRows) {
      const ord = JSON.parse(row.data_json);
      const invNo = ord.payment?.invoiceNo || `INV-${ord.orderNo}`;
      const total = ord.payment?.totalBiaya || 1500000;
      const dibayar = ord.payment?.dibayar || (ord.payment?.statusPembayaran === "Lunas" ? total : 0);
      const sisa = Math.max(0, total - dibayar);
      const status = sisa === 0 ? "PAID" : "UNPAID";

      const invoiceRecord = {
        id: invIdx++,
        invoiceNo: invNo,
        orderNo: ord.orderNo,
        customer: ord.customer,
        layanan: ord.layanan,
        nopol: ord.nopol,
        status,
        totalTagihan: total,
        dibayar,
        sisa,
        jatuhTempo: "2026-10-15",
        tanggalInvoice: ord.createdAt || "2026-10-01",
      };

      insertInvoice.run(
        invNo,
        ord.orderNo,
        ord.customer,
        ord.layanan,
        status,
        total,
        dibayar,
        sisa,
        JSON.stringify(invoiceRecord)
      );
    }
  }

  // 5. Kas Kantor: Starts clean with 0 dummy records (Realized from confirmed transactions)
  // 6. Pengeluaran: Starts clean with 0 dummy records (Recorded from actual expenses)

  // 7. Seed Wilayah Administratif (514 Kabupaten/Kota di 38 Provinsi) if empty
  const wilayahCountStmt = db.prepare("SELECT COUNT(*) as count FROM wilayah_administratif");
  const wilayahCount = (wilayahCountStmt.get() as { count: number }).count;

  if (wilayahCount === 0) {
    const insertWilayah = db.prepare(`
      INSERT OR REPLACE INTO wilayah_administratif (
        kode_kabupaten_kota, kode_provinsi, nama_provinsi, nama_kabupaten_kota,
        jenis_wilayah, status_aktif, sumber_referensi, tahun_referensi, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    runInTransaction(() => {
      for (const item of WILAYAH_ADMINISTRATIF_LIST) {
        insertWilayah.run(
          item.kode_kabupaten_kota,
          item.kode_provinsi,
          item.nama_provinsi,
          item.nama_kabupaten_kota,
          item.jenis_wilayah,
          item.status_aktif ? 1 : 0,
          item.sumber_referensi,
          item.tahun_referensi
        );
      }
    });
  }

  // 8. Seed Samsat Offices (514 Samsat linked to Kemendagri codes)
  const samsatOfficeCountStmt = db.prepare("SELECT COUNT(*) as count FROM samsat_offices");
  const samsatOfficeCount = (samsatOfficeCountStmt.get() as { count: number }).count;

  if (samsatOfficeCount < 514) {
    const insertSamsatOffice = db.prepare(`
      INSERT OR REPLACE INTO samsat_offices (
        id, name, wilayah, alamat, kode_kabupaten_kota, is_verified, status_aktif, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    runInTransaction(() => {
      for (const office of SAMSAT_OFFICES_514) {
        insertSamsatOffice.run(
          office.id,
          office.name,
          office.wilayah,
          office.alamat,
          office.kode_kabupaten_kota,
          1,
          1
        );
      }
    });
  }

  // Ensure fallback samsat office placeholder exists for non-mutasi orders
  db.prepare(`
    INSERT OR IGNORE INTO samsat_offices (
      id, name, wilayah, alamat, kode_kabupaten_kota, is_verified, status_aktif, updated_at
    ) VALUES ('-', 'Bukan Layanan Mutasi', 'Nasional', '-', '31.75', 1, 1, datetime('now'))
  `).run();

  // 6. Seed default notification_settings if empty
  const notifCountStmt = db.prepare("SELECT COUNT(*) as count FROM notification_settings");
  const notifCount = (notifCountStmt.get() as { count: number }).count;
  if (notifCount === 0) {
    db.prepare(`
      INSERT INTO notification_settings (id, recipient_emails, notify_tagihan_reminder, notify_tagihan_perubahan, notify_order_update, notify_proses_gagal, updated_by)
      VALUES ('global', ?, 1, 1, 1, 1, 'system')
    `).run(JSON.stringify(["admin@sunbirojasa.com"]));
  }

  // 7. Seed default role_permissions if empty
  const permCountStmt = db.prepare("SELECT COUNT(*) as count FROM role_permissions");
  const permCount = (permCountStmt.get() as { count: number }).count;
  if (permCount === 0) {
    const insertPerm = db.prepare(`
      INSERT INTO role_permissions (role, permissions_json, updated_by)
      VALUES (?, ?, 'system')
    `);
    // Seed manageable roles (admin, finance, messenger)
    const seedRoles = ["admin", "finance", "messenger"];
    for (const roleKey of seedRoles) {
      if (CANONICAL_PERMISSIONS[roleKey]) {
        insertPerm.run(roleKey, JSON.stringify(CANONICAL_PERMISSIONS[roleKey]));
      }
    }
  }

  // 8. Seed default payment_methods if empty
  try {
    const pmCountStmt = db.prepare("SELECT COUNT(*) as count FROM payment_methods");
    const pmCount = (pmCountStmt.get() as { count: number }).count;
    if (pmCount === 0) {
      const insertPm = db.prepare(`
        INSERT INTO payment_methods (id, nama_metode, bank, nama_rekening, nomor_rekening, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      const initialMethods = [
        { id: "pm-bca", nama_metode: "Transfer BCA", bank: "BCA", nama_rekening: "PT Biro Jasa SUN89 Abadi", nomor_rekening: "772-019-2831", status: "Aktif" },
        { id: "pm-bri", nama_metode: "Transfer BRI", bank: "BRI", nama_rekening: "PT Biro Jasa SUN89 Abadi", nomor_rekening: "0123-01-001234-56-7", status: "Aktif" },
        { id: "pm-mandiri", nama_metode: "Transfer Mandiri", bank: "Mandiri", nama_rekening: "PT Biro Jasa SUN89 Abadi", nomor_rekening: "133-00-1928374-1", status: "Aktif" },
        { id: "pm-cash", nama_metode: "Cash", bank: "Tunai", nama_rekening: "", nomor_rekening: "", status: "Aktif" },
        { id: "pm-qris", nama_metode: "QRIS", bank: "QRIS", nama_rekening: "Biro Jasa SUN89", nomor_rekening: "ID936005230001889", status: "Aktif" },
      ];
      for (const m of initialMethods) {
        insertPm.run(m.id, m.nama_metode, m.bank, m.nama_rekening, m.nomor_rekening, m.status);
      }
    }
  } catch (err) {
    console.error("Error seeding payment_methods:", err);
  }

  // 9. Seed canonical services if empty
  try {
    const svcCountStmt = db.prepare("SELECT COUNT(*) as count FROM services");
    const svcCount = (svcCountStmt.get() as { count: number }).count;
    if (svcCount === 0) {
      const insertSvc = db.prepare(`
        INSERT INTO services (
          id, kode_layanan, nama_layanan, kategori, memerlukan_samsat_tujuan, deskripsi, status_aktif, urutan, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);
      for (const svc of CANONICAL_SERVICES) {
        insertSvc.run(
          svc.id,
          svc.kode_layanan,
          svc.nama_layanan,
          svc.kategori,
          svc.memerlukan_samsat_tujuan,
          svc.deskripsi,
          svc.status_aktif,
          svc.urutan
        );
      }
    }
  } catch (err) {
    console.error("Error seeding services in seed.ts:", err);
  }

  // 10. Seed/Migrate Employees & Employee Accounts from users if empty
  try {
    const empCountStmt = db.prepare("SELECT COUNT(*) as count FROM employees");
    const empCount = (empCountStmt.get() as { count: number }).count;
    if (empCount === 0) {
      const usersStmt = db.prepare("SELECT id, email, password_hash, password_salt, nama, jabatan, status FROM users");
      const userRows = usersStmt.all() as any[];

      const insertEmp = db.prepare(`
        INSERT OR IGNORE INTO employees (
          id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan, gaji_pokok, status_karyawan, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const updateUserStmt = db.prepare(`
        UPDATE users SET employee_id = ?, role = ? WHERE id = ?
      `);

      for (const u of userRows) {
        const empId = `EMP-${String(u.id).padStart(4, "0")}`;
        const nik = `317508${String(100000 + u.id)}0001`;
        const phone = `0812${String(80000000 + u.id)}`;
        const gaji = u.jabatan === "SVP" ? 12000000 : u.jabatan === "FINANCE" ? 7500000 : u.jabatan === "MESSENGER" ? 5000000 : 6500000;
        const role = (u.jabatan || "admin").toLowerCase();

        insertEmp.run(
          empId,
          nik,
          u.nama,
          phone,
          "1990-05-12",
          "DKI Jakarta",
          `Jl. Radjiman Widyodiningrat No. ${u.id * 10}, Cakung, Jakarta Timur`,
          u.jabatan || "Staff",
          gaji,
          u.status === "Aktif" ? "TETAP" : "NONAKTIF"
        );

        updateUserStmt.run(empId, role, u.id);
      }
    }
  } catch (err) {
    console.error("Error migrating/seeding employees and accounts:", err);
  }

  // 11. Seed Initial Demo Customers & Accounts if empty
  try {
    const custCountStmt = db.prepare("SELECT COUNT(*) as count FROM customers");
    const custCount = (custCountStmt.get() as { count: number }).count;
    if (custCount === 0) {
      const insertCust = db.prepare(`
        INSERT OR IGNORE INTO customers (
          id, tipe_pelanggan, nama_lengkap, nomor_wa, email,
          provinsi, kota_kabupaten, kecamatan, desa_kelurahan, rt_rw, no_rumah, patokan, detail_alamat, link_google_maps,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      insertCust.run(
        "CUST-0001",
        "PERUSAHAAN_PT",
        "PT Mitra Graha Sentosa",
        "081298765432",
        "procurement@mitragraha.co.id",
        "DKI Jakarta",
        "Kota Adm. Jakarta Timur",
        "Jatinegara",
        "Bidara Cina",
        "004/007",
        "No. 45",
        "Seberang Halte Busway Bidara Cina",
        "Gedung Graha Sentosa Lantai 3, Jl. Otto Iskandardinata",
        "https://maps.google.com/?q=-6.2341,106.8672"
      );

      insertCust.run(
        "CUST-0002",
        "PERORANGAN",
        "Hendrawan Pratama",
        "081311223344",
        "hendrawan.pratama@gmail.com",
        "DKI Jakarta",
        "Kota Adm. Jakarta Selatan",
        "Tebet",
        "Tebet Barat",
        "002/005",
        "No. 18B",
        "Dekat Pintu Barat Tebet Eco Park",
        "Rumah pagar hitam samping warung kopi",
        "https://maps.google.com/?q=-6.2392,106.8524"
      );

      // Seed portal customer account for CUST-0002
      const defaultCustPass = resolveBootstrapCredential("INITIAL_CUSTOMER_PASSWORD", "klien123");
      const { hash: custHash, salt: custSalt } = hashPassword(defaultCustPass);
      db.prepare(`
        INSERT OR IGNORE INTO customer_accounts (
          id, customer_id, email, password_hash, password_salt, status_akun, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'AKTIF', datetime('now'), datetime('now'))
      `).run("ACCT-CUST-0002", "CUST-0002", "hendrawan.pratama@gmail.com", custHash, custSalt);
    }
  } catch (err) {
    console.error("Error seeding customers:", err);
  }

  // 12. Seed Harga Dasar Samsat if empty
  try {
    const hdsCountStmt = db.prepare("SELECT COUNT(*) as count FROM harga_dasar_samsat");
    const hdsCount = (hdsCountStmt.get() as { count: number }).count;
    if (hdsCount === 0) {
      const insertHds = db.prepare(`
        INSERT OR IGNORE INTO harga_dasar_samsat (
          id, nama_item, kategori, tipe_kendaraan, biaya_dasar, deskripsi, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const hdsItems = [
        { id: "PNBP-STNK-R4", nama: "Penerbitan STNK Baru / 5 Tahun R4", kat: "PNBP_STNK", tipe: "R4", biaya: 200000, desc: "PP RI No. 76 Tahun 2020 tentang PNBP Polri" },
        { id: "PNBP-STNK-R2", nama: "Penerbitan STNK Baru / 5 Tahun R2", kat: "PNBP_STNK", tipe: "R2", biaya: 100000, desc: "PP RI No. 76 Tahun 2020 tentang PNBP Polri" },
        { id: "PNBP-TNKB-R4", nama: "Penerbitan Plat Nomor TNKB R4", kat: "PNBP_TNKB", tipe: "R4", biaya: 100000, desc: "PP RI No. 76 Tahun 2020 tentang PNBP Polri" },
        { id: "PNBP-TNKB-R2", nama: "Penerbitan Plat Nomor TNKB R2", kat: "PNBP_TNKB", tipe: "R2", biaya: 60000, desc: "PP RI No. 76 Tahun 2020 tentang PNBP Polri" },
        { id: "PNBP-BPKB-R4", nama: "Penerbitan Buku BPKB Baru / Ganti Pemilik R4", kat: "PNBP_BPKB", tipe: "R4", biaya: 375000, desc: "PP RI No. 76 Tahun 2020 tentang PNBP Polri" },
        { id: "PNBP-BPKB-R2", nama: "Penerbitan Buku BPKB Baru / Ganti Pemilik R2", kat: "PNBP_BPKB", tipe: "R2", biaya: 225000, desc: "PP RI No. 76 Tahun 2020 tentang PNBP Polri" },
        { id: "SWDKLLJ-POKOK-R4", nama: "Sumbangan Wajib Dana Kecelakaan Lalu Lintas Jalan R4", kat: "SWDKLLJ", tipe: "R4", biaya: 143000, desc: "PMK No. 16/PMK.010/2017" },
        { id: "SWDKLLJ-POKOK-R2", nama: "Sumbangan Wajib Dana Kecelakaan Lalu Lintas Jalan R2", kat: "SWDKLLJ", tipe: "R2", biaya: 35000, desc: "PMK No. 16/PMK.010/2017" },
        { id: "SWDKLLJ-DENDA-R4", nama: "Denda Maksimal SWDKLLJ R4", kat: "SWDKLLJ", tipe: "R4", biaya: 100000, desc: "PMK No. 16/PMK.010/2017" },
        { id: "SWDKLLJ-DENDA-R2", nama: "Denda Maksimal SWDKLLJ R2", kat: "SWDKLLJ", tipe: "R2", biaya: 32000, desc: "PMK No. 16/PMK.010/2017" },
        { id: "CEK-FISIK-R4", nama: "Biaya Cek Fisik dan Legalisir Berkas R4", kat: "CEK_FISIK", tipe: "R4", biaya: 25000, desc: "Administrasi cek fisik dan legalisir berkas Samsat" },
        { id: "CEK-FISIK-R2", nama: "Biaya Cek Fisik dan Legalisir Berkas R2", kat: "CEK_FISIK", tipe: "R2", biaya: 10000, desc: "Administrasi cek fisik dan legalisir berkas Samsat" },
      ];

      for (const item of hdsItems) {
        insertHds.run(item.id, item.nama, item.kat, item.tipe, item.biaya, item.desc);
      }
    }
  } catch (err) {
    console.error("Error seeding harga_dasar_samsat:", err);
  }

  // 13. Seed Aturan Estimasi if empty
  try {
    const estRulesCountStmt = db.prepare("SELECT COUNT(*) as count FROM aturan_estimasi");
    const estRulesCount = (estRulesCountStmt.get() as { count: number }).count;
    if (estRulesCount === 0) {
      const insertRule = db.prepare(`
        INSERT OR IGNORE INTO aturan_estimasi (
          id, nama_formula, service_id, koefisien_denda, denda_swdkllj_formula, aturan_pemutihan_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const rules = [
        { id: "EST-PERP-1TH", nama: "Formula Standar PKB 1 Tahun", svc: "svc-perp-1th", koef: 0.48, swd: "SWDKLLJ Pokok + Denda SWDKLLJ jika lewat jatuh tempo" },
        { id: "EST-PERP-5TH", nama: "Formula PKB 5 Tahun & Ganti Plat", svc: "svc-perp-5th", koef: 0.48, swd: "SWDKLLJ Pokok + Denda SWDKLLJ + PNBP STNK & TNKB" },
        { id: "EST-MUT-ASAL", nama: "Formula Mutasi Asal Samsat Satu Daerah", svc: "svc-mut-asal", koef: 0.48, swd: "Pencabutan berkas & fiskal antar-Samsat" },
        { id: "EST-MUT-ANTAR", nama: "Formula Mutasi Antar Daerah / Provinsi", svc: "svc-mut-antar", koef: 0.48, swd: "Fiskal antar-daerah & pendaftaran Samsat tujuan" },
        { id: "EST-BALIK-NAMA", nama: "Formula Bea Balik Nama (BBN-KB)", svc: "svc-balik-nama", koef: 0.48, swd: "BBN-KB II (1% NJKB) + PNBP BPKB & STNK" },
        { id: "EST-TARIK-BERKAS", nama: "Formula Tarik Berkas Arsip", svc: "svc-tarik-berkas", koef: 0.48, swd: "Administrasi penarikan berkas induk" },
        { id: "EST-DUPLIKAT-STNK", nama: "Formula Duplikat STNK Hilang", svc: "svc-duplikat-stnk", koef: 0.48, swd: "Laporan kehilangan & penerbitan duplikat PNBP" },
      ];

      for (const r of rules) {
        insertRule.run(r.id, r.nama, r.svc, r.koef, r.swd, JSON.stringify({ pemutihanAktif: false }));
      }
    }
  } catch (err) {
    console.error("Error seeding aturan_estimasi:", err);
  }

  // 14. Seed Biaya Layanan if empty
  try {
    const blCountStmt = db.prepare("SELECT COUNT(*) as count FROM biaya_layanan");
    const blCount = (blCountStmt.get() as { count: number }).count;
    if (blCount === 0) {
      const insertBl = db.prepare(`
        INSERT OR IGNORE INTO biaya_layanan (
          id, service_id, nama_skema, biaya_jasa_reguler, biaya_pengurusan_khusus,
          biaya_antar_jemput, biaya_antar_saja, biaya_jemput_saja, opsen_pkb_daerah, biaya_lainnya_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const blItems = [
        { id: "BL-PERP-1TH", svc: "svc-perp-1th", nama: "Tarif Standar Perpanjangan 1 Tahun", reg: 150000, exp: 250000, aj: 50000, as: 25000, js: 25000, opsen: 0.66 },
        { id: "BL-PERP-5TH", svc: "svc-perp-5th", nama: "Tarif Standar Perpanjangan 5 Tahun", reg: 300000, exp: 450000, aj: 50000, as: 25000, js: 25000, opsen: 0.66 },
        { id: "BL-MUT-ASAL", svc: "svc-mut-asal", nama: "Tarif Mutasi Asal / Satu Daerah", reg: 500000, exp: 750000, aj: 50000, as: 25000, js: 25000, opsen: 0.66 },
        { id: "BL-MUT-ANTAR", svc: "svc-mut-antar", nama: "Tarif Mutasi Antar Daerah / Keluar", reg: 1000000, exp: 1500000, aj: 100000, as: 50000, js: 50000, opsen: 0.66 },
        { id: "BL-BALIK-NAMA", svc: "svc-balik-nama", nama: "Tarif Bea Balik Nama (BBN)", reg: 500000, exp: 750000, aj: 50000, as: 25000, js: 25000, opsen: 0.66 },
        { id: "BL-TARIK-BERKAS", svc: "svc-tarik-berkas", nama: "Tarif Tarik Berkas Samsat", reg: 350000, exp: 500000, aj: 50000, as: 25000, js: 25000, opsen: 0.66 },
        { id: "BL-DUPLIKAT-STNK", svc: "svc-duplikat-stnk", nama: "Tarif Pengurusan Duplikat STNK", reg: 400000, exp: 600000, aj: 50000, as: 25000, js: 25000, opsen: 0.66 },
      ];

      for (const bl of blItems) {
        insertBl.run(bl.id, bl.svc, bl.nama, bl.reg, bl.exp, bl.aj, bl.as, bl.js, bl.opsen, "{}");
      }
    }
  } catch (err) {
    console.error("Error seeding biaya_layanan:", err);
  }

  // 15. Seed Master Proses Samsat if empty
  try {
    const mpsCountStmt = db.prepare("SELECT COUNT(*) as count FROM master_proses_samsat");
    const mpsCount = (mpsCountStmt.get() as { count: number }).count;
    if (mpsCount === 0) {
      const insertMps = db.prepare(`
        INSERT OR IGNORE INTO master_proses_samsat (
          id, service_id, nama_proses, urutan, estimasi_durasi_menit, deskripsi_klien, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const processes = [
        // Perpanjangan 1 Tahun
        { id: "PRC-P1T-01", svc: "svc-perp-1th", nama: "Cek Kelengkapan Berkas & Validasi Nopol", urutan: 1, durasi: 15, desc: "Pengecekan kelengkapan STNK dan KTP asli pemohon" },
        { id: "PRC-P1T-02", svc: "svc-perp-1th", nama: "Pendaftaran Loket Penetapan Pajak PKB", urutan: 2, durasi: 30, desc: "Penyerahan berkas ke loket pendaftaran dan penetapan pokok PKB" },
        { id: "PRC-P1T-03", svc: "svc-perp-1th", nama: "Pembayaran Kasir Bank Samsat", urutan: 3, durasi: 20, desc: "Realisasi pembayaran PKB dan SWDKLLJ di loket kasir Samsat" },
        { id: "PRC-P1T-04", svc: "svc-perp-1th", nama: "Pencetakan Notice Pajak & Pengesahan STNK", urutan: 4, durasi: 15, desc: "Pencetakan lembar SKKP / Notice Pajak dan stempel pengesahan STNK" },
        { id: "PRC-P1T-05", svc: "svc-perp-1th", nama: "Pengambilan Berkas Selesai", urutan: 5, durasi: 10, desc: "Pengambilan berkas pengesahan di loket serah terima Samsat" },

        // Perpanjangan 5 Tahun
        { id: "PRC-P5T-01", svc: "svc-perp-5th", nama: "Cek Fisik Kendaraan & Gesek Nomor Rangka/Mesin", urutan: 1, durasi: 25, desc: "Pelaksanaan cek fisik kendaraan dan legalisir stiker gesek" },
        { id: "PRC-P5T-02", svc: "svc-perp-5th", nama: "Pendaftaran Loket 5 Tahunan & Penetapan", urutan: 2, durasi: 35, desc: "Pendaftaran berkas 5 tahunan di loket penetapan Samsat" },
        { id: "PRC-P5T-03", svc: "svc-perp-5th", nama: "Pembayaran Kasir Bank Samsat & PNBP", urutan: 3, durasi: 20, desc: "Pembayaran PKB, SWDKLLJ, PNBP STNK, dan PNBP TNKB di kasir" },
        { id: "PRC-P5T-04", svc: "svc-perp-5th", nama: "Pencetakan Lembar STNK Baru & SKKP", urutan: 4, durasi: 25, desc: "Penerbitan dan pencetakan buku lembar STNK baru 5 tahunan" },
        { id: "PRC-P5T-05", svc: "svc-perp-5th", nama: "Pencetakan Plat Nomor TNKB Baru di Workshop", urutan: 5, durasi: 30, desc: "Pencetakan sepasang plat nomor TNKB baru di workshop Samsat" },
        { id: "PRC-P5T-06", svc: "svc-perp-5th", nama: "Serah Terima Berkas & Plat Nomor Selesai", urutan: 6, durasi: 10, desc: "Pemeriksaan akhir dan penyerahan STNK baru beserta plat nomor" },

        // Mutasi Keluar / Antar Daerah
        { id: "PRC-MUT-01", svc: "svc-mut-antar", nama: "Cek Fisik Bantuan & Pengambilan Arsip Induk", urutan: 1, durasi: 40, desc: "Penggesekan nomor mesin/rangka dan pencabutan berkas arsip induk" },
        { id: "PRC-MUT-02", svc: "svc-mut-antar", nama: "Pendaftaran Loket Mutasi Keluar / Cabut Berkas", urutan: 2, durasi: 45, desc: "Pendaftaran mutasi keluar dan verifikasi surat jalan" },
        { id: "PRC-MUT-03", svc: "svc-mut-antar", nama: "Penerbitan Surat Keterangan Fiskal Antar Daerah", urutan: 3, durasi: 30, desc: "Penerbitan lembar fiskal pelunasan pajak daerah" },
        { id: "PRC-MUT-04", svc: "svc-mut-antar", nama: "Penerbitan Surat Pengantar Mutasi Polda / Samsat Tujuan", urutan: 4, durasi: 30, desc: "Penyerahan amplop bersegel berkas mutasi keluar untuk Samsat tujuan" },
      ];

      for (const p of processes) {
        insertMps.run(p.id, p.svc, p.nama, p.urutan, p.durasi, p.desc);
      }
    }
  } catch (err) {
    console.error("Error seeding master_proses_samsat:", err);
  }

  // 16. Seed Messengers if empty (linking to EMP-0004 & EMP-0005)
  try {
    const msgCountStmt = db.prepare("SELECT COUNT(*) as count FROM messengers");
    const msgCount = (msgCountStmt.get() as { count: number }).count;
    if (msgCount === 0) {
      const insertMsg = db.prepare(`
        INSERT OR IGNORE INTO messengers (
          id, employee_id, plat_motor_operasional, wilayah_tugas_utama, status_tugas, created_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `);

      insertMsg.run("MSG-0001", "EMP-0004", "B 3456 TAA", "Jakarta Timur & Bekasi", "STANDBY");
      insertMsg.run("MSG-0002", "EMP-0005", "B 6789 TBB", "Jakarta Selatan & Depok", "STANDBY");
    }
  } catch (err) {
    console.error("Error seeding messengers:", err);
  }

  // 17. Kas Kantor Opening Balance Policy (Pre-Reset Hardened):
  // Opening balance is NEVER seeded automatically with implicit historical values (Rp 15.000.000).
  // Any opening balance must be established via an explicit, authorized transaction (MODAL_AWAL)
  // or official reset opening record as approved by the Owner.
}
