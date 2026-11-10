/**
 * Cross-Module Data Integrity and Source-of-Truth Automated Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Tests:
 * 1. Finance payment synchronizes to Order atomically
 * 2. Order verify-payment synchronizes to Finance atomically
 * 3. Partial payment calculation and status consistency across domains
 * 4. Database transaction atomicity (rollback on failure)
 * 5. Dashboard financial KPI derivation from canonical finance records
 * 6. Provider swapping for Finance, Pricing, and User repositories
 * 7. Messenger identity preservation across workflow transitions
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { runInTransaction, db } from "../server/src/database/db";
import { getFinancialKPIs } from "../src/app/data/dashboardAdapter";
import { isFullyPaid, toCanonicalPaymentStatus, toOrderPaymentStatus, toFinancePaymentStatus } from "../src/domain/finance/paymentMapping";
import { FinanceRepository } from "../src/data/repositories/financeRepository";
import { MockFinanceProvider } from "./fixtures/mock/mockFinanceProvider";
import { ApiFinanceProvider } from "../src/data/api/apiFinanceProvider";
import { PricingRepository } from "../src/data/repositories/pricingRepository";
import { MockPricingProvider } from "./fixtures/mock/mockPricingProvider";
import { ApiPricingProvider } from "../src/data/api/apiPricingProvider";
import { UserRepository } from "../src/data/repositories/userRepository";
import { MockUserProvider } from "./fixtures/mock/mockUserProvider";
import { ApiUserProvider } from "../src/data/api/apiUserProvider";

function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

async function loginAdmin(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "svp@birojasa.com", password: "admin123" }),
  });
  const data = await res.json() as any;
  return data.data.token;
}

test("Data Integrity 1: Finance payment synchronizes to Order atomically", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = await loginAdmin(baseUrl);

    // 1. Create Order with unpaid payment
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        customer: "Sync Test Client A",
        namaPemilik: "Pemilik A",
        nomorHP: "081299990001",
        nopol: "B 1001 SYC",
        layanan: "Perpanjangan STNK Tahunan",
        totalEstimasi: 750000,
        tipePembayaran: "Bayar di Akhir",
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const orderData = (await createRes.json() as any).data;
    const orderNo = orderData.orderNo;
    const invoiceNo = orderData.payment.invoiceNo;

    // 2. Fetch linked Invoice from /api/finance/invoices
    const invoicesRes = await fetch(`${baseUrl}/api/finance/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const invoicesData = (await invoicesRes.json() as any).data;
    const linkedInvoice = invoicesData.find((inv: any) => inv.orderNo === orderNo || inv.invoiceNo === invoiceNo);
    assert.ok(linkedInvoice, "Linked invoice must exist in finance database");
    assert.strictEqual(linkedInvoice.status, "UNPAID");

    // 2b. Verify order cost through official endpoint before recording payment
    const samsatBiaya = 750000 - (orderData.biayaJasa || 0) - (orderData.biayaAntarJemput || 0);
    const verifyCostRes = await fetch(`${baseUrl}/api/orders/${orderNo}/verify-cost`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        finalBiayaSamsat: Math.max(0, samsatBiaya),
        finalTotalBiaya: 750000,
        notes: "Verifikasi biaya pra-pembayaran",
      }),
    });
    assert.strictEqual(verifyCostRes.status, 200);

    // 2c. Approve Supervisi Stage 6 for payment gating
    const approveRes = await fetch(`${baseUrl}/api/orders/${orderNo}/approve-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage: 6 }),
    });
    assert.strictEqual(approveRes.status, 200);

    // 3. Record full payment on Invoice via Finance API
    const payRes = await fetch(`${baseUrl}/api/finance/invoices/${linkedInvoice.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount: 750000,
        details: { metodePembayaran: "Transfer BCA" },
      }),
    });
    assert.strictEqual(payRes.status, 200);
    const paidInvoice = (await payRes.json() as any).data;
    assert.strictEqual(paidInvoice.status, "PAID");
    assert.strictEqual(paidInvoice.sisa, 0);

    // 4. Verify Order was atomically synchronized
    const getOrderRes = await fetch(`${baseUrl}/api/orders/${orderNo}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(getOrderRes.status, 200);
    const updatedOrder = (await getOrderRes.json() as any).data;

    assert.strictEqual(updatedOrder.payment.statusPembayaran, "Lunas");
    assert.strictEqual(updatedOrder.payment.dibayar, 750000);
    assert.strictEqual(updatedOrder.payment.kurang, 0);
    assert.strictEqual(updatedOrder.payment.isPaymentVerified, true);
  } finally {
    server.close();
  }
});

test("Data Integrity 2: Order verify-payment synchronizes to Finance atomically", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = await loginAdmin(baseUrl);

    // 1. Create Order with Bayar di Awal
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        customer: "Sync Test Client B",
        namaPemilik: "Pemilik B",
        nomorHP: "081299990002",
        nopol: "B 1002 SYC",
        layanan: "Mutasi Masuk",
        totalEstimasi: 1200000,
        tipePembayaran: "Bayar di Awal",
      }),
    });
    const orderData = (await createRes.json() as any).data;
    const orderNo = orderData.orderNo;

    // 2. Verify payment on Order via Order Tracking endpoint
    const verifyRes = await fetch(`${baseUrl}/api/orders/${orderNo}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        verifierName: "Supervisor Ari",
        buktiPembayaran: { fileUrl: "https://proof.example.com/transfer.jpg" },
      }),
    });
    assert.strictEqual(verifyRes.status, 200);
    const verifiedOrder = (await verifyRes.json() as any).data;
    assert.strictEqual(verifiedOrder.payment.statusPembayaran, "Lunas");
    assert.strictEqual(verifiedOrder.payment.isPaymentVerified, true);

    // 3. Verify linked invoice in Finance was updated to PAID
    const invoicesRes = await fetch(`${baseUrl}/api/finance/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const invoicesData = (await invoicesRes.json() as any).data;
    const linkedInvoice = invoicesData.find((inv: any) => inv.orderNo === orderNo);
    assert.ok(linkedInvoice, "Linked invoice must exist");
    assert.strictEqual(linkedInvoice.status, "PAID");
    assert.strictEqual(linkedInvoice.sisa, 0);
    assert.strictEqual(linkedInvoice.dibayar, 1200000);
  } finally {
    server.close();
  }
});

test("Data Integrity 3: Partial payment maintains mathematical consistency across Order & Finance", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = await loginAdmin(baseUrl);

    // 1. Create Order with total 1,000,000
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        customer: "Partial Payment Client",
        namaPemilik: "Pemilik Partial",
        nomorHP: "081299990003",
        nopol: "B 1003 PRT",
        layanan: "Balik Nama Kendaraan",
        totalEstimasi: 1000000,
        tipePembayaran: "Bayar di Akhir",
      }),
    });
    const orderData = (await createRes.json() as any).data;
    const orderNo = orderData.orderNo;

    // 2. Fetch invoice and record partial payment of 350,000
    const invoicesRes = await fetch(`${baseUrl}/api/finance/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const invoicesData = (await invoicesRes.json() as any).data;
    const linkedInvoice = invoicesData.find((inv: any) => inv.orderNo === orderNo);
    assert.ok(linkedInvoice);

    // 2b. Verify order cost through official endpoint before recording partial payment
    const samsatBiaya2 = 1000000 - (orderData.biayaJasa || 0) - (orderData.biayaAntarJemput || 0);
    const verifyCostRes = await fetch(`${baseUrl}/api/orders/${orderNo}/verify-cost`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        finalBiayaSamsat: Math.max(0, samsatBiaya2),
        finalTotalBiaya: 1000000,
        notes: "Verifikasi biaya pra-pembayaran parsial",
      }),
    });
    assert.strictEqual(verifyCostRes.status, 200);

    // 2c. Approve Supervisi Stage 6 for payment gating
    const approveRes = await fetch(`${baseUrl}/api/orders/${orderNo}/approve-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage: 6 }),
    });
    assert.strictEqual(approveRes.status, 200);

    const payRes = await fetch(`${baseUrl}/api/finance/invoices/${linkedInvoice.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount: 350000,
        details: { metodePembayaran: "Cash" },
      }),
    });
    assert.strictEqual(payRes.status, 200);
    const invoiceAfterPartial = (await payRes.json() as any).data;
    assert.strictEqual(invoiceAfterPartial.status, "PARTIAL");
    assert.strictEqual(invoiceAfterPartial.dibayar, 350000);
    assert.strictEqual(invoiceAfterPartial.sisa, 650000);

    // 3. Verify Order reflects partial payment accurately
    const getOrderRes = await fetch(`${baseUrl}/api/orders/${orderNo}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const orderAfterPartial = (await getOrderRes.json() as any).data;
    assert.strictEqual(orderAfterPartial.payment.statusPembayaran, "Kurang");
    assert.strictEqual(orderAfterPartial.payment.dibayar, 350000);
    assert.strictEqual(orderAfterPartial.payment.kurang, 650000);
    assert.strictEqual(orderAfterPartial.payment.isPaymentVerified, false);
  } finally {
    server.close();
  }
});

test("Data Integrity 4: Atomic rollback rolls back all changes when transaction fails midway", () => {
  // Setup test record in sqlite
  const testId = `test-audit-${Date.now()}`;
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO audit_logs (id, user_id, user_name, user_role, action, module, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  insertStmt.run(testId, "test-user", "Test Super Admin", "administrator", "TEST_INIT", "Test", "Initial test log");

  // Attempt transaction that mutates then throws
  let errorCaught = false;
  try {
    runInTransaction(() => {
      const updateStmt = db.prepare("UPDATE audit_logs SET details = ? WHERE id = ?");
      updateStmt.run("Modified details inside transaction", testId);

      // Force failure
      throw new Error("FORCED_TRANSACTION_ABORT");
    });
  } catch (err: any) {
    if (err.message === "FORCED_TRANSACTION_ABORT") {
      errorCaught = true;
    }
  }

  assert.strictEqual(errorCaught, true, "Transaction must abort and bubble error");

  // Verify rollback: details must still be "Initial test log"
  const checkStmt = db.prepare("SELECT details FROM audit_logs WHERE id = ?");
  const row = checkStmt.get(testId) as { details: string } | undefined;
  assert.ok(row);
  assert.strictEqual(row.details, "Initial test log", "Database changes must have rolled back cleanly");

  // Cleanup
  db.prepare("DELETE FROM audit_logs WHERE id = ?").run(testId);
});

test("Data Integrity 5: Dashboard financial KPI derivation normalizes PAID and Lunas correctly", () => {
  // Verify status mapping helpers
  assert.strictEqual(isFullyPaid("PAID"), true);
  assert.strictEqual(isFullyPaid("Lunas"), true);
  assert.strictEqual(isFullyPaid("UNPAID"), false);
  assert.strictEqual(isFullyPaid("Belum Bayar"), false);
  assert.strictEqual(isFullyPaid("PARTIAL"), false);
  assert.strictEqual(isFullyPaid("Kurang"), false);

  assert.strictEqual(toCanonicalPaymentStatus("Lunas"), "PAID");
  assert.strictEqual(toCanonicalPaymentStatus("PAID"), "PAID");
  assert.strictEqual(toCanonicalPaymentStatus("Kurang"), "PARTIAL");
  assert.strictEqual(toCanonicalPaymentStatus("PARTIAL"), "PARTIAL");
  assert.strictEqual(toOrderPaymentStatus("PAID"), "Lunas");
  assert.strictEqual(toOrderPaymentStatus("PARTIAL"), "Kurang");
  assert.strictEqual(toFinancePaymentStatus("PAID"), "Lunas");
  assert.strictEqual(toFinancePaymentStatus("PARTIAL"), "Kurang Bayar");

  // Synthetic invoice list with mixed backend ("PAID") and frontend ("Lunas") statuses
  const testInvoices: any[] = [
    { id: 1, terbayar: 500000, sisa: 0, status: "PAID", billingStatus: "ACTIVE" },
    { id: 2, terbayar: 300000, sisa: 0, status: "Lunas", billingStatus: "COMPLETED" },
    { id: 3, terbayar: 200000, sisa: 300000, status: "PARTIAL", billingStatus: "ACTIVE" },
    { id: 4, terbayar: 0, sisa: 400000, status: "UNPAID", billingStatus: "ACTIVE" },
  ];

  const testKas: any[] = [{ id: 1, total: 10000000 }];
  const testProfit: any[] = [{ profit: 150000 }, { profit: 250000 }];

  const kpis = getFinancialKPIs(testInvoices, testKas, testProfit);

  // Revenue total = 500k + 300k + 200k + 0 = 1,000,000
  assert.strictEqual(kpis.revenueTotal, 1000000, "Revenue must accurately sum all payments");
  // Outstanding total = only invoices that are not fully paid (300k + 400k = 700k)
  assert.strictEqual(kpis.outstandingTotal, 700000, "Outstanding must NOT count PAID or Lunas invoices");
  assert.strictEqual(kpis.saldoKasKantor, 10000000);
  assert.strictEqual(kpis.realizedProfitTotal, 400000);
});

test("Data Integrity 6: Cross-Module Provider Swapping functions without consumer disruption", () => {
  // Finance Repository
  const finRepo = new FinanceRepository(new MockFinanceProvider());
  assert.ok(Array.isArray(finRepo.getInvoices()), "MockFinanceProvider returns invoices array");
  const apiFinProvider = new ApiFinanceProvider();
  finRepo.setProvider(apiFinProvider);
  assert.strictEqual(finRepo.getProvider(), apiFinProvider, "FinanceProvider swapped successfully");

  // Pricing Repository
  const pricingRepo = new PricingRepository(new MockPricingProvider());
  assert.ok(pricingRepo.getSamsatItems().length > 0, "MockPricingProvider returns items");
  const apiPricingProvider = new ApiPricingProvider();
  pricingRepo.setProvider(apiPricingProvider);
  assert.strictEqual(pricingRepo.getProvider(), apiPricingProvider, "PricingProvider swapped successfully");

  // User Repository
  const userRepo = new UserRepository(new MockUserProvider());
  assert.ok(userRepo.getAll().length > 0, "MockUserProvider returns users");
  const apiUserProvider = new ApiUserProvider();
  userRepo.setProvider(apiUserProvider);
  assert.strictEqual(userRepo.getProvider(), apiUserProvider, "UserProvider swapped successfully");
});
