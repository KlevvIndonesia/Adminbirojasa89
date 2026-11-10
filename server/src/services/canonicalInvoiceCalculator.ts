/**
 * Canonical Invoice Calculator
 * 
 * Single Source of Truth (SSoT) for financial calculations across SUN89 backend:
 * - Invoice totals (totalTagihan)
 * - Verified payment totals (dibayar / terbayar)
 * - Pending payment totals (pendingPaid)
 * - Outstanding balance (sisa)
 * - Overpayment amount (overpayment)
 * - Invoice payment status (status)
 * - Settlement condition (settlementCondition)
 * - Revenue recognition & Gross profit calculation
 * 
 * Rules enforced:
 * 1. Strict composite scoping: Payments must match both invoice_no and order_no.
 * 2. Strict verification filter: Only status_verifikasi = 'TERVERIFIKASI' qualifies as verified money.
 * 3. Pending payments (MENUNGGU_VERIFIKASI / MENUNGGU_BUKTI) are tracked separately and NEVER count as received money.
 * 4. Void payments (is_void = 1 / VOID) are quarantined and excluded from active financial totals.
 * 5. Payment event deduplication: Identical payment events (same kas_kantor_id > 0, same non-null idempotency_key) are counted once.
 * 6. Integer rupiah arithmetic: Math.round applied to eliminate floating-point precision artifacts.
 * 7. Non-negative balances: sisa is Math.max(0, totalTagihan - verifiedPaid), overpayment is Math.max(0, verifiedPaid - totalTagihan).
 */

export interface CanonicalPaymentRecord {
  id?: number;
  invoice_no?: string;
  order_no?: string;
  nominal: number;
  metode_pembayaran?: string;
  status_verifikasi?: string;
  is_void?: number | boolean;
  tanggal_bayar?: string;
  kas_kantor_id?: number | null;
  idempotency_key?: string | null;
  document_id?: string | null;
  [key: string]: any;
}

export interface CanonicalInvoiceCalculationInput {
  invoiceNo: string;
  orderNo: string;
  totalTagihan: number;
  biayaSamsat?: number;
  isExplicitZero?: boolean;
  basePaid?: number;
  payments?: CanonicalPaymentRecord[];
}

export interface CanonicalInvoiceCalculationResult {
  invoiceNo: string;
  orderNo: string;
  totalTagihan: number;
  verifiedPaid: number;
  pendingPaid: number;
  sisaTagihan: number;
  overpayment: number;
  status: "PAID" | "UNPAID" | "PARTIAL" | "OVERPAID";
  settlementCondition: "BALANCED" | "UNDERPAID" | "OVERPAID";
  recognizedRevenue: number;
  biayaSamsat: number;
  matchedCOGS: number;
  grossProfit: number;
  profitStatus: string;
  eligibleVerifiedPayments: CanonicalPaymentRecord[];
  eligiblePendingPayments: CanonicalPaymentRecord[];
  allActivePayments: CanonicalPaymentRecord[];
  quarantinedPayments: { payment: CanonicalPaymentRecord; reason: string }[];
}

/**
 * Filter and partition payments strictly by invoice and order identity.
 */
export function partitionInvoicePayments(
  payments: CanonicalPaymentRecord[] = [],
  invoiceNo: string,
  orderNo: string
): {
  verified: CanonicalPaymentRecord[];
  pending: CanonicalPaymentRecord[];
  quarantined: { payment: CanonicalPaymentRecord; reason: string }[];
} {
  const normInv = (invoiceNo || "").trim().toUpperCase();
  const normOrd = (orderNo || "").trim().toUpperCase();

  const verified: CanonicalPaymentRecord[] = [];
  const pending: CanonicalPaymentRecord[] = [];
  const quarantined: { payment: CanonicalPaymentRecord; reason: string }[] = [];

  const seenKasIds = new Set<number>();
  const seenIdempotencyKeys = new Set<string>();

  for (const p of payments) {
    const pInv = (p.invoice_no || "").trim().toUpperCase();
    const pOrd = (p.order_no || "").trim().toUpperCase();

    // 1. Cross-Order Isolation Guard (GAP-FIN-01):
    // Order number MUST match the invoice's order number.
    if (normOrd && pOrd && pOrd !== normOrd) {
      quarantined.push({
        payment: p,
        reason: `CROSS_ORDER_MISMATCH: Payment belongs to order '${pOrd}', but target invoice is for order '${normOrd}'.`,
      });
      continue;
    }

    // If payment has an explicit invoice_no, it must match the target invoice
    if (normInv && pInv && pInv !== normInv) {
      quarantined.push({
        payment: p,
        reason: `INVOICE_NUMBER_MISMATCH: Payment references invoice '${pInv}', but target invoice is '${normInv}'.`,
      });
      continue;
    }

    // 2. Void Isolation Guard:
    const isVoid = Boolean(p.is_void === 1 || p.is_void === true || p.status_verifikasi === "VOID");
    if (isVoid) {
      quarantined.push({
        payment: p,
        reason: "PAYMENT_VOID: Payment is marked as void.",
      });
      continue;
    }

    // 3. Payment Event Deduplication Guard:
    // If multiple records share the same kas_kantor_id (> 0), only the first instance is counted.
    if (p.kas_kantor_id && typeof p.kas_kantor_id === "number" && p.kas_kantor_id > 0) {
      if (seenKasIds.has(p.kas_kantor_id)) {
        quarantined.push({
          payment: p,
          reason: `DUPLICATE_KAS_LEDGER_EVENT: Payment shares kas_kantor_id ${p.kas_kantor_id} with another record.`,
        });
        continue;
      }
      seenKasIds.add(p.kas_kantor_id);
    }

    // If multiple records share the same idempotency_key, only the first is counted.
    if (p.idempotency_key && typeof p.idempotency_key === "string" && p.idempotency_key.trim()) {
      const cleanKey = p.idempotency_key.trim();
      if (seenIdempotencyKeys.has(cleanKey)) {
        quarantined.push({
          payment: p,
          reason: `DUPLICATE_IDEMPOTENCY_KEY: Payment shares idempotency_key '${cleanKey}'.`,
        });
        continue;
      }
      seenIdempotencyKeys.add(cleanKey);
    }

    // 4. Status Verification Partitioning:
    const status = (p.status_verifikasi || "").trim().toUpperCase();
    if (status === "TERVERIFIKASI") {
      verified.push(p);
    } else if (status === "MENUNGGU_VERIFIKASI" || status === "MENUNGGU_BUKTI" || status === "TERCATAT") {
      pending.push(p);
    } else {
      quarantined.push({
        payment: p,
        reason: `UNRECOGNIZED_STATUS: Payment status '${p.status_verifikasi}' is not eligible for active calculations.`,
      });
    }
  }

  return { verified, pending, quarantined };
}

