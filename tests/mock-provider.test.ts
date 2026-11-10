import test from "node:test";
import assert from "node:assert";
import { MockOrderProvider } from "./fixtures/mock/mockOrderProvider";
import { OperationalOrder, STAGES } from "../src/domain/order/types";

// Workstream B: Explicit deterministic test fixture factory for MockOrderProvider
function seedTestOrders(provider: MockOrderProvider): void {
  const sampleOrders: OperationalOrder[] = [
    {
      orderNo: "ORD-0001",
      customer: "PT. Maju Jaya Abadi",
      nomorHP: "081234567890",
      layanan: "Perpanjangan STNK Tahunan",
      currentStep: 1,
      currentStageName: "Verifikasi",
      createdAt: new Date().toISOString(),
      namaPemilik: "Budi Santoso",
      kepemilikanKendaraan: "Pribadi",
      nopol: "B 1001 ABC",
      totalEstimasi: 500000,
      clientDocuments: {},
      samsatProcesses: [],
    },
    {
      orderNo: "ORD-0002",
      customer: "PT. Sentosa Abadi",
      nomorHP: "081234567891",
      layanan: "Mutasi Masuk",
      currentStep: 2,
      currentStageName: "Penjadwalan",
      createdAt: new Date().toISOString(),
      namaPemilik: "Siti Rahmawati",
      kepemilikanKendaraan: "Pribadi",
      nopol: "B 1002 ABC",
      totalEstimasi: 1200000,
      clientDocuments: {},
      samsatProcesses: [],
    },
    {
      orderNo: "ORD-0003",
      customer: "PT. Bintang Timur",
      nomorHP: "081234567892",
      layanan: "Balik Nama (BBN)",
      currentStep: 2,
      currentStageName: "Penjadwalan",
      createdAt: new Date().toISOString(),
      namaPemilik: "Ahmad",
      kepemilikanKendaraan: "Pribadi",
      nopol: "B 1003 ABC",
      totalEstimasi: 800000,
      clientDocuments: {},
      samsatProcesses: [],
    },
    {
      orderNo: "ORD-0004",
      customer: "CV. Makmur Jaya",
      nomorHP: "081234567893",
      layanan: "Perpanjangan 5 Tahunan",
      currentStep: 3,
      currentStageName: "Verifikasi Dokumen",
      createdAt: new Date().toISOString(),
      namaPemilik: "Dewi",
      kepemilikanKendaraan: "Pribadi",
      nopol: "B 1004 ABC",
      totalEstimasi: 950000,
      clientDocuments: {},
      samsatProcesses: [],
    },
    {
      orderNo: "ORD-0005",
      customer: "PT. Anugerah Motor",
      nomorHP: "081234567894",
      layanan: "Ganti Plat 5 Tahun",
      currentStep: 4,
      currentStageName: "Proses Samsat",
      createdAt: new Date().toISOString(),
      namaPemilik: "Joko",
      kepemilikanKendaraan: "Pribadi",
      nopol: "B 1005 ABC",
      totalEstimasi: 1100000,
      clientDocuments: {},
      samsatProcesses: [],
    },
    {
      orderNo: "ORD-0006",
      customer: "Walk-in Customer",
      nomorHP: "081234567895",
      layanan: "Cek Fisik Bantuan",
      currentStep: 5,
      currentStageName: "Verifikasi Ulang",
      createdAt: new Date().toISOString(),
      namaPemilik: "Rian",
      kepemilikanKendaraan: "Pribadi",
      nopol: "B 1006 ABC",
      totalEstimasi: 250000,
      clientDocuments: {},
      samsatProcesses: [],
    },
    {
      orderNo: "ORD-0007",
      customer: "PT. Mega Pratama",
      nomorHP: "081234567896",
      layanan: "Tarik Berkas",
      currentStep: 6,
      currentStageName: "Supervisi",
      createdAt: new Date().toISOString(),
      namaPemilik: "Agus",
      kepemilikanKendaraan: "Pribadi",
      nopol: "B 1007 ABC",
      totalEstimasi: 600000,
      clientDocuments: {},
      samsatProcesses: [],
    },
    {
      orderNo: "ORD-0008",
      customer: "PT. Cipta Karya",
      nomorHP: "081234567897",
      layanan: "STNK Hilang",
      currentStep: 7,
      currentStageName: "Pengantaran",
      createdAt: new Date().toISOString(),
      namaPemilik: "Doni",
      kepemilikanKendaraan: "Pribadi",
      nopol: "B 1008 ABC",
      totalEstimasi: 750000,
      clientDocuments: {},
      samsatProcesses: [],
    },
  ];

  for (const o of sampleOrders) {
    provider.addOrder(o);
  }
}

test("MockOrderProvider - Loads initial fixtures correctly across all stages", () => {
  const provider = new MockOrderProvider();
  seedTestOrders(provider);
  const activeOrders = provider.getActiveOrders();

  // All 8 stages should exist as keys
  for (const stage of STAGES) {
    assert.ok(Array.isArray(activeOrders[stage]), `Stage '${stage}' should be an array`);
  }

  const allOrders = provider.getAllFlat();
  assert.ok(allOrders.length >= 8, "Initial fixtures should contain orders across the stages");

  // Verify ORD-0001 to ORD-0008 exist in initial fixtures
  const order1 = provider.getOrderByNo("ORD-0001");
  assert.ok(order1, "ORD-0001 should exist in initial fixtures");
  assert.strictEqual(order1?.customer, "PT. Maju Jaya Abadi");

  const order5 = provider.getOrderByNo("ORD-0005");
  assert.ok(order5, "ORD-0005 should exist in initial fixtures");
  assert.strictEqual(order5?.currentStageName, "Proses Samsat");
});

