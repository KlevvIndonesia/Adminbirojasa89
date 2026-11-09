/**
 * Cryptographic Utilities: Password Hashing and Token Signing
 * Admin SUN89 — Biro Jasa Management System
 */

import crypto from "node:crypto";
import { CONFIG } from "../config/env";

export const MODERN_ITERATIONS = 600000;
export const INTERMEDIATE_ITERATIONS = 100000;
export const LEGACY_ITERATIONS = 1000;
const KEY_LEN = 64;
const DIGEST = "sha512";

/**
 * Hash password using PBKDF2 with SHA-512 and 600,000 iterations (OWASP recommendation).
 * Returns versioned format: $pbkdf2-sha512$i=600000$<salt>$<hash>
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const rawHash = crypto.pbkdf2Sync(password, salt, MODERN_ITERATIONS, KEY_LEN, DIGEST).toString("hex");
  const hash = `$pbkdf2-sha512$i=${MODERN_ITERATIONS}$${salt}$${rawHash}`;
  return { hash, salt };
}

/**
 * Verifies password against stored hash.
 * Supports:
 * - Modern 600,000-iteration hashes ($pbkdf2-sha512$i=600000$...)
 * - Intermediate 100,000-iteration hashes ($pbkdf2-sha512$i=100000$...)
 * - Legacy versioned hashes ($pbkdf2$i=1000$...)
 * - Legacy unversioned hex hashes (1,000 iterations)
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (!password || !storedHash) return false;

  try {
    if (storedHash.startsWith("$pbkdf2-sha512$")) {
      const parts = storedHash.split("$");
      // Format: ["", "pbkdf2-sha512", "i=600000", "<salt>", "<hash>"]
      if (parts.length === 5) {
        const iterMatch = parts[2].match(/^i=(\d+)$/);
        const iterations = iterMatch ? parseInt(iterMatch[1], 10) : MODERN_ITERATIONS;
        const hashSalt = parts[3];
        const hashExpected = parts[4];

        const computed = crypto.pbkdf2Sync(password, hashSalt, iterations, KEY_LEN, DIGEST).toString("hex");
        return timingSafeCompare(computed, hashExpected);
      }
    }

    if (storedHash.startsWith("$pbkdf2$")) {
      const parts = storedHash.split("$");
      if (parts.length >= 5) {
        const iterMatch = parts[2].match(/^i=(\d+)$/);
        const iterations = iterMatch ? parseInt(iterMatch[1], 10) : LEGACY_ITERATIONS;
        const hashSalt = parts[3];
        const hashExpected = parts[4];

        const computed = crypto.pbkdf2Sync(password, hashSalt, iterations, KEY_LEN, DIGEST).toString("hex");
        return timingSafeCompare(computed, hashExpected);
      }
    }

    // Legacy unversioned fallback (1,000 iterations)
    const legacyHash = crypto.pbkdf2Sync(password, salt, LEGACY_ITERATIONS, KEY_LEN, DIGEST).toString("hex");
    return timingSafeCompare(storedHash, legacyHash);
  } catch {
    return false;
  }
}

/**
 * Checks if the stored hash is using older iterations (< 600,000) and should be upgraded.
 */
export function needsRehash(storedHash: string): boolean {
  return !storedHash.startsWith(`$pbkdf2-sha512$i=${MODERN_ITERATIONS}$`);
}

/**
 * Timing-safe string comparison to mitigate timing side-channel attacks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface TokenPayload {
  userId: string;
  id?: string;
  email: string;
  nama: string;
  jabatan: string;
  role: 'administrator' | 'finance' | 'admin' | 'messenger' | 'supervisor' | 'svp' | string;
  employeeId?: string;
  iat?: number;
  exp: number;
}

export function generateToken(payload: Omit<TokenPayload, "exp" | "iat">, expiresInSeconds = 86400): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  const fullPayload: TokenPayload = { ...payload, iat: now, exp };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", CONFIG.JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    if (!token || typeof token !== "string") return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, signature] = parts;

    // Verify header algorithm is strictly HS256
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
    if (header.alg !== "HS256" || header.typ !== "JWT") {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", CONFIG.JWT_SECRET)
      .update(`${headerB64}.${bodyB64}`)
      .digest("base64url");

    if (!timingSafeCompare(signature, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf-8")) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);

    // Verify exp and iat
    if (typeof payload.exp !== "number" || payload.exp < now) {
      return null; // Expired
    }
    if (typeof payload.iat === "number" && payload.iat > now + 60) {
      return null; // Token from the future
    }

    return payload;
  } catch {
    return null;
  }
}
