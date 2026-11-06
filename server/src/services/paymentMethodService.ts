/**
 * Payment Method Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { dbPaymentMethodRepository, PaymentMethodEntity } from "../repositories/dbPaymentMethodRepository";
import { ApiError } from "../middleware/errorHandler";

export class PaymentMethodService {
  public getAll(activeOnly = false): PaymentMethodEntity[] {
    return activeOnly ? dbPaymentMethodRepository.getActive() : dbPaymentMethodRepository.getAll();
  }

  public getById(id: string): PaymentMethodEntity | undefined {
    return dbPaymentMethodRepository.getById(id);
  }

  public create(data: {
    nama_metode: string;
    bank?: string;
    nama_rekening?: string;
    nomor_rekening?: string;
    status?: "Aktif" | "Nonaktif";
  }): PaymentMethodEntity {
    const rawNama = (data.nama_metode || "").trim();
    if (!rawNama) {
      throw new ApiError(400, "VALIDATION_ERROR", "Metode pembayaran wajib dipilih.");
    }

    let namaMetode = rawNama;
    if (rawNama.toLowerCase() === "cash" || rawNama.toLowerCase() === "tunai") {
      namaMetode = "Tunai";
    } else if (rawNama.toLowerCase() === "transfer bank" || rawNama.toLowerCase().includes("transfer")) {
      namaMetode = "Transfer Bank";
    } else {
      throw new ApiError(400, "VALIDATION_ERROR", "Metode pembayaran hanya boleh 'Transfer Bank' atau 'Tunai'.");
    }

    const status = data.status || "Aktif";

    // ─── CASE 1: TUNAI ──────────────────────────────────────────────────────────
    if (namaMetode === "Tunai") {
      // Enforcement: Hanya boleh ada 1 record Tunai aktif
      if (status === "Aktif") {
        const activeTunai = dbPaymentMethodRepository.getActiveTunai();
        if (activeTunai) {
          throw new ApiError(409, "DUPLICATE_TUNAI", "Metode pembayaran Tunai yang aktif sudah terdaftar. Hanya diperbolehkan satu metode Tunai aktif.");
        }
      }

      // Bersihkan nilai bank dan rekening lama
      return dbPaymentMethodRepository.create({
        nama_metode: "Tunai",
        bank: "Tunai",
        nama_rekening: "",
        nomor_rekening: "",
        status,
      });
    }

    // ─── CASE 2: TRANSFER BANK ─────────────────────────────────────────────────
    const bank = (data.bank || "").trim();
    if (!bank) {
      throw new ApiError(400, "VALIDATION_ERROR", "Bank / penyedia pembayaran wajib diisi untuk transfer bank.");
    }

    const namaRekening = (data.nama_rekening || "").trim();
    if (!namaRekening) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nama pemilik rekening wajib diisi untuk transfer bank.");
    }

    const nomorRekening = (data.nomor_rekening || "").trim();
    if (!nomorRekening) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nomor rekening wajib diisi untuk transfer bank.");
    }

    // Rejection: Duplikasi rekening yang sama ditolak
    const duplicate = dbPaymentMethodRepository.getByAccount(bank, nomorRekening);
    if (duplicate) {
      throw new ApiError(409, "DUPLICATE_ACCOUNT", `Rekening ${bank} dengan nomor '${nomorRekening}' sudah terdaftar.`);
    }

    return dbPaymentMethodRepository.create({
      nama_metode: "Transfer Bank",
      bank,
      nama_rekening: namaRekening,
      nomor_rekening: nomorRekening,
      status,
    });
  }

  public update(id: string, updates: Partial<PaymentMethodEntity>): PaymentMethodEntity {
    const existing = dbPaymentMethodRepository.getById(id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Metode pembayaran tidak ditemukan.");
    }

    let namaMetode = existing.nama_metode;
    if (updates.nama_metode !== undefined) {
      const rawNama = updates.nama_metode.trim();
      if (!rawNama) throw new ApiError(400, "VALIDATION_ERROR", "Metode pembayaran tidak boleh kosong.");
      if (rawNama.toLowerCase() === "cash" || rawNama.toLowerCase() === "tunai") {
        namaMetode = "Tunai";
      } else if (rawNama.toLowerCase() === "transfer bank" || rawNama.toLowerCase().includes("transfer")) {
        namaMetode = "Transfer Bank";
      } else {
        throw new ApiError(400, "VALIDATION_ERROR", "Metode pembayaran hanya boleh 'Transfer Bank' atau 'Tunai'.");
      }
    }

    const status = updates.status !== undefined ? updates.status : existing.status;

    // ─── CASE 1: TUNAI ──────────────────────────────────────────────────────────
    if (namaMetode === "Tunai") {
      // Enforcement: Hanya boleh ada 1 record Tunai aktif
      if (status === "Aktif") {
        const activeTunai = dbPaymentMethodRepository.getActiveTunai();
        if (activeTunai && activeTunai.id !== id) {
          throw new ApiError(409, "DUPLICATE_TUNAI", "Metode pembayaran Tunai yang aktif sudah terdaftar. Hanya diperbolehkan satu metode Tunai aktif.");
        }
      }

      // Bersihkan nilai bank & rekening lama
      const updated = dbPaymentMethodRepository.update(id, {
        nama_metode: "Tunai",
        bank: "Tunai",
        nama_rekening: "",
        nomor_rekening: "",
        status,
      });

      if (!updated) throw new ApiError(500, "UPDATE_FAILED", "Gagal memperbarui metode pembayaran.");
      return updated;
    }

    // ─── CASE 2: TRANSFER BANK ─────────────────────────────────────────────────
    const bank = updates.bank !== undefined ? updates.bank.trim() : (existing.bank === "Tunai" ? "" : existing.bank);
    if (!bank) {
      throw new ApiError(400, "VALIDATION_ERROR", "Bank / penyedia pembayaran wajib diisi untuk transfer bank.");
    }

    const namaRekening = updates.nama_rekening !== undefined ? updates.nama_rekening.trim() : existing.nama_rekening;
    if (!namaRekening) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nama pemilik rekening wajib diisi untuk transfer bank.");
    }

    const nomorRekening = updates.nomor_rekening !== undefined ? updates.nomor_rekening.trim() : existing.nomor_rekening;
    if (!nomorRekening) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nomor rekening wajib diisi untuk transfer bank.");
    }

    // Rejection: Duplikasi rekening yang sama ditolak (kecuali record yang sedang diedit)
    const duplicate = dbPaymentMethodRepository.getByAccount(bank, nomorRekening);
    if (duplicate && duplicate.id !== id) {
      throw new ApiError(409, "DUPLICATE_ACCOUNT", `Rekening ${bank} dengan nomor '${nomorRekening}' sudah digunakan oleh data metode pembayaran lain.`);
    }

    const updated = dbPaymentMethodRepository.update(id, {
      nama_metode: "Transfer Bank",
      bank,
      nama_rekening: namaRekening,
      nomor_rekening: nomorRekening,
      status,
    });

    if (!updated) throw new ApiError(500, "UPDATE_FAILED", "Gagal memperbarui metode pembayaran.");
    return updated;
  }

  public delete(id: string): { success: boolean; deactivated?: boolean; message: string } {
    const res = dbPaymentMethodRepository.delete(id, true);
    if (!res.success && !res.deactivated) {
      throw new ApiError(400, "DELETE_FAILED", res.message || "Gagal menghapus metode pembayaran.");
    }
    return {
      success: res.success,
      deactivated: res.deactivated,
      message: res.message || "Metode pembayaran berhasil diproses.",
    };
  }
}

export const paymentMethodService = new PaymentMethodService();
