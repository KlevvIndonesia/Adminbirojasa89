/**
 * Mock Document Data Provider
 * Admin SUN89 — Biro Jasa Management System
 */

import { DocumentItem, UploadDocumentOptions } from "../../../src/domain/document/types";
import { IDocumentProvider } from "../../../src/data/providers/documentProvider";

export class MockDocumentProvider implements IDocumentProvider {
  private docs = new Map<string, DocumentItem>();

  public async uploadDocument(file: File, options: UploadDocumentOptions): Promise<DocumentItem> {
    const id = `DOC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const fileUrl = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : `mock://${file.name}`;
    const docItem: DocumentItem = {
      id,
      orderNo: options.orderNo || null,
      invoiceId: options.invoiceId || null,
      documentType: options.documentType,
      originalName: file.name,
      storageName: `${id}_${file.name}`,
      mimeType: file.type || "application/pdf",
      sizeBytes: file.size,
      sha256: "mock-sha256-hash",
      uploadedBy: "Admin Super (Mock)",
      uploadedById: "usr_mock",
      uploadedByRole: "administrator",
      createdAt: new Date().toISOString(),
      fileUrl,
      downloadUrl: fileUrl,
    };
    this.docs.set(id, docItem);
    return docItem;
  }

  public async getDocumentById(id: string): Promise<DocumentItem | null> {
    return this.docs.get(id) || null;
  }

  public async getDocumentsByOrder(orderNo: string): Promise<DocumentItem[]> {
    return Array.from(this.docs.values()).filter((d) => d.orderNo === orderNo);
  }

  public async getDocumentsByInvoice(invoiceId: string): Promise<DocumentItem[]> {
    return Array.from(this.docs.values()).filter((d) => d.invoiceId === invoiceId);
  }

  public async deleteDocument(id: string): Promise<boolean> {
    return this.docs.delete(id);
  }

  public getPreviewUrl(id: string): string {
    const doc = this.docs.get(id);
    return doc?.fileUrl || "";
  }

  public getDownloadUrl(id: string): string {
    const doc = this.docs.get(id);
    return doc?.downloadUrl || "";
  }

  public async createAccessTicket(id: string, operation: "preview" | "download" = "preview"): Promise<string> {
    return `mock_ticket_${id}_${operation}`;
  }

  public async getAuthenticatedPreviewUrl(id: string): Promise<string> {
    const doc = this.docs.get(id);
    return doc?.fileUrl || `mock://preview/${id}`;
  }

  public async getAuthenticatedDownloadUrl(id: string): Promise<string> {
    const doc = this.docs.get(id);
    return doc?.downloadUrl || `mock://download/${id}`;
  }
}

export const mockDocumentProvider = new MockDocumentProvider();
