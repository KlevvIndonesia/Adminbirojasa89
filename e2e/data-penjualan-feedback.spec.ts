import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Data Penjualan — Mutation Feedback, Validation, Error Handling & Persistence", () => {
  test.setTimeout(120000);

  test("Full Add & Edit mutation feedback lifecycle with real backend & error scenarios", async ({ page }) => {
    const suffix = Date.now().toString().slice(-4);
    const uniqueCustomer = `E2E Feedback ${suffix}`;
    const updatedCustomer = `E2E Updated ${suffix}`;
    const phone = `08129988${suffix}`;
    const expectedPlate = `B ${suffix} EFT`;

    // 1. Login as SVP
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", "svp@birojasa.com");
    await page.fill("#password", "admin123");

    const loginResPromise = page.waitForResponse(
      (res) => res.url().includes("/api/auth/login") && res.status() === 200
    );
    await page.click("button[type='submit']");
    await loginResPromise;
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // 2. Navigate to Data Penjualan
    await page.goto(`${BASE_URL}/finance/data-penjualan/perpanjangan-1-tahun`, {
      waitUntil: "domcontentloaded",
    });
    const addBtn = page.getByRole("button", { name: "Tambah", exact: true });
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();

    const customerInput = page.getByPlaceholder("Contoh: Bpk. Bambang Wijaya");
    const phoneInput = page.getByPlaceholder("Contoh: 081289123456 (minimal 9 digit angka)");
    await expect(customerInput).toBeVisible({ timeout: 10000 });

    // 3. Scenario: Empty Mandatory Fields -> Client Validation Alert
    const saveNewBtn = page.getByRole("button", { name: "Simpan Data Penjualan" });
    await saveNewBtn.click();
    await expect(page.getByText("Data Belum Lengkap")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Nama Customer wajib diisi")).toBeVisible();
    await page.getByRole("button", { name: "Mengerti & Lengkapi Data" }).click();
    await expect(page.getByText("Data Belum Lengkap")).toBeHidden({ timeout: 5000 });

    // Fill required fields
    await customerInput.fill(uniqueCustomer);
    await phoneInput.fill(phone);
    await page.getByRole("textbox", { name: "Plat Depan (Huruf)" }).fill("B");
    await page.getByRole("textbox", { name: "Nomor Plat (Angka)" }).fill(suffix);
    await page.getByRole("textbox", { name: "Plat Belakang (Huruf)" }).fill("EFT");

    // 4. Scenario: Server Error (HTTP 500) + Raw Error Sanitization + Loading State + Preserve Inputs + No Success Popup
    await page.route("**/api/orders", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((r) => setTimeout(r, 450));
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "SQLITE_ERROR: syntax error near SELECT * FROM orders at D:\\Admin\\server\\db.ts:99",
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await saveNewBtn.click();
    const confirmYesBtn = page.getByRole("button", { name: "Ya, Simpan" });
    await expect(confirmYesBtn).toBeVisible({ timeout: 5000 });
    await confirmYesBtn.click();

    // Assert loading indicator & disabled state while request is in flight
    await expect(page.getByText("Menyimpan...").first()).toBeVisible({ timeout: 2000 });

    // Wait for error popup and ensure raw SQL / path is NOT leaked and no success popup appears
    await expect(page.getByText("Gangguan Server")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Server gagal memproses permintaan. Silakan coba kembali beberapa saat lagi.")).toBeVisible();
    await expect(page.getByText("Data Berhasil Ditambahkan")).toHaveCount(0);
    await expect(page.getByText(/SQLITE_ERROR/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Mengerti" }).click();
    await expect(customerInput).toBeVisible();
    await expect(customerInput).toHaveValue(uniqueCustomer);
    await expect(phoneInput).toHaveValue(phone);
    await page.unroute("**/api/orders");

    // 5. Scenario: Network Failure (Aborted Request) + Preserve Inputs
    await page.route("**/api/orders", async (route) => {
      if (route.request().method() === "POST") {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await saveNewBtn.click();
    await page.getByRole("button", { name: "Ya, Simpan" }).click();
    await expect(page.getByText("Koneksi Terputus")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba kembali.")).toBeVisible();
    await expect(page.getByText("Data Berhasil Ditambahkan")).toHaveCount(0);

    await page.getByRole("button", { name: "Mengerti" }).click();
    await expect(customerInput).toHaveValue(uniqueCustomer);
    await page.unroute("**/api/orders");

    // 6. Scenario: Backend Duplicate Conflict (HTTP 409) + Button Recovery
    await page.route("**/api/orders", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: {
              code: "DUPLICATE_RECORD",
              message: "Nomor invoice sudah digunakan.",
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await saveNewBtn.click();
    await page.getByRole("button", { name: "Ya, Simpan" }).click();
    await expect(page.getByRole("heading", { name: "Gagal Menyimpan Data" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Gagal menyimpan data\. Nomor invoice sudah digunakan\./)).toBeVisible();

    await page.getByRole("button", { name: "Mengerti" }).click();
    await expect(saveNewBtn).toBeEnabled();
    await expect(customerInput).toHaveValue(uniqueCustomer);
    await page.unroute("**/api/orders");

    // 7. Scenario: Add Data Success -> Real Backend POST /api/orders -> Table Updated (No Duplicate)
    await saveNewBtn.click();
    const createOrderResPromise = page.waitForResponse(
      (res) => res.url().endsWith("/api/orders") && res.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Ya, Simpan" }).click();
    const createOrderRes = await createOrderResPromise;
    expect([200, 201]).toContain(createOrderRes.status());

    await expect(page.getByText("Data Berhasil Ditambahkan")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Data penjualan berhasil ditambahkan.")).toBeVisible();
    await page.getByRole("button", { name: "Selesai" }).click();

    // Verify row appears cleanly in table without duplication
    const searchInput = page.locator("input[placeholder*='Cari' i]").first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(expectedPlate);
    await page.waitForTimeout(400);

    const matchingRows = page.locator("tbody tr", { hasText: uniqueCustomer });
    await expect(matchingRows).toHaveCount(1, { timeout: 10000 });
    await expect(matchingRows.first()).toContainText(expectedPlate);

    // 8. Scenario: Edit Data -> HTTP 403 Forbidden + Double-Submit Lock + Preserve Input
    await matchingRows.first().getByRole("button", { name: "Ubah transaksi" }).click();
    await expect(customerInput).toBeVisible({ timeout: 10000 });
    await customerInput.fill(updatedCustomer);

    let putAttemptCount = 0;
    const putListener = (req: any) => {
      if (req.url().includes("/api/orders/") && req.method() === "PUT") {
        putAttemptCount++;
      }
    };
    page.on("request", putListener);

    await page.route("**/api/orders/**", async (route) => {
      if (route.request().method() === "PUT") {
        await new Promise((r) => setTimeout(r, 400));
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Anda tidak memiliki izin untuk melakukan perubahan ini.",
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    const saveEditBtn = page.getByRole("button", { name: "Simpan Perubahan" });
    await saveEditBtn.click();
    const editConfirmDialog = page.getByRole("alertdialog", { name: "Konfirmasi Simpan Transaksi" });
    const editConfirmYesBtn = editConfirmDialog.getByRole("button", { name: "Ya, Simpan" });
    await expect(editConfirmYesBtn).toBeVisible({ timeout: 5000 });

    // Trigger rapid double click synchronously in browser DOM to verify double-submit lock
    await editConfirmYesBtn.evaluate((btn: HTMLButtonElement) => {
      btn.click();
      btn.click();
    });

    // While in-flight, confirm button transforms to disabled "Menyimpan..." loading state
    await expect(editConfirmDialog.getByRole("button", { name: "Menyimpan..." })).toBeDisabled();

    await expect(page.getByText("Akses Ditolak")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Anda tidak memiliki izin untuk melakukan perubahan ini.")).toBeVisible();
    await expect(page.getByText("Perubahan Berhasil Disimpan")).toHaveCount(0);
    expect(putAttemptCount).toBe(1);

    await page.getByRole("button", { name: "Mengerti" }).click();
    await expect(saveEditBtn).toBeEnabled();
    await expect(customerInput).toHaveValue(updatedCustomer);
    page.off("request", putListener);
    await page.unroute("**/api/orders/**");

    // 9. Scenario: Edit Data -> HTTP 400 Validation Error with Field Badge
    await page.route("**/api/orders/**", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Nomor polisi (nopol) tidak boleh kosong.",
              field: "nopol",
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await saveEditBtn.click();
    await page.getByRole("button", { name: "Ya, Simpan" }).click();
    await expect(page.getByRole("heading", { name: "Gagal Menyimpan Data" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Kolom: nopol")).toBeVisible();
    await expect(page.getByText(/Gagal menyimpan data\. Nomor polisi \(nopol\) tidak boleh kosong\./)).toBeVisible();
    await page.getByRole("button", { name: "Mengerti" }).click();
    await expect(customerInput).toHaveValue(updatedCustomer);
    await page.unroute("**/api/orders/**");

    // 10. Scenario: Edit Data Success -> Real Backend PUT /api/orders/:orderNo -> Persist After Reload
    await saveEditBtn.click();
    const updateOrderResPromise = page.waitForResponse(
      (res) => res.url().includes("/api/orders/") && res.request().method() === "PUT"
    );
    await page.getByRole("button", { name: "Ya, Simpan" }).click();
    const updateOrderRes = await updateOrderResPromise;
    expect(updateOrderRes.status()).toBe(200);

    await expect(page.getByText("Perubahan Berhasil Disimpan")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Data penjualan berhasil diperbarui.")).toBeVisible();
    await page.getByRole("button", { name: "Selesai" }).click();

    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill(expectedPlate);
    await page.waitForTimeout(400);
    const updatedRows = page.locator("tbody tr", { hasText: updatedCustomer });
    await expect(updatedRows).toHaveCount(1, { timeout: 10000 });

    // Reload browser page and verify persisted in sandbox database
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill(expectedPlate);
    await page.waitForTimeout(400);
    await expect(page.locator("tbody tr", { hasText: updatedCustomer })).toHaveCount(1, { timeout: 10000 });
  });
});
