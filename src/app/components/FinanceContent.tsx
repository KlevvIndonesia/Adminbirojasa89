import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate, Navigate } from "react-router";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import { DataPenjualan } from "./DataPenjualan";
import { EnhancedTableWithDialogs, Column } from "./EnhancedTableWithDialogs";
import { FinanceSummary } from "./finance/FinanceSummary";
import { cn } from "./ui/utils";
import { FinanceAddPage, FieldConfig } from "./FinanceAddPage";
import { FinanceDetailPage } from "./FinanceDetailPage";
import { toast } from "sonner";
import { DATA_PENJUALAN_CATEGORIES } from "../config/routeConfig";
import { 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Receipt,
  FileCheck,
  AlertCircle,
  AlertTriangle,
  Clock,
  MessageSquare,
  CheckCircle,
  CheckCircle2,
  Phone,
  Loader2,
  User,
  CreditCard,
  FileText,
  Plus,
  Pencil,
  Lock,
  Printer,
  MessageCircle,
  Undo2,
  History,
  FileSpreadsheet,
  Building2,
  Users,
  ChevronDown,
  ChevronUp,
  Layers,
  Calendar,
  BarChart3
} from "lucide-react";
import { InvoiceA5Dialog } from "./InvoiceA5Dialog";
import { KwitansiA5Dialog } from "./KwitansiA5Dialog";
import { VoucherRefundDialog } from "./VoucherRefundDialog";
import { RekonsiliasiKasModal } from "./RekonsiliasiKasModal";
import { exportToCSV } from "../utils/financeExport";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { formatRupiah, formatCustomerName, PlateNumberBadge, formatDateDDMMYYYY } from "../utils/financeFormatters";
import { useFinanceStore, InvoiceBillingRecord, financeStore } from "../data/financeStore";
import { APP_CONFIG } from "../config/appConfig";
import { orderStore } from "../data/orderStore";
import { useKaryawanPengguna } from "../data/karyawanPenggunaAdapter";
import { documentRepository } from "../../data/repositories/documentRepository";
import { processDocumentUpload, formatFileSize } from "../utils/fileCompressor";
import { paymentMethodStore, usePaymentMethods } from "../data/paymentMethodStore";
import type { PaymentProof } from "../../domain/order/types";
import { ActionInlineError } from "./ui/ActionInlineError";
import { useActionFeedback } from "../hooks/useActionFeedback";
import {
  ActionApiError,
  classifyActionError,
  fetchWithTimeout,
  parseApiErrorResponse,
} from "../utils/actionErrorClassifier";
import { Upload, ImageIcon, FileIcon, Trash2, Eye } from "lucide-react";
import {
  PaymentFilterBar,
  InflowSummaryCard,
  UnifiedProfitInflowSection,
  matchesPaymentMethodFilter,
  matchesDateRange,
  normalizePaymentCategory,
} from "./FinancePaymentMethodSummary";
import { pricingStore } from "../data/pricingStore";
import { orderRepository } from "../../data/repositories/orderRepository";
import { derivePaymentStatus, calculateInvoiceProfitMetrics } from "../../domain/finance/types";
import { payoutIntentManager } from "../../domain/finance/payoutIntentManager";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import type { ReimbursementRequest } from "../../domain/messenger/types";

export const STANDARD_EXPENSE_CATEGORIES = [
  "Operasional Kantor & Utilitas",
  "Sewa & Pemeliharaan Gedung",
  "Gaji & Tunjangan Karyawan",
  "Perlengkapan & ATK Kantor",
  "Dana Talangan Samsat",
  "Bahan Bakar & Transportasi Kurir",
  "Konsumsi & Keperluan Harian",
  "Lain-lain / Biaya Tak Terduga",
];

