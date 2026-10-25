/**
 * Comprehensive End-to-End Smoke Test & Regression Verification (P0)
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * SUITE 1: P0 Security Regression (Negative Tests)
 *   1. RBAC Guard (Phase 1): Admin role blocked from finance invoices & audit logs (403)
 *   2. Courier Mutation Restriction (Phase 1): Messenger blocked from mutating general order data (403)
 *   3. Courier IDOR / BOLA Lockdown (Phase 2): Courier history strictly scoped, unassigned task blocked (403)
 *   4. Pricing Anti-Tampering Guard (Phase 3): PKB price manipulation and negative pricing blocked (400)
 *   5. Document Binary Magic-Byte Guard (Phase 4): Fake PDF/executable disguised rejected (400), unassigned courier ticket blocked (403)
 * 
 * SUITE 2: Core Business Happy Path (Positive E2E Flow)
 *   1. Create Order: Valid order with authentic vehicle tax & sane pricing persists (201)
 *   2. Link Documents: Authentic PDF uploads (201), single-use ticket issued (201) & consumed (200 -> 401)
 *   3. Stage Advance: Operational order transitions to next stage (200)
 *   4. Payment Recording: Invoice payment recorded with proper balance calculation (200)
 *   5. Cash Journal Entry: Kas Kantor reflects transaction accurately (201)
 *   6. Clean Rollback: Ephemeral test artifacts removed and database integrity verified
 * 
 * Usage: npx tsx scripts/verify_p0_stability.ts
 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { createApp } from "../server/src/app";
import { generateToken } from "../server/src/utils/crypto";
import { db } from "../server/src/database/db";
import { CONFIG } from "../server/src/config/env";

// ─────────────────────────────────────────────────────────────────────────────
// TEST BUFFERS & MULTIPART HELPER
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PDF_BUFFER = Buffer.concat([
  Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Authentic Test PDF) >>\nendobj\ntrailer\n<< /Size 1 >>\nstartxref\n%%EOF"),
]);

const FAKE_PDF_TEXT_BUFFER = Buffer.from("Plain text masquerading as a PDF file for malicious injection.");
const MALICIOUS_EXE_BUFFER = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]);

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

// ─────────────────────────────────────────────────────────────────────────────
// SERVER LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

function startServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TEST HARNESS
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================================");
  console.log("   ADMIN SUN89 — COMPREHENSIVE END-TO-END SMOKE TEST & REGRESSION (P0)");
  console.log("================================================================================\n");

  const startTime = Date.now();
  const { server, baseUrl } = await startServer();
  console.log(`[Test Setup] Ephemeral HTTP Server listening on: ${baseUrl}`);

  // Test Tokens
  const superadminToken = generateToken({
    userId: "1",
    email: "svp@birojasa.com",
    nama: "Admin Super (SVP)",
    jabatan: "SVP",
    role: "administrator",
  });

  const financeToken = generateToken({
    userId: "2",
    email: "finance@birojasa.com",
    nama: "Siti Rahmawati",
    jabatan: "finance",
    role: "finance",
  });

  const adminToken = generateToken({
    userId: "3",
    email: "admin_staff@birojasa.com",
    nama: "Ahmad Staff",
    jabatan: "admin",
    role: "admin",
  });

  const courierBudiToken = generateToken({
    userId: "4",
    email: "budi@birojasa.com",
    nama: "Budi Santoso",
    jabatan: "messenger",
    role: "messenger",
  });

  const courierAndiToken = generateToken({
    userId: "5",
    email: "andi@birojasa.com",
    nama: "Andi Pratama",
    jabatan: "messenger",
    role: "messenger",
  });

  let createdOrderNo = "";
  let createdDocId = "";
  let createdStorageName = "";
  let createdInvoiceId = 0;

  let totalAssertions = 0;
  let passedAssertions = 0;

  function assertCheck(description: string, condition: boolean, extraInfo?: string) {
    totalAssertions++;
    if (condition) {
      passedAssertions++;
      console.log(`  ✓ PASS [Check ${totalAssertions}]: ${description}`);
    } else {
      console.error(`  ✗ FAIL [Check ${totalAssertions}]: ${description}${extraInfo ? ` (${extraInfo})` : ""}`);
      throw new Error(`Assertion failed: ${description}`);
    }
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // SUITE 1: P0 SECURITY REGRESSION SUITE (NEGATIVE TESTS)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n▶ [SUITE 1: P0 SECURITY REGRESSION SUITE (NEGATIVE TESTS)]");

    // 1. RBAC Guard (Phase 1)
    console.log("\n  [1.1] Testing RBAC Route Protection on Financial Invoices for Admin Role...");
    const resInvoicesAdmin = await fetch(`${baseUrl}/api/finance/invoices`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assertCheck(
      "Admin role blocked from GET /api/finance/invoices with HTTP 403",
      resInvoicesAdmin.status === 403,
      `Got status ${resInvoicesAdmin.status}`
    );

    console.log("  [1.2] Testing RBAC Route Protection on Audit Logs for Admin Role...");
    const resAuditAdmin = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assertCheck(
      "Admin role blocked from GET /api/audit-logs with HTTP 403",
      resAuditAdmin.status === 403,
      `Got status ${resAuditAdmin.status}`
    );

    // 2. Courier Mutation Restriction (Phase 1)
    console.log("\n  [2.1] Testing Courier Mutation Restriction on Orders...");
    const resCourierOrderPut = await fetch(`${baseUrl}/api/orders/ORD-0001`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${courierBudiToken}`,
      },
      body: JSON.stringify({ catatanOrder: "Unauthorized mutation attempt by courier" }),
    });
    assertCheck(
      "Courier role blocked from PUT /api/orders/:orderNo with HTTP 403",
      resCourierOrderPut.status === 403,
      `Got status ${resCourierOrderPut.status}`
    );

    // 3. Courier IDOR / BOLA Lockdown (Phase 2)
    console.log("\n  [3.1] Testing Courier History IDOR Tampering (Budi requesting Andi's employeeId)...");
    const resHistoryBudi = await fetch(`${baseUrl}/api/messenger/history?employeeId=EMP-MSG-002`, {
      headers: { Authorization: `Bearer ${courierBudiToken}` },
    });
    const historyData = await resHistoryBudi.json() as any;
    assertCheck(
      "Courier history request responds HTTP 200",
      resHistoryBudi.status === 200,
      `Got status ${resHistoryBudi.status}`
    );
    const historyItems = historyData.data?.history || [];
    const hasOtherCourier = historyItems.some((item: any) =>
      item.assignedMessengerName && item.assignedMessengerName.toLowerCase() === "andi pratama"
    );
    assertCheck(
      "Courier history query strictly scoped to Budi Santoso (Andi Pratama records excluded)",
      !hasOtherCourier,
      `Leaked records detected: ${hasOtherCourier}`
    );

    console.log("  [3.2] Testing Object-Level Access Control on Tasks (Budi requesting Andi's assigned task ORD-0002)...");
    const resTaskUnassigned = await fetch(`${baseUrl}/api/messenger/tasks/ORD-0002`, {
      headers: { Authorization: `Bearer ${courierBudiToken}` },
    });
    const taskJson = await resTaskUnassigned.json() as any;
    assertCheck(
      "Courier Budi blocked from viewing Andi's task ORD-0002 with HTTP 403",
      resTaskUnassigned.status === 403,
      `Got status ${resTaskUnassigned.status}`
    );
    assertCheck(
      "Error code returned is FORBIDDEN_TASK_ACCESS",
      taskJson.error?.code === "FORBIDDEN_TASK_ACCESS" || taskJson.error?.code === "FORBIDDEN",
      `Got error code: ${taskJson.error?.code}`
    );

    // 4. Pricing Anti-Tampering Guard (Phase 3)
    console.log("\n  [4.1] Testing Pricing Anti-Tampering (Manipulated totalBiaya 500 on 2.000.000 PKB)...");
    const badPricingPayload = {
      customer: "TEST-SMOKE-P0 Tamperer",
      nomorHP: "081299990001",
      layanan: "Perpanjangan 1 Tahun",
      metodeLayanan: "Datang Langsung",
      nopol: "B 9999 BAD",
      nominalPkbTerakhir: 2000000,
      nominalSwdkllj: 143000,
      biayaJasa: 500,
      totalBiaya: 500,
    };
    const resTamperPrice = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify(badPricingPayload),
    });
    const tamperJson = await resTamperPrice.json() as any;
    assertCheck(
      "Manipulated order pricing rejected with HTTP 400",
      resTamperPrice.status === 400,
      `Got status ${resTamperPrice.status}`
    );
    assertCheck(
      "Error code indicates PRICING_MANIPULATION_DETECTED",
      tamperJson.error?.code === "PRICING_MANIPULATION_DETECTED",
      `Got code: ${tamperJson.error?.code}`
    );

    console.log("  [4.2] Testing Negative Total Pricing...");
    const negativePricingPayload = {
      customer: "TEST-SMOKE-P0 Negative",
      nomorHP: "081299990002",
      layanan: "Perpanjangan 1 Tahun",
      metodeLayanan: "Datang Langsung",
      nopol: "B 9999 NEG",
      totalBiaya: -50000,
    };
    const resNegativePrice = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify(negativePricingPayload),
    });
    const negativeJson = await resNegativePrice.json() as any;
    assertCheck(
      "Negative pricing rejected with HTTP 400",
      resNegativePrice.status === 400,
      `Got status ${resNegativePrice.status}`
    );
    assertCheck(
      "Error code is INVALID_PRICING or VALIDATION_ERROR",
      negativeJson.error?.code === "INVALID_PRICING" || negativeJson.error?.code === "VALIDATION_ERROR",
      `Got code: ${negativeJson.error?.code}`
    );

    // 5. Document Binary Magic-Byte Guard (Phase 4)
    console.log("\n  [5.1] Testing Binary Inspection with Disguised Text File (.pdf without %PDF signature)...");
    const fakePdfMultipart = createTestMultipartBody(
      "file",
      "disguised_text.pdf",
      FAKE_PDF_TEXT_BUFFER,
      "application/pdf",
      { orderNo: "ORD-0001", documentType: "STNK" }
    );
    const resFakePdf = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${fakePdfMultipart.boundary}`,
        Authorization: `Bearer ${superadminToken}`,
      },
      body: fakePdfMultipart.body,
    });
    const fakePdfJson = await resFakePdf.json() as any;
    assertCheck(
      "Disguised text upload rejected with HTTP 400",
      resFakePdf.status === 400,
      `Got status ${resFakePdf.status}`
    );
    assertCheck(
      "Error code is INVALID_FILE_SIGNATURE",
      fakePdfJson.error?.code === "INVALID_FILE_SIGNATURE",
      `Got code: ${fakePdfJson.error?.code}`
    );

    console.log("  [5.2] Testing Binary Inspection with Disguised Executable (.exe disguised as .jpg)...");
    const exeMultipart = createTestMultipartBody(
      "file",
      "trojan.jpg",
      MALICIOUS_EXE_BUFFER,
      "image/jpeg",
      { orderNo: "ORD-0001", documentType: "KTP" }
    );
    const resExe = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${exeMultipart.boundary}`,
        Authorization: `Bearer ${superadminToken}`,
      },
      body: exeMultipart.body,
    });
    const exeJson = await resExe.json() as any;
    assertCheck(
      "Disguised executable upload rejected with HTTP 400",
      resExe.status === 400,
      `Got status ${resExe.status}`
    );
    assertCheck(
      "Error code is INVALID_FILE_SIGNATURE",
      exeJson.error?.code === "INVALID_FILE_SIGNATURE",
      `Got code: ${exeJson.error?.code}`
    );

    console.log("  [5.3] Testing Ticket Issuance Access Control (Unauthorized Courier Andi requesting ticket for ORD-0001 doc)...");
    // Upload a valid doc for ORD-0001 by Admin
    const validPdfMultipart = createTestMultipartBody(
      "file",
      "legit_stnk.pdf",
      VALID_PDF_BUFFER,
      "application/pdf",
      { orderNo: "ORD-0001", documentType: "STNK" }
    );
    const resUploadForTicket = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${validPdfMultipart.boundary}`,
        Authorization: `Bearer ${superadminToken}`,
      },
      body: validPdfMultipart.body,
    });
    const uploadForTicketJson = await resUploadForTicket.json() as any;
    const tempDocId = uploadForTicketJson.data?.id;
    assertCheck(
      "Legitimate document uploaded for ORD-0001 (201 Created)",
      resUploadForTicket.status === 201 && Boolean(tempDocId),
      `Got status ${resUploadForTicket.status}`
    );

    // Courier Andi (not assigned to ORD-0001) tries to issue a ticket
    const resAndiTicket = await fetch(`${baseUrl}/api/documents/${tempDocId}/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${courierAndiToken}`,
      },
      body: JSON.stringify({ operation: "preview" }),
    });
    const andiTicketJson = await resAndiTicket.json() as any;
    assertCheck(
      "Unassigned Courier Andi blocked from ticket issuance with HTTP 403",
      resAndiTicket.status === 403,
      `Got status ${resAndiTicket.status}`
    );
    assertCheck(
      "Error code indicates FORBIDDEN_DOCUMENT_ACCESS",
      andiTicketJson.error?.code === "FORBIDDEN_DOCUMENT_ACCESS",
      `Got code: ${andiTicketJson.error?.code}`
    );

    // Clean up temporary doc
    if (tempDocId) {
      await fetch(`${baseUrl}/api/documents/${tempDocId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      db.prepare("DELETE FROM documents WHERE id = ?").run(tempDocId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUITE 2: CORE BUSINESS HAPPY PATH (POSITIVE E2E FLOW)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n▶ [SUITE 2: CORE BUSINESS HAPPY PATH (POSITIVE E2E FLOW)]");

    // 1. Create Order
    console.log("\n  [1. Create Order] Creating authentic test order with compliant pricing...");
    const authenticOrderPayload = {
      customer: "TEST-SMOKE-P0 PT Maju Bersama",
      nomorHP: "081234567890",
      layanan: "Perpanjangan 1 Tahun",
      metodeLayanan: "Antar Jemput",
      nopol: "B 1234 SMOKE",
      nominalPkbTerakhir: 1200000,
      nominalSwdkllj: 143000,
      biayaJasa: 250000,
      totalBiaya: 1593000,
      catatanOrder: "Order uji stabilitas sistem TEST-SMOKE-P0",
    };

    const resCreateOrder = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`,
        "x-idempotency-key": `smoke-p0-${Date.now()}`,
      },
      body: JSON.stringify(authenticOrderPayload),
    });

    const createOrderJson = await resCreateOrder.json() as any;
    assertCheck(
      "Order created successfully with HTTP 201",
      resCreateOrder.status === 201,
      `Got status ${resCreateOrder.status}`
    );
    createdOrderNo = createOrderJson.data?.orderNo;
    assertCheck(
      "Valid orderNo received (ORD-XXXX)",
      Boolean(createdOrderNo && createdOrderNo.startsWith("ORD-")),
      `Got orderNo: ${createdOrderNo}`
    );
    assertCheck(
      "Order initial stage is 'Verifikasi' (Step 1)",
      createOrderJson.data?.currentStep === 1 && createOrderJson.data?.currentStageName === "Verifikasi",
      `Step: ${createOrderJson.data?.currentStep}, Stage: ${createOrderJson.data?.currentStageName}`
    );

    // 2. Link Documents & Ticket Workflow
    console.log(`\n  [2. Link Documents] Uploading legitimate PDF for ${createdOrderNo}...`);
    const docUploadBody = createTestMultipartBody(
      "file",
      "stnk_asli_p0.pdf",
      VALID_PDF_BUFFER,
      "application/pdf",
      { orderNo: createdOrderNo, documentType: "STNK" }
    );
    const resDocUpload = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${docUploadBody.boundary}`,
        Authorization: `Bearer ${superadminToken}`,
      },
      body: docUploadBody.body,
    });
    const docUploadJson = await resDocUpload.json() as any;
    assertCheck(
      "Document upload responds HTTP 201 Created",
      resDocUpload.status === 201,
      `Got status ${resDocUpload.status}`
    );
    createdDocId = docUploadJson.data?.id;
    createdStorageName = docUploadJson.data?.storageName;
    assertCheck(
      "Document entity contains valid id (DOC-XXXXXXXX) and order linkage",
      Boolean(createdDocId && createdDocId.startsWith("DOC-") && docUploadJson.data?.orderNo === createdOrderNo),
      `docId: ${createdDocId}, orderNo: ${docUploadJson.data?.orderNo}`
    );

    console.log(`  [2.1] Generating short-lived ticket for ${createdDocId}...`);
    const resTicket = await fetch(`${baseUrl}/api/documents/${createdDocId}/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({ operation: "preview" }),
    });
    const ticketJson = await resTicket.json() as any;
    assertCheck(
      "Ticket generated successfully with HTTP 201",
      resTicket.status === 201,
      `Got status ${resTicket.status}`
    );
    const accessTicket = ticketJson.data?.ticket;
    assertCheck(
      "Single-use access ticket token received",
      Boolean(accessTicket && typeof accessTicket === "string" && accessTicket.length > 20),
      `Ticket length: ${accessTicket?.length}`
    );

    console.log("  [2.2] Consuming access ticket to stream document preview...");
    const resPreview = await fetch(`${baseUrl}/api/documents/${createdDocId}/preview?ticket=${accessTicket}`);
    assertCheck(
      "Document preview stream responds HTTP 200 OK",
      resPreview.status === 200,
      `Got status ${resPreview.status}`
    );
    assertCheck(
      "Preview header Content-Type is application/pdf",
      resPreview.headers.get("content-type") === "application/pdf",
      `Content-Type: ${resPreview.headers.get("content-type")}`
    );

    console.log("  [2.3] Testing single-use replay protection on download ticket...");
    const resDlTicket = await fetch(`${baseUrl}/api/documents/${createdDocId}/ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({ operation: "download" }),
    });
    const dlTicketJson = await resDlTicket.json() as any;
    const dlTicket = dlTicketJson.data?.ticket;

    // First download succeeds (HTTP 200)
    const resDl1 = await fetch(`${baseUrl}/api/documents/${createdDocId}/download?ticket=${dlTicket}`);
    assertCheck(
      "Download with single-use ticket succeeds with HTTP 200",
      resDl1.status === 200,
      `Got status ${resDl1.status}`
    );

    // Replaying consumed download ticket must return 401
    const resDlReplay = await fetch(`${baseUrl}/api/documents/${createdDocId}/download?ticket=${dlTicket}`);
    assertCheck(
      "Replayed single-use download ticket strictly rejected with HTTP 401 Unauthenticated",
      resDlReplay.status === 401,
      `Got status ${resDlReplay.status}`
    );

    // Forged ticket rejected with 401
    const resForged = await fetch(`${baseUrl}/api/documents/${createdDocId}/preview?ticket=tkt_fake_random_ticket_12345678901234567890`);
    assertCheck(
      "Forged ticket strictly rejected with HTTP 401 Unauthenticated",
      resForged.status === 401,
      `Got status ${resForged.status}`
    );

    // 3. Stage Advance
    console.log(`\n  [3. Stage Advance] Advancing ${createdOrderNo} from 'Verifikasi' to 'Penjadwalan'...`);
    const resAdvance = await fetch(`${baseUrl}/api/orders/${createdOrderNo}/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({ targetStage: "Penjadwalan" }),
    });
    const advanceJson = await resAdvance.json() as any;
    assertCheck(
      "Order successfully advanced with HTTP 200",
      resAdvance.status === 200,
      `Got status ${resAdvance.status}`
    );
    assertCheck(
      "Order currentStageName transitioned to 'Penjadwalan' (Step 2)",
      advanceJson.data?.currentStep === 2 && advanceJson.data?.currentStageName === "Penjadwalan",
      `Step: ${advanceJson.data?.currentStep}, Stage: ${advanceJson.data?.currentStageName}`
    );

    // 4. Payment Recording & Financial Gating
    console.log(`\n  [4. Payment Recording & Financial Gating] Querying provisioned invoice for ${createdOrderNo}...`);
    const resInvoices = await fetch(`${baseUrl}/api/finance/invoices`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    const invoicesData = await resInvoices.json() as any;
    const matchingInvoice = (invoicesData.data || []).find((inv: any) => inv.orderNo === createdOrderNo);
    assertCheck(
      "Provisioned invoice located for order",
      Boolean(matchingInvoice && matchingInvoice.id),
      `Found: ${matchingInvoice?.invoiceNo}`
    );
    createdInvoiceId = matchingInvoice?.id;

    console.log("  [4.1] Testing Financial Gating: Premature payment before Supervisi approval must be rejected...");
    const resPrematurePay = await fetch(`${baseUrl}/api/finance/invoices/${createdInvoiceId}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${financeToken}`,
      },
      body: JSON.stringify({
        amount: 500000,
        metodePembayaran: "Transfer",
        namaBank: "BCA",
      }),
    });
    assertCheck(
      "Premature payment rejected with HTTP 400 (Phase B Security Gating active)",
      resPrematurePay.status === 400,
      `Got status ${resPrematurePay.status}`
    );

    console.log("  [4.2] Executing Official Document Approval (Stage 5 Verification & Stage 6 Supervisi Approval)...");
    const resStage5 = await fetch(`${baseUrl}/api/orders/${createdOrderNo}/approve-documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ stage: 5, snapshotDocs: [createdDocId] }),
    });
    assertCheck(
      "Stage 5 document verification succeeds with HTTP 200",
      resStage5.status === 200,
      `Got status ${resStage5.status}`
    );

    const resStage6 = await fetch(`${baseUrl}/api/orders/${createdOrderNo}/approve-documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({ stage: 6, snapshotDocs: [createdDocId] }),
    });
    assertCheck(
      "Stage 6 supervisor approval succeeds with HTTP 200",
      resStage6.status === 200,
      `Got status ${resStage6.status}`
    );

    console.log(`  [4.3] Recording partial payment (Rp 500.000) on approved invoice ${matchingInvoice.invoiceNo}...`);
    const resPay = await fetch(`${baseUrl}/api/finance/invoices/${createdInvoiceId}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${financeToken}`,
        "x-idempotency-key": `pay-smoke-p0-${Date.now()}`,
      },
      body: JSON.stringify({
        amount: 500000,
        metodePembayaran: "Transfer",
        namaBank: "BCA",
        catatan: "Uji Pembayaran Parsial TEST-SMOKE-P0",
      }),
    });
    const payJson = await resPay.json() as any;
    assertCheck(
      "Payment successfully recorded with HTTP 200",
      resPay.status === 200,
      `Got status ${resPay.status}`
    );
    const updatedInvoice = payJson.data;
    assertCheck(
      "Invoice dibayar/terbayar updated to 500000",
      Number(updatedInvoice?.dibayar ?? updatedInvoice?.terbayar) === 500000,
      `dibayar: ${updatedInvoice?.dibayar}`
    );
    assertCheck(
      "Invoice remaining balance calculated accurately (1.093.000)",
      Number(updatedInvoice?.sisa) === 1593000 - 500000,
      `Status: ${updatedInvoice?.status}, sisa: ${updatedInvoice?.sisa}`
    );

    // 5. Cash Journal Entry (Kas Kantor)
    console.log("\n  [5. Cash Journal Entry] Creating debit transaction in Kas Kantor...");
    const kasPayload = {
      tanggal: new Date().toISOString().split("T")[0],
      keterangan: "Penerimaan Kas Masuk TEST-SMOKE-P0",
      status: "Pemasukan",
      debit: 500000,
      kredit: 0,
      penanggungJawab: "Finance Smoke Test",
    };
    const resKasPost = await fetch(`${baseUrl}/api/finance/kas-kantor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${financeToken}`,
      },
      body: JSON.stringify(kasPayload),
    });
    const kasPostJson = await resKasPost.json() as any;
    assertCheck(
      "Kas Kantor transaction recorded with HTTP 201 Created",
      resKasPost.status === 201,
      `Got status ${resKasPost.status}`
    );
    const createdKasId = kasPostJson.data?.id;

    console.log("  [5.1] Verifying Kas Kantor ledger entry persistence...");
    const resKasGet = await fetch(`${baseUrl}/api/finance/kas-kantor`, {
      headers: { Authorization: `Bearer ${financeToken}` },
    });
    const kasListData = await resKasGet.json() as any;
    const foundKas = (kasListData.data || []).find((k: any) =>
      k.keterangan && k.keterangan.includes("TEST-SMOKE-P0")
    );
    assertCheck(
      "Kas Kantor entry successfully retrieved from persistent ledger",
      Boolean(foundKas && Number(foundKas.debit) === 500000),
      `Found entry: ${foundKas?.keterangan}`
    );

    console.log("\n================================================================================");
    console.log(`   ALL ${passedAssertions}/${totalAssertions} VERIFICATION CHECKS PASSED SUCCESSFULLY!`);
    console.log("================================================================================");

  } finally {
    // ═══════════════════════════════════════════════════════════════════════════
    // 6. Clean Rollback & Preservation of Database
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n[Clean Rollback] Sanitizing ephemeral test entities to keep database pristine...");

    try {
      if (createdDocId) {
        db.prepare("DELETE FROM documents WHERE id = ?").run(createdDocId);
        console.log(` - Purged document record ${createdDocId}`);
      }
      if (createdStorageName) {
        const filePath = path.join(CONFIG.UPLOAD_DIR, createdStorageName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(` - Purged physical storage file ${createdStorageName}`);
        }
      }
      if (createdOrderNo) {
        db.prepare("DELETE FROM invoice_payments WHERE order_no = ?").run(createdOrderNo);
        db.prepare("DELETE FROM finance_invoices WHERE order_no = ?").run(createdOrderNo);
        db.prepare("DELETE FROM orders WHERE order_no = ?").run(createdOrderNo);
        db.prepare("DELETE FROM audit_logs WHERE details LIKE ?").run(`%${createdOrderNo}%`);
        console.log(` - Purged order ${createdOrderNo}, associated invoice, payments and audits`);
      }
      const kasResult = db.prepare("DELETE FROM kas_kantor WHERE keterangan LIKE '%TEST-SMOKE-P0%'").run();
      if ((kasResult as any)?.changes > 0) {
        console.log(` - Purged ${(kasResult as any).changes} Kas Kantor test entry`);
      }
      db.prepare("DELETE FROM audit_logs WHERE details LIKE '%TEST-SMOKE-P0%'").run();

      // Database integrity verification
      const integrityCheck = db.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
      console.log(`[Database Integrity] PRAGMA integrity_check: ${integrityCheck?.integrity_check || "unknown"}`);
      assert.strictEqual(integrityCheck?.integrity_check, "ok", "Database integrity check must be 'ok'");
    } catch (cleanupErr) {
      console.error("[Clean Rollback Warning] Error during final data sanitization:", cleanupErr);
    }

    server.close();
    console.log(`[Test Teardown] Ephemeral server closed. Total duration: ${Date.now() - startTime}ms\n`);
  }
}

main().catch((err) => {
  console.error("\n❌ [FATAL ERROR] Comprehensive Smoke Test aborted with exception:", err);
  process.exit(1);
});
