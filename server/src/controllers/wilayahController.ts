/**
 * Wilayah & Samsat Office Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Request, Response } from "express";
import { dbWilayahRepository } from "../repositories/dbWilayahRepository";
import { db } from "../database/db";
import { normalizeSamsatOfficeName } from "../utils/samsatNaming";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { AuthenticatedRequest } from "../middleware/auth";

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

      // Enforce official administrative district on Samsat creation
      if (!kode_kabupaten_kota) {
        res.status(400).json({ success: false, message: "Kode wilayah administratif kabupaten/kota wajib diisi." });
        return;
      }

      const wilayahRecord = dbWilayahRepository.getWilayahByKode(kode_kabupaten_kota);
      if (!wilayahRecord) {
        res.status(404).json({ success: false, message: `Kode wilayah administratif '${kode_kabupaten_kota}' tidak ditemukan.` });
        return;
      }

      const normalizedName = normalizeSamsatOfficeName(
        name,
        wilayahRecord?.jenis_wilayah,
        wilayahRecord?.nama_kabupaten_kota || wilayah
      );

      const created = dbWilayahRepository.addSamsatOffice({
        name: normalizedName,
        wilayah,
        alamat,
        kode_kabupaten_kota,
        is_verified: true,
      });

      // Audit Trail Logging
      const user = (req as AuthenticatedRequest).user;
      try {
        dbAuditRepository.save({
          id: `log-samsat-crt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: user?.userId || "usr-system",
          userName: user?.nama || "Admin API",
          userRole: user?.role || "admin",
          action: "CREATE",
          module: "Master Data - Samsat",
          details: `Menambahkan kantor Samsat baru '${created.name}' (${created.wilayah}) dengan kode wilayah Kemendagri ${kode_kabupaten_kota}.`,
          metadata: {
            recordId: created.id,
            oldData: null,
            newData: created,
          },
          createdAt: new Date().toISOString(),
        });
      } catch (auditErr) {
        console.warn("[WilayahController] Failed to save audit log:", auditErr);
      }

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

      const existing = dbWilayahRepository.getSamsatOfficeById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: "Kantor Samsat tidak ditemukan" });
        return;
      }

      let wilayahRecord = null;
      const targetKode = updates.kode_kabupaten_kota || existing.kode_kabupaten_kota;
      if (targetKode) {
        wilayahRecord = dbWilayahRepository.getWilayahByKode(targetKode);
        if (updates.kode_kabupaten_kota && !wilayahRecord) {
          res.status(404).json({ success: false, message: `Kode wilayah administratif '${updates.kode_kabupaten_kota}' tidak ditemukan.` });
          return;
        }
      }

      const normalizedUpdates = { ...updates };
      if (updates.name) {
        normalizedUpdates.name = normalizeSamsatOfficeName(
          updates.name,
          wilayahRecord?.jenis_wilayah,
          wilayahRecord?.nama_kabupaten_kota || updates.wilayah || existing.wilayah
        );
      }

      const updated = dbWilayahRepository.updateSamsatOffice(id, normalizedUpdates);
      if (!updated) {
        res.status(404).json({ success: false, message: "Kantor Samsat tidak ditemukan" });
        return;
      }

      const fresh = dbWilayahRepository.getSamsatOfficeById(id);

      // Audit Trail Logging
      const user = (req as AuthenticatedRequest).user;
      try {
        dbAuditRepository.save({
          id: `log-samsat-upd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: user?.userId || "usr-system",
          userName: user?.nama || "Admin API",
          userRole: user?.role || "admin",
          action: "UPDATE",
          module: "Master Data - Samsat",
          details: `Memperbarui data kantor Samsat '${fresh?.name || id}'.`,
          metadata: {
            recordId: id,
            oldData: existing,
            newData: fresh,
          },
          createdAt: new Date().toISOString(),
        });
      } catch (auditErr) {
        console.warn("[WilayahController] Failed to save audit log:", auditErr);
      }

      res.json({ success: true, data: fresh });
    } catch (err: any) {
      console.error("[WilayahController] Error in updateSamsatOffice:", err);
      res.status(500).json({ success: false, message: "Gagal memperbarui kantor Samsat" });
    }
  }

  public deleteSamsatOffice(req: Request, res: Response): void {
    try {
      const id = String(req.params.id);

      const existing = dbWilayahRepository.getSamsatOfficeById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: "Kantor Samsat tidak ditemukan" });
        return;
      }

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

      // Audit Trail Logging
      const user = (req as AuthenticatedRequest).user;
      try {
        dbAuditRepository.save({
          id: `log-samsat-del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: user?.userId || "usr-system",
          userName: user?.nama || "Admin API",
          userRole: user?.role || "admin",
          action: "DELETE",
          module: "Master Data - Samsat",
          details: `Menghapus kantor Samsat '${existing.name}' (${id}).`,
          metadata: {
            recordId: id,
            oldData: existing,
            newData: null,
          },
          createdAt: new Date().toISOString(),
        });
      } catch (auditErr) {
        console.warn("[WilayahController] Failed to save audit log:", auditErr);
      }

      res.json({ success: true, message: "Kantor Samsat berhasil dihapus" });
    } catch (err: any) {
      console.error("[WilayahController] Error in deleteSamsatOffice:", err);
      res.status(500).json({ success: false, message: "Gagal menghapus kantor Samsat" });
    }
  }
}

export const wilayahController = new WilayahController();
