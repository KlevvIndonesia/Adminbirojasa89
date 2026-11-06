import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/src/app";
import { orderService } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";

function createServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = createApp();
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3000;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

test("POST-IMPLEMENTATION DEEP TECHNICAL AUDIT SUITE", async (t) => {
  const { server, baseUrl } = await createServer();

  t.after(() => {
    server.close();
  });

  // Login as Administrator (SVP)
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "svp@birojasa.com", password: "admin123" }),
  });
  const loginBody = await loginRes.json() as any;
  const token = loginBody?.data?.token;
  assert.ok(token, "SVP token must be available");

  await t.test("Audit 1.1: Direct API payment on unverified PARTIAL_ESTIMATE order is rejected with 400 COST_VERIFICATION_REQUIRED", async () => {
    const orderPayload = {
      customer: "Auditee 1",
      nomorHP: "081234567890",
      layanan: "Mutasi Luar Daerah",
      nopol: "B 1111 AUD1",
      biayaJasa: 200000,
      totalBiaya: 200000,
      wilayahSamsatAsal: "Jakarta Timur",
      completenessStatus: "PARTIAL_ESTIMATE",
      costSnapshot: {
        totalEstimasi: 200000,
        biayaJasa: 200000,
        biayaSamsat: 0,
        completenessStatus: "PARTIAL_ESTIMATE",
        hasUnconfiguredTariff: true,
        breakdown: [
          { name: "Jasa", amount: 200000, status: "CONFIGURED" },
          { name: "Komponen Unconfigured", amount: 0, status: "UNCONFIGURED" }
        ]
      }
    };

    const created = orderService.createOrder(orderPayload, { role: "administrator", nama: "SVP Test", userId: "usr-001" } as any);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(created.orderNo)!;
    assert.ok(invoice);
    assert.equal(invoice.isDraftEstimate, true);
    assert.equal(invoice.costVerificationStatus, "PENDING_VERIFICATION");

    // Attempt direct API payment via POST /api/finance/invoices/:id/pay
    const payRes = await fetch(`${baseUrl}/api/finance/invoices/${invoice.id}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: 100000,
        metodePembayaran: "Transfer",
        namaBank: "BCA"
      })
    });

    const payBody = await payRes.json() as any;
    console.log(`[AUDIT EVIDENCE 1.1] payRes status=${payRes.status}, error code=${payBody.error?.code}`);
    assert.equal(payRes.status, 400);
    assert.equal(payBody.error?.code, "COST_VERIFICATION_REQUIRED");
  });

  await t.test("Audit 1.2: Direct API completion/finalization on unverified order is rejected", async () => {
    const orderPayload = {
      customer: "Auditee 2",
      nomorHP: "081234567890",
      layanan: "Balik Nama",
      nopol: "B 2222 AUD2",
      biayaJasa: 150000,
      totalBiaya: 150000,
      wilayahSamsatAsal: "Jakarta Timur",
      completenessStatus: "PARTIAL_ESTIMATE",
      costSnapshot: {
        totalEstimasi: 150000,
        completenessStatus: "PARTIAL_ESTIMATE",
        hasUnconfiguredTariff: true,
      }
    };

    const created = orderService.createOrder(orderPayload, { role: "administrator", nama: "SVP Test", userId: "usr-001" } as any);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(created.orderNo)!;

    // Direct API complete via POST /api/finance/invoices/:id/complete
    const compRes = await fetch(`${baseUrl}/api/finance/invoices/${invoice.id}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    const compBody = await compRes.json() as any;
    console.log(`[AUDIT EVIDENCE 1.2] compRes status=${compRes.status}, error code=${compBody.error?.code}`);
    assert.equal(compRes.status, 400);
  });
  await t.test("Audit 1.3: POST /api/orders/:orderNo/verify-cost updates cost and verifies invoice", async () => {
    const orderPayload = {
      customer: "Auditee 3",
      nomorHP: "081234567890",
      layanan: "Mutasi Luar Daerah",
      nopol: "B 3333 AUD3",
      biayaJasa: 200000,
      totalBiaya: 200000,
      wilayahSamsatAsal: "Jakarta Timur",
      completenessStatus: "PARTIAL_ESTIMATE",
      costSnapshot: {
        totalEstimasi: 200000,
        biayaJasa: 200000,
        biayaSamsat: 0,
        completenessStatus: "PARTIAL_ESTIMATE",
        hasUnconfiguredTariff: true,
      }
    };

    const created = orderService.createOrder(orderPayload as any, { role: "administrator", nama: "SVP Test", userId: "usr-001" } as any);

    // Verify cost via new endpoint
    const verifyRes = await fetch(`${baseUrl}/api/orders/${created.orderNo}/verify-cost`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        finalBiayaSamsat: 450000,
        finalTotalBiaya: 650000,
        notes: "Biaya Samsat telah dikonfirmasi petugas"
      })
    });

    const verifyBody = await verifyRes.json() as any;
    console.log(`[AUDIT EVIDENCE 1.3] verifyRes status=${verifyRes.status}, success=${verifyBody.success}`);
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyBody.success, true);

    const updatedOrder = orderService.getByOrderNo(created.orderNo);
    assert.equal(updatedOrder.isCostVerified, true);
    assert.equal(updatedOrder.costCompletenessStatus, "VERIFIED");

    const updatedInvoice = dbFinanceRepository.getInvoiceByOrderNo(created.orderNo)!;
    assert.equal(updatedInvoice.isDraftEstimate, false);
    assert.equal(updatedInvoice.costVerificationStatus, "VERIFIED");
    assert.equal(updatedInvoice.totalTagihan, 650000);
  });

  await t.test("Audit 1.4: PUT /api/orders/:orderNo attempting to tamper isCostVerified is blocked with 403", async () => {
    const orderPayload = {
      customer: "Auditee 4",
      nomorHP: "081234567890",
      layanan: "Mutasi Luar Daerah",
      nopol: "B 4444 AUD4",
      biayaJasa: 200000,
      totalBiaya: 200000,
      wilayahSamsatAsal: "Jakarta Timur",
      completenessStatus: "PARTIAL_ESTIMATE",
    };

    const created = orderService.createOrder(orderPayload as any, { role: "administrator", nama: "SVP Test", userId: "usr-001" } as any);

    const tamperRes = await fetch(`${baseUrl}/api/orders/${created.orderNo}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        isCostVerified: true
      })
    });

    const tamperBody = await tamperRes.json() as any;
    console.log(`[AUDIT EVIDENCE 1.4] tamperRes status=${tamperRes.status}, error code=${tamperBody.error?.code}`);
    assert.equal(tamperRes.status, 403);
    assert.equal(tamperBody.error?.code, "PROTECTED_FIELD_VIOLATION");
  });
});
