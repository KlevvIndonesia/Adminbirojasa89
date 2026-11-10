/**
 * Phase 9.0 — Order-to-Sales Projection & Canonical Mapping Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies:
 * 1. resolveOrderSalesCategory canonical categorization across all 5 operational categories
 * 2. projectOrderToContractRow pure contract mapping and semantic property separation
 * 3. Immediate appearance of newly created orders in Data Penjualan tabs starting at Stage 1
 * 4. Mock vs API provider isolation (zero legacy fixture leakage in API mode)
 * 5. Deterministic and idempotent deduplication
 * 6. Reactive projection updates via orderRepository subscription
 * 7. Safe edit propagation and deletion safeguards for projected orders
 * 8. Strict preservation of financial tabs 6-8 (belum-kurang-bayar, profit-terpending, cashback-terpending)
 */

import test from "node:test";
import assert from "node:assert";
import {
  resolveOrderSalesCategory,
  projectOrderToContractRow,
  deriveStatusPengerjaan,
  deriveStatusPembayaran,
  buildFieldsFromContract,
  MUTASI_LD_COLUMNS_CONTRACT,
  MUTASI_AS_COLUMNS_CONTRACT,
  BBN_COLUMNS_CONTRACT,
  PERPANJANGAN_PAJAK_COLUMNS_CONTRACT,
  LAIN_LAIN_COLUMNS_CONTRACT,
} from "../src/app/data/penjualanContractData";
import { financeStore } from "../src/app/data/financeStore";
import { orderStore } from "../src/app/data/orderStore";
import { orderRepository } from "../src/data/repositories/orderRepository";
import { MockOrderProvider } from "./fixtures/mock/mockOrderProvider";
import { ApiOrderProvider } from "../src/data/api/apiOrderProvider";
import type { OperationalOrder } from "../src/domain/order/types";

function createMockOrder(overrides: Partial<OperationalOrder> = {}): OperationalOrder {
  return {
    orderNo: "ORD-TEST-9001",
    customer: "PT. Test Customer",
    nomorHP: "081234567890",
    layanan: "Mutasi Luar Daerah",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: "2026-10-17T08:00:00.000Z",
    tanggalMasukBerkas: "2026-10-17T08:00:00.000Z",
    namaPemilik: "Bambang Owner Sesuai BPKB",
    kepemilikanKendaraan: "Milik Sendiri",
    jenisKendaraan: "Mobil",
    tahunKendaraan: 2022,
    nopol: "B 9999 XYZ",
    pkbBerlakuSd: "2027-10-17",
    tahunPajak: "2026",
    bulanPajak: "10",
    nominalPkbTerakhir: 3000000,
    nominalSwdkllj: 143000,
    wilayahSamsatAsal: "Jakarta Selatan",
    wilayahSamsatTujuan: "Bandung",
    alamatPenjemputan: {
      kota: "Jakarta",
      kecamatan: "Cilandak",
      kelurahan: "Cilandak Barat",
      detail: "Jl TB Simatupang No 1",
      rtRw: "01/02",
      nomor: "1",
      landmark: "Dekat Gerbang Tol",
    },
    alamatPengantaran: {
      kota: "Bandung",
      kecamatan: "Coblong",
      kelurahan: "Dago",
      detail: "Jl Ir H Djuanda No 5",
      rtRw: "03/04",
      nomor: "5",
      landmark: "Dekat ITB",
    },
    clientDocuments: {
      BPKB: { name: "BPKB Asli", status: "Sudah Tersedia" },
      STNK: { name: "STNK Asli", status: "Sudah Tersedia" },
    },
    updatedDocuments: [],
    biayaJasa: 500000,
    pkb: 3000000,
    swdkllj: 143000,
    dendaSwdkllj: 0,
    totalEstimasi: 3643000,
    samsatProcesses: [],
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Transfer Bank BCA",
      statusPembayaran: "Lunas",
      totalBiaya: 3643000,
      dibayar: 3643000,
      kurang: 0,
      tanggalBayar: "2026-10-17",
      namaBank: "BCA",
      invoiceNo: "INV-2026-9001",
    },
    ...overrides,
  };
}

test("Phase 9.0 — 1. resolveOrderSalesCategory canonical routing", () => {
  // Mutasi Antar Daerah
  assert.strictEqual(resolveOrderSalesCategory("Mutasi Luar Daerah"), "mutasi-antar-daerah");
  assert.strictEqual(resolveOrderSalesCategory("Mutasi LD"), "mutasi-antar-daerah");
  assert.strictEqual(resolveOrderSalesCategory("mutasi ld jakarta"), "mutasi-antar-daerah");
  assert.strictEqual(resolveOrderSalesCategory("Mutasi"), "mutasi-antar-daerah");

  // Mutasi Asal
  assert.strictEqual(resolveOrderSalesCategory("Mutasi Antar Samsat"), "mutasi-asal");
  assert.strictEqual(resolveOrderSalesCategory("Mutasi AS"), "mutasi-asal");
  assert.strictEqual(resolveOrderSalesCategory("mutasi antar samsat jaktim ke jaksel"), "mutasi-asal");

  // Balik Nama
  assert.strictEqual(resolveOrderSalesCategory("Balik Nama"), "balik-nama");
  assert.strictEqual(resolveOrderSalesCategory("BBN"), "balik-nama");
  assert.strictEqual(resolveOrderSalesCategory("BBN 1"), "balik-nama");
  assert.strictEqual(resolveOrderSalesCategory("BBN 2"), "balik-nama");

  // Perpanjangan Pajak (1 Tahun & 5 Tahun)
  assert.strictEqual(resolveOrderSalesCategory("Perpanjangan 1 Tahun"), "perpanjangan-1-tahun");
  assert.strictEqual(resolveOrderSalesCategory("Perpanjangan 5 Tahun"), "perpanjangan-5-tahun");
  assert.strictEqual(resolveOrderSalesCategory("Pajak Tahunan"), "perpanjangan-1-tahun");
  assert.strictEqual(resolveOrderSalesCategory("Pajak 5 tahunan"), "perpanjangan-5-tahun");

  // Canonical Services & Defaults
  assert.strictEqual(resolveOrderSalesCategory("Tarik Berkas"), "tarik-berkas");
  assert.strictEqual(resolveOrderSalesCategory("Duplikat STNK"), "duplikat-stnk");
  assert.strictEqual(resolveOrderSalesCategory("Ganti Plat"), "perpanjangan-5-tahun");
  assert.strictEqual(resolveOrderSalesCategory(""), "perpanjangan-1-tahun");
  assert.strictEqual(resolveOrderSalesCategory(undefined), "perpanjangan-1-tahun");
});

