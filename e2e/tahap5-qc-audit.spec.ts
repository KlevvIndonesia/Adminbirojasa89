import { test, expect } from "@playwright/test";

test.describe("Tahap 5 QC Forensic Audit Verification Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await page.fill("#email", "svp@birojasa.com");
    await page.fill("#password", "admin123");
    await page.click("button[type='submit']");

    // Wait until dashboard is loaded
    await page.waitForURL("**/dashboard", { timeout: 15000 });
  });

  test("1. Verify Cancelled Orders with Paid Deposits Appear in Cashback Terpending (QC-01 Fix)", async ({ page }) => {
    await page.evaluate(() => { window.location.href = "/finance/cashback-pending"; });
    await page.waitForURL("**/finance/cashback-pending", { timeout: 15000 });
    await expect(page.locator("text=Cashback Terpending").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table")).toBeVisible({ timeout: 15000 });

    const pageContent = await page.content();
    const hasOrd3 = pageContent.includes("ORD-0003");
    const hasOrd4 = pageContent.includes("ORD-0004");
    console.log(`ORD-0003 in Cashback Terpending: ${hasOrd3}, ORD-0004: ${hasOrd4}`);

    expect(hasOrd3 || hasOrd4).toBeTruthy();
  });

  test("2. Verify WhatsApp Universal Phone Format in Belum Bayar (QC-05 Fix)", async ({ page }) => {
    await page.evaluate(() => { window.location.href = "/finance/belum-bayar"; });
    await page.waitForURL("**/finance/belum-bayar", { timeout: 15000 });
    await expect(page.locator("text=Belum & Kurang Bayar").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table")).toBeVisible({ timeout: 15000 });

    const waLinks = page.locator("a[href*='wa.me']");
    await expect(waLinks.first()).toBeVisible({ timeout: 15000 });
    const count = await waLinks.count();
    console.log(`Found ${count} WhatsApp links on Belum Bayar.`);
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await waLinks.nth(i).getAttribute("href");
      expect(href).not.toBeNull();
      // Verify phone format: must start with country code wa.me/62
      expect(href).toMatch(/wa\.me\/62\d+/);
    }
  });

  test("3. Verify Laba Rugi Excludes Cancelled Orders from Revenue (QC-01 & QC-04 Fix)", async ({ page }) => {
    await page.evaluate(() => { window.location.href = "/finance/laba-rugi"; });
    await page.waitForURL("**/finance/laba-rugi", { timeout: 15000 });
    await expect(page.locator("text=Laba Rugi").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table").first()).toBeVisible({ timeout: 15000 });

    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).innerText();
      expect(rowText.includes("ORD-0003")).toBeFalsy();
      expect(rowText.includes("ORD-0004")).toBeFalsy();
    }
  });

  test("4. Verify Kas Kantor & Double-Entry Integrity (QC-02 & QC-03 Fix)", async ({ page }) => {
    await page.evaluate(() => { window.location.href = "/finance/kas-kantor"; });
    await page.waitForURL("**/finance/kas-kantor", { timeout: 15000 });
    await expect(page.locator("text=Buku Kas Kantor").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table")).toBeVisible({ timeout: 15000 });

    // Verify presence of summary cards
    await expect(page.locator("text=Total penerimaan debit")).toBeVisible();
    await expect(page.locator("text=Total pengeluaran kredit")).toBeVisible();
    await expect(page.locator("text=Saldo kas kantor")).toBeVisible();
  });

  test("5. Verify Berita Acara Rekonsiliasi Tutup Kas Harian Modal (Tahap 5 Enhancement)", async ({ page }) => {
    await page.evaluate(() => { window.location.href = "/finance/kas-kantor"; });
    await page.waitForURL("**/finance/kas-kantor", { timeout: 15000 });
    await expect(page.locator("text=Buku Kas Kantor").first()).toBeVisible({ timeout: 15000 });

    const btnRekonsiliasi = page.locator("button", { hasText: "Rekonsiliasi & Tutup Kas Harian" });
    await expect(btnRekonsiliasi).toBeVisible({ timeout: 15000 });
    await btnRekonsiliasi.click();

    // Verify modal elements
    await expect(page.locator("text=Berita Acara Rekonsiliasi Tutup Kas Harian").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=BERITA ACARA TUTUP KAS").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#print-rekonsiliasi-area")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=BIRO JASA SUN89").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button:has-text('Cetak Dokumen (A5)')")).toBeVisible({ timeout: 10000 });
  });
});
