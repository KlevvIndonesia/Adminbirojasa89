import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  MapPin,
  Phone,
  Clock,
  AlertTriangle,
  Play,
  Eye,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Calendar,
  Check,
  X,
  AlertCircle,
  Lock,
} from "lucide-react";
import {
  MessengerTaskItem,
  getStatusDisplayLabel,
  formatMobileDeadline,
} from "../../../domain/messenger/types";
import { cn } from "../ui/utils";

interface MessengerTaskCardProps {
  task: MessengerTaskItem;
  onViewDetail: (task: MessengerTaskItem) => void;
  onStartTask?: (task: MessengerTaskItem) => void;
  onContinueTask?: (task: MessengerTaskItem) => void;
  onAcceptTask?: (task: MessengerTaskItem) => void;
  onDeclineTask?: (task: MessengerTaskItem) => void;
  isNewTaskMode?: boolean;
}

export function MessengerTaskCard({
  task,
  onViewDetail,
  onStartTask,
  onContinueTask,
  onAcceptTask,
  onDeclineTask,
  isNewTaskMode,
}: MessengerTaskCardProps) {
  const isPendingAcceptance = task.acceptanceStatus === "PENDING" || isNewTaskMode;
  const isStartable =
    !isPendingAcceptance &&
    (task.status === "Belum Diambil" ||
    task.statusCode === "NOT_STARTED" ||
    task.statusCode === "READY");
  const isInProgress =
    task.status === "Dalam Proses" || task.statusCode === "IN_PROGRESS";
  const isWaiting =
    task.status === "Pending" || task.statusCode === "WAITING";
  const isCompleted =
    task.status === "Selesai" || task.statusCode === "COMPLETED";

  // Priority badge: ONLY show if URGENT or IMPORTANT (omit if NORMAL or undefined)
  const isPriorityRelevant =
    task.priority === "URGENT" || task.priority === "IMPORTANT";
  const priorityConfig =
    task.priority === "URGENT"
      ? { label: "URGENT", className: "bg-rose-500/15 text-rose-600 border-rose-300 dark:border-rose-800" }
      : { label: "PENTING", className: "bg-amber-500/15 text-amber-600 border-amber-300 dark:border-amber-800" };

  // Task type styling
  const getTaskTypeBadgeClass = () => {
    switch (task.keteranganTugas) {
      case "Jemput Dokumen":
      case "Jemput Hasil Samsat":
        return "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900";
      case "Proses Samsat":
        return "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900";
      case "Pengantaran Dokumen":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const formattedDeadline = formatMobileDeadline(task.deadlineAt);

  const mapsUrl =
    task.rawOrder.alamatPenjemputan?.mapsUrl ||
    task.rawOrder.alamatPengantaran?.mapsUrl ||
    `https://maps.google.com/?q=${encodeURIComponent(task.lokasi)}`;

  const handlePrimaryAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStartable && onStartTask) {
      onStartTask(task);
    } else if (isInProgress && onContinueTask) {
      onContinueTask(task);
    } else {
      onViewDetail(task);
    }
  };

  const getPrimaryActionLabel = () => {
    if (isStartable) {
      if (task.keteranganTugas === "Jemput Dokumen") return "Mulai Jemput";
      if (task.keteranganTugas === "Jemput Hasil Samsat") return "Mulai Jemput Hasil";
      if (task.keteranganTugas === "Pengantaran Dokumen") return "Mulai Antar";
      return "Mulai";
    }
    if (isInProgress) return "Lanjutkan";
    return "Lihat";
  };

  return (
    <Card
      className={cn(
        "p-4 sm:p-5 transition-all border w-full bg-card shadow-xs rounded-2xl",
        task.deadlineStatus === "APPROACHING" && !isCompleted && "border-amber-300 dark:border-amber-800 bg-amber-50/15 dark:bg-amber-950/10",
        task.deadlineStatus === "OVERDUE" && !isCompleted && "border-rose-300 dark:border-rose-800 bg-rose-50/15 dark:bg-rose-950/10"
      )}
    >
      {/* Top Bar: Order ID, Type Badge, Priority (only if relevant), Deadline */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm sm:text-base text-foreground tracking-tight">
            {task.orderNo}
          </span>
          <Badge
            variant="outline"
            className={cn("text-xs font-semibold px-2.5 py-0.5", getTaskTypeBadgeClass())}
          >
            {task.keteranganTugas}
          </Badge>
          {task.acceptanceStatus === "PENDING" && !isCompleted && (
            <Badge
              variant="outline"
              className="text-xs font-semibold px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 flex items-center gap-1"
            >
              <Clock className="w-3 h-3" />
              Menunggu Diterima
            </Badge>
          )}
          {(task.isLocked || task.acceptanceStatus === "ACCEPTED") && !isCompleted && (
            <Badge
              variant="outline"
              className="text-xs font-semibold px-2 py-0.5 bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              Diterima
            </Badge>
          )}
          {(!task.messenger || task.messenger === "Belum Ditugaskan" || !task.assignedMessengerId) && !isCompleted && (
            <Badge
              variant="outline"
              className="text-xs font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
            >
              Tersedia
            </Badge>
          )}
          {isPriorityRelevant && (
            <Badge
              variant="outline"
              className={cn("text-xs font-bold px-2 py-0.5", priorityConfig.className)}
            >
              {priorityConfig.label}
            </Badge>
          )}
        </div>

        {/* Deadline label formatted concisely */}
        <div className="text-right shrink-0">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Selesai
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold",
                task.deadlineStatus === "OVERDUE" && "text-rose-600 dark:text-rose-400 font-bold",
                task.deadlineStatus === "APPROACHING" && "text-amber-600 dark:text-amber-400 font-bold",
                task.deadlineStatus === "SAFE" && "text-muted-foreground"
              )}
            >
              {task.deadlineStatus === "OVERDUE" && <AlertTriangle className="w-4 h-4 shrink-0" />}
              {task.deadlineStatus === "APPROACHING" && <Clock className="w-4 h-4 shrink-0" />}
              {formattedDeadline}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="py-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate">
              {task.customer}
            </h4>
            <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground flex-wrap">
              <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-foreground text-xs sm:text-sm">
                {task.nopol}
              </span>
              <span>•</span>
              <span className="truncate font-medium">{task.jenisTugas}</span>
            </div>

            {/* Target Selesai Order (Customer Overall Completion Target) */}
            {task.targetCompletionDate && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>
                  Target Selesai Order:{" "}
                  <strong className="text-foreground">
                    {new Date(task.targetCompletionDate).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                </span>
              </div>
            )}

            {/* Reassignment Notice if task was reassigned from another courier */}
            {task.reassignedFrom && (
              <div className="text-xs bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-2.5 py-1.5 rounded-lg font-medium flex items-start gap-1.5 mt-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span>
                    Dialihkan dari <strong>{task.reassignedFrom}</strong>
                  </span>
                  {task.reassignReason && (
                    <span className="block text-[11px] text-amber-700/80 dark:text-amber-300/80 italic mt-0.5">
                      Alasan: &ldquo;{task.reassignReason}&rdquo;
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="text-right shrink-0">
            <span
              className={cn(
                "inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-semibold",
                isPendingAcceptance && "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800",
                !isPendingAcceptance && isStartable && "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
                isInProgress && "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
                isWaiting && "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
                isCompleted && "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              )}
            >
              {isPendingAcceptance ? "Menunggu Konfirmasi" : getStatusDisplayLabel(task.statusCode || task.status)}
            </span>
            {task.waitingReason && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1 truncate max-w-[150px]">
                {task.waitingReason}
              </p>
            )}
          </div>
        </div>

        {/* Location & Quick Contact Link */}
        <div className="flex items-center justify-between gap-3 text-sm pt-1 text-muted-foreground">
          <div className="flex items-center gap-1.5 truncate min-w-0">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{task.lokasi}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {task.phone && (
              <a
                href={`tel:${task.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold text-xs sm:text-sm"
                title="Hubungi Customer"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden xs:inline">Hubungi</span>
              </a>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline flex items-center gap-1 font-semibold text-xs sm:text-sm"
              title="Buka Peta"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden xs:inline">Peta</span>
            </a>
          </div>
        </div>
      </div>

      {/* Action Footer: Touch Target >= 48px, Card non-clickable, explicit Lihat Tugas */}
      <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
        {isPendingAcceptance ? (
          <Button
            variant="outline"
            onClick={() => onViewDetail(task)}
            className="w-full sm:w-auto h-12 min-h-[48px] px-5 text-sm sm:text-base font-semibold rounded-xl border-primary/30 text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4 text-primary" />
            <span>Lihat Tugas</span>
          </Button>
        ) : (
          <Button
            onClick={handlePrimaryAction}
            className={cn(
              "h-12 min-h-[48px] px-5 text-sm sm:text-base font-semibold rounded-xl shadow-2xs w-full sm:w-auto transition-all",
              isStartable && "bg-primary hover:bg-primary/90 text-primary-foreground",
              isInProgress && "bg-emerald-600 hover:bg-emerald-700 text-white",
              (isCompleted || isWaiting) && "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
            )}
          >
            {isStartable && <Play className="w-4 h-4 mr-2 fill-current" />}
            {isInProgress && <ArrowRight className="w-4 h-4 mr-2" />}
            {(isCompleted || isWaiting) && <Eye className="w-4 h-4 mr-2" />}
            {getPrimaryActionLabel()}
          </Button>
        )}
      </div>
    </Card>
  );
}
