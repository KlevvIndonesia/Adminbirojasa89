/**
 * Phase 4B Batch 2B — Step C: Payment Lifecycle Unification & Atomic Verification Test Suite
 * 
 * Verifies:
 * - AC-C-01: Payment Identity (Mutates same record in-place, zero sibling records)
 * - AC-C-02: Multiple Partial Payments (Independent lifecycles preserved)
 * - AC-C-03: Relational & JSON Consistency (Canonical invoice calculator parity)
 * - AC-C-04: Cash Posting (Single debit in kas_kantor linked via kas_kantor_id)
 * - AC-C-05: Idempotent Retry (Zero duplicate DML, zero duplicate kas entries)
 * - AC-C-06: Legacy Fallback (1 pending -> resolves, 0 -> 400, >1 -> 422)
 * - AC-C-07: Atomic Rollback (Failure injection guarantees zero partial states)
 * - AC-C-08: Concurrency (Serialized verification guarantees single kas debit)
 * - AC-C-09: Existing Historical Records (Rows #1-#7 remain untouched with payment_id = NULL)
 */

import test, { describe, it } from "node:test";
import assert from "node:assert";
import { db, runInTransaction } from "../server/src/database/db";
import { orderService } from "../server/src/services/orderService";
import { financeService, FinanceService } from "../server/src/services/financeService";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { ApiError } from "../server/src/middleware/errorHandler";
import { TokenPayload } from "../server/src/utils/crypto";
import { isValidCanonicalPaymentId } from "../server/src/utils/canonicalHasher";

const testAdmin: TokenPayload = {
  userId: "usr-admin-test",
  nama: "Test Admin Finance",
  role: "administrator",
  jabatan: "ADMIN",
  email: "admin@sun89.local",
};

const testSupervisor: TokenPayload = {
  userId: "usr-spv-test",
  nama: "Test Supervisor",
  role: "supervisor",
  jabatan: "SVP",
  email: "spv@sun89.local",
};

const otherUser: TokenPayload = {
  userId: "usr-other-test",
  nama: "Other User",
  role: "finance",
  jabatan: "FINANCE",
  email: "other@sun89.local",
};

