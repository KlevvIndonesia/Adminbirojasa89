/**
 * Document Routes
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import multer from "multer";
import { CONFIG } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { uploadRateLimiter } from "../middleware/rateLimiter";
import path from "node:path";
import { ApiError } from "../middleware/errorHandler";
import {
  uploadDocument,
  getDocumentById,
  createAccessTicket,
  previewDocument,
  downloadDocument,
  getDocumentsByOrder,
  getDocumentsByInvoice,
  deleteDocument,
  linkDocumentToOrder,
} from "../controllers/documentController";

export const documentRouter = Router();

// Configure Multer with in-memory buffering & strict size limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONFIG.MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Fast pre-filter for dangerous executable/script extensions
    const ext = path.extname(file.originalname || "").toLowerCase();
    const disallowed = [".exe", ".dll", ".bat", ".cmd", ".sh", ".php", ".js", ".mjs", ".vbs", ".ps1", ".jar", ".msi", ".scr", ".com", ".phtml"];
    if (disallowed.includes(ext)) {
      return cb(new ApiError(400, "DISALLOWED_FILE_EXTENSION", `Ekstensi '${ext}' dilarang demi keamanan sistem.`));
    }
    cb(null, true);
  },
});

// Document Upload Route (Protected, Rate-Limited, Single File)
documentRouter.post(
  "/upload",
  requireAuth,
  uploadRateLimiter,
  upload.single("file"),
  uploadDocument
);

// Collections
documentRouter.get("/order/:orderNo", requireAuth, getDocumentsByOrder);
documentRouter.get("/invoice/:invoiceId", requireAuth, getDocumentsByInvoice);

// Short-Lived Access Ticket Issuance (Protected by Bearer JWT)
documentRouter.post("/:id/ticket", requireAuth, createAccessTicket);

// Media Streaming & Preview (Protected by Bearer JWT or Short-Lived Access Ticket)
documentRouter.get("/:id/preview", previewDocument);
documentRouter.get("/:id/download", downloadDocument);

// Single Resource Management
documentRouter.get("/:id", requireAuth, getDocumentById);
documentRouter.patch("/:id/link-order", requireAuth, linkDocumentToOrder);
documentRouter.delete("/:id", requireAuth, deleteDocument);
