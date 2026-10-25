import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { TablePagination } from "./ui/TablePagination";
import { EmptyState } from "./ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import {
  Search,
  Truck,
  CheckCircle2,
  Calendar,
  Eye,
  RotateCcw,
  ArrowLeft,
  DollarSign,
  Receipt,
  Building2,
  PackageOpen,
  Camera,
  FileText,
  Clock,
  User,
  Phone,
  MapPin,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Info,
  ShieldCheck,
  Check,
  XCircle,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { useOrderStore, OperationalOrder } from "../data/orderStore";
import { useFinanceStore } from "../data/financeStore";
import { useKaryawanPengguna } from "../data/karyawanPenggunaAdapter";
import { APP_CONFIG } from "../config/appConfig";
import {
  MessengerHistoryItem,
  MessengerTaskType,
  ReimbursementRequest,
  deriveAllMessengerHistory,
  calculateOrderTagihan,
} from "../data/messengerTaskAdapter";
import { formatRupiah } from "../utils/financeFormatters";
import { apiMessengerProvider } from "../../data/api/apiMessengerProvider";

interface MessengerWithStats {
  employeeId: string;
  name: string;
  phone: string;
  wilayah: string;
  status: string;
  completedTasksCount: number;
  lastCompletedDate?: string;
  totalDiajukan: number;
  totalDisetujui: number;
  totalDibayar: number;
  totalMenunggu: number;
  totalDisetujuiBelumDibayar: number;
  totalDitolak: number;
}

