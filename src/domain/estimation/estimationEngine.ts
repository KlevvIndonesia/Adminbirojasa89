/**
 * Pure Calculation Engine for Estimation Templates
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Replicates authoritative Excel logic from sheet 'PAJAK TAHUNAN  R4'
 * Pure deterministic functions with 0 React/DOM dependencies.
 */

import {
  EstimationInput,
  EstimationTemplateConfig,
  EstimationResult,
  EstimationResultItem,
  ProgramSamsat,
  KondisiBerkas,
  WilayahAccId,
} from "./types";
import { calculateOverdueDuration } from "./excelDateUtils";
import { DEFAULT_R4_ANNUAL_TEMPLATE } from "./defaultTemplates";

export interface RuleCalculationContext {
  pkbDasar: number;
  tahunTunggakan: number;
  bulanTunggakan: number;
  bulanKalender?: number;
  programSamsat: ProgramSamsat;
  template: EstimationTemplateConfig;
  manualValues: Record<string, number>;
  kondisiBerkas?: KondisiBerkas;
  wilayahAccId?: WilayahAccId;
  njkb?: number;
  freeBbn?: boolean;
  wilayahAsal?: string;
  wilayahTujuan?: string;
}

export type RuleHandler = (ctx: RuleCalculationContext) => number;

/**
 * Checks whether a given wilayah belongs to Polda Jabar / Jawa Barat region
 * (Bogor, Bekasi, Depok, Jawa Barat, etc.) and is not DKI Jakarta.
 */
export function isJawaBaratRegion(wilayah?: string): boolean {
  if (!wilayah) return false;
  const w = wilayah.toLowerCase();
  if (w.includes("dki") || w.includes("jakarta")) return false;
  return (
    w.includes("jabar") ||
    w.includes("jawa barat") ||
    w.includes("bogor") ||
    w.includes("bekasi") ||
    w.includes("depok")
  );
}

/**
 * Resolves destination region preference for BBN / Mutasi
 */
export function checkIsJabar(ctx: { wilayahTujuan?: string; wilayahAsal?: string }): boolean {
  if (ctx.wilayahTujuan) return isJawaBaratRegion(ctx.wilayahTujuan);
  return isJawaBaratRegion(ctx.wilayahAsal);
}

/**
 * Built-in validated rule handlers mapping to estimation formulas
 */
