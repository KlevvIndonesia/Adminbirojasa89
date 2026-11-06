/**
 * Payout Intent Lifecycle Manager
 * Admin SUN89 — Biro Jasa Management System
 * 
 * DEF-FIN-005 Hardening:
 * Manages the client-side lifecycle of cashback / refund payout intents.
 * Ensures a single intent strictly maintains the same idempotency UUID across:
 * - Network timeouts and dropped HTTP responses
 * - Modal close and reopen actions
 * - Tab reloads and page refreshes (via localStorage cross-tab persistence)
 * - Multi-tab coordination on the same invoice
 * - Retries after unknown outcome
 * 
 * Distinguishes between:
 * - DEFINITIVE_SUCCESS: transaction confirmed committed on server (clears intent)
 * - DEFINITIVE_FAILED: 4xx business/validation rejection (allows fresh intent)
 * - UNKNOWN_OUTCOME: network timeout / disconnect / 5xx / 429 / 408 (MUST retain UUID for retry)
 */

export type PayoutIntentStatus =
  | "DRAFT"              // Created when modal opened, not yet sent over network
  | "IN_FLIGHT"           // HTTP request sent, awaiting server response
  | "UNKNOWN_OUTCOME"     // Network dropped, timeout, or lost response (retains UUID)
  | "DEFINITIVE_SUCCESS"  // Server confirmed 200 OK (intent fulfilled)
  | "DEFINITIVE_FAILED";  // Server confirmed 4xx rejection (intent definitively rejected)

export interface PayoutIntent {
  invoiceId: number | string;
  idempotencyKey: string;
  status: PayoutIntentStatus;
  nominal?: number;
  paymentType?: "KELEBIHAN" | "KOMISI" | "ALL";
  createdAt: number;
  lastAttemptAt?: number;
  error?: string;
}

const STORAGE_PREFIX = "sun89_cashback_intent_";

class PayoutIntentManager {
  private memoryStore = new Map<string, PayoutIntent>();

  private getStorageKey(invoiceId: number | string): string {
    return `${STORAGE_PREFIX}${invoiceId}`;
  }

  /**
   * Resolves the best available Web Storage engine (localStorage -> sessionStorage -> null/memoryStore).
   * Probes read/write capability to handle private browsing, disabled cookies, or sandbox restrictions.
   */
  private getStorage(): Storage | null {
    if (typeof window !== "undefined") {
      try {
        if (window.localStorage) {
          const probe = "__sun89_storage_probe__";
          window.localStorage.setItem(probe, "1");
          window.localStorage.removeItem(probe);
          return window.localStorage;
        }
      } catch {
        try {
          if (window.sessionStorage) {
            const probe = "__sun89_storage_probe__";
            window.sessionStorage.setItem(probe, "1");
            window.sessionStorage.removeItem(probe);
            return window.sessionStorage;
          }
        } catch {
          // Graceful fallback to in-memory store
        }
      }
    }
    return null;
  }

  /**
   * Checks whether cross-tab synchronization is supported by the current runtime environment.
   * Only localStorage provides cross-tab sharing. Fallback engines (sessionStorage, memoryStore)
   * are scoped to the current tab/session only and do NOT provide cross-tab protection.
   */
  public isCrossTabSupported(): boolean {
    if (typeof window !== "undefined") {
      try {
        if (window.localStorage) {
          const probe = "__sun89_storage_probe__";
          window.localStorage.setItem(probe, "1");
          window.localStorage.removeItem(probe);
          return true;
        }
      } catch {}
    }
    return false;
  }

  /**
   * Checks whether Web Locks API is supported for guaranteed cross-tab mutual exclusion.
   */
  public isWebLocksSupported(): boolean {
    return typeof navigator !== "undefined" && Boolean(navigator?.locks && typeof navigator.locks.request === "function");
  }

