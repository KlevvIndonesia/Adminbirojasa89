/**
 * SQLite Role Permissions Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db } from "../database/db";
import { CANONICAL_PERMISSIONS, RolePermissions } from "../config/defaultPermissions";

export class DbPermissionRepository {
  /**
   * Retrieves full permissions matrix for all roles.
   * SVP always inherits canonical full privilege unconditionally.
   */
  public getAll(): Record<string, RolePermissions> {
    const stmt = db.prepare("SELECT role, permissions_json FROM role_permissions");
    const rows = stmt.all() as { role: string; permissions_json: string }[];

    const result: Record<string, RolePermissions> = {
      // SVP always full privilege
      svp: JSON.parse(JSON.stringify(CANONICAL_PERMISSIONS.svp)),
      administrator: JSON.parse(JSON.stringify(CANONICAL_PERMISSIONS.svp)),
      admin: JSON.parse(JSON.stringify(CANONICAL_PERMISSIONS.admin)),
      finance: JSON.parse(JSON.stringify(CANONICAL_PERMISSIONS.finance)),
      messenger: JSON.parse(JSON.stringify(CANONICAL_PERMISSIONS.messenger)),
    };

    for (const r of rows) {
      if (r.role === "svp" || r.role === "administrator") continue; // Protected
      try {
        result[r.role] = JSON.parse(r.permissions_json);
      } catch (err) {
        console.warn(`[DbPermissionRepository] Error parsing permissions for ${r.role}:`, err);
      }
    }

    return result;
  }

  public getByRole(role: string): RolePermissions | null {
    const cleanRole = role.toLowerCase().trim();
    if (cleanRole === "svp" || cleanRole === "administrator") {
      return JSON.parse(JSON.stringify(CANONICAL_PERMISSIONS.svp));
    }

    const stmt = db.prepare("SELECT permissions_json FROM role_permissions WHERE role = ?");
    const row = stmt.get(cleanRole) as { permissions_json: string } | undefined;
    if (!row) {
      return CANONICAL_PERMISSIONS[cleanRole] || null;
    }

    try {
      return JSON.parse(row.permissions_json);
    } catch {
      return CANONICAL_PERMISSIONS[cleanRole] || null;
    }
  }

  /**
   * Saves role permissions for a manageable role (admin, finance, messenger).
   * Prohibits modification of role SVP/administrator.
   */
  public saveRole(role: string, permissions: RolePermissions, updatedBy = "system"): void {
    const cleanRole = role.toLowerCase().trim();
    if (cleanRole === "svp" || cleanRole === "administrator") {
      throw new Error("Hak akses role SVP bersifat absolut dan tidak dapat diubah.");
    }

    if (!["admin", "finance", "messenger"].includes(cleanRole)) {
      throw new Error(`Role '${role}' tidak didukung untuk konfigurasi hak akses.`);
    }

    const stmt = db.prepare(`
      INSERT INTO role_permissions (role, permissions_json, updated_at, updated_by)
      VALUES (?, ?, datetime('now'), ?)
      ON CONFLICT(role) DO UPDATE SET
        permissions_json = excluded.permissions_json,
        updated_at = datetime('now'),
        updated_by = excluded.updated_by
    `);

    stmt.run(cleanRole, JSON.stringify(permissions), updatedBy);
  }

  /**
   * Resets manageable roles to canonical defaults.
   */
  public resetToDefaults(updatedBy = "system"): void {
    const stmt = db.prepare(`
      INSERT INTO role_permissions (role, permissions_json, updated_at, updated_by)
      VALUES (?, ?, datetime('now'), ?)
      ON CONFLICT(role) DO UPDATE SET
        permissions_json = excluded.permissions_json,
        updated_at = datetime('now'),
        updated_by = excluded.updated_by
    `);

    const manageableRoles = ["admin", "finance", "messenger"];
    for (const r of manageableRoles) {
      if (CANONICAL_PERMISSIONS[r]) {
        stmt.run(r, JSON.stringify(CANONICAL_PERMISSIONS[r]), updatedBy);
      }
    }
  }
}

export const dbPermissionRepository = new DbPermissionRepository();
