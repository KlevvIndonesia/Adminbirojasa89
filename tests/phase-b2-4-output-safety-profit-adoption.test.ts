import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateInvoiceProfitMetrics,
  validateDocumentFinancialData,
  classifyFinancialTransaction,
  classifyCost,
} from "../src/domain/finance/types";
import { computeCanonicalLabaRugi } from "../src/domain/finance/labaRugiCanonical";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";

test("Phase B2.4: Financial Output Safety & Canonical Profit Adoption Test Suite", async (t) => {
  const adminUser = {
    userId: "usr-admin-b24",
    nama: "Admin B2.4",
    role: "admin",
  };

  const spvUser = {
    userId: "usr-spv-b24",
    nama: "SPV B2.4",
    role: "supervisor",
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCOPE A — INVOICE & KWITANSI OUTPUT SAFETY TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("Output-1: Total tagihan Rp0 tanpa explicit-zero metadata dicegah dari status Lunas dan cetak", () => {
    const rawData = {
      orderNo: "ORD-TEST-001",
      customer: "Pelanggan Tanpa Biaya",
      nopol: "B 1234 NUL",
      totalTagihan: 0,
      dibayar: 0,
      sisaTagihan: 0,
      // No explicit zero metadata
    };

    const val = validateDocumentFinancialData(rawData);
    assert.strictEqual(val.isUnloaded, false);
    assert.strictEqual(val.isValidZero, false);
    assert.strictEqual(val.isLunas, false, "Total Rp0 tanpa explicit zero TIDAK boleh berstatus Lunas!");
    assert.strictEqual(val.isValidToPrint, false, "Total Rp0 tanpa explicit zero TIDAK boleh dapat dicetak!");
  });

  await t.test("Output-2: Total tagihan Rp0 dengan explicit-zero metadata valid diizinkan berstatus Lunas dan dapat dicetak", () => {
    const rawData = {
      orderNo: "ORD-TEST-ZERO",
      customer: "Pelanggan Promo Bebas Jasa",
      nopol: "B 8888 PRO",
      totalTagihan: 0,
      dibayar: 0,
      sisaTagihan: 0,
      isExplicitZero: true,
      costSnapshot: { completenessStatus: "COMPLETE", totalEstimasi: 0 },
    };

    const val = validateDocumentFinancialData(rawData);
    assert.strictEqual(val.isValidZero, true);
    assert.strictEqual(val.isLunas, true, "Explicit zero yang sah berstatus Lunas.");
    assert.strictEqual(val.isValidToPrint, true, "Explicit zero yang sah dapat dicetak.");
  });

  await t.test("Output-3: Snapshot tidak tersedia mencegah status Lunas dan menolak pencetakan dokumen", () => {
    const rawData = {
      orderNo: "ORD-TEST-NOSNAP",
      customer: "Pelanggan Tanpa Snapshot",
      nopol: "B 1111 NOS",
      totalTagihan: 0,
      dibayar: 0,
      sisaTagihan: 0,
      // no costSnapshot, no breakdown
    };

    const val = validateDocumentFinancialData(rawData);
    assert.strictEqual(val.isNoSnapshot, true);
    assert.strictEqual(val.isLunas, false);
    assert.strictEqual(val.isValidToPrint, false);
    assert.match(val.validationErrorMessage || "", /snapshot|rincian/i);
  });

  await t.test("Output-4: Data invoice belum dimuat (unloaded) ditandai secara eksplisit", () => {
    const emptyData = {};
    const val = validateDocumentFinancialData(emptyData);
    assert.strictEqual(val.isUnloaded, true);
    assert.strictEqual(val.isLunas, false);
    assert.strictEqual(val.isValidToPrint, false);
  });

  await t.test("Output-5: Data invoice invalid (total negatif, NaN, tanpa identitas) ditolak", () => {
    const invalidNegative = {
      orderNo: "ORD-TEST-NEG",
      customer: "Pelanggan Negatif",
      nopol: "B 2222 NEG",
      totalTagihan: -500000,
    };
    const valNeg = validateDocumentFinancialData(invalidNegative);
    assert.strictEqual(valNeg.isInvalidData, true);
    assert.strictEqual(valNeg.isValidToPrint, false);

    const invalidNoId = {
      totalTagihan: 500000,
    };
    const valNoId = validateDocumentFinancialData(invalidNoId);
    assert.strictEqual(valNoId.isInvalidData, true);
    assert.strictEqual(valNoId.isValidToPrint, false);
  });

  await t.test("Output-6: Invoice valid dengan pembayaran penuh berstatus Lunas dan siap dicetak", () => {
    const paidData = {
      orderNo: "ORD-TEST-PAID",
      customer: "Pelanggan Lunas",
      nopol: "B 3333 LNS",
      totalTagihan: 1500000,
      dibayar: 1500000,
      sisaTagihan: 0,
      costSnapshot: { completenessStatus: "COMPLETE", totalEstimasi: 1500000 },
    };

    const val = validateDocumentFinancialData(paidData);
    assert.strictEqual(val.isInvalidData, false);
    assert.strictEqual(val.isNoSnapshot, false);
    assert.strictEqual(val.isLunas, true);
    assert.strictEqual(val.isValidToPrint, true);
    assert.strictEqual(val.total, 1500000);
    assert.strictEqual(val.dibayar, 1500000);
    assert.strictEqual(val.sisa, 0);
  });

  await t.test("Output-7: Invoice valid dengan pembayaran parsial berstatus Belum Lunas namun dapat dicetak sebagai faktur tagihan", () => {
    const partialData = {
      orderNo: "ORD-TEST-PARTIAL",
      customer: "Pelanggan Cicilan",
      nopol: "B 4444 CCL",
      totalTagihan: 2000000,
      dibayar: 800000,
      sisaTagihan: 1200000,
      costSnapshot: { completenessStatus: "COMPLETE", totalEstimasi: 2000000 },
    };

    const val = validateDocumentFinancialData(partialData);
    assert.strictEqual(val.isLunas, false);
    assert.strictEqual(val.isValidToPrint, true, "Invoice parsial sah dapat dicetak sebagai tagihan");
    assert.strictEqual(val.total, 2000000);
    assert.strictEqual(val.dibayar, 800000);
    assert.strictEqual(val.sisa, 1200000);
  });

  await t.test("Output-8: Invoice valid dengan overpayment berstatus Lunas dan sisa tagihan Rp0", () => {
    const overpaidData = {
      orderNo: "ORD-TEST-OVER",
      customer: "Pelanggan Lebih Bayar",
      nopol: "B 5555 LBH",
      totalTagihan: 1000000,
      dibayar: 1500000,
      sisaTagihan: 0,
      costSnapshot: { completenessStatus: "COMPLETE", totalEstimasi: 1000000 },
    };

    const val = validateDocumentFinancialData(overpaidData);
    assert.strictEqual(val.isLunas, true);
    assert.strictEqual(val.isValidToPrint, true);
    assert.strictEqual(val.total, 1000000);
    assert.strictEqual(val.dibayar, 1500000);
    assert.strictEqual(val.sisa, 0);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SCOPE B — CANONICAL PROFIT METRICS TESTS
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("Profit-1: Gross Service Margin menghitung selisih recognized revenue dan biaya Samsat", () => {
    const metrics = calculateInvoiceProfitMetrics({
      totalTagihan: 1200000,
      dibayar: 1200000,
      biayaSamsat: 700000,
      biayaAntarJemput: 50000,
      cashback: 100000,
    });

    assert.strictEqual(metrics.recognizedRevenue, 1200000);
    assert.strictEqual(metrics.biayaSamsat, 700000);
    assert.strictEqual(metrics.grossServiceMargin, 500000);
    assert.strictEqual(metrics.isGrossDeficit, false);
  });

  await t.test("Profit-2: Net Transaction Margin mengurangkan komisi rekanan dan antar jemput dari Gross Margin", () => {
    const metrics = calculateInvoiceProfitMetrics({
      totalTagihan: 1200000,
      dibayar: 1200000,
      biayaSamsat: 700000,
      biayaAntarJemput: 50000,
      cashback: 100000,
    });

    // Net Transaction Margin = 500.000 - 50.000 - 100.000 = 350.000
    assert.strictEqual(metrics.netTransactionMargin, 350000);
    assert.strictEqual(metrics.isNetDeficit, false);
  });

  await t.test("Profit-3: Net Operating Profit dihitung secara komprehensif pada Laba Rugi", () => {
    const invoices = [
      { id: 1, totalTagihan: 1000000, dibayar: 1000000, biayaSamsat: 600000, profit: 400000 },
    ];
    const pengeluaranKantor = [
      { id: 1, tanggal: "2026-10-30", keterangan: "Listrik kantor", nominal: 100000 },
    ];
    const pengeluaranMessenger = [
      { id: 1, tanggal: "2026-10-30", jenis: "Operasional", keterangan: "Bensin kurir", out: 50000 },
    ];

    const lr = computeCanonicalLabaRugi(invoices, pengeluaranKantor, pengeluaranMessenger, "Semua");
    assert.strictEqual(lr.totalPemasukan, 1000000);
    assert.strictEqual(lr.totalBiayaSamsat, 600000);
    assert.strictEqual(lr.pengeluaranKantor, 100000);
    assert.strictEqual(lr.pengeluaranMessenger, 50000);
    assert.strictEqual(lr.totalBebanOperasional, 150000);
    assert.strictEqual(lr.totalPengeluaran, 750000);
    // Net Operating Profit = 1.000.000 - 750.000 = 250.000
    assert.strictEqual(lr.labaRugiBersih, 250000);
  });

  await t.test("Profit-4: Margin negatif (defisit) tidak disembunyikan/dijadikan nol", () => {
    // Kasus biaya Samsat melebihi pendapatan (biaya Samsat membengkak)
    const metricsDeficitGross = calculateInvoiceProfitMetrics({
      totalTagihan: 500000,
      dibayar: 500000,
      biayaSamsat: 700000,
      biayaAntarJemput: 50000,
      cashback: 0,
    });

    assert.strictEqual(metricsDeficitGross.grossServiceMargin, -200000, "Defisit gross margin harus negatif (-200k), bukan 0!");
    assert.strictEqual(metricsDeficitGross.isGrossDeficit, true);
    assert.strictEqual(metricsDeficitGross.netTransactionMargin, -250000, "Defisit net margin harus -250k!");
    assert.strictEqual(metricsDeficitGross.isNetDeficit, true);

    // Kasus komisi/antar jemput melebihi gross service margin
    const metricsDeficitNet = calculateInvoiceProfitMetrics({
      totalTagihan: 500000,
      dibayar: 500000,
      biayaSamsat: 400000, // gross margin = +100.000
      biayaAntarJemput: 50000,
      cashback: 150000,   // komisi 150.000 -> 100k - 50k - 150k = -100.000
    });

    assert.strictEqual(metricsDeficitNet.grossServiceMargin, 100000);
    assert.strictEqual(metricsDeficitNet.isGrossDeficit, false);
    assert.strictEqual(metricsDeficitNet.netTransactionMargin, -100000, "Defisit net margin harus negatif (-100k)!");
    assert.strictEqual(metricsDeficitNet.isNetDeficit, true);
  });

  await t.test("Profit-5: Overpayment tidak diakui sebagai revenue perusahaan pada metrik profit", () => {
    const metricsOverpaid = calculateInvoiceProfitMetrics({
      totalTagihan: 800000,
      dibayar: 2000000, // Kelebihan bayar 1.200.000
      biayaSamsat: 500000,
      biayaAntarJemput: 50000,
      cashback: 50000,
    });

    assert.strictEqual(metricsOverpaid.recognizedRevenue, 800000, "Revenue harus dipatok maksimum pada total tagihan (800k)");
    assert.strictEqual(metricsOverpaid.grossServiceMargin, 300000, "Gross margin = 800k - 500k = 300k");
    assert.strictEqual(metricsOverpaid.netTransactionMargin, 200000, "Net margin = 300k - 50k - 50k = 200k");
  });

  await t.test("Profit-6: Reimbursement Samsat pass-through dikeluarkan dari beban operasional kurir", () => {
    const samsatPass = {
      id: 991,
      jenis: "Operasional",
      keterangan: "Talangan Pokok PKB Samsat Depok (ORD-SAMSAT-99)",
      out: 1500000,
    };

    assert.strictEqual(classifyFinancialTransaction(samsatPass), "SAMSAT_PASS_THROUGH");

    const lr = computeCanonicalLabaRugi([], [], [samsatPass], "Semua");
    assert.strictEqual(lr.pengeluaranMessenger, 0, "Talangan Samsat tidak boleh masuk beban kurir (mencegah double-counting)");
  });

  await t.test("Profit-7: Biaya operasional kurir yang sah (bensin, tol, parkir) tetap dihitung di beban operasional", () => {
    const opexItems = [
      { id: 1, jenis: "Operasional", kategori: "Bensin", keterangan: "Bensin SPBU Sukahati", out: 50000 },
      { id: 2, jenis: "Operasional", kategori: "Tol", keterangan: "Tol Jagorawi", out: 25000 },
      { id: 3, jenis: "Operasional", kategori: "Parkir", keterangan: "Parkir Samsat", out: 10000 },
    ];

    opexItems.forEach((item) => {
      assert.strictEqual(classifyFinancialTransaction(item), "MESSENGER_OPERATIONAL");
    });

    const lr = computeCanonicalLabaRugi([], [], opexItems, "Semua");
    assert.strictEqual(lr.pengeluaranMessenger, 85000, "Beban operasional kurir harus tetap dihitung 85.000");
  });

  await t.test("Profit-8: Refund pelanggan dan cashback rekanan terisolasi dan tidak tercampur", () => {
    // Create isolated test order
    const orderPayload = {
      customer: "Dual Liability B2.4",
      nomorHP: "081299998888",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 7777 B24",
      biayaJasa: 300000,
      biayaAntarJemput: 50000,
      totalBiaya: 1000000,
      wilayahSamsatAsal: "Jakarta Selatan",
      isCostVerified: true,
      isVerified: true,
      approvedBySpv: "SPV B2.4",
      currentStep: 7,
      costCompletenessStatus: "COMPLETE",
      cashback: 75000,
      costSnapshot: {
        totalEstimasi: 1000000,
        biayaJasa: 300000,
        biayaSamsat: 650000,
        biayaAntarJemput: 50000,
        completenessStatus: "COMPLETE",
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const inv = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo);
    assert.ok(inv);

    // Overpayment of 400.000 (Paid 1.400.000 on 1.000.000 tagihan)
    financeService.recordPayment(inv.id, 1400000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
    }, adminUser);

    const paidInv = financeService.getInvoiceById(inv.id);
    assert.strictEqual(paidInv.overpayment, 400000);
    assert.strictEqual(paidInv.cashback, 75000);
    assert.strictEqual(paidInv.refundStatus, "PENDING");
    assert.strictEqual(paidInv.cashbackStatus, "PENDING");

    // Disburse customer refund
    financeService.payoutCashback(inv.id, {
      paymentType: "KELEBIHAN",
      amount: 400000,
      penerima: "Customer Bpk B24",
      metode: "Transfer Bank",
      bank: "BCA",
      noRekening: "1234567890",
      namaRekening: "Customer Bpk B24",
    }, adminUser);

    // Disburse partner cashback
    financeService.payoutCashback(inv.id, {
      paymentType: "KOMISI",
      amount: 75000,
      penerima: "Mitra Biro Jasa B24",
      metode: "Transfer Bank",
      bank: "BCA",
      noRekening: "9876543210",
      namaRekening: "Mitra Biro B24",
    }, adminUser);

    const disbursedInv = financeService.getInvoiceById(inv.id);
    assert.strictEqual(disbursedInv.refundStatus, "PROCESSED");
    assert.strictEqual(disbursedInv.cashbackStatus, "REALIZED");
    assert.strictEqual(disbursedInv.payoutHistory?.length, 2);

    // Void partner cashback ONLY
    const voidedCashback = financeService.voidCashbackPayout(
      inv.id,
      "Salah nomor rekening transfer komisi rekanan",
      spvUser,
      { payoutType: "KOMISI" }
    );

    assert.strictEqual(voidedCashback.cashbackStatus, "PENDING", "Cashback status harus ter-reset ke PENDING");
    assert.strictEqual(voidedCashback.refundStatus, "PROCESSED", "Refund status pelanggan HARUS TETAP PROCESSED (terisolasi)!");
    assert.strictEqual(voidedCashback.remainingRefund, 0);
  });
});
