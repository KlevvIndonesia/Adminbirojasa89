import test from "node:test";
import assert from "node:assert/strict";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { pricingService } from "../server/src/services/pricingService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { CANONICAL_PERMISSIONS } from "../server/src/config/defaultPermissions";
import { ApiError } from "../server/src/middleware/errorHandler";

test("Order Cost Verification & Invoice Guard Test Suite", async (t) => {
  const supervisorUser = {
    userId: "usr-spv-01",
    nama: "Budi Supervisor",
    role: "supervisor",
    email: "spv@birojasa.com",
  };

  const messengerUser = {
    userId: "usr-msg-01",
    nama: "Andi Messenger",
    role: "messenger",
    email: "messenger@birojasa.com",
  };

  await t.test("1. CANONICAL_PERMISSIONS includes master-metode-pembayaran correctly", () => {
    assert.deepEqual(
      CANONICAL_PERMISSIONS.svp.modules["master-metode-pembayaran"],
      { view: true, manage: true }
    );
    assert.deepEqual(
      CANONICAL_PERMISSIONS.admin.modules["master-metode-pembayaran"],
      { view: true, manage: true }
    );
    assert.deepEqual(
      CANONICAL_PERMISSIONS.finance.modules["master-metode-pembayaran"],
      { view: true, manage: true }
    );
    assert.deepEqual(
      CANONICAL_PERMISSIONS.messenger.modules["master-metode-pembayaran"],
      { view: false, manage: false }
    );
  });

  await t.test("2. Partial estimate order creation flags is_cost_verified=0 and pending invoice", () => {
    const orderPayload = {
      customer: "PT Mitra Unggul",
      nomorHP: "081233445566",
      layanan: "Mutasi Antar Daerah",
      nopol: "B 1234 PARTIAL",
      biayaJasa: 150000,
      biayaAntarJemput: 50000,
      totalBiaya: 200000,
      wilayahSamsatAsal: "Jakarta Barat",
      completenessStatus: "PARTIAL_ESTIMATE",
      costSnapshot: {
        totalEstimasi: 200000,
        biayaJasa: 150000,
        biayaSamsat: 0,
        biayaAntarJemput: 50000,
        completenessStatus: "PARTIAL_ESTIMATE",
        hasUnconfiguredTariff: true,
        unconfiguredItems: ["BBN-KB 1", "Sumbangan Operasional"],
        breakdown: [
          { name: "Jasa Pengurusan", category: "Jasa", amount: 150000, status: "CONFIGURED" },
          { name: "Komponen Samsat A", category: "Samsat", amount: 0, status: "UNCONFIGURED", isEstimated: true },
        ],
      },
    };

    const created = orderService.createOrder(orderPayload, supervisorUser as any);
    assert.ok(created.orderNo);

    // Verify repository data
    const savedOrder = dbOrderRepository.getByOrderNo(created.orderNo);
    assert.ok(savedOrder);
    assert.equal(savedOrder.isCostVerified, false);
    assert.equal(savedOrder.costCompletenessStatus, "PARTIAL_ESTIMATE");

    // Verify invoice data
    const savedInvoice = dbFinanceRepository.getInvoiceByOrderNo(created.orderNo);
    assert.ok(savedInvoice);
    assert.equal(savedInvoice.costVerificationStatus, "PENDING_VERIFICATION");
    assert.equal(savedInvoice.isDraftEstimate, true);
  });

  await t.test("3. Invoice payment blocked for PARTIAL_ESTIMATE before verification", () => {
    const orderPayload = {
      customer: "Bpk Hendra",
      nomorHP: "081987654321",
      layanan: "Balik Nama",
      nopol: "B 5678 GUARD",
      biayaJasa: 100000,
      totalBiaya: 100000,
      wilayahSamsatAsal: "Jakarta Selatan",
      completenessStatus: "PARTIAL_ESTIMATE",
      costSnapshot: {
        totalEstimasi: 100000,
        completenessStatus: "PARTIAL_ESTIMATE",
        hasUnconfiguredTariff: true,
        breakdown: [{ name: "Pajak", amount: 0, status: "UNCONFIGURED" }],
      },
    };

    const created = orderService.createOrder(orderPayload, supervisorUser as any);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(created.orderNo);
    assert.ok(invoice);

    // Set order to stage where final cost check would otherwise pass
    dbOrderRepository.updateOrder(created.orderNo, {
      currentStep: 7,
      currentStageName: "Supervisi",
      approvedBySpv: true,
      isVerified: true,
      finalCost: 100000,
    });

    // Attempt payInvoice -> Expect ApiError COST_VERIFICATION_REQUIRED
    assert.throws(
      () => {
        financeService.recordPayment(
          invoice.id,
          50000,
          { metodePembayaran: "Transfer", namaBank: "BCA" },
          supervisorUser as any
        );
      },
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "COST_VERIFICATION_REQUIRED");
        return true;
      }
    );
  });

  await t.test("4. verifyOrderCost successfully unlocks invoice and preserves snapshot immutability", () => {
    const orderPayload = {
      customer: "Ibu Ratna",
      nomorHP: "085544332211",
      layanan: "Tarik Berkas",
      nopol: "B 9999 VERIFY",
      biayaJasa: 200000,
      totalBiaya: 200000,
      wilayahSamsatAsal: "Jakarta Pusat",
      completenessStatus: "PARTIAL_ESTIMATE",
      costSnapshot: {
        totalEstimasi: 200000,
        biayaJasa: 200000,
        biayaSamsat: 0,
        completenessStatus: "PARTIAL_ESTIMATE",
        hasUnconfiguredTariff: true,
        unconfiguredItems: ["Arsip Daerah"],
        breakdown: [
          { name: "Jasa", amount: 200000, status: "CONFIGURED" },
          { name: "Arsip Daerah", amount: 0, status: "UNCONFIGURED" },
        ],
      },
    };

    const created = orderService.createOrder(orderPayload, supervisorUser as any);
    const originalSnapshotJson = JSON.stringify(created.costSnapshot);

    // Non-supervisor/admin attempt fails
    assert.throws(
      () => {
        orderService.verifyOrderCost(
          created.orderNo,
          { finalBiayaSamsat: 120000, notes: "Dicek kurir" },
          messengerUser as any
        );
      },
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      }
    );

    // Supervisor verification with revised cost
    const verifiedOrder = orderService.verifyOrderCost(
      created.orderNo,
      {
        finalBiayaSamsat: 150000,
        finalTotalBiaya: 350000,
        notes: "Tarif arsip daerah terkonfirmasi Rp 150.000",
      },
      supervisorUser as any
    );

    assert.equal(verifiedOrder.isCostVerified, true);
    assert.equal(verifiedOrder.costCompletenessStatus, "VERIFIED");
    assert.equal(verifiedOrder.costVerifiedBy, supervisorUser.nama);
    assert.ok(verifiedOrder.costVerifiedAt);
    assert.equal(verifiedOrder.payment.totalBiaya, 350000);
    assert.equal(verifiedOrder.finalCost, 350000);

    // Verify snapshot immutability
    const currentOrder = dbOrderRepository.getByOrderNo(created.orderNo)!;
    assert.equal(
      JSON.stringify(currentOrder.costSnapshot),
      originalSnapshotJson,
      "Historical snapshot must remain completely immutable"
    );

    // Verify invoice update
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(created.orderNo)!;
    assert.equal(invoice.costVerificationStatus, "VERIFIED");
    assert.equal(invoice.isDraftEstimate, false);
    assert.equal(invoice.totalTagihan, 350000);
    assert.equal(invoice.sisa, 350000);

    // Prepare order stage prerequisites for payment
    dbOrderRepository.updateOrder(created.orderNo, {
      currentStep: 7,
      currentStageName: "Supervisi",
      approvedBySpv: true,
      isVerified: true,
    });

    // Now payment succeeds without COST_VERIFICATION_REQUIRED
    const paidInv = financeService.recordPayment(
      invoice.id,
      350000,
      {
        metodePembayaran: "Transfer",
        namaBank: "BCA",
        catatan: "Pelunasan setelah verifikasi biaya",
      },
      supervisorUser as any
    );

    assert.equal(paidInv.status, "PAID");
    assert.equal(paidInv.sisa, 0);
  });

  await t.test("5. Complete order (no partial estimate) is immediately verified and unblocked", () => {
    const orderPayload = {
      customer: "CV Berkah Mandiri",
      nomorHP: "081299887766",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 7777 LENGKAP",
      biayaJasa: 150000,
      totalBiaya: 150000,
      wilayahSamsatAsal: "Jakarta Timur",
      completenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 150000,
        biayaJasa: 150000,
        biayaSamsat: 0,
        completenessStatus: "COMPLETE",
        hasUnconfiguredTariff: false,
        breakdown: [{ name: "Jasa", amount: 150000, status: "CONFIGURED" }],
      },
    };

    const created = orderService.createOrder(orderPayload, supervisorUser as any);
    assert.equal(created.isCostVerified, true);
    assert.equal(created.costCompletenessStatus, "COMPLETE");

    const invoice = dbFinanceRepository.getInvoiceByOrderNo(created.orderNo)!;
    assert.equal(invoice.costVerificationStatus, "VERIFIED");
    assert.equal(invoice.isDraftEstimate, false);
  });
});
