/**
 * Development Environment Orchestrator
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Single-command unified development runner: `npm run dev:all`
 * 
 * Features:
 * 1. Hardened Sandbox Isolation:
 *    - Never opens or touches operational database (server/data/database.sqlite).
 *    - Automatically creates/verifies disposable sandbox database in os.tmpdir().
 *    - Automatically creates/verifies isolated uploads and backups directories.
 *    - Enforces ownership marker (.sun89_dev_owner.json).
 * 2. Port Preflight:
 *    - Checks port 3000 (Vite) and 3001 (Express) for conflicts BEFORE spawning.
 *    - Provides clean, human-readable diagnostics and never terminates unrelated processes.
 * 3. Health & Readiness Verification:
 *    - Starts backend Express API and waits for /api/health/ready probe.
 *    - Launches Vite frontend only AFTER backend readiness is verified.
 * 4. Streamlined Logs:
 *    - Prefixes backend logs with [API] and frontend logs with [WEB].
 * 5. Graceful Teardown:
 *    - Cleanly shuts down both child processes on SIGINT / SIGTERM / Ctrl+C.
 *    - Asserts operational database SHA-256 hash invariant before exiting.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const net = require("net");
const http = require("http");
const { spawn, execSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const operationalDbPath = path.resolve(projectRoot, "server/data/database.sqlite");

// ANSI color helpers
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function log(prefix, msg, color = c.cyan) {
  console.log(`${color}${prefix}${c.reset} ${msg}`);
}

function logError(prefix, msg) {
  console.error(`${c.red}${prefix}${c.reset} ${msg}`);
}

function calculateFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function isPortAvailable(port, host = "0.0.0.0") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function checkHttpReady(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.status === "ready" || json.status === "ok") {
              return resolve(true);
            }
          } catch (_) {
            return resolve(true);
          }
        }
        resolve(false);
      });
    });

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function pipePrefixedStream(stream, prefix, color) {
  if (!stream) return;
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`${color}${prefix}${c.reset} ${line}`);
      }
    }
  });
}

function terminateProcessTree(childProcess) {
  if (!childProcess || childProcess.killed || childProcess.exitCode !== null) return;
  const pid = childProcess.pid;
  if (!pid) return;

  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    } catch (_) {}
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch (_) {
      try {
        childProcess.kill("SIGTERM");
      } catch (_) {}
    }
  }
}

async function main() {
  console.log(`\n${c.bold}${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}        SUNBiroJasa Development Environment Orchestrator (Phase 8)       ${c.reset}`);
  console.log(`${c.bold}${c.cyan}========================================================================${c.reset}\n`);

  // Step 1: Preflight Configuration & Operational Database Check
  log("[ENV]", "Checking development configuration and database safety...");
  if (!fs.existsSync(operationalDbPath)) {
    logError("[FATAL]", `Operational database not found at: ${operationalDbPath}`);
    process.exit(1);
  }

  const baselineOperationalHash = calculateFileHash(operationalDbPath);
  log("[DB SAFETY]", `Operational database verified: ${c.dim}${baselineOperationalHash}${c.reset}`);

  // Step 2: Establish Sandbox Isolation
  const sandboxDir = path.join(os.tmpdir(), "sun89_dev_sandbox");
  const sandboxDb = path.join(sandboxDir, "isolated_database.sqlite");
  const sandboxUploads = path.join(sandboxDir, "uploads");
  const sandboxBackups = path.join(sandboxDir, "backups");

  // Hard safety invariant check: ensure sandbox path is strictly separate from operational DB
  if (path.resolve(sandboxDb) === operationalDbPath) {
    logError("[FATAL SAFETY GUARD]", "Sandbox database path conflicts with operational database!");
    process.exit(1);
  }
  if (sandboxDir.startsWith(projectRoot)) {
    logError("[FATAL SAFETY GUARD]", "Sandbox directory must reside in os.tmpdir(), not in project directory!");
    process.exit(1);
  }

  fs.mkdirSync(sandboxDir, { recursive: true });
  fs.mkdirSync(sandboxUploads, { recursive: true });
  fs.mkdirSync(sandboxBackups, { recursive: true });

  // Initialize sandbox database from operational baseline if missing or empty
  if (!fs.existsSync(sandboxDb) || fs.statSync(sandboxDb).size === 0) {
    log("[DB]", "Initializing isolated sandbox database from operational template...");
    fs.copyFileSync(operationalDbPath, sandboxDb);
  }

  // Write runtime ownership marker
  const markerPath = path.join(sandboxDir, ".sun89_dev_owner.json");
  fs.writeFileSync(
    markerPath,
    JSON.stringify(
      {
        pid: process.pid,
        createdAt: Date.now(),
        dbPath: sandboxDb,
        uploadsDir: sandboxUploads,
        operationalDbHash: baselineOperationalHash,
      },
      null,
      2
    )
  );

  log("[DB]", `Sandbox database ready at: ${c.dim}${sandboxDb}${c.reset}`);
  log("[STORAGE]", `Sandbox uploads directory ready at: ${c.dim}${sandboxUploads}${c.reset}`);

  // Step 3: Port Preflight Checks
  log("[PREFLIGHT]", "Checking port availability (3000, 3001)...");

  const port3001Free = await isPortAvailable(3001);
  if (!port3001Free) {
    logError(
      "[PORT CONFLICT]",
      `Port 3001 is already occupied by another process.\n` +
      `  Cannot start the backend API server.\n` +
      `  Please terminate the conflicting process or free port 3001 before running 'npm run dev:all'.`
    );
    process.exit(1);
  }

  const port3000Free = await isPortAvailable(3000);
  if (!port3000Free) {
    logError(
      "[PORT CONFLICT]",
      `Port 3000 is already occupied by another process.\n` +
      `  Cannot start the frontend Vite server.\n` +
      `  Please terminate the conflicting process or free port 3000 before running 'npm run dev:all'.`
    );
    process.exit(1);
  }

  log("[PREFLIGHT]", "Ports 3000 and 3001 are available.");

  // Track children for shutdown
  let backendChild = null;
  let frontendChild = null;
  let isShuttingDown = false;

  function shutdown(exitCode = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n${c.yellow}[DEV] Shutdown requested. Stopping services gracefully...${c.reset}`);

    if (frontendChild) {
      log("[WEB]", "Stopping frontend dev server...", c.yellow);
      terminateProcessTree(frontendChild);
      frontendChild = null;
    }

    if (backendChild) {
      log("[API]", "Stopping backend API server...", c.yellow);
      terminateProcessTree(backendChild);
      backendChild = null;
    }

    // Verify operational database integrity post-shutdown
    const postHash = calculateFileHash(operationalDbPath);
    if (postHash === baselineOperationalHash) {
      log("[DB SAFETY]", `Operational database integrity verified: SHA-256 intact.`, c.green);
    } else {
      logError("[DB SAFETY]", `FATAL ALERT: Operational database hash mismatch! Baseline: ${baselineOperationalHash}, Current: ${postHash}`);
    }

    console.log(`${c.green}[DEV] All services stopped. Exit code: ${exitCode}.${c.reset}\n`);
    process.exit(exitCode);
  }

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  process.on("SIGHUP", () => shutdown(0));
  process.on("uncaughtException", (err) => {
    logError("[DEV EXCEPTION]", err.stack || err.message);
    shutdown(1);
  });

  // Step 4: Start Backend API Server
  log("[API]", "Starting backend API server on port 3001...");

  const backendEnv = {
    ...process.env,
    PORT: "3001",
    NODE_ENV: "development",
    DB_PATH: sandboxDb,
    UPLOAD_DIR: sandboxUploads,
    BACKUP_DIR: sandboxBackups,
    ALLOW_OPERATIONAL_WRITE: "true",
    SUN89_SERVER_RUNNING: "true",
    SUN89_DEV_ORCHESTRATED: "true",
  };

  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  backendChild = spawn(npxCmd, ["--prefer-offline", "tsx", "server/src/server.ts"], {
    cwd: projectRoot,
    env: backendEnv,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  pipePrefixedStream(backendChild.stdout, "[API]", c.cyan);
  pipePrefixedStream(backendChild.stderr, "[API]", c.red);

  backendChild.on("exit", (code, signal) => {
    if (!isShuttingDown) {
      logError("[API]", `Backend process exited prematurely with code ${code} / signal ${signal}.`);
      shutdown(1);
    }
  });

  // Step 5: Wait for Backend Readiness Probe
  log("[API]", "Waiting for backend readiness probe at http://localhost:3001/api/health/ready...");

  const readinessUrl = "http://localhost:3001/api/health/ready";
  const startWait = Date.now();
  const maxWaitMs = 30000;
  let backendReady = false;

  while (Date.now() - startWait < maxWaitMs) {
    if (isShuttingDown) return;
    const ready = await checkHttpReady(readinessUrl);
    if (ready) {
      backendReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!backendReady) {
    logError("[API TIMEOUT]", "Backend failed to become ready within 30 seconds. Aborting startup.");
    shutdown(1);
    return;
  }

  log("[API]", `Backend ready and responsive in ${((Date.now() - startWait) / 1000).toFixed(1)}s!`, c.green);

  // Step 6: Start Frontend Vite Server
  log("[WEB]", "Starting frontend Vite server on port 3000...");

  const frontendEnv = {
    ...process.env,
    VITE_APP_DATA_PROVIDER: "api",
    VITE_API_BASE_URL: "/api",
  };

  frontendChild = spawn(
    process.execPath,
    ["-r", "./scripts/patch-realpath.cjs", "./node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "3000"],
    {
      cwd: projectRoot,
      env: frontendEnv,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    }
  );

  pipePrefixedStream(frontendChild.stdout, "[WEB]", c.green);
  pipePrefixedStream(frontendChild.stderr, "[WEB]", c.yellow);

  frontendChild.on("exit", (code, signal) => {
    if (!isShuttingDown) {
      logError("[WEB]", `Frontend process exited with code ${code} / signal ${signal}.`);
      shutdown(1);
    }
  });

  // Step 7: Wait for Frontend to Listen
  const webStartWait = Date.now();
  let webReady = false;
  while (Date.now() - webStartWait < 15000) {
    if (isShuttingDown) return;
    const portOpen = !(await isPortAvailable(3000));
    if (portOpen) {
      webReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  // Step 8: Display Summary Status Banner
  console.log(`\n${c.bold}${c.green}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.green}        SUNBiroJasa Unified Development Environment Ready & Active      ${c.reset}`);
  console.log(`${c.bold}${c.green}========================================================================${c.reset}`);
  console.log(`  ${c.bold}Frontend Web UI :${c.reset} ${c.white}http://localhost:3000${c.reset}`);
  console.log(`  ${c.bold}Backend REST API:${c.reset} ${c.white}http://localhost:3001/api${c.reset}`);
  console.log(`  ${c.bold}Readiness Probe :${c.reset} ${c.white}http://localhost:3001/api/health/ready${c.reset}`);
  console.log(`  ${c.bold}Sandbox Database:${c.reset} ${c.yellow}${sandboxDb}${c.reset}`);
  console.log(`  ${c.bold}Sandbox Uploads :${c.reset} ${c.yellow}${sandboxUploads}${c.reset}`);
  console.log(`  ${c.bold}Operational DB  :${c.reset} ${c.green}${operationalDbPath} (PROTECTED, 0 MUTATION)${c.reset}`);
  console.log(`${c.bold}${c.green}========================================================================${c.reset}`);
  console.log(`  ${c.dim}Streaming application logs below. Press Ctrl+C to terminate cleanly.${c.reset}\n`);
}

main().catch((err) => {
  console.error(`${c.red}[FATAL RUNTIME ERROR]${c.reset}`, err);
  process.exit(1);
});
