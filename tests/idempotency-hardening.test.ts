/**
 * Idempotency Hardening & DEFECT-E2E-001 Regression Test Suite
 * Project: SUNBiroJasa / Admin SUN89
 * 
 * Verifies 6 Mandatory Requirements:
 * 1. Object payload yang sama dipakai dua kali (Zero in-place mutation of caller's object)
 * 2. Payload baru dengan data bisnis identik
 * 3. Alias nomor HP yang ekuivalen (nomorHp, nomorHP, phone, nomor_hp, noHp, formats)
 * 4. Perbedaan urutan property pada objek input
 * 5. Payload dengan data bisnis berbeda dengan key sama -> melempar IDEMPOTENCY_CONFLICT (422)
 * 6. Concurrent / consecutive duplicate requests produce exactly 1 order
 */

import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { orderService } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { getDb } from "../server/src/database/db";

const testAdmin = {
  userId: "usr-admin-test",
  employeeId: "EMP-0001",
  nama: "Admin Idempotency Test",
  role: "admin",
  jabatan: "Staff Loket"
} as any;

test("DEFECT-E2E-001 IDEMPOTENCY HARDENING & REGRESSION SUITE", async (t) => {
  const db = getDb();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Object payload yang sama dipakai dua kali (No in-place mutation)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("1. Object payload yang sama dipakai dua kali tanpa mutasi referensi asli", () => {
    const key = `idem-same-obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const originalPayload = {
      customer: "Pelanggan Asli",
      nomorHp: "081299991111", // Uses lowercase 'p'
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      nopol: "B 1111 IDM",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      totalBiaya: 500000,
      payment: {
        totalBiaya: 500000,
        dibayar: 500000
      }
    };

    // Snapshot pre-call keys
    const originalKeysBefore = Object.keys(originalPayload).sort();

    // Call 1
    const res1 = orderService.createOrderWithIdempotency(originalPayload, testAdmin, key);
    assert.ok(res1.order, "Order 1 must be created");
    assert.strictEqual(res1.isExisting, false, "Call 1 must create fresh order");

    // Assert caller's memory object was NOT mutated
    assert.deepStrictEqual(Object.keys(originalPayload).sort(), originalKeysBefore, "Object keys must not be mutated");
    assert.strictEqual(originalPayload.nomorHp, "081299991111", "original nomorHp must remain intact");
    assert.strictEqual((originalPayload as any).nomorHP, undefined, "nomorHP must not be injected into caller object");

    // Call 2 with identical object instance
    const res2 = orderService.createOrderWithIdempotency(originalPayload, testAdmin, key);
    assert.ok(res2.order, "Call 2 must return order");
    assert.strictEqual(res2.isExisting, true, "Call 2 must be recognized as existing order (idempotent)");
    assert.strictEqual(res2.order.orderNo, res1.order.orderNo, "Must return identical orderNo");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Payload baru dengan data bisnis identik
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("2. Instance payload baru dengan data bisnis identik mengembalikan order eksisting", () => {
    const key = `idem-fresh-inst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const payloadA = {
      customer: "Hendro Wijaya",
      nomorHP: "081288882222",
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      nopol: "B 2222 IDM",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      totalBiaya: 500000
    };

    const res1 = orderService.createOrderWithIdempotency(payloadA, testAdmin, key);
    assert.strictEqual(res1.isExisting, false);

    // Create brand new object in memory
    const payloadB = {
      customer: "Hendro Wijaya",
      nomorHP: "081288882222",
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      nopol: "B 2222 IDM",
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      totalBiaya: 500000
    };

    const res2 = orderService.createOrderWithIdempotency(payloadB, testAdmin, key);
    assert.strictEqual(res2.isExisting, true);
    assert.strictEqual(res2.order.orderNo, res1.order.orderNo);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Alias nomor HP yang ekuivalen (phone, nomorHp, nomor_hp, noHp, formats)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("3. Alias dan formatting nomor HP yang ekuivalen menghasilkan hash kanonikal yang sama", () => {
    const key = `idem-phone-aliases-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Call 1 with phone alias with hyphens
    const payload1 = {
      customer: "Ratna Sari",
      phone: "0812-7777-3333",
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      nopol: "B 3333 IDM",
      wilayahSamsatAsal: "Jakarta Timur",
      totalBiaya: 500000
    };

    const res1 = orderService.createOrderWithIdempotency(payload1, testAdmin, key);
    assert.strictEqual(res1.isExisting, false);

    // Call 2 with nomor_hp alias with spaces
    const payload2 = {
      customer: "Ratna Sari",
      nomor_hp: "0812 7777 3333",
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      nopol: "B 3333 IDM",
      wilayahSamsatAsal: "Jakarta Timur",
      totalBiaya: 500000
    };

    const res2 = orderService.createOrderWithIdempotency(payload2, testAdmin, key);
    assert.strictEqual(res2.isExisting, true, "phone alias with spaces must resolve to same canonical payload");
    assert.strictEqual(res2.order.orderNo, res1.order.orderNo);

    // Call 3 with canonical nomorHP plain digits
    const payload3 = {
      customer: "Ratna Sari",
      nomorHP: "081277773333",
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      nopol: "B 3333 IDM",
      wilayahSamsatAsal: "Jakarta Timur",
      totalBiaya: 500000
    };

    const res3 = orderService.createOrderWithIdempotency(payload3, testAdmin, key);
    assert.strictEqual(res3.isExisting, true, "canonical nomorHP must match");
    assert.strictEqual(res3.order.orderNo, res1.order.orderNo);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Perbedaan urutan property
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("4. Perbedaan urutan property pada objek input menghasilkan hash kanonikal identik", () => {
    const key = `idem-prop-order-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Key order: customer -> nopol -> nomorHP -> layanan -> totalBiaya
    const order1 = {
      customer: "Dewi Lestari",
      nopol: "B 4444 IDM",
      nomorHP: "081266664444",
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      wilayahSamsatAsal: "Jakarta Timur",
      totalBiaya: 500000
    };

    const res1 = orderService.createOrderWithIdempotency(order1, testAdmin, key);
    assert.strictEqual(res1.isExisting, false);

    // Key order: totalBiaya -> layanan -> nomorHP -> customer -> nopol (completely reversed)
    const order2 = {
      totalBiaya: 500000,
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      wilayahSamsatAsal: "Jakarta Timur",
      nomorHP: "081266664444",
      nopol: "B 4444 IDM",
      customer: "Dewi Lestari"
    };

    const res2 = orderService.createOrderWithIdempotency(order2, testAdmin, key);
    assert.strictEqual(res2.isExisting, true, "Reversed property order must return existing order");
    assert.strictEqual(res2.order.orderNo, res1.order.orderNo);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Payload dengan data bisnis berbeda dengan key sama -> IDEMPOTENCY_CONFLICT (422)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("5. Payload dengan data bisnis berbeda melempar error IDEMPOTENCY_CONFLICT (422)", () => {
    const key = `idem-conflict-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const initialPayload = {
      customer: "Bambang Pamungkas",
      nomorHP: "081255555555",
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      nopol: "B 5555 IDM",
      wilayahSamsatAsal: "Jakarta Timur",
      totalBiaya: 500000
    };

    const res1 = orderService.createOrderWithIdempotency(initialPayload, testAdmin, key);
    assert.strictEqual(res1.isExisting, false);

    // Reusing the same key with different nopol
    const conflictingPayload = {
      customer: "Bambang Pamungkas",
      nomorHP: "081255555555",
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      nopol: "B 9999 DIF", // Different plate!
      wilayahSamsatAsal: "Jakarta Timur",
      totalBiaya: 500000
    };

    assert.throws(
      () => orderService.createOrderWithIdempotency(conflictingPayload, testAdmin, key),
      (err: any) => {
        assert.strictEqual(err.statusCode, 422, "Status code must be 422");
        assert.strictEqual(err.code, "IDEMPOTENCY_CONFLICT", "Error code must be IDEMPOTENCY_CONFLICT");
        return true;
      },
      "Reusing key with different business payload must throw 422 IDEMPOTENCY_CONFLICT"
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Concurrent duplicate request (Atomic reservation safety)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test("6. Concurrent duplicate requests menghasilkan tepat 1 record di database", async () => {
    const key = `idem-concurrent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
      customer: "Andi Concurrency",
      nomorHP: "081244446666",
      layanan: "Perpanjangan 1 Tahun",
      serviceId: "svc-perp-1th",
      nopol: "B 6666 CON",
      wilayahSamsatAsal: "Jakarta Timur",
      totalBiaya: 500000
    };

    // Execute concurrently
    const [call1, call2] = await Promise.all([
      Promise.resolve().then(() => orderService.createOrderWithIdempotency({ ...payload }, testAdmin, key)),
      Promise.resolve().then(() => orderService.createOrderWithIdempotency({ ...payload }, testAdmin, key))
    ]);

    assert.ok(call1.order);
    assert.ok(call2.order);
    assert.strictEqual(call1.order.orderNo, call2.order.orderNo, "Both calls must resolve to the same order");

    // Verify exactly 1 order row in SQLite
    const count = (db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE nopol = ?").get("B 6666 CON") as any).cnt;
    assert.strictEqual(count, 1, "Exactly 1 order record must exist in database");

    // Verify exactly 1 idempotency_keys entry
    const keyRows = db.prepare("SELECT COUNT(*) as cnt FROM idempotency_keys WHERE key = ?").get(key) as any;
    assert.strictEqual(keyRows.cnt, 1, "Exactly 1 key record in idempotency_keys");
  });
});
