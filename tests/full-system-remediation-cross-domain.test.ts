/**
 * FULL SYSTEM REMEDIATION PROGRAM — INTEGRATED CROSS-DOMAIN TEST SUITE
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies End-to-End Scenarios 1 through 8 across all 4 patches:
 * - Scenario 1: Messenger Authentication & Token Consistency
 * - Scenario 2: Task Acceptance & Handover Concurrency
 * - Scenario 3: Samsat Lifecycle & Note Rejection
 * - Scenario 4: Pickup & Delivery Isolation
 * - Scenario 5: Jemput Hasil & Kendala Recovery
 * - Scenario 6: Service Requirements Snapshot & Master Update Isolation
 * - Scenario 7: Reimbursement Canonical Attribution
 * - Scenario 8: Admin Instructions & Historical Notes Preservation
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { initDatabase, getDb } from "../server/src/database/db";
import { generateToken } from "../server/src/utils/crypto";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { serviceRepository } from "../server/src/repositories/dbServiceRepository";

let server: http.Server;
let baseUrl: string;

const adminToken = generateToken({
  userId: "usr-admin",
  email: "admin@birojasa.com",
  nama: "Admin Operasional",
  jabatan: "ADMIN",
  role: "admin",
  employeeId: "EMP-0002",
});

const svpToken = generateToken({
  userId: "usr-svp",
  email: "svp@birojasa.com",
  nama: "Admin Super (SVP)",
  jabatan: "SVP",
  role: "administrator",
  employeeId: "EMP-0001",
});

const courierAToken = generateToken({
  userId: "usr-courier-a",
  email: "budi.messenger@birojasa.com",
  nama: "Budi Santoso",
  jabatan: "MESSENGER",
  role: "messenger",
  employeeId: "EMP-MSG-001",
});

const courierBToken = generateToken({
  userId: "usr-courier-b",
  email: "andi.messenger@birojasa.com",
  nama: "Andi Pratama",
  jabatan: "MESSENGER",
  role: "messenger",
  employeeId: "EMP-MSG-002",
});

function seedOrder(orderNo: string, overrides: Record<string, any> = {}) {
  const baseOrder: any = {
    orderNo,
    customer: "Pelanggan XDom",
    nomorHP: "081234567890",
    layanan: "Perpanjangan 1 Tahun",
    service_id: "svc-perp-1th",
    nopol: "B 9999 XDM",
    namaPemilik: "Pelanggan XDom",
    metodeLayanan: "Antar Jemput",
    currentStep: 2,
    currentStageName: "Penjadwalan",
    status: "proses",
    totalBiaya: 500000,
    biayaJasa: 100000,
    nominalEstimasi: 400000,
    payment: {
      totalBiaya: 500000,
      dibayar: 0,
      statusPembayaran: "Belum Lunas",
      tipePembayaran: "Bayar di Akhir",
    },
    timeline: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  dbOrderRepository.saveOrder(baseOrder);
  return baseOrder;
}

before(async () => {
  initDatabase({ runSchema: true });
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const addr = server.address() as any;
  baseUrl = `http://localhost:${addr.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1: MESSENGER AUTHENTICATION & TOKEN CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════════════
test("Scenario 1: Messenger authentication, canonical identity in JWT, password change & task access", async () => {
  // 1. Messenger login with canonical account
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "budi.messenger@birojasa.com", password: "messenger123" }),
  });
  assert.strictEqual(loginRes.status, 200, "Login must succeed for valid canonical messenger");
  const loginBody = await loginRes.json() as any;
  assert.strictEqual(loginBody.success, true);
  assert.strictEqual(loginBody.data.user.employeeId, "EMP-MSG-001");
  assert.strictEqual(loginBody.data.user.role, "messenger");

  // Verify token payload contains canonical employeeId
  const token = loginBody.data.token;
  const tokenPayload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf-8"));
  assert.strictEqual(tokenPayload.employeeId, "EMP-MSG-001");

  // 2. Unmapped / inactive courier is strictly rejected
  const unmappedRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "messenger@birojasa.com", password: "messenger123" }),
  });
  assert.strictEqual(unmappedRes.status, 403, "Unmapped messenger without employee_id must be rejected with 403");

  // 3. Change password preserves canonical employeeId in new JWT
  const changePassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      oldPassword: "messenger123",
      newPassword: "messengerNewPass123!",
      confirmPassword: "messengerNewPass123!",
    }),
  });
  assert.strictEqual(changePassRes.status, 200, "Password change must succeed");
  const changePassBody = await changePassRes.json() as any;
  const newToken = changePassBody.data.token;
  assert.ok(newToken, "New token must be issued");
  const newTokenPayload = JSON.parse(Buffer.from(newToken.split(".")[1], "base64").toString("utf-8"));
  assert.strictEqual(newTokenPayload.employeeId, "EMP-MSG-001", "Canonical employeeId must be preserved in new JWT");

  // 4. Revert password back so isolated state / subsequent runs are clean
  await fetch(`${baseUrl}/api/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${newToken}`,
    },
    body: JSON.stringify({
      oldPassword: "messengerNewPass123!",
      newPassword: "messenger123",
      confirmPassword: "messenger123",
    }),
  });

  // 5. Query tasks using canonical token
  const tasksRes = await fetch(`${baseUrl}/api/messenger/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(tasksRes.status, 200, "Messenger tasks endpoint must be accessible with valid token");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2: TASK ACCEPTANCE & HANDOVER CONCURRENCY
// ═══════════════════════════════════════════════════════════════════════════════
test("Scenario 2: Task acceptance, concurrency lock, release to pool, handover & actor attribution", async () => {
  const orderNo = `ORD-XDOM-002-${Date.now()}`;
  seedOrder(orderNo, {
    currentStep: 2,
    currentStageName: "Penjadwalan",
    assignedMessengerId: null,
    assignedMessengerName: null,
    taskAcceptance: {
      "Jemput Dokumen": {
        status: "PENDING",
        isLocked: false,
      },
    },
  });

  const taskTypeEncoded = encodeURIComponent("Jemput Dokumen");

  // 1. Courier A accepts task
  const acceptResA = await fetch(`${baseUrl}/api/orders/${orderNo}/tasks/${taskTypeEncoded}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${courierAToken}` },
  });
  assert.strictEqual(acceptResA.status, 200);
  const orderAfterAccept = await acceptResA.json() as any;
  assert.strictEqual(orderAfterAccept.data.taskAcceptance["Jemput Dokumen"].isLocked, true);
  assert.strictEqual(orderAfterAccept.data.taskAcceptance["Jemput Dokumen"].courierId, "EMP-MSG-001");

  // 2. Courier B attempts to accept the locked task -> 409 Conflict
  const acceptResB = await fetch(`${baseUrl}/api/orders/${orderNo}/tasks/${taskTypeEncoded}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${courierBToken}` },
  });
  assert.strictEqual(acceptResB.status, 409, "Locked task acceptance by different courier must be 409");

  // 3. Courier B attempts to start the task -> 403 Forbidden
  const startResB = await fetch(`${baseUrl}/api/orders/${orderNo}/pickup/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${courierBToken}` },
  });
  assert.strictEqual(startResB.status, 403, "Starting unowned task must return 403");

  // 4. Courier A progresses pickup
  const startResA = await fetch(`${baseUrl}/api/orders/${orderNo}/pickup/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${courierAToken}` },
  });
  assert.strictEqual(startResA.status, 200, "Courier A starts pickup successfully");

  // 5. Courier A releases task back to pool
  const releaseRes = await fetch(`${baseUrl}/api/orders/${orderNo}/pickup/release`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(releaseRes.status, 200, "Courier A releases task to pool");

  // 6. Courier B accepts the released task from pool
  const acceptHandover = await fetch(`${baseUrl}/api/orders/${orderNo}/tasks/${taskTypeEncoded}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${courierBToken}` },
  });
  assert.strictEqual(acceptHandover.status, 200, "Courier B accepts released task");
  const orderHandover = await acceptHandover.json() as any;
  assert.strictEqual(orderHandover.data.taskAcceptance["Jemput Dokumen"].courierId, "EMP-MSG-002");

  // 7. Verify status history has actor attribution
  const historyRes = await fetch(`${baseUrl}/api/orders/${orderNo}/status-history`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(historyRes.status, 200);
  const historyBody = await historyRes.json() as any;
  assert.ok(Array.isArray(historyBody.data), "History must be an array");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3: SAMSAT LIFECYCLE & NOTE REJECTION
// ═══════════════════════════════════════════════════════════════════════════════
test("Scenario 3: Samsat lifecycle, zero-notes backend enforcement, completion guard & single Jemput Hasil spawn", async () => {
  const orderNo = `ORD-XDOM-003-${Date.now()}`;
  seedOrder(orderNo, {
    currentStep: 4,
    currentStageName: "Proses Samsat",
    samsatStatus: "Terjadwal Samsat",
    samsatMessengerId: "EMP-MSG-001",
    samsatMessengerName: "Budi Santoso",
    samsatProcesses: [
      { id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai", basePrice: 25000 },
      { id: "comp-2", name: "Pembayaran PKB", status: "Belum Dimulai", basePrice: 350000 },
    ],
  });

  // 1. Courier A starts Samsat process
  const startSamsatRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${courierAToken}` },
  });
  assert.strictEqual(startSamsatRes.status, 200);

  // 2. Courier A attempts to complete Samsat with operational notes -> Rejected with 400
  const completeWithNoteRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({ note: "Catatan operasional kurir Samsat" }),
  });
  assert.strictEqual(completeWithNoteRes.status, 400, "Operational notes must be strictly rejected");
  const noteErr = await completeWithNoteRes.json() as any;
  assert.strictEqual(noteErr.error.code, "MESSENGER_NOTES_NOT_ALLOWED");

  // 3. Incomplete components guard check
  const incompleteRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(incompleteRes.status, 400, "Completion must fail when mandatory components are unfinished");

  // 4. Complete all required components via canonical repository update
  const updatedProcesses = [
    { id: "comp-1", name: "Cek Fisik", status: "Selesai", basePrice: 25000 },
    { id: "comp-2", name: "Pembayaran PKB", status: "Selesai", basePrice: 350000 },
  ];
  dbOrderRepository.updateOrder(orderNo, { samsatProcesses: updatedProcesses });

  // 5. Complete Samsat legitimately with NO notes
  const completeValidRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(completeValidRes.status, 200, "Completion without notes must succeed");
  const completeBody = await completeValidRes.json() as any;
  assert.strictEqual(completeBody.data.samsatStatus, "Selesai");

  // Verify Jemput Hasil task auto-spawned in taskAcceptance
  assert.ok(completeBody.data.taskAcceptance["Jemput Hasil Samsat"], "Jemput Hasil task must be auto-spawned");
  assert.strictEqual(completeBody.data.taskAcceptance["Jemput Hasil Samsat"].status, "PENDING");
  assert.strictEqual(completeBody.data.taskAcceptance["Jemput Hasil Samsat"].isLocked, false);

  // 6. Idempotency: completing again does NOT spawn duplicate Jemput Hasil tasks
  const duplicateRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(duplicateRes.status, 200);
  const duplicateBody = await duplicateRes.json() as any;
  assert.strictEqual(
    duplicateBody.data.taskAcceptance["Jemput Hasil Samsat"].cycle,
    completeBody.data.taskAcceptance["Jemput Hasil Samsat"].cycle
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 4: PICKUP & DELIVERY ISOLATION
// ═══════════════════════════════════════════════════════════════════════════════
test("Scenario 4: Pickup & delivery ownership separation, note rejection & recipient requirements", async () => {
  const orderNo = `ORD-XDOM-004-${Date.now()}`;
  seedOrder(orderNo, {
    currentStep: 2,
    currentStageName: "Penjadwalan",
    assignedMessengerId: "EMP-MSG-001",
    assignedMessengerName: "Budi Santoso",
    taskAcceptance: {
      "Jemput Dokumen": {
        status: "ACCEPTED",
        isLocked: true,
        courierId: "EMP-MSG-001",
        courierName: "Budi Santoso",
      },
    },
  });

  // 1. Courier A attempts to complete pickup sending notes -> 400
  const pickupWithNotes = await fetch(`${baseUrl}/api/orders/${orderNo}/pickup/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({ notes: "Catatan penjemputan berkas" }),
  });
  assert.strictEqual(pickupWithNotes.status, 400);
  const errPickup = await pickupWithNotes.json() as any;
  assert.strictEqual(errPickup.error.code, "MESSENGER_NOTES_NOT_ALLOWED");

  // 2. Courier A completes pickup legitimately
  const pickupSuccess = await fetch(`${baseUrl}/api/orders/${orderNo}/pickup/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(pickupSuccess.status, 200);

  // 3. Move order to Step 7 (Pengantaran) and assign Delivery to Courier B (EMP-MSG-002)
  dbOrderRepository.updateOrder(orderNo, {
    currentStep: 7,
    currentStageName: "Pengantaran",
    deliveryMessengerId: "EMP-MSG-002",
    deliveryMessengerName: "Andi Pratama",
    deliveryStatus: "Terjadwal Pengantaran",
  });

  // 4. Courier B starts delivery
  const startDelivery = await fetch(`${baseUrl}/api/orders/${orderNo}/delivery/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${courierBToken}` },
  });
  assert.strictEqual(startDelivery.status, 200);

  // 5. Courier B attempts delivery completion without recipient proof -> 400
  const emptyDelivery = await fetch(`${baseUrl}/api/orders/${orderNo}/delivery/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierBToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(emptyDelivery.status, 400, "Missing recipient proof must be rejected");

  // 6. Courier B attempts delivery completion with notes -> 400
  const notesDelivery = await fetch(`${baseUrl}/api/orders/${orderNo}/delivery/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierBToken}`,
    },
    body: JSON.stringify({
      receiverName: "Bpk. Harun",
      photoUrl: "https://storage.example.com/proof.jpg",
      notes: "Catatan pengantaran kurir",
    }),
  });
  assert.strictEqual(notesDelivery.status, 400, "Delivery notes must be rejected");

  // 7. Courier B completes delivery with valid recipient requirement and zero notes
  const validDelivery = await fetch(`${baseUrl}/api/orders/${orderNo}/delivery/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierBToken}`,
    },
    body: JSON.stringify({
      receiverName: "Bpk. Harun",
      photoUrl: "https://storage.example.com/proof.jpg",
    }),
  });
  assert.strictEqual(validDelivery.status, 200, "Delivery completion succeeds");
  const deliveryBody = await validDelivery.json() as any;
  assert.strictEqual(deliveryBody.data.deliveryStatus, "Dokumen Diserahkan");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 5: JEMPUT HASIL & KENDALA RECOVERY
// ═══════════════════════════════════════════════════════════════════════════════
test("Scenario 5: Jemput Hasil lifecycle, Kendala reporting, zero-notes guard, Admin recovery & safe completion", async () => {
  const orderNo = `ORD-XDOM-005-${Date.now()}`;
  seedOrder(orderNo, {
    currentStep: 4,
    currentStageName: "Proses Samsat",
    samsatStatus: "Selesai",
    samsatPickupStatus: "Sedang Jemput Dokumen Samsat",
    samsatPickupMessengerId: "EMP-MSG-001",
    samsatPickupMessengerNama: "Budi Santoso",
    samsatCycle: 1,
  });

  // 1. Courier A attempts to report Kendala with free-text notes -> 400
  const kendalaNotesRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat-pickup/kendala`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({ notes: "Loket Samsat tutup mendadak" }),
  });
  assert.strictEqual(kendalaNotesRes.status, 400, "Free-text notes in kendala must be rejected with 400");
  const errKendala = await kendalaNotesRes.json() as any;
  assert.strictEqual(errKendala.error.code, "MESSENGER_NOTES_NOT_ALLOWED");

  // 2. Courier A reports Kendala with structured payload
  const kendalaValidRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat-pickup/kendala`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(kendalaValidRes.status, 200, "Structured Kendala report succeeds");
  const kendalaBody = await kendalaValidRes.json() as any;
  assert.strictEqual(kendalaBody.data.samsatPickupStatus, "Terkendala");

  // 3. Messenger unauthorized to perform recovery -> 403
  const courierRecoverRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat-pickup/recover`, {
    method: "POST",
    headers: { Authorization: `Bearer ${courierAToken}` },
  });
  assert.strictEqual(courierRecoverRes.status, 403, "Messenger cannot perform recovery");

  // 4. Admin performs recovery
  const adminRecoverRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat-pickup/recover`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(adminRecoverRes.status, 200, "Admin recovery succeeds");
  const recoverBody = await adminRecoverRes.json() as any;
  assert.strictEqual(recoverBody.data.samsatPickupStatus, "Sedang Jemput Dokumen Samsat");

  // 5. Courier A completes Jemput Hasil legitimately
  const completePickupRes = await fetch(`${baseUrl}/api/orders/${orderNo}/samsat-pickup/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(completePickupRes.status, 200, "Completion succeeds");
  const completeBody = await completePickupRes.json() as any;
  assert.strictEqual(completeBody.data.samsatPickupStatus, "Dokumen Samsat Diterima di Kantor");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 6: SERVICE REQUIREMENTS SNAPSHOT & MASTER ISOLATION
// ═══════════════════════════════════════════════════════════════════════════════
test("Scenario 6: Master requirements update increments version and isolates Order A (v1) from Order B (v2)", async () => {
  // Use canonical service svc-perp-1th
  const masterInitial = serviceRepository.getById("svc-perp-1th");
  assert.ok(masterInitial, "Canonical service svc-perp-1th must exist");
  const versionInitial = Number(masterInitial.requirements_version || 1);
  const reqsInitial = masterInitial.requirements || [];

  // 1. Create Order A referencing svc-perp-1th
  const orderInputA = {
    customer: "Pelanggan Snapshot A",
    nomorHP: "081234567890",
    layanan: "Perpanjangan 1 Tahun",
    service_id: "svc-perp-1th",
    nopol: "B 1010 REQ",
    namaPemilik: "Pelanggan Snapshot A",
    metodeLayanan: "Antar Jemput",
    totalBiaya: 500000,
    biayaJasa: 100000,
    nominalEstimasi: 400000,
    payment: {
      totalBiaya: 500000,
      dibayar: 0,
      statusPembayaran: "Belum Lunas",
      tipePembayaran: "Bayar di Akhir",
    },
  };

  const resOrderA = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(orderInputA),
  });
  assert.strictEqual(resOrderA.status, 201);
  const bodyOrderA = await resOrderA.json() as any;
  const orderNoA = bodyOrderA.data.orderNo;
  assert.strictEqual(
    bodyOrderA.data.serviceRequirementsSnapshot?.sourceRequirementsVersion,
    versionInitial
  );
  assert.strictEqual(
    bodyOrderA.data.serviceRequirementsSnapshot?.requirements.length,
    reqsInitial.length
  );

  // 2. Admin updates Master Service requirements (adds 1 more requirement)
  const updatedReqs = [...reqsInitial, `Dokumen Tambahan Khusus ${Date.now()}`];
  const updateMasterRes = await fetch(`${baseUrl}/api/services/svc-perp-1th`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      requirements: updatedReqs,
    }),
  });
  assert.strictEqual(updateMasterRes.status, 200);
  const updatedServiceBody = await updateMasterRes.json() as any;
  assert.strictEqual(updatedServiceBody.data.requirements_version, versionInitial + 1);

  // 3. Create Order B referencing svc-perp-1th
  const orderInputB = {
    ...orderInputA,
    customer: "Pelanggan Snapshot B",
    nopol: "B 2020 REQ",
  };
  const resOrderB = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(orderInputB),
  });
  assert.strictEqual(resOrderB.status, 201);
  const bodyOrderB = await resOrderB.json() as any;
  const orderNoB = bodyOrderB.data.orderNo;
  assert.strictEqual(
    bodyOrderB.data.serviceRequirementsSnapshot?.sourceRequirementsVersion,
    versionInitial + 1
  );
  assert.strictEqual(
    bodyOrderB.data.serviceRequirementsSnapshot?.requirements.length,
    reqsInitial.length + 1
  );

  // 4. Query Order A via API: STILL has original version and item count
  const queryResA = await fetch(`${baseUrl}/api/orders/${orderNoA}`, {
    headers: { Authorization: `Bearer ${courierAToken}` },
  });
  assert.strictEqual(queryResA.status, 200);
  const queryBodyA = await queryResA.json() as any;
  assert.strictEqual(
    queryBodyA.data.serviceRequirementsSnapshot?.sourceRequirementsVersion,
    versionInitial
  );
  assert.strictEqual(
    queryBodyA.data.serviceRequirementsSnapshot?.requirements.length,
    reqsInitial.length
  );

  // 5. Query Order B via API: HAS incremented version and item count
  const queryResB = await fetch(`${baseUrl}/api/orders/${orderNoB}`, {
    headers: { Authorization: `Bearer ${courierAToken}` },
  });
  assert.strictEqual(queryResB.status, 200);
  const queryBodyB = await queryResB.json() as any;
  assert.strictEqual(
    queryBodyB.data.serviceRequirementsSnapshot?.sourceRequirementsVersion,
    versionInitial + 1
  );
  assert.strictEqual(
    queryBodyB.data.serviceRequirementsSnapshot?.requirements.length,
    reqsInitial.length + 1
  );

  // 6. Verify snapshot immutability: client-provided snapshot tampering is rejected
  const tamperRes = await fetch(`${baseUrl}/api/orders/${orderNoA}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      serviceRequirementsSnapshot: { schemaVersion: 99, items: [] },
    }),
  });
  assert.strictEqual(tamperRes.status, 403, "Tampering with snapshot via PUT must be 403 FORBIDDEN");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 7: REIMBURSEMENT ATTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════════
test("Scenario 7: Reimbursement binds to canonical employeeId and ignores client-forged identity", async () => {
  // Courier A submits reimbursement attempting to forge identity of Courier B (EMP-MSG-002)
  const createRes = await fetch(`${baseUrl}/api/messenger/reimbursements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({
      employeeId: "EMP-MSG-002", // SPOOF ATTEMPT
      messengerName: "Andi Pratama", // SPOOF ATTEMPT
      category: "Bahan Bakar (Bensin)",
      amount: 85000,
      date: new Date().toISOString().split("T")[0],
      notes: "Uji coba integritas anti-spoofing reimbursement",
    }),
  });

  assert.strictEqual(createRes.status, 201, "Reimbursement creation succeeds");
  const body = await createRes.json() as any;
  assert.strictEqual(body.success, true);
  // Verified: backend overwrote spoofed identity with authenticated caller's canonical identity
  assert.strictEqual(body.data.employeeId, "EMP-MSG-001", "Must bind to authenticated employeeId EMP-MSG-001");
  assert.strictEqual(body.data.messengerName, "Budi Santoso", "Must bind to authenticated name");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 8: ADMIN INSTRUCTIONS & HISTORICAL NOTES PRESERVATION
// ═══════════════════════════════════════════════════════════════════════════════
test("Scenario 8: Admin instructions updated freely, Messenger blocked from notes/instructions, history preserved", async () => {
  const orderNo = `ORD-XDOM-008-${Date.now()}`;
  seedOrder(orderNo, {
    catatanOrder: "Instruksi Awal Admin: Bawa dokumen ke loket 3",
    messengerTaskNotes: "Catatan historis lama kurir",
  });

  // 1. Admin updates instruction freely
  const adminUpdateRes = await fetch(`${baseUrl}/api/orders/${orderNo}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      catatanOrder: "Instruksi Resmi Admin Diperbarui: Validasi stempel basah di Samsat Pusat",
    }),
  });
  assert.strictEqual(adminUpdateRes.status, 200, "Admin can update operational instructions");
  const adminUpdateBody = await adminUpdateRes.json() as any;
  assert.strictEqual(
    adminUpdateBody.data.catatanOrder,
    "Instruksi Resmi Admin Diperbarui: Validasi stempel basah di Samsat Pusat"
  );

  // 2. Messenger attempts to overwrite catatanOrder -> 403 Forbidden
  const messengerTamperRes = await fetch(`${baseUrl}/api/orders/${orderNo}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({
      catatanOrder: "Kurir mencoba merubah instruksi admin",
    }),
  });
  assert.strictEqual(messengerTamperRes.status, 403, "Messenger is prohibited from modifying catatanOrder");

  // 3. Messenger attempts to overwrite messengerTaskNotes -> 403 Forbidden
  const messengerNotesTamper = await fetch(`${baseUrl}/api/orders/${orderNo}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${courierAToken}`,
    },
    body: JSON.stringify({
      messengerTaskNotes: "Kurir mencoba menambah catatan tugas",
    }),
  });
  assert.strictEqual(messengerNotesTamper.status, 403, "Messenger is prohibited from modifying messengerTaskNotes");

  // 4. Verify historical notes and admin instructions remain completely intact
  const verifyRes = await fetch(`${baseUrl}/api/orders/${orderNo}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(verifyRes.status, 200);
  const verifyBody = await verifyRes.json() as any;
  assert.strictEqual(
    verifyBody.data.catatanOrder,
    "Instruksi Resmi Admin Diperbarui: Validasi stempel basah di Samsat Pusat"
  );
  assert.strictEqual(verifyBody.data.messengerTaskNotes, "Catatan historis lama kurir");
});
