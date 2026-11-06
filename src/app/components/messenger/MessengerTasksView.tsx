import { useState, useMemo } from "react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import {
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ClipboardList,
  Check,
  X,
  Inbox,
  PlayCircle,
  History,
  Radio,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import {
  MessengerTaskItem,
  getNewTasksForEmployee,
  getActiveTasksForEmployee,
  getMessengerTaskHistoryForEmployee,
  getAvailableUnassignedTasks,
  acceptMessengerTaskAction,
  declineMessengerTaskAction,
  UserContext,
  startMessengerTask,
} from "../../data/messengerTaskAdapter";
import { useOrderStore } from "../../data/orderStore";
import { MessengerTaskCard } from "./MessengerTaskCard";
import { MessengerMobileTaskDetail } from "./MessengerMobileTaskDetail";
import { toast } from "sonner";
import { cn } from "../ui/utils";

interface MessengerTasksViewProps {
  currentUser: UserContext;
  onNavigateToTab?: (tab: string, orderNo?: string) => void;
}

type MainTaskTab = "NEW" | "ACTIVE" | "AVAILABLE" | "HISTORY";
type FilterChip = "ALL" | "Jemput Dokumen" | "Proses Samsat" | "Pengantaran Dokumen";

export function MessengerTasksView({
  currentUser,
  onNavigateToTab,
}: MessengerTasksViewProps) {
  const { activeOrders, archivedOrders, isLoading, error, refresh } = useOrderStore();
  const [activeTab, setActiveTab] = useState<MainTaskTab>("NEW");
  const [selectedChip, setSelectedChip] = useState<FilterChip>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<MessengerTaskItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Decline Dialog State
  const [declineTargetTask, setDeclineTargetTask] = useState<MessengerTaskItem | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [isDeclineSubmitting, setIsDeclineSubmitting] = useState(false);

  // Authoritative task isolation per tab
  const newTasks = useMemo(() => {
    return getNewTasksForEmployee(activeOrders, currentUser);
  }, [activeOrders, currentUser]);

  const activeTasks = useMemo(() => {
    return getActiveTasksForEmployee(activeOrders, currentUser);
  }, [activeOrders, currentUser]);

  const availableTasks = useMemo(() => {
    return getAvailableUnassignedTasks(activeOrders);
  }, [activeOrders]);

  const historyTasks = useMemo(() => {
    return getMessengerTaskHistoryForEmployee(activeOrders, currentUser, archivedOrders);
  }, [activeOrders, currentUser, archivedOrders]);

  // Default active tab to ACTIVE if there are no new tasks
  // (but keep user's manual selection)

  // Current tab items
  const currentTabTasks = useMemo(() => {
    switch (activeTab) {
      case "NEW":
        return newTasks;
      case "ACTIVE":
        return activeTasks;
      case "AVAILABLE":
        return availableTasks;
      case "HISTORY":
        return historyTasks;
      default:
        return activeTasks;
    }
  }, [activeTab, newTasks, activeTasks, availableTasks, historyTasks]);

  // Counts for each chip within current tab
  const counts = useMemo(() => {
    return {
      all: currentTabTasks.length,
      jemput: currentTabTasks.filter(
        (t) => t.keteranganTugas === "Jemput Dokumen" || t.keteranganTugas === "Jemput Hasil Samsat"
      ).length,
      samsat: currentTabTasks.filter((t) => t.keteranganTugas === "Proses Samsat").length,
      antar: currentTabTasks.filter((t) => t.keteranganTugas === "Pengantaran Dokumen").length,
    };
  }, [currentTabTasks]);

  // Filtered task items by chip and search
  const filteredTasks = useMemo(() => {
    return currentTabTasks.filter((t) => {
      const matchChip =
        selectedChip === "ALL" ||
        (selectedChip === "Jemput Dokumen"
          ? t.keteranganTugas === "Jemput Dokumen" || t.keteranganTugas === "Jemput Hasil Samsat"
          : t.keteranganTugas === selectedChip);

      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        t.orderNo.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.nopol.toLowerCase().includes(q) ||
        t.lokasi.toLowerCase().includes(q);

      return matchChip && matchQuery;
    });
  }, [currentTabTasks, selectedChip, searchQuery]);

  const handleOpenDetail = (task: MessengerTaskItem) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleStartTask = (task: MessengerTaskItem) => {
    const res = startMessengerTask(task.orderNo, currentUser);
    if (res.success) {
      toast.success(`Tugas ${task.orderNo} berhasil dimulai!`);
    } else {
      toast.error(res.error || "Gagal memulai tugas");
    }
  };

  const handleContinueTask = (task: MessengerTaskItem) => {
    if (task.keteranganTugas === "Proses Samsat" && onNavigateToTab) {
      onNavigateToTab("samsat", task.orderNo);
    } else {
      setSelectedTask(task);
      setIsDetailOpen(true);
    }
  };

  const handleAcceptTask = async (task: MessengerTaskItem) => {
    const res = await acceptMessengerTaskAction(task.orderNo, task.keteranganTugas, currentUser);
    if (res.success) {
      toast.success(`Tugas ${task.orderNo} (${task.keteranganTugas}) berhasil diterima dan masuk ke Tugas Aktif!`);
      setIsDetailOpen(false);
      setSelectedTask(null);
    } else {
      const errorMsg = res.error || "Gagal menerima tugas";
      const isConflict =
        errorMsg.toLowerCase().includes("conflict") ||
        errorMsg.toLowerCase().includes("sudah diambil") ||
        errorMsg.toLowerCase().includes("tidak tersedia");
      if (isConflict) {
        toast.error(errorMsg || "Tugas ini sudah diambil kurir lain.");
        setIsDetailOpen(false);
        setSelectedTask(null);
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleOpenDeclineDialog = (task: MessengerTaskItem) => {
    setDeclineTargetTask(task);
    setDeclineReason("");
    setIsDeclineSubmitting(false);
  };

  const handleConfirmDecline = async () => {
    if (!declineTargetTask) return;
    if (!declineReason.trim()) {
      toast.error("Alasan penolakan tugas wajib diisi!");
      return;
    }
    setIsDeclineSubmitting(true);
    try {
      const res = await declineMessengerTaskAction(
        declineTargetTask.orderNo,
        declineTargetTask.keteranganTugas,
        declineReason.trim(),
        currentUser
      );
      if (res.success) {
        toast.success(`Tugas ${declineTargetTask.orderNo} berhasil ditolak.`);
        setDeclineTargetTask(null);
        setDeclineReason("");
      } else {
        toast.error(res.error || "Gagal menolak tugas");
      }
    } finally {
      setIsDeclineSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-4 max-w-xl mx-auto pb-6">
      {/* Top Greeting Section */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 rounded-2xl border border-primary/15 text-left">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Selamat datang, {currentUser.userName}
          </h2>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          {isLoading && currentTabTasks.length === 0 ? (
            <span>Memuat data tugas operasional...</span>
          ) : newTasks.length > 0 ? (
            <span>
              Ada <strong className="text-amber-600 dark:text-amber-400 font-bold">{newTasks.length} tugas baru</strong> menunggu konfirmasi penerimaan Anda.
            </span>
          ) : activeTasks.length > 0 ? (
            <span>
              Anda memiliki <strong className="text-foreground font-semibold">{activeTasks.length} tugas aktif</strong> yang sedang dikerjakan.
            </span>
          ) : error && currentTabTasks.length === 0 ? (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              Gagal memuat tugas. Silakan coba lagi.
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Semua tugas Anda selesai! Luar biasa!
            </span>
          )}
        </p>
      </div>

      {/* Main Task Navigation Sub-Tabs (Tugas Baru, Tugas Aktif, Riwayat, Tersedia) */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-1 bg-muted/60 rounded-2xl border border-border/80">
        <button
          onClick={() => {
            setActiveTab("NEW");
            setSelectedChip("ALL");
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px]",
            activeTab === "NEW"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Inbox className="w-4 h-4 shrink-0 text-amber-500" />
          <span>Tugas Baru</span>
          {newTasks.length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
              {newTasks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("ACTIVE");
            setSelectedChip("ALL");
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px]",
            activeTab === "ACTIVE"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PlayCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>Tugas Aktif</span>
          {activeTasks.length > 0 && (
            <span className="px-1.5 py-0.2 bg-primary text-primary-foreground rounded-full text-[10px] font-bold">
              {activeTasks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("HISTORY");
            setSelectedChip("ALL");
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px]",
            activeTab === "HISTORY"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <History className="w-4 h-4 shrink-0 text-muted-foreground" />
          <span>Riwayat</span>
          {historyTasks.length > 0 && (
            <span className="px-1.5 py-0.2 bg-muted text-muted-foreground rounded-full text-[10px] font-bold">
              {historyTasks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("AVAILABLE");
            setSelectedChip("ALL");
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[44px]",
            activeTab === "AVAILABLE"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Radio className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>Tersedia</span>
          {availableTasks.length > 0 && (
            <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[10px] font-bold">
              {availableTasks.length}
            </span>
          )}
        </button>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedChip("ALL")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedChip === "ALL"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Semua ({counts.all})
        </button>

        <button
          onClick={() => setSelectedChip("Jemput Dokumen")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedChip === "Jemput Dokumen"
              ? "bg-blue-600 text-white shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Jemput ({counts.jemput})
        </button>

        <button
          onClick={() => setSelectedChip("Proses Samsat")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedChip === "Proses Samsat"
              ? "bg-purple-600 text-white shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Samsat ({counts.samsat})
        </button>

        <button
          onClick={() => setSelectedChip("Pengantaran Dokumen")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedChip === "Pengantaran Dokumen"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Antar ({counts.antar})
        </button>
      </div>

      {/* Search Input for Mobile Quick Filter */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari nopol, customer, nomor order..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 text-base bg-card rounded-xl border-border"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>

      {/* Task Cards List */}
      {isLoading && currentTabTasks.length === 0 ? (
        <Card className="p-8 text-center border-dashed bg-card/50 rounded-2xl">
          <Clock className="w-10 h-10 text-primary mx-auto mb-2 animate-spin opacity-70" />
          <h3 className="text-sm font-semibold text-foreground">Memuat Tugas Operasional...</h3>
          <p className="text-xs text-muted-foreground mt-1">Mengambil data tugas operasional dari server backend.</p>
        </Card>
      ) : error && currentTabTasks.length === 0 ? (
        <Card className="p-8 text-center border-rose-300 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/20 rounded-2xl">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-foreground">Gagal Memuat Tugas Operasional</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{error}</p>
          <Button onClick={() => refresh()} variant="outline" size="sm" className="mt-4 gap-2">
            <RotateCw className="w-4 h-4" /> Coba Lagi
          </Button>
        </Card>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <MessengerTaskCard
              key={`${task.orderNo}-${task.keteranganTugas}`}
              task={task}
              isNewTaskMode={activeTab === "NEW"}
              onViewDetail={handleOpenDetail}
              onStartTask={handleStartTask}
              onContinueTask={handleContinueTask}
              onAcceptTask={handleAcceptTask}
              onDeclineTask={handleOpenDeclineDialog}
            />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-dashed bg-card/50 rounded-2xl">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <h3 className="text-sm font-semibold text-foreground">
            {activeTab === "NEW"
              ? "Tidak Ada Tugas Baru"
              : activeTab === "ACTIVE"
              ? "Tidak Ada Tugas Aktif"
              : activeTab === "AVAILABLE"
              ? "Tidak Ada Tugas Tersedia"
              : "Belum Ada Riwayat Tugas"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {searchQuery
              ? `Tidak ditemukan tugas dengan kata kunci "${searchQuery}".`
              : activeTab === "NEW"
              ? "Semua tugas yang dikirim admin telah Anda proses atau belum ada penugasan baru."
              : activeTab === "ACTIVE"
              ? "Tidak ada tugas yang sedang aktif. Silakan periksa tab Tugas Baru atau Tugas Tersedia."
              : activeTab === "AVAILABLE"
              ? "Semua tugas operasional saat ini sudah ditugaskan ke kurir."
              : "Riwayat tugas yang telah selesai akan tercatat di sini."}
          </p>
        </Card>
      )}

      {/* Task Detail Modal */}
      <MessengerMobileTaskDetail
        task={selectedTask}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        currentUser={currentUser}
        onTaskUpdated={() => {
          if (refresh) refresh();
          if (selectedTask) {
            const updated = currentTabTasks.find((t) => t.orderNo === selectedTask.orderNo);
            if (updated) setSelectedTask(updated);
          }
        }}
        onNavigateToSamsat={(orderNo) => {
          if (onNavigateToTab) onNavigateToTab("samsat", orderNo);
        }}
        onAcceptTask={handleAcceptTask}
        onDeclineTask={handleOpenDeclineDialog}
      />

      {/* Decline Task Dialog (Tolak Tugas dengan Alasan) */}
      <Dialog
        open={Boolean(declineTargetTask)}
        onOpenChange={(open) => {
          if (!open) {
            setDeclineTargetTask(null);
            setDeclineReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl p-5 text-left">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <X className="w-5 h-5" />
              Tolak Penugasan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin ingin menolak tugas ini? Tugas akan dikembalikan ke status belum ditugaskan agar dapat dialihkan oleh Admin.
            </DialogDescription>
          </DialogHeader>

          {declineTargetTask && (
            <div className="space-y-3 py-2 text-sm">
              <div className="p-3 rounded-xl bg-muted/60 space-y-1 border border-border">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Nomor Order:</span>
                  <span className="font-bold text-foreground font-mono">{declineTargetTask.orderNo}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium text-foreground">{declineTargetTask.customer}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tugas:</span>
                  <span className="font-semibold text-primary">{declineTargetTask.keteranganTugas}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Alasan Penolakan <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Contoh: Kendaraan sedang servis, kapasitas tugas penuh, jarak di luar rute..."
                  rows={3}
                  className="text-sm rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeclineTargetTask(null);
                setDeclineReason("");
              }}
              disabled={isDeclineSubmitting}
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmDecline}
              disabled={isDeclineSubmitting || !declineReason.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl gap-1.5"
            >
              {isDeclineSubmitting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  Kirim Penolakan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
