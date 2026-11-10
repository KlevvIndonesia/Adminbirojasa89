const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "..");
const operationalDbPath = path.resolve(projectRoot, "server/data/database.sqlite");

const sandboxDir = path.join(os.tmpdir(), "sun89_browser_sandbox");
const sandboxDb = path.join(sandboxDir, "isolated_database.sqlite");
const sandboxUploads = path.join(sandboxDir, "uploads");
const sandboxBackups = path.join(sandboxDir, "backups");

// Hard Safety Guard
if (path.resolve(sandboxDb) === operationalDbPath) {
  console.error("\x1b[31m[FATAL SAFETY GUARD] Sandbox database path points to operational database!\x1b[0m");
  process.exit(1);
}

fs.mkdirSync(sandboxDir, { recursive: true });
fs.mkdirSync(sandboxUploads, { recursive: true });
fs.mkdirSync(sandboxBackups, { recursive: true });

if (!fs.existsSync(sandboxDb) || fs.statSync(sandboxDb).size === 0) {
  if (fs.existsSync(operationalDbPath)) {
    console.log("[SANDBOX SERVER] Initializing isolated database from operational baseline...");
    fs.copyFileSync(operationalDbPath, sandboxDb);
  }
}

const env = {
  ...process.env,
  PORT: "3001",
  NODE_ENV: "development",
  DB_PATH: sandboxDb,
  UPLOAD_DIR: sandboxUploads,
  BACKUP_DIR: sandboxBackups,
  ALLOW_OPERATIONAL_WRITE: "true",
  SUN89_SERVER_RUNNING: "true",
};

console.log("[SANDBOX SERVER] Launching backend with DB_PATH:", sandboxDb);

const child = spawn("npx", ["--prefer-offline", "tsx", "server/src/server.ts"], {
  stdio: "inherit",
  env,
  shell: true,
});

child.on("exit", (code, signal) => {
  console.log(`[SANDBOX SERVER] Exited with code ${code}, signal ${signal}`);
  process.exit(code || 0);
});