test("Phase 9.0 — 2. projectOrderToContractRow preserves strict semantics and approved labels", () => {
  const order = createMockOrder();
  const row = projectOrderToContractRow(order);

  // Deterministic stable ID
  assert.strictEqual(row.id, "ord:ORD-TEST-9001");
  assert.strictEqual(row.orderNo, "ORD-TEST-9001");

  // Approved canonical labels and field separations
  // Strict separation: Customer is PT. Test Customer, Owner is Bambang Owner Sesuai BPKB
  assert.strictEqual(row["Nama Customer"], "PT. Test Customer");
  assert.strictEqual(row["Nama"], "Bambang Owner Sesuai BPKB");
  assert.strictEqual(row["Plat No"], "B 9999 XYZ");
  assert.strictEqual(row["Jenis Pengurusan"], "Mutasi Luar Daerah");

  // Vehicle classification
  assert.strictEqual(row["R4 / R2"], "R4");

  // Dates formatted DD/MM/YYYY
  assert.match(row["Tanggal Masuk Berkas"], /^\d{2}\/\d{2}\/\d{4}$/);
  assert.strictEqual(row["Tanggal Masuk Berkas"], "17/10/2026");

  // Financial values
  assert.strictEqual(row["Uang Masuk dari Konsumen"], 3643000);
  assert.strictEqual(row["Uang Keluar dari Biro Jasa"], 3143000); // 3000000 + 143000
  assert.strictEqual(row["Profit"], 500000);

  // Operational Stage 1 dual statuses: Phase 9.1
  assert.strictEqual(row["Status Pengerjaan"], "Dalam Proses");
  assert.strictEqual(row["Status Pembayaran"], "Lunas");
  assert.strictEqual(row["Status"], "Dalam Proses");

  // BPKB fields
  assert.strictEqual(row["BPKB"], "Ada");
  assert.strictEqual(row["Status BPKB"], "-");
});

test("Phase 9.0 — 3. projectOrderToContractRow motor/R2 vehicle classification", () => {
  const motorOrder = createMockOrder({
    orderNo: "ORD-TEST-9002",
    jenisKendaraan: "Motor",
    layanan: "Perpanjangan 1 Tahun",
  });
  const row = projectOrderToContractRow(motorOrder);
  assert.strictEqual(row["R4 / R2"], "R2");
});

test("Phase 9.0 & 9.1 — 4. projectOrderToContractRow Stage 8 unarchived vs archived status", () => {
  const completedOrder = createMockOrder({
    orderNo: "ORD-TEST-9003",
    currentStep: 8,
    isReceived: true,
  });
  // Unarchived Stage 8 order
  const unarchivedRow = projectOrderToContractRow(completedOrder, undefined, false);
  assert.strictEqual(unarchivedRow["Status Pengerjaan"], "Menunggu Arsip");
  assert.strictEqual(unarchivedRow["Status"], "Menunggu Arsip");
  assert.strictEqual(unarchivedRow["Status BPKB"], "Selesai");

  // Archived Stage 8 order
  const archivedRow = projectOrderToContractRow(completedOrder, undefined, true);
  assert.strictEqual(archivedRow["Status Pengerjaan"], "Selesai");
  assert.strictEqual(archivedRow["Status"], "Selesai");
  assert.strictEqual(archivedRow["Status BPKB"], "Selesai");
});

test("Phase 9.0 — 5. Mock mode: newly created order appears immediately in Data Penjualan tab", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  const newOrder = createMockOrder({
    orderNo: "ORD-PROJ-001",
    customer: "CV. Bintang Harapan",
    layanan: "Mutasi Luar Daerah",
    nopol: "B 7777 ABC",
  });

  orderRepository.saveOrder(newOrder);

  const mutasiLdData = financeStore.getContractData("mutasi-ld");
  const found = mutasiLdData.find((r) => r.orderNo === "ORD-PROJ-001" || r.id === "ord:ORD-PROJ-001");

  assert.ok(found, "Newly created order must appear immediately in mutasi-ld contract dataset");
  assert.strictEqual(found["Nama Customer"], "CV. Bintang Harapan");
  assert.strictEqual(found["Plat No"], "B 7777 ABC");
  assert.strictEqual(found["Jenis Pengurusan"], "Mutasi Luar Daerah");
});

test("Phase 9.0 — 6. Mock mode: deduplication against legacy fixtures is idempotent", () => {
  financeStore.setApiMode(false);
  const initialRows = financeStore.getContractData("mutasi-ld");
  const initialCount = initialRows.length;

  // Repeated calls must return exact same count and order
  const secondFetch = financeStore.getContractData("mutasi-ld");
  assert.strictEqual(secondFetch.length, initialCount);

  // Check no duplicate IDs exist
  const idSet = new Set(secondFetch.map((r) => r.id));
  assert.strictEqual(idSet.size, secondFetch.length, "All row IDs in Data Penjualan must be unique");
});

test("Phase 9.0 — 7. API mode: zero mock fixtures leak into operational tabs", () => {
  financeStore.setApiMode(true);
  const mockProvider = new MockOrderProvider();
  // Clear any existing orders in provider for test isolation
  orderRepository.setProvider(mockProvider);

  // When no orders match, operational tabs in API mode must be empty (0 mock fixtures!)
  const emptyMutasiLd = financeStore.getContractData("mutasi-ld");
  // Only orders in provider match
  const allOrdersInRepo = orderRepository.getAllFlat();
  const matchingOrders = allOrdersInRepo.filter((o) => resolveOrderSalesCategory(o.layanan) === "mutasi-ld");

  assert.strictEqual(
    emptyMutasiLd.length,
    matchingOrders.length,
    "API mode must only contain projected live orders, not static mock fixtures"
  );

  // Fixtures with ids 1, 2, 3... from initialMutasiLDContract must NOT be present unless from live orders
  const fixtureLeaked = emptyMutasiLd.some((r) => r.id === 1 && r["Nama Customer"] === "PT. MAJU JAYA");
  assert.strictEqual(fixtureLeaked, false, "Static fixture row 1 must not leak into API mode");
});

test("Phase 9.0 — 8. Reactive projection updates when orders are added or updated", () => {
  financeStore.setApiMode(false);
  let notifyCount = 0;
  const unsub = financeStore.subscribe(() => {
    notifyCount++;
  });

  const reactiveOrder = createMockOrder({
    orderNo: "ORD-REACT-100",
    customer: "Toko Sinar Rezeki",
    layanan: "Balik Nama",
  });

  orderRepository.saveOrder(reactiveOrder);
  assert.ok(notifyCount > 0, "FinanceStore must notify subscribers when orderRepository changes");

  const bbnRows = financeStore.getContractData("bbn");
  const found = bbnRows.find((r) => r.orderNo === "ORD-REACT-100");
  assert.ok(found, "Order must be projected in BBN tab reactively");

  unsub();
});

