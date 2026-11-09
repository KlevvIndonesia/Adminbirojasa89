/**
 * Samsat Operational Tariffs Repository (Per-Samsat Pricing)
 * Admin SUN89 — Biro Jasa Management System
 */

import { db, runInTransaction } from "../database/db";
import { SamsatOperationalTariffRecord } from "../database/schema";

export class DbSamsatTariffRepository {
  public getAll(onlyActive: boolean = true): SamsatOperationalTariffRecord[] {
    const query = onlyActive
      ? "SELECT * FROM samsat_operational_tariffs WHERE is_active = 1 ORDER BY samsat_id, pricing_item_id"
      : "SELECT * FROM samsat_operational_tariffs ORDER BY samsat_id, pricing_item_id";
    const stmt = db.prepare(query);
    return stmt.all() as SamsatOperationalTariffRecord[];
  }

  public getBySamsatId(samsatId: string, onlyActive: boolean = true): SamsatOperationalTariffRecord[] {
    const query = onlyActive
      ? "SELECT * FROM samsat_operational_tariffs WHERE samsat_id = ? AND is_active = 1 ORDER BY pricing_item_id"
      : "SELECT * FROM samsat_operational_tariffs WHERE samsat_id = ? ORDER BY pricing_item_id";
    const stmt = db.prepare(query);
    return stmt.all(samsatId) as SamsatOperationalTariffRecord[];
  }

  public getById(id: string): SamsatOperationalTariffRecord | null {
    const stmt = db.prepare("SELECT * FROM samsat_operational_tariffs WHERE id = ?");
    const result = stmt.get(id);
    return (result as SamsatOperationalTariffRecord) || null;
  }

  public getByOfficeAndItem(samsatId: string, pricingItemId: string, onlyActive: boolean = true): SamsatOperationalTariffRecord | null {
    const query = onlyActive
      ? "SELECT * FROM samsat_operational_tariffs WHERE samsat_id = ? AND pricing_item_id = ? AND is_active = 1"
      : "SELECT * FROM samsat_operational_tariffs WHERE samsat_id = ? AND pricing_item_id = ?";
    const stmt = db.prepare(query);
    const result = stmt.get(samsatId, pricingItemId);
    return (result as SamsatOperationalTariffRecord) || null;
  }

  public upsert(samsatId: string, pricingItemId: string, nominal: number, employeeId?: string | null): SamsatOperationalTariffRecord {
    const existing = this.getByOfficeAndItem(samsatId, pricingItemId, false);
    const id = existing ? existing.id : `tar-${samsatId}-${pricingItemId}`;
    const validNominal = Math.max(0, Math.round(Number(nominal)));

    db.prepare(`
      INSERT INTO samsat_operational_tariffs (
        id, samsat_id, pricing_item_id, nominal, is_active, created_by_employee_id, updated_by_employee_id, updated_at
      )
      VALUES (?, ?, ?, ?, 1, ?, ?, datetime('now'))
      ON CONFLICT(samsat_id, pricing_item_id) DO UPDATE SET
        nominal = excluded.nominal,
        is_active = 1,
        updated_by_employee_id = excluded.updated_by_employee_id,
        updated_at = datetime('now')
    `).run(id, samsatId, pricingItemId, validNominal, employeeId || null, employeeId || null);

    return this.getByOfficeAndItem(samsatId, pricingItemId, false)!;
  }

  public upsertBatch(samsatId: string, tariffs: Array<{ pricingItemId: string; nominal: number }>, employeeId?: string | null): SamsatOperationalTariffRecord[] {
    return runInTransaction(() => {
      for (const t of tariffs) {
        this.upsert(samsatId, t.pricingItemId, t.nominal, employeeId);
      }
      return this.getBySamsatId(samsatId, true);
    });
  }

  public delete(id: string): boolean {
    const result = db.prepare("DELETE FROM samsat_operational_tariffs WHERE id = ?").run(id);
    return (result as any).changes > 0;
  }

  public deleteByOfficeAndItem(samsatId: string, pricingItemId: string): boolean {
    const result = db.prepare("DELETE FROM samsat_operational_tariffs WHERE samsat_id = ? AND pricing_item_id = ?").run(samsatId, pricingItemId);
    return (result as any).changes > 0;
  }
}

export const dbSamsatTariffRepository = new DbSamsatTariffRepository();
