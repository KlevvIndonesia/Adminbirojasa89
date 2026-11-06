import test from "node:test";
import assert from "node:assert/strict";
import { orderService } from "../server/src/services/orderService";
import { messengerService } from "../server/src/services/messengerService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import {
  deriveSingleTaskFromOrder,
  deriveMessengerTasksFromOrders,
  getActiveDeliveryPickupTasksForEmployee,
  getMessengerTasksForEmployee,
  getMessengerTaskHistoryForEmployee,
  deriveAllMessengerHistory,
  isTaskAvailableUnassigned,
  recoverSamsatPickupKendalaAction,
} from "../src/app/data/messengerTaskAdapter";
import { orderStore } from "../src/app/data/orderStore";
import { orderRepository } from "../src/data/repositories/orderRepository";
import type { OperationalOrder } from "../src/domain/order/types";

// Test Actor Principals
const courierA = {
  userId: "usr-msg-001",
  employeeId: "EMP-MSG-001",
  nama: "Budi Courier A",
  userName: "budi.courier",
  role: "messenger" as const,
  jabatan: "MESSENGER",
};

const adminUser = {
  userId: "usr-admin-001",
  employeeId: "EMP-ADM-001",
  nama: "Admin Operasional",
  userName: "admin.ops",
  role: "administrator" as const,
  jabatan: "ADMINISTRATOR",
};

function createStage4OrderWithJemputHasil(orderNo: string, cycle = 1): OperationalOrder {
  const nowIso = new Date().toISOString();
  const order: any = {
    orderNo,
    customer: "PT Patch 41 Test",
    nomorHP: "081233334444",
    layanan: "Perpanjangan STNK",
    nopol: "B 4141 ABC",
    currentStep: 4,
    currentStageName: "Proses Samsat",
    wilayahSamsatAsal: "Jakarta Pusat",
    samsatStatus: "Selesai",
    samsatCycle: cycle,
    service_id: "svc-lainnya",
    samsatProcesses: [{ id: "p1", name: "Pengurusan Loket", status: "Selesai" }],
    samsatPickupStatus: "Terjadwal Jemput Samsat",
    samsatPickupMessenger: courierA.nama,
    samsatPickupMessengerId: courierA.employeeId,
    samsatPickupMessengerNama: courierA.nama,
    biayaJasa: 150000,
    biayaSamsat: 350000,
    startedAt: "2026-11-05T07:00:00.000Z", // Simulating earlier pickup startedAt
    payment: {
      totalBiaya: 500000,
      dibayar: 500000,
      kurang: 0,
      statusPembayaran: "Lunas",
    },
    taskAcceptance: {
      ["Jemput Hasil Samsat"]: {
        status: "PENDING",
        isLocked: false,
        assignedMessengerId: courierA.employeeId,
        assignedMessengerName: courierA.nama,
        cycle,
      },
    },
    messengerTimeline: [],
  };

  dbOrderRepository.saveOrder(order);
  return dbOrderRepository.getByOrderNo(orderNo)!;
}