test("Phase 9.0 — 9. updateContractData on projected order updates orderRepository", () => {
  const editableOrder = createMockOrder({
    orderNo: "ORD-EDIT-200",
    customer: "Original Customer",
    layanan: "Mutasi Antar Samsat",
    nopol: "B 1111 ORI",
  });

  orderRepository.saveOrder(editableOrder);

  const updated = financeStore.updateContractData("mutasi-as", "ord:ORD-EDIT-200", {
    "Nama Customer": "Updated Customer Name",
    "Plat No": "B 2222 NEW",
  });

  assert.strictEqual(updated, true);

  const orderInRepo = orderRepository.getByOrderNo("ORD-EDIT-200");
  assert.strictEqual(orderInRepo?.customer, "Updated Customer Name");
  assert.strictEqual(orderInRepo?.nopol, "B 2222 NEW");
});

test("Phase 9.0 — 10. deleteContractData on projected order refuses destructive deletion", () => {
  const protectedOrder = createMockOrder({
    orderNo: "ORD-DEL-300",
    customer: "Protected Customer",
    layanan: "Mutasi Luar Daerah",
  });

  orderRepository.saveOrder(protectedOrder);

  // Financial tabs strictly refuse deletion
  const delFinancial = financeStore.deleteContractData("belum-kurang-bayar", "ord:ORD-DEL-300");
  assert.strictEqual(delFinancial, false, "Financial tab refuses deletion");

  // Operational tab deletion safely marks order as deleted from sales projection
  const delResult = financeStore.deleteContractData("mutasi-antar-daerah", "ord:ORD-DEL-300");
  assert.strictEqual(delResult, true, "Projected order is safely removed from operational dataset");
});

test("Phase 9.0 — 11. addContractData handles safe ID generation without NaN", () => {
  const success = financeStore.addContractData("tarik-berkas", [
    {
      "Tanggal Masuk Berkas": "17/10/2026",
      "R4 / R2": "R4",
      "Plat No": "B 8888 ADD",
      "Nama Customer": "Manual Entry Customer",
      "Nomor HP": "081234567890",
      "Nama": "Manual Owner",
      "Jenis Pengurusan": "Tarik Berkas",
      "Samsat": "Jakarta Barat",
      "Jenis Bayar": "Cash",
      "Tanggal Uang Masuk": "17/10/2026",
      "Uang Masuk dari Konsumen": 1500000,
      "Bank Uang Keluar": "Kas Kantor",
      "Tanggal Uang Keluar": "17/10/2026",
      "Uang Keluar dari Biro Jasa": 1000000,
      "Profit": 500000,
      "Status": "Selesai",
      "No Invoice": "INV-MAN-001",
      "Tanggal Invoice": "17/10/2026",
      "Tanda Terima": "TT-MAN-001",
    },
  ]);

  assert.strictEqual(success, true);
  const tarikBerkas = financeStore.getContractData("tarik-berkas");
  const manualRow = tarikBerkas.find((r) => r["No Invoice"] === "INV-MAN-001");
  assert.ok(manualRow, "Manual row must be found in tarik-berkas projection");
  assert.ok(manualRow.id, "Generated ID must be defined");
  assert.ok(typeof manualRow.id === "string" || typeof manualRow.id === "number");
});

test("Phase 9.0 — 12. Strict preservation of financial tabs 6-8", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  // 1. Seed unpaid invoice for belum-kurang-bayar
  financeStore.addInvoice({
    customer: "Customer Unpaid",
    nopol: "B 1111 UNP",
    totalTagihan: 5000000,
    terbayar: 2000000,
    status: "Kurang Bayar",
    invoice: "INV-UNP-001",
  });

  // belum-kurang-bayar
  const belumBayar = financeStore.getContractData("belum-kurang-bayar");
  assert.ok(Array.isArray(belumBayar));
  assert.ok(belumBayar.length > 0);
  assert.ok("Kekurangan" in belumBayar[0]);

  // 2. Seed active order & fully-paid invoice for profit-terpending
  const profitOrder = createMockOrder({
    orderNo: "ORD-PROF-101",
    customer: "Customer Profit",
    nopol: "B 2222 PRF",
    currentStep: 2,
    currentStageName: "Berkas Masuk",
    layanan: "Mutasi Luar Daerah",
  });
  orderRepository.saveOrder(profitOrder);
  financeStore.addInvoice({
    orderNo: "ORD-PROF-101",
    customer: "Customer Profit",
    nopol: "B 2222 PRF",
    totalTagihan: 3000000,
    terbayar: 3000000,
    status: "Lunas",
    profit: 500000,
    invoice: "INV-PRF-001",
  });

  // profit-terpending
  const profitPending = financeStore.getContractData("profit-terpending");
  assert.ok(Array.isArray(profitPending));
  assert.ok(profitPending.length > 0);
  assert.ok("Alasan" in profitPending[0]);

  // 3. Seed invoice with cashback/overpayment for cashback-terpending
  financeStore.addInvoice({
    customer: "Customer Cashback",
    nopol: "B 3333 CSH",
    totalTagihan: 2000000,
    terbayar: 2500000,
    cashback: 100000,
    cashbackStatus: "PENDING",
    invoice: "INV-CSH-001",
  });

  // cashback-terpending
  const cashbackPending = financeStore.getContractData("cashback-terpending");
  assert.ok(Array.isArray(cashbackPending));
  assert.ok(cashbackPending.length > 0);
  assert.ok("Jumlah Cashback" in cashbackPending[0]);
});

// ============================================================================
// PHASE 9.1 — DUAL STATUS INTEGRATION COMPREHENSIVE TESTS
// ============================================================================

