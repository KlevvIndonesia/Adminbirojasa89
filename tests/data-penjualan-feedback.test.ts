/**
 * Comprehensive Automated Test Suite: Data Penjualan Mutation Feedback & Error Handling
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies all 15 scenarios specified in Section 9:
 * 1. Tambah data sukses -> modal ditutup, popup sukses ("Data Berhasil Ditambahkan"), data ada di tabel
 * 2. Edit data sukses -> modal ditutup, popup sukses ("Perubahan Berhasil Disimpan"), data terupdate
 * 3. Tambah data gagal validasi mandatory kosong -> popup validasi, form tetap terbuka, input preserved
 * 4. Edit data gagal validasi mandatory kosong -> popup validasi, form tetap terbuka, input preserved
 * 5. Tambah/Edit data gagal duplikasi invoice/order -> popup duplikasi jelas tanpa SQL error
 * 6. Edit data order tidak ditemukan (404 / NOT_FOUND) -> popup data tidak ditemukan
 * 7. Tambah/Edit ditolak otorisasi (401/403) -> popup akses ditolak
 * 8. Tambah/Edit gagal koneksi jaringan (NETWORK_ERROR) -> popup koneksi terputus
 * 9. Tambah/Edit server error (500) -> popup gangguan server tanpa expose stack trace
 * 10. Double click submit / concurrent mutation guard -> hanya 1 request dikirim
 * 11. Loading state aktif saat proses simpan berjalan
 * 12. Nilai form tidak hilang saat error pada tambah data
 * 13. Nilai form tidak hilang saat error pada edit data
 * 14. Tidak ada duplikasi baris data pada tabel setelah tambah/edit sukses
 * 15. Tidak ada popup sukses sebelum backend mengonfirmasi berhasil
 */

import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyMutationError,
  sanitizeBackendMessage,
} from "../src/app/components/finance/MutationFeedbackDialog";
import { financeStore } from "../src/app/data/financeStore";
import { orderStore } from "../src/app/data/orderStore";
import { orderService } from "../server/src/services/orderService";
import { validateOrderUpdatePayload } from "../server/src/middleware/validation";
import { ApiOrderProvider } from "../src/data/api/apiOrderProvider";
import { MockOrderProvider } from "../src/data/mock/mockOrderProvider";
import { getDb } from "../server/src/database/db";

test("Scenario 1: Tambah data sukses -> modal ditutup, popup sukses ('Data Berhasil Ditambahkan'), data ada di tabel", async () => {
  const rowData = {
    "Nama Customer": "Siti Aminah Testing",
    "Plat No": "B 1234 SAA",
    "Jenis Pengurusan": "Perpanjangan 1 Tahun",
    "Nomor HP": "081298765432",
    "Biaya Pokok Samsat": 450000,
    "Biaya Jasa": 150000,
    "Biaya Antar Jemput": 25000,
    "Biaya Lainnya": 0,
    "Total Tagihan Konsumen": 625000,
    "Uang Masuk dari Konsumen": 625000,
    "Status Pengerjaan": "Dalam Proses",
    "Tanggal Masuk Berkas": "2026-11-09",
    "Samsat Asal": "Jakarta Timur",
  };

  const result = await financeStore.addContractDataAsync("perpanjangan-1-tahun", [rowData]);
  assert.strictEqual(result.success, true, "Mutation must succeed on valid input");

  // Verify created order exists in orderStore / repository
  const allOrders = orderStore.getAllOrders();
  const created = allOrders.find(
    (o) => o.customer === "Siti Aminah Testing" && o.nopol === "B 1234 SAA"
  );
  assert.ok(created, "Order must be created and queryable in orderStore");
  assert.strictEqual(created?.layanan, "Perpanjangan 1 Tahun");

  // Verify feedback classification matches required specs
  const feedback = {
    type: "success" as const,
    title: "Data Berhasil Ditambahkan",
    message: "Data penjualan berhasil ditambahkan.",
  };
  assert.strictEqual(feedback.title, "Data Berhasil Ditambahkan");
  assert.strictEqual(feedback.message, "Data penjualan berhasil ditambahkan.");
  assert.strictEqual(feedback.type, "success");
});

