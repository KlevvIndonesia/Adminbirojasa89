/**
 * Order Correction Workflow Automated Tests (AC1 - AC6)
 * Admin SUN89 — Biro Jasa Management System
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { db } from "../server/src/database/db";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { dbOrderCorrectionRepository } from "../server/src/repositories/dbOrderCorrectionRepository";
import { orderService } from "../server/src/services/orderService";
import { financeStore } from "../src/app/data/financeStore";
import { OperationalOrder } from "../src/domain/order/types";
import { OrderCorrectionRecord } from "../server/src/database/schema";

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

interface LoginData {
  token: string;
}

function createServer(): Promise<{ server: http.Server; baseUrl: string }> {
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

async function getToken(baseUrl: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as ApiResponse<LoginData>;
  assert.strictEqual(res.status, 200, `Login failed for ${email}`);
  return data.data.token;
}

function cleanupTestOrder(orderNo: string): void {
  try {
    db.prepare("DELETE FROM invoice_payments WHERE order_no = ?").run(orderNo);
    db.prepare("DELETE FROM finance_invoices WHERE order_no = ?").run(orderNo);
    db.prepare("DELETE FROM order_corrections WHERE order_no = ?").run(orderNo);
    db.prepare("DELETE FROM orders WHERE order_no = ?").run(orderNo);
  } catch {
    // ignore cleanup errors
  }
}

function createTestOrder(prefix: string, totalAmount: number = 500000) {
  const timestamp = Date.now();
  const orderNo = `ORD-TEST-${prefix}-${timestamp}`;
  const nowStr = new Date().toISOString();

  const newOrder: OperationalOrder = {
    orderNo,
    customer: `Test Client ${prefix}`,
    namaPemilik: `Test Owner ${prefix}`,
    nomorHP: "08123456789",
    layanan: "Perpanjangan 1 Tahun",
    nopol: `B ${(timestamp % 8999) + 1000} TST`,
    wilayahSamsatAsal: "Jakarta Selatan",
    totalEstimasi: totalAmount,
    currentStep: 1,
    currentStageName: "Verifikasi",
    catatanOrder: "Order Uji Coba Koreksi",
    createdAt: nowStr,
    updatedAt: nowStr,
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Transfer BCA",
      statusPembayaran: "Belum Lunas",
      totalBiaya: totalAmount,
      dibayar: 0,
      kurang: totalAmount,
      isPaymentVerified: false,
      paymentRecords: [],
    },
  };

  dbOrderRepository.saveOrder(newOrder);

  const invoiceId = dbFinanceRepository.saveInvoice({
    invoiceNo: `INV-${orderNo}`,
    orderNo,
    nopol: newOrder.nopol,
    customer: newOrder.customer,
    totalTagihan: totalAmount,
    dibayar: 0,
    sisa: totalAmount,
    status: "UNPAID",
    billingStatus: "ACTIVE",
    tanggal: nowStr.split("T")[0],
  });
  const invoice = dbFinanceRepository.getInvoiceById(invoiceId)!;

  return { order: newOrder, invoice, orderNo };
}

test("AC1: Request koreksi pada order aktif berhasil -> status koreksi 'Diajukan', order belum berubah", async () => {
  const { server, baseUrl } = await createServer();
  let createdOrderNo = "";
  try {
    const adminToken = await getToken(baseUrl, "admin@birojasa.com", "admin123");
    const { orderNo } = createTestOrder("AC1");
    createdOrderNo = orderNo;

    const res = await fetch(`${baseUrl}/api/orders/${orderNo}/request-correction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: "DUPLIKAT_INPUT_ADMIN",
        linkedDuplicateOrderNo: "ORD-EXISTING-001",
        reason: "Admin salah input dua kali untuk berkas yang sama.",
      }),
    });

    assert.strictEqual(res.status, 201, "Harus mengembalikan status 201 Created");
    const json = (await res.json()) as ApiResponse<OrderCorrectionRecord>;
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.order_no, orderNo);
    assert.strictEqual(json.data.status, "Diajukan");
    assert.strictEqual(json.data.category, "DUPLIKAT_INPUT_ADMIN");
    assert.strictEqual(json.data.linked_duplicate_order_no, "ORD-EXISTING-001");

    // Invariant: Row exists in order_corrections with status 'Diajukan'
    const correctionRow = dbOrderCorrectionRepository.getById(json.data.id);
    assert.ok(correctionRow, "Baris order_corrections harus tersimpan di database");
    assert.strictEqual(correctionRow?.status, "Diajukan");

    // Invariant: Order is NOT yet cancelled and remains unchanged
    const orderInDb = dbOrderRepository.getByOrderNo(orderNo);
    assert.ok(orderInDb);
    assert.strictEqual(orderInDb.currentStageName, "Verifikasi");
    assert.strictEqual(Boolean((orderInDb as { isCancelled?: boolean }).isCancelled), false);
  } finally {
    if (createdOrderNo) cleanupTestOrder(createdOrderNo);
    server.close();
  }
});

test("AC2: Request koreksi pada order yang sudah 'Dibatalkan' atau sudah punya koreksi 'Diajukan' -> 400 Bad Request", async () => {
  const { server, baseUrl } = await createServer();
  let cancelledNo = "";
  let dupPendingNo = "";
  try {
    const adminToken = await getToken(baseUrl, "admin@birojasa.com", "admin123");

    // Sub-case A: Order is already cancelled
    const { orderNo: cancelledOrderNo } = createTestOrder("AC2-CANCELLED");
    cancelledNo = cancelledOrderNo;
    orderService.cancelOrder(cancelledOrderNo, "Order sudah dibatalkan manual");

    const resCancelled = await fetch(`${baseUrl}/api/orders/${cancelledOrderNo}/request-correction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: "DUPLIKAT_INPUT_ADMIN",
        reason: "Mencoba koreksi order yang sudah dibatalkan",
      }),
    });

    assert.strictEqual(resCancelled.status, 400, "Harus mengembalikan 400 jika order sudah dibatalkan");
    const jsonCancelled = (await resCancelled.json()) as ApiResponse<null>;
    assert.strictEqual(jsonCancelled.success, false);
    assert.strictEqual(jsonCancelled.error?.code, "ORDER_ALREADY_CANCELLED");

    // Sub-case B: Order already has pending correction
    const { orderNo: duplicatePendingOrderNo } = createTestOrder("AC2-DUP");
    dupPendingNo = duplicatePendingOrderNo;
    const firstReq = await fetch(`${baseUrl}/api/orders/${duplicatePendingOrderNo}/request-correction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: "DUPLIKAT_INPUT_ADMIN",
        reason: "Pengajuan pertama yang sah",
      }),
    });
    assert.strictEqual(firstReq.status, 201);

    // Second request while first is still 'Diajukan'
    const secondReq = await fetch(`${baseUrl}/api/orders/${duplicatePendingOrderNo}/request-correction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: "SALAH_NOMINAL",
        reason: "Pengajuan kedua ganda yang seharusnya ditolak",
      }),
    });

    assert.strictEqual(secondReq.status, 400, "Harus mengembalikan 400 jika sudah ada koreksi pending");
    const jsonSecond = (await secondReq.json()) as ApiResponse<null>;
    assert.strictEqual(jsonSecond.success, false);
    assert.strictEqual(jsonSecond.error?.code, "DUPLICATE_CORRECTION_REQUEST");
  } finally {
    if (cancelledNo) cleanupTestOrder(cancelledNo);
    if (dupPendingNo) cleanupTestOrder(dupPendingNo);
    server.close();
  }
});

test("AC3: Approve koreksi -> order jadi 'Dibatalkan', semua payment is_void=1, invoice CANCELLED dibayar=0 sisa=0, refundStatus BUKAN PENDING, status koreksi 'Disetujui'", async () => {
  const { server, baseUrl } = await createServer();
  let createdOrderNo = "";
  try {
    const adminToken = await getToken(baseUrl, "admin@birojasa.com", "admin123");
    const spvToken = await getToken(baseUrl, "svp@birojasa.com", "admin123");
    const { orderNo, invoice } = createTestOrder("AC3", 600000);
    createdOrderNo = orderNo;

    // Record an active payment of 600000 on this invoice
    dbFinanceRepository.recordInvoicePayment({
      invoiceNo: invoice.invoiceNo,
      orderNo: orderNo,
      nominal: 600000,
      metodePembayaran: "TRANSFER",
      tanggalBayar: new Date().toISOString().split("T")[0],
      catatan: "Setoran awal konsumen",
    });
    dbFinanceRepository.updateInvoice(invoice.id, {
      dibayar: 600000,
      sisa: 0,
      status: "PAID",
    });

    // Request correction
    const reqRes = await fetch(`${baseUrl}/api/orders/${orderNo}/request-correction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: "DUPLIKAT_INPUT_ADMIN",
        linkedDuplicateOrderNo: "ORD-REAL-001",
        reason: "Salah input data oleh admin baru",
      }),
    });
    assert.strictEqual(reqRes.status, 201);
    const reqJson = (await reqRes.json()) as ApiResponse<OrderCorrectionRecord>;
    const correctionId = reqJson.data.id;

    // Approve correction as SPV
    const reviewRes = await fetch(`${baseUrl}/api/order-corrections/${correctionId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${spvToken}`,
      },
      body: JSON.stringify({
        decision: "approve",
        reviewNotes: "Disetujui pembatalan order duplikat dan pembersihan pembayaran",
      }),
    });

    assert.strictEqual(reviewRes.status, 200, "Approval harus berhasil dengan status 200");
    const reviewJson = (await reviewRes.json()) as ApiResponse<OrderCorrectionRecord>;
    assert.strictEqual(reviewJson.success, true);
    assert.strictEqual(reviewJson.data.status, "Disetujui");
    assert.strictEqual(reviewJson.data.reviewed_by, "Admin Super (SVP)");

    // Invariant: Order is 'Dibatalkan' and isCancelled is true
    const updatedOrder = dbOrderRepository.getByOrderNo(orderNo);
    assert.ok(updatedOrder);
    assert.strictEqual(updatedOrder.currentStageName, "Dibatalkan");
    assert.strictEqual(Boolean((updatedOrder as { isCancelled?: boolean }).isCancelled), true);

    // Invariant: All payments linked to order have is_void = 1
    const payments = dbFinanceRepository.getPaymentsByOrderNo(orderNo) as Array<{ id: number; is_void: number; status_verifikasi: string }>;
    assert.ok(payments.length > 0);
    for (const p of payments) {
      assert.strictEqual(p.is_void, 1, `Payment #${p.id} harus memiliki is_void = 1`);
      assert.strictEqual(p.status_verifikasi, "VOID");
    }

    // Invariant: Finance invoice has status CANCELLED, dibayar=0, sisa=0, refundStatus != 'PENDING'
    const updatedInvoice = dbFinanceRepository.getInvoiceById(invoice.id);
    assert.ok(updatedInvoice);
    assert.strictEqual(updatedInvoice.status, "CANCELLED");
    assert.strictEqual(Number(updatedInvoice.dibayar || 0), 0);
    assert.strictEqual(Number(updatedInvoice.sisa || 0), 0);
    assert.notStrictEqual(updatedInvoice.refundStatus, "PENDING", "refundStatus TIDAK BOLEH bernilai PENDING");
  } finally {
    if (createdOrderNo) cleanupTestOrder(createdOrderNo);
    server.close();
  }
});

test("AC4: Reject koreksi -> status koreksi 'Ditolak', order dan payment TIDAK tersentuh sama sekali", async () => {
  const { server, baseUrl } = await createServer();
  let createdOrderNo = "";
  try {
    const adminToken = await getToken(baseUrl, "admin@birojasa.com", "admin123");
    const spvToken = await getToken(baseUrl, "svp@birojasa.com", "admin123");
    const { orderNo, invoice } = createTestOrder("AC4", 750000);
    createdOrderNo = orderNo;

    // Record an active payment
    const payment = dbFinanceRepository.recordInvoicePayment({
      invoiceNo: invoice.invoiceNo,
      orderNo: orderNo,
      nominal: 300000,
      metodePembayaran: "TRANSFER",
      tanggalBayar: new Date().toISOString().split("T")[0],
      catatan: "DP Konsumen",
    }) as { id: number };
    dbFinanceRepository.updateInvoice(invoice.id, {
      dibayar: 300000,
      sisa: 450000,
      status: "PARTIAL",
    });

    // Request correction
    const reqRes = await fetch(`${baseUrl}/api/orders/${orderNo}/request-correction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: "SALAH_NOMINAL",
        reason: "Pengajuan koreksi yang keliru",
      }),
    });
    assert.strictEqual(reqRes.status, 201);
    const reqJson = (await reqRes.json()) as ApiResponse<OrderCorrectionRecord>;
    const correctionId = reqJson.data.id;

    // Snapshot full state before reject
    const orderBefore = dbOrderRepository.getByOrderNo(orderNo)!;
    const invoiceBefore = dbFinanceRepository.getInvoiceById(invoice.id)!;
    const paymentBefore = dbFinanceRepository.getInvoicePaymentById(payment.id) as { is_void?: number; status_verifikasi?: string; nominal?: number };

    // Reject correction as SPV
    const reviewRes = await fetch(`${baseUrl}/api/order-corrections/${correctionId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${spvToken}`,
      },
      body: JSON.stringify({
        decision: "reject",
        reviewNotes: "Ditolak: data order sah dan bukan duplikat",
      }),
    });

    assert.strictEqual(reviewRes.status, 200);
    const reviewJson = (await reviewRes.json()) as ApiResponse<OrderCorrectionRecord>;
    assert.strictEqual(reviewJson.success, true);
    assert.strictEqual(reviewJson.data.status, "Ditolak");

    // Full snapshot comparison of Order before vs after reject
    const orderAfter = dbOrderRepository.getByOrderNo(orderNo)!;
    assert.strictEqual(orderAfter.orderNo, orderBefore.orderNo);
    assert.strictEqual(orderAfter.currentStageName, orderBefore.currentStageName);
    assert.strictEqual(orderAfter.currentStep, orderBefore.currentStep);
    assert.strictEqual(orderAfter.customer, orderBefore.customer);
    assert.strictEqual(orderAfter.namaPemilik, orderBefore.namaPemilik);
    assert.strictEqual(orderAfter.nopol, orderBefore.nopol);
    assert.strictEqual(orderAfter.layanan, orderBefore.layanan);
    assert.strictEqual(orderAfter.totalEstimasi, orderBefore.totalEstimasi);
    assert.strictEqual((orderAfter as { isCancelled?: boolean }).isCancelled, (orderBefore as { isCancelled?: boolean }).isCancelled);
    assert.strictEqual((orderAfter as { status?: string }).status, (orderBefore as { status?: string }).status);
    assert.strictEqual(orderAfter.catatanOrder, orderBefore.catatanOrder);
    assert.deepStrictEqual(orderAfter.payment, orderBefore.payment, "Seluruh field payment order harus identik snapshot penuh sebelum dan sesudah reject");

    // Full snapshot comparison of Invoice before vs after reject
    const invoiceAfter = dbFinanceRepository.getInvoiceById(invoice.id)!;
    assert.strictEqual(invoiceAfter.status, invoiceBefore.status);
    assert.strictEqual(invoiceAfter.dibayar, invoiceBefore.dibayar);
    assert.strictEqual(invoiceAfter.sisa, invoiceBefore.sisa);
    assert.strictEqual(invoiceAfter.totalTagihan, invoiceBefore.totalTagihan);

    // Full snapshot comparison of Payment before vs after reject
    const paymentAfter = dbFinanceRepository.getInvoicePaymentById(payment.id) as { is_void?: number; status_verifikasi?: string; nominal?: number };
    assert.strictEqual(paymentAfter.is_void, paymentBefore.is_void);
    assert.strictEqual(paymentAfter.status_verifikasi, paymentBefore.status_verifikasi);
    assert.strictEqual(paymentAfter.nominal, paymentBefore.nominal);
  } finally {
    if (createdOrderNo) cleanupTestOrder(createdOrderNo);
    server.close();
  }
});

test("AC5: User non-SPV/Admin mencoba memanggil endpoint review -> 403 Forbidden", async () => {
  const { server, baseUrl } = await createServer();
  let createdOrderNo = "";
  try {
    const adminToken = await getToken(baseUrl, "admin@birojasa.com", "admin123");
    const messengerToken = await getToken(baseUrl, "budi.messenger@birojasa.com", "messenger123");
    const { orderNo } = createTestOrder("AC5");
    createdOrderNo = orderNo;

    // Request correction
    const reqRes = await fetch(`${baseUrl}/api/orders/${orderNo}/request-correction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: "DUPLIKAT_INPUT_ADMIN",
        reason: "Pengajuan koreksi untuk uji hak akses non-SPV",
      }),
    });
    assert.strictEqual(reqRes.status, 201);
    const reqJson = (await reqRes.json()) as ApiResponse<OrderCorrectionRecord>;
    const correctionId = reqJson.data.id;

    // Messenger attempts to call review endpoint
    const reviewRes = await fetch(`${baseUrl}/api/order-corrections/${correctionId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({
        decision: "approve",
        reviewNotes: "Mencoba approve sebagai kurir",
      }),
    });

    assert.strictEqual(reviewRes.status, 403, "Kurir/Non-SPV harus menerima 403 Forbidden");
    const reviewJson = (await reviewRes.json()) as ApiResponse<null>;
    assert.strictEqual(reviewJson.success, false);
    assert.strictEqual(reviewJson.error?.code, "FORBIDDEN");

    // Invariant: Correction status remains 'Diajukan'
    const correction = dbOrderCorrectionRepository.getById(correctionId);
    assert.strictEqual(correction?.status, "Diajukan");
  } finally {
    if (createdOrderNo) cleanupTestOrder(createdOrderNo);
    server.close();
  }
});

test("AC6: Setelah AC3 selesai, order TIDAK muncul di getCashbackPendingList() / tab Cashback Terpending", async () => {
  const { server, baseUrl } = await createServer();
  let createdOrderNo = "";
  try {
    const adminToken = await getToken(baseUrl, "admin@birojasa.com", "admin123");
    const spvToken = await getToken(baseUrl, "svp@birojasa.com", "admin123");
    const { orderNo, invoice } = createTestOrder("AC6", 800000);
    createdOrderNo = orderNo;

    // Record an active payment
    dbFinanceRepository.recordInvoicePayment({
      invoiceNo: invoice.invoiceNo,
      orderNo: orderNo,
      nominal: 800000,
      metodePembayaran: "TRANSFER",
      tanggalBayar: new Date().toISOString().split("T")[0],
      catatan: "Setoran order duplikat",
    });
    dbFinanceRepository.updateInvoice(invoice.id, {
      dibayar: 800000,
      sisa: 0,
      status: "PAID",
    });

    // Request correction
    const reqRes = await fetch(`${baseUrl}/api/orders/${orderNo}/request-correction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: "DUPLIKAT_INPUT_ADMIN",
        reason: "Order duplikat harus dibersihkan tanpa meninggalkan jejak cashback",
      }),
    });
    assert.strictEqual(reqRes.status, 201);
    const reqJson = (await reqRes.json()) as ApiResponse<OrderCorrectionRecord>;
    const correctionId = reqJson.data.id;

    // Approve correction as SPV
    const reviewRes = await fetch(`${baseUrl}/api/order-corrections/${correctionId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${spvToken}`,
      },
      body: JSON.stringify({
        decision: "approve",
        reviewNotes: "Approved",
      }),
    });
    assert.strictEqual(reviewRes.status, 200);

    // Sync financeStore and verify Cashback Terpending list
    financeStore.syncFromRepository();
    const cashbackPendingList = financeStore.getCashbackPendingList();

    const foundInCashback = cashbackPendingList.some(
      (item: { orderNo?: string; invoice?: string }) => item.orderNo === orderNo || item.invoice === invoice.invoiceNo
    );

    assert.strictEqual(
      foundInCashback,
      false,
      `Order ${orderNo} TIDAK BOLEH muncul di getCashbackPendingList()`
    );
  } finally {
    if (createdOrderNo) cleanupTestOrder(createdOrderNo);
    server.close();
  }
});
