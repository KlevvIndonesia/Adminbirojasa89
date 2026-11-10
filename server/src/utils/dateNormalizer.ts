/**
 * Asia/Jakarta (WIB, UTC+7) Calendar Date Normalization
 * Phase 4B Batch 2B — Step D: Startup Backfill Safety
 * 
 * Strict Acceptance Invariants:
 * 1. Supports date-only strings (YYYY-MM-DD).
 * 2. Supports full ISO 8601 strings (YYYY-MM-DDTHH:mm:ss.sssZ, with or without explicit offset).
 * 3. Supports SQLite datetime format (YYYY-MM-DD HH:MM:SS[.mmm]), treated strictly as UTC.
 * 4. Supports JavaScript Date objects.
 * 5. Timezone Semantics: Anchored strictly to Asia/Jakarta (Western Indonesia Time / WIB, UTC+7).
 *    Correctly shifts timestamps around midnight WIB (e.g. 18:00 UTC on Nov 4 -> 01:00 WIB on Nov 5).
 * 6. Fails closed on invalid, malformed, or ambiguous values by returning null.
 * 7. Pure date-only strings (YYYY-MM-DD) are preserved as calendar invariants without timezone shifting.
 */

const WIB_TIMEZONE = "Asia/Jakarta";

const WIB_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: WIB_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Validates that year, month, day represent a real calendar date (e.g. rejects Feb 31).
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Normalizes any valid date representation into a canonical YYYY-MM-DD calendar date in Asia/Jakarta.
 * Returns null if input is null, undefined, empty, or cannot be parsed unambiguously into a real date.
 */
export function normalizeToWibCalendarDate(val: unknown): string | null {
  if (val === null || val === undefined) {
    return null;
  }

  // Handle native Date instances
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return WIB_DATE_FORMATTER.format(val);
  }

  if (typeof val !== "string") {
    return null;
  }

  const trimmed = val.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Pure date-only string: YYYY-MM-DD
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10);
    const month = parseInt(dateOnlyMatch[2], 10);
    const day = parseInt(dateOnlyMatch[3], 10);
    if (!isValidCalendarDate(year, month, day)) {
      return null;
    }
    return trimmed;
  }

  // 2. SQLite timestamp format: YYYY-MM-DD HH:MM:SS[.mmm] (conventionally UTC)
  const sqliteMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?$/);
  if (sqliteMatch) {
    const [, datePart, timePart, msPart] = sqliteMatch;
    const ms = msPart ? msPart.padEnd(3, "0").slice(0, 3) : "000";
    const isoUtcString = `${datePart}T${timePart}.${ms}Z`;
    const parsed = new Date(isoUtcString);
    if (isNaN(parsed.getTime())) return null;
    return WIB_DATE_FORMATTER.format(parsed);
  }

  // 3. ISO 8601 or RFC 2822 parseable string
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return WIB_DATE_FORMATTER.format(parsed);
}

/**
 * Safely compares two date/timestamp inputs.
 * Returns true if and only if both parse to the exact same valid YYYY-MM-DD calendar date in Asia/Jakarta.
 */
export function compareWibCalendarDates(a: unknown, b: unknown): boolean {
  const normA = normalizeToWibCalendarDate(a);
  const normB = normalizeToWibCalendarDate(b);
  if (!normA || !normB) {
    return false;
  }
  return normA === normB;
}
