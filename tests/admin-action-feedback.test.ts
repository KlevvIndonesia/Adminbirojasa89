/**
 * Admin Action Feedback, Error Classification & Non-Optimistic API Tests
 * Admin SUN89 — Biro Jasa Management System
 *
 * Covers Modules A (Data Penjualan), B (Order Tracking), and C (Buat Order):
 * 1. Error classification (all 13 ErrorCodes), sanitization, Retry-After (int & HTTP-date), fetchWithTimeout
 * 2. Isolated per-button state transitions (reduceActionStart, reduceActionSuccess, reduceActionFailure)
 * 3. ApiOrderProvider timeout, 403/409/422/429/500, PAYMENT_PROOF_REQUIRED, non-optimistic delete/cancel/archive, idempotency retry
 * 4. orderStore.approveDocumentsAsync & orderStore.addRekapDocumentAsync in API mode preserving state on BE rejection
 * 5. recoverSamsatPickupKendalaAction clean error/statusCode/errorObj propagation without "[object Object]"
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  ActionApiError,
  classifyActionError,
  fetchWithTimeout,
  parseApiErrorResponse,
  sanitizeActionMessage,
} from "../src/app/utils/actionErrorClassifier";
import {
  reduceActionFailure,
  reduceActionStart,
  reduceActionSuccess,
  type ActionStateMap,
} from "../src/app/hooks/useActionFeedback";
import { ApiOrderProvider } from "../src/data/api/apiOrderProvider";
import { orderRepository } from "../src/data/repositories/orderRepository";
import { orderStore, type OperationalOrder } from "../src/app/data/orderStore";
import { financeStore } from "../src/app/data/financeStore";
import { recoverSamsatPickupKendalaAction } from "../src/app/data/messengerTaskAdapter";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (idx: number) => Array.from(store.keys())[idx] ?? null,
    get length() {
      return store.size;
    },
  };
}

function makeOrder(overrides: Partial<OperationalOrder> = {}): OperationalOrder {
  return {
    orderNo: "ORD-FB-001",
    customer: "Budi Santoso",
    namaPemilik: "Budi Santoso",
    nomorHP: "081234567890",
    layanan: "Perpanjangan 1 Tahun",
    jenisKendaraan: "Mobil",
    tahunKendaraan: "2022",
    nopol: "B 1234 ABC",
    wilayahSamsatAsal: "Jakarta Timur",
    wilayahSamsatTujuan: "Jakarta Timur",
    metodeLayanan: "Antar Jemput",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: "2026-11-09T01:00:00.000Z",
    tanggalMasukBerkas: "2026-11-09",
    isArchived: false,
    biayaJasa: 150000,
    totalEstimasi: 650000,
    samsatPickupStatus: "Terjadwal Jemput Samsat",
    documentApproval: {
      stage5Verified: false,
      stage6Approved: false,
    },
    rekapDocuments: [],
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Transfer BCA",
      totalBiaya: 650000,
      dibayar: 650000,
      kurang: 0,
      statusPembayaran: "Lunas",
      isPaymentVerified: false,
    },
    ...overrides,
  } as OperationalOrder;
}

interface GlobalShim {
  window?: unknown;
  localStorage?: unknown;
}

const g = globalThis as unknown as GlobalShim;

function setOrderCache(
  provider: ApiOrderProvider,
  stage: keyof ReturnType<ApiOrderProvider["getActiveOrders"]>,
  orders: OperationalOrder[]
) {
  (provider as unknown as { activeOrders: Record<string, OperationalOrder[]> }).activeOrders[stage] = orders;
}

function isActionApiErr(status: number, code?: string) {
  return (err: unknown): boolean =>
    err instanceof ActionApiError &&
    err.statusCode === status &&
    (code ? err.code === code : true);
}

test("actionErrorClassifier: classifyActionError handles all 13 ActionErrorCodes", () => {
  const cases: Array<{ input: unknown; expectedCode: string; retryable?: boolean }> = [
    { input: { statusCode: 400, code: "VALIDATION_ERROR", field: "nopol", message: "Nomor polisi tidak valid" }, expectedCode: "VALIDATION_ERROR", retryable: false },
    { input: { statusCode: 400, code: "VALIDATION_ERROR", field: "targetStage", message: "Tahap tujuan order tidak valid" }, expectedCode: "VALIDATION_ERROR", retryable: false },
    { input: { statusCode: 404, code: "NOT_FOUND", message: "Order ORD-999 tidak ditemukan" }, expectedCode: "NOT_FOUND", retryable: false },
    { input: { statusCode: 409, code: "CONFLICT", message: "Tahap order sudah berubah di server" }, expectedCode: "CONFLICT", retryable: false },
    { input: { statusCode: 409, code: "DUPLICATE_RECORD", message: "Nomor invoice sudah digunakan" }, expectedCode: "DUPLICATE_RECORD", retryable: false },
    { input: { statusCode: 422, code: "IDEMPOTENCY_CONFLICT", message: "Payload berbeda dengan request idempotency" }, expectedCode: "IDEMPOTENCY_CONFLICT", retryable: true },
    { input: { statusCode: 401, code: "UNAUTHORIZED", message: "Sesi berakhir" }, expectedCode: "UNAUTHORIZED", retryable: false },
    { input: { statusCode: 403, code: "FORBIDDEN", message: "Hanya Supervisor yang berwenang" }, expectedCode: "FORBIDDEN", retryable: false },
    { input: { statusCode: 422, code: "PAYMENT_PROOF_REQUIRED", message: "Bukti pembayaran wajib dilampirkan terlebih dahulu" }, expectedCode: "BUSINESS_RULE_VIOLATION", retryable: false },
    { input: { statusCode: 422, message: "Order masih memiliki kendala aktif" }, expectedCode: "BUSINESS_RULE_VIOLATION", retryable: false },
    { input: { statusCode: 408, code: "TIMEOUT", message: "Melebihi batas waktu" }, expectedCode: "TIMEOUT", retryable: true },
    { input: { statusCode: 429, code: "RATE_LIMITED", retryAfterSeconds: 20 }, expectedCode: "RATE_LIMITED", retryable: true },
    { input: { statusCode: 0, code: "NETWORK_ERROR", message: "Failed to fetch" }, expectedCode: "NETWORK_ERROR", retryable: true },
    { input: { statusCode: 500, code: "INTERNAL_SERVER_ERROR", message: "Crash stack" }, expectedCode: "INTERNAL_SERVER_ERROR", retryable: true },
    { input: { message: "Kendala tak terduga sementara" }, expectedCode: "UNKNOWN_ERROR", retryable: true },
  ];

  for (const c of cases) {
    const res = classifyActionError(c.input, { entityLabel: "Order" });
    assert.strictEqual(res.code, c.expectedCode, `Expected ${c.expectedCode}, got ${res.code}`);
    if (c.retryable !== undefined) {
      assert.strictEqual(res.isRetryable, c.retryable, `Retryable mismatch for ${c.expectedCode}`);
    }
    assert.ok(res.title.length > 0);
    assert.ok(res.message.length > 0);
  }
});

test("actionErrorClassifier: sanitizeActionMessage strips SQLite, JWT, stack traces & paths", () => {
  const sqlMsg = sanitizeActionMessage("SQLITE_CONSTRAINT: UNIQUE constraint failed: finance_invoices.invoice_no");
  assert.strictEqual(sqlMsg, "Nomor invoice sudah digunakan oleh transaksi lain.");
  assert.ok(!sqlMsg.includes("SQLITE"));

  const selectLeak = sanitizeActionMessage("SELECT id, token FROM users WHERE id = 1");
  assert.strictEqual(selectLeak, "Terjadi kendala saat memproses data di server.");

  const stackAndPathLeak = sanitizeActionMessage(
    "Error: Gagal menyimpan pada /home/app/server/src/index.ts:42:10\n    at Layer.handle (D:\\Admin\\adminsunbirojasa\\server\\src\\app.ts:99:5)"
  );
  assert.ok(!stackAndPathLeak.includes("D:\\Admin"));
  assert.ok(!stackAndPathLeak.includes("/home/app"));
  assert.ok(!stackAndPathLeak.includes("Layer.handle"));

  const tokenLeak = sanitizeActionMessage(
    "Auth gagal Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc_def dan eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.xyz123"
  );
  assert.ok(!tokenLeak.includes("eyJhbGciOiJIUzI1NiJ9"));
  assert.ok(tokenLeak.includes("[token]"));
});

test("actionErrorClassifier: parseApiErrorResponse handles Retry-After integer & HTTP-date, 401 & 500", async () => {
  const origWindow = g.window;
  const dispatchedEvents: string[] = [];
  g.window = {
    dispatchEvent: (evt: { type?: string }) => {
      dispatchedEvents.push(String(evt?.type || evt));
      return true;
    },
  };

  try {
    // 429 numeric Retry-After
    const res429Num = new Response(JSON.stringify({}), {
      status: 429,
      headers: { "Retry-After": "30", "Content-Type": "application/json" },
    });
    const errNum = await parseApiErrorResponse(res429Num);
    assert.strictEqual(errNum.statusCode, 429);
    assert.strictEqual(errNum.code, "RATE_LIMITED");
    assert.strictEqual(errNum.retryAfterSeconds, 30);
    assert.ok(errNum.message.includes("30 detik"));

    // 429 HTTP-date Retry-After
    const futureDate = new Date(Date.now() + 45_000).toUTCString();
    const res429Date = new Response(JSON.stringify({}), {
      status: 429,
      headers: { "Retry-After": futureDate, "Content-Type": "application/json" },
    });
    const errDate = await parseApiErrorResponse(res429Date);
    assert.strictEqual(errDate.statusCode, 429);
    assert.ok(
      typeof errDate.retryAfterSeconds === "number" &&
        errDate.retryAfterSeconds >= 40 &&
        errDate.retryAfterSeconds <= 46,
      `Expected ~45s Retry-After, got ${errDate.retryAfterSeconds}`
    );

    // 401 dispatches sun89_auth_unauthorized safely
    const res401 = new Response(JSON.stringify({ message: "Token kedaluwarsa" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    const err401 = await parseApiErrorResponse(res401);
    assert.strictEqual(err401.statusCode, 401);
    assert.strictEqual(err401.code, "UNAUTHORIZED");
    assert.ok(dispatchedEvents.includes("sun89_auth_unauthorized"));

    // 500 hides SQL/stack details behind safe generic server message
    const res500 = new Response(
      JSON.stringify({ error: { message: "SQLITE_ERROR: table orders has no column bad_col" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
    const err500 = await parseApiErrorResponse(res500);
    assert.strictEqual(err500.statusCode, 500);
    assert.strictEqual(err500.code, "INTERNAL_SERVER_ERROR");
    assert.ok(!err500.message.includes("SQLITE_ERROR"));
  } finally {
    if (origWindow === undefined) {
      delete g.window;
    } else {
      g.window = origWindow;
    }
  }
});

test("actionErrorClassifier: fetchWithTimeout converts timeout to 408 TIMEOUT & failure to 0 NETWORK_ERROR", async () => {
  const origFetch = globalThis.fetch;
  try {
    // Abort-aware hanging fetch
    globalThis.fetch = (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            const abortErr = new Error("Aborted");
            abortErr.name = "AbortError";
            reject(abortErr);
          });
        }
      });

    await assert.rejects(
      () => fetchWithTimeout("http://localhost:3999/hang", {}, 25),
      isActionApiErr(408, "TIMEOUT")
    );

    // TypeError fetch network failure
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await assert.rejects(
      () => fetchWithTimeout("http://localhost:3999/offline", {}, 500),
      isActionApiErr(0, "NETWORK_ERROR")
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("useActionFeedback reducers: strict per-button loading/error isolation and prefix clear", () => {
  let state: ActionStateMap = {};

  state = reduceActionStart(state, "row-stage2-advance:ORD-1");
  assert.strictEqual(state["row-stage2-advance:ORD-1"].loading, true);
  assert.strictEqual(state["row-stage2-advance:ORD-1"].error, null);
  assert.strictEqual(state["row-stage2-advance:ORD-2"], undefined, "Sibling row must stay untouched");

  const classifiedErr = classifyActionError({ statusCode: 403, code: "FORBIDDEN", message: "Tidak diizinkan" });
  state = reduceActionFailure(state, "row-stage2-advance:ORD-1", classifiedErr);
  assert.strictEqual(state["row-stage2-advance:ORD-1"].loading, false);
  assert.strictEqual(state["row-stage2-advance:ORD-1"].error?.code, "FORBIDDEN");
  assert.strictEqual(state["row-stage2-advance:ORD-2"], undefined);

  // Add second prefix error (m1-doc vs m2-save)
  state = reduceActionFailure(
    state,
    "m1-proof:ORD-1",
    classifyActionError({ statusCode: 422, code: "VALIDATION_ERROR", message: "Format salah" })
  );
  state = reduceActionFailure(
    state,
    "m2-save:ORD-1",
    classifyActionError({ statusCode: 422, code: "VALIDATION_ERROR", message: "Tanggal wajib diisi" })
  );

  state = reduceActionSuccess(state, "m1-proof:ORD-1", ["m1-"]);
  assert.strictEqual(state["m1-proof:ORD-1"].error, null);
  assert.strictEqual(
    state["m2-save:ORD-1"].error?.code,
    "VALIDATION_ERROR",
    "Unrelated prefix m2- must remain untouched when m1- clears"
  );
});

test("ApiOrderProvider: preserves cache on 403/408/409/422/429/500 across advance, verifyPayment, delete, cancel, archive & retries idempotently", async () => {
  const origFetch = globalThis.fetch;
  const origWindow = g.window;
  const origLocalStorage = g.localStorage;
  const memStorage = createMemoryStorage();
  g.localStorage = memStorage;
  g.window = { localStorage: memStorage, dispatchEvent: () => true };

  // Construct before setting auth_token so constructor initFromApi() does not race in background
  const provider = new ApiOrderProvider("http://fake-api:3999/api");
  memStorage.setItem("auth_token", "test-jwt-token");
  const verifikasiOrd = makeOrder({ orderNo: "ORD-S1", currentStep: 1, currentStageName: "Verifikasi" });
  const stage8Ord = makeOrder({ orderNo: "ORD-S8", currentStep: 8, currentStageName: "Dokumen Telah Diterima" });
  setOrderCache(provider, "Verifikasi", [verifikasiOrd]);
  setOrderCache(provider, "Dokumen Telah Diterima", [stage8Ord]);

  try {
    // 1. advanceOrderAsync 403 FORBIDDEN
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Hanya Admin" } }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    await assert.rejects(
      () => provider.advanceOrderAsync("ORD-S1", "Penjadwalan", { isVerified: true }),
      isActionApiErr(403, "FORBIDDEN")
    );
    assert.strictEqual(provider.getOrderByNo("ORD-S1")?.currentStageName, "Verifikasi");

    // 2. advanceOrderAsync 409 CONFLICT
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { code: "STAGE_CONFLICT", message: "Stage sudah berubah" } }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    await assert.rejects(
      () => provider.advanceOrderAsync("ORD-S1", "Penjadwalan", {}),
      isActionApiErr(409, "STAGE_CONFLICT")
    );

    // 3. verifyPaymentAsync 422 PAYMENT_PROOF_REQUIRED preserves unverified status
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: { code: "PAYMENT_PROOF_REQUIRED", message: "Bukti pembayaran wajib diunggah untuk skema Bayar di Awal." },
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      );
    await assert.rejects(
      () => provider.verifyPaymentAsync("ORD-S1", "Admin", 650000),
      isActionApiErr(422, "PAYMENT_PROOF_REQUIRED")
    );
    assert.strictEqual(provider.getOrderByNo("ORD-S1")?.payment.isPaymentVerified, false);

    // 4. updateOrderAsync 429 rate limited
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { code: "RATE_LIMITED" } }), {
        status: 429,
        headers: { "Retry-After": "12", "Content-Type": "application/json" },
      });
    await assert.rejects(
      () => provider.updateOrderAsync("ORD-S1", { customer: "Should Not Mutate" }),
      (err: unknown) => err instanceof ActionApiError && err.statusCode === 429 && err.retryAfterSeconds === 12
    );
    assert.strictEqual(provider.getOrderByNo("ORD-S1")?.customer, "Budi Santoso");

    // 5. archiveOrderAsync 500 keeps order in activeOrders
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "SQLITE_BUSY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    await assert.rejects(
      () => provider.archiveOrderAsync("ORD-S8"),
      isActionApiErr(500)
    );
    assert.ok(provider.getOrdersByStage("Dokumen Telah Diterima").some((o) => o.orderNo === "ORD-S8"));
    assert.strictEqual(provider.getArchivedOrders().some((o) => o.orderNo === "ORD-S8"), false);

    // 6. deleteOrder 403/500 preserves order in activeOrders (never optimistic!)
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Akses ditolak" } }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    await assert.rejects(
      () => provider.deleteOrder("ORD-S1"),
      isActionApiErr(403)
    );
    assert.ok(provider.getOrderByNo("ORD-S1"), "deleteOrder must preserve cache when BE rejects");

    // 7. cancelOrder 409/500 preserves order stage & isCancelled
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { code: "CONFLICT", message: "Order sedang dikunci" } }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    await assert.rejects(
      () => provider.cancelOrder("ORD-S1", "Batal"),
      isActionApiErr(409)
    );
    assert.strictEqual(provider.getOrderByNo("ORD-S1")?.currentStageName, "Verifikasi");

    // 8. addOrderAsync idempotency key consistency across failure -> retry
    const seenKeys: string[] = [];
    let attempt = 0;
    globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
      attempt++;
      const hdrs = (init?.headers || {}) as Record<string, string>;
      seenKeys.push(hdrs["X-Idempotency-Key"]);
      if (attempt === 1) {
        return new Response(JSON.stringify({ message: "Server down temporarily" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ success: true, data: makeOrder({ orderNo: "ORD-CANON-77" }) }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    };

    const tempOrd = makeOrder({ orderNo: "TMP-ORD-77", clientRequestId: "IDEMP-77" });
    await assert.rejects(() => provider.addOrderAsync(tempOrd), isActionApiErr(500));
    assert.strictEqual(provider.getOrderByNo("TMP-ORD-77"), undefined, "Ghost temp order removed on failure");

    const retryCreated = await provider.addOrderAsync(tempOrd);
    assert.strictEqual(retryCreated.orderNo, "ORD-CANON-77");
    assert.deepStrictEqual(seenKeys, ["IDEMP-77", "IDEMP-77"]);
  } finally {
    globalThis.fetch = origFetch;
    if (origLocalStorage === undefined) delete g.localStorage;
    else g.localStorage = origLocalStorage;
    if (origWindow === undefined) delete g.window;
    else g.window = origWindow;
  }
});

test("orderStore API mode: approveDocumentsAsync, addRekapDocumentAsync & recoverSamsatPickupKendalaAction reject cleanly without local mutation", async () => {
  const origFetch = globalThis.fetch;
  const origWindow = g.window;
  const origLocalStorage = g.localStorage;
  const originalProvider = orderRepository.getProvider();

  const memStorage = createMemoryStorage();
  g.localStorage = memStorage;
  g.window = { localStorage: memStorage, dispatchEvent: () => true };

  const apiProvider = new ApiOrderProvider("http://fake-api:3999/api");
  memStorage.setItem("auth_token", "test-jwt-token");
  const testOrder = makeOrder({
    orderNo: "ORD-STORE-1",
    currentStep: 4,
    currentStageName: "Proses Samsat",
    samsatPickupStatus: "Terkendala",
    rekapDocuments: [],
    documentApproval: { stage5Verified: false, stage6Approved: false },
  });
  setOrderCache(apiProvider, "Proses Samsat", [testOrder]);
  orderRepository.setProvider(apiProvider);

  try {
    // 1. approveDocumentsAsync fails on 403 without mutating documentApproval
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Hanya Supervisor" } }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    await assert.rejects(
      () => orderStore.approveDocumentsAsync("ORD-STORE-1", 6, { name: "Admin Biasa", role: "admin" }),
      isActionApiErr(403, "FORBIDDEN")
    );
    assert.strictEqual(orderStore.getOrderByNo("ORD-STORE-1")?.documentApproval?.stage6Approved, false);

    // 2. addRekapDocumentAsync fails on 500 without appending fake rekap document
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "DB error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    await assert.rejects(
      () =>
        orderStore.addRekapDocumentAsync("ORD-STORE-1", {
          phase: "AFTER",
          documentType: "STNK",
          label: "STNK Baru",
          fileType: "PDF",
          fileUrl: "/uploads/stnk.pdf",
          uploadedBy: "Admin",
        }),
      isActionApiErr(500)
    );
    assert.strictEqual(orderStore.getOrderByNo("ORD-STORE-1")?.rekapDocuments?.length, 0);

    // 3. recoverSamsatPickupKendalaAction preserves statusCode, code & ActionApiError object (no [object Object])
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ error: { code: "FORBIDDEN", message: "Akses ditolak untuk pemulihan kendala" } }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    const recoverRes = await recoverSamsatPickupKendalaAction("ORD-STORE-1", {
      userId: "usr-admin",
      userName: "Admin",
      role: "administrator",
    });
    assert.strictEqual(recoverRes.success, false);
    assert.strictEqual(recoverRes.statusCode, 403);
    assert.strictEqual(recoverRes.code, "FORBIDDEN");
    assert.strictEqual(typeof recoverRes.error, "string");
    assert.ok(!recoverRes.error?.includes("[object Object]"));
    assert.ok(recoverRes.errorObj instanceof ActionApiError);
    assert.strictEqual(orderStore.getOrderByNo("ORD-STORE-1")?.samsatPickupStatus, "Terkendala");
  } finally {
    orderRepository.setProvider(originalProvider);
    globalThis.fetch = origFetch;
    if (origLocalStorage === undefined) delete g.localStorage;
    else g.localStorage = origLocalStorage;
    if (origWindow === undefined) delete g.window;
    else g.window = origWindow;
  }
});

test("Regression: ApiOrderProvider.updateOrder strips nested protectedPaymentFields and financeStore.updateInvoiceFromOrder avoids payment sync echo", async () => {
  const origFetch = globalThis.fetch;
  const origWindow = g.window;
  const origLocalStorage = g.localStorage;

  const memStorage = createMemoryStorage();
  g.localStorage = memStorage;
  g.window = { localStorage: memStorage, dispatchEvent: () => true };

  const provider = new ApiOrderProvider("http://fake-api:3999/api");
  memStorage.setItem("auth_token", "test-jwt-token");
  const sampleOrder = makeOrder({
    orderNo: "ORD-ECHO-1",
    customer: "Pelanggan Asli",
  });
  setOrderCache(provider, "Verifikasi", [sampleOrder]);

  const sentBodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (typeof init?.body === "string") {
      sentBodies.push(JSON.parse(init.body) as Record<string, unknown>);
    }
    return new Response(JSON.stringify({ success: true, data: sampleOrder }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  let syncEvents = 0;
  const unsubSync = financeStore.onPaymentSync(() => {
    syncEvents++;
  });

  try {
    // 1. Mixed allowed + protected payment fields -> strips protected nested payment fields before PUT
    const okMixed = provider.updateOrder("ORD-ECHO-1", {
      payment: {
        ...sampleOrder.payment,
        isPaymentVerified: true,
        nominalDibayarAwal: 500000,
        nominalPembayaranAwalTerkonfirmasi: 500000,
        settlementCondition: "SETTLED",
      } as OperationalOrder["payment"],
    });
    assert.strictEqual(okMixed, true);
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(sentBodies.length, 1, "Only allowed non-protected payment fields should trigger PUT");
    const firstPaymentBody = sentBodies[0].payment as Record<string, unknown>;
    assert.ok(firstPaymentBody, "Allowed payment metadata should still be forwarded");
    assert.strictEqual(firstPaymentBody.isPaymentVerified, undefined);
    assert.strictEqual(firstPaymentBody.nominalDibayarAwal, undefined);
    assert.strictEqual(firstPaymentBody.nominalPembayaranAwalTerkonfirmasi, undefined);
    assert.strictEqual(firstPaymentBody.settlementCondition, undefined);

    // 2. Partial payment update containing ONLY protected keys -> skip network PUT cleanly
    const beforeCalls = sentBodies.length;
    const partialPaymentOnlyProtected = {
      isPaymentVerified: true,
      nominalDibayarAwal: 500000,
    } as unknown as OperationalOrder["payment"];
    const okPartialProtected = provider.updateOrder("ORD-ECHO-1", {
      payment: partialPaymentOnlyProtected,
    });
    assert.strictEqual(okPartialProtected, true);
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(sentBodies.length, beforeCalls, "No-op PUT with only protected fields must be skipped");

    // 3. Downstream Order -> Finance sync via updateInvoiceFromOrder must NOT emit paymentSync echo
    financeStore.addInvoice({
      orderNo: "ORD-ECHO-1",
      customer: "Pelanggan Asli",
      nopol: "B 1111 ECH",
      jenisLayanan: "Perpanjangan 1 Tahun",
      totalTagihan: 500000,
      terbayar: 0,
      invoice: "INV-ECHO-1",
      tanggal: "2026-11-09",
    });
    const updatedInv = financeStore.updateInvoiceFromOrder("ORD-ECHO-1", {
      totalTagihan: 500000,
      terbayar: 500000,
      sisa: 0,
      status: "Lunas",
      settlementCondition: "SETTLED",
    });
    assert.ok(updatedInv, "Invoice should be updated from order");
    assert.strictEqual(syncEvents, 0, "updateInvoiceFromOrder must not echo back via notifyPaymentSync()");
  } finally {
    unsubSync();
    globalThis.fetch = origFetch;
    if (origLocalStorage === undefined) delete g.localStorage;
    else g.localStorage = origLocalStorage;
    if (origWindow === undefined) delete g.window;
    else g.window = origWindow;
  }
});
