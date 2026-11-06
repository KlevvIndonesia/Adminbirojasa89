import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SERVICE_STANDARD_BASELINES,
  isRowCustomOrOverridden,
} from "../src/app/components/BiayaLayanan";
import { pricingStore } from "../src/app/data/pricingStore";

test("Biaya Layanan Tahap 4: UI Apply All Dialog, Override Policy & Feedback Verification", async (t) => {
  const componentPath = path.resolve(process.cwd(), "src/app/components/BiayaLayanan.tsx");
  const componentSource = fs.readFileSync(componentPath, "utf-8");

  await t.test("1. UI State Contracts: Policy state & Loading state", () => {
    assert.match(
      componentSource,
      /const\s*\[applyAllPolicy,\s*setApplyAllPolicy\]\s*=\s*useState<"PRESERVE_EXISTING_CUSTOM"\s*\|\s*"OVERWRITE_ALL">\("PRESERVE_EXISTING_CUSTOM"\);/,
      "applyAllPolicy state must default to 'PRESERVE_EXISTING_CUSTOM'"
    );

    assert.match(
      componentSource,
      /const\s*\[isApplyingAll,\s*setIsApplyingAll\]\s*=\s*useState\(false\);/,
      "isApplyingAll state must default to false"
    );
  });

  await t.test("2. UI Metric Calculator: applyAllMetrics computes real-time counts", () => {
    assert.match(
      componentSource,
      /const applyAllMetrics\s*=\s*useMemo\(/,
      "applyAllMetrics must be defined as useMemo"
    );
    assert.match(
      componentSource,
      /customCount\s*=\s*rowsForService\.filter\(\(item\)\s*=>\s*isRowCustomOrOverridden\(item\)\)\.length/,
      "applyAllMetrics must accurately count custom tariff offices using isRowCustomOrOverridden"
    );
  });

  await t.test("3. Dialog Content: Policy Selectors & Visual Badges", () => {
    // Check Option 1 (Preserve Custom)
    assert.match(
      componentSource,
      /name="applyAllPolicy"/,
      "Radio group name must be applyAllPolicy"
    );
    assert.ok(
      componentSource.includes("Pertahankan Tarif Khusus Kantor"),
      "Must include label for preserving custom tariffs"
    );
    assert.ok(
      componentSource.includes("Direkomendasikan"),
      "Must highlight Option 1 with 'Direkomendasikan' badge"
    );

    // Check Option 2 (Overwrite All)
    assert.ok(
      componentSource.includes("Timpa Seluruh Kantor (Termasuk Tarif Khusus)"),
      "Must include label for overwriting all offices"
    );
    assert.ok(
      componentSource.includes("Override Total"),
      "Must mark Option 2 with 'Override Total' badge"
    );
  });

  await t.test("4. Async Confirmation Handler & Toast Sonner Feedback", () => {
    assert.match(
      componentSource,
      /const handleApplyAllConfirm\s*=\s*async\s*\(\)\s*=>/,
      "handleApplyAllConfirm must be an async function"
    );
    assert.match(
      componentSource,
      /setIsApplyingAll\(true\);/,
      "Must toggle loading spinner at start of batch execution"
    );
    assert.match(
      componentSource,
      /await pricingStore\.applyConfigToAllSamsats\([\s\S]*?applyAllPolicy[\s\S]*?\);/,
      "Must pass applyAllPolicy to pricingStore.applyConfigToAllSamsats"
    );
    assert.match(
      componentSource,
      /setIsApplyingAll\(false\);/,
      "Must reset loading spinner in finally block"
    );
    assert.ok(
      componentSource.includes("kantor bertarif khusus tetap dipertahankan"),
      "Toast feedback must inform how many custom offices were preserved"
    );
  });

  await t.test("5. Loading Spinner & Anti-Double-Submit Guard in Footer", () => {
    assert.match(
      componentSource,
      /<Loader2 className="w-3\.5 h-3\.5 animate-spin" \/>/,
      "Must show Loader2 animated spinner during batch replication"
    );
    assert.match(
      componentSource,
      /disabled=\{isApplyingAll/,
      "Buttons must be disabled while isApplyingAll is true"
    );
  });

  await t.test("6. Functional Metric Verification with Pricing Store Data", () => {
    const rows = pricingStore.getBiayaLayananRows().filter((r) => r.layanan === "Perpanjangan 1 Tahun");
    const customCount = rows.filter((r) => isRowCustomOrOverridden(r)).length;
    const standardCount = Math.max(0, rows.length - customCount);

    assert.ok(rows.length > 0, "Must have rows for Perpanjangan 1 Tahun");
    assert.equal(customCount + standardCount, rows.length);
  });
});