const makeLunasIdempotencyKey = (invoiceId: number | string) =>
  `pay-${invoiceId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

interface FinanceContentProps {
  tab: string;
}

export function FinanceContent({ tab }: FinanceContentProps) {
  const navigate = useNavigate();
  const [filterPeriod, setFilterPeriod] = useState("monthly");
  
  // State for adding mode (switches from table view to standalone FinanceAddPage)
  const [isAdding, setIsAdding] = useState(false);
  const [isAnomalyDrawerOpen, setIsAnomalyDrawerOpen] = useState(false);
  const [lrCustomStartDate, setLrCustomStartDate] = useState("");
  const [lrCustomEndDate, setLrCustomEndDate] = useState("");
  const [isMessengerBreakdownOpen, setIsMessengerBreakdownOpen] = useState(false);

  // Authoritative employee records for messenger & responsible selectors
  const { karyawan } = useKaryawanPengguna();

  const allOrdersList = useMemo(() => {
    try {
      return orderRepository.getAllFlat();
    } catch {
      return [];
    }
  }, [tab, isAdding]);

  const availableOrderOptions = useMemo(() => {
    return ["-", ...allOrdersList.map((o) => `${o.orderNo} (${o.customer || o.namaPemilik || "Pelanggan"} - ${o.nopol || o.layanan})`)];
  }, [allOrdersList]);

  const extractOrderNo = (val: any): string | undefined => {
    if (!val || typeof val !== "string" || val === "-" || val === "Semua") return undefined;
    const match = val.match(/^([A-Za-z0-9\-_]+)/);
    return match ? match[1] : undefined;
  };

  const messengerOptions = useMemo(() => {
    const activeMessengers = karyawan.filter(
      (k) => (k.jabatan || "").toUpperCase() === "MESSENGER" && k.status === "Aktif"
    );
    const names = activeMessengers.map((k) => k.nama);
    return names.length > 0 ? names : ["Rudi Hartono", "Joko Prasetyo", "Budi Santoso", "Andi Pratama"];
  }, [karyawan]);

  const responsibleOptions = useMemo(() => {
    const activeResponsible = karyawan.filter(
      (k) => (k.jabatan || "").toUpperCase() !== "MESSENGER" && k.status === "Aktif"
    );
    const names = activeResponsible.map((k) => k.nama);
    return names.length > 0 ? names : ["Siti Nurhaliza", "Andi Wijaya", "Dewi Lestari", "Maya Safitri"];
  }, [karyawan]);
  
  // State for viewing detail mode (switches from table view to standalone FinanceDetailPage)
  const [viewingItem, setViewingItem] = useState<{
    item: any;
    subTabTitle: string;
    columns?: { key: string; label: string }[];
  } | null>(null);

  // Confirmation state for Tagihan: Pelunasan & Selesai (Requirement: Audit Tombol Lunas)
  const [lunasTargetItem, setLunasTargetItem] = useState<InvoiceBillingRecord | null>(null);
  const [isSubmittingLunas, setIsSubmittingLunas] = useState(false);
  const [selesaiTargetItem, setSelesaiTargetItem] = useState<InvoiceBillingRecord | null>(null);
  const [isSubmittingSelesai, setIsSubmittingSelesai] = useState(false);
  const [selectedTagihanOrderNo, setSelectedTagihanOrderNo] = useState("");
  const [tagihanJatuhTempo, setTagihanJatuhTempo] = useState("");
  const [cashbackTargetItem, setCashbackTargetItem] = useState<any | null>(null);
  const [isSubmittingCashback, setIsSubmittingCashback] = useState(false);
  const { activeMethods } = usePaymentMethods();
  const [lunasMethod, setLunasMethod] = useState("Transfer BCA");
  const [lunasProof, setLunasProof] = useState<PaymentProof | null>(null);
  const [lunasIdempotencyKey, setLunasIdempotencyKey] = useState<string>("");
  const [isUploadingLunasProof, setIsUploadingLunasProof] = useState(false);
  const [lunasAmount, setLunasAmount] = useState<number>(0);
  const [lunasDate, setLunasDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [lunasNotes, setLunasNotes] = useState<string>("");
  const [lunasUnknownOutcome, setLunasUnknownOutcome] = useState<boolean>(false);

  const [cashbackMethod, setCashbackMethod] = useState("Transfer BCA");
  const [cashbackProof, setCashbackProof] = useState<PaymentProof | null>(null);
  const [isUploadingCashbackProof, setIsUploadingCashbackProof] = useState(false);
  const [cashbackDate, setCashbackDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [cashbackIdempotencyKey, setCashbackIdempotencyKey] = useState<string>("");
  const [cashbackUnknownOutcome, setCashbackUnknownOutcome] = useState<boolean>(false);
  const [paidCashbackIds, setPaidCashbackIds] = useState<Set<string | number>>(new Set());
  const [dismissedCashbackIds, setDismissedCashbackIds] = useState<Set<string | number>>(new Set());
  const [selesaiInfoItem, setSelesaiInfoItem] = useState<any | null>(null);
  const [editingCashbackItem, setEditingCashbackItem] = useState<any | null>(null);
  const [editingCashbackForm, setEditingCashbackForm] = useState<any>({});
  const [isSavingEditCashback, setIsSavingEditCashback] = useState<boolean>(false);
  const [isCashbackToday, setIsCashbackToday] = useState<boolean>(true);
  const [cashbackAmount, setCashbackAmount] = useState<number>(0);

  const [targetPayments, setTargetPayments] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  const actionFeedback = useActionFeedback();
  const lunasSubmittingRef = useRef(false);
  const lunasUploadRef = useRef(false);
  const cashbackOpeningRef = useRef(false);
  const cashbackSubmittingRef = useRef(false);
  const cashbackUploadRef = useRef(false);
  const cashbackEditRef = useRef(false);
  const voidCashbackRef = useRef(false);
  const voidPaymentRef = useRef(false);
  const selesaiDismissRef = useRef(false);

  const handleLunasAmountChange = (nextAmount: number) => {
    actionFeedback.clearError("finance-lunas-submit");
    if (nextAmount !== lunasAmount) {
      setLunasUnknownOutcome(false);
      if (lunasTargetItem && !lunasSubmittingRef.current) {
        setLunasIdempotencyKey(makeLunasIdempotencyKey(lunasTargetItem.id));
      }
    }
    setLunasAmount(nextAmount);
  };

  const handleUploadLunasProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || lunasUploadRef.current) return;
    lunasUploadRef.current = true;
    actionFeedback.clearError("finance-lunas-proof");
    try {
      setIsUploadingLunasProof(true);
      toast.info(`Memproses bukti pelunasan ${file.name}...`);
      const processed = await processDocumentUpload(file);
      const uploaded = await documentRepository.uploadDocument(processed.file, {
        orderNo: lunasTargetItem?.orderNo,
        documentType: "BUKTI_PEMBAYARAN",
      });
      setLunasProof({
        fileName: processed.fileName,
        fileType: processed.fileType,
        fileUrl: uploaded.fileUrl,
        fileSize: formatFileSize(processed.fileSize),
        documentId: uploaded.id,
        uploadedAt: new Date().toISOString(),
      });
      toast.success(`Bukti pelunasan ${processed.fileName} berhasil diunggah.`);
    } catch (err: any) {
      const classified = actionFeedback.setError("finance-lunas-proof", err, {
        actionLabel: "mengunggah bukti pelunasan",
      });
      toast.error(classified.message);
    } finally {
      lunasUploadRef.current = false;
      setIsUploadingLunasProof(false);
      e.target.value = "";
    }
  };

  const handleUploadCashbackProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || cashbackUploadRef.current) return;
    cashbackUploadRef.current = true;
    actionFeedback.clearError("finance-cashback-proof");
    try {
      setIsUploadingCashbackProof(true);
      toast.info(`Memproses bukti pencairan ${file.name}...`);
      const processed = await processDocumentUpload(file);
      const uploaded = await documentRepository.uploadDocument(processed.file, {
        orderNo: cashbackTargetItem?.orderNo,
        documentType: "BUKTI_CASHBACK",
      });
      setCashbackProof({
        fileName: processed.fileName,
        fileType: processed.fileType,
        fileUrl: uploaded.fileUrl,
        fileSize: formatFileSize(processed.fileSize),
        documentId: uploaded.id,
        uploadedAt: new Date().toISOString(),
      });
      toast.success(`Bukti pencairan ${processed.fileName} berhasil diunggah.`);
    } catch (err: any) {
      const classified = actionFeedback.setError("finance-cashback-proof", err, {
        actionLabel: "mengunggah bukti pencairan",
      });
      toast.error(classified.message);
    } finally {
      cashbackUploadRef.current = false;
      setIsUploadingCashbackProof(false);
      e.target.value = "";
    }
  };

  // Profit Payment Method & Date Filters (Requirement 2)
  const [profitPaymentFilter, setProfitPaymentFilter] = useState("ALL");
  const [profitStartDate, setProfitStartDate] = useState("");
  const [profitEndDate, setProfitEndDate] = useState("");
  const [profitPengurusanFilter, setProfitPengurusanFilter] = useState("ALL");

  const [cashbackPenerima, setCashbackPenerima] = useState("");
  const [cashbackBank, setCashbackBank] = useState("BCA");
  const [cashbackNoRekening, setCashbackNoRekening] = useState("");
  const [belumBayarFilter, setBelumBayarFilter] = useState<"ALL" | "BELUM" | "KURANG">("ALL");

  // Kas Messenger & Reimbursement Review/Payout States
  const [kasMessengerView, setKasMessengerView] = useState<"buku-kas" | "reimbursement">("buku-kas");
  const [reimbFilterStatus, setReimbFilterStatus] = useState<string>("ALL");
  const [reimbFilterMessenger, setReimbFilterMessenger] = useState<string>("ALL");
  const [reimbSearchQuery, setReimbSearchQuery] = useState<string>("");

  const [reviewTarget, setReviewTarget] = useState<ReimbursementRequest | null>(null);
  const [reviewApprovedAmount, setReviewApprovedAmount] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  const [payoutTarget, setPayoutTarget] = useState<ReimbursementRequest | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<string>("Kas Messenger (Tunai)");
  const [isSubmittingPayout, setIsSubmittingPayout] = useState<boolean>(false);

  const [previewReceiptDoc, setPreviewReceiptDoc] = useState<{ url: string; title: string } | null>(null);
  const [isRekonsiliasiOpen, setIsRekonsiliasiOpen] = useState(false);

  const handleOpenCashbackConfirm = async (item: any) => {
    if (cashbackOpeningRef.current) return;
    if (item.isPayoutGated) {
      const gatingReason =
        item.payoutGatingReason || (!item.hasFinalCost ? "Biaya Final Belum Ada" : "Menunggu persetujuan Supervisi (Stage 6)");
      toast.warning(`Pencairan belum dapat diproses: ${gatingReason}`);
      return;
    }
    const isAlreadyPaid =
      paidCashbackIds.has(item.id) || (item.orderNo && paidCashbackIds.has(item.orderNo)) || item.status === "Dibayar";
    if (isAlreadyPaid) {
      toast.info(`Cashback untuk ${item.orderNo || item.invoice} sudah berstatus Dibayar.`);
      return;
    }

    actionFeedback.clearByPrefix("finance-cashback-");
    setCashbackUnknownOutcome(false);
    setCashbackTargetItem(item);
    const amount = Number(item.nominalKelebihan || item.jumlahCashback || 0);
    setCashbackAmount(amount);
    setCashbackPenerima(item.customer || "Konsumen");
    const today = new Date().toISOString().split("T")[0];
    setCashbackDate(today);
    setIsCashbackToday(true);

    const initialMethod = activeMethods[0]?.nama_metode || "Transfer BCA";
    const foundM = activeMethods.find((m) => m.nama_metode === initialMethod);
    const isCashInitial = foundM?.bank === "Tunai" || initialMethod.toLowerCase().includes("cash") || initialMethod.toLowerCase().includes("tunai");

    setCashbackMethod(initialMethod);
    setCashbackBank(isCashInitial ? "Tunai" : (foundM?.bank || "BCA"));
    setCashbackNoRekening("");
    setCashbackProof(null);

    cashbackOpeningRef.current = true;
    try {
      // DEF-FIN-005 Intent Lifecycle: Check for unresolved intent or strict 7-attribute server reconciliation
      const unresolved = payoutIntentManager.getUnresolvedIntent(item.id);
      if (unresolved && Array.isArray(item.payoutHistory)) {
        const reconciled = payoutIntentManager.reconcileWithInvoice(item.id, item.payoutHistory);
        if (reconciled) {
          toast.success("Transaksi pencairan sebelumnya telah berhasil dibukukan di server.");
          setCashbackTargetItem(null);
          return;
        }
      }

      const intent = await payoutIntentManager.getOrCreateIntentAsync(item.id, amount);
      setCashbackIdempotencyKey(intent.idempotencyKey);
      if (intent.status === "UNKNOWN_OUTCOME") {
        setCashbackUnknownOutcome(true);
        if (intent.nominal) {
          setCashbackAmount(intent.nominal);
        }
      }
    } catch (err: any) {
      const classified = actionFeedback.setError("finance-cashback-submit", err, {
        actionLabel: "menyiapkan pencairan cashback",
      });
      toast.error(classified.message);
    } finally {
      cashbackOpeningRef.current = false;
    }
  };

  const handleOpenEditCashback = (item: any) => {
    actionFeedback.clearError("finance-cashback-edit");
    setEditingCashbackItem(item);
    setEditingCashbackForm({
      orderNo: item.orderNo || item.invoice || "",
      nopol: item.nopol || "",
      customer: item.customer || "",
      phone: item.phone || item.noHp || "",
      tanggalMasukBerkas: item.tanggalMasukBerkas || item.tanggal || "",
      totalTagihan: Number(item.totalTagihan || 0),
      uangMasuk: Number(item.uangMasuk ?? item.terbayar ?? 0),
      nominalKelebihan: Number(item.nominalKelebihan ?? item.jumlahCashback ?? 0),
      status: item.status || "Pending",
      alasanPending: item.alasanPending || item.alasan || "",
    });
  };

  const handleSaveEditCashback = async () => {
    if (!editingCashbackItem || cashbackEditRef.current) return;
    actionFeedback.clearError("finance-cashback-edit");

    const trimmedCustomer = String(editingCashbackForm.customer || "").trim();
    const trimmedNopol = String(editingCashbackForm.nopol || "").trim();
    const totalTagihanNum = Number(editingCashbackForm.totalTagihan);
    const uangMasukNum = Number(editingCashbackForm.uangMasuk);
    const nominalKelebihanNum = Number(editingCashbackForm.nominalKelebihan);

    if (!trimmedCustomer) {
      const err = new ActionApiError(400, "VALIDATION_ERROR", "Nama customer wajib diisi.", { field: "customer" });
      const classified = actionFeedback.setError("finance-cashback-edit", err);
      toast.error(classified.message);
      return;
    }
    if (!trimmedNopol) {
      const err = new ActionApiError(400, "VALIDATION_ERROR", "Nomor polisi kendaraan wajib diisi.", { field: "nopol" });
      const classified = actionFeedback.setError("finance-cashback-edit", err);
      toast.error(classified.message);
      return;
    }
    if (
      Number.isNaN(totalTagihanNum) ||
      Number.isNaN(uangMasukNum) ||
      Number.isNaN(nominalKelebihanNum) ||
      totalTagihanNum < 0 ||
      uangMasukNum < 0 ||
      nominalKelebihanNum < 0
    ) {
      const err = new ActionApiError(
        400,
        "VALIDATION_ERROR",
        "Nominal tagihan, uang masuk, dan kelebihan bayar tidak boleh bernilai negatif."
      );
      const classified = actionFeedback.setError("finance-cashback-edit", err);
      toast.error(classified.message);
      return;
    }

    const isPaid = editingCashbackItem.status === "Dibayar" || paidCashbackIds.has(editingCashbackItem.id);
    const origTagihan = Number(editingCashbackItem.totalTagihan || 0);
    const origMasuk = Number(editingCashbackItem.uangMasuk ?? editingCashbackItem.terbayar ?? 0);
    const origKelebihan = Number(editingCashbackItem.nominalKelebihan ?? editingCashbackItem.jumlahCashback ?? 0);
    const origStatus = editingCashbackItem.status || "Pending";
    const hasFinancialChange =
      !isPaid &&
      (totalTagihanNum !== origTagihan ||
        uangMasukNum !== origMasuk ||
        nominalKelebihanNum !== origKelebihan ||
        String(editingCashbackForm.status || "Pending") !== origStatus);

    const validOrderNo =
      editingCashbackItem.orderNo && editingCashbackItem.orderNo !== "-" ? String(editingCashbackItem.orderNo) : "";

    cashbackEditRef.current = true;
    try {
      setIsSavingEditCashback(true);

      if (APP_CONFIG.dataProvider === "api") {
        if (hasFinancialChange) {
          throw new ActionApiError(
            422,
            "BUSINESS_RULE_VIOLATION",
            "Perubahan nilai Total Tagihan, Uang Masuk, Kelebihan Bayar, atau Status cashback belum dapat disimpan dari formulir ini karena endpoint pembaruan finansial invoice belum tersedia di server. Gunakan aksi Cairkan / Void atau ubah biaya dari modul Order."
          );
        }
        if (!validOrderNo) {
          throw new ActionApiError(
            422,
            "BUSINESS_RULE_VIOLATION",
            "Transaksi ini belum terhubung ke Nomor Order di server sehingga perubahan data tidak dapat disimpan permanen."
          );
        }

        const orderUpdated = await orderStore.updateOrderAsync(validOrderNo, {
          customer: trimmedCustomer,
          nomorHP: String(editingCashbackForm.phone || "").trim(),
          nopol: trimmedNopol.toUpperCase(),
          tanggalMasukBerkas: editingCashbackForm.tanggalMasukBerkas,
          alasanPending: editingCashbackForm.alasanPending,
          alasan_pending: editingCashbackForm.alasanPending,
        });

        if (!orderUpdated) {
          throw new ActionApiError(404, "NOT_FOUND", `Data order ${validOrderNo} tidak ditemukan di server.`);
        }
      } else if (validOrderNo) {
        orderStore.updateOrder(validOrderNo, {
          customer: trimmedCustomer,
          nomorHP: String(editingCashbackForm.phone || "").trim(),
          nopol: trimmedNopol.toUpperCase(),
          tanggalMasukBerkas: editingCashbackForm.tanggalMasukBerkas,
          alasanPending: editingCashbackForm.alasanPending,
          alasan_pending: editingCashbackForm.alasanPending,
        });
      }

      const updates: any = {
        nopol: trimmedNopol.toUpperCase(),
        customer: trimmedCustomer,
        phone: String(editingCashbackForm.phone || "").trim(),
        tanggalMasukBerkas: editingCashbackForm.tanggalMasukBerkas,
        alasan_pending: editingCashbackForm.alasanPending,
        alasan: editingCashbackForm.alasanPending,
      };

      if (!isPaid && APP_CONFIG.dataProvider !== "api") {
        updates.totalTagihan = totalTagihanNum;
        updates.terbayar = uangMasukNum;
        updates.dibayar = uangMasukNum;
        updates.overpayment = nominalKelebihanNum;
        updates.cashback = nominalKelebihanNum;
        updates.statusCashback = editingCashbackForm.status;
      }

      updateInvoice(editingCashbackItem.id, updates);

      toast.success(`Perubahan transaksi ${editingCashbackItem.orderNo || editingCashbackItem.invoice} berhasil disimpan.`);
      setEditingCashbackItem(null);
    } catch (err: any) {
      const classified = actionFeedback.setError("finance-cashback-edit", err, {
        entityLabel: editingCashbackItem.orderNo || editingCashbackItem.invoice,
        actionLabel: "menyimpan perubahan transaksi",
      });
      toast.error(classified.message);
    } finally {
      cashbackEditRef.current = false;
      setIsSavingEditCashback(false);
    }
  };

  const handleConfirmCashbackPayment = async () => {
    if (!cashbackTargetItem || cashbackSubmittingRef.current) return;
    actionFeedback.clearError("finance-cashback-submit");

    if (cashbackTargetItem.isPayoutGated) {
      const gatingReason =
        cashbackTargetItem.payoutGatingReason ||
        (!cashbackTargetItem.hasFinalCost ? "Biaya Final Belum Ada" : "Menunggu persetujuan Supervisi (Stage 6)");
      const err = new ActionApiError(422, "SUPERVISI_NOT_APPROVED", `Pencairan belum dapat diproses: ${gatingReason}.`);
      const classified = actionFeedback.setError("finance-cashback-submit", err);
      toast.error(classified.message);
      return;
    }

    const isAlreadyPaid =
      paidCashbackIds.has(cashbackTargetItem.id) ||
      (cashbackTargetItem.orderNo && paidCashbackIds.has(cashbackTargetItem.orderNo)) ||
      cashbackTargetItem.status === "Dibayar";
    if (isAlreadyPaid) {
      const err = new ActionApiError(
        409,
        "ALREADY_PROCESSED",
        `Cashback untuk transaksi ${cashbackTargetItem.orderNo || cashbackTargetItem.invoice} sudah berstatus Dibayar.`
      );
      const classified = actionFeedback.setError("finance-cashback-submit", err);
      toast.error(classified.message);
      return;
    }

    const maxAvailable = Number(cashbackTargetItem.nominalKelebihan || cashbackTargetItem.jumlahCashback || 0);
    const amount = Number(cashbackAmount) || 0;
    if (amount <= 0) {
      const err = new ActionApiError(400, "VALIDATION_ERROR", "Nominal yang dicairkan harus bernilai positif (lebih besar dari Rp 0).");
      const classified = actionFeedback.setError("finance-cashback-submit", err);
      toast.error(classified.message);
      return;
    }
    if (amount > maxAvailable && maxAvailable > 0) {
      const err = new ActionApiError(
        422,
        "EXCEEDS_LIMIT",
        `Nominal yang dicairkan tidak boleh melebihi saldo yang berhak dicairkan (${formatRupiah(maxAvailable)}).`
      );
      const classified = actionFeedback.setError("finance-cashback-submit", err);
      toast.error(classified.message);
      return;
    }
    if (!cashbackDate || !cashbackDate.trim()) {
      const err = new ActionApiError(400, "VALIDATION_ERROR", "Tanggal pengeluaran kas wajib diisi.", { field: "tanggal" });
      const classified = actionFeedback.setError("finance-cashback-submit", err);
      toast.error(classified.message);
      return;
    }

    const matchedCashbackMethod = paymentMethodStore.getAll().find((m) => m.nama_metode === cashbackMethod);
    if (matchedCashbackMethod && matchedCashbackMethod.status === "Nonaktif") {
      const err = new ActionApiError(
        422,
        "PAYMENT_METHOD_INACTIVE",
        `Metode pembayaran "${cashbackMethod}" berstatus Nonaktif dan tidak dapat digunakan untuk pencairan.`
      );
      const classified = actionFeedback.setError("finance-cashback-submit", err);
      toast.error(classified.message);
      return;
    }

    const isCashbackCash =
      cashbackMethod.toLowerCase().includes("cash") ||
      cashbackMethod.toLowerCase().includes("tunai") ||
      cashbackBank === "Tunai" ||
      cashbackBank.toLowerCase().includes("cash") ||
      cashbackBank.toLowerCase().includes("tunai");

    if (!isCashbackCash) {
      if (!cashbackBank.trim()) {
        const err = new ActionApiError(400, "VALIDATION_ERROR", "Bank tujuan wajib diisi untuk transfer bank.", { field: "bank" });
        const classified = actionFeedback.setError("finance-cashback-submit", err);
        toast.error(classified.message);
        return;
      }
      if (!cashbackNoRekening.trim()) {
        const err = new ActionApiError(400, "VALIDATION_ERROR", "Nomor rekening tujuan wajib diisi untuk transfer bank.", {
          field: "noRekening",
        });
        const classified = actionFeedback.setError("finance-cashback-submit", err);
        toast.error(classified.message);
        return;
      }
    }

    cashbackSubmittingRef.current = true;
    try {
      setIsSubmittingCashback(true);
      const isOverpaymentOnly = cashbackTargetItem.nominalKelebihan > 0 && (cashbackTargetItem.nominalKomisi || 0) === 0;
      const paymentType = isOverpaymentOnly ? "KELEBIHAN" : ((cashbackTargetItem.nominalKomisi || 0) > 0 && (cashbackTargetItem.nominalKelebihan || 0) === 0 ? "KOMISI" : "ALL");

      let key = cashbackIdempotencyKey;
      if (!key) {
        const intent = await payoutIntentManager.getOrCreateIntentAsync(cashbackTargetItem.id, amount, paymentType);
        key = intent.idempotencyKey;
        setCashbackIdempotencyKey(key);
      }
      payoutIntentManager.markInFlight(cashbackTargetItem.id, { nominal: amount, paymentType });
      const expectedVersion = Number(cashbackTargetItem.payoutVersion ?? (cashbackTargetItem.payoutHistory || []).length);
      const ok = await processCashbackPayment(cashbackTargetItem.id, {
        processedBy: "Finance Admin",
        paymentType,
        expectedVersion,
        penerima: cashbackPenerima || cashbackTargetItem.customer || "Konsumen",
        tanggal: cashbackDate || new Date().toISOString().split("T")[0],
        bank: isCashbackCash ? "Tunai" : cashbackBank.trim(),
        noRekening: isCashbackCash ? "" : cashbackNoRekening.trim(),
        nominal: amount,
        bukti: cashbackProof ? cashbackProof.fileUrl : undefined,
        buktiPembayaran: cashbackProof || undefined,
        paymentMethod: cashbackMethod,
        idempotencyKey: key,
      });

      if (ok) {
        payoutIntentManager.markDefinitiveSuccess(cashbackTargetItem.id);
        setCashbackUnknownOutcome(false);
        toast.success(
          `Cashback Berhasil Diproses: Pencairan dana untuk ${cashbackTargetItem.orderNo || cashbackTargetItem.invoice} sebesar ${formatRupiah(amount)} berhasil dicatat ke Kas Kantor.`
        );

        const voucherPayload = {
          orderNo: cashbackTargetItem.orderNo || cashbackTargetItem.invoice || `ORD-${cashbackTargetItem.id}`,
          invoiceNo: cashbackTargetItem.invoice || cashbackTargetItem.invoiceNo || (cashbackTargetItem.orderNo ? `INV/${cashbackTargetItem.orderNo.replace(/^ORD-/, "")}` : `INV-${cashbackTargetItem.id}`),
          voucherNo: `VCR-REF/${(cashbackTargetItem.orderNo || `ORD-${cashbackTargetItem.id}`).replace(/^ORD-/, "")}`,
          customer: cashbackTargetItem.customer || "Konsumen",
          phone: cashbackTargetItem.phone || cashbackTargetItem.nomorHp || "",
          nopol: cashbackTargetItem.nopol || "-",
          layanan: cashbackTargetItem.pengurusan || (cashbackTargetItem as any).jenisLayanan || "Pengurusan Dokumen Kendaraan",
          tanggal: cashbackDate || new Date().toISOString().split("T")[0],
          metode: cashbackMethod,
          bank: isCashbackCash ? "Tunai" : cashbackBank.trim(),
          noRekening: isCashbackCash ? "-" : cashbackNoRekening.trim(),
          namaRekening: cashbackPenerima || cashbackTargetItem.customer || "Konsumen",
          nominal: amount,
          catatan: "Pengembalian kelebihan bayar customer",
          approvedBy: "Supervisor Finansial",
          kasirName: "Kasir SUN89",
        };
        setPrintVoucherData(voucherPayload);

        // Mark as paid so status becomes "Dibayar" and button becomes "Selesai"
        setPaidCashbackIds((prev) => {
          const next = new Set(prev);
          next.add(cashbackTargetItem.id);
          if (cashbackTargetItem.orderNo) next.add(cashbackTargetItem.orderNo);
          return next;
        });
        setCashbackTargetItem(null);
        setCashbackProof(null);
        setCashbackIdempotencyKey("");
      } else {
        const failErr = new ActionApiError(422, "BUSINESS_RULE_VIOLATION", "Gagal memproses pencairan cashback / refund. Periksa kembali data transaksi.");
        payoutIntentManager.markDefinitiveFailed(cashbackTargetItem.id, failErr.message);
        const classified = actionFeedback.setError("finance-cashback-submit", failErr);
        toast.error(classified.message);
      }
    } catch (err: any) {
      const classified = classifyActionError(err, { actionLabel: "mencairkan dana cashback" });
      const isUncertain =
        classified.code === "TIMEOUT" ||
        classified.code === "NETWORK_ERROR" ||
        classified.statusCode === 408 ||
        classified.statusCode === 429 ||
        (classified.statusCode !== undefined && classified.statusCode >= 500) ||
        err?.isDefinitive === false;

      if (!isUncertain) {
        payoutIntentManager.markDefinitiveFailed(cashbackTargetItem.id, classified.message);
        setCashbackUnknownOutcome(false);
        if (err?.errorCode === "CONCURRENT_MODIFICATION" || err?.code === "CONCURRENT_MODIFICATION") {
          const concErr = new ActionApiError(
            409,
            "CONCURRENT_MODIFICATION",
            "Transaksi ditolak: Data invoice telah diperbarui oleh pengguna atau perangkat lain. Data terbaru sedang dimuat ulang."
          );
          actionFeedback.setError("finance-cashback-submit", concErr);
          toast.error(concErr.message);
          financeStore.syncFromRepository();
        } else {
          actionFeedback.setError("finance-cashback-submit", err, { actionLabel: "mencairkan dana cashback" });
          toast.error(classified.message);
        }
      } else {
        payoutIntentManager.markUnknownOutcome(cashbackTargetItem.id, classified.message);
        setCashbackUnknownOutcome(true);
        const uncertainErr = new ActionApiError(
          classified.statusCode || 408,
          classified.code === "NETWORK_ERROR" ? "NETWORK_ERROR" : "TIMEOUT",
          "Gangguan koneksi atau server timeout saat memproses pencairan. Status pencairan BELUM terkonfirmasi (bukan dianggap berhasil ataupun gagal). Kunci idempotensi dipertahankan agar percobaan ulang tidak menyebabkan mutasi kas ganda — silakan periksa status transaksi sebelum mencoba lagi."
        );
        actionFeedback.setError("finance-cashback-submit", uncertainErr);
        toast.warning(uncertainErr.message);
      }
    } finally {
      cashbackSubmittingRef.current = false;
      setIsSubmittingCashback(false);
    }
  };

  const handleOpenLunasConfirm = (item: any) => {
    // Phase B Gating: Prevent payment if final cost is not set or Supervisi is not approved
    if (item.isPaymentGated || !item.hasFinalCost || !item.isSupervisiApproved || item.costVerificationStatus === "PENDING_VERIFICATION" || item.isDraftEstimate) {
      const reason = item.costVerificationStatus === "PENDING_VERIFICATION" || item.isDraftEstimate
        ? "Biaya Samsat berstatus Estimasi Sementara dan belum diverifikasi"
        : (item.paymentGatingReason || (!item.hasFinalCost ? "Biaya final belum ditetapkan (Stage 5)" : "Menunggu persetujuan Supervisi (Stage 6)"));
      toast.warning(`Pembayaran tidak dapat diproses: ${reason}.`);
      return;
    }

    const sisa = Number(item.kekurangan ?? item.sisa ?? 0);
    if (item.status === "Lunas" || sisa <= 0) {
      toast.info(`Tagihan ${item.invoice || item.invoiceNo || item.orderNo} sudah berstatus Lunas. Kelebihan bayar dapat dikelola di Cashback Terpending.`);
      return;
    }

    actionFeedback.clearByPrefix("finance-lunas-");
    setLunasUnknownOutcome(false);
    setLunasTargetItem(item);
    setLunasAmount(sisa);
    setLunasInstallmentMode("full");
    setLunasDate(new Date().toISOString().split("T")[0]);
    setLunasMethod(activeMethods[0]?.nama_metode || "Transfer BCA");
    setLunasProof(null);
    setLunasNotes("");
    setLunasIdempotencyKey(makeLunasIdempotencyKey(item.id));

    // Fetch previous payment history for this invoice / order
    setTargetPayments([]);
    setIsLoadingPayments(true);
    const invoiceNum = item.invoice || item.invoiceNo || item.orderNo;
    if (invoiceNum) {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("sun89_auth_token") || "";
      fetchWithTimeout(
        `${APP_CONFIG.apiBaseUrl}/finance/invoices/${encodeURIComponent(invoiceNum)}/payments`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
        10000
      )
        .then(async (res) => {
          if (!res.ok) {
            throw await parseApiErrorResponse(res, "Gagal memuat riwayat pembayaran terbaru dari server.");
          }
          return res.json();
        })
        .then((payload) => {
          actionFeedback.clearError("finance-lunas-history");
          if (payload?.success && Array.isArray(payload.data) && payload.data.length > 0) {
            setTargetPayments(payload.data);
          } else {
            setTargetPayments(item.riwayatPembayaran || item.paymentRecords || []);
          }
        })
        .catch((err) => {
          setTargetPayments(item.riwayatPembayaran || item.paymentRecords || []);
          if (APP_CONFIG.dataProvider === "api") {
            actionFeedback.setError("finance-lunas-history", err, {
              actionLabel: "memuat riwayat pembayaran",
            });
          }
        })
        .finally(() => {
          setIsLoadingPayments(false);
        });
    } else {
      setTargetPayments(item.riwayatPembayaran || item.paymentRecords || []);
      setIsLoadingPayments(false);
    }
  };

  const handleConfirmLunas = async () => {
    if (!lunasTargetItem || lunasSubmittingRef.current) return;
    actionFeedback.clearError("finance-lunas-submit");

    // Phase B Gating: Strict UI pre-guard before triggering backend
    if (
      lunasTargetItem.isPaymentGated ||
      !lunasTargetItem.hasFinalCost ||
      !lunasTargetItem.isSupervisiApproved ||
      lunasTargetItem.costVerificationStatus === "PENDING_VERIFICATION" ||
      lunasTargetItem.isDraftEstimate
    ) {
      const reason =
        lunasTargetItem.costVerificationStatus === "PENDING_VERIFICATION" || lunasTargetItem.isDraftEstimate
          ? "Biaya Samsat berstatus Estimasi Sementara dan belum diverifikasi"
          : (lunasTargetItem.paymentGatingReason || (!lunasTargetItem.hasFinalCost ? "Biaya final belum ditetapkan (Stage 5)" : "Menunggu persetujuan Supervisi (Stage 6)"));
      const err = new ActionApiError(422, "SUPERVISI_NOT_APPROVED", `Pembayaran ditolak: ${reason}.`);
      const classified = actionFeedback.setError("finance-lunas-submit", err);
      toast.error(classified.message);
      return;
    }

    const payAmount = Number(lunasAmount) || 0;
    const currentSisa = Number(lunasTargetItem.kekurangan ?? lunasTargetItem.sisa ?? 0);
    if (payAmount <= 0) {
      const err = new ActionApiError(400, "VALIDATION_ERROR", "Nominal pembayaran harus lebih besar dari Rp 0.");
      const classified = actionFeedback.setError("finance-lunas-submit", err);
      toast.error(classified.message);
      return;
    }
    if (payAmount > currentSisa) {
      const err = new ActionApiError(
        422,
        "BUSINESS_RULE_VIOLATION",
        `Nominal pembayaran (${formatRupiah(payAmount)}) melebihi sisa tagihan (${formatRupiah(currentSisa)}). Untuk kelebihan bayar, silakan kelola pada alur Cashback / Pengembalian.`
      );
      const classified = actionFeedback.setError("finance-lunas-submit", err);
      toast.error(classified.message);
      return;
    }
    if (!lunasDate || !lunasDate.trim()) {
      const err = new ActionApiError(400, "VALIDATION_ERROR", "Tanggal pembayaran wajib diisi.", { field: "tanggal" });
      const classified = actionFeedback.setError("finance-lunas-submit", err);
      toast.error(classified.message);
      return;
    }

    const matchedLunasMethod = paymentMethodStore.getAll().find((m) => m.nama_metode === lunasMethod);
    if (matchedLunasMethod && matchedLunasMethod.status === "Nonaktif") {
      const err = new ActionApiError(
        422,
        "PAYMENT_METHOD_INACTIVE",
        `Metode pembayaran "${lunasMethod}" berstatus Nonaktif dan tidak dapat digunakan.`
      );
      const classified = actionFeedback.setError("finance-lunas-submit", err);
      toast.error(classified.message);
      return;
    }

    lunasSubmittingRef.current = true;
    try {
      setIsSubmittingLunas(true);
      let key = lunasIdempotencyKey;
      if (!key) {
        key = makeLunasIdempotencyKey(lunasTargetItem.id);
        setLunasIdempotencyKey(key);
      }
      const isFull = payAmount === currentSisa;
      const ok = await recordPayment(lunasTargetItem.id, payAmount, {
        paymentMethod: lunasMethod,
        bank: lunasMethod,
        tanggal: lunasDate || new Date().toISOString().split("T")[0],
        buktiPembayaran: lunasProof,
        catatan: lunasNotes.trim() || `${isFull ? "Pelunasan" : "Pembayaran tambahan"} tagihan ${lunasTargetItem.invoice || lunasTargetItem.invoiceNo || lunasTargetItem.orderNo}`,
        idempotencyKey: key,
      });
      if (ok) {
        setLunasUnknownOutcome(false);
        actionFeedback.clearByPrefix("finance-lunas-");
        toast.success(
          `Pembayaran ${formatRupiah(payAmount)} untuk ${lunasTargetItem.invoice || lunasTargetItem.invoiceNo || lunasTargetItem.orderNo} (${lunasTargetItem.customer}) berhasil dicatat.`
        );

        const kwitansiPayload = {
          orderNo: lunasTargetItem.orderNo || lunasTargetItem.invoice || `ORD-${lunasTargetItem.id}`,
          invoiceNo: lunasTargetItem.invoice || lunasTargetItem.invoiceNo || (lunasTargetItem.orderNo ? `INV/${lunasTargetItem.orderNo.replace(/^ORD-/, "")}` : `INV-${lunasTargetItem.id}`),
          kwitansiNo: `KW/${(lunasTargetItem.orderNo || `ORD-${lunasTargetItem.id}`).replace(/^ORD-/, "")}/${Date.now().toString().slice(-4)}`,
          customer: lunasTargetItem.customer || "Pelanggan",
          phone: lunasTargetItem.phone || (lunasTargetItem as any).nomorHp || "",
          nopol: lunasTargetItem.nopol || "-",
          layanan: lunasTargetItem.pengurusan || (lunasTargetItem as any).jenisLayanan || "Pengurusan Dokumen Kendaraan",
          samsat: (lunasTargetItem as any).samsat || (lunasTargetItem as any).wilayahSamsatAsal || "Samsat DKI Jakarta",
          tanggal: lunasDate || new Date().toISOString().split("T")[0],
          nominal: payAmount,
          totalTagihan: Number(lunasTargetItem.totalTagihan || 0),
          totalDibayar: Number(lunasTargetItem.terbayar ?? (lunasTargetItem as any).uangMasuk ?? 0) + payAmount,
          sisaTagihan: Math.max(0, currentSisa - payAmount),
          metodePembayaran: lunasMethod,
          catatan: lunasNotes.trim() || undefined,
          kasirName: "Kasir SUN89",
        };
        setPrintKwitansiData(kwitansiPayload);

        setLunasTargetItem(null);
        setLunasProof(null);
        setLunasIdempotencyKey("");
        setLunasAmount(0);
        setLunasNotes("");
        setTargetPayments([]);
      } else {
        const failErr = new ActionApiError(422, "BUSINESS_RULE_VIOLATION", "Gagal mencatat pembayaran tagihan. Silakan periksa kembali data transaksi.");
        const classified = actionFeedback.setError("finance-lunas-submit", failErr);
        toast.error(classified.message);
      }
    } catch (err: any) {
      const classified = classifyActionError(err, { actionLabel: "mencatat pembayaran tagihan" });
      const isUncertain =
        classified.code === "TIMEOUT" ||
        classified.code === "NETWORK_ERROR" ||
        classified.statusCode === 408 ||
        classified.statusCode === 429 ||
        (classified.statusCode !== undefined && classified.statusCode >= 500);

      if (isUncertain) {
        setLunasUnknownOutcome(true);
        const uncertainErr = new ActionApiError(
          classified.statusCode || 408,
          classified.code === "NETWORK_ERROR" ? "NETWORK_ERROR" : "TIMEOUT",
          "Gangguan koneksi atau server timeout saat memproses pembayaran. Status pembayaran BELUM terkonfirmasi dan tagihan belum dianggap lunas. Kunci idempotensi tetap dipertahankan — silakan periksa status tagihan sebelum mengirim ulang agar tidak terjadi pencatatan ganda."
        );
        actionFeedback.setError("finance-lunas-submit", uncertainErr);
        toast.warning(uncertainErr.message);
      } else {
        setLunasUnknownOutcome(false);
        const errCode = String(err?.errorCode || err?.code || classified.code);
        if (errCode === "IDEMPOTENCY_CONFLICT") {
          setLunasIdempotencyKey(makeLunasIdempotencyKey(lunasTargetItem.id));
        }
        if (errCode === "INVOICE_ALREADY_PAID" || errCode === "CONCURRENT_MODIFICATION" || classified.code === "CONFLICT") {
          financeStore.syncFromRepository();
        }
        actionFeedback.setError("finance-lunas-submit", err, { actionLabel: "mencatat pembayaran tagihan" });
        toast.error(classified.message);
      }
    } finally {
      lunasSubmittingRef.current = false;
      setIsSubmittingLunas(false);
    }
  };

  // Datasets from central Single Source of Truth
  const {
    tagihanList: tagihanData,
    kasKantorList: kasKantorData,
    kasMessengerList: kasMessengerData,
    pengeluaranList: pengeluaranData,
    profitList: profitData,
    belumBayarList: belumBayarData,
    profitPendingList: profitPendingData,
    cashbackPendingList: cashbackPendingData,
    labaRugiData,
    getCanonicalLabaRugi,
    getCashFlowReconciliation,
    recordPayment,
    resolveInvoice,
    completeInvoice,
    processRefund,
    processCashbackPayment,
    voidInvoicePayment,
    voidCashbackPayout,
    getVoidAuditHistory,
    dismissCashback,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addKasKantor,
    updateKasKantor,
    deleteKasKantor,
    addKasMessenger,
    updateKasMessenger,
    deleteKasMessenger,
    addPengeluaran,
    updatePengeluaran,
    deletePengeluaran,
    reimbursements,
    refreshReimbursements,
    reviewReimbursement,
    payReimbursement,
  } = useFinanceStore();

  const currentUser = useMemo(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        return {
          role: u.role || "admin",
          userName: u.nama || u.name || "Admin User",
          userId: u.userId || String(u.id || ""),
        };
      }
    } catch {}
    return { role: "admin", userName: "Admin User", userId: "" };
  }, []);

  useEffect(() => {
    if (tab === "kas-messenger") {
      refreshReimbursements();
    }
  }, [tab, refreshReimbursements]);

  // User role checking for Supervisor / Admin Void privileges
  const isSpvOrAdmin = useMemo(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (!savedUserStr) return false;
      const user = JSON.parse(savedUserStr);
      const r = String(user?.role || "").toLowerCase();
      const j = String(user?.jabatan || "").toLowerCase();
      return (
        ["administrator", "supervisor", "spv", "svp", "admin"].includes(r) ||
        j.includes("supervisor") ||
        j.includes("spv") ||
        j.includes("svp") ||
        j.includes("admin")
      );
    } catch {
      return false;
    }
  }, []);

  // Invoice A5 Print State (Tahap 1)
  const [printInvoiceData, setPrintInvoiceData] = useState<any | null>(null);

  // Tahap 3: Kwitansi & Voucher Refund State
  const [printKwitansiData, setPrintKwitansiData] = useState<any | null>(null);
  const [printVoucherData, setPrintVoucherData] = useState<any | null>(null);
  const [lunasInstallmentMode, setLunasInstallmentMode] = useState<"full" | "partial">("full");

  // Tahap 2: Void Payment & Cashback State (SPV / Admin Only)
  const [voidTargetPayment, setVoidTargetPayment] = useState<{
    invoiceId: number;
    paymentId: number;
    nominal: number;
    invoiceNo: string;
    orderNo?: string;
  } | null>(null);

  const [voidTargetCashback, setVoidTargetCashback] = useState<{
    invoiceId: number;
    nominal: number;
    orderNo: string;
    customer: string;
  } | null>(null);

  const [voidReasonText, setVoidReasonText] = useState<string>("");
  const [isSubmittingVoid, setIsSubmittingVoid] = useState<boolean>(false);

  // Tahap 4: Step 8 Handover & Closing State
  const [closingTargetItem, setClosingTargetItem] = useState<any | null>(null);
  const [isSubmittingClosing, setIsSubmittingClosing] = useState<boolean>(false);
  const [closingPenerima, setClosingPenerima] = useState<string>("");
  const [closingNotes, setClosingNotes] = useState<string>("");

  // Tahap 4: Void Audit History State
  const [isVoidHistoryOpen, setIsVoidHistoryOpen] = useState<boolean>(false);
  const [voidHistoryData, setVoidHistoryData] = useState<{ payments: any[]; cashbacks: any[] }>({ payments: [], cashbacks: [] });
  const [isLoadingVoidHistory, setIsLoadingVoidHistory] = useState<boolean>(false);
  const [voidHistoryTab, setVoidHistoryTab] = useState<"payments" | "cashbacks">("payments");

  // Send Invoice / Tagihan directly to WhatsApp (Tahap 1)
  const handleSendWhatsAppTagihan = (item: any) => {
    const phone = item.nomorHP || item.noHp || item["No HP / WhatsApp"] || item.phone || "";
    const customer = item["Nama Customer"] || item.customer || "Pelanggan";
    const orderNo = item.orderNo || item["Nomor Order"] || item["No Order"] || (typeof item.id === "string" && item.id.startsWith("ord:") ? item.id.slice(4) : (item["No Invoice"] || `ORD-${item.id || "001"}`));
    const nopol = item["Plat No"] || item.nopol || "-";
    const layanan = item["Jenis Pengurusan"] || item.layanan || item.jenisLayanan || "Pengurusan Dokumen Kendaraan";
    const sisa = Number(item["Sisa Tagihan"] ?? item.Kekurangan ?? item.sisaTagihan ?? item.sisa ?? item.kurang ?? item.kekurangan ?? 0);

    if (!phone || !phone.trim() || phone === "-") {
      toast.warning(`Nomor WhatsApp tidak ditemukan pada data transaksi ${orderNo}.`);
      return;
    }
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("8")) {
      cleanPhone = "62" + cleanPhone;
    }
    const isPartial = Boolean(
      item.isDraftEstimate ||
      item.is_draft_estimate ||
      item.costVerificationStatus === "PENDING_VERIFICATION" ||
      item.cost_verification_status === "PENDING_VERIFICATION" ||
      (item.order && (item.order.costCompletenessStatus === "PARTIAL_ESTIMATE" || !item.order.isCostVerified))
    );
    const messageText = isPartial
      ? `Halo ${customer},

Kami dari Biro Jasa SUN89 menginformasikan estimasi biaya sementara untuk pengurusan ${layanan} (No. Polisi: ${String(nopol).toUpperCase()}, Order: ${orderNo}) sebesar ${formatRupiah(item.totalTagihan || item.totalBiaya || sisa)}.

*Perhatian:*
Nominal di atas merupakan ESTIMASI SEMENTARA dan bukan tagihan final. Biaya final Samsat akan kami konfirmasikan kembali setelah verifikasi resmi berkas di Samsat.

Rekening Resmi Pembayaran:
Bank BCA: 7175095764
a/n ANISA SUSANTI (Biro Jasa SUN89)

Terima kasih atas kepercayaan Anda.`
      : `Halo ${customer},

kami dari Biro Jasa SUN89 menginformasikan tagihan pengurusan ${layanan} (No. Polisi: ${String(nopol).toUpperCase()}, Order: ${orderNo}) memiliki sisa tagihan sebesar ${formatRupiah(sisa)}.

Rekening Resmi Pembayaran:
Bank BCA: 7175095764
a/n ANISA SUSANTI (Biro Jasa SUN89)

