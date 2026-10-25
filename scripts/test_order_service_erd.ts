import { orderService } from "../server/src/services/orderService";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbFinanceRepository } from "../server/src/repositories/dbFinanceRepository";
import { db } from "../server/src/database/db";

async function run() {
  console.log("=== TESTING ORDER CREATION WITH SERVICE RESOLUTION ===");

  const testPayload: any = {
    customer: "PT Test Mitra Sejahtera",
    nomorHP: "081299998888",
    layanan: "Mutasi Luar Daerah", // alias for Mutasi Antar Daerah -> svc-mut-antar
    nopol: "B 9999 ERD",
    wilayahSamsatAsal: "Jakarta Selatan",
    wilayahSamsatTujuan: "Bandung Kota",
    tanggalMasukBerkas: "2026-10-23",
    payment: {
      totalBiaya: 2500000,
      dibayar: 500000,
      tipePembayaran: "DP",
      metodePembayaran: "Transfer Bank",
    },
    biayaJasa: 500000,
  };

  const { order } = orderService.createOrderWithIdempotency(testPayload, {
    userId: "usr-admin-01",
    nama: "Test Admin",
    role: "administrator"
  });

  console.log("Created orderNo:", order.orderNo);
  console.log("Order service_id:", (order as any).service_id);
  console.log("Order layanan:", order.layanan);
  console.log("Order tanggal_masuk_berkas:", (order as any).tanggal_masuk_berkas);
  console.log("Order samsat_asal:", (order as any).samsat_asal);
  console.log("Order samsat_tujuan:", (order as any).samsat_tujuan);

  if ((order as any).service_id !== "svc-mut-antar") {
    throw new Error(`Expected svc-mut-antar, got ${(order as any).service_id}`);
  }
  if (order.layanan !== "Mutasi Antar Daerah") {
    throw new Error(`Expected 'Mutasi Antar Daerah', got ${order.layanan}`);
  }

  // Check physical database rows
  const orderRow = db.prepare("SELECT order_no, service_id, tanggal_masuk_berkas, samsat_asal, samsat_tujuan, layanan FROM orders WHERE order_no = ?").get(order.orderNo) as any;
  console.log("Physical Order Row:", orderRow);

  const invRow = db.prepare("SELECT invoice_no, order_no, service_id, layanan FROM finance_invoices WHERE order_no = ?").get(order.orderNo) as any;
  console.log("Physical Invoice Row:", invRow);

  if (!invRow || invRow.service_id !== "svc-mut-antar") {
    throw new Error(`Expected invoice service_id = svc-mut-antar, got ${invRow?.service_id}`);
  }

  // Test updating service
  console.log("\n=== TESTING ORDER UPDATE WITH SERVICE RESOLUTION ===");
  const updatedOrder = orderService.updateOrder(order.orderNo, {
    layanan: "Perpanjangan STNK", // alias for Perpanjangan 1 Tahun -> svc-perp-1th
  }, {
    userId: "usr-admin-01",
    nama: "Test Admin",
    role: "administrator"
  });

  console.log("Updated order layanan:", updatedOrder.layanan);
  console.log("Updated order service_id:", (updatedOrder as any).service_id);

  const updatedInvRow = db.prepare("SELECT invoice_no, service_id, layanan FROM finance_invoices WHERE order_no = ?").get(order.orderNo) as any;
  console.log("Updated Physical Invoice Row:", updatedInvRow);

  if (updatedInvRow.service_id !== "svc-perp-1th") {
    throw new Error(`Expected updated invoice service_id = svc-perp-1th, got ${updatedInvRow.service_id}`);
  }

  // Cleanup test order
  console.log("\n=== CLEANING UP TEST DATA ===");
  db.prepare("DELETE FROM finance_invoices WHERE order_no = ?").run(order.orderNo);
  db.prepare("DELETE FROM orders WHERE order_no = ?").run(order.orderNo);
  db.prepare("DELETE FROM audit_logs WHERE details LIKE ?").run(`%${order.orderNo}%`);

  const remainingOrders = db.prepare("SELECT COUNT(*) as count FROM orders").get() as any;
  const remainingInvoices = db.prepare("SELECT COUNT(*) as count FROM finance_invoices").get() as any;
  console.log(`Remaining orders: ${remainingOrders.count}, Remaining invoices: ${remainingInvoices.count}`);

  console.log("\n>>> END-TO-END SERVICE RESOLUTION & RELATIONAL LINKAGE VERIFIED! <<<");
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
