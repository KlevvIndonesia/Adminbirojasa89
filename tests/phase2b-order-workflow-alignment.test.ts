import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { APP_CONFIG } from "../src/app/config/appConfig";
import { orderStore } from "../src/app/data/orderStore";
import { permissionStore } from "../src/app/data/permissionStore";
import {
  UserContext,
  declineMessengerTaskAction,
  acceptMessengerTaskAction,
  startPickupTaskAction,
  completePickupTaskAction,
  startMessengerTask,
  reassignMessengerTaskAction,
  resolveMessengerEmployeeId,
} from "../src/app/data/messengerTaskAdapter";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MemoryStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = { localStorage: mockStorage, dispatchEvent: () => true };

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

async function loginUser(baseUrl: string, email: string, pass: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  const data = (await res.json()) as any;
  if (!data.success || !data.data?.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return { token: data.data.token, user: data.data.user };
}

test("PHASE 2B: ORDER WORKFLOW ALIGNMENT SUITE", async (t) => {
  const { server, baseUrl } = await startTestServer();
  const originalApiBaseUrl = APP_CONFIG.apiBaseUrl;
  APP_CONFIG.apiBaseUrl = `${baseUrl}/api`;

  // Log in required actors
  const adminAuth = await loginUser(baseUrl, "admin@birojasa.com", "admin123");
  const svpAuth = await loginUser(baseUrl, "svp@birojasa.com", "admin123");
  const courierAuth = await loginUser(baseUrl, "budi.messenger@birojasa.com", "messenger123");

  const courierUserContext: UserContext = {
    userId: String(courierAuth.user.id),
    userName: courierAuth.user.nama || "Budi Santoso",
    employeeId: courierAuth.user.employeeId || "EMP-0004",
    role: "messenger",
  };

  const adminUserContext: UserContext = {
    userId: String(adminAuth.user.id),
    userName: adminAuth.user.nama || "Adrian Adhari",
    employeeId: adminAuth.user.employeeId || "EMP-ADMIN",
    role: "admin",
  };

  t.after(() => {
    APP_CONFIG.apiBaseUrl = originalApiBaseUrl;
    server.close();
  });

  function syncToStore(orderNo: string, orderData: any): void {
    const provider: any = (orderStore as any).repository?.getProvider?.();
    if (provider && typeof provider.applyServerOrderSnapshot === "function") {
      provider.applyServerOrderSnapshot(orderNo, orderData);
    }
  }

  // Helper to create live order via API and sync with client store
  async function createLiveOrder(overrides: Record<string, any> = {}): Promise<string> {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        customer: "PT Mandiri Abadi",
        nomorHP: "081234567899",
        nopol: "B 7777 WFA",
        biaya: 450000,
        tipeLayanan: "Perorangan",
        layanan: "Perpanjangan STNK Tahunan",
        wilayahSamsatAsal: "Jakarta Timur",
        totalEstimasi: 450000,
        biayaSamsat: 300000,
        biayaJasa: 150000,
        metodeLayanan: "Antar Jemput Dokumen",
        payment: {
          tipePembayaran: "Bayar di Akhir",
          statusPembayaran: "Belum Bayar",
          totalBiaya: 450000,
          dibayar: 0,
          kurang: 450000,
        },
        ...overrides,
      }),
    });
    const data = (await res.json()) as any;
    if (!res.ok) {
      throw new Error(`createLiveOrder failed (${res.status}): ${JSON.stringify(data)}`);
    }
    const orderNo = data.data.orderNo;
    syncToStore(orderNo, data.data);
    return orderNo;
  }

  async function advanceOrderOnServer(
    orderNo: string,
    targetStage: string,
    updates: Record<string, any> = {},
    token = adminAuth.token
  ): Promise<Response> {
    const res = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderNo)}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetStage, updates }),
    });
    if (res.ok) {
      const data = (await res.clone().json()) as any;
      if (data?.data) {
        syncToStore(orderNo, data.data);
      }
    }
    return res;
  }

  await t.test("1. BD-WF-01: Courier can decline task without sending free-text notes (Zero Free-Text Notes)", async () => {
    const orderNo = await createLiveOrder();

    // Admin schedules and assigns task to courier
    const advRes = await advanceOrderOnServer(orderNo, "Penjadwalan", {
      messenger: courierUserContext.userName,
      assignedMessengerName: courierUserContext.userName,
      assignedMessengerId: courierUserContext.employeeId,
      tanggalJemput: "2026-11-10",
    });
    assert.equal(advRes.status, 200, "Advance to Penjadwalan must succeed");

    mockStorage.setItem("auth_token", courierAuth.token);
    mockStorage.setItem("auth_user", JSON.stringify(courierAuth.user));

    // Courier declines without any notes/reason (omitted / undefined)
    const declineRes = await declineMessengerTaskAction(
      orderNo,
      "Jemput Dokumen",
      undefined,
      courierUserContext
    );

    assert.equal(declineRes.success, true, "Courier decline without notes must succeed with 200 OK");

    // Fetch order from server to verify SSoT backend state
    const getRes = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderNo)}`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    const body = (await getRes.json()) as any;
    assert.equal(body.success, true);
    const order = body.data;

    // Backend must have reset the assignment
    assert.ok(
      order.assignedMessengerName === null ||
      order.assignedMessengerName === undefined ||
      order.assignedMessengerName === "Belum Ditugaskan",
      "Courier assignment must be reset in backend"
    );
  });

  await t.test("2. BD-WF-01: Courier decline ignores/strips notes so backend does NOT return MESSENGER_NOTES_NOT_ALLOWED", async () => {
    const orderNo = await createLiveOrder();

    // Schedule to Stage 2 with courier assigned
    const advRes = await advanceOrderOnServer(orderNo, "Penjadwalan", {
      messenger: courierUserContext.userName,
      assignedMessengerName: courierUserContext.userName,
      assignedMessengerId: courierUserContext.employeeId,
      tanggalJemput: "2026-11-10",
    });
    assert.equal(advRes.status, 200);

    mockStorage.setItem("auth_token", courierAuth.token);
    mockStorage.setItem("auth_user", JSON.stringify(courierAuth.user));

    // Courier passes notes ("Motor mogok"), adapter must strip it per BD-WF-01
    const declineRes = await declineMessengerTaskAction(
      orderNo,
      "Jemput Dokumen",
      "Motor mogok di jalan",
      courierUserContext
    );

    assert.equal(declineRes.success, true, "Courier decline must succeed without MESSENGER_NOTES_NOT_ALLOWED");
  });

  await t.test("3. BD-WF-01: Courier task completion transmits canonical payload without free-text notes", async () => {
    const orderNo = await createLiveOrder();

    // Advance to Stage 2
    const advRes = await advanceOrderOnServer(orderNo, "Penjadwalan", {
      messenger: courierUserContext.userName,
      assignedMessengerName: courierUserContext.userName,
      assignedMessengerId: courierUserContext.employeeId,
      tanggalJemput: "2026-11-10",
    });
    assert.equal(advRes.status, 200);

    mockStorage.setItem("auth_token", courierAuth.token);
    mockStorage.setItem("auth_user", JSON.stringify(courierAuth.user));

    // Start pickup
    const startRes = await startPickupTaskAction(orderNo, courierUserContext);
    assert.equal(startRes.success, true, "Start pickup must succeed");

    // Complete pickup with canonical checklist and photoUrl
    const completeRes = await completePickupTaskAction(
      orderNo,
      {
        pickupChecklist: {
          stnkAsli: true,
          bpkbAsli: true,
          ktpAsli: true,
          stnk: true,
          bpkb: true,
          ktp: true,
        },
        photoProofUrl: "https://example.com/pickup.jpg",
      },
      courierUserContext
    );

    assert.equal(completeRes.success, true, "Complete pickup must succeed");

    // Verify backend order state
    const getRes = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderNo)}`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    const order = ((await getRes.json()) as any).data;
    assert.equal(order.pickupCompleted, true);
    assert.equal(order.pickupProof?.photoProofUrl, "https://example.com/pickup.jpg");
  });

  await t.test("4. BD-WF-02: Admin authority on Stage 4 office operations & Stage 6 restriction", async () => {
    // 1. PermissionStore contract
    assert.equal(permissionStore.canManageStage("admin", 4), true, "Admin must be authorized for Stage 4");
    assert.equal(permissionStore.canManageStage("admin", 6), false, "Admin must be strictly forbidden on Stage 6");
    assert.equal(permissionStore.canManageStage("svp", 6), true, "SVP is authorized on Stage 6");

    // 2. OrderTracking UI action gating: advancing to Stage 5 requires canManage(4) AND docs in office
    const orderTrackingCanAdvance = (role: string, samsatPickupStatus?: string) => {
      const canManageStage4 = permissionStore.canManageStage(role, 4);
      return canManageStage4 && samsatPickupStatus === "Dokumen Samsat Diterima di Kantor";
    };

    assert.equal(orderTrackingCanAdvance("admin", "Tugas Baru"), false, "Cannot advance if docs not in office");
    assert.equal(orderTrackingCanAdvance("admin", "Sedang Jemput Dokumen Samsat"), false, "Cannot advance while in transit");
    assert.equal(orderTrackingCanAdvance("admin", "Dokumen Samsat Diterima di Kantor"), true, "Admin CAN advance once docs arrive at office");
    assert.equal(orderTrackingCanAdvance("courier", "Dokumen Samsat Diterima di Kantor"), false, "Courier cannot advance Stage 4");

    // 3. Live backend progression
    const orderNo = await createLiveOrder();

    // Progress through Stage 1 -> 2 -> 3 -> 4
    await advanceOrderOnServer(orderNo, "Penjadwalan");
    await advanceOrderOnServer(orderNo, "Verifikasi Dokumen", { pickupCompleted: true });
    await advanceOrderOnServer(orderNo, "Proses Samsat", { documentsVerified: true });

    // When all Samsat loket components are COMPLETED, advance to Stage 5 succeeds
    const successAdvanceRes = await advanceOrderOnServer(orderNo, "Verifikasi Ulang", {
      samsatProcesses: [
        { id: "comp-1", name: "Pendaftaran Samsat", status: "COMPLETED" },
        { id: "comp-2", name: "Kasir Pembayaran", status: "COMPLETED" },
      ],
      samsatPickupStatus: "Dokumen Samsat Diterima di Kantor",
    });
    assert.equal(successAdvanceRes.status, 200, "Admin can advance Stage 4 to Stage 5 when requirements met");
  });

  await t.test("5. WF-05: Non-sequential jumps (1 -> 4, 1 -> 7) are rejected by backend", async () => {
    const orderNo = await createLiveOrder();

    // Illegal jump 1 -> 4
    const jumpTo4Res = await advanceOrderOnServer(orderNo, "Proses Samsat");
    assert.equal(jumpTo4Res.status, 400, "Direct jump from Stage 1 to Stage 4 must be rejected (400)");

    // Illegal jump 1 -> 7
    const jumpTo7Res = await advanceOrderOnServer(orderNo, "Pengantaran");
    assert.equal(jumpTo7Res.status, 400, "Direct jump from Stage 1 to Stage 7 must be rejected (400)");
  });

  await t.test("6. WF-07: Canonical Samsat pickup status is 'Sedang Jemput Dokumen Samsat'", async () => {
    const orderNo = await createLiveOrder();

    // Advance to Stage 4 with Samsat processing completed
    await advanceOrderOnServer(orderNo, "Penjadwalan");
    await advanceOrderOnServer(orderNo, "Verifikasi Dokumen", { pickupCompleted: true });
    await advanceOrderOnServer(orderNo, "Proses Samsat", {
      documentsVerified: true,
      samsatStatus: "Selesai",
      samsatPickupMessenger: courierUserContext.userName,
      samsatPickupMessengerId: courierUserContext.employeeId,
      samsatPickupStatus: "Tugas Baru",
    });

    mockStorage.setItem("auth_token", courierAuth.token);
    mockStorage.setItem("auth_user", JSON.stringify(courierAuth.user));

    const acceptRes = await acceptMessengerTaskAction(
      orderNo,
      "Jemput Hasil Samsat",
      courierUserContext
    );
    assert.equal(acceptRes.success, true, "Courier accepting Samsat pickup must succeed");

    const getRes = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderNo)}`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    const order = ((await getRes.json()) as any).data;
    assert.equal(
      order.samsatPickupStatus,
      "Sedang Jemput Dokumen Samsat",
      "samsatPickupStatus must strictly be canonical 'Sedang Jemput Dokumen Samsat'"
    );
  });

  await t.test("7. R-01: Asynchronous startMessengerTask returns true on backend success and false on 400/403 failure without premature success", async () => {
    const orderNo = await createLiveOrder();

    // Advance to Stage 2 with courier assigned
    await advanceOrderOnServer(orderNo, "Penjadwalan", {
      messenger: courierUserContext.userName,
      assignedMessengerName: courierUserContext.userName,
      assignedMessengerId: courierUserContext.employeeId,
      tanggalJemput: "2026-11-10",
    });

    mockStorage.setItem("auth_token", courierAuth.token);
    mockStorage.setItem("auth_user", JSON.stringify(courierAuth.user));

    // Await startMessengerTask - must resolve true after network succeeds
    const startRes = await startMessengerTask(orderNo, courierUserContext);
    assert.equal(startRes.success, true, "Awaited startMessengerTask must succeed on valid assignment");

    // Attempting to start with unassigned courier must resolve to false with error message
    const wrongCourierContext: UserContext = {
      userName: "Andi Pratama",
      employeeId: "EMP-0005",
      role: "messenger",
    };
    const failRes = await startMessengerTask(orderNo, wrongCourierContext);
    assert.equal(failRes.success, false, "startMessengerTask must fail for unassigned courier");
    assert.ok(failRes.error && failRes.error.length > 0, "Error message must be populated on failure");
  });

  await t.test("8. R-02: Courier reassignment rejects unknown names, empty IDs, synthetic 'emp-msg', and mismatched courier IDs", async () => {
    // 1. resolveMessengerEmployeeId returns undefined for unknown courier names (no synthetic fallback)
    assert.equal(resolveMessengerEmployeeId("Budi Messenger"), "EMP-0004");
    assert.equal(resolveMessengerEmployeeId("Andi Pratama"), "EMP-0005");
    assert.equal(resolveMessengerEmployeeId("Unknown Courier Name"), undefined, "Unknown courier must resolve to undefined");
    assert.equal(resolveMessengerEmployeeId(""), undefined);
    assert.equal(resolveMessengerEmployeeId("Belum Ditugaskan"), undefined);

    const orderNo = await createLiveOrder();
    await advanceOrderOnServer(orderNo, "Penjadwalan", {
      messenger: courierUserContext.userName,
      assignedMessengerName: courierUserContext.userName,
      assignedMessengerId: courierUserContext.employeeId,
      tanggalJemput: "2026-11-10",
    });

    mockStorage.setItem("auth_token", adminAuth.token);
    mockStorage.setItem("auth_user", JSON.stringify(adminAuth.user));

    // 2. Empty ID rejected before network request
    const emptyIdRes = await reassignMessengerTaskAction(
      orderNo,
      "Jemput Dokumen",
      "Andi Pratama",
      "",
      "Alasan pengalihan tugas yang valid",
      adminUserContext
    );
    assert.equal(emptyIdRes.success, false, "Empty courier ID must be rejected");

    // 3. Synthetic 'emp-msg' rejected before network request
    const syntheticIdRes = await reassignMessengerTaskAction(
      orderNo,
      "Jemput Dokumen",
      "Andi Pratama",
      "emp-msg",
      "Alasan pengalihan tugas yang valid",
      adminUserContext
    );
    assert.equal(syntheticIdRes.success, false, "Synthetic 'emp-msg' must be rejected");

    // 4. Mismatched ID rejected before network request
    const mismatchRes = await reassignMessengerTaskAction(
      orderNo,
      "Jemput Dokumen",
      "Budi Messenger",
      "EMP-0005", // ID for Andi, not Budi
      "Alasan pengalihan tugas yang valid",
      adminUserContext
    );
    assert.equal(mismatchRes.success, false, "Mismatched courier ID must be rejected");

    // 5. Valid courier and matching ID succeeds
    const validRes = await reassignMessengerTaskAction(
      orderNo,
      "Jemput Dokumen",
      "Andi Pratama",
      "EMP-0005",
      "Alasan pengalihan tugas resmi operasional",
      adminUserContext
    );
    assert.equal(validRes.success, true, "Valid courier reassignment must succeed");
  });
});
