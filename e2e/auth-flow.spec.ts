import { test, expect } from "@playwright/test";

test.describe("E2E Test 1 & 9 & 10: Authentication, Refresh & Persistence", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("http://localhost:3000");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("1.1 Valid credentials login succeeds and establishes real session", async ({ page }) => {
    await page.goto("http://localhost:3000");
    
    // Fill credentials
    await page.fill("#email", "admin@birojasa.com");
    await page.fill("#password", "admin123");
    
    // Wait for network response on login
    const loginResponsePromise = page.waitForResponse(response => 
      response.url().includes("/api/auth/login") && response.status() === 200
    );
    
    await page.click("button[type='submit']");
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.ok()).toBeTruthy();

    // Verify localStorage has real auth token
    await page.waitForTimeout(500);
    const token = await page.evaluate(() => window.localStorage.getItem("auth_token"));
    expect(token).toBeTruthy();
    expect(token?.split(".").length).toBe(3);

    // Verify dashboard / main app appears
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await expect(page.getByText("Dashboard").first()).toBeVisible();
  });

  test("1.2 Missing password triggers HTML5/client validation without session", async ({ page }) => {
    await page.goto("http://localhost:3000");
    
    await page.fill("#email", "admin@birojasa.com");
    // Leave password empty
    await page.click("button[type='submit']");

    // Form should not submit, token should remain null
    const token = await page.evaluate(() => window.localStorage.getItem("auth_token"));
    expect(token).toBeNull();
  });

  test("1.3 Invalid password displays error message and issues NO token", async ({ page }) => {
    await page.goto("http://localhost:3000");
    
    await page.fill("#email", "admin@birojasa.com");
    await page.fill("#password", "WrongPassword123!");
    
    const loginResponsePromise = page.waitForResponse(response => 
      response.url().includes("/api/auth/login") && response.status() === 401
    );
    
    await page.click("button[type='submit']");
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(401);

    // Verify token is NOT set in localStorage
    await page.waitForTimeout(500);
    const token = await page.evaluate(() => window.localStorage.getItem("auth_token"));
    expect(token).toBeNull();

    // User remains on login screen
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("1.4 Backend unavailable returns error with ZERO mock fallback in API mode", async ({ page }) => {
    await page.goto("http://localhost:3000");

    // Intercept backend login to simulate server outage (503 Service Unavailable)
    await page.route("**/api/auth/login", route => {
      route.abort("failed");
    });

    await page.fill("#email", "admin@birojasa.com");
    await page.fill("#password", "admin123");
    await page.click("button[type='submit']");

    // Wait and verify user is NOT logged in via fake demo credentials
    await page.waitForTimeout(1500);
    const token = await page.evaluate(() => window.localStorage.getItem("auth_token"));
    expect(token).toBeNull();

    // Verify user remains on the login screen
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("9.1 Refresh persistence preserves authenticated session across browser reloads", async ({ page }) => {
    await page.goto("http://localhost:3000");
    
    // Login
    await page.fill("#email", "admin@birojasa.com");
    await page.fill("#password", "admin123");
    
    const loginResponsePromise = page.waitForResponse(response => 
      response.url().includes("/api/auth/login") && response.status() === 200
    );
    
    await page.click("button[type='submit']");
    await loginResponsePromise;
    await page.waitForTimeout(500);

    // Verify logged in
    const tokenBefore = await page.evaluate(() => window.localStorage.getItem("auth_token"));
    expect(tokenBefore).toBeTruthy();

    // Reload browser page
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify session remains active in localStorage and UI displays dashboard
    const tokenAfter = await page.evaluate(() => window.localStorage.getItem("auth_token"));
    expect(tokenAfter).toBe(tokenBefore);
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await expect(page.getByText("Dashboard").first()).toBeVisible();
  });
});
