import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge, getStatusBadgeClass } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { EmptyState } from "./ui/empty-state";
import { MutasiCostField } from "./MutasiCostFields";
import {
  Search,
  CheckCircle,
  CheckCircle2,
  Clock,
  PackageCheck,
  Truck,
  FileCheck,
  User,
  MapPin,
  Eye,
  Calculator,
  RefreshCw,
  Edit,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Upload,
  FileText,
  Phone,
  Car,
  Calendar,
  Check,
  Archive,
  ArrowRight,
  Shield,
  ShieldCheck,
  FileUp,
  ExternalLink,
  ShieldAlert,
  Plus,
  Trash2,
  CreditCard,
  File as FileIcon,
  Image as ImageIcon,
  Info,
  Receipt,
  Download,
  RotateCcw,
  Loader2,
  Banknote,
  History,
} from "lucide-react";
import { cn } from "./ui/utils";
import { toast } from "sonner";
import { documentRepository } from "../../data/repositories/documentRepository";
import { processDocumentUpload, formatFileSize } from "../utils/fileCompressor";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import {
  useOrderStore,
  orderStore,
  OperationalOrder,
  PaymentProof,
  StageName,
  StructuredAddress,
  SamsatProcessItem,
  CustomCostItem,
  getDefaultSamsatProcesses,
  STAGES,
} from "../data/orderStore";
import { APP_CONFIG } from "../config/appConfig";
import { recoverSamsatPickupKendalaAction } from "../data/messengerTaskAdapter";
import type { OrderCostBreakdownItem } from "../../domain/pricing/types";

export interface VerificationUploadedDoc {
  id: string;
  name: string;
  fileUrl: string;
  fileType: "image" | "pdf";
  fileSize?: string;
  uploadedAt: string;
  uploadedBy?: string;
}
import { financeStore } from "../data/financeStore";
import {
  hargaDasarMutasiKeluar,
  hargaDasarMutasiMasuk,
} from "../data/pricingReference";
import { permissionStore } from "../data/permissionStore";
import { useKaryawanPengguna } from "../data/karyawanPenggunaAdapter";
import { KNOWN_MESSENGERS, getMessengerTasksForEmployee } from "../data/messengerTaskAdapter";
import { generateDocumentSvgUrl, downloadDataUrl } from "../utils/documentSvgGenerator";

// 8 Workflow stages as specified
export const trackingSteps = [
  { id: 1, title: "Verifikasi", icon: CheckCircle },
  { id: 2, title: "Penjadwalan", icon: Clock },
  { id: 3, title: "Verifikasi Dokumen", icon: FileText },
  { id: 4, title: "Proses Samsat", icon: PackageCheck },
  { id: 5, title: "Verifikasi Ulang", icon: RefreshCw },
  { id: 6, title: "Supervisi", icon: FileCheck },
  { id: 7, title: "Pengantaran", icon: Truck },
  { id: 8, title: "Dokumen Telah Diterima", displayTitle: "Pengurusan Selesai", icon: CheckCircle2 },
];