describe("PHASE 4B BATCH 2B — STEP C: PAYMENT LIFECYCLE UNIFICATION SUITE", () => {

  it("AC-C-01: Verification mutates targeted payment in-place without creating sibling records", () => {
    // 1. Create order with downpayment (Path 1)
    const order = orderService.createOrder({
      customer: "PT Sibling Check",
      nomorHP: "081211112222",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 1001 SIB",
      biayaJasa: 300000,
      totalEstimasi: 800000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 800000,
        dibayar: 400000,
        buktiPembayaran: { fileName: "bukti_tf1.jpg", fileType: "image" },
      },
    }, testAdmin);

    const initialRecords = order.payment.paymentRecords || [];
    assert.strictEqual(initialRecords.length, 1, "Order should start with exactly 1 downpayment record");
    const canonicalPaymentId = initialRecords[0].payment_id || initialRecords[0].paymentId || initialRecords[0].id;
    assert.ok(isValidCanonicalPaymentId(canonicalPaymentId), "Initial downpayment must have canonical UUID");

    // Count payments in database before verification
    const paymentsBefore = dbFinanceRepository.getPaymentsByOrderNo(order.orderNo);
    assert.strictEqual(paymentsBefore.length, 0, "No row in invoice_payments prior to verification");

    // 2. Verify payment via unified engine
    const verifiedOrder = orderService.verifyPayment(order.orderNo, testAdmin);
    assert.ok(verifiedOrder.payment.isPaymentVerified, "Payment must be marked verified");

    // 3. Assert in-place mutation: paymentRecords must STILL have length 1 (NO SIBLING RECORD)
    const recordsAfter = verifiedOrder.payment.paymentRecords || [];
    assert.strictEqual(recordsAfter.length, 1, "Must NOT append sibling record; length must remain 1");
    assert.strictEqual(recordsAfter[0].id, canonicalPaymentId, "Record ID must remain identical");
    assert.strictEqual(recordsAfter[0].payment_id, canonicalPaymentId, "Payment UUID must remain identical");
    assert.strictEqual(recordsAfter[0].statusVerifikasi, "TERVERIFIKASI", "Record statusVerifikasi must be TERVERIFIKASI");
    assert.ok(recordsAfter[0].kasKantorId, "Must link to kasKantorId");

    // 4. Assert invoice_payments row created with same UUID
    const paymentsAfter = dbFinanceRepository.getPaymentsByOrderNo(order.orderNo);
    assert.strictEqual(paymentsAfter.length, 1, "Exactly 1 row in invoice_payments");
    assert.strictEqual(paymentsAfter[0].payment_id, canonicalPaymentId, "invoice_payments must store canonical UUID");
    assert.strictEqual(paymentsAfter[0].status_verifikasi, "TERVERIFIKASI", "status_verifikasi must be TERVERIFIKASI");
    assert.strictEqual(paymentsAfter[0].kas_kantor_id, recordsAfter[0].kasKantorId, "kas_kantor_id must match between JSON and relational row");
  });

  it("AC-C-02: Multiple partial payments on one invoice remain distinct records", () => {
    // 1. Create order
    const order = orderService.createOrder({
      customer: "PT Multi Partial",
      nomorHP: "081233334444",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 2002 MUL",
      biayaJasa: 500000,
      totalEstimasi: 1500000,
      isVerified: true,
      approvedBySpv: true,
      currentStep: 7,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1500000,
        dibayar: 0,
      },
    }, testAdmin);

    const inv = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
    assert.ok(inv);

    // 2. Submit partial payment 1 (Path 2: Rp 500.000)
    financeService.recordPayment(inv.id, 500000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      buktiBayar: { fileName: "bukti_partial_1.jpg", fileType: "image", fileUrl: "/uploads/bukti_partial_1.jpg" },
      catatan: "Cicilan 1",
    }, testAdmin);

    // 3. Submit partial payment 2 (Path 2: Rp 600.000)
    financeService.recordPayment(inv.id, 600000, {
      metodePembayaran: "Transfer Bank",
      bank: "Mandiri",
      buktiBayar: { fileName: "bukti_partial_2.jpg", fileType: "image", fileUrl: "/uploads/bukti_partial_2.jpg" },
      catatan: "Cicilan 2",
    }, testAdmin);

    const paymentsAfterSubmission = dbFinanceRepository.getPaymentsByOrderNo(order.orderNo);
    assert.strictEqual(paymentsAfterSubmission.length, 2, "Must have exactly 2 pending payments");
    const pay1 = paymentsAfterSubmission[1]; // older
    const pay2 = paymentsAfterSubmission[0]; // newer

    // 4. Verify ONLY Partial Payment 1 explicitly by paymentId
    const resVerify1 = financeService.verifyPayment({
      invoiceId: inv.id,
      paymentId: pay1.payment_id,
      confirmedAmount: 500000,
      verifierName: "Admin Test",
      user: testAdmin,
    });

    assert.ok(resVerify1);

    // 5. Assert: Payment 1 is TERVERIFIKASI, Payment 2 remains MENUNGGU_VERIFIKASI
    const row1After = dbFinanceRepository.getInvoicePaymentById(pay1.payment_id);
    const row2After = dbFinanceRepository.getInvoicePaymentById(pay2.payment_id);

    assert.strictEqual(row1After.status_verifikasi, "TERVERIFIKASI", "Payment 1 must be TERVERIFIKASI");
    assert.ok(row1After.kas_kantor_id, "Payment 1 must have kas_kantor_id");
    assert.strictEqual(row2After.status_verifikasi, "MENUNGGU_VERIFIKASI", "Payment 2 must REMAIN pending");
    assert.strictEqual(row2After.kas_kantor_id, null, "Payment 2 must NOT have kas_kantor_id");

    // Assert invoice amounts: only Payment 1 recognized
    const invAfter1 = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(invAfter1.dibayar, 500000, "Only verified payment counted in dibayar");
    assert.strictEqual(invAfter1.sisa, 1000000, "Sisa must be 1,000,000");
    assert.strictEqual(invAfter1.status, "PARTIAL", "Invoice status must be PARTIAL");

    // 6. Now verify Payment 2
    financeService.verifyPayment({
      invoiceId: inv.id,
      paymentId: pay2.payment_id,
      confirmedAmount: 600000,
      verifierName: "Admin Test",
      user: testAdmin,
    });

    const row2Final = dbFinanceRepository.getInvoicePaymentById(pay2.payment_id);
    assert.strictEqual(row2Final.status_verifikasi, "TERVERIFIKASI");
    assert.ok(row2Final.kas_kantor_id);
    assert.notStrictEqual(row1After.kas_kantor_id, row2Final.kas_kantor_id, "Distinct payments must have distinct kas_kantor entries");

    const invFinal = dbFinanceRepository.getInvoiceById(inv.id)!;
    assert.strictEqual(invFinal.dibayar, 1100000, "Total dibayar must be 1,100,000");
    assert.strictEqual(invFinal.sisa, 400000, "Sisa must be 400,000");
  });

  it("AC-C-03: Relational and JSON Consistency with Canonical Calculator Parity", () => {
    const order = orderService.createOrder({
      customer: "PT Parity Co",
      nomorHP: "081255556666",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 3003 PAR",
      biayaJasa: 400000,
      totalEstimasi: 1000000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1000000,
        dibayar: 1000000,
        buktiPembayaran: { fileName: "full_pay.jpg", fileType: "image" },
      },
    }, testAdmin);

    const verified = orderService.verifyPayment(order.orderNo, testAdmin);
    const inv = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
    const dbPayments = dbFinanceRepository.getPaymentsByOrderNo(order.orderNo);
    const jsonRecord = verified.payment.paymentRecords![0];

    // Status parity
    assert.strictEqual(verified.payment.statusPembayaran, "Lunas");
    assert.strictEqual(inv.status, "PAID");
    assert.strictEqual(inv.settlementCondition, "BALANCED");
    assert.strictEqual(inv.dibayar, 1000000);
    assert.strictEqual(inv.sisa, 0);
    assert.strictEqual(inv.overpayment, 0);

    // ID parity
    assert.strictEqual(jsonRecord.payment_id, dbPayments[0].payment_id);
    assert.strictEqual(jsonRecord.nominal, dbPayments[0].nominal);
    assert.strictEqual(jsonRecord.kasKantorId, dbPayments[0].kas_kantor_id);
    assert.strictEqual(jsonRecord.statusVerifikasi, dbPayments[0].status_verifikasi);
  });

  it("AC-C-04: Cash Posting produces exactly one Debit in kas_kantor linked via kas_kantor_id", () => {
    const kasCountBefore = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
    const kasBalanceBefore = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as bal FROM kas_kantor").get() as any;

    const order = orderService.createOrder({
      customer: "PT Kas Posting",
      nomorHP: "081277778888",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 4004 KAS",
      biayaJasa: 250000,
      totalEstimasi: 750000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 750000,
        dibayar: 750000,
        buktiPembayaran: { fileName: "kas_tf.jpg", fileType: "image" },
      },
    }, testAdmin);

    orderService.verifyPayment(order.orderNo, testAdmin);

    const kasCountAfter = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
    const kasBalanceAfter = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as bal FROM kas_kantor").get() as any;

    // Exactly 1 new row in kas_kantor
    assert.strictEqual(kasCountAfter.c, kasCountBefore.c + 1, "Exactly 1 debit entry created in kas_kantor");
    // Running balance incremented by exact payment amount
    assert.strictEqual(Number(kasBalanceAfter.bal), Number(kasBalanceBefore.bal) + 750000, "Kas balance increased by exact amount");

    // Relational link check
    const inv = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
    const payment = dbFinanceRepository.getPaymentsByOrderNo(order.orderNo)[0];
    const kasEntry = dbFinanceRepository.getKasKantorById(payment.kas_kantor_id)!;

    assert.ok(kasEntry, "Linked kas_kantor row must exist");
    assert.strictEqual(kasEntry.status, "Debit", "Status must be Debit");
    assert.strictEqual(kasEntry.debit, 750000, "Debit amount must equal payment nominal");
    assert.strictEqual(kasEntry.kredit, 0, "Kredit amount must be 0");
    assert.strictEqual(kasEntry.orderNo, order.orderNo, "Order No must be stored in kas entry");
    assert.strictEqual(kasEntry.invoiceNo, inv.invoiceNo, "Invoice No must be stored in kas entry");
  });

  it("AC-C-05: Idempotent Retry guarantees ZERO duplicate kas entries and zero duplicate DML", () => {
    const order = orderService.createOrder({
      customer: "PT Idempotent Retry",
      nomorHP: "081299990000",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 5005 IDE",
      biayaJasa: 350000,
      totalEstimasi: 900000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 900000,
        dibayar: 900000,
        buktiPembayaran: { fileName: "idem_tf.jpg", fileType: "image" },
      },
    }, testAdmin);

    const inv = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
    const clientKey = `client-req-${Date.now()}`;

    // 1. First verification with idempotency key
    const res1 = financeService.verifyPayment({
      orderNo: order.orderNo,
      user: testAdmin,
      idempotencyKey: clientKey,
    });

    const kasCountAfterFirst = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
    const paymentsCountAfterFirst = db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE order_no = ?").get(order.orderNo) as any;

    // 2. Second verification with IDENTICAL idempotency key and parameters
    const res2 = financeService.verifyPayment({
      orderNo: order.orderNo,
      user: testAdmin,
      idempotencyKey: clientKey,
    });

    const kasCountAfterSecond = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
    const paymentsCountAfterSecond = db.prepare("SELECT COUNT(*) as c FROM invoice_payments WHERE order_no = ?").get(order.orderNo) as any;

    assert.strictEqual(res2.isReplay, true, "Must flag as replay");
    assert.strictEqual(kasCountAfterSecond.c, kasCountAfterFirst.c, "ZERO additional kas entries on identical retry");
    assert.strictEqual(paymentsCountAfterSecond.c, paymentsCountAfterFirst.c, "ZERO additional payment rows on identical retry");

    // 3. Third call: Same key with DIFFERENT parameters -> must reject with 409 [IDEMPOTENCY_CONFLICT]
    assert.throws(
      () => {
        financeService.verifyPayment({
          orderNo: order.orderNo,
          user: testAdmin,
          confirmedAmount: 500000, // Conflict: was 900,000
          idempotencyKey: clientKey,
        });
      },
      (err: any) => err instanceof ApiError && err.statusCode === 409 && err.code === "IDEMPOTENCY_CONFLICT"
    );

    // 4. Fourth call: Same key from DIFFERENT user -> must reject with 403 [IDEMPOTENCY_USER_MISMATCH]
    assert.throws(
      () => {
        financeService.verifyPayment({
          orderNo: order.orderNo,
          user: otherUser, // Cross-user reuse
          idempotencyKey: clientKey,
        });
      },
      (err: any) => err instanceof ApiError && err.statusCode === 403 && err.code === "IDEMPOTENCY_USER_MISMATCH"
    );

    // 5. Fifth call: Re-verifying an already verified payment without valid idempotency record must NOT succeed (AC-C-06)
    assert.throws(
      () => {
        orderService.verifyPayment(order.orderNo, testAdmin);
      },
      (err: any) => err instanceof ApiError && err.statusCode === 400 && err.code === "NO_PENDING_PAYMENT"
    );
    const kasCountAfterThird = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
    assert.strictEqual(kasCountAfterThird.c, kasCountAfterFirst.c, "Direct re-verification of verified payment does NOT add kas entry");
  });

  it("AC-C-06: Legacy Fallback handles 1 pending (resolves), 0 pending (400), and >1 pending (422)", () => {
    // --- Sub-scenario A.1: 0 pending payments without idempotency key -> 400 NO_PENDING_PAYMENT ---
    const orderZeroPending = orderService.createOrder({
      customer: "PT Zero Pending",
      nomorHP: "081200001111",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 6006 ZER",
      biayaJasa: 200000,
      totalEstimasi: 500000,
      payment: {
        tipePembayaran: "Bayar di Akhir",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 500000,
        dibayar: 0,
      },
    }, testAdmin);

    assert.throws(
      () => {
        financeService.verifyPayment({
          orderNo: orderZeroPending.orderNo,
          user: testAdmin,
          // No paymentId provided and no pending payment exists
        });
      },
      (err: any) => err instanceof ApiError && err.statusCode === 400 && err.code === "NO_PENDING_PAYMENT"
    );

    // --- Sub-scenario A.2: 0 pending payments with unknown/invalid idempotency key -> 400 NO_PENDING_PAYMENT ---
    assert.throws(
      () => {
        financeService.verifyPayment({
          orderNo: orderZeroPending.orderNo,
          user: testAdmin,
          idempotencyKey: "unknown-key-never-registered",
        });
      },
      (err: any) => err instanceof ApiError && err.statusCode === 400 && err.code === "NO_PENDING_PAYMENT"
    );

    // --- Sub-scenario B: Exactly 1 pending payment -> Resolves cleanly ---
    const orderOnePending = orderService.createOrder({
      customer: "PT One Pending",
      nomorHP: "081200002222",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 6006 ONE",
      biayaJasa: 200000,
      totalEstimasi: 500000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 500000,
        dibayar: 500000,
        buktiPembayaran: { fileName: "single_pending.jpg", fileType: "image" },
      },
    }, testAdmin);

    const validCommitKey = `commit-key-one-${Date.now()}`;
    const resOne = financeService.verifyPayment({
      orderNo: orderOnePending.orderNo,
      user: testAdmin,
      idempotencyKey: validCommitKey,
    });
    assert.ok(resOne.payment, "Must successfully resolve single pending payment");
    assert.strictEqual(resOne.payment.status_verifikasi, "TERVERIFIKASI");

    // --- Sub-scenario B.2: Zero pending payments with VALID matching committed key -> Returns cached replay ---
    const resReplay = financeService.verifyPayment({
      orderNo: orderOnePending.orderNo,
      user: testAdmin,
      idempotencyKey: validCommitKey,
    });
    assert.strictEqual(resReplay.isReplay, true, "Valid matching key returns cached replay even with 0 pending");
    assert.strictEqual(resReplay.payment.id, resOne.payment.id);

    // --- Sub-scenario B.3: Zero pending payments on verified order WITHOUT key -> 400 NO_PENDING_PAYMENT ---
    assert.throws(
      () => {
        financeService.verifyPayment({
          orderNo: orderOnePending.orderNo,
          user: testAdmin,
          // No idempotency key provided
        });
      },
      (err: any) => err instanceof ApiError && err.statusCode === 400 && err.code === "NO_PENDING_PAYMENT"
    );

    // --- Sub-scenario B.4: Re-verifying verified paymentId directly WITHOUT valid key -> 400 PAYMENT_ALREADY_VERIFIED ---
    assert.throws(
      () => {
        financeService.verifyPayment({
          orderNo: orderOnePending.orderNo,
          paymentId: resOne.payment.payment_id,
          user: testAdmin,
        });
      },
      (err: any) => err instanceof ApiError && err.statusCode === 400 && err.code === "PAYMENT_ALREADY_VERIFIED"
    );

    // --- Sub-scenario C: >1 pending payments without paymentId -> 422 AMBIGUOUS_PAYMENT_TARGET ---
    const orderMultiPending = orderService.createOrder({
      customer: "PT Multi Pending",
      nomorHP: "081200003333",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 6006 MUL",
      biayaJasa: 300000,
      totalEstimasi: 1000000,
      isVerified: true,
      approvedBySpv: true,
      currentStep: 7,
      payment: {
        tipePembayaran: "Bayar di Akhir",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1000000,
        dibayar: 0,
      },
    }, testAdmin);

    const invMulti = dbFinanceRepository.getInvoiceByOrderNo(orderMultiPending.orderNo)!;
    // Record 2 pending payments
    financeService.recordPayment(invMulti.id, 300000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      buktiBayar: { fileName: "p1.jpg", fileType: "image" },
    }, testAdmin);
    financeService.recordPayment(invMulti.id, 400000, {
      metodePembayaran: "Transfer Bank",
      bank: "Mandiri",
      buktiBayar: { fileName: "p2.jpg", fileType: "image" },
    }, testAdmin);

    // Calling verify without paymentId must fail closed with 422
    assert.throws(
      () => {
        financeService.verifyPayment({
          orderNo: orderMultiPending.orderNo,
          user: testAdmin,
        });
      },
      (err: any) => err instanceof ApiError && err.statusCode === 422 && err.code === "AMBIGUOUS_PAYMENT_TARGET"
    );
  });

  function createControlledFailureService(point: 1 | 2 | 3 | 4 | 5 | 6 | 7, state: { invoked: boolean }) {
    const financeRepoDouble = Object.create(dbFinanceRepository);
    const orderRepoDouble = Object.create(dbOrderRepository);
    const auditRepoDouble = Object.create(dbAuditRepository);

    if (point === 1) {
      financeRepoDouble.updateInvoicePayment = function (id: number, data: any) {
        const res = dbFinanceRepository.updateInvoicePayment(id, data);
        if (data.status_verifikasi === "TERVERIFIKASI") {
          state.invoked = true;
          throw new Error("TEST_INJECTED_FAILURE_POINT_1");
        }
        return res;
      };
    } else if (point === 4) {
      financeRepoDouble.addKasKantor = function (data: any) {
        const res = dbFinanceRepository.addKasKantor(data);
        state.invoked = true;
        throw new Error("TEST_INJECTED_FAILURE_POINT_4");
      };
    } else if (point === 5) {
      financeRepoDouble.updateInvoicePayment = function (id: number, data: any) {
        const res = dbFinanceRepository.updateInvoicePayment(id, data);
        if (data.kas_kantor_id !== undefined) {
          state.invoked = true;
          throw new Error("TEST_INJECTED_FAILURE_POINT_5");
        }
        return res;
      };
    } else if (point === 3) {
      financeRepoDouble.updateInvoice = function (id: number, data: any) {
        const res = dbFinanceRepository.updateInvoice(id, data);
        state.invoked = true;
        throw new Error("TEST_INJECTED_FAILURE_POINT_3");
      };
    } else if (point === 2) {
      orderRepoDouble.updateOrder = function (orderNo: string, data: any) {
        const res = dbOrderRepository.updateOrder(orderNo, data);
        state.invoked = true;
        throw new Error("TEST_INJECTED_FAILURE_POINT_2");
      };
    } else if (point === 6) {
      financeRepoDouble.saveIdempotencyRecord = function (record: any) {
        state.invoked = true;
        // Inject failure during actual persistence operation
        throw new Error("TEST_INJECTED_FAILURE_POINT_6_INSIDE_IDEMPOTENCY");
      };
    } else if (point === 7) {
      auditRepoDouble.save = function (entry: any) {
        state.invoked = true;
        // Inject failure during actual audit persistence operation
        throw new Error("TEST_INJECTED_FAILURE_POINT_7_INSIDE_AUDIT");
      };
    }

    return new FinanceService({
      financeRepo: financeRepoDouble,
      orderRepo: orderRepoDouble,
      auditRepo: auditRepoDouble,
    });
  }

  it("AC-C-07: Complete Atomic Rollback Verification across all 7 transaction failure points via repository test doubles", () => {
    const points: Array<{ point: 1 | 2 | 3 | 4 | 5 | 6 | 7; desc: string; expectedErr: string }> = [
      { point: 1, desc: "After updating invoice_payments", expectedErr: "TEST_INJECTED_FAILURE_POINT_1" },
      { point: 4, desc: "After inserting kas_kantor debit entry", expectedErr: "TEST_INJECTED_FAILURE_POINT_4" },
      { point: 5, desc: "After linking kas_kantor_id to payment", expectedErr: "TEST_INJECTED_FAILURE_POINT_5" },
      { point: 3, desc: "After updating finance_invoices", expectedErr: "TEST_INJECTED_FAILURE_POINT_3" },
      { point: 2, desc: "After updating orders.data_json", expectedErr: "TEST_INJECTED_FAILURE_POINT_2" },
      { point: 6, desc: "Inside idempotency persistence", expectedErr: "TEST_INJECTED_FAILURE_POINT_6_INSIDE_IDEMPOTENCY" },
      { point: 7, desc: "Inside audit logging", expectedErr: "TEST_INJECTED_FAILURE_POINT_7_INSIDE_AUDIT" },
    ];

    for (const { point, desc, expectedErr } of points) {
      const order = orderService.createOrder({
        customer: `PT Atomic Point ${point}`,
        nomorHP: `08128888000${point}`,
        layanan: "Perpanjangan 1 Tahun",
        nopol: `B 700${point} ATO`,
        biayaJasa: 300000,
        totalEstimasi: 800000,
        isVerified: true,
        approvedBySpv: true,
        currentStep: 7,
        payment: {
          tipePembayaran: "Bayar di Akhir",
          metodePembayaran: "Transfer Bank",
          totalBiaya: 800000,
          dibayar: 0,
        },
      }, testAdmin);

      const inv = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
      financeService.recordPayment(inv.id, 400000, {
        metodePembayaran: "Transfer Bank",
        bank: "BCA",
        buktiBayar: { fileName: `atomic_proof_${point}.jpg`, fileType: "image", fileUrl: `/uploads/atomic_${point}.jpg` },
      }, testAdmin);

      const targetPaymentBefore = dbFinanceRepository.getPaymentsByOrderNo(order.orderNo)[0];
      const invBefore = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
      const kasCountBefore = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
      const kasBalBefore = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as bal FROM kas_kantor").get() as any;
      const idempCountBefore = db.prepare("SELECT COUNT(*) as c FROM idempotency_keys").get() as any;
      const auditCountBefore = db.prepare("SELECT COUNT(*) as c FROM security_audit_logs").get() as any;

      const testKey = `tx-fail-key-${point}-${Date.now()}`;
      const state = { invoked: false };
      const testService = createControlledFailureService(point, state);

      // Invoke through the ACTUAL service path using repository test double
      assert.throws(
        () => {
          testService.verifyPayment({
            orderNo: order.orderNo,
            paymentId: targetPaymentBefore.payment_id,
            user: testAdmin,
            idempotencyKey: testKey,
          });
        },
        (err: any) => err.message === expectedErr
      );

      assert.strictEqual(state.invoked, true, `[Point ${point}: ${desc}] Injected failure point must be invoked`);

      // Verify exact 100% pre-transaction state across all tables:
      // 1. invoice_payments must remain untouched
      const targetPaymentAfter = dbFinanceRepository.getInvoicePaymentById(targetPaymentBefore.id);
      assert.strictEqual(targetPaymentAfter.status_verifikasi, targetPaymentBefore.status_verifikasi, `[Point ${point}: ${desc}] Payment status must remain pre-transaction state`);
      assert.strictEqual(targetPaymentAfter.kas_kantor_id, targetPaymentBefore.kas_kantor_id, `[Point ${point}: ${desc}] kas_kantor_id must remain pre-transaction state`);
      assert.strictEqual(targetPaymentAfter.verified_by, targetPaymentBefore.verified_by, `[Point ${point}: ${desc}] verified_by must remain pre-transaction state`);

      // 2. orders.data_json must remain untouched
      const orderAfter = dbOrderRepository.getByOrderNo(order.orderNo)!;
      assert.strictEqual(orderAfter.payment.isPaymentVerified, false, `[Point ${point}: ${desc}] isPaymentVerified must remain false`);
      assert.strictEqual(orderAfter.payment.paymentRecords![0].statusVerifikasi, "MENUNGGU_VERIFIKASI", `[Point ${point}: ${desc}] paymentRecords[0] must remain MENUNGGU_VERIFIKASI`);

      // 3. finance_invoices must remain untouched
      const invAfter = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
      assert.strictEqual(invAfter.dibayar, invBefore.dibayar, `[Point ${point}: ${desc}] Invoice dibayar must remain unchanged (0)`);
      assert.strictEqual(invAfter.sisa, invBefore.sisa, `[Point ${point}: ${desc}] Invoice sisa must remain unchanged`);
      assert.strictEqual(invAfter.status, invBefore.status, `[Point ${point}: ${desc}] Invoice status must remain UNPAID`);

      // 4. kas_kantor must have zero partial debit entry and unchanged running balance
      const kasCountAfter = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
      const kasBalAfter = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) as bal FROM kas_kantor").get() as any;
      assert.strictEqual(kasCountAfter.c, kasCountBefore.c, `[Point ${point}: ${desc}] kas_kantor count must be completely unchanged`);
      assert.strictEqual(kasBalAfter.bal, kasBalBefore.bal, `[Point ${point}: ${desc}] kas_kantor balance must be completely unchanged`);

      // 5. idempotency_keys must have zero committed record for this key
      const idempCountAfter = db.prepare("SELECT COUNT(*) as c FROM idempotency_keys").get() as any;
      assert.strictEqual(idempCountAfter.c, idempCountBefore.c, `[Point ${point}: ${desc}] No idempotency key must be committed on failure`);

      // 6. security_audit_logs must have zero partial event
      const auditCountAfter = db.prepare("SELECT COUNT(*) as c FROM security_audit_logs").get() as any;
      assert.strictEqual(auditCountAfter.c, auditCountBefore.c, `[Point ${point}: ${desc}] No audit log must be committed on failure`);

      // 7. Verify SQLite connection handle is alive, unpoisoned, and healthy
      const liveness = db.prepare("SELECT 1 as alive").get() as any;
      assert.strictEqual(liveness.alive, 1, `[Point ${point}: ${desc}] Database connection must remain fully usable after rollback`);

      // 8. Prove that calling verifyPayment on production service WITHOUT failure injection now succeeds cleanly
      const cleanResult = financeService.verifyPayment({
        orderNo: order.orderNo,
        paymentId: targetPaymentBefore.payment_id,
        user: testAdmin,
      });
      assert.ok(cleanResult.payment, `[Point ${point}: ${desc}] Clean retry must succeed`);
      assert.strictEqual(cleanResult.payment.status_verifikasi, "TERVERIFIKASI");
      assert.ok(cleanResult.payment.kas_kantor_id);
    }
  });

  it("AC-C-07B: Failure Inside Persistence Operations (Point 6 Idempotency & Point 7 Audit)", () => {
    // --- Subtest 1: Point 6 — Idempotency Persistence Failure Inside saveIdempotencyRecord ---
    {
      const order = orderService.createOrder({
        customer: "PT Idempotency Persistence Fail",
        nomorHP: "081288880060",
        layanan: "Perpanjangan 1 Tahun",
        nopol: "B 6060 ATO",
        biayaJasa: 300000,
        totalEstimasi: 800000,
        isVerified: true,
        approvedBySpv: true,
        currentStep: 7,
        payment: {
          tipePembayaran: "Bayar di Akhir",
          metodePembayaran: "Transfer Bank",
          totalBiaya: 800000,
          dibayar: 0,
        },
      }, testAdmin);

      const inv = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
      financeService.recordPayment(inv.id, 400000, {
        metodePembayaran: "Transfer Bank",
        bank: "BCA",
        buktiBayar: { fileName: "proof_idemp_fail.jpg", fileType: "image", fileUrl: "/uploads/proof_idemp_fail.jpg" },
      }, testAdmin);

      const targetPaymentBefore = dbFinanceRepository.getPaymentsByOrderNo(order.orderNo)[0];
      const invBefore = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
      const kasCountBefore = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
      const idempCountBefore = db.prepare("SELECT COUNT(*) as c FROM idempotency_keys").get() as any;
      const auditCountBefore = db.prepare("SELECT COUNT(*) as c FROM security_audit_logs").get() as any;

      let persistenceMethodInvoked = false;
      const failingFinanceRepo = Object.create(dbFinanceRepository);
      failingFinanceRepo.saveIdempotencyRecord = function (record: any) {
        persistenceMethodInvoked = true;
        // Inject failure during database persistence operation
        throw new Error("SQLITE_CONSTRAINT: Simulated failure inside saveIdempotencyRecord");
      };

      const failingService = new FinanceService({ financeRepo: failingFinanceRepo });
      const testKey = `tx-fail-idemp-${Date.now()}`;

      assert.throws(
        () => {
          failingService.verifyPayment({
            orderNo: order.orderNo,
            paymentId: targetPaymentBefore.payment_id,
            user: testAdmin,
            idempotencyKey: testKey,
          });
        },
        /SQLITE_CONSTRAINT: Simulated failure inside saveIdempotencyRecord/
      );

      // Demonstrate method was invoked
      assert.strictEqual(persistenceMethodInvoked, true, "saveIdempotencyRecord must be invoked before failure");

      // Verify all preceding payment, order, invoice, and cash mutations roll back:
      const targetPaymentAfter = dbFinanceRepository.getInvoicePaymentById(targetPaymentBefore.id);
      assert.strictEqual(targetPaymentAfter.status_verifikasi, "MENUNGGU_VERIFIKASI", "Payment status must roll back to MENUNGGU_VERIFIKASI");
      assert.strictEqual(targetPaymentAfter.kas_kantor_id, null, "kas_kantor_id must roll back to null");

      const orderAfter = dbOrderRepository.getByOrderNo(order.orderNo)!;
      assert.strictEqual(orderAfter.payment.isPaymentVerified, false, "Order isPaymentVerified must roll back to false");

      const invAfter = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
      assert.strictEqual(invAfter.dibayar, invBefore.dibayar, "Invoice dibayar must roll back to pre-tx");
      assert.strictEqual(invAfter.status, invBefore.status, "Invoice status must roll back to pre-tx");

      const kasCountAfter = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
      assert.strictEqual(kasCountAfter.c, kasCountBefore.c, "kas_kantor count must remain unchanged");

      // No idempotency record remains committed
      const idempCountAfter = db.prepare("SELECT COUNT(*) as c FROM idempotency_keys").get() as any;
      assert.strictEqual(idempCountAfter.c, idempCountBefore.c, "No idempotency key committed");

      // No audit record remains committed
      const auditCountAfter = db.prepare("SELECT COUNT(*) as c FROM security_audit_logs").get() as any;
      assert.strictEqual(auditCountAfter.c, auditCountBefore.c, "No audit log committed");

      // SQLite connection remains usable
      const liveness = db.prepare("SELECT 1 as alive").get() as any;
      assert.strictEqual(liveness.alive, 1, "Connection must remain usable after rollback");

      // Subsequent legitimate retry succeeds without duplicate cash entries
      const retryResult = financeService.verifyPayment({
        orderNo: order.orderNo,
        paymentId: targetPaymentBefore.payment_id,
        user: testAdmin,
        idempotencyKey: testKey,
      });
      assert.strictEqual(retryResult.payment.status_verifikasi, "TERVERIFIKASI");
      const kasCountFinal = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
      assert.strictEqual(kasCountFinal.c, kasCountBefore.c + 1, "Exactly one cash debit entry posted on retry");
    }

    // --- Subtest 2: Point 7 — Audit Persistence Failure Inside dbAuditRepository.save ---
    {
      const order = orderService.createOrder({
        customer: "PT Audit Persistence Fail",
        nomorHP: "081288880070",
        layanan: "Perpanjangan 1 Tahun",
        nopol: "B 7070 ATO",
        biayaJasa: 300000,
        totalEstimasi: 800000,
        isVerified: true,
        approvedBySpv: true,
        currentStep: 7,
        payment: {
          tipePembayaran: "Bayar di Akhir",
          metodePembayaran: "Transfer Bank",
          totalBiaya: 800000,
          dibayar: 0,
        },
      }, testAdmin);

      const inv = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
      financeService.recordPayment(inv.id, 400000, {
        metodePembayaran: "Transfer Bank",
        bank: "BCA",
        buktiBayar: { fileName: "proof_audit_fail.jpg", fileType: "image", fileUrl: "/uploads/proof_audit_fail.jpg" },
      }, testAdmin);

      const targetPaymentBefore = dbFinanceRepository.getPaymentsByOrderNo(order.orderNo)[0];
      const invBefore = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
      const kasCountBefore = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
      const idempCountBefore = db.prepare("SELECT COUNT(*) as c FROM idempotency_keys").get() as any;
      const auditCountBefore = db.prepare("SELECT COUNT(*) as c FROM security_audit_logs").get() as any;

      let auditMethodInvoked = false;
      const failingAuditRepo = Object.create(dbAuditRepository);
      failingAuditRepo.save = function (entry: any) {
        auditMethodInvoked = true;
        // Inject failure during database persistence operation
        throw new Error("SQLITE_IOERR: Simulated failure inside dbAuditRepository.save");
      };

      // financeRepo is the real one, so saveIdempotencyRecord DOES execute inside the transaction!
      const failingService = new FinanceService({ auditRepo: failingAuditRepo });
      const testKey = `tx-fail-audit-${Date.now()}`;

      assert.throws(
        () => {
          failingService.verifyPayment({
            orderNo: order.orderNo,
            paymentId: targetPaymentBefore.payment_id,
            user: testAdmin,
            idempotencyKey: testKey,
          });
        },
        /SQLITE_IOERR: Simulated failure inside dbAuditRepository.save/
      );

      // Demonstrate audit method was invoked
      assert.strictEqual(auditMethodInvoked, true, "dbAuditRepository.save must be invoked before failure");

      // The already-inserted idempotency record is rolled back
      const idempCountAfter = db.prepare("SELECT COUNT(*) as c FROM idempotency_keys").get() as any;
      assert.strictEqual(idempCountAfter.c, idempCountBefore.c, "Already-inserted idempotency record must roll back cleanly");

      // All payment, order, invoice, and cash mutations roll back
      const targetPaymentAfter = dbFinanceRepository.getInvoicePaymentById(targetPaymentBefore.id);
      assert.strictEqual(targetPaymentAfter.status_verifikasi, "MENUNGGU_VERIFIKASI", "Payment status must roll back to MENUNGGU_VERIFIKASI");
      assert.strictEqual(targetPaymentAfter.kas_kantor_id, null, "kas_kantor_id must roll back to null");

      const orderAfter = dbOrderRepository.getByOrderNo(order.orderNo)!;
      assert.strictEqual(orderAfter.payment.isPaymentVerified, false, "Order isPaymentVerified must roll back to false");

      const invAfter = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;
      assert.strictEqual(invAfter.dibayar, invBefore.dibayar, "Invoice dibayar must roll back to pre-tx");
      assert.strictEqual(invAfter.status, invBefore.status, "Invoice status must roll back to pre-tx");

      const kasCountAfter = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
      assert.strictEqual(kasCountAfter.c, kasCountBefore.c, "kas_kantor count must remain unchanged");

      // No audit record remains committed
      const auditCountAfter = db.prepare("SELECT COUNT(*) as c FROM security_audit_logs").get() as any;
      assert.strictEqual(auditCountAfter.c, auditCountBefore.c, "No audit log committed");

      // SQLite connection remains usable
      const liveness = db.prepare("SELECT 1 as alive").get() as any;
      assert.strictEqual(liveness.alive, 1, "Connection must remain usable after rollback");

      // Subsequent legitimate retry succeeds without duplicate cash entries
      const retryResult = financeService.verifyPayment({
        orderNo: order.orderNo,
        paymentId: targetPaymentBefore.payment_id,
        user: testAdmin,
        idempotencyKey: testKey,
      });
      assert.strictEqual(retryResult.payment.status_verifikasi, "TERVERIFIKASI");
      const kasCountFinal = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
      assert.strictEqual(kasCountFinal.c, kasCountBefore.c + 1, "Exactly one cash debit entry posted on retry");
    }
  });

  it("AC-C-08: Concurrency serialization guarantees single cash posting and no duplicate state", () => {
    const order = orderService.createOrder({
      customer: "PT Concurrency Test",
      nomorHP: "081266667777",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 8008 CON",
      biayaJasa: 300000,
      totalEstimasi: 900000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 900000,
        dibayar: 900000,
        buktiPembayaran: { fileName: "conc_tf.jpg", fileType: "image" },
      },
    }, testAdmin);

    const kasBefore = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
    const concKey = `conc-key-${Date.now()}`;

    // Simulate two concurrent execution turns on same order with same idempotency key
    const run1 = financeService.verifyPayment({
      orderNo: order.orderNo,
      user: testAdmin,
      idempotencyKey: concKey,
    });

    const run2 = financeService.verifyPayment({
      orderNo: order.orderNo,
      user: testAdmin,
      idempotencyKey: concKey,
    });

    assert.strictEqual(run2.isReplay, true, "Concurrent retry with identical key must return replay");

    // A third call without an idempotency key on the now-verified order must fail-closed with 400
    assert.throws(
      () => {
        financeService.verifyPayment({
          orderNo: order.orderNo,
          user: testAdmin,
        });
      },
      (err: any) => err instanceof ApiError && err.statusCode === 400 && err.code === "NO_PENDING_PAYMENT"
    );

    const kasAfter = db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any;
    const payments = dbFinanceRepository.getPaymentsByOrderNo(order.orderNo);

    // Exactly 1 new kas entry across all runs
    assert.strictEqual(kasAfter.c, kasBefore.c + 1, "Concurrency must produce at most 1 kas debit");
    // Exactly 1 payment record
    assert.strictEqual(payments.length, 1, "Must have exactly 1 payment record");
    assert.strictEqual(payments[0].status_verifikasi, "TERVERIFIKASI");
  });

  it("AC-C-09: Existing Historical Records #1-#7 remain untouched with payment_id = NULL", () => {
    const historicalRows = db.prepare("SELECT id, payment_id, nominal, status_verifikasi FROM invoice_payments WHERE id <= 7 ORDER BY id ASC").all() as any[];

    const expectedStatuses: Record<number, string> = {
      1: "TERVERIFIKASI",
      2: "MENUNGGU_VERIFIKASI",
      3: "TERVERIFIKASI",
      4: "MENUNGGU_BUKTI",
      5: "MENUNGGU_BUKTI",
      6: "MENUNGGU_VERIFIKASI",
      7: "TERVERIFIKASI",
    };

    assert.strictEqual(historicalRows.length, 7, "All 7 historical rows must exist");
    historicalRows.forEach((r) => {
      assert.strictEqual(r.payment_id, null, `Historical row #${r.id} must retain payment_id = NULL`);
      assert.strictEqual(r.status_verifikasi, expectedStatuses[r.id], `Historical row #${r.id} must retain baseline status ${expectedStatuses[r.id]}`);
    });
  });

});
