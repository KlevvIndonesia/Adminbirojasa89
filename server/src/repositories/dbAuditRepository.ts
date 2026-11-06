/**
 * SQLite Audit Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";

export interface AuditLogRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: 'administrator' | 'finance' | 'admin' | 'messenger' | 'supervisor' | 'svp' | 'system' | string;
  action: string;
  module: string;
  details: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export class DbAuditRepository {
  public getAll(filters?: { userId?: string; module?: string; action?: string; limit?: number }): AuditLogRecord[] {
    let sql = "SELECT * FROM audit_logs WHERE 1=1";
    const params: any[] = [];

    if (filters?.userId) {
      sql += " AND user_id = ?";
      params.push(filters.userId);
    }
    if (filters?.module) {
      sql += " AND module = ?";
      params.push(filters.module);
    }
    if (filters?.action) {
      sql += " AND action = ?";
      params.push(filters.action);
    }

    sql += " ORDER BY created_at DESC";

    if (filters?.limit) {
      sql += " LIMIT ?";
      params.push(filters.limit);
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userRole: r.user_role,
      action: r.action,
      module: r.module,
      details: r.details,
      metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
      createdAt: r.created_at,
    }));
  }

  public save(log: AuditLogRecord): void {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, module, details, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.id,
      log.userId,
      log.userName,
      log.userRole,
      log.action,
      log.module,
      log.details,
      log.metadata ? JSON.stringify(log.metadata) : null,
      log.createdAt || new Date().toISOString()
    );
  }
}

export const dbAuditRepository = new DbAuditRepository();