Mohon konfirmasi jadwal pelunasan.
Terima kasih.`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, "_blank");
    toast.success(`Membuka WhatsApp untuk mengirim tagihan ke ${customer} (${phone})`);
  };

  // Kirim WhatsApp untuk Konfirmasi / Bukti Pencairan Cashback
  const handleSendWhatsAppCashback = (item: any) => {
    const phone = item.phone || item.nomorHp || item.nomorHP || item.noHp || item["No HP / WhatsApp"] || "";
    const customer = item.customer || item["Nama Customer"] || "Pelanggan";
    const orderNo = item.orderNo || item.invoice || `ORD-${item.id}`;
    const nopol = item.nopol || "-";
    const nominal = Number(item.nominalKelebihan || item.jumlahCashback || item.overpayment || 0);
    const isPaid = paidCashbackIds.has(item.id) || (item.orderNo && paidCashbackIds.has(item.orderNo)) || item.status === "Dibayar";

    if (!phone || !phone.trim() || phone === "-") {
      toast.warning(`Nomor WhatsApp tidak ditemukan pada data transaksi ${orderNo}.`);
      return;
    }
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("8")) {
      cleanPhone = "62" + cleanPhone;
    }
    const messageText = isPaid
      ? `Halo ${customer},

Kami dari Biro Jasa SUN89 menginformasikan bahwa pengembalian dana/cashback sebesar ${formatRupiah(nominal)} untuk transaksi pengurusan ${orderNo} (${nopol}) telah berhasil dicairkan.

Terima kasih atas kepercayaan Anda menggunakan layanan Biro Jasa SUN89.`
      : `Halo ${customer},

Kami dari Biro Jasa SUN89 menginformasikan bahwa terdapat dana lebih/cashback sebesar ${formatRupiah(nominal)} untuk transaksi pengurusan ${orderNo} (${nopol}) yang siap dicairkan.

