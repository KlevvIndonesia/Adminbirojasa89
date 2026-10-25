import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "./ui/alert-dialog";
import { useNavigationGuard } from "../context/NavigationGuardContext";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Car,
  User,
  FileCheck,
  FolderOpen,
  Upload,
  Download,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Receipt,
  Wallet,
  Building2,
  ShieldCheck,
  AlertCircle,
  Truck,
  Calculator,
  Tag,
  CreditCard,
  Lock,
} from "lucide-react";
import { Card } from "./ui/card";
import { toast } from "sonner";
import { motion } from "motion/react";
import { formatDateDDMMYYYY, formatRupiah } from "../utils/financeFormatters";
import { PlateNumberInput } from "./PlateNumberInput";
import { SearchableSamsatSelect } from "./SearchableSamsatSelect";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { orderRepository } from "../../data/repositories/orderRepository";
import { generateNextOrderAndInvoiceNo } from "../data/orderStore";
import { documentRepository } from "../../data/repositories/documentRepository";
import { processDocumentUpload, formatFileSize } from "../utils/fileCompressor";
import { usePaymentMethods } from "../data/paymentMethodStore";
import { pricingStore, usePricingStore } from "../data/pricingStore";
import { WILAYAH_ADMINISTRATIF_LIST } from "../../domain/pricing/wilayahIndonesiaData";
import { cn } from "./ui/utils";

export interface FieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "plate-number" | "samsat-select";
  placeholder?: string;
  options?: string[];
  readOnly?: boolean;
  helpText?: string;
}

export interface UploadedDocItem {
  id: string;
  name: string;
  customName?: string;
  kategori?: string;
  size: number;
  formattedSize: string;
  mimeType: string;
  fileUrl: string;
  downloadUrl?: string;
  createdAt: string;
  phase: "BEFORE" | "AFTER";
}

export const CANONICAL_SERVICES = [
  "Perpanjangan 1 Tahun",
  "Perpanjangan 5 Tahun",
  "Mutasi Asal Samsat",
  "Mutasi Antar Daerah",
  "Balik Nama",
  "Tarik Berkas",
  "Duplikat STNK",
  "Lainnya",
] as const;

export const CATEGORY_TO_SERVICE_NAME: Record<string, string> = {
  "perpanjangan-1-tahun": "Perpanjangan 1 Tahun",
  "perpanjangan-5-tahun": "Perpanjangan 5 Tahun",
  "mutasi-asal": "Mutasi Asal Samsat",
  "mutasi-antar-daerah": "Mutasi Antar Daerah",
  "balik-nama": "Balik Nama",
  "tarik-berkas": "Tarik Berkas",
  "duplikat-stnk": "Duplikat STNK",
  "lainnya": "Lainnya",
  // Legacy aliases
  "mutasi-ld": "Mutasi Antar Daerah",
  "mutasi-as": "Mutasi Asal Samsat",
  bbn: "Balik Nama",
  "perpanjangan-pajak": "Perpanjangan 1 Tahun",
  "lain-lain": "Tarik Berkas",
};

export function getDefaultServiceFromCategory(category?: string, subTabName?: string, title?: string): string {
  if (category && CATEGORY_TO_SERVICE_NAME[category]) {
    return CATEGORY_TO_SERVICE_NAME[category];
  }
  if (subTabName && CATEGORY_TO_SERVICE_NAME[subTabName]) {
    return CATEGORY_TO_SERVICE_NAME[subTabName];
  }
  if (title) {
    const matched = CANONICAL_SERVICES.find((s) => title.toLowerCase().includes(s.toLowerCase()));
    if (matched) return matched;
  }
  return "Perpanjangan 1 Tahun";
}

interface FinanceAddPageProps {
  title: string;
  description: string;
  subTabName?: string;
  category?: string;
  fields?: FieldConfig[];
  onBack: () => void;
  onSubmit: (rows: any[]) => void;
  isEdit?: boolean;
  initialData?: any;
}

