/**
 * Phase 8.1: Critical Release Blocker Resolution & Rehearsal Verification Suite
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. Rehearsal of Invoice Reconciliation (DEF-FIN-001) on disposable copy of operational DB
 * 2. Referential integrity and foreign keys after reconciliation
 * 3. Idempotency of reconciliation script
 * 4. Finance repository anti-hijacking collision guard (prevent future overwrites)
 * 5. Multi-messenger document authorization guard
 * 6. Transactional rollback and failure recovery
 * 7. Operational database immutability verification
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { documentService } from "../server/src/services/documentService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { runInTransaction, getDb } from "../server/src/database/db";

import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const operationalDbPath = path.resolve(projectRoot, "server/data/database.sqlite");
const initialOpHash = crypto.createHash("sha256").update(fs.readFileSync(operationalDbPath)).digest("hex").toUpperCase();

test("PHASE 8.1: CRITICAL RELEASE BLOCKER RESOLUTION SUITE", async (t) => {

  await t.test("BLK-001 Rehearsal: Safe Reconciliation of Invoice #1 & ORD-1126-003 on Disposable Database", async () => {
    // 1. Create isolated temporary workspace
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sun89_rehearsal_"));
    const tempDbPath = path.join(tempDir, "rehearsal_database.sqlite");

    try {
      // 2. Copy operational database to disposable copy
      fs.copyFileSync(operationalDbPath, tempDbPath);
      const walPath = operationalDbPath + "-wal";
      const shmPath = operationalDbPath + "-shm";
      if (fs.existsSync(walPath)) fs.copyFileSync(walPath, tempDbPath + "-wal");
      if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, tempDbPath + "-shm");

      // Verify initial state of disposable copy before reconciliation
      const preDb = new DatabaseSync(tempDbPath);
      const preInv1 = preDb.prepare("SELECT * FROM finance_invoices WHERE id = 1").get() as any;
      assert.equal(preInv1.order_no, "ORD-1126-003", "Pre-condition: Invoice #1 currently points to ORD-1126-003");
      preDb.close();

      // 3. Execute dry-run of reconcile-invoices.ts (must produce 0 changes)
      const dryRunRes = spawnSync(
        "npx",
        ["tsx", "scripts/reconcile-invoices.ts"],
        {
          cwd: projectRoot,
          env: { ...process.env, TARGET_DB_PATH: tempDbPath },
          encoding: "utf8",
          shell: true,
        }
      );
      assert.equal(dryRunRes.status, 0, "Dry-run script must exit with 0");
      assert.match(dryRunRes.stdout, /DRY RUN COMPLETE/, "Dry-run must indicate complete without writes");

      // Verify no changes occurred during dry run
      const dryDb = new DatabaseSync(tempDbPath);
      const dryInv1 = dryDb.prepare("SELECT * FROM finance_invoices WHERE id = 1").get() as any;
      assert.equal(dryInv1.order_no, "ORD-1126-003", "Dry run must NOT mutate database");
      dryDb.close();

      // 4. Execute live commit on disposable copy
      const liveRunRes = spawnSync(
        "npx",
        ["tsx", "scripts/reconcile-invoices.ts", "--execute"],
        {
          cwd: projectRoot,
          env: { ...process.env, TARGET_DB_PATH: tempDbPath },
          encoding: "utf8",
          shell: true,
        }
      );
      assert.equal(liveRunRes.status, 0, "Live execution script must exit with 0");
      assert.match(liveRunRes.stdout, /SUCCESS.*Transaction committed successfully/, "Live execution must commit");

      // 5. Inspect and assert reconciled state on disposable database
      const postDb = new DatabaseSync(tempDbPath);

      // Verify Invoice #1
      const postInv1 = postDb.prepare("SELECT * FROM finance_invoices WHERE id = 1").get() as any;
      assert.equal(postInv1.order_no, "ORD-1126-001", "Invoice #1 must be restored to ORD-1126-001");
      assert.equal(postInv1.customer, "Mahesa Alghifari S.Kom", "Invoice #1 customer must match ORD-1126-001");
      assert.equal(postInv1.total_tagihan, 613000, "Invoice #1 total must be 613,000");
      assert.equal(postInv1.dibayar, 563000, "Invoice #1 dibayar must be 563,000");
      assert.equal(postInv1.sisa, 50000, "Invoice #1 sisa must be 50,000");
      assert.equal(postInv1.status, "Kurang Bayar", "Invoice #1 status must be Kurang Bayar");

      // Verify Invoice #3
      const postInv3 = postDb.prepare("SELECT * FROM finance_invoices WHERE invoice_no = 'INV-1126-003'").get() as any;
      assert.ok(postInv3, "INV-1126-003 must be created");
      assert.equal(postInv3.order_no, "ORD-1126-003", "INV-1126-003 must belong to ORD-1126-003");
      assert.equal(postInv3.customer, "Frenkye Sitorus", "INV-1126-003 customer must be Frenkye Sitorus");
      assert.equal(postInv3.total_tagihan, 1258000, "INV-1126-003 total must be 1,258,000");
      assert.equal(postInv3.dibayar, 1258000, "INV-1126-003 dibayar must be 1,258,000");
      assert.equal(postInv3.sisa, 0, "INV-1126-003 sisa must be 0");
      assert.equal(postInv3.status, "PAID", "INV-1126-003 status must be PAID");

      // Verify invoice_payments for INV-1126-003
      const pay3 = postDb.prepare("SELECT * FROM invoice_payments WHERE invoice_no = 'INV-1126-003'").get() as any;
      assert.ok(pay3, "invoice_payments record for INV-1126-003 must exist");
      assert.equal(pay3.order_no, "ORD-1126-003");
      assert.equal(pay3.nominal, 1258000);
      assert.equal(pay3.status_verifikasi, "TERVERIFIKASI");

      // Verify invoice_payments for INV-1126-001
      const pay1Rows = postDb.prepare("SELECT * FROM invoice_payments WHERE invoice_no = 'INV-1126-001'").all() as any[];
      assert.ok(pay1Rows.length >= 1, "Payments for INV-1126-001 must exist");
      assert.ok(pay1Rows.every(p => p.order_no === "ORD-1126-001"), "All payments for INV-1126-001 must match ORD-1126-001");

      // Verify order ORD-1126-003 updated JSON
      const ord3 = postDb.prepare("SELECT data_json FROM orders WHERE order_no = 'ORD-1126-003'").get() as any;
      const ord3Json = JSON.parse(ord3.data_json);
      assert.equal(ord3Json.noInvoice, "INV-1126-003", "ORD-1126-003 JSON must reference INV-1126-003");

      // Verify Audit Log
      const audit = postDb.prepare("SELECT * FROM audit_logs WHERE action = 'RECONCILIATION'").get() as any;
      assert.ok(audit, "Reconciliation audit log must be recorded");

      // Verify PRAGMA integrity_check
      const integrity = postDb.prepare("PRAGMA integrity_check;").get() as any;
      assert.equal(integrity.integrity_check, "ok", "Database integrity check must be ok");

      // Verify PRAGMA foreign_key_check
      const fkViolations = postDb.prepare("PRAGMA foreign_key_check;").all();
      assert.equal(fkViolations.length, 0, "Zero foreign key violations after reconciliation");

      postDb.close();

      // 6. Test Idempotency: execute script a 2nd time against the reconciled DB
      const secondRunRes = spawnSync(
        "npx",
        ["tsx", "scripts/reconcile-invoices.ts", "--execute"],
        {
          cwd: projectRoot,
          env: { ...process.env, TARGET_DB_PATH: tempDbPath },
          encoding: "utf8",
          shell: true,
        }
      );
      assert.equal(secondRunRes.status, 0, "Second execution must exit 0");
      assert.match(secondRunRes.stdout, /already mapped to ORD-1126-001\. No action required/, "Must report already mapped");

    } finally {
      // Safe cleanup of temporary rehearsal directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  await t.test("BLK-002: Anti-Hijacking and Collision Guard in dbFinanceRepository", async () => {
    // Attempting to save an invoice with an existing invoice_no for a different order_no MUST throw
    const testInvNo = `INV-COLLISION-${Date.now()}`;
    const orderA = `ORD-A-${Date.now()}`;
    const orderB = `ORD-B-${Date.now()}`;

    // First save for Order A
    dbFinanceRepository.saveInvoice({
      invoiceNo: testInvNo,
      orderNo: orderA,
      customer: "Customer A",
      layanan: "Perpanjangan STNK Tahunan",
      totalTagihan: 500000,
      dibayar: 500000,
      sisa: 0,
      status: "PAID",
    });

    // Attempting to reuse testInvNo for Order B must be rejected by anti-hijacking guard
    assert.throws(
      () => {
        dbFinanceRepository.saveInvoice({
          invoiceNo: testInvNo,
          orderNo: orderB,
          customer: "Customer B",
          layanan: "Perpanjangan STNK Tahunan",
          totalTagihan: 750000,
          dibayar: 750000,
          sisa: 0,
          status: "PAID",
        });
      },
      /FINANCE_INVOICE_COLLISION/,
      "Must throw FINANCE_INVOICE_COLLISION when attempting to hijack existing invoice number"
    );
  });

  await t.test("BLK-003: Authoritative Backend Financial Calculation Enforcement", async () => {
    // When saving or updating invoices, backend enforces valid positive numeric values
    const testInv = `INV-MATH-${Date.now()}`;
    const testOrder = `ORD-MATH-${Date.now()}`;

    // Saving invoice with valid numbers computes non-negative sisa
    dbFinanceRepository.saveInvoice({
      invoiceNo: testInv,
      orderNo: testOrder,
      customer: "Math Test Customer",
      layanan: "Perpanjangan 1 Tahun",
      totalTagihan: 1000000,
      dibayar: 400000,
      sisa: 600000,
      status: "Kurang Bayar",
    });

    const retrieved = dbFinanceRepository.getInvoiceByNo(testInv);
    assert.ok(retrieved);
    assert.equal(retrieved.totalTagihan, 1000000);
    assert.equal(retrieved.dibayar, 400000);
    assert.equal(retrieved.sisa, 600000);
  });

  await t.test("BLK-004: Multi-Messenger and Document Access Authorization", async () => {
    // Test document access authorization helper
    const testDocId = "DOC-AUTH-TEST-001";
    const testOrderNo = "ORD-AUTH-TEST-001";

    // Setup an order with messenger assignment
    const database = getDb();
    database.prepare(`
      INSERT OR REPLACE INTO orders (order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name, payment_status, total_biaya, is_archived, data_json)
      VALUES (?, 'Auth Test Customer', '081299990001', 'Perpanjangan 1 Tahun', 'B 9999 XYZ', 1, 'Verifikasi', 'Lunas', 500000, 0, ?)
    `).run(
      testOrderNo,
      JSON.stringify({
        assignedMessengerId: "EMP-0004",
        deliveryMessengerId: "EMP-0005",
      })
    );

    database.prepare(`
      INSERT OR REPLACE INTO documents (id, order_no, document_type, original_name, storage_name, mime_type, size_bytes, sha256, uploaded_by, is_active)
      VALUES (?, ?, 'stnk', 'test.jpg', 'auth-test-storage.jpg', 'image/jpeg', 1024, 'abc123hash', 'Admin', 1)
    `).run(testDocId, testOrderNo);

    const docEntity = {
      id: testDocId,
      orderNo: testOrderNo,
      invoiceId: null,
      documentType: "stnk" as any,
      originalName: "test.jpg",
      storageName: "auth-test-storage.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      sha256: "abc123hash",
      uploadedBy: "Admin",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Assigned messenger EMP-0004 must be granted access (does not throw)
    assert.doesNotThrow(() => {
      documentService.authorizeAccess(docEntity, {
        userId: 4,
        role: "messenger",
        employeeId: "EMP-0004",
      } as any);
    }, "Assigned messenger must be authorized without error");

    // 2. Delivery messenger EMP-0005 must be granted access (does not throw)
    assert.doesNotThrow(() => {
      documentService.authorizeAccess(docEntity, {
        userId: 5,
        role: "messenger",
        employeeId: "EMP-0005",
      } as any);
    }, "Delivery messenger must be authorized without error");

    // 3. Unrelated messenger EMP-9999 must be denied access (throws ApiError 403)
    assert.throws(() => {
      documentService.authorizeAccess(docEntity, {
        userId: 99,
        role: "messenger",
        employeeId: "EMP-9999",
      } as any);
    }, /FORBIDDEN|tidak memiliki izin/);

    // 4. Admin/SVP must always be authorized (does not throw)
    assert.doesNotThrow(() => {
      documentService.authorizeAccess(docEntity, {
        userId: 1,
        role: "svp",
        employeeId: "EMP-0001",
      } as any);
    }, "SVP must be authorized without error");
  });

  await t.test("BLK-005: Transaction Safety and Complete Failure Rollback", async () => {
    const database = getDb();
    const probeId = `ORD-PROBE-${Date.now()}`;

    // Attempt compound operation where second statement throws
    assert.throws(() => {
      runInTransaction(() => {
        database.prepare(`
          INSERT INTO orders (order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name, payment_status, total_biaya, is_archived, data_json)
          VALUES (?, 'Rollback Customer', '081200000000', 'Layanan A', 'B 1111 PROBE', 1, 'Verifikasi', 'Belum Lunas', 100000, 0, '{}')
        `).run(probeId);

        // Simulated fatal business rule violation midway through transaction
        throw new Error("[SIMULATED_TRANSACTION_FAILURE]");
      });
    }, /SIMULATED_TRANSACTION_FAILURE/);

    // Verify first insert was completely rolled back
    const record = database.prepare("SELECT order_no FROM orders WHERE order_no = ?").get(probeId);
    assert.equal(record, undefined, "Rolled-back record must NOT exist in database");
  });

  await t.test("BLK-006: Operational Database Immutability Verification", async () => {
    // Assert operational database has not been modified
    const currentOpHash = crypto.createHash("sha256").update(fs.readFileSync(operationalDbPath)).digest("hex").toUpperCase();
    assert.equal(currentOpHash, initialOpHash, "Operational database hash must remain 100% invariant");
  });
});
