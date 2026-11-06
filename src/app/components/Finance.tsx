import { motion } from "motion/react";
import { FinanceContent } from "./FinanceContent";

export function Finance({ defaultTab = "profit" }: { defaultTab?: string }) {
  return (
    <div className="flex-1 flex flex-col space-y-4 w-full min-w-0 text-left content-fluid">
      <FinanceContent tab={defaultTab} />
    </div>
  );
}

// Export all data for FinanceContent
export const profitData = [
  { id: 1, tanggal: "20/08/2025", nopol: "B 1970 SAM", customer: "CNAF KEL. GADING", namaBerkas: "AHMAD YUSUF AL MAJID", pengurusan: "PAJAK TAHUNAN", uangMasuk: -795000, biayaSamsat: 0, profit: 0, rekening: "CIMB", invoice: "BJ_25-08_1687", tanggalTTB: "14/08/2025", ttb: "TTB_25_08_2035", jemputDokumen: "Ahmad", prosesSamsat: "Budi", pengantaranKembali: "Ahmad" },
  { id: 2, tanggal: "21/08/2025", nopol: "B 2345 XYZ", customer: "PT. MAJU JAYA", namaBerkas: "BUDI SANTOSO", pengurusan: "MUTASI LD", uangMasuk: 5000000, biayaSamsat: 3500000, profit: 1500000, rekening: "BCA", invoice: "BJ_25-08_1688", tanggalTTB: "22/08/2025", ttb: "TTB_25_08_2036", jemputDokumen: "Budi", prosesSamsat: "Candra", pengantaranKembali: "Budi" },
  { id: 3, tanggal: "22/08/2025", nopol: "D 5678 EFG", customer: "JOHN DOE", namaBerkas: "JOHN DOE", pengurusan: "BALIK NAMA", uangMasuk: 4500000, biayaSamsat: 3000000, profit: 1500000, rekening: "Mandiri", invoice: "BJ_25-08_1689", tanggalTTB: "23/08/2025", ttb: "TTB_25_08_2037", jemputDokumen: "Candra", prosesSamsat: "Ahmad", pengantaranKembali: "Candra" },
  { id: 4, tanggal: "23/08/2025", nopol: "F 9012 HIJ", customer: "SITI RAHAYU", namaBerkas: "SITI RAHAYU", pengurusan: "BBN 1", uangMasuk: 6000000, biayaSamsat: 4200000, profit: 1800000, rekening: "BRI", invoice: "BJ_25-08_1690", tanggalTTB: "24/08/2025", ttb: "TTB_25_08_2038", jemputDokumen: "Ahmad", prosesSamsat: "Budi", pengantaranKembali: "Ahmad" },
  { id: 5, tanggal: "24/08/2025", nopol: "B 3456 DEF", customer: "AHMAD RIZKI", namaBerkas: "AHMAD RIZKI", pengurusan: "PAJAK 5 TAHUNAN", uangMasuk: 2500000, biayaSamsat: 1800000, profit: 700000, rekening: "BCA", invoice: "BJ_25-08_1691", tanggalTTB: "25/08/2025", ttb: "TTB_25_08_2039", jemputDokumen: "Budi", prosesSamsat: "Candra", pengantaranKembali: "Budi" },
  { id: 6, tanggal: "25/08/2025", nopol: "D 7890 KLM", customer: "DEWI LESTARI", namaBerkas: "DEWI LESTARI", pengurusan: "DUPLIKAT STNK", uangMasuk: 800000, biayaSamsat: 500000, profit: 300000, rekening: "Cash", invoice: "BJ_25-08_1692", tanggalTTB: "26/08/2025", ttb: "TTB_25_08_2040", jemputDokumen: "Candra", prosesSamsat: "Ahmad", pengantaranKembali: "Candra" },
  { id: 7, tanggal: "26/08/2025", nopol: "B 5678 NOP", customer: "PT. GLOBAL", namaBerkas: "PT. GLOBAL INDONESIA", pengurusan: "MUTASI AS", uangMasuk: 4800000, biayaSamsat: 3200000, profit: 1600000, rekening: "Mandiri", invoice: "BJ_25-08_1693", tanggalTTB: "27/08/2025", ttb: "TTB_25_08_2041", jemputDokumen: "Ahmad", prosesSamsat: "Budi", pengantaranKembali: "Ahmad" },
  { id: 8, tanggal: "27/08/2025", nopol: "F 1234 QRS", customer: "ANDI WIJAYA", namaBerkas: "ANDI WIJAYA", pengurusan: "PERPANJANGAN STNK", uangMasuk: 1500000, biayaSamsat: 800000, profit: 700000, rekening: "BCA", invoice: "BJ_25-08_1694", tanggalTTB: "28/08/2025", ttb: "TTB_25_08_2042", jemputDokumen: "Budi", prosesSamsat: "Candra", pengantaranKembali: "Budi" },
  { id: 9, tanggal: "28/08/2025", nopol: "D 9876 TUV", customer: "CITRA DEWI", namaBerkas: "CITRA DEWI", pengurusan: "BBN 2", uangMasuk: 5500000, biayaSamsat: 3800000, profit: 1700000, rekening: "BRI", invoice: "BJ_25-08_1695", tanggalTTB: "29/08/2025", ttb: "TTB_25_08_2043", jemputDokumen: "Candra", prosesSamsat: "Ahmad", pengantaranKembali: "Candra" },
  { id: 10, tanggal: "29/08/2025", nopol: "B 1111 WXY", customer: "RUDI HARTONO", namaBerkas: "RUDI HARTONO", pengurusan: "PAJAK TAHUNAN", uangMasuk: 1200000, biayaSamsat: 600000, profit: 600000, rekening: "CIMB", invoice: "BJ_25-08_1696", tanggalTTB: "30/08/2025", ttb: "TTB_25_08_2044", jemputDokumen: "Ahmad", prosesSamsat: "Budi", pengantaranKembali: "Ahmad" },
  { id: 11, tanggal: "30/08/2025", nopol: "D 2222 ZAB", customer: "MAYA SARI", namaBerkas: "MAYA SARI", pengurusan: "MUTASI LD", uangMasuk: 4700000, biayaSamsat: 3100000, profit: 1600000, rekening: "BCA", invoice: "BJ_25-08_1697", tanggalTTB: "31/08/2025", ttb: "TTB_25_08_2045", jemputDokumen: "Budi", prosesSamsat: "Candra", pengantaranKembali: "Budi" },
  { id: 12, tanggal: "31/08/2025", nopol: "F 3333 CDE", customer: "TONO SUSANTO", namaBerkas: "TONO SUSANTO", pengurusan: "GANTI PLAT", uangMasuk: 900000, biayaSamsat: 550000, profit: 350000, rekening: "Mandiri", invoice: "BJ_25-08_1698", tanggalTTB: "01/09/2025", ttb: "TTB_25_08_2046", jemputDokumen: "Candra", prosesSamsat: "Ahmad", pengantaranKembali: "Candra" },
  { id: 13, tanggal: "01/09/2025", nopol: "B 4444 FGH", customer: "LINDA PERMATA", namaBerkas: "LINDA PERMATA", pengurusan: "BBN 1", uangMasuk: 5800000, biayaSamsat: 4000000, profit: 1800000, rekening: "BRI", invoice: "BJ_25-09_1699", tanggalTTB: "02/09/2025", ttb: "TTB_25_09_2047", jemputDokumen: "Ahmad", prosesSamsat: "Budi", pengantaranKembali: "Ahmad" },
  { id: 14, tanggal: "02/09/2025", nopol: "D 5555 IJK", customer: "HENDRA WIJAYA", namaBerkas: "HENDRA WIJAYA", pengurusan: "PAJAK 5 TAHUNAN", uangMasuk: 2800000, biayaSamsat: 2000000, profit: 800000, rekening: "BCA", invoice: "BJ_25-09_1700", tanggalTTB: "03/09/2025", ttb: "TTB_25_09_2048", jemputDokumen: "Budi", prosesSamsat: "Candra", pengantaranKembali: "Budi" },
  { id: 15, tanggal: "03/09/2025", nopol: "F 6666 LMN", customer: "PUTRI AMANDA", namaBerkas: "PUTRI AMANDA", pengurusan: "MUTASI AS", uangMasuk: 4900000, biayaSamsat: 3300000, profit: 1600000, rekening: "Mandiri", invoice: "BJ_25-09_1701", tanggalTTB: "04/09/2025", ttb: "TTB_25_09_2049", jemputDokumen: "Candra", prosesSamsat: "Ahmad", pengantaranKembali: "Candra" },
];

