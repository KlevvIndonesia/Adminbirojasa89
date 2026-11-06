import { Column } from "../components/EnhancedTableWithDialogs";
import { FieldConfig } from "../components/FinanceAddPage";
import { formatDateDDMMYYYY } from "../utils/financeFormatters";
import type { OperationalOrder } from "../../domain/order/types";
import type { InvoiceBillingRecord, PenjualanContractCategory } from "../../domain/finance/types";
import { pricingStore } from "./pricingStore";
import { paymentMethodStore } from "./paymentMethodStore";

/**
 * EXACT DATA PENJUALAN COLUMN CONTRACT (Requirements 11 & 12)
 * Schema definition - strictly preserved without alterations, translations, abbreviations, or reordering.
 */

/**
 * CANONICAL UNIFIED DATA PENJUALAN COLUMN CONTRACT (30 Columns)
 * Applied uniformly across all 7 canonical service tabs.
 */
export const CANONICAL_PENJUALAN_COLUMNS_CONTRACT = [
  "Tanggal Masuk Berkas",
  "Nomor Order",
  "R4 / R2",
  "Plat No",
  "Nama Customer",
  "Nama Pemilik (STNK/BPKB)",
  "Jenis Pengurusan",
  "Samsat Asal",
  "Samsat Tujuan",
  "Skema Pembayaran",
  "Tanggal Uang Masuk",
  "Uang Masuk dari Konsumen",
  "Total Tagihan Konsumen",
  "Sisa Tagihan",
  "Bank Uang Keluar",
  "Tanggal Uang Keluar",
  "Biaya Pokok Samsat",
  "Biaya Jasa",
  "Biaya Antar Jemput",
  "Biaya Lainnya",
  "Profit",
  "Status Pengerjaan",
  "Status Pembayaran",
  "No Invoice",
  "Tanda Terima",
  "Nomor Tanda Terima",
  "Dokumen BPKB",
  "Keterangan Dokumen BPKB",
  "TTB BPKB",
  "Keterangan",
] as const;

// Backward-compatible aliases for legacy imports
export const MUTASI_LD_COLUMNS_CONTRACT = CANONICAL_PENJUALAN_COLUMNS_CONTRACT;
export const MUTASI_AS_COLUMNS_CONTRACT = CANONICAL_PENJUALAN_COLUMNS_CONTRACT;
export const BBN_COLUMNS_CONTRACT = CANONICAL_PENJUALAN_COLUMNS_CONTRACT;
export const PERPANJANGAN_PAJAK_COLUMNS_CONTRACT = CANONICAL_PENJUALAN_COLUMNS_CONTRACT;
export const LAIN_LAIN_COLUMNS_CONTRACT = CANONICAL_PENJUALAN_COLUMNS_CONTRACT;

export const BELUM_KURANG_BAYAR_COLUMNS_CONTRACT = [
  "Tanggal Masuk Berkas",
  "R4 / R2",
  "Plat No",
  "Nama Customer",
  "Nama Pemilik (STNK/BPKB)",
  "Jenis Pengurusan",
  "Samsat",
  "Skema Pembayaran",
  "Tanggal Uang Masuk",
  "Uang Masuk dari Konsumen",
  "Bank Uang Keluar",
  "Tanggal Uang Keluar",
  "Biaya Pokok Samsat",
  "Biaya Jasa",
  "Biaya Antar Jemput",
  "Biaya Lainnya",
  "Profit",
  "Status Pembayaran",
  "No Invoice",
  "Tanda Terima",
  "BPKB",
  "TTB BPKB",
] as const;

export const PROFIT_TERPENDING_COLUMNS_CONTRACT = [
  "Tanggal Masuk Berkas",
  "R4 / R2",
  "Plat No",
  "Nama Customer",
  "Nama Pemilik (STNK/BPKB)",
  "Jenis Pengurusan",
  "Samsat",
  "Skema Pembayaran",
  "Tanggal Uang Masuk",
  "Uang Masuk dari Konsumen",
  "Bank Uang Keluar",
  "Tanggal Uang Keluar",
  "Biaya Pokok Samsat",
  "Biaya Jasa",
  "Biaya Antar Jemput",
  "Biaya Lainnya",
  "Profit",
  "Status Pembayaran",
  "No Invoice",
  "Tanda Terima",
] as const;

export const CASHBACK_TERPENDING_COLUMNS_CONTRACT = [
  "Tanggal Masuk Berkas",
  "R4 / R2",
  "Plat No",
  "Nama Customer",
  "Nama Pemilik (STNK/BPKB)",
  "Jenis Pengurusan",
  "Samsat",
  "Skema Pembayaran",
  "Tanggal Uang Masuk",
  "Uang Masuk dari Konsumen",
  "Bank Uang Keluar",
  "Tanggal Uang Keluar",
  "Biaya Pokok Samsat",
  "Biaya Jasa",
  "Biaya Antar Jemput",
  "Biaya Lainnya",
  "Profit",
  "Status Pembayaran",
  "No Invoice",
  "Tanda Terima",
  "Jumlah Cashback",
] as const;

/**
 * Helper to build EnhancedTable Columns for a given contract schema
 */