test("Phase 9.1 — 13. deriveStatusPengerjaan canonical derivation across stages 1 to 8 and archive state", () => {
  // Stages 1 to 7 must all derive "Dalam Proses"
  for (let step = 1; step <= 7; step++) {
    assert.strictEqual(
      deriveStatusPengerjaan({ currentStep: step }),
      "Dalam Proses",
      `Step ${step} must map to 'Dalam Proses'`
    );
  }

  // Stage 8 unarchived -> "Menunggu Arsip"
  assert.strictEqual(
    deriveStatusPengerjaan({ currentStep: 8 }, false),
    "Menunggu Arsip",
    "Stage 8 unarchived must map to 'Menunggu Arsip'"
  );

  // Stage 8 archived -> "Selesai"
  assert.strictEqual(
    deriveStatusPengerjaan({ currentStep: 8 }, true),
    "Selesai",
    "Stage 8 archived must map to 'Selesai'"
  );

  // Also when order.isArchived is true directly on the order
  assert.strictEqual(
    deriveStatusPengerjaan({ currentStep: 8, isArchived: true } as any),
    "Selesai",
    "Order with isArchived: true must map to 'Selesai'"
  );

  // Neutral fallbacks for invalid, non-order, or NaN
  assert.strictEqual(deriveStatusPengerjaan(undefined), "-");
  assert.strictEqual(deriveStatusPengerjaan(null), "-");
  assert.strictEqual(deriveStatusPengerjaan({ currentStep: NaN }), "-");
  assert.strictEqual(deriveStatusPengerjaan({ currentStep: 0 }), "-");
});

test("Phase 9.1 — 14. deriveStatusPembayaran canonical derivation across payment conditions and refunds", () => {
  // 1. Missing invoice -> "Tagihan Tidak Tersedia"
  assert.strictEqual(deriveStatusPembayaran(undefined), "Tagihan Tidak Tersedia");
  assert.strictEqual(deriveStatusPembayaran(null), "Tagihan Tidak Tersedia");

  // 2. Unpaid invoice (terbayar === 0 && totalTagihan > 0) -> "Belum Bayar"
  const unpaidInv: any = { id: 1, totalTagihan: 5000000, terbayar: 0, status: "Belum Bayar" };
  assert.strictEqual(deriveStatusPembayaran(unpaidInv), "Belum Bayar");

  // 3. Partially paid invoice (0 < terbayar < totalTagihan) -> "Kurang Bayar"
  const partialInv: any = { id: 2, totalTagihan: 5000000, terbayar: 2000000, status: "Kurang Bayar" };
  assert.strictEqual(deriveStatusPembayaran(partialInv), "Kurang Bayar");

  // 4. Fully paid invoice (terbayar >= totalTagihan) -> "Lunas"
  const paidInv: any = { id: 3, totalTagihan: 5000000, terbayar: 5000000, status: "Lunas" };
  assert.strictEqual(deriveStatusPembayaran(paidInv), "Lunas");

  // 5. Overpayment with refundStatus === "PENDING" -> "Kelebihan Bayar" (Never "Lunas" while pending!)
  const overpaidPendingInv: any = {
    id: 4,
    totalTagihan: 5000000,
    terbayar: 6000000,
    settlementCondition: "OVERPAID",
    refundStatus: "PENDING",
  };
  assert.strictEqual(deriveStatusPembayaran(overpaidPendingInv), "Kelebihan Bayar");

  // 6. Overpayment with refundStatus === "PROCESSED" -> "Kelebihan Bayar"
  const overpaidProcessedInv: any = {
    id: 5,
    totalTagihan: 5000000,
    terbayar: 6000000,
    settlementCondition: "OVERPAID",
    refundStatus: "PROCESSED",
  };
  assert.strictEqual(deriveStatusPembayaran(overpaidProcessedInv), "Kelebihan Bayar");

  // 7. Invalid numbers -> "Tagihan Tidak Tersedia"
  const invalidInv: any = { id: 6, totalTagihan: 0, terbayar: 0 };
  assert.strictEqual(deriveStatusPembayaran(invalidInv), "Tagihan Tidak Tersedia");
  const nanInv: any = { id: 7, totalTagihan: NaN, terbayar: 1000 };
  assert.strictEqual(deriveStatusPembayaran(nanInv), "Tagihan Tidak Tersedia");
});

test("Phase 9.1 — 15. Operational column contracts contain Status Pengerjaan & Status Pembayaran, Financial tabs retain Status", () => {
  const operationalContracts = [
    MUTASI_LD_COLUMNS_CONTRACT,
    MUTASI_AS_COLUMNS_CONTRACT,
    BBN_COLUMNS_CONTRACT,
    PERPANJANGAN_PAJAK_COLUMNS_CONTRACT,
    LAIN_LAIN_COLUMNS_CONTRACT,
  ];

  operationalContracts.forEach((contract) => {
    assert.ok(contract.includes("Status Pengerjaan"), "Contract must include Status Pengerjaan");
    assert.ok(contract.includes("Status Pembayaran"), "Contract must include Status Pembayaran");
    assert.strictEqual(
      (contract as readonly string[]).includes("Status"),
      false,
      "Operational contracts must replace single Status with dual status columns"
    );
  });
});

test("Phase 9.1 — 16. Strict invoice linking: matching customer or nopol without orderNo/invoiceNo MUST NOT link", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  // Add an invoice to financeStore with nopol "B 1234 XYZ" and customer "PT. Strictly Separate"
  financeStore.addInvoice({
    customer: "PT. Strictly Separate",
    nopol: "B 1234 XYZ",
    totalTagihan: 4000000,
    terbayar: 4000000,
    status: "Lunas",
    invoice: "INV-STRICT-999",
  });

  // Create an order with the exact same customer and nopol, but DIFFERENT orderNo and NO matching invoiceNo
  const unlinkedOrder = createMockOrder({
    orderNo: "ORD-NO-LINK-001",
    customer: "PT. Strictly Separate",
    nopol: "B 1234 XYZ",
    layanan: "Mutasi Luar Daerah",
    totalEstimasi: 0,
    payment: undefined,
  });

  orderRepository.saveOrder(unlinkedOrder);

  const mutasiLdRows = financeStore.getContractData("mutasi-ld");
  const projectedRow = mutasiLdRows.find((r) => r.orderNo === "ORD-NO-LINK-001");

  assert.ok(projectedRow, "Projected row must exist");
  // Must NOT link to INV-STRICT-999 merely because nopol or customer matches!
  assert.notStrictEqual(projectedRow["No Invoice"], "INV-STRICT-999");
  assert.strictEqual(
    projectedRow["Status Pembayaran"],
    "Tagihan Tidak Tersedia",
    "Must show 'Tagihan Tidak Tersedia' when no strict orderNo or invoiceNo link exists"
  );
});