export const kasMessengerData = [
  { id: 1, tanggal: "01/11/2024", jenis: "PETTY CASH", messenger: "Ahmad", keterangan: "Top up kas awal bulan", in: 5000000, out: 0, total: 5000000 },
  { id: 2, tanggal: "01/11/2024", jenis: "OPERASIONAL", messenger: "Ahmad", keterangan: "Bensin + Parkir", in: 0, out: 150000, total: 4850000 },
  { id: 3, tanggal: "02/11/2024", jenis: "OPERASIONAL", messenger: "Budi", keterangan: "Makan siang + tol", in: 0, out: 180000, total: 4670000 },
  { id: 4, tanggal: "03/11/2024", jenis: "PETTY CASH", messenger: "Ahmad", keterangan: "Top up tambahan", in: 2000000, out: 0, total: 6670000 },
  { id: 5, tanggal: "03/11/2024", jenis: "OPERASIONAL", messenger: "Candra", keterangan: "Bensin motor", in: 0, out: 100000, total: 6570000 },
  { id: 6, tanggal: "04/11/2024", jenis: "BIAYA SAMSAT", messenger: "Ahmad", keterangan: "Bayar di Samsat", in: 0, out: 850000, total: 5720000 },
  { id: 7, tanggal: "05/11/2024", jenis: "OPERASIONAL", messenger: "Budi", keterangan: "Parkir + makan", in: 0, out: 120000, total: 5600000 },
  { id: 8, tanggal: "06/11/2024", jenis: "BIAYA SAMSAT", messenger: "Candra", keterangan: "Pengurusan BBN", in: 0, out: 1500000, total: 4100000 },
  { id: 9, tanggal: "07/11/2024", jenis: "PETTY CASH", messenger: "Ahmad", keterangan: "Refund dari customer", in: 500000, out: 0, total: 4600000 },
  { id: 10, tanggal: "08/11/2024", jenis: "OPERASIONAL", messenger: "Ahmad", keterangan: "Bensin + tol", in: 0, out: 170000, total: 4430000 },
  { id: 11, tanggal: "09/11/2024", jenis: "BIAYA SAMSAT", messenger: "Budi", keterangan: "Pajak tahunan", in: 0, out: 650000, total: 3780000 },
  { id: 12, tanggal: "10/11/2024", jenis: "OPERASIONAL", messenger: "Candra", keterangan: "Makan + parkir", in: 0, out: 95000, total: 3685000 },
];

