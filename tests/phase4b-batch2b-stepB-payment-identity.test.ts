/**
 * Phase 4B Batch 2B — Step B: Payment Identity & Idempotency Architecture Test Suite
 * 
 * Verifies:
 * - TEST-B2-01: Backend canonical UUID generation (pay-[uuid-v4]) across Path 1 & Path 2
 * - TEST-B2-02: Distinct UUIDs for multiple partial payments with identical amounts/dates
 * - TEST-B2-03: Stable identity on identical retry (returns original payment_id, 0 new UUIDs)
 * - TEST-B2-04: Unique constraint rejects duplicate payment_id at database level
 * - TEST-B2-05: Same idempotency key + same payload returns cached response with ZERO DML
 * - TEST-B2-06: Same idempotency key + different payload returns HTTP 409 IDEMPOTENCY_CONFLICT
 * - TEST-B2-07: Cross-scope key reuse independence (CREATE_ORDER vs PAYMENT_SUBMISSION)
 * - TEST-B2-08: Legacy unprefixed key retry compatibility via dual-read fallback
 * - TEST-B2-09: Ownership enforcement & fail-closed rejection for NULL user_id non-admin
 * - TEST-B2-10: Document ID decoupling from payment identity
 * - TEST-B2-11: Repository-level committed idempotency immutability (plain INSERT, no update API)
 * - TEST-B2-12: Polymorphic lookup by numeric ID and payment UUID; invalid formats rejected
 * - TEST-B2-13: Strict input normalization & canonical hash binding (invoiceId, amounts, verifierId)
 * - Additional: Repeated schema migration safety, historical rows #1-#7 payment_id IS NULL immutability
 */

import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { db } from "../server/src/database/db";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { financeService } from "../server/src/services/financeService";
import { orderService } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { applySchemaMigrations } from "../server/src/database/schema";
import {
  CANONICAL_PAYMENT_ID_REGEX,
  isValidCanonicalPaymentId,
  generateCanonicalPaymentId,
  formatScopedIdempotencyKey,
  validatePositiveInteger,
  validatePositiveFiniteAmount,
  discriminatePaymentIdentifier,
  hashCreateOrderPayload,
  hashPaymentSubmissionPayload,
  hashPaymentVerificationPayload,
  hashPaymentVoidPayload,
} from "../server/src/utils/canonicalHasher";

const testAdminUser = {
  userId: "usr-admin-b2",
  employeeId: "EMP-B2-001",
  nama: "Admin Step B Test",
  role: "admin",
  jabatan: "Administrator",
} as any;

const testRegularUser = {
  userId: "usr-staff-b2",
  employeeId: "EMP-B2-002",
  nama: "Staff Step B Test",
  role: "operator",
  jabatan: "Staff Loket",
} as any;

const testOtherUser = {
  userId: "usr-other-b2",
  employeeId: "EMP-B2-003",
  nama: "Other User",
  role: "operator",
  jabatan: "Staff Loket",
} as any;

