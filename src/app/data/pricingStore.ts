import { resolveTariff, getComponentJurisdiction } from "../../domain/pricing/pricingResolver";
import { ResolvedTariff } from "../../domain/pricing/types";
/**
 * Master Pricing Store — Authoritative Single Source of Truth for Master Pricing
 * Admin SUN89 — Biro Jasa Management System
 * 
 * INTEGRATION PIPELINE:
 * Harga Dasar Samsat (per-Samsat item amounts)
 *         ↓
 * Biaya Layanan (service + samsat -> biaya jasa, antar jemput, enabled components)
 *         ↓
 * Buat Order (pure calculator consumer)
 *         ↓
 * Order Cost Breakdown & Immutable Snapshot
 *         ↓
 * Finance Invoice
 */

import { useState, useEffect } from "react";
export type { SamsatMasterItem };
import {
  SamsatMasterItem,
  PricingItem,
  SamsatCostItem,
  ServiceFeeConfig,
  ServiceComponentConfig,
  ServiceCostItem,
  ServicePackageConfig,
  OrderCostBreakdownItem,
  OrderCostSnapshot,
  ApplyAllScope,
  WilayahAdministratif,
} from "../../domain/pricing/types";
import {
  WILAYAH_REFERENSI,
  PROVINSI_LIST,
  WILAYAH_ADMINISTRATIF_LIST,
  WilayahAdministratifItem,
  ProvinsiItem,
  findWilayahByKode,
  findWilayahByName,
  getWilayahByProvinsi,
  normalizeSamsatOfficeName,
} from "../../domain/pricing/wilayahIndonesiaData";
import { auditLog } from "../utils/auditLog";
import { pricingRepository } from "../../data/repositories/pricingRepository";
import { APP_CONFIG } from "../config/appConfig";