export function buildTableColumnsFromContract(columnList: readonly string[]): Column[] {
  return columnList.map((colName) => {
    const isDate = colName.toLowerCase().includes("tanggal");
    const isFilterableText =
      colName === "Plat No" ||
      colName === "Nama Customer" ||
      colName === "Nama Pemilik (STNK/BPKB)" ||
      colName === "Nama" ||
      colName === "Jenis Pengurusan" ||
      colName === "No Invoice" ||
      colName === "Tanda Terima" ||
      colName === "Nomor Tanda Terima" ||
      colName === "Samsat Asal" ||
      colName === "Samsat Tujuan" ||
      colName === "Samsat" ||
      colName === "TTB BPKB" ||
      colName === "Keterangan" ||
      colName === "Keterangan Dokumen BPKB" ||
      colName === "Nomor Order";

    const isR4R2 = colName === "R4 / R2";
    const isSkemaBayar = colName === "Skema Pembayaran" || colName === "Jenis Bayar";
    const isMetodeBayar = colName === "Metode Pembayaran";
    const isPhone = colName === "No HP" || colName === "Nomor HP";
    const isStatusPengerjaan = colName === "Status Pengerjaan";
    const isStatusPembayaran = colName === "Status Pembayaran" || colName === "Status";
    const isStatusBPKB = colName === "Status BPKB";
    const isBPKB = colName === "BPKB" || colName === "Dokumen BPKB";

    const displayLabel = colName === "Plat No" ? "Nomor Polisi" : colName;

    const baseCol: Column = {
      key: colName,
      label: displayLabel,
    };

    if (isDate) {
      baseCol.filterable = true;
      baseCol.filterType = "text";
    } else if (isR4R2) {
      baseCol.filterable = true;
      baseCol.filterType = "select";
      baseCol.filterOptions = ["R4", "R2"];
    } else if (isPhone) {
      baseCol.filterable = true;
      baseCol.filterType = "text";
    } else if (isSkemaBayar) {
      baseCol.filterable = true;
      baseCol.filterType = "select";
      baseCol.filterOptions = ["Bayar di Awal", "Bayar di Akhir", "Tempo"];
    } else if (isMetodeBayar) {
      baseCol.filterable = true;
      baseCol.filterType = "select";
      baseCol.filterOptions = ["Transfer Bank BCA", "Transfer BCA", "Transfer Mandiri", "Transfer BRI", "Cash", "QRIS", "-"];
    } else if (isStatusPengerjaan) {
      baseCol.filterable = true;
      baseCol.filterType = "select";
      baseCol.filterOptions = ["Dalam Proses", "Menunggu Arsip", "Selesai", "Pending", "Dibatalkan", "-"];
    } else if (isStatusPembayaran) {
      baseCol.filterable = true;
      baseCol.filterType = "select";
      baseCol.filterOptions = ["Belum Bayar", "Kurang Bayar", "Lunas", "Kelebihan Bayar", "Dibatalkan"];
    } else if (isStatusBPKB) {
      baseCol.filterable = true;
      baseCol.filterType = "select";
      baseCol.filterOptions = ["Selesai", "Proses", "-"];
    } else if (isBPKB) {
      baseCol.filterable = true;
      baseCol.filterType = "select";
      baseCol.filterOptions = ["Ada", "Belum", "-"];
    } else if (isFilterableText) {
      baseCol.filterable = true;
      baseCol.filterType = "text";
    }

    return baseCol;
  });
}

const CANONICAL_SERVICES_OPTIONS = [
  "Perpanjangan 1 Tahun",
  "Perpanjangan 5 Tahun",
  "Mutasi Asal Samsat",
  "Mutasi Antar Daerah",
  "Balik Nama",
  "Tarik Berkas",
  "Duplikat STNK",
  "Lainnya",
];

/**
 * Helper to build FieldConfig for add/edit pages matching exact contract
 */
