/**
 * Integration Test: Payment Methods API & Master Data Multi-Account Invariants
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies all 10 Master Data & Multi-Account requirements:
 * 1. Tambah Transfer Bank BCA (success).
 * 2. Tambah Transfer Bank Mandiri dengan nama metode yang sama ("Transfer Bank") (success).
 * 3. Tolak duplikasi rekening (BCA dengan nomor yang sama -> 409 DUPLICATE_ACCOUNT).
 * 4. Tambah Tunai tanpa field bank/rekening (success -> sanitize ke bank: "Tunai", nomor: "", a.n: "").
 * 5. Edit Transfer Bank menjadi Tunai (membersihkan bank dan info rekening di DB).
 * 6. Edit Tunai menjadi Transfer Bank (memerlukan info bank & rekening, validasi duplikasi).
 * 7. GET mengembalikan semua akun dengan benar.
 * 8. activeOnly=true memfilter akun nonaktif.
 * 9. DELETE soft-deactivates metode jika ada histori transaksi, hard-deletes jika belum ada histori.
 * 10. Tolak duplikasi Tunai aktif (409 DUPLICATE_TUNAI).
 * 
 * Plus:
 * - 401 Unauthenticated request guard.
 * - 403 Operator/staff unauthorized modification guard.
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";
import { db, initDatabase } from "../server/src/database/db";

test("Payment Methods API - Multi-Account & Conditional Master Data Invariants", async (t) => {
  // Ensure schema migrations are applied to the test database
  initDatabase({ runSchema: true });

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
    nama: "Admin Operasional",
    role: "admin",
  });

  const staffToken = generateToken({
    userId: "4",
    email: "budi.messenger@birojasa.com",
    nama: "Budi Messenger",
    role: "messenger" as any,
  });

  try {
    // ─── AUTH & ACCESS CONTROL ──────────────────────────────────────────────────
    await t.test("Auth 1: Unauthenticated request to GET /api/payment-methods is rejected (401)", async () => {
      const res = await fetch(`${baseUrl}/api/payment-methods`);
      assert.strictEqual(res.status, 401);
    });

    await t.test("Auth 2: POST /api/payment-methods rejects unauthorized role (operator/staff) (403)", async () => {
      const payload = {
        nama_metode: "Transfer Bank",
        bank: "BCA",
        nama_rekening: "Staff Try",
        nomor_rekening: "111-222-333",
        status: "Aktif",
      };

      const res = await fetch(`${baseUrl}/api/payment-methods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 403);
    });

    // ─── SCENARIO 1: TAMBAH TRANSFER BANK BCA ──────────────────────────────────
    let bcaId = "";
    await t.test("Skenario 1: Tambah Transfer Bank BCA berhasil", async () => {
      const payload = {
        nama_metode: "Transfer Bank",
        bank: "BCA",
        nama_rekening: "PT Biro Jasa SUN89 Abadi",
        nomor_rekening: "772-019-2831",
        status: "Aktif",
      };

      const res = await fetch(`${baseUrl}/api/payment-methods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.nama_metode, "Transfer Bank");
      assert.strictEqual(json.data.bank, "BCA");
      assert.strictEqual(json.data.nama_rekening, "PT Biro Jasa SUN89 Abadi");
      assert.strictEqual(json.data.nomor_rekening, "772-019-2831");
      bcaId = json.data.id;

      // Direct SQLite verification
      const dbRow = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(bcaId) as any;
      assert.ok(dbRow, "BCA record must be present in SQLite");
      assert.strictEqual(dbRow.nama_metode, "Transfer Bank");
      assert.strictEqual(dbRow.bank, "BCA");
      assert.strictEqual(dbRow.nomor_rekening, "772-019-2831");
    });

    // ─── SCENARIO 2: TAMBAH TRANSFER BANK MANDIRI DENGAN NAMA METODE SAMA ──────
    let mandiriId = "";
    await t.test("Skenario 2: Tambah Transfer Bank Mandiri dengan nama metode yang sama ('Transfer Bank')", async () => {
      const payload = {
        nama_metode: "Transfer Bank",
        bank: "Mandiri",
        nama_rekening: "PT Biro Jasa SUN89 Abadi",
        nomor_rekening: "123-00-998877-1",
        status: "Aktif",
      };

      const res = await fetch(`${baseUrl}/api/payment-methods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.nama_metode, "Transfer Bank");
      assert.strictEqual(json.data.bank, "Mandiri");
      mandiriId = json.data.id;

      // Direct SQLite check: multiple records share 'Transfer Bank'
      const rows = db.prepare("SELECT * FROM payment_methods WHERE nama_metode = 'Transfer Bank'").all() as any[];
      assert.ok(rows.length >= 2, "Multiple Transfer Bank accounts must coexist in database");
    });

    // ─── SCENARIO 3: TOLAK DUPLIKASI REKENING (BCA NOMOR REKENING SAMA) ────────
    await t.test("Skenario 3: Tolak duplikasi rekening (BCA dengan nomor rekening yang sama)", async () => {
      const duplicatePayload = {
        nama_metode: "Transfer Bank",
        bank: "BCA", // Same bank (case-insensitive check)
        nama_rekening: "Rekening Cabang",
        nomor_rekening: "772-019-2831", // Same account number
        status: "Aktif",
      };

      const res = await fetch(`${baseUrl}/api/payment-methods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(duplicatePayload),
      });

      assert.strictEqual(res.status, 409);
      const json = await res.json() as any;
      assert.strictEqual(json.success, false);
      const errMsg = json.error?.message || json.message || "";
      assert.ok(
        errMsg.toLowerCase().includes("sudah terdaftar") || errMsg.toLowerCase().includes("duplikat"),
        `Expected duplicate account error message, got: ${errMsg}`
      );
    });

    // ─── SCENARIO 10: TOLAK DUPLIKASI TUNAI AKTIF ──────────────────────────────
    await t.test("Skenario 10: Tolak duplikasi Tunai aktif ketika sudah ada Tunai yang aktif", async () => {
      // In baseline, pm-cash is already active 'Tunai'
      const payload = {
        nama_metode: "Tunai",
        status: "Aktif",
      };

      const res = await fetch(`${baseUrl}/api/payment-methods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 409);
      const json = await res.json() as any;
      assert.strictEqual(json.success, false);
      const errMsg = json.error?.message || json.message || "";
      assert.ok(
        errMsg.toLowerCase().includes("hanya diperbolehkan satu") || errMsg.toLowerCase().includes("sudah terdaftar"),
        `Expected duplicate tunai error, got: ${errMsg}`
      );
    });

    // ─── SCENARIO 4: TAMBAH TUNAI TANPA FIELD BANK/REKENING ─────────────────────
    let addedTunaiId = "";
    await t.test("Skenario 4: Tambah Tunai tanpa field bank/rekening (sanitized & persisted)", async () => {
      // First, deactivate the existing active cash (pm-cash) to test adding a new active Tunai
      db.prepare("UPDATE payment_methods SET status = 'Nonaktif' WHERE nama_metode = 'Tunai'").run();

      const payload = {
        nama_metode: "Tunai",
        status: "Aktif",
        // No bank, no nama_rekening, no nomor_rekening
      };

      const res = await fetch(`${baseUrl}/api/payment-methods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.nama_metode, "Tunai");
      assert.strictEqual(json.data.bank, "Tunai");
      assert.strictEqual(json.data.nama_rekening, "");
      assert.strictEqual(json.data.nomor_rekening, "");
      addedTunaiId = json.data.id;

      // Verify in SQLite
      const row = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(addedTunaiId) as any;
      assert.ok(row);
      assert.strictEqual(row.nama_metode, "Tunai");
      assert.strictEqual(row.bank, "Tunai");
      assert.strictEqual(row.nama_rekening, "");
      assert.strictEqual(row.nomor_rekening, "");
    });

    // ─── SCENARIO 5: EDIT TRANSFER BANK MENJADI TUNAI ───────────────────────────
    let bniToConvertId = "";
    await t.test("Skenario 5: Edit Transfer Bank menjadi Tunai (membersihkan bank dan info rekening di DB)", async () => {
      // Create a Transfer Bank BNI record first
      const createRes = await fetch(`${baseUrl}/api/payment-methods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nama_metode: "Transfer Bank",
          bank: "BNI",
          nama_rekening: "PT SUN Biro Jasa BNI",
          nomor_rekening: "9988-7766-55",
          status: "Aktif",
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const createdJson = await createRes.json() as any;
      bniToConvertId = createdJson.data.id;

      // Edit BNI into Tunai (status Nonaktif so it doesn't conflict with existing active Tunai)
      const updateRes = await fetch(`${baseUrl}/api/payment-methods/${bniToConvertId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nama_metode: "Tunai",
          // Client might accidentally send old bank & account fields
          bank: "BNI",
          nama_rekening: "PT SUN Biro Jasa BNI",
          nomor_rekening: "9988-7766-55",
          status: "Nonaktif",
        }),
      });

      assert.strictEqual(updateRes.status, 200);
      const updateJson = await updateRes.json() as any;
      assert.strictEqual(updateJson.data.nama_metode, "Tunai");
      assert.strictEqual(updateJson.data.bank, "Tunai");
      assert.strictEqual(updateJson.data.nama_rekening, "");
      assert.strictEqual(updateJson.data.nomor_rekening, "");

      // Verify in SQLite that bank and account info is purged
      const dbRow = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(bniToConvertId) as any;
      assert.strictEqual(dbRow.nama_metode, "Tunai");
      assert.strictEqual(dbRow.bank, "Tunai");
      assert.strictEqual(dbRow.nama_rekening, "");
      assert.strictEqual(dbRow.nomor_rekening, "");
    });

    // ─── SCENARIO 6: EDIT TUNAI MENJADI TRANSFER BANK ───────────────────────────
    await t.test("Skenario 6: Edit Tunai menjadi Transfer Bank (memerlukan info bank & rekening, tolak duplikat)", async () => {
      // 6a: Attempting to switch bniToConvertId back to Transfer Bank without bank/rekening is rejected
      const failRes1 = await fetch(`${baseUrl}/api/payment-methods/${bniToConvertId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nama_metode: "Transfer Bank",
          bank: "",
          nomor_rekening: "",
        }),
      });
      assert.strictEqual(failRes1.status, 400);

      // 6b: Attempting to update with existing BCA duplicate account is rejected (409)
      const failRes2 = await fetch(`${baseUrl}/api/payment-methods/${bniToConvertId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nama_metode: "Transfer Bank",
          bank: "BCA",
          nama_rekening: "Akun Sama",
          nomor_rekening: "772-019-2831", // matches bcaId
        }),
      });
      assert.strictEqual(failRes2.status, 409);

      // 6c: Update with valid new bank account succeeds
      const successRes = await fetch(`${baseUrl}/api/payment-methods/${bniToConvertId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nama_metode: "Transfer Bank",
          bank: "BRI",
          nama_rekening: "PT Biro Jasa SUN89 BRI",
          nomor_rekening: "001-9988-7711",
          status: "Aktif",
        }),
      });

      assert.strictEqual(successRes.status, 200);
      const successJson = await successRes.json() as any;
      assert.strictEqual(successJson.data.nama_metode, "Transfer Bank");
      assert.strictEqual(successJson.data.bank, "BRI");
      assert.strictEqual(successJson.data.nomor_rekening, "001-9988-7711");

      // Verify in SQLite
      const briRow = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(bniToConvertId) as any;
      assert.strictEqual(briRow.nama_metode, "Transfer Bank");
      assert.strictEqual(briRow.bank, "BRI");
      assert.strictEqual(briRow.nomor_rekening, "001-9988-7711");
    });

    // ─── SCENARIO 7: GET MENGEMBALIKAN SEMUA AKUN DENGAN BENAR ──────────────────
    await t.test("Skenario 7: GET /api/payment-methods mengembalikan semua akun dengan benar", async () => {
      const res = await fetch(`${baseUrl}/api/payment-methods`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));

      const rows = db.prepare("SELECT * FROM payment_methods").all() as any[];
      assert.strictEqual(json.data.length, rows.length);

      // Verify all previously created methods are present
      const ids = json.data.map((m: any) => m.id);
      assert.ok(ids.includes(bcaId), "BCA must be returned");
      assert.ok(ids.includes(mandiriId), "Mandiri must be returned");
      assert.ok(ids.includes(addedTunaiId), "Tunai must be returned");
    });

    // ─── SCENARIO 8: ACTIVEONLY=TRUE MEMFILTER AKUN NONAKTIF ───────────────────
    await t.test("Skenario 8: activeOnly=true memfilter akun nonaktif", async () => {
      // Deactivate Mandiri
      await fetch(`${baseUrl}/api/payment-methods/${mandiriId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: "Nonaktif" }),
      });

      const res = await fetch(`${baseUrl}/api/payment-methods?activeOnly=true`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);

      // No Nonaktif records in results
      for (const item of json.data) {
        assert.strictEqual(item.status, "Aktif", `Item ${item.id} must have status Aktif`);
      }

      const mandiriFound = json.data.some((m: any) => m.id === mandiriId);
      assert.strictEqual(mandiriFound, false, "Inactive Mandiri must NOT appear in activeOnly=true");
    });

    // ─── SCENARIO 9: DELETE SOFT-DEACTIVATES VS HARD-DELETES ────────────────────
    await t.test("Skenario 9A: DELETE hard-deletes an unreferenced payment method", async () => {
      // Create a temporary method never used anywhere
      const tempInsert = db.prepare(`
        INSERT INTO payment_methods (id, nama_metode, bank, nama_rekening, nomor_rekening, status)
        VALUES ('pm-temp-unreferenced', 'Transfer Bank', 'Bank BJB', 'Tester', '555-444', 'Aktif')
      `);
      tempInsert.run();

      const res = await fetch(`${baseUrl}/api/payment-methods/pm-temp-unreferenced`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.deactivated, false, "Unreferenced method must be hard-deleted");

      // Verify physical deletion in DB
      const check = db.prepare("SELECT * FROM payment_methods WHERE id = 'pm-temp-unreferenced'").get();
      assert.strictEqual(check, undefined, "Record must be deleted from SQLite");
    });

    await t.test("Skenario 9B: DELETE soft-deactivates method when referenced in transactions", async () => {
      // Insert an order referencing BCA method
      db.prepare(`
        INSERT INTO orders (
          order_no, customer, nomor_hp, layanan, nopol, total_biaya, created_at, data_json
        ) VALUES (
          'ORD-TEST-PM-9B', 'Budi Santoso', '08123456789', 'Pajak Tahunan', 'B 8999 ABC', 350000, datetime('now'),
          ?
        )
      `).run(JSON.stringify({ metodePembayaran: "Transfer Bank", bank: "BCA", nomorRekening: "772-019-2831" }));

      // Now call DELETE on bcaId
      const res = await fetch(`${baseUrl}/api/payment-methods/${bcaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json() as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.deactivated, true, "Referenced method must be soft-deactivated");

      // Verify row still exists in DB with status Nonaktif
      const bcaRow = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(bcaId) as any;
      assert.ok(bcaRow, "Record must NOT be deleted from database");
      assert.strictEqual(bcaRow.status, "Nonaktif", "Record status must be changed to Nonaktif");
    });
  } finally {
    server.close();
  }
});
