/**
 * Public Customer API Routes
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Namespace: /api/v1/public
 * Unauthenticated, rate-limited, strictly sanitized endpoints for the Customer Website.
 */

import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { CONFIG } from "../config/env";
import { ApiError } from "../middleware/errorHandler";
import {
  publicGeneralRateLimiter,
  publicOrderRateLimiter,
  publicTrackingRateLimiter,
} from "../middleware/rateLimiter";
import {
  getPublicServices,
  getPublicSamsatOffices,
  getPublicPricingEstimate,
  createPublicOrder,
  trackOrderByNopol,
  getPublicOrderDetailTracking,
} from "../controllers/publicController";

export const publicRouter = Router();

// Configure Multer for secure customer document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONFIG.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const disallowed = [
      ".exe", ".dll", ".bat", ".cmd", ".sh", ".php", ".js", ".mjs",
      ".vbs", ".ps1", ".jar", ".msi", ".scr", ".com", ".phtml",
    ];
    if (disallowed.includes(ext)) {
      return cb(new ApiError(400, "DISALLOWED_FILE_EXTENSION", `Ekstensi '${ext}' dilarang demi keamanan sistem.`));
    }
    cb(null, true);
  },
});

// Apply general public rate limiter to all public endpoints
publicRouter.use(publicGeneralRateLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Master Data Endpoints
// ─────────────────────────────────────────────────────────────────────────────
publicRouter.get("/services", getPublicServices);
publicRouter.get("/samsat", getPublicSamsatOffices);
publicRouter.get("/pricing", getPublicPricingEstimate);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Customer Order Creation Endpoint (Strict Rate Limit & Anti-Abuse)
// ─────────────────────────────────────────────────────────────────────────────
publicRouter.post(
  "/orders",
  publicOrderRateLimiter,
  upload.array("files", 5),
  createPublicOrder
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Customer Order Tracking Endpoints (Strict Rate Limit & Anti-Scraping)
// ─────────────────────────────────────────────────────────────────────────────
publicRouter.get("/orders/tracking", publicTrackingRateLimiter, trackOrderByNopol);
publicRouter.get("/orders/:orderNo/tracking", publicTrackingRateLimiter, getPublicOrderDetailTracking);
