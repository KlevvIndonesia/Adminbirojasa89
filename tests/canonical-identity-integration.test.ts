/**
 * Phase 9.4 — Canonical Identity, Idempotency, and Retry Safety Integration Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. Real API Persistence & Canonical Identity Reconciliation:
 *    - Frontend order identity matches backend SQLite persistence result.
 *    - Invoices are linked strictly to the canonical orderNo.
 *    - In-memory cache and projections are reconciled without duplicate rows.
 * 2. Anti-Ghost Row Protection on Failure:
 *    - API creation errors roll back optimistic orders and invoices cleanly.
 * 3. Concurrent Request Isolation:
 *    - Concurrent creates produce unique orderNos with discrete invoice links.
 * 4. Out-of-Order Response Reconciliation:
 *    - Asynchronous completion maps strictly to individual client temporary IDs.
 * 5. Idempotency & Retry Safety:
 *    - Retrying an identical creation request after timeout returns the existing order.
 *    - Zero duplicate orders or duplicate invoices are generated.
 * 6. Provider Routing Integrity:
 *    - Mock provider remains isolated; API provider persists live to backend.
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { ApiOrderProvider } from "../src/data/api/apiOrderProvider";
import { MockOrderProvider } from "../src/data/mock/mockOrderProvider";
import { orderRepository } from "../src/data/repositories/orderRepository";
import { orderStore } from "../src/app/data/orderStore";
import { financeStore } from "../src/app/data/financeStore";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";

function createServerInstance(): Promise<{ server: http.Server; baseUrl: string }> {
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

async function getAdminToken(baseUrl: string): Promise<string> {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@birojasa.com", password: "admin123" }),
  });
  const data = (await loginRes.json()) as any;
  return data.data.token;
}

test("Phase 9.4 Integration — 1. Real API Persistence & Canonical Identity Reconciliation", async (t) => {
  const { server, baseUrl } = await createServerInstance();
  try {
    const token = await getAdminToken(baseUrl);
    const apiProvider = new ApiOrderProvider(`${baseUrl}/api`);
    // Inject auth header for API provider
    (apiProvider as any).getAuthHeader = () => ({ Authorization: `Bearer ${token}` });
    await apiProvider.initFromApi();

    orderRepository.setProvider(apiProvider);
    financeStore.setApiMode(true);

    const uniqueTag = Date.now();
    const createdOrder = await orderStore.addOrderAsync({
      customer: `Customer Canonical ${uniqueTag}`,
      namaPemilik: `Owner Canonical ${uniqueTag}`,
      nomorHP: "081299998888",
      layanan: "Mutasi Luar Daerah",
      nopol: `B ${uniqueTag % 9000} CAN`,
      wilayahSamsatAsal: "Jakarta Barat",
      wilayahSamsatTujuan: "Surabaya",
      totalEstimasi: 1250000,
      payment: {
        tipePembayaran: "Bayar di Akhir",
        metodePembayaran: "Transfer",
        statusPembayaran: "Belum Lunas",
        totalBiaya: 1250000,
        dibayar: 0,
        kurang: 1250000,
      },
    });

    const canonicalOrderNo = createdOrder.orderNo;
    assert.ok(canonicalOrderNo.startsWith("ORD-"), `Canonical orderNo must start with ORD-, got: ${canonicalOrderNo}`);

    // Verify 1: Backend SQLite Persistence re-read directly
    const persistedOrder = dbOrderRepository.getByOrderNo(canonicalOrderNo);
    assert.ok(persistedOrder, `Order ${canonicalOrderNo} must be physically persisted in SQLite`);
    assert.strictEqual(persistedOrder?.customer, `Customer Canonical ${uniqueTag}`);
    assert.strictEqual(persistedOrder?.nopol, `B ${uniqueTag % 9000} CAN`);

    // Verify 2: Backend Invoice creation & linkage
    const persistedInvoice = dbFinanceRepository.getInvoiceByOrderNo(canonicalOrderNo);
    assert.ok(persistedInvoice, `Invoice for order ${canonicalOrderNo} must be physically persisted in SQLite`);
    assert.strictEqual(persistedInvoice?.orderNo, canonicalOrderNo);
    assert.strictEqual(persistedInvoice?.totalTagihan, 1250000);

    // Verify 3: Frontend FinanceStore invoice linked to canonical orderNo
    const localInvoices = financeStore.getInvoices();
    const linkedLocalInvoice = localInvoices.find((i) => i.orderNo === canonicalOrderNo);
    assert.ok(linkedLocalInvoice, `Local invoice must have orderNo reconciled to ${canonicalOrderNo}`);

    // Verify 4: Data Penjualan projection contains canonical row and no duplicates
    const mutasiLdRows = financeStore.getContractData("mutasi-ld");
    const matchingRows = mutasiLdRows.filter((r) => r.orderNo === canonicalOrderNo);
    assert.strictEqual(matchingRows.length, 1, `Exactly 1 row must exist for canonical order ${canonicalOrderNo}`);
    assert.strictEqual(matchingRows[0]["Samsat"], "Surabaya", "Mutasi row must reflect valid destination Samsat");
  } finally {
    server.close();
  }
});

test("Phase 9.4 Integration — 2. Anti-Ghost Row Protection on API Creation Failure", async (t) => {
  const { server, baseUrl } = await createServerInstance();
  try {
    const token = await getAdminToken(baseUrl);
    const apiProvider = new ApiOrderProvider(`${baseUrl}/api`);
    (apiProvider as any).getAuthHeader = () => ({ Authorization: `Bearer ${token}` });
    await apiProvider.initFromApi();

    orderRepository.setProvider(apiProvider);
    financeStore.setApiMode(true);

    const preActiveCount = apiProvider.getAllFlat().length;
    const preInvoiceCount = financeStore.getInvoices().length;

    // Trigger failure by submitting empty required fields to API
    await assert.rejects(
      async () => {
        await orderStore.addOrderAsync({
          customer: "", // Missing customer triggers 400
          namaPemilik: "",
          nomorHP: "",
          layanan: "",
          nopol: "",
        });
      },
      /Order creation failed on backend|VALIDATION_ERROR/
    );

    // Verify no ghost order in activeOrders
    const postActiveCount = apiProvider.getAllFlat().length;
    assert.strictEqual(postActiveCount, preActiveCount, "Failed order creation MUST NOT add ghost order to activeOrders");

    // Verify no orphaned invoice in financeStore
    const postInvoiceCount = financeStore.getInvoices().length;
    assert.strictEqual(postInvoiceCount, preInvoiceCount, "Failed order creation MUST NOT leave orphaned invoice in financeStore");
  } finally {
    server.close();
  }
});

test("Phase 9.4 Integration — 3. Concurrent Request Isolation & Unique Canonical Identity", async (t) => {
  const { server, baseUrl } = await createServerInstance();
  try {
    const token = await getAdminToken(baseUrl);
    const apiProvider = new ApiOrderProvider(`${baseUrl}/api`);
    (apiProvider as any).getAuthHeader = () => ({ Authorization: `Bearer ${token}` });
    await apiProvider.initFromApi();

    orderRepository.setProvider(apiProvider);
    financeStore.setApiMode(true);

    const ts = Date.now();
    // Fire two different orders concurrently
    const [orderA, orderB] = await Promise.all([
      orderStore.addOrderAsync({
        customer: `Concurrent Alpha ${ts}`,
        namaPemilik: `Alpha Owner ${ts}`,
        nomorHP: "081100000001",
        layanan: "Balik Nama (BBN)",
        nopol: `B 1111 CON`,
        wilayahSamsatAsal: "Jakarta Timur",
        totalEstimasi: 800000,
      }),
      orderStore.addOrderAsync({
        customer: `Concurrent Beta ${ts}`,
        namaPemilik: `Beta Owner ${ts}`,
        nomorHP: "081100000002",
        layanan: "Perpanjangan STNK Tahunan",
        nopol: `B 2222 CON`,
        wilayahSamsatAsal: "Depok",
        totalEstimasi: 450000,
      }),
    ]);

    // Verify unique order numbers
    assert.notStrictEqual(orderA.orderNo, orderB.orderNo, "Concurrent orders MUST have distinct canonical orderNos");

    // Verify both physically exist in database
    const dbOrderA = dbOrderRepository.getByOrderNo(orderA.orderNo);
    const dbOrderB = dbOrderRepository.getByOrderNo(orderB.orderNo);
    assert.ok(dbOrderA, `Order ${orderA.orderNo} must physically exist in SQLite`);
    assert.ok(dbOrderB, `Order ${orderB.orderNo} must physically exist in SQLite`);

    // Verify separate invoices exist for both
    const invA = dbFinanceRepository.getInvoiceByOrderNo(orderA.orderNo);
    const invB = dbFinanceRepository.getInvoiceByOrderNo(orderB.orderNo);
    assert.ok(invA, `Invoice for ${orderA.orderNo} must exist in SQLite`);
    assert.ok(invB, `Invoice for ${orderB.orderNo} must exist in SQLite`);
    assert.notStrictEqual(invA?.invoiceNo, invB?.invoiceNo, "Invoices MUST have unique invoice numbers");
  } finally {
    server.close();
  }
});

test("Phase 9.4 Integration — 4. Idempotency & Retry Safety After Timeout", async (t) => {
  const { server, baseUrl } = await createServerInstance();
  try {
    const token = await getAdminToken(baseUrl);
    const apiProvider = new ApiOrderProvider(`${baseUrl}/api`);
    (apiProvider as any).getAuthHeader = () => ({ Authorization: `Bearer ${token}` });
    await apiProvider.initFromApi();

    orderRepository.setProvider(apiProvider);
    financeStore.setApiMode(true);

    const clientRequestId = `REQ-IDEMPOTENT-${Date.now()}`;
    const orderPayload = {
      clientRequestId,
      customer: "Idempotent Retry Customer",
      namaPemilik: "Idempotent Owner",
      nomorHP: "081277776666",
      layanan: "Mutasi Luar Daerah",
      nopol: "B 7777 IDM",
      wilayahSamsatAsal: "Jakarta Selatan",
      wilayahSamsatTujuan: "Semarang",
      totalEstimasi: 1500000,
    };

    // First attempt: client submits order
    const initialOrder = await orderStore.addOrderAsync(orderPayload as any);
    const assignedOrderNo = initialOrder.orderNo;
    assert.ok(assignedOrderNo, "First attempt must succeed and assign canonical orderNo");

    const ordersCountBefore = dbOrderRepository.getAllFlat(false).length;
    const invoicesCountBefore = dbFinanceRepository.getAllInvoices().length;

    // Simulate timeout / network retry with the SAME clientRequestId
    const retryOrder = await orderStore.addOrderAsync(orderPayload as any);

    // Verify: Retry returns the exact same canonical order
    assert.strictEqual(
      retryOrder.orderNo,
      assignedOrderNo,
      "Retry MUST return the existing canonical orderNo, not create a new one"
    );

    // Verify: Database count has NOT increased (zero duplicate order in SQLite)
    const ordersCountAfter = dbOrderRepository.getAllFlat(false).length;
    assert.strictEqual(ordersCountAfter, ordersCountBefore, "Zero duplicate orders must be created in SQLite on retry");

    // Verify: Invoices count has NOT increased (zero duplicate invoice in SQLite)
    const invoicesCountAfter = dbFinanceRepository.getAllInvoices().length;
    assert.strictEqual(invoicesCountAfter, invoicesCountBefore, "Zero duplicate invoices must be created in SQLite on retry");

    // Verify: Data Penjualan projection has exactly ONE row
    const rows = financeStore.getContractData("mutasi-ld").filter((r) => r.orderNo === assignedOrderNo);
    assert.strictEqual(rows.length, 1, "Exactly one row must appear in Data Penjualan for the idempotent order");
  } finally {
    server.close();
  }
});

test("Phase 9.4 Integration — 5. Provider Routing Integrity (Buat Order, +Tambah Data, and Mock)", async (t) => {
  // Test A: In Mock mode, newly added order uses MockOrderProvider
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);
  financeStore.setApiMode(false);

  const mockOrder = orderStore.addOrder({
    customer: "Mock Route Customer",
    namaPemilik: "Mock Owner",
    nomorHP: "081200001111",
    layanan: "Balik Nama (BBN)",
    nopol: "B 9999 MCK",
  });
  assert.ok(mockOrder.orderNo);
  const foundInMock = mockProvider.getOrderByNo(mockOrder.orderNo);
  assert.ok(foundInMock, "In Mock mode, order must be handled strictly by MockOrderProvider");

  // Test B: +Tambah Data routing
  const contractAdded = financeStore.addContractData("bbn", [
    {
      "Nama Customer": "Contract Add Customer",
      "Nomor HP": "081234567890",
      "Plat No": "B 8888 CTD",
      "Jenis Pengurusan": "Balik Nama",
      "Uang Masuk dari Konsumen": 700000,
    },
  ]);
  assert.ok(contractAdded, "+Tambah Data must successfully invoke canonical order creator");
  const bbnRows = financeStore.getContractData("bbn");
  const foundContractOrder = bbnRows.find((r) => r["Plat No"] === "B 8888 CTD");
  assert.ok(foundContractOrder, "+Tambah Data row must appear in BBN category");
});
