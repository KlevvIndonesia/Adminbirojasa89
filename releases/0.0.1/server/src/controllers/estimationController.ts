/**
 * Estimation Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { estimationService } from "../services/estimationService";

export async function getTemplates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const templates = estimationService.getAllTemplates();
    res.json({ success: true, message: "OK", data: templates, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getTemplateById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const template = estimationService.getTemplateById(id);
    res.json({ success: true, message: "OK", data: template, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updated = estimationService.updateTemplate(id, req.body, req.user);
    res.json({
      success: true,
      message: `Konfigurasi template '${updated.name}' berhasil diperbarui.`,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function resetTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const reset = estimationService.resetTemplate(id, req.user);
    res.json({
      success: true,
      message: `Template '${reset.name}' berhasil direset ke acuan resmi workbook.`,
      data: reset,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function resetAllTemplates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const templates = estimationService.resetAllTemplates(req.user);
    res.json({
      success: true,
      message: "Semua template estimasi berhasil direset ke standar resmi.",
      data: templates,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
