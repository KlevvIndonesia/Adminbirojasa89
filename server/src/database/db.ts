/**
 * SQLite Database Connection & Management
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Hardened Database Access Architecture:
 * - Lazy connection factory (getDb)
 * - Decoupled schema initialization (initDatabase / initializeSchema)
 * - Dedicated read-only mode for audit & inspection (getReadOnlyDb)
 * - Operational database write guard
 * - Zero module-evaluation side-effects (safe imports)
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config/env";
import { initializeSchema } from "./schema";

let _db: DatabaseSync | null = null;
let _operationalWriteGranted = false;

/**
 * Returns the canonical absolute path of the operational database.
 */
export function getOperationalDbPath(): string {
  return path.resolve(CONFIG.PROJECT_ROOT, "server/data/database.sqlite");
}

/**
 * Checks if write operations against the operational database have been authorized.
 */
export function isOperationalWriteAllowed(): boolean {
  return (
    _operationalWriteGranted ||
    process.env.ALLOW_OPERATIONAL_WRITE === "true" ||
    process.env.SUN89_SERVER_RUNNING === "true"
  );
}

/**
 * Sets operational write authorization flag.
 */
export function setOperationalWriteGranted(granted: boolean): void {
  _operationalWriteGranted = granted;
}

/**
 * Checks whether an active default database connection has been established.
 */
export function isDbConnected(): boolean {
  return _db !== null;
}

/**
 * Lazy Database Connection Factory.
 * Resolves connection on first access, configures WAL mode, foreign keys, and busy timeout.
 * 
 * Safety Protections:
 * 1. Blocks test execution if pointing directly to operational database.
 * 2. Blocks ad-hoc CLI / REPL read-write access to operational database unless authorized.
 */
export function getDb(options?: { targetPath?: string }): DatabaseSync {
  if (_db) {
    return _db;
  }

  const targetPath = options?.targetPath ? path.resolve(options.targetPath) : CONFIG.DB_PATH;
  const operationalDbPath = getOperationalDbPath();

  // Safety Guard 1: Strict test isolation
  if (
    process.env.NODE_ENV === "test" ||
    process.argv.some((arg) => typeof arg === "string" && arg.includes("--test"))
  ) {
    if (path.resolve(targetPath) === operationalDbPath) {
      throw new Error(
        `[FATAL SAFETY GUARD] Tests must NEVER run directly against operational database '${operationalDbPath}'. Set DB_PATH to an isolated temporary database.`
      );
    }
  }

  // Safety Guard 2: Operational database write protection for unverified CLI/ad-hoc contexts
  if (path.resolve(targetPath) === operationalDbPath && !isOperationalWriteAllowed()) {
    throw new Error(
      `[FATAL DATABASE SAFETY GUARD] Direct read-write access to operational database '${operationalDbPath}' is prohibited outside of authorized server startup. Use getReadOnlyDb() for inspection, or point DB_PATH to an isolated database.`
    );
  }

  const dbDir = path.dirname(targetPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new DatabaseSync(targetPath);

  // Enable WAL mode, foreign keys, and busy timeout for concurrent safety
  _db.exec("PRAGMA journal_mode = WAL;");
  _db.exec("PRAGMA foreign_keys = ON;");
  _db.exec("PRAGMA busy_timeout = 5000;");

  return _db;
}

/**
 * Dedicated Read-Only Connection for CLI inspection, audits, and reporting.
 * Strictly enforced at SQLite engine level ({ readOnly: true }).
 * Prevents any WAL flush, header counter changes, or write operations.
 */
export function getReadOnlyDb(customPath?: string): DatabaseSync {
  const targetPath = customPath ? path.resolve(customPath) : CONFIG.DB_PATH;
  return new DatabaseSync(targetPath, { readOnly: true });
}

/**
 * Explicit Database Initialization Lifecycle.
 * Called exclusively by official server startup (server/src/server.ts) or test suites.
 * Decouples schema initialization from connection opening.
 */
export function initDatabase(options?: {
  runSchema?: boolean;
  allowOperationalWrite?: boolean;
  targetPath?: string;
}): DatabaseSync {
  if (options?.allowOperationalWrite) {
    _operationalWriteGranted = true;
  }

  const database = getDb(options?.targetPath ? { targetPath: options.targetPath } : undefined);

  if (options?.runSchema) {
    initializeSchema(database);
  }

  return database;
}

let inTransaction = false;

export function runInTransaction<T>(fn: () => T, customDb?: DatabaseSync): T {
  const activeDb = customDb ?? getDb();
  if (inTransaction) {
    return fn();
  }
  inTransaction = true;
  activeDb.exec("BEGIN IMMEDIATE;");
  try {
    const result = fn();
    activeDb.exec("COMMIT;");
    inTransaction = false;
    return result;
  } catch (err) {
    try {
      activeDb.exec("ROLLBACK;");
    } catch {
      // ignore rollback errors if already aborted
    }
    inTransaction = false;
    throw err;
  }
}

export function closeDb(): void {
  if (_db) {
    try {
      _db.close();
      console.log("[SUN89 Database] SQLite connection closed successfully.");
    } catch (err) {
      console.error("[SUN89 Database] Error closing database:", err);
    } finally {
      _db = null;
      _operationalWriteGranted = false;
    }
  }
}

/**
 * Backward compatibility database accessor.
 * Delegates lazily to getDb() without triggering connections at module load time.
 */
export const db = {
  prepare(sql: string) {
    return getDb().prepare(sql);
  },
  exec(sql: string) {
    return getDb().exec(sql);
  },
  close() {
    closeDb();
  },
} as unknown as DatabaseSync;
