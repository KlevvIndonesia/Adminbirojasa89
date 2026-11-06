/**
 * Provider Switching & Mock Mode Regression Test
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies that switching between Mock and API provider functions seamlessly
 * and that Mock mode remains 100% deterministic and independent (Stage 17 & 25).
 */

import test from "node:test";
import assert from "node:assert";
import { OrderRepository } from "../src/data/repositories/orderRepository";
import { MockOrderProvider } from "../src/data/mock/mockOrderProvider";
import { ApiOrderProvider } from "../src/data/api/apiOrderProvider";

test("Provider Switching - OrderRepository switches dynamically between Mock and API providers", () => {
  const repo = new OrderRepository();

  // 1. Initial provider is Mock by default
  const initialProvider = repo.getProvider?.();
  assert.ok(initialProvider instanceof MockOrderProvider);

  // 2. Perform operations in Mock Mode with explicit test fixture
  repo.saveOrder({
    orderNo: "ORD-MOCK-TEST-1",
    customer: "Test Customer Mock",
    nomorHP: "081200001111",
    layanan: "Perpanjangan STNK",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: new Date().toISOString(),
    namaPemilik: "Pemilik Test",
    nopol: "B 1234 TST",
    totalEstimasi: 500000,
  });

  const activeOrders = repo.getActiveOrders();
  assert.ok(activeOrders["Verifikasi"]);
  assert.ok(activeOrders["Verifikasi"].length > 0);

  // 3. Switch to ApiOrderProvider
  const apiProvider = new ApiOrderProvider("http://localhost:3001/api");
  repo.setProvider?.(apiProvider);
  assert.ok(repo.getProvider?.() instanceof ApiOrderProvider);

  // 4. Verify API provider interface contracts match
  const apiActiveOrders = repo.getActiveOrders();
  assert.ok(apiActiveOrders["Verifikasi"]);

  // 5. Switch back to MockProvider (Regression verification)
  repo.setProvider?.(initialProvider);
  assert.ok(repo.getProvider?.() instanceof MockOrderProvider);

  // Verify full deterministic behavior restored
  const restoredOrders = repo.getActiveOrders();
  assert.strictEqual(restoredOrders["Verifikasi"].length, activeOrders["Verifikasi"].length);
});
