import { useState, useRef, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  MapPin,
  Phone,
  Clock,
  AlertTriangle,
  Play,
  CheckCircle2,
  Upload,
  FileText,
  User,
  ExternalLink,
  Camera,
  History,
  Send,
} from "lucide-react";
import {
  MessengerTaskItem,
  MessengerComponentProgress,
  ComponentEvidence,
  DeliveryHandoverProof,
  getStatusDisplayLabel,
  WaitingReason,
} from "../../../domain/messenger/types";
import {
  startMessengerTask,
  updateMessengerTaskStatus,
  updateMessengerComponent,
  uploadMessengerEvidence,
  completeMessengerDelivery,
  completeMessengerPickup,
  calculateEstimatedCompletion,
  UserContext,
} from "../../data/messengerTaskAdapter";
import { orderStore } from "../../data/orderStore";
import { MessengerWaitingReasonDialog } from "./MessengerWaitingReasonDialog";
import { toast } from "sonner";
import { cn } from "../ui/utils";
import { processDocumentUpload, formatFileSize } from "../../utils/fileCompressor";
import { documentRepository } from "../../../data/repositories/documentRepository";

interface MessengerTaskDetailModalProps {
  task: MessengerTaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserContext;
  onTaskUpdated: () => void;
}

const DURATION_OPTIONS = [
  { label: "1 Jam", minutes: 60 },
  { label: "2 Jam", minutes: 120 },
  { label: "4 Jam", minutes: 240 },
  { label: "8 Jam", minutes: 480 },
  { label: "12 Jam", minutes: 720 },
  { label: "24 Jam (1 Hari)", minutes: 1440 },
  { label: "2 Hari", minutes: 2880 },
  { label: "3 Hari", minutes: 4320 },
  { label: "5 Hari", minutes: 7200 },
];

