import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { TablePagination } from "./ui/TablePagination";
import { EmptyState } from "./ui/empty-state";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import {
  Plus, Edit, Trash2, Search, Calculator, Layers, Sliders, Settings2,
  AlertTriangle, CheckCircle2, Briefcase, Truck, ArrowDownLeft, ArrowUpRight,
  FileText, Check, AlertCircle, Tag, ShieldCheck, ShieldAlert, Loader2, Zap, ChevronDown, ChevronUp, Sparkles, Info
} from "lucide-react";
import { toast } from "sonner";
import { pricingStore, usePricingStore, resolveSamsatId, resolveServiceId } from "../data/pricingStore";
import { estimationStore, useEstimationStore, ALL_DEFAULT_TEMPLATES, sanitizeComponentDescription } from "../data/estimationStore";
import { EstimationComponentRule } from "../../domain/estimation/types";
import { resolveTemplateIdByService } from "./estimation/EstimationMasterManager";
import { cn } from "./ui/utils";
import { EstimatorR4Tahunan } from "./estimation/EstimatorR4Tahunan";
import { EstimatorR2Tahunan } from "./estimation/EstimatorR2Tahunan";
import { EstimatorExtended } from "./estimation/EstimatorExtended";
import { ProvinsiFilterSelect } from "./ProvinsiFilterSelect";

// ─────────────────────────────────────────────────────────────────────────────
// Service Standard Baselines & Overrides Detector
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICE_STANDARD_BASELINES: Record<string, { jasa: number; kurir: number }> = {
  "Perpanjangan 1 Tahun": { jasa: 250000, kurir: 50000 },
  "Perpanjangan 5 Tahun": { jasa: 500000, kurir: 50000 },
  "Mutasi Antar Samsat": { jasa: 800000, kurir: 50000 },
  "Mutasi Luar Daerah": { jasa: 1500000, kurir: 50000 },
  "Balik Nama": { jasa: 1200000, kurir: 50000 },
  "Tarik Berkas": { jasa: 600000, kurir: 50000 },
  "Duplikat STNK": { jasa: 350000, kurir: 50000 },
  "Lainnya": { jasa: 300000, kurir: 50000 },
};

