/**
 * Financial Action Feedback, Error Classification, Non-Optimistic API & Express HTTP Integration Suite
 * Admin SUN89 — Biro Jasa Management System
 *
 * Covers the 4 Addendum Financial Categories inside FinanceContent:
 * 1. Cashback Pending (gated/waiting approval)
 * 2. Cashback Belum Dibayar (ready disbursement, Edit in-place, Void SPV/Admin, Selesai)
 * 3. Belum Bayar (unpaid invoice payment flow, gating, validation, idempotency, unconfirmed timeout)
 * 4. Kurang Bayar (partial/full installment settlement, history load error, kwitansi flow)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/src/app";
import { db } from "../server/src/database/db";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { generateToken } from "../server/src/utils/crypto";
import { ApiFinanceProvider } from "../src/data/api/apiFinanceProvider";
import { FinanceRepository } from "../src/data/repositories/financeRepository";
import type { InvoiceBillingRecord } from "../src/domain/finance/types";
import {
  ActionApiError,
  classifyActionError,
  parseApiErrorResponse,
  sanitizeActionMessage,
} from "../src/app/utils/actionErrorClassifier";
import {
  reduceActionFailure,
  reduceActionStart,
  reduceActionSuccess,
  type ActionStateMap,
} from "../src/app/hooks/useActionFeedback";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

interface GlobalShim {
  window?: unknown;
  localStorage?: unknown;
  sessionStorage?: unknown;
}

const g = globalThis as unknown as GlobalShim;

function setupMockBrowserStorage() {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const prevWindow = g.window;
  const prevLocal = g.localStorage;
  const prevSession = g.sessionStorage;

  local.setItem("auth_token", "test-finance-token");
  g.localStorage = local;
  g.sessionStorage = session;
  g.window = {
    localStorage: local,
    sessionStorage: session,
    dispatchEvent: () => true,
  };

  return {
    local,
    session,
    restore() {
      if (prevWindow === undefined) delete g.window;
      else g.window = prevWindow;
      if (prevLocal === undefined) delete g.localStorage;
      else g.localStorage = prevLocal;
      if (prevSession === undefined) delete g.sessionStorage;
      else g.sessionStorage = prevSession;
    },
  };
}

interface ApiJsonEnvelope {
  success?: boolean;
  data?: {
    refundStatus?: string;
    payoutVersion?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

function seedOrderAndInvoice(opts: {
  orderNo: string;
  customer: string;
  nopol: string;
  total: number;
  paid: number;
  status: InvoiceBillingRecord["status"];
  hasFinalCost: boolean;
  isSupervisiApproved: boolean;
  costCompletenessStatus?: string;
  isCostVerified?: boolean;
}) {
  const remaining = Math.max(0, opts.total - opts.paid);
  const overpayment = Math.max(0, opts.paid - opts.total);
  const currentStep = opts.isSupervisiApproved ? 7 : opts.hasFinalCost ? 6 : 4;

  const costStatus = opts.costCompletenessStatus || "COMPLETE";
  const costVerifiedNum = opts.isCostVerified === false ? 0 : 1;

  db.prepare(
    `INSERT INTO orders (
      order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name,
      payment_status, total_biaya, cost_completeness_status, is_cost_verified, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    opts.orderNo,
    opts.customer,
    "081234567890",
    "Balik Nama & Pajak",
    opts.nopol,
    currentStep,
    opts.isSupervisiApproved ? "Penyerahan Dokumen" : "Samsat & Keuangan",
    opts.status,
    opts.total,
    costStatus,
    costVerifiedNum,
    JSON.stringify({
      orderNo: opts.orderNo,
      customer: opts.customer,
      nopol: opts.nopol,
      currentStep,
      currentStageName: opts.isSupervisiApproved ? "Penyerahan Dokumen" : "Samsat & Keuangan",
      isVerified: opts.hasFinalCost,
      finalCost: opts.hasFinalCost ? Math.max(100000, opts.total - 100000) : 0,
      approvedBySpv: opts.isSupervisiApproved ? "SPV Tester" : "",
      cost_completeness_status: opts.costCompletenessStatus || "COMPLETE",
      is_cost_verified: opts.isCostVerified ?? true,
      costSnapshot: {
        completenessStatus: opts.costCompletenessStatus || "COMPLETE",
      },
      documentApproval: {
        stage5Verified: opts.hasFinalCost,
        stage6Approved: opts.isSupervisiApproved,
      },
      payment: {
        totalBiaya: opts.total,
        dibayar: opts.paid,
        kurang: remaining,
        overpayment,
        statusPembayaran: opts.status,
        paymentRecords: [],
      },
    })
  );

  const invoiceId = dbFinanceRepository.saveInvoice({
    invoiceNo: `INV-${opts.orderNo}`,
    orderNo: opts.orderNo,
    customer: opts.customer,
    layanan: "Balik Nama & Pajak",
    nopol: opts.nopol,
    totalTagihan: opts.total,
    terbayar: opts.paid,
    dibayar: opts.paid,
    sisa: remaining,
    overpayment,
    refundLiability: overpayment,
    refundStatus: overpayment > 0 ? "PENDING" : "NONE",
    status: opts.status,
    payoutHistory: [],
    payoutVersion: 0,
  });

  return { orderNo: opts.orderNo, invoiceNo: `INV-${opts.orderNo}`, invoiceId, remaining, overpayment };
}

test("actionErrorClassifier: classifies all backend financial domain codes & sanitizes leaks", () => {
  const businessCodes = [
    "INVOICE_ALREADY_PAID",
    "INVOICE_NOT_PAID",
    "FINAL_COST_NOT_SET",
    "SUPERVISI_NOT_APPROVED",
    "COST_VERIFICATION_REQUIRED",
    "PAYMENT_METHOD_INACTIVE",
    "ALREADY_PROCESSED",
    "CASHBACK_NOT_PROCESSED",
    "AMBIGUOUS_PAYOUT_TYPE",
    "INVALID_NOMINAL",
    "EXCEEDS_LIMIT",
    "ALREADY_VOIDED",
    "PAYMENT_ALREADY_VOIDED",
    "INSUFFICIENT_OFFICE_BALANCE",
    "INSUFFICIENT_MESSENGER_BALANCE",
  ];

  for (const rawCode of businessCodes) {
    const classified = classifyActionError({
      statusCode: 400,
      errorCode: rawCode,
      message: `Pelanggaran aturan ${rawCode}`,
    });
    assert.strictEqual(
      classified.code,
      "BUSINESS_RULE_VIOLATION",
      `Expected ${rawCode} to map to BUSINESS_RULE_VIOLATION, got ${classified.code}`
    );
    assert.strictEqual(classified.isRetryable, false);
  }

  const notFound = classifyActionError({ statusCode: 404, errorCode: "INVOICE_NOT_FOUND", message: "Invoice #99 tidak ditemukan" });
  assert.strictEqual(notFound.code, "NOT_FOUND");
  assert.strictEqual(notFound.isRetryable, false);

  const conflict = classifyActionError({ statusCode: 409, errorCode: "CONCURRENT_MODIFICATION", message: "Data invoice telah berubah" });
  assert.strictEqual(conflict.code, "CONFLICT");
  assert.strictEqual(conflict.isRetryable, false);

  const idempConflict = classifyActionError({ statusCode: 409, code: "IDEMPOTENCY_CONFLICT", message: "Payload berbeda" });
  assert.strictEqual(idempConflict.code, "IDEMPOTENCY_CONFLICT");
  assert.strictEqual(idempConflict.isRetryable, true);

  const sanitized = sanitizeActionMessage(
    "SQLITE_CONSTRAINT: UNIQUE constraint failed: finance_invoices.invoice_no\n at D:\\Admin\\adminsunbirojasa\\server\\index.ts:12"
  );
  assert.strictEqual(sanitized, "Nomor invoice sudah digunakan oleh transaksi lain.");
  assert.ok(!sanitized.includes("SQLITE"));
  assert.ok(!sanitized.includes("D:\\Admin"));
});

test("actionErrorClassifier: parseApiErrorResponse respects 408/429/500 & SQL masking", async () => {
  const res500 = new Response(
    JSON.stringify({ success: false, error: { code: "DB_CRASH", message: "SELECT * FROM kas_kantor WHERE id = 1" } }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
  const err500 = await parseApiErrorResponse(res500, "Gagal mencairkan cashback");
  assert.strictEqual(err500.statusCode, 500);
  assert.strictEqual(classifyActionError(err500).code, "INTERNAL_SERVER_ERROR");
  assert.ok(!err500.message.includes("SELECT * FROM"));

  const res409 = new Response(
    JSON.stringify({
      success: false,
      error: {
        code: "CONCURRENT_MODIFICATION",
        message: "Data invoice telah diperbarui oleh transaksi lain",
      },
    }),
    { status: 409, headers: { "Content-Type": "application/json" } }
  );
  const err409 = await parseApiErrorResponse(res409);
  assert.strictEqual(err409.statusCode, 409);
  assert.strictEqual(err409.code, "CONCURRENT_MODIFICATION");
});

test("useActionFeedback reducers: isolates finance modal states cleanly", () => {
  let state: ActionStateMap = {};
  state = reduceActionFailure(
    state,
    "finance-lunas-proof",
    classifyActionError({ statusCode: 400, code: "VALIDATION_ERROR", message: "File melebihi 5MB" })
  );
  state = reduceActionStart(state, "finance-lunas-submit");
  assert.strictEqual(state["finance-lunas-submit"].loading, true);
  assert.strictEqual(state["finance-lunas-proof"].error?.code, "VALIDATION_ERROR", "Proof error stays visible while submitting");

  state = reduceActionSuccess(state, "finance-lunas-submit", ["finance-lunas-"]);
  assert.strictEqual(state["finance-lunas-submit"].error, null);
  assert.strictEqual(state["finance-lunas-proof"].error, null);
});

test("ApiFinanceProvider: zero optimistic mutation & preserves state across failures, timeout, and secondary kas refresh error", async () => {
  const storage = setupMockBrowserStorage();
  const origFetch = globalThis.fetch;

  try {
    let fetchCalls = 0;
    let initResolveDone = false;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      fetchCalls++;

      if (url.endsWith("/finance/invoices") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: 501,
                invoiceNo: "INV-2026-501",
                orderNo: "ORD-501",
                customer: "PT Maju Mundur",
                nopol: "B 501 FIN",
                layanan: "Perpanjangan STNK",
                totalTagihan: 1000000,
                dibayar: 400000,
                sisa: 600000,
                status: "Kurang Bayar",
                overpayment: 0,
              },
              {
                id: 502,
                invoiceNo: "INV-2026-502",
                orderNo: "ORD-502",
                customer: "Ibu Sari",
                nopol: "B 502 CBK",
                layanan: "Mutasi Keluar",
                totalTagihan: 800000,
                dibayar: 1000000,
                sisa: 0,
                overpayment: 200000,
                refundLiability: 200000,
                refundedAmount: 0,
                remainingRefund: 200000,
                refundStatus: "PENDING",
                payoutHistory: [{ id: "p-old", status: "VOIDED", nominal: 200000 }],
                payoutVersion: 1,
                alasanPending: "Salah transfer ganda",
                status: "OVERPAID",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/finance/kas-kantor") && !init?.method) {
        if (initResolveDone) {
          throw new TypeError("Secondary kas-kantor refresh failed");
        }
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      }
      if (url.endsWith("/finance/pengeluaran") || url.endsWith("/finance/kas-messenger")) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      }

      if (url.endsWith("/finance/invoices/501/pay")) {
        // Assert provider state was NOT mutated optimistically before HTTP finishes
        const preInv = provider.getInvoiceById(501);
        assert.strictEqual(preInv?.terbayar, 400000, "Must NOT mutate terbayar optimistically before server response");
        assert.strictEqual(preInv?.sisa, 600000, "Must NOT mutate sisa optimistically before server response");

        const hdrs = init?.headers as Record<string, string>;
        assert.strictEqual(hdrs["Idempotency-Key"], "key-pay-501-fixed");

        if (fetchCalls % 2 === 1) {
          return new Response(
            JSON.stringify({
              success: false,
              error: { code: "SUPERVISI_NOT_APPROVED", message: "Belum disetujui Supervisi" },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: 501,
              invoiceNo: "INV-2026-501",
              orderNo: "ORD-501",
              customer: "PT Maju Mundur",
              nopol: "B 501 FIN",
              totalTagihan: 1000000,
              dibayar: 1000000,
              sisa: 0,
              status: "Lunas",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/finance/invoices/502/cashback-payout")) {
        const body = JSON.parse(String(init?.body || "{}"));
        if (body.idempotencyKey === "trigger-timeout") {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const e = new Error("Aborted");
              e.name = "AbortError";
              reject(e);
            });
            setTimeout(() => {
              const e = new Error("Network down");
              reject(e);
            }, 20);
          });
        }

        if (body.idempotencyKey === "trigger-stale") {
          return new Response(
            JSON.stringify({
              success: false,
              error: { code: "CONCURRENT_MODIFICATION", message: "Versi invoice berubah" },
            }),
            { status: 409, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: 502,
              invoiceNo: "INV-2026-502",
              orderNo: "ORD-502",
              customer: "Ibu Sari",
              totalTagihan: 800000,
              dibayar: 1000000,
              sisa: 0,
              overpayment: 200000,
              refundLiability: 200000,
              refundedAmount: 200000,
              remainingRefund: 0,
              refundStatus: "PROCESSED",
              payoutVersion: 2,
              payoutHistory: [{ id: "p-new", status: "PROCESSED", nominal: 200000 }],
              status: "OVERPAID",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/finance/invoices/502/cashback-payout/void")) {
        return new Response(
          JSON.stringify({ success: false, error: { code: "FORBIDDEN", message: "Hanya Supervisor yang berwenang" } }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/finance/invoices/501/payments/10/void")) {
        return new Response(
          JSON.stringify({ success: false, error: { code: "FORBIDDEN", message: "Hanya Supervisor yang dapat void pembayaran." } }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/finance/audit/void-history")) {
        return new Response(
          JSON.stringify({ success: true, data: { payments: [{ id: 10 }], cashbacks: [{ id: "cb-1" }] } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ success: false }), { status: 404 });
    };

    const provider = new ApiFinanceProvider("http://127.0.0.1:3999/api");
    await provider.initFromApi();
    initResolveDone = true;

    const inv502 = provider.getInvoiceById(502);
    assert.strictEqual(inv502?.payoutVersion, 1, "normalizeInvoice must preserve payoutVersion");
    assert.strictEqual(inv502?.remainingRefund, 200000, "normalizeInvoice must preserve remainingRefund");
    assert.strictEqual(inv502?.alasanPending, "Salah transfer ganda", "normalizeInvoice must preserve alasanPending");

    // 1. Rejection on recordPayment preserves original unpaid/underpaid cache
    fetchCalls = 0;
    await assert.rejects(
      () => provider.recordPayment(501, 600000, { idempotencyKey: "key-pay-501-fixed" }),
      (err: unknown) => err instanceof ActionApiError && err.code === "SUPERVISI_NOT_APPROVED"
    );
    assert.strictEqual(provider.getInvoiceById(501)?.terbayar, 400000);
    assert.strictEqual(provider.getInvoiceById(501)?.sisa, 600000);

    // 2. Confirmed 200 updates cache after response
    const paidOk = await provider.recordPayment(501, 600000, { idempotencyKey: "key-pay-501-fixed" });
    assert.strictEqual(paidOk, true);
    assert.strictEqual(provider.getInvoiceById(501)?.terbayar, 1000000);
    assert.strictEqual(provider.getInvoiceById(501)?.sisa, 0);

    // 3. Network drop on payoutCashback sets isDefinitive = false so UNKNOWN_OUTCOME keeps key
    await assert.rejects(
      () => provider.payoutCashback(502, { nominal: 200000, expectedVersion: 1, idempotencyKey: "trigger-timeout" }),
      (err: unknown) => (err as { isDefinitive?: boolean }).isDefinitive === false
    );
    assert.strictEqual(provider.getInvoiceById(502)?.refundStatus, "PENDING");

    // 4. 409 CONCURRENT_MODIFICATION sets isDefinitive = true and preserves cache
    await assert.rejects(
      () => provider.payoutCashback(502, { nominal: 200000, expectedVersion: 0, idempotencyKey: "trigger-stale" }),
      (err: unknown) => {
        const e = err as { statusCode?: number; errorCode?: string; isDefinitive?: boolean };
        return e.statusCode === 409 && e.errorCode === "CONCURRENT_MODIFICATION" && e.isDefinitive === true;
      }
    );
    assert.strictEqual(provider.getInvoiceById(502)?.refundStatus, "PENDING");

    // 5. Committed HTTP 200 payout succeeds EVEN when secondary /kas-kantor refresh throws
    const payoutOk = await provider.payoutCashback(502, {
      nominal: 200000,
      expectedVersion: 1,
      idempotencyKey: "valid-key-502",
    });
    assert.strictEqual(payoutOk, true, "Secondary kas-kantor error must never mask committed payout");
    assert.strictEqual(provider.getInvoiceById(502)?.refundStatus, "PROCESSED");
    assert.strictEqual(provider.getInvoiceById(502)?.payoutVersion, 2);

    // 6. 403 on voidCashbackPayout rejects with FORBIDDEN without corrupting cache
    await assert.rejects(
      () => provider.voidCashbackPayout(502, "Kesalahan transfer tujuan"),
      (err: unknown) => err instanceof ActionApiError && err.statusCode === 403 && err.code === "FORBIDDEN"
    );
    assert.strictEqual(provider.getInvoiceById(502)?.refundStatus, "PROCESSED");

    // 7. FinanceRepository forwards voidCashbackPayout, voidInvoicePayment, and getVoidAuditHistory to provider & propagates rejections
    const repo = new FinanceRepository(provider);
    assert.strictEqual(typeof repo.voidCashbackPayout, "function");
    assert.strictEqual(typeof repo.voidInvoicePayment, "function");
    assert.strictEqual(typeof repo.getVoidAuditHistory, "function");
    await assert.rejects(
      () => repo.voidCashbackPayout(502, "Kesalahan transfer tujuan"),
      (err: unknown) => err instanceof ActionApiError && err.statusCode === 403 && err.code === "FORBIDDEN"
    );
    await assert.rejects(
      () => repo.voidInvoicePayment(501, 10, "Pembatalan pembayaran tidak sah"),
      (err: unknown) => err instanceof ActionApiError && err.statusCode === 403 && err.code === "FORBIDDEN"
    );
    const voidAudit = await repo.getVoidAuditHistory();
    assert.strictEqual(voidAudit.payments.length, 1);
    assert.strictEqual(voidAudit.cashbacks.length, 1);
  } finally {
    globalThis.fetch = origFetch;
    storage.restore();
  }
});

test("HTTP Integration: All 4 financial categories (Belum Bayar, Kurang Bayar, Cashback Pending, Cashback Belum Dibayar)", async (t) => {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  t.after(() => server.close());

  const insertTestUser = db.prepare(
    `INSERT INTO users (email, password_hash, password_salt, nama, jabatan, role, status)
     VALUES (?, 'test-hash', 'test-salt', ?, ?, ?, 'Aktif')`
  );
  const admRowId = Number(insertTestUser.run("adm-fin-int@test.local", "Admin Finance Integration", "ADMINISTRATOR", "administrator").lastInsertRowid);
  const finRowId = Number(insertTestUser.run("fin-int@test.local", "Staff Finance", "FINANCE", "finance").lastInsertRowid);
  const spvRowId = Number(insertTestUser.run("spv-fin-int@test.local", "Supervisor Finance", "SUPERVISOR", "supervisor").lastInsertRowid);
  const msgRowId = Number(insertTestUser.run("msg-fin-int@test.local", "Kurir Lapangan", "MESSENGER", "messenger").lastInsertRowid);

  const adminToken = generateToken({
    userId: `usr-${admRowId}`,
    email: "adm-fin-int@test.local",
    nama: "Admin Finance Integration",
    jabatan: "ADMINISTRATOR",
    role: "administrator",
  });
  const financeToken = generateToken({
    userId: `usr-${finRowId}`,
    email: "fin-int@test.local",
    nama: "Staff Finance",
    jabatan: "FINANCE",
    role: "finance",
  });
  const spvToken = generateToken({
    userId: `usr-${spvRowId}`,
    email: "spv-fin-int@test.local",
    nama: "Supervisor Finance",
    jabatan: "SUPERVISOR",
    role: "supervisor",
  });
  const messengerToken = generateToken({
    userId: `usr-${msgRowId}`,
    email: "msg-fin-int@test.local",
    nama: "Kurir Lapangan",
    jabatan: "MESSENGER",
    role: "messenger",
  });

  async function apiCall(token: string, urlPath: string, method: string, body?: unknown, headers?: Record<string, string>) {
    return fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  // Seed invoices for all 4 financial categories
  const belumGatedCost = seedOrderAndInvoice({
    orderNo: "ORD-FIN-GATED-COST",
    customer: "Budi Gated Cost",
    nopol: "B 1001 GAT",
    total: 500000,
    paid: 0,
    status: "Belum Bayar",
    hasFinalCost: false,
    isSupervisiApproved: false,
  });

  const belumGatedSpv = seedOrderAndInvoice({
    orderNo: "ORD-FIN-GATED-SPV",
    customer: "Siti Gated SPV",
    nopol: "B 1002 SPV",
    total: 500000,
    paid: 0,
    status: "Belum Bayar",
    hasFinalCost: true,
    isSupervisiApproved: false,
  });

  const belumPartialEst = seedOrderAndInvoice({
    orderNo: "ORD-FIN-EST",
    customer: "Andi Estimasi",
    nopol: "B 1003 EST",
    total: 600000,
    paid: 0,
    status: "Belum Bayar",
    hasFinalCost: true,
    isSupervisiApproved: true,
    costCompletenessStatus: "PARTIAL_ESTIMATE",
    isCostVerified: false,
  });

  const kurangBayarInv = seedOrderAndInvoice({
    orderNo: "ORD-FIN-KURANG",
    customer: "Rina Kurang Bayar",
    nopol: "B 2001 KRG",
    total: 1000000,
    paid: 400000,
    status: "Kurang Bayar",
    hasFinalCost: true,
    isSupervisiApproved: true,
  });

  const lunasInv = seedOrderAndInvoice({
    orderNo: "ORD-FIN-LUNAS",
    customer: "Tono Sudah Lunas",
    nopol: "B 2002 LNS",
    total: 500000,
    paid: 500000,
    status: "Lunas",
    hasFinalCost: true,
    isSupervisiApproved: true,
  });

  const cashbackPendingGated = seedOrderAndInvoice({
    orderNo: "ORD-CB-PENDING-GATE",
    customer: "Dewi Cashback Gated",
    nopol: "B 3001 PND",
    total: 500000,
    paid: 750000,
    status: "OVERPAID",
    hasFinalCost: true,
    isSupervisiApproved: false,
  });

  const cashbackReady = seedOrderAndInvoice({
    orderNo: "ORD-CB-READY",
    customer: "Hendra Cashback Ready",
    nopol: "B 3002 RDY",
    total: 600000,
    paid: 850000,
    status: "OVERPAID",
    hasFinalCost: true,
    isSupervisiApproved: true,
  });

  await t.test("Category Belum Bayar & Kurang Bayar: gating, role checks, 404, already paid, idempotency", async () => {
    // Unauthenticated -> 401
    const unauth = await apiCall("", `/finance/invoices/${kurangBayarInv.invoiceId}/pay`, "POST", { amount: 100000 });
    assert.strictEqual(unauth.status, 401);

    // Forbidden role -> 403
    const forbidden = await apiCall(messengerToken, `/finance/invoices/${kurangBayarInv.invoiceId}/pay`, "POST", { amount: 100000 });
    assert.strictEqual(forbidden.status, 403);

    // Missing invoice -> 404 INVOICE_NOT_FOUND
    const notFoundRes = await apiCall(financeToken, `/finance/invoices/999999/pay`, "POST", { amount: 100000 });
    assert.strictEqual(notFoundRes.status, 404);
    const notFoundErr = await parseApiErrorResponse(notFoundRes);
    assert.strictEqual(notFoundErr.code, "INVOICE_NOT_FOUND");

    // Gated: Final cost not set -> FINAL_COST_NOT_SET
    const noCostRes = await apiCall(financeToken, `/finance/invoices/${belumGatedCost.invoiceId}/pay`, "POST", { amount: 500000 });
    assert.strictEqual(noCostRes.status, 400);
    const noCostPayload = (await noCostRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(noCostPayload.error?.code, "FINAL_COST_NOT_SET");
    assert.strictEqual(classifyActionError(noCostPayload).code, "BUSINESS_RULE_VIOLATION");

    // Gated: Supervisi not approved -> SUPERVISI_NOT_APPROVED
    const noSpvRes = await apiCall(financeToken, `/finance/invoices/${belumGatedSpv.invoiceId}/pay`, "POST", { amount: 500000 });
    assert.strictEqual(noSpvRes.status, 400);
    const noSpvPayload = (await noSpvRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(noSpvPayload.error?.code, "SUPERVISI_NOT_APPROVED");
    assert.strictEqual(classifyActionError(noSpvPayload).code, "BUSINESS_RULE_VIOLATION");

    // Gated: Partial estimate -> COST_VERIFICATION_REQUIRED
    const estRes = await apiCall(financeToken, `/finance/invoices/${belumPartialEst.invoiceId}/pay`, "POST", { amount: 600000 });
    assert.strictEqual(estRes.status, 400);
    const estPayload = (await estRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(estPayload.error?.code, "COST_VERIFICATION_REQUIRED");
    assert.strictEqual(classifyActionError(estPayload).code, "BUSINESS_RULE_VIOLATION");

    // Already paid -> INVOICE_ALREADY_PAID
    const paidRes = await apiCall(financeToken, `/finance/invoices/${lunasInv.invoiceId}/pay`, "POST", { amount: 100000 });
    assert.strictEqual(paidRes.status, 400);
    const paidPayload = (await paidRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(paidPayload.error?.code, "INVOICE_ALREADY_PAID");
    assert.strictEqual(classifyActionError(paidPayload).code, "BUSINESS_RULE_VIOLATION");

    // Kurang Bayar partial installment -> 200 + idempotency replay + 409 IDEMPOTENCY_CONFLICT
    const key = "pay-kurang-key-1";
    const ok1 = await apiCall(
      financeToken,
      `/finance/invoices/${kurangBayarInv.invoiceId}/pay`,
      "POST",
      {
        amount: 300000,
        details: {
          metodePembayaran: "Transfer BCA",
          idempotencyKey: key,
          catatan: "Cicilan termin 2",
        },
      },
      { "Idempotency-Key": key }
    );
    assert.strictEqual(ok1.status, 200);

    // Same key & amount -> safe replay, only 1 payment row added
    const okReplay = await apiCall(
      financeToken,
      `/finance/invoices/${kurangBayarInv.invoiceId}/pay`,
      "POST",
      { amount: 300000, details: { metodePembayaran: "Transfer BCA", idempotencyKey: key } },
      { "Idempotency-Key": key }
    );
    assert.strictEqual(okReplay.status, 200);

    const paymentsCountRow = db
      .prepare("SELECT COUNT(*) as cnt FROM invoice_payments WHERE invoice_no = ?")
      .get(kurangBayarInv.invoiceNo) as { cnt: number };
    assert.strictEqual(paymentsCountRow.cnt, 1, "Idempotent retry must NOT duplicate invoice_payments rows");

    // Reused key with different amount -> 409 IDEMPOTENCY_CONFLICT
    const conflictRes = await apiCall(
      financeToken,
      `/finance/invoices/${kurangBayarInv.invoiceId}/pay`,
      "POST",
      { amount: 250000, details: { metodePembayaran: "Transfer BCA", idempotencyKey: key } },
      { "Idempotency-Key": key }
    );
    assert.strictEqual(conflictRes.status, 409);
    const conflictPayload = (await conflictRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(conflictPayload.error?.code, "IDEMPOTENCY_CONFLICT");
  });

  await t.test("Category Cashback Pending & Cashback Belum Dibayar: gating, validation, OCC, payout, idempotency & void", async () => {
    const kasBeforeRow = db.prepare("SELECT COUNT(*) as cnt FROM kas_kantor").get() as { cnt: number };
    const kasCountBefore = kasBeforeRow.cnt;

    // 1. Cashback Pending gated by Supervisi Stage 6 -> 400 SUPERVISI_NOT_APPROVED, no kas deduction
    const gatedRes = await apiCall(
      financeToken,
      `/finance/invoices/${cashbackPendingGated.invoiceId}/cashback-payout`,
      "POST",
      {
        nominal: 250000,
        paymentType: "KELEBIHAN",
        penerima: "Dewi Cashback Gated",
        bank: "BCA",
        noRekening: "1234567890",
        expectedVersion: 0,
      },
      { "X-Idempotency-Key": "cb-gate-key-1" }
    );
    assert.strictEqual(gatedRes.status, 400);
    const gatedPayload = (await gatedRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(gatedPayload.error?.code, "SUPERVISI_NOT_APPROVED");

    // 2. Transfer missing rekening -> 400 VALIDATION_ERROR
    const invalidBankRes = await apiCall(
      financeToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout`,
      "POST",
      {
        nominal: 250000,
        paymentType: "KELEBIHAN",
        penerima: "Hendra Cashback Ready",
        bank: "BCA",
        noRekening: "",
        expectedVersion: 0,
      },
      { "X-Idempotency-Key": "cb-invalid-bank-1" }
    );
    assert.strictEqual(invalidBankRes.status, 400);
    const invalidBankPayload = (await invalidBankRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(invalidBankPayload.error?.code, "VALIDATION_ERROR");

    // 3. Amount exceeds remaining overpayment -> 400 EXCEEDS_LIMIT
    const exceedsRes = await apiCall(
      financeToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout`,
      "POST",
      {
        nominal: 500000,
        paymentType: "KELEBIHAN",
        penerima: "Hendra Cashback Ready",
        bank: "BCA",
        noRekening: "888000111",
        expectedVersion: 0,
      },
      { "X-Idempotency-Key": "cb-exceeds-1" }
    );
    assert.strictEqual(exceedsRes.status, 400);
    const exceedsPayload = (await exceedsRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(exceedsPayload.error?.code, "EXCEEDS_LIMIT");

    // 4. Stale expectedVersion -> 409 CONCURRENT_MODIFICATION
    const staleRes = await apiCall(
      financeToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout`,
      "POST",
      {
        nominal: 250000,
        paymentType: "KELEBIHAN",
        penerima: "Hendra Cashback Ready",
        bank: "BCA",
        noRekening: "888000111",
        expectedVersion: 5,
      },
      { "X-Idempotency-Key": "cb-stale-1" }
    );
    assert.strictEqual(staleRes.status, 409);
    const stalePayload = (await staleRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(stalePayload.error?.code, "CONCURRENT_MODIFICATION");

    const kasStillBefore = (db.prepare("SELECT COUNT(*) as cnt FROM kas_kantor").get() as { cnt: number }).cnt;
    assert.strictEqual(kasStillBefore, kasCountBefore, "All rejected cashback requests must leave kas_kantor untouched");

    // 5. Successful payout (200) -> updates refundStatus, payoutVersion & posts kas_kantor Kredit
    const cbKey = "cb-ready-payout-key-1";
    const payoutPayloadBody = {
      nominal: 250000,
      paymentType: "KELEBIHAN",
      penerima: "Hendra Cashback Ready",
      bank: "BCA",
      noRekening: "888000111",
      expectedVersion: 0,
    };

    const cbOk1 = await apiCall(
      financeToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout`,
      "POST",
      payoutPayloadBody,
      { "X-Idempotency-Key": cbKey }
    );
    assert.strictEqual(cbOk1.status, 200);
    const cbOkJson = (await cbOk1.json()) as ApiJsonEnvelope;
    assert.strictEqual(cbOkJson.data?.refundStatus, "PROCESSED");
    assert.strictEqual(cbOkJson.data?.payoutVersion, 1);

    // 6. Simulated retry after lost HTTP response with identical key & old expectedVersion -> 200 without duplicate kas_kantor row
    const cbRetry = await apiCall(
      financeToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout`,
      "POST",
      payoutPayloadBody,
      { "X-Idempotency-Key": cbKey }
    );
    assert.strictEqual(cbRetry.status, 200);

    const kasAfterOnePayout = (db.prepare("SELECT COUNT(*) as cnt FROM kas_kantor").get() as { cnt: number }).cnt;
    assert.strictEqual(kasAfterOnePayout, kasCountBefore + 1, "Idempotent cashback retry must produce only 1 kas_kantor Kredit entry");

    // 7. Reused key with different amount -> 409 IDEMPOTENCY_CONFLICT
    const cbIdempConflict = await apiCall(
      financeToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout`,
      "POST",
      { ...payoutPayloadBody, nominal: 100000 },
      { "X-Idempotency-Key": cbKey }
    );
    assert.strictEqual(cbIdempConflict.status, 409);
    const cbIdempJson = (await cbIdempConflict.json()) as ApiJsonEnvelope;
    assert.strictEqual(cbIdempJson.error?.code, "IDEMPOTENCY_CONFLICT");

    // 8. Second payout with new key & current expectedVersion -> 400 ALREADY_PROCESSED
    const cbAlreadyRes = await apiCall(
      financeToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout`,
      "POST",
      { ...payoutPayloadBody, expectedVersion: 1 },
      { "X-Idempotency-Key": "cb-ready-payout-key-2" }
    );
    assert.strictEqual(cbAlreadyRes.status, 400);
    const cbAlreadyJson = (await cbAlreadyRes.json()) as ApiJsonEnvelope;
    assert.strictEqual(cbAlreadyJson.error?.code, "ALREADY_PROCESSED");

    // 9. Void Cashback: finance role rejected with 403 FORBIDDEN
    const voidForbidden = await apiCall(
      financeToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout/void`,
      "POST",
      { reason: "Pembatalan tidak sah oleh staff non-SPV" }
    );
    assert.strictEqual(voidForbidden.status, 403);

    // 10. Void Cashback: SPV short reason -> 400 VALIDATION_ERROR
    const voidShort = await apiCall(
      spvToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout/void`,
      "POST",
      { reason: "Pendek" }
    );
    assert.strictEqual(voidShort.status, 400);

    // 11. Void Cashback: Admin/SPV valid reason -> 200, restores PENDING & posts Debit reversal
    const voidOk = await apiCall(
      adminToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout/void`,
      "POST",
      { reason: "Kesalahan nomor rekening customer pada transfer" }
    );
    assert.strictEqual(voidOk.status, 200);
    const voidOkJson = (await voidOk.json()) as ApiJsonEnvelope;
    assert.strictEqual(voidOkJson.data?.refundStatus, "PENDING");

    // 12. Duplicate Void -> 400 CASHBACK_NOT_PROCESSED / ALREADY_VOIDED -> BUSINESS_RULE_VIOLATION
    const voidDup = await apiCall(
      adminToken,
      `/finance/invoices/${cashbackReady.invoiceId}/cashback-payout/void`,
      "POST",
      { reason: "Percobaan void ulang yang seharusnya ditolak" }
    );
    assert.strictEqual(voidDup.status, 400);
    const voidDupJson = (await voidDup.json()) as ApiJsonEnvelope;
    assert.strictEqual(classifyActionError(voidDupJson).code, "BUSINESS_RULE_VIOLATION");
  });
});

test("FinanceContent.tsx static & UX contract: action feedback bindings and gating preserved", () => {
  const srcPath = path.resolve(process.cwd(), "src/app/components/FinanceContent.tsx");
  const content = fs.readFileSync(srcPath, "utf8");

  const requiredActionKeys = [
    "finance-lunas-submit",
    "finance-lunas-proof",
    "finance-lunas-history",
    "finance-cashback-submit",
    "finance-cashback-proof",
    "finance-cashback-selesai",
    "finance-cashback-edit",
    "finance-cashback-void",
  ];
  for (const key of requiredActionKeys) {
    assert.ok(content.includes(`actionKey="${key}"`), `Missing ActionInlineError for ${key}`);
  }

  const requiredRefLocks = [
    "lunasSubmittingRef",
    "lunasUploadRef",
    "cashbackOpeningRef",
    "cashbackSubmittingRef",
    "cashbackUploadRef",
    "cashbackEditRef",
    "voidCashbackRef",
    "selesaiDismissRef",
  ];
  for (const lockName of requiredRefLocks) {
    assert.ok(content.includes(lockName), `Missing synchronous double-click lock ${lockName}`);
  }

  // Must NOT pre-disable modal action buttons before form feedback runs
  assert.ok(!content.includes("isFormInvalid"), "Cashback submit button must not use isFormInvalid pre-disable");
  assert.ok(
    !content.includes("disabled={isSubmittingVoid || !voidReasonText"),
    "Eksekusi Void must not pre-disable before clicking for validation feedback"
  );
  assert.ok(content.includes("disabled={isSubmittingVoid}"), "Eksekusi Void must disable while submitting");
  assert.ok(content.includes("BELUM terkonfirmasi"), "Unconfirmed network timeout warning wording must exist");
  assert.ok(content.includes("disabled={isGated}"), "Table-row gating disabled={isGated} must remain preserved");
});
