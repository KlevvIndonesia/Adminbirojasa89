import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Phase D: Browser End-to-End Verification (Buat Order -> Order Tracking -> Data Penjualan)", () => {
  test.setTimeout(120000);

  test("D1-D5: Complete lifecycle from UI creation to Data Penjualan & reload persistence", async ({ page }) => {
    page.on("console", (msg) => console.log("[BROWSER CONSOLE]", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("[BROWSER ERROR]", err.message));
    page.on("requestfailed", (req) => console.log("[REQUEST FAILED]", req.url(), req.failure()?.errorText));
    page.on("request", (req) => {
      if (req.url().includes("/api/")) console.log("[API REQ]", req.method(), req.url());
    });
    page.on("response", (res) => {
      if (res.url().includes("/api/")) console.log("[API RES]", res.status(), res.url());
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Authenticate as Super Administrator (SVP)
    // ═══════════════════════════════════════════════════════════════════════════
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", "svp@birojasa.com");
    await page.fill("#password", "admin123");

    const loginPromise = page.waitForResponse(
      (res) => res.url().includes("/api/auth/login") && res.status() === 200
    );
    await page.click("button[type='submit']");
    await loginPromise;
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // ═══════════════════════════════════════════════════════════════════════════
    // D1: Buat Order via UI
    // ═══════════════════════════════════════════════════════════════════════════
    await page.goto(`${BASE_URL}/order/buat`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h4", { hasText: "1. Data Klien & Pemilik Kendaraan" })).toBeVisible({ timeout: 15000 });

    // Fill Step 1 Fields
    const timestamp = Date.now().toString().slice(-4);
    const customerName = `Bambang Browser ${timestamp}`;
    const phone = "081234567890";
    const nopolNum = timestamp;

    // Customer Name
    await page.getByPlaceholder("Nama pemesan atau instansi klien").fill(customerName);

    // Nomor HP
    await page.getByPlaceholder("Contoh: 081234567890").fill(phone);

    // Service: Pilih jenis pengurusan Samsat
    const serviceSelect = page.locator("button", { hasText: "Pilih jenis pengurusan Samsat" }).first();
    await serviceSelect.click();
    await page.waitForTimeout(300);
    const serviceOption = page.locator("[role='option']", { hasText: "Perpanjangan 1 Tahun" }).first();
    await serviceOption.click();

    // Plate Number Inputs
    await page.getByRole("textbox", { name: "Plat Depan (Huruf)" }).fill("B");
    await page.getByRole("textbox", { name: "Nomor Plat (Angka)" }).fill(nopolNum);
    await page.getByRole("textbox", { name: "Plat Belakang (Huruf)" }).fill("E2E");

    // Masa Berlaku PKB
    await page.locator("#input-pkbBerlakuSd").fill("2026-12-31");

    // Detail Alamat Penjemputan (Required for address validation)
    const addressInput = page.getByPlaceholder("Nama jalan, gedung, blok, atau patokan penjemputan berkas");
    if (await addressInput.isVisible()) {
      await addressInput.fill("Jl. Merdeka No. 10 Jakarta Timur");
    }

    await page.waitForTimeout(500);

    // Click "Lanjut ke Dokumen & Pembayaran"
    const nextStepBtn = page.getByRole("button", { name: "Lanjut ke Dokumen & Pembayaran" });
    await expect(nextStepBtn).toBeVisible({ timeout: 10000 });
    await nextStepBtn.click();

    // Step 2: Verify Step 2 reached
    const submitBtn = page.locator("form button[type='submit']");
    await expect(submitBtn).toBeVisible({ timeout: 15000 });

    // Submit Order
    const createOrderResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/orders") && res.request().method() === "POST",
      { timeout: 15000 }
    ).catch((err) => {
      console.log("[WAIT FOR RESPONSE ERROR]", err.message);
      return null;
    });

    await submitBtn.click();
    await page.waitForTimeout(1000);
    const toasts = await page.locator("[data-sonner-toast]").allTextContents();
    console.log("[TOASTS ON SUBMIT]:", toasts);

    const createOrderResponse = await createOrderResponsePromise;
    if (!createOrderResponse) {
      console.log("[CURRENT PAGE URL]:", page.url());
      const pageText = await page.locator("body").innerText();
      console.log("[PAGE SNIPPET]:", pageText.slice(0, 1000));
    }
    expect(createOrderResponse).toBeTruthy();
    const responseData = await createOrderResponse!.json();
    const createdOrderNo = responseData.order?.orderNo || responseData.orderNo || responseData.data?.orderNo;
    expect(createdOrderNo).toBeTruthy();
    console.log("[PHASE D] Created Order via UI:", createdOrderNo);

    // Verify Success Modal appears
    await expect(page.locator("text=Order Berhasil Dibuat").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=${createdOrderNo}`).first()).toBeVisible();

    // ═══════════════════════════════════════════════════════════════════════════
    // D2: Order Tracking View
    // ═══════════════════════════════════════════════════════════════════════════
    const trackOrderBtn = page.getByRole("button", { name: "Lihat Tracking Order" });
    await trackOrderBtn.click();

    await page.waitForURL("**/order/tracking", { timeout: 15000 });
    await expect(page.locator("text=Stage 1").first()).toBeVisible({ timeout: 15000 });

    // Verify order card exists in Order Tracking
    await expect(page.locator(`text=${createdOrderNo}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=${customerName}`).first()).toBeVisible();

    // ═══════════════════════════════════════════════════════════════════════════
    // D3 & D4: Advance to Stage 8 (Menunggu Arsip) -> Verify Data Penjualan -> Arsipkan -> Selesai
    // ═══════════════════════════════════════════════════════════════════════════
    const authToken = await page.evaluate(() => localStorage.getItem("auth_token"));
    expect(authToken).toBeTruthy();
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    };

    // Programmatically advance through sandbox backend API to reach Step 8 smoothly
    // Step 1 -> Step 2: Penjadwalan
    let advRes = await page.request.post(`http://localhost:3001/api/orders/${encodeURIComponent(createdOrderNo)}/advance`, {
      data: { targetStage: "Penjadwalan", updates: { tanggalJemput: "2026-11-08", messenger: "Ahmad Kurir" } },
      headers: authHeaders,
    });
    expect(advRes.ok()).toBeTruthy();

    // Step 2 -> Step 3: Verifikasi Dokumen
    advRes = await page.request.post(`http://localhost:3001/api/orders/${encodeURIComponent(createdOrderNo)}/advance`, {
      data: { targetStage: "Verifikasi Dokumen", updates: { pickupCompleted: true, messengerTaskStatus: "Dokumen Sudah Tersedia" } },
      headers: authHeaders,
    });
    expect(advRes.ok()).toBeTruthy();

    // Step 3 -> Step 4: Proses Samsat
    advRes = await page.request.post(`http://localhost:3001/api/orders/${encodeURIComponent(createdOrderNo)}/advance`, {
      data: { targetStage: "Proses Samsat", updates: { documentsVerified: true } },
      headers: authHeaders,
    });
    expect(advRes.ok()).toBeTruthy();

    // Step 4 -> Step 5: Verifikasi Ulang
    advRes = await page.request.post(`http://localhost:3001/api/orders/${encodeURIComponent(createdOrderNo)}/advance`, {
      data: { targetStage: "Verifikasi Ulang", updates: { samsatProcesses: [{ nama: "Pajak", status: "Selesai" }] } },
      headers: authHeaders,
    });
    expect(advRes.ok()).toBeTruthy();

    // Step 5 -> Step 6: Supervisi
    advRes = await page.request.post(`http://localhost:3001/api/orders/${encodeURIComponent(createdOrderNo)}/advance`, {
      data: {
        targetStage: "Supervisi",
        updates: {
          documentsVerified: true,
        },
      },
      headers: authHeaders,
    });
    expect(advRes.ok()).toBeTruthy();

    // Step 6 -> Step 7: Pengantaran
    advRes = await page.request.post(`http://localhost:3001/api/orders/${encodeURIComponent(createdOrderNo)}/advance`, {
      data: {
        targetStage: "Pengantaran",
        updates: {
          approvedBySpv: true,
        },
      },
      headers: authHeaders,
    });
    expect(advRes.ok()).toBeTruthy();

    // Step 7 -> Step 8: Dokumen Telah Diterima (Terminal Operational Completion)
    advRes = await page.request.post(`http://localhost:3001/api/orders/${encodeURIComponent(createdOrderNo)}/advance`, {
      data: {
        targetStage: "Dokumen Telah Diterima",
        updates: {
          penerimaDokumen: `${customerName} (Penerima Asli)`,
        },
      },
      headers: authHeaders,
    });
    expect(advRes.ok()).toBeTruthy();

    // Navigate to Data Penjualan
    await page.goto(`${BASE_URL}/finance/data-penjualan/perpanjangan-1-tahun`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Data Penjualan").first()).toBeVisible({ timeout: 15000 });

    // Search for the newly created order
    const searchInput = page.locator("input[placeholder*='Cari' i]").first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(createdOrderNo);
      await page.waitForTimeout(500);
    }

    // Verify row appears in Data Penjualan with Status Pengerjaan: "Menunggu Arsip" (BEFORE archival)
    await expect(page.locator(`text=${createdOrderNo}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Menunggu Arsip").first()).toBeVisible({ timeout: 10000 });
    console.log("[PHASE D] Verified: Data Penjualan displays 'Menunggu Arsip' at Step 8 before archival.");

    // Now trigger Formal Archival via API / Archive button
    const archiveRes = await page.request.post(`http://localhost:3001/api/orders/${encodeURIComponent(createdOrderNo)}/archive`, {
      headers: authHeaders,
    });
    expect(archiveRes.ok()).toBeTruthy();
    expect(archiveRes.ok()).toBeTruthy();

    // Reload Data Penjualan page
    await page.reload({ waitUntil: "domcontentloaded" });
    if (await searchInput.isVisible()) {
      await searchInput.fill(createdOrderNo);
      await page.waitForTimeout(500);
    }

    // Verify Status Pengerjaan transitioned from "Menunggu Arsip" -> "Selesai"
    await expect(page.locator(`text=${createdOrderNo}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Selesai").first()).toBeVisible({ timeout: 10000 });
    console.log("[PHASE D] Verified: Status transitioned to 'Selesai' after formal archival.");

    // ═══════════════════════════════════════════════════════════════════════════
    // D5: Reload & Persistence Verification
    // ═══════════════════════════════════════════════════════════════════════════
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(`text=${createdOrderNo}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Selesai").first()).toBeVisible({ timeout: 10000 });
    console.log("[PHASE D] Verified: Complete reload persistence confirmed in real browser.");
  });
});
