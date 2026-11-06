/**
 * SQLite Payment Method Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";

export interface PaymentMethodEntity {
  id: string;
  nama_metode: string;
  bank: string;
  nama_rekening: string;
  nomor_rekening: string;
  status: "Aktif" | "Nonaktif";
  created_at?: string;
  updated_at?: string;
}

export class DbPaymentMethodRepository {
  public getAll(): PaymentMethodEntity[] {
    const stmt = db.prepare("SELECT * FROM payment_methods ORDER BY created_at ASC");
    return stmt.all() as PaymentMethodEntity[];
  }

  public getActive(): PaymentMethodEntity[] {
    const stmt = db.prepare("SELECT * FROM payment_methods WHERE status = 'Aktif' ORDER BY created_at ASC");
    return stmt.all() as PaymentMethodEntity[];
  }

  public getById(id: string): PaymentMethodEntity | undefined {
    const stmt = db.prepare("SELECT * FROM payment_methods WHERE id = ?");
    return stmt.get(id) as PaymentMethodEntity | undefined;
  }

  public getByNama(nama: string): PaymentMethodEntity | undefined {
    const stmt = db.prepare("SELECT * FROM payment_methods WHERE LOWER(nama_metode) = LOWER(?)");
    return stmt.get(nama) as PaymentMethodEntity | undefined;
  }

  public getByAccount(bank: string, nomorRekening: string): PaymentMethodEntity | undefined {
    const cleanBank = (bank || "").trim().toLowerCase();
    const cleanNomor = (nomorRekening || "").trim();
    if (!cleanBank || !cleanNomor) return undefined;
    const stmt = db.prepare(`
      SELECT * FROM payment_methods 
      WHERE nama_metode = 'Transfer Bank' 
        AND LOWER(bank) = ? 
        AND nomor_rekening = ?
    `);
    return stmt.get(cleanBank, cleanNomor) as PaymentMethodEntity | undefined;
  }

  public getActiveTunai(): PaymentMethodEntity | undefined {
    const stmt = db.prepare(`
      SELECT * FROM payment_methods 
      WHERE (nama_metode = 'Tunai' OR nama_metode = 'Cash' OR LOWER(bank) = 'tunai' OR LOWER(bank) = 'cash') AND status = 'Aktif'
    `);
    return stmt.get() as PaymentMethodEntity | undefined;
  }

  public create(data: Omit<PaymentMethodEntity, "id" | "created_at" | "updated_at">): PaymentMethodEntity {
    const id = `pm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const stmt = db.prepare(`
      INSERT INTO payment_methods (id, nama_metode, bank, nama_rekening, nomor_rekening, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    stmt.run(
      id,
      data.nama_metode.trim(),
      data.bank.trim(),
      (data.nama_rekening || "").trim(),
      (data.nomor_rekening || "").trim(),
      data.status || "Aktif"
    );
    return this.getById(id)!;
  }

  public update(id: string, updates: Partial<PaymentMethodEntity>): PaymentMethodEntity | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const merged = {
      nama_metode: updates.nama_metode !== undefined ? updates.nama_metode.trim() : existing.nama_metode,
      bank: updates.bank !== undefined ? updates.bank.trim() : existing.bank,
      nama_rekening: updates.nama_rekening !== undefined ? updates.nama_rekening.trim() : existing.nama_rekening,
      nomor_rekening: updates.nomor_rekening !== undefined ? updates.nomor_rekening.trim() : existing.nomor_rekening,
      status: updates.status !== undefined ? updates.status : existing.status,
    };

    const stmt = db.prepare(`
      UPDATE payment_methods
      SET nama_metode = ?, bank = ?, nama_rekening = ?, nomor_rekening = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(
      merged.nama_metode,
      merged.bank,
      merged.nama_rekening,
      merged.nomor_rekening,
      merged.status,
      id
    );

    return this.getById(id)!;
  }

  public isUsedInTransactions(namaMetode: string, id?: string, bank?: string): boolean {
    try {
      // 1. Check in orders table (data_json contains payment)
      const orderStmt = db.prepare(`
        SELECT COUNT(*) as count FROM orders
        WHERE data_json LIKE ? OR data_json LIKE ? OR data_json LIKE ?
      `);
      const escapedMethod = `%"metodePembayaran":"${namaMetode}"%`;
      const escapedMethod2 = `%"metode_pembayaran":"${namaMetode}"%`;
      const escapedBank = bank ? `%"bank":"${bank}"%` : escapedMethod;
      const orderCount = (orderStmt.get(escapedMethod, escapedMethod2, escapedBank) as { count: number }).count;
      if (orderCount > 0) return true;

      // 2. Check in invoice_payments relational table
      const payStmt = db.prepare(`
        SELECT COUNT(*) as count FROM invoice_payments
        WHERE metode_pembayaran_id = ? OR metode_pembayaran = ? OR nama_bank = ?
      `);
      const payCount = (payStmt.get(id || "", namaMetode, bank || "") as { count: number }).count;
      if (payCount > 0) return true;

      return false;
    } catch {
      return false;
    }
  }

  public delete(id: string, allowDeactivate = true): { success: boolean; deactivated?: boolean; message?: string } {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, message: "Metode pembayaran tidak ditemukan" };
    }

    const isUsed = this.isUsedInTransactions(existing.nama_metode, existing.id, existing.bank);
    if (isUsed) {
      if (allowDeactivate) {
        this.update(id, { status: "Nonaktif" });
        return {
          success: true,
          deactivated: true,
          message: `Metode '${existing.nama_metode}' (${existing.bank}) telah digunakan dalam riwayat transaksi sehingga dinonaktifkan (bukan dihapus permanen) untuk menjaga keutuhan riwayat transaksi.`,
        };
      } else {
        return {
          success: false,
          deactivated: false,
          message: `Metode '${existing.nama_metode}' (${existing.bank}) sudah digunakan dalam transaksi dan tidak dapat dihapus permanen. Silakan nonaktifkan metode ini.`,
        };
      }
    }

    const stmt = db.prepare("DELETE FROM payment_methods WHERE id = ?");
    stmt.run(id);
    return {
      success: true,
      deactivated: false,
      message: `Metode '${existing.nama_metode}' (${existing.bank}) berhasil dihapus permanen.`,
    };
  }
}

export const dbPaymentMethodRepository = new DbPaymentMethodRepository();