Mohon konfirmasi rekening tujuan pencairan Anda.
Terima kasih.`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, "_blank");
    toast.success(`Membuka WhatsApp untuk konfirmasi cashback ke ${customer} (${phone})`);
  };

  // Void Payment Execution (Tahap 2)
  const handleConfirmVoidPayment = async () => {
    if (!voidTargetPayment || voidPaymentRef.current) return;
    actionFeedback.clearError("finance-payment-void");
    if (!voidReasonText || voidReasonText.trim().length < 10) {
      const err = new ActionApiError(400, "VALIDATION_ERROR", "Alasan pembatalan (Void) wajib diisi minimal 10 karakter sebagai bukti audit.");
      const classified = actionFeedback.setError("finance-payment-void", err);
      toast.error(classified.message);
      return;
    }
    voidPaymentRef.current = true;
    try {
      setIsSubmittingVoid(true);
      await voidInvoicePayment(voidTargetPayment.invoiceId, voidTargetPayment.paymentId, voidReasonText.trim());
      toast.success(`Pembayaran ${formatRupiah(voidTargetPayment.nominal)} berhasil dibatalkan (Void) dan saldo kas disesuaikan.`);
      setVoidTargetPayment(null);
      setVoidReasonText("");

      if (lunasTargetItem) {
        const invoiceNum = lunasTargetItem.invoice || lunasTargetItem.invoiceNo || lunasTargetItem.orderNo;
        if (invoiceNum) {
          const token = localStorage.getItem("auth_token") || localStorage.getItem("sun89_auth_token") || "";
          const res = await fetchWithTimeout(
            `${APP_CONFIG.apiBaseUrl}/finance/invoices/${encodeURIComponent(invoiceNum)}/payments`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} },
            10000
          );
          if (res.ok) {
            const payload = await res.json();
            if (payload?.success && Array.isArray(payload.data)) {
              setTargetPayments(payload.data);
            }
          }
        }
      }
    } catch (err: any) {
      const classified = actionFeedback.setError("finance-payment-void", err, {
        actionLabel: "membatalkan transaksi pembayaran",
      });
      toast.error(classified.message);
    } finally {
      voidPaymentRef.current = false;
      setIsSubmittingVoid(false);
    }
  };

  // Void Cashback Payout Execution (Tahap 2)
  const handleConfirmVoidCashback = async () => {
    if (!voidTargetCashback || voidCashbackRef.current) return;
    actionFeedback.clearError("finance-cashback-void");
    if (!voidReasonText || voidReasonText.trim().length < 10) {
      const err = new ActionApiError(400, "VALIDATION_ERROR", "Alasan pembatalan (Void) wajib diisi minimal 10 karakter sebagai bukti audit.");
      const classified = actionFeedback.setError("finance-cashback-void", err);
      toast.error(classified.message);
      return;
    }
    voidCashbackRef.current = true;
    try {
      setIsSubmittingVoid(true);
      await voidCashbackPayout(voidTargetCashback.invoiceId, voidReasonText.trim());
      toast.success(`Pencairan cashback untuk ${voidTargetCashback.orderNo} berhasil dibatalkan (Void) dan kas kantor dikembalikan.`);
      setPaidCashbackIds((prev) => {
        const next = new Set(prev);
        next.delete(voidTargetCashback.invoiceId);
        next.delete(voidTargetCashback.orderNo);
        return next;
      });
      actionFeedback.clearError("finance-cashback-void");
      setVoidTargetCashback(null);
      setVoidReasonText("");
    } catch (err: any) {
      const classified = actionFeedback.setError("finance-cashback-void", err, {
        entityLabel: voidTargetCashback.orderNo,
        actionLabel: "membatalkan pencairan cashback",
      });
      toast.error(classified.message);
    } finally {
      voidCashbackRef.current = false;
      setIsSubmittingVoid(false);
    }
  };

  // Tahap 4: Fetch SPV Void Audit History
  const handleOpenVoidHistory = async () => {
    setIsVoidHistoryOpen(true);
    setIsLoadingVoidHistory(true);
    try {
      const history = await getVoidAuditHistory();
      setVoidHistoryData(history || { payments: [], cashbacks: [] });
    } catch (err: any) {
      const classified = classifyActionError(err, { actionLabel: "memuat log audit pembatalan" });
      toast.error(classified.message);
    } finally {
      setIsLoadingVoidHistory(false);
    }
  };

  // Tahap 4: Step 8 Handover & Closing (Realize Profit into Laba Rugi)
  const handleConfirmClosing = async () => {
    if (!closingTargetItem || isSubmittingClosing) return;
    try {
      setIsSubmittingClosing(true);
      const ordNo = closingTargetItem.orderNo || closingTargetItem.invoice || "";
      let operatorName = "Finance SPV";
      try {
        const userObj = JSON.parse(localStorage.getItem("auth_user") || "{}");
        operatorName = userObj.nama || userObj.username || "Finance SPV";
      } catch {
        // fallback
      }

      if (ordNo) {
        orderStore.updateOrder(ordNo, {
          currentStep: 8,
          currentStageName: "Selesai (Arsip)" as any,
          penerimaBerkas: closingPenerima.trim() || closingTargetItem.customer || "Customer",
          catatanPenyerahan: closingNotes.trim() || "Penyerahan berkas fisik (STNK/BPKB) dan closing transaksi finansial",
          tanggalSelesai: new Date().toISOString().split("T")[0],
        } as any);
      }

      completeInvoice(closingTargetItem.id, operatorName);

      toast.success(
        `Transaksi ${ordNo} (${closingTargetItem.customer}) berhasil di-closing. Dokumen fisik telah diserahkan dan laba telah direalisasikan ke Laba Rugi.`
      );
      setClosingTargetItem(null);
      setClosingPenerima("");
      setClosingNotes("");
    } catch (err: any) {
      toast.error(err?.message || "Gagal memproses closing transaksi.");
    } finally {
      setIsSubmittingClosing(false);
    }
  };

  // CSV Exporters
  const handleExportBelumBayarCSV = () => {
    const cols = [
      { key: "tanggalMasukBerkas", label: "Tanggal Masuk" },
      { key: "orderNo", label: "Nomor Order" },
      { key: "nopol", label: "Nomor Polisi" },
      { key: "customer", label: "Customer" },
      { key: "phone", label: "No. HP / WA" },
      { key: "pengurusan", label: "Layanan" },
      { key: "totalTagihan", label: "Total Tagihan" },
      { key: "uangMasuk", label: "Sudah Dibayar" },
      { key: "sisaTagihan", label: "Sisa Tagihan" },
      { key: "status", label: "Status" },
    ];
    exportToCSV({
      title: "Laporan Piutang Belum & Kurang Bayar",
      columns: cols,
      data: belumBayarData,
      filename: `Piutang_Belum_Bayar_SUN89_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    toast.success("Data Belum & Kurang Bayar berhasil diekspor ke format CSV.");
  };

  const handleExportCashbackCSV = () => {
    const cols = [
      { key: "tanggalMasukBerkas", label: "Tanggal Masuk" },
      { key: "orderNo", label: "Nomor Order" },
      { key: "nopol", label: "Nomor Polisi" },
      { key: "customer", label: "Customer" },
      { key: "phone", label: "No. HP / WA" },
      { key: "pengurusan", label: "Layanan" },
      { key: "uangMasuk", label: "Uang Masuk" },
      { key: "totalTagihan", label: "Total Tagihan" },
      { key: "nominalKelebihan", label: "Kelebihan Bayar" },
      { key: "status", label: "Status" },
    ];
    exportToCSV({
      title: "Laporan Cashback & Kelebihan Bayar",
      columns: cols,
      data: cashbackPendingData.filter((item: any) => !dismissedCashbackIds.has(item.id)),
      filename: `Cashback_Terpending_SUN89_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    toast.success("Data Cashback Terpending berhasil diekspor ke format CSV.");
  };

  const handleExportProfitPendingCSV = () => {
    const cols = [
      { key: "tanggal", label: "Tanggal Order" },
      { key: "orderNo", label: "Nomor Order" },
      { key: "nopol", label: "Nomor Polisi" },
      { key: "customer", label: "Customer" },
      { key: "pengurusan", label: "Layanan" },
      { key: "totalTagihan", label: "Total Tagihan" },
      { key: "totalUangMasuk", label: "Total Terbayar" },
      { key: "danaTitipanPajak", label: "Biaya Pokok Samsat" },
      { key: "totalUangKeluarAktual", label: "Uang Keluar Aktual" },
      { key: "selisihKasSementara", label: "Selisih Kas" },
      { key: "estimasiProfit", label: "Estimasi Profit" },
    ];
    exportToCSV({
      title: "Laporan Profit Terpending",
      columns: cols,
      data: profitPendingData,
      filename: `Profit_Terpending_SUN89_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    toast.success("Data Profit Terpending berhasil diekspor ke format CSV.");
  };

  // Reusable Dialog Renderers
  const renderKwitansiModal = () => (
    <KwitansiA5Dialog
      open={!!printKwitansiData}
      onOpenChange={(open) => {
        if (!open) setPrintKwitansiData(null);
      }}
      data={printKwitansiData}
    />
  );

  const renderVoucherModal = () => (
    <VoucherRefundDialog
      open={!!printVoucherData}
      onOpenChange={(open) => {
        if (!open) setPrintVoucherData(null);
      }}
      data={printVoucherData}
    />
  );

  const renderVoidHistoryModal = () => (
    <Dialog open={isVoidHistoryOpen} onOpenChange={setIsVoidHistoryOpen}>
      <DialogContent className="border-border sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
                <History className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  Log Audit Pembatalan Transaksi (Void & Storno Kas)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Catatan pembatalan transaksi oleh SPV / Admin dengan pembukuan jurnal pembalik otomatis
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenVoidHistory}
              disabled={isLoadingVoidHistory}
              className="h-7 text-xs px-2.5 gap-1 border-border"
            >
              {isLoadingVoidHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : <History className="w-3 h-3" />}
              <span>Segarkan</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setVoidHistoryTab("payments")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                voidHistoryTab === "payments"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Void Pembayaran Invoice ({voidHistoryData.payments?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setVoidHistoryTab("cashbacks")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                voidHistoryTab === "cashbacks"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Void Pencairan Cashback ({voidHistoryData.cashbacks?.length || 0})
            </button>
          </div>

          {isLoadingVoidHistory ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Memuat catatan log audit void...</p>
            </div>
          ) : voidHistoryTab === "payments" ? (
            voidHistoryData.payments && voidHistoryData.payments.length > 0 ? (
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Waktu Void</th>
                      <th className="p-2.5">No. Invoice / Order</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5 text-right">Nominal Void</th>
                      <th className="p-2.5">Dibatalkan Oleh</th>
                      <th className="p-2.5">Alasan Pembatalan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {voidHistoryData.payments.map((p: any, idx: number) => (
                      <tr key={p.payment_id || idx} className="hover:bg-muted/20">
                        <td className="p-2.5 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                          {p.voided_at || "-"}
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-primary">
                          {p.invoice_no || p.order_no || "-"}
                        </td>
                        <td className="p-2.5 font-medium text-foreground">{p.customer || "-"}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-destructive">
                          {formatRupiah(p.nominal || 0)}
                        </td>
                        <td className="p-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {p.voided_by || "Supervisor"}
                          </span>
                        </td>
                        <td className="p-2.5 text-muted-foreground max-w-xs truncate" title={p.void_reason}>
                          {p.void_reason || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                Belum ada catatan pembatalan pembayaran invoice (Void).
              </div>
            )
          ) : (
            voidHistoryData.cashbacks && voidHistoryData.cashbacks.length > 0 ? (
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Waktu Void</th>
                      <th className="p-2.5">Target / Referensi</th>
                      <th className="p-2.5">Dibatalkan Oleh</th>
                      <th className="p-2.5">Role</th>
                      <th className="p-2.5">Alasan Pembatalan / Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {voidHistoryData.cashbacks.map((c: any, idx: number) => (
                      <tr key={c.id || idx} className="hover:bg-muted/20">
                        <td className="p-2.5 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                          {c.voided_at || "-"}
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-primary">
                          {c.invoice_no || "-"}
                        </td>
                        <td className="p-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {c.voided_by || "Supervisor"}
                          </span>
                        </td>
                        <td className="p-2.5 text-[11px] text-muted-foreground uppercase">{c.user_role || "spv"}</td>
                        <td className="p-2.5 text-muted-foreground max-w-sm truncate" title={c.void_reason}>
                          {c.void_reason || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                Belum ada catatan pembatalan pencairan cashback (Void).
              </div>
            )
          )}
        </div>

        <DialogFooter className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsVoidHistoryOpen(false)}
            className="h-8 text-xs font-medium"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const renderClosingModal = () => (
    <AlertDialog
      open={!!closingTargetItem}
      onOpenChange={(open) => {
        if (!open && !isSubmittingClosing) {
          setClosingTargetItem(null);
          setClosingPenerima("");
          setClosingNotes("");
        }
      }}
    >
      <AlertDialogContent className="border-border sm:max-w-md bg-card">
        <AlertDialogHeader>
          <div className="flex items-center gap-2.5 text-emerald-600 mb-1">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-base font-semibold text-foreground">
                Closing Berkas & Realisasi Laba
              </AlertDialogTitle>
              <p className="text-[11px] text-muted-foreground">
                Tahap 8: Penyerahan Dokumen Fisik ke Customer
              </p>
            </div>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground space-y-3 pt-2 text-left" asChild>
            <div>
              {closingTargetItem && (
                <div className="p-3 rounded-lg border border-border/60 bg-muted/30 space-y-1.5 text-foreground text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-[11px]">No. Order:</span>
                    <span className="font-mono font-semibold text-primary">{closingTargetItem.orderNo || closingTargetItem.invoice}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-[11px]">Customer & Nopol:</span>
                    <span className="font-medium text-foreground">{closingTargetItem.customer} ({closingTargetItem.nopol || "-"})</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-[11px]">Layanan:</span>
                    <span className="text-foreground">{closingTargetItem.pengurusan || "Samsat"}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/40 pt-1.5">
                    <span className="text-muted-foreground text-[11px]">Estimasi Laba Bersih:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(closingTargetItem.estimasiProfit || closingTargetItem.profit || 0)}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300 text-[11px] leading-relaxed">
                <p className="font-semibold flex items-center gap-1 mb-0.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                  Konsekuensi Transisi Akuntansi:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Dokumen fisik (STNK/BPKB/Plat asli) diserahterimakan kepada customer.</li>
                  <li>Transaksi selesai penuh dan keluar dari <strong>Profit Terpending</strong>.</li>
                  <li>Estimasi laba bersih diakui secara definitif ke laporan <strong>Laba Rugi (Realized Profit)</strong>.</li>
                </ul>
              </div>

              <div className="space-y-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">
                    Nama Penerima Berkas Fisik <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={closingPenerima}
                    onChange={(e) => setClosingPenerima(e.target.value)}
                    placeholder="Nama customer / perwakilan yang mengambil berkas"
                    className="h-8 text-xs text-foreground bg-input-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-foreground">
                    Catatan Penyerahan <span className="text-muted-foreground font-normal">(Opsional)</span>
                  </Label>
                  <Input
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Contoh: Berkas asli STNK/BPKB diterima dalam kondisi lengkap"
                    className="h-8 text-xs text-foreground bg-input-background"
                  />
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel
            disabled={isSubmittingClosing}
            onClick={() => {
              setClosingTargetItem(null);
              setClosingPenerima("");
              setClosingNotes("");
            }}
            className="h-8 text-xs px-3 font-medium"
          >
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmittingClosing || !closingPenerima.trim()}
            onClick={(e) => {
              e.preventDefault();
              handleConfirmClosing();
            }}
            className="h-8 text-xs px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmittingClosing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses Closing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Konfirmasi Serah Terima & Selesai</span>
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const { category } = useParams<{ category?: string }>();
  const activeCategoryLabel = category && DATA_PENJUALAN_CATEGORIES[category] ? DATA_PENJUALAN_CATEGORIES[category] : "Mutasi LD";

  // Sub-tab Breadcrumb renderer (Global shell header already displays breadcrumbs cleanly below the header)
  const renderSubTabHeader = (_title: string, _description?: string, _subCategory?: string) => {
    return null;
  };

  // If viewing detail, show the detail page (Requirement 18 & 19)
  if (viewingItem) {
    return (
      <FinanceDetailPage
        subTabTitle={viewingItem.subTabTitle}
        item={viewingItem.item}
        columns={viewingItem.columns}
        onBack={() => setViewingItem(null)}
      />
    );
  }

  // ==========================================
  // 1. SUB-TAB: PROFIT (VIEW ONLY)
  // ==========================================
  if (tab === "profit") {
    const filteredProfitData = profitData.filter((item) => {
      const matchPayment = matchesPaymentMethodFilter(item, profitPaymentFilter);
      const matchDate = matchesDateRange(item.tanggalUangMasuk || item.tanggal, profitStartDate, profitEndDate);
      const matchPengurusan =
        profitPengurusanFilter === "ALL" ||
        (item.pengurusan || "").toUpperCase() === profitPengurusanFilter.toUpperCase();
      return matchPayment && matchDate && matchPengurusan;
    });

    const totalUangMasuk = filteredProfitData.reduce((acc, item) => acc + (item.uangMasuk > 0 ? item.uangMasuk : 0), 0);
    const totalBiayaSamsat = filteredProfitData.reduce((acc, item) => acc + (Number(item.biayaSamsat) || 0), 0);
    const totalGrossServiceMargin = filteredProfitData.reduce((acc, item) => {
      const m = calculateInvoiceProfitMetrics({
        dibayar: item.uangMasuk,
        totalTagihan: (item as any).totalTagihan !== undefined ? (item as any).totalTagihan : item.uangMasuk,
        biayaSamsat: item.biayaSamsat,
        biayaAntarJemput: (item as any).biayaAntarJemput,
        cashback: (item as any).cashback,
        isExplicitZero: Boolean((item as any).isExplicitZero || (item as any).costClassification === "EXPLICIT_ZERO"),
      });
      return acc + m.grossServiceMargin;
    }, 0);
    const isTotalGrossDeficit = totalGrossServiceMargin < 0;

    const profitColumns: Column[] = [
      { key: "tanggal", label: "Tanggal Order", filterable: true, filterType: "text" },
      {
        key: "tanggalUangMasuk",
        label: "Tanggal Uang Masuk",
        render: (_val: any, item: any) => {
          const isPaid = Number(item.uangMasuk || 0) > 0;
          if (!isPaid) return <span className="text-muted-foreground italic text-xs">-</span>;
          return <span className="text-xs font-medium text-foreground">{item.tanggalUangMasuk || item.tanggal || "-"}</span>;
        },
      },
      {
        key: "nopol",
        label: "Nomor Polisi",
        filterable: true,
        filterType: "text",
        render: (value: string) => <PlateNumberBadge plate={value || "-"} />,
      },
      {
        key: "customer",
        label: "Nama Customer",
        filterable: true,
        filterType: "text",
        render: (value: string) => <span className="font-medium text-foreground">{formatCustomerName(value)}</span>,
      },
      { 
        key: "namaBerkas", 
        label: "Nama Pemilik (STNK/BPKB)",
        render: (value: string) => <span className="text-xs text-foreground">{value && value !== "-" ? value : <span className="text-muted-foreground italic">—</span>}</span>
      },
      {
        key: "pengurusan",
        label: "Jenis Pengurusan",
        filterable: true,
        filterType: "select",
        filterOptions: ["PAJAK TAHUNAN", "PAJAK 5 TAHUNAN", "MUTASI LD", "MUTASI AS", "BALIK NAMA", "BBN 1", "BBN 2"],
      },
      {
        key: "metodePencairan",
        label: "Metode Pencairan",
        filterable: true,
        filterType: "select",
        filterOptions: ["Cash", "Transfer Bank"],
        render: (_val: any, item: any) => {
          const isPaid = Number(item.uangMasuk || 0) > 0;
          if (!isPaid) {
            return <span className="text-xs text-muted-foreground italic">Belum terverifikasi</span>;
          }
          const cat = normalizePaymentCategory(item.metodePencairan || item.metodePembayaran || item.rekening || item.bank);
          const isCash = cat === "Cash";
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isCash
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
            }`}>
              {isCash ? "Cash (Tunai)" : "Transfer Bank"}
            </span>
          );
        },
      },
      {
        key: "namaBank",
        label: "Nama Bank",
        filterable: true,
        filterType: "text",
        render: (_val: any, item: any) => {
          const cat = normalizePaymentCategory(item.metodePencairan || item.metodePembayaran || item.rekening || item.bank);
          if (cat === "Cash") {
            return <span className="text-xs text-muted-foreground font-mono">—</span>;
          }
          const bankName = item.namaBank || item.bank || (item.rekening && item.rekening !== "Cash" ? item.rekening : "—");
          return <span className="text-xs font-semibold text-foreground">{bankName || "—"}</span>;
        },
      },
      {
        key: "nomorRekening",
        label: "Nomor Rekening",
        render: (_val: any, item: any) => {
          const cat = normalizePaymentCategory(item.metodePencairan || item.metodePembayaran || item.rekening || item.bank);
          if (cat === "Cash") {
            return <span className="text-xs text-muted-foreground font-mono">—</span>;
          }
          const noRek = item.nomorRekening || item.noRekening;
          return noRek ? (
            <span className="text-xs font-mono text-muted-foreground">{noRek}</span>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">—</span>
          );
        },
      },
      {
        key: "namaPemilikRekening",
        label: "Nama Pemilik Rekening",
        render: (_val: any, item: any) => {
          const cat = normalizePaymentCategory(item.metodePencairan || item.metodePembayaran || item.rekening || item.bank);
          if (cat === "Cash") {
            return <span className="text-xs text-muted-foreground font-mono">—</span>;
          }
          const namaRek = item.namaPemilikRekening || item.namaRekening;
          return namaRek ? (
            <span className="text-xs font-medium text-foreground">{namaRek}</span>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">—</span>
          );
        },
      },
      {
        key: "uangMasuk",
        label: "Total Terbayar",
        align: "right",
        render: (val: number) => (
          <span className="font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {formatRupiah(val > 0 ? val : 0)}
          </span>
        ),
      },
      {
        key: "biayaSamsat",
        label: "Biaya Pokok Samsat",
        align: "right",
        render: (val: number) => (
          <span className="font-mono tabular-nums text-xs text-rose-500">
            {formatRupiah(val || 0)}
          </span>
        ),
      },
      {
        key: "profit",
        label: "Gross Service Margin",
        align: "right",
        render: (_val: number, item: any) => {
          const m = calculateInvoiceProfitMetrics({
            dibayar: item.uangMasuk,
            totalTagihan: (item as any).totalTagihan !== undefined ? (item as any).totalTagihan : item.uangMasuk,
            biayaSamsat: item.biayaSamsat,
            biayaAntarJemput: (item as any).biayaAntarJemput,
            cashback: (item as any).cashback,
            isExplicitZero: Boolean((item as any).isExplicitZero || (item as any).costClassification === "EXPLICIT_ZERO"),
          });
          const margin = m.grossServiceMargin;
          return (
            <span className={`font-mono tabular-nums text-xs font-bold ${
              m.isGrossDeficit ? "text-rose-600 dark:text-rose-400" : "text-foreground"
            }`}>
              {m.isGrossDeficit ? `${formatRupiah(margin)} (Defisit)` : formatRupiah(margin)}
            </span>
          );
        },
      },
      { key: "invoice", label: "Nomor Invoice" },
      { key: "tanggalTTB", label: "Tanggal TTB" },
      { key: "ttb", label: "Nomor TTB" },
    ];

    const pengurusanOptions = [
      { value: "PAJAK TAHUNAN", label: "Pajak Tahunan" },
      { value: "PAJAK 5 TAHUNAN", label: "Pajak 5 Tahunan" },
      { value: "MUTASI LD", label: "Mutasi LD" },
      { value: "MUTASI AS", label: "Mutasi AS" },
      { value: "BALIK NAMA", label: "Balik Nama" },
      { value: "BBN 1", label: "BBN 1" },
      { value: "BBN 2", label: "BBN 2" },
    ];

    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* Ringkasan Pemasukan & Filter Rekening Kas Masuk Terpadu */}
        <UnifiedProfitInflowSection
          items={filteredProfitData}
          selectedMethod={profitPaymentFilter}
          onMethodChange={setProfitPaymentFilter}
          startDate={profitStartDate}
          onStartDateChange={setProfitStartDate}
          endDate={profitEndDate}
          onEndDateChange={setProfitEndDate}
          selectedStatus={profitPengurusanFilter}
          onStatusChange={setProfitPengurusanFilter}
          statusOptions={pengurusanOptions}
          statusLabel="Pengurusan"
          onReset={() => {
            setProfitPaymentFilter("ALL");
            setProfitStartDate("");
            setProfitEndDate("");
            setProfitPengurusanFilter("ALL");
          }}
          title="Ringkasan Pemasukan per Rekening / Metode Pembayaran"
        />

        {/* Level 3: Table Card */}
        <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-xs md:h-[calc(100vh-140px)] min-h-[500px] flex flex-col shrink-0">
          <EnhancedTableWithDialogs
            columns={profitColumns}
            data={filteredProfitData}
            subTabTitle="Profit"
            onView={(item) => setViewingItem({ item, subTabTitle: "Profit", columns: profitColumns })}
            searchPlaceholder="Cari berdasarkan nomor polisi, nama customer, invoice..."
            hideAddButton={true}
            hideEditButton={true}
            hideDeleteButton={true}
          />
        </Card>

        {/* Level 3: Standard Finance Summary (Normal flow below table) */}
        <FinanceSummary
          items={[
            {
              id: "total-uang-masuk",
              label: "Total Uang Masuk",
              value: totalUangMasuk,
              type: "inflow",
              subtitle: `${filteredProfitData.length} transaksi tercatat`,
            },
            {
              id: "total-biaya-samsat",
              label: "Total Biaya Pokok Samsat",
              value: totalBiayaSamsat,
              type: "outflow",
              subtitle: "Biaya resmi pengurusan",
            },
            {
              id: "total-gross-margin",
              label: "Total Gross Service Margin",
              value: isTotalGrossDeficit ? `${formatRupiah(totalGrossServiceMargin)} (Defisit)` : totalGrossServiceMargin,
              isCurrency: !isTotalGrossDeficit,
              type: isTotalGrossDeficit ? "outflow" : "inflow",
              subtitle: "Pendapatan diakui dikurangi biaya Samsat",
            },
          ]}
        />
      </div>
    );
  }

  // ==========================================
  // 2. SUB-TAB: KAS MESSENGER & REIMBURSEMENT
  // ==========================================
  if (tab === "kas-messenger") {
    const kasMessengerFields: FieldConfig[] = [
      { key: "tanggal", label: "Tanggal", type: "date" },
      { key: "jenis", label: "Jenis transaksi", type: "select", options: ["Petty cash", "Operasional", "Biaya Samsat"] },
      { key: "messenger", label: "Nama messenger", type: "select", options: messengerOptions, placeholder: "Pilih messenger" },
      { key: "orderNo", label: "Nomor Order Terkait (Opsional)", type: "select", options: availableOrderOptions, placeholder: "Pilih order jika terkait berkas" },
      { key: "keterangan", label: "Keterangan", type: "text", placeholder: "Rincian keperluan kas" },
      { key: "in", label: "Kas masuk (in)", type: "number", placeholder: "0" },
      { key: "out", label: "Kas keluar (out)", type: "number", placeholder: "0" },
    ];

    const kasMessengerColumns: Column[] = [
      { key: "tanggal", label: "Tanggal", filterable: true, filterType: "text" },
      { 
        key: "jenis", 
        label: "Jenis kas", 
        filterable: true, 
        filterType: "select", 
        filterOptions: ["Petty cash", "Operasional", "Biaya Samsat"],
        render: (val: any) => {
          const str = String(val || "");
          const lower = str.toLowerCase();
          if (lower.includes("petty")) return "Petty cash";
          if (lower.includes("operasional")) return "Operasional";
          if (lower.includes("samsat")) return "Biaya Samsat";
          return str;
        }
      },
      { 
        key: "messenger", 
        label: "Messenger", 
        filterable: true, 
        filterType: "select", 
        filterOptions: messengerOptions 
      },
      { 
        key: "keterangan", 
        label: "Keterangan",
        render: (val: any, row: any) => {
          const reimbId = row.reimbursementId;
          const ordNo = row.orderNo;
          return (
            <div className="flex flex-col gap-1 text-left">
              <span className="text-foreground">{val || "-"}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {reimbId && (
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-200 font-mono">
                    Ref: {reimbId}
                  </Badge>
                )}
                {ordNo && (
                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground font-mono">
                    {ordNo}
                  </Badge>
                )}
              </div>
            </div>
          );
        }
      },
      { 
        key: "in", 
        label: "Masuk",
        render: (val: any) => (val > 0 ? <span className="text-emerald-600 font-medium">{formatRupiah(val)}</span> : <span className="text-muted-foreground">—</span>)
      },
      { 
        key: "out", 
        label: "Keluar",
        render: (val: any) => (val > 0 ? <span className="text-rose-600 font-medium">{formatRupiah(val)}</span> : <span className="text-muted-foreground">—</span>)
      },
      { 
        key: "total", 
        label: "Saldo akhir",
        render: (val: any) => <span className="font-semibold text-foreground">{formatRupiah(val)}</span>
      },
      {
        key: "receiptUrl",
        label: "Bukti Struk",
        render: (val: any, row: any) => {
          const url = val || row.receiptUrl;
          if (!url) return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewReceiptDoc({
                  url,
                  title: `Bukti Kuitansi ${row.reimbursementId || ""} (${row.messenger})`
                });
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              Foto
            </Button>
          );
        }
      }
    ];

    const totalKasMasuk = kasMessengerData.reduce((acc, item) => acc + item.in, 0);
    const totalKasKeluar = kasMessengerData.reduce((acc, item) => acc + item.out, 0);
    const sisaSaldoMessenger = totalKasMasuk - totalKasKeluar;

    // Reimbursement KPIs
    const pendingReimbList = reimbursements.filter((r) => r.status === "Diajukan" || r.status === "Sedang Ditinjau");
    const approvedReimbList = reimbursements.filter((r) => r.status === "Disetujui");
    const paidReimbList = reimbursements.filter((r) => r.status === "Dibayar");
    const rejectedReimbList = reimbursements.filter((r) => r.status === "Ditolak");

    const totalReimbSubmitted = reimbursements.reduce((acc, r) => acc + (r.amount || 0), 0);
    const totalReimbPending = pendingReimbList.reduce((acc, r) => acc + (r.amount || 0), 0);
    const totalReimbApproved = approvedReimbList.reduce((acc, r) => acc + (r.approvedAmount ?? r.amount ?? 0), 0);
    const totalReimbPaid = paidReimbList.reduce((acc, r) => acc + (r.approvedAmount ?? r.amount ?? 0), 0);

    // Filtered Reimbursements
    const filteredReimbursements = reimbursements.filter((r) => {
      if (reimbFilterStatus !== "ALL" && r.status !== reimbFilterStatus) return false;
      if (reimbFilterMessenger !== "ALL" && r.messengerName !== reimbFilterMessenger) return false;
      if (reimbSearchQuery.trim()) {
        const q = reimbSearchQuery.toLowerCase();
        const matchId = (r.id || "").toLowerCase().includes(q);
        const matchMsg = (r.messengerName || "").toLowerCase().includes(q);
        const matchOrder = (r.orderNo || "").toLowerCase().includes(q);
        const matchNote = (r.note || "").toLowerCase().includes(q);
        const matchCat = (r.category || "").toLowerCase().includes(q);
        if (!matchId && !matchMsg && !matchOrder && !matchNote && !matchCat) return false;
      }
      return true;
    });

    const handleAddSubmit = (rows: any[]) => {
      rows.forEach((row) => {
        addKasMessenger({
          tanggal: row.tanggal || new Date().toLocaleDateString("id-ID"),
          jenis: row.jenis || "Operasional",
          messenger: row.messenger || messengerOptions[0] || "Rudi Hartono",
          keterangan: row.keterangan || "",
          in: parseInt(row.in) || 0,
          out: parseInt(row.out) || 0,
          orderNo: extractOrderNo(row.orderNo),
          total: undefined, // Dihitung otomatis oleh running total sistem
        });
      });
      setIsAdding(false);
      toast.success(`${rows.length} data kas messenger berhasil ditambahkan`);
    };

    const handleOpenReview = (r: ReimbursementRequest) => {
      if (r.status === "Dibayar") {
        toast.info(`Pengajuan ${r.id} sudah dicairkan.`);
        return;
      }
      if (r.status === "Disetujui") {
        toast.info(`Pengajuan ${r.id} sudah disetujui. Silakan klik Cairkan Kas untuk mencairkan.`);
        return;
      }
      setReviewTarget(r);
      setReviewApprovedAmount(String(r.approvedAmount !== undefined ? r.approvedAmount : r.amount));
      setReviewNotes(r.reviewNotes || "");
    };

    const handleConfirmReview = async (decision: "Disetujui" | "Ditolak") => {
      if (!reviewTarget) return;
      if (reviewTarget.status === "Dibayar" || (reviewTarget.status === "Disetujui" && decision === "Disetujui")) {
        toast.error("Pengajuan ini sudah disetujui / dicairkan sebelumnya.");
        setReviewTarget(null);
        return;
      }
      const cleanApproved = parseInt(String(reviewApprovedAmount).replace(/[^0-9]/g, ""), 10) || 0;

      if (decision === "Disetujui") {
        if (cleanApproved <= 0) {
          toast.error("Nominal yang disetujui harus lebih besar dari Rp 0.");
          return;
        }
        if (cleanApproved > reviewTarget.amount) {
          toast.error(`Nominal disetujui tidak boleh melebihi nominal diajukan (${formatRupiah(reviewTarget.amount)}).`);
          return;
        }
        if (cleanApproved < reviewTarget.amount && !reviewNotes.trim()) {
          toast.error("Wajib memberikan catatan/alasan jika nominal yang disetujui lebih kecil dari yang diajukan.");
          return;
        }
      } else if (decision === "Ditolak") {
        if (!reviewNotes.trim()) {
          toast.error("Wajib memberikan catatan/alasan penolakan pengajuan biaya.");
          return;
        }
      }

      setIsSubmittingReview(true);
      try {
        const rejectedAmt = decision === "Disetujui" 
          ? Math.max(0, reviewTarget.amount - cleanApproved) 
          : reviewTarget.amount;
        const approvedAmt = decision === "Disetujui" ? cleanApproved : 0;

        const res = await reviewReimbursement(
          reviewTarget.id,
          decision,
          { role: currentUser.role, userName: currentUser.userName },
          reviewNotes.trim() || undefined,
          approvedAmt,
          rejectedAmt
        );

        if (res.success) {
          toast.success(
            decision === "Disetujui"
              ? `Pengajuan ${reviewTarget.id} berhasil disetujui sebesar ${formatRupiah(approvedAmt)}. Siap dicairkan!`
              : `Pengajuan ${reviewTarget.id} berhasil ditolak.`
          );
          setReviewTarget(null);
          await refreshReimbursements();
        } else {
          toast.error(res.error || "Gagal memperbarui status pengajuan.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Terjadi kesalahan saat memproses review.");
      } finally {
        setIsSubmittingReview(false);
      }
    };

    const handleOpenPayout = (r: ReimbursementRequest) => {
      setPayoutTarget(r);
      setPayoutMethod("Kas Messenger (Tunai)");
    };

    const handleConfirmPayout = () => {
      if (!payoutTarget) return;
      setIsSubmittingPayout(true);
      try {
        const ok = payReimbursement(
          payoutTarget.id,
          { role: "finance", userName: "Finance Admin" },
          { paymentMethod: payoutMethod, channel: "Kas Messenger" }
        );

        if (ok) {
          const amt = payoutTarget.approvedAmount || payoutTarget.amount;
          toast.success(
            `Pencairan reimbursement ${payoutTarget.id} sebesar ${formatRupiah(amt)} berhasil dicatat di Kas Messenger!`
          );
          setPayoutTarget(null);
        } else {
          toast.error("Gagal memproses pencairan reimbursement.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Terjadi kesalahan saat memproses pencairan.");
      } finally {
        setIsSubmittingPayout(false);
      }
    };

    if (isAdding) {
      return (
        <FinanceAddPage
          title="Tambah data kas messenger"
          description="Masukkan pencatatan transaksi kas masuk atau pengeluaran operasional messenger"
          fields={kasMessengerFields}
          onBack={() => setIsAdding(false)}
          onSubmit={handleAddSubmit}
        />
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4 text-left">
        {renderSubTabHeader("Kas Messenger", "Kelola pencatatan kas petty cash, operasional, dan reimbursement messenger")}

        {/* Level 2 Sub-Nav: Buku Kas vs Pengajuan Biaya Reimbursement */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2 rounded-xl border border-border shadow-2xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setKasMessengerView("buku-kas")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                kasMessengerView === "buku-kas"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Wallet className="w-4 h-4" />
              Buku Kas Messenger ({kasMessengerData.length})
            </button>

            <button
              type="button"
              onClick={() => setKasMessengerView("reimbursement")}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                kasMessengerView === "reimbursement"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Receipt className="w-4 h-4" />
              Pengajuan Biaya Operasional ({reimbursements.length})
              {pendingReimbList.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  {pendingReimbList.length} Menunggu
                </span>
              )}
              {approvedReimbList.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                  {approvedReimbList.length} Siap Cair
                </span>
              )}
            </button>
          </div>

          {kasMessengerView === "buku-kas" && (
            <Button
              size="sm"
              onClick={() => setIsAdding(true)}
              className="h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Transaksi Kas
            </Button>
          )}
        </div>

        {/* VIEW 1: BUKU KAS MESSENGER */}
        {kasMessengerView === "buku-kas" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-xs md:h-[calc(100vh-180px)] min-h-[500px] flex flex-col shrink-0">
              <EnhancedTableWithDialogs
                columns={kasMessengerColumns}
                data={kasMessengerData}
                subTabTitle="Kas Messenger"
                onAdd={() => setIsAdding(true)}
                onView={(item) => setViewingItem({ item, subTabTitle: "Kas messenger", columns: kasMessengerColumns })}
                onEdit={(item, updated) => updateKasMessenger(item.id, updated)}
                onDelete={(item) => deleteKasMessenger(item.id)}
                searchPlaceholder="Cari berdasarkan messenger, keterangan, jenis..."
                editFields={kasMessengerFields}
              />
            </Card>

            {/* Standardized Neutral Financial Summary in Normal Document Flow Below Table */}
            <div className="pt-2 pb-8 shrink-0">
              <FinanceSummary
                items={[
                  {
                    id: "kas-masuk",
                    label: "Total Kas Masuk",
                    value: totalKasMasuk,
                    type: "inflow",
                    subtitle: "Penerimaan kas & petty cash",
                  },
                  {
                    id: "kas-keluar",
                    label: "Total Kas Keluar",
                    value: totalKasKeluar,
                    type: "outflow",
                    subtitle: "Operasional & reimbursement messenger",
                  },
                  {
                    id: "saldo-messenger",
                    label: "Sisa Saldo Kas Messenger",
                    value: sisaSaldoMessenger,
                    type: "neutral",
                    subtitle: "Posisi saldo saat ini",
                  },
                ]}
                columnsCount={3}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: PENGAJUAN REIMBURSEMENT MESSENGER */}
        {kasMessengerView === "reimbursement" && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">


            {/* Filter and Search Bar */}
            <Card className="p-3 border border-border bg-card shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Status tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  {[
                    { id: "ALL", label: `Semua (${reimbursements.length})` },
                    { id: "Diajukan", label: `Diajukan (${pendingReimbList.length})` },
                    { id: "Disetujui", label: `Disetujui (${approvedReimbList.length})` },
                    { id: "Dibayar", label: `Dibayar (${paidReimbList.length})` },
                    { id: "Ditolak", label: `Ditolak (${rejectedReimbList.length})` },
                  ].map((tabItem) => (
                    <button
                      key={tabItem.id}
                      type="button"
                      onClick={() => setReimbFilterStatus(tabItem.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                        reimbFilterStatus === tabItem.id
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {tabItem.label}
                    </button>
                  ))}
                </div>

                {/* Messenger Filter & Search Input */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <Select value={reimbFilterMessenger} onValueChange={setReimbFilterMessenger}>
                    <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                      <SelectValue placeholder="Pilih Messenger" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Semua Messenger</SelectItem>
                      {messengerOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="text"
                    value={reimbSearchQuery}
                    onChange={(e) => setReimbSearchQuery(e.target.value)}
                    placeholder="Cari ref, order, catatan..."
                    className="h-8 px-3 rounded-md border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-[200px]"
                  />
                </div>
              </div>
            </Card>

            {/* Reimbursement Table */}
            <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-xs md:h-[calc(100vh-235px)] min-h-[460px] flex flex-col shrink-0 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                <table className="finance-table finance-table--font-1 w-full text-[10px] text-left">
                  <thead className="finance-table__header bg-muted border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12 min-w-[48px] text-[10px] font-semibold">No.</th>
                      <th className="py-2.5 px-3 text-[10px]">No. Ref & Tanggal</th>
                      <th className="py-2.5 px-3 text-[10px]">Messenger</th>
                      <th className="py-2.5 px-3 text-[10px]">Order Terkait</th>
                      <th className="py-2.5 px-3 text-[10px]">Kategori & Keterangan</th>
                      <th className="py-2.5 px-3 text-center text-[10px]">Bukti Struk</th>
                      <th className="py-2.5 px-3 text-right text-[10px]">Diajukan</th>
                      <th className="py-2.5 px-3 text-right text-[10px]">Disetujui</th>
                      <th className="py-2.5 px-3 text-center text-[10px]">Status</th>
                      <th className="py-2.5 px-3 text-center text-[10px]">Aksi Tim Finance</th>
                    </tr>
                  </thead>
                  <tbody className="finance-table__body divide-y divide-border/60">
                    {filteredReimbursements.length > 0 ? (
                      filteredReimbursements.map((r, idx) => {
                        const isPartial = r.approvedAmount !== undefined && r.approvedAmount < r.amount;
                        return (
                          <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                            {/* No. */}
                            <td className="py-2.5 px-3 align-top text-center font-mono text-muted-foreground text-[10px] tabular-nums">
                              {idx + 1}
                            </td>

                            {/* Ref & Tanggal */}
                            <td className="py-2.5 px-3 align-top font-mono text-[10px]">
                              <span className="font-bold text-foreground block">{r.id}</span>
                              <span className="text-[10px] text-muted-foreground block">{r.date}</span>
                            </td>

                            {/* Messenger */}
                            <td className="py-2.5 px-3 align-top text-[10px]">
                              <span className="font-semibold text-foreground block">{r.messengerName}</span>
                              <span className="text-[10px] text-muted-foreground block font-mono">{r.employeeId}</span>
                            </td>

                            {/* Order */}
                            <td className="py-2.5 px-3 align-top text-[10px]">
                              {r.orderNo ? (
                                <Badge variant="outline" className="text-[10px] bg-muted font-mono font-semibold">
                                  {r.orderNo}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>

                            {/* Kategori & Keterangan */}
                            <td className="py-2.5 px-3 align-top max-w-[220px] text-[10px]">
                              <Badge variant="outline" className="text-[10px] font-semibold mb-1">
                                {r.category}
                              </Badge>
                              {r.note && (
                                <p className="text-foreground/90 leading-relaxed text-[10px] line-clamp-2" title={r.note}>
                                  {r.note}
                                </p>
                              )}
                              {r.reviewNotes && (
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 italic line-clamp-2" title={r.reviewNotes}>
                                  Note: {r.reviewNotes}
                                </p>
                              )}
                            </td>

                            {/* Bukti Struk */}
                            <td className="py-2.5 px-3 align-top text-center text-[10px]">
                              {r.receiptUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewReceiptDoc({ url: r.receiptUrl!, title: `Bukti ${r.id} (${r.messengerName})` })}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-[10px] font-semibold transition-colors"
                                  title="Lihat foto kuitansi/struk"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  Foto
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </td>

                            {/* Nominal Diajukan */}
                            <td className="py-2.5 px-3 align-top text-right font-medium text-foreground text-[10px]">
                              {formatRupiah(r.amount)}
                            </td>

                            {/* Nominal Disetujui */}
                            <td className="py-2.5 px-3 align-top text-right text-[10px]">
                              {r.approvedAmount !== undefined && r.status !== "Diajukan" ? (
                                <div>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                                    {formatRupiah(r.approvedAmount)}
                                  </span>
                                  {isPartial && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-semibold">
                                      Parsial
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 align-top text-center text-[10px]">
                              {r.status === "Diajukan" && (
                                <Badge variant="outline" className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 border-blue-200">
                                  Diajukan
                                </Badge>
                              )}
                              {r.status === "Sedang Ditinjau" && (
                                <Badge variant="outline" className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 border-amber-200">
                                  Ditinjau
                                </Badge>
                              )}
                              {r.status === "Disetujui" && (
                                <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-200">
                                  Disetujui
                                </Badge>
                              )}
                              {r.status === "Dibayar" && (
                                <Badge variant="outline" className="text-[10px] font-semibold bg-purple-500/10 text-purple-600 border-purple-200">
                                  Dibayar
                                </Badge>
                              )}
                              {r.status === "Ditolak" && (
                                <Badge variant="outline" className="text-[10px] font-semibold bg-rose-500/10 text-rose-600 border-rose-200">
                                  Ditolak
                                </Badge>
                              )}
                            </td>

                            {/* Aksi */}
                            <td className="py-2.5 px-3 align-top text-center text-[10px]">
                              {(r.status === "Diajukan" || r.status === "Sedang Ditinjau") && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenReview(r)}
                                  className="h-7 px-2.5 text-xs font-semibold bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90"
                                >
                                  Tinjau & Setujui
                                </Button>
                              )}

                              {r.status === "Disetujui" && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenPayout(r)}
                                  className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs gap-1"
                                >
                                  <Wallet className="w-3 h-3" /> Cairkan Kas
                                </Button>
                              )}

                              {r.status === "Dibayar" && (
                                <div className="text-[10px] text-muted-foreground flex flex-col items-center">
                                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Cair
                                  </span>
                                  {r.kasMessengerId && (
                                    <span className="text-[10px] font-mono text-muted-foreground">
                                      Kas #{r.kasMessengerId}
                                    </span>
                                  )}
                                </div>
                              )}

                              {r.status === "Ditolak" && (
                                <span className="text-[10px] text-rose-600 font-medium">Ditolak</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-muted-foreground text-[10px]">
                          Tidak ada data pengajuan reimbursement yang sesuai filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Standardized Neutral Financial Summary in Normal Document Flow Below Table */}
            <div className="pt-2 pb-8 shrink-0">
              <FinanceSummary
                items={[
                  {
                    id: "reimb-submitted",
                    label: "Total Diajukan",
                    value: totalReimbSubmitted,
                    type: "neutral",
                    subtitle: `${reimbursements.length} pengajuan`,
                  },
                  {
                    id: "reimb-pending",
                    label: "Menunggu Review",
                    value: totalReimbPending,
                    type: "neutral",
                    subtitle: `${pendingReimbList.length} butuh persetujuan`,
                  },
                  {
                    id: "reimb-approved",
                    label: "Siap Dicairkan",
                    value: totalReimbApproved,
                    type: "outflow",
                    subtitle: `${approvedReimbList.length} disetujui (belum cair)`,
                  },
                  {
                    id: "reimb-paid",
                    label: "Sudah Dicairkan",
                    value: totalReimbPaid,
                    type: "outflow",
                    subtitle: `${paidReimbList.length} transaksi kas`,
                  },
                ]}
                columnsCount={4}
              />
            </div>
          </div>
        )}

        {/* DIALOG 1: TINJAU & REVIEW PENGAJUAN BIAYA */}
        <AlertDialog open={!!reviewTarget} onOpenChange={(open) => { if (!open && !isSubmittingReview) setReviewTarget(null); }}>
          <AlertDialogContent className="border-border sm:max-w-md bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Tinjau Pengajuan Biaya: {reviewTarget?.id}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-3">
                <p>
                  Tentukan nominal yang disetujui untuk penggantian biaya operasional messenger. Nominal diajukan tidak akan hilang dan tercatat permanen.
                </p>

                {/* Information Card */}
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2 text-left">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Nama Messenger</span>
                      <span className="font-semibold text-foreground">{reviewTarget?.messengerName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Tanggal Pengeluaran</span>
                      <span className="font-medium text-foreground">{reviewTarget?.date}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Kategori</span>
                      <span className="font-medium text-foreground">{reviewTarget?.category}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Nomor Order</span>
                      <span className="font-mono text-foreground">{reviewTarget?.orderNo || "Tidak terikat order"}</span>
                    </div>
                  </div>

                  {reviewTarget?.note && (
                    <div className="pt-2 border-t border-border/50 text-xs">
                      <span className="text-muted-foreground block text-[11px]">Keterangan Messenger</span>
                      <p className="text-foreground italic">{reviewTarget.note}</p>
                    </div>
                  )}

                  {reviewTarget?.receiptUrl && (
                    <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Bukti Foto Struk / Kuitansi:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 text-xs text-emerald-600 gap-1"
                        onClick={() => setPreviewReceiptDoc({ url: reviewTarget.receiptUrl!, title: `Struk ${reviewTarget.id}` })}
                      >
                        <Eye className="w-3.5 h-3.5" /> Lihat Foto Kuitansi
                      </Button>
                    </div>
                  )}
                </div>

                {/* Form Controls */}
                <div className="space-y-3 pt-2 text-left">
                  <div>
                    <Label className="text-xs font-semibold text-foreground block mb-1">
                      Nominal Diajukan Messenger
                    </Label>
                    <Input
                      type="text"
                      disabled
                      value={formatRupiah(reviewTarget?.amount || 0)}
                      className="bg-muted text-foreground font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground block mb-1">
                      Nominal Disetujui Admin (Rp) *
                    </Label>
                    <Input
                      type="number"
                      value={reviewApprovedAmount}
                      onChange={(e) => setReviewApprovedAmount(e.target.value)}
                      placeholder="Masukkan nominal persetujuan"
                      className="text-sm font-bold text-foreground"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Default sesuai pengajuan ({formatRupiah(reviewTarget?.amount || 0)}). Dapat disesuaikan lebih kecil jika disetujui sebagian.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground block mb-1">
                      Catatan / Alasan Tim Finance {parseInt(reviewApprovedAmount || "0", 10) < (reviewTarget?.amount || 0) ? "(Wajib)" : "(Opsional)"}
                    </Label>
                    <Textarea
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Misal: Biaya bensin disetujui Rp 50.000 sesuai struk resmi SPBU"
                      className="text-xs"
                    />
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-2">
              <AlertDialogCancel disabled={isSubmittingReview} className="h-9 text-xs px-3 font-medium">
                Batal
              </AlertDialogCancel>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingReview}
                onClick={() => handleConfirmReview("Ditolak")}
                className="h-9 text-xs px-3 font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              >
                Tolak Pengajuan
              </Button>
              <Button
                type="button"
                disabled={isSubmittingReview}
                onClick={() => handleConfirmReview("Disetujui")}
                className="h-9 text-xs px-4 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmittingReview ? "Menyimpan..." : "Setujui Pengajuan"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* DIALOG 2: KONFIRMASI PENCAIRAN REIMBURSEMENT KE KAS MESSENGER */}
        <AlertDialog open={!!payoutTarget} onOpenChange={(open) => { if (!open && !isSubmittingPayout) setPayoutTarget(null); }}>
          <AlertDialogContent className="border-border sm:max-w-md bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Wallet className="w-4 h-4 text-emerald-600" />
                Konfirmasi Pencairan Kas Messenger
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-3">
                <p>
                  Pengeluaran kas sebesar nominal yang telah disetujui akan dibukukan secara otomatis ke dalam Buku Kas Messenger.
                </p>

                <div className="p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/15 space-y-2 text-left">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">ID Pengajuan:</span>
                    <span className="font-mono font-bold text-foreground">{payoutTarget?.id}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Penerima (Messenger):</span>
                    <span className="font-semibold text-foreground">{payoutTarget?.messengerName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Kategori Biaya:</span>
                    <span className="font-medium text-foreground">{payoutTarget?.category}</span>
                  </div>
                  {payoutTarget?.orderNo && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Order Terkait:</span>
                      <span className="font-mono text-foreground">{payoutTarget.orderNo}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 font-bold">
                    <span className="text-foreground">Nominal Pencairan:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(payoutTarget?.approvedAmount || payoutTarget?.amount || 0)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-1 text-left">
                  <div>
                    <Label className="text-xs font-semibold text-foreground block mb-1">
                      Kanal Pembukuan
                    </Label>
                    <Input
                      type="text"
                      disabled
                      value="Kas Messenger (Pengeluaran Operasional Kurir)"
                      className="bg-muted text-xs font-medium text-foreground"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground block mb-1">
                      Metode Pembayaran
                    </Label>
                    <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                      <SelectTrigger className="w-full h-9 text-xs bg-background">
                        <SelectValue placeholder="Pilih Metode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Kas Messenger (Tunai)">Kas Messenger (Tunai Lapangan)</SelectItem>
                        <SelectItem value="Transfer BCA">Transfer Rekening BCA</SelectItem>
                        <SelectItem value="Transfer Bank Lain">Transfer Bank Lain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-2">
              <AlertDialogCancel disabled={isSubmittingPayout} className="h-9 text-xs px-4 font-medium">
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isSubmittingPayout}
                onClick={handleConfirmPayout}
                className="h-9 text-xs px-4 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {isSubmittingPayout ? "Membukukan..." : "Cairkan & Catat ke Kas"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* DIALOG 3: PREVIEW FOTO STRUK / KUITANSI */}
        <DocumentPreviewModal
          isOpen={!!previewReceiptDoc}
          onClose={() => setPreviewReceiptDoc(null)}
          title={previewReceiptDoc?.title || "Pratinjau Kuitansi"}
          documentName="Foto Struk / Kuitansi Pengeluaran"
          rawUrl={previewReceiptDoc?.url}
          fileType="image"
        />
      </div>
    );
  }

  // ==========================================
  // 3. SUB-TAB: KAS KANTOR
  // ==========================================
  if (tab === "kas-kantor") {
    const kasKantorFields: FieldConfig[] = [
      { key: "tanggal", label: "Tanggal", type: "date" },
      { key: "status", label: "Tipe arus kas", type: "select", options: ["Debit (Masuk)", "Kredit (Keluar)"] },
      { key: "kategori", label: "Kategori Kas", type: "select", options: STANDARD_EXPENSE_CATEGORIES },
      { key: "nominal", label: "Nominal transaksi", type: "number", placeholder: "0" },
      { key: "keterangan", label: "Keterangan", type: "text", placeholder: "Contoh: Pembayaran invoice atau biaya sewa" },
      { key: "penanggungJawab", label: "Penanggung jawab", type: "select", options: responsibleOptions, placeholder: "Pilih penanggung jawab" },
      { key: "orderNo", label: "Nomor Order Terkait (Opsional)", type: "select", options: availableOrderOptions, placeholder: "Pilih order terkait jika ada" },
    ];

    const kasKantorColumns: Column[] = [
      { key: "tanggal", label: "Tanggal", filterable: true, filterType: "text" },
      { 
        key: "status", 
        label: "Status", 
        filterable: true, 
        filterType: "select", 
        filterOptions: ["Debit", "Kredit"] 
      },
      { 
        key: "kategori", 
        label: "Kategori", 
        filterable: true, 
        filterType: "select", 
        filterOptions: ["Semua", ...STANDARD_EXPENSE_CATEGORIES],
        render: (val: any) => val || "Operasional"
      },
      { key: "keterangan", label: "Keterangan" },
      { 
        key: "penanggungJawab", 
        label: "Penanggung jawab", 
        filterable: true, 
        filterType: "select", 
        filterOptions: responsibleOptions,
        render: (val: any) => val || "-"
      },
      { key: "debit", label: "Debit (masuk)" },
      { key: "kredit", label: "Kredit (keluar)" },
      { key: "total", label: "Saldo" },
    ];

    const totalDebit = kasKantorData.reduce((acc, item) => acc + item.debit, 0);
    const totalKredit = kasKantorData.reduce((acc, item) => acc + item.kredit, 0);
    const saldoAkhirKantor = totalDebit - totalKredit;

    const handleAddSubmit = (rows: any[]) => {
      rows.forEach((row) => {
        const isDebit = String(row.status || "").toLowerCase().includes("debit") || row.status === "Pemasukan";
        const nominal = parseInt(row.nominal) || parseInt(row.debit) || parseInt(row.kredit) || 0;
        addKasKantor({
          tanggal: row.tanggal || new Date().toLocaleDateString("id-ID"),
          status: isDebit ? "Debit" : "Kredit",
          kategori: row.kategori || STANDARD_EXPENSE_CATEGORIES[0],
          keterangan: row.keterangan || "",
          penanggungJawab: row.penanggungJawab || undefined,
          debit: isDebit ? nominal : 0,
          kredit: !isDebit ? nominal : 0,
          orderNo: extractOrderNo(row.orderNo),
          total: undefined, // Dihitung otomatis oleh saldo berjalan sistem
        });
      });
      setIsAdding(false);
      toast.success(`${rows.length} data kas kantor berhasil ditambahkan`);
    };

    if (isAdding) {
      return (
        <FinanceAddPage
          title="Tambah transaksi kas kantor"
          description="Catat arus kas masuk debit ataupun pengeluaran kas kredit kantor"
          fields={kasKantorFields}
          onBack={() => setIsAdding(false)}
          onSubmit={handleAddSubmit}
        />
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* Toolbar Rekonsiliasi & Tutup Kas */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Buku Kas Kantor</h2>
              <p className="text-xs text-muted-foreground">Pencatatan arus kas operasional harian dan rekonsiliasi kas fisik</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRekonsiliasiOpen(true)}
              className="h-8 text-xs font-semibold flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Rekonsiliasi & Tutup Kas Harian (A5)</span>
            </Button>
          </div>
        </div>

        {renderSubTabHeader("Kas Kantor", "Kelola transaksi kas kantor")}

        {/* Level 3: Table (Maximized Viewport Height with internal scrolling) */}
        <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-xs md:h-[calc(100vh-180px)] min-h-[500px] flex flex-col shrink-0">
          <EnhancedTableWithDialogs
            columns={kasKantorColumns}
            data={kasKantorData}
            subTabTitle="Kas Kantor"
            onAdd={() => setIsAdding(true)}
            onView={(item) => setViewingItem({ item, subTabTitle: "Kas kantor", columns: kasKantorColumns })}
            onEdit={(item, updated) => updateKasKantor(item.id, updated)}
            onDelete={(item) => deleteKasKantor(item.id)}
            searchPlaceholder="Cari berdasarkan keterangan transaksi..."
            editFields={kasKantorFields}
          />
        </Card>

        {/* Standardized Neutral Financial Summary in Normal Document Flow Below Table */}
        <div className="pt-2 pb-8 shrink-0">
          <FinanceSummary
            items={[
              {
                id: "debit",
                label: "Total Penerimaan (Debit)",
                value: totalDebit,
                type: "inflow",
                subtitle: "Pemasukan kas utama kantor",
              },
              {
                id: "kredit",
                label: "Total Pengeluaran (Kredit)",
                value: totalKredit,
                type: "outflow",
                subtitle: "Biaya sewa, gaji, dan utilitas",
              },
              {
                id: "saldo",
                label: "Saldo Kas Kantor",
                value: saldoAkhirKantor,
                type: "neutral",
                subtitle: "Saldo bersih kas operasional",
              },
            ]}
            columnsCount={3}
          />
        </div>

        <RekonsiliasiKasModal
          open={isRekonsiliasiOpen}
          onOpenChange={setIsRekonsiliasiOpen}
          kasTransactions={kasKantorData}
          currentUser={{
            nama: (() => {
              try {
                const u = localStorage.getItem("auth_user");
                if (u) return JSON.parse(u).nama || JSON.parse(u).name;
              } catch {}
              return "Kasir Operasional";
            })(),
            role: "finance",
          }}
        />
      </div>
    );
  }

  // ==========================================
  // 4. SUB-TAB: PENGELUARAN
  // ==========================================
  if (tab === "pengeluaran") {
    const pengeluaranFields: FieldConfig[] = [
      { key: "tanggal", label: "Tanggal pengeluaran", type: "date" },
      { key: "kategori", label: "Kategori Pengeluaran", type: "select", options: STANDARD_EXPENSE_CATEGORIES },
      { key: "keterangan", label: "Keterangan biaya", type: "text", placeholder: "Contoh: Listrik bulanan, ATK kantor" },
      { key: "penanggungJawab", label: "Penanggung jawab", type: "select", options: responsibleOptions, placeholder: "Pilih penanggung jawab" },
      { key: "orderNo", label: "Nomor Order Terkait (Opsional)", type: "select", options: availableOrderOptions, placeholder: "Pilih order jika terkait berkas" },
      { key: "nominal", label: "Nominal pengeluaran", type: "number", placeholder: "0" },
    ];

    const pengeluaranColumns: Column[] = [
      { key: "tanggal", label: "Tanggal", filterable: true, filterType: "text" },
      { 
        key: "kategori", 
        label: "Kategori", 
        filterable: true, 
        filterType: "select", 
        filterOptions: ["Semua", ...STANDARD_EXPENSE_CATEGORIES],
        render: (val: any) => val || "Operasional Kantor & Utilitas"
      },
      { key: "keterangan", label: "Keterangan pengeluaran", filterable: true, filterType: "text" },
      { 
        key: "penanggungJawab", 
        label: "Penanggung jawab", 
        filterable: true, 
        filterType: "select", 
        filterOptions: responsibleOptions,
        render: (val: any) => val || "-"
      },
      { key: "nominal", label: "Nominal" },
    ];

    const totalPengeluaranBulanIni = pengeluaranData.reduce((acc, item) => acc + item.nominal, 0);

    const handleAddSubmit = (rows: any[]) => {
      rows.forEach((row) => {
        addPengeluaran({
          tanggal: row.tanggal || new Date().toLocaleDateString("id-ID"),
          kategori: row.kategori || STANDARD_EXPENSE_CATEGORIES[0],
          keterangan: row.keterangan || "",
          penanggungJawab: row.penanggungJawab || undefined,
          nominal: parseInt(row.nominal) || 0,
          orderNo: extractOrderNo(row.orderNo),
        });
      });
      setIsAdding(false);
      toast.success(`${rows.length} data pengeluaran berhasil ditambahkan`);
    };

    if (isAdding) {
      return (
        <FinanceAddPage
          title="Tambah data pengeluaran"
          description="Catat biaya operasional, perlengkapan, atau utilitas kantor"
          fields={pengeluaranFields}
          onBack={() => setIsAdding(false)}
          onSubmit={handleAddSubmit}
        />
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {renderSubTabHeader("Pengeluaran", "Catat dan monitor seluruh pos pengeluaran operasional kantor")}

        {/* Level 3: Table */}
        <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs flex-1 flex flex-col min-h-0">
          <EnhancedTableWithDialogs
            columns={pengeluaranColumns}
            data={pengeluaranData}
            subTabTitle="Pengeluaran"
            onAdd={() => setIsAdding(true)}
            onView={(item) => setViewingItem({ item, subTabTitle: "Pengeluaran", columns: pengeluaranColumns })}
            onEdit={(item, updated) => updatePengeluaran(item.id, updated)}
            onDelete={(item) => deletePengeluaran(item.id)}
            searchPlaceholder="Cari berdasarkan keterangan pengeluaran..."
            editFields={pengeluaranFields}
          />
        </Card>

        {/* Level 3: Summary Cards (Requirement 4: MOVED BELOW TABLE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
          <Card className="p-4 border border-border bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total pengeluaran operasional</p>
                <h3 className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                  {formatRupiah(totalPengeluaranBulanIni)}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Akumulasi pengeluaran kantor</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border border-border bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Jumlah transaksi pengeluaran</p>
                <h3 className="text-xl font-bold text-foreground mt-1 tabular-nums">
                  {pengeluaranData.length} transaksi
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Item operasional tercatat</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ==========================================
  // 5. SUB-TAB: DATA PENJUALAN
  // ==========================================
  if (tab === "penjualan") {
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {renderSubTabHeader("Data Penjualan", "Kelola dan pantau data penjualan berkas", activeCategoryLabel)}
        <DataPenjualan />
      </div>
    );
  }

  // ==========================================
  // 6. SUB-TAB: TAGIHAN (REMOVED & REDIRECTED TO BELUM & KURANG BAYAR)
  // ==========================================
  if (tab === "tagihan") {
    return <Navigate to="/finance/belum-bayar" replace />;
  }

  // ==========================================
  // 7. SUB-TAB: LABA RUGI
  // ==========================================
  if (tab === "laba-rugi") {
    // Canonical Laba Rugi & Cash Flow Calculation (Phase C Architecture)
    const canonicalSummary = getCanonicalLabaRugi(filterPeriod, lrCustomStartDate, lrCustomEndDate);
    const {
      totalPemasukan,
      totalPengeluaran,
      labaRugiBersih,
      totalBiayaSamsat,
      totalPendapatanJasa,
      pengeluaranKantor,
      pengeluaranMessenger,
      realizedCashback,
      chartData: canonicalChartData,
      tablePemasukanCount,
      pendingUnpaidBalance,
      pendingProfit,
      pendingCashback,
      quarantinedCount,
      quarantinedAmount,
      quarantinedInvoices,
      anomalyInvoices,
      cashFlowReconciliation: summaryCashFlow,
    } = canonicalSummary as any;

    const cashFlow = summaryCashFlow || getCashFlowReconciliation(filterPeriod, lrCustomStartDate, lrCustomEndDate);

    const chartData = canonicalChartData && canonicalChartData.length > 0 ? canonicalChartData : [];
    const isChartEmpty = !chartData || chartData.length === 0 || chartData.every((d: any) => (d.pendapatan || 0) === 0 && (d.pengeluaran || 0) === 0 && (d.laba || 0) === 0);

    // Modern Chart Tooltip formatter
    const CustomChartTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-card border border-border p-3 rounded-lg shadow-md text-xs space-y-1.5 min-w-[180px]">
            <p className="font-semibold text-foreground border-b border-border/60 pb-1">Periode: {label}</p>
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}:
                </span>
                <span className="font-mono font-medium text-foreground">
                  {formatRupiah(entry.value)}
                </span>
              </div>
            ))}
          </div>
        );
      }
      return null;
    };

    const hasAnomalies = quarantinedCount > 0 || (anomalyInvoices && anomalyInvoices.length > 0);
    const perMessengerEntries = Object.entries(cashFlow.kasMessenger.perMessenger || {}) as [string, any][];

    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-6 pb-6">
        {/* ======================================================== */}
        {/* LAPISAN 1: REKONSILIASI ARUS KAS RIIL (CASH BASIS)       */}
        {/* ======================================================== */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Lapisan 1: Cash Basis
                </span>
                <h3 className="text-base md:text-lg font-bold tracking-tight text-foreground">
                  Rekonsiliasi Arus Kas Riil (Kas Kantor & Kas Messenger)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mutasi fisik uang tunai & rekening bank. Transfer internal antar-kas dieliminasi dari arus kas gabungan eksternal.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs font-normal border-border/80 bg-background/50 px-2.5 py-1">
                Filter: <span className="font-semibold text-foreground ml-1">{cashFlow.periodLabel}</span>
              </Badge>
            </div>
          </div>

          {/* 3 Cash Flow Cards: Kas Kantor, Kas Messenger, Rekapitulasi Gabungan */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Card 1: Kas Kantor */}
            <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Kas Kantor</h4>
                      <p className="text-[11px] text-muted-foreground">Rekening Bank & Brankas</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {cashFlow.kasKantor.transactionCount} Mutasi
                  </Badge>
                </div>

                <div className="space-y-2 mt-3 text-xs sm:text-sm">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Saldo Awal Periode:</span>
                    <span className="font-mono tabular-nums font-medium text-foreground">
                      {formatRupiah(cashFlow.kasKantor.saldoAwal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Uang Masuk (Debit):</span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatRupiah(cashFlow.kasKantor.totalMasuk)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Uang Keluar (Kredit):</span>
                    <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                      -{formatRupiah(cashFlow.kasKantor.totalKeluar)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border/60 flex justify-between items-center">
                <span className="text-xs font-semibold text-foreground">Saldo Akhir Kantor:</span>
                <span className="text-base font-bold font-mono tabular-nums text-foreground">
                  {formatRupiah(cashFlow.kasKantor.saldoAkhir)}
                </span>
              </div>
            </Card>

            {/* Card 2: Kas Messenger */}
            <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Kas Messenger</h4>
                      <p className="text-[11px] text-muted-foreground">Operasional Lapangan & Samsat</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {cashFlow.kasMessenger.transactionCount} Mutasi
                  </Badge>
                </div>

                <div className="space-y-2 mt-3 text-xs sm:text-sm">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Saldo Awal Periode:</span>
                    <span className="font-mono tabular-nums font-medium text-foreground">
                      {formatRupiah(cashFlow.kasMessenger.saldoAwal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Uang Masuk (Top Up/Cash):</span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatRupiah(cashFlow.kasMessenger.totalMasuk)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Uang Keluar (Samsat/Ops):</span>
                    <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                      -{formatRupiah(cashFlow.kasMessenger.totalKeluar)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border/60">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-foreground">Saldo Akhir Messenger:</span>
                  <span className="text-base font-bold font-mono tabular-nums text-foreground">
                    {formatRupiah(cashFlow.kasMessenger.saldoAkhir)}
                  </span>
                </div>
                {perMessengerEntries.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 p-0"
                    onClick={() => setIsMessengerBreakdownOpen(!isMessengerBreakdownOpen)}
                  >
                    <span>{isMessengerBreakdownOpen ? "Sembunyikan Rincian Kurir" : `Lihat Rincian ${perMessengerEntries.length} Kurir`}</span>
                    {isMessengerBreakdownOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </Button>
                )}
              </div>
            </Card>

            {/* Card 3: Rekapitulasi Arus Kas Bersih Gabungan */}
            <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Rekap Arus Kas Bersih</h4>
                      <p className="text-[11px] text-muted-foreground">Arus Kas Eksternal Gabungan</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                    Eliminasi Transfer
                  </span>
                </div>

                <div className="space-y-2 mt-3 text-xs sm:text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Penerimaan Eksternal Riil:</span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(cashFlow.rekapitulasiGabungan.totalPenerimaanEksternal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pengeluaran Eksternal Riil:</span>
                    <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                      {formatRupiah(cashFlow.rekapitulasiGabungan.totalPengeluaranEksternal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                    <span>(Setoran Samsat Riil di Kas):</span>
                    <span className="font-mono tabular-nums">
                      {formatRupiah(cashFlow.rekapitulasiGabungan.rincianPengeluaran.setoranSamsat)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border/60">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-foreground">Perubahan Kas Bersih:</span>
                  <span className={`text-base font-bold font-mono tabular-nums ${
                    cashFlow.rekapitulasiGabungan.perubahanKasBersih >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {cashFlow.rekapitulasiGabungan.perubahanKasBersih >= 0 ? "+" : ""}
                    {formatRupiah(cashFlow.rekapitulasiGabungan.perubahanKasBersih)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Transfer Internal Dieliminasi:</span>
                  <span className="font-mono">{formatRupiah(cashFlow.rekapitulasiGabungan.internalTransferEliminated.total)}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Collapsible Per-Messenger Breakdown */}
          {isMessengerBreakdownOpen && perMessengerEntries.length > 0 && (
            <Card className="p-4 border border-border/80 bg-muted/20 animate-in fade-in-50 duration-200">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Rincian Arus Kas per Kurir / Messenger ({perMessengerEntries.length} Personel)
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {perMessengerEntries.map(([name, item]) => (
                  <div key={name} className="p-3 rounded-lg bg-background border border-border text-xs space-y-1.5">
                    <div className="flex justify-between items-center pb-1.5 border-b border-border/40">
                      <span className="font-semibold text-foreground">{name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{item.transactionCount} tx</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Saldo Awal:</span>
                      <span className="font-mono">{formatRupiah(item.saldoAwal)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Uang Masuk:</span>
                      <span className="font-mono">+{formatRupiah(item.totalMasuk)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>Uang Keluar:</span>
                      <span className="font-mono">-{formatRupiah(item.totalKeluar)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/40">
                      <span>Saldo Akhir:</span>
                      <span className="font-mono">{formatRupiah(item.saldoAkhir)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ======================================================== */}
        {/* LAPISAN 2: LABA RUGI OPERASIONAL (AKRUAL / CANONICAL P&L) */}
        {/* ======================================================== */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Lapisan 2: Akrual / P&L
                </span>
                <h3 className="text-base md:text-lg font-bold tracking-tight text-foreground">
                  Laba Rugi Operasional & Margin Usaha (Canonical P&L)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pengakuan pendapatan sah proporsional, biaya pokok Samsat terverifikasi (COGS), dan beban usaha (OPEX non-transfer).
              </p>
            </div>
          </div>

          {/* Modern Chart with Granular Group-By & Custom Date Inputs */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base md:text-[17px] font-semibold tracking-tight text-foreground">
                  Grafik perbandingan pendapatan & pengeluaran
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visualisasi tren keuangan tersinkronisasi dengan filter periode aktif ({cashFlow.periodLabel})
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {filterPeriod === "custom" && (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      className="w-[125px] h-8 text-xs font-mono bg-background border-border"
                      value={lrCustomStartDate}
                      onChange={(e) => setLrCustomStartDate(e.target.value)}
                      placeholder="Mulai"
                    />
                    <span className="text-xs text-muted-foreground">s/d</span>
                    <Input
                      type="date"
                      className="w-[125px] h-8 text-xs font-mono bg-background border-border"
                      value={lrCustomEndDate}
                      onChange={(e) => setLrCustomEndDate(e.target.value)}
                      placeholder="Akhir"
                    />
                  </div>
                )}
                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                  <SelectTrigger className="w-[145px] bg-background border-border h-8 text-xs font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Semua Periode</SelectItem>
                    <SelectItem value="daily" className="text-xs">Harian</SelectItem>
                    <SelectItem value="weekly" className="text-xs">Mingguan</SelectItem>
                    <SelectItem value="monthly" className="text-xs">Bulanan</SelectItem>
                    <SelectItem value="yearly" className="text-xs">Tahunan</SelectItem>
                    <SelectItem value="custom" className="text-xs">Kustom (Rentang Tanggal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {isChartEmpty ? (
              <div className="h-[280px] w-full flex flex-col items-center justify-center text-center p-6 bg-muted/10 rounded-lg border border-dashed border-border/60">
                <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground mb-3">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Tidak Ada Aktivitas Keuangan Pada Periode Ini</h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Tidak ada mutasi pendapatan atau beban pengeluaran yang tercatat untuk filter waktu yang dipilih ({cashFlow.periodLabel}).
                </p>
              </div>
            ) : (
              <div className="h-[320px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis 
                      dataKey="bulan" 
                      tickLine={false} 
                      axisLine={{ stroke: 'hsl(var(--border))' }} 
                      fontSize={12} 
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      fontSize={11} 
                      tickFormatter={(val) => `${((Number(val) || 0) / 1000000).toLocaleString("id-ID")} jt`}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      wrapperStyle={{ paddingBottom: '16px', fontSize: '12px' }}
                    />
                    <Bar 
                      dataKey="pendapatan" 
                      name="Pendapatan" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]} 
                    />
                    <Bar 
                      dataKey="pengeluaran" 
                      name="Pengeluaran" 
                      fill="#f43f5e" 
                      radius={[4, 4, 0, 0]} 
                    />
                    <Bar 
                      dataKey="laba" 
                      name="Laba bersih" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Anomaly & Quarantine Drawer / Banner (Workstream 4) */}
          {hasAnomalies && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">
                      Karantina Pelaporan & Anomali Tarif ({quarantinedCount + (anomalyInvoices?.length || 0)} Transaksi Terdeteksi)
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Transaksi dengan anomali tarif atau data pengujian dieksklusi secara aman dari perhitungan P&L resmi untuk melindungi akurasi fiskal.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-amber-500/30 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 shrink-0"
                  onClick={() => setIsAnomalyDrawerOpen(!isAnomalyDrawerOpen)}
                >
                  {isAnomalyDrawerOpen ? "Tutup Inspeksi" : "Inspeksi Detail Anomali"}
                </Button>
              </div>

              {isAnomalyDrawerOpen && (
                <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2 text-xs">
                  {quarantinedInvoices.map((q: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-background/80 border border-border flex flex-col sm:flex-row justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">{q.invoiceNo || q.invoice}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/15 text-rose-600 dark:text-rose-400">
                            SUSPECTED_TEST_OR_DEMO_DATA
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5">{q.customer} ({q.layanan || "Layanan"}) - Order: {q.orderNo || "-"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-rose-500">{formatRupiah(Number(q.totalTagihan || q.total_tagihan || 0))}</p>
                        <p className="text-[10px] text-muted-foreground">Karantina Fiskal Eksplisit</p>
                      </div>
                    </div>
                  ))}
                  {anomalyInvoices.map((an: any, idx: number) => (
                    <div key={`an-${idx}`} className="p-2.5 rounded-lg bg-background/80 border border-border flex flex-col sm:flex-row justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">{an.invoiceNo}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            DATA_DISCREPANCY_WARNING
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5">{an.customer} - {an.anomalyReason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-amber-600">{formatRupiah(an.totalTagihan)}</p>
                        <p className="text-[10px] text-muted-foreground">Ditahan di Customer Advance</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3 Indikator Rekonsiliasi Finansial Terpending (Workstream 4 / REG-05) */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Rekonsiliasi Transaksi Terpending
            </h4>
            <FinanceSummary
              items={[
                {
                  id: "pending-unpaid",
                  label: "Belum & Kurang Bayar",
                  value: pendingUnpaidBalance,
                  type: "outflow",
                  subtitle: "Sisa piutang tagihan invoice aktif",
                },
                {
                  id: "pending-profit",
                  label: "Profit Terpending",
                  value: pendingProfit,
                  type: "inflow",
                  subtitle: "Customer Advance (Menunggu verifikasi tarif/SKKP)",
                },
                {
                  id: "pending-cashback",
                  label: "Cashback Terpending",
                  value: pendingCashback,
                  type: "outflow",
                  subtitle: "Komitmen rabat mitra belum dicairkan",
                },
              ]}
            />
          </div>

          {/* Ringkasan Laba Rugi Bersih Sah */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ringkasan Kinerja Laba Rugi Sah
            </h4>
            <FinanceSummary
              items={[
                {
                  id: "total-penerimaan-sah",
                  label: "Total Penerimaan Sah",
                  value: totalPemasukan,
                  type: "inflow",
                  subtitle: `${tablePemasukanCount} transaksi sah diakui`,
                },
                {
                  id: "total-beban-pengeluaran",
                  label: "Total Beban Pengeluaran",
                  value: totalPengeluaran,
                  type: "outflow",
                  subtitle: "Operasional kantor, kurir & samsat",
                },
                {
                  id: "laba-rugi-bersih",
                  label: "Laba Rugi Bersih",
                  value: labaRugiBersih,
                  type: labaRugiBersih >= 0 ? "inflow" : "outflow",
                  subtitle: labaRugiBersih >= 0 ? "Surplus profit bersih" : "Defisit operasional",
                },
              ]}
            />
          </div>

          {/* Level 3: Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
            <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs">
              <h4 className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/50">
                Rincian Pendapatan Sah
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">Penerimaan transaksi customer</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(totalPemasukan)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">Pendapatan jasa usaha biro</span>
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {formatRupiah(totalPendapatanJasa)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 font-semibold">
                  <span className="text-foreground">Total penerimaan kotor</span>
                  <span className="font-mono tabular-nums font-bold text-foreground text-sm">
                    {formatRupiah(totalPemasukan)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs">
              <h4 className="text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border/50">
                Rincian Beban & Pengeluaran Sah
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pengeluaran operasional kantor</span>
                  <span className="font-mono tabular-nums text-rose-500 font-medium">{formatRupiah(pengeluaranKantor)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Operasional lapangan & kurir</span>
                  <span className="font-mono tabular-nums text-rose-500 font-medium">{formatRupiah(pengeluaranMessenger)}</span>
                </div>
                {realizedCashback > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Cashback / rabat kemitraan</span>
                    <span className="font-mono tabular-nums text-rose-500 font-medium">{formatRupiah(realizedCashback)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Biaya samsat resmi terverifikasi</span>
                  <span className="font-mono tabular-nums text-rose-500 font-medium">{formatRupiah(totalBiayaSamsat)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/50 font-semibold">
                  <span className="text-foreground">Total beban pengeluaran</span>
                  <span className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {formatRupiah(totalPengeluaran)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DIRECT FALLBACK SUB-TABS: BELUM BAYAR, PROFIT PENDING, CASHBACK PENDING
  // ==========================================
  if (tab === "belum-bayar") {
    const totalPiutangMurni = belumBayarData.filter((d: any) => (d.status || d.statusPembayaran) === "Belum Bayar").reduce((acc: number, item: any) => acc + (item.sisaTagihan ?? item.kekurangan ?? item.sisa ?? 0), 0);
    const totalPiutangKurang = belumBayarData.filter((d: any) => (d.status || d.statusPembayaran) === "Kurang Bayar").reduce((acc: number, item: any) => acc + (item.sisaTagihan ?? item.kekurangan ?? item.sisa ?? 0), 0);
    const totalSemuaPiutang = totalPiutangMurni + totalPiutangKurang;

    const belumBayarColumns: Column[] = [
      { 
        key: "tanggalMasukBerkas", 
        label: "Tanggal Masuk Berkas", 
        filterable: true, 
        filterType: "text" as const,
        render: (val: string, item: any) => (
          <span className="font-mono text-[11px] text-muted-foreground/85 whitespace-nowrap">
            {formatDateDDMMYYYY(val || item.tanggal || "-")}
          </span>
        )
      },
      {
        key: "orderNo",
        label: "Nomor Order",
        filterable: true,
        filterType: "text" as const,
        render: (_val: any, item: any) => (
          <span className="font-mono text-[11px] text-muted-foreground/85 font-medium whitespace-nowrap">
            {item.orderNo || item.invoice || "-"}
          </span>
        ),
      },
      { 
        key: "nopol", 
        label: "Nomor Polisi", 
        filterable: true, 
        filterType: "text" as const,
        render: (value: string) => <PlateNumberBadge plate={value || "-"} />
      },
      { 
        key: "customer", 
        label: "Nama Customer", 
        filterable: true, 
        filterType: "text" as const,
        render: (value: string) => <span className="font-semibold text-foreground">{formatCustomerName(value)}</span>
      },
      {
        key: "phone",
        label: "Nomor Telepon/WhatsApp",
        render: (_val: any, item: any) => {
          const phone = item.phone || item.nomorHp || item.noHp || "";
          const hasPhone = phone && phone.replace(/[^0-9]/g, "").length >= 8;
          if (!hasPhone) {
            return <span className="text-muted-foreground text-xs italic">-</span>;
          }
          const cleanPhone = phone.replace(/[^0-9]/g, "");
          const waPhone = cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : (cleanPhone.startsWith("8") ? `62${cleanPhone}` : cleanPhone);
          const sisa = formatRupiah(item.sisaTagihan ?? item.kekurangan ?? item.sisa ?? 0);
          const isPartial = Boolean(
            item.isDraftEstimate ||
            item.is_draft_estimate ||
            item.costVerificationStatus === "PENDING_VERIFICATION" ||
            item.cost_verification_status === "PENDING_VERIFICATION"
          );
          const totalVal = formatRupiah(item.totalTagihan || item.totalBiaya || item.sisaTagihan || 0);
          const rawText = isPartial
            ? `Halo ${item.customer},

Kami dari Biro Jasa SUN89 menginformasikan estimasi biaya sementara untuk pengurusan ${item.pengurusan || item.jenisLayanan} (No. Polisi: ${item.nopol || "-"}, Order: ${item.orderNo || item.invoice || "-"}) sebesar ${totalVal}.

*Perhatian:*
Nominal di atas merupakan ESTIMASI SEMENTARA dan bukan tagihan final. Biaya final Samsat akan kami konfirmasikan kembali setelah verifikasi resmi berkas di Samsat.

Rekening Resmi Pembayaran:
Bank BCA: 7175095764
a/n ANISA SUSANTI (Biro Jasa SUN89)

Terima kasih atas kepercayaan Anda.`
            : `Halo ${item.customer},

kami dari Biro Jasa SUN89 menginformasikan tagihan pengurusan ${item.pengurusan || item.jenisLayanan} (No. Polisi: ${item.nopol || "-"}, Order: ${item.orderNo || item.invoice || "-"}) memiliki sisa tagihan sebesar ${sisa}.

Rekening Resmi Pembayaran:
Bank BCA: 7175095764
a/n ANISA SUSANTI (Biro Jasa SUN89)

Mohon konfirmasi jadwal pelunasan.
Terima kasih.`;
          const textMsg = encodeURIComponent(rawText);
          return (
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="text-xs font-mono text-muted-foreground">{phone}</span>
              <a
                href={`https://wa.me/${waPhone}?text=${textMsg}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 transition-colors"
                onClick={(e) => e.stopPropagation()}
                title={`Hubungi WA (${phone})`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          );
        },
      },
      { key: "pengurusan", label: "Jenis Pengurusan" },
      { 
        key: "totalTagihan", 
        label: "Total Tagihan",
        align: "right" as const,
        render: (val: number) => (
          <span className="font-mono tabular-nums text-xs font-medium text-foreground">
            {formatRupiah(val || 0)}
          </span>
        )
      },
      { 
        key: "uangMasuk", 
        label: "Uang Masuk dari Konsumen",
        align: "right" as const,
        render: (val: number, item: any) => (
          <span className="font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {formatRupiah(val ?? item.terbayar ?? item.dibayar ?? 0)}
          </span>
        )
      },
      { 
        key: "sisaTagihan", 
        label: "Sisa Tagihan",
        align: "right" as const,
        render: (val: number, item: any) => (
          <span className="font-mono tabular-nums text-xs font-bold text-rose-600 dark:text-rose-400">
            {formatRupiah(val ?? item.kekurangan ?? item.sisa ?? 0)}
          </span>
        )
      },
      { 
        key: "status", 
        label: "Status Pembayaran", 
        filterable: true, 
        filterType: "select" as const, 
        filterOptions: ["Belum Bayar", "Kurang Bayar"],
        render: (value: string, item: any) => {
          const st = value || item.statusPembayaran || "Belum Bayar";
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              st === "Kurang Bayar" 
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" 
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
            }`}>
              {st}
            </span>
          );
        }
      },
      { 
        key: "statusPengerjaan", 
        label: "Status Pengerjaan",
        render: (val: string, item: any) => {
          const baseStep = val || (item.currentStep ? `Tahap ${item.currentStep}` : "Dalam Proses");
          let gatingBadge = null;
          if (item.costVerificationStatus === "PENDING_VERIFICATION" || item.isDraftEstimate) {
            gatingBadge = (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" title="Menunggu verifikasi biaya Samsat (Tahap 6)">
                <Clock className="w-2.5 h-2.5" />
                <span>Menunggu Supervisi Biaya</span>
              </span>
            );
          } else if (item.isPaymentGated) {
            const reason = !item.hasFinalCost ? "Menunggu Biaya Final" : "Menunggu Supervisi Pembayaran";
            gatingBadge = (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" title={item.paymentGatingReason || "Menunggu persetujuan Supervisi"}>
                <Lock className="w-2.5 h-2.5" />
                <span>{reason}</span>
              </span>
            );
          }

          return (
            <div className="flex flex-col gap-1 items-start">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {baseStep}
              </span>
              {gatingBadge}
            </div>
          );
        }
      },
      { 
        key: "alasanPending", 
        label: "Alasan / Sumber",
        render: (val: string, item: any) => {
          const text = val || item.alasan || item.alasan_pending || "Penetapan biaya final pengurusan";
          return (
            <span className="text-xs text-muted-foreground line-clamp-1" title={text}>
              {text}
            </span>
          );
        }
      },
      {
        key: "aksi",
        label: "Aksi",
        render: (_val: any, item: any) => {
          const isGated = Boolean(item.isPaymentGated || item.costVerificationStatus === "PENDING_VERIFICATION" || item.isDraftEstimate);
          const gatingReason = item.costVerificationStatus === "PENDING_VERIFICATION" || item.isDraftEstimate
            ? "Estimasi Sementara: Menunggu verifikasi biaya Samsat"
            : (item.paymentGatingReason || (!item.hasFinalCost ? "Biaya Final Belum Ada" : "Menunggu persetujuan Supervisi"));

          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isGated}
                className={cn(
                  "h-6 px-2 text-[11px] gap-1 font-medium whitespace-nowrap",
                  isGated
                    ? "opacity-50 cursor-not-allowed text-muted-foreground border-border bg-muted/30"
                    : "text-primary hover:text-primary hover:bg-primary/5 border-primary/40"
                )}
                onClick={() => {
                  if (isGated) {
                    toast.warning(`Pembayaran belum dapat diproses: ${gatingReason}`);
                    return;
                  }
                  handleOpenLunasConfirm(item);
                }}
                title={isGated ? `Pembayaran ditahan: ${gatingReason}` : "Catat pembayaran atau pelunasan tagihan"}
              >
                <CheckCircle className="w-3 h-3 text-primary" />
                <span>Bayar / Lunasi</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] gap-1 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium whitespace-nowrap"
                onClick={() => setPrintInvoiceData(item)}
                title="Cetak Faktur Invoice Format A5"
              >
                <Printer className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                <span>Cetak</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted font-medium whitespace-nowrap"
                onClick={() => setViewingItem({ item, subTabTitle: "Belum & Kurang Bayar", columns: belumBayarColumns })}
                title="Lihat rincian lengkap transaksi"
              >
                <Eye className="w-3 h-3" />
                <span>Detail</span>
              </Button>
            </div>
          );
        }
      }
    ];

    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {renderSubTabHeader("Belum & Kurang Bayar", "Daftar tagihan customer yang memiliki sisa kewajiban pembayaran")}

        <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-xs md:h-[calc(100vh-140px)] min-h-[520px] flex flex-col shrink-0">
          <EnhancedTableWithDialogs
            columns={belumBayarColumns}
            data={belumBayarData}
            subTabTitle="Belum & Kurang Bayar"
            suppressTrailingActionColumn={true}
            onEdit={(item, updated) => updateInvoice(item.id, updated)}
            hideDeleteButton={true}
            searchPlaceholder="Cari nama customer, nomor polisi, nomor order..."
            hideAddButton={true}
            hideEditButton={true}
          />
        </Card>

        {/* Standardized Neutral Financial Summary in Normal Document Flow Below Table */}
        <div className="pt-2 pb-8 shrink-0">
          <FinanceSummary
            items={[
              {
                id: "total-piutang",
                label: "Total Sisa Piutang Belum Lunas",
                value: totalSemuaPiutang,
                type: "outflow", // Merah! (Hak kas yang belum tertagih)
                subtitle: "Akumulasi kewajiban tertagih customer",
              },
              {
                id: "tagihan-aktif",
                label: "Jumlah Tagihan Aktif",
                value: `${belumBayarData.length} tagihan`,
                type: "neutral",
                isCurrency: false,
                subtitle: "Menunggu pelunasan sisa pembayaran",
              },
            ]}
            columnsCount={2}
          />
        </div>

        {/* Modal Catat Pembayaran / Pelunasan Tagihan */}
        <AlertDialog
          open={!!lunasTargetItem}
          onOpenChange={(open) => {
            if (!open && !isSubmittingLunas && !isUploadingLunasProof) {
              actionFeedback.clearByPrefix("finance-lunas-");
              setLunasUnknownOutcome(false);
              setLunasTargetItem(null);
              setLunasProof(null);
              setTargetPayments([]);
            }
          }}
        >
          <AlertDialogContent className="border-border sm:max-w-lg bg-card max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <CheckCircle className="w-4 h-4 text-primary" />
                Catat Pembayaran / Pelunasan Tagihan
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-xs text-muted-foreground pt-1 space-y-3 text-left">
                  <p className="leading-relaxed">
                    Catat pembayaran cicilan atau pelunasan sisa tagihan customer. Setiap mutasi kas masuk wajib diverifikasi dengan bukti transfer/setoran valid.
                  </p>

                  {lunasUnknownOutcome && (
                    <div className="bg-amber-500/10 border border-amber-500/40 text-amber-800 dark:text-amber-300 p-2.5 rounded-md text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Status Pembayaran Sebelumnya Belum Terkonfirmasi</p>
                        <p className="text-[11px] opacity-90 mt-0.5">
                          Permintaan sebelumnya terputus atau timeout. Sistem mempertahankan kunci transaksi ({lunasIdempotencyKey.slice(0, 12)}...) agar percobaan ulang dengan nominal sama tidak menimbulkan pencatatan ganda. Periksa riwayat/status tagihan sebelum mengirim ulang.
                        </p>
                      </div>
                    </div>
                  )}

                  {lunasTargetItem && (
                    <div className="space-y-3">
                      {/* Ringkasan Tagihan */}
                      <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2 text-xs">
                        <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                          <span className="text-muted-foreground">No. Invoice / Order:</span>
                          <div className="flex items-center gap-2">
                            {lunasTargetItem.invoice && (
                              <span className="font-mono font-semibold text-foreground">{lunasTargetItem.invoice}</span>
                            )}
                            {lunasTargetItem.orderNo && (
                              <span className="font-mono text-muted-foreground text-[11px]">({lunasTargetItem.orderNo})</span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                          <span className="text-muted-foreground">Customer & Kendaraan:</span>
                          <span className="font-medium text-foreground">
                            {lunasTargetItem.customer} {lunasTargetItem.nopol ? `— ${lunasTargetItem.nopol}` : ""}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 border-b border-border/40">
                          <span className="text-muted-foreground">Jenis Pengurusan:</span>
                          <span className="font-medium text-foreground">
                            {lunasTargetItem.pengurusan || (lunasTargetItem as any).jenisLayanan || "Layanan Samsat"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                          <div className="p-2 rounded bg-background/60 border border-border/50">
                            <p className="text-[10px] text-muted-foreground">Total Tagihan</p>
                            <p className="text-xs font-semibold text-foreground font-mono mt-0.5">
                              {formatRupiah(lunasTargetItem.totalTagihan || 0)}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-background/60 border border-border/50">
                            <p className="text-[10px] text-muted-foreground">Sudah Terbayar</p>
                            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                              {formatRupiah(lunasTargetItem.terbayar ?? (lunasTargetItem as any).uangMasuk ?? 0)}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20">
                            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Sisa Tagihan</p>
                            <p className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                              {formatRupiah(lunasTargetItem.kekurangan ?? lunasTargetItem.sisa ?? 0)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Status Approval Supervisi & Biaya Final */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="font-medium">Biaya Final & Supervisi Disetujui</span>
                        </div>
                        {lunasTargetItem.spvApprovedAt && (
                          <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                            {lunasTargetItem.spvApprovedAt} {lunasTargetItem.spvName ? `(${lunasTargetItem.spvName})` : ""}
                          </span>
                        )}
                      </div>

                      {/* Pilihan Opsi Multi-Termin: Lunasi 100% vs Cicilan / Sebagian */}
                      <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg border border-border/60">
                        <button
                          type="button"
                          onClick={() => {
                            setLunasInstallmentMode("full");
                            const curSisa = Number(lunasTargetItem.kekurangan ?? lunasTargetItem.sisa ?? 0);
                            handleLunasAmountChange(curSisa);
                          }}
                          className={`h-7 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            lunasInstallmentMode === "full"
                              ? "bg-background text-primary shadow-xs border border-border/80 font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <CheckCircle className="w-3 h-3 text-primary" />
                          Lunasi Penuh (100%)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLunasInstallmentMode("partial");
                          }}
                          className={`h-7 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            lunasInstallmentMode === "partial"
                              ? "bg-background text-primary shadow-xs border border-border/80 font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Receipt className="w-3 h-3 text-amber-500" />
                          Cicilan / Termin Sebagian
                        </button>
                      </div>

                      {/* Input Nominal Pembayaran & Kalkulator Sisa */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-foreground block">
                            Nominal Pembayaran <span className="text-destructive">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const curSisa = Number(lunasTargetItem.kekurangan ?? lunasTargetItem.sisa ?? 0);
                              handleLunasAmountChange(curSisa);
                              setLunasInstallmentMode("full");
                            }}
                            className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1"
                          >
                            Lunasi Sisa ({formatRupiah(Number(lunasTargetItem.kekurangan ?? lunasTargetItem.sisa ?? 0))})
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                            Rp
                          </span>
                          <input
                            type="number"
                            min="1"
                            max={Number(lunasTargetItem.kekurangan ?? lunasTargetItem.sisa ?? 0)}
                            value={lunasAmount || ""}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              handleLunasAmountChange(val);
                              const curSisa = Number(lunasTargetItem.kekurangan ?? lunasTargetItem.sisa ?? 0);
                              if (val === curSisa) {
                                setLunasInstallmentMode("full");
                              } else {
                                setLunasInstallmentMode("partial");
                              }
                            }}
                            placeholder="0"
                            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono font-semibold"
                          />
                        </div>
                        {/* Kalkulator Sisa Berjalan */}
                        {(() => {
                          const curSisa = Number(lunasTargetItem.kekurangan ?? lunasTargetItem.sisa ?? 0);
                          const sisaBerjalan = Math.max(0, curSisa - lunasAmount);
                          return (
                            <div className="flex justify-between items-center px-2 py-1 rounded bg-muted/40 border border-border/40 text-[11px]">
                              <span className="text-muted-foreground">Sisa Tagihan Setelah Pembayaran Ini:</span>
                              <span className={`font-mono font-bold ${sisaBerjalan === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {formatRupiah(sisaBerjalan)} {sisaBerjalan === 0 ? "(Lunas Penuh)" : "(Kurang Bayar)"}
                              </span>
                            </div>
                          );
                        })()}
                        {(() => {
                          const curSisa = Number(lunasTargetItem.kekurangan ?? lunasTargetItem.sisa ?? 0);
                          if (lunasAmount <= 0) {
                            return (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium mt-1">
                                <AlertCircle className="w-3 h-3" />
                                Nominal pembayaran harus lebih besar dari Rp 0.
                              </p>
                            );
                          }
                          if (lunasAmount > curSisa) {
                            return (
                              <p className="text-[10px] text-destructive flex items-center gap-1 font-medium mt-1">
                                <AlertCircle className="w-3 h-3" />
                                Nominal melebihi sisa tagihan ({formatRupiah(curSisa)}). Kelebihan bayar dicatat di alur Cashback.
                              </p>
                            );
                          }
                          if (lunasAmount === curSisa && curSisa > 0) {
                            return (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium mt-1">
                                <CheckCircle className="w-3 h-3" />
                                Pembayaran ini akan melunasi seluruh sisa tagihan (Status akan menjadi Lunas).
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Baris Tanggal & Metode Pembayaran */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-foreground block">
                            Tanggal Pembayaran <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="date"
                            value={lunasDate}
                            onChange={(e) => {
                              actionFeedback.clearError("finance-lunas-submit");
                              setLunasDate(e.target.value);
                            }}
                            className="w-full h-9 px-3 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          {!lunasDate?.trim() && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                              Tanggal pembayaran wajib diisi.
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-foreground block">
                            Metode / Bank Kas Masuk <span className="text-destructive">*</span>
                          </label>
                          <select
                            value={lunasMethod}
                            onChange={(e) => {
                              actionFeedback.clearError("finance-lunas-submit");
                              setLunasMethod(e.target.value);
                            }}
                            className="w-full h-9 px-3 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-normal"
                          >
                            {activeMethods.length > 0 ? (
                              activeMethods.map((m) => (
                                <option key={m.id} value={m.nama_metode}>
                                  {m.nama_metode} ({m.bank}{m.nomor_rekening ? ` - ${m.nomor_rekening}` : ""})
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="Transfer BCA">Transfer BCA</option>
                                <option value="Transfer Mandiri">Transfer Mandiri</option>
                                <option value="Transfer BRI">Transfer BRI</option>
                                <option value="Kas Tunai">Kas Tunai</option>
                              </>
                            )}
                          </select>
                          {(() => {
                            const sel = paymentMethodStore.getAll().find((m) => m.nama_metode === lunasMethod);
                            if (sel && sel.status === "Nonaktif") {
                              return (
                                <p className="text-[10px] text-destructive mt-0.5">
                                  Metode ini berstatus Nonaktif dan tidak dapat digunakan.
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>

                      {/* Catatan Pembayaran */}
                      <div className="space-y-1 pt-1">
                        <label className="text-[11px] font-semibold text-foreground block">
                          Catatan Transaksi <span className="text-muted-foreground font-normal">(Opsional)</span>
                        </label>
                        <input
                          type="text"
                          value={lunasNotes}
                          onChange={(e) => setLunasNotes(e.target.value)}
                          placeholder="Contoh: DP Termin 2 / Pelunasan via Transfer M-Banking"
                          className="w-full h-9 px-3 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Unggah Bukti Pembayaran (Opsional) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-primary" />
                            Bukti Pembayaran / Struk Transfer <span className="text-muted-foreground font-normal">(Opsional)</span>
                          </label>
                          <span className={lunasProof ? "text-emerald-600 font-medium text-[10px]" : "text-muted-foreground font-medium text-[10px]"}>
                            {lunasProof ? "✓ Terlampir" : "Opsional"}
                          </span>
                        </div>

                        {lunasProof ? (
                          <div className="p-2 rounded border border-primary/30 bg-primary/10 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {lunasProof.fileType === "pdf" ? <FileIcon className="w-4 h-4 text-primary shrink-0" /> : <ImageIcon className="w-4 h-4 text-primary shrink-0" />}
                              <span className="font-mono text-[11px] truncate text-foreground">{lunasProof.fileName}</span>
                              <span className="text-[10px] text-muted-foreground uppercase">({lunasProof.fileType})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setLunasProof(null)}
                              className="text-destructive hover:text-destructive/80 p-1 text-xs"
                              title="Hapus / ganti berkas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center p-3 border border-dashed border-border rounded-lg bg-background hover:bg-muted/30 cursor-pointer transition-colors">
                            <Upload className="w-4 h-4 text-muted-foreground mb-1" />
                            <span className="text-[11px] font-medium text-foreground">
                              {isUploadingLunasProof ? "Mengunggah..." : "Klik untuk upload struk transfer / bukti setoran (JPG, PNG, PDF, HEIC)"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">Maksimal 5 MB (dikompres otomatis)</span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                              className="hidden"
                              disabled={isUploadingLunasProof || isSubmittingLunas}
                              onChange={handleUploadLunasProof}
                            />
                          </label>
                        )}
                        <ActionInlineError
                          compact
                          actionKey="finance-lunas-proof"
                          error={actionFeedback.getError("finance-lunas-proof")}
                          onDismiss={() => actionFeedback.clearError("finance-lunas-proof")}
                        />
                      </div>

                      {/* Riwayat Pembayaran Sebelumnya */}
                      <div className="pt-2 border-t border-border/50 space-y-1.5">
                        <p className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                          <span>Riwayat Pembayaran Terdaftar</span>
                          {isLoadingPayments && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </p>
                        <ActionInlineError
                          compact
                          actionKey="finance-lunas-history"
                          error={actionFeedback.getError("finance-lunas-history")}
                          onDismiss={() => actionFeedback.clearError("finance-lunas-history")}
                        />
                        {targetPayments.length > 0 ? (
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                            {targetPayments.map((p: any, idx: number) => {
                              const isVoid = Boolean(p.is_void || p.isVoid);
                              return (
                                <div
                                  key={p.id || idx}
                                  className={`p-2 rounded border text-[11px] flex items-center justify-between gap-2 transition-colors ${
                                    isVoid ? "bg-destructive/5 border-destructive/20 opacity-60" : "bg-muted/40 border-border/40"
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`font-semibold font-mono ${isVoid ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                        {formatRupiah(p.nominal || p.amount || 0)}
                                      </span>
                                      {isVoid && (
                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                                          BATAL (VOID)
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {p.tanggal_bayar || p.tanggal || "-"} • {p.metode_pembayaran || p.metodePembayaran || p.nama_bank || "Transfer"}
                                      {(p.keterangan || p.catatan) ? ` • ${p.keterangan || p.catatan}` : ""}
                                    </span>
                                    {isVoid && p.void_reason && (
                                      <span className="text-[9px] text-destructive/90 italic mt-0.5">
                                        Alasan: {p.void_reason} {p.voided_by ? `(oleh: ${p.voided_by})` : ""}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {!isVoid && (
                                      <>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                          {p.status_verifikasi || p.statusVerifikasi || "TERVERIFIKASI"}
                                        </span>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-6 px-1.5 text-[10px] gap-1 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium whitespace-nowrap"
                                          onClick={() => {
                                            setPrintKwitansiData({
                                              orderNo: lunasTargetItem.orderNo || lunasTargetItem.invoice || `ORD-${lunasTargetItem.id}`,
                                              invoiceNo: lunasTargetItem.invoice || lunasTargetItem.invoiceNo || `INV/${(lunasTargetItem.orderNo || "").replace(/^ORD-/, "")}`,
                                              kwitansiNo: `KW/${(lunasTargetItem.orderNo || "").replace(/^ORD-/, "")}/${p.id || "01"}`,
                                              customer: lunasTargetItem.customer || "Pelanggan",
                                              phone: lunasTargetItem.phone || (lunasTargetItem as any).nomorHp || "",
                                              nopol: lunasTargetItem.nopol || "-",
                                              layanan: lunasTargetItem.pengurusan || (lunasTargetItem as any).jenisLayanan || "Pengurusan Dokumen Kendaraan",
                                              tanggal: p.tanggal_bayar || p.tanggal || new Date().toISOString().split("T")[0],
                                              nominal: Number(p.nominal || p.amount || 0),
                                              totalTagihan: Number(lunasTargetItem.totalTagihan || 0),
                                              totalDibayar: Number(p.nominal || p.amount || 0),
                                              sisaTagihan: Math.max(0, Number(lunasTargetItem.totalTagihan || 0) - Number(p.nominal || p.amount || 0)),
                                              metodePembayaran: p.metode_pembayaran || p.metodePembayaran || "Transfer Bank",
                                              catatan: p.keterangan || p.catatan || undefined,
                                              kasirName: "Kasir SUN89",
                                            });
                                          }}
                                          title="Cetak Kwitansi Tanda Terima Setoran (A5 Landscape)"
                                        >
                                          <Printer className="w-2.5 h-2.5 text-slate-600 dark:text-slate-400" />
                                          <span>Kwitansi</span>
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2 rounded border border-border/30">
                            {isLoadingPayments ? "Memuat riwayat pembayaran..." : "Belum ada riwayat pembayaran tambahan sebelumnya."}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ActionInlineError
              actionKey="finance-lunas-submit"
              error={actionFeedback.getError("finance-lunas-submit")}
              onDismiss={() => actionFeedback.clearError("finance-lunas-submit")}
              onRetry={handleConfirmLunas}
              isRetrying={isSubmittingLunas}
              className="mt-2"
            />
            <AlertDialogFooter className="mt-4 gap-2">
              <AlertDialogCancel
                disabled={isSubmittingLunas || isUploadingLunasProof}
                onClick={() => {
                  actionFeedback.clearByPrefix("finance-lunas-");
                  setLunasUnknownOutcome(false);
                  setLunasTargetItem(null);
                  setLunasProof(null);
                  setTargetPayments([]);
                }}
                className="h-9 text-xs px-4 font-medium"
              >
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isSubmittingLunas || isUploadingLunasProof}
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmLunas();
                }}
                className="h-9 text-xs px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingLunas ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Simpan Pembayaran"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* MODAL CETAK INVOICE A5 RESMI */}
        <InvoiceA5Dialog
          open={!!printInvoiceData}
          onOpenChange={(open) => {
            if (!open) setPrintInvoiceData(null);
          }}
          data={printInvoiceData}
        />

        {renderKwitansiModal()}
      </div>
    );
  }

  if (tab === "profit-pending") {
    const filteredProfitPendingData = profitPendingData;

    const totalMasukPending = filteredProfitPendingData.reduce((acc: number, item: any) => acc + (item.totalUangMasuk || item.uangMasuk || 0), 0);
    const totalDanaTitipan = filteredProfitPendingData.reduce((acc: number, item: any) => acc + (item.danaTitipanPajak || item.biayaSamsat || 0), 0);
    const totalSelisihKas = filteredProfitPendingData.reduce((acc: number, item: any) => acc + (item.selisihKasSementara || 0), 0);
    const totalEstimasiProfit = filteredProfitPendingData.reduce((acc: number, item: any) => acc + (item.estimasiProfit || item.profit || 0), 0);

    const profitPendingColumns: Column[] = [
      { key: "tanggal", label: "Tanggal Order", filterable: true, filterType: "text" as const },
      {
        key: "orderNo",
        label: "Nomor Order",
        filterable: true,
        filterType: "text" as const,
        render: (_val: any, item: any) => (
          <span className="font-mono text-xs font-semibold text-primary">
            {item.orderNo || item.invoice || "-"}
          </span>
        ),
      },
      {
        key: "tanggalUangMasuk",
        label: "Tanggal Uang Masuk",
        render: (_val: any, item: any) => {
          const isPaid = Number(item.totalUangMasuk || item.uangMasuk || 0) > 0;
          if (!isPaid) return <span className="text-muted-foreground italic text-xs">-</span>;
          return <span className="font-mono text-[11px] text-muted-foreground/85 whitespace-nowrap">{formatDateDDMMYYYY(item.tanggalUangMasuk || item.tanggal || "-")}</span>;
        },
      },
      { 
        key: "nopol", 
        label: "Nomor Polisi", 
        filterable: true, 
        filterType: "text" as const,
        render: (value: string) => <PlateNumberBadge plate={value || "-"} />
      },
      { 
        key: "customer", 
        label: "Nama Customer", 
        filterable: true, 
        filterType: "text" as const,
        render: (value: string) => <span className="font-semibold text-foreground">{formatCustomerName(value)}</span>
      },
      { key: "pengurusan", label: "Jenis Pengurusan" },
      {
        key: "metodePencairan",
        label: "Metode Pencairan",
        filterable: true,
        filterType: "select" as const,
        filterOptions: ["Cash", "Transfer Bank"],
        render: (_val: any, item: any) => {
          const isPaid = Number(item.totalUangMasuk || item.uangMasuk || 0) > 0;
          if (!isPaid) {
            return <span className="text-xs text-muted-foreground italic">Belum terverifikasi</span>;
          }
          const cat = normalizePaymentCategory(item.metodePencairan || item.metodePembayaran || item.rekening || item.bank);
          const isCash = cat === "Cash";
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isCash
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
            }`}>
              {isCash ? "Cash (Tunai)" : "Transfer Bank"}
            </span>
          );
        },
      },
      {
        key: "namaBank",
        label: "Nama Bank",
        filterable: true,
        filterType: "text" as const,
        render: (_val: any, item: any) => {
          const cat = normalizePaymentCategory(item.metodePencairan || item.metodePembayaran || item.rekening || item.bank);
          if (cat === "Cash") {
            return <span className="text-xs text-muted-foreground font-mono">—</span>;
          }
          const bankName = item.namaBank || item.bank || (item.rekening && item.rekening !== "Cash" ? item.rekening : "—");
          return <span className="text-xs font-semibold text-foreground">{bankName || "—"}</span>;
        },
      },
      {
        key: "nomorRekening",
        label: "Nomor Rekening",
        render: (_val: any, item: any) => {
          const cat = normalizePaymentCategory(item.metodePencairan || item.metodePembayaran || item.rekening || item.bank);
          if (cat === "Cash") {
            return <span className="text-xs text-muted-foreground font-mono">—</span>;
          }
          const noRek = item.nomorRekening || item.noRekening;
          return noRek ? (
            <span className="text-xs font-mono text-muted-foreground">{noRek}</span>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">—</span>
          );
        },
      },
      {
        key: "namaPemilikRekening",
        label: "Nama Pemilik Rekening",
        render: (_val: any, item: any) => {
          const cat = normalizePaymentCategory(item.metodePencairan || item.metodePembayaran || item.rekening || item.bank);
          if (cat === "Cash") {
            return <span className="text-xs text-muted-foreground font-mono">—</span>;
          }
          const namaRek = item.namaPemilikRekening || item.namaRekening;
          return namaRek ? (
            <span className="text-xs font-medium text-foreground">{namaRek}</span>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">—</span>
          );
        },
      },
      { 
        key: "totalTagihan", 
        label: "Total Tagihan",
        align: "right" as const,
        render: (val: number) => (
          <span className="font-mono tabular-nums text-xs text-muted-foreground">
            {formatRupiah(val || 0)}
          </span>
        )
      },
      { 
        key: "totalUangMasuk", 
        label: "Total Terbayar",
        align: "right" as const,
        render: (val: number) => (
          <span className="font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {formatRupiah(val || 0)}
          </span>
        )
      },
      { 
        key: "danaTitipanPajak", 
        label: "Biaya Pokok Samsat",
        align: "right" as const,
        render: (val: number) => (
          <span className="font-mono tabular-nums text-xs text-rose-500 font-medium" title="Biaya pokok resmi Samsat/Kas Negara (Pass-through)">
            {formatRupiah(val || 0)}
          </span>
        )
      },
      { 
        key: "totalUangKeluarAktual", 
        label: "Uang Keluar Aktual",
        align: "right" as const,
        render: (val: number) => (
          <span className="font-mono tabular-nums text-xs text-rose-600 dark:text-rose-400">
            {formatRupiah(val || 0)}
          </span>
        )
      },
      { 
        key: "selisihKasSementara", 
        label: "Selisih Kas Sementara",
        align: "right" as const,
        render: (val: number) => (
          <span className="font-mono tabular-nums text-xs font-bold text-foreground">
            {formatRupiah(val || 0)}
          </span>
        )
      },
      { 
        key: "estimasiProfit", 
        label: "Estimasi Profit",
        align: "right" as const,
        render: (val: number) => (
          <div className="flex flex-col items-end">
            <span className="font-mono tabular-nums text-xs font-bold text-amber-600 dark:text-amber-400">
              {formatRupiah(val || 0)}
            </span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
              (Estimasi)
            </span>
          </div>
        )
      },
      { 
        key: "statusPengerjaan", 
        label: "Status Pengerjaan",
        render: (val: string, item: any) => (
          <div className="flex flex-col">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {val || (item.currentStep ? `Tahap ${item.currentStep}` : "Proses")}
            </span>
          </div>
        )
      },
      { 
        key: "invoice", 
        label: "Invoice",
        render: (val: string) => <span className="font-mono text-[11px] text-muted-foreground/85 font-medium whitespace-nowrap">{val || "-"}</span>
      },
      {
        key: "aksi",
        label: "Aksi",
        render: (_val: any, item: any) => {
          const ordNo = item.orderNo || item.invoice || "";
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-500/40 font-semibold whitespace-nowrap"
                onClick={() => {
                  setClosingTargetItem(item);
                  setClosingPenerima(item.customer || "");
                  setClosingNotes("");
                }}
                title="Penyerahan berkas fisik STNK/BPKB ke customer & Realisasikan Profit ke Laba Rugi"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Closing & Selesai</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary hover:bg-primary/5 border-primary/40 font-medium whitespace-nowrap"
                onClick={() => {
                  const targetUrl = ordNo ? `/order/tracking?orderNo=${encodeURIComponent(ordNo)}` : `/order/tracking`;
                  navigate(targetUrl);
                }}
                title="Lacak progres berkas di Order Tracking"
              >
                <ArrowUpRight className="w-3 h-3 text-primary" />
                <span>Lacak</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted font-medium whitespace-nowrap"
                onClick={() => setViewingItem({ item, subTabTitle: "Profit Terpending", columns: profitPendingColumns })}
                title="Lihat rincian transaksi"
              >
                <Eye className="w-3 h-3" />
                <span>Detail</span>
              </Button>
            </div>
          );
        },
      },
    ];

    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {renderSubTabHeader("Profit Terpending", "Transaksi lunas yang proses pengerjaannya sedang berjalan")}



        <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-xs md:h-[calc(100vh-140px)] min-h-[520px] flex flex-col shrink-0">
          <EnhancedTableWithDialogs
            columns={profitPendingColumns}
            data={filteredProfitPendingData}
            subTabTitle="Profit Terpending"
            suppressTrailingActionColumn={true}
            searchPlaceholder="Cari nama customer, nomor polisi, invoice, alasan..."
            hideAddButton={true}
            hideEditButton={true}
            hideDeleteButton={true}
          />
        </Card>

        {/* Standardized Neutral Financial Summary in Normal Document Flow Below Table */}
        <div className="pt-2 pb-8 shrink-0">
          <FinanceSummary
            items={[
              {
                id: "masuk-pending",
                label: "Total Uang Masuk Terverifikasi",
                value: totalMasukPending,
                type: "inflow",
                subtitle: `${filteredProfitPendingData.length} order lunas berjalan`,
              },
              {
                id: "titipan-samsat",
                label: "Dana Titipan Samsat (Pass-Through)",
                value: totalDanaTitipan,
                type: "outflow",
                subtitle: "Kewajiban pajak ke kas negara",
              },
              {
                id: "selisih-kas",
                label: "Selisih Kas Sementara",
                value: totalSelisihKas,
                type: "neutral",
                subtitle: "Uang masuk - beban aktual",
              },
              {
                id: "estimasi-profit",
                label: "Total Estimasi Profit",
                value: totalEstimasiProfit,
                type: "neutral",
                subtitle: "Menunggu pengerjaan tuntas",
              },
            ]}
            columnsCount={4}
          />
        </div>

        {renderClosingModal()}
        {renderKwitansiModal()}
        {renderVoidHistoryModal()}
      </div>
    );
  }

    if (tab === "cashback-pending") {
    const displayCashbackData = cashbackPendingData.filter(
      (item: any) => !dismissedCashbackIds.has(item.id) && (!item.orderNo || !dismissedCashbackIds.has(item.orderNo))
    );

    const totalKelebihan = displayCashbackData.reduce((acc: number, item: any) => acc + (item.nominalKelebihan || item.jumlahCashback || 0), 0);
    const totalPendingCount = displayCashbackData.filter((item: any) => item.status !== "Dibayar" && !paidCashbackIds.has(item.id) && (!item.orderNo || !paidCashbackIds.has(item.orderNo))).length;
    const totalSudahDibayarCount = displayCashbackData.length - totalPendingCount;

    const cashbackPendingColumns: Column[] = [
      { 
        key: "tanggalMasukBerkas", 
        label: "Tanggal Masuk Berkas", 
        filterable: true, 
        filterType: "text" as const,
        render: (val: string, item: any) => (
          <span className="font-mono text-[11px] text-muted-foreground/85 whitespace-nowrap">
            {formatDateDDMMYYYY(val || item.tanggal || "-")}
          </span>
        ),
      },
      { 
        key: "orderNo", 
        label: "Nomor Order", 
        filterable: true, 
        filterType: "text" as const,
        render: (_val: any, item: any) => (
          <span className="font-mono text-[11px] text-muted-foreground/85 font-medium whitespace-nowrap">
            {item.orderNo || item.invoice || "-"}
          </span>
        ),
      },
      { 
        key: "nopol", 
        label: "Nomor Polisi", 
        filterable: true, 
        filterType: "text" as const,
        render: (value: string) => <PlateNumberBadge plate={value || "-"} />
      },
      { 
        key: "customer", 
        label: "Nama Customer", 
        filterable: true, 
        filterType: "text" as const,
        render: (value: string) => <span className="font-semibold text-foreground">{formatCustomerName(value)}</span>
      },
      {
        key: "phone",
        label: "Nomor Telepon/WhatsApp",
        render: (_val: any, item: any) => {
          const phone = item.phone || item.nomorHp || item.noHp || "";
          const hasPhone = phone && phone.replace(/[^0-9]/g, "").length >= 8;
          if (!hasPhone) {
            return <span className="text-muted-foreground text-xs italic">-</span>;
          }
          const cleanPhone = phone.replace(/[^0-9]/g, "");
          const waPhone = cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : (cleanPhone.startsWith("8") ? `62${cleanPhone}` : cleanPhone);
          const sisaKelebihan = formatRupiah(item.nominalKelebihan || item.jumlahCashback || 0);
          const textMsg = encodeURIComponent(
            `Halo ${item.customer}, kami dari Biro Jasa SUN89 menginformasikan ada pengembalian dana / kelebihan bayar pengurusan ${item.pengurusan || item.jenisLayanan} (No. Polisi: ${item.nopol || "-"}, Order: ${item.orderNo || item.invoice || "-"}) sebesar ${sisaKelebihan}. Mohon konfirmasi rekening tujuan pengembalian. Terima kasih.`
          );
          return (
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="text-xs font-mono text-muted-foreground">{phone}</span>
              <a
                href={`https://wa.me/${waPhone}?text=${textMsg}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 transition-colors"
                onClick={(e) => e.stopPropagation()}
                title={`Hubungi WA (${phone})`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          );
        },
      },
      { key: "pengurusan", label: "Jenis Pengurusan" },
      { 
        key: "uangMasuk", 
        label: "Uang Masuk dari Konsumen",
        align: "right" as const,
        render: (val: number, item: any) => (
          <span className="font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {formatRupiah(val ?? item.terbayar ?? item.dibayar ?? 0)}
          </span>
        )
      },
      { 
        key: "totalTagihan", 
        label: "Total Tagihan",
        align: "right" as const,
        render: (val: number) => (
          <span className="font-mono tabular-nums text-xs font-medium text-foreground">
            {formatRupiah(val || 0)}
          </span>
        )
      },
      { 
        key: "nominalKelebihan", 
        label: "Kelebihan Bayar",
        align: "right" as const,
        render: (val: number, item: any) => {
          const amount = Number(val ?? item.jumlahCashback ?? 0);
          return (
            <span className="font-mono tabular-nums text-xs font-bold text-blue-600 dark:text-blue-400">
              {amount > 0 ? formatRupiah(amount) : "-"}
            </span>
          );
        }
      },
      { 
        key: "status", 
        label: "Status",
        filterable: true,
        filterType: "select" as const,
        filterOptions: ["Pending", "Dibayar", "Menunggu Supervisi"],
        render: (val: string, item: any) => {
          const isPaid = paidCashbackIds.has(item.id) || (item.orderNo && paidCashbackIds.has(item.orderNo)) || val === "Dibayar";
          if (isPaid) {
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                Dibayar
              </span>
            );
          }
          if (item.isPayoutGated) {
            const reason = !item.hasFinalCost ? "Biaya Final Belum Ada" : "Menunggu Supervisi";
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" title={item.payoutGatingReason || "Menunggu persetujuan Supervisi (Stage 6)"}>
                <Lock className="w-2.5 h-2.5" />
                <span>{reason}</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              Pending
            </span>
          );
        }
      },
      {
        key: "aksi",
        label: "Aksi",
        render: (_val: any, item: any) => {
          const isPaid = paidCashbackIds.has(item.id) || (item.orderNo && paidCashbackIds.has(item.orderNo)) || item.status === "Dibayar";
          const isGated = Boolean(item.isPayoutGated);
          const gatingReason = item.payoutGatingReason || (!item.hasFinalCost ? "Biaya Final Belum Ada" : "Menunggu persetujuan Supervisi (Stage 6)");

          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {isPaid ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2.5 text-[11px] gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-500/40 font-semibold whitespace-nowrap"
                    onClick={() => {
                      actionFeedback.clearError("finance-cashback-selesai");
                      setSelesaiInfoItem(item);
                    }}
                    title="Selesaikan transaksi cashback yang sudah dicairkan"
                  >
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    <span>Selesai</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium whitespace-nowrap"
                    onClick={() => {
                      setPrintVoucherData({
                        orderNo: item.orderNo || item.invoice || `ORD-${item.id}`,
                        invoiceNo: item.invoice || (item.orderNo ? `INV/${item.orderNo.replace(/^ORD-/, "")}` : "INV-001"),
                        voucherNo: `VCR-REF/${(item.orderNo || `ORD-${item.id}`).replace(/^ORD-/, "")}`,
                        customer: item.customer || "Konsumen",
                        phone: item.phone || item.nomorHp || "",
                        nopol: item.nopol || "-",
                        layanan: item.pengurusan || item.jenisLayanan || "Pengurusan Dokumen Kendaraan",
                        tanggal: item.tanggalMasukBerkas || item.tanggal || new Date().toISOString().split("T")[0],
                        nominal: Number(item.nominalKelebihan || item.jumlahCashback || 0),
                        metode: "Transfer Bank",
                        bank: item.bank || "BCA",
                        noRekening: item.noRekening || "-",
                        namaRekening: item.customer || "Konsumen",
                        catatan: "Bukti Voucher Pengeluaran Kas (Refund)",
                        approvedBy: "Supervisor Finansial",
                        kasirName: "Kasir SUN89",
                      });
                    }}
                    title="Cetak Voucher Pengeluaran Kas (Bukti Refund A5)"
                  >
                    <Printer className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                    <span>Cetak</span>
                  </Button>
                  {isSpvOrAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 font-medium whitespace-nowrap"
                      onClick={() => {
                        actionFeedback.clearError("finance-cashback-void");
                        setVoidTargetCashback({
                          invoiceId: item.id,
                          nominal: Number(item.nominalKelebihan || item.jumlahCashback || 0),
                          orderNo: item.orderNo || item.invoice || `INV-${item.id}`,
                          customer: item.customer || "Konsumen"
                        });
                        setVoidReasonText("");
                      }}
                      title="Batalkan pencairan cashback (Koreksi kas kantor dan pulihkan status)"
                    >
                      <Undo2 className="w-2.5 h-2.5 text-destructive" />
                      <span>Void</span>
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGated}
                  className={cn(
                    "h-6 px-2.5 text-[11px] gap-1 font-semibold whitespace-nowrap",
                    isGated
                      ? "opacity-50 cursor-not-allowed text-muted-foreground border-border bg-muted/30"
                      : "text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-blue-500/40"
                  )}
                  onClick={() => {
                    if (isGated) {
                      toast.warning(`Pencairan belum dapat diproses: ${gatingReason}`);
                      return;
                    }
                    handleOpenCashbackConfirm(item);
                  }}
                  title={isGated ? `Pencairan belum dapat diproses: ${gatingReason}` : "Cairkan pengembalian kelebihan bayar"}
                >
                  <CheckCircle className="w-3 h-3 text-blue-600" />
                  <span>Cairkan</span>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted font-medium whitespace-nowrap"
                onClick={() => setViewingItem({ item, subTabTitle: "Cashback terpending", columns: cashbackPendingColumns })}
                title="Lihat rincian transaksi"
              >
                <Eye className="w-3 h-3" />
                <span>Detail</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground border-border hover:bg-muted font-medium"
                onClick={() => handleOpenEditCashback(item)}
                title="Edit data transaksi cashback"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit</span>
              </Button>
            </div>
          );
        }
      }
    ];

    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {renderSubTabHeader("Cashback Terpending", "Kewajiban pengembalian kelebihan bayar kepada customer")}
        


        <Card className="p-3.5 sm:p-4 border border-border bg-card shadow-xs md:h-[calc(100vh-140px)] min-h-[520px] flex flex-col shrink-0">
          <EnhancedTableWithDialogs
            columns={cashbackPendingColumns}
            data={displayCashbackData}
            subTabTitle="Cashback Terpending"
            suppressTrailingActionColumn={true}
            hideDeleteButton={true}
            searchPlaceholder="Cari nama customer, nomor polisi, order..."
            hideAddButton={true}
            hideEditButton={true}
          />
        </Card>

        {/* Standardized Neutral Financial Summary in Normal Document Flow Below Table */}
        <div className="pt-2 pb-8 shrink-0">
          <FinanceSummary
            items={[
              {
                id: "kelebihan-pembayaran",
                label: "Kelebihan Pembayaran Pelanggan",
                value: totalKelebihan,
                type: "outflow", // Merah! (Kewajiban pengembalian kas ke customer)
                subtitle: `${displayCashbackData.length} total transaksi pengembalian dana`,
              },
              {
                id: "menunggu-pencairan",
                label: "Status Menunggu Pencairan",
                value: `${totalPendingCount} transaksi`,
                type: "neutral",
                isCurrency: false,
                subtitle: "Siap diproses pengembalian kas",
              },
              {
                id: "selesai-dicairkan",
                label: "Sudah Selesai Dicairkan",
                value: `${totalSudahDibayarCount} transaksi`,
                type: "neutral",
                isCurrency: false,
                subtitle: "Tekan tombol Selesai untuk membersihkan antrean",
              },
            ]}
            columnsCount={3}
          />
        </div>

        {/* Modal Konfirmasi Pencairan Cashback / Refund (Dua Kolom Desktop, Field Rapih) */}
        <AlertDialog
          open={!!cashbackTargetItem}
          onOpenChange={(open) => {
            if (!open && !isSubmittingCashback && !isUploadingCashbackProof) {
              if (cashbackTargetItem) {
                payoutIntentManager.cancelDraft(cashbackTargetItem.id);
              }
              actionFeedback.clearByPrefix("finance-cashback-");
              setCashbackUnknownOutcome(false);
              setCashbackTargetItem(null);
              setCashbackProof(null);
            }
          }}
        >
          <AlertDialogContent className="border-border sm:max-w-2xl lg:max-w-3xl bg-card max-h-[92vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                Konfirmasi Pencairan Cashback / Refund
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground pt-1">
                Catat pengeluaran kas kantor untuk pengembalian kelebihan bayar customer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {cashbackTargetItem &&
              (cashbackUnknownOutcome ||
                payoutIntentManager.getIntent(cashbackTargetItem.id)?.status === "UNKNOWN_OUTCOME") && (
              <div className="bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-400 p-2.5 rounded-md text-xs flex items-start gap-2 my-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Status Pencairan Sebelumnya Belum Terkonfirmasi</p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    Percobaan sebelumnya terganggu koneksi atau timeout sehingga hasilnya belum dapat dipastikan (bukan dianggap berhasil ataupun gagal). Kunci idempotensi ({cashbackIdempotencyKey ? `${cashbackIdempotencyKey.slice(0, 8)}...` : "-"}) tetap dipertahankan agar percobaan ulang tidak menyebabkan mutasi kas ganda.
                  </p>
                </div>
              </div>
            )}

            {cashbackTargetItem && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                {/* Kolom 1: Ringkasan Order & Kelebihan Bayar */}
                <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-2.5 text-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="font-semibold text-foreground text-xs border-b border-border/50 pb-1.5 flex items-center justify-between">
                      <span>Rincian Order</span>
                      <span className="font-mono text-primary font-bold text-[11px]">{cashbackTargetItem.orderNo || cashbackTargetItem.invoice}</span>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Nomor Polisi:</span>
                      <span className="font-semibold text-foreground">{cashbackTargetItem.nopol || "-"}</span>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Nama Customer:</span>
                      <span className="font-medium text-foreground">{formatCustomerName(cashbackTargetItem.customer || "-")}</span>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">No. Telepon / WA:</span>
                      <span className="font-mono text-muted-foreground text-[11px]">{cashbackTargetItem.phone || cashbackTargetItem.nomorHp || "-"}</span>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Tanggal Berkas:</span>
                      <span className="text-foreground">{cashbackTargetItem.tanggalMasukBerkas || cashbackTargetItem.tanggal || "-"}</span>
                    </div>

                    <div className="flex justify-between items-center py-0.5 border-t border-border/40 pt-1.5">
                      <span className="text-muted-foreground">Total Uang Masuk:</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(cashbackTargetItem.uangMasuk ?? cashbackTargetItem.terbayar ?? 0)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Total Tagihan:</span>
                      <span className="font-mono font-medium text-foreground">
                        {formatRupiah(cashbackTargetItem.totalTagihan || 0)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-0.5 border-t border-border/40 pt-1.5">
                      <span className="text-muted-foreground font-medium">Kelebihan Bayar:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                        {formatRupiah(cashbackTargetItem.nominalKelebihan || cashbackTargetItem.jumlahCashback || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-center">
                    <p className="text-[10px] text-muted-foreground">Nominal yang Akan Dicairkan:</p>
                    <p className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                      {formatRupiah(cashbackAmount || cashbackTargetItem.nominalKelebihan || cashbackTargetItem.jumlahCashback || 0)}
                    </p>
                  </div>
                </div>

                {/* Kolom 2: Form Input Pencairan Kas */}
                <div className="space-y-3 text-xs">
                  {/* Nominal yang Dicairkan */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-foreground block">
                        Nominal yang Dicairkan <span className="text-destructive">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          actionFeedback.clearError("finance-cashback-submit");
                          setCashbackAmount(Number(cashbackTargetItem.nominalKelebihan || cashbackTargetItem.jumlahCashback || 0));
                        }}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Maksimal ({formatRupiah(Number(cashbackTargetItem.nominalKelebihan || cashbackTargetItem.jumlahCashback || 0))})
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        Rp
                      </span>
                      <input
                        type="number"
                        min="1"
                        max={Number(cashbackTargetItem.nominalKelebihan || cashbackTargetItem.jumlahCashback || 0)}
                        value={cashbackAmount || ""}
                        onChange={(e) => {
                          actionFeedback.clearError("finance-cashback-submit");
                          setCashbackAmount(Number(e.target.value));
                        }}
                        className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono font-semibold"
                      />
                    </div>
                    {cashbackAmount <= 0 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                        Nominal pencairan harus lebih dari Rp 0.
                      </p>
                    )}
                    {Number(cashbackTargetItem.nominalKelebihan || cashbackTargetItem.jumlahCashback || 0) > 0 &&
                      cashbackAmount > Number(cashbackTargetItem.nominalKelebihan || cashbackTargetItem.jumlahCashback || 0) && (
                        <p className="text-[10px] text-destructive mt-0.5">
                          Nominal melebihi batas saldo ({formatRupiah(Number(cashbackTargetItem.nominalKelebihan || cashbackTargetItem.jumlahCashback || 0))}).
                        </p>
                    )}
                  </div>

                  {/* Tanggal Pengeluaran Kas + Checkbox Hari Ini */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-foreground block">
                        Tanggal Pengeluaran Kas <span className="text-destructive">*</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isCashbackToday}
                          onChange={(e) => {
                            actionFeedback.clearError("finance-cashback-submit");
                            setIsCashbackToday(e.target.checked);
                            if (e.target.checked) {
                              setCashbackDate(new Date().toISOString().split("T")[0]);
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                        />
                        <span>Hari Ini</span>
                      </label>
                    </div>
                    <input
                      type="date"
                      value={cashbackDate}
                      onChange={(e) => {
                        actionFeedback.clearError("finance-cashback-submit");
                        setCashbackDate(e.target.value);
                        setIsCashbackToday(e.target.value === new Date().toISOString().split("T")[0]);
                      }}
                      className="w-full h-9 px-3 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-normal"
                    />
                    {!cashbackDate?.trim() && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                        Tanggal pengeluaran kas wajib diisi.
                      </p>
                    )}
                  </div>

                  {/* Metode Pembayaran Keluar */}
                  {(() => {
                    const allMethods = paymentMethodStore.getAll();
                    const matchedStoredMethod = allMethods.find((m) => m.nama_metode === cashbackMethod);
                    const isMethodInactive = matchedStoredMethod?.status === "Nonaktif";
                    const currentSelectedMethod = activeMethods.find((m) => m.nama_metode === cashbackMethod);
                    const isCash =
                      currentSelectedMethod?.bank === "Tunai" ||
                      cashbackMethod.toLowerCase().includes("cash") ||
                      cashbackMethod.toLowerCase().includes("tunai") ||
                      cashbackBank === "Tunai";

                    return (
                      <>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-foreground block">
                            Metode Pembayaran Keluar <span className="text-destructive">*</span>
                          </label>
                          <select
                            value={cashbackMethod}
                            onChange={(e) => {
                              actionFeedback.clearError("finance-cashback-submit");
                              const selectedName = e.target.value;
                              setCashbackMethod(selectedName);
                              const foundM = activeMethods.find((m) => m.nama_metode === selectedName);
                              const nextIsCash =
                                foundM?.bank === "Tunai" ||
                                selectedName.toLowerCase().includes("cash") ||
                                selectedName.toLowerCase().includes("tunai");
                              if (nextIsCash) {
                                setCashbackBank("Tunai");
                                setCashbackNoRekening("");
                              } else {
                                if (cashbackBank === "Tunai") {
                                  setCashbackBank(foundM?.bank || "BCA");
                                }
                              }
                            }}
                            className="w-full h-9 px-3 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-normal"
                          >
                            {activeMethods.length > 0 ? (
                              activeMethods.map((m) => (
                                <option key={m.id} value={m.nama_metode}>
                                  {m.nama_metode} ({m.bank}{m.nomor_rekening ? ` - ${m.nomor_rekening}` : ""})
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="Transfer BCA">Transfer BCA (BCA)</option>
                                <option value="Transfer Mandiri">Transfer Mandiri (Mandiri)</option>
                                <option value="Transfer BRI">Transfer BRI (BRI)</option>
                                <option value="Cash">Cash (Tunai)</option>
                              </>
                            )}
                          </select>
                          {isMethodInactive && (
                            <p className="text-[10px] text-destructive mt-0.5">
                              Metode ini berstatus Nonaktif dan tidak dapat digunakan.
                            </p>
                          )}
                        </div>

                        {/* Detail Rekening: Hanya jika non-tunai */}
                        {isCash ? (
                          <div className="p-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-1">
                            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              ✓ Metode Tunai (Cash Kantor)
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              Pengeluaran tunai langsung dari kas kantor. Tidak memerlukan bank tujuan dan nomor rekening.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 rounded-md border border-border/70 bg-muted/20">
                            <div className="space-y-1">
                              <label className="text-[10px] font-medium text-muted-foreground block">
                                Bank Tujuan <span className="text-destructive">*</span>
                              </label>
                              <input
                                type="text"
                                value={cashbackBank === "Tunai" ? "" : cashbackBank}
                                onChange={(e) => {
                                  actionFeedback.clearError("finance-cashback-submit");
                                  setCashbackBank(e.target.value);
                                }}
                                placeholder="Contoh: BCA, Mandiri, BRI"
                                className="w-full h-8 px-2.5 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-normal"
                              />
                              {!cashbackBank.trim() && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                                  Bank tujuan wajib diisi untuk transfer.
                                </p>
                              )}
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-medium text-muted-foreground block">
                                No. Rekening Tujuan <span className="text-destructive">*</span>
                              </label>
                              <input
                                type="text"
                                value={cashbackNoRekening}
                                onChange={(e) => {
                                  actionFeedback.clearError("finance-cashback-submit");
                                  setCashbackNoRekening(e.target.value);
                                }}
                                placeholder="Nomor rekening"
                                className="w-full h-8 px-2.5 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                              />
                              {!cashbackNoRekening.trim() && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                                  Nomor rekening tujuan wajib diisi untuk transfer.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Upload Bukti Transfer (Opsional) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        Bukti Transfer / Kas Keluar <span className="text-muted-foreground font-normal">(Opsional)</span>
                      </label>
                      <span className={cashbackProof ? "text-emerald-600 font-medium text-[10px]" : "text-muted-foreground font-normal text-[10px]"}>
                        {cashbackProof ? "✓ Terlampir" : "Opsional"}
                      </span>
                    </div>

                    {cashbackProof ? (
                      <div className="p-2 rounded border border-blue-500/30 bg-blue-500/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {cashbackProof.fileType === "pdf" ? <FileIcon className="w-4 h-4 text-blue-600 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />}
                          <span className="font-mono text-[11px] truncate text-foreground">{cashbackProof.fileName}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">({cashbackProof.fileType})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCashbackProof(null)}
                          className="text-destructive hover:text-destructive/80 p-1 text-xs"
                          title="Hapus berkas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-2.5 border border-dashed border-border rounded-lg bg-background hover:bg-muted/30 cursor-pointer transition-colors">
                        <Upload className="w-4 h-4 text-muted-foreground mb-1" />
                        <span className="text-[11px] font-medium text-foreground">
                          {isUploadingCashbackProof ? "Mengunggah..." : "Pilih berkas bukti transfer / struk (Opsional)"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">JPG, PNG, PDF (Maks. 5 MB)</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                          className="hidden"
                          disabled={isUploadingCashbackProof || isSubmittingCashback}
                          onChange={handleUploadCashbackProof}
                        />
                      </label>
                    )}
                    <ActionInlineError
                      compact
                      actionKey="finance-cashback-proof"
                      error={actionFeedback.getError("finance-cashback-proof")}
                      onDismiss={() => actionFeedback.clearError("finance-cashback-proof")}
                    />
                  </div>
                </div>
              </div>
            )}

            <ActionInlineError
              actionKey="finance-cashback-submit"
              error={actionFeedback.getError("finance-cashback-submit")}
              onDismiss={() => actionFeedback.clearError("finance-cashback-submit")}
              onRetry={handleConfirmCashbackPayment}
              isRetrying={isSubmittingCashback}
              className="mt-2"
            />
            <AlertDialogFooter className="mt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingCashback || isUploadingCashbackProof}
                onClick={() => {
                  if (cashbackTargetItem) {
                    payoutIntentManager.cancelDraft(cashbackTargetItem.id);
                  }
                  actionFeedback.clearByPrefix("finance-cashback-");
                  setCashbackUnknownOutcome(false);
                  setCashbackTargetItem(null);
                  setCashbackProof(null);
                }}
                className="h-9 text-xs px-4 font-medium"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={isSubmittingCashback || isUploadingCashbackProof}
                onClick={handleConfirmCashbackPayment}
                className="h-9 text-xs px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingCashback ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Ya, Cairkan Dana"
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal Selesai (Informasi Cashback Telah Dicairkan & Dismiss dari Antrean) */}
        <AlertDialog
          open={!!selesaiInfoItem}
          onOpenChange={(open) => {
            if (!open && !isSubmittingSelesai) {
              actionFeedback.clearError("finance-cashback-selesai");
              setSelesaiInfoItem(null);
            }
          }}
        >
          <AlertDialogContent className="border-border sm:max-w-md bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Cashback Berhasil Dicairkan
              </AlertDialogTitle>
              <AlertDialogDescription asChild className="text-xs text-muted-foreground pt-1 space-y-2">
                <div>
                  <p className="leading-relaxed">
                    Cashback terpending ini sudah berhasil dicairkan. Transaksi akan diselesaikan dan dikeluarkan dari antrean Cashback Terpending pada tampilan sesi ini.
                  </p>
                  {selesaiInfoItem && (
                    <div className="p-3 rounded-md border border-border/80 bg-muted/30 space-y-1 font-mono text-xs text-foreground mt-2">
                      <div>Order: <span className="font-semibold text-primary">{selesaiInfoItem.orderNo || selesaiInfoItem.invoice}</span></div>
                      <div>Customer: <span className="font-semibold">{selesaiInfoItem.customer}</span></div>
                      <div>Nominal: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatRupiah(selesaiInfoItem.nominalKelebihan || selesaiInfoItem.jumlahCashback || 0)}</span></div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ActionInlineError
              actionKey="finance-cashback-selesai"
              error={actionFeedback.getError("finance-cashback-selesai")}
              onDismiss={() => actionFeedback.clearError("finance-cashback-selesai")}
              className="mt-2"
            />
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel
                disabled={isSubmittingSelesai}
                className="h-8 text-xs px-3 font-medium"
              >
                Tutup
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isSubmittingSelesai}
                onClick={(e) => {
                  e.preventDefault();
                  if (!selesaiInfoItem || selesaiDismissRef.current) return;
                  actionFeedback.clearError("finance-cashback-selesai");
                  const target = selesaiInfoItem;
                  if (target.status !== "Dibayar" && !paidCashbackIds.has(target.id) && !(target.orderNo && paidCashbackIds.has(target.orderNo))) {
                    const err = new ActionApiError(422, "BUSINESS_RULE_VIOLATION", "Transaksi cashback belum berstatus Dibayar sehingga tidak dapat diselesaikan dari antrean.");
                    const classified = actionFeedback.setError("finance-cashback-selesai", err);
                    toast.error(classified.message);
                    return;
                  }
                  selesaiDismissRef.current = true;
                  try {
                    setIsSubmittingSelesai(true);
                    const validOrderNo = target.orderNo && target.orderNo !== "-" ? target.orderNo : "";
                    dismissCashback(target.id);
                    if (validOrderNo) {
                      dismissCashback(validOrderNo);
                    }
                    setDismissedCashbackIds((prev) => {
                      const next = new Set(prev);
                      next.add(target.id);
                      if (validOrderNo) next.add(validOrderNo);
                      return next;
                    });
                    toast.success(`Transaksi ${validOrderNo || target.invoice || target.id} diselesaikan dari antrean pending.`);
                    setSelesaiInfoItem(null);
                  } catch (err: any) {
                    const classified = actionFeedback.setError("finance-cashback-selesai", err, {
                      actionLabel: "menyelesaikan antrean cashback",
                    });
                    toast.error(classified.message);
                  } finally {
                    selesaiDismissRef.current = false;
                    setIsSubmittingSelesai(false);
                  }
                }}
                className="h-8 text-xs px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5"
              >
                {isSubmittingSelesai ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "OK"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal Edit Transaksi In-Place */}
        <Dialog
          open={!!editingCashbackItem}
          onOpenChange={(open) => {
            if (!open && !isSavingEditCashback) {
              actionFeedback.clearError("finance-cashback-edit");
              setEditingCashbackItem(null);
            }
          }}
        >
          <DialogContent className="border-border sm:max-w-lg bg-card max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Pencil className="w-4 h-4 text-primary" />
                Edit Transaksi Cashback / Refund
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                Perbarui data transaksi. Perubahan disimpan langsung ke data kanonis tanpa membuat baris baru.
              </DialogDescription>
            </DialogHeader>

            {editingCashbackItem && (() => {
              const isPaid = editingCashbackItem.status === "Dibayar" || paidCashbackIds.has(editingCashbackItem.id);
              return (
                <div className="space-y-3 py-2 text-xs">
                  {isPaid && (
                    <div className="p-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      ⚠️ Transaksi ini berstatus <strong>Dibayar</strong>. Nilai finansial (Total Tagihan, Uang Masuk, Kelebihan Bayar) dan Status dikunci demi menjaga integritas pembukuan kas.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-foreground">Nomor Order</Label>
                      <Input
                        value={editingCashbackForm.orderNo || ""}
                        disabled
                        className="h-8 text-xs font-mono bg-muted/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-foreground">Tanggal Masuk Berkas</Label>
                      <Input
                        disabled={isSavingEditCashback}
                        value={editingCashbackForm.tanggalMasukBerkas || ""}
                        onChange={(e) => {
                          actionFeedback.clearError("finance-cashback-edit");
                          setEditingCashbackForm({ ...editingCashbackForm, tanggalMasukBerkas: e.target.value });
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-foreground">
                        Nomor Polisi <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        disabled={isSavingEditCashback}
                        value={editingCashbackForm.nopol || ""}
                        onChange={(e) => {
                          actionFeedback.clearError("finance-cashback-edit");
                          setEditingCashbackForm({ ...editingCashbackForm, nopol: e.target.value });
                        }}
                        className="h-8 text-xs font-mono uppercase"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-foreground">No. Telepon / WhatsApp</Label>
                      <Input
                        disabled={isSavingEditCashback}
                        value={editingCashbackForm.phone || ""}
                        onChange={(e) => {
                          actionFeedback.clearError("finance-cashback-edit");
                          setEditingCashbackForm({ ...editingCashbackForm, phone: e.target.value });
                        }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">
                      Nama Customer <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      disabled={isSavingEditCashback}
                      value={editingCashbackForm.customer || ""}
                      onChange={(e) => {
                        actionFeedback.clearError("finance-cashback-edit");
                        setEditingCashbackForm({ ...editingCashbackForm, customer: e.target.value });
                      }}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-foreground">Total Tagihan</Label>
                      <Input
                        type="number"
                        disabled={isPaid || isSavingEditCashback}
                        value={editingCashbackForm.totalTagihan ?? 0}
                        onChange={(e) => {
                          actionFeedback.clearError("finance-cashback-edit");
                          const tagihan = Number(e.target.value) || 0;
                          const masuk = Number(editingCashbackForm.uangMasuk) || 0;
                          setEditingCashbackForm({
                            ...editingCashbackForm,
                            totalTagihan: tagihan,
                            nominalKelebihan: Math.max(0, masuk - tagihan),
                          });
                        }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-foreground">Uang Masuk</Label>
                      <Input
                        type="number"
                        disabled={isPaid || isSavingEditCashback}
                        value={editingCashbackForm.uangMasuk ?? 0}
                        onChange={(e) => {
                          actionFeedback.clearError("finance-cashback-edit");
                          const masuk = Number(e.target.value) || 0;
                          const tagihan = Number(editingCashbackForm.totalTagihan) || 0;
                          setEditingCashbackForm({
                            ...editingCashbackForm,
                            uangMasuk: masuk,
                            nominalKelebihan: Math.max(0, masuk - tagihan),
                          });
                        }}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-foreground">Kelebihan Bayar</Label>
                      <Input
                        type="number"
                        disabled={isPaid || isSavingEditCashback}
                        value={editingCashbackForm.nominalKelebihan ?? 0}
                        onChange={(e) => {
                          actionFeedback.clearError("finance-cashback-edit");
                          setEditingCashbackForm({ ...editingCashbackForm, nominalKelebihan: Number(e.target.value) || 0 });
                        }}
                        className="h-8 text-xs font-mono font-bold text-blue-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Status</Label>
                    <select
                      disabled={isPaid || isSavingEditCashback}
                      value={editingCashbackForm.status || "Pending"}
                      onChange={(e) => {
                        actionFeedback.clearError("finance-cashback-edit");
                        setEditingCashbackForm({ ...editingCashbackForm, status: e.target.value });
                      }}
                      className="w-full h-8 px-2.5 rounded-md border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Dibayar">Dibayar</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-foreground">Alasan / Catatan</Label>
                    <Textarea
                      rows={2}
                      disabled={isSavingEditCashback}
                      value={editingCashbackForm.alasanPending || ""}
                      onChange={(e) => {
                        actionFeedback.clearError("finance-cashback-edit");
                        setEditingCashbackForm({ ...editingCashbackForm, alasanPending: e.target.value });
                      }}
                      placeholder="Catatan alasan kelebihan bayar atau pengembalian..."
                      className="text-xs"
                    />
                  </div>
                </div>
              );
            })()}

            <ActionInlineError
              actionKey="finance-cashback-edit"
              error={actionFeedback.getError("finance-cashback-edit")}
              onDismiss={() => actionFeedback.clearError("finance-cashback-edit")}
              onRetry={handleSaveEditCashback}
              isRetrying={isSavingEditCashback}
              className="mt-2"
            />
            <DialogFooter className="mt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSavingEditCashback}
                className="h-8 text-xs"
                onClick={() => {
                  actionFeedback.clearError("finance-cashback-edit");
                  setEditingCashbackItem(null);
                }}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSavingEditCashback}
                className="h-8 text-xs bg-primary text-primary-foreground font-semibold flex items-center gap-1.5"
                onClick={handleSaveEditCashback}
              >
                {isSavingEditCashback ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Perubahan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL KONFIRMASI VOID / BATALKAN PENCAIRAN CASHBACK (OTORISASI SPV & ADMIN) */}
        <AlertDialog
          open={!!voidTargetCashback}
          onOpenChange={(open) => {
            if (!open && !isSubmittingVoid) {
              actionFeedback.clearError("finance-cashback-void");
              setVoidTargetCashback(null);
              setVoidReasonText("");
            }
          }}
        >
          <AlertDialogContent className="w-full sm:max-w-md bg-card text-card-foreground border-destructive/30">
            <AlertDialogHeader>
              <div className="flex items-center gap-2.5 text-destructive mb-1">
                <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <AlertDialogTitle className="text-sm font-semibold">
                    Batalkan Pencairan Cashback (Void)
                  </AlertDialogTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Otorisasi Khusus Supervisor / Administrator
                  </p>
                </div>
              </div>
              <AlertDialogDescription className="text-xs text-muted-foreground space-y-3 pt-2 text-left" asChild>
                <div>
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/30 space-y-1.5 text-foreground text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px]">No Order / Transaksi:</span>
                      <span className="font-semibold font-mono">{voidTargetCashback?.orderNo}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px]">Penerima Cashback:</span>
                      <span className="font-semibold">{voidTargetCashback?.customer}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px]">Nominal Pencairan:</span>
                      <span className="font-bold font-mono text-destructive text-sm">
                        {formatRupiah(voidTargetCashback?.nominal || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 text-[11px] leading-relaxed">
                    <p className="font-semibold flex items-center gap-1 mb-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Konsekuensi Akuntansi:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 pl-1">
                      <li>Jurnal pembalik (Debit) otomatis dibukukan di Kas Kantor (memulihkan kas keluar).</li>
                      <li>Status cashback dikembalikan menjadi Pending (belum dicairkan).</li>
                      <li>Tindakan dicatat dalam jejak audit immutable.</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                      <span>Alasan Pembatalan / Void <span className="text-destructive">*</span></span>
                      <span className={`text-[10px] ${voidReasonText.trim().length < 10 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {voidReasonText.trim().length}/10 karakter min
                      </span>
                    </Label>
                    <Textarea
                      rows={3}
                      placeholder="Contoh: Kesalahan transfer rekening customer, pengembalian dibatalkan atau direvisi..."
                      value={voidReasonText}
                      onChange={(e) => {
                        actionFeedback.clearError("finance-cashback-void");
                        setVoidReasonText(e.target.value);
                      }}
                      className="text-xs text-foreground bg-input-background resize-none"
                      disabled={isSubmittingVoid}
                    />
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ActionInlineError
              actionKey="finance-cashback-void"
              error={actionFeedback.getError("finance-cashback-void")}
              onDismiss={() => actionFeedback.clearError("finance-cashback-void")}
              onRetry={voidReasonText.trim().length >= 10 ? handleConfirmVoidCashback : undefined}
              isRetrying={isSubmittingVoid}
              className="mt-2"
            />
            <AlertDialogFooter className="mt-3 gap-2">
              <AlertDialogCancel
                disabled={isSubmittingVoid}
                onClick={() => {
                  actionFeedback.clearError("finance-cashback-void");
                  setVoidTargetCashback(null);
                  setVoidReasonText("");
                }}
                className="h-8 text-xs px-3 font-medium"
              >
                Tutup
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isSubmittingVoid}
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmVoidCashback();
                }}
                className="h-8 text-xs px-3.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingVoid ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Eksekusi Void</span>
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {renderVoucherModal()}
        {renderVoidHistoryModal()}
      </div>
    );
  }

  return null;
}