const layananOptions = [
  "Perpanjangan 1 Tahun",
  "Perpanjangan 5 Tahun",
  "Balik Nama",
  "Mutasi Antar Samsat",
  "Mutasi Luar Daerah",
];
const bulanOptions = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Helper to get local date in YYYY-MM-DD
function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper to render structured address with fallback
function renderAddress(addr?: StructuredAddress, fallbackDetail?: string, fallbackDomisili?: string) {
  if (addr && (addr.detail || addr.kota || addr.kecamatan)) {
    return (
      <div className="space-y-1 text-xs">
        <p className="font-medium text-foreground">{addr.detail || fallbackDetail || "-"}</p>
        {(addr.rtRw || addr.nomor) && (
          <p className="text-[11px] text-muted-foreground">
            {addr.rtRw ? `RT/RW: ${addr.rtRw}` : ""}{addr.rtRw && addr.nomor ? " • " : ""}{addr.nomor ? `No. ${addr.nomor}` : ""}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          {[addr.kelurahan, addr.kecamatan, addr.kota].filter(Boolean).join(", ")}
        </p>
        {addr.landmark && (
          <p className="text-[11px] text-primary/90 font-medium">Patokan: {addr.landmark}</p>
        )}
        {addr.mapsUrl && (
          <a
            href={addr.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline pt-0.5"
          >
            <ExternalLink className="w-3 h-3" />
            Buka Peta Google Maps
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium text-foreground">{fallbackDetail || "Belum diisi"}</p>
      {fallbackDomisili && <p className="text-[11px] text-muted-foreground">Domisili: {fallbackDomisili}</p>}
    </div>
  );
}

interface OrderTrackingProps {
  userRole?: 'administrator' | 'finance' | 'admin' | 'messenger' | null;
  userName?: string;
  userId?: string;
}

export function OrderTracking({
  userRole = 'administrator',
  userName = 'Admin Operasional',
  userId = 'usr-admin',
}: OrderTrackingProps) {
  const { activeOrders, advanceOrder, advanceOrderAsync, rollbackOrderAsync, archiveOrder, archiveOrderAsync, updateOrder, updateOrderAsync, verifyPayment, processRefund, addRekapDocument, approveDocumentsAsync } = useOrderStore();
  const { karyawan } = useKaryawanPengguna();
  const activeMessengers = useMemo(() => {
    const active = karyawan
      .filter((k) => (k.jabatan || "").toUpperCase() === "MESSENGER" && k.status === "Aktif")
      .map((k) => ({
        id: k.id,
        nama: k.nama,
        wilayah: k.wilayah,
      }));
    if (active.length > 0) return active;
    return KNOWN_MESSENGERS.map((nama, idx) => ({
      id: `EMP-MSG-00${idx + 1}`,
      nama,
      wilayah: "Jakarta",
    }));
  }, [karyawan]);

  const messengers = useMemo(() => activeMessengers.map((m) => m.nama), [activeMessengers]);

  // Role & Permission stage action checker
  const canManage = (stageNum: number) => permissionStore.canManageStage(userRole, stageNum);
  // Order Tracking directly focuses on active workflow orders, default stage: "Verifikasi"
  const [currentTab, setCurrentTab] = useState<string>("Verifikasi");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Operational Workspaces Dialog States
  const [isVerifyWorkspaceOpen, setIsVerifyWorkspaceOpen] = useState(false);
  const [isConfirmPaymentDialogOpen, setIsConfirmPaymentDialogOpen] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentNote, setEditPaymentNote] = useState("");
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [isScheduleWorkspaceOpen, setIsScheduleWorkspaceOpen] = useState(false);
  const [isDocVerificationWorkspaceOpen, setIsDocVerificationWorkspaceOpen] = useState(false);
  const [isSamsatScheduleModalOpen, setIsSamsatScheduleModalOpen] = useState(false);
  const [isSamsatPickupModalOpen, setIsSamsatPickupModalOpen] = useState(false);
  const [isSamsatProgressDialogOpen, setIsSamsatProgressDialogOpen] = useState(false);
  const [isFinalCostDialogOpen, setIsFinalCostDialogOpen] = useState(false);
  const [isDeliveryWorkspaceOpen, setIsDeliveryWorkspaceOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isHandoverProofModalOpen, setIsHandoverProofModalOpen] = useState(false);
  const [selectedHandoverOrder, setSelectedHandoverOrder] = useState<OperationalOrder | null>(null);
  const [directHandoverData, setDirectHandoverData] = useState<{
    recipientName: string;
    relationship: string;
    notes: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: "image" | "pdf";
    fileSize?: number;
  }>({
    recipientName: "",
    relationship: "Pemilik Langsung",
    notes: "",
  });
  const [isCompressingHandover, setIsCompressingHandover] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"jadwal" | "langsung">("jadwal");

  // Preview Dialog State
  const [previewDoc, setPreviewDoc] = useState<{
    name: string;
    type: string;
    fileUrl?: string;
    fileType?: string;
    documentId?: string;
  } | null>(null);

  const handleClosePreview = () => {
    setPreviewDoc(null);
  };

  const handleOpenPreview = (
    name: string,
    type: string,
    rawUrl?: string,
    fileType?: string,
    documentId?: string
  ) => {
    setPreviewDoc({
      name,
      type,
      fileUrl: rawUrl,
      fileType,
      documentId,
    });
  };

  // Schedule form state
  const [scheduleData, setScheduleData] = useState({
    tanggalJemput: "",
    messenger: "",
    catatanPenjadwalan: "",
  });

  // Samsat schedule form state
  const [samsatScheduleData, setSamsatScheduleData] = useState({
    tanggalProsesSamsat: "",
    samsatMessenger: "",
    catatanSamsat: "",
  });

  // Samsat result pickup assignment form state
  const [samsatPickupData, setSamsatPickupData] = useState({
    samsatPickupDate: "",
    samsatPickupMessenger: "",
    samsatPickupNotes: "",
  });

  // Document verification workspace state
  const [docState, setDocState] = useState<Record<string, {
    name: string;
    status: string;
    fileUrl?: string;
    documentId?: string;
    fileType?: string;
    fileSize?: string;
  }>>({
    stnk: { name: "", status: "Belum Tersedia" },
    bpkb: { name: "", status: "Belum Tersedia" },
    ktp: { name: "", status: "Belum Tersedia" },
    skkp: { name: "", status: "Belum Tersedia" },
    lainnya: { name: "", status: "Belum Tersedia" },
  });
  const [docNotes, setDocNotes] = useState("");

  const handleDocUpload = async (key: string, label: string, file: File) => {
    try {
      const processed = await processDocumentUpload(file);
      let uploadedDocId: string | undefined;
      let finalFileUrl = processed.fileUrl;

      if (selectedOrder?.orderNo) {
        try {
          const uploaded = await documentRepository.uploadDocument(processed.file, {
            orderNo: selectedOrder.orderNo,
            documentType: label,
            metadata: {
              documentKey: key,
              phase: "BEFORE",
              category: "Dokumen Masuk",
            },
          });
          if (uploaded?.id) {
            uploadedDocId = uploaded.id;
            finalFileUrl = uploaded.fileUrl;
          }
        } catch (uploadErr) {
          console.warn("Server upload failed, using processed fileUrl:", uploadErr);
        }
      }

      const updatedItem = {
        name: processed.fileName,
        status: "Baru Diupload",
        fileUrl: finalFileUrl,
        documentId: uploadedDocId,
        fileType: processed.fileType,
        fileSize: formatFileSize(processed.fileSize),
      };

      setDocState((prev) => ({
        ...prev,
        [key]: updatedItem,
      }));

      if (selectedOrder?.orderNo) {
        const nextClientDocs = {
          ...(selectedOrder.clientDocuments || {}),
          [key]: updatedItem,
        };
        updateOrder(selectedOrder.orderNo, {
          clientDocuments: nextClientDocs,
        });
        setSelectedOrder((prev: any) => prev ? { ...prev, clientDocuments: nextClientDocs } : null);
      }

      if (processed.compressed && processed.compressionRatio) {
        toast.success(
          `${label} (${file.name}) berhasil dikompres (${formatFileSize(file.size)} ➔ ${formatFileSize(processed.fileSize)}, hemat ${processed.compressionRatio})!`
        );
      } else {
        toast.success(`${label} (${file.name}) berhasil diunggah.`);
      }
    } catch (err: any) {
      toast.error(err.message || `Gagal mengunggah ${label}`);
    }
  };

  // Final Cost form state
  const [finalCostData, setFinalCostData] = useState<Record<string, string>>({
    finalBiayaJasa: "",
    finalPkb: "",
    finalSwdkllj: "",
    finalDendaSwdkllj: "",
    finalMutasiKeluar: "",
    finalMutasiMasuk: "",
    finalBiayaLainnya: "",
    keteranganMutasiKeluar: "",
    keteranganMutasiMasuk: "",
    keteranganBiayaLainnya: "",
    mutasiKeluarLegalisir: "",
    mutasiKeluarHadir: "",
    mutasiKeluarLegalisirCf: "",
    mutasiKeluarCf: "",
    mutasiKeluarBantuanHadir: "",
    mutasiKeluarCekBlokir: "",
    mutasiKeluarLokPembukuan: "",
    mutasiKeluarLokTu: "",
    mutasiKeluarLokTuNopil: "",
    mutasiKeluarLoksus: "",
    mutasiKeluarCetakSkp: "",
    mutasiKeluarCetakFiskal: "",
    mutasiKeluarLokArsip: "",
    mutasiKeluarCekProgresif: "",
    mutasiKeluarMatiinNopil: "",
    mutasiKeluarDaftarMutmasNormal: "",
    mutasiKeluarDaftarMutmasKilat: "",
    mutasiMasukLegalisir: "",
    mutasiMasukMutmas: "",
    mutasiMasukBy: "",
    mutasiMasukPendaftaran: "",
    mutasiMasukReqGanjilGenap: "",
    mutasiMasukAcak: "",
    mutasiMasukLokTu: "",
    mutasiMasukLokPembukuan: "",
    mutasiMasukDaftarBpkb: "",
    mutasiMasukPenulisanBpkb: "",
    mutasiMasukCetakNotice: "",
    mutasiMasukCetakStnk: "",
    mutasiMasukCetakPlat: "",
  });

  const [showMutasiKeluar, setShowMutasiKeluar] = useState(false);
  const [showMutasiMasuk, setShowMutasiMasuk] = useState(false);
  const [newSamsatDocs, setNewSamsatDocs] = useState<string[]>([]);
  const [editableBreakdown, setEditableBreakdown] = useState<OrderCostBreakdownItem[]>([]);
  const [uploadedNewDocs, setUploadedNewDocs] = useState<VerificationUploadedDoc[]>([]);

  // Form Upload Dokumen Baru (Nama Dokumen + File Dokumen)
  const [isUploadNewDocModalOpen, setIsUploadNewDocModalOpen] = useState(false);
  const [newDocTargetContext, setNewDocTargetContext] = useState<"SUPERVISI" | "ARCHIVE_AFTER">("SUPERVISI");
  const [newDocName, setNewDocName] = useState("");
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [newDocError, setNewDocError] = useState("");
  const [isSubmittingNewDoc, setIsSubmittingNewDoc] = useState(false);

  const handleOpenUploadNewDocModal = (context: "SUPERVISI" | "ARCHIVE_AFTER") => {
    setNewDocTargetContext(context);
    setNewDocName("");
    setNewDocFile(null);
    setNewDocError("");
    setIsUploadNewDocModalOpen(true);
  };

  const handleSaveNewDocument = async () => {
    if (!newDocName.trim()) {
      setNewDocError("Nama dokumen wajib diisi!");
      return;
    }
    if (!newDocFile) {
      setNewDocError("File dokumen wajib dipilih!");
      return;
    }
    if (!selectedOrder) return;

    setIsSubmittingNewDoc(true);
    setNewDocError("");

    try {
      const processed = await processDocumentUpload(newDocFile);
      const isPdf = processed.fileType === "pdf";
      const uploaded = await documentRepository.uploadDocument(processed.file, {
        orderNo: selectedOrder.orderNo,
        documentType: newDocTargetContext === "ARCHIVE_AFTER" ? "REKAP_AFTER" : "DOKUMEN_PENDUKUNG",
        metadata: {
          customDocName: newDocName.trim(),
          phase: newDocTargetContext === "ARCHIVE_AFTER" ? "AFTER" : undefined,
        },
      });

      if (newDocTargetContext === "SUPERVISI") {
        const newDoc: VerificationUploadedDoc = {
          id: uploaded.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: newDocName.trim(),
          fileUrl: uploaded.fileUrl,
          fileType: isPdf ? "pdf" : "image",
          fileSize: formatFileSize(processed.fileSize),
          uploadedAt: new Date().toISOString(),
          uploadedBy: userName || "Staff",
        };
        setUploadedNewDocs((prev) => [...prev, newDoc]);
        setNewSamsatDocs((prev) => [...prev, newDocName.trim()]);
        setIsStage5DocApproved(false);
        setIsStage6DocApproved(false);
        toast.info("Dokumen baru ditambahkan. Persetujuan dokumen direset dan perlu disetujui ulang.");
      } else {
        addRekapDocument(selectedOrder.orderNo, {
          phase: "AFTER",
          documentType: (["STNK", "BPKB", "SKKP"].includes(newDocName.trim().toUpperCase()) ? newDocName.trim().toUpperCase() : "OTHER") as "STNK" | "BPKB" | "SKKP" | "OTHER",
          label: newDocName.trim(),
          fileType: isPdf ? "PDF" : "IMAGE",
          fileUrl: uploaded.fileUrl,
          uploadedBy: userName,
        });
      }

      toast.success(`Dokumen "${newDocName.trim()}" (${newDocFile.name}) berhasil diunggah.`);
      setIsUploadNewDocModalOpen(false);
      setNewDocName("");
      setNewDocFile(null);
    } catch (err: any) {
      setNewDocError(err.message || "Gagal mengunggah dokumen baru.");
      toast.error(err.message || "Gagal mengunggah dokumen baru.");
    } finally {
      setIsSubmittingNewDoc(false);
    }
  };

  // Samsat progress state
  const [samsatProgress, setSamsatProgress] = useState({
    mutasiKeluar: {
      legalisirHadir: false,
      legalisirCf: false,
      cfBantuanHadir: false,
      cekBlokir: false,
      lokPembukuan: false,
      lokTu: false,
      lokTuNopil: false,
      loksus: false,
      cetakSkp: false,
      cetakFiskal: false,
      lokArsip: false,
      cekProgresif: false,
      matiinNopil: false,
      daftarMutmasNormal: false,
      daftarMutmasKilat: false,
    },
    mutasiMasuk: {
      legalisirMutmas: false,
      byPendaftaran: false,
      reqGanjilGenap: false,
      acak: false,
      lokTu: false,
      lokPembukuan: false,
      daftarBpkb: false,
      penulisanBpkb: false,
      cetakNotice: false,
      cetakStnk: false,
      cetakPlat: false,
    }
  });

  // Delivery form state
  const [deliveryData, setDeliveryData] = useState({
    tanggalPengantaran: "",
    messenger: "",
    catatanPengantaran: "",
  });

  // Permission check for Supervisi editing (Administrator & Finance)
  const canEditVerified = userRole === 'administrator' || userRole === 'finance';

  // Filter orders by search keyword
  const currentOrders = activeOrders[currentTab as StageName] || [];
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return currentOrders;
    const term = searchTerm.toLowerCase();
    return currentOrders.filter((order: any) =>
      order.orderNo.toLowerCase().includes(term) ||
      order.customer.toLowerCase().includes(term) ||
      order.nopol.toLowerCase().includes(term)
    );
  }, [currentOrders, searchTerm]);

  // Stage 5 & 6 Edit toggle state (Default is VIEW-ONLY as required)
  const [isEditingFinalCost, setIsEditingFinalCost] = useState(false);
  const [customCostItems, setCustomCostItems] = useState<CustomCostItem[]>([]);
  const [newCostItemName, setNewCostItemName] = useState("");
  const [newCostItemCategory, setNewCostItemCategory] = useState<"Mutasi Keluar" | "Mutasi Masuk" | "Lainnya">("Lainnya");
  const [newCostItemAmount, setNewCostItemAmount] = useState("");
  const [newCostItemBasePrice, setNewCostItemBasePrice] = useState("");
  const [finalCostAlasan, setFinalCostAlasan] = useState<string>("");
  const [isSubmittingFinalCost, setIsSubmittingFinalCost] = useState(false);

  // Document Approval States for Stage 5 & 6
  const [isStage5DocApproved, setIsStage5DocApproved] = useState(false);
  const [isStage6DocApproved, setIsStage6DocApproved] = useState(false);
  const [docApprovalDetails, setDocApprovalDetails] = useState<{
    stage5VerifiedBy?: string;
    stage5VerifiedAt?: string;
    stage5Notes?: string;
    stage6ApprovedBy?: string;
    stage6ApprovedAt?: string;
    stage6Notes?: string;
  }>({});
  const [docApprovalNoteInput, setDocApprovalNoteInput] = useState("");
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Unified Stage Advance Confirmation Modal State
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceConfirmData, setAdvanceConfirmData] = useState<{
    isOpen: boolean;
    orderNo: string;
    targetStage: string;
    summaryText: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const confirmAndAdvance = (
    orderNo: string,
    targetStage: string,
    summaryText: string,
    action: () => Promise<void> | void
  ) => {
    setAdvanceConfirmData({
      isOpen: true,
      orderNo,
      targetStage,
      summaryText,
      onConfirm: async () => {
        if (isAdvancing) return;
        setIsAdvancing(true);
        try {
          await action();
          setAdvanceConfirmData(null);
        } catch (err: any) {
          console.error("Stage transition failed:", err);
          toast.error(err?.message || "Gagal memproses tahapan order.");
        } finally {
          setIsAdvancing(false);
        }
      },
    });
  };

  // ----------------------------------------------------
  // WORKFLOW ACTION HANDLERS
  // ----------------------------------------------------

  // Stage 1: Upload Bukti Pembayaran Langsung di Loket / Stage 1
  const handleUploadStage1Proof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrder) return;
    try {
      toast.info(`Memproses bukti pembayaran ${file.name}...`);
      const processed = await processDocumentUpload(file);
      const uploaded = await documentRepository.uploadDocument(processed.file, {
        orderNo: selectedOrder.orderNo,
        documentType: "BUKTI_PEMBAYARAN",
      });
      const proof: PaymentProof = {
        fileName: processed.fileName,
        fileType: processed.fileType,
        fileUrl: uploaded.fileUrl,
        uploadedAt: new Date().toISOString(),
        fileSize: formatFileSize(processed.fileSize),
        documentId: uploaded.id,
      };
      const updatedPayment = {
        ...selectedOrder.payment,
        buktiPembayaran: proof,
      };
      updateOrder(selectedOrder.orderNo, { payment: updatedPayment });
      setSelectedOrder({
        ...selectedOrder,
        payment: updatedPayment,
      });
      toast.success(`Bukti pembayaran ${processed.fileName} berhasil diunggah.`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengunggah bukti pembayaran.");
    } finally {
      e.target.value = "";
    }
  };

  // Stage 1: Action Verifikasi & Koreksi Pembayaran Awal
  const handleSavePaymentVerificationAndCorrection = async (overrideAmount?: number, overrideNotes?: string) => {
    if (!selectedOrder) return;
    try {
      setIsVerifyingPayment(true);
      const rawInput = overrideAmount !== undefined ? String(overrideAmount) : editPaymentAmount;
      const cleanStr = rawInput.replace(/[^0-9]/g, "");
      if (!cleanStr || isNaN(Number(cleanStr))) {
        toast.error("Nominal pembayaran terkonfirmasi harus berupa angka valid!");
        return;
      }
      const confirmedNominal = Number(cleanStr);
      if (confirmedNominal < 0) {
        toast.error("Nominal pembayaran tidak boleh bernilai negatif!");
        return;
      }

      const totalBiaya = selectedOrder.payment?.totalBiaya || selectedOrder.totalEstimasi || 0;
      const sisa = Math.max(0, totalBiaya - confirmedNominal);
      const overpayment = Math.max(0, confirmedNominal - totalBiaya);
      const statusPembayaran = confirmedNominal >= totalBiaya ? "Lunas" : confirmedNominal > 0 ? "Kurang Bayar" : "Belum Bayar";
      const nowStr = new Date().toISOString();
      const notesToSave = overrideNotes !== undefined ? overrideNotes : editPaymentNote.trim();

      const prevNominal = selectedOrder.payment?.nominalPembayaranAwalTerkonfirmasi ?? selectedOrder.payment?.nominalDibayarAwal ?? selectedOrder.payment?.dibayar ?? 0;
      const existingHistory = selectedOrder.payment?.riwayatKoreksiPembayaran || [];
      const updatedHistory = [...existingHistory];
      if (prevNominal !== confirmedNominal || notesToSave) {
        updatedHistory.push({
          nominalLama: prevNominal,
          nominalBaru: confirmedNominal,
          tanggal: nowStr,
          admin: userName,
          catatan: notesToSave || (selectedOrder.payment?.isPaymentVerified ? "Koreksi nominal pembayaran" : "Konfirmasi verifikasi awal"),
        });
      }

      verifyPayment(selectedOrder.orderNo, userName, confirmedNominal, notesToSave);

      const updatedPayment = {
        ...selectedOrder.payment,
        isPaymentVerified: true,
        paymentVerifiedAt: nowStr,
        paymentVerifiedBy: userName,
        nominalPembayaranAwalTerkonfirmasi: confirmedNominal,
        statusPembayaran,
        dibayar: confirmedNominal,
        kurang: sisa,
        overpayment,
        tanggalBayar: nowStr.split("T")[0],
        riwayatKoreksiPembayaran: updatedHistory,
      };

      setSelectedOrder({
        ...selectedOrder,
        payment: updatedPayment,
      });

      setEditPaymentNote("");
      setIsEditingPayment(false);
      setIsConfirmPaymentDialogOpen(false);
      toast.success(
        `Pembayaran order ${selectedOrder.orderNo} berhasil dikonfirmasi: Rp ${confirmedNominal.toLocaleString("id-ID")} (${statusPembayaran})`
      );
    } catch (err: any) {
      toast.error(err?.message || "Gagal memverifikasi pembayaran order.");
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const handleMarkPaymentVerified = async () => {
    return handleSavePaymentVerificationAndCorrection();
  };

  // Stage 1 -> Stage 2 (Verifikasi -> Penjadwalan) atau langsung ke Stage 3 jika Datang Langsung
  const handleVerifyOrder = async () => {
    if (!selectedOrder) return;

    // Jika Bayar di Awal dan pembayaran belum terverifikasi secara tersimpan, otomatis simpan verifikasi pembayaran
    const isBayarDiAwal = selectedOrder.payment?.tipePembayaran === "Bayar di Awal";
    const isPaymentVerified = selectedOrder.payment?.isPaymentVerified;
    if (isBayarDiAwal && !isPaymentVerified) {
      await handleSavePaymentVerificationAndCorrection();
    }

    const isDatangLangsung = selectedOrder.metodeLayanan === "Datang Langsung";

    if (isDatangLangsung) {
      confirmAndAdvance(
        selectedOrder.orderNo,
        "Stage 3 – Verifikasi Dokumen Fisik",
        `Order ${selectedOrder.orderNo} menggunakan metode Datang Langsung (berkas diserahkan langsung di loket). Verifikasi awal disetujui dan order akan langsung dialihkan ke Stage 3 (Verifikasi Dokumen Fisik di Loket)?`,
        async () => {
          const nowStr = new Date().toISOString();
          const updated = await advanceOrderAsync(selectedOrder.orderNo, "Verifikasi Dokumen", {
            isVerified: true,
            verifiedBy: userName,
            verifiedAt: nowStr,
            pickupCompleted: true,
            messengerTaskStatus: "Dokumen Sudah Tersedia",
            messenger: "Datang Langsung (Loket)",
            assignedMessengerName: "Datang Langsung (Loket)",
            catatanPenjadwalan: "Klien datang langsung ke loket kantor Biro Jasa SUN89",
          });
          if (!updated) throw new Error("Gagal memajukan order ke Verifikasi Dokumen");

          setIsVerifyWorkspaceOpen(false);
          toast.success(`Order ${selectedOrder.orderNo} (Datang Langsung) berhasil diverifikasi dan langsung masuk ke Stage 3 (Verifikasi Dokumen Fisik di Loket)!`);
          setSelectedOrder(null);
          setCurrentTab("Verifikasi Dokumen");
        }
      );
      return;
    }

    confirmAndAdvance(
      selectedOrder.orderNo,
      "Stage 2 – Penjadwalan",
      "Apakah Anda yakin verifikasi awal data identitas customer dan kelayakan berkas order telah sesuai untuk dipindahkan ke tahap Penjadwalan?",
      async () => {
        const nowStr = new Date().toISOString();
        const updated = await advanceOrderAsync(selectedOrder.orderNo, "Penjadwalan", {
          isVerified: true,
          verifiedBy: userName,
          verifiedAt: nowStr,
        });
        if (!updated) throw new Error("Gagal memajukan order ke Penjadwalan");

        setIsVerifyWorkspaceOpen(false);
        toast.success(`Order ${selectedOrder.orderNo} berhasil diverifikasi dan masuk tahap Penjadwalan!`);
        setSelectedOrder(null);
        setCurrentTab("Penjadwalan");
      }
    );
  };

  // Stage 2: Save schedule in place (Stage 2)
  const handleSaveScheduleOnly = async () => {
    if (!selectedOrder) return;
    if (!scheduleData.tanggalJemput) {
      toast.error("Harap tentukan tanggal jemput dokumen!");
      return;
    }
    if (!scheduleData.messenger) {
      toast.error("Harap pilih messenger penjemput!");
      return;
    }
    const selectedMessengerObj = activeMessengers.find(
      (m) => m.nama === scheduleData.messenger || m.id === scheduleData.messenger
    );
    const ok = await updateOrderAsync(selectedOrder.orderNo, {
      tanggalJemput: scheduleData.tanggalJemput,
      messenger: selectedMessengerObj?.nama || scheduleData.messenger,
      assignedMessengerId: selectedMessengerObj?.id,
      assignedMessengerName: selectedMessengerObj?.nama || scheduleData.messenger,
      catatanPenjadwalan: scheduleData.catatanPenjadwalan,
      isScheduled: true,
      messengerTaskStatus: "Terjadwal Jemput",
    });
    if (!ok) {
      toast.error("Gagal menyimpan jadwal penjemputan");
      return;
    }
    setIsScheduleWorkspaceOpen(false);
    toast.success(`Jadwal jemput untuk ${selectedOrder.orderNo} berhasil disimpan (${selectedMessengerObj?.nama || scheduleData.messenger})!`);
    setSelectedOrder(null);
  };

  // Stage 2 -> Stage 3 (Save schedule & Advance directly from modal)
  const handleSaveScheduleAndAdvance = () => {
    if (!selectedOrder) return;
    if (!scheduleData.tanggalJemput) {
      toast.error("Harap tentukan tanggal jemput dokumen!");
      return;
    }
    if (!scheduleData.messenger) {
      toast.error("Harap pilih messenger penjemput!");
      return;
    }
    const selectedMessengerObj = activeMessengers.find(
      (m) => m.nama === scheduleData.messenger || m.id === scheduleData.messenger
    );

    confirmAndAdvance(
      selectedOrder.orderNo,
      "Stage 3 — Verifikasi Dokumen Fisik",
      `Simpan jadwal jemput (${selectedMessengerObj?.nama || scheduleData.messenger}), konfirmasi penjemputan berkas selesai, dan lanjutkan order ke Verifikasi Dokumen?`,
      async () => {
        const nowIso = new Date().toISOString();
        const updated = await advanceOrderAsync(selectedOrder.orderNo, "Verifikasi Dokumen", {
          tanggalJemput: scheduleData.tanggalJemput,
          messenger: selectedMessengerObj?.nama || scheduleData.messenger,
          assignedMessengerId: selectedMessengerObj?.id,
          assignedMessengerName: selectedMessengerObj?.nama || scheduleData.messenger,
          catatanPenjadwalan: scheduleData.catatanPenjadwalan,
          isScheduled: true,
          pickupCompleted: true,
          pickupCompletedAt: nowIso,
          messengerTaskStatus: "Dokumen Sudah Tersedia",
        });
        if (!updated) throw new Error("Gagal memindahkan order ke Verifikasi Dokumen");

        setIsScheduleWorkspaceOpen(false);
        setCurrentTab("Verifikasi Dokumen");
        toast.success(`Jadwal jemput untuk ${selectedOrder.orderNo} disimpan & order berlanjut ke Verifikasi Dokumen!`);
        setSelectedOrder(null);
      }
    );
  };

  // Stage 2 -> Stage 3 (Advance to Verifikasi Dokumen only when pickup completed from table)
  const handleAdvanceFromPickup = (order: any) => {
    if (!order.pickupCompleted && order.messengerTaskStatus !== "Dokumen Sudah Tersedia") {
      toast.error("Penjemputan dokumen belum diselesaikan oleh messenger!");
      return;
    }
    confirmAndAdvance(
      order.orderNo,
      "Stage 3 — Verifikasi Dokumen Fisik",
      "Apakah Anda yakin berkas fisik telah tiba dan siap diverifikasi kelengkapannya di kantor?",
      async () => {
        const updated = await advanceOrderAsync(order.orderNo, "Verifikasi Dokumen", { pickupCompleted: true });
        if (!updated) throw new Error("Gagal memajukan order ke Verifikasi Dokumen");
        setCurrentTab("Verifikasi Dokumen");
        toast.success(`Dokumen order ${order.orderNo} siap diverifikasi fisik di kantor!`);
      }
    );
  };

  // Stage 2 -> Stage 3 (Legacy modal fallback handler maintained for compatibility)
  const handleSaveSchedule = () => {
    handleSaveScheduleAndAdvance();
  };

  // Stage 3 -> Stage 4 (Verifikasi Dokumen -> Proses Samsat)
  const handleVerifyDocuments = () => {
    if (!selectedOrder) return;
    confirmAndAdvance(
      selectedOrder.orderNo,
      "Stage 4 — Proses Samsat",
      "Apakah Anda yakin seluruh berkas fisik (STNK, BPKB, KTP, SKKP, Surat Kuasa) sudah lengkap dan benar untuk diproses ke Samsat?",
      async () => {
        const updated = await advanceOrderAsync(selectedOrder.orderNo, "Proses Samsat", {
          clientDocuments: docState as any,
          documentNotes: docNotes,
          documentsVerified: true,
          samsatStatus: "Belum Terjadwal",
          isSamsatScheduled: false,
        });
        if (!updated) throw new Error("Gagal memajukan order ke Proses Samsat");

        setIsDocVerificationWorkspaceOpen(false);
        setCurrentTab("Proses Samsat");
        toast.success(`Verifikasi dokumen fisik selesai. Order ${selectedOrder.orderNo} siap diproses Samsat!`);
        setSelectedOrder(null);
      }
    );
  };

  // Stage 4 -> Stage 5 (Proses Samsat -> Verifikasi Ulang)
  const handleAdvanceFromSamsat = () => {
    if (!selectedOrder) return;
    if (!canManage(4)) {
      toast.error("Akses Ditolak: Anda tidak memiliki izin untuk memproses tahap Samsat.");
      return;
    }
    if (selectedOrder.samsatPickupStatus !== "Dokumen Samsat Diterima di Kantor") {
      toast.error("Dokumen hasil Samsat belum diserahkan dan diterima di kantor!");
      return;
    }
    confirmAndAdvance(
      selectedOrder.orderNo,
      "Stage 5 — Verifikasi Ulang Biaya",
      "Apakah Anda yakin seluruh tahapan Samsat telah selesai dan dokumen hasil sudah diterima kantor untuk diverifikasi biayanya?",
      async () => {
        const updated = await advanceOrderAsync(selectedOrder.orderNo, "Verifikasi Ulang", {});
        if (!updated) throw new Error("Gagal memajukan order ke Verifikasi Ulang");

        setIsSamsatProgressDialogOpen(false);
        setCurrentTab("Verifikasi Ulang");
        toast.success(`Proses Samsat selesai! Order ${selectedOrder.orderNo} berlanjut ke Verifikasi Ulang.`);
        setSelectedOrder(null);
      }
    );
  };

  // Stage 4 -> Stage 5 from Stage 4 Table
  const handleAdvanceFromSamsatResult = (order: any) => {
    if (!canManage(4)) {
      toast.error("Akses Ditolak: Anda tidak memiliki izin untuk memproses tahap Samsat.");
      return;
    }
    if (order.samsatPickupStatus !== "Dokumen Samsat Diterima di Kantor") {
      toast.error("Dokumen hasil Samsat belum diserahkan dan diterima di kantor!");
      return;
    }
    confirmAndAdvance(
      order.orderNo,
      "Stage 5 — Verifikasi Ulang Biaya",
      "Apakah Anda yakin dokumen hasil Samsat sudah diverifikasi dan siap direkonsiliasi biayanya?",
      async () => {
        const updated = await advanceOrderAsync(order.orderNo, "Verifikasi Ulang", {});
        if (!updated) throw new Error("Gagal memajukan order ke Verifikasi Ulang");

        setCurrentTab("Verifikasi Ulang");
        toast.success(`Dokumen hasil Samsat diterima. Order ${order.orderNo} berlanjut ke Verifikasi Ulang Biaya.`);
      }
    );
  };

  // Stage 7 -> Stage 8 from Stage 7 Table
  const handleAdvanceFromDelivery = (order: any) => {
    if (order.deliveryStatus !== "Dokumen Diserahkan" && !order.isReceived) {
      toast.error("Pengantaran dokumen belum diselesaikan oleh messenger!");
      return;
    }
    confirmAndAdvance(
      order.orderNo,
      "Stage 8 — Dokumen Telah Diterima",
      "Apakah Anda yakin dokumen fisik telah diserahkan dan diterima oleh pihak pemesan?",
      async () => {
        const dateStr = new Date().toISOString().split('T')[0];
        const updated = await advanceOrderAsync(order.orderNo, "Dokumen Telah Diterima", {
          tanggalDiterima: dateStr,
          isReceived: true,
        });
        if (!updated) throw new Error("Gagal memajukan order ke Dokumen Telah Diterima");

        setCurrentTab("Dokumen Telah Diterima");
        toast.success(`Order ${order.orderNo} berhasil diserahkan ke pelanggan! Berpindah ke tahap Dokumen Telah Diterima.`);
      }
    );
  };

  // Calculation helpers
  const calculateTotalFinal = () => {
    // 1. Core items from editableBreakdown (PKB, SWDKLLJ, Denda, Jasa)
    let coreSum = 0;
    if (editableBreakdown && editableBreakdown.length > 0) {
      coreSum = editableBreakdown.reduce((sum, item) => {
        const val = item.actualCost !== undefined ? Number(item.actualCost) : Number(item.amount || 0);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
    } else {
      coreSum = (parseFloat(finalCostData.finalBiayaJasa || "0")) +
                (parseFloat(finalCostData.finalPkb || "0")) +
                (parseFloat(finalCostData.finalSwdkllj || "0")) +
                (parseFloat(finalCostData.finalDendaSwdkllj || "0"));
    }

    // 2. Mutasi Keluar: use sum of itemized details if filled, otherwise category total
    const rincianMutasiKeluar = Object.keys(hargaDasarMutasiKeluar).reduce(
      (sum, k) => sum + (parseFloat(finalCostData[k] || "0")),
      0
    );
    const mutasiKeluarTotal = rincianMutasiKeluar > 0 ? rincianMutasiKeluar : (parseFloat(finalCostData.finalMutasiKeluar || "0"));

    // 3. Mutasi Masuk: use sum of itemized details if filled, otherwise category total
    const rincianMutasiMasuk = Object.keys(hargaDasarMutasiMasuk).reduce(
      (sum, k) => sum + (parseFloat(finalCostData[k] || "0")),
      0
    );
    const mutasiMasukTotal = rincianMutasiMasuk > 0 ? rincianMutasiMasuk : (parseFloat(finalCostData.finalMutasiMasuk || "0"));

    // 4. Biaya Lainnya
    const biayaLainnyaTotal = parseFloat(finalCostData.finalBiayaLainnya || "0");

    // 5. Custom Costs
    const customTotal = customCostItems.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);

    return coreSum + mutasiKeluarTotal + mutasiMasukTotal + biayaLainnyaTotal + customTotal;
  };

  const handleMutasiKeluarItemChange = (key: string, val: string) => {
    const updated = { ...finalCostData, [key]: val };
    const sum = Object.keys(hargaDasarMutasiKeluar).reduce(
      (acc, k) => acc + (parseFloat(updated[k] || "0")),
      0
    );
    if (sum > 0) {
      updated.finalMutasiKeluar = sum.toString();
    }
    setFinalCostData(updated);
  };

  const handleMutasiMasukItemChange = (key: string, val: string) => {
    const updated = { ...finalCostData, [key]: val };
    const sum = Object.keys(hargaDasarMutasiMasuk).reduce(
      (acc, k) => acc + (parseFloat(updated[k] || "0")),
      0
    );
    if (sum > 0) {
      updated.finalMutasiMasuk = sum.toString();
    }
    setFinalCostData(updated);
  };

  const handleBreakdownActualCostChange = (itemId: string, newActual: string) => {
    const numVal = parseFloat(newActual) || 0;
    setEditableBreakdown(prev => prev.map(item => {
      if (item.itemId === itemId) {
        return { ...item, actualCost: numVal };
      }
      return item;
    }));
  };

  const handleUploadNewVerificationDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const processed = await processDocumentUpload(file);
        let uploadedDocId: string | undefined;
        let finalFileUrl = processed.fileUrl;

        if (selectedOrder?.orderNo) {
          try {
            const uploaded = await documentRepository.uploadDocument(processed.file, {
              orderNo: selectedOrder.orderNo,
              documentType: "Hasil Samsat",
              metadata: {
                phase: "AFTER",
                category: "Dokumen Hasil",
              },
            });
            if (uploaded?.id) {
              uploadedDocId = uploaded.id;
              finalFileUrl = uploaded.fileUrl;
            }
          } catch (uploadErr) {
            console.warn("Server upload failed, using processed fileUrl:", uploadErr);
          }
        }

        const newDoc: VerificationUploadedDoc = {
          id: uploadedDocId || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          fileUrl: finalFileUrl,
          fileType: processed.fileType === "pdf" ? "pdf" : "image",
          fileSize: formatFileSize(processed.fileSize),
          uploadedAt: new Date().toISOString(),
          uploadedBy: userName || "Staff",
        };
        setUploadedNewDocs((prev) => [...prev, newDoc]);
        setNewSamsatDocs((prev) => [...prev, file.name]);
        setIsStage5DocApproved(false);
        setIsStage6DocApproved(false);
        toast.info("Dokumen baru diunggah. Persetujuan dokumen direset dan harus disetujui ulang.");

        if (selectedOrder?.orderNo) {
          const currentRekap = selectedOrder.rekapDocuments || [];
          const updatedRekap = [
            ...currentRekap,
            {
              id: newDoc.id,
              name: newDoc.name,
              category: "Dokumen Hasil" as const,
              phase: "AFTER" as const,
              fileUrl: newDoc.fileUrl,
              fileType: newDoc.fileType,
              fileSize: newDoc.fileSize,
              uploadedAt: newDoc.uploadedAt,
              uploadedBy: newDoc.uploadedBy,
              status: "Tersedia",
            },
          ];
          updateOrder(selectedOrder.orderNo, {
            rekapDocuments: updatedRekap,
            uploadedDocs: [...(selectedOrder.uploadedDocs || []), newDoc],
          });
          setSelectedOrder((prev: any) => prev ? {
            ...prev,
            rekapDocuments: updatedRekap,
            uploadedDocs: [...(prev.uploadedDocs || []), newDoc],
          } : null);
        }

        toast.success(`Dokumen "${file.name}" berhasil diunggah.`);
      } catch (err: any) {
        toast.error(err.message || "Gagal mengunggah dokumen baru.");
      }
    }
  };

  const handleRemoveUploadedDoc = (docId: string) => {
    setUploadedNewDocs(prev => {
      const remaining = prev.filter(d => d.id !== docId);
      setNewSamsatDocs(remaining.map(d => d.name));
      return remaining;
    });
    setIsStage5DocApproved(false);
    setIsStage6DocApproved(false);
    toast.info("Dokumen dihapus. Persetujuan dokumen direset dan harus disetujui ulang.");
    toast.success("Dokumen dihapus.");
  };

  // Explicit Document Approval Handlers
  const handleApproveStage5Documents = async () => {
    if (!selectedOrder || isSubmittingApproval) return;
    setIsSubmittingApproval(true);
    try {
      const allDocNames = [
        ...Object.keys(docState).filter(k => docState[k].status === "Lengkap" || docState[k].fileUrl).map(k => docState[k].name || k),
        ...uploadedNewDocs.map(d => d.name)
      ];
      const ok = await approveDocumentsAsync(
        selectedOrder.orderNo,
        5,
        { name: userName || "Admin Loket", role: userRole || "admin" },
        docApprovalNoteInput,
        allDocNames
      );
      if (ok) {
        setIsStage5DocApproved(true);
        setDocApprovalDetails(prev => ({
          ...prev,
          stage5VerifiedBy: userName || "Admin Loket",
          stage5VerifiedAt: new Date().toISOString(),
          stage5Notes: docApprovalNoteInput,
        }));
        toast.success("Dokumen berhasil disetujui untuk Stage 5.");
      } else {
        toast.error("Gagal menyetujui dokumen.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyetujui dokumen.");
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleApproveStage6Documents = async () => {
    if (!selectedOrder || isSubmittingApproval) return;
    if (!canManage(6)) {
      toast.error("Akses Ditolak: Hanya Supervisor atau Administrator yang dapat menyetujui dokumen di Stage 6.");
      return;
    }
    setIsSubmittingApproval(true);
    try {
      const allDocNames = [
        ...Object.keys(docState).filter(k => docState[k].status === "Lengkap" || docState[k].fileUrl).map(k => docState[k].name || k),
        ...uploadedNewDocs.map(d => d.name)
      ];
      const ok = await approveDocumentsAsync(
        selectedOrder.orderNo,
        6,
        { name: userName || "Supervisor", role: userRole || "supervisor" },
        docApprovalNoteInput,
        allDocNames
      );
      if (ok) {
        setIsStage6DocApproved(true);
        setDocApprovalDetails(prev => ({
          ...prev,
          stage6ApprovedBy: userName || "Supervisor",
          stage6ApprovedAt: new Date().toISOString(),
          stage6Notes: docApprovalNoteInput,
        }));
        toast.success("Dokumen berhasil disetujui oleh Supervisor (Stage 6).");
      } else {
        toast.error("Gagal menyetujui dokumen.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyetujui dokumen.");
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Stage 5 -> Stage 6 (Verifikasi Ulang -> Supervisi) & Stage 6 -> Stage 7 (Supervisi -> Pengantaran)
  const handleSaveFinalCost = (isSupervisi: boolean) => {
    if (!selectedOrder || isSubmittingFinalCost) return;
    if (isSupervisi && !canManage(6)) {
      toast.error("Akses Ditolak: Anda tidak memiliki izin untuk menyetujui tahap Supervisi.");
      return;
    }
    if (!isSupervisi && !isStage5DocApproved) {
      toast.error("Validasi Gagal: Dokumen fisik dan hasil Samsat harus disetujui terlebih dahulu sebelum mengajukan rekonsiliasi ke Supervisi.");
      return;
    }
    if (isSupervisi && !isStage6DocApproved) {
      toast.error("Validasi Gagal: Dokumen harus disetujui oleh Supervisor terlebih dahulu sebelum lanjut ke tahap Pengantaran.");
      return;
    }
    setIsSubmittingFinalCost(true);

    try {
      // Check exceeded items vs base price
    const exceededItems: string[] = [];
    Object.keys(hargaDasarMutasiKeluar).forEach((key) => {
      const val = parseFloat(finalCostData[key] || "0");
      const base = hargaDasarMutasiKeluar[key];
      if (val > base) {
        const readable = key.replace('mutasiKeluar', '').replace(/([A-Z])/g, ' $1').trim();
        exceededItems.push(`Mutasi Keluar - ${readable}: Rp ${val.toLocaleString('id-ID')} (Harga Dasar: Rp ${base.toLocaleString('id-ID')})`);
      }
    });
    Object.keys(hargaDasarMutasiMasuk).forEach((key) => {
      const val = parseFloat(finalCostData[key] || "0");
      const base = hargaDasarMutasiMasuk[key];
      if (val > base) {
        const readable = key.replace('mutasiMasuk', '').replace(/([A-Z])/g, ' $1').trim();
        exceededItems.push(`Mutasi Masuk - ${readable}: Rp ${val.toLocaleString('id-ID')} (Harga Dasar: Rp ${base.toLocaleString('id-ID')})`);
      }
    });

    customCostItems.forEach(ci => {
      if (ci.actualCost > ci.basePrice) {
        exceededItems.push(`${ci.name}: Rp ${ci.actualCost.toLocaleString('id-ID')} (Harga Dasar: Rp ${ci.basePrice.toLocaleString('id-ID')})`);
      }
    });

    const parsedData: any = {};
    Object.keys(finalCostData).forEach(k => {
      if (k.startsWith('keterangan')) {
        parsedData[k] = finalCostData[k];
      } else {
        parsedData[k] = parseFloat(finalCostData[k] || "0");
      }
    });

    // Authoritative calculation of new total and payment status
    const totalFinal = calculateTotalFinal();
    const jasaItem = editableBreakdown.find(item => item.category === "Jasa" || item.name.toLowerCase().includes("jasa"));
    const finalBiayaJasa = jasaItem
      ? (jasaItem.actualCost !== undefined ? Number(jasaItem.actualCost) : Number(jasaItem.amount || 0))
      : (parseFloat(finalCostData.finalBiayaJasa || "0") || selectedOrder.biayaJasa || selectedOrder.costSnapshot?.biayaJasa || 0);
    const totalBiayaSamsat = Math.max(0, totalFinal - finalBiayaJasa);

    const paid = selectedOrder.payment?.dibayar || 0;
    const difference = totalFinal - paid;

    let settlementCondition: "BALANCED" | "UNDERPAID" | "OVERPAID" = "BALANCED";
    let refundStatus: "NONE" | "PENDING" = "NONE";
    let newKurang = 0;
    let newOverpayment = 0;
    let newStatus: "Lunas" | "Belum Bayar" | "Kurang Bayar" = "Lunas";

    if (difference === 0) {
      settlementCondition = "BALANCED";
      refundStatus = "NONE";
      newKurang = 0;
      newOverpayment = 0;
      newStatus = "Lunas";
    } else if (difference > 0) {
      settlementCondition = "UNDERPAID";
      refundStatus = "NONE";
      newKurang = difference;
      newOverpayment = 0;
      newStatus = paid > 0 ? "Kurang Bayar" : "Belum Bayar";
    } else {
      settlementCondition = "OVERPAID";
      refundStatus = "PENDING";
      newKurang = 0;
      newOverpayment = Math.abs(difference);
      newStatus = "Lunas";
    }

    const updatedPayment = {
      ...(selectedOrder.payment || {}),
      totalBiaya: totalFinal,
      kurang: newKurang,
      overpayment: newOverpayment,
      settlementCondition,
      refundStatus,
      statusPembayaran: newStatus,
    };

    const newDocNames = uploadedNewDocs.map(d => d.name);
    const combinedRekapDocs = [
      ...(selectedOrder.rekapDocuments || []),
      ...uploadedNewDocs
        .filter(d => !(selectedOrder.rekapDocuments || []).some((rd: any) => rd.fileUrl === d.fileUrl || rd.label === d.name))
        .map(d => ({
          id: d.id,
          orderId: selectedOrder.orderNo,
          phase: "AFTER" as const,
          documentType: (d.name.toLowerCase().includes("stnk") ? "STNK" : d.name.toLowerCase().includes("bpkb") ? "BPKB" : "SKKP") as any,
          label: d.name,
          fileType: (d.fileType === "pdf" ? "PDF" : "IMAGE") as any,
          fileUrl: d.fileUrl,
          uploadedAt: d.uploadedAt,
          uploadedBy: d.uploadedBy || userName,
        })),
    ];

    const payload: Partial<OperationalOrder> = {
      ...parsedData,
      totalEstimasi: totalFinal,
      finalCost: totalFinal,
      settlementCondition,
      refundStatus,
      alasanPending: finalCostAlasan || undefined,
      alasan_pending: finalCostAlasan || undefined,
      payment: updatedPayment,
      exceededItems: exceededItems.length > 0 ? exceededItems : null,
      updatedDocuments: newDocNames.length > 0 ? newDocNames : (newSamsatDocs.length > 0 ? newSamsatDocs : selectedOrder.updatedDocuments || []),
      rekapDocuments: combinedRekapDocs,
      costBreakdown: editableBreakdown.length > 0 ? editableBreakdown : selectedOrder.costBreakdown,
      customCostItems,
      isVerified: true,
    };

    // Synchronize final costs directly to FinanceStore (Order -> Finance SSoT Sync)
    orderStore.syncFinalCostToFinance(
      selectedOrder.orderNo,
      totalFinal,
      totalBiayaSamsat,
      finalBiayaJasa,
      customCostItems,
      finalCostAlasan
    );

    if (isSupervisi) {
      // Stage 6 -> Stage 7 (Supervisi -> Pengantaran)
      confirmAndAdvance(
        selectedOrder.orderNo,
        "Stage 7 — Pengantaran Dokumen",
        "Apakah Anda yakin menyetujui seluruh rekonsiliasi biaya final ini dan memindahkan order ke tahap Pengantaran?",
        async () => {
          const nowIso = new Date().toISOString();
          const updated = await advanceOrderAsync(selectedOrder.orderNo, "Pengantaran", {
            ...payload,
            approvedBySpv: true,
            spvName: userName || "Supervisor",
            spvApprovedAt: nowIso,
            documentApproval: {
              ...(selectedOrder.documentApproval || {}),
              stage6Approved: true,
              stage6ApprovedBy: userName || "Supervisor",
              stage6ApprovedAt: nowIso,
            },
          });
          if (!updated) throw new Error("Gagal memajukan order ke Pengantaran");

          setIsFinalCostDialogOpen(false);
          setCurrentTab("Pengantaran");
          toast.success(`Supervisi disetujui! Order ${selectedOrder.orderNo} dipindahkan ke Pengantaran.`);
          setSelectedOrder(null);
        }
      );
    } else {
      // Stage 5 -> Stage 6 (Verifikasi Ulang -> Supervisi)
      confirmAndAdvance(
        selectedOrder.orderNo,
        "Stage 6 — Supervisi & Review SPV",
        "Apakah Anda yakin rincian biaya final aktual sudah sesuai dan siap diajukan ke Supervisi SPV?",
        async () => {
          const nowIso = new Date().toISOString();
          const updated = await advanceOrderAsync(selectedOrder.orderNo, "Supervisi", {
            ...payload,
            documentsVerified: true,
            documentApproval: {
              ...(selectedOrder.documentApproval || {}),
              stage5Verified: true,
              stage5VerifiedBy: docApprovalDetails.stage5VerifiedBy || userName || "Admin",
              stage5VerifiedAt: docApprovalDetails.stage5VerifiedAt || nowIso,
            },
          });
          if (!updated) throw new Error("Gagal memajukan order ke Supervisi");

          setIsFinalCostDialogOpen(false);
          setCurrentTab("Supervisi");
          toast.success(`Biaya final disimpan! Order ${selectedOrder.orderNo} diajukan ke Supervisi SPV.`);
          setSelectedOrder(null);
        }
      );
    }

    if (exceededItems.length > 0) {
      toast.warning(`${exceededItems.length} item mutasi melebihi harga dasar.`);
    }
    } finally {
      setIsSubmittingFinalCost(false);
    }
  };

  // Stage 7: Save delivery schedule in place (Stage 7)
  const handleSaveDelivery = () => {
    if (!selectedOrder) return;
    if (!deliveryData.tanggalPengantaran) {
      toast.error("Harap tentukan tanggal pengantaran dokumen!");
      return;
    }
    const deliveryMessengerName = deliveryData.messenger || selectedOrder.messengerPengantar || selectedOrder.messenger;
    const selectedMessengerObj = activeMessengers.find(
      (m) => m.nama === deliveryMessengerName || m.id === deliveryMessengerName
    );
    updateOrder(selectedOrder.orderNo, {
      tanggalPengantaran: deliveryData.tanggalPengantaran,
      messengerPengantar: selectedMessengerObj?.nama || deliveryMessengerName,
      assignedMessengerId: selectedMessengerObj?.id || selectedOrder.assignedMessengerId,
      assignedMessengerName: selectedMessengerObj?.nama || deliveryMessengerName,
      catatanPengantaran: deliveryData.catatanPengantaran,
      isDeliveryScheduled: true,
      deliveryStatus: "Terjadwal Antar",
    });
    setIsDeliveryWorkspaceOpen(false);
    toast.success(`Jadwal pengantaran untuk ${selectedOrder.orderNo} berhasil disimpan (${selectedMessengerObj?.nama || deliveryMessengerName})!`);
    setSelectedOrder(null);
  };

  // Handle direct file upload for handover proof (PDF, JPEG, JPG, PNG <= 5MB with compression)
  const handleDirectHandoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingHandover(true);
      const processed = await processDocumentUpload(file);
      let uploadedDocId: string | undefined;
      let finalFileUrl = processed.fileUrl;

      if (selectedOrder?.orderNo) {
        try {
          const uploaded = await documentRepository.uploadDocument(processed.file, {
            orderNo: selectedOrder.orderNo,
            documentType: "Bukti Serah Terima",
            metadata: {
              phase: "AFTER",
              category: "Bukti Serah Terima",
            },
          });
          if (uploaded?.id) {
            uploadedDocId = uploaded.id;
            finalFileUrl = uploaded.fileUrl;
          }
        } catch (uploadErr) {
          console.warn("Handover upload to server failed, using processed fileUrl:", uploadErr);
        }
      }

      setDirectHandoverData(prev => ({
        ...prev,
        fileUrl: finalFileUrl,
        fileName: processed.fileName,
        fileType: processed.fileType,
        fileSize: processed.fileSize,
        documentId: uploadedDocId,
      }));

      if (processed.compressed && processed.compressionRatio) {
        toast.success(
          `Berkas ${file.name} berhasil diproses & dikompres (${formatFileSize(file.size)} ➔ ${formatFileSize(processed.fileSize)}, hemat ${processed.compressionRatio})!`
        );
      } else {
        toast.success(`Berkas ${file.name} (${formatFileSize(processed.fileSize)}) berhasil dilampirkan!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses berkas serah terima");
    } finally {
      setIsCompressingHandover(false);
      e.target.value = "";
    }
  };

  // Stage 7: Save direct handover in office/counter
  const handleSaveDirectHandover = () => {
    if (!selectedOrder) return;
    if (!directHandoverData.recipientName.trim()) {
      toast.error("Nama penerima dokumen wajib diisi!");
      return;
    }
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.split("T")[0];
    const proof = {
      recipientName: directHandoverData.recipientName.trim(),
      relationship: directHandoverData.relationship || "Pemilik Langsung",
      photoProofUrl: directHandoverData.fileUrl,
      fileName: directHandoverData.fileName,
      fileType: directHandoverData.fileType,
      fileSize: directHandoverData.fileSize,
      notes: directHandoverData.notes.trim() || undefined,
      completedAt: nowIso,
    };

    confirmAndAdvance(
      selectedOrder.orderNo,
      "Stage 8 — Dokumen Telah Diterima",
      `Apakah Anda yakin serah terima dokumen kepada ${proof.recipientName} (${proof.relationship}) sudah benar dan order dipindahkan ke tahap Dokumen Telah Diterima?`,
      async () => {
        const updated = await advanceOrderAsync(selectedOrder.orderNo, "Dokumen Telah Diterima", {
          deliveryStatus: "Dokumen Diserahkan",
          isReceived: true,
          receiverName: proof.recipientName,
          tanggalDiterima: dateStr,
          deliveryHandover: proof,
        });
        if (!updated) throw new Error("Gagal memindahkan order ke Dokumen Telah Diterima");

        setIsDeliveryWorkspaceOpen(false);
        setCurrentTab("Dokumen Telah Diterima");
        toast.success(`Serah terima dokumen order ${selectedOrder.orderNo} berhasil disimpan & berpindah ke tahap 8!`);
        setSelectedOrder(null);
      }
    );
  };

  // Stage 8 -> Riwayat Order (Final Archiving)
  const handleArchiveOrder = () => {
    if (!selectedOrder) return;
    confirmAndAdvance(
      selectedOrder.orderNo,
      "Arsip Riwayat Operasional & Rekap Order",
      "Apakah Anda yakin ingin menyelesaikan proses dan mengarsipkan order ini ke Riwayat Order?",
      async () => {
        const ok = await archiveOrderAsync(selectedOrder.orderNo);
        if (!ok) throw new Error(`Gagal mengarsipkan order ${selectedOrder.orderNo}.`);

        setIsArchiveDialogOpen(false);
        toast.success(`Order ${selectedOrder.orderNo} berhasil diselesaikan dan diarsipkan ke Riwayat Order!`);
        setSelectedOrder(null);
      }
    );
  };

  // Open Handlers with full data hydration
  const openVerifyWorkspace = (order: any) => {
    setSelectedOrder(order);
    const initialAmount = order?.payment?.nominalPembayaranAwalTerkonfirmasi !== undefined
      ? order.payment.nominalPembayaranAwalTerkonfirmasi
      : (order?.payment?.nominalDibayarAwal !== undefined
          ? order.payment.nominalDibayarAwal
          : (order?.payment?.dibayar || 0));
    setEditPaymentAmount(initialAmount > 0 ? String(initialAmount) : (order?.payment?.totalBiaya ? String(order.payment.totalBiaya) : "0"));
    setEditPaymentNote("");
    setIsEditingPayment(!order?.payment?.isPaymentVerified);
    setIsVerifyWorkspaceOpen(true);
  };

  const openScheduleWorkspace = (order: any) => {
    setSelectedOrder(order);
    setScheduleData({
      tanggalJemput: order.tanggalJemput || new Date().toISOString().split('T')[0],
      messenger: order.messenger || "",
      catatanPenjadwalan: order.catatanPenjadwalan || "",
    });
    setIsScheduleWorkspaceOpen(true);
  };

  const openDocVerificationWorkspace = (order: any) => {
    setSelectedOrder(order);
    setDocState(order.clientDocuments || {
      stnk: { name: "", status: "Belum Tersedia" },
      bpkb: { name: "", status: "Belum Tersedia" },
      ktp: { name: "", status: "Belum Tersedia" },
      skkp: { name: "", status: "Belum Tersedia" },
      lainnya: { name: "", status: "Belum Tersedia" },
    });
    setDocNotes(order.documentNotes || "");
    setIsDocVerificationWorkspaceOpen(true);
  };

  const openSamsatProgressWorkspace = (order: any) => {
    setSelectedOrder(order);
    setIsSamsatProgressDialogOpen(true);
  };

  const openSamsatScheduleModal = (order: any) => {
    setSelectedOrder(order);

    const defaultDate = order.tanggalProsesSamsat || getLocalDateString();

    let defaultMessengerNama = "";
    if (order.samsatMessengerNama && activeMessengers.some((m) => m.nama === order.samsatMessengerNama || m.id === order.samsatMessengerId)) {
      defaultMessengerNama = order.samsatMessengerNama;
    } else if (order.metodeLayanan === "Antar Jemput" && (order.assignedMessengerId || order.messenger)) {
      // Kondisi 1: Dokumen dijemput kurir
      const pickupCourier = activeMessengers.find(
        (m) => (order.assignedMessengerId && m.id === order.assignedMessengerId) ||
               (order.messenger && m.nama.toLowerCase() === order.messenger.toLowerCase())
      );
      if (pickupCourier) {
        defaultMessengerNama = pickupCourier.nama;
      }
    }

    // Kondisi 2: Offline / Datang Langsung, atau kurir penjemput tidak aktif
    if (!defaultMessengerNama && activeMessengers.length > 0) {
      const couriersWithLoad = activeMessengers.map((m) => {
        const activeTasks = getMessengerTasksForEmployee(activeOrders, m.id, m.nama);
        return {
          ...m,
          load: activeTasks.length,
        };
      });

      const minLoad = Math.min(...couriersWithLoad.map((c) => c.load));
      const tiedCandidates = couriersWithLoad
        .filter((c) => c.load === minLoad)
        .sort((a, b) => a.id.localeCompare(b.id));

      if (tiedCandidates.length === 1) {
        defaultMessengerNama = tiedCandidates[0].nama;
      } else {
        // Persistent Deterministic Round-Robin
        const storageKey = "admin_sun89_last_assigned_samsat_courier_id";
        const lastId = localStorage.getItem(storageKey);
        let nextIdx = 0;
        if (lastId) {
          const lastIdx = tiedCandidates.findIndex((c) => c.id === lastId);
          if (lastIdx !== -1) {
            nextIdx = (lastIdx + 1) % tiedCandidates.length;
          }
        }
        const chosen = tiedCandidates[nextIdx];
        localStorage.setItem(storageKey, chosen.id);
        defaultMessengerNama = chosen.nama;
      }
    }

    setSamsatScheduleData({
      tanggalProsesSamsat: defaultDate,
      samsatMessenger: defaultMessengerNama || activeMessengers[0]?.nama || "",
      catatanSamsat: order.catatanSamsat || "",
    });
    setIsSamsatScheduleModalOpen(true);
  };

  const handleSaveSamsatSchedule = () => {
    if (!selectedOrder) return;
    if (!samsatScheduleData.tanggalProsesSamsat) {
      toast.error("Harap tentukan tanggal mulai proses Samsat!");
      return;
    }

    const todayStr = getLocalDateString();
    if (samsatScheduleData.tanggalProsesSamsat < todayStr) {
      toast.error("Tanggal mulai proses Samsat tidak boleh sebelum hari ini.");
      return;
    }

    if (selectedOrder.tanggalMasukBerkas) {
      const masukDate = selectedOrder.tanggalMasukBerkas.split("T")[0];
      if (masukDate) {
        if (isNaN(Date.parse(masukDate))) {
          toast.error("Format tanggal berkas diterima tidak valid pada order ini.");
          return;
        }
        if (samsatScheduleData.tanggalProsesSamsat < masukDate) {
          toast.error(`Tanggal mulai proses Samsat tidak boleh sebelum tanggal berkas diterima (${masukDate}).`);
          return;
        }
      }
    }

    if (!samsatScheduleData.samsatMessenger) {
      toast.error("Harap pilih messenger yang bertanggung jawab!");
      return;
    }
    const selectedMessengerObj = activeMessengers.find(
      (m) => m.nama === samsatScheduleData.samsatMessenger || m.id === samsatScheduleData.samsatMessenger
    );
    const messengerNama = selectedMessengerObj?.nama || samsatScheduleData.samsatMessenger;
    const messengerId = selectedMessengerObj?.id;
    updateOrder(selectedOrder.orderNo, {
      tanggalProsesSamsat: samsatScheduleData.tanggalProsesSamsat,
      samsatMessengerId: messengerId,
      samsatMessengerNama: messengerNama,
      samsatMessenger: messengerNama,
      catatanSamsat: samsatScheduleData.catatanSamsat,
      samsatStatus: "Terjadwal Samsat",
      isSamsatScheduled: true,
    });
    setIsSamsatScheduleModalOpen(false);
    toast.success(`Jadwal proses Samsat untuk ${selectedOrder.orderNo} berhasil disimpan (${messengerNama})!`);
    setSelectedOrder(null);
  };

  const openSamsatPickupModal = (order: any) => {
    setSelectedOrder(order);
    setSamsatPickupData({
      samsatPickupDate: order.samsatPickupDate || new Date().toISOString().split('T')[0],
      samsatPickupMessenger: order.samsatPickupMessengerNama || order.samsatMessengerNama || order.messenger || (activeMessengers[0]?.nama || ""),
      samsatPickupNotes: order.samsatPickupNotes || "Ambil notice pajak dan STNK baru dari Samsat, serahkan ke kantor.",
    });
    setIsSamsatPickupModalOpen(true);
  };

  const handleSaveSamsatPickupAssignment = () => {
    if (!selectedOrder) return;
    if (!samsatPickupData.samsatPickupDate) {
      toast.error("Harap tentukan tanggal penjemputan dokumen hasil Samsat!");
      return;
    }
    if (!samsatPickupData.samsatPickupMessenger) {
      toast.error("Harap pilih messenger penjemput hasil Samsat!");
      return;
    }
    const selectedMessengerObj = activeMessengers.find(
      (m) => m.nama === samsatPickupData.samsatPickupMessenger || m.id === samsatPickupData.samsatPickupMessenger
    );
    const messengerNama = selectedMessengerObj?.nama || samsatPickupData.samsatPickupMessenger;
    const messengerId = selectedMessengerObj?.id;
    updateOrder(selectedOrder.orderNo, {
      samsatPickupDate: samsatPickupData.samsatPickupDate,
      samsatPickupMessengerId: messengerId,
      samsatPickupMessengerNama: messengerNama,
      samsatPickupNotes: samsatPickupData.samsatPickupNotes,
      samsatPickupStatus: "Terjadwal Jemput Samsat",
    });
    setIsSamsatPickupModalOpen(false);
    toast.success(`Penugasan jemput hasil Samsat ${selectedOrder.orderNo} berhasil disimpan (${messengerNama})!`);
    setSelectedOrder(null);
  };

  const handleRecoverSamsatPickupKendala = async (order: any) => {
    try {
      const resAction = await recoverSamsatPickupKendalaAction(order.orderNo, {
        userId: "usr-admin",
        userName: userName || "Admin Operasional",
        role: (userRole || "administrator") as any,
      });

      if (!resAction.success) {
        toast.error(resAction.error || "Gagal memulihkan kendala");
        return;
      }

      toast.success(`Kendala jemput hasil untuk order ${order.orderNo} berhasil dipulihkan!`);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat memulihkan kendala");
    }
  };

  const openFinalCostWorkspace = (order: any) => {
    setSelectedOrder(order);
    setIsEditingFinalCost(false); // DEFAULT VIEW-ONLY as required

    const totalEst = (order.finalCost || order.payment?.totalBiaya || order.totalEstimasi || 0);
    const paidEst = (order.payment?.dibayar || 0);
    let defaultReason = order.alasanPending || order.alasan || "";
    if (!defaultReason) {
      if (paidEst < totalEst && paidEst > 0) defaultReason = "Masih terdapat sisa tagihan yang belum dibayar";
      else if (paidEst > totalEst) defaultReason = "Terdapat kelebihan pembayaran konsumen yang perlu dikembalikan";
      else if (paidEst === 0) defaultReason = "Pembayaran belum diterima dari customer";
      else defaultReason = "Pembayaran telah lunas";
    }
    setFinalCostAlasan(defaultReason);

    const populated: Record<string, string> = {
      finalBiayaJasa: (order.finalBiayaJasa ?? order.biayaJasa ?? order.costSnapshot?.biayaJasa ?? 0).toString(),
      finalPkb: (order.finalPkb ?? order.pkb ?? 0).toString(),
      finalSwdkllj: (order.finalSwdkllj ?? order.swdkllj ?? 0).toString(),
      finalDendaSwdkllj: (order.finalDendaSwdkllj ?? order.dendaSwdkllj ?? 0).toString(),
      finalMutasiKeluar: (order.finalMutasiKeluar ?? 0).toString(),
      finalMutasiMasuk: (order.finalMutasiMasuk ?? 0).toString(),
      finalBiayaLainnya: (order.finalBiayaLainnya ?? 0).toString(),
      keteranganMutasiKeluar: order.keteranganMutasiKeluar || "",
      keteranganMutasiMasuk: order.keteranganMutasiMasuk || "",
      keteranganBiayaLainnya: order.keteranganBiayaLainnya || "",
    };

    Object.keys(hargaDasarMutasiKeluar).forEach(k => {
      populated[k] = (order[k] ?? "").toString();
    });
    Object.keys(hargaDasarMutasiMasuk).forEach(k => {
      populated[k] = (order[k] ?? "").toString();
    });

    const mkMapping: Record<string, string> = {
      "legalisir cf": "mutasiKeluarLegalisirCf",
      "legalisir": "mutasiKeluarLegalisir",
      "hadir 2": "mutasiKeluarHadir",
      "hadir": "mutasiKeluarHadir",
      "cek fisik": "mutasiKeluarCf",
      "cf": "mutasiKeluarCf",
      "bantuan": "mutasiKeluarBantuanHadir",
      "cek blokir": "mutasiKeluarCekBlokir",
      "lok. pembukuan": "mutasiKeluarLokPembukuan",
      "pembukuan": "mutasiKeluarLokPembukuan",
      "lok. tu nopil": "mutasiKeluarLokTuNopil",
      "tu nopil": "mutasiKeluarLokTuNopil",
      "lok. tu": "mutasiKeluarLokTu",
      "loksus": "mutasiKeluarLoksus",
      "cetak skp": "mutasiKeluarCetakSkp",
      "skp": "mutasiKeluarCetakSkp",
      "cetak fiskal": "mutasiKeluarCetakFiskal",
      "fiskal": "mutasiKeluarCetakFiskal",
      "lok. arsip": "mutasiKeluarLokArsip",
      "arsip": "mutasiKeluarLokArsip",
      "cek progresif": "mutasiKeluarCekProgresif",
      "progresif": "mutasiKeluarCekProgresif",
      "matiin nopil": "mutasiKeluarMatiinNopil",
      "daftar mutmas kilat": "mutasiKeluarDaftarMutmasKilat",
      "mutmas kilat": "mutasiKeluarDaftarMutmasKilat",
      "daftar mutmas normal": "mutasiKeluarDaftarMutmasNormal",
      "mutmas normal": "mutasiKeluarDaftarMutmasNormal",
    };

    const mmMapping: Record<string, string> = {
      "legalisir mutmas": "mutasiMasukLegalisir",
      "legalisir": "mutasiMasukLegalisir",
      "mutmas by pendaftaran": "mutasiMasukPendaftaran",
      "pendaftaran": "mutasiMasukPendaftaran",
      "req ganjil genap": "mutasiMasukReqGanjilGenap",
      "ganjil genap": "mutasiMasukReqGanjilGenap",
      "nopol acak": "mutasiMasukAcak",
      "acak": "mutasiMasukAcak",
      "lok. tu masuk": "mutasiMasukLokTu",
      "lok. tu": "mutasiMasukLokTu",
      "lok. pembukuan masuk": "mutasiMasukLokPembukuan",
      "pembukuan": "mutasiMasukLokPembukuan",
      "daftar bpkb": "mutasiMasukDaftarBpkb",
      "penulisan bpkb": "mutasiMasukPenulisanBpkb",
      "cetak notice": "mutasiMasukCetakNotice",
      "notice": "mutasiMasukCetakNotice",
      "cetak stnk": "mutasiMasukCetakStnk",
      "cetak plat": "mutasiMasukCetakPlat",
    };

    let computedMutasiKeluar = 0;
    let computedMutasiMasuk = 0;
    const initialCustomCosts: CustomCostItem[] = [...(order.customCostItems || [])];

    if (order.messengerComponentProgress) {
      Object.values(order.messengerComponentProgress).forEach((comp: any) => {
        if (comp.name === "Komponen Samsat" && (comp.nominal || 0) === 0 && (comp.actualOrderPrice || 0) === 0) return;
        const price = comp.actualOrderPrice !== undefined ? comp.actualOrderPrice : (comp.nominal || comp.masterPrice || 0);
        const cat = (comp.category || "").toLowerCase();
        const nameLower = (comp.name || "").toLowerCase().trim();

        if (comp.isCustom) {
          if (!initialCustomCosts.some(c => c.id === comp.componentId || c.name.toLowerCase() === nameLower)) {
            initialCustomCosts.push({
              id: comp.componentId,
              name: comp.name,
              category: comp.category === "Mutasi Keluar" ? "Mutasi Keluar" : comp.category === "Mutasi Masuk" ? "Mutasi Masuk" : "Lainnya",
              actualCost: price,
              basePrice: comp.masterPrice || 0,
            });
          }
          return;
        }

        if (cat.includes("keluar") || cat === "mutasi keluar") {
          computedMutasiKeluar += price;
          for (const [pattern, key] of Object.entries(mkMapping)) {
            if (nameLower.includes(pattern) || pattern.includes(nameLower)) {
              if (!populated[key] || populated[key] === "0" || populated[key] === "") {
                populated[key] = price.toString();
              }
              break;
            }
          }
        } else if (cat.includes("masuk") || cat === "mutasi masuk") {
          computedMutasiMasuk += price;
          for (const [pattern, key] of Object.entries(mmMapping)) {
            if (nameLower.includes(pattern) || pattern.includes(nameLower)) {
              if (!populated[key] || populated[key] === "0" || populated[key] === "") {
                populated[key] = price.toString();
              }
              break;
            }
          }
        } else {
          if (!initialCustomCosts.some(c => c.id === comp.componentId || c.name.toLowerCase() === nameLower)) {
            initialCustomCosts.push({
              id: comp.componentId,
              name: comp.name,
              category: "Lainnya",
              actualCost: price,
              basePrice: comp.masterPrice || 0,
            });
          }
        }
      });
    }

    if (order.additionalProcesses && order.additionalProcesses.length > 0) {
      order.additionalProcesses.forEach((ap: any) => {
        const apName = ap.name || ap.keterangan || "Proses Tambahan";
        if (!initialCustomCosts.some(c => c.id === ap.id || c.name.toLowerCase() === apName.toLowerCase())) {
          initialCustomCosts.push({
            id: ap.id || `ap-${Date.now()}`,
            name: apName,
            category: "Lainnya",
            actualCost: ap.nominal ?? ap.estimatedCost ?? 0,
            basePrice: 0,
          });
        }
      });
    }

    const sumMkDirect = Object.keys(hargaDasarMutasiKeluar).reduce(
      (acc, k) => acc + (parseFloat(populated[k] || "0")),
      0
    );
    if (sumMkDirect > 0) {
      populated.finalMutasiKeluar = sumMkDirect.toString();
    } else if ((!populated.finalMutasiKeluar || populated.finalMutasiKeluar === "0") && computedMutasiKeluar > 0) {
      populated.finalMutasiKeluar = computedMutasiKeluar.toString();
    }

    const sumMmDirect = Object.keys(hargaDasarMutasiMasuk).reduce(
      (acc, k) => acc + (parseFloat(populated[k] || "0")),
      0
    );
    if (sumMmDirect > 0) {
      populated.finalMutasiMasuk = sumMmDirect.toString();
    } else if ((!populated.finalMutasiMasuk || populated.finalMutasiMasuk === "0") && computedMutasiMasuk > 0) {
      populated.finalMutasiMasuk = computedMutasiMasuk.toString();
    }

    setFinalCostData(populated);
    setCustomCostItems(initialCustomCosts);
    setNewCostItemName("");
    setNewCostItemAmount("");
    setNewCostItemBasePrice("");

    // Initialize full breakdown from costBreakdown / costSnapshot
    const initialBreakdown: OrderCostBreakdownItem[] = (
      order.costBreakdown && order.costBreakdown.length > 0
        ? order.costBreakdown
        : (order.costSnapshot?.breakdown && order.costSnapshot.breakdown.length > 0
            ? order.costSnapshot.breakdown
            : [])
    ).map((item: any) => ({
      itemId: item.itemId || item.id || `item-${Math.random().toString(36).slice(2, 7)}`,
      code: item.code || "",
      name: item.name,
      amount: Number(item.amount || 0),
      actualCost: item.actualCost !== undefined ? Number(item.actualCost) : Number(item.amount || 0),
      category: item.category || "Samsat",
      source: item.source || "Estimasi",
      isRequired: item.isRequired ?? true,
      notes: item.notes || "",
    }));

    if (initialBreakdown.length === 0) {
      if (order.pkb || order.nominalPkbTerakhir) {
        initialBreakdown.push({
          itemId: "pkb",
          code: "PKB-01",
          name: "PKB (Pajak Kendaraan Bermotor)",
          amount: Number(order.pkb || order.nominalPkbTerakhir || 0),
          actualCost: Number(order.finalPkb ?? (order.pkb || order.nominalPkbTerakhir || 0)),
          category: "Pajak",
          source: "Kendaraan",
          isRequired: true,
        });
      }
      if (order.swdkllj || order.nominalSwdkllj) {
        initialBreakdown.push({
          itemId: "swdkllj",
          code: "SWD-01",
          name: "SWDKLLJ",
          amount: Number(order.swdkllj || order.nominalSwdkllj || 143000),
          actualCost: Number(order.finalSwdkllj ?? (order.swdkllj || order.nominalSwdkllj || 143000)),
          category: "Pajak",
          source: "Kendaraan",
          isRequired: true,
        });
      }
      if (order.dendaSwdkllj) {
        initialBreakdown.push({
          itemId: "denda-swdkllj",
          code: "DSWD-01",
          name: "Denda SWDKLLJ",
          amount: Number(order.dendaSwdkllj || 0),
          actualCost: Number(order.finalDendaSwdkllj ?? (order.dendaSwdkllj || 0)),
          category: "Pajak",
          source: "Kendaraan",
          isRequired: false,
        });
      }
      initialBreakdown.push({
        itemId: "jasa",
        code: "FEE-01",
        name: "Biaya Jasa Pengurusan",
        amount: Number(order.biayaJasa || 0),
        actualCost: Number(order.finalBiayaJasa ?? (order.biayaJasa || 0)),
        category: "Jasa",
        source: "BiayaLayanan",
        isRequired: true,
      });
    }
    setEditableBreakdown(initialBreakdown);

    // Initialize uploaded documents from order
    const initialUploaded: VerificationUploadedDoc[] = [];
    if (order.rekapDocuments && order.rekapDocuments.length > 0) {
      order.rekapDocuments.forEach((rd: any) => {
        initialUploaded.push({
          id: rd.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: rd.label || rd.name || "Dokumen Samsat",
          fileUrl: rd.fileUrl || "",
          fileType: rd.fileType === "PDF" || (rd.fileUrl || "").toLowerCase().endsWith(".pdf") ? "pdf" : "image",
          uploadedAt: rd.uploadedAt || new Date().toISOString(),
          uploadedBy: rd.uploadedBy || "Staff",
        });
      });
    }
    if (order.updatedDocuments && order.updatedDocuments.length > 0) {
      order.updatedDocuments.forEach((docName: string, idx: number) => {
        if (!initialUploaded.some(d => d.name === docName)) {
          initialUploaded.push({
            id: `updoc-${idx}`,
            name: docName,
            fileUrl: "",
            fileType: docName.toLowerCase().endsWith(".pdf") ? "pdf" : "image",
            uploadedAt: new Date().toISOString(),
            uploadedBy: "Staff",
          });
        }
      });
    }
    setUploadedNewDocs(initialUploaded);
    setNewSamsatDocs(initialUploaded.map(d => d.name));

    const approval = order.documentApproval;
    const s5Ok = Boolean(approval?.stage5Verified || order.documentsVerified);
    const s6Ok = Boolean(approval?.stage6Approved || order.approvedBySpv);
    setIsStage5DocApproved(s5Ok);
    setIsStage6DocApproved(s6Ok);
    setDocApprovalDetails({
      stage5VerifiedBy: approval?.stage5VerifiedBy || (order.documentsVerified ? (order.verifiedBy || "Admin Loket") : undefined),
      stage5VerifiedAt: approval?.stage5VerifiedAt || (order.documentsVerified ? order.tanggalMasukBerkas : undefined),
      stage5Notes: approval?.stage5Notes || "",
      stage6ApprovedBy: approval?.stage6ApprovedBy || (order.approvedBySpv ? (order.spvName || "Supervisor") : undefined),
      stage6ApprovedAt: approval?.stage6ApprovedAt || (order.approvedBySpv ? order.spvApprovedAt : undefined),
      stage6Notes: approval?.stage6Notes || "",
    });
    setDocApprovalNoteInput("");

    setIsFinalCostDialogOpen(true);
  };

  const openDeliveryWorkspace = (order: any) => {
    setSelectedOrder(order);
    setDeliveryData({
      tanggalPengantaran: order.tanggalPengantaran || new Date().toISOString().split('T')[0],
      messenger: order.messengerPengantar || order.messenger || messengers[0],
      catatanPengantaran: order.catatanPengantaran || "Antar ke alamat pengantaran dokumen.",
    });
    setDirectHandoverData({
      recipientName: order.deliveryHandover?.recipientName || order.receiverName || order.customer || "",
      relationship: order.deliveryHandover?.relationship || "Pemilik Langsung",
      notes: order.deliveryHandover?.notes || "",
      fileUrl: order.deliveryHandover?.photoProofUrl,
      fileName: order.deliveryHandover?.fileName,
      fileType: order.deliveryHandover?.fileType,
      fileSize: order.deliveryHandover?.fileSize,
    });
    setDeliveryMode(order.metodeLayanan === "Datang Langsung" ? "langsung" : "jadwal");
    setIsDeliveryWorkspaceOpen(true);
  };

  const openArchiveWorkspace = (order: any) => {
    setSelectedOrder(order);
    setIsArchiveDialogOpen(true);
  };

  const renderEmptyStage = (stageName: string, colSpan = 7) => (
    <TableRow className="h-full hover:bg-transparent">
      <TableCell colSpan={colSpan} className="text-center p-0 align-middle">
        <EmptyState
          title={`Tidak ada order pada tahap ${stageName}`}
          description="Semua berkas pada tahap ini telah selesai diproses atau belum dialihkan."
        />
      </TableCell>
    </TableRow>
  );

  return (
    <div className="flex-1 flex flex-col min-h-full space-y-4 w-full min-w-0 text-left content-fluid">
      {/* Workflow Stepper Navigation */}
      <Card className="p-3 md:p-5 border border-border/80 bg-card shadow-xs shrink-0">
        {/* Mobile & Tablet (< xl): Stage Selector */}
        <div className="block xl:hidden">
          <Select value={currentTab} onValueChange={setCurrentTab}>
            <SelectTrigger className="bg-input-background border-border h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {trackingSteps.map((step) => {
                const Icon = step.icon;
                const count = activeOrders[step.title as StageName]?.length || 0;
                return (
                  <SelectItem key={step.id} value={step.title}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-primary" />
                      <span>{step.id}. {(step as any).displayTitle || step.title}</span>
                      <Badge status={step.id} className="ml-auto font-mono tabular-nums">
                        {count}
                      </Badge>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop (>= xl): Interactive Progress Steps */}
        <div className="hidden xl:flex items-center justify-between min-w-0 w-full overflow-x-auto pb-1">
          {trackingSteps.map((step, index) => {
            const Icon = step.icon;
            const currentIndex = trackingSteps.findIndex(s => s.title === currentTab);
            const isActive = currentIndex >= index;
            const isCurrent = currentIndex === index;
            const count = activeOrders[step.title as StageName]?.length || 0;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div 
                  className="flex flex-col items-center flex-1 cursor-pointer group"
                  onClick={() => setCurrentTab(step.title)}
                >
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer relative",
                      isCurrent
                        ? "bg-primary text-primary-foreground shadow-xs ring-4 ring-primary/15"
                        : isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                    onClick={() => setCurrentTab(step.title)}
                  >
                    <Icon className="w-4 h-4" />
                  </motion.button>
                  <p className={cn(
                    "text-[11px] mt-1.5 text-center leading-tight max-w-[90px]",
                    isCurrent
                      ? "text-primary font-semibold"
                      : isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground font-normal"
                  )}>
                    {(step as any).displayTitle || step.title}
                  </p>
                  <Badge status={step.id} className="mt-1 text-[10px] px-1.5 py-0 font-mono tabular-nums">
                    {count}
                  </Badge>
                </div>
                {index < trackingSteps.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-1.5 transition-all rounded-full",
                    currentIndex > index ? "bg-primary" : "bg-border/60"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main Tabs Container */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="hidden">
          {trackingSteps.map((step) => (
            <TabsTrigger key={step.id} value={step.title}>
              {step.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ======================================================== */}
        {/* STAGE 1: VERIFIKASI                                      */}
        {/* ======================================================== */}
        <TabsContent value="Verifikasi" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 md:p-5 border border-border bg-card flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-foreground">Stage 1 — Verifikasi Order Baru</h3>
                <p className="text-xs text-muted-foreground">
                  Review informasi order secara komprehensif dan lakukan verifikasi data pemohon
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari order..."
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <Table 
                  containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                  className={cn("w-full min-w-[700px]", filteredOrders.length === 0 && "h-full")}
                >
                  <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="bg-card">Nomor Order</TableHead>
                      <TableHead className="bg-card">Nama Customer</TableHead>
                      <TableHead className="bg-card">Nomor Polisi</TableHead>
                      <TableHead className="bg-card">Jenis Pengurusan</TableHead>
                      <TableHead className="bg-card">Wilayah Samsat</TableHead>
                      <TableHead className="bg-card">Status Pengerjaan</TableHead>
                      <TableHead className="text-right bg-card">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order: any) => (
                        <TableRow key={order.orderNo}>
                          <TableCell className="font-mono text-primary font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{order.orderNo}</span>
                              {Boolean(order.isCancelled || order.currentStageName === "Dibatalkan" || order.status === "Dibatalkan") && (
                                <Badge status="error" className="text-[9px] px-1 py-0 font-sans">
                                  Dibatalkan
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{order.customer}</TableCell>
                          <TableCell className="font-mono tabular-nums">{order.nopol}</TableCell>
                          <TableCell>{order.layanan}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {order.wilayahSamsatAsal} {order.wilayahSamsatTujuan ? `→ ${order.wilayahSamsatTujuan}` : ''}
                          </TableCell>
                          <TableCell>
                            <Badge status={order.currentStep}>Menunggu Verifikasi</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {/* ONE PRIMARY ACTION: Verifikasi (View + Verifikasi Dialog) */}
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => openVerifyWorkspace(order)}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Verifikasi
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      renderEmptyStage("Verifikasi", 7)
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* STAGE 2: PENJADWALAN                                     */}
        {/* ======================================================== */}
        <TabsContent value="Penjadwalan" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 md:p-5 border border-border bg-card flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-foreground">Stage 2 — Penjadwalan Penjemputan</h3>
                <p className="text-xs text-muted-foreground">
                  Atur tanggal jemput dokumen fisik dan tentukan messenger operasional yang bertugas
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari order..."
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <Table 
                  containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                  className={cn("w-full min-w-[750px]", filteredOrders.length === 0 && "h-full")}
                >
                  <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="bg-card">Nomor Order</TableHead>
                      <TableHead className="bg-card">Nama Customer</TableHead>
                      <TableHead className="bg-card">Nomor Polisi</TableHead>
                      <TableHead className="bg-card">Jenis Pengurusan</TableHead>
                      <TableHead className="bg-card">Lokasi Jemput</TableHead>
                      <TableHead className="bg-card">Messenger</TableHead>
                      <TableHead className="bg-card">Jadwal</TableHead>
                      <TableHead className="bg-card">Status Pengerjaan</TableHead>
                      <TableHead className="text-right bg-card">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order: any) => (
                        <TableRow key={order.orderNo}>
                          <TableCell className="font-mono text-primary font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{order.orderNo}</span>
                              {Boolean(order.isCancelled || order.currentStageName === "Dibatalkan" || order.status === "Dibatalkan") && (
                                <Badge status="error" className="text-[9px] px-1 py-0 font-sans">
                                  Dibatalkan
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{order.customer}</TableCell>
                          <TableCell className="font-mono tabular-nums">{order.nopol}</TableCell>
                          <TableCell>{order.layanan}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                            {order.detailAlamatPengambilan}
                          </TableCell>
                          <TableCell>{order.messenger || "--"}</TableCell>
                          <TableCell className="font-mono text-xs">{order.tanggalJemput || "--"}</TableCell>
                          <TableCell>
                            {order.pickupCompleted || order.messengerTaskStatus === "Dokumen Sudah Tersedia" ? (
                              <Badge status="success">Dokumen Sudah Tersedia</Badge>
                            ) : order.messengerTaskStatus === "Sedang Dijemput" ? (
                              <Badge status="info">Sedang Dijemput</Badge>
                            ) : order.isScheduled ? (
                              <Badge status="info">Terjadwal Jemput</Badge>
                            ) : (
                              <Badge status="warning">Belum Dijadwal</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {order.pickupCompleted || order.messengerTaskStatus === "Dokumen Sudah Tersedia" ? (
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                onClick={() => handleAdvanceFromPickup(order)}
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                Lanjut ke Verifikasi Dokumen
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant={order.isScheduled ? "outline" : "default"}
                                className="h-8 gap-1.5"
                                onClick={() => openScheduleWorkspace(order)}
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                {order.isScheduled ? "Ubah Jadwal" : "Jadwalkan"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      renderEmptyStage("Penjadwalan", 9)
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* STAGE 3: VERIFIKASI DOKUMEN                             */}
        {/* ======================================================== */}
        <TabsContent value="Verifikasi Dokumen" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 md:p-5 border border-border bg-card flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-foreground">Stage 3 — Verifikasi Dokumen Fisik</h3>
                <p className="text-xs text-muted-foreground">
                  Validasi berkas yang telah dijemput (STNK, BPKB, KTP Pemilik, SKKP) sebelum diteruskan ke Samsat
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari order..."
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <Table 
                  containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                  className={cn("w-full min-w-[750px]", filteredOrders.length === 0 && "h-full")}
                >
                  <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="bg-card">No Order</TableHead>
                      <TableHead className="bg-card">Nama Customer</TableHead>
                      <TableHead className="bg-card">Nomor Polisi</TableHead>
                      <TableHead className="bg-card">Jenis Pengurusan</TableHead>
                      <TableHead className="bg-card">Messenger</TableHead>
                      <TableHead className="bg-card">Kelengkapan</TableHead>
                      <TableHead className="bg-card">Status</TableHead>
                      <TableHead className="text-right bg-card">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order: any) => (
                        <TableRow key={order.orderNo}>
                          <TableCell className="font-mono text-primary font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{order.orderNo}</span>
                              {Boolean(order.isCancelled || order.currentStageName === "Dibatalkan" || order.status === "Dibatalkan") && (
                                <Badge status="error" className="text-[9px] px-1 py-0 font-sans">
                                  Dibatalkan
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{order.customer}</TableCell>
                          <TableCell className="font-mono tabular-nums">{order.nopol}</TableCell>
                          <TableCell>{order.layanan}</TableCell>
                          <TableCell>{order.messenger}</TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">STNK, BPKB, KTP, SKKP</span>
                            {(order.pickupProof?.notes || order.messengerTaskNotes) && (
                              <p className="text-[10px] text-muted-foreground italic truncate max-w-[140px]" title={order.pickupProof?.notes || order.messengerTaskNotes}>
                                "{order.pickupProof?.notes || order.messengerTaskNotes}"
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge status={order.documentsVerified ? "success" : "warning"}>
                              {order.documentsVerified ? "Terverifikasi" : "Perlu Verifikasi"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {/* ONE PRIMARY ACTION: Verifikasi Dokumen */}
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => openDocVerificationWorkspace(order)}
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              Verifikasi Dokumen
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      renderEmptyStage("Verifikasi Dokumen", 8)
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* STAGE 4: PROSES SAMSAT                                   */}
        {/* ======================================================== */}
        <TabsContent value="Proses Samsat" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 md:p-5 border border-border bg-card flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-foreground">Stage 4 — Proses Samsat</h3>
                <p className="text-xs text-muted-foreground">
                  Pantau dan catat seluruh tahapan mutasi keluar & masuk yang sedang dikerjakan di kantor Samsat
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari order..."
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <Table 
                  containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                  className={cn("w-full min-w-[750px]", filteredOrders.length === 0 && "h-full")}
                >
                  <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="bg-card">No Order</TableHead>
                      <TableHead className="bg-card">Nama Customer</TableHead>
                      <TableHead className="bg-card">Nomor Polisi</TableHead>
                      <TableHead className="bg-card">Jenis Pengurusan</TableHead>
                      <TableHead className="bg-card">Messenger Samsat</TableHead>
                      <TableHead className="bg-card">Wilayah Samsat</TableHead>
                      <TableHead className="bg-card">Status Operasional</TableHead>
                      <TableHead className="text-right bg-card">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order: any) => (
                      <TableRow key={order.orderNo}>
                        <TableCell className="font-mono text-primary font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{order.orderNo}</span>
                            {Boolean(order.isCancelled || order.currentStageName === "Dibatalkan" || order.status === "Dibatalkan") && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans">
                                Dibatalkan
                              </Badge>
                            )}
                            {Boolean(order.isFinancialAnomaly || (order as any).financialAnomalyReason) && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans bg-rose-500/10 text-rose-600 border border-rose-300">
                                Anomali Biaya (S &gt; T)
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{order.customer}</TableCell>
                        <TableCell className="font-mono tabular-nums">{order.nopol}</TableCell>
                        <TableCell>{order.layanan}</TableCell>
                        <TableCell>{order.samsatMessengerNama || order.samsatMessenger || order.messenger || "--"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {order.wilayahSamsatTujuan || order.wilayahSamsatAsal || "--"}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const rawProgress = order.messengerComponentProgress ? Object.values(order.messengerComponentProgress) : [];
                            const waitingComp: any = rawProgress.find((c: any) => c.status === "WAITING");
                            if (waitingComp) {
                              const waitDurationStr = waitingComp.isCustomDuration && waitingComp.customDurationDays
                                ? `${waitingComp.customDurationDays} Hari`
                                : waitingComp.estimatedDurationMinutes
                                  ? (waitingComp.estimatedDurationMinutes >= 60
                                      ? `${Math.floor(waitingComp.estimatedDurationMinutes / 60)} Jam ${waitingComp.estimatedDurationMinutes % 60 > 0 ? (waitingComp.estimatedDurationMinutes % 60) + 'm' : ''}`.trim()
                                      : `${waitingComp.estimatedDurationMinutes} Menit`)
                                  : waitingComp.estimatedCompletedAt
                                    ? `Hingga ${new Date(waitingComp.estimatedCompletedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                                    : "Menunggu";
                              return (
                                <div className="space-y-1">
                                  <Badge status="warning" className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                                    Menunggu ({waitDurationStr})
                                  </Badge>
                                  <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-[160px]" title={waitingComp.waitingReason}>
                                    {waitingComp.name}: {waitingComp.waitingReason || "Antrean"}
                                  </p>
                                </div>
                              );
                            }
                            return order.samsatPickupStatus === "Terkendala" ? (
                              <Badge status="error" className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30">
                                Terkendala Jemput Hasil
                              </Badge>
                            ) : order.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor" ? (
                              <Badge status="success">Dokumen Samsat di Kantor</Badge>
                            ) : order.samsatPickupStatus === "Sedang Jemput Dokumen Samsat" ? (
                              <Badge status="info">Sedang Jemput Hasil</Badge>
                            ) : order.samsatPickupStatus === "Terjadwal Jemput Samsat" ? (
                              <Badge status="info">Terjadwal Jemput Hasil</Badge>
                            ) : order.samsatStatus === "Selesai" ? (
                              <Badge status="warning">Jemput Dokumen dari Samsat</Badge>
                            ) : order.samsatStatus === "Menuju Samsat" ? (
                              <Badge status="info">Menuju Samsat</Badge>
                            ) : (order.samsatSubstatus || order.currentSamsatProcess) ? (
                              <Badge status="info">{order.samsatSubstatus || order.currentSamsatProcess}</Badge>
                            ) : order.samsatStatus === "Sedang Proses Samsat" ? (
                              <Badge status="info">Sedang Proses Samsat</Badge>
                            ) : order.samsatStatus === "Belum Terjadwal" || (!order.isSamsatScheduled && !order.tanggalProsesSamsat) ? (
                              <Badge status="warning">Belum Terjadwal</Badge>
                            ) : order.samsatStatus === "Terjadwal Samsat" || (order.isSamsatScheduled && order.tanggalProsesSamsat) ? (
                              <Badge status="info">Terjadwal Samsat</Badge>
                            ) : (
                              <Badge status="warning">Belum Terjadwal</Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          {order.samsatPickupStatus === "Terkendala" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 border-red-500/40 text-red-600 hover:bg-red-500/10 font-medium"
                              onClick={() => handleRecoverSamsatPickupKendala(order)}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Pulihkan Kendala
                            </Button>
                          ) : order.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor" ? (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                              onClick={() => handleAdvanceFromSamsatResult(order)}
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              Lanjut ke Verifikasi Biaya
                            </Button>
                          ) : order.samsatStatus === "Selesai" && order.samsatPickupStatus !== "Sedang Jemput Dokumen Samsat" && order.samsatPickupStatus !== "Terjadwal Jemput Samsat" ? (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 font-medium"
                              onClick={() => openSamsatPickupModal(order)}
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Tugaskan Jemput Hasil
                            </Button>
                          ) : order.samsatPickupStatus === "Terjadwal Jemput Samsat" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              onClick={() => openSamsatPickupModal(order)}
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Ubah Jemput Hasil
                            </Button>
                          ) : order.samsatStatus !== "Belum Terjadwal" && (order.samsatStatus === "Terjadwal Samsat" || (order.isSamsatScheduled && order.tanggalProsesSamsat)) && order.samsatStatus !== "Menuju Samsat" && order.samsatStatus !== "Sedang Proses Samsat" && !order.samsatSubstatus ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5"
                                onClick={() => openSamsatScheduleModal(order)}
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                Ubah Jadwal
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5"
                                onClick={() => openSamsatProgressWorkspace(order)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Detail
                              </Button>
                            </div>
                          ) : order.samsatStatus === "Menuju Samsat" || order.samsatStatus === "Sedang Proses Samsat" || order.samsatSubstatus || order.samsatPickupStatus === "Sedang Jemput Dokumen Samsat" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              onClick={() => openSamsatProgressWorkspace(order)}
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              Detail Progres
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => openSamsatScheduleModal(order)}
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              Jadwalkan Samsat
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    renderEmptyStage("Proses Samsat", 8)
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </TabsContent>

        {/* ======================================================== */}
        {/* STAGE 5: VERIFIKASI ULANG (ADMIN)                       */}
        {/* ======================================================== */}
        <TabsContent value="Verifikasi Ulang" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 md:p-5 border border-border bg-card flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-foreground">Stage 5 — Verifikasi Ulang Biaya (Admin)</h3>
                <p className="text-xs text-muted-foreground">
                  Admin menginput dan mencocokkan biaya aktual realisasi Samsat dengan referensi harga dasar
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari order..."
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <Table 
                  containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                  className={cn("w-full min-w-[750px]", filteredOrders.length === 0 && "h-full")}
                >
                  <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="bg-card">No Order</TableHead>
                      <TableHead className="bg-card">Nama Customer</TableHead>
                      <TableHead className="bg-card">Nomor Polisi</TableHead>
                      <TableHead className="bg-card">Jenis Pengurusan</TableHead>
                      <TableHead className="text-right bg-card">Estimasi Awal</TableHead>
                      <TableHead className="text-right bg-card">Biaya Aktual</TableHead>
                      <TableHead className="bg-card">Status Biaya</TableHead>
                      <TableHead className="bg-card">Status Pembayaran</TableHead>
                      <TableHead className="text-right bg-card">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order: any) => {
                      const totalEstimasi = (order.biayaJasa || 0) + (order.pkb || 0) + (order.swdkllj || 0) + (order.dendaSwdkllj || 0);
                      const finalTotal = (order.finalBiayaJasa || 0) + (order.finalPkb || 0) + (order.finalSwdkllj || 0) + (order.finalDendaSwdkllj || 0) + (order.finalMutasiKeluar || 0) + (order.finalMutasiMasuk || 0) + (order.finalBiayaLainnya || 0);

                      return (
                        <TableRow key={order.orderNo}>
                          <TableCell className="font-mono text-primary font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{order.orderNo}</span>
                            {Boolean(order.isCancelled || order.currentStageName === "Dibatalkan" || order.status === "Dibatalkan") && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans">
                                Dibatalkan
                              </Badge>
                            )}
                            {Boolean(order.isFinancialAnomaly || (order as any).financialAnomalyReason) && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans bg-rose-500/10 text-rose-600 border border-rose-300">
                                Anomali Biaya (S &gt; T)
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                          <TableCell className="font-medium text-foreground">{order.customer}</TableCell>
                          <TableCell className="font-mono tabular-nums">{order.nopol}</TableCell>
                          <TableCell>{order.layanan}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground">
                            Rp {totalEstimasi.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-xs font-semibold text-foreground">
                            {order.isVerified ? `Rp ${finalTotal.toLocaleString('id-ID')}` : "--"}
                          </TableCell>
                          <TableCell>
                            <Badge status={order.isVerified ? "success" : "warning"}>
                              {order.isVerified ? "Siap Supervisi" : "Input Biaya"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const total = order.payment?.totalBiaya ?? (order.isVerified ? finalTotal : totalEstimasi);
                              const paid = order.payment?.dibayar ?? 0;
                              let status = "Belum Bayar";
                              if (paid > total || order.payment?.settlementCondition === "OVERPAID" || order.payment?.refundStatus === "PENDING") {
                                status = "Kelebihan Bayar";
                              } else if (paid === total && total > 0) {
                                status = "Lunas";
                              } else if (paid > 0 && paid < total) {
                                status = "Kurang Bayar";
                              }

                              return (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  status === "Lunas"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    : status === "Kelebihan Bayar"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                      : status === "Kurang Bayar"
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                }`}>
                                  {status}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            {/* ONE PRIMARY ACTION: Verifikasi Ulang */}
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => openFinalCostWorkspace(order)}
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              Verifikasi Ulang
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    renderEmptyStage("Verifikasi Ulang", 9)
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </TabsContent>

        {/* ======================================================== */}
        {/* STAGE 6: SUPERVISI (SPV)                                */}
        {/* ======================================================== */}
        <TabsContent value="Supervisi" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 md:p-5 border border-border bg-card flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-foreground">Stage 6 — Supervisi & Review SPV</h3>
                <p className="text-xs text-muted-foreground">
                  Supervisor meninjau rincian biaya final, item melebihi harga dasar, dan menyetujui order ke tahap pengantaran
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari order..."
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <Table 
                  containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                  className={cn("w-full min-w-[750px]", filteredOrders.length === 0 && "h-full")}
                >
                  <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="bg-card">No Order</TableHead>
                      <TableHead className="bg-card">Nama Customer</TableHead>
                      <TableHead className="bg-card">Nomor Polisi</TableHead>
                      <TableHead className="bg-card">Jenis Pengurusan</TableHead>
                      <TableHead className="text-right bg-card">Total Biaya / Estimasi</TableHead>
                      <TableHead className="bg-card">Status Harga</TableHead>
                      <TableHead className="bg-card">Status</TableHead>
                      <TableHead className="text-right bg-card">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order: any) => {
                      const finalTotal = (order.finalBiayaJasa || 0) + (order.finalPkb || 0) + (order.finalSwdkllj || 0) + (order.finalDendaSwdkllj || 0) + (order.finalMutasiKeluar || 0) + (order.finalMutasiMasuk || 0) + (order.finalBiayaLainnya || 0);
                      const hasExceeded = order.exceededItems && order.exceededItems.length > 0;

                      return (
                        <TableRow key={order.orderNo}>
                          <TableCell className="font-mono text-primary font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{order.orderNo}</span>
                            {Boolean(order.isCancelled || order.currentStageName === "Dibatalkan" || order.status === "Dibatalkan") && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans">
                                Dibatalkan
                              </Badge>
                            )}
                            {Boolean(order.isFinancialAnomaly || (order as any).financialAnomalyReason) && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans bg-rose-500/10 text-rose-600 border border-rose-300">
                                Anomali Biaya (S &gt; T)
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                          <TableCell className="font-medium text-foreground">{order.customer}</TableCell>
                          <TableCell className="font-mono tabular-nums">{order.nopol}</TableCell>
                          <TableCell>{order.layanan}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-xs font-semibold text-primary">
                            <div className="flex flex-col items-end">
                              <span>Rp {finalTotal.toLocaleString('id-ID')}</span>
                              {(order.costCompletenessStatus === "PARTIAL_ESTIMATE" || !order.isCostVerified) && (
                                <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  Estimasi
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {hasExceeded ? (
                              <Badge status="warning" className="gap-1 text-[11px]">
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                Melebihi Harga Dasar
                              </Badge>
                            ) : (
                              <Badge status="success">Sesuai Standar</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge status="info">Menunggu Approval</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canManage(6) ? (
                              <Button
                                size="sm"
                                className="h-8 gap-1.5"
                                onClick={() => openFinalCostWorkspace(order)}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Supervisi
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                                onClick={() => openFinalCostWorkspace(order)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Lihat Detail
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    renderEmptyStage("Supervisi", 8)
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </TabsContent>

        {/* ======================================================== */}
        {/* STAGE 7: PENGANTARAN                                     */}
        {/* ======================================================== */}
        <TabsContent value="Pengantaran" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 md:p-5 border border-border bg-card flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-foreground">Stage 7 — Pengantaran Dokumen</h3>
                <p className="text-xs text-muted-foreground">
                  Atur jadwal dan tugaskan messenger untuk mengantarkan kembali berkas selesai kepada customer
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari order..."
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <Table 
                  containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                  className={cn("w-full min-w-[750px]", filteredOrders.length === 0 && "h-full")}
                >
                  <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="bg-card">No Order</TableHead>
                      <TableHead className="bg-card">Nama Customer</TableHead>
                      <TableHead className="bg-card">Nomor Polisi</TableHead>
                      <TableHead className="bg-card">Alamat Antar</TableHead>
                      <TableHead className="bg-card">Messenger</TableHead>
                      <TableHead className="bg-card">Tanggal Antar</TableHead>
                      <TableHead className="bg-card">Bukti Serah Terima</TableHead>
                      <TableHead className="bg-card">Status</TableHead>
                      <TableHead className="text-right bg-card">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order: any) => (
                      <TableRow key={order.orderNo}>
                        <TableCell className="font-mono text-primary font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{order.orderNo}</span>
                            {Boolean(order.isCancelled || order.currentStageName === "Dibatalkan" || order.status === "Dibatalkan") && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans">
                                Dibatalkan
                              </Badge>
                            )}
                            {Boolean(order.isFinancialAnomaly || (order as any).financialAnomalyReason) && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans bg-rose-500/10 text-rose-600 border border-rose-300">
                                Anomali Biaya (S &gt; T)
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{order.customer}</TableCell>
                        <TableCell className="font-mono tabular-nums">{order.nopol}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {order.detailAlamatPengembalian}
                        </TableCell>
                        <TableCell>{order.messengerPengantar || order.messenger || "--"}</TableCell>
                        <TableCell className="font-mono text-xs">{order.tanggalPengantaran || "--"}</TableCell>
                        <TableCell>
                          {order.deliveryHandover || order.deliveryProof ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedHandoverOrder(order);
                                setIsHandoverProofModalOpen(true);
                              }}
                              className="h-7 px-2 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                              title="Lihat Bukti Serah Terima"
                            >
                              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Lihat Bukti
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">Belum ada</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.deliveryStatus === "Dokumen Diserahkan" || order.isReceived ? (
                            <Badge status="success">Dokumen Diserahkan</Badge>
                          ) : order.deliveryStatus === "Sedang Diantar" ? (
                            <Badge status="info">Sedang Diantar</Badge>
                          ) : order.isDeliveryScheduled || order.deliveryStatus === "Terjadwal Antar" ? (
                            <Badge status="info">Terjadwal Antar</Badge>
                          ) : (
                            <Badge status="warning">Belum Dijadwal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {order.deliveryStatus === "Dokumen Diserahkan" || order.isReceived ? (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                              onClick={() => handleAdvanceFromDelivery(order)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Selesaikan Order
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant={order.isDeliveryScheduled ? "outline" : "default"}
                              className="h-8 gap-1.5"
                              onClick={() => openDeliveryWorkspace(order)}
                            >
                              <Truck className="w-3.5 h-3.5" />
                              {order.isDeliveryScheduled ? "Ubah Jadwal Antar" : "Atur Pengantaran"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    renderEmptyStage("Pengantaran", 9)
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </TabsContent>

        {/* ======================================================== */}
        {/* STAGE 8: DOKUMEN TELAH DITERIMA (FINAL STAGE)           */}
        {/* ======================================================== */}
        <TabsContent value="Dokumen Telah Diterima" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <Card className="p-4 md:p-5 border border-border bg-card flex-1 flex flex-col min-h-0">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-foreground">Stage 8 — Pengurusan Selesai</h3>
                <p className="text-xs text-muted-foreground">
                  Proses akhir konfirmasi serah terima berkas selesai sebelum order diarsipkan ke Riwayat Order
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari order..."
                    className="pl-9 h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    title="Reset Pencarian"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <Table 
                  containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                  className={cn("w-full min-w-[750px]", filteredOrders.length === 0 && "h-full")}
                >
                  <TableHeader className="sticky top-0 z-10 bg-card border-b border-border shadow-2xs">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="bg-card">No Order</TableHead>
                      <TableHead className="bg-card">Nama Customer</TableHead>
                      <TableHead className="bg-card">Nomor Polisi</TableHead>
                      <TableHead className="bg-card">Jenis Pengurusan</TableHead>
                      <TableHead className="bg-card">Messenger</TableHead>
                      <TableHead className="bg-card">Tanggal Selesai</TableHead>
                      <TableHead className="bg-card">Bukti Serah Terima</TableHead>
                      <TableHead className="text-right bg-card">Total Biaya</TableHead>
                      <TableHead className="bg-card">Status</TableHead>
                      <TableHead className="text-right bg-card">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order: any) => {
                      const finalTotal = (order.finalBiayaJasa || 0) + (order.finalPkb || 0) + (order.finalSwdkllj || 0) + (order.finalDendaSwdkllj || 0) + (order.finalMutasiKeluar || 0) + (order.finalMutasiMasuk || 0) + (order.finalBiayaLainnya || 0);

                      return (
                        <TableRow key={order.orderNo}>
                          <TableCell className="font-mono text-primary font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{order.orderNo}</span>
                            {Boolean(order.isCancelled || order.currentStageName === "Dibatalkan" || order.status === "Dibatalkan") && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans">
                                Dibatalkan
                              </Badge>
                            )}
                            {Boolean(order.isFinancialAnomaly || (order as any).financialAnomalyReason) && (
                              <Badge status="error" className="text-[9px] px-1 py-0 font-sans bg-rose-500/10 text-rose-600 border border-rose-300">
                                Anomali Biaya (S &gt; T)
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                          <TableCell className="font-medium text-foreground">{order.customer}</TableCell>
                          <TableCell className="font-mono tabular-nums">{order.nopol}</TableCell>
                          <TableCell>{order.layanan}</TableCell>
                          <TableCell>{order.messenger}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{order.tanggalDiterima || "2024-11-22"}</TableCell>
                          <TableCell>
                            {order.deliveryHandover || order.deliveryProof ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedHandoverOrder(order);
                                  setIsHandoverProofModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                                title="Lihat Bukti Serah Terima"
                              >
                                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                                Lihat Bukti
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">Belum ada</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Rp {finalTotal.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const total = order.payment?.totalBiaya ?? finalTotal ?? order.totalEstimasi ?? 0;
                              const paid = order.payment?.dibayar ?? 0;
                              let status = "Belum Bayar";
                              if (paid > total || order.payment?.settlementCondition === "OVERPAID" || order.payment?.refundStatus === "PENDING") {
                                status = "Kelebihan Bayar";
                              } else if (paid === total && total > 0) {
                                status = "Lunas";
                              } else if (paid > 0 && paid < total) {
                                status = "Kurang Bayar";
                              }

                              return (
                                <div className="flex flex-col gap-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit ${
                                    status === "Lunas"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                      : status === "Kelebihan Bayar"
                                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                        : status === "Kurang Bayar"
                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                  }`}>
                                    {status}
                                  </span>
                                  {status === "Kurang Bayar" && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                                      Sisa: Rp {Math.max(0, total - paid).toLocaleString('id-ID')}
                                    </span>
                                  )}
                                  {status === "Kelebihan Bayar" && (
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                                      Lebih: Rp {Math.max(0, paid - total).toLocaleString('id-ID')}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            {/* ACTION: Selesai */}
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => openArchiveWorkspace(order)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Selesai
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    renderEmptyStage("Dokumen Telah Diterima", 10)
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </TabsContent>
      </Tabs>

      {/* ======================================================== */}
      {/* 1. OPERATIONAL WORKSPACE: VERIFIKASI (VIEW + VERIFIKASI) */}
      {/* ======================================================== */}
      <Dialog open={isVerifyWorkspaceOpen} onOpenChange={setIsVerifyWorkspaceOpen}>
        <DialogContent className="w-full sm:max-w-2xl lg:max-w-4xl max-h-[90dvh] bg-card text-card-foreground p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge status={1} className="text-xs">
                  Stage 1 — Verifikasi Order Baru
                </Badge>
                <Badge variant="outline" className="text-[11px] font-mono border-primary/30 text-primary bg-primary/5">
                  {selectedOrder?.orderSource || "Offline / Loket"}
                </Badge>
              </div>
              <span className="font-mono text-xs font-semibold text-foreground">{selectedOrder?.nopol}</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground mt-1">
              Verifikasi Order — {selectedOrder?.orderNo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pemohon: <span className="font-medium text-foreground">{selectedOrder?.customer}</span> ({selectedOrder?.nomorHP}) • Layanan: <span className="font-medium text-foreground">{selectedOrder?.layanan}</span> • Petugas Entri: <span className="font-medium text-foreground">{selectedOrder?.createdBy || "Admin"}</span>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 sm:p-5 overflow-y-auto">
            {selectedOrder && (
              <div className="space-y-4 sm:space-y-5 text-xs">
                {/* Estimasi Waktu Penyelesaian Customer vs Status Proses (Requirement #1) */}
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Estimasi Selesai Order:</span>
                    <span className="font-bold text-foreground">
                      {selectedOrder.estimasiSelesaiOrder || selectedOrder.deadlineAt
                        ? new Date(selectedOrder.estimasiSelesaiOrder || selectedOrder.deadlineAt!).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Sesuai estimasi layanan"}
                    </span>
                  </div>
                  <span className="text-border hidden sm:inline">•</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-muted-foreground">Tahap Pengerjaan:</span>
                    <span className="font-semibold text-primary">{selectedOrder.currentStageName}</span>
                  </div>
                  {Boolean(selectedOrder.tanggalSelesaiAktualOrder || selectedOrder.tanggalDiterima) && (
                    <>
                      <span className="text-border hidden sm:inline">•</span>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-muted-foreground">Selesai Aktual:</span>
                        <span className="font-bold text-emerald-600">
                          {selectedOrder.tanggalSelesaiAktualOrder || selectedOrder.tanggalDiterima}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {/* 1. Data Pemilik & Kontak */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5 mb-2.5">
                    <User className="w-4 h-4 text-primary" />
                    Data Pemilik Kendaraan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3.5 rounded-lg bg-muted/30 border border-border">
                    <div>
                      <p className="text-muted-foreground">Nama Pemilik</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.namaPemilik}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nomor Telepon</p>
                      <p className="font-mono text-foreground mt-0.5">{selectedOrder.nomorHP}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status Kepemilikan</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.kepemilikanKendaraan}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Layanan & Kendaraan */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5 mb-2.5">
                    <Car className="w-4 h-4 text-primary" />
                    Detail Layanan & Identitas Kendaraan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg bg-muted/30 border border-border">
                    <div>
                      <p className="text-muted-foreground">Jenis Pengurusan</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.layanan}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nomor Polisi</p>
                      <p className="font-mono text-foreground font-semibold mt-0.5">{selectedOrder.nopol}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Jenis Kendaraan</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.jenisKendaraan}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tahun Pembuatan</p>
                      <p className="font-mono text-foreground mt-0.5">{selectedOrder.tahunKendaraan}</p>
                    </div>
                  </div>
                </div>

                {/* 3. Informasi Pajak & Samsat */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5 mb-2.5">
                    <Shield className="w-4 h-4 text-primary" />
                    Informasi Pajak & Wilayah Samsat
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg bg-muted/30 border border-border">
                    <div>
                      <p className="text-muted-foreground">PKB Berlaku S/D</p>
                      <p className="font-mono text-foreground mt-0.5">{selectedOrder.pkbBerlakuSd || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Periode Pajak</p>
                      <p className="text-foreground mt-0.5">{selectedOrder.bulanPajak} {selectedOrder.tahunPajak}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Samsat Asal</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.wilayahSamsatAsal}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Samsat Tujuan</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.wilayahSamsatTujuan || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* 4. Alamat Jemput & Antar Terstruktur */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5 mb-2.5">
                    <MapPin className="w-4 h-4 text-primary" />
                    Alamat Penjemputan & Pengantaran (Terstruktur)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-lg bg-muted/30 border border-border">
                      <p className="text-muted-foreground font-medium mb-1">Alamat Penjemputan Dokumen</p>
                      {renderAddress(
                        selectedOrder.alamatPenjemputan,
                        selectedOrder.detailAlamatPengambilan,
                        selectedOrder.domisiliPengambilan || selectedOrder.wilayahSamsatAsal
                      )}
                    </div>
                    <div className="p-3.5 rounded-lg bg-muted/30 border border-border">
                      <p className="text-muted-foreground font-medium mb-1">Alamat Pengantaran Dokumen</p>
                      {renderAddress(
                        selectedOrder.alamatPengantaran,
                        selectedOrder.detailAlamatPengembalian,
                        selectedOrder.domisiliPengembalian || selectedOrder.wilayahSamsatTujuan || selectedOrder.wilayahSamsatAsal
                      )}
                    </div>
                  </div>
                </div>

                {/* 5. PAYMENT INFORMATION (AUTHORITATIVE) */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-primary" />
                      Informasi Pembayaran & Status Pelunasan
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs px-2 py-0.5",
                          selectedOrder.payment?.tipePembayaran === "Bayar di Awal"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {selectedOrder.payment?.tipePembayaran || "Bayar di Akhir"}
                      </Badge>
                      <Badge
                        status={selectedOrder.payment?.statusPembayaran === "Lunas" ? "success" : "warning"}
                        className="text-xs px-2 py-0.5"
                      >
                        {selectedOrder.payment?.statusPembayaran || "Belum Lunas"}
                      </Badge>
                    </div>
                  </div>

                  <Card className="p-4 border-border bg-card space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px]">
                            {selectedOrder.costCompletenessStatus === "PARTIAL_ESTIMATE" || !selectedOrder.isCostVerified
                              ? "Total Estimasi Sementara"
                              : "Total Tagihan"}
                          </span>
                          {(selectedOrder.costCompletenessStatus === "PARTIAL_ESTIMATE" || !selectedOrder.isCostVerified) && (
                            <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              Estimasi
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs sm:text-sm font-bold text-foreground mt-0.5">
                          Rp {(selectedOrder.payment?.totalBiaya || selectedOrder.totalEstimasi || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                        <span className="text-muted-foreground text-[11px]">Diinput di Awal</span>
                        <p className="font-mono text-xs sm:text-sm font-semibold text-primary mt-0.5">
                          Rp {(selectedOrder.payment?.nominalDibayarAwal ?? selectedOrder.payment?.dibayar ?? 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                        <span className="text-muted-foreground text-[11px]">Terkonfirmasi</span>
                        <p className="font-mono text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Rp {(selectedOrder.payment?.isPaymentVerified ? (selectedOrder.payment?.nominalPembayaranAwalTerkonfirmasi ?? selectedOrder.payment?.dibayar ?? 0) : 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                        <span className="text-muted-foreground text-[11px]">Sisa Tagihan</span>
                        <p className={cn("font-mono text-xs sm:text-sm font-semibold mt-0.5", (selectedOrder.payment?.kurang || 0) > 0 ? "text-destructive" : "text-emerald-600")}>
                          Rp {(selectedOrder.payment?.kurang || 0).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 col-span-2 sm:col-span-1">
                        <span className="text-muted-foreground text-[11px]">
                          {(selectedOrder.payment?.overpayment || 0) > 0 ? "Kelebihan Bayar" : "Metode Bayar"}
                        </span>
                        <p className="font-medium text-foreground mt-0.5 truncate">
                          {(selectedOrder.payment?.overpayment || 0) > 0
                            ? `Rp ${(selectedOrder.payment?.overpayment || 0).toLocaleString('id-ID')}`
                            : (selectedOrder.payment?.metodePembayaran || "-")}
                        </p>
                      </div>
                    </div>

                    {(selectedOrder.costCompletenessStatus === "PARTIAL_ESTIMATE" || !selectedOrder.isCostVerified) && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Estimasi Biaya Sementara (Menunggu Verifikasi Samsat)</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            Biaya Samsat pada order ini berstatus estimasi sementara. Biaya final akan disahkan setelah berkas diverifikasi di loket Samsat.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* KHUSUS BAYAR DI AWAL: VERIFIKASI & KOREKSI PEMBAYARAN */}
                    {selectedOrder.payment?.tipePembayaran === "Bayar di Awal" ? (
                      <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5 text-primary" />
                            Verifikasi Bukti & Nominal Pembayaran
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                selectedOrder.payment?.isPaymentVerified
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              }`}
                            >
                              {selectedOrder.payment?.isPaymentVerified ? "Terverifikasi" : "Belum Diverifikasi"}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setIsEditingPayment(!isEditingPayment)}
                              className="h-6 text-[11px] px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            >
                              <Edit className="w-3 h-3" />
                              <span>{isEditingPayment ? "Tutup Form" : "Koreksi / Edit Nominal"}</span>
                            </Button>
                          </div>
                        </div>

                        {/* Bukti File Box */}
                        {selectedOrder.payment?.buktiPembayaran?.fileName ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md bg-background/90 border border-primary/20">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                {selectedOrder.payment.buktiPembayaran.fileType === "pdf" ? (
                                  <FileText className="w-5 h-5 text-rose-500" />
                                ) : (
                                  <FileUp className="w-5 h-5 text-primary" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">
                                  {selectedOrder.payment.buktiPembayaran.fileName}
                                </p>
                                <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span className="uppercase font-mono font-medium px-1 rounded bg-muted text-[10px]">
                                    {selectedOrder.payment.buktiPembayaran.fileType}
                                  </span>
                                  {selectedOrder.payment.buktiPembayaran.fileSize && (
                                    <span>• {selectedOrder.payment.buktiPembayaran.fileSize}</span>
                                  )}
                                  {selectedOrder.payment.buktiPembayaran.uploadedAt && (
                                    <span>• Diunggah {new Date(selectedOrder.payment.buktiPembayaran.uploadedAt).toLocaleDateString('id-ID')}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/5"
                                onClick={() =>
                                  handleOpenPreview(
                                    selectedOrder.payment.buktiPembayaran.fileName,
                                    "Bukti Pembayaran",
                                    selectedOrder.payment.buktiPembayaran.fileUrl,
                                    selectedOrder.payment.buktiPembayaran.fileType,
                                    (selectedOrder.payment.buktiPembayaran as any)?.documentId
                                  )
                                }
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{selectedOrder.payment.buktiPembayaran.fileType === "pdf" ? "Buka / View PDF" : "Preview Gambar"}</span>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                              <Info className="w-4 h-4 text-primary shrink-0" />
                              <span>Bukti pembayaran belum dilampirkan (opsional). Anda dapat mengunggah bukti jika tersedia atau langsung memverifikasi nominal di bawah.</span>
                            </div>
                            <label className="cursor-pointer shrink-0">
                              <span className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-muted text-foreground gap-1.5 transition-colors shadow-xs">
                                <Upload className="w-3.5 h-3.5" />
                                Upload Bukti (Opsional)
                              </span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                                className="hidden"
                                onChange={handleUploadStage1Proof}
                              />
                            </label>
                          </div>
                        )}

                        {/* EDIT / VERIFY INTERFACE */}
                        {(isEditingPayment || !selectedOrder.payment?.isPaymentVerified) && (
                          <div className="p-3 rounded-lg border border-primary/20 bg-background space-y-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground flex items-center gap-1.5">
                                <Banknote className="w-3.5 h-3.5 text-primary" />
                                {selectedOrder.payment?.isPaymentVerified ? "Koreksi Nominal Pembayaran Awal" : "Konfirmasi Nominal Pembayaran"}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditPaymentAmount(String(selectedOrder.payment?.totalBiaya || selectedOrder.totalEstimasi || 0))}
                                  className="text-[10px] text-primary hover:underline cursor-pointer"
                                >
                                  Sesuai Tagihan
                                </button>
                                {selectedOrder.payment?.nominalDibayarAwal !== undefined && (
                                  <>
                                    <span className="text-muted-foreground text-[10px]">•</span>
                                    <button
                                      type="button"
                                      onClick={() => setEditPaymentAmount(String(selectedOrder.payment?.nominalDibayarAwal || 0))}
                                      className="text-[10px] text-primary hover:underline cursor-pointer"
                                    >
                                      Sesuai Diinput Klien
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] font-medium text-foreground">
                                Nominal Pembayaran Terkonfirmasi (Rp) <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-xs text-muted-foreground">
                                  Rp
                                </span>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={editPaymentAmount ? Number(editPaymentAmount.replace(/[^0-9]/g, "")).toLocaleString("id-ID") : ""}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                    setEditPaymentAmount(raw);
                                  }}
                                  className="pl-8 bg-background border-border h-8 text-xs font-mono font-bold max-w-sm"
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            {/* Live calculation & diff banner */}
                            {(() => {
                              const currentParsed = parseFloat(editPaymentAmount.replace(/[^0-9]/g, "")) || 0;
                              const prevAmount = selectedOrder.payment?.nominalPembayaranAwalTerkonfirmasi ?? selectedOrder.payment?.nominalDibayarAwal ?? selectedOrder.payment?.dibayar ?? 0;
                              const totalTagihan = selectedOrder.payment?.totalBiaya || selectedOrder.totalEstimasi || 0;
                              const isChanged = currentParsed !== prevAmount;
                              const diffSisa = Math.max(0, totalTagihan - currentParsed);
                              const diffOver = Math.max(0, currentParsed - totalTagihan);

                              return (
                                <div className="space-y-2 pt-1">
                                  {isChanged && (
                                    <div className="p-2 rounded border border-primary/30 bg-primary/10 text-xs flex flex-wrap items-center justify-between gap-1.5">
                                      <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className="text-muted-foreground">Perubahan:</span>
                                        <span className="font-mono line-through text-muted-foreground">
                                          Rp {prevAmount.toLocaleString("id-ID")}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-primary" />
                                        <span className="font-mono font-bold text-foreground">
                                          Rp {currentParsed.toLocaleString("id-ID")}
                                        </span>
                                      </div>
                                      <Badge variant="outline" className="text-[10px] bg-primary/20 text-primary border-primary/30">
                                        Perubahan Belum Disimpan
                                      </Badge>
                                    </div>
                                  )}

                                  <div className="p-2 rounded border border-border bg-muted/40 text-xs flex flex-wrap items-center justify-between gap-2">
                                    {currentParsed < totalTagihan ? (
                                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-[11px]">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                        <span>
                                          Kurang Bayar: Sisa kewajiban Rp {diffSisa.toLocaleString("id-ID")} dicatat di Tagihan & Kurang/Belum Bayar.
                                        </span>
                                      </div>
                                    ) : currentParsed === totalTagihan ? (
                                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-[11px]">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                                        <span>
                                          Lunas Pas: Pembayaran memenuhi 100% total tagihan estimasi (Rp {totalTagihan.toLocaleString("id-ID")}).
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 text-[11px]">
                                        <Info className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                                        <span>
                                          Kelebihan Bayar: Rp {diffOver.toLocaleString("id-ID")}. Dialokasikan ke Cashback Terpending setelah penjemputan berkas selesai.
                                        </span>
                                      </div>
                                    )}

                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={isVerifyingPayment}
                                      onClick={() => handleSavePaymentVerificationAndCorrection()}
                                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 ml-auto"
                                    >
                                      {isVerifyingPayment ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          <span>Menyimpan...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Check className="w-3 h-3" />
                                          <span>{selectedOrder.payment?.isPaymentVerified ? "Simpan Koreksi" : "Verifikasi & Simpan"}</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* STATUS LABEL JIKA SUDAH TERVERIFIKASI & FORM TERTUTUP */}
                        {selectedOrder.payment?.isPaymentVerified && !isEditingPayment && (
                          <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span className="font-medium text-[11px]">
                                Terkonfirmasi Rp {(selectedOrder.payment?.nominalPembayaranAwalTerkonfirmasi ?? selectedOrder.payment?.dibayar ?? 0).toLocaleString('id-ID')} ({selectedOrder.payment.statusPembayaran}) oleh {selectedOrder.payment.paymentVerifiedBy || userName} ({selectedOrder.payment.paymentVerifiedAt ? new Date(selectedOrder.payment.paymentVerifiedAt).toLocaleDateString('id-ID') : "Hari ini"})
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setIsEditingPayment(true)}
                              className="h-7 text-xs text-primary hover:bg-primary/10 gap-1 shrink-0"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Ubah Nominal</span>
                            </Button>
                          </div>
                        )}

                        {/* RIWAYAT KOREKSI PEMBAYARAN (AUDIT TRAIL) */}
                        {selectedOrder.payment?.riwayatKoreksiPembayaran && selectedOrder.payment.riwayatKoreksiPembayaran.length > 0 && (
                          <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2">
                            <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-primary" />
                              Riwayat Koreksi Nominal Pembayaran:
                            </p>
                            <div className="space-y-1.5">
                              {selectedOrder.payment.riwayatKoreksiPembayaran.map((hist: any, hIdx: number) => (
                                <div
                                  key={hIdx}
                                  className="p-2 rounded border border-border/60 bg-background text-[11px] flex flex-wrap items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-muted-foreground line-through">
                                      Rp {(hist.nominalLama || 0).toLocaleString("id-ID")}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-primary" />
                                    <span className="font-mono font-bold text-foreground">
                                      Rp {(hist.nominalBaru || 0).toLocaleString("id-ID")}
                                    </span>
                                    {hist.catatan && (
                                      <span className="text-muted-foreground ml-1.5 italic">({hist.catatan})</span>
                                    )}
                                  </div>
                                  <div className="text-muted-foreground text-[10px] flex items-center gap-1.5">
                                    <span>Oleh <strong className="text-foreground">{hist.admin}</strong></span>
                                    <span>•</span>
                                    <span>{new Date(hist.tanggal).toLocaleString("id-ID")}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-primary shrink-0" />
                        <span>
                          Skema Bayar di Akhir: Pembayaran ditagihkan pada tahap serah terima berkas (Pengantaran/Diterima). Tidak memerlukan bukti pembayaran di Stage 1.
                        </span>
                      </div>
                    )}
                  </Card>
                </div>

                {/* 6. Dokumen Kendaraan Terlampir (Semua Optional) */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-2.5">
                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-primary" />
                      Dokumen Kendaraan yang Dilampirkan Klien
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      (Semua dokumen opsional — tidak memblokir verifikasi order)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { key: 'stnk', label: 'STNK Asli' },
                      { key: 'bpkb', label: 'BPKB Asli' },
                      { key: 'ktp', label: 'KTP Pemilik Asli' },
                      { key: 'skkp', label: 'SKKP (Surat Ketetapan Pajak)' },
                      { key: 'lainnya', label: 'Dokumen Tambahan / Surat Kuasa' },
                    ].map(doc => {
                      const item = selectedOrder.clientDocuments?.[doc.key];
                      const isAvailable = Boolean(item?.name && item?.status !== "Belum Tersedia");
                      const fileName = item?.name;

                      return (
                        <div
                          key={doc.key}
                          className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                              isAvailable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                            )}>
                              {item?.fileType === "pdf" ? <FileIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground text-xs">{doc.label}</p>
                                <Badge status={isAvailable ? "success" : "default"} className="text-[10px] px-1.5 py-0">
                                  {isAvailable ? (item?.status || "Tersedia") : "Belum Tersedia"}
                                </Badge>
                                {item?.fileType && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-border text-muted-foreground uppercase">
                                    {item.fileType}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {fileName ? fileName : "Berkas fisik belum diunggah"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 pl-11 sm:pl-0">
                            {fileName && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    handleOpenPreview(
                                      fileName,
                                      doc.label,
                                      item?.fileUrl,
                                      item?.fileType,
                                      (item as any)?.documentId
                                    )
                                  }
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Preview
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs px-2 gap-1 text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    const updatedDocs = {
                                      ...(selectedOrder.clientDocuments || {}),
                                      [doc.key]: {
                                        name: "",
                                        status: "Belum Tersedia",
                                        isOptional: true,
                                      },
                                    };
                                    updateOrder(selectedOrder.orderNo, { clientDocuments: updatedDocs });
                                    setSelectedOrder({ ...selectedOrder, clientDocuments: updatedDocs });
                                    toast.info(`Lampiran ${doc.label} dihapus.`);
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}

                            <label className="cursor-pointer">
                              <span className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors gap-1">
                                <Upload className="w-3.5 h-3.5" />
                                {fileName ? "Ganti" : "Upload"}
                              </span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                                className="hidden"
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    try {
                                      const processed = await processDocumentUpload(file);
                                      const uploaded = await documentRepository.uploadDocument(processed.file, {
                                        orderNo: selectedOrder.orderNo,
                                        documentType: doc.key,
                                      });
                                      const updatedDocs = {
                                        ...(selectedOrder.clientDocuments || {}),
                                        [doc.key]: {
                                          name: processed.fileName,
                                          status: "Baru Diupload",
                                          updatedAt: new Date().toISOString().split("T")[0],
                                          fileType: processed.fileType === "pdf" ? "pdf" : "image",
                                          fileUrl: uploaded.fileUrl,
                                          documentId: uploaded.id,
                                          fileSize: formatFileSize(processed.fileSize),
                                          isOptional: true,
                                        }
                                      };
                                      updateOrder(selectedOrder.orderNo, { clientDocuments: updatedDocs });
                                      setSelectedOrder({ ...selectedOrder, clientDocuments: updatedDocs });
                                      toast.success(`${doc.label} (${file.name}) berhasil diunggah.`);
                                    } catch (err: any) {
                                      toast.error(err.message || "Gagal mengunggah berkas.");
                                    }
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/10 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              {selectedOrder?.payment?.tipePembayaran === "Bayar di Awal" && !selectedOrder?.payment?.isPaymentVerified && (
                <p className="text-[11px] text-muted-foreground font-medium">
                  Klik "Verifikasi & Lanjut" untuk mengonfirmasi nominal dan melanjutkan order ke tahap berikutnya.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setIsVerifyWorkspaceOpen(false)} className="w-full sm:w-auto">
                Tutup
              </Button>
              <Button
                onClick={handleVerifyOrder}
                className="gap-2 w-full sm:w-auto"
              >
                <CheckCircle className="w-4 h-4" />
                Verifikasi & Lanjut
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* 2. OPERATIONAL WORKSPACE: PENJADWALAN                    */}
      {/* ======================================================== */}
      <Dialog open={isScheduleWorkspaceOpen} onOpenChange={setIsScheduleWorkspaceOpen}>
        <DialogContent className="w-full sm:max-w-2xl lg:max-w-3xl max-h-[90dvh] bg-card text-card-foreground p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <Badge status={2} className="text-xs">
                Stage 2 — Penjadwalan Jemput
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{selectedOrder?.nopol}</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground mt-1">
              Atur Jadwal Penjemputan — {selectedOrder?.orderNo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tinjau konteks lokasi pengambilan dokumen sebelum menugaskan messenger
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 sm:p-5 overflow-y-auto">
            {selectedOrder && (
              <div className="space-y-4 text-xs">
                {/* Order Context Banner */}
                <div className="p-3.5 sm:p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Konteks Order & Lokasi Jemput
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <p className="text-muted-foreground">Nama Customer</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.customer}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{selectedOrder.nomorHP}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Jenis Pengurusan</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.layanan}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Kendaraan & Nomor Polisi</p>
                      <p className="font-mono text-foreground font-semibold mt-0.5">{selectedOrder.nopol}</p>
                      <p className="text-muted-foreground text-[11px]">{selectedOrder.jenisKendaraan} ({selectedOrder.tahunKendaraan})</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Samsat</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.wilayahSamsatAsal}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground font-medium">Alamat Penjemputan Dokumen:</p>
                    <p className="text-foreground font-medium mt-0.5 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{selectedOrder.detailAlamatPengambilan} (Domisili: {selectedOrder.domisiliPengambilan})</span>
                    </p>
                  </div>
                </div>

                {/* Scheduling Fields */}
                <Card className="p-3.5 sm:p-4 border border-border bg-card space-y-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    Konfigurasi Penjemputan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground">Tanggal Jemput Dokumen</Label>
                      <Input
                        type="date"
                        value={scheduleData.tanggalJemput}
                        onChange={(e) => setScheduleData({ ...scheduleData, tanggalJemput: e.target.value })}
                        className="bg-input-background h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground">Tugaskan Messenger</Label>
                      <Select
                        value={scheduleData.messenger}
                        onValueChange={(val) => setScheduleData({ ...scheduleData, messenger: val })}
                      >
                        <SelectTrigger className="bg-input-background h-9 text-xs">
                          <SelectValue placeholder="Pilih Messenger Penjemput..." />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          {activeMessengers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-muted-foreground">
                              Tidak ada messenger aktif tersedia
                            </div>
                          ) : (
                            activeMessengers.map((m) => (
                              <SelectItem key={m.id || m.nama} value={m.nama} className="text-xs">
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span className="font-medium text-foreground">{m.nama}</span>
                                  <span className="text-[11px] text-muted-foreground font-mono">{m.id}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground">Catatan Penjemputan (Opsional)</Label>
                    <Input
                      placeholder="Contoh: Jemput dokumen sebelum jam 12 siang, hubungi satpam komplek"
                      value={scheduleData.catatanPenjadwalan}
                      onChange={(e) => setScheduleData({ ...scheduleData, catatanPenjadwalan: e.target.value })}
                      className="bg-input-background h-9 text-xs"
                    />
                  </div>
                </Card>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsScheduleWorkspaceOpen(false)} disabled={isAdvancing} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button variant="secondary" onClick={handleSaveScheduleOnly} disabled={isAdvancing} className="gap-1.5 w-full sm:w-auto font-medium">
              <Calendar className="w-4 h-4" />
              Simpan Jadwal
            </Button>
            <Button onClick={handleSaveScheduleAndAdvance} disabled={isAdvancing} className="gap-1.5 w-full sm:w-auto font-medium bg-primary text-primary-foreground">
              <ArrowRight className="w-4 h-4" />
              Simpan Jadwal & Lanjut ke Verifikasi Dokumen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* 3. OPERATIONAL WORKSPACE: VERIFIKASI DOKUMEN             */}
      {/* ======================================================== */}
      <Dialog open={isDocVerificationWorkspaceOpen} onOpenChange={setIsDocVerificationWorkspaceOpen}>
        <DialogContent className="w-full sm:max-w-2xl lg:max-w-3xl max-h-[90dvh] bg-card text-card-foreground p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <Badge status={3} className="text-xs">
                Stage 3 — Verifikasi Dokumen Fisik
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{selectedOrder?.nopol}</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground mt-1">
              Verifikasi & Upload Dokumen — {selectedOrder?.orderNo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pastikan berkas fisik yang diterima lengkap, terbaca jelas, dan siap diproses ke Samsat
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 sm:p-5 overflow-y-auto">
            {selectedOrder && (
              <div className="space-y-5 text-xs">
                {/* Context Strip */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{selectedOrder.customer}</p>
                      <p className="text-[11px] text-muted-foreground">{selectedOrder.layanan} • {selectedOrder.nopol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-[11px]">Messenger Penjemput</p>
                    <p className="font-medium text-foreground">{selectedOrder.messenger || "Belum Ditugaskan"}</p>
                  </div>
                </div>

                {/* Laporan Lapangan Messenger */}
                {(selectedOrder.pickupProof || selectedOrder.messengerTaskNotes) && (
                  <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2 text-xs">
                    {(selectedOrder.pickupProof?.notes || selectedOrder.messengerTaskNotes || selectedOrder.pickupProof?.photoProofUrl) && (
                      <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5" />
                            Catatan & Bukti dari Messenger ({selectedOrder.messenger || "Messenger"}):
                          </span>
                          {selectedOrder.pickupProof?.completedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(selectedOrder.pickupProof.completedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                            </span>
                          )}
                        </div>
                        {(selectedOrder.pickupProof?.notes || selectedOrder.messengerTaskNotes) && (
                          <p className="italic bg-card/60 p-2 rounded border border-border/50 text-foreground">
                            "{selectedOrder.pickupProof?.notes || selectedOrder.messengerTaskNotes}"
                          </p>
                        )}
                        {selectedOrder.pickupProof?.photoProofUrl && (
                          <div className="flex items-center gap-2 pt-1">
                            <img
                              src={selectedOrder.pickupProof.photoProofUrl}
                              alt="Bukti Penjemputan"
                              className="w-12 h-12 object-cover rounded-md border border-border"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleOpenPreview("Bukti Penjemputan", "Foto Bukti Penjemputan Messenger", selectedOrder.pickupProof?.photoProofUrl, "image")}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Lihat Foto Bukti Jemput
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Section Dokumen Wajib */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    Dokumen Wajib
                  </h4>

                  {[
                    { key: 'stnk', label: 'STNK Asli' },
                    { key: 'bpkb', label: 'BPKB Asli' },
                    { key: 'ktp', label: 'KTP Pemilik Asli' },
                  ].map((doc) => {
                    const item = docState[doc.key] || { name: "", status: "Belum Tersedia" };
                    const isAvailable = item.status === "Sudah Tersedia" || item.status === "Baru Diupload" || item.status === "Diperbarui";

                    return (
                      <div
                        key={doc.key}
                        className="p-3.5 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                            isAvailable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                          )}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground text-xs">{doc.label}</p>
                              <Badge status={isAvailable ? "success" : "warning"} className="text-[10px] px-1.5 py-0">
                                {item.status}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {item.name ? item.name : "Berkas fisik belum diunggah"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.name && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                handleOpenPreview(
                                  item.name,
                                  doc.label,
                                  item.fileUrl,
                                  item.fileType || (item.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image")
                                );
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Preview
                            </Button>
                          )}
                          <label className="cursor-pointer">
                            <span className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors gap-1">
                              <Upload className="w-3.5 h-3.5" />
                              {item.name ? "Ganti File" : "Upload File"}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleDocUpload(doc.key, doc.label, e.target.files[0]);
                                  e.target.value = "";
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Section Dokumen Opsional */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    Dokumen Opsional / Tambahan
                  </h4>

                  {[
                    { key: 'skkp', label: 'SKKP (Surat Ketetapan Kewajiban Pembayaran)' },
                    { key: 'lainnya', label: 'Dokumen Lainnya (Surat Kuasa / Faktur / Kwitansi)' },
                  ].map((doc) => {
                    const item = docState[doc.key] || { name: "", status: "Belum Tersedia" };
                    const isAvailable = item.status === "Sudah Tersedia" || item.status === "Baru Diupload" || item.status === "Diperbarui";

                    return (
                      <div
                        key={doc.key}
                        className="p-3.5 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                            isAvailable ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground text-xs">{doc.label}</p>
                              <Badge status={isAvailable ? "success" : "neutral"} className="text-[10px] px-1.5 py-0">
                                {item.status}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {item.name ? item.name : "Opsional jika dibutuhkan"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.name && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                handleOpenPreview(
                                  item.name,
                                  doc.label,
                                  item.fileUrl,
                                  item.fileType || (item.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image")
                                );
                              }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Preview
                            </Button>
                          )}
                          <label className="cursor-pointer">
                            <span className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors gap-1">
                              <Upload className="w-3.5 h-3.5" />
                              {item.name ? "Ganti" : "Upload"}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleDocUpload(doc.key, doc.label, e.target.files[0]);
                                  e.target.value = "";
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDocVerificationWorkspaceOpen(false)} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button onClick={handleVerifyDocuments} className="gap-2 w-full sm:w-auto">
              <CheckCircle className="w-4 h-4" />
              Verifikasi & Lanjut ke Samsat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* 4. OPERATIONAL WORKSPACE: PROSES SAMSAT                  */}
      {/* ======================================================== */}
      <Dialog open={isSamsatProgressDialogOpen} onOpenChange={setIsSamsatProgressDialogOpen}>
        <DialogContent className="w-full sm:max-w-2xl lg:max-w-4xl max-h-[90dvh] bg-card text-card-foreground p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <Badge status={4} className="text-xs">
                Stage 4 — Proses Samsat (Progress Tracking)
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{selectedOrder?.nopol}</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground mt-1">
              Tracking Real-time Proses Samsat — {selectedOrder?.orderNo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Status tahapan dipantau langsung dari operasional messenger di kantor Samsat (View-Only)
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 sm:p-5 overflow-y-auto">
            {selectedOrder && (() => {
              const rawProgress = selectedOrder.messengerComponentProgress ? Object.values(selectedOrder.messengerComponentProgress) : [];
              const processes: any[] = rawProgress.length > 0
                ? rawProgress.map((c: any) => ({
                    id: c.componentId,
                    name: c.name,
                    category: c.category || "Komponen Samsat",
                    status: c.status === "COMPLETED" ? "Selesai" : c.status === "IN_PROGRESS" ? "Sedang Diproses" : c.status === "WAITING" ? "Menunggu" : "Belum Diproses",
                    completedAt: c.completedAt,
                    basePrice: c.masterPrice || c.nominal || 0,
                    actualCost: c.actualOrderPrice || c.nominal || 0,
                    waitingReason: c.waitingReason,
                    estimatedDurationMinutes: c.estimatedDurationMinutes,
                    isCustomDuration: c.isCustomDuration,
                    customDurationDays: c.customDurationDays,
                    estimatedCompletedAt: c.estimatedCompletedAt,
                  }))
                : (selectedOrder.samsatProcesses && selectedOrder.samsatProcesses.length > 0 ? selectedOrder.samsatProcesses : []);

              const completedProcesses = processes.filter((p: any) => p.status === "Selesai");
              const inProgressProcess = processes.find((p: any) => p.status === "Sedang Diproses");
              const waitingProcesses = processes.filter((p: any) => p.status === "Menunggu");
              const pendingProcesses = processes.filter((p: any) => p.status === "Belum Diproses");
              const completionPercent = processes.length > 0 ? Math.round((completedProcesses.length / processes.length) * 100) : 0;

              const formatWaitDuration = (proc: any) => {
                if (proc.isCustomDuration && proc.customDurationDays) {
                  return `${proc.customDurationDays} Hari`;
                }
                if (proc.estimatedDurationMinutes) {
                  const mins = Number(proc.estimatedDurationMinutes);
                  if (mins >= 1440) {
                    const days = Math.floor(mins / 1440);
                    return `${days} Hari`;
                  }
                  if (mins >= 60) {
                    const hours = Math.floor(mins / 60);
                    const remMins = mins % 60;
                    return remMins > 0 ? `${hours} Jam ${remMins} Menit` : `${hours} Jam`;
                  }
                  return `${mins} Menit`;
                }
                if (proc.estimatedCompletedAt) {
                  try {
                    const d = new Date(proc.estimatedCompletedAt);
                    return `Hingga ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
                  } catch {
                    return "Durasi menunggu aktif";
                  }
                }
                return "Durasi belum ditentukan";
              };

              return (
                <div className="space-y-4 sm:space-y-5 text-xs">
                  {/* Context & Estimasi Awal */}
                  <div className="p-3.5 sm:p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <p className="text-muted-foreground">Nama Customer</p>
                        <p className="font-medium text-foreground mt-0.5">{selectedOrder.customer}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Nomor Polisi</p>
                        <p className="font-mono text-foreground font-semibold mt-0.5">{selectedOrder.nopol}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Jenis Pengurusan</p>
                        <p className="font-medium text-foreground mt-0.5">{selectedOrder.layanan}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Petugas Messenger</p>
                        <p className="font-medium text-primary mt-0.5">{selectedOrder.samsatMessengerNama || selectedOrder.samsatMessenger || selectedOrder.messenger || "Belum ditugaskan"}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Progress Bar & Counter */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-foreground">
                          Progress Keseluruhan: {completedProcesses.length} dari {processes.length} Tahapan Selesai
                        </span>
                        <span className="font-mono font-semibold text-primary">{completionPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Catatan Instruksi Samsat & Laporan Messenger */}
                  {(selectedOrder.catatanSamsat || selectedOrder.messengerTaskNotes || selectedOrder.samsatPickupNotes) && (
                    <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-2 text-xs">
                      {selectedOrder.catatanSamsat && (
                        <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200">
                          <span className="font-semibold block text-[11px] text-blue-700 dark:text-blue-300">
                            Instruksi Samsat dari Admin Kantor:
                          </span>
                          <p className="mt-0.5 whitespace-pre-wrap">{selectedOrder.catatanSamsat}</p>
                        </div>
                      )}
                      {(selectedOrder.samsatPickupNotes || selectedOrder.messengerTaskNotes) && (
                        <div className="p-2.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200">
                          <span className="font-semibold block text-[11px] text-purple-700 dark:text-purple-300">
                            Catatan Lapangan dari Messenger Samsat:
                          </span>
                          <p className="mt-0.5 whitespace-pre-wrap italic">"{selectedOrder.samsatPickupNotes || selectedOrder.messengerTaskNotes}"</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Highlight Biaya Tambahan Dilaporkan Messenger */}
                  {selectedOrder.additionalProcesses && selectedOrder.additionalProcesses.length > 0 && (
                    <Card className="p-3.5 bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          Proses & Biaya Tambahan Dilaporkan Messenger ({selectedOrder.additionalProcesses.length})
                        </span>
                        <Badge status="warning" className="text-[10px]">DILAPORKAN_MENUNGGU_REVIEW</Badge>
                      </div>
                      <div className="space-y-1.5">
                        {selectedOrder.additionalProcesses.map((ap: any) => (
                          <div
                            key={ap.id}
                            className="p-2.5 rounded-md bg-background/80 border border-border flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-medium text-foreground">{ap.name}</p>
                              {ap.notes && <p className="text-[11px] text-muted-foreground">{ap.notes}</p>}
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Dilaporkan: {ap.reportedAt || "-"}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                                Rp {Number(ap.estimatedCost || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Highlight Tahapan Sedang Menunggu (WAITING) */}
                  {waitingProcesses.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                          Tahapan Menunggu Proses Samsat ({waitingProcesses.length})
                        </h4>
                        <Badge status="warning" className="text-[10px]">MENUNGGU / TERTUNDA</Badge>
                      </div>
                      <div className="space-y-2">
                        {waitingProcesses.map((proc: any) => (
                          <Card
                            key={proc.id}
                            className="p-3.5 bg-amber-500/10 border border-amber-500/30 space-y-2.5 text-xs text-left"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                <span className="font-bold text-foreground text-xs sm:text-sm">{proc.name}</span>
                                {proc.category && (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                    {proc.category}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge className="bg-amber-600 text-white font-semibold text-[10px] px-2.5 py-0.5">
                                  Durasi Menunggu: {formatWaitDuration(proc)}
                                </Badge>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-lg bg-background/80 border border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-[10px] text-muted-foreground block font-medium">Estimasi Waktu Selesai:</span>
                                <span className="font-semibold text-foreground">
                                  {proc.estimatedCompletedAt ? (
                                    `${new Date(proc.estimatedCompletedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB (${new Date(proc.estimatedCompletedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})`
                                  ) : (
                                    `Durasi: ${formatWaitDuration(proc)}`
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground block font-medium">Alasan Menunggu (Laporan Lapangan):</span>
                                <span className="font-medium text-amber-900 dark:text-amber-200">
                                  {proc.waitingReason || "Tidak ada catatan khusus"}
                                </span>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Highlight Tahapan Sedang Berjalan */}
                  {inProgressProcess ? (
                    <Card className="p-3.5 bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 animate-pulse">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Sedang Diproses Saat Ini:</p>
                          <p className="text-sm font-semibold text-foreground">
                            {inProgressProcess.category} — {inProgressProcess.name}
                          </p>
                        </div>
                      </div>
                      <Badge status="info" className="shrink-0 animate-pulse">
                        In Progress
                      </Badge>
                    </Card>
                  ) : processes.length === 0 ? (
                    <Card className="p-3 bg-muted/20 border border-border flex items-center gap-2">
                      <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-muted-foreground text-xs">
                        Tidak ada komponen loket Samsat khusus pada order ini. Messenger dapat menambahkan biaya atau komponen lapangan jika diperlukan.
                      </span>
                    </Card>
                  ) : completedProcesses.length === processes.length ? (
                    <Card className="p-3 bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-medium text-foreground text-xs">
                        Seluruh proses Samsat pada berkas ini telah tuntas diselesaikan oleh messenger!
                      </span>
                    </Card>
                  ) : null}

                  {/* 1. Tahapan yang Sudah Selesai (Di Posisi Paling Atas dengan Checkmark) */}
                  <div className="space-y-2.5">
                    <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Tahapan Samsat Selesai ({completedProcesses.length})
                      </span>
                      <span className="text-[11px] text-muted-foreground font-normal">Diurutkan teratas</span>
                    </h4>

                    {completedProcesses.length > 0 ? (
                      <div className="space-y-1.5">
                        {completedProcesses.map((proc: any) => (
                          <div
                            key={proc.id}
                            className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3" />
                              </div>
                              <div>
                                <span className="font-semibold text-foreground">{proc.name}</span>
                                <span className="text-[11px] text-muted-foreground ml-2">({proc.category})</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                              {proc.completedAt && (
                                <span className="text-muted-foreground">Pukul {proc.completedAt} WIB</span>
                              )}
                              <Badge status="success">Selesai</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs italic p-3 bg-muted/20 rounded border border-border">
                        Belum ada tahapan yang diselesaikan.
                      </p>
                    )}
                  </div>

                  {/* 2. Tahapan Berikutnya / Menunggu */}
                  {pendingProcesses.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Tahapan Menunggu Antrean Loket ({pendingProcesses.length})
                      </h4>
                      <div className="space-y-1.5">
                        {pendingProcesses.map((proc: any) => (
                          <div
                            key={proc.id}
                            className="p-3 rounded-lg border border-border bg-muted/10 flex items-center justify-between text-xs opacity-70"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-5 h-5 rounded-full border border-muted-foreground/30 flex items-center justify-center shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                              </div>
                              <div>
                                <span className="font-medium text-foreground">{proc.name}</span>
                                <span className="text-[11px] text-muted-foreground ml-2">({proc.category})</span>
                              </div>
                            </div>
                            <Badge status="neutral" className="text-[10px]">
                              Menunggu
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </ScrollArea>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setIsSamsatProgressDialogOpen(false)} className="w-full sm:w-auto">
              Tutup
            </Button>
            {canManage(4) && selectedOrder?.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor" && (
              <Button onClick={handleAdvanceFromSamsat} className="gap-2 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                <ArrowRight className="w-4 h-4" />
                Lanjut ke Verifikasi Biaya Final
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* 4a. OPERATIONAL WORKSPACE: JADWALKAN PROSES SAMSAT      */}
      {/* ======================================================== */}
      <Dialog open={isSamsatScheduleModalOpen} onOpenChange={setIsSamsatScheduleModalOpen}>
        <DialogContent className="w-full sm:max-w-2xl lg:max-w-3xl max-h-[90dvh] bg-card text-card-foreground p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <Badge status={4} className="text-xs">
                Stage 4 — Penjadwalan Proses Samsat
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{selectedOrder?.nopol}</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground mt-1">
              Jadwalkan Proses Samsat — {selectedOrder?.orderNo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tentukan tanggal mulai proses dan pilih messenger yang bertanggung jawab di kantor Samsat
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 sm:p-5 overflow-y-auto">
            {selectedOrder && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 sm:p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Konteks Order & Samsat Tujuan
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <p className="text-muted-foreground">Nama Customer</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.customer}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{selectedOrder.nomorHP}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Jenis Pengurusan</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.layanan}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Kendaraan & Nomor Polisi</p>
                      <p className="font-mono text-foreground font-semibold mt-0.5">{selectedOrder.nopol}</p>
                      <p className="text-muted-foreground text-[11px]">{selectedOrder.jenisKendaraan} ({selectedOrder.tahunKendaraan})</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Wilayah Samsat</p>
                      <p className="font-medium text-foreground mt-0.5">
                        {selectedOrder.wilayahSamsatAsal} {selectedOrder.wilayahSamsatTujuan ? `→ ${selectedOrder.wilayahSamsatTujuan}` : ""}
                      </p>
                    </div>
                  </div>
                </div>

                <Card className="p-3.5 sm:p-4 border border-border bg-card space-y-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    Konfigurasi Penugasan Samsat
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground">Tanggal Mulai Proses Samsat</Label>
                      <Input
                        type="date"
                        value={samsatScheduleData.tanggalProsesSamsat}
                        onChange={(e) => setSamsatScheduleData({ ...samsatScheduleData, tanggalProsesSamsat: e.target.value })}
                        className="bg-input-background h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground">Tugaskan Messenger Samsat</Label>
                      <Select
                        value={samsatScheduleData.samsatMessenger}
                        onValueChange={(val) => setSamsatScheduleData({ ...samsatScheduleData, samsatMessenger: val })}
                      >
                        <SelectTrigger className="bg-input-background h-9 text-xs">
                          <SelectValue placeholder="Pilih Messenger Samsat..." />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          {activeMessengers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-muted-foreground">
                              Tidak ada messenger aktif tersedia
                            </div>
                          ) : (
                            activeMessengers.map((m) => (
                              <SelectItem key={m.id || m.nama} value={m.nama} className="text-xs">
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span className="font-medium text-foreground">{m.nama}</span>
                                  <span className="text-[11px] text-muted-foreground font-mono">{m.id}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground">Catatan / Instruksi Samsat (Opsional)</Label>
                    <Input
                      placeholder="Contoh: Utamakan antrean loket mutasi pagi hari, cek blokir dahulu"
                      value={samsatScheduleData.catatanSamsat}
                      onChange={(e) => setSamsatScheduleData({ ...samsatScheduleData, catatanSamsat: e.target.value })}
                      className="bg-input-background h-9 text-xs"
                    />
                  </div>
                </Card>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsSamsatScheduleModalOpen(false)} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button onClick={handleSaveSamsatSchedule} className="gap-1.5 w-full sm:w-auto font-medium">
              <Calendar className="w-4 h-4" />
              Simpan Jadwal Samsat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* 4b. OPERATIONAL WORKSPACE: PENUGASAN JEMPUT HASIL SAMSAT */}
      {/* ======================================================== */}
      <Dialog open={isSamsatPickupModalOpen} onOpenChange={setIsSamsatPickupModalOpen}>
        <DialogContent className="w-full sm:max-w-2xl lg:max-w-3xl max-h-[90dvh] bg-card text-card-foreground p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <Badge status={4} className="text-xs">
                Stage 4 — Penjemputan Dokumen Hasil Samsat
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{selectedOrder?.nopol}</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground mt-1">
              Tugaskan Penjemputan Hasil Samsat — {selectedOrder?.orderNo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tugaskan messenger untuk mengambil berkas jadi di Samsat dan menyerahkannya ke kantor
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 sm:p-5 overflow-y-auto">
            {selectedOrder && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 sm:p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Konteks Order & Lokasi Samsat
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <p className="text-muted-foreground">Nama Customer</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.customer}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Jenis Pengurusan</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.layanan}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Kendaraan & Plat</p>
                      <p className="font-mono text-foreground font-semibold mt-0.5">{selectedOrder.nopol}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lokasi Samsat</p>
                      <p className="font-medium text-foreground mt-0.5">
                        {selectedOrder.wilayahSamsatTujuan || selectedOrder.wilayahSamsatAsal || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <Card className="p-3.5 sm:p-4 border border-border bg-card space-y-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-primary" />
                    Penugasan Penjemput Hasil Samsat
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground">Tanggal Penjemputan Hasil</Label>
                      <Input
                        type="date"
                        value={samsatPickupData.samsatPickupDate}
                        onChange={(e) => setSamsatPickupData({ ...samsatPickupData, samsatPickupDate: e.target.value })}
                        className="bg-input-background h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground">Tugaskan Messenger Penjemput</Label>
                      <Select
                        value={samsatPickupData.samsatPickupMessenger}
                        onValueChange={(val) => setSamsatPickupData({ ...samsatPickupData, samsatPickupMessenger: val })}
                      >
                        <SelectTrigger className="bg-input-background h-9 text-xs">
                          <SelectValue placeholder="Pilih Messenger..." />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          {activeMessengers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-muted-foreground">
                              Tidak ada messenger aktif tersedia
                            </div>
                          ) : (
                            activeMessengers.map((m) => (
                              <SelectItem key={m.id || m.nama} value={m.nama} className="text-xs">
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span className="font-medium text-foreground">{m.nama}</span>
                                  <span className="text-[11px] text-muted-foreground font-mono">{m.id}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-foreground">Catatan / Instruksi Pengambilan (Opsional)</Label>
                    <Input
                      placeholder="Contoh: Ambil berkas di loket penyerahan, pastikan notice pajak asli tercetak"
                      value={samsatPickupData.samsatPickupNotes}
                      onChange={(e) => setSamsatPickupData({ ...samsatPickupData, samsatPickupNotes: e.target.value })}
                      className="bg-input-background h-9 text-xs"
                    />
                  </div>
                </Card>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsSamsatPickupModalOpen(false)} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button onClick={handleSaveSamsatPickupAssignment} className="gap-1.5 w-full sm:w-auto font-medium">
              <Truck className="w-4 h-4" />
              Tugaskan Messenger Jemput Hasil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* 5 & 6. OPERATIONAL WORKSPACE: VERIFIKASI ULANG & SUPERVISI */}
      {/* ======================================================== */}
      <Dialog open={isFinalCostDialogOpen} onOpenChange={setIsFinalCostDialogOpen}>
        <DialogContent className="w-full sm:max-w-3xl lg:max-w-5xl max-h-[90dvh] bg-card text-card-foreground p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <Badge status={currentTab === "Supervisi" ? 6 : 5} className="text-xs">
                {currentTab === "Supervisi" ? "Stage 6 — Supervisi (SPV)" : "Stage 5 — Verifikasi Ulang Biaya Final (Admin)"}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{selectedOrder?.nopol}</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground mt-1">
              {currentTab === "Supervisi" ? "Review & Supervisi Biaya" : "Verifikasi Ulang Biaya Final"} — {selectedOrder?.orderNo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Nama Customer: <span className="font-medium text-foreground">{selectedOrder?.customer}</span> • Jenis Pengurusan: <span className="font-medium text-foreground">{selectedOrder?.layanan}</span>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 sm:p-5 overflow-y-auto">
            {selectedOrder && (() => {
              const isMutasiKeluar = selectedOrder.layanan?.includes("Mutasi Keluar") ||
                selectedOrder.layanan?.includes("Luar Daerah") ||
                parseFloat(finalCostData.finalMutasiKeluar || "0") > 0 ||
                Object.keys(hargaDasarMutasiKeluar).some(k => parseFloat(finalCostData[k] || "0") > 0);

              const isMutasiMasuk = selectedOrder.layanan?.includes("Mutasi Masuk") ||
                selectedOrder.layanan?.includes("Antar Samsat") ||
                parseFloat(finalCostData.finalMutasiMasuk || "0") > 0 ||
                Object.keys(hargaDasarMutasiMasuk).some(k => parseFloat(finalCostData[k] || "0") > 0);

              return (
                <div className="space-y-5 text-xs">
                  {/* Mode Banner & Toggle Button */}
                  <div className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border gap-3",
                    isEditingFinalCost ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/30 border-border"
                  )}>
                    <div className="flex items-center gap-2.5">
                      {isEditingFinalCost && (
                        <Badge status="warning" className="text-xs shrink-0">
                          Mode: Edit Biaya
                        </Badge>
                      )}
                      <p className="text-xs text-foreground/80">
                        {isEditingFinalCost
                          ? "Anda dapat mengubah nominal atau menambahkan item biaya yang terlewat."
                          : "Tinjau rincian biaya realisasi Samsat. Klik tombol Edit jika ada penyesuaian biaya."}
                      </p>
                    </div>

                    {(currentTab !== "Supervisi" || canManage(6) || canEditVerified) && (
                      <div className="shrink-0 flex items-center gap-2">
                        {isEditingFinalCost ? (
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-medium"
                            onClick={() => {
                              setIsEditingFinalCost(false);
                              toast.success("Mode edit ditutup. Perubahan biaya telah diperbarui di tampilan.");
                            }}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Selesai Edit
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs font-medium"
                            onClick={() => setIsEditingFinalCost(true)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit / Sesuaikan Biaya
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 1. Rincian Seluruh Komponen Estimasi Awal vs Biaya Final Aktual */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-primary" />
                        Rincian Estimasi Awal & Biaya Final ({editableBreakdown.length} Komponen)
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {isEditingFinalCost ? "Ubah nilai nominal pada kolom Biaya Aktual di bawah" : "Menampilkan seluruh rincian estimasi awal & biaya aktual"}
                      </span>
                    </div>

                    <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/60">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-2 p-2.5 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="col-span-5 sm:col-span-5">Komponen / Rincian Biaya</div>
                        <div className="col-span-2 sm:col-span-2 text-center">Kategori</div>
                        <div className="col-span-2 sm:col-span-2 text-right">Estimasi Awal</div>
                        <div className="col-span-3 sm:col-span-3 text-right">Biaya Final Aktual</div>
                      </div>

                      {/* Rows */}
                      {editableBreakdown.length > 0 ? (
                        editableBreakdown.map((item) => {
                          const actualVal = item.actualCost !== undefined ? Number(item.actualCost) : Number(item.amount || 0);
                          const diff = actualVal - Number(item.amount || 0);
                          return (
                            <div key={item.itemId} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-muted/10 transition-colors text-xs">
                              <div className="col-span-5 sm:col-span-5 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.code && (
                                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-semibold">
                                      {item.code}
                                    </span>
                                  )}
                                  <span className="font-semibold text-foreground">{item.name}</span>
                                </div>
                                {item.notes && <p className="text-[10px] text-muted-foreground">{item.notes}</p>}
                              </div>

                              <div className="col-span-2 sm:col-span-2 text-center">
                                <Badge variant="outline" className={cn(
                                  "text-[10px] font-medium",
                                  item.category === "Pajak" && "bg-blue-500/10 text-blue-600 border-blue-200",
                                  item.category === "Samsat" && "bg-purple-500/10 text-purple-600 border-purple-200",
                                  item.category === "Jasa" && "bg-emerald-500/10 text-emerald-600 border-emerald-200",
                                  item.category === "Operasional" && "bg-amber-500/10 text-amber-600 border-amber-200",
                                )}>
                                  {item.category}
                                </Badge>
                              </div>

                              <div className="col-span-2 sm:col-span-2 text-right font-mono text-muted-foreground text-xs tabular-nums">
                                Rp {Number(item.amount || 0).toLocaleString('id-ID')}
                              </div>

                              <div className="col-span-3 sm:col-span-3 text-right">
                                {isEditingFinalCost ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <Input
                                      type="number"
                                      value={item.actualCost !== undefined ? item.actualCost : item.amount}
                                      onChange={(e) => handleBreakdownActualCostChange(item.itemId, e.target.value)}
                                      className="bg-input-background h-8 w-32 sm:w-36 text-right font-mono text-xs tabular-nums font-semibold"
                                      placeholder="0"
                                    />
                                    {diff !== 0 && (
                                      <span className={cn(
                                        "text-[10px] font-medium font-mono",
                                        diff > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                                      )}>
                                        {diff > 0 ? `+Rp ${diff.toLocaleString('id-ID')}` : `-Rp ${Math.abs(diff).toLocaleString('id-ID')}`}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="font-mono font-bold text-foreground text-xs sm:text-sm tabular-nums">
                                      Rp {actualVal.toLocaleString('id-ID')}
                                    </span>
                                    {diff !== 0 && (
                                      <span className={cn(
                                        "text-[10px] font-medium font-mono",
                                        diff > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                                      )}>
                                        {diff > 0 ? `+Rp ${diff.toLocaleString('id-ID')}` : `-Rp ${Math.abs(diff).toLocaleString('id-ID')}`}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-muted-foreground text-xs">
                          Tidak ada rincian komponen breakdown.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Biaya Tambahan Operasional */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                      Biaya Tambahan Operasional
                    </h4>

                    <div className="rounded-lg border border-border bg-card divide-y divide-border">
                      {/* Mutasi Keluar */}
                      <div className="p-3 space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground text-xs">Mutasi Keluar</p>
                            <p className="text-[11px] text-muted-foreground">
                              {finalCostData.keteranganMutasiKeluar || "Biaya administrasi pencabutan berkas mutasi keluar"}
                            </p>
                          </div>
                          <div className="sm:text-right shrink-0">
                            {isEditingFinalCost ? (
                              <Input
                                type="number"
                                value={finalCostData.finalMutasiKeluar}
                                onChange={(e) => setFinalCostData({ ...finalCostData, finalMutasiKeluar: e.target.value })}
                                className="bg-input-background h-8 w-44 text-right font-mono text-xs tabular-nums"
                                placeholder="0"
                              />
                            ) : (
                              <p className="font-mono font-semibold text-xs sm:text-sm text-foreground tabular-nums text-right">
                                Rp {(parseFloat(finalCostData.finalMutasiKeluar || "0")).toLocaleString('id-ID')}
                              </p>
                            )}
                          </div>
                        </div>
                        {isEditingFinalCost && (
                          <Input
                            placeholder="Catatan / keterangan mutasi keluar..."
                            value={finalCostData.keteranganMutasiKeluar}
                            onChange={(e) => setFinalCostData({ ...finalCostData, keteranganMutasiKeluar: e.target.value })}
                            className="bg-input-background h-7 text-[11px] max-w-md"
                          />
                        )}
                      </div>

                      {/* Mutasi Masuk */}
                      <div className="p-3 space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground text-xs">Mutasi Masuk</p>
                            <p className="text-[11px] text-muted-foreground">
                              {finalCostData.keteranganMutasiMasuk || "Biaya administrasi pendaftaran berkas mutasi masuk"}
                            </p>
                          </div>
                          <div className="sm:text-right shrink-0">
                            {isEditingFinalCost ? (
                              <Input
                                type="number"
                                value={finalCostData.finalMutasiMasuk}
                                onChange={(e) => setFinalCostData({ ...finalCostData, finalMutasiMasuk: e.target.value })}
                                className="bg-input-background h-8 w-44 text-right font-mono text-xs tabular-nums"
                                placeholder="0"
                              />
                            ) : (
                              <p className="font-mono font-semibold text-xs sm:text-sm text-foreground tabular-nums text-right">
                                Rp {(parseFloat(finalCostData.finalMutasiMasuk || "0")).toLocaleString('id-ID')}
                              </p>
                            )}
                          </div>
                        </div>
                        {isEditingFinalCost && (
                          <Input
                            placeholder="Catatan / keterangan mutasi masuk..."
                            value={finalCostData.keteranganMutasiMasuk}
                            onChange={(e) => setFinalCostData({ ...finalCostData, keteranganMutasiMasuk: e.target.value })}
                            className="bg-input-background h-7 text-[11px] max-w-md"
                          />
                        )}
                      </div>

                      {/* Biaya Lainnya */}
                      <div className="p-3 space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground text-xs">Biaya Lainnya</p>
                            <p className="text-[11px] text-muted-foreground">
                              {finalCostData.keteranganBiayaLainnya || "Biaya operasional lapangan atau administrasi tambahan"}
                            </p>
                          </div>
                          <div className="sm:text-right shrink-0">
                            {isEditingFinalCost ? (
                              <Input
                                type="number"
                                value={finalCostData.finalBiayaLainnya}
                                onChange={(e) => setFinalCostData({ ...finalCostData, finalBiayaLainnya: e.target.value })}
                                className="bg-input-background h-8 w-44 text-right font-mono text-xs tabular-nums"
                                placeholder="0"
                              />
                            ) : (
                              <p className="font-mono font-semibold text-xs sm:text-sm text-foreground tabular-nums text-right">
                                Rp {(parseFloat(finalCostData.finalBiayaLainnya || "0")).toLocaleString('id-ID')}
                              </p>
                            )}
                          </div>
                        </div>
                        {isEditingFinalCost && (
                          <Input
                            placeholder="Catatan / keterangan biaya lainnya..."
                            value={finalCostData.keteranganBiayaLainnya}
                            onChange={(e) => setFinalCostData({ ...finalCostData, keteranganBiayaLainnya: e.target.value })}
                            className="bg-input-background h-7 text-[11px] max-w-md"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. Rincian Item Mutasi yang Relevan (Filtered by Service) */}
                  {(isMutasiKeluar || isMutasiMasuk) && (
                    <div className="space-y-4">
                      {isMutasiKeluar && (
                        <div className="rounded-xl border border-destructive/20 bg-destructive/5 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setShowMutasiKeluar(!showMutasiKeluar)}
                            className="w-full flex items-center justify-between p-3.5 hover:bg-destructive/10 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-destructive" />
                              <span className="font-semibold text-xs text-foreground">Rincian Item Mutasi Keluar</span>
                              <span className="text-[11px] text-muted-foreground">• Referensi Harga Dasar</span>
                            </div>
                            {showMutasiKeluar ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </button>

                          {showMutasiKeluar && (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 border-t border-destructive/10 bg-card">
                              {Object.keys(hargaDasarMutasiKeluar).map((key) => {
                                const label = key.replace('mutasiKeluar', '').replace(/([A-Z])/g, ' $1').trim();
                                const basePrice = hargaDasarMutasiKeluar[key];
                                const currentVal = parseFloat(finalCostData[key] || "0");
                                const exceeds = currentVal > basePrice;

                                if (!isEditingFinalCost) {
                                  if (currentVal <= 0) return null;
                                  return (
                                    <div key={key} className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-1">
                                      <p className="font-medium text-foreground text-xs">{label}</p>
                                      <p className="font-mono text-xs font-semibold">Rp {currentVal.toLocaleString('id-ID')}</p>
                                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>Dasar: Rp {basePrice.toLocaleString('id-ID')}</span>
                                        {exceeds && (
                                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                                            +Rp {(currentVal - basePrice).toLocaleString('id-ID')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <MutasiCostField
                                    key={key}
                                    label={label}
                                    value={finalCostData[key] || ""}
                                    basePrice={basePrice}
                                    onChange={(val) => handleMutasiKeluarItemChange(key, val)}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {isMutasiMasuk && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setShowMutasiMasuk(!showMutasiMasuk)}
                            className="w-full flex items-center justify-between p-3.5 hover:bg-emerald-500/10 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="font-semibold text-xs text-foreground">Rincian Item Mutasi Masuk</span>
                              <span className="text-[11px] text-muted-foreground">• Referensi Harga Dasar</span>
                            </div>
                            {showMutasiMasuk ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </button>

                          {showMutasiMasuk && (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 border-t border-emerald-500/10 bg-card">
                              {Object.keys(hargaDasarMutasiMasuk).map((key) => {
                                const label = key.replace('mutasiMasuk', '').replace(/([A-Z])/g, ' $1').trim();
                                const basePrice = hargaDasarMutasiMasuk[key];
                                const currentVal = parseFloat(finalCostData[key] || "0");
                                const exceeds = currentVal > basePrice;

                                if (!isEditingFinalCost) {
                                  if (currentVal <= 0) return null;
                                  return (
                                    <div key={key} className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-1">
                                      <p className="font-medium text-foreground text-xs">{label}</p>
                                      <p className="font-mono text-xs font-semibold">Rp {currentVal.toLocaleString('id-ID')}</p>
                                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>Dasar: Rp {basePrice.toLocaleString('id-ID')}</span>
                                        {exceeds && (
                                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                                            +Rp {(currentVal - basePrice).toLocaleString('id-ID')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <MutasiCostField
                                    key={key}
                                    label={label}
                                    value={finalCostData[key] || ""}
                                    basePrice={basePrice}
                                    onChange={(val) => handleMutasiMasukItemChange(key, val)}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Biaya Tambahan Dilaporkan Messenger (Lapangan) */}
                  {selectedOrder.additionalProcesses && selectedOrder.additionalProcesses.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          Biaya Tambahan Dilaporkan Messenger ({selectedOrder.additionalProcesses.length})
                        </h4>
                        <Badge status="warning" className="text-[10px]">DILAPORKAN_MENUNGGU_REVIEW</Badge>
                      </div>
                      <div className="space-y-1.5">
                        {selectedOrder.additionalProcesses.map((ap: any) => (
                          <div
                            key={ap.id}
                            className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-foreground">{ap.name}</span>
                              {ap.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{ap.notes}</p>}
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Dilaporkan: {ap.reportedAt || "-"}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400 text-xs sm:text-sm">
                                Rp {Number(ap.estimatedCost || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Item Biaya Kustom (+ Tambah Item yang Terlewat) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 text-primary" />
                        Item Biaya Tambahan yang Terlewat ({customCostItems.length})
                      </h4>
                    </div>

                    {customCostItems.length > 0 && (
                      <div className="space-y-2">
                        {customCostItems.map((item) => {
                          const diff = item.actualCost - item.basePrice;
                          return (
                            <div
                              key={item.id}
                              className="p-3 rounded-lg border border-border bg-card flex items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <span className="font-medium text-foreground">{item.name}</span>
                                <Badge status="neutral" className="ml-2 text-[10px]">{item.category}</Badge>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  Harga Dasar: Rp {item.basePrice.toLocaleString('id-ID')}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <span className="font-mono font-semibold text-foreground">
                                    Rp {item.actualCost.toLocaleString('id-ID')}
                                  </span>
                                  {diff > 0 && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                      +Rp {diff.toLocaleString('id-ID')}
                                    </p>
                                  )}
                                </div>
                                {isEditingFinalCost && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                    onClick={() => setCustomCostItems(prev => prev.filter(c => c.id !== item.id))}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isEditingFinalCost && (
                      <Card className="p-3.5 bg-muted/20 border-dashed border border-border space-y-3">
                        <p className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-primary" />
                          Tambah Item Biaya Terlewat
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          <Input
                            placeholder="Nama item biaya..."
                            value={newCostItemName}
                            onChange={(e) => setNewCostItemName(e.target.value)}
                            className="bg-input-background h-8 text-xs sm:col-span-1"
                          />
                          <Select
                            value={newCostItemCategory}
                            onValueChange={(val: any) => setNewCostItemCategory(val)}
                          >
                            <SelectTrigger className="bg-input-background h-8 text-xs">
                              <SelectValue placeholder="Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Mutasi Keluar" className="text-xs">Mutasi Keluar</SelectItem>
                              <SelectItem value="Mutasi Masuk" className="text-xs">Mutasi Masuk</SelectItem>
                              <SelectItem value="Lainnya" className="text-xs">Lainnya</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="Biaya Aktual (Rp)"
                            value={newCostItemAmount}
                            onChange={(e) => setNewCostItemAmount(e.target.value)}
                            className="bg-input-background h-8 text-xs font-mono"
                          />
                          <Input
                            type="number"
                            placeholder="Harga Dasar (Rp)"
                            value={newCostItemBasePrice}
                            onChange={(e) => setNewCostItemBasePrice(e.target.value)}
                            className="bg-input-background h-8 text-xs font-mono"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => {
                            if (!newCostItemName.trim()) {
                              toast.error("Nama item biaya wajib diisi!");
                              return;
                            }
                            const amount = parseFloat(newCostItemAmount || "0");
                            const base = parseFloat(newCostItemBasePrice || "0");
                            const newItem: CustomCostItem = {
                              id: `custom-${Date.now()}`,
                              name: newCostItemName.trim(),
                              category: newCostItemCategory,
                              actualCost: amount,
                              basePrice: base,
                            };
                            setCustomCostItems(prev => [...prev, newItem]);
                            setNewCostItemName("");
                            setNewCostItemAmount("");
                            setNewCostItemBasePrice("");
                            toast.success(`Item "${newItem.name}" ditambahkan.`);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Tambah Item Biaya
                        </Button>
                      </Card>
                    )}
                  </div>

                  {/* 5. Total Biaya Final & Financial Reconciliation Card */}
                  {(() => {
                    const totalFinal = calculateTotalFinal();
                    const totalEstimasiAwal = selectedOrder.costSnapshot?.totalEstimasi || selectedOrder.totalEstimasi || 0;
                    const paid = selectedOrder.payment?.dibayar || 0;
                    const diff = totalFinal - paid;
                    const isBalanced = diff === 0;
                    const isUnderpaid = diff > 0;
                    const isOverpaid = diff < 0;
                    const overpaidAmt = Math.abs(diff);

                    return (
                      <Card className="p-4 sm:p-5 bg-muted/40 border border-border space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                              REKONSILIASI BIAYA
                            </span>
                          </div>
                          {isBalanced && (
                            <Badge status="success" className="text-[11px] px-2.5 py-0.5 font-semibold">
                              BALANCED (Lunas)
                            </Badge>
                          )}
                          {isUnderpaid && (
                            <Badge status="warning" className="text-[11px] px-2.5 py-0.5 font-semibold">
                              UNDERPAID (Kurang Bayar)
                            </Badge>
                          )}
                          {isOverpaid && (
                            <Badge status="info" className="text-[11px] px-2.5 py-0.5 font-semibold">
                              OVERPAID (Lebih Bayar)
                            </Badge>
                          )}
                        </div>

                        {/* Financial Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="p-2.5 rounded-lg bg-card border border-border">
                            <span className="text-[10px] text-muted-foreground block font-medium">Estimasi Awal</span>
                            <span className="font-mono font-semibold text-foreground text-xs sm:text-sm">
                              Rp {totalEstimasiAwal.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-card border border-border">
                            <span className="text-[10px] text-muted-foreground block font-medium">Total Terbayar (Paid)</span>
                            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                              Rp {paid.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-card border border-border">
                            <span className="text-[10px] text-muted-foreground block font-medium">Total Biaya Final</span>
                            <span className="font-mono font-bold text-primary text-xs sm:text-sm">
                              Rp {totalFinal.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-card border border-border">
                            <span className="text-[10px] text-muted-foreground block font-medium">Selisih Rekonsiliasi</span>
                            <span className={`font-mono font-bold text-xs sm:text-sm ${
                              isUnderpaid ? 'text-amber-600 dark:text-amber-400' : isOverpaid ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {isUnderpaid ? `+ Rp ${diff.toLocaleString('id-ID')} (Kurang)` : isOverpaid ? `- Rp ${overpaidAmt.toLocaleString('id-ID')} (Lebih)` : 'Rp 0 (Pas)'}
                            </span>
                          </div>
                        </div>

                        {/* Distinct Case Presentation (Sections 3 & 4) */}
                        {isBalanced && (
                          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-800 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                              <div>
                                <p className="font-semibold text-foreground">Final Cost = Paid (Rp {totalFinal.toLocaleString('id-ID')})</p>
                                <p className="text-[11px] opacity-90 mt-0.5">
                                  Pembayaran awal sesuai dengan realisasi biaya final. Status: <strong>LUNAS / BALANCED</strong>.
                                </p>
                              </div>
                            </div>
                            <Badge status="success" className="text-[10px] font-bold shrink-0 self-start sm:self-center">
                              LUNAS / BALANCED
                            </Badge>
                          </div>
                        )}

                        {isUnderpaid && (
                          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                                <div>
                                  <p className="font-semibold">Kurang Bayar (Outstanding): Rp {diff.toLocaleString('id-ID')}</p>
                                  <p className="text-[11px] opacity-90 mt-0.5">
                                    Final Cost: <strong>Rp {totalFinal.toLocaleString('id-ID')}</strong> • Paid: <strong>Rp {paid.toLocaleString('id-ID')}</strong> • Outstanding: <strong>Rp {diff.toLocaleString('id-ID')}</strong>
                                  </p>
                                </div>
                              </div>
                              <Badge status="warning" className="text-[10px] font-bold shrink-0 self-start sm:self-center">
                                KURANG BAYAR
                              </Badge>
                            </div>

                            <p className="text-[10px] text-muted-foreground">
                              * Sisa kewajiban pembayaran otomatis tercatat di menu <strong>Tagihan</strong> dengan status Belum Jatuh Tempo selama alur berlangsung.
                            </p>
                          </div>
                        )}

                        {isOverpaid && (
                          <div className="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-xs text-blue-900 dark:text-blue-200 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                                <div>
                                  <p className="font-semibold">Kelebihan Pembayaran (Overpayment): Rp {overpaidAmt.toLocaleString('id-ID')}</p>
                                  <p className="text-[11px] opacity-90 mt-0.5">
                                    Paid: <strong>Rp {paid.toLocaleString('id-ID')}</strong> • Final Cost: <strong>Rp {totalFinal.toLocaleString('id-ID')}</strong> • Overpayment: <strong>Rp {overpaidAmt.toLocaleString('id-ID')}</strong>
                                  </p>
                                </div>
                              </div>
                              <Badge status="info" className="text-[10px] font-bold shrink-0 self-start sm:self-center">
                                STATUS REFUND: {selectedOrder.payment?.refundStatus || "PENDING"}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-blue-700 dark:text-blue-300 italic">
                              * Kelebihan pembayaran dicatat sebagai hak pengembalian (liabilitas refund) bagi customer dan tidak dihitung sebagai omzet/profit kantor.
                            </p>
                          </div>
                        )}
                      </Card>
                    );
                  })()}

                  {/* Field Input Alasan / Sumber Status Pembayaran (Diteruskan ke Finance) */}
                  <Card className="p-3.5 border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>Alasan / Sumber Status Pembayaran</span>
                        <span className="text-destructive">*</span>
                      </Label>
                      <span className="text-[10px] text-muted-foreground italic">
                        Diteruskan ke Belum & Kurang Bayar atau Cashback Terpending
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={finalCostAlasan}
                      onChange={(e) => setFinalCostAlasan(e.target.value)}
                      placeholder="Masukkan alasan atau sumber status pembayaran..."
                      className="w-full p-2.5 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-normal resize-none"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-muted-foreground font-medium">Rekomendasi Cepat:</span>
                      <button
                        type="button"
                        onClick={() => setFinalCostAlasan("Masih terdapat sisa tagihan yang belum dibayar")}
                        className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                      >
                        Kurang Bayar
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinalCostAlasan("Terdapat kelebihan pembayaran konsumen yang perlu dikembalikan")}
                        className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                      >
                        Kelebihan Bayar
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinalCostAlasan("Pembayaran belum diterima dari customer")}
                        className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                      >
                        Belum Bayar
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinalCostAlasan("Pembayaran telah lunas")}
                        className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                      >
                        Lunas
                      </button>
                    </div>
                  </Card>

                  {/* 6. Section Dokumen Terpisah: Dokumen Klien VS Dokumen Terbaru */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      Pemisahan Dokumen Order
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* SECTION 1: Dokumen dari Klien */}
                      <Card className="p-3.5 border border-border bg-card space-y-2.5">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            1. Dokumen dari Klien
                          </span>
                          <Badge status="neutral" className="text-[10px]">Asli / Masuk</Badge>
                        </div>
                        <div className="space-y-1.5">
                          {[
                            { key: 'stnk', label: 'STNK Asli' },
                            { key: 'bpkb', label: 'BPKB Asli' },
                            { key: 'ktp', label: 'KTP Pemilik Asli' },
                            { key: 'skkp', label: 'SKKP (Surat Ketetapan Pajak)' },
                            { key: 'lainnya', label: 'Dokumen Tambahan / Surat Kuasa' },
                          ].map((d) => {
                            const doc = selectedOrder.clientDocuments?.[d.key];
                            const docName = doc?.name || `${d.key}.pdf`;
                            return (
                              <div key={d.key} className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-[11px] text-foreground font-medium truncate">{d.label}</span>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[11px] gap-1 px-2 shrink-0"
                                  onClick={() => {
                                    handleOpenPreview(
                                      docName,
                                      d.label,
                                      doc?.fileUrl,
                                      doc?.fileType || (docName.toLowerCase().endsWith(".pdf") ? "pdf" : "image"),
                                      doc?.documentId
                                    );
                                  }}
                                >
                                  <Eye className="w-3 h-3 text-primary" />
                                  Lihat
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </Card>

                      {/* SECTION 2: Dokumen Terbaru & Bukti Hasil Samsat */}
                      <Card className="p-3.5 border border-border bg-card space-y-2.5">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            2. Dokumen Baru / Hasil Samsat ({uploadedNewDocs.length})
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenUploadNewDocModal("SUPERVISI")}
                            className="h-6 px-2.5 rounded text-[11px] font-semibold border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 gap-1.5 shadow-2xs"
                          >
                            <Upload className="w-3 h-3" />
                            Upload Dokumen Baru
                          </Button>
                        </div>

                        <div className="space-y-1.5 min-h-[60px]">
                          {uploadedNewDocs.length > 0 ? (
                            uploadedNewDocs.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-emerald-500/5 border border-emerald-500/20 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-[11px] text-foreground font-medium truncate block">{doc.name}</span>
                                    {doc.fileSize && <span className="text-[9px] text-muted-foreground block">{doc.fileSize}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[11px] gap-1 px-2"
                                    onClick={() => {
                                      handleOpenPreview(
                                        doc.name,
                                        "Dokumen Hasil Samsat",
                                        doc.fileUrl,
                                        doc.fileType,
                                        doc.id
                                      );
                                    }}
                                  >
                                    <Eye className="w-3 h-3 text-primary" />
                                    Lihat
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                    onClick={() => handleRemoveUploadedDoc(doc.id)}
                                    title="Hapus Dokumen"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center text-muted-foreground text-xs border border-dashed rounded-lg bg-muted/10 space-y-1">
                              <p className="text-[11px]">Belum ada dokumen baru atau hasil Samsat diunggah.</p>
                              <p className="text-[10px] opacity-80">Klik tombol <strong>Upload Dokumen Baru</strong> di atas untuk melampirkan Notice Pajak, STNK baru, atau Kuitansi.</p>
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* 7. Section Persetujuan Keabsahan Dokumen (Stage 5 & Stage 6) */}
                  <Card className="p-4 border border-border bg-card space-y-3.5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">
                            Persetujuan Kelengkapan & Keabsahan Dokumen
                          </h4>
                          <p className="text-[11px] text-muted-foreground">
                            Dokumen harus disetujui secara eksplisit sebelum order dapat dilanjutkan ke tahap berikutnya.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentTab !== "Supervisi" ? (
                          isStage5DocApproved ? (
                            <Badge status="success" className="text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Dokumen Stage 5 Terverifikasi
                            </Badge>
                          ) : (
                            <Badge status="warning" className="text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Belum Diverifikasi (Stage 5)
                            </Badge>
                          )
                        ) : (
                          isStage6DocApproved ? (
                            <Badge status="success" className="text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Supervisi Dokumen Disetujui
                            </Badge>
                          ) : (
                            <Badge status="warning" className="text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Menunggu Persetujuan Supervisor
                            </Badge>
                          )
                        )}
                      </div>
                    </div>

                    {/* Detailed Approval Status & Controls */}
                    {currentTab !== "Supervisi" ? (
                      // Stage 5 Document Approval Controls
                      <div className="space-y-3 text-xs">
                        {isStage5DocApproved ? (
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 space-y-1 text-emerald-900 dark:text-emerald-200">
                            <div className="flex items-center gap-2 font-medium">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span>Keabsahan dokumen fisik dan hasil Samsat telah disetujui oleh {docApprovalDetails.stage5VerifiedBy || "Admin"}.</span>
                            </div>
                            {docApprovalDetails.stage5VerifiedAt && (
                              <p className="text-[11px] text-muted-foreground pl-6">
                                Waktu persetujuan: {new Date(docApprovalDetails.stage5VerifiedAt).toLocaleString("id-ID")}
                              </p>
                            )}
                            {docApprovalDetails.stage5Notes && (
                              <p className="text-[11px] text-foreground/90 pl-6 italic">
                                Catatan: &quot;{docApprovalDetails.stage5Notes}&quot;
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 space-y-2.5">
                            <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <p className="text-xs">
                                Pastikan berkas fisik asli klien (STNK/BPKB/KTP) dan dokumen hasil Samsat (Notice Pajak baru, STNK baru) telah diperiksa keabsahannya.
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-medium text-foreground">Catatan Verifikasi Dokumen (Opsional):</Label>
                              <Input
                                value={docApprovalNoteInput}
                                onChange={(e) => setDocApprovalNoteInput(e.target.value)}
                                placeholder="Contoh: Seluruh berkas fisik asli dan notice pajak baru valid..."
                                className="h-8 text-xs bg-background"
                              />
                            </div>
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleApproveStage5Documents}
                                disabled={isSubmittingApproval}
                                className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {isSubmittingApproval ? "Menyimpan..." : "Setujui Dokumen (Stage 5)"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Stage 6 Document Approval Controls
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-2.5 rounded border border-border bg-muted/20">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Verifikasi Stage 5 (Admin Loket)</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              {isStage5DocApproved ? (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                    Disetujui ({docApprovalDetails.stage5VerifiedBy || "Admin"})
                                  </span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Belum Disetujui</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="p-2.5 rounded border border-border bg-muted/20">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Supervisi Stage 6 (Supervisor)</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              {isStage6DocApproved ? (
                                <>
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                    Disetujui ({docApprovalDetails.stage6ApprovedBy || "SPV"})
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Menunggu Review SPV</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isStage6DocApproved ? (
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 space-y-1 text-emerald-900 dark:text-emerald-200">
                            <div className="flex items-center gap-2 font-medium">
                              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span>Supervisi dokumen telah disetujui oleh {docApprovalDetails.stage6ApprovedBy || "Supervisor"}.</span>
                            </div>
                            {docApprovalDetails.stage6ApprovedAt && (
                              <p className="text-[11px] text-muted-foreground pl-6">
                                Waktu persetujuan: {new Date(docApprovalDetails.stage6ApprovedAt).toLocaleString("id-ID")}
                              </p>
                            )}
                            {docApprovalDetails.stage6Notes && (
                              <p className="text-[11px] text-foreground/90 pl-6 italic">
                                Catatan SPV: &quot;{docApprovalDetails.stage6Notes}&quot;
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 space-y-2.5">
                            <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <p className="text-xs">
                                Dokumen memerlukan persetujuan eksplisit dari Supervisor / SVP sebelum order dapat dilanjutkan ke tahap Pengantaran.
                              </p>
                            </div>
                            {canManage(6) ? (
                              <>
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-medium text-foreground">Catatan Supervisor (Opsional):</Label>
                                  <Input
                                    value={docApprovalNoteInput}
                                    onChange={(e) => setDocApprovalNoteInput(e.target.value)}
                                    placeholder="Contoh: Dokumen lengkap dan sah sesuai standar operasional..."
                                    className="h-8 text-xs bg-background"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleApproveStage6Documents}
                                    disabled={isSubmittingApproval}
                                    className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    {isSubmittingApproval ? "Menyimpan..." : "Setujui Dokumen (Supervisor Stage 6)"}
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <p className="text-[11px] text-muted-foreground italic">
                                * Anda login sebagai Admin Operasional. Hanya Supervisor atau Administrator yang dapat menyetujui dokumen tahap ini.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </div>
              );
            })()}
          </ScrollArea>

          <DialogFooter className="p-4 border-t border-border bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2">
            <Button variant="outline" onClick={() => setIsFinalCostDialogOpen(false)} disabled={isSubmittingFinalCost} className="w-full sm:w-auto">
              {currentTab === "Supervisi" && !canManage(6) ? "Tutup" : "Batal"}
            </Button>
            {currentTab === "Supervisi" ? (
              canManage(6) ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {!isStage6DocApproved && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Setujui dokumen SPV terlebih dahulu
                    </span>
                  )}
                  <Button 
                    onClick={() => handleSaveFinalCost(true)} 
                    disabled={isSubmittingFinalCost || !isStage6DocApproved}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isSubmittingFinalCost ? "Memproses..." : "Approve Supervisi & Lanjut ke Pengantaran"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Mode Tinjauan: Approval supervisi hanya dapat dilakukan oleh Supervisor / SVP</span>
                </div>
              )
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {!isStage5DocApproved && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Setujui dokumen terlebih dahulu
                  </span>
                )}
                <Button 
                  onClick={() => handleSaveFinalCost(false)} 
                  disabled={isSubmittingFinalCost || !isStage5DocApproved}
                  className="gap-2 w-full sm:w-auto font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isSubmittingFinalCost ? "Menyimpan..." : "Simpan Rekonsiliasi"}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* 7. OPERATIONAL WORKSPACE: PENGANTARAN                     */}
      {/* ======================================================== */}
      <Dialog open={isDeliveryWorkspaceOpen} onOpenChange={setIsDeliveryWorkspaceOpen}>
        <DialogContent className="w-full sm:max-w-2xl lg:max-w-3xl max-h-[90dvh] bg-card text-card-foreground p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <Badge status={7} className="text-xs">
                Stage 7 — Pengantaran Dokumen
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{selectedOrder?.nopol}</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground mt-1">
              Atur Pengantaran Dokumen — {selectedOrder?.orderNo}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Konfirmasi alamat pengembalian berkas dan jadwalkan messenger pengantar
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 sm:p-5 overflow-y-auto">
            {selectedOrder && (
              <div className="space-y-4 text-xs">
                {/* Context Card */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Konteks Order & Alamat Pengantaran Dokumen
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <p className="text-muted-foreground">Penerima Dokumen</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.customer}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{selectedOrder.nomorHP || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Jenis Pengurusan</p>
                      <p className="font-medium text-foreground mt-0.5">{selectedOrder.layanan}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Kendaraan & Nomor Polisi</p>
                      <p className="font-mono text-foreground font-semibold mt-0.5">{selectedOrder.nopol}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Tagihan Final</p>
                      <p className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                        Rp {((selectedOrder.finalBiayaJasa || 0) + (selectedOrder.finalPkb || 0) + (selectedOrder.finalSwdkllj || 0) + (selectedOrder.finalDendaSwdkllj || 0) + (selectedOrder.finalMutasiKeluar || 0) + (selectedOrder.finalMutasiMasuk || 0) + (selectedOrder.finalBiayaLainnya || 0)).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground font-semibold flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      Alamat Pengantaran Dokumen:
                    </p>
                    <div className="pl-5">
                      {renderAddress(
                        selectedOrder.alamatPengantaran,
                        selectedOrder.detailAlamatPengembalian,
                        selectedOrder.domisiliPengembalian
                      )}
                    </div>
                  </div>
                </div>

                {/* Bukti Serah Terima Yang Sudah Ada (Jika Tersedia) */}
                {(selectedOrder.deliveryHandover || selectedOrder.deliveryProof) && (
                  <Card className="p-3.5 border border-emerald-500/30 bg-emerald-500/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Bukti Serah Terima Dokumen (Tersedia)
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedHandoverOrder(selectedOrder);
                          setIsHandoverProofModalOpen(true);
                        }}
                        className="h-6 text-[11px] gap-1 px-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                      >
                        <Eye className="w-3 h-3" />
                        Lihat Bukti
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Nama Penerima:</span>
                        <span className="font-semibold text-foreground">
                          {selectedOrder.deliveryHandover?.recipientName || selectedOrder.customer} ({selectedOrder.deliveryHandover?.relationship || "Pemilik Langsung"})
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Waktu Penyerahan:</span>
                        <span className="font-mono text-foreground">
                          {selectedOrder.deliveryHandover?.completedAt || selectedOrder.tanggalDiterima || "-"}
                        </span>
                      </div>
                      {selectedOrder.deliveryHandover?.notes && (
                        <div className="sm:col-span-2">
                          <span className="text-muted-foreground block text-[11px]">Catatan:</span>
                          <span className="text-foreground italic">"{selectedOrder.deliveryHandover.notes}"</span>
                        </div>
                      )}
                      {selectedOrder.deliveryHandover?.fileName && (
                        <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span className="font-mono text-[11px] text-foreground">{selectedOrder.deliveryHandover.fileName}</span>
                          {selectedOrder.deliveryHandover.fileSize && (
                            <span className="text-[10px] text-muted-foreground">({formatFileSize(selectedOrder.deliveryHandover.fileSize)})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Mode Selector */}
                <div className="flex border-b border-border">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("jadwal")}
                    className={cn(
                      "px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5",
                      deliveryMode === "jadwal"
                        ? "border-primary text-primary font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Penugasan Messenger Pengantar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("langsung")}
                    className={cn(
                      "px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5",
                      deliveryMode === "langsung"
                        ? "border-primary text-primary font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    Serah Terima di Loket / Kantor Langsung
                  </button>
                </div>

                {deliveryMode === "jadwal" ? (
                  /* Scheduling Form */
                  <Card className="p-4 border border-border bg-card space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-primary" />
                      Penugasan Pengantaran
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-foreground">Tanggal Pengantaran</Label>
                        <Input
                          type="date"
                          value={deliveryData.tanggalPengantaran}
                          onChange={(e) => setDeliveryData({ ...deliveryData, tanggalPengantaran: e.target.value })}
                          className="bg-input-background h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-foreground">Tugaskan Messenger</Label>
                        <Select
                          value={deliveryData.messenger}
                          onValueChange={(val) => setDeliveryData({ ...deliveryData, messenger: val })}
                        >
                          <SelectTrigger className="bg-input-background h-9 text-xs">
                            <SelectValue placeholder="Pilih Messenger" />
                          </SelectTrigger>
                          <SelectContent>
                            {messengers.map((m) => (
                              <SelectItem key={m} value={m} className="text-xs">
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground">Catatan Pengantaran (Opsional)</Label>
                      <Input
                        placeholder="Contoh: Serahkan langsung ke pelanggan, minta bukti tanda terima ttd"
                        value={deliveryData.catatanPengantaran}
                        onChange={(e) => setDeliveryData({ ...deliveryData, catatanPengantaran: e.target.value })}
                        className="bg-input-background h-9 text-xs"
                      />
                    </div>
                  </Card>
                ) : (
                  /* Direct Handover Form */
                  <Card className="p-4 border border-border bg-card space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      Catat Serah Terima Dokumen di Loket / Kantor
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Gunakan formulir ini jika pelanggan datang langsung ke loket biro jasa atau serah terima berkas selesai diserahkan di kantor tanpa kurir pengantar.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-foreground">Nama Penerima Berkas *</Label>
                        <Input
                          placeholder="Nama lengkap penerima..."
                          value={directHandoverData.recipientName}
                          onChange={(e) => setDirectHandoverData({ ...directHandoverData, recipientName: e.target.value })}
                          className="bg-input-background h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-foreground">Hubungan dengan Pelanggan</Label>
                        <Select
                          value={directHandoverData.relationship}
                          onValueChange={(val) => setDirectHandoverData({ ...directHandoverData, relationship: val })}
                        >
                          <SelectTrigger className="bg-input-background h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pemilik Langsung" className="text-xs">Pemilik Langsung</SelectItem>
                            <SelectItem value="Keluarga Serumah" className="text-xs">Keluarga Serumah</SelectItem>
                            <SelectItem value="Staff / Karyawan Kantor" className="text-xs">Staff / Karyawan Kantor</SelectItem>
                            <SelectItem value="Supir / Perwakilan" className="text-xs">Supir / Perwakilan</SelectItem>
                            <SelectItem value="Lainnya" className="text-xs">Lainnya</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground">Catatan Serah Terima (Opsional)</Label>
                      <Input
                        placeholder="Contoh: Berkas asli STNK, Plat nomor & Notice Pajak diserahkan lengkap di loket"
                        value={directHandoverData.notes}
                        onChange={(e) => setDirectHandoverData({ ...directHandoverData, notes: e.target.value })}
                        className="bg-input-background h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-2 pt-1 border-t border-border">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-foreground font-semibold flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5 text-primary" />
                          Unggah Berkas / Foto Bukti Serah Terima
                        </Label>
                        <span className="text-[10px] text-muted-foreground">PDF, JPG, JPEG, PNG (Maks 5MB)</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Foto atau dokumen tanda terima akan otomatis dikompresi berukuran optimal tanpa mengurangi kualitas dan keterbacaan teks.
                      </p>

                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            {isCompressingHandover ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Mengompres Berkas...
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5" />
                                {directHandoverData.fileName ? "Ganti Berkas" : "Pilih Berkas / Foto"}
                              </>
                            )}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                            disabled={isCompressingHandover}
                            className="hidden"
                            onChange={handleDirectHandoverFileUpload}
                          />
                        </label>

                        {directHandoverData.fileName && (
                          <div className="flex items-center gap-2 text-xs bg-muted/30 px-2.5 py-1 rounded border border-border/60">
                            {directHandoverData.fileType === "pdf" ? (
                              <FileText className="w-3.5 h-3.5 text-rose-500" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                            <span className="font-mono text-[11px] text-foreground truncate max-w-[200px]">
                              {directHandoverData.fileName}
                            </span>
                            {directHandoverData.fileSize && (
                              <Badge status="info" className="text-[10px] px-1 py-0">
                                {formatFileSize(directHandoverData.fileSize)}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-4 border-t border-border bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2">
            <Button variant="outline" onClick={() => setIsDeliveryWorkspaceOpen(false)} className="w-full sm:w-auto">
              Batal
            </Button>
            <div className="flex flex-col sm:flex-row gap-2">
              {deliveryMode === "langsung" ? (
                <Button onClick={handleSaveDirectHandover} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan & Selesaikan Serah Terima (Ke Tahap 8)
                </Button>
              ) : (
                <Button onClick={handleSaveDelivery} className="gap-2 w-full sm:w-auto font-medium">
                  <Truck className="w-4 h-4" />
                  Simpan Jadwal Pengantaran
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* 8. ARCHIVE CONFIRMATION DIALOG: SIMPAN KE RIWAYAT ORDER */}
      {/* ======================================================== */}
      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent className="w-full sm:max-w-xl max-h-[90dvh] bg-card text-card-foreground p-4 sm:p-5 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Archive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Stage 8 — Penyelesaian Serah Terima Dokumen
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Verifikasi kelengkapan dokumen hasil Samsat dan status finansial sebelum menyimpan order ke riwayat
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (() => {
            const paid = selectedOrder.payment?.dibayar || 0;
            const total = selectedOrder.payment?.totalBiaya || selectedOrder.totalEstimasi || 0;
            const kurang = selectedOrder.payment?.kurang || 0;
            const isUnderpaid = kurang > 0;
            const isRefundPending = selectedOrder.payment?.refundStatus === "PENDING" && (selectedOrder.payment?.overpayment || 0) > 0;
            const overpayment = selectedOrder.payment?.overpayment || 0;
            const isFinanciallySettled = !isUnderpaid && !isRefundPending && selectedOrder.payment?.statusPembayaran === "Lunas";

            // Aggregate AFTER documents from updatedDocuments and rekapDocuments
            const afterDocs: string[] = [
              ...(selectedOrder.updatedDocuments || []),
              ...(selectedOrder.rekapDocuments?.filter((d: any) => d.phase === "AFTER").map((d: any) => d.label || d.name) || []),
            ];

            return (
              <div className="space-y-4 my-2 text-xs">
                {/* 1. Order Summary */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nomor Order:</span>
                    <span className="font-mono text-primary font-semibold">{selectedOrder.orderNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nama Customer:</span>
                    <span className="font-medium text-foreground">{selectedOrder.customer} ({selectedOrder.nomorHP})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nomor Polisi:</span>
                    <span className="font-mono font-medium">{selectedOrder.nopol} ({selectedOrder.jenisKendaraan || "Kendaraan"})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jenis Pengurusan:</span>
                    <span>{selectedOrder.layanan}</span>
                  </div>
                </div>

                {/* 2. Dua Konsep Terpisah: Status Operasional VS Status Finansial (Section 6) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Status Operasional */}
                  <div className="p-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Status Operasional
                      </span>
                      <Badge status="success" className="text-[10px] px-2 py-0.5 font-bold">
                        SELESAI
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>Dokumen Telah Diterima Customer</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Proses pengurusan di Samsat dan penyerahan fisik berkas kepada customer telah tuntas.
                    </p>
                  </div>

                  {/* Status Finansial */}
                  <div className={cn(
                    "p-3 rounded-lg border space-y-1.5",
                    isUnderpaid 
                      ? "border-rose-500/30 bg-rose-500/5" 
                      : isRefundPending 
                      ? "border-blue-500/30 bg-blue-500/5" 
                      : "border-emerald-500/25 bg-emerald-500/5"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Status Finansial
                      </span>
                      {isUnderpaid ? (
                        <Badge status="error" className="text-[10px] px-2 py-0.5 font-bold">
                          JATUH TEMPO
                        </Badge>
                      ) : isRefundPending ? (
                        <Badge status="info" className="text-[10px] px-2 py-0.5 font-bold">
                          REFUND PENDING
                        </Badge>
                      ) : (
                        <Badge status="success" className="text-[10px] px-2 py-0.5 font-bold">
                          LUNAS
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="font-semibold text-foreground text-xs">
                        {isUnderpaid ? "KURANG BAYAR" : isRefundPending ? "LEBIH BAYAR" : "LUNAS"}
                      </span>
                      <span className={cn(
                        "font-mono font-bold text-xs",
                        isUnderpaid ? "text-rose-600 dark:text-rose-400" : isRefundPending ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {isUnderpaid ? `Rp ${kurang.toLocaleString('id-ID')}` : isRefundPending ? `Rp ${overpayment.toLocaleString('id-ID')}` : `Rp 0`}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Terbayar: Rp {paid.toLocaleString('id-ID')} / Total: Rp {total.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                {/* Financial Action & Notification Banner */}
                {isRefundPending && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-200 space-y-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-semibold">Kelebihan Bayar: Rp {overpayment.toLocaleString('id-ID')} (Refund / Cashback Pending)</p>
                        <p className="text-[11px] opacity-90 mt-0.5">
                          Kelebihan dana otomatis tercatat pada menu Cashback Terpending untuk diproses via Kas Kantor.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isFinanciallySettled && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Finansial Lunas & Selesai. Order memenuhi syarat penuh untuk masuk ke <strong>Rekap Order</strong>.</span>
                  </div>
                )}

                {/* 3. Bukti Serah Terima Dokumen (Handover Proof) */}
                <div className="space-y-2 pt-1 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Bukti Serah Terima Dokumen
                    </span>
                    {(selectedOrder.deliveryHandover || selectedOrder.deliveryProof) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedHandoverOrder(selectedOrder);
                          setIsHandoverProofModalOpen(true);
                        }}
                        className="h-6 text-[11px] gap-1 px-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                      >
                        <Eye className="w-3 h-3" />
                        Lihat Bukti Lengkap
                      </Button>
                    ) : (
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-border bg-primary/10 text-primary hover:bg-primary/20">
                          <Upload className="w-3 h-3" /> Unggah Bukti
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const processed = await processDocumentUpload(file);
                              let uploadedDocId: string | undefined;
                              let finalFileUrl = processed.fileUrl;

                              if (selectedOrder?.orderNo) {
                                try {
                                  const uploaded = await documentRepository.uploadDocument(processed.file, {
                                    orderNo: selectedOrder.orderNo,
                                    documentType: "Bukti Serah Terima",
                                    metadata: {
                                      phase: "AFTER",
                                      category: "Bukti Serah Terima",
                                    },
                                  });
                                  if (uploaded?.id) {
                                    uploadedDocId = uploaded.id;
                                    finalFileUrl = uploaded.fileUrl;
                                  }
                                } catch (uploadErr) {
                                  console.warn("Handover upload failed:", uploadErr);
                                }
                              }

                              const nowIso = new Date().toISOString();
                              const proof = {
                                recipientName: selectedOrder.customer,
                                relationship: "Pemilik Langsung",
                                photoProofUrl: finalFileUrl,
                                fileName: processed.fileName,
                                fileType: processed.fileType,
                                fileSize: processed.fileSize,
                                documentId: uploadedDocId,
                                completedAt: nowIso,
                              };
                              updateOrder(selectedOrder.orderNo, {
                                deliveryHandover: proof,
                                isReceived: true,
                              });
                              setSelectedOrder((prev: any) => prev ? {
                                ...prev,
                                deliveryHandover: proof,
                                isReceived: true,
                              } : null);
                              toast.success(`Bukti serah terima (${file.name}) berhasil dilampirkan!`);
                            } catch (err: any) {
                              toast.error(err.message || "Gagal mengunggah bukti serah terima");
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {selectedOrder.deliveryHandover || selectedOrder.deliveryProof ? (
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Penerima:</span>
                        <span className="font-semibold text-foreground">
                          {selectedOrder.deliveryHandover?.recipientName || selectedOrder.customer} ({selectedOrder.deliveryHandover?.relationship || "Pemilik Langsung"})
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Waktu Penyerahan:</span>
                        <span className="font-mono text-foreground">
                          {selectedOrder.deliveryHandover?.completedAt || selectedOrder.tanggalDiterima || "-"}
                        </span>
                      </div>
                      {selectedOrder.deliveryHandover?.notes && (
                        <div className="text-[11px] text-muted-foreground pt-0.5">
                          <span>Catatan: </span>
                          <span className="italic text-foreground">"{selectedOrder.deliveryHandover.notes}"</span>
                        </div>
                      )}
                      {selectedOrder.deliveryHandover?.fileName && (
                        <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20">
                          <span className="text-muted-foreground text-[11px]">Berkas:</span>
                          <span className="font-mono text-[11px] text-primary truncate max-w-[220px]">
                            {selectedOrder.deliveryHandover.fileName} {selectedOrder.deliveryHandover.fileSize ? `(${formatFileSize(selectedOrder.deliveryHandover.fileSize)})` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-muted-foreground text-xs border border-dashed rounded bg-muted/10">
                      Belum ada berkas fisik bukti serah terima yang dilampirkan (bisa diunggah melalui tombol Unggah Bukti)
                    </div>
                  )}
                </div>

                {/* 4. Dokumen Hasil Samsat (AFTER documents) */}
                <div className="space-y-2 pt-1 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Dokumen Hasil Samsat (AFTER Docs)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenUploadNewDocModal("ARCHIVE_AFTER")}
                      className="h-6 px-2 py-1 text-[11px] font-medium rounded border-border bg-primary/10 text-primary hover:bg-primary/20 gap-1"
                    >
                      <Upload className="w-3 h-3" /> Tambah Berkas
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {afterDocs.length > 0 ? (
                      afterDocs.map((docName, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-emerald-500/5 border border-emerald-500/20 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="text-[11px] text-foreground font-medium truncate">{docName}</span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] gap-1 px-2"
                            onClick={() => {
                              const matchingRekap = selectedOrder.rekapDocuments?.find((r: any) => r.label === docName || r.documentType === docName);
                              handleOpenPreview(
                                docName,
                                "Dokumen Hasil Samsat",
                                matchingRekap?.fileUrl,
                                matchingRekap?.fileType?.toLowerCase() || (docName.toLowerCase().endsWith(".pdf") ? "pdf" : "image")
                              );
                            }}
                          >
                            <Eye className="w-3 h-3 text-primary" />
                            Lihat
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-muted-foreground text-xs border border-dashed rounded bg-muted/10">
                        Belum ada berkas fisik hasil Samsat yang dilampirkan (bisa diunggah melalui tombol Tambah Berkas)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 flex flex-col-reverse sm:flex-row sm:justify-end pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button onClick={handleArchiveOrder} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
              <Check className="w-4 h-4" />
              Selesaikan Alur & Arsipkan Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* UPLOAD DOKUMEN BARU MODAL (Nama Dokumen + File)          */}
      {/* ======================================================== */}
      <Dialog open={isUploadNewDocModalOpen} onOpenChange={setIsUploadNewDocModalOpen}>
        <DialogContent className="w-full sm:max-w-md bg-card text-card-foreground p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              Tambah Dokumen Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Unggah berkas resmi baru (PDF, JPG, PNG maks 5MB) untuk melengkapi arsip order
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Nama Dokumen */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Nama Dokumen <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Contoh: STNK Asli Baru, SKPD / Pajak Baru, Faktur..."
                value={newDocName}
                onChange={(e) => {
                  setNewDocName(e.target.value);
                  setNewDocError("");
                }}
                className="bg-input-background h-9 text-xs"
              />
            </div>

            {/* 2. File Dokumen */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                File Dokumen <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-col gap-2">
                <input
                  id="new-doc-file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const f = e.target.files[0];
                      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
                      if (isPdf && f.size > 5 * 1024 * 1024) {
                        setNewDocError("Ukuran file PDF melebihi batas 5MB. Pilih berkas yang lebih kecil.");
                        return;
                      }
                      setNewDocFile(f);
                      setNewDocError("");
                      if (!newDocName.trim()) {
                        const baseName = f.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
                        setNewDocName(baseName);
                      }
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("new-doc-file-input")?.click()}
                    className="h-9 text-xs gap-1.5 shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {newDocFile ? "Ganti File" : "Pilih File"}
                  </Button>
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {newDocFile ? `${newDocFile.name} (${formatFileSize(newDocFile.size)})` : "Belum ada file dipilih"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Format yang didukung: PDF, JPEG, JPG, PNG (Maksimal 5MB)
                </p>
              </div>
            </div>

            {/* Upload Error Message */}
            {newDocError && (
              <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{newDocError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmittingNewDoc}
              onClick={() => setIsUploadNewDocModalOpen(false)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingNewDoc}
              onClick={handleSaveNewDocument}
              className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              {isSubmittingNewDoc ? "Mengunggah..." : "Simpan Dokumen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DOCUMENT PREVIEW MODAL                                   */}
      {/* ======================================================== */}
      <DocumentPreviewModal
        isOpen={!!previewDoc}
        onClose={handleClosePreview}
        title={previewDoc?.type ? `Preview Dokumen — ${previewDoc.type}` : "Preview Dokumen"}
        documentName={previewDoc?.name}
        rawUrl={previewDoc?.fileUrl}
        fileType={previewDoc?.fileType}
        documentId={previewDoc?.documentId}
      />

      {/* ======================================================== */}
      {/* HANDOVER PROOF (BUKTI SERAH TERIMA) MODAL                 */}
      {/* ======================================================== */}
      <Dialog open={isHandoverProofModalOpen} onOpenChange={setIsHandoverProofModalOpen}>
        <DialogContent className="w-full sm:max-w-lg max-h-[90dvh] bg-card text-card-foreground p-4 sm:p-5 flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Bukti Serah Terima Dokumen
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Order: <span className="font-mono font-semibold text-foreground">{selectedHandoverOrder?.orderNo}</span> • {selectedHandoverOrder?.customer} ({selectedHandoverOrder?.nopol})
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 my-2 text-xs">
            {/* Handover Details Card */}
            <div className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Nama Penerima:</span>
                <span className="font-semibold text-foreground">
                  {selectedHandoverOrder?.deliveryHandover?.recipientName || selectedHandoverOrder?.receiverName || selectedHandoverOrder?.customer || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Hubungan Penerima:</span>
                <Badge status="info" className="text-[10px]">
                  {selectedHandoverOrder?.deliveryHandover?.relationship || "Pemilik Langsung"}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Waktu Penyerahan:</span>
                <span className="font-mono text-foreground">
                  {selectedHandoverOrder?.deliveryHandover?.completedAt || selectedHandoverOrder?.tanggalPengantaran || selectedHandoverOrder?.tanggalDiterima || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Petugas / Messenger:</span>
                <span className="font-medium text-foreground">
                  {selectedHandoverOrder?.messengerPengantar || selectedHandoverOrder?.messenger || "Loket / Kantor"}
                </span>
              </div>
              {selectedHandoverOrder?.deliveryHandover?.notes && (
                <div className="py-1">
                  <span className="text-muted-foreground block mb-0.5">Catatan Serah Terima:</span>
                  <p className="text-foreground bg-card p-2 rounded border border-border/60 italic">
                    "{selectedHandoverOrder.deliveryHandover.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* File Attachment / Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Lampiran Berkas / Foto Serah Terima
                </span>
                {selectedHandoverOrder?.deliveryHandover?.fileSize && (
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {formatFileSize(selectedHandoverOrder.deliveryHandover.fileSize)}
                  </span>
                )}
              </div>

              {(() => {
                const proof = selectedHandoverOrder?.deliveryHandover;
                const legacyProof = selectedHandoverOrder?.deliveryProof;
                const fileData = proof?.photoProofUrl || (typeof legacyProof === "string" ? legacyProof : undefined);
                const isPdf = proof?.fileType === "pdf" || proof?.fileName?.toLowerCase().endsWith(".pdf") || (fileData?.startsWith("data:application/pdf"));

                if (!fileData && !proof?.fileName) {
                  return (
                    <div className="p-6 text-center text-muted-foreground border border-dashed rounded-lg bg-muted/10 space-y-2">
                      <FileIcon className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                      <p>Tidak ada lampiran foto/dokumen digital</p>
                      <p className="text-[11px]">Serah terima dicatat tanpa unggahan berkas digital</p>
                    </div>
                  );
                }

                if (isPdf) {
                  return (
                    <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{proof?.fileName || "Bukti_Serah_Terima.pdf"}</p>
                          <p className="text-[11px] text-muted-foreground">Dokumen PDF Terverifikasi</p>
                        </div>
                      </div>
                      {fileData && (
                        <iframe
                          src={fileData}
                          title="Bukti Serah Terima PDF"
                          className="w-full h-64 rounded border border-border"
                        />
                      )}
                    </div>
                  );
                }

                return (
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    {fileData ? (
                      <div className="max-h-[360px] overflow-auto flex items-center justify-center bg-black/5 p-2">
                        <img
                          src={fileData}
                          alt="Bukti Serah Terima"
                          className="max-h-[340px] max-w-full object-contain rounded"
                        />
                      </div>
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-1" />
                        <p>{proof?.fileName || "Foto Berkas"}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 sm:justify-between pt-2 border-t border-border">
            {selectedHandoverOrder?.deliveryHandover?.photoProofUrl ? (
              <a
                href={selectedHandoverOrder.deliveryHandover.photoProofUrl}
                download={selectedHandoverOrder.deliveryHandover.fileName || `Bukti_Serah_Terima_${selectedHandoverOrder.orderNo}`}
                className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium border border-border bg-primary/10 text-primary hover:bg-primary/20 transition-colors gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Lampiran
              </a>
            ) : <span />}
            <Button size="sm" variant="outline" onClick={() => setIsHandoverProofModalOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Verifikasi Pembayaran Lunas (Stage 1) */}
      <AlertDialog open={isConfirmPaymentDialogOpen} onOpenChange={(open) => { if (!open && !isVerifyingPayment) setIsConfirmPaymentDialogOpen(false); }}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Konfirmasi Verifikasi Pembayaran Awal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-3">
              <p className="leading-relaxed">
                Pastikan nominal pembayaran untuk order ini sesuai bukti transfer / kas loket. Setelah dikonfirmasi, nominal terkonfirmasi menjadi acuan perhitungan sisa tagihan atau kelebihan bayar.
              </p>
              {selectedOrder && (
                <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                    <span className="text-muted-foreground">No Order:</span>
                    <span className="font-mono font-semibold text-foreground">{selectedOrder.orderNo}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium text-foreground">{selectedOrder.customer}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                    <span className="text-muted-foreground">Total Tagihan:</span>
                    <span className="font-mono font-semibold text-foreground">
                      Rp {(selectedOrder.payment?.totalBiaya || selectedOrder.totalEstimasi || 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-muted-foreground font-semibold">Nominal Terkonfirmasi:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      Rp {(parseFloat(editPaymentAmount.replace(/[^0-9]/g, "")) || selectedOrder.payment?.nominalDibayarAwal || selectedOrder.payment?.totalBiaya || 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                  {!selectedOrder.payment?.buktiPembayaran?.fileUrl && (
                    <div className="mt-2 p-2 rounded bg-muted/50 border border-border text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>Bukti pembayaran belum dilampirkan (opsional). Anda dapat langsung melanjutkan konfirmasi pembayaran.</span>
                    </div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel disabled={isVerifyingPayment} className="h-8 text-xs font-medium">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isVerifyingPayment}
              onClick={(e) => {
                e.preventDefault();
                handleMarkPaymentVerified();
              }}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifyingPayment ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                "Konfirmasi & Simpan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Pindah Proses Selanjutnya (Popup Pengingat Verifikasi) */}
      <AlertDialog open={advanceConfirmData?.isOpen || false} onOpenChange={(open) => { if (!open) setAdvanceConfirmData(null); }}>
        <AlertDialogContent className="border-border sm:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              Konfirmasi Pindah Proses Selanjutnya
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-2.5">
              <p className="leading-relaxed">
                Apakah Anda yakin ingin memindahkan order <strong className="text-foreground font-mono font-semibold">{advanceConfirmData?.orderNo}</strong> ke proses berikutnya?
              </p>
              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold text-center flex items-center justify-center gap-2">
                <span>Tahap Tujuan:</span>
                <span className="underline decoration-primary/40 font-bold">{advanceConfirmData?.targetStage}</span>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/30 p-2.5 text-xs space-y-1">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Pengingat Verifikasi Data:
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  {advanceConfirmData?.summaryText}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 gap-2">
            <AlertDialogCancel className="h-8 text-xs font-medium">
              Batal / Periksa Kembali
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isAdvancing}
              onClick={async (e) => {
                e.preventDefault();
                if (advanceConfirmData?.onConfirm) {
                  await advanceConfirmData.onConfirm();
                }
              }}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs flex items-center gap-1.5"
            >
              {isAdvancing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  Ya, Lanjutkan Proses
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
