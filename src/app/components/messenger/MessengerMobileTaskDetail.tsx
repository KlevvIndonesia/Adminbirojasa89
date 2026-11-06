import { useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  MapPin,
  Phone,
  Clock,
  Play,
  CheckCircle2,
  FileText,
  ExternalLink,
  Camera,
  MessageCircle,
  X,
  ArrowRight,
  Upload,
  FileCheck2,
  Save,
  Share2,
  Info,
} from "lucide-react";
import {
  MessengerTaskItem,
  getStatusDisplayLabel,
  formatMobileDeadline,
  DeliveryHandoverProof,
} from "../../../domain/messenger/types";
import {
  startMessengerTask,
  updateMessengerTaskStatus,
  completeMessengerDelivery,
  completeMessengerPickup,
  completeSamsatResultPickup,
  acceptMessengerTaskAction,
  declineMessengerTaskAction,
  releasePickupTaskAction,
  releaseDeliveryTaskAction,
  startPickupTaskAction,
  completePickupTaskAction,
  startDeliveryTaskAction,
  completeDeliveryTaskAction,
  UserContext,
} from "../../data/messengerTaskAdapter";
import { orderStore } from "../../data/orderStore";
import { serviceStore } from "../../data/serviceStore";
import { MessengerWaitingReasonDialog } from "./MessengerWaitingReasonDialog";
import { toast } from "sonner";
import { cn } from "../ui/utils";
import { processDocumentUpload, formatFileSize } from "../../utils/fileCompressor";

interface MessengerMobileTaskDetailProps {
  task: MessengerTaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserContext;
  onTaskUpdated: () => void;
  onNavigateToSamsat?: (orderNo: string) => void;
  onAcceptTask?: (task: MessengerTaskItem) => Promise<void> | void;
  onDeclineTask?: (task: MessengerTaskItem) => void;
}

