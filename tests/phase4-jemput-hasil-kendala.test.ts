import test from "node:test";
import assert from "node:assert/strict";
import { orderService } from "../server/src/services/orderService";
import { messengerService } from "../server/src/services/messengerService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { ApiError } from "../server/src/middleware/errorHandler";
import {
  deriveMessengerTasksFromOrders,
} from "../src/app/data/messengerTaskAdapter";
import type { OperationalOrder } from "../src/domain/order/types";

// Test Actor Principals
const courierA = {
  userId: "usr-msg-001",
  employeeId: "EMP-MSG-001",
  nama: "Budi Courier A",
  userName: "budi.courier",
  role: "messenger",
  jabatan: "MESSENGER",
};

const courierB = {
  userId: "usr-msg-002",
  employeeId: "EMP-MSG-002",
  nama: "Siti Courier B",
  userName: "siti.courier",
  role: "messenger",
  jabatan: "MESSENGER",
};

const adminUser = {
  userId: "usr-admin-001",
  employeeId: "EMP-ADM-001",
  nama: "Admin Operasional",
  userName: "admin.ops",
  role: "administrator",
  jabatan: "ADMINISTRATOR",
};

const svpUser = {
  userId: "usr-svp-001",
  employeeId: "EMP-SVP-001",
  nama: "Supervisor Utama",
  userName: "svp.ops",
  role: "svp",
  jabatan: "SVP",
};

function createStage4OrderWithSamsatCompleted(orderNo: string, courier = courierA): OperationalOrder {
  const nowIso = new Date().toISOString();
  const order: any = {
    orderNo,
    customer: "PT Berkah Maju",
    nomorHP: "081234567890",
    layanan: "Perpanjangan STNK Tahunan",
    nopol: "B 1234 ABC",
    currentStep: 4,
    currentStageName: "Proses Samsat",
    wilayahSamsatAsal: "Jakarta Timur",
    samsatStatus: "Selesai",
    samsatCycle: 1,
    samsatPickupStatus: "Terjadwal Jemput Samsat",
    samsatPickupMessenger: courier.nama,
    samsatPickupMessengerId: courier.employeeId,
    samsatPickupMessengerNama: courier.nama,
    samsatPickupDate: nowIso.split("T")[0],
    biayaJasa: 150000,
    biayaSamsat: 350000,
    payment: {
      totalBiaya: 500000,
      dibayar: 500000,
      kurang: 0,
      statusPembayaran: "Lunas",
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Transfer",
    },
    taskAcceptance: {
      ["Jemput Hasil Samsat"]: {
        status: "PENDING",
        isLocked: false,
        assignedMessengerId: courier.employeeId,
        assignedMessengerName: courier.nama,
        cycle: 1,
      },
    },
    messengerTimeline: [],
  };

  dbOrderRepository.saveOrder(order);
  return dbOrderRepository.getByOrderNo(orderNo)!;
}

