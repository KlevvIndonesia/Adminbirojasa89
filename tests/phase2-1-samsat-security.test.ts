/**
 * Phase 2.1 Controlled Implementation Test Suite
 * Samsat Security & Workflow Integrity Patch
 * Admin SUN89 — Biro Jasa Management System
 */

import test from "node:test";
import assert from "node:assert";
import { orderService } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import {
  checkTaskOwnership,
  acceptMessengerTaskAction,
  releaseSamsatTaskAction,
  updateMessengerComponent,
  updateMessengerComponentPrice,
  deleteSamsatComponentFromOrder,
  startSamsatProcessAction,
  completeSamsatProcess,
} from "../src/app/data/messengerTaskAdapter";
import { orderStore } from "../src/app/data/orderStore";
import { ApiError } from "../server/src/middleware/errorHandler";

const courierA: any = {
  userId: "usr-msg-21",
  employeeId: "EMP-MSG-021",
  nama: "Kurir Alpha",
  userName: "Kurir Alpha",
  role: "messenger",
  jabatan: "MESSENGER",
};

const courierB: any = {
  userId: "usr-msg-22",
  employeeId: "EMP-MSG-022",
  nama: "Kurir Bravo",
  userName: "Kurir Bravo",
  role: "messenger",
  jabatan: "MESSENGER",
};

const adminUser: any = {
  userId: "usr-admin-20",
  employeeId: "EMP-ADM-020",
  nama: "Administrator Super",
  userName: "Administrator Super",
  role: "administrator",
  jabatan: "SUPERADMIN",
};

