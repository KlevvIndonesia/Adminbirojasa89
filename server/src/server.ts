/**
 * Express Server Runner with Graceful Shutdown
 * Admin SUN89 — Biro Jasa Management System
 */

import { createApp } from "./app";
import { CONFIG } from "./config/env";
import { closeDb, initDatabase } from "./database/db";

// Official Server Startup: validate environment fail-fast BEFORE database initialization
CONFIG.validate();

// Official Server Startup: explicitly initialize database and schema
initDatabase({ runSchema: true, allowOperationalWrite: true });

const app = createApp();

const server = app.listen(CONFIG.PORT, () => {
  console.log(`[SUN89 Backend] Server started successfully.`);
  console.log(`[SUN89 Backend] Version: 1.0.0 (Phase 7.7 Baseline)`);
  console.log(`[SUN89 Backend] Environment: ${CONFIG.NODE_ENV}`);
  console.log(`[SUN89 Backend] Listening port: ${CONFIG.PORT}`);
  console.log(`[SUN89 Backend] Database path: ${CONFIG.DB_PATH}`);
  console.log(`[SUN89 Backend] Uploads storage: ${CONFIG.UPLOAD_DIR}`);
  console.log(`[SUN89 Backend] Backups directory: ${CONFIG.BACKUP_DIR}`);
  console.log(`[SUN89 Backend] Liveness probe: http://localhost:${CONFIG.PORT}/api/health/live`);
  console.log(`[SUN89 Backend] Readiness probe: http://localhost:${CONFIG.PORT}/api/health/ready`);
});

// Graceful Shutdown Handling (Milestone 17)
function handleShutdown(signal: string) {
  console.log(`[SUN89 Backend] Received ${signal}. Starting graceful shutdown...`);

  const forceTimeout = setTimeout(() => {
    console.error("[SUN89 Backend] Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
  forceTimeout.unref();

  server.close((err) => {
    if (err) {
      console.error("[SUN89 Backend] Error closing HTTP server:", err);
      process.exit(1);
    }
    console.log("[SUN89 Backend] HTTP server closed cleanly.");
    closeDb();
    process.exit(0);
  });
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export { app, server };