export const kasKantorData = [
  { id: 1, tanggal: "01/11/2024", status: "Debit", keterangan: "Pembayaran dari PT. Maju Jaya", debit: 5000000, kredit: 0, total: 5000000 },
  { id: 2, tanggal: "01/11/2024", status: "Kredit", keterangan: "Bayar sewa kantor", debit: 0, kredit: 3000000, total: 2000000 },
  { id: 3, tanggal: "02/11/2024", status: "Debit", keterangan: "Pembayaran dari John Doe", debit: 4500000, kredit: 0, total: 6500000 },
  { id: 4, tanggal: "03/11/2024", status: "Kredit", keterangan: "Bayar listrik & air", debit: 0, kredit: 500000, total: 6000000 },
  { id: 5, tanggal: "04/11/2024", status: "Debit", keterangan: "Transfer dari Siti Rahayu", debit: 6000000, kredit: 0, total: 12000000 },
  { id: 6, tanggal: "05/11/2024", status: "Kredit", keterangan: "Gaji karyawan", debit: 0, kredit: 8000000, total: 4000000 },
  { id: 7, tanggal: "06/11/2024", status: "Debit", keterangan: "Pembayaran cash Ahmad Rizki", debit: 2500000, kredit: 0, total: 6500000 },
  { id: 8, tanggal: "07/11/2024", status: "Kredit", keterangan: "Internet bulanan", debit: 0, kredit: 300000, total: 6200000 },
  { id: 9, tanggal: "08/11/2024", status: "Debit", keterangan: "Transfer dari PT. Global", debit: 4800000, kredit: 0, total: 11000000 },
  { id: 10, tanggal: "09/11/2024", status: "Kredit", keterangan: "ATK dan supplies", debit: 0, kredit: 750000, total: 10250000 },
  { id: 11, tanggal: "10/11/2024", status: "Debit", keterangan: "Pembayaran dari Andi Wijaya", debit: 1500000, kredit: 0, total: 11750000 },
  { id: 12, tanggal: "11/11/2024", status: "Kredit", keterangan: "Maintenance AC", debit: 0, kredit: 450000, total: 11300000 },
];

