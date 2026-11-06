/**
 * Service Store (Master Data Layanan & Persyaratan Dokumen)
 * Admin SUN89 — Biro Jasa Management System
 */

import { useState, useEffect } from "react";
import { APP_CONFIG } from "../config/appConfig";

export interface ServiceItem {
  id: string;
  kode_layanan: string;
  nama_layanan: string;
  kategori?: string;
  memerlukan_samsat_tujuan: number;
  deskripsi: string;
  requirements: string[];
  status_aktif: number;
  urutan: number;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceRequirementsDetail {
  requirements: string[];
  status: "OK" | "CUSTOM_SERVICE" | "MALFORMED_JSON" | "SERVICE_NOT_FOUND" | "GENERIC_FALLBACK" | "SNAPSHOT_VERIFIED" | "LEGACY_DERIVED" | "MALFORMED_SNAPSHOT";
  serviceId?: string;
  serviceName?: string;
  warningNotice?: string;
  isCustom?: boolean;
  isSnapshot?: boolean;
  isLegacyDerived?: boolean;
  snapshot?: any;
}

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: "svc-perp-1th",
    kode_layanan: "PERP_1THN",
    nama_layanan: "Perpanjangan 1 Tahun",
    kategori: "PAJAK_STNK",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Perpanjangan pajak kendaraan tahunan dengan proses cepat dan mudah. Perpanjangan STNK tahunan wajib dilakukan setiap 1 tahun sekali (PKB tahunan).",
    requirements: [
      "KTP asli + fotokopi (2 rangkap)",
      "STNK asli + fotokopi (2 rangkap)",
      "BPKB asli / Surat Keterangan Leasing + fotokopi (2 rangkap)",
    ],
    status_aktif: 1,
    urutan: 1,
  },
  {
    id: "svc-perp-5th",
    kode_layanan: "PERP_5THN",
    nama_layanan: "Perpanjangan 5 Tahun",
    kategori: "PAJAK_STNK",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Perpanjangan STNK 5 tahunan sekaligus ganti plat nomor kendaraan. Perpanjangan STNK setiap 5 tahun sekali bersamaan dengan penggantian plat kendaraan.",
    requirements: [
      "KTP asli + fotokopi (2 rangkap)",
      "STNK asli + fotokopi (2 rangkap)",
      "BPKB asli / Surat Keterangan Leasing + fotokopi (2 rangkap)",
      "Cek fisik kendaraan",
    ],
    status_aktif: 1,
    urutan: 2,
  },
  {
    id: "svc-mut-asal",
    kode_layanan: "MUT_ASAL",
    nama_layanan: "Mutasi Antar Samsat",
    kategori: "MUTASI",
    memerlukan_samsat_tujuan: 1,
    deskripsi: "Pemindahan data kendaraan dalam wilayah Jadetabek dengan proses yang terverifikasi. Pemindahan kepemilikan atau domisili kendaraan antar samsat di wilayah Jadetabek.",
    requirements: [
      "Fotokopi KTP pemilik baru (2 rangkap)",
      "STNK asli + fotokopi (2 rangkap)",
      "BPKB asli + fotokopi (2 rangkap)",
      "Cek fisik kendaraan",
      "Kwitansi pembelian",
      "Surat pelepasan hak (jika atas nama perusahaan)",
    ],
    status_aktif: 1,
    urutan: 3,
  },
  {
    id: "svc-mut-antar",
    kode_layanan: "MUT_ANTAR",
    nama_layanan: "Mutasi Luar Daerah",
    kategori: "MUTASI",
    memerlukan_samsat_tujuan: 1,
    deskripsi: "Proses mutasi kendaraan antar daerah di luar wilayah Jadetabek. Proses penarikan berkas kendaraan dari wilayah Jadetabek untuk pengurusan di luar daerah.",
    requirements: [
      "Fotokopi KTP pemilik baru (daerah tujuan) (2 rangkap)",
      "STNK asli + fotokopi (2 rangkap)",
      "BPKB asli + fotokopi (2 rangkap)",
      "Cek fisik kendaraan",
      "Kwitansi pembelian",
      "Surat pelepasan hak (jika atas nama perusahaan)",
    ],
    status_aktif: 1,
    urutan: 4,
  },
  {
    id: "svc-balik-nama",
    kode_layanan: "BALIK_NAMA",
    nama_layanan: "Balik Nama",
    kategori: "KEPEMILIKAN",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Proses balik nama kendaraan dari penjual ke pembeli dengan legal dan aman. Proses pengalihan kepemilikan kendaraan dari pemilik lama ke pemilik baru di samsat yang sama.",
    requirements: [
      "Fotokopi KTP pemilik baru (2 rangkap)",
      "STNK asli + fotokopi (2 rangkap)",
      "BPKB asli + fotokopi (2 rangkap)",
      "Cek fisik kendaraan",
      "Kwitansi pembelian",
      "Surat pelepasan hak (jika atas nama perusahaan)",
    ],
    status_aktif: 1,
    urutan: 5,
  },
  {
    id: "svc-tarik-berkas",
    kode_layanan: "TARIK_BERKAS",
    nama_layanan: "Tarik Berkas",
    kategori: "DOKUMEN",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Pengambilan dan penarikan berkas arsip kendaraan dari loket Samsat.",
    requirements: ["Surat Kuasa Bermaterai", "Fotokopi STNK / BPKB", "KTP Pemohon / Penerima Kuasa"],
    status_aktif: 1,
    urutan: 6,
  },
  {
    id: "svc-duplikat-stnk",
    kode_layanan: "DUPLIKAT_STNK",
    nama_layanan: "Duplikat STNK",
    kategori: "DOKUMEN",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Pengurusan penggantian STNK yang hilang atau duplikat dokumen kendaraan.",
    requirements: [
      "KTP asli + fotokopi (2 rangkap)",
      "Fotokopi STNK (jika ada)",
      "BPKB asli / Surat Keterangan Leasing + fotokopi (2 rangkap)",
      "Cek fisik kendaraan",
      "Surat keterangan hilang dari kepolisian",
    ],
    status_aktif: 1,
    urutan: 7,
  },
  {
    id: "svc-lainnya",
    kode_layanan: "LAINNYA",
    nama_layanan: "Lainnya",
    kategori: "LAINNYA",
    memerlukan_samsat_tujuan: 0,
    deskripsi: "Pengurusan layanan samsat khusus dan lainnya.",
    requirements: ["Dokumen Pendukung Khusus Sesuai Petunjuk Loket Samsat"],
    status_aktif: 1,
    urutan: 8,
  },
];

