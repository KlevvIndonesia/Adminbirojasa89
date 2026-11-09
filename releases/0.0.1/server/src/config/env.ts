/**
 * Backend Environment Configuration & Production Validator
 * Admin SUN89 — Biro Jasa Management System
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Project root is 3 levels up from server/src/config
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, "../../..");
export const PROJECT_ROOT = process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT) : DEFAULT_PROJECT_ROOT;

/**
 * Deterministic .env loader based on verified project root
 * Priorities:
 * 1. process.env.ENV_FILE (if specified, must exist or throws)
 * 2. <PROJECT_ROOT>/.env
 * 3. <PROJECT_ROOT>/server/.env
 */
export function loadEnvironmentFile(): { loaded: boolean; sourcePath?: string } {
  if (typeof (process as any).loadEnvFile !== "function") {
    return { loaded: false };
  }

  // 1. Explicitly configured ENV_FILE path has highest file priority
  if (process.env.ENV_FILE && process.env.ENV_FILE.trim()) {
    const customPath = path.isAbsolute(process.env.ENV_FILE)
      ? path.resolve(process.env.ENV_FILE)
      : path.resolve(PROJECT_ROOT, process.env.ENV_FILE);
    if (!fs.existsSync(customPath)) {
      throw new Error(`FATAL CONFIGURATION: Specified ENV_FILE path does not exist: ${customPath}`);
    }
    try {
      (process as any).loadEnvFile(customPath);
      return { loaded: true, sourcePath: customPath };
    } catch (err: any) {
      throw new Error(`FATAL CONFIGURATION: Failed to load specified ENV_FILE '${customPath}': ${err?.message || err}`);
    }
  }

  // 2. Deterministic Root .env check
  const rootEnvPath = path.resolve(PROJECT_ROOT, ".env");
  if (fs.existsSync(rootEnvPath)) {
    try {
      (process as any).loadEnvFile(rootEnvPath);
      return { loaded: true, sourcePath: rootEnvPath };
    } catch (err: any) {
      throw new Error(`FATAL CONFIGURATION: Error parsing root .env file at '${rootEnvPath}': ${err?.message || err}`);
    }
  }

  // 3. Fallback: server/.env check
  const serverEnvPath = path.resolve(PROJECT_ROOT, "server/.env");
  if (fs.existsSync(serverEnvPath)) {
    try {
      (process as any).loadEnvFile(serverEnvPath);
      return { loaded: true, sourcePath: serverEnvPath };
    } catch (err: any) {
      throw new Error(`FATAL CONFIGURATION: Error parsing server .env file at '${serverEnvPath}': ${err?.message || err}`);
    }
  }

  return { loaded: false };
}

// Automatically load environment deterministically
loadEnvironmentFile();

export function resolveConfigPath(configuredPath: string | undefined, defaultRelative: string): string {
  if (!configuredPath || configuredPath.trim() === "") {
    return path.resolve(PROJECT_ROOT, defaultRelative);
  }
  return path.isAbsolute(configuredPath) ? path.resolve(configuredPath) : path.resolve(PROJECT_ROOT, configuredPath);
}

export const DEFAULT_DEV_JWT = "sun89-secure-birojasa-secret-key-2026";

export const INSECURE_PLACEHOLDERS = [
  "sun89-secure-birojasa-secret-key-2026",
  "sun89-change-this-in-production-secret-token-key-2026",
  "change-me-in-production-secret-key-32chars",
  "12345678901234567890123456789012",
  "your-production-jwt-secret-key-here",
  "replace-with-a-secure-random-secret",
  "dummy-production-secret-key-at-least-32chars",
  "dummy-secret-key-for-testing-purposes-only",
];

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  JWT_SECRET: string;
  DB_PATH: string;
  CORS_ORIGIN: string;
  UPLOAD_DIR: string;
  BACKUP_DIR?: string;
  MAX_FILE_SIZE_BYTES: number;
  TRUST_PROXY: string | number;
  TICKET_TTL_SECONDS: number;
  RATE_LIMIT_LOGIN_MAX: number;
  RATE_LIMIT_API_MAX: number;
  RATE_LIMIT_UPLOAD_MAX: number;
}