export const BUILTIN_RULE_HANDLERS: Record<string, RuleHandler> = {
  // PKB Tertunggak: PKB Dasar × Tahun Tunggakan
  PKB_TERTUNGGAK: (ctx) => {
    return ctx.pkbDasar * ctx.tahunTunggakan;
  },

  // Pajak Baru: PKB Dasar (1 Tahun Berjalan)
  PAJAK_BARU: (ctx) => {
    return ctx.pkbDasar;
  },

  // Denda PKB Tertunggak: PKB Tertunggak × Koefisien Denda (dibulatkan ke kelipatan Rp 1.000)
  DENDA_PKB_TERTUNGGAK: (ctx) => {
    const program = (ctx.programSamsat || "").trim().toLowerCase();
    if (program === "free biaya denda") return 0;
    const pkbTertunggak = ctx.pkbDasar * ctx.tahunTunggakan;
    const raw = pkbTertunggak * ctx.template.koefisienDenda;
    const pembulatan = ctx.template.kelipatanPembulatan || 1000;
    return Math.ceil(raw / pembulatan) * pembulatan;
  },

  // Denda PKB Pajak Baru: PKB Dasar × Koefisien Denda ÷ 12 × Bulan Tunggakan (dibulatkan ke kelipatan Rp 1.000)
  DENDA_PKB_PAJAK_BARU: (ctx) => {
    const program = (ctx.programSamsat || "").trim().toLowerCase();
    if (program === "free biaya denda") return 0;
    const pembagi = ctx.template.pembagiBulan || 12;
    const pembulatan = ctx.template.kelipatanPembulatan || 1000;
    const raw = (ctx.pkbDasar * ctx.template.koefisienDenda / pembagi) * ctx.bulanTunggakan;
    return Math.ceil(raw / pembulatan) * pembulatan;
  },

  // SWDKLLJ Tertunggak: SWDKLLJ Pokok × Tahun Tunggakan
  SWDKLLJ_TERTUNGGAK: (ctx) => {
    return ctx.template.swdklljPokok * ctx.tahunTunggakan;
  },

  // SWDKLLJ Pajak Baru: SWDKLLJ Pokok Tahunan
  SWDKLLJ_PAJAK_BARU: (ctx) => {
    return ctx.template.swdklljPokok;
  },

  // Denda SWDKLLJ Tertunggak: Denda SWDKLLJ Pokok × Tahun Tunggakan jika Tahun > 0
  DENDA_SWDKLLJ_TERTUNGGAK: (ctx) => {
    return ctx.tahunTunggakan > 0 ? ctx.template.dendaSwdklljPokok * ctx.tahunTunggakan : 0;
  },

  // Denda SWDKLLJ Pajak Baru: Denda SWDKLLJ Pokok jika Bulan Tunggakan > 0
  DENDA_SWDKLLJ_PAJAK_BARU: (ctx) => {
    return ctx.bulanTunggakan > 0 ? ctx.template.dendaSwdklljPokok : 0;
  },

  // Administrasi STNK: Tarif resmi PNBP untuk proses 5 Tahunan
  ADMIN_STNK: (ctx) => {
    if (ctx.template.serviceType === "Tahunan") return 0;
    if (ctx.template.adminStnk !== undefined) return ctx.template.adminStnk;
    const comp = ctx.template.components.find((c) => c.id === "admin-stnk");
    if (comp && comp.defaultValue > 0) return comp.defaultValue;
    return ctx.template.vehicleType === "Mobil" ? 200000 : 100000;
  },

  // Administrasi TNKB: Tarif resmi PNBP untuk proses 5 Tahunan
  ADMIN_TNKB: (ctx) => {
    if (ctx.template.serviceType === "Tahunan") return 0;
    if (ctx.template.adminTnkb !== undefined) return ctx.template.adminTnkb;
    const comp = ctx.template.components.find((c) => c.id === "admin-tnkb");
    if (comp && comp.defaultValue > 0) return comp.defaultValue;
    return ctx.template.vehicleType === "Mobil" ? 100000 : 60000;
  },

  // Proses dan ACC ID: Default Rp 350.000 untuk Motor, atau sesuai tarif wilayah ACC ID
  PROSES_DAN_ACC_ID: (ctx) => {
    const manualVal = ctx.manualValues ? ctx.manualValues["proses-dan-acc-id"] : undefined;
    if (typeof manualVal === "number" && !isNaN(manualVal) && isFinite(manualVal)) {
      return Math.max(0, manualVal);
    }
    if (ctx.kondisiBerkas === "LENGKAP") {
      return 0;
    }
    if (ctx.wilayahAccId && ctx.template.accIdRates[ctx.wilayahAccId] !== undefined && ctx.wilayahAccId !== "NON ACC ID") {
      return ctx.template.accIdRates[ctx.wilayahAccId];
    }
    if (!ctx.kondisiBerkas) {
      return 0;
    }
    return ctx.template.components.find((c) => c.id === "proses-dan-acc-id")?.defaultValue ?? 350000;
  },

  // Biaya Cetak SKP: Dikenakan jika terdapat durasi keterlambatan (Tahun + Bulan > 0)
  CETAK_SKP: (ctx) => {
    return ctx.tahunTunggakan + ctx.bulanTunggakan > 0 ? ctx.template.biayaCetakSkp : 0;
  },

  // Biaya Jasa Standar Pengurusan
  JASA: (ctx) => {
    return ctx.template.biayaJasa;
  },

  // Biaya Proses 5 Tahunan (Mobil)
  BY_PROSES_5_TAHUNAN: () => 0,

  // --- Extended Formulas for BBN & Mutasi ---

  // PKB Tertunggak for BBN & Mutasi: includes year overdue + month overdue rounded up
  PKB_TERTUNGGAK_BBN_MUTASI: (ctx) => {
    if (ctx.pkbDasar === 0) return 0;
    const months = ctx.bulanTunggakan;
    if (ctx.tahunTunggakan === 0 && months === 0) return 0;

    // Mutasi Motor: Menggabungkan perhitungan PKB Pokok + Denda PKB
    if (ctx.template.serviceType.includes("Mutasi") && ctx.template.vehicleType === "Motor") {
      const pkbYear = ctx.pkbDasar * ctx.tahunTunggakan;
      const dendaYear = (ctx.pkbDasar * ctx.template.koefisienDenda) * ctx.tahunTunggakan;
      const pkbMonth = (ctx.pkbDasar / 12) * months;
      const dendaMonth = (ctx.pkbDasar * ctx.template.koefisienDenda / 12) * months;
      return Math.ceil((pkbYear + dendaYear + pkbMonth + dendaMonth) / 1000) * 1000;
    }

    const raw = ctx.pkbDasar * ctx.tahunTunggakan + (ctx.pkbDasar / 12) * months;
    return Math.ceil(raw / 1000) * 1000;
  },

  // Denda PKB for BBN & Mutasi: year overdue penalty + month overdue penalty rounded up
  DENDA_PKB_BBN_MUTASI: (ctx) => {
    const program = (ctx.programSamsat || "").trim().toLowerCase();
    if (program === "free biaya denda") return 0;
    if (ctx.pkbDasar === 0) return 0;
    if (ctx.template.serviceType.includes("Mutasi") && ctx.template.vehicleType === "Motor") {
      return 0; // Already included in combined PKB dan Denda Tertunggak line
    }

    const months = ctx.bulanTunggakan;
    if (ctx.tahunTunggakan === 0 && months === 0) return 0;

    const isJabar = checkIsJabar(ctx);

    // Di Jawa Barat, denda bulanan dihitung berdasarkan PKB Baru (60% × 1.2)
    const pembagi = ctx.template.pembagiBulan || 12;
    const pembulatan = ctx.template.kelipatanPembulatan || 1000;
    const monthBase = isJabar
      ? Math.ceil((Math.ceil((ctx.pkbDasar * 0.6) / pembulatan) * pembulatan * 1.2) / pembulatan) * pembulatan
      : ctx.pkbDasar;
    const yearPenalty = (ctx.pkbDasar * ctx.template.koefisienDenda) * ctx.tahunTunggakan;
    const monthPenalty = (monthBase * ctx.template.koefisienDenda / pembagi) * months;

    return Math.ceil((yearPenalty + monthPenalty) / pembulatan) * pembulatan;
  },

  // SWDKLLJ Tertunggak untuk BBN & Mutasi
  SWDKLLJ_TERTUNGGAK_BBN_MUTASI: (ctx) => {
    const isMobil = ctx.template.vehicleType === "Mobil";
    const rate = isMobil ? 143000 : 35000;
    const months = ctx.bulanKalender ?? ctx.bulanTunggakan;
    if (ctx.tahunTunggakan === 0 && months === 0) return 0;

    let telatSwd = 0;
    if (ctx.template.serviceType.includes("Mutasi")) {
      // Pada Mutasi Mobil, Telat SWDKLLJ Keluar dikalikan 0
      if (isMobil) return 0;
      telatSwd = ctx.tahunTunggakan === 0 ? 1 : ctx.tahunTunggakan + (months > 0 ? 1 : 0);
    } else {
      // Balik Nama: Mobil Jabar menggunakan rawSwd, Motor / DKI dikurangi 1
      const isJabar = checkIsJabar(ctx);
      const rawSwd = ctx.tahunTunggakan + (months > 0 ? 1 : 0);
      telatSwd = isMobil && isJabar ? rawSwd : Math.max(0, rawSwd - 1);
    }
    return rate * telatSwd;
  },

  // Denda SWDKLLJ untuk BBN & Mutasi
  DENDA_SWDKLLJ_BBN_MUTASI: (ctx) => {
    const isMobil = ctx.template.vehicleType === "Mobil";
    const rate = isMobil ? 100000 : 32000;
    const months = ctx.bulanKalender ?? ctx.bulanTunggakan;
    if (ctx.tahunTunggakan === 0 && months === 0) return 0;

    let telatSwd = 0;
    if (ctx.template.serviceType.includes("Mutasi")) {
      // In workbook sheets 7, 8, 15, 16, 17 (Mobil Mutasi), Telat SWDKLLJ Keluar is explicitly multiplied by 0 (* 0)
      if (isMobil) return 0;
      telatSwd = ctx.tahunTunggakan === 0 ? 1 : ctx.tahunTunggakan + (months > 0 ? 1 : 0);
    } else {
      const isJabar = checkIsJabar(ctx);
      const rawSwd = ctx.tahunTunggakan + (months > 0 ? 1 : 0);
      telatSwd = isMobil && isJabar ? rawSwd : Math.max(0, rawSwd - 1);
    }
    return rate * telatSwd;
  },

  // BBN Pokok: Default Rp 0 if FREE, or percentage/fraction if active
  BBN_POKOK: (ctx) => {
    if (ctx.freeBbn !== false) return 0; // Default Free
    const njkb = ctx.njkb || 0;
    if (njkb > 0) return Math.ceil(njkb * 0.01);
    return Math.ceil((ctx.pkbDasar * 2 / 3) / 1000) * 1000;
  },

  // PKB Baru for BBN & Mutasi: splits 60% * 1.2 if Jabar, or full PKB for DKI
  PKB_BARU_BBN_MUTASI: (ctx) => {
    const isJabar = checkIsJabar(ctx);
    if (isJabar) {
      const pkb60 = Math.ceil((ctx.pkbDasar * 0.6) / 1000) * 1000;
      return Math.ceil((pkb60 * 1.2) / 1000) * 1000;
    }
    return ctx.pkbDasar;
  },

  // Opsen PKB for BBN & Mutasi: 40% * 1.2 if Jabar, 0 for DKI
  OPSEN_PKB: (ctx) => {
    const isJabar = checkIsJabar(ctx);
    if (isJabar) {
      const pkb40 = Math.ceil((ctx.pkbDasar * 0.4) / 1000) * 1000;
      return Math.ceil((pkb40 * 1.2) / 1000) * 1000;
    }
    return 0;
  },

  // Mutasi Tarik Berkas: Rp 1.000.000 (Antar Samsat)
  TARIK_BERKAS_MUTASI_AS: () => 1000000,

  // Mutasi Tarik Berkas LD: Rp 1.500.000 (Luar Daerah)
  TARIK_BERKAS_MUTASI_LD: () => 1500000,

  // Mutasi Masuk BPKB: Rp 1.000.000 (Antar Samsat)
  MUTASI_MASUK_BPKB_AS: () => 1000000,

  // Mutasi Masuk BPKB LD: Rp 1.500.000 (Luar Daerah)
  MUTASI_MASUK_BPKB_LD: () => 1500000,

  // Biaya Proses BBN (Cek Fisik, Daftar, BPKB): Rp 1.000.000
  BIAYA_PROSES_BBN: () => 1000000,

  // Proses dan Jasa Mutasi: Rp 1.500.000 (Mutasi LD Mobil), Rp 750.000 (Mutasi AS Mobil), Rp 500.000 (Motor)
  PROSES_DAN_JASA_MUTASI: (ctx) => {
    if (typeof ctx.template.biayaJasa === "number" && Number.isFinite(ctx.template.biayaJasa) && ctx.template.biayaJasa >= 0) {
      return ctx.template.biayaJasa;
    }
    if (ctx.template.serviceType === "Mutasi Luar Daerah") {
      return ctx.template.vehicleType === "Mobil" ? 1500000 : 500000;
    }
    return ctx.template.vehicleType === "Mobil" ? 750000 : 500000;
  },
};

