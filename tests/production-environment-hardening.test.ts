/**
 * Production Environment Hardening & Security Guard Verification Tests
 * Project: SUNBiroJasa / Admin SUN89
 *
 * Verifies P0 & P1 Remediation:
 * 1. Production without JWT_SECRET fails startup / validation
 * 2. Production with default secret fails startup / validation
 * 3. Production with valid secret passes environment validation
 * 4. Short secret (<32 chars) and placeholder secrets are rejected
 * 5. Token with developer secret is rejected once new secret is used
 * 6. CORS accepts allowed origins and rejects unallowed origins on browser requests
 * 7. Production error response does not leak internal details (SQL error, paths, schema)
 * 8. Development startup continues to work with defaults
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { validateEnv, DEFAULT_DEV_JWT, CONFIG, INSECURE_PLACEHOLDERS } from "../server/src/config/env";
import { generateToken, verifyToken } from "../server/src/utils/crypto";
import { errorHandler, ApiError } from "../server/src/middleware/errorHandler";
import { getClientIp } from "../server/src/middleware/rateLimiter";

const DUMMY_VALID_TEST_SECRET = "a-very-strong-test-secret-with-high-entropy-and-32chars-min";

test("Hardening 1: Production without JWT_SECRET fails environment validation", () => {
  assert.throws(
    () => {
      validateEnv({
        NODE_ENV: "production",
        JWT_SECRET: "",
        CORS_ORIGIN: "https://admin.sunbirojasa.com",
      });
    },
    (err: any) => {
      assert.match(err.message, /FATAL SECURITY CONFIGURATION/i);
      assert.match(err.message, /JWT_SECRET must be explicitly set/i);
      return true;
    }
  );
});

test("Hardening 2: Production with default developer secret fails validation", () => {
  assert.throws(
    () => {
      validateEnv({
        NODE_ENV: "production",
        JWT_SECRET: DEFAULT_DEV_JWT,
        CORS_ORIGIN: "https://admin.sunbirojasa.com",
      });
    },
    (err: any) => {
      assert.match(err.message, /FATAL SECURITY CONFIGURATION/i);
      return true;
    }
  );
});

test("Hardening 3: Production with valid high-entropy secret passes environment validation", () => {
  assert.doesNotThrow(() => {
    validateEnv({
      NODE_ENV: "production",
      PORT: 3001,
      JWT_SECRET: DUMMY_VALID_TEST_SECRET,
      CORS_ORIGIN: "https://admin.sunbirojasa.com",
      DB_PATH: "server/data/database.sqlite",
      UPLOAD_DIR: "server/uploads",
      BACKUP_DIR: "server/backups",
      MAX_FILE_SIZE_BYTES: 5242880,
      TICKET_TTL_SECONDS: 60,
    });
  });
});

test("Hardening 4: Short secret (<32 chars) and known placeholder secrets are rejected in production", () => {
  // 1. Short secret (16 chars)
  assert.throws(
    () => {
      validateEnv({
        NODE_ENV: "production",
        JWT_SECRET: "short-secret-16c",
        CORS_ORIGIN: "https://admin.sunbirojasa.com",
      });
    },
    (err: any) => {
      assert.match(err.message, /at least 32 characters long/i);
      return true;
    }
  );

  // 2. Known placeholders
  for (const placeholder of INSECURE_PLACEHOLDERS) {
    assert.throws(
      () => {
        validateEnv({
          NODE_ENV: "production",
          JWT_SECRET: placeholder,
          CORS_ORIGIN: "https://admin.sunbirojasa.com",
        });
      },
      (err: any) => {
        assert.match(err.message, /FATAL SECURITY CONFIGURATION/i);
        return true;
      }
    );
  }

  // 3. Low-entropy repeated string (32 chars of 'a')
  assert.throws(
    () => {
      validateEnv({
        NODE_ENV: "production",
        JWT_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        CORS_ORIGIN: "https://admin.sunbirojasa.com",
      });
    },
    (err: any) => {
      assert.match(err.message, /low-entropy/i);
      return true;
    }
  );
});

test("Hardening 5: Token signed with old developer secret is rejected once new secret is active", () => {
  // Step 1: Generate token with old developer secret
  const originalSecret = CONFIG.JWT_SECRET;
  (CONFIG as any).JWT_SECRET = DEFAULT_DEV_JWT;
  const oldToken = generateToken({
    userId: "usr-1",
    email: "admin@birojasa.com",
    nama: "Admin Super",
    jabatan: "SVP",
    role: "administrator",
  });
  assert.ok(oldToken, "Token successfully created with dev secret");

  // Step 2: Switch to new secret
  (CONFIG as any).JWT_SECRET = DUMMY_VALID_TEST_SECRET;

  // Step 3: Old token MUST fail signature verification with new secret
  const verified = verifyToken(oldToken);
  assert.strictEqual(verified, null, "Token signed with old secret must return null");

  // Step 4: Token signed with new secret MUST succeed
  const newToken = generateToken({
    userId: "usr-1",
    email: "admin@birojasa.com",
    nama: "Admin Super",
    jabatan: "SVP",
    role: "administrator",
  });
  const verifiedNew = verifyToken(newToken);
  assert.ok(verifiedNew, "Token signed with new secret must verify successfully");
  assert.strictEqual(verifiedNew?.userId, "usr-1");

  // Restore original config
  (CONFIG as any).JWT_SECRET = originalSecret;
});

test("Hardening 6: CORS accepts authorized origins and rejects unauthorized origins", async () => {
  const allowed = ["https://admin.sunbirojasa.com", "https://portal.sunbirojasa.com"];

  const app = express();
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowed.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS Error: Origin '${origin}' is not authorized.`));
      },
      credentials: true,
    })
  );
  app.get("/test-cors", (_req, res) => res.json({ ok: true }));

  // Custom error handler for CORS error
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(403).json({ success: false, error: err.message });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as any;
  const baseUrl = `http://localhost:${addr.port}`;

  try {
    // 1. Authorized origin succeeds
    const resAuth = await fetch(`${baseUrl}/test-cors`, {
      headers: { Origin: "https://admin.sunbirojasa.com" },
    });
    assert.strictEqual(resAuth.status, 200);
    const bodyAuth = await resAuth.json();
    assert.strictEqual(bodyAuth.ok, true);

    // 2. Unauthorized origin is rejected
    const resUnauth = await fetch(`${baseUrl}/test-cors`, {
      headers: { Origin: "https://evil-hacker.com" },
    });
    assert.strictEqual(resUnauth.status, 403);
    const bodyUnauth = await resUnauth.json();
    assert.match(bodyUnauth.error, /CORS Error: Origin 'https:\/\/evil-hacker\.com' is not authorized/);

    // 3. In production mode, wildcard CORS origin throws validation error
    assert.throws(
      () => {
        validateEnv({
          NODE_ENV: "production",
          JWT_SECRET: DUMMY_VALID_TEST_SECRET,
          CORS_ORIGIN: "*",
        });
      },
      (err: any) => {
        assert.match(err.message, /Wildcard CORS origin/i);
        return true;
      }
    );
  } finally {
    server.close();
  }
});

test("Hardening 7: Production error response does not leak SQL errors or internal paths", async () => {
  const originalEnv = CONFIG.NODE_ENV;
  (CONFIG as any).NODE_ENV = "production";

  const app = express();
  
  // Endpoint 1: Triggers 500 error with internal database query leakage
  app.get("/test-db-error", () => {
    throw new Error("SQLITE_ERROR: no such column: secret_column at D:\\Admin\\adminsunbirojasa\\server\\db.ts:123");
  });

  // Endpoint 2: Triggers 400 ApiError with database constraint in message
  app.get("/test-constraint-error", () => {
    throw new ApiError(400, "BAD_REQUEST", "SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email");
  });

  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as any;
  const baseUrl = `http://localhost:${addr.port}`;

  try {
    // Check 500 error response sanitization
    const res500 = await fetch(`${baseUrl}/test-db-error`);
    assert.strictEqual(res500.status, 500);
    const body500 = await res500.json() as any;
    assert.strictEqual(body500.success, false);
    assert.strictEqual(body500.error.code, "INTERNAL_SERVER_ERROR");
    assert.strictEqual(body500.error.message, "Terjadi kesalahan internal pada server.");
    assert.strictEqual(body500.error.details, undefined);
    assert.ok(!JSON.stringify(body500).includes("SQLITE"));
    assert.ok(!JSON.stringify(body500).includes("D:\\Admin"));

    // Check 400 constraint error response sanitization
    const res400 = await fetch(`${baseUrl}/test-constraint-error`);
    assert.strictEqual(res400.status, 400);
    const body400 = await res400.json() as any;
    assert.strictEqual(body400.success, false);
    assert.strictEqual(body400.error.code, "VALIDATION_ERROR");
    assert.strictEqual(body400.error.message, "Permintaan tidak dapat diproses karena data tidak valid.");
    assert.ok(!JSON.stringify(body400).includes("SQLITE_CONSTRAINT"));
    assert.ok(!JSON.stringify(body400).includes("users.email"));
  } finally {
    (CONFIG as any).NODE_ENV = originalEnv;
    server.close();
  }
});

test("Hardening 8: Development startup continues to work with defaults", () => {
  assert.doesNotThrow(() => {
    validateEnv({
      NODE_ENV: "development",
      PORT: 3001,
      JWT_SECRET: DEFAULT_DEV_JWT,
      CORS_ORIGIN: "http://localhost:3000,http://localhost:5173",
      DB_PATH: "server/data/database.sqlite",
      UPLOAD_DIR: "server/uploads",
      BACKUP_DIR: "server/backups",
    });
  });
});

test("Hardening 9: Rate limiter getClientIp respects trusted proxy and prevents header spoofing", () => {
  // Test case 1: Untrusted proxy (trust proxy = false) -> ignores X-Forwarded-For
  const mockReqNoTrust: any = {
    ip: "192.168.1.100", // Express computed req.ip
    headers: { "x-forwarded-for": "10.99.99.99, 10.88.88.88" },
    socket: { remoteAddress: "192.168.1.100" },
  };
  const resolvedIp = getClientIp(mockReqNoTrust);
  assert.strictEqual(resolvedIp, "192.168.1.100", "Must use req.ip resolved by Express, not raw spoofed header");

  // Test case 2: IPv6 mapped IPv4 is cleaned
  const mockReqIpv6: any = {
    ip: "::ffff:192.168.1.50",
    headers: {},
    socket: {},
  };
  assert.strictEqual(getClientIp(mockReqIpv6), "192.168.1.50");

  // Test case 3: Loopback IPv6 is normalized to 127.0.0.1
  const mockReqLoopback: any = {
    ip: "::1",
    headers: {},
    socket: {},
  };
  assert.strictEqual(getClientIp(mockReqLoopback), "127.0.0.1");
});
