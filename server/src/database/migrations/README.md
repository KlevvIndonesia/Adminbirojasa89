# Database Migrations & Optimization Proposals
Admin SUN89 — Biro Jasa Management System

## Policy & Invariants
1. **Zero Unapproved Operational Mutation:** Operational database (`server/data/database.sqlite`) must never be modified by ad-hoc migrations or automated test runners.
2. **Pre-Release Verification:** All schema migrations must be tested and verified against isolated disposable databases before scheduled release windows.

## Pending Migration Proposals

| Migration ID | Target | Type | Description | Status | Verification |
|---|---|---|---|---|---|
| `001_add_nopol_clean_functional_index.sql` | `orders` | Functional Index | Menambahkan index pada ekspresi `REPLACE(REPLACE(REPLACE(UPPER(nopol), ' ', ''), '-', ''), '.', '')` untuk mengoptimalkan endpoint `GET /api/v1/public/orders/tracking`. | **PROPOSAL READY** | Terverifikasi pada isolated disposable DB. Mengubah query plan dari `SCAN orders` ke `SEARCH orders USING INDEX idx_orders_nopol_clean (<expr>=?)`. Operational DB unmigrated (invariant protected). |
