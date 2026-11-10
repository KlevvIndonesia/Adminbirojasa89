import { useState, useMemo } from "react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import {
  Sparkles,
  ClipboardList,
  Check,
  X,
  Inbox,
  Eye,
  MapPin,
  Phone,
  ExternalLink,
  Clock,
  Car,
  FileText,
  AlertCircle,
  Building2,
  Truck,
  PackageCheck,
  Layers,
} from "lucide-react";
import {
  MessengerTaskItem,
  getAvailableUnassignedTasks,
  getNewTasksForEmployee,
  acceptMessengerTaskAction,
  declineMessengerTaskAction,
  UserContext,
} from "../../data/messengerTaskAdapter";
import { useOrderStore } from "../../data/orderStore";
import { serviceStore } from "../../data/serviceStore";
import { toast } from "sonner";
import { cn } from "../ui/utils";

interface MessengerPoolTasksViewProps {
  currentUser: UserContext;
  onNavigateToTab?: (tab: string, orderNo?: string) => void;
}

type FilterChip = "ALL" | "Jemput Dokumen" | "Proses Samsat" | "Pengantaran Dokumen";

export function MessengerPoolTasksView({
  currentUser,
  onNavigateToTab,
}: MessengerPoolTasksViewProps) {
  const { activeOrders, isLoading, refresh } = useOrderStore();
  const [selectedChip, setSelectedChip] = useState<FilterChip>("ALL");
  const [selectedTask, setSelectedTask] = useState<MessengerTaskItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Decline Dialog State (for tasks assigned specifically to this messenger)
  const [declineTargetTask, setDeclineTargetTask] = useState<MessengerTaskItem | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [isDeclineSubmitting, setIsDeclineSubmitting] = useState(false);

  // 1. Direct assignments specifically to this courier waiting for confirmation
  const directPendingTasks = useMemo(() => {
    return getNewTasksForEmployee(activeOrders, currentUser);
  }, [activeOrders, currentUser]);

  // 2. Open broadcast / unassigned tasks ready to be claimed by any courier
  const openAvailableTasks = useMemo(() => {
    const raw = getAvailableUnassignedTasks(activeOrders);
    // Exclude tasks already in directPendingTasks
    const pendingOrderNos = new Set(directPendingTasks.map((t) => `${t.orderNo}-${t.keteranganTugas}`));
    return raw.filter((t) => !pendingOrderNos.has(`${t.orderNo}-${t.keteranganTugas}`));
  }, [activeOrders, directPendingTasks]);

  // Combined pool
  const allPoolTasks = useMemo(() => {
    return [...directPendingTasks, ...openAvailableTasks];
  }, [directPendingTasks, openAvailableTasks]);

  // Counts for filter chips
  const counts = useMemo(() => {
    return {
      all: allPoolTasks.length,
      jemput: allPoolTasks.filter(
        (t) => t.keteranganTugas === "Jemput Dokumen" || t.keteranganTugas === "Jemput Hasil Samsat"
      ).length,
      samsat: allPoolTasks.filter((t) => t.keteranganTugas === "Proses Samsat").length,
      antar: allPoolTasks.filter((t) => t.keteranganTugas === "Pengantaran Dokumen").length,
    };
  }, [allPoolTasks]);

  // Filtered pool tasks
  const filteredTasks = useMemo(() => {
    return allPoolTasks.filter((t) => {
      if (selectedChip === "ALL") return true;
      if (selectedChip === "Jemput Dokumen") {
        return t.keteranganTugas === "Jemput Dokumen" || t.keteranganTugas === "Jemput Hasil Samsat";
      }
      return t.keteranganTugas === selectedChip;
    });
  }, [allPoolTasks, selectedChip]);

  const handleOpenDetail = (task: MessengerTaskItem) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleClaimTask = async (task: MessengerTaskItem) => {
    setIsClaiming(true);
    try {
      const res = await acceptMessengerTaskAction(task.orderNo, task.keteranganTugas, currentUser);
      if (res.success) {
        toast.success(`Tugas ${task.orderNo} (${task.keteranganTugas}) berhasil diambil!`);
        setIsDetailOpen(false);
        setSelectedTask(null);

        // Auto-navigate to appropriate menu per requirement
        if (onNavigateToTab) {
          if (task.keteranganTugas === "Proses Samsat") {
            onNavigateToTab("samsat", task.orderNo);
          } else {
            onNavigateToTab("antar-jemput", task.orderNo);
          }
        }
      } else {
        const errorMsg = res.error || "Gagal mengambil tugas";
        const isConflict =
          errorMsg.toLowerCase().includes("conflict") ||
          errorMsg.toLowerCase().includes("sudah diambil") ||
          errorMsg.toLowerCase().includes("tidak tersedia");
        if (isConflict) {
          toast.error(errorMsg || "Tugas ini sudah diambil kurir lain atau tidak lagi tersedia.");
          setIsDetailOpen(false);
          setSelectedTask(null);
        } else {
          toast.error(errorMsg);
        }
        if (refresh) refresh();
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const handleOpenDeclineDialog = (task: MessengerTaskItem) => {
    setDeclineTargetTask(task);
    setDeclineReason("");
    setIsDeclineSubmitting(false);
  };

  const handleConfirmDecline = async () => {
    if (!declineTargetTask) return;
    setIsDeclineSubmitting(true);
    try {
      const res = await declineMessengerTaskAction(
        declineTargetTask.orderNo,
        declineTargetTask.keteranganTugas,
        declineReason.trim() || undefined,
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

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "Jemput Dokumen":
      case "Jemput Hasil Samsat":
        return <Truck className="w-4 h-4 text-blue-500" />;
      case "Proses Samsat":
        return <Building2 className="w-4 h-4 text-purple-500" />;
      case "Pengantaran Dokumen":
        return <PackageCheck className="w-4 h-4 text-emerald-500" />;
      default:
        return <ClipboardList className="w-4 h-4 text-primary" />;
    }
  };

  const getTaskBadgeClass = (type: string) => {
    switch (type) {
      case "Jemput Dokumen":
      case "Jemput Hasil Samsat":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "Proses Samsat":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "Pengantaran Dokumen":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <div className="w-full space-y-4 max-w-xl mx-auto pb-6 text-left">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 rounded-2xl border border-primary/15">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Daftar Tugas Siap Diambil
          </h2>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          {isLoading && allPoolTasks.length === 0 ? (
            <span>Memuat daftar tugas yang tersedia...</span>
          ) : directPendingTasks.length > 0 ? (
            <span>
              Ada <strong className="text-amber-600 dark:text-amber-400 font-bold">{directPendingTasks.length} tugas khusus</strong> ditugaskan admin kepada Anda.
            </span>
          ) : allPoolTasks.length > 0 ? (
            <span>
              Tersedia <strong className="text-foreground font-semibold">{allPoolTasks.length} tugas baru</strong> yang siap diambil.
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Belum ada tugas baru yang tersedia saat ini.
            </span>
          )}
        </p>
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

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center border-dashed rounded-2xl bg-card/60">
          <Inbox className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="font-semibold text-base text-foreground">
            Tidak ada tugas tersedia
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Semua tugas yang tersedia sudah diambil oleh rekan messenger atau belum ada tugas baru dari admin.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isDirectAssignment = task.acceptanceStatus === "PENDING";
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              task.lokasi || "Jakarta"
            )}`;

            return (
              <Card
                key={`${task.orderNo}-${task.keteranganTugas}`}
                className={cn(
                  "p-4 rounded-2xl transition-all border",
                  isDirectAssignment
                    ? "border-amber-400/60 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/15"
                    : "border-border/80 bg-card"
                )}
              >
                {/* Direct Assignment Banner if assigned specially to this courier */}
                {isDirectAssignment && (
                  <div className="flex items-center gap-1.5 pb-2.5 mb-2.5 border-b border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 text-xs font-bold">
                    <Sparkles className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Ditugaskan khusus untuk Anda oleh Admin</span>
                  </div>
                )}

                {/* Top Row: Order No & Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {task.orderNo}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-semibold flex items-center gap-1 py-0.5 px-2", getTaskBadgeClass(task.keteranganTugas))}
                      >
                        {getTaskIcon(task.keteranganTugas)}
                        <span>{task.keteranganTugas}</span>
                      </Badge>
                    </div>
                    <h3 className="font-bold text-base text-foreground mt-1 truncate">
                      {task.customer}
                    </h3>
                  </div>

                  {/* Vehicle Tag */}
                  <div className="text-right shrink-0">
                    <Badge variant="secondary" className="font-mono text-xs font-bold bg-muted">
                      {task.nopol}
                    </Badge>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[120px]">
                      {task.jenisTugas || task.rawOrder?.layanan || "Layanan Biro Jasa"}
                    </p>
                  </div>
                </div>

                {/* Location row */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2.5 pt-2 border-t border-border/50">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{task.lokasi}</span>
                </div>

                {/* Actions row: Explicit Lihat Tugas with min-h-[48px], no inline acceptance */}
                <div className="mt-3 pt-3 border-t border-border/60">
                  <Button
                    variant="outline"
                    onClick={() => handleOpenDetail(task)}
                    className="w-full h-12 min-h-[48px] px-4 text-sm font-semibold rounded-xl text-foreground hover:bg-muted/80 border-border flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4 text-primary" />
                    <span>Lihat Tugas & Persyaratan</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bottom Sheet / Modal Detail Tugas */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
          {selectedTask && (
            <>
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-semibold flex items-center gap-1 py-0.5 px-2", getTaskBadgeClass(selectedTask.keteranganTugas))}
                  >
                    {getTaskIcon(selectedTask.keteranganTugas)}
                    <span>{selectedTask.keteranganTugas}</span>
                  </Badge>
                  {selectedTask.acceptanceStatus === "PENDING" && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                      Khusus untuk Anda
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  {selectedTask.orderNo}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Layanan: {selectedTask.jenisTugas || selectedTask.rawOrder?.layanan || "Layanan Biro Jasa"} • Kendaraan: {selectedTask.nopol}
                </DialogDescription>
              </div>

              {/* Body Content */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-left flex-1">
                {/* Data Pelanggan */}
                <div className="bg-card p-3.5 rounded-xl border border-border/80 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Informasi Pelanggan
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm sm:text-base text-foreground">
                        {selectedTask.customer}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Kendaraan: {selectedTask.rawOrder?.jenisKendaraan || "Kendaraan"} ({selectedTask.nopol})
                      </p>
                    </div>
                    {selectedTask.phone && (
                      <a
                        href={`tel:${selectedTask.phone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-xl hover:bg-emerald-600/20 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Hubungi</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Lokasi */}
                <div className="bg-card p-3.5 rounded-xl border border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Lokasi Tugas
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        selectedTask.lokasi || "Jakarta"
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 text-xs font-semibold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Buka Google Maps</span>
                    </a>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{selectedTask.lokasi}</span>
                  </div>
                </div>

                {/* Berkas & Dokumen Terkait */}
                <div className="bg-card p-3.5 rounded-xl border border-border/80 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Berkas / Dokumen Persyaratan
                  </p>
                  {(() => {
                    const reqDetail = serviceStore.getServiceRequirementsDetail(
                      selectedTask.rawOrder || selectedTask.jenisTugas
                    );

                    return (
                      <>
                        {reqDetail.warningNotice && (
                          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <span>{reqDetail.warningNotice}</span>
                          </div>
                        )}
                        {reqDetail.requirements.length > 0 && (
                          <ul className="text-xs sm:text-sm text-foreground space-y-1.5 list-disc list-inside">
                            {reqDetail.requirements.map((req, idx) => (
                              <li key={idx}>{req}</li>
                            ))}
                          </ul>
                        )}
                        {reqDetail.requirements.length === 0 && !reqDetail.warningNotice && (
                          <p className="text-xs text-muted-foreground italic">
                            Tidak ada persyaratan dokumen khusus yang terdaftar.
                          </p>
                        )}
                      </>
                    );
                  })()}
                  {selectedTask.rawOrder?.catatanOrder && (
                    <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground">
                      <strong>Catatan Order:</strong> {selectedTask.rawOrder.catatanOrder}
                    </div>
                  )}
                </div>

                {/* Estimasi / Target */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>Batas Waktu Pelaksanaan:</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {selectedTask.deadlineAt ? new Date(selectedTask.deadlineAt).toLocaleDateString("id-ID") : "Hari ini (Sesuai Jadwal)"}
                  </span>
                </div>
              </div>

              {/* Sticky Footer with min-h-[48px] */}
              <div className="p-4 border-t border-border bg-card flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDetailOpen(false)}
                  disabled={isClaiming}
                  className="h-12 min-h-[48px] px-4 text-sm font-semibold rounded-xl"
                >
                  Tutup
                </Button>

                {selectedTask.acceptanceStatus === "PENDING" && (
                  <Button
                    variant="outline"
                    disabled={isClaiming}
                    onClick={() => {
                      setIsDetailOpen(false);
                      handleOpenDeclineDialog(selectedTask);
                    }}
                    className="h-12 min-h-[48px] px-4 text-sm font-semibold rounded-xl border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    Tolak Tugas
                  </Button>
                )}

                <Button
                  onClick={() => handleClaimTask(selectedTask)}
                  disabled={isClaiming}
                  className="h-12 min-h-[48px] px-6 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex-1 sm:flex-none"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isClaiming
                    ? "Memproses..."
                    : selectedTask.acceptanceStatus === "PENDING"
                    ? "Terima Tugas Ini"
                    : "Ambil Tugas Ini"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline Confirmation Dialog */}
      <Dialog
        open={!!declineTargetTask}
        onOpenChange={(open) => {
          if (!open) {
            setDeclineTargetTask(null);
            setDeclineReason("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              Tolak Tugas Khusus
            </DialogTitle>
            <DialogDescription className="text-left text-sm pt-1">
              Anda akan menolak tugas <strong>{declineTargetTask?.orderNo}</strong> (
              {declineTargetTask?.keteranganTugas}). Tugas ini akan dikembalikan ke status belum
              ditugaskan agar Admin dapat menugaskan kurir lain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-left">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Alasan Penolakan <span className="text-muted-foreground text-[10px] font-normal lowercase">(opsional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Contoh: Sedang mengurus berkas mutasi di Samsat lain, jarak terlalu jauh, dsb (opsional)..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full text-sm rounded-xl p-3 border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeclineTargetTask(null)}
              disabled={isDeclineSubmitting}
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDecline}
              disabled={isDeclineSubmitting}
              className="rounded-xl font-bold"
            >
              {isDeclineSubmitting ? "Menolak..." : "Konfirmasi Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
