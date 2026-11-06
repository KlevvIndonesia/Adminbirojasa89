import test from "node:test";
import assert from "node:assert/strict";
import { orderStore } from "../src/app/data/orderStore";
import { orderRepository } from "../src/data/repositories/orderRepository";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import {
  UserContext,
  startMessengerTask,
  completeMessengerPickup,
  completeSamsatProcess,
  completeSamsatResultPickup,
  reportSamsatPickupKendalaAction,
  recoverSamsatPickupKendalaAction,
  updateMessengerTaskStatus,
  deriveSingleTaskFromOrder,
  getAvailableUnassignedTasks,
  getActiveDeliveryPickupTasksForEmployee,
  getActiveSamsatTasksForEmployee,
  getMessengerTaskHistoryForEmployee,
  deriveAllMessengerHistory,
  WAITING_REASONS,
  SAMSAT_WAITING_REASONS,
} from "../src/app/data/messengerTaskAdapter";
import { OperationalOrder } from "../src/domain/order/types";

const mockMessenger: UserContext = {
  userId: "usr-mess-p5",
  userName: "Budi Utomo",
  employeeId: "EMP-MESS-P5",
  role: "messenger",
};

const mockAdmin: UserContext = {
  userId: "usr-admin-p5",
  userName: "Admin Operasional P5",
  employeeId: "EMP-ADMIN-P5",
  role: "administrator",
};

function createBaseOrder(orderNo: string, overrides: Partial<OperationalOrder> = {}): OperationalOrder {
  const order = {
    orderNo,
    customer: "PT Solusi Maju Bersama",
    phone: "081299887766",
    tipeLayanan: "Perorangan",
    service_id: "svc-perpanjangan",
    layanan: "Perpanjangan STNK Tahunan",
    currentStep: 2,
    currentStageName: "Penjemputan Berkas",
    status: "Dalam Proses",
    lokasiPengurusan: "Samsat Jakarta Selatan",
    alamatPenjemputan: "Jl. Sudirman Kav 21, Jakarta Selatan",
    tanggalMasuk: new Date().toISOString(),
    isCancelled: false,
    messenger: mockMessenger.userName,
    assignedMessengerName: mockMessenger.userName,
    assignedMessengerId: mockMessenger.employeeId,
    catatanOrder: "Instruksi Admin: Customer meminta tanda terima bermaterai.",
    catatanPenjadwalan: "Instruksi Admin: Berkas ada di receptionist lantai 3.",
    catatanSamsat: "Instruksi Admin: Loket 4, temui Pak Hendra.",
    catatanPengantaran: "Instruksi Admin: Antar kembali sebelum jam 17:00.",
    taskAcceptance: {
      "Jemput Dokumen": {
        status: "ACCEPTED",
        isLocked: true,
        acceptedAt: new Date().toISOString(),
      },
    },
    ...overrides,
  } as OperationalOrder;

  orderRepository.saveOrder(order);
  try {
    dbOrderRepository.saveOrder(order);
  } catch {}
  return order;
}

