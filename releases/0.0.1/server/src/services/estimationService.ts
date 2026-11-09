/**
 * Estimation Domain Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { dbEstimationRepository } from "../repositories/dbEstimationRepository";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { EstimationTemplateConfig, EstimationComponentRule } from "../../../src/domain/estimation/types";
import {
  DEFAULT_R4_ANNUAL_TEMPLATE,
  DEFAULT_R2_ANNUAL_TEMPLATE,
  DEFAULT_R4_5YEAR_TEMPLATE,
  DEFAULT_R2_5YEAR_TEMPLATE,
  DEFAULT_R4_BBN_TEMPLATE,
  DEFAULT_R2_BBN_TEMPLATE,
  DEFAULT_R4_MUTASI_AS_TEMPLATE,
  DEFAULT_R2_MUTASI_AS_TEMPLATE,
  DEFAULT_R4_MUTASI_LD_TEMPLATE,
  DEFAULT_R2_MUTASI_LD_TEMPLATE,
} from "../../../src/domain/estimation/defaultTemplates";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../utils/crypto";
import { sanitizeEstimationTemplate } from "../../../src/app/data/estimationStore";

export const CANONICAL_DEFAULT_TEMPLATES: EstimationTemplateConfig[] = [
  DEFAULT_R4_ANNUAL_TEMPLATE,
  DEFAULT_R2_ANNUAL_TEMPLATE,
  DEFAULT_R4_5YEAR_TEMPLATE,
  DEFAULT_R2_5YEAR_TEMPLATE,
  DEFAULT_R4_BBN_TEMPLATE,
  DEFAULT_R2_BBN_TEMPLATE,
  DEFAULT_R4_MUTASI_AS_TEMPLATE,
  DEFAULT_R2_MUTASI_AS_TEMPLATE,
  DEFAULT_R4_MUTASI_LD_TEMPLATE,
  DEFAULT_R2_MUTASI_LD_TEMPLATE,
].map(sanitizeEstimationTemplate);

export class EstimationService {
  public getAllTemplates(): EstimationTemplateConfig[] {
    const templates = dbEstimationRepository.getAllTemplates();
    if (templates.length === 0) {
      // Seed on demand if database was freshly initialized
      dbEstimationRepository.resetAll(CANONICAL_DEFAULT_TEMPLATES);
      return dbEstimationRepository.getAllTemplates().map(sanitizeEstimationTemplate);
    }
    // Check and auto-migrate any templates in the database that still contain legacy text
    let hasLegacy = false;
    const sanitized = templates.map((tpl) => {
      const clean = sanitizeEstimationTemplate(tpl);
      if (JSON.stringify(clean) !== JSON.stringify(tpl)) {
        hasLegacy = true;
        return clean;
      }
      return tpl;
    });
    if (hasLegacy) {
      for (const tpl of sanitized) {
        dbEstimationRepository.saveTemplate(tpl);
      }
    }
    return sanitized;
  }

  public getTemplateById(id: string): EstimationTemplateConfig {
    const template = dbEstimationRepository.getTemplateById(id);
    if (!template) {
      const def = CANONICAL_DEFAULT_TEMPLATES.find((t) => t.id === id);
      if (def) {
        const cleanDef = sanitizeEstimationTemplate(def);
        dbEstimationRepository.saveTemplate(cleanDef);
        return cleanDef;
      }
      throw new ApiError(404, "TEMPLATE_NOT_FOUND", `Template estimasi '${id}' tidak ditemukan.`);
    }
    const clean = sanitizeEstimationTemplate(template);
    if (JSON.stringify(clean) !== JSON.stringify(template)) {
      dbEstimationRepository.saveTemplate(clean);
    }
    return clean;
  }

  public updateTemplate(
    id: string,
    updates: Partial<EstimationTemplateConfig>,
    user?: TokenPayload | null
  ): EstimationTemplateConfig {
    const existing = this.getTemplateById(id);

    // Validate structured numeric parameters
    if (updates.koefisienDenda !== undefined) {
      const kd = Number(updates.koefisienDenda);
      if (isNaN(kd) || kd < 0 || kd > 5) {
        throw new ApiError(400, "INVALID_PARAMETER", "Koefisien denda harus berupa angka antara 0 dan 5.");
      }
    }

    if (updates.pembagiBulan !== undefined) {
      const pb = Number(updates.pembagiBulan);
      if (isNaN(pb) || pb <= 0 || pb > 60) {
        throw new ApiError(400, "INVALID_PARAMETER", "Pembagi bulan harus berupa angka positif antara 1 dan 60.");
      }
    }

    if (updates.kelipatanPembulatan !== undefined) {
      const kp = Number(updates.kelipatanPembulatan);
      if (isNaN(kp) || kp < 1) {
        throw new ApiError(400, "INVALID_PARAMETER", "Kelipatan pembulatan harus berupa bilangan bulat minimal 1.");
      }
    }

    // Merge template safely
    const updated: EstimationTemplateConfig = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      serviceType: existing.serviceType, // Immutable service type
      vehicleType: existing.vehicleType, // Immutable vehicle type
      components: updates.components ? updates.components : existing.components,
      accIdRates: updates.accIdRates ? { ...existing.accIdRates, ...updates.accIdRates } : existing.accIdRates,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.nama || "Admin API",
    };

    const success = dbEstimationRepository.saveTemplate(updated);
    if (!success) {
      throw new ApiError(500, "UPDATE_FAILED", `Gagal memperbarui template estimasi ${id}`);
    }

    dbAuditRepository.save({
      id: `log-est-upd-${Date.now()}`,
      userId: user?.userId || "usr-system",
      userName: user?.nama || "Admin API",
      userRole: user?.role || "admin",
      action: "UPDATE_ESTIMATION_TEMPLATE",
      module: "Master Data Biaya Layanan",
      details: `Memperbarui konfigurasi template ${updated.name}`,
      metadata: { templateId: id, updates },
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  public resetTemplate(id: string, user?: TokenPayload | null): EstimationTemplateConfig {
    const def = CANONICAL_DEFAULT_TEMPLATES.find((t) => t.id === id);
    if (!def) {
      throw new ApiError(404, "TEMPLATE_NOT_FOUND", `Acuan resmi default untuk template '${id}' tidak ditemukan.`);
    }

    const resetTemplate: EstimationTemplateConfig = {
      ...def,
      components: def.components.map((c) => ({ ...c })),
      accIdRates: { ...def.accIdRates },
      updatedAt: new Date().toISOString(),
      updatedBy: `${user?.nama || "Admin API"} (Reset Default)`,
    };

    dbEstimationRepository.resetTemplate(resetTemplate);

    dbAuditRepository.save({
      id: `log-est-reset-${Date.now()}`,
      userId: user?.userId || "usr-system",
      userName: user?.nama || "Admin API",
      userRole: user?.role || "admin",
      action: "RESET_ESTIMATION_TEMPLATE",
      module: "Master Data Biaya Layanan",
      details: `Mereset template ${resetTemplate.name} ke Standar Resmi Default Workbook`,
      metadata: { templateId: id },
      createdAt: new Date().toISOString(),
    });

    return resetTemplate;
  }

  public resetAllTemplates(user?: TokenPayload | null): EstimationTemplateConfig[] {
    const templates = CANONICAL_DEFAULT_TEMPLATES.map((tpl) => ({
      ...tpl,
      components: tpl.components.map((c) => ({ ...c })),
      accIdRates: { ...tpl.accIdRates },
      updatedAt: new Date().toISOString(),
      updatedBy: `${user?.nama || "Admin API"} (Reset All Default)`,
    }));

    dbEstimationRepository.resetAll(templates);

    dbAuditRepository.save({
      id: `log-est-reset-all-${Date.now()}`,
      userId: user?.userId || "usr-system",
      userName: user?.nama || "Admin API",
      userRole: user?.role || "admin",
      action: "RESET_ALL_ESTIMATION_TEMPLATES",
      module: "Master Data Biaya Layanan",
      details: "Mereset semua 10 template estimasi ke Standar Resmi Default Workbook",
      metadata: { count: templates.length },
      createdAt: new Date().toISOString(),
    });

    return templates;
  }
}

export const estimationService = new EstimationService();