export const pengeluaranKantorData = [
  { id: 1, tanggal: "01/11/2024", keterangan: "Sewa Kantor", nominal: 3000000 },
  { id: 2, tanggal: "01/11/2024", keterangan: "Listrik Bulan Oktober", nominal: 450000 },
  { id: 3, tanggal: "01/11/2024", keterangan: "Air PDAM Oktober", nominal: 150000 },
  { id: 4, tanggal: "02/11/2024", keterangan: "Internet & Telepon", nominal: 300000 },
  { id: 5, tanggal: "03/11/2024", keterangan: "ATK dan Supplies", nominal: 750000 },
  { id: 6, tanggal: "05/11/2024", keterangan: "Gaji Karyawan November", nominal: 8000000 },
  { id: 7, tanggal: "07/11/2024", keterangan: "Service AC Kantor", nominal: 450000 },
  { id: 8, tanggal: "08/11/2024", keterangan: "Kebersihan Kantor", nominal: 400000 },
  { id: 9, tanggal: "10/11/2024", keterangan: "Makan siang tim", nominal: 350000 },
  { id: 10, tanggal: "12/11/2024", keterangan: "Bensin operasional", nominal: 500000 },
  { id: 11, tanggal: "15/11/2024", keterangan: "Toner printer", nominal: 280000 },
  { id: 12, tanggal: "18/11/2024", keterangan: "Parkir bulanan", nominal: 200000 },
  { id: 13, tanggal: "20/11/2024", keterangan: "Materai dan administrasi", nominal: 150000 },
  { id: 14, tanggal: "25/11/2024", keterangan: "Service komputer", nominal: 350000 },
  { id: 15, tanggal: "28/11/2024", keterangan: "Biaya tak terduga", nominal: 500000 },
];

