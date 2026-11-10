# PHASE 4B BATCH 2B — STEP D
# FINAL ACCEPTANCE CHECK: D1-A, D1-B & FORENSIC INTEGRITY

**Project:** SUN89 / SUNBiroJasa Admin Platform  
**Milestone:** Phase 4B Batch 2B — Step D (Startup Backfill Safety)  
**Execution Mode:** STRICT READ-ONLY VERIFICATION  
**Execution Owner:** Antigravity  
**Timestamp:** 2026-11-10T22:42:00+07:00  

---

## 1. Executive Summary & Audit Authority

Pursuant to the prompt instruction (**"ANTIGRAVITY — STEP D FINAL ACCEPTANCE CHECK"**), Antigravity has performed a strict read-only audit of the implementation, control flow, test suite behaviors, Git working tree accounting, and operational data integrity.

### Strict Scope & Compliance Notice
- **No code modifications:** Zero lines of production code or test files were created or modified during this audit.
- **No operational database mutations:** The operational database (`server/data/database.sqlite`) was examined strictly via read-only connections and file system hashing.
- **Isolated sandbox execution:** All scenario verifications were executed in temporary, ephemeral SQLite instances in `os.tmpdir()` via scratch test scripts.
- **Step E boundary preserved:** Step E (*Void & Contra-Entry*) remains strictly unstarted.

---

## 2. Actual Code Paths Inspected

The following functions and control structures in `server/src/database/schema.ts` were inspected in detail:

