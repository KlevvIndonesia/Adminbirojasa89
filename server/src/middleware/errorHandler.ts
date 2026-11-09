/**
 * Centralized Error Handling Middleware & Production Sanitizer
 * Admin SUN89 — Biro Jasa Management System
 */

import { Request, Response, NextFunction } from "express";
import { CONFIG } from "../config/env";
import { sanitizeUrlForLogging } from "./logger";

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;
  public field?: string;
  public retryAfterSeconds?: number;
  public readonly isApiError = true;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: any,
    options?: { field?: string; retryAfterSeconds?: number }
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.field = options?.field ?? (details && typeof details === "object" ? details.field : undefined);
    this.retryAfterSeconds =
      options?.retryAfterSeconds ??
      (details && typeof details === "object" ? details.retryAfterSeconds : undefined);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isApiError = err instanceof ApiError || err?.isApiError === true || (err && typeof err.statusCode === "number" && typeof err.code === "string");
  const statusCode = isApiError ? err.statusCode : (err.statusCode || (err.status ? Number(err.status) : 500));
  
  // Always log server-side for troubleshooting (with sanitized URL)
  if (statusCode >= 500) {
    const sanitizedUrl = sanitizeUrlForLogging(req.originalUrl || req.url);
    console.error(`[SUN89 Server Error] [${req.method} ${sanitizedUrl}]:`, err);
  }

  const isProduction = CONFIG.NODE_ENV === "production";
  
  // For 4xx errors, preserve the user-facing message and code
  let code = isApiError ? err.code : (err.code || "VALIDATION_ERROR");
  let message = err.message || "Permintaan tidak dapat diproses.";

  // In production, sanitize 500+ errors to prevent leaking stack traces / internals
  if (statusCode >= 500 && isProduction) {
    code = "INTERNAL_SERVER_ERROR";
    message = "Terjadi kesalahan internal pada server.";
  }

  // In production, sanitize any error message that contains internal database, SQL, or filesystem paths
  if (isProduction && typeof message === "string") {
    const sensitivePatterns = [
      /sqlite/i,
      /sql logic error/i,
      /syntax error/i,
      /unique constraint failed/i,
      /check constraint failed/i,
      /no such column/i,
      /no such table/i,
      /table .* has no column/i,
      /[a-zA-Z]:\\[^\s]+/i, // Windows absolute paths
      /\/(?:home|var|usr|etc|opt)\/[^\s]+/i, // Unix paths
      /at\s+[a-zA-Z0-9_.]+\s+\(/i, // Stack trace frames
    ];
    if (sensitivePatterns.some((pattern) => pattern.test(message))) {
      code = statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "VALIDATION_ERROR";
      message = statusCode >= 500 ? "Terjadi kesalahan internal pada server." : "Permintaan tidak dapat diproses karena data tidak valid.";
    }
  }

  const extractedField = err?.field || err?.details?.field;
  const extractedRetryAfter =
    typeof err?.retryAfterSeconds === "number"
      ? err.retryAfterSeconds
      : typeof err?.details?.retryAfterSeconds === "number"
      ? err.details.retryAfterSeconds
      : undefined;

  const responsePayload = {
    success: false,
    error: {
      code,
      message,
      ...(extractedField ? { field: extractedField } : {}),
      ...(typeof extractedRetryAfter === "number" ? { retryAfterSeconds: extractedRetryAfter } : {}),
      ...(isApiError && err.details && !isProduction ? { details: err.details } : {}),
    },
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(responsePayload);
}
