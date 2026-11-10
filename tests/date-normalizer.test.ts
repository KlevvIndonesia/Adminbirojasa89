import test from "node:test";
import assert from "node:assert";
import {
  normalizeToWibCalendarDate,
  compareWibCalendarDates,
  isValidCalendarDate,
} from "../server/src/utils/dateNormalizer";

test("Date Normalizer Unit Suite — Asia/Jakarta (WIB) Policy", async (t) => {
  await t.test("1. Pure calendar date string (YYYY-MM-DD) is preserved as invariant", () => {
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-04"), "2026-11-04");
    assert.strictEqual(normalizeToWibCalendarDate("2026-01-01"), "2026-01-01");
    assert.strictEqual(normalizeToWibCalendarDate("2026-12-31"), "2026-12-31");
  });

  await t.test("2. Rejects invalid calendar dates (e.g. Feb 31, Month 13)", () => {
    assert.strictEqual(normalizeToWibCalendarDate("2026-02-31"), null);
    assert.strictEqual(normalizeToWibCalendarDate("2026-13-01"), null);
    assert.strictEqual(normalizeToWibCalendarDate("2026-04-31"), null); // April has 30 days
    assert.strictEqual(isValidCalendarDate(2026, 2, 29), false); // 2026 not leap year
    assert.strictEqual(isValidCalendarDate(2024, 2, 29), true);  // 2024 is leap year
  });

  await t.test("3. ISO 8601 UTC timestamp normalizes to Asia/Jakarta date", () => {
    // 14:46:40 UTC on Nov 4 -> 21:46:40 WIB on Nov 4
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-04T14:46:40.982Z"), "2026-11-04");
    // 07:23:08 UTC on Nov 5 -> 14:23:08 WIB on Nov 5
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-05T07:23:08.376Z"), "2026-11-05");
  });

  await t.test("4. Midnight WIB / UTC boundary handling (+7 hours offset)", () => {
    // Exactly 16:59:59 UTC on Nov 4 = 23:59:59 WIB on Nov 4
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-04T16:59:59.000Z"), "2026-11-04");

    // Exactly 17:00:00 UTC on Nov 4 = 00:00:00 WIB on Nov 5 (midnight!)
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-04T17:00:00.000Z"), "2026-11-05");

    // 18:00:00 UTC on Nov 4 = 01:00:00 WIB on Nov 5
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-04T18:00:00.000Z"), "2026-11-05");
  });

  await t.test("5. SQLite timestamp format (YYYY-MM-DD HH:MM:SS) treated as UTC", () => {
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-04 14:46:41"), "2026-11-04");
    // 18:00 UTC on Nov 4 -> Nov 5 WIB
    assert.strictEqual(normalizeToWibCalendarDate("2026-11-04 18:00:00"), "2026-11-05");
  });

  await t.test("6. JavaScript Date instances", () => {
    const d1 = new Date("2026-11-04T14:46:40.982Z");
    assert.strictEqual(normalizeToWibCalendarDate(d1), "2026-11-04");

    const dMidnight = new Date("2026-11-04T17:00:01.000Z");
    assert.strictEqual(normalizeToWibCalendarDate(dMidnight), "2026-11-05");

    const invalidDate = new Date("invalid");
    assert.strictEqual(normalizeToWibCalendarDate(invalidDate), null);
  });

  await t.test("7. Fails closed on invalid or malformed strings", () => {
    assert.strictEqual(normalizeToWibCalendarDate(null), null);
    assert.strictEqual(normalizeToWibCalendarDate(undefined), null);
    assert.strictEqual(normalizeToWibCalendarDate(""), null);
    assert.strictEqual(normalizeToWibCalendarDate("   "), null);
    assert.strictEqual(normalizeToWibCalendarDate("not-a-date"), null);
    assert.strictEqual(normalizeToWibCalendarDate(12345), null);
    assert.strictEqual(normalizeToWibCalendarDate({}), null);
  });

  await t.test("8. compareWibCalendarDates cross-format equality", () => {
    // API date YYYY-MM-DD vs ISO timestamp for same calendar date
    assert.strictEqual(
      compareWibCalendarDates("2026-11-04", "2026-11-04T14:46:40.982Z"),
      true
    );

    // SQLite timestamp vs ISO timestamp for same calendar date
    assert.strictEqual(
      compareWibCalendarDates("2026-11-04 14:46:41", "2026-11-04T14:46:40.982Z"),
      true
    );

    // Cross-midnight dates that differ in WIB
    assert.strictEqual(
      compareWibCalendarDates("2026-11-04", "2026-11-04T18:00:00.000Z"),
      false
    );

    // Invalid values return false
    assert.strictEqual(compareWibCalendarDates("invalid", "2026-11-04"), false);
    assert.strictEqual(compareWibCalendarDates(null, "2026-11-04"), false);
  });
});