/**
 * Execute canonical invoice calculation.
 */
export function calculateCanonicalInvoiceTotals(
  input: CanonicalInvoiceCalculationInput
): CanonicalInvoiceCalculationResult {
  const normInv = (input.invoiceNo || "").trim();
  const normOrd = (input.orderNo || "").trim();
  const totalTagihan = Math.max(0, Math.round(Number(input.totalTagihan || 0)));
  const biayaSamsat = Math.max(0, Math.round(Number(input.biayaSamsat || 0)));
  const isExplicitZero = Boolean(input.isExplicitZero);
  const basePaid = Math.max(0, Math.round(Number(input.basePaid || 0)));

  // Partition payments strictly
  const { verified, pending, quarantined } = partitionInvoicePayments(
    input.payments || [],
    normInv,
    normOrd
  );

  // Sum verified and pending payments using integer arithmetic
  let verifiedPaidFromPayments = 0;
  for (const p of verified) {
    const nom = Math.round(Number(p.nominal || 0));
    if (nom > 0) verifiedPaidFromPayments += nom;
  }

  let pendingPaid = 0;
  for (const p of pending) {
    const nom = Math.round(Number(p.nominal || 0));
    if (nom > 0) pendingPaid += nom;
  }

  // Canonical paid resolution:
  // If verified payments exist in invoice_payments, they represent the single source of truth.
  // If invoice_payments has no verified records for this invoice yet, fallback to basePaid from static invoice row.
  const verifiedPaid = verified.length > 0 ? verifiedPaidFromPayments : basePaid;

  // Outstanding balance (sisa) and overpayment
  const sisaTagihan = Math.max(0, totalTagihan - verifiedPaid);
  const overpayment = Math.max(0, verifiedPaid - totalTagihan);

  // Status calculation
  let status: "PAID" | "UNPAID" | "PARTIAL" | "OVERPAID" = "UNPAID";
  let settlementCondition: "BALANCED" | "UNDERPAID" | "OVERPAID" = "UNDERPAID";

  if (overpayment > 0) {
    status = "OVERPAID";
    settlementCondition = "OVERPAID";
  } else if (sisaTagihan === 0 && (totalTagihan > 0 || isExplicitZero)) {
    status = "PAID";
    settlementCondition = "BALANCED";
  } else if (verifiedPaid > 0) {
    status = "PARTIAL";
    settlementCondition = "UNDERPAID";
  } else {
    status = "UNPAID";
    settlementCondition = "UNDERPAID";
  }

  // Revenue recognition & Gross Profit (Proportional COGS matching)
  // Revenue is capped strictly at totalTagihan; overpayment is custodial liability
  const recognizedRevenue = isExplicitZero ? 0 : Math.min(verifiedPaid, totalTagihan);
  const isCostAnomaly = totalTagihan > 0 && biayaSamsat > totalTagihan;
  const alpha = totalTagihan > 0 ? biayaSamsat / totalTagihan : 0;
  const matchedCOGS = Math.min(biayaSamsat, Math.round(alpha * recognizedRevenue));
  const grossProfit = isCostAnomaly ? 0 : Math.max(0, recognizedRevenue - matchedCOGS);

  let profitStatus = "PENDING";
  if (isCostAnomaly) {
    profitStatus = "HOLD_ANOMALY";
  } else if ((sisaTagihan === 0 || overpayment > 0) && (totalTagihan > 0 || isExplicitZero)) {
    profitStatus = "REALIZED";
  } else {
    profitStatus = "PENDING";
  }

  const allActivePayments = [...verified, ...pending];

  return {
    invoiceNo: normInv,
    orderNo: normOrd,
    totalTagihan,
    verifiedPaid,
    pendingPaid,
    sisaTagihan,
    overpayment,
    status,
    settlementCondition,
    recognizedRevenue,
    biayaSamsat,
    matchedCOGS,
    grossProfit,
    profitStatus,
    eligibleVerifiedPayments: verified,
    eligiblePendingPayments: pending,
    allActivePayments,
    quarantinedPayments: quarantined,
  };
}
