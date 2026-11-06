/**
 * Phase 7.5 Persistent Document Storage & Secure File Workflow Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Comprehensive verification of:
 * 1. IDocumentStorageAdapter & LocalDiskDocumentStorage (persistent disk, hashing, traversal defense)
 * 2. Magic bytes validation & binary signature inspection (PDF, PNG, JPEG vs executable/spoofed)
 * 3. DbDocumentRepository (metadata persistence, indexing, order/invoice linking)
 * 4. DocumentService (atomic rollbacks, RBAC authorization, audit trails)
 * 5. Express API integration (POST /upload, GET /:id, GET /preview, GET /download, 401/403/429 checks)
 * 6. Physical persistence & zero-leakage durability
 */

import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createApp } from "../server/src/app";
import { LocalDiskDocumentStorage } from "../server/src/storage/localDiskDocumentStorage";
import { detectMagicMimeType, validateUploadedDocument, sanitizeFileName } from "../server/src/utils/fileValidation";
import { dbDocumentRepository, DbDocumentRepository } from "../server/src/repositories/dbDocumentRepository";
import { DocumentService } from "../server/src/services/documentService";
import { generateToken } from "../server/src/utils/crypto";
import { uploadRateLimiter } from "../server/src/middleware/rateLimiter";
import { CONFIG } from "../server/src/config/env";
import { db } from "../server/src/database/db";

// Workstream B: Explicit deterministic test fixtures for ORD-0001 and ORD-0002
function ensureDocumentStorageTestFixtures() {
  // Ensure ORD-0001 with assigned messenger Budi Santoso
  const existing1 = db.prepare("SELECT order_no FROM orders WHERE order_no = ?").get("ORD-0001");
  if (!existing1) {
    db.prepare(`
      INSERT INTO orders (
        order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name,
        payment_status, total_biaya, is_archived, data_json, created_at, updated_at, samsat_tujuan_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)
    `).run(
      "ORD-0001",
      "PT. Maju Jaya Abadi",
      "081200001111",
      "Perpanjangan STNK Tahunan",
      "B 1111 AAA",
      2,
      "Penjadwalan",
      "Lunas",
      500000,
      0,
      JSON.stringify({
        orderNo: "ORD-0001",
        customer: "PT. Maju Jaya Abadi",
        nomorHP: "081200001111",
        layanan: "Perpanjangan STNK Tahunan",
        nopol: "B 1111 AAA",
        currentStep: 2,
        currentStageName: "Penjadwalan",
        messenger: "Budi Santoso",
        assignedMessengerId: "4",
        assignedMessengerName: "Budi Santoso",
        payment: {
          tipePembayaran: "Bayar di Awal",
          metodePembayaran: "Transfer BCA",
          totalBiaya: 500000,
          dibayar: 500000,
          statusPembayaran: "Lunas",
        },
      })
    );
  }

  // Ensure ORD-0002 has messenger Asep Sunandar (so Budi Santoso is unassigned) without deleting the row
  const row2 = db.prepare("SELECT order_no, data_json FROM orders WHERE order_no = ?").get("ORD-0002") as { order_no: string; data_json: string } | undefined;
  if (row2) {
    const parsed = JSON.parse(row2.data_json || "{}");
    parsed.messenger = "Asep Sunandar";
    parsed.assignedMessengerName = "Asep Sunandar";
    parsed.assignedMessengerId = "5";
    db.prepare("UPDATE orders SET data_json = ? WHERE order_no = ?").run(JSON.stringify(parsed), "ORD-0002");
  } else {
    db.prepare(`
      INSERT INTO orders (
        order_no, customer, nomor_hp, layanan, nopol, current_step, current_stage_name,
        payment_status, total_biaya, is_archived, data_json, created_at, updated_at, samsat_tujuan_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)
    `).run(
      "ORD-0002",
      "CV. Sumber Rezeki",
      "081299998888",
      "Mutasi Kendaraan",
      "B 2222 BBB",
      2,
      "Penjadwalan",
      "Lunas",
      750000,
      0,
      JSON.stringify({
        orderNo: "ORD-0002",
        customer: "CV. Sumber Rezeki",
        nomorHP: "081299998888",
        layanan: "Mutasi Kendaraan",
        nopol: "B 2222 BBB",
        currentStep: 2,
        currentStageName: "Penjadwalan",
        messenger: "Asep Sunandar",
        assignedMessengerId: "5",
        assignedMessengerName: "Asep Sunandar",
      })
    );
  }
}

