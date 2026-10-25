/**
 * Safe Transactional Purge Script: Total Clean Slate
 * Admin SUN89 — Biro Jasa Management System
 * Run via: npx tsx scripts/purge_sales_transactions.ts
 */

import { db } from "../server/src/database/db";

// Ensure foreign keys do not block deletion
db.exec("PRAGMA foreign_keys = OFF;");

const tablesToInspect = [
  "orders",
  "finance_invoices",
  "invoice_payments",
  "kas_kantor",
  "pengeluaran",
  "kas_messenger",
  "messenger_reimbursements",
  "messenger_tasks",
  "documents",
  "document_tickets",
  "idempotency_keys",
  "notification_logs",
  "audit_logs",
  "users",
  "role_permissions",
  "payment_methods",
  "estimation_templates",
  "samsat_pricing",
  "wilayah_administratif",
  "samsat_offices",
  "service_pricing_configs",
];

function tableExists(name: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?;").get(name);
  return Boolean(row);
}

function deleteIfTableExists(tableName: string, whereClause = ""): number {
  if (!tableExists(tableName)) {
    console.log(`- [INFO] Table '${tableName}' does not exist (virtual / in-memory entity) — skipped.`);
    return 0;
  }
  const query = whereClause ? `DELETE FROM ${tableName} WHERE ${whereClause};` : `DELETE FROM ${tableName};`;
  const res = db.prepare(query).run();
  console.log(`- [PURGE] Deleted from ${tableName}${whereClause ? ` WHERE ${whereClause}` : ""}: ${res.changes} rows`);
  return res.changes;
}

console.log("=== PRE-PURGE TABLE COUNTS ===");
for (const tbl of tablesToInspect) {
  if (tableExists(tbl)) {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tbl};`).get() as { count: number };
    console.log(`  ${tbl.padEnd(26)}: ${row.count}`);
  } else {
    console.log(`  ${tbl.padEnd(26)}: [Table not in DB]`);
  }
}

console.log("\nExecuting Transactional Purge...");

db.exec("BEGIN TRANSACTION;");
try {
  // 1. Hapus transaksi keuangan dan pembayaran
  deleteIfTableExists("invoice_payments");
  deleteIfTableExists("finance_invoices");

  // 2. Hapus logistik dan tugas kurir
  deleteIfTableExists("messenger_tasks");
  deleteIfTableExists("messenger_reimbursements");
  deleteIfTableExists("kas_messenger");

  // 3. Hapus dokumen transaksi dan tiket
  deleteIfTableExists("document_tickets");
  deleteIfTableExists("documents", "order_no IS NOT NULL OR invoice_id IS NOT NULL");

  // 4. Hapus mutasi kas dan pengeluaran terkait order
  deleteIfTableExists("kas_kantor", "order_no IS NOT NULL OR invoice_no IS NOT NULL");
  deleteIfTableExists("pengeluaran", "order_no IS NOT NULL OR invoice_no IS NOT NULL");

  // 5. Hapus kunci idempotensi dan notifikasi transaksi
  deleteIfTableExists("idempotency_keys");
  deleteIfTableExists("notifications", "reference_no IS NOT NULL");
  deleteIfTableExists("notification_logs", "reference_no IS NOT NULL");

  // 6. Hapus seluruh data order
  deleteIfTableExists("orders");

  // 7. Reset auto-increment sequence untuk tabel transaksi
  try {
    const resSeq = db.prepare(`
      DELETE FROM sqlite_sequence WHERE name IN (
        'orders', 'finance_invoices', 'invoice_payments', 
        'messenger_tasks', 'messenger_reimbursements', 
        'kas_messenger', 'documents', 'idempotency_keys'
      );
    `).run();
    console.log(`- [PURGE] Reset sqlite_sequence entries: ${resSeq.changes}`);
  } catch (err: any) {
    console.log(`- [INFO] sqlite_sequence notice: ${err.message}`);
  }

  db.exec("COMMIT;");
  console.log(">> Transaction successfully COMMITTED.");
} catch (err) {
  db.exec("ROLLBACK;");
  console.error(">> Transaction ROLLED BACK due to error:", err);
  process.exit(1);
}

db.exec("PRAGMA foreign_keys = ON;");

console.log("\n=== POST-PURGE TABLE COUNTS ===");
for (const tbl of tablesToInspect) {
  if (tableExists(tbl)) {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tbl};`).get() as { count: number };
    console.log(`  ${tbl.padEnd(26)}: ${row.count}`);
  } else {
    console.log(`  ${tbl.padEnd(26)}: [Table not in DB]`);
  }
}

// PRAGMA integrity_check
const integrity = db.prepare("PRAGMA integrity_check;").all() as any[];
console.log("\nPRAGMA integrity_check:", integrity[0]?.integrity_check || integrity);

console.log("\n[SUCCESS] Total Clean Slate purge completed successfully.");
