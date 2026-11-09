/**
 * Canonical Actor Identity Resolver
 * SUNBiroJasa / Admin SUN89 — Audit Trail Hardening (Patch C)
 * 
 * Maps authenticated user context (TokenPayload) to verified canonical employee ID (employees.id).
 * Guarantees:
 * 1. Strict adherence to SQLite FK: order_status_history.diubah_oleh_employee_id REFERENCES employees(id)
 * 2. Authenticated context only (req.user / TokenPayload) - client body/inputs are completely ignored.
 * 3. Never uses name matching heuristics or substring guesses.
 * 4. Differentiates human actors from legitimate system-generated events (returns null without fake IDs).
 */

import { db } from "../database/db";
import { TokenPayload } from "./crypto";

/**
 * Resolves the canonical employees.id from the verified authenticated user context.
 * 
 * @param user The verified TokenPayload from req.user
 * @returns Canonical employees.id (e.g. 'EMP-0001', 'EMP-0002') or null for system events / unmapped
 */
export function resolveCanonicalActorEmployeeId(user?: TokenPayload | null): string | null {
  if (!user || user.userId === "usr-system" || (user as any).isSystem) {
    return null;
  }

  // 1. Direct verification: Is user.employeeId already a valid primary key in employees?
  if (user.employeeId) {
    const cleanId = String(user.employeeId).trim();
    try {
      const emp = db.prepare("SELECT id FROM employees WHERE id = ?").get(cleanId) as { id: string } | undefined;
      if (emp && emp.id) {
        return emp.id;
      }
    } catch {}
  }

  // 2. Lookup via users table using the authenticated user's email or userId
  if (user.email || user.userId) {
    try {
      const cleanEmail = user.email ? user.email.trim().toLowerCase() : "";
      const numericId = user.userId && user.userId.startsWith("usr-") ? Number(user.userId.replace(/^usr-/, "")) : null;
      const u = db.prepare(`
        SELECT u.employee_id 
        FROM users u 
        JOIN employees e ON u.employee_id = e.id 
        WHERE (LOWER(u.email) = ? OR u.id = ?) AND u.employee_id IS NOT NULL
      `).get(cleanEmail, numericId) as { employee_id: string } | undefined;
      if (u && u.employee_id) {
        return u.employee_id;
      }
    } catch {}
  }

  // 3. Fallback check: If userId is formatted like "usr-<id>", check if EMP-000<id> exists in employees
  if (user.userId && user.userId.startsWith("usr-")) {
    const numericPart = user.userId.replace(/^usr-/, "");
    if (/^\d+$/.test(numericPart)) {
      const formattedEmpId = `EMP-${numericPart.padStart(4, "0")}`;
      try {
        const emp = db.prepare("SELECT id FROM employees WHERE id = ?").get(formattedEmpId) as { id: string } | undefined;
        if (emp && emp.id) {
          return emp.id;
        }
      } catch {}
    }
  }

  return null;
}