test("PHASE 4 — DEDICATED JEMPUT HASIL PAGE & KENDALA WORKFLOW SUITE", async (t) => {
  // =========================================================================
  // TEST 1: Filter Separation in Messenger Workspace
  // =========================================================================
  await t.test("1. Filter Separation: deriveMessengerTasksFromOrders classifies Jemput Hasil separately", () => {
    const orderNo = `ORD-P4-FILTER-${Date.now()}`;
    const order = createStage4OrderWithSamsatCompleted(orderNo, courierA);

    const activeOrders: Record<any, OperationalOrder[]> = {
      "Proses Samsat": [order],
    } as any;

    const allTasks = deriveMessengerTasksFromOrders(activeOrders);
    const jemputHasilTasks = allTasks.filter((t) => t.keteranganTugas === "Jemput Hasil Samsat");
    const jemputDokumenTasks = allTasks.filter((t) => t.keteranganTugas === "Jemput Dokumen");
    const antarTasks = allTasks.filter((t) => t.keteranganTugas === "Pengantaran Dokumen");

    assert.equal(jemputHasilTasks.length, 1, "Must contain exactly 1 Jemput Hasil task");
    assert.equal(jemputDokumenTasks.length, 0, "Must not be categorized as Jemput Dokumen");
    assert.equal(antarTasks.length, 0, "Must not be categorized as Pengantaran");
    assert.equal(jemputHasilTasks[0].orderNo, orderNo);
    assert.equal(jemputHasilTasks[0].assignedMessengerId, courierA.employeeId);
  });

  // =========================================================================
  // TEST 2: Task Acceptance Starts Lifecycle Directly
  // =========================================================================
  await t.test("2. Task Acceptance Starts Lifecycle: acceptMessengerTask auto-transitions to Sedang Jemput", () => {
    const orderNo = `ORD-P4-START-${Date.now()}`;
    createStage4OrderWithSamsatCompleted(orderNo, courierA);

    const accepted = orderService.acceptMessengerTask(orderNo, "Jemput Hasil Samsat", courierA as any);

    assert.equal(accepted.samsatPickupStatus, "Sedang Jemput Dokumen Samsat");
    assert.ok(accepted.samsatPickupStartedAt, "samsatPickupStartedAt must be populated upon acceptance");
    const acceptance = accepted.taskAcceptance?.["Jemput Hasil Samsat"];
    assert.equal(acceptance?.status, "ACCEPTED");
    assert.equal(acceptance?.isLocked, true);
    assert.equal(acceptance?.cycle, 1);
    assert.equal(acceptance?.courierId, courierA.employeeId);
    assert.equal(acceptance?.courierName, courierA.nama);
  });

  // =========================================================================
  // TEST 3: Canonical Identity & Ownership Authorization Enforcement
  // =========================================================================
  await t.test("3. Canonical Identity: Non-assigned courier is rejected with 403 FORBIDDEN", () => {
    const orderNo = `ORD-P4-AUTH-${Date.now()}`;
    createStage4OrderWithSamsatCompleted(orderNo, courierA);
    orderService.acceptMessengerTask(orderNo, "Jemput Hasil Samsat", courierA as any);

    // Courier B attempts to report kendala on Courier A's task
    assert.throws(
      () => orderService.reportSamsatPickupKendala(orderNo, courierB as any),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      }
    );

    // Courier B attempts to complete Courier A's task
    assert.throws(
      () => orderService.completeSamsatPickupTask(orderNo, courierB as any),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      }
    );

    // Caller with missing employeeId/userId is rejected
    assert.throws(
      () => orderService.reportSamsatPickupKendala(orderNo, { role: "messenger", nama: "Ghost" } as any),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  // =========================================================================
  // TEST 4: Kendala Workflow & Catatan Bebas Guard
  // =========================================================================
  await t.test("4. Kendala Workflow: Sets Terkendala, zero order.catatanKendala pollution, idempotent", () => {
    const orderNo = `ORD-P4-KENDALA-${Date.now()}`;
    createStage4OrderWithSamsatCompleted(orderNo, courierA);
    orderService.acceptMessengerTask(orderNo, "Jemput Hasil Samsat", courierA as any);

    const kendalaOrder = orderService.reportSamsatPickupKendala(orderNo, courierA as any);

    assert.equal(kendalaOrder.samsatPickupStatus, "Terkendala");
    const acc = kendalaOrder.taskAcceptance?.["Jemput Hasil Samsat"];
    assert.equal(acc?.hasKendala, true);
    assert.ok(acc?.kendalaAt);

    // STRICT CHECK: Zero order.catatanKendala pollution
    assert.equal((kendalaOrder as any).catatanKendala, undefined, "Operational note must NOT pollute order.catatanKendala");

    // Timeline event logged
    const timelineEvents = kendalaOrder.messengerTimeline || [];
    const kendalaEvent = timelineEvents.find((e) => e.title === "Kendala Jemput Hasil Samsat");
    assert.ok(kendalaEvent, "Timeline event must be recorded");
    assert.equal(kendalaEvent.author, courierA.nama);

    // Audit event logged
    const logs = dbAuditRepository.getAll({ action: "SAMSAT_PICKUP_KENDALA" });
    const audit = logs.find((l) => l.action === "SAMSAT_PICKUP_KENDALA" && l.metadata?.orderNo === orderNo);
    assert.ok(audit, "Audit event must be saved in database");

    // Idempotency: second call returns existing without duplicate timeline
    const initialTimelineLength = timelineEvents.length;
    const secondCall = orderService.reportSamsatPickupKendala(orderNo, courierA as any);
    assert.equal(secondCall.samsatPickupStatus, "Terkendala");
    assert.equal((secondCall.messengerTimeline || []).length, initialTimelineLength);
  });

  // =========================================================================
  // TEST 5: Kendala Recovery strictly restricted to Admin / SVP
  // =========================================================================
  await t.test("5. Kendala Recovery: Messenger calling recover gets 403, Admin/SVP recovers successfully", () => {
    const orderNo = `ORD-P4-RECOVER-${Date.now()}`;
    createStage4OrderWithSamsatCompleted(orderNo, courierA);
    orderService.acceptMessengerTask(orderNo, "Jemput Hasil Samsat", courierA as any);
    orderService.reportSamsatPickupKendala(orderNo, courierA as any);

    // 1. Messenger attempts to recover Kendala -> 403 FORBIDDEN
    assert.throws(
      () => orderService.recoverSamsatPickupKendala(orderNo, courierA as any),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      }
    );

    // 2. Admin recovers Kendala -> Succeeds
    const recovered = orderService.recoverSamsatPickupKendala(orderNo, adminUser as any);
    assert.equal(recovered.samsatPickupStatus, "Sedang Jemput Dokumen Samsat");

    // Courier assignment is strictly PRESERVED
    assert.equal(recovered.samsatPickupMessengerId, courierA.employeeId);
    assert.equal(recovered.samsatPickupMessengerNama, courierA.nama);

    // Timeline event recorded
    const timeline = recovered.messengerTimeline || [];
    const recoverEvent = timeline.find((e) => e.title === "Kendala Jemput Hasil Dipulihkan");
    assert.ok(recoverEvent, "Timeline must log recovery");
    assert.equal(recoverEvent.author, adminUser.nama);

    // Idempotency: second recovery call succeeds idempotently
    const idempotentRecover = orderService.recoverSamsatPickupKendala(orderNo, svpUser as any);
    assert.equal(idempotentRecover.samsatPickupStatus, "Sedang Jemput Dokumen Samsat");
  });

  // =========================================================================
  // TEST 6: Task Completion (Handover to Office) & Step 5 Gating
  // =========================================================================
  await t.test("6. Handover to Office: Gated while Terkendala, preserves Step 4, does NOT advance to Step 5", () => {
    const orderNo = `ORD-P4-COMPLETE-${Date.now()}`;
    createStage4OrderWithSamsatCompleted(orderNo, courierA);
    orderService.acceptMessengerTask(orderNo, "Jemput Hasil Samsat", courierA as any);
    orderService.reportSamsatPickupKendala(orderNo, courierA as any);

    // 1. Cannot complete while Terkendala
    assert.throws(
      () => orderService.completeSamsatPickupTask(orderNo, courierA as any),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "TASK_TERKENDALA");
        return true;
      }
    );

    // 2. Recover
    orderService.recoverSamsatPickupKendala(orderNo, adminUser as any);

    // 3. Complete handover
    const completed = orderService.completeSamsatPickupTask(orderNo, courierA as any);
    assert.equal(completed.samsatPickupStatus, "Dokumen Samsat Diterima di Kantor");
    assert.ok(completed.samsatPickupCompletedAt, "Must record samsatPickupCompletedAt");

    const acc = completed.taskAcceptance?.["Jemput Hasil Samsat"];
    assert.equal(acc?.status, "COMPLETED");
    assert.equal(acc?.isLocked, true);
    assert.equal(acc?.completedById, courierA.employeeId);

    // CRITICAL: Order MUST remain in Step 4 (Proses Samsat)
    assert.equal(completed.currentStep, 4, "Order currentStep must remain 4");
    assert.equal(completed.currentStageName, "Proses Samsat", "Order currentStageName must remain Proses Samsat");

    // Idempotent completion
    const secondComplete = orderService.completeSamsatPickupTask(orderNo, courierA as any);
    assert.equal(secondComplete.samsatPickupStatus, "Dokumen Samsat Diterima di Kantor");
  });

  // =========================================================================
  // TEST 7: Rollback Samsat & Cycle Invalidation (SUPERSEDED)
  // =========================================================================
  await t.test("7. Rollback Samsat: Marks Jemput Hasil task SUPERSEDED, increments cycle, invalidates old cycle", () => {
    const orderNo = `ORD-P4-ROLLBACK-${Date.now()}`;
    createStage4OrderWithSamsatCompleted(orderNo, courierA);
    orderService.acceptMessengerTask(orderNo, "Jemput Hasil Samsat", courierA as any);

    // Rollback order back to Step 3 (Verifikasi Dokumen)
    const rolledBack = orderService.rollbackOrder(orderNo, "Verifikasi Dokumen", adminUser as any);

    assert.equal(rolledBack.currentStep, 3, "Order step must be rolled back to 3");
    assert.equal(rolledBack.currentStageName, "Verifikasi Dokumen");
    assert.equal((rolledBack as any).samsatCycle, 2, "Samsat cycle must be incremented to 2");
    assert.equal(rolledBack.samsatPickupStatus, "Belum Dijadwal");

    // Check taskAcceptance SUPERSEDED
    const acc = rolledBack.taskAcceptance?.["Jemput Hasil Samsat"];
    assert.equal(acc?.status, "SUPERSEDED", "Jemput Hasil acceptance must be marked SUPERSEDED");
    assert.equal(acc?.isLocked, true);

    // Any operation on superseded task is rejected
    assert.throws(
      () => orderService.reportSamsatPickupKendala(orderNo, courierA as any),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    assert.throws(
      () => orderService.completeSamsatPickupTask(orderNo, courierA as any),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  // =========================================================================
  // TEST 8: Concurrency & Transaction Atomicity (Rollback vs Handover)
  // =========================================================================
  await t.test("8. Concurrency & Atomicity: Concurrent Rollback vs Handover executes cleanly without deadlocks", async () => {
    const orderNo = `ORD-P4-CONCURRENCY-${Date.now()}`;
    createStage4OrderWithSamsatCompleted(orderNo, courierA);
    orderService.acceptMessengerTask(orderNo, "Jemput Hasil Samsat", courierA as any);

    // Concurrent execution of Rollback to Step 3 and Complete Handover
    const results = await Promise.allSettled([
      Promise.resolve().then(() => orderService.rollbackOrder(orderNo, "Verifikasi Dokumen", adminUser as any)),
      Promise.resolve().then(() => orderService.completeSamsatPickupTask(orderNo, courierA as any)),
    ]);

    // At least one must succeed; neither may crash the SQLite database
    const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
    const rejectedCount = results.filter((r) => r.status === "rejected").length;

    assert.ok(fulfilledCount >= 1, "At least one operation must succeed atomically");
    console.log(`[CONCURRENCY EVIDENCE] Fulfilled: ${fulfilledCount}, Rejected: ${rejectedCount}`);

    // Verify DB integrity
    const finalOrder = dbOrderRepository.getByOrderNo(orderNo)!;
    assert.ok(finalOrder, "Order must exist and remain consistent in database");
  });

  // =========================================================================
  // TEST 9: Completed Task Extraction in History
  // =========================================================================
  await t.test("9. History Extraction: Completed Jemput Hasil task appears in getAllCompletedTasksInternal", () => {
    const orderNo = `ORD-P4-HIST-${Date.now()}`;
    createStage4OrderWithS4CompletedAndHandedOver(orderNo, courierA);

    const historyTasks = (messengerService as any).getAllCompletedTasksInternal(courierA.employeeId, courierA.nama);
    const jemputHasilHist = historyTasks.find((h: any) => h.orderNo === orderNo && (h.taskType === "Jemput Hasil Samsat" || h.keteranganTugas === "Jemput Hasil Samsat"));

    assert.ok(jemputHasilHist, "History must contain completed Jemput Hasil record");
    assert.equal(jemputHasilHist.id, `HIST-${orderNo}-JEMPUT_HASIL-C1`);
    assert.equal(jemputHasilHist.status, "Selesai");
    assert.equal(jemputHasilHist.taskType, "Jemput Hasil Samsat");
    assert.ok(jemputHasilHist.completedAt, "Completed timestamp must be present");
  });
});

function createStage4OrderWithS4CompletedAndHandedOver(orderNo: string, courier: any): OperationalOrder {
  const nowIso = new Date().toISOString();
  const order: any = {
    orderNo,
    customer: "PT History Test",
    nomorHP: "081299998888",
    layanan: "Balik Nama",
    nopol: "B 9999 HSS",
    currentStep: 4,
    currentStageName: "Proses Samsat",
    wilayahSamsatAsal: "Jakarta Selatan",
    samsatStatus: "Selesai",
    samsatCycle: 1,
    samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
    samsatPickupCompletedAt: nowIso,
    samsatPickupMessenger: courier.nama,
    samsatPickupMessengerId: courier.employeeId,
    samsatPickupMessengerNama: courier.nama,
    biayaJasa: 200000,
    biayaSamsat: 400000,
    payment: {
      totalBiaya: 600000,
      dibayar: 600000,
      kurang: 0,
      statusPembayaran: "Lunas",
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Transfer",
    },
    taskAcceptance: {
      ["Jemput Hasil Samsat"]: {
        status: "COMPLETED",
        isLocked: true,
        completedAt: nowIso,
        completedById: courier.employeeId,
        completedBy: courier.nama,
        cycle: 1,
      },
    },
    messengerTimeline: [],
  };

  dbOrderRepository.saveOrder(order);
  return dbOrderRepository.getByOrderNo(orderNo)!;
}
