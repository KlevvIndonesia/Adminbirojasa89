/**
 * SQLite Notification Settings & Logs Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";

export interface NotificationSettingsRecord {
  id: string;
  recipientEmails: string[];
  notifyTagihanReminder: boolean;
  notifyTagihanPerubahan: boolean;
  notifyOrderUpdate: boolean;
  notifyProsesGagal: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface NotificationLogRecord {
  id: string;
  type: string;
  recipient: string;
  title: string;
  referenceNo: string | null;
  status: "BERHASIL" | "GAGAL";
  errorMessage: string | null;
  createdAt: string;
}

export class DbNotificationSettingsRepository {
  public getSettings(): NotificationSettingsRecord {
    const stmt = db.prepare("SELECT * FROM notification_settings WHERE id = 'global'");
    let row = stmt.get() as any;

    if (!row) {
      // Auto-initialize default global row
      db.prepare(`
        INSERT INTO notification_settings (id, recipient_emails, notify_tagihan_reminder, notify_tagihan_perubahan, notify_order_update, notify_proses_gagal, updated_by)
        VALUES ('global', ?, 1, 1, 1, 1, 'system')
      `).run(JSON.stringify(["admin@sunbirojasa.com"]));

      row = stmt.get() as any;
    }

    let parsedEmails: string[] = [];
    try {
      parsedEmails = JSON.parse(row.recipient_emails || "[]");
    } catch {
      parsedEmails = ["admin@sunbirojasa.com"];
    }

    return {
      id: row.id,
      recipientEmails: parsedEmails,
      notifyTagihanReminder: Boolean(row.notify_tagihan_reminder),
      notifyTagihanPerubahan: Boolean(row.notify_tagihan_perubahan),
      notifyOrderUpdate: Boolean(row.notify_order_update),
      notifyProsesGagal: Boolean(row.notify_proses_gagal),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || null,
    };
  }

  public updateSettings(
    payload: {
      recipientEmails?: string[];
      notifyTagihanReminder?: boolean;
      notifyTagihanPerubahan?: boolean;
      notifyOrderUpdate?: boolean;
      notifyProsesGagal?: boolean;
    },
    updatedBy?: string
  ): NotificationSettingsRecord {
    const current = this.getSettings();

    const recipientEmails = payload.recipientEmails !== undefined ? payload.recipientEmails : current.recipientEmails;
    const notifyTagihanReminder = payload.notifyTagihanReminder !== undefined ? payload.notifyTagihanReminder : current.notifyTagihanReminder;
    const notifyTagihanPerubahan = payload.notifyTagihanPerubahan !== undefined ? payload.notifyTagihanPerubahan : current.notifyTagihanPerubahan;
    const notifyOrderUpdate = payload.notifyOrderUpdate !== undefined ? payload.notifyOrderUpdate : current.notifyOrderUpdate;
    const notifyProsesGagal = payload.notifyProsesGagal !== undefined ? payload.notifyProsesGagal : current.notifyProsesGagal;

    db.prepare(`
      UPDATE notification_settings
      SET recipient_emails = ?,
          notify_tagihan_reminder = ?,
          notify_tagihan_perubahan = ?,
          notify_order_update = ?,
          notify_proses_gagal = ?,
          updated_at = datetime('now'),
          updated_by = ?
      WHERE id = 'global'
    `).run(
      JSON.stringify(recipientEmails),
      notifyTagihanReminder ? 1 : 0,
      notifyTagihanPerubahan ? 1 : 0,
      notifyOrderUpdate ? 1 : 0,
      notifyProsesGagal ? 1 : 0,
      updatedBy || "admin"
    );

    return this.getSettings();
  }

  public getLogs(limit = 50): NotificationLogRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM notification_logs
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      recipient: r.recipient,
      title: r.title,
      referenceNo: r.reference_no,
      status: r.status as "BERHASIL" | "GAGAL",
      errorMessage: r.error_message,
      createdAt: r.created_at,
    }));
  }

  public addLog(entry: {
    id?: string;
    type: string;
    recipient: string;
    title: string;
    referenceNo?: string | null;
    status: "BERHASIL" | "GAGAL";
    errorMessage?: string | null;
    createdAt?: string;
  }): NotificationLogRecord {
    const id = entry.id || `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = entry.createdAt || new Date().toISOString();

    db.prepare(`
      INSERT INTO notification_logs (id, type, recipient, title, reference_no, status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.type,
      entry.recipient,
      entry.title,
      entry.referenceNo || null,
      entry.status,
      entry.errorMessage || null,
      createdAt
    );

    return {
      id,
      type: entry.type,
      recipient: entry.recipient,
      title: entry.title,
      referenceNo: entry.referenceNo || null,
      status: entry.status,
      errorMessage: entry.errorMessage || null,
      createdAt,
    };
  }
}

export const dbNotificationSettingsRepository = new DbNotificationSettingsRepository();
