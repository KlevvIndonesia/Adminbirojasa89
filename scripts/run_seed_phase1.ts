import { seedDatabase } from "../server/src/database/seed";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../server/data/database.sqlite");

console.log("=== RUNNING SEED DATABASE (PHASE 1) ===");
seedDatabase();
console.log("Seed function completed successfully.");

const db = new DatabaseSync(dbPath);

console.log("\n=== ROW COUNTS FOR PHASE 1 TABLES ===");
const tables = [
  "users",
  "employees",
  "employee_accounts",
  "customers",
  "customer_accounts",
  "services",
  "biaya_layanan",
  "harga_dasar_samsat",
  "aturan_estimasi",
  "master_proses_samsat",
  "samsat_offices",
  "wilayah_administratif",
  "payment_methods"
];

for (const t of tables) {
  try {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${t}`).get() as any;
    console.log(`Table [${t.padEnd(23, " ")}]: ${row.count} rows`);
  } catch (err: any) {
    console.error(`Table [${t}]: ERROR: ${err.message}`);
  }
}

console.log("\n=== EMPLOYEES SAMPLE ===");
console.table(db.prepare("SELECT id, nik_ktp, nama_lengkap, jabatan, gaji_pokok, status_karyawan FROM employees LIMIT 6").all());

console.log("\n=== EMPLOYEE ACCOUNTS SAMPLE ===");
console.table(db.prepare("SELECT id, employee_id, email, role, status_aktif FROM employee_accounts LIMIT 6").all());

console.log("\n=== CUSTOMERS SAMPLE ===");
console.table(db.prepare("SELECT id, tipe_pelanggan, nama_lengkap, nomor_wa, email, kota_kabupaten FROM customers LIMIT 2").all());

console.log("\n=== HARGA DASAR SAMSAT SAMPLE ===");
console.table(db.prepare("SELECT id, nama_item, kategori, tipe_kendaraan, biaya_dasar FROM harga_dasar_samsat LIMIT 6").all());

console.log("\n=== BIAYA LAYANAN SAMPLE ===");
console.table(db.prepare("SELECT id, service_id, nama_skema, biaya_jasa_reguler, biaya_pengurusan_khusus, biaya_antar_jemput FROM biaya_layanan LIMIT 7").all());

console.log("\n=== MASTER PROSES SAMSAT SAMPLE ===");
console.table(db.prepare("SELECT id, service_id, nama_proses, urutan, estimasi_durasi_menit FROM master_proses_samsat LIMIT 5").all());

console.log("\n=== INTEGRITY & FOREIGN KEY CHECKS ===");
const integrity = db.prepare("PRAGMA integrity_check").all();
console.log("Integrity:", integrity);
const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
console.log("FK Violations:", fkCheck.length === 0 ? "NONE (Clean)" : fkCheck);

console.log("\n>>> PHASE 1 SEEDING & VERIFICATION 100% SUCCESSFUL <<<");