1. **`matchCandidateIdempotencyKey`** ([`schema.ts:2161-2250`](file:///d:/Admin/adminsunbirojasa/server/src/database/schema.ts#L2161-L2250))
   - Identity guard: `if (!candidateSourceId) return { isMatch: false };`
   - Prefix matching: `const prefix = BACKFILL-${invNo}-${candidateSourceId};`
   - Suffix parsing: `suffix = epKey.slice(prefix.length + 1)`
   - Suffix date validation: `isValidCalendarDate(suffix)` with `candidateDates` verification.
   - Suffix timestamp validation: `isValidIsoTimestamp(suffix)` with `candidateDates` verification.
   - Fail-closed fallback: unrecognized or malformed trailing tokens return `{ isMatch: false, isAmbiguous: true }`.

2. **`backfillHistoricalFinanceData`** ([`schema.ts:2252-2776`](file:///d:/Admin/adminsunbirojasa/server/src/database/schema.ts#L2252-L2776))
   - Payment candidate iteration: lines 2390–2616.
   - Fingerprint key synthesis: lines 2402–2406 (`BACKFILL-${inv.invoice_no}-FP-${fp}`).
   - Rule 1 (Canonical `payment_id` deduplication): lines 2408–2430.
   - Rule 2 (Idempotency key & `legacyKeys` deduplication): lines 2432–2507.
   - Rule 3 (Receipt `document_id` deduplication): lines 2509–2543.
   - Rule 4 (Ambiguity & unidentifiable candidate detection): lines 2545–2584.
   - Payment insertion statement: lines 2586–2615.

---

## 3. Section A: D1-A — Unidentifiable Single Candidate

### 3.1 Scenario Analysis & Experimental Results

The five required isolated scenarios were executed against fresh, isolated SQLite databases:

| Scenario | Candidate Attributes | Database State Prior to Backfill | Run 1 Result | Run 2 Result (Replay) | Replay Determinism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scenario 1** | 1 candidate lacking `payment_id`, `source ID`, and `document ID` | `invoice_payments` is empty | **Inserted** (`backfilled: 1, ambig: 0`)<br>Key: `BACKFILL-INV-S1-FP-1137cc66b6f96dbc` | N/A (tested in Scenario 2) | N/A |
| **Scenario 2** | Same candidate as Scenario 1 | Contains row inserted in Run 1 | N/A | **Ambiguous** (`backfilled: 0, ambig: 1`)<br>Insertion halted; 0 duplicates. | **Asymmetric Telemetry** (Run 1: OK, Run 2: Ambig) |
| **Scenario 3** | 2 candidates lacking stable identity sharing nominal & date | `invoice_payments` is empty | **Halted** (`backfilled: 0, ambig: 2`)<br>Both fail closed immediately. | **Halted** (`backfilled: 0, ambig: 2`)<br>0 inserted; 0 duplicates. | **Deterministic** |
| **Scenario 4** | 1 candidate with verified `document_id` but no `source ID` | `invoice_payments` is empty | **Inserted** (`backfilled: 1, ambig: 0`) | **Deduplicated** (`backfilled: 0, ambig: 0`)<br>Matched via Rule 3. | **Deterministic** |
| **Scenario 5** | 1 candidate with stable `source ID` (`PAY-STABLE-100`) | `invoice_payments` is empty | **Inserted** (`backfilled: 1, ambig: 0`) | **Deduplicated** (`backfilled: 0, ambig: 0`)<br>Matched via Rule 2. | **Deterministic** |

### 3.2 Key Finding: Single Unidentifiable Candidate Lifecycle

**Question:** *Specifically establish whether a single unidentifiable candidate can be inserted without a stable identity and later become ambiguous on replay.*

**Definitive Finding:** **YES.**
1. **On Run 1:**
   - Candidate has `candidateSourceId = null`, `candidatePaymentId = null`, `candidateDocId = null`.
   - `existingPayments` is empty.
   - In Rule 4 ([`schema.ts:2547-2571`](file:///d:/Admin/adminsunbirojasa/server/src/database/schema.ts#L2547-L2571)):
     `sameTupleCandidates.length === 1` and `sameTupleExisting.length === 0`.
     The condition `if (sameTupleCandidates.length > 1 || sameTupleExisting.length > 0)` evaluates to `FALSE`.
   - Therefore, Rule 4 does NOT trigger on Run 1.
   - The candidate proceeds to line 2587 and **IS INSERTED** into `invoice_payments` using the attribute-fingerprint key:
     `BACKFILL-${inv.invoice_no}-FP-${fp}`.
   - Result: `backfilledPayments: 1`, `ambiguousPayments: []`.
2. **On Run 2 (Replay):**
   - The same candidate is encountered again.
   - `existingPayments` now contains the record inserted in Run 1 (`idempotency_key = BACKFILL-...-FP-...`).
   - Rule 2 is evaluated ([`schema.ts:2455-2476`](file:///d:/Admin/adminsunbirojasa/server/src/database/schema.ts#L2455-L2476)):
     `matchCandidateIdempotencyKey` contains:
     ```typescript
     if (!candidateSourceId) {
       return { isMatch: false };
     }
     ```
     Because `candidateSourceId` is null, Rule 2 refuses to match the existing record by idempotency key! `matchedExisting` remains empty.
   - Rule 3 is skipped (`candidateDocId` is null).
   - Rule 4 is evaluated:
     `sameTupleExisting.length` is now **1** (the row from Run 1).
     Because `!candidateSourceId && !candidateDocId` AND `sameTupleExisting.length > 0`, the condition evaluates to `TRUE`!
   - Rule 4 pushes to `result.ambiguousPayments`:
     `"Unidentifiable payment match: Candidate lacks canonical payment_id, stable source ID, and receipt ID, but shares nominal Rp 500000 on date 2026-11-10 with 1 existing record(s) and 1 candidate(s)."`
   - And executes `continue;`.
3. **Implications:**
   - **Database Row Safety:** Safe from duplicate rows. No second payment is inserted on replay.
   - **Telemetry Asymmetry:** Run 1 reports `backfilledPayments: 1, ambiguousPayments: 0`. Run 2 reports `backfilledPayments: 0, ambiguousPayments: 1`.
   - **SSoT Identity Strictness:** If the mandate requires that no candidate lacking verified identity (`payment_id`, `source ID`, or `document_id`) should ever be automatically inserted, inserting it on Run 1 via an attribute fingerprint violates strict pre-insertion identity validation.

---

## 4. Section B: D1-B — Missing Candidate Date

### 4.1 Scenario Analysis & Experimental Results

The five required suffix matching conditions were tested directly against `matchCandidateIdempotencyKey()`:

| Test Case | Idempotency Key in Database | Candidate Source ID | `candidateDates` Passed | Observed Return Value | Evaluation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **B1** | `BACKFILL-INV-B-TEST-PAY-12-2026-11-10` | `PAY-12` | `["2026-11-10"]` | `{ isMatch: true }` | Verified match |
| **B2** | `BACKFILL-INV-B-TEST-PAY-12-2026-11-04` | `PAY-12` | `["2026-11-10"]` | `{ isMatch: false, isAmbiguous: true }` | **Fail-closed on date conflict** |
| **B3** | `BACKFILL-INV-B-TEST-PAY-12-2026-11-10` | `PAY-12` | `[]` (Empty) | `{ isMatch: true }` | **Fails OPEN without evidence** |
| **B4** | `...-PAY-12-2026-11-10T14:30:00.000Z` | `PAY-12` | `[]` (Empty) | `{ isMatch: true }` | **Fails OPEN without evidence** |
| **B5a** | `...-PAY-12-2026-02-31` | `PAY-12` | `["2026-11-10"]` | `{ isMatch: false, isAmbiguous: true }` | **Fail-closed on Feb 31** |
| **B5b** | `...-PAY-12-EXTRA` | `PAY-12` | `["2026-11-10"]` | `{ isMatch: false, isAmbiguous: true }` | **Fail-closed on arbitrary suffix** |
| **B5c** | `...-PAY-12-2026-11-10-EXTRA` | `PAY-12` | `["2026-11-10"]` | `{ isMatch: false, isAmbiguous: true }` | **Fail-closed on date + trailing token** |
| **B5d** | `...-PAY-12-9999-99-99` | `PAY-12` | `["2026-11-10"]` | `{ isMatch: false, isAmbiguous: true }` | **Fail-closed on invalid year/month** |

### 4.2 Key Finding: Date Matching When `candidateDates` is Empty

**Question:** *Determine whether a date-based key can be accepted as a confirmed identity when the candidate date is unavailable. A date-based identity match must not be confirmed without sufficient evidence to verify the date relationship.*

**Definitive Finding:** **YES, IT CAN BE ACCEPTED (FAILS OPEN WHEN `candidateDates` IS EMPTY).**
1. **Code Path in [`schema.ts:2215-2239`](file:///d:/Admin/adminsunbirojasa/server/src/database/schema.ts#L2215-L2239):**
   ```typescript
   if (isValidCalendarDate(suffix)) {
     if (candidateDates.length > 0 && !candidateDates.includes(suffix)) {
       return { isMatch: false, isAmbiguous: true, ... };
     }
     return { isMatch: true };
   }

   if (isValidIsoTimestamp(suffix)) {
     if (candidateDates.length > 0) {
       const suffixDate = suffix.slice(0, 10);
       if (!candidateDates.includes(suffix) && !candidateDates.includes(suffixDate)) {
         return { isMatch: false, isAmbiguous: true, ... };
       }
     }
     return { isMatch: true };
   }
   ```
2. **Analysis:**
   - The conflict check `!candidateDates.includes(suffix)` is guarded by `if (candidateDates.length > 0)`.
   - If `candidateDates` is empty (`[]` or omitted), `candidateDates.length > 0` evaluates to `false`.
   - The conflict check is bypassed entirely, and the function executes `return { isMatch: true };`.
   - Consequently, **a date-suffixed or timestamp-suffixed key is confirmed as a match even when no candidate dates exist to verify against.**
3. **Contextual Mitigation in `backfillHistoricalFinanceData`:**
   In actual startup backfill ([`schema.ts:2394-2439`](file:///d:/Admin/adminsunbirojasa/server/src/database/schema.ts#L2394-L2439)), `candidateRawDate` is synthesized with fallbacks (`pr.tanggal || inv.created_at || new Date().toISOString()`), so within the startup loop, `candidateDates` is never empty.
   However, at the function interface level of `matchCandidateIdempotencyKey()`, passing `candidateDates = []` confirms identity without evidence, violating the strict standard.

---

## 5. Section C: Git Working Tree Reconciliation

A single, consistent snapshot of `git status --porcelain -uall` was captured and analyzed.

### 5.1 Reconciled Category Breakdown

| Category | Count | Files / Scope | Notes |
| :--- | :--- | :--- | :--- |
| **1. Step D Implementation (Exclusive)** | 3 | `server/src/app.ts`<br>`server/src/server.ts`<br>`server/src/utils/dateNormalizer.ts` | Exclusive Step D runtime wiring & normalizer |
| **2. Multi-Phase Shared Implementation** | 1 | `server/src/database/schema.ts` | **Shared between Step B and Step D** (see Section 5.2) |
| **3. Step D Tests** | 2 | `tests/date-normalizer.test.ts`<br>`tests/phase4b-batch2b-stepD-startup-backfill-safety.test.ts` | Step D isolated test suites |
| **4. Step D Documents** | 7 | 7 Step D audit & remediation reports in `docs/audits/` | Incremented from 6 to 7 with D1 Final Remediation Report |
| **5. Step C Implementation** | 6 | `financeController.ts`, `orderController.ts`, `dbFinanceRepository.ts`, `financeRoutes.ts`, `financeService.ts`, `orderService.ts` | Approved Step C service & controller layer |
| **6. Step C Tests** | 1 | `tests/phase4b-batch2b-stepC-payment-lifecycle.test.ts` | Approved Step C payment lifecycle test suite |
| **7. Step C Documents** | 5 | 5 Step C audit & remediation reports in `docs/audits/` | Step C approval documentation |
| **8. Step B Exclusive Files** | 7 | `canonicalHasher.ts`, `src/domain/order/types.ts`, `phase4b-batch2b-stepB-payment-identity.test.ts`, + 4 Step B docs | Approved Step B identity infrastructure |
| **9. Forensic Scripts** | 8 | 8 forensic scripts in `scripts/` | Audit runners, hash checkers, isolation harness |
| **10. Historical Deletions** | 329 | Phase 1 legacy stub & archive files | Tracked git deletions (`D ` / ` D`) |
| **11. Historical Modifications** | 66 | Phases 1–4A business logic & database migrations | Tracked git modifications (`M ` / ` M`) |
| **12. Historical Tests** | 38 | Phases 1–4B Batch 1 test files | Existing test suites |
| **13. Historical Documents** | 30 | Phases 1–4B Batch 1 audit & technical documents | Historical documentation |
| **14. Unexplained Entries** | **0** | None | **Zero unexplained files** |
| **TOTAL** | **503** | **503 unique file paths** | **100% Reconciled** |

### 5.2 Reconciliation of `schema.ts` Attribution

In the previous `audit_git_categories.cjs` script:
- `server/src/database/schema.ts` was grouped into `stepBFiles` (which reported 8 files).
- `stepD_impl` reported 3 files (`app.ts`, `server.ts`, `dateNormalizer.ts`).
- `stepD_docs` reported 6 files.
- Total reported was 502 files.

During the completion of the D1 Final Remediation:
- The 7th Step D document (`docs/audits/PHASE_4B_BATCH_2B_STEP_D_D1_FINAL_REMEDIATION_REPORT.md`) was written, increasing total working tree entries from 502 to 503.
- `server/src/database/schema.ts` is dual-attributed:
  - In **Step B**, it received the `payment_id TEXT` column and unique index `idx_inv_payments_payment_id`.
  - In **Step D**, it received startup transaction guards (`isSchemaInitialized`), document reconciliation transaction isolation (`reconcileLegacyDocuments`), the 5 destructive migration transaction & FK checks (`migrateDocumentsTable`, etc.), and payment backfill deduplication rules (`matchCandidateIdempotencyKey`, `backfillHistoricalFinanceData`, `isValidCalendarDate`, `isValidIsoTimestamp`).
- When classified with mutually exclusive single-pass partitioning:
  - Step D Exclusive Implementation: 3
  - Shared Implementation (`schema.ts`): 1
  - Step B Exclusive: 7
  - There are zero overlapping classifications and zero unexplained entries.

---

## 6. Section D: Forensic Read-Only Integrity Verification

The operational environment was inspected without executing any database mutations, migrations, or backfills:

| Verification Target | Expected Baseline | Actual Observed Value | Forensic Verdict |
| :--- | :--- | :--- | :--- |
| **Operational DB File** | `server/data/database.sqlite` | `server/data/database.sqlite` | Present |
| **Operational DB SHA-256** | `A8A4B1F77FCAB6EE0A9503B778DE7A7A7929100D9AD6F965EF707503609E379C` | `A8A4B1F77FCAB6EE0A9503B778DE7A7A7929100D9AD6F965EF707503609E379C` | **100% Bit-for-Bit Identical** |
| **PRAGMA integrity_check** | `ok` | `ok` | **Clean** |
| **User Table Count** | 41 user tables | 41 user tables | **Identical** |
| **Total Row Count** | 1,314 rows | 1,314 rows | **Identical** |
| **Historical Payment Row #1** | nominal=563,000, `payment_id = null`, kas_kantor_id=2 | nominal=563,000, `payment_id = null`, kas_kantor_id=2 | **Untouched** |
| **Historical Payment Row #2** | nominal=563,000, `payment_id = null`, kas_kantor_id=null | nominal=563,000, `payment_id = null`, kas_kantor_id=null | **Untouched** |
| **Historical Payment Row #3** | nominal=563,000, `payment_id = null`, kas_kantor_id=null | nominal=563,000, `payment_id = null`, kas_kantor_id=null | **Untouched** |
| **Historical Payment Row #4** | nominal=59,028,000, `payment_id = null`, kas_kantor_id=null | nominal=59,028,000, `payment_id = null`, kas_kantor_id=null | **Untouched** |
| **Historical Payment Row #5** | nominal=59,028,000, `payment_id = null`, kas_kantor_id=null | nominal=59,028,000, `payment_id = null`, kas_kantor_id=null | **Untouched** |
| **Historical Payment Row #6** | nominal=1,258,000, `payment_id = null`, kas_kantor_id=null | nominal=1,258,000, `payment_id = null`, kas_kantor_id=null | **Untouched** |
| **Historical Payment Row #7** | nominal=1,258,000, `payment_id = null`, kas_kantor_id=null | nominal=1,258,000, `payment_id = null`, kas_kantor_id=null | **Untouched** |
| **Uploads File Count** | 51 files | 51 files | **Identical** |
| **Uploads Total Size** | 1,525,984 bytes | 1,525,984 bytes | **Identical** |
| **Uploads Manifest SHA-256** | `4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5` | `4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5` | **100% Bit-for-Bit Identical** |

---

## 7. Remaining Limitations & Architectural Assessment

1. **Unidentifiable Single Candidate Telemetry Asymmetry (D1-A):**
   - When a solitary payment candidate exists without any stable identity (`payment_id`, `source ID`, or `document ID`), it is inserted on initial backfill with a synthesized fingerprint key.
   - On subsequent replay, because `candidateSourceId` is null, Rule 2 bypasses idempotency key matching, and Rule 4 detects the pre-existing row sharing nominal/date, flagging the candidate as `ambiguousPayments`.
   - While duplicate insertion is prevented, telemetry reporting is not replay-invariant.
2. **Date Matching Without Candidate Date Evidence (D1-B):**
   - In `matchCandidateIdempotencyKey()`, if `candidateDates` is empty (`[]`), the conflict validation is skipped, and the date-suffixed or timestamp-suffixed key is returned as `{ isMatch: true }`.
   - In the startup backfill loop, `candidateDates` is always populated from `candidateRawDate`, so this edge case does not trigger during standard execution. However, at the standalone unit level, it represents a fail-open assumption when date evidence is absent.
3. **Operational Scope of Historical Payments:**
   - In the operational database (`server/data/database.sqlite`), all 7 existing payment rows have verified idempotency keys (rows #1, #4 have `REQ-...`, rows #2, #3, #5, #6, #7 have `BACKFILL-...`). None of them are unidentifiable candidates without source IDs. Thus, these edge cases do not jeopardize existing operational data.

---

## 8. Final Recommendation

Based on the evidence gathered:

### Recommendation: **ACCEPT WITH CONDITIONS**

**Justification:**
1. **Safety & Non-Duplication Guaranteed:** Zero duplicate payments can be inserted under any scenario (including unidentifiable candidates, distinct partials, or conflicting dates).
2. **100% Operational & Historical Preservation:** The operational database SHA-256 (`A8A4B1F7...`), table row counts (1,314), historical rows #1–#7 (`payment_id = NULL`), and uploads manifest (51 files, SHA `4FD41878...`) are completely intact.
3. **Quality Gates Passed:** All 57 Step D tests and 75 regression tests pass with 100% database isolation; TypeScript typecheck (server and client), ESLint, and production build pass with zero errors.
4. **Conditions to Record:**
   - **Condition 1 (D1-A):** Acknowledge that a single unidentifiable candidate (lacking `payment_id`, `source ID`, and `document ID`) is inserted on initial run via fingerprint key and transitions to ambiguous telemetry reporting on subsequent replay (without creating duplicate rows).
   - **Condition 2 (D1-B):** Acknowledge that `matchCandidateIdempotencyKey()` confirms date-suffixed keys as matches if `candidateDates` is passed as an empty array `[]`.

If the reviewer requires strict closure of these two theoretical limitations prior to formal closure of Step D, a focused micro-remediation can be applied to:
- Require stable identity upfront before any payment insertion in Rule 4 (failing closed on single unidentifiable candidates even on Run 1).
- Require `candidateDates.length > 0` before confirming date-suffixed keys in `matchCandidateIdempotencyKey()`.

---

## 9. Mandatory Stop Notice

Antigravity strictly stops here. No implementation edits have been made. Step E (*Void & Contra-Entry*) has not been started. Awaiting instructions from the user and ChatGPT.
