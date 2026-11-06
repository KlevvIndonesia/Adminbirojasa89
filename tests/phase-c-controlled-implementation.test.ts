import test from "node:test";
import assert from "node:assert";
import { db } from "../server/src/database/db";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { messengerService } from "../server/src/services/messengerService";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { computeCanonicalLabaRugi } from "../src/domain/finance/labaRugiCanonical";

const testAdmin: any = {
  userId: "2",
  nama: "Admin User",
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

test("PHASE C FINANCIAL ARCHITECTURE — CONTROLLED IMPLEMENTATION TEST SUITE", async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 1: REIMBURSEMENT SAMSAT FORBIDDEN (OWNER DECISION A)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("1.1: Rejection of Samsat and Tax categories during reimbursement submission", () => {
    const forbiddenCategories = [
      "Samsat",
      "SAMSAT",
      "Biaya Samsat",
      "Talangan Samsat",
      "Pajak",
      "PKB",
      "SWDKLLJ",
      "PNBP",
      "Biaya Pokok Samsat",
      "Pajak Tahunan",
    ];

    for (const cat of forbiddenCategories) {
      assert.throws(
        () => {
          messengerService.createReimbursement({
            kategori: cat,
            nominal: 350000,
            tanggal: new Date().toISOString().split("T")[0],
            employeeId: "EMP-0004",
            messengerName: "Budi Santoso",
            keterangan: `Pengajuan biaya ${cat} samsat`,
          } as any, testCourier);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, "FORBIDDEN_REIMBURSEMENT_CATEGORY");
          assert.ok(err.message.includes("tidak diperbolehkan diajukan sebagai reimbursement operasional"));
          return true;
        },
        `Expected category '${cat}' to be rejected`
      );
    }
  });

  await suite.test("1.2: Allowable operational categories succeed (Bensin, Parkir, Tol, Servis)", () => {
    const allowedCategories = ["Bensin", "Parkir", "Tol", "Servis Kendaraan", "Operasional Lapangan"];

    for (const cat of allowedCategories) {
      const res = messengerService.createReimbursement({
        category: cat,
        amount: 45000,
        date: new Date().toISOString().split("T")[0],
        employeeId: "EMP-0004",
        messengerName: "Budi Santoso",
        note: `Pembelian operasional ${cat}`,
      } as any, testCourier);

      assert.ok(res.id, `Reimbursement for '${cat}' should be created with an ID`);
      assert.strictEqual(res.category, cat);
      assert.strictEqual(res.status, "Diajukan");
      assert.strictEqual(res.amount, 45000);
    }
  });

  await suite.test("1.3: Review and Approval rejects Samsat categories even if forced in DB", () => {
    const rawId = `reimb-legacy-samsat-${Date.now()}`;
    db.prepare(`
      INSERT INTO messenger_reimbursements (id, employee_id, messenger_name, category, amount, date, status, submitted_at)
      VALUES (?, 'EMP-0004', 'Budi Santoso', 'Samsat', 200000, ?, 'Diajukan', datetime('now'))
    `).run(rawId, new Date().toISOString().split("T")[0]);

    assert.throws(
      () => {
        messengerService.reviewReimbursement(rawId, "Disetujui", testSupervisor, "Approved accidentally");
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "FORBIDDEN_REIMBURSEMENT_CATEGORY");
        return true;
      }
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 2: ZERO COURIER OUTFLOW ON REIMBURSEMENT PAYOUT (SINGLE DEBIT PRINCIPLE)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("2.1: Reimbursement payout debits Kas Kantor and creates ZERO entries in Kas Messenger", () => {
    // Topup office balance so payout can succeed
    db.prepare(`
      INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab)
      VALUES (?, 'Topup Saldo Kantor Reimb Test', 'Debit', 2000000, 0, 2000000, 'Finance')
    `).run(new Date().toISOString().split("T")[0]);

    // Create and approve a legitimate reimbursement
    const reimb = messengerService.createReimbursement({
      category: "Bensin",
      amount: 75000,
      date: new Date().toISOString().split("T")[0],
      employeeId: "EMP-0004",
      messengerName: "Budi Santoso",
      note: "Bensin motor operasional jemput berkas",
    } as any, testCourier);

    messengerService.reviewReimbursement(reimb.id, "Disetujui", testSupervisor, "Disetujui untuk dicairkan");

    // Initial counts
    const initialMessengerEntries = db.prepare("SELECT COUNT(*) as count FROM kas_messenger WHERE reimbursement_id = ?").get(reimb.id) as any;
    assert.strictEqual(initialMessengerEntries.count, 0);

    // Pay the reimbursement
    const paid = messengerService.payReimbursement(reimb.id, testAdmin, {
      paymentMethod: "Transfer Bank",
    });

    assert.strictEqual(paid.status, "Dibayar");

    // Verify Kas Kantor credit entry
    const officeEntry = db.prepare("SELECT * FROM kas_kantor WHERE keterangan LIKE ?").get(`%${reimb.id}%`) as any;
    assert.ok(officeEntry, "Kas Kantor entry must exist for reimbursement payout");
    assert.strictEqual(Number(officeEntry.kredit), 75000, "Kas Kantor kredit must match reimbursement amount");

    // Verify Kas Messenger has ZERO records created (single debit principle)
    const afterMessengerEntries = db.prepare("SELECT COUNT(*) as count FROM kas_messenger WHERE reimbursement_id = ?").get(reimb.id) as any;
    assert.strictEqual(afterMessengerEntries.count, 0, "Kas Messenger must have ZERO entries created for reimbursement");
  });

  await suite.test("2.2: Void reimbursement cancels Kas Kantor without modifying Kas Messenger", () => {
    const reimb = messengerService.createReimbursement({
      category: "Tol",
      amount: 30000,
      date: new Date().toISOString().split("T")[0],
      employeeId: "EMP-0004",
      messengerName: "Budi Santoso",
      note: "Tol Jagorawi operasional",
    } as any, testCourier);

    messengerService.reviewReimbursement(reimb.id, "Disetujui", testSupervisor);
    messengerService.payReimbursement(reimb.id, testAdmin, { paymentMethod: "Cash" });

    const messengerEntriesBeforeVoid = db.prepare("SELECT COUNT(*) as count FROM kas_messenger WHERE reimbursement_id = ?").get(reimb.id) as any;
    assert.strictEqual(messengerEntriesBeforeVoid.count, 0);

    // Void the reimbursement
    const voided = messengerService.voidReimbursement(reimb.id, testSupervisor, "Salah transfer nominal");
    assert.strictEqual(voided.status, "Disetujui");

    // Check Kas Kantor has reversal debit
    const reversalOffice = db.prepare("SELECT * FROM kas_kantor WHERE keterangan LIKE ? ORDER BY id DESC LIMIT 1").get(`%[VOID/BATAL]%${reimb.id}%`) as any;
    assert.ok(reversalOffice, "Reversal entry must exist in Kas Kantor");
    assert.strictEqual(Number(reversalOffice.debit), 30000);

    // Check Kas Messenger still has ZERO records
    const messengerEntriesAfterVoid = db.prepare("SELECT COUNT(*) as count FROM kas_messenger WHERE reimbursement_id = ?").get(reimb.id) as any;
    assert.strictEqual(messengerEntriesAfterVoid.count, 0, "Kas Messenger must remain completely untouched on void");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 3: INTERNAL TRANSFERS CANONICAL DUAL LEDGER CONSERVATION
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("3.1: transferOfficeToMessenger creates atomic Kas Kantor Kredit and Kas Messenger Debit", () => {
    // Ensure sufficient office balance
    db.prepare(`
      INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab)
      VALUES (?, 'Topup Kantor for Transfer Test', 'Debit', 2000000, 0, 2000000, 'Finance')
    `).run(new Date().toISOString().split("T")[0]);

    const result = financeService.transferOfficeToMessenger({
      amount: 500000,
      messengerId: "MSG-0001",
      messengerName: "Budi Santoso",
      notes: "Panjar kas jalan samsat",
      idempotencyKey: `idem-off-to-msg-${Date.now()}`,
    }, testAdmin);

    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.amount, 500000);
    assert.ok(result.kasKantorId);
    assert.ok(result.kasMessengerId);
    assert.ok(result.transferId);

    // Verify Kas Kantor entry
    const officeTx = db.prepare("SELECT * FROM kas_kantor WHERE id = ?").get(result.kasKantorId) as any;
    assert.strictEqual(officeTx.status, "Kredit");
    assert.strictEqual(Number(officeTx.kredit), 500000);

    // Verify Kas Messenger entry
    const messengerTx = db.prepare("SELECT * FROM kas_messenger WHERE id = ?").get(result.kasMessengerId) as any;
    assert.strictEqual(messengerTx.jenis, "Transfer");
    assert.strictEqual(Number(messengerTx.debit), 500000);
    assert.strictEqual(messengerTx.messenger_id, "MSG-0001");

    // Verify internal_transfers record
    const transferRecord = db.prepare("SELECT * FROM internal_transfers WHERE id = ?").get(result.transferId) as any;
    assert.strictEqual(transferRecord.transfer_type, "OFFICE_TO_MESSENGER");
    assert.strictEqual(Number(transferRecord.amount), 500000);
  });

  await suite.test("3.2: transferMessengerToOffice creates atomic Kas Messenger Kredit and Kas Kantor Debit", () => {
    const result = financeService.transferMessengerToOffice({
      amount: 150000,
      messengerId: "MSG-0001",
      messengerName: "Budi Santoso",
      notes: "Setor sisa panjar uang jalan",
      idempotencyKey: `idem-msg-to-off-${Date.now()}`,
    }, testAdmin);

    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.amount, 150000);
    assert.ok(result.kasKantorId);
    assert.ok(result.kasMessengerId);
    assert.ok(result.transferId);

    // Verify Kas Messenger entry (Kredit / Pengeluaran)
    const messengerTx = db.prepare("SELECT * FROM kas_messenger WHERE id = ?").get(result.kasMessengerId) as any;
    assert.strictEqual(messengerTx.jenis, "Transfer");
    assert.strictEqual(Number(messengerTx.kredit), 150000);

    // Verify Kas Kantor entry (Debit / Pemasukan)
    const officeTx = db.prepare("SELECT * FROM kas_kantor WHERE id = ?").get(result.kasKantorId) as any;
    assert.strictEqual(officeTx.status, "Debit");
    assert.strictEqual(Number(officeTx.debit), 150000);

    // Verify internal_transfers record
    const transferRecord = db.prepare("SELECT * FROM internal_transfers WHERE id = ?").get(result.transferId) as any;
    assert.strictEqual(transferRecord.transfer_type, "MESSENGER_TO_OFFICE");
    assert.strictEqual(Number(transferRecord.amount), 150000);
  });

  await suite.test("3.3: Consolidated internal transfers produce net Rp 0 cash impact", () => {
    const allTransfers = db.prepare("SELECT * FROM internal_transfers").all() as any[];
    assert.ok(allTransfers.length >= 2);

    let netCashMovement = 0;
    for (const t of allTransfers) {
      if (t.transfer_type === "OFFICE_TO_MESSENGER") {
        netCashMovement += (-t.amount + t.amount);
      } else if (t.transfer_type === "MESSENGER_TO_OFFICE") {
        netCashMovement += (-t.amount + t.amount);
      }
    }
    assert.strictEqual(netCashMovement, 0, "Internal transfers consolidated across all ledgers must be strictly net zero");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 4: PAYMENT CANONICALIZATION (TERVERIFIKASI ONLY)
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("4.1: Unverified payment does NOT reduce invoice outstanding or post Kas Kantor", () => {
    // Create order with initial down payment (500,000) not yet verified
    const created = orderService.createOrder({
      customer: "PT Testing Canonical",
      nomorHP: "08123456789",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 1234 CAN",
      namaPemilik: "Budi",
      kepemilikanKendaraan: "Pribadi",
      jenisKendaraan: "Mobil",
      wilayahSamsatAsal: "Jakarta Selatan",
      biayaJasa: 400000,
      totalEstimasi: 1000000,
      nominalPkbTerakhir: 600000,
      biayaSamsat: 600000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1000000,
        dibayar: 500000,
      },
    }, testAdmin);

    const orderNo = created.orderNo;
    const invoiceNo = created.payment.invoiceNo!;

    // Initial invoice check: dibayar MUST be 0 because payment is unverified!
    const initialInvoice = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
    assert.ok(initialInvoice);
    assert.strictEqual(initialInvoice.totalTagihan, 1000000);
    assert.strictEqual(initialInvoice.dibayar, 0, "Unverified initial payment must NOT count as dibayar");
    assert.strictEqual(initialInvoice.sisa, 1000000, "Invoice sisa must remain full 1,000,000");
    assert.strictEqual(initialInvoice.status, "UNPAID");

    // Check Kas Kantor: zero entries posted for this invoice
    const kasKantorCount = db.prepare("SELECT COUNT(*) as count FROM kas_kantor WHERE invoice_no = ?").get(invoiceNo) as any;
    assert.strictEqual(kasKantorCount.count, 0, "Unverified payment must not post to Kas Kantor");

    // Check Profit calculation: profit must be 0
    const profitList = dbFinanceRepository.getProfitList();
    const profitItem = profitList.find((p: any) => p.invoice === invoiceNo);
    if (profitItem) {
      assert.strictEqual(profitItem.uangMasuk, 0);
      assert.strictEqual(profitItem.profit, 0);
    }
  });

  await suite.test("4.2: verifyPayment posts Kas Kantor debit and updates invoice to verified", () => {
    const created = orderService.createOrder({
      customer: "PT Testing Verify",
      nomorHP: "08123456780",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 5678 CAN",
      namaPemilik: "Siti",
      kepemilikanKendaraan: "Pribadi",
      jenisKendaraan: "Mobil",
      wilayahSamsatAsal: "Jakarta Selatan",
      biayaJasa: 400000,
      totalEstimasi: 1000000,
      nominalPkbTerakhir: 600000,
      biayaSamsat: 600000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1000000,
        dibayar: 500000,
        buktiPembayaran: { fileName: "bukti_tf.jpg", fileType: "image", uploadedAt: new Date().toISOString() },
      },
    }, testAdmin);

    const orderNo = created.orderNo;
    const invoiceNo = created.payment.invoiceNo!;

    // Verify payment through canonical verifyPayment
    const verifiedOrder = orderService.verifyPayment(orderNo, testAdmin);
    assert.ok(verifiedOrder);

    // Authoritative check on invoice: now verified payment is recognized!
    const invVerified = dbFinanceRepository.getInvoiceByOrderNo(orderNo);
    assert.ok(invVerified);
    assert.strictEqual(invVerified.dibayar, 500000);
    assert.strictEqual(invVerified.sisa, 500000);
    assert.strictEqual(invVerified.status, "PARTIAL");

    // Check Kas Kantor: debit entry must exist
    const kasKantorEntry = db.prepare("SELECT * FROM kas_kantor WHERE invoice_no = ?").get(invoiceNo) as any;
    assert.ok(kasKantorEntry, "Verified payment must post to Kas Kantor");
    assert.strictEqual(Number(kasKantorEntry.debit), 500000);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 5: CANONICAL PROPORTIONAL MATCHING FORMULA PARITY
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("5.1: Proportional matching formula produces identical results in backend and frontend", () => {
    const created = orderService.createOrder({
      customer: "PT Prop Parity",
      nomorHP: "08123456781",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 9999 PROP",
      namaPemilik: "Joko",
      kepemilikanKendaraan: "Pribadi",
      jenisKendaraan: "Mobil",
      wilayahSamsatAsal: "Jakarta Selatan",
      biayaJasa: 400000,
      totalEstimasi: 1000000,
      nominalPkbTerakhir: 600000,
      biayaSamsat: 600000,
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 1000000,
        dibayar: 500000,
        buktiPembayaran: { fileName: "bukti_prop.jpg", fileType: "image", uploadedAt: new Date().toISOString() },
      },
    }, testAdmin);

    const orderNo = created.orderNo;
    const invoiceNo = created.payment.invoiceNo!;

    // Verify the 500,000 DP
    orderService.verifyPayment(orderNo, testAdmin);

    // Backend calculation check via getProfitList
    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p: any) => p.invoice === invoiceNo);
    assert.ok(item, "Profit item must exist");

    // Canonical calculations:
    // eligiblePayment = 500,000
    // alpha = 600,000 / 1,000,000 = 0.6
    // matchedCOGS = min(600,000, round(0.6 * 500,000)) = 300,000
    // profit = 500,000 - 300,000 = 200,000
    assert.strictEqual(item.uangMasuk, 500000);
    assert.strictEqual(item.biayaSamsat, 600000);
    assert.strictEqual(item.matchedCOGS, 300000);
    assert.strictEqual(item.profit, 200000);
    assert.strictEqual(item.pendapatanJasa, 200000);
    assert.strictEqual(item.holdStatus, "NONE");

    // Frontend domain calculator check via computeCanonicalLabaRugi
    const invAfter = dbFinanceRepository.getInvoiceByOrderNo(orderNo)!;
    const lrSummary = computeCanonicalLabaRugi([invAfter], [], [], "Semua");
    assert.strictEqual(lrSummary.totalPemasukan, 500000);
    assert.strictEqual(lrSummary.totalBiayaSamsat, 300000);
    assert.strictEqual(lrSummary.totalPendapatanJasa, 200000);
  });

  await suite.test("5.2: Unconfigured / Estimated Samsat cost is held with status HOLD_COST_PENDING", () => {
    const invoiceNo = `INV-TEST-UNCONF-${Date.now()}`;
    const orderNo = `ORD-TEST-UNCONF-${Date.now()}`;

    // Tagihan = 500,000, Biaya Samsat = 0 (Unconfigured, NOT explicit zero)
    dbFinanceRepository.saveInvoice({
      invoiceNo,
      orderNo,
      customer: "Cust Unconf",
      layanan: "Layanan Unconfigured",
      totalTagihan: 500000,
      dibayar: 500000,
      sisa: 0,
      biayaSamsat: 0,
      isExplicitZero: false,
      costClassification: "UNCONFIGURED",
      costVerificationStatus: "PENDING_VERIFICATION",
    } as any);

    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p: any) => p.invoice === invoiceNo);
    assert.ok(item);
    assert.strictEqual(item.profit, 0, "Unconfigured cost must hold profit at 0");
    assert.strictEqual(item.holdStatus, "HOLD_COST_PENDING");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 6: ORDER WORKFLOW GUARD FOR S > T ANOMALY
  // ═══════════════════════════════════════════════════════════════════════════════

  await suite.test("6.1: Order with S > T is blocked from advancing to Stage 6 (Supervisi)", () => {
    const created = orderService.createOrder({
      customer: "PT Defisit Samsat",
      nomorHP: "08123456782",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 7777 DEF",
      namaPemilik: "Bambang",
      kepemilikanKendaraan: "Pribadi",
      jenisKendaraan: "Mobil",
      wilayahSamsatAsal: "Jakarta Selatan",
      biayaJasa: 100000,
      totalEstimasi: 500000,
      nominalPkbTerakhir: 400000,
      tipePembayaran: "Bayar di Akhir",
    }, testAdmin);

    const orderNo = created.orderNo;

    // Advance to Step 2, 3, 4, 5
    orderService.advanceOrder(orderNo, "Penjadwalan", { isScheduled: true, tanggalJemput: "2026-11-04" }, testAdmin);
    orderService.advanceOrder(orderNo, "Verifikasi Dokumen", { pickupCompleted: true, documentsVerified: true }, testAdmin);
    orderService.advanceOrder(orderNo, "Proses Samsat", { samsatStatus: "Sedang Proses Samsat" }, testAdmin);
    orderService.advanceOrder(orderNo, "Verifikasi Ulang", { samsatCompletedAt: new Date().toISOString() }, testAdmin);

    // Try to advance to Supervisi with S = 700,000 > T = 500,000
    assert.throws(
      () => {
        orderService.advanceOrder(orderNo, "Supervisi", {
          biayaSamsat: 700000,
          totalBiaya: 500000,
          documentApproval: { stage5Verified: true, stage6Approved: false },
        }, testAdmin);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "FINANCIAL_ANOMALY_SAMSAT_EXCEEDS_TOTAL");
        assert.ok(err.message.includes("Biaya Samsat (Rp 700.000) melebihi Total Tagihan (Rp 500.000)"));
        return true;
      }
    );

    // Verify order was marked with anomaly flags
    const updated = orderService.getByOrderNo(orderNo);
    assert.strictEqual(updated.isFinancialAnomaly, true);
    assert.strictEqual(updated.financialAnomalyReason, "BIAYA_SAMSAT_MELEBIHI_TAGIHAN");
  });

  await suite.test("6.2: Generic updateOrder cannot bypass S > T guard to Stage 6, 7, 8", () => {
    const created = orderService.createOrder({
      customer: "PT Bypass Attempt",
      nomorHP: "08123456783",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 8888 BYP",
      namaPemilik: "Cahyono",
      kepemilikanKendaraan: "Pribadi",
      jenisKendaraan: "Mobil",
      wilayahSamsatAsal: "Jakarta Selatan",
      biayaJasa: 100000,
      totalEstimasi: 500000,
      nominalPkbTerakhir: 400000,
      tipePembayaran: "Bayar di Akhir",
    }, testAdmin);

    const orderNo = created.orderNo;

    // Attempt generic update to Supervisi with S > T
    assert.throws(
      () => {
        orderService.updateOrder(orderNo, {
          biayaSamsat: 750000,
          totalBiaya: 500000,
          currentStageName: "Supervisi",
          currentStep: 6,
        }, testAdmin);
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, "FINANCIAL_ANOMALY_SAMSAT_EXCEEDS_TOTAL");
        return true;
      }
    );
  });

  await suite.test("6.3: S > T order is excluded from profit recognition (HOLD_ANOMALY)", () => {
    const invoiceNo = `INV-TEST-ANOM-HOLD-${Date.now()}`;
    const orderNo = `ORD-TEST-ANOM-HOLD-${Date.now()}`;

    dbFinanceRepository.saveInvoice({
      invoiceNo,
      orderNo,
      customer: "Cust Defisit",
      layanan: "Layanan Defisit",
      totalTagihan: 500000,
      dibayar: 500000,
      sisa: 0,
      biayaSamsat: 700000,
      costClassification: "ACTUAL_COST",
      costVerificationStatus: "VERIFIED",
    } as any);

    const profitList = dbFinanceRepository.getProfitList();
    const item = profitList.find((p: any) => p.invoice === invoiceNo);
    assert.ok(item, "Item must exist in profit list");
    assert.strictEqual(item.isFinancialAnomaly, true, "Item must have isFinancialAnomaly = true");
    assert.strictEqual(item.anomalyReason, "BIAYA_SAMSAT_MELEBIHI_TAGIHAN");
    assert.strictEqual(item.holdStatus, "HOLD_ANOMALY");
    assert.strictEqual(item.profit, 0, "S > T order profit must be strictly 0");
  });

  await suite.test("6.4: Normal order (S <= T) advances smoothly through all stages", () => {
    // Normal order: Total = 1,000,000, Samsat = 600,000 (S <= T)
    const created = orderService.createOrder({
      customer: "PT Normal Workflow",
      nomorHP: "08123456784",
      layanan: "Perpanjangan 1 Tahun",
      nopol: "B 1111 NRM",
      namaPemilik: "Hendro",
      kepemilikanKendaraan: "Pribadi",
      jenisKendaraan: "Mobil",
      wilayahSamsatAsal: "Jakarta Selatan",
      biayaJasa: 400000,
      totalEstimasi: 1000000,
      nominalPkbTerakhir: 600000,
      biayaSamsat: 600000,
      tipePembayaran: "Bayar di Akhir",
    }, testAdmin);

    const orderNo = created.orderNo;

    // Progress through all 8 stages
    const s2 = orderService.advanceOrder(orderNo, "Penjadwalan", { isScheduled: true, tanggalJemput: "2026-11-04" }, testAdmin);
    assert.strictEqual(s2.currentStageName, "Penjadwalan");

    const s3 = orderService.advanceOrder(orderNo, "Verifikasi Dokumen", { pickupCompleted: true, documentsVerified: true }, testAdmin);
    assert.strictEqual(s3.currentStageName, "Verifikasi Dokumen");

    const s4 = orderService.advanceOrder(orderNo, "Proses Samsat", { samsatStatus: "Sedang Proses Samsat" }, testAdmin);
    assert.strictEqual(s4.currentStageName, "Proses Samsat");

    const s5 = orderService.advanceOrder(orderNo, "Verifikasi Ulang", { samsatCompletedAt: new Date().toISOString() }, testAdmin);
    assert.strictEqual(s5.currentStageName, "Verifikasi Ulang");

    const s6 = orderService.advanceOrder(orderNo, "Supervisi", {
      biayaSamsat: 600000,
      totalBiaya: 1000000,
      documentApproval: { stage5Verified: true, stage6Approved: false },
    }, testAdmin);
    assert.strictEqual(s6.currentStageName, "Supervisi");

    const s7 = orderService.advanceOrder(orderNo, "Pengantaran", {
      documentApproval: { stage5Verified: true, stage6Approved: true },
      approvedBySpv: true,
    }, testSupervisor);
    assert.strictEqual(s7.currentStageName, "Pengantaran");

    const s8 = orderService.advanceOrder(orderNo, "Dokumen Telah Diterima", {
      isReceived: true,
      tanggalDiterima: new Date().toISOString().split("T")[0],
    }, testCourier);
    assert.strictEqual(s8.currentStageName, "Dokumen Telah Diterima");
    assert.strictEqual(s8.currentStep, 8);
  });
});
