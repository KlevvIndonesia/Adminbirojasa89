/**
 * Phase 4B — Batch 1: Financial Integrity & Calculation Hardening Test Suite
 * 
 * Validates:
 * - GAP-FIN-01: Cross-Order Payment Aggregation isolation
 * - GAP-FIN-02: Invoice-to-Order Relational Integrity & anti-hijacking guards
 * - GAP-FIN-05: Shared Canonical Invoice Calculator consistency between getInvoiceById and getAllInvoices
 * - Mandatory Historical Simulation: INV-1126-001 isolation (eliminating false Rp 1.126.000 overpayment)
 */

import test from "node:test";
import assert from "node:assert";
import { db } from "../server/src/database/db";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { financeService } from "../server/src/services/financeService";
import { calculateCanonicalInvoiceTotals, partitionInvoicePayments } from "../server/src/services/canonicalInvoiceCalculator";

test("PHASE 4B BATCH 1 — FINANCIAL INTEGRITY SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST GROUP A: PAYMENT ISOLATION (GAP-FIN-01)
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("Group A: Payment Isolation between Orders sharing Invoice Number", async (t) => {
    
    await t.test("A.1 & A.2: Payments on Order 1 do NOT leak into Order 2 with identical invoice number", () => {
      const invNo = `INV-TEST-ISO-${Date.now()}`;
      const ord1 = `ORD-TEST-ISO-1-${Date.now()}`;
      const ord2 = `ORD-TEST-ISO-2-${Date.now()}`;

      // Insert isolated payments for both orders
      const p1 = {
        invoice_no: invNo,
        order_no: ord1,
        nominal: 500000,
        status_verifikasi: "TERVERIFIKASI",
        is_void: 0,
      };

      const p2 = {
        invoice_no: invNo,
        order_no: ord2,
        nominal: 750000,
        status_verifikasi: "TERVERIFIKASI",
        is_void: 0,
      };

      const allPayments = [p1, p2];

      // Calculate for Order 1
      const calc1 = calculateCanonicalInvoiceTotals({
        invoiceNo: invNo,
        orderNo: ord1,
        totalTagihan: 500000,
        payments: allPayments,
      });

      assert.strictEqual(calc1.verifiedPaid, 500000, "Order 1 verified payment must only be Rp 500.000");
      assert.strictEqual(calc1.sisaTagihan, 0, "Order 1 sisa must be 0");
      assert.strictEqual(calc1.overpayment, 0, "Order 1 overpayment must be 0");
      assert.strictEqual(calc1.status, "PAID", "Order 1 status must be PAID");
      assert.strictEqual(calc1.eligibleVerifiedPayments.length, 1);
      assert.strictEqual(calc1.eligibleVerifiedPayments[0].order_no, ord1);

      // Calculate for Order 2
      const calc2 = calculateCanonicalInvoiceTotals({
        invoiceNo: invNo,
        orderNo: ord2,
        totalTagihan: 1000000,
        payments: allPayments,
      });

      assert.strictEqual(calc2.verifiedPaid, 750000, "Order 2 verified payment must only be Rp 750.000");
      assert.strictEqual(calc2.sisaTagihan, 250000, "Order 2 sisa must be Rp 250.000");
      assert.strictEqual(calc2.overpayment, 0, "Order 2 overpayment must be 0");
      assert.strictEqual(calc2.status, "PARTIAL", "Order 2 status must be PARTIAL");
      assert.strictEqual(calc2.eligibleVerifiedPayments.length, 1);
      assert.strictEqual(calc2.eligibleVerifiedPayments[0].order_no, ord2);
    });

    await t.test("A.5 & A.6: Pending payments do not count as paid; Void payments are excluded", () => {
      const invNo = `INV-TEST-PEND-${Date.now()}`;
      const ordNo = `ORD-TEST-PEND-${Date.now()}`;

      const payments = [
        { invoice_no: invNo, order_no: ordNo, nominal: 300000, status_verifikasi: "TERVERIFIKASI", is_void: 0 },
        { invoice_no: invNo, order_no: ordNo, nominal: 200000, status_verifikasi: "MENUNGGU_VERIFIKASI", is_void: 0 },
        { invoice_no: invNo, order_no: ordNo, nominal: 100000, status_verifikasi: "MENUNGGU_BUKTI", is_void: 0 },
        { invoice_no: invNo, order_no: ordNo, nominal: 500000, status_verifikasi: "VOID", is_void: 1 },
      ];

      const calc = calculateCanonicalInvoiceTotals({
        invoiceNo: invNo,
        orderNo: ordNo,
        totalTagihan: 500000,
        payments,
      });

      assert.strictEqual(calc.verifiedPaid, 300000, "Only TERVERIFIKASI is counted as verifiedPaid");
      assert.strictEqual(calc.pendingPaid, 300000, "Pending sum must be 200k + 100k = 300k");
      assert.strictEqual(calc.sisaTagihan, 200000, "Sisa must be 500k - 300k = 200k");
      assert.strictEqual(calc.status, "PARTIAL");
      assert.strictEqual(calc.quarantinedPayments.some((q) => q.reason.includes("PAYMENT_VOID")), true);
    });

    await t.test("A.7: Payments with invalid pairs are quarantined fail-closed", () => {
      const invNo = "INV-VALID";
      const ordNo = "ORD-VALID";

      const foreignPayment = {
        invoice_no: "INV-OTHER",
        order_no: "ORD-OTHER",
        nominal: 1000000,
        status_verifikasi: "TERVERIFIKASI",
      };

      const result = partitionInvoicePayments([foreignPayment], invNo, ordNo);
      assert.strictEqual(result.verified.length, 0);
      assert.strictEqual(result.quarantined.length, 1);
      assert.ok(result.quarantined[0].reason.includes("CROSS_ORDER_MISMATCH"));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST GROUP B: INVOICE CALCULATION CONSISTENCY (GAP-FIN-05)
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("Group B: Invoice Calculation Consistency between getInvoiceById and getAllInvoices", async (t) => {
    
    await t.test("B.1 - B.6: Canonical totals, balances, and statuses are 100% identical across list & detail", () => {
      const orderNo = `ORD-GRP-B-${Date.now()}`;
      const invoiceNo = `INV-GRP-B-${Date.now()}`;

      // 0. Ensure order exists in orders table to satisfy FOREIGN KEY (order_no) REFERENCES orders(order_no)
      db.prepare(`
        INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, payment_status, total_biaya, data_json, created_at, updated_at)
        VALUES (?, ?, '08123456789', ?, 'B 1234 TST', 'Belum Lunas', ?, ?, datetime('now'), datetime('now'))
      `).run(orderNo, "Client Group B", "Balik Nama", 2500000, JSON.stringify({ orderNo, customer: "Client Group B" }));

      // 1. Create invoice in test database
      const invId = dbFinanceRepository.saveInvoice({
        invoiceNo,
        orderNo,
        customer: "Client Group B",
        layanan: "Balik Nama",
        totalTagihan: 2500000,
        biayaSamsat: 1800000,
        status: "UNPAID",
      });

      assert.ok(invId > 0, "Invoice must be saved");

      // 2. Add verified payment of Rp 1.500.000
      dbFinanceRepository.recordInvoicePayment({
        invoiceNo,
        orderNo,
        nominal: 1500000,
        metodePembayaran: "Transfer Mandiri",
        statusVerifikasi: "TERVERIFIKASI",
      });

      // 3. Add pending payment of Rp 500.000
      dbFinanceRepository.recordInvoicePayment({
        invoiceNo,
        orderNo,
        nominal: 500000,
        metodePembayaran: "Transfer Mandiri",
        statusVerifikasi: "MENUNGGU_VERIFIKASI",
      });

      // 4. Fetch via getInvoiceById
      const detailInv = dbFinanceRepository.getInvoiceById(invId);
      assert.ok(detailInv, "Detail invoice must exist");

      // 5. Fetch via getAllInvoices
      const allInvoices = dbFinanceRepository.getAllInvoices();
      const listInv = allInvoices.find((i) => i.id === invId);
      assert.ok(listInv, "List invoice must exist");

      // 6. Assert exact equivalence across all metrics
      assert.strictEqual(detailInv.totalTagihan, 2500000);
      assert.strictEqual(listInv.totalTagihan, 2500000);

      assert.strictEqual(detailInv.dibayar, 1500000);
      assert.strictEqual(listInv.dibayar, 1500000);

      assert.strictEqual(detailInv.terbayar, 1500000);
      assert.strictEqual(listInv.terbayar, 1500000);

      assert.strictEqual(detailInv.sisa, 1000000);
      assert.strictEqual(listInv.sisa, 1000000);

      assert.strictEqual(detailInv.status, "PARTIAL");
      assert.strictEqual(listInv.status, "PARTIAL");

      assert.strictEqual(detailInv.settlementCondition, "UNDERPAID");
      assert.strictEqual(listInv.settlementCondition, "UNDERPAID");

      // Proportional gross profit:
      // totalTagihan = 2.500.000, biayaSamsat = 1.800.000, alpha = 1.8M / 2.5M = 0.72
      // recognizedRevenue = 1.500.000, matchedCOGS = 0.72 * 1.500.000 = 1.080.000
      // grossProfit = 1.500.000 - 1.080.000 = 420.000
      assert.strictEqual(detailInv.profit, 420000);
      assert.strictEqual(listInv.profit, 420000);

      // Also check getInvoiceByOrderNo and getInvoiceByNo
      const byOrder = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
      const byNo = dbFinanceRepository.getInvoiceByNo(invoiceNo)!;

      assert.strictEqual(byOrder.dibayar, 1500000);
      assert.strictEqual(byOrder.sisa, 1000000);
      assert.strictEqual(byNo.dibayar, 1500000);
      assert.strictEqual(byNo.sisa, 1000000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST GROUP C: RELATIONAL INTEGRITY & FAIL-CLOSED GUARDS (GAP-FIN-02)
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("Group C: Relational Integrity & Fail-Closed Guard Enforcement", async (t) => {
    
    await t.test("C.1: Payment with matching invoice/order pair is accepted", () => {
      const ordNo = `ORD-GRP-C1-${Date.now()}`;
      const invNo = `INV-GRP-C1-${Date.now()}`;

      db.prepare(`
        INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, payment_status, total_biaya, data_json, created_at, updated_at)
        VALUES (?, ?, '08123456789', ?, 'B 1234 TST', 'Belum Lunas', ?, ?, datetime('now'), datetime('now'))
      `).run(ordNo, "Client C1", "Mutasi Masuk", 1000000, JSON.stringify({ orderNo: ordNo }));

      dbFinanceRepository.saveInvoice({
        invoiceNo: invNo,
        orderNo: ordNo,
        customer: "Client C1",
        layanan: "Mutasi Masuk",
        totalTagihan: 1000000,
      });

      const pmt = dbFinanceRepository.recordInvoicePayment({
        invoiceNo: invNo,
        orderNo: ordNo,
        nominal: 1000000,
        metodePembayaran: "Transfer BCA",
        statusVerifikasi: "TERVERIFIKASI",
      });

      assert.ok(pmt && pmt.id > 0, "Payment must be recorded successfully");
    });

    await t.test("C.2: Payment with mismatched invoice/order pair is rejected fail-closed", () => {
      const ordNoA = `ORD-GRP-C2-A-${Date.now()}`;
      const invNoA = `INV-GRP-C2-A-${Date.now()}`;
      const ordNoB = `ORD-GRP-C2-B-${Date.now()}`;

      dbFinanceRepository.saveInvoice({
        invoiceNo: invNoA,
        orderNo: ordNoA,
        customer: "Client C2 A",
        layanan: "Perpanjangan STNK",
        totalTagihan: 500000,
      });

      // Attempt payment targeting invNoA but specifying ordNoB
      assert.throws(
        () => {
          dbFinanceRepository.recordInvoicePayment({
            invoiceNo: invNoA,
            orderNo: ordNoB, // Mismatched!
            nominal: 500000,
            metodePembayaran: "Transfer BCA",
          });
        },
        (err: any) => err.message.includes("RELATIONAL_INTEGRITY_VIOLATION"),
        "Mismatched invoice/order payment must throw RELATIONAL_INTEGRITY_VIOLATION"
      );
    });

    await t.test("C.3: Silent renumbering of invoice on existing order is blocked", () => {
      const ordNo = `ORD-GRP-C3-${Date.now()}`;
      const originalInvNo = `INV-GRP-C3-ORIG-${Date.now()}`;
      const renumberedInvNo = `INV-GRP-C3-NEW-${Date.now()}`;

      dbFinanceRepository.saveInvoice({
        invoiceNo: originalInvNo,
        orderNo: ordNo,
        customer: "Client C3",
        layanan: "Perpanjangan STNK",
        totalTagihan: 500000,
      });

      // Attempt to save a new invoiceNo for the same order without migration
      assert.throws(
        () => {
          dbFinanceRepository.saveInvoice({
            invoiceNo: renumberedInvNo,
            orderNo: ordNo,
            customer: "Client C3",
            layanan: "Perpanjangan STNK",
            totalTagihan: 500000,
          });
        },
        (err: any) => err.message.includes("RELATIONAL_INTEGRITY_VIOLATION"),
        "Silent renumbering of order's invoice must be rejected"
      );
    });

    await t.test("C.4: Hijacking an existing invoice number by another order is blocked", () => {
      const ordNo1 = `ORD-GRP-C4-1-${Date.now()}`;
      const ordNo2 = `ORD-GRP-C4-2-${Date.now()}`;
      const sharedInvNo = `INV-GRP-C4-SHARED-${Date.now()}`;

      dbFinanceRepository.saveInvoice({
        invoiceNo: sharedInvNo,
        orderNo: ordNo1,
        customer: "Client C4-1",
        layanan: "Layanan 1",
        totalTagihan: 1000000,
      });

      // Order 2 attempts to use sharedInvNo
      assert.throws(
        () => {
          dbFinanceRepository.saveInvoice({
            invoiceNo: sharedInvNo,
            orderNo: ordNo2,
            customer: "Client C4-2",
            layanan: "Layanan 2",
            totalTagihan: 1000000,
          });
        },
        (err: any) => err.message.includes("FINANCE_INVOICE_COLLISION"),
        "Hijacking an existing invoice number by a different order must be rejected"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST GROUP D: HISTORICAL CASE SIMULATION (INV-1126-001)
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("Group D: Historical Case Simulation (INV-1126-001 Collision Isolation)", async (t) => {
    
    await t.test("D.1: ORD-1126-001 payments (Rp 1.126.000) do NOT produce fake overpayment on ORD-1126-003", () => {
      // Historical fixture:
      // Order 1: ORD-1126-001 (Mahesa Alghifari), Total: Rp 613.000, Paid: Rp 563.000 (Payment #1: 563k, Payment #3 duplicate: 563k)
      // Order 3: ORD-1126-003 (Frenkye Sitorus), Total: Rp 1.258.000, Paid: Rp 1.258.000 (Payment #7: 1.258.000)
      // Both shared invoice_no 'INV-1126-001' in historical records

      const historicalPayments = [
        {
          id: 1,
          invoice_no: "INV-1126-001",
          order_no: "ORD-1126-001",
          nominal: 563000,
          status_verifikasi: "TERVERIFIKASI",
          kas_kantor_id: 2,
          is_void: 0,
        },
        {
          id: 2,
          invoice_no: "INV-1126-001",
          order_no: "ORD-1126-001",
          nominal: 563000,
          status_verifikasi: "MENUNGGU_VERIFIKASI",
          kas_kantor_id: null,
          is_void: 0,
        },
        {
          id: 3,
          invoice_no: "INV-1126-001",
          order_no: "ORD-1126-001",
          nominal: 563000,
          status_verifikasi: "TERVERIFIKASI",
          kas_kantor_id: null,
          is_void: 0,
        },
        {
          id: 6,
          invoice_no: "INV-1126-001",
          order_no: "ORD-1126-003",
          nominal: 1258000,
          status_verifikasi: "MENUNGGU_VERIFIKASI",
          kas_kantor_id: null,
          is_void: 0,
        },
        {
          id: 7,
          invoice_no: "INV-1126-001",
          order_no: "ORD-1126-003",
          nominal: 1258000,
          status_verifikasi: "TERVERIFIKASI",
          kas_kantor_id: null,
          is_void: 0,
        },
      ];

      // 1. Calculate for ORD-1126-003 (Frenkye Sitorus)
      const calcOrd003 = calculateCanonicalInvoiceTotals({
        invoiceNo: "INV-1126-001",
        orderNo: "ORD-1126-003",
        totalTagihan: 1258000,
        biayaSamsat: 958000,
        payments: historicalPayments,
      });

      // PRIOR BUG: Verified paid was 563k + 563k + 1258k = 2.384.000 -> Overpayment Rp 1.126.000!
      // NOW: ORD-1126-001 payments are strictly quarantined, zero cross-order leakage!
      assert.strictEqual(calcOrd003.verifiedPaid, 1258000, "ORD-1126-003 verified paid must strictly be 1.258.000");
      assert.strictEqual(calcOrd003.sisaTagihan, 0, "ORD-1126-003 sisa must be 0");
      assert.strictEqual(calcOrd003.overpayment, 0, "ORD-1126-003 overpayment MUST BE 0 (NO FALSE Rp 1.126.000 OVERPAYMENT)");
      assert.strictEqual(calcOrd003.status, "PAID", "ORD-1126-003 status must be PAID (not OVERPAID)");
      assert.strictEqual(calcOrd003.settlementCondition, "BALANCED");

      // Verify that Payments #1, #2, #3 were quarantined with CROSS_ORDER_MISMATCH
      const quarantinedOrd001 = calcOrd003.quarantinedPayments.filter((q) => q.payment.order_no === "ORD-1126-001");
      assert.strictEqual(quarantinedOrd001.length, 3, "All 3 payments from ORD-1126-001 must be quarantined from ORD-1126-003");

      // 2. Calculate for ORD-1126-001 (Mahesa Alghifari)
      const calcOrd001 = calculateCanonicalInvoiceTotals({
        invoiceNo: "INV-1126-001",
        orderNo: "ORD-1126-001",
        totalTagihan: 613000,
        payments: historicalPayments,
      });

      // Verify ORD-1126-003 payments (#6, #7) were quarantined from ORD-1126-001
      const quarantinedOrd003 = calcOrd001.quarantinedPayments.filter((q) => q.payment.order_no === "ORD-1126-003");
      assert.strictEqual(quarantinedOrd003.length, 2, "All payments from ORD-1126-003 must be quarantined from ORD-1126-001");
    });
  });

});