export const belumKurangBayarData = [
  { id: 1, tanggal: "15/10/2024", nopol: "B 1111 AAA", customer: "TOKO SEJAHTERA", namaBerkas: "BAMBANG S", pengurusan: "MUTASI LD", uangMasuk: 3000000, biayaSamsat: 3500000, profit: -500000, status: "Kurang Bayar", invoice: "BJ_24-10_1500", kekurangan: 500000 },
  { id: 2, tanggal: "18/10/2024", nopol: "D 2222 BBB", customer: "CV. MANDIRI", namaBerkas: "SUSAN TAN", pengurusan: "BBN 1", uangMasuk: 0, biayaSamsat: 4200000, profit: -4200000, status: "Belum Bayar", invoice: "BJ_24-10_1523", kekurangan: 6000000 },
  { id: 3, tanggal: "20/10/2024", nopol: "F 3333 CCC", customer: "PT. SENTOSA", namaBerkas: "AGUS SALIM", pengurusan: "PAJAK 5 TAHUNAN", uangMasuk: 2000000, biayaSamsat: 2300000, profit: -300000, status: "Kurang Bayar", invoice: "BJ_24-10_1545", kekurangan: 300000 },
  { id: 4, tanggal: "22/10/2024", nopol: "B 4444 DDD", customer: "TOKO ELEKTRONIK", namaBerkas: "LIA KUSUMA", pengurusan: "MUTASI AS", uangMasuk: 0, biayaSamsat: 3200000, profit: -3200000, status: "Belum Bayar", invoice: "BJ_24-10_1567", kekurangan: 4800000 },
  { id: 5, tanggal: "25/10/2024", nopol: "D 5555 EEE", customer: "WARUNG MAKAN", namaBerkas: "SAMSUL HADI", pengurusan: "PERPANJANGAN STNK", uangMasuk: 1000000, biayaSamsat: 1300000, profit: -300000, status: "Kurang Bayar", invoice: "BJ_24-10_1589", kekurangan: 300000 },
  { id: 6, tanggal: "27/10/2024", nopol: "F 6666 FFF", customer: "BENGKEL MOTOR", namaBerkas: "JOKO SANTOSO", pengurusan: "GANTI PLAT", uangMasuk: 0, biayaSamsat: 550000, profit: -550000, status: "Belum Bayar", invoice: "BJ_24-10_1601", kekurangan: 900000 },
  { id: 7, tanggal: "28/10/2024", nopol: "B 7777 GGG", customer: "SALON CANTIK", namaBerkas: "RATNA SARI", pengurusan: "BBN 2", uangMasuk: 4500000, biayaSamsat: 5200000, profit: -700000, status: "Kurang Bayar", invoice: "BJ_24-10_1612", kekurangan: 700000 },
  { id: 8, tanggal: "29/10/2024", nopol: "D 8888 HHH", customer: "FOTOCOPY 24 JAM", namaBerkas: "DEDI SURYADI", pengurusan: "PAJAK TAHUNAN", uangMasuk: 0, biayaSamsat: 800000, profit: -800000, status: "Belum Bayar", invoice: "BJ_24-10_1625", kekurangan: 1500000 },
  { id: 9, tanggal: "30/10/2024", nopol: "F 9999 III", customer: "LAUNDRY EXPRESS", namaBerkas: "WATI LESTARI", pengurusan: "DUPLIKAT STNK", uangMasuk: 600000, biayaSamsat: 850000, profit: -250000, status: "Kurang Bayar", invoice: "BJ_24-10_1638", kekurangan: 250000 },
  { id: 10, tanggal: "31/10/2024", nopol: "B 1010 JJJ", customer: "TOKO KELONTONG", namaBerkas: "HASAN BASRI", pengurusan: "MUTASI LD", uangMasuk: 0, biayaSamsat: 3500000, profit: -3500000, status: "Belum Bayar", invoice: "BJ_24-10_1649", kekurangan: 5000000 },
];