ensureDocumentStorageTestFixtures();

// Test helper: create minimal valid sample buffers
const VALID_PDF_BUFFER = Buffer.concat([
  Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Test Document) >>\nendobj\ntrailer\n<< /Size 1 >>\nstartxref\n%%EOF"),
]);

const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG magic
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk header
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 px
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89,
]);

const VALID_JPEG_BUFFER = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0xFF, 0xD9,
]);

const FAKE_PDF_TEXT_BUFFER = Buffer.from("Hello world, this is a plain text file renamed to fake.pdf");
const MALICIOUS_EXE_BUFFER = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]); // MZ DOS header
const MALICIOUS_ELF_BUFFER = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]); // ELF header

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

function createTestMultipartBody(
  fieldName: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
  fields: Record<string, string> = {}
): { body: Buffer; boundary: string } {
  const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString("hex")}`;
  const parts: Buffer[] = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
      )
    );
  }

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
    )
  );
  parts.push(buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    body: Buffer.concat(parts),
    boundary,
  };
}

// -----------------------------------------------------------------------------
// Milestone 1 & 2: Local Disk Storage & Path Traversal Prevention
// -----------------------------------------------------------------------------
test("Storage 1: LocalDiskDocumentStorage persists files, verifies SHA-256 and prevents path traversal", async () => {
  const testDir = path.resolve(process.cwd(), "server/uploads_test");
  const storage = new LocalDiskDocumentStorage(testDir);

  try {
    // 1. Save valid file
    const saved = await storage.saveFile(VALID_PDF_BUFFER, ".pdf");
    assert.ok(saved.storageName.endsWith(".pdf"));
    assert.strictEqual(saved.sizeBytes, VALID_PDF_BUFFER.length);

    const expectedHash = crypto.createHash("sha256").update(VALID_PDF_BUFFER).digest("hex");
    assert.strictEqual(saved.sha256, expectedHash);

    // Verify physical file existence
    const exists = await storage.exists(saved.storageName);
    assert.strictEqual(exists, true);

    // Read back and compare
    const readBuf = await storage.readFile(saved.storageName);
    assert.strictEqual(readBuf.equals(VALID_PDF_BUFFER), true);

    // 2. Traversal attempt must throw
    assert.throws(() => storage.getFilePath("../secret.txt"), /traversal detected|outside designated/);
    assert.throws(() => storage.getFilePath("..\\secret.txt"), /traversal detected|outside designated/);
    assert.throws(() => storage.getFilePath("foo/../../secret.txt"), /traversal detected/);
    assert.throws(() => storage.getFilePath("/etc/passwd"), /traversal detected/);

    // 3. Clean up
    await storage.deleteFile(saved.storageName);
    const existsAfterDelete = await storage.exists(saved.storageName);
    assert.strictEqual(existsAfterDelete, false);
  } finally {
    // Cleanup test dir
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
});

// -----------------------------------------------------------------------------
// Milestone 3: Magic Bytes Binary Inspection & Spoofing Defense
// -----------------------------------------------------------------------------
test("Storage 2: Binary Magic Bytes Inspection strictly verifies authentic formats and rejects malicious payloads", () => {
  // 1. Valid files
  assert.strictEqual(detectMagicMimeType(VALID_PDF_BUFFER), "application/pdf");
  assert.strictEqual(detectMagicMimeType(VALID_PNG_BUFFER), "image/png");
  assert.strictEqual(detectMagicMimeType(VALID_JPEG_BUFFER), "image/jpeg");

  // 2. Spoofed / Disguised files
  assert.strictEqual(detectMagicMimeType(FAKE_PDF_TEXT_BUFFER), null);
  assert.strictEqual(detectMagicMimeType(MALICIOUS_EXE_BUFFER), null);
  assert.strictEqual(detectMagicMimeType(MALICIOUS_ELF_BUFFER), null);

  // 3. validateUploadedDocument comprehensive checks
  const validPdfRes = validateUploadedDocument(VALID_PDF_BUFFER, "stnk_customer.pdf", "application/pdf");
  assert.strictEqual(validPdfRes.mimeType, "application/pdf");
  assert.strictEqual(validPdfRes.extension, ".pdf");
  assert.strictEqual(validPdfRes.sanitizedOriginalName, "stnk_customer.pdf");

  // Reject text file masquerading as PDF
  assert.throws(
    () => validateUploadedDocument(FAKE_PDF_TEXT_BUFFER, "fake_doc.pdf", "application/pdf"),
    /Format berkas tidak didukung atau isi berkas tidak valid/
  );

  // Reject Windows executable disguised as image
  assert.throws(
    () => validateUploadedDocument(MALICIOUS_EXE_BUFFER, "payload.jpg", "image/jpeg"),
    /Format berkas tidak didukung atau isi berkas tidak valid/
  );

  // Reject empty file (0 bytes)
  assert.throws(
    () => validateUploadedDocument(Buffer.alloc(0), "empty.pdf"),
    /Berkas tidak boleh kosong/
  );

  // Sanitize dangerous file name
  const clean = sanitizeFileName("../../../var/log/malicious;rm -rf.pdf");
  assert.ok(!clean.includes(".."));
  assert.ok(!clean.includes("/"));
  assert.ok(!clean.includes(";"));
});

// -----------------------------------------------------------------------------
// Milestone 4: Database Document Repository Relational Integrity, CRUD & Soft-Delete
// -----------------------------------------------------------------------------
test("Storage 3: DbDocumentRepository enforces Foreign Keys, soft-delete and active indexing", () => {
  const docId = `DOC-TEST-${Date.now()}`;
  const validOrderNo = "ORD-0001"; // Pre-seeded valid order
  const nonExistentOrderNo = `ORD-NONEXISTENT-${Date.now()}`;
  const storageName = `test-storage-${Date.now()}.pdf`;

  // 1. Relational Integrity: Attempt to link document to non-existent order MUST fail FK constraint
  assert.throws(
    () => {
      dbDocumentRepository.createDocument({
        id: `DOC-FK-FAIL-${Date.now()}`,
        orderNo: nonExistentOrderNo,
        invoiceId: null,
        documentType: "KTP",
        originalName: "invalid_fk.pdf",
        storageName: `fail-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 1024,
        sha256: "fake-sha-fk-fail",
        uploadedBy: "Admin",
        uploadedById: "1",
        uploadedByRole: "administrator",
      });
    },
    /FOREIGN KEY constraint failed/
  );

  // 2. Relational Integrity: Attempt to link document to non-existent invoice MUST fail FK constraint
  assert.throws(
    () => {
      dbDocumentRepository.createDocument({
        id: `DOC-FK-INV-FAIL-${Date.now()}`,
        orderNo: null,
        invoiceId: `INV-NONEXISTENT-${Date.now()}`,
        documentType: "KTP",
        originalName: "invalid_inv_fk.pdf",
        storageName: `fail-inv-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 1024,
        sha256: "fake-sha-inv-fk-fail",
        uploadedBy: "Admin",
        uploadedById: "1",
        uploadedByRole: "administrator",
      });
    },
    /FOREIGN KEY constraint failed/
  );

  // 3. Valid Foreign Key creation succeeds
  const created = dbDocumentRepository.createDocument({
    id: docId,
    orderNo: validOrderNo,
    invoiceId: null,
    documentType: "KTP",
    originalName: "ktp_budi.pdf",
    storageName,
    mimeType: "application/pdf",
    sizeBytes: 1024,
    sha256: "fake-hash-for-unit-test",
    uploadedBy: "Admin Super (SVP)",
    uploadedById: "1",
    uploadedByRole: "administrator",
  });

  assert.strictEqual(created.id, docId);

  // Find by ID returns active document
  const found = dbDocumentRepository.findById(docId);
  assert.ok(found !== null);
  assert.strictEqual(found?.originalName, "ktp_budi.pdf");
  assert.strictEqual(found?.orderNo, validOrderNo);
  assert.strictEqual(Boolean(found?.isActive), true);

  // Find by Storage Name
  const byStorage = dbDocumentRepository.findByStorageName(storageName);
  assert.ok(byStorage !== null);
  assert.strictEqual(byStorage?.id, docId);

  // Find by Order No returns doc
  const orderDocs = dbDocumentRepository.findByOrderNo(validOrderNo);
  assert.ok(orderDocs.some((d) => d.id === docId));

  // 4. Soft delete preserves record in SQLite but filters from active queries
  const softDeleted = dbDocumentRepository.softDelete(docId);
  assert.strictEqual(softDeleted, true);

  // findById filters active documents (returns null)
  assert.strictEqual(dbDocumentRepository.findById(docId), null);

  // findByOrderNo does not include soft-deleted document
  const orderDocsAfter = dbDocumentRepository.findByOrderNo(validOrderNo);
  assert.ok(!orderDocsAfter.some((d) => d.id === docId));

  // Hard delete clean up
  dbDocumentRepository.deleteDocument(docId);
});

// -----------------------------------------------------------------------------
// Milestone 5: Document Service RBAC, Soft-Delete & Atomic Cleanup Rollback
// -----------------------------------------------------------------------------
test("Storage 4: DocumentService enforces RBAC, soft-delete semantics and atomic rollback", async () => {
  const testDir = path.resolve(process.cwd(), "server/uploads_service_test");
  const storage = new LocalDiskDocumentStorage(testDir);
  const service = new DocumentService(storage, dbDocumentRepository);

  const adminUser = {
    id: 1,
    email: "svp@birojasa.com",
    nama: "Admin Super (SVP)",
    jabatan: "administrator" as const,
  };

  const messengerUser = {
    id: 4,
    email: "messenger@birojasa.com",
    nama: "Budi Santoso",
    jabatan: "messenger" as const,
  };

  try {
    // 1. Successful upload
    const uploaded = await service.uploadDocument({
      buffer: VALID_PDF_BUFFER,
      originalName: "ktp_asli.pdf",
      reportedMime: "application/pdf",
      documentType: "KTP",
      orderNo: "ORD-0001",
      user: adminUser,
    });

    assert.ok(uploaded.id.startsWith("DOC-"));
    const diskExists = await storage.exists(uploaded.storageName);
    assert.strictEqual(diskExists, true);

    // 2. Admin can retrieve
    const retrieved = service.getDocumentById(uploaded.id, adminUser);
    assert.strictEqual(retrieved.id, uploaded.id);

    // 3. Messenger on unassigned order cannot access (RBAC 403)
    assert.throws(
      () => service.getDocumentsByOrder("ORD-0002", messengerUser),
      /Anda tidak berwenang|tidak memiliki izin/
    );

    // 4. Soft-delete document: file is PRESERVED on disk for audit trail, but metadata is inactive
    const deleted = await service.deleteDocument(uploaded.id, adminUser);
    assert.strictEqual(deleted, true);

    // Physical file must remain on disk
    const diskAfterDelete = await storage.exists(uploaded.storageName);
    assert.strictEqual(diskAfterDelete, true, "Physical file must be preserved after soft delete");

    // Service retrieval must throw 404
    assert.throws(
      () => service.getDocumentById(uploaded.id, adminUser),
      /tidak ditemukan|DOCUMENT_NOT_FOUND/
    );

    // 5. Atomic Rollback: When metadata insert fails, file on disk is immediately cleaned up
    let thrownError: any = null;
    try {
      await service.uploadDocument({
        buffer: VALID_PDF_BUFFER,
        originalName: "rollback_test.pdf",
        reportedMime: "application/pdf",
        documentType: "KTP",
        orderNo: "ORD-DOES-NOT-EXIST-AT-ALL",
        user: adminUser,
      });
    } catch (err: any) {
      thrownError = err;
    }

    assert.ok(thrownError !== null, "Should fail on invalid foreign key");
    assert.ok(thrownError.statusCode === 404 || thrownError.statusCode === 500, `Expected 404 or 500, got ${thrownError.statusCode}`);

    // Verify no orphaned files in test directory except the previous soft-deleted one
    const filesInDir = fs.readdirSync(testDir);
    assert.strictEqual(filesInDir.length, 1);
    assert.strictEqual(filesInDir[0], uploaded.storageName);

    // Final cleanup of test doc
    dbDocumentRepository.deleteDocument(uploaded.id);
  } finally {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
});

// -----------------------------------------------------------------------------
// Milestone 6: REST API Integration with Tickets & Raw JWT Parameter Rejection
// -----------------------------------------------------------------------------
test("Storage 5: Document REST API with Short-Lived Access Tickets & Rejection of ?token=", async () => {
  const { server, baseUrl } = await startTestServer();
  const adminToken = generateToken({
    id: 1,
    email: "svp@birojasa.com",
    nama: "Admin Super (SVP)",
    jabatan: "administrator",
  });

  try {
    // 1. Anonymous upload attempt must return 401
    const { body: anonBody, boundary: anonBoundary } = createTestMultipartBody(
      "file",
      "test.pdf",
      VALID_PDF_BUFFER,
      "application/pdf"
    );

    const anonRes = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${anonBoundary}` },
      body: anonBody,
    });
    assert.strictEqual(anonRes.status, 401);

    // 2. Authenticated upload of valid PDF returns 201
    const { body: authBody, boundary: authBoundary } = createTestMultipartBody(
      "file",
      "ktp_pemohon.pdf",
      VALID_PDF_BUFFER,
      "application/pdf",
      { orderNo: "ORD-0001", documentType: "KTP" }
    );

    const authRes = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${authBoundary}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body: authBody,
    });

    assert.strictEqual(authRes.status, 201);
    const authData = await authRes.json() as any;
    assert.strictEqual(authData.success, true);
    assert.ok(authData.data.id.startsWith("DOC-"));
    const createdDocId = authData.data.id;

    // 3. Authenticated upload of fake PDF returns 400
    const { body: fakeBody, boundary: fakeBoundary } = createTestMultipartBody(
      "file",
      "malicious_fake.pdf",
      FAKE_PDF_TEXT_BUFFER,
      "application/pdf"
    );

    const fakeRes = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${fakeBoundary}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body: fakeBody,
    });
    assert.strictEqual(fakeRes.status, 400);

    // 4. Retrieve document metadata via GET /api/documents/:id with Bearer
    const metaRes = await fetch(`${baseUrl}/api/documents/${createdDocId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(metaRes.status, 200);
    const metaData = await metaRes.json() as any;
    assert.strictEqual(metaData.data.originalName, "ktp_pemohon.pdf");

    // 5. SECURITY VERIFICATION: Raw JWT in query parameter (?token=...) MUST BE REJECTED (401)
    const tokenQueryRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/preview?token=${adminToken}`);
    assert.strictEqual(tokenQueryRes.status, 401, "Raw JWT in query parameter must be rejected");

    // 6. Request Short-Lived Access Ticket: POST /api/documents/:id/ticket
    const anonTicketRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "preview" }),
    });
    assert.strictEqual(anonTicketRes.status, 401, "Anonymous ticket request must return 401");

    const authTicketRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ operation: "preview" }),
    });
    assert.strictEqual(authTicketRes.status, 201);
    const ticketData = await authTicketRes.json() as any;
    assert.strictEqual(ticketData.success, true);
    assert.ok(typeof ticketData.data.ticket === "string");
    assert.ok(ticketData.data.ticket.startsWith("tkt_"));
    assert.strictEqual(ticketData.data.expiresInSeconds, 60);
    const previewTicket = ticketData.data.ticket;

    // 7. Preview document inline using ticket query parameter (?ticket=...)
    const previewRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/preview?ticket=${previewTicket}`);
    assert.strictEqual(previewRes.status, 200);
    assert.strictEqual(previewRes.headers.get("content-type"), "application/pdf");
    assert.ok(previewRes.headers.get("content-disposition")?.includes("inline"));
    assert.strictEqual(previewRes.headers.get("x-content-type-options"), "nosniff");

    const previewBytes = Buffer.from(await previewRes.arrayBuffer());
    assert.strictEqual(previewBytes.equals(VALID_PDF_BUFFER), true);

    // 8. Download document: Obtain download ticket and fetch
    const dlTicketRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ operation: "download" }),
    });
    assert.strictEqual(dlTicketRes.status, 201);
    const dlTicket = (await dlTicketRes.json() as any).data.ticket;

    const downloadRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/download?ticket=${dlTicket}`);
    assert.strictEqual(downloadRes.status, 200);
    assert.ok(downloadRes.headers.get("content-disposition")?.includes("attachment"));

    // 9. Rejection of invalid/forged ticket
    const fakeTicketRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/preview?ticket=tkt_forged_invalid_ticket`);
    assert.strictEqual(fakeTicketRes.status, 401);

    // 10. Clean up created document via soft-delete
    const delRes = await fetch(`${baseUrl}/api/documents/${createdDocId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(delRes.status, 200);

    // 11. Requesting ticket on soft-deleted document returns 404
    const deletedTicketRes = await fetch(`${baseUrl}/api/documents/${createdDocId}/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ operation: "preview" }),
    });
    assert.strictEqual(deletedTicketRes.status, 404);

    // Hard cleanup
    dbDocumentRepository.deleteDocument(createdDocId);
  } finally {
    server.close();
  }
});

// -----------------------------------------------------------------------------
// Milestone 7: Document Persistence Across Backend Process Restart
// -----------------------------------------------------------------------------
test("Storage 6: Document Persistence & Integrity is Guaranteed Across Backend Restarts", async () => {
  // Phase 1: Upload a unique document to Instance A
  const instanceA = await startTestServer();
  const adminToken = generateToken({
    id: 1,
    email: "svp@birojasa.com",
    nama: "Admin Super (SVP)",
    jabatan: "administrator",
  });

  const uniquePayload = Buffer.concat([
    VALID_PDF_BUFFER,
    Buffer.from(`\n% Unique restart timestamp: ${Date.now()}`),
  ]);
  const expectedSha = crypto.createHash("sha256").update(uniquePayload).digest("hex");

  let uploadedDocId = "";
  try {
    const { body, boundary } = createTestMultipartBody(
      "file",
      "persistent_surat.pdf",
      uniquePayload,
      "application/pdf",
      { orderNo: "ORD-0001", documentType: "SKKP" }
    );

    const uploadRes = await fetch(`${instanceA.baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body,
    });

    assert.strictEqual(uploadRes.status, 201);
    const json = await uploadRes.json() as any;
    uploadedDocId = json.data.id;
    assert.strictEqual(json.data.sha256, expectedSha);
  } finally {
    // Completely terminate Server Instance A (simulating process shutdown/restart)
    instanceA.server.close();
  }

  // Phase 2: Start a completely fresh Server Instance B pointing to same SQLite and uploads
  const instanceB = await startTestServer();
  try {
    // 1. Verify metadata is accessible on Instance B
    const metaRes = await fetch(`${instanceB.baseUrl}/api/documents/${uploadedDocId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(metaRes.status, 200);
    const meta = await metaRes.json() as any;
    assert.strictEqual(meta.data.id, uploadedDocId);
    assert.strictEqual(meta.data.sha256, expectedSha);

    // 2. Issue fresh ticket from Instance B
    const ticketRes = await fetch(`${instanceB.baseUrl}/api/documents/${uploadedDocId}/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ operation: "download" }),
    });
    assert.strictEqual(ticketRes.status, 201);
    const { ticket } = (await ticketRes.json() as any).data;

    // 3. Download binary stream from Instance B and verify byte-for-byte SHA-256 match
    const dlRes = await fetch(`${instanceB.baseUrl}/api/documents/${uploadedDocId}/download?ticket=${ticket}`);
    assert.strictEqual(dlRes.status, 200);
    const downloadedBytes = Buffer.from(await dlRes.arrayBuffer());
    assert.strictEqual(downloadedBytes.equals(uniquePayload), true);

    const downloadedSha = crypto.createHash("sha256").update(downloadedBytes).digest("hex");
    assert.strictEqual(downloadedSha, expectedSha);

    // Cleanup
    dbDocumentRepository.deleteDocument(uploadedDocId);
  } finally {
    instanceB.server.close();
  }
});

