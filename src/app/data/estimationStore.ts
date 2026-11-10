/**
 * Estimation Template Store & Persistence
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Provides reactive state management, persistent SQLite/Express API synchronization,
 * and localStorage fallback for estimation templates and component configurations.
 */

import { useState, useEffect } from "react";
import {
  EstimationTemplateConfig,
  EstimationComponentRule,
  EstimationInput,
  EstimationResult,
} from "../../domain/estimation/types";
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
} from "../../domain/estimation/defaultTemplates";
import { calculateEstimation, defaultRuleRegistry } from "../../domain/estimation/estimationEngine";
import { getStandardJasa } from "../../domain/pricing/pricingResolver";
import { auditLog } from "../utils/auditLog";
import { APP_CONFIG } from "../config/appConfig";

const STORAGE_KEY = "sun89_estimation_templates_v5";
const LEGACY_STORAGE_KEYS = [
  "sun89_estimation_templates_v4",
  "sun89_estimation_templates_v3",
  "sun89_estimation_templates_v2",
  "sun89_estimation_templates",
];

/**
 * Clean sanitization for formula & component descriptions.
 * Eliminates all Excel cell references (e.g. Cell C15, (Cell F15)), Sheet names,
 * and converts raw ROUNDUP expressions into clean, professional Indonesian descriptions.
 */
export function sanitizeComponentDescription(desc: string | undefined): string {
  if (!desc) return "";
  let s = desc;

  // 1. Remove Excel cell references and sheet references
  // e.g., (Cell C15), (Cell F15), (Sheet 5), Cell C15, Sheet 5, etc.
  s = s.replace(/\s*\((?:Cell|Sheet)\s*[^)]+\)/gi, "");
  s = s.replace(/\b(?:Cell|Sheet)\s+[A-Z0-9/]+/gi, "");
  s = s.replace(/\s*\(\s*\)/g, ""); // Remove empty parentheses if left

  // 2. Transform raw ROUNDUP formulas into friendly Indonesian text
  // e.g. ROUNDUP(PKB Tertunggak × Koefisien Denda, -3)
  // e.g. ROUNDUP(PKB Dasar × Koefisien Denda / 12 × Bulan Tunggakan, -3)
  s = s.replace(/ROUNDUP\s*\(([^,;]+)[,;]\s*-?3?\s*\)/gi, "$1, dibulatkan ke kelipatan Rp 1.000");

  // 3. Fix division symbol / with ÷ for consistent formatting
  s = s.replace(/\s*\/\s*12\s*[\*×]/g, " ÷ 12 × ");

  // 4. Transform specific technical formula descriptions into standard friendly text
  const trimmed = s.trim();

  if (/PKB Tertunggak\s*[×x*]\s*Koefisien Denda/i.test(trimmed)) {
    return "PKB Tertunggak × Koefisien Denda, dibulatkan ke kelipatan Rp 1.000";
  }
  if (/PKB Dasar\s*[×x*]\s*Koefisien Denda.*Bulan Tunggakan/i.test(trimmed)) {
    return "PKB Dasar × Koefisien Denda ÷ 12 × Bulan Tunggakan, dibulatkan ke kelipatan Rp 1.000";
  }
  if (/^PKB Dasar$/i.test(trimmed) || /^PKB Dasar\s*\(1 Tahun Berjalan\)$/i.test(trimmed)) {
    return "PKB Dasar";
  }
  if (/^PKB Dasar\s*[×x*]\s*Tahun Tunggakan$/i.test(trimmed)) {
    return "PKB Dasar × Tahun Tunggakan";
  }
  if (/^SWDKLLJ Pokok Tahunan.*$/i.test(trimmed)) {
    return "SWDKLLJ Pokok Tahunan";
  }
  if (/^SWDKLLJ Pokok.*[×x*]\s*Tahun Tunggakan/i.test(trimmed)) {
    return "SWDKLLJ Pokok × Tahun Tunggakan";
  }
  if (/^(?:Rp\s*[\d.]+\s*[×x*]\s*Tahun Tunggakan|Denda SWDKLLJ.*Tahun Tunggakan)/i.test(trimmed)) {
    return "Denda SWDKLLJ berdasarkan Tahun Tunggakan";
  }
  if (/^(?:Rp\s*[\d.]+\s*jika Bulan Tunggakan|Denda SWDKLLJ.*Bulan Tunggakan)/i.test(trimmed)) {
    return "Denda SWDKLLJ berdasarkan Bulan Tunggakan";
  }
  if (/^Rp\s*[\d.]+\s*jika terdapat keterlambatan/i.test(trimmed) || /^Biaya cetak SKP jika terdapat keterlambatan/i.test(trimmed)) {
    return "Biaya cetak SKP jika terdapat keterlambatan";
  }

  return trimmed;
}

