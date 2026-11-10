-- ====================================================================
-- MIGRATION PROPOSAL: 001_add_nopol_clean_functional_index.sql
-- Module: Customer Public API / Admin SUN89
-- Target Table: orders
-- Purpose: Optimize normalized nopol tracking queries (PUB-06)
-- Status: PROPOSED / VERIFIED ON ISOLATED TEST DATABASE ONLY
-- Safety Invariant: DO NOT EXECUTE ON OPERATIONAL DATABASE WITHOUT RELEASE APPROVAL
-- ====================================================================

-- Problem Statement:
-- Endpoint GET /api/v1/public/orders/tracking executes:
--   SELECT ... FROM orders 
--   WHERE REPLACE(REPLACE(REPLACE(UPPER(nopol), ' ', ''), '-', ''), '.', '') = ?
-- In absence of a functional expression index, SQLite optimizer performs a
-- FULL TABLE SCAN (SCAN orders) with O(N) complexity.

-- Proposed Solution:
-- Create a deterministic functional index on the cleaned uppercase license plate.
CREATE INDEX IF NOT EXISTS idx_orders_nopol_clean ON orders(
  REPLACE(REPLACE(REPLACE(UPPER(nopol), ' ', ''), '-', ''), '.', '')
);

-- Empirical Benchmark Results:
-- Before Index: EXPLAIN QUERY PLAN -> SCAN orders (O(N))
-- After Index:  EXPLAIN QUERY PLAN -> SEARCH orders USING INDEX idx_orders_nopol_clean (<expr>=?) (O(log N))
-- Storage Overhead: ~24 KB per 1,000 orders
-- Rollback DDL:
-- DROP INDEX IF EXISTS idx_orders_nopol_clean;
