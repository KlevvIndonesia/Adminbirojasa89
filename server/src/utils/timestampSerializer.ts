/**
 * Standardized ISO 8601 UTC Timestamp Serialization Helper
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Strict Acceptance Invariants:
 * 1. Transform SQLite UTC timestamps (YYYY-MM-DD HH:MM:SS) to ISO 8601 UTC with 'Z'.
 * 2. Preserve existing ISO strings ending in 'Z'.
 * 3. Preserve strings with explicit timezone offsets (+07:00, etc.).
 * 4. Preserve date-only calendar values (YYYY-MM-DD) without appending time or timezone.
 * 5. Preserve null, undefined, and empty string values.
 * 6. Never modify SQLite database files or schema.
 */

export function serializeUtcTimestamp(val: unknown): string | null | undefined {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val !== "string") {
    if (val instanceof Date) {
      return val.toISOString();
    }
    return val as any;
  }

  const trimmed = val.trim();
  if (!trimmed) {
    return val;
  }

  // Preserve existing ISO strings ending with Z/z
  if (/Z$/i.test(trimmed)) {
    return trimmed;
  }

  // Preserve strings with explicit timezone offset (e.g. +07:00, -05:00)
  if (/([+-]\d{2}:?\d{2})$/.test(trimmed)) {
    return trimmed;
  }

  // Preserve pure date-only values (YYYY-MM-DD) without altering or appending time
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Match SQLite datetime('now') format: YYYY-MM-DD HH:MM:SS[.mmm] or YYYY-MM-DDTHH:MM:SS[.mmm]
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?$/);
  if (match) {
    const [, datePart, timePart, msPart] = match;
    const ms = msPart ? msPart.padEnd(3, "0").slice(0, 3) : "000";
    return `${datePart}T${timePart}.${ms}Z`;
  }

  // Return unrecognized string safely without mutating
  return val;
}
