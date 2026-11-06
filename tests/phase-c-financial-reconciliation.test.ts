import test from "node:test";
import assert from "node:assert";
import { db } from "../server/src/database/db";
import { orderService } from "../server/src/services/orderService";
import { financeService } from "../server/src/services/financeService";
import { messengerService } from "../server/src/services/messengerService";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { computeCanonicalLabaRugi, isQuarantinedInvoice } from "../src/domain/finance/labaRugiCanonical";
import { classifyFinancialTransaction } from "../src/domain/finance/types";
import { menuItems } from "../src/app/config/navigationConfig";

const testAdminUser: any = {
  userId: "usr-admin-test",
  nama: "Test Admin",
  role: "administrator",
  jabatan: "Administrator",
  email: "admin@test.local",
};

const testCourierUser: any = {
  userId: "usr-courier-test",
  nama: "Budi Santoso",
  role: "messenger",
  jabatan: "Kurir",
  email: "courier@test.local",
};

test("PHASE C - Instruction 3: Pengeluaran Tab Removed from Navigation & Redirect Configured", () => {
  // 1. Navigation items must NOT contain Pengeluaran menu
  const financeMenu = menuItems.find((item) => item.id === "finance");
  assert.ok(financeMenu, "Finance menu group must exist");
  const pengeluaranItem = financeMenu.subItems?.find(
    (c) => c.id === "finance-pengeluaran" || c.label.toLowerCase() === "pengeluaran"
  );
  assert.strictEqual(pengeluaranItem, undefined, "Pengeluaran item must be removed from finance menu");

  // 2. Ensure Kas Kantor, Kas Messenger, Laba Rugi remain intact
  const kasKantorItem = financeMenu.subItems?.find((c) => c.id === "finance-kas-kantor");
  const kasMessengerItem = financeMenu.subItems?.find((c) => c.id === "finance-kas-messenger");
  const labaRugiItem = financeMenu.subItems?.find((c) => c.id === "finance-laba-rugi");
  assert.ok(kasKantorItem, "Kas Kantor menu must be preserved");
  assert.ok(kasMessengerItem, "Kas Messenger menu must be preserved");
  assert.ok(labaRugiItem, "Laba Rugi menu must be preserved");
});

