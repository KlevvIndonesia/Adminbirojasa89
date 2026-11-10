/**
 * Mock Finance Seed Fixtures
 * Admin SUN89 — Biro Jasa Management System
 */

import {
  profitData as rawProfitData,
  kasMessengerData as rawKasMessengerData,
  kasKantorData as rawKasKantorData,
  pengeluaranKantorData as rawPengeluaranData,
  tagihanData as rawTagihanData,
  belumKurangBayarData as rawBelumKurangBayarData,
  profitTerpendingData as rawProfitTerpendingData,
  cashbackTerpendingData as rawCashbackTerpendingData,
  labaRugiData as rawLabaRugiData,
  LabaRugiMonthlyItem,
  ProfitItem,
  KasMessengerItem,
  KasKantorItem,
  PengeluaranItem,
} from "./financeDummyData";

import { InvoiceBillingRecord, derivePaymentStatus } from "../../../src/domain/finance/types";

export type { ProfitItem, KasMessengerItem, KasKantorItem, PengeluaranItem, LabaRugiMonthlyItem };

const SAMPLE_CUSTOMER_PHONES: Record<string, { phone: string; email?: string; alamat?: string }> = {
  "PT. MAJU JAYA": { phone: "081289123456", email: "finance@majujaya.co.id", alamat: "Jl. Sudirman Kav 21, Jakarta" },
  "TOKO SEJAHTERA": { phone: "081987654321", email: "sejahtera.toko@gmail.com", alamat: "Jl. Pasar Anyar No. 14, Bogor" },
  "CV. MANDIRI": { phone: "082155667788", email: "admin@mandiri-cv.com", alamat: "Jl. Ir. H. Juanda No. 88, Depok" },
  "WARUNG MAKAN": { phone: "085699887766", email: "warung.berkah@gmail.com", alamat: "Jl. Raya Bogor KM 35, Cibinong" },
  "SALON CANTIK": { phone: "087711223344", email: "cantiksalon@yahoo.com", alamat: "Ruko Sukahati No. 5, Bogor" },
  "BENGKEL MOTOR": { phone: "081344556677", email: "bengkel.motor@gmail.com", alamat: "Jl. Tegar Beriman No. 12, Cibinong" },
  "TOKO BANGUNAN": { phone: "081288990011", email: "tb.sentosa@gmail.com", alamat: "Jl. Raya Sukabumi No. 45, Bogor" },
  "FOTOCOPY 24 JAM": { phone: "085733445566", email: "fc24jam@gmail.com", alamat: "Jl. Dramaga No. 18, Bogor" },
  "LAUNDRY KILOAN": { phone: "081822334455", email: "cleanlaundry@gmail.com", alamat: "Perum Gaperi 2 Blok B, Bojonggede" },
  "RUMAH MAKAN PADANG": { phone: "082211998877", email: "rmpadang@gmail.com", alamat: "Jl. Raya Pajajaran No. 7, Bogor" },
  "APOTEK SEHAT": { phone: "081199887766", email: "apotek.sehat@gmail.com", alamat: "Jl. Padjadjaran No. 102, Bogor" },
  "COUNTER HP": { phone: "089677889900", email: "countercell@gmail.com", alamat: "ITC Cibinong Lt. 1 Blok C" },
};

