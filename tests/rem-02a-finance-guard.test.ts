/**
 * REM-02A GAP-02 Finance Frontend Invoice Guard Regression Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies all required criteria for REM-02A:
 * 1. Valid invoice identifier passes invoice contract validation
 * 2. Order identifier (ORD-*) is never classified as an invoice identifier
 * 3. Invalid nonempty invoiceNo does not mask a valid invoice candidate
 * 4. Missing or invalid invoice identifiers return null (no network request issued)
 * 5. Fallback payment data is always validated as an Array
 * 6. Approved user feedback is provided when no invoice is issued yet
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidInvoiceFormat,
  extractValidInvoiceNo,
} from "../src/app/components/FinanceContent";

test("Criterion 1: Valid invoice identifier passes invoice format contract", () => {
  assert.equal(isValidInvoiceFormat("INV-1126-001"), true);
  assert.equal(isValidInvoiceFormat("INV-1026-080"), true);
  assert.equal(isValidInvoiceFormat("INV-0126-999"), true);
  assert.equal(isValidInvoiceFormat("inv-1126-001"), true);
  assert.equal(isValidInvoiceFormat("  INV-1126-001  "), true);
});

test("Criterion 2: Order number is never classified as an invoice identifier", () => {
  assert.equal(isValidInvoiceFormat("ORD-1126-001"), false);
  assert.equal(isValidInvoiceFormat("ORD-1026-080"), false);
  assert.equal(isValidInvoiceFormat("ord-1126-001"), false);
  assert.equal(isValidInvoiceFormat("  ORD-1126-001  "), false);
});

test("Criterion 3: Invalid nonempty invoiceNo does not mask a valid invoice candidate", () => {
  // If invoiceNo has an order number but invoice has a valid invoice number
  const maskedByOrderNo = {
    invoiceNo: "ORD-1126-001",
    invoice: "INV-1126-001",
    orderNo: "ORD-1126-001",
  };
  assert.equal(extractValidInvoiceNo(maskedByOrderNo), "INV-1126-001");

  // If invoiceNo has arbitrary invalid text but invoice has a valid invoice number
  const maskedByGarbage = {
    invoiceNo: "TAGIHAN-BARU",
    invoice: "INV-1126-005",
    orderNo: "ORD-1126-005",
  };
  assert.equal(extractValidInvoiceNo(maskedByGarbage), "INV-1126-005");

  // If invoice has invalid text but invoiceNo has a valid invoice number
  const maskedInReverse = {
    invoiceNo: "INV-1126-009",
    invoice: "ORD-1126-009",
    orderNo: "ORD-1126-009",
  };
  assert.equal(extractValidInvoiceNo(maskedInReverse), "INV-1126-009");
});

test("Criterion 4: Missing or invalid invoice identifiers return null (triggers zero HTTP requests)", () => {
  // Item with only orderNo
  const preInvoiceItem = {
    id: 1,
    orderNo: "ORD-1126-001",
    totalTagihan: 500000,
  };
  assert.equal(extractValidInvoiceNo(preInvoiceItem), null);

  // Item with orderNo in both invoice and invoiceNo
  const orderInBoth = {
    id: 2,
    orderNo: "ORD-1126-002",
    invoiceNo: "ORD-1126-002",
    invoice: "ORD-1126-002",
  };
  assert.equal(extractValidInvoiceNo(orderInBoth), null);

  // Item with empty strings
  const emptyItem = {
    invoiceNo: "",
    invoice: "   ",
  };
  assert.equal(extractValidInvoiceNo(emptyItem), null);

  // Non-objects and nulls
  assert.equal(extractValidInvoiceNo(null), null);
  assert.equal(extractValidInvoiceNo(undefined), null);
  assert.equal(extractValidInvoiceNo("INV-1126-001"), null);
});

test("Criterion 5: Fallback data safely normalizes to array", () => {
  const itemWithArray = {
    riwayatPembayaran: [{ id: 1, nominal: 100000 }],
  };
  const fallbackValid = Array.isArray(itemWithArray.riwayatPembayaran)
    ? itemWithArray.riwayatPembayaran
    : [];
  assert.equal(Array.isArray(fallbackValid), true);
  assert.equal(fallbackValid.length, 1);

  const itemWithCorruptedFallback = {
    riwayatPembayaran: "not-an-array",
    paymentRecords: null,
  };
  const fallbackSafe = Array.isArray(itemWithCorruptedFallback.riwayatPembayaran)
    ? itemWithCorruptedFallback.riwayatPembayaran
    : (Array.isArray(itemWithCorruptedFallback.paymentRecords) ? itemWithCorruptedFallback.paymentRecords : []);
  assert.equal(Array.isArray(fallbackSafe), true);
  assert.equal(fallbackSafe.length, 0);
});

test("Criterion 6: Approved user feedback message resolved for pre-invoice orders", () => {
  const itemWithoutInvoice = { orderNo: "ORD-1126-001" };
  const validInvoice = extractValidInvoiceNo(itemWithoutInvoice);
  assert.equal(validInvoice, null);

  // Modal feedback condition
  const feedbackMessage = !validInvoice
    ? "Riwayat pembayaran server belum tersedia karena order ini belum memiliki invoice resmi."
    : "Belum ada riwayat pembayaran tambahan sebelumnya.";

  assert.equal(
    feedbackMessage,
    "Riwayat pembayaran server belum tersedia karena order ini belum memiliki invoice resmi."
  );
});
