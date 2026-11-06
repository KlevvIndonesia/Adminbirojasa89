import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { getDb } from "../server/src/database/db";
import { dbPricingRepository } from "../server/src/repositories/dbPricingRepository";

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

test("Biaya Layanan Tahap 5: End-to-End HTTP API Batch Persistence & Hard-Refresh Resilience", async (t) => {
  const { server, baseUrl } = await startTestServer();
  const db = getDb();
  const serviceId = "svc-perp-1th";
  const serviceName = "Perpanjangan 1 Tahun";

  let authToken = "";

  try {
    await t.test("1. Authentication: Login as admin to obtain JWT token", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@birojasa.com",
          password: "admin123",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.data?.token);
      authToken = data.data.token;
    });

    await t.test("2. Setup Pre-existing Custom Tariffs in SQLite for Jakarta Timur and Depok", async () => {
      // 1. Jakarta Timur (Custom Jasa: 360,000, Khusus: 450,000)
      const jktTimurConfig = {
        id: `${serviceId}:samsat-jakarta-timur`,
        serviceId,
        serviceName,
        samsatId: "samsat-jakarta-timur",
        wilayah: "Jakarta Timur",
        biayaJasa: 360000,
        biayaJasaLengkap: 360000,
        jasaLengkapEnabled: true,
        biayaPengurusanKhusus: 450000,
        biayaJasaNembak: 450000,
        pengurusanKhususEnabled: true,
        jasaNembakEnabled: true,
        biayaAntarJemput: 50000,
        antarJemputEnabled: true,
        antarJemputMode: "Antar & Jemput",
        nominalSwdkllj: 143000,
        swdklljEnabled: true,
        biayaLainnya: [],
        active: true,
      };

      // 2. Depok (Custom Kurir: 85,000, Custom Fee: "Parkir Lapangan Depok")
      const depokConfig = {
        id: `${serviceId}:samsat-depok`,
        serviceId,
        serviceName,
        samsatId: "samsat-depok",
        wilayah: "Depok",
        biayaJasa: 250000,
        biayaJasaLengkap: 250000,
        jasaLengkapEnabled: true,
        biayaPengurusanKhusus: 0,
        biayaJasaNembak: 0,
        pengurusanKhususEnabled: false,
        jasaNembakEnabled: false,
        biayaAntarJemput: 85000,
        antarJemputEnabled: true,
        antarJemputMode: "Antar & Jemput",
        nominalSwdkllj: 143000,
        swdklljEnabled: true,
        biayaLainnya: [
          { id: "fee-depok-1", label: "Parkir Lapangan Depok", nominal: 25000, enabled: true, includesInTotal: true },
        ],
        active: true,
      };

      const savedTimur = dbPricingRepository.upsertServicePricing(jktTimurConfig.id, jktTimurConfig);
      assert.ok(savedTimur);

      const savedDepok = dbPricingRepository.upsertServicePricing(depokConfig.id, depokConfig);
      assert.ok(savedDepok);

      // Verify physical presence in SQLite
      const timurInDb = db.prepare("SELECT * FROM service_pricing_configs WHERE id = ?").get(jktTimurConfig.id) as any;
      assert.ok(timurInDb);
      assert.equal(timurInDb.biaya_jasa, 360000);

      const depokInDb = db.prepare("SELECT * FROM service_pricing_configs WHERE id = ?").get(depokConfig.id) as any;
      assert.ok(depokInDb);
      assert.equal(depokInDb.biaya_antar_jemput, 85000);
    });

    await t.test("3. HTTP POST /api/pricing/services/batch-replicate with PRESERVE_EXISTING_CUSTOM", async () => {
      const sourceConfig = {
        biayaJasaLengkap: 275000,
        jasaLengkapEnabled: true,
        biayaJasaNembak: 320000,
        jasaNembakEnabled: false,
        biayaAntarJemput: 60000,
        antarJemputEnabled: true,
        antarJemputMode: "Antar & Jemput",
        nominalSwdkllj: 35000,
        swdklljEnabled: true,
        biayaLainnya: [],
      };

      const res = await fetch(`${baseUrl}/api/pricing/services/batch-replicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          serviceId,
          serviceName,
          sourceConfig,
          scope: {
            applyBiayaLayanan: true,
            applyBiayaTambahan: true,
            applyKomponenSamsat: true,
            applyBiayaLainnya: false,
          },
          overridePolicy: "PRESERVE_EXISTING_CUSTOM",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.ok(data.data.preservedCount >= 2, `Expected preservedCount >= 2, got ${data.data.preservedCount}`);
      assert.equal(data.data.totalCount, 515);
      assert.equal(data.data.updatedCount + data.data.preservedCount, 515);

      // Verify SQLite state: Custom offices must be intact
      const timurRow = db.prepare("SELECT * FROM service_pricing_configs WHERE id = ?").get(`${serviceId}:samsat-jakarta-timur`) as any;
      assert.equal(timurRow.biaya_jasa, 360000, "Jakarta Timur Jasa must remain 360,000 (preserved)");

      const depokRow = db.prepare("SELECT * FROM service_pricing_configs WHERE id = ?").get(`${serviceId}:samsat-depok`) as any;
      assert.equal(depokRow.biaya_antar_jemput, 85000, "Depok Kurir must remain 85,000 (preserved)");

      // Verify SQLite state: Standard offices must be updated
      const pusatRow = db.prepare("SELECT * FROM service_pricing_configs WHERE id = ?").get(`${serviceId}:samsat-jakarta-pusat`) as any;
      assert.ok(pusatRow, "Jakarta Pusat must exist in service_pricing_configs");
      assert.equal(pusatRow.biaya_jasa, 275000, "Jakarta Pusat Jasa must be updated to 275,000");
      assert.equal(pusatRow.biaya_antar_jemput, 60000, "Jakarta Pusat Kurir must be updated to 60,000");
    });

    await t.test("4. Hard-Refresh (F5) Simulation: GET /api/pricing/services confirms physical persistence", async () => {
      const res = await fetch(`${baseUrl}/api/pricing/services`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));

      const configs = body.data as any[];
      const serviceConfigs = configs.filter((c) => c.serviceId === serviceId || c.service_id === serviceId);
      assert.equal(serviceConfigs.length, 515, "All 515 Samsat configs must be physically saved and retrievable");

      const timurFromApi = serviceConfigs.find((c) => c.samsatId === "samsat-jakarta-timur" || c.samsat_id === "samsat-jakarta-timur");
      assert.ok(timurFromApi);
      assert.equal(timurFromApi.biayaJasa || timurFromApi.biaya_jasa, 360000);

      const depokFromApi = serviceConfigs.find((c) => c.samsatId === "samsat-depok" || c.samsat_id === "samsat-depok");
      assert.ok(depokFromApi);
      assert.equal(depokFromApi.biayaAntarJemput || depokFromApi.biaya_antar_jemput, 85000);
    });

    await t.test("5. HTTP POST /api/pricing/services/batch-replicate with OVERWRITE_ALL", async () => {
      const overwriteConfig = {
        biayaJasaLengkap: 310000,
        jasaLengkapEnabled: true,
        biayaJasaNembak: 350000,
        jasaNembakEnabled: false,
        biayaAntarJemput: 70000,
        antarJemputEnabled: true,
        antarJemputMode: "Antar & Jemput",
        nominalSwdkllj: 35000,
        swdklljEnabled: true,
        biayaLainnya: [],
      };

      const res = await fetch(`${baseUrl}/api/pricing/services/batch-replicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          serviceId,
          serviceName,
          sourceConfig: overwriteConfig,
          scope: {
            applyBiayaLayanan: true,
            applyBiayaTambahan: true,
            applyKomponenSamsat: true,
            applyBiayaLainnya: false,
          },
          overridePolicy: "OVERWRITE_ALL",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      assert.equal(data.data.preservedCount, 0, "No offices preserved under OVERWRITE_ALL");
      assert.equal(data.data.updatedCount, 515);

      // Verify in SQLite: Jakarta Timur and Depok are now overwritten
      const timurAfter = db.prepare("SELECT * FROM service_pricing_configs WHERE id = ?").get(`${serviceId}:samsat-jakarta-timur`) as any;
      assert.equal(timurAfter.biaya_jasa, 310000, "Jakarta Timur Jasa must now be overwritten to 310,000");

      const depokAfter = db.prepare("SELECT * FROM service_pricing_configs WHERE id = ?").get(`${serviceId}:samsat-depok`) as any;
      assert.equal(depokAfter.biaya_antar_jemput, 70000, "Depok Kurir must now be overwritten to 70,000");
    });

    await t.test("6. Audit Trail Logging Verification in SQLite", async () => {
      const logs = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE action = 'BATCH_REPLICATE_SERVICE_PRICING' AND details LIKE ?
        ORDER BY created_at DESC LIMIT 5
      `).all(`%${serviceName}%`) as any[];

      assert.ok(logs.length >= 2, `Must have recorded audit logs for both batch replications, found ${logs.length}`);
      assert.ok(logs[0].details.includes("515 kantor diperbarui"));
      assert.ok(logs[1].details.includes("kantor diperbarui"));
    });
  } finally {
    server.close();
  }
});