export function MessengerHistory() {
  const { activeOrders, archivedOrders } = useOrderStore();
  const { reimbursements } = useFinanceStore();
  const { karyawan, karyawanList: rawKaryawanList } = useKaryawanPengguna();
  const karyawanList = useMemo(() => {
    if (Array.isArray(rawKaryawanList) && rawKaryawanList.length > 0) return rawKaryawanList;
    if (Array.isArray(karyawan) && karyawan.length > 0) return karyawan;
    return [];
  }, [rawKaryawanList, karyawan]);

  // Navigation View State: "list" (Messenger Directory) | "detail" (Selected Messenger History)
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [selectedMessenger, setSelectedMessenger] = useState<MessengerWithStats | null>(null);

  // Filters for Messenger Directory
  const [messengerSearch, setMessengerSearch] = useState("");
  const [messengerStatusFilter, setMessengerStatusFilter] = useState<"all" | "completed_only" | "active_only">("all");
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");

  // Filters for Task History of Selected Messenger
  const [taskSearch, setTaskSearch] = useState("");
  const [taskTypeFilter, setTaskTypeFilter] = useState<"all" | MessengerTaskType>("all");
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskEndDate, setTaskEndDate] = useState("");

  // Pagination States
  const [messengerPage, setMessengerPage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);
  const itemsPerPage = 8;

  // Modals
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<MessengerHistoryItem | null>(null);
  const [taskDetailTab, setTaskDetailTab] = useState<"info" | "timeline" | "attachments" | "expenses">("info");

  // Single Reimbursement Detail Inspection
  const [selectedReimbursement, setSelectedReimbursement] = useState<ReimbursementRequest | null>(null);
  const [isReimbursementModalOpen, setIsReimbursementModalOpen] = useState(false);

  // Document Preview Modal
  const [previewDoc, setPreviewDoc] = useState<{ isOpen: boolean; url?: string; title?: string }>({ isOpen: false });

  // ----------------------------------------------------
  // 1. Server-Side Messenger History with Local Fallback
  // ----------------------------------------------------
  const [serverTasks, setServerTasks] = useState<MessengerHistoryItem[] | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiMessengerProvider
      .getMessengerHistory()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setServerTasks(data);
        }
      })
      .catch((err) => {
        // Fallback transparently to local state store if server is unreachable
        console.debug("Backend messenger history query fallback to local derivation:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const allCompletedTasks = useMemo(() => {
    if (serverTasks && serverTasks.length > 0) {
      return serverTasks;
    }
    return deriveAllMessengerHistory(activeOrders, archivedOrders);
  }, [serverTasks, activeOrders, archivedOrders]);

  // ----------------------------------------------------
  // 2. Gather All Real Messengers & Aggregate Statistics
  // ----------------------------------------------------
  const messengerStatsList = useMemo(() => {
    // Only real messengers from karyawan list
    const messengerEmployees = (karyawanList || []).filter(
      (k) => (k.jabatan || "").toUpperCase() === "MESSENGER" || (k.id || "").startsWith("EMP-MSG")
    );

    const stats: MessengerWithStats[] = messengerEmployees.map((emp) => {
      const empName = (emp.nama || "").toLowerCase();
      // Find completed tasks for this messenger
      const mTasks = (allCompletedTasks || []).filter(
        (t) =>
          (t.messenger || "").toLowerCase() === empName ||
          t.messengerEmployeeId === emp.id
      );

      // Apply date filter if set
      const dateFilteredTasks = mTasks.filter((t) => {
        if (!t.completedAt) return true;
        const d = t.completedAt.split("T")[0];
        if (dateFilterStart && d < dateFilterStart) return false;
        if (dateFilterEnd && d > dateFilterEnd) return false;
        return true;
      });

      // Latest completed date
      let lastDate: string | undefined = undefined;
      for (const t of mTasks) {
        if (!lastDate || (t.completedAt && t.completedAt > lastDate)) {
          lastDate = t.completedAt;
        }
      }

      // Reimbursement calculations for this messenger
      const mReimbs = (reimbursements || []).filter(
        (r) =>
          r.employeeId === emp.id ||
          (r.messengerName || "").toLowerCase() === empName
      );

      let totalDiajukan = 0;
      let totalDisetujui = 0;
      let totalDibayar = 0;
      let totalMenunggu = 0;
      let totalDisetujuiBelumDibayar = 0;
      let totalDitolak = 0;

      for (const r of mReimbs) {
        if (r.date) {
          if (dateFilterStart && r.date < dateFilterStart) continue;
          if (dateFilterEnd && r.date > dateFilterEnd) continue;
        }

        totalDiajukan += r.amount;
        const approved =
          r.approvedAmount !== undefined
            ? r.approvedAmount
            : r.status === "Disetujui" || r.status === "Dibayar"
            ? r.amount
            : 0;
        const rejected = r.status === "Ditolak" ? r.amount : r.rejectedAmount || 0;

        totalDisetujui += approved;
        totalDitolak += rejected;

        if (r.status === "Dibayar") {
          totalDibayar += approved;
        } else if (r.status === "Disetujui") {
          totalDisetujuiBelumDibayar += approved;
        } else if (r.status === "Diajukan" || r.status === "Sedang Ditinjau") {
          totalMenunggu += r.amount;
        }
      }

      return {
        employeeId: emp.id,
        name: emp.nama || "Kurir",
        phone: emp.noHp || "-",
        wilayah: emp.wilayah || "Jakarta",
        status: emp.status || "Aktif",
        completedTasksCount: dateFilteredTasks.length,
        lastCompletedDate: lastDate,
        totalDiajukan,
        totalDisetujui,
        totalDibayar,
        totalMenunggu,
        totalDisetujuiBelumDibayar,
        totalDitolak,
      };
    });

    return stats;
  }, [karyawanList, allCompletedTasks, reimbursements, dateFilterStart, dateFilterEnd]);

  // Filtered Messenger Directory List
  const filteredMessengers = useMemo(() => {
    return messengerStatsList.filter((m) => {
      const q = messengerSearch.toLowerCase().trim();
      const matchSearch =
        q === "" ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.employeeId || "").toLowerCase().includes(q) ||
        (m.phone || "").toLowerCase().includes(q) ||
        (m.wilayah || "").toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (messengerStatusFilter === "completed_only") {
        return m.completedTasksCount > 0;
      }
      if (messengerStatusFilter === "active_only") {
        return m.status === "Aktif";
      }

      return true;
    });
  }, [messengerStatsList, messengerSearch, messengerStatusFilter]);

  // Paginated Messengers
  const paginatedMessengers = useMemo(() => {
    const start = (messengerPage - 1) * itemsPerPage;
    return filteredMessengers.slice(start, start + itemsPerPage);
  }, [filteredMessengers, messengerPage]);

  // ----------------------------------------------------
  // 3. Tasks for the Selected Messenger
  // ----------------------------------------------------
  const messengerTasks = useMemo(() => {
    if (!selectedMessenger) return [];
    const selName = (selectedMessenger.name || "").toLowerCase();
    return (allCompletedTasks || []).filter(
      (t) =>
        (t.messenger || "").toLowerCase() === selName ||
        t.messengerEmployeeId === selectedMessenger.employeeId
    );
  }, [allCompletedTasks, selectedMessenger]);

  // Filtered tasks of the selected messenger
  const filteredMessengerTasks = useMemo(() => {
    return messengerTasks.filter((task) => {
      // 1. Search filter
      const q = taskSearch.toLowerCase().trim();
      if (q) {
        const match =
          (task.orderNo || "").toLowerCase().includes(q) ||
          (task.customer || "").toLowerCase().includes(q) ||
          (task.nopol || "").toLowerCase().includes(q) ||
          (task.layanan || "").toLowerCase().includes(q) ||
          (task.wilayah || "").toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Task type filter
      if (taskTypeFilter !== "all" && task.taskType !== taskTypeFilter) {
        return false;
      }

      // 3. Date range filter
      if (task.completedAt) {
        const d = task.completedAt.split("T")[0];
        if (taskStartDate && d < taskStartDate) return false;
        if (taskEndDate && d > taskEndDate) return false;
      }

      return true;
    });
  }, [messengerTasks, taskSearch, taskTypeFilter, taskStartDate, taskEndDate]);

  // Paginated tasks of the selected messenger
  const paginatedTasks = useMemo(() => {
    const start = (taskPage - 1) * itemsPerPage;
    return filteredMessengerTasks.slice(start, start + itemsPerPage);
  }, [filteredMessengerTasks, taskPage]);

  // ----------------------------------------------------
  // 4. Reimbursements & KPIs for the Selected Messenger
  // ----------------------------------------------------
  const selectedMessengerReimbursements = useMemo(() => {
    if (!selectedMessenger) return [];
    const selName = (selectedMessenger.name || "").toLowerCase();
    return (reimbursements || []).filter(
      (r) =>
        r.employeeId === selectedMessenger.employeeId ||
        (r.messengerName || "").toLowerCase() === selName
    );
  }, [reimbursements, selectedMessenger]);

  // KPI summary for the selected messenger (filtered by active task date range)
  const selectedMessengerKpis = useMemo(() => {
    if (!selectedMessenger) {
      return {
        totalSelesaiAllTime: 0,
        totalSelesaiPeriod: 0,
        totalDiajukan: 0,
        totalDisetujui: 0,
        totalDibayar: 0,
        totalMenunggu: 0,
        totalDisetujuiBelumDibayar: 0,
      };
    }

    const totalSelesaiAllTime = messengerTasks.length;
    const totalSelesaiPeriod = filteredMessengerTasks.length;

    let totalDiajukan = 0;
    let totalDisetujui = 0;
    let totalDibayar = 0;
    let totalMenunggu = 0;
    let totalDisetujuiBelumDibayar = 0;

    for (const r of selectedMessengerReimbursements) {
      if (r.date) {
        if (taskStartDate && r.date < taskStartDate) continue;
        if (taskEndDate && r.date > taskEndDate) continue;
      }

      totalDiajukan += r.amount;
      const approved =
        r.approvedAmount !== undefined
          ? r.approvedAmount
          : r.status === "Disetujui" || r.status === "Dibayar"
          ? r.amount
          : 0;

      totalDisetujui += approved;

      if (r.status === "Dibayar") {
        totalDibayar += approved;
      } else if (r.status === "Disetujui") {
        totalDisetujuiBelumDibayar += approved;
      } else if (r.status === "Diajukan" || r.status === "Sedang Ditinjau") {
        totalMenunggu += r.amount;
      }
    }

    return {
      totalSelesaiAllTime,
      totalSelesaiPeriod,
      totalDiajukan,
      totalDisetujui,
      totalDibayar,
      totalMenunggu,
      totalDisetujuiBelumDibayar,
    };
  }, [selectedMessenger, messengerTasks, filteredMessengerTasks, selectedMessengerReimbursements, taskStartDate, taskEndDate]);

  // ----------------------------------------------------
  // 5. Task Detail Calculations (Chronology, Attachments, Expenses)
  // ----------------------------------------------------
  const taskDetailExpenses = useMemo(() => {
    if (!selectedTaskHistory) return { items: [], summary: { totalDiajukan: 0, totalDisetujui: 0, totalDitolak: 0, totalDibayar: 0, totalMenunggu: 0, totalDisetujuiBelumDibayar: 0 } };
    const orderNo = selectedTaskHistory.orderNo;
    const items = reimbursements.filter((r) => r.orderNo === orderNo);

    let totalDiajukan = 0;
    let totalDisetujui = 0;
    let totalDitolak = 0;
    let totalDibayar = 0;
    let totalMenunggu = 0;
    let totalDisetujuiBelumDibayar = 0;

    for (const r of items) {
      totalDiajukan += r.amount;
      const approved = r.approvedAmount !== undefined ? r.approvedAmount : (r.status === "Disetujui" || r.status === "Dibayar" ? r.amount : 0);
      const rejected = r.status === "Ditolak" ? r.amount : (r.rejectedAmount || 0);

      totalDisetujui += approved;
      totalDitolak += rejected;

      if (r.status === "Dibayar") {
        totalDibayar += approved;
      } else if (r.status === "Disetujui") {
        totalDisetujuiBelumDibayar += approved;
      } else if (r.status === "Diajukan" || r.status === "Sedang Ditinjau") {
        totalMenunggu += r.amount;
      }
    }

    return {
      items,
      summary: {
        totalDiajukan,
        totalDisetujui,
        totalDitolak,
        totalDibayar,
        totalMenunggu,
        totalDisetujuiBelumDibayar,
      },
    };
  }, [selectedTaskHistory, reimbursements]);

  // Task Timeline Builder based on real recorded events
  const taskTimelineEvents = useMemo(() => {
    if (!selectedTaskHistory) return [];
    const task = selectedTaskHistory;
    const rawOrder = task.rawOrder;
    const events: Array<{
      id: string;
      time: string;
      title: string;
      author: string;
      role: string;
      details: string;
      badge?: string;
    }> = [];

    // 1. Order created
    if (rawOrder.createdAt) {
      events.push({
        id: "ev-1",
        time: rawOrder.createdAt,
        title: "Tugas & Order Dibuat",
        author: "Admin Kantor",
        role: "admin",
        details: `Pendaftaran order ${task.orderNo} (${task.layanan}) selesai diinput ke sistem.`,
      });
    }

    // 2. Assignment
    const assignedDate = (rawOrder as any).tanggalPenjadwalan || (rawOrder as any).scheduledDate || rawOrder.createdAt;
    events.push({
      id: "ev-2",
      time: assignedDate,
      title: "Penugasan ke Messenger",
      author: "Admin Operasional",
      role: "admin",
      details: `Penugasan pekerjaan ${task.taskType} kepada kurir ${task.messenger} (${task.messengerEmployeeId || "Kurir"}).`,
    });

    // 3. Started handling
    if ((rawOrder as any).startedAt || (rawOrder as any).tanggalJemput) {
      events.push({
        id: "ev-3",
        time: (rawOrder as any).startedAt || (rawOrder as any).tanggalJemput || assignedDate,
        title: "Messenger Mulai Menangani Tugas",
        author: task.messenger,
        role: "messenger",
        details: `Kurir memulai mobilitas menuju lokasi (${task.wilayah}).`,
      });
    }

    // 4. Component progress updates
    if ((rawOrder as any).componentProgress && Array.isArray((rawOrder as any).componentProgress)) {
      (rawOrder as any).componentProgress.forEach((cp: any, idx: number) => {
        if (cp.completedAt) {
          events.push({
            id: `ev-comp-${idx}`,
            time: cp.completedAt,
            title: `Tahapan: ${cp.name} Selesai`,
            author: task.messenger,
            role: "messenger",
            details: `Penyelesaian loket Samsat: ${cp.name}${cp.nominal ? ` (Biaya Rp ${cp.nominal.toLocaleString("id-ID")})` : ""}`,
          });
        }
      });
    }

    // 5. Reimbursement submissions
    taskDetailExpenses.items.forEach((r) => {
      events.push({
        id: `ev-reimb-${r.id}-sub`,
        time: r.submittedAt,
        title: `Pengajuan Biaya Operasional: ${r.category}`,
        author: r.messengerName,
        role: "messenger",
        details: `Pengajuan biaya ${r.category} sebesar Rp ${r.amount.toLocaleString("id-ID")}${r.note ? ` - Catatan: ${r.note}` : ""}`,
        badge: r.status,
      });

      if (r.reviewedAt && r.reviewedBy) {
        events.push({
          id: `ev-reimb-${r.id}-rev`,
          time: r.reviewedAt,
          title: `Pengajuan Biaya ${r.id} Ditinjau (${r.status})`,
          author: r.reviewedBy,
          role: "finance",
          details: `Keputusan: ${r.status}. Disetujui Rp ${(r.approvedAmount || 0).toLocaleString("id-ID")}${r.reviewNotes ? ` (${r.reviewNotes})` : ""}`,
          badge: r.status,
        });
      }

      if (r.paidAt && r.paidBy) {
        events.push({
          id: `ev-reimb-${r.id}-paid`,
          time: r.paidAt,
          title: `Pencairan Biaya ${r.id} Direalisasikan`,
          author: r.paidBy,
          role: "finance",
          details: `Realisasi pencairan dana Rp ${(r.approvedAmount || r.amount).toLocaleString("id-ID")} via ${r.paymentMethod || "Kas Kantor"}`,
          badge: "Dibayar",
        });
      }
    });

    // 6. Evidence upload
    if (task.photoProofUrl) {
      events.push({
        id: "ev-proof",
        time: task.completedAt,
        title: "Bukti Hasil Pekerjaan Diunggah",
        author: task.messenger,
        role: "messenger",
        details: `Dokumentasi serah terima / bukti lapangan berhasil diunggah oleh ${task.messenger}.`,
      });
    }

    // 7. Completion
    if (task.completedAt) {
      events.push({
        id: "ev-done",
        time: task.completedAt,
        title: `Tugas ${task.taskType} Berhasil Diselesaikan`,
        author: task.messenger,
        role: "messenger",
        details: task.keterangan || `Pekerjaan ${task.taskType} berhasil dituntaskan dengan status akhir Selesai.`,
        badge: "Selesai",
      });
    }

    return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [selectedTaskHistory, taskDetailExpenses]);

  // Task Attachments
  const taskAttachments = useMemo(() => {
    if (!selectedTaskHistory) return [];
    const task = selectedTaskHistory;
    const rawOrder = task.rawOrder;
    const list: Array<{ id: string; name: string; category: string; url: string; time: string }> = [];

    if (rawOrder.pickupProof?.photoProofUrl) {
      list.push({
        id: "att-pickup",
        name: "Foto Bukti Penjemputan Berkas",
        category: "Jemput Dokumen",
        url: rawOrder.pickupProof.photoProofUrl,
        time: rawOrder.pickupProof.completedAt || rawOrder.createdAt,
      });
    }

    if (rawOrder.deliveryHandover?.photoProofUrl) {
      list.push({
        id: "att-delivery",
        name: `Foto Serah Terima (${rawOrder.deliveryHandover.recipientName || "Klien"})`,
        category: "Pengantaran Dokumen",
        url: rawOrder.deliveryHandover.photoProofUrl,
        time: rawOrder.deliveryHandover.completedAt || task.completedAt,
      });
    }

    if ((rawOrder as any).componentProgress && Array.isArray((rawOrder as any).componentProgress)) {
      (rawOrder as any).componentProgress.forEach((cp: any, idx: number) => {
        if (cp.evidence && Array.isArray(cp.evidence)) {
          cp.evidence.forEach((ev: any, evIdx: number) => {
            list.push({
              id: `att-cp-${idx}-${evIdx}`,
              name: `Bukti Loket: ${cp.name}`,
              category: "Proses Samsat",
              url: ev.fileUrl,
              time: ev.uploadedAt || task.completedAt,
            });
          });
        }
      });
    }

    taskDetailExpenses.items.forEach((r) => {
      if (r.receiptUrl) {
        list.push({
          id: `att-reimb-${r.id}`,
          name: `Struk Pengajuan ${r.id} (${r.category})`,
          category: `Pengajuan Biaya`,
          url: r.receiptUrl,
          time: r.submittedAt,
        });
      }
    });

    return list;
  }, [selectedTaskHistory, taskDetailExpenses]);

  // Handler to open Messenger Detail
  const handleSelectMessenger = (m: MessengerWithStats) => {
    setSelectedMessenger(m);
    setViewMode("detail");
    setTaskPage(1);
    setTaskSearch("");
    setTaskTypeFilter("all");
    setTaskStartDate("");
    setTaskEndDate("");
  };

  // Handler to open Task Detail
  const handleOpenTaskDetail = (task: MessengerHistoryItem) => {
    setSelectedTaskHistory(task);
    setTaskDetailTab("info");
    setIsTaskDetailOpen(true);
  };

  // Handler to open single reimbursement inspection
  const handleOpenReimbursement = (r: ReimbursementRequest) => {
    setSelectedReimbursement(r);
    setIsReimbursementModalOpen(true);
  };

  const formatIsoDate = (isoStr?: string) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoStr;
    }
  };

  const formatIsoDateTime = (isoStr?: string) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* ======================================================== */}
      {/* VIEW MODE 1: MESSENGER DIRECTORY (DAFTAR MESSENGER)      */}
      {/* ======================================================== */}
      {viewMode === "list" && (
        <motion.div
          key="view-list"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <Truck className="w-6 h-6 text-primary" />
                Messenger History
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Arsip riwayat pekerjaan Messenger yang telah berhasil diselesaikan, penelusuran proses, dan audit pengajuan biaya operasional.
              </p>
            </div>
          </div>

          {/* Directory Filter Bar */}
          <Card className="p-4 border border-border/80 bg-card shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, ID, nomor HP..."
                  value={messengerSearch}
                  onChange={(e) => {
                    setMessengerSearch(e.target.value);
                    setMessengerPage(1);
                  }}
                  className="pl-9 h-9 text-xs bg-input-background border-border"
                />
              </div>

              {/* Status Filter */}
              <Select
                value={messengerStatusFilter}
                onValueChange={(val: any) => {
                  setMessengerStatusFilter(val);
                  setMessengerPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-input-background border-border">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Semua Messenger</SelectItem>
                  <SelectItem value="completed_only" className="text-xs">Hanya yang Memiliki Tugas Selesai</SelectItem>
                  <SelectItem value="active_only" className="text-xs">Status Karyawan Aktif</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Start */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">Dari:</span>
                <Input
                  type="date"
                  value={dateFilterStart}
                  onChange={(e) => {
                    setDateFilterStart(e.target.value);
                    setMessengerPage(1);
                  }}
                  className="h-9 text-xs bg-input-background border-border"
                />
              </div>

              {/* Date End */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">Sampai:</span>
                <Input
                  type="date"
                  value={dateFilterEnd}
                  onChange={(e) => {
                    setDateFilterEnd(e.target.value);
                    setMessengerPage(1);
                  }}
                  className="h-9 text-xs bg-input-background border-border"
                />
              </div>
            </div>

            {(messengerSearch || messengerStatusFilter !== "all" || dateFilterStart || dateFilterEnd) && (
              <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Menampilkan {filteredMessengers.length} dari {messengerStatsList.length} Messenger
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMessengerSearch("");
                    setMessengerStatusFilter("all");
                    setDateFilterStart("");
                    setDateFilterEnd("");
                    setMessengerPage(1);
                  }}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filter
                </Button>
              </div>
            )}
          </Card>

          {/* Messenger Directory Grid / Cards */}
          {paginatedMessengers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedMessengers.map((m) => (
                <Card
                  key={m.employeeId}
                  className="p-5 border border-border/80 bg-card hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between group"
                >
                  <div>
                    {/* Top Row: Avatar & Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
                          {(m.name || "M").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                            {m.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground font-medium">
                              {m.employeeId}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {m.wilayah}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-1.5 ${
                          m.status === "Aktif"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-muted text-muted-foreground"
                        }`}
                      >
                        {m.status}
                      </Badge>
                    </div>

                    {/* Contact & Last Active */}
                    <div className="space-y-1.5 text-xs text-muted-foreground mb-4 bg-muted/20 p-2.5 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> No. HP
                        </span>
                        <span className="font-mono text-foreground font-medium">{m.phone}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> Terakhir Selesai
                        </span>
                        <span className="text-foreground">{formatIsoDate(m.lastCompletedDate)}</span>
                      </div>
                    </div>

                    {/* Performance & Expense Snapshot */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="p-2.5 rounded-lg border border-border/70 bg-card/60">
                        <span className="text-[10px] text-muted-foreground block">Tugas Selesai</span>
                        <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {m.completedTasksCount}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">Pekerjaan berhasil</span>
                      </div>
                      <div className="p-2.5 rounded-lg border border-border/70 bg-card/60">
                        <span className="text-[10px] text-muted-foreground block">Biaya Disetujui/Dibayar</span>
                        <span className="text-xs sm:text-sm font-bold font-mono text-foreground tabular-nums truncate block mt-1" title={formatRupiah(m.totalDisetujui)}>
                          {formatRupiah(m.totalDisetujui)}
                        </span>
                        <span className="text-[9px] text-muted-foreground block truncate">
                          {m.totalDibayar > 0 ? `Rp ${m.totalDibayar.toLocaleString("id-ID")} cair` : "Belum dicairkan"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Action */}
                  <Button
                    onClick={() => handleSelectMessenger(m)}
                    className="w-full h-9 text-xs gap-1.5 mt-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                  >
                    Buka Riwayat Tugas
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 border border-border/80 bg-card text-center">
              <EmptyState
                icon={Truck}
                title="Tidak Ada Messenger Ditemukan"
                description="Tidak ada data Messenger yang cocok dengan kata kunci atau filter yang Anda terapkan."
              />
            </Card>
          )}

          {/* Directory Pagination */}
          {filteredMessengers.length > itemsPerPage && (
            <TablePagination
              currentPage={messengerPage}
              totalItems={filteredMessengers.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setMessengerPage}
            />
          )}
        </motion.div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 2: SELECTED MESSENGER TASK HISTORY             */}
      {/* ======================================================== */}
      {viewMode === "detail" && selectedMessenger && (
        <motion.div
          key="view-detail"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Back & Profile Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("list")}
                className="h-9 px-3 text-xs gap-1.5 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Daftar
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">
                    Riwayat Tugas: {selectedMessenger.name}
                  </h1>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    {selectedMessenger.employeeId}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Wilayah Operasional: {selectedMessenger.wilayah} • No. HP: {selectedMessenger.phone}
                </p>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Selesai All Time */}
            <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground block">Tugas Selesai (All-Time)</span>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {selectedMessengerKpis.totalSelesaiAllTime}
              </h3>
              <span className="text-[10px] text-muted-foreground block">Sepanjang waktu</span>
            </Card>

            {/* Total Selesai Terfilter */}
            <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground block">Tugas Terfilter</span>
              <h3 className="text-xl font-bold font-mono text-primary mt-1 tabular-nums">
                {selectedMessengerKpis.totalSelesaiPeriod}
              </h3>
              <span className="text-[10px] text-muted-foreground block">Periode aktif</span>
            </Card>

            {/* Total Pengajuan Biaya */}
            <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground block">Total Diajukan</span>
              <h3 className="text-sm sm:text-base font-bold font-mono text-foreground mt-1 tabular-nums truncate" title={formatRupiah(selectedMessengerKpis.totalDiajukan)}>
                {formatRupiah(selectedMessengerKpis.totalDiajukan)}
              </h3>
              <span className="text-[10px] text-muted-foreground block">Seluruh usulan</span>
            </Card>

            {/* Total Disetujui */}
            <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground block">Total Disetujui</span>
              <h3 className="text-sm sm:text-base font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 tabular-nums truncate" title={formatRupiah(selectedMessengerKpis.totalDisetujui)}>
                {formatRupiah(selectedMessengerKpis.totalDisetujui)}
              </h3>
              <span className="text-[10px] text-muted-foreground block">Disetujui manajemen</span>
            </Card>

            {/* Total Sudah Dibayar */}
            <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground block">Total Direalisasikan</span>
              <h3 className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums truncate" title={formatRupiah(selectedMessengerKpis.totalDibayar)}>
                {formatRupiah(selectedMessengerKpis.totalDibayar)}
              </h3>
              <span className="text-[10px] text-muted-foreground block">Telah cair via kas</span>
            </Card>

            {/* Menunggu Persetujuan */}
            <Card className="p-3.5 border border-border/80 bg-card shadow-2xs">
              <span className="text-[11px] font-medium text-muted-foreground block">Menunggu Approval</span>
              <h3 className="text-sm sm:text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 tabular-nums truncate" title={formatRupiah(selectedMessengerKpis.totalMenunggu)}>
                {formatRupiah(selectedMessengerKpis.totalMenunggu)}
              </h3>
              <span className="text-[10px] text-muted-foreground block">Belum diputuskan</span>
            </Card>
          </div>

          {/* Operational Cost Disclaimer */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p>
              <strong>Catatan Akuntansi:</strong> Angka total biaya di atas mencerminkan akumulasi pengajuan pengeluaran operasional lapangan (bensin, tol, parkir, dan retribusi loket) yang diajukan kurir. Angka ini murni biaya operasional dan tidak merepresentasikan keuntungan bersih (profit) kurir maupun laba biro jasa.
            </p>
          </div>

          {/* Task Filters */}
          <Card className="p-4 border border-border/80 bg-card shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nomor order, klien, nopol..."
                  value={taskSearch}
                  onChange={(e) => {
                    setTaskSearch(e.target.value);
                    setTaskPage(1);
                  }}
                  className="pl-9 h-9 text-xs bg-input-background border-border"
                />
              </div>

              {/* Task Type Filter */}
              <Select
                value={taskTypeFilter}
                onValueChange={(val: any) => {
                  setTaskTypeFilter(val);
                  setTaskPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-input-background border-border">
                  <SelectValue placeholder="Jenis Tugas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Semua Jenis Pekerjaan</SelectItem>
                  <SelectItem value="Jemput Dokumen" className="text-xs">Jemput Dokumen</SelectItem>
                  <SelectItem value="Proses Samsat" className="text-xs">Proses Samsat</SelectItem>
                  <SelectItem value="Pengantaran Dokumen" className="text-xs">Pengantaran Dokumen</SelectItem>
                </SelectContent>
              </Select>

              {/* Start Date */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">Dari:</span>
                <Input
                  type="date"
                  value={taskStartDate}
                  onChange={(e) => {
                    setTaskStartDate(e.target.value);
                    setTaskPage(1);
                  }}
                  className="h-9 text-xs bg-input-background border-border"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">Sampai:</span>
                <Input
                  type="date"
                  value={taskEndDate}
                  onChange={(e) => {
                    setTaskEndDate(e.target.value);
                    setTaskPage(1);
                  }}
                  className="h-9 text-xs bg-input-background border-border"
                />
              </div>
            </div>

            {(taskSearch || taskTypeFilter !== "all" || taskStartDate || taskEndDate) && (
              <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Menampilkan {filteredMessengerTasks.length} dari {messengerTasks.length} riwayat pekerjaan
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTaskSearch("");
                    setTaskTypeFilter("all");
                    setTaskStartDate("");
                    setTaskEndDate("");
                    setTaskPage(1);
                  }}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filter
                </Button>
              </div>
            )}
          </Card>

          {/* Completed Tasks Table */}
          <div className="rounded-xl border border-border/80 bg-card overflow-x-auto shadow-xs">
            <Table className="w-full min-w-[950px]">
              <TableHeader className="bg-muted/40 border-b border-border/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 h-9 px-3 text-xs font-semibold text-muted-foreground text-center">No</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground">Nomor Order</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground">Customer & Kendaraan</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground">Jenis Pekerjaan</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground">Lokasi / Samsat</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground">Waktu Selesai</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground text-right">Tagihan Order</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground text-center">Biaya Operasional</TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground text-center w-[90px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTasks.length > 0 ? (
                  paginatedTasks.map((task, idx) => {
                    const taskReimbs = reimbursements.filter((r) => r.orderNo === task.orderNo);
                    const totalDiajukan = taskReimbs.reduce((acc, r) => acc + r.amount, 0);
                    const totalPaid = taskReimbs
                      .filter((r) => r.status === "Dibayar")
                      .reduce((acc, r) => acc + (r.approvedAmount || r.amount), 0);

                    return (
                      <TableRow key={task.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-12">
                        <TableCell className="w-12 text-muted-foreground text-center font-mono text-xs">
                          {(taskPage - 1) * itemsPerPage + idx + 1}
                        </TableCell>
                        <TableCell className="font-mono text-primary font-semibold text-xs">
                          {task.orderNo}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-semibold text-foreground block">{task.customer}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] font-bold bg-muted px-1.5 py-0.2 rounded text-foreground">
                              {task.nopol}
                            </span>
                            <span className="text-[10px] text-muted-foreground">• {task.jenisKendaraan}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 px-2 font-medium gap-1 ${
                              task.taskType === "Jemput Dokumen"
                                ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : task.taskType === "Proses Samsat"
                                ? "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {task.taskType === "Jemput Dokumen" && <PackageOpen className="w-3 h-3" />}
                            {task.taskType === "Proses Samsat" && <Building2 className="w-3 h-3" />}
                            {task.taskType === "Pengantaran Dokumen" && <Truck className="w-3 h-3" />}
                            {task.taskType}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground block mt-0.5 truncate max-w-[140px]" title={task.layanan}>
                            {task.layanan}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 text-foreground">
                            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                            {task.wilayah}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-foreground">
                          {formatIsoDateTime(task.completedAt)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          <span className="font-mono font-bold text-foreground block">
                            {formatRupiah(task.totalTagihan)}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            {task.statusBayar || "Lunas"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {taskReimbs.length > 0 ? (
                            <div>
                              <span className="font-mono font-semibold text-foreground block">
                                {formatRupiah(totalDiajukan)}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {taskReimbs.length} pengajuan ({formatRupiah(totalPaid)} cair)
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              Tidak ada pengajuan
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenTaskDetail(task)}
                            className="h-8 px-2.5 text-xs gap-1 hover:border-primary hover:text-primary transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-44 text-center">
                      <EmptyState
                        icon={CheckCircle2}
                        title="Belum Ada Tugas Selesai"
                        description="Belum ada riwayat tugas selesai yang sesuai dengan kriteria filter yang Anda pilih."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Task Pagination */}
          {filteredMessengerTasks.length > itemsPerPage && (
            <TablePagination
              currentPage={taskPage}
              totalItems={filteredMessengerTasks.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setTaskPage}
            />
          )}
        </motion.div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DETAIL TUGAS & KRONOLOGI LENGKAP                   */}
      {/* ======================================================== */}
      <Dialog open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border">
          <DialogHeader className="p-5 pb-3 border-b border-border/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>Detail Tugas: {selectedTaskHistory?.orderNo}</span>
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-300">
                    Selesai
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Pekerjaan: {selectedTaskHistory?.taskType} • Ditangani oleh {selectedTaskHistory?.messenger} ({selectedTaskHistory?.messengerEmployeeId})
                </DialogDescription>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-2 mt-4 border-b border-border/60 -mb-3 pb-2 overflow-x-auto">
              <Button
                variant={taskDetailTab === "info" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTaskDetailTab("info")}
                className="h-8 text-xs gap-1.5 shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                Informasi Pekerjaan
              </Button>
              <Button
                variant={taskDetailTab === "timeline" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTaskDetailTab("timeline")}
                className="h-8 text-xs gap-1.5 shrink-0"
              >
                <Clock className="w-3.5 h-3.5" />
                Timeline Proses ({taskTimelineEvents.length})
              </Button>
              <Button
                variant={taskDetailTab === "attachments" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTaskDetailTab("attachments")}
                className="h-8 text-xs gap-1.5 shrink-0"
              >
                <Camera className="w-3.5 h-3.5" />
                Bukti & Lampiran ({taskAttachments.length})
              </Button>
              <Button
                variant={taskDetailTab === "expenses" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTaskDetailTab("expenses")}
                className="h-8 text-xs gap-1.5 shrink-0"
              >
                <Receipt className="w-3.5 h-3.5" />
                Pengajuan Biaya ({taskDetailExpenses.items.length})
              </Button>
            </div>
          </DialogHeader>

          {/* Modal Body Container */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* TAB 1: INFORMASI PEKERJAAN */}
            {taskDetailTab === "info" && selectedTaskHistory && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Identitas Order & Klien */}
                  <Card className="p-4 border border-border/70 bg-muted/20 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" /> Identitas Order & Customer
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nomor Order:</span>
                        <span className="font-mono font-bold text-foreground">{selectedTaskHistory.orderNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nama Pelanggan:</span>
                        <span className="font-semibold text-foreground">{selectedTaskHistory.customer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nomor HP:</span>
                        <span className="font-mono text-foreground">{selectedTaskHistory.phone || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Layanan:</span>
                        <span className="text-foreground">{selectedTaskHistory.layanan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Tagihan Order:</span>
                        <span className="font-mono font-bold text-foreground">{formatRupiah(selectedTaskHistory.totalTagihan)}</span>
                      </div>
                    </div>
                  </Card>

                  {/* Kendaraan & Penugasan */}
                  <Card className="p-4 border border-border/70 bg-muted/20 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-primary" /> Objek & Pelaksana
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nomor Polisi:</span>
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">
                          {selectedTaskHistory.nopol}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Jenis Kendaraan:</span>
                        <span className="text-foreground">{selectedTaskHistory.jenisKendaraan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Messenger:</span>
                        <span className="font-semibold text-foreground">{selectedTaskHistory.messenger}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ID Messenger:</span>
                        <span className="font-mono text-foreground">{selectedTaskHistory.messengerEmployeeId || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lokasi / Wilayah:</span>
                        <span className="text-foreground">{selectedTaskHistory.wilayah}</span>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Tanggal & Status Hasil */}
                <Card className="p-4 border border-border/70 bg-muted/20 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Waktu Penyelesaian & Hasil
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Tanggal Masuk</span>
                      <span className="font-mono font-medium text-foreground">
                        {formatIsoDateTime(selectedTaskHistory.rawOrder.createdAt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Tanggal Selesai</span>
                      <span className="font-mono font-medium text-foreground">
                        {formatIsoDateTime(selectedTaskHistory.completedAt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Status Akhir</span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-300">
                        {selectedTaskHistory.status}
                      </Badge>
                    </div>
                  </div>

                  {selectedTaskHistory.receiverName && (
                    <div className="pt-2 border-t border-border/50 text-xs flex justify-between">
                      <span className="text-muted-foreground">Pihak Penerima Dokumen:</span>
                      <span className="font-semibold text-foreground">
                        {selectedTaskHistory.receiverName} ({selectedTaskHistory.relationship || "Klien"})
                      </span>
                    </div>
                  )}

                  {selectedTaskHistory.keterangan && (
                    <div className="pt-2 border-t border-border/50 text-xs">
                      <span className="text-muted-foreground block text-[11px] mb-1">Catatan Pekerjaan:</span>
                      <p className="bg-background p-2.5 rounded border border-border/60 text-foreground">
                        {selectedTaskHistory.keterangan}
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* TAB 2: TIMELINE PROSES (KRONOLOGIS AKTUAL) */}
            {taskDetailTab === "timeline" && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 border border-border/60 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    Kronologi di bawah disusun berdasarkan jejak audit dan status aktual yang tercatat secara nyata di sistem.
                  </span>
                </div>

                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  {taskTimelineEvents.map((ev) => (
                    <div key={ev.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background" />

                      <div className="bg-muted/20 border border-border/70 p-3.5 rounded-lg space-y-1.5 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="font-bold text-xs text-foreground">{ev.title}</h5>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {formatIsoDateTime(ev.time)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{ev.details}</p>
                        <div className="flex items-center gap-2 pt-1 text-[11px]">
                          <span className="text-muted-foreground">Pelaku:</span>
                          <span className="font-medium text-foreground">{ev.author}</span>
                          <Badge variant="outline" className="text-[9px] py-0 px-1 bg-muted">
                            {ev.role}
                          </Badge>
                          {ev.badge && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/30 text-primary">
                              {ev.badge}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: BUKTI & LAMPIRAN */}
            {taskDetailTab === "attachments" && (
              <div className="space-y-4">
                {taskAttachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {taskAttachments.map((att) => (
                      <Card key={att.id} className="p-3 border border-border/70 bg-muted/20 space-y-2">
                        <div className="h-32 rounded-lg bg-background border border-border overflow-hidden flex items-center justify-center relative group">
                          <img
                            src={att.url}
                            alt={att.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPreviewDoc({ isOpen: true, url: att.url, title: att.name })}
                              className="h-8 px-2.5 text-xs gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Lihat
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 mb-1 bg-muted">
                            {att.category}
                          </Badge>
                          <h5 className="font-medium text-xs text-foreground truncate" title={att.name}>
                            {att.name}
                          </h5>
                          <span className="text-[10px] text-muted-foreground block font-mono mt-0.5">
                            {formatIsoDateTime(att.time)}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-8 border border-border/70 bg-card text-center">
                    <EmptyState
                      icon={Camera}
                      title="Belum Ada Berkas Lampiran"
                      description="Tidak ada dokumen atau foto bukti yang diunggah untuk pekerjaan ini."
                    />
                  </Card>
                )}
              </div>
            )}

            {/* TAB 4: PENGAJUAN BIAYA (RINCIAN LENGKAP & NON-OVERLAPPING SUMMARIES) */}
            {taskDetailTab === "expenses" && (
              <div className="space-y-4">
                {/* Cost Summary Box (Section 5 Spec) */}
                <Card className="p-4 border border-border/80 bg-muted/20 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-primary" />
                    Ringkasan Biaya Tugas (Tanpa Penghitungan Ganda)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div className="p-2.5 rounded bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Total Diajukan</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-foreground tabular-nums block mt-0.5">
                        {formatRupiah(taskDetailExpenses.summary.totalDiajukan)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Total Disetujui</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums block mt-0.5">
                        {formatRupiah(taskDetailExpenses.summary.totalDisetujui)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Total Ditolak/Potong</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums block mt-0.5">
                        {formatRupiah(taskDetailExpenses.summary.totalDitolak)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Telah Dibayar (Cair)</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums block mt-0.5">
                        {formatRupiah(taskDetailExpenses.summary.totalDibayar)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Menunggu Approval</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums block mt-0.5">
                        {formatRupiah(taskDetailExpenses.summary.totalMenunggu)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded bg-card border border-border/60">
                      <span className="text-[10px] text-muted-foreground block">Disetujui Belum Cair</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-purple-600 dark:text-purple-400 tabular-nums block mt-0.5">
                        {formatRupiah(taskDetailExpenses.summary.totalDisetujuiBelumDibayar)}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Submissions Table */}
                <div className="rounded-xl border border-border/80 bg-card overflow-x-auto shadow-xs">
                  <Table className="w-full min-w-[800px]">
                    <TableHeader className="bg-muted/40 border-b border-border/80">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground">ID & Waktu</TableHead>
                        <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground">Kategori & Keterangan</TableHead>
                        <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground text-right">Diajukan</TableHead>
                        <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground text-right">Disetujui</TableHead>
                        <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground text-center">Status</TableHead>
                        <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground">Persetujuan & Pembayaran</TableHead>
                        <TableHead className="h-9 px-3 text-xs font-semibold text-muted-foreground text-center w-[80px]">Bukti</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taskDetailExpenses.items.length > 0 ? (
                        taskDetailExpenses.items.map((r) => (
                          <TableRow key={r.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0 h-12">
                            <TableCell className="text-xs">
                              <span className="font-mono font-bold text-primary block">{r.id}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {formatIsoDate(r.date)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px]">
                              <span className="font-semibold text-foreground block">{r.category}</span>
                              <span className="text-[11px] text-muted-foreground block truncate" title={r.note || "-"}>
                                {r.note || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-medium text-foreground">
                              {formatRupiah(r.amount)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                              {r.status === "Ditolak" ? (
                                <span className="text-rose-600 dark:text-rose-400">Rp 0</span>
                              ) : r.approvedAmount !== undefined ? (
                                formatRupiah(r.approvedAmount)
                              ) : r.status === "Disetujui" || r.status === "Dibayar" ? (
                                formatRupiah(r.amount)
                              ) : (
                                <span className="text-muted-foreground italic">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 px-2 font-medium ${
                                  r.status === "Dibayar"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : r.status === "Disetujui"
                                    ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                    : r.status === "Ditolak"
                                    ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.reviewedBy ? (
                                <div>
                                  <span className="text-foreground font-medium block">
                                    Oleh: {r.reviewedBy}
                                  </span>
                                  {r.paidBy && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
                                      Cair via {r.paymentMethod || "Kas Kantor"}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">
                                  Menunggu verifikasi finance
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {r.receiptUrl ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenReimbursement(r)}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  title="Lihat Struk & Rincian Lengkap"
                                >
                                  <Receipt className="w-4 h-4" />
                                </Button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center">
                            <span className="text-xs text-muted-foreground italic">
                              Tidak ada data pengajuan biaya yang terkait dengan tugas ini.
                            </span>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border/80 bg-muted/10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTaskDetailOpen(false)}
              className="h-8 text-xs px-4"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL: DETAIL SATU PENGAJUAN BIAYA                       */}
      {/* ======================================================== */}
      <Dialog open={isReimbursementModalOpen} onOpenChange={setIsReimbursementModalOpen}>
        <DialogContent className="max-w-md bg-card border-border p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center justify-between">
              <span>Pengajuan: {selectedReimbursement?.id}</span>
              <Badge
                variant="outline"
                className={`text-xs py-0.5 px-2 font-medium ${
                  selectedReimbursement?.status === "Dibayar"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : selectedReimbursement?.status === "Disetujui"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : selectedReimbursement?.status === "Ditolak"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {selectedReimbursement?.status}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Kategori: {selectedReimbursement?.category} • Tanggal: {formatIsoDate(selectedReimbursement?.date)}
            </DialogDescription>
          </DialogHeader>

          {selectedReimbursement && (
            <div className="space-y-3.5 my-2 text-xs">
              {/* Receipt Preview */}
              {selectedReimbursement.receiptUrl && (
                <div className="h-44 rounded-lg border border-border overflow-hidden bg-background flex items-center justify-center relative group">
                  <img
                    src={selectedReimbursement.receiptUrl}
                    alt="Struk Kuitansi"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setPreviewDoc({
                          isOpen: true,
                          url: selectedReimbursement.receiptUrl,
                          title: `Struk Pengajuan ${selectedReimbursement.id}`,
                        })
                      }
                      className="h-8 px-3 text-xs gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Perbesar Struk
                    </Button>
                  </div>
                </div>
              )}

              {/* Financial Snapshot */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/20 border border-border/60">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Nominal Diajukan:</span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {formatRupiah(selectedReimbursement.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Nominal Disetujui:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                    {selectedReimbursement.status === "Ditolak"
                      ? "Rp 0"
                      : selectedReimbursement.approvedAmount !== undefined
                      ? formatRupiah(selectedReimbursement.approvedAmount)
                      : selectedReimbursement.status === "Disetujui" || selectedReimbursement.status === "Dibayar"
                      ? formatRupiah(selectedReimbursement.amount)
                      : "-"}
                  </span>
                </div>
              </div>

              {/* Note */}
              {selectedReimbursement.note && (
                <div className="p-2.5 rounded bg-muted/10 border border-border/50">
                  <span className="text-[11px] text-muted-foreground block mb-0.5">Catatan / Alasan:</span>
                  <p className="text-foreground">{selectedReimbursement.note}</p>
                </div>
              )}

              {/* Audit Persetujuan & Pembayaran */}
              <div className="space-y-1.5 p-2.5 rounded bg-muted/10 border border-border/50 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diajukan Oleh:</span>
                  <span className="font-semibold text-foreground">{selectedReimbursement.messengerName}</span>
                </div>
                {selectedReimbursement.reviewedBy && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Peninjau:</span>
                    <span className="text-foreground">
                      {selectedReimbursement.reviewedBy} ({formatIsoDate(selectedReimbursement.reviewedAt)})
                    </span>
                  </div>
                )}
                {selectedReimbursement.reviewNotes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Catatan Peninjau:</span>
                    <span className="text-foreground italic">{selectedReimbursement.reviewNotes}</span>
                  </div>
                )}
                {selectedReimbursement.paidBy && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Realisasi Kas:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Oleh {selectedReimbursement.paidBy} ({formatIsoDate(selectedReimbursement.paidAt)})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReimbursementModalOpen(false)}
              className="w-full h-8 text-xs"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DOCUMENT PREVIEW MODAL INTEGRATION                       */}
      {/* ======================================================== */}
      <DocumentPreviewModal
        isOpen={previewDoc.isOpen}
        onClose={() => setPreviewDoc({ isOpen: false })}
        title={previewDoc.title || "Preview Dokumen"}
        documentName={previewDoc.title || "Dokumen"}
        rawUrl={previewDoc.url}
      />
    </div>
  );
}