test("MockOrderProvider - Preserves isolation: mutating one order does not alter others", () => {
  const provider = new MockOrderProvider();
  seedTestOrders(provider);
  const order1 = provider.getOrderByNo("ORD-0001");
  const order2 = provider.getOrderByNo("ORD-0002");

  assert.ok(order1 && order2, "Orders should exist");
  const initialCustomer2 = order2.customer;

  provider.updateOrder("ORD-0001", {
    customer: "Budi Changed Name",
    catatanOrder: "Special memo for ORD-0001",
  });

  const refreshedOrder1 = provider.getOrderByNo("ORD-0001");
  const refreshedOrder2 = provider.getOrderByNo("ORD-0002");

  assert.strictEqual(refreshedOrder1?.customer, "Budi Changed Name");
  assert.strictEqual(refreshedOrder1?.catatanOrder, "Special memo for ORD-0001");
  assert.strictEqual(refreshedOrder2?.customer, initialCustomer2, "ORD-0002 should remain untouched");
  assert.notStrictEqual(refreshedOrder2?.catatanOrder, "Special memo for ORD-0001");
});

test("MockOrderProvider - addOrder safely places order into target stage", () => {
  const provider = new MockOrderProvider();
  const newOrderNo = `NEW-${Date.now()}`;

  const newOrder: OperationalOrder = {
    orderNo: newOrderNo,
    customer: "Dewi Lestari",
    nomorHP: "0877777777",
    layanan: "Mutasi Antar Samsat",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: new Date().toISOString(),
    namaPemilik: "Dewi",
    kepemilikanKendaraan: "Milik Sendiri",
    nopol: "B 1234 DW",
    wilayahSamsatAsal: "Jakarta Timur",
    wilayahSamsatTujuan: "Jakarta Barat",
    nominalPkbTerakhir: 400000,
    nominalSwdkllj: 143000,
    biayaJasa: 75000,
    pkb: 400000,
    swdkllj: 143000,
    dendaSwdkllj: 0,
    totalEstimasi: 618000,
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Transfer BCA",
      statusPembayaran: "Lunas",
      totalBiaya: 618000,
      dibayar: 618000,
      kurang: 0,
    },
    orderSource: "Online / WhatsApp",
    createdBy: "Admin Loket",
    clientDocuments: {},
    samsatProcesses: [],
  };

  provider.addOrder(newOrder);

  const found = provider.getOrderByNo(newOrderNo);
  assert.ok(found, "Newly added order should be found");
  assert.strictEqual(found?.orderNo, newOrderNo);

  const verifikasiList = provider.getOrdersByStage("Verifikasi");
  assert.ok(verifikasiList.some((o) => o.orderNo === newOrderNo), "Should be in Verifikasi list");
});

test("MockOrderProvider - rollbackOrder moves order back to previous stage", () => {
  const provider = new MockOrderProvider();
  seedTestOrders(provider);
  const order4 = provider.getOrderByNo("ORD-0004");
  assert.ok(order4, "ORD-0004 should exist");
  assert.strictEqual(order4?.currentStageName, "Verifikasi Dokumen");

  // Rollback ORD-0004 from Stage 3 (Verifikasi Dokumen) to Stage 2 (Penjadwalan)
  const rollbackSuccess = provider.rollbackOrder("ORD-0004", "Penjadwalan", {
    currentStep: 2,
    catatanOrder: "Dokumen kurang lengkap, dijadwalkan ulang",
  });

  assert.strictEqual(rollbackSuccess, true, "Rollback should return true");
  const rolledBackOrder = provider.getOrderByNo("ORD-0004");
  assert.strictEqual(rolledBackOrder?.currentStageName, "Penjadwalan");
  assert.strictEqual(rolledBackOrder?.currentStep, 2);
  assert.strictEqual(rolledBackOrder?.catatanOrder, "Dokumen kurang lengkap, dijadwalkan ulang");

  // Verify absence from Stage 3
  const stage3List = provider.getOrdersByStage("Verifikasi Dokumen");
  assert.strictEqual(stage3List.some((o) => o.orderNo === "ORD-0004"), false);

  // Verify presence in Stage 2
  const stage2List = provider.getOrdersByStage("Penjadwalan");
  assert.strictEqual(stage2List.some((o) => o.orderNo === "ORD-0004"), true);
});

test("MockOrderProvider - Non-existent order mutations return false without throwing", () => {
  const provider = new MockOrderProvider();

  assert.strictEqual(provider.updateOrder("GHOST-ORDER", { customer: "Ghost" }), false);
  assert.strictEqual(provider.advanceOrder("GHOST-ORDER", "Proses Samsat", {}), false);
  assert.strictEqual(provider.rollbackOrder("GHOST-ORDER", "Verifikasi", {}), false);
  assert.strictEqual(provider.archiveOrder("GHOST-ORDER"), false);
  assert.strictEqual(provider.getOrderByNo("GHOST-ORDER"), undefined);
});
