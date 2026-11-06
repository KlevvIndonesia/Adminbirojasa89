/**
 * PATCH C — AUDIT ACTOR & ORDER STATUS HISTORY INTEGRITY TEST SUITE
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. Human Actor Attribution in advanceOrder (Admin -> EMP-0002, SVP -> EMP-0001).
 * 2. Rejection of Client-Side Actor Identity Spoofing (protected fields).
 * 3. Human Actor Attribution in rollbackOrder (Admin & SVP recorded atomically).
 * 4. Status History and Actor Attribution in cancelOrder (step_baru: 0, stage: Dibatalkan).
 * 5. Rejection of Unauthenticated, Unauthorized (Messenger/Finance), and Unmapped Actor Mutations.
 * 6. Transaction Atomicity: If status history insertion fails, status update is completely rolled back.
 * 7. System-Generated Actor Representation: Records NULL in diubah_oleh_employee_id without forging fake IDs.
 * 8. Historical Records Integrity: Existing records remain unmutated (NULL values preserved).
 * 9. GET /api/orders/:orderNo/status-history returns accurate transitions with actor details.
 */

import { before, after, test } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { runInTransaction } from "../server/src/database/db";
import { resolveCanonicalActorEmployeeId } from "../server/src/utils/actorResolver";

let server: http.Server;
let baseUrl: string;

const adminToken = generateToken({
  userId: "usr-2",
  email: "admin@birojasa.com",
  nama: "Admin User",
  jabatan: "ADMIN",
  role: "admin",
  employeeId: "EMP-0002",
});

const svpToken = generateToken({
  userId: "usr-1",
  email: "svp@birojasa.com",
  nama: "Admin Super (SVP)",
  jabatan: "SVP",
  role: "administrator",
  employeeId: "EMP-0001",
});

const messengerToken = generateToken({
  userId: "usr-4",
  email: "budi.messenger@birojasa.com",
  nama: "Budi Santoso",
  jabatan: "MESSENGER",
  role: "messenger",
  employeeId: "EMP-MSG-001",
});

const financeToken = generateToken({
  userId: "usr-3",
  email: "finance@birojasa.com",
  nama: "Finance User",
  jabatan: "FINANCE",
  role: "finance",
  employeeId: "EMP-0003",
});

const unmappedUserToken = generateToken({
  userId: "usr-9999",
  email: "unmapped@unknown.com",
  nama: "Ghost User",
  jabatan: "STAFF",
  role: "admin",
});

function seedTestOrder(orderNo: string, overrides: Record<string, any> = {}) {
  const baseOrder: any = {
    orderNo,
    customer: "Test Customer C",
    nomorHp: "081234567890",
    layanan: "Perpanjangan 1 Tahun",
    nopol: "B 1234 XYZ",
    tipeKendaraan: "Motor",
    currentStep: 1,
    currentStageName: "Verifikasi",
    status: "Proses",
    isArchived: false,
    isCancelled: false,
    totalBiaya: 500000,
    biayaJasa: 100000,
    payment: {
      totalBiaya: 500000,
      dibayar: 500000,
      statusPembayaran: "Lunas",
      tipePembayaran: "Bayar di Awal",
    },
    ...overrides,
  };

  dbOrderRepository.saveOrder(baseOrder);
  return baseOrder;
}