export function validateEnv(env: Partial<EnvConfig> & { getAllowedOrigins?: () => string[] }): void {
  // 1. NODE_ENV validation
  const rawEnv = (env.NODE_ENV || "").toLowerCase().trim();
  const validEnvs = ["development", "production", "test"];
  if (env.NODE_ENV !== undefined && !validEnvs.includes(rawEnv)) {
    throw new Error(
      `FATAL CONFIGURATION: Unrecognized NODE_ENV '${env.NODE_ENV}'. Must be explicitly one of: 'development', 'production', or 'test'.`
    );
  }
  const isProduction = rawEnv === "production";

  // 2. Port Validation
  const port = env.PORT !== undefined ? Number(env.PORT) : 3001;
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`FATAL CONFIGURATION: Invalid PORT configured: ${env.PORT}. Must be between 1 and 65535.`);
  }

  // 3. Production Secret & Hardening Validation
  if (isProduction) {
    const jwtSecret = env.JWT_SECRET || "";
    if (!jwtSecret || jwtSecret === DEFAULT_DEV_JWT || jwtSecret.length < 32) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: In production mode, JWT_SECRET must be explicitly set and be at least 32 characters long."
      );
    }

    // Insecure placeholder & entropy check
    const lowerSecret = jwtSecret.toLowerCase();
    if (
      INSECURE_PLACEHOLDERS.map((p) => p.toLowerCase()).includes(lowerSecret) ||
      lowerSecret.includes("change-this") ||
      lowerSecret.includes("placeholder") ||
      lowerSecret.includes("your-secret") ||
      lowerSecret.includes("default-secret") ||
      new Set(jwtSecret).size < 8
    ) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: Insecure placeholder or low-entropy secret detected in JWT_SECRET. A unique, high-entropy secret must be provided."
      );
    }

    // CORS Origin validation
    const rawOrigins = env.CORS_ORIGIN || "";
    const origins = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);
    if (origins.length === 0) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: In production mode, CORS_ORIGIN must be explicitly set to authorized production domain(s)."
      );
    }
    if (origins.includes("*")) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: Wildcard CORS origin ('*') is strictly forbidden with credentialed API access in production."
      );
    }
  }

  // 4. File Size Validation
  const maxBytes = env.MAX_FILE_SIZE_BYTES !== undefined ? Number(env.MAX_FILE_SIZE_BYTES) : 5242880;
  if (isNaN(maxBytes) || maxBytes <= 0 || maxBytes > 52428800) {
    throw new Error("FATAL CONFIGURATION: MAX_FILE_SIZE_BYTES must be a positive integer not exceeding 50MB (52428800).");
  }

  // 5. Ticket TTL Validation
  const ticketTtl = env.TICKET_TTL_SECONDS !== undefined ? Number(env.TICKET_TTL_SECONDS) : 60;
  if (isNaN(ticketTtl) || ticketTtl < 10 || ticketTtl > 300) {
    throw new Error("FATAL CONFIGURATION: TICKET_TTL_SECONDS must be between 10 and 300 seconds.");
  }

  // 6. Upload Directory Validation
  if (env.UPLOAD_DIR !== undefined && (!env.UPLOAD_DIR || typeof env.UPLOAD_DIR !== "string" || env.UPLOAD_DIR.trim() === "")) {
    throw new Error("FATAL CONFIGURATION: UPLOAD_DIR must be a non-empty string path.");
  }

  // 7. Database Path Validation
  if (env.DB_PATH !== undefined && (!env.DB_PATH || typeof env.DB_PATH !== "string" || env.DB_PATH.trim() === "")) {
    throw new Error("FATAL CONFIGURATION: DB_PATH must be a non-empty string path.");
  }

  // 8. Backup Directory Validation
  if (env.BACKUP_DIR !== undefined && (!env.BACKUP_DIR || typeof env.BACKUP_DIR !== "string" || env.BACKUP_DIR.trim() === "")) {
    throw new Error("FATAL CONFIGURATION: BACKUP_DIR must be a non-empty string path.");
  }
}

const rawNodeEnv = (process.env.NODE_ENV || "").toLowerCase().trim();
const normalizedNodeEnv = rawNodeEnv === "production" ? "production" : rawNodeEnv === "test" ? "test" : "development";
const isProduction = normalizedNodeEnv === "production";

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV: normalizedNodeEnv,
  // IN PRODUCTION: NEVER fall back to DEFAULT_DEV_JWT
  JWT_SECRET: process.env.JWT_SECRET || (isProduction ? "" : DEFAULT_DEV_JWT),
  PROJECT_ROOT,
  DB_PATH: resolveConfigPath(process.env.DB_PATH, "server/data/database.sqlite"),
  // IN PRODUCTION: Do NOT fall back to localhost origins
  CORS_ORIGIN: process.env.CORS_ORIGIN || (isProduction ? "" : "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"),
  UPLOAD_DIR: resolveConfigPath(process.env.UPLOAD_DIR, "server/uploads"),
  BACKUP_DIR: resolveConfigPath(process.env.BACKUP_DIR, "server/backups"),
  MAX_FILE_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE_BYTES || "5242880", 10), // 5MB default
  // IN PRODUCTION: Default trust proxy to false unless explicitly set
  TRUST_PROXY: process.env.TRUST_PROXY || (isProduction ? "false" : "1"),
  TICKET_TTL_SECONDS: parseInt(process.env.TICKET_TTL_SECONDS || "60", 10),
  RATE_LIMIT_LOGIN_MAX: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || "10", 10),
  RATE_LIMIT_API_MAX: parseInt(process.env.RATE_LIMIT_API_MAX || (isProduction ? "600" : "5000"), 10),
  RATE_LIMIT_UPLOAD_MAX: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || "30", 10),

  /**
   * Returns list of authorized CORS origins
   */
  getAllowedOrigins(): string[] {
    const raw = this.CORS_ORIGIN || (this.NODE_ENV === "production" ? "" : "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173");
    return raw.split(",").map((o) => o.trim()).filter(Boolean);
  },

  /**
   * Fail-fast production environment validation
   */
  validate(): void {
    validateEnv(this);
  },
};

// Validate environment on module load
CONFIG.validate();