export const profitTerpendingData = [
  { id: 1, tanggal: "05/11/2024", nopol: "B 1234 PPP", customer: "TOKO BAJU", namaBerkas: "SANTI DEWI", pengurusan: "BALIK NAMA", uangMasuk: 4000000, biayaSamsat: 2800000, profit: 1200000, status: "Profit Pending", invoice: "BJ_24-11_1700", alasan: "Menunggu proses selesai" },
  { id: 2, tanggal: "06/11/2024", nopol: "D 5678 QQQ", customer: "RESTORAN PADANG", namaBerkas: "YUSUF HAKIM", pengurusan: "MUTASI LD", uangMasuk: 5200000, biayaSamsat: 3600000, profit: 1600000, status: "Profit Pending", invoice: "BJ_24-11_1711", alasan: "Konfirmasi customer" },
  { id: 3, tanggal: "07/11/2024", nopol: "F 9012 RRR", customer: "MINIMARKET", namaBerkas: "RINA OKTAVIA", pengurusan: "BBN 1", uangMasuk: 6200000, biayaSamsat: 4400000, profit: 1800000, status: "Profit Pending", invoice: "BJ_24-11_1722", alasan: "Dokumen kurang" },
  { id: 4, tanggal: "08/11/2024", nopol: "B 3456 SSS", customer: "COUNTER HP", namaBerkas: "IWAN SETIAWAN", pengurusan: "PAJAK 5 TAHUNAN", uangMasuk: 2700000, biayaSamsat: 1900000, profit: 800000, status: "Profit Pending", invoice: "BJ_24-11_1733", alasan: "Verifikasi data" },
  { id: 5, tanggal: "09/11/2024", nopol: "D 7890 TTT", customer: "APOTEK SEHAT", namaBerkas: "DWI ANGGRAENI", pengurusan: "MUTASI AS", uangMasuk: 4600000, biayaSamsat: 3000000, profit: 1600000, status: "Profit Pending", invoice: "BJ_24-11_1744", alasan: "Proses administrasi" },
  { id: 6, tanggal: "10/11/2024", nopol: "F 2468 UUU", customer: "PERCETAKAN", namaBerkas: "HADI PURNOMO", pengurusan: "PERPANJANGAN STNK", uangMasuk: 1400000, biayaSamsat: 750000, profit: 650000, status: "Profit Pending", invoice: "BJ_24-11_1755", alasan: "Tunggu TTB" },
  { id: 7, tanggal: "11/11/2024", nopol: "B 1357 VVV", customer: "TOKO SEMBAKO", namaBerkas: "NURUL HIDAYAH", pengurusan: "GANTI PLAT", uangMasuk: 950000, biayaSamsat: 600000, profit: 350000, status: "Profit Pending", invoice: "BJ_24-11_1766", alasan: "Koordinasi samsat" },
  { id: 8, tanggal: "12/11/2024", nopol: "D 2468 WWW", customer: "WARUNG KOPI", namaBerkas: "TRI WAHYUDI", pengurusan: "BBN 2", uangMasuk: 5400000, biayaSamsat: 3700000, profit: 1700000, status: "Profit Pending", invoice: "BJ_24-11_1777", alasan: "Cek fisik pending" },
  { id: 9, tanggal: "13/11/2024", nopol: "F 3579 XXX", customer: "BENGKEL LAS", namaBerkas: "SUMANTO", pengurusan: "PAJAK TAHUNAN", uangMasuk: 1350000, biayaSamsat: 680000, profit: 670000, status: "Profit Pending", invoice: "BJ_24-11_1788", alasan: "Konfirmasi biaya" },
  { id: 10, tanggal: "14/11/2024", nopol: "B 4680 YYY", customer: "LAUNDRY KILOAN", namaBerkas: "ANI SUSILOWATI", pengurusan: "DUPLIKAT STNK", uangMasuk: 850000, biayaSamsat: 520000, profit: 330000, status: "Profit Pending", invoice: "BJ_24-11_1799", alasan: "Proses duplikat" },
];

