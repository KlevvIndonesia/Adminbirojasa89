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
    process.env.SUN89_TEST_ISOLATED === "1" ||
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

/**
 * Per-database connection transaction depth map.
 * Replaces the fragile global inTransaction boolean flag with instance-level isolation.
 */
const _txDepthMap = new WeakMap<DatabaseSync, number>();

/**
 * Quarantined database connections whose transaction state became corrupt or un-terminated
 * following a fatal ROLLBACK or SAVEPOINT release/rollback failure.
 */
const _corruptedConnections = new WeakSet<DatabaseSync>();

/**
 * Checks whether a database connection has been quarantined due to an unrecoverable transaction failure.
 */
export function isConnectionCorrupted(customDb?: DatabaseSync): boolean {
  return _corruptedConnections.has(customDb ?? getDb());
}

/**
 * Returns the current active transaction depth for a given database connection.
 * Useful for assertions, diagnostics, and test verifications.
 */
export function getTransactionDepth(customDb?: DatabaseSync): number {
  return _txDepthMap.get(customDb ?? getDb()) || 0;
}

/**
 * Checks whether a callback is a native AsyncFunction before invocation.
 */
function isNativeAsyncFunction(fn: unknown): boolean {
  if (typeof fn !== "function") return false;
  return (
    fn.constructor?.name === "AsyncFunction" ||
    (fn as any)[Symbol.toStringTag] === "AsyncFunction"
  );
}

/**
 * Executes a callback within a managed SQLite transaction using BEGIN IMMEDIATE.
 * 
 * Hardening Guarantees:
 * 1. Immediate reserved lock acquisition via BEGIN IMMEDIATE; (WAL write lock).
 * 2. Per-connection transaction tracking: isolated depth per DatabaseSync instance.
 * 3. Pre-execution rejection of native AsyncFunction callbacks (body never starts executing).
 * 4. Runtime rejection of Promise/thenable returns with immediate synchronous rollback.
 * 5. Connection quarantine: if ROLLBACK or SAVEPOINT fails, connection is quarantined and never silently reused.
 * 6. Nested transaction support via SQLite SAVEPOINT with isolated rollback on inner failure.
 * 7. Anti-poisoning: depth is incremented only after successful lock acquisition.
 */
export function runInTransaction<T>(fn: () => T, customDb?: DatabaseSync): T {
  const activeDb = customDb ?? getDb();

  // Guard 0: Check connection health
  if (_corruptedConnections.has(activeDb)) {
    throw new Error(
      "[FATAL_TRANSACTION_CORRUPTION] The database connection has an un-terminated or corrupt transaction state from a previous fatal COMMIT/ROLLBACK failure and cannot be safely reused."
    );
  }

  // Guard 1: Reject native async functions BEFORE invocation
  if (isNativeAsyncFunction(fn)) {
    throw new Error(
      "[TRANSACTION_ASYNC_NOT_SUPPORTED] runInTransaction only supports synchronous callbacks. Native async functions cannot be used inside managed transactions."
    );
  }

  const currentDepth = _txDepthMap.get(activeDb) || 0;

  // Nested call on the SAME database instance: use SAVEPOINT
  if (currentDepth > 0) {
    const savepointName = `sp_${currentDepth}_${Math.random().toString(36).substring(2, 8)}`;
    activeDb.exec(`SAVEPOINT ${savepointName};`);
    _txDepthMap.set(activeDb, currentDepth + 1);

    try {
      const result = fn();
      if (result !== null && typeof result === "object" && typeof (result as any).then === "function") {
        throw new Error(
          "[TRANSACTION_ASYNC_NOT_SUPPORTED] runInTransaction only supports synchronous callbacks. Passing an async function or Promise leads to premature commit before asynchronous database operations resolve."
        );
      }
      try {
        activeDb.exec(`RELEASE SAVEPOINT ${savepointName};`);
      } catch (releaseErr) {
        _corruptedConnections.add(activeDb);
        throw releaseErr;
      }
      return result;
    } catch (err) {
      try {
        activeDb.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
        activeDb.exec(`RELEASE SAVEPOINT ${savepointName};`);
      } catch (savepointRollbackErr) {
        // Savepoint desynchronization corrupts connection state
        _corruptedConnections.add(activeDb);
      }
      throw err;
    } finally {
      if (!_corruptedConnections.has(activeDb)) {
        _txDepthMap.set(activeDb, currentDepth);
      }
    }
  }

  // Top-level transaction on this database instance
  activeDb.exec("BEGIN IMMEDIATE;");
  _txDepthMap.set(activeDb, 1);

  try {
    const result = fn();
    if (result !== null && typeof result === "object" && typeof (result as any).then === "function") {
      throw new Error(
        "[TRANSACTION_ASYNC_NOT_SUPPORTED] runInTransaction only supports synchronous callbacks. Passing an async function or Promise leads to premature commit before asynchronous database operations resolve."
      );
    }
    activeDb.exec("COMMIT;");
    return result;
  } catch (err) {
    try {
      activeDb.exec("ROLLBACK;");
    } catch (rollbackErr) {
      // Fatal: rollback failed. The connection has an un-terminated transaction and is poisoned.
      _corruptedConnections.add(activeDb);
      if (_db === activeDb) {
        try { _db.close(); } catch {}
        _db = null;
      }
      throw new Error(
        `[FATAL_TRANSACTION_ROLLBACK_FAILURE] Fatal error rolling back transaction. Connection has been quarantined: ${(rollbackErr as any)?.message || rollbackErr}`
      );
    }
    throw err;
  } finally {
    if (!_corruptedConnections.has(activeDb)) {
      _txDepthMap.set(activeDb, 0);
    }
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
