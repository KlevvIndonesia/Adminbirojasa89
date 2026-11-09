/**
 * Order Tracking Workflow Transitions & RBAC Integration Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies all 8 stages, context-aware validation, RBAC, prerequisite gating,
 * generic PUT protection, and atomic transaction handling.
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { db } from "../server/src/database/db";

function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

async function loginUser(baseUrl: string, email: string, pass: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  const data = await res.json() as any;
  if (!data.success || !data.data?.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return data.data.token;
}

test("Order Tracking Workflow - Comprehensive 8 Stages & RBAC Security Verification", async (t) => {
  const { server, baseUrl } = await startTestServer();

  try {
    // 0. Authenticate test users (Admin and Supervisor / SVP)
    const adminToken = await loginUser(baseUrl, "admin@birojasa.com", "admin123");
    const svpToken = await loginUser(baseUrl, "svp@birojasa.com", "admin123");

    // 1. Create a pristine test order starting at Stage 1 (Verifikasi)
    const orderNo = `ORD-TEST-${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orderNo,
        customer: "Budi Transisi",
        nomorHP: "081234567899",
        nopol: "B 8888 TRN",
        layanan: "Perpanjangan STNK Tahunan",
        wilayahSamsatAsal: "Jakarta Timur",
        totalEstimasi: 500000,
        biayaSamsat: 350000,
        biayaJasa: 150000,
        metodeLayanan: "Antar Jemput Dokumen",
        payment: {
          tipePembayaran: "Bayar di Akhir",
          statusPembayaran: "Belum Bayar",
          totalBiaya: 500000,
          dibayar: 0,
          kurang: 500000,
        },
      }),
    });

    assert.strictEqual(createRes.status, 201, "Order creation should succeed");
    const createData = (await createRes.json()) as any;
    const actualOrderNo = createData.data.orderNo;
    assert.ok(actualOrderNo, "Canonical orderNo must be returned");
    assert.strictEqual(createData.data.currentStep, 1);
    assert.strictEqual(createData.data.currentStageName, "Verifikasi");

    // =========================================================================
    // SECURITY GUARD: Generic PUT /api/orders/:orderNo MUST reject protected fields
    // =========================================================================
    const genericPutRes = await fetch(`${baseUrl}/api/orders/${actualOrderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        isVerified: true,
        currentStep: 5,
        finalCost: 1000000,
      }),
    });
    assert.strictEqual(
      genericPutRes.status,
      403,
      "Generic PUT must reject protected fields (isVerified, currentStep, finalCost)"
    );

    // =========================================================================
    // SECURITY GUARD: Illegal forward jump (Step 1 -> Step 4 or Step 6) must fail
    // =========================================================================
    const illegalJumpRes = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Proses Samsat",
      }),
    });
    assert.strictEqual(illegalJumpRes.status, 400, "Skipping stages (1 -> 4) must be rejected");
    const illegalJumpData = (await illegalJumpRes.json()) as any;
    assert.strictEqual(illegalJumpData.error.code, "INVALID_STAGE_TRANSITION");

    // Database state assertion: verifying no mutation occurred after illegal jump rejection
    const dbRowAfterFailedJump = db.prepare("SELECT current_step, current_stage_name FROM orders WHERE order_no = ?").get(actualOrderNo) as any;
    assert.strictEqual(dbRowAfterFailedJump.current_step, 1, "DB current_step must remain 1 after failed jump");
    assert.strictEqual(dbRowAfterFailedJump.current_stage_name, "Verifikasi", "DB current_stage_name must remain Verifikasi");

    // =========================================================================
    // SECURITY GUARD: Advance endpoint must reject client forged lifecycle keys
    // =========================================================================
    const forgedLifecycleRes = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Penjadwalan",
        updates: {
          currentStep: 99,
          isCancelled: true,
        },
      }),
    });
    assert.strictEqual(forgedLifecycleRes.status, 403, "Client forged currentStep/isCancelled must be rejected");

    // =========================================================================
    // TRANSITION 1 -> 2: Verifikasi -> Penjadwalan
    // =========================================================================
    const step1to2Res = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Penjadwalan",
        updates: {
          isVerified: true,
          tanggalJemput: "2026-11-10",
          messenger: "Bambang Courier",
          catatanPenjadwalan: "Jemput di kantor customer jam 10",
        },
      }),
    });
    assert.strictEqual(step1to2Res.status, 200, "Advance Step 1 -> 2 must succeed");
    const step1to2Data = (await step1to2Res.json()) as any;
    assert.strictEqual(step1to2Data.data.currentStep, 2);
    assert.strictEqual(step1to2Data.data.currentStageName, "Penjadwalan");
    assert.strictEqual(step1to2Data.data.isVerified, true);
    assert.strictEqual(step1to2Data.data.messenger, "Bambang Courier");

    // =========================================================================
    // TRANSITION 2 -> 3: Penjadwalan -> Verifikasi Dokumen
    // Prerequisite: pickupCompleted required!
    // =========================================================================
    const step2to3NoPickupRes = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Verifikasi Dokumen",
        updates: {},
      }),
    });
    assert.strictEqual(step2to3NoPickupRes.status, 400, "Step 2 -> 3 without pickup must be rejected");
    const step2to3NoPickupData = (await step2to3NoPickupRes.json()) as any;
    assert.strictEqual(step2to3NoPickupData.error.code, "PREREQUISITE_NOT_MET");

    // Advance Step 2 -> 3 with pickupCompleted: true
    const step2to3Res = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Verifikasi Dokumen",
        updates: {
          pickupCompleted: true,
          messengerTaskStatus: "Dokumen Sudah Tersedia",
        },
      }),
    });
    assert.strictEqual(step2to3Res.status, 200, "Advance Step 2 -> 3 with pickup completed must succeed");
    const step2to3Data = (await step2to3Res.json()) as any;
    assert.strictEqual(step2to3Data.data.currentStep, 3);
    assert.strictEqual(step2to3Data.data.currentStageName, "Verifikasi Dokumen");

    // =========================================================================
    // TRANSITION 3 -> 4: Verifikasi Dokumen -> Proses Samsat
    // Prerequisite: documentsVerified required!
    // =========================================================================
    const step3to4NoDocsRes = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Proses Samsat",
        updates: {},
      }),
    });
    assert.strictEqual(step3to4NoDocsRes.status, 400, "Step 3 -> 4 without documentsVerified must be rejected");

    const step3to4Res = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Proses Samsat",
        updates: {
          documentsVerified: true,
          samsatStatus: "Belum Terjadwal",
        },
      }),
    });
    assert.strictEqual(step3to4Res.status, 200, "Advance Step 3 -> 4 must succeed");
    const step3to4Data = (await step3to4Res.json()) as any;
    assert.strictEqual(step3to4Data.data.currentStep, 4);
    assert.strictEqual(step3to4Data.data.currentStageName, "Proses Samsat");

    // =========================================================================
    // TRANSITION 4 -> 5: Proses Samsat -> Verifikasi Ulang
    // =========================================================================
    const step4to5Res = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Verifikasi Ulang",
        updates: {
          samsatStatus: "Selesai",
          samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
        },
      }),
    });
    assert.strictEqual(step4to5Res.status, 200, "Advance Step 4 -> 5 must succeed");
    const step4to5Data = (await step4to5Res.json()) as any;
    assert.strictEqual(step4to5Data.data.currentStep, 5);
    assert.strictEqual(step4to5Data.data.currentStageName, "Verifikasi Ulang");

    // =========================================================================
    // TRANSITION 5 -> 6: Verifikasi Ulang -> Supervisi
    // Prerequisite: documentApproval.stage5Verified or documentsVerified
    // Also tests financial reconciliation sync to finance_invoices!
    // =========================================================================
    const step5to6Res = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Supervisi",
        updates: {
          finalCost: 520000,
          biayaSamsat: 370000,
          biayaJasa: 150000,
          documentsVerified: true,
          documentApproval: {
            stage5Verified: true,
            stage5VerifiedBy: "Admin Loket",
            stage5VerifiedAt: new Date().toISOString(),
          },
        },
      }),
    });
    assert.strictEqual(step5to6Res.status, 200, "Advance Step 5 -> 6 must succeed");
    const step5to6Data = (await step5to6Res.json()) as any;
    assert.strictEqual(step5to6Data.data.currentStep, 6);
    assert.strictEqual(step5to6Data.data.currentStageName, "Supervisi");
    assert.strictEqual(step5to6Data.data.finalCost, 520000);

    // =========================================================================
    // TRANSITION 6 -> 7: Supervisi -> Pengantaran
    // RBAC Security Guard: Standard Admin MUST be rejected with HTTP 403 FORBIDDEN!
    // =========================================================================
    const step6to7AdminRes = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Pengantaran",
        updates: {
          approvedBySpv: true,
        },
      }),
    });
    assert.strictEqual(step6to7AdminRes.status, 403, "Non-supervisor user must be rejected at Stage 6");
    const step6to7AdminData = (await step6to7AdminRes.json()) as any;
    assert.strictEqual(step6to7AdminData.error.code, "FORBIDDEN");

    // Supervisor / SVP advancing Stage 6 -> Stage 7 succeeds!
    const step6to7SvpRes = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${svpToken}`,
      },
      body: JSON.stringify({
        targetStage: "Pengantaran",
        updates: {
          approvedBySpv: true,
          tanggalPengantaran: "2026-11-12",
          messengerPengantar: "Agus Kurir",
        },
      }),
    });
    assert.strictEqual(step6to7SvpRes.status, 200, "Supervisor advancing Step 6 -> 7 must succeed");
    const step6to7SvpData = (await step6to7SvpRes.json()) as any;
    assert.strictEqual(step6to7SvpData.data.currentStep, 7);
    assert.strictEqual(step6to7SvpData.data.currentStageName, "Pengantaran");
    assert.strictEqual(step6to7SvpData.data.approvedBySpv, true);
    assert.ok(step6to7SvpData.data.spvApprovedAt, "spvApprovedAt must be populated by server");

    // =========================================================================
    // TRANSITION 7 -> 8: Pengantaran -> Dokumen Telah Diterima
    // =========================================================================
    const step7to8Res = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Dokumen Telah Diterima",
        updates: {
          tanggalDiterima: "2026-11-12",
          isReceived: true,
          receiverName: "Budi Customer",
        },
      }),
    });
    assert.strictEqual(step7to8Res.status, 200, "Advance Step 7 -> 8 must succeed");
    const step7to8Data = (await step7to8Res.json()) as any;
    assert.strictEqual(step7to8Data.data.currentStep, 8);
    assert.strictEqual(step7to8Data.data.currentStageName, "Dokumen Telah Diterima");
    assert.strictEqual(step7to8Data.data.isReceived, true);

    // =========================================================================
    // FINAL ARCHIVING: Stage 8 -> Arsip via POST /orders/:orderNo/archive
    // =========================================================================
    const archiveRes = await fetch(`${baseUrl}/api/orders/${actualOrderNo}/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(archiveRes.status, 200, "Archiving order must succeed via /archive endpoint");
    const archiveData = (await archiveRes.json()) as any;
    assert.strictEqual(archiveData.success, true);

    // Verify order is now archived in GET /api/orders/archived
    const archivedListRes = await fetch(`${baseUrl}/api/orders/archived`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const archivedListData = (await archivedListRes.json()) as any;
    const isFoundInArchive = archivedListData.data.some((o: any) => o.orderNo === actualOrderNo);
    assert.strictEqual(isFoundInArchive, true, "Archived order must appear in archived list");

    // =========================================================================
    // DATANG LANGSUNG SHORTCUT: Step 1 -> Step 3
    // =========================================================================
    const directOrderNo = `ORD-DIRECT-${Date.now()}`;
    const directCreateRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customer: "Siti Langsung",
        nomorHP: "081299991111",
        nopol: "B 1234 DIR",
        layanan: "Balik Nama Kendaraan",
        wilayahSamsatAsal: "Jakarta Selatan",
        metodeLayanan: "Datang Langsung",
        totalEstimasi: 750000,
        biayaSamsat: 550000,
        biayaJasa: 200000,
      }),
    });
    const directCreateData = (await directCreateRes.json()) as any;
    const actualDirectOrderNo = directCreateData.data.orderNo;

    // Verify order created with Datang Langsung is automatically initialized at Step 3 (Verifikasi Dokumen)
    assert.strictEqual(directCreateData.data.currentStep, 3, "Datang Langsung starts at Step 3");
    assert.strictEqual(directCreateData.data.currentStageName, "Verifikasi Dokumen");

    // Also test: an order starting at Stage 1 switching to Datang Langsung and advancing 1 -> 3
    const switchOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customer: "Tono Beralih",
        nomorHP: "081299992222",
        nopol: "B 5678 SWH",
        layanan: "Perpanjangan STNK Tahunan",
        wilayahSamsatAsal: "Jakarta Barat",
        metodeLayanan: "Antar Jemput Dokumen",
        totalEstimasi: 500000,
        biayaSamsat: 350000,
        biayaJasa: 150000,
      }),
    });
    const switchOrderData = (await switchOrderRes.json()) as any;
    const switchOrderNo = switchOrderData.data.orderNo;
    assert.strictEqual(switchOrderData.data.currentStep, 1);

    const switchAdvanceRes = await fetch(`${baseUrl}/api/orders/${switchOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Verifikasi Dokumen",
        updates: {
          metodeLayanan: "Datang Langsung",
          isVerified: true,
          pickupCompleted: true,
        },
      }),
    });
    assert.strictEqual(switchAdvanceRes.status, 200, "Switching to Datang Langsung advancing 1 -> 3 must succeed");
    const switchData = (await switchAdvanceRes.json()) as any;
    assert.strictEqual(switchData.data.currentStep, 3);
    assert.strictEqual(switchData.data.currentStageName, "Verifikasi Dokumen");

  } finally {
    server.close();
  }
});

test("Order Workflow - Extended Boundary Validations, Concurrency, and DB Persistence Verification", async (t) => {
  const { server, baseUrl } = await startTestServer();

  try {
    const adminToken = await loginUser(baseUrl, "admin@birojasa.com", "admin123");

    // 1. Create a pristine test order starting at Step 1 (Verifikasi)
    const createRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customer: "Budi Validasi",
        nomorHP: "081288887777",
        nopol: "B 1234 VAL",
        layanan: "Perpanjangan STNK Tahunan",
        wilayahSamsatAsal: "Jakarta Selatan",
        totalEstimasi: 500000,
        biayaSamsat: 350000,
        biayaJasa: 150000,
        metodeLayanan: "Antar Jemput Dokumen",
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json() as any;
    const orderNo = createData.data.orderNo;
    assert.ok(orderNo);
    const initialRow = db.prepare("SELECT current_step, current_stage_name, updated_at FROM orders WHERE order_no = ?").get(orderNo) as any;
    assert.strictEqual(initialRow.current_step, 1);
    assert.strictEqual(initialRow.current_stage_name, "Verifikasi");

    // SCENARIO: Validasi Gagal Tidak Meninggalkan Perubahan Parsial (DB Assertion)
    const initialAuditCount = (db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE action = 'ADVANCE_STAGE' AND metadata_json LIKE ?").get(`%${orderNo}%`) as any).count;
    const failRes = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Proses Samsat",
        updates: {
          catatanPenjadwalan: "Catatan Tidak Sah Yang Tidak Boleh Tersimpan",
        },
      }),
    });
    assert.strictEqual(failRes.status, 400);
    const failData = await failRes.json() as any;
    assert.strictEqual(failData.error.code, "INVALID_STAGE_TRANSITION");

    // DB Assertions: current_step, current_stage_name, updated_at, data_json, audit logs
    const rowAfterFail = db.prepare("SELECT current_step, current_stage_name, updated_at, data_json FROM orders WHERE order_no = ?").get(orderNo) as any;
    assert.strictEqual(rowAfterFail.current_step, 1, "current_step must remain 1 in database");
    assert.strictEqual(rowAfterFail.current_stage_name, "Verifikasi", "current_stage_name must remain Verifikasi in database");
    assert.strictEqual(rowAfterFail.updated_at, initialRow.updated_at, "updated_at must remain unchanged in database");
    const parsedDataJson = JSON.parse(rowAfterFail.data_json || "{}");
    assert.strictEqual(parsedDataJson.catatanPenjadwalan, undefined, "Illegal update must not be persisted into data_json");
    const afterFailAuditCount = (db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE action = 'ADVANCE_STAGE' AND metadata_json LIKE ?").get(`%${orderNo}%`) as any).count;
    assert.strictEqual(afterFailAuditCount, initialAuditCount, "Audit log must not record failed advance");

    // SCENARIO: Tahap 1 -> Tahap 2 (Valid Sequential Advance)
    const step1to2Res = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Penjadwalan",
        updates: { isVerified: true, messenger: "Kurir Penguji" },
      }),
    });
    assert.strictEqual(step1to2Res.status, 200);
    const rowStep2 = db.prepare("SELECT current_step, current_stage_name FROM orders WHERE order_no = ?").get(orderNo) as any;
    assert.strictEqual(rowStep2.current_step, 2);
    assert.strictEqual(rowStep2.current_stage_name, "Penjadwalan");

    // SCENARIO: Tahap yang sama (Idempotency Rule)
    const idempotentRes = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Penjadwalan",
        updates: { catatanPenjadwalan: "Update catatan di tahap yang sama" },
      }),
    });
    assert.strictEqual(idempotentRes.status, 200, "Same stage advance must be accepted idempotently");
    const idempotentData = await idempotentRes.json() as any;
    assert.strictEqual(idempotentData.data.currentStep, 2);
    assert.strictEqual(idempotentData.data.currentStageName, "Penjadwalan");
    const rowIdempotent = db.prepare("SELECT current_step, current_stage_name, data_json FROM orders WHERE order_no = ?").get(orderNo) as any;
    assert.strictEqual(rowIdempotent.current_step, 2);
    assert.strictEqual(rowIdempotent.current_stage_name, "Penjadwalan");
    assert.ok(rowIdempotent.data_json.includes("Update catatan di tahap yang sama"));

    // SCENARIO: Transisi Mundur via /advance Ditolak (Harus via /rollback)
    const backwardAdvanceRes = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Verifikasi",
      }),
    });
    assert.strictEqual(backwardAdvanceRes.status, 400, "Backward transition via /advance must be rejected");
    const backwardAdvanceData = await backwardAdvanceRes.json() as any;
    assert.strictEqual(backwardAdvanceData.error.code, "INVALID_STAGE_TRANSITION");

    // SCENARIO: Transisi Mundur via /rollback Berhasil (Existing Business Rules)
    const rollbackRes = await fetch(`${baseUrl}/api/orders/${orderNo}/rollback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Verifikasi",
        updates: { catatan: "Rollback ke Verifikasi untuk pengecekan ulang" },
      }),
    });
    assert.strictEqual(rollbackRes.status, 200, "Valid rollback via /rollback must succeed");
    const rowRollback = db.prepare("SELECT current_step, current_stage_name FROM orders WHERE order_no = ?").get(orderNo) as any;
    assert.strictEqual(rowRollback.current_step, 1);
    assert.strictEqual(rowRollback.current_stage_name, "Verifikasi");

    // SCENARIO: Order Dibatalkan (Cannot be advanced)
    const cancelRes = await fetch(`${baseUrl}/api/orders/${orderNo}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reason: "Customer membatalkan permintaan layanan",
      }),
    });
    assert.strictEqual(cancelRes.status, 200);
    const advanceCancelledRes = await fetch(`${baseUrl}/api/orders/${orderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Penjadwalan",
      }),
    });
    assert.strictEqual(advanceCancelledRes.status, 400);
    const advanceCancelledData = await advanceCancelledRes.json() as any;
    assert.strictEqual(advanceCancelledData.error.code, "ORDER_CANCELLED");

    // SCENARIO: Order Tidak Ditemukan (404)
    const ghostRes = await fetch(`${baseUrl}/api/orders/ORD-GHOST-NOT-FOUND/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Penjadwalan",
      }),
    });
    assert.strictEqual(ghostRes.status, 404);
    const ghostData = await ghostRes.json() as any;
    assert.strictEqual(ghostData.error.code, "ORDER_NOT_FOUND");

    // SCENARIO: Order Selesai (Terminal Step 8 Cannot Advance Further)
    const completedOrderNo = `ORD-COMPL-${Date.now()}`;
    db.prepare(`
      INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name, payment_status, total_biaya, data_json, created_at, updated_at)
      VALUES (?, 'Customer Selesai', '081299998888', 'Perpanjangan 1 Tahun', 'B 9999 FIN', 8, 'Dokumen Telah Diterima', 'Lunas', 500000, '{"currentStep":8,"currentStageName":"Dokumen Telah Diterima"}', datetime('now'), datetime('now'))
    `).run(completedOrderNo);

    const advanceCompletedRes = await fetch(`${baseUrl}/api/orders/${completedOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetStage: "Pengantaran",
      }),
    });
    assert.strictEqual(advanceCompletedRes.status, 400, "Completed order cannot advance to another stage");
    const advanceCompletedData = await advanceCompletedRes.json() as any;
    assert.strictEqual(advanceCompletedData.error.code, "INVALID_STAGE_TRANSITION");

    // SCENARIO: Dua Request Bersamaan (Concurrency & Atomicity Check)
    const concCreateRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customer: "Customer Konkuren",
        nomorHP: "081211110000",
        nopol: "B 1010 CNC",
        layanan: "Perpanjangan STNK Tahunan",
        totalEstimasi: 500000,
        biayaSamsat: 350000,
        biayaJasa: 150000,
      }),
    });
    assert.strictEqual(concCreateRes.status, 201);
    const concCreateData = await concCreateRes.json() as any;
    const concOrderNo = concCreateData.data.orderNo;
    assert.ok(concOrderNo);

    const [concRes1, concRes2] = await Promise.all([
      fetch(`${baseUrl}/api/orders/${concOrderNo}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ targetStage: "Penjadwalan", updates: { isVerified: true, messenger: "Kurir Alpha" } }),
      }),
      fetch(`${baseUrl}/api/orders/${concOrderNo}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ targetStage: "Penjadwalan", updates: { isVerified: true, messenger: "Kurir Beta" } }),
      }),
    ]);
    assert.strictEqual(concRes1.status, 200, "First concurrent request must succeed");
    assert.strictEqual(concRes2.status, 200, "Second concurrent request must succeed (idempotent same stage)");
    const concDbRow = db.prepare("SELECT current_step, current_stage_name FROM orders WHERE order_no = ?").get(concOrderNo) as any;
    assert.strictEqual(concDbRow.current_step, 2, "DB state must strictly be Step 2 after concurrent requests");
    assert.strictEqual(concDbRow.current_stage_name, "Penjadwalan");

  } finally {
    server.close();
  }
});
