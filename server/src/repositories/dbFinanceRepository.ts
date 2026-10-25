/**
 * SQLite Finance Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";
import { InvoiceBillingRecord, KasKantorItem, PengeluaranItem, KasMessengerItem } from "../../../src/domain/finance/types";

export class DbFinanceRepository {
  private mapRowToInvoice(r: any): InvoiceBillingRecord {
    let parsed: any = {};
    try {
      parsed = JSON.parse(r.data_json || "{}");
    } catch {}

    const totalTagihan = Number(r.total_tagihan ?? parsed.totalTagihan ?? 0);
    const dibayar = Number(r.dibayar ?? parsed.dibayar ?? parsed.terbayar ?? 0);
    const sisa = Number(r.sisa ?? Math.max(0, totalTagihan - dibayar));
    const biayaSamsat = Number(r.biaya_samsat ?? parsed.biayaSamsat ?? 0);
    const pendapatanJasa = Number(r.pendapatan_jasa ?? Math.max(0, totalTagihan - biayaSamsat));
    const overpayment = Number(r.overpayment ?? parsed.overpayment ?? 0);
    const cashback = Number(r.cashback_nominal ?? parsed.cashback ?? 0);
    const profit = Number(r.profit_final ?? parsed.profit ?? 0);
    const serviceId = r.service_id !== null && r.service_id !== undefined ? String(r.service_id) : (parsed.serviceId || parsed.service_id || undefined);

    return {
      ...parsed,
      id: r.id,
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
    };
  }

  public getAllInvoices(): InvoiceBillingRecord[] {
    const stmt = db.prepare("SELECT * FROM finance_invoices ORDER BY id DESC");
    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapRowToInvoice(r));
  }

  public getInvoiceById(id: number): InvoiceBillingRecord | undefined {
    const stmt = db.prepare("SELECT * FROM finance_invoices WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return this.mapRowToInvoice(row);
  }

  public getInvoiceByOrderNo(orderNo: string): InvoiceBillingRecord | undefined {
    const cleanNo = (orderNo || "").trim().toUpperCase();
    const stmt = db.prepare("SELECT * FROM finance_invoices WHERE UPPER(order_no) = ? OR order_no = ?");
    const row = stmt.get(cleanNo, orderNo) as any;
    if (!row) return undefined;
    return this.mapRowToInvoice(row);
  }

  public getInvoiceByNo(invoiceNo: string): InvoiceBillingRecord | undefined {
    const stmt = db.prepare("SELECT * FROM finance_invoices WHERE invoice_no = ?");
    const row = stmt.get(invoiceNo) as any;
    if (!row) return undefined;
    return this.mapRowToInvoice(row);
  }

  public saveInvoice(invoice: Partial<InvoiceBillingRecord> & { invoiceNo: string; orderNo: string }): number {
    const existing = this.getInvoiceByNo(invoice.invoiceNo) || this.getInvoiceByOrderNo(invoice.orderNo);
    const biayaSamsat = Number(invoice.biayaSamsat ?? (existing as any)?.biayaSamsat ?? 0);
    const totalTagihan = Number(invoice.totalTagihan ?? (existing as any)?.totalTagihan ?? 0);
    const dibayar = Number(invoice.dibayar ?? invoice.terbayar ?? (existing as any)?.dibayar ?? 0);
    const sisa = Number(invoice.sisa ?? Math.max(0, totalTagihan - dibayar));
    const pendapatanJasa = Math.max(0, totalTagihan - biayaSamsat);
    const overpayment = Number(invoice.overpayment ?? (existing as any)?.overpayment ?? 0);
    const settlementCondition = (invoice.settlementCondition || (existing as any)?.settlementCondition || (dibayar >= totalTagihan ? "BALANCED" : "UNDERPAID")) as string;
    const refundStatus = (invoice.refundStatus || (existing as any)?.refundStatus || "NONE") as string;
    const cashbackNominal = Number(invoice.cashback ?? (existing as any)?.cashback ?? 0);
    const cashbackStatus = (invoice.cashbackStatus || (existing as any)?.cashbackStatus || (cashbackNominal > 0 ? "PENDING" : "APPROVED")) as string;
    const profitFinal = Number(invoice.profit ?? (existing as any)?.profit ?? 0);
    const profitStatus = (invoice.profitStatus || (existing as any)?.profitStatus || (dibayar >= totalTagihan ? "REALIZED" : "PENDING")) as string;
    const biayaJasa = Number((invoice as any).biayaJasa ?? (existing as any)?.biayaJasa ?? 0);
    const biayaAntarJemput = Number((invoice as any).biayaAntarJemput ?? (existing as any)?.biayaAntarJemput ?? 0);
    const namaPenerimaKeluar = (invoice as any).namaPenerimaKeluar || (existing as any)?.namaPenerimaKeluar || null;
    const alasanPending = (invoice as any).alasan_pending || (invoice as any).alasan || (existing as any)?.alasan_pending || (existing as any)?.alasan || null;
    const serviceId = (invoice as any).serviceId || (invoice as any).service_id || (existing as any)?.serviceId || (existing as any)?.service_id || null;

    if (existing) {
      const merged: InvoiceBillingRecord = { ...existing, ...invoice, serviceId: serviceId || undefined, service_id: serviceId || undefined };
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
          data_json = ?,
          service_id = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(
        merged.invoiceNo,
        merged.orderNo,
        merged.customer,
        merged.layanan,
        merged.status,
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
        JSON.stringify(merged),
        serviceId,
        existing.id
      );
      return existing.id;
    }

    const stmt = db.prepare(`
      INSERT INTO finance_invoices (
        invoice_no, order_no, customer, layanan, status,
        total_tagihan, dibayar, sisa, biaya_samsat, pendapatan_jasa,
        overpayment, settlement_condition, refund_status,
        cashback_nominal, cashback_status, profit_final, profit_status,
        biaya_jasa, biaya_antar_jemput, nama_penerima_keluar,
        alasan_pending, data_json, service_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
      JSON.stringify(invoice),
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
    const overpayment = Number(merged.overpayment || 0);
    const settlementCondition = (merged.settlementCondition || (dibayar >= totalTagihan ? "BALANCED" : "UNDERPAID")) as string;
    const refundStatus = (merged.refundStatus || "NONE") as string;
    const cashbackNominal = Number(merged.cashback || 0);
    const cashbackStatus = (merged.cashbackStatus || (cashbackNominal > 0 ? "PENDING" : "APPROVED")) as string;
    const profitFinal = Number(merged.profit || 0);
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
      resolvedLayanan,
      serviceId,
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
      alasanPending,
      JSON.stringify({ ...merged, serviceId: serviceId || undefined, service_id: serviceId || undefined }),
      id
    );

    return res.changes > 0;
  }

  /**
   * Checks if an invoice has recorded payment entries.
   */
  public hasPayments(invoiceNo: string): boolean {
    const row = db
      .prepare("SELECT COUNT(*) AS count FROM invoice_payments WHERE invoice_no = ?")
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

    if (this.hasPayments(inv.invoiceNo)) {
      throw new Error(`INVOICE_HAS_PAYMENTS: Cannot delete invoice '${inv.invoiceNo}' because it has recorded payments.`);
    }

    const stmt = db.prepare("DELETE FROM finance_invoices WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ─── INVOICE PAYMENTS REPOSITORY METHODS ────────────────────────────────────

  public getPaymentsByInvoiceNo(invoiceNo: string): any[] {
    const stmt = db.prepare("SELECT * FROM invoice_payments WHERE invoice_no = ? ORDER BY id ASC");
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

  public getInvoicePaymentById(paymentId: number): any {
    const stmt = db.prepare("SELECT * FROM invoice_payments WHERE id = ?");
    return stmt.get(paymentId);
  }

  public updateInvoicePayment(paymentId: number, updates: Partial<any>): boolean {
    const fields = Object.keys(updates);
    if (fields.length === 0) return true;
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => updates[f]);
    const stmt = db.prepare(`UPDATE invoice_payments SET ${setClause} WHERE id = ?`);
    const res = stmt.run(...values, paymentId);
    return res.changes > 0;
  }

  public recordInvoicePayment(data: {
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
    const stmt = db.prepare(`
      INSERT INTO invoice_payments (
        invoice_no, order_no, nominal, metode_pembayaran, nama_bank,
        nomor_rekening, tanggal_bayar, document_id, kas_kantor_id,
        status_verifikasi, idempotency_key, verified_by, verified_at,
        catatan, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const res = stmt.run(
      data.invoiceNo,
      data.orderNo,
      data.nominal,
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
      ...data,
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

  public addKasKantor(item: Omit<KasKantorItem, "id"> & { orderNo?: string; invoiceNo?: string; kategori?: string }): KasKantorItem {
    const lastStmt = db.prepare("SELECT saldo FROM kas_kantor ORDER BY id DESC LIMIT 1");
    const lastRow = lastStmt.get() as { saldo: number } | undefined;
    const lastSaldo = lastRow ? lastRow.saldo : 15000000;

    const isDebit = item.status === "Pemasukan" || item.status === "Debit";
    const debitVal = Number(item.debit ?? (isDebit ? ((item as any).nominal ?? 0) : 0));
    const kreditVal = Number(item.kredit ?? (!isDebit ? ((item as any).nominal ?? 0) : 0));
    const newSaldo = isDebit 
      ? lastSaldo + debitVal 
      : lastSaldo - kreditVal;

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
    } as unknown as KasKantorItem;
  }

  public deleteKasKantor(id: number): boolean {
    const stmt = db.prepare("DELETE FROM kas_kantor WHERE id = ?");
    const res = stmt.run(id);
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
    // Calculate running balance from authoritative database history
    const lastRowStmt = db.prepare("SELECT total FROM kas_messenger ORDER BY id DESC LIMIT 1");
    const lastRow = lastRowStmt.get() as { total?: number } | undefined;
    const lastTotal = lastRow?.total ?? 0;
    const debit = Number(item.in || 0);
    const kredit = Number(item.out || 0);
    const newTotal = item.total !== undefined ? Number(item.total) : (lastTotal + debit - kredit);

    const insertStmt = db.prepare(`
      INSERT INTO kas_messenger (tanggal, jenis, messenger, keterangan, debit, kredit, total, penanggung_jawab, order_no, reimbursement_id, receipt_url, kategori)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      item.kategori || null
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
    const stmt = db.prepare("DELETE FROM kas_messenger WHERE id = ?");
    const res = stmt.run(id);
    return res.changes > 0;
  }

  // ─── IDEMPOTENCY RECORD OPERATIONS ──────────────────────────────────────────

  public getIdempotencyRecord(key: string, scope = "payment"): {
    key: string;
    scope: string;
    user_id?: string | null;
    request_hash: string;
    resource_id: string | null;
    response_json: string;
    created_at: string;
  } | undefined {
    const stmt = db.prepare("SELECT * FROM idempotency_keys WHERE key = ? AND scope = ?");
    return stmt.get(key, scope) as any;
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
      ON CONFLICT(key) DO UPDATE SET
        user_id = excluded.user_id,
        request_hash = excluded.request_hash,
        response_json = excluded.response_json
    `);
    stmt.run(data.key, data.scope, data.user_id || null, data.request_hash, data.resource_id || null, data.response_json);
  }
}

export const dbFinanceRepository = new DbFinanceRepository();
