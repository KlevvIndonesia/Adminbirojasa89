/**
 * FASE 4: END-TO-END PRICING, ORDER CREATION, COST VERIFICATION & INVOICE LIFECYCLE
 * Admin SUN89 — Biro Jasa Management System
 *
 * Integrated Regression & End-to-End Integration Suite:
 * - Module A: Samsat Tariff Isolation, Persistence & Explicit Rp0 vs Unconfigured
 * - Module B: Order Creation (Complete vs Partial Estimate) & Snapshot Integrity
 * - Module C: Security Hardening (PUT /api/orders/:orderNo & advance bypass protection)
 * - Module D: Dedicated Verification Endpoint (POST /api/orders/:orderNo/verify-cost)
 * - Module E: Invoice Payment & Finalization Guards
 * - Module F: Cross-Module Order Correction & Data Integrity
 * - Module G: Failure Scenarios, Edge Cases & Snapshot Stability
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { db } from "../server/src/database/db";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";

function createServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3000;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

test("FASE 4: END-TO-END PRICING, ORDER CREATION, COST VERIFICATION & INVOICE LIFECYCLE", async (t) => {
  const { server, baseUrl } = await createServer();

  t.after(() => {
    server.close();
  });

  // 1. Authenticate Supervisor (Admin / SVP)
  const loginSvpRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "svp@birojasa.com", password: "admin123" }),
  });
  const svpJson = (await loginSvpRes.json()) as any;
  const svpToken = svpJson?.data?.token;
  assert.ok(svpToken, "SVP token must be present");

  // 2. Authenticate Messenger (Unauthorized for cost verification)
  const loginMsgRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "budi.messenger@birojasa.com", password: "messenger123" }),
  });
  const msgJson = (await loginMsgRes.json()) as any;
  const messengerToken = msgJson?.data?.token;
  assert.ok(messengerToken, "Messenger token must be present");

  const svpHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${svpToken}`,
  };

  const messengerHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${messengerToken}`,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE A: SAMSAT TARIFF ISOLATION & VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("Module A: Samsat Tariff Isolation, Persistence & Rp0 Distinction", async () => {
    const officeA = "samsat-e2e-alpha";
    const officeB = "samsat-e2e-beta";

    // Ensure office records exist in database
    db.prepare("DELETE FROM samsat_operational_tariffs WHERE samsat_id IN (?, ?)").run(officeA, officeB);
    db.prepare("DELETE FROM samsat_offices WHERE id IN (?, ?)").run(officeA, officeB);
    db.prepare(`
      INSERT INTO samsat_offices (id, name, wilayah, is_verified, status_aktif)
      VALUES (?, ?, ?, 1, 1), (?, ?, ?, 1, 1)
    `).run(officeA, "Samsat E2E Alpha", "Jakarta Timur", officeB, "Samsat E2E Beta", "Jakarta Barat");

    // A1: Save operational tariffs for Samsat Alpha
    const alphaRes = await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: svpHeaders,
      body: JSON.stringify({
        samsatId: officeA,
        tariffs: [
          { pricingItemId: "pkb-pokok", nominal: 450000 },
          { pricingItemId: "swdkllj-motor", nominal: 0 }, // Explicit Rp0
        ],
      }),
    });
    assert.equal(alphaRes.status, 200, "Should save tariffs for Alpha");

    // A2: Verify Samsat Beta does NOT inherit tariffs from Alpha (strict isolation)
    const betaGetRes = await fetch(`${baseUrl}/api/pricing/samsat-tariffs?samsatId=${officeB}`, {
      headers: svpHeaders,
    });
    const betaData = (await betaGetRes.json()) as any;
    assert.equal(betaGetRes.status, 200);
    const betaPkb = betaData?.data?.find((item: any) => item.pricing_item_id === "pkb-pokok");
    assert.equal(betaPkb, undefined, "Samsat Beta must NOT inherit tariffs from Alpha");

    // A3: Verify explicit Rp0 vs unconfigured in Alpha
    const alphaGetRes = await fetch(`${baseUrl}/api/pricing/samsat-tariffs?samsatId=${officeA}`, {
      headers: svpHeaders,
    });
    const alphaData = (await alphaGetRes.json()) as any;
    const swdklljItem = alphaData?.data?.find((item: any) => item.pricing_item_id === "swdkllj-motor");
    assert.ok(swdklljItem, "Explicit Rp0 item must be returned in saved tariffs");
    assert.equal(swdklljItem.nominal, 0, "Explicit Rp0 nominal must be exactly 0");

    // Unconfigured item (e.g. 'pajak-progresif') must NOT be present in Alpha's configured tariffs
    const unconfiguredItem = alphaData?.data?.find((item: any) => item.pricing_item_id === "pajak-progresif");
    assert.equal(unconfiguredItem, undefined, "Unconfigured tariff must not exist in operational tariffs table");

    // A4: Negative amounts must be strictly rejected
    const negativeRes = await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: svpHeaders,
      body: JSON.stringify({
        samsatId: officeA,
        tariffs: [{ pricingItemId: "pkb-pokok", nominal: -50000 }],
      }),
    });
    assert.equal(negativeRes.status, 400, "Negative tariff amount must return HTTP 400");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE B: ORDER CREATION & SNAPSHOT INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  let partialOrderNo = "";
  let completeOrderNo = "";
  let partialInvoiceId = 0;
  let completeInvoiceId = 0;

  await t.test("Module B: Order Creation (Complete vs Partial) & Snapshot Integrity", async () => {
    // B1: Create Partial Estimate Order (contains unconfigured items)
    const partialSnapshot = {
      completenessStatus: "PARTIAL_ESTIMATE",
      hasUnconfiguredTariff: true,
      unconfiguredItems: ["Pajak Progresif"],
      breakdown: [
        { name: "PKB Pokok", nominal: 500000, status: "CONFIGURED", isConfigured: true },
        { name: "SWDKLLJ", nominal: 35000, status: "CONFIGURED", isConfigured: true },
        { name: "Pajak Progresif", nominal: null, status: "UNCONFIGURED", isConfigured: false },
      ],
      biayaJasa: 100000,
      biayaAntarJemput: 25000,
      totalBiaya: 660000,
      biayaSamsat: 535000,
    };

    const createPartialRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        customer: "Customer Partial E2E",
        nomorHP: "081234567890",
        layanan: "Perpanjangan STNK Tahunan",
        nopol: "B 1001 PAR",
        biayaJasa: 100000,
        biayaAntarJemput: 25000,
        biayaSamsat: 535000,
        totalBiaya: 660000,
        costSnapshot: partialSnapshot,
      }),
    });
    assert.equal(createPartialRes.status, 201, "Partial estimate order creation must succeed");
    const partialCreated = ((await createPartialRes.json()) as any)?.data;
    partialOrderNo = partialCreated.orderNo;
    assert.ok(partialOrderNo);
    assert.equal(partialCreated.isCostVerified, false, "Partial order must be unverified");
    assert.equal(partialCreated.costCompletenessStatus, "PARTIAL_ESTIMATE");

    // Verify low-level SQLite row
    const rowPartial = db.prepare("SELECT is_cost_verified, cost_completeness_status FROM orders WHERE order_no = ?").get(partialOrderNo) as any;
    assert.equal(rowPartial.is_cost_verified, 0);
    assert.equal(rowPartial.cost_completeness_status, "PARTIAL_ESTIMATE");

    // Verify linked invoice
    const invPartial = dbFinanceRepository.getInvoiceByOrderNo(partialOrderNo) as any;
    assert.ok(invPartial, "Invoice must be created");
    partialInvoiceId = invPartial.id;
    assert.equal(invPartial.isDraftEstimate, true, "Invoice must be marked as draft estimate");
    assert.equal(invPartial.costVerificationStatus, "PENDING_VERIFICATION");

    // B2: Create Complete Order (all tariffs configured)
    const completeSnapshot = {
      completenessStatus: "COMPLETE",
      hasUnconfiguredTariff: false,
      unconfiguredItems: [],
      breakdown: [
        { name: "PKB Pokok", nominal: 500000, status: "CONFIGURED", isConfigured: true },
        { name: "SWDKLLJ", nominal: 35000, status: "CONFIGURED", isConfigured: true },
      ],
      biayaJasa: 100000,
      biayaAntarJemput: 25000,
      totalBiaya: 660000,
      biayaSamsat: 535000,
    };

    const createCompleteRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        customer: "Customer Complete E2E",
        nomorHP: "081234567891",
        layanan: "Perpanjangan STNK Tahunan",
        nopol: "B 2002 COM",
        biayaJasa: 100000,
        biayaAntarJemput: 25000,
        biayaSamsat: 535000,
        totalBiaya: 660000,
        costSnapshot: completeSnapshot,
      }),
    });
    assert.equal(createCompleteRes.status, 201, "Complete order creation must succeed");
    const completeCreated = ((await createCompleteRes.json()) as any)?.data;
    completeOrderNo = completeCreated.orderNo;
    assert.ok(completeOrderNo);
    assert.equal(completeCreated.isCostVerified, true, "Complete order must be automatically verified");
    assert.equal(completeCreated.costCompletenessStatus, "COMPLETE");

    const invComplete = dbFinanceRepository.getInvoiceByOrderNo(completeOrderNo) as any;
    completeInvoiceId = invComplete.id;
    assert.equal(invComplete.isDraftEstimate, false);
    assert.equal(invComplete.costVerificationStatus, "VERIFIED");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE C: SECURITY HARDENING ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("Module C: Security Hardening Enforcement on Edit & Advance", async () => {
    // C1: PUT with camelCase isCostVerified is blocked
    const putCamel = await fetch(`${baseUrl}/api/orders/${partialOrderNo}`, {
      method: "PUT",
      headers: svpHeaders,
      body: JSON.stringify({ isCostVerified: true }),
    });
    assert.equal(putCamel.status, 403, "Tampering with isCostVerified must return HTTP 403");
    const jsonCamel = (await putCamel.json()) as any;
    assert.equal(jsonCamel?.error?.code, "PROTECTED_FIELD_VIOLATION");

    // C2: PUT with snake_case is_cost_verified is blocked
    const putSnake = await fetch(`${baseUrl}/api/orders/${partialOrderNo}`, {
      method: "PUT",
      headers: svpHeaders,
      body: JSON.stringify({ is_cost_verified: 1 }),
    });
    assert.equal(putSnake.status, 403, "Tampering with is_cost_verified must return HTTP 403");
    const jsonSnake = (await putSnake.json()) as any;
    assert.equal(jsonSnake?.error?.code, "PROTECTED_FIELD_VIOLATION");

    // C3: PUT with costCompletenessStatus is blocked
    const putStatus = await fetch(`${baseUrl}/api/orders/${partialOrderNo}`, {
      method: "PUT",
      headers: svpHeaders,
      body: JSON.stringify({ costCompletenessStatus: "VERIFIED" }),
    });
    assert.equal(putStatus.status, 403, "Tampering with costCompletenessStatus must return HTTP 403");
    const jsonStatus = (await putStatus.json()) as any;
    assert.equal(jsonStatus?.error?.code, "PROTECTED_FIELD_VIOLATION");

    // C4: Advance stage payload with verification fields is blocked
    const advanceTamper = await fetch(`${baseUrl}/api/orders/${partialOrderNo}/advance`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        targetStage: "Penjadwalan",
        updates: { isCostVerified: true },
      }),
    });
    assert.equal(advanceTamper.status, 403, "Advance payload tampering must return HTTP 403");

    // C5: Legitimate non-sensitive update succeeds without altering verification status
    const updateNormal = await fetch(`${baseUrl}/api/orders/${partialOrderNo}`, {
      method: "PUT",
      headers: svpHeaders,
      body: JSON.stringify({
        customer: "Customer Partial E2E Renamed",
        nopol: "B 1001 MOD",
      }),
    });
    assert.equal(updateNormal.status, 200, "Normal field update must succeed");
    const afterUpdate = dbOrderRepository.getByOrderNo(partialOrderNo);
    assert.equal(afterUpdate?.customer, "Customer Partial E2E Renamed");
    assert.equal(afterUpdate?.isCostVerified, false, "Status must remain unverified after normal edit");
    assert.equal(afterUpdate?.costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE D: DEDICATED VERIFICATION ENDPOINT
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("Module D: Dedicated Verification Endpoint over HTTP", async () => {
    // D1: Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/api/orders/${partialOrderNo}/verify-cost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalBiayaSamsat: 550000 }),
    });
    assert.equal(unauthRes.status, 401, "Unauthenticated request must return 401");

    // D2: Unauthorized role (Messenger) -> 403
    const forbiddenRes = await fetch(`${baseUrl}/api/orders/${partialOrderNo}/verify-cost`, {
      method: "POST",
      headers: messengerHeaders,
      body: JSON.stringify({ finalBiayaSamsat: 550000 }),
    });
    assert.equal(forbiddenRes.status, 403, "Messenger calling verify-cost must return 403");

    // D3: Non-existent order -> 404
    const notFoundRes = await fetch(`${baseUrl}/api/orders/ORD-NONEXISTENT-9999/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({ finalBiayaSamsat: 550000 }),
    });
    assert.equal(notFoundRes.status, 404, "Non-existent order must return 404");

    // D4: Inconsistent cost calculation payload -> 400
    // Order has jasa: 100000, antarJemput: 25000. If samsat is 550000, total must be 675000.
    const inconsistentRes = await fetch(`${baseUrl}/api/orders/${partialOrderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 550000,
        finalTotalBiaya: 999999, // Mismatched!
      }),
    });
    assert.equal(inconsistentRes.status, 400, "Inconsistent cost totals must return 400");
    const inconstJson = (await inconsistentRes.json()) as any;
    assert.equal(inconstJson?.error?.code, "INCONSISTENT_COST_PAYLOAD");

    // Record initial snapshot before official verification
    const snapshotBefore = JSON.stringify(dbOrderRepository.getByOrderNo(partialOrderNo)?.costSnapshot);

    // D5: Authorized Supervisor verifies valid cost -> 200
    const verifyValidRes = await fetch(`${baseUrl}/api/orders/${partialOrderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 550000,
        finalTotalBiaya: 675000,
        notes: "Biaya Samsat disahkan resmi oleh SVP.",
      }),
    });
    assert.equal(verifyValidRes.status, 200, "Authorized verification must succeed with 200");
    const verifiedOrder = ((await verifyValidRes.json()) as any)?.data;
    assert.equal(verifiedOrder.isCostVerified, true);
    assert.equal(verifiedOrder.costCompletenessStatus, "VERIFIED");
    assert.ok(verifiedOrder.costVerifiedBy, "Verifier identity must be set from server auth");

    // D6: Snapshot Immutability check
    const snapshotAfter = JSON.stringify(dbOrderRepository.getByOrderNo(partialOrderNo)?.costSnapshot);
    assert.equal(snapshotBefore, snapshotAfter, "Original costSnapshot must remain strictly immutable");

    // D7: Idempotency check: repeated call succeeds deterministically
    const repeatVerifyRes = await fetch(`${baseUrl}/api/orders/${partialOrderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 550000,
        finalTotalBiaya: 675000,
        notes: "Biaya Samsat disahkan resmi oleh SVP (repeated).",
      }),
    });
    assert.equal(repeatVerifyRes.status, 200, "Repeated verification must return 200");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE E: INVOICE PAYMENT & FINALIZATION GUARDS
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("Module E: Invoice Payment & Finalization Guards", async () => {
    // E1: Create another partial order to test rejection BEFORE verification
    const testPartialRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        customer: "Customer Guard Test",
        nomorHP: "081234567899",
        layanan: "Perpanjangan STNK Tahunan",
        nopol: "B 3003 GRD",
        biayaJasa: 100000,
        biayaAntarJemput: 25000,
        biayaSamsat: 500000,
        totalBiaya: 625000,
        costSnapshot: {
          completenessStatus: "PARTIAL_ESTIMATE",
          hasUnconfiguredTariff: true,
          unconfiguredItems: ["PKB Tambahan"],
          breakdown: [{ name: "PKB Tambahan", nominal: null, status: "UNCONFIGURED" }],
        },
      }),
    });
    assert.equal(testPartialRes.status, 201);
    const guardOrderNo = ((await testPartialRes.json()) as any)?.data?.orderNo;
    // Set supervisi approval so we isolate the cost verification guard exclusively
    dbOrderRepository.updateOrder(guardOrderNo, { approvedBySpv: "Supervisor Phase4" as any, currentStep: 6 });
    const guardInv = dbFinanceRepository.getInvoiceByOrderNo(guardOrderNo);
    assert.ok(guardInv);

    // Attempting to record payment on unverified partial order via HTTP -> 400
    const payBlockedRes = await fetch(`${baseUrl}/api/finance/invoices/${guardInv.id}/pay`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        amount: 625000,
        metodePembayaran: "Transfer",
      }),
    });
    assert.equal(payBlockedRes.status, 400, "Payment on unverified partial order must be blocked with 400");
    const payBlockedJson = (await payBlockedRes.json()) as any;
    assert.equal(payBlockedJson?.error?.code, "COST_VERIFICATION_REQUIRED");

    // Attempting to complete invoice on unverified order via HTTP -> 400
    const completeBlockedRes = await fetch(`${baseUrl}/api/finance/invoices/${guardInv.id}/complete`, {
      method: "POST",
      headers: svpHeaders,
    });
    assert.equal(completeBlockedRes.status, 400, "Completing unverified invoice must return 400");

    // E2: Verify guard order, then process payment successfully
    const verifyGuardOrder = await fetch(`${baseUrl}/api/orders/${guardOrderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        finalBiayaSamsat: 520000,
        finalTotalBiaya: 645000,
      }),
    });
    assert.equal(verifyGuardOrder.status, 200, "Order verification must succeed");

    // Payment must now succeed
    const paySuccessRes = await fetch(`${baseUrl}/api/finance/invoices/${guardInv.id}/pay`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        amount: 645000,
        metodePembayaran: "Transfer",
      }),
    });
    assert.equal(paySuccessRes.status, 200, "Payment must succeed after cost verification");
    const paySuccessJson = (await paySuccessRes.json()) as any;
    assert.equal(paySuccessJson?.data?.status, "PAID");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE F: ORDER CORRECTION & HISTORICAL DATA INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("Module F: Order Correction & Historical Data Integrity", async () => {
    // F1: Create an order and request correction
    const corrOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        customer: "Customer Correction Test",
        nomorHP: "081234567888",
        layanan: "Perpanjangan STNK Tahunan",
        nopol: "B 4004 COR",
        biayaJasa: 100000,
        biayaAntarJemput: 25000,
        biayaSamsat: 500000,
        totalBiaya: 625000,
        costSnapshot: {
          completenessStatus: "COMPLETE",
          hasUnconfiguredTariff: false,
          breakdown: [{ name: "PKB", nominal: 500000, status: "CONFIGURED" }],
        },
      }),
    });
    assert.equal(corrOrderRes.status, 201);
    const corrOrderNo = ((await corrOrderRes.json()) as any)?.data?.orderNo;

    // Request correction with valid category and reason
    const reqCorrRes = await fetch(`${baseUrl}/api/orders/${corrOrderNo}/request-correction`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        category: "DUPLIKAT_INPUT_ADMIN",
        linkedDuplicateOrderNo: "ORD-REAL-001",
        reason: "Salah input data oleh admin baru",
      }),
    });
    assert.equal(reqCorrRes.status, 201, "Correction request must be created");
    const corrJson = (await reqCorrRes.json()) as any;
    const correctionId = corrJson?.data?.id;
    assert.ok(correctionId);

    // Approve correction
    const reviewRes = await fetch(`${baseUrl}/api/order-corrections/${correctionId}/review`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        decision: "approve",
        reviewNotes: "Disetujui pembatalan order duplikat dan pembersihan pembayaran",
      }),
    });
    assert.equal(reviewRes.status, 200, "Correction review approval must succeed");

    // Verify order is now Cancelled
    const afterCorrOrder = dbOrderRepository.getByOrderNo(corrOrderNo);
    assert.equal(afterCorrOrder?.currentStageName, "Dibatalkan");

    // Verify that verify-cost on cancelled order is rejected with 400
    const verifyCancelledRes = await fetch(`${baseUrl}/api/orders/${corrOrderNo}/verify-cost`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({ finalBiayaSamsat: 500000 }),
    });
    assert.equal(verifyCancelledRes.status, 400, "Cancelled order cannot be verified");
    const cancelledErr = (await verifyCancelledRes.json()) as any;
    assert.equal(cancelledErr?.error?.code, "ORDER_CANCELLED");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE G: FAILURE SCENARIOS & SNAPSHOT STABILITY
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("Module G: Failure Scenarios, Edge Cases & Snapshot Stability", async () => {
    // G1: Missing required order fields -> 400 VALIDATION_ERROR
    const invalidOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        customer: "", // Missing customer!
        nomorHP: "081234567890",
        layanan: "Perpanjangan STNK Tahunan",
        nopol: "B 5005 ERR",
      }),
    });
    assert.equal(invalidOrderRes.status, 400, "Missing required fields must return 400");
    const invalidJson = (await invalidOrderRes.json()) as any;
    assert.equal(invalidJson?.error?.code, "VALIDATION_ERROR");

    // G2: Tariff changes after order creation do NOT mutate existing order snapshots
    const stableOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: svpHeaders,
      body: JSON.stringify({
        customer: "Customer Snapshot Stability",
        nomorHP: "081234567877",
        layanan: "Perpanjangan STNK Tahunan",
        nopol: "B 6006 STB",
        biayaJasa: 100000,
        biayaAntarJemput: 25000,
        biayaSamsat: 400000,
        totalBiaya: 525000,
        costSnapshot: {
          completenessStatus: "COMPLETE",
          hasUnconfiguredTariff: false,
          breakdown: [{ name: "PKB Pokok", nominal: 400000, status: "CONFIGURED" }],
        },
      }),
    });
    assert.equal(stableOrderRes.status, 201);
    const stableOrderNo = ((await stableOrderRes.json()) as any)?.data?.orderNo;

    // Mutate tariff in pricing table
    await fetch(`${baseUrl}/api/pricing/samsat-tariffs`, {
      method: "PUT",
      headers: svpHeaders,
      body: JSON.stringify({
        samsatId: "samsat-e2e-alpha",
        tariffs: [{ pricingItemId: "pkb-pokok", nominal: 9999999 }], // Massive price increase
      }),
    });

    // Check existing order: snapshot and costs remain completely unchanged
    const retrievedStable = dbOrderRepository.getByOrderNo(stableOrderNo);
    assert.equal(retrievedStable?.costSnapshot?.breakdown[0]?.nominal, 400000, "Order snapshot must remain strictly immutable when master tariffs change");
    const stableInvoice = dbFinanceRepository.getInvoiceByOrderNo(stableOrderNo);
    assert.equal(stableInvoice?.biayaSamsat, 400000, "Invoice biayaSamsat must remain strictly immutable when master tariffs change");
  });
});