export const cashbackTerpendingData = [
  { id: 1, tanggal: "01/11/2024", nopol: "B 1111 CBA", customer: "PT. BERKAH JAYA", namaBerkas: "DIREKTUR UTAMA", pengurusan: "MUTASI LD", uangMasuk: 5500000, profit: 1800000, status: "Cashback Pending", invoice: "BJ_24-11_1800", jumlahCashback: 200000, cashbackPersen: "3.6%" },
  { id: 2, tanggal: "02/11/2024", nopol: "D 2222 CBA", customer: "CV. SENTOSA", namaBerkas: "PEMILIK CV", pengurusan: "BBN 1", uangMasuk: 6800000, profit: 2200000, status: "Cashback Pending", invoice: "BJ_24-11_1811", jumlahCashback: 250000, cashbackPersen: "3.7%" },
  { id: 3, tanggal: "03/11/2024", nopol: "F 3333 CBA", customer: "TOKO BANGUNAN", namaBerkas: "BAMBANG W", pengurusan: "PAJAK 5 TAHUNAN", uangMasuk: 2900000, profit: 900000, status: "Cashback Pending", invoice: "BJ_24-11_1822", jumlahCashback: 100000, cashbackPersen: "3.4%" },
  { id: 4, tanggal: "04/11/2024", nopol: "B 4444 CBA", customer: "RUMAH MAKAN", namaBerkas: "SUTRISNO", pengurusan: "MUTASI AS", uangMasuk: 4900000, profit: 1700000, status: "Cashback Pending", invoice: "BJ_24-11_1833", jumlahCashback: 180000, cashbackPersen: "3.7%" },
  { id: 5, tanggal: "05/11/2024", nopol: "D 5555 CBA", customer: "SALON KECANTIKAN", namaBerkas: "RATIH KUSUMA", pengurusan: "PERPANJANGAN STNK", uangMasuk: 1600000, profit: 750000, status: "Cashback Pending", invoice: "BJ_24-11_1844", jumlahCashback: 75000, cashbackPersen: "4.7%" },
  { id: 6, tanggal: "06/11/2024", nopol: "F 6666 CBA", customer: "BENGKEL MOBIL", namaBerkas: "TEGUH SUSILO", pengurusan: "GANTI PLAT", uangMasuk: 1050000, profit: 420000, status: "Cashback Pending", invoice: "BJ_24-11_1855", jumlahCashback: 50000, cashbackPersen: "4.8%" },
  { id: 7, tanggal: "07/11/2024", nopol: "B 7777 CBA", customer: "FOTOKOPI & PRINTING", namaBerkas: "YUNI SAFITRI", pengurusan: "BBN 2", uangMasuk: 5900000, profit: 2000000, status: "Cashback Pending", invoice: "BJ_24-11_1866", jumlahCashback: 220000, cashbackPersen: "3.7%" },
  { id: 8, tanggal: "08/11/2024", nopol: "D 8888 CBA", customer: "WARUNG NASI", namaBerkas: "SLAMET RIYADI", pengurusan: "PAJAK TAHUNAN", uangMasuk: 1450000, profit: 720000, status: "Cashback Pending", invoice: "BJ_24-11_1877", jumlahCashback: 70000, cashbackPersen: "4.8%" },
  { id: 9, tanggal: "09/11/2024", nopol: "F 9999 CBA", customer: "APOTEK 24 JAM", namaBerkas: "dr. FAISAL", pengurusan: "BALIK NAMA", uangMasuk: 4200000, profit: 1400000, status: "Cashback Pending", invoice: "BJ_24-11_1888", jumlahCashback: 150000, cashbackPersen: "3.6%" },
  { id: 10, tanggal: "10/11/2024", nopol: "B 1010 CBA", customer: "TOKO ROTI", namaBerkas: "HENDRA TAN", pengurusan: "DUPLIKAT STNK", uangMasuk: 920000, profit: 380000, status: "Cashback Pending", invoice: "BJ_24-11_1899", jumlahCashback: 45000, cashbackPersen: "4.9%" },
];