test("PHASE C - Workstream 1: P1 Payment Path Hardening (Empty vs Initial Paid)", () => {
  // A. Order without payment (dibayar = 0)
  const orderUnpaid = orderService.createOrder(
    {
      customer: "Customer Unpaid P1",
      nomorHP: "081299990001",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1001 UNP",
      payment: {
        tipePembayaran: "Bayar di Akhir",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 500000,
        dibayar: 0,
      },
    },
    testAdminUser
  );

  const invUnpaid = dbFinanceRepository.getInvoiceByOrderNo(orderUnpaid.orderNo);
  assert.ok(invUnpaid, "Invoice must be created");
  assert.strictEqual(invUnpaid.dibayar, 0, "finance_invoices.dibayar must be strictly 0");
  assert.strictEqual(invUnpaid.status, "UNPAID");

  const paymentsUnpaid = db.prepare("SELECT * FROM invoice_payments WHERE order_no = ?").all(orderUnpaid.orderNo);
  assert.strictEqual(paymentsUnpaid.length, 0, "invoice_payments must be strictly empty for unpaid order");

  // B. Order with initial payment (dibayar = 300,000)
  const orderWithDP = orderService.createOrder(
    {
      customer: "Customer DP P1",
      nomorHP: "081299990002",
      layanan: "Perpanjangan STNK Tahunan",
      nopol: "B 1002 DP",
      payment: {
        tipePembayaran: "Bayar di Awal",
        metodePembayaran: "Transfer Bank",
        totalBiaya: 600000,
        dibayar: 300000,
      },
    },
    testAdminUser
  );

  const invDPBefore = dbFinanceRepository.getInvoiceByOrderNo(orderWithDP.orderNo);
  assert.ok(invDPBefore, "Invoice must be created");
  // Phase C Approved Rule B: Pending payment does NOT reduce invoice outstanding or post Kas Kantor
  assert.strictEqual(invDPBefore.dibayar, 0, "finance_invoices.dibayar must initially be 0 prior to verification");
  assert.strictEqual(invDPBefore.status, "UNPAID");

  const paymentsDPPending = db.prepare("SELECT * FROM invoice_payments WHERE order_no = ?").all(orderWithDP.orderNo) as any[];
  assert.strictEqual(paymentsDPPending.length, 1, "invoice_payments must contain exactly 1 row");
  assert.strictEqual(paymentsDPPending[0].nominal, 300000);
  assert.strictEqual(paymentsDPPending[0].status_verifikasi, "MENUNGGU_BUKTI");
  assert.strictEqual(paymentsDPPending[0].kas_kantor_id, null, "Unverified payment must not post Kas Kantor");

  // Verify payment via canonical verifyPayment
  orderService.verifyPayment(
    orderWithDP.orderNo,
    testAdminUser.nama,
    testAdminUser,
    300000,
    "DP Verified",
    { fileUrl: "/uploads/proof_dp.jpg", fileName: "proof_dp.jpg" }
  );

  const invDP = dbFinanceRepository.getInvoiceByOrderNo(orderWithDP.orderNo);
  assert.ok(invDP, "Invoice must exist");
  assert.strictEqual(invDP.dibayar, 300000, "finance_invoices.dibayar must be 300000 after verification");
  assert.strictEqual(invDP.status, "PARTIAL");

  const paymentsDP = db.prepare("SELECT * FROM invoice_payments WHERE order_no = ?").all(orderWithDP.orderNo) as any[];
  assert.strictEqual(paymentsDP.length, 1, "invoice_payments must contain exactly 1 row");
  assert.strictEqual(paymentsDP[0].nominal, 300000);
  assert.strictEqual(paymentsDP[0].status_verifikasi, "TERVERIFIKASI");
  assert.ok(paymentsDP[0].kas_kantor_id, "invoice_payments must link to kas_kantor row");

  // Check kas_kantor row created
  const kasEntry = db.prepare("SELECT * FROM kas_kantor WHERE id = ?").get(paymentsDP[0].kas_kantor_id) as any;
  assert.ok(kasEntry, "kas_kantor entry must exist");
  assert.strictEqual(kasEntry.debit, 300000);
  assert.strictEqual(kasEntry.status, "Debit");
});

