import test from "node:test";
import assert from "node:assert";
import { orderRepository, OrderRepository } from "../src/data/repositories/orderRepository";
import { MockOrderProvider } from "./fixtures/mock/mockOrderProvider";
import { OperationalOrder } from "../src/domain/order/types";

test("OrderRepository - Read operations return valid fixture collections", () => {
  const provider = new MockOrderProvider();
  const repo = new OrderRepository(provider);

  const activeOrders = repo.getActiveOrders();
  assert.ok(activeOrders, "Active orders should exist");
  assert.ok(activeOrders["Verifikasi"], "Stage Verifikasi should exist");
  assert.ok(Array.isArray(activeOrders["Verifikasi"]), "Stage Verifikasi should be an array");

  const testOrder: OperationalOrder = {
    orderNo: "ORD-REPO-READ-001",
    customer: "Test Read Customer",
    nomorHP: "081234567890",
    layanan: "Perpanjangan 1 Tahun",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: new Date().toISOString(),
    namaPemilik: "Test Read Owner",
    kepemilikanKendaraan: "Milik Sendiri",
    nopol: "B 1234 RPO",
    wilayahSamsatAsal: "Jakarta Timur",
  };
  repo.saveOrder(testOrder);

  const allOrders = repo.getAllFlat();
  assert.ok(Array.isArray(allOrders), "getAllFlat should return an array");
  assert.ok(allOrders.length > 0, "Repository should have orders after saving");

  const firstOrder = allOrders[0];
  const foundByNo = repo.getByOrderNo(firstOrder.orderNo);
  assert.strictEqual(foundByNo?.orderNo, firstOrder.orderNo, "getByOrderNo should find the order");

  const byStage = repo.getByStage("Verifikasi");
  assert.ok(Array.isArray(byStage), "getByStage should return an array");
  assert.strictEqual(byStage.length, 1, "getByStage should return saved order");
});

test("OrderRepository - Mutation operations: saveOrder and updateOrder", () => {
  const provider = new MockOrderProvider();
  const repo = new OrderRepository(provider);

  const testOrderNo = `TEST-ORD-${Date.now()}`;
  const dummyOrder: OperationalOrder = {
    orderNo: testOrderNo,
    customer: "Budi Test",
    nomorHP: "081234567890",
    layanan: "Perpanjangan 1 Tahun",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: new Date().toISOString(),
    namaPemilik: "Budi Test",
    kepemilikanKendaraan: "Milik Sendiri",
    nopol: "B 1234 TST",
    wilayahSamsatAsal: "Jakarta Timur",
    wilayahSamsatTujuan: "-",
    nominalPkbTerakhir: 350000,
    nominalSwdkllj: 143000,
    biayaJasa: 50000,
    pkb: 350000,
    swdkllj: 143000,
    dendaSwdkllj: 0,
    totalEstimasi: 543000,
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Cash",
      statusPembayaran: "Lunas",
      totalBiaya: 543000,
      dibayar: 543000,
      kurang: 0,
      isPaymentVerified: true,
    },
    orderSource: "Offline / Loket",
    createdBy: "Admin Loket",
    clientDocuments: {
      stnk: { name: "STNK.pdf", status: "Sudah Tersedia" },
    },
    samsatProcesses: [],
  };

  // 1. saveOrder
  repo.saveOrder(dummyOrder);
  const fetched = repo.getByOrderNo(testOrderNo);
  assert.ok(fetched, "Order should be saved in repository");
  assert.strictEqual(fetched?.customer, "Budi Test");

  // 2. updateOrder
  const updateSuccess = repo.updateOrder(testOrderNo, { customer: "Budi Updated" });
  assert.strictEqual(updateSuccess, true, "updateOrder should succeed");

  const updated = repo.getByOrderNo(testOrderNo);
  assert.strictEqual(updated?.customer, "Budi Updated", "Customer name should be updated");

  // 3. update non-existent order
  const failUpdate = repo.updateOrder("NON-EXISTENT-9999", { customer: "Nobody" });
  assert.strictEqual(failUpdate, false, "updateOrder on non-existent order should return false");
});

