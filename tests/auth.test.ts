import test from "node:test";
import assert from "node:assert";
import { userRepository } from "../src/data/repositories/userRepository";
import { MockUserProvider } from "./fixtures/mock/mockUserProvider";

const mockProvider = new MockUserProvider();
userRepository.setProvider(mockProvider);

test("Authentication - Valid credentials authenticate successfully with correct roles", async () => {
  // 1. Superadmin (SVP) login
  const adminRes = await userRepository.authenticate("svp@birojasa.com", "admin123");
  assert.ok(adminRes !== null, "Admin login should succeed");
  assert.strictEqual(adminRes?.role, "administrator");
  assert.strictEqual(adminRes?.name, "Admin Super (SVP)");

  // 2. Finance login
  const financeRes = await userRepository.authenticate("finance@birojasa.com", "finance123");
  assert.ok(financeRes !== null, "Finance login should succeed");
  assert.strictEqual(financeRes?.role, "finance");

  // 3. Admin login
  const svpRes = await userRepository.authenticate("admin@birojasa.com", "admin123");
  assert.ok(svpRes !== null, "Admin login should succeed");
  assert.strictEqual(svpRes?.role, "admin");

  // 4. Messenger login
  const messengerRes = await userRepository.authenticate("messenger@birojasa.com", "messenger123");
  assert.ok(messengerRes !== null, "Messenger login should succeed");
  assert.strictEqual(messengerRes?.role, "messenger");
});

test("Authentication - Invalid credentials are appropriately rejected returning null", async () => {
  // Wrong password
  const wrongPass = await userRepository.authenticate("admin@birojasa.com", "wrongpass");
  assert.strictEqual(wrongPass, null, "Wrong password should return null");

  // Unknown email
  const wrongEmail = await userRepository.authenticate("unknown@domain.com", "password");
  assert.strictEqual(wrongEmail, null, "Unknown email should return null");

  // Empty credentials
  const emptyRes = await userRepository.authenticate("", "");
  assert.strictEqual(emptyRes, null, "Empty credentials should return null");
});

test("Authentication - getDemoCredentials provides valid session stubs", () => {
  const demos = mockProvider.getDemoCredentials();
  assert.ok(demos !== null && typeof demos === "object");

  const entries = Object.values(demos);
  assert.ok(entries.length >= 4, "Should have at least 4 demo accounts");

  const roles = entries.map((d: any) => d.role);
  assert.ok(roles.includes("administrator"));
  assert.ok(roles.includes("finance"));
  assert.ok(roles.includes("admin"));
  assert.ok(roles.includes("messenger"));
});
