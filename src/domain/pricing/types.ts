/**
 * Canonical Domain Types for Pricing, Tariffs, and Cost Breakdowns
 * Admin SUN89 — Biro Jasa Management System
 */

export interface SamsatMasterItem {
  id: string; // e.g. "samsat-jakarta-timur"
  name: string; // e.g. "Samsat Jakarta Timur"
  wilayah: string; // e.g. "Jakarta Timur"
  alamat?: string;
  kode_kabupaten_kota?: string; // Foreign key referencing WilayahAdministratif.kode_kabupaten_kota
  nama_provinsi?: string;
  is_verified?: boolean;
  status_aktif?: boolean;
}

export interface WilayahAdministratif {
  kode_kabupaten_kota: string; // Official code e.g. "31.75"
  kode_provinsi: string; // Official province code e.g. "31"
  nama_provinsi: string;
  nama_kabupaten_kota: string;
  jenis_wilayah: "Kabupaten" | "Kota";
  status_aktif: boolean;
  sumber_referensi: string;
  tahun_referensi: number;
  samsatCount?: number;
  hasConfiguredSamsat?: boolean;
  statusKonfigurasi?: "Terkonfigurasi" | "Belum Dikonfigurasi";
  samsatOffices?: SamsatMasterItem[];
}

export interface PricingItem {
  id: string; // Stable ID, e.g. "mutasi-legalisir", "mutasi-cf", "mutasi-cek-blokir"
  code: string; // Business code, e.g. "MK-01"
  name: string; // Display name, e.g. "Legalisir Berkas"
  category: "Mutasi Keluar" | "Mutasi Masuk";
  active: boolean;
  description?: string;
}

