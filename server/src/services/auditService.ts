/**
 * Audit Log Domain Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { dbAuditRepository, AuditLogRecord } from "../repositories/dbAuditRepository";
import { TokenPayload } from "../utils/crypto";

export class AuditService {
  public getLogs(filters?: { userId?: string; module?: string; action?: string; limit?: number }): AuditLogRecord[] {
    return dbAuditRepository.getAll(filters);
  }

  public recordLog(log: Omit<AuditLogRecord, "id" | "createdAt">, user?: TokenPayload | null): AuditLogRecord {
    // Milestone 13: Enforce verified server identity when authenticated
    const actorId = user ? user.userId : (log.userId || "usr-system");
    const actorName = user ? user.nama : (log.userName || "System");
    const actorRole = user ? user.role : (log.userRole || "admin");

    const newLog: AuditLogRecord = {
      ...log,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: actorId,
      userName: actorName,
      userRole: actorRole,
      createdAt: new Date().toISOString(),
    };
    dbAuditRepository.save(newLog);
    return newLog;
  }

  public clearLogs(user?: TokenPayload | null, ip?: string): { deletedCount: number } {
    const executor = {
      userId: user ? user.userId : "usr-admin-system",
      userName: user ? user.nama : "Administrator",
      userRole: user ? user.role : "administrator",
      ip: ip,
    };
    return dbAuditRepository.clearAllLogs(executor);
  }
}

export const auditService = new AuditService();