export function MessengerMobileTaskDetail({
  task,
  open,
  onOpenChange,
  currentUser,
  onTaskUpdated,
  onNavigateToSamsat,
  onAcceptTask,
  onDeclineTask,
}: MessengerMobileTaskDetailProps) {
  if (!task) return null;

  const [isWaitingDialogOpen, setIsWaitingDialogOpen] = useState(false);
  const [isAcceptingTask, setIsAcceptingTask] = useState(false);
  const [isDetailDeclineOpen, setIsDetailDeclineOpen] = useState(false);
  const [detailDeclineReason, setDetailDeclineReason] = useState("");
  const [isDetailDeclineSubmitting, setIsDetailDeclineSubmitting] = useState(false);

  const handleAcceptPendingTask = async () => {
    setIsAcceptingTask(true);
    try {
      if (onAcceptTask) {
        await onAcceptTask(task);
        onTaskUpdated();
        onOpenChange(false);
        return;
      }

      const res = await acceptMessengerTaskAction(task.orderNo, task.keteranganTugas, currentUser);
      if (res.success) {
        toast.success(`Tugas ${task.orderNo} (${task.keteranganTugas}) berhasil diterima!`);
        onTaskUpdated();
        onOpenChange(false);
      } else {
        const errorMsg = res.error || "Gagal menerima tugas";
        const isConflict =
          errorMsg.toLowerCase().includes("conflict") ||
          errorMsg.toLowerCase().includes("sudah diambil") ||
          errorMsg.toLowerCase().includes("tidak tersedia");
        if (isConflict) {
          toast.error(errorMsg || "Tugas ini sudah diambil kurir lain.");
          onOpenChange(false);
        } else {
          toast.error(errorMsg);
        }
        onTaskUpdated();
      }
    } finally {
      setIsAcceptingTask(false);
    }
  };

  const handleConfirmDetailDecline = async () => {
    if (!detailDeclineReason.trim()) {
      toast.error("Alasan penolakan tugas wajib diisi!");
      return;
    }
    setIsDetailDeclineSubmitting(true);
    try {
      const res = await declineMessengerTaskAction(
        task.orderNo,
        task.keteranganTugas,
        detailDeclineReason.trim(),
        currentUser
      );
      if (res.success) {
        toast.success(`Tugas ${task.orderNo} berhasil ditolak.`);
        setIsDetailDeclineOpen(false);
        setDetailDeclineReason("");
        onTaskUpdated();
        onOpenChange(false);
      } else {
        toast.error(res.error || "Gagal menolak tugas");
      }
    } finally {
      setIsDetailDeclineSubmitting(false);
    }
  };

  // Hidden file input refs for real image picker
  const pickupFileInputRef = useRef<HTMLInputElement>(null);
  const deliveryFileInputRef = useRef<HTMLInputElement>(null);

  // Local state for Jemput Dokumen completion form
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState(task.pickupProof?.photoProofUrl || "");
  const [isSubmittingPickup, setIsSubmittingPickup] = useState(false);

  // Section 2.B Checklist Dokumen Wajib
  const requiredDocs = useMemo(() => {
    const clientDocs = task.rawOrder.clientDocuments;
    if (clientDocs && Object.keys(clientDocs).length > 0) {
      return Object.entries(clientDocs).map(([key, doc]) => ({
        key,
        name: doc.name || (key.toUpperCase() === "STNK" ? "STNK Asli" : key.toUpperCase() === "BPKB" ? "BPKB Asli" : key.toUpperCase() === "KTP" ? "KTP Pemilik Asli" : key.toUpperCase() === "SKKP" ? "SKKP (Surat Ketetapan Pajak)" : key),
        isMandatory: doc.isOptional !== true,
      }));
    }
    const reqDetail = serviceStore.getServiceRequirementsDetail(
      task.rawOrder || task.jenisTugas
    );
    if (reqDetail.requirements && reqDetail.requirements.length > 0) {
      return reqDetail.requirements.map((reqName, idx) => ({
        key: `req-${idx}`,
        name: reqName,
        isMandatory: true,
      }));
    }
    return [
      { key: "stnk", name: "STNK Asli", isMandatory: true },
      { key: "bpkb", name: "BPKB Asli", isMandatory: true },
      { key: "ktp", name: "KTP Pemilik Asli", isMandatory: true },
      { key: "skkp", name: "SKKP (Surat Ketetapan Pajak)", isMandatory: false },
      { key: "lainnya", name: "Dokumen Tambahan / Surat Kuasa", isMandatory: false },
    ];
  }, [task.rawOrder.clientDocuments, task.rawOrder?.service_id, task.rawOrder?.layanan, task.jenisTugas]);

  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>(() => {
    return task.rawOrder.pickupChecklist || {};
  });

  const handleToggleDoc = (key: string, checked: boolean) => {
    const updated = { ...checkedDocs, [key]: checked };
    setCheckedDocs(updated);
    orderStore.updateOrder(task.orderNo, {
      pickupChecklist: updated,
    });
  };

  // Local state for Delivery Handover Form (Stage 7 -> 8)
  const [recipientName, setRecipientName] = useState(
    task.rawOrder.deliveryHandover?.recipientName || task.customer || ""
  );
  const [relationship, setRelationship] = useState(
    task.rawOrder.deliveryHandover?.relationship || "Pemilik Langsung"
  );
  const [deliveryFileUrl, setDeliveryFileUrl] = useState<string>(
    task.rawOrder.deliveryHandover?.photoProofUrl || ""
  );
  const [deliveryFileName, setDeliveryFileName] = useState<string>(
    task.rawOrder.deliveryHandover?.fileName || ""
  );
  const [deliveryFileType, setDeliveryFileType] = useState<"image" | "pdf">(
    task.rawOrder.deliveryHandover?.fileType || "image"
  );
  const [deliveryFileSize, setDeliveryFileSize] = useState<number>(
    task.rawOrder.deliveryHandover?.fileSize || 0
  );
  const [isCompressingDeliveryFile, setIsCompressingDeliveryFile] = useState(false);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);

  // Local state for Samsat Result Pickup completion form
  const [isSubmittingSamsatPickup, setIsSubmittingSamsatPickup] = useState(false);

  // Scope C: Save Progress & Handover State (Tetap Pegang vs Serahkan ke Tim)
  const [isSaveProgressOpen, setIsSaveProgressOpen] = useState(false);
  const [saveProgressReleaseToPool, setSaveProgressReleaseToPool] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  const handleOpenSaveProgress = () => {
    setSaveProgressReleaseToPool(false);
    setIsSaveProgressOpen(true);
  };

  const handleConfirmSaveProgress = async () => {
    setIsSavingProgress(true);
    try {
      if (saveProgressReleaseToPool) {
        let res: { success: boolean; error?: string };
        if (task.keteranganTugas === "Jemput Dokumen") {
          res = releasePickupTaskAction(task.orderNo, currentUser);
        } else if (task.keteranganTugas === "Pengantaran Dokumen") {
          res = releaseDeliveryTaskAction(task.orderNo, currentUser);
        } else {
          res = { success: false, error: "Workflow tidak mendukung serah terima tugas" };
        }

        if (res.success) {
          toast.success("Tugas berhasil disimpan dan diserahkan ke tim (Daftar Tugas)!");
          setIsSaveProgressOpen(false);
          onOpenChange(false);
          onTaskUpdated();
        } else {
          toast.error(res.error || "Gagal menyerahkan tugas ke tim");
        }
      } else {
        // Tetap Pegang Tugas Ini
        if (task.keteranganTugas === "Jemput Dokumen") {
          orderStore.updateOrder(task.orderNo, {
            pickupChecklist: checkedDocs,
          });
          toast.success("Progres penjemputan berhasil disimpan!");
        } else if (task.keteranganTugas === "Pengantaran Dokumen") {
          orderStore.updateOrder(task.orderNo, {
            deliveryHandover: {
              recipientName,
              relationship,
              photoProofUrl: deliveryFileUrl,
              fileName: deliveryFileName,
              fileType: deliveryFileType,
              fileSize: deliveryFileSize,
            },
          });
          toast.success("Progres pengantaran berhasil disimpan!");
        }
        setIsSaveProgressOpen(false);
        onTaskUpdated();
      }
    } finally {
      setIsSavingProgress(false);
    }
  };

  const isStartable =
    task.status === "Belum Diambil" ||
    task.statusCode === "NOT_STARTED" ||
    task.statusCode === "READY";
  const isInProgress =
    task.status === "Dalam Proses" || task.statusCode === "IN_PROGRESS";
  const isCompleted =
    task.status === "Selesai" || task.statusCode === "COMPLETED";

  const cleanPhone = task.phone ? task.phone.replace(/[^0-9]/g, "") : "";
  const waNumber = cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : cleanPhone;
  const mapsUrl =
    task.rawOrder.alamatPenjemputan?.mapsUrl ||
    task.rawOrder.alamatPengantaran?.mapsUrl ||
    `https://maps.google.com/?q=${encodeURIComponent(task.lokasi)}`;

  const handleStartTask = () => {
    const res = startMessengerTask(task.orderNo, currentUser);
    if (res.success) {
      toast.success(`Tugas ${task.orderNo} berhasil dimulai!`);
      onTaskUpdated();
    } else {
      toast.error(res.error || "Gagal memulai tugas");
    }
  };

  const handleWaitingReasonSubmit = (reason: string) => {
    const res = updateMessengerTaskStatus(
      task.orderNo,
      "WAITING",
      { waitingReason: reason },
      currentUser
    );
    if (res.success) {
      toast.info(`Status tugas diubah menjadi Menunggu: ${reason}`);
      setIsWaitingDialogOpen(false);
      onTaskUpdated();
    } else {
      toast.error(res.error || "Gagal mengubah status tugas");
    }
  };

  // Real file handling for pickup photo
  const handlePickupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPickupPhotoUrl(result);
        toast.success(`Foto ${file.name} berhasil dilampirkan!`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Real file handling for delivery handover (PDF, JPEG, JPG, PNG up to 5MB with compression)
  const handleDeliveryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingDeliveryFile(true);
      const processed = await processDocumentUpload(file);
      setDeliveryFileUrl(processed.fileUrl);
      setDeliveryFileName(processed.fileName);
      setDeliveryFileType(processed.fileType);
      setDeliveryFileSize(processed.fileSize);

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
      setIsCompressingDeliveryFile(false);
      e.target.value = "";
    }
  };

  const handleCompletePickup = (e: React.FormEvent) => {
    e.preventDefault();

    // Section 2.B: Messenger harus mencentang seluruh dokumen wajib sebelum dapat menyelesaikan tugas penjemputan
    const missingMandatory = requiredDocs.filter((d) => d.isMandatory && !checkedDocs[d.key]);
    if (missingMandatory.length > 0) {
      toast.error(
        `Penyelesaian diblokir! Dokumen wajib berikut belum dicentang: ${missingMandatory.map((d) => d.name).join(", ")}`
      );
      return;
    }

    setIsSubmittingPickup(true);

    const res = completeMessengerPickup(
      task.orderNo,
      {
        photoProofUrl: pickupPhotoUrl || undefined,
        pickupChecklist: checkedDocs,
      },
      currentUser
    );

    setIsSubmittingPickup(false);
    if (res.success) {
      toast.success(`Penjemputan dokumen untuk order ${task.orderNo} selesai!`);
      onTaskUpdated();
      onOpenChange(false);
    } else {
      toast.error(res.error || "Gagal menyelesaikan penjemputan");
    }
  };

  const handleCompleteDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      toast.error("Nama penerima wajib diisi!");
      return;
    }

    setIsSubmittingDelivery(true);
    // Section 4: Hapus field catatan serah terima dari form, pertahankan penerima & bukti
    const proof: DeliveryHandoverProof = {
      recipientName: recipientName.trim(),
      relationship,
      photoProofUrl: deliveryFileUrl || undefined,
      fileName: deliveryFileName || undefined,
      fileType: deliveryFileType,
      fileSize: deliveryFileSize || undefined,
      notes: undefined,
      completedAt: new Date().toISOString(),
    };

    const res = completeMessengerDelivery(task.orderNo, proof, currentUser);
    setIsSubmittingDelivery(false);

    if (res.success) {
      toast.success(`Pengantaran order ${task.orderNo} berhasil diselesaikan!`);
      onTaskUpdated();
      onOpenChange(false);
    } else {
      toast.error(res.error || "Gagal menyelesaikan pengantaran");
    }
  };

  const handleCompleteSamsatResultPickupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSamsatPickup(true);

    const res = completeSamsatResultPickup(task.orderNo, undefined, currentUser);
    setIsSubmittingSamsatPickup(false);

    if (res.success) {
      toast.success(`Dokumen hasil Samsat untuk order ${task.orderNo} berhasil diserahkan ke kantor!`);
      onTaskUpdated();
      onOpenChange(false);
    } else {
      toast.error(res.error || "Gagal memperbarui status penyerahan dokumen");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg w-full max-h-[92vh] overflow-y-auto p-0 gap-0 text-left border-border bg-card">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-card border-b border-border/80 px-4 py-3.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle asChild>
                  <span className="font-bold text-lg sm:text-xl text-foreground tracking-tight">
                    {task.orderNo}
                  </span>
                </DialogTitle>
                <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5">
                  {task.keteranganTugas}
                </Badge>
              </div>
              <DialogDescription asChild>
                <p className="text-sm sm:text-base text-muted-foreground mt-0.5 truncate">
                  {task.customer} • <span className="font-mono text-foreground font-bold">{task.nopol}</span>
                  {task.rawOrder.jenisKendaraan && (
                    <span className="text-xs text-muted-foreground ml-1 font-medium">({task.rawOrder.jenisKendaraan}{task.rawOrder.tahunKendaraan ? ` • ${task.rawOrder.tahunKendaraan}` : ""})</span>
                  )}
                </p>
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-10 w-10 p-0 rounded-full shrink-0"
              aria-label="Tutup Detail"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 pb-24">
            {/* Status & Deadline Banner */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/60">
              <div>
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block">
                  Status Tugas
                </span>
                <span className="text-sm sm:text-base font-bold text-foreground">
                  {getStatusDisplayLabel(task.statusCode || task.status)}
                </span>
                {task.waitingReason && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                    Kendala: {task.waitingReason}
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block">
                  Batas Waktu
                </span>
                <span className="text-sm sm:text-base font-semibold text-foreground">
                  {formatMobileDeadline(task.deadlineAt)}
                </span>
              </div>
            </div>

            {/* Quick Contact & Navigation Actions */}
            <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm sm:text-base text-foreground block">Alamat Operasional</span>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{task.lokasi}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-2.5 border-t border-border/60">
                {task.phone ? (
                  <a
                    href={`tel:${task.phone}`}
                    className="flex flex-col items-center justify-center py-2.5 px-1 min-h-[48px] rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground text-center transition-colors"
                  >
                    <Phone className="w-4 h-4 text-emerald-600 mb-1" />
                    <span className="text-xs font-semibold">Telepon</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2.5 px-1 min-h-[48px] rounded-xl border border-border/40 opacity-50 text-center">
                    <Phone className="w-4 h-4 text-muted-foreground mb-1" />
                    <span className="text-xs">Tanpa No</span>
                  </div>
                )}

                {waNumber ? (
                  <a
                    href={`https://wa.me/${waNumber}?text=Halo%20${encodeURIComponent(task.customer)},%20saya%20${encodeURIComponent(currentUser.userName)}%20dari%20Biro%20Jasa%20terkait%20order%20${task.orderNo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center py-2.5 px-1 min-h-[48px] rounded-xl border border-border bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-center transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600 mb-1" />
                    <span className="text-xs font-semibold">WhatsApp</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2.5 px-1 min-h-[48px] rounded-xl border border-border/40 opacity-50 text-center">
                    <MessageCircle className="w-4 h-4 text-muted-foreground mb-1" />
                    <span className="text-xs">WhatsApp</span>
                  </div>
                )}

                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center py-2.5 px-1 min-h-[48px] rounded-xl border border-border bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-center transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-blue-600 mb-1" />
                  <span className="text-xs font-semibold">Google Maps</span>
                </a>
              </div>
            </div>

            {/* Admin Notes / Instructions for Messenger */}
            {(task.rawOrder.catatanPenjadwalan || task.rawOrder.catatanSamsat || task.rawOrder.catatanPengantaran) && (
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs sm:text-sm text-blue-950 dark:text-blue-100 space-y-2 shadow-sm">
                <div className="font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Instruksi & Catatan dari Admin Kantor:</span>
                </div>
                {task.rawOrder.catatanPenjadwalan && task.keteranganTugas === "Jemput Dokumen" && (
                  <div>
                    <span className="font-semibold text-blue-800 dark:text-blue-300">Catatan Penjemputan: </span>
                    <span className="whitespace-pre-wrap">{task.rawOrder.catatanPenjadwalan}</span>
                  </div>
                )}
                {task.rawOrder.catatanSamsat && (task.keteranganTugas === "Proses Samsat" || task.keteranganTugas === "Jemput Hasil Samsat") && (
                  <div>
                    <span className="font-semibold text-blue-800 dark:text-blue-300">Catatan Samsat: </span>
                    <span className="whitespace-pre-wrap">{task.rawOrder.catatanSamsat}</span>
                  </div>
                )}
                {task.rawOrder.catatanPengantaran && task.keteranganTugas === "Pengantaran Dokumen" && (
                  <div>
                    <span className="font-semibold text-blue-800 dark:text-blue-300">Catatan Pengantaran: </span>
                    <span className="whitespace-pre-wrap">{task.rawOrder.catatanPengantaran}</span>
                  </div>
                )}
              </div>
            )}

            {/* === WORKFLOW SECTION: JEMPUT DOKUMEN === */}
            {task.keteranganTugas === "Jemput Dokumen" && (
              <div className="space-y-4">
                {/* Physical Documents to Pick Up (Section 2.B Checklist) */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                        Dokumen Fisik yang Perlu Diambil
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Centang seluruh dokumen fisik wajib yang diterima dari klien sebelum menyelesaikan penjemputan.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 shrink-0">
                      {requiredDocs.filter((d) => checkedDocs[d.key]).length} / {requiredDocs.filter((d) => d.isMandatory).length} Wajib
                    </Badge>
                  </div>

                  <div className="space-y-2 pt-1">
                    {requiredDocs.map((doc) => {
                      const isChecked = Boolean(checkedDocs[doc.key]);
                      return (
                        <label
                          key={doc.key}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                            isChecked
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200"
                              : "bg-muted/40 border-border/80 hover:bg-muted text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleToggleDoc(doc.key, e.target.checked)}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary shrink-0"
                            />
                            <div className="truncate">
                              <span className="font-semibold text-xs sm:text-sm block truncate">
                                {doc.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {doc.isMandatory ? "Wajib Dicentang" : "Opsional (Bila Ada)"}
                              </span>
                            </div>
                          </div>
                          {isChecked ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 shrink-0">
                              ✓ Diterima
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                              {doc.isMandatory ? "Belum Diambil" : "Opsional"}
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Catatan Kendala textarea removed per Scope B Requirement 9 */}

                {/* Selesaikan Penjemputan Form (When in progress) */}
                {isInProgress && (
                  <form onSubmit={handleCompletePickup} className="p-4 rounded-xl border border-border bg-card space-y-3.5">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
                        Konfirmasi Selesai Penjemputan
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Pastikan seluruh dokumen wajib di atas telah dicentang sebelum menyelesaikan tugas.
                      </p>
                    </div>

                    {/* Hidden Real File Input */}
                    <input
                      ref={pickupFileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                      className="hidden"
                      onChange={handlePickupFileChange}
                    />

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">Foto Bukti Penjemputan (Opsional)</Label>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => pickupFileInputRef.current?.click()}
                          className="min-h-[44px] text-sm px-4 rounded-xl"
                        >
                          <Camera className="w-4 h-4 mr-2 text-primary" />
                          {pickupPhotoUrl ? "Ganti Foto" : "Ambil Foto / Unggah"}
                        </Button>
                        {pickupPhotoUrl && (
                          <div className="flex items-center gap-2">
                            <img
                              src={pickupPhotoUrl}
                              alt="Bukti penjemputan"
                              className="w-10 h-10 object-cover rounded-lg border border-border"
                            />
                            <span className="text-xs text-emerald-600 font-semibold">
                              ✓ Foto terlampir
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmittingPickup}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold min-h-[48px] rounded-xl shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {isSubmittingPickup ? "Menyimpan..." : "Selesaikan Jemput Dokumen"}
                    </Button>
                  </form>
                )}

                {/* Bukti Penjemputan Tersimpan (When completed or proof exists) */}
                {task.rawOrder.pickupProof && (
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Bukti Penjemputan Terverifikasi
                      </span>
                      {task.rawOrder.pickupProof.completedAt && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(task.rawOrder.pickupProof.completedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {task.rawOrder.pickupProof.photoProofUrl && (
                      <img
                        src={task.rawOrder.pickupProof.photoProofUrl}
                        alt="Bukti penjemputan"
                        className="w-full max-h-48 object-cover rounded-lg border border-border"
                      />
                    )}
                    {task.rawOrder.pickupProof.catatanKendala && (
                      <p className="text-xs text-foreground/80 italic bg-card p-2 rounded-lg border border-border/60">
                        Kendala Lapangan: "{task.rawOrder.pickupProof.catatanKendala}"
                      </p>
                    )}
                    {task.rawOrder.pickupProof.notes && (
                      <p className="text-xs text-foreground/80 italic bg-card p-2 rounded-lg border border-border/60">
                        Catatan: "{task.rawOrder.pickupProof.notes}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* === WORKFLOW SECTION: JEMPUT HASIL SAMSAT === */}
            {task.keteranganTugas === "Jemput Hasil Samsat" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/20 space-y-2">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-blue-600" />
                    Penjemputan Dokumen Hasil Samsat
                  </span>
                  <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
                    Pengurusan Samsat telah selesai. Ambil dokumen hasil pengurusan (STNK baru, Plat nomor, Notice Pajak, SKKP/Fiskal) dari kantor Samsat dan serahkan kepada Admin di kantor.
                  </p>
                </div>

                {/* Selesaikan Penjemputan Hasil Form (When in progress) */}
                {isInProgress && (
                  <form onSubmit={handleCompleteSamsatResultPickupSubmit} className="p-4 rounded-xl border border-border bg-card space-y-3.5">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
                        Serahkan Dokumen ke Kantor
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Konfirmasi penyerahan fisik berkas hasil Samsat kepada tim Admin di kantor.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmittingSamsatPickup}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold min-h-[48px] rounded-xl shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {isSubmittingSamsatPickup ? "Menyimpan..." : "Dokumen Diserahkan ke Kantor"}
                    </Button>
                  </form>
                )}

                {/* Status Dokumen Telah Diterima di Kantor */}
                {task.rawOrder.samsatPickupStatus === "Dokumen Samsat Diterima di Kantor" && (
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/20 space-y-2">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Dokumen Samsat Diterima di Kantor
                    </span>
                    <p className="text-xs text-muted-foreground font-mono">
                      {task.rawOrder.samsatPickupCompletedAt && new Date(task.rawOrder.samsatPickupCompletedAt).toLocaleString("id-ID")}
                    </p>
                    {task.rawOrder.samsatPickupNotes && (
                      <p className="text-xs text-foreground/80 italic bg-card p-2 rounded-lg border border-border/60">
                        Catatan: "{task.rawOrder.samsatPickupNotes}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* === WORKFLOW SECTION: PENGANTARAN DOKUMEN === */}
            {task.keteranganTugas === "Pengantaran Dokumen" && (
              <div className="space-y-4">
                {/* Section 4: Alamat Pengantaran Dokumen (Authoritative from Admin) */}
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h4 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                      Alamat Pengantaran Dokumen
                    </h4>
                  </div>
                  {task.rawOrder.alamatPengantaran && (task.rawOrder.alamatPengantaran.detail || task.rawOrder.alamatPengantaran.kota || task.rawOrder.alamatPengantaran.kecamatan) ? (
                    <div className="space-y-1 text-xs sm:text-sm pt-1">
                      <p className="font-bold text-foreground">
                        {task.rawOrder.alamatPengantaran.detail}
                      </p>
                      {(task.rawOrder.alamatPengantaran.rtRw || task.rawOrder.alamatPengantaran.nomor) && (
                        <p className="text-xs text-muted-foreground">
                          {task.rawOrder.alamatPengantaran.rtRw ? `RT/RW: ${task.rawOrder.alamatPengantaran.rtRw}` : ""}{task.rawOrder.alamatPengantaran.rtRw && task.rawOrder.alamatPengantaran.nomor ? " • " : ""}{task.rawOrder.alamatPengantaran.nomor ? `No. ${task.rawOrder.alamatPengantaran.nomor}` : ""}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {[task.rawOrder.alamatPengantaran.kelurahan, task.rawOrder.alamatPengantaran.kecamatan, task.rawOrder.alamatPengantaran.kota].filter(Boolean).join(", ")}
                      </p>
                      {task.rawOrder.alamatPengantaran.landmark && (
                        <p className="text-xs text-primary/90 font-medium">Patokan: {task.rawOrder.alamatPengantaran.landmark}</p>
                      )}
                      {task.rawOrder.alamatPengantaran.mapsUrl && (
                        <a
                          href={task.rawOrder.alamatPengantaran.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline pt-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Buka Google Maps Pengantaran
                        </a>
                      )}
                    </div>
                  ) : task.rawOrder.detailAlamatPengembalian ? (
                    <p className="text-xs sm:text-sm text-foreground font-medium pt-1">
                      {task.rawOrder.detailAlamatPengembalian}
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm text-muted-foreground italic pt-1">
                      Alamat pengantaran belum diisi di sistem Admin.
                    </p>
                  )}
                </div>

                {/* Form Serah Terima Dokumen (Stage 7 -> 8) */}
                {isInProgress && (
                  <form onSubmit={handleCompleteDelivery} className="p-4 rounded-xl border border-border bg-card space-y-3.5">
                    <div className="border-b border-border/60 pb-2.5">
                      <h4 className="text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
                        Form Bukti Serah Terima Dokumen
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Isi nama penerima dan ambil foto/unggah bukti serah terima untuk menyelesaikan pengantaran.
                      </p>
                    </div>

                    {/* Hidden Real File Input (Supports PDF, JPEG, JPG, PNG, HEIC up to 5MB) */}
                    <input
                      ref={deliveryFileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                      className="hidden"
                      onChange={handleDeliveryFileChange}
                    />

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-foreground">
                        Nama Penerima <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Nama jelas orang yang menerima dokumen"
                        className="min-h-[44px] text-base rounded-xl"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-foreground">Hubungan dengan Pemilik</Label>
                      <Select value={relationship} onValueChange={setRelationship}>
                        <SelectTrigger className="min-h-[44px] text-base rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pemilik Langsung">Pemilik Langsung</SelectItem>
                          <SelectItem value="Keluarga">Keluarga (Suami/Istri/Anak)</SelectItem>
                          <SelectItem value="Karyawan / Staff">Karyawan / Staff Kantor</SelectItem>
                          <SelectItem value="Satpam / Resepsionis">Satpam / Resepsionis</SelectItem>
                          <SelectItem value="Lainnya">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-foreground">
                          Bukti Serah Terima (PDF / Foto)
                        </Label>
                        <span className="text-[11px] text-muted-foreground">PDF / JPG / PNG (Maks 5MB)</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isCompressingDeliveryFile}
                          onClick={() => deliveryFileInputRef.current?.click()}
                          className="min-h-[44px] text-sm px-4 rounded-xl w-full justify-center"
                        >
                          <Upload className="w-4 h-4 mr-2 text-primary" />
                          {isCompressingDeliveryFile
                            ? "Memproses & Mengompres Berkas..."
                            : deliveryFileUrl
                            ? "Ganti Berkas / Foto Serah Terima"
                            : "Pilih / Ambil Foto Serah Terima"}
                        </Button>

                        {deliveryFileUrl && (
                          <div className="flex items-center gap-3 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                            {deliveryFileType === "pdf" ? (
                              <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-200 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-rose-600" />
                              </div>
                            ) : (
                              <img
                                src={deliveryFileUrl}
                                alt="Bukti serah terima"
                                className="w-10 h-10 object-cover rounded-lg border border-border shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1 text-left">
                              <p className="text-xs font-semibold text-foreground truncate">
                                {deliveryFileName || "Bukti_Serah_Terima"}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-emerald-600 font-medium">✓ Siap Dilampirkan</span>
                                {deliveryFileSize > 0 && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    ({formatFileSize(deliveryFileSize)})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmittingDelivery}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold min-h-[48px] rounded-xl shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {isSubmittingDelivery ? "Menyimpan Serah Terima..." : "Selesaikan Pengantaran (Stage 8)"}
                    </Button>
                  </form>
                )}

                {/* Bukti Serah Terima Terverifikasi (When already submitted or completed) */}
                {task.rawOrder.deliveryHandover && (
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Bukti Serah Terima Terverifikasi
                      </span>
                      {task.rawOrder.deliveryHandover.completedAt && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(task.rawOrder.deliveryHandover.completedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="text-xs space-y-1 bg-card p-2.5 rounded-lg border border-border/60">
                      <p><span className="text-muted-foreground">Penerima:</span> <strong>{task.rawOrder.deliveryHandover.recipientName}</strong> ({task.rawOrder.deliveryHandover.relationship})</p>
                      {task.rawOrder.deliveryHandover.notes && (
                        <p className="italic text-muted-foreground">Catatan: "{task.rawOrder.deliveryHandover.notes}"</p>
                      )}
                    </div>
                    {task.rawOrder.deliveryHandover.fileType === "pdf" ? (
                      <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
                        <FileText className="w-6 h-6 text-rose-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{task.rawOrder.deliveryHandover.fileName || "Dokumen_Serah_Terima.pdf"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">Dokumen PDF Terverifikasi</p>
                        </div>
                      </div>
                    ) : task.rawOrder.deliveryHandover.photoProofUrl ? (
                      <img
                        src={task.rawOrder.deliveryHandover.photoProofUrl}
                        alt="Bukti serah terima"
                        className="w-full max-h-48 object-cover rounded-lg border border-border"
                      />
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* === WORKFLOW SECTION: PROSES SAMSAT === */}
            {task.keteranganTugas === "Proses Samsat" && (
              <div className="p-4 sm:p-5 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/20 space-y-3 text-center">
                <h4 className="text-sm sm:text-base font-bold text-purple-950 dark:text-purple-200 uppercase tracking-wider">
                  Pengurusan Komponen Samsat
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Kelola progres loket Samsat, estimasi durasi, dan tambah komponen langsung pada tab <strong>Proses Samsat</strong>.
                </p>
                {onNavigateToSamsat && (
                  <Button
                    onClick={() => {
                      onOpenChange(false);
                      onNavigateToSamsat(task.orderNo);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold min-h-[44px] px-5 rounded-xl shadow-xs"
                  >
                    Buka Pengurusan Samsat <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions Bar with touch target >= 48px */}
          <div className="sticky bottom-0 z-20 bg-card border-t border-border px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
            {task.acceptanceStatus === "PENDING" ? (
              <>
                <Button
                  variant="outline"
                  disabled={isAcceptingTask}
                  onClick={() => {
                    if (onDeclineTask) {
                      onDeclineTask(task);
                      onOpenChange(false);
                    } else {
                      setIsDetailDeclineOpen(true);
                    }
                  }}
                  className="h-12 min-h-[48px] px-5 text-sm font-semibold rounded-xl border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Tolak Tugas
                </Button>

                <Button
                  disabled={isAcceptingTask}
                  onClick={handleAcceptPendingTask}
                  className="h-12 min-h-[48px] px-6 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex-1"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {isAcceptingTask ? "Memproses..." : "Terima Tugas Ini"}
                </Button>
              </>
            ) : (
              <>
                {task.keteranganTugas !== "Jemput Dokumen" && (
                  <Button
                    variant="outline"
                    onClick={() => setIsWaitingDialogOpen(true)}
                    className="text-sm text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950 min-h-[48px] h-12 px-4 rounded-xl"
                  >
                    <Clock className="w-4 h-4 mr-1.5" />
                    Kendala
                  </Button>
                )}

                {isStartable && (
                  <Button
                    onClick={handleStartTask}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm sm:text-base font-semibold min-h-[48px] h-12 px-5 flex-1 rounded-xl shadow-xs"
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Mulai Tugas
                  </Button>
                )}

                {isCompleted && (
                  <div className="text-sm text-emerald-600 font-bold flex items-center gap-1.5 min-h-[48px]">
                    <CheckCircle2 className="w-5 h-5" /> Tugas Selesai
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* Scope C: Save Progress & Handover Dialog (Tetap Pegang vs Serahkan ke Tim) */}
      <Dialog open={isSaveProgressOpen} onOpenChange={setIsSaveProgressOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5 text-left">
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <Save className="w-5 h-5 text-primary" />
            Simpan Progres Tugas
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Pilih apakah Anda akan tetap memegang tugas ini atau menyerahkan sisa pekerjaan ke tim (Daftar Tugas).
          </DialogDescription>

          <div className="space-y-3 py-2 text-sm">
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setSaveProgressReleaseToPool(false)}
                className={cn(
                  "p-3.5 rounded-xl border text-left transition-all",
                  !saveProgressReleaseToPool
                    ? "border-primary bg-primary/10 shadow-2xs"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <p className="text-sm font-bold text-foreground">
                  Tetap Pegang Tugas Ini
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Progres saat ini tersimpan dan Anda tetap menjadi penanggung jawab tugas ini.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSaveProgressReleaseToPool(true)}
                className={cn(
                  "p-3.5 rounded-xl border text-left transition-all",
                  saveProgressReleaseToPool
                    ? "border-amber-600 bg-amber-500/10 shadow-2xs"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-amber-600" />
                  Serahkan ke Tim (Kembalikan ke Daftar Tugas)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Progres saat ini tersimpan. Tugas akan kembali ke Daftar Tugas (Pool) agar dapat dilanjutkan oleh rekan kurir lain.
                </p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={isSavingProgress}
              onClick={() => setIsSaveProgressOpen(false)}
              className="h-11 px-4 text-sm font-semibold rounded-xl"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmSaveProgress}
              disabled={isSavingProgress}
              className={cn(
                "h-11 px-5 text-sm font-bold rounded-xl text-white shadow-xs",
                saveProgressReleaseToPool
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              {isSavingProgress
                ? "Menyimpan..."
                : saveProgressReleaseToPool
                ? "Simpan & Serahkan ke Tim"
                : "Simpan Progres"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waiting Reason Dialog */}
      <MessengerWaitingReasonDialog
        open={isWaitingDialogOpen}
        onOpenChange={setIsWaitingDialogOpen}
        onSubmit={handleWaitingReasonSubmit}
      />

      {/* Detail Decline Confirmation Dialog */}
      <Dialog
        open={isDetailDeclineOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDetailDeclineOpen(false);
            setDetailDeclineReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl p-5 text-left">
          <DialogTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
            <X className="w-5 h-5" />
            Tolak Penugasan
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Apakah Anda yakin ingin menolak tugas ini? Tugas akan dikembalikan ke status belum ditugaskan agar dapat dialihkan oleh Admin.
          </DialogDescription>

          <div className="space-y-3 py-2 text-sm">
            <div className="p-3 rounded-xl bg-muted/60 space-y-1 border border-border">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Nomor Order:</span>
                <span className="font-bold text-foreground font-mono">{task.orderNo}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tugas:</span>
                <span className="font-semibold text-primary">{task.keteranganTugas}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <Textarea
                value={detailDeclineReason}
                onChange={(e) => setDetailDeclineReason(e.target.value)}
                placeholder="Contoh: Kendaraan sedang servis, kapasitas tugas penuh..."
                rows={3}
                className="text-sm rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={isDetailDeclineSubmitting}
              onClick={() => setIsDetailDeclineOpen(false)}
              className="h-11 px-4 text-sm font-semibold rounded-xl"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmDetailDecline}
              disabled={isDetailDeclineSubmitting || !detailDeclineReason.trim()}
              className="h-11 px-5 text-sm font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              {isDetailDeclineSubmitting ? "Menolak..." : "Ya, Tolak Tugas"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
