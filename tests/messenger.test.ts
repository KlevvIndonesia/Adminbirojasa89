import test from "node:test";
import assert from "node:assert";
import { karyawanPenggunaAdapter } from "../src/app/data/karyawanPenggunaAdapter";
import { KNOWN_MESSENGERS } from "../src/app/data/messengerTaskAdapter";
import { orderStore } from "../src/app/data/orderStore";

test("Messenger - karyawanPenggunaAdapter returns active messengers", () => {
  const allKaryawan = karyawanPenggunaAdapter.getKaryawan();
  assert.ok(allKaryawan.length > 0, "Karyawan list should not be empty");

  const activeMessengers = allKaryawan
    .filter((k) => k.jabatan === "MESSENGER" && k.status === "Aktif")
    .map((k) => k.nama);

  assert.ok(activeMessengers.length > 0, "Should have active messengers");
  assert.ok(activeMessengers.includes("Budi Santoso"), "Budi Santoso should be an active messenger");
  assert.ok(activeMessengers.includes("Andi Pratama"), "Andi Pratama should be an active messenger");
});

test("Messenger - KNOWN_MESSENGERS fallback contains predefined messengers", () => {
  assert.ok(Array.isArray(KNOWN_MESSENGERS));
  assert.ok(KNOWN_MESSENGERS.length >= 5);
  assert.ok(KNOWN_MESSENGERS.includes("Ahmad Rizki"));
  assert.ok(KNOWN_MESSENGERS.includes("Citra Dewi"));
});

test("Messenger - Assigning messenger updates order without corrupting order state", () => {
  const newOrder = orderStore.addOrder({
    customer: "Messenger Assignment Test",
    namaPemilik: "Messenger Assignment Test",
    nomorHP: "0812333333",
    nopol: "B 3333 MSG",
    layanan: "Perpanjangan 1 Tahun",
    totalEstimasi: 400000,
    payment: {
      tipePembayaran: "Bayar di Akhir",
      metodePembayaran: "Cash",
      statusPembayaran: "Belum Bayar",
      totalBiaya: 400000,
      dibayar: 0,
      kurang: 400000,
    },
  });

  const orderNo = newOrder.orderNo;

  // Assign Stage 2 Messenger (Jemput & Proses)
  const assignStage2 = orderStore.updateOrder(orderNo, {
    messenger: "Citra Dewi",
  });
  assert.strictEqual(assignStage2, true);

  let current = orderStore.getOrderByNo(orderNo);
  assert.strictEqual(current?.messenger, "Citra Dewi");
  assert.strictEqual(current?.customer, "Messenger Assignment Test");
  assert.strictEqual(current?.nopol, "B 3333 MSG");

  // Assign Stage 7 Messenger (Pengantar)
  const assignStage7 = orderStore.updateOrder(orderNo, {
    messengerPengantar: "Dedi Cahyadi",
  });
  assert.strictEqual(assignStage7, true);

  current = orderStore.getOrderByNo(orderNo);
  assert.strictEqual(current?.messenger, "Citra Dewi");
  assert.strictEqual(current?.messengerPengantar, "Dedi Cahyadi");
  assert.strictEqual(current?.nopol, "B 3333 MSG");
});
