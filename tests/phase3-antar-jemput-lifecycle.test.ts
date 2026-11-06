import test from "node:test";
import assert from "node:assert";
import { orderService } from "../server/src/services/orderService";
import { DbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import {
  checkTaskOwnership,
  startPickupTaskAction,
  completePickupTaskAction,
  releasePickupTaskAction,
  startDeliveryTaskAction,
  completeDeliveryTaskAction,
  releaseDeliveryTaskAction,
  startMessengerTask,
} from "../src/app/data/messengerTaskAdapter";
import { orderStore } from "../src/app/data/orderStore";
import { ApiError } from "../server/src/middleware/errorHandler";

const dbOrderRepository = new DbOrderRepository();

const courierPickup: any = {
  userId: "usr-msg-pickup",
  employeeId: "EMP-MSG-PICKUP",
  nama: "Kurir Jemput",
  userName: "Kurir Jemput",
  role: "messenger",
  jabatan: "MESSENGER",
};

const courierDelivery: any = {
  userId: "usr-msg-delivery",
  employeeId: "EMP-MSG-DELIVERY",
  nama: "Kurir Antar",
  userName: "Kurir Antar",
  role: "messenger",
  jabatan: "MESSENGER",
};

const courierOther: any = {
  userId: "usr-msg-other",
  employeeId: "EMP-MSG-OTHER",
  nama: "Kurir Lain",
  userName: "Kurir Lain",
  role: "messenger",
  jabatan: "MESSENGER",
};

const adminUser: any = {
  userId: "usr-admin-p3",
  employeeId: "EMP-ADM-P3",
  nama: "Admin Operasional",
  userName: "Admin Operasional",
  role: "administrator",
  jabatan: "SUPERADMIN",
};

function createBaseOrder(overrides: any = {}): any {
  return {
    orderNo: overrides.orderNo || `ORD-P3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customer: overrides.customer || "Budi Santoso",
    nomorHP: overrides.nomorHP || "081234567890",
    nopol: overrides.nopol || "B 1234 SUN",
    layanan: overrides.layanan || "Perpanjangan 1 Tahun",
    service_id: overrides.service_id || "svc-perp-1th",
    currentStep: overrides.currentStep !== undefined ? overrides.currentStep : 2,
    currentStageName: overrides.currentStageName || "Penjadwalan",
    createdAt: overrides.createdAt || new Date().toISOString(),
    ...overrides,
  };
}

test("PHASE 3: ANTAR / JEMPUT LIFECYCLE SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // GROUP 1: START PROCESS GATING (Tests 1 to 6)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("3.1: Valid Antar task can start (Step 7)", () => {
    const orderNo = `ORD-P3-ANTAR-START-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 7,
      currentStageName: "Pengantaran",
      deliveryMessengerId: courierDelivery.employeeId,
      messengerPengantar: courierDelivery.nama,
      deliveryStatus: "Terjadwal",
      taskAcceptance: {
        ["Pengantaran Dokumen"]: {
          status: "ACCEPTED",
          courierId: courierDelivery.employeeId,
          courierName: courierDelivery.nama,
          isLocked: true,
        },
      },
    });
    dbOrderRepository.saveOrder(order);

    const started = orderService.startDeliveryTask(orderNo, courierDelivery);
    assert.strictEqual(started.deliveryStatus, "Sedang Diantar");
    assert.strictEqual(started.messengerTaskStatus, "Dalam Proses");
    assert.ok(started.deliveryStartedAt, "deliveryStartedAt harus terisi");
    const tl = started.messengerTimeline || [];
    assert.ok(tl.length > 0);
    assert.strictEqual(tl[0].title, "Mulai Pengantaran Dokumen");
  });

  await suite.test("3.2: Valid Jemput task can start (Step 2)", () => {
    const orderNo = `ORD-P3-JEMPUT-START-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      messengerTaskStatus: "Belum Diambil",
      taskAcceptance: {
        ["Jemput Dokumen"]: {
          status: "ACCEPTED",
          courierId: courierPickup.employeeId,
          courierName: courierPickup.nama,
          isLocked: true,
        },
      },
    });
    dbOrderRepository.saveOrder(order);

    const started = orderService.startPickupTask(orderNo, courierPickup);
    assert.strictEqual(started.messengerTaskStatus, "Sedang Dijemput");
    assert.ok(started.startedAt, "startedAt harus terisi");
    const tl = started.messengerTimeline || [];
    assert.ok(tl.length > 0);
    assert.strictEqual(tl[0].title, "Mulai Penjemputan Dokumen");
  });

  await suite.test("3.3: Duplicate start is strictly idempotent without duplicate timeline", () => {
    const orderNo = `ORD-P3-IDEMP-START-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      taskAcceptance: {
        ["Jemput Dokumen"]: {
          status: "ACCEPTED",
          courierId: courierPickup.employeeId,
          isLocked: true,
        },
      },
    });
    dbOrderRepository.saveOrder(order);

    const started1 = orderService.startPickupTask(orderNo, courierPickup);
    const count1 = (started1.messengerTimeline || []).length;

    const started2 = orderService.startPickupTask(orderNo, courierPickup);
    const count2 = (started2.messengerTimeline || []).length;

    assert.strictEqual(count1, count2, "Duplicate start tidak boleh menambah event timeline");
    assert.strictEqual(started2.messengerTaskStatus, "Sedang Dijemput");
  });

  await suite.test("3.4: Cancelled order cannot start Antar or Jemput (HTTP 400 ORDER_CANCELLED)", () => {
    const orderNo = `ORD-P3-CANCEL-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Dibatalkan",
      isCancelled: true,
      assignedMessengerId: courierPickup.employeeId,
    });
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.startPickupTask(orderNo, courierPickup),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "ORDER_CANCELLED");
        return true;
      }
    );
  });

  await suite.test("3.5: Invalid stage cannot start (Antar on Step 2 -> 400 INVALID_STAGE; Jemput on Step 4 -> 400 INVALID_STAGE)", () => {
    const orderNoAntarOn2 = `ORD-P3-STAGE-A-${Date.now()}`;
    const order1 = createBaseOrder({
      orderNo: orderNoAntarOn2,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      deliveryMessengerId: courierDelivery.employeeId,
    });
    dbOrderRepository.saveOrder(order1);

    assert.throws(
      () => orderService.startDeliveryTask(orderNoAntarOn2, courierDelivery),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "INVALID_STAGE");
        return true;
      }
    );

    const orderNoJemputOn4 = `ORD-P3-STAGE-J-${Date.now()}`;
    const order2 = createBaseOrder({
      orderNo: orderNoJemputOn4,
      currentStep: 4,
      currentStageName: "Proses Samsat",
      assignedMessengerId: courierPickup.employeeId,
    });
    dbOrderRepository.saveOrder(order2);

    assert.throws(
      () => orderService.startPickupTask(orderNoJemputOn4, courierPickup),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "INVALID_STAGE");
        return true;
      }
    );
  });

  await suite.test("3.6: Unassigned Messenger cannot start task from pool (HTTP 403 FORBIDDEN)", () => {
    const orderNo = `ORD-P3-POOL-START-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: undefined,
      messenger: "Belum Ditugaskan",
    });
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.startPickupTask(orderNo, courierPickup),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        assert.ok(err.message.includes("masih berada di pool"));
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // GROUP 2: PROGRESS LIFECYCLE (Tests 7 to 14)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("3.7: Progress cannot be modified before start in adapter (Scope A)", () => {
    const orderNo = `ORD-P3-ADAPT-PRESTART-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      messengerTaskStatus: "Belum Diambil",
      taskAcceptance: {
        ["Jemput Dokumen"]: {
          status: "ACCEPTED",
          courierId: courierPickup.employeeId,
          isLocked: true,
        },
      },
    });
    orderStore.addOrder(order);
    orderStore.updateOrder(orderNo, {
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      messengerTaskStatus: "Belum Diambil",
      startedAt: undefined,
      taskAcceptance: {
        ["Jemput Dokumen"]: {
          status: "ACCEPTED",
          courierId: courierPickup.employeeId,
          isLocked: true,
        },
      },
    });

    const compRes = completePickupTaskAction(orderNo, { pickupChecklist: { stnk: true } }, courierPickup);
    assert.strictEqual(compRes.success, false);
    assert.ok(compRes.error?.includes("belum dimulai"));
  });

  await suite.test("3.8: Backend rejects pre-start mutation with PICKUP_NOT_STARTED / DELIVERY_NOT_STARTED (HTTP 400)", () => {
    const orderNoP = `ORD-P3-PRESTART-P-${Date.now()}`;
    const orderP = createBaseOrder({
      orderNo: orderNoP,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      messengerTaskStatus: "Belum Diambil",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(orderP);

    assert.throws(
      () => orderService.updateOrder(orderNoP, { pickupChecklist: { stnk: true } }, courierPickup),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "PICKUP_NOT_STARTED");
        return true;
      }
    );

    const orderNoD = `ORD-P3-PRESTART-D-${Date.now()}`;
    const orderD = createBaseOrder({
      orderNo: orderNoD,
      currentStep: 7,
      currentStageName: "Pengantaran",
      deliveryMessengerId: courierDelivery.employeeId,
      deliveryStatus: "Terjadwal",
      taskAcceptance: {
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(orderD);

    assert.throws(
      () => orderService.updateOrder(orderNoD, { receiverName: "Budi" }, courierDelivery),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "DELIVERY_NOT_STARTED");
        return true;
      }
    );
  });

  await suite.test("3.9: Assigned Messenger can update the correct task after start", () => {
    const orderNo = `ORD-P3-ASSIGNED-MUT-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    const updated = orderService.updateOrder(
      orderNo,
      { pickupChecklist: { stnk: true, bpkb: true } },
      courierPickup
    );
    assert.strictEqual(updated.pickupChecklist?.stnk, true);
    assert.strictEqual(updated.pickupChecklist?.bpkb, true);
  });

  await suite.test("3.10: Messenger assigned to Antar cannot mutate Jemput (HTTP 403 FORBIDDEN)", () => {
    const orderNo = `ORD-P3-ANTAR-TO-JEMPUT-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      deliveryMessengerId: courierDelivery.employeeId,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    // Courier Delivery attempts to mutate Jemput checklist
    assert.throws(
      () => orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true } }, courierDelivery),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        assert.ok(err.message.includes("Penjemputan"));
        return true;
      }
    );
  });

  await suite.test("3.11: Messenger assigned to Jemput cannot mutate Antar (HTTP 403 FORBIDDEN)", () => {
    const orderNo = `ORD-P3-JEMPUT-TO-ANTAR-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 7,
      currentStageName: "Pengantaran",
      assignedMessengerId: courierPickup.employeeId,
      deliveryMessengerId: courierDelivery.employeeId,
      deliveryStartedAt: new Date().toISOString(),
      deliveryStatus: "Sedang Diantar",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    // Courier Pickup attempts to mutate Delivery receiver
    assert.throws(
      () => orderService.updateOrder(orderNo, { receiverName: "Keluarga" }, courierPickup),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        assert.ok(err.message.includes("Pengantaran"));
        return true;
      }
    );
  });

  await suite.test("3.12: Another Messenger cannot mutate the task (HTTP 403 FORBIDDEN)", () => {
    const orderNo = `ORD-P3-OTHER-MSG-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true } }, courierOther),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  await suite.test("3.13: Invalid progress transitions are rejected (missing recipient name in delivery completion)", () => {
    const orderNo = `ORD-P3-INVALID-TRANS-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 7,
      currentStageName: "Pengantaran",
      deliveryMessengerId: courierDelivery.employeeId,
      deliveryStartedAt: new Date().toISOString(),
      deliveryStatus: "Sedang Diantar",
      taskAcceptance: {
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.completeDeliveryTask(orderNo, { recipientName: "", relationship: "Keluarga" }, courierDelivery),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "RECIPIENT_REQUIRED");
        return true;
      }
    );
  });

  await suite.test("3.14: Progress persists after refresh/reload (stored in database)", () => {
    const orderNo = `ORD-P3-PERSIST-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true, bpkb: true, ktp: true } }, courierPickup);

    // Retrieve fresh instance
    const fresh = orderService.getByOrderNo(orderNo);
    assert.strictEqual(fresh?.pickupChecklist?.stnk, true);
    assert.strictEqual(fresh?.pickupChecklist?.bpkb, true);
    assert.strictEqual(fresh?.pickupChecklist?.ktp, true);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // GROUP 3: SAVE PROGRESS & HANDOVER (Tests 15 to 22)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("3.15: Keep assignment preserves current ownership and persists progress", () => {
    const orderNo = `ORD-P3-KEEP-ASSIGN-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    orderStore.addOrder(order);
    orderStore.updateOrder(orderNo, {
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      messengerTaskStatus: "Sedang Dijemput",
      startedAt: new Date().toISOString(),
      taskAcceptance: {
        ["Jemput Dokumen"]: {
          status: "ACCEPTED",
          courierId: courierPickup.employeeId,
          isLocked: true,
        },
      },
    });

    // Courier saves progress while keeping assignment
    orderStore.updateOrder(orderNo, {
      pickupChecklist: { stnk: true },
    });

    const updated = orderStore.getOrderByNo(orderNo);
    assert.strictEqual(updated?.assignedMessengerId, courierPickup.employeeId);
    assert.strictEqual(updated?.taskAcceptance?.["Jemput Dokumen"]?.status, "ACCEPTED");
    assert.strictEqual(updated?.taskAcceptance?.["Jemput Dokumen"]?.isLocked, true);
    assert.strictEqual(updated?.pickupChecklist?.stnk, true);
  });

  await suite.test("3.16: Handover preserves progress and adds audit timeline event", () => {
    const orderNo = `ORD-P3-HANDOVER-PROG-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      pickupChecklist: { stnk: true, bpkb: true },
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    const released = orderService.releasePickupTask(orderNo, courierPickup);
    assert.strictEqual(released.assignedMessengerId, undefined);
    assert.strictEqual(released.messenger, "Belum Ditugaskan");
    assert.strictEqual(released.pickupChecklist?.stnk, true, "Checklist STNK harus tetap tersimpan");
    assert.strictEqual(released.pickupChecklist?.bpkb, true, "Checklist BPKB harus tetap tersimpan");
    assert.strictEqual(released.taskAcceptance?.["Jemput Dokumen"]?.status, "PENDING");
    assert.strictEqual(released.taskAcceptance?.["Jemput Dokumen"]?.isLocked, false);
    const tl = released.messengerTimeline || [];
    assert.strictEqual(tl[0].title, "Tugas Penjemputan Diserahkan ke Tim");
  });

  await suite.test("3.17: Handover releases only the correct assignment", () => {
    const orderNo = `ORD-P3-RELEASE-SPECIFIC-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      deliveryMessengerId: courierDelivery.employeeId,
      samsatMessengerId: "EMP-MSG-SAMSAT",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    const released = orderService.releasePickupTask(orderNo, courierPickup);
    assert.strictEqual(released.assignedMessengerId, undefined);
    assert.strictEqual((released as any).deliveryMessengerId, courierDelivery.employeeId, "deliveryMessengerId tidak boleh ikut terlepas");
    assert.strictEqual(released.samsatMessengerId, "EMP-MSG-SAMSAT", "samsatMessengerId tidak boleh ikut terlepas");
  });

  await suite.test("3.18: Other workflow assignment remains unchanged when delivery is released", () => {
    const orderNo = `ORD-P3-RELEASE-DELIV-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 7,
      currentStageName: "Pengantaran",
      assignedMessengerId: courierPickup.employeeId,
      deliveryMessengerId: courierDelivery.employeeId,
      deliveryStartedAt: new Date().toISOString(),
      deliveryStatus: "Sedang Diantar",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    const released = orderService.releaseDeliveryTask(orderNo, courierDelivery);
    assert.strictEqual((released as any).deliveryMessengerId, undefined);
    assert.strictEqual(released.assignedMessengerId, courierPickup.employeeId, "assignedMessengerId penjemputan harus tetap utuh");
    assert.strictEqual(released.taskAcceptance?.["Pengantaran Dokumen"]?.status, "PENDING");
    assert.strictEqual(released.taskAcceptance?.["Jemput Dokumen"]?.status, "ACCEPTED");
  });

  await suite.test("3.19: Previous Messenger cannot mutate task after handover", () => {
    const orderNo = `ORD-P3-PREV-MUT-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    orderService.releasePickupTask(orderNo, courierPickup);

    // Previous courier attempts to update checklist after handover
    assert.throws(
      () => orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true } }, courierPickup),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        assert.ok(err.message.includes("masih berada di pool"));
        return true;
      }
    );
  });

  await suite.test("3.20: New Messenger can claim and continue progress from pool", () => {
    const orderNo = `ORD-P3-NEW-CLAIM-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: undefined,
      messenger: "Belum Ditugaskan",
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      pickupChecklist: { stnk: true },
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "PENDING", isLocked: false },
      },
    });
    dbOrderRepository.saveOrder(order);

    // Courier Other claims the task
    const claimed = orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierOther);
    assert.strictEqual(claimed.assignedMessengerId, courierOther.employeeId);
    assert.strictEqual(claimed.taskAcceptance?.["Jemput Dokumen"]?.courierId, courierOther.employeeId);
    assert.strictEqual(claimed.taskAcceptance?.["Jemput Dokumen"]?.isLocked, true);

    // Courier Other continues checklist
    const updated = orderService.updateOrder(
      orderNo,
      { pickupChecklist: { stnk: true, bpkb: true } },
      courierOther
    );
    assert.strictEqual(updated.pickupChecklist?.stnk, true);
    assert.strictEqual(updated.pickupChecklist?.bpkb, true);
  });

  await suite.test("3.21: Concurrent task claim conflict returns HTTP 409 TASK_ALREADY_ACCEPTED", () => {
    const orderNo = `ORD-P3-CONCURR-CLAIM-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: undefined,
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "PENDING", isLocked: false },
      },
    });
    dbOrderRepository.saveOrder(order);

    orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierPickup);

    assert.throws(
      () => orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierOther),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 409);
        assert.strictEqual(err.code, "TASK_ALREADY_ACCEPTED");
        return true;
      }
    );
  });

  await suite.test("3.22: Concurrent handover and update preserves progress without losing data", () => {
    const orderNo = `ORD-P3-CONCURR-HANDOVER-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      pickupChecklist: { stnk: true },
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    // Courier saves progress before releasing
    orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true, bpkb: true } }, courierPickup);
    const released = orderService.releasePickupTask(orderNo, courierPickup);

    assert.strictEqual(released.pickupChecklist?.stnk, true);
    assert.strictEqual(released.pickupChecklist?.bpkb, true);
    assert.strictEqual(released.assignedMessengerId, undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // GROUP 4: STATUS CONSISTENCY (Tests 23 to 27)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("3.23: Incomplete work cannot complete the order (completing pickup does not jump to step 8)", () => {
    const orderNo = `ORD-P3-NO-JUMP-8-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    const completedPickup = orderService.completePickupTask(orderNo, { pickupChecklist: { stnk: true } }, courierPickup);
    assert.strictEqual(completedPickup.currentStep, 2, "Current step harus tetap 2 menunggu verifikasi kantor");
    assert.strictEqual(completedPickup.currentStageName, "Penjadwalan");
    assert.strictEqual(completedPickup.pickupCompleted, true);
    assert.strictEqual(completedPickup.messengerTaskStatus, "Dokumen Sudah Tersedia");
  });

  await suite.test("3.24: Completing Antar does not incorrectly complete Jemput", () => {
    const orderNo = `ORD-P3-ANTAR-NOT-JEMPUT-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 7,
      currentStageName: "Pengantaran",
      assignedMessengerId: courierPickup.employeeId,
      deliveryMessengerId: courierDelivery.employeeId,
      deliveryStartedAt: new Date().toISOString(),
      deliveryStatus: "Sedang Diantar",
      pickupCompleted: true,
      pickupCompletedAt: "2026-11-01T10:00:00.000Z",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    const completedDelivery = orderService.completeDeliveryTask(
      orderNo,
      { recipientName: "Budi Santoso", relationship: "Pemilik Langsung" },
      courierDelivery
    );
    assert.strictEqual(completedDelivery.deliveryStatus, "Dokumen Diserahkan");
    assert.strictEqual(completedDelivery.isReceived, true);
    assert.strictEqual(completedDelivery.pickupCompleted, true, "pickupCompleted harus tetap true");
    assert.strictEqual(completedDelivery.pickupCompletedAt, "2026-11-01T10:00:00.000Z", "pickupCompletedAt tidak boleh berubah");
  });

  await suite.test("3.25: Completing Jemput does not damage Antar history", () => {
    const orderNo = `ORD-P3-JEMPUT-NOT-ANTAR-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      deliveryMessengerId: courierDelivery.employeeId,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      catatanPengantaran: "Titip satpam komplek",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    const completedPickup = orderService.completePickupTask(orderNo, {}, courierPickup);
    assert.strictEqual(completedPickup.catatanPengantaran, "Titip satpam komplek");
    assert.strictEqual((completedPickup as any).deliveryMessengerId, courierDelivery.employeeId);
  });

  await suite.test("3.26: Duplicate completion is safe and idempotent", () => {
    const orderNo = `ORD-P3-IDEMP-COMP-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      startedAt: new Date().toISOString(),
      messengerTaskStatus: "Sedang Dijemput",
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    const comp1 = orderService.completePickupTask(orderNo, {}, courierPickup);
    const count1 = (comp1.messengerTimeline || []).length;

    const comp2 = orderService.completePickupTask(orderNo, {}, courierPickup);
    const count2 = (comp2.messengerTimeline || []).length;

    assert.strictEqual(count1, count2, "Duplicate completion tidak boleh menambah timeline event duplikat");
    assert.strictEqual(comp2.pickupCompleted, true);
  });

  await suite.test("3.27: Existing Samsat workflow does not regress (Samsat start/complete still works 100%)", () => {
    const orderNo = `ORD-P3-SAMSAT-REGRESS-${Date.now()}`;
    const courierSamsat: any = {
      userId: "usr-msg-samsat",
      employeeId: "EMP-MSG-SAMSAT",
      nama: "Kurir Samsat",
      userName: "Kurir Samsat",
      role: "messenger",
      jabatan: "MESSENGER",
    };

    const order = createBaseOrder({
      orderNo,
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Terjadwal Samsat",
      samsatMessengerId: courierSamsat.employeeId,
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai", basePrice: 25000 },
      ],
      taskAcceptance: {
        ["Proses Samsat"]: { status: "ACCEPTED", courierId: courierSamsat.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    // Start Samsat
    const started = orderService.startSamsatProcess(orderNo, courierSamsat);
    assert.strictEqual(started.samsatStatus, "Sedang Proses Samsat");

    // Complete Samsat component
    orderService.updateOrder(
      orderNo,
      {
        samsatProcesses: [
          { id: "comp-1", name: "Cek Fisik", status: "Selesai", basePrice: 25000, actualCost: 25000 },
        ],
      },
      courierSamsat
    );

    // Complete Samsat process (zero free-text notes for courier)
    const completed = orderService.completeSamsatProcess(orderNo, {}, courierSamsat);
    assert.strictEqual(completed.samsatStatus, "Selesai");
    assert.strictEqual(completed.taskAcceptance?.["Jemput Hasil Samsat"]?.status, "PENDING");
  });

});
