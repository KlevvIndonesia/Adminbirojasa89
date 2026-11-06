import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_SALES_CATEGORIES,
  CANONICAL_SERVICES_METADATA,
} from "../src/app/components/DataPenjualan";
import { getRouteMeta } from "../src/app/config/routeConfig";
import { computeDataPenjualanTotals } from "../src/domain/finance/dataPenjualanTotals";

test("DATA PENJUALAN — Horizontal redundant tabs are completely removed from DataPenjualan.tsx", () => {
  const dataPenjualanPath = path.resolve(process.cwd(), "src/app/components/DataPenjualan.tsx");
  const content = fs.readFileSync(dataPenjualanPath, "utf-8");

  // 1. Verify Level 2 Sub-Nav tabs container is removed
  assert.equal(
    content.includes("Level 2 Sub-Nav: Canonical Service Categories"),
    false,
    "The Level 2 horizontal sub-nav tabs comment/section should be completely removed"
  );

  // 2. Verify handleTabChange function is removed
  assert.equal(
    content.includes("handleTabChange"),
    false,
    "The handleTabChange function should be removed since header dropdown is the sole navigation"
  );

  // 3. Verify horizontal buttons loop over CANONICAL_SALES_CATEGORIES is NOT rendered inside DataPenjualan JSX
  assert.equal(
    content.includes("onClick={() => handleTabChange"),
    false,
    "No tab buttons calling handleTabChange should remain"
  );

  // 4. Verify Table Card is directly present with responsive viewport layout
  assert.ok(
    content.includes("Table Card (Maximized Viewport Height with sticky header & internal row scroll)"),
    "Table Card comment and structure should be preserved"
  );
  assert.ok(
    content.includes("md:h-[calc(100vh-140px)] min-h-[500px]"),
    "Viewport height class should be preserved for the table card"
  );
});

test("DATA PENJUALAN — Header dropdown in App.tsx is the sole navigation driver with all 8 canonical categories", () => {
  const appPath = path.resolve(process.cwd(), "src/app/App.tsx");
  const content = fs.readFileSync(appPath, "utf-8");

  // 1. App.tsx must have header dropdown for Data Penjualan
  assert.ok(
    content.includes("isDataPenjualanRoute"),
    "App.tsx must detect isDataPenjualanRoute"
  );
  assert.ok(
    content.includes("Pilih layanan Data Penjualan"),
    "App.tsx must have dropdown trigger with accessible title"
  );
  assert.ok(
    content.includes("handleNavigate(`/finance/data-penjualan/${catKey}`)"),
    "App.tsx dropdown items must navigate to canonical category route"
  );

  // 2. Exactly 8 canonical categories
  assert.equal(
    CANONICAL_SALES_CATEGORIES.length,
    8,
    "There must be exactly 8 canonical sales categories"
  );

  const expectedCategories = [
    "perpanjangan-1-tahun",
    "perpanjangan-5-tahun",
    "mutasi-asal",
    "mutasi-antar-daerah",
    "balik-nama",
    "tarik-berkas",
    "duplikat-stnk",
    "lainnya",
  ];

  for (const cat of expectedCategories) {
    assert.ok(
      CANONICAL_SALES_CATEGORIES.includes(cat as any),
      `Canonical sales categories must include ${cat}`
    );
    const meta = CANONICAL_SERVICES_METADATA[cat as keyof typeof CANONICAL_SERVICES_METADATA];
    assert.ok(meta, `Metadata must exist for category ${cat}`);
    assert.ok(meta.title, `Metadata must have a title for category ${cat}`);
    assert.ok(meta.searchPlaceholder, `Metadata must define searchPlaceholder for category ${cat}`);
  }
});

test("DATA PENJUALAN — RouteConfig and URL deep-linking maps all 8 categories to breadcrumbs and meta", () => {
  const expectedLabels: Record<string, string> = {
    "perpanjangan-1-tahun": "Perpanjangan 1 Tahun",
    "perpanjangan-5-tahun": "Perpanjangan 5 Tahun",
    "mutasi-asal": "Mutasi Asal Samsat",
    "mutasi-antar-daerah": "Mutasi Antar Daerah",
    "balik-nama": "Balik Nama",
    "tarik-berkas": "Tarik Berkas",
    "duplikat-stnk": "Duplikat STNK",
    "lainnya": "Lainnya",
  };

  for (const [key, label] of Object.entries(expectedLabels)) {
    const route = `/finance/data-penjualan/${key}`;
    const meta = getRouteMeta(route);

    assert.equal(meta.id, "finance-penjualan", `Route id for ${route} must be finance-penjualan`);
    assert.equal(meta.title, `Data Penjualan - ${label}`, `Route title for ${route} must include ${label}`);
    assert.deepEqual(
      meta.breadcrumbs,
      ["Finance", "Data Penjualan", label],
      `Breadcrumbs for ${route} must match ["Finance", "Data Penjualan", "${label}"]`
    );
  }
});

test("DATA PENJUALAN — Summary calculations operate correctly across datasets", () => {
  const sampleData = [
    {
      id: "1",
      tanggal_transaksi: "2026-11-01",
      nama_pemilik: "Budi",
      totalBiaya: 500000,
      terbayar: 500000,
      statusPembayaran: "Lunas",
      biayaSamsat: 100000,
      cashback: 50000,
    },
    {
      id: "2",
      tanggal_transaksi: "2026-11-02",
      nama_pemilik: "Siti",
      totalBiaya: 750000,
      terbayar: 250000,
      statusPembayaran: "Kurang Bayar",
      biayaSamsat: 50000,
      cashback: 0,
    },
  ];

  const totals = computeDataPenjualanTotals(sampleData, "perpanjangan-1-tahun");
  assert.equal(totals.totalTagihan, 1250000);
  assert.equal(totals.totalUangMasuk, 750000);
  assert.equal(totals.totalUangKeluar, 150000);
  assert.equal(totals.totalCashbackTerpending, 50000);
  assert.equal(totals.transactionCount, 2);
});
