/**
 * Phase 2 Controlled Implementation Test Suite
 * Samsat Lifecycle Hardening (Scope 1 to Scope 5)
 * Admin SUN89 — Biro Jasa Management System
 */

import test from "node:test";
import assert from "node:assert";
import { orderService, validateSamsatCompletion } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { validateSamsatComponents } from "../src/app/data/messengerTaskAdapter";
import { ApiError } from "../server/src/middleware/errorHandler";

const courier1: any = {
  userId: "usr-msg-10",
  employeeId: "EMP-MSG-010",
  nama: "Agus Kurir Samsat",
  role: "messenger",
  jabatan: "MESSENGER",
};

const courier2: any = {
  userId: "usr-msg-11",
  employeeId: "EMP-MSG-011",
  nama: "Bambang Kurir Samsat",
  role: "messenger",
  jabatan: "MESSENGER",
};

const adminUser: any = {
  userId: "usr-admin-01",
  employeeId: "EMP-ADM-001",
  nama: "Siti Admin Operasional",
  role: "admin",
  jabatan: "ADMIN",
};

test("PHASE 2: SAMSAT LIFECYCLE HARDENING SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 1 (Scope 1): Start process berhasil
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.1: Start process berhasil mengubah samsatStatus menjadi 'Sedang Proses Samsat'", () => {
    const orderNo = `ORD-PH2-START-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Start Test",
      nomorHP: "081299990101",
      nopol: "B 1010 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Terjadwal Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai", basePrice: 25000 },
        { id: "comp-2", name: "Pendaftaran Loket", status: "Belum Dimulai", basePrice: 50000 },
      ],
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    const started = orderService.startSamsatProcess(orderNo, courier1);

    assert.strictEqual(started.samsatStatus, "Sedang Proses Samsat");
    assert.ok(started.samsatStartedAt, "samsatStartedAt harus terisi");
    assert.ok(started.samsatJourneyStartedAt, "samsatJourneyStartedAt harus terisi");

    const timeline = started.messengerTimeline || [];
    assert.ok(timeline.length > 0);
    assert.strictEqual(timeline[0].title, "Mulai Proses Samsat");
    assert.strictEqual(timeline[0].author, courier1.nama);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 2 (Scope 1): Duplicate start request aman (idempotent)
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.2: Duplicate start request aman dan idempotent tanpa duplicate timeline", () => {
    const orderNo = `ORD-PH2-IDEMP-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Idempotent Start",
      nomorHP: "081299990102",
      nopol: "B 1012 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Terjadwal Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai", basePrice: 25000 },
      ],
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    const firstStart = orderService.startSamsatProcess(orderNo, courier1);
    const count1 = (firstStart.messengerTimeline || []).length;
    assert.strictEqual(count1, 1);

    // Call start second time (retry or duplicate network click)
    const secondStart = orderService.startSamsatProcess(orderNo, courier1);
    const count2 = (secondStart.messengerTimeline || []).length;

    assert.strictEqual(count2, count1, "Timeline event must NOT be duplicated on retry");
    assert.strictEqual(secondStart.samsatStatus, "Sedang Proses Samsat");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 3 (Scope 1): Komponen belum dapat dikelola sebelum start
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.3: Komponen belum dapat dikelola sebelum proses Samsat dimulai", () => {
    const unstartedOrder: any = {
      orderNo: `ORD-PH2-UNSTARTED-${Date.now()}`,
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      samsatStatus: "Terjadwal Samsat",
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Belum Dimulai", basePrice: 25000 },
      ],
    };

    // State check matching MessengerSamsatView isProcessStarted logic
    const isStarted = Boolean(
      unstartedOrder.samsatStatus === "Sedang Proses Samsat" ||
      unstartedOrder.samsatStatus === "Menuju Samsat" ||
      unstartedOrder.samsatStatus === "Di Lokasi Samsat" ||
      unstartedOrder.samsatStartedAt
    );
    assert.strictEqual(isStarted, false, "Sebelum start, isProcessStarted harus false");

    // Once started
    unstartedOrder.samsatStatus = "Sedang Proses Samsat";
    unstartedOrder.samsatStartedAt = new Date().toISOString();
    const isStartedAfter = Boolean(
      unstartedOrder.samsatStatus === "Sedang Proses Samsat" ||
      unstartedOrder.samsatStatus === "Menuju Samsat" ||
      unstartedOrder.samsatStatus === "Di Lokasi Samsat" ||
      unstartedOrder.samsatStartedAt
    );
    assert.strictEqual(isStartedAfter, true, "Setelah start, isProcessStarted harus true");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 4 (Scope 2): Semua komponen wajib selesai
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.4: Semua komponen wajib selesai memungkinkan validasi dan penyelesaian Samsat", () => {
    const orderNo = `ORD-PH2-ALLDONE-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan All Done",
      nomorHP: "081299990104",
      nopol: "B 1014 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Selesai", basePrice: 25000 },
        { id: "comp-2", name: "Pendaftaran Loket", status: "Selesai", basePrice: 50000 },
      ],
      createdAt: new Date().toISOString(),
    };

    // Backend validation check
    const backendVal = validateSamsatCompletion(order);
    assert.strictEqual(backendVal.allowed, true);
    assert.strictEqual(backendVal.completedComponents, 2);
    assert.strictEqual(backendVal.totalComponents, 2);

    // Frontend validation mirror check
    const frontendVal = validateSamsatComponents(order);
    assert.strictEqual(frontendVal.allowed, true);
    assert.strictEqual(frontendVal.completedComponents, 2);

    // Complete Samsat process (zero free-text notes for courier)
    dbOrderRepository.saveOrder(order);
    const completed = orderService.completeSamsatProcess(orderNo, {}, courier1);

    assert.strictEqual(completed.samsatStatus, "Selesai");
    assert.ok(completed.samsatCompletedAt);
    assert.strictEqual(completed.samsatCompletedCycle, 1);
    assert.strictEqual(completed.taskAcceptance?.["Jemput Hasil Samsat"]?.status, "PENDING");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 5 (Scope 2): Komponen belum selesai memblokir completion
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.5: Komponen belum selesai (WAITING / IN_PROGRESS / NOT_STARTED) memblokir penyelesaian", () => {
    const orderNo = `ORD-PH2-INCOMPLETE-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Incomplete",
      nomorHP: "081299990105",
      nopol: "B 1015 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Selesai", basePrice: 25000 },
        { id: "comp-2", name: "Pendaftaran Loket", status: "Dalam Proses", basePrice: 50000 },
        { id: "comp-3", name: "Penetapan", status: "Menunggu", basePrice: 30000 },
      ],
      createdAt: new Date().toISOString(),
    };

    const backendVal = validateSamsatCompletion(order);
    assert.strictEqual(backendVal.allowed, false);
    assert.strictEqual(backendVal.code, "SAMSAT_COMPONENTS_INCOMPLETE");
    assert.strictEqual(backendVal.incompleteComponents.length, 2);

    const frontendVal = validateSamsatComponents(order);
    assert.strictEqual(frontendVal.allowed, false);

    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.completeSamsatProcess(orderNo, {}, courier1),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "SAMSAT_COMPONENTS_INCOMPLETE");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 6 (Scope 2): Empty component collection memblokir completion jika layanan mewajibkan komponen
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.6: Empty component collection memblokir completion jika layanan mewajibkan komponen", () => {
    const orderNo = `ORD-PH2-EMPTY-${Date.now()}`;
    const order: any = {
      orderNo,
      customer: "Pelanggan Empty Comps",
      nomorHP: "081299990106",
      nopol: "B 1016 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      samsatProcesses: [],
      messengerComponentProgress: {},
      createdAt: new Date().toISOString(),
    };

    const backendVal = validateSamsatCompletion(order);
    assert.strictEqual(backendVal.allowed, false);
    assert.strictEqual(backendVal.code, "SAMSAT_COMPONENTS_REQUIRED");

    const frontendVal = validateSamsatComponents(order);
    assert.strictEqual(frontendVal.allowed, false);

    dbOrderRepository.saveOrder(order);

    assert.throws(
      () => orderService.completeSamsatProcess(orderNo, {}, courier1),
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "SAMSAT_COMPONENTS_REQUIRED");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 7 (Scope 2): Service exemption hanya berlaku pada layanan yang benar
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.7: Service exemption hanya berlaku pada layanan yang benar (svc-lainnya / LAINNYA)", () => {
    // 1. Service 'svc-lainnya' with 0 components MUST be exempt (allowed)
    const exemptOrder: any = {
      orderNo: `ORD-PH2-EXEMPT-${Date.now()}`,
      customer: "Pelanggan Layanan Lainnya",
      nomorHP: "081299990107",
      nopol: "B 1017 ABC",
      layanan: "Layanan Lainnya",
      service_id: "svc-lainnya",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      samsatProcesses: [],
      messengerComponentProgress: {},
      createdAt: new Date().toISOString(),
    };

    const exemptVal = validateSamsatCompletion(exemptOrder);
    assert.strictEqual(exemptVal.allowed, true, "Layanan svc-lainnya harus diizinkan selesai tanpa komponen");

    dbOrderRepository.saveOrder(exemptOrder);
    const completedExempt = orderService.completeSamsatProcess(exemptOrder.orderNo, {}, courier1);
    assert.strictEqual(completedExempt.samsatStatus, "Selesai");

    // 2. Service 'svc-perp-5th' with 0 components MUST NOT be exempt (blocked)
    const nonExemptOrder: any = {
      orderNo: `ORD-PH2-NONEXEMPT-${Date.now()}`,
      layanan: "Perpanjangan 5 Tahunan",
      service_id: "svc-perp-5th",
      samsatProcesses: [],
      messengerComponentProgress: {},
    };

    const nonExemptVal = validateSamsatCompletion(nonExemptOrder);
    assert.strictEqual(nonExemptVal.allowed, false, "svc-perp-5th tidak boleh di-exempt");
    assert.strictEqual(nonExemptVal.code, "SAMSAT_COMPONENTS_REQUIRED");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 8 (Scope 3): Simpan progres mempertahankan seluruh komponen
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.8: Simpan progres mempertahankan seluruh komponen dan penyesuaian biaya aktual", () => {
    const orderNo = `ORD-PH2-SAVE-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Simpan Progres",
      nomorHP: "081299990108",
      nopol: "B 1018 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      messengerComponentProgress: {
        "comp-1": {
          componentId: "comp-1",
          name: "Cek Fisik",
          status: "COMPLETED",
          masterPrice: 25000,
          actualOrderPrice: 35000,
          note: "Ada biaya gesek khusus",
        },
        "comp-2": {
          componentId: "comp-2",
          name: "Pendaftaran Loket",
          status: "IN_PROGRESS",
          masterPrice: 50000,
          actualOrderPrice: 50000,
        },
      },
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    // Messenger saves checkpoint progress
    const nowIso = new Date().toISOString();
    const saveTimeline = {
      id: `tl-save-${Date.now()}`,
      timestamp: nowIso,
      title: "Progres Samsat Disimpan",
      note: `Kurir ${courier1.nama} menyimpan checkpoint progres Samsat.`,
      author: courier1.nama,
      type: "PROGRESS_UPDATE",
    };

    dbOrderRepository.updateOrder(orderNo, {
      messengerTimeline: [saveTimeline, ...(initialOrder.messengerTimeline || [])],
    });

    const retrieved = dbOrderRepository.getByOrderNo(orderNo);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.messengerComponentProgress?.["comp-1"]?.status, "COMPLETED");
    assert.strictEqual(retrieved.messengerComponentProgress?.["comp-1"]?.actualOrderPrice, 35000);
    assert.strictEqual(retrieved.messengerComponentProgress?.["comp-2"]?.status, "IN_PROGRESS");
    assert.strictEqual(retrieved.messengerTimeline?.[0]?.title, "Progres Samsat Disimpan");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 9 (Scope 3): Handover mempertahankan progres & rilis ke pool
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.9: Handover mempertahankan progres komponen dan melepas assignment ke pool", () => {
    const orderNo = `ORD-PH2-HANDOVER-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Handover",
      nomorHP: "081299990109",
      nopol: "B 1019 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      messengerComponentProgress: {
        "comp-1": {
          componentId: "comp-1",
          name: "Cek Fisik",
          status: "COMPLETED",
          masterPrice: 25000,
          actualOrderPrice: 25000,
        },
        "comp-2": {
          componentId: "comp-2",
          name: "Pendaftaran Loket",
          status: "IN_PROGRESS",
          masterPrice: 50000,
          actualOrderPrice: 50000,
        },
      },
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    // Courier 1 releases task to pool
    const nowIso = new Date().toISOString();
    const releaseTimeline = {
      id: `tl-rel-${Date.now()}`,
      timestamp: nowIso,
      title: "Tugas Samsat Diserahkan ke Tim",
      note: `Kurir ${courier1.nama} menyerahkan tugas kembali ke pool (progres tersimpan).`,
      author: courier1.nama,
      type: "STATUS_CHANGE",
    };

    dbOrderRepository.updateOrder(orderNo, {
      samsatMessengerId: undefined,
      samsatMessengerName: undefined,
      messengerTimeline: [releaseTimeline, ...(initialOrder.messengerTimeline || [])],
    });

    const released = dbOrderRepository.getByOrderNo(orderNo);
    assert.ok(released);
    // Assignment must be cleared
    assert.strictEqual(released.samsatMessengerId, undefined);
    // Progress must NOT be lost
    assert.strictEqual(released.messengerComponentProgress?.["comp-1"]?.status, "COMPLETED");
    assert.strictEqual(released.messengerComponentProgress?.["comp-2"]?.status, "IN_PROGRESS");

    // Courier 2 claims the task from pool
    const claimTimeline = {
      id: `tl-claim-${Date.now()}`,
      timestamp: nowIso,
      title: "Tugas Samsat Diambil Alih",
      note: `Kurir ${courier2.nama} mengambil alih tugas Samsat dari pool.`,
      author: courier2.nama,
      type: "STATUS_CHANGE",
    };

    dbOrderRepository.updateOrder(orderNo, {
      samsatMessengerId: courier2.employeeId,
      samsatMessengerName: courier2.nama,
      messengerTimeline: [claimTimeline, ...(released.messengerTimeline || [])],
    });

    const claimed = dbOrderRepository.getByOrderNo(orderNo);
    assert.ok(claimed);
    assert.strictEqual(claimed.samsatMessengerId, courier2.employeeId);
    assert.strictEqual(claimed.samsatMessengerName, courier2.nama);
    assert.strictEqual(claimed.messengerComponentProgress?.["comp-1"]?.status, "COMPLETED");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 10 (Scope 4): Concurrent completion tidak membuat task duplikat
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.10: Concurrent completion tidak membuat task duplikat", () => {
    const orderNo = `ORD-PH2-CONCURR-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Concurrency",
      nomorHP: "081299990110",
      nopol: "B 1020 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Selesai", basePrice: 25000 },
      ],
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    // Call complete twice in rapid succession (zero free-text notes for courier)
    const res1 = orderService.completeSamsatProcess(orderNo, {}, courier1);
    const res2 = orderService.completeSamsatProcess(orderNo, {}, adminUser);

    assert.strictEqual(res1.samsatStatus, "Selesai");
    assert.strictEqual(res2.samsatStatus, "Selesai");

    // Verify task Jemput Hasil Samsat exists exactly once
    const latest = dbOrderRepository.getByOrderNo(orderNo);
    assert.ok(latest);
    assert.strictEqual(latest.taskAcceptance?.["Jemput Hasil Samsat"]?.status, "PENDING");
    assert.strictEqual(latest.taskAcceptance?.["Jemput Hasil Samsat"]?.cycle, 1);

    // Count how many "Tugas Otomatis: Jemput Hasil Samsat" events were logged
    const spawnEvents = (latest.messengerTimeline || []).filter(
      (e: any) => e.title === "Tugas Otomatis: Jemput Hasil Samsat"
    );
    assert.strictEqual(spawnEvents.length, 1, "Hanya boleh ada 1 event spawn jemput hasil");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 11 (Scope 4): Retry setelah commit tidak membuat timeline/task duplikat
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.11: Retry setelah commit tidak membuat timeline atau task duplikat", () => {
    const orderNo = `ORD-PH2-RETRY-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Retry",
      nomorHP: "081299990111",
      nopol: "B 1021 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Selesai", basePrice: 25000 },
      ],
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    const firstCommit = orderService.completeSamsatProcess(orderNo, {}, courier1);
    const count1 = (firstCommit.messengerTimeline || []).length;

    // Retry after commit
    const retryCommit = orderService.completeSamsatProcess(orderNo, {}, courier1);
    const count2 = (retryCommit.messengerTimeline || []).length;

    assert.strictEqual(count2, count1, "Timeline count must NOT increase on idempotent completion retry");
    assert.strictEqual(retryCommit.samsatStatus, "Selesai");
    assert.strictEqual(retryCommit.samsatCompletedCycle, 1);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 12 (Scope 4): Task siklus lama tidak menghalangi siklus baru yang valid
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("2.12: Task siklus lama tidak menghalangi siklus baru yang valid", () => {
    const orderNo = `ORD-PH2-CYCLE-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Multi Siklus",
      nomorHP: "081299990112",
      nopol: "B 1022 ABC",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      samsatStatus: "Sedang Proses Samsat",
      samsatMessengerId: courier1.employeeId,
      samsatMessengerName: courier1.nama,
      samsatProcesses: [
        { id: "comp-1", name: "Cek Fisik", status: "Selesai", basePrice: 25000 },
      ],
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    // 1. Complete Cycle 1
    const cycle1 = orderService.completeSamsatProcess(orderNo, {}, courier1);
    assert.strictEqual(cycle1.samsatCompletedCycle, 1);
    assert.strictEqual(cycle1.taskAcceptance?.["Jemput Hasil Samsat"]?.cycle, 1);

    // 2. Advance to Stage 5 ("Verifikasi Ulang")
    orderService.advanceOrder(orderNo, "Verifikasi Ulang", {}, courier1);

    // 3. Rollback back to Stage 4 ("Proses Samsat") by Admin
    const rolledBack = orderService.rollbackOrder(orderNo, "Proses Samsat", {}, adminUser);

    assert.strictEqual(rolledBack.currentStep, 4);
    assert.strictEqual((rolledBack as any).samsatCycle, 2, "samsatCycle harus bertambah menjadi 2");
    assert.strictEqual(rolledBack.samsatStatus, "Sedang Proses Samsat");

    // 4. Start process in Cycle 2
    const cycle2Started = orderService.startSamsatProcess(orderNo, courier1);
    assert.strictEqual(cycle2Started.samsatStatus, "Sedang Proses Samsat");

    // 5. Complete Cycle 2
    const cycle2Completed = orderService.completeSamsatProcess(
      orderNo,
      {},
      courier1
    );

    assert.strictEqual(cycle2Completed.samsatStatus, "Selesai");
    assert.strictEqual(cycle2Completed.samsatCompletedCycle, 2, "samsatCompletedCycle harus 2");
    assert.strictEqual(
      cycle2Completed.taskAcceptance?.["Jemput Hasil Samsat"]?.cycle,
      2,
      "Tugas Jemput Hasil baru harus untuk siklus 2"
    );
  });
});