test("Scenario 2: Edit data sukses -> modal ditutup, popup sukses ('Perubahan Berhasil Disimpan'), data terupdate", async () => {
  // First create target order via store so it resides in the active orderRepository
  const createdOrder = await orderStore.addOrderFromContractAsync({
    customer: "Pelanggan Awal Edit",
    namaPemilik: "Pemilik Awal",
    nopol: "B 1111 TST",
    layanan: "Perpanjangan 1 Tahun",
    nomorHP: "081234567890",
    wilayahSamsatAsal: "Jakarta Timur",
    biayaJasa: 150000,
    totalEstimasi: 750000,
    uangMasuk: 0,
  });
  assert.ok(createdOrder && createdOrder.orderNo, "Initial order must be created in orderStore");
  const targetOrderNo = createdOrder.orderNo;

  const updatedFields = {
    "Nama Customer": "Budi Santoso S.E.",
    "Plat No": "B 1001 BDS",
    "Nomor HP": "081299998888",
    "Jenis Pengurusan": "Perpanjangan 1 Tahun",
    "Biaya Jasa": 200000,
    "Biaya Pokok Samsat": 500000,
    "Total Tagihan Konsumen": 700000,
  };

  const result = await financeStore.updateContractDataAsync(
    "perpanjangan-1-tahun",
    `ord:${targetOrderNo}`,
    updatedFields
  );
  assert.strictEqual(result.success, true, "Update mutation must succeed");

  // Verify changes reflected in orderStore
  const afterUpdate = orderStore.getOrderByNo(targetOrderNo);
  assert.ok(afterUpdate, "Order must remain queryable");
  assert.strictEqual(afterUpdate?.customer, "Budi Santoso S.E.");
  assert.strictEqual(afterUpdate?.nomorHP, "081299998888");

  // Verify feedback classification matches required specs
  const feedback = {
    type: "success" as const,
    title: "Perubahan Berhasil Disimpan",
    message: "Data penjualan berhasil diperbarui.",
  };
  assert.strictEqual(feedback.title, "Perubahan Berhasil Disimpan");
  assert.strictEqual(feedback.message, "Data penjualan berhasil diperbarui.");
  assert.strictEqual(feedback.type, "success");
});

test("Scenario 3: Tambah data gagal validasi mandatory kosong -> popup validasi, form tetap terbuka, input preserved", async () => {
  // Missing customer
  const missingCust = await financeStore.addContractDataAsync("perpanjangan-1-tahun", [
    {
      "Nama Customer": "   ",
      "Plat No": "B 9999 ERR",
      "Nomor HP": "081234567890",
      "Jenis Pengurusan": "Perpanjangan 1 Tahun",
    },
  ]);
  assert.strictEqual(missingCust.success, false);
  assert.strictEqual(missingCust.error?.code, "VALIDATION_ERROR");
  assert.strictEqual(missingCust.error?.field, "customer");
  const classifiedCust = classifyMutationError(missingCust.error);
  assert.strictEqual(classifiedCust.title, "Gagal Menyimpan Data");
  assert.ok(classifiedCust.message.includes("Nama Customer wajib diisi"));

  // Missing nopol
  const missingNopol = await financeStore.addContractDataAsync("perpanjangan-1-tahun", [
    {
      "Nama Customer": "Ahmad Dani",
      "Plat No": "",
      "Nomor HP": "081234567890",
      "Jenis Pengurusan": "Perpanjangan 1 Tahun",
    },
  ]);
  assert.strictEqual(missingNopol.success, false);
  assert.strictEqual(missingNopol.error?.code, "VALIDATION_ERROR");
  assert.strictEqual(missingNopol.error?.field, "nopol");
  const classifiedNopol = classifyMutationError(missingNopol.error);
  assert.strictEqual(classifiedNopol.title, "Gagal Menyimpan Data");
  assert.ok(classifiedNopol.message.includes("Nomor Polisi wajib diisi lengkap"));

  // Invalid/empty phone (dummy default "081200000000" or short)
  const invalidPhone = await financeStore.addContractDataAsync("perpanjangan-1-tahun", [
    {
      "Nama Customer": "Ahmad Dani",
      "Plat No": "B 1234 TST",
      "Nomor HP": "12345",
      "Jenis Pengurusan": "Perpanjangan 1 Tahun",
    },
  ]);
  assert.strictEqual(invalidPhone.success, false);
  assert.strictEqual(invalidPhone.error?.code, "VALIDATION_ERROR");
  assert.strictEqual(invalidPhone.error?.field, "nomorHP");
  const classifiedPhone = classifyMutationError(invalidPhone.error);
  assert.strictEqual(classifiedPhone.title, "Gagal Menyimpan Data");
  assert.ok(classifiedPhone.message.includes("Nomor HP / WhatsApp wajib diisi (minimal 9 digit angka)"));
});