test("Phase 9.1 — 17. Strict invoice linking: matching orderNo or payment.invoiceNo successfully links", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  // 1. Link by orderNo
  financeStore.addInvoice({
    customer: "PT. Linked By Order",
    nopol: "B 5555 LNK",
    totalTagihan: 5000000,
    terbayar: 0,
    status: "Belum Bayar",
    orderNo: "ORD-LINK-BY-ORDER",
    invoice: "INV-LNK-001",
  });

  const orderLinkedByOrder = createMockOrder({
    orderNo: "ORD-LINK-BY-ORDER",
    customer: "PT. Linked By Order",
    nopol: "B 5555 LNK",
    layanan: "Mutasi Antar Samsat",
  });
  orderRepository.saveOrder(orderLinkedByOrder);

  const asRows = financeStore.getContractData("mutasi-as");
  const foundByOrder = asRows.find((r) => r.orderNo === "ORD-LINK-BY-ORDER");
  assert.ok(foundByOrder);
  assert.strictEqual(foundByOrder["Status Pembayaran"], "Belum Bayar");

  // 2. Link by invoiceNo
  financeStore.addInvoice({
    customer: "PT. Linked By Inv",
    nopol: "B 6666 LNK",
    totalTagihan: 6000000,
    terbayar: 3000000,
    status: "Kurang Bayar",
    invoice: "INV-MATCH-777",
  });

  const orderLinkedByInv = createMockOrder({
    orderNo: "ORD-LINK-BY-INV",
    customer: "PT. Linked By Inv",
    nopol: "B 6666 LNK",
    layanan: "Balik Nama",
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Transfer",
      statusPembayaran: "Kurang",
      totalBiaya: 6000000,
      dibayar: 3000000,
      kurang: 3000000,
      invoiceNo: "INV-MATCH-777",
    },
  });
  orderRepository.saveOrder(orderLinkedByInv);

  const bbnRows = financeStore.getContractData("bbn");
  const foundByInv = bbnRows.find((r) => r.orderNo === "ORD-LINK-BY-INV");
  assert.ok(foundByInv);
  assert.strictEqual(foundByInv["Status Pembayaran"], "Kurang Bayar");
});

test("Phase 9.1 — 18. Mock mode legacy fixtures fallback to neutral status without fabricated progress", () => {
  financeStore.setApiMode(false);
  (financeStore as any).contractDatasets["mutasi-antar-daerah"] = [
    {
      id: 99991,
      "Nama Customer": "Legacy Customer",
      "Plat No": "B 1234 LEG",
      "Jenis Pengurusan": "Mutasi Antar Daerah",
      "Uang Masuk dari Konsumen": 1000000,
      "Uang Keluar dari Biro Jasa": 800000,
      Profit: 200000,
    },
  ];
  const mutasiLdData = financeStore.getContractData("mutasi-ld");

  // Find legacy fixtures (numerical ID)
  const legacyFixtures = mutasiLdData.filter((r) => typeof r.id === "number" && !r.orderNo);
  assert.ok(legacyFixtures.length > 0, "Legacy fixtures should be present in mock mode");

  legacyFixtures.forEach((fixture) => {
    assert.strictEqual(
      fixture["Status Pengerjaan"],
      "-",
      "Legacy fixtures must have neutral Status Pengerjaan '-'"
    );
    assert.ok(
      fixture["Status Pembayaran"] === "Tagihan Tidak Tersedia" ||
        fixture["Status Pembayaran"] === "Lunas" ||
        fixture["Status Pembayaran"] === "Belum Bayar" ||
        fixture["Status Pembayaran"] === "Belum Lunas" ||
        fixture["Status Pembayaran"] === "Kurang Bayar",
      "Status Pembayaran must be valid or fallback"
    );
  });
});

test("Phase 9.1 — 19. Order lifecycle transitions update projected Status Pengerjaan reactively", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  const lifecycleOrder = createMockOrder({
    orderNo: "ORD-LIFECYCLE-900",
    customer: "Lifecycle Customer",
    layanan: "Perpanjangan 5 Tahun",
    currentStep: 1,
  });
  orderRepository.saveOrder(lifecycleOrder);

  // Step 1: Dalam Proses
  let rows = financeStore.getContractData("perpanjangan-5-tahun");
  let target = rows.find((r) => r.orderNo === "ORD-LIFECYCLE-900");
  assert.strictEqual(target?.["Status Pengerjaan"], "Dalam Proses");

  // Advance to Step 8 (unarchived) -> Menunggu Arsip
  orderRepository.updateOrder("ORD-LIFECYCLE-900", { currentStep: 8, isReceived: true });
  rows = financeStore.getContractData("perpanjangan-5-tahun");
  target = rows.find((r) => r.orderNo === "ORD-LIFECYCLE-900");
  assert.strictEqual(target?.["Status Pengerjaan"], "Menunggu Arsip");

  // Archive order -> Selesai
  orderRepository.archiveOrder("ORD-LIFECYCLE-900");
  rows = financeStore.getContractData("perpanjangan-5-tahun");
  target = rows.find((r) => r.orderNo === "ORD-LIFECYCLE-900");
  assert.strictEqual(target?.["Status Pengerjaan"], "Selesai");
});

test("Phase 9.1 — 20. Payment realization updates Status Pembayaran reactively", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  const orderNo = "ORD-PAY-REAL-101";
  const inv = financeStore.addInvoice({
    customer: "Pay Real Customer",
    nopol: "B 1234 PAY",
    totalTagihan: 5000000,
    terbayar: 0,
    status: "Belum Bayar",
    orderNo: orderNo,
    invoice: "INV-PAY-101",
  });

  const order = createMockOrder({
    orderNo: orderNo,
    customer: "Pay Real Customer",
    nopol: "B 1234 PAY",
    layanan: "Tarik Berkas",
  });
  orderRepository.saveOrder(order);

  // Initial: Belum Bayar
  let rows = financeStore.getContractData("tarik-berkas");
  let target = rows.find((r) => r.orderNo === orderNo);
  assert.strictEqual(target?.["Status Pembayaran"], "Belum Bayar");

  // Partial payment of 2,000,000 -> Kurang Bayar
  financeStore.recordPayment(inv.id, 2000000);
  rows = financeStore.getContractData("tarik-berkas");
  target = rows.find((r) => r.orderNo === orderNo);
  assert.strictEqual(target?.["Status Pembayaran"], "Kurang Bayar");

  // Full settlement of remaining 3,000,000 -> Lunas
  financeStore.recordPayment(inv.id, 3000000);
  rows = financeStore.getContractData("tarik-berkas");
  target = rows.find((r) => r.orderNo === orderNo);
  assert.strictEqual(target?.["Status Pembayaran"], "Lunas");
});

// ============================================================================
// PHASE 9.2 — ACTION INTEGRITY: CANONICAL VIEW/EDIT & CONDITIONAL ADD TESTS
// ============================================================================

