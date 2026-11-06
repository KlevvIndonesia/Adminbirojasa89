/**
 * Phase 9 Workstream E: Penjualan Contract Semantics & Edge Cases Verification
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Comprehensive tests for:
 * 1. deriveStatusPembayaran:
 *    - Valid invoice (Lunas, Kurang Bayar, Belum Bayar)
 *    - Zero invoice (total <= 0)
 *    - Negative amount
 *    - Missing total (undefined, null, NaN)
 *    - Missing paid (undefined, null, defaults to 0)
 *    - Numeric string values ("500000")
 *    - Empty string values ("")
 *    - Overpayment (paid > total)
 *    - Cancelled order / invoice ("Dibatalkan")
 * 2. Tanggal Invoice and Date formatting:
 *    - Valid ISO date
 *    - DD/MM/YYYY date
 *    - Indonesian written date ("15 Oktober 2026")
 *    - Invalid date string ("INVALID-DATE")
 *    - Missing invoice date fallback to order.createdAt
 *    - Null / undefined date
 */

import test from "node:test";
import assert from "node:assert";
import { deriveStatusPembayaran, projectOrderToContractRow } from "../src/app/data/penjualanContractData";
import { formatDateDDMMYYYY } from "../src/app/utils/financeFormatters";
import type { OperationalOrder } from "../src/domain/order/types";
import type { InvoiceBillingRecord } from "../src/domain/finance/types";

test("Workstream E: deriveStatusPembayaran - Valid Invoice Scenarios", () => {
  // 1. Lunas: paid === total
  const lunasRes = deriveStatusPembayaran(
    { totalTagihan: 500000, terbayar: 500000 } as InvoiceBillingRecord,
    null
  );
  assert.strictEqual(lunasRes, "Lunas");

  // 2. Kurang Bayar: 0 < paid < total
  const kurangRes = deriveStatusPembayaran(
    { totalTagihan: 1000000, terbayar: 400000 } as InvoiceBillingRecord,
    null
  );
  assert.strictEqual(kurangRes, "Kurang Bayar");

  // 3. Belum Bayar: paid === 0 && total > 0
  const belumRes = deriveStatusPembayaran(
    { totalTagihan: 750000, terbayar: 0 } as InvoiceBillingRecord,
    null
  );
  assert.strictEqual(belumRes, "Belum Bayar");
});

test("Workstream E: deriveStatusPembayaran - Zero and Negative Amount Boundaries", () => {
  // 1. Zero total invoice must evaluate to 'Tagihan Tidak Tersedia'
  assert.strictEqual(
    deriveStatusPembayaran({ totalTagihan: 0, terbayar: 0 } as InvoiceBillingRecord, null),
    "Tagihan Tidak Tersedia"
  );

  // 2. Negative total
  assert.strictEqual(
    deriveStatusPembayaran({ totalTagihan: -50000, terbayar: 0 } as InvoiceBillingRecord, null),
    "Tagihan Tidak Tersedia"
  );

  // 3. Negative paid
  assert.strictEqual(
    deriveStatusPembayaran({ totalTagihan: 500000, terbayar: -10000 } as InvoiceBillingRecord, null),
    "Tagihan Tidak Tersedia"
  );
});

test("Workstream E: deriveStatusPembayaran - Missing, Null, and Undefined Handling", () => {
  // 1. Neither invoice nor order
  assert.strictEqual(deriveStatusPembayaran(null, null), "Tagihan Tidak Tersedia");
  assert.strictEqual(deriveStatusPembayaran(undefined, undefined), "Tagihan Tidak Tersedia");

  // 2. Missing totalTagihan and order total
  assert.strictEqual(
    deriveStatusPembayaran({ terbayar: 100000 } as any, {} as any),
    "Tagihan Tidak Tersedia"
  );

  // 3. Null totalTagihan with missing order total
  assert.strictEqual(
    deriveStatusPembayaran({ totalTagihan: null } as any, null),
    "Tagihan Tidak Tersedia"
  );

  // 4. Missing paid defaults to 0 -> Belum Bayar if total > 0
  assert.strictEqual(
    deriveStatusPembayaran({ totalTagihan: 500000 } as any, null),
    "Belum Bayar"
  );
});

test("Workstream E: deriveStatusPembayaran - Numeric String and Empty String Coercion", () => {
  // 1. Valid numeric strings
  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: "600000", terbayar: "600000" } as any,
      null
    ),
    "Lunas"
  );

  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: "800000", terbayar: "300000" } as any,
      null
    ),
    "Kurang Bayar"
  );

  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: "500000", terbayar: "0" } as any,
      null
    ),
    "Belum Bayar"
  );

  // 2. Empty string values must evaluate to Tagihan Tidak Tersedia
  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: "", terbayar: "" } as any,
      null
    ),
    "Tagihan Tidak Tersedia"
  );

  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: "   ", terbayar: "0" } as any,
      null
    ),
    "Tagihan Tidak Tersedia"
  );

  // 3. Non-numeric strings
  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: "N/A", terbayar: "0" } as any,
      null
    ),
    "Tagihan Tidak Tersedia"
  );
});

