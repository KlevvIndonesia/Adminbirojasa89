/**
 * Payment Method Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { paymentMethodService } from "../services/paymentMethodService";

export async function getPaymentMethods(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const methods = paymentMethodService.getAll(activeOnly);
    res.json({ success: true, message: "OK", data: methods, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getPaymentMethodById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const method = paymentMethodService.getById(id);
    if (!method) {
      res.status(404).json({ success: false, message: "Metode pembayaran tidak ditemukan" });
      return;
    }
    res.json({ success: true, message: "OK", data: method, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function createPaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const created = paymentMethodService.create(req.body, req.user);
    res.status(201).json({
      success: true,
      message: `Metode pembayaran '${created.nama_metode}' berhasil ditambahkan.`,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updated = paymentMethodService.update(id, req.body, req.user);
    res.json({
      success: true,
      message: `Metode pembayaran '${updated.nama_metode}' berhasil diperbarui.`,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function deletePaymentMethod(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = paymentMethodService.delete(id, req.user);
    res.json({
      success: true,
      deactivated: result.deactivated,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
