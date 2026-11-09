/**
 * Master Data Hardening & Samsat Pricing Architecture Test Suite
 * Admin SUN89 — Biro Jasa Management System
 *
 * Verifies:
 * 1. Samsat create with valid administrative district.
 * 2. Samsat create without district rejected (400).
 * 3. Samsat update retains correct district relation.
 * 4. Samsat store syncs after mutation.
 * 5. Samsat city/regency/DKI naming conventions.
 * 6. Pricing update does not overwrite other regions (service_pricing_configs).
 * 7. Pricing fallback to national default works correctly.
 * 8. Concurrent pricing updates maintain row isolation.
 * 9. Audit logs created for Master Data CREATE, UPDATE, DELETE, DEACTIVATE.
 * 10. Audit logs capture correct actor ID, oldData, and newData.
 * 11. Failed mutations do not create audit events.
 * 12. No sensitive credentials logged.
 * 13. Historical order costSnapshot remains immutable.
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { db } from "../server/src/database/db";
import { normalizeSamsatOfficeName as normalizeServer } from "../server/src/utils/samsatNaming";
import { normalizeSamsatOfficeName as normalizeClient } from "../src/domain/pricing/samsatNaming";
import { resolveTariff } from "../server/src/utils/pricingResolver";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { dbPricingRepository } from "../server/src/repositories/dbPricingRepository";
import { pricingService } from "../server/src/services/pricingService";
import { paymentMethodService } from "../server/src/services/paymentMethodService";

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

async function getAdminToken(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@birojasa.com", password: "admin123" }),
  });
  const data = (await res.json()) as any;
  assert.strictEqual(res.status, 200, "Admin login should succeed");
  return data.data.token;
}

test("1. Samsat create with valid administrative district", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = await getAdminToken(baseUrl);
    const uniqueSuffix = Date.now().toString(36);
    const testDistrict = "32.02"; // Kabupaten Sukabumi in Kemendagri data

    const res = await fetch(`${baseUrl}/api/samsat/offices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: `Samsat Cibadak ${uniqueSuffix}`,
        wilayah: `Sukabumi`,
        alamat: "Jl. Raya Cibadak No. 12",
        kode_kabupaten_kota: testDistrict,
      }),
    });

    const json = (await res.json()) as any;
    assert.strictEqual(res.status, 201, "Should successfully create Samsat with valid district");
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.kode_kabupaten_kota, testDistrict);
    assert.ok(json.data.name.includes("Samsat"), "Should have normalized name");

    // Verify stored in database
    const inDb = (db as any).prepare("SELECT * FROM samsat_offices WHERE id = ?").get(json.data.id) as any;
    assert.ok(inDb, "Office must exist in database");
    assert.strictEqual(inDb.kode_kabupaten_kota, testDistrict);
  } finally {
    server.close();
  }
});

test("2. Samsat create without district rejected (400)", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = await getAdminToken(baseUrl);

    const res = await fetch(`${baseUrl}/api/samsat/offices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Samsat Fiktif Tanpa Wilayah",
        wilayah: "Wilayah Antah Berantah",
        alamat: "Jl. Misterius No. 0",
      }),
    });

    const json = (await res.json()) as any;
    assert.strictEqual(res.status, 400, "Must reject creation without official district code");
    assert.strictEqual(json.success, false);
    assert.ok(json.message.includes("kabupaten/kota wajib"), "Error message must indicate missing district");
  } finally {
    server.close();
  }
});

test("3. Samsat update retains correct district relation", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = await getAdminToken(baseUrl);
    const officeId = "samsat-jakarta-timur";

    const res = await fetch(`${baseUrl}/api/samsat/offices/${officeId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        alamat: "Jl. D.I. Panjaitan No. 55, Kebon Nanas, Jakarta Timur (Updated)",
        kode_kabupaten_kota: "31.75", // Kota Administrasi Jakarta Timur
      }),
    });

    const json = (await res.json()) as any;
    assert.strictEqual(res.status, 200, "Update must succeed");
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.kode_kabupaten_kota, "31.75");

    const row = (db as any).prepare("SELECT kode_kabupaten_kota, alamat FROM samsat_offices WHERE id = ?").get(officeId) as any;
    assert.strictEqual(row.kode_kabupaten_kota, "31.75");
    assert.ok(row.alamat.includes("(Updated)"));
  } finally {
    server.close();
  }
});

test("4. Samsat store syncs after mutation", async () => {
  const originalFetch = global.fetch;
  try {
    const uniqueId = `samsat-cimahi-${Date.now().toString(36)}`;
    global.fetch = (async (_url: any, _opts: any) => {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: uniqueId,
            name: "Samsat Kota Cimahi Uji Toko",
            wilayah: "Kota Cimahi",
            alamat: "Jl. Amir Machmud No. 88",
            kode_kabupaten_kota: "32.77",
          },
        }),
      } as any;
    }) as any;

    const { pricingStore } = await import("../src/app/data/pricingStore");
    const initialCount = pricingStore.getSamsats().length;
    assert.ok(initialCount >= 10, "Store must have Samsats preloaded");

    const created = await pricingStore.addSamsat({
      name: "Samsat Kota Cimahi Uji Toko",
      wilayah: "Kota Cimahi",
      alamat: "Jl. Amir Machmud No. 88",
      kode_kabupaten_kota: "32.77",
      nama_provinsi: "Jawa Barat",
    });

    assert.ok(created.id, "Store must return created Samsat with ID");
    const afterCount = pricingStore.getSamsats().length;
    assert.strictEqual(afterCount, initialCount + 1, "Store count must increase by 1");

    const found = pricingStore.getSamsatById(created.id);
    assert.ok(found, "Newly added Samsat must be retrievable by ID");
    assert.strictEqual(found?.kode_kabupaten_kota, "32.77");
  } finally {
    global.fetch = originalFetch;
  }
});

test("5. Samsat city/regency/DKI naming conventions", () => {
  // Cities
  assert.strictEqual(normalizeServer("Bandung", "Kota"), "Samsat Kota Bandung");
  assert.strictEqual(normalizeClient("Bandung", "Kota"), "Samsat Kota Bandung");
  assert.strictEqual(normalizeServer("Samsat Kota Depok", "Kota"), "Samsat Kota Depok");

  // Regencies
  assert.strictEqual(normalizeServer("Bogor", "Kabupaten"), "Samsat Kabupaten Bogor");
  assert.strictEqual(normalizeClient("Bogor", "Kabupaten"), "Samsat Kabupaten Bogor");
  assert.strictEqual(normalizeServer("Samsat Kabupaten Bekasi", "Kabupaten"), "Samsat Kabupaten Bekasi");

  // DKI Jakarta
  assert.strictEqual(normalizeServer("Jakarta Timur", "Kota"), "Samsat Jakarta Timur");
  assert.strictEqual(normalizeClient("Jakarta Selatan", "Kota"), "Samsat Jakarta Selatan");
  assert.strictEqual(normalizeServer("Samsat Jakarta Utara", "Kota"), "Samsat Jakarta Utara");
});

test("6. Pricing update does not overwrite other regions (service_pricing_configs)", () => {
  const serviceId = "svc-perp-1th";
  const eastId = `${serviceId}:samsat-jakarta-timur`;
  const westId = `${serviceId}:samsat-jakarta-barat`;

  // Set distinct pricing for Jakarta Timur
  dbPricingRepository.upsertServicePricing(eastId, {
    serviceId,
    serviceName: "Perpanjangan STNK 1 Tahun",
    samsatId: "samsat-jakarta-timur",
    wilayah: "Jakarta Timur",
    biayaJasa: 325000,
    biayaAntarJemput: 60000,
  });

  // Set distinct pricing for Jakarta Barat
  dbPricingRepository.upsertServicePricing(westId, {
    serviceId,
    serviceName: "Perpanjangan STNK 1 Tahun",
    samsatId: "samsat-jakarta-barat",
    wilayah: "Jakarta Barat",
    biayaJasa: 375000,
    biayaAntarJemput: 70000,
  });

  const eastRecord = dbPricingRepository.getServicePricingById(eastId);
  const westRecord = dbPricingRepository.getServicePricingById(westId);

  assert.strictEqual(eastRecord.biayaJasa, 325000, "Jakarta Timur must keep its custom jasa fee");
  assert.strictEqual(eastRecord.biayaAntarJemput, 60000);
  assert.strictEqual(westRecord.biayaJasa, 375000, "Jakarta Barat must keep its custom jasa fee");
  assert.strictEqual(westRecord.biayaAntarJemput, 70000);

  // Updating Jakarta Timur again must NOT affect Jakarta Barat
  dbPricingRepository.upsertServicePricing(eastId, {
    serviceId,
    serviceName: "Perpanjangan STNK 1 Tahun",
    samsatId: "samsat-jakarta-timur",
    wilayah: "Jakarta Timur",
    biayaJasa: 330000,
    biayaAntarJemput: 65000,
  });

  const eastAfter = dbPricingRepository.getServicePricingById(eastId);
  const westAfter = dbPricingRepository.getServicePricingById(westId);

  assert.strictEqual(eastAfter.biayaJasa, 330000, "East must be updated");
  assert.strictEqual(westAfter.biayaJasa, 375000, "West must remain completely unmutated");
});

test("7. Pricing fallback to national default works correctly", () => {
  const masterItem: any = {
    id: "cetak-stnk-r4",
    name: "Cetak STNK Roda 4",
    category: "Standar",
    tipeKendaraan: "Mobil",
    basePrice: 100000,
    active: true,
  };

  // Scenario A: No local override -> falls back to national default
  const resDefault = resolveTariff({
    masterItem,
    override: null,
    samsatId: "samsat-bogor",
  });

  assert.strictEqual(resDefault.effectivePrice, 100000);
  assert.strictEqual(resDefault.status, "CONFIGURED_DEFAULT");
  assert.strictEqual(resDefault.source, "DEFAULT");

  // Scenario B: Active local override -> uses override
  const resOverride = resolveTariff({
    masterItem,
    override: { id: "ovr-1", nominal: 135000, is_active: 1 },
    samsatId: "samsat-bogor",
  });

  assert.strictEqual(resOverride.effectivePrice, 135000);
  assert.strictEqual(resOverride.status, "CONFIGURED_OVERRIDE");
  assert.strictEqual(resOverride.source, "OVERRIDE");

  // Scenario C: Inactive local override -> cleanly falls back to national default
  const resInactiveOverride = resolveTariff({
    masterItem,
    override: { id: "ovr-1", nominal: 135000, is_active: 0 },
    samsatId: "samsat-bogor",
  });

  assert.strictEqual(resInactiveOverride.effectivePrice, 100000);
  assert.strictEqual(resInactiveOverride.status, "CONFIGURED_DEFAULT");
  assert.strictEqual(resInactiveOverride.source, "DEFAULT");
});

test("8. Concurrent pricing updates maintain row isolation", () => {
  const serviceA = "svc-perp-1th";
  const serviceB = "svc-perp-5th";
  const samsatId = "samsat-depok";

  const idA = `${serviceA}:${samsatId}`;
  const idB = `${serviceB}:${samsatId}`;

  // Execute two distinct updates simulating simultaneous admin operations
  dbPricingRepository.upsertServicePricing(idA, {
    serviceId: serviceA,
    serviceName: "Perpanjangan STNK 1 Tahun",
    samsatId,
    wilayah: "Depok",
    biayaJasa: 280000,
  });

  dbPricingRepository.upsertServicePricing(idB, {
    serviceId: serviceB,
    serviceName: "Perpanjangan STNK 5 Tahun",
    samsatId,
    wilayah: "Depok",
    biayaJasa: 550000,
  });

  const recordA = dbPricingRepository.getServicePricingById(idA);
  const recordB = dbPricingRepository.getServicePricingById(idB);

  assert.strictEqual(recordA.biayaJasa, 280000);
  assert.strictEqual(recordB.biayaJasa, 550000);
  assert.notStrictEqual(recordA.id, recordB.id);
});

test("9. Audit logs created for Master Data CREATE, UPDATE, DELETE, DEACTIVATE", () => {
  const mockUser: any = {
    userId: "usr-tester-99",
    nama: "Master Data Auditor",
    role: "administrator",
  };

  // 1. Metode Pembayaran - CREATE
  const uniqueBank = `TEST-${Date.now().toString(36).toUpperCase()}`;
  const pm = paymentMethodService.create(
    {
      nama_metode: "Transfer Bank",
      bank: uniqueBank,
      nama_rekening: "PT Uji Audit",
      nomor_rekening: "9876543210",
      status: "Aktif",
    },
    mockUser
  );
  assert.ok(pm.id);

  // 2. Metode Pembayaran - UPDATE
  paymentMethodService.update(
    pm.id,
    {
      nama_rekening: "PT Uji Audit Diperbarui",
    },
    mockUser
  );

  // 3. Metode Pembayaran - DEACTIVATE
  paymentMethodService.update(
    pm.id,
    {
      status: "Nonaktif",
    },
    mockUser
  );

  // 4. Biaya Layanan - CREATE
  const uniqueConfigId = `svc-perp-1th:samsat-audit-${Date.now().toString(36)}`;
  pricingService.createServicePricing(
    {
      id: uniqueConfigId,
      serviceName: "Perpanjangan STNK 1 Tahun",
      wilayah: "Jakarta Timur",
      biayaJasa: 275000,
      biayaAntarJemput: 50000,
    },
    mockUser
  );

  // 5. Biaya Layanan - DELETE
  pricingService.deleteServicePricing(uniqueConfigId, mockUser);

  // Verify audit logs exist in repository
  const logs = dbAuditRepository.getAll({ limit: 50 });
  const pmCreateLog = logs.find((l) => l.module === "Master Data - Metode Pembayaran" && l.action === "CREATE");
  const pmUpdateLog = logs.find((l) => l.module === "Master Data - Metode Pembayaran" && l.action === "UPDATE");
  const pmDeactLog = logs.find((l) => l.module === "Master Data - Metode Pembayaran" && l.action === "DEACTIVATE");
  const blCreateLog = logs.find((l) => l.module === "Master Data - Biaya Layanan" && l.action === "CREATE");
  const blDeleteLog = logs.find((l) => l.module === "Master Data - Biaya Layanan" && l.action === "DELETE");

  assert.ok(pmCreateLog, "Audit log for payment method CREATE must exist");
  assert.ok(pmUpdateLog, "Audit log for payment method UPDATE must exist");
  assert.ok(pmDeactLog, "Audit log for payment method DEACTIVATE must exist");
  assert.ok(blCreateLog, "Audit log for biaya layanan CREATE must exist");
  assert.ok(blDeleteLog, "Audit log for biaya layanan DELETE must exist");
});

test("10. Audit logs capture correct actor ID, oldData, and newData", () => {
  const mockUser: any = {
    userId: "usr-auditor-10",
    nama: "Super Auditor",
    role: "administrator",
  };

  const uniqueBank = `ACTOR-${Date.now().toString(36).toUpperCase()}`;
  const created = paymentMethodService.create(
    {
      nama_metode: "Transfer Bank",
      bank: uniqueBank,
      nama_rekening: "Auditor Test",
      nomor_rekening: "1122334455",
      status: "Aktif",
    },
    mockUser
  );

  const updated = paymentMethodService.update(
    created.id,
    {
      nama_rekening: "Auditor Test Edited",
    },
    mockUser
  );

  const logs = dbAuditRepository.getAll({ userId: "usr-auditor-10", limit: 10 });
  assert.ok(logs.length >= 2, "Must find logs for usr-auditor-10");

  const updateLog = logs.find((l) => l.action === "UPDATE");
  assert.ok(updateLog, "Update log must exist");
  assert.strictEqual(updateLog.userId, "usr-auditor-10");
  assert.strictEqual(updateLog.userName, "Super Auditor");
  assert.strictEqual(updateLog.userRole, "administrator");

  assert.ok(updateLog.metadata, "Metadata must be present");
  assert.ok(updateLog.metadata.oldData, "oldData must be captured");
  assert.ok(updateLog.metadata.newData, "newData must be captured");
  assert.strictEqual(updateLog.metadata.oldData.nama_rekening, "Auditor Test");
  assert.strictEqual(updateLog.metadata.newData.nama_rekening, "Auditor Test Edited");
});

test("11. Failed mutations do not create audit events", () => {
  // Try invalid payment method creation (empty data)
  assert.throws(() => {
    paymentMethodService.create({ nama_metode: "" } as any);
  });

  // Try duplicate payment method creation
  assert.throws(() => {
    paymentMethodService.create({
      nama_metode: "Transfer Bank",
      bank: "BCA",
      nama_rekening: "Duplikat",
      nomor_rekening: "1234567890",
    });
    paymentMethodService.create({
      nama_metode: "Transfer Bank",
      bank: "BCA",
      nama_rekening: "Duplikat",
      nomor_rekening: "1234567890",
    });
  });

  // None of the thrown errors should produce a false success audit entry
  const logs = dbAuditRepository.getAll({ limit: 10 });
  const falseLogs = logs.filter((l) => l.details && l.details.includes("Duplikat"));
  assert.strictEqual(falseLogs.length, 0, "No false positive audit logs on error");
});

test("12. No sensitive credentials logged", () => {
  const allLogs = dbAuditRepository.getAll({ limit: 100 });

  for (const log of allLogs) {
    const rawJson = JSON.stringify(log);
    assert.strictEqual(rawJson.includes("password_hash"), false, "Password hash must never appear in audit logs");
    assert.strictEqual(rawJson.includes("pbkdf2"), false, "PBKDF2 hashes must never appear in audit logs");
    assert.strictEqual(rawJson.includes("salt"), false, "Salt must never appear in audit logs");
    assert.strictEqual(rawJson.includes("auth_token"), false, "Auth tokens must never appear in audit logs");
  }
});

test("13. Historical order costSnapshot remains immutable", () => {
  const testOrderNo = `ORD-IMMUT-${Date.now().toString(36)}`;
  const snapshotData = {
    costSnapshot: {
      jasa: 300000,
      pkb: 450000,
      swdkllj: 35000,
      total: 785000,
    },
  };

  (db as any).prepare(`
    INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, total_biaya, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    testOrderNo,
    "Pelanggan Tetap",
    "08123456789",
    "Perpanjangan 1 Tahun",
    "B 9999 XYZ",
    785000,
    JSON.stringify(snapshotData)
  );

  // Mutate master pricing item
  const item = dbPricingRepository.getAllSamsatItems()[0];
  if (item) {
    pricingService.updateSamsatItem(item.id, {
      biayaDasar: item.biayaDasar + 75000,
    });
  }

  // Mutate service pricing config
  dbPricingRepository.upsertServicePricing("svc-perp-1th:samsat-jakarta-timur", {
    serviceId: "svc-perp-1th",
    serviceName: "Perpanjangan STNK 1 Tahun",
    samsatId: "samsat-jakarta-timur",
    wilayah: "Jakarta Timur",
    biayaJasa: 999000,
  });

  // Verify historical order data did NOT change
  const afterOrder = (db as any).prepare(`
    SELECT order_no, total_biaya, data_json
    FROM orders
    WHERE order_no = ?
  `).get(testOrderNo) as any;

  assert.strictEqual(afterOrder.total_biaya, 785000, "Historical order total_biaya must remain immutable");
  assert.strictEqual(afterOrder.data_json, JSON.stringify(snapshotData), "Historical cost breakdown snapshot must remain immutable");
});