test("Workstream E: deriveStatusPembayaran - Overpayment & Cancellation Precedence", () => {
  // 1. Overpayment: paid > total
  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: 500000, terbayar: 600000 } as InvoiceBillingRecord,
      null
    ),
    "Kelebihan Bayar"
  );

  // 2. Overpayment via settlementCondition
  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: 500000, terbayar: 500000, settlementCondition: "OVERPAID" } as any,
      null
    ),
    "Kelebihan Bayar"
  );

  // 3. Cancellation on Order
  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: 500000, terbayar: 500000 } as any,
      { currentStageName: "Dibatalkan" as any }
    ),
    "Dibatalkan"
  );

  // 4. Cancellation on Invoice
  assert.strictEqual(
    deriveStatusPembayaran(
      { totalTagihan: 500000, terbayar: 500000, billingStatus: "CANCELLED" } as any,
      null
    ),
    "Dibatalkan"
  );
});

test("Workstream E: Date Formatting & Tanggal Invoice Robustness", () => {
  // 1. Valid ISO date
  assert.strictEqual(formatDateDDMMYYYY("2026-10-25"), "25/10/2026");

  // 2. Valid DD/MM/YYYY date
  assert.strictEqual(formatDateDDMMYYYY("05/11/2026"), "05/11/2026");
  assert.strictEqual(formatDateDDMMYYYY("5-1-2026"), "05/01/2026");

  // 3. Valid Indonesian written date
  assert.strictEqual(formatDateDDMMYYYY("12 Oktober 2026"), "12/10/2026");

  // 4. Invalid date string returns safe '-'
  assert.strictEqual(formatDateDDMMYYYY("INVALID_DATE_STRING"), "-");

  // 5. Empty and null date returns '-'
  assert.strictEqual(formatDateDDMMYYYY(""), "-");
  assert.strictEqual(formatDateDDMMYYYY(null), "-");
  assert.strictEqual(formatDateDDMMYYYY(undefined), "-");
  assert.strictEqual(formatDateDDMMYYYY("-"), "-");
});

test("Workstream E: projectOrderToContractRow - Tanggal Invoice Integration & Invariants", () => {
  const sampleOrder: OperationalOrder = {
    orderNo: "ORD-SEM-001",
    customer: "Semantics Customer",
    nomorHP: "081234567890",
    layanan: "Perpanjangan STNK Tahunan",
    currentStep: 2,
    currentStageName: "Penjadwalan",
    createdAt: "2026-10-20",
    namaPemilik: "Pemilik Semantics",
    nopol: "B 1234 SEM",
    totalEstimasi: 750000,
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Transfer BCA",
      totalBiaya: 750000,
      dibayar: 750000,
      statusPembayaran: "Lunas",
      invoiceNo: "INV-SEM-001",
    },
  };

  const sampleInvoice: InvoiceBillingRecord = {
    id: "inv-sem-001",
    invoiceNo: "INV-SEM-001",
    orderNo: "ORD-SEM-001",
    nomorOrder: "ORD-SEM-001",
    tanggal: "2026-10-22",
    totalTagihan: 750000,
    terbayar: 750000,
    sisaTagihan: 0,
    status: "Lunas",
    billingStatus: "VERIFIED",
    customerName: "Semantics Customer",
    nopol: "B 1234 SEM",
    layanan: "Perpanjangan STNK Tahunan",
    createdAt: "2026-10-22T08:00:00Z",
    updatedAt: "2026-10-22T08:00:00Z",
  };

  const row = projectOrderToContractRow(sampleOrder, sampleInvoice);

  // 1. Verify Tanggal Invoice matches invoice issuance date
  assert.strictEqual(row["Tanggal Invoice"], "22/10/2026");

  // 2. Verify Status Pembayaran derives correctly
  assert.strictEqual(row["Status Pembayaran"], "Lunas");

  // 3. Fallback when invoice has no date: falls back to order.createdAt
  const rowNoInvDate = projectOrderToContractRow(sampleOrder, { ...sampleInvoice, tanggal: undefined as any });
  assert.strictEqual(rowNoInvDate["Tanggal Invoice"], "20/10/2026");

  // 4. Fallback when both have invalid dates
  const rowInvalidDate = projectOrderToContractRow(
    { ...sampleOrder, createdAt: "INVALID" },
    { ...sampleInvoice, tanggal: "INVALID" }
  );
  assert.strictEqual(rowInvalidDate["Tanggal Invoice"], "-");
});
