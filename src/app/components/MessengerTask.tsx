import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge, getStatusBadgeClass } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "./ui/pagination";
import { TablePagination } from "./ui/TablePagination";
import { EmptyState } from "./ui/empty-state";
import {
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Truck,
  PackageOpen,
  Edit,
  Eye,
  RotateCcw,
  ShieldAlert,
  FileText,
  Camera,
  Upload,
  Check,
  CheckCircle2,
  AlertTriangle,
  Info,
  Play,
  ArrowRight,
  UserCheck,
  Calendar,
  History,
  Wallet,
  Building2,
  ExternalLink,
  Receipt,
  CheckCheck,
  Layers,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { useOrderStore, orderStore, OperationalOrder, StageName } from "../data/orderStore";
import {
  deriveMessengerTasksFromOrders,
  deriveAssignedMessengerTasks,
  isTaskAssignedMessenger,
  deriveAllMessengerHistory,
  calculateOrderTagihan,
  KNOWN_MESSENGERS,
  MessengerTaskItem,
  MessengerHistoryItem,
  resolveMessengerEmployeeId,
  completeMessengerPickup,
  completeSamsatProcess,
  completeSamsatResultPickup,
  completeMessengerDelivery,
  startMessengerTask,
  arriveAtSamsat,
  startSamsatJourney,
  updateMessengerComponent,
  addSamsatComponentToOrder,
  getMasterSamsatComponents,
  MessengerComponentProgress,
} from "../data/messengerTaskAdapter";
import { useKaryawanPengguna } from "../data/karyawanPenggunaAdapter";
import { APP_CONFIG } from "../config/appConfig";
import { processDocumentUpload, formatFileSize } from "../utils/fileCompressor";
import { documentRepository } from "../../data/repositories/documentRepository";
import { formatRupiah } from "../utils/financeFormatters";

const getStatusColor = (status: string) => getStatusBadgeClass(status);

const getStatusIcon = (status: string) => {
  switch (status) {
    case "Selesai":
      return <CheckCircle className="w-4 h-4" />;
    case "Dalam Proses":
      return <Clock className="w-4 h-4" />;
    case "Belum Diambil":
      return <AlertCircle className="w-4 h-4" />;
    case "Pending":
      return <AlertCircle className="w-4 h-4" />;
    case "Dibatalkan":
      return <XCircle className="w-4 h-4" />;
    default:
      return <Truck className="w-4 h-4" />;
  }
};

function formatDateTime(isoString?: string): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function MessengerTask() {
  const navigate = useNavigate();
  // Authoritative Single Source of Truth: OrderStore
  const { activeOrders, archivedOrders } = useOrderStore();
  const { karyawan } = useKaryawanPengguna();
  
  // Real derived operational tasks from active orders (strictly field messenger tasks with assigned courier)
  const taskData = useMemo(() => deriveAssignedMessengerTasks(activeOrders), [activeOrders]);

  // Real derived completed messenger task history (all field tasks finished by messengers)
  const historyData = useMemo(() => deriveAllMessengerHistory(activeOrders, archivedOrders), [activeOrders, archivedOrders]);

  // Main Tab: "active" (Tugas Aktif Lapangan) or "history" (Riwayat Tugas Messenger)
  const [activeMainTab, setActiveMainTab] = useState<"active" | "history">("active");

  // Active Tasks Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMessenger, setFilterMessenger] = useState("all");
  const [filterTaskType, setFilterTaskType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MessengerTaskItem | null>(null);
  const [newTaskData, setNewTaskData] = useState({
    messenger: "",
    customer: "",
    jenisTugas: "",
    lokasi: "",
    keteranganTugas: "Jemput Dokumen",
    tanggalTerima: "",
  });
  const [editTaskData, setEditTaskData] = useState<MessengerTaskItem | null>(null);

  // History Filters & State
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyFilterMessenger, setHistoryFilterMessenger] = useState("all");
  const [historyFilterTaskType, setHistoryFilterTaskType] = useState("all");
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(25);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<MessengerHistoryItem | null>(null);
  const [isHistoryDetailOpen, setIsHistoryDetailOpen] = useState(false);

  // Ambil Alih (Takeover) Dialog State
  const [isAmbilAlihOpen, setIsAmbilAlihOpen] = useState(false);
  const [ambilAlihTask, setAmbilAlihTask] = useState<MessengerTaskItem | null>(null);
  const [isSubmittingTakeover, setIsSubmittingTakeover] = useState(false);

  // Jemput Dokumen Takeover Form
  const [pickupChecklist, setPickupChecklist] = useState({
    tasAntiAir: true,
    kontakKlien: true,
    cekRute: true,
  });
  const [pickupDocs, setPickupDocs] = useState({
    stnk: true,
    bpkb: true,
    ktp: true,
    skkp: false,
    lainnya: false,
  });
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const pickupFileInputRef = useRef<HTMLInputElement>(null);

  // Pengantaran Takeover Form
  const [recipientName, setRecipientName] = useState("");
  const [recipientRelationship, setRecipientRelationship] = useState("Pemilik Langsung");
  const [deliveryPhotoUrl, setDeliveryPhotoUrl] = useState("");
  const [deliveryFileName, setDeliveryFileName] = useState("");
  const [deliveryFileSize, setDeliveryFileSize] = useState<number | undefined>(undefined);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isCompressingDelivery, setIsCompressingDelivery] = useState(false);
  const deliveryFileInputRef = useRef<HTMLInputElement>(null);

  // Samsat Result Takeover Form
  const [samsatResultChecklist, setSamsatResultChecklist] = useState({
    noticePajak: true,
    stnkBaru: true,
    platNomor: false,
  });
  const [samsatResultPhotoUrl, setSamsatResultPhotoUrl] = useState("");
  const [samsatResultNotes, setSamsatResultNotes] = useState("");
  const samsatResultFileInputRef = useRef<HTMLInputElement>(null);

  // Samsat Process Takeover Form
  const [samsatGeneralNotes, setSamsatGeneralNotes] = useState("");
  const [isAddSamsatCompOpen, setIsAddSamsatCompOpen] = useState(false);
  const [newCompName, setNewCompName] = useState("");
  const [newCompCategory, setNewCompCategory] = useState("Mutasi Masuk");
  const [newCompPrice, setNewCompPrice] = useState("0");

  const liveOrder = useMemo(() => {
    if (!ambilAlihTask) return null;
    return orderStore.getOrderByNo(ambilAlihTask.noBerkas) || null;
  }, [ambilAlihTask, activeOrders]);

  const liveComponents: MessengerComponentProgress[] = useMemo(() => {
    if (!liveOrder) return [];
    if (liveOrder.messengerComponentProgress && Object.keys(liveOrder.messengerComponentProgress).length > 0) {
      return Object.values(liveOrder.messengerComponentProgress);
    }
    return (liveOrder.samsatProcesses || []).map((p: any) => ({
      componentId: p.id,
      name: p.name,
      category: p.category,
      nominal: p.basePrice || 0,
      masterPrice: p.basePrice || 0,
      actualOrderPrice: p.actualCost || p.basePrice || 0,
      status: p.status === "Selesai" ? "COMPLETED" : (p.status === "Sedang Diproses" ? "IN_PROGRESS" : (p.status === "Menunggu" ? "WAITING" : "NOT_STARTED")),
      waitingReason: p.waitingReason,
      estimatedDurationMinutes: p.estimatedDurationMinutes,
    }));
  }, [liveOrder, activeOrders]);

  // Available messengers for filtering (strictly messengers who have active assigned tasks)
  const filterMessengers = useMemo(() => {
    const set = new Set<string>();
    taskData.forEach(t => {
      if (t.messenger && t.messenger.trim().toLowerCase() !== "belum ditugaskan" && t.messenger !== "-") {
        set.add(t.messenger.trim());
      }
    });
    return Array.from(set);
  }, [taskData]);

  // Available messengers for assignment dropdown in dialogs
  const assignableMessengers = useMemo(() => {
    const isApi = APP_CONFIG.dataProvider === "api";
    const active = karyawan
      .filter((k) => k.jabatan === "MESSENGER" && k.status === "Aktif")
      .map((k) => k.nama);
    const baseMessengers = active.length > 0 ? active : (isApi ? [] : [...KNOWN_MESSENGERS]);
    const set = new Set<string>(["Belum Ditugaskan", ...baseMessengers]);
    taskData.forEach(t => {
      if (t.messenger && t.messenger !== "Belum Ditugaskan") {
        set.add(t.messenger);
      }
    });
    return Array.from(set);
  }, [taskData, karyawan]);

  // Filter data for Active Tasks
  const getFilteredData = () => {
    return taskData.filter(item => {
      const matchSearch = searchTerm === "" || 
        item.noBerkas.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.messenger.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nopol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.jenisTugas.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === "all" || item.status === filterStatus;
      const matchMessenger = filterMessenger === "all" || item.messenger === filterMessenger;
      const matchTaskType = filterTaskType === "all" || item.keteranganTugas === filterTaskType;
      
      return matchSearch && matchStatus && matchMessenger && matchTaskType;
    });
  };

  // Pagination for Active Tasks
  const filteredData = getFilteredData();
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterMessenger("all");
    setFilterStatus("all");
    setFilterTaskType("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm || filterMessenger !== "all" || filterStatus !== "all" || filterTaskType !== "all"
  );

  // Available messengers in history
  const filterHistoryMessengers = useMemo(() => {
    const set = new Set<string>();
    historyData.forEach(h => {
      if (h.messenger && h.messenger !== "Belum Ditugaskan") {
        set.add(h.messenger);
      }
    });
    return Array.from(set);
  }, [historyData]);

  // History Stats directly calculated from completed tasks
  const historyStats = useMemo(() => {
    const totalCount = historyData.length;
    const totalTagihanNominal = historyData.reduce((acc, curr) => acc + (curr.totalTagihan || 0), 0);
    const pickupCount = historyData.filter(h => h.taskType === "Jemput Dokumen").length;
    const samsatDeliveryCount = historyData.filter(h => h.taskType === "Proses Samsat" || h.taskType === "Pengantaran Dokumen").length;
    return {
      totalCount,
      totalTagihanNominal,
      pickupCount,
      samsatDeliveryCount,
    };
  }, [historyData]);

  // Filter History Data
  const filteredHistoryData = useMemo(() => {
    return historyData.filter(item => {
      const matchSearch =
        historySearchTerm === "" ||
        item.orderNo.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        item.customer.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        item.messenger.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        item.nopol.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        item.layanan.toLowerCase().includes(historySearchTerm.toLowerCase());
      const matchMessenger =
        historyFilterMessenger === "all" || item.messenger === historyFilterMessenger;
      const matchTaskType =
        historyFilterTaskType === "all" || item.taskType === historyFilterTaskType;
      return matchSearch && matchMessenger && matchTaskType;
    });
  }, [historyData, historySearchTerm, historyFilterMessenger, historyFilterTaskType]);

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistoryData.length / historyItemsPerPage));
  const startHistoryIndex = (historyCurrentPage - 1) * historyItemsPerPage;
  const paginatedHistoryData = filteredHistoryData.slice(
    startHistoryIndex,
    startHistoryIndex + historyItemsPerPage
  );

  const handleResetHistoryFilters = () => {
    setHistorySearchTerm("");
    setHistoryFilterMessenger("all");
    setHistoryFilterTaskType("all");
    setHistoryCurrentPage(1);
  };

  const hasActiveHistoryFilters = Boolean(
    historySearchTerm || historyFilterMessenger !== "all" || historyFilterTaskType !== "all"
  );

  // Stats calculation directly derived from real active assigned tasks
  const statusCounts = useMemo(() => ({
    belumDiambil: taskData.filter(t => t.status === "Belum Diambil").length,
    dalamProses: taskData.filter(t => t.status === "Dalam Proses").length,
    selesai: taskData.filter(t => t.status === "Selesai").length,
    pending: taskData.filter(t => t.status === "Pending").length,
  }), [taskData]);

  const handleAddTask = () => {
    if (!newTaskData.customer.trim() || !newTaskData.jenisTugas.trim()) {
      toast.error("Mohon lengkapi nama customer dan jenis pengurusan!");
      return;
    }

    const assignedMessenger = (newTaskData.messenger && newTaskData.messenger !== "Belum Ditugaskan")
      ? newTaskData.messenger.trim()
      : undefined;
    const assignedMessengerId = resolveMessengerEmployeeId(assignedMessenger);
    const taskType = newTaskData.keteranganTugas || "Jemput Dokumen";
    const tanggalTugas = newTaskData.tanggalTerima || new Date().toISOString().split("T")[0];

    // Create real order in OrderStore (authoritative SSoT)
    const newOrder = orderStore.addOrder({
      customer: newTaskData.customer.trim(),
      namaPemilik: newTaskData.customer.trim(),
      nomorHP: "081234567890",
      layanan: newTaskData.jenisTugas.trim(),
      nopol: "B " + (1000 + (taskData.length + 1) * 37) + " SJ",
      wilayahSamsatAsal: newTaskData.lokasi || "Jakarta Timur",
      messenger: assignedMessenger,
      assignedMessengerName: assignedMessenger,
      assignedMessengerId: assignedMessengerId,
      tanggalJemput: tanggalTugas,
      isScheduled: Boolean(assignedMessenger),
      catatanPenjadwalan: `Tugas: ${taskType}`,
      catatanOrder: `Tugas operasional dibuat dari menu Messenger Task untuk ${newTaskData.customer.trim()}`,
      orderSource: "Admin Loket / Messenger Task",
    });

    // Advance to matching operational stage
    if (taskType === "Proses Samsat") {
      orderStore.advanceOrder(newOrder.orderNo, "Proses Samsat", {
        messenger: assignedMessenger,
        assignedMessengerName: assignedMessenger,
        assignedMessengerId: assignedMessengerId,
      });
    } else if (taskType === "Pengantaran Dokumen") {
      orderStore.advanceOrder(newOrder.orderNo, "Pengantaran", {
        messenger: assignedMessenger,
        assignedMessengerName: assignedMessenger,
        assignedMessengerId: assignedMessengerId,
        messengerPengantar: assignedMessenger,
        tanggalPengantaran: tanggalTugas,
        isDeliveryScheduled: Boolean(assignedMessenger),
      });
    } else {
      // "Jemput Dokumen" -> advance to Penjadwalan
      orderStore.advanceOrder(newOrder.orderNo, "Penjadwalan", {
        messenger: assignedMessenger,
        assignedMessengerName: assignedMessenger,
        assignedMessengerId: assignedMessengerId,
        tanggalJemput: tanggalTugas,
        isScheduled: Boolean(assignedMessenger),
      });
    }

    setNewTaskData({
      messenger: "",
      customer: "",
      jenisTugas: "",
      lokasi: "",
      keteranganTugas: "Jemput Dokumen",
      tanggalTerima: "",
    });
    setIsAddDialogOpen(false);
    toast.success(`Tugas operasional ${newOrder.orderNo} berhasil ditambahkan ke sistem!`);
  };

  const handleViewDetail = (task: MessengerTaskItem) => {
    setSelectedTask(task);
    setIsViewDialogOpen(true);
  };

  const handleEditTask = (task: MessengerTaskItem) => {
    setEditTaskData({ ...task });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTask = () => {
    if (!editTaskData) return;
    if (!editTaskData.customer.trim() || !editTaskData.jenisTugas.trim()) {
      toast.error("Mohon lengkapi nama customer dan jenis pengurusan!");
      return;
    }

    const orderNo = editTaskData.noBerkas;
    const currentOrder = orderStore.getOrderByNo(orderNo);

    if (currentOrder) {
      const assignedMessenger = (editTaskData.messenger && editTaskData.messenger !== "Belum Ditugaskan")
        ? editTaskData.messenger.trim()
        : undefined;
      const assignedMessengerId = resolveMessengerEmployeeId(assignedMessenger);

      const updates: Partial<OperationalOrder> = {
        customer: editTaskData.customer.trim(),
        namaPemilik: editTaskData.customer.trim(),
        layanan: editTaskData.jenisTugas.trim(),
        wilayahSamsatAsal: editTaskData.lokasi,
        messengerTaskStatus: editTaskData.status,
        messengerTaskNotes: editTaskData.keterangan,
        assignedMessengerId: assignedMessengerId,
        assignedMessengerName: assignedMessenger,
      };

      if (editTaskData.keteranganTugas === "Pengantaran Dokumen") {
        updates.messengerPengantar = assignedMessenger;
        if (assignedMessenger) updates.isDeliveryScheduled = true;
        if (editTaskData.tanggalTerima) {
          updates.tanggalPengantaran = editTaskData.tanggalTerima;
        }
        if (editTaskData.keterangan) {
          updates.catatanPengantaran = editTaskData.keterangan;
        }
      } else {
        updates.messenger = assignedMessenger;
        if (assignedMessenger) updates.isScheduled = true;
        if (editTaskData.tanggalTerima) {
          updates.tanggalJemput = editTaskData.tanggalTerima;
        }
        if (editTaskData.keterangan) {
          updates.catatanPenjadwalan = editTaskData.keterangan;
        }
      }

      // Handle stage transitions if status is explicitly marked "Selesai"
      if (editTaskData.status === "Selesai") {
        if (currentOrder.currentStep === 7) {
          // Advance from Stage 7 (Pengantaran) to Stage 8 (Dokumen Telah Diterima)
          orderStore.advanceOrder(orderNo, "Dokumen Telah Diterima", {
            ...updates,
            tanggalDiterima: editTaskData.tanggalSelesai !== "-" ? editTaskData.tanggalSelesai : new Date().toISOString().split("T")[0],
            isReceived: true,
            receiverName: editTaskData.customer,
          });
          setIsEditDialogOpen(false);
          setEditTaskData(null);
          toast.success(`Pengantaran order ${orderNo} selesai & dokumen telah diterima klien!`);
          return;
        } else if (currentOrder.currentStep === 2 || currentOrder.currentStep === 3) {
          // Advance from Jemput Dokumen to Proses Samsat
          orderStore.advanceOrder(orderNo, "Proses Samsat", {
            ...updates,
            currentSamsatProcess: currentOrder.samsatProcesses?.[0]?.name || "Loket Pembukuan Samsat",
          });
          setIsEditDialogOpen(false);
          setEditTaskData(null);
          toast.success(`Penjemputan berkas ${orderNo} selesai, lanjut ke Proses Samsat!`);
          return;
        }
      }

      // Mutate order in OrderStore (authoritative SSoT)
      orderStore.updateOrder(orderNo, updates);
      setIsEditDialogOpen(false);
      setEditTaskData(null);
      toast.success(`Tugas messenger ${orderNo} berhasil diperbarui di sistem!`);
    } else {
      toast.error("Order tidak ditemukan di OrderStore!");
    }
  };

  const handleOpenAmbilAlih = (task: MessengerTaskItem) => {
    const ord = orderStore.getOrderByNo(task.noBerkas);
    setAmbilAlihTask(task);
    setPickupNotes(ord?.pickupProof?.notes || ord?.messengerTaskNotes || "");
    setPickupPhotoUrl(ord?.pickupProof?.photoProofUrl || "");
    setPickupChecklist({ tasAntiAir: true, kontakKlien: true, cekRute: true });
    setPickupDocs({
      stnk: true,
      bpkb: true,
      ktp: true,
      skkp: Boolean(ord?.clientDocuments?.skkp),
      lainnya: Boolean(ord?.clientDocuments?.lainnya),
    });
    setRecipientName(ord?.deliveryHandover?.recipientName || ord?.receiverName || ord?.customer || "");
    setRecipientRelationship(ord?.deliveryHandover?.relationship || "Pemilik Langsung");
    setDeliveryPhotoUrl(ord?.deliveryHandover?.photoProofUrl || "");
    setDeliveryFileName(ord?.deliveryHandover?.fileName || "");
    setDeliveryFileSize(ord?.deliveryHandover?.fileSize || undefined);
    setDeliveryNotes(ord?.deliveryHandover?.notes || ord?.messengerTaskNotes || "");
    setSamsatResultChecklist({ noticePajak: true, stnkBaru: true, platNomor: false });
    setSamsatResultPhotoUrl(ord?.samsatPickupProof?.photoProofUrl || "");
    setSamsatResultNotes(ord?.samsatPickupNotes || ord?.messengerTaskNotes || "");
    setSamsatGeneralNotes(ord?.catatanSamsat || ord?.messengerTaskNotes || "");
    setIsAmbilAlihOpen(true);
  };

  const handlePickupPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      if (res) {
        setPickupPhotoUrl(res);
        toast.success(`Foto bukti ${file.name} berhasil dimuat!`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeliveryPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressingDelivery(true);
      const processed = await processDocumentUpload(file);
      let fileUrl = processed.fileUrl;
      if (selectedTask?.orderNo) {
        try {
          const uploaded = await documentRepository.uploadDocument(processed.file, {
            orderNo: selectedTask.orderNo,
            documentType: "Bukti Serah Terima",
            metadata: { phase: "AFTER", category: "Bukti Serah Terima" },
          });
          if (uploaded?.id) {
            fileUrl = uploaded.fileUrl;
          }
        } catch (uploadErr) {
          console.warn("Delivery upload failed, keeping processed url:", uploadErr);
        }
      }
      setDeliveryPhotoUrl(fileUrl);
      setDeliveryFileName(processed.fileName);
      setDeliveryFileSize(processed.fileSize);
      toast.success(`Berkas ${file.name} (${formatFileSize(processed.fileSize)}) berhasil diproses!`);
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses berkas");
    } finally {
      setIsCompressingDelivery(false);
      e.target.value = "";
    }
  };

  const handleSamsatResultPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processDocumentUpload(file);
      let fileUrl = processed.fileUrl;
      if (selectedTask?.orderNo) {
        try {
          const uploaded = await documentRepository.uploadDocument(processed.file, {
            orderNo: selectedTask.orderNo,
            documentType: "Hasil Samsat",
            metadata: { phase: "AFTER", category: "Dokumen Hasil" },
          });
          if (uploaded?.id) {
            fileUrl = uploaded.fileUrl;
          }
        } catch (uploadErr) {
          console.warn("Samsat result upload failed, keeping processed url:", uploadErr);
        }
      }
      setSamsatResultPhotoUrl(fileUrl);
      toast.success(`Dokumen hasil ${file.name} berhasil diunggah!`);
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses dokumen hasil");
    } finally {
      e.target.value = "";
    }
  };

  const handleUpdateTakeoverCompStatus = (
    compId: string,
    status: "NOT_STARTED" | "IN_PROGRESS" | "WAITING" | "COMPLETED",
    name: string
  ) => {
    if (!ambilAlihTask) return;
    const adminUser = {
      userName: "Admin Kantor (Takeover)",
      role: "admin",
      employeeId: "admin-takeover",
    };
    const res = updateMessengerComponent(
      ambilAlihTask.noBerkas,
      compId,
      { status },
      adminUser
    );
    if (res.success) {
      toast.success(`Komponen "${name}" diubah ke status ${status}`);
    } else {
      toast.error(res.error || "Gagal memperbarui status komponen");
    }
  };

  const handleAddSamsatCompSubmit = () => {
    if (!ambilAlihTask || !newCompName.trim()) {
      toast.error("Nama komponen wajib diisi!");
      return;
    }
    const cleanPrice = parseInt(newCompPrice.replace(/[^0-9]/g, ""), 10) || 0;
    const adminUser = {
      userName: "Admin Kantor (Takeover)",
      role: "admin",
      employeeId: "admin-takeover",
    };
    const res = addSamsatComponentToOrder(
      ambilAlihTask.noBerkas,
      {
        name: newCompName.trim(),
        category: newCompCategory,
        nominal: cleanPrice,
        isCustom: true,
        addedManually: true,
      },
      adminUser
    );
    if (res.success) {
      toast.success(`Komponen "${newCompName.trim()}" berhasil ditambahkan!`);
      setNewCompName("");
      setNewCompPrice("0");
      setIsAddSamsatCompOpen(false);
    } else {
      toast.error(res.error || "Gagal menambah komponen");
    }
  };

  const handleConfirmAmbilAlih = async () => {
    if (!ambilAlihTask) return;
    const orderNo = ambilAlihTask.noBerkas;
    const currentOrder = orderStore.getOrderByNo(orderNo);
    if (!currentOrder) {
      toast.error("Order tidak ditemukan");
      return;
    }

    const adminUser = {
      userName: "Admin Kantor (Takeover)",
      role: "admin",
      employeeId: "admin-takeover",
    };

    setIsSubmittingTakeover(true);

    try {
      if (ambilAlihTask.keteranganTugas === "Jemput Dokumen") {
        const res = completeMessengerPickup(
          orderNo,
          {
            photoProofUrl: pickupPhotoUrl || undefined,
            notes: pickupNotes.trim() || undefined,
            documentChecklist: pickupDocs,
          },
          adminUser
        );
        if (res.success) {
          if (currentOrder.currentStep === 2) {
            orderStore.advanceOrder(orderNo, "Verifikasi Dokumen", {
              pickupCompleted: true,
              messengerTaskStatus: "Dokumen Sudah Tersedia",
              pickupProof: {
                photoProofUrl: pickupPhotoUrl,
                notes: pickupNotes,
                completedAt: new Date().toISOString(),
              },
              messengerTaskNotes: pickupNotes || currentOrder.messengerTaskNotes,
            });
          }
          toast.success(`Penjemputan dokumen ${orderNo} berhasil diambil alih dan diselesaikan oleh Admin! Berkas siap diverifikasi di Stage 3.`);
          setIsAmbilAlihOpen(false);
          setAmbilAlihTask(null);
        } else {
          toast.error(res.error || "Gagal menyelesaikan penjemputan");
        }
      } else if (ambilAlihTask.keteranganTugas === "Proses Samsat") {
        const res = completeSamsatProcess(orderNo, adminUser, samsatGeneralNotes.trim() || undefined);
        if (res.success) {
          toast.success(`Pengurusan Samsat ${orderNo} berhasil diambil alih dan diselesaikan oleh Admin!`);
          setIsAmbilAlihOpen(false);
          setAmbilAlihTask(null);
        } else {
          toast.error(res.error || "Gagal menyelesaikan pengurusan Samsat");
        }
      } else if (ambilAlihTask.keteranganTugas === "Jemput Hasil Samsat") {
        const res = completeSamsatResultPickup(
          orderNo,
          {
            photoProofUrl: samsatResultPhotoUrl || undefined,
            notes: samsatResultNotes.trim() || undefined,
          },
          adminUser
        );
        if (res.success) {
          toast.success(`Pengambilan berkas hasil Samsat ${orderNo} berhasil diambil alih dan tiba di kantor!`);
          setIsAmbilAlihOpen(false);
          setAmbilAlihTask(null);
        } else {
          toast.error(res.error || "Gagal menyelesaikan penjemputan hasil Samsat");
        }
      } else if (ambilAlihTask.keteranganTugas === "Pengantaran Dokumen") {
        if (!recipientName.trim()) {
          toast.error("Nama penerima berkas wajib diisi!");
          setIsSubmittingTakeover(false);
          return;
        }
        const res = completeMessengerDelivery(
          orderNo,
          {
            recipientName: recipientName.trim(),
            relationship: recipientRelationship,
            photoProofUrl: deliveryPhotoUrl || undefined,
            fileName: deliveryFileName || undefined,
            fileSize: deliveryFileSize || undefined,
            notes: deliveryNotes.trim() || undefined,
          },
          adminUser
        );
        if (res.success) {
          if (currentOrder.currentStep === 7) {
            orderStore.advanceOrder(orderNo, "Dokumen Telah Diterima", {
              deliveryStatus: "Dokumen Diserahkan",
              isReceived: true,
              receiverName: recipientName.trim(),
              tanggalDiterima: new Date().toISOString().split("T")[0],
              deliveryHandover: {
                recipientName: recipientName.trim(),
                relationship: recipientRelationship,
                photoProofUrl: deliveryPhotoUrl,
                fileName: deliveryFileName,
                fileSize: deliveryFileSize,
                notes: deliveryNotes,
                completedAt: new Date().toISOString(),
              },
              messengerTaskNotes: deliveryNotes || currentOrder.messengerTaskNotes,
            });
          }
          toast.success(`Pengantaran dokumen ${orderNo} berhasil diambil alih dan diserahkan ke klien!`);
          setIsAmbilAlihOpen(false);
          setAmbilAlihTask(null);
        } else {
          toast.error(res.error || "Gagal menyelesaikan pengantaran dokumen");
        }
      }
    } finally {
      setIsSubmittingTakeover(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-full space-y-4 p-3 sm:p-4 md:p-6 w-full min-w-0 text-left">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-3 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Messenger Task</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Kelola tugas operasional messenger dan pantau riwayat penyelesaian tugas</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2">
          <Button
            variant={activeMainTab === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveMainTab("active")}
            className="h-9 px-3.5 text-xs font-semibold gap-2 rounded-lg"
          >
            <Truck className="w-4 h-4" />
            <span>Tugas Aktif Lapangan</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
              {taskData.length}
            </Badge>
          </Button>
          <Button
            variant={activeMainTab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveMainTab("history")}
            className="h-9 px-3.5 text-xs font-semibold gap-2 rounded-lg"
          >
            <History className="w-4 h-4" />
            <span>Riwayat Tugas Messenger</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
              {historyData.length}
            </Badge>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/messenger/history")}
            className="h-9 px-3 text-xs font-semibold gap-1.5 rounded-lg border-primary/40 text-primary hover:bg-primary/10"
            title="Buka Halaman Lengkap Messenger History (Arsip Detail & Pengajuan Biaya)"
          >
            <Receipt className="w-4 h-4" />
            <span>Portal Messenger History & Biaya</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {activeMainTab === "active" ? (
        <>
          {/* Quick Stats for Active Tasks */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Belum Diambil</p>
                    <h3 className="text-2xl font-bold font-mono tabular-nums text-foreground mt-0.5">{statusCounts.belumDiambil}</h3>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Dalam Proses</p>
                    <h3 className="text-2xl font-bold font-mono tabular-nums text-foreground mt-0.5">{statusCounts.dalamProses}</h3>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Selesai Lapangan</p>
                    <h3 className="text-2xl font-bold font-mono tabular-nums text-foreground mt-0.5">{statusCounts.selesai}</h3>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Pending / Menunggu</p>
                    <h3 className="text-2xl font-bold font-mono tabular-nums text-foreground mt-0.5">{statusCounts.pending}</h3>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs flex-1 flex flex-col min-h-0">
              {/* Active Tasks Filters */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4 shrink-0 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Cari nomor order, nama customer, messenger, atau nomor polisi..." 
                    className="pl-10 bg-input-background border-border h-9 text-xs"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      handleFilterChange();
                    }}
                  />
                </div>
                <Select 
                  value={filterMessenger} 
                  onValueChange={(value) => {
                    setFilterMessenger(value);
                    handleFilterChange();
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[160px] bg-input-background border-border h-9 text-xs">
                    <SelectValue placeholder="Semua Messenger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Semua Messenger</SelectItem>
                    {filterMessengers.map((messenger) => (
                      <SelectItem key={messenger} value={messenger} className="text-xs">
                        {messenger}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={filterTaskType} 
                  onValueChange={(value) => {
                    setFilterTaskType(value);
                    handleFilterChange();
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[160px] bg-input-background border-border h-9 text-xs">
                    <SelectValue placeholder="Semua Jenis Tugas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Semua Jenis Tugas</SelectItem>
                    <SelectItem value="Jemput Dokumen" className="text-xs">Jemput Dokumen</SelectItem>
                    <SelectItem value="Proses Samsat" className="text-xs">Proses Samsat</SelectItem>
                    <SelectItem value="Pengantaran Dokumen" className="text-xs">Pengantaran Dokumen</SelectItem>
                  </SelectContent>
                </Select>
                <Select 
                  value={filterStatus} 
                  onValueChange={(value) => {
                    setFilterStatus(value);
                    handleFilterChange();
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[150px] bg-input-background border-border h-9 text-xs">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Semua Status</SelectItem>
                    <SelectItem value="Belum Diambil" className="text-xs">Belum Diambil</SelectItem>
                    <SelectItem value="Dalam Proses" className="text-xs">Dalam Proses</SelectItem>
                    <SelectItem value="Selesai" className="text-xs">Selesai</SelectItem>
                    <SelectItem value="Pending" className="text-xs">Pending</SelectItem>
                    <SelectItem value="Dibatalkan" className="text-xs">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    className="border-border text-xs h-9 gap-1 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                )}
                <Button className="bg-primary hover:bg-primary/90 h-9 text-xs shrink-0" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Tugas Baru
                </Button>
              </div>

              {/* Table of Active Tasks */}
              <div className="rounded-lg border border-border bg-card overflow-x-auto shadow-2xs flex-1 flex flex-col min-h-[220px]">
                <Table className={`w-full min-w-[850px] ${paginatedData.length === 0 ? "h-full" : ""}`}>
                  <TableHeader className="bg-muted/40 border-b border-border/80">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">No</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nomor Order</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Messenger</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nama Customer</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jenis Pengurusan</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Keterangan Tugas</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lokasi</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tgl Terima</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Status</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center w-[130px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length > 0 ? (
                      paginatedData.map((task, index) => (
                        <TableRow key={task.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-10">
                          <TableCell className="w-12 text-muted-foreground text-center font-mono text-xs">{startIndex + index + 1}</TableCell>
                          <TableCell className="font-mono text-primary font-medium text-xs">
                            {task.noBerkas}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className={task.messenger === "Belum Ditugaskan" ? "text-amber-500 font-medium" : "text-foreground"}>
                              {task.messenger}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-foreground text-xs">{task.customer}</TableCell>
                          <TableCell className="text-xs text-foreground/80">{task.jenisTugas}</TableCell>
                          <TableCell className="text-xs">
                            <span className="flex items-center gap-1.5 font-medium">
                              <PackageOpen className="w-3.5 h-3.5 text-muted-foreground" />
                              {task.keteranganTugas}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground" title={task.lokasi}>
                            {task.lokasi}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground/80">{task.tanggalTerima}</TableCell>
                          <TableCell className="text-center text-xs">
                            <Badge status={task.status}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(task.status)}
                                {task.status}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center px-1.5 py-1.5">
                            <div className="flex items-center gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                onClick={() => handleViewDetail(task)}
                                title="Lihat Detail"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                onClick={() => handleEditTask(task)}
                                title="Edit Tugas"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              {task.status !== "Selesai" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-1.5 text-[11px] font-semibold gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-colors"
                                  onClick={() => handleOpenAmbilAlih(task)}
                                  title="Ambil Alih Fungsi Messenger (Admin Takeover)"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span className="hidden xl:inline">Ambil Alih</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="h-full hover:bg-transparent">
                        <TableCell colSpan={10} className="text-center py-8 align-middle p-0">
                          <EmptyState
                            title="Tidak ada tugas messenger aktif ditemukan"
                            description="Saat ini tidak ada order yang sedang berada dalam proses kurir aktif (Penjemputan, Samsat, atau Pengantaran)."
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
            </Card>
          </motion.div>
        </>
      ) : (
        <>
          {/* Quick Stats for Messenger History */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Tugas Selesai</p>
                    <h3 className="text-2xl font-bold font-mono tabular-nums text-foreground mt-0.5">{historyStats.totalCount}</h3>
                    <p className="text-[10px] text-muted-foreground">Tugas kurir berhasil diselesaikan</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Nilai Tagihan Order</p>
                    <h3 className="text-lg sm:text-xl font-bold font-mono tabular-nums text-foreground mt-0.5 truncate max-w-[200px]" title={formatRupiah(historyStats.totalTagihanNominal)}>
                      {formatRupiah(historyStats.totalTagihanNominal)}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">Akumulasi transaksi tugas selesai</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <PackageOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Jemput Dokumen Selesai</p>
                    <h3 className="text-2xl font-bold font-mono tabular-nums text-foreground mt-0.5">{historyStats.pickupCount}</h3>
                    <p className="text-[10px] text-muted-foreground">Berkas tiba di loket kantor</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Samsat & Antar Selesai</p>
                    <h3 className="text-2xl font-bold font-mono tabular-nums text-foreground mt-0.5">{historyStats.samsatDeliveryCount}</h3>
                    <p className="text-[10px] text-muted-foreground">Proses Samsat & serah terima klien</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <Card className="p-4 sm:p-5 border border-border/80 bg-card shadow-xs flex-1 flex flex-col min-h-0">
              {/* History Filters */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4 shrink-0 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Cari nomor order, nama customer, messenger, nopol, atau layanan..." 
                    className="pl-10 bg-input-background border-border h-9 text-xs"
                    value={historySearchTerm}
                    onChange={(e) => {
                      setHistorySearchTerm(e.target.value);
                      setHistoryCurrentPage(1);
                    }}
                  />
                </div>
                <Select 
                  value={historyFilterMessenger} 
                  onValueChange={(value) => {
                    setHistoryFilterMessenger(value);
                    setHistoryCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[170px] bg-input-background border-border h-9 text-xs">
                    <SelectValue placeholder="Semua Messenger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Semua Messenger</SelectItem>
                    {filterHistoryMessengers.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={historyFilterTaskType} 
                  onValueChange={(value) => {
                    setHistoryFilterTaskType(value);
                    setHistoryCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[170px] bg-input-background border-border h-9 text-xs">
                    <SelectValue placeholder="Semua Jenis Tugas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Semua Jenis Tugas</SelectItem>
                    <SelectItem value="Jemput Dokumen" className="text-xs">Jemput Dokumen</SelectItem>
                    <SelectItem value="Proses Samsat" className="text-xs">Proses Samsat</SelectItem>
                    <SelectItem value="Pengantaran Dokumen" className="text-xs">Pengantaran Dokumen</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveHistoryFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetHistoryFilters}
                    className="border-border text-xs h-9 gap-1 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                )}
              </div>

              {/* Table of Messenger Task History */}
              <div className="rounded-lg border border-border bg-card overflow-x-auto shadow-2xs flex-1 flex flex-col min-h-[220px]">
                <Table className={`w-full min-w-[1100px] ${paginatedHistoryData.length === 0 ? "h-full" : ""}`}>
                  <TableHeader className="bg-muted/40 border-b border-border/80">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">No</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nomor Order</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Messenger</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nama Klien</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kendaraan</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tugas Selesai</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waktu Selesai</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Tagihan Order</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bukti & Catatan</TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center w-[90px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedHistoryData.length > 0 ? (
                      paginatedHistoryData.map((item, index) => (
                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-11">
                          <TableCell className="w-12 text-muted-foreground text-center font-mono text-xs">{startHistoryIndex + index + 1}</TableCell>
                          <TableCell className="font-mono text-primary font-semibold text-xs">
                            {item.orderNo}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-semibold text-foreground block">{item.messenger}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{item.messengerEmployeeId || "Kurir"}</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-foreground block">{item.customer}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{item.phone}</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs">
                              {item.nopol}
                            </span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">{item.jenisKendaraan}</span>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge
                              variant="outline"
                              className={`text-[10px] py-0 px-1.5 font-medium gap-1 ${
                                item.taskType === "Jemput Dokumen"
                                  ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                  : item.taskType === "Proses Samsat"
                                  ? "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {item.taskType === "Jemput Dokumen" && <PackageOpen className="w-3 h-3" />}
                              {item.taskType === "Proses Samsat" && <Building2 className="w-3 h-3" />}
                              {item.taskType === "Pengantaran Dokumen" && <Truck className="w-3 h-3" />}
                              {item.taskType}
                            </Badge>
                            <span className="text-[11px] text-foreground/80 block mt-0.5 truncate max-w-[150px]" title={item.layanan}>
                              {item.layanan}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground/80">
                            {formatDateTime(item.completedAt)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <span className="font-mono font-bold text-foreground block">
                              {formatRupiah(item.totalTagihan)}
                            </span>
                            <Badge
                              variant={item.statusBayar === "Lunas" ? "outline" : "secondary"}
                              className={`text-[9px] py-0 px-1 font-medium mt-0.5 ${
                                item.statusBayar === "Lunas"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600 bg-amber-500/10"
                              }`}
                            >
                              {item.statusBayar || "Lunas"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[170px]">
                            <div className="flex items-center gap-1.5">
                              {item.photoProofUrl ? (
                                <img
                                  src={item.photoProofUrl}
                                  alt="Bukti"
                                  className="w-7 h-7 rounded object-cover border border-border shrink-0 cursor-pointer hover:opacity-80"
                                  onClick={() => {
                                    setSelectedHistoryItem(item);
                                    setIsHistoryDetailOpen(true);
                                  }}
                                  title="Klik untuk melihat bukti foto"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-muted/60 border border-border/80 flex items-center justify-center shrink-0 text-muted-foreground">
                                  <Camera className="w-3.5 h-3.5 opacity-40" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                {item.receiverName && (
                                  <span className="text-[11px] font-semibold text-foreground truncate block">
                                    Penerima: {item.receiverName}
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground truncate block" title={item.keterangan}>
                                  {item.keterangan || "-"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center px-1.5 py-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                              onClick={() => {
                                setSelectedHistoryItem(item);
                                setIsHistoryDetailOpen(true);
                              }}
                              title="Lihat Bukti & Detail Lengkap"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="h-full hover:bg-transparent">
                        <TableCell colSpan={10} className="text-center py-8 align-middle p-0">
                          <EmptyState
                            title="Tidak ada riwayat tugas messenger"
                            description="Belum ada riwayat penyelesaian tugas kurir yang cocok dengan pencarian atau filter yang dipilih."
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Standardized Table Pagination for History */}
              <div className="mt-auto pt-1 shrink-0">
                <TablePagination
                  currentPage={historyCurrentPage}
                  totalItems={filteredHistoryData.length}
                  itemsPerPage={historyItemsPerPage}
                  onPageChange={setHistoryCurrentPage}
                  onItemsPerPageChange={(newSize) => {
                    setHistoryItemsPerPage(newSize);
                    setHistoryCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50, 100]}
                />
              </div>
            </Card>
          </motion.div>
        </>
      )}

      {/* View Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90dvh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/80">
            <DialogTitle className="text-base font-semibold text-foreground">Detail Tugas Operasional</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Informasi lengkap tugas messenger terintegrasi OrderStore</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nomor Order</Label>
                  <p className="font-mono text-primary font-medium text-xs">{selectedTask.noBerkas}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge status={selectedTask.status}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(selectedTask.status)}
                      {selectedTask.status}
                    </span>
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Messenger</Label>
                  <p className="font-medium text-foreground">{selectedTask.messenger}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nama Customer</Label>
                  <p className="font-medium text-foreground">{selectedTask.customer}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Jenis Pengurusan</Label>
                  <p className="text-foreground">{selectedTask.jenisTugas}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Keterangan Tugas</Label>
                  <p className="text-foreground font-medium">{selectedTask.keteranganTugas}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nomor Polisi</Label>
                  <p className="font-mono text-foreground">{selectedTask.nopol}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nomor Telepon</Label>
                  <p className="font-mono text-foreground">{selectedTask.phone}</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Lokasi / Alamat</Label>
                <p className="text-foreground">{selectedTask.lokasi}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tanggal Terima</Label>
                  <p className="font-mono text-foreground">{selectedTask.tanggalTerima}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tanggal Selesai</Label>
                  <p className="font-mono text-foreground">{selectedTask.tanggalSelesai}</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Catatan Operasional</Label>
                <p className="text-foreground/90">{selectedTask.keterangan}</p>
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsViewDialogOpen(false)} className="w-full sm:w-auto h-8 text-xs">
              Tutup
            </Button>
            {selectedTask && selectedTask.status !== "Selesai" && (
              <Button
                size="sm"
                className="w-full sm:w-auto h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 shadow-xs"
                onClick={() => {
                  const taskToTake = selectedTask;
                  setIsViewDialogOpen(false);
                  handleOpenAmbilAlih(taskToTake);
                }}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Ambil Alih Tugas Ini
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Detail & Proof Dialog */}
      <Dialog open={isHistoryDetailOpen} onOpenChange={setIsHistoryDetailOpen}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90dvh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/80">
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <span>Detail Riwayat Tugas — {selectedHistoryItem?.orderNo}</span>
              </DialogTitle>
              {selectedHistoryItem && (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Audit rincian tugas yang telah diselesaikan kurir, verifikasi tagihan, dan bukti serah terima
            </DialogDescription>
          </DialogHeader>

          {selectedHistoryItem && (
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {/* Key Badges */}
              <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/80">
                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-0.5 font-semibold ${
                    selectedHistoryItem.taskType === "Jemput Dokumen"
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : selectedHistoryItem.taskType === "Proses Samsat"
                      ? "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {selectedHistoryItem.taskType}
                </Badge>
                <span className="text-muted-foreground">•</span>
                <span className="font-mono font-medium text-foreground">{selectedHistoryItem.layanan}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">Selesai pada: <strong className="text-foreground font-mono">{formatDateTime(selectedHistoryItem.completedAt)}</strong></span>
              </div>

              {/* 4 Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Messenger Info */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Truck className="w-3.5 h-3.5 text-primary" />
                    Petugas Messenger
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nama Kurir:</span>
                      <span className="font-medium text-foreground">{selectedHistoryItem.messenger}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID Karyawan:</span>
                      <span className="font-mono text-foreground">{selectedHistoryItem.messengerEmployeeId || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tugas Selesai:</span>
                      <span className="font-medium text-foreground">{selectedHistoryItem.taskType}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Klien & Kendaraan */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    Klien & Kendaraan
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nama Klien:</span>
                      <span className="font-medium text-foreground">{selectedHistoryItem.customer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">No HP:</span>
                      <span className="font-mono text-foreground">{selectedHistoryItem.phone || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nomor Polisi:</span>
                      <span className="font-mono font-bold text-foreground">{selectedHistoryItem.nopol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Jenis Kendaraan:</span>
                      <span className="text-foreground">{selectedHistoryItem.jenisKendaraan || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Keuangan & Tagihan */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    Total Tagihan & Biaya
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted-foreground">Total Tagihan:</span>
                      <span className="text-base font-bold font-mono text-primary">
                        {formatRupiah(selectedHistoryItem.totalTagihan)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status Pembayaran:</span>
                      <Badge
                        variant={selectedHistoryItem.statusBayar === "Lunas" ? "outline" : "secondary"}
                        className={`text-[10px] px-1.5 py-0 ${
                          selectedHistoryItem.statusBayar === "Lunas"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 bg-amber-500/10"
                        }`}
                      >
                        {selectedHistoryItem.statusBayar || "Lunas"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Jumlah Terbayar:</span>
                      <span className="font-mono text-foreground">
                        {formatRupiah(selectedHistoryItem.terbayar || selectedHistoryItem.totalTagihan)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Penyelesaian & Penerima */}
                <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
                    Keterangan Penyelesaian
                  </h4>
                  <div className="space-y-1 text-xs">
                    {selectedHistoryItem.receiverName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Penerima Berkas:</span>
                        <span className="font-medium text-foreground">
                          {selectedHistoryItem.receiverName} ({selectedHistoryItem.relationship || "Pemilik Langsung"})
                        </span>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground block">Catatan Petugas:</span>
                      <p className="p-2 rounded bg-muted/40 text-foreground text-[11px] leading-relaxed border border-border/60">
                        {selectedHistoryItem.keterangan || "Tugas diselesaikan dengan baik tanpa kendala."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Foto Bukti */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                  <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                  Foto Bukti Penyelesaian Tugas
                </h4>
                {selectedHistoryItem.photoProofUrl ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-border overflow-hidden bg-black/5 dark:bg-black/30 max-h-[300px] flex items-center justify-center p-2">
                      <img
                        src={selectedHistoryItem.photoProofUrl}
                        alt="Bukti Tugas Messenger"
                        className="max-h-[280px] w-auto object-contain rounded"
                      />
                    </div>
                    <a
                      href={selectedHistoryItem.photoProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" /> Buka Foto Ukuran Penuh
                    </a>
                  </div>
                ) : (
                  <div className="py-6 text-center text-muted-foreground text-xs bg-muted/20 rounded-lg border border-dashed border-border/80">
                    <Camera className="w-6 h-6 mx-auto mb-1 opacity-40" />
                    <span>Tidak ada lampiran foto untuk tugas ini (diselesaikan via loket/sistem)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border/80">
            <Button size="sm" variant="outline" onClick={() => setIsHistoryDetailOpen(false)} className="h-8 text-xs">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90dvh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/80">
            <DialogTitle className="text-base font-semibold text-foreground">Edit Tugas Messenger ({editTaskData?.noBerkas})</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Perbarui informasi tugas dan sinkronisasikan ke OrderStore</DialogDescription>
          </DialogHeader>
          {editTaskData && (
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Messenger</Label>
                  <Select 
                    value={editTaskData.messenger} 
                    onValueChange={(value) => setEditTaskData({...editTaskData, messenger: value})}
                  >
                    <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                      <SelectValue placeholder="Pilih messenger" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableMessengers.map((m) => (
                        <SelectItem key={m} value={m} className="text-xs">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nama Customer</Label>
                  <Input 
                    value={editTaskData.customer}
                    onChange={(e) => setEditTaskData({...editTaskData, customer: e.target.value})}
                    className="bg-input-background border-border h-9 text-xs"
                    placeholder="Nama customer"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Jenis Pengurusan</Label>
                  <Select value={editTaskData.jenisTugas} onValueChange={(value) => setEditTaskData({...editTaskData, jenisTugas: value})}>
                    <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                      <SelectValue placeholder="Pilih jenis pengurusan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Perpanjangan 1 Tahun" className="text-xs">Perpanjangan 1 Tahun</SelectItem>
                      <SelectItem value="Perpanjangan 5 Tahun" className="text-xs">Perpanjangan 5 Tahun</SelectItem>
                      <SelectItem value="Balik Nama" className="text-xs">Balik Nama</SelectItem>
                      <SelectItem value="Mutasi Keluar" className="text-xs">Mutasi Keluar</SelectItem>
                      <SelectItem value="Mutasi Masuk" className="text-xs">Mutasi Masuk</SelectItem>
                      <SelectItem value="Mutasi Luar Daerah" className="text-xs">Mutasi Luar Daerah</SelectItem>
                      <SelectItem value="Mutasi Antar Samsat" className="text-xs">Mutasi Antar Samsat</SelectItem>
                      <SelectItem value="Tarik Berkas" className="text-xs">Tarik Berkas</SelectItem>
                      <SelectItem value="Duplikat STNK" className="text-xs">Duplikat STNK</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Keterangan Tugas</Label>
                  <Select 
                    value={editTaskData.keteranganTugas} 
                    onValueChange={(value: any) => setEditTaskData({...editTaskData, keteranganTugas: value})}
                  >
                    <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                      <SelectValue placeholder="Pilih keterangan tugas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Jemput Dokumen" className="text-xs">Jemput Dokumen</SelectItem>
                      <SelectItem value="Proses Samsat" className="text-xs">Proses Samsat</SelectItem>
                      <SelectItem value="Pengantaran Dokumen" className="text-xs">Pengantaran Dokumen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Lokasi / Samsat</Label>
                  <Select value={editTaskData.lokasi} onValueChange={(value) => setEditTaskData({...editTaskData, lokasi: value})}>
                    <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                      <SelectValue placeholder="Pilih lokasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Samsat Jakarta Timur" className="text-xs">Samsat Jakarta Timur</SelectItem>
                      <SelectItem value="Samsat Jakarta Barat" className="text-xs">Samsat Jakarta Barat</SelectItem>
                      <SelectItem value="Samsat Jakarta Selatan" className="text-xs">Samsat Jakarta Selatan</SelectItem>
                      <SelectItem value="Samsat Jakarta Utara" className="text-xs">Samsat Jakarta Utara</SelectItem>
                      <SelectItem value="Samsat Depok" className="text-xs">Samsat Depok</SelectItem>
                      <SelectItem value="Samsat Bekasi" className="text-xs">Samsat Bekasi</SelectItem>
                      <SelectItem value="Samsat Tangerang" className="text-xs">Samsat Tangerang</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select 
                    value={editTaskData.status} 
                    onValueChange={(value: any) => setEditTaskData({...editTaskData, status: value})}
                  >
                    <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Belum Diambil" className="text-xs">Belum Diambil</SelectItem>
                      <SelectItem value="Dalam Proses" className="text-xs">Dalam Proses</SelectItem>
                      <SelectItem value="Selesai" className="text-xs">Selesai</SelectItem>
                      <SelectItem value="Pending" className="text-xs">Pending</SelectItem>
                      <SelectItem value="Dibatalkan" className="text-xs">Dibatalkan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tanggal Terima</Label>
                  <Input 
                    type="date"
                    value={editTaskData.tanggalTerima}
                    onChange={(e) => setEditTaskData({...editTaskData, tanggalTerima: e.target.value})}
                    className="bg-input-background border-border h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tanggal Selesai</Label>
                  <Input 
                    type="date"
                    value={editTaskData.tanggalSelesai === "-" ? "" : editTaskData.tanggalSelesai}
                    onChange={(e) => setEditTaskData({...editTaskData, tanggalSelesai: e.target.value || "-"})}
                    className="bg-input-background border-border h-9 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Catatan / Keterangan</Label>
                <Input 
                  value={editTaskData.keterangan}
                  onChange={(e) => setEditTaskData({...editTaskData, keterangan: e.target.value})}
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Keterangan tambahan"
                />
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto h-8 text-xs">
              Batal
            </Button>
            <Button onClick={handleUpdateTask} size="sm" className="w-full sm:w-auto h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90dvh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 border-b border-border/80">
            <DialogTitle className="text-base font-semibold text-foreground">Tambah Tugas Baru</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Buat tugas operasional baru yang terhubung langsung ke OrderStore</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Messenger</Label>
                <Select value={newTaskData.messenger} onValueChange={(value) => setNewTaskData({...newTaskData, messenger: value})}>
                  <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                    <SelectValue placeholder="Pilih messenger (opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableMessengers.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Nama Customer <span className="text-destructive font-semibold">*</span>
                </Label>
                <Input 
                  value={newTaskData.customer}
                  onChange={(e) => setNewTaskData({...newTaskData, customer: e.target.value})}
                  className="bg-input-background border-border h-9 text-xs"
                  placeholder="Nama customer"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Jenis Pengurusan <span className="text-destructive font-semibold">*</span>
                </Label>
                <Select value={newTaskData.jenisTugas} onValueChange={(value) => setNewTaskData({...newTaskData, jenisTugas: value})}>
                  <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                    <SelectValue placeholder="Pilih jenis pengurusan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Perpanjangan 1 Tahun" className="text-xs">Perpanjangan 1 Tahun</SelectItem>
                    <SelectItem value="Perpanjangan 5 Tahun" className="text-xs">Perpanjangan 5 Tahun</SelectItem>
                    <SelectItem value="Balik Nama" className="text-xs">Balik Nama</SelectItem>
                    <SelectItem value="Mutasi Keluar" className="text-xs">Mutasi Keluar</SelectItem>
                    <SelectItem value="Mutasi Masuk" className="text-xs">Mutasi Masuk</SelectItem>
                    <SelectItem value="Mutasi Luar Daerah" className="text-xs">Mutasi Luar Daerah</SelectItem>
                    <SelectItem value="Mutasi Antar Samsat" className="text-xs">Mutasi Antar Samsat</SelectItem>
                    <SelectItem value="Tarik Berkas" className="text-xs">Tarik Berkas</SelectItem>
                    <SelectItem value="Duplikat STNK" className="text-xs">Duplikat STNK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Keterangan Tugas</Label>
                <Select value={newTaskData.keteranganTugas} onValueChange={(value) => setNewTaskData({...newTaskData, keteranganTugas: value})}>
                  <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                    <SelectValue placeholder="Pilih keterangan tugas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Jemput Dokumen" className="text-xs">Jemput Dokumen</SelectItem>
                    <SelectItem value="Proses Samsat" className="text-xs">Proses Samsat</SelectItem>
                    <SelectItem value="Pengantaran Dokumen" className="text-xs">Pengantaran Dokumen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Lokasi / Samsat</Label>
                <Select value={newTaskData.lokasi} onValueChange={(value) => setNewTaskData({...newTaskData, lokasi: value})}>
                  <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                    <SelectValue placeholder="Pilih lokasi samsat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Samsat Jakarta Timur" className="text-xs">Samsat Jakarta Timur</SelectItem>
                    <SelectItem value="Samsat Jakarta Barat" className="text-xs">Samsat Jakarta Barat</SelectItem>
                    <SelectItem value="Samsat Jakarta Selatan" className="text-xs">Samsat Jakarta Selatan</SelectItem>
                    <SelectItem value="Samsat Jakarta Utara" className="text-xs">Samsat Jakarta Utara</SelectItem>
                    <SelectItem value="Samsat Depok" className="text-xs">Samsat Depok</SelectItem>
                    <SelectItem value="Samsat Bekasi" className="text-xs">Samsat Bekasi</SelectItem>
                    <SelectItem value="Samsat Tangerang" className="text-xs">Samsat Tangerang</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tanggal Terima</Label>
                <Input 
                  type="date"
                  value={newTaskData.tanggalTerima}
                  onChange={(e) => setNewTaskData({...newTaskData, tanggalTerima: e.target.value})}
                  className="bg-input-background border-border h-9 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto h-8 text-xs">
              Batal
            </Button>
            <Button onClick={handleAddTask} size="sm" className="w-full sm:w-auto h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
              Tambah Tugas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* AMBIL ALIH FUNGSI MESSENGER (ADMIN TAKEOVER DIALOG)      */}
      {/* ======================================================== */}
      <Dialog open={isAmbilAlihOpen} onOpenChange={setIsAmbilAlihOpen}>
        <DialogContent className="w-full sm:max-w-2xl lg:max-w-3xl max-h-[92dvh] flex flex-col p-0 overflow-hidden bg-card text-card-foreground">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <Badge status={ambilAlihTask?.status || "Dalam Proses"} className="text-xs">
                {ambilAlihTask?.keteranganTugas || "Tugas Messenger"}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{ambilAlihTask?.noBerkas}</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2 mt-1">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              Ambil Alih Tugas Messenger — {ambilAlihTask?.noBerkas}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Formulir pengambilalihan tugas operasional kurir oleh Admin / Supervisor (apabila kurir berhalangan atau lupa melapor)
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            {/* Context Order & Messenger Terjadwal */}
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Customer</span>
                  <span className="font-semibold text-foreground">{ambilAlihTask?.customer}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Nomor Polisi</span>
                  <span className="font-mono font-semibold text-foreground">{ambilAlihTask?.nopol}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Pengurusan</span>
                  <span className="font-medium text-foreground">{ambilAlihTask?.jenisTugas}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Messenger Asal</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    {ambilAlihTask?.messenger || "Belum Ditugaskan"}
                  </span>
                </div>
              </div>

              {/* Admin Office Instructions */}
              {(liveOrder?.catatanPenjadwalan || liveOrder?.catatanSamsat || liveOrder?.catatanPengantaran || liveOrder?.catatanOrder) && (
                <div className="p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs text-blue-950 dark:text-blue-100 space-y-1 mt-2">
                  <div className="font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                    <Info className="w-3.5 h-3.5" />
                    <span>Instruksi Admin Kantor Sebelumnya:</span>
                  </div>
                  {ambilAlihTask?.keteranganTugas === "Jemput Dokumen" && (liveOrder.catatanPenjadwalan || liveOrder.catatanOrder) && (
                    <p className="whitespace-pre-wrap">{liveOrder.catatanPenjadwalan || liveOrder.catatanOrder}</p>
                  )}
                  {ambilAlihTask?.keteranganTugas === "Proses Samsat" && (liveOrder.catatanSamsat || liveOrder.catatanOrder) && (
                    <p className="whitespace-pre-wrap">{liveOrder.catatanSamsat || liveOrder.catatanOrder}</p>
                  )}
                  {ambilAlihTask?.keteranganTugas === "Pengantaran Dokumen" && (liveOrder.catatanPengantaran || liveOrder.catatanOrder) && (
                    <p className="whitespace-pre-wrap">{liveOrder.catatanPengantaran || liveOrder.catatanOrder}</p>
                  )}
                  {ambilAlihTask?.keteranganTugas === "Jemput Hasil Samsat" && (liveOrder.catatanSamsat || liveOrder.catatanOrder) && (
                    <p className="whitespace-pre-wrap">{liveOrder.catatanSamsat || liveOrder.catatanOrder}</p>
                  )}
                </div>
              )}
            </div>

            {/* CASE 1: JEMPUT DOKUMEN */}
            {ambilAlihTask?.keteranganTugas === "Jemput Dokumen" && (
              <div className="space-y-4">
                {/* 1. Checklist Sebelum Berangkat */}
                <Card className="p-3.5 border border-border bg-card space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    1. Checklist Sebelum Berangkat
                  </h4>
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pickupChecklist.tasAntiAir}
                        onChange={(e) => setPickupChecklist({ ...pickupChecklist, tasAntiAir: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs text-foreground">Map / Pouch Berkas Anti Air Siap</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pickupChecklist.kontakKlien}
                        onChange={(e) => setPickupChecklist({ ...pickupChecklist, kontakKlien: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs text-foreground">Konfirmasi Kontak & Titik Temu Pelanggan</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pickupChecklist.cekRute}
                        onChange={(e) => setPickupChecklist({ ...pickupChecklist, cekRute: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs text-foreground">Cek Rute Alamat Penjemputan</span>
                    </label>
                  </div>
                </Card>

                {/* 2. Checklist Dokumen Fisik yang Diambil */}
                <Card className="p-3.5 border border-border bg-card space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    2. Dokumen Fisik yang Diterima dari Klien
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pickupDocs.stnk}
                        onChange={(e) => setPickupDocs({ ...pickupDocs, stnk: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs font-semibold text-foreground">STNK Asli</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pickupDocs.bpkb}
                        onChange={(e) => setPickupDocs({ ...pickupDocs, bpkb: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs font-semibold text-foreground">BPKB Asli</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pickupDocs.ktp}
                        onChange={(e) => setPickupDocs({ ...pickupDocs, ktp: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs font-semibold text-foreground">KTP Pemilik Asli</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pickupDocs.skkp}
                        onChange={(e) => setPickupDocs({ ...pickupDocs, skkp: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs font-semibold text-foreground">SKKP (Surat Ketetapan Pajak)</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border cursor-pointer sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={pickupDocs.lainnya}
                        onChange={(e) => setPickupDocs({ ...pickupDocs, lainnya: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs font-semibold text-foreground">Dokumen Tambahan / Surat Kuasa</span>
                    </label>
                  </div>
                </Card>

                {/* 3. Upload Foto Bukti Penjemputan */}
                <Card className="p-3.5 border border-border bg-card space-y-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-primary" />
                    3. Foto Bukti Penjemputan Berkas (Opsional)
                  </Label>
                  <input
                    ref={pickupFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePickupPhotoChange}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => pickupFileInputRef.current?.click()}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-primary" />
                      {pickupPhotoUrl ? "Ganti Foto Bukti" : "Upload Foto Bukti"}
                    </Button>
                    {pickupPhotoUrl && (
                      <div className="flex items-center gap-2">
                        <img
                          src={pickupPhotoUrl}
                          alt="Bukti penjemputan"
                          className="w-10 h-10 object-cover rounded border border-border"
                        />
                        <span className="text-xs text-emerald-600 font-semibold">✓ Foto terlampir</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => setPickupPhotoUrl("")}
                        >
                          Hapus
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {/* 4. Catatan Penjemputan */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    4. Catatan Hasil Penjemputan Lapangan
                  </Label>
                  <Textarea
                    placeholder="Catatan kondisi dokumen, titipan tambahan, atau konfirmasi dengan customer..."
                    value={pickupNotes}
                    onChange={(e) => setPickupNotes(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {/* CASE 2: PROSES SAMSAT */}
            {ambilAlihTask?.keteranganTugas === "Proses Samsat" && (
              <div className="space-y-4">
                {/* Komponen Pengurusan Samsat (SSoT) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      Status Komponen Pengurusan Samsat ({liveComponents.length})
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-primary border-primary/40 bg-primary/5 hover:bg-primary/10"
                      onClick={() => setIsAddSamsatCompOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Biaya / Komponen
                    </Button>
                  </div>

                  {liveComponents.length > 0 ? (
                    <div className="space-y-2">
                      {liveComponents.map((comp) => {
                        const isDone = comp.status === "COMPLETED";
                        const isInProg = comp.status === "IN_PROGRESS";
                        const isWait = comp.status === "WAITING";

                        return (
                          <div
                            key={comp.componentId}
                            className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{comp.name}</span>
                                {comp.category && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {comp.category}
                                  </Badge>
                                )}
                                <Badge
                                  className={
                                    isDone
                                      ? "bg-emerald-600 text-white"
                                      : isInProg
                                      ? "bg-blue-600 text-white"
                                      : isWait
                                      ? "bg-amber-600 text-white"
                                      : "bg-muted text-muted-foreground"
                                  }
                                >
                                  {isDone ? "Selesai" : isInProg ? "Proses" : isWait ? "Menunggu" : "Belum Mulai"}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Biaya: Rp {(comp.actualOrderPrice || comp.nominal || 0).toLocaleString("id-ID")}
                                {comp.waitingReason ? ` • Menunggu: ${comp.waitingReason}` : ""}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant={isInProg ? "default" : "outline"}
                                className="h-7 px-2 text-[11px]"
                                onClick={() => handleUpdateTakeoverCompStatus(comp.componentId, "IN_PROGRESS", comp.name)}
                              >
                                Proses
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={isWait ? "default" : "outline"}
                                className="h-7 px-2 text-[11px] text-amber-700 dark:text-amber-300"
                                onClick={() => handleUpdateTakeoverCompStatus(comp.componentId, "WAITING", comp.name)}
                              >
                                Menunggu
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={isDone ? "default" : "outline"}
                                className="h-7 px-2 text-[11px] text-emerald-700 dark:text-emerald-300"
                                onClick={() => handleUpdateTakeoverCompStatus(comp.componentId, "COMPLETED", comp.name)}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Selesai
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded border border-border">
                      Tidak ada komponen loket Samsat khusus. Anda dapat menambahkan jika diperlukan.
                    </p>
                  )}
                </div>

                {/* Catatan Operasional Samsat */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Catatan Pelaksanaan di Kantor Samsat
                  </Label>
                  <Textarea
                    placeholder="Catatan loket, nomor pendaftaran berkas, atau kendala lapangan..."
                    value={samsatGeneralNotes}
                    onChange={(e) => setSamsatGeneralNotes(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {/* CASE 3: JEMPUT HASIL SAMSAT */}
            {ambilAlihTask?.keteranganTugas === "Jemput Hasil Samsat" && (
              <div className="space-y-4">
                {/* 1. Checklist Dokumen Hasil */}
                <Card className="p-3.5 border border-border bg-card space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    1. Dokumen Hasil Samsat yang Diterima
                  </h4>
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={samsatResultChecklist.noticePajak}
                        onChange={(e) => setSamsatResultChecklist({ ...samsatResultChecklist, noticePajak: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs text-foreground font-semibold">Notice Pajak / SKKP Baru Asli</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={samsatResultChecklist.stnkBaru}
                        onChange={(e) => setSamsatResultChecklist({ ...samsatResultChecklist, stnkBaru: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs text-foreground font-semibold">STNK Baru / Hasil Pengesahan</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={samsatResultChecklist.platNomor}
                        onChange={(e) => setSamsatResultChecklist({ ...samsatResultChecklist, platNomor: e.target.checked })}
                        className="rounded border-border w-4 h-4 text-primary"
                      />
                      <span className="text-xs text-foreground font-semibold">Plat Nomor (TNKB Baru - jika 5 tahunan)</span>
                    </label>
                  </div>
                </Card>

                {/* 2. Upload Foto Dokumen Hasil */}
                <Card className="p-3.5 border border-border bg-card space-y-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-primary" />
                    2. Foto Bukti Dokumen Hasil Samsat (Opsional)
                  </Label>
                  <input
                    ref={samsatResultFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                    className="hidden"
                    onChange={handleSamsatResultPhotoChange}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => samsatResultFileInputRef.current?.click()}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5 text-primary" />
                      {samsatResultPhotoUrl ? "Ganti Foto Hasil" : "Upload Foto Hasil"}
                    </Button>
                    {samsatResultPhotoUrl && (
                      <div className="flex items-center gap-2">
                        <img
                          src={samsatResultPhotoUrl}
                          alt="Bukti hasil Samsat"
                          className="w-10 h-10 object-cover rounded border border-border"
                        />
                        <span className="text-xs text-emerald-600 font-semibold">✓ Foto terlampir</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => setSamsatResultPhotoUrl("")}
                        >
                          Hapus
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {/* 3. Catatan Hasil Samsat */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    3. Catatan Pengambilan Hasil Samsat
                  </Label>
                  <Textarea
                    placeholder="Notice pajak dan STNK baru sudah diambil dan aman..."
                    value={samsatResultNotes}
                    onChange={(e) => setSamsatResultNotes(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {/* CASE 4: PENGANTARAN DOKUMEN */}
            {ambilAlihTask?.keteranganTugas === "Pengantaran Dokumen" && (
              <div className="space-y-4">
                {/* 1. Identitas Penerima */}
                <Card className="p-3.5 border border-border bg-card space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    1. Identitas Penerima Berkas
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Nama Penerima <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Nama lengkap penerima dokumen"
                        className="h-8 text-xs bg-input-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Hubungan dengan Pemilik
                      </Label>
                      <Select value={recipientRelationship} onValueChange={setRecipientRelationship}>
                        <SelectTrigger className="h-8 text-xs bg-input-background">
                          <SelectValue placeholder="Pilih hubungan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pemilik Langsung" className="text-xs">Pemilik Langsung</SelectItem>
                          <SelectItem value="Pasangan (Suami/Istri)" className="text-xs">Pasangan (Suami/Istri)</SelectItem>
                          <SelectItem value="Keluarga Serumah" className="text-xs">Keluarga Serumah</SelectItem>
                          <SelectItem value="Karyawan / Rekan Kerja" className="text-xs">Karyawan / Rekan Kerja</SelectItem>
                          <SelectItem value="Security / Penerima Titipan" className="text-xs">Security / Penerima Titipan</SelectItem>
                          <SelectItem value="Lainnya" className="text-xs">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>

                {/* 2. Upload Bukti Serah Terima */}
                <Card className="p-3.5 border border-border bg-card space-y-2">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    2. Berkas / Foto Bukti Serah Terima
                  </Label>
                  <input
                    ref={deliveryFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                    className="hidden"
                    onChange={handleDeliveryPhotoChange}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deliveryFileInputRef.current?.click()}
                      disabled={isCompressingDelivery}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-primary" />
                      {isCompressingDelivery ? "Memproses File..." : deliveryPhotoUrl ? "Ganti Berkas" : "Upload Bukti (PDF/JPG/PNG)"}
                    </Button>
                    {deliveryPhotoUrl && (
                      <div className="flex items-center gap-2">
                        {deliveryFileName.toLowerCase().endsWith(".pdf") ? (
                          <div className="w-8 h-8 rounded bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-[10px]">
                            PDF
                          </div>
                        ) : (
                          <img
                            src={deliveryPhotoUrl}
                            alt="Bukti Serah Terima"
                            className="w-10 h-10 object-cover rounded border border-border"
                          />
                        )}
                        <div>
                          <p className="text-xs font-mono font-medium text-foreground">{deliveryFileName || "Bukti_Serah_Terima"}</p>
                          {deliveryFileSize && (
                            <p className="text-[10px] text-muted-foreground">{formatFileSize(deliveryFileSize)}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* 3. Catatan Serah Terima */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    3. Catatan Pengantaran / Penyerahan
                  </Label>
                  <Textarea
                    placeholder="Dokumen telah diterima dengan baik dalam amplop tertutup..."
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAmbilAlihOpen(false)}
              className="w-full sm:w-auto h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmAmbilAlih}
              disabled={isSubmittingTakeover}
              size="sm"
              className="w-full sm:w-auto h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 shadow-xs"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {isSubmittingTakeover ? "Memproses..." : "Konfirmasi Selesaikan Tugas (Ambil Alih)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Component Dialog within Takeover */}
      <Dialog open={isAddSamsatCompOpen} onOpenChange={setIsAddSamsatCompOpen}>
        <DialogContent className="w-full sm:max-w-md p-4 sm:p-6 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Tambah Biaya / Komponen Lapangan</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tambahkan biaya atau proses tambahan loket Samsat yang dikerjakan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nama Komponen / Biaya</Label>
              <Input
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                placeholder="Contoh: Cek Fisik Bantuan, Legalisir..."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kategori</Label>
              <Select value={newCompCategory} onValueChange={setNewCompCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mutasi Masuk" className="text-xs">Mutasi Masuk</SelectItem>
                  <SelectItem value="Mutasi Keluar" className="text-xs">Mutasi Keluar</SelectItem>
                  <SelectItem value="Proses Tambahan Lapangan" className="text-xs">Proses Tambahan Lapangan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nominal Biaya (Rp)</Label>
              <Input
                type="number"
                value={newCompPrice}
                onChange={(e) => setNewCompPrice(e.target.value)}
                placeholder="0"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddSamsatCompOpen(false)} className="h-8 text-xs">
              Batal
            </Button>
            <Button onClick={handleAddSamsatCompSubmit} size="sm" className="h-8 text-xs">
              Simpan Komponen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