test("Phase 9.2 — 21. Action Integrity: 'Lihat' resolution distinguishes canonical orders vs legacy mock fixtures", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  // 1. Projected Order
  const canonicalOrder = createMockOrder({
    orderNo: "ORD-LIHAT-001",
    customer: "PT. Lihat Sukses",
    nopol: "B 5555 LHT",
    layanan: "Mutasi Antar Samsat",
    currentStep: 3,
    currentStageName: "Cek Fisik",
  });
  orderRepository.saveOrder(canonicalOrder);

  const rows = financeStore.getContractData("mutasi-as");
  const projectedRow = rows.find((r) => r.orderNo === "ORD-LIHAT-001");
  assert.ok(projectedRow, "Projected row must exist");

  // Inspect canonical resolution: orderNo is present and links directly to canonical order
  assert.ok(projectedRow.orderNo);
  const retrievedOrder = orderRepository.getByOrderNo(projectedRow.orderNo);
  assert.ok(retrievedOrder, "Canonical order must be retrievable via orderNo");
  assert.strictEqual(retrievedOrder.currentStep, 3);
  assert.strictEqual(retrievedOrder.currentStageName, "Cek Fisik");

  // 2. Legacy mock fixture: numeric id without orderNo
  const legacyFixture = rows.find((r) => !r.orderNo && typeof r.id === "number");
  if (legacyFixture) {
    assert.strictEqual(legacyFixture.orderNo, undefined, "Legacy fixture must not have fabricated orderNo");
    const fakeOrder = orderRepository.getByOrderNo(String(legacyFixture.id));
    assert.strictEqual(fakeOrder, undefined, "No fake order must be fabricated for legacy mock fixture");
  }
});

test("Phase 9.2 — 22. Action Integrity: '+ Tambah Data' creates canonical order at Stage 1 and projects without duplication", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  const initialCount = financeStore.getContractData("mutasi-as").length;

  const success = financeStore.addContractData("mutasi-as", [
    {
      "Nama Customer": "PT. Solusi Bangsa",
      "Nomor HP": "081234567890",
      "Plat No": "B 9876 SLS",
      "Jenis Pengurusan": "Mutasi Antar Samsat",
      "Nama": "Budi Santoso",
      "Samsat": "Jakarta Timur",
      "R4 / R2": "R4",
      "Uang Masuk dari Konsumen": 3500000,
      "Uang Keluar dari Biro Jasa": 2800000,
      "Profit": 700000,
      "BPKB": "Ada",
    },
  ]);

  assert.strictEqual(success, true, "Valid order creation must succeed");

  // Verify created order in orderRepository
  const allOrders = orderRepository.getAllFlat();
  const createdOrder = allOrders.find((o) => o.nopol === "B 9876 SLS");
  assert.ok(createdOrder, "Canonical order must be created in orderRepository");
  assert.strictEqual(createdOrder.customer, "PT. Solusi Bangsa");
  assert.strictEqual(createdOrder.currentStep, 1, "Must start at Stage 1");
  assert.strictEqual(createdOrder.currentStageName, "Verifikasi");
  assert.ok(createdOrder.orderNo, "Must have an authoritative orderNo");

  // Verify automatic projection in Data Penjualan tab
  const mutasiAsRows = financeStore.getContractData("mutasi-as");
  const matchingRows = mutasiAsRows.filter((r) => r.orderNo === createdOrder.orderNo);
  assert.strictEqual(matchingRows.length, 1, "Exactly ONE projected row must appear (zero duplicate rows)");
  assert.strictEqual(matchingRows[0]["Status Pengerjaan"], "Dalam Proses");
  assert.strictEqual(mutasiAsRows.length, initialCount + 1, "Total count must increment by exactly 1");
});

test("Phase 9.2 — 23. Action Integrity: '+ Tambah Data' strictly rejects invalid submissions", () => {
  financeStore.setApiMode(false);
  const initialOrderCount = orderRepository.getAllFlat().length;

  // Missing customer
  const fail1 = financeStore.addContractData("bbn", [
    { "Nama Customer": "", "Plat No": "B 1234 ABC", "Jenis Pengurusan": "Balik Nama" },
  ]);
  assert.strictEqual(fail1, false, "Must reject row with empty customer");

  // Missing nopol
  const fail2 = financeStore.addContractData("bbn", [
    { "Nama Customer": "PT. Ada Customer", "Plat No": "   ", "Jenis Pengurusan": "Balik Nama" },
  ]);
  assert.strictEqual(fail2, false, "Must reject row with empty nopol");

  // Incomplete batch (one valid, one invalid)
  const fail3 = financeStore.addContractData("bbn", [
    { "Nama Customer": "Valid Customer", "Plat No": "B 1111 VAL", "Jenis Pengurusan": "Balik Nama" },
    { "Nama Customer": "", "Plat No": "", "Jenis Pengurusan": "" },
  ]);
  assert.strictEqual(fail3, false, "Must atomically reject batch containing invalid row");

  // Verify zero orphan orders created
  assert.strictEqual(orderRepository.getAllFlat().length, initialOrderCount, "No orphan orders may be created on rejection");
});

test("Phase 9.2 — 24. Action Integrity: 'Edit' safely mutates canonical order fields and persists", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  const order = createMockOrder({
    orderNo: "ORD-EDIT-SAFE-1",
    customer: "Original Customer PT",
    namaPemilik: "Original Owner",
    nopol: "B 1010 OLD",
    layanan: "Mutasi Luar Daerah",
    wilayahSamsatAsal: "Jakarta Timur",
  });
  orderRepository.saveOrder(order);

  // Edit safe fields
  const updated = financeStore.updateContractData("mutasi-ld", "ord:ORD-EDIT-SAFE-1", {
    "Nama Customer": "Edited Customer PT",
    "Nama": "Edited Owner Sesuai BPKB",
    "Plat No": "B 2020 NEW",
    "Samsat": "Jakarta Selatan",
  });

  assert.strictEqual(updated, true);

  // Verify in orderRepository
  const orderAfter = orderRepository.getByOrderNo("ORD-EDIT-SAFE-1");
  assert.strictEqual(orderAfter?.customer, "Edited Customer PT");
  assert.strictEqual(orderAfter?.namaPemilik, "Edited Owner Sesuai BPKB");
  assert.strictEqual(orderAfter?.nopol, "B 2020 NEW");
  assert.strictEqual(orderAfter?.wilayahSamsatAsal, "Jakarta Selatan");

  // Verify reflected in getContractData
  const projectedRow = financeStore.getContractData("mutasi-ld").find((r) => r.orderNo === "ORD-EDIT-SAFE-1");
  assert.strictEqual(projectedRow?.["Nama Customer"], "Edited Customer PT");
  assert.strictEqual(projectedRow?.["Nama"], "Edited Owner Sesuai BPKB");
  assert.strictEqual(projectedRow?.["Plat No"], "B 2020 NEW");
});