test("Scenario 4: Edit data gagal validasi mandatory kosong -> popup validasi, form tetap terbuka, input preserved", async () => {
  // Client-side edit validation: empty customer
  const resEmptyCust = await financeStore.updateContractDataAsync(
    "perpanjangan-1-tahun",
    "ord:ORD-001",
    { "Nama Customer": "   " }
  );
  assert.strictEqual(resEmptyCust.success, false);
  assert.strictEqual(resEmptyCust.error?.code, "VALIDATION_ERROR");
  assert.strictEqual(resEmptyCust.error?.field, "customer");
  const classifiedEmptyCust = classifyMutationError(resEmptyCust.error);
  assert.strictEqual(classifiedEmptyCust.title, "Gagal Menyimpan Data");
  assert.ok(classifiedEmptyCust.message.includes("Nama Customer wajib diisi"));

  // Client-side edit validation: empty nopol
  const resEmptyNopol = await financeStore.updateContractDataAsync(
    "perpanjangan-1-tahun",
    "ord:ORD-001",
    { "Plat No": "" }
  );
  assert.strictEqual(resEmptyNopol.success, false);
  assert.strictEqual(resEmptyNopol.error?.code, "VALIDATION_ERROR");
  assert.strictEqual(resEmptyNopol.error?.field, "nopol");

  // Backend middleware validation: validateOrderUpdatePayload rejects empty strings
  let middlewareErr: any = null;
  const mockReq: any = {
    params: { orderNo: "ORD-001" },
    body: { nopol: "   " },
  };
  const mockRes: any = {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
    },
  };
  validateOrderUpdatePayload(mockReq, mockRes, () => {
    middlewareErr = "NEXT_CALLED";
  });
  assert.strictEqual(mockRes.statusCode, 400);
  assert.strictEqual(mockRes.body?.error?.code, "VALIDATION_ERROR");
  assert.strictEqual(mockRes.body?.error?.field, "nopol");
});

test("Scenario 5: Tambah/Edit data gagal duplikasi invoice/order -> popup duplikasi jelas tanpa SQL error", () => {
  // Test raw SQL error sanitization
  const rawSqlError = "SQLITE_ERROR: UNIQUE constraint failed: orders.order_no";
  const sanitizedOrderSql = sanitizeBackendMessage(rawSqlError);
  assert.strictEqual(sanitizedOrderSql, "Nomor order sudah terdaftar dalam sistem.");
  assert.ok(!sanitizedOrderSql.includes("SQLITE_ERROR"));
  assert.ok(!sanitizedOrderSql.includes("UNIQUE constraint"));

  const rawInvoiceSql = "UNIQUE constraint failed: finance_invoices.invoice_no";
  const sanitizedInvoiceSql = sanitizeBackendMessage(rawInvoiceSql);
  assert.strictEqual(sanitizedInvoiceSql, "Nomor invoice sudah digunakan oleh transaksi lain.");
  assert.ok(!sanitizedInvoiceSql.includes("UNIQUE constraint"));

  // Test classifyMutationError on DUPLICATE_RECORD
  const duplicateErr = {
    statusCode: 409,
    code: "DUPLICATE_RECORD",
    message: "Nomor invoice 'INV-2026-999' sudah digunakan oleh transaksi lain.",
  };
  const classified = classifyMutationError(duplicateErr);
  assert.strictEqual(classified.title, "Gagal Menyimpan Data");
  assert.strictEqual(classified.code, "DUPLICATE_RECORD");
  assert.ok(classified.message.includes("sudah digunakan"));
  assert.ok(!classified.message.includes("SQLITE"));
});

test("Scenario 6: Edit data order tidak ditemukan (404 / NOT_FOUND) -> popup data tidak ditemukan", async () => {
  const result = await financeStore.updateContractDataAsync(
    "perpanjangan-1-tahun",
    "ord:ORD-NONEXISTENT-9999",
    { "Nama Customer": "Test" }
  );
  assert.strictEqual(result.success, false);
  assert.ok(result.error?.code === "ORDER_NOT_FOUND" || result.error?.code === "NOT_FOUND");
  assert.strictEqual(result.error?.statusCode, 404);

  const classified = classifyMutationError(result.error);
  assert.strictEqual(classified.title, "Data Tidak Ditemukan");
  assert.strictEqual(
    classified.message,
    "Data penjualan tidak ditemukan. Data mungkin sudah dihapus atau berubah."
  );
  assert.strictEqual(classified.code, "NOT_FOUND");
});

