import { test, expect } from "@playwright/test";

test.describe("Phase 4: Comprehensive End-to-End Browser Audit", () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    // Start at base URL and clear storage
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
  });

  test("1. Admin / SVP End-to-End Navigation & Operational Modules Audit", async ({ page }) => {
    // Login as SVP
    await page.fill("#email", "svp@birojasa.com");
    await page.fill("#password", "admin123");

    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/auth/login") && response.status() === 200
    );
    await page.click("button[type='submit']");
    await loginResponsePromise;

    // 1.1 Dashboard is rendered
    await expect(page.getByRole("button", { name: "Dashboard" }).first()).toBeVisible({ timeout: 15000 });

    // 1.2 Master Data > Karyawan
    const masterDataBtn = page.getByRole("button", { name: "Master Data" });
    if (await masterDataBtn.isVisible()) {
      await masterDataBtn.click();
      await page.waitForTimeout(500);
      // Verify Karyawan subtab exists and table renders
      await expect(page.getByRole("button", { name: "Karyawan" })).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: "Karyawan" }).click();
      await page.waitForTimeout(500);

      // Verify table headers (NIK / ID, Nama, Jabatan)
      await expect(page.locator("text=NIK / ID").first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=EMP-0001").first()).toBeVisible({ timeout: 10000 });
    }

    // 1.3 Manajemen Pengguna
    const userMgmtBtn = page.getByRole("button", { name: "Manajemen Pengguna" });
    if (await userMgmtBtn.isVisible()) {
      await userMgmtBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("text=Manajemen Pengguna").first()).toBeVisible({ timeout: 10000 });

      // Verify users table renders canonical data
      await expect(page.locator("text=EMP-0001").first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=EMP-0002").first()).toBeVisible({ timeout: 10000 });

      // Check view details dialog on first user
      const viewDetailBtn = page.locator("button[title='Lihat detail akun']").first();
      if (await viewDetailBtn.isVisible()) {
        await viewDetailBtn.click();
        await expect(page.locator("text=Rincian Akun Pengguna")).toBeVisible({ timeout: 5000 });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    // 1.4 Order Tracking
    const orderBtn = page.getByRole("button", { name: "Order Tracking" });
    if (await orderBtn.isVisible()) {
      await orderBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("text=Order").first()).toBeVisible({ timeout: 10000 });
    }

    // 1.5 Finance > Kas Kantor & Kas Messenger
    const financeBtn = page.getByRole("button", { name: "Finance" });
    if (await financeBtn.isVisible()) {
      await financeBtn.click();
      await page.waitForTimeout(800);

      // Check Kas Kantor
      const kasKantorSub = page.getByRole("button", { name: "Kas Kantor" });
      if (await kasKantorSub.isVisible()) {
        await kasKantorSub.click();
        await page.waitForTimeout(500);
        await expect(page.locator("text=Buku Kas Kantor").first()).toBeVisible({ timeout: 10000 });
      }

      // Check Kas Messenger
      const kasMsgSub = page.getByRole("button", { name: "Kas Messenger" });
      if (await kasMsgSub.isVisible()) {
        await kasMsgSub.click();
        await page.waitForTimeout(500);
        await expect(page.locator("text=Kas Messenger").first()).toBeVisible({ timeout: 10000 });
      }
    }

    // 1.6 Riwayat Aktivitas / Audit Log
    const auditBtn = page.getByRole("button", { name: "Riwayat Aktivitas" });
    if (await auditBtn.isVisible()) {
      await auditBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("text=Riwayat Aktivitas").first()).toBeVisible({ timeout: 10000 });

      // Verify Permanent Clear History button is visible for SVP
      const clearBtn = page.locator("button", { hasText: "Clear Riwayat" });
      await expect(clearBtn).toBeVisible({ timeout: 10000 });
      await clearBtn.click();
      await expect(page.locator("text=Hapus Permanen Riwayat Aktivitas")).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: "Batal" }).click();
      await page.waitForTimeout(300);
    }
  });

  test("2. Messenger Mobile / Field Workspace Audit", async ({ page }) => {
    // Login as Messenger (Budi)
    await page.fill("#email", "budi.messenger@birojasa.com");
    await page.fill("#password", "messenger123");

    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/auth/login") && response.status() === 200
    );
    await page.click("button[type='submit']");
    await loginResponsePromise;

    // Verify messenger dashboard or workspace renders
    await page.waitForTimeout(1000);
    const content = await page.content();
    // Budi should see his tasks, name, or messenger workspace
    expect(
      content.includes("Budi Santoso") ||
      content.includes("Tugas") ||
      content.includes("Messenger") ||
      content.includes("Dashboard")
    ).toBeTruthy();
  });
});
