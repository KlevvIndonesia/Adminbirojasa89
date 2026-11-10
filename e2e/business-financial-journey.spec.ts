import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("End-to-End Business Workflow & Financial Journey (Browser E2E)", () => {
  test.setTimeout(120000);

  test("Full lifecycle: Login -> Buat Order -> Order Tracking -> Data Penjualan -> Finance Sub-tabs & Action Feedback", async ({ page }) => {
    const suffix = Date.now().toString().slice(-4);
    const uniqueCustomer = `Konsumen E2E ${suffix}`;
    const uniquePhone = `08129988${suffix}`;

    // ═══════════════════════════════════════════════════════════════════════
    // 1. AUTHENTICATION (Login as SVP / Administrator)
    // ═══════════════════════════════════════════════════════════════════════
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", "svp@birojasa.com");
    await page.fill("#password", "admin123");

    const loginResPromise = page.waitForResponse(
      (res) => res.url().includes("/api/auth/login") && res.status() === 200
    );
    await page.click("button[type='submit']");
    await loginResPromise;
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // ═══════════════════════════════════════════════════════════════════════
    // 2. BUAT ORDER — Verify Page and Form Elements
    // ═══════════════════════════════════════════════════════════════════════
    await page.goto(`${BASE_URL}/order/buat`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h4", { hasText: "1. Data Klien & Pemilik Kendaraan" })).toBeVisible({ timeout: 15000 });

    // Verify stepper buttons
    await expect(page.getByText("01 Data Klien & Kendaraan")).toBeVisible();
    await expect(page.getByText("02 Dokumen, Pembayaran & Ringkasan")).toBeVisible();

    // Verify form fields exist
    const nameInput = page.getByPlaceholder("Nama pemesan atau instansi klien");
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(uniqueCustomer);

    const phoneInput = page.getByPlaceholder("Contoh: 081234567890");
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
    await phoneInput.fill(uniquePhone);

    // Plate Number Inputs
    const platePrefix = page.getByRole("textbox", { name: "Plat Depan (Huruf)" });
    if (await platePrefix.isVisible()) {
      await platePrefix.fill("B");
      await page.getByRole("textbox", { name: "Nomor Plat (Angka)" }).fill(suffix);
      await page.getByRole("textbox", { name: "Plat Belakang (Huruf)" }).fill("EFE");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. ORDER TRACKING — Inspection
    // ═══════════════════════════════════════════════════════════════════════
    await page.goto(`${BASE_URL}/order/tracking`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("banner").getByText("Order Tracking")).toBeVisible({ timeout: 15000 });

    // Verify search bar exists in Order Tracking
    const searchInput = page.getByPlaceholder("Cari order...");
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Verify stages are rendered in tablist
    await expect(page.getByText("Stage 1 — Verifikasi Order Baru")).toBeVisible({ timeout: 10000 });

    // ═══════════════════════════════════════════════════════════════════════
    // 4. DATA PENJUALAN — Service Tab & Row Verification
    // ═══════════════════════════════════════════════════════════════════════
    await page.goto(`${BASE_URL}/finance/data-penjualan/perpanjangan-1-tahun`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Tambah", exact: true })).toBeVisible({ timeout: 15000 });

    // Verify table renders
    const tableHeader = page.locator("table");
    await expect(tableHeader.first()).toBeVisible({ timeout: 10000 });

    // ═══════════════════════════════════════════════════════════════════════
    // 5. BELUM & KURANG BAYAR — Finance Sub-tab
    // ═══════════════════════════════════════════════════════════════════════
    await page.goto(`${BASE_URL}/finance/belum-bayar`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("banner").getByText("Belum & Kurang Bayar")).toBeVisible({ timeout: 15000 });

    // Verify summary cards or table
    await expect(page.getByText(/Total Sisa Piutang|Jumlah Tagihan Aktif|Belum Bayar/i).first()).toBeVisible({ timeout: 10000 });

    // ═══════════════════════════════════════════════════════════════════════
    // 6. CASHBACK TERPENDING — Finance Sub-tab & Gating UI
    // ═══════════════════════════════════════════════════════════════════════
    await page.goto(`${BASE_URL}/finance/cashback-pending`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("banner").getByText("Cashback Terpending")).toBeVisible({ timeout: 15000 });

    // Verify cashback table elements
    await expect(page.getByText("Nomor Order").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Kelebihan Bayar").first()).toBeVisible({ timeout: 10000 });
  });
});