test("PHASE 2.1: SAMSAT SECURITY & WORKFLOW INTEGRITY SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 1: Cancelled order cannot start Samsat
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.1: Cancelled order cannot start Samsat (HTTP 400 ORDER_CANCELLED)", () => {
    const orderNo = `ORD-SEC-CANCEL-START-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Cancelled 1",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Dibatalkan",
      isCancelled: true,
      samsatStatus: "Terjadwal Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai" }],
    };
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.startSamsatProcess(orderNo, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "ORDER_CANCELLED");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 2: Cancelled order cannot complete Samsat
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.2: Cancelled order cannot complete Samsat (HTTP 400 ORDER_CANCELLED)", () => {
    const orderNo = `ORD-SEC-CANCEL-COMP-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Cancelled 2",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      isCancelled: true,
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.completeSamsatProcess(orderNo, {}, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "ORDER_CANCELLED");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 3: Order outside valid Samsat stage cannot start
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.3: Order outside valid Samsat stage (Step 2) cannot start (HTTP 400 INVALID_STAGE)", () => {
    const orderNo = `ORD-SEC-STAGE-START-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Step 2",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 2,
      currentStageName: "Penjadwalan",
      samsatStatus: "Terjadwal Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai" }],
    };
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.startSamsatProcess(orderNo, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "INVALID_STAGE");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 4: Order outside valid Samsat stage cannot complete
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.4: Order outside valid Samsat stage (Step 1) cannot complete (HTTP 400 INVALID_STAGE)", () => {
    const orderNo = `ORD-SEC-STAGE-COMP-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Step 1",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 1,
      currentStageName: "Verifikasi",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.completeSamsatProcess(orderNo, {}, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "INVALID_STAGE");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 5: Duplicate start remains idempotent
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.5: Duplicate start request remains strictly idempotent without duplicate timeline", () => {
    const orderNo = `ORD-SEC-IDEMP-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Idemp",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Terjadwal Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai" }],
    };
    dbOrderRepository.saveOrder(order);

    const first = orderService.startSamsatProcess(orderNo, courierA);
    const count1 = (first.messengerTimeline || []).length;
    assert.strictEqual(count1, 1);

    const second = orderService.startSamsatProcess(orderNo, courierA);
    const count2 = (second.messengerTimeline || []).length;
    assert.strictEqual(count2, count1, "Timeline event must NOT increase on duplicate start");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 6: Completed cycle cannot be restarted incorrectly
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.6: Completed cycle cannot be restarted without new cycle (HTTP 400 SAMSAT_ALREADY_COMPLETED)", () => {
    const orderNo = `ORD-SEC-COMP-RESTART-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Completed Restart",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Selesai",
      samsatCycle: 1,
      samsatCompletedCycle: 1,
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.startSamsatProcess(orderNo, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "SAMSAT_ALREADY_COMPLETED");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 7: Assigned Messenger can start and complete
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.7: Assigned Messenger can start and complete Samsat successfully", () => {
    const orderNo = `ORD-SEC-ASSIGNED-OK-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Assigned OK",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Terjadwal Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    const started = orderService.startSamsatProcess(orderNo, courierA);
    assert.strictEqual(started.samsatStatus, "Sedang Proses Samsat");

    const completed = orderService.completeSamsatProcess(orderNo, {}, courierA);
    assert.strictEqual(completed.samsatStatus, "Selesai");
    assert.strictEqual(completed.samsatCompletedCycle, 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 8: Unassigned Messenger cannot start or complete
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.8: Unassigned Messenger cannot start or complete Samsat from pool (HTTP 403 FORBIDDEN)", () => {
    const orderNo = `ORD-SEC-UNASSIGNED-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Unassigned Pool",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Terjadwal Samsat",
      samsatMessengerId: undefined, // Unassigned in pool
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    // Unassigned start attempt rejected
    assert.throws(
      () => orderService.startSamsatProcess(orderNo, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );

    // Unassigned complete attempt rejected
    assert.throws(
      () => orderService.completeSamsatProcess(orderNo, {}, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 9: Messenger A cannot modify Messenger B's task
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.9: Messenger B cannot start, complete, or mutate Messenger A's assigned task (HTTP 403)", () => {
    const orderNo = `ORD-SEC-OTHER-COURIER-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Courier A Task",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courierA.employeeId, // Assigned to Courier A
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    // Courier B start rejected
    assert.throws(
      () => orderService.startSamsatProcess(orderNo, courierB),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );

    // Courier B complete rejected
    assert.throws(
      () => orderService.completeSamsatProcess(orderNo, {}, courierB),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );

    // Courier B updateOrder rejected
    assert.throws(
      () => orderService.updateOrder(orderNo, { samsatProcesses: [] }, courierB),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 10: Previous Messenger cannot modify after handover
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.10: Previous Messenger cannot modify task after handover to pool", () => {
    const orderNo = `ORD-SEC-HANDOVER-PREV-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Handover Prev",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    // Handover task: clear assignment
    orderService.updateOrder(orderNo, {
      samsatMessengerId: undefined,
      samsatMessenger: "Belum Ditugaskan",
    }, adminUser);

    // Previous Courier A attempts mutation -> REJECTED
    assert.throws(
      () => orderService.updateOrder(orderNo, {
        messengerComponentProgress: {
          "comp-1": { componentId: "comp-1", name: "Cek Fisik", status: "COMPLETED" },
        },
      }, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 11: New assigned Messenger can continue progress
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.11: New assigned Messenger can accept from pool and continue progress", () => {
    const orderNo = `ORD-SEC-NEW-COURIER-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan New Courier",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: undefined, // in pool
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Selesai" },
        { id: "comp-2", name: "Pendaftaran", status: "Belum Dimulai" },
      ],
    };
    dbOrderRepository.saveOrder(order);

    // Courier B claims task from pool
    const accepted = orderService.acceptMessengerTask(orderNo, "Proses Samsat", courierB);
    assert.strictEqual(accepted.samsatMessengerId, courierB.employeeId);

    // Courier B updates component progress -> SUCCESS
    const updated = orderService.updateOrder(orderNo, {
      messengerComponentProgress: {
        "comp-1": { componentId: "comp-1", name: "Cek Fisik", status: "COMPLETED" },
        "comp-2": { componentId: "comp-2", name: "Pendaftaran", status: "COMPLETED" },
      },
    }, courierB);

    assert.ok(updated);
    assert.strictEqual(updated.messengerComponentProgress?.["comp-2"]?.status, "COMPLETED");

    // Courier B completes Samsat -> SUCCESS
    const completed = orderService.completeSamsatProcess(orderNo, {}, courierB);
    assert.strictEqual(completed.samsatStatus, "Selesai");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 12: Unassigned pool task is read-only
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.12: Unassigned pool task is read-only to Messenger in adapter checkTaskOwnership", () => {
    const unassignedOrder: any = {
      orderNo: `ORD-SEC-POOL-RO-${Date.now()}`,
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: undefined, // in pool
    };

    const authCheck = checkTaskOwnership(unassignedOrder, courierA);
    assert.strictEqual(authCheck.allowed, false, "Pool task must be read-only to Messenger");
    assert.ok(authCheck.error?.includes("Daftar Tugas (Pool)"));
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 13: Component mutation before start is rejected by backend
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.13: Component mutation before start is rejected by backend (HTTP 400 SAMSAT_NOT_STARTED)", () => {
    const orderNo = `ORD-SEC-PRESTART-MUT-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Prestart",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Terjadwal Samsat", // Not started yet!
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai" }],
    };
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.updateOrder(orderNo, {
        messengerComponentProgress: {
          "comp-1": { componentId: "comp-1", name: "Cek Fisik", status: "IN_PROGRESS" },
        },
      }, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "SAMSAT_NOT_STARTED");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 14: Admin authorization remains functional
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.14: Admin retains full operational supervision over unassigned or assigned tasks", () => {
    const orderNo = `ORD-SEC-ADMIN-PRIV-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Admin Priv",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    // Admin can update component even if assigned to courierA
    const updated = orderService.updateOrder(orderNo, {
      messengerComponentProgress: {
        "comp-1": { componentId: "comp-1", name: "Cek Fisik", status: "COMPLETED" },
      },
    }, adminUser);
    assert.ok(updated);

    // Admin can complete Samsat
    const completed = orderService.completeSamsatProcess(orderNo, { note: "Diselesaikan oleh Admin" }, adminUser);
    assert.strictEqual(completed.samsatStatus, "Selesai");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 15: Concurrent task claim protection remains functional
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.15: Concurrent task claim conflict returns HTTP 409 TASK_ALREADY_ACCEPTED", () => {
    const orderNo = `ORD-SEC-CLAIM-CONCURR-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Claim Concurr",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Terjadwal Samsat",
      taskAcceptance: {
        "Proses Samsat": {
          status: "PENDING",
          isLocked: false,
        },
      },
    };
    dbOrderRepository.saveOrder(order);

    // Courier A accepts first
    const acceptedA = orderService.acceptMessengerTask(orderNo, "Proses Samsat", courierA);
    assert.strictEqual(acceptedA.taskAcceptance?.["Proses Samsat"]?.courierId, courierA.employeeId);

    // Courier B attempts to accept the already locked task -> 409 Conflict
    assert.throws(
      () => orderService.acceptMessengerTask(orderNo, "Proses Samsat", courierB),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 409);
        assert.strictEqual(err.code, "TASK_ALREADY_ACCEPTED");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 16: Completion transaction remains atomic and idempotent
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.16: Completion transaction commits status, cycle, and Jemput Hasil atomically", () => {
    const orderNo = `ORD-SEC-ATOMIC-COMP-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Atomic Comp",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    const completed = orderService.completeSamsatProcess(orderNo, {}, courierA);
    assert.strictEqual(completed.samsatStatus, "Selesai");
    assert.strictEqual(completed.samsatCompletedCycle, 1);
    assert.strictEqual(completed.taskAcceptance?.["Jemput Hasil Samsat"]?.status, "PENDING");
    assert.strictEqual(completed.taskAcceptance?.["Jemput Hasil Samsat"]?.cycle, 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 17: Cycle 1 history does not block cycle 2
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.17: Cycle 1 history does not block cycle 2 after rollback, and marks old task SUPERSEDED", () => {
    const orderNo = `ORD-SEC-CYCLE-HIST-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Cycle Hist",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Selesai" }],
    };
    dbOrderRepository.saveOrder(order);

    // 1. Complete Cycle 1
    orderService.completeSamsatProcess(orderNo, {}, courierA);

    // 2. Advance to Step 5
    orderService.advanceOrder(orderNo, "Verifikasi Ulang", {}, courierA);

    // 3. Admin rolls back to Step 4
    const rolledBack = orderService.rollbackOrder(orderNo, "Proses Samsat", {}, adminUser);
    assert.strictEqual((rolledBack as any).samsatCycle, 2);
    assert.strictEqual(rolledBack.taskAcceptance?.["Jemput Hasil Samsat"]?.status, "SUPERSEDED");

    // 4. Start and Complete Cycle 2
    const c2Start = orderService.startSamsatProcess(orderNo, courierA);
    assert.strictEqual(c2Start.samsatStatus, "Sedang Proses Samsat");

    const c2Complete = orderService.completeSamsatProcess(orderNo, {}, courierA);
    assert.strictEqual(c2Complete.samsatStatus, "Selesai");
    assert.strictEqual(c2Complete.samsatCompletedCycle, 2);
    assert.strictEqual(c2Complete.taskAcceptance?.["Jemput Hasil Samsat"]?.cycle, 2);
    assert.strictEqual(c2Complete.taskAcceptance?.["Jemput Hasil Samsat"]?.status, "PENDING");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 18: Existing Phase 1 and Phase 2 behavior remains intact
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1.18: Gating 4.5 in advanceOrder prevents advancing incomplete Samsat to Step 5", () => {
    const orderNo = `ORD-SEC-GATING-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Incomplete Advance",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courierA.employeeId,
      samsatProcesses: [{ id: "comp-1", name: "Cek Fisik", status: "Dalam Proses" }],
    };
    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.advanceOrder(orderNo, "Verifikasi Ulang", {}, courierA),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "SAMSAT_COMPONENTS_INCOMPLETE");
        return true;
      }
    );
  });
});
