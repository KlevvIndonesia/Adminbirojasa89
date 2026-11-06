/**
 * Per-Test-File Isolated Database Test Runner
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Guarantees zero mutation to operational database (server/data/database.sqlite).
 * Enforces per-test-file database isolation:
 * Every test file receives its own pristine temporary SQLite database snapshot
 * copied from the operational database baseline, completely preventing cross-suite
 * state contamination and destructive interference.
 * 
 * Cleans up temporary databases immediately after each suite completes or terminates.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const operationalDbPath = path.resolve(projectRoot, "server/data/database.sqlite");

// Hard safety guard: refuse if user or environment explicitly points DB_PATH to operational DB
if (process.env.DB_PATH && path.resolve(process.env.DB_PATH) === operationalDbPath) {
  console.error("\x1b[31m[FATAL TEST SAFETY GUARD] DB_PATH explicitly points to operational database!\x1b[0m");
  console.error("Operational DB path:", operationalDbPath);
  console.error("Execution aborted to protect operational database integrity.");
  process.exit(1);
}

// Function to resolve test files from arguments or scan tests/ directory
function resolveTestFiles(args) {
  if (args.length === 0 || (args.length === 1 && (args[0] === "tests/**/*.test.ts" || args[0] === "tests/*.test.ts"))) {
    const testsDir = path.resolve(projectRoot, "tests");
    if (!fs.existsSync(testsDir)) return [];
    return fs
      .readdirSync(testsDir)
      .filter((f) => f.endsWith(".test.ts"))
      .sort()
      .map((f) => path.join("tests", f));
  }

  const resolved = [];
  for (const arg of args) {
    if (arg.includes("*")) {
      // Simple glob expansion for tests/*.test.ts or tests/**/*.test.ts
      const testsDir = path.resolve(projectRoot, "tests");
      if (fs.existsSync(testsDir)) {
        const matches = fs
          .readdirSync(testsDir)
          .filter((f) => f.endsWith(".test.ts"))
          .sort()
          .map((f) => path.join("tests", f));
        resolved.push(...matches);
      }
    } else {
      resolved.push(arg);
    }
  }
  return [...new Set(resolved)];
}

// Helper to safely delete an ephemeral test db and WAL/SHM files
function cleanupDb(dbPath) {
  if (!dbPath) return;
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + "-wal")) fs.unlinkSync(dbPath + "-wal");
    if (fs.existsSync(dbPath + "-shm")) fs.unlinkSync(dbPath + "-shm");
  } catch (_) {}
}

const rawArgs = process.argv.slice(2);
const testFileList = resolveTestFiles(rawArgs);

if (testFileList.length === 0) {
  console.error("[TEST ISOLATION] No test files found to execute.");
  process.exit(1);
}

console.log(`\x1b[36m[TEST ISOLATION] Per-Test-File Isolation Mode Active: ${testFileList.length} suite(s) scheduled\x1b[0m`);
console.log(`[TEST ISOLATION] Operational database: ${operationalDbPath}`);

let totalSuites = testFileList.length;
let passedSuites = 0;
let failedSuites = 0;
const suiteResults = [];
let overallExitCode = 0;

let currentActiveDb = null;

// Cleanup hook for abnormal terminations
function handleTermination(signal, code) {
  if (currentActiveDb) {
    cleanupDb(currentActiveDb);
    currentActiveDb = null;
  }
  process.exit(code);
}

process.on("SIGINT", () => handleTermination("SIGINT", 130));
process.on("SIGTERM", () => handleTermination("SIGTERM", 143));

const globalStartTime = Date.now();

for (let i = 0; i < testFileList.length; i++) {
  const testFile = testFileList[i];
  const suiteName = path.basename(testFile);
  const tempDb = path.join(
    os.tmpdir(),
    `sunbirojasa-test-db-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}.sqlite`
  );
  currentActiveDb = tempDb;

  // Copy fresh baseline snapshot
  if (fs.existsSync(operationalDbPath)) {
    fs.copyFileSync(operationalDbPath, tempDb);
  }

  const env = {
    ...process.env,
    NODE_ENV: "test",
    DB_PATH: tempDb,
  };

  const suiteStartTime = Date.now();
  console.log(`\n\x1b[34m[${i + 1}/${totalSuites}] RUNNING: ${testFile}\x1b[0m`);
  console.log(`  Isolated DB: ${tempDb}`);

  let suiteStatus = 0;
  try {
    const result = spawnSync("npx", ["--prefer-offline", "tsx", "--test", testFile], {
      stdio: "inherit",
      env,
      shell: true,
    });
    suiteStatus = result.status ?? (result.error ? 1 : 0);
  } catch (err) {
    console.error(`[TEST ISOLATION] Failed to spawn runner for ${testFile}:`, err);
    suiteStatus = 1;
  } finally {
    cleanupDb(tempDb);
    currentActiveDb = null;
  }

  const suiteDuration = ((Date.now() - suiteStartTime) / 1000).toFixed(2);

  if (suiteStatus === 0) {
    passedSuites++;
    console.log(`\x1b[32m  ✓ PASS: ${suiteName} (${suiteDuration}s)\x1b[0m`);
    suiteResults.push({ file: testFile, status: "PASS", duration: suiteDuration });
  } else {
    failedSuites++;
    overallExitCode = 1;
    console.log(`\x1b[31m  ✗ FAIL: ${suiteName} (${suiteDuration}s, exit: ${suiteStatus})\x1b[0m`);
    suiteResults.push({ file: testFile, status: "FAIL", duration: suiteDuration });
  }
}

const totalDuration = ((Date.now() - globalStartTime) / 1000).toFixed(2);

console.log("\n========================================================");
console.log("            TEST SUITE ISOLATION SUMMARY                ");
console.log("========================================================");
console.log(`Total Suites : ${totalSuites}`);
console.log(`Passed       : ${passedSuites}`);
console.log(`Failed       : ${failedSuites}`);
console.log(`Duration     : ${totalDuration}s`);
console.log("========================================================");

if (failedSuites > 0) {
  console.log("\x1b[31mFailed Suites:\x1b[0m");
  for (const res of suiteResults.filter((r) => r.status === "FAIL")) {
    console.log(` - \x1b[31m${res.file}\x1b[0m (${res.duration}s)`);
  }
} else {
  console.log("\x1b[32mAll test suites completed successfully with 100% database isolation!\x1b[0m");
}

process.exit(overallExitCode);