/**
 * Recursively sanitizes an EstimationTemplateConfig to ensure all component descriptions,
 * formula conditions, and human formulas are free from Excel cell references and synchronized
 * with the canonical pricing Single Source of Truth (Biaya Layanan).
 */
export function sanitizeEstimationTemplate(tpl: EstimationTemplateConfig): EstimationTemplateConfig {
  if (!tpl) return tpl;
  const canonicalService = tpl.serviceType === "Mutasi Luar Daerah"
    ? "Mutasi Luar Daerah"
    : tpl.serviceType === "Mutasi Antar Samsat"
    ? "Mutasi Antar Samsat"
    : tpl.serviceType === "Balik Nama"
    ? "Balik Nama"
    : tpl.serviceType === "Tahunan"
    ? "Perpanjangan 1 Tahun"
    : tpl.serviceType === "5 Tahunan"
    ? "Perpanjangan 5 Tahun"
    : tpl.serviceType;

  const vehicle: "Mobil" | "Motor" = tpl.vehicleType === "Motor" ? "Motor" : "Mobil";
  const standardJasa = getStandardJasa(canonicalService, vehicle);

  let effectiveBiayaJasa = tpl.biayaJasa;
  if (tpl.serviceType === "Mutasi Luar Daerah") {
    effectiveBiayaJasa = vehicle === "Mobil" ? 1500000 : 500000;
  }

  return {
    ...tpl,
    biayaJasa: effectiveBiayaJasa,
    components: (tpl.components || []).map((comp) => {
      const isJasaComp = comp.category === "JASA" || comp.ruleId === "PROSES_DAN_JASA_MUTASI" || comp.ruleId === "JASA" || comp.code === "FEE-01" || comp.id === "proses-dan-jasa";
      if (isJasaComp && tpl.serviceType === "Mutasi Luar Daerah") {
        return {
          ...comp,
          defaultValue: vehicle === "Mobil" ? 1500000 : 500000,
          description: `Biaya Proses dan Jasa Mutasi LD ${vehicle === "Mobil" ? "Mobil Rp 1.500.000" : "Motor Rp 500.000"}`,
          formulaCondition: comp.formulaCondition ? sanitizeComponentDescription(comp.formulaCondition) : undefined,
          humanFormula: comp.humanFormula ? sanitizeComponentDescription(comp.humanFormula) : undefined,
        };
      }
      return {
        ...comp,
        description: sanitizeComponentDescription(comp.description),
        formulaCondition: comp.formulaCondition ? sanitizeComponentDescription(comp.formulaCondition) : undefined,
        humanFormula: comp.humanFormula ? sanitizeComponentDescription(comp.humanFormula) : undefined,
      };
    }),
  };
}