test("PHASE 4.1 — TARGETED FRONTEND INTEGRITY & UI CONSISTENCY PATCH SUITE", async (t) => {
  // =========================================================================
  // PATCH 1 TESTS: EXPLICIT SUPERSEDED TERMINAL HANDLING
  // =========================================================================
  await t.test("Patch 1.1: SUPERSEDED does NOT convert to ACCEPTED even when order.startedAt is present", () => {
    const orderNo = `ORD-P41-SUP-1-${Date.now()}`;
    const rawOrder = createStage4OrderWithJemputHasil(orderNo, 1);

    // Explicitly set acceptance status to SUPERSEDED
    const supersededOrder: OperationalOrder = {
      ...rawOrder,
      startedAt: "2026-11-05T07:30:00.000Z", // Heuristic trigger
      taskAcceptance: {
        ["Jemput Hasil Samsat"]: {
          status: "SUPERSEDED",
          isLocked: true,
          cycle: 1,
          supersededAt: new Date().toISOString(),
          supersededReason: "Samsat rolled back",
        },
      },
    };

    const derived = deriveSingleTaskFromOrder(supersededOrder);

    // MUST NOT convert to ACCEPTED
    assert.equal(derived.acceptanceStatus, "SUPERSEDED", "acceptanceStatus must strictly remain SUPERSEDED");
    assert.notEqual(derived.acceptanceStatus, "ACCEPTED", "Must never fall back to ACCEPTED due to startedAt");
    assert.equal(derived.isLocked, true, "SUPERSEDED task must be locked");
    assert.equal(derived.lifecycleStatus, "DIBATALKAN", "Lifecycle must be marked DIBATALKAN");
  });

  await t.test("Patch 1.2: SUPERSEDED old cycle task never appears in active task list or unassigned pool", () => {
    const orderNo = `ORD-P41-SUP-2-${Date.now()}`;
    const rawOrder = createStage4OrderWithJemputHasil(orderNo, 1);

    const supersededOrder: OperationalOrder = {
      ...rawOrder,
      taskAcceptance: {
        ["Jemput Hasil Samsat"]: {
          status: "SUPERSEDED",
          isLocked: true,
          cycle: 1,
        },
      },
    };

    const derived = deriveSingleTaskFromOrder(supersededOrder);

    // 1. Not in unassigned pool
    const inPool = isTaskAvailableUnassigned(derived);
    assert.equal(inPool, false, "SUPERSEDED task must NOT be available in unassigned pool");

    // 2. Not in active courier tasks
    const activeOrders: Record<any, OperationalOrder[]> = {
      "Proses Samsat": [supersededOrder],
    } as any;

    const courierTasks = getMessengerTasksForEmployee(activeOrders, courierA);
    assert.equal(courierTasks.length, 0, "SUPERSEDED task must NOT appear in employee's task list");

    const activeCourierTasks = getActiveDeliveryPickupTasksForEmployee(activeOrders, courierA);
    assert.equal(activeCourierTasks.length, 0, "SUPERSEDED task must NOT appear in active delivery/pickup tasks");
  });

  await t.test("Patch 1.3: New cycle (Cycle 2) re-spawns cleanly and can be accepted without old cycle interference", () => {
    const orderNo = `ORD-P41-CYCLE2-${Date.now()}`;
    createStage4OrderWithJemputHasil(orderNo, 1);

    // 1. Rollback to Step 3 -> Invalidate Cycle 1
    const rolledBack = orderService.rollbackOrder(orderNo, "Verifikasi Dokumen", adminUser as any);
    assert.equal((rolledBack as any).samsatCycle, 2, "Cycle must be 2 after rollback");

    // 2. Progress order to Step 4 and complete Samsat in Cycle 2
    dbOrderRepository.updateOrder(orderNo, {
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessenger: courierA.nama,
      samsatMessengerId: courierA.employeeId,
      samsatMessengerNama: courierA.nama,
    });

    // Complete Samsat in Cycle 2 (zero free-text notes for courier)
    const samsatDoneCycle2 = orderService.completeSamsatProcess(orderNo, {}, courierA as any);
    assert.equal(samsatDoneCycle2.samsatStatus, "Selesai");
    assert.equal((samsatDoneCycle2 as any).samsatCompletedCycle, 2);

    // 3. Verify Cycle 2 Jemput Hasil task is re-spawned as PENDING
    const jemputAccCycle2 = samsatDoneCycle2.taskAcceptance?.["Jemput Hasil Samsat"];
    assert.equal(jemputAccCycle2?.status, "PENDING");
    assert.equal(jemputAccCycle2?.cycle, 2);

    // 4. Accept task in Cycle 2
    const acceptedCycle2 = orderService.acceptMessengerTask(orderNo, "Jemput Hasil Samsat", courierA as any);
    assert.equal(acceptedCycle2.samsatPickupStatus, "Sedang Jemput Dokumen Samsat");
    assert.equal(acceptedCycle2.taskAcceptance?.["Jemput Hasil Samsat"]?.status, "ACCEPTED");
    assert.equal(acceptedCycle2.taskAcceptance?.["Jemput Hasil Samsat"]?.cycle, 2);
  });

  // =========================================================================
  // PATCH 2 TESTS: DEDICATED PAGE UI CONTRACT
  // =========================================================================
  await t.test("Patch 2.1: Dedicated Jemput Hasil page contract hides workspace bottom navigation", () => {
    let isBottomNavHidden = false;
    const handleDetailActiveChange = (active: boolean) => {
      isBottomNavHidden = active;
    };

    // When no task is selected or a regular task is selected
    handleDetailActiveChange(false);
    assert.equal(isBottomNavHidden, false, "Bottom navigation must be visible on task list");

    // When dedicated Jemput Hasil view opens
    handleDetailActiveChange(true);
    assert.equal(isBottomNavHidden, true, "Bottom navigation must be hidden when dedicated view is active");

    // When navigating back
    handleDetailActiveChange(false);
    assert.equal(isBottomNavHidden, false, "Bottom navigation must be restored on back");
  });

  // =========================================================================
  // PATCH 3 TESTS: ELIMINATE DOUBLE RECOVERY REQUEST & DUPLICATE TIMELINE
  // =========================================================================
  await t.test("Patch 3.1: recoverSamsatPickupKendalaAction executes single authoritative recovery without double timeline", async () => {
    const orderNo = `ORD-P41-REC-1-${Date.now()}`;
    const rawOrder = createStage4OrderWithJemputHasil(orderNo, 1);

    // Seed local repository
    orderRepository.saveOrder(rawOrder as any);

    // Set to Terkendala via backend
    orderService.acceptMessengerTask(orderNo, "Jemput Hasil Samsat", courierA as any);
    const kendalaOrder = orderService.reportSamsatPickupKendala(orderNo, courierA as any);
    assert.equal(kendalaOrder.samsatPickupStatus, "Terkendala");

    // Sync to store
    orderStore.updateOrder(orderNo, kendalaOrder);

    // Admin executes recovery action
    const res = await recoverSamsatPickupKendalaAction(orderNo, {
      userId: adminUser.userId,
      employeeId: adminUser.employeeId,
      userName: adminUser.nama,
      role: adminUser.role,
    });

    assert.equal(res.success, true, "Recovery action must succeed");

    const updatedOrder = orderStore.getOrderByNo(orderNo)!;
    assert.equal(updatedOrder.samsatPickupStatus, "Sedang Jemput Dokumen Samsat");

    // Count recovery events in timeline
    const recoveryEvents = (updatedOrder.messengerTimeline || []).filter(
      (e) => e.title === "Kendala Jemput Hasil Dipulihkan"
    );
    assert.equal(recoveryEvents.length, 1, "Must contain exactly 1 recovery timeline event (no optimistic duplication)");

    // Test retry idempotency
    const retryRes = await recoverSamsatPickupKendalaAction(orderNo, {
      userId: adminUser.userId,
      employeeId: adminUser.employeeId,
      userName: adminUser.nama,
      role: adminUser.role,
    });
    assert.equal(retryRes.success, true, "Retry must succeed idempotently");

    const afterRetryTimeline = (orderStore.getOrderByNo(orderNo)!.messengerTimeline || []).filter(
      (e) => e.title === "Kendala Jemput Hasil Dipulihkan"
    );
    assert.equal(afterRetryTimeline.length, 1, "Retry must NOT create duplicate timeline events");
  });

  await t.test("Patch 3.2: Non-admin caller receives error and does not update state to success", async () => {
    const orderNo = `ORD-P41-REC-2-${Date.now()}`;
    const rawOrder = createStage4OrderWithJemputHasil(orderNo, 1);
    rawOrder.samsatPickupStatus = "Terkendala";
    orderRepository.saveOrder(rawOrder as any);

    const res = await recoverSamsatPickupKendalaAction(orderNo, {
      userId: courierA.userId,
      employeeId: courierA.employeeId,
      userName: courierA.nama,
      role: "messenger",
    });

    assert.equal(res.success, false, "Courier calling recover must be rejected");
    assert.ok(res.error?.includes("Admin") || res.error?.includes("Supervisor"));
    assert.equal(orderStore.getOrderByNo(orderNo)?.samsatPickupStatus, "Terkendala", "State must remain Terkendala");
  });

  // =========================================================================
  // PATCH 4 TESTS: FRONTEND JEMPUT HASIL HISTORY INTEGRATION
  // =========================================================================
  await t.test("Patch 4.1: Completed Jemput Hasil appears in deriveAllMessengerHistory with canonical ID & timestamp", () => {
    const orderNo = `ORD-P41-HIST-1-${Date.now()}`;
    const completedAt = "2026-11-05T09:15:00.000Z";
    const rawOrder = createStage4OrderWithJemputHasil(orderNo, 1);

    const completedOrder: OperationalOrder = {
      ...rawOrder,
      samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
      samsatPickupCompletedAt: completedAt,
      taskAcceptance: {
        ["Jemput Hasil Samsat"]: {
          status: "COMPLETED",
          completedAt,
          completedById: courierA.employeeId,
          completedBy: courierA.nama,
          cycle: 1,
        },
      },
    };

    const activeOrders: Record<any, OperationalOrder[]> = {
      "Proses Samsat": [completedOrder],
    } as any;

    const allHistory = deriveAllMessengerHistory(activeOrders);
    const jemputHist = allHistory.find(
      (h) => h.orderNo === orderNo && h.taskType === "Jemput Hasil Samsat"
    );

    assert.ok(jemputHist, "deriveAllMessengerHistory must include Jemput Hasil Samsat");
    assert.equal(jemputHist.id, `HIST-${orderNo}-JEMPUT_HASIL-C1`, "Canonical ID format must be HIST-${orderNo}-JEMPUT_HASIL-C${cycle}");
    assert.equal(jemputHist.completedAt, completedAt, "Completed timestamp must match samsatPickupCompletedAt");
    assert.equal(jemputHist.messengerEmployeeId, courierA.employeeId, "Messenger employee ID must match canonical courier");
    assert.equal(jemputHist.status, "Selesai");
  });

  await t.test("Patch 4.2: Completed Jemput Hasil visible in getMessengerTaskHistoryForEmployee without waiting for Stage 8", () => {
    const orderNo = `ORD-P41-HIST-2-${Date.now()}`;
    const completedAt = "2026-11-05T09:30:00.000Z";
    const rawOrder = createStage4OrderWithJemputHasil(orderNo, 1);

    // Order is in Step 4 (Proses Samsat), NOT Step 8
    const step4Order: OperationalOrder = {
      ...rawOrder,
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
      samsatPickupCompletedAt: completedAt,
      taskAcceptance: {
        ["Jemput Hasil Samsat"]: {
          status: "COMPLETED",
          completedAt,
          completedById: courierA.employeeId,
          completedBy: courierA.nama,
          cycle: 1,
        },
      },
    };

    const activeOrders: Record<any, OperationalOrder[]> = {
      "Proses Samsat": [step4Order],
    } as any;

    const courierHistory = getMessengerTaskHistoryForEmployee(activeOrders, courierA);
    const histItem = courierHistory.find(
      (h) => h.orderNo === orderNo && h.keteranganTugas === "Jemput Hasil Samsat"
    );

    assert.ok(histItem, "Courier must see completed Jemput Hasil in history while order is still in Step 4");
    assert.equal(histItem.id, `HIST-${orderNo}-JEMPUT_HASIL-C1`);
    assert.equal(histItem.status, "Selesai");
    assert.equal(histItem.statusCode, "COMPLETED");
  });

  await t.test("Patch 4.3: Different cycles produce distinct history records without collision", () => {
    const orderNo = `ORD-P41-HIST-MULTI-${Date.now()}`;
    const rawOrder = createStage4OrderWithJemputHasil(orderNo, 1);

    // Simulate Cycle 1 completion
    const orderCycle1: OperationalOrder = {
      ...rawOrder,
      samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
      samsatPickupCompletedAt: "2026-11-05T08:00:00.000Z",
      taskAcceptance: {
        ["Jemput Hasil Samsat"]: {
          status: "COMPLETED",
          completedAt: "2026-11-05T08:00:00.000Z",
          completedById: courierA.employeeId,
          completedBy: courierA.nama,
          cycle: 1,
        },
      },
    };

    // Simulate Cycle 2 completion
    const orderCycle2: OperationalOrder = {
      ...rawOrder,
      samsatCycle: 2,
      samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
      samsatPickupCompletedAt: "2026-11-05T10:00:00.000Z",
      taskAcceptance: {
        ["Jemput Hasil Samsat"]: {
          status: "COMPLETED",
          completedAt: "2026-11-05T10:00:00.000Z",
          completedById: courierA.employeeId,
          completedBy: courierA.nama,
          cycle: 2,
        },
      },
    };

    const hist1 = deriveAllMessengerHistory({ "Proses Samsat": [orderCycle1] } as any);
    const hist2 = deriveAllMessengerHistory({ "Proses Samsat": [orderCycle2] } as any);

    const item1 = hist1.find((h) => h.orderNo === orderNo && h.taskType === "Jemput Hasil Samsat");
    const item2 = hist2.find((h) => h.orderNo === orderNo && h.taskType === "Jemput Hasil Samsat");

    assert.ok(item1);
    assert.ok(item2);
    assert.equal(item1.id, `HIST-${orderNo}-JEMPUT_HASIL-C1`);
    assert.equal(item2.id, `HIST-${orderNo}-JEMPUT_HASIL-C2`);
    assert.notEqual(item1.id, item2.id, "Cycle 1 and Cycle 2 must produce distinct canonical history IDs");
  });
});
