/**
 * Transaction Reset & Disaster Recovery Pre-Reset Service
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Strict Production Hardening Guards:
 * - Read-only protection against operational DB unless explicitly authorized
 * - Verification of pre-reset archive and SHA-256 manifest prior to any mutation
 * - Multi-phase execution: Database transaction is separated from filesystem operations
 * - Complete classification and selective purging of audit_logs
 * - Protection of master data and 'users' autoincrement sequence
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config/env";
import { getOperationalDbPath } from "../database/db";

export interface ResetOptions {
  dbPath?: string;
  uploadsDir?: string;
  archiveDir?: string;
  openingBalance?: number;
  openingBalanceDesc?: string;
  openingBalancePj?: string;
  confirmOperationalReset?: string;
}

export interface ArchiveManifestEntry {
  relativePath: string;
  sizeBytes: number;
  sha256: string;
}

export interface PreResetArchiveResult {
  archiveDir: string;
  dbBackupPath: string;
  dbSha256: string;
  uploadsCount: number;
  manifestPath: string;
  verified: boolean;
}

export interface ResetExecutionResult {
  success: boolean;
  archiveResult: PreResetArchiveResult;
  purgedTables: Record<string, number>;
  preservedMasterCounts: Record<string, number>;
  kasKantorOpeningId: number;
  kasKantorOpeningSaldo: number;
  clearedUploadsCount: number;
  auditLogsPreservedCount: number;
  auditLogsClearedCount: number;
}

export const MASTER_DATA_TABLES = [
  "users",
  "employees",

  "role_permissions",
  "messengers",
  "services",
  "biaya_layanan",
  "aturan_estimasi",
  "estimation_templates",
  "samsat_offices",
  "samsat_pricing",
  "harga_dasar_samsat",
  "samsat_operational_tariffs",
  "wilayah_administratif",
  "master_proses_samsat",
  "payment_methods",
  "service_pricing_configs",
  "notification_settings",
  "customers",
  "customer_accounts",
  "vehicles",
];

export const TRANSACTIONAL_TABLES = [
  "laba_rugi_snapshots",
  "order_corrections",
  "order_timeline_processes",
  "order_status_history",
  "order_documents",
  "messenger_tasks",
  "document_tickets",
  "internal_transfers",
  "pengeluaran",
  "messenger_reimbursements",
  "kas_messenger",
  "invoice_payments",
  "documents",
  "finance_invoices",
  "orders",
  "idempotency_keys",
  "notification_logs",
];

export interface TransactionalAuditRule {
  module: string;
  actions: string[];
}

export const TRANSACTIONAL_AUDIT_RULES: TransactionalAuditRule[] = [
  {
    module: "Data Penjualan",
    actions: ["CANCEL_ORDER", "DELETE"],
  },
  {
    module: "Dokumen",
    actions: ["DOCUMENT_UPLOADED", "DOCUMENT_DELETED"],
  },
  {
    module: "Finance - Tagihan",
    actions: ["UPDATE"],
  },
  {
    module: "Finance Tagihan",
    actions: ["VOID_INVOICE_PAYMENT"],
  },
  {
    module: "Kas Messenger",
    actions: ["ADD_KAS_MESSENGER", "DELETE"],
  },
  {
    module: "Order",
    actions: ["CREATE", "VERIFY_COST", "UPDATE"],
  },
  {
    module: "Order Correction",
    actions: ["APPROVE_ORDER_CORRECTION", "REJECT_ORDER_CORRECTION", "REQUEST_ORDER_CORRECTION"],
  },
  {
    module: "Order History",
    actions: ["UPDATE", "DELETE"],
  },
  {
    module: "Order Tracking",
    actions: [
      "ADVANCE_STAGE",
      "ARCHIVE",
      "DOCUMENT_APPROVAL_INVALIDATED",
      "ROLLBACK_STAGE",
      "STAGE6_DOCS_APPROVED",
      "UPDATE",
      "VERIFY_PAYMENT",
    ],
  },
  {
    module: "Reimbursement Payout",
    actions: ["UPDATE"],
  },
  {
    module: "Reimbursement Review",
    actions: ["UPDATE"],
  },
  {
    module: "Kas Kantor",
    actions: ["ADD_KAS", "DELETE"],
  },
  {
    module: "Pengeluaran",
    actions: ["ADD_PENGELUARAN", "DELETE"],
  },
  {
    module: "Cashback Terpending",
    actions: ["CASHBACK_PAYOUT", "VOID_CASHBACK_PAYOUT"],
  },
  {
    module: "Keuangan",
    actions: ["RECORD_PAYMENT"],
  },
  {
    module: "Tagihan",
    actions: ["COMPLETE_INVOICE"],
  },
  {
    module: "Messenger Task",
    actions: ["ACCEPT_TASK", "DECLINE_TASK", "REASSIGN_TASK"],
  },
  {
    module: "Messenger",
    actions: ["VOID_REIMBURSEMENT"],
  },
  {
    module: "Reimbursement",
    actions: ["CREATE"],
  },
  {
    module: "Finance",
    actions: ["INTERNAL_TRANSFER"],
  },
];

export const TRANSACTIONAL_AUDIT_MODULES = TRANSACTIONAL_AUDIT_RULES.map((r) => r.module);

export const PRESERVED_AUDIT_MODULES = [
  "Authentication",
  "SISTEM",
  "Manajemen Pengguna",
  "Hak Akses",
  "Master Data Biaya Layanan",
  "Harga Dasar Samsat",
  "Biaya Layanan",
  "Master Layanan",
  "Wilayah Administratif",
  "Master Proses Samsat",
  "Pengaturan Notifikasi",
  "Notification Settings",
  "Pelanggan",
  "Kendaraan",
];

export type AuditLogCategory =
  | "AUTHENTICATION"
  | "SECURITY"
  | "USER_MANAGEMENT"
  | "ACCESS_CONTROL"
  | "MASTER_CONFIGURATION"
  | "TRANSACTIONAL_ORDER"
  | "TRANSACTIONAL_FINANCE"
  | "UNKNOWN";

export type AuditLogPurgeDecision = "KEEP" | "CLEAR";

export function classifyAuditLog(record: { module: string; action: string }): {
  category: AuditLogCategory;
  decision: AuditLogPurgeDecision;
  reason: string;
} {
  const mod = record.module;
  const act = record.action;

  if (mod === "Authentication") {
    return { category: "AUTHENTICATION", decision: "KEEP", reason: "Authentication & login security event" };
  }
  if (mod === "SISTEM") {
    return { category: "SECURITY", decision: "KEEP", reason: "System administrative security event" };
  }
  if (mod === "Manajemen Pengguna") {
    return { category: "USER_MANAGEMENT", decision: "KEEP", reason: "User account management event" };
  }
  if (mod === "Hak Akses") {
    return { category: "ACCESS_CONTROL", decision: "KEEP", reason: "Role & permission access control event" };
  }
  if (
    mod === "Master Data Biaya Layanan" ||
    mod === "Harga Dasar Samsat" ||
    mod === "Biaya Layanan" ||
    mod === "Master Layanan" ||
    mod === "Wilayah Administratif" ||
    mod === "Master Proses Samsat" ||
    mod === "Pengaturan Notifikasi" ||
    mod === "Notification Settings" ||
    mod === "Pelanggan" ||
    mod === "Kendaraan"
  ) {
    return { category: "MASTER_CONFIGURATION", decision: "KEEP", reason: "Master data / pricing configuration event" };
  }

  const matchingRule = TRANSACTIONAL_AUDIT_RULES.find((r) => r.module === mod);
  if (matchingRule && matchingRule.actions.includes(act)) {
    const isFinance = [
      "Finance - Tagihan",
      "Finance Tagihan",
      "Kas Messenger",
      "Reimbursement Payout",
      "Reimbursement Review",
      "Kas Kantor",
      "Pengeluaran",
      "Cashback Terpending",
      "Keuangan",
      "Tagihan",
      "Messenger Task",
      "Messenger",
      "Reimbursement",
      "Finance",
    ].includes(mod);

    return {
      category: isFinance ? "TRANSACTIONAL_FINANCE" : "TRANSACTIONAL_ORDER",
      decision: "CLEAR",
      reason: `Classified transactional ${isFinance ? "finance" : "order"} event`,
    };
  }

  // Any unclassified or unknown module/action defaults strictly to KEEP
  return { category: "UNKNOWN", decision: "KEEP", reason: "Unclassified/unknown module: preserved safely" };
}

export function computeFileSha256(filePath: string): string {
  const hash = crypto.createHash("sha256");
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest("hex");
}

/**
 * Validates target database and execution environment before any operation.
 */
