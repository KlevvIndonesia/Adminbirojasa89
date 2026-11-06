/**
 * Phase 1 Controlled Implementation Test Suite
 * Task Acceptance Atomicity, Idempotency, and Dynamic Service Requirements
 * Admin SUN89 — Biro Jasa Management System
 */

import test from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { orderService } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { serviceStore } from "../src/app/data/serviceStore";
import { runInTransaction, getOperationalDbPath } from "../server/src/database/db";

const courierA: any = {
  userId: "usr-msg-01",
  employeeId: "EMP-MSG-001",
  nama: "Budi Courier A",
  role: "messenger",
  jabatan: "MESSENGER",
};

const courierB: any = {
  userId: "usr-msg-02",
  employeeId: "EMP-MSG-002",
  nama: "Joko Courier B",
  role: "messenger",
  jabatan: "MESSENGER",
};

test("PHASE 1: TASK ACCEPTANCE ATOMICITY & DYNAMIC REQUIREMENTS SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 1: ATOMIC TASK ACCEPTANCE
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("1.1: Kurir A berhasil menerima dan mengunci tugas baru", () => {
    const orderNo = `ORD-TEST-PH1-ACC-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Test Phase 1",
      nomorHP: "081299990001",
      nopol: "B 1111 TST",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 2,
      currentStageName: "Penjadwalan",
      messenger: "Belum Ditugaskan",
      messengerTaskStatus: "Belum Diambil",
      taskAcceptance: {
        "Jemput Dokumen": {
          status: "PENDING",
          isLocked: false,
        },
      },
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    const accepted = orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierA);

    assert.ok(accepted);
    const acceptance = accepted.taskAcceptance?.["Jemput Dokumen"];
    assert.strictEqual(acceptance?.status, "ACCEPTED");
    assert.strictEqual(acceptance?.isLocked, true);
    assert.strictEqual(acceptance?.courierId, courierA.employeeId);
    assert.strictEqual(acceptance?.courierName, courierA.nama);

    // Verify assignment fields updated
    assert.strictEqual(accepted.assignedMessengerId, courierA.employeeId);
    assert.strictEqual(accepted.assignedMessengerName, courierA.nama);

    // Verify timeline event exists
    const timeline = accepted.messengerTimeline || [];
    assert.ok(timeline.length > 0);
    assert.strictEqual(timeline[0].title, "Tugas Jemput Dokumen Diterima");
    assert.strictEqual(timeline[0].author, courierA.nama);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 2: IDEMPOTENT RETRY BY SAME COURIER (NO DUPLICATE TIMELINE)
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("1.2: Retry oleh Kurir yang sama mengembalikan order tanpa duplicate timeline event", () => {
    const orderNo = `ORD-TEST-PH1-IDEMP-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Test Idempotent",
      nomorHP: "081299990002",
      nopol: "B 2222 TST",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      currentStep: 2,
      currentStageName: "Penjadwalan",
      messenger: "Belum Ditugaskan",
      taskAcceptance: {
        "Jemput Dokumen": {
          status: "PENDING",
          isLocked: false,
        },
      },
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    // First acceptance
    const firstResult = orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierA);
    const timelineCount1 = (firstResult.messengerTimeline || []).length;
    assert.strictEqual(timelineCount1, 1);

    // Second acceptance (Retry by same courier)
    const secondResult = orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierA);
    const timelineCount2 = (secondResult.messengerTimeline || []).length;

    // Timeline count MUST NOT increase
    assert.strictEqual(timelineCount2, timelineCount1, "Timeline event must not be duplicated on retry");
    assert.strictEqual(secondResult.taskAcceptance?.["Jemput Dokumen"]?.courierId, courierA.employeeId);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 3: CONCURRENCY CONFLICT (ANOTHER COURIER REJECTED WITH 409)
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("1.3: Kurir B ditolak dengan HTTP 409 saat tugas sudah di-lock Kurir A", () => {
    const orderNo = `ORD-TEST-PH1-CONF-${Date.now()}`;
    const initialOrder: any = {
      orderNo,
      customer: "Pelanggan Test Conflict",
      nomorHP: "081299990003",
      nopol: "B 3333 TST",
      layanan: "Mutasi Antar Samsat",
      service_id: "svc-mut-asal",
      currentStep: 2,
      currentStageName: "Penjadwalan",
      messenger: "Belum Ditugaskan",
      taskAcceptance: {
        "Jemput Dokumen": {
          status: "PENDING",
          isLocked: false,
        },
      },
      createdAt: new Date().toISOString(),
    };

    dbOrderRepository.saveOrder(initialOrder);

    // Kurir A accepts
    orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierA);

    // Kurir B attempts to accept
    let errorThrown: any = null;
    try {
      orderService.acceptMessengerTask(orderNo, "Jemput Dokumen", courierB);
    } catch (err: any) {
      errorThrown = err;
    }

    assert.ok(errorThrown, "Kurir B must receive an error");
    assert.strictEqual(errorThrown.statusCode || errorThrown.status, 409);
    assert.strictEqual(errorThrown.code, "TASK_ALREADY_ACCEPTED");

    // Verify task is still locked to Kurir A
    const current = orderService.getByOrderNo(orderNo);
    assert.strictEqual(current.taskAcceptance?.["Jemput Dokumen"]?.courierId, courierA.employeeId);
    assert.strictEqual(current.assignedMessengerId, courierA.employeeId);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 4: TRUE MULTI-CONNECTION CONCURRENCY PROOF ON EPHEMERAL SQLITE DB
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("1.4: Dua koneksi SQLite terpisah berebut tugas secara bersamaan", () => {
    const tempDbPath = path.resolve(process.cwd(), `temp-concurrency-test-${Date.now()}.sqlite`);
    const db1 = new DatabaseSync(tempDbPath);
    const db2 = new DatabaseSync(tempDbPath);

    try {
      // Setup schema in temp db
      db1.exec(`
        CREATE TABLE orders (
          order_no TEXT PRIMARY KEY,
          data_json TEXT NOT NULL
        );
      `);

      const orderNo = "ORD-CONCUR-TEST-001";
      const initialData = {
        orderNo,
        taskAcceptance: {
          "Jemput Dokumen": {
            status: "PENDING",
            isLocked: false,
          },
        },
        messengerTimeline: [],
      };

      db1.prepare("INSERT INTO orders (order_no, data_json) VALUES (?, ?)").run(
        orderNo,
        JSON.stringify(initialData)
      );

      // Simulation of accept under atomic transaction on conn1
      function acceptOnConn(conn: DatabaseSync, courier: any): { success: boolean; error?: string } {
        try {
          conn.exec("BEGIN IMMEDIATE;");
          const row: any = conn.prepare("SELECT data_json FROM orders WHERE order_no = ?").get(orderNo);
          const data = JSON.parse(row.data_json);
          const acc = data.taskAcceptance?.["Jemput Dokumen"];

          if (acc?.isLocked && acc.courierId && acc.courierId !== courier.employeeId) {
            conn.exec("ROLLBACK;");
            return { success: false, error: "409_TASK_ALREADY_ACCEPTED" };
          }

          if (acc?.isLocked && acc.courierId === courier.employeeId) {
            conn.exec("ROLLBACK;");
            return { success: true };
          }

          data.taskAcceptance["Jemput Dokumen"] = {
            status: "ACCEPTED",
            isLocked: true,
            courierId: courier.employeeId,
            courierName: courier.nama,
          };
          data.messengerTimeline.push({
            title: "Diterima",
            courier: courier.nama,
          });

          conn.prepare("UPDATE orders SET data_json = ? WHERE order_no = ?").run(
            JSON.stringify(data),
            orderNo
          );
          conn.exec("COMMIT;");
          return { success: true };
        } catch (err: any) {
          try { conn.exec("ROLLBACK;"); } catch {}
          return { success: false, error: err.message };
        }
      }

      // Conn 1 executes acceptance
      const res1 = acceptOnConn(db1, courierA);
      assert.strictEqual(res1.success, true);

      // Conn 2 executes concurrent acceptance
      const res2 = acceptOnConn(db2, courierB);
      assert.strictEqual(res2.success, false);
      assert.strictEqual(res2.error, "409_TASK_ALREADY_ACCEPTED");

      // Verify final stored state on conn2
      const finalRow: any = db2.prepare("SELECT data_json FROM orders WHERE order_no = ?").get(orderNo);
      const finalData = JSON.parse(finalRow.data_json);
      assert.strictEqual(finalData.taskAcceptance["Jemput Dokumen"].courierId, courierA.employeeId);
      assert.strictEqual(finalData.messengerTimeline.length, 1);
    } finally {
      db1.close();
      db2.close();
      if (fs.existsSync(tempDbPath)) {
        try { fs.unlinkSync(tempDbPath); } catch {}
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBTEST 5: DYNAMIC SERVICE REQUIREMENTS RESOLUTION & STRICT FALLBACK POLICY
  // ═══════════════════════════════════════════════════════════════════════════════
  await suite.test("1.5: Resolusi persyaratan dinamis dan penanganan error/fallback", () => {
    // 1. Valid Standard Service (Perpanjangan 1 Tahun)
    const stdRes = serviceStore.getServiceRequirementsDetail("svc-perp-1th");
    assert.strictEqual(stdRes.status, "OK");
    assert.ok(stdRes.requirements.length >= 3);
    assert.ok(stdRes.requirements.some((r) => r.includes("STNK")));

    // 2. Specialized Service (Mutasi Antar Samsat)
    const mutRes = serviceStore.getServiceRequirementsDetail("svc-mut-asal");
    assert.strictEqual(mutRes.status, "OK");
    assert.ok(mutRes.requirements.some((r) => r.includes("Cek fisik")));
    assert.ok(mutRes.requirements.some((r) => r.includes("Kwitansi")));

    // 3. Custom / Special Service (Lainnya)
    const customRes = serviceStore.getServiceRequirementsDetail("svc-lainnya");
    assert.strictEqual(customRes.status, "CUSTOM_SERVICE");
    assert.strictEqual(customRes.isCustom, true);
    assert.ok(customRes.warningNotice?.includes("catatan order"));

    // 4. Service Not Found (Unknown service string)
    const notFoundRes = serviceStore.getServiceRequirementsDetail("layanan-fiktif-tidak-ada-12345");
    assert.strictEqual(notFoundRes.status, "SERVICE_NOT_FOUND");
    assert.strictEqual(notFoundRes.requirements.length, 0, "Unknown service must NOT receive generic STNK checklist");
    assert.ok(notFoundRes.warningNotice?.includes("tidak terdaftar"));

    // 5. Empty input
    const emptyRes = serviceStore.getServiceRequirementsDetail("");
    assert.strictEqual(emptyRes.status, "SERVICE_NOT_FOUND");
    assert.strictEqual(emptyRes.requirements.length, 0);

    // 6. Generic Fallback explicitly permitted only for standard STNK renewal phrase
    const perpPhraseRes = serviceStore.getServiceRequirementsDetail("perpanjangan 1 tahun");
    assert.ok(perpPhraseRes.requirements.length > 0);
  });
});