/**
 * Extensible rule registry allowing registration of new custom formulas
 */
export class EstimationRuleRegistry {
  private handlers = new Map<string, RuleHandler>();

  constructor() {
    for (const [key, handler] of Object.entries(BUILTIN_RULE_HANDLERS)) {
      this.handlers.set(key, handler);
    }
  }

  public register(ruleId: string, handler: RuleHandler): void {
    this.handlers.set(ruleId, handler);
  }

  public get(ruleId: string): RuleHandler | undefined {
    return this.handlers.get(ruleId);
  }
}

export const defaultRuleRegistry = new EstimationRuleRegistry();

/**
 * Normalizes string matching for ACC ID rates lookup
 */
function resolveAccIdRate(rates: Record<string, number>, wilayah?: string): number {
  if (!wilayah) return 0;
  const target = wilayah.trim().toLowerCase();
  for (const [key, val] of Object.entries(rates)) {
    if (key.trim().toLowerCase() === target) {
      return val;
    }
  }
  return 0;
}

/**
 * Pure calculation engine for estimation templates
 */
export function calculateEstimation(
  input: EstimationInput,
  template: EstimationTemplateConfig = DEFAULT_R4_ANNUAL_TEMPLATE,
  registry: EstimationRuleRegistry = defaultRuleRegistry
): EstimationResult {
  const pkbDasar = Math.max(0, Number(input.pkbDasar) || 0);
  const manualValues = input.manualValues || {};

  // 1. Calculate calendar overdue duration
  const overdue = calculateOverdueDuration(input.tanggalJatuhTempo, input.tanggalEstimasi);
  const tahunTunggakan = overdue.years;
  const isDelay = overdue.years > 0 || overdue.months > 0;

  // Penyesuaian offset bulan keterlambatan sesuai aturan jenis layanan dan kendaraan:
  // - Motor Pajak Tahunan & 5 Tahunan: +5 bulan
  // - Mutasi AS Motor: +1 bulan
  // - Mutasi LD Motor: +2 bulan
  // - BBN Mobil Jabar: +1 bulan
  // - Lainnya: +0 bulan
  let monthOffset = 0;
  if (template.serviceType === "Tahunan" || template.serviceType === "5 Tahunan") {
    if (template.vehicleType === "Motor") monthOffset = 5;
  } else if (template.serviceType === "Mutasi Antar Samsat") {
    if (template.vehicleType === "Motor") monthOffset = 1;
  } else if (template.serviceType === "Mutasi Luar Daerah") {
    if (template.vehicleType === "Motor") monthOffset = 2;
  } else if (template.serviceType === "Balik Nama") {
    const isJabar = checkIsJabar(input);
    if (isJabar && template.vehicleType === "Mobil") monthOffset = 1;
  }

  const bulanTunggakan = isDelay ? overdue.months + monthOffset : 0;
  const bulanKalender = overdue.months;

  const ctx: RuleCalculationContext = {
    pkbDasar,
    tahunTunggakan,
    bulanTunggakan,
    bulanKalender,
    programSamsat: input.programSamsat,
    template,
    manualValues,
    kondisiBerkas: input.kondisiBerkas,
    wilayahAccId: input.wilayahAccId,
    njkb: input.njkb,
    freeBbn: input.freeBbn,
    wilayahAsal: input.wilayahAsal,
    wilayahTujuan: input.wilayahTujuan,
  };

  // 2. Evaluate all active template components in display order
  const sortedComponents = [...template.components]
    .filter((c) => c.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const items: EstimationResultItem[] = [];

  for (const comp of sortedComponents) {
    let amount = 0;
    const isManual = comp.valueType === "manual" || comp.isEditable === true;
    const hasManualOverride =
      manualValues[comp.id] !== undefined &&
      typeof manualValues[comp.id] === "number" &&
      !isNaN(manualValues[comp.id]) &&
      isFinite(manualValues[comp.id]);

    if (hasManualOverride) {
      amount = Math.max(0, manualValues[comp.id]);
    } else if (comp.ruleId) {
      const handler = registry.get(comp.ruleId);
      if (handler) {
        amount = handler(ctx);
      } else {
        amount = comp.defaultValue;
      }
    } else {
      amount = comp.defaultValue;
    }

    items.push({
      id: comp.id,
      code: comp.code,
      name: comp.name,
      category: comp.category,
      amount: Math.max(0, amount),
      isManual: hasManualOverride || comp.valueType === "manual",
      includesInTotal: comp.includesInTotal,
      description: comp.description,
    });
  }

  // 3. Category aggregates
  let totalPkb = 0;
  let totalDendaPkb = 0;
  let totalSwdkllj = 0;
  let totalDendaSwdkllj = 0;
  let totalAdminDanJasa = 0;
  let totalInsidental = 0;
  let sumForTotal = 0;

  for (const it of items) {
    if (it.category === "PKB") totalPkb += it.amount;
    else if (it.category === "DENDA_PKB") totalDendaPkb += it.amount;
    else if (it.category === "SWDKLLJ") totalSwdkllj += it.amount;
    else if (it.category === "DENDA_SWDKLLJ") totalDendaSwdkllj += it.amount;
    else if (it.category === "ADMIN" || it.category === "JASA" || it.category === "PROSES" || it.category === "BBN") totalAdminDanJasa += it.amount;
    else if (it.category === "INSIDENTAL") totalInsidental += it.amount;

    if (it.includesInTotal) {
      sumForTotal += it.amount;
    }
  }

  // 4. ACC ID handling
  let accIdAmount: number | null = null;
  let accIdStatus: "LENGKAP" | "CALCULATED" | "NOT_AVAILABLE" = "NOT_AVAILABLE";

  const kondisiBerkas = input.kondisiBerkas ? input.kondisiBerkas.trim().toUpperCase() : undefined;
  if (template.vehicleType === "Motor") {
    // For R2, "Proses dan ACC ID" is part of the items breakdown and included in totalEstimasi
    const prosesAccItem = items.find((i) => i.id === "proses-dan-acc-id");
    if (kondisiBerkas === "LENGKAP") {
      accIdAmount = 0;
      accIdStatus = "LENGKAP";
    } else if (kondisiBerkas === "TIDAK ADA KTP") {
      accIdAmount = prosesAccItem ? prosesAccItem.amount : 350000;
      accIdStatus = "CALCULATED";
    } else {
      accIdAmount = null;
      accIdStatus = "NOT_AVAILABLE";
    }
  } else {
    // For R4, ACC ID is evaluated separately and strictly EXCLUDED from totalEstimasi
    if (kondisiBerkas === "LENGKAP") {
      accIdAmount = 0;
      accIdStatus = "LENGKAP";
    } else if (kondisiBerkas === "TIDAK ADA KTP") {
      if (input.wilayahAccId) {
        accIdAmount = resolveAccIdRate(template.accIdRates, input.wilayahAccId);
        accIdStatus = "CALCULATED";
      } else {
        accIdAmount = null;
        accIdStatus = "NOT_AVAILABLE";
      }
    } else {
      accIdAmount = null;
      accIdStatus = "NOT_AVAILABLE";
    }
  }

  // 5. Grand total dibulatkan ke atas ke kelipatan pembulatan terdekat (default Rp 1.000)
  const pembulatan = template.kelipatanPembulatan || 1000;
  const totalEstimasi = Math.ceil(sumForTotal / pembulatan) * pembulatan;

  return {
    tahunTunggakan,
    bulanTunggakan,
    bulanKalender,
    durasiKeterlambatan: overdue.formatted,
    items,
    totalPkb,
    totalDendaPkb,
    totalSwdkllj,
    totalDendaSwdkllj,
    totalAdminDanJasa,
    totalInsidental,
    accIdAmount,
    accIdStatus,
    totalEstimasi,
  };
}
