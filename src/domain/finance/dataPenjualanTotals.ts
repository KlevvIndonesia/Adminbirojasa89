/**
 * Data Penjualan Totals Calculator
 * Admin SUN89 — Biro Jasa Management System
 * 
 * SOT & Accounting Rules:
 * 1. Uang Masuk:
 *    - Strictly based on actual valid recorded customer payments.
 *    - Never uses estimated billing (Total Tagihan / Total Estimasi) as actual cash in.
 *    - Excludes void / reversed / cancelled transactions ($0).
 *    - Honors partial payments based on actual verified payment received.
 * 2. Uang Keluar:
 *    - Strictly based on expense/cost components classified as uang keluar on Data Penjualan:
 *      * Biaya Pokok Samsat (PKB, PNBP, SWDKLLJ official loket disbursement).
 *      * Biaya Lainnya (direct third-party / official disbursements if present).
 *    - Biro service margin components (Biaya Jasa, Biaya Antar Jemput) are NOT uang keluar.
 *    - Excludes cancelled transactions ($0).
 * 3. Total Tagihan:
 *    - Strictly based on customer billing / invoice amount (Total Tagihan Konsumen / totalBiaya).
 *    - Excludes cancelled / void transactions ($0).
 * 4. Cashback Terpending:
 *    - Strictly based on pending cashback / overpayment payable to the customer.
 *    - Excludes cashback that has already been realized or disbursed (status REALIZED / PAID / DIBAYAR).
 * 5. Scope Isolation:
 *    - Calculations are strictly scoped to the active pengurusan tab dataset and any active filters.
 */

