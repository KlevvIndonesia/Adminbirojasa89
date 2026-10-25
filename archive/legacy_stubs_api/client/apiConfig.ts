/**
 * Future API Configuration Contract
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: For architecture preparation and future backend contract only.
 */

export interface ApiConfig {
  baseUrl: string;
  timeoutMs: number;
  headers: Record<string, string>;
  retryAttempts: number;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: "/api/v1",
  timeoutMs: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  retryAttempts: 2,
};
