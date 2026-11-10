/**
 * SQLite Audit Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db, runInTransaction } from "../database/db";
import { serializeUtcTimestamp } from "../utils/timestampSerializer";

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

    const stmt = (db as any).prepare(sql);
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
      createdAt: serializeUtcTimestamp(r.created_at) || r.created_at,
    }));
  }

  public save(log: AuditLogRecord): void {
    const stmt = (db as any).prepare(`
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

  public clearAllLogs(executor: {
    userId: string;
    userName: string;
    userRole: string;
    ip?: string;
  }): { deletedCount: number } {
    return runInTransaction(() => {
      // 1. Get count of logs to be permanently cleared
      const countRow = (db as any).prepare("SELECT COUNT(*) as count FROM audit_logs").get() as { count: number } | undefined;
      const count = countRow ? Number(countRow.count) : 0;

      // 2. Permanent deletion from audit_logs
      (db as any).prepare("DELETE FROM audit_logs").run();

      // 3. Prevent Paradox: Record the clear event in security_audit_logs, NOT in audit_logs
      // This ensures GET /api/audit-logs returns exactly 0 records after clear
      const secStmt = (db as any).prepare(`
        INSERT INTO security_audit_logs (id, user_id, user_name, user_role, action, module, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, 'ACTIVITY_HISTORY_CLEARED', 'Riwayat Aktivitas', ?, ?, datetime('now'))
      `);
      secStmt.run(
        `sec-audit-clear-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        executor.userId,
        executor.userName,
        executor.userRole,
        `Pembersihan permanen riwayat aktivitas operasional dieksekusi. ${count} catatan audit dihapus secara permanen.`,
        JSON.stringify({
          deletedCount: count,
          executorIp: executor.ip || null,
          executedAt: new Date().toISOString(),
        })
      );

      return { deletedCount: count };
    });
  }

  public getSecurityLogs(limit: number = 100): any[] {
    const stmt = (db as any).prepare("SELECT * FROM security_audit_logs ORDER BY created_at DESC LIMIT ?");
    const rows = stmt.all(limit) as any[];
    return rows.map((r) => ({
      ...r,
      created_at: serializeUtcTimestamp(r.created_at) || r.created_at,
      createdAt: serializeUtcTimestamp(r.created_at) || r.created_at,
    }));
  }
}

export const dbAuditRepository = new DbAuditRepository();
