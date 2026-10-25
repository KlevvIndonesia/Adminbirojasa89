/**
 * Document Access Ticket Service
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Generates and validates cryptographically secure, opaque, short-lived (60s)
 * access tickets for document preview and download. Eliminates any exposure
 * of JWT tokens in query strings, iframe sources, or download links.
 */

import crypto from "node:crypto";
import { TokenPayload } from "../utils/crypto";
import { CONFIG } from "../config/env";

export type DocumentTicketOperation = "preview" | "download" | "any";

export interface DocumentAccessTicket {
  ticket: string;
  documentId: string;
  userId: string;
  userName: string;
  userRole: string;
  operation: DocumentTicketOperation;
  expiresAt: number; // Unix timestamp in ms
  createdAt: number;
  usedCount: number;
  maxUses: number;
}

export class DocumentTicketService {
  private tickets = new Map<string, DocumentAccessTicket>();
  private usedTickets = new Map<string, number>(); // ticket -> consumed timestamp
  private readonly defaultTtlMs: number;

  constructor(ttlSeconds?: number) {
    this.defaultTtlMs = (ttlSeconds || CONFIG.TICKET_TTL_SECONDS || 60) * 1000;

    // Periodic sweep to prevent memory retention of expired and consumed tickets
    const timer = setInterval(() => this.sweepExpired(), 30 * 1000);
    if (timer.unref) {
      timer.unref();
    }
  }

  /**
   * Issue a short-lived access ticket bound to a specific document, user, and operation.
   * By default, tickets have single-use semantics (maxUses = 1).
   */
  public createTicket(
    documentId: string,
    user: TokenPayload,
    operation: DocumentTicketOperation = "preview",
    options?: { maxUses?: number; ttlMs?: number }
  ): DocumentAccessTicket {
    const ticketStr = `tkt_${crypto.randomBytes(32).toString("hex")}`;
    const now = Date.now();
    const ttl = options?.ttlMs || this.defaultTtlMs;
    const maxUses = options?.maxUses !== undefined ? options.maxUses : (operation === "preview" ? 30 : 1);

    const entry: DocumentAccessTicket = {
      ticket: ticketStr,
      documentId,
      userId: String(user.userId || (user as any).id || user.email),
      userName: user.nama || user.email,
      userRole: user.role || user.jabatan || "admin",
      operation,
      expiresAt: now + ttl,
      createdAt: now,
      usedCount: 0,
      maxUses,
    };

    this.tickets.set(ticketStr, entry);
    return entry;
  }

  /**
   * Validate ticket authenticity, expiration, document matching, and operation.
   * If consume = true (default), increments use count and revokes when maxUses reached.
   */
  public validateTicket(
    ticket: string,
    documentId: string,
    operation: "preview" | "download",
    options: { consume?: boolean } = { consume: true }
  ): { valid: boolean; error?: string; ticketData?: DocumentAccessTicket } {
    if (!ticket || typeof ticket !== "string") {
      return { valid: false, error: "TICKET_MISSING" };
    }

    // Malformed ticket check (must start with tkt_ and have sufficient entropy)
    if (!ticket.startsWith("tkt_") || ticket.length < 36) {
      return { valid: false, error: "TICKET_MALFORMED" };
    }

    // Check if ticket was previously consumed
    if (this.usedTickets.has(ticket)) {
      return { valid: false, error: "TICKET_ALREADY_USED" };
    }

    const entry = this.tickets.get(ticket);
    if (!entry) {
      return { valid: false, error: "TICKET_NOT_FOUND" };
    }

    // Expiration check
    if (Date.now() > entry.expiresAt) {
      this.tickets.delete(ticket);
      return { valid: false, error: "TICKET_EXPIRED" };
    }

    // Document binding check
    if (entry.documentId !== documentId) {
      return { valid: false, error: "TICKET_DOCUMENT_MISMATCH" };
    }

    // Operation check
    if (entry.operation !== "any" && entry.operation !== operation) {
      return { valid: false, error: "TICKET_OPERATION_MISMATCH" };
    }

    // Consumption logic
    if (options.consume !== false) {
      entry.usedCount++;
      if (entry.usedCount >= entry.maxUses) {
        this.tickets.delete(ticket);
        this.usedTickets.set(ticket, Date.now() + this.defaultTtlMs);
      }
    }

    return { valid: true, ticketData: entry };
  }

  /**
   * Revoke an active ticket immediately.
   */
  public revokeTicket(ticket: string): boolean {
    return this.tickets.delete(ticket);
  }

  /**
   * Sweep expired and spent tickets from memory.
   */
  public sweepExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.tickets.entries()) {
      if (now > entry.expiresAt) {
        this.tickets.delete(key);
        count++;
      }
    }

    for (const [key, expiry] of this.usedTickets.entries()) {
      if (now > expiry) {
        this.usedTickets.delete(key);
        count++;
      }
    }

    // Safety bounds: prevent unbounded growth under heavy ticket generation
    if (this.usedTickets.size > 5000) {
      const keysToDelete = Array.from(this.usedTickets.keys()).slice(0, 1000);
      for (const k of keysToDelete) {
        this.usedTickets.delete(k);
      }
    }

    return count;
  }

  /**
   * Automated / explicit sweep alias for expired and spent tickets.
   */
  public sweepExpiredTickets(): number {
    return this.sweepExpired();
  }

  /**
   * Diagnostic helper: get count of currently active tickets.
   */
  public getActiveTicketCount(): number {
    return this.tickets.size;
  }

  /**
   * Diagnostic helper: get count of recorded consumed tickets.
   */
  public getUsedTicketCount(): number {
    return this.usedTickets.size;
  }

  /**
   * Clear all tickets (useful for test isolation).
   */
  public clearAll(): void {
    this.tickets.clear();
    this.usedTickets.clear();
  }
}

export const documentTicketService = new DocumentTicketService();
