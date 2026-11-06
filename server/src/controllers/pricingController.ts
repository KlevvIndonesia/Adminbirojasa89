/**
 * Pricing Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { pricingService } from "../services/pricingService";

export async function getSamsatItems(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = pricingService.getAllSamsatItems();
    res.json({ success: true, message: "OK", data: items, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getSamsatItemById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const item = pricingService.getSamsatItemById(id);
    res.json({ success: true, message: "OK", data: item, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function updateSamsatItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updated = pricingService.updateSamsatItem(id, req.body, req.user);
    res.json({ success: true, message: "Harga Samsat berhasil diperbarui.", data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getAllServicePricing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = pricingService.getAllServicePricing();
    res.json({ success: true, message: "OK", data: items, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function updateServicePricing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updated = pricingService.updateServicePricing(id, req.body, req.user);
    res.json({ success: true, message: "Konfigurasi biaya layanan berhasil disimpan.", data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function createServicePricing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const created = pricingService.createServicePricing(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Konfigurasi biaya layanan berhasil ditambahkan.",
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteServicePricing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    pricingService.deleteServicePricing(id, req.user);
    res.json({
      success: true,
      message: "Konfigurasi biaya layanan berhasil dihapus.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function batchReplicateServicePricing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = pricingService.batchReplicateServicePricing(req.body, req.user);
    res.json({
      success: true,
      message: `Replikasi massal biaya layanan berhasil diterapkan (${result.updatedCount} diperbarui, ${result.preservedCount} tarif khusus dipertahankan).`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// ─── SAMSAT OPERATIONAL TARIFFS (PER-SAMSAT) CONTROLLER ──────────────────────

export async function getSamsatOperationalTariffs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const samsatId = typeof req.query.samsatId === "string" ? req.query.samsatId : undefined;
    const items = pricingService.getSamsatOperationalTariffs(samsatId);
    res.json({ success: true, message: "OK", data: items, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function updateSamsatOperationalTariffs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { samsatId, pricingItemId, nominal, tariffs } = req.body;
    let result: any;

    if (Array.isArray(tariffs)) {
      result = pricingService.upsertBatchSamsatOperationalTariffs(samsatId, tariffs, req.user);
    } else {
      result = pricingService.upsertSamsatOperationalTariff({ samsatId, pricingItemId, nominal }, req.user);
    }

    res.json({
      success: true,
      message: "Tarif operasional Samsat berhasil disimpan.",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getEffectivePricing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const samsatId = typeof req.query.samsatId === "string" ? req.query.samsatId : "";
    const jurisdiction = (req.query.jurisdiction as any) || "STANDARD";
    const pricing = pricingService.getEffectivePricing(samsatId, jurisdiction);
    res.json({ success: true, message: "OK", data: pricing, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function deleteSamsatOperationalTariff(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const samsatId = typeof req.query.samsatId === "string" ? req.query.samsatId : undefined;
    const pricingItemId = typeof req.query.pricingItemId === "string" ? req.query.pricingItemId : undefined;

    const result = pricingService.deleteSamsatOperationalTariff(
      id ? id : { samsatId, pricingItemId },
      req.user
    );

    res.json({
      success: true,
      message: result.reverted
        ? "Tarif override Samsat berhasil direset ke default nasional."
        : "Tarif sudah menggunakan default nasional.",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
