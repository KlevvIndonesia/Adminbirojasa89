/**
 * SQLite Order Correction Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";
import { OrderCorrectionRecord } from "../database/schema";

export class DbOrderCorrectionRepository {
  public create(record: OrderCorrectionRecord): void {
    const stmt = db.prepare(`
      INSERT INTO order_corrections (
        id, order_no, category, linked_duplicate_order_no, reason,
        status, requested_by, requested_at, reviewed_by, reviewed_at,
        review_notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, datetime('now'), datetime('now')
      )
    `);

    stmt.run(
      record.id,
      record.order_no,
      record.category,
      record.linked_duplicate_order_no || null,
      record.reason,
      record.status || "Diajukan",
      record.requested_by,
      record.requested_at || new Date().toISOString(),
      record.reviewed_by || null,
      record.reviewed_at || null,
      record.review_notes || null
    );
  }

  public getById(id: string): OrderCorrectionRecord | undefined {
    const stmt = db.prepare("SELECT * FROM order_corrections WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  public listByOrderNo(orderNo: string): OrderCorrectionRecord[] {
    const stmt = db.prepare("SELECT * FROM order_corrections WHERE order_no = ? ORDER BY created_at DESC");
    const rows = stmt.all(orderNo) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  public getPendingByOrderNo(orderNo: string): OrderCorrectionRecord | undefined {
    const stmt = db.prepare("SELECT * FROM order_corrections WHERE order_no = ? AND status = 'Diajukan' LIMIT 1");
    const row = stmt.get(orderNo) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  public listAll(filters?: { status?: string; orderNo?: string }): OrderCorrectionRecord[] {
    let sql = "SELECT * FROM order_corrections WHERE 1=1";
    const params: (string | number)[] = [];

    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    if (filters?.orderNo) {
      sql += " AND order_no = ?";
      params.push(filters.orderNo);
    }

    sql += " ORDER BY created_at DESC";
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  public updateStatus(
    id: string,
    status: "Disetujui" | "Ditolak",
    reviewedBy: string,
    reviewNotes?: string | null
  ): boolean {
    const stmt = db.prepare(`
      UPDATE order_corrections
      SET status = ?,
          reviewed_by = ?,
          reviewed_at = datetime('now'),
          review_notes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `);

    const res = stmt.run(status, reviewedBy, reviewNotes || null, id);
    return res.changes > 0;
  }

  private mapRow(row: Record<string, unknown>): OrderCorrectionRecord {
    return {
      id: String(row.id),
      order_no: String(row.order_no),
      category: String(row.category),
      linked_duplicate_order_no: row.linked_duplicate_order_no ? String(row.linked_duplicate_order_no) : null,
      reason: String(row.reason),
      status: row.status as "Diajukan" | "Disetujui" | "Ditolak",
      requested_by: String(row.requested_by),
      requested_at: String(row.requested_at),
      reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
      reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
      review_notes: row.review_notes ? String(row.review_notes) : null,
      created_at: row.created_at ? String(row.created_at) : undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined,
    };
  }
}

export const dbOrderCorrectionRepository = new DbOrderCorrectionRepository();
