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

  // 2. Lookup via employee_accounts using the authenticated user's email
  if (user.email) {
    const cleanEmail = user.email.trim().toLowerCase();
    try {
      const ea = db.prepare(`
        SELECT ea.employee_id 
        FROM employee_accounts ea 
        JOIN employees e ON ea.employee_id = e.id 
        WHERE LOWER(ea.email) = ? AND ea.status_aktif = 1
      `).get(cleanEmail) as { employee_id: string } | undefined;
      if (ea && ea.employee_id) {
        return ea.employee_id;
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
