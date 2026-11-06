import test from "node:test";
import assert from "node:assert";
import { db } from "../server/src/database/db";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { messengerService } from "../server/src/services/messengerService";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { computeCanonicalLabaRugi, isQuarantinedInvoice } from "../src/domain/finance/labaRugiCanonical";
import { classifyFinancialTransaction } from "../src/domain/finance/types";

const testAdmin: any = {
  userId: "2",
  nama: "Admin Test",
  role: "administrator",
  jabatan: "ADMIN",
  email: "admin@test.local",
};

const testSupervisor: any = {
  userId: "1",
  nama: "Admin Super (SVP)",
  role: "supervisor",
  jabatan: "SVP",
  email: "spv@test.local",
};

const testCourier: any = {
  userId: "4",
  nama: "Budi Santoso",
  employeeId: "EMP-0004",
  role: "messenger",
  jabatan: "MESSENGER",
  email: "budi@test.local",
};

test("CANONICAL P&L INTEGRATION & REGRESSION RECONCILIATION TEST SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM 1: INVOICE SCENARIOS (7 SCENARIOS)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("1.1: Normal Full Payment Scenario (S <= T, Proportional COGS matches exactly)", () => {
    // Tagihan 1,000,000, Biaya Jasa 300,000, Biaya Samsat 700,000, Bayar 1,000,000 (Lunas)
    const order = orderService.createOrder({
      customer: "Customer Normal Full",
      nomorHP: "081211110001",
      layanan: "Perpanjangan STNK",
      nopol: "B 1111 FLL",
      biayaJasa: 300000,
      totalEstimasi: 1000000,
      biayaSamsat: 700000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1000000,
        dibayar: 1000000,
        buktiPembayaran: { fileName: "bukti_tf1.jpg", fileType: "image", uploadedAt: new Date().toISOString() },
      },
    }, testAdmin);

    // Verify Samsat cost
    orderService.verifyOrderCost(order.orderNo, {
      finalBiayaSamsat: 700000,
      finalTotalBiaya: 1000000,
      notes: "Samsat resmi terverifikasi",
    }, testAdmin);

    // Verify payment through canonical orderService.verifyPayment
    orderService.verifyPayment(order.orderNo, testAdmin, 1000000);

    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p) => p.invoice === order.orderNo || p.nopol === "B 1111 FLL");
    assert.ok(item, "Profit item must be listed");
    assert.strictEqual(item.uangMasuk, 1000000);
    assert.strictEqual(item.eligiblePayment, 1000000);
    assert.strictEqual(item.overpayment, 0);
    assert.strictEqual(item.biayaSamsat, 700000);
    assert.strictEqual(item.matchedCOGS, 700000);
    assert.strictEqual(item.profit, 300000);
    assert.strictEqual(item.grossProfit, 300000);
    assert.strictEqual(item.holdStatus, "NONE");
  });

  await suite.test("1.2: Partial Payment Scenario (Proportional Recognized COGS & Gross Profit)", () => {
    // Tagihan 1,000,000, Biaya Jasa 300,000, Biaya Samsat 700,000, Bayar 500,000 (50%)
    const order = orderService.createOrder({
      customer: "Customer Partial Pay",
      nomorHP: "081211110002",
      layanan: "Perpanjangan STNK",
      nopol: "B 1112 PRT",
      biayaJasa: 300000,
      totalEstimasi: 1000000,
      biayaSamsat: 700000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1000000,
        dibayar: 500000,
        buktiPembayaran: { fileName: "bukti_tf2.jpg", fileType: "image", uploadedAt: new Date().toISOString() },
      },
    }, testAdmin);

    orderService.verifyOrderCost(order.orderNo, {
      finalBiayaSamsat: 700000,
      finalTotalBiaya: 1000000,
      notes: "Samsat resmi terverifikasi",
    }, testAdmin);

    orderService.verifyPayment(order.orderNo, testAdmin, 500000);

    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p) => p.nopol === "B 1112 PRT");
    assert.ok(item, "Profit item must exist");
    assert.strictEqual(item.uangMasuk, 500000);
    assert.strictEqual(item.eligiblePayment, 500000);
    assert.strictEqual(item.overpayment, 0);
    assert.strictEqual(item.biayaSamsat, 700000);
    // Alpha = 700k / 1000k = 0.7; Matched COGS = 0.7 * 500k = 350,000
    assert.strictEqual(item.matchedCOGS, 350000);
    // Gross Profit = 500k - 350k = 150,000
    assert.strictEqual(item.profit, 150000);
    assert.strictEqual(item.grossProfit, 150000);
  });

  await suite.test("1.3: Normal Overpayment Scenario (Overpayment isolated as Customer Advance)", () => {
    // Tagihan 1,000,000, Biaya Jasa 300,000, Biaya Samsat 700,000, Bayar 1,200,000 (Overpaid 200,000)
    const order = orderService.createOrder({
      customer: "Customer Normal Overpay",
      nomorHP: "081211110003",
      layanan: "Perpanjangan STNK",
      nopol: "B 1113 OVP",
      biayaJasa: 300000,
      totalEstimasi: 1000000,
      biayaSamsat: 700000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1000000,
        dibayar: 1200000,
        buktiPembayaran: { fileName: "bukti_tf3.jpg", fileType: "image", uploadedAt: new Date().toISOString() },
      },
    }, testAdmin);

    orderService.verifyOrderCost(order.orderNo, {
      finalBiayaSamsat: 700000,
      finalTotalBiaya: 1000000,
      notes: "Samsat resmi terverifikasi",
    }, testAdmin);

    orderService.verifyPayment(order.orderNo, testAdmin, 1200000);

    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p) => p.nopol === "B 1113 OVP");
    assert.ok(item, "Profit item must exist");
    assert.strictEqual(item.uangMasuk, 1200000);
    // eligiblePayment capped at totalTagihan (1,000,000)
    assert.strictEqual(item.eligiblePayment, 1000000);
    assert.strictEqual(item.overpayment, 200000);
    assert.strictEqual(item.matchedCOGS, 700000);
    // Gross profit must NOT be inflated by the 200,000 overpayment!
    assert.strictEqual(item.profit, 300000);
    assert.strictEqual(item.grossProfit, 300000);
  });

  await suite.test("1.4: Extreme Overpayment Synthetic Scenario (100 Billion Payment Capped at Tagihan)", () => {
    // Synthetic test in isolated DB: Tagihan 1,000,000, Bayar 100,000,000,000
    const order = orderService.createOrder({
      customer: "Customer Extreme Overpay",
      nomorHP: "081211110004",
      layanan: "Perpanjangan STNK",
      nopol: "B 1114 EXT",
      biayaJasa: 300000,
      totalEstimasi: 1000000,
      biayaSamsat: 700000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1000000,
        dibayar: 100000000000,
        buktiPembayaran: { fileName: "bukti_tf4.jpg", fileType: "image", uploadedAt: new Date().toISOString() },
      },
    }, testAdmin);

    orderService.verifyOrderCost(order.orderNo, {
      finalBiayaSamsat: 700000,
      finalTotalBiaya: 1000000,
      notes: "Samsat terverifikasi",
    }, testAdmin);

    orderService.verifyPayment(order.orderNo, testAdmin, 100000000000);

    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p) => p.nopol === "B 1114 EXT");
    assert.ok(item, "Profit item must exist");
    assert.strictEqual(item.uangMasuk, 100000000000);
    // Eligible payment strictly capped at totalTagihan (1,000,000)
    assert.strictEqual(item.eligiblePayment, 1000000);
    assert.strictEqual(item.overpayment, 99999000000);
    assert.strictEqual(item.matchedCOGS, 700000);
    // Gross profit strictly remains 300,000 - ZERO artificial billions recognized!
    assert.strictEqual(item.profit, 300000);
    assert.strictEqual(item.grossProfit, 300000);
  });

  await suite.test("1.5: Verified Samsat Scenario (Definitive status recognizes profit)", () => {
    const order = orderService.createOrder({
      customer: "Customer Verified Samsat",
      nomorHP: "081211110005",
      layanan: "Perpanjangan STNK",
      nopol: "B 1115 VRF",
      biayaJasa: 250000,
      totalEstimasi: 800000,
      biayaSamsat: 550000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 800000,
        dibayar: 800000,
        buktiPembayaran: { fileName: "bukti_tf5.jpg", fileType: "image", uploadedAt: new Date().toISOString() },
      },
    }, testAdmin);

    orderService.verifyOrderCost(order.orderNo, {
      finalBiayaSamsat: 550000,
      finalTotalBiaya: 800000,
      notes: "Verified by Samsat teller receipt",
    }, testAdmin);

    orderService.verifyPayment(order.orderNo, testAdmin, 800000);

    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p) => p.nopol === "B 1115 VRF");
    assert.ok(item);
    assert.strictEqual(item.costClassification, "DEFINITIVE");
    assert.strictEqual(item.holdStatus, "NONE");
    assert.strictEqual(item.matchedCOGS, 550000);
    assert.strictEqual(item.profit, 250000);
  });

  await suite.test("1.6: Explicit Zero Samsat Scenario (100% margin recognized without pending hold)", () => {
    // Layanan Konsultasi / Jasa Khusus (Biaya Samsat = 0, isExplicitZero = true)
    const order = orderService.createOrder({
      customer: "Customer Zero Samsat Promo",
      nomorHP: "081211110006",
      layanan: "Konsultasi Dokumen",
      nopol: "B 1116 ZRO",
      biayaJasa: 250000,
      biayaSamsat: 0,
      isExplicitZero: true,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 250000,
        dibayar: 250000,
        buktiPembayaran: { fileName: "bukti_tf6.jpg", fileType: "image", uploadedAt: new Date().toISOString() },
      },
    }, testAdmin);

    // Set explicit zero cost
    db.prepare("UPDATE finance_invoices SET is_explicit_zero = 1, cost_verification_status = 'DEFINITIVE', biaya_samsat = 0 WHERE order_no = ?")
      .run(order.orderNo);

    orderService.verifyPayment(order.orderNo, testAdmin, 250000);

    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p) => p.nopol === "B 1116 ZRO");
    assert.ok(item);
    assert.strictEqual(item.isExplicitZero, true);
    assert.strictEqual(item.holdStatus, "NONE");
    assert.strictEqual(item.matchedCOGS, 0);
    assert.strictEqual(item.profit, 250000);
    assert.strictEqual(item.grossProfit, 250000);
  });

  await suite.test("1.7: Unconfigured / Estimated Samsat Scenario (Profit held under HOLD_COST_PENDING)", () => {
    const order = orderService.createOrder({
      customer: "Customer Unconfigured Cost",
      nomorHP: "081211110007",
      layanan: "Perpanjangan STNK",
      nopol: "B 1117 UNC",
      biayaJasa: 500000,
      biayaSamsat: 0,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 500000,
        dibayar: 500000,
        buktiPembayaran: { fileName: "bukti_tf7.jpg", fileType: "image", uploadedAt: new Date().toISOString() },
      },
    }, testAdmin);

    // Unverified with biaya_samsat = 0 and NOT explicit zero
    db.prepare("UPDATE finance_invoices SET is_explicit_zero = 0, cost_verification_status = 'UNCONFIGURED', is_draft_estimate = 1 WHERE order_no = ?")
      .run(order.orderNo);

    orderService.verifyPayment(order.orderNo, testAdmin, 500000);

    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p) => p.nopol === "B 1117 UNC");
    assert.ok(item);
    assert.strictEqual(item.holdStatus, "HOLD_COST_PENDING");
    assert.strictEqual(item.matchedCOGS, 0);
    assert.strictEqual(item.profit, 0);
    assert.strictEqual(item.grossProfit, 0);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM 2: EXPENSE SCENARIOS (7 SCENARIOS)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("2.1: Regular OPEX Kas Kantor (Included in office operational expenses)", () => {
    // Add office operational expense (e.g. Internet / Listrik Kantor)
    const opexItem = dbFinanceRepository.addKasKantor({
      tanggal: new Date().toISOString().split("T")[0],
      keterangan: "Biaya Listrik & WiFi Kantor Cabang",
      debit: 0,
      kredit: 350000,
      status: "Pengeluaran",
      kategori: "Operasional Kantor",
      classification: "OFFICE_OPERATIONAL",
    });

    assert.ok(opexItem);
    const pnl = dbFinanceRepository.getCanonicalLabaRugiSummary();
    assert.ok(pnl.pengeluaranKantor >= 350000, "Office OPEX must include regular office expenses");
  });

  await suite.test("2.2: OPEX Kas Messenger (Classified as courier operational expense)", () => {
    // Top up messenger float first to satisfy cash balance protection guard
    financeService.addKasMessenger({
      tanggal: new Date().toISOString().split("T")[0],
      jenis: "Uang Jalan",
      messenger: "Budi Santoso",
      keterangan: "Pemberian Uang Jalan Operasional",
      in: 100000,
      out: 0,
      kategori: "Uang Jalan",
    }, testAdmin);

    // Direct courier field operational expense
    const kmItem = financeService.addKasMessenger({
      tanggal: new Date().toISOString().split("T")[0],
      jenis: "Operasional",
      messenger: "Budi Santoso",
      keterangan: "Parkir Gedung Samsat Pusat",
      in: 0,
      out: 15000,
      kategori: "Parkir",
    }, testAdmin);

    assert.ok(kmItem);
    const pnl = dbFinanceRepository.getCanonicalLabaRugiSummary();
    assert.ok(pnl.pengeluaranMessenger >= 15000, "Courier OPEX must reflect in canonical laba rugi");
  });

  await suite.test("2.3: Pending Reimbursement (Zero OPEX impact before disbursement)", () => {
    const initialPnl = dbFinanceRepository.getCanonicalLabaRugiSummary();

    const reimb = messengerService.createReimbursement({
      kategori: "Bensin",
      nominal: 75000,
      tanggal: new Date().toISOString().split("T")[0],
      employeeId: "EMP-0004",
      messengerName: "Budi Santoso",
      keterangan: "Bensin motor operasional antar berkas",
    } as any, testCourier);

    assert.strictEqual(reimb.status.toLowerCase(), "diajukan");

    // Approve reimbursement
    messengerService.reviewReimbursement(reimb.id, "Disetujui", testSupervisor, "Disetujui");

    const postApprovalPnl = dbFinanceRepository.getCanonicalLabaRugiSummary();
    // Undisbursed reimbursement must NOT affect OPEX
    assert.strictEqual(
      postApprovalPnl.totalBebanOperasional,
      initialPnl.totalBebanOperasional,
      "Pending/Approved reimbursement must NOT post to OPEX before disbursement"
    );
  });

  let disbursedReimbId: string;
  let preDisbursementOpex: number;

  await suite.test("2.4: Paid Reimbursement (Posts to Kas Kantor and recognized in OPEX exactly ONCE)", () => {
    const reimb = messengerService.createReimbursement({
      kategori: "Tol",
      nominal: 45000,
      tanggal: new Date().toISOString().split("T")[0],
      employeeId: "EMP-0004",
      messengerName: "Budi Santoso",
      keterangan: "Tol Lingkar Luar pengantaran BPKB",
    } as any, testCourier);

    messengerService.reviewReimbursement(reimb.id, "Disetujui", testSupervisor, "Disetujui untuk dibayar");

    const pnlBefore = dbFinanceRepository.getCanonicalLabaRugiSummary();
    preDisbursementOpex = pnlBefore.totalBebanOperasional;

    // Disburse reimbursement through canonical payReimbursement
    const paid = messengerService.payReimbursement(reimb.id, testAdmin, { paymentMethod: "Cash" });

    disbursedReimbId = reimb.id;
    assert.strictEqual(paid.status, "Dibayar");

    // Verify Kas Kantor has Kredit entry
    const kasKantorRow = db.prepare("SELECT * FROM kas_kantor WHERE keterangan LIKE ? ORDER BY id DESC LIMIT 1")
      .get(`%Reimbursement Kurir%${reimb.id}%`) as any;
    assert.ok(kasKantorRow, "Kas Kantor entry must exist");
    assert.strictEqual(Number(kasKantorRow.kredit), 45000);

    // Verify Kas Messenger has ZERO entries
    const kmRows = db.prepare("SELECT * FROM kas_messenger WHERE reimbursement_id = ?").all(reimb.id);
    assert.strictEqual(kmRows.length, 0, "Reimbursement payout must create ZERO entries in Kas Messenger");

    // Verify OPEX increased by exactly 45,000 (no double count)
    const pnlAfter = dbFinanceRepository.getCanonicalLabaRugiSummary();
    assert.strictEqual(
      pnlAfter.totalBebanOperasional - preDisbursementOpex,
      45000,
      "Paid reimbursement must increase OPEX by exactly 45,000"
    );
  });

  await suite.test("2.5: Voided Reimbursement (Reversal brings net expense back to Rp 0)", () => {
    // Void the previously disbursed reimbursement
    const voidResult = messengerService.voidReimbursement(disbursedReimbId, testSupervisor, "Salah input nominal oleh kurir");

    assert.strictEqual(voidResult.status, "Disetujui");

    // Verify compensating entry created in Kas Kantor
    const voidKantor = db.prepare("SELECT * FROM kas_kantor WHERE keterangan LIKE ? ORDER BY id DESC LIMIT 1")
      .get(`%[VOID/BATAL]%${disbursedReimbId}%`) as any;
    assert.ok(voidKantor, "Compensating void entry must exist in Kas Kantor");
    assert.strictEqual(Number(voidKantor.debit), 45000);
    assert.ok(voidKantor.keterangan.includes("[VOID/BATAL]"));

    // Verify canonical laba rugi summary: net OPEX returns to pre-disbursement level!
    const pnlAfterVoid = dbFinanceRepository.getCanonicalLabaRugiSummary();
    assert.strictEqual(
      pnlAfterVoid.totalBebanOperasional,
      preDisbursementOpex,
      "Voided reimbursement must bring net OPEX impact back to Rp 0 without double counting"
    );
  });

  await suite.test("2.6: Internal Transfer Office -> Messenger (Net zero P&L impact, zero cash change)", () => {
    // Ensure sufficient office balance
    db.prepare(`
      INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab)
      VALUES (?, 'Topup Kantor for Transfer Test', 'Debit', 2000000, 0, 2000000, 'Finance')
    `).run(new Date().toISOString().split("T")[0]);

    const pnlBefore = dbFinanceRepository.getCanonicalLabaRugiSummary();

    const transferRes = financeService.transferOfficeToMessenger({
      amount: 500000,
      messengerId: "MSG-0001",
      messengerName: "Budi Santoso",
      notes: "Dropping dana operasional lapangan kurir",
      idempotencyKey: `idem-off-to-msg-${Date.now()}`,
    }, testAdmin);

    assert.ok(transferRes.kasKantorId);
    assert.ok(transferRes.kasMessengerId);

    // Verify classifications via domain classifier
    const kkEntry = db.prepare("SELECT * FROM kas_kantor WHERE id = ?").get(transferRes.kasKantorId) as any;
    const kmEntry = db.prepare("SELECT * FROM kas_messenger WHERE id = ?").get(transferRes.kasMessengerId) as any;
    assert.strictEqual(classifyFinancialTransaction(kkEntry), "INTERNAL_TRANSFER");
    assert.strictEqual(classifyFinancialTransaction(kmEntry), "INTERNAL_TRANSFER");

    // Verify zero P&L impact
    const pnlAfter = dbFinanceRepository.getCanonicalLabaRugiSummary();
    assert.strictEqual(
      pnlAfter.totalBebanOperasional,
      pnlBefore.totalBebanOperasional,
      "Office -> Messenger internal transfer must have ZERO P&L OPEX impact"
    );
    assert.strictEqual(
      pnlAfter.netProfit,
      pnlBefore.netProfit,
      "Office -> Messenger internal transfer must have ZERO Net Profit impact"
    );
  });

  await suite.test("2.7: Internal Transfer Messenger -> Office (Net zero P&L impact, zero cash change)", () => {
    const pnlBefore = dbFinanceRepository.getCanonicalLabaRugiSummary();

    const transferRes = financeService.transferMessengerToOffice({
      amount: 150000,
      messengerId: "MSG-0001",
      messengerName: "Budi Santoso",
      notes: "Setor sisa dana operasional lapangan ke kas kantor",
      idempotencyKey: `idem-msg-to-off-${Date.now()}`,
    }, testAdmin);

    assert.ok(transferRes.kasKantorId);
    assert.ok(transferRes.kasMessengerId);

    const kkEntry = db.prepare("SELECT * FROM kas_kantor WHERE id = ?").get(transferRes.kasKantorId) as any;
    const kmEntry = db.prepare("SELECT * FROM kas_messenger WHERE id = ?").get(transferRes.kasMessengerId) as any;
    assert.strictEqual(classifyFinancialTransaction(kkEntry), "INTERNAL_TRANSFER");
    assert.strictEqual(classifyFinancialTransaction(kmEntry), "INTERNAL_TRANSFER");

    // Verify zero P&L impact
    const pnlAfter = dbFinanceRepository.getCanonicalLabaRugiSummary();
    assert.strictEqual(
      pnlAfter.totalBebanOperasional,
      pnlBefore.totalBebanOperasional,
      "Messenger -> Office internal transfer must have ZERO P&L OPEX impact"
    );
    assert.strictEqual(
      pnlAfter.netProfit,
      pnlBefore.netProfit,
      "Messenger -> Office internal transfer must have ZERO Net Profit impact"
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // WORKSTREAM 3: FULL RECONCILIATION ASSERTIONS (BACKEND VS FRONTEND VS LEDGER)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("3.1: Gross Profit Backend vs Frontend 100% Reconciliation (Zero Discrepancy)", () => {
    // Backend computation via dbFinanceRepository
    const backendProfitList = dbFinanceRepository.getProfitList();
    const backendGrossProfitTotal = backendProfitList.reduce((acc, p) => acc + (p.grossProfit || 0), 0);

    // Frontend computation via computeCanonicalLabaRugi
    const rawInvoices = dbFinanceRepository.getAllInvoices();
    const rawKantor = dbFinanceRepository.getAllKasKantor();
    const rawMessenger = dbFinanceRepository.getAllKasMessenger();
    const rawPengeluaran = dbFinanceRepository.getAllPengeluaran();

    const frontendPnl = computeCanonicalLabaRugi(
      rawInvoices,
      rawPengeluaran,
      rawMessenger,
      "monthly",
      undefined,
      undefined,
      undefined,
      rawKantor
    );

    // Sum of recognized gross profit from invoices
    assert.strictEqual(
      frontendPnl.grossProfit,
      backendGrossProfitTotal,
      `Gross Profit Discrepancy detected! Frontend: ${frontendPnl.grossProfit}, Backend: ${backendGrossProfitTotal}`
    );

    const discrepancy = Math.abs(frontendPnl.grossProfit - backendGrossProfitTotal);
    assert.strictEqual(discrepancy, 0, "Gross Profit reconciliation discrepancy must be strictly Rp 0");
  });

  await suite.test("3.2: Net Profit Backend vs Frontend 100% Reconciliation (Zero Discrepancy)", () => {
    const backendPnlSummary = dbFinanceRepository.getCanonicalLabaRugiSummary();

    const rawInvoices = dbFinanceRepository.getAllInvoices();
    const rawKantor = dbFinanceRepository.getAllKasKantor();
    const rawMessenger = dbFinanceRepository.getAllKasMessenger();
    const rawPengeluaran = dbFinanceRepository.getAllPengeluaran();

    const frontendPnl = computeCanonicalLabaRugi(
      rawInvoices,
      rawPengeluaran,
      rawMessenger,
      "monthly",
      undefined,
      undefined,
      undefined,
      rawKantor
    );

    assert.strictEqual(
      backendPnlSummary.netProfit,
      frontendPnl.netProfit,
      `Net Profit Discrepancy detected! Backend: ${backendPnlSummary.netProfit}, Frontend: ${frontendPnl.netProfit}`
    );

    assert.strictEqual(
      backendPnlSummary.grossProfit,
      frontendPnl.grossProfit,
      "Summary Gross Profit must be identical"
    );

    assert.strictEqual(
      backendPnlSummary.totalBebanOperasional,
      frontendPnl.totalBebanOperasional,
      "Summary Total OPEX must be identical"
    );

    const netDiscrepancy = Math.abs(backendPnlSummary.netProfit - frontendPnl.netProfit);
    assert.strictEqual(netDiscrepancy, 0, "Net Profit reconciliation discrepancy must be strictly Rp 0");
  });

  await suite.test("3.3: OPEX Ledger vs P&L Expense Reconciliation (Zero Double-Count)", () => {
    const pnl = dbFinanceRepository.getCanonicalLabaRugiSummary();
    const kasKantorRows = dbFinanceRepository.getAllKasKantor();

    // Calculate non-void, non-transfer, non-samsat office OPEX from Kas Kantor
    const voidedRefIds = new Set<string>();
    for (const k of kasKantorRows) {
      const ket = String(k.keterangan || "");
      if (ket.includes("[VOID") || ket.includes("[BATAL")) {
        const match = ket.match(/\[Ref:\s*([^\]]+)\]/);
        if (match && match[1]) voidedRefIds.add(match[1].trim());
      }
    }

    let manualOfficeOpex = 0;
    for (const k of kasKantorRows) {
      if ((k.kredit || 0) <= 0) continue;
      if (k.status === "VOID" || k.status === "VOIDED" || (k as any).is_void) continue;
      const ket = String(k.keterangan || "");
      if (ket.includes("[VOID") || ket.includes("[BATAL")) continue;
      if (k.classification === "INTERNAL_TRANSFER" || k.classification === "SAMSAT_PASS_THROUGH") continue;

      const isInternal = (k.kategori && k.kategori.toLowerCase().includes("transfer")) ||
        ket.toLowerCase().includes("transfer ke kas messenger");
      if (isInternal) continue;

      const refMatch = ket.match(/\[Ref:\s*([^\]]+)\]/);
      if (refMatch && refMatch[1] && voidedRefIds.has(refMatch[1].trim())) continue;

      manualOfficeOpex += (k.kredit || 0);
    }

    assert.strictEqual(
      pnl.pengeluaranKantor,
      manualOfficeOpex,
      `Office OPEX ledger mismatch: P&L has ${pnl.pengeluaranKantor}, Manual ledger has ${manualOfficeOpex}`
    );
  });

  await suite.test("3.4: Customer Overpayment Liability vs Ledger Advance Reconciliation", () => {
    const profitList = dbFinanceRepository.getProfitList();
    const totalOverpayment = profitList.reduce((acc, p) => acc + (p.overpayment || 0), 0);

    const pnl = dbFinanceRepository.getCanonicalLabaRugiSummary();
    assert.strictEqual(
      pnl.totalOverpayment,
      totalOverpayment,
      "P&L totalOverpayment must match sum of invoice overpayment liability exactly"
    );

    // Overpayment must never leak into recognized service revenue
    assert.ok(
      pnl.grossRevenue >= pnl.totalPendapatanJasa + pnl.totalBiayaSamsat + pnl.totalOverpayment,
      "Gross receipts must account for service revenue, Samsat COGS, and overpayment liability"
    );
  });

  await suite.test("3.5: Samsat Pass-Through Cash vs Recognized Samsat COGS Isolation", () => {
    const profitList = dbFinanceRepository.getProfitList();
    const recognizedSamsatCOGS = profitList.reduce((acc, p) => acc + (p.matchedCOGS || 0), 0);

    const pnl = dbFinanceRepository.getCanonicalLabaRugiSummary();
    assert.strictEqual(
      pnl.totalBiayaSamsat,
      recognizedSamsatCOGS,
      "Canonical P&L Samsat COGS must strictly equal the sum of recognized invoice matchedCOGS"
    );

    // Held orders must NOT recognize Samsat COGS
    const heldOrders = profitList.filter((p) => p.holdStatus !== "NONE");
    for (const h of heldOrders) {
      assert.strictEqual(h.matchedCOGS, 0, `Held order ${h.nopol} must have matchedCOGS = 0`);
      assert.strictEqual(h.grossProfit, 0, `Held order ${h.nopol} must have grossProfit = 0`);
    }
  });

});