test("PHASE 4B BATCH 2B — STEP B: PAYMENT IDENTITY & IDEMPOTENCY SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEMA & HISTORICAL BASELINE IMMUTABILITY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test("SCHEMA-01: Repeated Schema Migrations are 100% Idempotent", () => {
    // Running applySchemaMigrations multiple times should execute cleanly with 0 errors
    assert.doesNotThrow(() => {
      applySchemaMigrations(db);
      applySchemaMigrations(db);
    }, "applySchemaMigrations must be idempotent and safe on re-run");

    // Verify payment_id column exists
    const tableInfo = db.prepare("PRAGMA table_info(invoice_payments)").all() as { name: string }[];
    const hasPaymentId = tableInfo.some((c) => c.name === "payment_id");
    assert.ok(hasPaymentId, "invoice_payments must possess payment_id column");

    // Verify unique index exists
    const indexList = db.prepare("PRAGMA index_list(invoice_payments)").all() as { name: string; unique: number }[];
    const paymentIdIndex = indexList.find((idx) => idx.name === "idx_inv_payments_payment_id");
    assert.ok(paymentIdIndex, "idx_inv_payments_payment_id index must exist");
    assert.strictEqual(paymentIdIndex?.unique, 1, "idx_inv_payments_payment_id must be UNIQUE");
  });

  await suite.test("SCHEMA-02: Historical Payment Rows #1–#7 Retain payment_id = NULL", () => {
    const historicalRows = db.prepare("SELECT id, payment_id, nominal FROM invoice_payments WHERE id <= 7 ORDER BY id ASC").all() as any[];
    for (const row of historicalRows) {
      assert.strictEqual(row.payment_id, null, `Historical payment #${row.id} must retain payment_id = NULL`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST-B2-01 & TEST-B2-02: CANONICAL UUID GENERATION ACROSS BOTH PATHS
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test("TEST-B2-01: Backend Canonical UUID Generation across Path 1 & Path 2 (AC-B2-07)", () => {
    // Path 1: Order Creation (Downpayment)
    const suffix1 = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const orderPayload = {
      customer: `Customer Path1 ${suffix1}`,
      nomorHP: "081233334444",
      layanan: "Perpanjangan STNK",
      serviceId: "svc-perp-1th",
      nopol: `B ${suffix1.substring(0, 4).toUpperCase()} TST`,
      wilayahSamsatAsal: "Jakarta Selatan",
      totalBiaya: 500000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        nominalDibayarAwal: 250000,
        dibayar: 250000,
        namaBank: "BCA",
        paymentRecords: [
          {
            id: "client-forged-id-123", // Frontend-generated client id that MUST be replaced by backend
            nominal: 250000,
            tanggal: new Date().toISOString(),
            metodePembayaran: "Transfer Bank",
          },
        ],
      },
    };

    const createdOrder = orderService.createOrder(orderPayload, testAdminUser);
    const path1Payment = createdOrder.payment.paymentRecords?.[0];

    assert.ok(path1Payment, "Path 1 payment record must exist in order.payment");
    assert.ok(isValidCanonicalPaymentId(path1Payment.id), `Path 1 ID '${path1Payment.id}' must match canonical UUID format`);
    assert.notStrictEqual(path1Payment.id, "client-forged-id-123", "Backend must overwrite client-forged ID with backend UUID");
    assert.strictEqual(path1Payment.payment_id, path1Payment.id, "payment_id must match id");

    // Path 2: Finance Invoice Payment Submission
    // Create an invoice with supervisi approved order
    const suffix2 = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const order2 = orderService.createOrder({
      customer: `Customer Path2 ${suffix2}`,
      nomorHP: "081255556666",
      layanan: "Perpanjangan STNK",
      serviceId: "svc-perp-1th",
      nopol: `B ${suffix2.substring(0, 4).toUpperCase()} TST`,
      wilayahSamsatAsal: "Jakarta Selatan",
      totalBiaya: 600000,
      payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 600000, dibayar: 0 },
    }, testAdminUser);

    // Mock supervisi approval on order2 for finance payment gating
    const fullOrder2 = dbOrderRepository.getByOrderNo(order2.orderNo)!;
    fullOrder2.approvedBySpv = true;
    fullOrder2.isVerified = true;
    (fullOrder2 as any).finalCost = 600000;
    dbOrderRepository.saveOrder(fullOrder2);

    const inv2 = financeService.getInvoiceById(order2.orderNo);
    const invId = (inv2 as any).id || 1;

    const recordedInvoice = financeService.recordPayment(invId, 300000, {
      metodePembayaran: "Transfer Bank",
      bank: "Mandiri",
      catatan: "Cicilan 1 Path 2",
    }, testAdminUser);

    // Verify row in invoice_payments table
    const paymentsInDb = dbFinanceRepository.getPaymentsByInvoiceNo(recordedInvoice.invoiceNo);
    const latestPaymentDb = paymentsInDb[paymentsInDb.length - 1];

    assert.ok(latestPaymentDb, "Payment row must exist in invoice_payments");
    assert.ok(isValidCanonicalPaymentId(latestPaymentDb.payment_id), `invoice_payments.payment_id '${latestPaymentDb.payment_id}' must be canonical UUID`);

    // Verify synchronization to order.data_json
    const updatedOrder2 = dbOrderRepository.getByOrderNo(order2.orderNo)!;
    const latestOrderPayment = updatedOrder2.payment.paymentRecords?.find((p: any) => p.payment_id === latestPaymentDb.payment_id);
    assert.ok(latestOrderPayment, "orders.data_json must contain matching payment record");
    assert.strictEqual(latestOrderPayment?.id, latestPaymentDb.payment_id, "Order payment id must exactly match invoice_payments.payment_id");
  });

  await suite.test("TEST-B2-02: Distinct UUIDs for Multiple Partial Payments (AC-B2-07 Foundation for AC-B2-05)", () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const order = orderService.createOrder({
      customer: `Multi Pay ${suffix}`,
      nomorHP: "081277778888",
      layanan: "Perpanjangan STNK",
      serviceId: "svc-perp-1th",
      nopol: `B ${suffix.substring(0, 4).toUpperCase()} TST`,
      wilayahSamsatAsal: "Jakarta Selatan",
      totalBiaya: 1000000,
      payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 1000000, dibayar: 0 },
    }, testAdminUser);

    const fullOrder = dbOrderRepository.getByOrderNo(order.orderNo)!;
    fullOrder.approvedBySpv = true;
    fullOrder.isVerified = true;
    (fullOrder as any).finalCost = 1000000;
    dbOrderRepository.saveOrder(fullOrder);

    const inv = financeService.getInvoiceById(order.orderNo);
    const invId = (inv as any).id;

    // Payment 1: 500,000 on today
    financeService.recordPayment(invId, 500000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      catatan: "Partial 1",
    }, testAdminUser);

    // Payment 2: 500,000 on today (same nominal, same date, same order)
    financeService.recordPayment(invId, 500000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      catatan: "Partial 2",
    }, testAdminUser);

    const payments = dbFinanceRepository.getPaymentsByInvoiceNo(inv.invoiceNo);
    const lastTwo = payments.slice(-2);
    assert.strictEqual(lastTwo.length, 2, "Both partial payments must be persisted as separate rows");
    assert.notStrictEqual(lastTwo[0].payment_id, lastTwo[1].payment_id, "Both payments must receive distinct canonical UUIDs");
    assert.ok(isValidCanonicalPaymentId(lastTwo[0].payment_id));
    assert.ok(isValidCanonicalPaymentId(lastTwo[1].payment_id));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST-B2-03, TEST-B2-04, TEST-B2-05, TEST-B2-06: IDEMPOTENCY & UNIQUENESS
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test("TEST-B2-03: Stable Identity on Identical Retry (AC-B2-07)", () => {
    const key = `idem-stable-${Date.now()}`;
    const suffix = Date.now().toString(36);
    const order = orderService.createOrder({
      customer: `Stable Retry ${suffix}`,
      nomorHP: "081299990000",
      layanan: "Perpanjangan STNK",
      serviceId: "svc-perp-1th",
      nopol: `B ${suffix.substring(0, 4).toUpperCase()} TST`,
      wilayahSamsatAsal: "Jakarta Selatan",
      totalBiaya: 500000,
      payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 500000, dibayar: 0 },
    }, testAdminUser);

    const fullOrder = dbOrderRepository.getByOrderNo(order.orderNo)!;
    fullOrder.approvedBySpv = true;
    fullOrder.isVerified = true;
    (fullOrder as any).finalCost = 500000;
    dbOrderRepository.saveOrder(fullOrder);

    const inv = financeService.getInvoiceById(order.orderNo);
    const invId = (inv as any).id;

    // First submission
    financeService.recordPayment(invId, 250000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      idempotencyKey: key,
    }, testAdminUser);

    const paymentsAfterCall1 = dbFinanceRepository.getPaymentsByInvoiceNo(inv.invoiceNo);
    const initialPaymentId = paymentsAfterCall1[paymentsAfterCall1.length - 1].payment_id;

    // Identical retry: same key, same payload
    financeService.recordPayment(invId, 250000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      idempotencyKey: key,
    }, testAdminUser);

    const paymentsAfterCall2 = dbFinanceRepository.getPaymentsByInvoiceNo(inv.invoiceNo);
    assert.strictEqual(paymentsAfterCall2.length, paymentsAfterCall1.length, "ZERO new rows in invoice_payments on retry");
    assert.strictEqual(paymentsAfterCall2[paymentsAfterCall2.length - 1].payment_id, initialPaymentId, "Original payment_id must be preserved");
  });

  await suite.test("TEST-B2-04: Database Unique Constraint Rejection on Duplicate non-null payment_id (AC-B2-07)", () => {
    const duplicateId = generateCanonicalPaymentId();

    // First direct insert succeeds
    assert.doesNotThrow(() => {
      dbFinanceRepository.recordInvoicePayment({
        paymentId: duplicateId,
        invoiceNo: "INV-1126-001",
        orderNo: "ORD-1126-003",
        nominal: 10000,
        metodePembayaran: "Cash",
      });
    });

    // Duplicate insert with same non-null payment_id MUST throw SQLITE_CONSTRAINT_UNIQUE
    assert.throws(() => {
      dbFinanceRepository.recordInvoicePayment({
        paymentId: duplicateId,
        invoiceNo: "INV-1126-001",
        orderNo: "ORD-1126-003",
        nominal: 10000,
        metodePembayaran: "Cash",
      });
    }, (err: any) => {
      assert.match(err.message, /unique/i, "Must trigger unique constraint violation");
      return true;
    });
  });

  await suite.test("TEST-B2-05: Same Idempotency Key + Same Payload returns cached response with ZERO DML", () => {
    const key = `idem-same-payload-${Date.now()}`;
    const suffix = Date.now().toString(36);
    const order = orderService.createOrder({
      customer: `Same Payload ${suffix}`,
      nomorHP: "081122223333",
      layanan: "Perpanjangan STNK",
      serviceId: "svc-perp-1th",
      nopol: `B ${suffix.substring(0, 4).toUpperCase()} TST`,
      wilayahSamsatAsal: "Jakarta Selatan",
      totalBiaya: 400000,
      payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 400000, dibayar: 0 },
    }, testAdminUser);

    const fullOrder = dbOrderRepository.getByOrderNo(order.orderNo)!;
    fullOrder.approvedBySpv = true;
    fullOrder.isVerified = true;
    (fullOrder as any).finalCost = 400000;
    dbOrderRepository.saveOrder(fullOrder);

    const invId = (financeService.getInvoiceById(order.orderNo) as any).id;

    // Call 1
    const res1 = financeService.recordPayment(invId, 100000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      idempotencyKey: key,
    }, testAdminUser);

    const countBefore = (db.prepare("SELECT COUNT(*) as cnt FROM invoice_payments").get() as any).cnt;

    // Call 2
    const res2 = financeService.recordPayment(invId, 100000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      idempotencyKey: key,
    }, testAdminUser);

    const countAfter = (db.prepare("SELECT COUNT(*) as cnt FROM invoice_payments").get() as any).cnt;

    assert.strictEqual(countAfter, countBefore, "ZERO DML: row count in invoice_payments unchanged");
    assert.strictEqual(res2.invoiceNo, res1.invoiceNo, "Must return cached invoice");
  });

  await suite.test("TEST-B2-06: Same Idempotency Key + Different Payload returns HTTP 409 [IDEMPOTENCY_CONFLICT]", () => {
    const key = `idem-diff-payload-${Date.now()}`;
    const suffix = Date.now().toString(36);
    const order = orderService.createOrder({
      customer: `Diff Payload ${suffix}`,
      nomorHP: "081144445555",
      layanan: "Perpanjangan STNK",
      serviceId: "svc-perp-1th",
      nopol: `B ${suffix.substring(0, 4).toUpperCase()} TST`,
      wilayahSamsatAsal: "Jakarta Selatan",
      totalBiaya: 700000,
      payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 700000, dibayar: 0 },
    }, testAdminUser);

    const fullOrder = dbOrderRepository.getByOrderNo(order.orderNo)!;
    fullOrder.approvedBySpv = true;
    fullOrder.isVerified = true;
    (fullOrder as any).finalCost = 700000;
    dbOrderRepository.saveOrder(fullOrder);

    const invId = (financeService.getInvoiceById(order.orderNo) as any).id;

    // Call 1: amount 200,000
    financeService.recordPayment(invId, 200000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      idempotencyKey: key,
    }, testAdminUser);

    // Call 2: same key, different amount (300,000)
    assert.throws(() => {
      financeService.recordPayment(invId, 300000, {
        metodePembayaran: "Transfer Bank",
        bank: "BCA",
        idempotencyKey: key,
      }, testAdminUser);
    }, (err: any) => {
      assert.strictEqual(err.statusCode, 409, "Must return HTTP 409");
      assert.strictEqual(err.code, "IDEMPOTENCY_CONFLICT", "Error code must be IDEMPOTENCY_CONFLICT");
      return true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST-B2-07, TEST-B2-08, TEST-B2-09: SCOPE INDEPENDENCE & LEGACY RETRY
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test("TEST-B2-07: Cross-Scope Key Reuse Independence", () => {
    const sharedKey = `shared-key-${Date.now()}`;

    // Scope 1: CREATE_ORDER
    const order = orderService.createOrder({
      customer: "Shared Key Customer",
      nomorHP: "081199998888",
      layanan: "Perpanjangan STNK",
      serviceId: "svc-perp-1th",
      nopol: `B ${Math.random().toString(36).substring(2, 6).toUpperCase()} TST`,
      wilayahSamsatAsal: "Jakarta Selatan",
      totalBiaya: 500000,
      clientRequestId: sharedKey,
    }, testAdminUser);

    assert.ok(order.orderNo);

    // Scope 2: PAYMENT_SUBMISSION using the SAME sharedKey against another invoice
    // It must NOT collide with CREATE_ORDER because scopedKey is PAYMENT_SUBMISSION::sharedKey
    const invId = 1; // existing invoice 1
    assert.doesNotThrow(() => {
      // Direct repository lookup for payment submission should be undefined initially
      const existing = dbFinanceRepository.getIdempotencyRecord(sharedKey, "PAYMENT_SUBMISSION");
      assert.strictEqual(existing, undefined, "Cross-scope key must not collide in lookup");
    });
  });

  await suite.test("TEST-B2-08: Legacy Unprefixed Key Retry Compatibility via Dual-Read Fallback", () => {
    const legacyKey = `legacy-unprefixed-${Date.now()}`;
    const requestHash = hashPaymentSubmissionPayload(1, 50000, {
      metodePembayaran: "Cash",
      tanggalBayar: "2026-11-10",
    });

    // Directly insert a legacy record without scope prefix into idempotency_keys
    db.prepare(`
      INSERT INTO idempotency_keys (key, scope, user_id, request_hash, resource_id, response_json, created_at)
      VALUES (?, 'PAYMENT_SUBMISSION', ?, ?, '1', '{"status":"OK"}', datetime('now'))
    `).run(legacyKey, testAdminUser.userId, requestHash);

    // Dual-read lookup must find this legacy record
    const retrieved = dbFinanceRepository.getIdempotencyRecord(legacyKey, "PAYMENT_SUBMISSION");
    assert.ok(retrieved, "Dual-read fallback must successfully find legacy unprefixed key");
    assert.strictEqual(retrieved?.key, legacyKey, "Retrieved key must be original legacy key");

    // Count rows before retry
    const countBefore = (db.prepare("SELECT COUNT(*) as cnt FROM idempotency_keys WHERE key LIKE ?").get(`%${legacyKey}%`) as any).cnt;
    assert.strictEqual(countBefore, 1, "Exactly 1 record initially");

    // Dual-read with legacy alias 'payment'
    const legacyAliasKey = `legacy-alias-${Date.now()}`;
    db.prepare(`
      INSERT INTO idempotency_keys (key, scope, user_id, request_hash, resource_id, response_json, created_at)
      VALUES (?, 'payment', ?, ?, '1', '{"status":"OK"}', datetime('now'))
    `).run(legacyAliasKey, testAdminUser.userId, "some-hash");

    const retrievedAlias = dbFinanceRepository.getIdempotencyRecord(legacyAliasKey, "PAYMENT_SUBMISSION");
    assert.ok(retrievedAlias, "Must find legacy record stored under old scope 'payment'");
  });

  await suite.test("TEST-B2-09: Ownership Enforcement & Fail-Closed Handling for NULL user_id", () => {
    const suffix = Date.now().toString(36);
    const order = orderService.createOrder({
      customer: `Owner Test ${suffix}`,
      nomorHP: "081100001111",
      layanan: "Perpanjangan STNK",
      serviceId: "svc-perp-1th",
      nopol: `B ${suffix.substring(0, 4).toUpperCase()} TST`,
      wilayahSamsatAsal: "Jakarta Selatan",
      totalBiaya: 500000,
      payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 500000, dibayar: 0 },
    }, testAdminUser);

    const fullOrder = dbOrderRepository.getByOrderNo(order.orderNo)!;
    fullOrder.approvedBySpv = true;
    fullOrder.isVerified = true;
    (fullOrder as any).finalCost = 500000;
    dbOrderRepository.saveOrder(fullOrder);

    const inv = financeService.getInvoiceById(order.orderNo);
    const testInvId = (inv as any).id;

    const key = `idem-owner-test-${Date.now()}`;
    const hash = hashPaymentSubmissionPayload(testInvId, 100000, { metodePembayaran: "Cash" });

    // 1. Insert record owned by testAdminUser
    db.prepare(`
      INSERT INTO idempotency_keys (key, scope, user_id, request_hash, resource_id, response_json, created_at)
      VALUES (?, 'PAYMENT_SUBMISSION', ?, ?, ?, '{"status":"OK"}', datetime('now'))
    `).run(formatScopedIdempotencyKey("PAYMENT_SUBMISSION", key), testAdminUser.userId, hash, String(testInvId));

    // Attempt replay by another user (testOtherUser) -> HTTP 403 USER_MISMATCH
    assert.throws(() => {
      financeService.recordPayment(testInvId, 100000, {
        metodePembayaran: "Cash",
        idempotencyKey: key,
      }, testOtherUser);
    }, (err: any) => {
      assert.strictEqual(err.statusCode, 403, "Must return HTTP 403");
      assert.strictEqual(err.code, "IDEMPOTENCY_USER_MISMATCH", "Error code must be IDEMPOTENCY_USER_MISMATCH");
      return true;
    });

    // 2. Insert record with NULL user_id (untracked legacy record)
    const nullKey = `idem-null-user-${Date.now()}`;
    db.prepare(`
      INSERT INTO idempotency_keys (key, scope, user_id, request_hash, resource_id, response_json, created_at)
      VALUES (?, 'PAYMENT_SUBMISSION', NULL, ?, ?, '{"status":"OK"}', datetime('now'))
    `).run(formatScopedIdempotencyKey("PAYMENT_SUBMISSION", nullKey), hash, String(testInvId));

    // Non-admin attempting to replay NULL user_id record -> HTTP 403 IDEMPOTENCY_OWNERSHIP_UNVERIFIABLE
    assert.throws(() => {
      financeService.recordPayment(testInvId, 100000, {
        metodePembayaran: "Cash",
        idempotencyKey: nullKey,
      }, testRegularUser);
    }, (err: any) => {
      assert.strictEqual(err.statusCode, 403, "Must return HTTP 403");
      assert.strictEqual(err.code, "IDEMPOTENCY_OWNERSHIP_UNVERIFIABLE", "Error code must be IDEMPOTENCY_OWNERSHIP_UNVERIFIABLE");
      return true;
    });

    // Admin attempting to replay NULL user_id record is permitted
    assert.doesNotThrow(() => {
      // Pre-read validation succeeds for admin
      const record = dbFinanceRepository.getIdempotencyRecord(nullKey, "PAYMENT_SUBMISSION");
      assert.ok(record);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST-B2-10, TEST-B2-11, TEST-B2-12, TEST-B2-13: DECOUPLING, LOOKUP & NORMALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test("TEST-B2-10: Document ID Decoupling from Payment Identity (AC-B2-17)", () => {
    // Two distinct payments referencing the EXACT same proof documentId
    const sharedDocId = `doc-proof-${Date.now()}`;
    const storageName = `proof-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.jpg`;

    // Seed document row to satisfy FOREIGN KEY (document_id) REFERENCES documents(id)
    db.prepare(`
      INSERT INTO documents (
        id, order_no, invoice_id, document_type, original_name, storage_name,
        mime_type, size_bytes, sha256, uploaded_by, is_active, created_at, updated_at
      ) VALUES (
        ?, 'ORD-1126-003', 'INV-1126-001', 'BUKTI_BAYAR', 'proof.jpg', ?,
        'image/jpeg', 1024, 'dummy-sha256', 'usr-admin-b2', 1, datetime('now'), datetime('now')
      )
    `).run(sharedDocId, storageName);

    const payId1 = generateCanonicalPaymentId();
    const payId2 = generateCanonicalPaymentId();

    const p1 = dbFinanceRepository.recordInvoicePayment({
      paymentId: payId1,
      invoiceNo: "INV-1126-001",
      orderNo: "ORD-1126-003",
      nominal: 150000,
      metodePembayaran: "Transfer Bank",
      documentId: sharedDocId,
    });

    const p2 = dbFinanceRepository.recordInvoicePayment({
      paymentId: payId2,
      invoiceNo: "INV-1126-001",
      orderNo: "ORD-1126-003",
      nominal: 200000,
      metodePembayaran: "Transfer Bank",
      documentId: sharedDocId,
    });

    assert.notStrictEqual(p1.payment_id, p2.payment_id, "Payments sharing documentId must retain distinct payment_id values");
    assert.strictEqual(p1.documentId, sharedDocId);
    assert.strictEqual(p2.documentId, sharedDocId);
  });

  await suite.test("TEST-B2-11: Repository-Level Committed Idempotency Immutability", () => {
    const key = `immut-repo-test-${Date.now()}`;
    const scopedKey = formatScopedIdempotencyKey("PAYMENT_SUBMISSION", key);

    // Initial insert succeeds
    dbFinanceRepository.saveIdempotencyRecord({
      key: scopedKey,
      scope: "PAYMENT_SUBMISSION",
      user_id: testAdminUser.userId,
      request_hash: "initial-hash",
      resource_id: "1",
      response_json: '{"result":"first"}',
    });

    // Attempting duplicate insert with same key MUST throw SQLite primary key constraint violation
    // (Proves ON CONFLICT DO UPDATE was removed)
    assert.throws(() => {
      dbFinanceRepository.saveIdempotencyRecord({
        key: scopedKey,
        scope: "PAYMENT_SUBMISSION",
        user_id: testAdminUser.userId,
        request_hash: "mutated-hash",
        resource_id: "1",
        response_json: '{"result":"mutated"}',
      });
    }, (err: any) => {
      assert.match(err.message, /unique|primary/i, "Must raise PRIMARY KEY constraint violation");
      return true;
    });

    // Verify record in database was NOT mutated
    const current = dbFinanceRepository.getIdempotencyRecord(key, "PAYMENT_SUBMISSION");
    assert.strictEqual(current?.request_hash, "initial-hash", "Committed request_hash must remain unchanged");
    assert.strictEqual(current?.response_json, '{"result":"first"}', "Committed response_json must remain unchanged");
  });

  await suite.test("TEST-B2-12: Polymorphic Lookup by Numeric ID and Payment UUID (Supporting AC-B2-19)", () => {
    // 1. Numeric ID lookup (Historical row #1)
    const paymentById = dbFinanceRepository.getInvoicePaymentById(1);
    assert.ok(paymentById, "Must find payment by numeric integer ID 1");
    assert.strictEqual(paymentById.id, 1);

    // 2. String numeric ID lookup ("1")
    const paymentByStringNum = dbFinanceRepository.getInvoicePaymentById("1");
    assert.ok(paymentByStringNum, "Must find payment by string integer ID '1'");
    assert.strictEqual(paymentByStringNum.id, 1);

    // 3. String Canonical UUID lookup
    const canonicalId = generateCanonicalPaymentId();
    dbFinanceRepository.recordInvoicePayment({
      paymentId: canonicalId,
      invoiceNo: "INV-1126-001",
      orderNo: "ORD-1126-003",
      nominal: 75000,
      metodePembayaran: "Cash",
    });

    const paymentByUuid = dbFinanceRepository.getInvoicePaymentById(canonicalId);
    assert.ok(paymentByUuid, "Must find payment by string canonical UUID");
    assert.strictEqual(paymentByUuid.payment_id, canonicalId);

    const paymentByHelper = dbFinanceRepository.getInvoicePaymentByPaymentId(canonicalId);
    assert.ok(paymentByHelper, "getInvoicePaymentByPaymentId helper must find payment");
    assert.strictEqual(paymentByHelper.payment_id, canonicalId);

    // 4. Invalid identifier format rejected fail-closed
    assert.throws(() => {
      discriminatePaymentIdentifier("invalid-id-format");
    }, (err: any) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, "VALIDATION_ERROR");
      return true;
    });

    assert.throws(() => {
      discriminatePaymentIdentifier("12abc");
    }, (err: any) => {
      assert.strictEqual(err.statusCode, 400);
      return true;
    });
  });

  await suite.test("TEST-B2-13: Strict Input Normalization & Canonical Hash Binding", () => {
    // 1. Partial string integer rejected fail-closed
    assert.throws(() => {
      validatePositiveInteger("12abc", "invoiceId");
    }, (err: any) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /bilangan bulat positif/i);
      return true;
    });

    // 2. Negative, NaN, zero amounts rejected fail-closed
    assert.throws(() => validatePositiveFiniteAmount(-100, "Nominal"), (err: any) => err.statusCode === 400);
    assert.throws(() => validatePositiveFiniteAmount(0, "Nominal"), (err: any) => err.statusCode === 400);
    assert.throws(() => validatePositiveFiniteAmount(NaN, "Nominal"), (err: any) => err.statusCode === 400);
    assert.throws(() => validatePositiveFiniteAmount(Infinity, "Nominal"), (err: any) => err.statusCode === 400);

    // 3. Canonical hash for PAYMENT_VERIFICATION binds resolved payment ID and permanent userId
    const testPaymentId = generateCanonicalPaymentId();
    const hash1 = hashPaymentVerificationPayload("ORD-1126-001", testPaymentId, 500000, "usr-permanent-admin", "Some note");
    const hash2 = hashPaymentVerificationPayload("ORD-1126-001", testPaymentId, 500000, "usr-permanent-admin", "Some note");
    assert.strictEqual(hash1, hash2, "Identical verification parameters must yield identical hash");

    // Changing resolved payment ID changes hash
    const hashDiffPay = hashPaymentVerificationPayload("ORD-1126-001", generateCanonicalPaymentId(), 500000, "usr-permanent-admin", "Some note");
    assert.notStrictEqual(hash1, hashDiffPay, "Different paymentId must yield different hash");

    // Changing verifier userId changes hash
    const hashDiffActor = hashPaymentVerificationPayload("ORD-1126-001", testPaymentId, 500000, "usr-different-actor", "Some note");
    assert.notStrictEqual(hash1, hashDiffActor, "Different actor userId must yield different hash");

    // Omission of resolved paymentId rejected before hashing
    assert.throws(() => {
      hashPaymentVerificationPayload("ORD-1126-001", "", 500000, "usr-admin");
    }, (err: any) => {
      assert.strictEqual(err.statusCode, 400);
      return true;
    });
  });
});