export const ALL_DEFAULT_TEMPLATES: EstimationTemplateConfig[] = [
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

class EstimationStore {
  private templates: Map<string, EstimationTemplateConfig> = new Map();
  private listeners: Set<() => void> = new Set();
  private isLoadedFromStorage = false;
  private baseUrl: string;

  constructor(baseUrl = APP_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    for (const tpl of ALL_DEFAULT_TEMPLATES) {
      const sanitized = sanitizeEstimationTemplate(tpl);
      this.templates.set(sanitized.id, {
        ...sanitized,
        components: sanitized.components.map((c) => ({ ...c })),
        accIdRates: { ...sanitized.accIdRates },
      });
    }
    this.loadFromStorage();
    this.initFromBackend();
  }

  private getAuthHeader(): Record<string, string> {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const token = window.localStorage.getItem("auth_token");
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
      }
      if (typeof process !== "undefined" && process.env?.AUTH_TOKEN) {
        return { Authorization: `Bearer ${process.env.AUTH_TOKEN}` };
      }
    } catch {
      // ignore
    }
    return {};
  }

  public async initFromBackend(): Promise<void> {
    if (typeof window === "undefined" && typeof fetch === "undefined") return;
    try {
      const res = await fetch(`${this.baseUrl}/estimation/templates`, {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload?.success && Array.isArray(payload.data) && payload.data.length > 0) {
          for (const item of payload.data) {
            if (item && item.id) {
              const sanitized = sanitizeEstimationTemplate(item);
              this.templates.set(sanitized.id, sanitized);
            }
          }
          this.persist();
          this.notify();
        }
      }
    } catch {
      // Fallback silently to localStorage and defaults
    }
  }

  private loadFromStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      let raw = window.localStorage.getItem(STORAGE_KEY);
      let loadedFromLegacy = false;

      // Migrate from legacy v2 or v1 storage keys if v3 not present yet
      if (!raw) {
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          const legacyRaw = window.localStorage.getItem(legacyKey);
          if (legacyRaw) {
            raw = legacyRaw;
            loadedFromLegacy = true;
            break;
          }
        }
      }

      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id) {
              if (item.id === "template-mutasi-ld-r4" && item.biayaJasa === 750000) {
                item.biayaJasa = 1500000;
                const jasaComp = item.components?.find((c: any) => c.id === "proses-dan-jasa" || c.code === "FEE-01");
                if (jasaComp && jasaComp.defaultValue === 750000) {
                  jasaComp.defaultValue = 1500000;
                  jasaComp.description = "Biaya Proses dan Jasa Mutasi LD Mobil Rp 1.500.000";
                }
              }
              const sanitized = sanitizeEstimationTemplate(item);
              this.templates.set(sanitized.id, sanitized);
            }
          }
          this.isLoadedFromStorage = true;
          // Persist cleanly to modern v3 key and clean up legacy storage keys
          this.persist();
          if (loadedFromLegacy) {
            for (const legacyKey of LEGACY_STORAGE_KEYS) {
              try {
                window.localStorage.removeItem(legacyKey);
              } catch {
                // ignore
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[EstimationStore] Failed to load templates from localStorage:", err);
    }
  }

  private persist(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const arr = Array.from(this.templates.values()).map(sanitizeEstimationTemplate);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (err) {
      console.warn("[EstimationStore] Failed to persist templates to localStorage:", err);
    }
  }

  private syncToBackend(template: EstimationTemplateConfig): void {
    if (typeof window === "undefined" && typeof fetch === "undefined") return;
    const cleanTemplate = sanitizeEstimationTemplate(template);
    fetch(`${this.baseUrl}/estimation/templates/${encodeURIComponent(cleanTemplate.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      body: JSON.stringify(cleanTemplate),
    }).catch((err) => {
      console.warn("[EstimationStore] Background backend sync failed (offline fallback active):", err);
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error("Error in EstimationStore listener:", err);
      }
    });
  }

  public getTemplate(id = "template-pajak-tahunan-r4"): EstimationTemplateConfig {
    const tpl = this.templates.get(id);
    if (!tpl) {
      const def = ALL_DEFAULT_TEMPLATES.find((t) => t.id === id);
      if (def) return sanitizeEstimationTemplate(def);
      return sanitizeEstimationTemplate(DEFAULT_R4_ANNUAL_TEMPLATE);
    }
    return sanitizeEstimationTemplate(tpl);
  }

  public getAllTemplates(): EstimationTemplateConfig[] {
    return Array.from(this.templates.values()).map(sanitizeEstimationTemplate);
  }

  public updateTemplate(updatedTemplate: EstimationTemplateConfig): boolean {
    if (!updatedTemplate || !updatedTemplate.id) return false;
    const cleanTemplate = sanitizeEstimationTemplate(updatedTemplate);
    this.templates.set(cleanTemplate.id, cleanTemplate);
    this.persist();
    this.notify();
    this.syncToBackend(updatedTemplate);

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin Estimasi",
        userRole: "admin",
        action: "UPDATE",
        module: "Estimasi",
        details: `Template ${updatedTemplate.name} diperbarui`,
        metadata: { templateId: updatedTemplate.id },
      });
    } catch {
      // safe fallback
    }

    return true;
  }

  public updateTemplateParams(
    id: string,
    updates: Partial<Omit<EstimationTemplateConfig, "id" | "components">>
  ): boolean {
    const tpl = this.templates.get(id);
    if (!tpl) return false;

    const updated: EstimationTemplateConfig = {
      ...tpl,
      ...updates,
      accIdRates: updates.accIdRates ? { ...tpl.accIdRates, ...updates.accIdRates } : tpl.accIdRates,
      updatedAt: new Date().toISOString(),
    };

    this.templates.set(id, updated);
    this.persist();
    this.notify();
    this.syncToBackend(updated);

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin Estimasi",
        userRole: "admin",
        action: "UPDATE",
        module: "Estimasi",
        details: `Template parameter untuk ${tpl.name} diperbarui`,
        metadata: { templateId: id, updates },
      });
    } catch {
      // safe fallback
    }

    return true;
  }

  public updateComponentRule(
    templateId: string,
    componentId: string,
    updates: Partial<EstimationComponentRule>
  ): boolean {
    const tpl = this.templates.get(templateId);
    if (!tpl) return false;

    const idx = tpl.components.findIndex((c) => c.id === componentId);
    if (idx === -1) return false;

    const oldComp = tpl.components[idx];
    const updatedComp: EstimationComponentRule = {
      ...oldComp,
      ...updates,
      description: updates.description !== undefined ? sanitizeComponentDescription(updates.description) : oldComp.description,
      formulaCondition: updates.formulaCondition !== undefined ? sanitizeComponentDescription(updates.formulaCondition) : oldComp.formulaCondition,
      humanFormula: updates.humanFormula !== undefined ? sanitizeComponentDescription(updates.humanFormula) : oldComp.humanFormula,
    };

    tpl.components[idx] = updatedComp;
    tpl.updatedAt = new Date().toISOString();
    this.templates.set(templateId, sanitizeEstimationTemplate({ ...tpl }));
    this.persist();
    this.notify();
    this.syncToBackend(tpl);

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin Estimasi",
        userRole: "admin",
        action: "UPDATE",
        module: "Estimasi",
        details: `Komponen ${oldComp.name} pada ${tpl.name} diperbarui`,
        metadata: { templateId, componentId, updates },
      });
    } catch {
      // safe fallback
    }

    return true;
  }

  public toggleComponent(templateId: string, componentId: string): boolean {
    const tpl = this.templates.get(templateId);
    if (!tpl) return false;
    const comp = tpl.components.find((c) => c.id === componentId);
    if (!comp) return false;
    return this.updateComponentRule(templateId, componentId, { isActive: !comp.isActive });
  }

  public toggleIncludeInTotal(templateId: string, componentId: string): boolean {
    const tpl = this.templates.get(templateId);
    if (!tpl) return false;
    const comp = tpl.components.find((c) => c.id === componentId);
    if (!comp) return false;
    return this.updateComponentRule(templateId, componentId, { includesInTotal: !comp.includesInTotal });
  }

  public addManualComponent(
    templateId: string,
    compData: Omit<EstimationComponentRule, "id" | "displayOrder"> & { id?: string }
  ): EstimationComponentRule | null {
    const tpl = this.templates.get(templateId);
    if (!tpl) return null;

    const id = compData.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const maxOrder = tpl.components.reduce((max, c) => Math.max(max, c.displayOrder), 0);

    const newComp: EstimationComponentRule = {
      ...compData,
      id,
      displayOrder: maxOrder + 1,
      isEditable: true,
      valueType: "manual",
      calculationMethod: compData.calculationMethod || "manual_amount",
      applicableVehicles: compData.applicableVehicles || (tpl.vehicleType as any),
      applicableService: compData.applicableService || tpl.serviceType,
    };

    tpl.components.push(newComp);
    tpl.updatedAt = new Date().toISOString();
    this.templates.set(templateId, { ...tpl });
    this.persist();
    this.notify();
    this.syncToBackend(tpl);

    return newComp;
  }

  public removeManualComponent(templateId: string, componentId: string): boolean {
    const tpl = this.templates.get(templateId);
    if (!tpl) return false;

    const comp = tpl.components.find((c) => c.id === componentId);
    // Protect core formula components from being deleted
    if (!comp || comp.valueType === "formula" || comp.ruleId) {
      return false;
    }

    tpl.components = tpl.components.filter((c) => c.id !== componentId);
    tpl.updatedAt = new Date().toISOString();
    this.templates.set(templateId, { ...tpl });
    this.persist();
    this.notify();
    this.syncToBackend(tpl);
    return true;
  }

  public resetToDefault(templateId?: string): void {
    if (templateId) {
      const def = ALL_DEFAULT_TEMPLATES.find((t) => t.id === templateId);
      if (def) {
        const resetTpl: EstimationTemplateConfig = {
          ...def,
          components: def.components.map((c) => ({ ...c })),
          accIdRates: { ...def.accIdRates },
          updatedAt: new Date().toISOString(),
        };
        this.templates.set(def.id, resetTpl);
        this.persist();
        this.notify();
        this.syncToBackend(resetTpl);

        if (typeof window !== "undefined" && typeof fetch !== "undefined") {
          fetch(`${this.baseUrl}/estimation/templates/${encodeURIComponent(def.id)}/reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
          }).catch(() => {});
        }
      }
    } else {
      for (const def of ALL_DEFAULT_TEMPLATES) {
        const resetTpl: EstimationTemplateConfig = {
          ...def,
          components: def.components.map((c) => ({ ...c })),
          accIdRates: { ...def.accIdRates },
          updatedAt: new Date().toISOString(),
        };
        this.templates.set(def.id, resetTpl);
      }
      this.persist();
      this.notify();

      if (typeof window !== "undefined" && typeof fetch !== "undefined") {
        fetch(`${this.baseUrl}/estimation/reset-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        }).catch(() => {});
      }
    }
  }

  public calculate(input: EstimationInput, templateId = "template-pajak-tahunan-r4"): EstimationResult {
    const template = this.getTemplate(templateId);
    return calculateEstimation(input, template, defaultRuleRegistry);
  }
}

export const estimationStore = new EstimationStore();

export function useEstimationStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return estimationStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return estimationStore;
}