export const SERVICE_CANONICAL_BASELINES: Record<string, { jasa: number; kurir: number }> = {
  "svc-perp-1th": { jasa: 250000, kurir: 50000 },
  "svc-perp-5th": { jasa: 500000, kurir: 50000 },
  "svc-mut-asal": { jasa: 800000, kurir: 50000 },
  "svc-mut-antar": { jasa: 1500000, kurir: 50000 },
  "svc-balik-nama": { jasa: 1200000, kurir: 50000 },
  "svc-tarik-berkas": { jasa: 600000, kurir: 50000 },
  "svc-duplikat-stnk": { jasa: 350000, kurir: 50000 },
  "svc-lainnya": { jasa: 300000, kurir: 50000 },
  "perpanjangan-1-tahun": { jasa: 250000, kurir: 50000 },
  "perpanjangan-5-tahun": { jasa: 500000, kurir: 50000 },
  "mutasi-antar-samsat": { jasa: 800000, kurir: 50000 },
  "mutasi-luar-daerah": { jasa: 1500000, kurir: 50000 },
  "balik-nama": { jasa: 1200000, kurir: 50000 },
  "tarik-berkas": { jasa: 600000, kurir: 50000 },
  "duplikat-stnk": { jasa: 350000, kurir: 50000 },
  "Perpanjangan 1 Tahun": { jasa: 250000, kurir: 50000 },
  "Perpanjangan 5 Tahun": { jasa: 500000, kurir: 50000 },
  "Mutasi Antar Samsat": { jasa: 800000, kurir: 50000 },
  "Mutasi Luar Daerah": { jasa: 1500000, kurir: 50000 },
  "Balik Nama": { jasa: 1200000, kurir: 50000 },
  "Tarik Berkas": { jasa: 600000, kurir: 50000 },
  "Duplikat STNK": { jasa: 350000, kurir: 50000 },
  "Lainnya": { jasa: 300000, kurir: 50000 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Authoritative Samsat Master List (10 Verified Operational Samsat)
// ─────────────────────────────────────────────────────────────────────────────
export const INITIAL_10_SAMSAT: SamsatMasterItem[] = [
  { id: "samsat-jakarta-timur", name: "Samsat Jakarta Timur", wilayah: "Jakarta Timur", alamat: "Jl. Raya Pondok Gede", kode_kabupaten_kota: "31.75", nama_provinsi: "Daerah Khusus Ibukota Jakarta", is_verified: true, status_aktif: true },
  { id: "samsat-jakarta-barat", name: "Samsat Jakarta Barat", wilayah: "Jakarta Barat", alamat: "Jl. Daan Mogot", kode_kabupaten_kota: "31.73", nama_provinsi: "Daerah Khusus Ibukota Jakarta", is_verified: true, status_aktif: true },
  { id: "samsat-jakarta-selatan", name: "Samsat Jakarta Selatan", wilayah: "Jakarta Selatan", alamat: "Jl. TB Simatupang", kode_kabupaten_kota: "31.74", nama_provinsi: "Daerah Khusus Ibukota Jakarta", is_verified: true, status_aktif: true },
  { id: "samsat-jakarta-utara", name: "Samsat Jakarta Utara", wilayah: "Jakarta Utara", alamat: "Jl. Yos Sudarso", kode_kabupaten_kota: "31.72", nama_provinsi: "Daerah Khusus Ibukota Jakarta", is_verified: true, status_aktif: true },
  { id: "samsat-jakarta-pusat", name: "Samsat Jakarta Pusat", wilayah: "Jakarta Pusat", alamat: "Jl. Gn. Sahari", kode_kabupaten_kota: "31.71", nama_provinsi: "Daerah Khusus Ibukota Jakarta", is_verified: true, status_aktif: true },
  { id: "samsat-depok", name: "Samsat Depok", wilayah: "Depok", alamat: "Jl. Margonda Raya", kode_kabupaten_kota: "32.76", nama_provinsi: "Jawa Barat", is_verified: true, status_aktif: true },
  { id: "samsat-bekasi", name: "Samsat Bekasi", wilayah: "Bekasi", alamat: "Jl. Ahmad Yani", kode_kabupaten_kota: "32.75", nama_provinsi: "Jawa Barat", is_verified: true, status_aktif: true },
  { id: "samsat-tangerang", name: "Samsat Tangerang", wilayah: "Tangerang", alamat: "Jl. Gatot Subroto", kode_kabupaten_kota: "36.71", nama_provinsi: "Banten", is_verified: true, status_aktif: true },
  { id: "samsat-bogor", name: "Samsat Bogor", wilayah: "Bogor", alamat: "Jl. Pajajaran", kode_kabupaten_kota: "32.71", nama_provinsi: "Jawa Barat", is_verified: true, status_aktif: true },
  { id: "samsat-tangerang-selatan", name: "Samsat Tangerang Selatan", wilayah: "Tangerang Selatan", alamat: "Jl. Pahlawan Seribu", kode_kabupaten_kota: "36.74", nama_provinsi: "Banten", is_verified: true, status_aktif: true },
];

export function buildSamsatMasterList(): SamsatMasterItem[] {
  const result: SamsatMasterItem[] = [...INITIAL_10_SAMSAT];
  const coveredCodes = new Set(INITIAL_10_SAMSAT.map((s) => s.kode_kabupaten_kota));

  WILAYAH_ADMINISTRATIF_LIST.forEach((w) => {
    if (!coveredCodes.has(w.kode_kabupaten_kota)) {
      const cleanName = w.nama_kabupaten_kota.replace(/^(kabupaten|kota)\s+/i, "").trim();
      const slug = `samsat-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const uniqueId = result.some((s) => s.id === slug) ? `${slug}-${w.kode_kabupaten_kota.replace(".", "")}` : slug;
      result.push({
        id: uniqueId,
        name: `Samsat ${cleanName}`,
        wilayah: cleanName,
        alamat: `Kantor Samsat ${cleanName}, ${w.nama_provinsi}`,
        kode_kabupaten_kota: w.kode_kabupaten_kota,
        nama_provinsi: w.nama_provinsi,
        is_verified: true,
        status_aktif: true,
      });
      coveredCodes.add(w.kode_kabupaten_kota);
    }
  });

  return result;
}

export const SAMSAT_LIST: SamsatMasterItem[] = buildSamsatMasterList();

export function resolveSamsatId(input?: string): string {
  if (!input) return "samsat-jakarta-timur";
  const normalized = input.toLowerCase().trim();

  // 1. Direct ID match
  const byId = SAMSAT_LIST.find((s) => s.id === normalized);
  if (byId) return byId.id;

  // 2. Direct Wilayah match
  const byWilayah = SAMSAT_LIST.find((s) => s.wilayah.toLowerCase() === normalized);
  if (byWilayah) return byWilayah.id;

  // 3. Direct Name match
  const byName = SAMSAT_LIST.find((s) => s.name.toLowerCase() === normalized);
  if (byName) return byName.id;

  // 4. Classic 10 shortcuts for Jabodetabek
  if (normalized.includes("timur")) return "samsat-jakarta-timur";
  if (normalized.includes("barat") && !normalized.includes("bandung")) return "samsat-jakarta-barat";
  if (normalized.includes("selatan") && !normalized.includes("tangerang")) return "samsat-jakarta-selatan";
  if (normalized.includes("utara")) return "samsat-jakarta-utara";
  if (normalized.includes("pusat")) return "samsat-jakarta-pusat";
  if (normalized.includes("depok")) return "samsat-depok";
  if (normalized.includes("bekasi")) return "samsat-bekasi";
  if (normalized.includes("tangerang selatan") || normalized.includes("tangsel")) return "samsat-tangerang-selatan";
  if (normalized.includes("tangerang")) return "samsat-tangerang";
  if (normalized.includes("bogor")) return "samsat-bogor";

  // 5. Partial contains match
  const partial = SAMSAT_LIST.find(
    (s) => s.wilayah.toLowerCase().includes(normalized) || s.name.toLowerCase().includes(normalized)
  );
  if (partial) return partial.id;

  if (normalized.startsWith("samsat-")) return normalized;

  return "samsat-jakarta-timur";
}

export function resolveServiceId(input?: string): string {
  if (!input) return "mutasi-antar-samsat";
  const normalized = input.toLowerCase().trim();
  if (normalized.includes("antar") || normalized === "svc-mut-antar") return "mutasi-antar-samsat";
  if (normalized.includes("luar") || normalized === "svc-mut-asal") return "mutasi-luar-daerah";
  if (
    normalized.includes("1 tahun") ||
    normalized.includes("1-tahun") ||
    normalized.includes("perpanjangan-stnk") ||
    normalized.includes("tahunan") ||
    normalized.includes("perp-1") ||
    normalized === "perpanjangan-1"
  ) {
    return "perpanjangan-1-tahun";
  }
  if (
    normalized.includes("5 tahun") ||
    normalized.includes("5-tahun") ||
    normalized.includes("perp-5") ||
    normalized === "perpanjangan-5"
  ) {
    return "perpanjangan-5-tahun";
  }
  if (normalized.includes("balik nama") || normalized.includes("balik-nama") || normalized.includes("svc-balik-nama")) return "balik-nama";
  if (normalized.includes("tarik berkas") || normalized.includes("tarik-berkas") || normalized.includes("svc-tarik-berkas")) return "tarik-berkas";
  if (normalized.includes("duplikat") || normalized.includes("svc-duplikat-stnk")) return "duplikat-stnk";
  return normalized.replace(/\s+/g, "-");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Authoritative Pricing Items (Master Component Catalog)
// ─────────────────────────────────────────────────────────────────────────────
export const MASTER_PRICING_ITEMS: PricingItem[] = [
  // 17 Mutasi Keluar
  { id: "mutasi-legalisir", code: "MK-01", name: "Legalisir", category: "Mutasi Keluar", active: true },
  { id: "mutasi-hadir", code: "MK-02", name: "Hadir", category: "Mutasi Keluar", active: true },
  { id: "mutasi-legalisir-cf", code: "MK-03", name: "Legalisir CF", category: "Mutasi Keluar", active: true },
  { id: "mutasi-cf", code: "MK-04", name: "Cek Fisik", category: "Mutasi Keluar", active: true },
  { id: "mutasi-bantuan", code: "MK-05", name: "Bantuan", category: "Mutasi Keluar", active: true },
  { id: "mutasi-hadir2", code: "MK-06", name: "Hadir 2", category: "Mutasi Keluar", active: true },
  { id: "mutasi-cek-blokir", code: "MK-07", name: "Cek Blokir", category: "Mutasi Keluar", active: true },
  { id: "mutasi-lok-pembukuan", code: "MK-08", name: "Lok. Pembukuan", category: "Mutasi Keluar", active: true },
  { id: "mutasi-lok-tu", code: "MK-09", name: "Lok. TU", category: "Mutasi Keluar", active: true },
  { id: "mutasi-lok-tu-nopil", code: "MK-10", name: "Lok. TU Nopil", category: "Mutasi Keluar", active: true },
  { id: "mutasi-loksus", code: "MK-11", name: "Loksus", category: "Mutasi Keluar", active: true },
  { id: "mutasi-cetak-skp", code: "MK-12", name: "Cetak SKP", category: "Mutasi Keluar", active: true },
  { id: "mutasi-cetak-fiskal", code: "MK-13", name: "Cetak Fiskal", category: "Mutasi Keluar", active: true },
  { id: "mutasi-lok-arsip", code: "MK-14", name: "Lok. Arsip", category: "Mutasi Keluar", active: true },
  { id: "mutasi-cek-progresif", code: "MK-15", name: "Cek Progresif", category: "Mutasi Keluar", active: true },
  { id: "mutasi-matiin-nopil", code: "MK-16", name: "Matiin Nopil", category: "Mutasi Keluar", active: true },
  { id: "mutasi-daftar-mutmas-normal", code: "MK-17", name: "Daftar Mutmas Normal", category: "Mutasi Keluar", active: true },
  { id: "mutasi-daftar-mutmas-kilat", code: "MK-18", name: "Daftar Mutmas Kilat", category: "Mutasi Keluar", active: true },

  // 13 Mutasi Masuk
  { id: "mutasi-legalisir-mutmas", code: "MM-01", name: "Legalisir Mutmas", category: "Mutasi Masuk", active: true },
  { id: "mutasi-mutmas-pendaftaran", code: "MM-02", name: "Mutmas By Pendaftaran", category: "Mutasi Masuk", active: true },
  { id: "mutasi-req-ganjil-genap", code: "MM-03", name: "Req Ganjil Genap", category: "Mutasi Masuk", active: true },
  { id: "mutasi-acak", code: "MM-04", name: "Nopol Acak", category: "Mutasi Masuk", active: true },
  { id: "mutasi-lok-tu-masuk", code: "MM-05", name: "Lok. TU Masuk", category: "Mutasi Masuk", active: true },
  { id: "mutasi-lok-pembukuan-masuk", code: "MM-06", name: "Lok. Pembukuan Masuk", category: "Mutasi Masuk", active: true },
  { id: "mutasi-daftar-bpkb", code: "MM-07", name: "Daftar BPKB", category: "Mutasi Masuk", active: true },
  { id: "mutasi-penulisan-bpkb", code: "MM-08", name: "Penulisan BPKB", category: "Mutasi Masuk", active: true },
  { id: "mutasi-cetak-notice", code: "MM-09", name: "Cetak Notice", category: "Mutasi Masuk", active: true },
  { id: "mutasi-cetak-stnk", code: "MM-10", name: "Cetak STNK", category: "Mutasi Masuk", active: true },
  { id: "mutasi-cetak-plat", code: "MM-11", name: "Cetak Plat", category: "Mutasi Masuk", active: true },
];

// Mapping helper from key in initialMutasiAS row to pricingItemId
const MUTASI_AS_ROW_KEY_MAP: Record<string, string> = {
  legalisir: "mutasi-legalisir",
  hadir: "mutasi-hadir",
  legalisirCf: "mutasi-legalisir-cf",
  cf: "mutasi-cf",
  bantuan: "mutasi-bantuan",
  hadir2: "mutasi-hadir2",
  cekBlokir: "mutasi-cek-blokir",
  lokPembukuan: "mutasi-lok-pembukuan",
  lokTu: "mutasi-lok-tu",
  lokTuNopil: "mutasi-lok-tu-nopil",
  loksus: "mutasi-loksus",
  cetakSkp: "mutasi-cetak-skp",
  cetakFiskal: "mutasi-cetak-fiskal",
  lokArsip: "mutasi-lok-arsip",
  cekProgresif: "mutasi-cek-progresif",
  matiinNopil: "mutasi-matiin-nopil",
  daftarMutmasNormal: "mutasi-daftar-mutmas-normal",
  daftarMutmasKilat: "mutasi-daftar-mutmas-kilat",
  legalisirMutmas: "mutasi-legalisir-mutmas",
  mutmasByPendaftaran: "mutasi-mutmas-pendaftaran",
  reqGanjilGenap: "mutasi-req-ganjil-genap",
  acak: "mutasi-acak",
  lokTuMasuk: "mutasi-lok-tu-masuk",
  lokPembukuanMasuk: "mutasi-lok-pembukuan-masuk",
  daftarBpkb: "mutasi-daftar-bpkb",
  penulisanBpkb: "mutasi-penulisan-bpkb",
  cetakNotice: "mutasi-cetak-notice",
  cetakStnk: "mutasi-cetak-stnk",
  cetakPlat: "mutasi-cetak-plat",
};

const MUTASI_LD_ROW_KEY_MAP: Record<string, string> = {
  totalBiaya: "mutasi-ld-total",
  cekFisik: "mutasi-ld-cek-fisik",
  fiskal: "mutasi-ld-fiskal",
  pnbp: "mutasi-ld-pnbp",
  bantuanCekFisik: "mutasi-ld-bantuan-cf",
  legalisir: "mutasi-ld-legalisir",
  daftarBpkb: "mutasi-ld-daftar-bpkb",
  loketTU: "mutasi-ld-loket-tu",
};

const BALIK_NAMA_ROW_KEY_MAP: Record<string, string> = {
  biayaPengurusan: "bn-pengurusan",
  biayaAdmin: "bn-admin",
  biayaLegalisir: "bn-legalisir",
  biayaCetak: "bn-cetak",
  cekFisik: "bn-cek-fisik",
  pnbpStnk: "bn-pnbp-stnk",
  pnbpBpkb: "bn-pnbp-bpkb",
  pnbpTnkb: "bn-pnbp-tnkb",
  bantuanCekFisik: "bn-bantuan-cf",
  daftarBpkb: "bn-daftar-bpkb",
};

const TARIK_BERKAS_ROW_KEY_MAP: Record<string, string> = {
  biayaPengambilan: "tb-pengambilan",
  biayaAdmin: "tb-admin",
  biayaEkspedisi: "tb-ekspedisi",
  tarikArsip: "tb-tarik-arsip",
  legalisir: "tb-legalisir",
  loketTU: "tb-loket-tu",
};

const DUPLIKAT_STNK_ROW_KEY_MAP: Record<string, string> = {
  biayaPembuatan: "dup-pembuatan",
  biayaAdmin: "dup-admin",
  biayaCetak: "dup-cetak",
  biayaValidasi: "dup-validasi",
  cekFisik: "dup-cek-fisik",
  pnbpStnk: "dup-pnbp-stnk",
  bantuanCekFisik: "dup-bantuan-cf",
  formulirHilang: "dup-formulir-hilang",
  korlantas: "dup-korlantas",
};


// ─────────────────────────────────────────────────────────────────────────────
// 3. Pricing Store (Authoritative Singleton)
// ─────────────────────────────────────────────────────────────────────────────
class PricingStore {
  // Samsat ID -> Map<pricingItemId, amount> (Legacy compatibility)
  private samsatPricing: Map<string, Map<string, number>> = new Map();

  // Canonical SSoT: National Catalog & Sparse Overrides
  private nationalPricing: Map<string, SamsatCostItem> = new Map();
  private samsatOverrides: Map<string, Map<string, { id?: string; nominal: number; isActive: boolean }>> = new Map();

  // Service ID + Samsat ID -> ServiceFeeConfig
  private serviceConfigs: Map<string, ServiceFeeConfig> = new Map();

  // Raw table rows for sync with UI components
  private samsats: SamsatMasterItem[] = [...SAMSAT_LIST];
  private mutasiASRows: any[] = [];
  private mutasiLDRows: any[] = [];
  private balikNamaRows: any[] = [];
  private tarikBerkasRows: any[] = [];
  private duplikatSTNKRows: any[] = [];
  private biayaLayananRows: any[] = [];
  private hargaDasarRows: any[] = [];

  private listeners: Set<() => void> = new Set();
  private isApiMode: boolean;
  private unsubscribeRepo?: () => void;

  constructor() {
    this.seed();
    this.isApiMode = APP_CONFIG.dataProvider === "api";
    if (this.isApiMode) {
      this.syncFromRepository();
      this.unsubscribeRepo = pricingRepository.subscribe(() => {
        this.syncFromRepository();
      });
    }
  }

  public setApiMode(isApi: boolean): void {
    this.isApiMode = isApi;
    if (this.unsubscribeRepo) {
      this.unsubscribeRepo();
      this.unsubscribeRepo = undefined;
    }
    if (isApi) {
      this.syncFromRepository();
      this.unsubscribeRepo = pricingRepository.subscribe(() => {
        this.syncFromRepository();
      });
    } else {
      this.seed();
      this.notify();
    }
  }

  public syncFromRepository(): void {
    const items = pricingRepository.getSamsatItems();
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item) => {
        this.nationalPricing.set(item.id, item);
        const price = item.basePrice || 0;
        this.samsatPricing.forEach((map) => {
          map.set(item.id, price);
        });
      });
    }

    // Asynchronously synchronize authoritative per-Samsat operational tariffs from backend
    if (pricingRepository.getSamsatOperationalTariffs) {
      pricingRepository.getSamsatOperationalTariffs().then((tariffs: any) => {
        if (Array.isArray(tariffs)) {
          this.samsatOverrides.clear();
          tariffs.forEach((t) => {
            let map = this.samsatOverrides.get(t.samsat_id);
            if (!map) {
              map = new Map();
              this.samsatOverrides.set(t.samsat_id, map);
            }
            map.set(t.pricing_item_id, {
              id: t.id,
              nominal: t.nominal,
              isActive: t.is_active === 1 || t.is_active === true,
            });

            // Also sync to legacy samsatPricing map
            let legacyMap = this.samsatPricing.get(t.samsat_id);
            if (!legacyMap) {
              legacyMap = new Map();
              this.samsatPricing.set(t.samsat_id, legacyMap);
            }
            legacyMap.set(t.pricing_item_id, t.nominal);
          });
          this.notify();
        }
      }).catch((e: any) => console.warn("Could not load samsat operational tariffs:", e));
    }

    // Authoritative Samsat list from backend database
    if (pricingRepository.getSamsatOffices) {
      const offices = pricingRepository.getSamsatOffices();
      if (Array.isArray(offices) && offices.length > 0) {
        this.samsats = offices.map((o) => ({
          id: o.id,
          name: o.name,
          wilayah: o.wilayah,
          alamat: o.alamat || `Kantor Samsat ${o.wilayah}`,
          kode_kabupaten_kota: o.kode_kabupaten_kota,
          nama_provinsi: o.nama_provinsi,
          is_verified: true,
          status_aktif: true,
        }));
      }
    }

    // Authoritative Biaya Layanan configs from backend database
    if (pricingRepository.getServiceConfigs) {
      const dbConfigs = pricingRepository.getServiceConfigs();
      if (Array.isArray(dbConfigs) && dbConfigs.length > 0) {
        dbConfigs.forEach((cfg) => {
          const key = cfg.id || `${cfg.serviceId}:${cfg.samsatId}`;
          this.serviceConfigs.set(key, cfg);

          // Update corresponding row in biayaLayananRows if matching
          const cfgSvcId = resolveServiceId(cfg.serviceId || cfg.serviceName);
          const cfgSamsatId = resolveSamsatId(cfg.samsatId || cfg.wilayah);

          const rowIdx = this.biayaLayananRows.findIndex(
            (r) => resolveServiceId(r.layanan) === cfgSvcId && resolveSamsatId(r.wilayah) === cfgSamsatId
          );
          if (rowIdx !== -1) {
            this.biayaLayananRows[rowIdx] = {
              ...this.biayaLayananRows[rowIdx],
              id: cfg.id || this.biayaLayananRows[rowIdx].id,
              dbId: cfg.id,
              biayaJasa: cfg.biayaJasa,
              biayaJasaLengkap: cfg.biayaJasa,
              biayaJasaR4: cfg.biayaJasaR4 ?? cfg.biayaJasa,
              biayaJasaR2: cfg.biayaJasaR2,
              jasaR4Enabled: cfg.jasaR4Enabled,
              jasaR2Enabled: cfg.jasaR2Enabled,
              biayaKhususR4: cfg.biayaKhususR4,
              biayaKhususR2: cfg.biayaKhususR2,
              khususR4Enabled: cfg.khususR4Enabled,
              khususR2Enabled: cfg.khususR2Enabled,
              biayaAntarJemput: cfg.biayaAntarJemput,
            };
          } else {
            this.biayaLayananRows.push({
              id: cfg.id || `bl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              dbId: cfg.id,
              layanan: cfg.serviceName || cfg.serviceId,
              wilayah: cfg.wilayah || cfg.samsatId,
              biayaJasa: cfg.biayaJasa || 0,
              biayaJasaLengkap: cfg.biayaJasa || 0,
              biayaJasaR4: cfg.biayaJasaR4 ?? cfg.biayaJasa,
              biayaJasaR2: cfg.biayaJasaR2,
              jasaR4Enabled: cfg.jasaR4Enabled,
              jasaR2Enabled: cfg.jasaR2Enabled,
              biayaKhususR4: cfg.biayaKhususR4,
              biayaKhususR2: cfg.biayaKhususR2,
              khususR4Enabled: cfg.khususR4Enabled,
              khususR2Enabled: cfg.khususR2Enabled,
              biayaJasaNembak: cfg.jasaNembak?.nominal || 0,
              biayaAntarJemput: cfg.biayaAntarJemput || 50000,
              antarJemputEnabled: cfg.antarJemputEnabled ?? true,
              swdkllj: cfg.swdkllj ? { ...cfg.swdkllj } : { nominal: 143000, enabled: true },
              opsenPkb: cfg.opsenPkb ? { ...cfg.opsenPkb } : { nominal: 143000, enabled: true },
              biayaLainnya: Array.isArray(cfg.biayaLainnya) ? cfg.biayaLainnya : [],
            });
          }
        });
      }
    }

    this.notify();
  }

  public async initFromApi(): Promise<void> {
    if (pricingRepository.initFromApi) {
      await pricingRepository.initFromApi();
    }
    this.syncFromRepository();
  }

  private seed() {
    // 0. Seed nationalPricing from MASTER_PRICING_ITEMS
    MASTER_PRICING_ITEMS.forEach((item) => {
      this.nationalPricing.set(item.id, {
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        basePrice: 0,
        isConfigured: false,
        active: item.active !== false,
        isActive: item.active !== false,
      });
    });

    // 1. Seed Mutasi AS table rows (from HargaDasarSamsat baseline)
    this.mutasiASRows = [
      {
        id: 1,
        namaSamsat: "Samsat Jakarta Timur",
        legalisir: 50000, hadir: 75000, legalisirCf: 100000, cf: 80000, bantuan: 60000, hadir2: 70000,
        cekBlokir: 25000, lokPembukuan: 30000, lokTu: 35000, lokTuNopil: 40000, loksus: 45000,
        cetakSkp: 20000, cetakFiskal: 25000, lokArsip: 30000, cekProgresif: 50000, matiinNopil: 35000,
        daftarMutmasNormal: 150000, daftarMutmasKilat: 250000,
        legalisirMutmas: 100000, mutmasByPendaftaran: 50000, reqGanjilGenap: 50000, acak: 40000,
        lokTuMasuk: 35000, lokPembukuanMasuk: 30000, daftarBpkb: 150000, penulisanBpkb: 100000,
        cetakNotice: 25000, cetakStnk: 50000, cetakPlat: 75000,
      },
      {
        id: 2,
        namaSamsat: "Samsat Jakarta Barat",
        legalisir: 50000, hadir: 75000, legalisirCf: 100000, cf: 80000, bantuan: 60000, hadir2: 70000,
        cekBlokir: 25000, lokPembukuan: 30000, lokTu: 35000, lokTuNopil: 40000, loksus: 45000,
        cetakSkp: 20000, cetakFiskal: 25000, lokArsip: 30000, cekProgresif: 50000, matiinNopil: 35000,
        daftarMutmasNormal: 150000, daftarMutmasKilat: 250000,
        legalisirMutmas: 100000, mutmasByPendaftaran: 50000, reqGanjilGenap: 50000, acak: 40000,
        lokTuMasuk: 35000, lokPembukuanMasuk: 30000, daftarBpkb: 150000, penulisanBpkb: 100000,
        cetakNotice: 25000, cetakStnk: 50000, cetakPlat: 75000,
      },
      {
        id: 3,
        namaSamsat: "Samsat Depok",
        legalisir: 45000, hadir: 70000, legalisirCf: 95000, cf: 75000, bantuan: 55000, hadir2: 65000,
        cekBlokir: 23000, lokPembukuan: 28000, lokTu: 33000, lokTuNopil: 38000, loksus: 43000,
        cetakSkp: 18000, cetakFiskal: 23000, lokArsip: 28000, cekProgresif: 48000, matiinNopil: 33000,
        daftarMutmasNormal: 140000, daftarMutmasKilat: 240000,
        legalisirMutmas: 95000, mutmasByPendaftaran: 48000, reqGanjilGenap: 48000, acak: 38000,
        lokTuMasuk: 33000, lokPembukuanMasuk: 28000, daftarBpkb: 140000, penulisanBpkb: 95000,
        cetakNotice: 23000, cetakStnk: 48000, cetakPlat: 70000,
      },
    ];

    // Seed Samsat pricing and nationalPricing from mutasiASRows
    const baseRow = this.mutasiASRows[0] || {};
    for (const [key, pricingItemId] of Object.entries(MUTASI_AS_ROW_KEY_MAP)) {
      const price = baseRow[key] || 50000;
      const existing = this.nationalPricing.get(pricingItemId);
      if (existing) {
        existing.basePrice = price;
        existing.isConfigured = true;
      }
    }

    this.mutasiASRows.forEach((row) => {
      const samsatId = resolveSamsatId(row.namaSamsat);
      let priceMap = this.samsatPricing.get(samsatId);
      if (!priceMap) {
        priceMap = new Map();
        this.samsatPricing.set(samsatId, priceMap);
      }
      for (const [key, pricingItemId] of Object.entries(MUTASI_AS_ROW_KEY_MAP)) {
        if (row[key] !== undefined && typeof row[key] === "number") {
          priceMap.set(pricingItemId, row[key]);
        }
      }
    });

    // Populate all other Samsats with baseline prices
    SAMSAT_LIST.forEach((samsat) => {
      if (!this.samsatPricing.has(samsat.id)) {
        const defaultMap = new Map();
        const baseRow = this.mutasiASRows[0];
        for (const [key, pricingItemId] of Object.entries(MUTASI_AS_ROW_KEY_MAP)) {
          defaultMap.set(pricingItemId, baseRow[key] || 50000);
        }
        this.samsatPricing.set(samsat.id, defaultMap);
      }
    });

    // Ensure all 10 Samsats exist in mutasiASRows
    SAMSAT_LIST.forEach((s) => {
      if (!this.mutasiASRows.some((r) => resolveSamsatId(r.namaSamsat) === s.id)) {
        const baseRow = this.mutasiASRows[0];
        this.mutasiASRows.push({
          ...baseRow,
          id: this.mutasiASRows.length + 1,
          namaSamsat: s.name,
        });
      }
    });

    // Seed other Harga Dasar Samsat sub-tabs for all 10 Samsats
    this.mutasiLDRows = SAMSAT_LIST.map((s, idx) => ({
      id: idx + 1,
      namaSamsat: s.name,
      totalBiaya: s.id === "samsat-depok" ? 480000 : s.id === "samsat-tangerang" ? 520000 : 500000,
    }));

    this.balikNamaRows = SAMSAT_LIST.map((s, idx) => ({
      id: idx + 1,
      namaSamsat: s.name,
      biayaPengurusan: s.id === "samsat-depok" ? 190000 : 200000,
      biayaAdmin: s.id === "samsat-depok" ? 48000 : 50000,
      biayaLegalisir: s.id === "samsat-depok" ? 70000 : 75000,
      biayaCetak: s.id === "samsat-depok" ? 95000 : 100000,
      totalEstimasi: s.id === "samsat-depok" ? 403000 : 425000,
    }));

    this.tarikBerkasRows = SAMSAT_LIST.map((s, idx) => ({
      id: idx + 1,
      namaSamsat: s.name,
      biayaPengambilan: s.id === "samsat-depok" ? 140000 : 150000,
      biayaAdmin: s.id === "samsat-depok" ? 48000 : 50000,
      biayaEkspedisi: s.id === "samsat-depok" ? 70000 : 75000,
      totalEstimasi: s.id === "samsat-depok" ? 258000 : 275000,
    }));

    this.duplikatSTNKRows = SAMSAT_LIST.map((s, idx) => ({
      id: idx + 1,
      namaSamsat: s.name,
      biayaPembuatan: s.id === "samsat-depok" ? 95000 : 100000,
      biayaAdmin: s.id === "samsat-depok" ? 48000 : 50000,
      biayaCetak: s.id === "samsat-depok" ? 70000 : 75000,
      biayaValidasi: s.id === "samsat-depok" ? 48000 : 50000,
      totalEstimasi: s.id === "samsat-depok" ? 261000 : 275000,
    }));

    this.hargaDasarRows = [];

    // 2. Seed Biaya Layanan table rows (from BiayaLayanan.tsx baseline)
    this.biayaLayananRows = [
      // Perpanjangan 1 Tahun
      { id: 1, layanan: "Perpanjangan 1 Tahun", wilayah: "Jakarta Timur", biayaJasaLengkap: 250000, biayaJasaNembak: 150000, biayaAntarJemput: 50000 },
      { id: 2, layanan: "Perpanjangan 1 Tahun", wilayah: "Jakarta Barat", biayaJasaLengkap: 250000, biayaJasaNembak: 150000, biayaAntarJemput: 50000 },
      { id: 3, layanan: "Perpanjangan 1 Tahun", wilayah: "Jakarta Selatan", biayaJasaLengkap: 250000, biayaJasaNembak: 150000, biayaAntarJemput: 50000 },
      { id: 4, layanan: "Perpanjangan 1 Tahun", wilayah: "Jakarta Utara", biayaJasaLengkap: 250000, biayaJasaNembak: 150000, biayaAntarJemput: 50000 },
      { id: 5, layanan: "Perpanjangan 1 Tahun", wilayah: "Jakarta Pusat", biayaJasaLengkap: 250000, biayaJasaNembak: 150000, biayaAntarJemput: 50000 },
      { id: 6, layanan: "Perpanjangan 1 Tahun", wilayah: "Depok", biayaJasaLengkap: 230000, biayaJasaNembak: 140000, biayaAntarJemput: 60000 },
      { id: 7, layanan: "Perpanjangan 1 Tahun", wilayah: "Bekasi", biayaJasaLengkap: 240000, biayaJasaNembak: 145000, biayaAntarJemput: 55000 },
      { id: 8, layanan: "Perpanjangan 1 Tahun", wilayah: "Tangerang", biayaJasaLengkap: 240000, biayaJasaNembak: 145000, biayaAntarJemput: 55000 },
      { id: 9, layanan: "Perpanjangan 1 Tahun", wilayah: "Bogor", biayaJasaLengkap: 230000, biayaJasaNembak: 140000, biayaAntarJemput: 65000 },
      { id: 10, layanan: "Perpanjangan 1 Tahun", wilayah: "Tangerang Selatan", biayaJasaLengkap: 245000, biayaJasaNembak: 148000, biayaAntarJemput: 52000 },

      // Perpanjangan 5 Tahun
      { id: 11, layanan: "Perpanjangan 5 Tahun", wilayah: "Jakarta Timur", biayaJasaLengkap: 500000, biayaJasaNembak: 300000, biayaAntarJemput: 50000 },
      { id: 12, layanan: "Perpanjangan 5 Tahun", wilayah: "Jakarta Barat", biayaJasaLengkap: 500000, biayaJasaNembak: 300000, biayaAntarJemput: 50000 },
      { id: 13, layanan: "Perpanjangan 5 Tahun", wilayah: "Jakarta Selatan", biayaJasaLengkap: 500000, biayaJasaNembak: 300000, biayaAntarJemput: 50000 },
      { id: 14, layanan: "Perpanjangan 5 Tahun", wilayah: "Jakarta Utara", biayaJasaLengkap: 500000, biayaJasaNembak: 300000, biayaAntarJemput: 50000 },
      { id: 15, layanan: "Perpanjangan 5 Tahun", wilayah: "Jakarta Pusat", biayaJasaLengkap: 500000, biayaJasaNembak: 300000, biayaAntarJemput: 50000 },
      { id: 16, layanan: "Perpanjangan 5 Tahun", wilayah: "Depok", biayaJasaLengkap: 480000, biayaJasaNembak: 290000, biayaAntarJemput: 60000 },
      { id: 17, layanan: "Perpanjangan 5 Tahun", wilayah: "Bekasi", biayaJasaLengkap: 490000, biayaJasaNembak: 295000, biayaAntarJemput: 55000 },
      { id: 18, layanan: "Perpanjangan 5 Tahun", wilayah: "Tangerang", biayaJasaLengkap: 490000, biayaJasaNembak: 295000, biayaAntarJemput: 55000 },
      { id: 19, layanan: "Perpanjangan 5 Tahun", wilayah: "Bogor", biayaJasaLengkap: 480000, biayaJasaNembak: 290000, biayaAntarJemput: 65000 },
      { id: 20, layanan: "Perpanjangan 5 Tahun", wilayah: "Tangerang Selatan", biayaJasaLengkap: 495000, biayaJasaNembak: 298000, biayaAntarJemput: 52000 },

      // Mutasi Antar Samsat (Biaya Jasa Jakarta Timur = 800000)
      { id: 21, layanan: "Mutasi Antar Samsat", wilayah: "Jakarta Timur", biayaJasa: 800000, biayaAntarJemput: 50000 },
      { id: 22, layanan: "Mutasi Antar Samsat", wilayah: "Jakarta Barat", biayaJasa: 800000, biayaAntarJemput: 50000 },
      { id: 23, layanan: "Mutasi Antar Samsat", wilayah: "Jakarta Selatan", biayaJasa: 800000, biayaAntarJemput: 50000 },
      { id: 24, layanan: "Mutasi Antar Samsat", wilayah: "Jakarta Utara", biayaJasa: 800000, biayaAntarJemput: 50000 },
      { id: 25, layanan: "Mutasi Antar Samsat", wilayah: "Jakarta Pusat", biayaJasa: 800000, biayaAntarJemput: 50000 },
      { id: 26, layanan: "Mutasi Antar Samsat", wilayah: "Depok", biayaJasa: 750000, biayaAntarJemput: 60000 },
      { id: 27, layanan: "Mutasi Antar Samsat", wilayah: "Bekasi", biayaJasa: 780000, biayaAntarJemput: 55000 },
      { id: 28, layanan: "Mutasi Antar Samsat", wilayah: "Tangerang", biayaJasa: 780000, biayaAntarJemput: 55000 },
      { id: 29, layanan: "Mutasi Antar Samsat", wilayah: "Bogor", biayaJasa: 750000, biayaAntarJemput: 65000 },
      { id: 30, layanan: "Mutasi Antar Samsat", wilayah: "Tangerang Selatan", biayaJasa: 790000, biayaAntarJemput: 52000 },

      // Mutasi Luar Daerah
      { id: 31, layanan: "Mutasi Luar Daerah", wilayah: "Jakarta Timur", biayaJasa: 1500000, biayaAntarJemput: 50000 },
      { id: 32, layanan: "Mutasi Luar Daerah", wilayah: "Jakarta Barat", biayaJasa: 1500000, biayaAntarJemput: 50000 },
      { id: 33, layanan: "Mutasi Luar Daerah", wilayah: "Jakarta Selatan", biayaJasa: 1500000, biayaAntarJemput: 50000 },
      { id: 34, layanan: "Mutasi Luar Daerah", wilayah: "Jakarta Utara", biayaJasa: 1500000, biayaAntarJemput: 50000 },
      { id: 35, layanan: "Mutasi Luar Daerah", wilayah: "Jakarta Pusat", biayaJasa: 1500000, biayaAntarJemput: 50000 },
      { id: 36, layanan: "Mutasi Luar Daerah", wilayah: "Depok", biayaJasa: 1400000, biayaAntarJemput: 60000 },
      { id: 37, layanan: "Mutasi Luar Daerah", wilayah: "Bekasi", biayaJasa: 1450000, biayaAntarJemput: 55000 },
      { id: 38, layanan: "Mutasi Luar Daerah", wilayah: "Tangerang", biayaJasa: 1450000, biayaAntarJemput: 55000 },
      { id: 39, layanan: "Mutasi Luar Daerah", wilayah: "Bogor", biayaJasa: 1400000, biayaAntarJemput: 65000 },
      { id: 40, layanan: "Mutasi Luar Daerah", wilayah: "Tangerang Selatan", biayaJasa: 1475000, biayaAntarJemput: 52000 },

      // Balik Nama
      { id: 41, layanan: "Balik Nama", wilayah: "Jakarta Timur", biayaJasa: 1200000, biayaAntarJemput: 50000 },
      { id: 42, layanan: "Balik Nama", wilayah: "Jakarta Barat", biayaJasa: 1200000, biayaAntarJemput: 50000 },
      { id: 43, layanan: "Balik Nama", wilayah: "Jakarta Selatan", biayaJasa: 1200000, biayaAntarJemput: 50000 },
      { id: 44, layanan: "Balik Nama", wilayah: "Jakarta Utara", biayaJasa: 1200000, biayaAntarJemput: 50000 },
      { id: 45, layanan: "Balik Nama", wilayah: "Jakarta Pusat", biayaJasa: 1200000, biayaAntarJemput: 50000 },
      { id: 46, layanan: "Balik Nama", wilayah: "Depok", biayaJasa: 1100000, biayaAntarJemput: 60000 },
      { id: 47, layanan: "Balik Nama", wilayah: "Bekasi", biayaJasa: 1150000, biayaAntarJemput: 55000 },
      { id: 48, layanan: "Balik Nama", wilayah: "Tangerang", biayaJasa: 1150000, biayaAntarJemput: 55000 },
      { id: 49, layanan: "Balik Nama", wilayah: "Bogor", biayaJasa: 1100000, biayaAntarJemput: 65000 },
      { id: 50, layanan: "Balik Nama", wilayah: "Tangerang Selatan", biayaJasa: 1175000, biayaAntarJemput: 52000 },

      // Tarik Berkas
      { id: 51, layanan: "Tarik Berkas", wilayah: "Jakarta Timur", biayaJasa: 600000, biayaAntarJemput: 50000 },
      { id: 52, layanan: "Tarik Berkas", wilayah: "Jakarta Barat", biayaJasa: 600000, biayaAntarJemput: 50000 },
      { id: 53, layanan: "Tarik Berkas", wilayah: "Jakarta Selatan", biayaJasa: 600000, biayaAntarJemput: 50000 },
      { id: 54, layanan: "Tarik Berkas", wilayah: "Jakarta Utara", biayaJasa: 600000, biayaAntarJemput: 50000 },
      { id: 55, layanan: "Tarik Berkas", wilayah: "Jakarta Pusat", biayaJasa: 600000, biayaAntarJemput: 50000 },
      { id: 56, layanan: "Tarik Berkas", wilayah: "Depok", biayaJasa: 550000, biayaAntarJemput: 60000 },
      { id: 57, layanan: "Tarik Berkas", wilayah: "Bekasi", biayaJasa: 580000, biayaAntarJemput: 55000 },
      { id: 58, layanan: "Tarik Berkas", wilayah: "Tangerang", biayaJasa: 580000, biayaAntarJemput: 55000 },
      { id: 59, layanan: "Tarik Berkas", wilayah: "Bogor", biayaJasa: 550000, biayaAntarJemput: 65000 },
      { id: 60, layanan: "Tarik Berkas", wilayah: "Tangerang Selatan", biayaJasa: 590000, biayaAntarJemput: 52000 },

      // Duplikat STNK
      { id: 61, layanan: "Duplikat STNK", wilayah: "Jakarta Timur", biayaJasa: 350000, biayaAntarJemput: 50000 },
      { id: 62, layanan: "Duplikat STNK", wilayah: "Jakarta Barat", biayaJasa: 350000, biayaAntarJemput: 50000 },
      { id: 63, layanan: "Duplikat STNK", wilayah: "Jakarta Selatan", biayaJasa: 350000, biayaAntarJemput: 50000 },
      { id: 64, layanan: "Duplikat STNK", wilayah: "Jakarta Utara", biayaJasa: 350000, biayaAntarJemput: 50000 },
      { id: 65, layanan: "Duplikat STNK", wilayah: "Jakarta Pusat", biayaJasa: 350000, biayaAntarJemput: 50000 },
      { id: 66, layanan: "Duplikat STNK", wilayah: "Depok", biayaJasa: 320000, biayaAntarJemput: 60000 },
      { id: 67, layanan: "Duplikat STNK", wilayah: "Bekasi", biayaJasa: 340000, biayaAntarJemput: 55000 },
      { id: 68, layanan: "Duplikat STNK", wilayah: "Tangerang", biayaJasa: 340000, biayaAntarJemput: 55000 },
      { id: 69, layanan: "Duplikat STNK", wilayah: "Bogor", biayaJasa: 320000, biayaAntarJemput: 65000 },
      { id: 70, layanan: "Duplikat STNK", wilayah: "Tangerang Selatan", biayaJasa: 345000, biayaAntarJemput: 52000 },

      // Lainnya
      { id: 71, layanan: "Lainnya", wilayah: "Jakarta Timur", biayaJasa: 300000, biayaAntarJemput: 50000 },
      { id: 72, layanan: "Lainnya", wilayah: "Jakarta Barat", biayaJasa: 300000, biayaAntarJemput: 50000 },
      { id: 73, layanan: "Lainnya", wilayah: "Jakarta Selatan", biayaJasa: 300000, biayaAntarJemput: 50000 },
      { id: 74, layanan: "Lainnya", wilayah: "Jakarta Utara", biayaJasa: 300000, biayaAntarJemput: 50000 },
      { id: 75, layanan: "Lainnya", wilayah: "Jakarta Pusat", biayaJasa: 300000, biayaAntarJemput: 50000 },
      { id: 76, layanan: "Lainnya", wilayah: "Depok", biayaJasa: 280000, biayaAntarJemput: 60000 },
      { id: 77, layanan: "Lainnya", wilayah: "Bekasi", biayaJasa: 290000, biayaAntarJemput: 55000 },
      { id: 78, layanan: "Lainnya", wilayah: "Tangerang", biayaJasa: 290000, biayaAntarJemput: 55000 },
      { id: 79, layanan: "Lainnya", wilayah: "Bogor", biayaJasa: 280000, biayaAntarJemput: 65000 },
      { id: 80, layanan: "Lainnya", wilayah: "Tangerang Selatan", biayaJasa: 295000, biayaAntarJemput: 52000 },
    ];

    // Seed remaining Samsats across Indonesia in Biaya Layanan rows
    const coveredSamsats = new Set(this.biayaLayananRows.map((r) => r.wilayah));
    const standardServices = [
      { name: "Perpanjangan 1 Tahun", jasa: 250000, antarJemput: 50000 },
      { name: "Perpanjangan 5 Tahun", jasa: 500000, antarJemput: 50000 },
      { name: "Mutasi Antar Samsat", jasa: 800000, antarJemput: 50000 },
      { name: "Mutasi Luar Daerah", jasa: 1500000, antarJemput: 50000 },
      { name: "Balik Nama", jasa: 1200000, antarJemput: 50000 },
      { name: "Tarik Berkas", jasa: 600000, antarJemput: 50000 },
      { name: "Duplikat STNK", jasa: 350000, antarJemput: 50000 },
      { name: "Lainnya", jasa: 300000, antarJemput: 50000 },
    ];

    let nextRowId = this.biayaLayananRows.length + 1;
    SAMSAT_LIST.forEach((samsat) => {
      if (!coveredSamsats.has(samsat.wilayah)) {
        standardServices.forEach((svc) => {
          this.biayaLayananRows.push({
            id: nextRowId++,
            layanan: svc.name,
            wilayah: samsat.wilayah,
            biayaJasaLengkap: svc.jasa,
            biayaJasaNembak: Math.round(svc.jasa * 0.6),
            biayaAntarJemput: svc.antarJemput,
            biayaJasa: svc.jasa,
            biayaPengurusanKhusus: Math.round(svc.jasa * 0.6),
            jasaLengkapEnabled: true,
            jasaNembakEnabled: false,
            pengurusanKhususEnabled: false,
            antarJemputEnabled: true,
            swdkllj: { nominal: 143000, enabled: true },
            opsenPkb: { nominal: 143000, enabled: true },
            biayaLainnya: [],
          });
        });
        coveredSamsats.add(samsat.wilayah);
      }
    });

    // Seed Service configs per (serviceId, samsatId)
    this.biayaLayananRows.forEach((row) => {
      const serviceId = resolveServiceId(row.layanan);
      const samsatId = resolveSamsatId(row.wilayah);
      const biayaJasa = row.biayaJasa || row.biayaJasaLengkap || 0;
      const biayaAntarJemput = row.biayaAntarJemput || 50000;
      const jasaLengkapNominal = row.biayaJasaLengkap || row.biayaJasa || 0;
      const jasaNembakNominal = row.biayaJasaNembak || Math.round(jasaLengkapNominal * 0.6);

      row.biayaJasaLengkap = jasaLengkapNominal;
      row.jasaLengkapEnabled = row.jasaLengkapEnabled ?? true;
      row.biayaJasaNembak = jasaNembakNominal;
      row.jasaNembakEnabled = row.jasaNembakEnabled ?? false;
      row.biayaPengurusanKhusus = jasaNembakNominal;
      row.pengurusanKhususEnabled = row.jasaNembakEnabled;
      row.biayaAntarJemput = biayaAntarJemput;
      row.antarJemputEnabled = row.antarJemputEnabled ?? true;
      row.swdkllj = row.swdkllj ? { ...row.swdkllj } : { nominal: 143000, enabled: true };
      row.opsenPkb = { ...row.swdkllj };
      row.biayaLainnya = row.biayaLainnya ? row.biayaLainnya.map((b: any) => ({ ...b })) : [];

      // Determine default active components per service type
      const components: ServiceComponentConfig[] = this.getDefaultComponentsForService(serviceId);

      const key = `${serviceId}:${samsatId}`;
      this.serviceConfigs.set(key, {
        serviceId,
        serviceName: row.layanan,
        samsatId,
        wilayah: row.wilayah,
        biayaJasa,
        jasaLengkap: {
          nominal: jasaLengkapNominal,
          enabled: row.jasaLengkapEnabled,
        },
        jasaNembak: {
          nominal: jasaNembakNominal,
          enabled: row.jasaNembakEnabled,
        },
        biayaPengurusanKhusus: {
          nominal: jasaNembakNominal,
          enabled: row.jasaNembakEnabled,
        },
        biayaAntarJemput,
        antarJemputEnabled: row.antarJemputEnabled,
        components,
        swdkllj: { ...row.swdkllj },
        opsenPkb: { ...row.swdkllj },
        biayaLainnya: row.biayaLainnya.map((b: any) => ({ ...b })),
        active: true,
      });
    });
  }

  // Component assignment based on business requirements
  private getDefaultComponentsForService(serviceId: string): ServiceComponentConfig[] {
    switch (serviceId) {
      case "mutasi-antar-samsat":
        // Mutasi Antar Samsat requires only: Legalisir, Cek Fisik, Cek Blokir
        return [
          { pricingItemId: "mutasi-legalisir", enabled: true, required: true },
          { pricingItemId: "mutasi-cf", enabled: true, required: true },
          { pricingItemId: "mutasi-cek-blokir", enabled: true, required: true },
        ];
      case "mutasi-luar-daerah":
        return [
          { pricingItemId: "mutasi-legalisir", enabled: true, required: true },
          { pricingItemId: "mutasi-cf", enabled: true, required: true },
          { pricingItemId: "mutasi-cek-blokir", enabled: true, required: true },
          { pricingItemId: "mutasi-cetak-fiskal", enabled: true, required: true },
        ];
      case "balik-nama":
        return [
          { pricingItemId: "mutasi-cf", enabled: true, required: true },
          { pricingItemId: "mutasi-cek-blokir", enabled: true, required: true },
        ];
      case "perpanjangan-5-tahun":
        return [
          { pricingItemId: "mutasi-cf", enabled: true, required: true },
        ];
      case "perpanjangan-1-tahun":
        return [];
      case "tarik-berkas":
        return [
          { pricingItemId: "mutasi-lok-arsip", enabled: true, required: true },
        ];
      case "duplikat-stnk":
        return [
          { pricingItemId: "mutasi-cetak-stnk", enabled: true, required: true },
        ];
      default:
        return [];
    }
  }

  // ─── Reactive Pub-Sub ───────────────────────────────────────────────────────
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error("Error in PricingStore listener:", err);
      }
    });
  }

  // ─── Samsat & Pricing Catalog Methods ───────────────────────────────────────
  public getSamsats(): SamsatMasterItem[] {
    return [...this.samsats];
  }

  public getSamsatList(): SamsatMasterItem[] {
    return this.getSamsats();
  }

  public getSamsatById(samsatId: string): SamsatMasterItem {
    const resolved = resolveSamsatId(samsatId);
    return this.samsats.find((s) => s.id === resolved) || {
      id: resolved,
      name: `Samsat ${resolved.replace(/^samsat-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      wilayah: resolved.replace(/^samsat-/, "").replace(/-/g, " "),
      status_aktif: true,
      is_verified: false,
    };
  }

  public async addSamsat(data: {
    name: string;
    wilayah: string;
    alamat: string;
    kode_kabupaten_kota?: string;
    nama_provinsi?: string;
    is_verified?: boolean;
    status_aktif?: boolean;
  }): Promise<SamsatMasterItem> {
    const slug = `samsat-${data.wilayah.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const id = this.samsats.some((s) => s.id === slug)
      ? `${slug}-${Date.now().toString().slice(-4)}`
      : slug;

    // Lookup official wilayah if code provided
    let officialProvinsi = data.nama_provinsi;
    const officialWilayah = data.kode_kabupaten_kota ? findWilayahByKode(data.kode_kabupaten_kota) : undefined;
    if (officialWilayah && !officialProvinsi) {
      officialProvinsi = (officialWilayah as any).provinsi || (officialWilayah as any).namaProvinsi;
    }

    const normalizedName = normalizeSamsatOfficeName(
      data.name,
      officialWilayah?.jenis_wilayah,
      officialWilayah?.nama_kabupaten_kota || data.wilayah
    );

    const payload: SamsatMasterItem = {
      id,
      name: normalizedName,
      wilayah: data.wilayah,
      alamat: data.alamat,
      kode_kabupaten_kota: data.kode_kabupaten_kota,
      nama_provinsi: officialProvinsi,
      is_verified: data.is_verified ?? true,
      status_aktif: data.status_aktif ?? true,
    };

    // Sync to backend API if available and await confirmation
    if (typeof fetch !== "undefined") {
      const token = typeof window !== "undefined" ? window.localStorage?.getItem("auth_token") : undefined;
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/samsat/offices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Gagal menyimpan data Samsat ke server (HTTP ${res.status})`);
      }

      const resData = await res.json().catch(() => ({}));
      if (resData?.data) {
        payload.id = resData.data.id || payload.id;
        payload.name = resData.data.name || payload.name;
        payload.wilayah = resData.data.wilayah || payload.wilayah;
        if (resData.data.alamat !== undefined) payload.alamat = resData.data.alamat;
      }
    }

    const newSamsat = payload;
    this.samsats.push(newSamsat);

    // Initialize pricing map
    const defaultMap = new Map();
    const baseRow = this.mutasiASRows[0] || {};
    for (const [key, pricingItemId] of Object.entries(MUTASI_AS_ROW_KEY_MAP)) {
      defaultMap.set(pricingItemId, baseRow[key] || 50000);
    }
    this.samsatPricing.set(newSamsat.id, defaultMap);

    // Add row to mutasiASRows
    this.mutasiASRows.push({
      id: Math.max(...this.mutasiASRows.map((r) => r.id), 0) + 1,
      namaSamsat: newSamsat.name,
      ...baseRow,
    });

    // Add default service fee rows for all standard services
    const services = [
      { name: "Perpanjangan 1 Tahun", jasa: 250000, antarJemput: 50000 },
      { name: "Perpanjangan 5 Tahun", jasa: 500000, antarJemput: 50000 },
      { name: "Mutasi Antar Samsat", jasa: 800000, antarJemput: 50000 },
      { name: "Mutasi Luar Daerah", jasa: 1500000, antarJemput: 50000 },
      { name: "Balik Nama", jasa: 1200000, antarJemput: 50000 },
      { name: "Tarik Berkas", jasa: 600000, antarJemput: 50000 },
      { name: "Duplikat STNK", jasa: 350000, antarJemput: 50000 },
    ];
    services.forEach((svc) => {
      const serviceId = resolveServiceId(svc.name);
      const rowId = Math.max(...this.biayaLayananRows.map((r) => r.id), 0) + 1;
      const newRow = {
        id: rowId,
        layanan: svc.name,
        wilayah: newSamsat.wilayah,
        biayaJasa: svc.jasa,
        biayaJasaLengkap: svc.jasa,
        biayaJasaNembak: Math.round(svc.jasa * 0.6),
        biayaAntarJemput: svc.antarJemput,
      };
      this.biayaLayananRows.push(newRow);
      this.serviceConfigs.set(`${serviceId}:${newSamsat.id}`, {
        serviceId,
        serviceName: svc.name,
        samsatId: newSamsat.id,
        wilayah: newSamsat.wilayah,
        biayaJasa: svc.jasa,
        biayaAntarJemput: svc.antarJemput,
        components: this.getDefaultComponentsForService(serviceId),
        active: true,
      });
    });

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin Master",
        userRole: "admin",
        action: "CREATE",
        module: "Master Data",
        details: `Samsat baru "${newSamsat.name}" (${newSamsat.wilayah}) berhasil ditambahkan ke Master Data.`,
        metadata: { id: newSamsat.id, name: newSamsat.name, wilayah: newSamsat.wilayah },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return newSamsat;
  }

  public async updateSamsat(
    id: string,
    updates: Partial<{
      name: string;
      wilayah: string;
      alamat: string;
      kode_kabupaten_kota?: string;
      nama_provinsi?: string;
      is_verified?: boolean;
      status_aktif?: boolean;
    }>
  ): Promise<boolean> {
    const samsat = this.samsats.find((s) => s.id === id);
    if (!samsat) throw new Error(`Kantor Samsat dengan ID '${id}' tidak ditemukan`);

    const targetKode = updates.kode_kabupaten_kota || samsat.kode_kabupaten_kota;
    const officialWilayah = targetKode ? findWilayahByKode(targetKode) : undefined;
    const normalizedUpdates = { ...updates };
    if (updates.name) {
      normalizedUpdates.name = normalizeSamsatOfficeName(
        updates.name,
        officialWilayah?.jenis_wilayah,
        officialWilayah?.nama_kabupaten_kota || updates.wilayah || samsat.wilayah
      );
    }

    // Sync to backend API if available and await confirmation
    if (typeof fetch !== "undefined") {
      const token = typeof window !== "undefined" ? window.localStorage?.getItem("auth_token") : undefined;
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/samsat/offices/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(normalizedUpdates),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Gagal memperbarui Samsat di server (HTTP ${res.status})`);
      }
    }

    const oldName = samsat.name;
    const oldWilayah = samsat.wilayah;
    if (normalizedUpdates.name) samsat.name = normalizedUpdates.name;
    if (normalizedUpdates.wilayah) samsat.wilayah = normalizedUpdates.wilayah;
    if (normalizedUpdates.alamat) samsat.alamat = normalizedUpdates.alamat;
    if (normalizedUpdates.kode_kabupaten_kota !== undefined) samsat.kode_kabupaten_kota = normalizedUpdates.kode_kabupaten_kota;
    if (normalizedUpdates.nama_provinsi !== undefined) samsat.nama_provinsi = normalizedUpdates.nama_provinsi;
    if (normalizedUpdates.is_verified !== undefined) samsat.is_verified = normalizedUpdates.is_verified;
    if (normalizedUpdates.status_aktif !== undefined) samsat.status_aktif = normalizedUpdates.status_aktif;

    // Update in mutasiASRows
    this.mutasiASRows.forEach((r) => {
      if (r.namaSamsat === oldName) r.namaSamsat = samsat.name;
    });
    // Update in biayaLayananRows
    this.biayaLayananRows.forEach((r) => {
      if (r.wilayah === oldWilayah) r.wilayah = samsat.wilayah;
    });

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin Master",
        userRole: "admin",
        action: "UPDATE",
        module: "Master Data",
        details: `Data Samsat "${samsat.name}" (${samsat.id}) berhasil diperbarui.`,
        metadata: { id, updates },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  public async deleteSamsat(id: string): Promise<boolean> {
    const idx = this.samsats.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Kantor Samsat dengan ID '${id}' tidak ditemukan`);

    // Sync to backend API if available and await confirmation
    if (typeof fetch !== "undefined") {
      const token = typeof window !== "undefined" ? window.localStorage?.getItem("auth_token") : undefined;
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/samsat/offices/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Gagal menghapus Samsat di server (HTTP ${res.status})`);
      }
    }

    const samsat = this.samsats[idx];
    this.samsats.splice(idx, 1);
    this.samsatPricing.delete(id);
    this.mutasiASRows = this.mutasiASRows.filter((r) => r.namaSamsat !== samsat.name);
    this.biayaLayananRows = this.biayaLayananRows.filter((r) => r.wilayah !== samsat.wilayah);

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin Master",
        userRole: "admin",
        action: "DELETE",
        module: "Master Data",
        details: `Samsat "${samsat.name}" (${samsat.id}) berhasil dihapus dari Master Data.`,
        metadata: { id, name: samsat.name },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  // ─── Wilayah Administratif Methods ──────────────────────────────────────────
  public getWilayahMetadata() {
    return { ...WILAYAH_REFERENSI };
  }

  public getProvinces(): ProvinsiItem[] {
    return PROVINSI_LIST;
  }

  public getWilayahAdministratifList(): WilayahAdministratifItem[] {
    return WILAYAH_ADMINISTRATIF_LIST;
  }

  public getWilayahByKode(kode: string): WilayahAdministratifItem | undefined {
    return findWilayahByKode(kode);
  }

  public getWilayahOverview(filters?: {
    provinsi?: string;
    jenis?: "Kabupaten" | "Kota" | "all";
    search?: string;
    status?: "configured" | "unconfigured" | "all";
  }) {
    let list = WILAYAH_ADMINISTRATIF_LIST;

    if (filters?.provinsi && filters.provinsi !== "all") {
      const pNorm = filters.provinsi.toLowerCase().trim();
      list = list.filter(
        (w) =>
          w.nama_provinsi.toLowerCase() === pNorm ||
          w.kode_provinsi === filters.provinsi
      );
    }

    if (filters?.jenis && filters.jenis !== "all") {
      list = list.filter((w) => w.jenis_wilayah === filters.jenis);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (w) =>
          w.kode_kabupaten_kota.toLowerCase().includes(q) ||
          w.nama_kabupaten_kota.toLowerCase().includes(q) ||
          w.nama_provinsi.toLowerCase().includes(q)
      );
    }

    const samsats = this.samsats;

    const mapped = list.map((w) => {
      // Match linked Samsat by official Kemendagri code or fallback by name
      const linkedSamsats = samsats.filter(
        (s) =>
          s.kode_kabupaten_kota === w.kode_kabupaten_kota ||
          (s.wilayah &&
            s.wilayah.toLowerCase().trim() ===
              w.nama_kabupaten_kota.toLowerCase().replace(/^(kabupaten|kota)\s+/i, "").trim())
      );
      const hasConfiguredSamsat = linkedSamsats.length > 0;
      return {
        ...w,
        kode: w.kode_kabupaten_kota,
        nama: w.nama_kabupaten_kota,
        jenis: w.jenis_wilayah,
        provinsi: w.nama_provinsi,
        samsatOffices: linkedSamsats,
        hasConfiguredSamsat,
        biayaStatus: hasConfiguredSamsat ? ("Terkonfigurasi" as const) : ("Belum Dikonfigurasi" as const),
      };
    });

    if (filters?.status && filters.status !== "all") {
      if (filters.status === "configured") {
        return mapped.filter((item) => item.hasConfiguredSamsat);
      } else if (filters.status === "unconfigured") {
        return mapped.filter((item) => !item.hasConfiguredSamsat);
      }
    }

    return mapped;
  }

  public async linkSamsatToWilayah(samsatId: string, kodeKabupatenKota: string): Promise<boolean> {
    const samsat = this.samsats.find((s) => s.id === samsatId);
    if (!samsat) throw new Error(`Kantor Samsat dengan ID '${samsatId}' tidak ditemukan`);
    const wilayah = findWilayahByKode(kodeKabupatenKota);
    if (!wilayah) throw new Error(`Kode wilayah '${kodeKabupatenKota}' tidak valid`);

    if (typeof fetch !== "undefined") {
      const token = typeof window !== "undefined" ? window.localStorage?.getItem("auth_token") : undefined;
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/samsat/offices/${encodeURIComponent(samsatId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kode_kabupaten_kota: wilayah.kode_kabupaten_kota,
          nama_provinsi: wilayah.nama_provinsi,
          is_verified: true,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Gagal menghubungkan Samsat ke wilayah di server (HTTP ${res.status})`);
      }
    }

    samsat.kode_kabupaten_kota = wilayah.kode_kabupaten_kota;
    samsat.nama_provinsi = wilayah.nama_provinsi;
    samsat.is_verified = true;

    this.notify();
    return true;
  }

  public getPricingItems(): PricingItem[] {
    return [...MASTER_PRICING_ITEMS];
  }

  public getPricingItemById(id: string): PricingItem | undefined {
    return MASTER_PRICING_ITEMS.find((i) => i.id === id);
  }

  // ─── Samsat Pricing Methods (Canonical National Default + Per-Samsat Override) ─
  public getNationalPricingItems(): SamsatCostItem[] {
    if (this.nationalPricing.size > 0) {
      return Array.from(this.nationalPricing.values());
    }
    return MASTER_PRICING_ITEMS.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      basePrice: 0,
      isConfigured: false,
      active: item.active !== false,
      isActive: item.active !== false,
    }));
  }

  public getNationalDefaultPrice(pricingItemId: string): number {
    const item = this.nationalPricing.get(pricingItemId) || (this.getPricingItemById(pricingItemId) as SamsatCostItem | undefined);
    return item?.basePrice ?? 0;
  }

  public resolveEffectiveTariff(
    samsatId: string,
    pricingItemId: string,
    jurisdiction: "ASAL" | "TUJUAN" | "STANDARD" = "STANDARD"
  ): ResolvedTariff {
    const resolvedSamsatId = resolveSamsatId(samsatId);
    const masterItem = this.nationalPricing.get(pricingItemId) || (this.getPricingItemById(pricingItemId) as SamsatCostItem | undefined) || null;
    const officeOverrides = resolvedSamsatId ? this.samsatOverrides.get(resolvedSamsatId) : null;
    const override = officeOverrides ? officeOverrides.get(pricingItemId) : null;
    return resolveTariff({ masterItem, override, samsatId: resolvedSamsatId, jurisdiction });
  }

  public getEffectiveSamsatPricing(
    samsatId: string,
    jurisdiction: "ASAL" | "TUJUAN" | "STANDARD" = "STANDARD"
  ): ResolvedTariff[] {
    const items = this.getNationalPricingItems();
    return items.map((item) => this.resolveEffectiveTariff(samsatId, item.id, jurisdiction));
  }

  public getSamsatPrice(
    samsatId: string,
    pricingItemId: string,
    jurisdiction: "ASAL" | "TUJUAN" | "STANDARD" = "STANDARD"
  ): number | null {
    const resolved = this.resolveEffectiveTariff(samsatId, pricingItemId, jurisdiction);
    return resolved.effectivePrice;
  }

  public getSamsatTariffStatus(samsatId: string, pricingItemId: string): "CONFIGURED" | "ZERO_EXPLICIT" | "UNCONFIGURED" {
    const resolved = this.resolveEffectiveTariff(samsatId, pricingItemId);
    if (resolved.effectivePrice === null) return "UNCONFIGURED";
    if (resolved.isExplicitZero) return "ZERO_EXPLICIT";
    return "CONFIGURED";
  }

  public async setSamsatOverride(samsatId: string, pricingItemId: string, nominal: number): Promise<boolean> {
    const resolvedSamsatId = resolveSamsatId(samsatId);
    const validNominal = Math.max(0, Math.round(Number(nominal)));

    let officeMap = this.samsatOverrides.get(resolvedSamsatId);
    if (!officeMap) {
      officeMap = new Map();
      this.samsatOverrides.set(resolvedSamsatId, officeMap);
    }
    officeMap.set(pricingItemId, { nominal: validNominal, isActive: true });

    let legacyMap = this.samsatPricing.get(resolvedSamsatId);
    if (!legacyMap) {
      legacyMap = new Map();
      this.samsatPricing.set(resolvedSamsatId, legacyMap);
    }
    legacyMap.set(pricingItemId, validNominal);

    if (pricingRepository.updateSamsatOperationalTariff) {
      await pricingRepository.updateSamsatOperationalTariff(resolvedSamsatId, pricingItemId, validNominal);
    }

    this.notify();
    return true;
  }

  public async resetSamsatOverride(samsatId: string, pricingItemId: string): Promise<boolean> {
    const resolvedSamsatId = resolveSamsatId(samsatId);
    const officeMap = this.samsatOverrides.get(resolvedSamsatId);
    if (officeMap) {
      officeMap.delete(pricingItemId);
    }

    const legacyMap = this.samsatPricing.get(resolvedSamsatId);
    if (legacyMap) {
      const nationalDefault = this.nationalPricing.get(pricingItemId)?.basePrice ?? 0;
      legacyMap.set(pricingItemId, nationalDefault);
    }

    if (pricingRepository.deleteSamsatOperationalTariff) {
      await pricingRepository.deleteSamsatOperationalTariff({ samsatId: resolvedSamsatId, pricingItemId });
    }

    this.notify();
    return true;
  }

  public updateSamsatPrice(samsatId: string, pricingItemId: string, amount: number): boolean {
    const resolvedSamsatId = resolveSamsatId(samsatId);
    this.setSamsatOverride(resolvedSamsatId, pricingItemId, amount);
    return true;
  }

  public deleteSamsatPrice(samsatId: string, pricingItemId: string): boolean {
    const resolvedSamsatId = resolveSamsatId(samsatId);
    this.resetSamsatOverride(resolvedSamsatId, pricingItemId);
    return true;
  }

  public async updateNationalDefault(pricingItemId: string, updates: Partial<SamsatCostItem>): Promise<boolean> {
    const existing = this.nationalPricing.get(pricingItemId) || (this.getPricingItemById(pricingItemId) as SamsatCostItem | undefined);
    if (!existing) return false;

    const updatedItem = { ...existing, ...updates };
    this.nationalPricing.set(pricingItemId, updatedItem);

    const masterIdx = MASTER_PRICING_ITEMS.findIndex((it) => it.id === pricingItemId);
    if (masterIdx !== -1) {
      MASTER_PRICING_ITEMS[masterIdx] = { ...MASTER_PRICING_ITEMS[masterIdx], ...updates };
    }

    if (pricingRepository.updateSamsatItem) {
      await pricingRepository.updateSamsatItem(pricingItemId, updates);
    }

    this.notify();
    return true;
  }

  /**
   * Batch save overrides for a single Samsat office.
   * If a value is null OR equals the national default price (Decision #2: same as default => follows default),
   * any existing override is removed (reset to default).
   * Otherwise, the override is saved.
   */
  public async saveSamsatRowOverrides(
    samsatId: string,
    componentValues: Record<string, number | null>
  ): Promise<void> {
    const resolvedSamsatId = resolveSamsatId(samsatId);
    if (!resolvedSamsatId) {
      throw new Error(`Kantor Samsat '${samsatId}' tidak valid.`);
    }

    const tariffsToUpsert: Array<{ pricingItemId: string; nominal: number }> = [];
    const itemsToDelete: string[] = [];

    for (const [pricingItemId, val] of Object.entries(componentValues)) {
      const nationalItem = this.nationalPricing.get(pricingItemId) || (this.getPricingItemById(pricingItemId) as SamsatCostItem | undefined);
      const nationalPrice = nationalItem?.basePrice ?? 0;

      if (val === null || val === undefined || val === nationalPrice) {
        // Equal to default or explicitly reset -> remove override
        itemsToDelete.push(pricingItemId);
      } else {
        const nominal = Math.max(0, Math.round(Number(val) || 0));
        tariffsToUpsert.push({ pricingItemId, nominal });
      }
    }

    // 1. Process deletions / resets
    for (const itemId of itemsToDelete) {
      await this.resetSamsatOverride(resolvedSamsatId, itemId);
    }

    // 2. Process upserts
    if (tariffsToUpsert.length > 0) {
      if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch) {
        // Sync local memory first
        for (const t of tariffsToUpsert) {
          let officeMap = this.samsatOverrides.get(resolvedSamsatId);
          if (!officeMap) {
            officeMap = new Map();
            this.samsatOverrides.set(resolvedSamsatId, officeMap);
          }
          officeMap.set(t.pricingItemId, { nominal: t.nominal, isActive: true });

          let legacyMap = this.samsatPricing.get(resolvedSamsatId);
          if (!legacyMap) {
            legacyMap = new Map();
            this.samsatPricing.set(resolvedSamsatId, legacyMap);
          }
          legacyMap.set(t.pricingItemId, t.nominal);
        }
        await pricingRepository.updateSamsatOperationalTariffsBatch(resolvedSamsatId, tariffsToUpsert);
      } else {
        for (const t of tariffsToUpsert) {
          await this.setSamsatOverride(resolvedSamsatId, t.pricingItemId, t.nominal);
        }
      }
    }

    this.notify();
  }

  /**
   * Reset all overrides for a Samsat office back to National Default.
   */
  public async resetAllSamsatOverrides(samsatId: string): Promise<void> {
    const resolvedSamsatId = resolveSamsatId(samsatId);
    const officeMap = this.samsatOverrides.get(resolvedSamsatId);
    if (!officeMap || officeMap.size === 0) return;

    const itemIds = Array.from(officeMap.keys());
    for (const itemId of itemIds) {
      await this.resetSamsatOverride(resolvedSamsatId, itemId);
    }
    this.notify();
  }

  /**
   * Check if a Samsat office has custom pricing that actually differs from the national default.
   * Compares the effective price of active overrides against the national standard price.
   */
  public hasSamsatCustomPricing(samsatId: string): boolean {
    const resolvedSamsatId = resolveSamsatId(samsatId);
    if (!resolvedSamsatId) return false;
    const officeMap = this.samsatOverrides.get(resolvedSamsatId);
    if (!officeMap || officeMap.size === 0) return false;

    for (const [pricingItemId, override] of officeMap.entries()) {
      if (!override.isActive) continue;
      const nationalItem = this.nationalPricing.get(pricingItemId) || (this.getPricingItemById(pricingItemId) as SamsatCostItem | undefined);
      const defaultPrice = nationalItem?.basePrice ?? 0;
      if (override.nominal !== defaultPrice) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns set of all Samsat IDs with at least one active override
   * whose nominal actually differs from the national default price.
   */
  public getOfficesWithCustomPricing(): Set<string> {
    const result = new Set<string>();
    for (const [samsatId, officeMap] of this.samsatOverrides.entries()) {
      if (!officeMap || officeMap.size === 0) continue;
      for (const [pricingItemId, override] of officeMap.entries()) {
        if (!override.isActive) continue;
        const nationalItem = this.nationalPricing.get(pricingItemId) || (this.getPricingItemById(pricingItemId) as SamsatCostItem | undefined);
        const defaultPrice = nationalItem?.basePrice ?? 0;
        if (override.nominal !== defaultPrice) {
          result.add(samsatId);
          break;
        }
      }
    }
    return result;
  }

  /**
   * Check if a Samsat office has any active overrides differing from standard.
   */
  public hasSamsatOverrides(samsatId: string): boolean {
    return this.hasSamsatCustomPricing(samsatId);
  }

  /**
   * Returns set of all Samsat IDs with at least one active override differing from standard.
   */
  public getOfficesWithOverrides(): Set<string> {
    return this.getOfficesWithCustomPricing();
  }

  /**
   * Returns list of all available official services registered in the system.
   * Derived dynamically from authoritative Biaya Layanan master configuration,
   * preserving canonical business ordering and including any runtime/API additions.
   */
  public getAvailableServices(): string[] {
    const canonicalOrder = [
      "Perpanjangan 1 Tahun",
      "Perpanjangan 5 Tahun",
      "Mutasi Antar Samsat",
      "Mutasi Luar Daerah",
      "Balik Nama",
      "Tarik Berkas",
      "Duplikat STNK",
    ];

    const serviceSet = new Set<string>();

    // 1. Gather services from active Biaya Layanan rows
    if (Array.isArray(this.biayaLayananRows)) {
      for (const row of this.biayaLayananRows) {
        if (row && typeof row.layanan === "string" && row.layanan.trim()) {
          serviceSet.add(row.layanan.trim());
        }
      }
    }

    // 2. Gather services from registered service configs
    if (this.serviceConfigs && this.serviceConfigs.size > 0) {
      for (const cfg of this.serviceConfigs.values()) {
        if (cfg && typeof cfg.serviceName === "string" && cfg.serviceName.trim()) {
          serviceSet.add(cfg.serviceName.trim());
        }
      }
    }

    // 3. Fallback to canonical order if empty
    if (serviceSet.size === 0) {
      return [...canonicalOrder];
    }

    // Preserve canonical order first
    const ordered: string[] = [];
    for (const service of canonicalOrder) {
      if (serviceSet.has(service)) {
        ordered.push(service);
        serviceSet.delete(service);
      }
    }

    // Append any newly added/custom services
    for (const customService of serviceSet) {
      ordered.push(customService);
    }

    return ordered;
  }

  // ─── Biaya Layanan Methods (Service Fee Config per Service + Samsat) ────────
  public getServiceFeeConfig(serviceIdOrName: string, samsatIdOrWilayah: string): ServiceFeeConfig | undefined {
    const serviceId = resolveServiceId(serviceIdOrName);
    const samsatId = resolveSamsatId(samsatIdOrWilayah);
    const key = `${serviceId}:${samsatId}`;
    let cfg = this.serviceConfigs.get(key);
    if (!cfg) {
      const template = Array.from(this.serviceConfigs.values()).find((c) => c.serviceId === serviceId);
      if (template) {
        cfg = {
          ...template,
          samsatId,
          wilayah: samsatId.replace(/^samsat-/, "").replace(/-/g, " "),
        };
      }
    }
    if (!cfg) return undefined;

    if (!cfg.jasaLengkap) {
      cfg.jasaLengkap = { nominal: cfg.biayaJasa || 0, enabled: true };
    }
    if (!cfg.jasaNembak) {
      cfg.jasaNembak = { nominal: Math.round((cfg.biayaJasa || 0) * 0.6), enabled: false };
    }
    if (cfg.antarJemputEnabled === undefined) {
      cfg.antarJemputEnabled = true;
    }
    if (!cfg.swdkllj) {
      cfg.swdkllj = { nominal: 143000, enabled: true };
    }
    if (!cfg.biayaLainnya) {
      cfg.biayaLainnya = [];
    }
    return cfg;
  }

  public updateServiceFeeConfig(
    serviceIdOrName: string,
    samsatIdOrWilayah: string,
    updates: Partial<ServiceFeeConfig>
  ): boolean {
    const serviceId = resolveServiceId(serviceIdOrName);
    const samsatId = resolveSamsatId(samsatIdOrWilayah);
    const key = `${serviceId}:${samsatId}`;
    const existing = this.getServiceFeeConfig(serviceId, samsatId);
    if (!existing) return false;

    const oldBiayaJasa = existing.biayaJasa;

    if (updates.biayaJasa !== undefined) existing.biayaJasa = updates.biayaJasa;
    if (updates.biayaJasaR4 !== undefined) existing.biayaJasaR4 = updates.biayaJasaR4;
    if (updates.biayaJasaR2 !== undefined) existing.biayaJasaR2 = updates.biayaJasaR2;
    if (updates.jasaR4Enabled !== undefined) existing.jasaR4Enabled = updates.jasaR4Enabled;
    if (updates.jasaR2Enabled !== undefined) existing.jasaR2Enabled = updates.jasaR2Enabled;
    if (updates.biayaKhususR4 !== undefined) existing.biayaKhususR4 = updates.biayaKhususR4;
    if (updates.biayaKhususR2 !== undefined) existing.biayaKhususR2 = updates.biayaKhususR2;
    if (updates.khususR4Enabled !== undefined) existing.khususR4Enabled = updates.khususR4Enabled;
    if (updates.khususR2Enabled !== undefined) existing.khususR2Enabled = updates.khususR2Enabled;

    if (updates.jasaLengkap) existing.jasaLengkap = { ...updates.jasaLengkap };
    if (updates.jasaNembak) {
      existing.jasaNembak = { ...updates.jasaNembak };
      existing.biayaPengurusanKhusus = { ...updates.jasaNembak };
    }
    if (updates.biayaPengurusanKhusus) {
      existing.biayaPengurusanKhusus = { ...updates.biayaPengurusanKhusus };
      existing.jasaNembak = { ...updates.biayaPengurusanKhusus };
    }
    if (updates.antarJemputEnabled !== undefined) existing.antarJemputEnabled = updates.antarJemputEnabled;
    if (updates.biayaAntarJemput !== undefined) existing.biayaAntarJemput = updates.biayaAntarJemput;
    if (updates.swdkllj) {
      existing.swdkllj = { ...updates.swdkllj };
      existing.opsenPkb = { ...updates.swdkllj };
    }
    if (updates.opsenPkb) {
      existing.opsenPkb = { ...updates.opsenPkb };
      existing.swdkllj = { ...updates.opsenPkb };
    }
    if (updates.biayaLainnya) existing.biayaLainnya = updates.biayaLainnya.map((b) => ({ ...b }));
    if (updates.components) existing.components = [...updates.components];
    if (updates.active !== undefined) existing.active = updates.active;

    if (updates.biayaJasa !== undefined) {
      existing.biayaJasa = updates.biayaJasa;
      if (existing.jasaLengkap) existing.jasaLengkap.nominal = updates.biayaJasa;
    } else if (existing.jasaLengkap) {
      existing.biayaJasa = existing.jasaLengkap.nominal;
    }

    // Sync back to biayaLayananRows for UI table
    const row = this.biayaLayananRows.find(
      (r) => resolveServiceId(r.layanan) === serviceId && resolveSamsatId(r.wilayah) === samsatId
    );
    if (row) {
      if (existing.jasaLengkap) {
        row.biayaJasaLengkap = existing.jasaLengkap.nominal;
        row.jasaLengkapEnabled = existing.jasaLengkap.enabled;
        if (row.biayaJasa !== undefined) row.biayaJasa = existing.jasaLengkap.nominal;
      }
      if (existing.jasaNembak) {
        row.biayaJasaNembak = existing.jasaNembak.nominal;
        row.jasaNembakEnabled = existing.jasaNembak.enabled;
        row.biayaPengurusanKhusus = existing.jasaNembak.nominal;
        row.pengurusanKhususEnabled = existing.jasaNembak.enabled;
      }
      row.biayaAntarJemput = existing.biayaAntarJemput;
      row.antarJemputEnabled = existing.antarJemputEnabled;
      if (existing.swdkllj) {
        row.swdkllj = { ...existing.swdkllj };
        row.opsenPkb = { ...existing.swdkllj };
      }
      if (existing.biayaLainnya) row.biayaLainnya = existing.biayaLainnya.map((b) => ({ ...b }));
    }

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin Master",
        userRole: "admin",
        action: "UPDATE",
        module: "Master Data",
        details: `Biaya Layanan ${existing.serviceName} (${existing.wilayah}) diupdate. Jasa: Rp ${existing.biayaJasa.toLocaleString("id-ID")}, Antar Jemput: Rp ${existing.biayaAntarJemput.toLocaleString("id-ID")}`,
        metadata: { serviceId, samsatId, oldBiayaJasa, newBiayaJasa: existing.biayaJasa },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return true;
  }

  public getMasterPricingItems(): PricingItem[] {
    return [...MASTER_PRICING_ITEMS];
  }

  public getSamsatComponentsForService(
    serviceIdOrName: string,
    samsatIdOrWilayah: string
  ): Array<{ id: string; label: string; code: string; nominal: number; enabled: boolean }> {
    const serviceId = resolveServiceId(serviceIdOrName);
    const samsatId = resolveSamsatId(samsatIdOrWilayah);
    const config = this.getServiceFeeConfig(serviceId, samsatId);

    return MASTER_PRICING_ITEMS.map((item) => {
      const price = this.getSamsatPrice(samsatId, item.id);
      const isEnabled = config?.components.find((c) => c.pricingItemId === item.id)?.enabled ?? false;
      return {
        id: item.id,
        label: item.name,
        code: item.code,
        nominal: price ?? 0,
        enabled: isEnabled,
      };
    });
  }

  public addBiayaLainnya(
    serviceIdOrName: string,
    samsatIdOrWilayah: string,
    item: { label: string; nominal: number; enabled?: boolean }
  ): ServiceCostItem | null {
    const config = this.getServiceFeeConfig(serviceIdOrName, samsatIdOrWilayah);
    if (!config) return null;
    if (!config.biayaLainnya) config.biayaLainnya = [];

    const newItem: ServiceCostItem = {
      id: `bl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      label: item.label.trim(),
      nominal: Math.max(0, Number(item.nominal) || 0),
      enabled: item.enabled ?? true,
    };
    config.biayaLainnya.push(newItem);

    // Sync to row
    const row = this.biayaLayananRows.find(
      (r) => resolveServiceId(r.layanan) === resolveServiceId(serviceIdOrName) &&
             resolveSamsatId(r.wilayah) === resolveSamsatId(samsatIdOrWilayah)
    );
    if (row) {
      row.biayaLainnya = config.biayaLainnya.map((b) => ({ ...b }));
    }

    this.notify();
    return newItem;
  }

  public updateBiayaLainnya(
    serviceIdOrName: string,
    samsatIdOrWilayah: string,
    itemId: string,
    updates: Partial<ServiceCostItem>
  ): boolean {
    const config = this.getServiceFeeConfig(serviceIdOrName, samsatIdOrWilayah);
    if (!config || !config.biayaLainnya) return false;
    const item = config.biayaLainnya.find((b) => b.id === itemId);
    if (!item) return false;

    if (updates.label !== undefined) item.label = updates.label.trim();
    if (updates.nominal !== undefined) item.nominal = Math.max(0, Number(updates.nominal) || 0);
    if (updates.enabled !== undefined) item.enabled = updates.enabled;

    // Sync to row
    const row = this.biayaLayananRows.find(
      (r) => resolveServiceId(r.layanan) === resolveServiceId(serviceIdOrName) &&
             resolveSamsatId(r.wilayah) === resolveSamsatId(samsatIdOrWilayah)
    );
    if (row) {
      row.biayaLainnya = config.biayaLainnya.map((b) => ({ ...b }));
    }

    this.notify();
    return true;
  }

  public deleteBiayaLainnya(
    serviceIdOrName: string,
    samsatIdOrWilayah: string,
    itemId: string
  ): boolean {
    const config = this.getServiceFeeConfig(serviceIdOrName, samsatIdOrWilayah);
    if (!config || !config.biayaLainnya) return false;
    const idx = config.biayaLainnya.findIndex((b) => b.id === itemId);
    if (idx === -1) return false;

    config.biayaLainnya.splice(idx, 1);

    // Sync to row
    const row = this.biayaLayananRows.find(
      (r) => resolveServiceId(r.layanan) === resolveServiceId(serviceIdOrName) &&
             resolveSamsatId(r.wilayah) === resolveSamsatId(samsatIdOrWilayah)
    );
    if (row) {
      row.biayaLainnya = config.biayaLainnya.map((b) => ({ ...b }));
    }

    this.notify();
    return true;
  }

  public toggleComponent(serviceIdOrName: string, samsatIdOrWilayah: string, pricingItemId: string, enabled: boolean): boolean {
    const config = this.getServiceFeeConfig(serviceIdOrName, samsatIdOrWilayah);
    if (!config) return false;
    const comp = config.components.find((c) => c.pricingItemId === pricingItemId);
    if (comp) {
      comp.enabled = enabled;
    } else {
      config.components.push({ pricingItemId, enabled, required: false });
    }
    this.notify();
    return true;
  }

  // ─── UI Table Bindings (Directly Connected to Master Data) ──────────────────
  public getMutasiASRows(): any[] {
    return this.mutasiASRows.map((r) => ({ ...r }));
  }

  public async updateMutasiASRow(id: number, updatedRow: any): Promise<void> {
    const idx = this.mutasiASRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.mutasiASRows[idx] = { ...updatedRow };
      const samsatId = resolveSamsatId(updatedRow.namaSamsat);
      let priceMap = this.samsatPricing.get(samsatId);
      if (!priceMap) {
        priceMap = new Map();
        this.samsatPricing.set(samsatId, priceMap);
      }
      for (const [key, pricingItemId] of Object.entries(MUTASI_AS_ROW_KEY_MAP)) {
        if (updatedRow[key] !== undefined && typeof updatedRow[key] === "number") {
          priceMap.set(pricingItemId, updatedRow[key]);
          await this.setSamsatOverride(samsatId, pricingItemId, updatedRow[key]);
        }
      }
      this.notify();
    }
  }

  public addMutasiASRow(row: any): void {
    this.mutasiASRows.push(row);
    const samsatId = resolveSamsatId(row.namaSamsat);
    let priceMap = this.samsatPricing.get(samsatId);
    if (!priceMap) {
      priceMap = new Map();
      this.samsatPricing.set(samsatId, priceMap);
    }
    for (const [key, pricingItemId] of Object.entries(MUTASI_AS_ROW_KEY_MAP)) {
      if (row[key] !== undefined && typeof row[key] === "number") {
        priceMap.set(pricingItemId, row[key]);
      }
    }
    this.notify();
  }

  public deleteMutasiASRow(id: number): void {
    const idx = this.mutasiASRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.mutasiASRows.splice(idx, 1);
      this.notify();
    }
  }

  public getBiayaLayananRows(): any[] {
    return this.biayaLayananRows.map((r) => ({ ...r }));
  }

  public async updateBiayaLayananRow(id: any, updatedRow: any): Promise<void> {
    const idx = this.biayaLayananRows.findIndex((r) => String(r.id) === String(id) || String(r.dbId) === String(id));
    if (idx === -1) {
      throw new Error(`Baris biaya layanan '${id}' tidak ditemukan.`);
    }

    const serviceId = resolveServiceId(updatedRow.layanan);
    const samsatId = resolveSamsatId(updatedRow.wilayah);
    const key = updatedRow.dbId || `${serviceId}:${samsatId}`;
    const newBiayaJasa = updatedRow.biayaJasa || updatedRow.biayaJasaLengkap || 0;
    const newAntarJemput = updatedRow.biayaAntarJemput || 50000;

    const existing = this.serviceConfigs.get(key) || this.serviceConfigs.get(`${serviceId}:${samsatId}`);
    let updatedConfig: any;

    if (existing) {
      existing.biayaJasa = newBiayaJasa;
      existing.biayaAntarJemput = newAntarJemput;
      if (updatedRow.biayaJasaLengkap !== undefined || updatedRow.jasaLengkapEnabled !== undefined) {
        existing.jasaLengkap = {
          nominal: updatedRow.biayaJasaLengkap ?? existing.jasaLengkap?.nominal ?? newBiayaJasa,
          enabled: updatedRow.jasaLengkapEnabled ?? existing.jasaLengkap?.enabled ?? true,
        };
      }
      if (
        updatedRow.biayaJasaNembak !== undefined ||
        updatedRow.jasaNembakEnabled !== undefined ||
        updatedRow.biayaPengurusanKhusus !== undefined ||
        updatedRow.pengurusanKhususEnabled !== undefined
      ) {
        const nom =
          updatedRow.biayaPengurusanKhusus ??
          updatedRow.biayaJasaNembak ??
          existing.biayaPengurusanKhusus?.nominal ??
          existing.jasaNembak?.nominal ??
          Math.round(newBiayaJasa * 0.6);
        const en =
          updatedRow.pengurusanKhususEnabled ??
          updatedRow.jasaNembakEnabled ??
          existing.biayaPengurusanKhusus?.enabled ??
          existing.jasaNembak?.enabled ??
          false;
        existing.jasaNembak = { nominal: nom, enabled: en };
        existing.biayaPengurusanKhusus = { nominal: nom, enabled: en };
      }
      if (updatedRow.antarJemputEnabled !== undefined) {
        existing.antarJemputEnabled = updatedRow.antarJemputEnabled;
      }
      if (updatedRow.opsenPkb || updatedRow.swdkllj) {
        const ops = updatedRow.opsenPkb || updatedRow.swdkllj;
        existing.swdkllj = { ...ops };
        existing.opsenPkb = { ...ops };
      }
      if (updatedRow.biayaLainnya) {
        existing.biayaLainnya = updatedRow.biayaLainnya.map((b: any) => ({ ...b }));
      }
      updatedConfig = existing;
    } else {
      const khususNom = updatedRow.biayaPengurusanKhusus ?? updatedRow.biayaJasaNembak ?? Math.round(newBiayaJasa * 0.6);
      const khususEn = updatedRow.pengurusanKhususEnabled ?? updatedRow.jasaNembakEnabled ?? false;
      const opsenObj = updatedRow.opsenPkb ? { ...updatedRow.opsenPkb } : (updatedRow.swdkllj ? { ...updatedRow.swdkllj } : { nominal: 143000, enabled: true });

      updatedConfig = {
        id: key,
        serviceId,
        serviceName: updatedRow.layanan,
        samsatId,
        wilayah: updatedRow.wilayah,
        biayaJasa: newBiayaJasa,
        jasaLengkap: {
          nominal: updatedRow.biayaJasaLengkap ?? newBiayaJasa,
          enabled: updatedRow.jasaLengkapEnabled ?? true,
        },
        jasaNembak: {
          nominal: khususNom,
          enabled: khususEn,
        },
        biayaPengurusanKhusus: {
          nominal: khususNom,
          enabled: khususEn,
        },
        biayaAntarJemput: newAntarJemput,
        antarJemputEnabled: updatedRow.antarJemputEnabled ?? true,
        components: this.getDefaultComponentsForService(serviceId),
        swdkllj: opsenObj,
        opsenPkb: opsenObj,
        biayaLainnya: updatedRow.biayaLainnya ? updatedRow.biayaLainnya.map((b: any) => ({ ...b })) : [],
        active: true,
      };
      this.serviceConfigs.set(key, updatedConfig);
    }

    if (this.isApiMode && pricingRepository.updateServicePricing) {
      await pricingRepository.updateServicePricing(key, updatedConfig);
    }

    this.biayaLayananRows[idx] = { ...updatedRow, id: key, dbId: key };
    this.notify();
  }

  public async addBiayaLayananRow(row: any): Promise<any> {
    const serviceId = resolveServiceId(row.layanan);
    const samsatId = resolveSamsatId(row.wilayah);
    const key = `${serviceId}:${samsatId}`;
    const khususNom = row.biayaPengurusanKhusus || row.biayaJasaNembak || Math.round((row.biayaJasa || 0) * 0.6);
    const khususEn = row.pengurusanKhususEnabled ?? row.jasaNembakEnabled ?? false;
    const opsenObj = row.opsenPkb ? { ...row.opsenPkb } : (row.swdkllj ? { ...row.swdkllj } : { nominal: 143000, enabled: true });

    const newConfig: any = {
      id: key,
      serviceId,
      serviceName: row.layanan,
      samsatId,
      wilayah: row.wilayah,
      biayaJasa: row.biayaJasa || row.biayaJasaLengkap || 0,
      biayaAntarJemput: row.biayaAntarJemput || 50000,
      antarJemputEnabled: row.antarJemputEnabled ?? true,
      jasaLengkap: {
        nominal: row.biayaJasaLengkap || row.biayaJasa || 0,
        enabled: row.jasaLengkapEnabled ?? true,
      },
      jasaNembak: {
        nominal: khususNom,
        enabled: khususEn,
      },
      biayaPengurusanKhusus: {
        nominal: khususNom,
        enabled: khususEn,
      },
      components: this.getDefaultComponentsForService(serviceId),
      swdkllj: opsenObj,
      opsenPkb: opsenObj,
      biayaLainnya: Array.isArray(row.biayaLainnya) ? row.biayaLainnya.map((b: any) => ({ ...b })) : [],
      active: true,
    };

    if (this.isApiMode && pricingRepository.createServicePricing) {
      const serverRes = await pricingRepository.createServicePricing(newConfig);
      if (serverRes?.id) {
        newConfig.id = serverRes.id;
      }
    }

    row.id = newConfig.id;
    row.dbId = newConfig.id;
    this.biayaLayananRows.push(row);
    this.serviceConfigs.set(key, newConfig);
    this.notify();
    return newConfig;
  }

  public async deleteBiayaLayananRow(id: any): Promise<void> {
    const idx = this.biayaLayananRows.findIndex((r) => String(r.id) === String(id) || String(r.dbId) === String(id));
    if (idx === -1) {
      throw new Error(`Baris biaya layanan '${id}' tidak ditemukan.`);
    }

    const targetRow = this.biayaLayananRows[idx];
    const serviceId = resolveServiceId(targetRow.layanan);
    const samsatId = resolveSamsatId(targetRow.wilayah);
    const canonicalKey = targetRow.dbId || `${serviceId}:${samsatId}`;

    if (this.isApiMode && pricingRepository.deleteServicePricing) {
      await pricingRepository.deleteServicePricing(canonicalKey);
    }

    this.biayaLayananRows.splice(idx, 1);
    this.serviceConfigs.delete(canonicalKey);
    this.serviceConfigs.delete(`${serviceId}:${samsatId}`);
    this.notify();
  }

  public async applyConfigToAllSamsats(
    serviceIdOrName: string,
    sourceConfig: {
      biayaJasaLengkap: number;
      biayaJasaR4?: number;
      biayaJasaR2?: number;
      jasaR4Enabled?: boolean;
      jasaR2Enabled?: boolean;
      biayaKhususR4?: number;
      biayaKhususR2?: number;
      khususR4Enabled?: boolean;
      khususR2Enabled?: boolean;
      jasaLengkapEnabled: boolean;
      biayaJasaNembak: number;
      jasaNembakEnabled: boolean;
      biayaAntarJemput: number;
      antarJemputEnabled: boolean;
      antarJemputMode?: "Antar & Jemput" | "Antar Saja" | "Jemput Saja";
      nominalSwdkllj: number;
      swdklljEnabled: boolean;
      biayaLainnya?: Array<{ id: string; label: string; nominal: number; enabled: boolean; includesInTotal?: boolean }>;
      components?: Record<string, boolean>;
    },
    scope: ApplyAllScope = {
      applyBiayaLayanan: true,
      applyBiayaTambahan: true,
      applyKomponenSamsat: true,
      applyBiayaLainnya: false,
    },
    overridePolicy: "PRESERVE_EXISTING_CUSTOM" | "OVERWRITE_ALL" = "PRESERVE_EXISTING_CUSTOM"
  ): Promise<{ updatedCount: number; preservedCount: number; totalCount: number }> {
    const serviceId = resolveServiceId(serviceIdOrName);
    const serviceName = this.biayaLayananRows.find((r) => resolveServiceId(r.layanan) === serviceId)?.layanan || serviceIdOrName;
    const baseline = SERVICE_CANONICAL_BASELINES[serviceId] || { jasa: 250000, kurir: 50000 };

    // Helper for safe non-destructive merge of biayaLainnya
    const safeMergeBiayaLainnya = (targetItems: any[] = [], sourceItems: any[] = []): any[] => {
      const merged = (targetItems || []).map((item) => ({ ...item }));
      (sourceItems || []).forEach((sourceItem) => {
        const existingIdx = merged.findIndex(
          (t) =>
            (t.id && sourceItem.id && t.id === sourceItem.id) ||
            (t.label && sourceItem.label && t.label.trim().toLowerCase() === sourceItem.label.trim().toLowerCase())
        );
        if (existingIdx !== -1) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            label: sourceItem.label || merged[existingIdx].label,
            nominal: sourceItem.nominal !== undefined ? sourceItem.nominal : merged[existingIdx].nominal,
            enabled: sourceItem.enabled !== undefined ? sourceItem.enabled : merged[existingIdx].enabled,
            includesInTotal: sourceItem.includesInTotal !== undefined ? sourceItem.includesInTotal : merged[existingIdx].includesInTotal,
          };
        } else {
          merged.push({
            ...sourceItem,
            id: sourceItem.id || `bl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          });
        }
      });
      return merged;
    };

    const isCustomRow = (row: any): boolean => {
      if (!row) return false;
      const jasa = Number(row.biayaJasaLengkap ?? row.biayaJasa ?? 0);
      const kurir = Number(row.biayaAntarJemput ?? 50000);
      const hasCustomFees =
        Array.isArray(row.biayaLainnya) &&
        row.biayaLainnya.some((b: any) => b.enabled !== false && b.label && b.label.trim() !== "");
      const isKhususActive = row.pengurusanKhususEnabled === true || row.jasaNembakEnabled === true;
      return jasa !== baseline.jasa || kurir !== baseline.kurir || hasCustomFees || isKhususActive;
    };

    let updatedCount = 0;
    let preservedCount = 0;
    let totalCount = 0;

    // Update all matching rows in biayaLayananRows
    this.biayaLayananRows.forEach((row) => {
      if (resolveServiceId(row.layanan) === serviceId) {
        totalCount++;
        const hasCustom = isCustomRow(row);

        if (overridePolicy === "PRESERVE_EXISTING_CUSTOM" && hasCustom) {
          preservedCount++;
          if (scope.applyBiayaLainnya === true && sourceConfig.biayaLainnya) {
            row.biayaLainnya = safeMergeBiayaLainnya(row.biayaLainnya, sourceConfig.biayaLainnya);
          }
          return;
        }

        updatedCount++;

        if (scope.applyBiayaLayanan !== false) {
          row.biayaJasa = sourceConfig.biayaJasaLengkap;
          row.biayaJasaLengkap = sourceConfig.biayaJasaLengkap;
          if (sourceConfig.biayaJasaR4 !== undefined) row.biayaJasaR4 = sourceConfig.biayaJasaR4;
          if (sourceConfig.biayaJasaR2 !== undefined) row.biayaJasaR2 = sourceConfig.biayaJasaR2;
          if (sourceConfig.jasaR4Enabled !== undefined) row.jasaR4Enabled = sourceConfig.jasaR4Enabled;
          if (sourceConfig.jasaR2Enabled !== undefined) row.jasaR2Enabled = sourceConfig.jasaR2Enabled;
          if (sourceConfig.biayaKhususR4 !== undefined) row.biayaKhususR4 = sourceConfig.biayaKhususR4;
          if (sourceConfig.biayaKhususR2 !== undefined) row.biayaKhususR2 = sourceConfig.biayaKhususR2;
          if (sourceConfig.khususR4Enabled !== undefined) row.khususR4Enabled = sourceConfig.khususR4Enabled;
          if (sourceConfig.khususR2Enabled !== undefined) row.khususR2Enabled = sourceConfig.khususR2Enabled;
          row.jasaLengkapEnabled = sourceConfig.jasaLengkapEnabled;
          row.biayaPengurusanKhusus = sourceConfig.biayaJasaNembak;
          row.biayaJasaNembak = sourceConfig.biayaJasaNembak;
          row.pengurusanKhususEnabled = sourceConfig.jasaNembakEnabled;
          row.jasaNembakEnabled = sourceConfig.jasaNembakEnabled;
        }

        if (scope.applyBiayaTambahan !== false) {
          row.biayaAntarJemput = sourceConfig.biayaAntarJemput;
          row.antarJemputEnabled = sourceConfig.antarJemputEnabled;
          if (sourceConfig.antarJemputMode) {
            row.antarJemputMode = sourceConfig.antarJemputMode;
          }
          row.opsenPkb = {
            nominal: sourceConfig.nominalSwdkllj,
            enabled: sourceConfig.swdklljEnabled,
          };
          row.swdkllj = {
            nominal: sourceConfig.nominalSwdkllj,
            enabled: sourceConfig.swdklljEnabled,
          };
        }

        // Only merge Biaya Lainnya if explicitly selected in scope
        if (scope.applyBiayaLainnya === true && sourceConfig.biayaLainnya) {
          row.biayaLainnya = safeMergeBiayaLainnya(row.biayaLainnya, sourceConfig.biayaLainnya);
        }

        // Update serviceConfigs
        const samsatId = resolveSamsatId(row.wilayah);
        const key = `${serviceId}:${samsatId}`;
        const existing = this.serviceConfigs.get(key);
        if (existing) {
          if (scope.applyBiayaLayanan !== false) {
            existing.biayaJasa = sourceConfig.biayaJasaLengkap;
            if (sourceConfig.biayaJasaR4 !== undefined) existing.biayaJasaR4 = sourceConfig.biayaJasaR4;
            if (sourceConfig.biayaJasaR2 !== undefined) existing.biayaJasaR2 = sourceConfig.biayaJasaR2;
            if (sourceConfig.jasaR4Enabled !== undefined) existing.jasaR4Enabled = sourceConfig.jasaR4Enabled;
            if (sourceConfig.jasaR2Enabled !== undefined) existing.jasaR2Enabled = sourceConfig.jasaR2Enabled;
            if (sourceConfig.biayaKhususR4 !== undefined) existing.biayaKhususR4 = sourceConfig.biayaKhususR4;
            if (sourceConfig.biayaKhususR2 !== undefined) existing.biayaKhususR2 = sourceConfig.biayaKhususR2;
            if (sourceConfig.khususR4Enabled !== undefined) existing.khususR4Enabled = sourceConfig.khususR4Enabled;
            if (sourceConfig.khususR2Enabled !== undefined) existing.khususR2Enabled = sourceConfig.khususR2Enabled;
            existing.jasaLengkap = {
              nominal: sourceConfig.biayaJasaLengkap,
              enabled: sourceConfig.jasaLengkapEnabled,
            };
            existing.jasaNembak = {
              nominal: sourceConfig.biayaJasaNembak,
              enabled: sourceConfig.jasaNembakEnabled,
            };
            existing.biayaPengurusanKhusus = {
              nominal: sourceConfig.biayaJasaNembak,
              enabled: sourceConfig.jasaNembakEnabled,
            };
          }

          if (scope.applyBiayaTambahan !== false) {
            existing.biayaAntarJemput = sourceConfig.biayaAntarJemput;
            existing.antarJemputEnabled = sourceConfig.antarJemputEnabled;
            if (sourceConfig.antarJemputMode) {
              existing.antarJemputMode = sourceConfig.antarJemputMode;
            }
            existing.swdkllj = {
              nominal: sourceConfig.nominalSwdkllj,
              enabled: sourceConfig.swdklljEnabled,
            };
            existing.opsenPkb = { ...existing.swdkllj };
          }

          if (scope.applyBiayaLainnya === true && sourceConfig.biayaLainnya) {
            existing.biayaLainnya = safeMergeBiayaLainnya(existing.biayaLainnya, sourceConfig.biayaLainnya);
          }

          if (scope.applyKomponenSamsat !== false && sourceConfig.components) {
            Object.entries(sourceConfig.components).forEach(([pricingItemId, enabled]) => {
              const comp = existing.components.find((c) => c.pricingItemId === pricingItemId);
              if (comp) {
                comp.enabled = enabled;
              } else {
                existing.components.push({ pricingItemId, enabled, required: false });
              }
            });
          }
        }
      }
    });

    // Physical backend persistence via API
    if (this.isApiMode && pricingRepository.batchReplicateServicePricing) {
      try {
        const apiRes = await pricingRepository.batchReplicateServicePricing({
          serviceId,
          serviceName,
          sourceConfig,
          scope,
          overridePolicy,
        });
        if (apiRes) {
          if (typeof apiRes.updatedCount === "number") updatedCount = apiRes.updatedCount;
          if (typeof apiRes.preservedCount === "number") preservedCount = apiRes.preservedCount;
          if (typeof apiRes.totalCount === "number") totalCount = apiRes.totalCount;
        }
      } catch (err) {
        console.error("[pricingStore] batchReplicateServicePricing API error:", err);
      }
    }

    try {
      auditLog.log({
        userId: "usr-admin",
        userName: "Admin Master",
        userRole: "admin",
        action: "UPDATE",
        module: "Master Data",
        details: `Konfigurasi biaya layanan ${serviceName} berhasil diterapkan ke seluruh Samsat (${updatedCount} diperbarui, ${preservedCount} tarif khusus dipertahankan).`,
        metadata: { serviceId, sourceConfig, scope, overridePolicy },
      });
    } catch {
      // safe fallback
    }

    this.notify();
    return { updatedCount, preservedCount, totalCount };
  }

  // ─── Mutasi LD Rows ─────────────────────────────────────────────────────────
  public getMutasiLDRows(): any[] {
    return this.mutasiLDRows.map((r) => ({ ...r }));
  }

  public async updateMutasiLDRow(id: number, updatedRow: any): Promise<void> {
    const idx = this.mutasiLDRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.mutasiLDRows[idx] = { ...updatedRow };
      const samsatId = resolveSamsatId(updatedRow.namaSamsat);
      let priceMap = this.samsatPricing.get(samsatId);
      if (!priceMap) {
        priceMap = new Map();
        this.samsatPricing.set(samsatId, priceMap);
      }
      const tariffs: Array<{ pricingItemId: string; nominal: number }> = [];
      for (const [key, pricingItemId] of Object.entries(MUTASI_LD_ROW_KEY_MAP)) {
        if (updatedRow[key] !== undefined && typeof updatedRow[key] === "number") {
          priceMap.set(pricingItemId, updatedRow[key]);
          tariffs.push({ pricingItemId, nominal: updatedRow[key] });
        }
      }
      if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch && tariffs.length > 0) {
        await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, tariffs);
      }
      this.notify();
    }
  }

  public async addMutasiLDRow(row: any): Promise<void> {
    const newId = Math.max(...this.mutasiLDRows.map((r) => r.id), 0) + 1;
    const newRow = { ...row, id: newId };
    this.mutasiLDRows.push(newRow);
    const samsatId = resolveSamsatId(row.namaSamsat);
    let priceMap = this.samsatPricing.get(samsatId);
    if (!priceMap) {
      priceMap = new Map();
      this.samsatPricing.set(samsatId, priceMap);
    }
    const tariffs: Array<{ pricingItemId: string; nominal: number }> = [];
    for (const [key, pricingItemId] of Object.entries(MUTASI_LD_ROW_KEY_MAP)) {
      if (row[key] !== undefined && typeof row[key] === "number") {
        priceMap.set(pricingItemId, row[key]);
        tariffs.push({ pricingItemId, nominal: row[key] });
      }
    }
    if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch && tariffs.length > 0) {
      await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, tariffs);
    }
    this.notify();
  }

  public async deleteMutasiLDRow(id: number): Promise<void> {
    const idx = this.mutasiLDRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      const row = this.mutasiLDRows[idx];
      const samsatId = resolveSamsatId(row.namaSamsat);
      this.mutasiLDRows.splice(idx, 1);
      if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch) {
        const resetTariffs = Object.values(MUTASI_LD_ROW_KEY_MAP).map((pricingItemId) => ({
          pricingItemId,
          nominal: 0,
        }));
        await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, resetTariffs).catch(() => {});
      }
      this.notify();
    }
  }

  // ─── Balik Nama Rows ────────────────────────────────────────────────────────
  public getBalikNamaRows(): any[] {
    return this.balikNamaRows.map((r) => ({ ...r }));
  }

  public async updateBalikNamaRow(id: number, updatedRow: any): Promise<void> {
    const idx = this.balikNamaRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.balikNamaRows[idx] = { ...updatedRow };
      const samsatId = resolveSamsatId(updatedRow.namaSamsat);
      let priceMap = this.samsatPricing.get(samsatId);
      if (!priceMap) {
        priceMap = new Map();
        this.samsatPricing.set(samsatId, priceMap);
      }
      const tariffs: Array<{ pricingItemId: string; nominal: number }> = [];
      for (const [key, pricingItemId] of Object.entries(BALIK_NAMA_ROW_KEY_MAP)) {
        if (updatedRow[key] !== undefined && typeof updatedRow[key] === "number") {
          priceMap.set(pricingItemId, updatedRow[key]);
          tariffs.push({ pricingItemId, nominal: updatedRow[key] });
        }
      }
      if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch && tariffs.length > 0) {
        await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, tariffs);
      }
      this.notify();
    }
  }

  public async addBalikNamaRow(row: any): Promise<void> {
    const newId = Math.max(...this.balikNamaRows.map((r) => r.id), 0) + 1;
    const newRow = { ...row, id: newId };
    this.balikNamaRows.push(newRow);
    const samsatId = resolveSamsatId(row.namaSamsat);
    let priceMap = this.samsatPricing.get(samsatId);
    if (!priceMap) {
      priceMap = new Map();
      this.samsatPricing.set(samsatId, priceMap);
    }
    const tariffs: Array<{ pricingItemId: string; nominal: number }> = [];
    for (const [key, pricingItemId] of Object.entries(BALIK_NAMA_ROW_KEY_MAP)) {
      if (row[key] !== undefined && typeof row[key] === "number") {
        priceMap.set(pricingItemId, row[key]);
        tariffs.push({ pricingItemId, nominal: row[key] });
      }
    }
    if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch && tariffs.length > 0) {
      await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, tariffs);
    }
    this.notify();
  }

  public async deleteBalikNamaRow(id: number): Promise<void> {
    const idx = this.balikNamaRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      const row = this.balikNamaRows[idx];
      const samsatId = resolveSamsatId(row.namaSamsat);
      this.balikNamaRows.splice(idx, 1);
      if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch) {
        const resetTariffs = Object.values(BALIK_NAMA_ROW_KEY_MAP).map((pricingItemId) => ({
          pricingItemId,
          nominal: 0,
        }));
        await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, resetTariffs).catch(() => {});
      }
      this.notify();
    }
  }

  // ─── Tarik Berkas Rows ──────────────────────────────────────────────────────
  public getTarikBerkasRows(): any[] {
    return this.tarikBerkasRows.map((r) => ({ ...r }));
  }

  public async updateTarikBerkasRow(id: number, updatedRow: any): Promise<void> {
    const idx = this.tarikBerkasRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.tarikBerkasRows[idx] = { ...updatedRow };
      const samsatId = resolveSamsatId(updatedRow.namaSamsat);
      let priceMap = this.samsatPricing.get(samsatId);
      if (!priceMap) {
        priceMap = new Map();
        this.samsatPricing.set(samsatId, priceMap);
      }
      const tariffs: Array<{ pricingItemId: string; nominal: number }> = [];
      for (const [key, pricingItemId] of Object.entries(TARIK_BERKAS_ROW_KEY_MAP)) {
        if (updatedRow[key] !== undefined && typeof updatedRow[key] === "number") {
          priceMap.set(pricingItemId, updatedRow[key]);
          tariffs.push({ pricingItemId, nominal: updatedRow[key] });
        }
      }
      if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch && tariffs.length > 0) {
        await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, tariffs);
      }
      this.notify();
    }
  }

  public async addTarikBerkasRow(row: any): Promise<void> {
    const newId = Math.max(...this.tarikBerkasRows.map((r) => r.id), 0) + 1;
    const newRow = { ...row, id: newId };
    this.tarikBerkasRows.push(newRow);
    const samsatId = resolveSamsatId(row.namaSamsat);
    let priceMap = this.samsatPricing.get(samsatId);
    if (!priceMap) {
      priceMap = new Map();
      this.samsatPricing.set(samsatId, priceMap);
    }
    const tariffs: Array<{ pricingItemId: string; nominal: number }> = [];
    for (const [key, pricingItemId] of Object.entries(TARIK_BERKAS_ROW_KEY_MAP)) {
      if (row[key] !== undefined && typeof row[key] === "number") {
        priceMap.set(pricingItemId, row[key]);
        tariffs.push({ pricingItemId, nominal: row[key] });
      }
    }
    if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch && tariffs.length > 0) {
      await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, tariffs);
    }
    this.notify();
  }

  public async deleteTarikBerkasRow(id: number): Promise<void> {
    const idx = this.tarikBerkasRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      const row = this.tarikBerkasRows[idx];
      const samsatId = resolveSamsatId(row.namaSamsat);
      this.tarikBerkasRows.splice(idx, 1);
      if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch) {
        const resetTariffs = Object.values(TARIK_BERKAS_ROW_KEY_MAP).map((pricingItemId) => ({
          pricingItemId,
          nominal: 0,
        }));
        await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, resetTariffs).catch(() => {});
      }
      this.notify();
    }
  }

  // ─── Duplikat STNK Rows ─────────────────────────────────────────────────────
  public getDuplikatSTNKRows(): any[] {
    return this.duplikatSTNKRows.map((r) => ({ ...r }));
  }

  public async updateDuplikatSTNKRow(id: number, updatedRow: any): Promise<void> {
    const idx = this.duplikatSTNKRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.duplikatSTNKRows[idx] = { ...updatedRow };
      const samsatId = resolveSamsatId(updatedRow.namaSamsat);
      let priceMap = this.samsatPricing.get(samsatId);
      if (!priceMap) {
        priceMap = new Map();
        this.samsatPricing.set(samsatId, priceMap);
      }
      const tariffs: Array<{ pricingItemId: string; nominal: number }> = [];
      for (const [key, pricingItemId] of Object.entries(DUPLIKAT_STNK_ROW_KEY_MAP)) {
        if (updatedRow[key] !== undefined && typeof updatedRow[key] === "number") {
          priceMap.set(pricingItemId, updatedRow[key]);
          tariffs.push({ pricingItemId, nominal: updatedRow[key] });
        }
      }
      if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch && tariffs.length > 0) {
        await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, tariffs);
      }
      this.notify();
    }
  }

  public async addDuplikatSTNKRow(row: any): Promise<void> {
    const newId = Math.max(...this.duplikatSTNKRows.map((r) => r.id), 0) + 1;
    const newRow = { ...row, id: newId };
    this.duplikatSTNKRows.push(newRow);
    const samsatId = resolveSamsatId(row.namaSamsat);
    let priceMap = this.samsatPricing.get(samsatId);
    if (!priceMap) {
      priceMap = new Map();
      this.samsatPricing.set(samsatId, priceMap);
    }
    const tariffs: Array<{ pricingItemId: string; nominal: number }> = [];
    for (const [key, pricingItemId] of Object.entries(DUPLIKAT_STNK_ROW_KEY_MAP)) {
      if (row[key] !== undefined && typeof row[key] === "number") {
        priceMap.set(pricingItemId, row[key]);
        tariffs.push({ pricingItemId, nominal: row[key] });
      }
    }
    if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch && tariffs.length > 0) {
      await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, tariffs);
    }
    this.notify();
  }

  public async deleteDuplikatSTNKRow(id: number): Promise<void> {
    const idx = this.duplikatSTNKRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      const row = this.duplikatSTNKRows[idx];
      const samsatId = resolveSamsatId(row.namaSamsat);
      this.duplikatSTNKRows.splice(idx, 1);
      if (this.isApiMode && pricingRepository.updateSamsatOperationalTariffsBatch) {
        const resetTariffs = Object.values(DUPLIKAT_STNK_ROW_KEY_MAP).map((pricingItemId) => ({
          pricingItemId,
          nominal: 0,
        }));
        await pricingRepository.updateSamsatOperationalTariffsBatch(samsatId, resetTariffs).catch(() => {});
      }
      this.notify();
    }
  }

  // ─── Harga Dasar Rows ───────────────────────────────────────────────────────
  public getHargaDasarRows(): any[] {
    return this.hargaDasarRows.map((r) => ({ ...r }));
  }

  public async updateHargaDasarRow(id: string | number, updatedRow: any): Promise<void> {
    const idx = this.hargaDasarRows.findIndex((r) => String(r.id) === String(id));
    if (idx === -1) {
      throw new Error(`Baris harga dasar '${id}' tidak ditemukan.`);
    }

    const canonicalId = String(id);
    const existingDbItem = this.getPricingItemById(canonicalId);
    if (!existingDbItem && this.isApiMode) {
      throw new Error(`Baris '${updatedRow.namaSamsat || id}' tidak memiliki pasangan record di database.`);
    }

    if (this.isApiMode && updatedRow.hargaDasar !== undefined) {
      await pricingRepository.updateSamsatItem(canonicalId, { basePrice: Number(updatedRow.hargaDasar) });
    }

    this.hargaDasarRows[idx] = { ...updatedRow, id: canonicalId };
    this.notify();
  }

  public addHargaDasarRow(row: any): void {
    const newId = Math.max(...this.hargaDasarRows.map((r) => r.id), 0) + 1;
    this.hargaDasarRows.push({ ...row, id: newId });
    this.notify();
  }

  public deleteHargaDasarRow(id: number): void {
    const idx = this.hargaDasarRows.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.hargaDasarRows.splice(idx, 1);
      this.notify();
    }
  }

  // ─── PURE DETERMINISTIC ORDER COST CALCULATOR ───────────────────────────────
  public calculateOrderCost(params: {
    serviceId?: string;
    serviceName?: string;
    samsatId?: string;
    wilayahSamsat?: string;
    samsatTujuanId?: string;
    wilayahSamsatTujuan?: string;
    metodeLayanan: "Antar Jemput" | "Datang Langsung";
    tipeJasa?: "Lengkap" | "Nembak";
    pkb?: number;
    swdkllj?: number;
    dendaSwdkllj?: number;
    customComponents?: Record<string, boolean>; // pricingItemId -> enabled override
  }): OrderCostSnapshot {
    const serviceId = resolveServiceId(params.serviceId || params.serviceName);
    const samsatId = resolveSamsatId(params.samsatId || params.wilayahSamsat);
    const samsat = this.getSamsatById(samsatId);

    const config = this.getServiceFeeConfig(serviceId, samsatId);
    if (!config) {
      throw new Error(
        `Konfigurasi Biaya Layanan untuk layanan "${params.serviceName || serviceId}" dan Samsat "${samsat.name}" tidak ditemukan.`
      );
    }

    const breakdown: OrderCostBreakdownItem[] = [];

    // 1. Biaya Jasa & Biaya Pengurusan Khusus
    let biayaJasa = 0;
    let biayaPengurusanKhusus = 0;
    if (params.tipeJasa === "Nembak" || (params as any).tipeJasa === "Khusus") {
      const isKhususEnabled = config.biayaPengurusanKhusus ? config.biayaPengurusanKhusus.enabled : (config.jasaNembak ? config.jasaNembak.enabled : false);
      if (isKhususEnabled) {
        biayaPengurusanKhusus = config.biayaPengurusanKhusus?.nominal || config.jasaNembak?.nominal || 0;
        biayaJasa = biayaPengurusanKhusus;
        if (biayaPengurusanKhusus > 0) {
          breakdown.push({
            itemId: "fee-jasa-nembak",
            code: "FEE-PENGURUSAN-KHUSUS",
            name: `Biaya Pengurusan Khusus ${config.serviceName}`,
            amount: biayaPengurusanKhusus,
            category: "Jasa",
            source: "BiayaLayanan",
            isRequired: true,
          });
        }
      }
    } else {
      const isLengkapEnabled = config.jasaLengkap ? config.jasaLengkap.enabled : true;
      if (isLengkapEnabled) {
        biayaJasa = config.jasaLengkap?.nominal ?? config.biayaJasa ?? 0;
        if (biayaJasa > 0) {
          breakdown.push({
            itemId: "fee-jasa",
            code: "FEE-JASA",
            name: `Biaya Jasa ${config.serviceName}`,
            amount: biayaJasa,
            category: "Jasa",
            source: "BiayaLayanan",
            isRequired: true,
          });
        }
      }
    }

    // 2. Active Components (from Harga Dasar Samsat using Canonical 2-Stage Resolver)
    let totalBiayaSamsat = 0;
    let hasUnconfiguredTariff = false;
    const unconfiguredItems: string[] = [];

    const isServiceMutasi = serviceId.includes("mutasi") || (params.serviceName || "").toLowerCase().includes("mutasi");
    const rawTujuan = params.samsatTujuanId || params.wilayahSamsatTujuan;
    const samsatTujuanId = rawTujuan && rawTujuan !== "-" ? resolveSamsatId(rawTujuan) : "";

    config.components.forEach((comp) => {
      const isEnabled =
        params.customComponents && params.customComponents[comp.pricingItemId] !== undefined
          ? params.customComponents[comp.pricingItemId]
          : comp.enabled;

      if (isEnabled) {
        const itemMeta = this.getPricingItemById(comp.pricingItemId);
        const category = itemMeta?.category || "";
        const jurisdiction = getComponentJurisdiction(category, isServiceMutasi);
        const targetOfficeId = jurisdiction === "TUJUAN" ? samsatTujuanId : samsatId;
        const isDestinationPending = jurisdiction === "TUJUAN" && (!samsatTujuanId || samsatTujuanId === "-");

        const resolved = this.resolveEffectiveTariff(targetOfficeId || "-", comp.pricingItemId, jurisdiction);

        if (isDestinationPending || resolved.status === "PENDING_DESTINATION") {
          hasUnconfiguredTariff = true;
          const label = comp.customLabel || itemMeta?.name || comp.pricingItemId;
          unconfiguredItems.push(`${label} (Menunggu Samsat Tujuan)`);

          breakdown.push({
            itemId: comp.pricingItemId,
            code: itemMeta?.code || "SAMSAT-ITEM",
            name: `${label} [Samsat Tujuan]`,
            amount: 0,
            category: "Samsat",
            source: "HargaDasarSamsat",
            isRequired: comp.required,
            status: "UNCONFIGURED",
            isEstimated: true,
          });
        } else if (resolved.effectivePrice === null || resolved.status === "NOT_CONFIGURED" || resolved.status === "CORRUPTED_OVERRIDE" || resolved.status === "DISABLED_ITEM") {
          hasUnconfiguredTariff = true;
          const label = comp.customLabel || itemMeta?.name || comp.pricingItemId;
          unconfiguredItems.push(label);

          breakdown.push({
            itemId: comp.pricingItemId,
            code: itemMeta?.code || "SAMSAT-ITEM",
            name: label,
            amount: 0,
            category: "Samsat",
            source: "HargaDasarSamsat",
            isRequired: comp.required,
            status: "UNCONFIGURED",
            isEstimated: true,
          });
        } else {
          totalBiayaSamsat += resolved.effectivePrice;

          breakdown.push({
            itemId: comp.pricingItemId,
            code: itemMeta?.code || "SAMSAT-ITEM",
            name: comp.customLabel || itemMeta?.name || comp.pricingItemId,
            amount: resolved.effectivePrice,
            category: "Samsat",
            source: "HargaDasarSamsat",
            isRequired: comp.required,
            status: resolved.isExplicitZero ? "ZERO_EXPLICIT" : "CONFIGURED",
            isEstimated: false,
          });
        }
      }
    });

    // 3. Operational Courier: Antar Jemput Dokumen
    const isAntarJemput = params.metodeLayanan === "Antar Jemput";
    const isCourierEnabled = config.antarJemputEnabled !== false;
    const biayaAntarJemput = isAntarJemput && isCourierEnabled ? (config.biayaAntarJemput || 0) : 0;

    if (isAntarJemput && biayaAntarJemput > 0) {
      breakdown.push({
        itemId: "fee-antar-jemput",
        code: "OPS-ANTARJEMPUT",
        name: "Layanan Antar Jemput Dokumen",
        amount: biayaAntarJemput,
        category: "Operasional",
        source: "Operasional",
        isRequired: false,
      });
    }

    // 4. Pajak Kendaraan Bermotor (PKB)
    const pkb = Math.max(0, Number(params.pkb) || 0);
    if (pkb > 0) {
      breakdown.push({
        itemId: "pajak-pkb",
        code: "PAJAK-PKB",
        name: "Pajak Kendaraan Bermotor (PKB)",
        amount: pkb,
        category: "Pajak",
        source: "Kendaraan",
        isRequired: true,
      });
    }

    // 5. OPSEN PKB
    const isOpsenEnabled = config.opsenPkb ? config.opsenPkb.enabled : (config.swdkllj ? config.swdkllj.enabled : true);
    let swdkllj = 0;
    if (isOpsenEnabled) {
      swdkllj = Math.max(0, Number(params.swdkllj) || 0);
      if (swdkllj > 0) {
        breakdown.push({
          itemId: "pajak-opsen-pkb",
          code: "PAJAK-OPSEN-PKB",
          name: "OPSEN PKB",
          amount: swdkllj,
          category: "Pajak",
          source: "Kendaraan",
          isRequired: true,
        });
      }
    }

    // 6. Denda Pajak/OPSEN PKB (if any)
    const dendaSwdkllj = Math.max(0, Number(params.dendaSwdkllj) || 0);
    if (dendaSwdkllj > 0) {
      breakdown.push({
        itemId: "pajak-denda-swdkllj",
        code: "PAJAK-DENDA",
        name: "Denda Pajak/OPSEN PKB",
        amount: dendaSwdkllj,
        category: "Pajak",
        source: "Kendaraan",
        isRequired: false,
      });
    }

    // 7. Biaya Lainnya (dynamic list, only if enabled)
    if (config.biayaLainnya && Array.isArray(config.biayaLainnya)) {
      config.biayaLainnya.forEach((bl) => {
        const nominal = bl.nominal || 0;
        if (bl.enabled && nominal > 0) {
          breakdown.push({
            itemId: bl.id,
            code: "BIAYA-LAIN",
            name: bl.label || "Biaya Tambahan",
            amount: nominal,
            category: "Operasional",
            source: "BiayaLayanan",
            isRequired: false,
          });
        }
      });
    }

    const calculatedTotal = breakdown.reduce((sum, item) => sum + item.amount, 0);

    return {
      serviceId,
      serviceName: config.serviceName,
      samsatId,
      samsatName: samsat.name,
      metodeLayanan: params.metodeLayanan,
      wilayahSamsat: samsat.wilayah,
      biayaJasa,
      biayaPengurusanKhusus,
      biayaSamsat: totalBiayaSamsat,
      biayaAntarJemput,
      pkb,
      swdkllj,
      opsenPkb: swdkllj,
      dendaSwdkllj,
      totalEstimasi: calculatedTotal,
      breakdown,
      completenessStatus: hasUnconfiguredTariff ? "PARTIAL_ESTIMATE" : "COMPLETE",
      hasUnconfiguredTariff,
      unconfiguredItems,
      isCostVerified: !hasUnconfiguredTariff,
      createdAt: new Date().toISOString(),
    };
  }

  // ─── Backward Compatibility Helpers ─────────────────────────────────────────
  public getSamsatItems(): SamsatCostItem[] {
    const defaultSamsat = "samsat-jakarta-timur";
    return MASTER_PRICING_ITEMS.map((item) => ({
      ...item,
      basePrice: this.getSamsatPrice(defaultSamsat, item.id) ?? 0,
    }));
  }

  public getSamsatItemById(id: string): SamsatCostItem | undefined {
    const item = this.getPricingItemById(id);
    if (!item) return undefined;
    return {
      ...item,
      basePrice: this.getSamsatPrice("samsat-jakarta-timur", item.id) ?? 0,
    };
  }

  public updateSamsatItem(id: string, updates: Partial<SamsatCostItem>): boolean {
    if (this.isApiMode) {
      pricingRepository.updateSamsatItem(id, updates);
    }
    if (updates.basePrice !== undefined) {
      return this.updateSamsatPrice("samsat-jakarta-timur", id, updates.basePrice);
    }
    return true;
  }

  public addSamsatItem(data: Omit<SamsatCostItem, "id">): SamsatCostItem {
    const id = `samsat-custom-${Date.now()}`;
    const newItem: SamsatCostItem = { ...data, id };
    MASTER_PRICING_ITEMS.push(newItem);
    this.updateSamsatPrice("samsat-jakarta-timur", id, data.basePrice);
    return newItem;
  }

  public getServicePackages(): Record<string, ServicePackageConfig> {
    const result: Record<string, ServicePackageConfig> = {};
    const services = [
      { id: "mutasi-antar-samsat", name: "Mutasi Antar Samsat" },
      { id: "mutasi-luar-daerah", name: "Mutasi Luar Daerah" },
      { id: "perpanjangan-1-tahun", name: "Perpanjangan 1 Tahun" },
      { id: "perpanjangan-5-tahun", name: "Perpanjangan 5 Tahun" },
      { id: "balik-nama", name: "Balik Nama" },
    ];
    services.forEach((s) => {
      const config = this.getServiceFeeConfig(s.id, "samsat-jakarta-timur");
      result[s.name] = {
        serviceId: s.id,
        serviceName: s.name,
        baseJasaPengurusan: config?.biayaJasa || 0,
        biayaAntarJemput: config?.biayaAntarJemput || 50000,
        active: true,
        items: (config?.components || []).map((c, idx) => ({
          id: `sci-${s.id}-${idx}`,
          serviceId: s.id,
          itemId: c.pricingItemId,
          enabled: c.enabled,
          required: c.required,
          sellingPrice: this.getSamsatPrice("samsat-jakarta-timur", c.pricingItemId) ?? undefined,
        })),
      };
    });
    return result;
  }

  public getServicePackage(serviceNameOrId: string): ServicePackageConfig | undefined {
    const pkgs = this.getServicePackages();
    const serviceId = resolveServiceId(serviceNameOrId);
    for (const pkg of Object.values(pkgs)) {
      if (pkg.serviceId === serviceId || pkg.serviceName.toLowerCase() === serviceNameOrId.toLowerCase()) {
        return pkg;
      }
    }
    return undefined;
  }

  public updateServicePackage(serviceNameOrId: string, updates: Partial<ServicePackageConfig>): boolean {
    const serviceId = resolveServiceId(serviceNameOrId);
    return this.updateServiceFeeConfig(serviceId, "samsat-jakarta-timur", {
      biayaJasa: updates.baseJasaPengurusan,
      biayaAntarJemput: updates.biayaAntarJemput,
    });
  }
}

// Global Authoritative Singleton Instance
export const pricingStore = new PricingStore();

// React Hook for Reactive Store Subscription
export function usePricingStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return pricingStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return pricingStore;
}