test("OrderRepository - advanceOrder moves order between stages", () => {
  const provider = new MockOrderProvider();
  const repo = new OrderRepository(provider);

  const testOrderNo = `ADV-${Date.now()}`;
  const dummyOrder: OperationalOrder = {
    orderNo: testOrderNo,
    customer: "Andi Workflow",
    nomorHP: "0811111111",
    layanan: "Perpanjangan 1 Tahun",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: new Date().toISOString(),
    namaPemilik: "Andi",
    kepemilikanKendaraan: "Milik Sendiri",
    nopol: "B 5678 ADV",
    wilayahSamsatAsal: "Jakarta Timur",
    wilayahSamsatTujuan: "-",
    nominalPkbTerakhir: 200000,
    nominalSwdkllj: 143000,
    biayaJasa: 50000,
    pkb: 200000,
    swdkllj: 143000,
    dendaSwdkllj: 0,
    totalEstimasi: 393000,
    payment: {
      tipePembayaran: "Bayar di Akhir",
      metodePembayaran: "Cash",
      statusPembayaran: "Belum Bayar",
      totalBiaya: 393000,
      dibayar: 0,
      kurang: 393000,
    },
    orderSource: "Offline / Loket",
    createdBy: "Admin Loket",
    clientDocuments: {},
    samsatProcesses: [],
  };

  repo.saveOrder(dummyOrder);

  // Advance from Verifikasi (1) to Penjadwalan (2)
  const advanceSuccess = repo.advanceOrder(testOrderNo, "Penjadwalan", {
    currentStep: 2,
    tanggalPenjadwalan: "2026-10-10",
  });
  assert.strictEqual(advanceSuccess, true, "advanceOrder should succeed");

  const orderAfterAdvance = repo.getByOrderNo(testOrderNo);
  assert.strictEqual(orderAfterAdvance?.currentStageName, "Penjadwalan");
  assert.strictEqual(orderAfterAdvance?.currentStep, 2);
  assert.strictEqual(orderAfterAdvance?.tanggalPenjadwalan, "2026-10-10");

  // Verify it is no longer in Verifikasi
  const verifikasiList = repo.getByStage("Verifikasi");
  const inVerifikasi = verifikasiList.some((o) => o.orderNo === testOrderNo);
  assert.strictEqual(inVerifikasi, false, "Order should no longer be in Verifikasi");

  // Verify it is in Penjadwalan
  const penjadwalanList = repo.getByStage("Penjadwalan");
  const inPenjadwalan = penjadwalanList.some((o) => o.orderNo === testOrderNo);
  assert.strictEqual(inPenjadwalan, true, "Order should now be in Penjadwalan");
});

test("OrderRepository - archiveOrder moves order to archived collection", () => {
  const provider = new MockOrderProvider();
  const repo = new OrderRepository(provider);

  const testOrderNo = `ARC-${Date.now()}`;
  const dummyOrder: OperationalOrder = {
    orderNo: testOrderNo,
    customer: "Citra Selesai",
    nomorHP: "0822222222",
    layanan: "Perpanjangan 1 Tahun",
    currentStep: 8,
    currentStageName: "Dokumen Telah Diterima",
    createdAt: new Date().toISOString(),
    namaPemilik: "Citra",
    kepemilikanKendaraan: "Milik Sendiri",
    nopol: "B 9999 ARC",
    wilayahSamsatAsal: "Jakarta Timur",
    wilayahSamsatTujuan: "-",
    nominalPkbTerakhir: 200000,
    nominalSwdkllj: 143000,
    biayaJasa: 50000,
    pkb: 200000,
    swdkllj: 143000,
    dendaSwdkllj: 0,
    totalEstimasi: 393000,
    payment: {
      tipePembayaran: "Bayar di Akhir",
      metodePembayaran: "Cash",
      statusPembayaran: "Lunas",
      totalBiaya: 393000,
      dibayar: 393000,
      kurang: 0,
    },
    orderSource: "Offline / Loket",
    createdBy: "Admin Loket",
    clientDocuments: {},
    samsatProcesses: [],
  };

  repo.saveOrder(dummyOrder);
  assert.strictEqual(repo.getArchivedOrders().length, 0);

  const archiveSuccess = repo.archiveOrder(testOrderNo);
  assert.strictEqual(archiveSuccess, true, "archiveOrder should succeed");

  const archivedList = repo.getArchivedOrders();
  assert.strictEqual(archivedList.length, 1);
  assert.strictEqual(archivedList[0].orderNo, testOrderNo);

  // Active collection should not contain it
  const activeOrder = repo.getByStage("Dokumen Telah Diterima").find((o) => o.orderNo === testOrderNo);
  assert.strictEqual(activeOrder, undefined, "Archived order should not be in active stages");
});

test("OrderRepository - Subscription notifies listeners on state changes", () => {
  const provider = new MockOrderProvider();
  const repo = new OrderRepository(provider);

  let notifyCount = 0;
  const unsubscribe = repo.subscribe(() => {
    notifyCount++;
  });

  const testOrderNo = `NOTIFY-${Date.now()}`;
  repo.saveOrder({
    orderNo: testOrderNo,
    customer: "Test Listener",
    nomorHP: "0833333333",
    layanan: "Perpanjangan 1 Tahun",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: new Date().toISOString(),
    namaPemilik: "Test",
    kepemilikanKendaraan: "Milik Sendiri",
    nopol: "B 1111 NOT",
    wilayahSamsatAsal: "Jakarta Timur",
    wilayahSamsatTujuan: "-",
    nominalPkbTerakhir: 100000,
    nominalSwdkllj: 143000,
    biayaJasa: 50000,
    pkb: 100000,
    swdkllj: 143000,
    dendaSwdkllj: 0,
    totalEstimasi: 293000,
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Cash",
      statusPembayaran: "Lunas",
      totalBiaya: 293000,
      dibayar: 293000,
      kurang: 0,
    },
    orderSource: "Offline / Loket",
    createdBy: "Admin Loket",
    clientDocuments: {},
    samsatProcesses: [],
  });

  assert.strictEqual(notifyCount, 1, "Listener should be called once on saveOrder");

  repo.updateOrder(testOrderNo, { customer: "Updated Listener" });
  assert.strictEqual(notifyCount, 2, "Listener should be called again on updateOrder");

  unsubscribe();
  repo.updateOrder(testOrderNo, { customer: "After Unsubscribe" });
  assert.strictEqual(notifyCount, 2, "Listener should not be called after unsubscribe");
});
