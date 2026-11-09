/**
 * In-Memory Sliding-Window Rate Limiting Middleware
 * Admin SUN89 — Biro Jasa Management System
 */

import { Request, Response, NextFunction } from "express";
import { CONFIG } from "../config/env";

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  reset: (ip?: string) => void;
}

export function getClientIp(req: Request): string {
  // Use Express resolved req.ip which respects app.get("trust proxy") configuration
  // instead of blindly trusting raw unverified X-Forwarded-For headers
  let ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  if (typeof ip === "string") {
    if (ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }
    if (ip === "::1") {
      ip = "127.0.0.1";
    }
  }
  return ip;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipInTests?: boolean;
}): RateLimiterMiddleware {
  const { windowMs, maxRequests, message = "Terlalu banyak permintaan. Silakan coba beberapa saat lagi.", skipInTests = false } = options;
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, Math.max(60000, windowMs));

  // Unref interval to not block process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    if (skipInTests && process.env.NODE_ENV === "test") {
      return next();
    }

    const ip = getClientIp(req);
    const now = Date.now();

    let record = store.get(ip);
    if (!record) {
      record = { timestamps: [] };
      store.set(ip, record);
    }

    // Keep only timestamps within window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    const remaining = Math.max(0, maxRequests - record.timestamps.length);
    const resetTime = Math.ceil((windowMs - (record.timestamps.length > 0 ? now - record.timestamps[0] : 0)) / 1000);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetTime);

    if (record.timestamps.length >= maxRequests) {
      res.setHeader("Retry-After", resetTime);
      res.status(429).json({
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message,
          retryAfterSeconds: resetTime,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };

  middleware.reset = (ip?: string) => {
    if (ip) {
      store.delete(ip);
    } else {
      store.clear();
    }
  };

  return middleware;
}

/**
 * Strict Rate Limiter for Login Endpoint:
 * - Window: 1 minute (60,000 ms)
 * - Max: Configurable (default 10 attempts per minute per IP)
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: CONFIG.RATE_LIMIT_LOGIN_MAX,
  message: "Terlalu banyak percobaan login gagal. Silakan tunggu 1 menit sebelum mencoba kembali.",
});

/**
 * General API Rate Limiter:
 * - Window: 15 minutes (900,000 ms)
 * - Max: Configurable (default 600 in prod, 5000 in dev)
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: CONFIG.RATE_LIMIT_API_MAX,
  message: "Batas permintaan API tercapai. Silakan coba lagi beberapa saat.",
  skipInTests: true,
});

/**
 * Dedicated Rate Limiter for Document Uploads:
 * - Window: 1 minute (60,000 ms)
 * - Max: Configurable (default 30 uploads per minute per IP)
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: CONFIG.RATE_LIMIT_UPLOAD_MAX,
  message: "Terlalu banyak permintaan upload berkas. Silakan tunggu sebentar sebelum mencoba kembali.",
});

