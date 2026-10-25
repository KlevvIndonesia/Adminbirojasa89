import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../server/data/database.sqlite");

console.log("=== APPLYING ORDER_DOCUMENTS TABLE & INDEXES ===");
const db = new DatabaseSync(dbPath);

db.exec(`
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
`);

console.log("=== TABLE INFO: order_documents ===");
const columns = db.prepare("PRAGMA table_info(order_documents)").all();
console.table(columns);

console.log("=== INDEX LIST: order_documents ===");
const indexes = db.prepare("PRAGMA index_list(order_documents)").all();
console.table(indexes);

console.log("=== INTEGRITY CHECK ===");
const integrity = db.prepare("PRAGMA integrity_check").all();
console.log(integrity);

console.log("=== FOREIGN KEY CHECK ===");
const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
console.log(fkCheck.length === 0 ? "FK check: CLEAN (0 violations)" : fkCheck);
