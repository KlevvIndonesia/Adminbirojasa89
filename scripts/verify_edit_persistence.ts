/**
 * Verification Script: Edit Persistence across Orders, Invoices & SQLite
 */

import { orderService } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { db } from "../server/src/database/db";

async function main() {
  console.log("=== START VERIFICATION: EDIT PERSISTENCE ===");

  const adminUser = {
    userId: "usr-admin-test",
    nama: "Administrator Test",
    role: "administrator" as const,
  };

  // Step 1: Create initial test order
  console.log("\n[Step 1] Creating initial test order...");
  const initialPayload = {
    customer: "Budi Santoso",
    nomorHP: "081234567890",
    layanan: "Mutasi Antar Daerah",
    nopol: "B 1234 XYZ",
    wilayahSamsatAsal: "Samsat Jakarta Timur",
    wilayahSamsatTujuan: "Samsat Bogor",
    tanggalMasukBerkas: "2026-10-20",
    biayaJasa: 500000,
    biayaAntarJemput: 50000,
    biayaLainnya: 0,
    biayaSamsat: 2000000,
    totalBiaya: 2550000,
  };

  const createdOrder = orderService.createOrder(initialPayload, adminUser);
  const testOrderNo = createdOrder.orderNo;
  console.log(`✓ Created test order: ${testOrderNo}`);

  // Inspect initial state in SQLite
  const initialOrderRow = db.prepare("SELECT order_no, tanggal_masuk_berkas, samsat_asal, samsat_tujuan, total_biaya FROM orders WHERE order_no = ?").get(testOrderNo) as any;
  const initialInvoiceRow = db.prepare("SELECT invoice_no, total_tagihan, biaya_samsat, biaya_jasa, sisa FROM finance_invoices WHERE order_no = ?").get(testOrderNo) as any;
  console.log("Initial SQLite Orders Row:", initialOrderRow);
  console.log("Initial SQLite Invoices Row:", initialInvoiceRow);

  // Step 2: Edit the order with modified 6 sections
  console.log("\n[Step 2] Executing orderService.updateOrder with modified 6 sections...");
  const editPayload = {
    tanggalMasukBerkas: "2026-10-25",
    samsatAsal: "Samsat Jakarta Selatan",
    wilayahSamsatAsal: "Samsat Jakarta Selatan",
    samsatTujuan: "Samsat Bandung Kota",
    wilayahSamsatTujuan: "Samsat Bandung Kota",
    biayaSamsat: 3000000,
    biayaJasa: 600000,
    biayaAntarJemput: 0,
    biayaLainnya: 100000,
    totalBiaya: 3700000,
    totalEstimasi: 3700000,
    alamat: "Jalan Margonda Raya, Kota Depok, Jawa Barat",
    alamatPenjemputan: {
      detail: "Jalan Margonda Raya",
      kota: "Kota Depok",
      kecamatan: "Beji",
      kelurahan: "Kemiri Muka",
      provinsi: "Jawa Barat",
      nomor: "45",
      landmark: "Dekat Mall Margo City",
      mapsUrl: "https://maps.google.com/?q=margonda",
    },
    noInvoice: "INV-EDIT-TEST-001",
    ttbBPKB: "TTB-TEST-001",
    tandaTerima: "TT-TEST-001",
    bpkb: "Ada",
    catatanOrder: "Keterangan order telah diperbarui via form edit.",
  };

  const updatedOrder = orderService.updateOrder(testOrderNo, editPayload as any, adminUser);
  console.log(`✓ Order update executed. OrderNo: ${updatedOrder.orderNo}`);

  // Step 3: Directly query SQLite physical tables
  console.log("\n[Step 3] Querying physical SQLite tables to verify persistence...");
  const postEditOrderRow = db.prepare(`
    SELECT order_no, tanggal_masuk_berkas, samsat_asal, samsat_tujuan, total_biaya, data_json 
    FROM orders 
    WHERE order_no = ?
  `).get(testOrderNo) as any;

  const postEditInvoiceRow = db.prepare(`
    SELECT invoice_no, order_no, total_tagihan, biaya_samsat, pendapatan_jasa, biaya_jasa, sisa, status 
    FROM finance_invoices 
    WHERE order_no = ?
  `).get(testOrderNo) as any;

  console.log("Post-Edit SQLite Orders Row:");
  console.log({
    order_no: postEditOrderRow.order_no,
    tanggal_masuk_berkas: postEditOrderRow.tanggal_masuk_berkas,
    samsat_asal: postEditOrderRow.samsat_asal,
    samsat_tujuan: postEditOrderRow.samsat_tujuan,
    total_biaya: postEditOrderRow.total_biaya,
  });

  console.log("Post-Edit SQLite Invoices Row:");
  console.log(postEditInvoiceRow);

  const orderDataJson = JSON.parse(postEditOrderRow.data_json);
  console.log("Structured Address inside data_json:", orderDataJson.alamatPenjemputan);
  console.log("Biaya Lainnya inside data_json:", orderDataJson.biayaLainnya);
  console.log("TTB BPKB inside data_json:", orderDataJson.ttbBPKB);

  // Assertions
  let failed = false;
  if (postEditOrderRow.tanggal_masuk_berkas !== "2026-10-25") {
    console.error("FAIL: tanggal_masuk_berkas not updated!");
    failed = true;
  }
  if (postEditOrderRow.samsat_tujuan !== "Samsat Bandung Kota") {
    console.error("FAIL: samsat_tujuan not updated!");
    failed = true;
  }
  if (Number(postEditOrderRow.total_biaya) !== 3700000) {
    console.error(`FAIL: total_biaya in orders is ${postEditOrderRow.total_biaya}, expected 3700000!`);
    failed = true;
  }
  if (Number(postEditInvoiceRow.total_tagihan) !== 3700000) {
    console.error(`FAIL: total_tagihan in invoices is ${postEditInvoiceRow.total_tagihan}, expected 3700000!`);
    failed = true;
  }
  if (Number(postEditInvoiceRow.biaya_samsat) !== 3000000) {
    console.error(`FAIL: biaya_samsat in invoices is ${postEditInvoiceRow.biaya_samsat}, expected 3000000!`);
    failed = true;
  }
  if (Number(postEditInvoiceRow.sisa) !== 3700000) {
    console.error(`FAIL: sisa in invoices is ${postEditInvoiceRow.sisa}, expected 3700000!`);
    failed = true;
  }
  if (orderDataJson.alamatPenjemputan?.detail !== "Jalan Margonda Raya") {
    console.error("FAIL: alamatPenjemputan.detail not updated in data_json!");
    failed = true;
  }
  if (orderDataJson.ttbBPKB !== "TTB-TEST-001") {
    console.error("FAIL: ttbBPKB not updated in data_json!");
    failed = true;
  }

  // Step 4: Clean up test order
  console.log("\n[Step 4] Cleaning up test order...");
  dbOrderRepository.hardDeleteOrder(testOrderNo);
  const verifyDeleted = db.prepare("SELECT COUNT(*) AS cnt FROM orders WHERE order_no = ?").get(testOrderNo) as any;
  console.log(`✓ Test order hard deleted. Remaining records: ${verifyDeleted.cnt}`);

  // SQLite PRAGMA integrity_check
  const integrity = db.prepare("PRAGMA integrity_check").get() as any;
  console.log("\n[Step 5] PRAGMA integrity_check:", integrity);

  if (failed) {
    console.error("\n❌ VERIFICATION FAILED: One or more assertions did not match!");
    process.exit(1);
  } else {
    console.log("\n✅ ALL ASSERTIONS PASSED: 100% Edit Persistence Verified in SQLite!");
  }
}

main().catch((err) => {
  console.error("Error running verification:", err);
  process.exit(1);
});