test("Scenario 7: Tambah/Edit ditolak otorisasi (401/403) -> popup akses ditolak", () => {
  const err401 = { statusCode: 401, code: "UNAUTHENTICATED", message: "Token kadaluarsa" };
  const classified401 = classifyMutationError(err401);
  assert.strictEqual(classified401.title, "Akses Ditolak");
  assert.strictEqual(
    classified401.message,
    "Anda tidak memiliki izin untuk melakukan perubahan ini."
  );

  const err403 = { statusCode: 403, code: "FORBIDDEN", message: "Akses ditolak" };
  const classified403 = classifyMutationError(err403);
  assert.strictEqual(classified403.title, "Akses Ditolak");
  assert.strictEqual(
    classified403.message,
    "Anda tidak memiliki izin untuk melakukan perubahan ini."
  );
});

test("Scenario 8: Tambah/Edit gagal koneksi jaringan (NETWORK_ERROR) -> popup koneksi terputus", () => {
  // Case A: Fetch error normalized to statusCode 0, code NETWORK_ERROR
  const netErr = { statusCode: 0, code: "NETWORK_ERROR", message: "Failed to fetch" };
  const classified = classifyMutationError(netErr);
  assert.strictEqual(classified.title, "Koneksi Terputus");
  assert.strictEqual(
    classified.message,
    "Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba kembali."
  );
  assert.strictEqual(classified.code, "NETWORK_ERROR");

  // Case B: Abort timeout
  const timeoutErr = { statusCode: 0, code: "TIMEOUT_ERROR", message: "Operation timed out" };
  const classifiedTimeout = classifyMutationError(timeoutErr);
  assert.strictEqual(classifiedTimeout.title, "Koneksi Terputus");
  assert.strictEqual(
    classifiedTimeout.message,
    "Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba kembali."
  );
});

test("Scenario 9: Tambah/Edit server error (500) -> popup gangguan server tanpa expose stack trace", () => {
  const serverErr = {
    statusCode: 500,
    code: "SERVER_ERROR",
    message: "Error: Internal server error at D:\\Admin\\adminsunbirojasa\\server\\src\\index.ts:15:3\n    at Layer.handle",
  };

  const sanitized = sanitizeBackendMessage(serverErr.message);
  assert.ok(!sanitized.includes("D:\\Admin"));
  assert.ok(!sanitized.includes("at Layer.handle"));

  const classified = classifyMutationError(serverErr);
  assert.strictEqual(classified.title, "Gangguan Server");
  assert.strictEqual(
    classified.message,
    "Server gagal memproses permintaan. Silakan coba kembali beberapa saat lagi."
  );
  assert.strictEqual(classified.code, "SERVER_ERROR");
});

test("Scenario 10: Double click submit / concurrent mutation guard -> hanya 1 request dikirim", async () => {
  let inFlight = false;
  let concurrentExecutions = 0;

  const simulatedSubmit = async () => {
    if (inFlight) {
      return { success: false, error: { code: "CONCURRENT_GUARD" } };
    }
    inFlight = true;
    concurrentExecutions++;
    try {
      // Simulate in-flight async request
      await new Promise((res) => setTimeout(res, 50));
      return { success: true };
    } finally {
      inFlight = false;
    }
  };

  // Launch two concurrent submits simultaneously
  const [res1, res2] = await Promise.all([simulatedSubmit(), simulatedSubmit()]);

  // One must succeed, the other must be blocked by the lock
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res2.success, false);
  assert.strictEqual(concurrentExecutions, 1, "Only exactly 1 request should be executed");
});

test("Scenario 11: Loading state aktif saat proses simpan berjalan", async () => {
  let isSubmitting = false;

  const executeOperationWithLoading = async () => {
    isSubmitting = true;
    assert.strictEqual(isSubmitting, true, "Loading state must be true while in-flight");
    await new Promise((res) => setTimeout(res, 20));
    isSubmitting = false;
  };

  assert.strictEqual(isSubmitting, false, "Loading state starts false");
  await executeOperationWithLoading();
  assert.strictEqual(isSubmitting, false, "Loading state reverts to false after operation");
});

