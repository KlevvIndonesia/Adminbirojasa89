/**
 * Observability & Request Logging Middleware
 * Admin SUN89 — Biro Jasa Management System
 */

import { Request, Response, NextFunction } from "express";

/**
 * Redacts sensitive query parameters such as tickets, tokens, and credentials from log output.
 */
export function sanitizeUrlForLogging(rawUrl: string): string {
  try {
    const qIndex = rawUrl.indexOf("?");
    if (qIndex === -1) return rawUrl;

    const pathPart = rawUrl.slice(0, qIndex);
    const queryString = rawUrl.slice(qIndex + 1);
    const params = new URLSearchParams(queryString);

    const sensitiveKeys = ["ticket", "token", "password", "secret", "key", "authorization"];
    let modified = false;

    for (const key of sensitiveKeys) {
      if (params.has(key)) {
        params.set(key, "[REDACTED]");
        modified = true;
      }
    }

    return modified ? `${pathPart}?${params.toString()}` : rawUrl;
  } catch {
    return rawUrl.split("?")[0];
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const incomingRequestId = (req.headers["x-request-id"] || req.headers["x-correlation-id"]) as string | undefined;
  const requestId = incomingRequestId && incomingRequestId.trim()
    ? incomingRequestId.trim()
    : `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "test") {
      const sanitizedUrl = sanitizeUrlForLogging(req.originalUrl || req.url);
      const isJson = process.env.LOG_FORMAT === "json";
      if (isJson) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            requestId,
            method: req.method,
            url: sanitizedUrl,
            statusCode: res.statusCode,
            durationMs: duration,
          })
        );
      } else {
        console.log(`[${new Date().toISOString()}] ${req.method} ${sanitizedUrl} ${res.statusCode} - ${duration}ms [${requestId}]`);
      }
    }
  });

  next();
}
