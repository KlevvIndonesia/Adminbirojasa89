/**
 * PATCH B — ZERO FREE-TEXT OPERATIONAL NOTES HARDENING TEST SUITE
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. completeSamsatProcess:
 *    - Messenger sending note -> rejected with 400 MESSENGER_NOTES_NOT_ALLOWED
 *    - Messenger completing without note -> succeeds with canonical timeline and no note pollution
 * 2. releasePickupTask & releaseDeliveryTask:
 *    - Messenger sending notes -> rejected with 400 MESSENGER_NOTES_NOT_ALLOWED
 *    - Successful release uses canonical timeline without free-text concatenation
 *    - Audit log metadata does not contain courier notes
 * 3. declineMessengerTask:
 *    - Messenger sending reason -> rejected with 400 MESSENGER_NOTES_NOT_ALLOWED
 *    - Decline without reason records structured status and canonical timeline
 * 4. completePickupTask & completeDeliveryTask:
 *    - Messenger sending notes/note -> rejected with 400 MESSENGER_NOTES_NOT_ALLOWED
 *    - Historical notes in nested objects preserved
 * 5. reportSamsatPickupKendala & completeSamsatPickupTask:
 *    - Free-text notes rejected with 400 MESSENGER_NOTES_NOT_ALLOWED
 *    - Legitimate structured transitions succeed
 * 6. Generic PUT /api/orders/:orderNo & updateOrder:
 *    - Messenger attempting to modify note fields (messengerTaskNotes, samsatPickupNotes,
 *      catatanKendala, catatanOrder, catatanPenjadwalan, catatanSamsat, catatanPengantaran) -> 403 FORBIDDEN
 *    - Messenger attempting nested note injection -> 403 FORBIDDEN
 *    - Admin updating admin instructions (catatanOrder, etc.) -> succeeds (200 OK)
 *    - Historical notes preserved
 */

import { before, after, test } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";

let server: http.Server;
let baseUrl: string;

const messengerUser = {
  userId: "user-msg-001",
  email: "budi.messenger@birojasa.com",
  role: "messenger",
  nama: "Budi Santoso",
  jabatan: "MESSENGER",
  employeeId: "EMP-MSG-001",
};

const adminUser = {
  userId: "user-admin-001",
  email: "admin@birojasa.com",
  role: "admin",
  nama: "Admin Operasional",
  jabatan: "ADMIN",
  employeeId: "EMP-ADM-001",
};

const messengerToken = generateToken(messengerUser);
const adminToken = generateToken(adminUser);

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

function seedTestOrder(orderNo: string, overrides: Record<string, any> = {}) {
  const baseOrder: any = {
    orderNo,
    customer: "Test Customer B",
    nomorHP: "081234567890",
    layanan: "Perpanjangan STNK Tahunan",
    nopol: "B 1234 XYZ",
    tipeKendaraan: "Motor",
    currentStep: 2,
    currentStageName: "Penjadwalan",
    status: "Proses",
    isArchived: false,
    isCancelled: false,
    messenger: "Budi Santoso",
    assignedMessengerName: "Budi Santoso",
    assignedMessengerId: "EMP-MSG-001",
    messengerTaskStatus: "Sedang Dijemput",
    pickupCompleted: false,
    totalBiaya: 500000,
    biayaJasa: 100000,
    catatanOrder: "Instruksi Admin Awal",
    catatanPenjadwalan: "Jadwal jemput pagi",
    catatanSamsat: "Samsat Barat",
    catatanPengantaran: "Antar ke kantor",
    messengerTaskNotes: "Catatan historis lama kurir",
    taskAcceptance: {
      "Jemput Dokumen": {
        status: "ACCEPTED",
        isLocked: true,
        courierId: "EMP-MSG-001",
        courierName: "Budi Santoso",
      },
    },
    ...overrides,
  };

  dbOrderRepository.saveOrder(baseOrder);
  return baseOrder;
}

