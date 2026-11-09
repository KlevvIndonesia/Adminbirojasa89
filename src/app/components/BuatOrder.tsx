import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import {
  User,
  MapPin,
  Calculator,
  FileText,
  CreditCard,
  Car,
  CheckCircle2,
  Upload,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  QrCode,
  Eye,
  Trash2,
  RefreshCw,
  File as FileIcon,
  Image as ImageIcon,
  Building,
  FileUp,
  Banknote,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  Plus,
  Info,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileCheck,
  HelpCircle,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { usePaymentMethods } from "../data/paymentMethodStore";
import { orderStore, OperationalOrder, StructuredAddress, OrderDocument, PaymentProof } from "../data/orderStore";
import { pricingStore, usePricingStore, resolveServiceId, resolveSamsatId } from "../data/pricingStore";
import { documentRepository } from "../../data/repositories/documentRepository";
import { processDocumentUpload, formatFileSize } from "../utils/fileCompressor";
import { cn } from "./ui/utils";
import { APP_CONFIG } from "../config/appConfig";
import { ActionInlineError } from "./ui/ActionInlineError";
import { ClassifiedActionError, classifyActionError } from "../utils/actionErrorClassifier";
import { calculateEstimation } from "../../domain/estimation/estimationEngine";
import { DEFAULT_R4_ANNUAL_TEMPLATE, DEFAULT_R2_ANNUAL_TEMPLATE } from "../../domain/estimation/defaultTemplates";
import { estimationStore, useEstimationStore } from "../data/estimationStore";
import { CalculationExplanationModal } from "./estimation/CalculationExplanationModal";
import { SearchableSamsatSelect } from "./SearchableSamsatSelect";
import { useServiceStore, parseRequirementItem, ServiceItem } from "../data/serviceStore";
import { PlateNumberInput } from "./PlateNumberInput";
import {
  ProgramSamsat,
  KondisiBerkas,
  WilayahAccId,
  EstimationInput,
  EstimationResult,
} from "../../domain/estimation/types";
import { parseDateParts } from "../../domain/estimation/excelDateUtils";

// Dynamic services bound via useServiceStore

const bulanOptions = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const getMonthNameFromDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const parts = parseDateParts(dateStr);
  if (!parts || !parts.m || parts.m < 1 || parts.m > 12) return "";
  return bulanOptions[parts.m - 1];
};

export function resolveEstimationTemplateId(serviceName: string, vehicleType: string): string | null {
  const isMobil = vehicleType === "Mobil" || (vehicleType as string) === "R4";
  const isMotor = vehicleType === "Motor" || (vehicleType as string) === "R2";
  if (!isMobil && !isMotor) return null;

  const sId = resolveServiceId(serviceName);
  if (serviceName === "Perpanjangan 1 Tahun" || sId === "perpanjangan-1-tahun") {
    return isMobil ? "template-pajak-tahunan-r4" : "template-pajak-tahunan-r2";
  }
  if (serviceName === "Perpanjangan 5 Tahun" || sId === "perpanjangan-5-tahun") {
    return isMobil ? "template-pajak-5-tahun-r4" : "template-pajak-5-tahun-r2";
  }
  if (serviceName === "Balik Nama" || sId === "balik-nama") {
    return isMobil ? "template-bbn-r4" : "template-bbn-r2";
  }
  if (serviceName === "Mutasi Antar Samsat" || sId === "mutasi-antar-samsat") {
    return isMobil ? "template-mutasi-as-r4" : "template-mutasi-as-r2";
  }
  if (serviceName === "Mutasi Luar Daerah" || sId === "mutasi-luar-daerah") {
    return isMobil ? "template-mutasi-ld-r4" : "template-mutasi-ld-r2";
  }
  return null;
}

interface BuatOrderProps {
  onOrderCreated?: (order: OperationalOrder) => void;
  currentUserName?: string;
  currentUserRole?: string;
  currentUserId?: string;
}

interface AttachedDocState {
  file?: File;
  name: string;
  fileType: "pdf" | "image" | "";
  fileUrl?: string;
  fileSize?: string;
  attached: boolean;
  documentId?: string;
}