export interface SamsatCostItem extends PricingItem {
  basePrice: number; // Baseline cost from Samsat
  namaItem?: string;
  biayaDasar?: number;
  kategori?: string;
  tipeKendaraan?: string;
  deskripsi?: string;
  isConfigured?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type TariffResolutionStatus =
  | "CONFIGURED_OVERRIDE"
  | "CONFIGURED_DEFAULT"
  | "NOT_CONFIGURED"
  | "DISABLED_ITEM"
  | "CORRUPTED_OVERRIDE"
  | "PENDING_DESTINATION";

export type TariffResolutionSource = "OVERRIDE" | "DEFAULT" | "NONE";

export interface ResolvedTariff {
  pricingItemId: string;
  namaItem: string;
  category: string;
  tipeKendaraan: string;
  samsatId: string;
  jurisdiction: "ASAL" | "TUJUAN" | "STANDARD";
  effectivePrice: number | null;
  source: TariffResolutionSource;
  status: TariffResolutionStatus;
  isExplicitZero: boolean;
  isMasterActive: boolean;
  overrideId?: string | null;
  nationalDefaultPrice: number | null;
  overridePrice: number | null;
}

export interface ServiceCostItem {
  id: string; // Stable ID e.g. "sci-1" or "biaya-lain-1"
  label?: string; // Display label e.g. "Administrasi Tambahan"
  nominal?: number; // Nominal amount in IDR
  enabled: boolean; // Whether active in estimation
  serviceId?: string; // Optional legacy foreign key
  itemId?: string; // Optional legacy foreign key
  required?: boolean;
  sellingPrice?: number;
  customLabel?: string;
}

export interface ServicePackageConfig {
  serviceId: string; // e.g. "mutasi-antar-samsat"
  serviceName: string; // e.g. "Mutasi Antar Samsat"
  description?: string;
  baseJasaPengurusan: number; // Base fee for bureau handling service
  biayaAntarJemput: number; // Operational courier fee (NOT a Samsat cost)
  items: ServiceCostItem[]; // Items mapped to SamsatCostItem
  active: boolean;
}

export interface ServiceComponentConfig {
  pricingItemId: string; // Foreign key referencing PricingItem.id
  enabled: boolean;
  required: boolean;
  customLabel?: string;
}

export interface ServiceFeeConfig {
  serviceId: string; // e.g. "mutasi-antar-samsat"
  serviceName: string; // e.g. "Mutasi Antar Samsat"
  samsatId: string; // e.g. "samsat-jakarta-timur"
  wilayah: string; // e.g. "Jakarta Timur"
  biayaJasa: number;
  biayaJasaR4?: number;
  biayaJasaR2?: number;
  jasaR4Enabled?: boolean;
  jasaR2Enabled?: boolean;
  biayaKhususR4?: number;
  biayaKhususR2?: number;
  khususR4Enabled?: boolean;
  khususR2Enabled?: boolean;
  totalBiayaJasa?: number; // e.g. 800000 (backward-compatible alias)
  jasaLengkap?: {
    nominal: number;
    enabled: boolean;
  };
  jasaNembak?: {
    nominal: number;
    enabled: boolean;
  };
  biayaPengurusanKhusus?: {
    nominal: number;
    enabled: boolean;
  };
  biayaAntarJemput: number; // e.g. 50000
  antarJemputEnabled?: boolean;
  antarJemputMode?: "Antar & Jemput" | "Antar Saja" | "Jemput Saja";
  components: ServiceComponentConfig[];
  swdkllj?: {
    nominal: number;
    enabled: boolean;
  };
  opsenPkb?: {
    nominal: number;
    enabled: boolean;
  };
  biayaLainnya?: ServiceCostItem[];
  active: boolean;
}

export interface ApplyAllScope {
  applyBiayaLayanan?: boolean;
  applyBiayaTambahan?: boolean;
  applyKomponenSamsat?: boolean;
  applyBiayaLainnya?: boolean;
  applyAturanEstimasi?: boolean;
}

export interface OrderCostBreakdownItem {
  itemId: string;
  code?: string;
  name: string;
  amount: number;
  actualCost?: number;
  notes?: string;
  category?: "Samsat" | "Jasa" | "Operasional" | "Pajak";
  source: "HargaDasarSamsat" | "BiayaLayanan" | "Kendaraan" | "Operasional";
  isRequired?: boolean;
  status?: "CONFIGURED" | "ZERO_EXPLICIT" | "UNCONFIGURED";
  isEstimated?: boolean;
}

export interface OrderCostSnapshot {
  serviceId: string;
  serviceName: string;
  samsatId: string;
  samsatName: string;
  metodeLayanan: "Antar Jemput" | "Datang Langsung";
  wilayahSamsat?: string;
  biayaJasa: number;
  totalBiayaJasa?: number;
  biayaPengurusanKhusus?: number;
  biayaSamsat: number;
  biayaAntarJemput: number;
  pkb: number;
  swdkllj: number;
  opsenPkb?: number;
  dendaSwdkllj: number;
  totalEstimasi: number;
  breakdown: OrderCostBreakdownItem[];
  completenessStatus?: "COMPLETE" | "PARTIAL_ESTIMATE";
  hasUnconfiguredTariff?: boolean;
  unconfiguredItems?: string[];
  isCostVerified?: boolean;
  costVerifiedAt?: string;
  costVerifiedBy?: string;
  createdAt: string;
}

export interface ServiceFeeResolutionInput {
  serviceName: string;
  vehicleType: "Mobil" | "Motor";
  samsatName?: string;
  feeConfig?: {
    biayaJasa?: number | null;
    biayaJasaR4?: number | null;
    biayaJasaR2?: number | null;
    jasaR4Enabled?: boolean | null;
    jasaR2Enabled?: boolean | null;
    biayaKhususR4?: number | null;
    biayaKhususR2?: number | null;
    khususR4Enabled?: boolean | null;
    khususR2Enabled?: boolean | null;
    jasaLengkap?: {
      nominal?: number | null;
      enabled?: boolean | null;
    } | null;
    biayaPengurusanKhusus?: {
      nominal?: number | null;
      enabled?: boolean | null;
    } | null;
    biayaJasaNembak?: number | null;
    jasaNembakEnabled?: boolean | null;
    isCustom?: boolean;
    [key: string]: any;
  } | null;
  kondisiBerkas?: string;
  templateBiayaJasa: number;
  standardBaselineJasa?: number;
  pricingStore?: any;
  isKhusus?: boolean;
}

export interface ResolvedServiceFee {
  effectiveJasa: number;
  source: "OVERRIDE" | "TEMPLATE_DEFAULT" | "SPECIAL_SERVICE" | "INACTIVE";
  isActive: boolean;
}

export interface IPricingDataProvider {
  getSamsatItems(): SamsatCostItem[];
  getSamsatItemById(id: string): SamsatCostItem | undefined;
  updateSamsatItem(id: string, updates: Partial<SamsatCostItem>): Promise<boolean> | boolean;
  addSamsatItem(item: Omit<SamsatCostItem, "id">): SamsatCostItem;
  getServiceConfigs?(): any[];
  getSamsatOffices?(): any[];
  updateServicePricing?(id: string, config: any): Promise<boolean> | boolean;
  createServicePricing?(config: any): Promise<any> | any;
  deleteServicePricing?(id: string): Promise<boolean> | boolean;
  createSamsatOffice?(office: any): Promise<any> | any;
  updateSamsatOffice?(id: string, updates: any): Promise<boolean> | boolean;
  deleteSamsatOffice?(id: string): Promise<boolean> | boolean;
  getSamsatOperationalTariffs?(samsatId?: string): Promise<any[]>;
  updateSamsatOperationalTariff?(samsatId: string, pricingItemId: string, nominal: number): Promise<any>;
  updateSamsatOperationalTariffsBatch?(samsatId: string, tariffs: Array<{ pricingItemId: string; nominal: number }>): Promise<any[]>;
  deleteSamsatOperationalTariff?(idOrParams: string | { samsatId: string; pricingItemId: string }): Promise<boolean>;
  batchReplicateServicePricing?(params: any): Promise<any>;
  subscribe(listener: () => void): () => void;
  isLoading?(): boolean;
  getError?(): Error | null;
  initFromApi?(): Promise<void>;
}
