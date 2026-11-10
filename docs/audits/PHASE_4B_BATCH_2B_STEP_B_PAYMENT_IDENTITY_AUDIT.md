# PHASE 4B BATCH 2B — STEP B AUDIT REPORT (FINAL REVISED DESIGN)
## Payment Identity, Idempotency Architecture & Strict Boundaries

- **Project:** SUN89 / SUNBiroJasa Admin Platform (`adminsunbirojasa`)
- **Mode:** STRICT READ-ONLY ANALYSIS (NO SOURCE CODE, TEST, OR SCHEMA CHANGES)
- **Status:** COMPLETED & PENDING USER AUTHORIZATION
- **Target Subsystem:** Payment Identity, Scoped Idempotency Storage, Input Normalization & Step Ownership
- **Date:** 2026-11-10 (Post-Review Final Correction)
- **Authoritative References:**
  - `docs/audits/PHASE_4B_BATCH_2A_PAYMENT_LIFECYCLE_AUDIT.md` (Authoritative AC-B2 Master Matrix)
  - `docs/audits/PHASE_4B_BATCH_2B_STEP_A_VALIDATION.md` (Accepted Transaction Infrastructure)

---

## 1. Executive Summary & Design Revisions

Following the formal acceptance of **Step A (Transaction Infrastructure)**, this final Step B Design Revision addresses all review findings prior to implementation authorization:

1. **Strict Format Consistency for Scoped Idempotency:**
   All references, examples, code blocks, diagrams, and test specifications uniformly use the double-colon format:
   ```typescript
   const scopedKey = `${scope}::${clientKey}`;
   ```
   All previous single-colon (`${scope}:${clientKey}`) references have been completely excised.
2. **Grounded Concurrency & SQLite Locking Model:**
   - Corrected lock description: `BEGIN IMMEDIATE;` acquires a SQLite `RESERVED` lock (not an "exclusive" lock). In SQLite WAL mode, readers proceed via `SHARED` locks on the WAL index without being blocked.
   - Concurrency serialization: A second writer transaction executing `runInTransaction` is delayed up to `PRAGMA busy_timeout = 5000;` (5000ms).
   - Busy failure behavior: If the first transaction does not commit within 5000ms, the second transaction throws `SQLITE_BUSY: database is locked`. The connection transaction depth remains 0 (anti-poisoning).
   - Client retry policy: There is **NO automatic backend retry**. The client must retry the request. Upon client retry, the first transaction has already committed, and the pre-execution idempotency lookup immediately returns the committed response with **ZERO DML**.
   - Removed non-existent `IN_PROGRESS` branch: The `idempotency_keys` table schema possesses no status column and does not persist uncommitted states. Records are committed atomically at transaction completion.
3. **Explicit Immutability Boundaries:**
   - **Repository / Service Tier:** Complete elimination of `ON CONFLICT(key) DO UPDATE`. The repository exposes only a plain `INSERT INTO idempotency_keys` and no update methods. Pre-execution dual-read returns committed data on matching retries and rejects conflicting retries with HTTP 409.
   - **Database Tier:** Uniqueness is enforced by the `key TEXT PRIMARY KEY` constraint, raising `SQLITE_CONSTRAINT_PRIMARYKEY` on duplicate raw inserts. Immutability against UPDATE is enforced at the repository and service boundary (avoiding complex and fragile database triggers).
4. **Proven Legacy Dual-Read & Strict Ownership:**
   - Operational Database Baseline: `SELECT COUNT(*) FROM idempotency_keys;` in `server/data/database.sqlite` returns **0 rows**. Legacy compatibility is supported by forensic evidence in test fixtures (e.g. `tests/idempotency-hardening.test.ts`) and previous service implementations, not active operational rows.
   - Dual-Read Query: Primary lookup on `${scope}::${clientKey}`, with fallback query on `WHERE key = ? AND scope = ?` using raw `clientKey` and `scope` (plus `'payment'` alias for `PAYMENT_SUBMISSION`).
   - Legacy Retry Immutability: An identical legacy retry returns cached data with ZERO DML and does **NOT** insert a new scoped record.
   - Cross-Scope Independence: Key `K1` used for `CREATE_ORDER` and `K1` used for `PAYMENT_SUBMISSION` resolve independently without collision.
   - Strict Ownership on `NULL` `user_id`: If `stored.user_id` is `NULL`, ownership is NOT silently bypassed. For authenticated endpoints, non-admin users attempting replay are rejected with HTTP 403 `IDEMPOTENCY_OWNERSHIP_UNVERIFIABLE`.
5. **Canonical Hash Binding for `PAYMENT_VERIFICATION`:**
   - Target Pending Resolution: If `paymentId` is omitted, pending payment resolution occurs **prior to computing the canonical hash** following fail-closed rules (1 pending -> resolve `resolvedPaymentId`; 0 pending -> 400; >1 pending -> 422).
   - Concrete Target Binding: The canonical hash strictly binds `paymentId: resolvedPaymentId`, ensuring it binds the concrete payment target rather than an ambiguous empty parameter.
   - Stable Actor Identity: Hashing binds `verifierId: req.user.userId` (permanent, immutable actor identifier) rather than volatile display name `req.user.nama`. Display name is preserved only as audit metadata.
   - Pending List Changes Between Retries: If the pending payment list changes between retries, fail-closed resolution ensures either conflict detection (HTTP 409) or ambiguous rejection (HTTP 422).
