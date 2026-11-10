/**
 * Phase 4B Batch 2B — Step A: Transaction Infrastructure Hardening Tests
 * 
 * Verifies transaction infrastructure primitives and prerequisites for Batch 2B:
 * - Directly verified:
 *   - AC-B2-15: Transaction helper state anti-poisoning on BEGIN IMMEDIATE failure
 *   - AC-B2-16: Transaction helper strict prohibition of native AsyncFunction & runtime Promises
 * - Infrastructure primitives supporting upcoming business lifecycle steps:
 *   - TX-INFRA-01: Standard synchronous commit
 *   - TX-INFRA-02: Mid-transaction failure atomic rollback (supporting AC-B2-14)
 *   - TX-INFRA-03: Sequential serialization across independent connections (supporting AC-B2-13)
 *   - TX-INFRA-04: Real writer lock contention & busy timeout delay (supporting AC-B2-13)
 *   - TX-INFRA-05: Failed COMMIT with clean ROLLBACK leaves connection healthy & reusable
 *   - TX-INFRA-06: Failed ROLLBACK causes fail-closed permanent connection quarantine
 *   - TX-INFRA-07/08: Nested SAVEPOINT release and rollback failure quarantine
 * 
 * Note: Business acceptance criteria AC-B2-11 (void missing cash entry), AC-B2-12 (repeated void),
 * AC-B2-13 (business concurrent payment verification), and AC-B2-14 (payment/invoice recalculation atomicity)
 * remain pending and will be validated in subsequent steps (Steps C, D, and F).
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { runInTransaction, getTransactionDepth, isConnectionCorrupted } from "../server/src/database/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_DIR = path.resolve(__dirname, "../temp_test_tx");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test_tx_infra.sqlite");
const TEST_DB_PATH_B = path.join(TEST_DB_DIR, "test_tx_infra_b.sqlite");

function createTestDatabase(filePath: string): DatabaseSync {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, val INTEGER NOT NULL);");
  return db;
}

describe("Phase 4B Batch 2B — Step A: Transaction Infrastructure", () => {
  let dbA: DatabaseSync;
  let dbB: DatabaseSync;

  beforeEach(() => {
    dbA = createTestDatabase(TEST_DB_PATH);
    dbB = createTestDatabase(TEST_DB_PATH_B);
  });

  afterEach(() => {
    try { dbA.close(); } catch {}
    try { dbB.close(); } catch {}
    if (fs.existsSync(TEST_DB_DIR)) {
      try { fs.rmSync(TEST_DB_DIR, { recursive: true, force: true }); } catch {}
    }
  });

  test("TX-INFRA-01: Standard Synchronous Transaction Commit", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0, "Depth must be 0 prior to transaction");

    const result = runInTransaction(() => {
      assert.strictEqual(getTransactionDepth(dbA), 1, "Depth must be 1 inside top-level transaction");
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(1, "Item A", 100);
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(2, "Item B", 200);
      return "SUCCESS_COMMIT";
    }, dbA);

    assert.strictEqual(result, "SUCCESS_COMMIT");
    assert.strictEqual(getTransactionDepth(dbA), 0, "Depth must return to 0 after commit");

    const rows = dbA.prepare("SELECT * FROM items ORDER BY id ASC").all() as any[];
    assert.strictEqual(rows.length, 2, "Both items must be committed");
    assert.strictEqual(rows[0].name, "Item A");
    assert.strictEqual(rows[1].name, "Item B");
  });

  test("TX-INFRA-02: Mid-Transaction Failure and Atomic Rollback (Supporting AC-B2-14)", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    assert.throws(
      () => {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(10, "Should Rollback", 500);
          throw new Error("INJECTED_MID_TX_FAILURE");
        }, dbA);
      },
      /INJECTED_MID_TX_FAILURE/
    );

    assert.strictEqual(getTransactionDepth(dbA), 0, "Depth must return to 0 following rollback");
    const rows = dbA.prepare("SELECT * FROM items WHERE id = 10").all();
    assert.strictEqual(rows.length, 0, "Rolled back row must not exist in table");
  });

  test("Nested Transactions with SAVEPOINT (Inner Success)", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    runInTransaction(() => {
      assert.strictEqual(getTransactionDepth(dbA), 1);
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(20, "Outer 1", 100);

      runInTransaction(() => {
        assert.strictEqual(getTransactionDepth(dbA), 2, "Depth must be 2 inside nested transaction");
        dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(21, "Inner 1", 200);
      }, dbA);

      assert.strictEqual(getTransactionDepth(dbA), 1, "Depth must return to 1 after nested release");
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(22, "Outer 2", 300);
    }, dbA);

    assert.strictEqual(getTransactionDepth(dbA), 0);
    const rows = dbA.prepare("SELECT * FROM items WHERE id IN (20, 21, 22) ORDER BY id ASC").all() as any[];
    assert.strictEqual(rows.length, 3, "All three rows must be present");
  });

  test("Nested Transaction Partial Rollback (Inner Failure with Outer Recovery)", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    runInTransaction(() => {
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(30, "Outer Kept", 100);

      try {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(31, "Inner Rolled Back", 200);
          throw new Error("INNER_SAVEPOINT_FAILURE");
        }, dbA);
      } catch (err: any) {
        assert.match(err.message, /INNER_SAVEPOINT_FAILURE/);
      }

      // Outer continues after catching inner failure
      assert.strictEqual(getTransactionDepth(dbA), 1, "Depth must recover to 1 after inner savepoint rollback");
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(32, "Outer Succeeded", 300);
    }, dbA);

    assert.strictEqual(getTransactionDepth(dbA), 0);
    const rows = dbA.prepare("SELECT * FROM items WHERE id IN (30, 31, 32) ORDER BY id ASC").all() as any[];
    assert.strictEqual(rows.length, 2, "Only outer rows must exist; inner row must be rolled back by SAVEPOINT");
    assert.strictEqual(rows[0].id, 30);
    assert.strictEqual(rows[1].id, 32);
  });

  test("Outer Rollback Cascades Across All Nested Savepoints", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    assert.throws(
      () => {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(40, "Outer Row", 100);

          runInTransaction(() => {
            dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(41, "Inner Row", 200);
          }, dbA);

          throw new Error("OUTER_FAILURE_CASCADES");
        }, dbA);
      },
      /OUTER_FAILURE_CASCADES/
    );

    assert.strictEqual(getTransactionDepth(dbA), 0);
    const rows = dbA.prepare("SELECT * FROM items WHERE id IN (40, 41)").all();
    assert.strictEqual(rows.length, 0, "Both outer and inner rows must be completely rolled back");
  });

  test("AC-B2-16: Strict Pre-Invocation Rejection of Native AsyncFunction (Body Never Executes)", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    let bodyExecuted = false;

    // Test passing a native async function: body must NOT execute
    assert.throws(
      () => {
        runInTransaction(async () => {
          bodyExecuted = true;
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(50, "Async Bad", 100);
        }, dbA);
      },
      /\[TRANSACTION_ASYNC_NOT_SUPPORTED\] runInTransaction only supports synchronous callbacks/
    );

    assert.strictEqual(bodyExecuted, false, "Native async callback body must NEVER begin execution");
    assert.strictEqual(getTransactionDepth(dbA), 0, "Depth must remain 0");
    const rows = dbA.prepare("SELECT * FROM items WHERE id = 50").all();
    assert.strictEqual(rows.length, 0, "No row may exist");
  });

  test("AC-B2-16: Runtime Rejection of Returned Promise / Thenable with Immediate Rollback", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    let syncStatementsRan = false;

    // Test passing a synchronous function that returns a thenable / Promise
    assert.throws(
      () => {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(55, "Sync Part", 100);
          syncStatementsRan = true;
          return {
            then: (resolve: any) => resolve("mock_promise_resolution"),
          };
        }, dbA);
      },
      /\[TRANSACTION_ASYNC_NOT_SUPPORTED\]/
    );

    assert.strictEqual(syncStatementsRan, true, "Synchronous statements ran before thenable return was checked");
    assert.strictEqual(getTransactionDepth(dbA), 0, "Transaction must be immediately rolled back and depth reset to 0");
    const rows = dbA.prepare("SELECT * FROM items WHERE id = 55").all();
    assert.strictEqual(rows.length, 0, "Synchronous write must be rolled back by runtime Promise rejection");
  });

  test("Multi-Database Instance Isolation (Different Connection Handles)", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);
    assert.strictEqual(getTransactionDepth(dbB), 0);

    runInTransaction(() => {
      assert.strictEqual(getTransactionDepth(dbA), 1, "dbA depth is 1");
      assert.strictEqual(getTransactionDepth(dbB), 0, "dbB depth is 0");
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(60, "On DB A", 100);

      // Inner call on dbB MUST start an independent top-level transaction on dbB!
      runInTransaction(() => {
        assert.strictEqual(getTransactionDepth(dbB), 1, "dbB must have depth 1 (independent top-level transaction)");
        assert.strictEqual(getTransactionDepth(dbA), 1, "dbA depth remains 1");
        dbB.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(70, "On DB B", 200);
      }, dbB);

      assert.strictEqual(getTransactionDepth(dbB), 0, "dbB transaction finished and committed to depth 0");
      assert.strictEqual(getTransactionDepth(dbA), 1, "dbA remains in active transaction at depth 1");
    }, dbA);

    assert.strictEqual(getTransactionDepth(dbA), 0);
    assert.strictEqual(getTransactionDepth(dbB), 0);

    const rowA = dbA.prepare("SELECT * FROM items WHERE id = 60").all();
    const rowB = dbB.prepare("SELECT * FROM items WHERE id = 70").all();
    assert.strictEqual(rowA.length, 1, "Row on dbA must exist");
    assert.strictEqual(rowB.length, 1, "Row on dbB must exist");
  });

  test("AC-B2-15: Anti-Poisoning on BEGIN IMMEDIATE Failure", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    // Mock activeDb.exec to throw on BEGIN IMMEDIATE
    const originalExec = dbA.exec.bind(dbA);
    let failBegin = true;
    (dbA as any).exec = function (sql: string) {
      if (failBegin && sql.includes("BEGIN IMMEDIATE")) {
        throw new Error("SQLITE_BUSY: simulated busy timeout failure on BEGIN");
      }
      return originalExec(sql);
    };

    assert.throws(
      () => {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(80, "Never Run", 100);
        }, dbA);
      },
      /SQLITE_BUSY/
    );

    // Crucial assertion: depth must NOT be poisoned to 1! It must remain 0!
    assert.strictEqual(getTransactionDepth(dbA), 0, "State must NOT be poisoned; depth remains 0");

    // Restore exec and verify subsequent transaction works normally
    failBegin = false;
    (dbA as any).exec = originalExec;

    const res = runInTransaction(() => {
      assert.strictEqual(getTransactionDepth(dbA), 1, "Subsequent transaction successfully acquires depth 1");
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(81, "Subsequent Healthy", 200);
      return "HEALTHY_RECOVERY";
    }, dbA);

    assert.strictEqual(res, "HEALTHY_RECOVERY");
    assert.strictEqual(getTransactionDepth(dbA), 0);
    const rows = dbA.prepare("SELECT * FROM items WHERE id = 81").all();
    assert.strictEqual(rows.length, 1, "Subsequent row must be committed normally");
  });

  test("TX-INFRA-03: Sequential Serialization Across Independent Connections (Supporting AC-B2-13)", () => {
    const dbA2 = new DatabaseSync(TEST_DB_PATH);
    dbA2.exec("PRAGMA journal_mode = WAL;");
    dbA2.exec("PRAGMA busy_timeout = 5000;");

    const executionLog: string[] = [];

    // Conn 1 starts a transaction and holds it briefly
    runInTransaction(() => {
      executionLog.push("conn1_start");
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(90, "Conn 1 Write", 100);

      // Verify Conn 2 cannot see Conn 1 uncommitted row in WAL mode
      const readConn2 = dbA2.prepare("SELECT COUNT(*) as cnt FROM items WHERE id = 90").get() as any;
      assert.strictEqual(readConn2.cnt, 0, "Conn 2 cannot see Conn 1 uncommitted row in WAL mode");

      executionLog.push("conn1_commit");
    }, dbA);

    // Conn 2 executes after Conn 1 committed
    runInTransaction(() => {
      executionLog.push("conn2_start");
      dbA2.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(91, "Conn 2 Write", 200);
      executionLog.push("conn2_commit");
    }, dbA2);

    assert.deepStrictEqual(executionLog, ["conn1_start", "conn1_commit", "conn2_start", "conn2_commit"]);

    const rows = dbA.prepare("SELECT * FROM items WHERE id IN (90, 91) ORDER BY id ASC").all() as any[];
    assert.strictEqual(rows.length, 2, "Both serialized writes must be present");

    dbA2.close();
  });

  test("TX-INFRA-04: Real Concurrent Writer Contention & Busy Timeout Delay (Supporting AC-B2-13)", () => {
    // Open a second independent connection to the same physical database file with a low busy_timeout
    const dbA2 = new DatabaseSync(TEST_DB_PATH);
    dbA2.exec("PRAGMA journal_mode = WAL;");
    dbA2.exec("PRAGMA busy_timeout = 250;"); // 250ms busy timeout

    // Connection 1 acquires BEGIN IMMEDIATE and holds write lock
    dbA.exec("BEGIN IMMEDIATE;");
    dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(100, "Held by Conn 1", 500);

    // Connection 2 attempts to acquire BEGIN IMMEDIATE via runInTransaction
    const startTime = Date.now();
    let conn2Error: any = null;

    try {
      runInTransaction(() => {
        dbA2.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(101, "Conn 2 Blocked", 600);
      }, dbA2);
    } catch (err: any) {
      conn2Error = err;
    }

    const elapsed = Date.now() - startTime;

    assert.ok(conn2Error !== null, "Conn 2 must fail due to lock contention while Conn 1 holds write lock");
    assert.match(conn2Error.message, /busy|locked/i, "Conn 2 error must indicate SQLITE_BUSY / database is locked");
    // Verify busy timeout actually waited ~250ms (giving 100ms margin for system jitter)
    assert.ok(elapsed >= 150, `Busy timeout must block for ~250ms before failing (measured: ${elapsed}ms)`);
    assert.strictEqual(getTransactionDepth(dbA2), 0, "Conn 2 transaction depth must remain 0 after busy failure");

    // Conn 1 now commits, releasing the reserved write lock
    dbA.exec("COMMIT;");

    // Conn 2 should now succeed cleanly with no contention
    const postContentionRes = runInTransaction(() => {
      dbA2.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(102, "Conn 2 Success Post-Contention", 700);
      return "CONN2_SUCCESS";
    }, dbA2);

    assert.strictEqual(postContentionRes, "CONN2_SUCCESS");
    assert.strictEqual(getTransactionDepth(dbA2), 0);

    const rows = dbA.prepare("SELECT * FROM items WHERE id IN (100, 101, 102) ORDER BY id ASC").all() as any[];
    assert.strictEqual(rows.length, 2, "Only Conn 1 and post-contention Conn 2 rows must exist");
    assert.strictEqual(rows[0].id, 100);
    assert.strictEqual(rows[1].id, 102);

    dbA2.close();
  });

  test("Failed COMMIT with Clean ROLLBACK Leaves Connection Healthy & Reusable", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    const originalExec = dbA.exec.bind(dbA);
    let failCommit = true;

    (dbA as any).exec = function (sql: string) {
      if (failCommit && sql.includes("COMMIT")) {
        throw new Error("SIMULATED_DISK_FULL_ON_COMMIT");
      }
      return originalExec(sql);
    };

    // runInTransaction fails on COMMIT, but executes ROLLBACK successfully
    assert.throws(
      () => {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(110, "Failed Commit Row", 999);
        }, dbA);
      },
      /SIMULATED_DISK_FULL_ON_COMMIT/
    );

    // Rollback succeeded, so connection is NOT quarantined
    assert.strictEqual(isConnectionCorrupted(dbA), false, "Connection must not be quarantined when rollback succeeds");
    assert.strictEqual(getTransactionDepth(dbA), 0, "Depth must be 0 after rollback");

    // Verify uncommitted row was indeed rolled back
    const rows = dbA.prepare("SELECT * FROM items WHERE id = 110").all();
    assert.strictEqual(rows.length, 0, "Row must not exist after rollback of failed commit");

    // Restore normal COMMIT behavior
    failCommit = false;
    (dbA as any).exec = originalExec;

    // Verify the connection is completely healthy and reusable
    const recoveryRes = runInTransaction(() => {
      dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(111, "Healthy Post-Rollback", 888);
      return "REUSED_CLEANLY";
    }, dbA);

    assert.strictEqual(recoveryRes, "REUSED_CLEANLY");
    assert.strictEqual(getTransactionDepth(dbA), 0);

    const rowAfter = dbA.prepare("SELECT * FROM items WHERE id = 111").all();
    assert.strictEqual(rowAfter.length, 1, "Subsequent transaction on reused connection must commit successfully");
  });

  test("Failed ROLLBACK Marks Connection Corrupted and Quarantines It from Reuse", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    const originalExec = dbA.exec.bind(dbA);
    let failRollback = true;

    (dbA as any).exec = function (sql: string) {
      if (failRollback && sql.includes("ROLLBACK")) {
        throw new Error("SIMULATED_FATAL_DEVICE_ERROR_ON_ROLLBACK");
      }
      return originalExec(sql);
    };

    assert.throws(
      () => {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(120, "Will Fail Rollback", 111);
          throw new Error("SIMULATED_APP_FAILURE_BEFORE_ROLLBACK");
        }, dbA);
      },
      /\[FATAL_TRANSACTION_ROLLBACK_FAILURE\]/
    );

    // Because ROLLBACK failed, the SQLite connection is in an unknown, un-terminated state
    assert.strictEqual(isConnectionCorrupted(dbA), true, "Connection must be quarantined in _corruptedConnections");

    // Attempting to reuse this connection MUST immediately fail with FATAL_TRANSACTION_CORRUPTION
    assert.throws(
      () => {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(121, "Never Reached", 222);
        }, dbA);
      },
      /\[FATAL_TRANSACTION_CORRUPTION\]/
    );

    // Restore exec just to close safely
    (dbA as any).exec = originalExec;
  });

  test("Nested Transaction RELEASE SAVEPOINT Failure Causes Connection Quarantine", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    const originalExec = dbA.exec.bind(dbA);
    let failReleaseSavepoint = true;

    (dbA as any).exec = function (sql: string) {
      if (failReleaseSavepoint && sql.includes("RELEASE SAVEPOINT")) {
        throw new Error("SIMULATED_RELEASE_SAVEPOINT_FAILURE");
      }
      return originalExec(sql);
    };

    assert.throws(
      () => {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(130, "Outer 130", 100);

          runInTransaction(() => {
            dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(131, "Inner 131", 200);
          }, dbA);
        }, dbA);
      },
      /SIMULATED_RELEASE_SAVEPOINT_FAILURE/
    );

    assert.strictEqual(isConnectionCorrupted(dbA), true, "Connection must be quarantined when RELEASE SAVEPOINT fails");

    // Attempt to reuse
    assert.throws(
      () => {
        runInTransaction(() => {}, dbA);
      },
      /\[FATAL_TRANSACTION_CORRUPTION\]/
    );

    (dbA as any).exec = originalExec;
  });

  test("Nested Transaction ROLLBACK TO SAVEPOINT Failure Causes Connection Quarantine", () => {
    assert.strictEqual(getTransactionDepth(dbA), 0);

    const originalExec = dbA.exec.bind(dbA);
    let failSavepointRollback = true;

    (dbA as any).exec = function (sql: string) {
      if (failSavepointRollback && sql.includes("ROLLBACK TO SAVEPOINT")) {
        throw new Error("SIMULATED_SAVEPOINT_ROLLBACK_FAILURE");
      }
      return originalExec(sql);
    };

    assert.throws(
      () => {
        runInTransaction(() => {
          dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(140, "Outer 140", 100);

          runInTransaction(() => {
            dbA.prepare("INSERT INTO items (id, name, val) VALUES (?, ?, ?)").run(141, "Inner 141", 200);
            throw new Error("APP_ERROR_TRIGGERING_SAVEPOINT_ROLLBACK");
          }, dbA);
        }, dbA);
      },
      /APP_ERROR_TRIGGERING_SAVEPOINT_ROLLBACK/
    );

    assert.strictEqual(isConnectionCorrupted(dbA), true, "Connection must be quarantined when ROLLBACK TO SAVEPOINT fails");

    // Attempt to reuse
    assert.throws(
      () => {
        runInTransaction(() => {}, dbA);
      },
      /\[FATAL_TRANSACTION_CORRUPTION\]/
    );

    (dbA as any).exec = originalExec;
  });
});