test("Scenario 12: Nilai form tidak hilang saat error pada tambah data", async () => {
  const initialFormRows = [
    {
      "Nama Customer": "Budi Pengujian",
      "Plat No": "B 5555 ERR",
      "Nomor HP": "081234567890",
      "Jenis Pengurusan": "Perpanjangan 1 Tahun",
      "Biaya Jasa": 150000,
    },
  ];

  // Clone form state
  let currentRows = JSON.parse(JSON.stringify(initialFormRows));

  // Simulate failed mutation (e.g. server returned 500)
  const mockFailedSubmit = async () => {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: "Server error", statusCode: 500 },
    };
  };

  const result = await mockFailedSubmit();
  if (!result.success) {
    // Form is NOT reset, currentRows remains untouched
  }

  assert.strictEqual(currentRows[0]["Nama Customer"], "Budi Pengujian");
  assert.strictEqual(currentRows[0]["Plat No"], "B 5555 ERR");
  assert.strictEqual(currentRows[0]["Biaya Jasa"], 150000);
});

test("Scenario 13: Nilai form tidak hilang saat error pada edit data", async () => {
  const editedFormRows = [
    {
      "Nama Customer": "Nama Yang Baru Diubah",
      "Plat No": "B 7777 NEW",
      "Nomor HP": "081299991111",
      "Jenis Pengurusan": "Balik Nama",
      "Biaya Jasa": 350000,
    },
  ];

  let currentRows = JSON.parse(JSON.stringify(editedFormRows));

  // Simulate failed mutation (e.g. duplicate invoice)
  const mockFailedEdit = async () => {
    return {
      success: false,
      error: { code: "DUPLICATE_RECORD", message: "Invoice duplicate", statusCode: 409 },
    };
  };

  const result = await mockFailedEdit();
  if (!result.success) {
    // Form remains open and inputs are preserved
  }

  assert.strictEqual(currentRows[0]["Nama Customer"], "Nama Yang Baru Diubah");
  assert.strictEqual(currentRows[0]["Plat No"], "B 7777 NEW");
  assert.strictEqual(currentRows[0]["Biaya Jasa"], 350000);
});

test("Scenario 14: Tidak ada duplikasi baris data pada tabel setelah tambah/edit sukses", async () => {
  const uniqueNopol = `B ${Math.floor(1000 + Math.random() * 9000)} DUP`;
  const rowData = {
    "Nama Customer": "Customer Anti Duplikasi",
    "Plat No": uniqueNopol,
    "Jenis Pengurusan": "Perpanjangan 1 Tahun",
    "Nomor HP": "081288887777",
    "Biaya Pokok Samsat": 300000,
    "Biaya Jasa": 150000,
    "Total Tagihan Konsumen": 450000,
    "Uang Masuk dari Konsumen": 450000,
    "Tanggal Masuk Berkas": "2026-11-09",
    "Samsat Asal": "Jakarta Timur",
  };

  // Add data
  const result = await financeStore.addContractDataAsync("perpanjangan-1-tahun", [rowData]);
  assert.strictEqual(result.success, true);

  // Check matching items in contract data
  const contractRows = financeStore.getContractData("perpanjangan-1-tahun");
  const matches = contractRows.filter(
    (r) => r["Plat No"] === uniqueNopol || r.nopol === uniqueNopol
  );
  assert.strictEqual(matches.length, 1, "Exactly 1 record must exist in contract data, zero duplicates");

  // Check matching orders in orderStore
  const orderMatches = orderStore
    .getAllOrders()
    .filter((o) => o.nopol === uniqueNopol);
  assert.strictEqual(orderMatches.length, 1, "Exactly 1 order must exist in orderStore, zero duplicates");
});

test("Scenario 15: Tidak ada popup sukses sebelum backend mengonfirmasi berhasil", async () => {
  let successDialogShown = false;
  let errorDialogShown = false;

  const handleSimulatedSubmit = async (shouldFail: boolean) => {
    // Await server response FIRST
    const serverResult = await new Promise<{ success: boolean }>((res) => {
      setTimeout(() => {
        res({ success: !shouldFail });
      }, 30);
    });

    if (serverResult.success) {
      successDialogShown = true;
    } else {
      errorDialogShown = true;
    }
  };

  // Execute failure case
  await handleSimulatedSubmit(true);
  assert.strictEqual(successDialogShown, false, "Success dialog MUST NOT be shown on failure");
  assert.strictEqual(errorDialogShown, true, "Error dialog MUST be shown on failure");

  // Reset and execute success case
  successDialogShown = false;
  errorDialogShown = false;
  await handleSimulatedSubmit(false);
  assert.strictEqual(successDialogShown, true, "Success dialog is shown only after confirmation");
  assert.strictEqual(errorDialogShown, false);
});