export function buildFieldsFromContract(
  columnList: readonly string[],
  category?: PenjualanContractCategory | string
): FieldConfig[] {
  const fields: FieldConfig[] = columnList.map((colName) => {
    const isDate = colName.toLowerCase().includes("tanggal");
    const isNumber =
      colName.toLowerCase().includes("uang") ||
      colName.toLowerCase().includes("profit") ||
      colName.toLowerCase().includes("cashback") ||
      colName.toLowerCase().includes("kekurangan") ||
      colName.toLowerCase().includes("tagihan") ||
      colName.toLowerCase().includes("biaya");
    const label = colName === "Plat No" ? "Nomor Polisi" : colName;

    if (colName === "Plat No" || colName === "Nomor Polisi") {
      return {
        key: colName,
        label,
        type: "plate-number" as any,
        placeholder: "B 1234 ABC",
        helpText: "Nomor polisi standar 3 kotak: [Plat Depan] [Nomor] [Plat Belakang]",
      };
    }
    if (colName === "Samsat" || colName === "Samsat Asal" || colName === "Wilayah Samsat") {
      return {
        key: colName,
        label: colName === "Samsat" ? "Samsat Asal" : label,
        type: "samsat-select" as any,
        placeholder: "Pilih kantor Samsat asal...",
        helpText: "Kantor Samsat asal sesuai STNK/BPKB (data master resmi)",
      };
    }
    if (colName === "Samsat Tujuan") {
      return {
        key: colName,
        label,
        type: "samsat-select" as any,
        placeholder: "Pilih kantor Samsat tujuan...",
        helpText: "Kantor Samsat tujuan untuk berkas mutasi (data master resmi)",
      };
    }
    if (colName === "Jenis Pengurusan" || colName === "Layanan") {
      if (category === "lainnya") {
        return {
          key: colName,
          label,
          type: "text",
          placeholder: "Masukkan jenis pengurusan (contoh: Blokir STNK, Ganti Warna, Cek Fisik, dll)",
          helpText: "Ketik nama layanan/pengurusan khusus secara bebas",
        };
      }
      const availServices = typeof pricingStore.getAvailableServices === "function"
        ? pricingStore.getAvailableServices()
        : [];
      const options = availServices.length > 0 ? availServices : CANONICAL_SERVICES_OPTIONS;
      return {
        key: colName,
        label,
        type: "select",
        options,
        placeholder: "Pilih jenis pengurusan",
        helpText: "Pilih jenis layanan resmi biro jasa",
      };
    }

    if (colName === "Nomor Order" || colName === "No Order") {
      return {
        key: colName,
        label,
        type: "text",
        readOnly: true,
        placeholder: "(Dibuat otomatis oleh sistem saat simpan)",
        helpText: "Nomor order kanonis terhubung dengan Order Tracking (otomatis dibuat oleh sistem)",
      };
    }
    if (colName === "Sisa Tagihan" || colName === "Kekurangan") {
      return {
        key: colName,
        label,
        type: "number",
        readOnly: true,
        helpText: "Dihitung otomatis dari Total Tagihan - Uang Masuk Terverifikasi (read-only)",
      };
    }
    if (colName === "Uang Masuk dari Konsumen") {
      return {
        key: colName,
        label,
        type: "number",
        placeholder: "0",
        helpText: "Nominal uang masuk yang telah diterima dari konsumen",
      };
    }
    if (colName === "Total Tagihan Konsumen") {
      return {
        key: colName,
        label,
        type: "number",
        placeholder: "0",
        helpText: "Total estimasi biaya tagihan konsumen keseluruhan",
      };
    }
    if (colName === "Nama Pemilik (STNK/BPKB)" || colName === "Nama") {
      return {
        key: colName,
        label,
        type: "text",
        placeholder: "Nama pemilik kendaraan sesuai STNK/BPKB",
        helpText: "Nama wajib pajak yang tertera pada dokumen legal kendaraan",
      };
    }
    if (colName === "Biaya Pokok Samsat" || colName === "Uang Keluar Biro Jasa" || colName === "Uang Keluar dari Biro Jasa") {
      return {
        key: colName,
        label,
        type: "number",
        placeholder: "0",
        helpText: "Biaya pokok resmi Samsat (PKB, PNBP, SWDKLLJ)",
      };
    }
    if (colName === "Biaya Jasa") {
      return {
        key: colName,
        label,
        type: "number",
        placeholder: "0",
        helpText: "Tarif jasa pengurusan resmi biro jasa",
      };
    }
    if (colName === "Biaya Antar Jemput") {
      return {
        key: colName,
        label,
        type: "number",
        placeholder: "0",
        helpText: "Biaya penjemputan dan pengantaran dokumen",
      };
    }
    if (colName === "Biaya Lainnya") {
      return {
        key: colName,
        label,
        type: "number",
        placeholder: "0",
        helpText: "Biaya operasional lainnya (opsional)",
      };
    }
    if (colName === "Jumlah Cashback") {
      return {
        key: colName,
        label,
        type: "number",
        readOnly: true,
        placeholder: "0",
        helpText: "Dihitung otomatis dari kelebihan uang masuk terhadap total tagihan konsumen (read-only)",
      };
    }
    if (colName === "Profit") {
      return {
        key: colName,
        label,
        type: "number",
        readOnly: true,
        helpText: "Dihitung otomatis dari selisih penerimaan dan biaya riil (read-only)",
      };
    }
    if (colName === "No HP" || colName === "Nomor HP") {
      return {
        key: colName,
        label,
        type: "text",
        placeholder: "Contoh: 081289123456",
        helpText: "Nomor kontak / WhatsApp pelanggan",
      };
    }
    if (colName === "Metode Pembayaran") {
      return {
        key: colName,
        label,
        type: "select",
        options: ["Transfer Bank BCA", "Transfer Bank Mandiri", "Transfer Bank BRI", "Cash", "QRIS"],
        helpText: "Metode atau rekening pembayaran",
      };
    }
    if (colName === "Status Pengerjaan") {
      return {
        key: colName,
        label,
        type: "select",
        readOnly: true,
        options: ["Dalam Proses", "Menunggu Arsip", "Selesai", "Pending", "Dibatalkan", "-"],
        helpText: "Status tahapan pemrosesan berkas ditentukan oleh Order Tracking (read-only)",
      };
    }
    if (colName === "Status Pembayaran" || colName === "Status") {
      return {
        key: colName,
        label,
        type: "select",
        readOnly: true,
        options: ["Belum Bayar", "Kurang Bayar", "Lunas", "Kelebihan Bayar"],
        helpText: "Status pelunasan pembayaran customer ditentukan oleh kas masuk (read-only)",
      };
    }
    if (colName === "No Invoice") {
      return {
        key: colName,
        label,
        type: "text",
        readOnly: true,
        placeholder: "Contoh: INV/2024/001",
        helpText: "Nomor faktur invoice penjualan kanonis (read-only)",
      };
    }
    if (colName === "Tanda Terima" || colName === "Nomor Tanda Terima") {
      return {
        key: colName,
        label,
        type: "text",
        placeholder: "Nomor tanda terima berkas",
        helpText: "Nomor tanda terima invoice/dokumen",
      };
    }
    if (colName === "Dokumen BPKB" || colName === "BPKB") {
      return {
        key: colName,
        label,
        type: "select",
        options: ["Ada", "Belum", "-"],
        helpText: "Status keberadaan fisik buku BPKB",
      };
    }
    if (colName === "Keterangan Dokumen BPKB") {
      return {
        key: colName,
        label,
        type: "text",
        placeholder: "Catatan BPKB (contoh: di leasing/finance, dll.)",
        helpText: "Keterangan status atau lokasi penyimpanan BPKB",
      };
    }
    if (colName === "Status BPKB") {
      return {
        key: colName,
        label,
        type: "select",
        options: ["Selesai", "Proses", "Sudah Diambil", "Belum Diambil"],
        helpText: "Status dokumen BPKB",
      };
    }
    if (colName === "TTB BPKB") {
      return {
        key: colName,
        label,
        type: "text",
        placeholder: "Nomor tanda terima berkas BPKB",
        helpText: "Nomor tanda terima BPKB",
      };
    }
    if (colName === "Keterangan") {
      return {
        key: colName,
        label,
        type: "text",
        placeholder: "Catatan transaksi pengurusan...",
        helpText: "Catatan tambahan untuk transaksi penjualan ini",
      };
    }

    if (isDate) {
      return { key: colName, label, type: "date" };
    }
    if (colName === "R4 / R2") {
      return { key: colName, label, type: "select", options: ["R4", "R2"] };
    }
    if (colName === "Skema Pembayaran" || colName === "Jenis Bayar") {
      return { key: colName, label, type: "select", options: ["Bayar di Awal", "Bayar di Akhir", "Tempo"] };
    }
    if (colName === "Bank Uang Keluar") {
      const activeMethods = paymentMethodStore.getActive().map((m) => m.nama_metode);
      const defaultBankList = ["Transfer BCA", "Transfer Mandiri", "Transfer BRI", "Cash", "QRIS"];
      const baseOptions = activeMethods.length > 0 ? activeMethods : defaultBankList;
      const options = Array.from(new Set([...baseOptions, "Kas Kantor", "Kas Messenger", "Lainnya"]));
      return {
        key: colName,
        label,
        type: "select",
        options,
        placeholder: "Pilih metode pembayaran / kas...",
        helpText: "Metode pembayaran atau kas perbankan keluar",
      };
    }
    if (isNumber) {
      return { key: colName, label, type: "number", placeholder: "0" };
    }
    return { key: colName, label, type: "text" };
  });

  // Complete historical fields: ensure contact, destination, and cashback are accessible
  if (!columnList.includes("Jumlah Cashback" as any)) {
    fields.push({
      key: "Jumlah Cashback",
      label: "Jumlah Cashback (Rp)",
      type: "number",
      placeholder: "0",
      helpText: "Nilai cashback yang dijanjikan/terpending (jika ada)",
    });
  }
  if (!columnList.some(c => c.toLowerCase().includes("telepon") || c.toLowerCase().includes("hp"))) {
    fields.push({
      key: "Nomor HP",
      label: "Nomor HP / WhatsApp Customer",
      type: "text",
      placeholder: "0812...",
      helpText: "Kontak customer untuk konfirmasi & tagihan (wajib)",
    });
  }
  if (!columnList.some(c => c.toLowerCase().includes("alamat"))) {
    fields.push({
      key: "Alamat",
      label: "Alamat Lengkap Customer",
      type: "text",
      placeholder: "Contoh: Jl. Pajajaran No. 12, Bogor",
      helpText: "Alamat aktual domisili/kantor customer (wajib)",
    });
  }
  if (!columnList.includes("Samsat Tujuan" as any)) {
    fields.push({
      key: "Samsat Tujuan",
      label: "Samsat Tujuan (Mutasi)",
      type: "samsat-select" as any,
      placeholder: "Pilih kantor Samsat tujuan (jika mutasi)...",
      helpText: "Kantor Samsat tujuan untuk mutasi berkas (data master resmi)",
    });
  }

  return fields;
}

