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
  ArrowRightLeft,
  Lock,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { useOrderStore, orderStore, OperationalOrder, StageName } from "../data/orderStore";
import {
  deriveMessengerTasksFromOrders,
  deriveAssignedMessengerTasks,
  isTaskAssignedMessenger,
  calculateOrderTagihan,
  KNOWN_MESSENGERS,
  MessengerTaskItem,
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
  reassignMessengerTaskAction,
} from "../data/messengerTaskAdapter";
import { useKaryawanPengguna } from "../data/karyawanPenggunaAdapter";
import { APP_CONFIG } from "../config/appConfig";
import { processDocumentUpload, formatFileSize } from "../utils/fileCompressor";
import { documentRepository } from "../../data/repositories/documentRepository";
import { formatRupiah } from "../utils/financeFormatters";
import { useServiceStore, serviceStore } from "../data/serviceStore";

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
  useServiceStore();
  
  // Real derived operational tasks from active orders (strictly field messenger tasks with assigned courier)
  // Real derived operational field tasks (Stage 2 Penjadwalan Jemput, Stage 4 Proses Samsat, Stage 7 Pengantaran)
  // Menampilkan seluruh tugas lapangan baik yang sudah ditugaskan maupun yang Belum Ditugaskan
  const taskData = useMemo(() => deriveMessengerTasksFromOrders(activeOrders), [activeOrders]);

  // Active Tasks Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMessenger, setFilterMessenger] = useState("all");
  const [filterTaskType, setFilterTaskType] = useState("all");
  const [filterAssignment, setFilterAssignment] = useState<"all" | "unassigned" | "assigned">("all");

  // Quick Assign Dialog State
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignTargetTask, setAssignTargetTask] = useState<MessengerTaskItem | null>(null);
  const [selectedAssignMessenger, setSelectedAssignMessenger] = useState("");
  const [assignTaskDate, setAssignTaskDate] = useState("");
  const [assignTaskNotes, setAssignTaskNotes] = useState("");

  // Formal Reassignment Dialog State (Alihkan Tugas Resmi)
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [reassignTargetTask, setReassignTargetTask] = useState<MessengerTaskItem | null>(null);
  const [selectedReassignMessenger, setSelectedReassignMessenger] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [isReassignSubmitting, setIsReassignSubmitting] = useState(false);
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
      const isUnassigned = !item.messenger || item.messenger === "Belum Ditugaskan" || item.messenger === "-";
      const matchAssignment =
        filterAssignment === "all" ? true :
        filterAssignment === "unassigned" ? isUnassigned :
        !isUnassigned;
      
      return matchSearch && matchStatus && matchMessenger && matchTaskType && matchAssignment;
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
    setFilterAssignment("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm || filterMessenger !== "all" || filterStatus !== "all" || filterTaskType !== "all" || filterAssignment !== "all"
  );

  // Stats calculation directly derived from real active assigned tasks
  const statusCounts = useMemo(() => ({
    belumDiambil: taskData.filter(t => t.status === "Belum Diambil").length,
    dalamProses: taskData.filter(t => t.status === "Dalam Proses").length,
    selesai: taskData.filter(t => t.status === "Selesai").length,
    pending: taskData.filter(t => t.status === "Pending").length,
  }), [taskData]);

  const handleOpenAssignDialog = (task: MessengerTaskItem) => {
    setAssignTargetTask(task);
    setSelectedAssignMessenger("");
    setAssignTaskDate(new Date().toISOString().split("T")[0]);
    setAssignTaskNotes("");
    setIsAssignDialogOpen(true);
  };

  const handleConfirmAssign = () => {
    if (!assignTargetTask) return;
    if (!selectedAssignMessenger) {
      toast.error("Pilih kurir terlebih dahulu!");
      return;
    }
    const orderNo = assignTargetTask.noBerkas;
    const currentOrder = orderStore.getOrderByNo(orderNo);
    if (!currentOrder) {
      toast.error("Order tidak ditemukan");
      return;
    }

    const courierName = selectedAssignMessenger.trim();
    const courierId = resolveMessengerEmployeeId(courierName);
    const targetDate = assignTaskDate || new Date().toISOString().split("T")[0];

    // Initialize acceptance status to PENDING so task enters courier's Tugas Baru
    const updatedAcceptance = {
      ...(currentOrder.taskAcceptance || {}),
      [assignTargetTask.keteranganTugas]: {
        status: "PENDING" as const,
        courierId,
        courierName,
        isLocked: false,
      },
    };

    if (assignTargetTask.keteranganTugas === "Pengantaran Dokumen") {
      orderStore.updateOrder(orderNo, {
        messengerPengantar: courierName,
        assignedMessengerName: courierName,
        assignedMessengerId: courierId,
        tanggalPengantaran: targetDate,
        isDeliveryScheduled: true,
        taskAcceptance: updatedAcceptance,
        deliveryStatus: "Terjadwal Antar",
        catatanPengantaran: assignTaskNotes || currentOrder.catatanPengantaran,
      });
    } else if (assignTargetTask.keteranganTugas === "Proses Samsat") {
      orderStore.updateOrder(orderNo, {
        samsatMessenger: courierName,
        samsatMessengerNama: courierName,
        samsatMessengerId: courierId,
        assignedMessengerName: courierName,
        assignedMessengerId: courierId,
        tanggalProsesSamsat: targetDate,
        isSamsatScheduled: true,
        taskAcceptance: updatedAcceptance,
        samsatStatus: "Terjadwal Samsat",
        catatanSamsat: assignTaskNotes || currentOrder.catatanSamsat,
      });
    } else {
      // Jemput Dokumen
      orderStore.updateOrder(orderNo, {
        messenger: courierName,
        assignedMessengerName: courierName,
        assignedMessengerId: courierId,
        tanggalJemput: targetDate,
        isScheduled: true,
        taskAcceptance: updatedAcceptance,
        messengerTaskStatus: "Terjadwal Jemput",
        catatanPenjadwalan: assignTaskNotes || currentOrder.catatanPenjadwalan,
      });
    }

    setIsAssignDialogOpen(false);
    setAssignTargetTask(null);
    toast.success(`Kurir ${courierName} berhasil ditugaskan! Tugas masuk ke tab Tugas Baru kurir.`);
  };

  const handleOpenReassignDialog = (task: MessengerTaskItem) => {
    setReassignTargetTask(task);
    setSelectedReassignMessenger("");
    setReassignReason("");
    setIsReassignDialogOpen(true);
  };

  const handleConfirmReassign = async () => {
    if (!reassignTargetTask) return;
    if (!selectedReassignMessenger) {
      toast.error("Pilih kurir pengganti terlebih dahulu!");
      return;
    }
    const cleanReason = reassignReason.trim();
    if (!cleanReason || cleanReason.length < 5) {
      toast.error("Alasan pengalihan tugas wajib diisi minimal 5 karakter!");
      return;
    }

    const orderNo = reassignTargetTask.noBerkas;
    const newCourierName = selectedReassignMessenger.trim();
    const newCourierId = resolveMessengerEmployeeId(newCourierName) || "emp-msg";

    const adminUser = {
      userName: "Admin Kantor",
      role: "admin",
      employeeId: "admin",
    };

    setIsReassignSubmitting(true);
    try {
      const res = await reassignMessengerTaskAction(
        orderNo,
        reassignTargetTask.keteranganTugas,
        newCourierName,
        newCourierId,
        cleanReason,
        adminUser
      );
      if (res.success) {
        toast.success(`Tugas order ${orderNo} berhasil dialihkan ke ${newCourierName} (masuk ke Tugas Baru)!`);
        setIsReassignDialogOpen(false);
        setReassignTargetTask(null);
        setReassignReason("");
      } else {
        toast.error(res.error || "Gagal mengalihkan tugas");
      }
    } finally {
      setIsReassignSubmitting(false);
    }
  };

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
        } else if (currentOrder.currentStep === 2) {
          // Advance from Jemput Dokumen to Stage 3 (Verifikasi Dokumen Fisik di Loket)
          orderStore.advanceOrder(orderNo, "Verifikasi Dokumen", {
            ...updates,
            pickupCompleted: true,
            messengerTaskStatus: "Dokumen Sudah Tersedia",
          });
          setIsEditDialogOpen(false);
          setEditTaskData(null);
          toast.success(`Penjemputan berkas ${orderNo} selesai! Berkas siap diverifikasi di Stage 3.`);
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
    <div className="flex-1 flex flex-col min-h-full space-y-3 p-3 sm:p-4 md:p-4 w-full min-w-0 text-left">
      {/* Active Tasks & History Link Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pb-0.5 shrink-0">
        <Badge variant="outline" className="text-xs font-medium px-2.5 py-1 gap-1.5 border-primary/20 bg-primary/5 text-primary self-start sm:self-auto">
          <Truck className="w-3.5 h-3.5" />
          <span>Tugas Aktif Lapangan: {taskData.length}</span>
        </Badge>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/messenger/history")}
          className="h-8 px-2.5 text-xs font-medium gap-1.5 rounded-lg border-primary/40 text-primary hover:bg-primary/10 self-start sm:self-auto"
          title="Buka Halaman Lengkap Messenger History (Arsip Detail & Pengajuan Biaya)"
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Portal Messenger History & Biaya</span>
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>

      <>
        {/* Quick Stats for Active Tasks */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="p-3 border border-border/80 bg-card shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Belum Diambil</p>
                  <h3 className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">{statusCounts.belumDiambil}</h3>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-3 border border-border/80 bg-card shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Dalam Proses</p>
                  <h3 className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">{statusCounts.dalamProses}</h3>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-3 border border-border/80 bg-card shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Selesai Lapangan</p>
                  <h3 className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">{statusCounts.selesai}</h3>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-3 border border-border/80 bg-card shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pending / Menunggu</p>
                  <h3 className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">{statusCounts.pending}</h3>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex-1 flex flex-col min-h-0"
        >
          <Card className="p-3 sm:p-4 border border-border/80 bg-card shadow-2xs flex-1 flex flex-col min-h-0 rounded-xl">
            {/* Active Tasks Filters */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3 shrink-0 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Cari nomor order, nama customer, messenger, atau nomor polisi..." 
                  className="pl-9 bg-input-background border-border h-8 text-xs font-normal"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    handleFilterChange();
                  }}
                />
              </div>
              <Select 
                value={filterAssignment} 
                onValueChange={(value) => {
                  setFilterAssignment(value as any);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-full sm:w-[155px] bg-input-background border-border h-8 text-xs font-normal">
                  <SelectValue placeholder="Semua Penugasan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Semua Penugasan</SelectItem>
                  <SelectItem value="unassigned" className="text-xs font-medium text-amber-600 dark:text-amber-400">Belum Ditugaskan</SelectItem>
                  <SelectItem value="assigned" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Sudah Ditugaskan</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={filterMessenger} 
                onValueChange={(value) => {
                  setFilterMessenger(value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-full sm:w-[160px] bg-input-background border-border h-8 text-xs font-normal">
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
                <SelectTrigger className="w-full sm:w-[160px] bg-input-background border-border h-8 text-xs font-normal">
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
                <SelectTrigger className="w-full sm:w-[150px] bg-input-background border-border h-8 text-xs font-normal">
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
                  className="border-border text-xs h-8 gap-1 text-muted-foreground hover:text-foreground shrink-0 font-medium px-2.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </Button>
              )}
              <Button className="bg-primary hover:bg-primary/90 h-8 text-xs shrink-0 font-medium px-3" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Tugas Baru
              </Button>
            </div>

            {/* Table of Active Tasks */}
            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
              <div className="w-full flex-1 flex flex-col min-h-0">
                <Table 
                  containerClassName="overflow-y-auto overflow-x-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-340px)] min-h-[160px]"
                  className={`w-full min-w-[850px] ${paginatedData.length === 0 ? "h-full" : ""}`}
                >
                  <TableHeader className="sticky top-0 z-10 bg-card border-b border-border/80 shadow-2xs">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 h-8 px-2 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-card">No</TableHead>
                      <TableHead className="h-8 px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-card">Nomor Order</TableHead>
                      <TableHead className="h-8 px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-card">Messenger</TableHead>
                      <TableHead className="h-8 px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-card">Nama Customer</TableHead>
                      <TableHead className="h-8 px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-card">Jenis Pengurusan</TableHead>
                      <TableHead className="h-8 px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-card">Keterangan Tugas</TableHead>
                      <TableHead className="h-8 px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-card">Lokasi</TableHead>
                      <TableHead className="h-8 px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-card">Tgl Terima</TableHead>
                      <TableHead className="h-8 px-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center bg-card">Status</TableHead>
                      <TableHead className="h-8 px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center min-w-[130px] xl:min-w-[190px] bg-card">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length > 0 ? (
                      paginatedData.map((task, index) => {
                        const isAssigned = isTaskAssignedMessenger(task);

                        const isTaskLocked = Boolean(
                          isAssigned && (
                            task.isLocked ||
                            task.acceptanceStatus === "ACCEPTED" ||
                            task.status === "Dalam Proses" ||
                            task.lifecycleStatus === "DITERIMA" ||
                            task.lifecycleStatus === "SEDANG_DIKERJAKAN" ||
                            task.acceptanceStatus === "SUPERSEDED"
                          )
                        );

                        return (
                          <TableRow key={task.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-9">
                            <TableCell className="w-10 px-2 py-1.5 text-muted-foreground text-center font-mono text-[11px] font-normal">{startIndex + index + 1}</TableCell>
                            <TableCell className="px-2.5 py-1.5 font-mono text-primary font-medium text-xs">
                              {task.noBerkas}
                            </TableCell>
                            <TableCell className="px-2.5 py-1.5 text-xs">
                              {!isAssigned ? (
                                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 font-medium text-[11px] px-1.5 py-0.5">
                                  Belum Ditugaskan
                                </Badge>
                              ) : (
                                <div>
                                  <span className="text-foreground font-medium text-xs block leading-tight">
                                    {task.messenger && task.messenger !== "Belum Ditugaskan" && task.messenger !== "-"
                                      ? task.messenger
                                      : (task.assignedMessengerId || "Kurir Ditugaskan")}
                                  </span>
                                  {task.acceptanceStatus === "PENDING" && !isTaskLocked && task.status !== "Selesai" && (
                                    <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 flex items-center gap-1 w-fit mt-0.5">
                                      <Clock className="w-2.5 h-2.5" />
                                      Menunggu Diterima
                                    </Badge>
                                  )}
                                  {task.reassignedFrom && (
                                    <span className="block text-[10px] font-normal text-muted-foreground truncate max-w-[130px] mt-0.5" title={`Dialihkan dari ${task.reassignedFrom} (${task.reassignReason || ""})`}>
                                      ex: {task.reassignedFrom}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="px-2.5 py-1.5 font-normal text-foreground text-xs">{task.customer}</TableCell>
                            <TableCell className="px-2.5 py-1.5 text-xs text-foreground/80 font-normal">{task.jenisTugas}</TableCell>
                            <TableCell className="px-2.5 py-1.5 text-xs">
                              <span className="flex items-center gap-1.5 font-medium text-foreground">
                                <PackageOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                {task.keteranganTugas}
                              </span>
                            </TableCell>
                            <TableCell className="px-2.5 py-1.5 max-w-[180px] truncate text-xs text-muted-foreground font-normal" title={task.lokasi}>
                              {task.lokasi}
                            </TableCell>
                            <TableCell className="px-2.5 py-1.5 text-xs">
                              <div className="font-mono text-foreground/80 font-normal">{task.tanggalTerima}</div>
                              {task.targetCompletionDate && (
                                <div className="text-[10px] font-normal text-muted-foreground flex items-center gap-1 mt-0.5" title="Estimasi Selesai Order Customer">
                                  <Calendar className="w-2.5 h-2.5 text-primary shrink-0" />
                                  <span>Est: {new Date(task.targetCompletionDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="px-2.5 py-1.5 text-center text-xs">
                              <Badge status={task.status} className="font-medium text-[11px] px-2 py-0.5">
                                <span className="flex items-center gap-1">
                                  {getStatusIcon(task.status)}
                                  {task.status}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center px-2 py-1.5 min-w-[130px] xl:min-w-[190px]">
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
                                {!isAssigned ? (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 px-2 text-[11px] font-medium gap-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded transition-colors shadow-2xs"
                                    onClick={() => handleOpenAssignDialog(task)}
                                    title="Tugaskan Kurir untuk Tugas Lapangan Ini"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                    <span>Tugaskan</span>
                                  </Button>
                                ) : task.status !== "Selesai" ? (
                                  <>
                                    {isTaskLocked ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          className="h-7 px-1.5 text-[11px] font-medium gap-1 rounded border-border/80 bg-muted/40 text-muted-foreground/70 disabled:pointer-events-auto cursor-not-allowed opacity-60 hover:bg-muted/40 shadow-none"
                                          title="Tugas sudah diambil kurir (Terkunci)"
                                        >
                                          <Lock className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                                          <span className="hidden xl:inline">Alihkan</span>
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          className="h-7 px-1.5 text-[11px] font-medium gap-1 rounded border-border/80 bg-muted/40 text-muted-foreground/70 disabled:pointer-events-auto cursor-not-allowed opacity-60 hover:bg-muted/40 shadow-none"
                                          title="Tugas sudah diambil kurir (Terkunci)"
                                        >
                                          <Lock className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                                          <span className="hidden xl:inline">Ambil Alih</span>
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-1.5 text-[11px] font-medium gap-1 border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors shadow-2xs"
                                          onClick={() => handleOpenReassignDialog(task)}
                                          title="Alihkan Tugas Resmi (Memerlukan Alasan Pengalihan)"
                                        >
                                          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                          <span className="hidden xl:inline">Alihkan</span>
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-1.5 text-[11px] font-medium gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-colors shadow-2xs"
                                          onClick={() => handleOpenAmbilAlih(task)}
                                          title="Ambil Alih Fungsi Messenger (Admin Takeover)"
                                        >
                                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                          <span className="hidden xl:inline">Ambil Alih</span>
                                        </Button>
                                      </>
                                    )}
                                  </>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
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
              <div className="border-t border-border/80 px-3 py-2 bg-card shrink-0 mt-auto">
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
            </div>
          </Card>
        </motion.div>
      </>

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
                      {serviceStore.getActive().map((svc) => (
                        <SelectItem key={svc.id} value={svc.nama_layanan} className="text-xs">
                          {svc.nama_layanan}
                        </SelectItem>
                      ))}
                      {editTaskData.jenisTugas && !serviceStore.getActive().some((s) => s.nama_layanan === editTaskData.jenisTugas) && (
                        <SelectItem value={editTaskData.jenisTugas} className="text-xs">
                          {editTaskData.jenisTugas}
                        </SelectItem>
                      )}
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
                    {serviceStore.getActive().map((svc) => (
                      <SelectItem key={svc.id} value={svc.nama_layanan} className="text-xs">
                        {svc.nama_layanan}
                      </SelectItem>
                    ))}
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

      {/* Quick Assign Messenger Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="w-full sm:max-w-md p-4 sm:p-6 text-xs">
          <DialogHeader className="pb-2 border-b border-border/80">
            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Tugaskan Kurir Lapangan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Alokasikan tugas {assignTargetTask?.keteranganTugas} ({assignTargetTask?.noBerkas}) kepada messenger
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">No. Order / Berkas:</span>
                <span className="font-mono font-semibold text-primary">{assignTargetTask?.noBerkas}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium text-foreground">{assignTargetTask?.customer}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Tugas Operasional:</span>
                <Badge variant="secondary" className="text-[11px] font-medium">{assignTargetTask?.keteranganTugas}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Lokasi:</span>
                <span className="truncate max-w-[200px] text-foreground">{assignTargetTask?.lokasi}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Pilih Messenger / Kurir <span className="text-destructive">*</span></Label>
              <Select value={selectedAssignMessenger} onValueChange={setSelectedAssignMessenger}>
                <SelectTrigger className="bg-input-background border-border h-9 text-xs">
                  <SelectValue placeholder="Pilih messenger operasional..." />
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
              <Label className="text-xs font-medium">Tanggal Tugas Operasional</Label>
              <Input
                type="date"
                value={assignTaskDate}
                onChange={(e) => setAssignTaskDate(e.target.value)}
                className="bg-input-background border-border h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan Tugas untuk Kurir (Opsional)</Label>
              <Textarea
                placeholder="Contoh: Titik temu di satpam pos depan, hubungi klien sebelum jalan..."
                value={assignTaskNotes}
                onChange={(e) => setAssignTaskNotes(e.target.value)}
                rows={2}
                className="bg-input-background border-border text-xs resize-none"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t border-border/80 flex flex-row items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAssignDialogOpen(false)} className="h-8 text-xs font-medium">
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmAssign}
              disabled={!selectedAssignMessenger}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              Simpan & Tugaskan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formal Reassignment Dialog (Alihkan Tugas Resmi) */}
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="w-full sm:max-w-md p-4 sm:p-6 text-xs text-left">
          <DialogHeader className="pb-2 border-b border-border/80">
            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              Alihkan Tugas Kurir Resmi (Reassign)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pengalihan tugas kurir membutuhkan alasan operasional wajib dan akan dicatat dalam riwayat audit.
            </DialogDescription>
          </DialogHeader>

          {reassignTargetTask && (
            <div className="space-y-3.5 py-2">
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nomor Order:</span>
                  <span className="font-semibold text-foreground font-mono">{reassignTargetTask.noBerkas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium text-foreground">{reassignTargetTask.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Keterangan Tugas:</span>
                  <span className="font-medium text-primary">{reassignTargetTask.keteranganTugas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kurir Saat Ini:</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{reassignTargetTask.messenger}</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">
                  Pilih Kurir Pengganti <span className="text-rose-500">*</span>
                </Label>
                <Select value={selectedReassignMessenger} onValueChange={setSelectedReassignMessenger}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Pilih Kurir Baru" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableMessengers
                      .filter((m) => m !== "Belum Ditugaskan" && m !== reassignTargetTask.messenger)
                      .map((messenger) => (
                        <SelectItem key={messenger} value={messenger} className="text-xs">
                          {messenger}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">
                  Alasan Pengalihan Tugas <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Contoh: Kurir terkendala cuaca buruk / kendaraan mogok / rute dialihkan..."
                  rows={3}
                  className="text-xs rounded-lg"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 border-t border-border/80">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsReassignDialogOpen(false);
                setReassignTargetTask(null);
                setReassignReason("");
              }}
              disabled={isReassignSubmitting}
              className="h-8 text-xs font-medium"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmReassign}
              disabled={isReassignSubmitting || !selectedReassignMessenger || !reassignReason.trim()}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium gap-1.5 shadow-2xs"
            >
              {isReassignSubmitting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  Mengalihkan...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Konfirmasi Alihkan Tugas
                </>
              )}
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