export const tagihanData = [
  { id: 1, tanggal: "01/11/2024", customer: "PT. MAJU JAYA", nopol: "B 1234 ABC", jenisLayanan: "Mutasi LD", totalTagihan: 5000000, terbayar: 5000000, sisa: 0, status: "Lunas", jatuhTempo: "05/11/2024" },
  { id: 2, tanggal: "02/11/2024", customer: "TOKO SEJAHTERA", nopol: "D 5678 DEF", jenisLayanan: "BBN 1", totalTagihan: 6000000, terbayar: 3000000, sisa: 3000000, status: "Belum Lunas", jatuhTempo: "10/11/2024" },
  { id: 3, tanggal: "03/11/2024", customer: "CV. MANDIRI", nopol: "F 9012 GHI", jenisLayanan: "Pajak Tahunan", totalTagihan: 1500000, terbayar: 1500000, sisa: 0, status: "Lunas", jatuhTempo: "08/11/2024" },
  { id: 4, tanggal: "04/11/2024", customer: "WARUNG MAKAN", nopol: "B 3456 JKL", jenisLayanan: "Mutasi AS", totalTagihan: 4800000, terbayar: 2000000, sisa: 2800000, status: "Belum Lunas", jatuhTempo: "12/11/2024" },
  { id: 5, tanggal: "05/11/2024", customer: "SALON CANTIK", nopol: "D 7890 MNO", jenisLayanan: "Perpanjangan 5 Tahun", totalTagihan: 2500000, terbayar: 2500000, sisa: 0, status: "Lunas", jatuhTempo: "10/11/2024" },
  { id: 6, tanggal: "06/11/2024", customer: "BENGKEL MOTOR", nopol: "F 2468 PQR", jenisLayanan: "Ganti Plat", totalTagihan: 900000, terbayar: 0, sisa: 900000, status: "Belum Bayar", jatuhTempo: "11/11/2024" },
  { id: 7, tanggal: "07/11/2024", customer: "TOKO BANGUNAN", nopol: "B 1357 STU", jenisLayanan: "BBN 2", totalTagihan: 5500000, terbayar: 5500000, sisa: 0, status: "Lunas", jatuhTempo: "15/11/2024" },
  { id: 8, tanggal: "08/11/2024", customer: "FOTOCOPY 24 JAM", nopol: "D 9753 VWX", jenisLayanan: "Duplikat STNK", totalTagihan: 800000, terbayar: 500000, sisa: 300000, status: "Belum Lunas", jatuhTempo: "13/11/2024" },
  { id: 9, tanggal: "09/11/2024", customer: "LAUNDRY KILOAN", nopol: "F 8642 YZA", jenisLayanan: "Pajak Tahunan", totalTagihan: 1200000, terbayar: 1200000, sisa: 0, status: "Lunas", jatuhTempo: "14/11/2024" },
  { id: 10, tanggal: "10/11/2024", customer: "RUMAH MAKAN PADANG", nopol: "B 7531 BCD", jenisLayanan: "Mutasi LD", totalTagihan: 4700000, terbayar: 1000000, sisa: 3700000, status: "Belum Lunas", jatuhTempo: "18/11/2024" },
  { id: 11, tanggal: "11/11/2024", customer: "APOTEK SEHAT", nopol: "D 8520 EFG", jenisLayanan: "Balik Nama", totalTagihan: 4000000, terbayar: 4000000, sisa: 0, status: "Lunas", jatuhTempo: "16/11/2024" },
  { id: 12, tanggal: "12/11/2024", customer: "COUNTER HP", nopol: "F 9630 HIJ", jenisLayanan: "Perpanjangan STNK", totalTagihan: 1400000, terbayar: 700000, sisa: 700000, status: "Belum Lunas", jatuhTempo: "20/11/2024" },
];

export const labaRugiData = [
  { bulan: "Jan", pendapatan: 24000000, pengeluaran: 15000000, laba: 9000000 },
  { bulan: "Feb", pendapatan: 28000000, pengeluaran: 16000000, laba: 12000000 },
  { bulan: "Mar", pendapatan: 32000000, pengeluaran: 18000000, laba: 14000000 },
  { bulan: "Apr", pendapatan: 29000000, pengeluaran: 17000000, laba: 12000000 },
  { bulan: "Mei", pendapatan: 38000000, pengeluaran: 20000000, laba: 18000000 },
  { bulan: "Jun", pendapatan: 45250000, pengeluaran: 22000000, laba: 23250000 },
];