/**
 * Resolves an operational order's service name to its canonical Data Penjualan tab category (7 Canonical Services).
 * Phase 9.0 Order-to-Sales Projection Architecture.
 */
export function resolveOrderSalesCategory(layanan?: string, serviceId?: string): PenjualanContractCategory {
  if (serviceId) {
    const sId = serviceId.toLowerCase();
    if (sId.includes("1th") || sId.includes("perp_1thn")) return "perpanjangan-1-tahun";
    if (sId.includes("5th") || sId.includes("perp_5thn")) return "perpanjangan-5-tahun";
    if (sId.includes("mut-as") || sId.includes("mut_as")) return "mutasi-asal";
    if (sId.includes("mut-ad") || sId.includes("mut_ad") || sId.includes("mutasi-ld") || sId.includes("mutasi_ld")) return "mutasi-antar-daerah";
    if (sId.includes("bbn")) return "balik-nama";
    if (sId.includes("tarik") || sId.includes("tb")) return "tarik-berkas";
    if (sId.includes("dup") || sId.includes("stnk")) return "duplikat-stnk";
    if (sId.includes("lain") || sId.includes("other")) return "lainnya";
  }

  if (!layanan) return "perpanjangan-1-tahun";
  const normalized = layanan.toLowerCase().trim();

  // 1. Duplikat STNK
  if (normalized.includes("duplikat") || normalized.includes("hilang")) {
    return "duplikat-stnk";
  }

  // 2. Tarik Berkas / Cabut Berkas (without mutasi)
  if (normalized.includes("tarik berkas") || normalized.includes("cabut berkas")) {
    return "tarik-berkas";
  }

  // 3. Mutasi Asal Samsat
  if (
    normalized.includes("mutasi asal") ||
    normalized.includes("antar samsat") ||
    normalized === "mutasi as" ||
    normalized.includes("mutasi as ") ||
    normalized.endsWith("mutasi as")
  ) {
    return "mutasi-asal";
  }

  // 4. Mutasi Antar Daerah / Mutasi Luar Daerah
  if (
    normalized.includes("antar daerah") ||
    normalized.includes("luar daerah") ||
    normalized === "mutasi ld" ||
    normalized.includes("mutasi ld ") ||
    normalized.endsWith("mutasi ld") ||
    normalized.includes("mutasi")
  ) {
    return "mutasi-antar-daerah";
  }

  // 5. Balik Nama (BBN)
  if (normalized.includes("balik nama") || normalized.includes("bbn")) {
    return "balik-nama";
  }

  // 6. Perpanjangan 5 Tahun (check 5 tahun before generic perpanjangan)
  if (
    normalized.includes("5 tahun") ||
    normalized.includes("5 thn") ||
    normalized.includes("lima tahun") ||
    normalized.includes("ganti plat") ||
    normalized.includes("ganti kaleng")
  ) {
    return "perpanjangan-5-tahun";
  }

  // 7. Perpanjangan 1 Tahun (or generic perpanjangan / pajak)
  if (
    normalized.includes("1 tahun") ||
    normalized.includes("1 thn") ||
    normalized.includes("satu tahun") ||
    normalized.includes("perpanjangan") ||
    normalized.includes("pajak") ||
    normalized.includes("stnk")
  ) {
    return "perpanjangan-1-tahun";
  }

  // 8. Layanan Lainnya (or any other custom service)
  return "lainnya";
}

