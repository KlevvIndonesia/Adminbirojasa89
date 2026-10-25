/**
 * Canonical Domain Types for Document Storage & Workflow
 * Admin SUN89 — Biro Jasa Management System
 */

export interface DocumentItem {
  id: string;
  orderNo?: string | null;
  invoiceId?: string | null;
  documentType: string;
  originalName: string;
  storageName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string;
  uploadedById?: string | null;
  uploadedByRole?: string | null;
  createdAt: string;
  fileUrl: string;
  downloadUrl: string;
  metadata?: Record<string, any> | null;
  arahDokumen?: "MASUK" | "KELUAR" | string;
}

export interface UploadDocumentOptions {
  orderNo?: string;
  invoiceId?: string;
  documentType: string;
  metadata?: Record<string, any>;
}