test("PHASE C - Workstream 1: Reimbursement Double-Outflow Elimination", () => {
  // Setup employee & messenger
  const empId = `EMP-TEST-${Date.now()}`;
  const msgId = `MSG-TEST-${Date.now()}`;
  const nik = `NIK-${Date.now()}`;
  db.prepare(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan)
    VALUES (?, ?, ?, '0812000001', '1990-01-01', 'Jakarta', 'Alamat Test', 'Kurir')
  `).run(empId, nik, "Kurir Reimburse Test");
  db.prepare("INSERT INTO messengers (id, employee_id, plat_motor_operasional, wilayah_tugas_utama, status_tugas) VALUES (?, ?, 'B 1234 MSG', 'Jakarta Barat', 'STANDBY')").run(
    msgId,
    empId
  );

  // Initial messenger wallet: give 100,000 panjar
  dbFinanceRepository.addKasMessenger({
    tanggal: "2026-10-30",
    jenis: "Panjar Operasional",
    messenger: "Kurir Reimburse Test",
    messenger_id: msgId,
    keterangan: "Modal Awal",
    in: 100000,
    out: 0,
    penanggungJawab: testAdminUser.nama,
  } as any);

  // Submit reimbursement 25,000 for bensin
  const reimbId = `REIMB-${Date.now()}`;
  db.prepare(`
    INSERT INTO messenger_reimbursements (id, employee_id, messenger_id, messenger_name, category, amount, date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Disetujui')
  `).run(reimbId, empId, msgId, "Kurir Reimburse Test", "Bensin", 25000, "2026-10-30");

  const kasMsgCountBefore = (db.prepare("SELECT COUNT(*) as c FROM kas_messenger WHERE messenger_id = ?").get(msgId) as any).c;
  const kasKantorRowsBefore = (db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;

  // Pay Reimbursement
  const paid = messengerService.payReimbursement(reimbId, testAdminUser);
  assert.strictEqual(paid.status, "Dibayar");

  // Kas Kantor must have 1 credit row (payout from office)
  const kasKantorRowsAfter = (db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
  assert.strictEqual(kasKantorRowsAfter, kasKantorRowsBefore + 1, "Kas Kantor must record payout");

  // Kas Messenger must NOT have any new rows (NO double-outflow deduction)
  const kasMsgCountAfter = (db.prepare("SELECT COUNT(*) as c FROM kas_messenger WHERE messenger_id = ?").get(msgId) as any).c;
  assert.strictEqual(kasMsgCountAfter, kasMsgCountBefore, "Kas Messenger must NOT record deduction when office pays reimbursement");
});

test("PHASE C - Workstream 1: Internal Transfer Messenger to Office (Safe Integer & Canonical Identity)", () => {
  const empId = `EMP-TRF-${Date.now()}`;
  const msgId = `MSG-TRF-${Date.now()}`;
  const nik = `NIK-${Date.now()}`;
  db.prepare(`
    INSERT INTO employees (id, nik_ktp, nama_lengkap, no_hp, tgl_lahir, wilayah, alamat_domisili, jabatan)
    VALUES (?, ?, ?, '0812000002', '1990-01-01', 'Jakarta', 'Alamat Test', 'Kurir')
  `).run(empId, nik, "Kurir Transfer Test");
  db.prepare("INSERT INTO messengers (id, employee_id, plat_motor_operasional, wilayah_tugas_utama, status_tugas) VALUES (?, ?, 'B 5678 MSG', 'Jakarta Selatan', 'STANDBY')").run(
    msgId,
    empId
  );

  // Give courier 200,000
  dbFinanceRepository.addKasMessenger({
    tanggal: "2026-10-30",
    jenis: "Panjar",
    messenger: "Kurir Transfer Test",
    messenger_id: msgId,
    keterangan: "Modal Panjar",
    in: 200000,
    out: 0,
    penanggungJawab: testAdminUser.nama,
  } as any);

  // 1. Rejects invalid amounts
  assert.throws(() => {
    financeService.transferMessengerToOffice({ messengerId: msgId, amount: -50000, idempotencyKey: "k1" }, testAdminUser);
  }, /Nominal transfer wajib berupa integer positif/);

  assert.throws(() => {
    financeService.transferMessengerToOffice({ messengerId: msgId, amount: 0, idempotencyKey: "k2" }, testAdminUser);
  }, /Nominal transfer wajib berupa integer positif/);

  assert.throws(() => {
    financeService.transferMessengerToOffice({ messengerId: msgId, amount: 10000.5, idempotencyKey: "k3" }, testAdminUser);
  }, /Nominal transfer wajib berupa integer positif/);

  // 2. Rejects insufficient balance
  assert.throws(() => {
    financeService.transferMessengerToOffice({ messengerId: msgId, amount: 500000, idempotencyKey: "k4" }, testAdminUser);
  }, /tidak mencukupi/);

  // 3. Valid transfer of 75,000
  const idempKey = `IDEMP-TRF-${Date.now()}`;
  const transferResult = financeService.transferMessengerToOffice(
    {
      messengerId: msgId,
      amount: 75000,
      notes: "Setoran sisa operasional harian",
      idempotencyKey: idempKey,
    },
    testAdminUser
  );

  assert.strictEqual(transferResult.status, "COMPLETED");
  assert.strictEqual(transferResult.amount, 75000);

  // Check courier balance: was 200,000, transferred 75,000 -> balance should be 125,000
  const courierBalanceRow = db.prepare(`
    SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) AS balance
    FROM kas_messenger
    WHERE messenger_id = ?
  `).get(msgId) as { balance: number };
  assert.strictEqual(courierBalanceRow.balance, 125000, "Courier balance must decrease by transfer amount");

  // Check internal_transfers record
  const trfRow = db.prepare("SELECT * FROM internal_transfers WHERE idempotency_key = ?").get(idempKey) as any;
  assert.ok(trfRow, "internal_transfers row must exist");
  assert.strictEqual(trfRow.amount, 75000);
  assert.strictEqual(trfRow.messenger_id, msgId);

  // Check idempotency: same key returns existing record without changing balance
  const idempResult = financeService.transferMessengerToOffice(
    {
      messengerId: msgId,
      amount: 75000,
      idempotencyKey: idempKey,
    },
    testAdminUser
  );
  assert.strictEqual(idempResult.transferId, transferResult.transferId);

  const balanceAfterIdemp = (db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) AS balance FROM kas_messenger WHERE messenger_id = ?").get(msgId) as any).balance;
  assert.strictEqual(balanceAfterIdemp, 125000, "Courier balance must not be deducted again on duplicate idempotency key");
});

test("PHASE C - Workstream 3: Void Reimbursement & Non-Destructive Reversals", () => {
  // Setup reimbursement in Dibayar status
  const reimbId = `REIMB-VOID-${Date.now()}`;
  db.prepare(`
    INSERT INTO messenger_reimbursements (id, employee_id, messenger_name, category, amount, date, status)
    VALUES (?, 'EMP-VOID', 'Kurir Void Test', 'Parkir', 15000, '2026-10-30', 'Dibayar')
  `).run(reimbId);

  // 1. RBAC check: courier cannot void
  assert.throws(() => {
    messengerService.voidReimbursement(reimbId, testCourierUser, "Salah nominal");
  }, /Hanya Supervisor atau Administrator/);

  // 2. Missing reason check
  assert.throws(() => {
    messengerService.voidReimbursement(reimbId, testAdminUser, "");
  }, /Alasan pembatalan/);

  // 3. Valid void by supervisor/admin
  const voided = messengerService.voidReimbursement(reimbId, testAdminUser, "Kuitansi salah input");
  assert.strictEqual(voided.status, "Disetujui", "Status must revert to Disetujui");

  // Check compensating debit row in kas_kantor
  const reversalKas = db.prepare(`
    SELECT * FROM kas_kantor WHERE keterangan LIKE ? ORDER BY id DESC LIMIT 1
  `).get(`%[VOID/BATAL] Reversal Pencairan Reimbursement%${reimbId}%`) as any;
  assert.ok(reversalKas, "Compensating Kas Kantor reversal row must exist");
  assert.strictEqual(reversalKas.debit, 15000, "Must debit kas_kantor to reverse outflow");

  // 4. Non-destructive repository deleteKasKantor
  const dummyKas = dbFinanceRepository.addKasKantor({
    tanggal: "2026-10-30",
    keterangan: "Uji Compensating Reversal",
    status: "Debit",
    debit: 50000,
    kredit: 0,
    penanggungJawab: testAdminUser.nama,
  });

  const kasRowsBefore = (db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
  const delSuccess = dbFinanceRepository.deleteKasKantor(dummyKas.id);
  assert.strictEqual(delSuccess, true);

  const kasRowsAfter = (db.prepare("SELECT COUNT(*) as c FROM kas_kantor").get() as any).c;
  assert.strictEqual(kasRowsAfter, kasRowsBefore + 1, "deleteKasKantor must APPEND a reversal row, NEVER delete physically");
});

test("PHASE C - Workstream 2 & 4: Accounting Policy, Quarantine, and Laba Rugi Engine", () => {
  // 1. Quarantine test
  const quarantinedInvoice: any = {
    invoiceNo: "INV-1026-080",
    orderNo: "ORD-1026-080",
    customer: "PT Demo Anomali",
    totalTagihan: 5000000000,
    dibayar: 5000000000,
  };
  assert.strictEqual(isQuarantinedInvoice(quarantinedInvoice), true, "INV-1026-080 must be flagged as quarantined");

  // 2. S > T Discrepancy Warning test
  const discrepancyInvoice: any = {
    invoiceNo: "INV-DISC-001",
    orderNo: "ORD-DISC-001",
    customer: "Customer S > T",
    totalTagihan: 500000,
    dibayar: 500000,
    biayaSamsat: 700000, // S > T
    costVerificationStatus: "VERIFIED",
  };

  // 3. Explicit Zero test
  const explicitZeroInvoice: any = {
    invoiceNo: "INV-ZERO-001",
    orderNo: "ORD-ZERO-001",
    customer: "Customer Jasa Murni",
    totalTagihan: 300000,
    dibayar: 300000,
    biayaSamsat: 0,
    isExplicitZero: true,
    costClassification: "EXPLICIT_ZERO",
  };

  // 4. Proportional matching test
  const normalInvoice: any = {
    invoiceNo: "INV-NORM-001",
    orderNo: "ORD-NORM-001",
    customer: "Customer Normal",
    totalTagihan: 1000000,
    dibayar: 500000, // half paid
    biayaSamsat: 600000, // S <= T
    costVerificationStatus: "VERIFIED",
  };

  // 5. Office expense & Courier operational & Internal Transfer
  const expenses: any[] = [
    { tanggal: "2026-10-30", keterangan: "Listrik Kantor", nominal: 150000 },
    { tanggal: "2026-10-30", keterangan: "Setor sisa kas kurir", nominal: 75000 }, // Transfer: excluded!
  ];

  const courierExpenses: any[] = [
    { tanggal: "2026-10-30", jenis: "Operasional", keterangan: "Bensin kurir", out: 30000 },
    { tanggal: "2026-10-30", jenis: "Talangan Samsat", keterangan: "Biaya samsat pkb", out: 500000 }, // Pass-through: excluded!
  ];

  const summary = computeCanonicalLabaRugi(
    [quarantinedInvoice, discrepancyInvoice, explicitZeroInvoice, normalInvoice],
    expenses,
    courierExpenses,
    "all"
  );

  // Verification:
  // A. Quarantine verification
  assert.strictEqual(summary.quarantinedCount, 1, "Exactly 1 invoice quarantined");
  assert.strictEqual(summary.quarantinedAmount, 5000000000);

  // B. S > T Discrepancy verification
  assert.strictEqual(summary.anomalyInvoices.length, 1, "S > T must be captured in anomalyInvoices");
  assert.strictEqual(summary.anomalyInvoices[0].invoiceNo, "INV-DISC-001");

  // C. Recognized Revenue & Matched COGS:
  // - Explicit zero: 300,000 revenue, 0 Samsat
  // - Normal: 500,000 paid / 1,000,000 totalTagihan (alpha = 0.6) -> matched COGS = 300,000, revenue = 500,000
  // Total Pemasukan = 300,000 + 500,000 = 800,000
  // Total Biaya Samsat = 0 + 300,000 = 300,000
  // Pendapatan Jasa = 800,000 - 300,000 = 500,000
  assert.strictEqual(summary.totalPemasukan, 800000, "Recognized revenue must be 800,000");
  assert.strictEqual(summary.totalBiayaSamsat, 300000, "Matched Samsat COGS must be 300,000");
  assert.strictEqual(summary.totalPendapatanJasa, 500000, "Pendapatan jasa must be 500,000");

  // D. Operational expenses:
  // - Office: 150,000 (transfer excluded)
  // - Courier: 30,000 (pass-through Samsat excluded)
  // Total Beban Operasional = 180,000
  assert.strictEqual(summary.pengeluaranKantor, 150000);
  assert.strictEqual(summary.pengeluaranMessenger, 30000);
  assert.strictEqual(summary.totalBebanOperasional, 180000);

  // E. Net Profit:
  // Laba Bersih = 500,000 - 180,000 = 320,000
  assert.strictEqual(summary.labaRugiBersih, 320000);

  // F. Classification check
  assert.strictEqual(classifyFinancialTransaction({ keterangan: "Setor sisa kas kurir" }), "INTERNAL_TRANSFER");
  assert.strictEqual(classifyFinancialTransaction({ keterangan: "bayar samsat pkb" }), "SAMSAT_PASS_THROUGH");
});
