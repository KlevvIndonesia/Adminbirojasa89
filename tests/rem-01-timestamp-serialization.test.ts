/**
 * REM-01 GAP-03 Timestamp Serialization Regression Tests
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Verifies all 7 required regression cases:
 * 1. SQLite UTC timestamp (YYYY-MM-DD HH:MM:SS) -> ISO 8601 UTC with Z
 * 2. Existing ISO-Z remains unchanged
 * 3. Explicit timezone offset remains unchanged
 * 4. Date-only remains unchanged
 * 5. Null, undefined, and empty values remain safe
 * 6. Asia/Jakarta displays the expected UTC+7 time
 * 7. Existing unaffected timestamp consumers and repositories serialize correctly
 */

import test from "node:test";
import assert from "node:assert/strict";
import { serializeUtcTimestamp } from "../server/src/utils/timestampSerializer";
import { dbOrderRepository } from "../server/src/repositories/dbOrderRepository";
import { dbAuditRepository } from "../server/src/repositories/dbAuditRepository";

test("Case 1: SQLite UTC timestamp converts to ISO 8601 UTC with Z", () => {
  const input = "2026-11-04 14:47:06";
  const result = serializeUtcTimestamp(input);
  assert.equal(result, "2026-11-04T14:47:06.000Z");

  const inputWithMs = "2026-11-04 14:47:06.123";
  const resultWithMs = serializeUtcTimestamp(inputWithMs);
  assert.equal(resultWithMs, "2026-11-04T14:47:06.123Z");
});

test("Case 2: Existing ISO-Z remains unchanged", () => {
  const isoZ = "2026-11-06T18:19:04.025Z";
  assert.equal(serializeUtcTimestamp(isoZ), isoZ);

  const isoZNoMs = "2026-11-06T18:19:04Z";
  assert.equal(serializeUtcTimestamp(isoZNoMs), isoZNoMs);
});

test("Case 3: Explicit timezone offset remains unchanged", () => {
  const withOffset = "2026-11-04T21:47:06+07:00";
  assert.equal(serializeUtcTimestamp(withOffset), withOffset);

  const withOffsetSpace = "2026-11-04 21:47:06+07:00";
  assert.equal(serializeUtcTimestamp(withOffsetSpace), withOffsetSpace);
});

test("Case 4: Date-only values remain unchanged (no time or timezone appended)", () => {
  const dateOnly = "2026-11-04";
  assert.equal(serializeUtcTimestamp(dateOnly), dateOnly);

  const anotherDate = "2025-12-31";
  assert.equal(serializeUtcTimestamp(anotherDate), anotherDate);
});

test("Case 5: Null, undefined, and empty values remain safe", () => {
  assert.equal(serializeUtcTimestamp(null), null);
  assert.equal(serializeUtcTimestamp(undefined), undefined);
  assert.equal(serializeUtcTimestamp(""), "");
  assert.equal(serializeUtcTimestamp("   "), "   ");
});

test("Case 6: Asia/Jakarta displays the expected UTC+7 time", () => {
  const rawSqlite = "2026-11-04 14:47:06";
  const isoUtc = serializeUtcTimestamp(rawSqlite);
  assert.equal(isoUtc, "2026-11-04T14:47:06.000Z");

  const d = new Date(isoUtc!);
  assert.equal(d.getUTCHours(), 14);
  assert.equal(d.getUTCMinutes(), 47);
  assert.equal(d.getUTCSeconds(), 6);

  // Formatted in Asia/Jakarta timezone
  const jakartaTimeStr = d.toLocaleTimeString("en-US", { timeZone: "Asia/Jakarta", hour12: false });
  // 14 UTC + 7 = 21 WIB
  assert.match(jakartaTimeStr, /^21:47:06/);

  const jakartaDateStr = d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
  assert.equal(jakartaDateStr, "4/11/2026");
});

test("Case 7: Repository integration produces ISO-Z for updatedAt and waktu_transisi", () => {
  // Verify dbOrderRepository.getAllFlat / mapRowToOrder
  const flatOrders = dbOrderRepository.getAllFlat(false);
  if (flatOrders.length > 0) {
    const first = flatOrders[0];
    assert.ok(first.updatedAt, "Order must have updatedAt");
    assert.match(first.updatedAt, /Z$/i, "updatedAt must end with Z");
    assert.match(first.createdAt, /^\d{4}-\d{2}-\d{2}$/, "createdAt must remain date-only");
  }

  // Verify status history
  if (flatOrders.length > 0) {
    const history = dbOrderRepository.getStatusHistoryByOrderNo(flatOrders[0].orderNo);
    if (history.length > 0) {
      assert.match(history[0].waktu_transisi, /Z$/i, "waktu_transisi must end with Z");
    }
  }

  // Verify audit logs
  const auditLogs = dbAuditRepository.getAll({ limit: 5 });
  for (const log of auditLogs) {
    if (log.createdAt) {
      assert.match(log.createdAt, /Z$/i, "audit log createdAt must end with Z");
    }
  }
});
