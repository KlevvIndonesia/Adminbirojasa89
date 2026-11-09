/**
 * SQLite Messenger & Reimbursement Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";
import { ReimbursementRequest } from "../../../src/domain/messenger/types";

export class DbMessengerRepository {
  public getAllReimbursements(filters?: {
    employeeId?: string;
    orderNo?: string;
    status?: string;
  }): ReimbursementRequest[] {
    let sql = "SELECT * FROM messenger_reimbursements WHERE 1=1";
    const params: any[] = [];

    if (filters?.employeeId) {
      sql += " AND employee_id = ?";
      params.push(filters.employeeId);
    }
    if (filters?.orderNo) {
      sql += " AND order_no = ?";
      params.push(filters.orderNo);
    }
    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }

    sql += " ORDER BY submitted_at DESC";

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((r) => this.mapRowToReimbursement(r));
  }

  public getReimbursementById(id: string): ReimbursementRequest | undefined {
    const stmt = db.prepare("SELECT * FROM messenger_reimbursements WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return this.mapRowToReimbursement(row);
  }

  public createReimbursement(reimb: ReimbursementRequest): void {
    const stmt = db.prepare(`
      INSERT INTO messenger_reimbursements (
        id, employee_id, messenger_name, order_no, category, amount,
        approved_amount, rejected_amount, date, note, receipt_url, receipt_name,
        status, items_json, submitted_at, reviewed_at, reviewed_by, review_notes,
        paid_at, paid_by, payment_method, transaction_ref, pengeluaran_id,
        kas_messenger_id, channel, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, datetime('now')
      )
    `);

    stmt.run(
      reimb.id,
      reimb.employeeId,
      reimb.messengerName,
      reimb.orderNo || null,
      reimb.category,
      reimb.amount,
      reimb.approvedAmount || 0,
      reimb.rejectedAmount || 0,
      reimb.date,
      reimb.note || null,
      reimb.receiptUrl || null,
      reimb.receiptName || null,
      reimb.status,
      reimb.items ? JSON.stringify(reimb.items) : null,
      reimb.submittedAt || new Date().toISOString(),
      reimb.reviewedAt || null,
      reimb.reviewedBy || null,
      reimb.reviewNotes || null,
      reimb.paidAt || null,
      reimb.paidBy || null,
      reimb.paymentMethod || null,
      reimb.transactionRef || null,
      reimb.pengeluaranId || null,
      (reimb as any).kasMessengerId || null,
      (reimb as any).channel || null
    );
  }

  public updateReimbursement(id: string, updates: Partial<ReimbursementRequest>): boolean {
    const existing = this.getReimbursementById(id);
    if (!existing) return false;

    const merged = { ...existing, ...updates };

    const stmt = db.prepare(`
      UPDATE messenger_reimbursements SET
        category = ?,
        amount = ?,
        approved_amount = ?,
        rejected_amount = ?,
        date = ?,
        note = ?,
        receipt_url = ?,
        receipt_name = ?,
        status = ?,
        items_json = ?,
        reviewed_at = ?,
        reviewed_by = ?,
        review_notes = ?,
        paid_at = ?,
        paid_by = ?,
        payment_method = ?,
        transaction_ref = ?,
        pengeluaran_id = ?,
        kas_messenger_id = ?,
        channel = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const res = stmt.run(
      merged.category,
      merged.amount,
      merged.approvedAmount || 0,
      merged.rejectedAmount || 0,
      merged.date,
      merged.note || null,
      merged.receiptUrl || null,
      merged.receiptName || null,
      merged.status,
      merged.items ? JSON.stringify(merged.items) : null,
      merged.reviewedAt || null,
      merged.reviewedBy || null,
      merged.reviewNotes || null,
      merged.paidAt || null,
      merged.paidBy || null,
      merged.paymentMethod || null,
      merged.transactionRef || null,
      merged.pengeluaranId || null,
      (merged as any).kasMessengerId || null,
      (merged as any).channel || null,
      id
    );

    return res.changes > 0;
  }

  public getNextReimbursementId(): string {
    const stmt = db.prepare("SELECT COUNT(*) as count FROM messenger_reimbursements");
    const row = stmt.get() as { count: number };
    const count = (row?.count || 0) + 1;
    return `REIMB-${String(count).padStart(3, "0")}`;
  }

  private mapRowToReimbursement(r: any): ReimbursementRequest {
    return {
      id: r.id,
      employeeId: r.employee_id,
      messengerName: r.messenger_name,
      orderNo: r.order_no || undefined,
      category: r.category,
      amount: Number(r.amount || 0),
      approvedAmount: r.approved_amount !== null ? Number(r.approved_amount) : undefined,
      rejectedAmount: r.rejected_amount !== null ? Number(r.rejected_amount) : undefined,
      items: r.items_json ? JSON.parse(r.items_json) : undefined,
      date: r.date,
      note: r.note || undefined,
      receiptUrl: r.receipt_url || undefined,
      receiptName: r.receipt_name || undefined,
      status: r.status,
      submittedAt: r.submitted_at,
      reviewedAt: r.reviewed_at || undefined,
      reviewedBy: r.reviewed_by || undefined,
      reviewNotes: r.review_notes || undefined,
      paidAt: r.paid_at || undefined,
      paidBy: r.paid_by || undefined,
      paymentMethod: r.payment_method || undefined,
      transactionRef: r.transaction_ref || undefined,
      pengeluaranId: r.pengeluaran_id || undefined,
      kasMessengerId: r.kas_messenger_id ? Number(r.kas_messenger_id) : undefined,
      channel: r.channel || undefined,
    };
  }
}

export const dbMessengerRepository = new DbMessengerRepository();