export function buildInitialInvoices(): InvoiceBillingRecord[] {
  const invoiceList: InvoiceBillingRecord[] = [];
  let currentId = 1;

  rawTagihanData.forEach((tagihan) => {
    const total = tagihan.totalTagihan || 0;
    const paid = tagihan.terbayar || 0;
    const status = derivePaymentStatus(total, paid);
    const isLunas = status === "Lunas";
    const contact = SAMPLE_CUSTOMER_PHONES[tagihan.customer] || {
      phone: undefined,
      email: `${tagihan.customer.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
      alamat: "Kabupaten Bogor, Jawa Barat",
    };

    const profit = Math.round(total * 0.25);
    const biayaSamsat = total - profit;

    invoiceList.push({
      id: currentId++,
      tanggal: tagihan.tanggal,
      customer: tagihan.customer,
      nopol: tagihan.nopol,
      jenisLayanan: tagihan.jenisLayanan,
      totalTagihan: total,
      terbayar: paid,
      sisa: Math.max(0, total - paid),
      status,
      jatuhTempo: tagihan.jatuhTempo,
      invoice: `INV-24-${String(tagihan.id).padStart(4, "0")}`,
      invoiceNo: `INV-24-${String(tagihan.id).padStart(4, "0")}`,
      phone: contact.phone,
      email: contact.email,
      alamat: contact.alamat,
      biayaSamsat,
      profit,
      profitStatus: isLunas ? "REALIZED" : "PENDING",
      cashback: isLunas ? Math.round(profit * 0.1) : 0,
      cashbackStatus: isLunas ? "REALIZED" : "PENDING",
      isCashRealized: isLunas,
      cashRecordedAmount: paid,
      metodePembayaran: paid > 0 ? "Transfer Bank" : "Tempo",
      bank: paid > 0 ? "BCA" : "Kas Kantor",
      billingStatus: "ACTIVE",
    });
  });

  rawBelumKurangBayarData.forEach((bkb) => {
    const existing = invoiceList.find((inv) => inv.nopol === bkb.nopol || inv.invoice === bkb.invoice);
    if (!existing) {
      const total = (bkb.uangMasuk || 0) + (bkb.kekurangan || 0);
      const paid = bkb.uangMasuk || 0;
      const status = derivePaymentStatus(total, paid);
      const contact = SAMPLE_CUSTOMER_PHONES[bkb.customer] || {
        phone: undefined,
        email: "finance@customer.co.id",
        alamat: "Jawa Barat",
      };

      invoiceList.push({
        id: currentId++,
        tanggal: bkb.tanggal,
        customer: bkb.customer,
        nopol: bkb.nopol,
        namaBerkas: bkb.namaBerkas,
        jenisLayanan: bkb.pengurusan,
        totalTagihan: total,
        terbayar: paid,
        sisa: Math.max(0, total - paid),
        status,
        jatuhTempo: "20 November 2024",
        invoice: bkb.invoice || `INV-BKB-${String(bkb.id).padStart(3, "0")}`,
        invoiceNo: bkb.invoice || `INV-BKB-${String(bkb.id).padStart(3, "0")}`,
        phone: contact.phone,
        email: contact.email,
        alamat: contact.alamat,
        biayaSamsat: bkb.biayaSamsat,
        profit: bkb.profit,
        profitStatus: "PENDING",
        cashback: 0,
        cashbackStatus: "PENDING",
        isCashRealized: paid > 0,
        cashRecordedAmount: paid,
        metodePembayaran: paid > 0 ? "Transfer Bank" : "Tempo",
        bank: "Kas Kantor",
        billingStatus: "ACTIVE",
      });
    }
  });

  rawProfitTerpendingData.forEach((pt) => {
    const existing = invoiceList.find((inv) => inv.nopol === pt.nopol || inv.invoice === pt.invoice);
    if (!existing) {
      const total = pt.uangMasuk || 0;
      invoiceList.push({
        id: currentId++,
        tanggal: pt.tanggal,
        customer: pt.customer,
        nopol: pt.nopol,
        namaBerkas: pt.namaBerkas,
        jenisLayanan: pt.pengurusan,
        totalTagihan: total,
        terbayar: total,
        sisa: 0,
        status: "Lunas",
        jatuhTempo: pt.tanggal,
        invoice: pt.invoice,
        invoiceNo: pt.invoice,
        phone: "081288776655",
        biayaSamsat: pt.biayaSamsat,
        profit: pt.profit,
        profitStatus: "PENDING",
        cashback: 0,
        cashbackStatus: "PENDING",
        isCashRealized: true,
        cashRecordedAmount: total,
        alasanPending: pt.alasan,
        billingStatus: "ACTIVE",
      });
    }
  });

  rawCashbackTerpendingData.forEach((cb) => {
    const existing = invoiceList.find((inv) => inv.nopol === cb.nopol || inv.invoice === cb.invoice);
    if (!existing) {
      const total = cb.uangMasuk || 0;
      invoiceList.push({
        id: currentId++,
        tanggal: cb.tanggal,
        customer: cb.customer,
        nopol: cb.nopol,
        namaBerkas: cb.namaBerkas,
        jenisLayanan: cb.pengurusan,
        totalTagihan: total,
        terbayar: total,
        sisa: 0,
        status: "Lunas",
        jatuhTempo: cb.tanggal,
        invoice: cb.invoice,
        invoiceNo: cb.invoice,
        phone: "081377889900",
        biayaSamsat: total - cb.profit,
        profit: cb.profit,
        profitStatus: "REALIZED",
        cashback: cb.jumlahCashback,
        cashbackPersen: cb.cashbackPersen,
        cashbackStatus: "PENDING",
        isCashRealized: true,
        cashRecordedAmount: total,
        billingStatus: "ACTIVE",
      });
    }
  });

  return invoiceList;
}

export {
  rawProfitData as initialProfitData,
  rawKasMessengerData as initialKasMessengerData,
  rawKasKantorData as initialKasKantorData,
  rawPengeluaranData as initialPengeluaranData,
  rawLabaRugiData as initialLabaRugiData,
};