export function parseNominalSafe(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  if (typeof val === "string") {
    const clean = val.replace(/[^0-9,-]/g, "").replace(",", ".");
    const num = Number(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Checks if a transaction is cancelled, void, or reversed.
 */
export function isCancelledTransaction(row: any): boolean {
  if (!row) return false;
  if (row.isCancelled || row.is_cancelled || row.isVoid || row.is_void) return true;
  const statusPembayaran = String(row["Status Pembayaran"] || row.statusPembayaran || row.status || "").toLowerCase();
  const statusPengerjaan = String(row["Status Pengerjaan"] || row.statusPengerjaan || "").toLowerCase();
  return (
    statusPembayaran.includes("batal") ||
    statusPembayaran.includes("cancel") ||
    statusPembayaran.includes("void") ||
    statusPengerjaan.includes("batal") ||
    statusPengerjaan.includes("cancel")
  );
}

/**
 * Extracts actual valid customer payment received for a Data Penjualan row.
 */
export function extractRowUangMasuk(row: any): number {
  if (isCancelledTransaction(row)) return 0;

  // Uang Masuk dari Konsumen: actual recorded payment received
  const raw =
    row["Uang Masuk dari Konsumen"] ??
    row.uangMasuk ??
    row.terbayar ??
    row.dibayar ??
    0;

  return Math.max(0, parseNominalSafe(raw));
}

/**
 * Extracts actual valid uang keluar (Samsat fees & direct operational expenses) for a Data Penjualan row.
 */
export function extractRowUangKeluar(row: any, category?: string): number {
  if (isCancelledTransaction(row)) return 0;

  // Primary component: Biaya Pokok Samsat / official Samsat fee
  const rawBiayaSamsat =
    row["Biaya Pokok Samsat"] ??
    row["Uang Keluar dari Biro Jasa"] ??
    row["Uang Keluar Biro Jasa"] ??
    row.biayaSamsat ??
    row.biaya_samsat ??
    row.uangKeluar ??
    0;

  // Secondary component: Biaya Lainnya (direct third-party / official disbursements)
  const rawBiayaLainnya =
    row["Biaya Lainnya"] ??
    row.biayaLainnya ??
    row.biaya_lainnya ??
    0;

  const biayaSamsat = Math.max(0, parseNominalSafe(rawBiayaSamsat));
  const biayaLainnya = Math.max(0, parseNominalSafe(rawBiayaLainnya));

  return biayaSamsat + biayaLainnya;
}

/**
 * Extracts total billing / invoice amount for a Data Penjualan row.
 */
export function extractRowTotalTagihan(row: any): number {
  if (isCancelledTransaction(row)) return 0;

  const raw =
    row["Total Tagihan Konsumen"] ??
    row["Total Tagihan"] ??
    row.totalTagihan ??
    row.totalBiaya ??
    row.totalEstimasi ??
    row.total ??
    0;

  return Math.max(0, parseNominalSafe(raw));
}

/**
 * Extracts pending cashback / overpayment amount for a Data Penjualan row.
 */
export function extractRowCashbackTerpending(row: any): number {
  if (!row) return 0;

  // Check if cashback is already realized / paid out
  const cashbackStatus = String(
    row.cashbackStatus ||
    row.cashback_status ||
    row["Status Cashback"] ||
    row.statusCashback ||
    ""
  ).toUpperCase();

  if (
    cashbackStatus === "REALIZED" ||
    cashbackStatus === "PAID" ||
    cashbackStatus === "DIBAYAR" ||
    cashbackStatus === "SELESAI"
  ) {
    return 0;
  }

  // 1. Explicit cashback field if set
  const explicitCashback = parseNominalSafe(
    row["Jumlah Cashback"] ??
    row.jumlahCashback ??
    row.cashbackNominal ??
    row.cashback_nominal ??
    row.cashback ??
    0
  );

  if (explicitCashback > 0) {
    return explicitCashback;
  }

  // 2. Overpayment (uang masuk > total tagihan)
  if (isCancelledTransaction(row)) {
    const refundStatus = String(row.refundStatus || row.refund_status || "").toUpperCase();
    if (refundStatus === "PROCESSED" || refundStatus === "SELESAI") return 0;
    return extractRowUangMasuk(row);
  }

  const uangMasuk = extractRowUangMasuk(row);
  const totalTagihan = extractRowTotalTagihan(row);
  const overpayment = Math.max(0, uangMasuk - totalTagihan);

  return overpayment;
}

export interface DataPenjualanTotals {
  totalUangMasuk: number;
  totalUangKeluar: number;
  totalTagihan: number;
  totalCashbackTerpending: number;
  transactionCount: number;
  validPaymentCount: number;
  validExpenseCount: number;
  validTagihanCount: number;
  validCashbackCount: number;
}

/**
 * Aggregates Total Uang Masuk, Total Uang Keluar, Total Tagihan, and Cashback Terpending across a set of rows.
 */
export function computeDataPenjualanTotals(rows: any[], category?: string): DataPenjualanTotals {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      totalUangMasuk: 0,
      totalUangKeluar: 0,
      totalTagihan: 0,
      totalCashbackTerpending: 0,
      transactionCount: 0,
      validPaymentCount: 0,
      validExpenseCount: 0,
      validTagihanCount: 0,
      validCashbackCount: 0,
    };
  }

  let totalUangMasuk = 0;
  let totalUangKeluar = 0;
  let totalTagihan = 0;
  let totalCashbackTerpending = 0;
  let validPaymentCount = 0;
  let validExpenseCount = 0;
  let validTagihanCount = 0;
  let validCashbackCount = 0;

  for (const row of rows) {
    if (!row) continue;
    const masuk = extractRowUangMasuk(row);
    const keluar = extractRowUangKeluar(row, category);
    const tagihan = extractRowTotalTagihan(row);
    const cashback = extractRowCashbackTerpending(row);

    totalUangMasuk += masuk;
    totalUangKeluar += keluar;
    totalTagihan += tagihan;
    totalCashbackTerpending += cashback;

    if (masuk > 0) validPaymentCount++;
    if (keluar > 0) validExpenseCount++;
    if (tagihan > 0) validTagihanCount++;
    if (cashback > 0) validCashbackCount++;
  }

  return {
    totalUangMasuk,
    totalUangKeluar,
    totalTagihan,
    totalCashbackTerpending,
    transactionCount: rows.length,
    validPaymentCount,
    validExpenseCount,
    validTagihanCount,
    validCashbackCount,
  };
}
