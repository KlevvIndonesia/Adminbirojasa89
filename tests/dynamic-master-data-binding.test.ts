/**
 * Dynamic Master Data Binding Integration Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies dynamic binding across the pipeline:
 * Master Data -> Buat Order -> Backend API -> SQLite Database -> Order Tracking
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";
import { getDb } from "../server/src/database/db";

test("Dynamic Master Data Binding Integration Test Suite", async (t) => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const adminToken = generateToken({
    userId: "2",
    email: "admin@birojasa.com",
    role: "admin",
    nama: "Adrian Adhari",
  });

  const authHeader = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  };

  try {
    await t.test("1. GET /api/services returns canonical active services ordered by urutan", async () => {
      const res = await fetch(`${baseUrl}/api/services`, { headers: authHeader });
      assert.strictEqual(res.status, 200);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      assert.ok(json.data.length >= 8, "Expected at least 8 services");

      const firstSvc = json.data[0];
      assert.strictEqual(firstSvc.kode_layanan, "PERP_1THN");
      assert.strictEqual(firstSvc.nama_layanan, "Perpanjangan 1 Tahun");
      assert.ok(Array.isArray(firstSvc.requirements));
      assert.ok(firstSvc.requirements.length > 0);
    });

    await t.test("2. Create order with valid service_id and samsat_asal_id persists canonical IDs", async () => {
      const payload = {
        customer: "Budi Santoso",
        namaPemilik: "Budi Santoso",
        nomorHP: "081234567890",
        layanan: "Perpanjangan 1 Tahun",
        service_id: "svc-perp-1th",
        wilayahSamsatAsal: "Jakarta Timur",
        samsat_asal_id: "samsat-jakarta-timur",
        nopol: "B 1234 BCD",
        jenisKendaraan: "Mobil",
        tahunKendaraan: "2021",
        metodeLayanan: "Datang Langsung",
        totalEstimasi: 350000,
        biayaJasa: 150000,
        payment: {
          tipePembayaran: "Bayar di Akhir",
          metodePembayaran: "Tunai",
          statusPembayaran: "Belum Lunas",
          totalBiaya: 350000,
        },
      };

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const created = json.data;

      assert.strictEqual(created.service_id, "svc-perp-1th");
      assert.strictEqual(created.samsat_asal_id, "samsat-jakarta-timur");

      // Verify in SQLite database directly
      const db = getDb();
      const row = db.prepare("SELECT order_no, service_id, samsat_asal_id, samsat_tujuan_id, data_json FROM orders WHERE order_no = ?").get(created.orderNo) as any;
      assert.ok(row, "Order row must exist in DB");
      assert.strictEqual(row.service_id, "svc-perp-1th");
      assert.strictEqual(row.samsat_asal_id, "samsat-jakarta-timur");

      const dataJson = JSON.parse(row.data_json);
      assert.strictEqual(dataJson.service_id, "svc-perp-1th");
      assert.strictEqual(dataJson.samsat_asal_id, "samsat-jakarta-timur");
      assert.ok(dataJson.serviceRequirementsSnapshot, "Snapshot should be captured");
      assert.strictEqual(dataJson.serviceRequirementsSnapshot.sourceServiceId, "svc-perp-1th");
    });

    await t.test("3. Reject order creation with invalid service_id (HTTP 400)", async () => {
      const payload = {
        customer: "Invalid Service Customer",
        namaPemilik: "Invalid Service",
        nomorHP: "081234567890",
        layanan: "Layanan Fiktif",
        service_id: "svc-nonexistent-12345",
        wilayahSamsatAsal: "Jakarta Timur",
        samsat_asal_id: "samsat-jakarta-timur",
        nopol: "B 9999 INV",
        totalEstimasi: 350000,
        biayaJasa: 150000,
        payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 350000 },
      };

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error?.code, "INVALID_SERVICE");
    });

    await t.test("4. Reject order creation with inactive service_id (HTTP 400)", async () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO services (
          id, kode_layanan, nama_layanan, kategori, status_aktif, urutan,
          memerlukan_samsat_tujuan, requirements, requirements_version, created_at, updated_at
        ) VALUES (
          ?, 'TEST_INACT', 'Layanan Nonaktif Uji', 'TEST', 0, 99,
          0, '[]', 1, ?, ?
        )
      `).run("svc-test-inactive", now, now);

      try {
        const payload = {
          customer: "Inactive Svc Customer",
          namaPemilik: "Inactive Svc",
          nomorHP: "081234567890",
          layanan: "Layanan Nonaktif Uji",
          service_id: "svc-test-inactive",
          wilayahSamsatAsal: "Jakarta Timur",
          samsat_asal_id: "samsat-jakarta-timur",
          nopol: "B 8888 DIS",
          totalEstimasi: 350000,
          biayaJasa: 150000,
          payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 350000 },
        };

        const res = await fetch(`${baseUrl}/api/orders`, {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify(payload),
        });

        assert.strictEqual(res.status, 400);
        const json = await res.json();
        assert.strictEqual(json.error?.code, "SERVICE_INACTIVE");
      } finally {
        db.prepare("DELETE FROM services WHERE id = ?").run("svc-test-inactive");
      }
    });

    await t.test("5. Reject order creation with invalid samsat_asal_id (HTTP 400)", async () => {
      const payload = {
        customer: "Invalid Samsat Customer",
        namaPemilik: "Invalid Samsat",
        nomorHP: "081234567890",
        layanan: "Perpanjangan 1 Tahun",
        service_id: "svc-perp-1th",
        wilayahSamsatAsal: "Samsat Mars",
        samsat_asal_id: "samsat-mars-alien-base",
        nopol: "B 5555 XYZ",
        totalEstimasi: 350000,
        biayaJasa: 150000,
        payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 350000 },
      };

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error?.code, "INVALID_SAMSAT");
    });

    await t.test("6. Mutasi Antar Samsat persists samsat_asal_id and samsat_tujuan_id", async () => {
      const payload = {
        customer: "Ahmad Dahlan",
        namaPemilik: "Ahmad Dahlan",
        nomorHP: "081399887766",
        layanan: "Mutasi Antar Samsat",
        service_id: "svc-mut-asal",
        wilayahSamsatAsal: "Jakarta Timur",
        samsat_asal_id: "samsat-jakarta-timur",
        wilayahSamsatTujuan: "Kota Bandung",
        samsat_tujuan_id: "samsat-bandung",
        nopol: "D 4321 MUT",
        jenisKendaraan: "Mobil",
        tahunKendaraan: "2020",
        totalEstimasi: 650000,
        biayaJasa: 250000,
        payment: {
          tipePembayaran: "Bayar di Akhir",
          metodePembayaran: "Tunai",
          totalBiaya: 650000,
        },
      };

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json();
      const created = json.data;

      assert.strictEqual(created.service_id, "svc-mut-asal");
      assert.strictEqual(created.samsat_asal_id, "samsat-jakarta-timur");
      assert.strictEqual(created.samsat_tujuan_id, "samsat-bandung");

      // Verify directly in SQLite
      const db = getDb();
      const row = db.prepare("SELECT order_no, service_id, samsat_asal_id, samsat_tujuan_id, data_json FROM orders WHERE order_no = ?").get(created.orderNo) as any;
      assert.strictEqual(row.service_id, "svc-mut-asal");
      assert.strictEqual(row.samsat_asal_id, "samsat-jakarta-timur");
      assert.strictEqual(row.samsat_tujuan_id, "samsat-bandung");

      const dataJson = JSON.parse(row.data_json);
      assert.strictEqual(dataJson.samsat_tujuan_id, "samsat-bandung");
      assert.ok(dataJson.serviceRequirementsSnapshot, "Snapshot must exist");
      assert.strictEqual(dataJson.serviceRequirementsSnapshot.sourceServiceId, "svc-mut-asal");
    });

    await t.test("7. Mutasi order rejects invalid samsat_tujuan_id (HTTP 400)", async () => {
      const payload = {
        customer: "Invalid Tujuan Customer",
        namaPemilik: "Invalid Tujuan",
        nomorHP: "081399887766",
        layanan: "Mutasi Antar Samsat",
        service_id: "svc-mut-asal",
        wilayahSamsatAsal: "Jakarta Timur",
        samsat_asal_id: "samsat-jakarta-timur",
        wilayahSamsatTujuan: "Samsat Jupiter",
        samsat_tujuan_id: "samsat-invalid-tujuan",
        nopol: "D 7777 ABC",
        totalEstimasi: 650000,
        biayaJasa: 250000,
        payment: { tipePembayaran: "Bayar di Akhir", totalBiaya: 650000 },
      };

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error?.code, "INVALID_SAMSAT");
    });

    await t.test("8. Reject non-cash payment method that is inactive (HTTP 400)", async () => {
      const payload = {
        customer: "Inactive Payment Customer",
        namaPemilik: "Inactive Payment",
        nomorHP: "081399887766",
        layanan: "Perpanjangan 1 Tahun",
        service_id: "svc-perp-1th",
        wilayahSamsatAsal: "Jakarta Timur",
        samsat_asal_id: "samsat-jakarta-timur",
        nopol: "B 1234 PAY",
        totalEstimasi: 500000,
        biayaJasa: 150000,
        payment: {
          tipePembayaran: "Bayar di Awal",
          metodePembayaran: "Transfer Bank Non-Existent XYZ",
          nominalDibayarAwal: 500000,
          totalBiaya: 500000,
        },
      };

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error?.code, "PAYMENT_METHOD_INACTIVE");
    });

    await t.test("9. Historical compatibility: Orders without service_id/samsat IDs load seamlessly", async () => {
      const db = getDb();
      const legacyOrderNo = "ORD-20250101-9999";
      const legacyDataJson = JSON.stringify({
        orderNo: legacyOrderNo,
        customer: "Legacy Customer",
        namaPemilik: "Legacy Customer",
        nomorHP: "08111111111",
        nopol: "B 9999 OLD",
        layanan: "Perpanjangan 1 Tahun",
        wilayahSamsatAsal: "Jakarta Timur",
        currentStageName: "Verifikasi",
        currentStep: 1,
        totalEstimasi: 350000,
        payment: {
          tipePembayaran: "Bayar di Akhir",
          statusPembayaran: "Belum Lunas",
        },
      });

      db.prepare(`
        INSERT INTO orders (
          order_no, customer, nomor_hp, nopol, layanan, total_biaya,
          current_stage_name, current_step, is_archived,
          created_at, updated_at, data_json
        ) VALUES (
          ?, 'Legacy Customer', '08111111111', 'B 9999 OLD', 'Perpanjangan 1 Tahun', 350000,
          'Verifikasi', 1, 0,
          '2025-01-01 00:00:00', '2025-01-01 00:00:00', ?
        )
      `).run(legacyOrderNo, legacyDataJson);

      try {
        const res = await fetch(`${baseUrl}/api/orders`, { headers: authHeader });
        assert.strictEqual(res.status, 200);

        const json = await res.json();
        assert.strictEqual(json.success, true);

        // Find the legacy order in Verifikasi stage
        const verifikasiOrders = json.data.Verifikasi || [];
        const found = verifikasiOrders.find((o: any) => o.orderNo === legacyOrderNo);
        assert.ok(found, "Legacy order should be present in Verifikasi stage");
        assert.strictEqual(found.customer, "Legacy Customer");
        assert.strictEqual(found.nopol, "B 9999 OLD");
        assert.strictEqual(found.layanan, "Perpanjangan 1 Tahun");
        // Service identity is gracefully resolved
        assert.strictEqual(found.service_id, undefined, "Historical order without service_id must maintain undefined");
      } finally {
        db.prepare("DELETE FROM orders WHERE order_no = ?").run(legacyOrderNo);
      }
    });

  } finally {
    server.close();
  }
});
