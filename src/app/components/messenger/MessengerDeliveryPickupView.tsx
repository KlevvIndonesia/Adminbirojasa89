import { useState, useMemo, useEffect } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Truck,
  PackageCheck,
  CheckCircle2,
  Inbox,
  PlayCircle,
  Plus,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import {
  MessengerTaskItem,
  getActiveDeliveryPickupTasksForEmployee,
  startMessengerTask,
  UserContext,
} from "../../data/messengerTaskAdapter";
import { useOrderStore } from "../../data/orderStore";
import { MessengerTaskCard } from "./MessengerTaskCard";
import { MessengerMobileTaskDetail } from "./MessengerMobileTaskDetail";
import { MessengerJemputHasilDetailView } from "./MessengerJemputHasilDetailView";
import { toast } from "sonner";
import { cn } from "../ui/utils";

interface MessengerDeliveryPickupViewProps {
  currentUser: UserContext;
  onNavigateToTab?: (tab: string, orderNo?: string) => void;
  initialSelectedOrderNo?: string;
  onDetailActiveChange?: (active: boolean) => void;
}

type DeliveryChip = "ALL" | "Jemput Dokumen" | "Jemput Hasil" | "Pengantaran Dokumen";

export function MessengerDeliveryPickupView({
  currentUser,
  onNavigateToTab,
  initialSelectedOrderNo,
  onDetailActiveChange,
}: MessengerDeliveryPickupViewProps) {
  const { activeOrders, isLoading } = useOrderStore();
  const [selectedChip, setSelectedChip] = useState<DeliveryChip>("ALL");
  const [selectedTask, setSelectedTask] = useState<MessengerTaskItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [startingOrderNo, setStartingOrderNo] = useState<string | null>(null);

  // Dedicated Jemput Hasil page lifecycle: Notify parent workspace to hide bottom navigation bar
  const isJemputHasilOpen = Boolean(selectedTask && selectedTask.keteranganTugas === "Jemput Hasil Samsat");

  useEffect(() => {
    onDetailActiveChange?.(isJemputHasilOpen);
    return () => {
      onDetailActiveChange?.(false);
    };
  }, [isJemputHasilOpen, onDetailActiveChange]);

  // Active delivery/pickup tasks strictly assigned to this messenger
  const activeTasks = useMemo(() => {
    return getActiveDeliveryPickupTasksForEmployee(activeOrders, currentUser);
  }, [activeOrders, currentUser]);

  // Initial task selection if passed from navigation
  useMemo(() => {
    if (initialSelectedOrderNo && !selectedTask) {
      const match = activeTasks.find((t) => t.orderNo === initialSelectedOrderNo);
      if (match) {
        setSelectedTask(match);
        setIsDetailOpen(true);
      }
    }
  }, [initialSelectedOrderNo, activeTasks]);

  const counts = useMemo(() => {
    return {
      all: activeTasks.length,
      jemput: activeTasks.filter((t) => t.keteranganTugas === "Jemput Dokumen").length,
      jemputHasil: activeTasks.filter((t) => t.keteranganTugas === "Jemput Hasil Samsat").length,
      antar: activeTasks.filter((t) => t.keteranganTugas === "Pengantaran Dokumen").length,
    };
  }, [activeTasks]);

  const filteredTasks = useMemo(() => {
    return activeTasks.filter((t) => {
      if (selectedChip === "ALL") return true;
      if (selectedChip === "Jemput Dokumen") {
        return t.keteranganTugas === "Jemput Dokumen";
      }
      if (selectedChip === "Jemput Hasil") {
        return t.keteranganTugas === "Jemput Hasil Samsat";
      }
      return t.keteranganTugas === "Pengantaran Dokumen";
    });
  }, [activeTasks, selectedChip]);

  const handleOpenDetail = (task: MessengerTaskItem) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleStartTask = async (task: MessengerTaskItem) => {
    if (startingOrderNo === task.orderNo) return;
    setStartingOrderNo(task.orderNo);
    try {
      const res = await startMessengerTask(task.orderNo, currentUser);
      if (res.success) {
        toast.success(`Tugas ${task.orderNo} (${task.keteranganTugas}) berhasil dimulai!`);
      } else {
        toast.error(res.error || "Gagal memulai tugas");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal memulai tugas");
    } finally {
      setStartingOrderNo(null);
    }
  };

  const handleContinueTask = (task: MessengerTaskItem) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  // Phase 4: Dedicated Full-Page View for Jemput Hasil Samsat
  if (selectedTask && selectedTask.keteranganTugas === "Jemput Hasil Samsat") {
    return (
      <MessengerJemputHasilDetailView
        task={selectedTask}
        currentUser={currentUser}
        onBack={() => {
          setSelectedTask(null);
          setIsDetailOpen(false);
        }}
        onTaskUpdated={() => {
          setSelectedTask(null);
          setIsDetailOpen(false);
        }}
      />
    );
  }

  return (
    <div className="w-full space-y-4 max-w-xl mx-auto pb-6 text-left">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-blue-500/20">
        <div className="flex items-center gap-2 mb-1.5">
          <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Antar / Jemput Dokumen
          </h2>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          {isLoading && activeTasks.length === 0 ? (
            <span>Memuat data tugas antar/jemput...</span>
          ) : activeTasks.length > 0 ? (
            <span>
              Anda memiliki <strong className="text-foreground font-semibold">{activeTasks.length} tugas</strong> antar & jemput berkas yang sedang berjalan.
            </span>
          ) : (
            <span>
              Tidak ada tugas antar/jemput aktif saat ini. Anda dapat mengambil tugas baru di menu Daftar Tugas.
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
          Jemput Dokumen ({counts.jemput})
        </button>

        <button
          onClick={() => setSelectedChip("Jemput Hasil")}
          className={cn(
            "px-4 py-2 min-h-[44px] rounded-full font-semibold transition-all shrink-0 text-sm",
            selectedChip === "Jemput Hasil"
              ? "bg-purple-600 text-white shadow-2xs"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Jemput Hasil ({counts.jemputHasil})
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
          Pengantaran Dokumen ({counts.antar})
        </button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center border-dashed rounded-2xl bg-card/60">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="font-semibold text-base text-foreground">
            Tidak ada tugas antar/jemput aktif
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
            Saat ini Anda belum memiliki tugas penjemputan atau pengantaran yang sedang berjalan.
          </p>
          {onNavigateToTab && (
            <Button
              onClick={() => onNavigateToTab("daftar-tugas")}
              className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px]"
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Buka Daftar Tugas
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <MessengerTaskCard
              key={`${task.orderNo}-${task.keteranganTugas}`}
              task={task}
              onViewDetail={handleOpenDetail}
              onStartTask={handleStartTask}
              onContinueTask={handleContinueTask}
            />
          ))}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <MessengerMobileTaskDetail
          task={selectedTask}
          open={isDetailOpen}
          onOpenChange={(open) => {
            setIsDetailOpen(open);
            if (!open) setSelectedTask(null);
          }}
          currentUser={currentUser}
          onTaskUpdated={() => {
            setIsDetailOpen(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}
