/**
 * Database & Document Storage Backup and Restore Utilities
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides crash-consistent SQLite database backups via VACUUM INTO,
 * physical document file backups, and full integrity verification.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config/env";
import { db } from "../database/db";

export interface DatabaseBackupResult {
  backupPath: string;
  sizeBytes: number;
  timestamp: string;
}

export interface UploadsBackupResult {
  backupDir: string;
  fileCount: number;
  totalBytes: number;
  timestamp: string;
}

export interface DisasterRecoveryVerificationResult {
  valid: boolean;
  dbIntegrity: string;
  checkedDocuments: number;
  missingFiles: string[];
  mismatchedHashes: string[];
}

/**
 * Creates an atomic, crash-consistent snapshot of the SQLite database
 * using SQLite's native VACUUM INTO command. Does not lock writers for long periods
 * and captures WAL pages cleanly.
 */
export function backupDatabase(customDestination?: string): DatabaseBackupResult {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = customDestination ? path.dirname(customDestination) : (CONFIG.BACKUP_DIR || path.resolve(process.cwd(), "server/backups"));
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const destination = customDestination || path.join(backupDir, `db_backup_${timestamp}.sqlite`);

  // Ensure destination file does not already exist
  if (fs.existsSync(destination)) {
    fs.unlinkSync(destination);
  }

  // SQLite VACUUM INTO creates an exact, atomic, self-contained database snapshot
  const escapedPath = destination.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escapedPath}';`);

  const stats = fs.statSync(destination);
  return {
    backupPath: destination,
    sizeBytes: stats.size,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Restores a SQLite database from a verified backup file.
 * Automatically verifies database integrity prior to completing the restore.
 */
export function restoreDatabase(backupPath: string, targetPath?: string): { success: boolean; integrity: string } {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file does not exist at: ${backupPath}`);
  }

  // 1. Verify backup file integrity before restoring (read-only SQLite connection)
  const tempDb = new DatabaseSync(backupPath, { readOnly: true });
  let integrity = "unknown";
  try {
    const row = tempDb.prepare("PRAGMA integrity_check;").get() as { integrity_check?: string };
    integrity = row?.integrity_check || "ok";
    if (integrity !== "ok") {
      throw new Error(`Corrupted backup file detected. PRAGMA integrity_check returned: ${integrity}`);
    }
  } finally {
    tempDb.close();
  }

  // 2. Perform copy to target location
  const destination = targetPath || CONFIG.DB_PATH;
  const targetDir = path.dirname(destination);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Clean existing target if different from backup
  if (path.resolve(backupPath) !== path.resolve(destination)) {
    fs.copyFileSync(backupPath, destination);
  }

  return { success: true, integrity };
}

/**
 * Creates a persistent backup of the document storage directory.
 */
export function backupUploads(customDestinationDir?: string): UploadsBackupResult {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = customDestinationDir || (CONFIG.BACKUP_DIR || path.resolve(process.cwd(), "server/backups"));
  const targetDir = customDestinationDir || path.join(backupRoot, `uploads_backup_${timestamp}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const sourceDir = CONFIG.UPLOAD_DIR;
  let fileCount = 0;
  let totalBytes = 0;

  if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir);
    for (const file of files) {
      const srcPath = path.join(sourceDir, file);
      const stat = fs.statSync(srcPath);
      if (stat.isFile()) {
        const destPath = path.join(targetDir, file);
        fs.copyFileSync(srcPath, destPath);
        fileCount++;
        totalBytes += stat.size;
      }
    }
  }

  return {
    backupDir: targetDir,
    fileCount,
    totalBytes,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Restores document storage files from a backup directory.
 */
export function restoreUploads(backupDir: string, targetDir?: string): { restoredCount: number } {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Uploads backup directory does not exist: ${backupDir}`);
  }

  const destination = targetDir || CONFIG.UPLOAD_DIR;
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const files = fs.readdirSync(backupDir);
  let restoredCount = 0;

  for (const file of files) {
    const srcPath = path.join(backupDir, file);
    const stat = fs.statSync(srcPath);
    if (stat.isFile()) {
      const destPath = path.join(destination, file);
      fs.copyFileSync(srcPath, destPath);
      restoredCount++;
    }
  }

  return { restoredCount };
}

/**
 * Verifies relational and physical consistency between restored database metadata
 * and restored document files on disk. Confirms that every active document in SQLite
 * exists on disk and matches its expected SHA-256 hash.
 */
export function verifyDisasterRecovery(
  dbFilePath: string,
  uploadsDirPath: string
): DisasterRecoveryVerificationResult {
  if (!fs.existsSync(dbFilePath)) {
    throw new Error(`Database file not found at: ${dbFilePath}`);
  }
  if (!fs.existsSync(uploadsDirPath)) {
    throw new Error(`Uploads directory not found at: ${uploadsDirPath}`);
  }

  // Use read-only SQLite connection for disaster recovery integrity check
  const verifyDb = new DatabaseSync(dbFilePath, { readOnly: true });
  let dbIntegrity = "unknown";
  const missingFiles: string[] = [];
  const mismatchedHashes: string[] = [];
  let checkedDocuments = 0;

  try {
    // 1. Verify SQLite integrity
    const integrityRow = verifyDb.prepare("PRAGMA integrity_check;").get() as { integrity_check?: string };
    dbIntegrity = integrityRow?.integrity_check || "ok";

    // 2. Query all active documents
    const rows = verifyDb.prepare(
      "SELECT id, storage_name, sha256, original_name FROM documents WHERE is_active = 1"
    ).all() as Array<{ id: string; storage_name: string; sha256: string; original_name: string }>;

    checkedDocuments = rows.length;

    for (const doc of rows) {
      const filePath = path.join(uploadsDirPath, doc.storage_name);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(`Document ${doc.id} (${doc.storage_name}) missing from disk`);
        continue;
      }

      // Check SHA-256
      const bytes = fs.readFileSync(filePath);
      const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
      if (actualHash !== doc.sha256) {
        mismatchedHashes.push(`Document ${doc.id} hash mismatch. Expected ${doc.sha256}, got ${actualHash}`);
      }
    }
  } finally {
    verifyDb.close();
  }

  const valid = dbIntegrity === "ok" && missingFiles.length === 0 && mismatchedHashes.length === 0;

  return {
    valid,
    dbIntegrity,
    checkedDocuments,
    missingFiles,
    mismatchedHashes,
  };
}