test("Phase 9.2 — 25. Action Integrity: 'Edit' protects derived statuses and computed amounts from generic cell overwrites", () => {
  financeStore.setApiMode(false);
  const mockProvider = new MockOrderProvider();
  orderRepository.setProvider(mockProvider);

  const order = createMockOrder({
    orderNo: "ORD-EDIT-DERIVED-1",
    currentStep: 2,
    currentStageName: "Berkas Masuk",
    layanan: "Perpanjangan 1 Tahun",
  });
  orderRepository.saveOrder(order);

  // Attempt to illegally override Status Pengerjaan, Status Pembayaran, and No Invoice via table edit
  const updated = financeStore.updateContractData("perpanjangan-pajak", "ord:ORD-EDIT-DERIVED-1", {
    "Status Pengerjaan": "Selesai",
    "Status Pembayaran": "Lunas",
    "No Invoice": "INV-FORGED-999",
    "Profit": 999999999,
  });

  assert.strictEqual(updated, true);

  // Canonical order step MUST NOT have been jumped to Stage 8 or archived!
  const orderAfter = orderRepository.getByOrderNo("ORD-EDIT-DERIVED-1");
  assert.strictEqual(orderAfter?.currentStep, 2, "Current step must not be arbitrarily jumped via table edit");

  // In projection, Status Pengerjaan reflects salesSnapshotStatus override while order step is preserved
  const projectedRow = financeStore.getContractData("perpanjangan-pajak").find((r) => r.orderNo === "ORD-EDIT-DERIVED-1");
  assert.strictEqual(projectedRow?.["Status Pengerjaan"], "Selesai");
});

test("Phase 9.2 — 26. Action Integrity: FieldConfig correctly defines readOnly and helpText for canonical derived fields", () => {
  const fields = buildFieldsFromContract(MUTASI_LD_COLUMNS_CONTRACT);

  const readOnlyKeys = [
    "Status Pengerjaan",
    "Status Pembayaran",
    "No Invoice",
    "Profit",
  ];

  readOnlyKeys.forEach((key) => {
    const field = fields.find((f) => f.key === key);
    assert.ok(field, `Field ${key} must exist in FieldConfig`);
    assert.strictEqual(field?.readOnly, true, `Field ${key} must have readOnly: true`);
    assert.ok(field?.helpText, `Field ${key} must provide descriptive helpText`);
  });

  // Verify single Status in contract that contains it
  const singleStatusField = buildFieldsFromContract(["Status" as const])[0];
  assert.strictEqual(singleStatusField.readOnly, true);
  assert.ok(singleStatusField.helpText);

  const editableKeys = ["Nama Customer", "Nama Pemilik (STNK/BPKB)", "Plat No", "Jenis Pengurusan", "R4 / R2", "Skema Pembayaran"];
  editableKeys.forEach((key) => {
    const field = fields.find((f) => f.key === key);
    assert.ok(field, `Field ${key} must exist`);
    assert.strictEqual(field?.readOnly, undefined, `Field ${key} must be editable`);
  });
});

test("Phase 9.4 — 27. Category-aware Samsat fallback semantics (Finding 2)", () => {
  // 1. Non-mutasi order (BBN) with placeholder '-' in wilayahSamsatTujuan
  const bbnOrder = createMockOrder({
    orderNo: "ORD-SAMSAT-BBN",
    layanan: "Balik Nama (BBN)",
    wilayahSamsatAsal: "Jakarta Timur",
    wilayahSamsatTujuan: "-",
  });
  const bbnRow = projectOrderToContractRow(bbnOrder);
  assert.strictEqual(
    bbnRow["Samsat"],
    "Jakarta Timur",
    "Non-mutasi order MUST ignore destination Samsat placeholder '-' and resolve to wilayahSamsatAsal"
  );

  // 2. Non-mutasi order (Perpanjangan Pajak) with whitespace in wilayahSamsatTujuan
  const pajakOrder = createMockOrder({
    orderNo: "ORD-SAMSAT-PAJAK",
    layanan: "Perpanjangan STNK Tahunan",
    wilayahSamsatAsal: "Depok",
    wilayahSamsatTujuan: "   ",
  });
  const pajakRow = projectOrderToContractRow(pajakOrder);
  assert.strictEqual(
    pajakRow["Samsat"],
    "Depok",
    "Non-mutasi order with whitespace destination MUST resolve to wilayahSamsatAsal"
  );

  // 3. Mutasi order (Mutasi LD) with valid destination Samsat
  const mutasiOrder = createMockOrder({
    orderNo: "ORD-SAMSAT-MUTASI",
    layanan: "Mutasi Luar Daerah",
    wilayahSamsatAsal: "Jakarta Barat",
    wilayahSamsatTujuan: "Bandung",
  });
  const mutasiRow = projectOrderToContractRow(mutasiOrder);
  assert.strictEqual(
    mutasiRow["Samsat"],
    "Bandung",
    "Mutasi order with valid destination Samsat MUST prioritize wilayahSamsatTujuan"
  );

  // 4. Mutasi order with placeholder destination '-' falls back to asal
  const mutasiEmptyTujuan = createMockOrder({
    orderNo: "ORD-SAMSAT-MUTASI-EMPTY",
    layanan: "Mutasi Antar Samsat",
    wilayahSamsatAsal: "Bekasi",
    wilayahSamsatTujuan: "-",
  });
  const mutasiEmptyRow = projectOrderToContractRow(mutasiEmptyTujuan);
  assert.strictEqual(
    mutasiEmptyRow["Samsat"],
    "Bekasi",
    "Mutasi order with placeholder destination '-' MUST fall back to wilayahSamsatAsal"
  );

  // 5. Order with placeholder asal '-' falls back to invoice samsat
  const fallbackToInvoice = createMockOrder({
    orderNo: "ORD-SAMSAT-INV",
    layanan: "Lain-Lain",
    wilayahSamsatAsal: "-",
    wilayahSamsatTujuan: "-",
  });
  const invWithSamsat: any = { samsat: "Samsat BSD", totalTagihan: 500000, terbayar: 0 };
  const invRow = projectOrderToContractRow(fallbackToInvoice, invWithSamsat);
  assert.strictEqual(
    invRow["Samsat"],
    "Samsat BSD",
    "Order with placeholder Samsat MUST fall back to linked invoice Samsat"
  );
});