export function validateResetTarget(options: ResetOptions): { targetDbPath: string; isOperational: boolean } {
  const targetDbPath = options.dbPath ? path.resolve(options.dbPath) : CONFIG.DB_PATH;
  const operationalPath = getOperationalDbPath();
  const isOperational = path.resolve(targetDbPath) === operationalPath;

  if (!fs.existsSync(targetDbPath)) {
    throw new Error(`[RESET GUARD] Target database file not found at: ${targetDbPath}`);
  }

  if (isOperational) {
    if (
      process.env.SUN89_SERVER_RUNNING === "true" ||
      options.confirmOperationalReset !== "YES_I_AM_SURE"
    ) {
      throw new Error(
        `[FATAL OPERATIONAL RESET GUARD] Direct reset of operational database '${targetDbPath}' is strictly blocked. Server must be offline and explicit confirmation 'YES_I_AM_SURE' is required.`
      );
    }
  }

  return { targetDbPath, isOperational };
}

/**
 * Creates a verified pre-reset archive outside the repository with full SHA-256 manifest.
 */
export function createPreResetArchive(options: ResetOptions): PreResetArchiveResult {
  const { targetDbPath } = validateResetTarget(options);
  const uploadsDir = options.uploadsDir ? path.resolve(options.uploadsDir) : CONFIG.UPLOAD_DIR;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveDir = options.archiveDir
    ? path.resolve(options.archiveDir)
    : path.resolve(CONFIG.PROJECT_ROOT, "..", `archives_sunbirojasa/pre_reset_${timestamp}`);

  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // 1. Snapshot database using SQLite VACUUM INTO (WAL-Safe & Crash-Consistent)
  const dbBackupPath = path.join(archiveDir, "database.sqlite");
  if (fs.existsSync(dbBackupPath)) {
    fs.unlinkSync(dbBackupPath);
  }

  // Open source in read-only mode to guarantee zero operational mutations while snapshotting
  const sourceDb = new DatabaseSync(targetDbPath, { readOnly: true });
  try {
    const normalizedDest = dbBackupPath.replace(/\\/g, "/").replace(/'/g, "''");
    sourceDb.exec(`VACUUM INTO '${normalizedDest}';`);
  } finally {
    sourceDb.close();
  }

  const dbSha256 = computeFileSha256(dbBackupPath);

  // 2. Snapshot uploads
  const archiveUploadsDir = path.join(archiveDir, "uploads");
  if (!fs.existsSync(archiveUploadsDir)) {
    fs.mkdirSync(archiveUploadsDir, { recursive: true });
  }

  const manifest: ArchiveManifestEntry[] = [];
  manifest.push({
    relativePath: "database.sqlite",
    sizeBytes: fs.statSync(dbBackupPath).size,
    sha256: dbSha256,
  });

  let uploadsCount = 0;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      const srcFile = path.join(uploadsDir, f);
      const stat = fs.statSync(srcFile);
      if (stat.isFile()) {
        const destFile = path.join(archiveUploadsDir, f);
        fs.copyFileSync(srcFile, destFile);
        const fSha = computeFileSha256(destFile);
        manifest.push({
          relativePath: `uploads/${f}`,
          sizeBytes: stat.size,
          sha256: fSha,
        });
        uploadsCount++;
      }
    }
  }

  const manifestPath = path.join(archiveDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  // 3. Verify archive integrity
  const tempDb = new DatabaseSync(dbBackupPath, { readOnly: true });
  try {
    const integrityRow = tempDb.prepare("PRAGMA integrity_check;").get() as any;
    if (integrityRow?.integrity_check !== "ok") {
      throw new Error(`Corrupted archive database: integrity_check returned ${integrityRow?.integrity_check}`);
    }
    const fkViolations = tempDb.prepare("PRAGMA foreign_key_check;").all();
    if (fkViolations.length > 0) {
      throw new Error(`Foreign key violations in archive database: ${JSON.stringify(fkViolations)}`);
    }
  } finally {
    tempDb.close();
  }

  return {
    archiveDir,
    dbBackupPath,
    dbSha256,
    uploadsCount,
    manifestPath,
    verified: true,
  };
}

