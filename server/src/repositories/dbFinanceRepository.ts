/**
 * SQLite Finance Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";
import { ApiError } from "../middleware/errorHandler";
import { isValidCanonicalPaymentId, formatScopedIdempotencyKey } from "../utils/canonicalHasher";
import { InvoiceBillingRecord, KasKantorItem, PengeluaranItem, KasMessengerItem, CostClassificationType } from "../../../src/domain/finance/types";
import { computeCanonicalLabaRugi, CanonicalLabaRugiSummary } from "../../../src/domain/finance/labaRugiCanonical";
import { calculateCanonicalInvoiceTotals } from "../services/canonicalInvoiceCalculator";

export class DbFinanceRepository {
  private mapRowToInvoice(r: any): InvoiceBillingRecord {
    let parsed: any = {};
    try {
      parsed = JSON.parse(r.data_json || "{}");
    } catch {}

    const totalTagihan = Number(r.total_tagihan ?? parsed.totalTagihan ?? 0);
    const dibayar = Number(r.dibayar ?? parsed.dibayar ?? parsed.terbayar ?? 0);
    const sisa = Number(r.sisa ?? Math.max(0, totalTagihan - dibayar));
    const biayaSamsat = Number((r.biaya_samsat !== null && r.biaya_samsat !== undefined && Number(r.biaya_samsat) !== 0) ? r.biaya_samsat : (parsed.biayaSamsat || parsed.biaya_samsat || r.biaya_samsat || 0));
    const pendapatanJasa = Number(r.pendapatan_jasa ?? Math.max(0, totalTagihan - biayaSamsat));
    const overpayment = Number(r.overpayment ?? parsed.overpayment ?? 0);
    const cashback = Number(r.cashback_nominal ?? parsed.cashback ?? 0);
    const profit = Number(r.profit_final ?? parsed.profit ?? 0);
    const serviceId = r.service_id !== null && r.service_id !== undefined ? String(r.service_id) : (parsed.serviceId || parsed.service_id || undefined);
    const costVerificationStatus = r.cost_verification_status !== null && r.cost_verification_status !== undefined
      ? String(r.cost_verification_status)
      : String(parsed.costVerificationStatus || (parsed.cost_verification_status) || "VERIFIED");
    const isDraftEstimate = r.is_draft_estimate !== null && r.is_draft_estimate !== undefined
      ? Boolean(r.is_draft_estimate)
      : Boolean(parsed.isDraftEstimate ?? (parsed.is_draft_estimate) ?? false);
    const isExplicitZero = r.is_explicit_zero !== null && r.is_explicit_zero !== undefined ? Boolean(r.is_explicit_zero) : Boolean(parsed.isExplicitZero || parsed.is_explicit_zero || parsed.isZeroCostPromotion);
    const tanggal = parsed.tanggal || (r.created_at ? String(r.created_at).split("T")[0].split(" ")[0] : new Date().toISOString().split("T")[0]);
    const costClassification: CostClassificationType = parsed.costClassification || (
      costVerificationStatus === "VERIFIED"
        ? (biayaSamsat === 0 && isExplicitZero ? "EXPLICIT_ZERO" : "ACTUAL_COST")
        : (biayaSamsat === 0 && !isExplicitZero
            ? "UNCONFIGURED"
            : (biayaSamsat === 0 && isExplicitZero ? "EXPLICIT_ZERO" : "ESTIMATED_COST"))
    );

    return {
      ...parsed,
      id: r.id,
      tanggal,
      invoice: r.invoice_no,
      invoiceNo: r.invoice_no,
      orderNo: r.order_no,
      customer: r.customer,
      layanan: r.layanan,
      serviceId,
      service_id: serviceId,
      status: r.status as any,
      totalTagihan,
      total_tagihan: totalTagihan,
      dibayar,
      terbayar: dibayar,
      sisa,
      biayaSamsat,
      biaya_samsat: biayaSamsat,
      pendapatanJasa,
      pendapatan_jasa: pendapatanJasa,
      overpayment,
      settlementCondition: r.settlement_condition ?? parsed.settlementCondition ?? (dibayar >= totalTagihan ? "BALANCED" : "UNDERPAID"),
      refundStatus: r.refund_status ?? parsed.refundStatus ?? "NONE",
      cashback,
      cashbackStatus: r.cashback_status ?? parsed.cashbackStatus ?? "PENDING",
      profit,
      profitStatus: r.profit_status ?? parsed.profitStatus ?? "PENDING",
      alasan_pending: r.alasan_pending ?? parsed.alasan_pending ?? parsed.alasan ?? null,
      alasan: r.alasan_pending ?? parsed.alasan_pending ?? parsed.alasan ?? null,
      costVerificationStatus,
      cost_verification_status: costVerificationStatus,
      isDraftEstimate,
      is_draft_estimate: isDraftEstimate ? 1 : 0,
      costClassification,
      isExplicitZero,
      payoutHistory: parsed.payoutHistory || [],
      refundLiability: parsed.refundLiability !== undefined ? Number(parsed.refundLiability) : overpayment,
      refundedAmount: parsed.refundedAmount !== undefined ? Number(parsed.refundedAmount) : (r.refund_status === "PROCESSED" ? overpayment : 0),
      remainingRefund: parsed.remainingRefund !== undefined ? Number(parsed.remainingRefund) : (r.refund_status === "PROCESSED" ? 0 : overpayment),
      cashbackPaidAmount: parsed.cashbackPaidAmount !== undefined ? Number(parsed.cashbackPaidAmount) : 0,
    };
  }

  /**
   * Enriches an invoice record with canonical financial calculations (GAP-FIN-05).
   * Ensures getInvoiceById, getInvoiceByOrderNo, and getInvoiceByNo produce
   * 100% consistent totals, balances, and statuses with getAllInvoices.
   */
  private enrichInvoiceWithCanonicalCalculation(inv: InvoiceBillingRecord): InvoiceBillingRecord {
    try {
      const orderNo = (inv.orderNo || "").trim();
      const invoiceNo = (inv.invoiceNo || inv.invoice || "").trim();
      const payments = this.getPaymentsByOrderNo(orderNo);
      const calc = calculateCanonicalInvoiceTotals({
        invoiceNo,
        orderNo,
        totalTagihan: inv.totalTagihan,
        biayaSamsat: inv.biayaSamsat,
        isExplicitZero: Boolean(inv.isExplicitZero),
        basePaid: Number(inv.dibayar ?? inv.terbayar ?? 0),
        payments,
      });

      inv.dibayar = calc.verifiedPaid;
      inv.terbayar = calc.verifiedPaid;
      inv.sisa = calc.sisaTagihan;
      (inv as any).overpayment = calc.overpayment;
      inv.status = calc.status as any;
      (inv as any).settlementCondition = calc.settlementCondition;
      inv.profit = calc.grossProfit;
      inv.profitStatus = calc.profitStatus as any;
      inv.riwayatPembayaran = calc.allActivePayments;

      const lastVerified = calc.eligibleVerifiedPayments[calc.eligibleVerifiedPayments.length - 1] || calc.allActivePayments[calc.allActivePayments.length - 1];
      if (lastVerified) {
        inv.bank = lastVerified.nama_bank || inv.bank;
        inv.metodePembayaran = lastVerified.metode_pembayaran || inv.metodePembayaran;
        (inv as any).tanggalBayar = lastVerified.tanggal_bayar;
        (inv as any).nomorRekening = lastVerified.nomor_rekening;
      }
    } catch {
      // Non-fatal if table not initialized
    }
    return inv;
  }

  public getAllInvoices(): InvoiceBillingRecord[] {
    const stmt = db.prepare("SELECT * FROM finance_invoices ORDER BY id DESC");
    const rows = stmt.all() as any[];

    // Index all active non-void payments by order_no to guarantee strict order isolation (GAP-FIN-01)
    const paymentsByOrder = new Map<string, any[]>();
    try {
      const paymentsStmt = db.prepare("SELECT * FROM invoice_payments WHERE is_void = 0 ORDER BY id ASC");
      const allPayments = paymentsStmt.all() as any[];
      for (const p of allPayments) {
        const ordKey = (p.order_no || "").trim().toUpperCase();
        if (ordKey) {
          if (!paymentsByOrder.has(ordKey)) paymentsByOrder.set(ordKey, []);
          paymentsByOrder.get(ordKey)!.push(p);
        }
      }
    } catch {
      // Non-fatal if table not yet initialized in tests
    }

    return rows.map((r) => {
      const inv = this.mapRowToInvoice(r);
      const ordKey = (r.order_no || "").trim().toUpperCase();
      const rawPayments = paymentsByOrder.get(ordKey) || [];

      // Use shared canonical calculator (GAP-FIN-05)
      const calc = calculateCanonicalInvoiceTotals({
        invoiceNo: (r.invoice_no || "").trim(),
        orderNo: (r.order_no || "").trim(),
        totalTagihan: inv.totalTagihan,
        biayaSamsat: inv.biayaSamsat,
        isExplicitZero: Boolean(r.is_explicit_zero || (inv as any).isExplicitZero),
        basePaid: Number(inv.dibayar ?? inv.terbayar ?? 0),
        payments: rawPayments,
      });

      inv.dibayar = calc.verifiedPaid;
      inv.terbayar = calc.verifiedPaid;
      inv.sisa = calc.sisaTagihan;
      (inv as any).overpayment = calc.overpayment;
      inv.status = calc.status as any;
      (inv as any).settlementCondition = calc.settlementCondition;
      inv.profit = calc.grossProfit;
      inv.profitStatus = calc.profitStatus as any;
      inv.riwayatPembayaran = calc.allActivePayments;

      const lastVerified = calc.eligibleVerifiedPayments[calc.eligibleVerifiedPayments.length - 1] || calc.allActivePayments[calc.allActivePayments.length - 1];
      if (lastVerified) {
        inv.bank = lastVerified.nama_bank || inv.bank;
        inv.metodePembayaran = lastVerified.metode_pembayaran || inv.metodePembayaran;
        (inv as any).tanggalBayar = lastVerified.tanggal_bayar;
        (inv as any).nomorRekening = lastVerified.nomor_rekening;
      }

      return inv;
    });
  }

  public isQuarantinedInvoice(inv: any): boolean {
    const invoiceNo = String(inv.invoiceNo || inv.invoice || "").trim().toUpperCase();
    const orderNo = String(inv.orderNo || "").trim().toUpperCase();
    const totalTagihan = Number(inv.totalTagihan ?? inv.total_tagihan ?? 0);
    return invoiceNo === "INV-1026-080" || orderNo === "ORD-1026-080" || totalTagihan >= 5000000000;
  }

  public getProfitList(): any[] {
    const invoices = this.getAllInvoices();
    return invoices
      .filter((inv) => !this.isQuarantinedInvoice(inv))
      .map((inv, idx) => {
        const total = Number(inv.totalTagihan ?? (inv as any).total_tagihan ?? 0);
        const paid = Number(inv.dibayar ?? (inv as any).terbayar ?? 0);
        const eligiblePayment = Math.min(paid, total);
        const overpayment = Math.max(0, paid - total);
        const rawBiayaSamsat = Number(inv.biayaSamsat ?? (inv as any).biaya_samsat ?? 0);

        const isExplicitZero = Boolean(
          inv.isExplicitZero ||
          (inv as any).is_explicit_zero ||
          (inv as any).isZeroCostPromotion ||
          (rawBiayaSamsat === 0 && (inv.costClassification === "EXPLICIT_ZERO" || inv.costClassification === "DEFINITIVE"))
        );

        const costVerificationStatus = String(
          inv.costVerificationStatus || (inv as any).cost_verification_status || ((inv as any).isCostVerified ? "VERIFIED" : "VERIFIED")
        );

        let costClassification = inv.costClassification;
        if (!costClassification) {
          if (isExplicitZero) {
            costClassification = "DEFINITIVE";
          } else if (rawBiayaSamsat === 0) {
            costClassification = "UNCONFIGURED";
          } else if (costVerificationStatus === "VERIFIED" || costVerificationStatus === "DEFINITIVE") {
            costClassification = "DEFINITIVE";
          } else {
            costClassification = "ESTIMATED";
          }
        } else if (costClassification === "ACTUAL_COST" || costClassification === "EXPLICIT_ZERO") {
          costClassification = "DEFINITIVE";
        } else if (costClassification === "ESTIMATED_COST") {
          costClassification = "ESTIMATED";
        }

        const isAnomaly = total > 0 && rawBiayaSamsat > total;
        const isCostPending = !isAnomaly && (costClassification === "UNCONFIGURED" || costClassification === "ESTIMATED");

        let matchedCOGS = 0;
        let profit = 0;
        let holdStatus = "NONE";
        let anomalyReason = "";

        if (isAnomaly) {
          holdStatus = "HOLD_ANOMALY";
          anomalyReason = "BIAYA_SAMSAT_MELEBIHI_TAGIHAN";
          profit = 0;
          matchedCOGS = 0;
        } else if (isCostPending) {
          holdStatus = "HOLD_COST_PENDING";
          profit = 0;
          matchedCOGS = 0;
        } else if (isExplicitZero) {
          profit = eligiblePayment;
          matchedCOGS = 0;
        } else if (total > 0 && rawBiayaSamsat <= total) {
          // Phase C Canonical Proportional Matching Formula
          const alpha = rawBiayaSamsat / total;
          matchedCOGS = Math.min(rawBiayaSamsat, Math.round(alpha * eligiblePayment));
          profit = Math.max(0, eligiblePayment - matchedCOGS);
        }

        const bankName = inv.bank || (inv as any).namaBank || ((inv as any).rekening && (inv as any).rekening !== "Cash" ? (inv as any).rekening : "BCA");
        const isCash = String(inv.metodePembayaran || "").toLowerCase().includes("cash") || String(inv.bank || "").toLowerCase().includes("cash");
        const metodePencairan = isCash ? "Cash" : "Transfer Bank";

        return {
          id: idx + 1,
          tanggal: inv.tanggal || ((inv as any).created_at ? String((inv as any).created_at).split("T")[0].split(" ")[0] : new Date().toISOString().split("T")[0]),
          tanggalUangMasuk: paid > 0 ? ((inv as any).tanggalBayar || (inv as any).tanggalUangMasuk || inv.tanggal) : "",
          customer: inv.customer,
          nopol: inv.nopol,
          pengurusan: inv.jenisLayanan || inv.layanan,
          uangMasuk: paid,
          totalTagihan: total,
          eligiblePayment,
          overpayment,
          biayaSamsat: rawBiayaSamsat,
          matchedCOGS,
          profit,
          grossProfit: profit,
          pendapatanJasa: profit,
          labaKotor: profit,
          namaBerkas: (inv as any).namaBerkas || inv.customer,
          rekening: isCash ? "Cash" : bankName,
          metodePencairan,
          metodePembayaran: inv.metodePembayaran || (isCash ? "Cash" : "Transfer Bank"),
          namaBank: isCash ? "" : bankName,
          nomorRekening: (inv as any).nomorRekening || (inv as any).noRekening || (isCash ? "" : "772-019-2831"),
          namaPemilikRekening: (inv as any).namaPemilikRekening || (inv as any).namaRekening || "PT Biro Jasa SUN89 Abadi",
          tanggalTTB: inv.tanggal,
          ttb: (inv as any).ttb || "-",
          status: inv.status,
          invoice: inv.invoice || inv.invoiceNo || "-",
          isExplicitZero,
          costClassification,
          isFinancialAnomaly: isAnomaly,
          anomalyReason,
          holdStatus,
        };
      });
  }

  public getCanonicalLabaRugiSummary(
    periodFilter: string = "monthly",
    customStartDate?: string,
    customEndDate?: string
  ): CanonicalLabaRugiSummary {
    const invoices = this.getAllInvoices();
    const kasKantor = this.getAllKasKantor();
    const kasMessenger = this.getAllKasMessenger();
    const pengeluaran = this.getAllPengeluaran();

    return computeCanonicalLabaRugi(
      invoices,
      pengeluaran,
      kasMessenger,
      periodFilter,
      undefined,
      customStartDate,
      customEndDate,
      kasKantor
    );
  }

  public getInvoiceById(id: number): InvoiceBillingRecord | undefined {
    const stmt = db.prepare("SELECT * FROM finance_invoices WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return this.enrichInvoiceWithCanonicalCalculation(this.mapRowToInvoice(row));
  }

  public getInvoiceByOrderNo(orderNo: string): InvoiceBillingRecord | undefined {
    const cleanNo = (orderNo || "").trim().toUpperCase();
    const stmt = db.prepare("SELECT * FROM finance_invoices WHERE UPPER(order_no) = ? OR order_no = ?");
    const row = stmt.get(cleanNo, orderNo) as any;
    if (!row) return undefined;
    return this.enrichInvoiceWithCanonicalCalculation(this.mapRowToInvoice(row));
  }

  public getInvoiceByNo(invoiceNo: string): InvoiceBillingRecord | undefined {
    const stmt = db.prepare("SELECT * FROM finance_invoices WHERE invoice_no = ?");
    const row = stmt.get(invoiceNo) as any;
    if (!row) return undefined;
    return this.enrichInvoiceWithCanonicalCalculation(this.mapRowToInvoice(row));
  }

  public saveInvoice(invoice: Partial<InvoiceBillingRecord> & { invoiceNo: string; orderNo: string }): number {
    const existingByNo = this.getInvoiceByNo(invoice.invoiceNo);
    const existingByOrder = this.getInvoiceByOrderNo(invoice.orderNo);

    // [GAP-FIN-02 & DEF-FIN-001 REMEDIATION]: Anti-hijacking & Bi-directional Relational Validation
    // 1. If an invoice with this invoiceNo already exists, it MUST belong to the same order.
    if (existingByNo && existingByNo.orderNo && existingByNo.orderNo.trim().toUpperCase() !== invoice.orderNo.trim().toUpperCase()) {
      throw new Error(
        `[FINANCE_INVOICE_COLLISION] Nomor invoice '${invoice.invoiceNo}' sudah terdaftar untuk pesanan '${existingByNo.orderNo}'. Tidak dapat digunakan untuk pesanan '${invoice.orderNo}'.`
      );
    }

    // 2. If an order already has an active invoice, prevent silent renumbering to a different invoiceNo.
    const activeInvNo = existingByOrder ? (existingByOrder.invoiceNo || existingByOrder.invoice) : undefined;
    if (existingByOrder && activeInvNo && activeInvNo.trim().toUpperCase() !== invoice.invoiceNo.trim().toUpperCase()) {
      throw new Error(
        `[RELATIONAL_INTEGRITY_VIOLATION] Pesanan '${invoice.orderNo}' sudah memiliki invoice terdaftar '${activeInvNo}'. Perubahan nomor invoice ke '${invoice.invoiceNo}' tidak diizinkan tanpa prosedur migrasi formal.`
      );
    }

    const existing = existingByOrder || existingByNo;
    const biayaSamsat = Number(invoice.biayaSamsat ?? (existing as any)?.biayaSamsat ?? 0);
    const totalTagihan = Number(invoice.totalTagihan ?? (existing as any)?.totalTagihan ?? 0);
    const dibayar = Number(invoice.dibayar ?? invoice.terbayar ?? (existing as any)?.dibayar ?? 0);
    const sisa = Number(invoice.sisa ?? Math.max(0, totalTagihan - dibayar));
    const pendapatanJasa = Math.max(0, totalTagihan - biayaSamsat);
    const overpayment = Number(
      invoice.overpayment !== undefined
        ? invoice.overpayment
        : ((existing as any)?.overpayment !== undefined && dibayar === Number((existing as any)?.dibayar)
            ? (existing as any).overpayment
            : Math.max(0, dibayar - totalTagihan))
    );
    const settlementCondition = (
      invoice.settlementCondition ||
      (overpayment > 0 ? "OVERPAID" : (dibayar >= totalTagihan && totalTagihan > 0 ? "BALANCED" : "UNDERPAID"))
    ) as string;
    const refundStatus = (
      invoice.refundStatus ||
      (existing as any)?.refundStatus ||
      (overpayment > 0 ? "PENDING" : "NONE")
    ) as string;
    const cashbackNominal = Number(invoice.cashback ?? (existing as any)?.cashback ?? 0);
    const cashbackStatus = (invoice.cashbackStatus || (existing as any)?.cashbackStatus || (cashbackNominal > 0 ? "PENDING" : "APPROVED")) as string;
    
    // Phase C Canonical Proportional Matching Formula
    const recognizedRevenue = Math.min(dibayar, totalTagihan);
    const isAnomaly = totalTagihan > 0 && biayaSamsat > totalTagihan;
    const alpha = totalTagihan > 0 ? (biayaSamsat / totalTagihan) : 0;
    const matchedCOGS = Math.min(biayaSamsat, Math.round(alpha * recognizedRevenue));
    const maxProfit = isAnomaly ? 0 : Math.max(0, recognizedRevenue - matchedCOGS);
    const profitFinal = isAnomaly
      ? 0
      : (invoice.profit !== undefined
          ? Math.min(Number(invoice.profit), maxProfit)
          : ((existing as any)?.profit !== undefined ? Math.min(Number((existing as any)?.profit), maxProfit) : maxProfit));
    const profitStatus = (invoice.profitStatus || (existing as any)?.profitStatus || (isAnomaly ? "HOLD_ANOMALY" : (((sisa === 0 || overpayment > 0) && totalTagihan > 0) ? "REALIZED" : "PENDING"))) as string;
    const biayaJasa = Number((invoice as any).biayaJasa ?? (existing as any)?.biayaJasa ?? 0);
    const biayaAntarJemput = Number((invoice as any).biayaAntarJemput ?? (existing as any)?.biayaAntarJemput ?? 0);
    const namaPenerimaKeluar = (invoice as any).namaPenerimaKeluar || (existing as any)?.namaPenerimaKeluar || null;
    const alasanPending = (invoice as any).alasan_pending || (invoice as any).alasan || (existing as any)?.alasan_pending || (existing as any)?.alasan || null;
    const serviceId = (invoice as any).serviceId || (invoice as any).service_id || (existing as any)?.serviceId || (existing as any)?.service_id || null;
    const costVerificationStatus = (invoice as any).costVerificationStatus || (invoice as any).cost_verification_status || (existing as any)?.costVerificationStatus || (existing as any)?.cost_verification_status || "VERIFIED";
    const isExplicitZero = (invoice as any).isExplicitZero !== undefined
      ? ((invoice as any).isExplicitZero ? 1 : 0)
      : ((invoice as any).is_explicit_zero !== undefined
          ? ((invoice as any).is_explicit_zero ? 1 : 0)
          : ((invoice as any).isZeroCostPromotion ? 1 : ((existing as any)?.isExplicitZero ? 1 : 0)));
    const isDraftEstimate = (invoice as any).isDraftEstimate !== undefined
      ? ((invoice as any).isDraftEstimate ? 1 : 0)
      : ((invoice as any).is_draft_estimate !== undefined
          ? ((invoice as any).is_draft_estimate ? 1 : 0)
          : ((existing as any)?.isDraftEstimate ? 1 : 0));

    if (existing) {
      const merged: InvoiceBillingRecord = {
        ...existing,
        ...invoice,
        costVerificationStatus,
        cost_verification_status: costVerificationStatus,
        isDraftEstimate: Boolean(isDraftEstimate),
        is_draft_estimate: isDraftEstimate,
        serviceId: serviceId || undefined,
        service_id: serviceId || undefined
      } as any;
      const stmt = db.prepare(`
        UPDATE finance_invoices SET
          invoice_no = ?,
          order_no = ?,
          customer = ?,
          layanan = ?,
          status = ?,
          total_tagihan = ?,
          dibayar = ?,
          sisa = ?,
          biaya_samsat = ?,
          pendapatan_jasa = ?,
          overpayment = ?,
          settlement_condition = ?,
          refund_status = ?,
          cashback_nominal = ?,
          cashback_status = ?,
          profit_final = ?,
          profit_status = ?,
          biaya_jasa = ?,
          biaya_antar_jemput = ?,
          nama_penerima_keluar = ?,
          alasan_pending = ?,
          cost_verification_status = ?,
          is_draft_estimate = ?,
          is_explicit_zero = ?,
          data_json = ?,
          service_id = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(
        merged.invoiceNo || invoice.invoiceNo,
        merged.orderNo || invoice.orderNo,
        merged.customer || "",
        merged.layanan || "",
        merged.status || "UNPAID",
        totalTagihan,
        dibayar,
        sisa,
        biayaSamsat,
        pendapatanJasa,
        overpayment,
        settlementCondition,
        refundStatus,
        cashbackNominal,
        cashbackStatus,
        profitFinal,
        profitStatus,
        biayaJasa,
        biayaAntarJemput,
        namaPenerimaKeluar ?? null,
        alasanPending ?? null,
        costVerificationStatus,
        isDraftEstimate,
        isExplicitZero,
        JSON.stringify(merged),
        serviceId ?? null,
        existing.id
      );
      return existing.id;
    }

    const invoiceWithFlags = {
      ...invoice,
      costVerificationStatus,
      cost_verification_status: costVerificationStatus,
      isDraftEstimate: Boolean(isDraftEstimate),
      is_draft_estimate: isDraftEstimate,
    };
    const stmt = db.prepare(`
      INSERT INTO finance_invoices (
        invoice_no, order_no, customer, layanan, status,
        total_tagihan, dibayar, sisa, biaya_samsat, pendapatan_jasa,
        overpayment, settlement_condition, refund_status,
        cashback_nominal, cashback_status, profit_final, profit_status,
        biaya_jasa, biaya_antar_jemput, nama_penerima_keluar,
        alasan_pending, cost_verification_status, is_draft_estimate, is_explicit_zero, data_json, service_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const res = stmt.run(
      invoice.invoiceNo,
      invoice.orderNo,
      invoice.customer || "",
      invoice.layanan || "",
      invoice.status || "UNPAID",
      totalTagihan,
      dibayar,
      sisa,
      biayaSamsat,
      pendapatanJasa,
      overpayment,
      settlementCondition,
      refundStatus,
      cashbackNominal,
      cashbackStatus,
      profitFinal,
      profitStatus,
      biayaJasa,
      biayaAntarJemput,
      namaPenerimaKeluar,
      alasanPending,
      costVerificationStatus,
      isDraftEstimate,
      isExplicitZero,
      JSON.stringify(invoiceWithFlags),
      serviceId
    );

    const insertedId = Number(res.lastInsertRowid);
    const completeRecord = { ...invoice, id: insertedId };
    db.prepare("UPDATE finance_invoices SET data_json = ? WHERE id = ?").run(
      JSON.stringify(completeRecord),
      insertedId
    );
    return insertedId;
  }

  public updateInvoice(id: number, updates: Partial<InvoiceBillingRecord>): boolean {
    const existing = this.getInvoiceById(id);
    if (!existing) return false;

    const resolvedStatus = updates.status || (updates as any).billingStatus || existing.status;
    const merged: InvoiceBillingRecord = {
      ...existing,
      ...updates,
      status: resolvedStatus,
      billingStatus: resolvedStatus === "CANCELLED" ? ("CANCELLED" as any) : ((updates as any).billingStatus || existing.billingStatus || resolvedStatus),
    };
    const totalTagihan = Number(merged.totalTagihan || 0);
    const dibayar = Number(merged.dibayar ?? merged.terbayar ?? 0);
    const sisa = Number(merged.sisa ?? Math.max(0, totalTagihan - dibayar));
    const biayaSamsat = Number(merged.biayaSamsat || 0);
    const pendapatanJasa = Math.max(0, totalTagihan - biayaSamsat);
    const overpayment = Number(
      updates.overpayment !== undefined
        ? updates.overpayment
        : (merged.overpayment !== undefined ? merged.overpayment : Math.max(0, dibayar - totalTagihan))
    );
    const settlementCondition = (
      updates.settlementCondition ||
      (overpayment > 0 ? "OVERPAID" : (dibayar >= totalTagihan && totalTagihan > 0 ? "BALANCED" : "UNDERPAID"))
    ) as string;
    const refundStatus = (
      updates.refundStatus ||
      existing.refundStatus ||
      (overpayment > 0 ? "PENDING" : (merged.refundStatus || "NONE"))
    ) as string;
    const cashbackNominal = Number(merged.cashback || 0);
    const cashbackStatus = (merged.cashbackStatus || (cashbackNominal > 0 ? "PENDING" : "APPROVED")) as string;

    // Profit must strictly exclude overpayment / trust funds (capped at recognized revenue)
    const recognizedRevenue = Math.min(dibayar, totalTagihan);
    const maxProfit = Math.max(0, recognizedRevenue - biayaSamsat);
    const profitFinal = updates.profit !== undefined
      ? Math.min(Number(updates.profit), maxProfit)
      : (merged.profit !== undefined ? Math.min(Number(merged.profit), maxProfit) : maxProfit);
    const profitStatus = (updates.profitStatus || (updates as any).profit_status || (updates.billingStatus === "COMPLETED" ? "REALIZED" : (existing.profitStatus || "PENDING"))) as string;
    const alasanPending = (updates as any).alasan_pending || (updates as any).alasan || (existing as any).alasan_pending || (existing as any).alasan || null;
    const serviceId = (updates as any).serviceId || (updates as any).service_id || (existing as any).serviceId || (existing as any).service_id || null;
    const resolvedLayanan = updates.layanan || existing.layanan;

    const stmt = db.prepare(`
      UPDATE finance_invoices SET
        layanan = ?,
        service_id = ?,
        status = ?,
        dibayar = ?,
        sisa = ?,
        biaya_samsat = ?,
        pendapatan_jasa = ?,
        overpayment = ?,
        settlement_condition = ?,
        refund_status = ?,
        cashback_nominal = ?,
        cashback_status = ?,
        profit_final = ?,
        profit_status = ?,
        alasan_pending = ?,
        data_json = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const res = stmt.run(
      resolvedLayanan ?? "",
      serviceId ?? null,
      merged.status,
      dibayar,
      sisa,
      biayaSamsat,
      pendapatanJasa,
      overpayment,
      settlementCondition,
      refundStatus,
      cashbackNominal,
      cashbackStatus,
      profitFinal,
      profitStatus,
      alasanPending ?? null,
      JSON.stringify({ ...merged, serviceId: serviceId || undefined, service_id: serviceId || undefined }),
      id
    );

    return res.changes > 0;
  }

  /**
   * Checks if an invoice has recorded payment entries.
   * Scoped to invoiceNo and optional orderNo to prevent false positives across collided invoices.
   */
  public hasPayments(invoiceNo: string, orderNo?: string): boolean {
    let cleanOrderNo = orderNo;
    if (!cleanOrderNo) {
      try {
        const invRow = db.prepare("SELECT order_no FROM finance_invoices WHERE invoice_no = ?").get(invoiceNo) as { order_no: string } | undefined;
        cleanOrderNo = invRow?.order_no;
      } catch {}
    }

    if (cleanOrderNo) {
      const row = db
        .prepare("SELECT COUNT(*) AS count FROM invoice_payments WHERE invoice_no = ? AND order_no = ? AND is_void = 0")
        .get(invoiceNo, cleanOrderNo) as { count: number } | undefined;
      return Boolean(row && row.count > 0);
    }

    const row = db
      .prepare("SELECT COUNT(*) AS count FROM invoice_payments WHERE invoice_no = ? AND is_void = 0")
      .get(invoiceNo) as { count: number } | undefined;
    return Boolean(row && row.count > 0);
  }

  /**
   * Deletes an invoice with cascade deletion safeguard.
   * Strictly refuses deletion if verified payments exist to prevent cascading data loss.
   */
  public deleteInvoice(id: number): boolean {
    const inv = this.getInvoiceById(id);
    if (!inv) return false;

    if (inv.invoiceNo && this.hasPayments(inv.invoiceNo, inv.orderNo)) {
      throw new Error(`INVOICE_HAS_PAYMENTS: Cannot delete invoice '${inv.invoiceNo}' because it has recorded payments.`);
    }

    const stmt = db.prepare("DELETE FROM finance_invoices WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ─── INVOICE PAYMENTS REPOSITORY METHODS ────────────────────────────────────

  public getValidPaymentsTotal(invoiceNo: string, orderNo?: string): number {
    let cleanOrderNo = orderNo;
    if (!cleanOrderNo) {
      // Resolve associated orderNo from finance_invoices to avoid cross-order aggregation (GAP-FIN-01)
      try {
        const invRow = db.prepare("SELECT order_no FROM finance_invoices WHERE invoice_no = ?").get(invoiceNo) as { order_no: string } | undefined;
        cleanOrderNo = invRow?.order_no;
      } catch {}
    }

    if (cleanOrderNo) {
      const stmt = db.prepare(`
        SELECT COALESCE(SUM(nominal), 0) AS total
        FROM invoice_payments
        WHERE invoice_no = ?
          AND order_no = ?
          AND is_void = 0
          AND status_verifikasi = 'TERVERIFIKASI'
      `);
      const row = stmt.get(invoiceNo, cleanOrderNo) as { total: number } | undefined;
      return row ? Math.round(Number(row.total)) : 0;
    }

    const stmt = db.prepare(`
      SELECT COALESCE(SUM(nominal), 0) AS total
      FROM invoice_payments
      WHERE invoice_no = ?
        AND is_void = 0
        AND status_verifikasi = 'TERVERIFIKASI'
    `);
    const row = stmt.get(invoiceNo) as { total: number } | undefined;
    return row ? Math.round(Number(row.total)) : 0;
  }

  public getValidPaymentsTotalByOrder(orderNo: string): number {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(nominal), 0) AS total
      FROM invoice_payments
      WHERE order_no = ?
        AND is_void = 0
        AND status_verifikasi = 'TERVERIFIKASI'
    `);
    const row = stmt.get(orderNo) as { total: number } | undefined;
    return row ? Math.round(Number(row.total)) : 0;
  }

  public getPaymentsByInvoiceAndOrder(invoiceNo: string, orderNo: string): any[] {
    const stmt = db.prepare(`
      SELECT * FROM invoice_payments
      WHERE invoice_no = ? AND order_no = ? AND is_void = 0
      ORDER BY id ASC
    `);
    return stmt.all(invoiceNo, orderNo);
  }

  public getPaymentsByInvoiceNo(invoiceNo: string, orderNo?: string): any[] {
    let cleanOrderNo = orderNo;
    if (!cleanOrderNo) {
      try {
        const invRow = db.prepare("SELECT order_no FROM finance_invoices WHERE invoice_no = ?").get(invoiceNo) as { order_no: string } | undefined;
        cleanOrderNo = invRow?.order_no;
      } catch {}
    }
    if (cleanOrderNo) {
      return this.getPaymentsByInvoiceAndOrder(invoiceNo, cleanOrderNo);
    }
    const stmt = db.prepare("SELECT * FROM invoice_payments WHERE invoice_no = ? AND is_void = 0 ORDER BY id ASC");
    return stmt.all(invoiceNo);
  }

  public getPaymentsByOrderNo(orderNo: string): any[] {
    const stmt = db.prepare("SELECT * FROM invoice_payments WHERE order_no = ? ORDER BY id ASC");
    return stmt.all(orderNo);
  }

  public getAllPayments(): any[] {
    const stmt = db.prepare("SELECT * FROM invoice_payments ORDER BY id DESC");
    return stmt.all();
  }

  public getInvoicePaymentById(paymentId: number | string): any {
    if (typeof paymentId === "number" || /^\d+$/.test(String(paymentId).trim())) {
      const numericId = typeof paymentId === "number" ? paymentId : parseInt(String(paymentId).trim(), 10);
      const stmt = db.prepare("SELECT * FROM invoice_payments WHERE id = ?");
      return stmt.get(numericId);
    }
    const cleanStr = String(paymentId).trim();
    if (isValidCanonicalPaymentId(cleanStr)) {
      const stmt = db.prepare("SELECT * FROM invoice_payments WHERE payment_id = ?");
      return stmt.get(cleanStr);
    }
    return undefined;
  }

  public getInvoicePaymentByPaymentId(paymentId: string): any {
    const cleanStr = String(paymentId || "").trim();
    if (!cleanStr) return undefined;
    const stmt = db.prepare("SELECT * FROM invoice_payments WHERE payment_id = ?");
    return stmt.get(cleanStr);
  }

  public updateInvoicePayment(paymentId: number | string, updates: Partial<any>): boolean {
    const existing = this.getInvoicePaymentById(paymentId);
    if (!existing) return false;
    const numericId = existing.id;

    const COLUMN_MAP: Record<string, string> = {
      paymentId: "payment_id",
      invoiceNo: "invoice_no",
      orderNo: "order_no",
      metodePembayaran: "metode_pembayaran",
      namaBank: "nama_bank",
      nomorRekening: "nomor_rekening",
      tanggalBayar: "tanggal_bayar",
      documentId: "document_id",
      kasKantorId: "kas_kantor_id",
      statusVerifikasi: "status_verifikasi",
      idempotencyKey: "idempotency_key",
      verifiedBy: "verified_by",
      verifiedAt: "verified_at",
      isVoid: "is_void",
      voidReason: "void_reason",
      voidAt: "void_at",
      voidBy: "void_by",
      voidKasKantorId: "void_kas_kantor_id",
    };

    const normalizedUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
      const col = COLUMN_MAP[k] || k;
      normalizedUpdates[col] = v;
    }

    // GAP-FIN-02: Prevent silent or unauthorized changes to invoice_no or order_no
    const newInvoiceNo = normalizedUpdates.invoice_no !== undefined ? String(normalizedUpdates.invoice_no).trim() : existing.invoice_no;
    const newOrderNo = normalizedUpdates.order_no !== undefined ? String(normalizedUpdates.order_no).trim() : existing.order_no;

    if (normalizedUpdates.invoice_no !== undefined || normalizedUpdates.order_no !== undefined) {
      try {
        const targetInvoice = this.getInvoiceByNo(newInvoiceNo);
        if (targetInvoice && targetInvoice.orderNo) {
          if (targetInvoice.orderNo.trim().toUpperCase() !== newOrderNo.toUpperCase()) {
            throw new Error(
              `[RELATIONAL_INTEGRITY_VIOLATION] Cannot update payment #${paymentId}: Invoice '${newInvoiceNo}' belongs to order '${targetInvoice.orderNo}', not '${newOrderNo}'.`
            );
          }
        }
      } catch (err: any) {
        if (err?.message?.includes("RELATIONAL_INTEGRITY_VIOLATION")) throw err;
      }
    }

    const fields = Object.keys(normalizedUpdates);
    if (fields.length === 0) return true;
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => normalizedUpdates[f]);
    const stmt = db.prepare(`UPDATE invoice_payments SET ${setClause} WHERE id = ?`);
    const res = stmt.run(...values, numericId);
    return res.changes > 0;
  }

  public recordInvoicePayment(data: {
    paymentId?: string;
    invoiceNo: string;
    orderNo: string;
    nominal: number;
    metodePembayaran: string;
    namaBank?: string;
    nomorRekening?: string;
    tanggalBayar?: string;
    documentId?: string;
    kasKantorId?: number;
    statusVerifikasi?: string;
    idempotencyKey?: string;
    verifiedBy?: string;
    verifiedAt?: string;
    catatan?: string;
  }): any {
    // Validate paymentId if provided
    let cleanPaymentId: string | null = null;
    if (data.paymentId !== undefined && data.paymentId !== null) {
      const trimmed = String(data.paymentId).trim();
      if (!isValidCanonicalPaymentId(trimmed)) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "Payment ID harus berupa UUID v4 kanonis dengan prefix 'pay-'."
        );
      }
      cleanPaymentId = trimmed;
    }

    // GAP-FIN-02: Fail-closed relational integrity validation
    const cleanInvoiceNo = (data.invoiceNo || "").trim();
    const cleanOrderNo = (data.orderNo || "").trim();

    if (!cleanInvoiceNo) {
      throw new Error("[RELATIONAL_INTEGRITY_VIOLATION] invoiceNo is required for invoice_payments.");
    }
    if (!cleanOrderNo) {
      throw new Error("[RELATIONAL_INTEGRITY_VIOLATION] orderNo is required for invoice_payments.");
    }

    try {
      const targetInvoice = this.getInvoiceByNo(cleanInvoiceNo);
      if (targetInvoice && targetInvoice.orderNo) {
        const invoiceOrderNo = targetInvoice.orderNo.trim().toUpperCase();
        if (invoiceOrderNo !== cleanOrderNo.toUpperCase()) {
          throw new Error(
            `[RELATIONAL_INTEGRITY_VIOLATION] Mismatch between invoice and order. Invoice '${cleanInvoiceNo}' belongs to order '${targetInvoice.orderNo}', but payment payload specifies order '${cleanOrderNo}'. Payment rejected.`
          );
        }
      }
    } catch (e: any) {
      if (e?.message?.includes("RELATIONAL_INTEGRITY_VIOLATION")) {
        throw e;
      }
      // Non-fatal if invoice table not yet initialized in early migration
    }

    const stmt = db.prepare(`
      INSERT INTO invoice_payments (
        payment_id, invoice_no, order_no, nominal, metode_pembayaran, nama_bank,
        nomor_rekening, tanggal_bayar, document_id, kas_kantor_id,
        status_verifikasi, idempotency_key, verified_by, verified_at,
        catatan, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const res = stmt.run(
      cleanPaymentId,
      cleanInvoiceNo,
      cleanOrderNo,
      Math.round(Number(data.nominal)),
      data.metodePembayaran,
      data.namaBank || null,
      data.nomorRekening || null,
      data.tanggalBayar || new Date().toISOString(),
      data.documentId || null,
      data.kasKantorId || null,
      data.statusVerifikasi || "TERVERIFIKASI",
      data.idempotencyKey || null,
      data.verifiedBy || "Finance User",
      data.verifiedAt || new Date().toISOString(),
      data.catatan || null
    );

    return {
      id: Number(res.lastInsertRowid),
      payment_id: cleanPaymentId,
      paymentId: cleanPaymentId,
      ...data,
      nominal: Math.round(Number(data.nominal)),
      createdAt: new Date().toISOString(),
    };
  }

  // ─── KAS KANTOR & PENGELUARAN OPERATIONS ───────────────────────────────────

  public getAllKasKantor(): KasKantorItem[] {
    const stmt = db.prepare("SELECT * FROM kas_kantor ORDER BY id DESC");
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      keterangan: r.keterangan,
      status: r.status,
      debit: r.debit,
      kredit: r.kredit,
      saldo: r.saldo,
      total: r.saldo,
      penanggungJawab: r.penanggung_jawab || undefined,
      kategori: r.kategori || undefined,
      orderNo: r.order_no || undefined,
      invoiceNo: r.invoice_no || undefined,
    })) as unknown as KasKantorItem[];
  }

  public addKasKantor(item: Omit<KasKantorItem, "id" | "total"> & { orderNo?: string; invoiceNo?: string; kategori?: string; total?: number }): KasKantorItem {
    // Aggregation-based running balance (Single Source of Truth)
    const balStmt = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) AS balance FROM kas_kantor");
    const balRow = balStmt.get() as { balance: number } | undefined;
    const currentBalance = balRow ? Number(balRow.balance || 0) : 0;

    const isDebit = item.status === "Pemasukan" || item.status === "Debit";
    const debitVal = Number(item.debit ?? (isDebit ? ((item as any).nominal ?? 0) : 0));
    const kreditVal = Number(item.kredit ?? (!isDebit ? ((item as any).nominal ?? 0) : 0));
    const newSaldo = isDebit 
      ? currentBalance + debitVal 
      : currentBalance - kreditVal;

    const insertStmt = db.prepare(`
      INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab, order_no, invoice_no, kategori)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const res = insertStmt.run(
      item.tanggal,
      item.keterangan,
      item.status,
      debitVal,
      kreditVal,
      newSaldo,
      item.penanggungJawab || null,
      (item as any).orderNo || null,
      (item as any).invoiceNo || null,
      (item as any).kategori || null
    );

    return {
      id: Number(res.lastInsertRowid),
      tanggal: item.tanggal,
      keterangan: item.keterangan,
      status: item.status,
      debit: debitVal,
      kredit: kreditVal,
      saldo: newSaldo,
      total: newSaldo,
      penanggungJawab: item.penanggungJawab,
      kategori: (item as any).kategori || undefined,
      orderNo: (item as any).orderNo || undefined,
    } as unknown as KasKantorItem;
  }

  public getAllPengeluaran(): PengeluaranItem[] {
    const stmt = db.prepare("SELECT * FROM pengeluaran ORDER BY id DESC");
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      keterangan: r.keterangan,
      nominal: r.nominal,
      penanggungJawab: r.penanggung_jawab || undefined,
      kategori: r.kategori || undefined,
      orderNo: r.order_no || undefined,
      invoiceNo: r.invoice_no || undefined,
    })) as PengeluaranItem[];
  }

  public addPengeluaran(item: Omit<PengeluaranItem, "id"> & { orderNo?: string; invoiceNo?: string; kategori?: string }): PengeluaranItem {
    const insertStmt = db.prepare(`
      INSERT INTO pengeluaran (tanggal, keterangan, nominal, penanggung_jawab, order_no, invoice_no, kategori)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const res = insertStmt.run(
      item.tanggal,
      item.keterangan,
      item.nominal,
      item.penanggungJawab || null,
      (item as any).orderNo || null,
      (item as any).invoiceNo || null,
      (item as any).kategori || null
    );

    return {
      id: Number(res.lastInsertRowid),
      tanggal: item.tanggal,
      keterangan: item.keterangan,
      nominal: item.nominal,
      penanggungJawab: item.penanggungJawab,
      kategori: (item as any).kategori || undefined,
      orderNo: (item as any).orderNo || undefined,
    };
  }

  public getKasKantorById(id: number): KasKantorItem | undefined {
    const stmt = db.prepare("SELECT * FROM kas_kantor WHERE id = ?");
    const r = stmt.get(id) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      tanggal: r.tanggal,
      keterangan: r.keterangan,
      status: r.status,
      debit: r.debit,
      kredit: r.kredit,
      saldo: r.saldo,
      total: r.saldo,
      penanggungJawab: r.penanggung_jawab || undefined,
      kategori: r.kategori || undefined,
      orderNo: r.order_no || undefined,
      invoiceNo: r.invoice_no || undefined,
    } as unknown as KasKantorItem;
  }

  public deleteKasKantor(id: number): boolean {
    // Non-destructive compensating reversal (Workstream 3 & C1.0.1 Invariant)
    const existing = db.prepare("SELECT * FROM kas_kantor WHERE id = ?").get(id) as any;
    if (!existing) return false;

    const balRow = db.prepare("SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(kredit), 0) AS balance FROM kas_kantor").get() as { balance: number } | undefined;
    const currentBalance = balRow ? Number(balRow.balance || 0) : 0;

    const isOriginalDebit = existing.status === "Pemasukan" || existing.status === "Debit" || Number(existing.debit || 0) > 0;
    const debitVal = isOriginalDebit ? 0 : Number(existing.kredit || 0);
    const kreditVal = isOriginalDebit ? Number(existing.debit || 0) : 0;
    const newStatus = isOriginalDebit ? "Kredit" : "Debit";
    const newSaldo = newStatus === "Debit" ? currentBalance + debitVal : currentBalance - kreditVal;

    const insertStmt = db.prepare(`
      INSERT INTO kas_kantor (tanggal, keterangan, status, debit, kredit, saldo, penanggung_jawab, order_no, invoice_no, kategori)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const nowStr = new Date().toISOString().split("T")[0];
    const res = insertStmt.run(
      nowStr,
      `[VOID] Reversal Kas Kantor #${id}: ${existing.keterangan || "-"}`,
      newStatus,
      debitVal,
      kreditVal,
      newSaldo,
      "System Reversal",
      existing.order_no || null,
      existing.invoice_no || null,
      "Reversal"
    );
    return res.changes > 0;
  }

  public getPengeluaranById(id: number): PengeluaranItem | undefined {
    const stmt = db.prepare("SELECT * FROM pengeluaran WHERE id = ?");
    const r = stmt.get(id) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      tanggal: r.tanggal,
      keterangan: r.keterangan,
      nominal: r.nominal,
      penanggungJawab: r.penanggung_jawab || undefined,
    };
  }

  public deletePengeluaran(id: number): boolean {
    const stmt = db.prepare("DELETE FROM pengeluaran WHERE id = ?");
    const res = stmt.run(id);
    return res.changes > 0;
  }

  // ─── KAS MESSENGER DATABASE REPOSITORY ──────────────────────────────────────

  public getAllKasMessenger(): KasMessengerItem[] {
    const stmt = db.prepare("SELECT * FROM kas_messenger ORDER BY id ASC");
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      jenis: r.jenis,
      messenger: r.messenger,
      keterangan: r.keterangan,
      in: Number(r.debit || 0),
      out: Number(r.kredit || 0),
      total: Number(r.total || 0),
      penanggungJawab: r.penanggung_jawab || undefined,
      orderNo: r.order_no || undefined,
      reimbursementId: r.reimbursement_id || undefined,
      receiptUrl: r.receipt_url || undefined,
      kategori: r.kategori || undefined,
    })) as KasMessengerItem[];
  }

  public getKasMessengerById(id: number): KasMessengerItem | undefined {
    const stmt = db.prepare("SELECT * FROM kas_messenger WHERE id = ?");
    const r = stmt.get(id) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      tanggal: r.tanggal,
      jenis: r.jenis,
      messenger: r.messenger,
      keterangan: r.keterangan,
      in: Number(r.debit || 0),
      out: Number(r.kredit || 0),
      total: Number(r.total || 0),
      penanggungJawab: r.penanggung_jawab || undefined,
      orderNo: r.order_no || undefined,
      reimbursementId: r.reimbursement_id || undefined,
      receiptUrl: r.receipt_url || undefined,
      kategori: r.kategori || undefined,
    };
  }

  public addKasMessenger(item: Omit<KasMessengerItem, "id" | "total"> & {
    total?: number;
    penanggungJawab?: string;
    orderNo?: string;
    reimbursementId?: string;
    receiptUrl?: string;
    kategori?: string;
  }): KasMessengerItem {
    // Calculate running balance isolated per messenger_id (Workstream 1 Requirement)
    const messengerId = (item as any).messenger_id || (item as any).messengerId || null;
    let lastTotal = 0;
    if (messengerId) {
      const lastRow = db.prepare("SELECT total FROM kas_messenger WHERE messenger_id = ? ORDER BY id DESC LIMIT 1").get(messengerId) as { total?: number } | undefined;
      lastTotal = lastRow?.total ?? 0;
    } else if (item.messenger) {
      const lastRow = db.prepare("SELECT total FROM kas_messenger WHERE messenger = ? ORDER BY id DESC LIMIT 1").get(item.messenger) as { total?: number } | undefined;
      lastTotal = lastRow?.total ?? 0;
    }
    const debit = Number(item.in || 0);
    const kredit = Number(item.out || 0);
    const newTotal = item.total !== undefined ? Number(item.total) : (lastTotal + debit - kredit);

    const insertStmt = db.prepare(`
      INSERT INTO kas_messenger (tanggal, jenis, messenger, keterangan, debit, kredit, total, penanggung_jawab, order_no, reimbursement_id, receipt_url, kategori, messenger_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const res = insertStmt.run(
      item.tanggal,
      item.jenis,
      item.messenger,
      item.keterangan,
      debit,
      kredit,
      newTotal,
      item.penanggungJawab || null,
      item.orderNo || null,
      item.reimbursementId || null,
      item.receiptUrl || null,
      item.kategori || null,
      messengerId
    );

    return {
      id: Number(res.lastInsertRowid),
      tanggal: item.tanggal,
      jenis: item.jenis,
      messenger: item.messenger,
      keterangan: item.keterangan,
      in: debit,
      out: kredit,
      total: newTotal,
      penanggungJawab: item.penanggungJawab,
      orderNo: item.orderNo,
      reimbursementId: item.reimbursementId,
      receiptUrl: item.receiptUrl,
      kategori: item.kategori,
    };
  }

  public deleteKasMessenger(id: number): boolean {
    // Non-destructive compensating reversal (Workstream 3 & C1.0.1 Invariant)
    const existing = db.prepare("SELECT * FROM kas_messenger WHERE id = ?").get(id) as any;
    if (!existing) return false;

    const messengerId = existing.messenger_id;
    let lastTotal = 0;
    if (messengerId) {
      const lastRow = db.prepare("SELECT total FROM kas_messenger WHERE messenger_id = ? ORDER BY id DESC LIMIT 1").get(messengerId) as { total?: number } | undefined;
      lastTotal = lastRow?.total ?? 0;
    } else if (existing.messenger) {
      const lastRow = db.prepare("SELECT total FROM kas_messenger WHERE messenger = ? ORDER BY id DESC LIMIT 1").get(existing.messenger) as { total?: number } | undefined;
      lastTotal = lastRow?.total ?? 0;
    }

    const origDebit = Number(existing.debit || 0);
    const origKredit = Number(existing.kredit || 0);
    const revDebit = origKredit;
    const revKredit = origDebit;
    const newJenis = revDebit > 0 ? "Pemasukan" : "Pengeluaran";
    const newTotal = lastTotal + revDebit - revKredit;

    const insertStmt = db.prepare(`
      INSERT INTO kas_messenger (tanggal, jenis, messenger, keterangan, debit, kredit, total, penanggung_jawab, order_no, reimbursement_id, receipt_url, kategori, messenger_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const nowStr = new Date().toISOString().split("T")[0];
    const res = insertStmt.run(
      nowStr,
      newJenis,
      existing.messenger,
      `[VOID] Reversal Kas Messenger #${id}: ${existing.keterangan || "-"}`,
      revDebit,
      revKredit,
      newTotal,
      "System Reversal",
      existing.order_no || null,
      existing.reimbursement_id || null,
      existing.receipt_url || null,
      "Reversal",
      messengerId || null
    );
    return res.changes > 0;
  }

  // ─── IDEMPOTENCY RECORD OPERATIONS ──────────────────────────────────────────

  public getIdempotencyRecord(key: string, scope = "PAYMENT_SUBMISSION"): {
    key: string;
    scope: string;
    user_id?: string | null;
    request_hash: string;
    resource_id: string | null;
    response_json: string;
    created_at: string;
  } | undefined {
    const cleanKey = (key || "").trim();
    if (!cleanKey) return undefined;

    const scopedKey = formatScopedIdempotencyKey(scope, cleanKey);

    // 1. Primary Lookup: Look for new scoped key (${scope}::${clientKey})
    const stmtScoped = db.prepare("SELECT * FROM idempotency_keys WHERE key = ?");
    const recordScoped = stmtScoped.get(scopedKey) as any;
    if (recordScoped) return recordScoped;

    // 2. Dual-Read Fallback: Look for legacy unprefixed key matching this exact scope
    const stmtLegacy = db.prepare("SELECT * FROM idempotency_keys WHERE key = ? AND scope = ?");
    const recordLegacy = stmtLegacy.get(cleanKey, scope) as any;
    if (recordLegacy) return recordLegacy;

    // 3. Fallback for legacy scope alias: 'payment' -> 'PAYMENT_SUBMISSION'
    if (scope === "PAYMENT_SUBMISSION") {
      const recordLegacyAlias = stmtLegacy.get(cleanKey, "payment") as any;
      if (recordLegacyAlias) return recordLegacyAlias;
    }

    return undefined;
  }

  public saveIdempotencyRecord(data: {
    key: string;
    scope: string;
    user_id?: string | null;
    request_hash: string;
    resource_id?: string | null;
    response_json: string;
  }): void {
    const stmt = db.prepare(`
      INSERT INTO idempotency_keys (key, scope, user_id, request_hash, resource_id, response_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(data.key, data.scope, data.user_id || null, data.request_hash, data.resource_id || null, data.response_json);
  }
}

export const dbFinanceRepository = new DbFinanceRepository();
