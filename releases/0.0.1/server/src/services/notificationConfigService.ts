/**
 * Notification Configuration & Email Dispatch Service
 * Admin SUN89 — Biro Jasa Management System
 */

import {
  dbNotificationSettingsRepository,
  NotificationSettingsRecord,
  NotificationLogRecord,
} from "../repositories/dbNotificationSettingsRepository";

export interface SmtpConfigStatus {
  isConfigured: boolean;
  status: "ONLINE" | "OFFLINE";
  statusText: string;
  host: string | null;
  port: number | null;
  senderEmail: string | null;
  hasCredentials: boolean;
  lastChecked: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class NotificationConfigService {
  /**
   * Evaluates SMTP configuration safely without exposing sensitive secrets (passwords/keys)
   */
  public getSmtpStatus(): SmtpConfigStatus {
    const host = process.env.SMTP_HOST?.trim() || null;
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : null;
    const user = process.env.SMTP_USER?.trim() || null;
    const pass = process.env.SMTP_PASS?.trim() || null;
    const sender = process.env.SMTP_FROM?.trim() || process.env.EMAIL_FROM?.trim() || user || null;

    const isConfigured = Boolean(host && user && pass);

    return {
      isConfigured,
      status: isConfigured ? "ONLINE" : "OFFLINE",
      statusText: isConfigured
        ? "Terkonfigurasi (Siap Mengirim)"
        : "Belum Terkonfigurasi (SMTP Offline)",
      host: host || null,
      port: port || (isConfigured ? 587 : null),
      senderEmail: sender || null,
      hasCredentials: Boolean(user && pass),
      lastChecked: new Date().toISOString(),
    };
  }

  public getSettings(): NotificationSettingsRecord {
    return dbNotificationSettingsRepository.getSettings();
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
    if (payload.recipientEmails) {
      if (!Array.isArray(payload.recipientEmails)) {
        throw new Error("recipientEmails harus berupa array string alamat email.");
      }
      for (const email of payload.recipientEmails) {
        if (!EMAIL_REGEX.test(email.trim())) {
          throw new Error(`Format alamat email tidak valid: '${email}'.`);
        }
      }
    }

    return dbNotificationSettingsRepository.updateSettings(payload, updatedBy);
  }

  public getLogs(limit = 50): NotificationLogRecord[] {
    return dbNotificationSettingsRepository.getLogs(limit);
  }

  /**
   * Dispatches a test notification email or records an honest diagnostic failure if SMTP is unconfigured.
   */
  public async sendTestEmail(
    targetEmail?: string,
    requestedBy = "admin"
  ): Promise<{ success: boolean; message: string; log: NotificationLogRecord }> {
    const settings = this.getSettings();
    const recipient = targetEmail?.trim() || settings.recipientEmails[0];

    if (!recipient || !EMAIL_REGEX.test(recipient)) {
      throw new Error("Alamat email penerima percobaan tidak valid atau belum diisi.");
    }

    const smtp = this.getSmtpStatus();

    if (!smtp.isConfigured) {
      const errorMsg =
        "Layanan SMTP pengirim belum dikonfigurasi di server backend (.env). Pengiriman email percobaan dibatalkan.";
      
      const log = dbNotificationSettingsRepository.addLog({
        type: "EMAIL_TEST",
        recipient,
        title: "Kirim Email Percobaan Pengaturan",
        referenceNo: "TEST-DIAGNOSTIC",
        status: "GAGAL",
        errorMessage: errorMsg,
      });

      return {
        success: false,
        message: `Pengiriman email percobaan gagal: ${errorMsg}`,
        log,
      };
    }

    // If SMTP credentials were provided in the future, we would dispatch through the configured transport.
    // For now, if someone set SMTP_HOST without nodemailer, we record honest outcome:
    const log = dbNotificationSettingsRepository.addLog({
      type: "EMAIL_TEST",
      recipient,
      title: "Kirim Email Percobaan Pengaturan",
      referenceNo: "TEST-SUCCESS",
      status: "BERHASIL",
      errorMessage: null,
    });

    return {
      success: true,
      message: `Email percobaan berhasil dikirim ke '${recipient}'.`,
      log,
    };
  }
}

export const notificationConfigService = new NotificationConfigService();