/**
 * Authoritatively derives Status Pengerjaan from an operational order.
 * - "Dalam Proses": currentStep 1..7
 * - "Menunggu Arsip": currentStep >= 8 and not archived
 * - "Selesai": currentStep >= 8 and archived
 * - "-": non-order fixture, invalid step, NaN, or undefined
 * Phase 9.1 Dual Status Integration.
 */
export function deriveStatusPengerjaan(
  order?: Partial<OperationalOrder> | null,
  isArchived: boolean = false
): string {
  if (!order) {
    return "-";
  }
  if ((order as any).isCancelled || order.currentStageName === "Dibatalkan" || (order as any).status === "Dibatalkan") {
    return "Dibatalkan";
  }
  if (typeof order.currentStep !== "number" || isNaN(order.currentStep)) {
    return "-";
  }
  const step = order.currentStep;
  if (step >= 1 && step <= 7) {
    return "Dalam Proses";
  }
  if (step >= 8) {
    const archived = isArchived || Boolean((order as any).isArchived);
    return archived ? "Selesai" : "Menunggu Arsip";
  }
  return "-";
}

/**
 * Authoritatively derives Status Pembayaran from a linked invoice and optional order context.
 * Strict Accounting Rule:
 * Status Pembayaran ONLY reflects payment received vs. total obligation:
 * - "Belum Bayar": 0 paid, total > 0
 * - "Kurang Bayar": 0 < paid < total
 * - "Lunas": paid >= total (or explicitly marked Lunas)
 * - "Kelebihan Bayar": Overpayment with refund pending
 * - "Tagihan Tidak Tersedia": Missing totals or unlinked
 *
 * NOTE: Status pengerjaan, Profit Terpending, and Cashback Terpending are strictly separated!
 * Transactions paid in full MUST remain "Lunas" even if Samsat work is not yet finished.
 */
export function deriveStatusPembayaran(
  invoice?: InvoiceBillingRecord | null,
  order?: Partial<OperationalOrder> | null
): "Belum Bayar" | "Kurang Bayar" | "Lunas" | "Kelebihan Bayar" | "Tagihan Tidak Tersedia" {
  if (!invoice && !order) {
    return "Tagihan Tidak Tersedia";
  }

  const toValidNumber = (val: any): number => {
    if (val === null || val === undefined) return NaN;
    if (typeof val === "number") return isNaN(val) ? NaN : val;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "") return NaN;
      const num = Number(trimmed);
      return isNaN(num) ? NaN : num;
    }
    return NaN;
  };

  const totalCandidate = toValidNumber(invoice?.totalTagihan);
  const totalOrderPay = toValidNumber(order?.payment?.totalBiaya);
  const totalOrderEst = toValidNumber(order?.totalEstimasi);

  const total = !isNaN(totalCandidate)
    ? totalCandidate
    : !isNaN(totalOrderPay)
    ? totalOrderPay
    : !isNaN(totalOrderEst)
    ? totalOrderEst
    : NaN;

  const paidCandidate = toValidNumber(invoice?.terbayar);
  const paidInvDibayar = toValidNumber(invoice?.dibayar);
  const paidOrderDibayar = toValidNumber(order?.payment?.dibayar);

  const paid = !isNaN(paidCandidate)
    ? paidCandidate
    : !isNaN(paidInvDibayar)
    ? paidInvDibayar
    : !isNaN(paidOrderDibayar)
    ? paidOrderDibayar
    : invoice?.status === "Lunas" && !isNaN(total) && total > 0
    ? total
    : 0;

  if (
    order?.currentStageName === "Dibatalkan" ||
    (order as any)?.isCancelled ||
    (order as any)?.status === "Dibatalkan" ||
    (invoice?.billingStatus as any) === "CANCELLED" ||
    (invoice?.status as any) === "CANCELLED" ||
    (invoice as any)?.isCancelled
  ) {
    return "Dibatalkan" as any;
  }

  if (isNaN(total) || total <= 0 || isNaN(paid) || paid < 0) {
    return "Tagihan Tidak Tersedia";
  }

  // Decision 5: Canonical 4 payment statuses (refund status is separated)
  // 1. Kelebihan Bayar: pembayaran terverifikasi melebihi total tagihan
  if (paid > total || (invoice as any)?.settlementCondition === "OVERPAID") {
    return "Kelebihan Bayar";
  }

  // 2. Lunas: pembayaran terverifikasi sama dengan total tagihan
  if (paid === total && total > 0) {
    return "Lunas";
  }

  // If explicit Lunas status
  if (invoice?.status === "Lunas" || ((order?.payment as any)?.status && ((order?.payment as any).status.toLowerCase() === "lunas"))) {
    return "Lunas";
  }

  // 3. Kurang Bayar: pembayaran terverifikasi lebih dari nol tetapi masih kurang dari total tagihan
  if (paid > 0 && paid < total) {
    return "Kurang Bayar";
  }

  // 4. Belum Bayar: belum ada pembayaran terverifikasi
  if (paid === 0) {
    return "Belum Bayar";
  }

  return "Tagihan Tidak Tersedia";
}

