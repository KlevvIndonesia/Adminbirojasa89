import test from "node:test";
import assert from "node:assert";
import { orderService, assertMessengerOwnership } from "../server/src/services/orderService";
import { DbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { checkTaskOwnership, isTaskAssignedToMessenger } from "../src/app/data/messengerTaskAdapter";
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

const courierSamsat: any = {
  userId: "usr-msg-samsat",
  employeeId: "EMP-MSG-SAMSAT",
  nama: "Kurir Samsat",
  userName: "Kurir Samsat",
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
  userId: "usr-admin-p31",
  employeeId: "EMP-ADM-P31",
  nama: "Admin Operasional",
  userName: "Admin Operasional",
  role: "administrator",
  jabatan: "SUPERADMIN",
};

function createBaseOrder(overrides: any = {}): any {
  return {
    orderNo: overrides.orderNo || `ORD-P31-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

test("PHASE 3.1: MESSENGER CANONICAL IDENTITY & AUTHORIZATION CONSISTENCY SUITE", async (suite) => {

  await suite.test("3.1.1: Valid canonical Messenger identity is authorized", () => {
    const orderNo = `ORD-P31-CANONICAL-AUTH-${Date.now()}`;
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

    const updated = orderService.updateOrder(
      orderNo,
      { pickupChecklist: { stnk: true } },
      courierPickup
    );
    assert.strictEqual(updated.pickupChecklist?.stnk, true);

    const adapterAuth = checkTaskOwnership(order, courierPickup, "Jemput Dokumen");
    assert.strictEqual(adapterAuth.allowed, true);
  });

  await suite.test("3.1.2: Missing canonical identity is rejected (HTTP 403)", () => {
    const orderNo = `ORD-P31-NO-IDENTITY-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
    });
    dbOrderRepository.saveOrder(order);

    const anonymousCourier: any = {
      role: "messenger",
      jabatan: "MESSENGER",
      // Missing employeeId and userId
    };

    assert.throws(
      () => orderService.startPickupTask(orderNo, anonymousCourier),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        assert.ok(err.message.includes("Identitas kurir"));
        return true;
      }
    );

    assert.throws(
      () => orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true } }, anonymousCourier),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );

    const adapterCheck = checkTaskOwnership(order, anonymousCourier, "Jemput Dokumen");
    assert.strictEqual(adapterCheck.allowed, false);
    assert.ok(adapterCheck.error?.includes("Identitas kurir"));
  });

  await suite.test("3.1.3: Display-name-only identity is rejected (HTTP 403)", () => {
    const orderNo = `ORD-P31-DISPLAY-NAME-ONLY-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      messenger: courierPickup.nama,
    });
    dbOrderRepository.saveOrder(order);

    const displayNameOnlyUser: any = {
      nama: courierPickup.nama,
      userName: courierPickup.nama,
      role: "messenger",
      jabatan: "MESSENGER",
      // No employeeId, No userId
    };

    assert.throws(
      () => orderService.startPickupTask(orderNo, displayNameOnlyUser),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        assert.ok(err.message.includes("Identitas kurir"));
        return true;
      }
    );

    assert.throws(
      () => orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true } }, displayNameOnlyUser),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );

    const adapterCheck = checkTaskOwnership(order, displayNameOnlyUser, "Jemput Dokumen");
    assert.strictEqual(adapterCheck.allowed, false);
    assert.ok(adapterCheck.error?.includes("Identitas kurir"));
  });

  await suite.test("3.1.4: Matching display name but mismatched employee ID is rejected (HTTP 403)", () => {
    const orderNo = `ORD-P31-SPOOF-NAME-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      messenger: courierPickup.nama,
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

    // Impostor has identical display name but a different canonical ID
    const impostorCourier: any = {
      nama: courierPickup.nama,
      userName: courierPickup.nama,
      employeeId: "EMP-MSG-IMPOSTOR",
      userId: "usr-impostor",
      role: "messenger",
      jabatan: "MESSENGER",
    };

    assert.throws(
      () => orderService.startPickupTask(orderNo, impostorCourier),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        assert.ok(err.message.includes("bukan penugasan aktif Anda"));
        return true;
      }
    );

    assert.throws(
      () => orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true } }, impostorCourier),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );

    const adapterCheck = checkTaskOwnership(order, impostorCourier, "Jemput Dokumen");
    assert.strictEqual(adapterCheck.allowed, false);
    assert.ok(adapterCheck.error?.includes("bukan penugasan aktif Anda"));
  });

  await suite.test("3.1.5: Messenger cannot mutate another Messenger's pickup task", () => {
    const orderNo = `ORD-P31-OTHER-PICKUP-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
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
          courierName: courierPickup.nama,
          isLocked: true,
        },
      },
    });
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true } }, courierOther),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );

    assert.throws(
      () => orderService.completePickupTask(orderNo, {}, courierOther),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );
  });

  await suite.test("3.1.6: Messenger cannot mutate another Messenger's delivery task", () => {
    const orderNo = `ORD-P31-OTHER-DELIV-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 7,
      currentStageName: "Pengantaran",
      deliveryMessengerId: courierDelivery.employeeId,
      messengerPengantar: courierDelivery.nama,
      deliveryStartedAt: new Date().toISOString(),
      deliveryStatus: "Sedang Diantar",
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

    assert.throws(
      () => orderService.updateOrder(orderNo, { receiverName: "Budi Santoso" }, courierOther),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );

    assert.throws(
      () => orderService.completeDeliveryTask(orderNo, { recipientName: "Budi" }, courierOther),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );
  });

  await suite.test("3.1.7: Pickup assignment does not grant delivery permission", () => {
    const orderNo = `ORD-P31-PICKUP-NO-DELIV-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 7,
      currentStageName: "Pengantaran",
      assignedMessengerId: courierPickup.employeeId,
      deliveryMessengerId: courierDelivery.employeeId,
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.startDeliveryTask(orderNo, courierPickup),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        assert.ok(err.message.includes("Pengantaran"));
        return true;
      }
    );

    assert.throws(
      () => orderService.updateOrder(orderNo, { receiverName: "Keluarga" }, courierPickup),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );
  });

  await suite.test("3.1.8: Delivery assignment does not grant pickup permission", () => {
    const orderNo = `ORD-P31-DELIV-NO-PICKUP-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      deliveryMessengerId: courierDelivery.employeeId,
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
        ["Pengantaran Dokumen"]: { status: "ACCEPTED", courierId: courierDelivery.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.startPickupTask(orderNo, courierDelivery),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        assert.ok(err.message.includes("Penjemputan"));
        return true;
      }
    );

    assert.throws(
      () => orderService.updateOrder(orderNo, { pickupChecklist: { stnk: true } }, courierDelivery),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );
  });

  await suite.test("3.1.9: Previous Messenger is rejected after handover", () => {
    const orderNo = `ORD-P31-PREV-HANDOVER-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
      assignedMessengerName: courierPickup.nama,
      messengerTaskStatus: "Sedang Dijemput",
      startedAt: new Date().toISOString(),
      taskAcceptance: {
        ["Jemput Dokumen"]: { status: "ACCEPTED", courierId: courierPickup.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    // Handover by courierPickup
    orderService.releasePickupTask(orderNo, courierPickup);

    // After handover, courierPickup attempts to update checklist
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

  await suite.test("3.1.10: New assigned Messenger can continue", () => {
    const orderNo = `ORD-P31-NEW-ASSIGN-${Date.now()}`;
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

    // courierOther claims the task
    const accepted = orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierOther);
    assert.strictEqual(accepted.assignedMessengerId, courierOther.employeeId);
    assert.strictEqual(accepted.taskAcceptance?.["Jemput Dokumen"]?.courierId, courierOther.employeeId);

    // courierOther can now update progress
    const updated = orderService.updateOrder(
      orderNo,
      { pickupChecklist: { stnk: true, bpkb: true } },
      courierOther
    );
    assert.strictEqual(updated.pickupChecklist?.bpkb, true);
  });

  await suite.test("3.1.11: Admin privileges remain functional", () => {
    const orderNo = `ORD-P31-ADMIN-SUPERVISION-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 2,
      currentStageName: "Penjadwalan",
      assignedMessengerId: courierPickup.employeeId,
    });
    dbOrderRepository.saveOrder(order);

    // Admin can update or override without error
    const updated = orderService.updateOrder(
      orderNo,
      { pickupChecklist: { stnk: true } },
      adminUser
    );
    assert.strictEqual(updated.pickupChecklist?.stnk, true);

    const check = assertMessengerOwnership(order, adminUser, "PICKUP");
    assert.strictEqual(check.messengerId, adminUser.employeeId);
  });

  await suite.test("3.1.12: Existing Phase 2.1 Samsat authorization remains functional", () => {
    const orderNo = `ORD-P31-SAMSAT-AUTH-${Date.now()}`;
    const order = createBaseOrder({
      orderNo,
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatMessengerId: courierSamsat.employeeId,
      samsatStatus: "Terjadwal Samsat",
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai", basePrice: 25000 },
      ],
      taskAcceptance: {
        ["Proses Samsat"]: { status: "ACCEPTED", courierId: courierSamsat.employeeId, isLocked: true },
      },
    });
    dbOrderRepository.saveOrder(order);

    // Unauthorized courier rejected
    assert.throws(
      () => orderService.startSamsatProcess(orderNo, courierOther),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );

    // Authorized courier starts
    const started = orderService.startSamsatProcess(orderNo, courierSamsat);
    assert.strictEqual(started.samsatStatus, "Sedang Proses Samsat");

    // Component mutation by authorized courier succeeds
    const updated = orderService.updateOrder(
      orderNo,
      {
        samsatProcesses: [
          { id: "comp-1", name: "Cek Fisik", status: "Selesai", basePrice: 25000, actualCost: 25000 },
        ],
      },
      courierSamsat
    );
    assert.strictEqual(updated.samsatProcesses[0].status, "Selesai");
  });

  await suite.test("3.1.13: Concurrent acceptance behavior remains functional", () => {
    const orderNo = `ORD-P31-CONCURR-CLAIM-${Date.now()}`;
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

    // First courier accepts
    const acc1 = orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierPickup);
    assert.strictEqual(acc1.assignedMessengerId, courierPickup.employeeId);

    // Second courier tries -> 409 TASK_ALREADY_ACCEPTED
    assert.throws(
      () => orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierOther),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 409);
        assert.strictEqual(err.code, "TASK_ALREADY_ACCEPTED");
        return true;
      }
    );

    // First courier retry is idempotent
    const accRetry = orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierPickup);
    assert.strictEqual(accRetry.assignedMessengerId, courierPickup.employeeId);
  });

});
