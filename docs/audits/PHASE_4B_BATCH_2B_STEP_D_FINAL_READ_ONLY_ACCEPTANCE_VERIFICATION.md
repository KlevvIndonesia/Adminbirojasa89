# PHASE 4B BATCH 2B — STEP D
## Final Read-Only Acceptance Verification: D1 Legacy Identity & Git Integrity

**Project:** SUN89 / SUNBiroJasa Admin Platform  
**Milestone:** Phase 4B Batch 2B — Step D (Startup Backfill Safety & Migration Transaction Safety)  
**Execution Scope:** D1 Legacy Key Construction & Matching, Date Suffix Validation, and Git Working Tree Reconciliation  
**Execution Owner:** Antigravity  
**Mode:** STRICT READ-ONLY AUDIT & VERIFICATION  
**Date:** November 10, 2026  

---

## 1. Executive Summary

This audit report delivers the final read-only acceptance verification for **Phase 4B Batch 2B Step D**, resolving the remaining questions regarding:
1. **D1-A: Legacy Key Construction & Matching** in `server/src/database/schema.ts` (`backfillHistoricalInvoicePayments`).
2. **D1-B: Exact Token & Date/Timestamp Suffix Validation** in `matchCandidateIdempotencyKey`.
3. **GIT-A: Working Tree Classification Reconciliation** explaining the exact composition of all git entries (reconciling the 500 vs 501 transition and `schema.ts` placement).
4. **Baseline Integrity Forensics** confirming zero mutation on the operational database and uploads repository.

### Key Audit Findings:
- **Substring Collision Elimination (VERIFIED BY ISOLATED TEST):** Substring collisions (`PAY-12` vs `PAY-123` and `PAY-123` vs `PAY-12`) are provably eliminated.
- **Unanchored Date Regex Suffix (VERIFIED BY TEST & INSPECTION):** In `matchCandidateIdempotencyKey`, the date check `/^\d{4}-\d{2}-\d{2}/.test(suffix)` is unanchored (lacks `$`). Consequently:
  - Valid dates followed by foreign tokens (e.g. `2026-11-04-EXTRA`) match as date suffixes instead of falling through to the ambiguity check.
  - Invalid calendar dates matching the numeric shape (e.g. `2026-02-31`) are accepted as valid date syntax.
- **Legacy Key Fallback on Nominal & Date (VERIFIED BY TEST & INSPECTION):** When candidate payments lack a stable `candidateSourceId` (`null`), `legacyKeys` constructs `BACKFILL-${inv.invoice_no}-${nominal}-${date}`. If an existing payment in the database has that legacy format, `legacyKeys.includes(epKey)` in Rule 2 matches on nominal and date alone, causing multiple distinct partial payments with the same nominal/date to be deduplicated against the same record before reaching Rule 4 (Ambiguity Detection).
  - *Mitigating Fact:* Forensics on the 7 existing rows in `server/data/database.sqlite` confirm that **no historical row** uses the format `BACKFILL-${inv.invoice_no}-${nominal}-${date}`. All 7 historical rows contain unique timestamps or request IDs (`REQ-...` or `BACKFILL-...-pay-<timestamp>-...`), making this risk purely theoretical for existing operational data.
- **Git Working Tree Reconciliation (VERIFIED BY INSPECTION):** Exactly 501 porcelain entries reconciled with **0 unexplained files**. The earlier 500 count represented the state immediately prior to creating `PHASE_4B_BATCH_2B_STEP_D_D1_D3_FINAL_REMEDIATION_REPORT.md` (which added 1 untracked file, bringing the total to 501). `server/src/database/schema.ts` is classified under Step B Files because its initial modifications occurred in Step B.
- **Operational Baselines Untouched (VERIFIED BY SHA-256):** Operational database (`A8A4B1F77FCAB6EE0A9503B778DE7A7A7929100D9AD6F965EF707503609E379C`) and Uploads directory (`4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5`) remain 100% identical to baseline.

---

## 2. D1-A — Legacy Key Construction Inventory

