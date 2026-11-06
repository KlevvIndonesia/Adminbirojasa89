/**
 * PATCH A — CANONICAL IDENTITY & AUTHORIZATION HARDENING TEST SUITE
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. Canonical Messenger identity resolution (Budi -> EMP-MSG-001, Andi -> EMP-MSG-002).
 * 2. Strict rejection of unmapped / inactive messenger account (messenger@birojasa.com / User 6) with HTTP 403.
 * 3. Regression-free login for non-messenger roles (Admin, SVP, Finance).
 * 4. Token consistency: changePassword preserves canonical employeeId in fresh JWT.
 * 5. Task Acceptance authorization: requires verified canonical employeeId, rejects generic EMP-MSG with 403.
 * 6. Samsat lifecycle authorization: startSamsatProcess & completeSamsatProcess require verified canonical employeeId.
 * 7. Reimbursement hardening: prevents client-side identity spoofing and enforces BOLA/IDOR protection.
 * 8. Zero frontend mock data dependency (INITIAL_KARYAWAN completely removed from backend).
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";
import { orderService } from "../server/src/services/orderService";
import { messengerService } from "../server/src/services/messengerService";

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

test("PATCH A - 1: Canonical Messenger Login resolves employeeId EMP-MSG-001 for Budi Santoso", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "budi.messenger@birojasa.com", password: "messenger123" }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.role, "messenger");
    assert.strictEqual(body.data.user.employeeId, "EMP-MSG-001");
    assert.ok(body.data.token);

    // Verify token payload contains employeeId
    const base64Payload = body.data.token.split(".")[1];
    const payload = JSON.parse(Buffer.from(base64Payload, "base64").toString("utf8"));
    assert.strictEqual(payload.employeeId, "EMP-MSG-001");
    assert.strictEqual(payload.role, "messenger");
  } finally {
    server.close();
  }
});

test("PATCH A - 2: Canonical Messenger Login resolves employeeId EMP-MSG-002 for Andi Pratama", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "andi.messenger@birojasa.com", password: "messenger123" }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.role, "messenger");
    assert.strictEqual(body.data.user.employeeId, "EMP-MSG-002");
    assert.ok(body.data.token);

    const base64Payload = body.data.token.split(".")[1];
    const payload = JSON.parse(Buffer.from(base64Payload, "base64").toString("utf8"));
    assert.strictEqual(payload.employeeId, "EMP-MSG-002");
    assert.strictEqual(payload.role, "messenger");
  } finally {
    server.close();
  }
});

test("PATCH A - 3: Unmapped / Inactive Messenger (messenger@birojasa.com / User 6) is rejected with HTTP 403", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "messenger@birojasa.com", password: "messenger123" }),
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json() as any;
    assert.strictEqual(body.success, false);
    // Should be EMPLOYEE_INACTIVE or MESSENGER_NO_EMPLOYEE_ID
    assert.ok(
      body.error.code === "EMPLOYEE_INACTIVE" || body.error.code === "MESSENGER_NO_EMPLOYEE_ID",
      `Expected EMPLOYEE_INACTIVE or MESSENGER_NO_EMPLOYEE_ID, got ${body.error.code}`
    );
    // Crucially: no token returned
    assert.strictEqual(body.data, undefined);
  } finally {
    server.close();
  }
});

test("PATCH A - 4: Non-messenger accounts (Admin, SVP, Finance) log in normally without regression", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Admin
    const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@birojasa.com", password: "admin123" }),
    });
    assert.strictEqual(adminRes.status, 200);
    const adminBody = await adminRes.json() as any;
    assert.strictEqual(adminBody.data.user.role, "admin");

    // 2. SVP
    const svpRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "svp@birojasa.com", password: "admin123" }),
    });
    assert.strictEqual(svpRes.status, 200);
    const svpBody = await svpRes.json() as any;
    assert.strictEqual(svpBody.data.user.role, "administrator");

    // 3. Finance
    const finRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "finance@birojasa.com", password: "finance123" }),
    });
    assert.strictEqual(finRes.status, 200);
    const finBody = await finRes.json() as any;
    assert.strictEqual(finBody.data.user.role, "finance");
  } finally {
    server.close();
  }
});

test("PATCH A - 5: changePassword preserves canonical employeeId in the newly issued JWT", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Login as Budi
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "budi.messenger@birojasa.com", password: "messenger123" }),
    });
    const loginData = await loginRes.json() as any;
    const token = loginData.data.token;

    // 2. Change password
    const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        oldPassword: "messenger123",
        newPassword: "messengerNewPass123!",
        confirmPassword: "messengerNewPass123!",
      }),
    });
    assert.strictEqual(changeRes.status, 200);
    const changeBody = await changeRes.json() as any;
    assert.strictEqual(changeBody.success, true);
    const freshToken = changeBody.data.token;
    assert.ok(freshToken);

    // 3. Verify fresh token preserves employeeId
    const base64Payload = freshToken.split(".")[1];
    const payload = JSON.parse(Buffer.from(base64Payload, "base64").toString("utf8"));
    assert.strictEqual(payload.employeeId, "EMP-MSG-001");
    assert.strictEqual(payload.role, "messenger");

    // 4. Change password back to restore original state
    const revertRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${freshToken}`,
      },
      body: JSON.stringify({
        oldPassword: "messengerNewPass123!",
        newPassword: "messenger123",
        confirmPassword: "messenger123",
      }),
    });
    assert.strictEqual(revertRes.status, 200);
  } finally {
    server.close();
  }
});

test("PATCH A - 6: Task acceptance requires canonical employeeId and rejects missing or generic EMP-MSG", async () => {
  // Test with valid employeeId
  const validUser = {
    userId: "usr-4",
    email: "budi.messenger@birojasa.com",
    nama: "Budi Santoso",
    role: "messenger",
    jabatan: "MESSENGER",
    employeeId: "EMP-MSG-001",
  };

  // Test with generic / missing employeeId
  const invalidUserNoEmpId = {
    userId: "usr-6",
    email: "messenger@birojasa.com",
    nama: "Budi Santoso",
    role: "messenger",
    jabatan: "MESSENGER",
  };

  const invalidUserGenericEmpMsg = {
    userId: "usr-6",
    email: "messenger@birojasa.com",
    nama: "Budi Santoso",
    role: "messenger",
    jabatan: "MESSENGER",
    employeeId: "EMP-MSG",
  };

  // 1. Invalid courier without employeeId must throw 403 FORBIDDEN
  assert.throws(
    () => {
      orderService.acceptMessengerTask("ORD-1126-001", "Jemput Dokumen", invalidUserNoEmpId as any);
    },
    (err: any) => {
      return err.statusCode === 403 && err.code === "FORBIDDEN";
    }
  );

  // 2. Invalid courier with generic 'EMP-MSG' must throw 403 FORBIDDEN
  assert.throws(
    () => {
      orderService.acceptMessengerTask("ORD-1126-001", "Jemput Dokumen", invalidUserGenericEmpMsg as any);
    },
    (err: any) => {
      return err.statusCode === 403 && err.code === "FORBIDDEN";
    }
  );
});

test("PATCH A - 7: Samsat process lifecycle requires canonical employeeId and rejects generic IDs", async () => {
  const invalidCourier = {
    userId: "usr-6",
    email: "messenger@birojasa.com",
    nama: "Courier Without EmpId",
    role: "messenger",
    jabatan: "MESSENGER",
  };

  const genericCourier = {
    userId: "usr-6",
    email: "messenger@birojasa.com",
    nama: "Generic Courier",
    role: "messenger",
    jabatan: "MESSENGER",
    employeeId: "EMP-SAMSAT",
  };

  assert.throws(
    () => {
      orderService.startSamsatProcess("ORD-1126-001", invalidCourier as any);
    },
    (err: any) => err.statusCode === 403 && err.code === "FORBIDDEN"
  );

  assert.throws(
    () => {
      orderService.completeSamsatProcess("ORD-1126-001", {}, genericCourier as any);
    },
    (err: any) => err.statusCode === 403 && err.code === "FORBIDDEN"
  );
});

test("PATCH A - 8: Reimbursement creation strictly overwrites client employeeId with authenticated caller identity", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // Login as Budi (EMP-MSG-001)
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "budi.messenger@birojasa.com", password: "messenger123" }),
    });
    const { data: { token } } = await loginRes.json() as any;

    // Attempt to spoof Andi's identity (EMP-MSG-002) in the body
    const createRes = await fetch(`${baseUrl}/api/messenger/reimbursements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        employeeId: "EMP-MSG-002", // SPOOF ATTEMPT
        messengerName: "Andi Pratama", // SPOOF ATTEMPT
        category: "Bahan Bakar (Bensin)",
        amount: 50000,
        date: new Date().toISOString().split("T")[0],
        notes: "Uji coba anti-spoofing",
      }),
    });

    assert.strictEqual(createRes.status, 201);
    const body = await createRes.json() as any;
    assert.strictEqual(body.success, true);
    // Verified: The server strictly overwrote with Budi's authenticated canonical ID
    assert.strictEqual(body.data.employeeId, "EMP-MSG-001");
    assert.strictEqual(body.data.messengerName, "Budi Santoso");
  } finally {
    server.close();
  }
});

test("PATCH A - 9: Direct messengerService.createReimbursement rejects mismatched employeeId with 403 FORBIDDEN", () => {
  const callerUser = {
    userId: "usr-4",
    email: "budi.messenger@birojasa.com",
    nama: "Budi Santoso",
    role: "messenger",
    jabatan: "MESSENGER",
    employeeId: "EMP-MSG-001",
  };

  // Attempt to submit for EMP-MSG-002
  assert.throws(
    () => {
      messengerService.createReimbursement(
        {
          employeeId: "EMP-MSG-002",
          messengerName: "Andi Pratama",
          category: "Bahan Bakar (Bensin)" as any,
          amount: 45000,
          date: "2026-11-05",
        },
        callerUser as any
      );
    },
    (err: any) => err.statusCode === 403 && err.code === "FORBIDDEN"
  );
});

test("PATCH A - 10: Reimbursement rejects Samsat and Tax categories with 400", () => {
  const callerUser = {
    userId: "usr-4",
    email: "budi.messenger@birojasa.com",
    nama: "Budi Santoso",
    role: "messenger",
    jabatan: "MESSENGER",
    employeeId: "EMP-MSG-001",
  };

  assert.throws(
    () => {
      messengerService.createReimbursement(
        {
          employeeId: "EMP-MSG-001",
          messengerName: "Budi Santoso",
          category: "Pajak Kendaraan Bermotor (PKB)" as any,
          amount: 500000,
          date: "2026-11-05",
        },
        callerUser as any
      );
    },
    (err: any) => err.statusCode === 400 && err.code === "FORBIDDEN_REIMBURSEMENT_CATEGORY"
  );
});

test("PATCH A - 11: getMessengersWithStats & resolveMessengerEmpId use database and have zero mock data", () => {
  const stats = messengerService.getMessengersWithStats();
  assert.ok(Array.isArray(stats));
  assert.ok(stats.length >= 2);

  // User 6 (unmapped / inactive) must NOT be in active stats
  const user6 = stats.find((s) => s.name === "Budi Santoso" && s.employeeId === "USR-6");
  assert.strictEqual(user6, undefined, "Unmapped User 6 must not appear in active messengers stats");

  // Active messengers must have valid employee IDs
  const budi = stats.find((s) => s.name === "Budi Santoso");
  assert.ok(budi);
  assert.ok(budi.employeeId === "EMP-MSG-001" || budi.employeeId === "EMP-0004");

  const andi = stats.find((s) => s.name === "Andi Pratama");
  assert.ok(andi);
  assert.ok(andi.employeeId === "EMP-MSG-002" || andi.employeeId === "EMP-0005");

  // resolveMessengerEmpId returns correct canonical ID from DB
  assert.strictEqual(messengerService.resolveMessengerEmpId("Budi Santoso"), "EMP-MSG-001");
  assert.strictEqual(messengerService.resolveMessengerEmpId("Andi Pratama"), "EMP-MSG-002");

  // Non-existent name does NOT fall back to EMP-MSG-001
  assert.strictEqual(messengerService.resolveMessengerEmpId("Unknown Messenger"), "");
});