/**
 * Restores database and uploads from an archive to a designated sandbox target.
 */
export function restoreFromArchive(
  archiveDir: string,
  targetDbPath: string,
  targetUploadsDir: string
): { dbRestored: boolean; uploadsRestoredCount: number; integrity: string } {
  const dbArchive = path.join(archiveDir, "database.sqlite");
  const uploadsArchive = path.join(archiveDir, "uploads");
  const manifestPath = path.join(archiveDir, "manifest.json");

  if (!fs.existsSync(dbArchive) || !fs.existsSync(manifestPath)) {
    throw new Error(`Invalid archive at: ${archiveDir}`);
  }

  // 1. Verify manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ArchiveManifestEntry[];
  for (const item of manifest) {
    const fullPath = path.join(archiveDir, item.relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Archive file missing: ${item.relativePath}`);
    }
    const hash = computeFileSha256(fullPath);
    if (hash !== item.sha256) {
      throw new Error(`Archive checksum mismatch on: ${item.relativePath}`);
    }
  }

  // 2. Restore DB
  const dbDir = path.dirname(targetDbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  // Safety: Remove any stale WAL or SHM companion files before restoring
  for (const ext of ["-wal", "-shm"]) {
    const companion = `${targetDbPath}${ext}`;
    if (fs.existsSync(companion)) {
      try {
        fs.unlinkSync(companion);
      } catch (err) {
        console.warn(`[RESTORE NOTICE] Could not unlink companion ${companion}:`, err);
      }
    }
  }

  fs.copyFileSync(dbArchive, targetDbPath);

  const checkDb = new DatabaseSync(targetDbPath, { readOnly: true });
  let integrity = "unknown";
  try {
    const row = checkDb.prepare("PRAGMA integrity_check;").get() as any;
    integrity = row?.integrity_check || "ok";
    if (integrity !== "ok") {
      throw new Error(`Corrupted restored database: integrity_check returned ${integrity}`);
    }
    const fkViolations = checkDb.prepare("PRAGMA foreign_key_check;").all();
    if (fkViolations.length > 0) {
      throw new Error(`Foreign key violations in restored database: ${JSON.stringify(fkViolations)}`);
    }
  } finally {
    checkDb.close();
  }

  // 3. Restore uploads
  if (!fs.existsSync(targetUploadsDir)) fs.mkdirSync(targetUploadsDir, { recursive: true });
  let count = 0;
  if (fs.existsSync(uploadsArchive)) {
    for (const f of fs.readdirSync(uploadsArchive)) {
      const src = path.join(uploadsArchive, f);
      const dst = path.join(targetUploadsDir, f);
      fs.copyFileSync(src, dst);
      count++;
    }
  }

  return { dbRestored: true, uploadsRestoredCount: count, integrity };
}

/**
 * Executes a hardened, transactional purge on the target database with official opening balance injection.
 */
export function executeTransactionalReset(options: ResetOptions): ResetExecutionResult {
  const { targetDbPath } = validateResetTarget(options);
  const uploadsDir = options.uploadsDir ? path.resolve(options.uploadsDir) : CONFIG.UPLOAD_DIR;

  // 1. Enforce Pre-Reset Archive
  const archiveResult = createPreResetArchive(options);
  if (!archiveResult.verified) {
    throw new Error("[RESET ABORTED] Archive verification failed.");
  }

  const db = new DatabaseSync(targetDbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    // Non-fatal if target DB is not in WAL mode
  }

  // Record pre-reset master table counts
  const preservedMasterCounts: Record<string, number> = {};
  for (const tbl of MASTER_DATA_TABLES) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get() as any;
      preservedMasterCounts[tbl] = row?.c ?? 0;
    } catch {
      preservedMasterCounts[tbl] = 0;
    }
  }

  // 2. Atomic Database Transaction
  const purgedTables: Record<string, number> = {};
  let auditLogsPreservedCount = 0;
  let auditLogsClearedCount = 0;

  db.exec("BEGIN TRANSACTION;");
  try {
    // A. Child transactions
    for (const tbl of [
      "laba_rugi_snapshots",
      "order_corrections",
      "order_timeline_processes",
      "order_status_history",
      "order_documents",
      "messenger_tasks",
      "document_tickets",
      "internal_transfers",
      "pengeluaran",
      "messenger_reimbursements",
      "kas_messenger",
    ]) {
      const res = db.prepare(`DELETE FROM ${tbl};`).run();
      purgedTables[tbl] = Number(res.changes);
    }

    // B. Payments & documents
    const payRes = db.prepare("DELETE FROM invoice_payments;").run();
    purgedTables["invoice_payments"] = Number(payRes.changes);

    const docRes = db.prepare("DELETE FROM documents;").run();
    purgedTables["documents"] = Number(docRes.changes);

    // C. Core orders & invoices
    const invRes = db.prepare("DELETE FROM finance_invoices;").run();
    purgedTables["finance_invoices"] = Number(invRes.changes);

    const ordRes = db.prepare("DELETE FROM orders;").run();
    purgedTables["orders"] = Number(ordRes.changes);

    // D. Mixed table kas_kantor
    const kasRes = db.prepare("DELETE FROM kas_kantor;").run();
    purgedTables["kas_kantor"] = Number(kasRes.changes);

    // E. Transient & notification tables
    db.prepare("DELETE FROM idempotency_keys;").run();
    db.prepare("DELETE FROM notification_logs;").run();

    // F. Granular Audit Logs Classification Purge (Explicit Module & Action Whitelist, No Global Substring Matching)
    const ruleClauses = TRANSACTIONAL_AUDIT_RULES.map((rule) => {
      const actList = rule.actions.map((a) => `'${a}'`).join(", ");
      return `(module = '${rule.module}' AND action IN (${actList}))`;
    }).join(" OR\n         ");

    const auditRes = db.prepare(`
      DELETE FROM audit_logs 
      WHERE ${ruleClauses};
    `).run();
    auditLogsClearedCount = Number(auditRes.changes);

    const auditKeepRow = db.prepare("SELECT COUNT(*) as c FROM audit_logs;").get() as any;
    auditLogsPreservedCount = Number(auditKeepRow?.c || 0);

    // G. Reset sqlite_sequence ONLY for transaction tables (Protect 'users')
    db.exec(`
      DELETE FROM sqlite_sequence 
      WHERE name IN (
        'finance_invoices',
        'kas_kantor',
        'pengeluaran',
        'kas_messenger',
        'invoice_payments',
        'order_status_history',
        'order_timeline_processes',
        'laba_rugi_snapshots'
      );
    `);

    // H. Insert Official Opening Balance Record
    const openAmount = options.openingBalance !== undefined ? Math.max(0, Number(options.openingBalance)) : 0;
    const openDesc = options.openingBalanceDesc || (openAmount > 0 ? "Setoran Modal Awal Kas Kantor Operasional Siklus Baru" : "Saldo Awal Kas Kantor Operasional Siklus Baru");
    const openPj = options.openingBalancePj || "Direktur / Owner";

    const insertOpenStmt = db.prepare(`
      INSERT INTO kas_kantor (
        id, tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab, kategori, created_at
      ) VALUES (
        1, date('now'), ?, 'DEBIT', ?, 0, ?, ?, 'MODAL_AWAL', datetime('now')
      )
    `);
    insertOpenStmt.run(openDesc, openAmount, openAmount, openPj);

    // I. Relational Foreign Key Integrity Check
    const fkViolations = db.prepare("PRAGMA foreign_key_check;").all();
    if (fkViolations.length > 0) {
      throw new Error(`[RESET ROLLBACK] Foreign key violations detected during purge: ${JSON.stringify(fkViolations)}`);
    }

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    db.close();
    throw err;
  }

  // Defragment & optimize database storage
  db.exec("VACUUM;");
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    // Non-fatal if DB not in WAL mode
  }
  db.close();

  // 3. Filesystem Cleanup (Separated from database transaction)
  let clearedUploadsCount = 0;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      if (f === ".gitkeep") continue;
      const fPath = path.join(uploadsDir, f);
      try {
        if (fs.statSync(fPath).isFile()) {
          fs.unlinkSync(fPath);
          clearedUploadsCount++;
        }
      } catch (err) {
        console.warn(`[RESET NOTICE] Could not delete upload file ${f}:`, err);
      }
    }
  }

  return {
    success: true,
    archiveResult,
    purgedTables,
    preservedMasterCounts,
    kasKantorOpeningId: 1,
    kasKantorOpeningSaldo: options.openingBalance !== undefined ? Math.max(0, Number(options.openingBalance)) : 0,
    clearedUploadsCount,
    auditLogsPreservedCount,
    auditLogsClearedCount,
  };
}