### Source Data for `candidateSourceId` and `legacyKeys`
In [`server/src/database/schema.ts` (L2315-L2369)](file:///d:/Admin/adminsunbirojasa/server/src/database/schema.ts#L2315-L2369), candidates are extracted from order payment records:
```typescript
const pRecords = orderJson?.payment?.paymentRecords || parsedJson?.paymentRecords || [];
for (const pr of pRecords) {
  const nominal = Number(pr.nominal || 0);
  if (nominal <= 0) continue;

  const candidateRawDate = pr.tanggal || inv.created_at || new Date().toISOString();
  const candidateWibDate = normalizeToWibCalendarDate(candidateRawDate);
  const candidateSourceId = pr.id ? String(pr.id) : null;
  const candidatePaymentId = pr.paymentId || pr.payment_id || null;
  const candidateDocId = pr.buktiPembayaran?.documentId || pr.document_id || null;
```

### Construction of Keys:
1. **Canonical Key (`key`):**
   ```typescript
   const key = candidateSourceId 
     ? `BACKFILL-${inv.invoice_no}-${candidateSourceId}` 
     : `BACKFILL-${inv.invoice_no}-FP-${fp}`;
   ```
2. **Primary Legacy Key (`legacyKey`):**
   ```typescript
   const legacyKey = `BACKFILL-${inv.invoice_no}-${candidateSourceId || nominal}-${pr.tanggal || "init"}`;
   ```
3. **Legacy Keys Array (`legacyKeys`):**
   ```typescript
   const legacyKeys: string[] = [legacyKey];
   if (candidateRawDate) {
     legacyKeys.push(`BACKFILL-${inv.invoice_no}-${candidateSourceId || nominal}-${candidateRawDate}`);
   }
   if (candidateWibDate) {
     legacyKeys.push(`BACKFILL-${inv.invoice_no}-${candidateSourceId || nominal}-${candidateWibDate}`);
   }
   legacyKeys.push(`BACKFILL-${inv.invoice_no}-${candidateSourceId || nominal}-init`);
   ```

### Code Evidence Answers to User Questions:

#### 1. Dari data apa setiap `legacyKey` dibentuk?
- Formed from:
  1. `inv.invoice_no` (invoice number).
  2. `candidateSourceId || nominal` (source ID if present in `pr.id`, otherwise fallback to numerical `nominal`).
  3. Date token (`pr.tanggal`, `candidateRawDate`, `candidateWibDate`, or `"init"`).

#### 2. Apakah setiap legacy key mengandung stable source ID atau payment identity yang unik?
- **NO.** If `pr.id` is missing/null, `candidateSourceId || nominal` evaluates to `nominal`. In that scenario, the key has **NO** stable source ID or unique payment identity; it contains only invoice number, amount, and date.

#### 3. Apakah format `BACKFILL-INV-NOMINAL-DATE` hanya bergantung pada invoice, nominal, dan tanggal?
- **YES.** When `candidateSourceId` is null, the string is strictly composed of `${inv.invoice_no}-${nominal}-${dateToken}`.

#### 4. Apakah `legacyKeys.includes(epKey)` dapat menyamakan dua pembayaran berbeda yang memiliki invoice, nominal, dan tanggal sama?
- **YES (Verified by Isolated Test in `eval_backfill_collision.ts`).**
  - If an existing payment in `invoice_payments` has `idempotency_key = "BACKFILL-INV-001-500000-2026-11-10"`,
  - And an order contains two distinct partial payments of Rp 500,000 on 2026-11-10 without source IDs:
  - Candidate 1 generates `legacyKeys` containing `"BACKFILL-INV-001-500000-2026-11-10"` and matches the existing record (Rule 2).
  - Candidate 2 **also** generates `legacyKeys` containing `"BACKFILL-INV-001-500000-2026-11-10"` and matches the **same** existing record (Rule 2).
  - As a result, Candidate 2 is skipped via `continue`, and Rule 4 (Ambiguity Detection) is completely bypassed.

#### 5. Apakah ada fallback lain yang melakukan deduplikasi hanya berdasarkan nominal dan tanggal?
- No direct deduplication fallback exists in Rules 1, 3, or 4.
- In Rule 4 (L2462-L2488), if a candidate has no source ID and shares nominal/date with existing records, the system explicitly pushes to `result.ambiguousPayments` and skips insertion.
- **However**, because Rule 2 executes *before* Rule 4, any legacy key match in Rule 2 preempts Rule 4.

#### 6. Bagaimana sistem menangani legacy key yang tidak memiliki identitas pembayaran yang dapat diverifikasi?
- In `matchCandidateIdempotencyKey`, Rule 2 performs an exact membership check: `if (legacyKeys.includes(epKey)) return { isMatch: true };`. It does not verify whether the matched legacy key originated from a stable source ID or a fallback nominal.

---

## 3. Exact Identity Guarantees and Limitations

| Identity Layer | Implementation Mechanism | Guarantee | Limitation |
| :--- | :--- | :--- | :--- |
| **Canonical payment_id** | `ep.payment_id === candidatePaymentId` (Rule 1) | Strict UUID / Canonical ID match with nominal & WIB date verification | Only applies if candidate has `paymentId` |
| **Canonical Idempotency Key** | `epKey === canonicalKey` (Rule 2.1) | Exact match on deterministic SHA-256 fingerprint or `BACKFILL-INV-SOURCEID` | Requires consistent input attributes |
| **Exact Source ID** | `epKey === candidateSourceId \|\| epKey === BACKFILL-${candidateSourceId}` (Rule 2.3) | Strict token equality | Does not match compound keys with suffixes |
| **Invoice-Scoped Prefix** | `epKey.startsWith("BACKFILL-INV-SOURCEID-")` (Rule 2.4) | Enforces hyphen boundary `-` and recognized suffix format | Unanchored regex allows foreign trailing characters if starting with `YYYY-MM-DD` |
| **Legacy Keys Fallback** | `legacyKeys.includes(epKey)` (Rule 2.2) | Backward compatibility with Phase 1 historical keys | Re-uses nominal when source ID is null |

---

## 4. Legacy Collision Analysis

### Forensic Inspection of Operational Database (`server/data/database.sqlite`)
A forensic query of all 7 existing payment rows in `invoice_payments` reveals their exact stored keys:

```json
[
  { "id": 1, "invoice_no": "INV-1126-001", "nominal": 563000, "idempotency_key": "REQ-1793803600982-1jwhdkm-init-pay" },
  { "id": 2, "invoice_no": "INV-1126-001", "nominal": 563000, "idempotency_key": "BACKFILL-INV-1126-001-pay-1793803600982-2026-11-04T14:46:40.982Z" },
  { "id": 3, "invoice_no": "INV-1126-001", "nominal": 563000, "idempotency_key": "BACKFILL-INV-1126-001-pay-verif-1793803615534-2026-11-04T14:46:55.526Z" },
  { "id": 4, "invoice_no": "INV-1126-002", "nominal": 59028000, "idempotency_key": "REQ-1793863388376-3oqgvxf-init-pay" },
  { "id": 5, "invoice_no": "INV-1126-002", "nominal": 59028000, "idempotency_key": "BACKFILL-INV-1126-002-pay-1793863388376-2026-11-05T07:23:08.376Z" },
  { "id": 6, "invoice_no": "INV-1126-001", "nominal": 1258000, "idempotency_key": "BACKFILL-INV-1126-001-pay-1794053685074-2026-11-07T12:14:45.074Z" },
  { "id": 7, "invoice_no": "INV-1126-001", "nominal": 1258000, "idempotency_key": "BACKFILL-INV-1126-001-pay-verif-1794053734438-2026-11-07T12:15:34.438Z" }
]
```

### Forensic Takeaways:
1. **Zero Nominal-Only Keys in Production:**
   None of the 7 historical records use the pattern `BACKFILL-INV-NOMINAL-DATE`.
   Every single historical row contains either:
   - A runtime request token: `REQ-1793803600982-1jwhdkm-init-pay`
   - A unique payment timestamp ID: `pay-1793803600982`
   - A unique verification timestamp ID: `pay-verif-1793803615534`
2. **Impact on Production Risk:**
   Because no existing payment row in the operational database has a nominal-only idempotency key, the theoretical collision scenario identified in Section 2 **cannot occur on the existing operational database**.

---

## 5. Date and Timestamp Suffix Validation

### Code Inspection of Suffix Evaluation
In [`server/src/database/schema.ts` (L2156-L2174)](file:///d:/Admin/adminsunbirojasa/server/src/database/schema.ts#L2156-L2174):
```typescript
if (epKey.startsWith(`${prefix}-`)) {
  const suffix = epKey.slice(`${prefix}-`.length);
  // Suffix must be a recognized date/timestamp or 'init'
  const isDateOrTimestamp =
    suffix === "init" ||
    /^\d{4}-\d{2}-\d{2}/.test(suffix) ||
    /^\d{10,14}$/.test(suffix);

  if (isDateOrTimestamp) {
    return { isMatch: true };
  }

  // Trailing token is unrecognized (e.g. -PART2, -EXTRA), fail closed into ambiguity
  return {
    isMatch: false,
    isAmbiguous: true,
    reason: `Key '${epKey}' starts with '${prefix}-' but trailing token '${suffix}' is not a recognized timestamp/date. Possible identity ambiguity with candidate source ID '${candidateSourceId}'.`,
  };
}
```

### Specific Audit Questions & Findings:

#### 1. Apakah regex tanggal memvalidasi seluruh suffix atau hanya awalan tanggal?
- **Hanya awalan tanggal.** The regex is `/^\d{4}-\d{2}-\d{2}/` without the end-of-string anchor `$`.
- *Reason it was written this way:* Historical keys in rows 2, 3, 5, 6, 7 end with full ISO 8601 strings (e.g. `2026-11-04T14:46:40.982Z`). A simple `/^\d{4}-\d{2}-\d{2}$/` regex would have rejected these historical keys.
- *Side Effect:* Because it is unanchored, any string starting with 8 date digits (e.g. `2026-11-04-EXTRA`) is treated as a valid date suffix.

#### 2. Apakah tanggal yang tidak valid dapat diterima?
- **YES.** `/^\d{4}-\d{2}-\d{2}/` only validates digit structure (`\d{4}-\d{2}-\d{2}`). Non-existent calendar dates like `2026-02-31` or `9999-99-99` pass the regex test.

#### 3. Apakah tanggal valid yang diikuti token asing dapat dianggap cocok?
- **YES.** For example, `BACKFILL-INV-001-PAY-12-2026-11-04-EXTRA` evaluates with suffix `2026-11-04-EXTRA`. Because it starts with `\d{4}-\d{2}-\d{2}`, `isDateOrTimestamp` is `true`, returning `{ isMatch: true }` instead of flagging ambiguity.

#### 4. Apakah source ID yang mengandung delimiter `-` berpotensi menghasilkan collision?
- If Candidate A has `PAY-12` and Candidate B has `PAY-12-PART1`:
  - Key `BACKFILL-INV-001-PAY-12-PART1` has suffix `PART1`.
  - `PART1` fails the date/timestamp check.
  - Candidate A correctly reports `{ isMatch: false, isAmbiguous: true }`.
- However, if Candidate B has `PAY-12-2026-11-04`:
  - Against Candidate A (`PAY-12`), suffix is `2026-11-04`.
  - Candidate A incorrectly considers it a match.

#### 5. Apakah format timestamp memiliki batas panjang dan format yang tegas?
- **YES.** `/^\d{10,14}$/` is strictly anchored with `^` and `$`, restricting timestamps to exactly 10 to 14 consecutive digits (covering Unix epoch seconds and milliseconds).

#### 6. Apakah semua format yang diterima benar-benar berasal dari format key historis yang ada?
- **YES.** The four supported suffix formats (`"init"`, ISO timestamps `YYYY-MM-DDTHH:mm:ss.sssZ`, calendar dates `YYYY-MM-DD`, and epoch timestamps `\d{10,14}`) match the historical key patterns generated across Phase 1, Phase 2, and Step B.

---

## 6. D1 Test Matrix with Evidence

The following 12 test scenarios were executed using a standalone TypeScript runner in an isolated test execution (`eval_d1_matrix.ts`):

| # | Test Scenario | Input `epKey` | Input `candidateSourceId` | Canonical / Legacy Keys | Actual Result | Verification Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | `PAY-12` vs `PAY-123` | `BACKFILL-INV-001-PAY-123` | `PAY-12` | `BACKFILL-INV-001-PAY-12` | `{ isMatch: false }` | **PASS (Isolated Test)** |
| **2** | `PAY-123` vs `PAY-12` | `BACKFILL-INV-001-PAY-12` | `PAY-123` | `BACKFILL-INV-001-PAY-123` | `{ isMatch: false }` | **PASS (Isolated Test)** |
| **3** | Source ID with hyphen (`PAY-12` vs `PAY-12-PART1`) | `BACKFILL-INV-001-PAY-12-PART1` | `PAY-12` | `BACKFILL-INV-001-PAY-12` | `{ isMatch: false, isAmbiguous: true }` | **PASS (Isolated Test)** |
| **4** | Exact canonical key | `BACKFILL-INV-001-PAY-12` | `PAY-12` | `BACKFILL-INV-001-PAY-12` | `{ isMatch: true }` | **PASS (Isolated Test)** |
| **5** | Exact legacy key with stable ID | `BACKFILL-INV-001-PAY-12-init` | `PAY-12` | `["...-PAY-12-init"]` | `{ isMatch: true }` | **PASS (Isolated Test)** |
| **6** | Legacy key without stable ID | `BACKFILL-INV-001-500000-2026-11-10` | `null` | `["...-500000-2026-11-10"]` | `{ isMatch: true }` | **PASS (Isolated Test)** |
| **7** | Valid ISO date suffix | `BACKFILL-INV-001-PAY-12-2026-11-04T14:46:40.982Z` | `PAY-12` | `BACKFILL-INV-001-PAY-12` | `{ isMatch: true }` | **PASS (Isolated Test)** |
| **8** | Invalid calendar date | `BACKFILL-INV-001-PAY-12-2026-02-31` | `PAY-12` | `BACKFILL-INV-001-PAY-12` | `{ isMatch: true }` (Limitation) | **PASS (Isolated Test)** |
| **9** | Valid date + foreign suffix | `BACKFILL-INV-001-PAY-12-2026-11-04-EXTRA` | `PAY-12` | `BACKFILL-INV-001-PAY-12` | `{ isMatch: true }` (Limitation) | **PASS (Isolated Test)** |
| **10** | Recognized epoch timestamp | `BACKFILL-INV-001-PAY-12-1793803600982` | `PAY-12` | `BACKFILL-INV-001-PAY-12` | `{ isMatch: true }` | **PASS (Isolated Test)** |
| **11** | Malformed timestamp (letters) | `BACKFILL-INV-001-PAY-12-1793803600982EXTRA` | `PAY-12` | `BACKFILL-INV-001-PAY-12` | `{ isMatch: false, isAmbiguous: true }` | **PASS (Isolated Test)** |
| **12** | Malformed timestamp (too short) | `BACKFILL-INV-001-PAY-12-12345` | `PAY-12` | `BACKFILL-INV-001-PAY-12` | `{ isMatch: false, isAmbiguous: true }` | **PASS (Isolated Test)** |

---

## 7. Git Status Snapshot and Complete Category Reconciliation

### Snapshot Analysis
- **Snapshot Command:** `git status --porcelain -uall`
- **Total Porcelain Lines:** **501**
- **Discrepancy Explanation:**
  - In the previous report, the baseline entry count was 500 prior to creating `PHASE_4B_BATCH_2B_STEP_D_D1_D3_FINAL_REMEDIATION_REPORT.md`.
  - Writing that report added 1 untracked file to `docs/audits/`, resulting in 501 entries.
  - Adding the current report (`PHASE_4B_BATCH_2B_STEP_D_FINAL_READ_ONLY_ACCEPTANCE_VERIFICATION.md`) will bring the total to 502 entries upon completion.

### Classification of 501 Entries:

| # | Category | Count | Member Paths / Rules |
| :---: | :--- | :---: | :--- |
| **1** | **Step D Implementation** | 3 | `server/src/app.ts`, `server/src/server.ts`, `server/src/utils/dateNormalizer.ts` |
| **2** | **Step D Tests** | 2 | `tests/date-normalizer.test.ts`, `tests/phase4b-batch2b-stepD-startup-backfill-safety.test.ts` |
| **3** | **Step D Documentation** | 5 | `docs/audits/PHASE_4B_BATCH_2B_STEP_D_READ_ONLY_AUDIT_REPORT.md`<br>`docs/audits/PHASE_4B_BATCH_2B_STEP_D_IMPLEMENTATION_REPORT.md`<br>`docs/audits/PHASE_4B_BATCH_2B_STEP_D_FOCUSED_REMEDIATION_REPORT.md`<br>`docs/audits/PHASE_4B_BATCH_2B_STEP_D_FINAL_READ_ONLY_VERIFICATION.md`<br>`docs/audits/PHASE_4B_BATCH_2B_STEP_D_D1_D3_FINAL_REMEDIATION_REPORT.md` |
| **4** | **Step C Implementation** | 6 | `server/src/controllers/financeController.ts`, `server/src/controllers/orderController.ts`, `server/src/repositories/dbFinanceRepository.ts`, `server/src/routes/financeRoutes.ts`, `server/src/services/financeService.ts`, `server/src/services/orderService.ts` |
| **5** | **Step C Tests** | 1 | `tests/phase4b-batch2b-stepC-payment-lifecycle.test.ts` |
| **6** | **Step C Documentation** | 5 | `docs/audits/PHASE_4B_BATCH_2B_STEP_C_IMPLEMENTATION_REPORT.md`<br>`docs/audits/PHASE_4B_BATCH_2B_STEP_C_REMEDIATION_REPORT.md`<br>`docs/audits/PHASE_4B_BATCH_2B_STEP_C_ACCEPTANCE_REVIEW_ADDENDUM.md`<br>`docs/audits/PHASE_4B_BATCH_2B_STEP_C_FINAL_VERIFICATION_REPORT.md`<br>`docs/audits/PHASE_4B_BATCH_2B_STEP_C_FINAL_REMEDIATION_REPORT.md` |
| **7** | **Step B Files** | 8 | `server/src/database/schema.ts`, `server/src/utils/canonicalHasher.ts`, `src/domain/order/types.ts`, `tests/phase4b-batch2b-stepB-payment-identity.test.ts`, `docs/audits/PHASE_4B_BATCH_2B_STEP_B_PAYMENT_IDENTITY_AUDIT.md`, `docs/audits/PHASE_4B_BATCH_2B_STEP_B_IMPLEMENTATION_REPORT.md`, `docs/audits/PHASE_4B_BATCH_2B_STEP_B_FINAL_RECONCILIATION.md`, `docs/audits/PHASE_4B_BATCH_2B_STEP_B_FINAL_SCOPE_VERIFICATION.md` |
| **8** | **Forensic & Runner Scripts** | 8 | `scripts/audit_git_categories.cjs`, `scripts/audit_git_status.cjs`, `scripts/compare_db_hash_lineage.cjs`, `scripts/record_remediation_baseline.cjs`, `scripts/verify_uploads_manifest.cjs`, `scripts/patch-realpath.cjs`, `scripts/run-test-isolated.cjs`, `scripts/pre-migration-safety-check.cjs` |
| **9** | **Historical Deletions** | 329 | Phase 1 deletion of legacy mocks, stubs, and obsolete release snapshots |
| **10** | **Historical Modifications** | 66 | Phase 1–4A application components, repositories, stores, package-lock.json |
| **11** | **Historical Tests** | 38 | Phase 1–4B Batch 1 test suites in `tests/` and `e2e/` |
| **12** | **Historical Documentation** | 30 | Phase 1–4B Batch 1 documentation files in `docs/` |
| **13** | **Unexplained** | 0 | None. Zero unexplained entries. |
| **TOTAL** | | **501** | **Sum = 501, Total = 501, Difference = 0** |

### Classification of `server/src/database/schema.ts`
- `server/src/database/schema.ts` was initially modified during Phase 4B Batch 2B Step B to introduce the canonical `payment_id` column, `idx_inv_payments_payment_id`, and composite indexes.
- In Step D, it received further modifications (D1 matching helper and D3 migration boundaries).
- In the canonical categorization script ([`scripts/audit_git_categories.cjs`](file:///d:/Admin/adminsunbirojasa/scripts/audit_git_categories.cjs#L45)), `schema.ts` is matched under `stepBFiles`.
- Because Git status tracks unique paths, counting `schema.ts` under Step B ensures it is counted exactly once without double-counting under Step D. If reclassified under Step D Implementation, Step D Implementation would be 4 and Step B Files would be 7, with the total remaining 501.

---

## 8. Database and Uploads Integrity

### Operational Database Forensics
- **Path:** `server/data/database.sqlite`
- **File Size:** 1,441,792 bytes
- **SHA-256 Checksum:** `A8A4B1F77FCAB6EE0A9503B778DE7A7A7929100D9AD6F965EF707503609E379C`
- **Baseline Match:** Exact 100% match with approved baseline
- **User Tables:** 41
- **Row Count:** 1,314 across all user tables
- **Historical Payment Records #1–#7:** Pristine and untouched (`payment_id = NULL`)

### Uploads Integrity Forensics
- **Directory:** `uploads/`
- **File Count:** 51 files
- **Total Bytes:** 1,525,984 bytes
- **Manifest Canonical SHA-256:** `4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5`
- **Baseline Status:** Exact 100% match. 0 additions, 0 modifications, 0 deletions.

---

## 9. Categorization of Audit Evidence

### 1. Verified by Isolated Test
- D1-1 through D1-14: Token boundary matching, substring collision prevention, fail-closed ambiguity handling.
- D1-15 & D1-16: Unanchored date regex behavior accepting `2026-02-31` and `2026-11-04-EXTRA`.
- D1-17: Multiple partial payments deduplicated against a single legacy nominal key.
- D1-18: Multiple partial payments failing closed into `ambiguousPayments` when no existing payment exists.
- D3 Failure Injection Matrix: 21 granular tests across 5 migrations × 4 phases + 1 FK violation check.
- Regression Suites: 130 tests across 7 isolated test suites passing 100%.
- Quality Gates: Server typecheck, full typecheck, ESLint, and production build all exiting 0.
- Database & Uploads SHA-256 baseline verification.

### 2. Verified by Code Inspection
- Construction of `legacyKeys` using `nominal` fallback when `candidateSourceId` is null.
- Unanchored date regex `/^\d{4}-\d{2}-\d{2}/` vs anchored epoch timestamp regex `/^\d{10,14}$/`.
- Rule precedence in `backfillHistoricalInvoicePayments`: Rule 1 -> Rule 2 -> Rule 3 -> Rule 4.
- Destructive migration transaction architecture: `PRAGMA foreign_keys = OFF` outside transaction, `PRAGMA foreign_key_check;` inside transaction callback before commit, `PRAGMA foreign_keys = ON;` in `finally`.
- Operational database query showing historical payment rows #1–#7 lack nominal-only keys.
- Git status classification reconciliation of all 501 entries.

### 3. Inferred but Not Proven
- Production safety of nominal fallback: Because none of the 7 rows in `server/data/database.sqlite` use nominal-only keys, historical collision is inferred to be impossible on current operational data, but this cannot be mathematically guaranteed for arbitrary external imports.

### 4. Not Verified
- Multi-process concurrency during table migrations on network-attached filesystems (NFS/SMB).
- Migration performance on tables exceeding 1,000,000 rows.

---

## 10. Unresolved Findings and Recorded Limitations

1. **Unanchored Date Regex:**
   - `/^\d{4}-\d{2}-\d{2}/` allows valid date prefixes followed by arbitrary foreign characters (e.g. `-EXTRA`) to pass as date suffixes.
   - Recommended future remediation: Update regex to strictly require end-of-string or ISO timestamp format: `/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z)?$/`.
2. **Legacy Nominal Deduplication Precedence:**
   - When candidate payments lack a stable source ID, `legacyKeys` falls back to `nominal`, allowing multiple distinct partial payments with the same nominal/date to match a single legacy payment row in Rule 2, bypassing Rule 4.
   - *Status on Operational Data:* Non-issue for existing database since rows #1–#7 do not contain nominal-only keys.

---

## 11. Final Recommendation and Closure Determination

### **RECOMMENDATION: ACCEPT WITH CONDITIONS**

### Closure Determination:
**Step D is technically ready for formal closure under documented conditions.**

The primary mandates of Step D:
1. Eliminating unsafe startup backfills and duplicate payment creation.
2. Eliminating substring collisions (`PAY-12` vs `PAY-123`).
3. Enforcing strict transaction boundaries and in-transaction foreign key checks for all 5 destructive migrations.
4. Preserving operational database and uploads baseline integrity.

have all been fully implemented and verified with 130 passing tests and 0 quality gate failures.

The two recorded limitations (unanchored date regex and legacy nominal deduplication precedence) do not affect existing operational records #1–#7 and are documented above for backlog tracking.

---

## 12. Mandatory Stop

In compliance with prompt instructions:
- **STOP.** Execution halted.
- Step D has **NOT** been closed automatically.
- Step E (*Void & Contra-Entry*) has **NOT** been started.
- No production preparation or deployment has occurred.
- Operational database and uploads remain untouched.
- Awaiting user review and authorization before proceeding to any next steps.
