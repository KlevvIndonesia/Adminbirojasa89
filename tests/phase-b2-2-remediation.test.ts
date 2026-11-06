import test from "node:test";
import assert from "node:assert/strict";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { ApiError } from "../server/src/middleware/errorHandler";
import { computeCanonicalLabaRugi } from "../src/domain/finance/labaRugiCanonical";
import {
  classifyCost,
  classifyFinancialTransaction,
  calculateInvoiceProfitMetrics,
} from "../src/domain/finance/types";

test("Phase B2.2: Critical Financial Defect Remediation Test Suite", async (t) => {
  const adminUser = {
    userId: "usr-admin-b22",
    nama: "Admin B2.2",
    role: "admin",
    email: "admin@birojasa.com",
  };

  const spvUser = {
    userId: "usr-spv-b22",
    nama: "SPV B2.2",
    role: "supervisor",
    email: "spv@birojasa.com",
  };

  // ─── PHASE 1 — P0: REIMBURSEMENT CLASSIFICATION ─────────────────────────────

  await t.test("P0-1: Reimbursement Bensin tetap masuk ke beban kurir (normalizedMessenger)", () => {
    const item = {
      id: 101,
      tanggal: "2026-10-30",
      jenis: "Operasional",
      messenger: "Budi Courier",
      keterangan: "Reimbursement Bensin: SPBU Sukahati (ORD-TEST-001) [Ref: RMB-001]",
      kategori: "Bensin",
      reimbursementId: "RMB-001",
      in: 0,
      out: 50000,
      total: 50000,
    };

    const classification = classifyFinancialTransaction(item);
    assert.strictEqual(classification, "MESSENGER_OPERATIONAL");

    const result = computeCanonicalLabaRugi([], [], [item], "Semua");
    assert.strictEqual(result.pengeluaranMessenger, 50000);
    assert.strictEqual(result.totalBebanOperasional, 50000);
  });

  await t.test("P0-2: Reimbursement Parkir tetap masuk ke beban kurir", () => {
    const item = {
      id: 102,
      tanggal: "2026-10-30",
      jenis: "Operasional",
      messenger: "Budi Courier",
      keterangan: "Reimbursement Parkir: Loket Samsat Cibinong [Ref: RMB-002]",
      kategori: "Parkir",
      reimbursementId: "RMB-002",
      in: 0,
      out: 10000,
      total: 10000,
    };

    const classification = classifyFinancialTransaction(item);
    assert.strictEqual(classification, "MESSENGER_OPERATIONAL");

    const result = computeCanonicalLabaRugi([], [], [item], "Semua");
    assert.strictEqual(result.pengeluaranMessenger, 10000);
  });

  await t.test("P0-3: Reimbursement Tol dan Tambal Ban tetap masuk ke beban kurir", () => {
    const tolItem = {
      id: 103,
      tanggal: "2026-10-30",
      jenis: "Operasional",
      messenger: "Budi Courier",
      keterangan: "Reimbursement Tol: Tol Jagorawi [Ref: RMB-003]",
      kategori: "Tol",
      reimbursementId: "RMB-003",
      in: 0,
      out: 25000,
      total: 25000,
    };

    const banItem = {
      id: 104,
      tanggal: "2026-10-30",
      jenis: "Operasional",
      messenger: "Budi Courier",
      keterangan: "Reimbursement Tambal Ban: Ban bocor saat antar berkas [Ref: RMB-004]",
      kategori: "Tambal Ban",
      reimbursementId: "RMB-004",
      in: 0,
      out: 20000,
      total: 20000,
    };

    assert.strictEqual(classifyFinancialTransaction(tolItem), "MESSENGER_OPERATIONAL");
    assert.strictEqual(classifyFinancialTransaction(banItem), "MESSENGER_OPERATIONAL");

    const result = computeCanonicalLabaRugi([], [], [tolItem, banItem], "Semua");
    assert.strictEqual(result.pengeluaranMessenger, 45000);
  });

  await t.test("P0-4: Reimbursement Samsat pass-through dikeluarkan dari beban kurir untuk mencegah double-counting", () => {
    const passThroughItem = {
      id: 105,
      tanggal: "2026-10-30",
      jenis: "Talangan Samsat",
      messenger: "Budi Courier",
      keterangan: "Talangan Pembayaran PKB Resmi Samsat Cibinong [Ref: RMB-005]",
      kategori: "Talangan Samsat",
      in: 0,
      out: 850000,
      total: 850000,
    };

    const classification = classifyFinancialTransaction(passThroughItem);
    assert.strictEqual(classification, "SAMSAT_PASS_THROUGH");

    const result = computeCanonicalLabaRugi([], [], [passThroughItem], "Semua");
    assert.strictEqual(result.pengeluaranMessenger, 0, "Pass-through Samsat harus bernilai 0 di beban operasional kurir");
  });

  await t.test("P0-5: Deskripsi transaksi mengandung kata 'pajak' tetapi operasional tetap masuk beban kurir", () => {
    const itemWithPajakWord = {
      id: 106,
      tanggal: "2026-10-30",
      jenis: "Operasional",
      messenger: "Joko Courier",
      keterangan: "Bensin untuk antar berkas pengesahan pajak tahunan STNK ke loket",
      kategori: "Bensin",
      in: 0,
      out: 35000,
      total: 35000,
    };

    const classification = classifyFinancialTransaction(itemWithPajakWord);
    assert.strictEqual(classification, "MESSENGER_OPERATIONAL");

    const result = computeCanonicalLabaRugi([], [], [itemWithPajakWord], "Semua");
    assert.strictEqual(result.pengeluaranMessenger, 35000);
  });

  await t.test("P0-6: Deskripsi bebas tidak boleh mengubah klasifikasi yang sudah ditentukan transaction type", () => {
    const itemExplicitType = {
      id: 107,
      tanggal: "2026-10-30",
      jenis: "Operasional",
      messenger: "Joko Courier",
      keterangan: "Biaya bayar pajak stnk dan samsat resmi", // descriptive words indicate samsat/pajak
      classification: "MESSENGER_OPERATIONAL", // but explicit metadata is set
      in: 0,
      out: 15000,
      total: 15000,
    };

    const classification = classifyFinancialTransaction(itemExplicitType);
    assert.strictEqual(classification, "MESSENGER_OPERATIONAL");
  });

  // ─── PHASE 2 — P1: VOID PAYOUT ISOLATION ────────────────────────────────────

  await t.test("P1-1: Void refund membatalkan payout refund tanpa mengubah cashback status", () => {
    const orderPayload = {
      customer: "Pelanggan Dual Payout",
      nomorHP: "081299998888",
      layanan: "Balik Nama Kendaraan",
      nopol: "B 5555 DUAL",
      biayaJasa: 300000,
      biayaAntarJemput: 50000,
      totalBiaya: 1000000,
      wilayahSamsatAsal: "Jakarta Timur",
      isCostVerified: true,
      isVerified: true,
      approvedBySpv: "SPV B2.2",
      currentStep: 7,
      costCompletenessStatus: "COMPLETE",
      cashback: 50000,
      costSnapshot: {
        totalEstimasi: 1000000,
        biayaJasa: 300000,
        biayaSamsat: 650000,
        biayaAntarJemput: 50000,
        completenessStatus: "COMPLETE",
      },
    };

    const createdOrder = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(createdOrder.orderNo);
    assert.ok(invoice);

    // Overpayment of 500.000: Paid 1.500.000 on 1.000.000 tagihan
    financeService.recordPayment(invoice.id, 1500000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      catatan: "Bayar lebih untuk pengurusan dan titipan",
    }, adminUser);

    const overpaidInv = financeService.getInvoiceById(invoice.id);
    assert.strictEqual(overpaidInv.overpayment, 500000);
    assert.strictEqual(overpaidInv.cashback, 50000);
    assert.strictEqual(overpaidInv.refundStatus, "PENDING");
    assert.strictEqual(overpaidInv.cashbackStatus, "PENDING");

    // Process refund of 500.000
    financeService.payoutCashback(invoice.id, {
      paymentType: "KELEBIHAN",
      amount: 500000,
      penerima: "Pelanggan Dual Payout",
      metode: "Transfer Bank",
      bank: "BCA",
      noRekening: "1234567890",
      namaRekening: "Pelanggan Dual Payout",
    }, adminUser);

    // Process cashback of 50.000
    financeService.payoutCashback(invoice.id, {
      paymentType: "KOMISI",
      amount: 50000,
      penerima: "Partner Rekanan",
      metode: "Transfer Bank",
      bank: "Mandiri",
      noRekening: "9876543210",
      namaRekening: "Partner Rekanan",
    }, adminUser);

    const bothPaidInv = financeService.getInvoiceById(invoice.id);
    assert.strictEqual(bothPaidInv.refundStatus, "PROCESSED");
    assert.strictEqual(bothPaidInv.cashbackStatus, "REALIZED");
    assert.strictEqual(bothPaidInv.payoutHistory?.length, 2);

    // 1. Void ONLY the refund payout (500.000)
    const voidedRefundInv = financeService.voidCashbackPayout(
      invoice.id,
      "Salah nomor rekening tujuan transfer pengembalian dana",
      spvUser,
      { payoutType: "KELEBIHAN" }
    );

    // Assert: refundStatus is reset to PENDING, cashbackStatus remains REALIZED!
    assert.strictEqual(voidedRefundInv.refundStatus, "PENDING");
    assert.strictEqual(voidedRefundInv.remainingRefund, 500000);
    assert.strictEqual(voidedRefundInv.cashbackStatus, "REALIZED", "Cashback status must remain REALIZED when refund is voided");

    // 2. Void ONLY the cashback payout (50.000)
    const voidedCashbackInv = financeService.voidCashbackPayout(
      invoice.id,
      "Koreksi pembatalan komisi rekanan karena klaim ganda",
      spvUser,
      { payoutType: "KOMISI" }
    );

    assert.strictEqual(voidedCashbackInv.cashbackStatus, "PENDING");
    assert.strictEqual(voidedCashbackInv.refundStatus, "PENDING", "Refund status must remain PENDING");

    // 3. Duplicate void attempt on already voided refund should be rejected
    assert.throws(
      () => {
        financeService.voidCashbackPayout(
          invoice.id,
          "Percobaan void kedua kali pada transaksi yang sama",
          spvUser,
          { payoutType: "KELEBIHAN" }
        );
      },
      (err: unknown) => err instanceof ApiError && err.code === "ALREADY_VOIDED"
    );

    // 4. Void targeting a nonexistent payoutId should be rejected with 404
    assert.throws(
      () => {
        financeService.voidCashbackPayout(
          invoice.id,
          "Alasan void dengan id fiktif",
          spvUser,
          { payoutId: "payout-non-existent-999" }
        );
      },
      (err: unknown) => err instanceof ApiError && err.code === "NOT_FOUND"
    );
  });

  // ─── PHASE 3 — P1: PARTIAL REFUND LIFECYCLE ─────────────────────────────────

  await t.test("P1-2: Refund parsial melacak sisa kewajiban dan dapat dilunasi secara bertahap", () => {
    const orderPayload = {
      customer: "Pelanggan Cicil Refund",
      nomorHP: "081288887777",
      layanan: "Mutasi Masuk Daerah",
      nopol: "B 7777 PARTIAL",
      biayaJasa: 200000,
      totalBiaya: 500000,
      wilayahSamsatAsal: "Jakarta Pusat",
      isCostVerified: true,
      isVerified: true,
      approvedBySpv: "SPV B2.2",
      currentStep: 7,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 500000,
        biayaJasa: 200000,
        biayaSamsat: 300000,
        completenessStatus: "COMPLETE",
      },
    };

    const createdOrder = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(createdOrder.orderNo);
    assert.ok(invoice);

    // Customer pays 1.000.000 on 500.000 tagihan -> Overpayment = 500.000
    financeService.recordPayment(invoice.id, 1000000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
    }, adminUser);

    const invAfterPay = financeService.getInvoiceById(invoice.id);
    assert.strictEqual(invAfterPay.overpayment, 500000);
    assert.strictEqual(invAfterPay.refundStatus, "PENDING");

    // Partial Refund 1: Pay 300.000 out of 500.000
    const invPartial1 = financeService.payoutCashback(invoice.id, {
      paymentType: "KELEBIHAN",
      amount: 300000,
      penerima: "Pelanggan Cicil Refund",
      metode: "Transfer Bank",
      bank: "BCA",
      noRekening: "1122334455",
      namaRekening: "Pelanggan Cicil Refund",
    }, adminUser);

    assert.strictEqual(invPartial1.refundStatus, "PARTIALLY_REFUNDED");
    assert.strictEqual(invPartial1.refundedAmount, 300000);
    assert.strictEqual(invPartial1.remainingRefund, 200000);

    // Attempting to refund 300.000 when remaining is 200.000 should be rejected
    assert.throws(
      () => {
        financeService.payoutCashback(invoice.id, {
          paymentType: "KELEBIHAN",
          amount: 300000,
          penerima: "Pelanggan Cicil Refund",
          metode: "Transfer Bank",
          bank: "BCA",
          noRekening: "1122334455",
          metode: "Transfer Bank",
          bank: "BCA",
          noRekening: "1122334455",
        }, adminUser);
      },
      (err: unknown) => err instanceof ApiError && err.code === "EXCEEDS_LIMIT"
    );

    // Partial Refund 2: Pay remaining 200.000
    const invPartial2 = financeService.payoutCashback(invoice.id, {
      paymentType: "KELEBIHAN",
      amount: 200000,
      penerima: "Pelanggan Cicil Refund",
      metode: "Transfer Bank",
      bank: "BCA",
      noRekening: "1122334455",
      namaRekening: "Pelanggan Cicil Refund",
    }, adminUser);

    assert.strictEqual(invPartial2.refundStatus, "PROCESSED");
    assert.strictEqual(invPartial2.refundedAmount, 500000);
    assert.strictEqual(invPartial2.remainingRefund, 0);

    // Attempting further refund when remaining is 0 should be rejected
    assert.throws(
      () => {
        financeService.payoutCashback(invoice.id, {
          paymentType: "KELEBIHAN",
          amount: 50000,
          penerima: "Pelanggan Cicil Refund",
          metode: "Transfer Bank",
          bank: "BCA",
          noRekening: "1122334455",
        }, adminUser);
      },
      (err: unknown) => err instanceof ApiError && err.code === "ALREADY_PROCESSED"
    );

    // Void the second partial payout (200.000)
    const secondPayout = invPartial2.payoutHistory?.filter(p => p.payoutType === "KELEBIHAN" && p.status === "PROCESSED")[1];
    assert.ok(secondPayout);

    const invAfterVoid = financeService.voidCashbackPayout(
      invoice.id,
      "Koreksi pembatalan pencairan termin 2 karena kesalahan nomor rekening",
      spvUser,
      { payoutId: secondPayout.id }
    );

    // Status should revert to PARTIALLY_REFUNDED and remaining liability restored to 200.000
    assert.strictEqual(invAfterVoid.refundStatus, "PARTIALLY_REFUNDED");
    assert.strictEqual(invAfterVoid.remainingRefund, 200000);
    assert.strictEqual(invAfterVoid.refundedAmount, 300000);
  });

  // ─── PHASE 4 — P2: COST CLASSIFICATION INTEGRITY ────────────────────────────

  await t.test("P2-1: Empat kondisi biaya Samsat (ACTUAL_COST, ESTIMATED_COST, UNCONFIGURED, EXPLICIT_ZERO) dapat dibedakan", () => {
    // 1. ACTUAL_COST (biaya aktual diverifikasi > 0)
    assert.strictEqual(classifyCost(150000, { isVerified: true }), "ACTUAL_COST");

    // 2. ESTIMATED_COST (biaya estimasi master data)
    assert.strictEqual(classifyCost(150000, { isVerified: false }), "ESTIMATED_COST");

    // 3. UNCONFIGURED (undefined / null / 0 tanpa bendera eksplisit)
    assert.strictEqual(classifyCost(undefined), "UNCONFIGURED");
    assert.strictEqual(classifyCost(null), "UNCONFIGURED");
    assert.strictEqual(classifyCost(0), "UNCONFIGURED"); // 0 without explicit zero flag is unconfigured!

    // 4. EXPLICIT_ZERO (resmi bebas pajak dengan bendera isExplicitZero)
    assert.strictEqual(classifyCost(0, { isExplicitZero: true }), "EXPLICIT_ZERO");
  });

  // ─── PHASE 5 — P2: PROFIT SEMANTICS ─────────────────────────────────────────

  await t.test("P2-2: Semantik profit membedakan Gross Service Margin dan Net Transaction Margin", () => {
    const metrics = calculateInvoiceProfitMetrics({
      dibayar: 1500000,
      totalTagihan: 1000000,
      biayaSamsat: 600000,
      biayaAntarJemput: 50000,
      cashback: 100000,
    });

    // Recognized revenue strictly capped at totalTagihan (excludes 500.000 overpayment)
    assert.strictEqual(metrics.recognizedRevenue, 1000000);
    assert.strictEqual(metrics.biayaSamsat, 600000);

    // Gross Service Margin = recognizedRevenue - biayaSamsat
    assert.strictEqual(metrics.grossServiceMargin, 400000);

    // Net Transaction Margin = grossServiceMargin - antarJemput - cashback
    // 400.000 - 50.000 - 100.000 = 250.000
    assert.strictEqual(metrics.netTransactionMargin, 250000);
  });

  // ─── PHASE 6 — P3: INVOICE A5 DATA VALIDATION ───────────────────────────────

  await t.test("P3-1: Validasi data invoice A5 mencegah status lunas palsu ketika total bernilai 0", () => {
    const evaluateA5State = (data: any) => {
      const isUnloaded = !data || Object.keys(data).length === 0;
      const isExplicitZero = Boolean(data.isExplicitZero || data.is_explicit_zero || data.isZeroCostPromotion);
      const hasSnapshot = Boolean(data.costSnapshot || data.costBreakdown || data.estimationResult || data.biayaJasa !== undefined || data.biayaSamsat !== undefined);

      const rawTotal = (typeof data["Total Tagihan Konsumen"] === "number")
        ? data["Total Tagihan Konsumen"]
        : (typeof data.totalBiaya === "number")
        ? data.totalBiaya
        : (typeof data.totalTagihan === "number")
        ? data.totalTagihan
        : undefined;

      const isInvalidData = !isUnloaded && (
        rawTotal === undefined ||
        isNaN(Number(rawTotal)) ||
        Number(rawTotal) < 0 ||
        (!data.nopol && !data.customer && !data.orderNo)
      );
      const isNoSnapshot = !isUnloaded && !hasSnapshot && (rawTotal === 0 || rawTotal === undefined);
      const isValidZero = !isUnloaded && !isInvalidData && rawTotal === 0 && isExplicitZero;

      const total = rawTotal !== undefined && !isNaN(Number(rawTotal)) && Number(rawTotal) >= 0 ? Number(rawTotal) : 0;
      const dibayar = Number(data.dibayar || 0);
      const sisa = Number(data.sisa || 0);
      const kurang = sisa > 0 ? sisa : Math.max(0, total - dibayar);

      const isLunas = isValidZero || (total > 0 && kurang <= 0 && !isInvalidData && !isNoSnapshot);

      return { isUnloaded, isInvalidData, isNoSnapshot, isValidZero, isLunas, total, kurang };
    };

    // Case 1: Corrupt invoice with total 0 and no snapshot
    const corruptInvoice = {
      orderNo: "ORD-CORRUPT-001",
      customer: "Pelanggan Error",
      nopol: "B 0000 ERR",
      totalTagihan: 0,
      dibayar: 0,
      sisa: 0,
    };
    const state1 = evaluateA5State(corruptInvoice);
    assert.strictEqual(state1.isNoSnapshot, true);
    assert.strictEqual(state1.isLunas, false, "Invoice 0 tanpa snapshot tidak boleh berstatus LUNAS");

    // Case 2: Explicit zero cost promotion / waiver
    const promotionalInvoice = {
      orderNo: "ORD-PROMO-001",
      customer: "Pelanggan Promo",
      nopol: "B 1234 PROMO",
      totalTagihan: 0,
      dibayar: 0,
      sisa: 0,
      isExplicitZero: true,
      costSnapshot: { completenessStatus: "COMPLETE" },
    };
    const state2 = evaluateA5State(promotionalInvoice);
    assert.strictEqual(state2.isValidZero, true);
    assert.strictEqual(state2.isLunas, true, "Invoice 0 resmi bebas biaya (explicit zero) valid berstatus Lunas");

    // Case 3: Empty unloaded state
    const unloadedState = evaluateA5State({});
    assert.strictEqual(unloadedState.isUnloaded, true);
    assert.strictEqual(unloadedState.isLunas, false);
  });
});
