/**
 * Authoritative Pricing Reference connected to Master Pricing Store (SSoT)
 * Admin SUN89 — Biro Jasa Management System
 */

import { pricingStore, resolveSamsatId } from "./pricingStore";

export interface MutasiTariffItem {
  key: string;
  name: string;
  category: "Mutasi Keluar" | "Mutasi Masuk";
  basePrice: number;
  description?: string;
}

// Authoritative Baseline Prices for Mutasi Keluar (Antar Samsat / Luar Daerah)
const STATIC_HARGA_DASAR_MUTASI_KELUAR: Record<string, number> = {
  mutasiKeluarLegalisir: 50000,
  mutasiKeluarHadir: 75000,
  mutasiKeluarLegalisirCf: 60000,
  mutasiKeluarCf: 40000,
  mutasiKeluarBantuanHadir: 80000,
  mutasiKeluarCekBlokir: 30000,
  mutasiKeluarLokPembukuan: 45000,
  mutasiKeluarLokTu: 45000,
  mutasiKeluarLokTuNopil: 50000,
  mutasiKeluarLoksus: 100000,
  mutasiKeluarCetakSkp: 35000,
  mutasiKeluarCetakFiskal: 35000,
  mutasiKeluarLokArsip: 40000,
  mutasiKeluarCekProgresif: 30000,
  mutasiKeluarMatiinNopil: 45000,
  mutasiKeluarDaftarMutmasNormal: 70000,
  mutasiKeluarDaftarMutmasKilat: 120000,
};

// Authoritative Baseline Prices for Mutasi Masuk (Penerimaan / Berkas Masuk)
const STATIC_HARGA_DASAR_MUTASI_MASUK: Record<string, number> = {
  mutasiMasukLegalisir: 50000,
  mutasiMasukMutmas: 65000,
  mutasiMasukBy: 55000,
  mutasiMasukPendaftaran: 80000,
  mutasiMasukReqGanjilGenap: 40000,
  mutasiMasukAcak: 35000,
  mutasiMasukLokTu: 45000,
  mutasiMasukLokPembukuan: 45000,
  mutasiMasukDaftarBpkb: 90000,
  mutasiMasukPenulisanBpkb: 75000,
  mutasiMasukCetakNotice: 35000,
  mutasiMasukCetakStnk: 40000,
  mutasiMasukCetakPlat: 50000,
};

// Canonical mapping between camelCase keys and pricingStore item IDs
export const MUTASI_KEY_TO_PRICING_ITEM_ID: Record<string, string> = {
  mutasiKeluarLegalisir: "mutasi-legalisir",
  mutasiKeluarHadir: "mutasi-hadir",
  mutasiKeluarLegalisirCf: "mutasi-legalisir-cf",
  mutasiKeluarCf: "mutasi-cf",
  mutasiKeluarBantuanHadir: "mutasi-bantuan",
  mutasiKeluarCekBlokir: "mutasi-cek-blokir",
  mutasiKeluarLokPembukuan: "mutasi-lok-pembukuan",
  mutasiKeluarLokTu: "mutasi-lok-tu",
  mutasiKeluarLokTuNopil: "mutasi-lok-tu-nopil",
  mutasiKeluarLoksus: "mutasi-loksus",
  mutasiKeluarCetakSkp: "mutasi-cetak-skp",
  mutasiKeluarCetakFiskal: "mutasi-cetak-fiskal",
  mutasiKeluarLokArsip: "mutasi-lok-arsip",
  mutasiKeluarCekProgresif: "mutasi-cek-progresif",
  mutasiKeluarMatiinNopil: "mutasi-matiin-nopil",
  mutasiKeluarDaftarMutmasNormal: "mutasi-daftar-mutmas-normal",
  mutasiKeluarDaftarMutmasKilat: "mutasi-daftar-mutmas-kilat",

  mutasiMasukLegalisir: "mutasi-legalisir-mutmas",
  mutasiMasukMutmas: "mutasi-mutmas-pendaftaran",
  mutasiMasukBy: "mutasi-mutmas-pendaftaran",
  mutasiMasukPendaftaran: "mutasi-mutmas-pendaftaran",
  mutasiMasukReqGanjilGenap: "mutasi-req-ganjil-genap",
  mutasiMasukAcak: "mutasi-acak",
  mutasiMasukLokTu: "mutasi-lok-tu-masuk",
  mutasiMasukLokPembukuan: "mutasi-lok-pembukuan-masuk",
  mutasiMasukDaftarBpkb: "mutasi-daftar-bpkb",
  mutasiMasukPenulisanBpkb: "mutasi-penulisan-bpkb",
  mutasiMasukCetakNotice: "mutasi-cetak-notice",
  mutasiMasukCetakStnk: "mutasi-cetak-stnk",
  mutasiMasukCetakPlat: "mutasi-cetak-plat",
};

/**
 * Get the base price for a mutasi item key, querying pricingStore as SSoT
 */
export function getHargaDasarItem(key: string, samsatWilayah?: string): number {
  const pricingItemId = MUTASI_KEY_TO_PRICING_ITEM_ID[key];
  if (pricingItemId) {
    const samsatId = samsatWilayah ? resolveSamsatId(samsatWilayah) : "samsat-jakarta-timur";
    const storePrice = pricingStore.getSamsatPrice(samsatId, pricingItemId);
    if (storePrice !== null && storePrice !== undefined && typeof storePrice === "number" && !isNaN(storePrice) && storePrice >= 0) {
      return storePrice;
    }
  }
  if (key in STATIC_HARGA_DASAR_MUTASI_KELUAR) {
    return STATIC_HARGA_DASAR_MUTASI_KELUAR[key];
  }
  if (key in STATIC_HARGA_DASAR_MUTASI_MASUK) {
    return STATIC_HARGA_DASAR_MUTASI_MASUK[key];
  }
  return 0;
}

// Proxied dictionaries that dynamically resolve from pricingStore (SSoT)
export const HARGA_DASAR_MUTASI_KELUAR: Record<string, number> = new Proxy(
  STATIC_HARGA_DASAR_MUTASI_KELUAR,
  {
    get(target, prop: string) {
      if (typeof prop === "string" && prop in target) {
        return getHargaDasarItem(prop);
      }
      return (target as any)[prop];
    },
  }
);

export const HARGA_DASAR_MUTASI_MASUK: Record<string, number> = new Proxy(
  STATIC_HARGA_DASAR_MUTASI_MASUK,
  {
    get(target, prop: string) {
      if (typeof prop === "string" && prop in target) {
        return getHargaDasarItem(prop);
      }
      return (target as any)[prop];
    },
  }
);

// Aliases for drop-in backward compatibility
export const hargaDasarMutasiKeluar = HARGA_DASAR_MUTASI_KELUAR;
export const hargaDasarMutasiMasuk = HARGA_DASAR_MUTASI_MASUK;

export type MutasiKeluarKey = keyof typeof STATIC_HARGA_DASAR_MUTASI_KELUAR;
export type MutasiMasukKey = keyof typeof STATIC_HARGA_DASAR_MUTASI_MASUK;

/**
 * Format a mutasi key into a human-readable title
 * e.g. "mutasiKeluarCekBlokir" -> "Cek Blokir"
 */
export function formatMutasiLabel(key: string): string {
  return key
    .replace(/^mutasi(Keluar|Masuk)/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}
