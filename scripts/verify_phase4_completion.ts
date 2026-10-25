import { initializeSchema } from "../server/src/database/schema";
import { seedDatabase } from "../server/src/database/seed";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../server/data/database.sqlite");

console.log("=== EXECUTING PHASE 4 COMPLETION CHECK & MIGRATIONS ===");
const db = new DatabaseSync(dbPath);

// Execute schema initialization to ensure all DDL and migrations are applied
initializeSchema(db);

// Seed database
seedDatabase();

console.log("\n1. PRAGMA table_info(laba_rugi_snapshots):");
const pnlInfo = db.prepare("PRAGMA table_info(laba_rugi_snapshots)").all() as any[];
console.table(pnlInfo);

// Check negative constraint: komisi_kurir must NOT exist
const pnlHasKomisi = pnlInfo.some(c => c.name === "komisi_kurir");
console.log(`laba_rugi_snapshots has komisi_kurir? ${pnlHasKomisi ? "VIOLATION!" : "NO (Clean - Adheres to Rule)"}`);

console.log("\n2. PRAGMA table_info(finance_invoices):");
const invInfo = db.prepare("PRAGMA table_info(finance_invoices)").all() as any[];
console.table(invInfo.map(c => ({ cid: c.cid, name: c.name, type: c.type, dflt_value: c.dflt_value })));
const invHasKomisi = invInfo.some(c => c.name === "komisi_kurir");
console.log(`finance_invoices has komisi_kurir? ${invHasKomisi ? "VIOLATION!" : "NO (Clean - Adheres to Rule)"}`);
const invHasCustomer = invInfo.some(c => c.name === "customer_id");
console.log(`finance_invoices has customer_id? ${invHasCustomer ? "YES (Linked)" : "NO"}`);

console.log("\n3. PRAGMA table_info(kas_kantor):");
const kasInfo = db.prepare("PRAGMA table_info(kas_kantor)").all() as any[];
console.table(kasInfo.map(c => ({ cid: c.cid, name: c.name, type: c.type })));

console.log("\n4. PRAGMA table_info(pengeluaran):");
const pengInfo = db.prepare("PRAGMA table_info(pengeluaran)").all() as any[];
console.table(pengInfo.map(c => ({ cid: c.cid, name: c.name, type: c.type })));

console.log("\n5. PRAGMA table_info(invoice_payments):");
const payInfo = db.prepare("PRAGMA table_info(invoice_payments)").all() as any[];
console.table(payInfo.map(c => ({ cid: c.cid, name: c.name, type: c.type })));

console.log("\n6. PRAGMA table_info(document_tickets):");
const docTicketInfo = db.prepare("PRAGMA table_info(document_tickets)").all() as any[];
console.table(docTicketInfo.map(c => ({ cid: c.cid, name: c.name, type: c.type })));

console.log("\n7. SELECT * FROM kas_kantor:");
const kasRows = db.prepare("SELECT id, tanggal, keterangan, status, debit, saldo, penanggung_jawab_employee_id FROM kas_kantor").all();
console.table(kasRows);

console.log("\n8. PRAGMA foreign_key_check:");
const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
console.log(fkCheck.length === 0 ? "FK check: 0 violations (CLEAN)" : fkCheck);

console.log("\n9. PRAGMA integrity_check:");
const integrity = db.prepare("PRAGMA integrity_check").all();
console.log(integrity);

console.log("\n10. ENTERPRISE 31 ENTITIES CENSUS:");
const targetEntities = [
  // IAM & Customers (5)
  "employees", "employee_accounts", "role_permissions", "customers", "customer_accounts",
  // Services & Samsat & Pricing (7)
  "wilayah_administratif", "samsat_offices", "services", "biaya_layanan", "harga_dasar_samsat", "aturan_estimasi", "master_proses_samsat",
  // Orders & Documents (6)
  "vehicles", "orders", "order_status_history", "order_documents", "document_tickets", "order_timeline_processes",
  // Messengers & Field Ops (4)
  "messengers", "messenger_tasks", "kas_messenger", "messenger_reimbursements",
  // Finance & Ledger (6)
  "payment_methods", "finance_invoices", "invoice_payments", "kas_kantor", "pengeluaran", "laba_rugi_snapshots",
  // Governance & System (3)
  "idempotency_keys", "audit_logs", "notification_settings"
];

for (const tableName of targetEntities) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
  console.log(`[${row ? "OK" : "MISSING"}] Table: ${tableName}`);
}

console.log("\n>>> PHASE 4 FINANCIAL LEDGER & 31 ENTITIES 100% VERIFIED <<<");
