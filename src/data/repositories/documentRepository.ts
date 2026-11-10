/**
 * Document Repository
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides access layer for persistent document storage,
 * dynamically selecting API or Mock provider according to runtime environment.
 */

import { DocumentItem, UploadDocumentOptions } from "../../domain/document/types";
import { IDocumentProvider } from "../providers/documentProvider";
import { ApiDocumentProvider } from "../api/apiDocumentProvider";

export interface IDocumentRepository {
  uploadDocument(file: File, options: UploadDocumentOptions): Promise<DocumentItem>;
  getDocumentById(id: string): Promise<DocumentItem | null>;
  getDocumentsByOrder(orderNo: string): Promise<DocumentItem[]>;
  getDocumentsByInvoice(invoiceId: string): Promise<DocumentItem[]>;
  deleteDocument(id: string): Promise<boolean>;
  getPreviewUrl(id: string): string;
  getDownloadUrl(id: string): string;
  createAccessTicket(id: string, operation?: "preview" | "download"): Promise<string>;
  getAuthenticatedPreviewUrl(id: string): Promise<string>;
  getAuthenticatedDownloadUrl(id: string): Promise<string>;
  linkOrder?(id: string, orderNo: string): Promise<boolean>;
  setProvider(provider: IDocumentProvider): void;
  getProvider(): IDocumentProvider;
}

export class DocumentRepository implements IDocumentRepository {
  private provider: IDocumentProvider;

  constructor(provider?: IDocumentProvider) {
    this.provider = provider || new ApiDocumentProvider();
  }

  public setProvider(provider: IDocumentProvider): void {
    this.provider = provider;
  }

  public getProvider(): IDocumentProvider {
    return this.provider;
  }

  public uploadDocument(file: File, options: UploadDocumentOptions): Promise<DocumentItem> {
    return this.provider.uploadDocument(file, options);
  }

  public getDocumentById(id: string): Promise<DocumentItem | null> {
    return this.provider.getDocumentById(id);
  }

  public getDocumentsByOrder(orderNo: string): Promise<DocumentItem[]> {
    return this.provider.getDocumentsByOrder(orderNo);
  }

  public getDocumentsByInvoice(invoiceId: string): Promise<DocumentItem[]> {
    return this.provider.getDocumentsByInvoice(invoiceId);
  }

  public deleteDocument(id: string): Promise<boolean> {
    return this.provider.deleteDocument(id);
  }

  public getPreviewUrl(id: string): string {
    return this.provider.getPreviewUrl(id);
  }

  public getDownloadUrl(id: string): string {
    return this.provider.getDownloadUrl(id);
  }

  public createAccessTicket(id: string, operation?: "preview" | "download"): Promise<string> {
    if (typeof this.provider.createAccessTicket === "function") {
      return this.provider.createAccessTicket(id, operation);
    }
    return Promise.resolve("");
  }

  public getAuthenticatedPreviewUrl(id: string): Promise<string> {
    if (typeof this.provider.getAuthenticatedPreviewUrl === "function") {
      return this.provider.getAuthenticatedPreviewUrl(id);
    }
    return Promise.resolve(this.getPreviewUrl(id));
  }

  public getAuthenticatedDownloadUrl(id: string): Promise<string> {
    if (typeof this.provider.getAuthenticatedDownloadUrl === "function") {
      return this.provider.getAuthenticatedDownloadUrl(id);
    }
    return Promise.resolve(this.getDownloadUrl(id));
  }

  public linkOrder(id: string, orderNo: string): Promise<boolean> {
    if (typeof (this.provider as any).linkOrder === "function") {
      return (this.provider as any).linkOrder(id, orderNo);
    }
    return Promise.resolve(true);
  }
}

export const documentRepository = new DocumentRepository();