6. **Strict Input Normalization Prior to Hashing:**
   - `invoiceId`: Strictly validated as a positive integer (`/^\d+$/` and `> 0`). Partial parsing like `"12abc"` is rejected fail-closed with HTTP 400.
   - Amounts: Must be finite numbers `> 0` and `<= Number.MAX_SAFE_INTEGER`. `NaN`, `Infinity`, and negative values are rejected fail-closed with HTTP 400. Normalized via `Math.round(val)`.
   - Polymorphic Identifiers: Explicit discrimination between numeric row IDs (`/^\d+$/`) and canonical string UUIDs (`^pay-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`) without ambiguous numeric coercion.
7. **Strict Master Acceptance Matrix Realignment:**
   - 100% concordance with the Master AC-B2 Matrix from Batch 2A Section 14.10.
   - Clear separation between Step B (Identity, Schema, Scoped Idempotency, Hash, Polymorphic Lookup) and Step C (Payment Lifecycle Unification, Relational Persistence, Cash Posting, In-Place Verification).

---

## 2. Corrected SQLite Migration Strategy for `payment_id`

### 2.1 SQLite DDL Limitation & Two-Step Resolution
In SQLite, executing `ALTER TABLE invoice_payments ADD COLUMN payment_id TEXT UNIQUE;` is syntactically invalid because SQLite's `ALTER TABLE ADD COLUMN` prohibits inline `PRIMARY KEY` or `UNIQUE` constraints (`SQLITE_ERROR: Cannot add a UNIQUE column`).

The valid, non-destructive migration pattern in `server/src/database/schema.ts` is:
```sql
-- Step 1: Add nullable TEXT column
ALTER TABLE invoice_payments ADD COLUMN payment_id TEXT;

-- Step 2: Create a separate unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_payments_payment_id ON invoice_payments(payment_id);
```