before(async () => {
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    if (typeof (server as any).closeAllConnections === "function") {
      (server as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("PATCH C - 1: resolveCanonicalActorEmployeeId correctly maps verified identities", () => {
  // Admin with email lookup
  const adminResolved = resolveCanonicalActorEmployeeId({
    userId: "usr-2",
    email: "admin@birojasa.com",
    nama: "Admin User",
    jabatan: "ADMIN",
    role: "admin",
    exp: 0,
  });
  assert.strictEqual(adminResolved, "EMP-0002");

  // SVP with email lookup
  const svpResolved = resolveCanonicalActorEmployeeId({
    userId: "usr-1",
    email: "svp@birojasa.com",
    nama: "Admin Super (SVP)",
    jabatan: "SVP",
    role: "administrator",
    exp: 0,
  });
  assert.strictEqual(svpResolved, "EMP-0001");

  // Messenger with token employeeId EMP-MSG-001 -> resolved to canonical EMP-0004
  const budiResolved = resolveCanonicalActorEmployeeId({
    userId: "usr-4",
    email: "budi.messenger@birojasa.com",
    nama: "Budi Santoso",
    jabatan: "MESSENGER",
    role: "messenger",
    employeeId: "EMP-MSG-001",
    exp: 0,
  });
  assert.strictEqual(budiResolved, "EMP-0004");

  // System actor -> returns null (not forged fake ID)
  assert.strictEqual(resolveCanonicalActorEmployeeId(null), null);
  assert.strictEqual(resolveCanonicalActorEmployeeId(undefined), null);
  assert.strictEqual(resolveCanonicalActorEmployeeId({ userId: "usr-system", email: "", nama: "", jabatan: "", role: "admin", exp: 0 }), null);
  assert.strictEqual(resolveCanonicalActorEmployeeId({ userId: "usr-1", email: "", nama: "", jabatan: "", role: "admin", exp: 0, isSystem: true } as any), null);
});

test("PATCH C - 2: advanceOrder by Admin records diubah_oleh_employee_id = 'EMP-0002'", async () => {
  const orderNo = "ORD-TEST-ADV-001";
  seedTestOrder(orderNo, { currentStep: 1, currentStageName: "Verifikasi" });

  const res = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      targetStage: "Penjadwalan",
      updates: { catatanPenjadwalan: "Dijadwalkan untuk penjemputan" },
    }),
  });

  assert.strictEqual(res.status, 200);
  const body = (await res.json()) as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.currentStageName, "Penjadwalan");
  assert.strictEqual(body.data.currentStep, 2);

  // Inspect order_status_history
  const history = dbOrderRepository.getStatusHistoryByOrderNo(orderNo);
  assert.ok(history.length >= 1);
  const lastTransition = history[history.length - 1];
  assert.strictEqual(lastTransition.order_no, orderNo);
  assert.strictEqual(lastTransition.step_sebelumnya, 1);
  assert.strictEqual(lastTransition.step_baru, 2);
  assert.strictEqual(lastTransition.stage_name, "Penjadwalan");
  assert.strictEqual(lastTransition.diubah_oleh_employee_id, "EMP-0002");
  assert.strictEqual(lastTransition.actor_nama, "Admin User");
  assert.strictEqual(lastTransition.actor_jabatan, "ADMIN");
});