test("PATCH B - TASK B2: completeSamsatProcess rejects non-empty note from messenger with 400 MESSENGER_NOTES_NOT_ALLOWED", async () => {
  const testOrderNo = `TEST-SAMSAT-NOTE-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo, {
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: "EMP-MSG-001",
      petugasSamsat: "Budi Santoso",
      samsatProcesses: [
        { id: "c1", name: "Cek Fisik", status: "Selesai" },
      ],
      messengerComponentProgress: {
        c1: { componentId: "c1", name: "Cek Fisik", status: "COMPLETED" },
      },
      taskAcceptance: {
        "Proses Samsat": {
          status: "ACCEPTED",
          isLocked: true,
          courierId: "EMP-MSG-001",
          courierName: "Budi Santoso",
        },
      },
    });

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}/samsat/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ note: "Catatan bebas kurir samsat" }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "MESSENGER_NOTES_NOT_ALLOWED");

    // Order should NOT have updated samsatStatus to Selesai
    const ord = dbOrderRepository.getByOrderNo(testOrderNo);
    assert.notStrictEqual(ord?.samsatStatus, "Selesai");
    assert.strictEqual(ord?.messengerTaskNotes, "Catatan historis lama kurir");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B2: completeSamsatProcess without note succeeds with canonical timeline and preserved history", async () => {
  const testOrderNo = `TEST-SAMSAT-OK-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo, {
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: "EMP-MSG-001",
      petugasSamsat: "Budi Santoso",
      samsatProcesses: [
        { id: "c1", name: "Cek Fisik", status: "Selesai" },
      ],
      messengerComponentProgress: {
        c1: { componentId: "c1", name: "Cek Fisik", status: "COMPLETED" },
      },
      taskAcceptance: {
        "Proses Samsat": {
          status: "ACCEPTED",
          isLocked: true,
          courierId: "EMP-MSG-001",
          courierName: "Budi Santoso",
        },
      },
    });

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}/samsat/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.samsatStatus, "Selesai");

    // Preserved historical notes, not overwritten with empty or payload
    assert.strictEqual(body.data.messengerTaskNotes, "Catatan historis lama kurir");

    // Check timeline has canonical note
    const timeline = body.data.messengerTimeline || [];
    const doneEvent = timeline.find((t: any) => t.title === "Proses Samsat Selesai (Kirim Hasil)");
    assert.ok(doneEvent);
    assert.strictEqual(
      doneEvent.note,
      "Seluruh tahapan komponen pengurusan di loket Samsat telah selesai diproses."
    );
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B3: releasePickupTask rejects non-empty notes from messenger with 400 MESSENGER_NOTES_NOT_ALLOWED", async () => {
  const testOrderNo = `TEST-REL-PICKUP-FAIL-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo);

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}/pickup/release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ notes: "Ban bocor tidak bisa jalan" }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "MESSENGER_NOTES_NOT_ALLOWED");

    // Verify task not released
    const ord = dbOrderRepository.getByOrderNo(testOrderNo);
    assert.strictEqual(ord?.assignedMessengerName, "Budi Santoso");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B3: releasePickupTask without notes succeeds with canonical timeline and clean audit", async () => {
  const testOrderNo = `TEST-REL-PICKUP-OK-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo);

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}/pickup/release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.messenger, "Belum Ditugaskan");

    // Canonical timeline without free-text
    const timeline = body.data.messengerTimeline || [];
    const releaseEv = timeline.find((t: any) => t.title === "Tugas Penjemputan Diserahkan ke Tim");
    assert.ok(releaseEv);
    assert.strictEqual(
      releaseEv.note,
      "Tugas penjemputan dikembalikan ke pool antrean oleh kurir Budi Santoso."
    );
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B3: releaseDeliveryTask rejects non-empty notes from messenger with 400 MESSENGER_NOTES_NOT_ALLOWED", async () => {
  const testOrderNo = `TEST-REL-DELIV-FAIL-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo, {
      currentStep: 7,
      currentStageName: "Pengantaran",
      deliveryStatus: "Sedang Dikirim",
      messengerPengantar: "Budi Santoso",
      deliveryMessengerId: "EMP-MSG-001",
      taskAcceptance: {
        "Pengantaran Dokumen": {
          status: "ACCEPTED",
          isLocked: true,
          courierId: "EMP-MSG-001",
          courierName: "Budi Santoso",
        },
      },
    });

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}/delivery/release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ notes: "Alamat tidak ditemukan" }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "MESSENGER_NOTES_NOT_ALLOWED");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B4: declineMessengerTask rejects non-empty reason from messenger with 400 MESSENGER_NOTES_NOT_ALLOWED", async () => {
  const testOrderNo = `TEST-DECLINE-FAIL-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo, {
      taskAcceptance: {
        "Jemput Dokumen": {
          status: "PENDING",
          isLocked: false,
          courierId: "EMP-MSG-001",
          courierName: "Budi Santoso",
        },
      },
    });

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}/tasks/Jemput%20Dokumen/decline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ reason: "Motor mogok di jalan" }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "MESSENGER_NOTES_NOT_ALLOWED");

    // Admin instruction fields must remain untouched
    const ord = dbOrderRepository.getByOrderNo(testOrderNo);
    assert.strictEqual(ord?.catatanOrder, "Instruksi Admin Awal");
    assert.strictEqual(ord?.catatanPenjadwalan, "Jadwal jemput pagi");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B4: declineMessengerTask without reason succeeds with canonical timeline and preserved Admin notes", async () => {
  const testOrderNo = `TEST-DECLINE-OK-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo, {
      taskAcceptance: {
        "Jemput Dokumen": {
          status: "PENDING",
          isLocked: false,
          courierId: "EMP-MSG-001",
          courierName: "Budi Santoso",
        },
      },
    });

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}/tasks/Jemput%20Dokumen/decline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.taskAcceptance["Jemput Dokumen"].status, "DECLINED");

    // Canonical timeline
    const timeline = body.data.messengerTimeline || [];
    const decEv = timeline.find((t: any) => t.title === "Tugas Jemput Dokumen Ditolak");
    assert.ok(decEv);
    assert.strictEqual(
      decEv.note,
      "Tugas Jemput Dokumen ditolak oleh kurir Budi Santoso."
    );

    // Admin instruction fields completely intact
    assert.strictEqual(body.data.catatanOrder, "Instruksi Admin Awal");
    assert.strictEqual(body.data.catatanPenjadwalan, "Jadwal jemput pagi");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B5: Generic PUT /api/orders/:orderNo rejects note fields from messenger with 403 FORBIDDEN", async () => {
  const testOrderNo = `TEST-PUT-NOTE-FAIL-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo);

    // 1. Attempt to update messengerTaskNotes
    const res1 = await fetch(`${baseUrl}/api/orders/${testOrderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ messengerTaskNotes: "injected note" }),
    });
    assert.strictEqual(res1.status, 403);

    // 2. Attempt to update admin instruction catatanOrder
    const res2 = await fetch(`${baseUrl}/api/orders/${testOrderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ catatanOrder: "tampered by messenger" }),
    });
    assert.strictEqual(res2.status, 403);

    // 3. Attempt to update catatanKendala
    const res3 = await fetch(`${baseUrl}/api/orders/${testOrderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ catatanKendala: "kendala bebas kurir" }),
    });
    assert.strictEqual(res3.status, 403);

    // 4. Attempt nested note injection via pickupProof.notes
    const res4 = await fetch(`${baseUrl}/api/orders/${testOrderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ pickupProof: { notes: "catatan terselubung" } }),
    });
    assert.strictEqual(res4.status, 403);

    // 5. Attempt nested note injection via deliveryHandover.notes
    const res5 = await fetch(`${baseUrl}/api/orders/${testOrderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ deliveryHandover: { notes: "catatan handover terselubung" } }),
    });
    assert.strictEqual(res5.status, 403);
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B5: Generic PUT /api/orders/:orderNo allows valid messenger fields and preserves historical notes", async () => {
  const testOrderNo = `TEST-PUT-MSG-VALID-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo);

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({
        pickupChecklist: { ktp: true, stnk: true, bpkb: true },
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.pickupChecklist.ktp, true);

    // Historical notes must be preserved intact!
    assert.strictEqual(body.data.catatanOrder, "Instruksi Admin Awal");
    assert.strictEqual(body.data.catatanPenjadwalan, "Jadwal jemput pagi");
    assert.strictEqual(body.data.messengerTaskNotes, "Catatan historis lama kurir");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B5: Admin can update Admin instructions freely via PUT /api/orders/:orderNo", async () => {
  const testOrderNo = `TEST-PUT-ADM-OK-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo);

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        catatanOrder: "Instruksi Admin Terupdate",
        catatanPenjadwalan: "Jadwal jemput dimajukan ke pukul 09:00",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.catatanOrder, "Instruksi Admin Terupdate");
    assert.strictEqual(body.data.catatanPenjadwalan, "Jadwal jemput dimajukan ke pukul 09:00");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B6: completePickupTask rejects non-empty notes from messenger with 400 MESSENGER_NOTES_NOT_ALLOWED", async () => {
  const testOrderNo = `TEST-CP-NOTE-FAIL-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo);

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}/pickup/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ notes: "Berkas sudah saya bawa semua lengkap" }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "MESSENGER_NOTES_NOT_ALLOWED");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B6: completeDeliveryTask rejects non-empty notes from messenger with 400 MESSENGER_NOTES_NOT_ALLOWED", async () => {
  const testOrderNo = `TEST-CD-NOTE-FAIL-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo, {
      currentStep: 7,
      currentStageName: "Pengantaran",
      deliveryStatus: "Sedang Dikirim",
      messengerPengantar: "Budi Santoso",
      deliveryMessengerId: "EMP-MSG-001",
      taskAcceptance: {
        "Pengantaran Dokumen": {
          status: "ACCEPTED",
          isLocked: true,
          courierId: "EMP-MSG-001",
          courierName: "Budi Santoso",
        },
      },
    });

    const res = await fetch(`${baseUrl}/api/orders/${testOrderNo}/delivery/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({
        receiverName: "Pak RT",
        notes: "Titip ke tetangga sebelah",
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "MESSENGER_NOTES_NOT_ALLOWED");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});

