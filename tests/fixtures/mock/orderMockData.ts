/**
 * Mock Seed Data for Operational Orders
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Clean Empty Initial Orders (Production-Ready Clean State)
 */

import { OperationalOrder, StageName } from "../../../src/domain/order/types";

export function createInitialOrders(): Record<StageName, OperationalOrder[]> {
  return {
    "Verifikasi": [],
    "Penjadwalan": [],
    "Verifikasi Dokumen": [],
    "Proses Samsat": [],
    "Verifikasi Ulang": [],
    "Supervisi": [],
    "Pengantaran": [],
    "Dokumen Telah Diterima": [],
  };
}