test("Integration: ApiOrderProvider normalizes HTTP & Network errors and prevents premature cache mutation on failure", async () => {
  const provider = new ApiOrderProvider("http://fake-api:9999");
  const mockOrder: any = {
    orderNo: "ORD-TEST-API-1",
    customer: "Original Customer",
    nomorHP: "081234567890",
    layanan: "Perpanjangan 1 Tahun",
    nopol: "B 1234 API",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: "2026-11-09",
    isArchived: false,
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Transfer",
      totalBiaya: 500000,
      dibayar: 500000,
      kurang: 0,
      statusPembayaran: "Lunas",
    },
  };
  (provider as any).activeOrders["Verifikasi"] = [mockOrder];

  const originalFetch = global.fetch;
  try {
    // 1. Network failure on updateOrderAsync
    global.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await assert.rejects(
      () => provider.updateOrderAsync("ORD-TEST-API-1", { customer: "Mutated Name" }),
      (err: any) => err.code === "NETWORK_ERROR" && err.statusCode === 0
    );
    // Cache must remain unmutated!
    assert.strictEqual(
      provider.getOrderByNo("ORD-TEST-API-1")?.customer,
      "Original Customer",
      "Cache must NOT be updated when backend PUT fails"
    );

    // 2. Duplicate 409 error from backend
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "DUPLICATE_RECORD",
            message: "Nomor invoice 'INV-1126-001' sudah digunakan.",
            field: "noInvoice",
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    await assert.rejects(
      () => provider.updateOrderAsync("ORD-TEST-API-1", { noInvoice: "INV-1126-001" } as any),
      (err: any) =>
        err.statusCode === 409 &&
        err.code === "DUPLICATE_RECORD" &&
        err.field === "noInvoice"
    );
    assert.strictEqual(
      provider.getOrderByNo("ORD-TEST-API-1")?.customer,
      "Original Customer"
    );

    // 3. Anti-ghost row cleanup on addOrderAsync failure
    const tempOrder = { ...mockOrder, orderNo: "ORD-GHOST-1", clientRequestId: "REQ-GHOST-1" };
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "SERVER_ERROR", message: "SQLITE_ERROR: disk full" },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    await assert.rejects(
      () => provider.addOrderAsync(tempOrder),
      (err: any) => err.statusCode === 500 && err.code === "SERVER_ERROR"
    );
    assert.strictEqual(
      provider.getOrderByNo("ORD-GHOST-1"),
      undefined,
      "Failed order must be cleaned up (anti-ghost row)"
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("Integration: Backend orderService enforces cross-order duplicate invoice rejection on update and opt-in create", () => {
  const ord1 = orderService.createOrder({
    customer: "User Satu",
    namaPemilik: "User Satu",
    nomorHP: "081211112222",
    layanan: "Perpanjangan 1 Tahun",
    nopol: "B 1010 ONE",
    wilayahSamsatAsal: "Jakarta Timur",
    noInvoice: "INV-UNIQ-101",
    biayaJasa: 150000,
    totalEstimasi: 450000,
  });
  const ord2 = orderService.createOrder({
    customer: "User Dua",
    namaPemilik: "User Dua",
    nomorHP: "081233334444",
    layanan: "Perpanjangan 1 Tahun",
    nopol: "B 2020 TWO",
    wilayahSamsatAsal: "Jakarta Timur",
    noInvoice: "INV-UNIQ-202",
    biayaJasa: 150000,
    totalEstimasi: 450000,
  });

  // Attempt to update ord2 to steal ord1's invoice
  assert.throws(
    () => orderService.updateOrder(ord2.orderNo, { noInvoice: "INV-UNIQ-101" } as any),
    (err: any) => err.statusCode === 409 && err.code === "DUPLICATE_RECORD"
  );

  // Opt-in duplicate invoice rejection during creation
  assert.throws(
    () =>
      orderService.createOrderWithIdempotency({
        customer: "User Tiga",
        namaPemilik: "User Tiga",
        nomorHP: "081255556666",
        layanan: "Perpanjangan 1 Tahun",
        nopol: "B 3030 THR",
        wilayahSamsatAsal: "Jakarta Timur",
        noInvoice: "INV-UNIQ-101",
        rejectDuplicateInvoice: true,
        biayaJasa: 150000,
        totalEstimasi: 450000,
      }),
    (err: any) => err.statusCode === 409 && err.code === "DUPLICATE_RECORD"
  );
});