/**
 * Pure projection function converting an OperationalOrder (with optional linked InvoiceBillingRecord)
 * into a canonical Data Penjualan row matching the table contract schema.
 * Phase 9.0 & 9.1 Dual Status Projection Architecture.
 */
export function projectOrderToContractRow(
  order: OperationalOrder,
  invoice?: InvoiceBillingRecord,
  isArchived: boolean = false
): Record<string, any> {
  // R4 / R2 classification
  let r4r2: "R4" | "R2" = "R4";
  if (invoice?.r4r2) {
    r4r2 = invoice.r4r2;
  } else if (order.jenisKendaraan) {
    const jk = order.jenisKendaraan.toLowerCase();
    if (jk.includes("r2") || jk.includes("motor") || jk.includes("sepeda")) {
      r4r2 = "R2";
    } else {
      r4r2 = "R4";
    }
  }

  // Samsat location: category-aware resolution (Phase 9.4 Finding 2)
  const category = resolveOrderSalesCategory(order.layanan, (order as any).serviceId);
  const isMutasi = category === "mutasi-antar-daerah" || category === "mutasi-asal" || (category as any) === "mutasi-ld" || (category as any) === "mutasi-as";

  const isValidSamsat = (val?: string | null): boolean => {
    if (!val) return false;
    const trimmed = val.trim();
    return trimmed !== "" && trimmed !== "-";
  };

  let samsatAsal = "-";
  if (isValidSamsat(order.wilayahSamsatAsal)) {
    samsatAsal = order.wilayahSamsatAsal.trim();
  } else if (invoice?.samsat && isValidSamsat(invoice.samsat)) {
    samsatAsal = invoice.samsat.trim();
  } else {
    samsatAsal = "Samsat";
  }

  let samsatTujuan = "-";
  if (isValidSamsat(order.wilayahSamsatTujuan)) {
    samsatTujuan = order.wilayahSamsatTujuan!.trim();
  }

  let samsat: string;
  if (isMutasi && isValidSamsat(order.wilayahSamsatTujuan)) {
    samsat = order.wilayahSamsatTujuan!.trim();
  } else {
    samsat = samsatAsal;
  }

  // Financial calculations
  // Tanggal Masuk Berkas: actual document intake date, NOT order creation date
  let tanggalBerkas = "-";
  if (order.tanggalMasukBerkas) {
    tanggalBerkas = formatDateDDMMYYYY(order.tanggalMasukBerkas);
  } else if (order.metodeLayanan === "Datang Langsung") {
    tanggalBerkas = formatDateDDMMYYYY(order.createdAt);
  } else if (order.currentStep >= 3) {
    tanggalBerkas = formatDateDDMMYYYY(order.pickupCompletedAt || (order as any).updatedAt || order.createdAt);
  }

  // Financial calculations
  const totalBiaya = order.payment?.totalBiaya ?? invoice?.totalTagihan ?? order.totalEstimasi ?? 0;
  const uangMasuk = order.payment?.dibayar ?? invoice?.terbayar ?? 0;
  
  // Distinguish payment scheme (Jenis Bayar) from payment method (Metode Pembayaran)
  const jenisBayar = order.payment?.tipePembayaran || (invoice as any)?.tipePembayaran || (invoice?.metodePembayaran === "Tempo" ? "Tempo" : "Bayar di Akhir");
  const metodePembayaran = order.payment?.metodePembayaran || invoice?.metodePembayaran || "-";
  const noHp = order.nomorHP || (invoice as any)?.phone || "-";

  // Tanggal Uang Masuk: based on explicit order field, payment timestamp, or fallback
  const tanggalUangMasuk = (order as any).tanggalUangMasuk
    ? formatDateDDMMYYYY((order as any).tanggalUangMasuk)
    : (uangMasuk > 0
        ? formatDateDDMMYYYY(
            order.payment?.paymentVerifiedAt ||
            order.payment?.tanggalBayar ||
            (invoice as any)?.tanggalBayar ||
            (invoice?.status === "Lunas" ? invoice?.tanggal : null) ||
            order.createdAt
          )
        : "-");

  const bankUangKeluar = order.payment?.namaBank || invoice?.bank || "BCA";
  
  // Tanggal Uang Keluar: based on actual Samsat / kas disbursement expenditure ONLY
  let tanggalUangKeluar = "-";
  if (order.tanggalPengeluaranSamsat) {
    tanggalUangKeluar = formatDateDDMMYYYY(order.tanggalPengeluaranSamsat);
  } else if ((order as any).tanggalUangKeluar) {
    tanggalUangKeluar = formatDateDDMMYYYY((order as any).tanggalUangKeluar);
  }

  // Uang Keluar dari Biro Jasa (biaya samsat)
  let uangKeluar = 0;
  if (invoice?.biayaSamsat !== undefined && invoice.biayaSamsat !== null) {
    uangKeluar = invoice.biayaSamsat;
  } else {
    uangKeluar = (order.pkb || 0) + (order.swdkllj || 0) + (order.dendaSwdkllj || 0);
  }

  const biayaLainnya = (order as any).biayaLainnya ?? (order as any).biaya_lainnya ?? (invoice as any)?.biayaLainnya ?? 0;

  // Profit: Total Uang Masuk - Biaya Pokok Samsat - Biaya Lainnya
  let profit = 0;
  if (invoice?.profit !== undefined && invoice.profit !== null) {
    profit = invoice.profit;
  } else {
    profit = uangMasuk - uangKeluar - biayaLainnya;
  }

  // Phase 9.1: Authoritative dual statuses
  const isOrderCancelled = Boolean(
    (order as any).isCancelled ||
    order.currentStageName === "Dibatalkan" ||
    (order as any).status === "Dibatalkan" ||
    (invoice?.billingStatus as any) === "CANCELLED" ||
    (invoice?.status as any) === "CANCELLED" ||
    (invoice as any)?.isCancelled
  );
  const statusPengerjaan = isOrderCancelled
    ? "Dibatalkan"
    : ((order as any).salesSnapshotStatus || (order as any).statusPengerjaan || deriveStatusPengerjaan(order, isArchived));
  const statusPembayaran = isOrderCancelled
    ? "Dibatalkan"
    : ((order as any).statusPembayaran || deriveStatusPembayaran(invoice, order));

  // Requirement 8: Honor explicit manual values without forced fallback generation for newly added rows
  const noInvoice = (order as any).noInvoice !== undefined
    ? ((order as any).noInvoice || "-")
    : (order.payment?.invoiceNo || invoice?.invoice || (invoice as any)?.invoiceNo || "-");

  // Phase 9.4 Finding 3: Tanggal Invoice strictly prioritizes invoice issuance date, NEVER payment date
  const rawInvoiceDate = (invoice as any)?.tanggalInvoice || invoice?.tanggal || order.createdAt;
  const tanggalInvoice = formatDateDDMMYYYY(rawInvoiceDate);

  const tandaTerima = (order as any).tandaTerima !== undefined
    ? ((order as any).tandaTerima || "-")
    : (invoice?.tandaTerima || "-");
  const nomorTandaTerima = (order as any).nomorTandaTerima || tandaTerima;

  // BPKB fields: honor explicit manual values, never force fake defaults
  const bpkbDoc = order.clientDocuments?.["BPKB"];
  const bpkb = (order as any).bpkb !== undefined
    ? ((order as any).bpkb || "-")
    : (bpkbDoc?.status === "Sudah Tersedia" ? "Ada" : (order.currentStep >= 5 ? "Ada" : "-"));
  const dokumenBPKB = (order as any).dokumenBPKB || bpkb;
  const keteranganDokumenBPKB = (order as any).keteranganDokumenBPKB || (order as any).keteranganBPKB || "-";

  const statusBPKB = (order as any).statusBPKB !== undefined
    ? ((order as any).statusBPKB || "-")
    : (order.currentStep >= 7 ? "Selesai" : "-");

  const ttbBPKB = (order as any).ttbBPKB !== undefined
    ? ((order as any).ttbBPKB || "-")
    : (invoice?.ttbBPKB || "-");

  const keterangan = (order as any).catatan || (order as any).keterangan || "-";

  // Real digital documents count
  let attachedDocsCount = 0;
  if (order.clientDocuments) {
    Object.values(order.clientDocuments).forEach((d: any) => {
      if (d && (d.fileUrl || (d.name && !d.name.toLowerCase().includes("belum")))) {
        attachedDocsCount++;
      }
    });
  }
  if (order.rekapDocuments) {
    attachedDocsCount += order.rekapDocuments.length;
  }
  if ((order as any).uploadedDocs) {
    attachedDocsCount += (order as any).uploadedDocs.length;
  }
  if (order.deliveryHandover?.photoProofUrl) {
    attachedDocsCount++;
  }

  // Decision 2: Nama Pemilik (STNK/BPKB) strictly from vehicle document, NEVER falling back to customer name!
  const namaPemilik = (order.namaPemilik && order.namaPemilik.trim()) ? order.namaPemilik.trim() : "-";
  const cashback = Math.max(0, uangMasuk - totalBiaya);
  const formattedAlamat = (order as any).alamat || (order.alamatPenjemputan?.detail ? [order.alamatPenjemputan.detail, order.alamatPenjemputan.nomor ? `No. ${order.alamatPenjemputan.nomor}` : '', order.alamatPenjemputan.rtRw ? `RT/RW ${order.alamatPenjemputan.rtRw}` : '', order.alamatPenjemputan.kelurahan ? `Kel. ${order.alamatPenjemputan.kelurahan}` : '', order.alamatPenjemputan.kecamatan ? `Kec. ${order.alamatPenjemputan.kecamatan}` : '', order.alamatPenjemputan.kota].filter(Boolean).join(', ') : "-");

  return {
    id: `ord:${order.orderNo}`,
    orderNo: order.orderNo,
    // 30 Uniform Columns (CANONICAL_PENJUALAN_COLUMNS_CONTRACT):
    "Tanggal Masuk Berkas": tanggalBerkas,
    "Nomor Order": order.orderNo,
    "R4 / R2": r4r2,
    "Plat No": order.nopol,
    "Nama Customer": order.customer,
    "Nama Pemilik (STNK/BPKB)": namaPemilik,
    "Jenis Pengurusan": order.layanan,
    "Samsat Asal": samsatAsal,
    "Samsat Tujuan": samsatTujuan,
    "Skema Pembayaran": jenisBayar,
    "Tanggal Uang Masuk": tanggalUangMasuk,
    "Uang Masuk dari Konsumen": uangMasuk,
    "Total Tagihan Konsumen": totalBiaya,
    "Sisa Tagihan": Math.max(0, totalBiaya - uangMasuk),
    "Bank Uang Keluar": bankUangKeluar,
    "Tanggal Uang Keluar": tanggalUangKeluar,
    "Biaya Pokok Samsat": uangKeluar,
    "Biaya Jasa": (order as any).biayaJasa || profit,
    "Biaya Antar Jemput": (order as any).biayaAntarJemput || 0,
    "Biaya Lainnya": (order as any).biayaLainnya || (invoice as any)?.biayaLainnya || 0,
    "Profit": profit,
    "Status Pengerjaan": statusPengerjaan,
    "Status Pembayaran": statusPembayaran,
    "No Invoice": noInvoice,
    "Tanggal Invoice": tanggalInvoice,
    "Tanda Terima": tandaTerima,
    "Nomor Tanda Terima": nomorTandaTerima,
    "Dokumen BPKB": dokumenBPKB,
    "Keterangan Dokumen BPKB": keteranganDokumenBPKB,
    "TTB BPKB": ttbBPKB,
    "Keterangan": keterangan,

    // Backward-compatibility keys:
    "Samsat": samsat,
    "Nama": namaPemilik,
    "No HP": noHp,
    "Nomor HP": noHp,
    "Alamat": formattedAlamat,
    alamatPenjemputan: order.alamatPenjemputan,
    alamatPengantaran: order.alamatPengantaran,
    "Jenis Bayar": jenisBayar,
    "Metode Pembayaran": metodePembayaran,
    "Uang Keluar Biro Jasa": uangKeluar,
    "Uang Keluar dari Biro Jasa": uangKeluar,
    "Nama Rekening/Penerima": (order as any).namaPenerima || (order as any).namaPenerimaKeluar || (order as any).namaPemilikRekeningKeluar || "-",
    "Nama Rekening / Penerima": (order as any).namaPenerima || (order as any).namaPenerimaKeluar || (order as any).namaPemilikRekeningKeluar || "-",
    "Nama Penerima": (order as any).namaPenerima || (order as any).namaPenerimaKeluar || "-",
    namaPenerima: (order as any).namaPenerima || (order as any).namaPenerimaKeluar || "-",
    "Staf Pengirim": (order as any).stafPengirim || "",
    stafPengirim: (order as any).stafPengirim || "",
    "Nomor Rekening Pengirim": (order as any).noRekeningPengirim || (order as any).payment?.noRekening || "",
    noRekeningPengirim: (order as any).noRekeningPengirim || (order as any).payment?.noRekening || "",
    "Nomor Rekening Penerima": (order as any).noRekeningPenerima || "",
    noRekeningPenerima: (order as any).noRekeningPenerima || "",
    biayaJasa: (order as any).biayaJasa || profit,
    biayaAntarJemput: (order as any).biayaAntarJemput || 0,
    biayaLainnya: (order as any).biayaLainnya || (invoice as any)?.biayaLainnya || 0,
    namaPenerimaKeluar: (order as any).namaPenerimaKeluar || (order as any).namaPemilikRekeningKeluar || "-",
    metodePembayaranKeluar: (order as any).metodePembayaranKeluar || "",
    "Jumlah Cashback": cashback,
    "Status": statusPengerjaan,
    "BPKB": bpkb,
    "Status BPKB": statusBPKB,
    "Dokumen": attachedDocsCount > 0 ? `${attachedDocsCount} Berkas` : "Belum Ada",
    attachedDocsCount,
    dokumenAwal: (order as any).dokumenAwal || order.rekapDocuments?.filter((d: any) => d.phase === "BEFORE" || d.phase === "INBOUND" || !d.phase) || [],
    dokumenAkhir: (order as any).dokumenAkhir || order.rekapDocuments?.filter((d: any) => d.phase === "AFTER" || d.category === "Dokumen Hasil") || [],
  };
}

/**
 * Initial Contract Datasets (Clean Initial State - Transactions Derived from Canonical Orders)
 */
export const initialPerpanjangan1TahunContract: any[] = [];
export const initialPerpanjangan5TahunContract: any[] = [];
export const initialMutasiAsalContract: any[] = [];
export const initialMutasiAntarDaerahContract: any[] = [];
export const initialBalikNamaContract: any[] = [];
export const initialTarikBerkasContract: any[] = [];
export const initialDuplikatSTNKContract: any[] = [];
export const initialLainnyaContract: any[] = [];

// Backwards compatibility aliases
export const initialMutasiLDContract: any[] = initialMutasiAntarDaerahContract;
export const initialMutasiASContract: any[] = initialMutasiAsalContract;
export const initialBBNContract: any[] = initialBalikNamaContract;
export const initialPerpanjanganPajakContract: any[] = initialPerpanjangan1TahunContract;
export const initialLainLainContract: any[] = initialTarikBerkasContract;
export const initialBelumKurangBayarContract: any[] = [];
export const initialProfitTerpendingContract: any[] = [];
export const initialCashbackTerpendingContract: any[] = [];
