import test from "node:test";
import assert from "node:assert/strict";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { ApiError } from "../server/src/middleware/errorHandler";
import { financeStore } from "../src/app/data/financeStore";
import { computeCanonicalLabaRugi } from "../src/domain/finance/labaRugiCanonical";
import { classifyCost } from "../src/domain/finance/types";

test("Phase B2: Financial Logic Correction & Reconciliation Test Suite", async (t) => {
  const adminUser = {
    userId: "usr-admin-b2",
    nama: "Admin B2",
    role: "admin",
    email: "admin@birojasa.com",
  };

  const spvUser = {
    userId: "usr-spv-b2",
    nama: "SPV B2",
    role: "supervisor",
    email: "spv@birojasa.com",
  };

  await t.test("Scenario 1: Order dengan pembayaran tepat sesuai tagihan (exact payment)", () => {
    const orderPayload = {
      customer: "Pelanggan Tepat",
      nomorHP: "081211112222",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1001 EXACT",
      biayaJasa: 150000,
      biayaAntarJemput: 50000,
      totalBiaya: 1000000,
      wilayahSamsatAsal: "Jakarta Selatan",
      isCostVerified: true,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 1000000,
        biayaJasa: 150000,
        biayaSamsat: 800000,
        biayaAntarJemput: 50000,
        completenessStatus: "COMPLETE",
      },
      payment: {
        totalBiaya: 1000000,
        dibayar: 1000000,
        metodePembayaran: "Transfer Bank",
        isPaymentVerified: true,
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo);

    assert.ok(invoice, "Invoice harus berhasil dibuat");
    assert.strictEqual(invoice.totalTagihan, 1000000);
    assert.strictEqual(invoice.dibayar, 1000000);
    assert.strictEqual(invoice.sisa, 0);
    assert.strictEqual(invoice.overpayment, 0);
    assert.strictEqual(invoice.status, "PAID");
    assert.strictEqual(invoice.settlementCondition, "BALANCED");
    assert.strictEqual(invoice.refundStatus, "NONE");
    assert.strictEqual(order.payment.statusPembayaran, "Lunas");
    assert.strictEqual(order.payment.kurang, 0);
  });

  await t.test("Scenario 2: Order dengan pembayaran sebagian (partial payment)", () => {
    const orderPayload = {
      customer: "Pelanggan Cicil",
      nomorHP: "081233334444",
      layanan: "Balik Nama Kendaraan",
      nopol: "B 1002 PARTIAL",
      biayaJasa: 300000,
      biayaAntarJemput: 50000,
      totalBiaya: 1000000,
      wilayahSamsatAsal: "Jakarta Timur",
      isCostVerified: true,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 1000000,
        biayaJasa: 300000,
        biayaSamsat: 650000,
        biayaAntarJemput: 50000,
        completenessStatus: "COMPLETE",
      },
      payment: {
        totalBiaya: 1000000,
        dibayar: 400000,
        metodePembayaran: "Transfer Bank",
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo);

    assert.ok(invoice, "Invoice harus berhasil dibuat");
    assert.strictEqual(invoice.totalTagihan, 1000000);
    assert.strictEqual(invoice.dibayar, 400000);
    assert.strictEqual(invoice.sisa, 600000);
    assert.strictEqual(invoice.overpayment, 0);
    assert.strictEqual(invoice.status, "PARTIAL");
    assert.strictEqual(invoice.settlementCondition, "UNDERPAID");
    assert.strictEqual(invoice.refundStatus, "NONE");
    assert.strictEqual(order.payment.statusPembayaran, "Kurang");
    assert.strictEqual(order.payment.kurang, 600000);
  });

  await t.test("Scenario 3: Order dengan pembayaran lebih (overpayment)", () => {
    const orderPayload = {
      customer: "Pelanggan Lebih Bayar",
      nomorHP: "081255556666",
      layanan: "Perpanjangan STNK",
      nopol: "B 1003 OVERPAY",
      biayaJasa: 500000,
      biayaAntarJemput: 0,
      totalBiaya: 862000,
      wilayahSamsatAsal: "Jakarta Barat",
      isCostVerified: true,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 862000,
        biayaJasa: 500000,
        biayaSamsat: 362000,
        biayaAntarJemput: 0,
        completenessStatus: "COMPLETE",
      },
      payment: {
        totalBiaya: 862000,
        dibayar: 10000000, // Bayar 10 juta untuk tagihan 862 ribu
        metodePembayaran: "Transfer Bank",
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo);

    assert.ok(invoice, "Invoice harus berhasil dibuat");
    assert.strictEqual(invoice.totalTagihan, 862000);
    assert.strictEqual(invoice.dibayar, 10000000, "Nominal pembayaran asli 10 juta tidak boleh dipotong Math.min");
    assert.strictEqual(invoice.sisa, 0);
    assert.strictEqual(invoice.overpayment, 9138000, "Overpayment harus 10.000.000 - 862.000 = 9.138.000");
    assert.strictEqual(invoice.status, "OVERPAID");
    assert.strictEqual(invoice.settlementCondition, "OVERPAID");
    assert.strictEqual(invoice.refundStatus, "PENDING");
    assert.strictEqual(order.payment.statusPembayaran, "Kelebihan Bayar");
    assert.strictEqual(order.payment.overpayment, 9138000);
  });

  await t.test("Scenario 4: Overpayment tidak menambah profit perusahaan", () => {
    const orderPayload = {
      customer: "Pelanggan Trust Fund",
      nomorHP: "081277778888",
      layanan: "Mutasi Berkas",
      nopol: "B 1004 PROFIT",
      biayaJasa: 500000,
      biayaAntarJemput: 0,
      totalBiaya: 862000,
      wilayahSamsatAsal: "Jakarta Utara",
      isCostVerified: true,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 862000,
        biayaJasa: 500000,
        biayaSamsat: 362000,
        biayaAntarJemput: 0,
        completenessStatus: "COMPLETE",
      },
      payment: {
        totalBiaya: 862000,
        dibayar: 10000000,
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo);

    assert.ok(invoice);
    // Recognized revenue is capped at total tagihan 862.000. Samsat cost is 362.000. Max profit = 500.000.
    // Overpayment of 9.138.000 must NOT inflate company profit!
    assert.strictEqual(
      invoice.profit,
      500000,
      "Profit invoice tidak boleh memasukkan overpayment, harus tepat 500.000"
    );
  });

  await t.test("Scenario 5: Void pembayaran menghitung ulang total valid payment", () => {
    // Buat order dan invoice tagihan 1.000.000 belum bayar
    const orderPayload = {
      customer: "Pelanggan Multi Cicil",
      nomorHP: "081299990000",
      layanan: "Perpanjangan STNK",
      nopol: "B 1005 VOID1",
      biayaJasa: 200000,
      biayaAntarJemput: 0,
      totalBiaya: 1000000,
      wilayahSamsatAsal: "Jakarta Pusat",
      isCostVerified: true,
      approvedBySpv: "SPV B2",
      currentStep: 7,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 1000000,
        biayaJasa: 200000,
        biayaSamsat: 800000,
        biayaAntarJemput: 0,
        completenessStatus: "COMPLETE",
      },
      payment: {
        totalBiaya: 1000000,
        dibayar: 0,
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;

    // Catat pembayaran 1: Rp 400.000
    financeService.recordPayment(invoice.id, 400000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      catatan: "Cicilan 1",
    }, adminUser);

    // Catat pembayaran 2: Rp 600.000 (Lunas)
    financeService.recordPayment(invoice.id, 600000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      catatan: "Cicilan 2",
    }, adminUser);

    const invAfterPay2 = dbFinanceRepository.getInvoiceById(invoice.id)!;
    assert.strictEqual(invAfterPay2.dibayar, 1000000);
    assert.strictEqual(invAfterPay2.status, "PAID");

    // Ambil payment ke-2
    const payments = dbFinanceRepository.getPaymentsByInvoiceNo(invoice.invoiceNo);
    assert.strictEqual(payments.length, 2);
    const payment2 = payments[1];

    // SPV melakukan void pembayaran ke-2
    financeService.voidInvoicePayment(
      invoice.id,
      payment2.id,
      "Salah transfer nominal ganda dari rekening customer",
      spvUser
    );

    // Verifikasi recalculation berbasis valid non-void payments
    const validPayments = dbFinanceRepository.getValidPaymentsTotal(invoice.invoiceNo);
    assert.strictEqual(validPayments, 400000, "Valid payments setelah void pembayaran 2 harus 400.000");

    const invAfterVoid = dbFinanceRepository.getInvoiceById(invoice.id)!;
    assert.strictEqual(invAfterVoid.dibayar, 400000);
    assert.strictEqual(invAfterVoid.sisa, 600000);
    assert.strictEqual(invAfterVoid.status, "PARTIAL");

    const orderAfterVoid = dbOrderRepository.getByOrderNo(order.orderNo)!;
    assert.strictEqual(orderAfterVoid.payment.dibayar, 400000);
    assert.strictEqual(orderAfterVoid.payment.kurang, 600000);
    assert.strictEqual(orderAfterVoid.payment.statusPembayaran, "Kurang");
  });

  await t.test("Scenario 6: Void pembayaran mengoreksi overpayment dan status settlement", () => {
    const orderPayload = {
      customer: "Pelanggan Void Overpay",
      nomorHP: "081211223344",
      layanan: "Mutasi Masuk",
      nopol: "B 1006 VOID2",
      biayaJasa: 300000,
      biayaAntarJemput: 0,
      totalBiaya: 1000000,
      wilayahSamsatAsal: "Jakarta Barat",
      isCostVerified: true,
      approvedBySpv: "SPV B2",
      currentStep: 7,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 1000000,
        biayaJasa: 300000,
        biayaSamsat: 700000,
        biayaAntarJemput: 0,
        completenessStatus: "COMPLETE",
      },
      payment: {
        totalBiaya: 1000000,
        dibayar: 0,
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;

    // Catat pembayaran lebih: Rp 1.500.000
    financeService.recordPayment(invoice.id, 1500000, {
      metodePembayaran: "Transfer Bank",
      bank: "BCA",
      catatan: "Transfer lebih",
    }, adminUser);

    const invOverpaid = dbFinanceRepository.getInvoiceById(invoice.id)!;
    assert.strictEqual(invOverpaid.overpayment, 500000);
    assert.strictEqual(invOverpaid.settlementCondition, "OVERPAID");
    assert.strictEqual(invOverpaid.status, "OVERPAID");

    const payments = dbFinanceRepository.getPaymentsByInvoiceNo(invoice.invoiceNo);
    const payment = payments[0];

    // SPV batalkan (void) pembayaran
    financeService.voidInvoicePayment(
      invoice.id,
      payment.id,
      "Salah input rekening transaksi pelanggan lain",
      spvUser
    );

    const invAfterVoid = dbFinanceRepository.getInvoiceById(invoice.id)!;
    assert.strictEqual(invAfterVoid.dibayar, 0);
    assert.strictEqual(invAfterVoid.sisa, 1000000);
    assert.strictEqual(invAfterVoid.overpayment, 0, "Overpayment harus kembali 0");
    assert.strictEqual(invAfterVoid.settlementCondition, "UNDERPAID", "Settlement condition harus UNDERPAID");
    assert.strictEqual(invAfterVoid.refundStatus, "NONE", "Refund status harus NONE");
    assert.strictEqual(invAfterVoid.status, "UNPAID");

    const orderAfterVoid = dbOrderRepository.getByOrderNo(order.orderNo)!;
    assert.strictEqual(orderAfterVoid.payment.statusPembayaran, "Belum Lunas");
    assert.strictEqual(orderAfterVoid.payment.overpayment, 0);
  });

  await t.test("Scenario 7: Status pembayaran order dan invoice tetap konsisten", () => {
    // Form client mengirim string inkonsisten "Belum Lunas", tapi dibayar penuh
    const orderPayload = {
      customer: "Pelanggan Sinkron",
      nomorHP: "081299887766",
      layanan: "Perpanjangan STNK",
      nopol: "B 1007 SYNC",
      biayaJasa: 200000,
      biayaAntarJemput: 0,
      totalBiaya: 500000,
      wilayahSamsatAsal: "Jakarta Selatan",
      isCostVerified: true,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 500000,
        biayaJasa: 200000,
        biayaSamsat: 300000,
        biayaAntarJemput: 0,
        completenessStatus: "COMPLETE",
      },
      payment: {
        totalBiaya: 500000,
        dibayar: 500000,
        statusPembayaran: "Belum Lunas", // Form mentah yang salah
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;

    // Sistem harus menolak status mentah yang salah dan menetapkan Lunas / PAID
    assert.strictEqual(invoice.status, "PAID");
    assert.strictEqual(order.payment.statusPembayaran, "Lunas");
  });

  await t.test("Scenario 8: Idempotency key melindungi retry pembayaran", () => {
    const orderPayload = {
      customer: "Pelanggan Idempotent",
      nomorHP: "081233441122",
      layanan: "Perpanjangan STNK",
      nopol: "B 1008 IDEM",
      biayaJasa: 200000,
      biayaAntarJemput: 0,
      totalBiaya: 1000000,
      wilayahSamsatAsal: "Jakarta Timur",
      isCostVerified: true,
      approvedBySpv: "SPV B2",
      currentStep: 7,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 1000000,
        biayaJasa: 200000,
        biayaSamsat: 800000,
        biayaAntarJemput: 0,
        completenessStatus: "COMPLETE",
      },
      payment: {
        totalBiaya: 1000000,
        dibayar: 0,
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;

    const idempotencyKey = "PAY-IDEM-KEY-UNIQUE-001";

    // Request pertama: bayar 400.000
    const res1 = financeService.recordPayment(invoice.id, 400000, {
      idempotencyKey,
      metodePembayaran: "Transfer BCA",
      bank: "BCA",
    }, adminUser);

    assert.strictEqual(res1.dibayar, 400000);

    // Request retry identik: harus sukses tanpa double-charge
    const res2 = financeService.recordPayment(invoice.id, 400000, {
      idempotencyKey,
      metodePembayaran: "Transfer BCA",
      bank: "BCA",
    }, adminUser);

    assert.strictEqual(res2.dibayar, 400000, "Retry tidak boleh menduplikasi uang masuk");

    // Request dengan key sama tapi nominal berbeda harus ditolak 409
    assert.throws(
      () => {
        financeService.recordPayment(invoice.id, 500000, {
          idempotencyKey,
          metodePembayaran: "Transfer BCA",
          bank: "BCA",
        }, adminUser);
      },
      (err: any) => err instanceof ApiError && err.statusCode === 409
    );
  });

  await t.test("Scenario 9: Explicit zero Samsat cost tetap 0, bukan fallback", () => {
    const orderPayload = {
      customer: "Pelanggan Nol Samsat",
      nomorHP: "081244556677",
      layanan: "Konsultasi Legalitas",
      nopol: "B 1009 ZERO",
      biayaJasa: 250000,
      biayaAntarJemput: 0,
      totalBiaya: 250000,
      wilayahSamsatAsal: "Jakarta Barat",
      isCostVerified: true,
      costCompletenessStatus: "COMPLETE",
      costSnapshot: {
        totalEstimasi: 250000,
        biayaJasa: 250000,
        biayaSamsat: 0, // Eksplisit Rp 0
        biayaAntarJemput: 0,
        completenessStatus: "COMPLETE",
      },
      payment: {
        totalBiaya: 250000,
        dibayar: 250000,
      },
    };

    const order = orderService.createOrder(orderPayload, adminUser);
    const invoice = dbFinanceRepository.getInvoiceByOrderNo(order.orderNo)!;

    // Biaya Samsat 0 TIDAK boleh diubah menjadi totalTagihan * 0.75 (187.500)
    assert.strictEqual(invoice.biayaSamsat, 0, "Biaya Samsat eksplisit Rp0 harus tetap 0");
    assert.strictEqual(invoice.profit, 250000, "Profit harus tetap 250.000");
  });

  await t.test("Scenario 10: Unconfigured Samsat cost tidak berubah menjadi fallback 75%", () => {
    // Tambah invoice tanpa biayaSamsat
    const inv = financeStore.addInvoice({
      customer: "Pelanggan Unconfigured",
      totalTagihan: 400000,
      terbayar: 400000,
      // biayaSamsat undefined
    });

    assert.strictEqual(inv.biayaSamsat, 0, "Biaya Samsat tanpa konfigurasi tidak boleh berubah jadi 75% (300.000)");
  });

  await t.test("Scenario 11: Estimated cost dapat dibedakan dari verified actual cost", () => {
    const verifiedCost = classifyCost(150000, { isVerified: true });
    const estimatedCost = classifyCost(150000, { isVerified: false });
    const explicitZeroCost = classifyCost(0, { isExplicitZero: true });
    const unconfiguredCost = classifyCost(undefined, { isUnconfigured: true });

    assert.strictEqual(verifiedCost, "ACTUAL_COST");
    assert.strictEqual(estimatedCost, "ESTIMATED_COST");
    assert.strictEqual(explicitZeroCost, "EXPLICIT_ZERO");
    assert.strictEqual(unconfiguredCost, "UNCONFIGURED");
  });

  await t.test("Scenario 12: Customer refund terpisah dari partner cashback", () => {
    // Tambahkan invoice dengan overpayment ke financeStore
    const invRefund = financeStore.addInvoice({
      orderNo: "ORD-REFUND-ONLY-01",
      customer: "Pelanggan Refund Only",
      totalTagihan: 1000000,
      terbayar: 1500000,
      overpayment: 500000,
      settlementCondition: "OVERPAID",
      refundStatus: "PENDING",
      cashback: 0, // Tidak ada cashback rekanan
      cashbackStatus: "APPROVED",
    });

    const refundList = financeStore.getRefundPendingList();
    const cashbackList = financeStore.getCashbackPendingList();

    const inRefund = refundList.some((item) => item.orderNo === "ORD-REFUND-ONLY-01" || item.id === invRefund.id);
    const inCashback = cashbackList.some((item) => item.orderNo === "ORD-REFUND-ONLY-01" || item.id === invRefund.id);

    assert.strictEqual(inRefund, true, "Kelebihan bayar konsumen HARUS masuk ke getRefundPendingList()");
    assert.strictEqual(inCashback, false, "Kelebihan bayar konsumen TIDAK BOLEH masuk ke getCashbackPendingList()");
  });

  await t.test("Scenario 13: Partner cashback tidak masuk ke daftar refund pelanggan", () => {
    // Tambahkan invoice dengan cashback rekanan tanpa overpayment
    const invCashback = financeStore.addInvoice({
      orderNo: "ORD-CASHBACK-ONLY-01",
      customer: "Rekanan Komisi Only",
      totalTagihan: 1000000,
      terbayar: 1000000,
      overpayment: 0,
      settlementCondition: "BALANCED",
      refundStatus: "NONE",
      cashback: 100000, // Ada komisi rekanan
      cashbackStatus: "PENDING",
    });

    const refundList = financeStore.getRefundPendingList();
    const cashbackList = financeStore.getCashbackPendingList();

    const inRefund = refundList.some((item) => item.orderNo === "ORD-CASHBACK-ONLY-01" || item.id === invCashback.id);
    const inCashback = cashbackList.some((item) => item.orderNo === "ORD-CASHBACK-ONLY-01" || item.id === invCashback.id);

    assert.strictEqual(inCashback, true, "Komisi rekanan HARUS masuk ke getCashbackPendingList()");
    assert.strictEqual(inRefund, false, "Komisi rekanan TIDAK BOLEH masuk ke getRefundPendingList()");
  });

  await t.test("Scenario 14: Profit calculation tidak memasukkan dana titipan/overpayment", () => {
    const invoices: any[] = [
      {
        id: 1,
        invoiceNo: "INV-PROF-01",
        customer: "PT Pelanggan",
        totalTagihan: 862000,
        dibayar: 10000000,
        terbayar: 10000000,
        biayaSamsat: 362000,
        profit: 500000,
        status: "Lunas",
        tanggal: "2026-10-30",
      },
    ];

    const result = computeCanonicalLabaRugi(invoices, [], [], "all");

    // Total pemasukan recognized revenue tidak boleh 10 juta
    assert.strictEqual(result.totalPemasukan, 862000, "Total pemasukan harus berbasis recognized revenue 862.000");
    assert.strictEqual(result.totalBiayaSamsat, 362000, "Biaya Samsat harus 362.000");
    assert.strictEqual(result.totalPendapatanJasa, 500000, "Pendapatan jasa harus 500.000 (tidak ada kebocoran overpayment ke laba)");
  });

  await t.test("Scenario 15: Reimbursement Samsat tidak dihitung dua kali pada Laba Rugi", () => {
    const invoices: any[] = [
      {
        id: 1,
        invoiceNo: "INV-SAMSAT-01",
        customer: "PT Armada Jaya",
        totalTagihan: 1000000,
        dibayar: 1000000,
        terbayar: 1000000,
        biayaSamsat: 700000, // Biaya resmi Samsat
        profit: 300000,
        status: "Lunas",
        tanggal: "2026-10-30",
      },
    ];

    // Kas messenger mencatat pengeluaran lapangan untuk reimbursement PKB Samsat
    const kasMessengerList: any[] = [
      {
        id: 1,
        tanggal: "2026-10-30",
        jenis: "Reimbursement",
        messenger: "Andi Messenger",
        keterangan: "Reimbursement PKB Samsat Armada",
        in: 0,
        out: 700000,
        total: 0,
      },
      {
        id: 2,
        tanggal: "2026-10-30",
        jenis: "Bensin",
        messenger: "Andi Messenger",
        keterangan: "Beli bensin motor operasional",
        in: 0,
        out: 50000,
        total: 0,
      },
    ];

    const result = computeCanonicalLabaRugi(invoices, [], kasMessengerList, "all");

    assert.strictEqual(result.totalBiayaSamsat, 700000, "Biaya Samsat dari invoice tercatat 700.000");
    assert.strictEqual(result.pengeluaranMessenger, 50000, "Pengeluaran messenger HANYA mencatat bensin 50.000 (reimbursement Samsat dikecualikan)");
    assert.strictEqual(result.totalPengeluaran, 750000, "Total pengeluaran harus 750.000 (700k Samsat + 50k bensin), BUKAN 1.450.000 double counting");
    assert.strictEqual(result.labaRugiBersih, 250000, "Laba rugi bersih harus 1.000.000 - 750.000 = 250.000");
  });
});