### 2.2 SQLite Index Semantics & Historical Row Protection
- In SQLite, unique indexes treat `NULL` values as distinct. Multiple rows can have `payment_id IS NULL` without violating `idx_inv_payments_payment_id`.
- Therefore, all historical records (Rows #1–#7 in `server/data/database.sqlite`) **retain `payment_id = NULL`**.
- **Historical `payment_id` values must NOT be populated automatically.** They remain untouched to guarantee 100% bit-identical baseline preservation of the operational database (`898C0C...7B12C`).

### 2.3 Tiered Enforcement Model

| Tier | Enforcement Mechanism | Responsibility |
|---|---|---|
| **Database Level** | `CREATE UNIQUE INDEX idx_inv_payments_payment_id ON invoice_payments(payment_id)` | Enforces that no two non-null `payment_id` strings can collide in `invoice_payments`. Allows existing historical rows #1–#7 to remain `NULL`. |
| **Application Level** | `dbFinanceRepository.recordInvoicePayment` validation | Enforces that **all newly created payment records must provide a non-null `payment_id`** matching canonical UUID format: `^pay-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`. Throws `ApiError(400, "VALIDATION_ERROR", ...)` if missing or malformed. |

---

## 3. Strict Step B vs Step C Boundaries

The boundaries between Step B and Step C are strictly delineated:

```
┌─────────────────────────────────────────────────┬─────────────────────────────────────────────────┐
│                 STEP B SCOPE                    │                 STEP C SCOPE                    │
│     (Payment Identity & Idempotency Design)     │       (Payment Lifecycle Unification)           │
├─────────────────────────────────────────────────┼─────────────────────────────────────────────────┤
│ 1. Canonical UUID identity generation           │ 1. In-place payment verification state          │
│    (`pay-${crypto.randomUUID()}`).              │    transition (MENUNGGU -> TERVERIFIKASI).      │
│ 2. Schema extension (nullable column + unique   │ 2. Elimination of sibling `pay-verif-...`       │
│    index on `invoice_payments`).                │    record append in `orderService`.             │
│ 3. Repository CRUD support for `payment_id`.    │ 3. Relational payment persistence for Path 1    │
│ 4. Scoped idempotency (`${scope}::${clientKey}`)│    (linking order downpayment to DB row).       │
│ 5. Canonical SHA-256 payload hashing across     │ 4. Atomic `kas_kantor` Debit entry posting      │
│    all 4 operations with strict input checks.   │    linked via `kas_kantor_id`.                  │
│ 6. Polymorphic identifier lookup                │ 5. Ambiguous payment verification targeting     │
│    (integer `id` vs string `payment_id`).       │    rejection (fail-closed guard execution).     │
│ 7. Dual-read legacy idempotency compatibility.  │ 6. Double-verification idempotency (0 cash).    │
└─────────────────────────────────────────────────┴─────────────────────────────────────────────────┘
```

**Step B must NOT implement lifecycle mutations, cash ledger postings, or verification transitions.** Those belong exclusively to Step C.

---

## 4. Identity Creation Across Both Payment Paths

Currently, two disparate paths introduce payments into the platform:

```
Path 1: Order Creation (Downpayment)                Path 2: Finance Invoice Payment
────────────────────────────────────                ───────────────────────────────
Caller: BuatOrder / POST /api/orders                Caller: FinanceContent / POST /api/finance/invoices/:id/pay
Writes: orders.data_json.payment.paymentRecords     Writes: invoice_payments row AND orders.data_json
DB Row: ZERO rows in invoice_payments               DB Row: 1 row in invoice_payments (MENUNGGU_VERIFIKASI)
```

### 4.1 Canonical Identity Lifecycle by Path
1. **Path 1 (Initial Order Downpayment)**:
   - **Creation (Step B)**: In `orderService.createOrder`, the initial payment record in `orders.data_json.payment.paymentRecords[0]` is assigned a backend-generated `payment_id: "pay-" + crypto.randomUUID()`.
   - **Relational Persistence (Step C)**: Step B only assigns the canonical identity in document storage. In Step C, payment lifecycle unification will define and implement the persistence of this initial payment into `invoice_payments`. Step B does **NOT** claim a guaranteed 1:1 JSON/DB mapping until Step C implements this relational persistence.
2. **Path 2 (Finance Invoice Payment Submission)**:
   - **Creation (Step B)**: In `financeService.recordPayment`, the backend generates `payment_id: "pay-" + crypto.randomUUID()`.
   - **Persistence (Step B)**: The `payment_id` is persisted directly into `invoice_payments.payment_id` and into `orders.data_json.payment.paymentRecords[i].id`. A 1:1 mapping exists immediately.
3. **Later Payment Verification (Step C)**:
   - When `orderService.verifyPayment` is invoked, it targets the specific `payment_id`.
   - In Step C, it locates the targeted record in `paymentRecords`, mutates its status in-place to `TERVERIFIKASI`, updates/inserts the corresponding row in `invoice_payments`, and posts the Debit to `kas_kantor`.

---

## 5. Ambiguous Payment Verification Targeting & Step B Hash Binding

When a client calls `POST /api/orders/:orderNo/verify-payment`:

```typescript
interface VerifyPaymentPayload {
  paymentId?: string;           // Optional for backward compatibility
  confirmedAmount?: number;
  notes?: string;
  buktiPembayaran?: any;
}
```

### 5.1 Pre-Hash Target Resolution Rules (Step B / Step C Contract):
Prior to calculating the idempotency hash for `PAYMENT_VERIFICATION`:
1. **Explicit `paymentId` provided**:
   - The service verifies that `paymentId` exists within `order.payment.paymentRecords`.
   - If not found: Reject fail-closed with HTTP 404 `PAYMENT_NOT_FOUND`.
   - Resolved target: `resolvedPaymentId = payload.paymentId.trim()`.
2. **`paymentId` omitted (Legacy Fallback Resolution)**:
   - The service filters `order.payment.paymentRecords` for unverified payments (`statusVerifikasi IN ('MENUNGGU_VERIFIKASI', 'MENUNGGU_BUKTI')`).
   - **Case A: Exactly ONE eligible pending payment**:
     - Backward-compatible fallback permitted: `resolvedPaymentId = pendingPayments[0].id`.
   - **Case B: MULTIPLE eligible pending payments**:
     - **STRICT FAIL-CLOSED REJECTION**: Reject with HTTP 422 `AMBIGUOUS_PAYMENT_TARGET`:
       `"Terdapat lebih dari satu pembayaran yang belum diverifikasi pada order ini. Harap tentukan paymentId secara eksplisit."`
     - **NEVER silently select the first payment.**
   - **Case C: ZERO eligible pending payments**:
     - Reject with HTTP 400 `NO_PENDING_PAYMENT`:
       `"Tidak ada pembayaran yang menunggu verifikasi pada order ini."`

### 5.2 Dynamic Pending List Mutation Between Retries
If the pending payments list changes between an initial request and a client retry:
- Because the canonical hash binds `resolvedPaymentId`, if a second pending payment was added in the interim, omitting `paymentId` on the retry will trigger Case B and fail-closed with HTTP 422 `AMBIGUOUS_PAYMENT_TARGET`.
- If an explicit `paymentId` was sent, the hash is immutable; if that payment has already been verified by the earlier attempt, the idempotency check returns the cached verified response with ZERO DML.

---

## 6. Concurrency Flow, SQLite Locking & Immutability Architecture

### 6.1 Grounded SQLite Concurrency & Locking Reality
SQLite in WAL mode does not utilize monolithic exclusive table locks during standard operations:
- **Lock Progression:** `UNLOCKED -> SHARED -> RESERVED -> PENDING -> EXCLUSIVE`.
- **`BEGIN IMMEDIATE;` Behavior:** In `server/src/database/db.ts:250`, calling `activeDb.exec("BEGIN IMMEDIATE;");` immediately acquires a **`RESERVED` lock** on the database file.
- **Readers are Never Blocked:** Read-only queries running under `SHARED` locks on separate connections continue reading from the WAL log without delay.
- **Writer Serialization:** A second connection attempting `BEGIN IMMEDIATE;` is blocked because only one connection can hold a `RESERVED` lock at any time.
- **Busy Timeout & Delay:** In `server/src/database/db.ts:100`, the connection sets `PRAGMA busy_timeout = 5000;`. The second connection waits synchronously up to 5000ms for Connection 1 to `COMMIT;` or `ROLLBACK;`.
- **Busy Timeout Expiration:** If Connection 1 does not complete within 5000ms, Connection 2 throws `SQLITE_BUSY: database is locked`. Connection 2's transaction depth remains 0 (anti-poisoning guard verified in Step A).
- **Client Retry Requirement:** There is **NO automatic backend retry**. The error propagates to `errorHandler.ts`, returning HTTP 500 (or HTTP 503). The client application must retry the request.
- **Subsequent Retry Behavior:** By the time the client retries with the same `clientKey`, Connection 1 has completed and committed. Connection 2 acquires the lock, executes the dual-read check, discovers the committed idempotency key, and returns the committed response with **ZERO DML**.

### 6.2 Architectural Immutability Boundaries
- **Repository / Service Boundary:**
  - `dbFinanceRepository.saveIdempotencyRecord` currently uses `ON CONFLICT(key) DO UPDATE`. This will be **completely removed**.
  - In Step B, `saveIdempotencyRecord` executes a plain `INSERT INTO idempotency_keys (key, scope, user_id, request_hash, resource_id, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`.
  - The repository exposes no `updateIdempotencyRecord` method.
  - The service layer performs pre-execution read validation. Once committed, no service method can mutate an idempotency record.
- **Database Schema Boundary:**
  - `key TEXT PRIMARY KEY` in SQLite automatically raises `SQLITE_CONSTRAINT_PRIMARYKEY` on duplicate insertion attempts.
  - Immutability against overwrite is achieved by eliminating `ON CONFLICT DO UPDATE` at the repository layer and rejecting duplicate execution at the service layer, avoiding unnecessary database triggers.

### 6.3 Grounded Execution Flow

```
                         Client Request Arrives
                                   │
                                   ▼
        ┌────────────────────────────────────────────────────────┐
        │ STEP 1: Strict Validation & Target Resolution          │
        │ - Validate types: positive integer invoiceId, finite   │
        │   positive amounts (reject NaN / negative / partial)   │
        │ - If PAYMENT_VERIFICATION & paymentId omitted:         │
        │   Resolve single pending payment (fail-closed if != 1) │
        │ - Compute SHA-256 of canonical fields                  │
        └──────────────────────────┬─────────────────────────────┘
                                   │
                                   ▼
        ┌────────────────────────────────────────────────────────┐
        │ STEP 2: Dual-Read Idempotency Lookup                   │
        │ 1. Primary: key = `${scope}::${clientKey}`             │
        │ 2. Fallback: key = clientKey AND scope = scope         │
        │    (with 'payment' -> 'PAYMENT_SUBMISSION' fallback)   │
        └──────────────────────────┬─────────────────────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
        Existing Record Found                 No Record Found
                │                                     │
        ┌───────┴───────┐                             ▼
        │ Validate:     │            ┌───────────────────────────────────┐
        │ 1. Ownership  │            │ STEP 3: Begin Write Transaction   │
        │ 2. Hash Match │            │ runInTransaction(BEGIN IMMEDIATE) │
        └───────┬───────┘            │ (Delays up to 5000ms busy_timeout)│
                │                    └─────────────────┬─────────────────┘
        ┌───────┴───────┐                              │
        ▼               ▼                              ▼
    Mismatch          Match          ┌───────────────────────────────────┐
   (Tampering)       (Retry)         │ STEP 4: Business Execution        │
        │               │            │ - Generate UUID payment_id        │
        ▼               ▼            │ - Execute domain validations      │
    Reject 409    Return Stored      │ - Persist entity updates          │
    (0 DML)       Response (0 DML)   └─────────────────┬─────────────────┘
                                                       │
                                                       ▼
                                     ┌───────────────────────────────────┐
                                     │ STEP 5: Plain Immutable Insert    │
                                     │ INSERT INTO idempotency_keys      │
                                     │ (NO ON CONFLICT DO UPDATE)        │
                                     └─────────────────┬─────────────────┘
                                                       │
                                                       ▼
                                     ┌───────────────────────────────────┐
                                     │ STEP 6: Commit & Return           │
                                     │ COMMIT; -> HTTP 200 / 201         │
                                     └───────────────────────────────────┘
```

### 6.4 Detailed Validation Rules on Conflict
When an existing record is encountered during pre-execution lookup:
1. **User Ownership Validation**:
   - If `stored.user_id` is present and non-null:
     - If `stored.user_id !== req.user.userId`:
       - Throw `ApiError(403, "IDEMPOTENCY_USER_MISMATCH", "Idempotency key milik pengguna lain.")`.
   - If `stored.user_id` is `NULL` (historical legacy row):
     - Ownership cannot be verified against the authenticated user.
     - **Fail-Closed Rule:** If `req.user.role !== "admin"`, throw `ApiError(403, "IDEMPOTENCY_OWNERSHIP_UNVERIFIABLE", "Kepemilikan record historis tidak dapat diverifikasi; hubungi administrator.")`. Ownership check is **never silently bypassed**.
2. **Request Hash Semantic Validation**:
   - If `stored.request_hash !== incoming.request_hash`:
     - Throw `ApiError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key sudah digunakan untuk transaksi dengan parameter berbeda.")`.
3. **Identical Retry**:
   - If `stored.request_hash === incoming.request_hash`:
     - Return the stored `response_json` (or fresh entity state).
     - **Execute ZERO DML** (no duplicate payment, no cash ledger mutation, no new UUID generation).

---

## 7. Proven Legacy Dual-Read Compatibility

### 7.1 Operational Schema & Data Baseline
Forensic inspection of `server/data/database.sqlite` via `PRAGMA table_info(idempotency_keys)` confirms:
- Columns: `key` (TEXT, PK), `scope` (TEXT, NOT NULL), `request_hash` (TEXT, NOT NULL), `resource_id` (TEXT), `response_json` (TEXT, NOT NULL), `created_at` (TEXT), `user_id` (TEXT).
- Index: `CREATE INDEX idx_idempotency_scope ON idempotency_keys(scope, key);`.
- **Operational Row Count:** `SELECT COUNT(*) FROM idempotency_keys;` returns **0 rows**.
- **Evidence Source:** Legacy compatibility is required because test fixtures (e.g. `tests/idempotency-hardening.test.ts:37` using `idem-...` keys) and historical services (`orderService.ts:485` querying `WHERE key = ? AND scope = 'CREATE_ORDER'`) utilize unprefixed keys.

### 7.2 Delimiter Ambiguity Prevention
- The scoping separator strictly uses double-colons:
  ```typescript
  const SCOPE_DELIMITER = "::";
  const scopedKey = `${scope}::${clientKey}`;
  ```
- Because `scope` is strictly restricted to four internal enum values (`CREATE_ORDER`, `PAYMENT_SUBMISSION`, `PAYMENT_VERIFICATION`, `PAYMENT_VOID`), any key starting with `${scope}::` is unambiguously parsed even if `clientKey` contains single colons (e.g. `client:key:123`).

### 7.3 Dual-Read Query Logic & No Duplicate Insertion
```typescript
export function getIdempotencyRecord(clientKey: string, scope: string): IdempotencyRecord | undefined {
  const scopedKey = `${scope}::${clientKey}`;

  // 1. Primary Lookup: Look for new scoped key
  const stmtScoped = db.prepare("SELECT * FROM idempotency_keys WHERE key = ?");
  const recordScoped = stmtScoped.get(scopedKey) as IdempotencyRecord | undefined;
  if (recordScoped) return recordScoped;

  // 2. Dual-Read Fallback: Look for legacy unprefixed key matching this exact scope
  const stmtLegacy = db.prepare("SELECT * FROM idempotency_keys WHERE key = ? AND scope = ?");
  const recordLegacy = stmtLegacy.get(clientKey, scope) as IdempotencyRecord | undefined;
  if (recordLegacy) return recordLegacy;

  // 3. Fallback for legacy scope alias: 'payment' -> 'PAYMENT_SUBMISSION'
  if (scope === "PAYMENT_SUBMISSION") {
    const recordLegacyAlias = stmtLegacy.get(clientKey, "payment") as IdempotencyRecord | undefined;
    if (recordLegacyAlias) return recordLegacyAlias;
  }

  return undefined;
}
```

**Guarantees**:
1. When a legacy request is retried, Step 2 finds the legacy record under raw `clientKey`.
2. Because it is an identical retry, it returns the cached response with **ZERO DML**; it does **NOT** insert a second scoped record.
3. If an existing record was stored under a different scope (e.g. `CREATE_ORDER`), the fallback query with `scope = 'PAYMENT_SUBMISSION'` returns `undefined`, completely preventing cross-scope collision.

---

## 8. Strict Input Normalization & DTO-to-Hash Field Mapping

### 8.1 Universal Input Validation Rules (Pre-Hashing)
Before constructing the canonical payload for hashing:
1. **Invoice ID Validation:**
   - Must be a valid positive integer.
   - Checked via `/^\d+$/` and `Number(val) > 0`.
   - Partial string parsing like `"12abc"`, `"-5"`, `"0"`, `"1.5"` is rejected fail-closed with HTTP 400 `[INVALID_INVOICE_ID]`.
2. **Monetary Amounts (`totalBiaya`, `nominal`, `amount`, `confirmedAmount`):**
   - Must be finite, positive numbers: `Number.isFinite(num) && !Number.isNaN(num) && num > 0 && num <= Number.MAX_SAFE_INTEGER`.
   - `NaN`, `Infinity`, negative numbers, and `0` are rejected fail-closed with HTTP 400 `[INVALID_AMOUNT]`.
   - Normalized via `Math.round(num)` (integer Rupiah).
3. **Empty / Undefined / Null / Default Values:**
   - Field aliases are mapped to canonical names upfront.
   - Text fields (`notes`, `catatan`, `metode`): trimmed; undefined/null normalized to empty string `""` or canonical default (`"-"`). Consecutive whitespace replaced with single space.
   - Phone numbers: all whitespace, dots, and dashes stripped (`val.replace(/[\s\-\.]/g, "")`). Must contain 8–16 digits.
4. **Polymorphic Identifier Discrimination (`id` vs `payment_id`):**
   - In routes like `POST /api/finance/invoices/:id/payments/:paymentId/void`:
     - If `/^\d+$/` matches: parsed as integer `id` (`SELECT * FROM invoice_payments WHERE id = ?`).
     - If `^pay-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` matches: queried as string `payment_id` (`SELECT * FROM invoice_payments WHERE payment_id = ?`).
     - Any other format: rejected fail-closed with HTTP 400 `[INVALID_PAYMENT_IDENTIFIER]`. Ambiguous coercion via `Number("pay-...")` (which yields `NaN`) is completely prevented.

---

### 8.2 DTO-to-Hash Mapping Across All Four Operations

#### Operation 1: `CREATE_ORDER` (`POST /api/orders`)
- **Controller**: `orderController.createOrder` ([orderController.ts:25](file:///d:/Admin/adminsunbirojasa/server/src/controllers/orderController.ts#L25))
- **Service**: `orderService.createOrderWithIdempotency` ([orderService.ts:462](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L462))
- **Normalizer**: `normalizeOrderPayload` ([aliasNormalizer.ts:616](file:///d:/Admin/adminsunbirojasa/server/src/utils/aliasNormalizer.ts#L616))

| Incoming Field | Normalized Field | Changes Semantics? | Included in Hash? | Normalization / Parsing Logic |
|---|---|---|---|---|
| `customer` / `namaPelanggan` | `customer` | **Yes** (Customer identity) | **YES** | String trimmed, whitespace collapsed |
| `nomorHP` / `telepon` / `no_hp` | `nomorHP` | **Yes** (Customer contact) | **YES** | Stripped of spaces, dashes, dots; 8-16 digits |
| `layanan` / `serviceId` | `layanan` | **Yes** (Service selection) | **YES** | Canonicalized via `CANONICAL_SERVICES_MAP` |
| `nopol` / `platNomor` | `nopol` | **Yes** (Vehicle identity) | **YES** | Uppercase, stripped of spaces and dashes |
| `wilayahSamsatAsal` / `samsatAsalId` | `wilayahSamsatAsal` | **Yes** (Pricing jurisdiction) | **YES** | Trimmed, lowercase |
| `wilayahSamsatTujuan` | `wilayahSamsatTujuan` | **Yes** (Pricing jurisdiction) | **YES** | Trimmed, lowercase (defaults to '-') |
| `totalBiaya` / `totalEstimasi` | `totalBiaya` | **Yes** (Contract total) | **YES** | Finite number rounded to integer |
| `payment.nominalDibayarAwal` | `payment.nominal` | **Yes** (Downpayment) | **YES** | Finite number rounded to integer |
| `payment.metodePembayaran` | `payment.metode` | **Yes** (Payment channel) | **YES** | Trimmed string |
| `payment.namaBank` / `bank` | `payment.bank` | **Yes** (Bank partner) | **YES** | Trimmed string |
| `payment.buktiPembayaran.documentId` | `payment.documentId`| **Yes** (Audit evidence) | **YES** | Validated document UUID string |
| `clientRequestId` / `idempotencyKey` | N/A | No (Is the lookup key) | **NO** | Used as `${scope}::${clientKey}` |
| `createdAt` / `timestamp` | N/A | No (System metadata) | **NO** | Excluded to prevent false hash mismatches |

---

#### Operation 2: `PAYMENT_SUBMISSION` (`POST /api/finance/invoices/:id/pay`)
- **Controller**: `financeController.payInvoice` ([financeController.ts:60](file:///d:/Admin/adminsunbirojasa/server/src/controllers/financeController.ts#L60))
- **Service**: `financeService.recordPayment` ([financeService.ts:54](file:///d:/Admin/adminsunbirojasa/server/src/services/financeService.ts#L54))
- **Normalizer**: `normalizeInvoicePaymentPayload` ([aliasNormalizer.ts:652](file:///d:/Admin/adminsunbirojasa/server/src/utils/aliasNormalizer.ts#L652))

| Incoming Field | Normalized Field | Changes Semantics? | Included in Hash? | Normalization / Parsing Logic |
|---|---|---|---|---|
| `req.params.id` | `invoiceId` | **Yes** (Target invoice) | **YES** | Strict positive integer check (`/^\d+$/`) |
| `amount` / `nominal` / `jumlah` | `amount` | **Yes** (Payment amount) | **YES** | Finite positive number rounded to integer |
| `details.tanggalBayar` / `tanggal` | `tanggalBayar` | **Yes** (Payment date) | **YES** | Normalized to `YYYY-MM-DD` |
| `details.metodePembayaran` | `metodePembayaran` | **Yes** (Payment channel) | **YES** | Trimmed string |
| `details.namaBank` / `bank` | `namaBank` | **Yes** (Banking partner) | **YES** | Trimmed string |
| `details.nomorRekening` / `noRek` | `nomorRekening` | **Yes** (Account identity) | **YES** | Stripped of spaces and dashes |
| `details.documentId` / `bukti.docId` | `documentId` | **Yes** (Supporting evidence)| **YES** | String document ID; strictly evidence, not payment identity |
| `details.catatan` / `notes` | `catatan` | **Yes** (Audit memo) | **YES** | Trimmed string |
| `idempotencyKey` / `headerKey` | N/A | No (Is the lookup key) | **NO** | Used as `${scope}::${clientKey}` |

---

#### Operation 3: `PAYMENT_VERIFICATION` (`POST /api/orders/:orderNo/verify-payment`)
- **Controller**: `orderController.verifyPayment` ([orderController.ts:260](file:///d:/Admin/adminsunbirojasa/server/src/controllers/orderController.ts#L260))
- **Service**: `orderService.verifyPayment` ([orderService.ts:2127](file:///d:/Admin/adminsunbirojasa/server/src/services/orderService.ts#L2127))

| Incoming Field | Normalized Field | Changes Semantics? | Included in Hash? | Normalization / Parsing Logic |
|---|---|---|---|---|
| `req.params.orderNo` | `orderNo` | **Yes** (Target order) | **YES** | Trimmed, uppercase |
| `paymentId` (or resolved fallback) | `paymentId` | **Yes** (Concrete target) | **YES** | **Pre-resolved** target payment UUID (never empty in hash) |
| `confirmedAmount` | `confirmedAmount` | **Yes** (Verified amount) | **YES** | Finite positive number rounded to integer |
| `notes` | `notes` | **Yes** (Verification note) | **YES** | Trimmed string |
| `buktiPembayaran.documentId` | `documentId` | **Yes** (Supporting evidence)| **YES** | Validated document UUID string |
| `req.user.userId` | `verifierId` | **Yes** (Permanent actor) | **YES** | Taken from authenticated `req.user.userId` (display name `req.user.nama` excluded from hash) |

---

#### Operation 4: `PAYMENT_VOID` (`POST /api/finance/invoices/:id/payments/:paymentId/void`)
- **Controller**: `financeController.voidInvoicePayment` ([financeController.ts:234](file:///d:/Admin/adminsunbirojasa/server/src/controllers/financeController.ts#L234))
- **Service**: `financeService.voidInvoicePayment` ([financeService.ts:889](file:///d:/Admin/adminsunbirojasa/server/src/services/financeService.ts#L889))

| Incoming Field | Normalized Field | Changes Semantics? | Included in Hash? | Normalization / Parsing Logic |
|---|---|---|---|---|
| `req.params.id` | `invoiceId` | **Yes** (Invoice ID) | **YES** | Strict positive integer check (`/^\d+$/`) |
| `req.params.paymentId` | `paymentId` | **Yes** (Target payment) | **YES** | Polymorphic identifier (integer or canonical UUID string) |
| `reason` / `voidReason` / `alasan` | `voidReason` | **Yes** (Audit justification)| **YES** | Trimmed string, min 10 chars |
| `req.user.userId` | `voidedBy` | **Yes** (Permanent actor) | **YES** | Taken from authenticated `req.user.userId` |

---

## 9. Realigned Step B Test Coverage Matrix

The Step B test suite (`tests/phase4b-batch2b-stepB-payment-identity.test.ts`) is strictly scoped to identity, schema, scoped idempotency, input normalization, and polymorphic lookup. It does **NOT** assert Step C lifecycle mutations, aggregation, or cash postings.

| Test Identifier | Master AC Reference | Test Description | Success Condition |
|---|---|---|---|
| `TEST-B2-01` | **AC-B2-07** | Backend Canonical UUID Generation | `orderService.createOrder` and `financeService.recordPayment` generate `payment_id` adhering to `pay-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}`. |
| `TEST-B2-02` | **AC-B2-07** (Supporting AC-B2-05 Foundation) | Distinct UUIDs for Multiple Partial Payments | Two legitimate partial payments of Rp 500.000 on the same date for the same order receive distinct `payment_id`s without collision. |
| `TEST-B2-03` | **AC-B2-07** | Stable Identity on Identical Retry | Re-submitting payment creation with identical key and payload returns the original `payment_id`; zero new UUIDs generated. |
| `TEST-B2-04` | **AC-B2-07** | Database Unique Constraint Rejection | Attempting to insert a duplicate non-null `payment_id` into `invoice_payments` triggers `SQLITE_CONSTRAINT_UNIQUE` on `idx_inv_payments_payment_id`. |
| `TEST-B2-05` | **Step B Idempotency** (Supporting AC-B2-09, AC-B2-19) | Same Idempotency Key + Same Payload | Returns cached response with HTTP 200; executes **ZERO DML** in `invoice_payments` and `idempotency_keys`. |
| `TEST-B2-06` | **Step B Idempotency** (Supporting AC-B2-09, AC-B2-19) | Same Idempotency Key + Different Payload | Re-submitting same key with changed amount throws HTTP 409 `[IDEMPOTENCY_CONFLICT]`; existing record is **never overwritten**. |
| `TEST-B2-07` | **Step B Idempotency** | Cross-Scope Key Reuse Independence | Key `REQ-001` submitted under `CREATE_ORDER::REQ-001` and `PAYMENT_SUBMISSION::REQ-001` execute independently without primary key collision. |
| `TEST-B2-08` | **Step B Idempotency** | Legacy Unprefixed Key Retry Compatibility | An idempotency key stored in legacy format (`REQ-...` without scope prefix) is retrieved via dual-read fallback on retry, returning cached response without inserting duplicate row. |
| `TEST-B2-09` | **Step B Idempotency & Security** | Ownership Enforcement & NULL Handling | Verifies HTTP 403 on user mismatch. Verifies HTTP 403 `IDEMPOTENCY_OWNERSHIP_UNVERIFIABLE` when `stored.user_id` is NULL unless caller is admin. |
| `TEST-B2-10` | **AC-B2-17** | Document ID Decoupling from Payment Identity | Two distinct payments referencing the same `documentId` (e.g. combined transfer receipt) retain separate `payment_id`s and are never merged. |
| `TEST-B2-11` | **Step B Idempotency** | Repository-Level Immutability | Verifies that `saveIdempotencyRecord` cannot update existing records (duplicate insert throws constraint error; repository exposes no update method). |
| `TEST-B2-12` | **Step B Polymorphic Lookup** (Supporting AC-B2-19) | Polymorphic Identifier Resolution | Repository resolves payment correctly whether passed integer `id` (e.g. `1`) or string `payment_id` (e.g. `pay-uuid`); invalid formats rejected fail-closed. |
| `TEST-B2-13` | **Step B Normalization & Hashing** | Strict Input Normalization & Stable Actor Binding | Verifies rejection of `"12abc"`, `NaN`, negative amounts, and asserts that `PAYMENT_VERIFICATION` hash binds resolved `paymentId` and permanent `userId`. |

---

## 10. Master Acceptance Matrix Alignment

Authoritative alignment against Batch 2A Section 14.10 Master Acceptance Matrix:

| Master AC ID | Authoritative Scope | Responsible Step | Current Status |
|---|---|---|---|
| **AC-B2-01** | `orderService.verifyPayment` atomically mutates payment to `TERVERIFIKASI` | **Step C** | Pending Step C Implementation |
| **AC-B2-02** | `orderService.verifyPayment` atomically inserts Debit in `kas_kantor` | **Step C** | Pending Step C Implementation |
| **AC-B2-03** | Startup backfill payment insertion disabled during boot | **Step D** | Pending Step D Implementation |
| **AC-B2-04** | Ambiguous legacy 0-row invoices not backfilled with synthetic rows | **Step D** | Pending Step D Implementation |
| **AC-B2-05** | Multiple partial payments remain distinct & independently verifiable | **Step C** (Step B Identity Foundation) | Step B Design Validated |
| **AC-B2-06** | Targeted payment verification preserves ID, mutates in-place (no siblings) | **Step C** | Pending Step C Implementation |
| **AC-B2-07** | Payment identity uses collision-safe UUID (`crypto.randomUUID()`) | **Step B** | **Step B Design Validated** |
| **AC-B2-08** | Multi-payment verification and void isolation across partial payments | **Step C** | Pending Step C Implementation |
| **AC-B2-09** | Re-verifying verified payment is idempotent (0 duplicate cash rows) | **Step C** (Step B Idempotency Foundation) | Step B Design Validated |
| **AC-B2-10** | Voiding verified payment posts Kredit reversal in `kas_kantor` | **Step E** | Pending Step E Implementation |
| **AC-B2-11** | Voiding payment missing original cash entry produces 0 reversals | **Step E** | Pending Step E Implementation |
| **AC-B2-12** | Repeated void requests on voided payment are idempotent (0 cash rows) | **Step E** | Pending Step E Implementation |
| **AC-B2-13** | Concurrency serialization: `BEGIN IMMEDIATE;` prevents race conditions | **Step C** (Step A Infra Prerequisite) | Step A Accepted |
| **AC-B2-14** | Transaction atomicity: Failure during recalculation rolls back all | **Step C** (Step A Infra Prerequisite) | Step A Accepted |
| **AC-B2-15** | Transaction helper hardening: Anti-poisoning on BEGIN failure | **Step A** | **ACCEPTED & VERIFIED** |
| **AC-B2-16** | Transaction helper async prohibition: Pre-invocation rejection | **Step A** | **ACCEPTED & VERIFIED** |
| **AC-B2-17** | Document proof (`documentId`) never used as sole merge/identity key | **Step B** | **Step B Design Validated** |
| **AC-B2-18** | Zero physical mutations to historical records (Payments #1–#7) | **Final / Integration** | **100% Bit-Identical Baseline** |
| **AC-B2-19** | Existing API response contracts 100% preserved | **Step B & Step C** | Step B Design Validated |
| **AC-B2-20** | Unresolved historical anomalies deferred to Batch 4 (BD-FIN-01) | **Final / Integration** | Preserved Untouched |

---

## 11. Explicit Decisions Requiring User Approval

1. **Two-Step Migration Strategy**:
   - Approve adding `payment_id TEXT` (nullable) followed by `CREATE UNIQUE INDEX idx_inv_payments_payment_id ON invoice_payments(payment_id)`.
   - Historical rows #1–#7 remain `NULL` (untouched), while new inserts require a non-null canonical UUID enforced at the application tier.
2. **Repository-Level Immutability**:
   - Approve replacing `ON CONFLICT DO UPDATE` with immutable plain `INSERT`, accompanied by pre-execution dual-read validation.
3. **Double-Colon Scope Prefixing (`${scope}::${clientKey}`)**:
   - Approve the `::` delimiter across all scopes to eliminate ambiguity when `clientKey` contains single colons.
4. **Pre-Hash Target Resolution for `PAYMENT_VERIFICATION`**:
   - Approve pre-resolving the target pending payment before hashing, binding `resolvedPaymentId` and permanent actor `userId`.
5. **Fail-Closed Ownership Check for NULL `stored.user_id`**:
   - Approve rejecting non-admin attempts to replay legacy idempotency records having `stored.user_id = NULL` with HTTP 403 `IDEMPOTENCY_OWNERSHIP_UNVERIFIABLE`.

---

## 12. Final Baseline & Strict Stop Protocol

### 12.1 Cryptographic Baseline Verification
- **Operational Database**: `server/data/database.sqlite`
  - Size: `1,441,792 bytes` (100% MATCH)
  - SHA-256: `898C0C7127D49392D40CA3A6AB73BA16E1F92C67E2C6E8D95EF5D81FEEC7B12C` (**100% BIT-IDENTICAL MATCH**)
- **Upload Directory**: `server/uploads` (51 files, `1,525,984 bytes`)
  - Manifest SHA-256: `4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5` (**100% BIT-IDENTICAL MATCH**)
- **Source Code Modified**: **0 files**.
- **Test Files Modified**: **0 files**.
- **Database Schema Modified**: **0 tables**.
- **Migrations Executed**: **0**.

**Strict Stop Condition:** This concludes the final design validation for Step B. No code, test, schema, or database changes have been performed. Step B implementation has not been started. Awaiting your review and explicit authorization.