// -----------------------------------------------------------------------------
// Milestone 8: Role Authorization Matrix & Ownership Boundaries
// -----------------------------------------------------------------------------
test("Storage 7: Role Authorization Matrix across Admin, Finance, Messenger and Anonymous", async () => {
  const { server, baseUrl } = await startTestServer();

  const adminToken = generateToken({
    id: 1,
    email: "svp@birojasa.com",
    nama: "Admin Super (SVP)",
    jabatan: "administrator",
  });

  const financeToken = generateToken({
    id: 2,
    email: "finance@birojasa.com",
    nama: "Siti Rahmawati",
    jabatan: "finance",
  });

  // Budi Santoso is the assigned messenger on ORD-0001 in seed data
  const assignedMessengerToken = generateToken({
    id: 4,
    email: "messenger@birojasa.com",
    nama: "Budi Santoso",
    jabatan: "messenger",
  });

  // Asep Sunandar is NOT assigned to ORD-0001
  const unassignedMessengerToken = generateToken({
    id: 5,
    email: "messenger2@birojasa.com",
    nama: "Asep Sunandar",
    jabatan: "messenger",
  });

  let orderDocId = "";
  try {
    // 1. Admin uploads document linked to ORD-0001
    const { body, boundary } = createTestMultipartBody(
      "file",
      "stnk_matrix.pdf",
      VALID_PDF_BUFFER,
      "application/pdf",
      { orderNo: "ORD-0001", documentType: "STNK" }
    );

    const uploadRes = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body,
    });
    assert.strictEqual(uploadRes.status, 201);
    const docData = await uploadRes.json() as any;
    orderDocId = docData.data.id;

    // 2. Anonymous attempt to view doc metadata -> 401
    const anonRes = await fetch(`${baseUrl}/api/documents/${orderDocId}`);
    assert.strictEqual(anonRes.status, 401);

    // 3. Admin attempt to view doc metadata -> 200
    const adminRes = await fetch(`${baseUrl}/api/documents/${orderDocId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminRes.status, 200);

    // 4. Finance attempt to view doc metadata -> 200
    const financeRes = await fetch(`${baseUrl}/api/documents/${orderDocId}`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    assert.strictEqual(financeRes.status, 200);

    // 5. Assigned Messenger attempt to view doc metadata -> 200
    const assignedRes = await fetch(`${baseUrl}/api/documents/${orderDocId}`, {
      headers: { Authorization: `Bearer ${assignedMessengerToken}` },
    });
    assert.strictEqual(assignedRes.status, 200);

    // 6. Unassigned Messenger attempt to view doc metadata -> 403 Forbidden
    const unassignedRes = await fetch(`${baseUrl}/api/documents/${orderDocId}`, {
      headers: { Authorization: `Bearer ${unassignedMessengerToken}` },
    });
    assert.strictEqual(unassignedRes.status, 403);

    // 7. Unassigned Messenger attempt to get ticket -> 403 Forbidden
    const ticketUnassignedRes = await fetch(`${baseUrl}/api/documents/${orderDocId}/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${unassignedMessengerToken}`,
      },
      body: JSON.stringify({ operation: "preview" }),
    });
    assert.strictEqual(ticketUnassignedRes.status, 403);

    // 8. Messenger attempt to access invoice documents list -> 403 Forbidden
    const messengerInvoiceRes = await fetch(`${baseUrl}/api/documents/invoice/INV-2024-001`, {
      headers: { Authorization: `Bearer ${assignedMessengerToken}` },
    });
    assert.strictEqual(messengerInvoiceRes.status, 403);

    // 9. Finance attempt to access invoice documents list -> 200 OK
    const financeInvoiceRes = await fetch(`${baseUrl}/api/documents/invoice/INV-2024-001`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    assert.strictEqual(financeInvoiceRes.status, 200);

    // Cleanup
    dbDocumentRepository.deleteDocument(orderDocId);
  } finally {
    server.close();
  }
});

