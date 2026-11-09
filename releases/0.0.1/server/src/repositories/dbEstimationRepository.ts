/**
 * SQLite Estimation Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";
import { EstimationTemplateConfig } from "../../../src/domain/estimation/types";

export class DbEstimationRepository {
  public getAllTemplates(): EstimationTemplateConfig[] {
    const stmt = db.prepare("SELECT data_json FROM estimation_templates ORDER BY service_type ASC, tipe_kendaraan ASC");
    const rows = stmt.all() as { data_json: string }[];
    return rows.map((r) => JSON.parse(r.data_json) as EstimationTemplateConfig);
  }

  public getTemplateById(id: string): EstimationTemplateConfig | undefined {
    const stmt = db.prepare("SELECT data_json FROM estimation_templates WHERE id = ?");
    const row = stmt.get(id) as { data_json: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.data_json) as EstimationTemplateConfig;
  }

  public saveTemplate(template: EstimationTemplateConfig): boolean {
    const stmt = db.prepare(`
      INSERT INTO estimation_templates (
        id, name, service_type, tipe_kendaraan, koefisien_denda, data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        service_type = excluded.service_type,
        tipe_kendaraan = excluded.tipe_kendaraan,
        koefisien_denda = excluded.koefisien_denda,
        data_json = excluded.data_json,
        updated_at = datetime('now')
    `);

    const res = stmt.run(
      template.id,
      template.name,
      template.serviceType,
      template.vehicleType,
      template.koefisienDenda,
      JSON.stringify(template)
    );

    return res.changes > 0;
  }

  public resetTemplate(defaultTemplate: EstimationTemplateConfig): boolean {
    return this.saveTemplate(defaultTemplate);
  }

  public resetAll(defaultTemplates: EstimationTemplateConfig[]): void {
    const stmt = db.prepare(`
      INSERT INTO estimation_templates (
        id, name, service_type, tipe_kendaraan, koefisien_denda, data_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        service_type = excluded.service_type,
        tipe_kendaraan = excluded.tipe_kendaraan,
        koefisien_denda = excluded.koefisien_denda,
        data_json = excluded.data_json,
        updated_at = datetime('now')
    `);

    for (const tpl of defaultTemplates) {
      stmt.run(
        tpl.id,
        tpl.name,
        tpl.serviceType,
        tpl.vehicleType,
        tpl.koefisienDenda,
        JSON.stringify(tpl)
      );
    }
  }
}

export const dbEstimationRepository = new DbEstimationRepository();
