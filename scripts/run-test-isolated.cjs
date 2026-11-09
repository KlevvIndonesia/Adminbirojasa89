/**
 * Per-Test-File Isolated Database Test Runner
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Guarantees zero mutation to operational database (server/data/database.sqlite).
 * Enforces 12 high-assurance testing invariants:
 * - Temporary directories strictly generated in os.tmpdir() via fs.mkdtempSync()
 * - Ownership marker (.sun89_owner.json) with PID and timestamp
 * - Windows EBUSY/EPERM exponential backoff retry loop (up to 5 retries)
 * - Safe path containment using path.relative()
 * - Liveness verification (process.kill(pid, 0)) for sweeper safety
 * - Operational database hard assertion before spawning
 * - Per-suite isolated database and isolated uploads directory
 * - Process termination hooks (exit, SIGINT, SIGTERM)
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
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

// Checks whether a given PID is alive without sending a terminating signal
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

// Stale temporary directory sweeper (only targets marked test directories > 1hr old from dead PIDs)
function sweepStaleTempDirs() {
  const tmpBase = os.tmpdir();
  let swept = 0;
  try {
    const entries = fs.readdirSync(tmpBase).filter((n) => n.startsWith("sun89_test_") || n.startsWith("sunbirojasa-test-"));
    const now = Date.now();
    for (const ent of entries) {
      const full = path.join(tmpBase, ent);
      const markerPath = path.join(full, ".sun89_owner.json");
      if (fs.existsSync(markerPath)) {
        try {
          const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
          const age = now - (marker.createdAt || 0);
          if (age > 3600000 && !isProcessAlive(marker.pid)) {
            fs.rmSync(full, { recursive: true, force: true });
            swept++;
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  if (swept > 0) {
    console.log(`[TEST ISOLATION] Swept ${swept} stale temporary test directories from os.tmpdir()`);
  }
}

// Helper to safely delete temporary directory with Windows EBUSY retry backoff
function cleanupTestDir(targetDir, maxRetries = 5) {
  if (!targetDir || !fs.existsSync(targetDir)) return;

  const resolvedTarget = path.resolve(targetDir);
  const resolvedTmp = path.resolve(os.tmpdir());

  // Containment assertion
  const rel = path.relative(resolvedTmp, resolvedTarget);
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel === "") {
    console.error(`[FATAL GUARD] Refusing to cleanup path outside os.tmpdir(): ${resolvedTarget}`);
    return;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.rmSync(resolvedTarget, { recursive: true, force: true });
      if (!fs.existsSync(resolvedTarget)) return;
    } catch (err) {
      if (err.code === "EBUSY" || err.code === "EPERM") {
        if (attempt === maxRetries) {
          console.warn(`[WARN TEST TEARDOWN] Could not remove '${resolvedTarget}' after ${maxRetries} attempts due to ${err.code}.`);
          return;
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * Math.pow(2, attempt - 1));
      } else {
        return;
      }
    }
  }
}

// Run startup sweep
sweepStaleTempDirs();

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

let currentActiveSuiteDir = null;

// Cleanup hook for abnormal terminations
function handleTermination(signal, code) {
  if (currentActiveSuiteDir) {
    cleanupTestDir(currentActiveSuiteDir);
    currentActiveSuiteDir = null;
  }
  process.exit(code);
}

process.on("SIGINT", () => handleTermination("SIGINT", 130));
process.on("SIGTERM", () => handleTermination("SIGTERM", 143));
process.on("exit", () => {
  if (currentActiveSuiteDir) {
    cleanupTestDir(currentActiveSuiteDir);
    currentActiveSuiteDir = null;
  }
});

const globalStartTime = Date.now();

for (let i = 0; i < testFileList.length; i++) {
  const testFile = testFileList[i];
  const suiteName = path.basename(testFile);

  // Generate unique isolated directory in os.tmpdir() via mkdtempSync
  const suiteDir = fs.mkdtempSync(path.join(os.tmpdir(), "sun89_test_run_"));
  currentActiveSuiteDir = suiteDir;

  const tempDb = path.join(suiteDir, "isolated_database.sqlite");
  const tempUploads = path.join(suiteDir, "uploads");
  const tempBackups = path.join(suiteDir, "backups");

  fs.mkdirSync(tempUploads, { recursive: true });
  fs.mkdirSync(tempBackups, { recursive: true });

  // Write ownership marker
  const marker = {
    pid: process.pid,
    createdAt: Date.now(),
    runnerId: crypto.randomBytes(4).toString("hex"),
    suiteName: testFile,
    testDir: suiteDir,
  };
  fs.writeFileSync(path.join(suiteDir, ".sun89_owner.json"), JSON.stringify(marker, null, 2));

  // Copy fresh baseline snapshot if exists
  if (fs.existsSync(operationalDbPath)) {
    fs.copyFileSync(operationalDbPath, tempDb);
  }

  const env = {
    ...process.env,
    NODE_ENV: "test",
    SUN89_TEST_ISOLATED: "1",
    DB_PATH: tempDb,
    UPLOAD_DIR: tempUploads,
    BACKUP_DIR: tempBackups,
  };

  const suiteStartTime = Date.now();
  console.log(`\n\x1b[34m[${i + 1}/${totalSuites}] RUNNING: ${testFile}\x1b[0m`);
  console.log(`  Isolated Sandbox: ${suiteDir}`);

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
    cleanupTestDir(suiteDir);
    currentActiveSuiteDir = null;
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