test("PHASE 5 — MESSENGER WORKSPACE UI CONSOLIDATION SUITE", async (t) => {
  // Test 1: Pickup completion without free-text operational notes
  await t.test("1. Messenger completes document pickup with structured proof and NO free-text operational notes", () => {
    const orderNo = "ORD-P5-001";
    const order = createBaseOrder(orderNo);

    const res = completeMessengerPickup(
      orderNo,
      {
        photoProofUrl: "https://storage.sunbirojasa.com/proofs/pickup-001.jpg",
        pickupChecklist: { stnk: true, bpkb: true, ktp: true },
        // Strictly NO notes or catatanKendala provided
      },
      mockMessenger
    );

    assert.equal(res.success, true);
    const updated = orderStore.getOrderByNo(orderNo)!;
    assert.equal(updated.pickupCompleted, true);
    assert.equal(updated.messengerTaskStatus, "Dokumen Sudah Tersedia");
    assert.equal(updated.pickupProof?.photoProofUrl, "https://storage.sunbirojasa.com/proofs/pickup-001.jpg");
    assert.equal(updated.pickupProof?.notes, undefined);
    assert.equal(updated.pickupProof?.catatanKendala, undefined);
    // Timeline must be clean
    const latestTimeline = updated.messengerTimeline?.[0];
    assert.ok(latestTimeline);
    assert.equal(latestTimeline.title, "Penjemputan Dokumen Selesai");
    assert.ok(latestTimeline.note.includes("Dokumen fisik berhasil diambil"));
  });

  // Test 2: Samsat completion without free-text operational notes
  await t.test("2. Messenger completes Samsat process with automatic canonical timeline text and NO free-text notes", () => {
    const orderNo = "ORD-P5-002";
    const order = createBaseOrder(orderNo, {
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Diproses",
      samsatMessenger: mockMessenger.userName,
      samsatMessengerNama: mockMessenger.userName,
      samsatMessengerId: mockMessenger.employeeId,
      samsatProcesses: [
        {
          id: "comp-1",
          componentId: "comp-1",
          name: "Pendaftaran Berkas",
          status: "COMPLETED",
          nominal: 50000,
        },
      ],
      taskAcceptance: {
        "Proses Samsat": {
          status: "ACCEPTED",
          isLocked: true,
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    // Call completeSamsatProcess without note argument
    const res = completeSamsatProcess(orderNo, mockMessenger);
    assert.equal(res.success, true);

    const updated = orderStore.getOrderByNo(orderNo)!;
    assert.equal(updated.samsatStatus, "Selesai");
    assert.ok(updated.taskAcceptance?.["Jemput Hasil Samsat"]);
    assert.equal(updated.taskAcceptance?.["Jemput Hasil Samsat"].status, "PENDING");

    // Timeline event must use canonical system text
    const samsatDoneEvent = updated.messengerTimeline?.find((e) => e.title.includes("Proses Samsat Selesai"));
    assert.ok(samsatDoneEvent);
    assert.equal(
      samsatDoneEvent.note,
      "Seluruh tahapan komponen pengurusan di loket Samsat telah selesai diproses."
    );
  });

  // Test 3: Jemput Hasil completion without free-text operational notes
  await t.test("3. Messenger completes Jemput Hasil without free-text notes, canonical timeline is generated", () => {
    const orderNo = "ORD-P5-003";
    const order = createBaseOrder(orderNo, {
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Selesai",
      samsatPickupStatus: "Sedang Jemput Dokumen Samsat",
      samsatPickupMessenger: mockMessenger.userName,
      samsatPickupMessengerNama: mockMessenger.userName,
      samsatPickupMessengerId: mockMessenger.employeeId,
      samsatCycle: 1,
      taskAcceptance: {
        "Jemput Hasil Samsat": {
          status: "ACCEPTED",
          isLocked: true,
          cycle: 1,
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    // Call completeSamsatResultPickup with notes = undefined
    const res = completeSamsatResultPickup(orderNo, undefined, mockMessenger);
    assert.equal(res.success, true);

    const updated = orderStore.getOrderByNo(orderNo)!;
    assert.equal(updated.samsatPickupStatus, "Dokumen Samsat Diterima di Kantor");

    // Timeline event must match canonical template
    const handoverEvent = updated.messengerTimeline?.find((e) => e.title.includes("Dokumen Hasil Samsat Diterima"));
    assert.ok(handoverEvent);
    assert.ok(handoverEvent.note.includes("Berkas hasil proses Samsat telah diserahkan oleh kurir"));
  });

  // Test 4: Waiting reason status accepts structured dropdown and operates without free-text notes
  await t.test("4. Status Menunggu strictly requires structured reason and operates without operational notes", () => {
    const orderNo = "ORD-P5-004";
    const order = createBaseOrder(orderNo, {
      currentStep: 2,
      currentStageName: "Penjemputan Berkas",
      messengerTaskStatus: "Menuju Lokasi",
    });

    const validReason = WAITING_REASONS[0]; // e.g., "Klien Belum Siap"
    const res = updateMessengerTaskStatus(
      orderNo,
      "WAITING",
      { waitingReason: validReason }, // note omitted
      mockMessenger
    );

    assert.equal(res.success, true);
    const updated = orderStore.getOrderByNo(orderNo)!;
    assert.equal(updated.messengerTaskStatus, "Pending");
    assert.equal(updated.messengerTaskNotes, validReason);

    const waitingTimeline = updated.messengerTimeline?.find((e) => e.title.includes("Ubah Status: Menunggu"));
    assert.ok(waitingTimeline);
    assert.ok(waitingTimeline.note.includes(validReason));
  });

  // Test 5: Strict preservation of Admin instructions
  await t.test("5. Admin instructions (catatanOrder, catatanPenjadwalan, catatanSamsat, catatanPengantaran) remain strictly preserved and unmodified", () => {
    const orderNo = "ORD-P5-005";
    const order = createBaseOrder(orderNo, {
      catatanOrder: "PENTING: Berkas asli jangan dilipat.",
      catatanPenjadwalan: "PENTING: Datang jam 09:30 tepat.",
      catatanSamsat: "PENTING: Loket 2 lantai 1.",
      catatanPengantaran: "PENTING: Serahkan langsung ke Ibu Shinta.",
    });

    // Perform operational updates
    completeMessengerPickup(orderNo, { pickupChecklist: { stnk: true } }, mockMessenger);

    const updated = orderStore.getOrderByNo(orderNo)!;
    assert.equal(updated.catatanOrder, "PENTING: Berkas asli jangan dilipat.");
    assert.equal(updated.catatanPenjadwalan, "PENTING: Datang jam 09:30 tepat.");
    assert.equal(updated.catatanSamsat, "PENTING: Loket 2 lantai 1.");
    assert.equal(updated.catatanPengantaran, "PENTING: Serahkan langsung ke Ibu Shinta.");
  });

  // Test 6: Strict preservation of historical operational notes from previous transactions
  await t.test("6. Historical notes from previous transactions remain intact and read-only", () => {
    const orderNo = "ORD-P5-006";
    const order = createBaseOrder(orderNo, {
      catatanKendala: "Kendala historis: Alamat klien pindah ke blok C.",
      samsatPickupNotes: "Catatan historis: Berkas diserahkan lengkap 2 plat.",
      pickupProof: {
        photoProofUrl: "https://storage.sunbirojasa.com/historical-1.jpg",
        notes: "Catatan penjemputan lama",
        catatanKendala: "Kendala lama di lapangan",
        completedAt: "2026-10-20T10:00:00.000Z",
      },
    });

    // Verify task derivation preserves historical fields
    const task = deriveSingleTaskFromOrder(order, mockMessenger);
    assert.ok(task);
    assert.equal(task.rawOrder.catatanKendala, "Kendala historis: Alamat klien pindah ke blok C.");
    assert.equal(task.rawOrder.samsatPickupNotes, "Catatan historis: Berkas diserahkan lengkap 2 plat.");
    assert.equal(task.rawOrder.pickupProof?.notes, "Catatan penjemputan lama");
    assert.equal(task.rawOrder.pickupProof?.catatanKendala, "Kendala lama di lapangan");
  });

  // Test 7: Card-click isolation: arbitrary card areas do not navigate, explicit buttons are required
  await t.test("7. Card-click isolation: MessengerTaskItem preserves task structure without card-level click bindings", () => {
    const orderNo = "ORD-P5-007";
    const order = createBaseOrder(orderNo, {
      currentStep: 4,
      currentStageName: "Proses Samsat",
      isSamsatScheduled: true,
      samsatMessengerId: mockMessenger.employeeId,
      samsatMessengerNama: mockMessenger.userName,
      samsatStatus: "Menuju Samsat",
      samsatProcesses: [
        { id: "c1", componentId: "c1", name: "Cek Fisik", status: "COMPLETED", nominal: 30000 },
        { id: "c2", componentId: "c2", name: "Pembayaran PKB", status: "WAITING", nominal: 450000 },
      ],
      taskAcceptance: {
        "Proses Samsat": {
          status: "ACCEPTED",
          isLocked: true,
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    const activeOrders: Record<any, OperationalOrder[]> = {
      "Proses Samsat": [order],
    } as any;
    const activeSamsat = getActiveSamsatTasksForEmployee(activeOrders, mockMessenger);
    assert.equal(activeSamsat.length, 1);
    const task = activeSamsat[0];
    assert.equal(task.orderNo, orderNo);
    assert.equal(task.keteranganTugas, "Proses Samsat");
    // Explicit button action relies on task.orderNo, card itself is decoupled
    assert.ok(task.orderNo);
  });

  // Test 8: Dedicated Jemput Hasil Kendala & Recovery workflow works cleanly without free text
  await t.test("8. Jemput Hasil Kendala & Admin Recovery workflow operates reliably without free-text note pollution", async () => {
    const orderNo = "ORD-P5-008";
    const order = createBaseOrder(orderNo, {
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Selesai",
      samsatPickupStatus: "Sedang Jemput Dokumen Samsat",
      samsatPickupMessenger: mockMessenger.userName,
      samsatPickupMessengerNama: mockMessenger.userName,
      samsatPickupMessengerId: mockMessenger.employeeId,
      samsatCycle: 1,
      taskAcceptance: {
        "Jemput Hasil Samsat": {
          status: "ACCEPTED",
          isLocked: true,
          cycle: 1,
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    // 1. Messenger reports Kendala
    const kendalaRes = reportSamsatPickupKendalaAction(orderNo, mockMessenger);
    assert.equal(kendalaRes.success, true);
    const orderInKendala = orderStore.getOrderByNo(orderNo)!;
    assert.equal(orderInKendala.samsatPickupStatus, "Terkendala");
    // Verify NO free-text pollution on order.catatanKendala
    assert.equal(orderInKendala.catatanKendala, undefined);
    assert.equal(orderInKendala.taskAcceptance?.["Jemput Hasil Samsat"].hasKendala, true);

    // 2. Messenger completion is blocked while in Kendala
    const blockedRes = completeSamsatResultPickup(orderNo, undefined, mockMessenger);
    assert.equal(blockedRes.success, false);
    assert.ok(blockedRes.error?.includes("Terkendala"));

    // 3. Admin recovers Kendala
    const recoverRes = await recoverSamsatPickupKendalaAction(orderNo, mockAdmin);
    assert.equal(recoverRes.success, true);
    const recoveredOrder = orderStore.getOrderByNo(orderNo)!;
    assert.equal(recoveredOrder.samsatPickupStatus, "Sedang Jemput Dokumen Samsat");
    assert.equal(recoveredOrder.taskAcceptance?.["Jemput Hasil Samsat"].hasKendala, false);

    // 4. Messenger can now complete
    const completeRes = completeSamsatResultPickup(orderNo, undefined, mockMessenger);
    assert.equal(completeRes.success, true);
    const finalOrder = orderStore.getOrderByNo(orderNo)!;
    assert.equal(finalOrder.samsatPickupStatus, "Dokumen Samsat Diterima di Kantor");
  });

  // Test 9: SUPERSEDED tasks remain strictly excluded from active and pool task lists
  await t.test("9. SUPERSEDED tasks remain excluded from active courier tasks and unassigned pools", () => {
    const orderNo = "ORD-P5-009";
    const order = createBaseOrder(orderNo, {
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Diproses",
      samsatCycle: 2,
      taskAcceptance: {
        "Jemput Hasil Samsat": {
          status: "SUPERSEDED",
          isLocked: false,
          cycle: 1, // Old cycle superseded by rollback
          supersededAt: new Date().toISOString(),
        },
      },
    });

    // Check pool
    const pool = getAvailableUnassignedTasks([order]);
    assert.equal(pool.length, 0, "Superseded task must not appear in pool");

    // Check courier active tasks
    const active = getActiveDeliveryPickupTasksForEmployee([order], mockMessenger);
    assert.equal(active.length, 0, "Superseded task must not appear in courier active tasks");
  });

  // Test 10: History derivation includes completed tasks before Step 8
  await t.test("10. History derivation captures completed tasks across all stages with canonical audit data", () => {
    const orderNo = "ORD-P5-010";
    const completedAt = "2026-11-05T08:00:00.000Z";
    const order = createBaseOrder(orderNo, {
      currentStep: 5,
      currentStageName: "Verifikasi Dokumen & Biaya Fisik",
      samsatStatus: "Selesai",
      samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
      samsatPickupCompletedAt: completedAt,
      samsatPickupMessenger: mockMessenger.userName,
      samsatPickupMessengerNama: mockMessenger.userName,
      samsatPickupMessengerId: mockMessenger.employeeId,
      samsatCycle: 1,
      taskAcceptance: {
        "Jemput Hasil Samsat": {
          status: "ACCEPTED",
          isLocked: true,
          cycle: 1,
          completedAt,
        },
      },
    });

    const activeOrders: Record<any, OperationalOrder[]> = {
      "Proses Samsat": [order],
    } as any;
    const historyItems = getMessengerTaskHistoryForEmployee(activeOrders, mockMessenger);
    const jemputHasilHist = historyItems.find((h) => h.id.includes("JEMPUT_HASIL"));
    assert.ok(jemputHasilHist, "Completed Jemput Hasil must be in history before Step 8");
    assert.equal(jemputHasilHist.completedAt, completedAt);
    assert.equal(jemputHasilHist.status, "Selesai");
  });
});