export function FinanceAddPage({
  title,
  description,
  subTabName,
  category,
  fields: _fields,
  onBack,
  onSubmit,
  isEdit = false,
  initialData,
}: FinanceAddPageProps) {
  const { setCustomHeader, setNavigationGuard } = useNavigationGuard();
  const { activeMethods } = usePaymentMethods();
  const _pricingStoreState = usePricingStore();

  // Helper to dynamically lookup Biaya Layanan from master store based on service and Samsat
  const lookupBiayaLayanan = (layananName: string, samsatName: string) => {
    if (!samsatName) return null;
    const effectiveLayanan = layananName || "Perpanjangan 1 Tahun";

    // 1. Exact match from master pricing config
    const cfg = pricingStore.getServiceFeeConfig(effectiveLayanan, samsatName);
    if (cfg && (cfg.biayaJasa || cfg.biayaAntarJemput)) {
      return {
        biayaJasa: cfg.biayaJasa || 0,
        biayaAntarJemput: cfg.biayaAntarJemput || 0,
        source: "Master Biaya Layanan",
      };
    }

    // 2. Fuzzy search in table rows
    const rows = pricingStore.getBiayaLayananRows();
    const found = rows.find(
      (r) =>
        (r.layanan.toLowerCase().includes(effectiveLayanan.toLowerCase()) ||
          effectiveLayanan.toLowerCase().includes(r.layanan.toLowerCase())) &&
        (samsatName.toLowerCase().includes(r.wilayah.toLowerCase()) ||
          r.wilayah.toLowerCase().includes(samsatName.toLowerCase()))
    );
    if (found) {
      return {
        biayaJasa: found.biayaJasa || 0,
        biayaAntarJemput: found.biayaAntarJemput || 0,
        source: "Master Biaya Layanan",
      };
    }
    return null;
  };

  // Derive dynamic bank options strictly from active master payment methods
  const activeBankNames = Array.from(
    new Set(
      activeMethods
        .filter((m) => m.bank && m.bank !== "Tunai" && m.bank.toUpperCase() !== "QRIS")
        .map((m) => m.bank!)
    )
  );
  if (activeBankNames.length === 0) {
    activeBankNames.push("BCA", "BRI", "Mandiri");
  }

  const bankMasukOptions = Array.from(new Set([...activeBankNames, "Kas Kantor", "Lainnya"]));
  const bankKeluarOptions = Array.from(new Set([...activeBankNames, "Kas Kantor", "Kas Messenger", "Lainnya"]));

  const getEmptyRow = () => {
    const today = new Date().toISOString().split("T")[0];
    const allOrders = orderRepository.getAllFlat?.() || [];
    const { orderNo: autoOrderNo, invoiceNo: autoInvoice } = generateNextOrderAndInvoiceNo(today, allOrders);

    const initialService = getDefaultServiceFromCategory(category, subTabName, title);
    const isInitialMutasi = initialService === "Mutasi Asal Samsat" || initialService === "Mutasi Antar Daerah";
    const initialSamsat = "Samsat Jakarta Timur";
    const initialPricing = lookupBiayaLayanan(initialService, initialSamsat);
    const initBiayaJasa = initialPricing ? initialPricing.biayaJasa : 150000;
    const initBiayaAntarJemput = initialPricing ? initialPricing.biayaAntarJemput : 0;
    const initBiayaSamsat = 0;
    const initBiayaLainnya = 0;
    const initTotalTagihan = initBiayaSamsat + initBiayaJasa + initBiayaAntarJemput + initBiayaLainnya;
    const initProfit = 0 - initBiayaSamsat - initBiayaLainnya;

    const defaultBank = activeBankNames[0] || "BCA";
    const defaultMethod = activeMethods.find((m) => m.bank === defaultBank);

    const row: any = {
      // 1. Informasi Berkas & Order
      "Tanggal Masuk Berkas": today,
      "Nomor Order": autoOrderNo,
      "Jenis Pengurusan": initialService,
      "Status Pengerjaan": "Dalam Proses",

      // 2. Data Kendaraan & Pemilik STNK
      "R4 / R2": "R4",
      "Status Kepemilikan": "Pribadi",
      "Plat No": "B",
      "Nama Customer": "",
      "Nama Pemilik (STNK/BPKB)": "",
      "Nomor HP": "",
      "No HP": "",
      "Provinsi": "DKI Jakarta",
      "Kota/Kabupaten": "Jakarta Timur",
      "Kecamatan": "",
      "Kelurahan/Desa": "",
      "RT/RW": "",
      "Nomor Rumah": "",
      "Patokan": "",
      "Detail Alamat": "",
      "Link Lokasi": "",
      "Alamat": "",

      // 3. Wilayah & Kantor Samsat
      "Samsat Asal": initialSamsat,
      "Samsat": initialSamsat,
      "Samsat Tujuan": isInitialMutasi ? "" : "-",

      // 4 & 5. Dokumen Masuk & Keluar
      dokumenAwal: [],
      dokumenAkhir: [],

      // 6. Rincian Keuangan, Biaya & Profit
      "Tanggal Uang Masuk": today,
      "Uang Masuk dari Konsumen": 0,
      "Skema Pembayaran": "Bayar di Awal",
      "Metode Pembayaran Masuk": "Transfer Bank",
      "Bank Uang Masuk": defaultBank,
      "Nomor Rekening Masuk": defaultMethod?.nomor_rekening || "",
      "Nama Pemilik Rekening Masuk": defaultMethod?.nama_rekening || "",
      "Nomor Rekening Pengirim": "",

      "Tanggal Uang Keluar": today,
      "Biaya Pokok Samsat": 0,
      "Staf Pengirim": "",
      "Nama Penerima": "Petugas Loket Samsat",
      "Nama Rekening/Penerima": "Petugas Loket Samsat",
      "Nama Pemilik Rekening Keluar": "Petugas Loket Samsat",
      "Metode Pembayaran Keluar": "Kas Tunai",
      "Bank Uang Keluar": "-",
      "Nomor Rekening Penerima": "",

      "Biaya Jasa": initBiayaJasa,
      "Biaya Antar Jemput": initBiayaAntarJemput,
      "Biaya Lainnya": 0,
      "Total Tagihan Konsumen": initTotalTagihan,
      "Sisa Tagihan": initTotalTagihan,
      "Profit": initProfit,
      "Jumlah Cashback": 0,
      "Status Pembayaran": "Belum Bayar",

      // 7. Faktur, Dokumen Fisik & Tanda Terima
      "No Invoice": autoInvoice,
      "Dokumen BPKB": "Ada",
      "BPKB": "Ada",
      "Status BPKB": "Proses",
      "Nomor TTB BPKB": "",
      "TTB BPKB": "",
      "Tanda Terima": "",
      "Nomor Tanda Terima": "",
      "Keterangan": "",
      "Keterangan Dokumen BPKB": "",
    };

    return row;
  };

  const getRowFromInitialData = (init: any) => {
    const today = new Date().toISOString().split("T")[0];
    const initialService = init["Jenis Pengurusan"] || init.layanan || getDefaultServiceFromCategory(category, subTabName, title);
    const orderNo = init["Nomor Order"] || init.orderNo || (typeof init.id === "string" && init.id.startsWith("ord:") ? init.id.slice(4) : "");
    const canonicalOrder = orderNo ? orderRepository.getByOrderNo(orderNo) : null;

    // Resolve documents
    let docsAwal: UploadedDocItem[] = [];
    let docsAkhir: UploadedDocItem[] = [];
    if (Array.isArray(init.dokumenAwal)) {
      docsAwal = init.dokumenAwal;
    }
    if (Array.isArray(init.dokumenAkhir)) {
      docsAkhir = init.dokumenAkhir;
    }
    if (docsAwal.length === 0 && docsAkhir.length === 0 && canonicalOrder?.rekapDocuments) {
      canonicalOrder.rekapDocuments.forEach((doc: any, idx: number) => {
        const item: UploadedDocItem = {
          id: doc.id || `doc-${idx}`,
          name: doc.label || doc.documentType || "Dokumen",
          size: 102400,
          formattedSize: "100 KB",
          mimeType: doc.fileType === "PDF" ? "application/pdf" : "image/jpeg",
          fileUrl: doc.fileUrl || "",
          createdAt: doc.uploadedAt || new Date().toISOString(),
          phase: doc.phase || "BEFORE",
        };
        if (doc.phase === "AFTER") {
          docsAkhir.push(item);
        } else {
          docsAwal.push(item);
        }
      });
    }

    const defaultBank = activeBankNames[0] || "BCA";
    const defaultMethod = activeMethods.find((m) => m.bank === defaultBank);

    const addr = canonicalOrder?.alamatPenjemputan || init.alamatPenjemputan || {};
    const detailAlamat = addr.detail || init.detailAlamat || init["Detail Alamat"] || init.alamat || init["Alamat"] || "";
    const kota = addr.kota || init.kota || init["Kota/Kabupaten"] || init.samsat || init["Samsat Asal"] || "Jakarta Timur";
    const kecamatan = addr.kecamatan || init.kecamatan || init["Kecamatan"] || "";
    const kelurahan = addr.kelurahan || init.kelurahan || init["Kelurahan/Desa"] || "";
    const rtRw = addr.rtRw || init.rtRw || init["RT/RW"] || "";
    const nomorRumah = addr.nomor || init.nomorRumah || init["Nomor Rumah"] || "";
    const patokan = addr.landmark || init.patokan || init["Patokan"] || "";
    const linkLokasi = addr.mapsUrl || init.linkLokasi || init["Link Lokasi"] || "";
    const provinsi = init.provinsi || init["Provinsi"] || "DKI Jakarta";

    const biayaSamsat = Number(init["Biaya Pokok Samsat"] ?? init.biayaSamsat ?? init.uangKeluar ?? 0);
    const biayaJasa = Number(init["Biaya Jasa"] ?? init.biayaJasa ?? 150000);
    const biayaAntarJemput = Number(init["Biaya Antar Jemput"] ?? init.biayaAntarJemput ?? 0);
    const biayaLainnya = Number(init["Biaya Lainnya"] ?? init.biayaLainnya ?? 0);
    const totalTagihan = Number(init["Total Tagihan Konsumen"] ?? init.totalTagihan ?? init.totalEstimasi ?? (biayaSamsat + biayaJasa + biayaAntarJemput + biayaLainnya));
    const uangMasuk = Number(init["Uang Masuk dari Konsumen"] ?? init.uangMasuk ?? init.dibayar ?? 0);
    const profit = Number(init["Profit"] ?? init.profit ?? (uangMasuk - biayaSamsat - biayaLainnya));

    return {
      "Tanggal Masuk Berkas": init["Tanggal Masuk Berkas"] || init.tanggalMasukBerkas || today,
      "Nomor Order": orderNo,
      "Jenis Pengurusan": initialService,
      "Status Pengerjaan": init["Status Pengerjaan"] || init.statusPengerjaan || "Dalam Proses",

      "R4 / R2": init["R4 / R2"] || (init.jenisKendaraan?.toLowerCase().includes("motor") ? "R2" : "R4") || "R4",
      "Status Kepemilikan": init["Status Kepemilikan"] || init.kepemilikanKendaraan || "Pribadi",
      "Plat No": init["Plat No"] || init.nopol || "",
      "Nama Customer": init["Nama Customer"] || init.customer || "",
      "Nama Pemilik (STNK/BPKB)": init["Nama Pemilik (STNK/BPKB)"] || init.namaPemilik || "",
      "Nomor HP": init["Nomor HP"] || init["No HP"] || init.nomorHP || init.phone || "",
      "No HP": init["Nomor HP"] || init["No HP"] || init.nomorHP || init.phone || "",

      "Provinsi": provinsi,
      "Kota/Kabupaten": kota,
      "Kecamatan": kecamatan,
      "Kelurahan/Desa": kelurahan,
      "RT/RW": rtRw,
      "Nomor Rumah": nomorRumah,
      "Patokan": patokan,
      "Detail Alamat": detailAlamat,
      "Link Lokasi": linkLokasi,
      "Alamat": init["Alamat"] || init.alamat || "",

      "Samsat Asal": init["Samsat Asal"] || init.wilayahSamsatAsal || init["Samsat"] || "Samsat Jakarta Timur",
      "Samsat": init["Samsat Asal"] || init.wilayahSamsatAsal || init["Samsat"] || "Samsat Jakarta Timur",
      "Samsat Tujuan": init["Samsat Tujuan"] || init.wilayahSamsatTujuan || "-",

      dokumenAwal: docsAwal,
      dokumenAkhir: docsAkhir,

      "Tanggal Uang Masuk": init["Tanggal Uang Masuk"] || today,
      "Uang Masuk dari Konsumen": uangMasuk,
      "Skema Pembayaran": init["Skema Pembayaran"] || init.jenisBayar || "Bayar di Awal",
      "Metode Pembayaran Masuk": init["Metode Pembayaran Masuk"] || "Transfer Bank",
      "Bank Uang Masuk": init["Bank Uang Masuk"] || defaultBank,
      "Nomor Rekening Masuk": init["Nomor Rekening Masuk"] || defaultMethod?.nomor_rekening || "",
      "Nama Pemilik Rekening Masuk": init["Nama Pemilik Rekening Masuk"] || defaultMethod?.nama_rekening || "",
      "Nomor Rekening Pengirim": init["Nomor Rekening Pengirim"] || init.noRekeningPengirim || init["Nomor Rekening Masuk"] || "",

      "Tanggal Uang Keluar": init["Tanggal Uang Keluar"] || today,
      "Biaya Pokok Samsat": biayaSamsat,
      "Staf Pengirim": init["Staf Pengirim"] || init.stafPengirim || "",
      "Nama Penerima": init["Nama Penerima"] || init.namaPenerima || init["Nama Rekening/Penerima"] || init.namaPenerimaKeluar || "Petugas Loket Samsat",
      "Nama Rekening/Penerima": init["Nama Penerima"] || init.namaPenerima || init["Nama Rekening/Penerima"] || init.namaPenerimaKeluar || "Petugas Loket Samsat",
      "Nama Pemilik Rekening Keluar": init["Nama Penerima"] || init.namaPenerima || init["Nama Rekening/Penerima"] || init.namaPenerimaKeluar || "Petugas Loket Samsat",
      "Metode Pembayaran Keluar": init["Metode Pembayaran Keluar"] || "Kas Tunai",
      "Bank Uang Keluar": init["Bank Uang Keluar"] || "-",
      "Nomor Rekening Penerima": init["Nomor Rekening Penerima"] || init.noRekeningPenerima || "",

      "Biaya Jasa": biayaJasa,
      "Biaya Antar Jemput": biayaAntarJemput,
      "Biaya Lainnya": biayaLainnya,
      "Total Tagihan Konsumen": totalTagihan,
      "Sisa Tagihan": Math.max(0, totalTagihan - uangMasuk),
      "Profit": profit,
      "Jumlah Cashback": Number(init["Jumlah Cashback"] || 0),
      "Status Pembayaran": init["Status Pembayaran"] || (uangMasuk >= totalTagihan && totalTagihan > 0 ? "Lunas" : uangMasuk > 0 ? "Kurang Bayar" : "Belum Bayar"),

      "No Invoice": init["No Invoice"] || init.noInvoice || (orderNo ? orderNo.replace(/^ORD-/, "INV-") : ""),
      "Dokumen BPKB": init["Dokumen BPKB"] || init.bpkb || "Ada",
      "BPKB": init["BPKB"] || init["Dokumen BPKB"] || init.bpkb || "Ada",
      "Status BPKB": init["Status BPKB"] || "Proses",
      "Nomor TTB BPKB": init["Nomor TTB BPKB"] || init["TTB BPKB"] || "",
      "TTB BPKB": init["TTB BPKB"] || init["Nomor TTB BPKB"] || "",
      "Tanda Terima": init["Tanda Terima"] || "",
      "Nomor Tanda Terima": init["Nomor Tanda Terima"] || init["Tanda Terima"] || "",
      "Keterangan": init["Keterangan"] || init.catatan || init.catatanOrder || "",
      "Keterangan Dokumen BPKB": init["Keterangan Dokumen BPKB"] || "",
    };
  };

  const initialRowsData = useMemo(() => {
    if (isEdit && initialData) {
      return [getRowFromInitialData(initialData)];
    }
    return [getEmptyRow()];
  }, [isEdit, initialData]);

  const [rows, setRows] = useState<any[]>(initialRowsData);
  const [initialSnapshot] = useState(() => JSON.stringify(initialRowsData));
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidationAlertOpen, setIsValidationAlertOpen] = useState(false);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);

  // Address completion toggle per row (State: hasAddress, default: false unless address already exists)
  const [hasAddress, setHasAddress] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    if (isEdit && initialData) {
      const hasInitAddr = Boolean(
        (initialData?.detailAlamat && initialData.detailAlamat.trim()) ||
        (initialData?.["Detail Alamat"] && initialData["Detail Alamat"].trim()) ||
        (initialData?.alamatPenjemputan?.detail && initialData.alamatPenjemputan.detail.trim()) ||
        (initialData?.alamat && initialData.alamat.trim() && initialData.alamat !== "-" && !initialData.alamat.toLowerCase().includes("loket kantor")) ||
        (initialData?.["Alamat"] && initialData["Alamat"].trim() && initialData["Alamat"] !== "-")
      );
      initial[0] = hasInitAddr;
    }
    return initial;
  });

  const isFormDirty = useMemo(() => {
    return JSON.stringify(rows) !== initialSnapshot;
  }, [rows, initialSnapshot]);

  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  const handleCancelClick = useCallback(() => {
    if (isFormDirty) {
      setIsDiscardDialogOpen(true);
    } else {
      onBackRef.current();
    }
  }, [isFormDirty]);

  const handleConfirmDiscard = useCallback(() => {
    setIsDiscardDialogOpen(false);
    onBackRef.current();
  }, []);

  // Track "Nama Pemilik sama dengan Nama Customer" per row
  const [sameAsCustomer, setSameAsCustomer] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    if (isEdit && initialData) {
      const cust = (initialData["Nama Customer"] || initialData.customer || "").trim();
      const owner = (initialData["Nama Pemilik (STNK/BPKB)"] || initialData.namaPemilik || "").trim();
      if (cust && owner && cust.toLowerCase() === owner.toLowerCase()) {
        initial[0] = true;
      }
    }
    return initial;
  });

  // States for custom text inputs when "Lainnya" is selected
  const [customBankMasuk, setCustomBankMasuk] = useState<Record<number, string>>({});
  const [customMetodeMasuk, setCustomMetodeMasuk] = useState<Record<number, string>>({});
  const [customBankKeluar, setCustomBankKeluar] = useState<Record<number, string>>({});
  const [customMetodeKeluar, setCustomMetodeKeluar] = useState<Record<number, string>>({});

  // Loading states for document uploads
  const [uploadingAwal, setUploadingAwal] = useState<Record<number, boolean>>({});
  const [uploadingAkhir, setUploadingAkhir] = useState<Record<number, boolean>>({});

  // Native HTML5 drag-and-drop state per row
  const [isDraggingAwal, setIsDraggingAwal] = useState<Record<number, boolean>>({});
  const [isDraggingAkhir, setIsDraggingAkhir] = useState<Record<number, boolean>>({});

  // Modal preview state
  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    title: string;
    documentName: string;
    rawUrl?: string;
    fileType?: "image" | "pdf" | string;
    documentId?: string;
  } | null>(null);

  // Hidden file input refs
  const fileInputAwalRef = useRef<HTMLInputElement | null>(null);
  const fileInputAkhirRef = useRef<HTMLInputElement | null>(null);
  const [activeUploadRowIndex, setActiveUploadRowIndex] = useState<number>(0);

  const handleAddRow = () => {
    setRows([...rows, getEmptyRow()]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      toast.error("Minimal harus ada satu data transaksi");
      return;
    }
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleToggleSameAsCustomer = (rowIndex: number, checked: boolean) => {
    setSameAsCustomer((prev) => ({ ...prev, [rowIndex]: checked }));
    if (checked) {
      const custName = rows[rowIndex]["Nama Customer"] || "";
      handleFieldChange(rowIndex, "Nama Pemilik (STNK/BPKB)", custName);
    }
  };

  const handleFieldChange = (rowIndex: number, fieldKey: string, value: any) => {
    const updated = [...rows];
    updated[rowIndex][fieldKey] = value;

    // If "Nama Customer" changes and sameAsCustomer is active, mirror to "Nama Pemilik"
    if (fieldKey === "Nama Customer" && sameAsCustomer[rowIndex]) {
      updated[rowIndex]["Nama Pemilik (STNK/BPKB)"] = value;
    }

    // Dynamic fee lookup when Jenis Pengurusan changes
    if (fieldKey === "Jenis Pengurusan") {
      const currentSamsat = updated[rowIndex]["Samsat Asal"] || updated[rowIndex]["Samsat"];
      const pricing = lookupBiayaLayanan(value, currentSamsat);
      if (pricing) {
        updated[rowIndex]["Biaya Jasa"] = pricing.biayaJasa;
        if (pricing.biayaAntarJemput !== undefined) {
          updated[rowIndex]["Biaya Antar Jemput"] = pricing.biayaAntarJemput;
        }
      }
    }

    // Dynamic fee lookup when Samsat Asal changes
    if (fieldKey === "Samsat Asal" || fieldKey === "Samsat") {
      const currentService = updated[rowIndex]["Jenis Pengurusan"];
      const pricing = lookupBiayaLayanan(currentService, value);
      if (pricing) {
        updated[rowIndex]["Biaya Jasa"] = pricing.biayaJasa;
        if (pricing.biayaAntarJemput !== undefined) {
          updated[rowIndex]["Biaya Antar Jemput"] = pricing.biayaAntarJemput;
        }
      }
    }

    // Handle cascading payment method resets for Penerimaan Uang (Kas Masuk)
    if (fieldKey === "Metode Pembayaran Masuk") {
      if (value === "Cash / Tunai" || value === "Cash" || value === "Tunai") {
        updated[rowIndex]["Bank Uang Masuk"] = "-";
        updated[rowIndex]["Nomor Rekening Masuk"] = "";
        updated[rowIndex]["Nama Pemilik Rekening Masuk"] = "";
      } else if (value === "Transfer Bank") {
        const defaultBank = activeBankNames[0] || "BCA";
        updated[rowIndex]["Bank Uang Masuk"] = defaultBank;
        const matched = activeMethods.find((m) => m.bank === defaultBank);
        updated[rowIndex]["Nomor Rekening Masuk"] = matched?.nomor_rekening || "";
        updated[rowIndex]["Nama Pemilik Rekening Masuk"] = matched?.nama_rekening || "";
      } else if (value === "QRIS") {
        const qrisMethod = activeMethods.find((m) => m.bank?.toUpperCase() === "QRIS" || m.nama_metode?.toUpperCase() === "QRIS");
        updated[rowIndex]["Bank Uang Masuk"] = "QRIS";
        updated[rowIndex]["Nomor Rekening Masuk"] = qrisMethod?.nomor_rekening || "";
        updated[rowIndex]["Nama Pemilik Rekening Masuk"] = qrisMethod?.nama_rekening || "";
      } else if (value === "Lainnya") {
        updated[rowIndex]["Bank Uang Masuk"] = "Lainnya";
        updated[rowIndex]["Nomor Rekening Masuk"] = "";
        updated[rowIndex]["Nama Pemilik Rekening Masuk"] = "";
      }
    }

    // Handle Bank Uang Masuk changes: Auto-fill account number & account holder from master
    if (fieldKey === "Bank Uang Masuk") {
      if (value && value !== "Lainnya" && value !== "-") {
        const matched = activeMethods.find((m) => m.bank === value);
        if (matched) {
          updated[rowIndex]["Nomor Rekening Masuk"] = matched.nomor_rekening || "";
          updated[rowIndex]["Nama Pemilik Rekening Masuk"] = matched.nama_rekening || "";
        }
      }
    }

    // Handle cascading payment method resets for Pengeluaran Samsat (Kas Keluar)
    if (fieldKey === "Metode Pembayaran Keluar") {
      if (value === "Kas Tunai" || value === "Cash" || value === "Tunai") {
        updated[rowIndex]["Bank Uang Keluar"] = "-";
      } else if (value === "Transfer Bank") {
        updated[rowIndex]["Bank Uang Keluar"] = activeBankNames[0] || "BCA";
      } else if (value === "Kas Kantor") {
        updated[rowIndex]["Bank Uang Keluar"] = "Kas Kantor";
      } else if (value === "Kas Messenger") {
        updated[rowIndex]["Bank Uang Keluar"] = "Kas Messenger";
      } else if (value === "QRIS") {
        updated[rowIndex]["Bank Uang Keluar"] = "QRIS";
      } else if (value === "Lainnya") {
        updated[rowIndex]["Bank Uang Keluar"] = "Lainnya";
      }
    }

    // Synchronize Nama Rekening / Penerima for Pengeluaran Samsat
    if (fieldKey === "Nama Rekening/Penerima") {
      updated[rowIndex]["Nama Pemilik Rekening Keluar"] = value;
      updated[rowIndex]["Nama Penerima"] = value;
    } else if (fieldKey === "Nama Pemilik Rekening Keluar") {
      updated[rowIndex]["Nama Rekening/Penerima"] = value;
      updated[rowIndex]["Nama Penerima"] = value;
    } else if (fieldKey === "Nama Penerima") {
      updated[rowIndex]["Nama Rekening/Penerima"] = value;
      updated[rowIndex]["Nama Pemilik Rekening Keluar"] = value;
    }

    // Synchronize Nomor Rekening Pengirim with Nomor Rekening Masuk
    if (fieldKey === "Nomor Rekening Pengirim") {
      updated[rowIndex]["Nomor Rekening Masuk"] = value;
    } else if (fieldKey === "Nomor Rekening Masuk") {
      updated[rowIndex]["Nomor Rekening Pengirim"] = value;
    }

    // Synchronize Dokumen BPKB and BPKB
    if (fieldKey === "Dokumen BPKB") {
      updated[rowIndex]["BPKB"] = value;
      if (value === "Ada") {
        updated[rowIndex]["Status BPKB"] = "Proses";
      } else if (value === "Tidak Ada") {
        updated[rowIndex]["Status BPKB"] = "-";
      }
    } else if (fieldKey === "BPKB") {
      updated[rowIndex]["Dokumen BPKB"] = value;
    }

    // Synchronize Nomor TTB BPKB and TTB BPKB
    if (fieldKey === "Nomor TTB BPKB") {
      updated[rowIndex]["TTB BPKB"] = value;
    } else if (fieldKey === "TTB BPKB") {
      updated[rowIndex]["Nomor TTB BPKB"] = value;
    }

    // Synchronize Tanda Terima and Nomor Tanda Terima
    if (fieldKey === "Tanda Terima") {
      updated[rowIndex]["Nomor Tanda Terima"] = value;
    } else if (fieldKey === "Nomor Tanda Terima") {
      updated[rowIndex]["Tanda Terima"] = value;
    }

    // Financial calculations & status derivations
    if (
      fieldKey === "Uang Masuk dari Konsumen" ||
      fieldKey === "Biaya Pokok Samsat" ||
      fieldKey === "Biaya Jasa" ||
      fieldKey === "Biaya Antar Jemput" ||
      fieldKey === "Biaya Lainnya" ||
      fieldKey === "Total Tagihan Konsumen" ||
      fieldKey === "Samsat Asal" ||
      fieldKey === "Samsat" ||
      fieldKey === "Jenis Pengurusan"
    ) {
      const uangMasuk = Math.max(
        0,
        Number(fieldKey === "Uang Masuk dari Konsumen" ? value : updated[rowIndex]["Uang Masuk dari Konsumen"] || 0)
      );
      const biayaSamsat = Math.max(
        0,
        Number(fieldKey === "Biaya Pokok Samsat" ? value : updated[rowIndex]["Biaya Pokok Samsat"] || 0)
      );
      const biayaJasa = Math.max(
        0,
        Number(fieldKey === "Biaya Jasa" ? value : updated[rowIndex]["Biaya Jasa"] || 0)
      );
      const biayaAntarJemput = Math.max(
        0,
        Number(fieldKey === "Biaya Antar Jemput" ? value : updated[rowIndex]["Biaya Antar Jemput"] || 0)
      );
      const biayaLainnya = Math.max(
        0,
        Number(fieldKey === "Biaya Lainnya" ? value : updated[rowIndex]["Biaya Lainnya"] || 0)
      );

      let totalTagihan = Number(
        fieldKey === "Total Tagihan Konsumen" ? value : updated[rowIndex]["Total Tagihan Konsumen"] || 0
      );

      // Recalculate Total Tagihan if Biaya Jasa, Biaya Antar Jemput, Biaya Lainnya, or Biaya Samsat changed
      if (
        fieldKey === "Biaya Jasa" ||
        fieldKey === "Biaya Antar Jemput" ||
        fieldKey === "Biaya Lainnya" ||
        fieldKey === "Biaya Pokok Samsat" ||
        fieldKey === "Samsat Asal" ||
        fieldKey === "Samsat" ||
        fieldKey === "Jenis Pengurusan"
      ) {
        totalTagihan = biayaSamsat + biayaJasa + biayaAntarJemput + biayaLainnya;
        updated[rowIndex]["Total Tagihan Konsumen"] = totalTagihan;
      } else if (totalTagihan === 0 && uangMasuk > 0 && fieldKey === "Uang Masuk dari Konsumen") {
        totalTagihan = uangMasuk;
        updated[rowIndex]["Total Tagihan Konsumen"] = totalTagihan;
      }

      const sisaTagihan = Math.max(0, totalTagihan - uangMasuk);
      const cashback = Math.max(0, uangMasuk - totalTagihan);
      const profit = uangMasuk - biayaSamsat - biayaLainnya;

      updated[rowIndex]["Sisa Tagihan"] = sisaTagihan;
      updated[rowIndex]["Jumlah Cashback"] = cashback;
      updated[rowIndex]["Profit"] = profit;

      // Canonical Status Pembayaran rule
      if (uangMasuk === 0) {
        updated[rowIndex]["Status Pembayaran"] = "Belum Bayar";
      } else if (totalTagihan > 0 && uangMasuk < totalTagihan) {
        updated[rowIndex]["Status Pembayaran"] = "Kurang Bayar";
      } else if (totalTagihan > 0 && uangMasuk > totalTagihan) {
        updated[rowIndex]["Status Pembayaran"] = "Kelebihan Bayar";
      } else {
        updated[rowIndex]["Status Pembayaran"] = "Lunas";
      }
    }

    // Synchronized Order & Invoice Numbering lockstep on Tanggal Masuk Berkas
    if (fieldKey === "Tanggal Masuk Berkas") {
      if (!isEdit) {
        const allOrders = orderRepository.getAllFlat?.() || [];
        const { orderNo: newOrderNo, invoiceNo: newInvoiceNo } = generateNextOrderAndInvoiceNo(value, allOrders);
        updated[rowIndex]["Nomor Order"] = newOrderNo;
        updated[rowIndex]["No Invoice"] = newInvoiceNo;
      }
    }

    // Sync Samsat Asal and Samsat
    if (fieldKey === "Samsat Asal") {
      updated[rowIndex]["Samsat"] = value;
    } else if (fieldKey === "Samsat") {
      updated[rowIndex]["Samsat Asal"] = value;
    }

    // Sync Nomor HP and No HP
    if (fieldKey === "Nomor HP") {
      updated[rowIndex]["No HP"] = value;
    } else if (fieldKey === "No HP") {
      updated[rowIndex]["Nomor HP"] = value;
    }

    setRows(updated);
  };

  const handleAddressChange = (rowIndex: number, addrKey: string, val: string) => {
    const updated = [...rows];
    updated[rowIndex][addrKey] = val;

    const detail = updated[rowIndex]["Detail Alamat"] || "";
    const nomor = updated[rowIndex]["Nomor Rumah"] || "";
    const rtRw = updated[rowIndex]["RT/RW"] || "";
    const kelurahan = updated[rowIndex]["Kelurahan/Desa"] || "";
    const kecamatan = updated[rowIndex]["Kecamatan"] || "";
    const kota = updated[rowIndex]["Kota/Kabupaten"] || "";
    const provinsi = updated[rowIndex]["Provinsi"] || "";

    const fullAlamat = [
      detail,
      nomor ? `No. ${nomor}` : "",
      rtRw ? `RT/RW ${rtRw}` : "",
      kelurahan ? `Kel. ${kelurahan}` : "",
      kecamatan ? `Kec. ${kecamatan}` : "",
      kota,
      provinsi,
    ]
      .filter(Boolean)
      .join(", ");

    updated[rowIndex]["Alamat"] = fullAlamat;
    setRows(updated);
  };

  // Upload handlers for Dokumen Masuk (BEFORE/INBOUND) & Dokumen Keluar (AFTER/OUTBOUND)
  const triggerUploadAwal = (rowIndex: number) => {
    setActiveUploadRowIndex(rowIndex);
    if (fileInputAwalRef.current) {
      fileInputAwalRef.current.value = "";
      fileInputAwalRef.current.click();
    }
  };

  const triggerUploadAkhir = (rowIndex: number) => {
    setActiveUploadRowIndex(rowIndex);
    if (fileInputAkhirRef.current) {
      fileInputAkhirRef.current.value = "";
      fileInputAkhirRef.current.click();
    }
  };

  const handleProcessFiles = async (
    files: File[],
    type: "dokumenAwal" | "dokumenAkhir",
    rowIndex: number
  ) => {
    if (files.length === 0) return;
    const isAwal = type === "dokumenAwal";
    const setUploading = isAwal ? setUploadingAwal : setUploadingAkhir;

    setUploading((prev) => ({ ...prev, [rowIndex]: true }));

    try {
      const editOrderNo = isEdit
        ? (initialData?.orderNo || initialData?.["Nomor Order"] || (typeof initialData?.id === "string" && initialData.id.startsWith("ord:") ? initialData.id.slice(4) : ""))
        : "";

      const newItems: UploadedDocItem[] = [];
      for (const file of files) {
        // 1. Adaptive client-side compression & validation (in-memory Data URL)
        const processed = await processDocumentUpload(file);
        let docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        let fileUrl = processed.fileUrl;

        // If in edit mode with known orderNo, upload directly to backend SQLite store
        if (editOrderNo) {
          try {
            const uploaded = await documentRepository.uploadDocument(file, {
              orderNo: editOrderNo,
              documentType: "OTHER",
              metadata: { phase: isAwal ? "BEFORE" : "AFTER", originalName: file.name },
            });
            if (uploaded?.id) {
              docId = uploaded.id;
              fileUrl = uploaded.fileUrl || fileUrl;
            }
          } catch (uploadErr) {
            console.warn("[FinanceAddPage] Server upload fallback to local preview:", uploadErr);
          }
        }

        newItems.push({
          id: docId,
          name: processed.fileName || file.name,
          customName: processed.fileName || file.name,
          kategori: isAwal ? "Dokumen Masuk" : "Dokumen Keluar",
          size: processed.fileSize,
          formattedSize: formatFileSize(processed.fileSize),
          mimeType: processed.mimeType,
          fileUrl,
          downloadUrl: fileUrl,
          createdAt: new Date().toISOString(),
          phase: isAwal ? "BEFORE" : "AFTER",
        });
      }

      const currentList = Array.isArray(rows[rowIndex][type]) ? rows[rowIndex][type] : [];
      handleFieldChange(rowIndex, type, [...currentList, ...newItems]);
      toast.success(
        `${files.length} berkas ${isAwal ? "Dokumen Masuk (INBOUND)" : "Dokumen Keluar (OUTBOUND)"} berhasil ditambahkan.`
      );
    } catch (err: any) {
      toast.error(err?.message || `Gagal memproses berkas dokumen`);
    } finally {
      setUploading((prev) => ({ ...prev, [rowIndex]: false }));
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "dokumenAwal" | "dokumenAkhir"
  ) => {
    const files = Array.from(e.target.files || []);
    await handleProcessFiles(files, type, activeUploadRowIndex);
    if (e.target) e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent, type: "dokumenAwal" | "dokumenAkhir", rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "dokumenAwal") {
      setIsDraggingAwal((prev) => ({ ...prev, [rowIndex]: true }));
    } else {
      setIsDraggingAkhir((prev) => ({ ...prev, [rowIndex]: true }));
    }
  };

  const handleDragLeave = (e: React.DragEvent, type: "dokumenAwal" | "dokumenAkhir", rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (type === "dokumenAwal") {
      setIsDraggingAwal((prev) => ({ ...prev, [rowIndex]: false }));
    } else {
      setIsDraggingAkhir((prev) => ({ ...prev, [rowIndex]: false }));
    }
  };

  const handleDrop = async (e: React.DragEvent, type: "dokumenAwal" | "dokumenAkhir", rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "dokumenAwal") {
      setIsDraggingAwal((prev) => ({ ...prev, [rowIndex]: false }));
    } else {
      setIsDraggingAkhir((prev) => ({ ...prev, [rowIndex]: false }));
    }

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await handleProcessFiles(files, type, rowIndex);
    }
  };

  const handleRemoveDoc = async (rowIndex: number, type: "dokumenAwal" | "dokumenAkhir", docId: string) => {
    const currentList = Array.isArray(rows[rowIndex][type]) ? rows[rowIndex][type] : [];
    const updated = currentList.filter((d: UploadedDocItem) => d.id !== docId);
    handleFieldChange(rowIndex, type, updated);
    if (docId && !docId.startsWith("doc-") && !docId.startsWith("data:")) {
      try {
        await documentRepository.deleteDocument(docId);
      } catch (err) {
        console.warn("[FinanceAddPage] Server document delete non-fatal error:", err);
      }
    }
    toast.success("Berkas dokumen dihapus dari daftar");
  };

  const handleUpdateDocName = (
    rowIndex: number,
    type: "dokumenAwal" | "dokumenAkhir",
    docId: string,
    newName: string
  ) => {
    const currentList = Array.isArray(rows[rowIndex][type]) ? rows[rowIndex][type] : [];
    const updated = currentList.map((d: UploadedDocItem) => {
      if (d.id === docId) {
        return {
          ...d,
          name: newName,
          customName: newName,
          kategori: newName,
        };
      }
      return d;
    });
    handleFieldChange(rowIndex, type, updated);
  };

  const handleDownloadDoc = (doc: UploadedDocItem) => {
    const url = doc.downloadUrl || doc.fileUrl;
    if (!url) {
      toast.error("Tautan berkas tidak tersedia.");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const executeActualSubmit = () => {
    setIsSaveConfirmOpen(false);

    // Format all date fields and compile structured addresses
    const formattedRows = rows.map((row, idx) => {
      const formatted = { ...row };

      // Apply custom bank/method if 'Lainnya' was selected
      if (formatted["Bank Uang Masuk"] === "Lainnya" && customBankMasuk[idx]) {
        formatted["Bank Uang Masuk"] = customBankMasuk[idx].trim();
      }
      if (formatted["Metode Pembayaran Masuk"] === "Lainnya" && customMetodeMasuk[idx]) {
        formatted["Metode Pembayaran Masuk"] = customMetodeMasuk[idx].trim();
      }
      if (formatted["Bank Uang Keluar"] === "Lainnya" && customBankKeluar[idx]) {
        formatted["Bank Uang Keluar"] = customBankKeluar[idx].trim();
      }
      if (formatted["Metode Pembayaran Keluar"] === "Lainnya" && customMetodeKeluar[idx]) {
        formatted["Metode Pembayaran Keluar"] = customMetodeKeluar[idx].trim();
      }

      // Format date fields
      if (formatted["Tanggal Masuk Berkas"]) {
        formatted["Tanggal Masuk Berkas"] = formatDateDDMMYYYY(formatted["Tanggal Masuk Berkas"]);
      }
      if (formatted["Tanggal Uang Masuk"]) {
        formatted["Tanggal Uang Masuk"] = formatDateDDMMYYYY(formatted["Tanggal Uang Masuk"]);
      }
      if (formatted["Tanggal Uang Keluar"]) {
        formatted["Tanggal Uang Keluar"] = formatDateDDMMYYYY(formatted["Tanggal Uang Keluar"]);
      }

      // Compile structured address and ensure backward compatibility
      const detail = (formatted["Detail Alamat"] || "").trim();
      const nomor = (formatted["Nomor Rumah"] || "").trim();
      const rtRw = (formatted["RT/RW"] || "").trim();
      const kelurahan = (formatted["Kelurahan/Desa"] || "").trim();
      const kecamatan = (formatted["Kecamatan"] || "").trim();
      const kota = (formatted["Kota/Kabupaten"] || "").trim();
      const provinsi = (formatted["Provinsi"] || "").trim();
      const fullAlamat = [
        detail,
        nomor ? `No. ${nomor}` : "",
        rtRw ? `RT/RW ${rtRw}` : "",
        kelurahan ? `Kel. ${kelurahan}` : "",
        kecamatan ? `Kec. ${kecamatan}` : "",
        kota,
        provinsi,
      ]
        .filter(Boolean)
        .join(", ");

      formatted["Alamat"] = fullAlamat || formatted["Alamat"] || "";
      formatted.detailAlamat = detail;
      formatted.kota = kota;
      formatted.kecamatan = kecamatan;
      formatted.kelurahan = kelurahan;
      formatted.rtRw = rtRw;
      formatted.nomorRumah = nomor;
      formatted.provinsi = provinsi;
      formatted.patokan = (formatted["Patokan"] || "").trim();
      formatted.linkLokasi = (formatted["Link Lokasi"] || "").trim();

      formatted.alamatPenjemputan = {
        detail,
        kota,
        kecamatan,
        kelurahan,
        rtRw,
        nomor,
        landmark: (formatted["Patokan"] || "").trim(),
        mapsUrl: (formatted["Link Lokasi"] || "").trim(),
        provinsi,
      };
      formatted.alamatPengantaran = { ...formatted.alamatPenjemputan };

      // Ensure Samsat sync
      if (formatted["Samsat Asal"]) {
        formatted["Samsat"] = formatted["Samsat Asal"];
      } else if (formatted["Samsat"]) {
        formatted["Samsat Asal"] = formatted["Samsat"];
      }

      // Ensure Biaya Jasa, Biaya Antar Jemput, and Nama Rekening/Penerima are preserved
      formatted["Biaya Jasa"] = Number(formatted["Biaya Jasa"]) || 0;
      formatted.biayaJasa = formatted["Biaya Jasa"];
      formatted["Biaya Antar Jemput"] = Number(formatted["Biaya Antar Jemput"]) || 0;
      formatted.biayaAntarJemput = formatted["Biaya Antar Jemput"];
      formatted["Biaya Lainnya"] = Number(formatted["Biaya Lainnya"]) || 0;
      formatted.biayaLainnya = formatted["Biaya Lainnya"];

      const namaPenerima = (
        formatted["Nama Penerima"] ||
        formatted.namaPenerima ||
        formatted["Nama Rekening/Penerima"] ||
        formatted["Nama Pemilik Rekening Keluar"] ||
        ""
      ).trim();
      formatted["Nama Rekening/Penerima"] = namaPenerima;
      formatted["Nama Pemilik Rekening Keluar"] = namaPenerima;
      formatted["Nama Penerima"] = namaPenerima;
      formatted.namaPenerimaKeluar = namaPenerima;
      formatted.namaPenerima = namaPenerima;

      formatted["Staf Pengirim"] = (formatted["Staf Pengirim"] || formatted.stafPengirim || "").trim();
      formatted.stafPengirim = formatted["Staf Pengirim"];

      formatted["Nomor Rekening Pengirim"] = (formatted["Nomor Rekening Pengirim"] || formatted.noRekeningPengirim || formatted["Nomor Rekening Masuk"] || "").trim();
      formatted.noRekeningPengirim = formatted["Nomor Rekening Pengirim"];

      formatted["Nomor Rekening Penerima"] = (formatted["Nomor Rekening Penerima"] || formatted.noRekeningPenerima || "").trim();
      formatted.noRekeningPenerima = formatted["Nomor Rekening Penerima"];

      // Ensure No Invoice matches orderNo or is generated properly
      if (!formatted["No Invoice"]) {
        const ordNum = formatted["Nomor Order"];
        if (ordNum && ordNum.startsWith("ORD-")) {
          formatted["No Invoice"] = ordNum.replace(/^ORD-/, "INV-");
        } else {
          const allOrders = orderRepository.getAllFlat?.() || [];
          const generated = generateNextOrderAndInvoiceNo(formatted["Tanggal Masuk Berkas"], allOrders);
          formatted["No Invoice"] = generated.invoiceNo;
        }
      }

      // Canonical column synchronization
      formatted["Nomor Tanda Terima"] = formatted["Nomor Tanda Terima"] || formatted["Tanda Terima"] || "";
      formatted["Tanda Terima"] = formatted["Tanda Terima"] || formatted["Nomor Tanda Terima"] || "";
      formatted["Dokumen BPKB"] = formatted["Dokumen BPKB"] || formatted["BPKB"] || "Ada";
      formatted["BPKB"] = formatted["Dokumen BPKB"];
      formatted["TTB BPKB"] = formatted["TTB BPKB"] || formatted["Nomor TTB BPKB"] || "";
      formatted["Nomor TTB BPKB"] = formatted["TTB BPKB"];
      formatted["Keterangan Dokumen BPKB"] = formatted["Keterangan Dokumen BPKB"] || "";
      formatted["Keterangan"] = formatted["Keterangan"] || "";
      formatted.catatanOrder = formatted["Keterangan"];
      formatted.catatan = formatted["Keterangan"];
      formatted.tanggalUangMasuk = formatted["Tanggal Uang Masuk"];
      formatted.tanggalPengeluaranSamsat = formatted["Tanggal Uang Keluar"];

      if (sameAsCustomer[idx]) {
        formatted["Nama Pemilik (STNK/BPKB)"] = formatted["Nama Customer"];
      }

      // Ensure Samsat Tujuan is preserved for mutasi services, or if user explicitly supplied destination
      const svcLower = String(formatted["Jenis Pengurusan"] || "").toLowerCase();
      const catLower = String(category || subTabName || "").toLowerCase();
      const isMutasiService =
        svcLower.includes("mutasi") ||
        catLower.includes("mutasi") ||
        formatted["Jenis Pengurusan"] === "Mutasi Asal Samsat" ||
        formatted["Jenis Pengurusan"] === "Mutasi Antar Daerah";

      if (!isMutasiService && (!formatted["Samsat Tujuan"] || formatted["Samsat Tujuan"].trim() === "" || formatted["Samsat Tujuan"] === "-")) {
        formatted["Samsat Tujuan"] = "-";
      }

      // Propagate custom names to documents
      if (Array.isArray(formatted.dokumenAwal)) {
        formatted.dokumenAwal = formatted.dokumenAwal.map((d: any) => ({
          ...d,
          name: d.customName || d.name,
          kategori: d.customName || d.kategori || "Dokumen Masuk",
        }));
      }
      if (Array.isArray(formatted.dokumenAkhir)) {
        formatted.dokumenAkhir = formatted.dokumenAkhir.map((d: any) => ({
          ...d,
          name: d.customName || d.name,
          kategori: d.customName || d.kategori || "Dokumen Keluar",
        }));
      }

      return formatted;
    });

    setCustomHeader(null);
    setNavigationGuard(null);
    onSubmit(formattedRows);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const prefix = rows.length > 1 ? `Baris ke-${i + 1}: ` : "";
      const customer = (row["Nama Customer"] || row.customer || "").trim();
      const nopol = (row["Plat No"] || row.nopol || "").trim();
      const phone = (row["Nomor HP"] || row["No HP"] || row.phone || "").trim();
      const phoneDigits = phone.replace(/[^0-9]/g, "");

      if (!customer) {
        errors.push(`${prefix}Nama Customer wajib diisi`);
      }
      if (!row["Jenis Pengurusan"] || !String(row["Jenis Pengurusan"]).trim()) {
        errors.push(`${prefix}Jenis Pengurusan wajib diisi`);
      }
      if (!nopol || nopol === "B" || nopol === "B -" || nopol.length < 3) {
        errors.push(`${prefix}Nomor Polisi wajib diisi lengkap`);
      }
      if (!phone || phoneDigits.length < 9) {
        errors.push(`${prefix}Nomor HP / WhatsApp Customer wajib diisi (minimal 9 digit angka)`);
      }
      if (row["Biaya Pokok Samsat"] === undefined || row["Biaya Pokok Samsat"] === "" || isNaN(Number(row["Biaya Pokok Samsat"]))) {
        errors.push(`${prefix}Biaya Pokok Samsat wajib diisi`);
      }
      if (row["Biaya Jasa"] === undefined || row["Biaya Jasa"] === "" || isNaN(Number(row["Biaya Jasa"]))) {
        errors.push(`${prefix}Biaya Jasa Kantor wajib diisi`);
      }

      const isCashMasuk =
        row["Metode Pembayaran Masuk"] === "Cash / Tunai" ||
        row["Metode Pembayaran Masuk"] === "Cash" ||
        row["Metode Pembayaran Masuk"] === "Tunai";

      if (!isCashMasuk && row["Bank Uang Masuk"] === "Lainnya" && !(customBankMasuk[i] || "").trim()) {
        errors.push(`${prefix}Nama bank custom untuk Penerimaan Uang belum diisi`);
      }
      if (row["Metode Pembayaran Masuk"] === "Lainnya" && !(customMetodeMasuk[i] || "").trim()) {
        errors.push(`${prefix}Nama metode pembayaran custom untuk Penerimaan Uang belum diisi`);
      }

      const isCashKeluar =
        row["Metode Pembayaran Keluar"] === "Kas Tunai" ||
        row["Metode Pembayaran Keluar"] === "Cash" ||
        row["Metode Pembayaran Keluar"] === "Tunai";

      if (!isCashKeluar && row["Bank Uang Keluar"] === "Lainnya" && !(customBankKeluar[i] || "").trim()) {
        errors.push(`${prefix}Nama bank/kas custom untuk Pengeluaran Samsat belum diisi`);
      }
      if (row["Metode Pembayaran Keluar"] === "Lainnya" && !(customMetodeKeluar[i] || "").trim()) {
        errors.push(`${prefix}Nama metode custom untuk Pengeluaran Samsat belum diisi`);
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setIsValidationAlertOpen(true);
      return;
    }

    setIsSaveConfirmOpen(true);
  };

  const currentService = useMemo(() => {
    return (
      rows[0]?.["Jenis Pengurusan"] ||
      getDefaultServiceFromCategory(category, subTabName, title) ||
      "Layanan"
    );
  }, [rows, category, subTabName, title]);

  const headerTitle = useMemo(() => {
    if (isEdit) {
      return `Edit Data Penjualan - ${currentService}`;
    }
    return `Tambah Data Penjualan - ${currentService}`;
  }, [isEdit, currentService]);

  const headerSubtitle = useMemo(() => {
    const currentOrderNo = (
      rows[0]?.["Nomor Order"] ||
      initialData?.orderNo ||
      initialData?.["Nomor Order"] ||
      ""
    ).trim() || "-";

    const currentCustomer = (
      rows[0]?.["Nama Customer"] ||
      initialData?.customer ||
      initialData?.["Nama Customer"] ||
      ""
    ).trim() || "Belum diisi";

    const currentPlate = (
      rows[0]?.["Plat No"] ||
      initialData?.nopol ||
      initialData?.platNo ||
      initialData?.["Plat No"] ||
      ""
    ).trim() || "Belum diisi";

    return `${currentOrderNo} • ${currentCustomer} • ${currentPlate}`;
  }, [rows, initialData]);

  // Synchronize dynamic title and subtitle with the global application shell header
  const prevHeaderKeyRef = useRef<string>("");
  useEffect(() => {
    const key = `${headerTitle}:::${headerSubtitle}`;
    if (prevHeaderKeyRef.current !== key) {
      prevHeaderKeyRef.current = key;
      setCustomHeader({
        title: headerTitle,
        subtitle: headerSubtitle,
        showBackButton: true,
        onBack: handleCancelClick,
        hideBreadcrumbs: true,
      });
    }
  }, [headerTitle, headerSubtitle, handleCancelClick, setCustomHeader]);

  // Unsaved changes navigation guard for sidebar & tab switching
  const prevGuardKeyRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevGuardKeyRef.current !== isFormDirty) {
      prevGuardKeyRef.current = isFormDirty;
      setNavigationGuard({
        isDirty: isFormDirty,
        onDiscard: () => {
          onBackRef.current();
        },
      });
    }
    return () => {
      prevGuardKeyRef.current = null;
      setNavigationGuard(null);
    };
  }, [isFormDirty, setNavigationGuard]);

  // Clear custom header on unmount
  useEffect(() => {
    return () => {
      setCustomHeader(null);
    };
  }, [setCustomHeader]);

  // Native browser beforeunload guard (protects against F5 reload and tab closing)
  useEffect(() => {
    if (!isFormDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isFormDirty]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      {/* Hidden Native Datalist of 514 Regency/City names */}
      <datalist id="daftar-wilayah-kota-kab">
        {WILAYAH_ADMINISTRATIF_LIST.map((w) => (
          <option key={w.kode_kabupaten_kota} value={w.nama_kabupaten_kota}>
            {w.nama_kabupaten_kota} ({w.nama_provinsi})
          </option>
        ))}
      </datalist>

      {/* Hidden File Inputs for multi-file upload */}
      <input
        ref={fileInputAwalRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.heic,.heif"
        className="hidden"
        onChange={(e) => handleFileChange(e, "dokumenAwal")}
      />
      <input
        ref={fileInputAkhirRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.heic,.heif"
        className="hidden"
        onChange={(e) => handleFileChange(e, "dokumenAkhir")}
      />

      {/* Main Dynamic Form Rows */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {rows.map((row, rowIndex) => {
          const docsAwalList: UploadedDocItem[] = Array.isArray(row.dokumenAwal) ? row.dokumenAwal : [];
          const docsAkhirList: UploadedDocItem[] = Array.isArray(row.dokumenAkhir) ? row.dokumenAkhir : [];

          return (
            <div key={rowIndex} className="space-y-5">
              {rows.length > 1 && (
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                      {rowIndex + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">
                      Data Transaksi #{rowIndex + 1}
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRow(rowIndex)}
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Hapus baris #{rowIndex + 1}
                  </Button>
                </div>
              )}

              {/* UNIVERSAL 7-CARD FORM LAYOUT FOR ALL 7 CANONICAL SERVICES */}
              <div className="space-y-5">
                {/* CARD 1: Informasi Berkas & Order */}
                <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs rounded-xl space-y-4">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                        1. Informasi Berkas & Order
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                    {/* 1. Tanggal Masuk Berkas */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground/90">
                        Tanggal Masuk Berkas <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        className="w-full bg-input-background border-border h-9 text-xs"
                        value={row["Tanggal Masuk Berkas"] || ""}
                        onChange={(e) => handleFieldChange(rowIndex, "Tanggal Masuk Berkas", e.target.value)}
                      />
                    </div>

                    {/* 2. Nomor Order (Readonly) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                        <span>Nomor Order</span>
                        <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 font-mono">
                          Kanonis
                        </Badge>
                      </Label>
                      <Input
                        type="text"
                        disabled
                        readOnly
                        className="w-full bg-muted/40 text-muted-foreground border-border h-9 text-xs cursor-not-allowed select-none font-mono"
                        value={row["Nomor Order"] || "(Dibuat otomatis oleh sistem saat simpan)"}
                      />
                    </div>

                    {/* 3. Jenis Pengurusan */}
                    {category === "lainnya" || subTabName === "lainnya" ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                          <span>Jenis Pengurusan <span className="text-destructive">*</span></span>
                          <Badge variant="outline" className="text-[10px] h-4 py-0 px-1.5 font-normal text-primary bg-primary/10 border-primary/20">
                            Teks Bebas
                          </Badge>
                        </Label>
                        <Input
                          type="text"
                          placeholder="Contoh: Blokir STNK, Ganti Warna, Ubah Bentuk, dll"
                          className="w-full bg-input-background border-border h-9 text-xs"
                          value={row["Jenis Pengurusan"] || ""}
                          onChange={(e) => handleFieldChange(rowIndex, "Jenis Pengurusan", e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                          <span>Jenis Pengurusan <span className="text-destructive">*</span></span>
                          <Badge variant="outline" className="text-[10px] h-4 py-0 px-1.5 font-normal text-muted-foreground bg-muted/30 border-border gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            Terkunci sesuai tab layanan
                          </Badge>
                        </Label>
                        <Input
                          type="text"
                          disabled
                          readOnly
                          className="w-full bg-muted/40 text-foreground font-semibold border-border h-9 text-xs cursor-not-allowed select-none"
                          value={row["Jenis Pengurusan"] || getDefaultServiceFromCategory(category, subTabName, title)}
                        />
                      </div>
                    )}

                    {/* 4. Status Pengerjaan */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground/90">
                        Status Pengerjaan <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={row["Status Pengerjaan"] || "Dalam Proses"}
                        onValueChange={(val) => handleFieldChange(rowIndex, "Status Pengerjaan", val)}
                      >
                        <SelectTrigger className="w-full bg-input-background border-border h-9 text-xs">
                          <SelectValue placeholder="Pilih status pengerjaan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dalam Proses" className="text-xs">
                            Dalam Proses
                          </SelectItem>
                          <SelectItem value="Pending" className="text-xs">
                            Pending
                          </SelectItem>
                          <SelectItem value="Menunggu Arsip" className="text-xs">
                            Menunggu Arsip
                          </SelectItem>
                          <SelectItem value="Selesai" className="text-xs">
                            Selesai
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>

                {/* CARD 2: Data Kendaraan & Pemilik STNK */}
                <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs rounded-xl space-y-4">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Car className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                        2. Data Kendaraan & Pemilik STNK
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Row 1: Nama Customer & Nama Pemilik (STNK/BPKB) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/90">
                          Nama Customer <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="text"
                          placeholder="Contoh: Bpk. Bambang Wijaya"
                          className="w-full bg-input-background border-border h-9 text-xs"
                          value={row["Nama Customer"] || ""}
                          onChange={(e) => handleFieldChange(rowIndex, "Nama Customer", e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-foreground/90">
                            Nama Pemilik (STNK/BPKB)
                          </Label>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              id={`same-as-customer-${rowIndex}`}
                              checked={!!sameAsCustomer[rowIndex]}
                              onChange={(e) => handleToggleSameAsCustomer(rowIndex, e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/25 cursor-pointer accent-primary"
                            />
                            <span className="text-[11px] text-muted-foreground">
                              Nama Pemilik sama dengan Customer
                            </span>
                          </label>
                        </div>
                        <Input
                          type="text"
                          disabled={sameAsCustomer[rowIndex]}
                          placeholder={sameAsCustomer[rowIndex] ? "Sama dengan nama customer" : "Nama pemilik yang tertera di STNK..."}
                          className={cn(
                            "w-full bg-input-background border-border h-9 text-xs",
                            sameAsCustomer[rowIndex] && "bg-muted/40 cursor-not-allowed opacity-80"
                          )}
                          value={row["Nama Pemilik (STNK/BPKB)"] || ""}
                          onChange={(e) => handleFieldChange(rowIndex, "Nama Pemilik (STNK/BPKB)", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Row 2: Nomor HP / WhatsApp Aktif */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground/90">
                        Nomor HP / WhatsApp Aktif <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="tel"
                        placeholder="Contoh: 081289123456 (minimal 9 digit angka)"
                        className="w-full bg-input-background border-border h-9 text-xs"
                        value={row["Nomor HP"] || row["No HP"] || ""}
                        onChange={(e) => {
                          handleFieldChange(rowIndex, "Nomor HP", e.target.value);
                          handleFieldChange(rowIndex, "No HP", e.target.value);
                        }}
                      />
                    </div>

                    {/* Row 3: R4 / R2, Plat Nomor, Status Kepemilikan */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/90">
                          R4 / R2 <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={row["R4 / R2"] || "R4"}
                          onValueChange={(val) => handleFieldChange(rowIndex, "R4 / R2", val)}
                        >
                          <SelectTrigger className="w-full bg-input-background border-border h-9 text-xs">
                            <SelectValue placeholder="Pilih R4 atau R2" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="R4" className="text-xs">
                              R4 (Mobil)
                            </SelectItem>
                            <SelectItem value="R2" className="text-xs">
                              R2 (Motor)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/90">
                          Plat Nomor (Nopol) <span className="text-destructive">*</span>
                        </Label>
                        <PlateNumberInput
                          value={row["Plat No"] || ""}
                          onChange={(formatted) => handleFieldChange(rowIndex, "Plat No", formatted)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground/90">
                          Status Kepemilikan <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={row["Status Kepemilikan"] || "Pribadi"}
                          onValueChange={(val) => handleFieldChange(rowIndex, "Status Kepemilikan", val)}
                        >
                          <SelectTrigger className="w-full bg-input-background border-border h-9 text-xs">
                            <SelectValue placeholder="Pilih status kepemilikan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pribadi" className="text-xs">
                              Pribadi
                            </SelectItem>
                            <SelectItem value="Perusahaan" className="text-xs">
                              Perusahaan / PT
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Address Toggle Checkbox */}
                    <div className="pt-2 border-t border-border/60">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          id={`has-address-${rowIndex}`}
                          checked={!!hasAddress[rowIndex]}
                          onChange={(e) => setHasAddress((p) => ({ ...p, [rowIndex]: e.target.checked }))}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/25 cursor-pointer accent-primary"
                        />
                        <span className="text-xs font-semibold text-foreground">
                          Lengkapi Alamat Domisili Klien
                        </span>
                      </label>
                    </div>

                    {/* Structured Address Card (Conditional on hasAddress) */}
                    {hasAddress[rowIndex] && (
                      <div className="p-3.5 rounded-lg border border-border/70 bg-card space-y-3">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-border/50 text-xs font-semibold text-foreground">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                          <span>Alamat Lengkap Pemilik / Penjemputan Berkas (Terstruktur)</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground/80">Provinsi</Label>
                            <Input
                              type="text"
                              placeholder="Contoh: DKI Jakarta"
                              className="w-full bg-input-background border-border h-8.5 text-xs"
                              value={row["Provinsi"] || ""}
                              onChange={(e) => handleAddressChange(rowIndex, "Provinsi", e.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground/80">Kota / Kabupaten</Label>
                            <Input
                              type="text"
                              list="daftar-wilayah-kota-kab"
                              placeholder="Pilih atau ketik kota..."
                              className="w-full bg-input-background border-border h-8.5 text-xs"
                              value={row["Kota/Kabupaten"] || ""}
                              onChange={(e) => handleAddressChange(rowIndex, "Kota/Kabupaten", e.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground/80">Kecamatan</Label>
                            <Input
                              type="text"
                              placeholder="Contoh: Jatinegara"
                              className="w-full bg-input-background border-border h-8.5 text-xs"
                              value={row["Kecamatan"] || ""}
                              onChange={(e) => handleAddressChange(rowIndex, "Kecamatan", e.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground/80">Kelurahan / Desa</Label>
                            <Input
                              type="text"
                              placeholder="Contoh: Bidara Cina"
                              className="w-full bg-input-background border-border h-8.5 text-xs"
                              value={row["Kelurahan/Desa"] || ""}
                              onChange={(e) => handleAddressChange(rowIndex, "Kelurahan/Desa", e.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground/80">RT / RW</Label>
                            <Input
                              type="text"
                              placeholder="005/012"
                              className="w-full bg-input-background border-border h-8.5 text-xs"
                              value={row["RT/RW"] || ""}
                              onChange={(e) => handleAddressChange(rowIndex, "RT/RW", e.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground/80">Nomor Rumah</Label>
                            <Input
                              type="text"
                              placeholder="No. 45B"
                              className="w-full bg-input-background border-border h-8.5 text-xs"
                              value={row["Nomor Rumah"] || ""}
                              onChange={(e) => handleAddressChange(rowIndex, "Nomor Rumah", e.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground/80">Patokan Lokasi</Label>
                            <Input
                              type="text"
                              placeholder="Sebelah Alfamart / Pagar Hitam"
                              className="w-full bg-input-background border-border h-8.5 text-xs"
                              value={row["Patokan"] || ""}
                              onChange={(e) => handleAddressChange(rowIndex, "Patokan", e.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-foreground/80">Link Google Maps</Label>
                            <Input
                              type="text"
                              placeholder="https://maps.app.goo.gl/..."
                              className="w-full bg-input-background border-border h-8.5 text-xs"
                              value={row["Link Lokasi"] || ""}
                              onChange={(e) => handleAddressChange(rowIndex, "Link Lokasi", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-foreground/80">Detail Alamat / Nama Jalan</Label>
                          <Input
                            type="text"
                            placeholder="Jl. Otista Raya Blok C No. 12..."
                            className="w-full bg-input-background border-border h-8.5 text-xs"
                            value={row["Detail Alamat"] || ""}
                            onChange={(e) => handleAddressChange(rowIndex, "Detail Alamat", e.target.value)}
                          />
                        </div>

                        {row["Alamat"] && (
                          <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
                            <span className="font-semibold text-foreground/80">Kompilasi Alamat: </span>
                            <span>{row["Alamat"]}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {/* CARD 3: Wilayah & Kantor Samsat */}
                <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs rounded-xl space-y-4">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                        3. Wilayah & Kantor Samsat
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground/90">
                        Samsat Asal <span className="text-destructive">*</span>
                      </Label>
                      <SearchableSamsatSelect
                        value={row["Samsat Asal"] || row["Samsat"] || ""}
                        onValueChange={(val) => {
                          handleFieldChange(rowIndex, "Samsat Asal", val);
                          handleFieldChange(rowIndex, "Samsat", val);
                        }}
                        placeholder="Pilih wilayah Samsat asal..."
                      />
                    </div>

                    {(() => {
                      const isMutasi =
                        row["Jenis Pengurusan"] === "Mutasi Asal Samsat" ||
                        row["Jenis Pengurusan"] === "Mutasi Antar Daerah";
                      return (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
                            <span>Samsat Tujuan</span>
                            {!isMutasi && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal text-muted-foreground bg-muted/30">
                                Non-Mutasi
                              </Badge>
                            )}
                          </Label>
                          <SearchableSamsatSelect
                            value={isMutasi ? (row["Samsat Tujuan"] || "") : "-"}
                            onValueChange={(val) => handleFieldChange(rowIndex, "Samsat Tujuan", val)}
                            placeholder="Pilih wilayah Samsat tujuan mutasi..."
                            disabled={!isMutasi}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </Card>

                {/* CARD 4: Rincian Keuangan, Biaya & Profit */}
                <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs rounded-xl space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                          4. Rincian Keuangan, Biaya & Profit
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Pencatatan kas masuk konsumen, biaya riil loket samsat, tarif jasa kantor, dan kalkulasi margin laba
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Kalkulasi Otomatis
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    {/* Sub-Card 1: Kas Masuk dari Konsumen */}
                    <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                      <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                          Penerimaan Uang (Kas Masuk Konsumen)
                        </span>
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          Kas Masuk
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Tanggal Uang Masuk <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="date"
                            className="w-full bg-input-background border-border h-8.5 text-xs"
                            value={row["Tanggal Uang Masuk"] || ""}
                            onChange={(e) => handleFieldChange(rowIndex, "Tanggal Uang Masuk", e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Uang Masuk dari Konsumen (Rp) <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            className="w-full bg-input-background border-border h-8.5 text-xs font-mono font-medium"
                            value={row["Uang Masuk dari Konsumen"] || ""}
                            onChange={(e) => handleFieldChange(rowIndex, "Uang Masuk dari Konsumen", e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Skema Pembayaran
                          </Label>
                          <Select
                            value={row["Skema Pembayaran"] || "Bayar di Awal"}
                            onValueChange={(val) => handleFieldChange(rowIndex, "Skema Pembayaran", val)}
                          >
                            <SelectTrigger className="w-full bg-input-background border-border h-8.5 text-xs">
                              <SelectValue placeholder="Pilih skema bayar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Bayar di Awal" className="text-xs">
                                Bayar di Awal (DP / Lunas Awal)
                              </SelectItem>
                              <SelectItem value="Bayar di Akhir" className="text-xs">
                                Bayar di Akhir (Pelunasan saat Selesai)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Metode Pembayaran Masuk
                          </Label>
                          <Select
                            value={row["Metode Pembayaran Masuk"] || "Transfer Bank"}
                            onValueChange={(val) => handleFieldChange(rowIndex, "Metode Pembayaran Masuk", val)}
                          >
                            <SelectTrigger className="w-full bg-input-background border-border h-8.5 text-xs">
                              <SelectValue placeholder="Pilih metode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Transfer Bank" className="text-xs">Transfer Bank</SelectItem>
                              <SelectItem value="Cash / Tunai" className="text-xs">Cash / Tunai</SelectItem>
                              <SelectItem value="QRIS" className="text-xs">QRIS</SelectItem>
                              <SelectItem value="Lainnya" className="text-xs">Lainnya (Custom)</SelectItem>
                            </SelectContent>
                          </Select>
                          {row["Metode Pembayaran Masuk"] === "Lainnya" && (
                            <Input
                              type="text"
                              placeholder="Nama metode masuk custom..."
                              className="w-full bg-input-background border-border h-7 text-xs mt-1"
                              value={customMetodeMasuk[rowIndex] || ""}
                              onChange={(e) =>
                                setCustomMetodeMasuk((p) => ({ ...p, [rowIndex]: e.target.value }))
                              }
                            />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Bank / Saluran Uang Masuk
                          </Label>
                          {row["Metode Pembayaran Masuk"] === "Cash / Tunai" || row["Metode Pembayaran Masuk"] === "Cash" || row["Metode Pembayaran Masuk"] === "Tunai" ? (
                            <Input
                              type="text"
                              disabled
                              readOnly
                              className="w-full bg-muted/50 text-muted-foreground border-border h-8.5 text-xs cursor-not-allowed italic"
                              value="- (Pembayaran Tunai, Bank Tidak Diperlukan)"
                            />
                          ) : (
                            <Select
                              value={row["Bank Uang Masuk"] || activeBankNames[0] || "BCA"}
                              onValueChange={(val) => handleFieldChange(rowIndex, "Bank Uang Masuk", val)}
                            >
                              <SelectTrigger className="w-full bg-input-background border-border h-8.5 text-xs">
                                <SelectValue placeholder="Pilih bank penerima" />
                              </SelectTrigger>
                              <SelectContent>
                                {bankMasukOptions.map((b) => (
                                  <SelectItem key={b} value={b} className="text-xs">
                                    {b}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {row["Bank Uang Masuk"] === "Lainnya" && (
                            <Input
                              type="text"
                              placeholder="Nama bank masuk custom..."
                              className="w-full bg-input-background border-border h-7 text-xs mt-1"
                              value={customBankMasuk[rowIndex] || ""}
                              onChange={(e) =>
                                setCustomBankMasuk((p) => ({ ...p, [rowIndex]: e.target.value }))
                              }
                            />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Nomor Rekening Pengirim / Konsumen
                          </Label>
                          <Input
                            type="text"
                            placeholder="Contoh: 1234567890 (BCA an Konsumen)"
                            className="w-full bg-input-background border-border h-8.5 text-xs font-mono"
                            value={row["Nomor Rekening Pengirim"] || row["Nomor Rekening Masuk"] || ""}
                            onChange={(e) => handleFieldChange(rowIndex, "Nomor Rekening Pengirim", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sub-Card 2: Pengeluaran Pokok Samsat (Kas Keluar) */}
                    <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20">
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-amber-600" />
                          Pengeluaran Pokok Loket Samsat (Kas Keluar)
                        </span>
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                          Kas Keluar
                        </Badge>
                      </div>

                      {/* Row 1: 3 Columns (Tanggal, Biaya Pokok Samsat, Nama Penerima) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Tanggal Uang Keluar <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="date"
                            className="w-full bg-input-background border-border h-8.5 text-xs"
                            value={row["Tanggal Uang Keluar"] || ""}
                            onChange={(e) => handleFieldChange(rowIndex, "Tanggal Uang Keluar", e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Biaya Pokok Samsat (Rp) <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            className="w-full bg-input-background border-border h-8.5 text-xs font-mono font-medium"
                            value={row["Biaya Pokok Samsat"] || ""}
                            onChange={(e) => handleFieldChange(rowIndex, "Biaya Pokok Samsat", e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Nama Penerima
                          </Label>
                          <Input
                            type="text"
                            placeholder="Petugas Loket Samsat"
                            className="w-full bg-input-background border-border h-8.5 text-xs"
                            value={row["Nama Penerima"] || row["Nama Rekening/Penerima"] || ""}
                            onChange={(e) => handleFieldChange(rowIndex, "Nama Penerima", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Row 2: 3 Columns (Metode Pembayaran Keluar, Bank Sumber, Nomor Rekening Penerima) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Metode Pembayaran Keluar
                          </Label>
                          <Select
                            value={row["Metode Pembayaran Keluar"] || "Kas Tunai"}
                            onValueChange={(val) => handleFieldChange(rowIndex, "Metode Pembayaran Keluar", val)}
                          >
                            <SelectTrigger className="w-full bg-input-background border-border h-8.5 text-xs">
                              <SelectValue placeholder="Pilih metode kas keluar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Kas Tunai" className="text-xs">Kas Tunai</SelectItem>
                              <SelectItem value="Transfer Bank" className="text-xs">Transfer Bank</SelectItem>
                              <SelectItem value="Kas Kantor" className="text-xs">Kas Kantor</SelectItem>
                              <SelectItem value="Kas Messenger" className="text-xs">Kas Messenger</SelectItem>
                              <SelectItem value="QRIS" className="text-xs">QRIS</SelectItem>
                              <SelectItem value="Lainnya" className="text-xs">Lainnya (Custom)</SelectItem>
                            </SelectContent>
                          </Select>
                          {row["Metode Pembayaran Keluar"] === "Lainnya" && (
                            <Input
                              type="text"
                              placeholder="Nama metode keluar custom..."
                              className="w-full bg-input-background border-border h-7 text-xs mt-1"
                              value={customMetodeKeluar[rowIndex] || ""}
                              onChange={(e) =>
                                setCustomMetodeKeluar((p) => ({ ...p, [rowIndex]: e.target.value }))
                              }
                            />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Bank / Sumber Kas Keluar
                          </Label>
                          {row["Metode Pembayaran Keluar"] === "Kas Tunai" || row["Metode Pembayaran Keluar"] === "Cash" || row["Metode Pembayaran Keluar"] === "Tunai" ? (
                            <Input
                              type="text"
                              disabled
                              readOnly
                              className="w-full bg-muted/50 text-muted-foreground border-border h-8.5 text-xs cursor-not-allowed italic"
                              value="- (Kas Tunai, Bank Tidak Diperlukan)"
                            />
                          ) : (
                            <Select
                              value={row["Bank Uang Keluar"] || activeBankNames[0] || "BCA"}
                              onValueChange={(val) => handleFieldChange(rowIndex, "Bank Uang Keluar", val)}
                            >
                              <SelectTrigger className="w-full bg-input-background border-border h-8.5 text-xs">
                                <SelectValue placeholder="Pilih sumber kas keluar" />
                              </SelectTrigger>
                              <SelectContent>
                                {bankKeluarOptions.map((b) => (
                                  <SelectItem key={b} value={b} className="text-xs">
                                    {b}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {row["Bank Uang Keluar"] === "Lainnya" && (
                            <Input
                              type="text"
                              placeholder="Nama bank/kas keluar custom..."
                              className="w-full bg-input-background border-border h-7 text-xs mt-1"
                              value={customBankKeluar[rowIndex] || ""}
                              onChange={(e) =>
                                setCustomBankKeluar((p) => ({ ...p, [rowIndex]: e.target.value }))
                              }
                            />
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Nomor Rekening Penerima / Loket
                          </Label>
                          <Input
                            type="text"
                            placeholder="Nomor rekening penerima / loket"
                            className="w-full bg-input-background border-border h-8.5 text-xs font-mono"
                            value={row["Nomor Rekening Penerima"] || ""}
                            onChange={(e) => handleFieldChange(rowIndex, "Nomor Rekening Penerima", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sub-Card 3: Komponen Tarif Biaya Kantor (Dedicated Separate Card) */}
                    <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 space-y-3.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-primary/20">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-primary" />
                          Komponen Tarif Biaya Kantor
                        </span>
                        {(() => {
                          const currentSrv = row["Jenis Pengurusan"];
                          const currentSamsat = row["Samsat Asal"] || row["Samsat"];
                          const pricing = lookupBiayaLayanan(currentSrv, currentSamsat);
                          return pricing ? (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                              Master Biaya Layanan
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                              Manual
                            </Badge>
                          );
                        })()}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Biaya Jasa Kantor (Rp) <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            className="w-full bg-background border-border h-8.5 text-xs font-mono font-semibold"
                            value={row["Biaya Jasa"] !== undefined ? row["Biaya Jasa"] : ""}
                            onChange={(e) => handleFieldChange(rowIndex, "Biaya Jasa", e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Biaya Antar Jemput
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            className="w-full bg-background border-border h-8.5 text-xs font-mono"
                            value={row["Biaya Antar Jemput"] !== undefined ? row["Biaya Antar Jemput"] : 0}
                            onChange={(e) => handleFieldChange(rowIndex, "Biaya Antar Jemput", e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-foreground/90">
                            Biaya Lainnya
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            className="w-full bg-background border-border h-8.5 text-xs font-mono"
                            value={row["Biaya Lainnya"] !== undefined ? row["Biaya Lainnya"] : 0}
                            onChange={(e) => handleFieldChange(rowIndex, "Biaya Lainnya", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sub-Card 4: Live Metric Cards (Strictly 6 Cards: 4 Top, 2 Bottom) */}
                    <div className="space-y-3">
                      {/* Top Row: 4 Metric Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 1. Total Uang Masuk */}
                        <div className="p-3 rounded-lg border border-border bg-card shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Total Uang Masuk</span>
                            <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              Masuk
                            </Badge>
                          </div>
                          <div className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 py-0.5">
                            {formatRupiah(Number(row["Uang Masuk dari Konsumen"]) || 0)}
                          </div>
                        </div>

                        {/* 2. Total Tagihan */}
                        <div className="p-3 rounded-lg border border-border bg-card shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Total Tagihan</span>
                            <Badge variant="outline" className="text-[9px] h-4">Tagihan</Badge>
                          </div>
                          <div className="text-sm sm:text-base font-bold font-mono text-foreground py-0.5">
                            {formatRupiah(Number(row["Total Tagihan Konsumen"]) || 0)}
                          </div>
                        </div>

                        {/* 3. Sisa Tagihan */}
                        <div className="p-3 rounded-lg border border-border bg-card shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Sisa Tagihan</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] h-4",
                                (Number(row["Sisa Tagihan"]) || 0) > 0
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              )}
                            >
                              {(Number(row["Sisa Tagihan"]) || 0) > 0 ? "Kurang Bayar" : "Lunas"}
                            </Badge>
                          </div>
                          <div className="text-sm sm:text-base font-bold font-mono text-foreground py-0.5">
                            {formatRupiah(Number(row["Sisa Tagihan"]) || 0)}
                          </div>
                        </div>

                        {/* 4. Kelebihan Bayar */}
                        <div className="p-3 rounded-lg border border-border bg-card shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Kelebihan Bayar</span>
                            <Badge variant="outline" className="text-[9px] h-4 bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                              {(Number(row["Jumlah Cashback"]) || 0) > 0 ? "Cashback" : "Nol"}
                            </Badge>
                          </div>
                          <div className="text-sm sm:text-base font-bold font-mono text-indigo-600 dark:text-indigo-400 py-0.5">
                            {formatRupiah(Number(row["Jumlah Cashback"]) || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: 2 Major Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 5. Status Pembayaran */}
                        <div className="p-3 rounded-lg border border-border bg-card shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Status Pembayaran</span>
                            <Badge variant="outline" className="text-[9px] h-4">Otomatis</Badge>
                          </div>
                          <div className="py-0.5">
                            {(() => {
                              const status = row["Status Pembayaran"] || "Belum Bayar";
                              let colorClasses = "bg-muted/40 text-muted-foreground border-border";
                              if (status === "Lunas") {
                                colorClasses = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
                              } else if (status === "Kurang Bayar") {
                                colorClasses = "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
                              } else if (status === "Kelebihan Bayar") {
                                colorClasses = "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
                              } else if (status === "Belum Bayar") {
                                colorClasses = "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30";
                              }

                              return (
                                <div
                                  className={cn(
                                    "h-7 px-2.5 rounded-md border flex items-center gap-1.5 text-xs font-semibold select-none",
                                    colorClasses
                                  )}
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                  <span>{status}</span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* 6. Estimasi Profit */}
                        {Number(row["Profit"]) > 0 && (
                          <div className="p-3 rounded-lg border border-border bg-card shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Estimasi Profit</span>
                              <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/25">
                                Profit Margin
                              </Badge>
                            </div>
                            <div className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 py-0.5">
                              {formatRupiah(Number(row["Profit"]) || 0)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* CARD 5: Faktur, Dokumen Fisik BPKB & TTB */}
                <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs rounded-xl space-y-4">
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-border/60">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                        5. Faktur, Dokumen Fisik BPKB & TTB
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {/* No Invoice */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground/90">
                        No Invoice (Otomatis dari Sistem / Dapat Disesuaikan)
                      </Label>
                      <Input
                        type="text"
                        placeholder="Contoh: INV-1026-001"
                        className="w-full bg-input-background border-border h-9 text-xs font-mono"
                        value={row["No Invoice"] || ""}
                        onChange={(e) => handleFieldChange(rowIndex, "No Invoice", e.target.value)}
                      />
                    </div>

                    {/* Dokumen BPKB */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground/90">
                        Dokumen BPKB (Fisik)
                      </Label>
                      <Select
                        value={row["Dokumen BPKB"] || row["BPKB"] || "Ada"}
                        onValueChange={(val) => handleFieldChange(rowIndex, "Dokumen BPKB", val)}
                      >
                        <SelectTrigger className="w-full bg-input-background border-border h-9 text-xs">
                          <SelectValue placeholder="Pilih status fisik BPKB" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ada" className="text-xs">Ada (Fisik Berkas Diterima)</SelectItem>
                          <SelectItem value="Tidak Ada" className="text-xs">Tidak Ada / Tanpa BPKB</SelectItem>
                          <SelectItem value="Di Konsumen" className="text-xs">Di Konsumen</SelectItem>
                          <SelectItem value="Di Samsat" className="text-xs">Di Samsat</SelectItem>
                          <SelectItem value="Di Leasing" className="text-xs">Di Leasing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Nomor TTB BPKB */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground/90">
                        Nomor TTB BPKB
                      </Label>
                      <Input
                        type="text"
                        placeholder="Contoh: TTB-BPKB-001"
                        className="w-full bg-input-background border-border h-9 text-xs font-mono"
                        value={row["Nomor TTB BPKB"] || row["TTB BPKB"] || ""}
                        onChange={(e) => handleFieldChange(rowIndex, "Nomor TTB BPKB", e.target.value)}
                      />
                    </div>

                    {/* Tanda Terima Berkas */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground/90">
                        Tanda Terima Berkas
                      </Label>
                      <Input
                        type="text"
                        placeholder="Contoh: TT-2026-001"
                        className="w-full bg-input-background border-border h-9 text-xs font-mono"
                        value={row["Tanda Terima"] || row["Nomor Tanda Terima"] || ""}
                        onChange={(e) => handleFieldChange(rowIndex, "Tanda Terima", e.target.value)}
                      />
                    </div>

                    {/* Keterangan / Catatan Tambahan */}
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <Label className="text-xs font-semibold text-foreground/90">
                        Keterangan / Catatan Tambahan
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="Catatan khusus pengerjaan, janji pengurusan, atau catatan kendala Samsat..."
                        className="w-full bg-input-background border-border text-xs resize-none"
                        value={row["Keterangan"] || ""}
                        onChange={(e) => handleFieldChange(rowIndex, "Keterangan", e.target.value)}
                      />
                    </div>
                  </div>
                </Card>

                {/* CARD 6 (TERAKHIR / PALING BAWAH): Lampiran Dokumen Masuk & Dokumen Keluar */}
                <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs rounded-xl space-y-5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                          6. Lampiran Dokumen Masuk & Dokumen Keluar
                        </h4>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0">
                      {docsAwalList.length + docsAkhirList.length} Berkas Terlampir
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Panel 1: Dokumen Masuk dari Klien (INBOUND) */}
                    <div
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => handleDragEnter(e, "dokumenAwal", rowIndex)}
                      onDragLeave={(e) => handleDragLeave(e, "dokumenAwal", rowIndex)}
                      onDrop={(e) => handleDrop(e, "dokumenAwal", rowIndex)}
                      className={cn(
                        "p-4 rounded-xl border transition-all duration-200 space-y-3.5",
                        isDraggingAwal[rowIndex]
                          ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                          : "border-border bg-muted/15"
                      )}
                    >
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-xs font-semibold text-foreground">
                            Dokumen Masuk dari Klien (INBOUND)
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          {docsAwalList.length} Berkas
                        </Badge>
                      </div>

                      {/* Suggested tags */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Berkas Lazim:
                        </span>
                        {["KTP Asli / KTP Pemilik", "STNK Asli", "BPKB Asli", "Surat Kuasa", "Bukti Cek Fisik"].map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-secondary/80 text-foreground px-2 py-0.5 rounded-full border border-border/60 select-none cursor-pointer hover:bg-secondary"
                            onClick={() => {
                              if (docsAwalList.length > 0) {
                                handleUpdateDocName(rowIndex, "dokumenAwal", docsAwalList[docsAwalList.length - 1].id, tag);
                              }
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Multi-file upload dropzone area */}
                      <div
                        onClick={() => triggerUploadAwal(rowIndex)}
                        className={cn(
                          "w-full p-3.5 rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center select-none",
                          isDraggingAwal[rowIndex]
                            ? "border-primary bg-primary/15 text-primary scale-[1.01]"
                            : "border-primary/40 hover:border-primary hover:bg-primary/5 text-primary"
                        )}
                      >
                        {uploadingAwal[rowIndex] ? (
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Memproses dokumen masuk...</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-semibold">Tarik & Letakkan Berkas atau Klik untuk Memilih</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              Format: PDF, JPG, PNG, HEIC (Maksimal 5MB)
                            </span>
                          </>
                        )}
                      </div>

                      {/* List of uploaded Dokumen Masuk */}
                      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {docsAwalList.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground text-center py-4 italic">
                            Belum ada Dokumen Masuk yang diunggah.
                          </p>
                        ) : (
                          docsAwalList.map((doc) => (
                            <div
                              key={doc.id}
                              className="p-3 rounded-lg border border-border bg-card space-y-2 text-xs shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-primary shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-mono text-muted-foreground truncate max-w-[200px] text-[10px]">
                                      {doc.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                      <span>{doc.formattedSize}</span>
                                      <span>•</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Tersimpan
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setPreviewDoc({
                                        isOpen: true,
                                        title: `Preview Dokumen Masuk — ${doc.customName || doc.name}`,
                                        documentName: doc.customName || doc.name,
                                        rawUrl: doc.fileUrl,
                                        fileType: doc.mimeType?.includes("pdf") ? "pdf" : "image",
                                        documentId: doc.id,
                                      })
                                    }
                                    className="h-6 px-1.5 text-[11px] text-primary"
                                    title="Lihat Berkas"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    Lihat
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDownloadDoc(doc)}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    title="Unduh Berkas"
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveDoc(rowIndex, "dokumenAwal", doc.id)}
                                    className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                    title="Hapus Berkas"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-1 pt-1.5 border-t border-border/40">
                                <Label className="text-[10px] font-semibold text-foreground/85 flex items-center justify-between">
                                  <span>Nama / Keterangan Dokumen</span>
                                  <span className="text-[9px] text-muted-foreground font-normal">Contoh: KTP Pemilik, STNK Asli</span>
                                </Label>
                                <Input
                                  type="text"
                                  value={doc.customName !== undefined ? doc.customName : (doc.name || "")}
                                  onChange={(e) => handleUpdateDocName(rowIndex, "dokumenAwal", doc.id, e.target.value)}
                                  placeholder="Contoh: KTP Pemilik, STNK Asli, Notice 2026"
                                  className="h-7.5 text-xs bg-input-background border-border"
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Panel 2: Dokumen Keluar Hasil Jadi Samsat (OUTBOUND) */}
                    <div
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => handleDragEnter(e, "dokumenAkhir", rowIndex)}
                      onDragLeave={(e) => handleDragLeave(e, "dokumenAkhir", rowIndex)}
                      onDrop={(e) => handleDrop(e, "dokumenAkhir", rowIndex)}
                      className={cn(
                        "p-4 rounded-xl border transition-all duration-200 space-y-3.5",
                        isDraggingAkhir[rowIndex]
                          ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-400"
                          : "border-border bg-card"
                      )}
                    >
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="text-xs font-semibold text-foreground">
                            Dokumen Keluar Hasil Jadi Samsat (OUTBOUND)
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        >
                          {docsAkhirList.length} Berkas
                        </Badge>
                      </div>

                      {/* Suggested tags */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Berkas Hasil Jadi:
                        </span>
                        {["STNK Baru / Pengesahan", "Notice Pajak / SKKP", "Plat Nomor (TNKB)", "BPKB Selesai", "Faktur Samsat"].map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-secondary/80 text-foreground px-2 py-0.5 rounded-full border border-border/60 select-none cursor-pointer hover:bg-secondary"
                            onClick={() => {
                              if (docsAkhirList.length > 0) {
                                handleUpdateDocName(rowIndex, "dokumenAkhir", docsAkhirList[docsAkhirList.length - 1].id, tag);
                              }
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Multi-file upload dropzone area */}
                      <div
                        onClick={() => triggerUploadAkhir(rowIndex)}
                        className={cn(
                          "w-full p-3.5 rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center select-none",
                          isDraggingAkhir[rowIndex]
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 scale-[1.01]"
                            : "border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {uploadingAkhir[rowIndex] ? (
                          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Memproses dokumen keluar...</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-semibold">Tarik & Letakkan Berkas atau Klik untuk Memilih</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              Format: PDF, JPG, PNG, HEIC (Maksimal 5MB)
                            </span>
                          </>
                        )}
                      </div>

                      {/* List of uploaded Dokumen Keluar */}
                      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {docsAkhirList.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground text-center py-4 italic">
                            Belum ada Dokumen Keluar yang diunggah.
                          </p>
                        ) : (
                          docsAkhirList.map((doc) => (
                            <div
                              key={doc.id}
                              className="p-3 rounded-lg border border-border bg-muted/15 space-y-2 text-xs shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-mono text-muted-foreground truncate max-w-[200px] text-[10px]">
                                      {doc.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                      <span>{doc.formattedSize}</span>
                                      <span>•</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Tersimpan
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setPreviewDoc({
                                        isOpen: true,
                                        title: `Preview Dokumen Keluar — ${doc.customName || doc.name}`,
                                        documentName: doc.customName || doc.name,
                                        rawUrl: doc.fileUrl,
                                        fileType: doc.mimeType?.includes("pdf") ? "pdf" : "image",
                                        documentId: doc.id,
                                      })
                                    }
                                    className="h-6 px-1.5 text-[11px] text-emerald-600 dark:text-emerald-400"
                                    title="Lihat Berkas"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    Lihat
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDownloadDoc(doc)}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    title="Unduh Berkas"
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveDoc(rowIndex, "dokumenAkhir", doc.id)}
                                    className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                    title="Hapus Berkas"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-1 pt-1.5 border-t border-border/40">
                                <Label className="text-[10px] font-semibold text-foreground/85 flex items-center justify-between">
                                  <span>Nama / Keterangan Dokumen</span>
                                  <span className="text-[9px] text-muted-foreground font-normal">Contoh: STNK Baru, SKKP 2026</span>
                                </Label>
                                <Input
                                  type="text"
                                  value={doc.customName !== undefined ? doc.customName : (doc.name || "")}
                                  onChange={(e) => handleUpdateDocName(rowIndex, "dokumenAkhir", doc.id, e.target.value)}
                                  placeholder="Contoh: STNK Baru, SKKP 2026, TNKB Asli"
                                  className="h-7.5 text-xs bg-input-background border-border"
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          );
        })}

        {/* Add Row Button and Bottom Submit Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/70">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelClick}
              className="text-xs h-9 px-3.5 w-full sm:w-auto gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </Button>
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="border-dashed border-primary/40 text-primary hover:bg-primary/5 text-xs h-9 px-3.5 flex items-center gap-1.5 font-medium w-full sm:w-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah baris data</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="submit"
              onClick={handleSubmit}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 px-5 font-semibold shadow-xs flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEdit ? "Simpan Perubahan" : "Simpan Data Penjualan"}</span>
            </Button>
          </div>
        </div>
      </form>

      {/* Back Confirmation Guard */}
      <AlertDialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              Tinggalkan Halaman?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Perubahan yang Anda masukkan belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex items-center justify-between sm:justify-between w-full">
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 text-xs font-medium"
              onClick={() => setIsDiscardDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={handleConfirmDiscard}
            >
              Tinggalkan Halaman
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Incomplete Fields Alert Dialog */}
      <AlertDialog open={isValidationAlertOpen} onOpenChange={setIsValidationAlertOpen}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              Data Belum Lengkap
            </AlertDialogTitle>
            <div className="text-xs text-foreground/85 leading-relaxed space-y-2 pt-2">
              <p className="font-medium text-foreground">
                Mohon lengkapi kolom mandatory berikut sebelum menyimpan:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground max-h-48 overflow-y-auto">
                {validationErrors.map((err, idx) => (
                  <li key={idx} className="text-destructive/90">{err}</li>
                ))}
              </ul>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex justify-end">
            <Button
              size="sm"
              className="h-8.5 text-xs font-semibold bg-primary text-primary-foreground"
              onClick={() => setIsValidationAlertOpen(false)}
            >
              Mengerti & Lengkapi Data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={isSaveConfirmOpen} onOpenChange={setIsSaveConfirmOpen}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              Konfirmasi Simpan Transaksi
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              Data transaksi sudah lengkap. Apakah Anda yakin ingin menyimpan transaksi ini ke sistem?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex items-center justify-end sm:justify-end w-full">
            <Button
              size="sm"
              variant="outline"
              className="h-8.5 text-xs font-medium"
              onClick={() => setIsSaveConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="h-8.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={executeActualSubmit}
            >
              Ya, Simpan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={previewDoc.isOpen}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          documentName={previewDoc.documentName}
          rawUrl={previewDoc.rawUrl}
          fileType={previewDoc.fileType}
          documentId={previewDoc.documentId}
        />
      )}
    </motion.div>
  );
}
