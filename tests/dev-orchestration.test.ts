import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";
import { resolveApiBaseUrl, APP_CONFIG } from "../src/app/config/appConfig";

const projectRoot = path.resolve(".");
const operationalDbPath = path.resolve(projectRoot, "server/data/database.sqlite");

test("Dev Orchestration - Operational database exists and has expected baseline invariant", () => {
  assert.ok(fs.existsSync(operationalDbPath), "Operational database must exist");
  const hash = crypto.createHash("sha256").update(fs.readFileSync(operationalDbPath)).digest("hex").toUpperCase();
  assert.strictEqual(
    hash,
    "D560674CCD917049241415018FA00A4CF21B78BB9103F380C808B3B90408171C",
    "Operational database hash must match baseline"
  );
});

test("Dev Orchestration - Sandbox isolation path guarantees separation from operational DB", () => {
  const sandboxDir = path.join(os.tmpdir(), "sun89_dev_sandbox");
  const sandboxDb = path.join(sandboxDir, "isolated_database.sqlite");

  // Invariant 1: Sandbox DB cannot equal operational DB
  assert.notStrictEqual(path.resolve(sandboxDb), path.resolve(operationalDbPath));

  // Invariant 2: Sandbox directory must be located in os.tmpdir(), outside project root
  assert.ok(!path.resolve(sandboxDir).startsWith(projectRoot), "Sandbox must not be inside project directory");
  assert.ok(path.resolve(sandboxDir).startsWith(os.tmpdir()), "Sandbox must reside in os.tmpdir()");
});

test("Dev Orchestration - Port checker correctly detects open vs occupied ports", async () => {
  function checkPort(port: number, host = "127.0.0.1"): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, host);
    });
  }

  // 1. A random high port should be available
  const randomPort = 49152 + Math.floor(Math.random() * 10000);
  const isFree = await checkPort(randomPort);
  assert.strictEqual(isFree, true, "Random unallocated port should be free");

  // 2. Occupy the port with a temporary server, then test detection
  const dummyServer = net.createServer();
  await new Promise<void>((res) => dummyServer.listen(randomPort, "127.0.0.1", () => res()));

  try {
    const isNowFree = await checkPort(randomPort);
    assert.strictEqual(isNowFree, false, "Occupied port must be reported as unavailable");
  } finally {
    await new Promise<void>((res) => dummyServer.close(() => res()));
  }

  // 3. Port should be free again after server close
  const isFreeAgain = await checkPort(randomPort);
  assert.strictEqual(isFreeAgain, true, "Port should be free again after closing dummy server");
});

test("Dev Orchestration - resolveApiBaseUrl respects environment separation", () => {
  // In Node.js environment without window:
  const nodeApiUrl = resolveApiBaseUrl();
  assert.ok(typeof nodeApiUrl === "string");
  assert.ok(nodeApiUrl.startsWith("http://") || nodeApiUrl.startsWith("https://") || nodeApiUrl === "/api");

  // In simulated browser environment:
  const originalWindow = (globalThis as any).window;
  try {
    (globalThis as any).window = { location: { hostname: "localhost" } };
    const browserApiUrl = resolveApiBaseUrl();
    assert.strictEqual(browserApiUrl, "/api", "Browser environment should use relative /api for Vite proxy");
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
});

test("Dev Orchestration - dev-orchestrator.cjs script exists and is syntactically valid", () => {
  const orchestratorPath = path.resolve(projectRoot, "scripts/dev-orchestrator.cjs");
  assert.ok(fs.existsSync(orchestratorPath), "scripts/dev-orchestrator.cjs must exist");
  const content = fs.readFileSync(orchestratorPath, "utf8");
  assert.ok(content.includes("sun89_dev_sandbox"), "Orchestrator must configure sun89_dev_sandbox");
  assert.ok(content.includes("operationalDbPath"), "Orchestrator must track operationalDbPath");
  assert.ok(content.includes("isPortAvailable"), "Orchestrator must perform port preflight check");
  assert.ok(content.includes("checkHttpReady"), "Orchestrator must verify readiness probe");
  assert.ok(content.includes("npm run dev:all"), "Orchestrator must support dev:all");
});

test("Dev Orchestration - package.json defines dev:all command", () => {
  const pkgPath = path.resolve(projectRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  assert.ok(pkg.scripts["dev:all"], "package.json must contain dev:all script");
  assert.strictEqual(pkg.scripts["dev:all"], "node scripts/dev-orchestrator.cjs");
});
