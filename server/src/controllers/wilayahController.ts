/**
 * Wilayah & Samsat Office Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Request, Response } from "express";
import { dbWilayahRepository } from "../repositories/dbWilayahRepository";
import { db } from "../database/db";

export class WilayahController {
  public getWilayahList(req: Request, res: Response): void {
    try {
      const { provinsi, jenis, search, hasSamsat } = req.query as {
        provinsi?: string;
        jenis?: string;
        search?: string;
        hasSamsat?: string;
      };

      const data = dbWilayahRepository.getAllWilayah({
        provinsi,
        jenis,
        search,
        hasSamsat,
      });

      res.json({
        success: true,
        meta: {
          total: data.length,
          sumber: "Keputusan Menteri Dalam Negeri Nomor 300.2.2-2138 Tahun 2025",
          tahun: 2025,
        },
        data,
      });
    } catch (err: any) {
      console.error("[WilayahController] Error in getWilayahList:", err);
      res.status(500).json({ success: false, message: "Gagal memuat data wilayah administratif" });
    }
  }

  public getProvinces(_req: Request, res: Response): void {
    try {
      const data = dbWilayahRepository.getProvinces();
      res.json({
        success: true,
        meta: {
          total: data.length,
          sumber: "Keputusan Menteri Dalam Negeri Nomor 300.2.2-2138 Tahun 2025",
          tahun: 2025,
        },
        data,
      });
    } catch (err: any) {
      console.error("[WilayahController] Error in getProvinces:", err);
      res.status(500).json({ success: false, message: "Gagal memuat data provinsi" });
    }
  }

  public getWilayahByKode(req: Request, res: Response): void {
    try {
      const kode = String(req.params.kode);
      const data = dbWilayahRepository.getWilayahByKode(kode);
      if (!data) {
        res.status(404).json({ success: false, message: `Wilayah dengan kode '${kode}' tidak ditemukan` });
        return;
      }
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("[WilayahController] Error in getWilayahByKode:", err);
      res.status(500).json({ success: false, message: "Gagal memuat detail wilayah" });
    }
  }

  public getSamsatOffices(_req: Request, res: Response): void {
    try {
      const data = dbWilayahRepository.getAllSamsatOffices();
      res.json({
        success: true,
        meta: { total: data.length },
        data,
      });
    } catch (err: any) {
      console.error("[WilayahController] Error in getSamsatOffices:", err);
      res.status(500).json({ success: false, message: "Gagal memuat data kantor Samsat" });
    }
  }

  public createSamsatOffice(req: Request, res: Response): void {
    try {
      const { name, wilayah, alamat, kode_kabupaten_kota } = req.body;
      if (!name || !wilayah) {
        res.status(400).json({ success: false, message: "Nama Samsat dan Wilayah wajib diisi" });
        return;
      }

      if (kode_kabupaten_kota) {
        const wilayahExists = dbWilayahRepository.getWilayahByKode(kode_kabupaten_kota);
        if (!wilayahExists) {
          res.status(404).json({ success: false, message: `Kode wilayah administratif '${kode_kabupaten_kota}' tidak ditemukan.` });
          return;
        }
      }

      const created = dbWilayahRepository.addSamsatOffice({
        name,
        wilayah,
        alamat,
        kode_kabupaten_kota,
        is_verified: true,
      });

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      console.error("[WilayahController] Error in createSamsatOffice:", err);
      res.status(500).json({ success: false, message: "Gagal menambahkan kantor Samsat" });
    }
  }

  public updateSamsatOffice(req: Request, res: Response): void {
    try {
      const id = String(req.params.id);
      const updates = req.body;

      if (updates.kode_kabupaten_kota) {
        const wilayahExists = dbWilayahRepository.getWilayahByKode(updates.kode_kabupaten_kota);
        if (!wilayahExists) {
          res.status(404).json({ success: false, message: `Kode wilayah administratif '${updates.kode_kabupaten_kota}' tidak ditemukan.` });
          return;
        }
      }

      const updated = dbWilayahRepository.updateSamsatOffice(id, updates);
      if (!updated) {
        res.status(404).json({ success: false, message: "Kantor Samsat tidak ditemukan" });
        return;
      }

      const fresh = dbWilayahRepository.getSamsatOfficeById(id);
      res.json({ success: true, data: fresh });
    } catch (err: any) {
      console.error("[WilayahController] Error in updateSamsatOffice:", err);
      res.status(500).json({ success: false, message: "Gagal memperbarui kantor Samsat" });
    }
  }

  public deleteSamsatOffice(req: Request, res: Response): void {
    try {
      const id = String(req.params.id);

      // Referential integrity check 1: cannot delete if referenced in service_pricing_configs
      const pricingUsage = db.prepare("SELECT COUNT(*) as count FROM service_pricing_configs WHERE samsat_id = ?").get(id) as any;
      if (pricingUsage && pricingUsage.count > 0) {
        res.status(409).json({
          success: false,
          message: `Kantor Samsat '${id}' tidak dapat dihapus karena masih digunakan dalam ${pricingUsage.count} konfigurasi biaya layanan. Silakan nonaktifkan status kantor jika tidak lagi beroperasi.`
        });
        return;
      }

      // Referential integrity check 2: cannot delete if referenced in samsat_operational_tariffs
      const tariffUsage = db.prepare("SELECT COUNT(*) as count FROM samsat_operational_tariffs WHERE samsat_id = ?").get(id) as any;
      if (tariffUsage && tariffUsage.count > 0) {
        res.status(409).json({
          success: false,
          message: `Kantor Samsat '${id}' tidak dapat dihapus karena masih memiliki ${tariffUsage.count} data tarif operasional aktif. Hapus tarif terlebih dahulu atau nonaktifkan status kantor.`
        });
        return;
      }

      // Referential integrity check 3: cannot delete if referenced in historical orders
      const orderUsage = db.prepare(`
        SELECT COUNT(*) as count FROM orders
        WHERE samsat_asal_id = ? OR samsat_tujuan_id = ? OR samsat_asal = ?
      `).get(id, id, id) as any;
      if (orderUsage && orderUsage.count > 0) {
        res.status(409).json({
          success: false,
          message: `Kantor Samsat '${id}' tidak dapat dihapus karena masih direferensikan dalam ${orderUsage.count} riwayat transaksi order. Kantor tidak boleh dihapus untuk menjaga integritas data historis.`
        });
        return;
      }

      const deleted = dbWilayahRepository.deleteSamsatOffice(id);
      if (!deleted) {
        res.status(404).json({ success: false, message: "Kantor Samsat tidak ditemukan" });
        return;
      }
      res.json({ success: true, message: "Kantor Samsat berhasil dihapus" });
    } catch (err: any) {
      console.error("[WilayahController] Error in deleteSamsatOffice:", err);
      res.status(500).json({ success: false, message: "Gagal menghapus kantor Samsat" });
    }
  }
}

export const wilayahController = new WilayahController();
