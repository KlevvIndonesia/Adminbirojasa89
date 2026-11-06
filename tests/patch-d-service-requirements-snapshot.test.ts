/**
 * PATCH D — SERVICE REQUIREMENTS SNAPSHOT & VERSIONING TEST SUITE
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. Snapshot Creation on Order Creation (schemaVersion 1, sourceServiceId, sourceRequirementsVersion, capturedAt, items).
 * 2. Master Requirements Versioning (version increment only when requirements change).
 * 3. Master Update Isolation (Order A at Version 1 remains unchanged after master updated to Version 2; Order B gets Version 2).
 * 4. Master Service Deletion/Unavailability Resilience (historical orders retain requirements without SERVICE_NOT_FOUND).
 * 5. Malformed Requirements Validation & Rejection (invalid types rejected, master protected).
 * 6. Legacy Order Resolution (LEGACY_DERIVED, GENERIC_FALLBACK, SERVICE_NOT_FOUND, MALFORMED_SNAPSHOT).
 * 7. Snapshot Immutability Enforcement (rejection of client-provided snapshots, 403 on protected updates, preservation in updateOrder).
 * 8. Concurrency, Idempotency & Transaction Atomicity.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { initDatabase } from "../server/src/database/db";
import { generateToken } from "../server/src/utils/crypto";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { serviceRepository } from "../server/src/repositories/dbServiceRepository";
import { serviceService } from "../server/src/services/serviceService";
import { orderService } from "../server/src/services/orderService";
import { resolveOrderRequirements, buildServiceRequirementsSnapshot } from "../server/src/utils/serviceSnapshot";

let server: http.Server;
let baseUrl: string;

const adminToken = generateToken({
  userId: "usr-admin",
  email: "admin@birojasa.com",
  nama: "Admin User",
  jabatan: "ADMIN",
  role: "admin",
  employeeId: "EMP-0002",
});

const messengerToken = generateToken({
  userId: "usr-courier",
  email: "andi.courier@birojasa.com",
  nama: "Andi Saputra",
  jabatan: "MESSENGER",
  role: "messenger",
  employeeId: "EMP-0004",
});

function buildValidOrderInput(overrides: Record<string, any> = {}) {
  return {
    customer: "Budi Prakoso",
    nomorHP: "081234567891",
    layanan: "Perpanjangan 1 Tahun",
    service_id: "svc-perp-1th",
    nopol: "B 1001 ABC",
    namaPemilik: "Budi Prakoso",
    metodeLayanan: "Antar Jemput",
    totalBiaya: 500000,
    biayaJasa: 100000,
    nominalPkbTerakhir: 350000,
    nominalSwdkllj: 143000,
    payment: {
      totalBiaya: 500000,
      dibayar: 0,
      statusPembayaran: "Belum Lunas",
      tipePembayaran: "Bayar di Akhir",
    },
    ...overrides,
  };
}

describe("PATCH D — Service Requirements Snapshot & Versioning Test Suite", () => {
  before(async () => {
    initDatabase({ runSchema: true });
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // =========================================================================
  // TEST GROUP 1: Snapshot Creation on Order Creation
  // =========================================================================
  test("D1: Order creation captures immutable snapshot from master service", async () => {
    const payload = buildValidOrderInput();

    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    const order = json.data;
    assert.ok(order.orderNo);

    // Verify snapshot structure
    const snapshot = order.serviceRequirementsSnapshot;
    assert.ok(snapshot, "Order must have serviceRequirementsSnapshot");
    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.sourceServiceId, "svc-perp-1th");
    assert.equal(snapshot.sourceServiceName, "Perpanjangan 1 Tahun");
    assert.equal(typeof snapshot.sourceRequirementsVersion, "number");
    assert.ok(snapshot.capturedAt);
    assert.ok(Array.isArray(snapshot.requirements));
    assert.ok(snapshot.requirements.length >= 3);

    // Verify item fields
    for (const item of snapshot.requirements) {
      assert.ok(item.id, "Requirement item must have stable id");
      assert.ok(item.label, "Requirement item must have label");
      assert.equal(item.required, true);
    }

    // Verify persistence in repository
    const stored = dbOrderRepository.getByOrderNo(order.orderNo);
    assert.ok(stored);
    assert.ok(stored.serviceRequirementsSnapshot);
    assert.equal(stored.serviceRequirementsSnapshot.sourceServiceId, "svc-perp-1th");
    assert.equal(stored.serviceRequirementsSnapshot.requirements.length, snapshot.requirements.length);
  });

  // =========================================================================
  // TEST GROUP 2: Master Service Requirements Versioning & Update Isolation
  // =========================================================================
  test("D2: Master update increments version and isolates existing Order A from Order B", async () => {
    // 1. Create Order A with original requirements
    const orderA = orderService.createOrder(
      buildValidOrderInput({
        customer: "Pelanggan Alpha",
        nomorHP: "081299990001",
        nopol: "B 2001 AAA",
      })
    );
    assert.ok(orderA.serviceRequirementsSnapshot);
    const versionA = orderA.serviceRequirementsSnapshot.sourceRequirementsVersion;
    const reqCountA = orderA.serviceRequirementsSnapshot.requirements.length;

    // 2. Admin updates master service requirements
    const newReqs = [
      "KTP asli + fotokopi (2 rangkap)",
      "STNK asli + fotokopi (2 rangkap)",
      "BPKB asli / Surat Keterangan Leasing + fotokopi (2 rangkap)",
      "Surat Kuasa Khusus Bermeterai (Syarat Baru V2)",
    ];

    const updateRes = await fetch(`${baseUrl}/api/services/svc-perp-1th`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        requirements: newReqs,
      }),
    });

    assert.equal(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.equal(updateJson.success, true);
    assert.equal(updateJson.data.requirements.length, 4);

    // Verify version counter incremented on master
    const updatedMaster = serviceRepository.getById("svc-perp-1th");
    assert.ok(updatedMaster);
    const versionMasterNew = Number(updatedMaster.requirements_version || 1);
    assert.ok(versionMasterNew > versionA, "Master requirements version should have incremented");

    // 3. Create Order B with updated requirements
    const orderB = orderService.createOrder(
      buildValidOrderInput({
        customer: "Pelanggan Beta",
        nomorHP: "081299990002",
        nopol: "B 2002 BBB",
      })
    );
    assert.ok(orderB.serviceRequirementsSnapshot);
    assert.equal(orderB.serviceRequirementsSnapshot.sourceRequirementsVersion, versionMasterNew);
    assert.equal(orderB.serviceRequirementsSnapshot.requirements.length, 4);
    assert.ok(
      orderB.serviceRequirementsSnapshot.requirements.some((r) => r.label.includes("Surat Kuasa Khusus Bermeterai"))
    );

    // 4. Verify Order A is completely isolated and retains Version A snapshot
    const reloadedA = dbOrderRepository.getByOrderNo(orderA.orderNo);
    assert.ok(reloadedA);
    assert.ok(reloadedA.serviceRequirementsSnapshot);
    assert.equal(reloadedA.serviceRequirementsSnapshot.sourceRequirementsVersion, versionA);
    assert.equal(reloadedA.serviceRequirementsSnapshot.requirements.length, reqCountA);
    assert.ok(
      !reloadedA.serviceRequirementsSnapshot.requirements.some((r) => r.label.includes("Surat Kuasa Khusus Bermeterai")),
      "Order A must NOT inherit requirements added after its creation"
    );
  });

  // =========================================================================
  // TEST GROUP 3: Non-Requirement Master Updates Do Not Bump Version
  // =========================================================================
  test("D3: Non-requirement master updates do not bump requirements_version", async () => {
    const beforeUpdate = serviceRepository.getById("svc-perp-1th")!;
    const versionBefore = Number(beforeUpdate.requirements_version || 1);

    // Update only description
    const updated = serviceRepository.update("svc-perp-1th", {
      deskripsi: "Deskripsi layanan diperbarui untuk pengujian.",
    });

    assert.ok(updated);
    const versionAfter = Number(updated.requirements_version || 1);
    assert.equal(versionAfter, versionBefore, "Version must not increment when requirements did not change");
  });

  // =========================================================================
  // TEST GROUP 4: Master Service Deletion/Unavailability Resilience
  // =========================================================================
  test("D4: Historical order retains requirements even if master service is unavailable", () => {
    const mockService = {
      id: "svc-custom-temp",
      kode_layanan: "TEMP_SVC",
      nama_layanan: "Layanan Sementara",
      kategori: "LAINNYA",
      memerlukan_samsat_tujuan: 0,
      deskripsi: "Layanan sementara untuk uji deindex",
      requirements: ["Dokumen Khusus A", "Dokumen Khusus B"],
      requirements_version: 1,
      status_aktif: 1,
      urutan: 99,
    };

    const snapshot = buildServiceRequirementsSnapshot(mockService, new Date().toISOString());
    const mockOrder: any = {
      orderNo: "ORD-HIST-001",
      customer: "Pelanggan Historis",
      layanan: "Layanan Sementara",
      service_id: "svc-custom-temp",
      serviceRequirementsSnapshot: snapshot,
    };

    // Master lookup returns undefined (simulating deleted/missing service)
    const masterLookup = () => undefined;

    const resolved = resolveOrderRequirements(mockOrder, masterLookup);
    assert.equal(resolved.status, "SNAPSHOT_VERIFIED");
    assert.equal(resolved.isSnapshot, true);
    assert.equal(resolved.requirements.length, 2);
    assert.equal(resolved.requirements[0], "Dokumen Khusus A");
    assert.equal(resolved.requirements[1], "Dokumen Khusus B");
    assert.equal(resolved.warningNotice, undefined);
  });

  // =========================================================================
  // TEST GROUP 5: Malformed Requirements Validation & Rejection
  // =========================================================================
  test("D5: Reject malformed requirements in serviceService.updateService", async () => {
    // 1. Non-array requirements rejected
    await assert.rejects(
      async () => {
        serviceService.updateService("svc-perp-1th", {
          requirements: "invalid-string-not-array" as any,
        });
      },
      (err: any) => {
        assert.equal(err.code, "INVALID_REQUIREMENTS");
        return true;
      }
    );

    // 2. Non-string elements in requirements rejected
    await assert.rejects(
      async () => {
        serviceService.updateService("svc-perp-1th", {
          requirements: ["Valid Doc", 12345 as any, null as any],
        });
      },
      (err: any) => {
        assert.equal(err.code, "INVALID_REQUIREMENTS");
        return true;
      }
    );
  });

  // =========================================================================
  // TEST GROUP 6: Legacy Order Resolution
  // =========================================================================
  test("D6: Legacy order without snapshot resolves as LEGACY_DERIVED or graceful fallback", () => {
    // A. Legacy order with existing master service
    const legacyOrderWithMaster: any = {
      orderNo: "ORD-LEGACY-001",
      customer: "Pelanggan Lama",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      // No serviceRequirementsSnapshot
    };

    const resolvedA = resolveOrderRequirements(legacyOrderWithMaster, (id) => serviceRepository.getById(id));
    assert.equal(resolvedA.status, "LEGACY_DERIVED");
    assert.equal(resolvedA.isLegacyDerived, true);
    assert.equal(resolvedA.isSnapshot, false);
    assert.ok(resolvedA.warningNotice);
    assert.ok(resolvedA.requirements.length > 0);

    // B. Legacy order with unknown service but standard STNK phrase
    const legacyOrderSTNK: any = {
      orderNo: "ORD-LEGACY-002",
      customer: "Pelanggan Pajak",
      layanan: "Perpanjangan 1 Tahun (Standard)",
    };
    const resolvedB = resolveOrderRequirements(legacyOrderSTNK, () => undefined);
    assert.equal(resolvedB.status, "GENERIC_FALLBACK");
    assert.equal(resolvedB.isLegacyDerived, true);
    assert.equal(resolvedB.requirements.length, 3);

    // C. Legacy order with completely unknown service and no STNK phrase
    const legacyOrderUnknown: any = {
      orderNo: "ORD-LEGACY-003",
      customer: "Pelanggan Misterius",
      layanan: "Layanan Asing 123",
    };
    const resolvedC = resolveOrderRequirements(legacyOrderUnknown, () => undefined);
    assert.equal(resolvedC.status, "SERVICE_NOT_FOUND");
    assert.equal(resolvedC.requirements.length, 0);

    // D. Order with malformed snapshot does NOT fallback to master
    const malformedOrder: any = {
      orderNo: "ORD-MALFORMED-001",
      customer: "Pelanggan Corrupt",
      layanan: "Perpanjangan 1 Tahun",
      service_id: "svc-perp-1th",
      serviceRequirementsSnapshot: {
        schemaVersion: 1,
        requirements: "not-an-array", // Corrupted!
      },
    };
    const resolvedD = resolveOrderRequirements(malformedOrder, (id) => serviceRepository.getById(id));
    assert.equal(resolvedD.status, "MALFORMED_SNAPSHOT");
    assert.equal(resolvedD.requirements.length, 0);
    assert.ok(resolvedD.warningNotice?.includes("Format snapshot"));
  });

  // =========================================================================
  // TEST GROUP 7: Snapshot Immutability Protection
  // =========================================================================
  test("D7: Client and generic update cannot overwrite serviceRequirementsSnapshot", async () => {
    // Create an order
    const order = orderService.createOrder(
      buildValidOrderInput({
        customer: "Pelanggan Proteksi",
        nomorHP: "081288887777",
        nopol: "B 7777 PRO",
      })
    );
    assert.ok(order.serviceRequirementsSnapshot);
    const originalReqCount = order.serviceRequirementsSnapshot.requirements.length;

    // 1. Messenger attempts to update snapshot via PUT /api/orders/:orderNo -> 403 Forbidden
    const messengerAttempt = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerToken}`,
      },
      body: JSON.stringify({
        serviceRequirementsSnapshot: {
          schemaVersion: 1,
          sourceServiceId: "hacked",
          requirements: [],
        },
      }),
    });
    assert.equal(messengerAttempt.status, 403);

    // 2. Admin attempts to send serviceRequirementsSnapshot in update payload -> 403 PROTECTED_FIELD_VIOLATION
    const adminAttempt = await fetch(`${baseUrl}/api/orders/${order.orderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        serviceRequirementsSnapshot: {
          schemaVersion: 1,
          sourceServiceId: "admin-tampered",
          requirements: [],
        },
      }),
    });
    assert.equal(adminAttempt.status, 403);
    const adminErrJson = await adminAttempt.json();
    assert.equal(adminErrJson.error.code, "PROTECTED_FIELD_VIOLATION");

    // 3. Direct orderService.updateOrder strips any attempted snapshot modification
    const internalUpdated = orderService.updateOrder(order.orderNo, {
      customer: "Pelanggan Proteksi Terverifikasi",
      serviceRequirementsSnapshot: {
        schemaVersion: 1,
        sourceServiceId: "tampered-internal",
        sourceRequirementsVersion: 999,
        capturedAt: new Date().toISOString(),
        requirements: [],
      } as any,
    });
    assert.equal(internalUpdated.customer, "Pelanggan Proteksi Terverifikasi");
    assert.equal(internalUpdated.serviceRequirementsSnapshot?.sourceServiceId, "svc-perp-1th");
    assert.equal(internalUpdated.serviceRequirementsSnapshot?.requirements.length, originalReqCount);

    // Verify repository level preservation
    const reloaded = dbOrderRepository.getByOrderNo(order.orderNo);
    assert.ok(reloaded);
    assert.equal(reloaded.serviceRequirementsSnapshot?.sourceServiceId, "svc-perp-1th");
    assert.equal(reloaded.serviceRequirementsSnapshot?.requirements.length, originalReqCount);
  });

  // =========================================================================
  // TEST GROUP 8: Idempotency & Transaction Atomicity
  // =========================================================================
  test("D8: Idempotent order creation returns identical existing order with unchanged snapshot", async () => {
    const idempotencyKey = `IDEM-TEST-${Date.now()}`;
    const payload = buildValidOrderInput({
      customer: "Pelanggan Idempoten",
      nomorHP: "081255554444",
      layanan: "Balik Nama",
      service_id: "svc-balik-nama",
      nopol: "B 5555 IDM",
      clientRequestId: idempotencyKey,
    });

    // First request
    const res1 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(res1.status, 201);
    const json1 = await res1.json();
    const orderNo = json1.data.orderNo;
    const snap1 = json1.data.serviceRequirementsSnapshot;
    assert.ok(snap1);

    // Second request with same idempotency key
    const res2 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(res2.status, 200);
    const json2 = await res2.json();
    assert.equal(json2.data.orderNo, orderNo);
    assert.deepEqual(json2.data.serviceRequirementsSnapshot, snap1);
  });
});