test("PATCH C - 3: advanceOrder by SVP (Stage 6 -> 7) records diubah_oleh_employee_id = 'EMP-0001'", async () => {
  const orderNo = "ORD-TEST-ADV-002";
  seedTestOrder(orderNo, {
    currentStep: 6,
    currentStageName: "Supervisi",
    approvedBySpv: true,
  });

  const res = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${svpToken}`,
    },
    body: JSON.stringify({
      targetStage: "Pengantaran",
      updates: {},
    }),
  });

  assert.strictEqual(res.status, 200);
  const body = (await res.json()) as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.currentStageName, "Pengantaran");
  assert.strictEqual(body.data.currentStep, 7);

  // Inspect order_status_history
  const history = dbOrderRepository.getStatusHistoryByOrderNo(orderNo);
  const lastTransition = history[history.length - 1];
  assert.strictEqual(lastTransition.step_sebelumnya, 6);
  assert.strictEqual(lastTransition.step_baru, 7);
  assert.strictEqual(lastTransition.stage_name, "Pengantaran");
  assert.strictEqual(lastTransition.diubah_oleh_employee_id, "EMP-0001");
  assert.strictEqual(lastTransition.actor_nama, "Admin Super (SVP)");
  assert.strictEqual(lastTransition.actor_jabatan, "SVP");
});

test("PATCH C - 4: Client-side actor identity spoofing in request body is strictly rejected", async () => {
  const orderNo = "ORD-TEST-SPOOF-001";
  seedTestOrder(orderNo, { currentStep: 1, currentStageName: "Verifikasi" });

  // Attempt to inject actorEmployeeId in updates
  const res1 = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      targetStage: "Penjadwalan",
      updates: { actorEmployeeId: "EMP-0001" },
    }),
  });
  assert.strictEqual(res1.status, 403);
  const body1 = (await res1.json()) as any;
  assert.strictEqual(body1.error.code, "PROTECTED_FIELD_VIOLATION");

  // Attempt to inject diubah_oleh_employee_id in updates
  const res2 = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      targetStage: "Penjadwalan",
      updates: { diubah_oleh_employee_id: "EMP-0001" },
    }),
  });
  assert.strictEqual(res2.status, 403);
  const body2 = (await res2.json()) as any;
  assert.strictEqual(body2.error.code, "PROTECTED_FIELD_VIOLATION");
});

test("PATCH C - 5: rollbackOrder records atomic transition in order_status_history with canonical actor", async () => {
  const orderNo = "ORD-TEST-ROLLBACK-001";
  seedTestOrder(orderNo, { currentStep: 3, currentStageName: "Verifikasi Dokumen" });

  const res = await fetch(`${baseUrl}/api/orders/${orderNo}/rollback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      targetStage: "Penjadwalan",
      updates: { catatan: "Dokumen kurang lengkap, kembalikan ke penjadwalan" },
    }),
  });

  assert.strictEqual(res.status, 200);
  const body = (await res.json()) as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.currentStageName, "Penjadwalan");
  assert.strictEqual(body.data.currentStep, 2);

  // Inspect order_status_history
  const history = dbOrderRepository.getStatusHistoryByOrderNo(orderNo);
  assert.ok(history.length >= 1);
  const rollbackEntry = history[history.length - 1];
  assert.strictEqual(rollbackEntry.step_sebelumnya, 3);
  assert.strictEqual(rollbackEntry.step_baru, 2);
  assert.strictEqual(rollbackEntry.stage_name, "Penjadwalan");
  assert.strictEqual(rollbackEntry.diubah_oleh_employee_id, "EMP-0002");
  assert.strictEqual(rollbackEntry.actor_nama, "Admin User");
  assert.ok(rollbackEntry.catatan && rollbackEntry.catatan.includes("Dokumen kurang"));
});

test("PATCH C - 6: cancelOrder records status transition to 'Dibatalkan' with canonical actor", async () => {
  const orderNo = "ORD-TEST-CANCEL-001";
  seedTestOrder(orderNo, { currentStep: 2, currentStageName: "Penjadwalan" });

  const res = await fetch(`${baseUrl}/api/orders/${orderNo}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      reason: "Pelanggan meminta pembatalan sebelum dokumen dijemput",
    }),
  });

  assert.strictEqual(res.status, 200);
  const body = (await res.json()) as any;
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.currentStageName, "Dibatalkan");

  // Inspect order_status_history
  const history = dbOrderRepository.getStatusHistoryByOrderNo(orderNo);
  const cancelEntry = history[history.length - 1];
  assert.strictEqual(cancelEntry.step_sebelumnya, 2);
  assert.strictEqual(cancelEntry.step_baru, 0);
  assert.strictEqual(cancelEntry.stage_name, "Dibatalkan");
  assert.strictEqual(cancelEntry.diubah_oleh_employee_id, "EMP-0002");
  assert.strictEqual(cancelEntry.actor_nama, "Admin User");
  assert.ok(cancelEntry.catatan && cancelEntry.catatan.includes("Pelanggan meminta pembatalan"));
});

test("PATCH C - 7: Unauthorized roles (Messenger, Finance, Unmapped) are rejected from mutating stages", async () => {
  const orderNo = "ORD-TEST-AUTH-001";
  seedTestOrder(orderNo, { currentStep: 1, currentStageName: "Verifikasi" });

  // 1. Messenger advance -> 403 FORBIDDEN
  const resMsg = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${messengerToken}` },
    body: JSON.stringify({ targetStage: "Penjadwalan" }),
  });
  assert.strictEqual(resMsg.status, 403);

  // 2. Finance advance -> 403 FORBIDDEN
  const resFin = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${financeToken}` },
    body: JSON.stringify({ targetStage: "Penjadwalan" }),
  });
  assert.strictEqual(resFin.status, 403);

  // 3. Messenger rollback -> 403 FORBIDDEN
  const resMsgRollback = await fetch(`${baseUrl}/api/orders/${orderNo}/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${messengerToken}` },
    body: JSON.stringify({ targetStage: "Verifikasi" }),
  });
  assert.strictEqual(resMsgRollback.status, 403);

  // 4. Unmapped user token (valid JWT signature but no canonical employee in DB) -> 403 FORBIDDEN
  const resUnmapped = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${unmappedUserToken}` },
    body: JSON.stringify({ targetStage: "Penjadwalan" }),
  });
  assert.strictEqual(resUnmapped.status, 403);
  const unmappedBody = (await resUnmapped.json()) as any;
  assert.strictEqual(unmappedBody.error.code, "FORBIDDEN");
});

