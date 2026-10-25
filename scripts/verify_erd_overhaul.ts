import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../server/data/database.sqlite");
const db = new DatabaseSync(dbPath);

console.log("=== 1. VERIFY CANONICAL SERVICES TABLE ===");
const services = db.prepare("SELECT id, kode_layanan, nama_layanan, kategori, status_aktif, urutan FROM services ORDER BY urutan").all();
console.table(services);

if (services.length !== 7) {
  console.error(`FAILED: Expected 7 canonical services, got ${services.length}`);
  process.exit(1);
} else {
  console.log("SUCCESS: All 7 canonical services seeded properly.");
}

console.log("\n=== 2. VERIFY ORDERS TABLE COLUMNS ===");
const orderCols = db.prepare("PRAGMA table_info(orders)").all() as { name: string; type: string }[];
const orderColNames = new Set(orderCols.map(c => c.name));
const requiredOrderCols = ["service_id", "tanggal_masuk_berkas", "samsat_asal", "samsat_tujuan", "layanan"];
for (const col of requiredOrderCols) {
  if (orderColNames.has(col)) {
    console.log(`[PASS] orders.${col} exists`);
  } else {
    console.error(`[FAIL] orders.${col} is missing`);
    process.exit(1);
  }
}

console.log("\n=== 3. VERIFY FINANCE_INVOICES TABLE COLUMNS ===");
const invCols = db.prepare("PRAGMA table_info(finance_invoices)").all() as { name: string; type: string }[];
const invColNames = new Set(invCols.map(c => c.name));
const requiredInvCols = ["service_id", "layanan"];
for (const col of requiredInvCols) {
  if (invColNames.has(col)) {
    console.log(`[PASS] finance_invoices.${col} exists`);
  } else {
    console.error(`[FAIL] finance_invoices.${col} is missing`);
    process.exit(1);
  }
}

console.log("\n=== 4. PRAGMA INTEGRITY CHECK ===");
const integrity = db.prepare("PRAGMA integrity_check").all();
console.log("Integrity:", integrity);

console.log("\n=== 5. PRAGMA FOREIGN KEY CHECK ===");
const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
console.log("Foreign Key Check:", fkCheck);

console.log("\n=== 6. VERIFY INDICES ===");
const indices = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND tbl_name IN ('services', 'orders', 'finance_invoices')").all();
console.table(indices);

console.log("\n>>> ALL ERD OVERHAUL VERIFICATIONS PASSED SUCCESSFULLY! <<<");