  private readStorage(invoiceId: number | string): PayoutIntent | null {
    const key = this.getStorageKey(invoiceId);
    const storage = this.getStorage();
    if (storage) {
      try {
        const item = storage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item) as PayoutIntent;
          this.memoryStore.set(key, parsed);
          return parsed;
        }
      } catch {
        // Fall back to memoryStore
      }
    }
    return this.memoryStore.get(key) || null;
  }

  private writeStorage(intent: PayoutIntent): void {
    const key = this.getStorageKey(intent.invoiceId);
    this.memoryStore.set(key, intent);
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem(key, JSON.stringify(intent));
      } catch {
        // Ignore quota/access errors; memoryStore retains state
      }
    }
  }

  private removeStorage(invoiceId: number | string): void {
    const key = this.getStorageKey(invoiceId);
    this.memoryStore.delete(key);
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore
      }
    }
  }

  public generateUUID(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Retrieves any existing intent for an invoice.
   */
  public getIntent(invoiceId: number | string): PayoutIntent | null {
    return this.readStorage(invoiceId);
  }

  /**
   * Retrieves an intent if it is in an unresolved state (IN_FLIGHT or UNKNOWN_OUTCOME).
   */
  public getUnresolvedIntent(invoiceId: number | string): PayoutIntent | null {
    const intent = this.readStorage(invoiceId);
    if (intent && (intent.status === "IN_FLIGHT" || intent.status === "UNKNOWN_OUTCOME")) {
      return intent;
    }
    return null;
  }

  /**
   * Asynchronously acquires or creates an intent using Web Locks API for true cross-tab mutual exclusion.
   * When Web Locks API is available, prevents two tabs from concurrently executing the initialization flow.
   * If Web Locks API is unavailable (or in storage fallback mode), falls back to getOrCreateIntent
   * where backend Optimistic Concurrency Control (OCC) serves as the authoritative primary safeguard.
   */
  public async getOrCreateIntentAsync(
    invoiceId: number | string,
    nominal?: number,
    paymentType?: "KELEBIHAN" | "KOMISI" | "ALL"
  ): Promise<PayoutIntent> {
    if (this.isWebLocksSupported()) {
      const lockName = `sun89_payout_lock_${invoiceId}`;
      try {
        return await (navigator as any).locks.request(lockName, { mode: "exclusive" }, async () => {
          return this.getOrCreateIntent(invoiceId, nominal, paymentType);
        });
      } catch {
        // Fall back to synchronous acquisition if lock request fails
      }
    }
    return this.getOrCreateIntent(invoiceId, nominal, paymentType);
  }

  /**
   * Gets an existing unresolved or active draft intent (reusing its idempotencyKey),
   * or creates a fresh DRAFT intent with a new UUID.
   * Multi-tab aware: checks storage state before creation and writing.
   * NOTE: localStorage alone does not provide atomic locking across tabs. In environments
   * without Web Locks API, backend Optimistic Concurrency Control (OCC) is the primary
   * defense against concurrent double submissions.
   */
  public getOrCreateIntent(
    invoiceId: number | string,
    nominal?: number,
    paymentType?: "KELEBIHAN" | "KOMISI" | "ALL"
  ): PayoutIntent {
    const existing = this.readStorage(invoiceId);
    if (existing) {
      if (existing.status === "IN_FLIGHT" || existing.status === "UNKNOWN_OUTCOME") {
        // Re-use existing key to prevent duplicate payments on retry
        return existing;
      }
      if (existing.status === "DRAFT") {
        // If an existing draft exists (e.g. from another tab opening the modal), share it
        if (nominal !== undefined) existing.nominal = nominal;
        if (paymentType) existing.paymentType = paymentType;
        this.writeStorage(existing);
        return existing;
      }
    }

    // Best-effort double check: generate intent and persist to storage
    const freshKey = this.generateUUID();
    const newIntent: PayoutIntent = {
      invoiceId,
      idempotencyKey: freshKey,
      status: "DRAFT",
      nominal,
      paymentType,
      createdAt: Date.now(),
    };

    const concurrentCheck = this.readStorage(invoiceId);
    if (concurrentCheck && (concurrentCheck.status === "IN_FLIGHT" || concurrentCheck.status === "UNKNOWN_OUTCOME" || concurrentCheck.status === "DRAFT")) {
      return concurrentCheck;
    }

    this.writeStorage(newIntent);
    return newIntent;
  }

  /**
   * Transitions intent to IN_FLIGHT when network request is initiated.
   */
  public markInFlight(
    invoiceId: number | string,
    metadata?: { nominal?: number; paymentType?: "KELEBIHAN" | "KOMISI" | "ALL" }
  ): PayoutIntent {
    let intent = this.readStorage(invoiceId);
    if (!intent) {
      intent = {
        invoiceId,
        idempotencyKey: this.generateUUID(),
        status: "IN_FLIGHT",
        createdAt: Date.now(),
      };
    } else {
      intent.status = "IN_FLIGHT";
    }
    intent.lastAttemptAt = Date.now();
    if (metadata?.nominal !== undefined) intent.nominal = metadata.nominal;
    if (metadata?.paymentType) intent.paymentType = metadata.paymentType;
    this.writeStorage(intent);
    return intent;
  }

  /**
   * Transitions intent to UNKNOWN_OUTCOME upon network timeout, fetch error, or lost response.
   * Crucially retains the same idempotency key for subsequent retries.
   */
  public markUnknownOutcome(invoiceId: number | string, errorMessage?: string): PayoutIntent {
    let intent = this.readStorage(invoiceId);
    if (!intent) {
      intent = {
        invoiceId,
        idempotencyKey: this.generateUUID(),
        status: "UNKNOWN_OUTCOME",
        createdAt: Date.now(),
      };
    } else {
      intent.status = "UNKNOWN_OUTCOME";
    }
    intent.error = errorMessage || "Koneksi terputus atau respon hilang saat memproses pencairan.";
    intent.lastAttemptAt = Date.now();
    this.writeStorage(intent);
    return intent;
  }

  /**
   * Transitions intent to DEFINITIVE_SUCCESS upon receiving confirmed HTTP 200 from server.
   * Cleans up the active intent storage so future legitimate payouts use fresh intents.
   */
  public markDefinitiveSuccess(invoiceId: number | string): void {
    this.removeStorage(invoiceId);
  }

  /**
   * Transitions intent to DEFINITIVE_FAILED upon receiving confirmed 4xx rejection from server.
   * Cleans up the failed intent so the user can construct a new valid intent.
   */
  public markDefinitiveFailed(invoiceId: number | string, _errorMessage?: string): void {
    this.removeStorage(invoiceId);
  }

  /**
   * Cancels a DRAFT intent when modal is closed before submission.
   * If intent is IN_FLIGHT or UNKNOWN_OUTCOME, this method preserves the intent.
   */
  public cancelDraft(invoiceId: number | string): boolean {
    const intent = this.readStorage(invoiceId);
    if (intent && intent.status === "DRAFT") {
      this.removeStorage(invoiceId);
      return true;
    }
    return false;
  }

  /**
   * Strict 7-attribute reconciliation with server invoice data:
   * Only resolves intent as DEFINITIVE_SUCCESS if server payoutHistory contains a payout record
   * that strictly matches ALL 7 criteria:
   * 1. invoiceId matches
   * 2. idempotencyKey matches
   * 3. nominal matches (if nominal specified on intent)
   * 4. paymentType / payoutType matches
   * 5. payout record ID exists and is non-empty
   * 6. kasKantorId exists, is a number, and > 0 (valid cash journal link)
   * 7. status === 'PROCESSED'
   * 
   * If any attribute mismatches, intent remains in UNKNOWN_OUTCOME (does NOT clear key).
   */
  public reconcileWithInvoice(invoiceId: number | string, payoutHistory?: any[]): boolean {
    const intent = this.readStorage(invoiceId);
    if (!intent || !Array.isArray(payoutHistory)) return false;

    const matched = payoutHistory.some((p: any) => {
      if (!p) return false;

      // 1. invoiceId check
      const invoiceMatches = String(p.invoiceId) === String(intent.invoiceId);
      if (!invoiceMatches) return false;

      // 2. idempotencyKey check
      const keyMatches = p.idempotencyKey === intent.idempotencyKey;
      if (!keyMatches) return false;

      // 3. nominal check
      if (intent.nominal !== undefined) {
        const nominalMatches = Number(p.nominal) === Number(intent.nominal);
        if (!nominalMatches) return false;
      }

      // 4. payoutType / paymentType check
      if (intent.paymentType) {
        const typeMatches =
          p.payoutType === intent.paymentType ||
          (intent.paymentType === "ALL" && (p.payoutType === "KELEBIHAN" || p.payoutType === "KOMISI"));
        if (!typeMatches) return false;
      }

      // 5. payout record ID check
      const hasRecordId = Boolean(p.id) && String(p.id).trim().length > 0;
      if (!hasRecordId) return false;

      // 6. kasKantorId check (positive integer)
      const validKasKantor = typeof p.kasKantorId === "number" && p.kasKantorId > 0;
      if (!validKasKantor) return false;

      // 7. status check
      const isProcessed = p.status === "PROCESSED";
      if (!isProcessed) return false;

      return true;
    });

    if (matched) {
      this.markDefinitiveSuccess(invoiceId);
      return true;
    }

    // On mismatch or lack of proof: strictly retain intent (do NOT clear key)
    return false;
  }

  /**
   * Resets all intent state (useful for tests and session clearing).
   */
  public clearAll(): void {
    this.memoryStore.clear();
    const storage = this.getStorage();
    if (storage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          storage.removeItem(k);
        }
      } catch {
        // Ignore
      }
    }
  }
}

export const payoutIntentManager = new PayoutIntentManager();