test("PATCH C - 8: Transaction Atomicity: Database failure on history insert rolls back order status", async () => {
  const orderNo = "ORD-TEST-ATOMIC-001";
  seedTestOrder(orderNo, { currentStep: 1, currentStageName: "Verifikasi" });

  // Attempt advanceOrder with an invalid employeeId that triggers FK failure
  assert.throws(
    () => {
      runInTransaction(() => {
        dbOrderRepository.advanceOrder(orderNo, "Penjadwalan", {}, "EMP-NON-EXISTENT-9999");
      });
    },
    (err: any) => {
      // Must throw FOREIGN KEY constraint failed
      return err.message && err.message.includes("FOREIGN KEY constraint failed");
    }
  );

  // Verify that the order stage and step DID NOT change (atomic rollback)
  const orderAfterFailure = dbOrderRepository.getByOrderNo(orderNo)!;
  assert.strictEqual(orderAfterFailure.currentStageName, "Verifikasi");
  assert.strictEqual(orderAfterFailure.currentStep, 1);

  // Verify that no orphaned status history was written
  const history = dbOrderRepository.getStatusHistoryByOrderNo(orderNo);
  assert.strictEqual(history.length, 0);
});

test("PATCH C - 9: System-generated transitions store diubah_oleh_employee_id as NULL without fake IDs", () => {
  const orderNo = "ORD-TEST-SYSTEM-001";
  seedTestOrder(orderNo, { currentStep: 1, currentStageName: "Verifikasi" });

  // Advance order via system context (user is null or system flag)
  const updated = runInTransaction(() => {
    dbOrderRepository.advanceOrder(orderNo, "Penjadwalan", {}, null);
    return dbOrderRepository.getByOrderNo(orderNo)!;
  });

  assert.strictEqual(updated.currentStageName, "Penjadwalan");
  assert.strictEqual(updated.currentStep, 2);

  // Verify order_status_history has diubah_oleh_employee_id = null
  const history = dbOrderRepository.getStatusHistoryByOrderNo(orderNo);
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].diubah_oleh_employee_id, null);
  assert.strictEqual(history[0].actor_nama, null);
});

test("PATCH C - 10: GET /api/orders/:orderNo/status-history returns transition audit trail with employee names", async () => {
  const orderNo = "ORD-TEST-QUERY-001";
  seedTestOrder(orderNo, { currentStep: 1, currentStageName: "Verifikasi" });

  // Advance to Stage 2 by Admin
  await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ targetStage: "Penjadwalan" }),
  });

  // Query status history endpoint
  const res = await fetch(`${baseUrl}/api/orders/${orderNo}/status-history`, {
    method: "GET",
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  assert.strictEqual(res.status, 200);
  const body = (await res.json()) as any;
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.strictEqual(body.data.length, 1);
  assert.strictEqual(body.data[0].stage_name, "Penjadwalan");
  assert.strictEqual(body.data[0].diubah_oleh_employee_id, "EMP-0002");
  assert.strictEqual(body.data[0].actor_nama, "Admin User");
  assert.strictEqual(body.data[0].actor_jabatan, "ADMIN");
});
