/**
 * PHASE 3: REPOSITORY & ORDER COST VERIFICATION CONSISTENCY TEST SUITE
 * Admin SUN89 — Biro Jasa Management System
 *
 * Tests A through L:
 * - Test A: Save partial estimate without verification flag -> isCostVerified === false
 * - Test B: Save partial estimate with status variations & manipulation attempts -> remains unverified
 * - Test C: Save complete order -> isCostVerified === true, costCompletenessStatus === 'COMPLETE'
 * - Test D: Explicit zero tariff (ZERO_EXPLICIT vs UNCONFIGURED) -> Rp0 is valid, not marked missing
 * - Test E: Unconfigured tariff produces PARTIAL_ESTIMATE and unverified status
 * - Test F: Error / Failure handling (no silent assumption of Rp0 or COMPLETE)
 * - Test G: Alternative creation / persistence paths maintain consistency
 * - Test H: Normal updates preserve unverified status
 * - Test I: Verified order preservation during updates
 * - Test J: Snapshot immutability check
 * - Test K: Invoice status consistency
 * - Test L: Full regression check (bypass prevention, verification endpoint, finance guard)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../server/src/database/db";
import { dbOrderRepository, evaluateOrderCostCompleteness } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { pricingStore } from "../src/app/data/pricingStore";
import { getHargaDasarItem } from "../src/app/data/pricingReference";
import { ApiError } from "../server/src/middleware/errorHandler";
import { OperationalOrder } from "../src/domain/order/types";

test("PHASE 3: REPOSITORY & ORDER COST VERIFICATION CONSISTENCY TEST SUITE", async (t) => {
  const supervisorUser = {
    userId: "usr-spv-p3",
    nama: "Supervisor Phase3",
    role: "supervisor",
    email: "spv.p3@birojasa.com",
  };

  const samplePartialSnapshot = {
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

  const sampleCompleteSnapshot = {
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

  function buildTestOrder(orderNo: string, isPartial: boolean, overrides: Partial<OperationalOrder> = {}): OperationalOrder {
    const snapshot = isPartial ? samplePartialSnapshot : sampleCompleteSnapshot;
    return {
      orderNo,
      customer: `Customer ${orderNo}`,
      nomorHP: "081234567890",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1234 P3",
      currentStep: 1,
      currentStageName: "Data Masuk",
      biayaJasa: snapshot.biayaJasa,
      biayaAntarJemput: snapshot.biayaAntarJemput,
      biayaSamsat: snapshot.biayaSamsat,
      payment: {
        totalBiaya: snapshot.totalBiaya,
        dibayar: 0,
        kurang: snapshot.totalBiaya,
        statusPembayaran: "Belum Lunas",
        isPaymentVerified: false,
        metodePembayaran: "Transfer Bank",
        invoiceNo: `INV-${orderNo}`,
      },
      costSnapshot: JSON.parse(JSON.stringify(snapshot)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  // TEST A: Save partial estimate without verification flag -> isCostVerified === false
  await t.test("Test A: Save partial estimate without verification flag -> isCostVerified === false", () => {
    const orderNo = `ORD-P3-A-${Date.now()}`;
    const order = buildTestOrder(orderNo, true);
    // Explicitly delete verification flags before saving
    delete (order as any).isCostVerified;
    delete (order as any).costCompletenessStatus;
    delete (order as any).costVerifiedAt;
    delete (order as any).costVerifiedBy;

    dbOrderRepository.saveOrder(order);

    const retrieved = dbOrderRepository.getByOrderNo(orderNo);
    assert.ok(retrieved, "Order must be retrievable from repository");
    assert.equal(retrieved.isCostVerified, false, "isCostVerified must default to false for partial estimate");
    assert.equal(retrieved.costCompletenessStatus, "PARTIAL_ESTIMATE", "costCompletenessStatus must be PARTIAL_ESTIMATE");

    // Verify low-level SQLite row
    const row = db.prepare("SELECT is_cost_verified, cost_completeness_status FROM orders WHERE order_no = ?").get(orderNo) as any;
    assert.equal(row.is_cost_verified, 0, "SQLite column is_cost_verified must be 0");
    assert.equal(row.cost_completeness_status, "PARTIAL_ESTIMATE", "SQLite column cost_completeness_status must be PARTIAL_ESTIMATE");
  });

  // TEST B: Save partial estimate with status variations & manipulation attempts
  await t.test("Test B: Save partial estimate with status variations & manipulation attempts", () => {
    // B1: isCostVerified: false
    const orderNoB1 = `ORD-P3-B1-${Date.now()}`;
    const orderB1 = buildTestOrder(orderNoB1, true, { isCostVerified: false } as any);
    dbOrderRepository.saveOrder(orderB1);
    const retB1 = dbOrderRepository.getByOrderNo(orderNoB1);
    assert.equal(retB1?.isCostVerified, false);
    assert.equal(retB1?.costCompletenessStatus, "PARTIAL_ESTIMATE");

    // B2: Manipulated payload with isCostVerified: true but no official verifier
    const orderNoB2 = `ORD-P3-B2-${Date.now()}`;
    const orderB2 = buildTestOrder(orderNoB2, true, {
      isCostVerified: true,
      costCompletenessStatus: "COMPLETE", // Attempt to spoof COMPLETE status on a partial snapshot
    } as any);
    dbOrderRepository.saveOrder(orderB2);
    const retB2 = dbOrderRepository.getByOrderNo(orderNoB2);
    assert.equal(retB2?.isCostVerified, false, "Spoofed verification must be rejected by evaluateOrderCostCompleteness");
    assert.equal(retB2?.costCompletenessStatus, "PARTIAL_ESTIMATE", "Completeness must remain PARTIAL_ESTIMATE due to unconfigured snapshot");

    // B3: Manipulated payload with costCompletenessStatus: "VERIFIED" but missing costVerifiedBy
    const orderNoB3 = `ORD-P3-B3-${Date.now()}`;
    const orderB3 = buildTestOrder(orderNoB3, true, {
      isCostVerified: true,
      costCompletenessStatus: "VERIFIED",
      // costVerifiedBy is omitted!
    } as any);
    dbOrderRepository.saveOrder(orderB3);
    const retB3 = dbOrderRepository.getByOrderNo(orderNoB3);
    assert.equal(retB3?.isCostVerified, false, "VERIFIED status without costVerifiedBy must be rejected");
    assert.equal(retB3?.costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // TEST C: Save complete order -> isCostVerified === true, costCompletenessStatus === 'COMPLETE'
  await t.test("Test C: Save complete order -> isCostVerified === true, costCompletenessStatus === 'COMPLETE'", () => {
    const orderNo = `ORD-P3-C-${Date.now()}`;
    const order = buildTestOrder(orderNo, false);

    dbOrderRepository.saveOrder(order);

    const retrieved = dbOrderRepository.getByOrderNo(orderNo);
    assert.ok(retrieved, "Complete order must be retrievable");
    assert.equal(retrieved.isCostVerified, true, "isCostVerified must be true for complete order");
    assert.equal(retrieved.costCompletenessStatus, "COMPLETE", "costCompletenessStatus must be COMPLETE");

    // Verify low-level SQLite row
    const row = db.prepare("SELECT is_cost_verified, cost_completeness_status FROM orders WHERE order_no = ?").get(orderNo) as any;
    assert.equal(row.is_cost_verified, 1, "SQLite column is_cost_verified must be 1");
    assert.equal(row.cost_completeness_status, "COMPLETE", "SQLite column cost_completeness_status must be COMPLETE");
  });

  // TEST D: Explicit zero tariff (ZERO_EXPLICIT vs UNCONFIGURED)
  await t.test("Test D: Explicit zero tariff (ZERO_EXPLICIT vs UNCONFIGURED)", () => {
    // 1. Configure an explicit Rp0 tariff directly in pricingStore map
    let priceMap = (pricingStore as any).samsatPricing.get("samsat-jakarta-timur");
    if (!priceMap) {
      priceMap = new Map();
      (pricingStore as any).samsatPricing.set("samsat-jakarta-timur", priceMap);
    }
    priceMap.set("swdkllj-motor", 0);

    const tariffStatus = pricingStore.getSamsatTariffStatus("samsat-jakarta-timur", "swdkllj-motor");
    assert.equal(tariffStatus, "ZERO_EXPLICIT", "Tariff with Rp0 must have status ZERO_EXPLICIT");

    const resolvedPrice = getHargaDasarItem("swdkllj-motor", "JAKARTA TIMUR");
    assert.equal(resolvedPrice, 0, "Explicit Rp0 tariff must be honored and not discarded as missing");

    // 2. Order with configured Rp0 item is treated as complete if no unconfigured items exist
    const orderNo = `ORD-P3-D-${Date.now()}`;
    const zeroSnapshot = {
      completenessStatus: "COMPLETE",
      hasUnconfiguredTariff: false,
      unconfiguredItems: [],
      breakdown: [
        { name: "PKB Pokok", nominal: 500000, status: "CONFIGURED", isConfigured: true },
        { name: "SWDKLLJ", nominal: 0, status: "CONFIGURED", isConfigured: true },
      ],
      biayaJasa: 100000,
      biayaAntarJemput: 25000,
      totalBiaya: 625000,
      biayaSamsat: 500000,
    };
    const order = buildTestOrder(orderNo, false, {
      costSnapshot: zeroSnapshot,
    });

    dbOrderRepository.saveOrder(order);
    const retrieved = dbOrderRepository.getByOrderNo(orderNo);
    assert.equal(retrieved?.isCostVerified, true, "Order with explicit Rp0 items must be verified");
    assert.equal(retrieved?.costCompletenessStatus, "COMPLETE");
  });

  // TEST E: Unconfigured tariff produces PARTIAL_ESTIMATE and unverified status
  await t.test("Test E: Unconfigured tariff produces PARTIAL_ESTIMATE and unverified status", () => {
    const orderNo = `ORD-P3-E-${Date.now()}`;
    const order = buildTestOrder(orderNo, true);

    const evalResult = evaluateOrderCostCompleteness(order);
    assert.equal(evalResult.isPartialEstimate, true);
    assert.equal(evalResult.costCompletenessStatus, "PARTIAL_ESTIMATE");
    assert.equal(evalResult.isCostVerified, false);

    dbOrderRepository.saveOrder(order);
    const retrieved = dbOrderRepository.getByOrderNo(orderNo);
    assert.equal(retrieved?.isCostVerified, false);
    assert.equal(retrieved?.costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // TEST F: Error / Failure handling (no silent assumption of Rp0 or COMPLETE)
  await t.test("Test F: Error / Failure handling (no silent assumption of Rp0 or COMPLETE)", () => {
    // If order has a snapshot with unconfigured breakdown items but omits hasUnconfiguredTariff and completenessStatus
    const ambiguousOrder: any = {
      orderNo: `ORD-P3-F-${Date.now()}`,
      customer: "Ambiguous Order",
      costSnapshot: {
        breakdown: [
          { name: "PKB", nominal: 500000, status: "CONFIGURED" },
          { name: "Biaya Tambahan", nominal: null, status: "UNCONFIGURED" },
        ],
      },
    };

    const evalResult = evaluateOrderCostCompleteness(ambiguousOrder);
    assert.equal(evalResult.isPartialEstimate, true, "Must detect UNCONFIGURED item in breakdown");
    assert.equal(evalResult.costCompletenessStatus, "PARTIAL_ESTIMATE");
    assert.equal(evalResult.isCostVerified, false);
  });

  // TEST G: Alternative creation / persistence paths maintain consistency
  await t.test("Test G: Alternative creation / persistence paths maintain consistency", () => {
    const orderNo = `ORD-P3-G-${Date.now()}`;
    const orderData = {
      orderNo,
      customer: "Alternative Path Customer",
      nomorHP: "081234567890",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 7777 ALT",
      biayaJasa: 100000,
      biayaAntarJemput: 25000,
      biayaSamsat: 500000,
      costSnapshot: samplePartialSnapshot,
      approvedBySpv: true,
      currentStep: 6,
      payment: {
        totalBiaya: 625000,
        dibayar: 0,
        kurang: 625000,
        statusPembayaran: "Belum Lunas",
      },
    };

    // Path 1: orderService.createOrder
    const created = orderService.createOrder(orderData as any, supervisorUser);
    const actualOrderNo = created.orderNo;
    assert.equal(created.isCostVerified, false, "orderService.createOrder must set isCostVerified = false for partial snapshot");
    assert.equal(created.costCompletenessStatus, "PARTIAL_ESTIMATE");

    // Path 2: Secondary update caller (e.g. from financeService or orderCorrectionService)
    // Update payment via direct repository saveOrder (which routes to updateOrder)
    dbOrderRepository.saveOrder({
      ...created,
      payment: {
        ...created.payment,
        dibayar: 200000,
      },
    });

    const afterSave = dbOrderRepository.getByOrderNo(actualOrderNo);
    assert.equal(afterSave?.isCostVerified, false, "Secondary saveOrder must maintain unverified state");
    assert.equal(afterSave?.costCompletenessStatus, "PARTIAL_ESTIMATE");
  });

  // TEST H: Normal updates preserve unverified status
  await t.test("Test H: Normal updates preserve unverified status", () => {
    const orderNo = `ORD-P3-H-${Date.now()}`;
    const order = buildTestOrder(orderNo, true);
    dbOrderRepository.saveOrder(order);

    // Update non-financial data
    dbOrderRepository.updateOrder(orderNo, {
      customer: "Updated Customer Name",
      nopol: "B 8888 UPD",
    });

    const updated = dbOrderRepository.getByOrderNo(orderNo);
    assert.equal(updated?.customer, "Updated Customer Name");
    assert.equal(updated?.nopol, "B 8888 UPD");
    assert.equal(updated?.isCostVerified, false, "Normal update must NOT set isCostVerified to true");
    assert.equal(updated?.costCompletenessStatus, "PARTIAL_ESTIMATE");

    const row = db.prepare("SELECT is_cost_verified, cost_completeness_status FROM orders WHERE order_no = ?").get(orderNo) as any;
    assert.equal(row.is_cost_verified, 0);
    assert.equal(row.cost_completeness_status, "PARTIAL_ESTIMATE");
  });

  // TEST I: Verified order preservation during updates
  await t.test("Test I: Verified order preservation during updates", () => {
    const orderNo = `ORD-P3-I-${Date.now()}`;
    const orderData = {
      orderNo,
      customer: "Customer I",
      nomorHP: "081234567890",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1111 VER",
      biayaJasa: 100000,
      biayaAntarJemput: 25000,
      biayaSamsat: 500000,
      costSnapshot: samplePartialSnapshot,
      approvedBySpv: true,
      currentStep: 6,
      payment: {
        totalBiaya: 625000,
        dibayar: 0,
        kurang: 625000,
        statusPembayaran: "Belum Lunas",
      },
    };

    const created = orderService.createOrder(orderData as any, supervisorUser);
    const actualOrderNo = created.orderNo;

    // Verify order officially via verifyOrderCost
    const verified = orderService.verifyOrderCost(
      actualOrderNo,
      { finalBiayaSamsat: 550000, notes: "Verified by supervisor" },
      supervisorUser
    );
    assert.equal(verified.isCostVerified, true);
    assert.equal(verified.costCompletenessStatus, "VERIFIED");
    assert.equal(verified.costVerifiedBy, "Supervisor Phase3");

    // Perform regular non-financial update
    dbOrderRepository.updateOrder(actualOrderNo, {
      customer: "Customer I Renamed",
    });

    const afterUpdate = dbOrderRepository.getByOrderNo(actualOrderNo);
    assert.equal(afterUpdate?.customer, "Customer I Renamed");
    assert.equal(afterUpdate?.isCostVerified, true, "Verified status must be preserved");
    assert.equal(afterUpdate?.costCompletenessStatus, "VERIFIED");
    assert.equal(afterUpdate?.costVerifiedBy, "Supervisor Phase3");

    const row = db.prepare("SELECT is_cost_verified, cost_completeness_status, cost_verified_by FROM orders WHERE order_no = ?").get(actualOrderNo) as any;
    assert.equal(row.is_cost_verified, 1);
    assert.equal(row.cost_completeness_status, "VERIFIED");
    assert.equal(row.cost_verified_by, "Supervisor Phase3");
  });

  // TEST J: Snapshot immutability check
  await t.test("Test J: Snapshot immutability check", () => {
    const orderNo = `ORD-P3-J-${Date.now()}`;
    const initialSnapshot = JSON.parse(JSON.stringify(samplePartialSnapshot));
    const orderData = {
      orderNo,
      customer: "Customer J",
      nomorHP: "081234567890",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 2222 IMM",
      biayaJasa: 100000,
      biayaAntarJemput: 25000,
      biayaSamsat: 500000,
      costSnapshot: initialSnapshot,
      payment: {
        totalBiaya: 625000,
        dibayar: 0,
        kurang: 625000,
        statusPembayaran: "Belum Lunas",
      },
    };

    const created = orderService.createOrder(orderData as any, supervisorUser);
    const actualOrderNo = created.orderNo;

    // Update non-financial
    dbOrderRepository.updateOrder(actualOrderNo, { customer: "Customer J Updated" });

    // Verify cost officially
    orderService.verifyOrderCost(actualOrderNo, { finalBiayaSamsat: 600000 }, supervisorUser);

    const finalOrder = dbOrderRepository.getByOrderNo(actualOrderNo);
    assert.deepEqual(
      finalOrder?.costSnapshot,
      initialSnapshot,
      "Initial costSnapshot must remain strictly immutable across updates and cost verification"
    );
  });

  // TEST K: Invoice status consistency
  await t.test("Test K: Invoice status consistency", () => {
    const orderNo = `ORD-P3-K-${Date.now()}`;
    const orderData = {
      orderNo,
      customer: "Customer K",
      nomorHP: "081234567890",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 3333 INV",
      biayaJasa: 100000,
      biayaAntarJemput: 25000,
      biayaSamsat: 500000,
      costSnapshot: samplePartialSnapshot,
      approvedBySpv: true,
      currentStep: 6,
      payment: {
        totalBiaya: 625000,
        dibayar: 0,
        kurang: 625000,
        statusPembayaran: "Belum Lunas",
      },
    };

    const created = orderService.createOrder(orderData as any, supervisorUser);
    const actualOrderNo = created.orderNo;

    // Check linked invoice
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(actualOrderNo) as any;
    assert.ok(invoice, "Invoice must exist for order");
    assert.equal(invoice.isDraftEstimate, true, "isDraftEstimate must be true for unverified partial order");
    assert.equal(invoice.costVerificationStatus, "PENDING_VERIFICATION");

    // Verify order cost
    orderService.verifyOrderCost(actualOrderNo, { finalBiayaSamsat: 550000 }, supervisorUser);

    // Check invoice updated
    const verifiedInvoice = dbFinanceRepository.getInvoiceByOrderNo(actualOrderNo) as any;
    assert.equal(verifiedInvoice.isDraftEstimate, false, "isDraftEstimate must be false after verification");
    assert.equal(verifiedInvoice.costVerificationStatus, "VERIFIED");
  });

  // TEST L: Full regression check (bypass prevention, verification endpoint, finance guard)
  await t.test("Test L: Full regression check (bypass prevention, verification endpoint, finance guard)", () => {
    const orderNo = `ORD-P3-L-${Date.now()}`;
    const orderData = {
      orderNo,
      customer: "Customer L",
      nomorHP: "081234567890",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 4444 REG",
      biayaJasa: 100000,
      biayaAntarJemput: 25000,
      biayaSamsat: 500000,
      costSnapshot: samplePartialSnapshot,
      approvedBySpv: true,
      currentStep: 6,
      payment: {
        totalBiaya: 625000,
        dibayar: 0,
        kurang: 625000,
        statusPembayaran: "Belum Lunas",
      },
    };

    const created = orderService.createOrder(orderData as any, supervisorUser);
    const actualOrderNo = created.orderNo;
    // Set supervisi approval so we can isolate and test the cost verification guard exclusively
    dbOrderRepository.updateOrder(actualOrderNo, {
      approvedBySpv: "Supervisor Phase3" as any,
      currentStep: 6,
    });
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(actualOrderNo);
    assert.ok(invoice);

    // L1: Security bypass via updateOrder must fail with PROTECTED_FIELD_VIOLATION
    assert.throws(
      () => {
        orderService.updateOrder(actualOrderNo, {
          isCostVerified: true,
          costCompletenessStatus: "VERIFIED",
        } as any);
      },
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.code, "PROTECTED_FIELD_VIOLATION");
        return true;
      },
      "Must throw PROTECTED_FIELD_VIOLATION on attempt to update isCostVerified via updateOrder"
    );

    // Also test repository-level defense: direct call to dbOrderRepository.updateOrder cannot verify without verifier
    dbOrderRepository.updateOrder(actualOrderNo, {
      customer: "Updated Name",
      isCostVerified: true,
    } as any);

    const checkBypass = dbOrderRepository.getByOrderNo(actualOrderNo);
    assert.equal(checkBypass?.isCostVerified, false, "Bypass through repository updateOrder must be prevented");
    assert.equal(checkBypass?.costCompletenessStatus, "PARTIAL_ESTIMATE");

    // L2: Finance guard prevents final payment on unverified order
    assert.throws(
      () => {
        financeService.recordPayment(
          invoice.id,
          625000,
          { metodePembayaran: "Transfer Bank" },
          supervisorUser
        );
      },
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.code, "COST_VERIFICATION_REQUIRED");
        return true;
      },
      "Must throw COST_VERIFICATION_REQUIRED"
    );

    // L3: Official verification via verifyOrderCost succeeds
    const verified = orderService.verifyOrderCost(
      actualOrderNo,
      { finalBiayaSamsat: 520000, finalTotalBiaya: 645000, notes: "Official verified" },
      supervisorUser
    );
    assert.equal(verified.isCostVerified, true);
    assert.equal(verified.costCompletenessStatus, "VERIFIED");

    // L4: After verification, payment processing succeeds
    const paymentResult = financeService.recordPayment(
      invoice.id,
      645000,
      { metodePembayaran: "Transfer Bank" },
      supervisorUser
    );
    assert.ok(paymentResult, "Payment must succeed after cost verification");
    assert.equal(paymentResult.status, "PAID");
  });
});