class ServiceStore {
  private services: ServiceItem[] = [...DEFAULT_SERVICES];
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;
  private isLoadingState = false;
  private lastError: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.initFromApi();
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getAuthHeader(): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  public async initFromApi(): Promise<void> {
    if (this.isLoadingState) return;
    const authHeaders = this.getAuthHeader();
    if (!authHeaders.Authorization) {
      return;
    }
    this.isLoadingState = true;
    this.lastError = null;

    try {
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/services`, {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        this.services = payload.data;
        this.isInitialized = true;
        this.isLoadingState = false;
        this.notify();
      } else {
        throw new Error(payload.message || "Format data layanan tidak valid");
      }
    } catch (err: any) {
      this.isLoadingState = false;
      this.lastError = err?.message || "Gagal menghubungkan ke backend layanan";
      this.notify();
    }
  }

  public getAll(): ServiceItem[] {
    return this.services;
  }

  public getActive(): ServiceItem[] {
    return this.services.filter((s) => s.status_aktif === 1);
  }

  public getById(id: string): ServiceItem | undefined {
    return this.services.find((s) => s.id === id);
  }

  public getByKode(kode: string): ServiceItem | undefined {
    return this.services.find((s) => s.kode_layanan.toUpperCase() === kode.toUpperCase());
  }

  /**
   * Helper to resolve any input (ID, code, alias slug, display name) to a canonical ServiceItem
   */
  public resolveService(input?: string): ServiceItem | undefined {
    if (!input) return undefined;
    const norm = input.toLowerCase().trim();

    // 1. Direct ID match
    const byId = this.services.find((s) => s.id.toLowerCase() === norm);
    if (byId) return byId;

    // 2. Direct Kode match
    const byCode = this.services.find((s) => s.kode_layanan.toLowerCase() === norm);
    if (byCode) return byCode;

    // 3. Exact Name match
    const byName = this.services.find((s) => s.nama_layanan.toLowerCase() === norm);
    if (byName) return byName;

    // 4. Common aliases & partials
    if (norm.includes("duplikat") || norm.includes("hilang")) {
      return this.services.find((s) => s.id === "svc-duplikat-stnk");
    }
    if (norm.includes("luar") || norm.includes("mutasi-luar") || norm.includes("mutasi-antar-daerah") || norm.includes("mutasi antar daerah")) {
      return this.services.find((s) => s.id === "svc-mut-antar");
    }
    if (norm.includes("mutasi") && (norm.includes("samsat") || norm.includes("asal") || norm.includes("mutasi-antar"))) {
      return this.services.find((s) => s.id === "svc-mut-asal");
    }
    if (norm.includes("balik") || norm.includes("bbn")) {
      return this.services.find((s) => s.id === "svc-balik-nama");
    }
    if (norm.includes("tarik")) {
      return this.services.find((s) => s.id === "svc-tarik-berkas");
    }
    if (norm.includes("5 tahun") || norm.includes("5-tahun") || norm.includes("ganti plat") || norm.includes("perp_5thn")) {
      return this.services.find((s) => s.id === "svc-perp-5th");
    }
    if (norm.includes("1 tahun") || norm.includes("1-tahun") || norm.includes("tahunan") || norm.includes("perp_1thn") || norm.includes("pajak-stnk")) {
      return this.services.find((s) => s.id === "svc-perp-1th");
    }
    if (norm.includes("blokir") || norm.includes("lapor jual")) {
      return this.services.find((s) => s.id === "svc-blokir-stnk");
    }
    if (norm.includes("lain") || norm === "lainnya" || norm === "lain-lain") {
      return this.services.find((s) => s.id === "svc-lainnya");
    }

    // 5. Partial contains name
    const partial = this.services.find(
      (s) => s.nama_layanan.toLowerCase().includes(norm) || norm.includes(s.nama_layanan.toLowerCase())
    );
    if (partial) return partial;

    return undefined;
  }

  /**
   * Resolves detailed service requirements with strict fallback rules:
   * - Never returns generic STNK checklist for non-STNK / custom services
   * - Safely catches malformed JSON
   * - Provides clear error/warning notices when service is missing or custom
   */
  public getOrderRequirementsDetail(order: any): ServiceRequirementsDetail {
    return this.getServiceRequirementsDetail(order);
  }

  public getServiceRequirementsDetail(inputOrOrder?: string | any): ServiceRequirementsDetail {
    if (!inputOrOrder) {
      return {
        requirements: [],
        status: "SERVICE_NOT_FOUND",
        warningNotice: "Layanan tidak ditentukan. Hubungi admin untuk verifikasi berkas.",
      };
    }

    // Resolving from Order object (Patch D: Immutable Snapshot First)
    if (typeof inputOrOrder === "object") {
      const order = inputOrOrder;
      // 1. Order with snapshot
      if (order.serviceRequirementsSnapshot !== undefined && order.serviceRequirementsSnapshot !== null) {
        const snap = order.serviceRequirementsSnapshot;
        if (snap && typeof snap === "object" && Array.isArray(snap.requirements)) {
          const reqs = snap.requirements
            .map((r: any) => (typeof r === "string" ? r : String(r?.label || r?.name || "")))
            .filter(Boolean);

          return {
            requirements: reqs,
            status: "SNAPSHOT_VERIFIED",
            serviceId: snap.sourceServiceId || order.service_id || order.serviceId,
            serviceName: snap.sourceServiceName || order.layanan,
            isSnapshot: true,
            snapshot: snap,
          };
        } else {
          return {
            requirements: [],
            status: "MALFORMED_SNAPSHOT",
            warningNotice: "Format snapshot persyaratan order tidak valid. Hubungi admin untuk verifikasi berkas.",
            isSnapshot: true,
          };
        }
      }

      // 2. Legacy order without snapshot: explicit fallback
      const svcIdOrName = order.service_id || order.serviceId || order.layanan;
      if (!svcIdOrName || !String(svcIdOrName).trim()) {
        return {
          requirements: [],
          status: "SERVICE_NOT_FOUND",
          warningNotice: "Layanan tidak ditentukan pada order legacy ini. Silakan konfirmasi berkas fisik kepada Admin.",
        };
      }

      const masterDetail = this.getServiceRequirementsDetail(String(svcIdOrName));
      if (masterDetail.status === "OK" || masterDetail.status === "CUSTOM_SERVICE") {
        return {
          ...masterDetail,
          status: "LEGACY_DERIVED",
          isLegacyDerived: true,
          warningNotice: "Persyaratan dokumen berasal dari konfigurasi layanan saat ini (legacy fallback).",
        };
      }
      return masterDetail;
    }

    const input = String(inputOrOrder);
    if (!input.trim()) {
      return {
        requirements: [],
        status: "SERVICE_NOT_FOUND",
        warningNotice: "Layanan tidak ditentukan. Hubungi admin untuk verifikasi berkas.",
      };
    }

    const norm = input.trim();
    const svc = this.resolveService(norm);

    if (!svc) {
      const lower = norm.toLowerCase();
      // Only permit generic fallback for explicit standard STNK annual extension phrases
      if (
        lower === "perp_1thn" ||
        lower === "perp_5thn" ||
        lower.includes("perpanjangan 1 tahun") ||
        lower.includes("perpanjangan 5 tahun") ||
        lower.includes("pajak tahunan")
      ) {
        return {
          requirements: [
            "KTP asli + fotokopi (2 rangkap)",
            "STNK asli + fotokopi (2 rangkap)",
            "BPKB asli / Surat Keterangan Leasing + fotokopi (2 rangkap)",
          ],
          status: "GENERIC_FALLBACK",
          warningNotice: "Menampilkan persyaratan standar perpanjangan STNK.",
        };
      }

      return {
        requirements: [],
        status: "SERVICE_NOT_FOUND",
        warningNotice: `Layanan "${norm}" tidak terdaftar dalam katalog master. Silakan konfirmasi berkas fisik kepada Admin.`,
      };
    }

    // Custom or special service category
    if (svc.id === "svc-lainnya" || svc.kategori === "LAINNYA") {
      const customReqs =
        Array.isArray(svc.requirements) && svc.requirements.length > 0
          ? svc.requirements
          : ["Dokumen Pendukung Khusus Sesuai Petunjuk Loket Samsat"];
      return {
        requirements: customReqs,
        status: "CUSTOM_SERVICE",
        serviceId: svc.id,
        serviceName: svc.nama_layanan,
        isCustom: true,
        warningNotice: "Layanan khusus: periksa instruksi catatan order dari admin.",
      };
    }

    // Inspect requirements array / malformed check
    let resolvedReqs = svc.requirements;
    if (typeof (resolvedReqs as any) === "string") {
      try {
        const parsed = JSON.parse(resolvedReqs as any);
        if (Array.isArray(parsed)) {
          resolvedReqs = parsed;
        } else {
          return {
            requirements: [],
            status: "MALFORMED_JSON",
            serviceId: svc.id,
            serviceName: svc.nama_layanan,
            warningNotice: "Format data persyaratan dokumen tidak valid pada master data. Hubungi admin untuk verifikasi berkas.",
          };
        }
      } catch {
        return {
          requirements: [],
          status: "MALFORMED_JSON",
          serviceId: svc.id,
          serviceName: svc.nama_layanan,
          warningNotice: "Format data persyaratan dokumen tidak valid pada master data. Hubungi admin untuk verifikasi berkas.",
        };
      }
    }

    if (!Array.isArray(resolvedReqs) || resolvedReqs.length === 0) {
      return {
        requirements: [],
        status: "OK",
        serviceId: svc.id,
        serviceName: svc.nama_layanan,
        warningNotice: "Layanan ini belum memiliki daftar persyaratan dokumen wajib.",
      };
    }

    return {
      requirements: resolvedReqs,
      status: "OK",
      serviceId: svc.id,
      serviceName: svc.nama_layanan,
    };
  }

  /**
   * Get requirements list for any service identifier with a guaranteed safe fallback
   */
  public getRequirements(input?: string): string[] {
    return this.getServiceRequirementsDetail(input).requirements;
  }

  public isLoading(): boolean {
    return this.isLoadingState;
  }

  public getError(): string | null {
    return this.lastError;
  }

  public async updateService(
    id: string,
    updates: {
      nama_layanan?: string;
      deskripsi?: string;
      requirements?: string[];
      status_aktif?: number;
      urutan?: number;
    }
  ): Promise<{ success: boolean; data?: ServiceItem; error?: string }> {
    try {
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify(updates),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        return {
          success: false,
          error: payload.message || payload.error?.message || "Gagal memperbarui layanan.",
        };
      }

      const updatedItem: ServiceItem = payload.data;
      const idx = this.services.findIndex((s) => s.id === id);
      if (idx !== -1) {
        this.services[idx] = updatedItem;
      } else {
        this.services.push(updatedItem);
      }

      this.notify();
      return { success: true, data: updatedItem };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Terjadi kesalahan jaringan saat memperbarui layanan.",
      };
    }
  }

  public async deleteService(id: string): Promise<{ success: boolean; softDeactivated?: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`${APP_CONFIG.apiBaseUrl}/services/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        return {
          success: false,
          error: payload.message || payload.error?.message || "Gagal menghapus layanan.",
        };
      }

      if (payload.data?.softDeactivated) {
        // Mark as inactive in local store
        const item = this.services.find((s) => s.id === id);
        if (item) item.status_aktif = 0;
      } else {
        // Remove completely from local store
        this.services = this.services.filter((s) => s.id !== id);
      }

      this.notify();
      return {
        success: true,
        softDeactivated: payload.data?.softDeactivated,
        message: payload.message,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Terjadi kesalahan jaringan saat menghapus layanan.",
      };
    }
  }
}

