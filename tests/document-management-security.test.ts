/**
 * Document Management Security Hardening Automated Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies all requirements of IMPLEMENTATION TASK — DOCUMENT MANAGEMENT SECURITY HARDENING:
 * 1. Messenger linking document to any order (Business Rule A.1)
 * 2. Other authenticated roles linking documents between orders (Business Rule A.2)
 * 3. Invalid target order rejected with 404 ORDER_NOT_FOUND (zero DB change)
 * 4. Invoice-Order mismatch rejected with 400 INVOICE_ORDER_MISMATCH (zero DB change)
 * 5. Audit log records DOCUMENT_LINK_UPDATED with actor, timestamp, previous & new relations
 * 6. Atomic transaction rollback on failure
 * 7. Approval invalidation on old and new orders
 * 8. Messenger assignment on orders unchanged
 * 9. Assigned task list remains correct
 * 10. Available/unassigned task list remains correct
 * 11. JWT and access ticket authorization decisions are aligned and consistent
 * 12. Referrer-Policy: no-referrer on preview and download
 * 13. Failed upload validation leaves zero orphan files in storage
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import fs from "node:fs";
import { createApp } from "../server/src/app";
import { dbDocumentRepository } from "../server/src/repositories/dbDocumentRepository";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";
import { documentService } from "../server/src/services/documentService";
import { generateToken } from "../server/src/utils/crypto";
import { db, runInTransaction } from "../server/src/database/db";
import { CONFIG } from "../server/src/config/env";
import {
  deriveAssignedMessengerTasks,
  getAvailableUnassignedTasks,
} from "../src/app/data/messengerTaskAdapter";
import { StageName, OperationalOrder } from "../src/app/data/orderStore";

// Minimal valid PDF buffer for testing
const SAMPLE_PDF_BUFFER = Buffer.concat([
  Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Security Test) >>\nendobj\ntrailer\n<< /Size 1 >>\nstartxref\n%%EOF"),
]);

// Helper to start an ephemeral test HTTP server
async function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as any).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

// Helper to seed deterministic test orders and invoices
function seedSecurityTestFixtures() {
  // 1. Order ORD-SEC-01 (Assigned to Kurir Budi) with pre-verified document approval
  db.prepare("DELETE FROM orders WHERE order_no IN ('ORD-SEC-01', 'ORD-SEC-02', 'ORD-SEC-03')").run();
  db.prepare("DELETE FROM finance_invoices WHERE invoice_no IN ('INV-SEC-01', 'INV-SEC-02')").run();

  const order1Data = {
    orderNo: "ORD-SEC-01",
    customer: "PT Maju Terus",
    nomorHP: "081211112222",
    layanan: "Perpanjangan STNK",
    nopol: "B 1234 SEC",
    currentStep: 5,
    currentStageName: "Proses Samsat",
    messenger: "Budi Santoso",
    assignedMessengerName: "Budi Santoso",
    assignedMessengerId: "4",
    documentsVerified: true,
    approvedBySpv: true,
    documentApproval: {
      stage5Verified: true,
      stage6Approved: true,
      approvedDocsSnapshot: [{ id: "DOC-SNAP-1", name: "stnk.pdf" }],
    },
    payment: { totalBiaya: 500000, statusPembayaran: "Lunas" },
  };

  db.prepare(`
    INSERT INTO orders (
      order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name,
      payment_status, total_biaya, is_archived, data_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
  `).run(
    "ORD-SEC-01",
    "PT Maju Terus",
    "081211112222",
    "Perpanjangan STNK",
    "B 1234 SEC",
    5,
    "Proses Samsat",
    "Lunas",
    500000,
    JSON.stringify(order1Data)
  );

  // 2. Order ORD-SEC-02 (Assigned to Kurir Asep) with pre-verified document approval
  const order2Data = {
    orderNo: "ORD-SEC-02",
    customer: "CV Berkah Jaya",
    nomorHP: "081233334444",
    layanan: "Balik Nama",
    nopol: "B 5678 SEC",
    currentStep: 6,
    currentStageName: "Proses Samsat",
    messenger: "Asep Sunandar",
    assignedMessengerName: "Asep Sunandar",
    assignedMessengerId: "5",
    documentsVerified: true,
    approvedBySpv: true,
    documentApproval: {
      stage5Verified: true,
      stage6Approved: true,
      approvedDocsSnapshot: [{ id: "DOC-SNAP-2", name: "bpkb.pdf" }],
    },
    payment: { totalBiaya: 750000, statusPembayaran: "Lunas" },
  };

  db.prepare(`
    INSERT INTO orders (
      order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name,
      payment_status, total_biaya, is_archived, data_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
  `).run(
    "ORD-SEC-02",
    "CV Berkah Jaya",
    "081233334444",
    "Balik Nama",
    "B 5678 SEC",
    6,
    "Proses Samsat",
    "Lunas",
    750000,
    JSON.stringify(order2Data)
  );

  // 3. Order ORD-SEC-03 (Unassigned / Belum Ditugaskan)
  const order3Data = {
    orderNo: "ORD-SEC-03",
    customer: "Budi Perorangan",
    nomorHP: "081255556666",
    layanan: "Ganti Plat 5 Tahunan",
    nopol: "B 9999 SEC",
    currentStep: 2,
    currentStageName: "Penjadwalan",
    messenger: "Belum Ditugaskan",
    assignedMessengerName: "Belum Ditugaskan",
    assignedMessengerId: "-",
    documentsVerified: false,
    payment: { totalBiaya: 600000, statusPembayaran: "Belum Lunas" },
  };

  db.prepare(`
    INSERT INTO orders (
      order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name,
      payment_status, total_biaya, is_archived, data_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
  `).run(
    "ORD-SEC-03",
    "Budi Perorangan",
    "081255556666",
    "Ganti Plat 5 Tahunan",
    "B 9999 SEC",
    2,
    "Penjadwalan",
    "Belum Lunas",
    600000,
    JSON.stringify(order3Data)
  );

  // Invoices: INV-SEC-01 belongs to ORD-SEC-01, INV-SEC-02 belongs to ORD-SEC-02
  db.prepare(`
    INSERT INTO finance_invoices (invoice_no, order_no, customer, layanan, status, total_tagihan, dibayar, sisa, data_json, created_at, updated_at)
    VALUES ('INV-SEC-01', 'ORD-SEC-01', 'PT Maju Terus', 'Perpanjangan STNK', 'PAID', 500000, 500000, 0, '{"invoiceNo":"INV-SEC-01","orderNo":"ORD-SEC-01"}', datetime('now'), datetime('now')),
           ('INV-SEC-02', 'ORD-SEC-02', 'CV Berkah Jaya', 'Balik Nama', 'PAID', 750000, 750000, 0, '{"invoiceNo":"INV-SEC-02","orderNo":"ORD-SEC-02"}', datetime('now'), datetime('now'))
  `).run();
}

test("Document Management Security Suite: All Requirements 1-13", async (t) => {
  seedSecurityTestFixtures();
  const { server, baseUrl } = await startTestServer();

  // Tokens for different roles
  const messengerBudiToken = generateToken({
    id: 4,
    email: "budi@birojasa.com",
    nama: "Budi Santoso",
    jabatan: "messenger",
  });

  const messengerAsepToken = generateToken({
    id: 5,
    email: "asep@birojasa.com",
    nama: "Asep Sunandar",
    jabatan: "messenger",
  });

  const adminToken = generateToken({
    id: 10,
    email: "admin.ops@birojasa.com",
    nama: "Admin Ops",
    jabatan: "admin",
  });

  const financeToken = generateToken({
    id: 2,
    email: "finance@birojasa.com",
    nama: "Finance Siti",
    jabatan: "finance",
  });

  const svpToken = generateToken({
    id: 1,
    email: "svp@birojasa.com",
    nama: "SVP Hendra",
    jabatan: "svp",
  });

  let sharedDocId = "";

  // Upload an initial document linked to ORD-SEC-01 by Admin
  const adminUser = { userId: "10", nama: "Admin Ops", role: "admin", email: "admin.ops@birojasa.com", exp: 9999999999 };
  const messengerBudiUser = { userId: "4", nama: "Budi Santoso", role: "messenger", email: "budi@birojasa.com", exp: 9999999999 };
  const uploadedDoc = await documentService.uploadDocument({
    buffer: SAMPLE_PDF_BUFFER,
    originalName: "berkas_stnk_awal.pdf",
    reportedMime: "application/pdf",
    documentType: "STNK",
    orderNo: "ORD-SEC-01",
    user: adminUser as any,
  });
  sharedDocId = uploadedDoc.id;

  // --- REQUIREMENT 1: Messenger can link document to an order not assigned to them (Business Rule A.1) ---
  await t.test("Req 1: Messenger Budi links document to ORD-SEC-02 (assigned to Asep)", async () => {
    const res = await fetch(`${baseUrl}/api/documents/${sharedDocId}/link-order`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerBudiToken}`,
      },
      body: JSON.stringify({ orderNo: "ORD-SEC-02" }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.success, true);

    const docAfter = dbDocumentRepository.findById(sharedDocId);
    assert.strictEqual(docAfter?.orderNo, "ORD-SEC-02", "Document must be linked to ORD-SEC-02");
  });

  // --- REQUIREMENT 2: Other authenticated roles can link/move documents between orders ---
  await t.test("Req 2: Finance Siti moves document from ORD-SEC-02 back to ORD-SEC-01", async () => {
    const res = await fetch(`${baseUrl}/api/documents/${sharedDocId}/link-order`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${financeToken}`,
      },
      body: JSON.stringify({ orderNo: "ORD-SEC-01" }),
    });

    assert.strictEqual(res.status, 200);
    const docAfter = dbDocumentRepository.findById(sharedDocId);
    assert.strictEqual(docAfter?.orderNo, "ORD-SEC-01");
  });

  // --- REQUIREMENT 3: Non-existent order rejected with 404 ORDER_NOT_FOUND (no DB change) ---
  await t.test("Req 3: Target order not found is rejected with 404 and leaves DB unchanged", async () => {
    const res = await fetch(`${baseUrl}/api/documents/${sharedDocId}/link-order`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerBudiToken}`,
      },
      body: JSON.stringify({ orderNo: "ORD-GHOST-99999" }),
    });

    assert.strictEqual(res.status, 404);
    const body = await res.json() as any;
    assert.strictEqual(body.error?.code, "ORDER_NOT_FOUND");

    const docAfter = dbDocumentRepository.findById(sharedDocId);
    assert.strictEqual(docAfter?.orderNo, "ORD-SEC-01", "Order relation must remain ORD-SEC-01");
  });

  // --- REQUIREMENT 4: Invoice-Order consistency validation on upload and link-order ---
  await t.test("Req 4: Invoice-Order mismatch rejected with 400 INVOICE_ORDER_MISMATCH", async () => {
    // 4a. Upload with mismatched orderNo and invoiceId
    const boundary = "----WebKitFormBoundarySecurityTest123";
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="orderNo"\r\n\r\nORD-SEC-02\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="invoiceId"\r\n\r\nINV-SEC-01\r\n`), // Belongs to ORD-SEC-01!
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="mismatch.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      SAMPLE_PDF_BUFFER,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadRes = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body: multipartBody,
    });

    assert.strictEqual(uploadRes.status, 400);
    const uploadErr = await uploadRes.json() as any;
    assert.strictEqual(uploadErr.error?.code, "INVOICE_ORDER_MISMATCH");

    // 4b. Create a document with invoice_id = INV-SEC-01, then attempt linkOrder to ORD-SEC-02
    const invoiceDoc = await documentService.uploadDocument({
      buffer: SAMPLE_PDF_BUFFER,
      originalName: "bukti_bayar_inv1.pdf",
      reportedMime: "application/pdf",
      documentType: "BUKTI_PEMBAYARAN",
      orderNo: "ORD-SEC-01",
      invoiceId: "INV-SEC-01",
      user: adminUser as any,
    });

    const linkMismatchRes = await fetch(`${baseUrl}/api/documents/${invoiceDoc.id}/link-order`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ orderNo: "ORD-SEC-02" }), // Mismatch: INV-SEC-01 belongs to ORD-SEC-01!
    });

    assert.strictEqual(linkMismatchRes.status, 400);
    const linkErr = await linkMismatchRes.json() as any;
    assert.strictEqual(linkErr.error?.code, "INVOICE_ORDER_MISMATCH");

    const invDocAfter = dbDocumentRepository.findById(invoiceDoc.id);
    assert.strictEqual(invDocAfter?.orderNo, "ORD-SEC-01", "Order relation must not change on mismatch");
    assert.strictEqual(invDocAfter?.invoiceId, "INV-SEC-01", "Invoice relation must not be wiped");
  });

  // --- REQUIREMENT 5: Audit log records DOCUMENT_LINK_UPDATED with actor, timestamp, previous & new relations ---
  await t.test("Req 5: Audit trail records DOCUMENT_LINK_UPDATED with complete metadata", async () => {
    // Move sharedDocId from ORD-SEC-01 to ORD-SEC-02 by Kurir Budi
    const res = await fetch(`${baseUrl}/api/documents/${sharedDocId}/link-order`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerBudiToken}`,
      },
      body: JSON.stringify({ orderNo: "ORD-SEC-02" }),
    });
    assert.strictEqual(res.status, 200);

    const auditLogs = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" });
    assert.ok(auditLogs.length > 0, "Audit log must contain at least one DOCUMENT_LINK_UPDATED entry");
    const latest = auditLogs[0];
    assert.strictEqual(latest.action, "DOCUMENT_LINK_UPDATED");
    assert.strictEqual(latest.module, "Dokumen");
    assert.strictEqual(latest.userName, "Budi Santoso");
    assert.ok(latest.metadata, "Metadata must exist");
    assert.strictEqual(latest.metadata.documentId, sharedDocId);
    assert.strictEqual(latest.metadata.previousOrderNo, "ORD-SEC-01");
    assert.strictEqual(latest.metadata.newOrderNo, "ORD-SEC-02");
    assert.ok(latest.metadata.timestamp, "Timestamp must be present");
  });

  // --- REQUIREMENT 6: Atomic transaction rollback on failure (P1 Remediation Failure Injection) ---
  await t.test("Req 6a: Injected failure in previous order approval invalidation rolls back entire transaction", () => {
    // Reset baseline state: doc is at ORD-SEC-01, both orders have verified approvals
    dbDocumentRepository.linkOrder(sharedDocId, "ORD-SEC-01");
    dbOrderRepository.updateOrder("ORD-SEC-01", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-1" }] },
    } as any);
    dbOrderRepository.updateOrder("ORD-SEC-02", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-2" }] },
    } as any);

    const initialAuditCount = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;

    // Inject failure when updating previous order (ORD-SEC-01)
    const originalUpdateOrder = dbOrderRepository.updateOrder;
    try {
      dbOrderRepository.updateOrder = (orderNo: string, updates: any) => {
        if (orderNo === "ORD-SEC-01") {
          throw new Error("SIMULATED_PREVIOUS_ORDER_INVALIDATION_FAILURE");
        }
        return originalUpdateOrder.call(dbOrderRepository, orderNo, updates);
      };

      assert.throws(
        () => documentService.linkOrder(sharedDocId, "ORD-SEC-02", messengerBudiUser as any),
        /SIMULATED_PREVIOUS_ORDER_INVALIDATION_FAILURE/
      );
    } finally {
      dbOrderRepository.updateOrder = originalUpdateOrder;
    }

    // Verify complete transaction rollback
    const docAfter = dbDocumentRepository.findById(sharedDocId)!;
    assert.strictEqual(docAfter.orderNo, "ORD-SEC-01", "Document orderNo must roll back to ORD-SEC-01");

    const ord1 = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    assert.strictEqual(ord1.documentsVerified, true, "ORD-SEC-01 documentsVerified must roll back to true");
    assert.strictEqual(ord1.approvedBySpv, true, "ORD-SEC-01 approvedBySpv must roll back to true");

    const ord2 = dbOrderRepository.getByOrderNo("ORD-SEC-02")!;
    assert.strictEqual(ord2.documentsVerified, true, "ORD-SEC-02 documentsVerified must remain true");
    assert.strictEqual(ord2.approvedBySpv, true, "ORD-SEC-02 approvedBySpv must remain true");

    const auditCountAfter = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;
    assert.strictEqual(auditCountAfter, initialAuditCount, "Audit log must not be created on rollback");
  });

  await t.test("Req 6b: Injected failure in target order approval invalidation rolls back entire transaction", () => {
    // Reset baseline state: doc is at ORD-SEC-01, both orders have verified approvals
    dbDocumentRepository.linkOrder(sharedDocId, "ORD-SEC-01");
    dbOrderRepository.updateOrder("ORD-SEC-01", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-1" }] },
    } as any);
    dbOrderRepository.updateOrder("ORD-SEC-02", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-2" }] },
    } as any);

    const initialAuditCount = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;

    // Inject failure when updating new target order (ORD-SEC-02)
    const originalUpdateOrder = dbOrderRepository.updateOrder;
    try {
      dbOrderRepository.updateOrder = (orderNo: string, updates: any) => {
        if (orderNo === "ORD-SEC-02") {
          throw new Error("SIMULATED_TARGET_ORDER_INVALIDATION_FAILURE");
        }
        return originalUpdateOrder.call(dbOrderRepository, orderNo, updates);
      };

      assert.throws(
        () => documentService.linkOrder(sharedDocId, "ORD-SEC-02", messengerBudiUser as any),
        /SIMULATED_TARGET_ORDER_INVALIDATION_FAILURE/
      );
    } finally {
      dbOrderRepository.updateOrder = originalUpdateOrder;
    }

    // Verify complete transaction rollback
    const docAfter = dbDocumentRepository.findById(sharedDocId)!;
    assert.strictEqual(docAfter.orderNo, "ORD-SEC-01", "Document orderNo must roll back to ORD-SEC-01");

    const ord1 = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    assert.strictEqual(ord1.documentsVerified, true, "ORD-SEC-01 documentsVerified must roll back to true");
    assert.strictEqual(ord1.approvedBySpv, true, "ORD-SEC-01 approvedBySpv must roll back to true");

    const ord2 = dbOrderRepository.getByOrderNo("ORD-SEC-02")!;
    assert.strictEqual(ord2.documentsVerified, true, "ORD-SEC-02 documentsVerified must remain true");
    assert.strictEqual(ord2.approvedBySpv, true, "ORD-SEC-02 approvedBySpv must remain true");

    const auditCountAfter = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;
    assert.strictEqual(auditCountAfter, initialAuditCount, "Audit log must not be created on rollback");
  });

  await t.test("Req 6c: Injected failure in audit logging rolls back entire transaction", () => {
    // Reset baseline state: doc is at ORD-SEC-01, both orders have verified approvals
    dbDocumentRepository.linkOrder(sharedDocId, "ORD-SEC-01");
    dbOrderRepository.updateOrder("ORD-SEC-01", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-1" }] },
    } as any);
    dbOrderRepository.updateOrder("ORD-SEC-02", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-2" }] },
    } as any);

    const initialAuditCount = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;

    // Inject failure on audit repository save
    const originalSave = dbAuditRepository.save;
    try {
      dbAuditRepository.save = () => {
        throw new Error("SIMULATED_AUDIT_LOG_PERSISTENCE_FAILURE");
      };

      assert.throws(
        () => documentService.linkOrder(sharedDocId, "ORD-SEC-02", messengerBudiUser as any),
        /SIMULATED_AUDIT_LOG_PERSISTENCE_FAILURE/
      );
    } finally {
      dbAuditRepository.save = originalSave;
    }

    // Verify complete transaction rollback
    const docAfter = dbDocumentRepository.findById(sharedDocId)!;
    assert.strictEqual(docAfter.orderNo, "ORD-SEC-01", "Document orderNo must roll back to ORD-SEC-01");

    const ord1 = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    assert.strictEqual(ord1.documentsVerified, true, "ORD-SEC-01 documentsVerified must roll back to true");
    assert.strictEqual(ord1.approvedBySpv, true, "ORD-SEC-01 approvedBySpv must roll back to true");

    const ord2 = dbOrderRepository.getByOrderNo("ORD-SEC-02")!;
    assert.strictEqual(ord2.documentsVerified, true, "ORD-SEC-02 documentsVerified must remain true");
    assert.strictEqual(ord2.approvedBySpv, true, "ORD-SEC-02 approvedBySpv must remain true");

    const auditCountAfter = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;
    assert.strictEqual(auditCountAfter, initialAuditCount, "Audit log count must remain unchanged");
  });

  await t.test("Req 6d: Database update returning false triggers DATABASE_ERROR and rolls back", () => {
    // Reset baseline state: doc is at ORD-SEC-01, both orders have verified approvals
    dbDocumentRepository.linkOrder(sharedDocId, "ORD-SEC-01");
    dbOrderRepository.updateOrder("ORD-SEC-01", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-1" }] },
    } as any);
    dbOrderRepository.updateOrder("ORD-SEC-02", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-2" }] },
    } as any);

    const initialAuditCount = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;

    // Simulate updateOrder returning false for ORD-SEC-02
    const originalUpdateOrder = dbOrderRepository.updateOrder;
    try {
      dbOrderRepository.updateOrder = (orderNo: string, updates: any) => {
        if (orderNo === "ORD-SEC-02") {
          return false;
        }
        return originalUpdateOrder.call(dbOrderRepository, orderNo, updates);
      };

      assert.throws(
        () => documentService.linkOrder(sharedDocId, "ORD-SEC-02", messengerBudiUser as any),
        /Gagal menginvalidasi persetujuan dokumen/
      );
    } finally {
      dbOrderRepository.updateOrder = originalUpdateOrder;
    }

    // Verify complete transaction rollback
    const docAfter = dbDocumentRepository.findById(sharedDocId)!;
    assert.strictEqual(docAfter.orderNo, "ORD-SEC-01", "Document orderNo must roll back to ORD-SEC-01");

    const ord1 = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    assert.strictEqual(ord1.documentsVerified, true, "ORD-SEC-01 documentsVerified must roll back to true");

    const auditCountAfter = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;
    assert.strictEqual(auditCountAfter, initialAuditCount);
  });

  await t.test("Req 6e: Normal execution succeeds with full invalidation and audit logging (Messenger universal link)", () => {
    // Reset baseline state: doc is at ORD-SEC-01, both orders have verified approvals
    dbDocumentRepository.linkOrder(sharedDocId, "ORD-SEC-01");
    dbOrderRepository.updateOrder("ORD-SEC-01", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-1" }] },
    } as any);
    dbOrderRepository.updateOrder("ORD-SEC-02", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "doc-2" }] },
    } as any);

    // Messenger Budi links doc to ORD-SEC-02 (assigned to Asep)
    const result = documentService.linkOrder(sharedDocId, "ORD-SEC-02", messengerBudiUser as any);
    assert.strictEqual(result, true, "linkOrder must return true on success");

    const docAfter = dbDocumentRepository.findById(sharedDocId)!;
    assert.strictEqual(docAfter.orderNo, "ORD-SEC-02", "Document must now be linked to ORD-SEC-02");

    const ord1 = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    assert.strictEqual(ord1.documentsVerified, false, "ORD-SEC-01 documentsVerified must be invalidated to false");
    assert.strictEqual(ord1.approvedBySpv, false, "ORD-SEC-01 approvedBySpv must be invalidated to false");
    assert.strictEqual(ord1.documentApproval?.stage5Verified, false);

    const ord2 = dbOrderRepository.getByOrderNo("ORD-SEC-02")!;
    assert.strictEqual(ord2.documentsVerified, false, "ORD-SEC-02 documentsVerified must be invalidated to false");
    assert.strictEqual(ord2.approvedBySpv, false, "ORD-SEC-02 approvedBySpv must be invalidated to false");
    assert.strictEqual(ord2.documentApproval?.stage5Verified, false);

    const latestAudit = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" })[0];
    assert.strictEqual(latestAudit.metadata?.documentId, sharedDocId);
    assert.strictEqual(latestAudit.metadata?.previousOrderNo, "ORD-SEC-01");
    assert.strictEqual(latestAudit.metadata?.newOrderNo, "ORD-SEC-02");
    assert.strictEqual(latestAudit.metadata?.actorRole, "messenger");
  });

  // --- FINAL REMEDIATION: LINK ORDER IDEMPOTENCY INTEGRATION TESTS ---
  await t.test("Req 6f: Idempotent self-link (ORD-A to ORD-A) leaves approvals and audit logs completely unchanged", async () => {
    // Setup: document is at ORD-SEC-01, ORD-SEC-01 has verified approvals and assigned messenger
    dbDocumentRepository.linkOrder(sharedDocId, "ORD-SEC-01");
    dbOrderRepository.updateOrder("ORD-SEC-01", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: {
        stage5Verified: true,
        stage6Approved: true,
        approvedDocsSnapshot: [{ id: "doc-keep-1", name: "Doc1" }],
      },
      messenger: "Budi Santoso",
    } as any);

    const auditCountBefore = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;

    // 1. Direct Service Call: link ORD-SEC-01 to ORD-SEC-01 (same relation)
    const serviceResult = documentService.linkOrder(sharedDocId, "ORD-SEC-01", messengerBudiUser as any);
    assert.strictEqual(serviceResult, true, "Idempotent service link must return true");

    // 2. HTTP Endpoint Call: PATCH link-order with ORD-SEC-01 (same relation)
    const httpRes = await fetch(`${baseUrl}/api/documents/${sharedDocId}/link-order`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${messengerBudiToken}`,
      },
      body: JSON.stringify({ orderNo: "ORD-SEC-01" }),
    });
    assert.strictEqual(httpRes.status, 200);
    const httpBody = await httpRes.json() as any;
    assert.strictEqual(httpBody.success, true);

    // Verify document relation is still ORD-SEC-01
    const docAfter = dbDocumentRepository.findById(sharedDocId)!;
    assert.strictEqual(docAfter.orderNo, "ORD-SEC-01");

    // Verify ORD-SEC-01 approvals remain 100% intact (NOT wiped out)
    const ord1After = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    assert.strictEqual(ord1After.documentsVerified, true, "documentsVerified must remain true on idempotent link");
    assert.strictEqual(ord1After.approvedBySpv, true, "approvedBySpv must remain true on idempotent link");
    assert.strictEqual(ord1After.documentApproval?.stage5Verified, true, "stage5Verified must remain true");
    assert.strictEqual(ord1After.documentApproval?.stage6Approved, true, "stage6Approved must remain true");
    assert.strictEqual(ord1After.documentApproval?.approvedDocsSnapshot?.length, 1);

    // Verify Messenger assignment is unchanged
    assert.strictEqual(ord1After.messenger, "Budi Santoso");
    assert.strictEqual((ord1After as any).assignedMessengerId, "4");

    // Verify ZERO new audit logs were created
    const auditCountAfter = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;
    assert.strictEqual(auditCountAfter, auditCountBefore, "Zero new audit logs must be recorded for idempotent self-link");
  });

  await t.test("Req 6g: Transition from ORD-A to ORD-B invalidates both approvals and creates exactly one audit log", () => {
    // Setup: document is at ORD-SEC-01, both orders have verified approvals
    dbDocumentRepository.linkOrder(sharedDocId, "ORD-SEC-01");
    dbOrderRepository.updateOrder("ORD-SEC-01", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "x1" }] },
    } as any);
    dbOrderRepository.updateOrder("ORD-SEC-02", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "x2" }] },
    } as any);

    const auditCountBefore = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;

    // Link from ORD-SEC-01 to ORD-SEC-02
    const result = documentService.linkOrder(sharedDocId, "ORD-SEC-02", messengerBudiUser as any);
    assert.strictEqual(result, true);

    const docAfter = dbDocumentRepository.findById(sharedDocId)!;
    assert.strictEqual(docAfter.orderNo, "ORD-SEC-02");

    // Both orders must have approvals invalidated
    const ord1After = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    assert.strictEqual(ord1After.documentsVerified, false);
    assert.strictEqual(ord1After.approvedBySpv, false);
    assert.strictEqual(ord1After.documentApproval?.stage5Verified, false);

    const ord2After = dbOrderRepository.getByOrderNo("ORD-SEC-02")!;
    assert.strictEqual(ord2After.documentsVerified, false);
    assert.strictEqual(ord2After.approvedBySpv, false);
    assert.strictEqual(ord2After.documentApproval?.stage5Verified, false);

    // Exactly one new audit log
    const auditCountAfter = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;
    assert.strictEqual(auditCountAfter, auditCountBefore + 1);

    const latestAudit = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" })[0];
    assert.strictEqual(latestAudit.metadata?.documentId, sharedDocId);
    assert.strictEqual(latestAudit.metadata?.previousOrderNo, "ORD-SEC-01");
    assert.strictEqual(latestAudit.metadata?.newOrderNo, "ORD-SEC-02");
  });

  await t.test("Req 6h: Linking UNLINKED document to ORD-A invalidates target approval and records one audit log", async () => {
    // Create fresh unlinked document
    const unlinkedDoc = await documentService.uploadDocument({
      buffer: SAMPLE_PDF_BUFFER,
      originalName: "unlinked_test_doc.pdf",
      reportedMime: "application/pdf",
      documentType: "KTP",
      user: adminUser as any,
    });
    assert.strictEqual(unlinkedDoc.orderNo, null);

    // Setup ORD-SEC-01 with verified approval
    dbOrderRepository.updateOrder("ORD-SEC-01", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "u1" }] },
    } as any);

    const auditCountBefore = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;

    // Link unlinkedDoc to ORD-SEC-01
    const result = documentService.linkOrder(unlinkedDoc.id, "ORD-SEC-01", messengerBudiUser as any);
    assert.strictEqual(result, true);

    const docAfter = dbDocumentRepository.findById(unlinkedDoc.id)!;
    assert.strictEqual(docAfter.orderNo, "ORD-SEC-01");

    // Target order approval must be invalidated
    const ord1After = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    assert.strictEqual(ord1After.documentsVerified, false);
    assert.strictEqual(ord1After.approvedBySpv, false);
    assert.strictEqual(ord1After.documentApproval?.stage5Verified, false);

    // Exactly one new audit log recorded with previousOrderNo = "UNLINKED"
    const auditCountAfter = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" }).length;
    assert.strictEqual(auditCountAfter, auditCountBefore + 1);

    const latestAudit = dbAuditRepository.getAll({ action: "DOCUMENT_LINK_UPDATED" })[0];
    assert.strictEqual(latestAudit.metadata?.documentId, unlinkedDoc.id);
    assert.strictEqual(latestAudit.metadata?.previousOrderNo, "UNLINKED");
    assert.strictEqual(latestAudit.metadata?.newOrderNo, "ORD-SEC-01");
  });

  // --- REQUIREMENT 7: Approval invalidation on old and new orders ---
  await t.test("Req 7: Both previous and new orders have document approvals invalidated", async () => {
    // Re-verify both orders currently have approval verified
    dbOrderRepository.updateOrder("ORD-SEC-01", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "x" }] },
    } as any);

    dbOrderRepository.updateOrder("ORD-SEC-02", {
      documentsVerified: true,
      approvedBySpv: true,
      documentApproval: { stage5Verified: true, stage6Approved: true, approvedDocsSnapshot: [{ id: "y" }] },
    } as any);

    // Now move sharedDocId from ORD-SEC-02 back to ORD-SEC-01
    const res = await fetch(`${baseUrl}/api/documents/${sharedDocId}/link-order`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${svpToken}`,
      },
      body: JSON.stringify({ orderNo: "ORD-SEC-01" }),
    });
    assert.strictEqual(res.status, 200);

    const ord1 = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    const ord2 = dbOrderRepository.getByOrderNo("ORD-SEC-02")!;

    // Both orders must have their approval flags invalidated
    assert.strictEqual(ord1.documentsVerified, false, "ORD-SEC-01 documentsVerified must be false");
    assert.strictEqual(ord1.approvedBySpv, false, "ORD-SEC-01 approvedBySpv must be false");
    assert.strictEqual(ord1.documentApproval?.stage5Verified, false, "ORD-SEC-01 stage5Verified must be false");

    assert.strictEqual(ord2.documentsVerified, false, "ORD-SEC-02 documentsVerified must be false");
    assert.strictEqual(ord2.approvedBySpv, false, "ORD-SEC-02 approvedBySpv must be false");
    assert.strictEqual(ord2.documentApproval?.stage5Verified, false, "ORD-SEC-02 stage5Verified must be false");
  });

  // --- REQUIREMENT 8: Messenger assignment on orders unchanged ---
  await t.test("Req 8: Messenger assignment fields on orders are strictly preserved", () => {
    const ord1 = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    const ord2 = dbOrderRepository.getByOrderNo("ORD-SEC-02")!;

    assert.strictEqual(ord1.messenger, "Budi Santoso", "ORD-SEC-01 messenger must remain Budi Santoso");
    assert.strictEqual((ord1 as any).assignedMessengerId, "4", "ORD-SEC-01 assignedMessengerId must remain 4");

    assert.strictEqual(ord2.messenger, "Asep Sunandar", "ORD-SEC-02 messenger must remain Asep Sunandar");
    assert.strictEqual((ord2 as any).assignedMessengerId, "5", "ORD-SEC-02 assignedMessengerId must remain 5");
  });

  // --- REQUIREMENTS 9 & 10: Messenger Dashboard Task Derivation Integrity ---
  await t.test("Req 9 & 10: Assigned and unassigned task lists are derived correctly without regression", () => {
    const ord1 = dbOrderRepository.getByOrderNo("ORD-SEC-01")!;
    const ord2 = dbOrderRepository.getByOrderNo("ORD-SEC-02")!;
    const ord3 = dbOrderRepository.getByOrderNo("ORD-SEC-03")!;

    const activeOrdersRecord: Record<StageName, OperationalOrder[]> = {
      "Verifikasi & Validasi": [],
      "Penjadwalan": [ord3],
      "Pengambilan Dokumen": [],
      "Verifikasi Fisik": [],
      "Proses Samsat": [ord1, ord2],
      "Pembayaran Kas": [],
      "Pengantaran": [],
      "Dokumen Telah Diterima": [],
      "Selesai": [],
    };

    // 9. Assigned tasks: ORD-SEC-01 (Budi) and ORD-SEC-02 (Asep)
    const assignedTasks = deriveAssignedMessengerTasks(activeOrdersRecord);
    const assignedOrderNos = assignedTasks.map((t) => t.orderNo);
    assert.ok(assignedOrderNos.includes("ORD-SEC-01"), "ORD-SEC-01 must be in assigned tasks");
    assert.ok(assignedOrderNos.includes("ORD-SEC-02"), "ORD-SEC-02 must be in assigned tasks");
    assert.ok(!assignedOrderNos.includes("ORD-SEC-03"), "ORD-SEC-03 must NOT be in assigned tasks");

    // 10. Available / Unassigned tasks: ORD-SEC-03 only
    const unassignedTasks = getAvailableUnassignedTasks(activeOrdersRecord);
    const unassignedOrderNos = unassignedTasks.map((t) => t.orderNo);
    assert.ok(unassignedOrderNos.includes("ORD-SEC-03"), "ORD-SEC-03 must be in available unassigned tasks");
    assert.ok(!unassignedOrderNos.includes("ORD-SEC-01"), "ORD-SEC-01 must NOT be in unassigned tasks");
    assert.ok(!unassignedOrderNos.includes("ORD-SEC-02"), "ORD-SEC-02 must NOT be in unassigned tasks");
  });

  // --- REQUIREMENT 11: Consistent JWT and Access Ticket Authorization Decisions ---
  await t.test("Req 11: JWT and Access Ticket provide identical, consistent authorization decisions", async () => {
    // 11a. Operational order doc (sharedDocId is currently on ORD-SEC-01, assigned to Budi)
    // Assigned messenger Budi -> Allowed via direct JWT
    const directJwtAllowed = await fetch(`${baseUrl}/api/documents/${sharedDocId}`, {
      headers: { Authorization: `Bearer ${messengerBudiToken}` },
    });
    assert.strictEqual(directJwtAllowed.status, 200);

    // Assigned messenger Budi -> Allowed to issue preview ticket
    const ticketAllowed = await fetch(`${baseUrl}/api/documents/${sharedDocId}/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${messengerBudiToken}` },
      body: JSON.stringify({ operation: "preview" }),
    });
    assert.strictEqual(ticketAllowed.status, 201);
    const { data: ticketData } = await ticketAllowed.json() as any;

    // Ticket consumption for preview -> Allowed (200)
    const previewViaTicket = await fetch(`${baseUrl}/api/documents/${sharedDocId}/preview?ticket=${ticketData.ticket}`);
    assert.strictEqual(previewViaTicket.status, 200);

    // 11b. Unassigned messenger Asep -> Denied via direct JWT (403)
    const directJwtDenied = await fetch(`${baseUrl}/api/documents/${sharedDocId}`, {
      headers: { Authorization: `Bearer ${messengerAsepToken}` },
    });
    assert.strictEqual(directJwtDenied.status, 403);

    // Unassigned messenger Asep -> Denied ticket issuance (403)
    const ticketDenied = await fetch(`${baseUrl}/api/documents/${sharedDocId}/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${messengerAsepToken}` },
      body: JSON.stringify({ operation: "preview" }),
    });
    assert.strictEqual(ticketDenied.status, 403);

    // 11c. Single-use download ticket consumption
    const downloadTicketRes = await fetch(`${baseUrl}/api/documents/${sharedDocId}/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${messengerBudiToken}` },
      body: JSON.stringify({ operation: "download" }),
    });
    assert.strictEqual(downloadTicketRes.status, 201);
    const { data: dlTicketData } = await downloadTicketRes.json() as any;

    // First use: 200 OK
    const firstDownload = await fetch(`${baseUrl}/api/documents/${sharedDocId}/download?ticket=${dlTicketData.ticket}`);
    assert.strictEqual(firstDownload.status, 200);

    // Replay attempt: 401 UNAUTHENTICATED
    const replayDownload = await fetch(`${baseUrl}/api/documents/${sharedDocId}/download?ticket=${dlTicketData.ticket}`);
    assert.strictEqual(replayDownload.status, 401);
  });

  // --- REQUIREMENT 12: Referrer-Policy: no-referrer on preview and download ---
  await t.test("Req 12: Referrer-Policy: no-referrer is present on both preview and download responses", async () => {
    // Generate fresh preview ticket
    const pTicketRes = await fetch(`${baseUrl}/api/documents/${sharedDocId}/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${svpToken}` },
      body: JSON.stringify({ operation: "preview" }),
    });
    const { data: pTicket } = await pTicketRes.json() as any;

    const previewRes = await fetch(`${baseUrl}/api/documents/${sharedDocId}/preview?ticket=${pTicket.ticket}`);
    assert.strictEqual(previewRes.status, 200);
    assert.strictEqual(
      previewRes.headers.get("referrer-policy"),
      "no-referrer",
      "Preview must have Referrer-Policy: no-referrer"
    );
    assert.strictEqual(previewRes.headers.get("x-content-type-options"), "nosniff");

    // Generate fresh download ticket
    const dlTicketRes = await fetch(`${baseUrl}/api/documents/${sharedDocId}/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${svpToken}` },
      body: JSON.stringify({ operation: "download" }),
    });
    const { data: dlTicket } = await dlTicketRes.json() as any;

    const downloadRes = await fetch(`${baseUrl}/api/documents/${sharedDocId}/download?ticket=${dlTicket.ticket}`);
    assert.strictEqual(downloadRes.status, 200);
    assert.strictEqual(
      downloadRes.headers.get("referrer-policy"),
      "no-referrer",
      "Download must have Referrer-Policy: no-referrer"
    );
    assert.strictEqual(downloadRes.headers.get("x-content-type-options"), "nosniff");
  });

  // --- REQUIREMENT 13: Failed upload validation does NOT leave orphan files in storage ---
  await t.test("Req 13: Failed upload validation leaves zero orphan files in storage directory", async () => {
    const uploadDir = CONFIG.UPLOAD_DIR;
    const initialFiles = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];

    // Attempt upload with non-existent order
    const boundary = "----WebKitFormBoundaryOrphanTest456";
    const invalidBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="orderNo"\r\n\r\nORD-GHOST-NONEXISTENT\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="orphan_test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      SAMPLE_PDF_BUFFER,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body: invalidBody,
    });

    assert.strictEqual(res.status, 404);
    const filesAfter = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    assert.strictEqual(filesAfter.length, initialFiles.length, "No new files should exist in storage directory");
  });

  // Cleanup
  server.close();
});