test("Phase 9.4 — 28. Invoice date accuracy strictly prioritizes issuance date, not payment date (Finding 3)", () => {
  const order = createMockOrder({
    orderNo: "ORD-DATE-ACCURACY",
    createdAt: "2026-10-10",
    payment: {
      tipePembayaran: "Bayar di Akhir",
      metodePembayaran: "Transfer",
      statusPembayaran: "Lunas",
      totalBiaya: 1000000,
      dibayar: 1000000,
      kurang: 0,
      tanggalBayar: "2026-10-25", // Paid 15 days later
    },
  });

  // Case A: Invoice has explicit tanggalInvoice
  const invoiceA: any = {
    tanggalInvoice: "2026-10-12",
    tanggal: "2026-10-15",
    totalTagihan: 1000000,
    terbayar: 1000000,
  };
  const rowA = projectOrderToContractRow(order, invoiceA);
  assert.strictEqual(
    rowA["Tanggal Invoice"],
    "12/10/2026",
    "Tanggal Invoice must strictly prioritize invoice.tanggalInvoice"
  );
  assert.strictEqual(
    rowA["Tanggal Uang Masuk"],
    "25/10/2026",
    "Tanggal Uang Masuk must reflect actual payment date"
  );

  // Case B: Invoice has tanggal (creation/issuance date) but no tanggalInvoice
  const invoiceB: any = {
    tanggal: "2026-10-14",
    totalTagihan: 1000000,
    terbayar: 1000000,
  };
  const rowB = projectOrderToContractRow(order, invoiceB);
  assert.strictEqual(
    rowB["Tanggal Invoice"],
    "14/10/2026",
    "Tanggal Invoice must fall back to invoice.tanggal and NEVER use payment date"
  );

  // Case C: Uninvoiced order falls back to order.createdAt
  const rowC = projectOrderToContractRow(order);
  assert.strictEqual(
    rowC["Tanggal Invoice"],
    "10/10/2026",
    "Tanggal Invoice for uninvoiced order must fall back to order.createdAt, NEVER payment date"
  );
});

test("Phase 9.4 — 29. Canonical order identity reconciliation on API mode creation (Finding 1)", async () => {
  const apiProvider = new ApiOrderProvider("http://localhost:3001/api");

  // Save and mock global fetch
  const originalFetch = globalThis.fetch;
  try {
    const tempOrder = createMockOrder({
      orderNo: "ORD-CLIENT-TEMP-001",
      customer: "API Reconcile Customer",
      layanan: "Mutasi Luar Daerah",
      currentStageName: "Verifikasi",
      payment: {
        tipePembayaran: "Bayar di Akhir",
        metodePembayaran: "Transfer",
        statusPembayaran: "Belum Lunas",
        totalBiaya: 750000,
        dibayar: 0,
        kurang: 750000,
      },
    });

    // Also register invoice in financeStore under temporary ID
    financeStore.addInvoice({
      orderNo: "ORD-CLIENT-TEMP-001",
      customer: "API Reconcile Customer",
      totalTagihan: 750000,
      terbayar: 0,
    });

    // Mock backend returning authoritative canonical orderNo "ORD-0777"
    globalThis.fetch = async (url: any, options: any) => {
      if (url.toString().includes("/orders") && options?.method === "POST") {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            message: "Order berhasil dibuat.",
            data: {
              ...tempOrder,
              orderNo: "ORD-0777",
              payment: {
                ...tempOrder.payment,
                invoiceNo: "INV-ORD-0777",
              },
            },
          }),
        } as any;
      }
      return originalFetch(url, options);
    };

    const confirmedOrder = await apiProvider.addOrderAsync(tempOrder);
    assert.strictEqual(confirmedOrder.orderNo, "ORD-0777", "Returned order must have canonical orderNo");

    // Verify in activeOrders: temporary ID is replaced by canonical ID
    const active = apiProvider.getActiveOrders();
    const tempInActive = active["Verifikasi"].find((o) => o.orderNo === "ORD-CLIENT-TEMP-001");
    const canonicalInActive = active["Verifikasi"].find((o) => o.orderNo === "ORD-0777");
    assert.strictEqual(tempInActive, undefined, "Temporary order ID must not remain in activeOrders");
    assert.ok(canonicalInActive, "Canonical order must exist in activeOrders");

    // Verify in financeStore: invoice was reconciled to canonical orderNo
    const reconciledInvoice = financeStore.getInvoices().find((i) => i.orderNo === "ORD-0777");
    assert.ok(reconciledInvoice, "Linked invoice in financeStore must be reconciled to canonical orderNo");
    assert.strictEqual(reconciledInvoice.invoice, "INV-ORD-0777");

    // Clean up
    financeStore.removeInvoiceByOrderNo("ORD-0777");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Phase 9.4 — 30. Anti-ghost row cleanup on API creation failure (Finding 1)", async () => {
  const apiProvider = new ApiOrderProvider("http://localhost:3001/api");

  const originalFetch = globalThis.fetch;
  try {
    const failingOrder = createMockOrder({
      orderNo: "ORD-FAIL-GHOST-001",
      customer: "Failing Customer",
      layanan: "Balik Nama (BBN)",
      currentStageName: "Verifikasi",
    });

    // Add invoice in financeStore under temp orderNo
    financeStore.addInvoice({
      orderNo: "ORD-FAIL-GHOST-001",
      customer: "Failing Customer",
      totalTagihan: 500000,
      terbayar: 0,
    });

    // Mock backend returning 400 validation error
    globalThis.fetch = async (url: any, options: any) => {
      if (url.toString().includes("/orders") && options?.method === "POST") {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            success: false,
            message: "Data wajib belum lengkap (customer, nomorHP, layanan, nopol).",
          }),
        } as any;
      }
      return originalFetch(url, options);
    };

    // Attempt creation, expect error
    await assert.rejects(
      async () => {
        await apiProvider.addOrderAsync(failingOrder);
      },
      /Order creation failed on backend/
    );

    // Verify anti-ghost row: failing order MUST be rolled back from activeOrders
    const active = apiProvider.getActiveOrders();
    const ghostInActive = active["Verifikasi"].find((o) => o.orderNo === "ORD-FAIL-GHOST-001");
    assert.strictEqual(ghostInActive, undefined, "Failed order MUST NOT leave ghost row in activeOrders");

    // Verify anti-ghost row: optimistic invoice MUST be removed from financeStore
    const ghostInvoice = financeStore.getInvoices().find((i) => i.orderNo === "ORD-FAIL-GHOST-001");
    assert.strictEqual(ghostInvoice, undefined, "Failed order MUST NOT leave ghost invoice in financeStore");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