export const serviceStore = new ServiceStore();

export interface ParsedRequirement {
  key: string;
  label: string;
  isOptional: boolean;
  cleanName: string;
}

export function parseRequirementItem(rawRequirement: string, index?: number): ParsedRequirement {
  const trimmed = rawRequirement.trim();
  const isOptional = /\(jika ada\)/i.test(trimmed) || /opsional/i.test(trimmed);
  const cleanName = trimmed.replace(/\(jika ada\)/gi, "").replace(/opsional/gi, "").trim();

  // Create clean slug key
  let baseSlug = trimmed
    .toLowerCase()
    .replace(/\+/g, "dan")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  if (!baseSlug) {
    baseSlug = `doc_${index !== undefined ? index : Date.now()}`;
  }

  // Common mapping for standard keys
  let normalizedKey = baseSlug;
  if (/ktp/i.test(trimmed)) normalizedKey = "ktp";
  else if (/stnk/i.test(trimmed)) normalizedKey = "stnk";
  else if (/bpkb/i.test(trimmed)) normalizedKey = "bpkb";
  else if (/cek.?fisik/i.test(trimmed)) normalizedKey = "cek_fisik";
  else if (/hilang|kepolisian/i.test(trimmed)) normalizedKey = "surat_hilang";
  else if (/kwitansi|kuitansi/i.test(trimmed)) normalizedKey = "kwitansi";
  else if (/pelepasan.hak/i.test(trimmed)) normalizedKey = "pelepasan_hak";
  else if (/surat.kuasa/i.test(trimmed)) normalizedKey = "surat_kuasa";
  else if (/skkp/i.test(trimmed)) normalizedKey = "skkp";

  return {
    key: normalizedKey,
    label: trimmed,
    isOptional,
    cleanName,
  };
}

export function useServiceStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = serviceStore.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  return {
    services: serviceStore.getAll(),
    activeServices: serviceStore.getActive(),
    isLoading: serviceStore.isLoading(),
    error: serviceStore.getError(),
    refreshServices: () => serviceStore.initFromApi(),
    updateService: (id: string, updates: any) => serviceStore.updateService(id, updates),
    getServiceById: (id: string) => serviceStore.getById(id),
    resolveService: (input?: string) => serviceStore.resolveService(input),
    getRequirements: (input?: string) => serviceStore.getRequirements(input),
    deleteService: (id: string) => serviceStore.deleteService(id),
  };
}
