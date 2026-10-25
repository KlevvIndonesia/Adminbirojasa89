/**
 * API Document Data Provider
 * Admin SUN89 — Biro Jasa Management System
 */

import { DocumentItem, UploadDocumentOptions } from "../../domain/document/types";
import { IDocumentProvider } from "../providers/documentProvider";
import { APP_CONFIG } from "../../app/config/appConfig";

export class ApiDocumentProvider implements IDocumentProvider {
  private baseUrl: string;

  constructor(baseUrl = APP_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private getAuthToken(): string | null {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem("auth_token");
      }
      if (typeof process !== "undefined" && process.env?.AUTH_TOKEN) {
        return process.env.AUTH_TOKEN;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private getAuthHeader(): Record<string, string> {
    const token = this.getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private mapEntityToItem(entity: any): DocumentItem {
    let parsedMeta: any = entity.metadata;
    if (!parsedMeta && entity.metadata_json) {
      try {
        parsedMeta = typeof entity.metadata_json === "string" ? JSON.parse(entity.metadata_json) : entity.metadata_json;
      } catch {
        parsedMeta = null;
      }
    }
    const phase = parsedMeta?.phase || entity.phase;
    const computedArah =
      entity.arah_dokumen ||
      entity.arahDokumen ||
      (phase === "AFTER" || phase === "OUTBOUND"
        ? "KELUAR"
        : phase === "BEFORE" || phase === "INBOUND"
        ? "MASUK"
        : undefined);

    return {
      id: entity.id,
      orderNo: entity.orderNo || entity.order_no || null,
      invoiceId: entity.invoiceId || entity.invoice_id || null,
      documentType: entity.documentType || entity.document_type || "DOKUMEN_PENDUKUNG",
      originalName: entity.originalName || entity.original_name,
      storageName: entity.storageName || entity.storage_name,
      mimeType: entity.mimeType || entity.mime_type,
      sizeBytes: entity.sizeBytes || entity.size_bytes,
      sha256: entity.sha256,
      uploadedBy: entity.uploadedBy || entity.uploaded_by,
      uploadedById: entity.uploadedById || entity.uploaded_by_id || null,
      uploadedByRole: entity.uploadedByRole || entity.uploaded_by_role || null,
      createdAt: entity.createdAt || entity.created_at,
      fileUrl: `${this.baseUrl}/documents/${entity.id}/preview`,
      downloadUrl: `${this.baseUrl}/documents/${entity.id}/download`,
      metadata: parsedMeta,
      arahDokumen: computedArah,
    };
  }

  public async uploadDocument(file: File, options: UploadDocumentOptions): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append("file", file);
    if (options.documentType) formData.append("documentType", options.documentType);
    if (options.orderNo) formData.append("orderNo", options.orderNo);
    if (options.invoiceId) formData.append("invoiceId", options.invoiceId);
    if (options.metadata) formData.append("metadata", JSON.stringify(options.metadata));

    const res = await fetch(`${this.baseUrl}/documents/upload`, {
      method: "POST",
      headers: {
        ...this.getAuthHeader(),
      },
      body: formData,
    });

    if (!res.ok) {
      let errMsg = "Gagal mengunggah dokumen.";
      try {
        const errorJson = await res.json();
        errMsg = errorJson.error?.message || errMsg;
      } catch {
        // fallback
      }
      throw new Error(errMsg);
    }

    const payload = await res.json();
    return this.mapEntityToItem(payload.data);
  }

  public async getDocumentById(id: string): Promise<DocumentItem | null> {
    const res = await fetch(`${this.baseUrl}/documents/${id}`, {
      headers: { ...this.getAuthHeader() },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return this.mapEntityToItem(payload.data);
  }

  public async getDocumentsByOrder(orderNo: string): Promise<DocumentItem[]> {
    const res = await fetch(`${this.baseUrl}/documents/order/${encodeURIComponent(orderNo)}`, {
      headers: { ...this.getAuthHeader() },
    });
    if (!res.ok) return [];
    const payload = await res.json();
    return (payload.data || []).map((d: any) => this.mapEntityToItem(d));
  }

  public async getDocumentsByInvoice(invoiceId: string): Promise<DocumentItem[]> {
    const res = await fetch(`${this.baseUrl}/documents/invoice/${encodeURIComponent(invoiceId)}`, {
      headers: { ...this.getAuthHeader() },
    });
    if (!res.ok) return [];
    const payload = await res.json();
    return (payload.data || []).map((d: any) => this.mapEntityToItem(d));
  }

  public async deleteDocument(id: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/documents/${id}`, {
      method: "DELETE",
      headers: { ...this.getAuthHeader() },
    });
    return res.ok;
  }

  public getPreviewUrl(id: string): string {
    return `${this.baseUrl}/documents/${id}/preview`;
  }

  public getDownloadUrl(id: string): string {
    return `${this.baseUrl}/documents/${id}/download`;
  }

  public async createAccessTicket(id: string, operation: "preview" | "download" = "preview"): Promise<string> {
    const res = await fetch(`${this.baseUrl}/documents/${encodeURIComponent(id)}/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeader(),
      },
      body: JSON.stringify({ operation }),
    });

    if (!res.ok) {
      let errMsg = "Gagal menerbitkan tiket akses dokumen.";
      try {
        const errorJson = await res.json();
        errMsg = errorJson.error?.message || errMsg;
      } catch {
        // fallback
      }
      throw new Error(errMsg);
    }

    const payload = await res.json();
    return payload.data?.ticket || "";
  }

  public async getAuthenticatedPreviewUrl(id: string): Promise<string> {
    const ticket = await this.createAccessTicket(id, "preview");
    return `${this.baseUrl}/documents/${encodeURIComponent(id)}/preview?ticket=${encodeURIComponent(ticket)}`;
  }

  public async getAuthenticatedDownloadUrl(id: string): Promise<string> {
    const ticket = await this.createAccessTicket(id, "download");
    return `${this.baseUrl}/documents/${encodeURIComponent(id)}/download?ticket=${encodeURIComponent(ticket)}`;
  }

  public async linkOrder(id: string, orderNo: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/documents/${encodeURIComponent(id)}/link-order`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeader(),
        },
        body: JSON.stringify({ orderNo }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