export const isRowCustomOrOverridden = (item: any): boolean => {
  const baseline = SERVICE_STANDARD_BASELINES[item.layanan] || { jasa: 250000, kurir: 50000 };
  const jasa = item.biayaJasaLengkap ?? item.biayaJasa ?? 0;
  const kurir = item.biayaAntarJemput ?? 50000;
  const hasCustomFees = Array.isArray(item.biayaLainnya) && item.biayaLainnya.some((b: any) => b.enabled !== false && b.label && b.label.trim() !== "");
  const isKhususActive = item.pengurusanKhususEnabled === true || item.jasaNembakEnabled === true;
  return jasa !== baseline.jasa || kurir !== baseline.kurir || hasCustomFees || isKhususActive;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & Types
// ─────────────────────────────────────────────────────────────────────────────

const supportsVehicleChoice = (layanan?: string) => {
  if (!layanan) return true;
  return (
    layanan.includes("1 Tahun") ||
    layanan.includes("5 Tahun") ||
    layanan.includes("Balik") ||
    layanan.includes("BBN") ||
    layanan.includes("Mutasi")
  );
};

const hasAdminStnkTnkb = (layanan?: string) => {
  if (!layanan) return false;
  return (
    layanan.includes("5 Tahun") ||
    layanan.includes("Balik") ||
    layanan.includes("BBN") ||
    layanan.includes("Mutasi")
  );
};

const getCategoryBadgeClass = (category?: string) => {
  switch (category) {
    case "PKB":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "DENDA_PKB":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
    case "SWDKLLJ":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "DENDA_SWDKLLJ":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "ADMIN":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30";
    case "JASA":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30";
    case "BBN":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30";
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30";
  }
};

const getWilayahList = () => {
  return Array.from(new Set(pricingStore.getSamsats().map((s) => s.wilayah))).sort();
};

const layananTabs = [
  { value: "perpanjangan-1", label: "Perpanjangan 1 Tahun", key: "Perpanjangan 1 Tahun" },
  { value: "perpanjangan-5", label: "Perpanjangan 5 Tahun", key: "Perpanjangan 5 Tahun" },
  { value: "mutasi-antar", label: "Mutasi Antar Samsat", key: "Mutasi Antar Samsat" },
  { value: "mutasi-luar", label: "Mutasi Luar Daerah", key: "Mutasi Luar Daerah" },
  { value: "balik-nama", label: "Balik Nama", key: "Balik Nama" },
  { value: "tarik-berkas", label: "Tarik Berkas", key: "Tarik Berkas" },
  { value: "duplikat-stnk", label: "Duplikat STNK", key: "Duplikat STNK" },
];


// ─────────────────────────────────────────────────────────────────────────────
// Canonical Services Definitions (8 Canonical Services matching DB)
// ─────────────────────────────────────────────────────────────────────────────

export interface BiayaLayananServiceMeta {
  key: string;
  label: string;
  dbLayanan: string;
}

export const CANONICAL_BIAYA_LAYANAN_SERVICES: BiayaLayananServiceMeta[] = [
  { key: "perpanjangan-1-tahun", label: "Perpanjangan 1 Tahun", dbLayanan: "Perpanjangan 1 Tahun" },
  { key: "perpanjangan-5-tahun", label: "Perpanjangan 5 Tahun", dbLayanan: "Perpanjangan 5 Tahun" },
  { key: "mutasi-antar-samsat", label: "Mutasi Antar Samsat", dbLayanan: "Mutasi Antar Samsat" },
  { key: "mutasi-luar-daerah", label: "Mutasi Luar Daerah", dbLayanan: "Mutasi Luar Daerah" },
  { key: "balik-nama", label: "Balik Nama", dbLayanan: "Balik Nama" },
  { key: "tarik-berkas", label: "Tarik Berkas", dbLayanan: "Tarik Berkas" },
  { key: "duplikat-stnk", label: "Duplikat STNK", dbLayanan: "Duplikat STNK" },
  { key: "lainnya", label: "Lainnya", dbLayanan: "Lainnya" },
];

export const BIAYA_LAYANAN_ALIAS_MAP: Record<string, string> = {
  "perpanjangan-1": "perpanjangan-1-tahun",
  "perpanjangan-5": "perpanjangan-5-tahun",
  "mutasi-antar": "mutasi-antar-samsat",
  "mutasi-asal": "mutasi-antar-samsat",
  "mutasi-luar": "mutasi-luar-daerah",
  "mutasi-antar-daerah": "mutasi-luar-daerah",
};

export const GENERAL_SECTIONS = [
  {
    id: "parameter",
    label: "Parameter Estimasi",
    shortLabel: "Parameter Rumus",
    icon: Sliders,
    description: "Koefisien denda, pembulatan, SWDKLLJ, dan aturan rumus estimasi (R4 & R2)",
  },
  {
    id: "mutasi-masuk",
    label: "Komponen Samsat — Mutasi Masuk",
    shortLabel: "Mutasi Masuk",
    icon: ArrowDownLeft,
    description: "Biaya pendaftaran dan proses mutasi masuk di Samsat tujuan",
  },
  {
    id: "mutasi-keluar",
    label: "Komponen Samsat — Mutasi Keluar",
    shortLabel: "Mutasi Keluar",
    icon: ArrowUpRight,
    description: "Biaya fiskal, cek fisik, dan arsip mutasi keluar di Samsat asal",
  },
  {
    id: "ringkasan",
    label: "Ringkasan Estimasi General",
    shortLabel: "Ringkasan",
    icon: CheckCircle2,
    description: "Live preview komponen aktif, komponen masuk total, dan total estimasi",
  },
] as const;

export const SAMSAT_SECTIONS = [
  {
    id: "biaya-layanan",
    label: "Biaya Layanan (Jasa)",
    shortLabel: "Biaya Jasa",
    icon: Briefcase,
    description: "Tarif jasa standar biro dan biaya pengurusan dokumen khusus",
  },
  {
    id: "biaya-tambahan",
    label: "Biaya Tambahan",
    shortLabel: "Kurir Antar-Jemput",
    icon: Truck,
    description: "Tarif kurir penjemputan dan pengantaran dokumen ke alamat klien",
  },
  {
    id: "biaya-lainnya",
    label: "Biaya Lainnya (Kustom Wilayah)",
    shortLabel: "Biaya Kustom",
    icon: FileText,
    description: "Biaya operasional tambahan atau komponen khusus wilayah ini",
  },
  {
    id: "ringkasan-tarif",
    label: "Ringkasan Tarif Wilayah",
    shortLabel: "Ringkasan",
    icon: CheckCircle2,
    description: "Rincian total biaya jasa, kurir, dan biaya tambahan aktif wilayah ini",
  },
] as const;

export const SECTIONS = [
  ...GENERAL_SECTIONS,
  ...SAMSAT_SECTIONS,
] as const;

export type GeneralSectionId = typeof GENERAL_SECTIONS[number]["id"];
export type SamsatSectionId = typeof SAMSAT_SECTIONS[number]["id"];
export type SectionId = typeof SECTIONS[number]["id"];

export interface VehicleFormulaDraft {
  koefDenda: string;
  pembagiBulan: string;
  kelipatanPembulatan: string;
  swdklljPokok: string;
  dendaSwdkllj: string;
  biayaCetakSkp: string;
  adminStnk: string;
  adminTnkb: string;
  components: EstimationComponentRule[];
  savedIncludesInTotal: Record<string, boolean>;
}

export interface BiayaLainnyaItemDraft {
  id: string;
  label: string;
  nominal: number;
  enabled: boolean;
  includesInTotal: boolean;
  savedIncludesInTotal?: boolean;
}

export interface SamsatFeeDraft {
  wilayah: string;
  biayaJasaLengkap: string;
  jasaLengkapEnabled: boolean;
  jasaLengkapIncludesInTotal: boolean;
  savedJasaLengkapIncludesInTotal: boolean;

  biayaJasaNembak: string;
  jasaNembakEnabled: boolean;
  jasaNembakIncludesInTotal: boolean;
  savedJasaNembakIncludesInTotal: boolean;

  biayaAntarJemput: string;
  antarJemputEnabled: boolean;
  antarJemputIncludesInTotal: boolean;
  savedAntarJemputIncludesInTotal: boolean;
  antarJemputMode: "Antar & Jemput" | "Antar Saja" | "Jemput Saja";

  nominalSwdkllj: string;
  swdklljEnabled: boolean;
  swdklljIncludesInTotal: boolean;
  savedSwdklljIncludesInTotal: boolean;

  biayaLainnya: BiayaLainnyaItemDraft[];

  selectedComponents: Record<string, boolean>;
  componentIncludesInTotal: Record<string, boolean>;
  savedComponentIncludesInTotal: Record<string, boolean>;
}

const getCanonicalTemplateRef = (serviceName: string, vehicle: "Mobil" | "Motor") => {
  const tplId = resolveTemplateIdByService(serviceName, vehicle);
  return ALL_DEFAULT_TEMPLATES.find((t) => t.id === tplId) || null;
};

const buildEmptyVehicleDraft = (vehicle: "Mobil" | "Motor"): VehicleFormulaDraft => ({
  koefDenda: "48",
  pembagiBulan: "12",
  kelipatanPembulatan: "1000",
  swdklljPokok: vehicle === "Mobil" ? "143000" : "35000",
  dendaSwdkllj: vehicle === "Mobil" ? "100000" : "32000",
  biayaCetakSkp: vehicle === "Mobil" ? "100000" : "25000",
  adminStnk: vehicle === "Mobil" ? "200000" : "100000",
  adminTnkb: vehicle === "Mobil" ? "100000" : "60000",
  components: [],
  savedIncludesInTotal: {},
});

const buildEmptySamsatDraft = (): SamsatFeeDraft => ({
  wilayah: "Jakarta Timur",
  biayaJasaLengkap: "500000",
  jasaLengkapEnabled: true,
  jasaLengkapIncludesInTotal: true,
  savedJasaLengkapIncludesInTotal: true,
  biayaJasaNembak: "300000",
  jasaNembakEnabled: false,
  jasaNembakIncludesInTotal: true,
  savedJasaNembakIncludesInTotal: true,
  biayaAntarJemput: "50000",
  antarJemputEnabled: true,
  antarJemputIncludesInTotal: true,
  savedAntarJemputIncludesInTotal: true,
  antarJemputMode: "Antar & Jemput",
  nominalSwdkllj: "143000",
  swdklljEnabled: true,
  swdklljIncludesInTotal: true,
  savedSwdklljIncludesInTotal: true,
  biayaLainnya: [],
  selectedComponents: {},
  componentIncludesInTotal: {},
  savedComponentIncludesInTotal: {},
});

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Micro-Components for Refinement
// ─────────────────────────────────────────────────────────────────────────────

interface ComponentStatusControlsProps {
  isActive: boolean;
  includesInTotal?: boolean;
  onToggleActive: () => void;
  onToggleIncludesInTotal?: () => void;
}

function ComponentStatusControls({
  isActive,
  onToggleActive,
}: ComponentStatusControlsProps) {
  return (
    <div className="flex items-center shrink-0 select-none">
      <Switch
        checked={isActive}
        onCheckedChange={onToggleActive}
        aria-label="Status aktif"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function BiayaLayanan() {
  usePricingStore();
  useEstimationStore();
  const biayaData = pricingStore.getBiayaLayananRows();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvinsi, setSelectedProvinsi] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
    const { service } = useParams<{ service?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const pathService = location.pathname.replace(/^\/master-data\/biaya-layanan\/?/, "").split("/")[0];
  const rawService = service || pathService;
  const activeServiceKey = (rawService && BIAYA_LAYANAN_ALIAS_MAP[rawService])
    ? BIAYA_LAYANAN_ALIAS_MAP[rawService]
    : (rawService || "perpanjangan-1-tahun");

  useEffect(() => {
    if (rawService && BIAYA_LAYANAN_ALIAS_MAP[rawService]) {
      navigate(`/master-data/biaya-layanan/${BIAYA_LAYANAN_ALIAS_MAP[rawService]}`, { replace: true });
    }
  }, [rawService, navigate]);

  const activeService = CANONICAL_BIAYA_LAYANAN_SERVICES.find((s) => s.key === activeServiceKey)
    || CANONICAL_BIAYA_LAYANAN_SERVICES[0];

  const activeTab = activeServiceKey;
  const setActiveTab = (val: string) => {
    const canonicalKey = BIAYA_LAYANAN_ALIAS_MAP[val] || val;
    navigate(`/master-data/biaya-layanan/${canonicalKey}`);
  };

  const wilayahToProvinsiMap = useMemo(() => {
    const map = new Map<string, string>();
    pricingStore.getSamsats().forEach((s) => {
      if (s.nama_provinsi) {
        map.set(s.wilayah.toLowerCase().trim(), s.nama_provinsi);
        map.set(s.name.toLowerCase().trim(), s.nama_provinsi);
        map.set(s.id.toLowerCase().trim(), s.nama_provinsi);
      }
    });
    return map;
  }, []);

  // Modal dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isApplyAllDialogOpen, setIsApplyAllDialogOpen] = useState(false);
  const [applyAllPolicy, setApplyAllPolicy] = useState<"PRESERVE_EXISTING_CUSTOM" | "OVERWRITE_ALL">("PRESERVE_EXISTING_CUSTOM");
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [isEstimatorOpen, setIsEstimatorOpen] = useState(false);
  const [estimatorVehicleTab, setEstimatorVehicleTab] = useState<"R4" | "R2">("R4");
  const [estimatorServiceTab, setEstimatorServiceTab] = useState<
    "Perpanjangan 1 Tahun" | "Perpanjangan 5 Tahun" | "Balik Nama" | "Mutasi Antar Samsat" | "Mutasi Luar Daerah"
  >("Perpanjangan 1 Tahun");

  const [selectedItem, setSelectedItem] = useState<any>(null);

  // General Rules Modal & Regional Samsat Tariff Modal states
  const [isGeneralRulesOpen, setIsGeneralRulesOpen] = useState(false);
  const [generalActiveSection, setGeneralActiveSection] = useState<GeneralSectionId>("parameter");
  const [samsatActiveSection, setSamsatActiveSection] = useState<SamsatSectionId>("biaya-layanan");
  const [activeSection, setActiveSection] = useState<SectionId>("biaya-layanan");
  const [editVehicle, setEditVehicle] = useState<"Mobil" | "Motor">("Mobil");

  // In-memory isolated draft states for Mobil and Motor
  const [vehicleDrafts, setVehicleDrafts] = useState<Record<"Mobil" | "Motor", VehicleFormulaDraft>>({
    Mobil: buildEmptyVehicleDraft("Mobil"),
    Motor: buildEmptyVehicleDraft("Motor"),
  });

  // In-memory draft state for Samsat fee & component config
  const [samsatDraft, setSamsatDraft] = useState<SamsatFeeDraft>(buildEmptySamsatDraft());

  // Snapshot for unsaved change detection
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  // Controlled scope state for "Terapkan ke Semua Samsat" (khusus tarif operasional modal ini)
  const [applyAllScope, setApplyAllScope] = useState({
    applyBiayaLayanan: true,
    applyBiayaTambahan: true,
    applyBiayaLainnya: true,
  });

  // Add form basic state
  const [addFormData, setAddFormData] = useState({
    wilayah: "Jakarta Timur",
    biayaJasaLengkap: "500000",
    jasaLengkapEnabled: true,
    biayaJasaNembak: "300000",
    jasaNembakEnabled: false,
    biayaAntarJemput: "50000",
    antarJemputEnabled: true,
    antarJemputMode: "Antar & Jemput" as "Antar & Jemput" | "Antar Saja" | "Jemput Saja",
    nominalSwdkllj: "143000",
    swdklljEnabled: true,
    biayaLainnya: [] as Array<{ id: string; label: string; nominal: number; enabled: boolean }>,
  });
  const [addSelectedComponents, setAddSelectedComponents] = useState<Record<string, boolean>>({});

  // Formula Banner state (Opsi A: Interaktif & Terbuka / Tertutup)
  const [isFormulaBannerOpen, setIsFormulaBannerOpen] = useState(true);
  const [bannerVehicle, setBannerVehicle] = useState<"Mobil" | "Motor">("Mobil");
  const [bannerScenario, setBannerScenario] = useState<"normal" | "denda" | "khusus" | "pemutihan">("denda");

  // Filter "Hanya Tarif Khusus / Berbeda"
  const [onlyCustomFilter, setOnlyCustomFilter] = useState(false);

  const getCurrentLayanan = () => {
    return activeService.dbLayanan;
  };

  // Count of offices with custom tariffs for the active service
  const customOfficesCount = useMemo(() => {
    const currentLayanan = getCurrentLayanan();
    return biayaData.filter((item) => item.layanan === currentLayanan && isRowCustomOrOverridden(item)).length;
  }, [biayaData, activeService]);

  // Real-time custom tariff metrics for Apply All Dialog
  const applyAllMetrics = useMemo(() => {
    const currentLayanan = selectedItem?.layanan || getCurrentLayanan();
    const rowsForService = biayaData.filter((item) => item.layanan === currentLayanan);
    const totalOffices = rowsForService.length || 515;
    const customCount = rowsForService.filter((item) => isRowCustomOrOverridden(item)).length;
    const standardCount = Math.max(0, totalOffices - customCount);
    return {
      currentLayanan,
      totalOffices,
      customCount,
      standardCount,
    };
  }, [selectedItem, biayaData, activeService]);

  // Filter data based on tab, search, provinsi, and custom tariff filter
  const getFilteredData = () => {
    const currentLayanan = getCurrentLayanan();
    return biayaData.filter((item) => {
      if (item.layanan !== currentLayanan) return false;

      // Filter Hanya Tarif Khusus / Berbeda
      if (onlyCustomFilter && !isRowCustomOrOverridden(item)) {
        return false;
      }

      const itemProv =
        wilayahToProvinsiMap.get(item.wilayah.toLowerCase().trim()) ||
        pricingStore.getSamsatById(item.wilayah)?.nama_provinsi;

      // Filter Provinsi
      if (selectedProvinsi !== "all") {
        if (selectedProvinsi === "unmapped") {
          if (itemProv && itemProv !== "-" && itemProv !== "Belum Terpetakan") return false;
        } else {
          if (!itemProv || itemProv.toLowerCase() !== selectedProvinsi.toLowerCase()) {
            return false;
          }
        }
      }

      // Filter Search Term (wilayah & provinsi)
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase().trim();
        const matchesWilayah = item.wilayah.toLowerCase().includes(q);
        const matchesProv = itemProv ? itemProv.toLowerCase().includes(q) : false;
        if (!matchesWilayah && !matchesProv) return false;
      }

      return true;
    });
  };

  const filteredData = getFilteredData();
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setCurrentPage(1);
    setSearchTerm("");
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Draft Builders & Snapshot Calculation
  // ─────────────────────────────────────────────────────────────────────────────

  const buildVehicleDraft = (serviceName: string, vehicle: "Mobil" | "Motor"): VehicleFormulaDraft => {
    const tplId = resolveTemplateIdByService(serviceName, vehicle);
    const tpl = estimationStore.getTemplate(tplId);
    const refTpl = getCanonicalTemplateRef(serviceName, vehicle);

    const koefDenda = tpl
      ? (tpl.koefisienDenda <= 1 ? Math.round(tpl.koefisienDenda * 100) : tpl.koefisienDenda).toString()
      : (refTpl ? Math.round(refTpl.koefisienDenda <= 1 ? refTpl.koefisienDenda * 100 : refTpl.koefisienDenda).toString() : "48");

    const pembagiBulan = (tpl?.pembagiBulan ?? refTpl?.pembagiBulan ?? 12).toString();
    const kelipatanPembulatan = (tpl?.kelipatanPembulatan ?? refTpl?.kelipatanPembulatan ?? 1000).toString();
    const swdklljPokok = (tpl?.swdklljPokok ?? refTpl?.swdklljPokok ?? (vehicle === "Mobil" ? 143000 : 35000)).toString();
    const dendaSwdkllj = (tpl?.dendaSwdklljPokok ?? refTpl?.dendaSwdklljPokok ?? (vehicle === "Mobil" ? 100000 : 32000)).toString();
    const biayaCetakSkp = (tpl?.biayaCetakSkp ?? refTpl?.biayaCetakSkp ?? (vehicle === "Mobil" ? 100000 : 25000)).toString();
    const adminStnk = (tpl?.adminStnk ?? refTpl?.adminStnk ?? (serviceName.includes("5 Tahun") ? (vehicle === "Mobil" ? 200000 : 100000) : 0)).toString();
    const adminTnkb = (tpl?.adminTnkb ?? refTpl?.adminTnkb ?? (serviceName.includes("5 Tahun") ? (vehicle === "Mobil" ? 100000 : 60000) : 0)).toString();

    const components = (tpl?.components || refTpl?.components || []).map((c) => ({
      ...c,
      description: sanitizeComponentDescription(c.description),
    }));
    const savedIncludesInTotal: Record<string, boolean> = {};
    components.forEach((c) => {
      savedIncludesInTotal[c.id] = c.includesInTotal ?? true;
    });

    return {
      koefDenda,
      pembagiBulan,
      kelipatanPembulatan,
      swdklljPokok,
      dendaSwdkllj,
      biayaCetakSkp,
      adminStnk,
      adminTnkb,
      components,
      savedIncludesInTotal,
    };
  };

  const buildSamsatDraft = (item: any): SamsatFeeDraft => {
    const serviceId = resolveServiceId(item.layanan);
    const samsatId = resolveSamsatId(item.wilayah);
    const config = pricingStore.getServiceFeeConfig(serviceId, samsatId);

    const jasaLengkapNom = (config?.jasaLengkap?.nominal ?? item.biayaJasaLengkap ?? item.biayaJasa ?? 500000).toString();
    const jasaLengkapEn = config?.jasaLengkap?.enabled ?? item.jasaLengkapEnabled ?? true;

    const jasaNembakNom = (config?.biayaPengurusanKhusus?.nominal ?? config?.jasaNembak?.nominal ?? item.biayaPengurusanKhusus ?? item.biayaJasaNembak ?? Math.round(Number(jasaLengkapNom) * 0.6)).toString();
    const jasaNembakEn = config?.biayaPengurusanKhusus?.enabled ?? config?.jasaNembak?.enabled ?? item.pengurusanKhususEnabled ?? item.jasaNembakEnabled ?? false;

    const antarJemputNom = (config?.biayaAntarJemput ?? item.biayaAntarJemput ?? 50000).toString();
    const antarJemputEn = config?.antarJemputEnabled ?? item.antarJemputEnabled ?? true;
    const antarJemputMode = (config?.antarJemputMode || item.antarJemputMode || "Antar & Jemput") as "Antar & Jemput" | "Antar Saja" | "Jemput Saja";

    const swdklljNom = (config?.opsenPkb?.nominal ?? config?.swdkllj?.nominal ?? item.opsenPkb?.nominal ?? item.swdkllj?.nominal ?? 143000).toString();
    const swdklljEn = config?.opsenPkb?.enabled ?? config?.swdkllj?.enabled ?? item.opsenPkb?.enabled ?? item.swdkllj?.enabled ?? true;

    const biayaLainnya: BiayaLainnyaItemDraft[] = (config?.biayaLainnya || item.biayaLainnya || []).map((b: any) => ({
      id: b.id,
      label: b.label || "",
      nominal: b.nominal || 0,
      enabled: b.enabled ?? true,
      includesInTotal: b.includesInTotal ?? true,
      savedIncludesInTotal: b.includesInTotal ?? true,
    }));

    const selectedComponents: Record<string, boolean> = {};
    const componentIncludesInTotal: Record<string, boolean> = {};
    const savedComponentIncludesInTotal: Record<string, boolean> = {};
    const masterItems = pricingStore.getMasterPricingItems();
    masterItems.forEach((c) => {
      const found = config?.components.find((sc) => sc.pricingItemId === c.id);
      const isEn = found ? found.enabled : false;
      selectedComponents[c.id] = isEn;
      componentIncludesInTotal[c.id] = true;
      savedComponentIncludesInTotal[c.id] = true;
    });

    return {
      wilayah: item.wilayah,
      biayaJasaLengkap: jasaLengkapNom,
      jasaLengkapEnabled: jasaLengkapEn,
      jasaLengkapIncludesInTotal: true,
      savedJasaLengkapIncludesInTotal: true,

      biayaJasaNembak: jasaNembakNom,
      jasaNembakEnabled: jasaNembakEn,
      jasaNembakIncludesInTotal: true,
      savedJasaNembakIncludesInTotal: true,

      biayaAntarJemput: antarJemputNom,
      antarJemputEnabled: antarJemputEn,
      antarJemputIncludesInTotal: true,
      savedAntarJemputIncludesInTotal: true,
      antarJemputMode,

      nominalSwdkllj: swdklljNom,
      swdklljEnabled: swdklljEn,
      swdklljIncludesInTotal: true,
      savedSwdklljIncludesInTotal: true,

      biayaLainnya,
      selectedComponents,
      componentIncludesInTotal,
      savedComponentIncludesInTotal,
    };
  };

  // Check unsaved changes
  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      samsat: samsatDraft,
    });
  }, [samsatDraft]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot) return false;
    return currentSnapshot !== initialSnapshot;
  }, [currentSnapshot, initialSnapshot]);

  // Canonical reference templates for active edit context
  const canonicalTemplateRef = useMemo(() => {
    if (!selectedItem?.layanan) return null;
    return getCanonicalTemplateRef(selectedItem.layanan, editVehicle);
  }, [selectedItem?.layanan, editVehicle]);

  const activeSamsatId = useMemo(() => {
    return resolveSamsatId(selectedItem?.wilayah || samsatDraft.wilayah);
  }, [selectedItem?.wilayah, samsatDraft.wilayah]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Action Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleEditClick = (item: any) => {
    setSelectedItem(item);
    setEditVehicle("Mobil");
    setSamsatActiveSection("biaya-layanan");
    setActiveSection("biaya-layanan");

    const sDraft = buildSamsatDraft(item);
    setSamsatDraft(sDraft);

    const mobilDraft = buildVehicleDraft(item.layanan, "Mobil");
    const motorDraft = buildVehicleDraft(item.layanan, "Motor");
    setVehicleDrafts({
      Mobil: mobilDraft,
      Motor: motorDraft,
    });

    const snapshot = JSON.stringify({
      samsat: sDraft,
    });
    setInitialSnapshot(snapshot);
    setIsEditDialogOpen(true);
  };

  const handleOpenGeneralRulesModal = () => {
    const currentLayanan = getCurrentLayanan();
    setEditVehicle("Mobil");
    setGeneralActiveSection("parameter");

    const mobilDraft = buildVehicleDraft(currentLayanan, "Mobil");
    const motorDraft = buildVehicleDraft(currentLayanan, "Motor");
    setVehicleDrafts({
      Mobil: mobilDraft,
      Motor: motorDraft,
    });

    const refRow = biayaData.find((r) => r.layanan === currentLayanan) || biayaData[0] || { wilayah: "Jakarta Timur", layanan: currentLayanan };
    setSelectedItem(refRow);
    const sDraft = buildSamsatDraft(refRow);
    setSamsatDraft(sDraft);

    setIsGeneralRulesOpen(true);
  };

  const isAddFormDirty = useMemo(() => {
    return Boolean(
      addFormData.wilayah ||
      addFormData.biayaJasaLengkap ||
      addFormData.biayaJasaNembak ||
      addFormData.biayaAntarJemput ||
      addFormData.nominalSwdkllj
    );
  }, [addFormData]);

  const handleCancelAddClick = () => {
    if (isAddFormDirty) {
      setIsDiscardDialogOpen(true);
    } else {
      setIsAddDialogOpen(false);
    }
  };

  const handleCancelClick = () => {
    if (hasUnsavedChanges) {
      setIsDiscardDialogOpen(true);
    } else {
      setIsEditDialogOpen(false);
    }
  };

  const handleConfirmDiscard = () => {
    setIsDiscardDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsAddDialogOpen(false);
  };

  const handleDeleteClick = (item: any) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedItem) return;
    try {
      await pricingStore.deleteBiayaLayananRow(selectedItem.id);
      setIsDeleteDialogOpen(false);
      toast.success("Biaya layanan berhasil dihapus!");
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus biaya layanan pada server.");
    }
  };

  // Toggle handlers for formula components (aktif otomatis masuk total)
  const handleToggleComponentActive = (vehicle: "Mobil" | "Motor", componentId: string) => {
    setVehicleDrafts((prev) => {
      const target = { ...prev[vehicle] };
      const comp = target.components.find((c) => c.id === componentId);
      if (!comp) return prev;

      const newActive = !comp.isActive;
      const newIncludes = newActive;

      target.components = target.components.map((c) =>
        c.id === componentId
          ? { ...c, isActive: newActive, includesInTotal: newIncludes }
          : c
      );

      return { ...prev, [vehicle]: target };
    });
  };

  const handleToggleComponentIncludesInTotal = (vehicle: "Mobil" | "Motor", componentId: string) => {
    setVehicleDrafts((prev) => {
      const target = { ...prev[vehicle] };
      target.components = target.components.map((c) => {
        if (c.id === componentId) {
          const nextVal = !c.includesInTotal;
          target.savedIncludesInTotal[componentId] = nextVal;
          return { ...c, includesInTotal: nextVal };
        }
        return c;
      });
      return { ...prev, [vehicle]: target };
    });
  };

  // Mutasi items toggle (aktif otomatis masuk total)
  const handleToggleSamsatComponent = (compId: string, _field: "isActive" | "includesInTotal" = "isActive") => {
    setSamsatDraft((prev) => {
      const nextActive = !prev.selectedComponents[compId];
      return {
        ...prev,
        selectedComponents: {
          ...prev.selectedComponents,
          [compId]: nextActive,
        },
        componentIncludesInTotal: {
          ...prev.componentIncludesInTotal,
          [compId]: nextActive,
        },
        savedComponentIncludesInTotal: {
          ...prev.savedComponentIncludesInTotal,
          [compId]: nextActive,
        },
      };
    });
  };

  // Handlers for dynamic Biaya Lainnya
  const handleAddBiayaLainnyaItem = () => {
    const newItem: BiayaLainnyaItemDraft = {
      id: `bl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      label: "",
      nominal: 0,
      enabled: true,
      includesInTotal: true,
      savedIncludesInTotal: true,
    };
    setSamsatDraft((prev) => ({
      ...prev,
      biayaLainnya: [...prev.biayaLainnya, newItem],
    }));
  };

  const handleUpdateBiayaLainnyaItem = (id: string, updates: Partial<BiayaLainnyaItemDraft>) => {
    setSamsatDraft((prev) => ({
      ...prev,
      biayaLainnya: prev.biayaLainnya.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }));
  };

  const handleDeleteBiayaLainnyaItem = (id: string) => {
    setSamsatDraft((prev) => ({
      ...prev,
      biayaLainnya: prev.biayaLainnya.filter((item) => item.id !== id),
    }));
  };

  // Unified Save Handler (Saves BOTH Mobil & Motor + Samsat fees)
  const handleSaveUnified = async () => {
    if (!selectedItem) return;

    const biayaJasaLengkapNum = parseInt(samsatDraft.biayaJasaLengkap) || 0;
    const biayaJasaNembakNum = parseInt(samsatDraft.biayaJasaNembak) || 0;
    const biayaAntarJemputNum = parseInt(samsatDraft.biayaAntarJemput) || 0;
    const swdklljNum = parseInt(samsatDraft.nominalSwdkllj) || 0;

    if (biayaJasaLengkapNum < 0 || biayaJasaNembakNum < 0 || biayaAntarJemputNum < 0 || swdklljNum < 0) {
      toast.error("Nominal biaya tidak boleh negatif!");
      return;
    }

    for (const bl of samsatDraft.biayaLainnya) {
      if (!bl.label.trim()) {
        toast.error("Nama Biaya Lainnya tidak boleh kosong!");
        return;
      }
      if (bl.nominal < 0) {
        toast.error("Nominal Biaya Lainnya tidak boleh negatif!");
        return;
      }
    }

    // 1. Update row in pricingStore
    const updatedRow: any = {
      ...selectedItem,
      biayaJasa: biayaJasaLengkapNum,
      biayaJasaLengkap: biayaJasaLengkapNum,
      jasaLengkapEnabled: samsatDraft.jasaLengkapEnabled,
      biayaPengurusanKhusus: biayaJasaNembakNum,
      biayaJasaNembak: biayaJasaNembakNum,
      pengurusanKhususEnabled: samsatDraft.jasaNembakEnabled,
      jasaNembakEnabled: samsatDraft.jasaNembakEnabled,
      biayaAntarJemput: biayaAntarJemputNum,
      antarJemputEnabled: samsatDraft.antarJemputEnabled,
      antarJemputMode: samsatDraft.antarJemputMode,
      opsenPkb: {
        nominal: swdklljNum,
        enabled: samsatDraft.swdklljEnabled,
      },
      swdkllj: {
        nominal: swdklljNum,
        enabled: samsatDraft.swdklljEnabled,
      },
      biayaLainnya: samsatDraft.biayaLainnya.map((b) => ({
        id: b.id,
        label: b.label.trim(),
        nominal: Number(b.nominal) || 0,
        enabled: b.enabled,
        includesInTotal: b.includesInTotal,
      })),
    };

    try {
      await pricingStore.updateBiayaLayananRow(selectedItem.id, updatedRow);

      // 2. Sync component toggles in pricingStore
      Object.entries(samsatDraft.selectedComponents).forEach(([compKey, enabled]) => {
        pricingStore.toggleComponent(selectedItem.layanan, selectedItem.wilayah, compKey, enabled);
      });

      // 3. Update authoritative ServiceFeeConfig in pricingStore
      pricingStore.updateServiceFeeConfig(selectedItem.layanan, selectedItem.wilayah, {
        biayaJasa: biayaJasaLengkapNum,
        jasaLengkap: {
          nominal: biayaJasaLengkapNum,
          enabled: samsatDraft.jasaLengkapEnabled,
        },
        biayaPengurusanKhusus: {
          nominal: biayaJasaNembakNum,
          enabled: samsatDraft.jasaNembakEnabled,
        },
        jasaNembak: {
          nominal: biayaJasaNembakNum,
          enabled: samsatDraft.jasaNembakEnabled,
        },
        biayaAntarJemput: biayaAntarJemputNum,
        antarJemputEnabled: samsatDraft.antarJemputEnabled,
        antarJemputMode: samsatDraft.antarJemputMode,
        opsenPkb: {
          nominal: swdklljNum,
          enabled: samsatDraft.swdklljEnabled,
        },
        swdkllj: {
          nominal: swdklljNum,
          enabled: samsatDraft.swdklljEnabled,
        },
        biayaLainnya: samsatDraft.biayaLainnya.map((b) => ({
          id: b.id,
          label: b.label.trim(),
          nominal: Number(b.nominal) || 0,
          enabled: b.enabled,
        })),
      });

      toast.success(`Tarif biaya layanan untuk ${selectedItem.wilayah} berhasil disimpan!`);
      setIsEditDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan perubahan ke server.");
    }
  };

  // Save Handler for General Rules Modal (Template Parameters & Mutasi Components)
  const handleSaveGeneralRules = () => {
    const currentLayanan = getCurrentLayanan();

    // 1. Save Mobil template params & components to estimationStore
    const mobilTplId = resolveTemplateIdByService(currentLayanan, "Mobil");
    const rawKoefMobil = parseFloat(vehicleDrafts.Mobil.koefDenda);
    const normalizedKoefMobil = isNaN(rawKoefMobil) ? 0.48 : (rawKoefMobil > 1 ? rawKoefMobil / 100 : rawKoefMobil);

    estimationStore.updateTemplateParams(mobilTplId, {
      koefisienDenda: normalizedKoefMobil,
      pembagiBulan: parseInt(vehicleDrafts.Mobil.pembagiBulan) || 12,
      kelipatanPembulatan: parseInt(vehicleDrafts.Mobil.kelipatanPembulatan) || 1000,
      swdklljPokok: parseInt(vehicleDrafts.Mobil.swdklljPokok) || 0,
      dendaSwdklljPokok: parseInt(vehicleDrafts.Mobil.dendaSwdkllj) || 0,
      biayaCetakSkp: parseInt(vehicleDrafts.Mobil.biayaCetakSkp) || 0,
      adminStnk: parseInt(vehicleDrafts.Mobil.adminStnk) || 0,
      adminTnkb: parseInt(vehicleDrafts.Mobil.adminTnkb) || 0,
    });
    const activeMobilTpl = estimationStore.getTemplate(mobilTplId);
    if (activeMobilTpl) {
      activeMobilTpl.components = vehicleDrafts.Mobil.components.map((c) => ({ ...c }));
      estimationStore.updateTemplate(activeMobilTpl);
    }

    // 2. Save Motor template params & components to estimationStore
    const motorTplId = resolveTemplateIdByService(currentLayanan, "Motor");
    const rawKoefMotor = parseFloat(vehicleDrafts.Motor.koefDenda);
    const normalizedKoefMotor = isNaN(rawKoefMotor) ? 0.48 : (rawKoefMotor > 1 ? rawKoefMotor / 100 : rawKoefMotor);

    estimationStore.updateTemplateParams(motorTplId, {
      koefisienDenda: normalizedKoefMotor,
      pembagiBulan: parseInt(vehicleDrafts.Motor.pembagiBulan) || 12,
      kelipatanPembulatan: parseInt(vehicleDrafts.Motor.kelipatanPembulatan) || 1000,
      swdklljPokok: parseInt(vehicleDrafts.Motor.swdklljPokok) || 0,
      dendaSwdklljPokok: parseInt(vehicleDrafts.Motor.dendaSwdkllj) || 0,
      biayaCetakSkp: parseInt(vehicleDrafts.Motor.biayaCetakSkp) || 0,
      adminStnk: parseInt(vehicleDrafts.Motor.adminStnk) || 0,
      adminTnkb: parseInt(vehicleDrafts.Motor.adminTnkb) || 0,
    });
    const activeMotorTpl = estimationStore.getTemplate(motorTplId);
    if (activeMotorTpl) {
      activeMotorTpl.components = vehicleDrafts.Motor.components.map((c) => ({ ...c }));
      estimationStore.updateTemplate(activeMotorTpl);
    }

    // 3. Sync Mutasi components to all Samsats for this service
    pricingStore.applyConfigToAllSamsats(
      currentLayanan,
      {
        biayaJasaLengkap: 0,
        jasaLengkapEnabled: true,
        biayaJasaNembak: 0,
        jasaNembakEnabled: false,
        biayaAntarJemput: 0,
        antarJemputEnabled: true,
        nominalSwdkllj: 0,
        swdklljEnabled: true,
        components: samsatDraft.selectedComponents,
      },
      {
        applyBiayaLayanan: false,
        applyBiayaTambahan: false,
        applyKomponenSamsat: true,
        applyBiayaLainnya: false,
        applyAturanEstimasi: true,
      }
    );

    setIsGeneralRulesOpen(false);
    toast.success(`Aturan estimasi & komponen general untuk ${currentLayanan} berhasil disimpan ke seluruh Samsat!`);
  };

  // Apply to All Samsat Handler (Tarif operasional: Jasa, Kurir, & Biaya Lainnya/Kustom)
  const handleApplyAllConfirm = async () => {
    if (!selectedItem) return;

    const biayaJasaLengkapNum = parseInt(samsatDraft.biayaJasaLengkap) || 0;
    const biayaJasaNembakNum = parseInt(samsatDraft.biayaJasaNembak) || 0;
    const biayaAntarJemputNum = parseInt(samsatDraft.biayaAntarJemput) || 0;
    const swdklljNum = parseInt(samsatDraft.nominalSwdkllj) || 0;

    setIsApplyingAll(true);
    try {
      // Apply fee settings to all Samsats with field-level merge and policy
      const result = await pricingStore.applyConfigToAllSamsats(
        selectedItem.layanan,
        {
          biayaJasaLengkap: biayaJasaLengkapNum,
          jasaLengkapEnabled: samsatDraft.jasaLengkapEnabled,
          biayaJasaNembak: biayaJasaNembakNum,
          jasaNembakEnabled: samsatDraft.jasaNembakEnabled,
          biayaAntarJemput: biayaAntarJemputNum,
          antarJemputEnabled: samsatDraft.antarJemputEnabled,
          antarJemputMode: samsatDraft.antarJemputMode,
          nominalSwdkllj: swdklljNum,
          swdklljEnabled: samsatDraft.swdklljEnabled,
          biayaLainnya: samsatDraft.biayaLainnya.map((b) => ({
            id: b.id,
            label: b.label.trim(),
            nominal: Number(b.nominal) || 0,
            enabled: b.enabled,
            includesInTotal: b.enabled,
          })),
        },
        {
          applyBiayaLayanan: applyAllScope.applyBiayaLayanan,
          applyBiayaTambahan: applyAllScope.applyBiayaTambahan,
          applyKomponenSamsat: false,
          applyBiayaLainnya: applyAllScope.applyBiayaLainnya,
          applyAturanEstimasi: false,
        },
        applyAllPolicy
      );

      setIsApplyAllDialogOpen(false);
      setIsEditDialogOpen(false);

      if (applyAllPolicy === "PRESERVE_EXISTING_CUSTOM") {
        if (result && result.preservedCount > 0) {
          toast.success(
            `Berhasil menerapkan tarif ke ${result.updatedCount} Samsat! (${result.preservedCount} kantor bertarif khusus tetap dipertahankan)`
          );
        } else {
          toast.success(
            `Berhasil menerapkan tarif ke ${result?.updatedCount || 515} Samsat untuk ${selectedItem.layanan}!`
          );
        }
      } else {
        toast.success(
          `Berhasil menimpa seluruh ${result?.updatedCount || result?.totalCount || 515} Samsat untuk ${selectedItem.layanan}!`
        );
      }
    } catch (err: any) {
      console.error("[BiayaLayanan] handleApplyAllConfirm error:", err);
      toast.error(`Gagal menerapkan tarif massal: ${err?.message || "Terjadi kesalahan sistem"}`);
    } finally {
      setIsApplyingAll(false);
    }
  };

  // Add Dialog Submit Handler
  const handleAddSubmit = async () => {
    if (!addFormData.wilayah) {
      toast.error("Harap pilih wilayah Samsat!");
      return;
    }

    const biayaJasaLengkapNum = parseInt(addFormData.biayaJasaLengkap) || 0;
    const biayaJasaNembakNum = parseInt(addFormData.biayaJasaNembak) || 0;
    const biayaAntarJemputNum = parseInt(addFormData.biayaAntarJemput) || 0;
    const swdklljNum = parseInt(addFormData.nominalSwdkllj) || 0;

    if (biayaJasaLengkapNum < 0 || biayaJasaNembakNum < 0 || biayaAntarJemputNum < 0 || swdklljNum < 0) {
      toast.error("Nominal biaya tidak boleh negatif!");
      return;
    }

    for (const bl of addFormData.biayaLainnya) {
      if (!bl.label.trim()) {
        toast.error("Nama Biaya Lainnya tidak boleh kosong!");
        return;
      }
      if (bl.nominal < 0) {
        toast.error("Nominal Biaya Lainnya tidak boleh negatif!");
        return;
      }
    }

    const newItem: any = {
      id: Math.max(...biayaData.map((item) => Number(item.id) || 0), 0) + 1,
      layanan: getCurrentLayanan(),
      wilayah: addFormData.wilayah,
      biayaJasa: biayaJasaLengkapNum,
      biayaJasaLengkap: biayaJasaLengkapNum,
      jasaLengkapEnabled: addFormData.jasaLengkapEnabled,
      biayaPengurusanKhusus: biayaJasaNembakNum,
      biayaJasaNembak: biayaJasaNembakNum,
      pengurusanKhususEnabled: addFormData.jasaNembakEnabled,
      jasaNembakEnabled: addFormData.jasaNembakEnabled,
      biayaAntarJemput: biayaAntarJemputNum,
      antarJemputEnabled: addFormData.antarJemputEnabled,
      antarJemputMode: addFormData.antarJemputMode,
      opsenPkb: {
        nominal: swdklljNum,
        enabled: addFormData.swdklljEnabled,
      },
      swdkllj: {
        nominal: swdklljNum,
        enabled: addFormData.swdklljEnabled,
      },
      biayaLainnya: addFormData.biayaLainnya.map((b) => ({
        id: b.id,
        label: b.label.trim(),
        nominal: Number(b.nominal) || 0,
        enabled: b.enabled,
      })),
    };

    try {
      await pricingStore.addBiayaLayananRow(newItem);

      Object.entries(addSelectedComponents).forEach(([compKey, enabled]) => {
        pricingStore.toggleComponent(getCurrentLayanan(), addFormData.wilayah, compKey, enabled);
      });

      pricingStore.updateServiceFeeConfig(getCurrentLayanan(), addFormData.wilayah, {
        biayaJasa: biayaJasaLengkapNum,
        jasaLengkap: {
          nominal: biayaJasaLengkapNum,
          enabled: addFormData.jasaLengkapEnabled,
        },
        biayaPengurusanKhusus: {
          nominal: biayaJasaNembakNum,
          enabled: addFormData.jasaNembakEnabled,
        },
        jasaNembak: {
          nominal: biayaJasaNembakNum,
          enabled: addFormData.jasaNembakEnabled,
        },
        biayaAntarJemput: biayaAntarJemputNum,
        antarJemputEnabled: addFormData.antarJemputEnabled,
        antarJemputMode: addFormData.antarJemputMode,
        opsenPkb: {
          nominal: swdklljNum,
          enabled: addFormData.swdklljEnabled,
        },
        swdkllj: {
          nominal: swdklljNum,
          enabled: addFormData.swdklljEnabled,
        },
        biayaLainnya: addFormData.biayaLainnya.map((b) => ({
          id: b.id,
          label: b.label.trim(),
          nominal: Number(b.nominal) || 0,
          enabled: b.enabled,
        })),
      });

      setIsAddDialogOpen(false);
      toast.success("Biaya layanan berhasil ditambahkan!");
    } catch (err: any) {
      toast.error(err.message || "Gagal menambahkan biaya layanan ke server.");
    }
  };

  const handleAddClick = () => {
    const currentServiceId = resolveServiceId(getCurrentLayanan());
    const config = pricingStore.getServiceFeeConfig(currentServiceId, "samsat-jakarta-timur");

    setAddFormData({
      wilayah: "Jakarta Timur",
      biayaJasaLengkap: (config?.jasaLengkap?.nominal ?? config?.biayaJasa ?? 500000).toString(),
      jasaLengkapEnabled: config?.jasaLengkap?.enabled ?? true,
      biayaJasaNembak: (config?.biayaPengurusanKhusus?.nominal ?? config?.jasaNembak?.nominal ?? 300000).toString(),
      jasaNembakEnabled: config?.biayaPengurusanKhusus?.enabled ?? config?.jasaNembak?.enabled ?? false,
      biayaAntarJemput: (config?.biayaAntarJemput ?? 50000).toString(),
      antarJemputEnabled: config?.antarJemputEnabled ?? true,
      antarJemputMode: (config?.antarJemputMode || "Antar & Jemput") as "Antar & Jemput" | "Antar Saja" | "Jemput Saja",
      nominalSwdkllj: (config?.opsenPkb?.nominal ?? config?.swdkllj?.nominal ?? 143000).toString(),
      swdklljEnabled: config?.opsenPkb?.enabled ?? config?.swdkllj?.enabled ?? true,
      biayaLainnya: (config?.biayaLainnya || []).map((b) => ({
        id: b.id,
        label: b.label || "",
        nominal: b.nominal || 0,
        enabled: b.enabled,
      })),
    });

    const compMap: Record<string, boolean> = {};
    const masterItems = pricingStore.getMasterPricingItems();
    masterItems.forEach((c) => {
      const found = config?.components.find((sc) => sc.pricingItemId === c.id);
      compMap[c.id] = found ? found.enabled : false;
    });
    setAddSelectedComponents(compMap);
    setIsAddDialogOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Dynamic Calculation Breakdown for Section 7 (Ringkasan Estimasi)
  // ─────────────────────────────────────────────────────────────────────────────

  const estimationSummaryData = useMemo(() => {
    const targetWilayah = selectedItem?.wilayah || samsatDraft.wilayah || "Jakarta Timur";
    const samsatId = resolveSamsatId(targetWilayah);
    const currentVehicleDraft = vehicleDrafts[editVehicle];

    const items: Array<{
      id: string;
      category: string;
      name: string;
      code?: string;
      nominal: number;
      isActive: boolean;
      includesInTotal: boolean;
      description?: string;
    }> = [];

    // 1. Jasa Standar
    const jasaLengkapNom = parseInt(samsatDraft.biayaJasaLengkap) || 0;
    items.push({
      id: "jasa-standar",
      category: "JASA",
      name: "Biaya Jasa (Standar)",
      code: "JASA-01",
      nominal: jasaLengkapNom,
      isActive: samsatDraft.jasaLengkapEnabled,
      includesInTotal: samsatDraft.jasaLengkapIncludesInTotal,
      description: "Proses standar pengurusan dokumen",
    });

    // 2. Jasa Khusus (Nembak)
    const jasaNembakNom = parseInt(samsatDraft.biayaJasaNembak) || 0;
    items.push({
      id: "jasa-khusus",
      category: "JASA",
      name: "Biaya Pengurusan Khusus",
      code: "JASA-02",
      nominal: jasaNembakNom,
      isActive: samsatDraft.jasaNembakEnabled,
      includesInTotal: samsatDraft.jasaNembakIncludesInTotal,
      description: "Penanganan kondisi atau berkas khusus",
    });

    // 3. Antar Jemput
    const antarJemputNom = parseInt(samsatDraft.biayaAntarJemput) || 0;
    items.push({
      id: "antar-jemput",
      category: "ADMIN",
      name: `Biaya Antar & Jemput (${samsatDraft.antarJemputMode})`,
      code: "OPR-01",
      nominal: antarJemputNom,
      isActive: samsatDraft.antarJemputEnabled,
      includesInTotal: samsatDraft.antarJemputIncludesInTotal,
      description: "Kurir penjemputan dan pengantaran berkas",
    });

    // 4. OPSEN PKB
    const swdklljNom = parseInt(samsatDraft.nominalSwdkllj) || 0;
    items.push({
      id: "opsen-pkb",
      category: "PKB",
      name: "OPSEN PKB",
      code: "PKB-OPS",
      nominal: swdklljNom,
      isActive: samsatDraft.swdklljEnabled,
      includesInTotal: samsatDraft.swdklljIncludesInTotal,
      description: "Pajak opsen daerah",
    });

    // 5. Mutasi Masuk (Mengikuti Tarif Standar Nasional Sesuai Ketetapan)
    const masterItems = pricingStore.getMasterPricingItems();
    masterItems
      .filter((i) => i.category === "Mutasi Masuk")
      .forEach((comp) => {
        const isAct = !!samsatDraft.selectedComponents[comp.id];
        const isInc = samsatDraft.componentIncludesInTotal[comp.id] ?? true;
        const price = pricingStore.getNationalDefaultPrice(comp.id);
        items.push({
          id: comp.id,
          category: "Mutasi Masuk",
          name: comp.name,
          code: comp.code,
          nominal: price,
          isActive: isAct,
          includesInTotal: isInc,
        });
      });

    // 6. Mutasi Keluar (Mengikuti Tarif Standar Nasional Sesuai Ketetapan)
    masterItems
      .filter((i) => i.category === "Mutasi Keluar")
      .forEach((comp) => {
        const isAct = !!samsatDraft.selectedComponents[comp.id];
        const isInc = samsatDraft.componentIncludesInTotal[comp.id] ?? true;
        const price = pricingStore.getNationalDefaultPrice(comp.id);
        items.push({
          id: comp.id,
          category: "Mutasi Keluar",
          name: comp.name,
          code: comp.code,
          nominal: price,
          isActive: isAct,
          includesInTotal: isInc,
        });
      });

    // 7. Biaya Lainnya
    samsatDraft.biayaLainnya.forEach((bl) => {
      items.push({
        id: bl.id,
        category: "LAINNYA",
        name: bl.label || "Biaya Lainnya",
        nominal: bl.nominal || 0,
        isActive: bl.enabled,
        includesInTotal: bl.includesInTotal,
      });
    });

    // 8. Fixed component parameters from template
    const swdklljPokokNom = parseInt(currentVehicleDraft.swdklljPokok) || 0;
    if (swdklljPokokNom > 0) {
      const compRule = currentVehicleDraft.components.find((c) => c.ruleId === "SWDKLLJ_POKOK");
      items.push({
        id: "swdkllj-pokok",
        category: "SWDKLLJ",
        name: `SWDKLLJ Pokok (${editVehicle})`,
        code: "SWD-01",
        nominal: swdklljPokokNom,
        isActive: compRule ? compRule.isActive : true,
        includesInTotal: compRule ? compRule.includesInTotal : true,
      });
    }

    const cetakSkpNom = parseInt(currentVehicleDraft.biayaCetakSkp) || 0;
    if (cetakSkpNom > 0) {
      const compRule = currentVehicleDraft.components.find((c) => c.ruleId === "BIAYA_CETAK_SKP");
      items.push({
        id: "cetak-skp",
        category: "ADMIN",
        name: `Biaya Cetak SKP (${editVehicle})`,
        code: "ADM-SKP",
        nominal: cetakSkpNom,
        isActive: compRule ? compRule.isActive : true,
        includesInTotal: compRule ? compRule.includesInTotal : true,
      });
    }

    if (hasAdminStnkTnkb(selectedItem?.layanan)) {
      const stnkNom = parseInt(currentVehicleDraft.adminStnk) || 0;
      if (stnkNom > 0) {
        items.push({
          id: "admin-stnk",
          category: "ADMIN",
          name: `Admin STNK PNBP (${editVehicle})`,
          code: "ADM-STNK",
          nominal: stnkNom,
          isActive: true,
          includesInTotal: true,
        });
      }
      const tnkbNom = parseInt(currentVehicleDraft.adminTnkb) || 0;
      if (tnkbNom > 0) {
        items.push({
          id: "admin-tnkb",
          category: "ADMIN",
          name: `Admin TNKB / Plat PNBP (${editVehicle})`,
          code: "ADM-TNKB",
          nominal: tnkbNom,
          isActive: true,
          includesInTotal: true,
        });
      }
    }

    const activeItems = items.filter((i) => i.isActive);
    const includedItems = activeItems.filter((i) => i.includesInTotal);
    const excludedItems = activeItems.filter((i) => !i.includesInTotal);
    const grandTotal = includedItems.reduce((acc, curr) => acc + curr.nominal, 0);

    return {
      allItems: items,
      activeItems,
      includedItems,
      excludedItems,
      totalActiveCount: activeItems.length,
      includedCount: includedItems.length,
      excludedCount: excludedItems.length,
      grandTotal,
    };
  }, [samsatDraft, vehicleDrafts, editVehicle, selectedItem]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render Individual Unified Editor Sections
  // ─────────────────────────────────────────────────────────────────────────────

  const renderSectionParameter = () => {
    const draft = vehicleDrafts[editVehicle];

    const updateVehicleDraft = (field: keyof VehicleFormulaDraft, value: string) => {
      setVehicleDrafts((prev) => ({
        ...prev,
        [editVehicle]: {
          ...prev[editVehicle],
          [field]: value,
        },
      }));
    };

    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            Parameter Rumus & Aturan Estimasi — Kendaraan {editVehicle} ({editVehicle === "Mobil" ? "R4" : "R2"})
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Atur parameter koefisien perhitungan denda, pembulatan, dan aktivasi komponen kalkulator untuk kendaraan {editVehicle}.
          </p>
        </div>

        {/* Parameter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Koefisien Denda PKB */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
            <Label className="text-xs font-semibold text-foreground/90">Koefisien Denda PKB (% / thn)</Label>
            <div className="relative">
              <Input
                className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border pr-7"
                type="number"
                value={draft.koefDenda}
                onChange={(e) => updateVehicleDraft("koefDenda", e.target.value)}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
            </div>
          </div>

          {/* Pembagi Bulan Denda */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
            <Label className="text-xs font-semibold text-foreground/90">Pembagi Bulan Denda</Label>
            <Input
              className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
              type="number"
              value={draft.pembagiBulan}
              onChange={(e) => updateVehicleDraft("pembagiBulan", e.target.value)}
            />
          </div>

          {/* Kelipatan Pembulatan */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
            <Label className="text-xs font-semibold text-foreground/90">Kelipatan Pembulatan (Rp)</Label>
            <Input
              className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
              type="number"
              value={draft.kelipatanPembulatan}
              onChange={(e) => updateVehicleDraft("kelipatanPembulatan", e.target.value)}
            />
          </div>

          {/* SWDKLLJ Pokok */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
            <Label className="text-xs font-semibold text-foreground/90">SWDKLLJ Pokok (Rp)</Label>
            <Input
              className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
              type="number"
              value={draft.swdklljPokok}
              onChange={(e) => updateVehicleDraft("swdklljPokok", e.target.value)}
            />
          </div>

          {/* Denda SWDKLLJ Pokok */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
            <Label className="text-xs font-semibold text-foreground/90">Denda SWDKLLJ Pokok (Rp)</Label>
            <Input
              className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
              type="number"
              value={draft.dendaSwdkllj}
              onChange={(e) => updateVehicleDraft("dendaSwdkllj", e.target.value)}
            />
          </div>

          {/* Biaya Cetak SKP */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
            <Label className="text-xs font-semibold text-foreground/90">Biaya Cetak SKP (Rp)</Label>
            <Input
              className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
              type="number"
              value={draft.biayaCetakSkp}
              onChange={(e) => updateVehicleDraft("biayaCetakSkp", e.target.value)}
            />
          </div>

          {/* Admin STNK & TNKB if applicable */}
          {hasAdminStnkTnkb(selectedItem?.layanan) && (
            <>
              <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
                <Label className="text-xs font-semibold text-foreground/90">Admin STNK (PNBP Rp)</Label>
                <Input
                  className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
                  type="number"
                  value={draft.adminStnk}
                  onChange={(e) => updateVehicleDraft("adminStnk", e.target.value)}
                />
              </div>

              <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
                <Label className="text-xs font-semibold text-foreground/90">Admin TNKB / Plat (PNBP Rp)</Label>
                <Input
                  className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
                  type="number"
                  value={draft.adminTnkb}
                  onChange={(e) => updateVehicleDraft("adminTnkb", e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Aturan Komponen Biaya Estimasi List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Aturan Komponen Biaya Estimasi ({draft.components.length} Komponen)
              </h5>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Kelola komponen yang diaktifkan dalam kalkulasi serta yang diikutsertakan ke dalam Grand Total estimasi {editVehicle}.
              </p>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {draft.components.filter((c) => c.isActive).length} Aktif
            </span>
          </div>

          <div className="border border-border/80 rounded-lg overflow-hidden bg-card divide-y divide-border/60">
            {draft.components.map((comp) => (
              <div
                key={comp.id}
                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-muted/20 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground text-xs">{comp.name}</span>
                    <Badge variant="outline" className={cn("text-[9px] px-1 py-0", getCategoryBadgeClass(comp.category))}>
                      {comp.category}
                    </Badge>
                    <span className="text-[9px] font-mono text-muted-foreground">{comp.code}</span>
                  </div>
                  {comp.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {sanitizeComponentDescription(comp.description)}
                    </p>
                  )}
                </div>

                <ComponentStatusControls
                  isActive={comp.isActive}
                  includesInTotal={comp.includesInTotal}
                  onToggleActive={() => handleToggleComponentActive(editVehicle, comp.id)}
                  onToggleIncludesInTotal={() => handleToggleComponentIncludesInTotal(editVehicle, comp.id)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSectionBiayaLayanan = () => {
    return (
      <div className="space-y-2.5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-primary" />
            Biaya Layanan — Tarif Jasa Samsat
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Kelola tarif jasa standar biro dan biaya pengurusan dokumen khusus untuk wilayah {samsatDraft.wilayah}.
          </p>
        </div>

        {/* 1. Jasa Standar */}
        <div className="p-3 rounded-lg border border-border/70 bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <Label className="text-xs font-semibold text-foreground">
                Biaya Jasa (Standar)
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Tarif standar pengurusan berkas di Samsat {samsatDraft.wilayah}.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1 focus-within:ring-1 focus-within:ring-primary">
                <span className="text-[11px] text-muted-foreground font-medium">Rp</span>
                <input
                  className="w-28 text-xs font-mono tabular-nums text-right bg-transparent border-0 focus:outline-hidden"
                  type="number"
                  placeholder="500000"
                  value={samsatDraft.biayaJasaLengkap}
                  onChange={(e) => setSamsatDraft({ ...samsatDraft, biayaJasaLengkap: e.target.value })}
                />
              </div>
              <ComponentStatusControls
                isActive={samsatDraft.jasaLengkapEnabled}
                onToggleActive={() => {
                  const nextAct = !samsatDraft.jasaLengkapEnabled;
                  setSamsatDraft((prev) => ({
                    ...prev,
                    jasaLengkapEnabled: nextAct,
                    jasaLengkapIncludesInTotal: nextAct,
                    savedJasaLengkapIncludesInTotal: nextAct,
                  }));
                }}
              />
            </div>
          </div>
        </div>

        {/* 2. Biaya Pengurusan Khusus (Jasa Nembak) */}
        <div className="p-3 rounded-lg border border-border/70 bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <Label className="text-xs font-semibold text-foreground">
                Biaya Pengurusan Khusus
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Penanganan berkas tanpa KTP asli atau kondisi administrasi khusus.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1 focus-within:ring-1 focus-within:ring-primary">
                <span className="text-[11px] text-muted-foreground font-medium">Rp</span>
                <input
                  className="w-28 text-xs font-mono tabular-nums text-right bg-transparent border-0 focus:outline-hidden"
                  type="number"
                  placeholder="300000"
                  value={samsatDraft.biayaJasaNembak}
                  onChange={(e) => setSamsatDraft({ ...samsatDraft, biayaJasaNembak: e.target.value })}
                />
              </div>
              <ComponentStatusControls
                isActive={samsatDraft.jasaNembakEnabled}
                onToggleActive={() => {
                  const nextAct = !samsatDraft.jasaNembakEnabled;
                  setSamsatDraft((prev) => ({
                    ...prev,
                    jasaNembakEnabled: nextAct,
                    jasaNembakIncludesInTotal: nextAct,
                    savedJasaNembakIncludesInTotal: nextAct,
                  }));
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSectionBiayaTambahan = () => {
    return (
      <div className="space-y-2.5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-primary" />
            Biaya Tambahan — Kurir Antar-Jemput & OPSEN PKB
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Konfigurasi tarif operasional pengantaran berkas serta OPSEN PKB daerah.
          </p>
        </div>

        {/* 1. Biaya Antar Jemput */}
        <div className="p-3 rounded-lg border border-border/70 bg-card space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <Label className="text-xs font-semibold text-foreground">
                Biaya Antar & Jemput Berkas
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Tarif jasa kurir penjemputan dan pengantaran dokumen ke alamat klien.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1 focus-within:ring-1 focus-within:ring-primary">
                <span className="text-[11px] text-muted-foreground font-medium">Rp</span>
                <input
                  className="w-28 text-xs font-mono tabular-nums text-right bg-transparent border-0 focus:outline-hidden"
                  type="number"
                  placeholder="50000"
                  value={samsatDraft.biayaAntarJemput}
                  onChange={(e) => setSamsatDraft({ ...samsatDraft, biayaAntarJemput: e.target.value })}
                />
              </div>
              <ComponentStatusControls
                isActive={samsatDraft.antarJemputEnabled}
                onToggleActive={() => {
                  const nextAct = !samsatDraft.antarJemputEnabled;
                  setSamsatDraft((prev) => ({
                    ...prev,
                    antarJemputEnabled: nextAct,
                    antarJemputIncludesInTotal: nextAct,
                    savedAntarJemputIncludesInTotal: nextAct,
                  }));
                }}
              />
            </div>
          </div>

          {/* Mode Selector 3 Opsi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-0.5">
            {(["Antar & Jemput", "Antar Saja", "Jemput Saja"] as const).map((mode) => (
              <label
                key={mode}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs cursor-pointer transition-colors select-none",
                  samsatDraft.antarJemputMode === mode
                    ? "bg-primary/10 border-primary/40 font-semibold text-foreground"
                    : "bg-background border-border text-muted-foreground hover:bg-muted/40"
                )}
              >
                <input
                  type="radio"
                  name="antarJemputMode"
                  value={mode}
                  checked={samsatDraft.antarJemputMode === mode}
                  onChange={() => setSamsatDraft({ ...samsatDraft, antarJemputMode: mode })}
                  className="text-primary focus:ring-primary h-3 w-3"
                />
                <span className="text-[11px]">{mode}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 2. OPSEN PKB */}
        <div className="p-3 rounded-lg border border-border/70 bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <Label className="text-xs font-semibold text-foreground">
                OPSEN PKB (Pajak Daerah)
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Komponen opsen pajak daerah yang dihitung bersamaan dengan PKB.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1 focus-within:ring-1 focus-within:ring-primary">
                <span className="text-[11px] text-muted-foreground font-medium">Rp</span>
                <input
                  className="w-28 text-xs font-mono tabular-nums text-right bg-transparent border-0 focus:outline-hidden"
                  type="number"
                  placeholder="143000"
                  value={samsatDraft.nominalSwdkllj}
                  onChange={(e) => setSamsatDraft({ ...samsatDraft, nominalSwdkllj: e.target.value })}
                />
              </div>
              <ComponentStatusControls
                isActive={samsatDraft.swdklljEnabled}
                onToggleActive={() => {
                  const nextAct = !samsatDraft.swdklljEnabled;
                  setSamsatDraft((prev) => ({
                    ...prev,
                    swdklljEnabled: nextAct,
                    swdklljIncludesInTotal: nextAct,
                    savedSwdklljIncludesInTotal: nextAct,
                  }));
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSectionMutasiMasuk = () => {
    const masterItems = pricingStore.getMasterPricingItems().filter((i) => i.category === "Mutasi Masuk");
    const activeCount = masterItems.filter((i) => !!samsatDraft.selectedComponents[i.id]).length;

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
              Komponen Standar — Mutasi Masuk
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Komponen biaya pendaftaran, loket, dan administrasi mutasi masuk (mengikuti tarif standar nasional seragam).
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant="outline" className="text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
              Harga Standar Nasional
            </Badge>
            <Badge variant="outline" className="text-xs font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              {activeCount} dari {masterItems.length} Aktif
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {masterItems.map((comp) => {
            const price = pricingStore.getNationalDefaultPrice(comp.id);
            const isChecked = !!samsatDraft.selectedComponents[comp.id];

            return (
              <div
                key={comp.id}
                className={cn(
                  "p-3 rounded-lg border transition-all space-y-2.5",
                  isChecked
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-card border-border/70 opacity-80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs text-foreground truncate">{comp.name}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                        {comp.code}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                        Standar Nasional
                      </Badge>
                    </div>
                    <p className="text-xs font-mono font-medium text-foreground/80 mt-1">
                      Harga Standar: Rp {price.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <ComponentStatusControls
                    isActive={isChecked}
                    onToggleActive={() => handleToggleSamsatComponent(comp.id, "isActive")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSectionMutasiKeluar = () => {
    const masterItems = pricingStore.getMasterPricingItems().filter((i) => i.category === "Mutasi Keluar");
    const activeCount = masterItems.filter((i) => !!samsatDraft.selectedComponents[i.id]).length;

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-blue-500" />
              Komponen Standar — Mutasi Keluar
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Komponen biaya cek fisik, arsip, fiskal, dan pendaftaran mutasi keluar (mengikuti tarif standar nasional seragam).
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant="outline" className="text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
              Harga Standar Nasional
            </Badge>
            <Badge variant="outline" className="text-xs font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
              {activeCount} dari {masterItems.length} Aktif
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {masterItems.map((comp) => {
            const price = pricingStore.getNationalDefaultPrice(comp.id);
            const isChecked = !!samsatDraft.selectedComponents[comp.id];

            return (
              <div
                key={comp.id}
                className={cn(
                  "p-3 rounded-lg border transition-all space-y-2.5",
                  isChecked
                    ? "bg-blue-500/5 border-blue-500/30"
                    : "bg-card border-border/70 opacity-80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs text-foreground truncate">{comp.name}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                        {comp.code}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
                        Standar Nasional
                      </Badge>
                    </div>
                    <p className="text-xs font-mono font-medium text-foreground/80 mt-1">
                      Harga Standar: Rp {price.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <ComponentStatusControls
                    isActive={isChecked}
                    onToggleActive={() => handleToggleSamsatComponent(comp.id, "isActive")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSectionBiayaLainnya = () => {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Biaya Lainnya (Komponen Kustom)
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tambahkan biaya kustom spesifik (misal: materai, legalisir khusus, atau biaya ekstra per wilayah).
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddBiayaLainnyaItem}
            className="h-7 text-xs px-2.5 gap-1 border-primary/40 text-primary hover:bg-primary/10 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Biaya</span>
          </Button>
        </div>

        {samsatDraft.biayaLainnya.length === 0 ? (
          <div className="p-4 text-center border border-dashed border-border/80 rounded-lg bg-muted/10 space-y-1">
            <FileText className="w-6 h-6 text-muted-foreground/50 mx-auto" />
            <p className="text-xs font-medium text-foreground">Belum ada Biaya Lainnya</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Gunakan tombol &quot;Tambah Biaya&quot; di atas untuk mendefinisikan biaya operasional kustom yang berlaku pada Samsat {samsatDraft.wilayah}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {samsatDraft.biayaLainnya.map((bl) => (
              <div
                key={bl.id}
                className="p-2.5 rounded-lg border border-border/70 bg-card"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Nama Biaya (contoh: Biaya Materai & Legalisir)"
                      value={bl.label}
                      onChange={(e) => handleUpdateBiayaLainnyaItem(bl.id, { label: e.target.value })}
                      className="h-8 text-xs bg-background"
                    />
                    <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1 focus-within:ring-1 focus-within:ring-primary h-8">
                      <span className="text-[11px] text-muted-foreground font-medium">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={bl.nominal || ""}
                        onChange={(e) =>
                          handleUpdateBiayaLainnyaItem(bl.id, {
                            nominal: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full text-xs font-mono tabular-nums text-right bg-transparent border-0 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                    <ComponentStatusControls
                      isActive={bl.enabled}
                      onToggleActive={() => {
                        const nextEn = !bl.enabled;
                        handleUpdateBiayaLainnyaItem(bl.id, {
                          enabled: nextEn,
                          includesInTotal: nextEn,
                          savedIncludesInTotal: nextEn,
                        });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBiayaLainnyaItem(bl.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"
                      title="Hapus biaya lainnya"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  const renderSectionRingkasan = () => {
    const { activeItems, totalActiveCount, includedCount, excludedCount, grandTotal } = estimationSummaryData;

    return (
      <div className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Ringkasan Estimasi Biaya Layanan — {selectedItem?.layanan || getCurrentLayanan()} ({editVehicle})
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pratinjau langsung seluruh komponen yang aktif serta simulasi kalkulasi Grand Total estimasi (komponen Mutasi Masuk & Mutasi Keluar mengikuti tarif standar nasional).
          </p>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3.5 border border-border/80 bg-card space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Komponen Aktif</p>
            <p className="text-xl font-bold font-mono tabular-nums text-foreground">{totalActiveCount}</p>
            <p className="text-[10px] text-muted-foreground">Dalam simulasi kalkulasi</p>
          </Card>

          <Card className="p-3.5 border border-border/80 bg-card space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Masuk Grand Total</p>
            <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{includedCount}</p>
            <p className="text-[10px] text-muted-foreground">Ditagihkan ke klien</p>
          </Card>

          <Card className="p-3.5 border border-border/80 bg-card space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Komponen Dipisah</p>
            <p className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">{excludedCount}</p>
            <p className="text-[10px] text-muted-foreground">Opsional / informatif</p>
          </Card>

          <Card className="p-3.5 border border-primary/30 bg-primary/5 space-y-1">
            <p className="text-[11px] font-medium text-primary">Grand Total Layanan</p>
            <p className="text-xl font-bold font-mono tabular-nums text-foreground">
              Rp {grandTotal.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-muted-foreground">{editVehicle} • {selectedItem?.layanan}</p>
          </Card>
        </div>

        {/* Breakdown Table */}
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Rincian Komponen Aktif ({activeItems.length})
          </h5>

          <div className="border border-border/80 rounded-lg overflow-hidden bg-card">
            <Table className="w-full text-xs">
              <TableHeader className="bg-muted/40 border-b border-border">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 text-center py-2 px-2.5">No</TableHead>
                  <TableHead className="py-2 px-3">Kategori</TableHead>
                  <TableHead className="py-2 px-3">Komponen Biaya</TableHead>
                  <TableHead className="py-2 px-3 text-center">Status Total</TableHead>
                  <TableHead className="py-2 px-3 text-right">Nominal (Rp)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeItems.length > 0 ? (
                  activeItems.map((item, idx) => (
                    <TableRow key={item.id} className="border-b border-border/60 hover:bg-muted/20">
                      <TableCell className="text-center py-2 px-2.5 text-muted-foreground font-mono">{idx + 1}</TableCell>
                      <TableCell className="py-2 px-3">
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0", getCategoryBadgeClass(item.category))}>
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 px-3 font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.code && <span className="text-[9px] font-mono text-muted-foreground">({item.code})</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-center">
                        {item.includesInTotal ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                            Masuk Total
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                            Dipisah (Opsional)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                        <span className={cn(!item.includesInTotal && "text-muted-foreground line-through font-normal")}>
                          Rp {item.nominal.toLocaleString("id-ID")}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                      Tidak ada komponen aktif. Aktifkan komponen pada section terkait untuk melihat ringkasan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  };

  const renderSectionRingkasanTarif = () => {
    const jasaLengkap = samsatDraft.jasaLengkapEnabled ? (parseInt(samsatDraft.biayaJasaLengkap) || 0) : 0;
    const jasaNembak = samsatDraft.jasaNembakEnabled ? (parseInt(samsatDraft.biayaJasaNembak) || 0) : 0;
    const antarJemput = samsatDraft.antarJemputEnabled ? (parseInt(samsatDraft.biayaAntarJemput) || 0) : 0;
    const kustomFees = samsatDraft.biayaLainnya
      .filter((b) => b.enabled)
      .reduce((sum, b) => sum + (b.includesInTotal ? (b.nominal || 0) : 0), 0);
    const totalTarif = jasaLengkap + jasaNembak + antarJemput + kustomFees;

    return (
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Ringkasan Tarif Wilayah — Samsat {samsatDraft.wilayah}
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Rincian total biaya jasa biro, kurir, dan biaya tambahan khusus yang berlaku pada Samsat {samsatDraft.wilayah}.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <Card className="p-2.5 sm:p-3 border border-border/80 bg-card space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground">Total Jasa & Kurir</p>
            <p className="text-lg font-bold font-mono tabular-nums text-foreground">
              Rp {(jasaLengkap + jasaNembak + antarJemput).toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-muted-foreground">Jasa standar + khusus + kurir</p>
          </Card>

          <Card className="p-2.5 sm:p-3 border border-border/80 bg-card space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground">Biaya Kustom Wilayah</p>
            <p className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
              Rp {kustomFees.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-muted-foreground">{samsatDraft.biayaLainnya.filter((b) => b.enabled).length} biaya khusus aktif</p>
          </Card>

          <Card className="p-2.5 sm:p-3 border border-primary/30 bg-primary/5 space-y-0.5 sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-medium text-primary">Total Biaya Samsat</p>
            <p className="text-lg font-bold font-mono tabular-nums text-foreground">
              Rp {totalTarif.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-muted-foreground">Khusus wilayah {samsatDraft.wilayah}</p>
          </Card>
        </div>

        <div className="border border-border/80 rounded-lg overflow-hidden bg-card">
          <Table className="w-full text-xs">
            <TableHeader className="bg-muted/40 border-b border-border">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-1.5 px-3 text-[11px]">Item Biaya</TableHead>
                <TableHead className="py-1.5 px-3 text-[11px]">Kategori</TableHead>
                <TableHead className="py-1.5 px-3 text-[11px] text-center">Status</TableHead>
                <TableHead className="py-1.5 px-3 text-[11px] text-right">Nominal (Rp)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-b border-border/60">
                <TableCell className="py-1.5 px-3 font-medium text-foreground">Biaya Jasa Standar</TableCell>
                <TableCell className="py-1.5 px-3"><Badge variant="outline" className="text-[9px]">Jasa</Badge></TableCell>
                <TableCell className="py-1.5 px-3 text-center">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", samsatDraft.jasaLengkapEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                    {samsatDraft.jasaLengkapEnabled ? "Aktif" : "Off"}
                  </span>
                </TableCell>
                <TableCell className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold">
                  Rp {(parseInt(samsatDraft.biayaJasaLengkap) || 0).toLocaleString("id-ID")}
                </TableCell>
              </TableRow>
              <TableRow className="border-b border-border/60">
                <TableCell className="py-1.5 px-3 font-medium text-foreground">Biaya Pengurusan Khusus</TableCell>
                <TableCell className="py-1.5 px-3"><Badge variant="outline" className="text-[9px]">Jasa</Badge></TableCell>
                <TableCell className="py-1.5 px-3 text-center">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", samsatDraft.jasaNembakEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                    {samsatDraft.jasaNembakEnabled ? "Aktif" : "Off"}
                  </span>
                </TableCell>
                <TableCell className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold">
                  Rp {(parseInt(samsatDraft.biayaJasaNembak) || 0).toLocaleString("id-ID")}
                </TableCell>
              </TableRow>
              <TableRow className="border-b border-border/60">
                <TableCell className="py-1.5 px-3 font-medium text-foreground">Biaya Antar & Jemput ({samsatDraft.antarJemputMode})</TableCell>
                <TableCell className="py-1.5 px-3"><Badge variant="outline" className="text-[9px]">Kurir</Badge></TableCell>
                <TableCell className="py-1.5 px-3 text-center">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", samsatDraft.antarJemputEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                    {samsatDraft.antarJemputEnabled ? "Aktif" : "Off"}
                  </span>
                </TableCell>
                <TableCell className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold">
                  Rp {(parseInt(samsatDraft.biayaAntarJemput) || 0).toLocaleString("id-ID")}
                </TableCell>
              </TableRow>
              {samsatDraft.biayaLainnya.map((bl) => (
                <TableRow key={bl.id} className="border-b border-border/60">
                  <TableCell className="py-1.5 px-3 font-medium text-foreground">{bl.label || "Biaya Lainnya"}</TableCell>
                  <TableCell className="py-1.5 px-3"><Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-700 dark:text-blue-300">Kustom Wilayah</Badge></TableCell>
                  <TableCell className="py-1.5 px-3 text-center">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", bl.enabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {bl.enabled ? "Aktif" : "Off"}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold">
                    Rp {(Number(bl.nominal) || 0).toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderGeneralActiveSectionContent = () => {
    switch (generalActiveSection) {
      case "parameter":
        return renderSectionParameter();
      case "mutasi-masuk":
        return renderSectionMutasiMasuk();
      case "mutasi-keluar":
        return renderSectionMutasiKeluar();
      case "ringkasan":
        return renderSectionRingkasan();
      default:
        return renderSectionParameter();
    }
  };

  const renderMergedSamsatContent = () => {
    return (
      <div className="space-y-3.5 max-w-4xl mx-auto">
        {/* 1. Bagian Biaya Jasa */}
        <div>
          {renderSectionBiayaLayanan()}
        </div>

        {/* Separator */}
        <hr className="border-border/60" />

        {/* 2. Bagian Biaya Kurir Antar-Jemput */}
        <div>
          {renderSectionBiayaTambahan()}
        </div>

        {/* Separator */}
        <hr className="border-border/60" />

        {/* 3. Bagian Biaya Lainnya (Kustom Wilayah) */}
        <div>
          {renderSectionBiayaLainnya()}
        </div>

        {/* Separator */}
        <hr className="border-border/60" />

        {/* 4. Ringkasan Tarif Wilayah */}
        <div>
          {renderSectionRingkasanTarif()}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Table Rendering Helpers (Main View)
  // ─────────────────────────────────────────────────────────────────────────────

  const renderTableHeaders = () => {
    return (
      <>
        <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 w-12 text-center">No</TableHead>
        <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80">Wilayah Samsat</TableHead>
        <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 text-right">Biaya Jasa</TableHead>
        <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 text-right">Biaya Kurir</TableHead>
        <TableHead className="h-9 px-3.5 text-xs font-semibold text-foreground/80 text-right">Total Biro (Jasa + Kurir)</TableHead>
        <TableHead className="h-9 px-2 text-xs font-semibold text-foreground/80 text-center w-[85px]">Aksi</TableHead>
      </>
    );
  };

  const renderTableRow = (item: any, index: number) => {
    const config = pricingStore.getServiceFeeConfig(item.layanan, item.wilayah);
    const isLengkapActive = config?.jasaLengkap ? config.jasaLengkap.enabled : item.jasaLengkapEnabled !== false;
    const isAntarJemputActive = config?.antarJemputEnabled !== undefined ? config.antarJemputEnabled : item.antarJemputEnabled !== false;

    const biayaJasaVal = item.biayaJasaLengkap ?? item.biayaJasa ?? config?.jasaLengkap?.nominal ?? config?.biayaJasa ?? 0;
    const biayaAntarJemputVal = item.biayaAntarJemput ?? config?.biayaAntarJemput ?? 50000;
    const totalBiroVal = (isLengkapActive ? biayaJasaVal : 0) + (isAntarJemputActive ? biayaAntarJemputVal : 0);

    const isCustom = isRowCustomOrOverridden(item);
    const customFees = (config?.biayaLainnya || item.biayaLainnya || []).filter(
      (b: any) => b.enabled !== false && b.label && b.label.trim() !== ""
    );
    const isKhususActive = config?.biayaPengurusanKhusus
      ? config.biayaPengurusanKhusus.enabled
      : config?.jasaNembak
      ? config.jasaNembak.enabled
      : item.pengurusanKhususEnabled ?? (item.jasaNembakEnabled === true);

    return (
      <TableRow key={item.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-10">
        <TableCell className="px-3.5 py-2 text-xs text-muted-foreground text-center">{startIndex + index + 1}</TableCell>
        <TableCell className="px-3.5 py-2 text-xs font-medium text-foreground">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>{item.wilayah}</span>
            {isCustom && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-medium inline-flex items-center shadow-2xs"
                title="Wilayah ini memiliki tarif atau konfigurasi yang berbeda dari Standar Layanan"
              >
                <Zap className="w-2.5 h-2.5 shrink-0" />
                <span>Tarif Khusus</span>
              </Badge>
            )}
            {customFees.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 font-medium inline-flex items-center cursor-help shadow-2xs"
                title={customFees
                  .map((f: any) => `• ${f.label}: Rp ${(Number(f.nominal) || 0).toLocaleString("id-ID")}${f.includesInTotal ? " (Masuk Estimasi)" : ""}`)
                  .join("\n")}
              >
                <Tag className="w-2.5 h-2.5 shrink-0" />
                <span>+{customFees.length} Biaya Khusus</span>
              </Badge>
            )}
            {isKhususActive && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1 font-medium inline-flex items-center shadow-2xs"
                title="Biaya Pengurusan Khusus Aktif pada Samsat ini"
              >
                <span>+Khusus</span>
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="px-3.5 py-2 text-xs text-right font-mono tabular-nums font-medium text-foreground">
          <span className={cn(!isLengkapActive && "line-through text-muted-foreground/60")}>
            Rp {biayaJasaVal.toLocaleString("id-ID")}
          </span>
          {!isLengkapActive && (
            <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-sans">Off</span>
          )}
        </TableCell>
        <TableCell className="px-3.5 py-2 text-xs text-right font-mono tabular-nums font-medium text-foreground">
          <span className={cn(!isAntarJemputActive && "line-through text-muted-foreground/60")}>
            Rp {biayaAntarJemputVal.toLocaleString("id-ID")}
          </span>
          {!isAntarJemputActive && (
            <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-sans">Off</span>
          )}
        </TableCell>
        <TableCell className="px-3.5 py-2 text-xs text-right font-mono tabular-nums font-bold text-foreground">
          Rp {totalBiroVal.toLocaleString("id-ID")}
        </TableCell>
        <TableCell className="px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
              onClick={() => handleEditClick(item)}
              aria-label="Edit biaya"
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Option A: Interactive Formula Banner (Collapsible with Scenario & Vehicle Switcher)
  // ─────────────────────────────────────────────────────────────────────────────

  const renderFormulaBanner = () => {
    const currentLayanan = getCurrentLayanan();
    const isMobil = bannerVehicle === "Mobil";

    // Dynamic rates based on vehicle
    const swdRate = isMobil ? 143000 : 35000;
    const dendaSwdRate = isMobil ? 100000 : 32000;
    const skpRate = isMobil ? 100000 : 50000;
    const stnkRate = isMobil ? 200000 : 100000;
    const tnkbRate = isMobil ? 100000 : 60000;
    const bpkbRate = isMobil ? 375000 : 225000;
    const pnbpMutasiRate = isMobil ? 250000 : 150000;

    // Simulation numbers
    const samplePkb = isMobil ? 2000000 : 300000;
    let sampleDendaPkb = 0;
    let sampleDendaSwd = 0;
    let sampleSkp = 0;
    let sampleKhusus = 0;

    if (bannerScenario === "denda" || bannerScenario === "khusus") {
      sampleDendaPkb = Math.ceil(((samplePkb * 0.48) / 12 * 2) / 1000) * 1000;
      sampleDendaSwd = dendaSwdRate;
      sampleSkp = skpRate;
    }
    if (bannerScenario === "khusus") {
      sampleKhusus = isMobil ? 300000 : 150000;
    }

    const baseline = SERVICE_STANDARD_BASELINES[currentLayanan] || { jasa: 250000, kurir: 50000 };
    const sampleJasa = baseline.jasa;
    const sampleKurir = baseline.kurir;

    // Extra components based on service
    let extraFormulaDesc = "";
    let sampleExtraNominal = 0;
    const extraBreakdownPills: Array<{ label: string; amount: number }> = [];

    if (currentLayanan.includes("5 Tahun")) {
      extraFormulaDesc = `+ PNBP STNK (Rp ${stnkRate.toLocaleString("id-ID")}) + PNBP TNKB (Rp ${tnkbRate.toLocaleString("id-ID")})`;
      sampleExtraNominal = stnkRate + tnkbRate;
      extraBreakdownPills.push({ label: `STNK PNBP`, amount: stnkRate });
      extraBreakdownPills.push({ label: `TNKB Plat`, amount: tnkbRate });
    } else if (currentLayanan.includes("Balik Nama") || currentLayanan.includes("BBN")) {
      const sampleBbn = Math.round(samplePkb * 0.6); // simulasi BBN-KB II ~ 1% NJKB
      extraFormulaDesc = `+ BBN-KB II (1% NJKB) + PNBP BPKB Baru (Rp ${bpkbRate.toLocaleString("id-ID")}) + PNBP STNK/Plat`;
      sampleExtraNominal = sampleBbn + bpkbRate + stnkRate + tnkbRate;
      extraBreakdownPills.push({ label: `BBN-KB II (1% NJKB)`, amount: sampleBbn });
      extraBreakdownPills.push({ label: `BPKB Baru PNBP`, amount: bpkbRate });
      extraBreakdownPills.push({ label: `STNK & Plat PNBP`, amount: stnkRate + tnkbRate });
    } else if (currentLayanan.includes("Mutasi Antar Samsat")) {
      extraFormulaDesc = `+ Komponen Mutasi Keluar Standar + Komponen Mutasi Masuk Standar`;
      sampleExtraNominal = 250000;
      extraBreakdownPills.push({ label: `Komponen Mutasi Standar`, amount: 250000 });
    } else if (currentLayanan.includes("Mutasi Luar Daerah")) {
      extraFormulaDesc = `+ PNBP Mutasi Keluar Polri (Rp ${pnbpMutasiRate.toLocaleString("id-ID")}) + Fiskal Antar Daerah + Mutasi Masuk`;
      sampleExtraNominal = pnbpMutasiRate + 150000;
      extraBreakdownPills.push({ label: `PNBP Mutasi Keluar`, amount: pnbpMutasiRate });
      extraBreakdownPills.push({ label: `Fiskal & Mutmas`, amount: 150000 });
    } else if (currentLayanan.includes("Tarik Berkas")) {
      extraFormulaDesc = `+ Administrasi Cabut Arsip Induk + Fiskal Samsat Asal`;
      sampleExtraNominal = 100000;
      extraBreakdownPills.push({ label: `Cabut Berkas & Fiskal`, amount: 100000 });
    } else if (currentLayanan.includes("Duplikat")) {
      extraFormulaDesc = `+ PNBP STNK Duplikat (Rp ${stnkRate.toLocaleString("id-ID")}) + Cek Fisik & Arsip Blokir`;
      sampleExtraNominal = stnkRate + 75000;
      extraBreakdownPills.push({ label: `PNBP Duplikat`, amount: stnkRate });
      extraBreakdownPills.push({ label: `Cek Fisik & Blokir`, amount: 75000 });
    }

    const simulatedGrandTotal =
      samplePkb +
      sampleDendaPkb +
      swdRate +
      sampleDendaSwd +
      sampleSkp +
      sampleKhusus +
      sampleExtraNominal +
      sampleJasa +
      sampleKurir;

    return (
      <div className="rounded-xl border border-primary/25 bg-gradient-to-b from-primary/5 via-card to-card p-3.5 sm:p-4 space-y-3 transition-all shadow-2xs">
        {/* Banner Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-foreground">Formula & Logika Estimasi Biaya</span>
                <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30">
                  {currentLayanan}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Acuan rumus resmi untuk menyimulasikan perhitungan tagihan klien per wilayah.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsFormulaBannerOpen(!isFormulaBannerOpen)}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>{isFormulaBannerOpen ? "Sembunyikan Formula" : "Tampilkan Formula"}</span>
            {isFormulaBannerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* Collapsible Content */}
        {isFormulaBannerOpen && (
          <div className="space-y-3 pt-2 border-t border-border/70">
            {/* Controls: Vehicle Switcher & Scenario Pills */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 flex-wrap">
              {/* Vehicle Pill */}
              {supportsVehicleChoice(currentLayanan) && (
                <div className="flex items-center gap-1 bg-muted/40 border border-border/80 p-0.5 rounded-lg shrink-0">
                  <span className="text-[10px] font-medium text-muted-foreground px-2">Kendaraan:</span>
                  <Button
                    type="button"
                    variant={bannerVehicle === "Mobil" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setBannerVehicle("Mobil")}
                    className={cn("h-6 px-2.5 text-[11px] font-semibold rounded-md", bannerVehicle === "Mobil" && "shadow-xs")}
                  >
                    Mobil (R4)
                  </Button>
                  <Button
                    type="button"
                    variant={bannerVehicle === "Motor" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setBannerVehicle("Motor")}
                    className={cn("h-6 px-2.5 text-[11px] font-semibold rounded-md", bannerVehicle === "Motor" && "shadow-xs")}
                  >
                    Motor (R2)
                  </Button>
                </div>
              )}

              {/* Scenario Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-medium text-muted-foreground mr-1">Kondisi:</span>
                <button
                  type="button"
                  onClick={() => setBannerScenario("normal")}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md font-medium border transition-all cursor-pointer",
                    bannerScenario === "normal"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-semibold shadow-2xs"
                      : "bg-background/80 text-muted-foreground border-border hover:bg-muted/40"
                  )}
                >
                  🟢 Tepat Waktu
                </button>

                <button
                  type="button"
                  onClick={() => setBannerScenario("denda")}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md font-medium border transition-all cursor-pointer",
                    bannerScenario === "denda"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold shadow-2xs"
                      : "bg-background/80 text-muted-foreground border-border hover:bg-muted/40"
                  )}
                >
                  🟡 Terlambat (Denda)
                </button>

                <button
                  type="button"
                  onClick={() => setBannerScenario("khusus")}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md font-medium border transition-all cursor-pointer",
                    bannerScenario === "khusus"
                      ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40 font-semibold shadow-2xs"
                      : "bg-background/80 text-muted-foreground border-border hover:bg-muted/40"
                  )}
                >
                  🔵 Tanpa KTP (Khusus)
                </button>

                <button
                  type="button"
                  onClick={() => setBannerScenario("pemutihan")}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md font-medium border transition-all cursor-pointer",
                    bannerScenario === "pemutihan"
                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 font-semibold shadow-2xs"
                      : "bg-background/80 text-muted-foreground border-border hover:bg-muted/40"
                  )}
                >
                  🟣 Program Pemutihan
                </button>
              </div>
            </div>

            {/* Formula Typography Display Box */}
            <div className="p-3 rounded-lg border border-border/80 bg-background/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <Sparkles className="w-3 h-3" />
                <span>Rumus Aktif:</span>
              </div>
              <div className="font-mono text-xs font-semibold text-foreground overflow-x-auto py-0.5">
                {bannerScenario === "normal" && (
                  <span>
                    Grand Total = PKB Dasar + SWDKLLJ (Rp {swdRate.toLocaleString("id-ID")}) {extraFormulaDesc} + [Biaya Jasa Biro + Kurir]
                  </span>
                )}
                {bannerScenario === "denda" && (
                  <span>
                    Grand Total = PKB Dasar + Denda PKB + SWDKLLJ (Rp {swdRate.toLocaleString("id-ID")}) + Denda SWD (Rp {dendaSwdRate.toLocaleString("id-ID")}) + Biaya Cetak SKP (Rp {skpRate.toLocaleString("id-ID")}) {extraFormulaDesc} + [Biaya Jasa Biro + Kurir]
                  </span>
                )}
                {bannerScenario === "khusus" && (
                  <span>
                    Grand Total = PKB Dasar + Denda PKB + SWDKLLJ + Denda SWD + Biaya Cetak SKP {extraFormulaDesc} + [Biaya Jasa + Biaya Pengurusan Khusus + Kurir]
                  </span>
                )}
                {bannerScenario === "pemutihan" && (
                  <span>
                    Grand Total = PKB Dasar + [Denda PKB = Rp 0] + SWDKLLJ (Rp {swdRate.toLocaleString("id-ID")}) + [Denda SWD = Rp 0] {extraFormulaDesc} + [Biaya Jasa Biro + Kurir]
                  </span>
                )}
              </div>
            </div>

            {/* Quick Simulation Breakdown Card */}
            <div className="p-2.5 sm:p-3 rounded-lg border border-primary/20 bg-primary/5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground">
                    Contoh Simulasi Real-Time (PKB Rp {samplePkb.toLocaleString("id-ID")} • {bannerVehicle}):
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground font-mono">
                  <span>PKB Rp {samplePkb.toLocaleString("id-ID")}</span>
                  {sampleDendaPkb > 0 && <span className="text-amber-600 dark:text-amber-400">+ Denda Rp {sampleDendaPkb.toLocaleString("id-ID")}</span>}
                  <span>+ SWD Rp {swdRate.toLocaleString("id-ID")}</span>
                  {sampleDendaSwd > 0 && <span className="text-amber-600 dark:text-amber-400">+ Denda SWD Rp {sampleDendaSwd.toLocaleString("id-ID")}</span>}
                  {sampleSkp > 0 && <span>+ SKP Rp {sampleSkp.toLocaleString("id-ID")}</span>}
                  {sampleKhusus > 0 && <span className="text-purple-600 dark:text-purple-400">+ Khusus Rp {sampleKhusus.toLocaleString("id-ID")}</span>}
                  {extraBreakdownPills.map((p, idx) => (
                    <span key={idx}>+ {p.label} Rp {p.amount.toLocaleString("id-ID")}</span>
                  ))}
                  <span className="font-semibold text-foreground">+ [Jasa & Kurir Acuan Rp {(sampleJasa + sampleKurir).toLocaleString("id-ID")}]</span>
                </div>
              </div>

              <div className="shrink-0 flex items-center lg:flex-col lg:items-end justify-between border-t lg:border-t-0 border-border/60 pt-1.5 lg:pt-0">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Simulasi Grand Total:</span>
                <span className="text-base font-bold font-mono tabular-nums text-primary">
                  Rp {simulatedGrandTotal.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Add Dialog Form Fields
  const renderAddFormFields = () => {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/90">Wilayah Samsat</Label>
          <Select
            value={addFormData.wilayah}
            onValueChange={(value) => setAddFormData({ ...addFormData, wilayah: value })}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background border-border">
              <SelectValue placeholder="Pilih wilayah" />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
              {getWilayahList().map((wilayah) => (
                <SelectItem key={wilayah} value={wilayah} className="text-xs">
                  {wilayah}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/90">Biaya Jasa (Standar)</Label>
          <Input
            className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
            type="number"
            value={addFormData.biayaJasaLengkap}
            onChange={(e) => setAddFormData({ ...addFormData, biayaJasaLengkap: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/90">Biaya Pengurusan Khusus</Label>
          <Input
            className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
            type="number"
            value={addFormData.biayaJasaNembak}
            onChange={(e) => setAddFormData({ ...addFormData, biayaJasaNembak: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/90">Biaya Antar & Jemput</Label>
          <Input
            className="h-8.5 text-xs font-mono tabular-nums text-right bg-background border-border"
            type="number"
            value={addFormData.biayaAntarJemput}
            onChange={(e) => setAddFormData({ ...addFormData, biayaAntarJemput: e.target.value })}
          />
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render Main Layout
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-full space-y-4">
      <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs flex-1 flex flex-col min-h-0 space-y-3.5">
              {/* Formula & Logika Estimasi Interactive Banner */}
              {renderFormulaBanner()}

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8.5 text-xs bg-primary/5 hover:bg-primary/10 text-primary border-primary/30 font-semibold gap-1.5 shadow-2xs shrink-0"
                    onClick={handleOpenGeneralRulesModal}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Aturan Estimasi & Komponen General</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8.5 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-2xs font-semibold shrink-0"
                    onClick={() => setIsEstimatorOpen(true)}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Kalkulator Estimasi</span>
                  </Button>

                  {/* Filter Tarif Khusus / Berbeda */}
                  <Button
                    size="sm"
                    variant={onlyCustomFilter ? "default" : "outline"}
                    className={`h-8.5 text-xs font-semibold gap-1.5 shadow-2xs shrink-0 transition-all ${
                      onlyCustomFilter
                        ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setOnlyCustomFilter(!onlyCustomFilter);
                      setCurrentPage(1);
                    }}
                  >
                    <Zap className={`w-3.5 h-3.5 ${onlyCustomFilter ? "text-amber-200" : "text-amber-500"}`} />
                    <span>Hanya Tarif Khusus / Berbeda</span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 h-4.5 rounded-full font-mono font-bold ${
                        onlyCustomFilter
                          ? "bg-amber-800 text-amber-100"
                          : customOfficesCount > 0
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {customOfficesCount}
                    </Badge>
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <ProvinsiFilterSelect
                    value={selectedProvinsi}
                    onValueChange={(val) => {
                      setSelectedProvinsi(val);
                      setCurrentPage(1);
                    }}
                  />
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Cari wilayah..."
                      className="pl-8 bg-background border-border h-8.5 text-xs font-normal placeholder:font-normal placeholder:text-muted-foreground/60"
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-[220px]">
                <Table className={`w-full min-w-[650px] ${paginatedData.length === 0 ? "h-full" : ""}`}>
                  <TableHeader className="bg-muted/40 border-b border-border">
                    <TableRow className="hover:bg-transparent">
                      {renderTableHeaders()}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length > 0 ? (
                      paginatedData.map((item, index) => renderTableRow(item, index))
                    ) : (
                      <TableRow className="h-full hover:bg-transparent">
                        <TableCell colSpan={6} className="text-center py-8 align-middle p-0">
                          <EmptyState
                            title="Tidak ada data biaya ditemukan"
                            description={
                              onlyCustomFilter
                                ? "Tidak ada Samsat yang memiliki tarif khusus atau konfigurasi berbeda pada layanan ini."
                                : "Belum ada konfigurasi tarif Samsat yang sesuai dengan filter atau kata kunci saat ini."
                            }
                            action={
                              onlyCustomFilter ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-8"
                                  onClick={() => {
                                    setOnlyCustomFilter(false);
                                    setCurrentPage(1);
                                  }}
                                >
                                  Tampilkan Semua Wilayah
                                </Button>
                              ) : undefined
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Standardized Table Pagination */}
              <div className="mt-auto pt-1 shrink-0">
                <TablePagination
                  currentPage={currentPage}
                  totalItems={filteredData.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(newSize) => {
                    setItemsPerPage(newSize);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50, 100]}
                />
              </div>

              {/* Summary */}
              <Card className="p-4 border border-border bg-muted/30 shrink-0 mt-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Wilayah</p>
                    <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{filteredData.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Rata-rata Biaya Jasa</p>
                    <p className="text-xl font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      Rp {filteredData.length > 0
                        ? Math.round(
                            filteredData.reduce((acc, item) => {
                              return acc + (item.biayaJasaLengkap || item.biayaJasa || 0);
                            }, 0) / filteredData.length
                          ).toLocaleString("id-ID")
                        : 0}
                    </p>
                  </div>
                </div>
              </Card>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) handleCancelAddClick(); }}>
        <DialogContent className="border-border sm:max-w-lg max-h-[88vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-5 py-3.5 border-b border-border/70 shrink-0 bg-card">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Plus className="w-4 h-4 text-primary" />
              <span>Tambah Biaya Layanan</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tambahkan biaya untuk {getCurrentLayanan()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5">
            {renderAddFormFields()}
          </div>
          <DialogFooter className="px-5 py-3 border-t border-border/70 shrink-0 bg-card flex justify-end gap-2">
            <Button size="sm" variant="outline" className="h-9 text-xs px-4" onClick={handleCancelAddClick}>
              Batal
            </Button>
            <Button size="sm" className="h-9 text-xs px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-semibold flex items-center gap-1.5" onClick={handleAddSubmit}>
              <Plus className="w-3.5 h-3.5" />
              <span>Simpan Biaya</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────
          Modal 2: Tarif Operasional Per-Samsat (Lokal / Wilayah)
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleCancelClick();
        } else {
          setIsEditDialogOpen(true);
        }
      }}>
        <DialogContent className="border-border sm:max-w-3xl lg:max-w-4xl w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card">
          {/* Sticky Header with Context Badges */}
          <DialogHeader className="px-5 py-3.5 border-b border-border/70 shrink-0 bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Edit Tarif Samsat — {selectedItem?.wilayah || samsatDraft.wilayah}
                </DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Layanan:</span>
                  <Badge variant="outline" className="text-[11px] font-semibold bg-primary/10 text-primary border-primary/30">
                    {selectedItem?.layanan || getCurrentLayanan()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">Samsat:</span>
                  <Badge variant="outline" className="text-[11px] font-semibold bg-muted text-foreground border-border">
                    {selectedItem?.wilayah || samsatDraft.wilayah}
                  </Badge>

                  {/* Unsaved changes badge indicator */}
                  {hasUnsavedChanges ? (
                    <Badge variant="outline" className="text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Perubahan belum disimpan
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500" />
                      Tersimpan
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Body: Single Unified Scrollable Form (All sections combined without sidebar) */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 min-h-0 bg-background/50">
            {renderMergedSamsatContent()}
          </div>

          {/* Sticky Bottom Action Bar */}
          <DialogFooter className="px-5 py-3 border-t border-border/70 shrink-0 bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setApplyAllPolicy("PRESERVE_EXISTING_CUSTOM");
                setIsApplyAllDialogOpen(true);
              }}
              className="h-8.5 text-xs border-primary/40 text-primary hover:bg-primary/10 gap-1.5 shadow-2xs font-semibold self-start sm:self-auto"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Terapkan Massal ke Seluruh Samsat...</span>
            </Button>

            <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
              <Button size="sm" variant="outline" className="h-9 text-xs px-4 font-medium" onClick={handleCancelClick}>
                Batal
              </Button>
              <Button size="sm" className="h-9 text-xs px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-semibold" onClick={handleSaveUnified}>
                Simpan Tarif Samsat
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────
          Modal 1: Aturan Estimasi & Komponen General (Berlaku Seragam ke 10 Samsat)
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isGeneralRulesOpen} onOpenChange={setIsGeneralRulesOpen}>
        <DialogContent className="border-border sm:max-w-5xl lg:max-w-6xl w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card">
          {/* Sticky Header with Vehicle Switcher */}
          <DialogHeader className="px-5 py-3.5 border-b border-border/70 shrink-0 bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  Aturan Estimasi & Komponen General — {getCurrentLayanan()}
                </DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Layanan:</span>
                  <Badge variant="outline" className="text-[11px] font-semibold bg-primary/10 text-primary border-primary/30">
                    {getCurrentLayanan()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">•</span>
                  <Badge variant="outline" className="text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                    Berlaku Seragam ke Seluruh Samsat
                  </Badge>
                  <span className="text-xs text-muted-foreground">•</span>
                  <Badge variant="outline" className="text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
                    Mutasi: Tarif Standar Nasional
                  </Badge>
                </div>
              </div>

              {/* Vehicle Switcher Pill inside Modal 1 */}
              {supportsVehicleChoice(getCurrentLayanan()) && (
                <div className="flex items-center gap-1 border border-border/70 p-1 rounded-lg bg-muted/40 shrink-0 self-start sm:self-auto">
                  <Button
                    type="button"
                    variant={editVehicle === "Mobil" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setEditVehicle("Mobil")}
                    className={cn("h-7 px-3 text-xs font-semibold", editVehicle === "Mobil" && "shadow-xs")}
                  >
                    Mobil (R4)
                  </Button>
                  <Button
                    type="button"
                    variant={editVehicle === "Motor" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setEditVehicle("Motor")}
                    className={cn("h-7 px-3 text-xs font-semibold", editVehicle === "Motor" && "shadow-xs")}
                  >
                    Motor (R2)
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Modal Body: 2-Column Layout (Sidebar + Single Scroll Content) */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Mobile Section Selector */}
            <div className="md:hidden p-3 border-b border-border/70 bg-muted/20 shrink-0">
              <Select value={generalActiveSection} onValueChange={(val) => setGeneralActiveSection(val as GeneralSectionId)}>
                <SelectTrigger className="h-8.5 text-xs bg-background">
                  <SelectValue placeholder="Pilih Bagian Konfigurasi" />
                </SelectTrigger>
                <SelectContent>
                  {GENERAL_SECTIONS.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id} className="text-xs">
                      {sec.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Navigation Sidebar */}
            <div className="hidden md:flex w-64 border-r border-border/70 flex-col bg-muted/15 shrink-0 p-3 space-y-1 overflow-y-auto">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 py-1">
                Aturan General (10 Samsat)
              </p>
              {GENERAL_SECTIONS.map((sec) => {
                const IconComponent = sec.icon;
                const isActive = generalActiveSection === sec.id;

                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setGeneralActiveSection(sec.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconComponent className={cn("w-4 h-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                      <span className="truncate">{sec.shortLabel}</span>
                    </div>

                    {/* Section Count Badge */}
                    {sec.id === "parameter" && (
                      <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0", isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        {vehicleDrafts[editVehicle].components.filter((c) => c.isActive).length} Aktif
                      </span>
                    )}
                    {sec.id === "mutasi-masuk" && (
                      <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0", isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        {pricingStore.getMasterPricingItems().filter((i) => i.category === "Mutasi Masuk" && !!samsatDraft.selectedComponents[i.id]).length} Aktif
                      </span>
                    )}
                    {sec.id === "mutasi-keluar" && (
                      <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0", isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        {pricingStore.getMasterPricingItems().filter((i) => i.category === "Mutasi Keluar" && !!samsatDraft.selectedComponents[i.id]).length} Aktif
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Single Scroll Content Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 bg-background/50">
              {renderGeneralActiveSectionContent()}
            </div>
          </div>

          {/* Sticky Bottom Action Bar */}
          <DialogFooter className="px-5 py-3 border-t border-border/70 shrink-0 bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Aturan denda, pembulatan & komponen mutasi ini otomatis diterapkan seragam ke seluruh Samsat.</span>
            </div>

            <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
              <Button size="sm" variant="outline" className="h-8.5 text-xs font-medium" onClick={() => setIsGeneralRulesOpen(false)}>
                Batal
              </Button>
              <Button size="sm" className="h-8.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-semibold" onClick={handleSaveGeneralRules}>
                Simpan Aturan General
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation Alert Dialog */}
      <AlertDialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <AlertDialogContent className="border-border sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              Perubahan Belum Disimpan
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Anda memiliki konfigurasi yang telah diubah namun belum disimpan. Jika Anda membatalkan sekarang, semua perubahan tarif dan parameter rumus akan dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 text-xs font-medium"
              onClick={() => setIsDiscardDialogOpen(false)}
            >
              Lanjutkan Mengedit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={handleConfirmDiscard}
            >
              Buang Perubahan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terapkan ke Semua Samsat Alert Dialog */}
      <AlertDialog open={isApplyAllDialogOpen} onOpenChange={setIsApplyAllDialogOpen}>
        <AlertDialogContent className="border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              Terapkan Tarif Operasional ke Seluruh Samsat?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3.5 pt-2 text-xs text-muted-foreground">
                {/* Context Summary Card */}
                <div className="p-3 rounded-lg border border-border/80 bg-muted/40 space-y-1.5">
                  <div className="flex justify-between items-center text-foreground font-medium">
                    <span>Layanan Terpengaruh:</span>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      {selectedItem?.layanan || getCurrentLayanan()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-foreground font-medium">
                    <span>Samsat Acuan Sumber:</span>
                    <span className="font-semibold text-foreground">{selectedItem?.wilayah || samsatDraft.wilayah}</span>
                  </div>
                  <div className="flex justify-between items-center text-foreground font-medium">
                    <span>Target Replikasi:</span>
                    <span className="font-semibold text-foreground">Seluruh Samsat</span>
                  </div>
                </div>

                {/* Scope Selection Card */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Pilih Cakupan Tarif yang Diterapkan:
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Pembaruan Parsial Terkontrol
                    </span>
                  </div>

                  <div className="space-y-2.5 border border-border/80 rounded-lg p-3 bg-card/60">
                    {/* 1. Biaya Jasa */}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyAllScope.applyBiayaLayanan}
                        onChange={(e) =>
                          setApplyAllScope((prev) => ({ ...prev, applyBiayaLayanan: e.target.checked }))
                        }
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <div className="space-y-0.5 leading-tight">
                        <div className="text-xs font-semibold text-foreground">Biaya Jasa</div>
                        <div className="text-[11px] text-muted-foreground">
                          Biaya Jasa Standar & Biaya Pengurusan Khusus
                        </div>
                      </div>
                    </label>

                    {/* 2. Biaya Kurir Antar-Jemput */}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyAllScope.applyBiayaTambahan}
                        onChange={(e) =>
                          setApplyAllScope((prev) => ({ ...prev, applyBiayaTambahan: e.target.checked }))
                        }
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <div className="space-y-0.5 leading-tight">
                        <div className="text-xs font-semibold text-foreground">Kurir Antar-Jemput</div>
                        <div className="text-[11px] text-muted-foreground">
                          Nominal, status aktif, dan opsi mode kurir antar & jemput dokumen
                        </div>
                      </div>
                    </label>

                    {/* 3. Biaya Lainnya (Komponen Kustom) */}
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyAllScope.applyBiayaLainnya}
                        onChange={(e) =>
                          setApplyAllScope((prev) => ({ ...prev, applyBiayaLainnya: e.target.checked }))
                        }
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      <div className="space-y-0.5 leading-tight">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">Biaya Lainnya (Komponen Kustom)</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                            Penggabungan Aman
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Salin komponen biaya khusus Samsat ini ({samsatDraft.biayaLainnya.length} item) ke seluruh Samsat lain tanpa menimpa biaya kustom yang sudah ada
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Override Policy Selection Card */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      Kebijakan Replikasi Tarif Khusus:
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Kontrol Perlindungan Data
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {/* Opsi 1: PRESERVE_EXISTING_CUSTOM (Direkomendasikan) */}
                    <div
                      onClick={() => setApplyAllPolicy("PRESERVE_EXISTING_CUSTOM")}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all space-y-1.5",
                        applyAllPolicy === "PRESERVE_EXISTING_CUSTOM"
                          ? "border-emerald-500/60 bg-emerald-500/10 shadow-2xs"
                          : "border-border/80 bg-card/60 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="applyAllPolicy"
                            checked={applyAllPolicy === "PRESERVE_EXISTING_CUSTOM"}
                            onChange={() => setApplyAllPolicy("PRESERVE_EXISTING_CUSTOM")}
                            className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <span>Pertahankan Tarif Khusus Kantor</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                                Direkomendasikan
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                              Hanya memperbarui kantor yang menggunakan tarif standar. Kantor yang sudah memiliki tarif khusus/berbeda tetap aman dipertahankan.
                            </div>
                          </div>
                        </label>
                      </div>
                      {applyAllPolicy === "PRESERVE_EXISTING_CUSTOM" && (
                        <div className="pt-1.5 border-t border-emerald-500/20 flex flex-wrap items-center gap-1.5 text-[10px] text-emerald-800 dark:text-emerald-300 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Estimasi: <strong>{applyAllMetrics.standardCount} Samsat</strong> diperbarui, <strong>{applyAllMetrics.customCount} Samsat</strong> bertarif khusus tetap dipertahankan.</span>
                        </div>
                      )}
                    </div>

                    {/* Opsi 2: OVERWRITE_ALL */}
                    <div
                      onClick={() => setApplyAllPolicy("OVERWRITE_ALL")}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all space-y-1.5",
                        applyAllPolicy === "OVERWRITE_ALL"
                          ? "border-amber-500/60 bg-amber-500/10 shadow-2xs"
                          : "border-border/80 bg-card/60 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="applyAllPolicy"
                            checked={applyAllPolicy === "OVERWRITE_ALL"}
                            onChange={() => setApplyAllPolicy("OVERWRITE_ALL")}
                            className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <span>Timpa Seluruh Kantor (Termasuk Tarif Khusus)</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                Override Total
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                              Menyeragamkan seluruh {applyAllMetrics.totalOffices} kantor Samsat dengan nilai sumber ini tanpa pengecualian.
                            </div>
                          </div>
                        </label>
                      </div>
                      {applyAllPolicy === "OVERWRITE_ALL" && (
                        <div className="pt-1.5 border-t border-amber-500/20 flex flex-wrap items-center gap-1.5 text-[10px] text-amber-800 dark:text-amber-300 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Perhatian: Seluruh <strong>{applyAllMetrics.totalOffices} Samsat</strong> akan ditimpa, termasuk <strong>{applyAllMetrics.customCount} kantor</strong> yang memiliki tarif khusus.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                  <p className="font-medium text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    Perlindungan Biaya Kustom Wilayah:
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-700/90 dark:text-emerald-300/90">
                    Biaya kustom/tambahan khusus per-Samsat (seperti biaya tambahan Bogor) tetap aman dipertahankan dan tidak akan dihapus atau diubah secara tidak disengaja.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={isApplyingAll} className="h-8.5 text-xs font-medium">Batal</AlertDialogCancel>
            <Button
              type="button"
              disabled={isApplyingAll || (!applyAllScope.applyBiayaLayanan && !applyAllScope.applyBiayaTambahan && !applyAllScope.applyBiayaLainnya)}
              onClick={handleApplyAllConfirm}
              className="h-8.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-semibold gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplyingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menerapkan Replikasi...</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>Ya, Terapkan ke Semua Samsat</span>
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="border-border sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Hapus Biaya Layanan?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin ingin menghapus biaya layanan untuk wilayah{" "}
              <span className="text-foreground font-medium">{selectedItem?.wilayah}</span>?
              Aksi ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-8 text-xs font-medium">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white shadow-xs"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kalkulator Estimasi Dialog Modal (All 5 Services) */}
      <Dialog open={isEstimatorOpen} onOpenChange={setIsEstimatorOpen}>
        <DialogContent className="border-border sm:max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-3 border-b border-border/70">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                    <Calculator className="w-5 h-5 text-primary" />
                    Kalkulator Estimasi Biaya Layanan Samsat
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Simulasi perhitungan PKB, SWDKLLJ, denda keterlambatan, dan jasa perpanjangan/mutasi/BBN sesuai formula workbook resmi.
                  </DialogDescription>
                </div>

                <div className="flex items-center gap-1 border border-border/70 p-1 rounded-lg bg-muted/40 self-start sm:self-auto shrink-0">
                  <Button
                    type="button"
                    variant={estimatorVehicleTab === "R4" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setEstimatorVehicleTab("R4")}
                    className={cn("h-7 px-3 text-xs font-semibold", estimatorVehicleTab === "R4" && "shadow-xs")}
                  >
                    Mobil (R4)
                  </Button>
                  <Button
                    type="button"
                    variant={estimatorVehicleTab === "R2" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setEstimatorVehicleTab("R2")}
                    className={cn("h-7 px-3 text-xs font-semibold", estimatorVehicleTab === "R2" && "shadow-xs")}
                  >
                    Motor (R2)
                  </Button>
                </div>
              </div>

              {/* Service Selection Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[
                  "Perpanjangan 1 Tahun",
                  "Perpanjangan 5 Tahun",
                  "Balik Nama",
                  "Mutasi Antar Samsat",
                  "Mutasi Luar Daerah",
                ].map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={estimatorServiceTab === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEstimatorServiceTab(s as any)}
                    className={cn(
                      "h-7 text-xs font-medium px-2.5",
                      estimatorServiceTab === s ? "shadow-2xs" : "bg-background"
                    )}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </DialogHeader>
          <div className="pt-2">
            {estimatorServiceTab === "Perpanjangan 1 Tahun" ? (
              estimatorVehicleTab === "R4" ? <EstimatorR4Tahunan /> : <EstimatorR2Tahunan />
            ) : (
              <EstimatorExtended
                key={`${estimatorServiceTab}-${estimatorVehicleTab}`}
                defaultServiceType={estimatorServiceTab as any}
                defaultVehicleType={estimatorVehicleTab === "R4" ? "Mobil" : "Motor"}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
