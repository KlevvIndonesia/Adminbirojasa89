import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../server/src/database/db";
import { pricingService } from "../server/src/services/pricingService";
import { dbPricingRepository } from "../server/src/repositories/dbPricingRepository";

test("Biaya Layanan Tahap 2: Backend Service, Batch Route & Audit Trail Verification", async (t) => {
  const db = getDb();
  const serviceId = "svc-perp-1th";
  const serviceName = "Perpanjangan 1 Tahun";

  await t.test("1. Validation Guards: Rejects invalid or incomplete payloads", () => {
    // Missing serviceId
    assert.throws(
      () => {
        pricingService.batchReplicateServicePricing({} as any, null);
      },
      { name: "ApiError", message: "serviceId wajib diisi." }
    );

    // Missing sourceConfig
    assert.throws(
      () => {
        pricingService.batchReplicateServicePricing({ serviceId } as any, null);
      },
      { name: "ApiError", message: "sourceConfig wajib berupa objek konfigurasi valid." }
    );

    // Invalid overridePolicy
    assert.throws(
      () => {
        pricingService.batchReplicateServicePricing({
          serviceId,
          sourceConfig: {},
          scope: { applyBiayaLayanan: true, applyBiayaTambahan: true, applyBiayaLainnya: false },
          overridePolicy: "INVALID_POLICY" as any,
        }, null);
      },
      { name: "ApiError", message: "overridePolicy tidak valid." }
    );
  });

  await t.test("2. Setup Pre-existing Custom Tariff for Samsat Depok", () => {
    const customConfig = {
      id: `${serviceId}:samsat-depok`,
      serviceId,
      serviceName,
      samsatId: "samsat-depok",
      wilayah: "Depok",
      biayaJasa: 340000,
      biayaJasaLengkap: 340000,
      jasaLengkapEnabled: true,
      biayaPengurusanKhusus: 450000,
      biayaJasaNembak: 450000,
      pengurusanKhususEnabled: true,
      jasaNembakEnabled: true,
      biayaAntarJemput: 90000,
      antarJemputEnabled: true,
      antarJemputMode: "Antar & Jemput",
      swdkllj: { nominal: 143000, enabled: true },
      opsenPkb: { nominal: 143000, enabled: true },
      biayaLainnya: [
        { id: "bl-depok-1", label: "Biaya Parkir Depok", nominal: 15000, enabled: true, includesInTotal: true },
      ],
      active: true,
    };

    const saved = dbPricingRepository.upsertServicePricing(customConfig.id, customConfig);
    assert.ok(saved);
  });

  await t.test("3. Service Layer Execution with PRESERVE_EXISTING_CUSTOM: Persists & Logs Audit", () => {
    const userPayload = {
      userId: "usr-admin-tahap2",
      nama: "Super Admin Tahap 2",
      role: "admin",
    };

    const result = pricingService.batchReplicateServicePricing(
      {
        serviceId,
        serviceName,
        sourceConfig: {
          biayaJasaLengkap: 265000,
          jasaLengkapEnabled: true,
          biayaJasaNembak: 350000,
          jasaNembakEnabled: false,
          biayaAntarJemput: 55000,
          antarJemputEnabled: true,
          antarJemputMode: "Antar & Jemput",
          nominalSwdkllj: 143000,
          swdklljEnabled: true,
          biayaLainnya: [
            { id: "bl-src-1", label: "Materai Standar", nominal: 10000, enabled: true, includesInTotal: true },
          ],
        },
        scope: {
          applyBiayaLayanan: true,
          applyBiayaTambahan: true,
          applyBiayaLainnya: false,
        },
        overridePolicy: "PRESERVE_EXISTING_CUSTOM",
      },
      userPayload as any
    );

    assert.equal(result.totalCount, 515);
    assert.ok(result.preservedCount >= 1, "Depok must be preserved");
    assert.equal(result.updatedCount, 515 - result.preservedCount);

    // Verify Depok was NOT overwritten
    const depokRow = dbPricingRepository.getServicePricingById(`${serviceId}:samsat-depok`);
    assert.equal(depokRow.biayaJasa, 340000, "Depok Jasa must be preserved at 340,000");
    assert.equal(depokRow.biayaAntarJemput, 90000, "Depok Kurir must be preserved at 90,000");

    // Verify Audit Log was physically written to SQLite table audit_logs
    const auditRow: any = db
      .prepare(
        "SELECT * FROM audit_logs WHERE action = 'BATCH_REPLICATE_SERVICE_PRICING' AND details LIKE ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(`%${serviceName}%`);

    assert.ok(auditRow, "Audit log for batch replicate must exist");
    assert.equal(auditRow.user_name, "Super Admin Tahap 2");
    assert.ok(auditRow.details.includes("Replikasi massal biaya layanan"));
    assert.ok(auditRow.details.includes("PRESERVE_EXISTING_CUSTOM"));
  });

  await t.test("4. Service Layer Execution with OVERWRITE_ALL: Overwrites All & Logs Audit", () => {
    const userPayload = {
      userId: "usr-admin-tahap2",
      nama: "Super Admin Tahap 2",
      role: "admin",
    };

    const result = pricingService.batchReplicateServicePricing(
      {
        serviceId,
        serviceName,
        sourceConfig: {
          biayaJasaLengkap: 280000,
          jasaLengkapEnabled: true,
          biayaJasaNembak: 350000,
          jasaNembakEnabled: false,
          biayaAntarJemput: 50000,
          antarJemputEnabled: true,
          antarJemputMode: "Antar & Jemput",
          nominalSwdkllj: 143000,
          swdklljEnabled: true,
        },
        scope: {
          applyBiayaLayanan: true,
          applyBiayaTambahan: true,
          applyBiayaLainnya: false,
        },
        overridePolicy: "OVERWRITE_ALL",
      },
      userPayload as any
    );

    assert.equal(result.totalCount, 515);
    assert.equal(result.preservedCount, 0);
    assert.equal(result.updatedCount, 515);

    // Verify Depok is now overwritten
    const depokRow = dbPricingRepository.getServicePricingById(`${serviceId}:samsat-depok`);
    assert.equal(depokRow.biayaJasa, 280000, "Depok Jasa must now be 280,000");
  });
});