export function BuatOrder({
  onOrderCreated,
  currentUserName = "Admin Loket",
  currentUserRole = "admin",
  currentUserId,
}: BuatOrderProps) {
  const navigate = useNavigate();
  usePricingStore(); // Reactive subscription to pricingStore configuration
  useEstimationStore(); // Reactive subscription to estimationStore template parameters & components
  const { activeMethods } = usePaymentMethods();
  const { activeServices, isLoading: isServicesLoading, error: servicesError } = useServiceStore();
  const availableServices = useMemo(() => {
    return [...activeServices].sort((a: ServiceItem, b: ServiceItem) => (a.urutan || 0) - (b.urutan || 0));
  }, [activeServices]);

  // Stepper State: 1 = Data Klien & Kendaraan, 2 = Dokumen, Pembayaran & Ringkasan
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSameAsCustomer, setIsSameAsCustomer] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSameAddress, setIsSameAddress] = useState(true);
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedQris, setCopiedQris] = useState(false);
  const [showQrisModal, setShowQrisModal] = useState(false);

  // 3-part Plate Number state
  const [platePrefix, setPlatePrefix] = useState("B");
  const [plateNumber, setPlateNumber] = useState("");
  const [plateSuffix, setPlateSuffix] = useState("");

  // Preview modal for documents / payment proof
  const [previewModal, setPreviewModal] = useState<{
    title: string;
    name: string;
    fileType: string;
    fileUrl?: string;
  } | null>(null);

  // Validation & feedback errors
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});
  const [step2Errors, setStep2Errors] = useState<{
    metodePembayaran?: string;
    nominalDibayarAwal?: string;
  }>({});
  const [docUploadErrors, setDocUploadErrors] = useState<Record<string, string>>({});
  const [paymentProofUploadError, setPaymentProofUploadError] = useState<string>("");
  const [submitError, setSubmitError] = useState<ClassifiedActionError | null>(null);

  // Synchronous double-submit lock + persistent idempotency key across timeout retries
  const isSubmittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const idempotencySignatureRef = useRef<string | null>(null);

  // Confirmation dialogs
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [createdOrderSuccess, setCreatedOrderSuccess] = useState<OperationalOrder | null>(null);

  // R4 Annual Tax Estimation States
  const [r4ProgramSamsat, setR4ProgramSamsat] = useState<ProgramSamsat>("NORMAL");
  const [r4KondisiBerkas, setR4KondisiBerkas] = useState<KondisiBerkas>("LENGKAP");
  const [r4WilayahAccId, setR4WilayahAccId] = useState<WilayahAccId>("DKI Jakarta");
  const [r4ShowIncidentals, setR4ShowIncidentals] = useState<boolean>(false);
  const [r4ManualValues, setR4ManualValues] = useState<Record<string, number>>({
    jr: 0,
    etle: 0,
    "pnbp-nopil": 0,
    "stnk-hilang": 0,
    "pemekaran-wilayah": 0,
  });

  // R2 Annual Estimator Form States (Motor)
  const [r2ProgramSamsat, setR2ProgramSamsat] = useState<ProgramSamsat>("NORMAL");
  const [r2KondisiBerkas, setR2KondisiBerkas] = useState<KondisiBerkas>("TIDAK ADA KTP");
  const [r2WilayahAccId, setR2WilayahAccId] = useState<WilayahAccId>("NON ACC ID");
  const [r2ShowIncidentals, setR2ShowIncidentals] = useState<boolean>(false);
  const [r2ManualValues, setR2ManualValues] = useState<Record<string, number>>({
    "stnk-hilang": 0,
    "proses-dan-acc-id": 350000,
    etle: 0,
    "req-nopol-ganjil-acak": 0,
    "pemekaran-wilayah": 0,
  });

  // Extended Estimation States (5 Tahunan, BBN, Mutasi AS, Mutasi LD)
  const [extProgramSamsat, setExtProgramSamsat] = useState<ProgramSamsat>("NORMAL");
  const [extKondisiBerkas, setExtKondisiBerkas] = useState<KondisiBerkas>("LENGKAP");
  const [extWilayahAccId, setExtWilayahAccId] = useState<WilayahAccId>("DKI Jakarta");
  const [extFreeBbn, setExtFreeBbn] = useState<boolean>(true);
  const [extShowIncidentals, setExtShowIncidentals] = useState<boolean>(false);
  const [extManualValues, setExtManualValues] = useState<Record<string, number>>({});

  // Calculation Explanation Popup Modal States
  const [explanationModalOpen, setExplanationModalOpen] = useState(false);
  const [explanationTargetItemId, setExplanationTargetItemId] = useState<string | null>("denda-pkb-pajak-baru");

  const handleOpenExplanation = (itemId: string | null = null) => {
    setExplanationTargetItemId(itemId);
    setExplanationModalOpen(true);
  };

  const clearFieldError = (key: string) => {
    if (step1Errors[key]) {
      setStep1Errors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    // 1. Data Klien & Pemilik
    customer: "",
    namaPemilik: "",
    nomorHP: "",
    kepemilikanKendaraan: "Pribadi",

    // 2. Kendaraan & Layanan
    layanan: "",
    serviceId: "",
    metodeLayanan: "Antar Jemput" as "Antar Jemput" | "Datang Langsung",
    jenisKendaraan: "Mobil",
    tahunKendaraan: new Date().getFullYear().toString(),
    wilayahSamsatAsal: "Jakarta Timur",
    samsatAsalId: "samsat-jakarta-timur",
    wilayahSamsatTujuan: "",
    samsatTujuanId: "",

    // 3. Informasi Pajak Kendaraan
    pkbBerlakuSd: "",
    tahunPajak: "",
    bulanPajak: "",
    nominalPkbTerakhir: "",
    nominalSwdkllj: "143000",

    // 4. Pembayaran
    tipePembayaran: "Bayar di Akhir" as "Bayar di Awal" | "Bayar di Akhir" | "Tempo",
    metodePembayaran: "Transfer BCA",
    nominalDibayarAwal: "",

    // 5. Alamat Penjemputan
    jemputKota: "Jakarta Timur",
    jemputKecamatan: "",
    jemputKelurahan: "",
    jemputDetail: "",
    jemputRtRw: "",
    jemputNomor: "",
    jemputLandmark: "",
    jemputMapsUrl: "",

    // 6. Alamat Pengantaran
    antarKota: "Jakarta Timur",
    antarKecamatan: "",
    antarKelurahan: "",
    antarDetail: "",
    antarRtRw: "",
    antarNomor: "",
    antarLandmark: "",
    antarMapsUrl: "",
  });

  // 5 Dokumen Kendaraan (Semua Optional)
  const [docs, setDocs] = useState<Record<string, AttachedDocState>>({
    stnk: { name: "", fileType: "", attached: false },
    bpkb: { name: "", fileType: "", attached: false },
    ktp: { name: "", fileType: "", attached: false },
    skkp: { name: "", fileType: "", attached: false },
    lainnya: { name: "", fileType: "", attached: false },
  });

  // Bukti Pembayaran (Khusus Bayar di Awal)
  const [paymentProof, setPaymentProof] = useState<AttachedDocState>({
    name: "",
    fileType: "",
    attached: false,
  });

  // Collapsible state for Dokumen Kendaraan (Default: expanded / true)
  const [isVehicleDocsExpanded, setIsVehicleDocsExpanded] = useState(true);

  const getCombinedNopol = () => {
    const parts = [platePrefix.trim().toUpperCase(), plateNumber.trim(), plateSuffix.trim().toUpperCase()];
    return parts.filter(Boolean).join(" ");
  };

  const currentConfig = formData.layanan
    ? pricingStore.getServiceFeeConfig(formData.layanan, formData.wilayahSamsatAsal)
    : undefined;
  const isOpsenEnabled = currentConfig?.swdkllj ? currentConfig.swdkllj.enabled !== false : true;
  const isAntarJemputEnabled = currentConfig ? currentConfig.antarJemputEnabled !== false : true;

  const isR4Annual =
    (formData.layanan === "Perpanjangan 1 Tahun" || resolveServiceId(formData.layanan) === "perpanjangan-1-tahun") &&
    (formData.jenisKendaraan === "Mobil" || (formData.jenisKendaraan as string) === "R4");

  const isR2Annual =
    (formData.layanan === "Perpanjangan 1 Tahun" || resolveServiceId(formData.layanan) === "perpanjangan-1-tahun") &&
    (formData.jenisKendaraan === "Motor" || (formData.jenisKendaraan as string) === "R2");

  const extendedTemplateId = resolveEstimationTemplateId(formData.layanan, formData.jenisKendaraan);
  const isExtendedEstimation = !isR4Annual && !isR2Annual && !!extendedTemplateId;

  const selectedServiceItem = availableServices.find(
    (s: ServiceItem) => (formData.serviceId && s.id === formData.serviceId) || s.nama_layanan === formData.layanan
  );
  const requiresSamsatTujuan = selectedServiceItem?.memerlukan_samsat_tujuan === 1 || formData.layanan.includes("Mutasi");

  const dynamicDocRequirements = useMemo(() => {
    if (selectedServiceItem && Array.isArray(selectedServiceItem.requirements) && selectedServiceItem.requirements.length > 0) {
      return selectedServiceItem.requirements.map((req: string, idx: number) => parseRequirementItem(req, idx));
    }
    return [
      { key: "stnk", label: "STNK Asli", isOptional: false, cleanName: "STNK Asli" },
      { key: "bpkb", label: "BPKB Asli / Surat Keterangan Leasing", isOptional: false, cleanName: "BPKB Asli" },
      { key: "ktp", label: "KTP Pemilik Asli Sesuai BPKB", isOptional: false, cleanName: "KTP Pemilik" },
      { key: "skkp", label: "SKKP (Surat Ketetapan Pajak Daerah)", isOptional: true, cleanName: "SKKP" },
      { key: "lainnya", label: "Dokumen Tambahan (Surat Kuasa / Faktur / Kuitansi)", isOptional: true, cleanName: "Dokumen Tambahan" },
    ];
  }, [selectedServiceItem]);

  // Cost calculation via pricingStore SSoT or estimationEngine (for R4, R2, and Extended)
  const calculateCost = () => {
    const pkb = parseFloat(formData.nominalPkbTerakhir) || 0;
    const swdkllj = isOpsenEnabled ? (parseFloat(formData.nominalSwdkllj) || 0) : 0;
    const dendaSwdkllj = 0;

    const cfg = currentConfig || (formData.layanan ? pricingStore.getServiceFeeConfig(formData.layanan, formData.wilayahSamsatAsal) : undefined);
    const isAntarJemput = formData.metodeLayanan === "Antar Jemput";
    const isCourierEnabled = cfg ? cfg.antarJemputEnabled !== false : true;
    const courierFee = isAntarJemput && isCourierEnabled ? (cfg?.biayaAntarJemput ?? 50000) : 0;

    const kustomItems: any[] = [];
    let totalKustomFees = 0;
    if (cfg?.biayaLainnya && Array.isArray(cfg.biayaLainnya)) {
      cfg.biayaLainnya.forEach((bl) => {
        const nom = Number(bl.nominal) || 0;
        if (bl.enabled !== false && nom > 0) {
          kustomItems.push({
            itemId: bl.id,
            code: "BIAYA-LAIN",
            name: bl.label || "Biaya Tambahan Wilayah",
            amount: nom,
            category: "Operasional" as const,
            source: "BiayaLayanan" as const,
            isRequired: false,
          });
          totalKustomFees += nom;
        }
      });
    }

    if (!formData.layanan) {
      return {
        biayaJasa: 0,
        biayaSamsat: 0,
        biayaAntarJemput: 0,
        subtotalLayanan: 0,
        pkb,
        swdkllj,
        dendaSwdkllj,
        total: pkb + swdkllj,
        breakdown: [] as any[],
        snapshot: undefined,
        isR4Annual: false,
        r4Result: undefined as EstimationResult | undefined,
        isR2Annual: false,
        r2Result: undefined as EstimationResult | undefined,
        isExtendedEstimation: false,
        extResult: undefined as EstimationResult | undefined,
        extTemplate: undefined,
        courierFee: 0,
        kustomItems: [],
        totalKustomFees: 0,
      };
    }

    if (isR4Annual) {
      const baseTemplate = estimationStore.getTemplate("template-pajak-tahunan-r4") || DEFAULT_R4_ANNUAL_TEMPLATE;
      const isKhusus = r4KondisiBerkas === "TIDAK ADA KTP" && Boolean(cfg?.biayaPengurusanKhusus?.enabled && (cfg.biayaPengurusanKhusus.nominal || 0) > 0);
      const effectiveJasa = isKhusus
        ? (cfg?.biayaPengurusanKhusus?.nominal || 0)
        : (cfg?.jasaLengkap?.enabled !== false ? (cfg?.jasaLengkap?.nominal ?? cfg?.biayaJasa ?? baseTemplate.biayaJasa) : 0);

      const template = {
        ...baseTemplate,
        biayaJasa: effectiveJasa,
        components: baseTemplate.components.map((c) =>
          c.ruleId === "JASA" ? { ...c, defaultValue: effectiveJasa } : c
        ),
      };

      const estimationInput: EstimationInput = {
        pkbDasar: pkb,
        tanggalJatuhTempo: formData.pkbBerlakuSd || "",
        tanggalEstimasi: new Date().toISOString().split("T")[0],
        programSamsat: r4ProgramSamsat,
        kondisiBerkas: r4KondisiBerkas,
        wilayahAccId: r4WilayahAccId,
        manualValues: r4ManualValues,
      };

      const r4Result = calculateEstimation(estimationInput, template);

      // Map R4 result items to OrderCostBreakdownItem[]
      const breakdown = r4Result.items
        .filter((it) => it.amount > 0 || it.includesInTotal)
        .map((it) => {
          let category: "Pajak" | "Jasa" | "Samsat" | "Operasional" = "Pajak";
          if (it.category === "JASA") category = "Jasa";
          else if (it.category === "ADMIN") category = "Samsat";
          else if (it.category === "INSIDENTAL") category = "Operasional";

          return {
            itemId: it.id,
            code: it.code,
            name: it.name,
            amount: it.amount,
            category,
            source: it.isManual
              ? ("Operasional" as const)
              : it.category === "JASA"
              ? ("BiayaLayanan" as const)
              : ("Kendaraan" as const),
            isRequired: !it.isManual,
          };
        });

      if (isAntarJemput && courierFee > 0) {
        breakdown.push({
          itemId: "fee-antar-jemput",
          code: "OPS-ANTARJEMPUT",
          name: `Layanan Kurir Antar-Jemput (${cfg?.antarJemputMode || "Antar & Jemput"})`,
          amount: courierFee,
          category: "Operasional",
          source: "Operasional",
          isRequired: false,
        });
      }

      kustomItems.forEach((ki) => breakdown.push(ki));

      const cetakSkpAmount = r4Result.items.find((i) => i.id === "cetak-skp")?.amount || 0;
      const jasaAmount = r4Result.items.find((i) => i.id === "jasa")?.amount ?? effectiveJasa;
      const grandTotal = r4Result.totalEstimasi + courierFee + totalKustomFees;

      const snapshot: any = {
        serviceId: "perpanjangan-1-tahun",
        serviceName: "Perpanjangan 1 Tahun",
        samsatId: resolveSamsatId(formData.wilayahSamsatAsal),
        samsatName: formData.wilayahSamsatAsal,
        metodeLayanan: formData.metodeLayanan,
        biayaJasa: jasaAmount,
        biayaPengurusanKhusus: isKhusus ? effectiveJasa : undefined,
        biayaSamsat: cetakSkpAmount,
        biayaAntarJemput: courierFee,
        pkb: r4Result.totalPkb + r4Result.totalDendaPkb,
        swdkllj: r4Result.totalSwdkllj,
        dendaSwdkllj: r4Result.totalDendaSwdkllj + cetakSkpAmount + r4Result.totalInsidental,
        totalEstimasi: grandTotal,
        breakdown,
        createdAt: new Date().toISOString(),
      };

      return {
        biayaJasa: jasaAmount,
        biayaSamsat: cetakSkpAmount,
        biayaAntarJemput: courierFee,
        subtotalLayanan: r4Result.totalAdminDanJasa + r4Result.totalInsidental + courierFee + totalKustomFees,
        pkb: r4Result.totalPkb + r4Result.totalDendaPkb,
        swdkllj: r4Result.totalSwdkllj,
        dendaSwdkllj: r4Result.totalDendaSwdkllj + cetakSkpAmount + r4Result.totalInsidental,
        total: grandTotal,
        breakdown,
        snapshot,
        isR4Annual: true,
        r4Result,
        isR2Annual: false,
        r2Result: undefined as EstimationResult | undefined,
        isExtendedEstimation: false,
        extResult: undefined as EstimationResult | undefined,
        extTemplate: undefined,
        courierFee,
        kustomItems,
        totalKustomFees,
      };
    }

    if (isR2Annual) {
      const baseTemplate = estimationStore.getTemplate("template-pajak-tahunan-r2") || DEFAULT_R2_ANNUAL_TEMPLATE;
      const isKhusus = r2KondisiBerkas === "TIDAK ADA KTP" && Boolean(cfg?.biayaPengurusanKhusus?.enabled && (cfg.biayaPengurusanKhusus.nominal || 0) > 0);
      const effectiveJasa = isKhusus
        ? (cfg?.biayaPengurusanKhusus?.nominal || 0)
        : (cfg?.jasaLengkap?.enabled !== false ? (cfg?.jasaLengkap?.nominal ?? cfg?.biayaJasa ?? baseTemplate.biayaJasa) : 0);

      const template = {
        ...baseTemplate,
        biayaJasa: effectiveJasa,
        components: baseTemplate.components.map((c) =>
          c.ruleId === "JASA" ? { ...c, defaultValue: effectiveJasa } : c
        ),
      };

      const estimationInput: EstimationInput = {
        pkbDasar: pkb,
        tanggalJatuhTempo: formData.pkbBerlakuSd || "",
        tanggalEstimasi: new Date().toISOString().split("T")[0],
        programSamsat: r2ProgramSamsat,
        kondisiBerkas: r2KondisiBerkas,
        wilayahAccId: r2WilayahAccId,
        manualValues: r2ManualValues,
      };

      const r2Result = calculateEstimation(estimationInput, template);

      // Map R2 result items to OrderCostBreakdownItem[]
      const breakdown = r2Result.items
        .filter((it) => it.amount > 0 || it.includesInTotal)
        .map((it) => {
          let category: "Pajak" | "Jasa" | "Samsat" | "Operasional" = "Pajak";
          if (it.category === "JASA") category = "Jasa";
          else if (it.category === "ADMIN") category = "Samsat";
          else if (it.category === "INSIDENTAL") category = "Operasional";

          return {
            itemId: it.id,
            code: it.code,
            name: it.name,
            amount: it.amount,
            category,
            source: it.isManual
              ? ("Operasional" as const)
              : it.category === "JASA"
              ? ("BiayaLayanan" as const)
              : ("Kendaraan" as const),
            isRequired: !it.isManual,
          };
        });

      if (isAntarJemput && courierFee > 0) {
        breakdown.push({
          itemId: "fee-antar-jemput",
          code: "OPS-ANTARJEMPUT",
          name: `Layanan Kurir Antar-Jemput (${cfg?.antarJemputMode || "Antar & Jemput"})`,
          amount: courierFee,
          category: "Operasional",
          source: "Operasional",
          isRequired: false,
        });
      }

      kustomItems.forEach((ki) => breakdown.push(ki));

      const cetakSkpAmount = r2Result.items.find((i) => i.id === "cetak-skp")?.amount || 0;
      const prosesAccAmount = r2Result.items.find((i) => i.id === "proses-dan-acc-id")?.amount || 0;
      const jasaAmount = r2Result.items.find((i) => i.id === "jasa")?.amount ?? effectiveJasa;
      const grandTotal = r2Result.totalEstimasi + courierFee + totalKustomFees;

      const snapshot: any = {
        serviceId: "perpanjangan-1-tahun",
        serviceName: "Perpanjangan 1 Tahun",
        samsatId: resolveSamsatId(formData.wilayahSamsatAsal),
        samsatName: formData.wilayahSamsatAsal,
        metodeLayanan: formData.metodeLayanan,
        biayaJasa: jasaAmount,
        biayaPengurusanKhusus: isKhusus ? effectiveJasa : undefined,
        biayaSamsat: cetakSkpAmount + prosesAccAmount,
        biayaAntarJemput: courierFee,
        pkb: r2Result.totalPkb + r2Result.totalDendaPkb,
        swdkllj: r2Result.totalSwdkllj,
        dendaSwdkllj: r2Result.totalDendaSwdkllj + cetakSkpAmount + prosesAccAmount + r2Result.totalInsidental,
        totalEstimasi: grandTotal,
        breakdown,
        createdAt: new Date().toISOString(),
      };

      return {
        biayaJasa: jasaAmount,
        biayaSamsat: cetakSkpAmount + prosesAccAmount,
        biayaAntarJemput: courierFee,
        subtotalLayanan: r2Result.totalAdminDanJasa + r2Result.totalInsidental + courierFee + totalKustomFees,
        pkb: r2Result.totalPkb + r2Result.totalDendaPkb,
        swdkllj: r2Result.totalSwdkllj,
        dendaSwdkllj: r2Result.totalDendaSwdkllj + cetakSkpAmount + prosesAccAmount + r2Result.totalInsidental,
        total: grandTotal,
        breakdown,
        snapshot,
        isR4Annual: false,
        r4Result: undefined as EstimationResult | undefined,
        isR2Annual: true,
        r2Result,
        isExtendedEstimation: false,
        extResult: undefined as EstimationResult | undefined,
        extTemplate: undefined,
        courierFee,
        kustomItems,
        totalKustomFees,
      };
    }

    const extTemplateId = resolveEstimationTemplateId(formData.layanan, formData.jenisKendaraan);
    const isExtendedEstimation = Boolean(
      extTemplateId &&
      !isR4Annual &&
      !isR2Annual
    );

    if (isExtendedEstimation && extTemplateId) {
      const baseTemplate = estimationStore.getTemplate(extTemplateId);
      const isKhusus = extKondisiBerkas === "TIDAK ADA KTP" && Boolean(cfg?.biayaPengurusanKhusus?.enabled && (cfg.biayaPengurusanKhusus.nominal || 0) > 0);
      const effectiveJasa = isKhusus
        ? (cfg?.biayaPengurusanKhusus?.nominal || 0)
        : (cfg?.jasaLengkap?.enabled !== false ? (cfg?.jasaLengkap?.nominal ?? cfg?.biayaJasa ?? baseTemplate.biayaJasa) : 0);

      const template = {
        ...baseTemplate,
        biayaJasa: effectiveJasa,
        components: baseTemplate.components.map((c) =>
          c.ruleId === "JASA" ? { ...c, defaultValue: effectiveJasa } : c
        ),
      };

      const estimationInput: EstimationInput = {
        pkbDasar: pkb,
        tanggalJatuhTempo: formData.pkbBerlakuSd || "",
        tanggalEstimasi: new Date().toISOString().split("T")[0],
        programSamsat: extProgramSamsat,
        kondisiBerkas: extKondisiBerkas,
        wilayahAccId: extWilayahAccId,
        manualValues: extManualValues,
        freeBbn: extFreeBbn !== false,
        wilayahAsal: formData.wilayahSamsatAsal,
        wilayahTujuan: formData.wilayahSamsatTujuan,
      };

      const extResult = calculateEstimation(estimationInput, template);

      const breakdown = extResult.items
        .filter((it) => it.amount > 0 || it.includesInTotal)
        .map((it) => {
          let category: "Pajak" | "Jasa" | "Samsat" | "Operasional" = "Pajak";
          if (it.category === "JASA") category = "Jasa";
          else if (it.category === "ADMIN" || it.category === "PROSES" || it.category === "BBN") category = "Samsat";
          else if (it.category === "INSIDENTAL") category = "Operasional";

          return {
            itemId: it.id,
            code: it.code,
            name: it.name,
            amount: it.amount,
            category,
            source: it.isManual
              ? ("Operasional" as const)
              : it.category === "JASA"
              ? ("BiayaLayanan" as const)
              : ("Kendaraan" as const),
            isRequired: !it.isManual,
          };
        });

      if (isAntarJemput && courierFee > 0) {
        breakdown.push({
          itemId: "fee-antar-jemput",
          code: "OPS-ANTARJEMPUT",
          name: `Layanan Kurir Antar-Jemput (${cfg?.antarJemputMode || "Antar & Jemput"})`,
          amount: courierFee,
          category: "Operasional",
          source: "Operasional",
          isRequired: false,
        });
      }

      kustomItems.forEach((ki) => breakdown.push(ki));

      const jasaAmount = extResult.items.find((i) => i.category === "JASA")?.amount ?? effectiveJasa;
      const prosesAmount = extResult.items
        .filter((i) => i.category === "ADMIN" || i.category === "PROSES" || i.category === "BBN")
        .reduce((sum, i) => sum + i.amount, 0);

      const grandTotal = extResult.totalEstimasi + courierFee + totalKustomFees;

      const snapshot: any = {
        serviceId: resolveServiceId(formData.layanan),
        serviceName: formData.layanan,
        samsatId: resolveSamsatId(formData.wilayahSamsatAsal),
        samsatName: formData.wilayahSamsatAsal,
        metodeLayanan: formData.metodeLayanan,
        biayaJasa: jasaAmount,
        biayaPengurusanKhusus: isKhusus ? effectiveJasa : undefined,
        biayaSamsat: prosesAmount,
        biayaAntarJemput: courierFee,
        pkb: extResult.totalPkb + extResult.totalDendaPkb,
        swdkllj: extResult.totalSwdkllj,
        dendaSwdkllj: extResult.totalDendaSwdkllj + prosesAmount + extResult.totalInsidental,
        totalEstimasi: grandTotal,
        breakdown,
        createdAt: new Date().toISOString(),
      };

      return {
        biayaJasa: jasaAmount,
        biayaSamsat: prosesAmount,
        biayaAntarJemput: courierFee,
        subtotalLayanan: extResult.totalAdminDanJasa + extResult.totalInsidental + courierFee + totalKustomFees,
        pkb: extResult.totalPkb + extResult.totalDendaPkb,
        swdkllj: extResult.totalSwdkllj,
        dendaSwdkllj: extResult.totalDendaSwdkllj + prosesAmount + extResult.totalInsidental,
        total: grandTotal,
        breakdown,
        snapshot,
        isR4Annual: false,
        r4Result: undefined as EstimationResult | undefined,
        isR2Annual: false,
        r2Result: undefined as EstimationResult | undefined,
        isExtendedEstimation: true,
        extResult,
        extTemplate: template,
        courierFee,
        kustomItems,
        totalKustomFees,
      };
    }

    const isMutasiService = formData.layanan.includes("Mutasi");
    const snapshot = pricingStore.calculateOrderCost({
      serviceName: formData.layanan,
      wilayahSamsat: formData.wilayahSamsatAsal,
      wilayahSamsatTujuan: isMutasiService ? formData.wilayahSamsatTujuan : undefined,
      metodeLayanan: formData.metodeLayanan,
      tipeJasa: "Lengkap",
      pkb,
      swdkllj: isOpsenEnabled ? (parseFloat(formData.nominalSwdkllj) || undefined) : 0,
      dendaSwdkllj,
    });

    const subtotalLayanan = snapshot.biayaJasa + snapshot.biayaSamsat + snapshot.biayaAntarJemput;

    return {
      biayaJasa: snapshot.biayaJasa,
      biayaSamsat: snapshot.biayaSamsat,
      biayaAntarJemput: snapshot.biayaAntarJemput,
      subtotalLayanan,
      pkb: snapshot.pkb,
      swdkllj: snapshot.swdkllj,
      dendaSwdkllj: snapshot.dendaSwdkllj,
      total: snapshot.totalEstimasi,
      breakdown: snapshot.breakdown,
      snapshot,
      hasUnconfiguredTariff: Boolean(snapshot.hasUnconfiguredTariff || snapshot.completenessStatus === "PARTIAL_ESTIMATE"),
      unconfiguredItems: snapshot.unconfiguredItems || [],
      completenessStatus: snapshot.completenessStatus,
      isR4Annual: false,
      r4Result: undefined as EstimationResult | undefined,
      isR2Annual: false,
      r2Result: undefined as EstimationResult | undefined,
      isExtendedEstimation: false,
      extResult: undefined as EstimationResult | undefined,
      extTemplate: undefined,
      courierFee,
      kustomItems,
      totalKustomFees,
    };
  };

  const cost = calculateCost();

  // Document upload handler with automatic HEIC conversion & adaptive compression
  const handleDocFileSelect = async (docKey: string, file: File) => {
    setDocUploadErrors((prev) => {
      if (!prev[docKey]) return prev;
      const next = { ...prev };
      delete next[docKey];
      return next;
    });
    setSubmitError(null);
    try {
      const processed = await processDocumentUpload(file);
      setDocs((prev) => ({
        ...prev,
        [docKey]: {
          file: processed.file,
          name: processed.fileName,
          fileType: processed.fileType,
          fileUrl: processed.fileUrl,
          fileSize: formatFileSize(processed.fileSize),
          attached: true,
          documentId: undefined,
        },
      }));

      if (processed.compressed && processed.compressionRatio) {
        toast.success(
          `Dokumen ${processed.fileName} berhasil diproses (${formatFileSize(processed.originalSize)} ➔ ${formatFileSize(processed.fileSize)}, hemat ${processed.compressionRatio})!`
        );
      } else {
        toast.success(`Dokumen ${processed.fileName} berhasil dilampirkan.`);
      }
    } catch (err: any) {
      const classified = classifyActionError(err, { entityLabel: "Dokumen" });
      setDocUploadErrors((prev) => ({ ...prev, [docKey]: classified.message }));
      toast.error(classified.message || `Gagal memproses berkas ${file.name}`);
    }
  };

  const handleDocRemove = (docKey: string) => {
    setDocUploadErrors((prev) => {
      if (!prev[docKey]) return prev;
      const next = { ...prev };
      delete next[docKey];
      return next;
    });
    setDocs((prev) => ({
      ...prev,
      [docKey]: {
        file: undefined,
        name: "",
        fileType: "",
        fileUrl: undefined,
        fileSize: undefined,
        attached: false,
        documentId: undefined,
      },
    }));
    toast.info("Dokumen dihapus dari lampiran.");
  };

  // Payment proof handler with automatic HEIC conversion & adaptive compression
  const handlePaymentProofSelect = async (file: File) => {
    setPaymentProofUploadError("");
    setSubmitError(null);
    try {
      const processed = await processDocumentUpload(file);
      setPaymentProof({
        file: processed.file,
        name: processed.fileName,
        fileType: processed.fileType,
        fileUrl: processed.fileUrl,
        fileSize: formatFileSize(processed.fileSize),
        attached: true,
        documentId: undefined,
      });

      if (processed.compressed && processed.compressionRatio) {
        toast.success(
          `Bukti pembayaran ${processed.fileName} berhasil diproses (${formatFileSize(processed.originalSize)} ➔ ${formatFileSize(processed.fileSize)}, hemat ${processed.compressionRatio})!`
        );
      } else {
        toast.success(`Bukti pembayaran ${processed.fileName} berhasil diunggah.`);
      }
    } catch (err: any) {
      const classified = classifyActionError(err, { entityLabel: "Bukti pembayaran" });
      setPaymentProofUploadError(classified.message);
      toast.error(classified.message || `Gagal memproses bukti pembayaran ${file.name}`);
    }
  };

  const handlePaymentProofRemove = () => {
    setPaymentProofUploadError("");
    setPaymentProof({
      file: undefined,
      name: "",
      fileType: "",
      fileUrl: undefined,
      fileSize: undefined,
      attached: false,
      documentId: undefined,
    });
    toast.info("Bukti pembayaran dihapus.");
  };

  // Copy to clipboard
  const handleCopy = (text: string, type: "bank" | "qris") => {
    navigator.clipboard.writeText(text);
    if (type === "bank") {
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    } else {
      setCopiedQris(true);
      setTimeout(() => setCopiedQris(false), 2000);
    }
    toast.success("Tersalin ke clipboard!");
  };

  const handleReset = () => {
    setCurrentStep(1);
    setIsSameAsCustomer(false);
    setPlatePrefix("B");
    setPlateNumber("");
    setPlateSuffix("");
    setFormData({
      customer: "",
      namaPemilik: "",
      nomorHP: "",
      kepemilikanKendaraan: "Pribadi",
      layanan: "",
      serviceId: "",
      metodeLayanan: "Antar Jemput",
      jenisKendaraan: "Mobil",
      tahunKendaraan: new Date().getFullYear().toString(),
      wilayahSamsatAsal: "Jakarta Timur",
      samsatAsalId: "samsat-jakarta-timur",
      wilayahSamsatTujuan: "",
      samsatTujuanId: "",
      pkbBerlakuSd: "",
      tahunPajak: "",
      bulanPajak: "",
      nominalPkbTerakhir: "",
      nominalSwdkllj: "143000",
      tipePembayaran: "Bayar di Akhir",
      metodePembayaran: "Transfer Bank BCA",
      nominalDibayarAwal: "",
      jemputKota: "Jakarta Timur",
      jemputKecamatan: "",
      jemputKelurahan: "",
      jemputDetail: "",
      jemputRtRw: "",
      jemputNomor: "",
      jemputLandmark: "",
      jemputMapsUrl: "",
      antarKota: "Jakarta Timur",
      antarKecamatan: "",
      antarKelurahan: "",
      antarDetail: "",
      antarRtRw: "",
      antarNomor: "",
      antarLandmark: "",
      antarMapsUrl: "",
    });
    setDocs({
      stnk: { name: "", fileType: "", attached: false },
      bpkb: { name: "", fileType: "", attached: false },
      ktp: { name: "", fileType: "", attached: false },
      skkp: { name: "", fileType: "", attached: false },
      lainnya: { name: "", fileType: "", attached: false },
    });
    setPaymentProof({
      name: "",
      fileType: "",
      attached: false,
    });
    setIsSameAddress(true);
    setR4ProgramSamsat("NORMAL");
    setR4KondisiBerkas("LENGKAP");
    setR4WilayahAccId("DKI Jakarta");
    setR4ShowIncidentals(false);
    setR4ManualValues({
      jr: 0,
      etle: 0,
      "pnbp-nopil": 0,
      "stnk-hilang": 0,
      "pemekaran-wilayah": 0,
    });
    setStep1Errors({});
    setStep2Errors({});
    setDocUploadErrors({});
    setPaymentProofUploadError("");
    setSubmitError(null);
    idempotencyKeyRef.current = null;
    idempotencySignatureRef.current = null;
  };

  // Step 1 Validation Helper
  const validateStep1Fields = (): { isValid: boolean; errors: Record<string, string>; firstKey?: string } => {
    const errors: Record<string, string> = {};

    if (!formData.customer.trim()) {
      errors.customer = "Nama Customer wajib diisi!";
    }
    if (!formData.nomorHP.trim()) {
      errors.nomorHP = "Nomor Telepon wajib diisi!";
    } else if (formData.nomorHP.length < 9) {
      errors.nomorHP = "Nomor Telepon minimal terdiri dari 9 digit angka!";
    }
    if (!formData.layanan) {
      errors.layanan = "Silakan pilih jenis pengurusan terlebih dahulu!";
    }
    if (!plateNumber.trim()) {
      errors.plateNumber = "Nomor polisi kendaraan wajib diisi!";
    }
    if (formData.layanan.includes("Mutasi") && !formData.wilayahSamsatTujuan) {
      errors.wilayahSamsatTujuan = "Wilayah Samsat Tujuan wajib dipilih untuk layanan Mutasi!";
    }
    if (formData.metodeLayanan === "Antar Jemput" && !formData.jemputDetail.trim()) {
      errors.jemputDetail = "Detail alamat penjemputan dokumen wajib diisi untuk layanan Antar Jemput!";
    }
    if (!formData.pkbBerlakuSd || !formData.pkbBerlakuSd.trim()) {
      errors.pkbBerlakuSd = "Masa Berlaku PKB S/D (Tanggal) wajib diisi!";
    } else {
      const parts = parseDateParts(formData.pkbBerlakuSd);
      if (!parts || parts.y < 1900 || parts.y > 2100) {
        errors.pkbBerlakuSd = "Format tanggal Masa Berlaku PKB S/D tidak valid!";
      }
    }

    const keys = Object.keys(errors);
    return {
      isValid: keys.length === 0,
      errors,
      firstKey: keys[0],
    };
  };

  const focusAndScrollToError = (fieldKey: string) => {
    const el = document.getElementById(`field-${fieldKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const inputEl = el.querySelector("input, select, textarea") || el;
      if (inputEl && typeof (inputEl as any).focus === "function") {
        (inputEl as any).focus();
      }
    }
  };

  // Step 1 Validation
  const handleNextStep1 = () => {
    const validation = validateStep1Fields();

    if (!validation.isValid) {
      setStep1Errors(validation.errors);
      toast.error(validation.errors[validation.firstKey!] || "Lengkapi data yang wajib diisi terlebih dahulu.");
      focusAndScrollToError(validation.firstKey!);
      return;
    }

    setStep1Errors({});
    setCurrentStep(2);
  };

  // Step 2 Validation
  const handleNextStep2 = () => {
    if (formData.tipePembayaran === "Bayar di Awal") {
      if (!formData.metodePembayaran) {
        toast.error("Untuk pilihan 'Bayar di Awal', metode pembayaran wajib dipilih!");
        return;
      }
      const rawNominal = formData.nominalDibayarAwal ? formData.nominalDibayarAwal.replace(/[^0-9]/g, "") : "";
      if (!rawNominal) {
        toast.error("Nominal dibayar di awal wajib diisi!");
        return;
      }
      const parsed = Number(rawNominal);
      if (isNaN(parsed) || parsed < 0) {
        toast.error("Nominal dibayar di awal tidak valid!");
        return;
      }

    }
    setCurrentStep(3);
  };

  const handleSubmitOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || isSubmittingRef.current) return;

    const fullNopol = getCombinedNopol();

    // Final Validations using consistent Step 1 validation
    const validation = validateStep1Fields();
    if (!validation.isValid) {
      setStep1Errors(validation.errors);
      setCurrentStep(1);
      const firstErrMsg = validation.errors[validation.firstKey!] || "Lengkapi data wajib diisi terlebih dahulu.";
      toast.error(firstErrMsg);
      setTimeout(() => {
        focusAndScrollToError(validation.firstKey!);
      }, 100);
      return;
    }
    setStep1Errors({});

    const nextStep2Errors: { metodePembayaran?: string; nominalDibayarAwal?: string } = {};
    if (formData.tipePembayaran === "Bayar di Awal") {
      if (!formData.metodePembayaran) {
        nextStep2Errors.metodePembayaran = "Untuk pilihan 'Bayar di Awal', metode pembayaran wajib dipilih.";
      }
      const rawNominal = formData.nominalDibayarAwal ? formData.nominalDibayarAwal.replace(/[^0-9]/g, "") : "";
      if (!rawNominal) {
        nextStep2Errors.nominalDibayarAwal = "Nominal dibayar di awal wajib diisi.";
      } else {
        const parsed = Number(rawNominal);
        if (isNaN(parsed) || parsed <= 0) {
          nextStep2Errors.nominalDibayarAwal = "Nominal dibayar di awal harus lebih besar dari Rp 0.";
        }
      }
    }

    if (Object.keys(nextStep2Errors).length > 0) {
      setStep2Errors(nextStep2Errors);
      setCurrentStep(2);
      const firstMsg = nextStep2Errors.metodePembayaran || nextStep2Errors.nominalDibayarAwal || "Periksa informasi pembayaran.";
      setSubmitError(
        classifyActionError({
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: firstMsg,
          field: nextStep2Errors.metodePembayaran ? "metodePembayaran" : "nominalDibayarAwal",
        })
      );
      toast.error(firstMsg);
      return;
    }
    setStep2Errors({});
    setDocUploadErrors({});
    setPaymentProofUploadError("");
    setSubmitError(null);

    // Lock synchronously to prevent double invocation from event bubbling/rapid clicks
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // Compute payload signature to reuse clientRequestId / X-Idempotency-Key safely on retries
    const submissionSignature = JSON.stringify({
      customer: formData.customer.trim(),
      namaPemilik: formData.namaPemilik.trim(),
      nomorHP: formData.nomorHP.trim(),
      layanan: formData.layanan,
      serviceId: formData.serviceId,
      metodeLayanan: formData.metodeLayanan,
      jenisKendaraan: formData.jenisKendaraan,
      tahunKendaraan: formData.tahunKendaraan,
      nopol: fullNopol,
      samsatAsalId: formData.samsatAsalId,
      samsatTujuanId: requiresSamsatTujuan ? formData.samsatTujuanId : "",
      pkbBerlakuSd: formData.pkbBerlakuSd,
      nominalPkbTerakhir: formData.nominalPkbTerakhir,
      nominalSwdkllj: formData.nominalSwdkllj,
      tipePembayaran: formData.tipePembayaran,
      metodePembayaran: formData.metodePembayaran,
      nominalDibayarAwal: formData.nominalDibayarAwal,
      jemputDetail: formData.jemputDetail,
      antarDetail: isSameAddress ? formData.jemputDetail : formData.antarDetail,
      docNames: Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, v.attached ? v.name : ""])),
      proofName: paymentProof.attached ? paymentProof.name : "",
      total: cost.total,
    });

    if (!idempotencyKeyRef.current || idempotencySignatureRef.current !== submissionSignature) {
      idempotencyKeyRef.current = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      idempotencySignatureRef.current = submissionSignature;
    }

    try {
      const defaultJemputDetail = formData.metodeLayanan === "Datang Langsung" && !formData.jemputDetail.trim()
        ? "Loket Biro Jasa SUN89 (Datang Langsung)"
        : formData.jemputDetail;
      const defaultAntarDetail = formData.metodeLayanan === "Datang Langsung" && !formData.antarDetail.trim()
        ? "Loket Biro Jasa SUN89 (Ambil di Loket)"
        : (formData.antarDetail || defaultJemputDetail);

      const alamatPenjemputan: StructuredAddress = {
        kota: formData.jemputKota,
        kecamatan: formData.jemputKecamatan,
        kelurahan: formData.jemputKelurahan,
        detail: defaultJemputDetail,
        rtRw: formData.jemputRtRw,
        nomor: formData.jemputNomor,
        landmark: formData.jemputLandmark,
        mapsUrl: formData.jemputMapsUrl || undefined,
      };

      const alamatPengantaran: StructuredAddress = isSameAddress
        ? { ...alamatPenjemputan }
        : {
            kota: formData.antarKota,
            kecamatan: formData.antarKecamatan,
            kelurahan: formData.antarKelurahan,
            detail: defaultAntarDetail,
            rtRw: formData.antarRtRw,
            nomor: formData.antarNomor,
            landmark: formData.antarLandmark,
            mapsUrl: formData.antarMapsUrl || undefined,
          };

      // Upload attached documents BEFORE creating order (abort transparently if upload fails in API mode)
      const clientDocuments: Record<string, OrderDocument> = {};
      for (const key of Object.keys(docs)) {
        const item = docs[key];
        let fileUrl = item.fileUrl;
        let docId: string | undefined = item.documentId;
        if (item.attached && item.file && !docId) {
          try {
            const uploaded = await documentRepository.uploadDocument(item.file, { documentType: key });
            fileUrl = uploaded.fileUrl;
            docId = uploaded.id;
            setDocs((prev) => ({
              ...prev,
              [key]: { ...prev[key], fileUrl, documentId: docId },
            }));
          } catch (uploadErr) {
            if (APP_CONFIG.dataProvider === "api") {
              const classifiedUploadErr = classifyActionError(uploadErr, { entityLabel: `Dokumen ${item.name || key}` });
              setDocUploadErrors((prev) => ({
                ...prev,
                [key]: `Gagal mengunggah ${item.name || key}: ${classifiedUploadErr.message}`,
              }));
              throw classifiedUploadErr;
            }
            console.warn(`[BuatOrder] Upload warning for ${key} (mock mode):`, uploadErr);
          }
        }
        clientDocuments[key] = {
          name: item.attached ? item.name : "",
          status: item.attached ? "Sudah Tersedia" : "Belum Tersedia",
          isOptional: true,
          updatedAt: item.attached ? new Date().toISOString().split("T")[0] : undefined,
          fileType: item.fileType || undefined,
          fileUrl: fileUrl || undefined,
          fileSize: item.fileSize || undefined,
          documentId: docId,
        };
      }

      // Proof of payment for Bayar di Awal
      let buktiBayarPayload: PaymentProof | undefined;
      if (formData.tipePembayaran === "Bayar di Awal" && paymentProof.attached) {
        let paymentUrl = paymentProof.fileUrl;
        let paymentDocId: string | undefined = paymentProof.documentId;
        if (paymentProof.file && !paymentDocId) {
          try {
            const uploaded = await documentRepository.uploadDocument(paymentProof.file, { documentType: "BUKTI_PEMBAYARAN" });
            paymentUrl = uploaded.fileUrl;
            paymentDocId = uploaded.id;
            setPaymentProof((prev) => ({ ...prev, fileUrl: paymentUrl, documentId: paymentDocId }));
          } catch (uploadErr) {
            if (APP_CONFIG.dataProvider === "api") {
              const classifiedProofErr = classifyActionError(uploadErr, { entityLabel: "Bukti pembayaran" });
              setPaymentProofUploadError(`Gagal mengunggah bukti pembayaran: ${classifiedProofErr.message}`);
              throw classifiedProofErr;
            }
            console.warn("[BuatOrder] Payment proof upload warning (mock mode):", uploadErr);
          }
        }
        buktiBayarPayload = {
          fileName: paymentProof.name,
          fileType: paymentProof.fileType as "image" | "pdf",
          fileUrl: paymentUrl,
          fileSize: paymentProof.fileSize,
          uploadedAt: new Date().toISOString(),
          documentId: paymentDocId,
        };
      }

      const paymentMethodResolved =
        formData.tipePembayaran === "Bayar di Awal"
          ? formData.metodePembayaran
          : formData.metodePembayaran || "Cash (Saat Dokumen Diterima)";

      const selectedPm = activeMethods.find((m) => m.nama_metode === paymentMethodResolved);
      const isBayarAwal = formData.tipePembayaran === "Bayar di Awal";
      const nominalAwal = isBayarAwal ? (parseFloat(formData.nominalDibayarAwal.replace(/[^0-9]/g, "")) || 0) : 0;
      const nowIso = new Date().toISOString();

      const createdOrder = await orderStore.addOrderAsync({
        clientRequestId: idempotencyKeyRef.current,
        customer: formData.customer.trim(),
        namaPemilik: formData.namaPemilik.trim() || formData.customer.trim(),
        nomorHP: formData.nomorHP.trim(),
        tanggalMasukBerkas: formData.metodeLayanan === "Datang Langsung" ? nowIso : undefined,
        layanan: formData.layanan,
        service_id: formData.serviceId || selectedServiceItem?.id,
        serviceId: formData.serviceId || selectedServiceItem?.id,
        samsat_asal_id: formData.samsatAsalId || "samsat-jakarta-timur",
        samsatAsalId: formData.samsatAsalId || "samsat-jakarta-timur",
        samsat_tujuan_id: requiresSamsatTujuan ? (formData.samsatTujuanId || undefined) : undefined,
        samsatTujuanId: requiresSamsatTujuan ? (formData.samsatTujuanId || undefined) : undefined,
        metodeLayanan: formData.metodeLayanan,
        costBreakdown: cost.breakdown,
        costSnapshot: cost.snapshot,
        kepemilikanKendaraan: formData.kepemilikanKendaraan,
        jenisKendaraan: formData.jenisKendaraan,
        tahunKendaraan: formData.tahunKendaraan,
        nopol: fullNopol,
        wilayahSamsatAsal: formData.wilayahSamsatAsal,
        wilayahSamsatTujuan: formData.layanan.includes("Mutasi") ? (formData.wilayahSamsatTujuan || "") : (formData.wilayahSamsatAsal || ""),
        pkbBerlakuSd: formData.pkbBerlakuSd,
        tahunPajak: formData.tahunPajak || (formData.pkbBerlakuSd ? formData.pkbBerlakuSd.split("-")[0] : ""),
        bulanPajak: formData.bulanPajak || (formData.pkbBerlakuSd ? (getMonthNameFromDate(formData.pkbBerlakuSd) || "") : ""),
        nominalPkbTerakhir: parseFloat(formData.nominalPkbTerakhir) || 0,
        nominalSwdkllj: parseFloat(formData.nominalSwdkllj) || 143000,
        biayaJasa: cost.biayaJasa,
        pkb: cost.pkb,
        swdkllj: cost.swdkllj,
        dendaSwdkllj: cost.dendaSwdkllj,
        totalEstimasi: cost.total,
        alamatPenjemputan,
        alamatPengantaran,
        clientDocuments,
        orderSource: "Offline / Loket",
        createdBy: currentUserName,
        createdById: currentUserId,
        createdByRole: currentUserRole,
        estimationResult: cost.r4Result || cost.r2Result || cost.extResult,
        payment: {
          tipePembayaran: (formData.tipePembayaran as string) === "Tempo" ? "Bayar di Akhir" : formData.tipePembayaran,
          metodePembayaran: paymentMethodResolved,
          namaBank: selectedPm?.bank || (paymentMethodResolved.includes("BCA") ? "BCA" : paymentMethodResolved.includes("BRI") ? "BRI" : paymentMethodResolved.includes("Mandiri") ? "Mandiri" : "Tunai"),
          namaRekening: selectedPm?.nama_rekening || "",
          noRekening: selectedPm?.nomor_rekening || "",
          tanggalBayar: isBayarAwal && nominalAwal > 0 ? nowIso : undefined,
          statusPembayaran: isBayarAwal
            ? (nominalAwal >= cost.total ? "Lunas" : nominalAwal > 0 ? "Kurang Bayar" : "Belum Bayar")
            : "Belum Lunas",
          totalBiaya: cost.total,
          dibayar: nominalAwal,
          kurang: isBayarAwal ? Math.max(0, cost.total - nominalAwal) : cost.total,
          overpayment: isBayarAwal ? Math.max(0, nominalAwal - cost.total) : 0,
          nominalDibayarAwal: isBayarAwal ? nominalAwal : undefined,
          buktiPembayaran: buktiBayarPayload,
          isPaymentVerified: false,
          paymentRecords: isBayarAwal && nominalAwal > 0 ? [
            {
              id: `pay-${Date.now()}`,
              nominal: nominalAwal,
              tanggal: nowIso,
              metodePembayaran: paymentMethodResolved,
              namaBank: selectedPm?.bank || (paymentMethodResolved.includes("BCA") ? "BCA" : paymentMethodResolved.includes("BRI") ? "BRI" : paymentMethodResolved.includes("Mandiri") ? "Mandiri" : "Tunai"),
              namaRekening: selectedPm?.nama_rekening,
              noRekening: selectedPm?.nomor_rekening,
              buktiPembayaran: buktiBayarPayload,
              statusVerifikasi: buktiBayarPayload ? "MENUNGGU_VERIFIKASI" : "MENUNGGU_BUKTI",
              uploadedBy: currentUserName,
            }
          ] : [],
        },
      } as any);

      idempotencyKeyRef.current = null;
      idempotencySignatureRef.current = null;
      setCreatedOrderSuccess(createdOrder);
      onOrderCreated?.(createdOrder);
      if (formData.metodeLayanan === "Datang Langsung" || createdOrder.metodeLayanan === "Datang Langsung") {
        toast.success(`Order ${createdOrder.orderNo} berhasil dibuat dan langsung masuk ke tahap Verifikasi Dokumen (Datang Langsung)!`);
      } else {
        toast.success(`Order ${createdOrder.orderNo} berhasil dibuat dan otomatis masuk ke tahap Verifikasi!`);
      }
      setStep1Errors({});
      setStep2Errors({});
      setSubmitError(null);
    } catch (err: any) {
      const classified = classifyActionError(err, { entityLabel: "Order" });
      if (classified.code === "IDEMPOTENCY_CONFLICT") {
        idempotencyKeyRef.current = null;
        idempotencySignatureRef.current = null;
      }
      if (classified.field === "metodePembayaran" || classified.field === "nominalDibayarAwal") {
        setStep2Errors((prev) => ({ ...prev, [classified.field!]: classified.message }));
      } else if (classified.field) {
        setStep1Errors((prev) => ({ ...prev, [classified.field!]: classified.message }));
      }
      setSubmitError(classified);
      toast.error(classified.message);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const samsatList = pricingStore.getSamsatList();

  return (
    <div className="w-full space-y-5 min-w-0 text-left content-fluid">
      {/* STEPPER NAVIGATION (2 Steps) */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted/40 rounded-xl border border-border/60">
        {[
          { step: 1, label: "01 Data Klien & Kendaraan", desc: "Klien, Kendaraan & Layanan", short: "01 Klien" },
          { step: 2, label: "02 Dokumen, Pembayaran & Ringkasan", desc: "Upload Berkas, Pembayaran & Estimasi", short: "02 Dokumen & Bayar" },
        ].map((s) => {
          const isActive = currentStep === s.step;
          const isDone = currentStep > s.step;
          return (
            <button
              key={s.step}
              type="button"
              aria-label={`${s.label}: ${s.desc}`}
              aria-current={isActive ? "step" : undefined}
              onClick={() => {
                if (s.step < currentStep) setCurrentStep(s.step as 1 | 2);
                else if (s.step === 2 && currentStep === 1) handleNextStep1();
              }}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2.5 p-2 sm:p-2.5 rounded-lg text-left transition-all min-w-0 justify-center sm:justify-start",
                isActive
                  ? "bg-card border border-border shadow-xs text-foreground"
                  : isDone
                  ? "hover:bg-muted/60 text-foreground/80 cursor-pointer"
                  : "opacity-60 cursor-not-allowed text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold shrink-0 transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground border border-border"
                )}
              >
                {isDone ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : s.step}
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="text-xs font-semibold truncate leading-tight">{s.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.desc}</p>
              </div>
              <div className="min-w-0 sm:hidden">
                <p className="text-[11px] font-semibold truncate leading-tight">{s.short}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="p-4 sm:p-5 md:p-6 border-border/80 shadow-xs bg-card">
        <form onSubmit={handleSubmitOrder} noValidate className="space-y-6">
          <AnimatePresence mode="wait">
            {/* ======================================================== */}
            {/* STEP 1: DATA KLIEN, KENDARAAN & INFORMASI ORDER           */}
            {/* ======================================================== */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-8 md:space-y-10"
              >
                {/* 1. DATA KLIEN & PEMILIK */}
                <div className="space-y-4 p-4 sm:p-5 rounded-xl border border-border/70 bg-card shadow-xs">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                    <User className="w-3.5 h-3.5 text-primary" />
                    1. Data Klien & Pemilik Kendaraan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div id="field-customer" className="space-y-1.5">
                      <Label htmlFor="input-customer" className="text-xs">
                        Nama Customer <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="input-customer"
                        required
                        placeholder="Nama pemesan atau instansi klien"
                        value={formData.customer}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            customer: val,
                            ...(isSameAsCustomer ? { namaPemilik: val } : {}),
                          }));
                          clearFieldError("customer");
                        }}
                        className={cn(
                          "bg-input-background border-border h-9 text-xs",
                          step1Errors.customer && "border-destructive ring-1 ring-destructive/40"
                        )}
                      />
                      {step1Errors.customer && (
                        <p className="text-[11px] text-destructive mt-1 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 shrink-0" /> {step1Errors.customer}
                        </p>
                      )}
                    </div>

                    <div id="field-nomorHP" className="space-y-1.5">
                      <Label htmlFor="input-nomorHP" className="text-xs">
                        Nomor Telepon <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="input-nomorHP"
                        required
                        placeholder="Contoh: 081234567890"
                        value={formData.nomorHP}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(/\D/g, "");
                          setFormData({ ...formData, nomorHP: sanitized });
                          clearFieldError("nomorHP");
                        }}
                        className={cn(
                          "bg-input-background border-border h-9 text-xs font-mono tabular-nums",
                          step1Errors.nomorHP && "border-destructive ring-1 ring-destructive/40"
                        )}
                      />
                      {step1Errors.nomorHP && (
                        <p className="text-[11px] text-destructive mt-1 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 shrink-0" /> {step1Errors.nomorHP}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="input-namaPemilik" className="text-xs">Nama Pemilik Sesuai STNK/BPKB</Label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground select-none">
                          <input
                            type="checkbox"
                            checked={isSameAsCustomer}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsSameAsCustomer(checked);
                              if (checked) {
                                setFormData((prev) => ({ ...prev, namaPemilik: prev.customer }));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
                          />
                          <span>Sama dengan nama customer</span>
                        </label>
                      </div>
                      <Input
                        id="input-namaPemilik"
                        placeholder={isSameAsCustomer ? (formData.customer || "Sama dengan nama customer") : "Nama pemilik sesuai STNK/BPKB"}
                        value={formData.namaPemilik}
                        disabled={isSameAsCustomer}
                        onChange={(e) => setFormData({ ...formData, namaPemilik: e.target.value })}
                        className={cn(
                          "bg-input-background border-border h-9 text-xs",
                          isSameAsCustomer && "bg-muted/40 cursor-not-allowed opacity-80"
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Status Kepemilikan</Label>
                      <Select
                        value={formData.kepemilikanKendaraan}
                        onValueChange={(value) => setFormData({ ...formData, kepemilikanKendaraan: value })}
                      >
                        <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                          <SelectValue placeholder="Pilih status kepemilikan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pribadi" className="text-xs">Pribadi</SelectItem>
                          <SelectItem value="Perusahaan" className="text-xs">Perusahaan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* 2. DATA KENDARAAN & LAYANAN */}
                <div className="space-y-4 p-4 sm:p-5 rounded-xl border border-border/70 bg-card shadow-xs">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                    <Car className="w-3.5 h-3.5 text-primary" />
                    2. Data Kendaraan & Layanan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Jenis Layanan */}
                    <div id="field-layanan" className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">
                        Jenis Pengurusan <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.layanan}
                        onValueChange={(value) => {
                          const matchedSvc = availableServices.find((s: ServiceItem) => s.nama_layanan === value || s.id === value);
                          const serviceName = matchedSvc ? matchedSvc.nama_layanan : value;
                          const serviceId = matchedSvc ? matchedSvc.id : "";
                          const isMutasi = serviceName.includes("Mutasi") || matchedSvc?.memerlukan_samsat_tujuan === 1;
                          const cfg = pricingStore.getServiceFeeConfig(serviceName, formData.wilayahSamsatAsal);
                          const swdNominal = cfg?.swdkllj?.enabled !== false ? String(cfg?.swdkllj?.nominal || 143000) : "0";
                          setFormData((prev) => ({
                            ...prev,
                            layanan: serviceName,
                            serviceId: serviceId,
                            nominalSwdkllj: (swdNominal !== undefined) ? swdNominal : prev.nominalSwdkllj,
                            wilayahSamsatTujuan: isMutasi ? prev.wilayahSamsatTujuan : "",
                            samsatTujuanId: isMutasi ? prev.samsatTujuanId : "",
                          }));
                          clearFieldError("layanan");
                        }}
                      >
                        <SelectTrigger className={cn("bg-input-background border-border h-9 text-xs", step1Errors.layanan && "border-destructive ring-1 ring-destructive/40")}>
                          <SelectValue placeholder={isServicesLoading ? "Memuat layanan..." : "Pilih jenis pengurusan Samsat"} />
                        </SelectTrigger>
                        <SelectContent>
                          {isServicesLoading ? (
                            <div className="py-2 px-3 text-xs text-muted-foreground">Memuat layanan dari database...</div>
                          ) : availableServices.length === 0 ? (
                            <div className="py-2 px-3 text-xs text-muted-foreground">Tidak ada layanan aktif</div>
                          ) : (
                            availableServices.map((svc: ServiceItem) => (
                              <SelectItem key={svc.id} value={svc.nama_layanan} className="text-xs">
                                {svc.nama_layanan}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {step1Errors.layanan && (
                        <p className="text-[11px] text-destructive mt-1 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 shrink-0" /> {step1Errors.layanan}
                        </p>
                      )}
                    </div>

                    {/* Metode Layanan */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Metode Layanan</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div
                          onClick={() => setFormData({ ...formData, metodeLayanan: "Antar Jemput" })}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5",
                            formData.metodeLayanan === "Antar Jemput"
                              ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                              : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                              formData.metodeLayanan === "Antar Jemput"
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground"
                            )}
                          >
                            {formData.metodeLayanan === "Antar Jemput" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-xs text-foreground">Antar Jemput</p>
                              {!isAntarJemputEnabled && (
                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                                  Nonaktif di Master
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {isAntarJemputEnabled
                                ? "Kurir menjemput berkas ke alamat klien."
                                : "Kurir antar jemput berkas (Tarif dinonaktifkan di Master Data)."}
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            setFormData({ ...formData, metodeLayanan: "Datang Langsung" });
                            clearFieldError("jemputDetail");
                          }}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5",
                            formData.metodeLayanan === "Datang Langsung"
                              ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                              : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                              formData.metodeLayanan === "Datang Langsung"
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground"
                            )}
                          >
                            {formData.metodeLayanan === "Datang Langsung" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-foreground">Datang Langsung</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Klien menyerahkan berkas langsung di loket.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Jenis Kendaraan */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Jenis Kendaraan</Label>
                      <Select
                        value={formData.jenisKendaraan}
                        onValueChange={(value) => setFormData({ ...formData, jenisKendaraan: value })}
                      >
                        <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                          <SelectValue placeholder="Pilih jenis kendaraan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mobil" className="text-xs">Mobil (Roda 4)</SelectItem>
                          <SelectItem value="Motor" className="text-xs">Motor (Roda 2)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tahun Pembuatan Kendaraan */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tahun Pembuatan Kendaraan</Label>
                      <Input
                        placeholder="Contoh: 2022"
                        value={formData.tahunKendaraan}
                        onChange={(e) => setFormData({ ...formData, tahunKendaraan: e.target.value.replace(/\D/g, "") })}
                        className="bg-input-background border-border h-9 text-xs font-mono tabular-nums"
                      />
                    </div>

                    {/* 3-PART NOMOR POLISI INPUT */}
                    <div id="field-plateNumber" className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="input-plateNumber" className="text-xs font-medium text-foreground">
                        Nomor Polisi <span className="text-destructive">*</span>
                      </Label>
                      <PlateNumberInput
                        value={getCombinedNopol()}
                        onChange={(_full, parts) => {
                          setPlatePrefix(parts.prefix);
                          setPlateNumber(parts.number);
                          setPlateSuffix(parts.suffix);
                          if (parts.number) clearFieldError("plateNumber");
                        }}
                        hasError={Boolean(step1Errors.plateNumber)}
                        id="input-plateNumber"
                      />
                      {step1Errors.plateNumber && (
                        <p className="text-[11px] text-destructive mt-1 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 shrink-0" /> {step1Errors.plateNumber}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Format standar: [Plat Awal] [Nomor Plat] [Plat Akhir] • Hasil:{" "}
                        <strong className="font-mono text-foreground">{getCombinedNopol() || "B 1234 ABC"}</strong>
                      </p>
                    </div>

                    {/* Wilayah Samsat Asal */}
                    <div id="field-wilayahSamsatAsal" className="space-y-1.5">
                      <Label className="text-xs">Wilayah Samsat Asal</Label>
                      <SearchableSamsatSelect
                        value={formData.wilayahSamsatAsal}
                        onValueChange={(value, item) => {
                          const cfg = pricingStore.getServiceFeeConfig(formData.layanan, value);
                          const swdNominal = cfg?.swdkllj?.enabled !== false ? String(cfg?.swdkllj?.nominal || 143000) : "0";
                          setFormData((prev) => ({
                            ...prev,
                            wilayahSamsatAsal: value,
                            samsatAsalId: item?.id || prev.samsatAsalId,
                            nominalSwdkllj: swdNominal,
                            wilayahSamsatTujuan: (prev.layanan.includes("Mutasi") || requiresSamsatTujuan) ? prev.wilayahSamsatTujuan : value,
                            samsatTujuanId: (prev.layanan.includes("Mutasi") || requiresSamsatTujuan) ? prev.samsatTujuanId : (item?.id || prev.samsatAsalId),
                          }));
                        }}
                        placeholder="Pilih Samsat Asal"
                        id="select-wilayahSamsatAsal"
                      />
                    </div>

                    {/* Wilayah Samsat Tujuan (HANYA DITAMPILKAN JIKA LAYANAN = MUTASI ATAU MEMERLUKAN SAMSAT TUJUAN) */}
                    {(formData.layanan.includes("Mutasi") || requiresSamsatTujuan) && (
                      <div id="field-wilayahSamsatTujuan" className="space-y-1.5">
                        <Label className="text-xs">
                          Wilayah Samsat Tujuan <span className="text-destructive">*</span>
                        </Label>
                        <SearchableSamsatSelect
                          value={formData.wilayahSamsatTujuan}
                          onValueChange={(value, item) => {
                            setFormData((prev) => ({
                              ...prev,
                              wilayahSamsatTujuan: value,
                              samsatTujuanId: item?.id || prev.samsatTujuanId,
                            }));
                            clearFieldError("wilayahSamsatTujuan");
                          }}
                          placeholder="Pilih Samsat Tujuan"
                          error={!!step1Errors.wilayahSamsatTujuan}
                          id="select-wilayahSamsatTujuan"
                        />
                        {step1Errors.wilayahSamsatTujuan && (
                          <p className="text-[11px] text-destructive mt-1 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {step1Errors.wilayahSamsatTujuan}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. INFORMASI PAJAK KENDARAAN */}
                <div className="space-y-4 p-4 sm:p-5 rounded-xl border border-border/70 bg-card shadow-xs">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    3. Informasi Pajak Kendaraan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div id="field-pkbBerlakuSd" className="space-y-1.5">
                      <Label htmlFor="input-pkbBerlakuSd" className="text-xs">
                        Masa Berlaku PKB S/D (Tanggal) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="input-pkbBerlakuSd"
                        type="date"
                        value={formData.pkbBerlakuSd}
                        onChange={(e) => {
                          const val = e.target.value;
                          const parts = parseDateParts(val);
                          const derivedMonth = parts ? bulanOptions[parts.m - 1] : "";
                          const derivedYear = parts ? String(parts.y) : "";
                          setFormData((prev) => ({
                            ...prev,
                            pkbBerlakuSd: val,
                            bulanPajak: derivedMonth,
                            tahunPajak: derivedYear,
                          }));
                          clearFieldError("pkbBerlakuSd");
                        }}
                        className={cn(
                          "bg-input-background border-border h-9 text-xs",
                          step1Errors.pkbBerlakuSd && "border-destructive ring-1 ring-destructive/40"
                        )}
                      />
                      {step1Errors.pkbBerlakuSd && (
                        <p className="text-[11px] text-destructive mt-1 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 shrink-0" /> {step1Errors.pkbBerlakuSd}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Nominal PKB Terakhir (Rp)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.nominalPkbTerakhir}
                        onChange={(e) => setFormData({ ...formData, nominalPkbTerakhir: e.target.value })}
                        className="bg-input-background border-border h-9 text-xs font-mono tabular-nums"
                      />
                    </div>

                    {/* OPSEN PKB (STANDARDIZED LABEL) */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Nominal OPSEN PKB (Rp)</Label>
                        {!isOpsenEnabled && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                            Nonaktif di Master
                          </Badge>
                        )}
                        {isR4Annual && (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                            Otomatis R4 (Rp 143.000 + Tunggakan)
                          </Badge>
                        )}
                        {isR2Annual && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            Otomatis R2 (Rp 35.000 + Tunggakan)
                          </Badge>
                        )}
                        {cost.isExtendedEstimation && cost.extTemplate && (
                          <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20">
                            Otomatis {cost.extTemplate.name}
                          </Badge>
                        )}
                      </div>
                      <Input
                        type="number"
                        placeholder={isR4Annual ? "143000 (Otomatis)" : isR2Annual ? "35000 (Otomatis)" : cost.isExtendedEstimation ? `${cost.extResult?.totalSwdkllj || 0} (Otomatis)` : (isOpsenEnabled ? "143000" : "0")}
                        disabled={!isOpsenEnabled || isR4Annual || isR2Annual || cost.isExtendedEstimation}
                        value={isR4Annual ? (cost.r4Result?.totalSwdkllj.toString() || "143000") : isR2Annual ? (cost.r2Result?.totalSwdkllj.toString() || "35000") : cost.isExtendedEstimation ? (cost.extResult?.totalSwdkllj.toString() || "0") : (isOpsenEnabled ? formData.nominalSwdkllj : "0")}
                        onChange={(e) => setFormData({ ...formData, nominalSwdkllj: e.target.value })}
                        className={cn(
                          "bg-input-background border-border h-9 text-xs font-mono tabular-nums",
                          (!isOpsenEnabled || isR4Annual || isR2Annual || cost.isExtendedEstimation) && "opacity-60 bg-muted cursor-not-allowed"
                        )}
                      />
                      {!isOpsenEnabled && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                          OPSEN PKB dinonaktifkan pada Master Data Biaya Layanan dan tidak dihitung ke estimasi.
                        </p>
                      )}
                      {isR4Annual && (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">
                          Perpanjangan 1 Tahun Mobil (R4) menggunakan formula resmi: SWDKLLJ Pokok Rp 143.000 + SWDKLLJ Tertunggak ({cost.r4Result?.tahunTunggakan || 0} thn).
                        </p>
                      )}
                      {isR2Annual && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          Perpanjangan 1 Tahun Motor (R2) menggunakan formula resmi: SWDKLLJ Pokok Rp 35.000 + SWDKLLJ Tertunggak ({cost.r2Result?.tahunTunggakan || 0} thn).
                        </p>
                      )}
                      {cost.isExtendedEstimation && cost.extResult && cost.extTemplate && (
                        <p className="text-[10px] text-purple-600 dark:text-purple-400">
                          {cost.extTemplate.name} menggunakan formula resmi: SWDKLLJ Pokok (Rp {(cost.extTemplate.vehicleType === "Mobil" ? 143000 : 35000).toLocaleString("id-ID")}) + SWDKLLJ Tertunggak ({cost.extResult.tahunTunggakan || 0} thn).
                        </p>
                      )}
                    </div>

                    {/* R4 ANNUAL TAX ESTIMATOR PARAMETERS */}
                    {isR4Annual && (
                      <div className="sm:col-span-2 md:col-span-3 mt-2 p-3.5 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-primary/20">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-md bg-primary/10 text-primary">
                              <Calculator className="w-4 h-4" />
                            </span>
                            <div>
                              <h5 className="text-xs font-semibold text-foreground">
                                Parameter Perhitungan Pajak Tahunan Mobil (R4)
                              </h5>
                              <p className="text-[11px] text-muted-foreground">
                                Menggunakan formula resmi Workbook PAJAK TAHUNAN R4 (DATEDIF & ROUNDUP)
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenExplanation("denda-pkb-pajak-baru")}
                              className="h-7 text-[11px] gap-1 px-2.5 font-medium border-primary/30 text-primary hover:bg-primary/10 bg-background/80 shadow-2xs"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              Penjelasan Rumus
                            </Button>
                            {cost.r4Result && (
                              <Badge variant="outline" className="text-[11px] font-mono bg-background text-foreground border-border gap-1 py-1 px-2.5">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                Keterlambatan: <strong className="text-primary">{cost.r4Result.durasiKeterlambatan}</strong> ({cost.r4Result.tahunTunggakan} Thn {cost.r4Result.bulanTunggakan} Bln)
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {/* Program Samsat */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">
                              Program Samsat <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={r4ProgramSamsat}
                              onValueChange={(val: ProgramSamsat) => setR4ProgramSamsat(val)}
                            >
                              <SelectTrigger className="bg-background border-border h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NORMAL" className="text-xs font-medium">
                                  NORMAL (Denda PKB & SWDKLLJ Aktif)
                                </SelectItem>
                                <SelectItem value="FREE Biaya Denda" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  FREE Biaya Denda (Denda PKB Bebas)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>


                          {/* Kondisi Berkas / KTP */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">
                              Kelengkapan Berkas / KTP
                            </Label>
                            <Select
                              value={r4KondisiBerkas}
                              onValueChange={(val: KondisiBerkas) => setR4KondisiBerkas(val)}
                            >
                              <SelectTrigger className="bg-background border-border h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LENGKAP" className="text-xs">
                                  LENGKAP (Ada KTP)
                                </SelectItem>
                                <SelectItem value="TIDAK ADA KTP" className="text-xs">
                                  TIDAK ADA KTP (Perlu ACC ID)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Wilayah ACC ID */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">
                              Wilayah ACC ID (Opsional)
                            </Label>
                            <Select
                              value={r4WilayahAccId}
                              onValueChange={(val: WilayahAccId) => setR4WilayahAccId(val)}
                            >
                              <SelectTrigger className="bg-background border-border h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DKI Jakarta" className="text-xs">DKI Jakarta</SelectItem>
                                <SelectItem value="Bogor" className="text-xs">Bogor</SelectItem>
                                <SelectItem value="Tanggerang" className="text-xs">Tangerang</SelectItem>
                                <SelectItem value="Depok" className="text-xs">Depok</SelectItem>
                                <SelectItem value="Bekasi" className="text-xs">Bekasi</SelectItem>
                                <SelectItem value="NON ACC ID" className="text-xs">NON ACC ID</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Toggle Incidentals */}
                          <div className="space-y-1.5 md:col-span-3 sm:col-span-2 flex flex-col justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setR4ShowIncidentals(!r4ShowIncidentals)}
                              className="h-9 text-xs w-full sm:w-auto self-start justify-between gap-2 border-dashed"
                            >
                              <span>Biaya Tambahan / Insidental (Opsional)</span>
                              {r4ShowIncidentals ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>

                        {/* Expandable Incidentals */}
                        {r4ShowIncidentals && (
                          <div className="p-3 bg-background/60 rounded-md border border-border/60 space-y-2 mt-2">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                              Input Komponen Manual / Insidental (Rp):
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              <div>
                                <Label className="text-[10px] text-muted-foreground">JR</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={r4ManualValues["jr"] || ""}
                                  onChange={(e) => setR4ManualValues({ ...r4ManualValues, jr: parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">ETLE</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={r4ManualValues["etle"] || ""}
                                  onChange={(e) => setR4ManualValues({ ...r4ManualValues, etle: parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">PNBP Nopil</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={r4ManualValues["pnbp-nopil"] || ""}
                                  onChange={(e) => setR4ManualValues({ ...r4ManualValues, "pnbp-nopil": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">STNK Hilang</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={r4ManualValues["stnk-hilang"] || ""}
                                  onChange={(e) => setR4ManualValues({ ...r4ManualValues, "stnk-hilang": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Pemekaran Wilayah</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={r4ManualValues["pemekaran-wilayah"] || ""}
                                  onChange={(e) => setR4ManualValues({ ...r4ManualValues, "pemekaran-wilayah": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* R2 ANNUAL TAX ESTIMATOR PARAMETERS */}
                    {isR2Annual && (
                      <div className="sm:col-span-2 md:col-span-3 mt-2 p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-500/20">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600">
                              <Calculator className="w-4 h-4" />
                            </span>
                            <div>
                              <h5 className="text-xs font-semibold text-foreground">
                                Parameter Perhitungan Pajak Tahunan Motor (R2)
                              </h5>
                              <p className="text-[11px] text-muted-foreground">
                                Menggunakan formula resmi Workbook PAJAK TAHUNAN R2 (DATEDIF & ROUNDUP)
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenExplanation("denda-pkb-pajak-baru")}
                              className="h-7 text-[11px] gap-1 px-2.5 font-medium border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 bg-background/80 shadow-2xs"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              Penjelasan Rumus
                            </Button>
                            {cost.r2Result && (
                              <Badge variant="outline" className="text-[11px] font-mono bg-background text-foreground border-border gap-1 py-1 px-2.5">
                                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                Keterlambatan: <strong className="text-emerald-600">{cost.r2Result.durasiKeterlambatan}</strong> ({cost.r2Result.tahunTunggakan} Thn, Denda: {cost.r2Result.bulanTunggakan} Bln)
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {/* Program Samsat */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">
                              Program Samsat <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={r2ProgramSamsat}
                              onValueChange={(val: ProgramSamsat) => setR2ProgramSamsat(val)}
                            >
                              <SelectTrigger className="bg-background border-border h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NORMAL" className="text-xs font-medium">
                                  NORMAL (Denda PKB & SWDKLLJ Aktif)
                                </SelectItem>
                                <SelectItem value="FREE Biaya Denda" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  FREE Biaya Denda (Denda PKB Bebas)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Kondisi Berkas / KTP */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">
                              Kelengkapan Berkas / KTP
                            </Label>
                            <Select
                              value={r2KondisiBerkas}
                              onValueChange={(val: KondisiBerkas) => setR2KondisiBerkas(val)}
                            >
                              <SelectTrigger className="bg-background border-border h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TIDAK ADA KTP" className="text-xs">
                                  TIDAK ADA KTP (Perlu ACC ID)
                                </SelectItem>
                                <SelectItem value="LENGKAP" className="text-xs">
                                  LENGKAP (Ada KTP)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Wilayah ACC ID */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">
                              Wilayah ACC ID (Opsional)
                            </Label>
                            <Select
                              value={r2WilayahAccId}
                              onValueChange={(val: WilayahAccId) => setR2WilayahAccId(val)}
                            >
                              <SelectTrigger className="bg-background border-border h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NON ACC ID" className="text-xs">NON ACC ID (Default Rp 350.000)</SelectItem>
                                <SelectItem value="DKI Jakarta" className="text-xs">DKI Jakarta (Rp 350.000)</SelectItem>
                                <SelectItem value="Bogor" className="text-xs">Bogor (Rp 200.000)</SelectItem>
                                <SelectItem value="Tanggerang" className="text-xs">Tangerang (Rp 350.000)</SelectItem>
                                <SelectItem value="Depok" className="text-xs">Depok (Rp 350.000)</SelectItem>
                                <SelectItem value="Bekasi" className="text-xs">Bekasi (Rp 350.000)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Toggle Incidentals */}
                          <div className="space-y-1.5 md:col-span-3 sm:col-span-2 flex flex-col justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setR2ShowIncidentals(!r2ShowIncidentals)}
                              className="h-9 text-xs w-full sm:w-auto self-start justify-between gap-2 border-dashed"
                            >
                              <span>Biaya Tambahan / Insidental (Opsional)</span>
                              {r2ShowIncidentals ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>

                        {/* Expandable Incidentals */}
                        {r2ShowIncidentals && (
                          <div className="p-3 bg-background/60 rounded-md border border-border/60 space-y-2 mt-2">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                              Input Komponen Manual / Insidental R2 (Rp):
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              <div>
                                <Label className="text-[10px] text-muted-foreground">STNK Hilang</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={r2ManualValues["stnk-hilang"] || ""}
                                  onChange={(e) => setR2ManualValues({ ...r2ManualValues, "stnk-hilang": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Proses & ACC ID</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="350000"
                                  value={r2ManualValues["proses-dan-acc-id"] !== undefined ? r2ManualValues["proses-dan-acc-id"] : ""}
                                  onChange={(e) => setR2ManualValues({ ...r2ManualValues, "proses-dan-acc-id": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">ETLE</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={r2ManualValues["etle"] || ""}
                                  onChange={(e) => setR2ManualValues({ ...r2ManualValues, etle: parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">REQ NOPOL</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={r2ManualValues["req-nopol-ganjil-acak"] || ""}
                                  onChange={(e) => setR2ManualValues({ ...r2ManualValues, "req-nopol-ganjil-acak": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Pemekaran Wil.</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={r2ManualValues["pemekaran-wilayah"] || ""}
                                  onChange={(e) => setR2ManualValues({ ...r2ManualValues, "pemekaran-wilayah": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* EXTENDED ESTIMATION PARAMETERS (5-TAHUNAN, BBN, MUTASI AS, MUTASI LD) */}
                    {cost.isExtendedEstimation && cost.extTemplate && (
                      <div className="sm:col-span-2 md:col-span-3 mt-2 p-3.5 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-purple-500/20">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-md bg-purple-500/10 text-purple-600">
                              <Calculator className="w-4 h-4" />
                            </span>
                            <div>
                              <h5 className="text-xs font-semibold text-foreground">
                                Parameter Perhitungan: {cost.extTemplate.name}
                              </h5>
                              <p className="text-[11px] text-muted-foreground">
                                Menggunakan formula resmi workbook {cost.extTemplate.serviceType} ({cost.extTemplate.vehicleType})
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenExplanation("denda-pkb-pajak-baru")}
                              className="h-7 text-[11px] gap-1 px-2.5 font-medium border-purple-500/30 text-purple-600 hover:bg-purple-500/10 bg-background/80 shadow-2xs"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              Penjelasan Rumus
                            </Button>
                            {cost.extResult && (
                              <Badge variant="outline" className="text-[11px] font-mono bg-background text-foreground border-border gap-1 py-1 px-2.5">
                                <Clock className="w-3.5 h-3.5 text-purple-600" />
                                Keterlambatan: <strong className="text-purple-600">{cost.extResult.durasiKeterlambatan}</strong> ({cost.extResult.tahunTunggakan} Thn {cost.extResult.bulanTunggakan} Bln)
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {/* Program Samsat */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">
                              Program Samsat <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={extProgramSamsat}
                              onValueChange={(val: ProgramSamsat) => setExtProgramSamsat(val)}
                            >
                              <SelectTrigger className="bg-background border-border h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NORMAL" className="text-xs font-medium">
                                  NORMAL (Denda PKB & SWDKLLJ Aktif)
                                </SelectItem>
                                <SelectItem value="FREE Biaya Denda" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  FREE Biaya Denda (Denda PKB Bebas)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Free Biaya BBN selector (if Balik Nama or Mutasi) */}
                          {(cost.extTemplate.serviceType === "Balik Nama" || cost.extTemplate.serviceType.includes("Mutasi")) && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-foreground">
                                Biaya Pokok BBN
                              </Label>
                              <Select
                                value={extFreeBbn ? "FREE" : "BAYAR"}
                                onValueChange={(val: string) => setExtFreeBbn(val === "FREE")}
                              >
                                <SelectTrigger className="bg-background border-border h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="FREE" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    FREE Biaya BBN (Pemutihan / Bebas Bea)
                                  </SelectItem>
                                  <SelectItem value="BAYAR" className="text-xs font-medium">
                                    BAYAR (Sesuai Rumus BBN Pokok)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Kondisi Berkas / KTP */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">
                              Kelengkapan Berkas / KTP
                            </Label>
                            <Select
                              value={extKondisiBerkas}
                              onValueChange={(val: KondisiBerkas) => setExtKondisiBerkas(val)}
                            >
                              <SelectTrigger className="bg-background border-border h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LENGKAP" className="text-xs">
                                  LENGKAP (Ada KTP / BPKB Asli)
                                </SelectItem>
                                <SelectItem value="TIDAK ADA KTP" className="text-xs">
                                  TIDAK ADA KTP (Perlu ACC ID)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Wilayah ACC ID */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-foreground">
                              Wilayah ACC ID (Opsional)
                            </Label>
                            <Select
                              value={extWilayahAccId}
                              onValueChange={(val: WilayahAccId) => setExtWilayahAccId(val)}
                            >
                              <SelectTrigger className="bg-background border-border h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DKI Jakarta" className="text-xs">DKI Jakarta</SelectItem>
                                <SelectItem value="Bogor" className="text-xs">Bogor</SelectItem>
                                <SelectItem value="Tanggerang" className="text-xs">Tangerang</SelectItem>
                                <SelectItem value="Depok" className="text-xs">Depok</SelectItem>
                                <SelectItem value="Bekasi" className="text-xs">Bekasi</SelectItem>
                                <SelectItem value="NON ACC ID" className="text-xs">NON ACC ID</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Toggle Incidentals */}
                          <div className="space-y-1.5 md:col-span-3 sm:col-span-2 flex flex-col justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setExtShowIncidentals(!extShowIncidentals)}
                              className="h-9 text-xs w-full sm:w-auto self-start justify-between gap-2 border-dashed"
                            >
                              <span>Biaya Tambahan / Insidental (Opsional)</span>
                              {extShowIncidentals ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>

                        {/* Expandable Incidentals */}
                        {extShowIncidentals && (
                          <div className="p-3 bg-background/60 rounded-md border border-border/60 space-y-2 mt-2">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                              Biaya Insidental (Input Manual Bila Dikenakan Samsat / Permintaan Khusus):
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              <div>
                                <Label className="text-[10px] text-muted-foreground">ETLE / Blokir Tilang</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={extManualValues["etle"] || ""}
                                  onChange={(e) => setExtManualValues({ ...extManualValues, etle: parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">STNK Hilang</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={extManualValues["stnk-hilang"] || ""}
                                  onChange={(e) => setExtManualValues({ ...extManualValues, "stnk-hilang": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Pemekaran Wilayah</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={extManualValues["pemekaran-wilayah"] || ""}
                                  onChange={(e) => setExtManualValues({ ...extManualValues, "pemekaran-wilayah": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Buang Nopol</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={extManualValues["buang-nopol"] || ""}
                                  onChange={(e) => setExtManualValues({ ...extManualValues, "buang-nopol": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Req Nopol / Nopil</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={extManualValues["req-nopol-ganjil-acak"] || extManualValues["pnbp-nopil"] || ""}
                                  onChange={(e) => setExtManualValues({ ...extManualValues, "req-nopol-ganjil-acak": parseFloat(e.target.value) || 0, "pnbp-nopil": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Buka Blokir</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={extManualValues["buka-blokir"] || ""}
                                  onChange={(e) => setExtManualValues({ ...extManualValues, "buka-blokir": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Cetak SKP</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={extManualValues["cetak-skp"] || ""}
                                  onChange={(e) => setExtManualValues({ ...extManualValues, "cetak-skp": parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4 & 5. ALAMAT PENJEMPUTAN & PENGANTARAN (KHUSUS ANTAR JEMPUT) */}
                {formData.metodeLayanan === "Antar Jemput" && (
                  <>
                    {/* 4. ALAMAT PENJEMPUTAN DOKUMEN */}
                    <div className="space-y-4 p-4 sm:p-5 rounded-xl border border-border/70 bg-card shadow-xs">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        4. Alamat Penjemputan Dokumen
                      </h4>

                      <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div id="field-jemputDetail" className="space-y-1 sm:col-span-3">
                            <Label className="text-[11px] text-muted-foreground">
                              Detail Alamat / Jalan <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              required={formData.metodeLayanan === "Antar Jemput"}
                              placeholder="Nama jalan, gedung, blok, atau patokan penjemputan berkas"
                              value={formData.jemputDetail}
                              onChange={(e) => {
                                setFormData({ ...formData, jemputDetail: e.target.value });
                                clearFieldError("jemputDetail");
                              }}
                              className={cn(
                                "bg-input-background border-border h-9 text-xs",
                                step1Errors.jemputDetail && "border-destructive ring-1 ring-destructive/40"
                              )}
                            />
                            {step1Errors.jemputDetail && (
                              <p className="text-[11px] text-destructive mt-1 flex items-center gap-1 font-medium">
                                <AlertCircle className="w-3 h-3 shrink-0" /> {step1Errors.jemputDetail}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Kota / Kabupaten</Label>
                            <Input
                              placeholder="Jakarta Timur"
                              value={formData.jemputKota}
                              onChange={(e) => setFormData({ ...formData, jemputKota: e.target.value })}
                              className="bg-input-background border-border h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Kecamatan</Label>
                            <Input
                              placeholder="Contoh: Cakung"
                              value={formData.jemputKecamatan}
                              onChange={(e) => setFormData({ ...formData, jemputKecamatan: e.target.value })}
                              className="bg-input-background border-border h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Kelurahan / Desa</Label>
                            <Input
                              placeholder="Contoh: Pulo Gebang"
                              value={formData.jemputKelurahan}
                              onChange={(e) => setFormData({ ...formData, jemputKelurahan: e.target.value })}
                              className="bg-input-background border-border h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">RT / RW</Label>
                            <Input
                              placeholder="001/002"
                              value={formData.jemputRtRw}
                              onChange={(e) => setFormData({ ...formData, jemputRtRw: e.target.value })}
                              className="bg-input-background border-border h-9 text-xs font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Nomor Rumah/Kantor</Label>
                            <Input
                              placeholder="No. 12B"
                              value={formData.jemputNomor}
                              onChange={(e) => setFormData({ ...formData, jemputNomor: e.target.value })}
                              className="bg-input-background border-border h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Landmark / Patokan</Label>
                            <Input
                              placeholder="Dekat Masjid / Seberang Alfa"
                              value={formData.jemputLandmark}
                              onChange={(e) => setFormData({ ...formData, jemputLandmark: e.target.value })}
                              className="bg-input-background border-border h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-3">
                            <Label className="text-[11px] text-muted-foreground">Link Google Maps (Opsional)</Label>
                            <Input
                              placeholder="https://maps.google.com/?q=..."
                              value={formData.jemputMapsUrl}
                              onChange={(e) => setFormData({ ...formData, jemputMapsUrl: e.target.value })}
                              className="bg-input-background border-border h-9 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 5. ALAMAT PENGANTARAN DOKUMEN */}
                    <div className="space-y-4 p-4 sm:p-5 rounded-xl border border-border/70 bg-card shadow-xs">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-border/60">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        5. Alamat Pengantaran Dokumen
                      </h4>

                      <div className="flex items-center gap-2 px-1">
                        <Checkbox
                          id="sameAddress"
                          checked={isSameAddress}
                          onCheckedChange={(checked) => setIsSameAddress(Boolean(checked))}
                        />
                        <label htmlFor="sameAddress" className="text-xs text-foreground cursor-pointer select-none">
                          Alamat Pengantaran Dokumen sama dengan Alamat Penjemputan
                        </label>
                      </div>

                      {!isSameAddress && (
                        <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1 sm:col-span-3">
                              <Label className="text-[11px] text-muted-foreground">Detail Alamat / Jalan Pengantaran</Label>
                              <Input
                                placeholder="Nama jalan atau gedung tujuan pengantaran"
                                value={formData.antarDetail}
                                onChange={(e) => setFormData({ ...formData, antarDetail: e.target.value })}
                                className="bg-input-background border-border h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Kota / Kabupaten</Label>
                              <Input
                                value={formData.antarKota}
                                onChange={(e) => setFormData({ ...formData, antarKota: e.target.value })}
                                className="bg-input-background border-border h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Kecamatan</Label>
                              <Input
                                value={formData.antarKecamatan}
                                onChange={(e) => setFormData({ ...formData, antarKecamatan: e.target.value })}
                                className="bg-input-background border-border h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Kelurahan / Desa</Label>
                              <Input
                                value={formData.antarKelurahan}
                                onChange={(e) => setFormData({ ...formData, antarKelurahan: e.target.value })}
                                className="bg-input-background border-border h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">RT / RW</Label>
                              <Input
                                value={formData.antarRtRw}
                                onChange={(e) => setFormData({ ...formData, antarRtRw: e.target.value })}
                                className="bg-input-background border-border h-9 text-xs font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Nomor</Label>
                              <Input
                                value={formData.antarNomor}
                                onChange={(e) => setFormData({ ...formData, antarNomor: e.target.value })}
                                className="bg-input-background border-border h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Landmark</Label>
                              <Input
                                value={formData.antarLandmark}
                                onChange={(e) => setFormData({ ...formData, antarLandmark: e.target.value })}
                                className="bg-input-background border-border h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-3">
                              <Label className="text-[11px] text-muted-foreground">Link Google Maps</Label>
                              <Input
                                value={formData.antarMapsUrl}
                                onChange={(e) => setFormData({ ...formData, antarMapsUrl: e.target.value })}
                                className="bg-input-background border-border h-9 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* STEP 1 NAVIGATION BUTTONS */}
                <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 text-xs"
                      onClick={() => setShowResetConfirm(true)}
                    >
                      Reset
                    </Button>
                  <Button
                    type="button"
                    onClick={handleNextStep1}
                    className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs font-semibold px-4"
                  >
                    <span>Lanjut ke Dokumen & Pembayaran</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ======================================================== */}
            {/* STEP 2: DOKUMEN KENDARAAN (REAL UPLOAD UI)                */}
            {/* ======================================================== */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                <div className="space-y-1.5 pb-2 border-b border-border/60">
                  <button
                    type="button"
                    onClick={() => setIsVehicleDocsExpanded((prev) => !prev)}
                    aria-expanded={isVehicleDocsExpanded}
                    aria-label={isVehicleDocsExpanded ? "Sembunyikan daftar dokumen kendaraan" : "Tampilkan daftar dokumen kendaraan"}
                    className="w-full flex items-center justify-between text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded p-1 -m-1"
                  >
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 group-hover:text-foreground transition-colors">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      Dokumen Kendaraan yang Dilampirkan Klien
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      <span className="text-[11px] font-medium hidden sm:inline">
                        {isVehicleDocsExpanded ? "Sembunyikan" : "Tampilkan"}
                      </span>
                      {isVehicleDocsExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                    </div>
                  </button>
                  {isVehicleDocsExpanded && (
                    <p className="text-[11px] text-muted-foreground">
                      Unggah berkas fisik atau salinan dokumen yang dibawa oleh klien (PDF, JPG, JPEG, PNG). Order tetap dapat diproses jika dokumen fisik diserahkan saat penjemputan.
                    </p>
                  )}
                </div>

                {isVehicleDocsExpanded && (
                  <div className="space-y-2.5">
                  {dynamicDocRequirements.map((item: any) => {
                    const doc = docs[item.key] || { name: "", fileType: "", attached: false };
                    return (
                      <div
                        key={item.key}
                        className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors hover:bg-muted/10"
                      >
                        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 sm:mt-0",
                              doc.attached
                                ? doc.fileType === "pdf"
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {doc.attached ? (
                              doc.fileType === "pdf" ? <FileIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium text-foreground">{item.label}</span>
                              {doc.attached ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                                  ✓ {doc.fileType?.toUpperCase()} {doc.fileSize && `(${doc.fileSize})`}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border">
                                  Belum Dilampirkan
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {doc.attached ? doc.name : "Berkas fisik dapat diserahkan saat penjemputan"}
                            </p>
                            {docUploadErrors[item.key] && (
                              <ActionInlineError
                                compact
                                actionKey={`doc-upload-${item.key}`}
                                error={docUploadErrors[item.key]}
                                className="mt-1.5"
                                onDismiss={() =>
                                  setDocUploadErrors((prev) => {
                                    const next = { ...prev };
                                    delete next[item.key];
                                    return next;
                                  })
                                }
                              />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-10 sm:pl-0">
                          {doc.attached && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setPreviewModal({
                                    title: item.label,
                                    name: doc.name,
                                    fileType: doc.fileType,
                                    fileUrl: doc.fileUrl,
                                  })
                                }
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Preview
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs px-2 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDocRemove(item.key)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Hapus
                              </Button>
                            </>
                          )}

                          <label className="cursor-pointer">
                            <span className="inline-flex items-center justify-center h-8 px-2.5 rounded-md text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors gap-1.5">
                              <Upload className="w-3.5 h-3.5" />
                              {doc.attached ? "Ganti File" : "Upload File"}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleDocFileSelect(item.key, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}

                  <div className="pt-6 pb-2 border-b border-border/60">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-primary" />
                      Skema & Metode Pembayaran Serta Ringkasan Order
                    </h4>
                  </div>
                {/* 1. SKEMA & METODE PEMBAYARAN */}
                <div className="space-y-4">
                  {/* Scheme Selection (Decision 1) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Bayar di Awal */}
                    <div
                      onClick={() => setFormData({ ...formData, tipePembayaran: "Bayar di Awal" })}
                      className={cn(
                        "p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
                        formData.tipePembayaran === "Bayar di Awal"
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0",
                          formData.tipePembayaran === "Bayar di Awal"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground"
                        )}
                      >
                        {formData.tipePembayaran === "Bayar di Awal" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-foreground">Bayar di Awal</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Pelunasan di depan saat order diinput di loket biro jasa.
                        </p>
                      </div>
                    </div>

                    {/* Bayar di Akhir */}
                    <div
                      onClick={() => setFormData({ ...formData, tipePembayaran: "Bayar di Akhir" })}
                      className={cn(
                        "p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3",
                        formData.tipePembayaran === "Bayar di Akhir"
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0",
                          formData.tipePembayaran === "Bayar di Akhir"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground"
                        )}
                      >
                        {formData.tipePembayaran === "Bayar di Akhir" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-foreground">Bayar di Akhir</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Pelunasan saat pengerjaan selesai / serah terima dokumen (COD).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Payment Details */}
                  {formData.tipePembayaran === "Bayar di Awal" ? (
                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          Metode Pembayaran <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={formData.metodePembayaran}
                          onValueChange={(val) => {
                            setFormData({ ...formData, metodePembayaran: val });
                            setStep2Errors((prev) => ({ ...prev, metodePembayaran: undefined }));
                            setSubmitError(null);
                          }}
                        >
                          <SelectTrigger className={cn("bg-input-background h-9 text-xs", step2Errors.metodePembayaran ? "border-destructive ring-1 ring-destructive/40" : "border-border")}>
                            <SelectValue placeholder="Pilih saluran pembayaran" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeMethods && activeMethods.length > 0 ? (
                              activeMethods.map((m) => (
                                <SelectItem key={m.id} value={m.nama_metode} className="text-xs">
                                  {m.nama_metode} {m.bank && m.bank !== "Tunai" && m.nomor_rekening ? `(${m.bank} - ${m.nomor_rekening})` : ""}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="py-2 px-3 text-xs text-muted-foreground">Tidak ada metode pembayaran aktif</div>
                            )}
                          </SelectContent>
                        </Select>
                        {step2Errors.metodePembayaran && (
                          <p className="text-[11px] text-destructive font-medium">{step2Errors.metodePembayaran}</p>
                        )}
                      </div>

                      {/* Transfer / Bank details dynamically from selected Master Data method */}
                      {(() => {
                        const matchedPm = activeMethods?.find((m) => m.nama_metode === formData.metodePembayaran);
                        const isTransfer = formData.metodePembayaran.includes("Transfer") || (matchedPm && matchedPm.bank !== "Tunai" && matchedPm.bank !== "QRIS");
                        if (!isTransfer) return null;

                        const bankName = matchedPm?.bank || "Bank Transfer";
                        const accNo = matchedPm?.nomor_rekening || "";
                        const accName = matchedPm?.nama_rekening || "";

                        return (
                          <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-2">
                            <p className="font-medium text-foreground text-xs flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-primary" />
                              Rekening Resmi Penerimaan SUN89:
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-md bg-muted/30 border border-border/60">
                              <div>
                                <p className="font-semibold text-foreground text-xs">{bankName}</p>
                                <p className="font-mono text-sm font-bold text-primary mt-0.5">{accNo}</p>
                                {accName && <p className="text-[11px] text-muted-foreground">a.n. {accName}</p>}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopy(accNo.replace(/[^0-9]/g, ""), "bank")}
                                className="h-8 text-xs gap-1.5 shrink-0"
                              >
                                {copiedBank ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedBank ? "Tersalin" : "Salin Rekening"}
                              </Button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* QRIS details */}
                      {formData.metodePembayaran === "QRIS" && (
                        <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-2">
                          <p className="font-medium text-foreground text-xs flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5 text-primary" />
                            QRIS Standar Nasional SUN89:
                          </p>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-md bg-muted/30 border border-border/60">
                            <div>
                              <p className="font-semibold text-foreground text-xs">NMID: ID936005230001889</p>
                              <p className="text-[11px] text-muted-foreground">Mendukung BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopy("ID936005230001889", "qris")}
                                className="h-8 text-xs gap-1.5"
                              >
                                {copiedQris ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedQris ? "Tersalin" : "Salin ID"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => setShowQrisModal(true)}
                                className="h-8 text-xs gap-1.5"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                Lihat QRIS
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Cash at counter */}
                      {formData.metodePembayaran === "Cash" && (
                        <div className="p-3 rounded-lg border border-border bg-card text-xs flex items-center gap-2.5">
                          <AlertCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <p className="text-muted-foreground">
                            Uang tunai diterima langsung oleh petugas loket/kasir kantor dan akan diverifikasi pada Stage 1.
                          </p>
                        </div>
                      )}

                      {/* Nominal Dibayar di Awal */}
                      <div className="pt-2 border-t border-primary/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Banknote className="w-3.5 h-3.5 text-primary" />
                            Nominal Dibayar di Awal <span className="text-destructive">*</span>
                          </Label>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, nominalDibayarAwal: String(cost.total) })}
                            className="text-[11px] font-medium text-primary hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>Sesuai Total Estimasi (Rp {cost.total.toLocaleString("id-ID")})</span>
                          </button>
                        </div>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-muted-foreground">
                            Rp
                          </span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={formData.nominalDibayarAwal ? Number(formData.nominalDibayarAwal.replace(/[^0-9]/g, "")).toLocaleString("id-ID") : ""}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              setFormData({ ...formData, nominalDibayarAwal: raw });
                              setStep2Errors((prev) => ({ ...prev, nominalDibayarAwal: undefined }));
                              setSubmitError(null);
                            }}
                            className={cn(
                              "pl-9 bg-background h-9 text-xs font-mono font-bold tabular-nums",
                              step2Errors.nominalDibayarAwal ? "border-destructive ring-1 ring-destructive/40" : "border-border"
                            )}
                          />
                        </div>
                        {step2Errors.nominalDibayarAwal && (
                          <p className="text-[11px] text-destructive font-medium">{step2Errors.nominalDibayarAwal}</p>
                        )}

                        {/* Dynamic Calculation Helper */}
                        {(() => {
                          const parsed = parseFloat(formData.nominalDibayarAwal.replace(/[^0-9]/g, "")) || 0;
                          if (!formData.nominalDibayarAwal) {
                            return (
                              <p className="text-[11px] text-muted-foreground">
                                Masukkan nominal aktual rupiah yang dibayarkan pelanggan saat order di loket (Total Estimasi: Rp {cost.total.toLocaleString("id-ID")}).
                              </p>
                            );
                          }
                          if (parsed < cost.total) {
                            const sisa = cost.total - parsed;
                            return (
                              <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs flex items-center justify-between gap-2">
                                <span className="text-amber-700 dark:text-amber-400 font-medium text-[11px]">
                                  Kurang Bayar: Sisa kewajiban Rp {sisa.toLocaleString("id-ID")} akan dicatat di tagihan dan ditagihkan saat penyerahan berkas.
                                </span>
                                <Badge variant="outline" className="text-[10px] shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20">
                                  Kurang Bayar
                                </Badge>
                              </div>
                            );
                          } else if (parsed === cost.total) {
                            return (
                              <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs flex items-center justify-between gap-2">
                                <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[11px]">
                                  Lunas: Nominal pas sesuai 100% total tagihan estimasi (Rp {cost.total.toLocaleString("id-ID")}).
                                </span>
                                <Badge variant="outline" className="text-[10px] shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                  Lunas Pas
                                </Badge>
                              </div>
                            );
                          } else {
                            const kelebihan = parsed - cost.total;
                            return (
                              <div className="p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs flex items-center justify-between gap-2">
                                <span className="text-blue-700 dark:text-blue-400 font-medium text-[11px]">
                                  Kelebihan Bayar: Rp {kelebihan.toLocaleString("id-ID")}. Kelebihan akan dialokasikan ke Cashback Terpending setelah penjemputan berkas selesai.
                                </span>
                                <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  Kelebihan Bayar
                                </Badge>
                              </div>
                            );
                          }
                        })()}
                      </div>

                      {/* Proof upload */}
                      <div className="pt-2 border-t border-primary/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <FileUp className="w-3.5 h-3.5 text-primary" />
                            Bukti Pembayaran
                          </Label>
                          <span className={cn("text-[11px] font-medium", paymentProof.attached ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                            {paymentProof.attached ? "Terlampir" : "Dapat dilengkapi di Verifikasi"}
                          </span>
                        </div>

                        <div className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                                paymentProof.attached
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {paymentProof.attached ? (
                                paymentProof.fileType === "pdf" ? <FileIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {paymentProof.attached ? paymentProof.name : "Belum ada bukti pembayaran dilampirkan"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {paymentProof.attached
                                  ? `Format: ${paymentProof.fileType?.toUpperCase()} • ${paymentProof.fileSize}`
                                  : "Unggah struk transfer bank atau bukti pembayaran loket"}
                              </p>
                              {paymentProofUploadError && (
                                <ActionInlineError
                                  compact
                                  actionKey="payment-proof-upload"
                                  error={paymentProofUploadError}
                                  className="mt-1.5"
                                  onDismiss={() => setPaymentProofUploadError("")}
                                />
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 pl-10 sm:pl-0">
                            {paymentProof.attached && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setPreviewModal({
                                      title: "Bukti Pembayaran",
                                      name: paymentProof.name,
                                      fileType: paymentProof.fileType,
                                      fileUrl: paymentProof.fileUrl,
                                    })
                                  }
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Preview
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs px-2 gap-1 text-destructive hover:bg-destructive/10"
                                  onClick={handlePaymentProofRemove}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Hapus
                                </Button>
                              </>
                            )}

                            <label className="cursor-pointer">
                              <span className="inline-flex items-center justify-center h-8 px-2.5 rounded-md text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors gap-1.5">
                                <Upload className="w-3.5 h-3.5" />
                                {paymentProof.attached ? "Ganti" : "Upload Bukti Pembayaran"}
                              </span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handlePaymentProofSelect(e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-primary shrink-0" />
                      <span>
                        Skema Bayar di Akhir: Pembayaran ditagihkan saat seluruh dokumen selesai diproses dan diantar kembali ke klien (Stage 7 & 8).
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. RINGKASAN ORDER & RINCIAN BIAYA */}
                <div className="p-4 rounded-xl border border-primary/25 bg-primary/5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                      <Calculator className="w-3.5 h-3.5" />
                      Ringkasan Order & Rincian Biaya
                    </h4>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {formData.metodeLayanan}
                    </Badge>
                  </div>

                  {/* Summary Overview Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-lg bg-card/60 border border-border/50 text-xs">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Nama Customer</p>
                      <p className="font-semibold text-foreground">{formData.customer || "-"}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{formData.nomorHP || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Kendaraan & Nomor Polisi</p>
                      <p className="font-semibold text-foreground">{formData.jenisKendaraan} ({formData.tahunKendaraan})</p>
                      <p className="text-xs font-mono font-bold text-primary">{getCombinedNopol() || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Jenis Pengurusan & Metode</p>
                      <p className="font-semibold text-foreground">{formData.layanan || "-"}</p>
                      <p className="text-[11px] text-muted-foreground">{formData.metodeLayanan}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Samsat Asal → Tujuan</p>
                      <p className="font-semibold text-foreground">
                        {formData.layanan.includes("Mutasi")
                          ? `${formData.wilayahSamsatAsal} → ${formData.wilayahSamsatTujuan || "Belum dipilih"}`
                          : formData.wilayahSamsatAsal}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Skema: {formData.tipePembayaran}</p>
                    </div>
                  </div>

                  {/* Itemized Cost Breakdown */}
                  <div className="space-y-3 text-xs">
                    {cost.isR4Annual && cost.r4Result ? (
                      <div className="space-y-3 pb-2.5 border-b border-border/60">
                        {/* Header Banner */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <div>
                              <span className="font-semibold text-foreground">
                                Durasi Keterlambatan: {cost.r4Result.durasiKeterlambatan}
                              </span>
                              <span className="text-muted-foreground text-[11px] block">
                                {cost.r4Result.tahunTunggakan} Tahun, {cost.r4Result.bulanTunggakan} Bulan • Program Samsat: <strong className="text-foreground">{r4ProgramSamsat}</strong>
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenExplanation("denda-pkb-pajak-baru")}
                              className="h-7 text-[11px] gap-1 px-2.5 font-medium border-primary/30 text-primary hover:bg-primary/10 bg-background/80 shadow-2xs"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              Detail Penjelasan Hitungan
                            </Button>
                            <Badge variant="outline" className="text-[10px] font-mono bg-background">
                              Template R4 Tahunan
                            </Badge>
                          </div>
                        </div>

                        {/* Group 1: Pokok & Denda PKB */}
                        <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                          <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              1. Pokok & Denda PKB
                            </span>
                            <span className="font-mono tabular-nums text-primary font-bold">
                              Rp {(cost.r4Result.totalPkb + cost.r4Result.totalDendaPkb).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs pl-2">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                PKB Tertunggak:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("pkb-tertunggak")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus & cara hitung PKB Tertunggak"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r4Result.items.find((i) => i.id === "pkb-tertunggak")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Pajak Baru:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("pajak-baru")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus & cara hitung Pajak Baru"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r4Result.items.find((i) => i.id === "pajak-baru")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Denda PKB Tertunggak:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("denda-pkb-tertunggak")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus & cara hitung Denda PKB Tertunggak"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className={cn("font-mono tabular-nums", (cost.r4Result.items.find((i) => i.id === "denda-pkb-tertunggak")?.amount || 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                                Rp {(cost.r4Result.items.find((i) => i.id === "denda-pkb-tertunggak")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Denda PKB Pajak Baru:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("denda-pkb-pajak-baru")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus & cara hitung Denda PKB Pajak Baru"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className={cn("font-mono tabular-nums", (cost.r4Result.items.find((i) => i.id === "denda-pkb-pajak-baru")?.amount || 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                                Rp {(cost.r4Result.items.find((i) => i.id === "denda-pkb-pajak-baru")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Group 2: Pokok & Denda SWDKLLJ */}
                        <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                          <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              2. Pokok & Denda SWDKLLJ
                            </span>
                            <span className="font-mono tabular-nums text-primary font-bold">
                              Rp {(cost.r4Result.totalSwdkllj + cost.r4Result.totalDendaSwdkllj).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs pl-2">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                SWDKLLJ Tertunggak:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("swdkllj-tertunggak")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat tarif & rumus SWDKLLJ Tertunggak"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r4Result.items.find((i) => i.id === "swdkllj-tertunggak")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                SWDKLLJ Pajak Baru:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("swdkllj-pajak-baru")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat tarif SWDKLLJ Pajak Baru"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r4Result.items.find((i) => i.id === "swdkllj-pajak-baru")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Denda SWDKLLJ Tertunggak:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("denda-swdkllj-tertunggak")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus & tarif Denda SWDKLLJ Tertunggak"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className={cn("font-mono tabular-nums", (cost.r4Result.items.find((i) => i.id === "denda-swdkllj-tertunggak")?.amount || 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                                Rp {(cost.r4Result.items.find((i) => i.id === "denda-swdkllj-tertunggak")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Denda SWDKLLJ Pajak Baru:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("denda-swdkllj-pajak-baru")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat aturan Denda SWDKLLJ Pajak Baru"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className={cn("font-mono tabular-nums", (cost.r4Result.items.find((i) => i.id === "denda-swdkllj-pajak-baru")?.amount || 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                                Rp {(cost.r4Result.items.find((i) => i.id === "denda-swdkllj-pajak-baru")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Group 3: Administrasi & Jasa */}
                        <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                          <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              3. Administrasi & Jasa
                            </span>
                            <span className="font-mono tabular-nums text-primary font-bold">
                              Rp {cost.r4Result.totalAdminDanJasa.toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs pl-2">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Cetak SKP (Samsat):
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("cetak-skp")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat aturan Cetak SKP"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r4Result.items.find((i) => i.id === "cetak-skp")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Jasa Pengurusan Biro:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("jasa")}
                                  className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat tarif Jasa Biro SUN89"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r4Result.items.find((i) => i.id === "jasa")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            {(cost.r4Result.items.find((i) => i.id === "jr")?.amount || 0) > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">JR:</span>
                                <span className="font-mono tabular-nums">
                                  Rp {(cost.r4Result.items.find((i) => i.id === "jr")?.amount || 0).toLocaleString("id-ID")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Group 4: Biaya Insidental (bila ada nilai) */}
                        {cost.r4Result.totalInsidental > 0 && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-500" />
                                4. Biaya Insidental
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.r4Result.totalInsidental.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.r4Result.items
                                .filter((i) => i.category === "INSIDENTAL" && i.amount > 0)
                                .map((item) => (
                                  <div key={item.id} className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      {item.name}:
                                      <button
                                        type="button"
                                        onClick={() => handleOpenExplanation("insidental")}
                                        className="text-muted-foreground/60 hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                                        title="Lihat penjelasan biaya insidental"
                                      >
                                        <HelpCircle className="w-3 h-3" />
                                      </button>
                                    </span>
                                    <span className="font-mono tabular-nums">Rp {item.amount.toLocaleString("id-ID")}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Group 5: ACC ID Reference Callout Box */}
                        <div className="rounded-lg border border-amber-500/30 p-2.5 bg-amber-500/5 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                              <FileCheck className="w-3.5 h-3.5" />
                              5. Biaya ACC ID (Cell I5)
                              <button
                                type="button"
                                onClick={() => handleOpenExplanation("acc-id")}
                                className="text-amber-700/70 dark:text-amber-400/70 hover:text-amber-800 dark:hover:text-amber-300 transition-colors p-0.5 rounded cursor-pointer"
                                title="Lihat aturan Biaya ACC ID R4"
                              >
                                <HelpCircle className="w-3 h-3" />
                              </button>
                            </span>
                            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                              Tidak Masuk Total
                            </Badge>
                          </div>
                          <div className="flex justify-between items-baseline pt-1">
                            <span className="text-[11px] text-muted-foreground">
                              {r4KondisiBerkas === "LENGKAP"
                                ? "Berkas Lengkap (Ada KTP)"
                                : `Tanpa KTP (${r4WilayahAccId})`}
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-foreground">
                              Rp {(cost.r4Result.accIdAmount || 0).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            * Biaya ACC ID merupakan biaya referensi dokumen dan tidak digabungkan ke total tagihan invoice order.
                          </p>
                        </div>

                        {/* Kurir Antar-Jemput */}
                        {cost.courierFee > 0 && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-blue-500" />
                                Layanan Kurir Antar-Jemput
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.courierFee.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs pl-2">
                              <span className="text-muted-foreground">Metode Pengiriman:</span>
                              <Badge variant="outline" className="text-[10px] bg-background">
                                {currentConfig?.antarJemputMode || "Antar & Jemput"}
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Biaya Tambahan Wilayah (Kustom) */}
                        {cost.kustomItems && cost.kustomItems.length > 0 && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                                Biaya Tambahan Wilayah ({formData.wilayahSamsatAsal})
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.totalKustomFees.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.kustomItems.map((item: any, idx: number) => (
                                <div key={item.itemId || idx} className="flex justify-between items-center">
                                  <span className="text-muted-foreground">{item.name}:</span>
                                  <span className="font-mono tabular-nums">
                                    Rp {item.amount.toLocaleString("id-ID")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : cost.isR2Annual && cost.r2Result ? (
                      <div className="space-y-3 pb-2.5 border-b border-border/60">
                        {/* Header Banner */}
                        {/* Header Banner */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-600" />
                            <div>
                              <span className="font-semibold text-foreground">
                                Durasi Keterlambatan: {cost.r2Result.durasiKeterlambatan}
                              </span>
                              <span className="text-muted-foreground text-[11px] block">
                                {cost.r2Result.tahunTunggakan} Tahun, Denda: {cost.r2Result.bulanTunggakan} Bulan • Program Samsat: <strong className="text-foreground">{r2ProgramSamsat}</strong>
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenExplanation("denda-pkb-pajak-baru")}
                              className="h-7 text-[11px] gap-1 px-2.5 font-medium border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 bg-background/80 shadow-2xs"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              Detail Penjelasan Hitungan
                            </Button>
                            <Badge variant="outline" className="text-[10px] font-mono bg-background text-emerald-600 border-emerald-500/30">
                              Template R2 Tahunan
                            </Badge>
                          </div>
                        </div>

                        {/* Group 1: Pokok & Denda PKB */}
                        <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                          <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              1. Pokok & Denda PKB
                            </span>
                            <span className="font-mono tabular-nums text-primary font-bold">
                              Rp {(cost.r2Result.totalPkb + cost.r2Result.totalDendaPkb).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs pl-2">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                PKB Tertunggak:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("pkb-tertunggak")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus & cara hitung PKB Tertunggak"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r2Result.items.find((i) => i.id === "pkb-tertunggak")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Pajak Baru:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("pajak-baru")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus & cara hitung Pajak Baru"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r2Result.items.find((i) => i.id === "pajak-baru")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Denda PKB Tertunggak:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("denda-pkb-tertunggak")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus & cara hitung Denda PKB Tertunggak"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className={cn("font-mono tabular-nums", (cost.r2Result.items.find((i) => i.id === "denda-pkb-tertunggak")?.amount || 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                                Rp {(cost.r2Result.items.find((i) => i.id === "denda-pkb-tertunggak")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Denda PKB Pajak Baru:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("denda-pkb-pajak-baru")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus & cara hitung Denda PKB Pajak Baru"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className={cn("font-mono tabular-nums", (cost.r2Result.items.find((i) => i.id === "denda-pkb-pajak-baru")?.amount || 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                                Rp {(cost.r2Result.items.find((i) => i.id === "denda-pkb-pajak-baru")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Group 2: Pokok & Denda SWDKLLJ (Motor) */}
                        <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                          <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              2. Pokok & Denda SWDKLLJ (Motor)
                            </span>
                            <span className="font-mono tabular-nums text-primary font-bold">
                              Rp {(cost.r2Result.totalSwdkllj + cost.r2Result.totalDendaSwdkllj).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs pl-2">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                SWDKLLJ Tertunggak:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("swdkllj-tertunggak")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat tarif SWDKLLJ Tertunggak"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r2Result.items.find((i) => i.id === "swdkllj-tertunggak")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                SWDKLLJ Pajak Baru:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("swdkllj-pajak-baru")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat tarif SWDKLLJ Pajak Baru"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r2Result.items.find((i) => i.id === "swdkllj-pajak-baru")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Denda SWDKLLJ Tertunggak:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("denda-swdkllj-tertunggak")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat rumus Denda SWDKLLJ Tertunggak"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className={cn("font-mono tabular-nums", (cost.r2Result.items.find((i) => i.id === "denda-swdkllj-tertunggak")?.amount || 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                                Rp {(cost.r2Result.items.find((i) => i.id === "denda-swdkllj-tertunggak")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Denda SWDKLLJ Pajak Baru:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("denda-swdkllj-pajak-baru")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat aturan Denda SWDKLLJ Pajak Baru"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className={cn("font-mono tabular-nums", (cost.r2Result.items.find((i) => i.id === "denda-swdkllj-pajak-baru")?.amount || 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                                Rp {(cost.r2Result.items.find((i) => i.id === "denda-swdkllj-pajak-baru")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Group 3: Administrasi, Proses & Jasa */}
                        <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                          <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              3. Administrasi, Proses & Jasa
                            </span>
                            <span className="font-mono tabular-nums text-primary font-bold">
                              Rp {cost.r2Result.totalAdminDanJasa.toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs pl-2">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Proses dan ACC ID:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("proses-dan-acc-id")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat aturan Proses dan ACC ID R2"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums font-semibold">
                                Rp {(cost.r2Result.items.find((i) => i.id === "proses-dan-acc-id")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Cetak SKP (Samsat):
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("cetak-skp")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat aturan Cetak SKP"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r2Result.items.find((i) => i.id === "cetak-skp")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center gap-1">
                                Jasa Pengurusan Biro:
                                <button
                                  type="button"
                                  onClick={() => handleOpenExplanation("jasa")}
                                  className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                  title="Lihat tarif Jasa Pengurusan Motor"
                                >
                                  <HelpCircle className="w-3 h-3" />
                                </button>
                              </span>
                              <span className="font-mono tabular-nums">
                                Rp {(cost.r2Result.items.find((i) => i.id === "jasa")?.amount || 0).toLocaleString("id-ID")}
                              </span>
                            </div>
                            {(cost.r2Result.items.find((i) => i.id === "stnk-hilang")?.amount || 0) > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">STNK Hilang:</span>
                                <span className="font-mono tabular-nums">
                                  Rp {(cost.r2Result.items.find((i) => i.id === "stnk-hilang")?.amount || 0).toLocaleString("id-ID")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Group 4: Biaya Insidental (bila ada nilai) */}
                        {cost.r2Result.totalInsidental > 0 && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-500" />
                                4. Biaya Insidental
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.r2Result.totalInsidental.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.r2Result.items
                                .filter((i) => i.category === "INSIDENTAL" && i.amount > 0)
                                .map((item) => (
                                  <div key={item.id} className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      {item.name}:
                                      <button
                                        type="button"
                                        onClick={() => handleOpenExplanation("insidental")}
                                        className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                        title="Lihat penjelasan biaya insidental"
                                      >
                                        <HelpCircle className="w-3 h-3" />
                                      </button>
                                    </span>
                                    <span className="font-mono tabular-nums">Rp {item.amount.toLocaleString("id-ID")}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Kurir Antar-Jemput */}
                        {cost.courierFee > 0 && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-blue-500" />
                                Layanan Kurir Antar-Jemput
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.courierFee.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs pl-2">
                              <span className="text-muted-foreground">Metode Pengiriman:</span>
                              <Badge variant="outline" className="text-[10px] bg-background">
                                {currentConfig?.antarJemputMode || "Antar & Jemput"}
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Biaya Tambahan Wilayah (Kustom) */}
                        {cost.kustomItems && cost.kustomItems.length > 0 && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                                Biaya Tambahan Wilayah ({formData.wilayahSamsatAsal})
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.totalKustomFees.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.kustomItems.map((item: any, idx: number) => (
                                <div key={item.itemId || idx} className="flex justify-between items-center">
                                  <span className="text-muted-foreground">{item.name}:</span>
                                  <span className="font-mono tabular-nums">
                                    Rp {item.amount.toLocaleString("id-ID")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : cost.isExtendedEstimation && cost.extResult && cost.extTemplate ? (
                      <div className="space-y-3 pb-2.5 border-b border-border/60">
                        {/* Header Banner */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20 text-xs">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-purple-600" />
                            <div>
                              <span className="font-semibold text-foreground">
                                Durasi Keterlambatan: {cost.extResult.durasiKeterlambatan}
                              </span>
                              <span className="text-muted-foreground text-[11px] block">
                                {cost.extResult.tahunTunggakan} Tahun, Denda: {cost.extResult.bulanTunggakan} Bulan • Program: <strong className="text-foreground">{extProgramSamsat}</strong> {cost.extTemplate.serviceType === "Balik Nama" || cost.extTemplate.serviceType.includes("Mutasi") ? `• BBN: ${extFreeBbn ? "FREE" : "BAYAR"}` : ""}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenExplanation("denda-pkb-pajak-baru")}
                              className="h-7 text-[11px] gap-1 px-2.5 font-medium border-purple-500/30 text-purple-600 hover:bg-purple-500/10 bg-background/80 shadow-2xs"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              Detail Penjelasan Hitungan
                            </Button>
                            <Badge variant="outline" className="text-[10px] font-mono bg-background text-purple-600 border-purple-500/30">
                              {cost.extTemplate.name}
                            </Badge>
                          </div>
                        </div>

                        {/* Breakdown per Item Category */}
                        {/* 1. Pokok & Denda PKB */}
                        {(cost.extResult.totalPkb > 0 || cost.extResult.totalDendaPkb > 0) && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                1. Pokok & Denda PKB
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {(cost.extResult.totalPkb + cost.extResult.totalDendaPkb).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.extResult.items
                                .filter((i) => i.category === "PKB" && (i.amount > 0 || !i.isManual))
                                .map((item) => (
                                  <div key={item.id} className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      {item.name}:
                                      <button
                                        type="button"
                                        onClick={() => handleOpenExplanation(item.id)}
                                        className="text-muted-foreground/60 hover:text-purple-600 transition-colors p-0.5 rounded cursor-pointer"
                                        title={`Lihat aturan ${item.name}`}
                                      >
                                        <HelpCircle className="w-3 h-3" />
                                      </button>
                                    </span>
                                    <span className={cn("font-mono tabular-nums", item.id.includes("denda") && item.amount > 0 ? "text-destructive" : "")}>
                                      Rp {item.amount.toLocaleString("id-ID")}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* 2. Pokok & Denda SWDKLLJ */}
                        {(cost.extResult.totalSwdkllj > 0 || cost.extResult.totalDendaSwdkllj > 0) && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                2. Pokok & Denda SWDKLLJ
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {(cost.extResult.totalSwdkllj + cost.extResult.totalDendaSwdkllj).toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.extResult.items
                                .filter((i) => i.category === "SWDKLLJ" && (i.amount > 0 || !i.isManual))
                                .map((item) => (
                                  <div key={item.id} className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      {item.name}:
                                      <button
                                        type="button"
                                        onClick={() => handleOpenExplanation(item.id)}
                                        className="text-muted-foreground/60 hover:text-purple-600 transition-colors p-0.5 rounded cursor-pointer"
                                        title={`Lihat aturan ${item.name}`}
                                      >
                                        <HelpCircle className="w-3 h-3" />
                                      </button>
                                    </span>
                                    <span className={cn("font-mono tabular-nums", item.id.includes("denda") && item.amount > 0 ? "text-destructive" : "")}>
                                      Rp {item.amount.toLocaleString("id-ID")}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* 3. Administrasi, Proses & BBN */}
                        {cost.extResult.items.some((i) => (i.category === "ADMIN" || i.category === "PROSES" || i.category === "BBN") && i.amount > 0) && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                3. Administrasi, Proses & BBN (Samsat)
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.extResult.items
                                  .filter((i) => (i.category === "ADMIN" || i.category === "PROSES" || i.category === "BBN"))
                                  .reduce((sum, i) => sum + i.amount, 0)
                                  .toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.extResult.items
                                .filter((i) => (i.category === "ADMIN" || i.category === "PROSES" || i.category === "BBN") && i.amount > 0)
                                .map((item) => (
                                  <div key={item.id} className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      {item.name}:
                                      <button
                                        type="button"
                                        onClick={() => handleOpenExplanation(item.id)}
                                        className="text-muted-foreground/60 hover:text-purple-600 transition-colors p-0.5 rounded cursor-pointer"
                                        title={`Lihat aturan ${item.name}`}
                                      >
                                        <HelpCircle className="w-3 h-3" />
                                      </button>
                                    </span>
                                    <span className="font-mono tabular-nums font-semibold">
                                      Rp {item.amount.toLocaleString("id-ID")}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* 4. Jasa Pengurusan Biro */}
                        {cost.extResult.items.some((i) => i.category === "JASA" && i.amount > 0) && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                4. Jasa Layanan Biro
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.extResult.items
                                  .filter((i) => i.category === "JASA")
                                  .reduce((sum, i) => sum + i.amount, 0)
                                  .toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.extResult.items
                                .filter((i) => i.category === "JASA" && i.amount > 0)
                                .map((item) => (
                                  <div key={item.id} className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      {item.name}:
                                      <button
                                        type="button"
                                        onClick={() => handleOpenExplanation("jasa")}
                                        className="text-muted-foreground/60 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                                        title="Lihat tarif Jasa Biro"
                                      >
                                        <HelpCircle className="w-3 h-3" />
                                      </button>
                                    </span>
                                    <span className="font-mono tabular-nums font-semibold">
                                      Rp {item.amount.toLocaleString("id-ID")}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* 5. Biaya Insidental (bila ada nilai) */}
                        {cost.extResult.totalInsidental > 0 && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-pink-500" />
                                5. Biaya Insidental / Tambahan
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.extResult.totalInsidental.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.extResult.items
                                .filter((i) => i.category === "INSIDENTAL" && i.amount > 0)
                                .map((item) => (
                                  <div key={item.id} className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      {item.name}:
                                      <button
                                        type="button"
                                        onClick={() => handleOpenExplanation("insidental")}
                                        className="text-muted-foreground/60 hover:text-purple-600 transition-colors p-0.5 rounded cursor-pointer"
                                        title="Lihat penjelasan biaya insidental"
                                      >
                                        <HelpCircle className="w-3 h-3" />
                                      </button>
                                    </span>
                                    <span className="font-mono tabular-nums">Rp {item.amount.toLocaleString("id-ID")}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Kurir Antar-Jemput */}
                        {cost.courierFee > 0 && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-blue-500" />
                                Layanan Kurir Antar-Jemput
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.courierFee.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs pl-2">
                              <span className="text-muted-foreground">Metode Pengiriman:</span>
                              <Badge variant="outline" className="text-[10px] bg-background">
                                {currentConfig?.antarJemputMode || "Antar & Jemput"}
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Biaya Tambahan Wilayah (Kustom) */}
                        {cost.kustomItems && cost.kustomItems.length > 0 && (
                          <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 bg-card/40">
                            <div className="flex justify-between items-center text-xs font-semibold text-foreground pb-1 border-b border-border/40">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                                Biaya Tambahan Wilayah ({formData.wilayahSamsatAsal})
                              </span>
                              <span className="font-mono tabular-nums text-primary font-bold">
                                Rp {cost.totalKustomFees.toLocaleString("id-ID")}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs pl-2">
                              {cost.kustomItems.map((item: any, idx: number) => (
                                <div key={item.itemId || idx} className="flex justify-between items-center">
                                  <span className="text-muted-foreground">{item.name}:</span>
                                  <span className="font-mono tabular-nums">
                                    Rp {item.amount.toLocaleString("id-ID")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      cost.breakdown && cost.breakdown.length > 0 ? (
                        <div className="space-y-1.5 pb-2.5 border-b border-border/60">
                          <div className="flex items-center justify-between">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                              Komponen Biaya Terhitung:
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenExplanation("jasa")}
                              className="h-6 text-[10px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/10 bg-background/80"
                            >
                              <HelpCircle className="w-3 h-3" />
                              Penjelasan Biaya
                            </Button>
                          </div>
                          <div className="space-y-1 pl-1">
                            {cost.breakdown.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground">{item.name}</span>
                                  <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded font-medium",
                                    item.category === "Samsat" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                                    item.category === "Jasa" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" :
                                    item.category === "Operasional" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                                    "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                                  )}>
                                    {item.category === "Samsat" ? "Samsat" :
                                     item.category === "Jasa" ? "Jasa" :
                                     item.category === "Operasional" ? "Kurir/Ops" : "Pajak"}
                                  </span>
                                  {item.status === "UNCONFIGURED" && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                      Belum Dikonfigurasi
                                    </span>
                                  )}
                                  {item.status === "ZERO_EXPLICIT" && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                                      Gratis / Rp 0
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono tabular-nums font-medium text-foreground">
                                  {item.status === "UNCONFIGURED" ? (
                                    <span className="text-amber-600 dark:text-amber-400 italic text-[11px]">(Menunggu Konfirmasi Loket)</span>
                                  ) : (
                                    `Rp ${item.amount.toLocaleString("id-ID")}`
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic py-1 pb-2 border-b border-border/60">
                          Pilih jenis pengurusan pada formulir di Step 1 untuk melihat rincian biaya.
                        </div>
                      )
                    )}

                    {!cost.isR4Annual && !cost.isR2Annual && !cost.isExtendedEstimation && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal Biaya Layanan:</span>
                          <span className="font-mono tabular-nums font-semibold text-foreground">
                            Rp {(cost.subtotalLayanan || 0).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Estimasi Pokok PKB:</span>
                          <span className="font-mono tabular-nums font-medium text-foreground">
                            Rp {cost.pkb.toLocaleString("id-ID")}
                          </span>
                        </div>
                        {isOpsenEnabled && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">OPSEN PKB:</span>
                            <span className="font-mono tabular-nums font-medium text-foreground">
                              {cost.swdkllj > 0 ? `Rp ${cost.swdkllj.toLocaleString("id-ID")}` : "Rp 0 (Nonaktif)"}
                            </span>
                          </div>
                        )}
                        {cost.dendaSwdkllj > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Denda Pajak/OPSEN PKB:</span>
                            <span className="font-mono tabular-nums font-medium text-destructive">
                              Rp {cost.dendaSwdkllj.toLocaleString("id-ID")}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {Boolean(cost.hasUnconfiguredTariff || cost.snapshot?.hasUnconfiguredTariff) && (
                      <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Perhatian: Estimasi Biaya Parsial</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Terdapat komponen tarif Samsat yang belum dikonfigurasi:{" "}
                          <strong className="underline">{(cost.unconfiguredItems || cost.snapshot?.unconfiguredItems || []).join(", ")}</strong>.
                        </p>
                        <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 italic">
                          Total di bawah ini merupakan <strong>estimasi sementara</strong>. Invoice final dan pelunasan akan disahkan setelah verifikasi biaya fisik di loket Samsat terkait.
                        </p>
                      </div>
                    )}

                    <div className="border-t border-border/80 pt-2 flex justify-between items-baseline">
                      <div>
                        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                          {cost.isR4Annual || cost.isR2Annual || cost.isExtendedEstimation
                            ? "Total Estimasi Akhir (Pajak + Jasa):"
                            : (cost.hasUnconfiguredTariff || cost.snapshot?.hasUnconfiguredTariff ? "Total Estimasi Sementara:" : "Total Estimasi Awal:")}
                          {Boolean(cost.hasUnconfiguredTariff || cost.snapshot?.hasUnconfiguredTariff) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                              Estimasi Sementara
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-base font-bold text-primary font-mono tabular-nums">
                        Rp {cost.total.toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* STEP 2 INLINE SUBMISSION ERROR + NAVIGATION & SUBMIT BUTTONS */}
                <ActionInlineError
                  error={submitError}
                  actionKey="buat-order-submit"
                  className="mt-2"
                  onDismiss={() => setSubmitError(null)}
                  onRetry={() => handleSubmitOrder()}
                  isRetrying={isSubmitting}
                />
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2.5 pt-4 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto h-9 text-xs gap-1.5"
                    onClick={() => setCurrentStep(1)}
                    disabled={isSubmitting}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali ke Data Klien & Kendaraan</span>
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs font-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan Order...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Buat Order</span>
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </Card>

      {/* QRIS POPUP MODAL */}
      <Dialog open={showQrisModal} onOpenChange={setShowQrisModal}>
        <DialogContent className="w-full sm:max-w-sm bg-card text-card-foreground p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              QRIS Resmi Biro Jasa SUN89
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Arahkan kamera smartphone klien untuk memindai kode QR pembayaran
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border border-border my-2">
            <div className="w-48 h-48 border-2 border-foreground/20 rounded p-2 flex flex-col items-center justify-between bg-white text-slate-900">
              <div className="flex justify-between w-full">
                <div className="w-10 h-10 border-4 border-black rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 bg-black" />
                </div>
                <div className="text-[10px] font-bold tracking-tight">QRIS STANDAR</div>
                <div className="w-10 h-10 border-4 border-black rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 bg-black" />
                </div>
              </div>
              <div className="p-2 border border-slate-300 rounded text-center">
                <p className="text-xs font-bold">SUN89 BIRO JASA</p>
                <p className="text-[9px] text-slate-500 font-mono">NMID: ID936005230001889</p>
              </div>
              <div className="flex justify-between w-full items-end">
                <div className="w-10 h-10 border-4 border-black rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 bg-black" />
                </div>
                <div className="text-[9px] text-slate-400">GPN / ASPI</div>
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-800 mt-3">PT Biro Jasa SUN89 Abadi</p>
            <p className="text-[11px] text-slate-500">Mendukung Seluruh Rekening Bank & E-Wallet</p>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowQrisModal(false)} className="w-full">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DOCUMENT & PAYMENT PROOF PREVIEW MODAL */}
      <Dialog open={!!previewModal} onOpenChange={() => setPreviewModal(null)}>
        <DialogContent className="w-full sm:max-w-xl max-h-[90vh] bg-card text-card-foreground p-4 sm:p-5 flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Preview: {previewModal?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground truncate">
              Nama Berkas: <span className="font-mono text-foreground">{previewModal?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-2 my-2 flex items-center justify-center bg-muted/20 border border-border rounded-lg min-h-[240px]">
            {previewModal?.fileUrl ? (
              previewModal.fileType === "image" ? (
                <img
                  src={previewModal.fileUrl}
                  alt={previewModal.name}
                  className="max-h-[60vh] max-w-full object-contain rounded"
                />
              ) : (
                <iframe
                  src={previewModal.fileUrl}
                  title={previewModal.name}
                  className="w-full h-[60vh] rounded border border-border"
                />
              )
            ) : (
              <div className="text-center p-6 space-y-2">
                <FileIcon className="w-12 h-12 text-primary/40 mx-auto" />
                <p className="text-xs font-medium text-foreground">{previewModal?.name}</p>
                <p className="text-[11px] text-muted-foreground">Berkas terdaftar resmi pada sistem operasional</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setPreviewModal(null)} className="w-full sm:w-auto">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESET CONFIRMATION ALERT DIALOG */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent className="border-border sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Reset Formulir?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Reset semua data yang sudah diisi? Semua isian yang telah Anda masukkan pada formulir order ini akan dikembalikan ke kondisi awal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleReset();
                setStep1Errors({});
                setShowResetConfirm(false);
                toast.info("Formulir berhasil direset.");
              }}
              className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-xs"
            >
              Ya, Reset Form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CREATE ORDER SUCCESS MODAL */}
      <Dialog open={!!createdOrderSuccess} onOpenChange={(open) => { if (!open) setCreatedOrderSuccess(null); }}>
        <DialogContent className="border-border sm:max-w-md bg-card text-card-foreground p-5">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Order Berhasil Dibuat
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Order berhasil disimpan dengan nomor {createdOrderSuccess?.orderNo || "-"}. Order otomatis masuk ke tahap Verifikasi (Stage 1).
            </DialogDescription>
          </DialogHeader>

          {createdOrderSuccess && (
            <div className="my-3 p-3.5 rounded-lg border border-border/70 bg-muted/20 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">No. Order</span>
                <span className="font-mono font-bold text-primary">{createdOrderSuccess.orderNo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Nama Customer</span>
                <span className="font-medium text-foreground">{createdOrderSuccess.customer}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Jenis Pengurusan</span>
                <span className="font-medium text-foreground">{createdOrderSuccess.layanan}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Nomor Polisi</span>
                <span className="font-mono font-semibold text-foreground">{createdOrderSuccess.nopol}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Samsat</span>
                <span className="font-medium text-foreground">
                  {createdOrderSuccess.wilayahSamsatAsal}
                  {createdOrderSuccess.layanan.includes("Mutasi") && ` → ${createdOrderSuccess.wilayahSamsatTujuan}`}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="text-muted-foreground font-semibold">
                  {createdOrderSuccess.costCompletenessStatus === "PARTIAL_ESTIMATE" || !createdOrderSuccess.isCostVerified
                    ? "Total Estimasi Sementara"
                    : "Total Estimasi"}
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  Rp {(createdOrderSuccess.totalEstimasi || 0).toLocaleString("id-ID")}
                </span>
              </div>
              {(createdOrderSuccess.costCompletenessStatus === "PARTIAL_ESTIMATE" || !createdOrderSuccess.isCostVerified) && (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                  ⚠️ <strong>Estimasi Sementara:</strong> Terdapat tarif dasar yang belum dikonfigurasi. Invoice final dapat diterbitkan setelah biaya diverifikasi kasir/admin.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sm:justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto h-8.5 text-xs gap-1.5"
              onClick={() => {
                setCreatedOrderSuccess(null);
                handleReset();
                setCurrentStep(1);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Order Baru</span>
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto h-8.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-semibold gap-1.5"
              onClick={() => {
                const ord = createdOrderSuccess?.orderNo;
                setCreatedOrderSuccess(null);
                navigate("/order/tracking", { state: { orderNo: ord } });
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Lihat Tracking Order</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calculation Explanation Popup Modal */}
      <CalculationExplanationModal
        open={explanationModalOpen}
        onOpenChange={setExplanationModalOpen}
        initialItemId={explanationTargetItemId}
        estimationResult={cost.r4Result || cost.r2Result || cost.extResult || null}
        template={
          cost.isR4Annual
            ? estimationStore.getTemplate("template-pajak-tahunan-r4")
            : cost.isR2Annual
            ? estimationStore.getTemplate("template-pajak-tahunan-r2")
            : cost.extTemplate || null
        }
        vehicleType={formData.jenisKendaraan}
        serviceType={formData.layanan}
        pkbDasar={parseFloat(formData.nominalPkbTerakhir) || 0}
        tanggalJatuhTempo={formData.pkbBerlakuSd || ""}
        tanggalEstimasi={new Date().toISOString().split("T")[0]}
        programSamsat={cost.isR2Annual ? r2ProgramSamsat : cost.isExtendedEstimation ? extProgramSamsat : r4ProgramSamsat}
        kondisiBerkas={cost.isR2Annual ? r2KondisiBerkas : cost.isExtendedEstimation ? extKondisiBerkas : r4KondisiBerkas}
        wilayahAccId={cost.isR2Annual ? r2WilayahAccId : cost.isExtendedEstimation ? extWilayahAccId : r4WilayahAccId}
      />
    </div>
  );
}