export function MessengerTaskDetailModal({
  task,
  open,
  onOpenChange,
  currentUser,
  onTaskUpdated,
}: MessengerTaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<string>("operational");
  const [isWaitingDialogOpen, setIsWaitingDialogOpen] = useState(false);
  const [waitingTargetComponentId, setWaitingTargetComponentId] = useState<string | null>(null);

  // Local state for Delivery Handover Form (Stage 7 -> 8)
  const deliveryFileInputRef = useRef<HTMLInputElement>(null);
  const evidenceFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCompForEvidence, setSelectedCompForEvidence] = useState<{ id: string; name: string } | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [recipientName, setRecipientName] = useState(task?.rawOrder?.deliveryHandover?.recipientName || task?.customer || "");
  const [relationship, setRelationship] = useState(task?.rawOrder?.deliveryHandover?.relationship || "Pemilik Langsung");
  const [deliveryFileUrl, setDeliveryFileUrl] = useState<string>(task?.rawOrder?.deliveryHandover?.photoProofUrl || "");
  const [deliveryFileName, setDeliveryFileName] = useState<string>(task?.rawOrder?.deliveryHandover?.fileName || (task?.rawOrder?.deliveryHandover?.photoProofUrl ? "Foto_Serah_Terima.jpg" : ""));
  const [deliveryFileType, setDeliveryFileType] = useState<"image" | "pdf">(task?.rawOrder?.deliveryHandover?.fileType || "image");
  const [deliveryFileSize, setDeliveryFileSize] = useState<number>(task?.rawOrder?.deliveryHandover?.fileSize || 0);
  const [isCompressingDeliveryFile, setIsCompressingDeliveryFile] = useState(false);

  // Section 2.B Checklist Dokumen Wajib
  const requiredDocs = useMemo(() => {
    if (!task) return [];
    const clientDocs = task.rawOrder?.clientDocuments;
    if (clientDocs && Object.keys(clientDocs).length > 0) {
      return Object.entries(clientDocs).map(([key, doc]) => ({
        key,
        name: doc.name || (key.toUpperCase() === "STNK" ? "STNK Asli" : key.toUpperCase() === "BPKB" ? "BPKB Asli" : key.toUpperCase() === "KTP" ? "KTP Pemilik Asli" : key.toUpperCase() === "SKKP" ? "SKKP (Surat Ketetapan Pajak)" : key),
        isMandatory: doc.isOptional !== true,
      }));
    }
    return [
      { key: "stnk", name: "STNK Asli", isMandatory: true },
      { key: "bpkb", name: "BPKB Asli", isMandatory: true },
      { key: "ktp", name: "KTP Pemilik Asli", isMandatory: true },
      { key: "skkp", name: "SKKP (Surat Ketetapan Pajak)", isMandatory: false },
      { key: "lainnya", name: "Dokumen Tambahan / Surat Kuasa", isMandatory: false },
    ];
  }, [task?.rawOrder?.clientDocuments, task]);

  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>(() => {
    return task?.rawOrder?.pickupChecklist || {};
  });

  const handleToggleDoc = (key: string, checked: boolean) => {
    if (!task) return;
    const updated = { ...checkedDocs, [key]: checked };
    setCheckedDocs(updated);
    orderStore.updateOrder(task.orderNo, {
      pickupChecklist: updated,
    });
  };

  const [isSubmittingPickup, setIsSubmittingPickup] = useState(false);
  const [isStartingTask, setIsStartingTask] = useState(false);

  // Synchronize local form states whenever task changes
  useEffect(() => {
    if (!task) return;
    setRecipientName(task.rawOrder?.deliveryHandover?.recipientName || task.customer || "");
    setRelationship(task.rawOrder?.deliveryHandover?.relationship || "Pemilik Langsung");
    setDeliveryFileUrl(task.rawOrder?.deliveryHandover?.photoProofUrl || "");
    setDeliveryFileName(task.rawOrder?.deliveryHandover?.fileName || (task.rawOrder?.deliveryHandover?.photoProofUrl ? "Foto_Serah_Terima.jpg" : ""));
    setDeliveryFileType(task.rawOrder?.deliveryHandover?.fileType || "image");
    setDeliveryFileSize(task.rawOrder?.deliveryHandover?.fileSize || 0);
    setCheckedDocs(task.rawOrder?.pickupChecklist || {});
  }, [task]);

  const handleCompletePickup = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task) return;
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

  // Handler: Start task
  const handleStartTask = async () => {
    if (!task || isStartingTask) return;
    setIsStartingTask(true);
    try {
      const res = await startMessengerTask(task.orderNo, currentUser);
      if (res.success) {
        toast.success(`Tugas ${task.orderNo} berhasil dimulai!`);
        onTaskUpdated();
      } else {
        toast.error(res.error || "Gagal memulai tugas");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal memulai tugas");
    } finally {
      setIsStartingTask(false);
    }
  };

  // Handler: Change task status to Waiting
  const handleOpenWaitingDialog = (componentId?: string) => {
    setWaitingTargetComponentId(componentId || null);
    setIsWaitingDialogOpen(true);
  };

  const handleWaitingDialogSubmit = (reason: WaitingReason) => {
    if (!task) return;
    if (waitingTargetComponentId) {
      // Component-level waiting
      const res = updateMessengerComponent(
        task.orderNo,
        waitingTargetComponentId,
        { status: "WAITING", waitingReason: reason },
        currentUser
      );
      if (res.success) {
        toast.success(`Status komponen diubah ke Menunggu (${reason})`);
        onTaskUpdated();
      } else {
        toast.error(res.error || "Gagal memperbarui komponen");
      }
    } else {
      // Task-level waiting
      const res = updateMessengerTaskStatus(
        task.orderNo,
        "WAITING",
        { waitingReason: reason },
        currentUser
      );
      if (res.success) {
        toast.success(`Status tugas diubah ke Menunggu (${reason})`);
        onTaskUpdated();
      } else {
        toast.error(res.error || "Gagal mengubah status tugas");
      }
    }
    setIsWaitingDialogOpen(false);
    setWaitingTargetComponentId(null);
  };

  // Handler: Update component status
  const handleUpdateComponentStatus = (componentId: string, status: any) => {
    if (!task) return;
    if (status === "WAITING") {
      handleOpenWaitingDialog(componentId);
      return;
    }

    const updates: Partial<MessengerComponentProgress> = { status };
    if (status === "IN_PROGRESS" && !task.startedAt) {
      updates.startedAt = new Date().toISOString();
    }

    const res = updateMessengerComponent(task.orderNo, componentId, updates, currentUser);
    if (res.success) {
      toast.success("Status komponen diperbarui");
      onTaskUpdated();
    } else {
      toast.error(res.error || "Gagal memperbarui komponen");
    }
  };

  // Handler: Update component duration estimation
  const handleUpdateComponentDuration = (componentId: string, minutes: number) => {
    if (!task) return;
    const res = updateMessengerComponent(
      task.orderNo,
      componentId,
      {
        status: "IN_PROGRESS",
        estimatedDurationMinutes: minutes,
      },
      currentUser
    );
    if (res.success) {
      toast.success(`Estimasi durasi diperbarui (${minutes} menit)`);
      onTaskUpdated();
    } else {
      toast.error(res.error || "Gagal memperbarui estimasi");
    }
  };

  // Handler: Real evidence upload for component
  const handleEvidenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompForEvidence || !task) return;

    try {
      setIsUploadingEvidence(true);
      const processed = await processDocumentUpload(file);
      let fileUrl = processed.fileUrl;

      try {
        const uploaded = await documentRepository.uploadDocument(processed.file, {
          orderNo: task.orderNo,
          documentType: selectedCompForEvidence.name,
          metadata: {
            phase: "AFTER",
            componentId: selectedCompForEvidence.id,
          },
        });
        if (uploaded?.id) {
          fileUrl = uploaded.fileUrl;
        }
      } catch (err) {
        console.warn("Evidence server upload failed, using processed fileUrl:", err);
      }

      const evidence: ComponentEvidence = {
        id: `ev-${Date.now()}`,
        fileUrl,
        fileType: processed.fileType === "pdf" ? "PDF" : "IMAGE",
        fileName: processed.fileName,
        fileSize: formatFileSize(processed.fileSize),
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser.userName,
      };

      const res = uploadMessengerEvidence(task.orderNo, selectedCompForEvidence.id, evidence, currentUser);
      if (res.success) {
        toast.success(`Bukti untuk ${selectedCompForEvidence.name} (${processed.fileName}) berhasil diunggah!`);
        onTaskUpdated();
      } else {
        toast.error(res.error || "Gagal mengunggah bukti");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses berkas bukti");
    } finally {
      setIsUploadingEvidence(false);
      e.target.value = "";
      setSelectedCompForEvidence(null);
    }
  };

  // Handler: Real file change for delivery handover (PDF, JPG, JPEG, PNG, HEIC up to 5MB with compression)
  const handleDeliveryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;

    try {
      setIsCompressingDeliveryFile(true);
      const processed = await processDocumentUpload(file);
      let finalFileUrl = processed.fileUrl;

      try {
        const uploaded = await documentRepository.uploadDocument(processed.file, {
          orderNo: task.orderNo,
          documentType: "Bukti Serah Terima",
          metadata: {
            phase: "AFTER",
            category: "Bukti Serah Terima",
          },
        });
        if (uploaded?.id) {
          finalFileUrl = uploaded.fileUrl;
        }
      } catch (uploadErr) {
        console.warn("Delivery proof server upload failed, using processed fileUrl:", uploadErr);
      }

      setDeliveryFileUrl(finalFileUrl);
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

  // Handler: Submit delivery completion (Stage 7 -> 8)
  const handleCompleteDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!recipientName.trim()) {
      toast.error("Nama penerima dokumen wajib diisi!");
      return;
    }

    const handoverProof: DeliveryHandoverProof = {
      recipientName: recipientName.trim(),
      relationship,
      photoProofUrl: deliveryFileUrl || undefined,
      fileName: deliveryFileName || undefined,
      fileType: deliveryFileType,
      fileSize: deliveryFileSize || undefined,
      notes: undefined,
      completedAt: new Date().toISOString(),
    };

    const res = completeMessengerDelivery(task.orderNo, handoverProof, currentUser);
    if (res.success) {
      toast.success("Serah terima dokumen berhasil diselesaikan! Order berpindah ke Dokumen Telah Diterima.");
      onTaskUpdated();
      onOpenChange(false);
    } else {
      toast.error(res.error || "Gagal menyelesaikan pengantaran");
    }
  };

  if (!task) return null;

  const mapsUrl =
    task.rawOrder.alamatPenjemputan?.mapsUrl ||
    task.rawOrder.alamatPengantaran?.mapsUrl ||
    `https://maps.google.com/?q=${encodeURIComponent(task.lokasi)}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="border-b border-border/80 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  Detail Tugas: {task.orderNo}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Informasi tugas messenger, data pelanggan, alamat, dan instruksi penugasan
                </DialogDescription>
                <Badge variant="outline" className="text-xs">
                  {task.keteranganTugas}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Status:
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {getStatusDisplayLabel(task.statusCode || task.status)}
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-3">
            <TabsList className="grid grid-cols-3 w-full h-9">
              <TabsTrigger value="operational" className="text-xs">
                Alur Operasional
              </TabsTrigger>
              <TabsTrigger value="info" className="text-xs">
                Informasi Order
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs">
                Riwayat & Log
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OPERATIONAL WORKFLOW */}
            <TabsContent value="operational" className="space-y-4 pt-3">
              {/* === CASE 1: JEMPUT DOKUMEN === */}
              {task.keteranganTugas === "Jemput Dokumen" && (
                <div className="space-y-4">
                  {/* Action Bar for Jemput */}
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${task.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        <Phone className="w-3.5 h-3.5" /> Hubungi Customer
                      </a>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Buka Alamat Maps
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      {task.status === "Belum Diambil" && (
                        <Button
                          size="sm"
                          onClick={handleStartTask}
                          disabled={isStartingTask}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 mr-1 fill-current" /> {isStartingTask ? "Memulai..." : "Mulai Penjemputan"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Section 2.B: Dokumen Fisik yang Perlu Diambil (Checklist Wajib) */}
                  <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Dokumen Fisik yang Perlu Diambil
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Centang seluruh dokumen fisik wajib yang diterima dari klien sebelum menyelesaikan tugas.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5">
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
                              "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all",
                              isChecked
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200"
                                : "bg-muted/40 border-border/80 hover:bg-muted text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleToggleDoc(doc.key, e.target.checked)}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                              />
                              <div>
                                <span className="font-semibold text-xs block">
                                  {doc.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {doc.isMandatory ? "Wajib Dicentang" : "Opsional (Bila Ada)"}
                                </span>
                              </div>
                            </div>
                            {isChecked ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5">
                                ✓ Diterima
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                {doc.isMandatory ? "Belum Diambil" : "Opsional"}
                              </Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2.C: Catatan Kendala Historis (Read-Only) */}
                  {(task.rawOrder.catatanKendala || task.rawOrder.pickupProof?.catatanKendala) && (
                    <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                        Catatan Kendala Historis
                      </span>
                      <p className="text-xs text-foreground italic">
                        "{task.rawOrder.catatanKendala || task.rawOrder.pickupProof?.catatanKendala}"
                      </p>
                    </div>
                  )}

                  {/* Selesaikan Penjemputan Action (When in progress) */}
                  {(task.status === "Dalam Proses" || task.statusCode === "IN_PROGRESS") && (
                    <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/10 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-foreground block">
                          Selesaikan Penjemputan Dokumen
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Pastikan seluruh dokumen wajib telah dicentang sebelum menyelesaikan tugas.
                        </span>
                      </div>
                      <Button
                        size="sm"
                        disabled={isSubmittingPickup}
                        onClick={() => handleCompletePickup()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-4 shadow-xs shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        {isSubmittingPickup ? "Menyimpan..." : "Selesaikan Penjemputan"}
                      </Button>
                    </div>
                  )}

                  {/* Bukti Penjemputan Tersimpan (When completed or proof exists) */}
                  {task.rawOrder.pickupProof && (
                    <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/20 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Bukti Penjemputan Terverifikasi
                        </span>
                        {task.rawOrder.pickupProof.completedAt && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(task.rawOrder.pickupProof.completedAt).toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                      {task.rawOrder.pickupProof.catatanKendala && (
                        <p className="text-xs text-foreground/80 italic bg-card p-2 rounded border border-border/60">
                          Kendala: "{task.rawOrder.pickupProof.catatanKendala}"
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* === CASE 2: PROSES SAMSAT === */}
              {task.keteranganTugas === "Proses Samsat" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                    <div>
                      <p className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                        Lokasi Samsat: {task.lokasi}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Layanan: {task.jenisTugas} ({task.rawOrder.wilayahSamsatAsal})
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenWaitingDialog()}
                      className="text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1" /> Kendala Samsat
                    </Button>
                  </div>

                  {/* Component Breakdown List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Komponen Pengurusan Samsat
                    </h4>

                    {(task.componentProgress && task.componentProgress.length > 0
                      ? task.componentProgress
                      : (task.rawOrder.samsatProcesses || []).map(p => ({
                          componentId: p.id,
                          name: p.name,
                          category: p.category,
                          nominal: p.actualCost || p.basePrice,
                          status: p.status === "Selesai" ? "COMPLETED" : (p.status === "Sedang Diproses" ? "IN_PROGRESS" : "NOT_STARTED"),
                        } as MessengerComponentProgress))
                    ).map((comp) => {
                      const isCompCompleted = comp.status === "COMPLETED";
                      const isCompInProgress = comp.status === "IN_PROGRESS";
                      const isCompWaiting = comp.status === "WAITING";

                      return (
                        <div
                          key={comp.componentId}
                          className={cn(
                            "p-3.5 rounded-xl border bg-card space-y-3 transition-colors",
                            isCompCompleted && "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/10",
                            isCompWaiting && "border-amber-200 dark:border-amber-900/60 bg-amber-50/10"
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-foreground">
                                  {comp.name}
                                </span>
                                {comp.category && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {comp.category}
                                  </Badge>
                                )}
                              </div>
                              {comp.nominal !== undefined && comp.nominal > 0 && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Biaya Dasar: Rp {comp.nominal.toLocaleString("id-ID")}
                                </p>
                              )}
                            </div>

                            {/* Status Selector */}
                            <div className="flex items-center gap-2">
                              <Select
                                value={comp.status}
                                onValueChange={(val) => handleUpdateComponentStatus(comp.componentId, val)}
                              >
                                <SelectTrigger className="h-7 text-xs w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NOT_STARTED" className="text-xs">Belum Dikerjakan</SelectItem>
                                  <SelectItem value="IN_PROGRESS" className="text-xs">Sedang Dikerjakan</SelectItem>
                                  <SelectItem value="WAITING" className="text-xs">Menunggu</SelectItem>
                                  <SelectItem value="COMPLETED" className="text-xs">Selesai</SelectItem>
                                  <SelectItem value="NOT_REQUIRED" className="text-xs">Tidak Diperlukan</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Waiting Reason Alert if waiting */}
                          {isCompWaiting && comp.waitingReason && (
                            <div className="p-2 rounded-lg bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                              <span>Menunggu: {comp.waitingReason}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenWaitingDialog(comp.componentId)}
                                className="h-6 text-[10px] text-amber-900 dark:text-amber-200 underline"
                              >
                                Ubah Alasan
                              </Button>
                            </div>
                          )}

                          {/* Estimation & Duration arithmetic */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Estimasi Durasi:</span>
                              <Select
                                value={comp.estimatedDurationMinutes ? String(comp.estimatedDurationMinutes) : ""}
                                onValueChange={(v) => handleUpdateComponentDuration(comp.componentId, Number(v))}
                              >
                                <SelectTrigger className="h-6 text-[11px] w-28">
                                  <SelectValue placeholder="Pilih durasi" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DURATION_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.minutes} value={String(opt.minutes)} className="text-xs">
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {comp.estimatedCompletedAt && (
                              <div className="sm:text-right text-[11px] text-muted-foreground">
                                Estimasi Selesai:{" "}
                                <span className="font-semibold text-foreground">
                                  {new Date(comp.estimatedCompletedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })},{" "}
                                  {new Date(comp.estimatedCompletedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Evidence list & Upload action */}
                          <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-medium text-muted-foreground">
                                Bukti Foto/PDF:
                              </span>
                              {(comp.evidence && comp.evidence.length > 0) ? (
                                comp.evidence.map((ev) => (
                                  <span
                                    key={ev.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[10px] font-medium text-foreground"
                                  >
                                    <FileText className="w-3 h-3 text-primary" />
                                    {ev.fileName || "Bukti.jpg"}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">
                                  Belum ada bukti diunggah
                                </span>
                              )}
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUploadingEvidence}
                              onClick={() => {
                                setSelectedCompForEvidence({ id: comp.componentId, name: comp.name });
                                evidenceFileInputRef.current?.click();
                              }}
                              className="h-7 text-xs"
                            >
                              <Upload className="w-3 h-3 mr-1" /> Unggah Bukti
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <input
                    ref={evidenceFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                    className="hidden"
                    onChange={handleEvidenceFileChange}
                  />
                </div>
              )}

              {/* === CASE 3: PENGANTARAN DOKUMEN === */}
              {task.keteranganTugas === "Pengantaran Dokumen" && (
                <div className="space-y-4">
                  {/* Section 4: Alamat Pengantaran Dokumen (Authoritative from Admin) */}
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Alamat Pengantaran Dokumen
                    </h4>
                    {task.rawOrder.alamatPengantaran && (task.rawOrder.alamatPengantaran.detail || task.rawOrder.alamatPengantaran.kota || task.rawOrder.alamatPengantaran.kecamatan) ? (
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold text-foreground">{task.rawOrder.alamatPengantaran.detail}</p>
                        {(task.rawOrder.alamatPengantaran.rtRw || task.rawOrder.alamatPengantaran.nomor) && (
                          <p className="text-[11px] text-muted-foreground">
                            {task.rawOrder.alamatPengantaran.rtRw ? `RT/RW: ${task.rawOrder.alamatPengantaran.rtRw}` : ""}{task.rawOrder.alamatPengantaran.rtRw && task.rawOrder.alamatPengantaran.nomor ? " • " : ""}{task.rawOrder.alamatPengantaran.nomor ? `No. ${task.rawOrder.alamatPengantaran.nomor}` : ""}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {[task.rawOrder.alamatPengantaran.kelurahan, task.rawOrder.alamatPengantaran.kecamatan, task.rawOrder.alamatPengantaran.kota].filter(Boolean).join(", ")}
                        </p>
                        {task.rawOrder.alamatPengantaran.landmark && (
                          <p className="text-[11px] text-primary/90 font-medium">Patokan: {task.rawOrder.alamatPengantaran.landmark}</p>
                        )}
                      </div>
                    ) : task.rawOrder.detailAlamatPengembalian ? (
                      <p className="text-xs text-foreground font-medium">{task.rawOrder.detailAlamatPengembalian}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Alamat pengantaran belum diisi di sistem Admin.</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <a
                        href={`tel:${task.phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Phone className="w-3 h-3" /> Hubungi Customer
                      </a>
                      {task.rawOrder.alamatPengantaran?.mapsUrl ? (
                        <a
                          href={task.rawOrder.alamatPengantaran.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <ExternalLink className="w-3 h-3" /> Buka Google Maps
                        </a>
                      ) : (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <ExternalLink className="w-3 h-3" /> Buka Google Maps
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Bukti Serah Terima Form */}
                  <form onSubmit={handleCompleteDelivery} className="p-4 rounded-xl border border-border bg-card space-y-3.5">
                    <div className="border-b border-border pb-2">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Form Bukti Serah Terima Dokumen (Penyelesaian Tugas)
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Lengkapi nama penerima dan bukti untuk menyelesaikan pengantaran ke customer (Stage 7 → Stage 8).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          Nama Penerima Dokumen <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          placeholder="Nama lengkap yang menerima berkas..."
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          required
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          Hubungan dengan Customer <span className="text-destructive">*</span>
                        </Label>
                        <Select value={relationship} onValueChange={setRelationship}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pemilik Langsung" className="text-xs">Pemilik Langsung</SelectItem>
                            <SelectItem value="Keluarga (Istri/Suami/Anak)" className="text-xs">Keluarga (Istri/Suami/Anak)</SelectItem>
                            <SelectItem value="Karyawan / Staf Kantor" className="text-xs">Karyawan / Staf Kantor</SelectItem>
                            <SelectItem value="Rekan Kerja" className="text-xs">Rekan Kerja</SelectItem>
                            <SelectItem value="Satpam / Security" className="text-xs">Satpam / Security</SelectItem>
                            <SelectItem value="Lainnya" className="text-xs">Lainnya</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Real File Input for Delivery Handover (PDF, JPEG, JPG, PNG, HEIC up to 5MB with compression) */}
                    <input
                      ref={deliveryFileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.HEIC"
                      className="hidden"
                      onChange={handleDeliveryFileChange}
                    />

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground">
                          Bukti Serah Terima (PDF / Foto) <span className="text-destructive">*</span>
                        </Label>
                        <span className="text-[10px] text-muted-foreground">PDF / JPG / PNG (Maks 5MB)</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isCompressingDeliveryFile}
                            onClick={() => deliveryFileInputRef.current?.click()}
                            className="h-8 text-xs font-medium"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1 text-primary" />
                            {isCompressingDeliveryFile
                              ? "Memproses..."
                              : deliveryFileUrl
                              ? "Ganti Berkas / Foto"
                              : "Unggah Berkas / Foto"}
                          </Button>
                        </div>

                        {deliveryFileUrl && (
                          <div className="flex items-center gap-2.5 p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                            {deliveryFileType === "pdf" ? (
                              <div className="w-8 h-8 rounded bg-rose-500/10 border border-rose-200 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-rose-600" />
                              </div>
                            ) : (
                              <img
                                src={deliveryFileUrl}
                                alt="Bukti serah terima"
                                className="w-8 h-8 object-cover rounded border border-border shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1 text-left">
                              <p className="text-[11px] font-semibold text-foreground truncate">
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

                    <div className="pt-2 border-t border-border flex justify-end">
                      <Button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Selesaikan Pengantaran (Serah Terima)
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: INFORMASI ORDER */}
            <TabsContent value="info" className="space-y-3 pt-3">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Nama Customer:</span>
                    <p className="font-semibold text-foreground mt-0.5">{task.customer}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nomor Polisi:</span>
                    <p className="font-semibold text-foreground mt-0.5">{task.nopol}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Jenis Pengurusan:</span>
                    <p className="font-semibold text-foreground mt-0.5">{task.jenisTugas}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Wilayah Samsat:</span>
                    <p className="font-semibold text-foreground mt-0.5">{task.rawOrder.wilayahSamsatAsal}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tahapan Saat Ini:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      Stage {task.currentStep} - {task.currentStageName}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60">
                  <span className="text-xs text-muted-foreground">Alamat Penjemputan:</span>
                  <p className="text-xs font-medium text-foreground mt-0.5">
                    {task.rawOrder.alamatPenjemputan?.detail || "-"}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/60">
                  <span className="text-xs text-muted-foreground">Alamat Pengantaran:</span>
                  <p className="text-xs font-medium text-foreground mt-0.5">
                    {task.rawOrder.alamatPengantaran?.detail || task.rawOrder.detailAlamatPengembalian || "Alamat pengantaran belum diisi di sistem Admin."}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: TIMELINE & AUDIT LOG */}
            <TabsContent value="timeline" className="space-y-3 pt-3">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-primary" />
                  Log Operasional Messenger
                </h4>

                {(task.rawOrder.messengerTimeline && task.rawOrder.messengerTimeline.length > 0) ? (
                  <div className="space-y-2.5 pt-1">
                    {task.rawOrder.messengerTimeline.map((item) => (
                      <div key={item.id} className="p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs space-y-1">
                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span className="font-semibold text-foreground">{item.title}</span>
                          <span>{new Date(item.timestamp).toLocaleString("id-ID")}</span>
                        </div>
                        {item.note && (
                          <p className="text-foreground">{item.note}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">Oleh: {item.author}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    Belum ada riwayat tercatat untuk tugas ini.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t border-border/80 pt-3 flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-medium"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waiting Reason Dialog */}
      <MessengerWaitingReasonDialog
        open={isWaitingDialogOpen}
        onOpenChange={setIsWaitingDialogOpen}
        onSubmit={handleWaitingDialogSubmit}
        title={waitingTargetComponentId ? "Pilih Alasan Menunggu Komponen" : "Pilih Alasan Menunggu Tugas"}
      />
    </>
  );
}
