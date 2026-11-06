/**
 * Service Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { serviceService } from "../services/serviceService";

export async function getServices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const services = serviceService.getAllServices(activeOnly);
    res.json({
      success: true,
      message: "OK",
      data: services,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getServiceById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const service = serviceService.getServiceById(id);
    res.json({
      success: true,
      message: "OK",
      data: service,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateService(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updated = serviceService.updateService(id, req.body, req.user);
    res.json({
      success: true,
      message: `Layanan '${updated.nama_layanan}' berhasil diperbarui.`,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteService(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = serviceService.deleteService(id, req.user);
    res.json({
      success: true,
      message: result.message || "Operasi selesai.",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
