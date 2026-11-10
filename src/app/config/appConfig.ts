/**
 * Application Configuration and Metadata
 * Admin SUN89 — Biro Jasa Management System
 */

export function resolveApiBaseUrl(): string {
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  // In browser environment: default to relative "/api" to utilize Vite proxy or same-origin serving
  if (typeof window !== "undefined") {
    return "/api";
  }
  // In Node.js / CLI / Test environments: absolute URL is required for fetch
  if (typeof process !== "undefined" && process.env?.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }
  return "http://localhost:3001/api";
}

export const APP_CONFIG = {
  appName: "Admin SUN89",
  systemTitle: "Sistem Manajemen Biro Jasa",
  version: "1.0.0",
  defaultItemsPerPage: 10,
  defaultCurrency: "IDR",
  defaultLocale: "id-ID",
  dateFormat: "DD/MM/YYYY",
  companyName: "SUN89 Biro Jasa",
  supportContact: "support@sunbirojasa.com",
  dataProvider: "api" as const,
  apiBaseUrl: resolveApiBaseUrl(),
} as const;
