/**
 * Safe Invoice Reconciliation Script
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Remediates [DEF-FIN-001] Silent Invoice Overwrite / Hijacking between ORD-1126-001 and ORD-1126-003.
 * Defaults to DRY-RUN mode. Requires --execute flag to commit.
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isExecute = process.argv.includes("--execute");
const dbPath = process.env.TARGET_DB_PATH
  ? path.resolve(process.env.TARGET_DB_PATH)
  : path.resolve(__dirname, "../server/data/database.sqlite");

console.log("==================================================================");
console.log("  SUNBiroJasa — Invoice Reconciliation Utility [DEF-FIN-001]");
console.log(`  Database : ${dbPath}`);
console.log(`  Mode     : ${isExecute ? "LIVE EXECUTION (WRITE)" : "DRY RUN (READ ONLY)"}`);
console.log("==================================================================");

const db = new DatabaseSync(dbPath, { readOnly: !isExecute });

try {
  // Query current records
  const inv1 = db.prepare("SELECT * FROM finance_invoices WHERE id = 1").get() as any;
  const ord1 = db.prepare("SELECT * FROM orders WHERE order_no = 'ORD-1126-001'").get() as any;
  const ord3 = db.prepare("SELECT * FROM orders WHERE order_no = 'ORD-1126-003'").get() as any;

  console.log("\n[1] Current State:");
  console.log("  Invoice #1:", inv1 ? {
    id: inv1.id,
    invoice_no: inv1.invoice_no,
    order_no: inv1.order_no,
    customer: inv1.customer,
    total_tagihan: inv1.total_tagihan,
    dibayar: inv1.dibayar,
    status: inv1.status
  } : "NOT FOUND");

  console.log("  Order ORD-1126-001:", ord1 ? {
    customer: ord1.customer,
    total_biaya: ord1.total_biaya,
    payment_status: ord1.payment_status
  } : "NOT FOUND");

  console.log("  Order ORD-1126-003:", ord3 ? {
    customer: ord3.customer,
    total_biaya: ord3.total_biaya,
    payment_status: ord3.payment_status
  } : "NOT FOUND");

  if (!inv1 || !ord1 || !ord3) {
    console.error("[ABORT] Missing required target records for reconciliation.");
    process.exit(1);
  }

  // Check if reconciliation is actually needed
  if (inv1.order_no === "ORD-1126-001") {
    console.log("\n[INFO] Invoice #1 is already mapped to ORD-1126-001. No action required.");
    process.exit(0);
  }

  console.log("\n[2] Proposed Changes:");
  console.log("  A. Restore Invoice #1:");
  console.log("     - order_no     : ORD-1126-001");
  console.log("     - customer     : Mahesa Alghifari S.Kom");
  console.log("     - total_tagihan: 613000");
  console.log("     - dibayar      : 563000");
  console.log("     - sisa         : 50000");
  console.log("     - status       : Kurang Bayar");
  console.log("  B. Insert Invoice for ORD-1126-003:");
  console.log("     - invoice_no   : INV-1126-003");
  console.log("     - order_no     : ORD-1126-003");
  console.log("     - customer     : Frenkye Sitorus");
  console.log("     - total_tagihan: 1258000");
  console.log("     - dibayar      : 1258000");
  console.log("     - sisa         : 0");
  console.log("     - status       : PAID");
  console.log("  C. Synchronize Invoice Payments & Audit Trail");

  if (!isExecute) {
    console.log("\n[DRY RUN COMPLETE] Zero changes applied to database.");
    console.log("Pass --execute to apply changes after explicit user approval.");
  } else {
    // Perform transaction
    db.exec("BEGIN TRANSACTION");

    // Construct data_json for INV-1126-001 based on ORD-1126-001
    let ord1Json: any = {};
    try { ord1Json = JSON.parse(ord1.data_json || "{}"); } catch {}
    const inv1Json = {
      invoiceNo: "INV-1126-001",
      orderNo: "ORD-1126-001",
      service_id: ord1.service_id || "svc-perp-1th",
      serviceId: ord1.service_id || "svc-perp-1th",
      customer: ord1.customer,
      layanan: ord1.layanan,
      nopol: ord1.nopol,
      status: "Kurang Bayar",
      totalTagihan: 613000,
      dibayar: 563000,
      sisa: 50000,
      overpayment: 0,
      settlementCondition: "UNDERPAID",
      refundStatus: "NONE",
      biayaSamsat: 483000,
      pendapatanJasa: 130000,
      biayaJasa: 130000,
      biayaAntarJemput: 0,
      profit: 130000,
      costVerificationStatus: "VERIFIED",
      billingStatus: "Kurang Bayar"
    };

    // Construct data_json for INV-1126-003 based on existing inv1.data_json
    let inv3Json: any = {};
    try { inv3Json = JSON.parse(inv1.data_json || "{}"); } catch {}
    inv3Json.invoiceNo = "INV-1126-003";
    inv3Json.invoice = "INV-1126-003";
    inv3Json.orderNo = "ORD-1126-003";
    inv3Json.status = "PAID";
    inv3Json.billingStatus = "PAID";

    // 1. Restore Invoice #1
    const updateInv1 = db.prepare(`
      UPDATE finance_invoices SET
        order_no = 'ORD-1126-001',
        customer = 'Mahesa Alghifari S.Kom',
        layanan = ?,
        total_tagihan = 613000,
        dibayar = 563000,
        sisa = 50000,
        status = 'Kurang Bayar',
        biaya_samsat = 483000,
        pendapatan_jasa = 130000,
        biaya_jasa = 130000,
        profit_final = 130000,
        settlement_condition = 'UNDERPAID',
        data_json = ?,
        updated_at = datetime('now')
      WHERE id = 1
    `);
    updateInv1.run(ord1.layanan, JSON.stringify(inv1Json));

    // 2. Insert Invoice for ORD-1126-003
    const insertInv3 = db.prepare(`
      INSERT INTO finance_invoices (
        invoice_no, order_no, customer, layanan, status,
        total_tagihan, dibayar, sisa, biaya_samsat, pendapatan_jasa,
        overpayment, settlement_condition, refund_status,
        profit_final, profit_status, biaya_jasa, biaya_antar_jemput,
        cost_verification_status, data_json, updated_at
      ) VALUES (
        'INV-1126-003', 'ORD-1126-003', 'Frenkye Sitorus', ?, 'PAID',
        1258000, 1258000, 0, 100000, 230000,
        0, 'BALANCED', 'NONE',
        1158000, 'REALIZED', 230000, 0,
        'VERIFIED', ?, datetime('now')
      )
    `);
    insertInv3.run(ord3.layanan, JSON.stringify(inv3Json));

    // 3. Update ORD-1126-003 data_json with proper invoice_no
    let ord3Json: any = {};
    try { ord3Json = JSON.parse(ord3.data_json || "{}"); } catch {}
    ord3Json.noInvoice = "INV-1126-003";
    if (ord3Json.payment) ord3Json.payment.invoiceNo = "INV-1126-003";

    db.prepare("UPDATE orders SET data_json = ?, updated_at = datetime('now') WHERE order_no = 'ORD-1126-003'").run(
      JSON.stringify(ord3Json)
    );

    // 4. Ensure payment record exists for INV-1126-003 in invoice_payments
    const existingPay3 = db.prepare("SELECT id FROM invoice_payments WHERE invoice_no = 'INV-1126-003' OR order_no = 'ORD-1126-003'").get();
    if (!existingPay3) {
      db.prepare(`
        INSERT INTO invoice_payments (
          invoice_no, order_no, nominal, metode_pembayaran, nama_bank, nomor_rekening,
          tanggal_bayar, document_id, kas_kantor_id, status_verifikasi, idempotency_key,
          verified_by, verified_at, catatan, created_at
        ) VALUES (
          'INV-1126-003', 'ORD-1126-003', 1258000, 'Transfer Bank', 'CIMB NIAGA', '707751492800',
          '2026-11-07', 'DOC-DDFF6098', NULL, 'TERVERIFIKASI', 'RECONCILE-INV-1126-003-PAY',
          'Admin Super (SVP)', '2026-11-07T12:15:34.438Z', 'Pelunasan Pembayaran Awal (Rekonsiliasi DEF-FIN-001)', datetime('now')
        )
      `).run();
    }

    // 5. Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, module, details, created_at)
      VALUES (?, 'usr-system', 'System Auditor', 'administrator', 'RECONCILIATION', 'Finance', ?, datetime('now'))
    `).run(
      `audit-reconcile-${Date.now()}`,
      "Reconciled DEF-FIN-001: restored INV-1126-001 to ORD-1126-001, assigned INV-1126-003 to ORD-1126-003 with matched invoice_payment"
    );

    db.exec("COMMIT");
    console.log("\n[SUCCESS] Transaction committed successfully. Records reconciled.");
  }
} catch (err) {
  if (isExecute) {
    try { db.exec("ROLLBACK"); } catch {}
  }
  console.error("[ERROR] Reconciliation failed:", err);
  process.exit(1);
} finally {
  db.close();
}