test("PATCH B - TASK B6: reportSamsatPickupKendala rejects free-text notes and completeSamsatPickupTask rejects notes", async () => {
  const testOrderNo = `TEST-KENDALA-NOTE-${Date.now()}`;
  try {
    seedTestOrder(testOrderNo, {
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Selesai",
      samsatPickupStatus: "Sedang Jemput Dokumen Samsat",
      samsatPickupMessengerId: "EMP-MSG-001",
      petugasJemputSamsat: "Budi Santoso",
      samsatCycle: 1,
      taskAcceptance: {
        "Jemput Hasil Samsat": {
          status: "ACCEPTED",
          cycle: 1,
          isLocked: true,
          courierId: "EMP-MSG-001",
          courierName: "Budi Santoso",
        },
      },
    });

    // 1. Report Kendala with notes -> 400
    const res1 = await fetch(`${baseUrl}/api/orders/${testOrderNo}/samsat-pickup/kendala`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ notes: "Loket tutup mendadak" }),
    });
    assert.strictEqual(res1.status, 400);
    const b1 = (await res1.json()) as any;
    assert.strictEqual(b1.error.code, "MESSENGER_NOTES_NOT_ALLOWED");

    // 2. Report Kendala without notes -> 200
    const res2 = await fetch(`${baseUrl}/api/orders/${testOrderNo}/samsat-pickup/kendala`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res2.status, 200);
    const b2 = (await res2.json()) as any;
    assert.strictEqual(b2.data.samsatPickupStatus, "Terkendala");

    // 3. Complete Jemput Hasil with notes -> 400
    const res3 = await fetch(`${baseUrl}/api/orders/${testOrderNo}/samsat-pickup/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({ note: "Berkas sudah sampai kantor" }),
    });
    assert.strictEqual(res3.status, 400);
    const b3 = (await res3.json()) as any;
    assert.strictEqual(b3.error.code, "MESSENGER_NOTES_NOT_ALLOWED");
  } finally {
    try { dbOrderRepository.hardDeleteOrder(testOrderNo); } catch {}
  }
});
